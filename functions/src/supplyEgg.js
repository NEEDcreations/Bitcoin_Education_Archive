'use strict';
// Easter egg: `gettxoutsetinfo` / `satoshimon-cli gettxoutsetinfo` in global chat
// makes Nacho reply with the serial-numbered Satoshimon supply by set. No explanation.
// Counts come from Firestore satoshimon_cards (field `set`) when present, else
// the bundled server-only snapshot. Only release state is mapped here.

const TRIGGER = /^(satoshimon-cli\s+)?gettxoutsetinfo$/i;
// Sets not in this list are shown as [REDACTED]. Add a set id here on release.
const RELEASED_SETS = ['genesis'];
const USER_COOLDOWN_MS = 60 * 1000;
const GLOBAL_COOLDOWN_MS = 15 * 1000;

function isTrigger(text) {
    if (typeof text !== 'string' || text.length > 64) return false;
    return TRIGGER.test(text.trim());
}

function countBySet(cards) {
    const counts = {};
    for (const c of cards || []) {
        const s = c && typeof c.set === 'string' ? c.set : '';
        if (!s) continue;
        counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
}

const SERIALS_PER_CARD = 21;

// Only serial-numbered cards are capped. max_supply = cards in set x 21.
// circulating = serials issued (satoshimon_serials docs, field `set`), else 0.
function formatSupply(cardCounts, serialCounts) {
    serialCounts = serialCounts || {};
    const sets = {};
    const redacted = { max_supply: 0, circulating: 0 };
    const total = { max_supply: 0, circulating: 0 };
    for (const id of Object.keys(cardCounts).sort()) {
        const max = cardCounts[id] * SERIALS_PER_CARD;
        const circ = Math.min(serialCounts[id] || 0, max);
        total.max_supply += max;
        total.circulating += circ;
        if (RELEASED_SETS.includes(id)) sets[id] = { max_supply: max, circulating: circ };
        else { redacted.max_supply += max; redacted.circulating += circ; }
    }
    if (redacted.max_supply) sets['[REDACTED]'] = redacted;
    return JSON.stringify({ total: total, sets: sets }, null, 2);
}

async function loadCounts(db) {
    try {
        const snap = await db.collection('satoshimon_cards').select('set').get();
        if (!snap.empty) return countBySet(snap.docs.map((d) => d.data()));
    } catch (e) { console.warn('[supplyEgg] cards read failed'); }
    return countBySet(require('../data/satoshimon-supply.json').cards);
}

async function loadSerialCounts(db) {
    try {
        const snap = await db.collection('satoshimon_serials').select('set').get();
        return countBySet(snap.docs.map((d) => d.data()));
    } catch (e) { console.warn('[supplyEgg] serials read failed'); return {}; }
}

async function handle(db, admin, msgId, data) {
    if (!data || !isTrigger(data.text)) return null;
    const uid = typeof data.uid === 'string' ? data.uid : '';
    if (!uid || uid === 'nacho-bot' || uid === 'system' || data.source === 'telegram' || data.isNachoAuto === true) return null;
    const replyRef = db.collection('global_chat').doc('supplyegg_' + msgId);
    const globalRef = db.collection('easter_egg_rate').doc('supply_global');
    const userRef = db.collection('easter_egg_rate').doc('supply_' + uid);
    const ok = await db.runTransaction(async (tx) => {
        const [g, u, r] = await Promise.all([tx.get(globalRef), tx.get(userRef), tx.get(replyRef)]);
        const now = Date.now();
        if (r.exists) return false;
        if (g.exists && now - (g.data().lastMs || 0) < GLOBAL_COOLDOWN_MS) return false;
        if (u.exists && now - (u.data().lastMs || 0) < USER_COOLDOWN_MS) return false;
        tx.set(globalRef, { lastMs: now });
        tx.set(userRef, { lastMs: now });
        return true;
    });
    if (!ok) return null;
    const [cards, serials] = await Promise.all([loadCounts(db), loadSerialCounts(db)]);
    const text = formatSupply(cards, serials);
    await replyRef.set({
        uid: 'nacho-bot',
        name: '🦌 Nacho',
        text: text.slice(0, 500),
        isNachoAuto: false,
        replyTo: msgId,
        ts: admin.firestore.FieldValue.serverTimestamp(),
    });
    return null;
}

module.exports = { isTrigger, countBySet, formatSupply, handle, RELEASED_SETS };
