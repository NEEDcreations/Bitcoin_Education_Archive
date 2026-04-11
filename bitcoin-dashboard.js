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
        html += '<div onclick="event.stopPropagation();showDashTip(this,\'' + halvingTip.replace(/[\\'"]/g, "") + '\')" style="background:linear-gradient(135deg,rgba(247,147,26,0.08),rgba(234,88,12,0.04));border:2px solid rgba(247,147,26,0.2);border-radius:14px;padding:16px;margin-bottom:16px;text-align:center;cursor:help;transition:0.2s;position:relative;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'rgba(247,147,26,0.2)\'">';
        html += '<div style="color:var(--text-faint);font-size:0.65rem;text-transform:uppercase;letter-spacing:1.5px;font-weight:800;margin-bottom:8px;">⏳ Next Halving — Block #' + fmtNum(d.halvingBlock) + ' <span style="opacity:0.4;font-size:0.55rem;">ⓘ</span></div>';
        // Store halving target for live countdown
        window._halvingTargetMs = Date.now() + (d.halving * 10 * 60 * 1000);

        html += '<div id="halvingCountdown" style="display:flex;justify-content:center;gap:12px;margin-bottom:10px;">';
        html += '<div><div id="halvDays" style="font-size:1.8rem;font-weight:900;color:var(--accent);line-height:1;">' + (d.halvingDays || 0) + '</div><div style="font-size:0.6rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Days</div></div>';
        html += '<div style="font-size:1.4rem;color:var(--text-faint);font-weight:300;">:</div>';
        html += '<div><div id="halvHours" style="font-size:1.8rem;font-weight:900;color:var(--accent);line-height:1;">' + (d.halvingHours || 0) + '</div><div style="font-size:0.6rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Hours</div></div>';
        html += '<div style="font-size:1.4rem;color:var(--text-faint);font-weight:300;">:</div>';
        html += '<div><div id="halvMins" style="font-size:1.8rem;font-weight:900;color:var(--accent);line-height:1;">' + (d.halvingMins || 0) + '</div><div style="font-size:0.6rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Mins</div></div>';
        html += '<div style="font-size:1.4rem;color:var(--text-faint);font-weight:300;">:</div>';
        html += '<div><div id="halvSecs" style="font-size:1.8rem;font-weight:900;color:#ea580c;line-height:1;">00</div><div style="font-size:0.6rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Secs</div></div>';
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

    // Fear & Greed moved to Top Indicators section

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

    // Top Indicators (expandable)
    html += '<div style="margin-top:16px;">';
    html += '<button id="topIndicatorsBtn" onclick="toggleTopIndicators()" style="width:100%;padding:14px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;transition:0.2s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">';
    html += '📊 Top Indicators <span id="topIndArrow">▼</span></button>';
    html += '<div id="topIndicatorsPanel" style="display:none;margin-top:10px;animation:fadeSlideIn 0.3s;">';
    html += '<div id="topIndContent" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
    html += '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted);font-size:0.8rem;"><div style="width:24px;height:24px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 8px;"></div>Loading indicators...</div>';
    html += '</div></div></div>';

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
    var tipAttr = tip ? ' onclick="event.stopPropagation();showDashTip(this,\'' + tip.replace(/[\\'"]/g, "").replace(/"/g, '&quot;') + '\')" style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;cursor:help;transition:0.2s;position:relative;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'"' : ' style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;"';
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

    // Fetch fresh data in background and re-render (preserve indicators state)
    fetchDashboardData().then(function(data) {
        var c = document.getElementById('btcDashCard');
        if (!c) return;
        var indPanel = document.getElementById('topIndicatorsPanel');
        var indWasOpen = indPanel && indPanel.style.display !== 'none';
        if (data && (data.price || data.blockHeight)) {
            c.innerHTML = renderDashboard(data);
        } else if (!_shown) {
            c.innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-size:2rem;margin-bottom:12px;">📊</div><div style="color:var(--text-muted);font-size:0.9rem;margin-bottom:16px;">Unable to load fresh metrics.</div><div style="color:var(--text-faint);font-size:0.8rem;">Showing last known data. Try again later.</div><button onclick="closeDashboard();setTimeout(toggleDashboard,500)" style="margin-top:16px;padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;">Retry</button></div>';
        }
        if (indWasOpen) {
            var newPanel = document.getElementById('topIndicatorsPanel');
            var newArrow = document.getElementById('topIndArrow');
            if (newPanel) { newPanel.style.display = 'block'; _topIndLoaded = false; loadTopIndicators(); }
            if (newArrow) newArrow.textContent = '▲';
        }
    });

    // Auto-refresh every 2 min — preserve top indicators panel state
    _dashInterval = setInterval(async function() {
        if (!document.getElementById('btcDashOverlay')) { clearInterval(_dashInterval); return; }
        // Remember if top indicators panel was open
        var indPanel = document.getElementById('topIndicatorsPanel');
        var indWasOpen = indPanel && indPanel.style.display !== 'none';
        localStorage.removeItem(DASH_CACHE_KEY); // force fresh
        var fresh = await fetchDashboardData();
        var c = document.getElementById('btcDashCard');
        if (c) {
            c.innerHTML = renderDashboard(fresh);
            // Restore top indicators panel state
            if (indWasOpen) {
                var newPanel = document.getElementById('topIndicatorsPanel');
                var newArrow = document.getElementById('topIndArrow');
                if (newPanel) { newPanel.style.display = 'block'; _topIndLoaded = false; loadTopIndicators(); }
                if (newArrow) newArrow.textContent = '▲';
            }
        }
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

// ---- Top Indicators ----
window.toggleTopIndicators = function() {
    var panel = document.getElementById('topIndicatorsPanel');
    var arrow = document.getElementById('topIndArrow');
    if (!panel) return;
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        arrow.textContent = '▲';
        loadTopIndicators();
    } else {
        panel.style.display = 'none';
        arrow.textContent = '▼';
    }
};

var _topIndLoaded = false;
var TOP_IND_CACHE_KEY = 'btc_top_indicators_cache';
function loadTopIndicators() {
    if (_topIndLoaded) return;
    _topIndLoaded = true;
    var el = document.getElementById('topIndContent');
    if (!el) return;

    // Try to show cached data immediately while fresh data loads
    try {
        var cached = JSON.parse(localStorage.getItem(TOP_IND_CACHE_KEY));
        if (cached && cached.html && (Date.now() - cached.ts < 3600000)) { // 1 hour cache
            el.innerHTML = cached.html;
        }
    } catch(e) {}

    var d = _dashData || {};
    var price = d.price || 0;
    var height = d.blockHeight || 0;
    var supply = d.supply || 0;
    var fearGreed = d.fearGreed || 0;
    var fearLabel = d.fearGreedLabel || '—';

    // Calculate indicators from available data
    var indicators = [];

    // 1. Stock-to-Flow
    if (height) {
        var epoch = Math.floor(height / 210000);
        var blockReward = 50 / Math.pow(2, epoch);
        var annualFlow = blockReward * 6 * 24 * 365;
        var currentSupply = supply || 19800000;
        var s2f = annualFlow > 0 ? currentSupply / annualFlow : 0;
        var s2fModelPrice = Math.pow(10, 3.31954 * Math.log10(s2f) - 1.32093); // simplified S2F model
        var s2fRatio = price > 0 ? (price / s2fModelPrice).toFixed(2) : '—';
        indicators.push({
            emoji: '📈', name: 'Stock-to-Flow',
            value: s2f.toFixed(1),
            sub: 'Model: $' + fmtNum(Math.round(s2fModelPrice)) + ' · Ratio: ' + s2fRatio + 'x',
            tip: 'Stock-to-Flow measures scarcity. Higher S2F = scarcer asset. Bitcoin\'s S2F increases with each halving. Gold is ~62, Silver ~22. A ratio below 1x suggests undervalued vs the model.'
        });
    }

    // 2. Fear & Greed (already fetched)
    if (fearGreed) {
        var fgColor = fearGreed <= 25 ? '#ef4444' : fearGreed <= 45 ? '#f97316' : fearGreed <= 55 ? '#eab308' : fearGreed <= 75 ? '#84cc16' : '#22c55e';
        indicators.push({
            emoji: '😱', name: 'Fear & Greed',
            value: fearGreed,
            color: fgColor,
            sub: fearLabel,
            tip: 'Crypto Fear & Greed Index. 0 = Extreme Fear (potential buy), 100 = Extreme Greed (potential sell). Aggregates volatility, momentum, social media, and surveys.'
        });
    }

    // 3. Mayer Multiple (price / 200-day MA) — we'll estimate from ATH
    // We can't get 200-day MA without historical data, but we can show placeholder and fetch
    indicators.push({ emoji: '📐', name: 'Mayer Multiple', value: '...', sub: 'Loading...', tip: 'Price divided by 200-day moving average. Below 1.0 = historically cheap. Above 2.4 = overheated. Named after Trace Mayer.', id: 'mayerMultiple' });

    // 4. Halving Cycle Position
    if (height) {
        var blocksInEpoch = height % 210000;
        var epochPct = ((blocksInEpoch / 210000) * 100).toFixed(1);
        var daysInEpoch = Math.round(blocksInEpoch * 10 / 1440);
        var cyclePeakWindow = daysInEpoch >= 365 && daysInEpoch <= 730;
        indicators.push({
            emoji: '🔄', name: 'Halving Cycle',
            value: epochPct + '%',
            sub: 'Day ' + daysInEpoch + '/~1460' + (cyclePeakWindow ? ' · 🔥 Peak Window' : ''),
            color: cyclePeakWindow ? '#f97316' : null,
            tip: 'Position in the current 4-year halving cycle (210,000 blocks). Historically, price peaks occur 12-24 months after a halving (Day 365-730). We are at day ' + daysInEpoch + '.'
        });
    }

    // 6. Days Since ATH
    if (d.ath && d.athDate) {
        var athDate = new Date(d.athDate);
        var daysSinceATH = Math.floor((Date.now() - athDate.getTime()) / 86400000);
        var drawdown = d.athChange ? Math.abs(d.athChange).toFixed(1) : '—';
        indicators.push({
            emoji: '🏔️', name: 'ATH Drawdown',
            value: '-' + drawdown + '%',
            sub: daysSinceATH + ' days since ATH ($' + fmtNum(Math.round(d.ath)) + ')',
            tip: 'Current drawdown from the all-time high. In previous cycles, bear markets saw -70% to -85% drawdowns. Recovery to new ATH has always followed.'
        });
    }

    // 7. Thermocap Multiple (rough estimate)
    if (price && supply && height) {
        var epoch = Math.floor(height / 210000);
        // Rough total miner revenue estimate
        var thermocap = 0;
        var h = height;
        for (var i = 0; i <= epoch && h > 0; i++) {
            var epochBlocks = Math.min(h, 210000);
            var reward = 50 / Math.pow(2, i);
            thermocap += epochBlocks * reward;
            h -= epochBlocks;
        }
        // Very rough — assumes avg price over time ~$30k
        var thermocapUSD = thermocap * 30000;
        var marketCap = price * supply;
        var thermoMultiple = thermocapUSD > 0 ? (marketCap / thermocapUSD).toFixed(1) : '—';
        indicators.push({
            emoji: '🌡️', name: 'Thermo Multiple',
            value: thermoMultiple + 'x',
            sub: 'Market Cap / Thermocap',
            tip: 'Thermocap Multiple compares market cap to total miner revenue (a proxy for "energy spent"). Values >5x historically signal overheating (cycle tops hit 4-8x). <10x = accumulation zone.'
        });
    }

    // 9. NVT Ratio (Network Value to Transactions)
    if (price && supply && d.volume24h) {
        var marketCapNVT = price * supply;
        var nvt = d.volume24h > 0 ? (marketCapNVT / d.volume24h).toFixed(1) : '—';
        var nvtColor = nvt < 30 ? '#22c55e' : nvt > 150 ? '#ef4444' : 'var(--heading)';
        indicators.push({
            emoji: '📡', name: 'NVT Ratio',
            value: nvt,
            color: nvtColor,
            sub: nvt < 30 ? 'Undervalued zone' : nvt > 150 ? 'Overvalued zone' : 'Normal range',
            tip: 'Network Value to Transactions ratio. Compares market cap to annualized transaction volume. Below 30 = undervalued relative to usage. Above 150 = potentially overvalued. Think of it like P/E ratio for Bitcoin.'
        });
    }

    // 11. Bitcoin Dominance (from market cap vs total crypto market)
    if (d.marketCap) {
        // CoinGecko gives BTC market cap; total crypto ~$2.5T estimate
        var totalCryptoMarketCap = d.marketCap / 0.62; // rough estimate: BTC ~62% dominance
        var dominance = ((d.marketCap / totalCryptoMarketCap) * 100).toFixed(1);
        // Actually, use a more accurate approach — fetch or estimate
        indicators.push({
            emoji: '👑', name: 'BTC Dominance',
            value: '~62%',
            sub: 'Market cap share vs all crypto',
            tip: 'Bitcoin\'s share of the total cryptocurrency market cap. Higher dominance = Bitcoin is outperforming alts. During alt seasons, dominance drops below 40%. During Bitcoin seasons (now), it rises above 55-65%. Historically, increasing dominance signals strength.',
            id: 'btcDominance'
        });
    }

    // MVRV Z-Score (loaded from CBBI API)
    indicators.push({
        emoji: '💎', name: 'MVRV Z-Score',
        value: '...', color: 'var(--heading)',
        sub: 'Loading from CBBI...',
        tip: 'Market Value to Realized Value ratio. Compares market cap to realized cap (sum of each coin valued at its last move price). Above 3.0 historically marks cycle tops. Below 1.0 marks bottoms. Data from CBBI open-source API. Top threshold: normalized \u2265 0.7 (\u2248 MVRV 3+).',
        id: 'mvrvScore'
    });

    // 13. Power Law Deviation
    if (price) {
        var genesisDate = new Date('2009-01-03T00:00:00Z');
        var daysSinceGenesis = Math.floor((Date.now() - genesisDate.getTime()) / 86400000);
        // Power law model: log10(price) = a * log10(days) + b
        // Fitted params (commonly used): a ≈ 5.82, b ≈ -17.01
        var plA = 5.82, plB = -17.01;
        var logFairPrice = plA * Math.log10(daysSinceGenesis) + plB;
        var fairPrice = Math.pow(10, logFairPrice);
        var plDeviation = ((price - fairPrice) / fairPrice * 100).toFixed(0);
        var plDeviationNum = parseFloat(plDeviation);
        // Upper band (~3x fair value historically = cycle top zone)
        var plTopThreshold = 200; // >200% above = extreme top territory
        var plColor = plDeviationNum > plTopThreshold ? '#ef4444' : plDeviationNum > 100 ? '#f97316' : plDeviationNum < -30 ? '#22c55e' : 'var(--heading)';
        var plFlashing = plDeviationNum > plTopThreshold;
        var plLabel = plDeviationNum > plTopThreshold ? 'Far above — extreme ⚠️' : plDeviationNum > 100 ? 'Above trend — elevated' : plDeviationNum > 0 ? 'Above fair value' : plDeviationNum > -30 ? 'Near fair value' : 'Below trend — deep value 🟢';
        indicators.push({
            emoji: '📏', name: 'Power Law',
            value: (plDeviationNum >= 0 ? '+' : '') + plDeviation + '%',
            color: plColor,
            sub: 'Fair value: ~$' + fmtNum(Math.round(fairPrice)) + ' · ' + plLabel,
            tip: 'Bitcoin Power Law model tracks the long-term price trend using a log-log regression since genesis (Jan 3, 2009). Parameters: P = 10^(5.82 × log₁₀(days) - 17.01). Above +200% = historically extreme (cycle top zone). Below -30% = deep value accumulation. Current: ' + daysSinceGenesis + ' days since genesis.',
            flashing: plFlashing
        });
    }

    // 14. Pi Cycle Top Indicator (needs 111d MA and 350d MA×2 — placeholder, fetched async)
    indicators.push({
        emoji: '🔵', name: 'Pi Cycle Top',
        value: '...',
        sub: 'Loading...',
        tip: 'When the 111-day MA crosses above the 350-day MA × 2, it has historically signaled the exact top of every Bitcoin cycle. Flashes when the gap narrows to <5%.',
        id: 'piCycleTop',
        flashing: false
    });

    // 15. Puell Multiple (daily miner revenue / 365-day avg)
    if (height && price) {
        var _blockReward = (d.subsidy ? parseFloat(d.subsidy) : 3.125);
        var dailyMinerRevenue = _blockReward * 144 * price;
        // Rough 365-day avg: use a historical avg BTC price estimate × avg reward
        // More accurate: avg price over last year ~$60K with reward 3.125
        var avgDailyRevenue365 = 3.125 * 144 * 60000; // rough estimate
        var puell = avgDailyRevenue365 > 0 ? (dailyMinerRevenue / avgDailyRevenue365).toFixed(2) : '—';
        var puellNum = parseFloat(puell);
        indicators.push({
            emoji: '⛏️', name: 'Puell Multiple',
            value: puell,
            color: puellNum > 2.2 ? '#ef4444' : puellNum < 0.5 ? '#22c55e' : 'var(--heading)',
            sub: puellNum > 2.2 ? 'Miners overleveraged ⚠️' : puellNum < 0.5 ? 'Miner capitulation zone 🟢' : 'Normal range',
            tip: 'Ratio of daily miner revenue to its 365-day moving average. Above 2.2 = miners are earning far more than usual (historically a sell signal). Below 0.5 = miner capitulation (buy signal). Top threshold: ≥ 2.2.',
            flashing: puellNum >= 2.2
        });
    }


// 17. Bitcoin Rainbow Chart Band (exact RainbowChart.com formula)
    if (price) {
        // Source: rainbowchart.com/javascripts/charts/rainbow.js
        // x = ln(dayIndex + 1400), dayIndex = days since ~2010-07-18 (first price data)
        var _dataStart = new Date('2010-07-18');
        var _dayIdx = Math.floor((Date.now() - _dataStart.getTime()) / 86400000);
        var _rx = Math.log(_dayIdx + 1400);
        var _rIntercept = 19.863; // 19.463 + 0.4 adjustment
        // Band boundaries (slopes from source): each band = 10^(slope * x - intercept)
        var _rSlopes = [2.775, 2.788, 2.801, 2.815, 2.8295, 2.8445, 2.859, 2.872, 2.886, 2.90];
        var _rNames = ['Bitcoin is dead 💀', 'Fire Sale 🔵', 'BUY! 🟢', 'Accumulate 🟢', 'Still Cheap 💚', 'HODL 🟡', 'Is this a bubble? 🟠', 'FOMO 🟠', 'Sell. Seriously. 🔴', 'Max Bubble 🔴'];
        var _rColors = ['#9568db', '#4472c4', '#54989f', '#63be7b', '#b1d580', '#ffeb84', '#f6b45a', '#ed7d31', '#d64018', '#c00000'];
        var rainbowBand = 10; // default to top
        for (var _rb = 0; _rb < _rSlopes.length; _rb++) {
            var _bandTop = Math.pow(10, _rSlopes[_rb] * _rx - _rIntercept);
            if (price < _bandTop) { rainbowBand = _rb + 1; break; }
        }
        rainbowBand = Math.max(1, Math.min(10, rainbowBand));
        var _bandName = _rNames[rainbowBand - 1] || 'Max Bubble 🔴';
        var _bandColor = _rColors[rainbowBand - 1] || '#c00000';
        indicators.push({
            emoji: '🌈', name: 'Rainbow Band',
            value: rainbowBand + ' / 10',
            color: _bandColor,
            sub: _bandName,
            tip: 'Bitcoin Rainbow Chart (RainbowChart.com formula). Band 1 (purple) = Bitcoin is dead. Band 10 (dark red) = Max Bubble. Cycle tops reach band 8-10. Top threshold: ≥ 9.',
            flashing: rainbowBand >= 9
        });
    }

// 18. 4-Year MA Multiplier
    if (price) {
        // The 4-year (1460-day) moving average × 3.5 has historically caught tops
        // We estimate the 4-year MA from the power law fair value
        var _genesis = new Date('2009-01-03T00:00:00Z');
        var _daysNow = Math.floor((Date.now() - _genesis.getTime()) / 86400000);
        // Average price over last 4 years — rough estimate using power law values
        var _sum4y = 0;
        for (var _dy = 0; _dy < 1460; _dy++) {
            var _d = _daysNow - _dy;
            if (_d > 365) _sum4y += Math.pow(10, 5.82 * Math.log10(_d) - 17.01);
        }
        var ma4y = _sum4y / 1460;
        var ma4yMultiplier = ma4y > 0 ? (price / ma4y).toFixed(2) : '—';
        var ma4yNum = parseFloat(ma4yMultiplier);
        indicators.push({
            emoji: '📊', name: '4-Year MA Multiple',
            value: ma4yMultiplier + 'x',
            color: ma4yNum >= 3.5 ? '#ef4444' : ma4yNum < 1 ? '#22c55e' : 'var(--heading)',
            sub: 'Est. 4Y MA: ~$' + fmtNum(Math.round(ma4y)) + (ma4yNum >= 3.5 ? ' · Top zone ⚠️' : ''),
            tip: 'Price divided by the 4-year (1460-day) moving average. Historically, when price exceeds 3.5× the 4-year MA, it signals a cycle top. Below 1× = accumulation zone. Top threshold: ≥ 3.5.',
            flashing: ma4yNum >= 3.5
        });
    }

    // NUPL (loaded from CBBI API — RUPL metric)
    indicators.push({
        emoji: '💰', name: 'NUPL',
        value: '...', color: 'var(--heading)',
        sub: 'Loading from CBBI...',
        tip: 'Net Unrealized Profit/Loss. Shows aggregate profit/loss of all Bitcoin holders. Above 75% = euphoria (top zone). Below 0% = capitulation (bottom zone). Data from CBBI open-source API. Top threshold: normalized \u2265 0.75.',
        id: 'nuplScore'
    });

    // 20. Altcoin Season Index (BTC dominance inverse — estimated)
    // Moved from simple dominance to include flashing at <40% (alt season = BTC top risk)
    // (BTC Dominance is already indicator 11 — this adds the alt season angle)

    // 21. AHR999 Index (cost-averaging indicator)
    if (price && height) {
        var _dsg3 = Math.floor((Date.now() - new Date('2009-01-03').getTime()) / 86400000);
        var logFit = Math.pow(10, 5.82 * Math.log10(_dsg3) - 17.01); // power law fair value
        // AHR999 = (price / 200d MA) * (price / fitted value)
        // We'll use power law as fitted value, estimate 200d MA from async (placeholder)
        var ahr999 = logFit > 0 ? (price / logFit).toFixed(2) : '—';
        var ahrNum = parseFloat(ahr999);
        indicators.push({
            emoji: '🔢', name: 'AHR999',
            value: ahr999,
            color: ahrNum > 1.2 ? '#ef4444' : ahrNum < 0.45 ? '#22c55e' : 'var(--heading)',
            sub: ahrNum > 1.2 ? 'Overvalued — stop DCA ⚠️' : ahrNum < 0.45 ? 'Deep value — DCA zone 🟢' : ahrNum < 1 ? 'Below model — DCA' : 'Near model',
            tip: 'AHR999 compares current price to its long-term model value. Below 0.45 = extreme buy (accumulate aggressively). Above 1.2 = stop DCA, consider selling. Used by cost-averaging investors to time entries. Top threshold: ≥ 1.2.',
            flashing: ahrNum >= 1.2
        });
    }

    // 22. 2-Year MA Multiplier
    if (price) {
        // 2-year (730d) MA and 5× that MA
        var _gen3 = new Date('2009-01-03T00:00:00Z');
        var _dn3 = Math.floor((Date.now() - _gen3.getTime()) / 86400000);
        var _sum2y = 0;
        for (var _d2y = 0; _d2y < 730; _d2y++) {
            var _dd = _dn3 - _d2y;
            if (_dd > 365) _sum2y += Math.pow(10, 5.82 * Math.log10(_dd) - 17.01);
        }
        var ma2y = _sum2y / 730;
        var ma2yx5 = ma2y * 5;
        var above2y = price > ma2yx5;
        indicators.push({
            emoji: '📉', name: '2-Year MA ×5',
            value: (price / ma2y).toFixed(2) + 'x',
            color: above2y ? '#ef4444' : price < ma2y ? '#22c55e' : 'var(--heading)',
            sub: 'MA: $' + fmtNum(Math.round(ma2y)) + ' · ×5: $' + fmtNum(Math.round(ma2yx5)) + (above2y ? ' · Above ⚠️' : ''),
            tip: 'Price relative to the 2-year (730-day) moving average. Historically, buying below the 2-year MA yields huge returns. Selling when price exceeds 5× the 2-year MA catches tops. Top threshold: price above 5× MA.',
            flashing: above2y
        });
    }

    // 23. Golden Ratio Multiplier
    if (price) {
        var _gen4 = new Date('2009-01-03T00:00:00Z');
        var _dn4 = Math.floor((Date.now() - _gen4.getTime()) / 86400000);
        // 350d MA × golden ratio multiples (1.6, 2, 3, 5, 8, 13, 21)
        var _sum350g = 0;
        for (var _d350 = 0; _d350 < 350; _d350++) {
            var _ddd = _dn4 - _d350;
            if (_ddd > 365) _sum350g += Math.pow(10, 5.82 * Math.log10(_ddd) - 17.01);
        }
        var ma350g = _sum350g / 350;
        var goldenRatio = ma350g > 0 ? (price / ma350g).toFixed(2) : '—';
        var grNum = parseFloat(goldenRatio);
        var grLevel = grNum >= 8 ? 'Above ×8 — max top ⚠️' : grNum >= 5 ? 'Above ×5 — overheated' : grNum >= 3 ? 'Above ×3 — elevated' : grNum >= 1.6 ? 'Above ×1.6 — bullish' : 'Below ×1.6';
        indicators.push({
            emoji: '🔱', name: 'Golden Ratio',
            value: goldenRatio + 'x',
            color: grNum >= 5 ? '#ef4444' : grNum >= 3 ? '#f97316' : 'var(--heading)',
            sub: '350d MA: $' + fmtNum(Math.round(ma350g)) + ' · ' + grLevel,
            tip: 'Price relative to the 350-day MA using Fibonacci golden ratio multiples (1.6, 2, 3, 5, 8, 13, 21). Each cycle top has touched a lower multiple. Top threshold: ≥ 5×.',
            flashing: grNum >= 5
        });
    }

    // 24. Bitcoin Terminal Price
    if (height && supply && price) {
        // Terminal Price = Transferred Price × 21
        // Transferred Price ≈ Thermocap / supply × coin days destroyed ratio
        // Simplified: Terminal Price ≈ (cumulative block rewards × avg price) / supply × 21
        var _thermBTC3 = 0;
        var _h3 = height;
        for (var _ep3 = 0; _ep3 <= Math.floor(height / 210000) && _h3 > 0; _ep3++) {
            var _epB3 = Math.min(_h3, 210000);
            _thermBTC3 += _epB3 * (50 / Math.pow(2, _ep3));
            _h3 -= _epB3;
        }
        var transferredPrice = supply > 0 ? (_thermBTC3 * 30000 / supply) : 0;
        var terminalPrice = transferredPrice * 21;
        var termPct = terminalPrice > 0 ? ((price / terminalPrice) * 100).toFixed(0) : '—';
        indicators.push({
            emoji: '🎯', name: 'Terminal Price',
            value: '$' + fmtNum(Math.round(terminalPrice)),
            color: price >= terminalPrice ? '#ef4444' : 'var(--heading)',
            sub: 'Current: ' + termPct + '% of terminal · ' + (price >= terminalPrice ? 'ABOVE — extreme ⚠️' : 'Below terminal'),
            tip: 'Terminal Price = Transferred Price × 21. Represents a theoretical maximum based on cumulative miner revenue and coin movement. Every cycle top has approached or exceeded this level. Top threshold: price ≥ Terminal Price.',
            flashing: price >= terminalPrice
        });
    }

    // 25. Bitcoin Bubble Index (price deviation from log trend)
    if (price) {
        var _dsg5 = Math.floor((Date.now() - new Date('2009-01-03').getTime()) / 86400000);
        var logTrend = Math.pow(10, 5.82 * Math.log10(_dsg5) - 17.01);
        // Bubble index: how many standard deviations above log trend
        // Historical 1σ ~= 0.3 in log space
        var logDev = logTrend > 0 ? (Math.log10(price) - Math.log10(logTrend)) / 0.3 : 0;
        var bubbleIdx = logDev.toFixed(1);
        var bubbleNum = parseFloat(bubbleIdx);
        indicators.push({
            emoji: '🫧', name: 'Bubble Index',
            value: bubbleIdx + 'σ',
            color: bubbleNum >= 2 ? '#ef4444' : bubbleNum >= 1 ? '#f97316' : bubbleNum < -1 ? '#22c55e' : 'var(--heading)',
            sub: bubbleNum >= 2 ? 'Extreme bubble ⚠️' : bubbleNum >= 1 ? 'Elevated' : bubbleNum < -1 ? 'Deep discount 🟢' : 'Normal',
            tip: 'How many standard deviations Bitcoin\'s price is above its long-term log trend. Above +2σ = extreme bubble territory (historical tops). Below -1σ = deep value. Top threshold: ≥ 2σ.',
            flashing: bubbleNum >= 2
        });
    }

    // 26. 3-Month Annualized Return
    if (price) {
        // Estimate 90-day ago price from power law (rough)
        var _dsg6 = Math.floor((Date.now() - new Date('2009-01-03').getTime()) / 86400000);
        var price90d = Math.pow(10, 5.82 * Math.log10(_dsg6 - 90) - 17.01);
        // Better: use actual price change if we have fear/greed cached data
        // For now use ratio of current to 90d estimated
        var annualized3m = price90d > 0 ? (Math.pow(price / price90d, 4) - 1) * 100 : 0;
        var ann3mStr = annualized3m.toFixed(0);
        var ann3mNum = parseFloat(ann3mStr);
        indicators.push({
            emoji: '🚀', name: '3M Annualized',
            value: (ann3mNum >= 0 ? '+' : '') + ann3mStr + '%',
            color: ann3mNum > 200 ? '#ef4444' : ann3mNum > 100 ? '#f97316' : 'var(--heading)',
            sub: ann3mNum > 200 ? 'Unsustainable — top risk ⚠️' : ann3mNum > 100 ? 'Very high' : 'Normal',
            tip: '3-month return annualized. When Bitcoin is gaining over 200% annualized, it historically signals the late stages of a bull run. Top threshold: > 200%.',
            flashing: ann3mNum > 200,
            id: 'ann3m'
        });
    }

    // 27. MicroStrategy Avg Bitcoin Cost
    // MSTR holds ~762K BTC at avg cost ~$75.7K (as of March 2026, updated periodically)
    if (price) {
        var mstrAvgCost = 75694; // update periodically from public filings
        var mstrBTC = 762099;
        var mstrPnL = ((price - mstrAvgCost) / mstrAvgCost * 100).toFixed(1);
        indicators.push({
            emoji: '🏢', name: 'MSTR Avg Cost',
            value: '$' + fmtNum(mstrAvgCost),
            sub: fmtNum(mstrBTC) + ' BTC · P&L: ' + (mstrPnL >= 0 ? '+' : '') + mstrPnL + '%',
            tip: 'MicroStrategy (MSTR) average Bitcoin acquisition cost. When price is far above MSTR\'s cost basis, it indicates broader market euphoria. MSTR holds ' + fmtNum(mstrBTC) + ' BTC. Informational — no top threshold.',
            flashing: false, noFlashLogic: true
        });
    }


    // --- CBBI-sourced indicators (fetched async from colintalkscrypto.com) ---
    // CBBI Confidence
    indicators.push({
        emoji: '🎯', name: 'CBBI Index',
        value: '...', color: 'var(--heading)',
        sub: 'Loading CBBI data...',
        tip: 'Colin Talks Crypto Bitcoin Bull Run Index. Combines 9 on-chain metrics into a single 0-100 confidence score. Above 80 = approaching cycle top. Below 20 = approaching bottom. Open source. Top threshold: ≥ 80.',
        id: 'cbbiScore'
    });

    // RHODL Ratio (from CBBI data)
    indicators.push({
        emoji: '💎', name: 'RHODL Ratio',
        value: '...', color: 'var(--heading)',
        sub: 'Loading...',
        tip: 'Realized HODL Ratio. Compares 1-week realized value to 1-2 year realized value, adjusted by market age. High values = speculative activity dominating (top signal). Low values = long-term holders dominating. Top threshold: normalized ≥ 0.85.',
        id: 'rhodlRatio'
    });

    // Woobull / Macro Oscillator (from CBBI data)
    indicators.push({
        emoji: '📊', name: 'Macro Oscillator',
        value: '...', color: 'var(--heading)',
        sub: 'Loading...',
        tip: 'Bitcoin Macro Oscillator (Woobull). Composite z-score of MVRV, VWAP, CVDD, and Sharpe ratios. Above 0.7 = euphoria zone. Below 0.2 = accumulation zone. Top threshold: normalized ≥ 0.7.',
        id: 'macroOsc'
    });


    // Smithson's Forecast (quantile regression model)
    if (price) {
        // Sminston With model: 99th percentile quantile regression
        // Target range ~$175K-$275K for this cycle (from CoinGlass: 175k-230k)
        var smithsonTarget = 230000; // cycle top target
        var smithsonLow = 175000;
        var smithsonProgress = ((price / smithsonTarget) * 100).toFixed(1);
        indicators.push({
            emoji: '🔮', name: "Smithson's Forecast",
            value: smithsonProgress + '%',
            color: parseFloat(smithsonProgress) >= 90 ? '#ef4444' : 'var(--heading)',
            sub: 'Target: $' + fmtNum(smithsonLow) + '-$' + fmtNum(smithsonTarget) + ' · Current: $' + fmtNum(Math.round(price)),
            tip: 'Sminston With quantile regression model (99th percentile). Forecasts cycle top at $175K-$230K. Progress shows how close current price is to the upper target. Top threshold: ≥ 90% of target.',
            flashing: parseFloat(smithsonProgress) >= 90
        });
    }


    // LTH/STH Supply Ratio (estimated from CBBI metrics)
    indicators.push({
        emoji: '⏳', name: 'LTH/STH Ratio',
        value: '...', color: 'var(--heading)',
        sub: 'Estimated from CBBI data...',
        tip: 'Long-Term Holder to Short-Term Holder supply ratio (estimated). When LTH supply drops sharply (distributing to STH), it signals late-cycle selling. When LTH supply grows, holders are accumulating. Derived from CBBI on-chain metrics. Top threshold: CBBI MVRV + Puell both > 0.7.',
        id: 'lthSthRatio'
    });

    // 28. RSI-22 Day (loaded async with Mayer Multiple from 350d CoinGecko data)
    indicators.push({
        emoji: '📉', name: 'RSI-22 Day',
        value: '...', color: 'var(--heading)',
        sub: 'Loading...',
        tip: 'Relative Strength Index over 22 days. Above 80 = overbought (potential top signal). Below 30 = oversold (potential bottom). 22-day RSI smooths out short-term noise. Top threshold: ≥ 80.',
        id: 'rsi22d'
    });

    // 29. AHR999x Escape Top Indicator
    // Uses price / 200d MA — when above 8, historically marks top territory
    indicators.push({
        emoji: '🚨', name: 'AHR999x',
        value: '...', color: 'var(--heading)',
        sub: 'Loading 200d MA...',
        tip: 'AHR999x Escape Top indicator. Calculated as (price / 200-day MA)². When above 8, signals extreme overvaluation. Above 3.5 = elevated. A complement to the AHR999 DCA indicator. Top threshold: ≥ 8.',
        id: 'ahr999x'
    });

    // 30. ETF-to-BTC Ratio (ETF AUM / BTC market cap)
    indicators.push({
        emoji: '🏦', name: 'ETF/BTC Ratio',
        value: '...', color: 'var(--heading)',
        sub: 'Loading ETF data...',
        tip: 'Bitcoin spot ETF total AUM divided by BTC market cap. Shows how much of Bitcoin\'s value is held in ETFs. High ratios (>8%) could indicate institutional overexposure. Low ratios = room to grow. Top threshold: ≥ 8%.',
        id: 'etfBtcRatio'
    });

    // 31. Bitcoin ETF Net Flows (fetched async from data/etf-flows.json)
    indicators.push({
        emoji: '📊', name: 'ETF Net Flow',
        value: '...', color: 'var(--heading)',
        sub: 'Loading ETF data...',
        tip: 'Daily Bitcoin spot ETF net inflows/outflows. Sustained outflows (7+ days) can signal institutional selling. Sustained inflows signal demand. Data from Bitbo/BitcoinTreasuries. Top threshold: 7+ consecutive outflow days.',
        flashing: false, id: 'etfNetFlow'
    });

    // 29. ETF 5-Day Flow
    indicators.push({
        emoji: '📈', name: 'ETF 5-Day Flow',
        value: '...', color: 'var(--heading)',
        sub: 'Loading...',
        tip: 'Sum of last 5 trading days of ETF flows. Large negative = sustained selling pressure. Large positive = accumulation. Top threshold: 5-day sum below -$500M.',
        flashing: false, id: 'etf5dFlow'
    });

    

    // Determine flashing status for each indicator (signaling potential top)
    indicators.forEach(function(ind) {
        if (ind.noFlashLogic) return;
        if (ind.flashing !== undefined) return; // already set
        var n = ind.name;
        if (n === 'Stock-to-Flow') ind.flashing = price > 0 && s2fModelPrice > 0 && price > s2fModelPrice * 1.5;
        else if (n === 'Fear & Greed') ind.flashing = fearGreed >= 75;
        else if (n === 'Mayer Multiple') ind.flashing = false; // updated async later
        else if (n === 'Halving Cycle') ind.flashing = ind.sub && ind.sub.indexOf('Peak Window') !== -1;
                else if (n === 'ATH Drawdown') ind.flashing = parseFloat(ind.value) > -5; // within 5% of ATH
        else if (n === 'Thermo Multiple') ind.flashing = parseFloat(ind.value) > 5;
        else if (n === 'NVT Ratio') ind.flashing = parseFloat(ind.value) > 150;
                else if (n === 'BTC Dominance') ind.flashing = false; // updated async
        else if (n === 'MVRV Z-Score') ind.flashing = false; // updated async from CBBI
        else if (n === 'NUPL') ind.flashing = false; // updated async from CBBI
                else ind.flashing = false;
    });

    var flashingCount = indicators.filter(function(i) { return i.flashing; }).length;
    var topSignalIndicators = indicators.filter(function(i) { return !i.noFlashLogic; }).length;

    // Render indicators
    var html = '';
    // Top signal counter
    var pctFlashing = topSignalIndicators > 0 ? Math.round((flashingCount / topSignalIndicators) * 100) : 0;
    var counterColor = flashingCount === 0 ? '#22c55e' : pctFlashing < 15 ? '#eab308' : pctFlashing < 40 ? '#f97316' : '#ef4444';
    var counterLabel = flashingCount === 0 ? 'No top signals — Accumulate 🟢' : pctFlashing < 15 ? 'Few signals — Monitor 🟡' : pctFlashing < 40 ? 'Multiple signals — Caution 🟠' : 'Many signals — Extreme caution 🔴';
    html += '<div style="grid-column:1/-1;padding:12px 16px;background:rgba(' + (flashingCount === 0 ? '34,197,94' : flashingCount <= 3 ? '234,179,8' : flashingCount <= 6 ? '249,115,22' : '239,68,68') + ',0.08);border:1px solid rgba(' + (flashingCount === 0 ? '34,197,94' : flashingCount <= 3 ? '234,179,8' : flashingCount <= 6 ? '249,115,22' : '239,68,68') + ',0.25);border-radius:12px;text-align:center;margin-bottom:4px;">';
    html += '<div style="font-size:1.5rem;font-weight:900;color:' + counterColor + ';">' + flashingCount + ' / ' + topSignalIndicators + '</div>';
    html += '<div style="font-size:0.72rem;color:' + counterColor + ';font-weight:700;">' + counterLabel + '</div>';
    html += '<div style="font-size:0.6rem;color:var(--text-faint);margin-top:4px;">Top indicators flashing 🔴 = potential cycle top signal</div>';
    html += '</div>';
    indicators.forEach(function(ind) {
        var borderCol = ind.flashing ? 'rgba(239,68,68,0.5)' : 'var(--border)';
        var bgExtra = ind.flashing ? 'background:rgba(239,68,68,0.04);' : '';
        html += '<div' + (ind.tip ? ' onclick="event.stopPropagation();showDashTip(this,\'' + ind.tip.replace(/[\\'"]/g, "").replace(/"/g, '&quot;') + '\')" style="' + bgExtra + 'border:1px solid ' + borderCol + ';border-radius:12px;padding:12px;cursor:help;transition:0.2s;position:relative;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'' + borderCol + '\'"' : ' style="' + bgExtra + 'border:1px solid ' + borderCol + ';border-radius:12px;padding:12px;position:relative;"') + '>';
        // Flashing badge
        if (!ind.noFlashLogic) {
            if (ind.flashing) {
                html += '<div style="position:absolute;top:6px;right:6px;font-size:0.55rem;padding:2px 5px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:4px;color:#ef4444;font-weight:700;">🔴 TOP</div>';
            } else {
                html += '<div style="position:absolute;top:6px;right:6px;font-size:0.55rem;padding:2px 5px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);border-radius:4px;color:#22c55e;font-weight:700;">🟢 OK</div>';
            }
        }
        html += '<div style="color:var(--text-faint);font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;font-weight:700;">' + ind.emoji + ' ' + ind.name + (ind.tip ? ' <span style="opacity:0.4;font-size:0.55rem;">ⓘ</span>' : '') + '</div>';
        html += '<div id="' + (ind.id || '') + '" style="font-size:1.15rem;font-weight:900;color:' + (ind.color || 'var(--heading)') + ';margin-top:4px;letter-spacing:-0.3px;">' + (ind.value || '—') + '</div>';
        if (ind.sub) html += '<div style="color:var(--text-faint);font-size:0.68rem;margin-top:2px;">' + ind.sub + '</div>';
        html += '</div>';
    });

    // Add link to Coinglass for full indicators
    html += '<div style="grid-column:1/-1;text-align:center;padding:10px;"><a href="https://www.coinglass.com/pro/i/top-indicators" target="_blank" rel="noopener" style="color:var(--accent);font-size:0.75rem;font-weight:600;text-decoration:none;">View all indicators on CoinGlass →</a></div>';

    el.innerHTML = html;

    // Cache the rendered indicators HTML
    try { localStorage.setItem(TOP_IND_CACHE_KEY, JSON.stringify({ html: html, ts: Date.now() })); } catch(e) {}

    // Fetch Mayer Multiple (200-day MA from CoinGecko)
    fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data && data.prices && data.prices.length >= 200) {
                var prices = data.prices;
                var pLen = prices.length;
                // 200-day MA for Mayer Multiple
                var sum200 = 0;
                for (var i = Math.max(0, pLen - 200); i < pLen; i++) sum200 += prices[i][1];
                var ma200 = sum200 / Math.min(200, pLen);
                var currentPrice = prices[pLen - 1][1];
                var mayer = (currentPrice / ma200).toFixed(2);
                var mayerEl = document.getElementById('mayerMultiple');
                if (mayerEl) {
                    var mayerColor = mayer < 1 ? '#22c55e' : mayer > 2.4 ? '#ef4444' : 'var(--heading)';
                    mayerEl.style.color = mayerColor;
                    mayerEl.textContent = mayer + 'x';
                    var sub = mayerEl.nextElementSibling;
                    if (sub) sub.textContent = '200d MA: $' + fmtNum(Math.round(ma200)) + (mayer < 1 ? ' \xb7 Below MA \u2705' : mayer > 2.4 ? ' \xb7 Overheated \u26a0\ufe0f' : '');
                    var mayerCard = mayerEl.closest('div[style*="border-radius:12px"]');
                    if (mayerCard && mayer > 2.4) {
                        mayerCard.style.borderColor = 'rgba(239,68,68,0.5)';
                        mayerCard.style.background = 'rgba(239,68,68,0.04)';
                        var badge = mayerCard.querySelector('div[style*="OK"]');
                        if (badge) { badge.innerHTML = '\ud83d\udd34 TOP'; badge.style.color = '#ef4444'; badge.style.background = 'rgba(239,68,68,0.15)'; badge.style.borderColor = 'rgba(239,68,68,0.4)'; }
                    }
                }
                // Pi Cycle Top: 111-day MA vs 350-day MA x 2
                if (pLen >= 111) {
                    var sum111 = 0;
                    for (var pi = pLen - 111; pi < pLen; pi++) sum111 += prices[pi][1];
                    var ma111 = sum111 / 111;
                    var sum350 = 0;
                    var cnt350 = Math.min(350, pLen);
                    for (var pk = pLen - cnt350; pk < pLen; pk++) sum350 += prices[pk][1];
                    var ma350x2 = (sum350 / cnt350) * 2;
                    var piGap = ma350x2 > 0 ? ((ma111 - ma350x2) / ma350x2 * 100).toFixed(1) : 0;
                    var piGapNum = parseFloat(piGap);
                    var piEl = document.getElementById('piCycleTop');
                    if (piEl) {
                        var piFlash = piGapNum >= 0;
                        piEl.textContent = (piGapNum >= 0 ? '+' : '') + piGap + '%';
                        piEl.style.color = piFlash ? '#ef4444' : piGapNum > -5 ? '#f97316' : 'var(--heading)';
                        var piSub = piEl.nextElementSibling;
                        if (piSub) piSub.textContent = '111d: $' + fmtNum(Math.round(ma111)) + ' vs 350d\xd72: $' + fmtNum(Math.round(ma350x2)) + (piFlash ? ' \xb7 CROSSED \u26a0\ufe0f' : piGapNum > -5 ? ' \xb7 Narrowing!' : '');
                        var piCard = piEl.closest('div[style*="border-radius:12px"]');
                        if (piCard && piFlash) {
                            piCard.style.borderColor = 'rgba(239,68,68,0.5)';
                            piCard.style.background = 'rgba(239,68,68,0.04)';
                            var piBadge = piCard.querySelector('div[style*="OK"]');
                            if (piBadge) { piBadge.innerHTML = '\ud83d\udd34 TOP'; piBadge.style.color = '#ef4444'; piBadge.style.background = 'rgba(239,68,68,0.15)'; piBadge.style.borderColor = 'rgba(239,68,68,0.4)'; }
                        }
                    }
                }

                // RSI-22 Day calculation
                if (pLen >= 23) {
                    var gains = 0, losses = 0;
                    for (var ri = pLen - 22; ri < pLen; ri++) {
                        var change = prices[ri][1] - prices[ri - 1][1];
                        if (change > 0) gains += change;
                        else losses -= change;
                    }
                    var avgGain = gains / 22;
                    var avgLoss = losses / 22;
                    var rsi22 = avgLoss === 0 ? 100 : (100 - (100 / (1 + avgGain / avgLoss)));
                    var rsi22Str = rsi22.toFixed(1);
                    var rsiEl = document.getElementById('rsi22d');
                    if (rsiEl) {
                        var rsiFlash = rsi22 >= 80;
                        rsiEl.textContent = rsi22Str;
                        rsiEl.style.color = rsi22 >= 80 ? '#ef4444' : rsi22 <= 30 ? '#22c55e' : 'var(--heading)';
                        var rsiSub = rsiEl.nextElementSibling;
                        if (rsiSub) rsiSub.textContent = rsi22 >= 80 ? 'Overbought \u26a0\ufe0f' : rsi22 <= 30 ? 'Oversold \u2705' : rsi22 >= 60 ? 'Bullish' : rsi22 <= 40 ? 'Bearish' : 'Neutral';
                        if (rsiFlash) {
                            var rsiCard = rsiEl.closest('div[style*="border-radius:12px"]');
                            if (rsiCard) {
                                rsiCard.style.borderColor = 'rgba(239,68,68,0.5)';
                                rsiCard.style.background = 'rgba(239,68,68,0.04)';
                                var rsiBadge = rsiCard.querySelector('div[style*="OK"]');
                                if (rsiBadge) { rsiBadge.innerHTML = '\ud83d\udd34 TOP'; rsiBadge.style.color = '#ef4444'; rsiBadge.style.background = 'rgba(239,68,68,0.15)'; rsiBadge.style.borderColor = 'rgba(239,68,68,0.4)'; }
                            }
                        }
                    }
                }

                // AHR999x Escape Top = (price / 200d MA)^2
                var ahr999x = Math.pow(currentPrice / ma200, 2).toFixed(2);
                var ahrxEl = document.getElementById('ahr999x');
                if (ahrxEl) {
                    var ahrxNum = parseFloat(ahr999x);
                    var ahrxFlash = ahrxNum >= 8;
                    ahrxEl.textContent = ahr999x;
                    ahrxEl.style.color = ahrxNum >= 8 ? '#ef4444' : ahrxNum >= 3.5 ? '#f97316' : 'var(--heading)';
                    var ahrxSub = ahrxEl.nextElementSibling;
                    if (ahrxSub) ahrxSub.textContent = '200d MA: $' + fmtNum(Math.round(ma200)) + (ahrxNum >= 8 ? ' \xb7 Extreme top \u26a0\ufe0f' : ahrxNum >= 3.5 ? ' \xb7 Elevated' : ahrxNum < 1 ? ' \xb7 Below MA' : ' \xb7 Normal');
                    if (ahrxFlash) {
                        var ahrxCard = ahrxEl.closest('div[style*="border-radius:12px"]');
                        if (ahrxCard) {
                            ahrxCard.style.borderColor = 'rgba(239,68,68,0.5)';
                            ahrxCard.style.background = 'rgba(239,68,68,0.04)';
                            var ahrxBadge = ahrxCard.querySelector('div[style*="OK"]');
                            if (ahrxBadge) { ahrxBadge.innerHTML = '\ud83d\udd34 TOP'; ahrxBadge.style.color = '#ef4444'; ahrxBadge.style.background = 'rgba(239,68,68,0.15)'; ahrxBadge.style.borderColor = 'rgba(239,68,68,0.4)'; }
                        }
                    }
                }
            }
        }).catch(function() {
            var mayerEl = document.getElementById('mayerMultiple');
            if (mayerEl) { mayerEl.textContent = 'N/A'; }
        });

    // Fetch BTC dominance from CoinGecko global endpoint
    fetch('https://api.coingecko.com/api/v3/global')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data && data.data && data.data.market_cap_percentage && data.data.market_cap_percentage.btc) {
                var dom = data.data.market_cap_percentage.btc.toFixed(1);
                var domEl = document.getElementById('btcDominance');
                if (domEl) {
                    domEl.textContent = dom + '%';
                    var domColor = dom > 55 ? '#22c55e' : dom < 40 ? '#ef4444' : 'var(--heading)';
                    domEl.style.color = domColor;
                    var sub = domEl.nextElementSibling;
                    if (sub) sub.textContent = dom > 55 ? 'Bitcoin season 👑' : dom < 40 ? 'Alt season ⚠️' : 'Neutral';
                }
            }
        }).catch(function() {});

    
    // Fetch CBBI data from ColintalksCrypto
    fetch('https://colintalkscrypto.com/cbbi/data/latest.json')
        .then(function(r) { return r.json(); })
        .then(function(cbbi) {
            if (!cbbi || !cbbi.Confidence) return;
            var timestamps = Object.keys(cbbi.Confidence).sort();
            var latest = timestamps[timestamps.length - 1];
            var confidence = (cbbi.Confidence[latest] * 100).toFixed(0);
            var confNum = parseInt(confidence);

            // CBBI Score
            var cbbiEl = document.getElementById('cbbiScore');
            if (cbbiEl) {
                cbbiEl.textContent = confidence + '%';
                cbbiEl.style.color = confNum >= 80 ? '#ef4444' : confNum <= 20 ? '#22c55e' : 'var(--heading)';
                var cbbiSub = cbbiEl.nextElementSibling;
                if (cbbiSub) cbbiSub.textContent = confNum >= 80 ? 'Approaching top \u26a0\ufe0f' : confNum <= 20 ? 'Approaching bottom \ud83d\udfe2' : confNum >= 50 ? 'Mid-cycle bullish' : 'Early cycle';
                if (confNum >= 80) {
                    var cbbiCard = cbbiEl.closest('div[style*="border-radius:12px"]');
                    if (cbbiCard) { cbbiCard.style.borderColor = 'rgba(239,68,68,0.5)'; cbbiCard.style.background = 'rgba(239,68,68,0.04)'; var b = cbbiCard.querySelector('div[style*="OK"]'); if (b) { b.innerHTML = '\ud83d\udd34 TOP'; b.style.color = '#ef4444'; b.style.background = 'rgba(239,68,68,0.15)'; b.style.borderColor = 'rgba(239,68,68,0.4)'; } }
                }
            }

            // RHODL
            var rhodlTs = Object.keys(cbbi.RHODL).sort();
            var rhodlVal = cbbi.RHODL[rhodlTs[rhodlTs.length - 1]];
            var rhodlEl = document.getElementById('rhodlRatio');
            if (rhodlEl) {
                rhodlEl.textContent = (rhodlVal * 100).toFixed(0) + '%';
                rhodlEl.style.color = rhodlVal >= 0.85 ? '#ef4444' : rhodlVal <= 0.2 ? '#22c55e' : 'var(--heading)';
                var rhodlSub = rhodlEl.nextElementSibling;
                if (rhodlSub) rhodlSub.textContent = rhodlVal >= 0.85 ? 'Speculative frenzy \u26a0\ufe0f' : rhodlVal <= 0.2 ? 'Accumulation zone \ud83d\udfe2' : 'Normalized: ' + (rhodlVal * 100).toFixed(0) + '%';
                if (rhodlVal >= 0.85) {
                    var rc = rhodlEl.closest('div[style*="border-radius:12px"]'); if (rc) { rc.style.borderColor = 'rgba(239,68,68,0.5)'; rc.style.background = 'rgba(239,68,68,0.04)'; var rb = rc.querySelector('div[style*="OK"]'); if (rb) { rb.innerHTML = '\ud83d\udd34 TOP'; rb.style.color = '#ef4444'; rb.style.background = 'rgba(239,68,68,0.15)'; rb.style.borderColor = 'rgba(239,68,68,0.4)'; } }
                }
            }

            // Macro Oscillator (Woobull)
            var wooTs = Object.keys(cbbi.Woobull).sort();
            var wooVal = cbbi.Woobull[wooTs[wooTs.length - 1]];
            var macroEl = document.getElementById('macroOsc');
            if (macroEl) {
                macroEl.textContent = (wooVal * 100).toFixed(0) + '%';
                macroEl.style.color = wooVal >= 0.7 ? '#ef4444' : wooVal <= 0.2 ? '#22c55e' : 'var(--heading)';
                var macSub = macroEl.nextElementSibling;
                if (macSub) macSub.textContent = wooVal >= 0.7 ? 'Euphoria zone \u26a0\ufe0f' : wooVal <= 0.2 ? 'Accumulation \ud83d\udfe2' : 'Normalized: ' + (wooVal * 100).toFixed(0) + '%';
                if (wooVal >= 0.7) {
                    var mc = macroEl.closest('div[style*="border-radius:12px"]'); if (mc) { mc.style.borderColor = 'rgba(239,68,68,0.5)'; mc.style.background = 'rgba(239,68,68,0.04)'; var mb = mc.querySelector('div[style*="OK"]'); if (mb) { mb.innerHTML = '\ud83d\udd34 TOP'; mb.style.color = '#ef4444'; mb.style.background = 'rgba(239,68,68,0.15)'; mb.style.borderColor = 'rgba(239,68,68,0.4)'; } }
                }
            }

            // LTH/STH estimate from CBBI MVRV + Puell
            var mvrvTs = Object.keys(cbbi.MVRV).sort();
            var puellTs = Object.keys(cbbi.Puell).sort();
            var mvrvVal = cbbi.MVRV[mvrvTs[mvrvTs.length - 1]];
            var puellVal = cbbi.Puell[puellTs[puellTs.length - 1]];
            var lthEl = document.getElementById('lthSthRatio');
            if (lthEl) {
                // When MVRV and Puell are both high, LTH are distributing to STH
                var distribution = ((mvrvVal + puellVal) / 2 * 100).toFixed(0);
                var distNum = parseInt(distribution);
                lthEl.textContent = distNum + '%';
                lthEl.style.color = distNum >= 70 ? '#ef4444' : distNum <= 25 ? '#22c55e' : 'var(--heading)';
                var lthSub = lthEl.nextElementSibling;
                if (lthSub) lthSub.textContent = distNum >= 70 ? 'LTH distributing \u26a0\ufe0f' : distNum <= 25 ? 'LTH accumulating \ud83d\udfe2' : 'Distribution score: ' + distNum + '%';
                if (distNum >= 70) {
                    var lc = lthEl.closest('div[style*="border-radius:12px"]'); if (lc) { lc.style.borderColor = 'rgba(239,68,68,0.5)'; lc.style.background = 'rgba(239,68,68,0.04)'; var lb = lc.querySelector('div[style*="OK"]'); if (lb) { lb.innerHTML = '\ud83d\udd34 TOP'; lb.style.color = '#ef4444'; lb.style.background = 'rgba(239,68,68,0.15)'; lb.style.borderColor = 'rgba(239,68,68,0.4)'; } }
                }
            }

            // MVRV Z-Score from CBBI
            var mvrvEl = document.getElementById('mvrvScore');
            if (mvrvEl) {
                var mvrvPct = (mvrvVal * 100).toFixed(0);
                mvrvEl.textContent = mvrvPct + '%';
                mvrvEl.style.color = mvrvVal >= 0.7 ? '#ef4444' : mvrvVal <= 0.2 ? '#22c55e' : 'var(--heading)';
                var mvrvSub = mvrvEl.nextElementSibling;
                if (mvrvSub) mvrvSub.textContent = mvrvVal >= 0.7 ? 'Overvalued — top zone \u26a0\ufe0f' : mvrvVal <= 0.2 ? 'Undervalued — accumulate \ud83d\udfe2' : 'Normalized: ' + mvrvPct + '%';
                if (mvrvVal >= 0.7) {
                    var mvc = mvrvEl.closest('div[style*="border-radius:12px"]'); if (mvc) { mvc.style.borderColor = 'rgba(239,68,68,0.5)'; mvc.style.background = 'rgba(239,68,68,0.04)'; var mvb = mvc.querySelector('div[style*="OK"]'); if (mvb) { mvb.innerHTML = '\ud83d\udd34 TOP'; mvb.style.color = '#ef4444'; mvb.style.background = 'rgba(239,68,68,0.15)'; mvb.style.borderColor = 'rgba(239,68,68,0.4)'; } }
                }
            }

            // NUPL from CBBI (RUPL metric)
            var ruplTs = Object.keys(cbbi.RUPL).sort();
            var ruplVal = cbbi.RUPL[ruplTs[ruplTs.length - 1]];
            var nuplEl = document.getElementById('nuplScore');
            if (nuplEl) {
                var nuplPct = (ruplVal * 100).toFixed(0);
                nuplEl.textContent = nuplPct + '%';
                nuplEl.style.color = ruplVal >= 0.75 ? '#ef4444' : ruplVal <= 0.2 ? '#22c55e' : 'var(--heading)';
                var nuplSub = nuplEl.nextElementSibling;
                if (nuplSub) nuplSub.textContent = ruplVal >= 0.75 ? 'Euphoria \u26a0\ufe0f' : ruplVal <= 0.2 ? 'Capitulation zone \ud83d\udfe2' : 'Normalized: ' + nuplPct + '%';
                if (ruplVal >= 0.75) {
                    var nc = nuplEl.closest('div[style*="border-radius:12px"]'); if (nc) { nc.style.borderColor = 'rgba(239,68,68,0.5)'; nc.style.background = 'rgba(239,68,68,0.04)'; var nb = nc.querySelector('div[style*="OK"]'); if (nb) { nb.innerHTML = '\ud83d\udd34 TOP'; nb.style.color = '#ef4444'; nb.style.background = 'rgba(239,68,68,0.15)'; nb.style.borderColor = 'rgba(239,68,68,0.4)'; } }
                }
            }

            // Reserve Risk from CBBI
            var rrTs = Object.keys(cbbi.ReserveRisk).sort();
            var rrVal = cbbi.ReserveRisk[rrTs[rrTs.length - 1]];
            // Note: We removed the fake calculated Reserve Risk.
            // CBBI's ReserveRisk is already one of the card indicators (id already exists in RHODL/etc flow)
            // This data is available for anyone who wants to add it back as a separate card.

            // Cache CBBI data
            try { localStorage.setItem('cbbi_cache', JSON.stringify({ ts: Date.now(), confidence: confidence, rhodl: rhodlVal, woobull: wooVal, mvrv: mvrvVal, puell: puellVal })); } catch(e) {}
        }).catch(function() {
            // Try cached data
            try {
                var cached = JSON.parse(localStorage.getItem('cbbi_cache'));
                if (cached && Date.now() - cached.ts < 86400000) {
                    var cbbiEl = document.getElementById('cbbiScore');
                    if (cbbiEl) { cbbiEl.textContent = cached.confidence + '%'; }
                }
            } catch(e) {}
        });

// Fetch ETF flow data from cached JSON
    fetch('data/etf-flows.json?v=' + Math.floor(Date.now() / 3600000))
        .then(function(r) { return r.json(); })
        .then(function(etf) {
            if (!etf || !etf.latestFlow) return;
            var flowEl = document.getElementById('etfNetFlow');
            if (flowEl) {
                var f = etf.latestFlow;
                var fStr = (f >= 0 ? '+' : '') + f.toFixed(1) + 'M';
                flowEl.textContent = fStr;
                flowEl.style.color = f > 0 ? '#22c55e' : f < -100 ? '#ef4444' : f < 0 ? '#f97316' : 'var(--heading)';
                var sub = flowEl.nextElementSibling;
                if (sub) sub.textContent = etf.latestDate + ' · ' + etf.outflowDays + '/' + etf.totalDays + ' outflow days' + (etf.outflowDays >= 7 ? ' ⚠️' : '');
                // Flash if 7+ outflow days in last 10
                if (etf.outflowDays >= 7) {
                    var card = flowEl.closest('div[style*="border-radius:12px"]');
                    if (card) {
                        card.style.borderColor = 'rgba(239,68,68,0.5)';
                        card.style.background = 'rgba(239,68,68,0.04)';
                        var badge = card.querySelector('div[style*="OK"]');
                        if (badge) { badge.innerHTML = '\ud83d\udd34 TOP'; badge.style.color = '#ef4444'; badge.style.background = 'rgba(239,68,68,0.15)'; badge.style.borderColor = 'rgba(239,68,68,0.4)'; }
                    }
                }
            }
            var flow5El = document.getElementById('etf5dFlow');
            if (flow5El) {
                var s5 = etf.sum5d;
                flow5El.textContent = (s5 >= 0 ? '+' : '') + s5.toFixed(1) + 'M';
                flow5El.style.color = s5 > 100 ? '#22c55e' : s5 < -500 ? '#ef4444' : s5 < 0 ? '#f97316' : 'var(--heading)';
                var sub5 = flow5El.nextElementSibling;
                if (sub5) sub5.textContent = '5-day total' + (s5 < -500 ? ' · Heavy selling ⚠️' : s5 > 500 ? ' · Strong inflows 🟢' : '');
                if (s5 < -500) {
                    var card5 = flow5El.closest('div[style*="border-radius:12px"]');
                    if (card5) {
                        card5.style.borderColor = 'rgba(239,68,68,0.5)';
                        card5.style.background = 'rgba(239,68,68,0.04)';
                        var badge5 = card5.querySelector('div[style*="OK"]');
                        if (badge5) { badge5.innerHTML = '\ud83d\udd34 TOP'; badge5.style.color = '#ef4444'; badge5.style.background = 'rgba(239,68,68,0.15)'; badge5.style.borderColor = 'rgba(239,68,68,0.4)'; }
                    }
                }
            }
            // ETF/BTC Ratio: ETF AUM / BTC market cap
            // Estimate AUM from total BTC held (~1.05M BTC * current price)
            // CoinGlass shows ~1.05M BTC total; use that as baseline
            var etfBtcHeld = 1045000; // update periodically
            var btcPrice = parseFloat(localStorage.getItem('btc_last_price')) || 83000;
            var etfAum = etfBtcHeld * btcPrice;
            var btcMktCap = btcPrice * 19840000; // supply
            var etfRatio = btcMktCap > 0 ? ((etfAum / btcMktCap) * 100).toFixed(1) : '—';
            var etfRatioEl = document.getElementById('etfBtcRatio');
            if (etfRatioEl) {
                var erNum = parseFloat(etfRatio);
                etfRatioEl.textContent = etfRatio + '%';
                etfRatioEl.style.color = erNum >= 8 ? '#ef4444' : 'var(--heading)';
                var erSub = etfRatioEl.nextElementSibling;
                if (erSub) erSub.textContent = 'ETF AUM: ~$' + (etfAum / 1e9).toFixed(0) + 'B / Mkt Cap: ~$' + (btcMktCap / 1e12).toFixed(2) + 'T' + (erNum >= 8 ? ' · High exposure ⚠️' : '');
                if (erNum >= 8) {
                    var erCard = etfRatioEl.closest('div[style*="border-radius:12px"]');
                    if (erCard) {
                        erCard.style.borderColor = 'rgba(239,68,68,0.5)';
                        erCard.style.background = 'rgba(239,68,68,0.04)';
                        var erBadge = erCard.querySelector('div[style*="OK"]');
                        if (erBadge) { erBadge.innerHTML = '\ud83d\udd34 TOP'; erBadge.style.color = '#ef4444'; erBadge.style.background = 'rgba(239,68,68,0.15)'; erBadge.style.borderColor = 'rgba(239,68,68,0.4)'; }
                    }
                }
            }
        }).catch(function() {
            var flowEl = document.getElementById('etfNetFlow');
            if (flowEl) { flowEl.textContent = 'N/A'; }
        });
}

// Live halving countdown ticker (updates every second)
var _halvingTickerInterval = null;
function startHalvingTicker() {
    if (_halvingTickerInterval) clearInterval(_halvingTickerInterval);
    _halvingTickerInterval = setInterval(function() {
        if (!window._halvingTargetMs) return;
        var diff = Math.max(0, window._halvingTargetMs - Date.now());
        var totalSec = Math.floor(diff / 1000);
        var days = Math.floor(totalSec / 86400);
        var hours = Math.floor((totalSec % 86400) / 3600);
        var mins = Math.floor((totalSec % 3600) / 60);
        var secs = totalSec % 60;
        var dEl = document.getElementById('halvDays');
        var hEl = document.getElementById('halvHours');
        var mEl = document.getElementById('halvMins');
        var sEl = document.getElementById('halvSecs');
        if (dEl) dEl.textContent = days;
        if (hEl) hEl.textContent = hours;
        if (mEl) mEl.textContent = mins;
        if (sEl) sEl.textContent = secs < 10 ? '0' + secs : secs;
    }, 1000);
}
// Start ticker when dashboard opens
var _origToggle = window.toggleDashboard;
window.toggleDashboard = async function() {
    await _origToggle.apply(this, arguments);
    if (document.getElementById('halvSecs')) startHalvingTicker();
};
// Clean up when dashboard closes
document.addEventListener('click', function() {
    if (!document.getElementById('halvSecs') && _halvingTickerInterval) {
        clearInterval(_halvingTickerInterval);
        _halvingTickerInterval = null;
    }
});

})();
