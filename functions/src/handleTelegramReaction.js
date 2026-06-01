/**
 * handleTelegramReaction - Cloud Function for Telegram reaction webhook
 * Bridges Telegram message reactions to Global Chat
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

const db = admin.firestore();
const CHAT_COLLECTION = 'global_chat';

// Telegram bot token from env
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || '';

/**
 * Verify Telegram webhook signature (if using secret)
 */
function verifyTelegramSignature(body, signature, secret) {
    if (!signature || !secret) return true; // Skip if not configured
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Main webhook handler (HTTP)
 */
exports.handleTelegramReaction = functions.https.onRequest(async (req, res) => {
    // Only accept POST
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }

    try {
        const update = req.body;
        
        // Log for debugging
        console.log('[TG_WEBHOOK] Received:', JSON.stringify(update));

        // Handle message_reaction updates
        if (update.message_reaction) {
            await handleMessageReaction(update.message_reaction);
        }
        
        // Handle message_reaction_count updates (anonymous counts)
        if (update.message_reaction_count) {
            await handleReactionCount(update.message_reaction_count);
        }

        // Always return 200 to Telegram to prevent retries
        res.status(200).send('OK');
    } catch (err) {
        console.error('[TG_WEBHOOK] Error:', err);
        // Still return 200 to prevent Telegram retries
        res.status(200).send('OK');
    }
});

/**
 * Handle message_reaction update from Telegram
 */
async function handleMessageReaction(reactionUpdate) {
    const { message_id, chat, user, actor_chat, date, old_reaction, new_reaction } = reactionUpdate;
    
    // Find the corresponding Global Chat message by telegramMsgId
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
                if (reactions[emoji].length === 0) {
                    delete reactions[emoji];
                }
            }
        }
    }
    
    // Process added reactions (new_reaction)
    if (new_reaction && Array.isArray(new_reaction)) {
        for (const react of new_reaction) {
            const emoji = reactionToEmoji(react);
            if (emoji) {
                if (!reactions[emoji]) reactions[emoji] = [];
                if (!reactions[emoji].includes(tgUserId)) {
                    reactions[emoji].push(tgUserId);
                }
            }
        }
    }
    
    // Update the message
    await msgDoc.ref.update({ reactions });
    console.log('[TG_WEBHOOK] Updated reactions for message:', msgDoc.id, 'reactions:', Object.keys(reactions));
}

/**
 * Handle message_reaction_count (anonymous reactions, just counts)
 * This is less precise but updates reaction counts
 */
async function handleReactionCount(countUpdate) {
    const { message_id, chat, date, reactions: tgReactions } = countUpdate;
    
    // Find the Global Chat message
    const msgsQuery = await db.collection(CHAT_COLLECTION)
        .where('telegramMsgId', '==', message_id.toString())
        .limit(1)
        .get();
    
    if (msgsQuery.empty) return;
    
    const msgDoc = msgsQuery.docs[0];
    const msgData = msgDoc.data();
    const currentReactions = msgData.reactions || {};
    
    // Update counts for each reaction type
    // Note: We use a special prefix for anonymous counts
    for (const react of (tgReactions || [])) {
        const emoji = reactionToEmoji(react.type);
        if (emoji && react.total_count > 0) {
            // For anonymous counts, we store as 'tg:count' placeholder
            const countUsers = currentReactions[emoji] || [];
            const anonCount = react.total_count;
            
            // If we have anonymous users for this reaction, update the count
            const hasAnon = countUsers.some(u => u.startsWith('tg:anon:'));
            if (hasAnon) {
                // Replace existing anon entries with new count
                const realUsers = countUsers.filter(u => !u.startsWith('tg:'));
                for (let i = 0; i < anonCount; i++) {
                    realUsers.push(`tg:anon:${i}`);
                }
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
    
    // Emoji reaction
    if (reaction.emoji) {
        return reaction.emoji;
    }
    
    // Custom emoji reaction
    if (reaction.custom_emoji_id) {
        // For custom emojis, return a placeholder or map common ones
        return '🎨'; // Generic art/custom emoji
    }
    
    // Paid reaction
    if (reaction.type === 'paid') {
        return '⭐';
    }
    
    return '👍'; // Default
}

/**
 * setTelegramWebhook - HTTP endpoint to set the webhook URL
 * Call this once after deploying to register the webhook with Telegram
 */
exports.setTelegramWebhook = functions.https.onRequest(async (req, res) => {
    if (!TG_BOT_TOKEN) {
        res.status(500).send('TG_BOT_TOKEN not configured');
        return;
    }
    
    // Get the function URL
    const projectId = process.env.GCLOUD_PROJECT || 'bitcoin-education-archive';
    const region = 'us-central1';
    const functionUrl = `https://${region}-${projectId}.cloudfunctions.net/handleTelegramReaction`;
    
    try {
        const fetch = require('node-fetch');
        
        // Set the webhook
        const tgRes = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: functionUrl,
                allowed_updates: ['message_reaction', 'message_reaction_count']
            })
        });
        
        const result = await tgRes.json();
        res.json({ success: result.ok, result, webhookUrl: functionUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
