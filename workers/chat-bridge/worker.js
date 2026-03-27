/**
 * Cloudflare Worker: Global Chat ↔ Telegram Bridge
 * 
 * Two endpoints:
 *   POST /webhook/telegram  — Telegram → Firestore (bot webhook)
 *   POST /webhook/firestore — Firestore → Telegram (called from client)
 * 
 * Environment variables (secrets):
 *   TG_BOT_TOKEN    — Telegram bot token
 *   TG_CHAT_ID      — Telegram group chat ID
 *   FIREBASE_API_KEY — Firebase Web API key
 *   BRIDGE_SECRET    — shared secret for firestore→telegram calls
 */

const TG_API = 'https://api.telegram.org/bot';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders()
      });
    }

    try {
      if (url.pathname === '/webhook/telegram' && request.method === 'POST') {
        return handleTelegramWebhook(request, env);
      }
      if (url.pathname === '/webhook/firestore' && request.method === 'POST') {
        return handleFirestoreWebhook(request, env);
      }
      if (url.pathname === '/health') {
        return corsResponse({ ok: true, ts: Date.now() });
      }
      return new Response('Not found', { status: 404 });
    } catch (e) {
      console.error('Worker error:', e);
      return corsResponse({ error: e.message }, 500);
    }
  }
};

// ---- Telegram → Firestore ----
async function handleTelegramWebhook(request, env) {
  const update = await request.json();

  // Only handle messages (not edits, reactions, etc. for now)
  const msg = update.message;
  if (!msg) return new Response('OK');

  // Skip service messages (join/leave/etc)
  if (msg.new_chat_members || msg.left_chat_member || msg.new_chat_participant || msg.left_chat_participant) {
    return new Response('OK');
  }

  // Skip messages from the bot itself (prevent loops)
  if (msg.from && msg.from.id === parseInt(env.TG_BOT_TOKEN.split(':')[0])) {
    return new Response('OK');
  }

  // Also skip if sender_chat is the group itself (anonymous admin = could be bot posting)
  // We mark bridged messages with a tag to detect loops
  if (msg.text && msg.text.startsWith('[🌐')) {
    return new Response('OK'); // This is a bridged message from Global Chat, ignore
  }

  // Extract sender info
  var senderName = 'Telegram User';
  if (msg.from && !msg.from.is_bot) {
    senderName = msg.from.first_name || 'User';
    if (msg.from.last_name) senderName += ' ' + msg.from.last_name;
  } else if (msg.sender_chat) {
    senderName = msg.sender_chat.title || msg.sender_chat.username || 'Channel';
  }
  
  var senderUsername = '';
  if (msg.from && msg.from.username) {
    senderUsername = msg.from.username;
  }

  // Build message content
  var text = msg.text || msg.caption || '';
  var imageUrl = null;
  var gifUrl = null;

  // Handle photos
  if (msg.photo && msg.photo.length > 0) {
    var photo = msg.photo[msg.photo.length - 1]; // largest size
    var fileInfo = await tgApi(env.TG_BOT_TOKEN, 'getFile', { file_id: photo.file_id });
    if (fileInfo.ok) {
      imageUrl = 'https://api.telegram.org/file/bot' + env.TG_BOT_TOKEN + '/' + fileInfo.result.file_path;
    }
  }

  // Handle GIFs/animations
  if (msg.animation) {
    var fileInfo = await tgApi(env.TG_BOT_TOKEN, 'getFile', { file_id: msg.animation.file_id });
    if (fileInfo.ok) {
      gifUrl = 'https://api.telegram.org/file/bot' + env.TG_BOT_TOKEN + '/' + fileInfo.result.file_path;
    }
  }

  // Handle stickers
  if (msg.sticker) {
    if (msg.sticker.is_animated || msg.sticker.is_video) {
      text = '(sticker: ' + (msg.sticker.emoji || '🎭') + ')';
    } else {
      var fileInfo = await tgApi(env.TG_BOT_TOKEN, 'getFile', { file_id: msg.sticker.file_id });
      if (fileInfo.ok) {
        imageUrl = 'https://api.telegram.org/file/bot' + env.TG_BOT_TOKEN + '/' + fileInfo.result.file_path;
      }
      if (!text) text = msg.sticker.emoji || '';
    }
  }

  // Skip if no content
  if (!text && !imageUrl && !gifUrl) return new Response('OK');

  // Write to Firestore via REST API
  var firestoreDoc = {
    fields: {
      text: { stringValue: text || '' },
      user: { stringValue: senderName },
      userTag: { stringValue: senderUsername ? '@' + senderUsername : '' },
      uid: { stringValue: 'tg_' + (msg.from ? msg.from.id : 'anon') },
      ts: { timestampValue: new Date(msg.date * 1000).toISOString() },
      source: { stringValue: 'telegram' },
      tgMsgId: { integerValue: String(msg.message_id) },
      avatar: { stringValue: '📱' }
    }
  };

  if (imageUrl) firestoreDoc.fields.imageUrl = { stringValue: imageUrl };
  if (gifUrl) firestoreDoc.fields.gifUrl = { stringValue: gifUrl };

  // Reply context
  if (msg.reply_to_message) {
    var replyName = 'User';
    if (msg.reply_to_message.from) {
      replyName = msg.reply_to_message.from.first_name || 'User';
    }
    var replyText = msg.reply_to_message.text || msg.reply_to_message.caption || '';
    firestoreDoc.fields.replyToName = { stringValue: replyName };
    firestoreDoc.fields.replyToText = { stringValue: replyText.substring(0, 100) };
  }

  var projectId = 'bitcoin-education-archive';
  var fsUrl = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/global_chat?key=' + env.FIREBASE_API_KEY;
  
  var fsResp = await fetch(fsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(firestoreDoc)
  });

  if (!fsResp.ok) {
    console.error('Firestore write failed:', await fsResp.text());
  }

  return new Response('OK');
}

// ---- Firestore → Telegram ----
async function handleFirestoreWebhook(request, env) {
  // Verify shared secret
  var authHeader = request.headers.get('Authorization') || '';
  if (authHeader !== 'Bearer ' + env.BRIDGE_SECRET) {
    return corsResponse({ error: 'unauthorized' }, 401);
  }

  var data = await request.json();
  
  // Skip if this message came FROM telegram (prevent loops)
  if (data.source === 'telegram') {
    return corsResponse({ ok: true, skipped: 'from_telegram' });
  }

  var username = data.user || 'Anonymous';
  var text = data.text || '';
  var imageUrl = data.imageUrl || null;
  var gifUrl = data.gifUrl || null;

  // Format message for Telegram
  var tgText = '[🌐 ' + username + ']\n' + text;
  
  // Handle reply context
  if (data.replyToName) {
    tgText = '[🌐 ' + username + ']\n↩️ ' + data.replyToName + ': ' + (data.replyToText || '').substring(0, 60) + '\n\n' + text;
  }

  var result;
  
  if (gifUrl) {
    result = await tgApi(env.TG_BOT_TOKEN, 'sendAnimation', {
      chat_id: env.TG_CHAT_ID,
      animation: gifUrl,
      caption: '[🌐 ' + username + ']' + (text ? '\n' + text : '')
    });
  } else if (imageUrl) {
    result = await tgApi(env.TG_BOT_TOKEN, 'sendPhoto', {
      chat_id: env.TG_CHAT_ID,
      photo: imageUrl,
      caption: '[🌐 ' + username + ']' + (text ? '\n' + text : '')
    });
  } else if (text) {
    result = await tgApi(env.TG_BOT_TOKEN, 'sendMessage', {
      chat_id: env.TG_CHAT_ID,
      text: tgText,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
  }

  return corsResponse({ ok: true, result: result });
}

// ---- Helpers ----
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
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}
