// Referral decisions and the dry-run backfill planner. No Firebase.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const referrals = require('../functions/src/referrals');

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
    const referred = user('pleb0001XXXX', { points: 2140 });
    const referrer = user('refcode0REFR', { referralCode: 'refcode0' });
    const pending = { status: 'pending', ticketsAwarded: false, referrerUid: referrer.uid };
    const pay = referrals.assessReferralPayout({ referral: pending, referred: referred, referrer: referrer });
    assert.strictEqual(pay.action, 'pay');
    assert.strictEqual(pay.ticketsEach, 50);

    const flagged = referrals.assessReferralPayout({
        referral: Object.assign({}, pending, { status: 'flagged' }),
        referred: referred,
        referrer: referrer,
    });
    assert.strictEqual(flagged.action, 'skip');

    const sameDevice = referrals.assessReferralPayout({
        referral: pending,
        referred: Object.assign({}, referred, { fingerprint: 'device-1' }),
        referrer: Object.assign({}, referrer, { fingerprint: 'device-1' }),
    });
    assert.strictEqual(sameDevice.action, 'flag');
    assert.notStrictEqual(sameDevice.action, 'pay');

    const self = referrals.assessReferralPayout({
        referral: pending,
        referred: referred,
        referrer: Object.assign({}, referrer, { uid: referred.uid }),
    });
    assert.strictEqual(self.action, 'reject');

    const banned = referrals.assessReferralPayout({
        referral: pending,
        referred: Object.assign({}, referred, { satsDisabled: true }),
        referrer: referrer,
    });
    assert.strictEqual(banned.action, 'reject');
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

test('backfill creates the 7 missing records and pays the 6 at Maxi', () => {
    const data = fixture();
    assert.strictEqual(data.users.filter(function(u) { return u.referredBy; }).length, 25);
    assert.strictEqual(data.referrals.length, 18);
    const plan = referrals.planBackfill(data);
    assert.strictEqual(plan.counts.referralRecordsToCreate, 7);
    assert.strictEqual(plan.counts.maxiPayouts, 6);
    assert.strictEqual(plan.counts.ticketGrants, 12);
    assert.strictEqual(plan.counts.notifications, 12);
    assert.ok(plan.counts.referralCodesToBackfill > 0);
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
    assert.ok(src.indexOf('dry-run only') !== -1);
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    assert.ok(rules.indexOf("'referredBy'") !== -1);
    assert.ok(rules.indexOf("'doubleXpUntil'") !== -1);
    assert.ok(rules.indexOf('allow create: if false;') !== -1);
});

test('home card uses the stored referral code and does not query referrals', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const tickets = fs.readFileSync(path.join(__dirname, '..', 'tickets.js'), 'utf8');
    assert.ok(html.includes('When a friend you invite reaches Maxi rank, you BOTH get 50 orange tickets'));
    assert.ok(html.includes('One link. Two winners. Send it to someone who\'s ready to learn Bitcoin.'));
    assert.ok(html.includes('id="referFriendCard"'));
    assert.ok(html.includes('Sign in to get your link'));
    assert.ok(html.includes('onclick="openReferFriend()"'));
    assert.ok(html.includes('onclick="copyReferFriendLink()"'));
    assert.ok(html.includes('onclick="shareReferFriendLink()"'));
    assert.ok(html.includes('id="referFriendLink"'));
    const cardAt = html.indexOf('id="referFriendCard"');
    const featuredAt = html.indexOf('As Featured On');
    assert.ok(cardAt > 0 && featuredAt > cardAt);
    assert.ok(/\.refer-friend-panel\s*\{[^}]*position:\s*fixed/.test(html));
    assert.ok(/\.refer-friend-panel\s*\{[^}]*display:\s*none/.test(html));
    assert.ok(/\.refer-friend-hint\s*\{[^}]*height:\s*1\.25em/.test(html));
    assert.ok(tickets.includes('function getReferralCode'));
    assert.ok(tickets.includes('user.referralCode'));
    assert.ok(tickets.includes('/^[A-Za-z0-9]{6,28}$/'));
    assert.ok(tickets.includes('function getReferralLink'));
    assert.ok(tickets.includes('Copied!'));
    assert.ok(tickets.includes('navigator.share'));
    assert.ok(tickets.includes('referralCount'));
    assert.ok(tickets.includes('referralTicketsEarned'));
    assert.ok(tickets.includes('Tap for your personal link'));
    assert.ok(tickets.includes('showUsernamePrompt'));
    const openStart = tickets.indexOf('function openReferFriend');
    const openEnd = tickets.indexOf('function closeReferFriend');
    const openBody = tickets.slice(openStart, openEnd);
    assert.ok(openBody.indexOf('getReferralStats') === -1);
    assert.ok(openBody.indexOf('getReferralLink') !== -1);
    const copyStart = tickets.indexOf('function copyReferFriendLink');
    const copyEnd = tickets.indexOf('function shareReferFriendLink');
    const copyBody = tickets.slice(copyStart, copyEnd);
    assert.ok(copyBody.indexOf("execCommand('copy')") !== -1);
    assert.ok(copyBody.indexOf("execCommand('copy')") < copyBody.indexOf('navigator.clipboard.writeText'));
    const service = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'referralService.js'), 'utf8');
    assert.ok(service.includes('rewardNotify.plan'));
    assert.ok(service.includes("onceKey: 'referral_out_'"));
    assert.ok(service.includes("onceKey: 'referral_in_'"));
    assert.ok(service.includes("sourceLabel: 'a referral reaching Maxi'"));
    assert.ok(service.includes("sourceLabel: 'reaching Maxi with a referral'"));
    assert.ok(service.indexOf("collection('notifications')") === -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
