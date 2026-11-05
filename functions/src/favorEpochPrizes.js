'use strict';

// Satoshi's Favor epoch / window sats. Pure helpers only (no Firebase).
// Close writes a breakdown. Nothing pays until an admin types APPROVE <id>.
// Players then claim their own row. Public text never shows a full uid or email.

const { rewardBlocked } = require('./cipherClaim');

const DEFAULTS = {
    epochPotSats: 21000,
    windowWinnerSats: 0,
    minAccountAgeDays: 7,
    manualAboveSats: 5000,
    walletFloorSats: 5000,
    siteDailyCapSats: 100000,
    // 0 = off. Caps one player's sats from one epoch.
    perPersonCapSats: 0,
    // Flag person or LN cluster holding more than this % of the pot.
    clusterFlagPct: 30,
};
const MAX_POT = 1000000;
const MANUAL_ABOVE = 5000;

function num(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function intIn(v, lo, hi, dflt) {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= lo && n <= hi ? n : dflt;
}

function readConfig(data) {
    const d = data || {};
    return {
        epochPotSats: intIn(d.epochPotSats, 0, MAX_POT, DEFAULTS.epochPotSats),
        windowWinnerSats: intIn(d.windowWinnerSats, 0, MAX_POT, DEFAULTS.windowWinnerSats),
        minAccountAgeDays: intIn(d.minAccountAgeDays, 0, 365, DEFAULTS.minAccountAgeDays),
        // Claim-critical caps never exceed the code defaults.
        manualAboveSats: Math.min(intIn(d.manualAboveSats, 1, MAX_POT, DEFAULTS.manualAboveSats), MANUAL_ABOVE),
        walletFloorSats: Math.min(intIn(d.walletFloorSats, 0, MAX_POT, DEFAULTS.walletFloorSats), DEFAULTS.walletFloorSats),
        siteDailyCapSats: Math.min(intIn(d.siteDailyCapSats, 0, MAX_POT, DEFAULTS.siteDailyCapSats), DEFAULTS.siteDailyCapSats),
        perPersonCapSats: intIn(d.perPersonCapSats, 0, MAX_POT, DEFAULTS.perPersonCapSats),
        clusterFlagPct: intIn(d.clusterFlagPct, 1, 100, DEFAULTS.clusterFlagPct),
    };
}

function claimLimits(data) {
    const cfg = readConfig(data);
    return {
        manualAboveSats: cfg.manualAboveSats,
        siteDailyCapSats: cfg.siteDailyCapSats,
        walletFloorSats: cfg.walletFloorSats,
    };
}

function epochIdOf(epochNum) {
    const n = Math.floor(Number(epochNum));
    if (!Number.isFinite(n) || n < 1 || n > 100000000) return '';
    return 'epoch_' + n;
}

function windowIdOf(cycleId) {
    const s = String(cycleId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
    return s ? 'window_' + s : '';
}

function truncateUid(uid) {
    const s = String(uid || '');
    return s.length <= 6 ? s.slice(0, 2) + '…' : s.slice(0, 6) + '…';
}

function publicName(name) {
    const s = String(name || '').replace(/\s+/g, ' ').trim();
    if (!s || s.indexOf('@') !== -1) return 'Anon';
    return s.slice(0, 40);
}

function normalizeLn(addr) {
    return String(addr || '').trim().toLowerCase();
}

function validLn(addr) {
    const a = normalizeLn(addr);
    return a.length >= 5 && a.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a);
}

function maskLn(addr) {
    const a = normalizeLn(addr);
    if (!validLn(a)) return '';
    const at = a.indexOf('@');
    const local = a.slice(0, at);
    const host = a.slice(at);
    const keep = local.slice(0, Math.min(2, local.length));
    return keep + '…' + host;
}

// Why a player gets no auto-approve sats. First match wins.
function exclusionReason(c, cfg, nowMs) {
    const u = c.user;
    if (!u) return 'account deleted';
    if (rewardBlocked(u, c.ledger)) return 'banned or sats disabled';
    if (u.multiAccount === true) return 'flagged multi-account';
    if (num(u.satsHold) > nowMs) return 'sats on hold';
    if (!c.authKnown) return 'account age unknown';
    // L6: age at the uid's first counted block in this epoch.
    const ageAtBlock = Number.isFinite(Number(c.ageDaysAtFirstBlock))
        ? Number(c.ageDaysAtFirstBlock)
        : Number(c.ageDays) || 0;
    if (ageAtBlock < cfg.minAccountAgeDays) {
        return 'account younger than ' + cfg.minAccountAgeDays + ' days at first block';
    }
    if (c.emailVerified !== true) return 'no verified email';
    if (!validLn(c.lightningAddressAtClose)) return 'no lightning address saved before close';
    if (c.addressChangedAfterClose) return 'lightning address changed after close';
    if (c.addressInCooldown) return 'lightning address still in change cooldown';
    if (c.sharedLightning) return 'shared lightning address (manual review)';
    return '';
}

// Live announcement math: floor(pot / blockCount) sats per block.
function satsPerBlock(pot, blockCount) {
    const n = Math.max(0, Math.floor(Number(blockCount) || 0));
    const p = Math.max(0, Math.floor(Number(pot) || 0));
    if (!n || !p) return 0;
    return Math.floor(p / n);
}

// Assign sats by block count. Remainder (pot - perBlock*blocks) stays unallocated
// unless given to earliest block winners via largest-remainder on block units.
function splitByBlocks(pot, blockCounts) {
    // blockCounts: [{ uid, blocks }]
    const rows = (blockCounts || []).map(function (r) {
        return { uid: r.uid, blocks: Math.max(0, Math.floor(Number(r.blocks) || 0)) };
    });
    const totalBlocks = rows.reduce(function (s, r) { return s + r.blocks; }, 0);
    const per = satsPerBlock(pot, totalBlocks);
    const out = rows.map(function (r) { return { uid: r.uid, blocks: r.blocks, sats: per * r.blocks }; });
    let left = pot - per * totalBlocks;
    // Distribute leftover 1 sat at a time to largest block counts, then uid.
    const order = out.slice().sort(function (a, b) {
        return b.blocks - a.blocks || (a.uid < b.uid ? -1 : 1);
    });
    for (let i = 0; left > 0 && order.length; i = (i + 1) % order.length, left--) {
        order[i].sats += 1;
    }
    const byUid = {};
    out.forEach(function (r) { byUid[r.uid] = r.sats; });
    return { perBlock: per, byUid: byUid, totalBlocks: totalBlocks };
}

function applyPersonCap(sats, cap) {
    const a = Math.max(0, Math.floor(Number(sats) || 0));
    const c = Math.max(0, Math.floor(Number(cap) || 0));
    if (!c) return { sats: a, capped: false };
    if (a <= c) return { sats: a, capped: false };
    return { sats: c, capped: true };
}

function clusterLightning(rows) {
    // rows: [{ uid, lightningAddressAtClose, sats }]
    const by = {};
    (rows || []).forEach(function (r) {
        const ln = normalizeLn(r.lightningAddressAtClose || '');
        if (!validLn(ln)) return;
        if (!by[ln]) by[ln] = { addressMasked: maskLn(ln), uids: [], uidShorts: [], sats: 0 };
        by[ln].uids.push(r.uid);
        by[ln].uidShorts.push(r.uidShort || truncateUid(r.uid));
        by[ln].sats += Math.max(0, Math.floor(Number(r.sats) || 0));
    });
    const shared = [];
    const flagged = [];
    Object.keys(by).forEach(function (ln) {
        const c = by[ln];
        c.count = c.uids.length;
        if (c.count > 1) shared.push(Object.assign({ lightningKey: ln }, c));
    });
    return { byAddress: by, shared: shared, flagged: flagged };
}

// blocks: [{ uid, username, value, foundAtMs? }]
// Pay by block count (H1). Shared LN → manual review cluster (H2).
function buildEpochBreakdown(input) {
    const cfg = readConfig(input.config);
    const now = Number(input.nowMs) || Date.now();
    const epochNum = Math.floor(Number(input.epochNumber)) || 0;
    const epochId = epochIdOf(epochNum);
    const blocksIn = Array.isArray(input.blocks) ? input.blocks : [];
    const players = (input.players || []).slice();
    const byPlayer = {};
    players.forEach(function (p) { if (p && p.uid) byPlayer[p.uid] = p; });

    // M3/L6: drop blocks found while the account was under min age.
    const counted = [];
    const youngExcludedBlocks = [];
    blocksIn.forEach(function (b, i) {
        if (!b || !b.uid) return;
        const p = byPlayer[b.uid] || {};
        const createdMs = Number(p.createdMs) || 0;
        const foundMs = Number(b.foundAtMs) || now;
        let ageAtBlock = null;
        if (createdMs > 0 && foundMs >= createdMs) {
            ageAtBlock = Math.floor((foundMs - createdMs) / 86400000);
        } else if (Number.isFinite(Number(p.ageDaysAtFirstBlock))) {
            ageAtBlock = Number(p.ageDaysAtFirstBlock);
        } else if (Number.isFinite(Number(p.ageDays))) {
            ageAtBlock = Number(p.ageDays);
        }
        if (ageAtBlock != null && ageAtBlock < cfg.minAccountAgeDays) {
            youngExcludedBlocks.push({
                uid: String(b.uid),
                uidShort: truncateUid(b.uid),
                username: publicName(b.username),
                blockIndex: i + 1,
                reason: 'block found in first ' + cfg.minAccountAgeDays + ' days',
            });
            return;
        }
        counted.push(Object.assign({}, b, { _i: i + 1, _ageAtBlock: ageAtBlock }));
    });

    const byUid = {};
    counted.forEach(function (b) {
        const uid = String(b.uid);
        if (!byUid[uid]) {
            byUid[uid] = {
                uid: uid,
                username: publicName(b.username),
                blockIndexes: [],
                contribution: 0,
                ageDaysAtFirstBlock: b._ageAtBlock,
            };
        }
        byUid[uid].contribution += 1;
        byUid[uid].blockIndexes.push(b._i);
        if (b.username) byUid[uid].username = publicName(b.username);
        if (b._ageAtBlock != null) {
            const prev = byUid[uid].ageDaysAtFirstBlock;
            byUid[uid].ageDaysAtFirstBlock = prev == null ? b._ageAtBlock : Math.min(prev, b._ageAtBlock);
        }
    });

    const winners = Object.keys(byUid).sort(function (a, b) {
        return byUid[b].contribution - byUid[a].contribution || (a < b ? -1 : 1);
    }).map(function (uid) { return byUid[uid]; });

    // H1: sats by block count against the full counted-block pool.
    const split = splitByBlocks(cfg.epochPotSats, winners.map(function (w) {
        return { uid: w.uid, blocks: w.contribution };
    }));

    // First pass: build rows with provisional sats (before shared-LN strip).
    const provisional = [];
    const excluded = [];
    youngExcludedBlocks.forEach(function (y) {
        // Collapse young-block notes per uid into excluded if they have no counted blocks.
        if (byUid[y.uid]) return;
        if (excluded.some(function (e) { return e.uid === y.uid; })) return;
        excluded.push({
            uid: y.uid,
            uidShort: y.uidShort,
            username: y.username,
            contribution: 0,
            why: 'Block(s) in first ' + cfg.minAccountAgeDays + ' days',
            lightningAddressAtClose: normalizeLn((byPlayer[y.uid] || {}).lightningAddressAtClose || ''),
            reason: y.reason,
            sats: 0,
            sharePct: 0,
        });
    });

    winners.forEach(function (w) {
        const p = byPlayer[w.uid] || {};
        const ln = normalizeLn(p.lightningAddressAtClose || '');
        const c = {
            user: p.user || null,
            ledger: p.ledger || {},
            authKnown: p.authKnown === true,
            ageDays: Number(p.ageDays) || 0,
            ageDaysAtFirstBlock: w.ageDaysAtFirstBlock,
            emailVerified: p.emailVerified === true,
            lightningAddressAtClose: ln,
            addressChangedAfterClose: p.addressChangedAfterClose === true,
            addressInCooldown: p.addressInCooldown === true,
            sharedLightning: false,
        };
        const rawSats = split.byUid[w.uid] || 0;
        const capped = applyPersonCap(rawSats, cfg.perPersonCapSats);
        const reason = exclusionReason(c, cfg, now);
        const row = {
            uid: w.uid,
            uidShort: truncateUid(w.uid),
            username: w.username,
            contribution: w.contribution,
            why: 'Mined block' + (w.blockIndexes.length > 1 ? 's ' : ' ') + w.blockIndexes.join(', ') +
                ' · ' + split.perBlock.toLocaleString('en-US') + ' sats/block',
            lightningAddressAtClose: ln,
            sats: capped.sats,
            capped: capped.capped,
            uncappedSats: rawSats,
        };
        if (reason) excluded.push(Object.assign({}, row, { reason: reason, sats: 0, sharePct: 0 }));
        else provisional.push(row);
    });

    // H2: shared LN address → whole group to manual review (excluded from APPROVE).
    const clusters = clusterLightning(provisional);
    const sharedUids = {};
    clusters.shared.forEach(function (c) {
        c.uids.forEach(function (u) { sharedUids[u] = c; });
    });

    const eligible = [];
    provisional.forEach(function (r) {
        if (sharedUids[r.uid]) {
            excluded.push(Object.assign({}, r, {
                reason: 'shared lightning address (manual review)',
                sats: 0,
                sharePct: 0,
                clusterMasked: sharedUids[r.uid].addressMasked,
            }));
            return;
        }
        eligible.push(r);
    });

    const shareTotal = eligible.reduce(function (s, r) { return s + r.contribution; }, 0);
    const pot = cfg.epochPotSats;
    const recipients = eligible.map(function (r) {
        const sharePct = pot ? Math.round(10000 * r.sats / pot) / 100 : 0;
        const mode = r.sats > cfg.manualAboveSats ? 'manual' : 'claimable';
        return Object.assign({}, r, { sharePct: sharePct, mode: mode });
    });

    // Flag person or cluster over clusterFlagPct of the pot.
    const flags = [];
    recipients.forEach(function (r) {
        if (r.sharePct >= cfg.clusterFlagPct) {
            flags.push({ kind: 'person', uidShort: r.uidShort, username: r.username, sharePct: r.sharePct, sats: r.sats });
        }
    });
    clusters.shared.forEach(function (c) {
        const pct = pot ? Math.round(10000 * c.sats / pot) / 100 : 0;
        c.sharePct = pct;
        if (pct >= cfg.clusterFlagPct) {
            flags.push({ kind: 'cluster', addressMasked: c.addressMasked, uidShorts: c.uidShorts, sharePct: pct, sats: c.sats });
        }
    });

    const satsTotal = recipients.reduce(function (s, r) { return s + r.sats; }, 0);
    // Notify amount matches per-block math (same as live announcement).
    const notifyShare = split.perBlock;

    return {
        kind: 'epoch',
        epochId: epochId,
        epochNumber: epochNum,
        pot: pot,
        satsTotal: satsTotal,
        perBlockSats: split.perBlock,
        notifyShare: notifyShare,
        countedBlocks: split.totalBlocks,
        balanced: true,
        unallocated: Math.max(0, pot - satsTotal),
        config: cfg,
        recipients: recipients,
        excluded: excluded,
        contributionTotal: shareTotal,
        lightningClusters: clusters.shared.map(function (c) {
            return {
                addressMasked: c.addressMasked,
                count: c.count,
                uidShorts: c.uidShorts,
                sats: c.sats,
                sharePct: c.sharePct || 0,
            };
        }),
        flags: flags,
    };
}

function buildWindowBreakdown(input) {
    const cfg = readConfig(input.config);
    const now = Number(input.nowMs) || Date.now();
    const cycleId = String(input.cycleId || '');
    const windowId = windowIdOf(cycleId);
    const winnerUid = input.winnerUid ? String(input.winnerUid) : '';
    const pot = cfg.windowWinnerSats;
    const recipients = [];
    const excluded = [];
    if (winnerUid && pot > 0) {
        const p = input.player || {};
        const c = {
            user: p.user || null,
            ledger: p.ledger || {},
            authKnown: p.authKnown === true,
            ageDays: Number(p.ageDays) || 0,
            ageDaysAtFirstBlock: Number(p.ageDays) || 0,
            emailVerified: p.emailVerified === true,
            lightningAddressAtClose: normalizeLn(p.lightningAddressAtClose || ''),
            addressChangedAfterClose: p.addressChangedAfterClose === true,
            addressInCooldown: p.addressInCooldown === true,
        };
        const reason = exclusionReason(c, cfg, now);
        const capped = applyPersonCap(pot, cfg.perPersonCapSats);
        const row = {
            uid: winnerUid,
            uidShort: truncateUid(winnerUid),
            username: publicName(input.winnerUsername || (p.user && p.user.username)),
            contribution: 1,
            why: 'Lowest hash this Favor window',
            lightningAddressAtClose: c.lightningAddressAtClose || '',
            sharePct: 100,
            sats: capped.sats,
            mode: capped.sats > cfg.manualAboveSats ? 'manual' : 'claimable',
        };
        if (reason) excluded.push(Object.assign({}, row, { reason: reason, sats: 0, sharePct: 0, mode: 'excluded' }));
        else recipients.push(row);
    }
    const satsTotal = recipients.reduce(function (s, r) { return s + r.sats; }, 0);
    return {
        kind: 'window',
        windowId: windowId,
        cycleId: cycleId,
        pot: pot,
        satsTotal: satsTotal,
        balanced: true,
        unallocated: recipients.length ? Math.max(0, pot - satsTotal) : pot,
        config: cfg,
        recipients: recipients,
        excluded: excluded,
        contributionTotal: recipients.length,
        lightningClusters: [],
        flags: [],
        notifyShare: satsTotal,
    };
}

function winId(resultId, uid) {
    return 'sfpay_' + String(resultId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) + '_' + String(uid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
}

function confirmText(resultId) {
    return 'APPROVE ' + String(resultId || '');
}

function payoutStatusForAmount(amount, cfg) {
    const a = Math.floor(Number(amount) || 0);
    const cap = (cfg && cfg.manualAboveSats) || MANUAL_ABOVE;
    if (!(a > 0)) return 'skipped';
    if (a > cap) return 'manual';
    return 'claimable';
}

function walletAllowsPay(walletSats, amount, floor) {
    return walletFloorOk(walletSats, 0, amount, floor);
}

function walletFloorOk(walletSats, inFlightSats, amount, floor) {
    const w = Math.floor(Number(walletSats) || 0);
    const inflight = Math.max(0, Math.floor(Number(inFlightSats) || 0));
    const a = Math.max(0, Math.floor(Number(amount) || 0));
    const f = Math.max(0, Math.floor(Number(floor) || 0));
    return w - inflight - a >= f;
}

function siteCapAllows(used, amount, cap) {
    const u = Math.max(0, Math.floor(Number(used) || 0));
    const a = Math.max(0, Math.floor(Number(amount) || 0));
    const c = Math.max(0, Math.floor(Number(cap) || 0));
    if (!c) return true;
    return u + a <= c;
}

function planFavorClaimReserve(input) {
    const src = input || {};
    const limits = claimLimits(src.config);
    const amount = Math.max(0, Math.floor(Number(src.amount) || 0));
    if (!(amount > 0)) return { ok: false, error: 'zero', limits: limits };
    if (amount > limits.manualAboveSats) return { ok: false, error: 'manual', limits: limits };
    const used = Math.max(0, Math.floor(Number(src.reservedSats) || 0));
    const alreadyReserved = src.lockReserved === true;
    // Lock carries inFlight so a retry knows whether site.inFlightSats already
    // includes this claim (crash after reserve) or needs a re-add.
    const alreadyInFlight = src.lockInFlight === true;
    // Cap: when the lock is already reserved, `used` already includes amount —
    // do not count it a second time.
    if (alreadyReserved) {
        if (limits.siteDailyCapSats && used > limits.siteDailyCapSats) {
            return { ok: false, error: 'SITE_DAILY_CAP', limits: limits };
        }
    } else if (!siteCapAllows(used, amount, limits.siteDailyCapSats)) {
        return { ok: false, error: 'SITE_DAILY_CAP', limits: limits };
    }
    const inflight = Math.max(0, Math.floor(Number(src.inFlightSats) || 0));
    const needInFlight = !alreadyInFlight;
    // Floor always runs. If this lock is already in-flight, amount sits inside
    // inflight already — check with add=0. Otherwise add amount.
    if (!walletFloorOk(src.walletSats, inflight, needInFlight ? amount : 0, limits.walletFloorSats)) {
        return { ok: false, error: 'WALLET_LOW', limits: limits };
    }
    return {
        ok: true,
        limits: limits,
        already: alreadyReserved,
        nextReservedSats: alreadyReserved ? used : used + amount,
        nextInFlightSats: needInFlight ? inflight + amount : inflight,
        setLockInFlight: true,
        day: String(src.day || ''),
    };
}

function planFavorClaimRelease(input) {
    const src = input || {};
    const amount = Math.max(0, Math.floor(Number(src.amount) || 0));
    const used = Math.max(0, Math.floor(Number(src.reservedSats) || 0));
    const inflight = Math.max(0, Math.floor(Number(src.inFlightSats) || 0));
    const clearInFlight = src.clearInFlight !== false;
    const clearReserved = src.clearReserved === true;
    return {
        reservedSats: clearReserved ? Math.max(0, used - amount) : used,
        inFlightSats: clearInFlight ? Math.max(0, inflight - amount) : inflight,
        clearReserved: clearReserved,
        clearInFlight: clearInFlight,
        day: String(src.day || ''),
    };
}

module.exports = {
    DEFAULTS, MAX_POT, MANUAL_ABOVE,
    readConfig, claimLimits, epochIdOf, windowIdOf, truncateUid, publicName,
    normalizeLn, validLn, maskLn, exclusionReason, satsPerBlock, splitByBlocks,
    applyPersonCap, clusterLightning,
    buildEpochBreakdown, buildWindowBreakdown, winId, confirmText,
    payoutStatusForAmount, walletAllowsPay, walletFloorOk, siteCapAllows, num,
    planFavorClaimReserve, planFavorClaimRelease,
};
