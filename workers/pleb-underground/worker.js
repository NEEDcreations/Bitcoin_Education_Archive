/**
 * Pleb Underground Sync Worker
 * Bitcoin Education Archive — TCTV Channel 0
 *
 * Two cron schedules:
 *   Monday night window — live stream detection (Cache API only, zero KV)
 *   Weekly Friday 7 PM EST (Sat 00:00 UTC) — new upload sync (KV for pending queue)
 *
 * KV Budget (free tier: 1,000 writes/day, 100,000 reads/day):
 *   Live detection: 0 KV ops — uses CF Cache API exclusively
 *   Weekly upload sync: ~4 KV ops (2 reads + 2 writes)
 *   /live client polls: 0 KV ops — served from edge cache
 *   Target: <10 KV writes/day, <50 KV reads/day
 *
 * HTTP Routes:
 *   GET  /live          — Live status (edge-cached, 0 KV reads)
 *   GET  /pending       — New videos queue (KV read)
 *   GET  /status        — Full status
 *   POST /force-check   — Force immediate YouTube check
 *   POST /clear-pending — Clear pending queue after ingestion
 *
 * Secrets: YT_API_KEY
 *
 * KV Keys (PU_STATE):
 *   sync_state     — { lastChecked, lastNewCount }
 *   pending_videos — [ { id, title, duration, publishedAt } ]
 */

const YT_CHANNEL_ID = 'UCVfMv5xEfrafk1rSthJ0t9g';
const UPLOADS_PLAYLIST = 'UUVfMv5xEfrafk1rSthJ0t9g';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Cache key URL for live status — must be a valid URL for Cache API
const LIVE_CACHE_KEY = 'https://pleb-underground-sync.needcreations.workers.dev/__internal/live-cache';

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

// ── KV Helpers (used ONLY for upload sync) ──

async function kvGet(kv, key) {
  const val = await kv.get(key);
  if (!val) return null;
  try { return JSON.parse(val); }
  catch { return null; }
}

async function kvSet(kv, key, value) {
  await kv.put(key, JSON.stringify(value));
}

// ── Cache API helpers (used for live status — zero KV) ──

async function cacheGetLive() {
  const cache = caches.default;
  const resp = await cache.match(new Request(LIVE_CACHE_KEY));
  if (!resp) return null;
  try { return await resp.json(); }
  catch { return null; }
}

async function cacheSetLive(data, ttlSeconds) {
  const cache = caches.default;
  const body = JSON.stringify(data);
  const resp = new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${ttlSeconds}`,
    }
  });
  await cache.put(new Request(LIVE_CACHE_KEY), resp);
}

// ── Monday Night Live Window Helper ──
// Pleb Underground goes live ~8 PM EDT on Mondays.
// EDT = UTC-4. 7:30 PM EDT = 23:30 UTC (Mon). 11 PM EDT = 03:00 UTC (Tue).
function _isMonLiveWindow(isoString) {
  var d = new Date(isoString);
  var day = d.getUTCDay(); // 0=Sun, 1=Mon, 2=Tue
  var h = d.getUTCHours();
  var m = d.getUTCMinutes();
  // Mon 23:30-23:59 UTC (7:30-7:59 PM EDT)
  if (day === 1 && h === 23 && m >= 30) return true;
  // Tue 00:00-02:59 UTC (8:00-10:59 PM EDT)
  if (day === 2 && h <= 2) return true;
  return false;
}

// ── Live Check (Cache API only — no KV) ──

async function checkLiveStatus(apiKey) {
  const data = await ytFetch(
    `search?part=snippet&channelId=${YT_CHANNEL_ID}&eventType=live&type=video&maxResults=1`,
    apiKey
  );

  const liveItem = data.items && data.items[0];
  const now = new Date().toISOString();

  const status = liveItem ? {
    isLive: true,
    videoId: liveItem.id.videoId,
    title: liveItem.snippet.title,
    channelName: 'Pleb Underground',
    startedAt: now,
    checkedAt: now
  } : {
    isLive: false,
    videoId: '',
    title: '',
    channelName: 'Pleb Underground',
    checkedAt: now
  };

  // Shorter cache during Monday night live window (7:45 PM – 8:15 PM EDT = 23:45–00:15 UTC)
  var inMondayWindow = _isMonLiveWindow(now);
  // If live, 60s TTL. If in Monday window but not live yet, 60s (fast retry). Otherwise 10 min.
  var ttl = liveItem ? 60 : (inMondayWindow ? 60 : 600);
  await cacheSetLive(status, ttl);
  return status;
}

// ── New Uploads Check (KV — runs once daily) ──

async function checkNewUploads(apiKey, kv) {
  const data = await ytFetch(
    `playlistItems?part=contentDetails,snippet&playlistId=${UPLOADS_PLAYLIST}&maxResults=10`,
    apiKey
  );

  if (!data.items || data.items.length === 0) return { checked: 0, added: 0 };

  const syncState = await kvGet(kv, 'sync_state') || {};
  const lastChecked = syncState.lastChecked || '2026-05-15T00:00:00Z';

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
    if (duration === 0) continue;
    if (existingIds.has(item.id)) continue;

    pending.push({
      id: item.id,
      title: item.snippet.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"'),
      duration: duration,
      publishedAt: item.snippet.publishedAt,
      addedAt: new Date().toISOString()
    });
    added++;
  }

  if (added > 0) {
    await kvSet(kv, 'pending_videos', pending);
  }
  await kvSet(kv, 'sync_state', {
    ...syncState,
    lastChecked: new Date().toISOString(),
    lastNewCount: added
  });

  return { checked: data.items.length, added };
}

// ── Cron Handler ──

async function handleCron(event, env) {
  const apiKey = env.YT_API_KEY;
  const kv = env.PU_STATE;
  if (!apiKey) return { error: 'Missing YT_API_KEY' };

  const results = {};

  // Determine which cron fired based on time
  const now = new Date(event.scheduledTime);
  const hour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 6=Sat
  // Weekly upload sync: Saturday 00:00 UTC = Friday 7 PM EST
  const isWeeklySync = (hour === 0 && dayOfWeek === 6);
  const isLiveWindow = _isMonLiveWindow(now.toISOString());

  // Live check only during Monday night window (PU only streams Mon 8 PM EDT)
  if (isLiveWindow) {
    try {
      results.live = await checkLiveStatus(apiKey);
    } catch (e) {
      results.live = { error: e.message };
    }
  }

  // Upload check only on the weekly Friday sync run
  if (isWeeklySync && kv) {
    try {
      results.uploads = await checkNewUploads(apiKey, kv);
    } catch (e) {
      results.uploads = { error: e.message };
    }
  }

  return results;
}

// ── HTTP Handler ──

async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const kv = env.PU_STATE;

  if (url.pathname === '/live') {
    // Serve from edge cache — zero KV reads
    const live = await cacheGetLive();
    return new Response(JSON.stringify(live || { isLive: false, checkedAt: null }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
        ...CORS_HEADERS
      }
    });
  }

  if (url.pathname === '/pending') {
    const pending = kv ? await kvGet(kv, 'pending_videos') : [];
    return new Response(JSON.stringify({ count: (pending || []).length, videos: pending || [] }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  if (url.pathname === '/status') {
    const live = await cacheGetLive();
    const sync = kv ? await kvGet(kv, 'sync_state') : null;
    const pending = kv ? await kvGet(kv, 'pending_videos') : [];
    return new Response(JSON.stringify({ live, sync, pendingCount: (pending || []).length }, null, 2), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  if (url.pathname === '/force-check' && request.method === 'POST') {
    const apiKey = env.YT_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'YT_API_KEY not configured' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    const live = await checkLiveStatus(apiKey);
    const uploads = kv ? await checkNewUploads(apiKey, kv) : { skipped: 'no KV' };
    return new Response(JSON.stringify({ live, uploads }, null, 2), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  if (url.pathname === '/clear-pending' && request.method === 'POST') {
    if (kv) await kvSet(kv, 'pending_videos', []);
    return new Response(JSON.stringify({ cleared: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  return new Response(
    'Pleb Underground Sync Worker — TCTV Channel 0\n\n' +
    'Cron: live check every 15 min (Cache API), upload sync daily 6 PM EST (KV)\n\n' +
    'GET  /live          — Live status (edge-cached, 0 KV)\n' +
    'GET  /pending       — New videos queue\n' +
    'GET  /status        — Full status\n' +
    'POST /force-check   — Force YouTube check\n' +
    'POST /clear-pending — Clear pending queue\n',
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
    const result = await handleCron(event, env);
    console.log('Pleb Underground cron:', JSON.stringify(result));
  }
};
