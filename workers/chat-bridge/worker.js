/**
 * Cloudflare Worker: Global Chat ↔ Telegram Bridge
 * Uses Firebase Admin (service account) for Firestore writes.
 *
 * Secrets (via wrangler secret put):
 *   TG_BOT_TOKEN         — Telegram bot token
 *   FIREBASE_SA_EMAIL     — service account email
 *   FIREBASE_SA_KEY       — PEM private key (with \n literals)
 *   BRIDGE_SECRET         — shared secret for app→telegram calls
 *
 * Vars:
 *   TG_CHAT_ID            — Telegram group chat ID
 *   FIREBASE_PROJECT_ID   — Firebase project ID
 */

const TG_API = 'https://api.telegram.org/bot';
const SCOPES = 'https://www.googleapis.com/auth/datastore';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// In-memory token cache
var _accessToken = null;
var _tokenExpiry = 0;

// ---- Google OAuth2 via Service Account JWT ----
async function getAccessToken(env) {
  var now = Math.floor(Date.now() / 1000);
  if (_accessToken && now < _tokenExpiry) return _accessToken;

  var header = { alg: 'RS256', typ: 'JWT' };
  var payload = {
    iss: env.FIREBASE_SA_EMAIL,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  };

  var jwt = await signJWT(header, payload, env.FIREBASE_SA_KEY);

  var resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt
  });

  var data = await resp.json();
  if (data.access_token) {
    _accessToken = data.access_token;
    _tokenExpiry = now + (data.expires_in || 3600) - 60;
    return _accessToken;
  }
  console.error('OAuth failed:', JSON.stringify(data));
  return null;
}

async function signJWT(header, payload, pemKey) {
  var enc = new TextEncoder();

  // Base64url encode header and payload
  var headerB64 = b64url(JSON.stringify(header));
  var payloadB64 = b64url(JSON.stringify(payload));
  var signingInput = headerB64 + '.' + payloadB64;

  // Import PEM private key
  var key = await importPEM(pemKey);

  // Sign
  var sig = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    enc.encode(signingInput)
  );

  return signingInput + '.' + b64url(sig);
}

async function importPEM(pem) {
  // Handle escaped newlines from env var
  pem = pem.replace(/\\n/g, '\n');
  var lines = pem.split('\n').filter(l => l && !l.startsWith('-----'));
  var der = Uint8Array.from(atob(lines.join('')), c => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8', der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
}

function b64url(input) {
  var str;
  if (typeof input === 'string') {
    str = btoa(input);
  } else {
    // ArrayBuffer
    var bytes = new Uint8Array(input);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    str = btoa(binary);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---- Firestore Admin Write ----
async function writeToFirestore(env, doc) {
  var token = await getAccessToken(env);
  if (!token) { console.error('No access token'); return false; }

  var projectId = env.FIREBASE_PROJECT_ID || 'bitcoin-education-archive';
  var url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/global_chat';

  var resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(doc)
  });

  if (!resp.ok) {
    var err = await resp.text();
    console.error('Firestore write failed (' + resp.status + '):', err);
    return false;
  }
  return true;
}

// ---- Firestore Admin Read ----
async function readFirestoreDoc(env, path) {
  var token = await getAccessToken(env);
  if (!token) return null;
  var projectId = env.FIREBASE_PROJECT_ID || 'bitcoin-education-archive';
  var url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/' + path;
  var resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
  if (!resp.ok) return null;
  return resp.json();
}

async function updateFirestoreDoc(env, path, fields) {
  var token = await getAccessToken(env);
  if (!token) return false;
  var projectId = env.FIREBASE_PROJECT_ID || 'bitcoin-education-archive';
  var fieldPaths = Object.keys(fields).map(function(k) { return 'updateMask.fieldPaths=' + k; }).join('&');
  var url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/' + path + '?' + fieldPaths;
  var doc = { fields: {} };
  for (var k in fields) doc.fields[k] = fields[k];
  var resp = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(doc)
  });
  return resp.ok;
}

async function queryFirestore(env, collection, limit) {
  var token = await getAccessToken(env);
  if (!token) return [];
  var projectId = env.FIREBASE_PROJECT_ID || 'bitcoin-education-archive';
  var url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents:runQuery';
  var resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], limit: limit || 100 } })
  });
  if (!resp.ok) return [];
  var results = await resp.json();
  return results.filter(function(r) { return r.document; }).map(function(r) {
    var f = r.document.fields || {};
    var obj = { _id: r.document.name.split('/').pop() };
    for (var k in f) {
      if (f[k].stringValue !== undefined) obj[k] = f[k].stringValue;
      else if (f[k].integerValue !== undefined) obj[k] = parseInt(f[k].integerValue);
      else if (f[k].doubleValue !== undefined) obj[k] = f[k].doubleValue;
      else if (f[k].booleanValue !== undefined) obj[k] = f[k].booleanValue;
      else if (f[k].timestampValue !== undefined) obj[k] = f[k].timestampValue;
    }
    return obj;
  });
}

// ---- Nacho DJ ----
async function nachoDJCheck(env) {
  // Read current DJ state
  var djDoc = await readFirestoreDoc(env, 'global_chat_meta/live_dj');
  var djData = djDoc ? djDoc.fields || {} : {};

  var isActive = djData.active && djData.active.booleanValue === true;
  var djUid = djData.djUid ? djData.djUid.stringValue : '';
  var isNacho = djUid === 'nacho-dj';

  // If a real DJ is active, do nothing
  if (isActive && !isNacho) return { status: 'real_dj_active', dj: djUid };

  // Get all tracks from beats
  var tracks = await queryFirestore(env, 'beats_tracks', 200);
  if (tracks.length === 0) return { status: 'no_tracks' };

  // Filter tracks that have an audioUrl
  tracks = tracks.filter(function(t) { return t.audioUrl; });
  if (tracks.length === 0) return { status: 'no_playable_tracks' };

  // If Nacho is already DJing, check if current track has expired
  if (isNacho && isActive) {
    var startedAt = djData.trackStartedAt ? djData.trackStartedAt.timestampValue : null;
    var duration = djData.trackDuration ? (parseInt(djData.trackDuration.integerValue) || 240) : 240;

    if (startedAt) {
      var elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
      if (elapsed < duration) {
        return { status: 'nacho_playing', elapsed: Math.round(elapsed), duration: duration };
      }
    }
    // Track expired — pick a new one
  }

  // Pick a random track
  var idx = Math.floor(Math.random() * tracks.length);
  var track = tracks[idx];

  // Estimate duration (default 4 min if unknown)
  var dur = track.duration || 240;

  var now = new Date().toISOString();

  await updateFirestoreDoc(env, 'global_chat_meta/live_dj', {
    djUid: { stringValue: 'nacho-dj' },
    djName: { stringValue: '🦌 Nacho' },
    trackTitle: { stringValue: track.title || 'Untitled' },
    trackArtist: { stringValue: track.artist || track.authorName || 'Unknown' },
    trackCoverArt: { stringValue: track.coverArt || '' },
    trackAudioUrl: { stringValue: track.audioUrl || '' },
    trackId: { stringValue: track._id || '' },
    artistUid: { stringValue: track.authorId || '' },
    trackDuration: { integerValue: String(dur) },
    trackStartedAt: { timestampValue: now },
    playbackTime: { doubleValue: 0 },
    songCount: { integerValue: '1' },
    startedAt: { timestampValue: now },
    active: { booleanValue: true },
    isNachoDJ: { booleanValue: true }
  });

  return { status: 'nacho_new_track', track: track.title, artist: track.artist || track.authorName };
}

// ---- Main Router ----
export default {
  async fetch(request, env) {
    var url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      if (url.pathname === '/webhook/telegram' && request.method === 'POST') {
        // Validate Telegram webhook secret token (set via setWebhook secret_token parameter)
        var tgSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
        if (!env.TG_WEBHOOK_SECRET || tgSecret !== env.TG_WEBHOOK_SECRET) {
          return corsResponse({ error: 'unauthorized' }, 401);
        }
        return handleTelegramWebhook(request, env);
      }
      if (url.pathname === '/webhook/firestore' && request.method === 'POST') {
        return handleFirestoreWebhook(request, env);
      }
      if (url.pathname === '/nacho-dj') {
        var result = await nachoDJCheck(env);
        return corsResponse(result);
      }
      if (url.pathname === '/health') {
        return corsResponse({ ok: true, ts: Date.now() });
      }
      return new Response('Not found', { status: 404 });
    } catch (e) {
      console.error('Worker error:', e);
      return corsResponse({ error: e.message }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(nachoDJCheck(env));
  }
};

// ---- Telegram → Firestore ----
async function handleTelegramWebhook(request, env) {
  var update = await request.json();

  // Handle channel posts from broadcast channel (one-way)
  if (update.channel_post) {
    return handleBroadcastPost(update.channel_post, env);
  }

  var msg = update.message;
  if (!msg) return new Response('OK');

  // Skip service messages
  if (msg.new_chat_members || msg.left_chat_member || msg.new_chat_participant || msg.left_chat_participant) {
    return new Response('OK');
  }

  // Skip bot's own messages (prevent loops)
  if (msg.from && msg.from.id === parseInt(env.TG_BOT_TOKEN.split(':')[0])) {
    return new Response('OK');
  }

  // Skip bridged messages from Global Chat (they start with [🌐)
  if (msg.text && msg.text.startsWith('[🌐')) {
    return new Response('OK');
  }

  // Skip auto-forwarded posts from the broadcast channel (handled by channel_post)
  if (msg.is_automatic_forward) {
    return new Response('OK');
  }
  if (msg.forward_origin && msg.forward_origin.type === 'channel') {
    return new Response('OK');
  }
  if (msg.sender_chat && String(msg.sender_chat.id) === '-1003745860336') {
    return new Response('OK');
  }

  // Sender info
  var senderName = 'Telegram User';
  if (msg.from && !msg.from.is_bot) {
    senderName = msg.from.first_name || 'User';
    if (msg.from.last_name) senderName += ' ' + msg.from.last_name;
  } else if (msg.from && msg.from.is_bot && msg.from.username === 'GroupAnonymousBot' && msg.sender_chat) {
    // Anonymous admin posting — use a cleaner name
    senderName = 'Telegram';
  } else if (msg.sender_chat) {
    senderName = msg.sender_chat.title || msg.sender_chat.username || 'Channel';
  }

  var senderUsername = (msg.from && msg.from.username) ? msg.from.username : '';

  // Content
  var text = msg.text || msg.caption || '';
  var imageUrl = null;
  var gifUrl = null;

  if (msg.photo && msg.photo.length > 0) {
    var photo = msg.photo[msg.photo.length - 1];
    var fileInfo = await tgApi(env.TG_BOT_TOKEN, 'getFile', { file_id: photo.file_id });
    if (fileInfo.ok) imageUrl = 'https://api.telegram.org/file/bot' + env.TG_BOT_TOKEN + '/' + fileInfo.result.file_path;
  }

  if (msg.animation) {
    var fileInfo2 = await tgApi(env.TG_BOT_TOKEN, 'getFile', { file_id: msg.animation.file_id });
    if (fileInfo2.ok) gifUrl = 'https://api.telegram.org/file/bot' + env.TG_BOT_TOKEN + '/' + fileInfo2.result.file_path;
  }

  if (msg.sticker) {
    if (msg.sticker.is_animated || msg.sticker.is_video) {
      text = '(sticker: ' + (msg.sticker.emoji || '🎭') + ')';
    } else {
      var fi = await tgApi(env.TG_BOT_TOKEN, 'getFile', { file_id: msg.sticker.file_id });
      if (fi.ok) imageUrl = 'https://api.telegram.org/file/bot' + env.TG_BOT_TOKEN + '/' + fi.result.file_path;
      if (!text) text = msg.sticker.emoji || '';
    }
  }

  if (!text && !imageUrl && !gifUrl) return new Response('OK');

  var firestoreDoc = {
    fields: {
      text: { stringValue: text || '' },
      name: { stringValue: senderName },
      userTag: { stringValue: senderUsername ? '@' + senderUsername : '' },
      uid: { stringValue: 'tg_' + (msg.from ? msg.from.id : 'anon') },
      ts: { timestampValue: new Date(msg.date * 1000).toISOString() },
      source: { stringValue: 'telegram' },
      tgMsgId: { integerValue: String(msg.message_id) }
    }
  };

  if (imageUrl) firestoreDoc.fields.imageUrl = { stringValue: imageUrl };
  if (gifUrl) firestoreDoc.fields.gifUrl = { stringValue: gifUrl };

  if (msg.reply_to_message) {
    var replyName = msg.reply_to_message.from ? (msg.reply_to_message.from.first_name || 'User') : 'User';
    var replyText = msg.reply_to_message.text || msg.reply_to_message.caption || '';

    // If replying to a bridged message from the web app, extract the real username
    // Bridged messages look like: "[🌐 Username]\nActual message text"
    // or with reply context: "[🌐 Username]\n↩️ ReplyTo: preview\n\nActual text"
    var bridgeMatch = replyText.match(/^\[🌐\s+([^\]]+)\]\n([\s\S]*)/);
    if (bridgeMatch) {
      replyName = bridgeMatch[1].trim();
      var bodyText = bridgeMatch[2].trim();
      // Strip reply context prefix if present
      var replyCtxMatch = bodyText.match(/^↩️\s+[^\n]+\n\n([\s\S]*)/);
      if (replyCtxMatch) {
        replyText = replyCtxMatch[1].trim();
      } else {
        replyText = bodyText;
      }
    }
    // If replying to another Telegram user's message (not bridged), use as-is

    firestoreDoc.fields.replyToName = { stringValue: replyName };
    firestoreDoc.fields.replyToText = { stringValue: replyText.substring(0, 100) };
  }

  await writeToFirestore(env, firestoreDoc);
  return new Response('OK');
}

// ---- Broadcast Channel → Firestore (one-way) ----
async function handleBroadcastPost(post, env) {
  var BROADCAST_ID = '-1003745860336';
  if (String(post.chat.id) !== BROADCAST_ID) return new Response('OK');

  if (!post.text && !post.caption && !post.photo && !post.animation) return new Response('OK');

  var text = post.text || post.caption || '';
  var imageUrl = null;

  if (post.photo && post.photo.length > 0) {
    var photo = post.photo[post.photo.length - 1];
    var fileInfo = await tgApi(env.TG_BOT_TOKEN, 'getFile', { file_id: photo.file_id });
    if (fileInfo.ok) imageUrl = 'https://api.telegram.org/file/bot' + env.TG_BOT_TOKEN + '/' + fileInfo.result.file_path;
  }

  if (!text && !imageUrl) return new Response('OK');

  var firestoreDoc = {
    fields: {
      text: { stringValue: (imageUrl && !text) ? '📢 [Image]' : text },
      name: { stringValue: '📢 603BTC Updates' },
      uid: { stringValue: 'tg_broadcast' },
      ts: { timestampValue: new Date(post.date * 1000).toISOString() },
      source: { stringValue: 'telegram' },
      tgMsgId: { integerValue: String(post.message_id) }
    }
  };

  if (imageUrl) firestoreDoc.fields.imageUrl = { stringValue: imageUrl };

  await writeToFirestore(env, firestoreDoc);
  return new Response('OK');
}

// ---- Firestore → Telegram (called from app) ----
async function handleFirestoreWebhook(request, env) {
  var authHeader = request.headers.get('Authorization') || '';
  if (authHeader !== 'Bearer ' + env.BRIDGE_SECRET) {
    return corsResponse({ error: 'unauthorized' }, 401);
  }

  var data = await request.json();

  if (data.source === 'telegram') {
    return corsResponse({ ok: true, skipped: 'from_telegram' });
  }

  var username = data.user || 'Anonymous';
  var text = data.text || '';
  var imageUrl = data.imageUrl || null;
  var imageBase64 = data.imageBase64 || null;
  var gifUrl = data.gifUrl || null;

  var tgText = '[🌐 ' + username + ']\n' + text;
  var caption = '[🌐 ' + username + ']' + (text ? '\n' + text : '');

  if (data.replyToName) {
    tgText = '[🌐 ' + username + ']\n↩️ ' + data.replyToName + ': ' + (data.replyToText || '').substring(0, 60) + '\n\n' + text;
  }

  var result;

  if (gifUrl) {
    result = await tgApi(env.TG_BOT_TOKEN, 'sendAnimation', {
      chat_id: env.TG_CHAT_ID,
      animation: gifUrl,
      caption: caption
    });
  } else if (imageBase64) {
    // Upload base64 image via multipart form
    result = await tgSendPhotoBase64(env.TG_BOT_TOKEN, env.TG_CHAT_ID, imageBase64, caption);
  } else if (imageUrl) {
    result = await tgApi(env.TG_BOT_TOKEN, 'sendPhoto', {
      chat_id: env.TG_CHAT_ID,
      photo: imageUrl,
      caption: caption
    });
  } else if (text) {
    result = await tgApi(env.TG_BOT_TOKEN, 'sendMessage', {
      chat_id: env.TG_CHAT_ID,
      text: tgText,
      disable_web_page_preview: true
    });
  }

  return corsResponse({ ok: true, result: result });
}

// ---- Helpers ----
async function tgSendPhotoBase64(token, chatId, dataUrl, caption) {
  // Convert data URL to binary
  var base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
  var binary = Uint8Array.from(atob(base64), function(c) { return c.charCodeAt(0); });
  var mime = (dataUrl.match(/^data:([^;]+)/) || [])[1] || 'image/jpeg';
  var ext = mime === 'image/png' ? 'png' : 'jpg';

  // Build multipart form
  var boundary = '----ChatBridge' + Date.now();
  var body = '';
  body += '--' + boundary + '\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n' + chatId + '\r\n';
  body += '--' + boundary + '\r\nContent-Disposition: form-data; name="caption"\r\n\r\n' + caption + '\r\n';
  body += '--' + boundary + '\r\nContent-Disposition: form-data; name="photo"; filename="image.' + ext + '"\r\nContent-Type: ' + mime + '\r\n\r\n';
  var footer = '\r\n--' + boundary + '--\r\n';

  var enc = new TextEncoder();
  var headerBytes = enc.encode(body);
  var footerBytes = enc.encode(footer);
  var combined = new Uint8Array(headerBytes.length + binary.length + footerBytes.length);
  combined.set(headerBytes, 0);
  combined.set(binary, headerBytes.length);
  combined.set(footerBytes, headerBytes.length + binary.length);

  var resp = await fetch(TG_API + token + '/sendPhoto', {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary },
    body: combined
  });
  return resp.json();
}

async function tgApi(token, method, params) {
  var resp = await fetch(TG_API + token + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return resp.json();
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function corsResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}
