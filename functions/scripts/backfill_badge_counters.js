#!/usr/bin/env node
/**
 * Raise the new badge counters from records that already exist, then write
 * the badge rows those counters unlock. Dry-run is the default. --apply writes.
 *
 * Skips banned users (rewardBlocked: ban_reason, banned, satsDisabled,
 * faucet_ledger.banned). Counters only move up. peersAtL3 counts an existing
 * relationship only when it is already at Routing Nodes (level >= 3, 21 gifts)
 * and the pair passes the live eligibility checks. onboardingComplete is set
 * when nachoQuestDone is already true.
 *
 * Gifts sent count once per send (sendPairId, or sender + recipient + day
 * when the key has no pair id), not once per key. Key and peer counts skip
 * same-person pairs, banned partners, and accounts that fail the live age check.
 *
 * Mature topic posts are marked badgeCounted when applied, and their pending
 * docs are deleted, so creditMatureTopicComments will not count them again.
 * Posts younger than 24 hours are left for that job.
 *
 * Without --pay-xp, badge rows store xp 0 and no points or Favor are written.
 * --pay-xp (only together with --apply) pays each new badge its catalog XP
 * through applyDailyXp({ bypass: true }), writes xp_ledger/{badgeId} with
 * source badge_backfill, and writes the one Favor point plus any rank-up
 * Favor. The live Favor pool is not changed. backfill_badge_xp.js treats
 * that ledger id and xpSource as already paid.
 *
 *   node functions/scripts/backfill_badge_counters.js
 *   node functions/scripts/backfill_badge_counters.js --apply
 *   node functions/scripts/backfill_badge_counters.js --apply --pay-xp
 *
 * This script has not been run.
 */
'use strict';

const { rewardBlocked } = require('../src/cipherClaim');
const badgeRules = require('../src/badgeRules');
const progress = require('../src/badgeProgress');
const { familyFor } = require('../src/grantBadge');
const { offsetDateKey } = require('../src/offsetDay');
const { profileBadgeIds } = require('../src/badgeProfile');
const { applyDailyXp } = require('../src/applyDailyXp');

const PAGE = 200;
const GIFTS_FOR_LEVEL = [0, 1, 21, 44, 144, 210];
const COUNTER_FIELDS = [
    'giftsOpened',
    'giftShoutoutWon',
    'giftsSent',
    'keyPeersDistinct',
    'peerKeyCiphers',
    'cipherFullRing',
    'cipherSatsPaid',
    'cipherBiggestWin',
    'peerBestLevel',
    'peersAtL3',
    'topicComments',
    'shopPurchases',
    'raffleTicketsBought',
    'raffleWins',
    'predTopWeeks',
    'predTopMonths',
    'questDays',
    'tctvWatchDays',
    'onboardingComplete',
    'pushEnabled',
];
const NEW_SETS = { set_oracle: true, set_sovereign: true, set_raffle: true };
const POINT_FIELDS = { points: true, weeklyXP: true, monthlyXP: true, pendingOverflow: true };

function badgeIds() {
    const ids = [];
    COUNTER_FIELDS.forEach(function (field) {
        familyFor(field).forEach(function (id) {
            if (ids.indexOf(id) === -1) ids.push(id);
        });
    });
    if (ids.indexOf('topic_channels_10') === -1) ids.push('topic_channels_10');
    return ids;
}

const BADGE_IDS = badgeIds();

function helpText() {
    return [
        'Usage: node functions/scripts/backfill_badge_counters.js [--apply] [--pay-xp]',
        '',
        'Dry-run prints users, banned skips, counter raises, badges, and XP',
        'for both the unpaid mode and the --pay-xp mode. --apply writes',
        'counters and badge rows. --pay-xp also pays catalog XP and Favor.',
        '--pay-xp does nothing unless --apply is set.',
    ].join('\n');
}

function parseArgs(argv) {
    return {
        help: argv.indexOf('--help') !== -1 || argv.indexOf('-h') !== -1,
        apply: argv.indexOf('--apply') !== -1,
        payXp: argv.indexOf('--pay-xp') !== -1,
    };
}

function levelForGifts(count) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    let level = 1;
    for (let i = 0; i < GIFTS_FOR_LEVEL.length; i++) {
        if (n >= GIFTS_FOR_LEVEL[i]) level = i + 1;
    }
    return level;
}

function relationshipLevel(data) {
    const row = data || {};
    const fromGifts = levelForGifts(row.giftsExchanged);
    const stored = Math.floor(Number(row.level) || 0);
    return Math.max(fromGifts, stored);
}

function accountOf(accounts, uid) {
    const row = accounts && accounts[uid];
    if (!row || !row.user) return null;
    return {
        user: Object.assign({ uid: uid }, row.user),
        ledger: row.ledger || {},
    };
}

// Live key credit: same person, either side banned, or an opener younger
// than 7 days (missing created fails) does not count. Sender age is not
// required there. Peer level uses pairEligible, which checks both ages.
function keyPairCounts(senderUid, openerUid, accounts, nowMs) {
    const sender = accountOf(accounts, senderUid);
    const opener = accountOf(accounts, openerUid);
    if (!sender || !opener) return false;
    if (progress.samePerson(sender.user, opener.user)) return false;
    if (progress.isBanned(sender.user, sender.ledger) || progress.isBanned(opener.user, opener.ledger)) return false;
    if (!progress.accountOldEnough(opener.user, nowMs)) return false;
    return true;
}

function peerPairCounts(leftUid, rightUid, accounts, nowMs) {
    const left = accountOf(accounts, leftUid);
    const right = accountOf(accounts, rightUid);
    if (!left || !right) return false;
    return progress.pairEligible(left.user, left.ledger, right.user, right.ledger, nowMs);
}

function giftSendId(data) {
    const row = data || {};
    const sender = row.sentBy;
    const opener = row.ownerId || row.sentTo;
    if (!sender || !opener || sender === opener) return '';
    if (row.sendPairId) return 'pair:' + row.sendPairId;
    const when = dayOf(row.sentAt) || dayOf(row.consumedAt) || '_undated';
    return 'day:' + sender + ':' + opener + ':' + when;
}

function asSet(value) {
    if (!value) return new Set();
    if (value instanceof Set) return new Set(value);
    if (Array.isArray(value)) return new Set(value);
    return new Set(Object.keys(value));
}

function legacyDecision(user, awardIds, profileIds) {
    const write = [];
    const skipped = [];
    const awards = asSet(awardIds);
    const profile = asSet(profileIds);
    const held = new Set(awards);
    profile.forEach(function (id) { held.add(id); });
    BADGE_IDS.forEach(function (id) {
        if (awards.has(id)) return;
        if (!profile.has(id)) return;
        const rule = badgeRules.ruleFor(id);
        if (!rule || rule.cosmetic || !badgeRules.meets(rule, user, { awardSet: held })) {
            skipped.push(id);
            return;
        }
        write.push(id);
    });
    return { write: write, skipped: skipped };
}

function planBadgePay(user, badgeIds, markerIds, levelContributorIds) {
    const markers = {};
    (markerIds || []).forEach(function (id) { markers[id] = true; });
    const credited = {};
    (levelContributorIds || []).forEach(function (name) { credited[name] = true; });
    const paying = [];
    let xp = 0;
    (badgeIds || []).forEach(function (id) {
        if (!id || markers[id]) return;
        const amount = badgeRules.xpOf(id) || 0;
        if (!(amount > 0)) return;
        paying.push({ badgeId: id, xp: amount });
        xp += amount;
    });
    const before = Number(user && user.points) || 0;
    const levelUps = require('../src/satoshiFavor').planLevelFavor(before, before + xp).filter(function (row) {
        return !credited[row.name];
    });
    let levelFavor = 0;
    levelUps.forEach(function (row) { levelFavor += row.points; });
    return {
        paying: paying,
        xp: xp,
        badgeFavor: paying.length,
        levelUps: levelUps,
        favorPoints: paying.length + levelFavor,
    };
}

function payBadgeIds(planBadges, legacyWrite, settled) {
    const ids = [];
    const seen = {};
    function add(id) {
        if (!id || seen[id]) return;
        seen[id] = true;
        ids.push(id);
    }
    (planBadges || []).forEach(add);
    (legacyWrite || []).forEach(add);
    (settled || []).forEach(add);
    return ids;
}

function catalogXp(ids) {
    let xp = 0;
    (ids || []).forEach(function (id) { xp += badgeRules.xpOf(id) || 0; });
    return xp;
}

function settledUnpaid(awardById, merged, markerIds) {
    const out = [];
    const held = new Set(Object.keys(awardById || {}));
    Object.keys(awardById || {}).forEach(function (id) {
        const row = awardById[id] || {};
        if (row.source !== 'counter_backfill' && row.source !== 'counter_backfill_legacy') return;
        if (row.xpSource === 'badge_backfill' || Number(row.xp) > 0) return;
        if (markerIds && markerIds[id]) return;
        const rule = badgeRules.ruleFor(id);
        if (!rule || rule.cosmetic || !((badgeRules.xpOf(id) || 0) > 0)) return;
        if (!badgeRules.meets(rule, merged, { awardSet: held })) return;
        out.push(id);
    });
    return out;
}

function raiseNumber(user, patch, field, next) {
    const cur = Math.max(0, Math.floor(Number(user[field]) || 0));
    const n = Math.max(0, Math.floor(Number(next) || 0));
    if (n > cur) patch[field] = n;
}

function planUser(user, tally, heldIds) {
    const src = user || {};
    const t = tally || {};
    const patch = {};
    raiseNumber(src, patch, 'giftsOpened', t.giftsOpened);
    raiseNumber(src, patch, 'giftsSent', t.giftsSent);
    raiseNumber(src, patch, 'keyPeersDistinct', t.keyPeersDistinct);
    raiseNumber(src, patch, 'peerKeyCiphers', t.peerKeyCiphers);
    raiseNumber(src, patch, 'cipherSatsPaid', t.cipherSatsPaid);
    raiseNumber(src, patch, 'cipherBiggestWin', t.cipherBiggestWin);
    raiseNumber(src, patch, 'peerBestLevel', t.peerBestLevel);
    raiseNumber(src, patch, 'peersAtL3', t.peersAtL3);
    raiseNumber(src, patch, 'shopPurchases', t.shopPurchases);
    raiseNumber(src, patch, 'raffleTicketsBought', t.raffleTicketsBought);
    raiseNumber(src, patch, 'raffleWins', t.raffleWins);
    raiseNumber(src, patch, 'predTopWeeks', t.predTopWeeks);
    raiseNumber(src, patch, 'predTopMonths', t.predTopMonths);
    raiseNumber(src, patch, 'tctvWatchDays', t.tctvWatchDays);
    raiseNumber(src, patch, 'questDays', t.questDays);
    raiseNumber(src, patch, 'topicComments', t.topicComments);
    if (t.topicChannels && t.topicChannels.length) {
        const have = Array.isArray(src.topicChannelsCommented) ? src.topicChannelsCommented.slice() : [];
        const seen = {};
        have.forEach(function (ch) { seen[ch] = true; });
        let added = false;
        t.topicChannels.forEach(function (ch) {
            if (!ch || seen[ch]) return;
            seen[ch] = true;
            have.push(ch);
            added = true;
        });
        if (added) patch.topicChannelsCommented = have;
    }
    if (t.topicChannelCounts) {
        const counts = Object.assign({}, src.topicChannelCounts || {});
        let changed = false;
        Object.keys(t.topicChannelCounts).forEach(function (ch) {
            const n = Math.max(Math.floor(Number(counts[ch]) || 0), Math.floor(Number(t.topicChannelCounts[ch]) || 0));
            if (n > (Math.floor(Number(counts[ch]) || 0))) {
                counts[ch] = n;
                changed = true;
            }
        });
        if (changed) patch.topicChannelCounts = counts;
    }
    if (src.nachoQuestDone === true && src.onboardingComplete !== true) patch.onboardingComplete = true;
    if (t.pushEnabled === true && src.pushEnabled !== true) patch.pushEnabled = true;

    Object.keys(patch).forEach(function (key) {
        if (POINT_FIELDS[key]) delete patch[key];
    });

    const merged = Object.assign({}, src, patch);
    const held = new Set(heldIds || []);
    const badges = [];
    BADGE_IDS.forEach(function (id) {
        if (held.has(id)) return;
        const rule = badgeRules.ruleFor(id);
        if (!rule || rule.cosmetic) return;
        if (!badgeRules.meets(rule, merged, { awardSet: held })) return;
        badges.push(id);
        held.add(id);
    });
    const fresh = badges.slice();
    Object.keys(badgeRules.SETS).forEach(function (setId) {
        if (held.has(setId)) return;
        const members = badgeRules.SETS[setId] || [];
        const unlockedNow = members.some(function (id) { return fresh.indexOf(id) !== -1; });
        if (!unlockedNow && !NEW_SETS[setId]) return;
        const rule = badgeRules.ruleFor(setId);
        if (!rule || rule.cosmetic) return;
        if (!badgeRules.meets(rule, merged, { awardSet: held })) return;
        badges.push(setId);
        held.add(setId);
    });
    let xp = 0;
    badges.forEach(function (id) { xp += badgeRules.xpOf(id) || 0; });
    return { patch: patch, badges: badges, xp: xp };
}

function msOf(value) {
    return progress.timestampMs(value);
}

function dayOf(value) {
    const ms = msOf(value);
    return ms ? offsetDateKey(ms) : '';
}

function ensure(map, uid) {
    if (!uid) return null;
    if (!map[uid]) {
        map[uid] = {
            giftsOpened: 0,
            giftsSent: 0,
            keyPeers: {},
            peerKeyCiphers: 0,
            cipherSatsPaid: 0,
            cipherBiggestWin: 0,
            peerBestLevel: 0,
            peersAtL3: 0,
            shopPurchases: 0,
            raffleTicketsBought: 0,
            raffleWins: 0,
            predTopWeeks: 0,
            predTopMonths: 0,
            tctvWatchDays: 0,
            questDays: 0,
            topicComments: 0,
            topicChannels: {},
            topicChannelCounts: {},
            topicMarks: {},
            pushEnabled: false,
        };
    }
    return map[uid];
}

function tallyView(row) {
    if (!row) return {};
    const channels = Object.keys(row.topicChannels);
    return {
        giftsOpened: row.giftsOpened,
        giftsSent: row.giftsSent,
        keyPeersDistinct: Object.keys(row.keyPeers).length,
        peerKeyCiphers: row.peerKeyCiphers,
        cipherSatsPaid: row.cipherSatsPaid,
        cipherBiggestWin: row.cipherBiggestWin,
        peerBestLevel: row.peerBestLevel,
        peersAtL3: row.peersAtL3,
        shopPurchases: row.shopPurchases,
        raffleTicketsBought: row.raffleTicketsBought,
        raffleWins: row.raffleWins,
        predTopWeeks: row.predTopWeeks,
        predTopMonths: row.predTopMonths,
        tctvWatchDays: row.tctvWatchDays,
        questDays: row.questDays,
        topicComments: row.topicComments,
        topicChannels: channels,
        topicChannelCounts: row.topicChannelCounts,
        pushEnabled: row.pushEnabled === true,
    };
}

function noteTopic(row, post, nowMs, accounts) {
    if (!post || !post.uid) return;
    if (post.isNacho === true || post.hidden === true || post.deleted === true) return;
    if (progress.isMirrorCopy(post)) return;
    const author = accountOf(accounts, post.uid);
    if (!author || progress.isBanned(author.user, author.ledger)) return;
    const text = String(post.text || '').trim();
    if (text.length < progress.COMMENT_MIN_CHARS) return;
    const created = post.createdAtMs > 0 ? Number(post.createdAtMs) : msOf(post.createdAt);
    if (!(created > 0) || (nowMs - created) < progress.COMMENT_MATURE_MS) return;
    row.topicComments += 1;
    const channel = String(post.channelId || '');
    if (channel) {
        row.topicChannels[channel] = true;
        row.topicChannelCounts[channel] = (row.topicChannelCounts[channel] || 0) + 1;
    }
    // Already credited posts stay in the absolute total. Marking them again
    // would rewrite the same docs on every later run.
    if (post.badgeCounted === true) return;
    const postId = String(post.postId || '');
    if (channel && postId) row.topicMarks[channel + '_' + postId] = { channelId: channel, postId: postId };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(helpText());
        return;
    }
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const nowMs = Date.now();
    const day = offsetDateKey(nowMs);
    const payXp = args.apply && args.payXp;
    const byUid = {};
    const accounts = {};
    const seenPeerDay = {};
    const seenGiftSend = {};
    const counts = {
        mode: args.apply ? (payXp ? 'apply-pay-xp' : 'apply') : 'dry-run',
        payXp: payXp,
        users: 0,
        bannedSkipped: 0,
        usersChanged: 0,
        countersRaised: 0,
        badges: 0,
        xp: 0,
        favorPoints: 0,
        legacyAwardRows: 0,
        legacySkipped: 0,
        legacySkippedIds: [],
        topicPostsMarked: 0,
        badgesById: {},
        favorByFaction: { cyber_hornets: 0, honey_badgers: 0, unaffiliated: 0 },
        unpaid: { users: 0, badges: 0, xp: 0 },
        pay: { users: 0, badges: 0, xp: 0, favorPoints: 0 },
    };

    async function forEachDoc(baseQuery, onDoc) {
        let cursor = null;
        const idField = admin.firestore.FieldPath.documentId();
        while (true) {
            let query = baseQuery.orderBy(idField).limit(PAGE);
            if (cursor) query = query.startAfter(cursor);
            const snap = await query.get();
            if (snap.empty) break;
            for (let i = 0; i < snap.docs.length; i++) await onDoc(snap.docs[i]);
            cursor = snap.docs[snap.docs.length - 1];
            if (snap.size < PAGE) break;
        }
    }

    console.log('[backfill-counters] ' + counts.mode + ' — reading source records');

    await forEachDoc(db.collection('users'), async function (doc) {
        const ledgerSnap = await db.collection('faucet_ledger').doc(doc.id).get();
        accounts[doc.id] = {
            user: doc.data() || {},
            ledger: ledgerSnap.exists ? (ledgerSnap.data() || {}) : {},
        };
    });

    await forEachDoc(db.collection('peerRelationships'), function (doc) {
        const data = doc.data() || {};
        const level = relationshipLevel(data);
        const left = data.uid1;
        const right = data.uid2;
        if (!left || !right || left === right) return;
        if (!peerPairCounts(left, right, accounts, nowMs)) return;
        [left, right].forEach(function (uid) {
            const row = ensure(byUid, uid);
            if (level > row.peerBestLevel) row.peerBestLevel = level;
            if (level >= 3) row.peersAtL3 += 1;
        });
    });

    await forEachDoc(db.collection('gifts'), function (doc) {
        const data = doc.data() || {};
        if (data.status !== 'opened') return;
        const opener = data.openedBy || data.ownerId;
        if (!opener) return;
        ensure(byUid, opener).giftsOpened += 1;
    });

    await forEachDoc(db.collection('keys'), function (doc) {
        const data = doc.data() || {};
        if (data.status !== 'consumed') return;
        const sender = data.sentBy;
        const opener = data.ownerId || data.sentTo;
        if (!keyPairCounts(sender, opener, accounts, nowMs)) return;
        const sendId = giftSendId(data);
        if (sendId && !seenGiftSend[sendId]) {
            seenGiftSend[sendId] = true;
            ensure(byUid, sender).giftsSent += 1;
        }
        ensure(byUid, sender).keyPeers[opener] = true;
        const when = dayOf(data.consumedAt) || dayOf(data.sentAt) || '_undated';
        const mark = opener + '|' + sender + '|' + when;
        if (!seenPeerDay[mark]) {
            seenPeerDay[mark] = true;
            ensure(byUid, opener).peerKeyCiphers += 1;
        }
    });

    await forEachDoc(db.collection('cipher_wins'), function (doc) {
        const data = doc.data() || {};
        if (data.status !== 'paid' || !data.uid) return;
        const row = ensure(byUid, data.uid);
        row.cipherSatsPaid += 1;
        const amount = Math.max(0, Math.floor(Number(data.amount) || 0));
        if (amount > row.cipherBiggestWin) row.cipherBiggestWin = amount;
    });

    await forEachDoc(db.collection('stats'), function (doc) {
        if (!/^raffle_.+_snapshot$/.test(doc.id)) return;
        const data = doc.data() || {};
        if (!data.winnerUid) return;
        ensure(byUid, data.winnerUid).raffleWins += 1;
    });

    await forEachDoc(db.collection('prediction_payouts'), async function (doc) {
        const data = doc.data() || {};
        let period = data.period === 'monthly' || data.period === 'weekly' ? data.period : '';
        if (!period) period = doc.id.indexOf('-M') !== -1 ? 'monthly' : 'weekly';
        const field = period === 'monthly' ? 'predTopMonths' : 'predTopWeeks';
        await forEachDoc(doc.ref.collection('winners'), function (winner) {
            const rowData = winner.data() || {};
            if (rowData.skipped) return;
            if (!(Number(rowData.rank) > 0) && !(Number(rowData.tickets) > 0)) return;
            ensure(byUid, winner.id)[field] += 1;
        });
    });

    const channels = await db.collection('topic_discussions').get();
    for (let c = 0; c < channels.docs.length; c++) {
        const channel = channels.docs[c];
        await forEachDoc(channel.ref.collection('posts'), function (doc) {
            const post = Object.assign({ channelId: channel.id, postId: doc.id }, doc.data() || {});
            const row = ensure(byUid, post.uid);
            if (row) noteTopic(row, post, nowMs, accounts);
        });
    }

    let batch = db.batch();
    let pending = 0;
    async function flush() {
        if (!args.apply || pending === 0) return;
        await batch.commit();
        batch = db.batch();
        pending = 0;
    }
    function queue(ref, data, merge) {
        if (!args.apply) return;
        if (merge) batch.set(ref, data, { merge: true });
        else batch.set(ref, data);
        pending += 1;
    }

    let cursor = null;
    const idField = admin.firestore.FieldPath.documentId();
    while (true) {
        let query = db.collection('users').orderBy(idField).limit(PAGE);
        if (cursor) query = query.startAfter(cursor);
        const snap = await query.get();
        if (snap.empty) break;
        for (let i = 0; i < snap.docs.length; i++) {
            const userDoc = snap.docs[i];
            counts.users += 1;
            const user = userDoc.data() || {};
            const ledgerSnap = await db.collection('faucet_ledger').doc(userDoc.id).get();
            const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
            if (rewardBlocked(user, ledger)) {
                counts.bannedSkipped += 1;
                continue;
            }
            const row = ensure(byUid, userDoc.id);
            const purchases = await userDoc.ref.collection('shop_purchases').get();
            purchases.forEach(function (doc) {
                const data = doc.data() || {};
                row.shopPurchases += 1;
                if (data.type === 'raffle') row.raffleTicketsBought += Math.max(1, Math.floor(Number(data.quantity) || 1));
            });
            const claims = await userDoc.ref.collection('award_claims').get();
            claims.forEach(function (doc) {
                if (doc.id.endsWith('_tctv_watch_ticket')) row.tctvWatchDays += 1;
            });
            const passes = await userDoc.ref.collection('quest_passes').get();
            const questDays = {};
            let undated = false;
            passes.forEach(function (doc) {
                const when = dayOf((doc.data() || {}).at);
                if (when) questDays[when] = true;
                else undated = true;
            });
            row.questDays = Object.keys(questDays).length + (undated ? 1 : 0);
            const devices = await db.collection('push_tokens').doc(userDoc.id).collection('devices').limit(5).get();
            devices.forEach(function (doc) {
                if ((doc.data() || {}).token) row.pushEnabled = true;
            });
            const awards = await userDoc.ref.collection('badge_awards').get();
            const awardIds = {};
            const awardById = {};
            awards.forEach(function (doc) {
                awardIds[doc.id] = true;
                awardById[doc.id] = doc.data() || {};
            });
            const ledgerRows = await userDoc.ref.collection('xp_ledger').get();
            const markerIds = {};
            ledgerRows.forEach(function (doc) { markerIds[doc.id] = true; });
            const contrib = db.collection('satoshiFavor').doc('current').collection('contributors');
            const existingFavor = await contrib
                .orderBy(admin.firestore.FieldPath.documentId())
                .startAt(userDoc.id + '_')
                .endAt(userDoc.id + '_\uf8ff')
                .get();
            const levelContributorIds = [];
            const favorIds = {};
            existingFavor.docs.forEach(function (doc) {
                favorIds[doc.id] = true;
                const prefix = userDoc.id + '_level_';
                if (doc.id.indexOf(prefix) === 0) levelContributorIds.push(doc.id.slice(prefix.length));
            });
            const held = [];
            Object.keys(awardIds).forEach(function (id) { held.push(id); });
            const profileIds = profileBadgeIds(user);
            profileIds.forEach(function (id) {
                if (held.indexOf(id) === -1) held.push(id);
            });
            const plan = planUser(user, tallyView(row), held);
            const legacy = legacyDecision(Object.assign({}, user, plan.patch), awardIds, profileIds);
            const merged = Object.assign({}, user, plan.patch);
            const payIds = payBadgeIds(plan.badges, legacy.write, settledUnpaid(awardById, merged, markerIds));
            const pay = planBadgePay(merged, payIds, Object.keys(markerIds), levelContributorIds);
            const marks = Object.keys(row.topicMarks || {});
            const raised = Object.keys(plan.patch).length;
            const unpaidIds = plan.badges.concat(legacy.write);
            if (unpaidIds.length) {
                counts.unpaid.users += 1;
                counts.unpaid.badges += unpaidIds.length;
                counts.unpaid.xp += catalogXp(unpaidIds);
            }
            let favorWouldWrite = 0;
            pay.paying.forEach(function (item) {
                if (!favorIds[userDoc.id + '_badge_' + item.badgeId]) favorWouldWrite += 1;
            });
            pay.levelUps.forEach(function (rank) { favorWouldWrite += rank.points; });
            if (pay.paying.length) {
                counts.pay.users += 1;
                counts.pay.badges += pay.paying.length;
                counts.pay.xp += pay.xp;
                counts.pay.favorPoints += favorWouldWrite;
            }
            const payingNow = payXp && pay.paying.length;
            if (!raised && !plan.badges.length && !legacy.write.length && !marks.length && !payingNow) continue;
            counts.usersChanged += 1;
            counts.countersRaised += raised;
            counts.badges += unpaidIds.length;
            counts.xp += payXp ? pay.xp : catalogXp(unpaidIds);
            counts.favorPoints += payXp ? favorWouldWrite : 0;
            counts.legacyAwardRows += legacy.write.length;
            counts.legacySkipped += legacy.skipped.length;
            legacy.skipped.forEach(function (id) {
                counts.legacySkippedIds.push(userDoc.id + ':' + id);
            });
            counts.topicPostsMarked += marks.length;
            unpaidIds.forEach(function (id) {
                counts.badgesById[id] = (counts.badgesById[id] || 0) + 1;
            });
            if (!args.apply) continue;
            const update = Object.assign({}, plan.patch);
            Object.keys(POINT_FIELDS).forEach(function (key) {
                if (Object.prototype.hasOwnProperty.call(update, key)) {
                    throw new Error('refusing to write ' + key);
                }
            });
            if (plan.badges.length) {
                update.visibleBadges = admin.firestore.FieldValue.arrayUnion.apply(null, plan.badges);
                let payingBadges = 0;
                plan.badges.forEach(function (id) {
                    if ((badgeRules.xpOf(id) || 0) > 0) payingBadges += 1;
                });
                if (payingBadges) update.payingBadgeCount = admin.firestore.FieldValue.increment(payingBadges);
            }
            if (payXp && pay.xp > 0) update.points = admin.firestore.FieldValue.increment(pay.xp);
            if (Object.keys(update).length) {
                batch.update(userDoc.ref, update);
                pending += 1;
            }
            const paidXp = {};
            pay.paying.forEach(function (item) { paidXp[item.badgeId] = item.xp; });
            plan.badges.forEach(function (id) {
                const amount = payXp && paidXp[id] ? paidXp[id] : 0;
                const award = {
                    awardedAt: admin.firestore.FieldValue.serverTimestamp(),
                    badge: id,
                    xp: amount,
                    requestedXp: badgeRules.xpOf(id) || 0,
                    day: day,
                    source: 'counter_backfill',
                };
                if (amount > 0) award.xpSource = 'badge_backfill';
                queue(userDoc.ref.collection('badge_awards').doc(id), award);
            });
            legacy.write.forEach(function (id) {
                const amount = payXp && paidXp[id] ? paidXp[id] : 0;
                const award = {
                    awardedAt: admin.firestore.FieldValue.serverTimestamp(),
                    badge: id,
                    xp: amount,
                    requestedXp: badgeRules.xpOf(id) || 0,
                    day: day,
                    source: 'counter_backfill_legacy',
                };
                if (amount > 0) award.xpSource = 'badge_backfill';
                queue(userDoc.ref.collection('badge_awards').doc(id), award);
            });
            if (payXp) {
                for (let p = 0; p < pay.paying.length; p++) {
                    const grant = await applyDailyXp(userDoc.id, pay.paying[p].xp, null, { bypass: true });
                    if (!grant.bypass || grant.awarded !== pay.paying[p].xp) {
                        throw new Error('badge backfill must bypass the daily cap');
                    }
                }
                const faction = user.faction === 'cyber_hornets' || user.faction === 'honey_badgers' ? user.faction : null;
                const bucket = faction || 'unaffiliated';
                let favorWritten = 0;
                for (let p = 0; p < pay.paying.length; p++) {
                    const item = pay.paying[p];
                    if (plan.badges.indexOf(item.badgeId) === -1 && legacy.write.indexOf(item.badgeId) === -1) {
                        queue(userDoc.ref.collection('badge_awards').doc(item.badgeId), {
                            xp: item.xp,
                            requestedXp: item.xp,
                            xpSource: 'badge_backfill',
                        }, true);
                    }
                    queue(userDoc.ref.collection('xp_ledger').doc(item.badgeId), {
                        source: 'badge_backfill',
                        tag: 'badge_xp_backfill',
                        badgeId: item.badgeId,
                        amount: item.xp,
                        xp: item.xp,
                        requested: item.xp,
                        awarded: item.xp,
                        uid: userDoc.id,
                        day: day,
                        createdAtMs: nowMs,
                    });
                    const favorId = userDoc.id + '_badge_' + item.badgeId;
                    if (!favorIds[favorId]) {
                        queue(contrib.doc(favorId), {
                            uid: userDoc.id,
                            source: 'badge_earned',
                            detail: item.badgeId,
                            badgeId: item.badgeId,
                            day: day,
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            faction: faction,
                            pointsAdded: 1,
                            backfill: true,
                        });
                        favorWritten += 1;
                        counts.favorByFaction[bucket] += 1;
                    }
                    if (pending >= 400) await flush();
                }
                for (let r = 0; r < pay.levelUps.length; r++) {
                    const rank = pay.levelUps[r];
                    queue(contrib.doc(userDoc.id + '_level_' + rank.name), {
                        uid: userDoc.id,
                        source: rank.source,
                        detail: rank.name,
                        pointsAdded: rank.points,
                        faction: faction,
                        backfill: true,
                        tag: 'badge_xp_backfill',
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    favorWritten += rank.points;
                    counts.favorByFaction[bucket] += rank.points;
                }
                if (favorWritten > 0) {
                    queue(db.collection('satoshiFavor').doc('userSfPoints').collection('users').doc(userDoc.id), {
                        uid: userDoc.id,
                        points: admin.firestore.FieldValue.increment(favorWritten),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, true);
                }
            }
            for (let m = 0; m < marks.length; m++) {
                const key = marks[m];
                const mark = row.topicMarks[key];
                queue(db.collection('topic_discussions').doc(mark.channelId).collection('posts').doc(mark.postId), {
                    badgeCounted: true,
                }, true);
                batch.delete(db.collection('topic_comment_pending').doc(key));
                pending += 1;
                if (pending >= 400) await flush();
            }
            if (pending >= 400) await flush();
        }
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    await flush();
    if (payXp) {
        const totals = { lastUpdated: admin.firestore.FieldValue.serverTimestamp() };
        let any = false;
        ['cyber_hornets', 'honey_badgers', 'unaffiliated'].forEach(function (bucket) {
            if (counts.favorByFaction[bucket] > 0) {
                totals[bucket] = admin.firestore.FieldValue.increment(counts.favorByFaction[bucket]);
                any = true;
            }
        });
        if (any) await db.collection('satoshiFavor').doc('factionTotals').set(totals, { merge: true });
    }

    console.log('[backfill-counters] users ' + counts.users);
    console.log('[backfill-counters] banned skipped ' + counts.bannedSkipped);
    console.log('[backfill-counters] users with changes ' + counts.usersChanged);
    console.log('[backfill-counters] counter fields raised ' + counts.countersRaised);
    console.log('[backfill-counters] legacy award rows ' + counts.legacyAwardRows);
    console.log('[backfill-counters] legacy skipped ' + counts.legacySkipped);
    console.log('[backfill-counters] topic posts marked ' + counts.topicPostsMarked);
    console.log('[backfill-counters] unpaid mode users ' + counts.unpaid.users + ' badges ' + counts.unpaid.badges + ' xp ' + counts.unpaid.xp);
    console.log('[backfill-counters] pay-xp mode users ' + counts.pay.users + ' badges ' + counts.pay.badges + ' xp ' + counts.pay.xp + ' favor ' + counts.pay.favorPoints);
    console.log(JSON.stringify(counts));
}

module.exports = {
    planUser: planUser,
    levelForGifts: levelForGifts,
    relationshipLevel: relationshipLevel,
    giftSendId: giftSendId,
    keyPairCounts: keyPairCounts,
    peerPairCounts: peerPairCounts,
    legacyDecision: legacyDecision,
    planBadgePay: planBadgePay,
    settledUnpaid: settledUnpaid,
    payBadgeIds: payBadgeIds,
    noteTopic: noteTopic,
    BADGE_IDS: BADGE_IDS,
    NEW_SETS: NEW_SETS,
};

if (require.main === module) {
    main().then(function () {
        process.exit(0);
    }).catch(function (err) {
        console.error(err && err.stack ? err.stack : err);
        process.exit(1);
    });
}
