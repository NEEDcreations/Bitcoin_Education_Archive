// =============================================
// Bitcoin Education Archive - Extra Features
// =============================================

// ---- BITCOIN QUOTE OF THE DAY ----
const BTC_QUOTES = [
    { q: "Bitcoin is a technological tour de force.", a: "Bill Gates", ch: "one-stop-shop" },
    { q: "Bitcoin is a remarkable cryptographic achievement and the ability to create something that is not duplicable in the digital world has enormous value.", a: "Eric Schmidt", ch: "one-stop-shop" },
    { q: "The Times Jan/03/2009 Chancellor on brink of second bailout for banks.", a: "Satoshi Nakamoto (Genesis Block)", ch: "history" },
    { q: "If you don't believe it or don't get it, I don't have the time to try to convince you, sorry.", a: "Satoshi Nakamoto", ch: "satoshi-nakamoto" },
    { q: "I think the internet is going to be one of the major forces for reducing the role of government. The one thing that's missing but will soon be developed, is a reliable e-cash.", a: "Milton Friedman (1999)", ch: "history" },
    { q: "Bitcoin is the most important invention in the history of the world since the Internet.", a: "Roger Ver", ch: "one-stop-shop" },
    { q: "We have elected to put our money and faith in a mathematical framework that is free of politics and human error.", a: "Tyler Winklevoss", ch: "money" },
    { q: "Every informed person needs to know about Bitcoin because it might be one of the world's most important developments.", a: "Leon Luow", ch: "one-stop-shop" },
    { q: "Bitcoin will do to banks what email did to the postal industry.", a: "Rick Falkvinge", ch: "layer-2-lightning" },
    { q: "Bitcoin is a way to have programmable scarcity. The blockchain is the data structure that records the transfer of scarce objects.", a: "Balaji Srinivasan", ch: "scarce" },
    { q: "I do think Bitcoin is the first encrypted money that has the potential to do something like change the world.", a: "Peter Thiel", ch: "one-stop-shop" },
    { q: "Bitcoin is the beginning of something great: a currency without a government, something necessary and imperative.", a: "Nassim Taleb", ch: "decentralized" },
    { q: "Running Bitcoin.", a: "Hal Finney (Jan 10, 2009)", ch: "history" },
    { q: "The root problem with conventional currency is all the trust that's required to make it work.", a: "Satoshi Nakamoto", ch: "satoshi-nakamoto" },
    { q: "Bitcoin is a very exciting development, it might lead to a world currency.", a: "Kim Dotcom", ch: "one-stop-shop" },
    { q: "Not your keys, not your coins.", a: "Bitcoin Proverb", ch: "self-custody" },
    { q: "Stay humble, stack sats.", a: "Bitcoin Proverb", ch: "investment-strategy" },
    { q: "There is no second best.", a: "Michael Saylor", ch: "giga-chad" },
    { q: "Bitcoin is hope.", a: "Michael Saylor", ch: "giga-chad" },
    { q: "Fix the money, fix the world.", a: "Bitcoin Proverb", ch: "problems-of-money" },
    { q: "In Bitcoin we trust.", a: "Bitcoin Community", ch: "one-stop-shop" },
    { q: "The future of money is digital currency.", a: "Bill Gates", ch: "use-cases" },
    { q: "Bitcoin is the currency of resistance.", a: "Max Keiser", ch: "human_rights__social_justice_and_freedo" },
    { q: "One does not simply understand Bitcoin. It's a rabbit hole.", a: "Bitcoin Community", ch: "one-stop-shop" },
    { q: "Tick tock, next block.", a: "Bitcoin Proverb", ch: "blockchain-timechain" },
    { q: "Number go up technology.", a: "Bitcoin Twitter", ch: "charts" },
    { q: "1 BTC = 1 BTC.", a: "Bitcoin Truth", ch: "money" },
    { q: "Bitcoin is a swarm of cyber hornets serving the goddess of wisdom, feeding on the fire of truth, exponentially growing ever smarter, faster, and stronger behind a wall of encrypted energy.", a: "Michael Saylor", ch: "giga-chad" },
    { q: "Gradually, then suddenly.", a: "Ernest Hemingway / Bitcoin Adoption", ch: "one-stop-shop" },
    { q: "The only way to stop Bitcoin is to stop the internet.", a: "Bitcoin Community", ch: "decentralized" },
];

function renderQuoteOfTheDay() {
    const el = document.getElementById('quoteOfDay');
    if (!el) return;
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const quote = BTC_QUOTES[dayOfYear % BTC_QUOTES.length];
    el.innerHTML = '<div onclick="go(\'' + quote.ch + '\')" style="cursor:pointer;padding:16px 20px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;text-align:center;transition:0.2s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
        '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">💬 Bitcoin Quote of the Day</div>' +
        '<div style="color:var(--text);font-size:1rem;font-style:italic;line-height:1.5;margin-bottom:8px;">"' + quote.q + '"</div>' +
        '<div style="color:var(--accent);font-size:0.85rem;font-weight:600;">— ' + quote.a + '</div>' +
        '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:6px;">Click to explore this topic →</div>' +
        '</div>';
}

// ---- EXPLORATION MAP ----
function renderExplorationMap() {
    const el = document.getElementById('explorationMap');
    if (!el) return;
    const visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
    const allKeys = Object.keys(CHANNELS);
    const total = allKeys.length;
    const count = visited.length;
    const pct = Math.round((count / total) * 100);

    let grid = '';
    allKeys.forEach(key => {
        const isVisited = visited.includes(key);
        const emoji = CHANNELS[key].title.match(/^([\p{Emoji}\u200d]+)/u);
        const icon = emoji ? emoji[1] : '📄';
        grid += '<div onclick="go(\'' + key + '\')" title="' + key + '" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:0.75rem;cursor:pointer;transition:0.2s;' +
            (isVisited ? 'background:rgba(247,147,26,0.15);border:1px solid rgba(247,147,26,0.3);' : 'background:var(--card-bg);border:1px solid var(--border);opacity:0.4;') +
            '">' + (isVisited ? icon : '?') + '</div>';
    });

    el.innerHTML = '<div style="padding:16px 20px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
        '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">🗺️ Exploration Map</div>' +
        '<div style="color:var(--accent);font-weight:700;font-size:0.9rem;">' + count + '/' + total + ' (' + pct + '%)</div></div>' +
        '<div class="rank-progress" style="margin-bottom:12px;"><div class="rank-progress-fill" style="width:' + pct + '%;"></div></div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + grid + '</div></div>';
}

// ---- HIDDEN BADGES ----
const HIDDEN_BADGES = [
    { id: 'night_owl', name: 'Night Owl', emoji: '🦉', desc: 'Visit the archive after midnight', check: function() { return new Date().getHours() >= 0 && new Date().getHours() < 5; } },
    { id: 'speed_runner', name: 'Speed Runner', emoji: '⚡', desc: 'Visit 10+ channels in one session', check: function() { return typeof sessionChannels !== 'undefined' && sessionChannels.size >= 10; } },
    { id: 'genesis', name: 'Genesis Reader', emoji: '📜', desc: 'Read the whitepaper channel', check: function() { return typeof currentChannelId !== 'undefined' && currentChannelId === 'whitepaper'; } },
    { id: 'scholar', name: 'Bitcoin Scholar', emoji: '🎓', desc: 'Pass the Scholar Certification', check: function() { return localStorage.getItem('btc_scholar_passed') === 'true'; } },
    { id: 'collector', name: 'Collector', emoji: '💎', desc: 'Save 10+ channels to favorites', check: function() { return JSON.parse(localStorage.getItem('btc_favs') || '[]').length >= 10; } },
];

function checkHiddenBadges() {
    let earned = JSON.parse(localStorage.getItem('btc_hidden_badges') || '[]');
    HIDDEN_BADGES.forEach(badge => {
        if (!earned.includes(badge.id) && badge.check()) {
            earned.push(badge.id);
            localStorage.setItem('btc_hidden_badges', JSON.stringify(earned));
            showBadgeUnlock(badge);
            // Save to Firebase
            if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth.currentUser) {
                db.collection('users').doc(auth.currentUser.uid).update({
                    hiddenBadges: firebase.firestore.FieldValue.arrayUnion(badge.id)
                }).catch(() => {});
            }
        }
    });
}

function showBadgeUnlock(badge) {
    if (typeof launchConfetti === 'function') launchConfetti();
    if (typeof playBadgeSound === 'function') playBadgeSound();
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:400;display:flex;justify-content:center;align-items:center;animation:fadeIn 0.3s;';
    overlay.innerHTML = '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:20px;padding:40px;max-width:320px;width:90%;text-align:center;">' +
        '<div style="font-size:3rem;margin-bottom:12px;animation:badgeBounce 0.6s;">' + badge.emoji + '</div>' +
        '<div style="color:#f7931a;font-size:0.7rem;text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-bottom:6px;">🔓 HIDDEN BADGE UNLOCKED!</div>' +
        '<div style="color:var(--heading);font-size:1.3rem;font-weight:800;margin-bottom:6px;">' + badge.name + '</div>' +
        '<div style="color:var(--text-muted);font-size:0.9rem;margin-bottom:20px;">' + badge.desc + '</div>' +
        '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">Awesome! 🎉</button></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
}

// Run badge checks periodically
setInterval(checkHiddenBadges, 10000);

// ---- READ NEXT SUGGESTIONS ----
function getRelatedChannels(channelId) {
    if (!CHANNELS[channelId]) return [];
    const currentCat = CHANNELS[channelId].cat;
    const allKeys = Object.keys(CHANNELS);
    const sameCat = allKeys.filter(k => k !== channelId && CHANNELS[k].cat === currentCat);
    const otherCat = allKeys.filter(k => k !== channelId && CHANNELS[k].cat !== currentCat);

    // Pick 2 from same category, 1 from different
    const picks = [];
    const shuffled = sameCat.sort(() => Math.random() - 0.5);
    picks.push(...shuffled.slice(0, 2));
    const shuffledOther = otherCat.sort(() => Math.random() - 0.5);
    picks.push(...shuffledOther.slice(0, 1));

    return picks;
}

function renderReadNext(channelId) {
    const related = getRelatedChannels(channelId);
    if (related.length === 0) return '';
    let html = '<div style="margin-top:30px;padding:20px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;">' +
        '<div style="color:var(--heading);font-weight:700;font-size:1rem;margin-bottom:12px;">📖 Read Next</div>';
    related.forEach(key => {
        const ch = CHANNELS[key];
        const emoji = ch.title.match(/^([\p{Emoji}\u200d]+)/u);
        const icon = emoji ? emoji[1] : '📄';
        const name = ch.title.replace(/^[\p{Emoji}\u200d]+/u, '').trim() || key;
        const desc = ch.desc ? ch.desc.substring(0, 80).replace(/<[^>]+>/g, '') + '...' : '';
        html += '<div onclick="go(\'' + key + '\')" style="padding:12px;margin-bottom:8px;background:var(--bg-side);border:1px solid var(--border);border-radius:10px;cursor:pointer;transition:0.2s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
            '<div style="font-weight:600;color:var(--text);font-size:0.9rem;">' + icon + ' ' + name + '</div>' +
            (desc ? '<div style="color:var(--text-muted);font-size:0.8rem;margin-top:4px;">' + desc + '</div>' : '') +
            '</div>';
    });
    html += '</div>';
    return html;
}

// ---- FLASHCARD MODE ----
const FLASHCARD_TOPICS = {
    'Bitcoin Basics': [
        { front: 'What is Bitcoin?', back: 'A decentralized digital currency that operates on a peer-to-peer network without a central authority.' },
        { front: 'Who created Bitcoin?', back: 'Satoshi Nakamoto, a pseudonymous person or group, published the whitepaper on October 31, 2008.' },
        { front: 'What is the maximum supply of Bitcoin?', back: '21 million coins. This cap is hardcoded into the protocol and can never be changed.' },
        { front: 'What is a satoshi?', back: 'The smallest unit of Bitcoin. 1 BTC = 100,000,000 satoshis.' },
        { front: 'What is the Genesis Block?', back: 'The very first block mined by Satoshi Nakamoto on January 3, 2009. It contained the message: "The Times Jan/03/2009 Chancellor on brink of second bailout for banks."' },
        { front: 'What makes Bitcoin scarce?', back: 'The 21 million coin supply cap, enforced by the halving mechanism that cuts the mining reward in half every 210,000 blocks (~4 years).' },
        { front: 'What is a Bitcoin halving?', back: 'An event every ~4 years where the block reward for miners is cut in half, reducing the rate of new Bitcoin creation.' },
        { front: 'What is proof of work?', back: 'A consensus mechanism where miners expend computational energy to solve cryptographic puzzles, securing the network and validating transactions.' },
        { front: 'What is a blockchain?', back: 'A distributed, immutable ledger that records all Bitcoin transactions in sequential blocks linked by cryptographic hashes.' },
        { front: 'What year will the last Bitcoin be mined?', back: 'Approximately 2140, when the block reward will have halved down to essentially zero.' },
        { front: 'What is Bitcoin Pizza Day?', back: 'May 22, 2010 — Laszlo Hanyecz paid 10,000 BTC for two pizzas, the first known commercial Bitcoin transaction.' },
        { front: 'What does "HODL" mean?', back: 'A misspelling of "hold" from a 2013 Bitcointalk forum post, now an acronym for "Hold On for Dear Life."' },
    ],
    'Security & Storage': [
        { front: 'What does "Not your keys, not your coins" mean?', back: 'If you don\'t control your private keys, you don\'t truly own your Bitcoin. Exchanges can freeze, hack, or lose your funds.' },
        { front: 'What is a seed phrase?', back: 'A 12 or 24 word backup that can restore your entire Bitcoin wallet. It must be kept offline and secure.' },
        { front: 'What is a hardware wallet?', back: 'A physical device that stores your private keys offline, protecting them from hackers and malware.' },
        { front: 'What is a hot wallet?', back: 'A wallet connected to the internet, convenient for spending but less secure than cold storage.' },
        { front: 'What is cold storage?', back: 'Keeping your Bitcoin private keys completely offline — on a hardware wallet, paper, or metal backup.' },
        { front: 'What is multi-signature (multisig)?', back: 'A security setup requiring multiple private keys to authorize a transaction, like needing 2-of-3 keys to spend.' },
        { front: 'What is a UTXO?', back: 'Unspent Transaction Output — the fundamental unit of Bitcoin ownership. Your balance is the sum of your UTXOs.' },
        { front: 'What is a public key vs private key?', back: 'Public key is your address (sharable). Private key is the secret that lets you spend your Bitcoin (never share it).' },
        { front: 'Why shouldn\'t you keep Bitcoin on exchanges?', back: 'Exchanges can be hacked (Mt. Gox, FTX), freeze your account, or go bankrupt. Self-custody eliminates counterparty risk.' },
        { front: 'What is a passphrase (25th word)?', back: 'An optional extra password added to your seed phrase for additional security, creating a hidden wallet.' },
    ],
    'Lightning Network': [
        { front: 'What is the Lightning Network?', back: 'A Layer 2 payment protocol built on top of Bitcoin that enables instant, low-cost transactions.' },
        { front: 'What is a payment channel?', back: 'A two-party connection on Lightning that allows unlimited transactions between participants off-chain.' },
        { front: 'Why is Lightning important?', back: 'It solves Bitcoin\'s scalability limitation, enabling millions of transactions per second at near-zero fees.' },
        { front: 'What is a Lightning invoice?', back: 'A payment request containing the amount, destination, and expiration time, usually encoded as a QR code.' },
        { front: 'What is routing on Lightning?', back: 'Finding a path of payment channels between sender and receiver, with each hop forwarding the payment.' },
        { front: 'What are sats?', back: 'Satoshis — the smallest unit of Bitcoin (0.00000001 BTC). Lightning commonly uses sats for transactions.' },
        { front: 'What is LNURL?', back: 'A protocol that simplifies Lightning payments with reusable payment links, QR codes, and Lightning Addresses.' },
        { front: 'What is a Lightning Address?', back: 'An email-like address (name@domain.com) that makes receiving Lightning payments as easy as email.' },
        { front: 'What is channel capacity?', back: 'The total amount of Bitcoin locked in a Lightning payment channel, limiting how much can be transacted.' },
        { front: 'What is inbound liquidity?', back: 'The capacity to receive payments on Lightning. New nodes need inbound liquidity from channel partners.' },
    ],
    'Mining & Energy': [
        { front: 'What is Bitcoin mining?', back: 'The process of using computational power to validate transactions and add new blocks to the blockchain, earning BTC rewards.' },
        { front: 'What is the difficulty adjustment?', back: 'Every 2,016 blocks (~2 weeks), the mining difficulty adjusts to maintain ~10 minute block times regardless of hash rate changes.' },
        { front: 'What is hash rate?', back: 'The total computational power being used to mine and secure the Bitcoin network, measured in hashes per second.' },
        { front: 'What is an ASIC?', back: 'Application-Specific Integrated Circuit — specialized hardware designed specifically for Bitcoin mining (SHA-256).' },
        { front: 'What is a mining pool?', back: 'A group of miners who combine their hash power and share block rewards proportionally to reduce variance.' },
        { front: 'Is Bitcoin mining bad for the environment?', back: 'Bitcoin mining increasingly uses renewable and stranded energy. It incentivizes energy innovation and can stabilize power grids.' },
        { front: 'What is the current block reward?', back: '3.125 BTC per block (after the April 2024 halving). It halves approximately every 4 years.' },
        { front: 'What is SHA-256?', back: 'The cryptographic hash function used in Bitcoin mining. Miners must find a hash below a target difficulty.' },
        { front: 'What is stranded energy?', back: 'Energy produced in remote locations with no market — Bitcoin mining can monetize this otherwise wasted energy.' },
        { front: 'What happens when all Bitcoin is mined?', back: 'Miners will earn only transaction fees. By ~2140, fees should sustain the network as Bitcoin adoption grows.' },
    ],
    'Economics & Money': [
        { front: 'What is fiat currency?', back: 'Government-issued money not backed by a commodity. Its value comes from government decree and public trust.' },
        { front: 'What is inflation?', back: 'The increase in money supply that decreases purchasing power over time. The US dollar has lost 96%+ of its value since 1913.' },
        { front: 'What is the Cantillon Effect?', back: 'Those closest to newly created money benefit most, while everyone else suffers from the resulting inflation.' },
        { front: 'What is sound money?', back: 'Money that is scarce, durable, divisible, portable, and resistant to debasement — qualities Bitcoin possesses.' },
        { front: 'What is time preference?', back: 'Sound money (like Bitcoin) encourages low time preference — prioritizing long-term saving over short-term consumption.' },
        { front: 'What is the stock-to-flow ratio?', back: 'The ratio of existing supply to new annual production. Bitcoin\'s S2F increases with each halving, making it increasingly scarce.' },
        { front: 'Why is a 21 million cap important?', back: 'It creates absolute scarcity — unlike gold or fiat, no one can create more Bitcoin, making it a perfect store of value.' },
        { front: 'What is a store of value?', back: 'An asset that maintains purchasing power over time. Bitcoin\'s fixed supply and decentralization make it a superior store of value.' },
        { front: 'What is the network effect?', back: 'The more people use Bitcoin, the more valuable and useful it becomes — creating a positive feedback loop.' },
        { front: 'What is hyperbitcoinization?', back: 'The theoretical tipping point where Bitcoin becomes the dominant global monetary system, replacing fiat currencies.' },
    ],
};

let flashcardIdx = 0;
let flashcardFlipped = false;
let currentFlashcards = [];

function startFlashcards(topic) {
    currentFlashcards = FLASHCARD_TOPICS[topic];
    if (!currentFlashcards) return;
    flashcardIdx = 0;
    flashcardFlipped = false;

    // Shuffle
    for (let i = currentFlashcards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentFlashcards[i], currentFlashcards[j]] = [currentFlashcards[j], currentFlashcards[i]];
    }

    const modal = document.getElementById('questModal');
    const inner = document.getElementById('questInner');
    renderFlashcard(inner);
    modal.classList.add('open');
}

function renderFlashcard(inner) {
    if (!inner) inner = document.getElementById('questInner');
    const card = currentFlashcards[flashcardIdx];
    const total = currentFlashcards.length;

    inner.innerHTML = '<div style="text-align:center;padding:20px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
        '<button onclick="closeQuest()" style="background:none;border:none;color:var(--text-muted);font-size:1.2rem;cursor:pointer;">✕</button>' +
        '<div style="color:var(--text-faint);font-size:0.85rem;">' + (flashcardIdx + 1) + ' / ' + total + '</div>' +
        '<div style="width:30px;"></div></div>' +
        '<div onclick="flipFlashcard()" style="min-height:200px;padding:30px;background:var(--card-bg);border:2px solid ' + (flashcardFlipped ? '#22c55e' : 'var(--accent)') + ';border-radius:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:0.3s;margin-bottom:20px;">' +
        '<div style="color:var(--' + (flashcardFlipped ? 'text' : 'heading') + ');font-size:' + (flashcardFlipped ? '1rem' : '1.15rem') + ';line-height:1.6;font-weight:' + (flashcardFlipped ? '400' : '600') + ';">' +
        (flashcardFlipped ? card.back : card.front) +
        '</div></div>' +
        '<div style="color:var(--text-faint);font-size:0.8rem;margin-bottom:16px;">' + (flashcardFlipped ? '✅ Answer' : 'Tap card to reveal answer') + '</div>' +
        '<div style="display:flex;gap:10px;justify-content:center;">' +
        (flashcardIdx > 0 ? '<button onclick="prevFlashcard()" style="padding:10px 20px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;cursor:pointer;font-family:inherit;">← Prev</button>' : '') +
        (flashcardIdx < total - 1 ? '<button onclick="nextFlashcard()" style="padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;">Next →</button>' :
        '<button onclick="closeQuest()" style="padding:10px 20px;background:#22c55e;color:#fff;border:none;border-radius:10px;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;">Done! 🎉</button>') +
        '</div></div>';
}

function flipFlashcard() {
    flashcardFlipped = !flashcardFlipped;
    renderFlashcard();
}

function nextFlashcard() {
    if (flashcardIdx < currentFlashcards.length - 1) {
        flashcardIdx++;
        flashcardFlipped = false;
        renderFlashcard();
    }
}

function prevFlashcard() {
    if (flashcardIdx > 0) {
        flashcardIdx--;
        flashcardFlipped = false;
        renderFlashcard();
    }
}

// Init features on load
document.addEventListener('DOMContentLoaded', function() {
    renderQuoteOfTheDay();
    renderExplorationMap();
    setTimeout(checkHiddenBadges, 3000);
});
