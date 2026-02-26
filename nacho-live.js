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

// ---- Fetch live data from mempool.space API ----
async function fetchLiveData() {
    const now = Date.now();
    if (now - nachoLiveData.lastFetch < FETCH_INTERVAL && nachoLiveData.price) return;

    try {
        // Price
        const priceRes = await fetch('https://mempool.space/api/v1/prices');
        if (priceRes.ok) {
            const priceData = await priceRes.json();
            nachoLiveData.price = priceData.USD;
        }

        // Block height
        const heightRes = await fetch('https://mempool.space/api/blocks/tip/height');
        if (heightRes.ok) {
            nachoLiveData.blockHeight = parseInt(await heightRes.text());
        }

        // Recommended fees
        const feeRes = await fetch('https://mempool.space/api/v1/fees/recommended');
        if (feeRes.ok) {
            nachoLiveData.fees = await feeRes.json();
        }

        // Mempool stats
        const mempoolRes = await fetch('https://mempool.space/api/mempool');
        if (mempoolRes.ok) {
            const mp = await mempoolRes.json();
            nachoLiveData.mempoolSize = mp.count;
        }

        nachoLiveData.lastFetch = now;
    } catch (e) {
        console.log('Nacho live data fetch error:', e);
    }
}

// ---- Expose live data for ticker ----
window.getNachoLiveData = function() { return nachoLiveData; };

// ---- Live Ticker Bar ----
function initTicker() {
    // Don't add if already exists
    if (document.getElementById('btcTicker')) return;

    var ticker = document.createElement('div');
    ticker.id = 'btcTicker';
    ticker.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;background:linear-gradient(90deg,#0d0d0d,#1a1a2e);border-bottom:1px solid rgba(247,147,26,0.2);padding:4px 12px;display:flex;align-items:center;justify-content:center;gap:16px;font-size:0.7rem;font-family:inherit;color:var(--text-muted,#888);transition:opacity 0.3s;';
    ticker.innerHTML =
        '<span id="tickerPrice" style="display:flex;align-items:center;gap:4px;cursor:pointer;" onclick="window.open(\'https://mempool.space\',\'_blank\')" title="View on mempool.space">' +
            '<span style="color:#f7931a;font-weight:800;">₿</span>' +
            '<span id="tickerPriceVal" style="color:var(--text,#eee);font-weight:700;">---</span>' +
            '<span id="tickerPriceChange" style="font-size:0.6rem;"></span>' +
        '</span>' +
        '<span style="color:rgba(255,255,255,0.1);">|</span>' +
        '<span id="tickerBlock" style="display:flex;align-items:center;gap:4px;cursor:pointer;" onclick="window.open(\'https://mempool.space\',\'_blank\')" title="Current block height">' +
            '<span style="color:#f7931a;">⛏️</span>' +
            '<span id="tickerBlockVal" style="color:var(--text,#eee);font-weight:600;">---</span>' +
        '</span>';

    document.body.appendChild(ticker);

    // Add CSS to push content down
    var style = document.createElement('style');
    style.id = 'btcTickerStyle';
    style.textContent =
        '#btcTicker { font-variant-numeric: tabular-nums; }' +
        '@media(max-width:900px) { ' +
            '.mobile-bar { top: 24px !important; }' +
            'main { padding-top: 78px !important; }' +
            'aside { top: 78px !important; }' +
            '#btcTicker { font-size: 0.65rem; padding: 2px 8px; gap: 10px; }' +
        '}' +
        '@media(min-width:901px) { ' +
            'aside { margin-top: 26px; }' +
            'main { margin-top: 26px; }' +
        '}';
    document.head.appendChild(style);

    // Start updating
    updateTicker();
    setInterval(updateTicker, 30000); // Update display every 30s
}

var _lastTickerPrice = null;

function updateTicker() {
    fetchLiveData().then(function() {
        var priceEl = document.getElementById('tickerPriceVal');
        var blockEl = document.getElementById('tickerBlockVal');
        var changeEl = document.getElementById('tickerPriceChange');
        if (!priceEl || !blockEl) return;

        if (nachoLiveData.price) {
            var p = nachoLiveData.price;
            priceEl.textContent = '$' + Math.round(p).toLocaleString();
            // Cache for marketplace USD conversion
            localStorage.setItem('btc_last_price', p);

            // Price change indicator
            if (_lastTickerPrice !== null && changeEl) {
                if (p > _lastTickerPrice) {
                    changeEl.textContent = '▲';
                    changeEl.style.color = '#22c55e';
                } else if (p < _lastTickerPrice) {
                    changeEl.textContent = '▼';
                    changeEl.style.color = '#ef4444';
                } else {
                    changeEl.textContent = '';
                }
            }
            _lastTickerPrice = p;
        }

        if (nachoLiveData.blockHeight) {
            blockEl.textContent = nachoLiveData.blockHeight.toLocaleString();
        }
    });
}

// Init ticker on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTicker);
} else {
    initTicker();
}

// ---- Format price nicely ----
function formatPrice(p) {
    if (!p) return null;
    if (p >= 1000) return '$' + Math.round(p).toLocaleString();
    return '$' + p.toFixed(2);
}

// ---- Halving countdown ----
function getHalvingInfo() {
    var height = nachoLiveData.blockHeight;
    if (!height) return null;
    var nextHalving = Math.ceil(height / 210000) * 210000;
    var blocksLeft = nextHalving - height;
    var daysLeft = Math.round(blocksLeft * 10 / 1440); // ~10 min per block
    return { nextHalving: nextHalving, blocksLeft: blocksLeft, daysLeft: daysLeft };
}

// ---- Answer live data questions ----
window.nachoLiveAnswer = function(q) {
    var lower = q.toLowerCase();

    // Price questions
    if (/price|how much is|what.?s bitcoin at|current price|btc price|bitcoin worth|bitcoin cost/.test(lower)) {
        if (!nachoLiveData.price) return null;
        var p = formatPrice(nachoLiveData.price);
        var msgs = [
            "Bitcoin is currently at " + p + "! Still early, {name}. 📈🦌",
            "The current BTC price is " + p + ". Number go up technology! 📊",
            "Right now, 1 BTC = " + p + ". How many sats are you stacking, {name}? ⚡",
        ];
        return { answer: msgs[Math.floor(Math.random() * msgs.length)], channel: 'charts', channelName: 'Charts' };
    }

    // Block height questions
    if (/block height|current block|what block|how many blocks|latest block/.test(lower)) {
        if (!nachoLiveData.blockHeight) return null;
        return { answer: "We're currently at block " + nachoLiveData.blockHeight.toLocaleString() + "! Every block is history being written, {name}. ⛓️", channel: 'blockchain-timechain', channelName: 'Blockchain / Timechain' };
    }

    // Halving questions
    if (/halving|halvening|next halving|when.*halving|halving countdown/.test(lower)) {
        var info = getHalvingInfo();
        if (!info) return null;
        return { answer: "The next halving is at block " + info.nextHalving.toLocaleString() + " — that's " + info.blocksLeft.toLocaleString() + " blocks away (~" + info.daysLeft + " days). Tick tock, {name}! ⏰", channel: 'scarce', channelName: 'Scarce' };
    }

    // Fee / mempool questions
    if (/fee|fees|mempool|transaction cost|how much to send|congestion|busy/.test(lower)) {
        if (!nachoLiveData.fees) return null;
        var f = nachoLiveData.fees;
        var status = f.fastestFee <= 5 ? "Fees are super low right now — great time to transact!" :
                     f.fastestFee <= 20 ? "Fees are moderate right now." :
                     "Fees are a bit high right now — consider using Lightning! ⚡";
        var count = nachoLiveData.mempoolSize ? " There are " + nachoLiveData.mempoolSize.toLocaleString() + " unconfirmed transactions in the mempool." : "";
        return { answer: status + " Fast: " + f.fastestFee + " sat/vB, Medium: " + f.halfHourFee + " sat/vB, Low: " + f.hourFee + " sat/vB." + count + " 📊", channel: 'transaction_fees', channelName: 'Transaction Fees' };
    }

    return null;
};

// ---- On This Day in Bitcoin History ----
const BITCOIN_HISTORY = [
    { month: 1, day: 3, text: "On this day in 2009, Satoshi Nakamoto mined the Genesis Block — Bitcoin was born! The block contains the message: 'Chancellor on brink of second bailout for banks.' 🎂📜" },
    { month: 1, day: 10, text: "On this day in 2009, Hal Finney tweeted 'Running Bitcoin' — the first ever tweet about Bitcoin! 🏃" },
    { month: 1, day: 11, text: "On this day in 2009, Satoshi sent the first Bitcoin transaction ever — 10 BTC to Hal Finney. History in the making! 📤" },
    { month: 1, day: 12, text: "On this day in 2009, the first Bitcoin transaction between two people was confirmed in block 170! ⛓️" },
    { month: 2, day: 6, text: "On this day in 2010, the first Bitcoin exchange was established. You could finally trade BTC for dollars! 💱" },
    { month: 3, day: 1, text: "Fun history fact: In March 2010, the first Bitcoin faucet gave away 5 BTC per person! Imagine that today. 🚰" },
    { month: 5, day: 2, text: "On this day in 2010, Laszlo Hanyecz paid 10,000 BTC for two pizzas — the first real-world Bitcoin transaction! 🍕" },
    { month: 5, day: 22, text: "🍕 Happy Bitcoin Pizza Day! On this day in 2010, 10,000 BTC bought two pizzas. That's billions of dollars today! 🍕🎉" },
    { month: 6, day: 9, text: "On this day in 2021, El Salvador became the first country to make Bitcoin legal tender! 🇸🇻⚡" },
    { month: 7, day: 23, text: "Bitcoin history: In July 2010, Mt. Gox launched as the first major Bitcoin exchange. A wild ride began! 📈" },
    { month: 8, day: 15, text: "On this day in 2010, the 'value overflow incident' created 184 billion BTC by accident. Satoshi fixed it within hours! 🐛🔧" },
    { month: 8, day: 18, text: "On this day in 2008, the domain bitcoin.org was registered. The revolution was being planned. 🌐" },
    { month: 9, day: 1, text: "Bitcoin history: In September 2012, the Bitcoin Foundation was established to promote Bitcoin adoption. 🏛️" },
    { month: 10, day: 31, text: "🎃 On this day in 2008, Satoshi published the Bitcoin whitepaper! 9 pages that changed the world. Happy Whitepaper Day! 📜" },
    { month: 11, day: 1, text: "On this day in 2008, Satoshi posted the whitepaper to the Cryptography Mailing List. The cypherpunks noticed immediately. 📧" },
    { month: 11, day: 28, text: "Bitcoin history: The first halving happened on November 28, 2012 — the block reward dropped from 50 to 25 BTC! ✂️" },
    { month: 12, day: 12, text: "On this day in 2010, Satoshi made his last known forum post. He said the project was 'in good hands' and disappeared. 👻" },
];

window.nachoHistoryToday = function() {
    var now = new Date();
    var month = now.getMonth() + 1;
    var day = now.getDate();
    for (var i = 0; i < BITCOIN_HISTORY.length; i++) {
        if (BITCOIN_HISTORY[i].month === month && BITCOIN_HISTORY[i].day === day) {
            return BITCOIN_HISTORY[i].text;
        }
    }
    return null;
};

// ---- Periodic live data messages ----
window.nachoLiveMessage = function() {
    // Only show live data messages sometimes
    if (Math.random() > 0.15) return null;

    fetchLiveData();

    if (!nachoLiveData.price) return null;

    var pool = [];

    // Price comment
    if (nachoLiveData.price) {
        var p = formatPrice(nachoLiveData.price);
        pool.push({ pose: 'cool', text: "BTC is at " + p + " right now, {name}. Just thought you should know. 😎📈" });
        pool.push({ pose: 'fire', text: "Current Bitcoin price: " + p + ". Still early! 🔥" });
    }

    // Block height
    if (nachoLiveData.blockHeight) {
        pool.push({ pose: 'brain', text: "We just passed block " + nachoLiveData.blockHeight.toLocaleString() + ". Every block is a heartbeat of the network. ⛓️💓" });
    }

    // Fee status
    if (nachoLiveData.fees) {
        if (nachoLiveData.fees.fastestFee <= 5) {
            pool.push({ pose: 'celebrate', text: "Fees are super low right now, {name}! Great time to consolidate UTXOs or make on-chain transactions. ⚡" });
        } else if (nachoLiveData.fees.fastestFee >= 30) {
            pool.push({ pose: 'think', text: "Fees are a bit spicy right now (" + nachoLiveData.fees.fastestFee + " sat/vB). Lightning Network to the rescue! ⚡" });
        }
    }

    // Halving
    var halving = getHalvingInfo();
    if (halving && halving.daysLeft < 365) {
        pool.push({ pose: 'fire', text: "Only " + halving.blocksLeft.toLocaleString() + " blocks until the next halving, {name}! Tick tock! ⏰" });
    }

    // History today
    var history = nachoHistoryToday();
    if (history) {
        pool.push({ pose: 'brain', text: history });
    }

    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
};

// Pre-fetch on load
setTimeout(fetchLiveData, 3000);
// Refresh periodically
setInterval(fetchLiveData, FETCH_INTERVAL);

})();
