// © 2024-2026 603BTC LLC. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
// =============================================
// 🦌 Nacho Live Data — Price, Block Height, Mempool, Halving, History
// =============================================

(function() {

let nachoLiveData = {
    price: null,
    blockHeight: null,
    fees: null,
    mempoolSize: null,
    lastFetch: 0,
};

const FETCH_INTERVAL = 300000; // 5 minutes
var _lastTickerPrice = null;

// ---- Fetch live data from mempool.space API ----
async function fetchLiveData() {
    const now = Date.now();
    if (now - nachoLiveData.lastFetch < FETCH_INTERVAL && nachoLiveData.price) return;

    try {
        const priceRes = await fetch('https://mempool.space/api/v1/prices');
        if (priceRes.ok) {
            const priceData = await priceRes.json();
            nachoLiveData.price = priceData.USD;
        }
        const heightRes = await fetch('https://mempool.space/api/blocks/tip/height');
        if (heightRes.ok) {
            nachoLiveData.blockHeight = parseInt(await heightRes.text());
        }
        const feeRes = await fetch('https://mempool.space/api/v1/fees/recommended');
        if (feeRes.ok) {
            nachoLiveData.fees = await feeRes.json();
        }
        const mempoolRes = await fetch('https://mempool.space/api/mempool');
        if (mempoolRes.ok) {
            const mp = await mempoolRes.json();
            nachoLiveData.mempoolSize = mp.count;
        }

        nachoLiveData.lastFetch = now;
        if (!window._btcData) window._btcData = {};
        window._btcData.price = nachoLiveData.price;
        window._btcData.height = nachoLiveData.blockHeight;
        window._btcData.lastUpdate = now;
        
        if (nachoLiveData.blockHeight) {
            const nextHalving = 1050000;
            window._btcData.halvingBlocks = nextHalving - nachoLiveData.blockHeight;
        }
    } catch (e) {
        console.log('Nacho live data fetch error:', e);
    }
}

window.getNachoLiveData = function() { return nachoLiveData; };


function initTicker() {
    var ticker = document.getElementById('btcTicker');
    if (!ticker) {
        ticker = document.createElement('div');
        ticker.id = 'btcTicker';
        document.body.prepend(ticker);
    }

    // Modern ticker style - fixed top, reserve space
    ticker.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10005;background:#030712;border-bottom:1px solid #f7931a;padding:0;height:32px;overflow:hidden;display:flex;align-items:center;font-family:inherit;font-size:0.75rem;color:#94a3b8;line-height:32px;';
    
    // The scrolling track (Triple content for seamless loop)
    var scroller = document.createElement('div');
    scroller.id = 'tickerScroller';
    scroller.style.cssText = 'display:flex;white-space:nowrap;width:max-content;animation:btcTickerScroll 25s linear infinite;will-change:transform;';
    
    const tickerHtml = "\n        <div class=\"ticker-item-set\" style=\"display:flex;align-items:center;padding-right:50px;\">\n            <span style=\"display:flex;align-items:center;gap:12px;\">\n                <span style=\"display:flex;align-items:center;gap:6px;\">\n                    <span style=\"color:#f7931a;font-weight:900;font-size:1.16rem;\">₿</span>\n                    <span class=\"t-price-val\" style=\"color:#fff;font-weight:800;\">$---,---</span>\n                    <span class=\"t-price-change\" style=\"font-size:0.7rem;font-weight:900;\"></span>\n                </span>\n                <span style=\"color:rgba(255,255,255,0.2);font-weight:100;\">|</span>\n                <span style=\"display:flex;align-items:center;gap:6px;cursor:pointer;\" onclick=\"window.open('https://mempool.space','_blank')\">\n                    <span style=\"color:#f7931a;font-size:0.9rem;\">⛏️</span>\n                    <span class=\"t-block-val\" style=\"color:#fff;font-weight:700;\">---,---</span>\n                </span>\n            </span>\n            <span style=\"color:rgba(255,255,255,0.2);margin-left:25px;margin-right:25px;\">|</span>\n            <span class=\"t-news-items\" style=\"color:#fff;font-weight:600;display:flex;align-items:center;gap:35px;\">\n                <span>📡 LOADING SIGNAL...</span>\n            </span>\n        </div>";
    scroller.innerHTML = tickerHtml + tickerHtml + tickerHtml + tickerHtml;
    ticker.innerHTML = '';
    ticker.appendChild(scroller);

    var style = document.getElementById('btcTickerStyle');
    if (!style) {
        style = document.createElement('style');
        style.id = 'btcTickerStyle';
        document.head.appendChild(style);
    }
    style.textContent = `
        @keyframes btcTickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        #btcTicker:hover #tickerScroller { animation-play-state: paused; }
        @media(max-width:900px) { 
            .mobile-bar { top: 32px !important; }
            main { padding-top: 130px !important; }
            aside { top: 130px !important; z-index: 10006; }
            #nachoModeScreen { height: calc(100vh - 32px) !important; margin-top: 32px; }
            #btcTicker { font-size: 0.65rem; height: 32px; visibility: visible !important; display: flex !important; }
            .progress-bar { top: 118px !important; }
        }
        @media(min-width:901px) { 
            aside { padding-top: 32px; }
            main { padding-top: 32px; }
            #nachoModeScreen { height: calc(100vh - 32px) !important; margin-top: 32px; }
            #btcTicker { visibility: visible !important; display: flex !important; }
            .progress-bar { top: 32px !important; }
        }`;

    fetch('newsletter-data.json?v=' + Date.now()).then(r => r.json()).then(data => {
        const itemsSets = ticker.querySelectorAll('.t-news-items');
        if (itemsSets && data.news) {
            let html = '';
            data.news.forEach((n, i) => { html += '<span><span style="color:#f7931a;opacity:0.6;margin-right:8px;font-weight:900;">SIGNAL #' + (i+1) + '</span> ' + n.title.toUpperCase() + '</span>'; });
            itemsSets.forEach(el => el.innerHTML = html);
        }
    }).catch(e => {
        ticker.querySelectorAll('.t-news-items').forEach(el => el.innerHTML = '<span>📡 TECHNICAL SIGNAL OFFLINE</span>');
    });

    updateTicker();
    setInterval(updateTicker, 60000);

    // Fetch live news immediately (don't wait 30 min)
    setTimeout(refreshSignalNews, 5000);

    // Refresh Signal news every 30 minutes — try live search first, fall back to static file
    function refreshSignalNews() {
        var proxy = localStorage.getItem('btc_nacho_search_proxy') || 'https://jolly-surf-219enacho-search.needcreations.workers.dev';
        
        // Try live news from Cloudflare Worker
        fetch(proxy + '?q=' + encodeURIComponent('Bitcoin news today'), { signal: AbortSignal.timeout(8000) })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data && data.results && data.results.length >= 2) {
                    var itemsSets = document.querySelectorAll('.t-news-items');
                    if (itemsSets.length > 0) {
                        var html = '';
                        var badWords = /crypto|ethereum|eth |solana|cardano|altcoin|shitcoin|dogecoin|xrp|ripple|nft |defi |web3/i;
                        var count = 0;
                        data.results.forEach(function(r) {
                            if (count >= 4) return;
                            var title = (r.title || '').replace(/<[^>]+>/g, '').substring(0, 80);
                            if (!title || badWords.test(title)) return;
                            count++;
                            html += '<span><span style="color:#f7931a;opacity:0.6;margin-right:8px;font-weight:900;">SIGNAL #' + count + '</span> ' + title.toUpperCase() + '</span>';
                        });
                        if (html) itemsSets.forEach(function(el) { el.innerHTML = html; });
                    }
                    return; // Live news worked
                }
                throw new Error('No live results');
            })
            .catch(function() {
                // Fall back to static file
                fetch('newsletter-data.json?v=' + Date.now()).then(function(r) { return r.json(); }).then(function(data) {
                    var itemsSets = document.querySelectorAll('.t-news-items');
                    if (itemsSets.length > 0 && data.news && data.news.length > 0) {
                        var html = '';
                        data.news.forEach(function(n, i) {
                            html += '<span><span style="color:#f7931a;opacity:0.6;margin-right:8px;font-weight:900;">SIGNAL #' + (i+1) + '</span> ' + n.title.toUpperCase() + '</span>';
                        });
                        itemsSets.forEach(function(el) { el.innerHTML = html; });
                    }
                }).catch(function() {});
            });
    }
    
    // First refresh after 30 min, then every 30 min
    setInterval(refreshSignalNews, 1800000);
}


function updateTicker() {
    fetchLiveData().then(function() {
        const priceEls = document.querySelectorAll('.t-price-val');
        const blockEls = document.querySelectorAll('.t-block-val');
        const changeEls = document.querySelectorAll('.t-price-change');

        if (nachoLiveData.price) {
            var p = nachoLiveData.price;
            priceEls.forEach(el => el.textContent = '$' + Math.round(p).toLocaleString());
            localStorage.setItem('btc_last_price', p);
            if (_lastTickerPrice !== null) {
                changeEls.forEach(el => {
                    if (p > _lastTickerPrice) { el.textContent = '▲'; el.style.color = '#22c55e'; }
                    else if (p < _lastTickerPrice) { el.textContent = '▼'; el.style.color = '#ef4444'; }
                    else { el.textContent = ''; }
                });
            }
            _lastTickerPrice = p;
        }

        if (nachoLiveData.blockHeight) {
            blockEls.forEach(el => el.textContent = nachoLiveData.blockHeight.toLocaleString());
            localStorage.setItem('btc_last_height', nachoLiveData.blockHeight);
        }
    });
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initTicker); } else { initTicker(); }

function formatPrice(p) { if (!p) return null; if (p >= 1000) return '$' + Math.round(p).toLocaleString(); return '$' + p.toFixed(2); }

function getHalvingInfo() {
    var height = nachoLiveData.blockHeight;
    if (!height) return null;
    var nextHalving = Math.ceil(height / 210000) * 210000;
    var blocksLeft = nextHalving - height;
    var daysLeft = Math.round(blocksLeft * 10 / 1440);
    return { nextHalving: nextHalving, blocksLeft: blocksLeft, daysLeft: daysLeft };
}

window.nachoLiveAnswer = function(q) {
    var lower = q.toLowerCase();
    if (/price|how much is|what.?s bitcoin at|current price|btc price|bitcoin worth|bitcoin cost/.test(lower)) {
        if (!nachoLiveData.price) return null;
        var p = formatPrice(nachoLiveData.price);
        var msgs = [ "Bitcoin is currently at " + p + "! Still early, {name}. 📈🦌", "The current BTC price is " + p + ". Number go up technology! 📊", "Right now, 1 BTC = " + p + ". How many sats are you stacking, {name}? ⚡" ];
        return { answer: msgs[Math.floor(Math.random() * msgs.length)], channel: 'charts', channelName: 'Charts' };
    }
    if (/block height|current block|what block|how many blocks|latest block/.test(lower)) {
        if (!nachoLiveData.blockHeight) {
            var cached = localStorage.getItem('btc_last_height');
            if (cached) return { answer: "I'm still syncing, but the last block I saw was " + parseInt(cached).toLocaleString() + "! ⛓️", channel: 'blockchain-timechain', channelName: 'Blockchain / Timechain' };
            return null;
        }
        return { answer: "We're currently at block " + nachoLiveData.blockHeight.toLocaleString() + "! Every block is history being written, {name}. ⛓️", channel: 'blockchain-timechain', channelName: 'Blockchain / Timechain' };
    }
    if (/halving|halvening|next halving|when.*halving|halving countdown/.test(lower)) {
        var info = getHalvingInfo();
        if (!info) return null;
        return { answer: "The next halving is at block " + info.nextHalving.toLocaleString() + " -- that's " + info.blocksLeft.toLocaleString() + " blocks away (~" + info.daysLeft + " days). Tick tock, {name}! ⏰", channel: 'scarce', channelName: 'Scarce' };
    }
    return null;
};

window.nachoLiveMessage = function() {
    if (Math.random() > 0.15) return null;
    fetchLiveData();
    if (!nachoLiveData.price) return null;
    var pool = [];
    if (nachoLiveData.price) {
        var p = formatPrice(nachoLiveData.price);
        pool.push({ pose: 'cool', text: "BTC is at " + p + " right now, {name}. Just thought you should know. 😎📈" });
    }
    if (nachoLiveData.blockHeight) {
        pool.push({ pose: 'brain', text: "We just passed block " + nachoLiveData.blockHeight.toLocaleString() + ". Every block is a heartbeat of the network. ⛓️💓" });
    }
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
};

setTimeout(fetchLiveData, 3000);
setInterval(fetchLiveData, FETCH_INTERVAL);

})();
