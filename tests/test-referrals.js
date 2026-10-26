// Referral decisions and the dry-run backfill planner. No Firebase.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const referrals = require('../functions/src/referrals');
const ipHmac = require('../functions/src/ipHmac');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
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

    const sameFingerprint = referrals.assessReferralPayout(payoutInput(
        Object.assign({}, referred, { fingerprint: 'device-1' }),
        Object.assign({}, referrer, { fingerprint: 'device-1' }),
        pending
    ));
    assert.strictEqual(sameFingerprint.action, 'flag');
    assert.ok(sameFingerprint.flags.indexOf('same-fingerprint') !== -1);
    assert.notStrictEqual(sameFingerprint.action, 'pay');

    const sameDevice = referrals.assessReferralPayout(payoutInput(
        Object.assign({}, referred, { deviceHmac: 'abc123' }),
        Object.assign({}, referrer, { deviceHmac: 'abc123' }),
        pending
    ));
    assert.strictEqual(sameDevice.action, 'flag');
    assert.ok(sameDevice.flags.indexOf('same-fingerprint') !== -1);
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
    assert.ok(html.includes('When a friend you invite reaches Maxi rank, you both get 50 orange tickets.'));
    assert.ok(html.includes('Share your link. Your friend signs up with it. When they reach Maxi (2,140 XP), you both get 50 orange tickets automatically.'));
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
    assert.ok(scholar.indexOf('planDailyXp(scholarUsed, 2100)') !== -1);
    assert.ok(scholar.indexOf('scholarPoints') !== -1);
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
    assert.ok(privacy.includes('HMAC'));
    assert.ok(privacy.includes('90-day'));
    assert.ok(service.indexOf("collection('notifications')") === -1);
    const terms = fs.readFileSync(path.join(__dirname, '..', 'terms.html'), 'utf8');
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

function heldReferral(since, extra) {
    return Object.assign({
        status: 'held_connection',
        ticketsAwarded: false,
        referrerUid: 'refcode0REFR',
        ipqsHold: { reason: 'vpn', since: since, checkedAt: since },
    }, extra || {});
}

function holdSignal(since, extra) {
    return Object.assign({
        ipqsAction: 'hold',
        ipqsReason: 'vpn',
        ipqsHold: { reason: 'vpn', since: since, checkedAt: since },
        ipqsVpn: true,
        flags: ['ipqs-hold'],
    }, extra || {});
}

test('a vpn hold waits, a clean recheck pays once, and a second pass does not', () => {
    const referred = qualified('pleb0001XXXX');
    const referrer = user('refcode0REFR', { referralCode: 'refcode0' });
    const since = NOW - 2 * 24 * 60 * 60 * 1000;
    const referral = heldReferral(since);
    const signal = holdSignal(since);
    const waiting = referrals.assessReferralPayout(payoutInput(referred, referrer, referral, {
        signal: signal,
        serverVerdict: { action: 'hold', reason: 'vpn' },
    }));
    assert.strictEqual(waiting.action, 'hold');
    assert.strictEqual(waiting.reason, 'vpn');
    assert.notStrictEqual(waiting.action, 'flag');

    const state = {
        referral: Object.assign({}, referral),
        signal: Object.assign({}, signal),
    };
    let paid = 0;
    function settleOnce() {
        const decision = referrals.assessReferralPayout(payoutInput(referred, referrer, state.referral, {
            signal: state.signal,
            serverVerdict: { action: 'allow', reason: 'clean' },
        }));
        if (decision.action === 'pay') {
            state.referral = Object.assign({}, state.referral, { status: 'paid', ticketsAwarded: true });
            state.signal = { ipqsAction: 'allow', ipqsReason: 'clean', flags: [] };
            paid++;
        }
        return decision;
    }
    const first = settleOnce();
    const second = settleOnce();
    assert.strictEqual(first.action, 'pay');
    assert.strictEqual(first.ticketsEach, 50);
    assert.strictEqual(first.clearHold, true);
    assert.strictEqual(second.action, 'skip');
    assert.strictEqual(second.reason, 'already-paid');
    assert.strictEqual(paid, 1);
});

test('a vpn hold that is still a vpn stays waiting', () => {
    const referred = qualified('pleb0001XXXX');
    const referrer = user('refcode0REFR', { referralCode: 'refcode0' });
    const since = NOW - 60 * 60 * 1000;
    const decision = referrals.assessReferralPayout(payoutInput(referred, referrer, heldReferral(since), {
        signal: holdSignal(since),
        serverVerdict: { action: 'hold', reason: 'proxy' },
    }));
    assert.strictEqual(decision.action, 'hold');
    assert.strictEqual(decision.reason, 'proxy');
    assert.strictEqual(decision.ipqsHold.since, since);
});

test('a datacenter deny stays rejected and does not wait', () => {
    const referred = qualified('pleb0001XXXX');
    const referrer = user('refcode0REFR', { referralCode: 'refcode0' });
    const since = NOW - 60 * 60 * 1000;
    const decision = referrals.assessReferralPayout(payoutInput(referred, referrer, heldReferral(since), {
        signal: holdSignal(since),
        serverVerdict: { action: 'deny', reason: 'datacenter' },
    }));
    assert.strictEqual(decision.action, 'reject');
    assert.strictEqual(decision.reason, 'ipqs-deny');
    const signup = referrals.signupConnection(['ipqs-deny'], { action: 'deny', reason: 'datacenter' }, NOW);
    assert.strictEqual(signup.status, 'rejected');
    assert.strictEqual(signup.ipqsHold, null);
});

test('a connection hold expires unpaid after 30 days', () => {
    assert.strictEqual(referrals.CONNECTION_HOLD_MS, 30 * 24 * 60 * 60 * 1000);
    const referred = qualified('pleb0001XXXX');
    const referrer = user('refcode0REFR', { referralCode: 'refcode0' });
    const since = NOW - referrals.CONNECTION_HOLD_MS - 1000;
    const decision = referrals.assessReferralPayout(payoutInput(referred, referrer, heldReferral(since), {
        signal: holdSignal(since),
    }));
    assert.strictEqual(decision.action, 'expire');
    assert.strictEqual(decision.reason, 'connection-hold-expired');
    assert.notStrictEqual(decision.action, 'pay');
    const lateClean = referrals.assessReferralPayout(payoutInput(referred, referrer, heldReferral(since), {
        signal: holdSignal(since),
        serverVerdict: { action: 'allow', reason: 'clean' },
    }));
    assert.strictEqual(lateClean.action, 'expire');
    assert.notStrictEqual(lateClean.action, 'pay');
    const lateDeny = referrals.assessReferralPayout(payoutInput(referred, referrer, heldReferral(since), {
        signal: holdSignal(since),
        serverVerdict: { action: 'deny', reason: 'botnet' },
    }));
    assert.strictEqual(lateDeny.action, 'reject');
    assert.strictEqual(lateDeny.reason, 'ipqs-deny');
});

test('zero credits and a forged client flag do not clear a hold', () => {
    const referred = qualified('pleb0001XXXX');
    const referrer = user('refcode0REFR', { referralCode: 'refcode0' });
    const since = NOW - 2 * 24 * 60 * 60 * 1000;
    const open = referrals.settleConnection({
        nowMs: NOW,
        referral: heldReferral(since),
        signal: holdSignal(since),
        serverVerdict: { action: 'fallback', reason: 'credits' },
        clientClear: true,
        clearHold: true,
    });
    assert.strictEqual(open.effect, 'hold');
    const forged = referrals.assessReferralPayout(payoutInput(referred, referrer, heldReferral(since), {
        signal: holdSignal(since),
        clientClear: true,
        clearHold: true,
    }));
    assert.strictEqual(forged.action, 'hold');
    assert.notStrictEqual(forged.action, 'pay');
    assert.strictEqual(referrals.connectionRecheckDue({ checkedAt: NOW - 60 * 1000 }, NOW), false);
    assert.strictEqual(referrals.connectionRecheckDue({ checkedAt: NOW - referrals.CONNECTION_RECHECK_MS - 1 }, NOW), true);
});

test('a legacy flagged ipqs-hold is waiting, and another flag stays dead', () => {
    const referred = qualified('pleb0001XXXX');
    const referrer = user('refcode0REFR', { referralCode: 'refcode0' });
    const legacy = { status: 'flagged', ticketsAwarded: false, referrerUid: referrer.uid };
    const signal = { flags: ['ipqs-hold'], ipqsAction: 'hold', ipqsReason: 'tor', ipqsTor: true, ipqsCheckedAtMs: NOW - 1000 };
    assert.strictEqual(referrals.isLegacyConnectionHold(legacy, signal), true);
    const decision = referrals.assessReferralPayout(payoutInput(referred, referrer, legacy, { signal: signal }));
    assert.strictEqual(decision.action, 'hold');
    const mixed = referrals.assessReferralPayout(payoutInput(referred, referrer, legacy, {
        signal: { flags: ['ipqs-hold', 'same-fingerprint'], ipqsAction: 'hold', ipqsReason: 'vpn', ipqsVpn: true },
    }));
    assert.strictEqual(mixed.action, 'skip');
    assert.strictEqual(mixed.reason, 'flagged');
});

test('signup keeps a vpn invite pending-for-pay and flags a deny', () => {
    const held = referrals.signupConnection([], { action: 'hold', reason: 'vpn' }, NOW);
    assert.strictEqual(held.status, 'held_connection');
    assert.strictEqual(held.ipqsHold.reason, 'vpn');
    assert.strictEqual(held.ipqsHold.since, NOW);
    const denied = referrals.signupConnection(['ipqs-deny'], { action: 'deny', reason: 'botnet' }, NOW);
    assert.strictEqual(denied.status, 'rejected');
    const service = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'referralService.js'), 'utf8');
    const indexJs = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    assert.ok(service.includes("status === 'held_connection'"));
    assert.ok(service.includes('connectionRecheckDue'));
    assert.ok(service.includes('applyObservation'));
    assert.ok(service.includes('requestIp'));
    assert.ok(service.includes("scanStatus('held_connection'"));
    assert.ok(service.includes('isLegacyConnectionHold'));
    assert.strictEqual(service.includes('clientClear'), false);
    assert.strictEqual(service.includes('data.clearHold'), false);
    const verify = indexJs.slice(indexJs.indexOf('exports.verifyReferral'), indexJs.indexOf('exports.registerReferral'));
    assert.ok(verify.includes('enforceAppCheck: true'));
    assert.ok(verify.includes('requestIp:'));
    assert.ok(verify.includes('final:'));
    assert.strictEqual(verify.includes('data.ip'), false);
    assert.strictEqual(verify.includes('clearHold'), false);
    const claim = indexJs.slice(indexJs.indexOf('exports.claimSats'), indexJs.indexOf('exports.confirmTipSent') === -1 ? indexJs.indexOf('const _lnDomainRaw') : indexJs.indexOf('const _lnDomainRaw'));
    assert.ok(claim.includes('applyObservation: true'));
    assert.ok(claim.includes('serverVerdict: rewardGate.ipVerdict'));
    assert.ok(claim.includes("sendUserPush(noted.referrerUid, 'referrals'"));
    assert.ok(claim.includes('Someone you invited reached Maxi. 50 Orange Tickets were added.'));
    assert.strictEqual(service.includes('if (lookupIp && !liveIpVerdict(freshGate)) checkedAt = Date.now()'), false);
    assert.ok(service.includes('if (live) checkedAt = Number(nextHold.checkedAt) || Date.now()'));
    assert.ok(service.includes('payoutLookupIp'));
    assert.ok(service.includes('blocksUncheckedPay'));
    assert.ok(service.includes('referralCheckIsFinal'));
    assert.ok(service.includes('payoutBudgetReason(freshGate)'));
    const privacy = fs.readFileSync(path.join(__dirname, '..', 'privacy.html'), 'utf8');
    assert.ok(privacy.includes('expires unpaid after 30 days'));
    const terms = fs.readFileSync(path.join(__dirname, '..', 'terms.html'), 'utf8');
    assert.ok(terms.includes('pays automatically once a later check from that friend is a regular connection'));
});

test('opening the app rechecks an unpaid invite and does not gate sign-in', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'tickets.js'), 'utf8');
    const start = src.indexOf('var REFERRAL_RECHECK_MS');
    const end = src.indexOf('function maybeVerifyReferral');
    const shouldVerifyReferral = new Function(src.slice(start, end) + '\nreturn shouldVerifyReferral;')();
    const day = 24 * 60 * 60 * 1000;
    const now = 1_700_000_000_000;
    assert.strictEqual(shouldVerifyReferral({ referredBy: 'abc', referralVerified: false }, 0, now), true);
    assert.strictEqual(shouldVerifyReferral({ referredBy: 'abc' }, 0, now), true);
    assert.strictEqual(shouldVerifyReferral({}, 0, now), false);
    assert.strictEqual(shouldVerifyReferral({ referredBy: '', referralVerified: false }, 0, now), false);
    assert.strictEqual(shouldVerifyReferral({ referredBy: 'abc', referralVerified: true }, 0, now), false);
    assert.strictEqual(shouldVerifyReferral({ referredBy: 'abc', anonymous: true }, 0, now), false);
    assert.strictEqual(shouldVerifyReferral(null, 0, now), false);
    assert.strictEqual(shouldVerifyReferral({ referredBy: 'abc' }, now - day + 1000, now), false);
    assert.strictEqual(shouldVerifyReferral({ referredBy: 'abc' }, now - day - 1, now), true);
    const retry = 5 * 60 * 1000;
    assert.strictEqual(shouldVerifyReferral({ referredBy: 'abc' }, { lastError: now - retry + 1000 }, now), false);
    assert.strictEqual(shouldVerifyReferral({ referredBy: 'abc' }, { lastError: now - retry - 1 }, now), true);
    assert.strictEqual(shouldVerifyReferral({ referredBy: 'abc' }, { final: true }, now), false);
    assert.strictEqual(shouldVerifyReferral({ referredBy: 'abc' }, { lastOk: 0, final: false }, now), true);
    assert.ok(src.includes("httpsCallable('verifyReferral')"));
    assert.ok(src.includes('checkReferralQualifications().catch(function() {})'));
    assert.ok(src.includes('btc_referral_final_'));
    assert.ok(src.includes('btc_referral_retry_'));
    const maybe = src.slice(src.indexOf('function maybeVerifyReferral'), src.indexOf('async function checkReferralQualifications'));
    assert.strictEqual(maybe.includes('await '), false);
    const callAt = maybe.indexOf("httpsCallable('verifyReferral')");
    const writeAt = maybe.indexOf('localStorage.setItem');
    assert.ok(callAt !== -1 && writeAt > callAt);
    assert.ok(maybe.indexOf('!firebase.functions') !== -1 && maybe.indexOf('!firebase.functions') < callAt);
});

test('a ready app-open payout checks the request ip and final invites stop', () => {
    assert.strictEqual(referrals.payoutLookupIp({
        ready: true,
        hold: null,
        legacy: false,
        requestIp: '203.0.113.9',
        checkIp: '198.51.100.1',
        seen: false,
        recheckDue: false,
    }), '203.0.113.9');
    assert.strictEqual(referrals.payoutLookupIp({
        ready: true,
        hold: { reason: 'vpn' },
        requestIp: '203.0.113.9',
        checkIp: '198.51.100.1',
        recheckDue: true,
    }), '203.0.113.9');
    assert.strictEqual(referrals.payoutLookupIp({
        ready: true,
        requestIp: '',
        checkIp: '198.51.100.1',
    }), '198.51.100.1');
    assert.strictEqual(referrals.payoutLookupIp({
        seen: true,
        ready: true,
        requestIp: '203.0.113.9',
        checkIp: '198.51.100.1',
    }), '');
    assert.strictEqual(referrals.payoutLookupIp({
        ready: false,
        requestIp: '203.0.113.9',
        checkIp: '198.51.100.1',
    }), '');
    assert.strictEqual(referrals.blocksUncheckedPay('203.0.113.9', null), true);
    assert.strictEqual(referrals.blocksUncheckedPay('203.0.113.9', { action: 'fallback' }), true);
    assert.strictEqual(referrals.blocksUncheckedPay('203.0.113.9', { action: 'allow' }), false);
    assert.strictEqual(referrals.blocksUncheckedPay('', { action: 'allow' }), false);
    assert.strictEqual(referrals.referralCheckIsFinal({ status: 'rejected' }, {}), true);
    assert.strictEqual(referrals.referralCheckIsFinal({ status: 'expired' }, {}), true);
    assert.strictEqual(referrals.referralCheckIsFinal({ status: 'flagged' }, { flags: ['same-ip'] }), true);
    assert.strictEqual(referrals.referralCheckIsFinal({ status: 'paid' }, {}), true);
    assert.strictEqual(referrals.referralCheckIsFinal({ status: 'pending' }, {}), false);
    assert.strictEqual(referrals.referralCheckIsFinal({ status: 'held_connection' }, {}), false);
    assert.strictEqual(referrals.referralCheckIsFinal({
        status: 'flagged',
    }, {
        flags: ['ipqs-hold'],
        ipqsAction: 'hold',
        ipqsVpn: true,
        ipqsReason: 'vpn',
    }), false);
    const budget = referrals.signupConnection([], null, NOW, { budgetWait: true });
    assert.strictEqual(budget.status, 'held_connection');
    assert.strictEqual(budget.ipqsHold.reason, 'budget');
    assert.strictEqual(budget.ipqsHold.checkedAt, 0);
    assert.strictEqual(referrals.connectionRecheckDue(budget.ipqsHold, NOW + 1000), true);
    const seen = referrals.connectionHoldState({ status: 'held_connection' }, { ipqsHold: budget.ipqsHold });
    assert.strictEqual(seen.reason, 'budget');
    assert.strictEqual(seen.checkedAt, 0);
    const blocked = referrals.signupConnection(['ipqs-deny'], null, NOW, { budgetWait: true });
    assert.strictEqual(blocked.status, 'rejected');
    assert.strictEqual(blocked.ipqsHold, null);
    assert.strictEqual(referrals.payoutBudgetReason({ action: 'hold', reason: 'quota', ipVerdict: null }), 'quota');
    assert.strictEqual(referrals.payoutBudgetReason({ action: 'hold', reason: 'backoff', ipVerdict: null }), 'backoff');
    assert.strictEqual(referrals.payoutBudgetReason({ action: 'hold', reason: 'user-quota', ipVerdict: null }), 'user-quota');
    assert.strictEqual(referrals.payoutBudgetReason({ action: 'allow', reason: 'clean', ipVerdict: { action: 'allow', reason: 'clean' } }), '');
    assert.strictEqual(referrals.payoutBudgetReason({ action: 'hold', reason: 'vpn', ipVerdict: { action: 'hold', reason: 'vpn' } }), '');
    assert.strictEqual(referrals.payoutBudgetReason(null), '');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
