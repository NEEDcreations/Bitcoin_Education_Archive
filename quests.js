// =============================================
// Bitcoin Education Archive - Dynamic Quest System
// Questions based on channels the user has visited
// =============================================

// Question bank mapped to channel IDs
const QUESTION_BANK = {
    // Properties Layer 1
    'whitepaper': [
        { q: 'When was the Bitcoin Whitepaper published?', a: 'October 31, 2008', wrong: ['January 3, 2009', 'March 15, 2007', 'December 25, 2010'] },
        { q: 'How many pages of text is the Bitcoin Whitepaper?', a: '8 pages', wrong: ['20 pages', '50 pages', '2 pages'] },
        { q: 'The Whitepaper was published on:', a: 'A cryptography mailing list', wrong: ['Twitter', 'A Bitcoin forum', 'The New York Times'] },
    ],
    'decentralized': [
        { q: 'How many people are "in charge" of Bitcoin?', a: 'No one', wrong: ['Satoshi Nakamoto', 'A board of directors', 'The Bitcoin Foundation'] },
        { q: 'What is needed for code updates to Bitcoin?', a: 'Deep consensus from the network', wrong: ['A CEO decision', 'A government vote', 'Permission from miners only'] },
        { q: 'Bitcoin is described as:', a: 'A protocol, not a company', wrong: ['A company based in Japan', 'A government project', 'A bank product'] },
    ],
    'scarce': [
        { q: 'What is the maximum supply of Bitcoin?', a: '21 million', wrong: ['100 million', '1 billion', 'Unlimited'] },
        { q: 'How many Bitcoin are estimated to be lost forever?', a: '2-3 million', wrong: ['None', '10 million', '100,000'] },
        { q: 'Bitcoin\'s code is:', a: 'Open source and auditable by anyone', wrong: ['Private and closed', 'Only visible to developers', 'Controlled by a company'] },
    ],
    'secure': [
        { q: 'Bitcoin has been under attack since gaining significant value around:', a: '2013', wrong: ['2020', '2009', '2017'] },
        { q: 'How many potential Bitcoin wallets exist?', a: '2^160', wrong: ['21 million', 'A few billion', '2^16'] },
        { q: 'Bitcoin\'s monetary policy is:', a: 'Set in stone and immutable', wrong: ['Changed annually', 'Decided by miners', 'Flexible based on market'] },
    ],
    'money': [
        { q: 'How many satoshis are in one Bitcoin?', a: '100,000,000', wrong: ['1,000,000', '1,000', '10,000'] },
        { q: 'Bitcoin payments are compared to:', a: 'Email — anyone with your address can send', wrong: ['Fax machines', 'Phone calls', 'Physical mail'] },
        { q: 'Bitcoin\'s distribution was fair because:', a: 'There was no premine', wrong: ['A company sold coins early', 'The government distributed it', 'Only miners got coins'] },
    ],
    'peaceful': [
        { q: 'When China banned Bitcoin:', a: 'Bitcoin just moved and kept going', wrong: ['Bitcoin shut down', 'The price went to zero', 'The code was deleted'] },
        { q: 'Bitcoin is described as:', a: 'Permissionless and borderless', wrong: ['Government-regulated', 'Country-specific', 'Requiring a bank account'] },
    ],
    'dominant': [
        { q: '∞/21M means:', a: 'All world wealth funneling into 21 million coins', wrong: ['Bitcoin is infinite', 'There are infinite users', '21 million blockchains'] },
        { q: 'Bitcoin\'s growth pattern resembles:', a: 'A J-shaped curve', wrong: ['A straight line', 'A bell curve', 'A flat line'] },
        { q: 'Bitcoin is said to change you by:', a: 'Lowering your time preference', wrong: ['Making you rich instantly', 'Increasing spending', 'Nothing changes'] },
    ],
    'use-cases': [
        { q: 'Bitcoin is described as better than gold because:', a: 'It can be sent across the planet instantly', wrong: ['It\'s heavier', 'It\'s shinier', 'It\'s backed by gold'] },
        { q: 'How do Bitcoin remittance fees compare to Western Union?', a: 'Much cheaper, nearly free', wrong: ['About the same', 'More expensive', 'Double the cost'] },
        { q: 'Credit card merchants pay about what fee?', a: '3%', wrong: ['0%', '10%', '25%'] },
    ],

    // Experienced Topics
    'mining': [
        { q: 'What do miners do?', a: 'Secure the network and process transactions', wrong: ['Create Bitcoin from nothing', 'Print digital money', 'Delete old transactions'] },
        { q: 'Miners are paid in:', a: 'New Bitcoin and transaction fees', wrong: ['US dollars', 'Ethereum', 'Company stock'] },
    ],
    'nodes': [
        { q: 'Running a node lets you:', a: 'Verify transactions independently', wrong: ['Mine Bitcoin', 'Print money', 'Control the network'] },
        { q: '"Don\'t trust, verify" means:', a: 'Run your own node to check the truth', wrong: ['Trust your bank', 'Believe what others say', 'Ignore Bitcoin'] },
    ],
    'pow-vs-pos': [
        { q: 'Bitcoin uses which consensus mechanism?', a: 'Proof of Work', wrong: ['Proof of Stake', 'Proof of Authority', 'Proof of Space'] },
        { q: 'In Proof of Work, security comes from:', a: 'Computational work and electricity', wrong: ['Staking coins', 'Voting', 'Government approval'] },
    ],
    'layer-2-lightning': [
        { q: 'Lightning is which layer of Bitcoin?', a: 'Layer 2', wrong: ['Layer 1', 'Layer 3', 'Layer 0'] },
        { q: 'Lightning uses what for privacy?', a: 'Onion routing', wrong: ['GPS tracking', 'Public ledger', 'Email verification'] },
        { q: 'Opening a Lightning channel is like:', a: 'Opening a bar tab', wrong: ['Buying a car', 'Getting a loan', 'Opening a bank account'] },
    ],
    'self-custody': [
        { q: '"Not your keys, not your..."', a: 'Bitcoin', wrong: ['Wallet', 'Password', 'Account'] },
        { q: 'The most secure long-term storage is:', a: 'Hardware wallet', wrong: ['Exchange account', 'Phone app', 'Email attachment'] },
    ],
    'privacy-nonkyc': [
        { q: 'KYC stands for:', a: 'Know Your Customer', wrong: ['Keep Your Coins', 'Keys You Control', 'Knowledge Yields Crypto'] },
        { q: 'CoinJoin is used for:', a: 'Mixing transactions for privacy', wrong: ['Joining mining pools', 'Merging blockchains', 'Creating altcoins'] },
    ],
    'problems-of-money': [
        { q: 'The Cantillon Effect describes:', a: 'Those closest to money printing benefit most', wrong: ['Bitcoin mining', 'The halving', 'Lightning fees'] },
        { q: 'Fractional reserve banking means:', a: 'Banks hold only a fraction of deposits', wrong: ['Banks hold all deposits', 'Bitcoin is fractional', 'Miners keep fractions'] },
    ],
    'investment-strategy': [
        { q: 'DCA stands for:', a: 'Dollar Cost Averaging', wrong: ['Digital Currency Account', 'Decentralized Crypto Asset', 'Direct Coin Access'] },
        { q: 'A common Bitcoin investment strategy is:', a: 'Buy regularly and hold long-term', wrong: ['Day trade constantly', 'Sell every week', 'Only buy at the top'] },
    ],
    'cryptography': [
        { q: 'Bitcoin uses cryptography that has been:', a: 'Used for decades in other applications', wrong: ['Invented specifically for Bitcoin', 'Never tested before', 'Made by AI'] },
    ],
    'regulation': [
        { q: 'Bitcoin\'s response to bans has been:', a: 'Moving to friendlier jurisdictions', wrong: ['Shutting down', 'Complying immediately', 'Becoming illegal forever'] },
    ],
    'energy': [
        { q: 'Bitcoin mining and energy:', a: 'Promotes renewable energy and uses wasted energy', wrong: ['Only uses coal', 'Wastes all energy', 'Uses no energy'] },
    ],
    'core-source-code': [
        { q: 'Changes to Bitcoin Core require:', a: 'Careful testing and peer review', wrong: ['One person\'s approval', 'A company decision', 'Government permission'] },
    ],
    'blockchain-timechain': [
        { q: 'A new Bitcoin block is produced approximately every:', a: '10 minutes', wrong: ['1 second', '1 hour', '1 day'] },
    ],

    // Additional Info threads
    'analogies': [
        { q: 'In the airport analogy, Lightning is like:', a: 'A bicycle courier in the terminal', wrong: ['The runway', 'A cargo plane', 'Air traffic control'] },
    ],
    'byzantine_generals__problem': [
        { q: 'The Byzantine Generals Problem is about:', a: 'Reaching agreement when some participants may be dishonest', wrong: ['Building castles', 'Trading gold', 'Sending emails'] },
    ],
    'game_theory': [
        { q: 'Bitcoin\'s incentive structure uses:', a: 'Game theory to align participants', wrong: ['Threats of punishment', 'Legal contracts', 'Trust alone'] },
    ],
    'elevator_pitches': [
        { q: 'A good Bitcoin elevator pitch should be:', a: 'Simple and compelling in under a minute', wrong: ['A 2-hour lecture', 'Only about price', 'As technical as possible'] },
    ],
    'taproot': [
        { q: 'Taproot is a Bitcoin:', a: 'Upgrade that improves privacy and smart contracts', wrong: ['New cryptocurrency', 'Mining algorithm', 'Exchange platform'] },
    ],
    'scalability': [
        { q: 'Bitcoin base layer processes roughly:', a: '7 transactions per second', wrong: ['7 million per second', '1 per minute', '100,000 per second'] },
    ],
    'utxos': [
        { q: 'UTXO stands for:', a: 'Unspent Transaction Output', wrong: ['Universal Token Exchange Order', 'Unified Transaction eXecution Object', 'Ultra-fast Transfer of eXchange Operations'] },
    ],
    'dust': [
        { q: 'Bitcoin "dust" is:', a: 'An amount too small to spend because the fee exceeds the value', wrong: ['Deleted Bitcoin', 'A type of mining waste', 'A security attack'] },
    ],
    'rbf': [
        { q: 'RBF stands for:', a: 'Replace-By-Fee', wrong: ['Really Big Fee', 'Rapid Block Finality', 'Return Bitcoin Fast'] },
    ],
    'time_preference': [
        { q: 'Low time preference means:', a: 'Saving for the future instead of spending now', wrong: ['Spending everything today', 'Not caring about money', 'Only day trading'] },
    ],
    'soft_vs_hard_forks': [
        { q: 'A soft fork is:', a: 'Backward-compatible upgrade', wrong: ['A completely new blockchain', 'Deleting Bitcoin', 'A type of altcoin'] },
    ],
    'fedimints': [
        { q: 'Fedimint helps with:', a: 'Community custody with privacy', wrong: ['Solo mining', 'Creating altcoins', 'Government reporting'] },
    ],

    // Resources
    'books': [
        { q: 'The Bitcoin Standard is a popular book about:', a: 'Sound money and Bitcoin economics', wrong: ['Bitcoin mining hardware', 'How to day trade', 'Building websites'] },
    ],
    'misconceptions-fud': [
        { q: 'FUD stands for:', a: 'Fear, Uncertainty, and Doubt', wrong: ['Fully Unified Database', 'First User Downloaded', 'Financial Update Daily'] },
    ],
    'satoshi-nakamoto': [
        { q: 'Satoshi Nakamoto:', a: 'Stepped down and disappeared', wrong: ['Is currently the CEO of Bitcoin', 'Was arrested', 'Sold all Bitcoin'] },
    ],
    'history': [
        { q: 'The Bitcoin Genesis Block was mined in:', a: 'January 2009', wrong: ['October 2008', 'June 2010', 'December 2007'] },
    ],
};

// State
let questTimerStart = Date.now();
let completedQuests = new Set();
let questCheckInterval = null;
let currentQuest = null;
let isRetry = false;
let visitedForQuest = []; // Track channel visit order for quiz generation
let questCount = 0;

// Quest triggers: after visiting X channels
const QUEST_TRIGGERS = [5, 15, 25, 40, 60, 80, 100];

function initQuests() {
    if (typeof auth !== 'undefined' && auth.currentUser) {
        loadCompletedQuests(auth.currentUser.uid);
    } else {
        setTimeout(initQuests, 2000);
        return;
    }
}

async function loadCompletedQuests(uid) {
    if (!db) return;
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists && doc.data().completedQuests) {
            doc.data().completedQuests.forEach(q => completedQuests.add(q));
            questCount = completedQuests.size;
        }
    } catch(e) {}
}

// Called from onChannelOpen in ranking.js
function onChannelVisitForQuest(channelId) {
    if (!visitedForQuest.includes(channelId)) {
        visitedForQuest.push(channelId);
    }

    // Check if we hit a trigger threshold
    const visited = visitedForQuest.length;
    for (const trigger of QUEST_TRIGGERS) {
        if (visited === trigger && !currentQuest) {
            setTimeout(() => {
                if (typeof showToast === 'function') showToast('⚡ You\'ve explored ' + trigger + ' channels! A Quest is ready!');
                setTimeout(() => generateAndShowQuest(), 3000);
            }, 2000);
            break;
        }
    }
}

function generateAndShowQuest(manual) {
    // Collect available questions from visited channels
    let pool = [];
    for (const chId of visitedForQuest) {
        const questions = QUESTION_BANK[chId];
        if (questions) {
            questions.forEach(q => pool.push({...q, source: chId}));
        }
    }

    if (pool.length < 5) {
        // Not enough questions yet — add some from any visited channel's category
        for (const [chId, questions] of Object.entries(QUESTION_BANK)) {
            questions.forEach(q => {
                if (!pool.some(p => p.q === q.q)) {
                    pool.push({...q, source: chId});
                }
            });
            if (pool.length >= 10) break;
        }
    }

    if (pool.length < 5) return; // Still not enough

    // Shuffle and pick 5
    pool.sort(() => Math.random() - 0.5);

    // Skip questions from completed quests
    const questId = 'quest_dynamic_' + questCount;
    if (completedQuests.has(questId)) return;

    const selected = pool.slice(0, 5);

    // Build multiple choice format
    const questions = selected.map(q => {
        const options = [q.a, ...q.wrong].sort(() => Math.random() - 0.5);
        const correctIdx = options.indexOf(q.a);
        return { q: q.q, options, answer: correctIdx };
    });

    currentQuest = { id: questId, title: getQuestTitle(questCount), questions };
    showQuest(currentQuest, false);
}

function getQuestTitle(num) {
    const titles = [
        '₿ Bitcoin Basics Quest',
        '⚡ Lightning Learner Quest',
        '🔒 Security Scholar Quest',
        '💰 Economics Expert Quest',
        '⛓ Technical Titan Quest',
        '🟠 Culture Connoisseur Quest',
        '🛡️ Sovereignty Sage Quest',
        '👑 Satoshi Scholar Quest',
    ];
    return titles[num % titles.length];
}

function showQuest(quest, retry) {
    currentQuest = quest;
    isRetry = retry;

    const modal = document.getElementById('questModal');
    const inner = document.getElementById('questInner');

    let html = '<div class="quest-header">';
    html += '<div class="quest-badge">⚡ QUEST</div>';
    html += '<h2>' + quest.title + '</h2>';
    html += '<p>' + (retry ? 'Retry! Get 3+ correct for 25 pts!' : 'Answer 5 questions. 3+ correct = 50 pts. All 5 = 100 pts!') + '</p>';
    html += '</div>';
    html += '<div class="quest-questions">';

    quest.questions.forEach((q, i) => {
        html += '<div class="quest-q">';
        html += '<div class="quest-q-num">Question ' + (i + 1) + ' of 5</div>';
        html += '<div class="quest-q-text">' + q.q + '</div>';
        html += '<div class="quest-options">';
        q.options.forEach((opt, j) => {
            html += '<button class="quest-opt" onclick="selectAnswer(this,' + i + ',' + j + ')">' + opt + '</button>';
        });
        html += '</div></div>';
    });

    html += '</div>';
    html += '<button class="quest-submit" id="questSubmitBtn" onclick="submitQuest()" disabled>Submit Answers</button>';
    html += '<button class="quest-skip" onclick="skipQuest()">Skip for now</button>';

    inner.innerHTML = html;
    modal.classList.add('open');

    window._questAnswers = new Array(5).fill(-1);
    window._questCorrect = quest.questions.map(q => q.answer);
}

function selectAnswer(btn, qIdx, aIdx) {
    const siblings = btn.parentElement.querySelectorAll('.quest-opt');
    siblings.forEach(s => s.classList.remove('selected'));
    btn.classList.add('selected');
    window._questAnswers[qIdx] = aIdx;

    if (window._questAnswers.every(a => a >= 0)) {
        document.getElementById('questSubmitBtn').disabled = false;
    }
}

async function submitQuest() {
    const answers = window._questAnswers;
    const correct = window._questCorrect;
    let score = 0;

    answers.forEach((a, i) => { if (a === correct[i]) score++; });

    // Highlight correct/wrong
    const questions = document.querySelectorAll('.quest-q');
    questions.forEach((q, i) => {
        const opts = q.querySelectorAll('.quest-opt');
        opts.forEach((opt, j) => {
            opt.disabled = true;
            if (j === correct[i]) opt.classList.add('correct');
            if (j === answers[i] && j !== correct[i]) opt.classList.add('wrong');
        });
    });

    let pts = 0;
    let msg = '';
    if (isRetry) {
        if (score >= 3) {
            pts = 25;
            msg = '🎉 ' + score + '/5 correct on retry! +25 pts!';
            completedQuests.add(currentQuest.id);
            questCount++;
        } else {
            msg = '😅 ' + score + '/5 — Better luck next time! Keep reading and try again.';
        }
    } else {
        if (score === 5) {
            pts = 100;
            msg = '🏆 PERFECT! 5/5! +100 pts!';
            completedQuests.add(currentQuest.id);
            questCount++;
        } else if (score >= 3) {
            pts = 50;
            msg = '🎉 ' + score + '/5 correct! +50 pts!';
            completedQuests.add(currentQuest.id);
            questCount++;
        } else {
            msg = '😅 ' + score + '/5 — You can retry for 25 pts!';
        }
    }

    if (pts > 0 && typeof awardPoints === 'function') {
        await awardPoints(pts, 'Quest: ' + currentQuest.title);
    }
    if (completedQuests.has(currentQuest.id) && typeof db !== 'undefined' && auth.currentUser) {
        await db.collection('users').doc(auth.currentUser.uid).update({
            completedQuests: firebase.firestore.FieldValue.arrayUnion(currentQuest.id)
        });
    }

    // Hide submit and skip buttons
    const submitBtn = document.getElementById('questSubmitBtn');
    if (submitBtn) submitBtn.style.display = 'none';
    const skipBtn = document.querySelector('.quest-skip');
    if (skipBtn) skipBtn.style.display = 'none';

    // Hide the questions to make room for results
    const questionsDiv = document.querySelector('.quest-questions');
    if (questionsDiv) questionsDiv.style.display = 'none';

    // Update header with score
    const header = document.querySelector('.quest-header');
    if (header) {
        header.innerHTML = '<div class="quest-badge">⚡ QUEST COMPLETE</div>' +
            '<h2>' + currentQuest.title + '</h2>' +
            '<div style="font-size:3rem;margin:20px 0;">' + (score === 5 ? '🏆' : score >= 3 ? '🎉' : '😅') + '</div>' +
            '<div style="font-size:1.8rem;font-weight:900;color:var(--heading);margin-bottom:8px;">' + score + ' / 5 Correct</div>' +
            '<div style="font-size:1.1rem;color:var(--text-muted);margin-bottom:20px;">' + msg + '</div>' +
            (pts > 0 ? '<div style="font-size:1.3rem;font-weight:800;color:var(--accent);margin-bottom:20px;">+' + pts + ' points earned!</div>' : '') +
            (score < 3 && !isRetry ? '<button class="quest-retry" onclick="retryQuest()">🔄 Retry Quest for 25 pts</button>' : '') +
            '<button class="quest-done" onclick="closeQuest()">Continue Learning →</button>';
    }

    // Scroll modal to top
    const inner = document.getElementById('questInner');
    if (inner) inner.scrollTop = 0;
}

function retryQuest() {
    // Re-shuffle the same questions
    currentQuest.questions.forEach(q => {
        const correctAnswer = q.options[q.answer];
        q.options.sort(() => Math.random() - 0.5);
        q.answer = q.options.indexOf(correctAnswer);
    });
    showQuest(currentQuest, true);
}

function startQuestManual() {
    if (currentQuest) return; // Already showing one
    if (visitedForQuest.length < 1) {
        if (typeof showToast === 'function') showToast('Explore some channels first to unlock a Quest!');
        return;
    }
    generateAndShowQuest(true);
    if (typeof isMobile === 'function' && isMobile()) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

function skipQuest() { closeQuest(); }

function closeQuest() {
    document.getElementById('questModal').classList.remove('open');
    currentQuest = null;
    isRetry = false;
}

setTimeout(initQuests, 3000);
