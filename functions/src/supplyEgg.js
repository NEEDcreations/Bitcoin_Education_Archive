'use strict';
// Global chat easter eggs. A message of the form `[satoshimon-cli ]<command> [arg]`
// (case-insensitive, trimmed) is looked up in COMMANDS; Nacho replies with the
// handler's terminal-style output and no explanation. Add commands to COMMANDS.

const PARSE = /^(?:satoshimon-cli\s+)?([a-z0-9_-]{1,32})(?:\s+([a-z0-9_-]{1,32}))?$/i;
// Sets not listed here are unreleased: shown as [REDACTED] and never matched by id.
const RELEASED_SETS = ['genesis'];
const SERIALS_PER_CARD = 21;
const USER_COOLDOWN_MS = 60 * 1000;
const GLOBAL_COOLDOWN_MS = 15 * 1000;
const REDACTED = '[REDACTED]';

function parseCommand(text) {
    if (typeof text !== 'string' || text.length > 80) return null;
    const m = PARSE.exec(text.trim());
    if (!m) return null;
    const name = m[1].toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(COMMANDS, name)) return null;
    return { name: name, arg: m[2] ? m[2].toLowerCase() : null };
}
function isTrigger(text) { return parseCommand(text) !== null; }

function countBySet(items) {
    const counts = {};
    for (const c of items || []) {
        const s = c && typeof c.set === 'string' ? c.set : '';
        if (s) counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
}

function setStats(cardCounts, serialCounts, id) {
    const max = (cardCounts[id] || 0) * SERIALS_PER_CARD;
    return { max_supply: max, circulating: Math.min((serialCounts || {})[id] || 0, max) };
}

// All sets; unreleased ones merge into one [REDACTED] entry.
function formatAllSets(cardCounts, serialCounts) {
    const out = {};
    const red = { max_supply: 0, circulating: 0 };
    for (const id of Object.keys(cardCounts).sort()) {
        const st = setStats(cardCounts, serialCounts, id);
        if (RELEASED_SETS.includes(id)) out[id] = st;
        else { red.max_supply += st.max_supply; red.circulating += st.circulating; }
    }
    if (red.max_supply) out[REDACTED] = red;
    return JSON.stringify(out, null, 2);
}

// One set. Released sets match by id; unreleased only via a server-side secret
// alias map { alias: internalSetId } (never in the repo).
function formatOneSet(cardCounts, serialCounts, arg, aliases) {
    let id = null, label = null;
    if (RELEASED_SETS.includes(arg) && cardCounts[arg]) { id = arg; label = arg; }
    else if (aliases && Object.prototype.hasOwnProperty.call(aliases, arg)) {
        const target = aliases[arg];
        if (typeof target === 'string' && cardCounts[target] && !RELEASED_SETS.includes(target)) { id = target; label = REDACTED; }
    }
    if (!id) return JSON.stringify({ error: 'set not found' });
    return JSON.stringify({ [label]: setStats(cardCounts, serialCounts, id) }, null, 2);
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
// Secret aliases: env SATOSHIMON_SET_ALIASES (JSON) or Firestore
// easter_egg_config/supply.setAliases. Empty by default.
async function loadAliases(db) {
    const out = {};
    try { Object.assign(out, JSON.parse(process.env.SATOSHIMON_SET_ALIASES || '{}')); } catch (e) { /* ignore */ }
    try {
        const doc = await db.collection('easter_egg_config').doc('supply').get();
        const m = doc.exists ? doc.data().setAliases : null;
        if (m && typeof m === 'object') Object.assign(out, m);
    } catch (e) { console.warn('[supplyEgg] alias read failed'); }
    const clean = {};
    for (const k of Object.keys(out)) if (typeof out[k] === 'string') clean[k.toLowerCase()] = out[k];
    return clean;
}

async function gettxoutsetinfo(db, arg) {
    const [cards, serials] = await Promise.all([loadCounts(db), loadSerialCounts(db)]);
    if (!arg) return formatAllSets(cards, serials);
    return formatOneSet(cards, serials, arg, await loadAliases(db));
}

// command name -> async (db, arg) => reply text
const COMMANDS = {
    gettxoutsetinfo: gettxoutsetinfo,
};

async function handle(db, admin, msgId, data) {
    const cmd = data ? parseCommand(data.text) : null;
    if (!cmd) return null;
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
    const text = await COMMANDS[cmd.name](db, cmd.arg);
    if (!text) return null;
    await replyRef.set({
        uid: 'nacho-bot',
        name: '🦌 Nacho',
        text: String(text).slice(0, 500),
        isNachoAuto: false,
        replyTo: msgId,
        ts: admin.firestore.FieldValue.serverTimestamp(),
    });
    return null;
}

module.exports = { parseCommand, isTrigger, countBySet, formatAllSets, formatOneSet, handle, COMMANDS, RELEASED_SETS };
