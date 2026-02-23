// =============================================
// Bitcoin Education Archive - Quest System
// =============================================

const QUESTS = [
    {
        id: 'quest_fundamentals',
        title: '₿ Bitcoin Fundamentals',
        triggerMinutes: 3,
        questions: [
            { q: 'What is the maximum supply of Bitcoin?', options: ['100 million', '21 million', '1 billion', 'Unlimited'], answer: 1 },
            { q: 'Who created Bitcoin?', options: ['Vitalik Buterin', 'Elon Musk', 'Satoshi Nakamoto', 'Hal Finney'], answer: 2 },
            { q: 'When was the Bitcoin Whitepaper published?', options: ['2006', '2008', '2010', '2012'], answer: 1 },
            { q: 'What is the smallest unit of Bitcoin called?', options: ['Wei', 'Bit', 'Satoshi', 'Gwei'], answer: 2 },
            { q: 'How often does the Bitcoin block reward get cut in half?', options: ['Every year', 'Every 2 years', 'Every 4 years', 'Every 10 years'], answer: 2 },
        ]
    },
    {
        id: 'quest_lightning',
        title: '⚡ Lightning Network',
        triggerMinutes: 8,
        questions: [
            { q: 'What layer is the Lightning Network?', options: ['Layer 1', 'Layer 2', 'Layer 3', 'Layer 0'], answer: 1 },
            { q: 'What type of routing does Lightning use for privacy?', options: ['Direct routing', 'Onion routing', 'Flood routing', 'GPS routing'], answer: 1 },
            { q: 'What do you need to receive payments on Lightning?', options: ['A mining rig', 'Inbound liquidity', 'An Ethereum wallet', 'Government ID'], answer: 1 },
            { q: 'Lightning payments are best compared to:', options: ['Wire transfers', 'Opening a bar tab', 'Writing a check', 'Mailing cash'], answer: 1 },
            { q: 'What happens when you "close" a Lightning channel?', options: ['Bitcoin is destroyed', 'Final balance settles on-chain', 'Nothing happens', 'You lose your Bitcoin'], answer: 1 },
        ]
    },
    {
        id: 'quest_security',
        title: '🔒 Security & Self-Custody',
        triggerMinutes: 14,
        questions: [
            { q: '"Not your keys, not your ___"', options: ['Wallet', 'Bitcoin', 'Password', 'Node'], answer: 1 },
            { q: 'What is a seed phrase typically made of?', options: ['Random numbers', '12 or 24 words', 'A QR code', 'Your email and password'], answer: 1 },
            { q: 'What does "self-custody" mean?', options: ['Letting an exchange hold your BTC', 'Storing BTC in a bank', 'Holding your own private keys', 'Using a VPN'], answer: 2 },
            { q: 'What type of wallet is considered most secure for long-term storage?', options: ['Exchange wallet', 'Phone wallet', 'Hardware wallet', 'Browser extension'], answer: 2 },
            { q: 'How many possible Bitcoin private keys exist?', options: ['About a million', '2^160', 'A few billion', '21 million'], answer: 1 },
        ]
    },
    {
        id: 'quest_economics',
        title: '💰 Bitcoin Economics',
        triggerMinutes: 20,
        questions: [
            { q: 'What is the Cantillon Effect?', options: ['Bitcoin mining difficulty', 'Those closest to money printing benefit most', 'The halving cycle', 'Lightning fees'], answer: 1 },
            { q: 'What does "deflationary" mean in Bitcoin context?', options: ['Price always goes up', 'Supply decreases over time', 'Mining gets cheaper', 'Fiat loses value'], answer: 1 },
            { q: 'Which country first adopted Bitcoin as legal tender?', options: ['Panama', 'El Salvador', 'Central African Republic', 'Switzerland'], answer: 1 },
            { q: 'What does HODL mean?', options: ['Hold On for Dear Life', 'A typo that became philosophy', 'A mining algorithm', 'A type of wallet'], answer: 1 },
            { q: 'The ∞/21M meme means:', options: ['Bitcoin is infinite', 'All wealth funneling into 21M coins', 'There are infinite blockchains', '21 million users max'], answer: 1 },
        ]
    },
    {
        id: 'quest_technical',
        title: '⛓ Technical Deep Dive',
        triggerMinutes: 28,
        questions: [
            { q: 'What problem did Bitcoin solve?', options: ['Email spam', 'Byzantine Generals Problem', 'Internet speed', 'Cloud storage'], answer: 1 },
            { q: 'What is a UTXO?', options: ['A type of altcoin', 'Unspent Transaction Output', 'A mining pool', 'A wallet brand'], answer: 1 },
            { q: 'What is "dust" in Bitcoin?', options: ['Deleted Bitcoin', 'Amount too small to spend profitably', 'A type of attack', 'Mining waste'], answer: 1 },
            { q: 'What does RBF stand for?', options: ['Really Big Fee', 'Replace-By-Fee', 'Rapid Block Finality', 'Return Bitcoin Fast'], answer: 1 },
            { q: 'What is Proof of Work?', options: ['Showing your resume', 'Computational work to secure the network', 'Staking coins', 'A type of smart contract'], answer: 1 },
        ]
    },
    {
        id: 'quest_culture',
        title: '🟠 Bitcoin Culture',
        triggerMinutes: 35,
        questions: [
            { q: 'What does "HFSP" stand for?', options: ['Hold For Satoshi Protocol', 'Have Fun Staying Poor', 'Hash Function Security Protocol', 'High Fee Settlement Process'], answer: 1 },
            { q: 'What does "orange-pilling" someone mean?', options: ['Giving them vitamins', 'Teaching them about Bitcoin', 'Selling them altcoins', 'Hacking their wallet'], answer: 1 },
            { q: 'What is a "Bitcoin Maxi"?', options: ['A mining rig', 'Someone who only believes in Bitcoin', 'A large transaction', 'A whale'], answer: 1 },
            { q: '"Fix the money, fix the ___"', options: ['Internet', 'World', 'Banks', 'Code'], answer: 1 },
            { q: 'What was the significance of the Genesis Block message?', options: ['It had no message', 'A newspaper headline about bank bailouts', 'Satoshi\'s email address', 'A countdown timer'], answer: 1 },
        ]
    },
    {
        id: 'quest_privacy',
        title: '🤫 Privacy & Sovereignty',
        triggerMinutes: 42,
        questions: [
            { q: 'What does KYC stand for?', options: ['Keep Your Coins', 'Know Your Customer', 'Keys You Control', 'Knowledge Yields Crypto'], answer: 1 },
            { q: 'Why do Bitcoiners run their own node?', options: ['To mine Bitcoin', 'To verify transactions independently', 'To increase internet speed', 'It\'s required by law'], answer: 1 },
            { q: 'What is CoinJoin?', options: ['Merging two blockchains', 'A technique to mix transactions for privacy', 'A type of wallet', 'Joining a mining pool'], answer: 1 },
            { q: 'What does "sovereign individual" mean in Bitcoin context?', options: ['A king who owns Bitcoin', 'Full control over your finances and data', 'The richest Bitcoin holder', 'A government official'], answer: 1 },
            { q: 'Fedimint/eCash helps with:', options: ['Mining efficiency', 'Community custody with privacy', 'Faster block times', 'Creating altcoins'], answer: 1 },
        ]
    },
];

// Quest state
let questTimerStart = Date.now();
let completedQuests = new Set();
let questShownThisSession = new Set();
let questCheckInterval = null;
let currentQuest = null;
let isRetry = false;

function initQuests() {
    // Load completed quests from Firebase
    if (typeof auth !== 'undefined' && auth.currentUser) {
        loadCompletedQuests(auth.currentUser.uid);
    } else {
        // Wait for auth
        setTimeout(initQuests, 2000);
        return;
    }

    // Check every 30 seconds if a quest should trigger
    questCheckInterval = setInterval(checkQuestTrigger, 30000);
}

async function loadCompletedQuests(uid) {
    if (!db) return;
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists && doc.data().completedQuests) {
            doc.data().completedQuests.forEach(q => completedQuests.add(q));
        }
    } catch(e) {}
}

function checkQuestTrigger() {
    if (document.hidden) return; // Don't trigger if tab isn't focused
    if (currentQuest) return; // Don't trigger if quest is active

    const minutesElapsed = (Date.now() - questTimerStart) / 60000;

    for (const quest of QUESTS) {
        if (completedQuests.has(quest.id)) continue;
        if (questShownThisSession.has(quest.id)) continue;
        if (minutesElapsed >= quest.triggerMinutes) {
            showQuest(quest, false);
            return;
        }
    }
}

function showQuest(quest, retry) {
    currentQuest = quest;
    isRetry = retry;
    questShownThisSession.add(quest.id);

    const modal = document.getElementById('questModal');
    const inner = document.getElementById('questInner');

    // Shuffle questions for variety
    const shuffled = quest.questions.map((q, i) => ({...q, origIdx: i}));

    let html = '<div class="quest-header">';
    html += '<div class="quest-badge">⚡ QUEST</div>';
    html += '<h2>' + quest.title + '</h2>';
    html += '<p>' + (retry ? 'Retry! Get 3+ correct for 25 pts!' : 'Answer 5 questions. 3+ correct = 50 pts. All 5 = 100 pts!') + '</p>';
    html += '</div>';
    html += '<div class="quest-questions">';

    shuffled.forEach((q, i) => {
        html += '<div class="quest-q">';
        html += '<div class="quest-q-num">' + (i + 1) + '/5</div>';
        html += '<div class="quest-q-text">' + q.q + '</div>';
        html += '<div class="quest-options">';
        q.options.forEach((opt, j) => {
            html += '<button class="quest-opt" data-q="' + i + '" data-a="' + j + '" onclick="selectAnswer(this,' + i + ',' + j + ')">' + opt + '</button>';
        });
        html += '</div></div>';
    });

    html += '</div>';
    html += '<button class="quest-submit" id="questSubmitBtn" onclick="submitQuest()" disabled>Submit Answers</button>';
    html += '<button class="quest-skip" onclick="skipQuest()">Skip for now</button>';

    inner.innerHTML = html;
    modal.classList.add('open');

    // Store answers and correct answers
    window._questAnswers = new Array(5).fill(-1);
    window._questCorrect = shuffled.map(q => q.answer);
}

function selectAnswer(btn, qIdx, aIdx) {
    // Deselect siblings
    const siblings = btn.parentElement.querySelectorAll('.quest-opt');
    siblings.forEach(s => s.classList.remove('selected'));
    btn.classList.add('selected');

    window._questAnswers[qIdx] = aIdx;

    // Enable submit if all answered
    if (window._questAnswers.every(a => a >= 0)) {
        document.getElementById('questSubmitBtn').disabled = false;
    }
}

async function submitQuest() {
    const answers = window._questAnswers;
    const correct = window._questCorrect;
    let score = 0;

    answers.forEach((a, i) => {
        if (a === correct[i]) score++;
    });

    // Show results
    const questions = document.querySelectorAll('.quest-q');
    questions.forEach((q, i) => {
        const opts = q.querySelectorAll('.quest-opt');
        opts.forEach((opt, j) => {
            opt.disabled = true;
            if (j === correct[i]) opt.classList.add('correct');
            if (j === answers[i] && j !== correct[i]) opt.classList.add('wrong');
        });
    });

    // Calculate points
    let pts = 0;
    let msg = '';
    if (isRetry) {
        if (score >= 3) {
            pts = 25;
            msg = '🎉 ' + score + '/5 correct on retry! +25 pts!';
            completedQuests.add(currentQuest.id);
        } else {
            msg = '😅 ' + score + '/5 — Better luck next time!';
        }
    } else {
        if (score === 5) {
            pts = 100;
            msg = '🏆 PERFECT! 5/5! +100 pts!';
            completedQuests.add(currentQuest.id);
        } else if (score >= 3) {
            pts = 50;
            msg = '🎉 ' + score + '/5 correct! +50 pts!';
            completedQuests.add(currentQuest.id);
        } else {
            msg = '😅 ' + score + '/5 — You can retry for 25 pts!';
        }
    }

    // Update Firebase
    if (pts > 0 && typeof awardPoints === 'function') {
        await awardPoints(pts, 'Quest: ' + currentQuest.title);
    }
    if (completedQuests.has(currentQuest.id) && typeof db !== 'undefined' && auth.currentUser) {
        await db.collection('users').doc(auth.currentUser.uid).update({
            completedQuests: firebase.firestore.FieldValue.arrayUnion(currentQuest.id)
        });
    }

    // Show result
    const submitBtn = document.getElementById('questSubmitBtn');
    submitBtn.style.display = 'none';
    document.querySelector('.quest-skip').style.display = 'none';

    const resultDiv = document.createElement('div');
    resultDiv.className = 'quest-result';
    resultDiv.innerHTML = '<div class="quest-result-msg">' + msg + '</div>';

    if (score < 3 && !isRetry) {
        resultDiv.innerHTML += '<button class="quest-retry" onclick="retryQuest()">🔄 Retry Quest</button>';
    }
    resultDiv.innerHTML += '<button class="quest-done" onclick="closeQuest()">Continue Learning →</button>';

    document.getElementById('questInner').appendChild(resultDiv);
}

function retryQuest() {
    showQuest(currentQuest, true);
}

function skipQuest() {
    closeQuest();
}

function closeQuest() {
    document.getElementById('questModal').classList.remove('open');
    currentQuest = null;
    isRetry = false;
}

// Start quest system after page loads
setTimeout(initQuests, 3000);
