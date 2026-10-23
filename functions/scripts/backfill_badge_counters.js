#!/usr/bin/env node
/**
 * Raise the new badge counters from records that already exist, then write
 * the badge rows those counters unlock. Dry-run is the default. --apply writes.
 *
 * Skips banned users (rewardBlocked: ban_reason, banned, satsDisabled,
 * faucet_ledger.banned). Never writes points, weeklyXP, monthlyXP,
 * daily_points, or Satoshi's Favor. Badge rows store xp 0. The report's XP
 * figure is the catalog amount those new badges are worth, not a payout.
 *
 * Counters only move up, so a second run is a no-op. peersAtL3 counts each
 * existing peerRelationships doc already at Routing Nodes (level >= 3, which
 * is 21 gifts). onboardingComplete is set when nachoQuestDone is already true.
 *
 *   node functions/scripts/backfill_badge_counters.js
 *   node functions/scripts/backfill_badge_counters.js --apply
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
        'Usage: node functions/scripts/backfill_badge_counters.js [--apply]',
        '',
        'Dry-run prints users, banned skips, counter raises, badges, and the',
        'catalog XP those badges are worth. --apply writes counters and badge',
        'rows only. It does not write points or Favor.',
    ].join('\n');
}

function parseArgs(argv) {
    return {
        help: argv.indexOf('--help') !== -1 || argv.indexOf('-h') !== -1,
        apply: argv.indexOf('--apply') !== -1,
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

function noteTopic(row, post, nowMs) {
    if (!post || !post.uid) return;
    if (post.isNacho === true || post.hidden === true || post.deleted === true) return;
    if (progress.isMirrorCopy(post)) return;
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
    const byUid = {};
    const seenPeerDay = {};
    const counts = {
        mode: args.apply ? 'apply' : 'dry-run',
        users: 0,
        bannedSkipped: 0,
        usersChanged: 0,
        countersRaised: 0,
        badges: 0,
        xp: 0,
        legacyAwardRows: 0,
        badgesById: {},
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

    await forEachDoc(db.collection('peerRelationships'), function (doc) {
        const data = doc.data() || {};
        const level = relationshipLevel(data);
        const left = data.uid1;
        const right = data.uid2;
        if (!left || !right || left === right) return;
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
        if (!sender || !opener || sender === opener) return;
        const row = ensure(byUid, sender);
        row.giftsSent += 1;
        row.keyPeers[opener] = true;
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
            const post = Object.assign({ channelId: channel.id }, doc.data() || {});
            const row = ensure(byUid, post.uid);
            if (row) noteTopic(row, post, nowMs);
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
            awards.forEach(function (doc) { awardIds[doc.id] = true; });
            const held = [];
            Object.keys(awardIds).forEach(function (id) { held.push(id); });
            profileBadgeIds(user).forEach(function (id) {
                if (held.indexOf(id) === -1) held.push(id);
            });
            const plan = planUser(user, tallyView(row), held);
            const legacy = [];
            BADGE_IDS.forEach(function (id) {
                if (awardIds[id]) return;
                if (profileBadgeIds(user).has(id)) legacy.push(id);
            });
            const raised = Object.keys(plan.patch).length;
            if (!raised && !plan.badges.length && !legacy.length) continue;
            counts.usersChanged += 1;
            counts.countersRaised += raised;
            counts.badges += plan.badges.length;
            counts.xp += plan.xp;
            counts.legacyAwardRows += legacy.length;
            plan.badges.forEach(function (id) {
                counts.badgesById[id] = (counts.badgesById[id] || 0) + 1;
            });
            if (!args.apply) continue;
            const update = Object.assign({}, plan.patch);
            POINT_FIELDS && Object.keys(POINT_FIELDS).forEach(function (key) {
                if (Object.prototype.hasOwnProperty.call(update, key)) {
                    throw new Error('refusing to write ' + key);
                }
            });
            if (plan.badges.length) {
                update.visibleBadges = admin.firestore.FieldValue.arrayUnion.apply(null, plan.badges);
                let paying = 0;
                plan.badges.forEach(function (id) {
                    if ((badgeRules.xpOf(id) || 0) > 0) paying += 1;
                });
                if (paying) update.payingBadgeCount = admin.firestore.FieldValue.increment(paying);
            }
            if (Object.keys(update).length) {
                batch.update(userDoc.ref, update);
                pending += 1;
            }
            plan.badges.forEach(function (id) {
                queue(userDoc.ref.collection('badge_awards').doc(id), {
                    awardedAt: admin.firestore.FieldValue.serverTimestamp(),
                    badge: id,
                    xp: 0,
                    requestedXp: badgeRules.xpOf(id) || 0,
                    day: day,
                    source: 'counter_backfill',
                });
            });
            legacy.forEach(function (id) {
                queue(userDoc.ref.collection('badge_awards').doc(id), {
                    awardedAt: admin.firestore.FieldValue.serverTimestamp(),
                    badge: id,
                    xp: 0,
                    requestedXp: 0,
                    day: day,
                    source: 'counter_backfill_legacy',
                });
            });
            if (pending >= 400) await flush();
        }
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    await flush();

    console.log('[backfill-counters] users ' + counts.users);
    console.log('[backfill-counters] banned skipped ' + counts.bannedSkipped);
    console.log('[backfill-counters] users with changes ' + counts.usersChanged);
    console.log('[backfill-counters] counter fields raised ' + counts.countersRaised);
    console.log('[backfill-counters] badges ' + counts.badges);
    console.log('[backfill-counters] catalog XP not paid ' + counts.xp);
    console.log('[backfill-counters] legacy award rows ' + counts.legacyAwardRows);
    console.log(JSON.stringify(counts));
}

module.exports = {
    planUser: planUser,
    levelForGifts: levelForGifts,
    relationshipLevel: relationshipLevel,
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
