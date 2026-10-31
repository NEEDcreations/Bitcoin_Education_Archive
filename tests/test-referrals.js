// Referral decisions and the dry-run backfill planner. No Firebase.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const referrals = require('../functions/src/referrals');
const ipHmac = require('../functions/src/ipHmac');

let passed = 0;
let failed = 0;

const pendingTests = [];
function test(name, fn) {
    try {
        const result = fn();
        if (result && typeof result.then === 'function') {
            pendingTests.push(result.then(function () {
                console.log('✅ ' + name);
                passed++;
            }, function (e) {
                console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
                failed++;
            }));
            return;
        }
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

function user(uid, extra) {
    return Object.assign({ uid: uid, points: 0, referralCode: '', satsDisabled: false }, extra || {});
}

const NOW = 1_700_000_000_000;

function qualified(uid, extra) {
    return user(uid, Object.assign({
        points: 2140,
        scholarPoints: 0,
        createdMs: NOW - 8 * 24 * 60 * 60 * 1000,
        emailVerified: true,
        providers: ['password'],
        activeDayKeys: ['2026-10-01', '2026-10-02', '2026-10-03'],
    }, extra || {}));
}

function payoutInput(referred, referrer, referral, extra) {
    return Object.assign({
        hasSignal: true,
        nowMs: NOW,
        recentPaidAt: [],
        referral: referral || { status: 'pending', ticketsAwarded: false, referrerUid: referrer.uid },
        referred: referred,
        referrer: referrer,
    }, extra || {});
}

test('crossing Maxi is only the upward threshold', () => {
    assert.strictEqual(referrals.crossedMaxi(2139, 2140), true);
    assert.strictEqual(referrals.crossedMaxi(0, 2140), true);
    assert.strictEqual(referrals.crossedMaxi(2140, 2200), false);
    assert.strictEqual(referrals.crossedMaxi(2139, 2139), false);
    assert.strictEqual(referrals.MAXI_POINTS, 2140);
    assert.strictEqual(referrals.REFERRAL_TICKETS, 50);
});

test('a paid referral is not paid again', () => {
    const referred = user('pleb0001XXXX', { points: 3000 });
    const referrer = user('refcode0REFR', { referralCode: 'refcode0' });
    const paid = referrals.assessReferralPayout({
        referral: { status: 'paid', ticketsAwarded: true },
        referred: referred,
        referrer: referrer,
    });
    assert.strictEqual(paid.action, 'skip');
    assert.strictEqual(paid.reason, 'already-paid');
    const stamped = referrals.assessReferralPayout({
        referral: { status: 'pending', ticketsAwarded: true },
        referred: referred,
        referrer: referrer,
    });
    assert.strictEqual(stamped.reason, 'already-paid');
});

test('Maxi pays 50 to each side once, and fraud blocks payment', () => {
    const referred = qualified('pleb0001XXXX');
    const referrer = user('refcode0REFR', { referralCode: 'refcode0' });
    const pending = { status: 'pending', ticketsAwarded: false, referrerUid: referrer.uid };
    const pay = referrals.assessReferralPayout(payoutInput(referred, referrer, pending));
    assert.strictEqual(pay.action, 'pay');
    assert.strictEqual(pay.ticketsEach, 50);

    const flagged = referrals.assessReferralPayout(payoutInput(referred, referrer, Object.assign({}, pending, { status: 'flagged' })));
    assert.strictEqual(flagged.action, 'skip');

    const sameDevice = referrals.assessReferralPayout(payoutInput(
        Object.assign({}, referred, { fingerprint: 'device-1' }),
        Object.assign({}, referrer, { fingerprint: 'device-1' }),
        pending
    ));
    assert.strictEqual(sameDevice.action, 'flag');
    assert.notStrictEqual(sameDevice.action, 'pay');

    const self = referrals.assessReferralPayout(payoutInput(referred, Object.assign({}, referrer, { uid: referred.uid }), pending));
    assert.strictEqual(self.action, 'reject');

    const banned = referrals.assessReferralPayout(payoutInput(Object.assign({}, referred, { satsDisabled: true }), referrer, pending));
    assert.strictEqual(banned.action, 'reject');

    const userBanned = referrals.assessReferralPayout(payoutInput(Object.assign({}, referred, { banned: true }), referrer, pending));
    assert.strictEqual(userBanned.action, 'reject');
    assert.ok(userBanned.flags.indexOf('banned') !== -1);

    const ledgerBanned = referrals.assessReferralPayout(payoutInput(referred, Object.assign({}, referrer, { ledgerBanned: true }), pending));
    assert.strictEqual(ledgerBanned.action, 'reject');
    assert.ok(ledgerBanned.flags.indexOf('ledger-banned') !== -1);

    const late = referrals.assessReferralPayout(payoutInput(referred, referrer, Object.assign({}, pending, { status: 'late' })));
    assert.strictEqual(late.action, 'skip');
    const untrusted = referrals.assessReferralPayout(payoutInput(referred, referrer, Object.assign({}, pending, { status: 'untrusted' })));
    assert.strictEqual(untrusted.action, 'skip');
});

test('payout requires a signal, age, activity, email, and stays under the cap', () => {
    const referred = qualified('pleb0001XXXX');
    const referrer = user('refcode0REFR', { referralCode: 'refcode0' });
    const pending = { status: 'pending', ticketsAwarded: false, referrerUid: referrer.uid };
    const legacy = referrals.assessReferralPayout(payoutInput(referred, referrer, pending, { hasSignal: false }));
    assert.strictEqual(legacy.action, 'legacy');
    const scholarOnly = referrals.assessReferralPayout(payoutInput(
        qualified(referred.uid, { points: 4200, scholarPoints: 4200 }),
        referrer,
        pending
    ));
    assert.strictEqual(scholarOnly.reason, 'below-maxi');
    const activity = referrals.assessReferralPayout(payoutInput(
        qualified(referred.uid, { points: 4240, scholarPoints: 2100 }),
        referrer,
        pending
    ));
    assert.strictEqual(activity.action, 'pay');
    const young = referrals.assessReferralPayout(payoutInput(
        qualified(referred.uid, { createdMs: NOW - 2 * 24 * 60 * 60 * 1000 }),
        referrer,
        pending
    ));
    assert.strictEqual(young.reason, 'too-new');
    const inactive = referrals.assessReferralPayout(payoutInput(
        qualified(referred.uid, { activeDayKeys: ['2026-10-01'] }),
        referrer,
        pending
    ));
    assert.strictEqual(inactive.reason, 'inactive');
    const unverified = referrals.assessReferralPayout(payoutInput(
        qualified(referred.uid, { emailVerified: false, providers: ['password'] }),
        referrer,
        pending
    ));
    assert.strictEqual(unverified.reason, 'email-unverified');
    const phone = referrals.assessReferralPayout(payoutInput(
        qualified(referred.uid, { emailVerified: false, providers: ['phone'] }),
        referrer,
        pending
    ));
    assert.strictEqual(phone.action, 'pay');
    const recent = [];
    for (let i = 0; i < 5; i++) recent.push(NOW - i * 1000);
    const capped = referrals.assessReferralPayout(payoutInput(referred, referrer, pending, { recentPaidAt: recent }));
    assert.strictEqual(capped.action, 'flag');
    assert.strictEqual(capped.reason, 'referral-cap');
    assert.strictEqual(referrals.emailOk({ emailVerified: false, providers: [] }), false);
    const days = referrals.touchActiveDays(['2026-10-01', '2026-10-02'], Date.parse('2026-10-03T12:00:00Z'));
    assert.ok(days.length >= 3);
});

test('referral IP HMAC fails closed without a long secret', () => {
    assert.throws(function() { ipHmac.hmacIp('1.2.3.4', 'short'); });
    const secret = '0123456789abcdef';
    const a = ipHmac.hmacIp('1.2.3.4', secret);
    assert.strictEqual(a, ipHmac.hmacIp('1.2.3.4', secret));
    assert.notStrictEqual(a, ipHmac.hmacIp('5.6.7.8', secret));
    assert.strictEqual(a.length, 64);
    assert.strictEqual(ipHmac.hmacIp('', secret), '');
});

test('a referral is accepted only for a new account under the points cap', () => {
    const now = 1_700_000_000_000;
    const fresh = referrals.registrationGate({
        nowMs: now,
        createdMs: now - 60 * 60 * 1000,
        points: 20,
    });
    assert.strictEqual(fresh.ok, true);
    assert.strictEqual(fresh.status, 'pending');
    const old = referrals.registrationGate({
        nowMs: now,
        createdMs: now - referrals.SIGNUP_WINDOW_MS - 1,
        points: 0,
    });
    assert.strictEqual(old.ok, false);
    assert.strictEqual(old.status, 'late');
    assert.strictEqual(old.record, true);
    const rich = referrals.registrationGate({
        nowMs: now,
        createdMs: now - 1000,
        points: referrals.SIGNUP_MAX_POINTS + 1,
    });
    assert.strictEqual(rich.status, 'late');
    const unknown = referrals.registrationGate({ nowMs: now, createdMs: null, points: 0 });
    assert.strictEqual(unknown.record, false);
    assert.strictEqual(unknown.reason, 'age-unknown');
    const linked = referrals.registrationGate({
        nowMs: now,
        createdMs: now - 1000,
        points: 0,
        linked: true,
    });
    assert.strictEqual(linked.status, 'flagged');
    assert.strictEqual(linked.reason, 'linked-account');
    const guestUpgrade = referrals.registrationGate({
        nowMs: now,
        createdMs: now - 60 * 60 * 1000,
        points: 500,
        fairWindow: true,
    });
    assert.strictEqual(guestUpgrade.ok, true);
    assert.strictEqual(guestUpgrade.status, 'pending');
    const oldGuest = referrals.registrationGate({
        nowMs: now,
        createdMs: now - referrals.SIGNUP_WINDOW_MS - 1,
        points: 10,
        fairWindow: true,
    });
    assert.strictEqual(oldGuest.ok, false);
    assert.strictEqual(oldGuest.reason, 'account-age');
});

test('the signup window uses the earliest server clock, never a client one', () => {
    const now = 1_700_000_000_000;
    const start = referrals.referralWindowStart({
        authCreatedMs: now - 1000,
        serverArrivalMs: now - 2 * 60 * 60 * 1000,
        guestArrivalMs: now - 60 * 60 * 1000,
    });
    assert.strictEqual(start, now - 2 * 60 * 60 * 1000);
    assert.strictEqual(referrals.referralWindowStart({ authCreatedMs: now - 1000 }), now - 1000);
    assert.strictEqual(referrals.referralWindowStart({}), null);
    assert.strictEqual(referrals.fairUpgradeWindow({
        nowMs: now,
        ownArrivalMs: now - 60 * 60 * 1000,
        ownAnonymous: true,
    }), true);
    assert.strictEqual(referrals.fairUpgradeWindow({
        nowMs: now,
        ownArrivalMs: now - 60 * 60 * 1000,
        ownAnonymous: false,
        guestArrivalMs: now - 1000,
        guestAnonymous: true,
        guestMergedHere: false,
    }), false);
    assert.strictEqual(referrals.fairUpgradeWindow({
        nowMs: now,
        guestArrivalMs: now - 60 * 60 * 1000,
        guestAnonymous: true,
        guestMergedHere: true,
    }), true);
    const service = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'referralService.js'), 'utf8');
    const reg = service.slice(service.indexOf('async function registerReferral'), service.indexOf('async function payIfQualified'));
    assert.strictEqual(reg.indexOf('data.arrivalMs'), -1);
    assert.strictEqual(reg.indexOf('data.createdMs'), -1);
    assert.strictEqual(reg.indexOf('data.points'), -1);
    assert.ok(reg.indexOf('referralWindowStart') !== -1);
    assert.ok(reg.indexOf('fairUpgradeWindow') !== -1);
    assert.ok(reg.indexOf('referral_arrivals') !== -1 || service.indexOf("collection('referral_arrivals')") !== -1);
});

test('Lightning uids get a stable alphanumeric code and a lookup row', () => {
    const uid = 'ln:' + 'ab'.repeat(32);
    assert.strictEqual(referrals.referralCodeForUid(uid), '');
    assert.strictEqual(referrals.needsMintedReferralCode(uid), true);
    const code = referrals.mintedReferralCode(uid, 0);
    assert.strictEqual(code, referrals.mintedReferralCode(uid, 0));
    assert.notStrictEqual(code, referrals.mintedReferralCode(uid, 1));
    assert.ok(/^[A-Z0-9]{8}$/.test(code));
    assert.strictEqual(code.indexOf(':'), -1);
    assert.strictEqual(referrals.normalizeCode(code), code);
    assert.strictEqual(referrals.normalizeCode('ln:abcdef'), '');
    const users = [];
    for (let i = 0; i < 121; i++) {
        users.push({ uid: 'user' + String(i).padStart(4, '0') + 'WXYZ', referralCode: '' });
    }
    users.push({ uid: uid, referralCode: '' });
    const plan = referrals.planCodeLookup(users, {});
    assert.strictEqual(plan.counts.missing, 122);
    assert.strictEqual(plan.counts.collisions, 0);
    const again = referrals.planCodeLookup(users, plan.writes.reduce(function (index, row) {
        index[row.code] = row.uid;
        return index;
    }, {}));
    assert.strictEqual(again.counts.missing, 0);
    const ln = plan.writes.filter(function (row) { return row.uid === uid; })[0];
    assert.strictEqual(ln.code, code);
    const script = fs.readFileSync(path.join(__dirname, '..', 'functions', 'scripts', 'backfill_referral_code_lookup.js'), 'utf8');
    assert.ok(script.indexOf("process.argv.indexOf('--apply')") !== -1);
    assert.ok(script.indexOf('dry-run only') !== -1);
    assert.ok(script.indexOf('refusing --apply against production') !== -1);
    assert.ok(script.indexOf('Do not run it against production') !== -1);
});

test('a paid referral records the raid stat where the payout happens', () => {
    const service = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'referralService.js'), 'utf8');
    const pay = service.slice(service.indexOf('async function payIfQualified'), service.indexOf('async function grantReferralBadges'));
    const sync = service.slice(service.indexOf('async function syncReferralMaxiCount'), service.indexOf('async function onUserWritten'));
    assert.ok(pay.indexOf("metric: 'referralsPaid'") !== -1);
    assert.ok(pay.indexOf('noteTrusted') !== -1);
    assert.strictEqual(sync.indexOf('outcome'), -1);
    assert.strictEqual(sync.indexOf('referralsPaid'), -1);
    const written = service.slice(service.indexOf('async function onUserWritten'), service.indexOf('async function scanPending'));
    assert.ok(written.indexOf('activityPoints(before)') !== -1);
    assert.ok(written.indexOf('activityPoints(after)') !== -1);
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    assert.ok(rules.indexOf('match /referral_arrivals/{uid}') !== -1);
    assert.ok(rules.indexOf('match /referral_arrivals/{uid}') < rules.indexOf('allow read, write: if false;', rules.indexOf('match /referral_arrivals/{uid}')));
});

test('short links and previews keep a validated ref, and http redirects to https', () => {
    const worker = fs.readFileSync(path.join(__dirname, '..', 'workers', 'seo-router', 'worker.js'), 'utf8');
    const start = worker.indexOf('const PRIMARY_ORIGIN');
    const end = worker.indexOf('let channelCache');
    const fns = new Function(worker.slice(start, end) + '\nreturn { validatedReferralRef, urlWithRef, httpsRedirectTarget, spaRedirectTarget };')();
    assert.strictEqual(fns.validatedReferralRef('?ref=abc12345'), 'abc12345');
    assert.strictEqual(fns.validatedReferralRef('?ref=abc12345&x=1'), 'abc12345');
    assert.strictEqual(fns.validatedReferralRef('?ref=ln:abcdef'), '');
    assert.strictEqual(fns.validatedReferralRef('?ref=abc'), '');
    assert.strictEqual(fns.validatedReferralRef('?ref=abc12345<script>'), '');
    assert.strictEqual(fns.spaRedirectTarget('pvp', '?ref=abc12345'), 'https://bitcoineducation.quest/?ref=abc12345#pvp');
    assert.strictEqual(fns.spaRedirectTarget('beats', ''), 'https://bitcoineducation.quest/#beats');
    assert.strictEqual(fns.httpsRedirectTarget('http://bitcoineducation.quest/channels/mining?ref=abc12345'), 'https://bitcoineducation.quest/channels/mining?ref=abc12345');
    assert.strictEqual(fns.httpsRedirectTarget('https://bitcoineducation.quest/'), '');
    assert.ok(fns.urlWithRef('https://bitcoineducation.quest/channels/mining', 'abc12345').indexOf('og:url') === -1);
    assert.strictEqual(fns.urlWithRef('https://bitcoineducation.quest/channels/mining', 'abc12345'), 'https://bitcoineducation.quest/channels/mining?ref=abc12345');
    assert.ok(worker.indexOf('ogUrl') !== -1);
    assert.strictEqual(worker.indexOf("searchParams.get('ref')"), -1);
    assert.strictEqual(worker.indexOf('searchParams.get("ref")'), -1);
    assert.ok(worker.indexOf('return Response.redirect(httpsTarget, 301)') !== -1);
    assert.ok(worker.indexOf('spaRedirectTarget') !== -1);
});

function fixture() {
    const referrers = [];
    for (let i = 0; i < 5; i++) {
        const code = 'refcode' + i;
        referrers.push(user(code + 'REFR', { referralCode: code, points: 5000 }));
    }
    const users = referrers.slice();
    const existing = [];
    for (let i = 0; i < 25; i++) {
        const ref = referrers[i % referrers.length];
        const id = 'pleb' + String(i).padStart(4, '0') + 'XXXX';
        users.push(user(id, { referredBy: ref.referralCode, points: i < 6 ? 2140 : 100 }));
        if (i >= 7) {
            existing.push({
                id: id,
                referredUserUid: id,
                referrerUid: ref.uid,
                referrerCode: ref.referralCode,
                status: 'pending',
                ticketsAwarded: false,
            });
        }
    }
    return { users: users, referrals: existing };
}

test('backfill lists the 7 referredBy-only records and does not pay them', () => {
    const data = fixture();
    assert.strictEqual(data.users.filter(function(u) { return u.referredBy; }).length, 25);
    assert.strictEqual(data.referrals.length, 18);
    const plan = referrals.planBackfill(data);
    assert.strictEqual(plan.counts.referralRecordsToCreate, 7);
    assert.ok(plan.recordsToCreate.every(function(row) { return row.status === 'untrusted'; }));
    assert.strictEqual(plan.counts.maxiPayouts, 0);
    assert.strictEqual(plan.counts.ticketGrants, 0);
    assert.strictEqual(plan.counts.notifications, 0);
    assert.ok(plan.counts.referralCodesToBackfill > 0);
});

test('backfill pays a signaled Maxi referral and never pays a legacy doc', () => {
    const referred = qualified('plebpay1XXXX', { referredBy: 'refcode0' });
    const referrer = user('refcode0REFR', { referralCode: 'refcode0', points: 5000 });
    const row = {
        id: referred.uid,
        referredUserUid: referred.uid,
        referrerUid: referrer.uid,
        referrerCode: 'refcode0',
        status: 'pending',
        ticketsAwarded: false,
    };
    const legacy = referrals.planBackfill({
        users: [referred, referrer],
        referrals: [row],
        nowMs: NOW,
    });
    assert.strictEqual(legacy.counts.maxiPayouts, 0);
    const plan = referrals.planBackfill({
        users: [referred, referrer],
        referrals: [row],
        signals: [referred.uid],
        nowMs: NOW,
    });
    assert.strictEqual(plan.counts.referralRecordsToCreate, 0);
    assert.strictEqual(plan.counts.maxiPayouts, 1);
    assert.strictEqual(plan.counts.ticketGrants, 2);
    const noClock = referrals.planBackfill({
        users: [referred, referrer],
        referrals: [row],
        signals: [referred.uid],
    });
    assert.strictEqual(noClock.counts.maxiPayouts, 0);
    const onlyReferredBy = referrals.planBackfill({
        users: [referred, referrer],
        referrals: [],
        signals: [referred.uid],
        nowMs: NOW,
    });
    assert.strictEqual(onlyReferredBy.counts.maxiPayouts, 0);
    assert.strictEqual(onlyReferredBy.counts.referralRecordsToCreate, 1);
    assert.strictEqual(onlyReferredBy.recordsToCreate[0].status, 'untrusted');
});

test('planning again after the writes is a no-op', () => {
    const data = fixture();
    const plan = referrals.planBackfill(data);
    plan.codesToWrite.forEach(function(row) {
        const match = data.users.find(function(u) { return u.uid === row.uid; });
        match.referralCode = row.code;
    });
    plan.recordsToCreate.forEach(function(row) {
        data.referrals.push({
            id: row.referredUid,
            referredUserUid: row.referredUid,
            referrerUid: row.referrerUid,
            referrerCode: row.referrerCode,
            status: row.status,
            ticketsAwarded: false,
        });
    });
    plan.payouts.forEach(function(row) {
        const match = data.referrals.find(function(r) { return r.referredUserUid === row.referredUid; });
        match.status = 'paid';
        match.ticketsAwarded = true;
    });
    const again = referrals.planBackfill(data);
    assert.strictEqual(again.counts.referralRecordsToCreate, 0);
    assert.strictEqual(again.counts.maxiPayouts, 0);
    assert.strictEqual(again.counts.ticketGrants, 0);
    assert.strictEqual(again.counts.referralCodesToBackfill, 0);
});

test('an ambiguous code and a self referral are not paid', () => {
    const users = [
        user('abcd1234AAAA', { referralCode: 'abcd1234', points: 10 }),
        user('abcd1234BBBB', { referralCode: 'abcd1234', points: 10 }),
        user('plebselfXXXX', { referredBy: 'abcd1234', points: 3000 }),
        user('selfcodeYYYY', { referredBy: 'selfcode', points: 3000 }),
    ];
    const plan = referrals.planBackfill({ users: users, referrals: [] });
    assert.strictEqual(plan.counts.maxiPayouts, 0);
    assert.ok(!plan.recordsToCreate.some(function(row) { return row.referredUid === 'selfcodeYYYY'; }));
    assert.strictEqual(referrals.resolveReferrerUid('abcd1234', users, referrals.buildCodeIndex(users)), '');
});

test('backfill script defaults to dry-run and prints counts only', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'backfill_referrals.js'), 'utf8');
    assert.ok(src.indexOf("process.argv.indexOf('--apply')") !== -1);
    assert.ok(src.indexOf("process.argv.indexOf('--approved')") !== -1);
    assert.ok(src.indexOf('dry-run only') !== -1);
    assert.ok(src.indexOf('untrusted') !== -1);
    assert.ok(src.indexOf('legacy') !== -1);
    assert.ok(src.indexOf('signals') !== -1);
    assert.ok(src.indexOf('rejectionFlags') === -1);
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    assert.ok(rules.indexOf("'referredBy'") !== -1);
    assert.ok(rules.indexOf("'doubleXpUntil'") !== -1);
    assert.ok(rules.indexOf('allow create: if false;') !== -1);
});

test('home invite card is top-right and reads counts the user may see', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const tickets = fs.readFileSync(path.join(__dirname, '..', 'tickets.js'), 'utf8');
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    assert.ok(html.includes('id="inviteCard"'));
    assert.ok(html.includes('When a friend you invite earns 2,140 points outside the Scholar exam, you both get 50 orange tickets.'));
    assert.ok(html.includes('Share your link. Your friend signs up with it. When they earn 2,140 points outside the Scholar exam, you both get 50 orange tickets automatically.'));
    assert.ok(html.includes('earned 2,140'));
    assert.ok(!html.includes('reaches Maxi rank, you both get 50 orange tickets.'));
    assert.ok(html.includes('How it works'));
    assert.ok(html.includes('id="inviteCopy"'));
    assert.ok(html.includes('id="inviteShare"'));
    assert.ok(html.includes('🎟️ Invite'));
    assert.ok(html.includes('Sign up to get your invite link'));
    assert.ok(html.includes('.invite-card { display: none; position: fixed; top: 16px; right: 16px;'));
    assert.ok(html.includes('.invite-card[data-state="min"]'));
    assert.ok(html.includes('calc(186px + env(safe-area-inset-top, 0px))'));
    assert.ok(html.includes('calc(262px + env(safe-area-inset-top, 0px))'));
    assert.ok(html.includes('calc(50dvh - 22px)'));
    assert.ok(html.includes('env(safe-area-inset-right, 0px)'));
    assert.ok(html.includes('env(safe-area-inset-top, 0px)'));
    assert.ok(html.includes('env(safe-area-inset-bottom, 0px)'));
    assert.ok(html.includes('body:has(#usernameModal.open) .invite-card[data-state="min"]'));
    assert.ok(html.includes('id="todayInviteGuest"'));
    assert.ok(html.includes('body:has(#inviteCard[data-state="guest"][data-show="1"]) #inviteCard { display: none !important; }'));
    assert.ok(html.includes("onclick=\"openInviteFriends(true)\"") === false);
    assert.ok(tickets.includes('function openInviteFriends'));
    assert.ok(tickets.includes('function getReferralStats'));
    assert.ok(tickets.includes("where('referrerUid'"));
    assert.ok(tickets.includes('INVITE_STATS_MS'));
    assert.ok(html.includes('fetch(\'/sw.js\''));
    assert.ok(html.includes('.invite-card { right: 72px; }'));
    assert.ok(tickets.includes('linkEl.textContent = getReferralLink()'));
    assert.ok(tickets.includes('el.textContent = _inviteCountLine(stats)'));
    const copyBody = tickets.slice(tickets.indexOf('function copyInviteLink'), tickets.indexOf('function shareInviteLink'));
    assert.ok(copyBody.indexOf('_copyTextNow(text)') !== -1);
    assert.ok(copyBody.indexOf('_copyTextNow(text)') < copyBody.indexOf('navigator.clipboard.writeText'));
    assert.ok(tickets.includes("execCommand('copy')"));
    assert.ok(tickets.includes('navigator.share'));
    assert.ok(tickets.includes('btc_session_popup'));
    assert.ok(tickets.includes('inviteCard: state'));
    assert.ok(tickets.includes("localStorage.setItem(_inviteStorageKey(uid), state)"));
    assert.ok(html.includes('id="inviteGuestPill"'));
    assert.ok(html.includes('🎟️ Invite friends'));
    assert.ok(tickets.includes("if (state === 'off') return 'min'"));
    assert.ok(tickets.includes("if (state === 'open') return 'min'"));
    assert.ok(tickets.includes("if (state === 'off') state = 'min'"));
    assert.ok(tickets.includes("if (state === 'open') state = 'min'"));
    assert.ok(tickets.includes('btc_invite_auto_'));
    assert.ok(tickets.includes('7 * 24 * 60 * 60 * 1000'));
    assert.ok(tickets.includes('function _scheduleInvitePlace'));
    assert.ok(tickets.includes('requestAnimationFrame'));
    assert.ok(!tickets.includes('_inviteSessionAuto'));
    assert.ok(!tickets.includes('btc_invite_auto_session'));
    assert.ok(!tickets.includes('_invitePreviewOn'));
    assert.ok(!tickets.includes('_homePreviewUser'));
    assert.ok(tickets.includes('_inviteHeldOpen && !_inviteModalOpen()'));
    assert.ok(tickets.includes('box.bottom <= 1 || box.top >= window.innerHeight - 1'));
    assert.ok(tickets.includes('parseFloat(style.opacity) === 0'));
    assert.ok(tickets.includes("style.display === 'none' || style.visibility === 'hidden'"));
    const expandBody = tickets.slice(tickets.indexOf('function expandInviteCard'), tickets.indexOf('function dismissInviteCard'));
    assert.ok(expandBody.includes('_inviteModalOpen()'));
    assert.ok(!expandBody.includes('_inviteAutoBlocked()'));
    const refreshBody = tickets.slice(tickets.indexOf('function refreshInviteCard'), tickets.indexOf('function openInviteFriends'));
    assert.ok(refreshBody.includes('_inviteAutoDue(uid) && !_inviteAutoBlocked()'));
    assert.ok(tickets.includes("_inviteWriteStored('min')"));
    assert.ok(!tickets.includes("_inviteWriteStored('off')"));
    assert.ok(!tickets.includes("_inviteWriteStored('open')"));
    assert.ok(tickets.includes("pill.textContent = '🎟️ Invite friends'"));
    assert.ok(tickets.includes('querySelectorAll'));
    assert.ok(!tickets.includes("var ids = ['usernameModal', 'questModal', 'tosModal', 'leaderboard', 'lb']"));
    assert.ok(html.includes('aria-label="Invite friends"'));
    assert.strictEqual((html.match(/aria-label="Invite friends"/g) || []).length, 2);
    assert.ok(html.includes('body:has(#inviteCard[data-state="guest"][data-show="1"]) #inviteGuestPill { display: none !important; }'));
    assert.ok(rules.includes("request.resource.data.inviteCard == 'open'"));
    assert.ok(rules.includes("request.resource.data.inviteCard == 'min'"));
    assert.ok(rules.includes("request.resource.data.inviteCard == 'off'"));
    const cardJs = tickets.slice(tickets.indexOf('function _fillInviteCard'), tickets.indexOf('function _paintInviteCounts'));
    assert.ok(cardJs.indexOf('innerHTML') === -1);
    const service = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'referralService.js'), 'utf8');
    assert.ok(service.includes('rewardNotify.plan'));
    assert.ok(service.includes("onceKey: 'referral_out_'"));
    assert.ok(service.includes("onceKey: 'referral_in_'"));
    assert.ok(service.includes("sourceLabel: 'a referral reaching Maxi'"));
    assert.ok(service.includes("sourceLabel: 'reaching Maxi with a referral'"));
    assert.ok(service.includes("collection('referral_signals')"));
    assert.ok(service.includes('registrationGate'));
    assert.ok(service.includes('assessFingerprint'));
    assert.ok(service.includes('faucet_ledger'));
    assert.ok(service.indexOf('signupIpHmac:') !== -1);
    assert.ok(service.indexOf('signupIp:') === -1);
    assert.ok(service.indexOf('expireAt:') !== -1);
    assert.ok(service.indexOf("status: 'legacy'") !== -1);
    assert.ok(service.indexOf('referral_pay_limits') !== -1);
    assert.ok(service.indexOf('deleteMyReferralSignal') !== -1);
    const reg = service.slice(service.indexOf('async function registerReferral'), service.indexOf('async function payIfQualified'));
    assert.ok(reg.indexOf("reason: 'exists'") !== -1);
    assert.ok(reg.indexOf("reason: 'exists'") < reg.indexOf('linkedAccount'));
    assert.ok(reg.indexOf('takeRegisterRate') < reg.indexOf('linkedAccount'));
    const payload = service.slice(service.indexOf('function referralPayload'), service.indexOf('async function takeRegisterRate'));
    assert.ok(payload.indexOf('signupIp') === -1);
    assert.ok(payload.indexOf('rejectionFlags') === -1);
    const ranking = fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8');
    assert.strictEqual(ranking.indexOf('deleteMyReferralSignal'), -1);
    const deleter = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'deleteAccount.js'), 'utf8');
    assert.ok(deleter.indexOf("'referral_signals'") !== -1);
    const indexJs = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const scholar = indexJs.slice(indexJs.indexOf('exports.gradeScholarExam'), indexJs.indexOf('exports.startQuest'));
    assert.ok(scholar.indexOf('planDailyXp') === -1);
    assert.ok(scholar.indexOf("require('./src/certBonus')") !== -1);
    assert.ok(scholar.indexOf('certBonus.bonusUserFields') !== -1);
    const bonusSrc = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'certBonus.js'), 'utf8');
    assert.ok(bonusSrc.indexOf('scholarPoints') !== -1);
    assert.ok(indexJs.indexOf('activeDayKeys') !== -1);
    assert.ok(rules.includes('resource.data.referrerUid == request.auth.uid'));
    assert.ok(rules.includes('resource.data.referredUserUid == request.auth.uid'));
    assert.ok(rules.includes('match /referral_signals/{signalId}'));
    assert.ok(rules.includes('match /referral_scan/{docId}'));
    assert.ok(rules.includes('match /tip_hashes/{hashId}'));
    assert.ok(rules.includes('match /referral_pay_limits/{uid}'));
    assert.ok(rules.includes("'scholarPoints'"));
    assert.ok(rules.includes("'activeDayKeys'"));
    const refRules = rules.slice(rules.indexOf('match /referrals/'), rules.indexOf('match /referral_signals/'));
    assert.ok(refRules.includes('allow create, update, delete: if false'));
    assert.ok(refRules.indexOf('isAdmin()') === -1);
    const privacy = fs.readFileSync(path.join(__dirname, '..', 'privacy.html'), 'utf8');
    assert.ok(privacy.includes('server-only'));
    assert.ok(privacy.includes('referral signup'));
    assert.ok(privacy.includes('one-way, non-reversible fingerprint of your network address, kept 90 days'));
    assert.ok(!privacy.includes('HMAC'));
    assert.ok(privacy.includes('kept 90 days'));
    assert.ok(!privacy.includes('btc_auth_display'));
    assert.ok(!privacy.includes('btc_profile_cache'));
    assert.ok(service.indexOf("collection('notifications')") === -1);
    const terms = fs.readFileSync(path.join(__dirname, '..', 'terms.html'), 'utf8');
    assert.ok(!terms.includes('HMAC'));
    assert.ok(terms.includes('We use App Check to help block automated abuse'));
    assert.ok(!terms.includes('including sats claims and Say hi'));
    assert.ok(terms.includes('2,140 points'));
    assert.ok(terms.includes('50 Orange Tickets'));
    assert.ok(terms.includes('72 hours'));
    assert.ok(terms.includes('7 days'));
    assert.ok(terms.includes('3 different days'));
    assert.ok(terms.includes('5 referrals'));
    assert.ok(!terms.includes('2,100+ points'));
    assert.ok(!terms.includes('Double XP Charges'));
    const notes = fs.readFileSync(path.join(__dirname, '..', 'patch-notes.html'), 'utf8');
    assert.ok(notes.includes('Invite friends: share your link from the home page. When they reach Maxi, you both get 50 orange tickets.'));
    assert.ok(notes.includes('Double XP starts when you buy it'));
    assert.ok(notes.includes('I sent the tip'));
});

// Behavioral invite-card cases. tickets.js is loaded once in a tiny DOM so
// these stay free of jsdom. A fixed overlay slid off-screen is not a popup.
function loadInvitePage() {
    const vm = require('vm');
    const uid = 'user1234abcd';
    const store = Object.create(null);
    const session = Object.create(null);
    function Storage(map) {
        this.getItem = function(k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; };
        this.setItem = function(k, v) { map[String(k)] = String(v); };
        this.removeItem = function(k) { delete map[k]; };
    }
    store['btc_invite_auto_' + uid] = String(Date.now());

    function Element(tag) {
        this.tagName = String(tag || 'div').toUpperCase();
        this.nodeType = 1;
        this.id = '';
        this.className = '';
        this.style = {};
        this.children = [];
        this.parentNode = null;
        this.textContent = '';
        this.attributes = Object.create(null);
        const self = this;
        this.classList = {
            contains: function(c) { return self.className.split(/\s+/).indexOf(c) !== -1; },
            add: function(c) {
                if (!this.contains(c)) self.className = (self.className + ' ' + c).trim();
                self.attributes.class = self.className;
            },
            remove: function(c) {
                self.className = self.className.split(/\s+/).filter(function(x) { return x && x !== c; }).join(' ');
                self.attributes.class = self.className;
            },
        };
    }
    Element.prototype.setAttribute = function(name, value) {
        this.attributes[name] = String(value);
        if (name === 'id') {
            this.id = String(value);
            if (this.ownerDocument) this.ownerDocument._ids[this.id] = this;
        }
        if (name === 'class') this.className = String(value);
    };
    Element.prototype.getAttribute = function(name) {
        if (name === 'id') return this.id || null;
        if (name === 'class') return this.className || null;
        return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    };
    Element.prototype.hasAttribute = function(name) {
        if (name === 'id') return !!this.id;
        if (name === 'class') return !!this.className;
        return Object.prototype.hasOwnProperty.call(this.attributes, name);
    };
    Element.prototype.removeAttribute = function(name) {
        if (name === 'id') this.id = '';
        if (name === 'class') this.className = '';
        delete this.attributes[name];
    };
    Element.prototype.appendChild = function(child) {
        if (child.parentNode) {
            const i = child.parentNode.children.indexOf(child);
            if (i >= 0) child.parentNode.children.splice(i, 1);
        }
        child.parentNode = this;
        child.ownerDocument = this.ownerDocument;
        this.children.push(child);
        if (child.id && child.ownerDocument) child.ownerDocument._ids[child.id] = child;
        return child;
    };
    Element.prototype.remove = function() {
        if (!this.parentNode) return;
        const i = this.parentNode.children.indexOf(this);
        if (i >= 0) this.parentNode.children.splice(i, 1);
        this.parentNode = null;
    };
    Element.prototype.focus = function() {};
    Element.prototype.select = function() {};
    Element.prototype.addEventListener = function() {};
    Object.defineProperty(Element.prototype, 'hidden', {
        get: function() { return this.hasAttribute('hidden'); },
        set: function(v) { if (v) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); },
    });
    function matches(el, sel) {
        sel = String(sel || '').trim();
        if (!sel || !el || el.nodeType !== 1) return false;
        if (sel.indexOf(',') !== -1) {
            return sel.split(',').some(function(part) { return matches(el, part); });
        }
        if (sel.charAt(0) === '.') return el.classList.contains(sel.slice(1));
        if (sel.charAt(0) === '#') return el.id === sel.slice(1);
        const wrapped = sel.match(/^([a-zA-Z][\w-]*)?\[(.+)\]$/);
        if (!wrapped) return false;
        if (wrapped[1] && el.tagName.toLowerCase() !== wrapped[1].toLowerCase()) return false;
        const attr = wrapped[2].match(/^([\w:-]+)(?:(\*|~|\^|\$)?=(?:"([^"]*)"|'([^']*)'))?$/);
        if (!attr) return false;
        const name = attr[1];
        const actual = el.getAttribute(name);
        if (attr[2] == null && attr[3] == null && attr[4] == null) return el.hasAttribute(name);
        const expected = attr[3] != null ? attr[3] : attr[4];
        const have = actual == null ? '' : String(actual);
        if (attr[2] === '*') return have.indexOf(expected) !== -1;
        if (attr[2] === '^') return have.indexOf(expected) === 0;
        if (attr[2] === '$') return have.slice(-expected.length) === expected;
        return have === expected;
    }
    Element.prototype.closest = function(sel) {
        let n = this;
        while (n && n.nodeType === 1) {
            if (matches(n, sel)) return n;
            n = n.parentNode;
        }
        return null;
    };
    function walk(node, out) {
        const kids = node.children || [];
        for (let i = 0; i < kids.length; i++) {
            if (kids[i].nodeType === 1) out.push(kids[i]);
            walk(kids[i], out);
        }
    }
    function queryAll(root, sel) {
        const all = [];
        walk(root, all);
        return all.filter(function(el) { return matches(el, sel); });
    }

    const document = { nodeType: 9, children: [], readyState: 'complete', _ids: Object.create(null) };
    document.createElement = function(tag) {
        const el = new Element(tag);
        el.ownerDocument = document;
        return el;
    };
    document.getElementById = function(id) { return this._ids[id] || null; };
    document.querySelector = function(sel) {
        const found = queryAll(this, sel);
        return found[0] || null;
    };
    document.querySelectorAll = function(sel) { return queryAll(this, sel); };
    document.addEventListener = function() {};
    document.execCommand = function() { return false; };
    Element.prototype.querySelector = function(sel) {
        const found = queryAll(this, sel);
        return found[0] || null;
    };
    Element.prototype.querySelectorAll = function(sel) { return queryAll(this, sel); };

    const body = document.createElement('div');
    body.tagName = 'BODY';
    document.body = body;
    document.children.push(body);
    body.ownerDocument = document;

    function mount(id, tag) {
        const el = document.createElement(tag || 'div');
        if (id) el.setAttribute('id', id);
        body.appendChild(el);
        return el;
    }
    const home = mount('home');
    const card = mount('inviteCard');
    card.setAttribute('data-state', 'min');
    card.setAttribute('data-show', '0');
    card.appendChild(mount('inviteLink', 'p'));
    card.appendChild(mount('inviteCopy', 'button'));
    const share = mount('inviteShare', 'button');
    share.setAttribute('hidden', '');
    card.appendChild(share);
    card.appendChild(mount('inviteCounts', 'p'));
    card.appendChild(mount('invitePill', 'button'));
    const guest = mount('inviteGuestPill', 'button');
    guest.setAttribute('hidden', '');
    mount('main');

    const sandbox = {
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        Date: Date,
        Math: Math,
        URLSearchParams: URLSearchParams,
        parseInt: parseInt,
        parseFloat: parseFloat,
        String: String,
        Number: Number,
        Object: Object,
        Array: Array,
        RegExp: RegExp,
        Error: Error,
        JSON: JSON,
        document: document,
        navigator: {},
        history: { replaceState: function() {} },
        location: { origin: 'https://example.test', pathname: '/', search: '', hash: '', hostname: 'example.test' },
        localStorage: new Storage(store),
        sessionStorage: new Storage(session),
        innerWidth: 390,
        innerHeight: 800,
        addEventListener: function() {},
        removeEventListener: function() {},
        requestAnimationFrame: function(fn) { return setTimeout(fn, 0); },
        cancelAnimationFrame: function(id) { clearTimeout(id); },
        MutationObserver: function() {},
        currentUser: { uid: uid, inviteCard: 'min', referralCode: 'user1234', referralCount: 0 },
        auth: {
            currentUser: { uid: uid, isAnonymous: false },
            onAuthStateChanged: function(fn) { this._cb = fn; },
        },
    };
    sandbox.MutationObserver.prototype = { observe: function() {}, disconnect: function() {} };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.getComputedStyle = function(el) {
        const st = (el && el.style) || {};
        return {
            display: st.display || 'block',
            visibility: st.visibility || 'visible',
            pointerEvents: st.pointerEvents || 'auto',
            position: st.position || 'static',
            opacity: (st.opacity != null && st.opacity !== '') ? String(st.opacity) : '1',
        };
    };
    Element.prototype.getBoundingClientRect = function() {
        const st = this.style || {};
        const w = parseFloat(st.width) || 0;
        const h = parseFloat(st.height) || 0;
        let left = parseFloat(st.left);
        if (!isFinite(left)) left = 0;
        let top = parseFloat(st.top);
        if (!isFinite(top)) {
            if (st.bottom === '0' || st.bottom === '0px') top = sandbox.innerHeight - h;
            else top = 0;
        }
        const tr = String(st.transform || '');
        const y = tr.match(/translateY\(\s*(-?[\d.]+)\s*(%|px)?\s*\)/);
        if (y) top += (y[2] === '%') ? h * parseFloat(y[1]) / 100 : parseFloat(y[1]);
        return { x: left, y: top, left: left, top: top, width: w, height: h, right: left + w, bottom: top + h };
    };

    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'tickets.js'), 'utf8'), sandbox, { filename: 'tickets.js' });
    sandbox._uid = uid;
    return sandbox;
}

const invitePage = loadInvitePage();

function chatOverlay(page, translateY) {
    let el = page.document.getElementById('chatOverlay');
    if (!el) {
        el = page.document.createElement('div');
        el.setAttribute('id', 'chatOverlay');
        page.document.body.appendChild(el);
    }
    el.style.position = 'fixed';
    el.style.display = 'flex';
    el.style.height = '776px';
    el.style.width = page.innerWidth + 'px';
    el.style.bottom = '0';
    el.style.left = '0';
    el.style.right = '0';
    el.style.transform = translateY;
    return el;
}

function inviteState(page) {
    return page.document.getElementById('inviteCard').getAttribute('data-state');
}

test('the first stored referral wins until it expires', () => {
    const page = invitePage;
    page.localStorage.removeItem('btc_referral_code');
    page.localStorage.removeItem('btc_referral_code_at');
    page.location.search = '?ref=firstcode';
    page.captureReferralCode();
    assert.strictEqual(page.localStorage.getItem('btc_referral_code'), 'firstcode');
    page.location.search = '?ref=latercode';
    page.captureReferralCode();
    assert.strictEqual(page.localStorage.getItem('btc_referral_code'), 'firstcode');
    page.location.search = '?ref=ln:abcdef';
    page.captureReferralCode();
    assert.strictEqual(page.localStorage.getItem('btc_referral_code'), 'firstcode');
    page.localStorage.setItem('btc_referral_code_at', String(Date.now() - 31 * 24 * 60 * 60 * 1000));
    page.location.search = '?ref=latercode';
    page.captureReferralCode();
    assert.strictEqual(page.localStorage.getItem('btc_referral_code'), 'latercode');
    page.location.search = '';
});

test('a signed-in load retries a stored ref and clears it once accepted', async () => {
    const page = invitePage;
    page.localStorage.setItem('btc_referral_code', 'hostcode');
    page.localStorage.setItem('btc_referral_code_at', String(Date.now()));
    const calls = [];
    page.firebase = {
        functions: function () {
            return {
                httpsCallable: function () {
                    return function (payload) {
                        calls.push(payload);
                        return Promise.resolve({ data: { success: true, status: 'pending' } });
                    };
                }
            };
        }
    };
    await page.attachReferral(page.auth.currentUser.uid);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].refCode, 'hostcode');
    assert.strictEqual(page.localStorage.getItem('btc_referral_code'), null);
    page.auth.currentUser.isAnonymous = true;
    page.localStorage.setItem('btc_referral_code', 'hostcode');
    page.localStorage.setItem('btc_referral_code_at', String(Date.now()));
    await page.attachReferral(page.auth.currentUser.uid);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(page.localStorage.getItem('btc_referral_code'), 'hostcode');
    page.auth.currentUser.isAnonymous = false;
    page.currentUser.uid = 'ln:' + 'cd'.repeat(20);
    page.currentUser.referralCode = '';
    assert.strictEqual(page.getReferralCode(), null);
    page.currentUser.referralCode = 'LNCODE12';
    assert.strictEqual(page.getReferralCode(), 'LNCODE12');
    page.currentUser.uid = page._uid;
    page.currentUser.referralCode = 'user1234';
});

test('a closed chat overlay does not block expandInviteCard', () => {
    chatOverlay(invitePage, 'translateY(100%)');
    assert.strictEqual(invitePage._invitePopupElement(invitePage.document.getElementById('chatOverlay')), false);
    invitePage.expandInviteCard();
    assert.strictEqual(inviteState(invitePage), 'open');
    invitePage.refreshInviteCard();
    assert.strictEqual(inviteState(invitePage), 'open');
});

test('an on-screen chat overlay keeps the invite card minimized', () => {
    chatOverlay(invitePage, 'translateY(0)');
    assert.strictEqual(invitePage._invitePopupElement(invitePage.document.getElementById('chatOverlay')), true);
    invitePage.expandInviteCard();
    assert.strictEqual(inviteState(invitePage), 'min');
    invitePage.refreshInviteCard();
    assert.strictEqual(inviteState(invitePage), 'min');
});

test('a tap opens the invite card even when the session popup budget is taken', () => {
    chatOverlay(invitePage, 'translateY(100%)');
    invitePage.sessionStorage.setItem('btc_session_popup', 'quest');
    invitePage.expandInviteCard();
    assert.strictEqual(inviteState(invitePage), 'open');
    invitePage.refreshInviteCard();
    assert.strictEqual(inviteState(invitePage), 'open');
    invitePage.minimizeInviteCard();
    assert.strictEqual(inviteState(invitePage), 'min');
    invitePage.localStorage.removeItem('btc_invite_auto_' + invitePage._uid);
    invitePage.refreshInviteCard();
    assert.strictEqual(inviteState(invitePage), 'min');
});

Promise.all(pendingTests).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
