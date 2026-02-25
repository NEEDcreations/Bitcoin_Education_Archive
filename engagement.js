// =============================================
// 🎮 Engagement Features
// Spin wheel, price prediction, color picker,
// Nacho mood, nickname, weekly leaderboard,
// sticker collection, channel badges, XP multiplier
// =============================================

(function() {

// ---- #1: Color Picker for Closet Items ----
window.showColorPicker = function(itemId) {
    var colors = [
        { name: 'Orange', hue: '0deg', color: '#f7931a' },
        { name: 'Red', hue: '-30deg', color: '#ef4444' },
        { name: 'Blue', hue: '200deg', color: '#3b82f6' },
        { name: 'Green', hue: '120deg', color: '#22c55e' },
        { name: 'Purple', hue: '260deg', color: '#8b5cf6' },
        { name: 'Pink', hue: '310deg', color: '#ec4899' },
        { name: 'Gold', hue: '30deg', color: '#eab308' },
        { name: 'Cyan', hue: '170deg', color: '#06b6d4' },
    ];
    var saved = localStorage.getItem('btc_nacho_color_' + itemId) || '0deg';
    var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)this.remove()">' +
        '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:16px;padding:20px;max-width:300px;width:100%;text-align:center;">' +
        '<div style="font-size:1.2rem;margin-bottom:8px;">🎨 Choose Color</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:16px;">';
    for (var i = 0; i < colors.length; i++) {
        var active = saved === colors[i].hue;
        html += '<button onclick="setItemColor(\'' + itemId + '\',\'' + colors[i].hue + '\')" style="width:40px;height:40px;border-radius:50%;background:' + colors[i].color + ';border:' + (active ? '3px solid #fff' : '2px solid var(--border)') + ';cursor:pointer;touch-action:manipulation;" title="' + colors[i].name + '"></button>';
    }
    html += '</div><button onclick="this.closest(\'[style]\').remove()" style="padding:8px 20px;background:var(--accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600;">Done</button></div></div>';
    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
};

window.setItemColor = function(itemId, hue) {
    localStorage.setItem('btc_nacho_color_' + itemId, hue);
    if (typeof renderNachoOverlay === 'function') renderNachoOverlay();
    if (typeof showToast === 'function') showToast('🎨 Color updated!');
    // Close picker
    var picker = document.querySelector('[onclick*="showColorPicker"]');
    if (picker) picker.closest('[style*="position:fixed"]');
};

// ---- #3: Nacho Mood Based on BTC Price ----
window.getNachoMood = function() {
    var mood = localStorage.getItem('btc_nacho_mood') || 'happy';
    return mood;
};

window.updateNachoMood = function() {
    fetch('https://mempool.space/api/v1/prices').then(function(r) { return r.json(); }).then(function(data) {
        if (!data || !data.USD) return;
        var price = data.USD;
        var lastPrice = parseInt(localStorage.getItem('btc_last_price') || '0');
        var mood = 'happy';
        if (lastPrice > 0) {
            var change = ((price - lastPrice) / lastPrice) * 100;
            if (change > 5) mood = 'moon'; // Big green
            else if (change > 0) mood = 'happy';
            else if (change > -3) mood = 'meh';
            else mood = 'dramatic'; // Big red
        }
        localStorage.setItem('btc_last_price', price.toString());
        localStorage.setItem('btc_nacho_mood', mood);
        // Update mood display if in Nacho Mode
        var moodEl = document.getElementById('nachoMoodIndicator');
        if (moodEl) {
            var moods = { moon: '🚀 Moon vibes!', happy: '😊 Feeling good!', meh: '😐 Meh...', dramatic: '😱 Drama!' };
            moodEl.textContent = moods[mood] || '';
        }
    }).catch(function() {});
};

// ---- #4: Name Your Nacho ----
window.nachoNickname = function() { return localStorage.getItem('btc_nacho_nickname') || 'Nacho'; };
window.setNachoNickname = function(name) {
    name = (name || '').trim().substring(0, 20);
    if (!name) name = 'Nacho';
    localStorage.setItem('btc_nacho_nickname', name);
    if (typeof showToast === 'function') showToast('🦌 I\'m now ' + name + '! Love it!');
};

// ---- #5: Weekly Leaderboard ----
window.loadWeeklyLeaderboard = async function() {
    if (typeof db === 'undefined') return [];
    try {
        var weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        var weekKey = weekStart.toISOString().split('T')[0];

        var snap = await db.collection('weekly_points').where('week', '==', weekKey).orderBy('points', 'desc').limit(20).get();
        var users = [];
        snap.forEach(function(doc) { users.push({ id: doc.id, ...doc.data() }); });
        return users;
    } catch(e) { return []; }
};

// ---- #8: XP Multiplier Events ----
window.getXPMultiplier = function() {
    var event = localStorage.getItem('btc_xp_event');
    if (!event) return 1;
    try {
        var e = JSON.parse(event);
        if (e.expires && Date.now() > e.expires) { localStorage.removeItem('btc_xp_event'); return 1; }
        return e.multiplier || 1;
    } catch(x) { return 1; }
};

// ---- #10: Spin the Wheel ----
var SPIN_PRIZES = [
    { label: '+5 pts', emoji: '⭐', action: function() { if (typeof awardPoints === 'function') awardPoints(5, '🎡 Spin reward!'); } },
    { label: '+10 pts', emoji: '🌟', action: function() { if (typeof awardPoints === 'function') awardPoints(10, '🎡 Lucky spin!'); } },
    { label: '+25 pts', emoji: '💫', action: function() { if (typeof awardPoints === 'function') awardPoints(25, '🎡 Big win!'); } },
    { label: '+50 pts', emoji: '🎆', action: function() { if (typeof awardPoints === 'function') awardPoints(50, '🎡 JACKPOT!'); } },
    { label: '🎟️ Ticket', emoji: '🎟️', action: function() { if (typeof showToast === 'function') showToast('🎟️ +1 Orange Ticket!'); } },
    { label: 'Fun Fact', emoji: '🧠', action: function() { if (typeof showToast === 'function') showToast('🧠 ' + (typeof getDailyFact === 'function' ? getDailyFact() : 'Bitcoin is freedom!')); } },
    { label: 'Nacho Quote', emoji: '🦌', action: function() { if (typeof speakEasterEgg === 'function') speakEasterEgg('Stay humble. Stack sats.'); } },
    { label: '+15 pts', emoji: '✨', action: function() { if (typeof awardPoints === 'function') awardPoints(15, '🎡 Nice spin!'); } },
];

window.canSpin = function() {
    var lastSpin = localStorage.getItem('btc_last_spin') || '';
    var today = new Date().toISOString().split('T')[0];
    return lastSpin !== today;
};

window.showSpinWheel = function() {
    if (!canSpin()) {
        if (typeof showToast === 'function') showToast('🎡 Already spun today! Come back tomorrow.');
        return;
    }
    var html = '<div id="spinOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)this.remove()">' +
        '<div style="background:var(--bg-side);border:2px solid var(--accent);border-radius:20px;padding:24px;max-width:320px;width:100%;text-align:center;">' +
        '<div style="font-size:1.5rem;font-weight:800;color:var(--accent);margin-bottom:4px;">🎡 Daily Spin</div>' +
        '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:16px;">Tap to spin and win a reward!</div>' +
        '<div id="spinWheelDisplay" style="font-size:4rem;margin:20px 0;height:80px;line-height:80px;transition:0.1s;">🎡</div>' +
        '<button id="spinBtn" onclick="doSpin()" style="padding:14px 32px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:1.1rem;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;">SPIN!</button>' +
        '</div></div>';
    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
};

window.doSpin = function() {
    var btn = document.getElementById('spinBtn');
    var display = document.getElementById('spinWheelDisplay');
    if (!btn || !display) return;
    btn.disabled = true;
    btn.textContent = 'Spinning...';

    // Animate through emojis
    var spins = 0;
    var total = 20 + Math.floor(Math.random() * 10);
    var prizeIdx = Math.floor(Math.random() * SPIN_PRIZES.length);
    // Weight toward smaller prizes
    var weights = [25, 20, 10, 3, 8, 12, 12, 10]; // matches SPIN_PRIZES order
    var weightTotal = weights.reduce(function(a, b) { return a + b; }, 0);
    var r = Math.random() * weightTotal;
    var cumulative = 0;
    for (var w = 0; w < weights.length; w++) {
        cumulative += weights[w];
        if (r <= cumulative) { prizeIdx = w; break; }
    }

    var timer = setInterval(function() {
        spins++;
        var idx = spins % SPIN_PRIZES.length;
        display.textContent = SPIN_PRIZES[idx].emoji;
        display.style.transform = 'scale(' + (1 + Math.random() * 0.3) + ')';
        if (spins >= total) {
            clearInterval(timer);
            display.textContent = SPIN_PRIZES[prizeIdx].emoji;
            display.style.transform = 'scale(1.3)';
            setTimeout(function() {
                display.innerHTML = '<div style="font-size:4rem;">' + SPIN_PRIZES[prizeIdx].emoji + '</div><div style="font-size:1.2rem;font-weight:700;color:var(--accent);margin-top:8px;">' + SPIN_PRIZES[prizeIdx].label + '</div>';
                display.style.transform = 'scale(1)';
                SPIN_PRIZES[prizeIdx].action();
                localStorage.setItem('btc_last_spin', new Date().toISOString().split('T')[0]);
                btn.textContent = '🎉 Claimed!';
                btn.style.background = '#22c55e';
                if (typeof haptic === 'function') haptic('success');
                setTimeout(function() {
                    var overlay = document.getElementById('spinOverlay');
                    if (overlay) overlay.remove();
                }, 2500);
            }, 500);
        }
    }, 80 + spins * 8);
};

// ---- #11: Bitcoin Price Prediction Game ----
window.showPricePrediction = function() {
    var existing = localStorage.getItem('btc_prediction');
    if (existing) {
        try {
            var p = JSON.parse(existing);
            if (p.checkAfter && Date.now() < p.checkAfter) {
                // Hasn't been 24h yet
                var hoursLeft = Math.ceil((p.checkAfter - Date.now()) / 3600000);
                if (typeof showToast === 'function') showToast('⏰ Check back in ~' + hoursLeft + ' hours for your prediction result!');
                return;
            }
            // Time to check!
            checkPrediction(p);
            return;
        } catch(e) { localStorage.removeItem('btc_prediction'); }
    }

    // Get current price
    fetch('https://mempool.space/api/v1/prices').then(function(r) { return r.json(); }).then(function(data) {
        if (!data || !data.USD) return;
        var price = data.USD;
        var html = '<div id="predictionOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)this.remove()">' +
            '<div style="background:var(--bg-side);border:2px solid var(--accent);border-radius:20px;padding:24px;max-width:340px;width:100%;text-align:center;">' +
            '<div style="font-size:1.3rem;font-weight:800;color:var(--accent);margin-bottom:4px;">📈 Price Prediction</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:12px;">Will BTC be higher or lower in 24 hours?</div>' +
            '<div style="font-size:2rem;font-weight:900;color:var(--heading);margin-bottom:16px;">₿ $' + parseInt(price).toLocaleString() + '</div>' +
            '<div style="display:flex;gap:12px;justify-content:center;">' +
                '<button onclick="makePrediction(\'higher\',' + price + ')" style="flex:1;padding:14px;background:#22c55e;color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;">📈 Higher</button>' +
                '<button onclick="makePrediction(\'lower\',' + price + ')" style="flex:1;padding:14px;background:#ef4444;color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;">📉 Lower</button>' +
            '</div></div></div>';
        var div = document.createElement('div');
        div.innerHTML = html;
        document.body.appendChild(div.firstChild);
    });
};

window.makePrediction = function(direction, price) {
    localStorage.setItem('btc_prediction', JSON.stringify({
        direction: direction,
        price: price,
        timestamp: Date.now(),
        checkAfter: Date.now() + 86400000 // 24 hours
    }));
    var overlay = document.getElementById('predictionOverlay');
    if (overlay) overlay.remove();
    if (typeof showToast === 'function') showToast('📈 Prediction locked! Check back in 24 hours.');
};

function checkPrediction(p) {
    fetch('https://mempool.space/api/v1/prices').then(function(r) { return r.json(); }).then(function(data) {
        if (!data || !data.USD) return;
        var newPrice = data.USD;
        var wentUp = newPrice > p.price;
        var correct = (p.direction === 'higher' && wentUp) || (p.direction === 'lower' && !wentUp);

        localStorage.removeItem('btc_prediction');

        if (correct) {
            if (typeof awardPoints === 'function') awardPoints(25, '📈 Prediction correct!');
            if (typeof showToast === 'function') showToast('🎯 You predicted correctly! BTC went ' + (wentUp ? 'UP' : 'DOWN') + '! +25 pts');
        } else {
            if (typeof showToast === 'function') showToast('📉 Not this time! BTC went ' + (wentUp ? 'up' : 'down') + '. Try again!');
        }
        if (typeof haptic === 'function') haptic(correct ? 'success' : 'error');
    });
}

// ---- #12: Reading Streaks / Channel Completion ----
window.getChannelProgress = function(channelId) {
    var data = JSON.parse(localStorage.getItem('btc_channel_progress') || '{}');
    return data[channelId] || { read: 0, total: 0 };
};

window.updateChannelProgress = function(channelId, msgCount) {
    var data = JSON.parse(localStorage.getItem('btc_channel_progress') || '{}');
    if (!data[channelId]) data[channelId] = { read: 0, total: msgCount };
    data[channelId].total = msgCount;
    var viewed = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
    if (viewed.indexOf(channelId) !== -1) data[channelId].read = msgCount;
    localStorage.setItem('btc_channel_progress', JSON.stringify(data));
};

// ---- #14: Nacho Sticker Collection ----
window.earnSticker = function(stickerId) {
    var stickers = JSON.parse(localStorage.getItem('btc_nacho_stickers') || '[]');
    if (stickers.indexOf(stickerId) !== -1) return; // Already have it
    stickers.push(stickerId);
    localStorage.setItem('btc_nacho_stickers', JSON.stringify(stickers));
    if (typeof showToast === 'function') showToast('🦌 New sticker earned: ' + stickerId + '!');
};

var NACHO_STICKERS = [
    { id: 'wave', emoji: '👋🦌', name: 'Wave', desc: 'Nacho waves hello!' },
    { id: 'brain', emoji: '🧠🦌', name: 'Big Brain', desc: 'Nacho thinking hard' },
    { id: 'fire', emoji: '🔥🦌', name: 'On Fire', desc: 'Nacho is on fire!' },
    { id: 'moon', emoji: '🚀🦌', name: 'Moon Nacho', desc: 'To the moon!' },
    { id: 'cheese', emoji: '🧀🦌', name: 'Cheese Lover', desc: 'Nacho keys, nacho cheese!' },
    { id: 'crown', emoji: '👑🦌', name: 'King Nacho', desc: 'The king of Bitcoin education' },
    { id: 'sleep', emoji: '😴🦌', name: 'Sleepy', desc: 'HODLing in his sleep' },
    { id: 'love', emoji: '❤️🦌', name: 'Love', desc: 'Nacho loves Bitcoin' },
    { id: 'cool', emoji: '😎🦌', name: 'Cool Buck', desc: 'Too cool for altcoins' },
    { id: 'diamond', emoji: '💎🦌', name: 'Diamond', desc: 'Diamond hooves, diamond hands' },
    { id: 'lightning', emoji: '⚡🦌', name: 'Lightning', desc: 'Lightning fast!' },
    { id: 'stack', emoji: '📚🦌', name: 'Stacker', desc: 'Stacking sats AND knowledge' },
];

window.renderStickerBook = function() {
    var owned = JSON.parse(localStorage.getItem('btc_nacho_stickers') || '[]');
    var html = '<div style="font-weight:700;color:var(--heading);margin-bottom:8px;">🦌 Nacho Sticker Book (' + owned.length + '/' + NACHO_STICKERS.length + ')</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
    for (var i = 0; i < NACHO_STICKERS.length; i++) {
        var s = NACHO_STICKERS[i];
        var has = owned.indexOf(s.id) !== -1;
        html += '<div style="width:60px;text-align:center;padding:8px;background:var(--card-bg);border:1px solid ' + (has ? 'var(--accent)' : 'var(--border)') + ';border-radius:10px;' + (has ? '' : 'opacity:0.3;filter:grayscale(1);') + '" title="' + s.name + (has ? '' : ' (locked)') + '">' +
            '<div style="font-size:1.5rem;">' + s.emoji + '</div>' +
            '<div style="font-size:0.6rem;color:var(--text-faint);margin-top:2px;">' + s.name + '</div></div>';
    }
    html += '</div>';
    return html;
};

// Award stickers based on actions
function checkStickerEarns() {
    var interactions = parseInt(localStorage.getItem('btc_nacho_interactions') || '0');
    if (interactions >= 1) earnSticker('wave');
    if (interactions >= 10) earnSticker('brain');
    if (interactions >= 25) earnSticker('fire');
    if (interactions >= 50) earnSticker('moon');
    if (interactions >= 100) earnSticker('crown');
    var channels = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]').length;
    if (channels >= 5) earnSticker('stack');
    if (channels >= 20) earnSticker('lightning');
    if (channels >= 50) earnSticker('diamond');
    var streak = 0;
    if (typeof currentUser !== 'undefined' && currentUser) streak = currentUser.streak || 0;
    if (streak >= 3) earnSticker('cheese');
    if (streak >= 7) earnSticker('love');
    if (streak >= 14) earnSticker('cool');
    if (streak >= 30) earnSticker('sleep');
}
setInterval(checkStickerEarns, 30000);

// ---- #15: Nacho's Story Mode ----
var NACHO_STORY = [
    { title: 'Chapter 1: A Deer is Born', text: 'In the forests of New Hampshire, a special fawn was born with orange-tinted fur. His mother named him Nacho — short for "Not your keys, nacho cheese." 🧀🦌', lesson: 'Bitcoin is unique — there\'s nothing else like it.' },
    { title: 'Chapter 2: The Broken Acorns', text: 'The forest animals used acorns as money. But the squirrels kept printing more acorns! Everything got expensive. Nacho watched his family\'s savings become worthless. 🐿️💸', lesson: 'Inflation destroys savings when money supply is unlimited.' },
    { title: 'Chapter 3: The Orange Pill', text: 'An old owl showed Nacho a glowing orange coin. "This is Bitcoin," she said. "Only 21 million will ever exist. No squirrel can print more." Nacho\'s eyes went wide. 🦉🟠', lesson: 'Bitcoin has a fixed supply of 21 million — forever.' },
    { title: 'Chapter 4: Mining the Mountain', text: 'Nacho discovered bears mining Bitcoin deep in the mountain, solving puzzles with pure energy. "This is what makes it secure," they growled. "Real work, real value." ⛏️🐻', lesson: 'Proof of work secures Bitcoin with real-world energy.' },
    { title: 'Chapter 5: Lightning Strikes', text: 'A flash of lightning split the sky. "You can send Bitcoin instantly!" shouted a rabbit, zapping sats through the air. Nacho was amazed. ⚡🐇', lesson: 'The Lightning Network makes Bitcoin fast and cheap.' },
    { title: 'Chapter 6: The Fox\'s Trap', text: 'A sly fox offered Nacho "EtherAcorns" — just like Bitcoin but "better!" Nacho remembered the owl\'s words: "There is no second best." He walked away. 🦊❌', lesson: 'Altcoins promise innovation but lack Bitcoin\'s decentralization.' },
    { title: 'Chapter 7: The Seed Phrase', text: 'Nacho carved 24 words into a stone tablet and hid it in a secret cave. "This is my Bitcoin. As long as I have these words, nobody can take it." 🔑🪨', lesson: 'Self-custody with a seed phrase means you truly own your Bitcoin.' },
    { title: 'Chapter 8: The Node', text: 'Nacho built his own node from a tiny computer. Now he could verify every transaction himself. "Don\'t trust. Verify." became his motto. 💻✅', lesson: 'Running a node lets you verify Bitcoin independently.' },
    { title: 'Chapter 9: The Halving Festival', text: 'Every four years, the forest celebrated the Halving — when mining rewards were cut in half. "Tick tock, next block!" the animals cheered. 🎉⏰', lesson: 'Halvings reduce new supply, making Bitcoin scarcer over time.' },
    { title: 'Chapter 10: Nacho\'s Mission', text: 'Nacho looked out over the forest. So many animals still didn\'t understand. "I\'ll teach them all," he said, antlers glowing orange. "Bitcoin fixes this." And so he did. 🦌🌍', lesson: 'Education is the key to Bitcoin adoption. You\'re part of this mission.' },
];

window.getNachoStoryProgress = function() {
    return parseInt(localStorage.getItem('btc_nacho_story') || '0');
};

window.showNachoStory = function() {
    var progress = getNachoStoryProgress();
    var chapter = NACHO_STORY[Math.min(progress, NACHO_STORY.length - 1)];
    var isNew = progress < NACHO_STORY.length;
    var lastRead = localStorage.getItem('btc_nacho_story_date') || '';
    var today = new Date().toISOString().split('T')[0];

    if (lastRead === today && isNew) {
        if (typeof showToast === 'function') showToast('📖 Come back tomorrow for the next chapter!');
        return;
    }

    var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)this.remove()">' +
        '<div style="background:var(--bg-side);border:2px solid var(--accent);border-radius:20px;padding:24px;max-width:400px;width:100%;text-align:center;">' +
        '<div style="font-size:0.7rem;color:var(--accent);text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">📖 Nacho\'s Story</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);margin-bottom:12px;">' + chapter.title + '</div>' +
        '<div style="color:var(--text);font-size:0.9rem;line-height:1.6;margin-bottom:16px;text-align:left;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;">' + chapter.text + '</div>' +
        '<div style="color:var(--accent);font-size:0.8rem;font-weight:600;margin-bottom:16px;text-align:left;">💡 Lesson: ' + chapter.lesson + '</div>' +
        '<div style="color:var(--text-faint);font-size:0.75rem;margin-bottom:12px;">Chapter ' + (Math.min(progress, NACHO_STORY.length - 1) + 1) + ' of ' + NACHO_STORY.length + '</div>' +
        '<button onclick="advanceNachoStory();this.closest(\'[style*=position]\').remove()" style="padding:12px 24px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">' + (isNew ? 'Continue →' : '🎉 Story Complete!') + '</button>' +
        '</div></div>';
    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
};

window.advanceNachoStory = function() {
    var progress = getNachoStoryProgress();
    if (progress < NACHO_STORY.length) {
        localStorage.setItem('btc_nacho_story', (progress + 1).toString());
        localStorage.setItem('btc_nacho_story_date', new Date().toISOString().split('T')[0]);
        if (typeof awardPoints === 'function') awardPoints(10, '📖 Story chapter read!');
    }
};

// ---- #16: Sound Effects ----
window.playEngagementSound = function(type) {
    if (localStorage.getItem('btc_audio') === 'false') return;
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var vol = parseFloat(localStorage.getItem('btc_volume') || '0.5');
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'spin') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.1 * vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);
        } else if (type === 'win') {
            osc.type = 'triangle';
            [523, 659, 784].forEach(function(freq, i) {
                var o = ctx.createOscillator();
                var g = ctx.createGain();
                o.connect(g); g.connect(ctx.destination);
                o.type = 'triangle';
                o.frequency.value = freq;
                g.gain.setValueAtTime(0.08 * vol, ctx.currentTime + i * 0.1);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.3);
                o.start(ctx.currentTime + i * 0.1);
                o.stop(ctx.currentTime + i * 0.1 + 0.3);
            });
        } else if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.value = 600;
            gain.gain.setValueAtTime(0.06 * vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.05);
        }
    } catch(e) {}
};

// ---- Auto-check prediction results on load ----
setTimeout(function() {
    var pred = localStorage.getItem('btc_prediction');
    if (pred) {
        try {
            var p = JSON.parse(pred);
            if (p.checkAfter && Date.now() >= p.checkAfter) checkPrediction(p);
        } catch(e) {}
    }
    // Update Nacho mood
    updateNachoMood();
}, 3000);

})();
