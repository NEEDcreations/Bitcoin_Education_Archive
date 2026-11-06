'use strict';

// Nacho's Nook catalog. The server is the only price authority: spendTickets
// reads cost/caps from here and getNookShopCatalog serves the same list to the
// client for display. Nothing here converts OT to sats.
//
// Caps (all checked inside the purchase transaction):
//   holdCap    max units the user may hold of that inventory field after purchase
//   dailyCap   max units bought per offset day (05:00 UTC reset), shared by group
//   monthlyCap max units bought per UTC month, shared by group
//   maxAheadMs double XP window may not extend past now + this

const HOUR = 60 * 60 * 1000;

const ITEMS = {
    // Consumables
    streak_freeze:   { cost: 6,   type: 'consumable', name: 'Streak Freeze',        field: 'streakFreezes',    units: 1, holdCap: 10 },
    streak_freeze_3: { cost: 15,  type: 'consumable', name: '3× Streak Freezes',    field: 'streakFreezes',    units: 3, holdCap: 10, bundle: true },
    hint_token:      { cost: 3,   type: 'consumable', name: 'Hint Token',           field: 'hintTokens',       units: 1, holdCap: 50 },
    hint_token_5:    { cost: 12,  type: 'consumable', name: '5× Hint Tokens',       field: 'hintTokens',       units: 5, holdCap: 50, bundle: true },
    hash_booster:    { cost: 10,  type: 'consumable', name: 'Hash Booster',         field: 'hashBoosters',     units: 1, holdCap: 20, group: 'hash', dailyCap: 10 },
    hash_booster_3:  { cost: 27,  type: 'consumable', name: '3× Hash Boosters',     field: 'hashBoosters',     units: 3, holdCap: 20, group: 'hash', dailyCap: 10, bundle: true, isNew: true },
    bonus_spin:      { cost: 5,   type: 'consumable', name: 'Bonus Spin',           field: 'bonusSpins',       units: 1, holdCap: 10, group: 'spin', dailyCap: 5 },
    bonus_spin_3:    { cost: 14,  type: 'consumable', name: '3× Bonus Spins',       field: 'bonusSpins',       units: 3, holdCap: 10, group: 'spin', dailyCap: 5, bundle: true, isNew: true },
    double_xp:       { cost: 20,  type: 'doublexp',   name: 'Double XP (60 min)',   hours: 1, maxAheadMs: 6 * HOUR },
    double_xp_3h:    { cost: 50,  type: 'doublexp',   name: 'Double XP (3 hours)',  hours: 3, maxAheadMs: 6 * HOUR, bundle: true, isNew: true },
    second_rig:      { cost: 25,  type: 'consumable', name: 'Second Mining Rig',    field: 'secondRigCharges', units: 1, holdCap: 10 },
    second_rig_3:    { cost: 70,  type: 'consumable', name: '3× Second Mining Rig', field: 'secondRigCharges', units: 3, holdCap: 10, bundle: true, isNew: true },
    // Raffle (paid out by the existing monthly raffle; per-user monthly cap so
    // one stockpile cannot buy the whole draw)
    raffle_entry:    { cost: 10,  type: 'raffle',     name: 'Sats Raffle Entry',    field: 'raffleEntries',    units: 1, group: 'raffle', monthlyCap: 150 },
    raffle_entry_10: { cost: 95,  type: 'raffle',     name: '10× Raffle Entries',   field: 'raffleEntries',    units: 10, group: 'raffle', monthlyCap: 150, bundle: true, isNew: true },
    // Cosmetics (one-time sinks)
    pinned_badge:    { cost: 30,  type: 'cosmetic',   name: 'Pinned Badge',         cosmetic: 'pinned_badge' },
    chat_flair:      { cost: 60,  type: 'cosmetic',   name: 'Chat Flair',           cosmetic: 'chat_flair' },
    profile_frame:   { cost: 75,  type: 'cosmetic',   name: 'Profile Frame',        cosmetic: 'profile_frame' },
    nacho_skin_nook: { cost: 100, type: 'cosmetic',   name: 'Exclusive Nacho Skin', cosmetic: 'nacho_skin_nook' },
    // Retired from sale: does nothing since gifts open instantly. Owners keep it.
    gift_bag:        { cost: 100, type: 'cosmetic',   name: 'Gift Bag',             cosmetic: 'gift_bag', retired: true },
};

function shopError(code, message) {
    const e = new Error(message);
    e.shopCode = code;
    return e;
}

function offsetDay(nowMs) {
    return new Date(nowMs - 5 * HOUR).toISOString().slice(0, 10);
}

function cleanId(raw) {
    return String(raw || '').replace(/[^a-z0-9_]/g, '').substring(0, 40);
}

// Pure plan. user = current user doc data, caps = { daily: n, monthly: n } for
// this item's group. Returns everything the transaction must write.
function getItem(itemId) {
    return Object.prototype.hasOwnProperty.call(ITEMS, itemId) ? ITEMS[itemId] : null;
}

function plan(itemId, rawQty, user, caps, nowMs) {
    const item = getItem(itemId);
    if (!item || item.retired) throw shopError('invalid-argument', 'Unknown item.');
    const u = user || {};
    const c = caps || {};
    const qty = (item.bundle || item.type === 'cosmetic')
        ? 1
        : Math.max(1, Math.min(10, parseInt(rawQty, 10) || 1));
    const totalCost = item.cost * qty;
    const have = Number(u.orangeTickets) || 0;
    if (!Number.isFinite(have) || have < totalCost) {
        throw shopError('failed-precondition', 'Not enough tickets. Have ' + Math.max(0, Math.floor(have)) + ', need ' + totalCost + '.');
    }
    const out = { item, qty, totalCost, units: 0, field: null, doubleXpUntil: 0, cosmetic: null };
    if (item.type === 'cosmetic') {
        if ((u.ownedCosmetics || []).includes(item.cosmetic)) throw shopError('already-exists', 'You already own this item.');
        out.cosmetic = item.cosmetic;
        return out;
    }
    if (item.type === 'doublexp') {
        return out; // window math done by caller with doubleXp helper + maxAheadMs
    }
    const units = item.units * qty;
    if (item.holdCap) {
        const held = Math.max(0, Number(u[item.field]) || 0);
        if (held + units > item.holdCap) {
            throw shopError('resource-exhausted', 'You can hold up to ' + item.holdCap + '. You have ' + held + '.');
        }
    }
    if (item.dailyCap && (Number(c.daily) || 0) + units > item.dailyCap) {
        throw shopError('resource-exhausted', 'Daily limit is ' + item.dailyCap + '. Try again tomorrow.');
    }
    if (item.monthlyCap && (Number(c.monthly) || 0) + units > item.monthlyCap) {
        throw shopError('resource-exhausted', 'Monthly limit is ' + item.monthlyCap + ' entries.');
    }
    out.units = units;
    out.field = item.field;
    return out;
}

function publicCatalog() {
    const out = {};
    for (const [id, it] of Object.entries(ITEMS)) {
        if (it.retired) continue;
        out[id] = {
            cost: it.cost, name: it.name, type: it.type,
            units: it.units || null, hours: it.hours || null,
            holdCap: it.holdCap || null, dailyCap: it.dailyCap || null, monthlyCap: it.monthlyCap || null,
            isNew: !!it.isNew,
        };
    }
    return out;
}

module.exports = { ITEMS, getItem, plan, publicCatalog, offsetDay, cleanId, shopError, HOUR };
