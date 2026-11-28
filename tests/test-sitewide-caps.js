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
    assert.strictEqual(typeof caps.planAdminPayHeld, 'undefined');
    const reserved = caps.planFaucetReserve(9, 0, 0, 10);
    assert.strictEqual(reserved.ok, true);
    const held = caps.planFaucetHold(9, reserved.reserved, 0);
    assert.strictEqual(held.paid, 9);
    assert.strictEqual(held.reserved, 0);
    assert.strictEqual(held.held, 1);
    // Midnight: new day is empty; the held row stays on 2026-11-24.
    const next = caps.rolloverState();
    assert.strictEqual(next.paid, 0);
    assert.strictEqual(next.held, 0);
    // Held slots still occupy the original day's cap.
    assert.strictEqual(caps.planFaucetReserve(held.paid, 0, held.held, 10).ok, false);
}

function faucetCountsPaidOnly() {
    let paid = 0;
    let reserved = 0;
    let held = 0;
    // Ten accounts reserve; only some get paid.
    for (let i = 0; i < 10; i++) {
        const plan = caps.planFaucetReserve(paid, reserved, held, 10);
        assert.strictEqual(plan.ok, true, 'reserve ' + (i + 1));
        reserved = plan.reserved;
    }
    assert.strictEqual(caps.planFaucetReserve(paid, reserved, held, 10).ok, false);
    assert.strictEqual(caps.planFaucetReserve(paid, reserved, held, 10).error, caps.CAP_HIT_MESSAGE);
    // Three fail: reserved drops, paid stays 0, and those slots free up.
    for (let i = 0; i < 3; i++) {
        const rel = caps.planFaucetRelease(paid, reserved);
        paid = rel.paid;
        reserved = rel.reserved;
    }
    assert.strictEqual(paid, 0);
    assert.strictEqual(reserved, 7);
    // Two are held (unknown payment): not paid, but they keep their slot.
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
    assert.strictEqual(held, 2);
    // Failed claims do not count. Held claims are not paid, but they still
    // occupy slots, so only 3 of the original 10 remain.
    assert.ok(paid < 10);
    const more = caps.planFaucetReserve(paid, reserved, held, 10);
    assert.strictEqual(more.ok, true);
    reserved = more.reserved;
    const fourth = caps.planFaucetReserve(paid, reserved, held, 10);
    assert.strictEqual(fourth.ok, true);
    reserved = fourth.reserved;
    const fifth = caps.planFaucetReserve(paid, reserved, held, 10);
    assert.strictEqual(fifth.ok, true);
    reserved = fifth.reserved;
    assert.strictEqual(caps.planFaucetReserve(paid, reserved, held, 10).ok, false);
}

function tenUnknownClaimsBlockTheEleventh() {
    let paid = 0;
    let reserved = 0;
    let held = 0;
    for (let i = 0; i < 10; i++) {
        const plan = caps.planFaucetReserve(paid, reserved, held, 10);
        assert.strictEqual(plan.ok, true, 'reserve ' + (i + 1));
        reserved = plan.reserved;
        const h = caps.planFaucetHold(paid, reserved, held);
        paid = h.paid;
        reserved = h.reserved;
        held = h.held;
    }
    assert.strictEqual(paid, 0);
    assert.strictEqual(reserved, 0);
    assert.strictEqual(held, 10);
    const blocked = caps.planFaucetReserve(paid, reserved, held, 10);
    assert.strictEqual(blocked.ok, false);
    assert.strictEqual(blocked.error, caps.CAP_HIT_MESSAGE);
    assert.strictEqual(blocked.error, caps.CAP_CARD.body);
}

function sweptPendingThenSettledKeepsOccupancyAndOtherReservations() {
    const staleMs = caps.RESERVE_STALE_MS;
    const now = Date.parse('2026-11-25T18:00:00.000Z');
    const sixteenAgo = now - (16 * 60 * 1000);
    assert.strictEqual(staleMs, 15 * 60 * 1000);
    assert.strictEqual(caps.planStaleReserveSweep({ status: 'pending', tsMs: now - staleMs + 1000, id: 'fresh' }, now, staleMs).release, false);
    assert.strictEqual(caps.planStaleReserveSweep({ status: 'pending', tsMs: sixteenAgo, etDay: '2026-11-25', id: 'stale' }, now, staleMs).release, true);
    assert.strictEqual(caps.planStaleReserveSweep({ status: 'used', tsMs: sixteenAgo, id: 'used' }, now, staleMs).release, false);
    assert.strictEqual(caps.planStaleReserveSweep({ status: 'unknown', tsMs: sixteenAgo, id: 'held' }, now, staleMs).release, false);
    assert.strictEqual(caps.planStaleReserveSweep({ status: 'pending', reserveSwept: true, tsMs: sixteenAgo, id: 'again' }, now, staleMs).release, false);
    assert.strictEqual(caps.planStaleReserveSweep({ status: 'pending', reservedReleased: true, tsMs: sixteenAgo, id: 'legacy' }, now, staleMs).release, false);
    assert.strictEqual(caps.planStaleReserveSweep({ status: 'pending', tsMs: sixteenAgo, id: 'cipher_abc', winId: 'w1' }, now, staleMs).release, false);
    assert.strictEqual(caps.planStaleReserveSweep({ status: 'pending', tsMs: sixteenAgo, id: 'noday' }, now, staleMs).reason, 'no-etDay');
    const twoDays = now - (49 * 60 * 60 * 1000);
    assert.strictEqual(caps.planStaleReserveSweep({ status: 'pending', tsMs: twoDays, etDay: '2026-11-23', id: 'old' }, now, staleMs).reason, 'too-old');

    // Two in-flight reservations: A will go stale, B must stay reserved.
    let paid = 0;
    let reserved = 0;
    let held = 0;
    let minOcc = Infinity;
    function note(inFlightOrDone) {
        const occ = paid + reserved + held;
        if (occ < minOcc) minOcc = occ;
        assert.ok(occ >= inFlightOrDone, 'occupancy ' + occ + ' dropped below ' + inFlightOrDone);
        return occ;
    }
    reserved = caps.planFaucetReserve(paid, reserved, held, 10).reserved;
    note(1);
    reserved = caps.planFaucetReserve(paid, reserved, held, 10).reserved;
    assert.strictEqual(reserved, 2);
    note(2);
    minOcc = paid + reserved + held;

    const moved = caps.planStaleReserveToHeld(paid, reserved, held);
    paid = moved.paid;
    reserved = moved.reserved;
    held = moved.held;
    assert.strictEqual(paid, 0);
    assert.strictEqual(reserved, 1, "the other claim's reservation must stay");
    assert.strictEqual(held, 1);
    assert.strictEqual(note(2), 2);

    // A settles after the sweep: held-1, paid+1, reserved stays at B's slot.
    const settled = caps.planSweptPaid(paid, reserved, held, 10);
    paid = settled.paidAfter;
    reserved = settled.reservedAfter;
    held = settled.heldAfter;
    assert.strictEqual(paid, 1);
    assert.strictEqual(reserved, 1, "settling a swept claim must not eat the other reservation");
    assert.strictEqual(held, 0);
    assert.strictEqual(note(2), 2);
    assert.strictEqual(minOcc, 2);

    // Trip alert still fires when a swept payment reaches the cap.
    const trip = caps.planSweptPaid(9, 1, 1, 10);
    assert.strictEqual(trip.paidAfter, 10);
    assert.strictEqual(trip.reservedAfter, 1);
    assert.strictEqual(trip.heldAfter, 0);
    assert.strictEqual(trip.tripped, true);
    assert.strictEqual(caps.faucetAlert(trip, '2026-11-25').type, 'sitewide_faucet_cap_trip');

    const failed = caps.planSweptFailed(0, 1, 1);
    assert.strictEqual(failed.paid, 0);
    assert.strictEqual(failed.reserved, 1);
    assert.strictEqual(failed.held, 0);

    const unk = caps.planSweptUnknown(0, 1, 1);
    assert.strictEqual(unk.paid, 0);
    assert.strictEqual(unk.reserved, 1);
    assert.strictEqual(unk.held, 1);
}

function legacyReleasedOutcomesDoNotUndercountOccupancy() {
    const now = Date.parse('2026-11-25T18:00:00.000Z');
    const staleMs = 15 * 60 * 1000;
    const sixteenAgo = now - (16 * 60 * 1000);
    // Sweep still skips both markers.
    assert.strictEqual(caps.planStaleReserveSweep({
        status: 'pending', reservedReleased: true, tsMs: sixteenAgo, etDay: '2026-11-25', id: 'legacy',
    }, now, staleMs).release, false);
    assert.strictEqual(caps.planStaleReserveSweep({
        status: 'pending', reserveSwept: true, tsMs: sixteenAgo, etDay: '2026-11-25', id: 'swept',
    }, now, staleMs).release, false);
    assert.strictEqual(caps.isReserveSwept({ reservedReleased: true }), false);
    assert.strictEqual(caps.isReserveSwept({ reserveSwept: true }), true);
    assert.strictEqual(caps.isLegacyReservedReleased({ reservedReleased: true }), true);
    assert.strictEqual(caps.isLegacyReservedReleased({ reserveSwept: true }), false);
    assert.strictEqual(caps.isLegacyReservedReleased({ reserveSwept: true, reservedReleased: true }), false);
    assert.strictEqual(caps.isSweepSkipMarked({ reservedReleased: true }), true);
    assert.strictEqual(caps.isSweepSkipMarked({ reserveSwept: true }), true);

    // Live slots: one reserved claim and one held unknown. The leftover
    // reservedReleased invoice is already out of occupancy.
    const paid = 0;
    const reserved = 1;
    const held = 1;
    const liveOcc = paid + reserved + held;

    const pay = caps.planLegacyReleasedPaid(paid, reserved, held, 10);
    assert.strictEqual(pay.paidAfter, 1);
    assert.strictEqual(pay.reservedAfter, 1);
    assert.strictEqual(pay.heldAfter, 1);
    const afterPay = pay.paidAfter + pay.reservedAfter + pay.heldAfter;
    assert.strictEqual(afterPay, liveOcc + 1);
    // The reserveSwept math would steal the other claim's held slot.
    const wrongPay = caps.planSweptPaid(paid, reserved, held, 10);
    assert.strictEqual(wrongPay.heldAfter, 0);
    assert.ok(wrongPay.paidAfter + wrongPay.reservedAfter + wrongPay.heldAfter < afterPay);
    const trip = caps.planLegacyReleasedPaid(9, 1, 1, 10);
    assert.strictEqual(trip.tripped, true);
    assert.strictEqual(trip.reservedAfter, 1);
    assert.strictEqual(trip.heldAfter, 1);

    const fail = caps.planLegacyReleasedFailed(paid, reserved, held);
    assert.strictEqual(fail.paid, 0);
    assert.strictEqual(fail.reserved, 1);
    assert.strictEqual(fail.held, 1);
    assert.strictEqual(fail.paid + fail.reserved + fail.held, liveOcc);
    const wrongFail = caps.planSweptFailed(paid, reserved, held);
    assert.ok(wrongFail.paid + wrongFail.reserved + wrongFail.held < liveOcc);

    const unk = caps.planLegacyReleasedUnknown(paid, reserved, held);
    assert.strictEqual(unk.paid, 0);
    assert.strictEqual(unk.reserved, 1);
    assert.strictEqual(unk.held, 1);
    assert.strictEqual(unk.paid + unk.reserved + unk.held, liveOcc);

    assert.strictEqual(caps.shouldHoldFaucetUnknown({ status: 'pending' }), true);
    assert.strictEqual(caps.shouldHoldFaucetUnknown({}), true);
    assert.strictEqual(caps.shouldHoldFaucetUnknown({ status: 'unknown' }), false);
    assert.strictEqual(caps.shouldHoldFaucetUnknown({ status: 'used' }), false);
    assert.strictEqual(caps.shouldHoldFaucetUnknown({ status: 'failed' }), false);
}

function makeSweepDb(invoices, days) {
    const rows = invoices.map(function (inv) { return Object.assign({}, inv); });
    const dayState = JSON.parse(JSON.stringify(days || {}));
    function tsOf(inv) { return inv.tsMs; }
    return {
        rows: rows,
        dayState: dayState,
        queries: 0,
        collection: function (name) {
            if (name === 'faucet_invoices') {
                const q = function () {
                    let status = null;
                    let fromMs = -Infinity;
                    let toMs = Infinity;
                    let afterId = null;
                    let limitN = 100;
                    const api = {
                        where: function (field, op, val) {
                            const n = val instanceof Date ? val.getTime() : val;
                            if (field === 'status' && op === '==') status = val;
                            if (field === 'ts' && op === '>=') fromMs = n;
                            if (field === 'ts' && op === '<=') toMs = n;
                            return api;
                        },
                        orderBy: function () { return api; },
                        limit: function (n) { limitN = n; return api; },
                        startAfter: function (doc) { afterId = doc && doc.id; return api; },
                        get: async function () {
                            this && this;
                            let list = rows.filter(function (inv) {
                                if (status && inv.status !== status) return false;
                                const ts = tsOf(inv);
                                return ts >= fromMs && ts <= toMs;
                            }).sort(function (a, b) {
                                return tsOf(a) - tsOf(b) || String(a.id).localeCompare(String(b.id));
                            });
                            if (afterId) {
                                const idx = list.findIndex(function (r) { return r.id === afterId; });
                                list = idx >= 0 ? list.slice(idx + 1) : list;
                            }
                            list = list.slice(0, limitN);
                            return {
                                docs: list.map(function (r) {
                                    return {
                                        id: r.id,
                                        ref: { id: r.id, path: 'faucet_invoices/' + r.id },
                                        data: function () { return Object.assign({}, r); },
                                    };
                                }),
                            };
                        },
                    };
                    return api;
                };
                return {
                    where: function () {
                        const api = q();
                        return api.where.apply(api, arguments);
                    },
                };
            }
            return {
                doc: function (id) {
                    return { id: id, path: name + '/' + id };
                },
            };
        },
        runTransaction: async function (fn) {
            const t = {
                get: async function (ref) {
                    const path = String(ref.path || '');
                    if (path.indexOf('faucet_invoices/') === 0) {
                        const inv = rows.find(function (r) { return r.id === ref.id; });
                        return { exists: !!inv, data: function () { return inv ? Object.assign({}, inv) : null; } };
                    }
                    const dayId = path.split('/')[1] || ref.id;
                    const data = dayState[dayId] || { paid: 0, reserved: 0, held: 0, unlocks: 0 };
                    return { exists: true, data: function () { return Object.assign({}, data); } };
                },
                set: function (ref, data) {
                    const path = String(ref.path || '');
                    if (path.indexOf('faucet_invoices/') === 0) {
                        const inv = rows.find(function (r) { return r.id === ref.id; });
                        if (inv) Object.assign(inv, data);
                        return;
                    }
                    const id = (data && data.day) || path.split('/')[1] || ref.id;
                    dayState[id] = Object.assign(dayState[id] || {}, data);
                },
            };
            return fn(t);
        },
    };
}

async function sweepQueryPagesPastSweptAndCountsOnlyRealMoves() {
    const now = Date.parse('2026-11-25T18:00:00.000Z');
    const sixteenAgo = now - (16 * 60 * 1000);
    const tenAgo = now - (10 * 60 * 1000);
    const twoDays = now - (49 * 60 * 60 * 1000);
    const invoices = [];
    for (let i = 0; i < 100; i++) {
        invoices.push({
            id: 'swept-' + String(i).padStart(3, '0'),
            status: 'pending',
            tsMs: sixteenAgo - (100 - i) * 1000,
            etDay: '2026-11-25',
            reserveSwept: true,
        });
    }
    invoices.push({ id: 'no-day', status: 'pending', tsMs: sixteenAgo + 1000, etDay: '' });
    invoices.push({ id: 'fresh', status: 'pending', tsMs: tenAgo, etDay: '2026-11-25' });
    invoices.push({ id: 'old', status: 'pending', tsMs: twoDays, etDay: '2026-11-23' });
    invoices.push({ id: 'real', status: 'pending', tsMs: sixteenAgo + 2000, etDay: '2026-11-25' });
    const db = makeSweepDb(invoices, { '2026-11-25': { paid: 0, reserved: 2, held: 0, unlocks: 0 } });
    const result = await caps.sweepStaleFaucetReserves(db, now, {
        limit: 100,
        isOffline: async function () { return false; },
    });
    assert.deepStrictEqual(result.ids, ['real']);
    assert.strictEqual(result.released, 1);
    assert.strictEqual(db.dayState['2026-11-25'].reserved, 1);
    assert.strictEqual(db.dayState['2026-11-25'].held, 1);
    assert.strictEqual(db.dayState['2026-11-25'].paid, 0);
    const real = db.rows.find(function (r) { return r.id === 'real'; });
    assert.strictEqual(real.reserveSwept, true);
    const noDay = db.rows.find(function (r) { return r.id === 'no-day'; });
    assert.ok(!noDay.reserveSwept);
}

async function sweepSkipsWhenKillSwitchIsOn() {
    const now = Date.parse('2026-11-25T18:00:00.000Z');
    const db = makeSweepDb([{
        id: 'real',
        status: 'pending',
        tsMs: now - (16 * 60 * 1000),
        etDay: '2026-11-25',
    }], { '2026-11-25': { paid: 0, reserved: 1, held: 0 } });
    const originalWhere = db.collection.bind(db);
    let queried = 0;
    db.collection = function (name) {
        if (name === 'faucet_invoices') queried += 1;
        return originalWhere(name);
    };
    const result = await caps.sweepStaleFaucetReserves(db, now, {
        isOffline: async function () { return true; },
    });
    assert.strictEqual(result.skipped, 'kill-switch');
    assert.strictEqual(result.released, 0);
    assert.deepStrictEqual(result.ids, []);
    assert.strictEqual(queried, 0);
    assert.strictEqual(db.dayState['2026-11-25'].reserved, 1);
    assert.strictEqual(db.dayState['2026-11-25'].held, 0);
}

async function nonAdminCapCallablesWriteNothing() {
    class HttpsError extends Error {
        constructor(code, message) {
            super(message);
            this.code = code;
        }
    }
    const functionsV1 = {
        https: { HttpsError: HttpsError },
        runWith: function () {
            return { https: { onCall: function (fn) { return fn; } } };
        },
    };
    const writes = [];
    const db = {
        collection: function () {
            return {
                doc: function () {
                    return { get: async function () { return { exists: false, data: function () { return null; } }; } };
                },
            };
        },
        runTransaction: async function (fn) {
            return fn({
                get: async function () { return { exists: false, data: function () { return null; } }; },
                set: function (ref, data) { writes.push(data); },
            });
        },
    };
    let stepUpCalls = 0;
    const stepUp = async function () {
        stepUpCalls += 1;
        return { uid: 'player1' };
    };
    const getFn = caps.makeAdminGetSitewideCaps({ functionsV1: functionsV1, db: db, stepUp: stepUp });
    const setFn = caps.makeAdminSetSitewideCaps({
        functionsV1: functionsV1,
        db: db,
        admin: { firestore: { FieldValue: { serverTimestamp: function () { return 'ts'; } } } },
        stepUp: stepUp,
    });
    async function rejected(fn, context, label) {
        const before = writes.length;
        const beforeStep = stepUpCalls;
        let err = null;
        try { await fn({ unlockCap: 100000 }, context); }
        catch (e) { err = e; }
        assert.ok(err, label + ' should throw');
        assert.strictEqual(err.code, 'permission-denied', label);
        assert.strictEqual(writes.length, before, label + ' must not write');
        assert.strictEqual(stepUpCalls, beforeStep, label + ' must not reach step-up');
    }
    await rejected(getFn, { auth: { uid: 'player1', token: { admin: false } } }, 'get admin=false');
    await rejected(setFn, { auth: { uid: 'player1', token: { admin: false } } }, 'set admin=false');
    await rejected(getFn, { auth: { uid: 'player1', token: {} } }, 'get admin missing');
    await rejected(setFn, { auth: { uid: 'player1', token: {} } }, 'set admin missing');
    await rejected(getFn, { auth: { uid: 'player1' } }, 'get no token');
    await rejected(setFn, {}, 'set no auth');
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
    assert.strictEqual(caps.planFaucetReserve(10, 0, 0, 10).error, caps.CAP_HIT_MESSAGE);
    assert.strictEqual(caps.planFaucetReserve(0, 0, 10, 10).error, caps.CAP_HIT_MESSAGE);
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


async function adminCapActionsAreOnRealFreshActionsList() {
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..');
    const src = fs.readFileSync(path.join(root, 'functions/src/secondFactor.js'), 'utf8');
    const block = src.slice(src.indexOf('const FRESH_ACTIONS'), src.indexOf('const RECOVERY_COUNT'));
    assert.ok(/adminSetSitewideCaps:\s*true/.test(block));
    assert.ok(/adminGetSitewideCaps:\s*true/.test(block));

    function HttpsError(code, message) {
        const err = new Error(message);
        err.code = code;
        return err;
    }
    const SF = require(path.join(root, 'functions/src/secondFactor'));
    const store = {};
    const db = {
        collection: function (name) {
            return {
                doc: function (id) {
                    const key = name + '/' + id;
                    return {
                        get: async function () {
                            return {
                                exists: store[key] != null,
                                data: function () { return store[key] ? Object.assign({}, store[key]) : undefined; }
                            };
                        }
                    };
                }
            };
        }
    };
    const api = SF.initSecondFactor({
        db: db,
        admin: { auth: function () { return {}; }, firestore: { FieldValue: { serverTimestamp: function () { return new Date(); } } } },
        HttpsError: HttpsError,
        authenticator: { generateSecret: function () { return 'x'; }, keyuri: function () { return 'otpauth'; }, checkDelta: function () { return null; }, options: {} },
        QRCode: { toDataURL: async function () { return ''; } }
    });
    const ctx = { auth: { uid: 'admin1', token: { admin: true, auth_time: Math.floor(Date.now() / 1000) - 60, firebase: {} } }, rawRequest: { headers: {} } };
    await assert.rejects(function () {
        return api.requireFreshStepUp(ctx, 'notARealAction');
    }, function (err) {
        return err.code === 'invalid-argument' && /Unknown action/.test(err.message);
    });
    const actions = ['adminSetSitewideCaps', 'adminGetSitewideCaps'];
    for (let i = 0; i < actions.length; i++) {
        var unknown = false;
        try {
            await api.requireFreshStepUp(ctx, actions[i]);
        } catch (err) {
            unknown = err.code === 'invalid-argument' && /Unknown action/.test(String(err.message || err));
            if (unknown) throw err;
        }
        assert.strictEqual(unknown, false, actions[i] + ' must be a known fresh action');
    }
}

async function main() {
    accountsBurnDownUnlocks();
    raceAtSlot30();
    etMidnightRollover();
    heldClaimsNeedAdminAndStayOffNextDay();
    faucetCountsPaidOnly();
    tenUnknownClaimsBlockTheEleventh();
    sweptPendingThenSettledKeepsOccupancyAndOtherReservations();
    legacyReleasedOutcomesDoNotUndercountOccupancy();
    await sweepQueryPagesPastSweptAndCountsOnlyRealMoves();
    await sweepSkipsWhenKillSwitchIsOn();
    settingsAreAdminLoggedAndRejectedWhenInvalid();
    capHitCopyIsOneConstant();
    alertsAtEightyAndTrip();
    await nonAdminCapCallablesWriteNothing();
    await adminCapActionsAreOnRealFreshActionsList();
    console.log('test-sitewide-caps: 15 groups passed');
}

main().catch(function (err) {
    console.error(err && err.stack || err);
    process.exit(1);
});
