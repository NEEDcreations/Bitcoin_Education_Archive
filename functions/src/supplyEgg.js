'use strict';
// Easter egg: `gettxoutsetinfo` / `bitcoin-cli gettxoutsetinfo` in global chat
// makes Nacho reply with the live Satoshimon card supply by set. No explanation.
// Counts come from Firestore satoshimon_cards (field `set`) when present, else
// the bundled server-only snapshot. Only release state is mapped here.

const TRIGGER = /^(bitcoin-cli\s+)?gettxoutsetinfo$/i;
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

function formatSupply(counts) {
    const sets = {};
    let total = 0;
    let redacted = 0;
    for (const id of Object.keys(counts).sort()) {
        const n = counts[id];
        total += n;
        if (RELEASED_SETS.includes(id)) sets[id] = n;
        else redacted += n;
    }
    if (redacted) sets['[REDACTED]'] = redacted;
    return JSON.stringify({ total_supply: total, sets: sets }, null, 2);
}

async function loadCounts(db) {
    try {
        const snap = await db.collection('satoshimon_cards').select('set').get();
        if (!snap.empty) return countBySet(snap.docs.map((d) => d.data()));
    } catch (e) { console.warn('[supplyEgg] firestore read failed'); }
    return countBySet(require('../data/satoshimon-supply.json').cards);
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
    const text = formatSupply(await loadCounts(db));
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
