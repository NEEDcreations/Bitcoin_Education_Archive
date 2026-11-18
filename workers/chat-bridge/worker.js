/**
 * Cloudflare Worker: Global Chat ↔ Telegram Bridge
 * Uses Firebase Admin (service account) for Firestore writes.
 *
 * Secrets (via wrangler secret put):
 *   TG_BOT_TOKEN         — Telegram bot token
 *   TG_WEBHOOK_SECRET     — Telegram webhook secret_token
 *   FIREBASE_SA_EMAIL     — service account email
 *   FIREBASE_SA_KEY       — PEM private key (with \n literals)
 *   BRIDGE_SECRET         — shared secret for app→telegram calls
 *
 * Vars:
 *   TG_CHAT_ID            — Telegram group chat ID
 *   FIREBASE_PROJECT_ID   — Firebase project ID
 */

import beatsCensorMod from '../../beats-censor.js';
import telegramFileGuardMod from '../../functions/src/telegramFileGuard.js';
var beatsCensor = (beatsCensorMod && beatsCensorMod.beatsCensor) || beatsCensorMod;
var telegramFileGuard = (telegramFileGuardMod && telegramFileGuardMod.assertFirestoreSafe)
  ? telegramFileGuardMod
  : ((telegramFileGuardMod && telegramFileGuardMod.default) || telegramFileGuardMod);

const TG_API = 'https://api.telegram.org/bot';
const SCOPES = 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/devstorage.read_write';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const STORAGE_BUCKET = 'bitcoin-education-archive.firebasestorage.app';

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
  console.error('OAuth failed');
  return null;
}

// Upload bytes to Firebase Storage and return a download URL.
// objectPath is chat-images/tg/<random>. The download token is a Storage
// token, never a Telegram bot token.
async function uploadImageToStorage(env, imgBuf, mimeType, objectPath, downloadToken) {
  var token = await getAccessToken(env);
  if (!token) return null;
  if (!objectPath || telegramFileGuard.containsTelegramBotMaterial(objectPath)) return null;
  var uploadUrl = 'https://storage.googleapis.com/upload/storage/v1/b/' + STORAGE_BUCKET + '/o?uploadType=media&name=' + encodeURIComponent(objectPath);
  var resp;
  try {
    resp = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': mimeType
      },
      body: imgBuf
    });
  } catch (e) {
    console.error('[Storage] Upload failed');
    return null;
  }
  if (!resp.ok) {
    console.error('[Storage] Upload failed', resp.status);
    return null;
  }
  var tokenToUse = downloadToken || '';
  if (tokenToUse) {
    var metaUrl = 'https://storage.googleapis.com/storage/v1/b/' + STORAGE_BUCKET + '/o/' + encodeURIComponent(objectPath);
    var metaResp;
    try {
      metaResp = await fetch(metaUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ metadata: { firebaseStorageDownloadTokens: tokenToUse } })
      });
    } catch (e) {
      metaResp = null;
    }
    if (!metaResp || !metaResp.ok) {
      console.error('[Storage] download token metadata failed');
      tokenToUse = '';
    }
  }
  try {
    return telegramFileGuard.storageDownloadUrl(STORAGE_BUCKET, objectPath, tokenToUse);
  } catch (e) {
    console.error('[Storage] refused download URL');
    return null;
  }
}

// Download a Telegram file with the bot token and store it in Firebase Storage.
// The file URL exists only in this function. It is never logged or written.
async function rehostTelegramPath(env, filePath) {
  var botToken = env && env.TG_BOT_TOKEN ? String(env.TG_BOT_TOKEN) : '';
  var rel = String(filePath || '').replace(/^\/+/, '');
  if (!botToken || !rel || rel.indexOf('..') !== -1) return null;
  var fileUrl = 'https://api.telegram.org/file/bot' + botToken + '/' + rel;
  var resp;
  try {
    resp = await fetch(fileUrl);
  } catch (e) {
    console.warn('[Bridge] telegram file download failed');
    return null;
  }
  if (!resp || !resp.ok) {
    console.warn('[Bridge] telegram file download status', resp && resp.status);
    return null;
  }
  var buf;
  try { buf = await resp.arrayBuffer(); }
  catch (e) {
    console.warn('[Bridge] telegram file body failed');
    return null;
  }
  if (!buf || !buf.byteLength || buf.byteLength > 20 * 1024 * 1024) {
    console.warn('[Bridge] telegram file rejected');
    return null;
  }
  var ext = telegramFileGuard.extensionOf(rel);
  var mime = telegramFileGuard.mimeForExtension(ext);
  var bytes = new Uint8Array(16);
  var tokenBytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  crypto.getRandomValues(tokenBytes);
  var objectPath;
  try { objectPath = telegramFileGuard.objectPathFromBytes(bytes, ext); }
  catch (e) { return null; }
  var downloadToken = telegramFileGuard.hexOf(tokenBytes);
  return uploadImageToStorage(env, buf, mime, objectPath, downloadToken);
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
  try {
    telegramFileGuard.assertFirestoreSafe(doc);
  } catch (e) {
    console.error('[Bridge] refused Firestore write');
    return false;
  }
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
    console.error('Firestore write failed', resp.status);
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
  try {
    telegramFileGuard.assertFirestoreSafe(fields);
  } catch (e) {
    console.error('[Bridge] refused Firestore update');
    return false;
  }
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

  // Skip moderated tracks. Shared DJ text is always censored.
  tracks = tracks.filter(function(t) { return t.audioUrl && t.hidden !== true; });
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
    trackTitle: { stringValue: beatsCensor(track.title || 'Untitled') },
    trackArtist: { stringValue: beatsCensor(track.artist || track.authorName || 'Unknown') },
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

  return { status: 'nacho_new_track', track: beatsCensor(track.title || ''), artist: beatsCensor(track.artist || track.authorName || '') };
}

// [SECURITY FIX] Constant-time string comparison — prevents timing oracle attacks on secrets.
function timingSafeEqual(a, b) {
    const ea = new TextEncoder().encode(a);
    const eb = new TextEncoder().encode(b);
    if (ea.length !== eb.length) return false;
    let diff = 0;
    for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
    return diff === 0;
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
        // Fail CLOSED — secret must be configured and must match; no secret = reject everything.
        var tgSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
        if (!env.TG_WEBHOOK_SECRET || !timingSafeEqual(tgSecret, env.TG_WEBHOOK_SECRET)) {
          return corsResponse({ error: 'unauthorized' }, 401);
        }
        return handleTelegramWebhook(request, env);
      }
      if (url.pathname === '/webhook/firestore' && request.method === 'POST') {
        return handleFirestoreWebhook(request, env);
      }
      if (url.pathname === '/nacho-dj') {
        // Admin endpoint — reuse existing BRIDGE_SECRET; fail closed if unset
        var djAuth = request.headers.get('Authorization') || '';
        if (!env.BRIDGE_SECRET || !timingSafeEqual(djAuth, 'Bearer ' + env.BRIDGE_SECRET)) {
          return corsResponse({ error: 'unauthorized' }, 401);
        }
        var result = await nachoDJCheck(env);
        return corsResponse(result);
      }
      if (url.pathname === '/health') {
        return corsResponse({ ok: true, ts: Date.now() });
      }
      return new Response('Not found', { status: 404 });
    } catch (e) {
      console.error('Worker error');
      return corsResponse({ error: 'internal' }, 500);
    }
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

  // Content. Telegram file URLs are downloaded here and rehosted. The bot
  // token never lands in the Firestore document.
  var text = telegramFileGuard.redactSecrets(msg.text || msg.caption || '');
  var imageUrl = null;
  var gifUrl = null;
  var mediaDropped = false;

  if (msg.photo && msg.photo.length > 0) {
    var photo = msg.photo[msg.photo.length - 1];
    var fileInfo = await tgApi(env.TG_BOT_TOKEN, 'getFile', { file_id: photo.file_id });
    if (fileInfo && fileInfo.ok && fileInfo.result && fileInfo.result.file_path) {
      imageUrl = await rehostTelegramPath(env, fileInfo.result.file_path);
      if (!imageUrl) {
        mediaDropped = true;
        console.warn('[Bridge] photo not rehosted');
      }
    } else if (fileInfo && fileInfo.ok) {
      mediaDropped = true;
    }
  }

  if (msg.animation) {
    var fileInfo2 = await tgApi(env.TG_BOT_TOKEN, 'getFile', { file_id: msg.animation.file_id });
    if (fileInfo2 && fileInfo2.ok && fileInfo2.result && fileInfo2.result.file_path) {
      gifUrl = await rehostTelegramPath(env, fileInfo2.result.file_path);
      if (!gifUrl) {
        mediaDropped = true;
        console.warn('[Bridge] animation not rehosted');
      }
    } else if (fileInfo2 && fileInfo2.ok) {
      mediaDropped = true;
    }
  }

  if (msg.sticker) {
    if (msg.sticker.is_animated || msg.sticker.is_video) {
      text = '(sticker: ' + (msg.sticker.emoji || '🎭') + ')';
    } else {
      var fi = await tgApi(env.TG_BOT_TOKEN, 'getFile', { file_id: msg.sticker.file_id });
      if (fi && fi.ok && fi.result && fi.result.file_path) {
        imageUrl = await rehostTelegramPath(env, fi.result.file_path);
        if (!imageUrl) {
          mediaDropped = true;
          console.warn('[Bridge] sticker not rehosted');
        }
      } else if (fi && fi.ok) {
        mediaDropped = true;
      }
      if (!text) text = msg.sticker.emoji || '';
    }
  }

  if (!text && !imageUrl && !gifUrl) return new Response('OK');

  // Filter out Telegram bot commands — don't bridge to Global Chat
  if (text && /^\/[a-zA-Z]/.test(text.trim())) return new Response('OK');

  var firestoreDoc = {
    fields: {
      text: { stringValue: text || '' },
      name: { stringValue: telegramFileGuard.redactSecrets(senderName) },
      userTag: { stringValue: telegramFileGuard.redactSecrets(senderUsername ? '@' + senderUsername : '') },
      uid: { stringValue: 'tg_' + (msg.from ? msg.from.id : 'anon') },
      ts: { timestampValue: new Date(msg.date * 1000).toISOString() },
      source: { stringValue: 'telegram' },
      tgMsgId: { integerValue: String(msg.message_id) },
      isNachoAuto: { booleanValue: false }
    }
  };

  if (imageUrl) firestoreDoc.fields.imageUrl = { stringValue: imageUrl };
  if (gifUrl) firestoreDoc.fields.gifUrl = { stringValue: gifUrl };
  if (mediaDropped) firestoreDoc.fields.mediaRemoved = { booleanValue: true };

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

    firestoreDoc.fields.replyToName = { stringValue: telegramFileGuard.redactSecrets(replyName) };
    firestoreDoc.fields.replyToText = { stringValue: telegramFileGuard.redactSecrets(replyText.substring(0, 100)) };
  }

  await writeToFirestore(env, firestoreDoc);
  return new Response('OK');
}

// ---- Broadcast Channel → Firestore (one-way) ----
async function handleBroadcastPost(post, env) {
  var BROADCAST_ID = '-1003745860336';
  if (String(post.chat.id) !== BROADCAST_ID) return new Response('OK');

  if (!post.text && !post.caption && !post.photo && !post.animation) return new Response('OK');

  var text = telegramFileGuard.redactSecrets(post.text || post.caption || '');
  var imageUrl = null;
  var mediaDropped = false;

  if (post.photo && post.photo.length > 0) {
    var photo = post.photo[post.photo.length - 1];
    var fileInfo = await tgApi(env.TG_BOT_TOKEN, 'getFile', { file_id: photo.file_id });
    if (fileInfo && fileInfo.ok && fileInfo.result && fileInfo.result.file_path) {
      imageUrl = await rehostTelegramPath(env, fileInfo.result.file_path);
      if (!imageUrl) {
        mediaDropped = true;
        console.warn('[Bridge] broadcast photo not rehosted');
      }
    } else if (fileInfo && fileInfo.ok) {
      mediaDropped = true;
    }
  }

  if (!text && !imageUrl) return new Response('OK');

  var firestoreDoc = {
    fields: {
      text: { stringValue: (imageUrl && !text) ? '📢 [Image]' : text },
      name: { stringValue: '📢 603BTC Updates' },
      uid: { stringValue: 'tg_broadcast' },
      ts: { timestampValue: new Date(post.date * 1000).toISOString() },
      source: { stringValue: 'telegram' },
      tgMsgId: { integerValue: String(post.message_id) },
      isNachoAuto: { booleanValue: false }
    }
  };

  if (imageUrl) firestoreDoc.fields.imageUrl = { stringValue: imageUrl };
  if (mediaDropped) firestoreDoc.fields.mediaRemoved = { booleanValue: true };

  await writeToFirestore(env, firestoreDoc);
  return new Response('OK');
}

// ---- Firestore → Telegram (called from app) ----
async function handleFirestoreWebhook(request, env) {
  var authHeader = request.headers.get('Authorization') || '';
  if (!env.BRIDGE_SECRET || !timingSafeEqual(authHeader, 'Bearer ' + env.BRIDGE_SECRET)) {
    return corsResponse({ error: 'unauthorized' }, 401);
  }

  var data = await request.json();

  if (data.source === 'telegram') {
    return corsResponse({ ok: true, skipped: 'from_telegram' });
  }

  var username = data.user || 'Anonymous';
  var text = telegramFileGuard.redactSecrets(data.text || '');
  var imageUrl = data.imageUrl || null;
  var imageBase64 = data.imageBase64 || null;
  var gifUrl = data.gifUrl || null;
  if (telegramFileGuard.containsTelegramBotMaterial(imageUrl)) imageUrl = null;
  if (telegramFileGuard.containsTelegramBotMaterial(gifUrl)) gifUrl = null;
  if (telegramFileGuard.containsTelegramBotMaterial(imageBase64)) imageBase64 = null;

  var tgText = '[🌐 ' + username + ']\n' + text;
  var caption = '[🌐 ' + username + ']' + (text ? '\n' + text : '');

  if (data.replyToName) {
    var replyName = telegramFileGuard.redactSecrets(data.replyToName);
    var replyText = telegramFileGuard.redactSecrets((data.replyToText || '').substring(0, 60));
    tgText = '[🌐 ' + username + ']\n↩️ ' + replyName + ': ' + replyText + '\n\n' + text;
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

  return corsResponse(redactClientBody({ ok: true, result: result }));
}

function redactClientBody(body) {
  try {
    return JSON.parse(telegramFileGuard.redactSecrets(JSON.stringify(body)));
  } catch (e) {
    return { ok: false, error: 'internal' };
  }
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

  try {
    var resp = await fetch(TG_API + token + '/sendPhoto', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary },
      body: combined
    });
    return await resp.json();
  } catch (e) {
    console.warn('[Bridge] sendPhoto failed');
    return { ok: false };
  }
}

async function tgApi(token, method, params) {
  try {
    var resp = await fetch(TG_API + token + '/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {})
    });
    return await resp.json();
  } catch (e) {
    console.warn('[Bridge] telegram api failed', method);
    return { ok: false };
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://bitcoineducation.quest',
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
