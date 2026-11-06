'use strict';
// Global chat easter eggs. A chat message that is exactly one of the codes in
// EGGS (case-insensitive, extra spaces ignored) gets a short reply from Nacho.
// The first time a signed-in player finds each code they get a tiny XP bonus
// (EGG_XP, through the normal daily XP cap). No sats, ever. Claims are stored
// server-side in easter_egg_claims/{uid}_{eggId}, so each code pays once.
// Add a code by adding an entry to EGGS.

const EGG_XP = 21;
const USER_COOLDOWN_MS = 20 * 1000;
const GLOBAL_COOLDOWN_MS = 5 * 1000;
const MAX_TEXT = 60;

const EGGS = [
    { id: 'hodl', codes: ['hodl', 'hold on for dear life'],
      reply: '🦌💎 HODL! These antlers are diamond. Nacho is not selling.' },
    { id: '21m', codes: ['21m', '21 million', '21000000', '21,000,000'],
      reply: '🔒 Hard cap: 21,000,000. Not one more. Not even for Nacho.' },
    { id: 'genesis', codes: ['genesis block', 'genesis', 'block 0'],
      reply: '📰 Block 0, Jan 3 2009: "The Times 03/Jan/2009 Chancellor on brink of second bailout for banks." It all started here.' },
    { id: 'getblockhash0', codes: ['getblockhash 0', 'bitcoin-cli getblockhash 0'],
      reply: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f' },
    { id: 'satoshi', codes: ['satoshi', 'satoshi nakamoto', 'who is satoshi'],
      reply: '🕵️ I am not Satoshi. You are not Satoshi. (We are all Satoshi.)' },
    { id: 'stacksats', codes: ['stack sats', 'stacking sats', 'stay humble stack sats'],
      reply: '🧱 Stay humble, stack sats. One block at a time.' },
    { id: 'halving', codes: ['halving', 'the halving', 'halvening'],
      reply: '✂️ Every 210,000 blocks the reward is cut in half. 50 → 25 → 12.5 → 6.25 → 3.125 → … tick tock.' },
    { id: 'orangepill', codes: ['orange pill', 'orangepill', 'orange pilled'],
      reply: '🟠💊 You took the orange pill. There is no going back. Welcome down the rabbit hole.' },
    { id: 'pizza', codes: ['pizza day', 'bitcoin pizza', '10000 btc', '10,000 btc', 'laszlo'],
      reply: '🍕 May 22, 2010: Laszlo paid 10,000 BTC for two pizzas. Most expensive lunch in history.' },
    { id: 'notyourkeys', codes: ['not your keys', 'not your keys not your coins'],
      reply: '🔑 …not your coins. Self-custody is the way.' },
    { id: 'ticktock', codes: ['tick tock', 'tick tock next block', 'ticktock'],
      reply: '⏱️ Next block. ✅ (About every 10 minutes since 2009.)' },
    { id: 'fewunderstand', codes: ['few understand'],
      reply: '🧠 Few understand. You are now one of them.' },
    { id: 'lasereyes', codes: ['laser eyes', 'lasereyes'],
      reply: '👀🔴🔴 Laser eyes activated. Nacho sees $1M.' },
    { id: 'onebtc', codes: ['1 btc = 1 btc', '1btc=1btc', '1 btc 1 btc'],
      reply: '⚖️ 1 BTC = 1 BTC. Always has been.' },
    { id: 'whitepaper', codes: ['whitepaper', 'peer-to-peer electronic cash', 'bitcoin whitepaper'],
      reply: '📜 "Bitcoin: A Peer-to-Peer Electronic Cash System." 9 pages, Oct 31 2008. Read it, it is short.' },
];

const CODE_TO_EGG = {};
for (const egg of EGGS) for (const c of egg.codes) CODE_TO_EGG[normalize(c)] = egg;

function normalize(text) {
    return String(text).toLowerCase().replace(/\s+/g, ' ').trim().replace(/[!?.]+$/, '').trim();
}

function findEgg(text) {
    if (typeof text !== 'string' || !text || text.length > MAX_TEXT) return null;
    const key = normalize(text);
    return Object.prototype.hasOwnProperty.call(CODE_TO_EGG, key) ? CODE_TO_EGG[key] : null;
}

function isEligibleMessage(data) {
    if (!data || typeof data.uid !== 'string' || !data.uid) return false;
    if (data.uid === 'nacho-bot' || data.uid === 'system' || data.uid === 'deleted') return false;
    if (data.source === 'telegram' || data.isNachoAuto === true || data.isGif === true) return false;
    return true;
}

function replyText(egg, xp, alreadyFound) {
    if (xp > 0) return egg.reply + '\n🥚 Easter egg found! +' + xp + ' XP';
    if (alreadyFound) return egg.reply + '\n🥚 (already found)';
    return egg.reply + '\n🥚 Easter egg found!';
}

// deps: { applyDailyXp, offsetDateKey, now } for tests.
async function handle(db, admin, msgId, data, deps) {
    const d = deps || {};
    if (!isEligibleMessage(data)) return { code: 'ignored' };
    const egg = findEgg(data.text);
    if (!egg) return { code: 'no-egg' };
    const applyDailyXp = d.applyDailyXp || require('./applyDailyXp').applyDailyXp;
    const offsetDateKey = d.offsetDateKey || require('./offsetDay').offsetDateKey;
    const uid = data.uid;
    const replyRef = db.collection('global_chat').doc('egg_' + msgId);
    const globalRef = db.collection('easter_egg_rate').doc('global');
    const rateRef = db.collection('easter_egg_rate').doc(uid);
    const claimRef = db.collection('easter_egg_claims').doc(uid + '_' + egg.id);
    const userRef = db.collection('users').doc(uid);

    const result = await db.runTransaction(async (tx) => {
        const [r, g, u, c, us] = await Promise.all([
            tx.get(replyRef), tx.get(globalRef), tx.get(rateRef), tx.get(claimRef), tx.get(userRef),
        ]);
        const now = typeof d.now === 'number' ? d.now : Date.now();
        if (r.exists) return { code: 'replay' };
        if (g.exists && now - (g.data().lastMs || 0) < GLOBAL_COOLDOWN_MS) return { code: 'rate' };
        if (u.exists && now - (u.data().lastMs || 0) < USER_COOLDOWN_MS) return { code: 'rate' };
        const user = us.exists ? (us.data() || {}) : null;
        let xp = 0;
        let grant = null;
        const already = c.exists;
        if (!already && user) {
            grant = await applyDailyXp(uid, EGG_XP, tx, { day: offsetDateKey(now), userRef: userRef, user: user, now: now, boost: false });
            xp = Math.max(0, Math.min(EGG_XP, Number(grant.awarded) || 0));
        }
        tx.set(globalRef, { lastMs: now });
        tx.set(rateRef, { lastMs: now });
        const ts = admin.firestore.FieldValue.serverTimestamp();
        if (!already && user) {
            tx.set(claimRef, { uid: uid, egg: egg.id, xp: xp, msgId: msgId, at: ts });
            const upd = { easterEggsFound: admin.firestore.FieldValue.increment(1) };
            if (xp > 0) {
                upd.points = admin.firestore.FieldValue.increment(xp);
                upd.weeklyXP = admin.firestore.FieldValue.increment(xp);
                upd.monthlyXP = admin.firestore.FieldValue.increment(xp);
                if (grant && grant.dailyRef) tx.set(grant.dailyRef, { total: grant.dailyXp, lastUpdated: ts }, { merge: true });
            }
            tx.update(userRef, upd);
        }
        tx.set(replyRef, {
            uid: 'nacho-bot',
            name: '🦌 Nacho',
            text: replyText(egg, xp, already).slice(0, 500),
            isNachoAuto: false,
            replyTo: msgId,
            replyToName: String(data.name || '').slice(0, 60),
            replyToText: String(data.text || '').slice(0, 300),
            ts: ts,
        });
        return { code: 'ok', egg: egg.id, xp: xp, already: already };
    });
    return result;
}

module.exports = { EGGS, EGG_XP, USER_COOLDOWN_MS, GLOBAL_COOLDOWN_MS, normalize, findEgg, isEligibleMessage, replyText, handle };
