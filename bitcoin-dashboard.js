// © 2024-2026 603BTC LLC. All rights reserved.
// =============================================
// ₿ Bitcoin Network Dashboard — Real-Time Metrics
// Sources: mempool.space, CoinGecko, alternative.me
// =============================================

(function() {
'use strict';

// ---- Real-Time Price WebSocket ----
// Binance combined stream: aggTrade fires on every trade (multiple/sec),
// miniTicker fires every second with 24h open/close/change so % is always accurate.
var _priceWs = null;
var _lastWsPrice = null;
var _lastWsChange = null;
var _wsOpenPrice = null;
var _wsReconnectTimer = null;
var _wsFailCount = 0;

// Throttle DOM updates — only paint at most once per 10s regardless of WS message rate.
// Coinbase WS fires on every trade (potentially hundreds/min); painting every message
// burns CPU and competes with the user's other browser tabs/streams.
var _wsDomThrottleTs = 0;
var _WS_DOM_THROTTLE_MS = 10000; // 10 seconds
function _wsUpdateDom() {
    window._btcPriceCache = { price: _lastWsPrice, change: _lastWsChange, ts: Date.now() };
    var now = Date.now();
    if (now - _wsDomThrottleTs < _WS_DOM_THROTTLE_MS) return; // skip high-frequency trades
    _wsDomThrottleTs = now;
    var priceEl = document.getElementById('dashLivePrice');
    if (priceEl && _lastWsPrice) priceEl.textContent = '$' + fmtNum(_lastWsPrice, 2);
    if (_lastWsChange !== null) {
        var color = _lastWsChange >= 0 ? '#22c55e' : '#ef4444';
        var arrow = _lastWsChange >= 0 ? '▲' : '▼';
        var changeEl = document.getElementById('dashLiveChange');
        if (changeEl) changeEl.innerHTML = '<span style="color:' + color + ';">' + arrow + ' ' + Math.abs(_lastWsChange).toFixed(2) + '% (24h)</span>';
        var btnPrice = document.getElementById('dashBtnPrice');
        if (btnPrice) btnPrice.innerHTML = '$' + fmtNum(_lastWsPrice, 0) + ' <span style="color:' + color + ';font-size:0.6rem;">' + arrow + Math.abs(_lastWsChange).toFixed(1) + '%</span>';
    }
}

function startPriceWs() {
    if (_priceWs && _priceWs.readyState <= 1) return;
    if (_wsReconnectTimer) { clearTimeout(_wsReconnectTimer); _wsReconnectTimer = null; }
    try {
        // Coinbase Exchange WebSocket — browser-friendly, no auth, fires on every trade
        // Binance blocks browser WS connections; Coinbase does not
        _priceWs = new WebSocket('wss://ws-feed.exchange.coinbase.com');
        _priceWs.onopen = function() {
            console.log('[Dashboard] Price WS connected (Coinbase)');
            _wsFailCount = 0;
            // Subscribe to BTC-USD ticker — sends price + open_24h + high_24h + low_24h
            _priceWs.send(JSON.stringify({
                type: 'subscribe',
                product_ids: ['BTC-USD'],
                channels: ['ticker']
            }));
            window._wsDataTimer = setTimeout(function() {
                if (!_lastWsPrice) { console.warn('[Dashboard] WS no data — falling back to polling'); startPricePolling(); }
            }, 8000);
        };
        _priceWs.onmessage = function(evt) {
            try {
                if (window._wsDataTimer) { clearTimeout(window._wsDataTimer); window._wsDataTimer = null; }
                var d = JSON.parse(evt.data);
                if (d.type !== 'ticker') return;
                var p = parseFloat(d.price);
                if (!isFinite(p)) return;
                _lastWsPrice = p;
                // open_24h gives accurate 24h open for % calc
                var open = parseFloat(d.open_24h);
                if (isFinite(open) && open > 0) _wsOpenPrice = open;
                if (_wsOpenPrice && isFinite(_wsOpenPrice)) {
                    _lastWsChange = (_lastWsPrice - _wsOpenPrice) / _wsOpenPrice * 100;
                }
                _wsUpdateDom();
                // Update 24h High/Low from every tick
                var wh = parseFloat(d.high_24h), wl = parseFloat(d.low_24h);
                if (isFinite(wh)) { var hEl = document.getElementById('dashHighLow_high'); if (hEl) hEl.textContent = '$' + fmtNum(wh, 0); }
                if (isFinite(wl)) { var lEl = document.getElementById('dashHighLow_low');  if (lEl) lEl.textContent = '$' + fmtNum(wl, 0); }
            } catch(e) {}
        };
        _priceWs.onclose = function() {
            _priceWs = null;
            _wsFailCount++;
            // Don't reconnect if tab is hidden — saves bandwidth for background tabs.
            // The visibilitychange handler below will reconnect when tab becomes active.
            if (document.hidden) { console.log('[Dashboard] WS closed, tab hidden — not reconnecting'); return; }
            var delay = Math.min(1000 * Math.pow(2, _wsFailCount), 30000);
            console.log('[Dashboard] WS closed, reconnecting in ' + delay + 'ms');
            _wsReconnectTimer = setTimeout(startPriceWs, delay);
        };
        _priceWs.onerror = function() {
            try { _priceWs.close(); } catch(x) {}
            _priceWs = null;
        };
    } catch(e) { startPricePolling(); }
}

// Polling fallback if WebSocket fails (updates every 5 seconds via Binance REST)
var _pricePollTimer = null;
function startPricePolling() {
    if (_pricePollTimer) return; // already polling
    console.log('[Dashboard] Starting price polling fallback (worker cache)');
    function poll() {
        fetch(WORKER_URL)
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (d && d.price) {
                    _lastWsPrice = d.price;
                    _lastWsChange = d.change24h || 0;
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
    _pricePollTimer = setInterval(poll, 30000); // worker edge cache is 30s
}

function stopPriceWs() {
    if (_priceWs) { _priceWs.onclose = null; _priceWs.close(); _priceWs = null; }
}

// ---- Real-time 24h High/Low — sourced from CoinGecko (see fetchDashboardData) ----
// Binance removed: api.binance.com blocks browser requests (CORS). High/low now
// come from CoinGecko /coins/bitcoin market_data.high_24h / low_24h.
function startHighLowRefresh() { /* no-op — CoinGecko handles this */ }

// ---- Cache & State ----
var DASH_CACHE_KEY = 'btc_dashboard_cache_v2';
var DASH_CACHE_TTL = 30000; // 30s — matches the worker edge cache
var _dashData = null;
var _dashLoading = false;
var _dashInterval = null;

// ---- Candle Chart State ----
var _candleData = null;
var _candleInterval = null;
var _candleFetchTs = 0;
function btcMetricsUrl(path) {
    var host = 'https://jolly-surf-219enacho-search.needcreations.workers.dev';
    try {
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') host = location.origin;
    } catch (e) {}
    return host + path;
}
var CANDLE_WORKER_URL = btcMetricsUrl('/btc-candles');
var CANDLE_REFRESH_MS = 30 * 1000; // 5m bars; refetch the series every 30s

// ---- Number Formatting ----
function fmtNum(n, decimals) {
    if (n === null || n === undefined) return '—';
    if (typeof decimals === 'number') return Number(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return Number(n).toLocaleString();
}
function fmtDollar(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e12) return '$' + (n / 1e12).toFixed(1) + 'T';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + Math.round(n);
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

// ---- Fetch All Data — proxied through CF Worker ----
// One call to /btc-data returns everything, cached 90s at the edge.
// No direct browser-to-API calls; external breakage fixed in the worker only.
var WORKER_URL = btcMetricsUrl('/btc-data');

async function fetchDashboardData() {
    if (_dashLoading) {
        await new Promise(function(r) { var _w = setInterval(function() { if (!_dashLoading) { clearInterval(_w); r(); } }, 200); setTimeout(function() { clearInterval(_w); _dashLoading = false; r(); }, 10000); });
        return _dashData || {};
    }
    _dashLoading = true;

    // Serve from localStorage cache if still fresh
    try {
        var cached = JSON.parse(localStorage.getItem(DASH_CACHE_KEY));
        if (cached && cached.data && (Date.now() - cached.ts < DASH_CACHE_TTL)) {
            _dashData = cached.data;
            _dashLoading = false;
            return _dashData;
        }
    } catch(e) {}

    var data = _dashData || {};

    try {
        var resp = await Promise.race([
            fetch(WORKER_URL),
            new Promise(function(_, rej) { setTimeout(function() { rej(new Error('timeout')); }, 12000); })
        ]);
        if (resp.ok) {
            var fresh = await resp.json();
            // Worker already computed all derived fields — merge over existing data
            Object.assign(data, fresh);
        }
    } catch(e) {
        // Worker unavailable — fall back to stale cache or localStorage fallbacks
        console.warn('[Dashboard] Worker fetch failed, using fallback:', e.message);
        try {
            var fb = JSON.parse(localStorage.getItem('btc_dash_backup'));
            if (fb && fb.data) Object.assign(data, fb.data);
        } catch(x) {}
    }

    // Last-resort individual field fallbacks
    if (!data.price) { try { data.price = parseFloat(localStorage.getItem('btc_last_price')) || undefined; } catch(e) {} }
    if (!data.blockHeight) { try { data.blockHeight = parseInt(localStorage.getItem('btc_last_height')) || undefined; } catch(e) {} }

    // Seed WS open price from fetched data
    if (!_wsOpenPrice && data.price && data.change24h) {
        _wsOpenPrice = data.price / (1 + data.change24h / 100);
        _lastWsChange = data.change24h;
    }

    // Persist to cache + backup
    if (data.price || data.blockHeight) {
        try { localStorage.setItem('btc_last_price', String(data.price || '')); } catch(e) {}
        try { localStorage.setItem('btc_last_height', String(data.blockHeight || '')); } catch(e) {}
        var payload = JSON.stringify({ ts: Date.now(), data: data });
        try { localStorage.setItem(DASH_CACHE_KEY, payload); } catch(e) {}
        try { localStorage.setItem('btc_dash_backup', payload); } catch(e) {}
    }

    data.ts = data.ts || Date.now();
    _dashData = data;
    _dashLoading = false;
    return data;
}

// ---- Candle Chart ----
async function fetchCandleData() {
    try {
        var r = await fetch(CANDLE_WORKER_URL);
        if (r.ok) {
            var d = await r.json();
            if (d.candles && d.candles.length >= 2) {
                _candleData = d.candles;
                _candleFetchTs = Date.now();
            }
        }
    } catch(e) { console.warn('[Dashboard] Candle fetch failed:', e.message); }
}

function renderCandleChart(candles, livePrice) {
    if (!candles || candles.length < 2) return '<div style="text-align:center;padding:24px;color:var(--text-faint);font-size:0.75rem;">Fetching chart data...</div>';
    var W = 460, H = 185, PL = 70, PR = 8, PT = 8, PB = 30;
    var IW = W - PL - PR, IH = H - PT - PB;
    // Deep-copy + apply live price to last candle
    var cs = candles.map(function(c) { return {t:c.t,o:c.o,h:c.h,l:c.l,c:c.c,v:c.v}; });
    if (livePrice && cs.length) {
        var last = cs[cs.length - 1];
        last.c = livePrice;
        if (livePrice > last.h) last.h = livePrice;
        if (livePrice < last.l) last.l = livePrice;
    }
    var minL = cs.reduce(function(m,c){return Math.min(m,c.l);}, Infinity);
    var maxH = cs.reduce(function(m,c){return Math.max(m,c.h);}, -Infinity);
    if (!isFinite(minL) || !isFinite(maxH)) return '<div style="text-align:center;padding:24px;color:var(--text-faint);font-size:0.75rem;">Chart data unavailable</div>';
    var rng = maxH - minL || 1;
    var pd = rng * 0.07;
    var lo = minL - pd, hi = maxH + pd, pr = hi - lo;
    function py(p) { return PT + IH * (1 - (p - lo) / pr); }
    var n = cs.length, cw = IW / n, bw = Math.max(2, Math.floor(cw * 0.55));
    function cx(i) { return PL + (i + 0.5) * cw; }
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;" xmlns="http://www.w3.org/2000/svg">';
    // Grid lines + price labels
    for (var gi = 1; gi <= 4; gi++) {
        var gp = lo + pr * (gi / 5), gy = py(gp).toFixed(1);
        svg += '<line x1="' + PL + '" y1="' + gy + '" x2="' + (W - PR) + '" y2="' + gy + '" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>';
        svg += '<text x="' + (PL - 3) + '" y="' + (parseFloat(gy) + 3.5).toFixed(1) + '" text-anchor="end" fill="rgba(255,255,255,0.35)" font-size="12" font-family="monospace">$' + Math.round(gp).toLocaleString() + '</text>';
    }
    // Candles
    for (var i = 0; i < n; i++) {
        var c = cs[i], isUp = c.c >= c.o, col = isUp ? '#22c55e' : '#ef4444';
        var x = cx(i), isLast = i === n - 1;
        var wyTop = py(c.h).toFixed(1), wyBot = py(c.l).toFixed(1);
        var byTop = py(Math.max(c.o, c.c)).toFixed(1);
        var byH = Math.max(1, py(Math.min(c.o, c.c)) - py(Math.max(c.o, c.c))).toFixed(1);
        svg += '<line x1="' + x.toFixed(1) + '" y1="' + wyTop + '" x2="' + x.toFixed(1) + '" y2="' + wyBot + '" stroke="' + col + '" stroke-width="1.2" opacity="' + (isLast ? '1' : '0.8') + '"/>';
        svg += '<rect x="' + (x - bw/2).toFixed(1) + '" y="' + byTop + '" width="' + bw + '" height="' + byH + '" fill="' + col + '" opacity="' + (isLast ? '1' : '0.8') + '"/>';
        if (isLast) {
            var dotY = py(c.c).toFixed(1);
            svg += '<circle cx="' + x.toFixed(1) + '" cy="' + dotY + '" r="3" fill="' + col + '"/>';
        }
    }
    // X-axis time labels
    var step = Math.max(1, Math.floor(n / 5));
    for (var i = 0; i < n; i++) {
        if (i !== 0 && i % step !== 0 && i !== n - 1) continue;
        var lbl = i === n - 1 ? 'now' : new Date(cs[i].t).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', hour12:false});
        svg += '<text x="' + cx(i).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="12" font-family="monospace">' + lbl + '</text>';
    }
    svg += '</svg>';
    return svg;
}

function _updateCandleChart() {
    var el = document.getElementById('dashCandleChartSvg');
    if (!el) { if (_candleInterval) { clearInterval(_candleInterval); _candleInterval = null; } return; }
    if (Date.now() - _candleFetchTs > CANDLE_REFRESH_MS) fetchCandleData(); // async, non-blocking
    if (!_candleData || !_candleData.length) return;
    var live = _lastWsPrice || (_dashData && _dashData.price) || null;
    el.innerHTML = renderCandleChart(_candleData, live);
}

function _loadCandleChart() {
    if (_candleInterval) { clearInterval(_candleInterval); _candleInterval = null; }
    if (_candleData && Date.now() - _candleFetchTs < 30000) {
        _updateCandleChart();
    } else {
        fetchCandleData().then(function() { _updateCandleChart(); });
    }
    _candleInterval = setInterval(_updateCandleChart, 5000); // 5s — data doesn't change faster than this
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
    // Rehydrate halvingEta from cached string → Date; compute derived fields if missing
    if (d.halvingEta && !(d.halvingEta instanceof Date)) d.halvingEta = new Date(d.halvingEta);
    if (d.blockHeight && !d.subsidy) {
        var _epoch = Math.floor(d.blockHeight / 210000);
        d.subsidy = (50 / Math.pow(2, _epoch)).toFixed(4);
        d.nextSubsidy = (50 / Math.pow(2, _epoch + 1)).toFixed(4);
        d.halvingBlock = (_epoch + 1) * 210000;
        d.halving = 210000 - (d.blockHeight % 210000);
        var _blockSec = (d.blockIntervalSec > 60) ? d.blockIntervalSec : 600;
        var _halvMs = d.halving * _blockSec * 1000;
        d.halvingEta = new Date(Date.now() + _halvMs);
        var _totalSec = Math.floor(_halvMs / 1000);
        d.halvingDays = Math.floor(_totalSec / 86400);
        d.halvingHours = Math.floor((_totalSec % 86400) / 3600);
        d.halvingMins = Math.floor((_totalSec % 3600) / 60);
        window._halvingTargetMs = Date.now() + _halvMs;
    }
    var changeColor = (d.change24h || 0) >= 0 ? '#22c55e' : '#ef4444';
    var changeArrow = (d.change24h || 0) >= 0 ? '▲' : '▼';
    var diffChangeColor = (d.diffChange || 0) >= 0 ? '#22c55e' : '#ef4444';
    var nextRetarget = d.diffEstDate ? new Date(d.diffEstDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

    var html = '';
    
    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">';
    html += '<div><h2 style="color:var(--heading);font-size:1.4rem;font-weight:900;margin:0;letter-spacing:-0.5px;">₿ Bitcoin Network</h2>';
    var _dataAge = d.ts ? Math.round((Date.now() - d.ts) / 60000) : 0;
    var _freshLabel = _dataAge <= 1 ? 'Live metrics · Shared cache, about every 30s' : '📦 Data from ' + (_dataAge < 60 ? _dataAge + 'm' : Math.round(_dataAge/60) + 'h') + ' ago · Refreshing...';
    html += '<div style="color:var(--text-faint);font-size:0.7rem;margin-top:2px;">' + _freshLabel + '</div></div>';
    html += '<button onclick="closeDashboard()" style="background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer;padding:4px;">✕</button>';
    html += '</div>';

    // ——— Timechain Calendar toggle (near top, below header) ———
    html += '<div style="margin-bottom:16px;">';
    html += '<button onclick="_dashToggleCalendar()" id="tcalToggleBtn" style="width:100%;padding:11px 16px;background:linear-gradient(135deg,rgba(247,147,26,0.1),rgba(234,88,12,0.06));border:1px solid rgba(247,147,26,0.3);border-radius:12px;color:var(--accent);font-size:0.85rem;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:space-between;">'
        + '<span>\uD83D\uDCC5 Timechain Calendar</span><span id="tcalArrow">\u25BC</span></button>';
    html += '<div id="tcalEmbed" style="display:none;margin-top:8px;border-radius:12px;overflow:hidden;border:1px solid var(--border);">';
    html += '<iframe src="https://timechaincalendar.com/en" style="width:100%;height:520px;border:none;background:#000;" loading="lazy" title="Timechain Calendar" allow="clipboard-write"></iframe>';
    html += '</div></div>';

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
    html += '<span>24h High: <strong id="dashHighLow_high" style="color:var(--text);">$' + fmtNum(d.high24h, 0) + '</strong></span>';
    html += '<span>24h Low: <strong id="dashHighLow_low" style="color:var(--text);">$' + fmtNum(d.low24h, 0) + '</strong></span>';
    html += '</div>';
    html += '</div>';

    // Live candlestick chart
    html += '<div style="margin-bottom:16px;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:rgba(0,0,0,0.15);">'
    html += '<div style="padding:8px 12px 2px;display:flex;justify-content:space-between;align-items:center;">';
    html += '<span style="color:var(--text-faint);font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;font-weight:700;">📈 BTC/USD &middot; 5m &middot; <span style="color:#22c55e;">⬤ Live</span></span>';
    html += '<span style="color:var(--text-faint);font-size:0.62rem;">20 bars</span>';
    html += '</div>';
    html += '<div id="dashCandleChartSvg" style="padding:0 4px 4px;min-height:80px;display:flex;align-items:center;justify-content:center;color:var(--text-faint);font-size:0.75rem;">Loading chart...</div>';
    html += '</div>';

    // Halving Countdown
    if (d.halvingDays !== undefined) {
        var halvingPct = d.halving ? ((210000 - d.halving) / 210000 * 100).toFixed(1) : 0;
        var etaStr = d.halvingEta ? (d.halvingEta instanceof Date ? d.halvingEta : new Date(d.halvingEta)).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
        var halvingTip = 'Every 210,000 blocks (~4 years), the Bitcoin block reward is cut in half. This is called the "halving." It reduces the rate of new Bitcoin created, enforcing scarcity. The reward started at 50 BTC in 2009 and has halved 4 times: 50 → 25 → 12.5 → 6.25 → 3.125 BTC. After the next halving, miners will receive 1.5625 BTC per block. There will only ever be 21 million Bitcoin.';
        html += '<div data-dash-tip="' + halvingTip.replace(/[\\'"]/g, "").replace(/"/g, '&quot;') + '" style="background:linear-gradient(135deg,rgba(247,147,26,0.08),rgba(234,88,12,0.04));border:2px solid rgba(247,147,26,0.2);border-radius:14px;padding:16px;margin-bottom:16px;text-align:center;cursor:help;transition:0.2s;position:relative;">';
        html += '<div style="color:var(--text-faint);font-size:0.65rem;text-transform:uppercase;letter-spacing:1.5px;font-weight:800;margin-bottom:8px;">⏳ Next Halving — Block #' + fmtNum(d.halvingBlock) + ' <span style="opacity:0.4;font-size:0.55rem;">ⓘ</span></div>';
        // Store halving target for live countdown
        var _halvSec = (d.blockIntervalSec > 60) ? d.blockIntervalSec : 600;
        window._halvingTargetMs = Date.now() + (d.halving * _halvSec * 1000);

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
    if (!_hrSub) _hrSub = 'mempool current estimate';
    html += metricCard('⛏️', 'Hashrate', fmtCompact(d.hashrate), _hrSub, 'The total computing power securing the Bitcoin network, measured in hashes per second. This figure is mempool.space\'s current estimate, not a 24-hour average. Higher hashrate = more secure network. EH/s = quintillion hashes per second.');
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
    html += metricCard('📈', '24h Volume', '$' + fmtT(d.volume24h), _volSub, 'All-exchange 24h Bitcoin volume from CoinGecko. High volume often signals strong market interest or a large move.');
    // Lightning Network
    var lnBtcNum = d.lnCapacity ? (d.lnCapacity / 100000000) : null;
    var lnBtcStr = lnBtcNum !== null ? fmtNum(lnBtcNum.toFixed(0)) + ' BTC' : '—';
    var lnUsd = (lnBtcNum && d.price) ? '$' + fmtT(lnBtcNum * d.price) : '';
    var _lnWhen = '';
    if (d.lnAsOf) {
        var _lnT = Date.parse(d.lnAsOf);
        var _lnPretty = isFinite(_lnT) ? new Date(_lnT).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        var _lnOld = isFinite(_lnT) && (Date.now() - _lnT) > 14 * 86400000;
        _lnWhen = _lnPretty ? ('<br>As of ' + _lnPretty + (_lnOld ? ' · source snapshot' : '')) : '';
    }
    var _lnSub = (d.lnNodes ? fmtNum(d.lnNodes) + ' nodes · ' : '') + (d.lnChannels ? fmtNum(d.lnChannels) + ' channels' : '') + (lnUsd ? '<br>' + lnUsd : '') + _lnWhen;
    html += metricCard('⚡', 'Lightning Capacity', lnBtcStr, _lnSub, 'Total Bitcoin locked in Lightning Network payment channels. Lightning enables instant, near-free Bitcoin payments. More capacity = more liquidity for fast payments. Nodes route payments; channels connect them.');

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

    // ── Bitcoin vs Gold (live data) ──
    var btcMktCapT = d.marketCap ? d.marketCap / 1e12 : 0;
    html += '<div id="goldCompareCard" style="background:linear-gradient(135deg,rgba(234,179,8,0.06),rgba(247,147,26,0.03));border:1px solid rgba(234,179,8,0.25);border-radius:14px;padding:16px;margin-top:12px;cursor:help;position:relative;transition:0.2s;">';
    html += '<div style="color:var(--text-faint);font-size:0.65rem;text-transform:uppercase;letter-spacing:1.5px;font-weight:800;margin-bottom:10px;">⚖️ Bitcoin vs Gold <span style="opacity:0.4;font-size:0.55rem;">ⓘ</span></div>';
    html += '<div id="goldCompareData">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><span style="color:var(--text-muted);font-size:0.78rem;">₿ Bitcoin</span><span style="color:var(--heading);font-weight:800;font-size:0.85rem;">$' + btcMktCapT.toFixed(2) + 'T</span></div>';
    html += '<div style="background:var(--border);height:6px;border-radius:3px;overflow:hidden;margin-bottom:8px;"><div id="goldBar" style="height:100%;background:linear-gradient(90deg,#f7931a,#ea580c);width:3%;border-radius:3px;transition:width 0.5s;"></div></div>';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="color:var(--text-muted);font-size:0.78rem;">🥇 Gold</span><span id="goldMktCapLabel" style="color:var(--heading);font-weight:800;font-size:0.85rem;">Loading...</span></div>';
    html += '<div id="goldPctArea" style="text-align:center;margin-top:6px;"><div style="color:var(--text-faint);font-size:0.75rem;">Fetching live gold price...</div></div>';
    html += '</div></div>';

    // Fetch live gold price after render
    setTimeout(function() { _renderGoldFromSnapshot(d.goldUsd, btcMktCapT, d.supply || 0); }, 150);

    // ── Bitcoin Treasuries (live data from CoinGecko + government estimates) ──
    html += '<div id="treasuryCard" style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:10px;cursor:help;position:relative;transition:0.2s;">';
    html += '<div style="color:var(--text-faint);font-size:0.65rem;text-transform:uppercase;letter-spacing:1.5px;font-weight:800;margin-bottom:10px;">🏛️ Bitcoin Treasuries <span style="opacity:0.4;font-size:0.55rem;">ⓘ tap for top holders</span></div>';
    html += '<div id="treasuryData" style="text-align:center;padding:10px;color:var(--text-muted);font-size:0.8rem;">Loading live treasury data...</div>';
    html += '</div>';

    // Fetch treasury data after render
    setTimeout(function() { _renderTreasuryFromSnapshot(d.treasury, d.price || 0); }, 200);

    // ── Bitcoin ETFs (top 5 by BTC holdings) ──
    html += '<div id="etfHoldingsCard" style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:10px;position:relative;transition:0.2s;">';
    html += '<div style="color:var(--text-faint);font-size:0.65rem;text-transform:uppercase;letter-spacing:1.5px;font-weight:800;margin-bottom:10px;">🏦 Bitcoin ETFs <span style="opacity:0.4;font-size:0.55rem;">top 5 by BTC in custody</span></div>';
    html += '<div id="etfHoldingsData" style="text-align:center;padding:10px;color:var(--text-muted);font-size:0.8rem;">Loading ETF holdings...</div>';
    html += '</div>';

    // Render ETF holdings after DOM is ready
    setTimeout(function() { _renderEtfHoldings(d.price || 0, d.supply || 0); }, 250);

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
    html += '<a href="https://mempool.space" target="_blank" rel="noopener" style="color:var(--accent);">mempool.space</a> (blocks, fees, hashrate, difficulty, mempool, Lightning) · ';
    html += '<a href="https://www.coinbase.com" target="_blank" rel="noopener" style="color:var(--accent);">Coinbase</a> (price, rolling 24h change, high/low, 5m candles) · ';
    html += '<a href="https://www.coingecko.com" target="_blank" rel="noopener" style="color:var(--accent);">CoinGecko</a> (all-exchange volume, ATH, dominance, gold, treasuries) · ';
    html += '<a href="https://www.blockchain.com/charts" target="_blank" rel="noopener" style="color:var(--accent);">Blockchain.com</a> (daily prices for moving averages) · ';
    html += '<a href="https://alternative.me/crypto/fear-and-greed-index/" target="_blank" rel="noopener" style="color:var(--accent);">Alternative.me</a> (Fear & Greed Index) · ';
    html += '<a href="https://bitcointreasuries.net" target="_blank" rel="noopener" style="color:var(--accent);">BitcoinTreasuries.net</a> (company & government holdings) · ';
    html += '<a href="https://colintalkscrypto.com/cbbi/" target="_blank" rel="noopener" style="color:var(--accent);">CBBI</a> (normalized 0–1 scores)';
    html += '<div style="margin-top:4px;">Last updated: ' + new Date(d.ts || Date.now()).toLocaleTimeString() + '</div>';
    html += '</div>';



    // Start halving countdown ticker + attach tooltip listeners + candle chart after DOM renders
    setTimeout(function() {
        if (window._halvingTargetMs && document.getElementById('halvSecs') && typeof window._startHalvingTicker === 'function') window._startHalvingTicker();
        if (typeof window._attachTipListeners === 'function') window._attachTipListeners();
        _loadCandleChart();
    }, 100);

    return html;
}

window._dashToggleCalendar = function() {
    var embed = document.getElementById('tcalEmbed');
    var arrow = document.getElementById('tcalArrow');
    if (!embed) return;
    var open = embed.style.display !== 'none';
    embed.style.display = open ? 'none' : 'block';
    if (arrow) arrow.textContent = open ? '\u25BC' : '\u25B2';
};

function metricCard(emoji, label, value, sub, tip) {
    var tipAttr = tip ? ' data-dash-tip="' + tip.replace(/[\\'"]/g, "").replace(/"/g, '&quot;') + '" style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;cursor:help;transition:0.2s;position:relative;"' : ' style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;"';
    return '<div' + tipAttr + '>' +
        '<div style="color:var(--text-faint);font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;font-weight:700;">' + emoji + ' ' + label + (tip ? ' <span style="opacity:0.4;font-size:0.55rem;">ⓘ</span>' : '') + '</div>' +
        '<div style="font-size:1.15rem;font-weight:900;color:var(--heading);margin-top:4px;letter-spacing:-0.3px;">' + (value || '—') + '</div>' +
        (sub ? '<div style="color:var(--text-faint);font-size:0.68rem;margin-top:2px;">' + sub + '</div>' : '') +
    '</div>';
}

// Tooltip display — hover on desktop, press on mobile
var _isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

window.showDashTip = function(el, text) {
    // Remove any existing tooltip
    var existing = document.getElementById('dashTipPopup');
    if (existing) existing.remove();
    
    var tip = document.createElement('div');
    tip.id = 'dashTipPopup';
    tip.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(100% + 8px);z-index:10;background:var(--bg-side,#1a1a2e);border:1px solid var(--accent);border-radius:10px;padding:10px 14px;max-width:320px;width:max-content;box-shadow:0 8px 24px rgba(0,0,0,0.5);animation:fadeSlideIn 0.2s ease-out;pointer-events:auto;';
    tip.innerHTML = '<div style="color:var(--text);font-size:0.75rem;line-height:1.5;">' + text.replace(/\\n/g, '<br>').replace(/\n/g, '<br>') + '</div>' +
        '<div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%) rotate(45deg);width:10px;height:10px;background:var(--bg-side,#1a1a2e);border-right:1px solid var(--accent);border-bottom:1px solid var(--accent);"></div>';
    el.style.position = 'relative';
    el.appendChild(tip);
    
    // Close on click/tap anywhere else (mobile), or handled by mouseleave (desktop)
    setTimeout(function() {
        document.addEventListener('click', function _closeTip(e) {
            if (tip.parentNode) tip.remove();
            document.removeEventListener('click', _closeTip);
        }, { once: true });
    }, 50);
};

window.hideDashTip = function(el) {
    var tip = el ? el.querySelector('#dashTipPopup') : document.getElementById('dashTipPopup');
    if (tip) tip.remove();
};

// Attach hover/touch tooltip listeners to an element after it's rendered
window._attachTipListeners = function() {
    var cards = document.querySelectorAll('[data-dash-tip]:not([data-tip-bound])');
    cards.forEach(function(card) {
        card.setAttribute('data-tip-bound', '1');
        var tipText = card.getAttribute('data-dash-tip');
        if (!tipText) return;
        if (_isTouchDevice) {
            // Mobile: show on tap, dismiss on tap elsewhere
            card.addEventListener('click', function(e) {
                e.stopPropagation();
                var existing = card.querySelector('#dashTipPopup');
                if (existing) { existing.remove(); return; }
                showDashTip(card, tipText);
            });
        } else {
            // Desktop: show on hover, hide on leave
            card.addEventListener('mouseenter', function() {
                showDashTip(card, tipText);
            });
            card.addEventListener('mouseleave', function() {
                hideDashTip(card);
            });
        }
    });
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

    // Start real-time price + live high/low
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
    if (_candleInterval) { clearInterval(_candleInterval); _candleInterval = null; }
};

// Pause WS when tab goes to background, resume when it comes back.
// This prevents the app from consuming bandwidth while the user has another tab focused.
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Tab hidden — close WS to free up the connection
        if (_priceWs && _priceWs.readyState <= 1) {
            _priceWs.onclose = null; // suppress reconnect
            _priceWs.close();
            _priceWs = null;
        }
        if (_wsReconnectTimer) { clearTimeout(_wsReconnectTimer); _wsReconnectTimer = null; }
    } else {
        // Tab visible again — reconnect
        startPriceWs();
    }
});

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

    // Show cached indicators immediately — never show blanks
    try {
        var cached = JSON.parse(localStorage.getItem(TOP_IND_CACHE_KEY));
        if (cached && cached.html) {
            var ageMin = Math.round((Date.now() - cached.ts) / 60000);
            var staleNote = ageMin > 5 ? '<div style="text-align:center;font-size:0.6rem;color:var(--text-faint);padding:4px;">📦 Cached ' + (ageMin < 60 ? ageMin + 'm' : Math.round(ageMin/60) + 'h') + ' ago · refreshing...</div>' : '';
            el.innerHTML = staleNote + cached.html;
        }
    } catch(e) {}

    var d = _dashData || {};
    var price = d.price || 0;
    var height = d.blockHeight || 0;
    var supply = d.supply || 0;
    var fearGreed = d.fearGreed || 0;
    var fearLabel = d.fearGreedLabel || '—';
    var hist = d.history || {};

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

    // 2. Fear & Greed (always show)
    {
        var fgHas = fearGreed > 0;
        var fgColor = !fgHas ? 'var(--heading)' : fearGreed <= 25 ? '#ef4444' : fearGreed <= 45 ? '#f97316' : fearGreed <= 55 ? '#eab308' : fearGreed <= 75 ? '#84cc16' : '#22c55e';
        indicators.push({
            emoji: '😱', name: 'Fear & Greed',
            value: fgHas ? fearGreed : '—',
            color: fgColor,
            sub: fgHas ? fearLabel : 'Loading...',
            tip: 'Crypto Fear & Greed Index. 0 = Extreme Fear (potential buy), 100 = Extreme Greed (potential sell). Aggregates volatility, momentum, social media, and surveys.'
        });
    }

    // Mayer Multiple = price / real 200-day average (Blockchain.com daily prices)
    {
        var mayerHas = !!(price && hist.ma200);
        var mayerNum = mayerHas ? price / hist.ma200 : null;
        indicators.push({
            emoji: '📐', name: 'Mayer Multiple',
            value: mayerHas ? mayerNum.toFixed(2) + 'x' : '—',
            color: !mayerHas ? 'var(--heading)' : mayerNum < 1 ? '#22c55e' : mayerNum > 2.4 ? '#ef4444' : 'var(--heading)',
            sub: mayerHas ? ('200d MA: $' + fmtNum(Math.round(hist.ma200)) + (mayerNum < 1 ? ' · Below MA' : mayerNum > 2.4 ? ' · Overheated' : '')) : 'Daily history unavailable',
            tip: 'Price divided by the 200-day average of daily prices (Blockchain.com). Below 1.0 = historically cheap. Above 2.4 = overheated. Named after Trace Mayer.',
            flashing: mayerHas && mayerNum > 2.4,
            id: 'mayerMultiple'
        });
    }

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

    // 6. ATH Drawdown (always show)
    {
        var athHas = !!(d.ath && d.athDate);
        var drawdown = athHas && d.athChange ? Math.abs(d.athChange).toFixed(1) : null;
        var daysSinceATH = athHas ? Math.floor((Date.now() - new Date(d.athDate).getTime()) / 86400000) : null;
        indicators.push({
            emoji: '🏔️', name: 'ATH Drawdown',
            value: drawdown ? '-' + drawdown + '%' : '—',
            sub: athHas ? daysSinceATH + ' days since ATH ($' + fmtNum(Math.round(d.ath)) + ')' : 'Loading...',
            tip: 'Current drawdown from the all-time high. In previous cycles, bear markets saw -70% to -85% drawdowns. Recovery to new ATH has always followed.'
        });
    }

    // Thermocap / Terminal Price need issuance priced on the day it was mined.
    // A flat $30,000 stand-in is not that series, so those cards are not shown.

    // 9. NVT Ratio (market cap / all-exchange 24h volume)
    {
        var nvtHas = !!(price && supply && d.volume24h);
        var nvt = nvtHas ? (price * supply / d.volume24h).toFixed(1) : null;
        var nvtNum = parseFloat(nvt);
        var nvtColor = !nvtHas ? 'var(--heading)' : nvtNum < 30 ? '#22c55e' : nvtNum > 150 ? '#ef4444' : 'var(--heading)';
        indicators.push({
            emoji: '📡', name: 'NVT Ratio',
            value: nvtHas ? nvt : '—',
            color: nvtColor,
            sub: nvtHas ? (nvtNum < 30 ? 'Undervalued zone' : nvtNum > 150 ? 'Overvalued zone' : 'Normal range') : 'Loading...',
            tip: 'Market cap divided by CoinGecko all-exchange 24h volume. This is a market-volume ratio, not the on-chain NVT. Below 30 is quiet relative to these bands. Above 150 is heavy relative to these bands.'
        });
    }

    // Bitcoin dominance from the shared snapshot (CoinGecko global)
    {
        var domHas = d.dominance != null && isFinite(Number(d.dominance));
        var domNum = domHas ? Number(d.dominance) : null;
        indicators.push({
            emoji: '👑', name: 'BTC Dominance',
            value: domHas ? domNum.toFixed(1) + '%' : '—',
            color: !domHas ? 'var(--heading)' : domNum > 55 ? '#22c55e' : domNum < 40 ? '#ef4444' : 'var(--heading)',
            sub: domHas ? (domNum > 55 ? 'Bitcoin season' : domNum < 40 ? 'Alt season' : 'Neutral') : 'Unavailable',
            tip: 'Bitcoin\'s share of total cryptocurrency market cap, from CoinGecko. A second index (Coinpaprika) can differ by a couple of points because the coin sets differ.',
            id: 'btcDominance'
        });
    }

    // CBBI normalized MVRV score (0–1), not the raw MVRV z-score
    {
        var mvrvN = d.cbbi && d.cbbi.mvrv != null ? Number(d.cbbi.mvrv) : null;
        var mvrvHas = mvrvN != null && isFinite(mvrvN);
        indicators.push({
            emoji: '💎', name: 'MVRV (CBBI)',
            value: mvrvHas ? Math.round(mvrvN * 100) + '%' : '—',
            color: !mvrvHas ? 'var(--heading)' : mvrvN >= 0.7 ? '#ef4444' : mvrvN <= 0.2 ? '#22c55e' : 'var(--heading)',
            sub: mvrvHas ? (mvrvN >= 0.7 ? 'Normalized top zone' : mvrvN <= 0.2 ? 'Normalized low zone' : 'CBBI 0–1 score') : 'CBBI unavailable',
            tip: 'CBBI\'s normalized MVRV input, scaled 0 to 1 (shown as a percent). This is not the raw MVRV z-score, where tops have historically been near 7 and bottoms near 0. A score of 0.7 is CBBI\'s own top threshold.',
            flashing: mvrvHas && mvrvN >= 0.7,
            id: 'mvrvScore'
        });
    }

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

    // Pi Cycle: 111-day MA vs 350-day MA × 2, from the same daily series
    {
        var piHas = !!(hist.ma111 && hist.ma350);
        var ma350x2 = piHas ? hist.ma350 * 2 : null;
        var piGapNum = piHas ? (hist.ma111 - ma350x2) / ma350x2 * 100 : null;
        indicators.push({
            emoji: '🔵', name: 'Pi Cycle Top',
            value: piHas ? ((piGapNum >= 0 ? '+' : '') + piGapNum.toFixed(1) + '%') : '—',
            color: !piHas ? 'var(--heading)' : piGapNum >= 0 ? '#ef4444' : piGapNum > -5 ? '#f97316' : 'var(--heading)',
            sub: piHas ? ('111d: $' + fmtNum(Math.round(hist.ma111)) + ' vs 350d×2: $' + fmtNum(Math.round(ma350x2))) : 'Daily history unavailable',
            tip: 'When the 111-day average crosses above the 350-day average × 2, it has historically lined up with cycle tops. Both averages are daily closes from Blockchain.com.',
            flashing: piHas && piGapNum >= 0,
            id: 'piCycleTop'
        });
    }

    // Puell = spot / 365-day average price. Subsidy has been 3.125 BTC for this whole window.
    {
        var puellHas = !!(price && hist.price365Avg);
        var puellNum = puellHas ? price / hist.price365Avg : null;
        indicators.push({
            emoji: '⛏️', name: 'Puell Multiple',
            value: puellHas ? puellNum.toFixed(2) : '—',
            color: !puellHas ? 'var(--heading)' : puellNum > 2.2 ? '#ef4444' : puellNum < 0.5 ? '#22c55e' : 'var(--heading)',
            sub: puellHas ? ('365d avg price: $' + fmtNum(Math.round(hist.price365Avg)) + (puellNum > 2.2 ? ' · High' : puellNum < 0.5 ? ' · Capitulation zone' : ' · Normal range')) : 'Daily history unavailable',
            tip: 'Issuance value today divided by its 365-day average. The block subsidy has been 3.125 BTC for this whole year, so this is the spot price divided by the 365-day average daily price (Blockchain.com). Above 2.2 has been a late-cycle zone. Below 0.5 has been miner capitulation.',
            flashing: puellHas && puellNum >= 2.2
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

    // 4-year average of daily prices (Blockchain.com), not the power-law curve
    {
        var ma4Has = !!(price && hist.ma1460);
        var ma4yNum = ma4Has ? price / hist.ma1460 : null;
        indicators.push({
            emoji: '📊', name: '4-Year MA Multiple',
            value: ma4Has ? ma4yNum.toFixed(2) + 'x' : '—',
            color: !ma4Has ? 'var(--heading)' : ma4yNum >= 3.5 ? '#ef4444' : ma4yNum < 1 ? '#22c55e' : 'var(--heading)',
            sub: ma4Has ? ('4Y MA: $' + fmtNum(Math.round(hist.ma1460)) + (ma4yNum >= 3.5 ? ' · Top zone' : '')) : 'Daily history unavailable',
            tip: 'Price divided by the average of the last 1,460 daily prices (Blockchain.com). When price has exceeded about 3.5× that average, it has lined up with cycle tops. Below 1× has been an accumulation zone.',
            flashing: ma4Has && ma4yNum >= 3.5
        });
    }

    // CBBI normalized RUPL (0–1), not raw NUPL
    {
        var nuplN = d.cbbi && d.cbbi.nupl != null ? Number(d.cbbi.nupl) : null;
        var nuplHas = nuplN != null && isFinite(nuplN);
        indicators.push({
            emoji: '💰', name: 'NUPL (CBBI)',
            value: nuplHas ? Math.round(nuplN * 100) + '%' : '—',
            color: !nuplHas ? 'var(--heading)' : nuplN >= 0.75 ? '#ef4444' : nuplN <= 0.2 ? '#22c55e' : 'var(--heading)',
            sub: nuplHas ? (nuplN >= 0.75 ? 'Normalized euphoria' : nuplN <= 0.2 ? 'Normalized low zone' : 'CBBI 0–1 score') : 'CBBI unavailable',
            tip: 'CBBI\'s normalized RUPL input, scaled 0 to 1 (shown as a percent). This is not raw NUPL, which is unrealized profit divided by market cap. CBBI treats 0.75 as its top threshold for this input.',
            flashing: nuplHas && nuplN >= 0.75,
            id: 'nuplScore'
        });
    }

    // 20. Altcoin Season Index (BTC dominance inverse — estimated)
    // Moved from simple dominance to include flashing at <40% (alt season = BTC top risk)
    // (BTC Dominance is already indicator 11 — this adds the alt season angle)

    // AHR999 = (price / 200d MA) × (price / power-law fit)
    if (price && hist.ma200) {
        var _dsg3 = Math.floor((Date.now() - new Date('2009-01-03').getTime()) / 86400000);
        var logFit = Math.pow(10, 5.82 * Math.log10(_dsg3) - 17.01);
        var ahrNum = (logFit > 0) ? (price / hist.ma200) * (price / logFit) : null;
        indicators.push({
            emoji: '🔢', name: 'AHR999',
            value: ahrNum != null ? ahrNum.toFixed(2) : '—',
            color: ahrNum > 1.2 ? '#ef4444' : ahrNum < 0.45 ? '#22c55e' : 'var(--heading)',
            sub: ahrNum > 1.2 ? 'Overvalued — stop DCA' : ahrNum < 0.45 ? 'Deep value — DCA zone' : ahrNum < 1 ? 'Below model — DCA' : 'Near model',
            tip: 'AHR999 = (price / 200-day average) × (price / power-law fit). The 200-day average is Blockchain.com daily prices. The fit is P = 10^(5.82 × log10(days since genesis) − 17.01). Below 0.45 has been a deep-value zone. Above 1.2 has been a stop-DCA zone.',
            flashing: ahrNum >= 1.2
        });
    }

    {
        var ma2Has = !!(price && hist.ma730);
        var ma2y = ma2Has ? hist.ma730 : null;
        var ma2yx5 = ma2Has ? ma2y * 5 : null;
        var ma2Mult = ma2Has ? price / ma2y : null;
        var above2y = ma2Has && price > ma2yx5;
        indicators.push({
            emoji: '📉', name: '2-Year MA ×5',
            value: ma2Has ? ma2Mult.toFixed(2) + 'x' : '—',
            color: !ma2Has ? 'var(--heading)' : above2y ? '#ef4444' : price < ma2y ? '#22c55e' : 'var(--heading)',
            sub: ma2Has ? ('MA: $' + fmtNum(Math.round(ma2y)) + ' · ×5: $' + fmtNum(Math.round(ma2yx5)) + (above2y ? ' · Above' : '')) : 'Daily history unavailable',
            tip: 'Price divided by the average of the last 730 daily prices (Blockchain.com). Buying below that average has historically been early. Price above 5× that average has lined up with tops.',
            flashing: above2y
        });
    }

    {
        var grHas = !!(price && hist.ma350);
        var grNum = grHas ? price / hist.ma350 : null;
        var grLevel = !grHas ? '' : grNum >= 8 ? 'Above ×8' : grNum >= 5 ? 'Above ×5 — overheated' : grNum >= 3 ? 'Above ×3 — elevated' : grNum >= 1.6 ? 'Above ×1.6 — bullish' : 'Below ×1.6';
        indicators.push({
            emoji: '🔱', name: 'Golden Ratio',
            value: grHas ? grNum.toFixed(2) + 'x' : '—',
            color: !grHas ? 'var(--heading)' : grNum >= 5 ? '#ef4444' : grNum >= 3 ? '#f97316' : 'var(--heading)',
            sub: grHas ? ('350d MA: $' + fmtNum(Math.round(hist.ma350)) + ' · ' + grLevel) : 'Daily history unavailable',
            tip: 'Price divided by the real 350-day average of daily prices (Blockchain.com), read against Fibonacci multiples (1.6, 2, 3, 5, 8). Top threshold used here: 5×.',
            flashing: grHas && grNum >= 5
        });
    }

    // Terminal Price needs thermocap (issuance × the price on the day mined).
    // The free daily series starts in 2021, so that sum is not computed here.

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

    // 3-month return, annualized with ^4, from the daily price 90 days ago
    {
        var annHas = !!(price && hist.price90d);
        var ann3mNum = annHas ? (Math.pow(price / hist.price90d, 4) - 1) * 100 : null;
        var ann3mStr = annHas ? Math.round(ann3mNum).toString() : '';
        indicators.push({
            emoji: '🚀', name: '3M Annualized',
            value: annHas ? ((ann3mNum >= 0 ? '+' : '') + ann3mStr + '%') : '—',
            color: !annHas ? 'var(--heading)' : ann3mNum > 200 ? '#ef4444' : ann3mNum > 100 ? '#f97316' : 'var(--heading)',
            sub: annHas ? ('90d ago: $' + fmtNum(Math.round(hist.price90d)) + (ann3mNum > 200 ? ' · Very high' : ann3mNum > 100 ? ' · High' : '')) : 'Daily history unavailable',
            tip: 'The spot price versus the daily price 90 days earlier (Blockchain.com), raised to the 4th power to annualize a quarter. Above +200% has been a late-bull reading.',
            flashing: annHas && ann3mNum > 200,
            id: 'ann3m'
        });
    }

    {
        var mstrOk = !!(d.mstr && d.mstr.btc && d.mstr.avgCost && price);
        var mstrPnL = mstrOk ? ((price - d.mstr.avgCost) / d.mstr.avgCost * 100) : null;
        indicators.push({
            emoji: '🏢', name: 'MSTR Avg Cost',
            value: mstrOk ? ('$' + fmtNum(Math.round(d.mstr.avgCost))) : '—',
            sub: mstrOk ? (fmtNum(Math.round(d.mstr.btc)) + ' BTC · P&L: ' + (mstrPnL >= 0 ? '+' : '') + mstrPnL.toFixed(1) + '%') : 'Treasury feed unavailable',
            tip: mstrOk
                ? ('Strategy holdings and average cost from CoinGecko public treasury (entry value / coins). ' + fmtNum(Math.round(d.mstr.btc)) + ' BTC at $' + fmtNum(Math.round(d.mstr.avgCost)) + '. Same feed as the treasury card.')
                : 'Strategy holdings come from the CoinGecko public-treasury feed when that snapshot includes them.',
            flashing: false, noFlashLogic: true
        });
    }


    function cbbiCard(name, key, emoji, hi, lo, hiLabel, loLabel, tip) {
        var raw = d.cbbi && d.cbbi[key] != null ? Number(d.cbbi[key]) : null;
        var ok = raw != null && isFinite(raw);
        var pct = ok ? Math.round(raw * 100) : null;
        return {
            emoji: emoji, name: name,
            value: ok ? pct + '%' : '—',
            color: !ok ? 'var(--heading)' : raw >= hi ? '#ef4444' : raw <= lo ? '#22c55e' : 'var(--heading)',
            sub: ok ? (raw >= hi ? hiLabel : raw <= lo ? loLabel : 'CBBI 0–1 score' + (d.cbbi.asOf ? ' · ' + new Date(d.cbbi.asOf).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '')) : 'CBBI unavailable',
            tip: tip,
            flashing: ok && raw >= hi
        };
    }
    var cbbiConf = cbbiCard('CBBI Index', 'confidence', '🎯', 0.8, 0.2, 'Approaching top', 'Approaching bottom', 'Colin Talks Crypto Bitcoin Bull Run Index, a 0–1 blend of nine normalized metrics (shown as a percent). Above 80 has been late-cycle on their scale. Below 20 has been early-cycle. This is their index, not a raw on-chain reading.');
    cbbiConf.id = 'cbbiScore';
    indicators.push(cbbiConf);
    var rhodlCard = cbbiCard('RHODL (CBBI)', 'rhodl', '💎', 0.85, 0.2, 'Normalized high', 'Normalized low', 'CBBI\'s normalized RHODL input, scaled 0 to 1. This is not the raw Realized HODL ratio. Their top threshold for this input is 0.85.');
    rhodlCard.id = 'rhodlRatio';
    indicators.push(rhodlCard);
    var macroCard = cbbiCard('Macro Osc. (CBBI)', 'woobull', '📊', 0.7, 0.2, 'Normalized high', 'Normalized low', 'CBBI\'s normalized Woobull macro-oscillator input, scaled 0 to 1. This is not the raw oscillator. Their top threshold for this input is 0.7.');
    macroCard.id = 'macroOsc';
    indicators.push(macroCard);


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


    {
        var mixHas = d.cbbi && d.cbbi.mvrv != null && d.cbbi.puell != null;
        var mixNum = mixHas ? (Number(d.cbbi.mvrv) + Number(d.cbbi.puell)) / 2 : null;
        indicators.push({
            emoji: '⏳', name: 'CBBI MVRV/Puell',
            value: mixHas ? Math.round(mixNum * 100) + '%' : '—',
            color: !mixHas ? 'var(--heading)' : mixNum >= 0.7 ? '#ef4444' : mixNum <= 0.25 ? '#22c55e' : 'var(--heading)',
            sub: mixHas ? 'Average of two CBBI 0–1 scores' : 'CBBI unavailable',
            tip: 'Average of CBBI\'s normalized MVRV and Puell scores. This is not the long-term-holder to short-term-holder supply ratio. Both inputs are 0–1 index values, not coin counts.',
            flashing: mixHas && mixNum >= 0.7,
            id: 'lthSthRatio'
        });
    }

    {
        var rsiHas = hist.rsi22 != null && isFinite(Number(hist.rsi22));
        var rsiNum = rsiHas ? Number(hist.rsi22) : null;
        indicators.push({
            emoji: '📉', name: 'RSI-22 Day',
            value: rsiHas ? rsiNum.toFixed(1) : '—',
            color: !rsiHas ? 'var(--heading)' : rsiNum >= 80 ? '#ef4444' : rsiNum <= 30 ? '#22c55e' : 'var(--heading)',
            sub: rsiHas ? (rsiNum >= 80 ? 'Overbought' : rsiNum <= 30 ? 'Oversold' : rsiNum >= 60 ? 'Bullish' : rsiNum <= 40 ? 'Bearish' : 'Neutral') : 'Daily history unavailable',
            tip: 'Wilder RSI over 22 daily closes (Blockchain.com). Above 80 has been overbought. Below 30 has been oversold.',
            flashing: rsiHas && rsiNum >= 80,
            id: 'rsi22d'
        });
    }

    {
        var ahrxHas = !!(price && hist.ma200);
        var ahrxNum = ahrxHas ? Math.pow(price / hist.ma200, 2) : null;
        indicators.push({
            emoji: '🚨', name: 'AHR999x',
            value: ahrxHas ? ahrxNum.toFixed(2) : '—',
            color: !ahrxHas ? 'var(--heading)' : ahrxNum >= 8 ? '#ef4444' : ahrxNum >= 3.5 ? '#f97316' : 'var(--heading)',
            sub: ahrxHas ? ('(price / 200d MA)² · MA $' + fmtNum(Math.round(hist.ma200))) : 'Daily history unavailable',
            tip: '(Price / 200-day average) squared. The average is Blockchain.com daily prices. Above 8 has been an extreme reading. Above 3.5 is elevated.',
            flashing: ahrxHas && ahrxNum >= 8,
            id: 'ahr999x'
        });
    }

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
    var topSignalIndicators = indicators.length;

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
        html += '<div' + (ind.tip ? ' data-dash-tip="' + ind.tip.replace(/[\\'"]/g, "").replace(/"/g, '&quot;') + '" style="' + bgExtra + 'border:1px solid ' + borderCol + ';border-radius:12px;padding:12px;cursor:help;transition:0.2s;position:relative;"' : ' style="' + bgExtra + 'border:1px solid ' + borderCol + ';border-radius:12px;padding:12px;position:relative;"') + '>';
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

    // Attach tooltip listeners for indicator cards
    setTimeout(function() { if (typeof window._attachTipListeners === 'function') window._attachTipListeners(); }, 50);

    // Cache the rendered indicators HTML
    try { localStorage.setItem(TOP_IND_CACHE_KEY, JSON.stringify({ html: html, ts: Date.now() })); } catch(e) {}

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
                var flowAsOf = _snapshotAsOf(etf.latestDate);
                if (sub) sub.textContent = flowAsOf + ' · ' + etf.outflowDays + '/' + etf.totalDays + ' outflow days' + (etf.outflowDays >= 7 ? ' ⚠️' : '');
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
                if (sub5) sub5.textContent = _snapshotAsOf(etf.latestDate) + ' · 5-day total' + (s5 < -500 ? ' · Heavy selling' : s5 > 500 ? ' · Strong inflows' : '');
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
            // Try to get total from cached ETF JSON, fall back to estimate
            var etfBtcHeld = ETF_TOTAL_BTC_FALLBACK;
            try { var _ec = JSON.parse(localStorage.getItem('btc_etf_holdings_cache')); if (_ec && _ec.totalBtc) etfBtcHeld = _ec.totalBtc; } catch(e) {}
            var btcPrice = (_dashData && _dashData.price) || parseFloat(localStorage.getItem('btc_last_price')) || 0;
            var btcSupply = (_dashData && _dashData.supply) || 0;
            var etfAum = etfBtcHeld * btcPrice;
            var btcMktCap = btcPrice * btcSupply;
            var etfRatio = btcMktCap > 0 ? ((etfAum / btcMktCap) * 100).toFixed(1) : '—';
            var etfRatioEl = document.getElementById('etfBtcRatio');
            if (etfRatioEl) {
                var erNum = parseFloat(etfRatio);
                etfRatioEl.textContent = etfRatio + '%';
                etfRatioEl.style.color = erNum >= 8 ? '#ef4444' : 'var(--heading)';
                var erSub = etfRatioEl.nextElementSibling;
                if (erSub) erSub.textContent = (btcSupply ? '' : 'Supply unavailable · ') + 'ETF AUM: ~$' + (btcPrice ? (etfAum / 1e9).toFixed(0) + 'B' : '—') + (erNum >= 8 ? ' · High exposure' : '');
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

// ── Live Gold vs Bitcoin (CoinGecko tether-gold price → calculate gold market cap) ──
var TOTAL_GOLD_OZ = 222600 * 32150.7; // ~7.16 billion troy oz above-ground gold (World Gold Council, end-Q2 2026: 222,600 tonnes)

function _snapshotAsOf(dateStr) {
    var t = Date.parse(dateStr);
    if (!isFinite(t)) return dateStr ? String(dateStr) : 'date unknown';
    var days = Math.floor((Date.now() - t) / 86400000);
    var pretty = new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    if (days >= 3) return 'As of ' + pretty + ' · snapshot, not live';
    return 'As of ' + pretty;
}

function _renderGoldFromSnapshot(goldUsd, btcMktCapT, btcSupply) {
    if (goldUsd && isFinite(Number(goldUsd))) {
        _renderGold(Number(goldUsd), btcMktCapT, btcSupply);
        return;
    }
    var area = document.getElementById('goldPctArea');
    if (area) area.innerHTML = '<div style="color:var(--text-faint);font-size:0.75rem;">Gold price unavailable</div>';
    var label = document.getElementById('goldMktCapLabel');
    if (label) label.textContent = '—';
}

function _renderGold(goldPricePerOz, btcMktCapT, btcSupply) {
    var goldMktCapT = (goldPricePerOz * TOTAL_GOLD_OZ) / 1e12;
    var goldPct = btcMktCapT > 0 ? (btcMktCapT / goldMktCapT * 100).toFixed(1) : '—';
    var flipPrice = btcSupply > 0 ? Math.round(goldMktCapT * 1e12 / btcSupply) : '—';

    var label = document.getElementById('goldMktCapLabel');
    if (label) label.textContent = '$' + goldMktCapT.toFixed(1) + 'T';

    var bar = document.getElementById('goldBar');
    if (bar) bar.style.width = Math.min(parseFloat(goldPct) || 0, 100) + '%';

    var area = document.getElementById('goldPctArea');
    if (area) {
        area.innerHTML =
            '<div style="color:var(--accent);font-size:1rem;font-weight:900;">' + goldPct + '% of Gold Market Cap</div>' +
            '<div style="color:var(--text-faint);font-size:0.68rem;margin-top:2px;">BTC needs ~$' + (typeof flipPrice === 'number' ? fmtNum(flipPrice) : flipPrice) + '/coin to match Gold</div>' +
            '<div style="color:var(--text-faint);font-size:0.55rem;margin-top:4px;">Gold: $' + fmtNum(Math.round(goldPricePerOz)) + '/oz · Tether Gold via CoinGecko</div>';
    }

    // Add tooltip via data attribute + re-attach listeners
    var card = document.getElementById('goldCompareCard');
    if (card) {
        var goldTip = 'Gold has been humanitys store of value for 5,000+ years. Bitcoin is digital gold — scarce, durable, portable, divisible, and verifiable. Gold price: $' + fmtNum(Math.round(goldPricePerOz)) + '/oz. Total above-ground gold: ~222,600 tonnes (~7.16B troy oz, World Gold Council Q2 2026). Gold market cap: ~$' + goldMktCapT.toFixed(1) + 'T. The flippening = Bitcoin absorbs golds entire monetary premium.';
        card.setAttribute('data-dash-tip', goldTip);
        if (typeof window._attachTipListeners === 'function') window._attachTipListeners();
    }
}

// ── Live Treasury Data (CoinGecko API + government estimates) ──
function _renderTreasuryFromSnapshot(treasury, btcPrice) {
    var container = document.getElementById('treasuryData');
    if (!container) return;
    if (!treasury || !treasury.companies || !treasury.companies.length) {
        container.innerHTML = '<div style="color:var(--text-faint);font-size:0.75rem;">Treasury data unavailable</div>';
        return;
    }
    _renderTreasury(container, {
        companies: treasury.companies,
        total_holdings: treasury.totalHoldings,
        total_value_usd: treasury.totalValueUsd
    }, btcPrice);
}

// Government holdings (updated from bitcointreasuries.net — no free API, so semi-static)
var GOV_HOLDINGS = [
    { name: '🇺🇸 United States', btc: 325293 },
    { name: '🇨🇳 China', btc: 190000 },
    { name: '🇬🇧 United Kingdom', btc: 61245 },
    { name: '🇧🇹 Bhutan', btc: 10635 },
    { name: '🇸🇻 El Salvador', btc: 6135 }
];
var GOV_TOTAL = 649864;

function _renderTreasury(container, data, btcPrice) {
    var companies = (data.companies || []).slice(0, 5);
    var totalCompany = Math.round(data.total_holdings || 0);
    var totalCompanyUsd = data.total_value_usd || 0;
    var price = btcPrice || (totalCompany > 0 ? totalCompanyUsd / totalCompany : 0);

    var companyList = companies.map(function(c) {
        return '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:0.7rem;"><span style="color:var(--text);">' + BQSafe.esc(c.name || '?') + '</span><span style="color:var(--accent);font-weight:700;">' + fmtNum(c.total_holdings) + ' BTC</span></div>';
    }).join('');

    var govList = GOV_HOLDINGS.map(function(g) {
        return '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:0.7rem;"><span style="color:var(--text);">' + BQSafe.esc(g.name) + '</span><span style="color:var(--accent);font-weight:700;">' + fmtNum(g.btc) + ' BTC</span></div>';
    }).join('');

    var grandTotal = totalCompany + GOV_TOTAL;

    container.innerHTML =
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px;">' +
            '<div style="text-align:center;padding:10px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:10px;">' +
                '<div style="font-size:0.6rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">🏢 Public Companies</div>' +
                '<div style="font-size:1.1rem;font-weight:900;color:var(--heading);">' + fmtNum(totalCompany) + '</div>' +
                '<div style="font-size:0.65rem;color:var(--text-muted);">BTC · ~' + fmtDollar(totalCompanyUsd || totalCompany * price) + '</div>' +
            '</div>' +
            '<div style="text-align:center;padding:10px;background:rgba(234,179,8,0.06);border:1px solid rgba(234,179,8,0.2);border-radius:10px;">' +
                '<div style="font-size:0.6rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">🏛️ Governments</div>' +
                '<div style="font-size:1.1rem;font-weight:900;color:var(--heading);">' + fmtNum(GOV_TOTAL) + '</div>' +
                '<div style="font-size:0.65rem;color:var(--text-muted);">BTC · ~' + fmtDollar(GOV_TOTAL * price) + '</div>' +
            '</div>' +
        '</div>' +
        '<div style="text-align:center;margin-bottom:10px;font-size:0.6rem;color:var(--text-faint);">Total: ' + fmtNum(grandTotal) + ' BTC (' + (grandTotal / 21000000 * 100).toFixed(1) + '% of supply)</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
            '<div style="background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.15);border-radius:8px;padding:8px;">' +
                '<div style="font-size:0.6rem;color:var(--text-faint);font-weight:700;margin-bottom:4px;">TOP 5 COMPANIES</div>' +
                companyList +
            '</div>' +
            '<div style="background:rgba(234,179,8,0.04);border:1px solid rgba(234,179,8,0.15);border-radius:8px;padding:8px;">' +
                '<div style="font-size:0.6rem;color:var(--text-faint);font-weight:700;margin-bottom:4px;">TOP 5 GOVERNMENTS</div>' +
                govList +
            '</div>' +
        '</div>' +
        '<div style="text-align:center;margin-top:8px;font-size:0.68rem;color:var(--text-muted);">Companies: CoinGecko, same shared snapshot · Governments: manual estimates, not a live feed · <a href="https://bitcointreasuries.net/governments" target="_blank" rel="noopener" style="color:var(--accent);">bitcointreasuries.net</a></div>';

    // Remove the onclick tip since we now show data inline
    var card = document.getElementById('treasuryCard');
    if (card) card.removeAttribute('onclick');
}

// ── Bitcoin ETF Holdings (loaded from data/etf-holdings.json, updated by cron) ──
// Fallback data if JSON fetch fails
var ETF_HOLDINGS_FALLBACK = [
    { ticker: 'IBIT', name: 'BlackRock', btc: 787044, color: '#6366f1' },
    { ticker: 'FBTC', name: 'Fidelity', btc: 213399, color: '#22c55e' },
    { ticker: 'GBTC', name: 'Grayscale', btc: 180584, color: '#eab308' },
    { ticker: 'ARKB', name: 'ARK 21Shares', btc: 63920, color: '#f97316' },
    { ticker: 'BITB', name: 'Bitwise', btc: 53930, color: '#06b6d4' }
];
var ETF_TOTAL_BTC_FALLBACK = 1367239;

function _renderEtfHoldings(btcPrice, supply) {
    var container = document.getElementById('etfHoldingsData');
    if (!container) return;
    var price = btcPrice || parseFloat(localStorage.getItem('btc_last_price')) || 83000;
    var totalSupply = supply || 19840000;

    // Try to load from cached JSON first (instant render)
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem('btc_etf_holdings_cache')); } catch(e) {}
    if (cached && cached.holdings) _renderEtfData(container, cached.holdings, cached.totalBtc, price, totalSupply, cached.updated);

    // Fetch fresh data from JSON file (updated by cron: scripts/update-etf-holdings.sh)
    fetch('data/etf-holdings.json?v=' + Math.floor(Date.now() / 3600000))
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data && data.holdings && data.holdings.length) {
                try { localStorage.setItem('btc_etf_holdings_cache', JSON.stringify(data)); } catch(e) {}
                _renderEtfData(container, data.holdings, data.totalBtc, price, totalSupply, data.updated);
            }
        })
        .catch(function() {
            // Use fallback if no cached data either
            if (!cached) _renderEtfData(container, ETF_HOLDINGS_FALLBACK, ETF_TOTAL_BTC_FALLBACK, price, totalSupply, null);
        });
}

function _renderEtfData(container, holdings, totalBtc, price, totalSupply, updatedStr) {
    var totalAum = totalBtc * price;
    var supplyPct = (totalBtc / totalSupply * 100).toFixed(1);
    var maxBtc = holdings[0].btc;

    var listHtml = holdings.map(function(etf) {
        var barW = Math.max(4, (etf.btc / maxBtc * 100)).toFixed(0);
        var aum = fmtDollar(etf.btc * price);
        return '<div style="margin-bottom:8px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">' +
                '<span style="font-size:0.72rem;font-weight:700;color:var(--text);">' + etf.ticker + ' <span style="font-weight:400;color:var(--text-muted);">' + etf.name + '</span></span>' +
                '<span style="font-size:0.72rem;font-weight:800;color:var(--accent);">' + fmtNum(etf.btc) + ' BTC</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:6px;">' +
                '<div style="flex:1;background:var(--border);height:5px;border-radius:3px;overflow:hidden;">' +
                    '<div style="height:100%;background:' + etf.color + ';width:' + barW + '%;border-radius:3px;transition:width 0.5s;"></div>' +
                '</div>' +
                '<span style="font-size:0.55rem;color:var(--text-faint);min-width:36px;text-align:right;">' + aum + '</span>' +
            '</div>' +
        '</div>';
    }).join('');

    container.innerHTML =
        '<div style="text-align:center;margin-bottom:10px;">' +
            '<div style="font-size:1.2rem;font-weight:900;color:var(--heading);">' + fmtNum(totalBtc) + ' BTC</div>' +
            '<div style="font-size:0.72rem;color:#f59e0b;font-weight:700;margin-top:2px;">' + (updatedStr ? _snapshotAsOf(updatedStr) : 'As-of date missing') + '</div>' +
            '<div style="font-size:0.65rem;color:var(--text-muted);">~' + fmtDollar(totalAum) + ' AUM · ' + supplyPct + '% of supply held in ETFs</div>' +
        '</div>' +
        '<div style="padding:0 4px;">' + listHtml + '</div>' +
        '<div style="text-align:center;margin-top:8px;font-size:0.55rem;color:var(--text-faint);">' +
            'SEC filings + <a href="https://www.coinglass.com/BitcoinETF" target="_blank" rel="noopener" style="color:var(--accent);">CoinGlass</a>' +
        '</div>';
}

// Live halving countdown ticker (updates every second)
var _halvingTickerInterval = null;
window._startHalvingTicker = function() {
    if (_halvingTickerInterval) clearInterval(_halvingTickerInterval);
    _halvingTickerInterval = setInterval(function() {
        if (!window._halvingTargetMs) return;
        var sEl = document.getElementById('halvSecs');
        if (!sEl) { clearInterval(_halvingTickerInterval); _halvingTickerInterval = null; return; }
        var diff = Math.max(0, window._halvingTargetMs - Date.now());
        var totalSec = Math.floor(diff / 1000);
        var days = Math.floor(totalSec / 86400);
        var hours = Math.floor((totalSec % 86400) / 3600);
        var mins = Math.floor((totalSec % 3600) / 60);
        var secs = totalSec % 60;
        var dEl = document.getElementById('halvDays');
        var hEl = document.getElementById('halvHours');
        var mEl = document.getElementById('halvMins');
        if (dEl) dEl.textContent = days;
        if (hEl) hEl.textContent = hours;
        if (mEl) mEl.textContent = mins;
        sEl.textContent = secs < 10 ? '0' + secs : secs;
    }, 1000);
};

})();
