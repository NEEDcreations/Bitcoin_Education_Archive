// Invite tiers. One name list so a rename is a single edit.
// This file is the copy Cloud Functions deploy. build.sh copies it to the
// site root for the browser. The count is users.referralMaxiCount, written
// only by Cloud Functions and the backfill script. This file never writes Firestore.
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module && module.exports) module.exports = api;
    if (root) root.referralTiers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Maxi rank on the public ladder (ranking.js / rewardNotify). Higher ranks
    // still count: they hold Maxi and above.
    var MAXI_RANK_POINTS = 2140;

    // level is the tier index. min is confirmed referees at Maxi rank.
    // Levels 1–5 are also the referral badges. XP is the standard badge scale
    // (bronze through diamond). Platinum and Diamond pay orange tickets.
    var TIERS = Object.freeze([
        Object.freeze({ level: 0, min: 0, name: 'Attendee', emoji: '🎟️' }),
        Object.freeze({ level: 1, min: 1, name: 'Meetup Regular', emoji: '🍻', badgeId: 'referral_1', metal: 'bronze', xp: 10, tickets: 0 }),
        Object.freeze({ level: 2, min: 10, name: 'Meetup Organizer', emoji: '📋', badgeId: 'referral_10', metal: 'silver', xp: 50, tickets: 0 }),
        Object.freeze({ level: 3, min: 25, name: 'Conference Speaker', emoji: '🎤', badgeId: 'referral_25', metal: 'gold', xp: 150, tickets: 0 }),
        Object.freeze({ level: 4, min: 50, name: 'Conference Host', emoji: '🏟️', badgeId: 'referral_50', metal: 'platinum', xp: 500, tickets: 5 }),
        Object.freeze({ level: 5, min: 100, name: 'Keynote Legend', emoji: '🏆', badgeId: 'referral_100', metal: 'diamond', xp: 2000, tickets: 25 })
    ]);

    // Retired. Awarded on lifetime referralCount >= 5. Not a meetup tier.
    var RETIRED_BADGES = Object.freeze([
        Object.freeze({ id: 'referral_5', min: 5 })
    ]);

    function normalizeCount(value) {
        if (value == null || value === '') return 0;
        var n = Math.floor(Number(value));
        if (!isFinite(n) || n < 0) return 0;
        return n;
    }

    function tierForCount(count) {
        var n = normalizeCount(count);
        var tier = TIERS[0];
        var i;
        for (i = 0; i < TIERS.length; i++) {
            if (n >= TIERS[i].min) tier = TIERS[i];
        }
        return tier;
    }

    function nextTier(tier) {
        var i;
        for (i = 0; i < TIERS.length; i++) {
            if (TIERS[i].level === tier.level + 1) return TIERS[i];
        }
        return null;
    }

    function activityPoints(user) {
        var points = Math.floor(Number(user && user.points) || 0);
        var scholar = Math.floor(Number(user && user.scholarPoints) || 0);
        if (!isFinite(points) || points < 0) points = 0;
        if (!isFinite(scholar) || scholar < 0) scholar = 0;
        return Math.max(0, points - scholar);
    }

    function countText(n) {
        return n === 1 ? '1 earned 2,140' : n + ' earned 2,140';
    }

    function tierProgress(count) {
        var n = normalizeCount(count);
        var tier = tierForCount(n);
        var next = nextTier(tier);
        var progressText = next ? (n + '/' + next.min + ' to ' + next.name) : 'Max level';
        return {
            count: n,
            level: tier.level,
            tier: tier,
            next: next,
            maxed: !next,
            tierLabel: tier.emoji + ' ' + tier.name,
            countText: countText(n),
            progressText: progressText
        };
    }

    // Same bar the payout uses: points minus Scholar exam points.
    function holdsMaxiRank(user) {
        if (!user) return false;
        return activityPoints(user) >= MAXI_RANK_POINTS;
    }

    function maxiCountHelp(invited, reached) {
        var points = String(MAXI_RANK_POINTS).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        var inv = Math.floor(Number(invited));
        if (!isFinite(inv) || inv < 0) inv = 0;
        var got = Math.floor(Number(reached));
        if (!isFinite(got) || got < 0) got = 0;
        var people = inv === 1 ? "You've invited 1 person." : "You've invited " + inv + " people.";
        var rank = (got === 1 ? '1 earned' : got + ' earned') + ' ' + points + ' points outside the Scholar exam.';
        return people + ' ' + rank + ' Only those referrals count.';
    }

    function badgeTiers() {
        var out = [];
        var i;
        for (i = 0; i < TIERS.length; i++) {
            if (TIERS[i].badgeId) out.push(TIERS[i]);
        }
        return out;
    }

    function badgeIds() {
        return badgeTiers().map(function (tier) { return tier.badgeId; });
    }

    function badgeById(id) {
        var list = badgeTiers();
        var i;
        for (i = 0; i < list.length; i++) {
            if (list[i].badgeId === id) return list[i];
        }
        return null;
    }

    // Read-only impact. rows are { maxiCount, lifetimeCount, held }.
    // held is a map of badge id to true. Counts only; no ids.
    function badgeImpact(rows) {
        var badges = badgeTiers();
        var gain = {};
        var loseIfRevoked = {};
        var already = {};
        var i;
        for (i = 0; i < badges.length; i++) {
            gain[badges[i].badgeId] = 0;
            loseIfRevoked[badges[i].badgeId] = 0;
            already[badges[i].badgeId] = 0;
        }
        var retiredHeld = 0;
        var list = rows || [];
        for (i = 0; i < list.length; i++) {
            var row = list[i] || {};
            var maxi = normalizeCount(row.maxiCount);
            var held = row.held || {};
            var b;
            for (b = 0; b < badges.length; b++) {
                var badge = badges[b];
                var has = held[badge.badgeId] === true;
                var qualifies = maxi >= badge.min;
                if (qualifies && !has) gain[badge.badgeId] += 1;
                else if (has && !qualifies) loseIfRevoked[badge.badgeId] += 1;
                else if (has && qualifies) already[badge.badgeId] += 1;
            }
            if (held.referral_5 === true) retiredHeld += 1;
        }
        return {
            gain: gain,
            loseIfRevoked: loseIfRevoked,
            already: already,
            retiredHeld: retiredHeld
        };
    }

    // Why the referrer's live count has to be recomputed from a users/{uid}
    // write. The referral doc is not written again when the referee later
    // reaches Maxi, is banned, is deleted, or is sats-disabled.
    function recountReasons(before, after) {
        if (!after) return ['deleted'];
        var prev = before || {};
        var reasons = [];
        var wasMaxi = holdsMaxiRank(prev);
        var nowMaxi = holdsMaxiRank(after);
        if (wasMaxi !== nowMaxi) reasons.push(nowMaxi ? 'reached-maxi' : 'left-maxi');
        if ((prev.banned === true) !== (after.banned === true)) reasons.push(after.banned === true ? 'banned' : 'unbanned');
        if ((prev.satsDisabled === true) !== (after.satsDisabled === true)) reasons.push(after.satsDisabled === true ? 'sats-disabled' : 'sats-enabled');
        if ((prev.referralVerified === true) !== (after.referralVerified === true)) reasons.push('referral-verified');
        return reasons;
    }

    function referredUidOf(referral) {
        if (!referral) return '';
        return String(referral.referredUid || referral.referredUserUid || referral.referredUser || referral.id || '');
    }

    // The paid + verified + ticketsAwarded stamp is written only by
    // payIfQualified, after dedupe (one doc per referee), the same-device
    // fingerprint check, and the signup IP HMAC check. Clients cannot write
    // referral docs. A doc missing any stamp is not credited.
    function creditedReferral(referral) {
        if (!referral) return false;
        return referral.status === 'paid' && referral.verified === true && referral.ticketsAwarded === true;
    }

    // Live exclusions. A credited referee who is later banned, sats-disabled,
    // ledger-banned, deleted, or below Maxi no longer counts.
    function refereeBlocked(user, ledger) {
        if (!user || user.deleted === true) return true;
        if (user.banned === true) return true;
        if (user.satsDisabled === true) return true;
        if (user.ledgerBanned === true) return true;
        if (ledger && ledger.banned === true) return true;
        return false;
    }

    function countsForLevel(referral, referee, ledger) {
        if (!creditedReferral(referral)) return false;
        var id = referredUidOf(referral);
        if (!id) return false;
        if (referral.referrerUid && id === String(referral.referrerUid)) return false;
        if (refereeBlocked(referee, ledger)) return false;
        if (!holdsMaxiRank(referee)) return false;
        return true;
    }

    function countCreditedMaxi(rows) {
        var seen = {};
        var n = 0;
        var list = rows || [];
        var i;
        for (i = 0; i < list.length; i++) {
            var row = list[i] || {};
            var referral = row.referral || row;
            var id = referredUidOf(referral);
            if (!id || seen[id]) continue;
            if (!countsForLevel(referral, row.referee, row.ledger)) continue;
            seen[id] = true;
            n++;
        }
        return n;
    }

    // Dry-run planner. `users` need uid, points, ban flags, and the stored
    // referralMaxiCount when present. `ledgers` is { uid: { banned } }.
    // Writes are the only docs whose stored count would change. No ids are
    // required in the summary.
    function planMaxiCountWrites(input) {
        var src = input || {};
        var users = src.users || [];
        var ledgers = src.ledgers || {};
        var byUid = {};
        var i;
        for (i = 0; i < users.length; i++) {
            if (users[i] && users[i].uid) byUid[users[i].uid] = users[i];
        }
        var grouped = {};
        var referrals = src.referrals || [];
        for (i = 0; i < referrals.length; i++) {
            var referral = referrals[i];
            if (!referral) continue;
            var referrerUid = String(referral.referrerUid || '');
            if (!referrerUid) continue;
            if (!grouped[referrerUid]) grouped[referrerUid] = [];
            var referredUid = referredUidOf(referral);
            grouped[referrerUid].push({
                referral: referral,
                referee: referredUid && byUid[referredUid] ? byUid[referredUid] : null,
                ledger: referredUid && ledgers[referredUid] ? ledgers[referredUid] : null
            });
        }
        var writes = [];
        var seenReferrer = {};
        var tiers = [0, 0, 0, 0, 0, 0];
        var missingReferrer = 0;
        var referrerIds = Object.keys(grouped);
        for (i = 0; i < referrerIds.length; i++) {
            var id = referrerIds[i];
            seenReferrer[id] = true;
            var count = countCreditedMaxi(grouped[id]);
            var level = tierForCount(count).level;
            tiers[level] += 1;
            var storedUser = byUid[id];
            if (!storedUser) {
                missingReferrer++;
                continue;
            }
            var stored = Object.prototype.hasOwnProperty.call(storedUser, 'referralMaxiCount')
                ? storedUser.referralMaxiCount
                : null;
            if (stored === count) continue;
            if ((stored === undefined || stored === null) && count === 0) continue;
            writes.push({
                uid: id,
                from: stored == null ? null : Number(stored),
                to: count
            });
        }
        for (i = 0; i < users.length; i++) {
            var user = users[i];
            if (!user || !user.uid || seenReferrer[user.uid]) continue;
            if (!Object.prototype.hasOwnProperty.call(user, 'referralMaxiCount')) continue;
            if (user.referralMaxiCount == null) continue;
            if (Number(user.referralMaxiCount) === 0) continue;
            writes.push({
                uid: user.uid,
                from: Number(user.referralMaxiCount),
                to: 0
            });
            tiers[0] += 1;
        }
        return {
            writes: writes,
            summary: {
                referralDocs: referrals.length,
                referrers: referrerIds.length,
                missingReferrer: missingReferrer,
                writes: writes.length,
                tiers: tiers
            }
        };
    }

    return {
        MAXI_RANK_POINTS: MAXI_RANK_POINTS,
        TIERS: TIERS,
        normalizeCount: normalizeCount,
        tierForCount: tierForCount,
        tierProgress: tierProgress,
        activityPoints: activityPoints,
        holdsMaxiRank: holdsMaxiRank,
        maxiCountHelp: maxiCountHelp,
        badgeTiers: badgeTiers,
        badgeIds: badgeIds,
        badgeById: badgeById,
        badgeImpact: badgeImpact,
        RETIRED_BADGES: RETIRED_BADGES,
        recountReasons: recountReasons,
        referredUidOf: referredUidOf,
        creditedReferral: creditedReferral,
        refereeBlocked: refereeBlocked,
        countsForLevel: countsForLevel,
        countCreditedMaxi: countCreditedMaxi,
        planMaxiCountWrites: planMaxiCountWrites
    };
});
