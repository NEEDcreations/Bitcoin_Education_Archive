/**
 * Pleb Underground Sync Worker
 * Bitcoin Education Archive — TCTV Channel 0
 *
 * Architecture:
 *   - KV store (PU_STATE) holds live status + pending video queue
 *   - Cron (every 5 min): checks YouTube for live status + new uploads
 *   - HTTP endpoints served to the TCTV client for live override
 *
 * HTTP Routes:
 *   GET  /live          — Current live status (polled by TCTV client every 60s)
 *   GET  /pending       — List new videos not yet in timechain-tv.js
 *   GET  /status        — Full worker status (live + sync state)
 *   POST /force-check   — Force an immediate check (admin, requires YT_API_KEY header)
 *
 * Secrets (via wrangler secret put):
 *   YT_API_KEY — YouTube Data API v3 key
 *
 * KV Keys:
 *   live_status    — JSON: { isLive, videoId, title, checkedAt }
 *   sync_state     — JSON: { lastChecked, runCount }
 *   pending_videos — JSON: [ { id, title, duration, publishedAt } ]
 */

const YT_CHANNEL_ID = 'UCVfMv5xEfrafk1rSthJ0t9g';
const UPLOADS_PLAYLIST = 'UUVfMv5xEfrafk1rSthJ0t9g';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-cache, no-store'
};

// ── YouTube API helpers ──

async function ytFetch(path, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/${path}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`YouTube API ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

function parseISO8601Duration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

// ── KV Helpers ──

async function kvGet(kv, key) {
  const val = await kv.get(key);
  if (!val) return null;
  try { return JSON.parse(val); }
  catch { return null; }
}

async function kvSet(kv, key, value, ttl) {
  const opts = ttl ? { expirationTtl: ttl } : {};
  await kv.put(key, JSON.stringify(value), opts);
}

// ── Live Check ──

async function checkLiveStatus(apiKey, kv) {
  // Search for active live broadcasts from the channel
  // YouTube search.list costs 100 quota units
  const data = await ytFetch(
    `search?part=snippet&channelId=${YT_CHANNEL_ID}&eventType=live&type=video&maxResults=1`,
    apiKey
  );

  const liveItem = data.items && data.items[0];
  const now = new Date().toISOString();

  if (liveItem) {
    const status = {
      isLive: true,
      videoId: liveItem.id.videoId,
      title: liveItem.snippet.title,
      channelName: 'Pleb Underground',
      startedAt: now,
      checkedAt: now
    };
    await kvSet(kv, 'live_status', status, 600); // 10 min TTL
    return status;
  } else {
    const status = {
      isLive: false,
      videoId: '',
      title: '',
      channelName: 'Pleb Underground',
      checkedAt: now
    };
    await kvSet(kv, 'live_status', status, 600);
    return status;
  }
}

// ── New Uploads Check ──

async function checkNewUploads(apiKey, kv) {
  // Get latest 10 uploads (most recent first)
  // playlistItems.list costs 1 quota unit
  const data = await ytFetch(
    `playlistItems?part=contentDetails,snippet&playlistId=${UPLOADS_PLAYLIST}&maxResults=10`,
    apiKey
  );

  if (!data.items || data.items.length === 0) return { checked: 0, added: 0 };

  const syncState = await kvGet(kv, 'sync_state') || {};
  const lastChecked = syncState.lastChecked || '2026-05-15T00:00:00Z';

  // Find videos published after our last check
  const newIds = [];
  for (const item of data.items) {
    const publishedAt = item.contentDetails.videoPublishedAt || item.snippet.publishedAt;
    if (publishedAt > lastChecked) {
      newIds.push(item.contentDetails.videoId);
    }
  }

  if (newIds.length === 0) {
    await kvSet(kv, 'sync_state', { ...syncState, lastChecked: new Date().toISOString(), lastNewCount: 0 });
    return { checked: data.items.length, added: 0 };
  }

  // Verify video details — videos.list costs 1 quota unit per request
  const details = await ytFetch(
    `videos?part=snippet,contentDetails,status&id=${newIds.join(',')}`,
    apiKey
  );

  const pending = await kvGet(kv, 'pending_videos') || [];
  const existingIds = new Set(pending.map(v => v.id));
  let added = 0;

  for (const item of (details.items || [])) {
    if (item.status.privacyStatus !== 'public') continue;
    if (!item.status.embeddable) continue;

    const duration = parseISO8601Duration(item.contentDetails.duration);
    if (duration === 0) continue; // Skip live-in-progress or upcoming

    if (existingIds.has(item.id)) continue; // Already queued

    pending.push({
      id: item.id,
      title: item.snippet.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"'),
      duration: duration,
      publishedAt: item.snippet.publishedAt,
      addedAt: new Date().toISOString()
    });
    added++;
  }

  await kvSet(kv, 'pending_videos', pending);
  await kvSet(kv, 'sync_state', {
    ...syncState,
    lastChecked: new Date().toISOString(),
    lastNewCount: added,
    runCount: (syncState.runCount || 0) + 1
  });

  return { checked: data.items.length, added };
}

// ── Cron Handler ──
// YouTube API quota: 10,000 units/day
// search.list = 100 units, playlistItems.list = 1, videos.list = 1
// At 5-min intervals = 288 runs/day
// Live check every run: 288 × 100 = 28,800 units — OVER QUOTA!
// Solution: check live every 3rd run (~15 min) = 96 × 100 = 9,600 units
// Upload check every 3rd run: 96 × 2 = 192 units
// Total: ~9,792 units/day — fits within 10K quota

async function handleCron(env) {
  const apiKey = env.YT_API_KEY;
  const kv = env.PU_STATE;
  if (!apiKey || !kv) return { error: 'Missing YT_API_KEY or PU_STATE KV' };

  const syncState = await kvGet(kv, 'sync_state') || {};
  const runCount = (syncState.runCount || 0) + 1;

  const results = { runCount };

  // Check live every 3rd run (~15 min) to stay under YouTube quota
  if (runCount % 3 === 0) {
    try {
      results.live = await checkLiveStatus(apiKey, kv);
    } catch (e) {
      results.live = { error: e.message };
    }

    // Also check uploads on the same run
    try {
      results.uploads = await checkNewUploads(apiKey, kv);
    } catch (e) {
      results.uploads = { error: e.message };
    }
  } else {
    results.skipped = true;
    results.nextCheckIn = `${(3 - (runCount % 3)) * 5} min`;
  }

  // Update run count
  await kvSet(kv, 'sync_state', { ...syncState, runCount, lastRun: new Date().toISOString() });

  return results;
}

// ── HTTP Handler ──

async function handleRequest(request, env) {
  const url = new URL(request.url);

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const kv = env.PU_STATE;

  if (url.pathname === '/live') {
    const live = kv ? await kvGet(kv, 'live_status') : null;
    return new Response(JSON.stringify(live || { isLive: false, checkedAt: null }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  if (url.pathname === '/pending') {
    const pending = kv ? await kvGet(kv, 'pending_videos') : [];
    return new Response(JSON.stringify({ count: (pending || []).length, videos: pending || [] }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  if (url.pathname === '/status') {
    const live = kv ? await kvGet(kv, 'live_status') : null;
    const sync = kv ? await kvGet(kv, 'sync_state') : null;
    const pending = kv ? await kvGet(kv, 'pending_videos') : [];
    return new Response(JSON.stringify({ live, sync, pendingCount: (pending || []).length }, null, 2), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  if (url.pathname === '/force-check' && request.method === 'POST') {
    const apiKey = env.YT_API_KEY;
    if (!apiKey || !kv) {
      return new Response(JSON.stringify({ error: 'YT_API_KEY or KV not configured' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    const live = await checkLiveStatus(apiKey, kv);
    const uploads = await checkNewUploads(apiKey, kv);
    return new Response(JSON.stringify({ live, uploads }, null, 2), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  // Clear pending (after ingesting into timechain-tv.js)
  if (url.pathname === '/clear-pending' && request.method === 'POST') {
    if (kv) await kvSet(kv, 'pending_videos', []);
    return new Response(JSON.stringify({ cleared: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  return new Response(
    'Pleb Underground Sync Worker — TCTV Channel 0\n\n' +
    'GET  /live          — Live stream status (polled by TCTV)\n' +
    'GET  /pending       — New videos queue\n' +
    'GET  /status        — Full worker status\n' +
    'POST /force-check   — Force YouTube check\n' +
    'POST /clear-pending — Clear pending queue after ingestion\n',
    { headers: { 'Content-Type': 'text/plain', ...CORS_HEADERS } }
  );
}

// ── Entry Points ──

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env);
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
  },

  async scheduled(event, env, ctx) {
    const result = await handleCron(env);
    console.log('Pleb Underground cron:', JSON.stringify(result));
  }
};
