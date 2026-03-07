// © 2024-2026 603BTC LLC. All rights reserved.
// =============================================
// ₿ Wallet Bridge — On-Chain Network Layer
// Talks to Mempool.space public API for balance,
// UTXOs, transactions, fees, and price data.
// No server. No custody. No API keys.
// =============================================

(function() {
'use strict';

var MEMPOOL_API = 'https://mempool.space/api';

// ─── Rate Limiter ────────────────────────────────────────
var _lastReq = {};
var MIN_GAP = 2000; // 2s between identical endpoint calls

function rl(key) {
    var now = Date.now();
    if (_lastReq[key] && now - _lastReq[key] < MIN_GAP) return false;
    _lastReq[key] = now;
    return true;
}

async function mempoolGet(path) {
    if (!rl(path)) return null;
    try {
        var r = await fetch(MEMPOOL_API + path);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var ct = r.headers.get('content-type') || '';
        return ct.includes('json') ? r.json() : r.text();
    } catch(e) {
        console.warn('[BRIDGE]', path, e.message);
        return null;
    }
}

// ─── Address Info ────────────────────────────────────────

async function getAddressInfo(addr) {
    return mempoolGet('/address/' + encodeURIComponent(addr));
}

async function getAddressUTXOs(addr) {
    var d = await mempoolGet('/address/' + encodeURIComponent(addr) + '/utxo');
    return d || [];
}

async function getAddressTxs(addr) {
    var d = await mempoolGet('/address/' + encodeURIComponent(addr) + '/txs');
    return d || [];
}

// ─── Aggregate across multiple addresses ─────────────────

async function getWalletBalance(addresses) {
    var confirmed = 0, unconfirmed = 0;
    for (var i = 0; i < addresses.length; i++) {
        var info = await getAddressInfo(addresses[i]);
        if (info && info.chain_stats) {
            confirmed += (info.chain_stats.funded_txo_sum || 0) - (info.chain_stats.spent_txo_sum || 0);
        }
        if (info && info.mempool_stats) {
            unconfirmed += (info.mempool_stats.funded_txo_sum || 0) - (info.mempool_stats.spent_txo_sum || 0);
        }
    }
    return { confirmed: confirmed, unconfirmed: unconfirmed, total: confirmed + unconfirmed };
}

async function getWalletTxs(addresses) {
    var all = [], seen = {};
    for (var i = 0; i < addresses.length; i++) {
        var txs = await getAddressTxs(addresses[i]);
        if (txs) txs.forEach(function(tx) {
            if (!seen[tx.txid]) { seen[tx.txid] = true; all.push(tx); }
        });
    }
    all.sort(function(a, b) {
        var ta = a.status && a.status.block_time ? a.status.block_time : Date.now() / 1000;
        var tb = b.status && b.status.block_time ? b.status.block_time : Date.now() / 1000;
        return tb - ta;
    });
    return all;
}

// ─── Price / Fees / Block Height ─────────────────────────

async function getBtcPrice() {
    var c = window._btcPriceCache;
    if (c && Date.now() - c.ts < 60000) return c.price;
    var d = await mempoolGet('/v1/prices');
    if (d && d.USD) {
        window._btcPriceCache = { price: d.USD, ts: Date.now() };
        return d.USD;
    }
    return c ? c.price : 0;
}

async function getFeeEstimates() {
    var d = await mempoolGet('/v1/fees/recommended');
    return d || { fastestFee: 20, halfHourFee: 10, hourFee: 5, economyFee: 2, minimumFee: 1 };
}

async function getBlockHeight() {
    var d = await mempoolGet('/blocks/tip/height');
    return d ? parseInt(d) : null;
}

// ─── Formatting Helpers ──────────────────────────────────

function formatSats(sats) {
    if (sats >= 100000000) return (sats / 100000000).toFixed(4) + ' BTC';
    if (sats >= 1000000) return (sats / 1000000).toFixed(2) + 'M sats';
    if (sats >= 1000) return Math.round(sats).toLocaleString() + ' sats';
    return sats + ' sats';
}

function formatUsd(sats, price) {
    if (!price) return '';
    return '$' + ((sats / 100000000) * price).toFixed(2);
}

function satsToBtc(s) { return (s / 100000000).toFixed(8); }
function btcToSats(b) { return Math.round(b * 100000000); }

// ─── Public API ──────────────────────────────────────────

window.WalletBridge = {
    getAddressInfo: getAddressInfo,
    getAddressUTXOs: getAddressUTXOs,
    getAddressTxs: getAddressTxs,
    getWalletBalance: getWalletBalance,
    getWalletTxs: getWalletTxs,
    getBtcPrice: getBtcPrice,
    getFeeEstimates: getFeeEstimates,
    getBlockHeight: getBlockHeight,
    formatSats: formatSats,
    formatUsd: formatUsd,
    satsToBtc: satsToBtc,
    btcToSats: btcToSats,
};

console.log('[BRIDGE] On-chain network layer loaded');
})();
