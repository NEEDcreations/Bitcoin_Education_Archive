/**
 * handleTelegramReaction - Cloud Function for Telegram reaction webhook
 * Bridges Telegram message reactions to Global Chat
 */

const functions = require('firebase-functions');
const functionsV1 = require('firebase-functions/v1');
const admin = require('./firebaseAdmin.js');
const crypto = require('crypto');
const { adminToken, adminTokenSecret, tgBotToken, tgBotTokenSecret } = require('./sensitiveSecrets');

const db = admin.firestore();
const CHAT_COLLECTION = 'global_chat';

// Read at call time. Bound secrets are process.env only on functions that list them.
function webhookSecret() {
    return process.env.TG_WEBHOOK_SECRET || '';
}

/**
 * [VULN-6 FIX] Verify the X-Telegram-Bot-Api-Secret-Token header.
 *
 * Telegram sends the raw secret_token value in this header — it is NOT
 * an HMAC signature. The old verifyTelegramSignature helper was incorrectly
 * doing an HMAC comparison and also short-circuited when secret was falsy
 * (pass-through when unconfigured). Both problems are fixed here:
 *   - Use timing-safe comparison of the raw header value vs the stored secret
 *   - Return false (not true) when the secret is not configured — force-fail
 *     open rather than fail-open
 */
function verifyWebhookSecret(req) {
    const expected = webhookSecret();
    if (!expected) {
        // Secret not configured — reject all requests rather than silently accept
        console.error('[TG_WEBHOOK] TG_WEBHOOK_SECRET not set — rejecting all incoming requests');
        return false;
    }
    const header = req.headers['x-telegram-bot-api-secret-token'] || '';
    if (!header) return false;
    try {
        // timingSafeEqual requires equal-length buffers
        const a = Buffer.from(header);
        const b = Buffer.from(expected);
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch (e) {
        return false;
    }
}

/**
 * Main webhook handler (HTTP)
 */
// TG_WEBHOOK_SECRET is the existing Cloud Secret. This handler does not read the bot token.
exports.handleTelegramReaction = functionsV1.runWith({ secrets: ['TG_WEBHOOK_SECRET'] }).https.onRequest(async (req, res) => {
    // Only accept POST
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }

    // [VULN-6 FIX] Verify Telegram secret token before processing anything
    if (!verifyWebhookSecret(req)) {
        console.warn('[TG_WEBHOOK] Rejected: missing or invalid X-Telegram-Bot-Api-Secret-Token');
        // Return 200 to prevent Telegram from retrying (legit Telegram will always
        // include the token; a 200 for invalid requests avoids leaking info about
        // whether the endpoint exists).
        res.status(200).send('OK');
        return;
    }

    try {
        const update = req.body;

        // Handle message_reaction updates
        if (update.message_reaction) {
            await handleMessageReaction(update.message_reaction);
        }

        // Handle message_reaction_count updates (anonymous counts)
        if (update.message_reaction_count) {
            await handleReactionCount(update.message_reaction_count);
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('[TG_WEBHOOK] Error:', err);
        res.status(200).send('OK');
    }
});

/**
 * Handle message_reaction update from Telegram
 */
async function handleMessageReaction(reactionUpdate) {
    const { message_id, user, actor_chat, old_reaction, new_reaction } = reactionUpdate;

    const msgsQuery = await db.collection(CHAT_COLLECTION)
        .where('telegramMsgId', '==', message_id.toString())
        .limit(1)
        .get();

    if (msgsQuery.empty) {
        console.log('[TG_WEBHOOK] No matching Global Chat message for telegramMsgId:', message_id);
        return;
    }

    const msgDoc = msgsQuery.docs[0];
    const msgData = msgDoc.data();
    const reactions = msgData.reactions || {};

    // Build a unique ID for this Telegram user
    const tgUserId = user ? `tg:${user.id}` : (actor_chat ? `tg_chat:${actor_chat.id}` : 'tg:unknown');

    // Process removed reactions (old_reaction)
    if (old_reaction && Array.isArray(old_reaction)) {
        for (const react of old_reaction) {
            const emoji = reactionToEmoji(react);
            if (emoji && reactions[emoji]) {
                reactions[emoji] = reactions[emoji].filter(uid => uid !== tgUserId);
                if (reactions[emoji].length === 0) delete reactions[emoji];
            }
        }
    }

    // Process added reactions (new_reaction)
    if (new_reaction && Array.isArray(new_reaction)) {
        for (const react of new_reaction) {
            const emoji = reactionToEmoji(react);
            if (emoji) {
                if (!reactions[emoji]) reactions[emoji] = [];
                if (!reactions[emoji].includes(tgUserId)) reactions[emoji].push(tgUserId);
            }
        }
    }

    await msgDoc.ref.update({ reactions });
    console.log('[TG_WEBHOOK] Updated reactions for message:', msgDoc.id, 'reactions:', Object.keys(reactions));
}

/**
 * Handle message_reaction_count (anonymous reactions, just counts)
 */
async function handleReactionCount(countUpdate) {
    const { message_id, reactions: tgReactions } = countUpdate;

    const msgsQuery = await db.collection(CHAT_COLLECTION)
        .where('telegramMsgId', '==', message_id.toString())
        .limit(1)
        .get();

    if (msgsQuery.empty) return;

    const msgDoc = msgsQuery.docs[0];
    const msgData = msgDoc.data();
    const currentReactions = msgData.reactions || {};

    for (const react of (tgReactions || [])) {
        const emoji = reactionToEmoji(react.type);
        if (emoji && react.total_count > 0) {
            const countUsers = currentReactions[emoji] || [];
            const anonCount = react.total_count;
            const hasAnon = countUsers.some(u => u.startsWith('tg:anon:'));
            if (hasAnon) {
                const realUsers = countUsers.filter(u => !u.startsWith('tg:'));
                for (let i = 0; i < anonCount; i++) realUsers.push(`tg:anon:${i}`);
                currentReactions[emoji] = realUsers;
            }
        }
    }

    await msgDoc.ref.update({ reactions: currentReactions });
}

/**
 * Convert Telegram reaction type to emoji string
 */
function reactionToEmoji(reaction) {
    if (!reaction) return null;
    if (reaction.emoji) return reaction.emoji;
    if (reaction.custom_emoji_id) return '🎨';
    if (reaction.type === 'paid') return '⭐';
    return '👍';
}

/**
 * setTelegramWebhook - HTTP endpoint to (re-)register the webhook with Telegram.
 *
 * [VULN-6 FIX] Now:
 *   1. Requires x-admin-token header (same pattern as other admin CFs).
 *      A ?token= query parameter is rejected with 400 and never checked.
 *   2. Passes secret_token in the setWebhook call so Telegram signs all
 *      future updates with X-Telegram-Bot-Api-Secret-Token
 */
exports.setTelegramWebhook = functionsV1.runWith({
    secrets: ['TG_WEBHOOK_SECRET', tgBotTokenSecret, adminTokenSecret],
}).https.onRequest(async (req, res) => {
    // [VULN-6 FIX] Require admin token to prevent anyone from re-pointing the webhook.
    // Header only. A ?token= query string lands in request logs, browser
    // history and proxies, so it is refused outright and never compared.
    if (req.query && Object.prototype.hasOwnProperty.call(req.query, 'token')) {
        res.status(400).json({ error: 'Send the admin token in the x-admin-token header, not the URL' });
        return;
    }
    const provided = req.headers['x-admin-token'] || '';
    const expectedAdmin = adminToken();
    // [SECURITY FIX] Timing-safe comparison — prevents timing oracle on admin token
    const _tse = (a, b) => { const ea = Buffer.from(String(a)); const eb = Buffer.from(String(b)); if (ea.length !== eb.length) return false; return require('crypto').timingSafeEqual(ea, eb); };
    if (!expectedAdmin || !_tse(provided, expectedAdmin)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const botToken = tgBotToken();
    if (!botToken) {
        res.status(500).send('TG_BOT_TOKEN not configured');
        return;
    }
    const hookSecret = webhookSecret();
    if (!hookSecret) {
        res.status(500).send('TG_WEBHOOK_SECRET not configured — run: firebase functions:secrets:set TG_WEBHOOK_SECRET');
        return;
    }

    const projectId = process.env.GCLOUD_PROJECT || 'bitcoin-education-archive';
    const region = 'us-central1';
    const functionUrl = `https://${region}-${projectId}.cloudfunctions.net/handleTelegramWebhook`;

    try {
        const fetch = require('node-fetch');

        // [VULN-6 FIX] Include secret_token so Telegram signs every update
        const tgRes = await fetch('https://api.telegram.org/bot' + botToken + '/setWebhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: functionUrl,
                allowed_updates: ['message_reaction', 'message_reaction_count'],
                secret_token: hookSecret
            })
        });

        const result = await tgRes.json();
        // Omit token from log
        console.log('[setTelegramWebhook] Result:', result.ok, result.description);
        res.json({ success: result.ok, result, webhookUrl: functionUrl });
    } catch (err) {
        console.error('[setTelegramWebhook] request failed');
        res.status(500).json({ error: 'Webhook registration failed' });
    }
});
