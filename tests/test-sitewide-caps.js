'use strict';

const assert = require('assert');
const caps = require('../functions/src/sitewideCaps');

function accountsBurnDownUnlocks() {
    const uids = ['a', 'b', 'c', 'd', 'e'];
    let used = 0;
    const byUser = {};
    for (let i = 0; i < 30; i++) {
        const uid = uids[i % uids.length];
        const plan = caps.planUnlock(used, 30);
        assert.strictEqual(plan.ok, true, 'unlock ' + (i + 1) + ' should pass');
        used = plan.usedAfter;
        byUser[uid] = (byUser[uid] || 0) + 1;
        if (i + 1 === 24) assert.strictEqual(plan.crossed80, true);
        else assert.strictEqual(plan.crossed80, false);
        if (i + 1 === 30) assert.strictEqual(plan.tripped, true);
        else assert.strictEqual(plan.tripped, false);
    }
    assert.strictEqual(used, 30);
    const blocked = caps.planUnlock(used, 30);
    assert.strictEqual(blocked.ok, false);
    assert.strictEqual(blocked.error, caps.CAP_HIT_MESSAGE);
    assert.strictEqual(blocked.error, caps.CAP_CARD.body);
    assert.ok(byUser.a >= 6 && byUser.b >= 6);
}

function raceAtSlot30() {
    const store = { used: 29, v: 1 };
    function begin() { return { used: store.used, v: store.v }; }
    function commit(read) {
        if (read.v !== store.v) return 'conflict';
        const plan = caps.planUnlock(read.used, 30);
        if (!plan.ok) return 'cap';
        store.used = plan.usedAfter;
        store.v++;
        return 'ok';
    }
    const r1 = begin();
    const r2 = begin();
    assert.strictEqual(r1.used, 29);
    assert.strictEqual(r2.used, 29);
    assert.strictEqual(commit(r1), 'ok');
    assert.strictEqual(commit(r2), 'conflict');
    const retry = begin();
    assert.strictEqual(commit(retry), 'cap');
    assert.strictEqual(store.used, 30);
    assert.strictEqual(caps.planUnlock(store.used, 30).error, caps.CAP_HIT_MESSAGE);
}

function etMidnightRollover() {
    // 2026-11-25 04:59:00.000Z is 11:59 PM ET on Nov 24 (EST, UTC-5).
    // 2026-11-25 05:00:00.000Z is midnight ET on Nov 25.
    const before = Date.parse('2026-11-25T04:59:59.000Z');
    const after = Date.parse('2026-11-25T05:00:00.000Z');
    assert.strictEqual(caps.etDayKey(before), '2026-11-24');
    assert.strictEqual(caps.etDayKey(after), '2026-11-25');
    let used = 0;
    for (let i = 0; i < 30; i++) used = caps.planUnlock(used, 30).usedAfter;
    assert.strictEqual(caps.planUnlock(used, 30).ok, false);
    const next = caps.rolloverState();
    assert.strictEqual(next.unlocks, 0);
    assert.strictEqual(next.paid, 0);
    assert.strictEqual(next.reserved, 0);
    assert.strictEqual(next.held, 0);
    assert.strictEqual(caps.planUnlock(next.unlocks, 30).ok, true);
    // Held rows on the previous day are not copied into the new day.
    const prev = { unlocks: 30, paid: 10, reserved: 0, held: 2 };
    const rolled = caps.rolloverState(prev);
    assert.strictEqual(rolled.held, 0);
    assert.strictEqual(rolled.paid, 0);
}

function heldClaimsNeedAdminAndStayOffNextDay() {
    assert.strictEqual(caps.planAutoPayHeld().ok, false);
    assert.strictEqual(caps.planAutoPayHeld().reason, 'admin-required');
    const reserved = caps.planFaucetReserve(9, 0, 10);
    assert.strictEqual(reserved.ok, true);
    const held = caps.planFaucetHold(9, reserved.reserved, 0);
    assert.strictEqual(held.paid, 9);
    assert.strictEqual(held.reserved, 0);
    assert.strictEqual(held.held, 1);
    // Midnight: new day is empty; the held row stays on 2026-11-24.
    const next = caps.rolloverState();
    assert.strictEqual(next.paid, 0);
    assert.strictEqual(next.held, 0);
    const admin = caps.planAdminPayHeld('2026-11-24', '2026-11-25', held.paid, held.held, 10);
    assert.strictEqual(admin.ok, true);
    assert.strictEqual(admin.applyDay, '2026-11-24');
    assert.strictEqual(admin.skipCurrentDay, true);
    assert.strictEqual(admin.paidAfter, 10);
    assert.strictEqual(admin.heldAfter, 0);
    // The current day's paid count is untouched.
    assert.strictEqual(next.paid, 0);
}

function faucetCountsPaidOnly() {
    let paid = 0;
    let reserved = 0;
    let held = 0;
    // Ten accounts reserve; only some get paid.
    const reserves = [];
    for (let i = 0; i < 10; i++) {
        const plan = caps.planFaucetReserve(paid, reserved, 10);
        assert.strictEqual(plan.ok, true, 'reserve ' + (i + 1));
        reserved = plan.reserved;
        reserves.push('r' + i);
    }
    assert.strictEqual(caps.planFaucetReserve(paid, reserved, 10).ok, false);
    assert.strictEqual(caps.planFaucetReserve(paid, reserved, 10).error, caps.CAP_HIT_MESSAGE);
    // Three fail: reserved drops, paid stays 0.
    for (let i = 0; i < 3; i++) {
        const rel = caps.planFaucetRelease(paid, reserved);
        paid = rel.paid;
        reserved = rel.reserved;
    }
    assert.strictEqual(paid, 0);
    assert.strictEqual(reserved, 7);
    // Two are held: not paid.
    for (let i = 0; i < 2; i++) {
        const h = caps.planFaucetHold(paid, reserved, held);
        paid = h.paid;
        reserved = h.reserved;
        held = h.held;
    }
    assert.strictEqual(paid, 0);
    assert.strictEqual(reserved, 5);
    assert.strictEqual(held, 2);
    // Five actually pay.
    for (let i = 0; i < 5; i++) {
        const p = caps.planFaucetPaid(paid, reserved, 10);
        paid = p.paidAfter;
        reserved = p.reservedAfter;
        if (paid === 8) assert.ok(p.crossed80);
    }
    assert.strictEqual(paid, 5);
    assert.strictEqual(reserved, 0);
    // Failed and held attempts must not count toward the 10.
    assert.ok(paid < 10);
    // Remaining room is 5 more paid claims (held ones do not fill paid slots).
    const more = caps.planFaucetReserve(paid, reserved, 10);
    assert.strictEqual(more.ok, true);
}

function settingsAreAdminLoggedAndRejectedWhenInvalid() {
    const first = caps.planSettingsChange(null, { unlockCap: 30, faucetCap: 10 }, 'admin1', 1);
    // Defaults are already 30 and 10.
    assert.strictEqual(first.ok, false);
    const change = caps.planSettingsChange(null, { unlockCap: 40 }, 'admin1', 2);
    assert.strictEqual(change.ok, true);
    assert.strictEqual(change.after.unlockCap, 40);
    assert.strictEqual(change.after.faucetCap, 10);
    assert.strictEqual(change.audit.actorUid, 'admin1');
    assert.strictEqual(change.audit.before.unlockCap, 30);
    const bad = caps.planSettingsChange(change.after, { faucetCap: 0 }, 'admin1', 3);
    assert.strictEqual(bad.ok, false);
    const playerDoc = caps.settingsFromDoc(undefined);
    assert.strictEqual(playerDoc.unlockCap, 30);
    assert.strictEqual(playerDoc.faucetCap, 10);
}

function capHitCopyIsOneConstant() {
    assert.strictEqual(caps.CAP_CARD.title, 'Busy right now');
    assert.strictEqual(caps.CAP_CARD.body, 'Rewards are busy right now. Please try again later.');
    assert.strictEqual(caps.CAP_CARD.secondary, 'You can still play and learn in the meantime.');
    assert.strictEqual(caps.CAP_CARD.button, 'Keep exploring');
    assert.strictEqual(caps.CAP_HIT_MESSAGE, caps.CAP_CARD.body);
    assert.strictEqual(caps.planUnlock(30, 30).error, caps.CAP_HIT_MESSAGE);
    assert.strictEqual(caps.planFaucetReserve(10, 0, 10).error, caps.CAP_HIT_MESSAGE);
    const fs = require('fs');
    const path = require('path');
    const cardSrc = fs.readFileSync(path.join(__dirname, '..', 'sitewide-cap-card.js'), 'utf8');
    assert.ok(cardSrc.indexOf(caps.CAP_CARD.title) !== -1);
    assert.ok(cardSrc.indexOf(caps.CAP_CARD.body) !== -1);
    assert.ok(cardSrc.indexOf(caps.CAP_CARD.secondary) !== -1);
    assert.ok(cardSrc.indexOf(caps.CAP_CARD.button) !== -1);
    assert.ok(cardSrc.indexOf('#f7931a') === -1 && cardSrc.indexOf('#ea580c') === -1);
    assert.ok(cardSrc.indexOf('lucide-clock') !== -1);
}

function alertsAtEightyAndTrip() {
    const early = caps.planUnlock(23, 30);
    assert.strictEqual(early.crossed80, true);
    assert.strictEqual(early.tripped, false);
    const trip = caps.planUnlock(29, 30);
    assert.strictEqual(trip.tripped, true);
    const uEarly = caps.unlockAlert(early, '2026-11-25');
    const uTrip = caps.unlockAlert(trip, '2026-11-25');
    assert.strictEqual(uEarly.type, 'sitewide_unlock_cap_early');
    assert.strictEqual(uTrip.type, 'sitewide_unlock_cap_trip');
    const fEarly = caps.planFaucetPaid(7, 1, 10);
    const fTrip = caps.planFaucetPaid(9, 1, 10);
    assert.strictEqual(fEarly.crossed80, true);
    assert.strictEqual(fTrip.tripped, true);
    assert.strictEqual(caps.faucetAlert(fTrip, '2026-11-25').type, 'sitewide_faucet_cap_trip');
}

accountsBurnDownUnlocks();
raceAtSlot30();
etMidnightRollover();
heldClaimsNeedAdminAndStayOffNextDay();
faucetCountsPaidOnly();
settingsAreAdminLoggedAndRejectedWhenInvalid();
capHitCopyIsOneConstant();
alertsAtEightyAndTrip();
console.log('test-sitewide-caps: 8 groups passed');
