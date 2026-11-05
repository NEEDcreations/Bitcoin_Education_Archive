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
        manualAboveSats: intIn(d.manualAboveSats, 1, MAX_POT, DEFAULTS.manualAboveSats),
        walletFloorSats: intIn(d.walletFloorSats, 0, MAX_POT, DEFAULTS.walletFloorSats),
        siteDailyCapSats: intIn(d.siteDailyCapSats, 0, MAX_POT, DEFAULTS.siteDailyCapSats),
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

// Why a player gets no sats. First match wins.
function exclusionReason(c, cfg, nowMs) {
    const u = c.user;
    if (!u) return 'account deleted';
    if (rewardBlocked(u, c.ledger)) return 'banned or sats disabled';
    if (u.multiAccount === true) return 'flagged multi-account';
    if (num(u.satsHold) > nowMs) return 'sats on hold';
    if (!c.authKnown) return 'account age unknown';
    if (c.ageDays < cfg.minAccountAgeDays) return 'account younger than ' + cfg.minAccountAgeDays + ' days';
    if (c.emailVerified !== true) return 'no verified email';
    if (!validLn(c.lightningAddressAtClose)) return 'no lightning address saved before close';
    if (c.addressChangedAfterClose) return 'lightning address changed after close';
    if (c.addressInCooldown) return 'lightning address still in change cooldown';
    return '';
}

function splitEqual(pot, count) {
    const n = Math.max(0, Math.floor(count));
    if (!pot || !n) return [];
    const base = Math.floor(pot / n);
    const out = [];
    for (let i = 0; i < n; i++) out.push(base);
    let left = pot - base * n;
    for (let i = 0; left > 0; i = (i + 1) % n, left--) out[i] += 1;
    return out;
}

// blocks: [{ uid, username, value }] — one row per block (uid may repeat).
// Unique winners share the pot equally. Share reason names the block(s).
function buildEpochBreakdown(input) {
    const cfg = readConfig(input.config);
    const now = Number(input.nowMs) || Date.now();
    const epochNum = Math.floor(Number(input.epochNumber)) || 0;
    const epochId = epochIdOf(epochNum);
    const blocks = Array.isArray(input.blocks) ? input.blocks : [];
    const byUid = {};
    blocks.forEach(function (b, i) {
        if (!b || !b.uid) return;
        const uid = String(b.uid);
        if (!byUid[uid]) {
            byUid[uid] = {
                uid: uid,
                username: publicName(b.username),
                blockIndexes: [],
                hashes: [],
                contribution: 0,
            };
        }
        byUid[uid].contribution += 1;
        byUid[uid].blockIndexes.push(i + 1);
        if (b.value != null) byUid[uid].hashes.push(b.value);
        if (b.username) byUid[uid].username = publicName(b.username);
    });
    const winners = Object.keys(byUid).sort(function (a, b) {
        return byUid[b].contribution - byUid[a].contribution || (a < b ? -1 : 1);
    }).map(function (uid) { return byUid[uid]; });

    const players = (input.players || []).slice();
    const byPlayer = {};
    players.forEach(function (p) { if (p && p.uid) byPlayer[p.uid] = p; });

    const eligible = [];
    const excluded = [];
    winners.forEach(function (w) {
        const p = byPlayer[w.uid] || {};
        const c = {
            user: p.user || null,
            ledger: p.ledger || {},
            authKnown: p.authKnown === true,
            ageDays: Number(p.ageDays) || 0,
            emailVerified: p.emailVerified === true,
            lightningAddressAtClose: normalizeLn(p.lightningAddressAtClose || ''),
            addressChangedAfterClose: p.addressChangedAfterClose === true,
            addressInCooldown: p.addressInCooldown === true,
        };
        const reason = exclusionReason(c, cfg, now);
        const row = {
            uid: w.uid,
            uidShort: truncateUid(w.uid),
            username: w.username,
            contribution: w.contribution,
            why: 'Mined block' + (w.blockIndexes.length > 1 ? 's ' : ' ') + w.blockIndexes.join(', '),
            lightningAddressAtClose: c.lightningAddressAtClose || '',
        };
        if (reason) excluded.push(Object.assign({}, row, { reason: reason, sats: 0, sharePct: 0 }));
        else eligible.push(row);
    });

    const sats = splitEqual(cfg.epochPotSats, eligible.length);
    const shareTotal = eligible.reduce(function (s, r) { return s + r.contribution; }, 0);
    const recipients = eligible.map(function (r, i) {
        const amount = sats[i] || 0;
        return Object.assign({}, r, {
            sharePct: shareTotal ? Math.round(10000 * r.contribution / shareTotal) / 100 : 0,
            sats: amount,
            mode: amount > cfg.manualAboveSats ? 'manual' : 'claimable',
        });
    });
    const satsTotal = recipients.reduce(function (s, r) { return s + r.sats; }, 0);
    return {
        kind: 'epoch',
        epochId: epochId,
        epochNumber: epochNum,
        pot: cfg.epochPotSats,
        satsTotal: satsTotal,
        balanced: recipients.length ? satsTotal === cfg.epochPotSats : true,
        unallocated: recipients.length ? 0 : cfg.epochPotSats,
        config: cfg,
        recipients: recipients,
        excluded: excluded,
        contributionTotal: shareTotal,
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
            emailVerified: p.emailVerified === true,
            lightningAddressAtClose: normalizeLn(p.lightningAddressAtClose || ''),
            addressChangedAfterClose: p.addressChangedAfterClose === true,
            addressInCooldown: p.addressInCooldown === true,
        };
        const reason = exclusionReason(c, cfg, now);
        const row = {
            uid: winnerUid,
            uidShort: truncateUid(winnerUid),
            username: publicName(input.winnerUsername || (p.user && p.user.username)),
            contribution: 1,
            why: 'Lowest hash this Favor window',
            lightningAddressAtClose: c.lightningAddressAtClose || '',
            sharePct: 100,
            sats: pot,
            mode: pot > cfg.manualAboveSats ? 'manual' : 'claimable',
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
        unallocated: recipients.length ? 0 : pot,
        config: cfg,
        recipients: recipients,
        excluded: excluded,
        contributionTotal: recipients.length,
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
    const w = Math.floor(Number(walletSats) || 0);
    const a = Math.floor(Number(amount) || 0);
    const f = Math.floor(Number(floor) || 0);
    return w - a >= f;
}

function siteCapAllows(used, amount, cap) {
    const u = Math.max(0, Math.floor(Number(used) || 0));
    const a = Math.max(0, Math.floor(Number(amount) || 0));
    const c = Math.max(0, Math.floor(Number(cap) || 0));
    if (!c) return true;
    return u + a <= c;
}

module.exports = {
    DEFAULTS, MAX_POT, MANUAL_ABOVE,
    readConfig, epochIdOf, windowIdOf, truncateUid, publicName,
    normalizeLn, validLn, exclusionReason, splitEqual,
    buildEpochBreakdown, buildWindowBreakdown, winId, confirmText,
    payoutStatusForAmount, walletAllowsPay, siteCapAllows, num,
};
