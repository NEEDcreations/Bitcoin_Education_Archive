// © 2024-2026 603BTC LLC. All rights reserved.
// =============================================
// ₿ Bitcoin Network Dashboard — Real-Time Metrics
// Sources: mempool.space, CoinGecko, alternative.me
// =============================================

(function() {
'use strict';

// ---- Real-Time Price WebSocket (Binance) ----
var _priceWs = null;
var _lastWsPrice = null;
var _lastWsChange = null;
var _wsOpenPrice = null; // 24h open for % calc

function startPriceWs() {
    if (_priceWs && _priceWs.readyState <= 1) return; // already open/connecting
    try {
        // Use CoinCap WebSocket — free, no CORS issues, no auth
        var wsUrl = 'wss://ws.coincap.io/prices?assets=bitcoin';
        _priceWs = new WebSocket(wsUrl);
        _priceWs.onopen = function() { 
            console.log('[Dashboard] Price WebSocket connected (CoinCap)'); 
            window._wsDataTimer = setTimeout(function() {
                if (!_lastWsPrice) { console.warn('[Dashboard] WS connected but no data — falling back'); startPricePolling(); }
            }, 10000);
        };
        _priceWs.onmessage = function(evt) {
            try {
                if (window._wsDataTimer) { clearTimeout(window._wsDataTimer); window._wsDataTimer = null; }
                var d = JSON.parse(evt.data);
                if (!d.bitcoin) return;
                var newPrice = parseFloat(d.bitcoin);
                // Calculate change from cached 24h data or previous price
                if (!_wsOpenPrice && _lastWsPrice) _wsOpenPrice = _lastWsPrice;
                _lastWsPrice = newPrice;
                if (_wsOpenPrice) _lastWsChange = ((_lastWsPrice - _wsOpenPrice) / _wsOpenPrice) * 100;
                _wsOpenPrice = parseFloat(d.o); // 24h open
                // Update dashboard overlay if open
                var priceEl = document.getElementById('dashLivePrice');
                if (priceEl) priceEl.textContent = '$' + fmtNum(_lastWsPrice, 2);
                var changeEl = document.getElementById('dashLiveChange');
                if (changeEl) {
                    var color = _lastWsChange >= 0 ? '#22c55e' : '#ef4444';
                    var arrow = _lastWsChange >= 0 ? '▲' : '▼';
                    changeEl.innerHTML = '<span style="color:' + color + ';">' + arrow + ' ' + Math.abs(_lastWsChange).toFixed(2) + '% (24h)</span>';
                }
                // Update fixed button
                var btnPrice = document.getElementById('dashBtnPrice');
                if (btnPrice) {
                    var c2 = _lastWsChange >= 0 ? '#22c55e' : '#ef4444';
                    var a2 = _lastWsChange >= 0 ? '▲' : '▼';
                    btnPrice.innerHTML = '$' + fmtNum(_lastWsPrice, 0) + ' <span style="color:' + c2 + ';font-size:0.6rem;">' + a2 + Math.abs(_lastWsChange).toFixed(1) + '%</span>';
                }
                // Cache for other uses
                window._btcPriceCache = { price: _lastWsPrice, change: _lastWsChange, ts: Date.now() };
            } catch(e) {}
        };
        _priceWs.onclose = function() { console.log('[Dashboard] WS closed, reconnecting...'); _priceWs = null; setTimeout(startPriceWs, 5000); };
        _priceWs.onerror = function(e) { console.warn('[Dashboard] WS error, falling back to polling'); try { _priceWs.close(); } catch(x) {} _priceWs = null; startPricePolling(); };
    } catch(e) { startPricePolling(); }
}

// Polling fallback if WebSocket fails (updates every 5 seconds via Binance REST)
var _pricePollTimer = null;
function startPricePolling() {
    if (_pricePollTimer) return; // already polling
    console.log('[Dashboard] Starting price polling fallback (CoinGecko)');
    function poll() {
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true')
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (d && d.bitcoin) {
                    _lastWsPrice = d.bitcoin.usd;
                    _lastWsChange = d.bitcoin.usd_24h_change || 0;
                    // Update dashboard
                    var priceEl = document.getElementById('dashLivePrice');
                    if (priceEl) priceEl.textContent = '$' + fmtNum(_lastWsPrice, 2);
                    var changeEl = document.getElementById('dashLiveChange');
                    if (changeEl) {
                        var color = _lastWsChange >= 0 ? '#22c55e' : '#ef4444';
                        var arrow = _lastWsChange >= 0 ? '▲' : '▼';
                        changeEl.innerHTML = '<span style="color:' + color + ';">' + arrow + ' ' + Math.abs(_lastWsChange).toFixed(2) + '% (24h)</span>';
                    }
                    // Update fixed button
                    var btnPrice = document.getElementById('dashBtnPrice');
                    if (btnPrice) {
                        var c2 = _lastWsChange >= 0 ? '#22c55e' : '#ef4444';
                        var a2 = _lastWsChange >= 0 ? '▲' : '▼';
                        btnPrice.innerHTML = '$' + fmtNum(_lastWsPrice, 0) + ' <span style="color:' + c2 + ';font-size:0.6rem;">' + a2 + Math.abs(_lastWsChange).toFixed(1) + '%</span>';
                    }
                    window._btcPriceCache = { price: _lastWsPrice, change: _lastWsChange, ts: Date.now() };
                }
            }).catch(function() {});
    }
    poll();
    _pricePollTimer = setInterval(poll, 30000); // CoinGecko rate limit: ~30 calls/min
}

function stopPriceWs() {
    if (_priceWs) { _priceWs.onclose = null; _priceWs.close(); _priceWs = null; }
}

// ---- Cache & State ----
var DASH_CACHE_KEY = 'btc_dashboard_cache';
var DASH_CACHE_TTL = 120000; // 2 min
var _dashData = null;
var _dashLoading = false;
var _dashInterval = null;

// ---- Number Formatting ----
function fmtNum(n, decimals) {
    if (n === null || n === undefined) return '—';
    if (typeof decimals === 'number') return Number(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return Number(n).toLocaleString();
}
function fmtCompact(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e18) return (n / 1e18).toFixed(2) + ' EH/s';
    if (n >= 1e15) return (n / 1e15).toFixed(2) + ' PH/s';
    if (n >= 1e12) return (n / 1e12).toFixed(2) + ' TH/s';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GH/s';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + ' M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return fmtNum(n);
}
function fmtT(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e12) return (n / 1e12).toFixed(2) + ' T';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + ' B';
    return fmtNum(n);
}
function fmtSatsPerDollar(price) {
    if (!price) return '—';
    return fmtNum(Math.round(100000000 / price));
}
function fmtSupply(n) {
    if (!n) return '—';
    return (n / 1e6).toFixed(2) + 'M / 21M';
}
function fmtPctMined(n) {
    if (!n) return '—';
    return ((n / 21000000) * 100).toFixed(2) + '%';
}

// ---- Fetch All Data ----
async function fetchDashboardData() {
    // If already loading, wait up to 10s for it, then return whatever we have
    if (_dashLoading) {
        await new Promise(function(r) { var _w = setInterval(function() { if (!_dashLoading) { clearInterval(_w); r(); } }, 200); setTimeout(function() { clearInterval(_w); _dashLoading = false; r(); }, 10000); });
        return _dashData || {};
    }
    _dashLoading = true;

    // Check cache — use it immediately, but still fetch fresh in background
    var _cachedData = null;
    try {
        var cached = JSON.parse(localStorage.getItem(DASH_CACHE_KEY));
        if (cached && cached.data) {
            _cachedData = cached.data;
            // If cache is fresh enough, return it
            if (Date.now() - cached.ts < DASH_CACHE_TTL) {
                _dashData = cached.data;
                _dashLoading = false;
                return _dashData;
            }
        }
    } catch(e) {}
    
    // Start with cached data as baseline so we always have something to render
    if (_cachedData) _dashData = _cachedData;

    var data = _dashData || {};

    // Parallel fetch from multiple APIs
    var promises = [];

    // 1. mempool.space — block height, fees, hashrate, difficulty, mempool
    promises.push(
        fetch('https://mempool.space/api/blocks/tip/height').then(r => r.text()).then(h => { data.blockHeight = parseInt(h); try { localStorage.setItem('btc_last_height', data.blockHeight.toString()); } catch(e) {} }).catch(() => {})
    );
    promises.push(
        fetch('https://mempool.space/api/v1/fees/recommended').then(r => r.json()).then(f => {
            data.feeFast = f.fastestFee;
            data.feeHalf = f.halfHourFee;
            data.feeHour = f.hourFee;
            data.feeEcon = f.economyFee;
            data.feeMin = f.minimumFee;
        }).catch(() => {})
    );
    promises.push(
        fetch('https://mempool.space/api/v1/mining/hashrate/1m').then(r => r.json()).then(d => {
            if (d.currentHashrate) data.hashrate = d.currentHashrate;
            if (d.currentDifficulty) data.difficulty = d.currentDifficulty;
            // Calculate 24h hashrate change from historical data
            if (d.hashrates && d.hashrates.length >= 2) {
                var latest = d.hashrates[d.hashrates.length - 1];
                // Find entry from ~24h ago
                var target = (latest.timestamp || Date.now()/1000) - 86400;
                var prev = d.hashrates[0];
                for (var i = 0; i < d.hashrates.length; i++) {
                    if (d.hashrates[i].timestamp <= target) prev = d.hashrates[i];
                }
                if (prev.avgHashrate && latest.avgHashrate && prev.avgHashrate > 0) {
                    data.hashrateChange24h = ((latest.avgHashrate - prev.avgHashrate) / prev.avgHashrate * 100);
                }
            }
        }).catch(() => {})
    );
    promises.push(
        fetch('https://mempool.space/api/v1/difficulty-adjustment').then(r => r.json()).then(d => {
            data.diffChange = d.difficultyChange;
            data.diffEstDate = d.estimatedRetargetDate;
            data.diffRemaining = d.remainingBlocks;
            data.diffProgress = d.progressPercent;
        }).catch(() => {})
    );
    promises.push(
        fetch('https://mempool.space/api/mempool').then(r => r.json()).then(m => {
            data.mempoolTxs = m.count;
            data.mempoolSize = m.vsize; // vbytes
        }).catch(() => {})
    );

    // 2. CoinGecko — price, market cap, volume, supply, 24h change
    promises.push(
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true').then(r => r.json()).then(d => {
            if (d.bitcoin) {
                data.price = d.bitcoin.usd;
                try { localStorage.setItem('btc_last_price', d.bitcoin.usd.toString()); } catch(e) {}
                data.change24h = d.bitcoin.usd_24h_change;
                data.volume24h = d.bitcoin.usd_24h_vol;
                data.marketCap = d.bitcoin.usd_market_cap;
                // Seed WS open price for % calc
                if (!_wsOpenPrice && data.price && data.change24h) {
                    _wsOpenPrice = data.price / (1 + data.change24h / 100);
                    _lastWsChange = data.change24h;
                }
            }
        }).catch(() => {})
    );
    promises.push(
        fetch('https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false').then(r => r.json()).then(d => {
            if (d.market_data) {
                data.supply = d.market_data.circulating_supply;
                data.ath = d.market_data.ath ? d.market_data.ath.usd : null;
                data.athDate = d.market_data.ath_date ? d.market_data.ath_date.usd : null;
                data.athChange = d.market_data.ath_change_percentage ? d.market_data.ath_change_percentage.usd : null;
                data.high24h = d.market_data.high_24h ? d.market_data.high_24h.usd : null;
                data.low24h = d.market_data.low_24h ? d.market_data.low_24h.usd : null;
                data.mktCapChange24h = d.market_data.market_cap_change_percentage_24h || null;
            }
        }).catch(() => {})
    );

    // 3. Lightning Network capacity (mempool.space)
    promises.push(
        fetch('https://mempool.space/api/v1/lightning/statistics/latest').then(r => r.json()).then(d => {
            if (d) {
                data.lnCapacity = d.latest ? d.latest.total_capacity : d.total_capacity;
                data.lnNodes = d.latest ? d.latest.node_count : d.node_count;
                data.lnChannels = d.latest ? d.latest.channel_count : d.channel_count;
            }
        }).catch(() => {})
    );

    // 4. Fear & Greed Index
    promises.push(
        fetch('https://api.alternative.me/fng/?limit=1').then(r => r.json()).then(d => {
            if (d.data && d.data[0]) {
                data.fearGreed = parseInt(d.data[0].value);
                data.fearGreedLabel = d.data[0].value_classification;
            }
        }).catch(() => {})
    );

    // Race: all fetches vs 8-second timeout
    await Promise.race([
        Promise.all(promises),
        new Promise(resolve => setTimeout(resolve, 8000))
    ]);

    // If no price from CoinGecko, try cached or WS price
    if (!data.price && _lastWsPrice) data.price = _lastWsPrice;
    if (!data.price) {
        try {
            var _fc = JSON.parse(localStorage.getItem(DASH_CACHE_KEY));
            if (_fc && _fc.data && _fc.data.price) {
                // Use stale cache rather than showing nothing
                Object.keys(_fc.data).forEach(function(k) { if (!data[k]) data[k] = _fc.data[k]; });
            }
        } catch(e) {}
    }

    // Derived metrics
    if (data.price) {
        data.satsPerDollar = Math.round(100000000 / data.price);
        data.moscowTime = Math.round(100000000 / data.price); // sats per dollar
    }
    if (data.blockHeight) {
        data.halving = 210000 - (data.blockHeight % 210000);
        var halvingEpoch = Math.floor(data.blockHeight / 210000);
        data.subsidy = (50 / Math.pow(2, halvingEpoch)).toFixed(4);
        data.nextSubsidy = (50 / Math.pow(2, halvingEpoch + 1)).toFixed(4);
        data.halvingBlock = (halvingEpoch + 1) * 210000;
        // ETA: ~10 min per block
        var halvingMs = data.halving * 10 * 60 * 1000;
        data.halvingEta = new Date(Date.now() + halvingMs);
        // Countdown components
        var totalSec = Math.floor(halvingMs / 1000);
        data.halvingDays = Math.floor(totalSec / 86400);
        data.halvingHours = Math.floor((totalSec % 86400) / 3600);
        data.halvingMins = Math.floor((totalSec % 3600) / 60);
    }

    data.ts = Date.now();
    _dashData = data;

    // Cache — only if we got meaningful data
    if (data.price || data.blockHeight) {
        try { localStorage.setItem(DASH_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data })); } catch(e) {}
    }
    _dashLoading = false;
    return data;
}

// Safety: always clear loading flag after 15s max
setInterval(function() { if (_dashLoading) { console.warn('[Dashboard] Force-clearing stuck loading flag'); _dashLoading = false; } }, 15000);

// ---- Fear/Greed Color ----
function fgColor(val) {
    if (val <= 25) return '#ef4444'; // Extreme Fear
    if (val <= 45) return '#f97316'; // Fear
    if (val <= 55) return '#eab308'; // Neutral
    if (val <= 75) return '#84cc16'; // Greed
    return '#22c55e'; // Extreme Greed
}

// ---- Render Dashboard Overlay ----
function renderDashboard(data) {
    var d = data || {};
    var changeColor = (d.change24h || 0) >= 0 ? '#22c55e' : '#ef4444';
    var changeArrow = (d.change24h || 0) >= 0 ? '▲' : '▼';
    var diffChangeColor = (d.diffChange || 0) >= 0 ? '#22c55e' : '#ef4444';
    var nextRetarget = d.diffEstDate ? new Date(d.diffEstDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

    var html = '';
    
    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">';
    html += '<div><h2 style="color:var(--heading);font-size:1.4rem;font-weight:900;margin:0;letter-spacing:-0.5px;">₿ Bitcoin Network</h2>';
    html += '<div style="color:var(--text-faint);font-size:0.7rem;margin-top:2px;">Live metrics · Updates every 2 min</div></div>';
    html += '<button onclick="closeDashboard()" style="background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer;padding:4px;">✕</button>';
    html += '</div>';

    // Price hero (live-updated via WebSocket)
    var livePrice = _lastWsPrice || d.price;
    var liveChange = _lastWsChange !== null ? _lastWsChange : (d.change24h || 0);
    var liveColor = liveChange >= 0 ? '#22c55e' : '#ef4444';
    var liveArrow = liveChange >= 0 ? '▲' : '▼';
    html += '<div style="text-align:center;padding:20px 0 16px;border-bottom:1px solid var(--border);margin-bottom:16px;">';
    html += '<div id="dashLivePrice" style="font-size:2.2rem;font-weight:900;color:var(--heading);letter-spacing:-1px;">$' + fmtNum(livePrice, 2) + '</div>';
    html += '<div id="dashLiveChange" style="font-size:1rem;font-weight:700;margin-top:4px;"><span style="color:' + liveColor + ';">' + liveArrow + ' ' + Math.abs(liveChange).toFixed(2) + '%</span></div>';
    html += '<div style="font-size:0.6rem;color:var(--text-faint);margin-top:4px;" id="dashLiveIndicator">🔴 Live — updates automatically · All % changes are 24h</div>';
    html += '<div style="display:flex;justify-content:center;gap:20px;margin-top:10px;font-size:0.78rem;color:var(--text-muted);">';
    html += '<span>24h High: <strong style="color:var(--text);">$' + fmtNum(d.high24h, 0) + '</strong></span>';
    html += '<span>24h Low: <strong style="color:var(--text);">$' + fmtNum(d.low24h, 0) + '</strong></span>';
    html += '</div>';
    html += '</div>';

    // Halving Countdown
    if (d.halvingDays !== undefined) {
        var halvingPct = d.halving ? ((210000 - d.halving) / 210000 * 100).toFixed(1) : 0;
        var etaStr = d.halvingEta ? d.halvingEta.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
        var halvingTip = 'Every 210,000 blocks (~4 years), the Bitcoin block reward is cut in half. This is called the "halving." It reduces the rate of new Bitcoin created, enforcing scarcity. The reward started at 50 BTC in 2009 and has halved 4 times: 50 → 25 → 12.5 → 6.25 → 3.125 BTC. After the next halving, miners will receive 1.5625 BTC per block. There will only ever be 21 million Bitcoin.';
        html += '<div onclick="event.stopPropagation();showDashTip(this,\'' + halvingTip.replace(/'/g, "\\'") + '\')" style="background:linear-gradient(135deg,rgba(247,147,26,0.08),rgba(234,88,12,0.04));border:2px solid rgba(247,147,26,0.2);border-radius:14px;padding:16px;margin-bottom:16px;text-align:center;cursor:help;transition:0.2s;position:relative;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'rgba(247,147,26,0.2)\'">';
        html += '<div style="color:var(--text-faint);font-size:0.65rem;text-transform:uppercase;letter-spacing:1.5px;font-weight:800;margin-bottom:8px;">⏳ Next Halving — Block #' + fmtNum(d.halvingBlock) + ' <span style="opacity:0.4;font-size:0.55rem;">ⓘ</span></div>';
        html += '<div style="display:flex;justify-content:center;gap:16px;margin-bottom:10px;">';
        html += '<div><div style="font-size:1.8rem;font-weight:900;color:var(--accent);line-height:1;">' + (d.halvingDays || 0) + '</div><div style="font-size:0.6rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Days</div></div>';
        html += '<div style="font-size:1.4rem;color:var(--text-faint);font-weight:300;">:</div>';
        html += '<div><div style="font-size:1.8rem;font-weight:900;color:var(--accent);line-height:1;">' + (d.halvingHours || 0) + '</div><div style="font-size:0.6rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Hours</div></div>';
        html += '<div style="font-size:1.4rem;color:var(--text-faint);font-weight:300;">:</div>';
        html += '<div><div style="font-size:1.8rem;font-weight:900;color:var(--accent);line-height:1;">' + (d.halvingMins || 0) + '</div><div style="font-size:0.6rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Mins</div></div>';
        html += '</div>';
        html += '<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;">Est. <strong style="color:var(--text);">' + etaStr + '</strong> · ' + fmtNum(d.halving) + ' blocks remaining</div>';
        html += '<div style="background:var(--border);height:6px;border-radius:3px;overflow:hidden;max-width:300px;margin:0 auto;">';
        html += '<div style="height:100%;background:linear-gradient(90deg,#f97316,#ea580c);width:' + halvingPct + '%;border-radius:3px;transition:0.3s;"></div>';
        html += '</div>';
        html += '<div style="font-size:0.6rem;color:var(--text-faint);margin-top:4px;">' + halvingPct + '% through epoch · Subsidy drops ' + d.subsidy + ' → ' + (d.nextSubsidy || '?') + ' BTC</div>';
        html += '</div>';
    }

    // Grid
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';

    // Sats per Dollar
    html += metricCard('⚡', 'Sats per Dollar', fmtNum(d.satsPerDollar), 'Moscow Time', 'How many satoshis (sats) you get for $1 USD. A satoshi is the smallest unit of Bitcoin (0.00000001 BTC). Also called Moscow Time — the number on the clock is how many sats per dollar.');
    // Block Height
    html += metricCard('⛓️', 'Block Height', fmtNum(d.blockHeight), '', 'The total number of blocks mined since Bitcoin\'s Genesis Block on Jan 3, 2009. A new block is added roughly every 10 minutes. This number only goes up — never down.');
    // Current Block Subsidy
    html += metricCard('🪙', 'Block Subsidy', d.subsidy + ' BTC', fmtNum(d.halving) + ' blocks to halving', 'The reward miners receive for finding each new block. Started at 50 BTC in 2009 and halves every 210,000 blocks (~4 years). Currently 3.125 BTC per block.');
    // Hashrate
    var _hrSub = '';
    if (d.hashrateChange24h != null) { var _hc = d.hashrateChange24h; _hrSub = '<span style="color:' + (_hc >= 0 ? '#22c55e' : '#ef4444') + ';">' + (_hc >= 0 ? '▲' : '▼') + ' ' + Math.abs(_hc).toFixed(1) + '%</span>'; }
    html += metricCard('⛏️', 'Hashrate', fmtCompact(d.hashrate), _hrSub, 'The total computing power securing the Bitcoin network, measured in hashes per second. Higher hashrate = more secure network. EH/s = quintillion hashes per second.');
    // Difficulty
    html += metricCard('🎯', 'Difficulty', fmtT(d.difficulty), '', 'How hard it is to mine a new block. Adjusts every 2,016 blocks (~2 weeks) to keep block times at ~10 minutes. If miners join, difficulty goes up. If miners leave, it goes down.');
    // Next Difficulty Adj
    html += metricCard('🔄', 'Next Adjustment', (d.diffChange >= 0 ? '+' : '') + (d.diffChange || 0).toFixed(2) + '%', nextRetarget + ' · ' + fmtNum(d.diffRemaining) + ' blocks', 'The estimated change in mining difficulty at the next adjustment. Positive means blocks are being found faster than 10 min (more miners joined). Negative means slower (miners left).');

    // Fees
    html += metricCard('💸', 'Fast Fee', (d.feeFast || '—') + ' sat/vB', 'Half-hour: ' + (d.feeHalf || '—') + ' · Economy: ' + (d.feeEcon || '—'), 'The recommended transaction fee in satoshis per virtual byte (sat/vB). Fast = next block (~10 min). Half-hour = 1-3 blocks. Economy = lowest priority. Higher fees = faster confirmation.');
    // Mempool
    html += metricCard('📋', 'Mempool', fmtNum(d.mempoolTxs) + ' txs', d.mempoolSize ? (d.mempoolSize / 1e6).toFixed(1) + ' MvB' : '', 'The waiting room for unconfirmed Bitcoin transactions. Shows how many transactions are waiting to be included in a block and their total size. A full mempool means higher fees.');

    // Supply
    html += metricCard('💰', 'Circulating Supply', fmtSupply(d.supply), fmtPctMined(d.supply) + ' mined', 'How many of the 21 million total Bitcoin have been mined so far. No more than 21 million will ever exist — this is enforced by code and consensus. The last Bitcoin will be mined around the year 2140.');
    // Market Cap
    var _mcSub = '';
    if (d.mktCapChange24h != null) { var _mc = d.mktCapChange24h; _mcSub = '<span style="color:' + (_mc >= 0 ? '#22c55e' : '#ef4444') + ';">' + (_mc >= 0 ? '▲' : '▼') + ' ' + Math.abs(_mc).toFixed(1) + '%</span>'; }
    html += metricCard('📊', 'Market Cap', '$' + fmtT(d.marketCap), _mcSub, 'Total value of all Bitcoin in circulation (price × circulating supply). Puts Bitcoin\'s size in perspective compared to gold (~$16T), the S&P 500, or global real estate.');
    // 24h Volume
    var _volSub = '';
    if (d.volume24h && d.marketCap) { var _vr = (d.volume24h / d.marketCap * 100); _volSub = 'Vol/MCap: ' + _vr.toFixed(2) + '%'; }
    html += metricCard('📈', '24h Volume', '$' + fmtT(d.volume24h), _volSub, 'Total USD value of Bitcoin traded across all exchanges in the last 24 hours. High volume often signals strong market interest or significant price moves.');
    // Lightning Network
    var lnBtc = d.lnCapacity ? (d.lnCapacity / 100000000).toFixed(0) : '—';
    var lnUsd = (d.lnCapacity && d.price) ? '$' + fmtT(d.lnCapacity / 100000000 * d.price) : '';
    var _lnSub = (d.lnNodes ? fmtNum(d.lnNodes) + ' nodes · ' : '') + (d.lnChannels ? fmtNum(d.lnChannels) + ' channels' : '') + (lnUsd ? '<br>' + lnUsd : '');
    html += metricCard('⚡', 'Lightning Capacity', fmtNum(lnBtc) + ' BTC', _lnSub, 'Total Bitcoin locked in Lightning Network payment channels. Lightning enables instant, near-free Bitcoin payments. More capacity = more liquidity for fast payments. Nodes route payments; channels connect them.');

    // Fear & Greed
    var fgVal = d.fearGreed || 0;
    var fgLabel = d.fearGreedLabel || '—';
    html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;grid-column:1/-1;">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;">';
    html += '<div><div style="color:var(--text-faint);font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;font-weight:700;">😱 Fear & Greed Index</div>';
    html += '<div style="font-size:1.3rem;font-weight:900;color:' + fgColor(fgVal) + ';margin-top:4px;">' + fgVal + ' — ' + fgLabel + '</div></div>';
    html += '<div style="position:relative;width:80px;height:80px;">';
    html += '<svg viewBox="0 0 36 36" style="width:80px;height:80px;transform:rotate(-90deg);">';
    html += '<circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" stroke-width="3"></circle>';
    html += '<circle cx="18" cy="18" r="15.5" fill="none" stroke="' + fgColor(fgVal) + '" stroke-width="3" stroke-dasharray="' + (fgVal * 0.9742) + ' 100" stroke-linecap="round"></circle>';
    html += '</svg>';
    html += '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:900;color:' + fgColor(fgVal) + ';">' + fgVal + '</div>';
    html += '</div></div></div>';

    // ATH
    if (d.ath) {
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;grid-column:1/-1;display:flex;align-items:center;gap:12px;">';
        html += '<span style="font-size:1.5rem;">🏔️</span>';
        html += '<div><div style="color:var(--text-faint);font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;font-weight:700;">All-Time High</div>';
        html += '<div style="font-size:1.1rem;font-weight:900;color:var(--heading);">$' + fmtNum(d.ath, 0) + '</div></div>';
        html += '<div style="margin-left:auto;text-align:right;"><div style="color:#ef4444;font-size:0.85rem;font-weight:700;">' + (d.athChange || 0).toFixed(1) + '%</div>';
        if (d.athDate) html += '<div style="color:var(--text-faint);font-size:0.65rem;">' + new Date(d.athDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + '</div>';
        html += '</div></div>';
    }

    html += '</div>'; // end grid

    // Sources
    html += '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);font-size:0.6rem;color:var(--text-faint);line-height:1.6;">';
    html += '<strong>Data Sources:</strong> ';
    html += '<a href="https://mempool.space" target="_blank" rel="noopener" style="color:var(--accent);">mempool.space</a> (blocks, fees, hashrate, difficulty, mempool) · ';
    html += '<a href="https://www.coingecko.com" target="_blank" rel="noopener" style="color:var(--accent);">CoinGecko</a> (price, market cap, supply, volume) · ';
    html += '<a href="https://alternative.me/crypto/fear-and-greed-index/" target="_blank" rel="noopener" style="color:var(--accent);">Alternative.me</a> (Fear & Greed Index)';
    html += '<div style="margin-top:4px;">Last updated: ' + new Date(d.ts || Date.now()).toLocaleTimeString() + '</div>';
    html += '</div>';

    return html;
}

function metricCard(emoji, label, value, sub, tip) {
    var tipAttr = tip ? ' onclick="event.stopPropagation();showDashTip(this,\'' + tip.replace(/'/g, "\\'").replace(/"/g, '&quot;') + '\')" style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;cursor:help;transition:0.2s;position:relative;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'"' : ' style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;"';
    return '<div' + tipAttr + '>' +
        '<div style="color:var(--text-faint);font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;font-weight:700;">' + emoji + ' ' + label + (tip ? ' <span style="opacity:0.4;font-size:0.55rem;">ⓘ</span>' : '') + '</div>' +
        '<div style="font-size:1.15rem;font-weight:900;color:var(--heading);margin-top:4px;letter-spacing:-0.3px;">' + (value || '—') + '</div>' +
        (sub ? '<div style="color:var(--text-faint);font-size:0.68rem;margin-top:2px;">' + sub + '</div>' : '') +
    '</div>';
}

// Tooltip display
window.showDashTip = function(el, text) {
    // Remove any existing tooltip
    var existing = document.getElementById('dashTipPopup');
    if (existing) existing.remove();
    
    var tip = document.createElement('div');
    tip.id = 'dashTipPopup';
    tip.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(100% + 8px);z-index:10;background:var(--bg-side,#1a1a2e);border:1px solid var(--accent);border-radius:10px;padding:10px 14px;max-width:260px;width:max-content;box-shadow:0 8px 24px rgba(0,0,0,0.5);animation:fadeSlideIn 0.2s ease-out;pointer-events:auto;';
    tip.innerHTML = '<div style="color:var(--text);font-size:0.75rem;line-height:1.5;">' + text + '</div>' +
        '<div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%) rotate(45deg);width:10px;height:10px;background:var(--bg-side,#1a1a2e);border-right:1px solid var(--accent);border-bottom:1px solid var(--accent);"></div>';
    el.style.position = 'relative';
    el.appendChild(tip);
    
    // Close on click anywhere else
    setTimeout(function() {
        document.addEventListener('click', function _closeTip(e) {
            if (tip.parentNode) tip.remove();
            document.removeEventListener('click', _closeTip);
        }, { once: true });
    }, 50);
};

// ---- Dashboard Button now lives in userDisplay bar (ranking.js) — no separate fixed button ----
window.injectDashboardButton = function() {
    // Removed: dashboard access is now via 📊 icon in the user display price/block row
};

function _updateDashBtnPrice() {
    try {
        var cached = JSON.parse(localStorage.getItem(DASH_CACHE_KEY));
        if (cached && cached.data) {
            if (cached.data.price) {
                var el = document.getElementById('dashBtnPrice');
                if (el) {
                    var p = cached.data.price;
                    var change = cached.data.change24h || 0;
                    var color = change >= 0 ? '#22c55e' : '#ef4444';
                    var arrow = change >= 0 ? '▲' : '▼';
                    el.innerHTML = '$' + fmtNum(p, 0) + ' <span style="color:' + color + ';font-size:0.6rem;">' + arrow + (Math.abs(change)).toFixed(1) + '%</span>';
                }
            }
            if (cached.data.blockHeight) {
                var bel = document.getElementById('dashBtnBlock');
                if (bel) {
                    bel.innerHTML = '⛓️ ' + fmtNum(cached.data.blockHeight, 0);
                }
            }
        }
    } catch(e) {}
    // Refresh every 2 min
    setTimeout(_updateDashBtnPrice, DASH_CACHE_TTL);
}

// Home page button removed — 📊 is now inline with logo/donate on all pages
window.injectHomeDashboardButton = function() {};

// ---- Toggle Overlay ----
window.toggleDashboard = async function() {
    var existing = document.getElementById('btcDashOverlay');
    if (existing) { existing.remove(); clearInterval(_dashInterval); _dashInterval = null; return; }

    // Create overlay
    var overlay = document.createElement('div');
    overlay.id = 'btcDashOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.88);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;';
    overlay.onclick = function(e) { if (e.target === overlay) { closeDashboard(); } };

    var card = document.createElement('div');
    card.id = 'btcDashCard';
    card.style.cssText = 'background:var(--bg-side,#0f0f23);border:1px solid var(--border);border-radius:20px;padding:24px;max-width:500px;width:100%;margin:40px auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);animation:fadeSlideIn 0.3s ease-out;';
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Start real-time price
    startPriceWs();

    // Show cached/live data IMMEDIATELY — never make user wait
    var _shown = false;
    try {
        var _quick = JSON.parse(localStorage.getItem(DASH_CACHE_KEY));
        if (_quick && _quick.data && (_quick.data.price || _quick.data.blockHeight)) {
            card.innerHTML = renderDashboard(_quick.data);
            _shown = true;
        }
    } catch(e) {}
    if (!_shown) {
        // Try nachoLiveData as fallback
        var fallback = {};
        if (typeof nachoLiveData !== 'undefined') {
            if (nachoLiveData.price) fallback.price = nachoLiveData.price;
            if (nachoLiveData.blockHeight) fallback.blockHeight = nachoLiveData.blockHeight;
        }
        if (!fallback.price) { try { fallback.price = parseFloat(localStorage.getItem('btc_last_price')) || 0; } catch(e) {} }
        if (!fallback.blockHeight) { try { fallback.blockHeight = parseInt(localStorage.getItem('btc_last_height')) || 0; } catch(e) {} }
        if (fallback.price || fallback.blockHeight) {
            card.innerHTML = renderDashboard(fallback);
            _shown = true;
        } else {
            card.innerHTML = '<div style="text-align:center;padding:40px;"><div style="width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px;"></div><div style="color:var(--text-muted);font-size:0.85rem;">Loading Bitcoin metrics...</div></div>';
        }
    }

    // Fetch fresh data in background and re-render
    fetchDashboardData().then(function(data) {
        var c = document.getElementById('btcDashCard');
        if (!c) return;
        if (data && (data.price || data.blockHeight)) {
            c.innerHTML = renderDashboard(data);
        } else if (!_shown) {
            c.innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-size:2rem;margin-bottom:12px;">📊</div><div style="color:var(--text-muted);font-size:0.9rem;margin-bottom:16px;">Unable to load fresh metrics.</div><div style="color:var(--text-faint);font-size:0.8rem;">Showing last known data. Try again later.</div><button onclick="closeDashboard();setTimeout(toggleDashboard,500)" style="margin-top:16px;padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;">Retry</button></div>';
        }
    });

    // Auto-refresh every 2 min
    _dashInterval = setInterval(async function() {
        if (!document.getElementById('btcDashOverlay')) { clearInterval(_dashInterval); return; }
        localStorage.removeItem(DASH_CACHE_KEY); // force fresh
        var fresh = await fetchDashboardData();
        var c = document.getElementById('btcDashCard');
        if (c) c.innerHTML = renderDashboard(fresh);
    }, DASH_CACHE_TTL);
};

window.closeDashboard = function() {
    var overlay = document.getElementById('btcDashOverlay');
    if (overlay) overlay.remove();
    if (_dashInterval) { clearInterval(_dashInterval); _dashInterval = null; }
};

// ---- Auto-inject on page load ----
function init() {
    injectDashboardButton(); // Fixed button — always visible
    injectHomeDashboardButton(); // Larger button on home page
    startPriceWs(); // Start real-time price for the button
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 2000); });
} else {
    setTimeout(init, 2000);
}

})();
