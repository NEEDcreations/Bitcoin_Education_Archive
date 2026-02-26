// © 2024-2026 603BTC LLC. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
// =============================================
// 🎮 Engagement Features
// Spin wheel, price prediction, color picker,
// Nacho mood, nickname, weekly leaderboard,
// sticker collection, channel badges, XP multiplier
// =============================================

(function() {

// ---- #1: Color Picker for Closet Items ----
window.showColorPicker = function(itemId) {
    // Remove existing picker if any
    var old = document.getElementById('nachoColorPicker');
    if (old) old.remove();

    var item = typeof NACHO_ITEMS !== 'undefined' ? NACHO_ITEMS.find(function(i) { return i.id === itemId; }) : null;
    var emoji = item ? (item.hidden ? item.revealEmoji : item.emoji) : '🦌';
    var itemName = item ? (item.hidden ? item.revealName : item.name) : 'Item';

    var colors = [
        { name: 'Default', hue: '0deg', color: '#f7931a' },
        { name: 'Red', hue: '-30deg', color: '#ef4444' },
        { name: 'Blue', hue: '200deg', color: '#3b82f6' },
        { name: 'Green', hue: '120deg', color: '#22c55e' },
        { name: 'Purple', hue: '260deg', color: '#8b5cf6' },
        { name: 'Pink', hue: '310deg', color: '#ec4899' },
        { name: 'Gold', hue: '30deg', color: '#eab308' },
        { name: 'Cyan', hue: '170deg', color: '#06b6d4' },
        { name: 'White', hue: '0deg', color: '#e2e8f0', filter: 'grayscale(1) brightness(2)' },
    ];
    var saved = localStorage.getItem('btc_nacho_color_' + itemId) || '0deg';

    var html = '<div id="nachoColorPicker" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)this.remove()">' +
        '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:320px;width:100%;text-align:center;">' +
        '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">🎨 Customize ' + itemName + '</div>' +
        // Live preview of the item with current color
        '<div id="colorPickerPreview" style="font-size:3.5rem;margin-bottom:16px;filter:hue-rotate(' + saved + ');transition:filter 0.3s;">' + emoji + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:16px;">';
    for (var i = 0; i < colors.length; i++) {
        var active = saved === colors[i].hue;
        html += '<button onclick="event.stopPropagation();previewItemColor(\'' + itemId + '\',\'' + colors[i].hue + '\',\'' + (colors[i].filter || '') + '\')" style="width:44px;height:44px;border-radius:50%;background:' + colors[i].color + ';border:' + (active ? '3px solid #fff;box-shadow:0 0 10px ' + colors[i].color : '2px solid var(--border)') + ';cursor:pointer;touch-action:manipulation;transition:0.2s;" title="' + colors[i].name + '"></button>';
    }
    html += '</div>' +
        '<button onclick="document.getElementById(\'nachoColorPicker\').remove()" style="padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:10px;cursor:pointer;font-family:inherit;font-weight:700;font-size:0.9rem;">Done ✓</button>' +
        '</div></div>';
    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
};

// Live preview color in picker before committing
window.previewItemColor = function(itemId, hue, customFilter) {
    var preview = document.getElementById('colorPickerPreview');
    if (preview) {
        preview.style.filter = customFilter || ('hue-rotate(' + hue + ')');
    }
    // Update all color buttons to show which is selected
    var picker = document.getElementById('nachoColorPicker');
    if (picker) {
        picker.querySelectorAll('button[title]').forEach(function(btn) {
            btn.style.borderWidth = '2px';
            btn.style.boxShadow = 'none';
        });
    }
    // Commit the color
    localStorage.setItem('btc_nacho_color_' + itemId, hue);
    // Update main avatar overlay
    if (typeof renderNachoOverlay === 'function') renderNachoOverlay();
    // Update closet preview
    if (document.getElementById('nachoClosetGrid') && typeof renderNachoClosetUI === 'function') {
        renderNachoClosetUI(document.getElementById('nachoClosetGrid').parentElement);
    }
};

window.setItemColor = function(itemId, hue) {
    localStorage.setItem('btc_nacho_color_' + itemId, hue);
    // Update main Nacho avatar overlay
    if (typeof renderNachoOverlay === 'function') renderNachoOverlay();
    // Update closet preview
    if (document.getElementById('nachoClosetGrid') && typeof renderNachoClosetUI === 'function') {
        renderNachoClosetUI(document.getElementById('nachoClosetGrid').parentElement);
    }
    if (typeof showToast === 'function') showToast('🎨 Color updated!');
    // Close picker modal
    var modal = document.getElementById('nachoColorPicker');
    if (modal) modal.remove();
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
// Mixed prizes: Orange Tickets + Points + Fun rewards
var SPIN_PRIZES = [
    // Orange Tickets (most common)
    { label: '🎟️ 1 Ticket', emoji: '🎟️', type: 'ticket', value: 1 },
    { label: '🎟️ 2 Tickets', emoji: '🎟️', type: 'ticket', value: 2 },
    { label: '🎟️ 3 Tickets', emoji: '🎟️', type: 'ticket', value: 3 },
    { label: '🎟️ 5 Tickets!', emoji: '✨', type: 'ticket', value: 5 },
    { label: '🎟️ 10 Tickets!', emoji: '🌟', type: 'ticket', value: 10 },
    // Points
    { label: '+10 pts', emoji: '⭐', type: 'points', value: 10 },
    { label: '+25 pts', emoji: '💫', type: 'points', value: 25 },
    { label: '+50 pts!', emoji: '🎆', type: 'points', value: 50 },
    // Fun rewards
    { label: 'Bitcoin Fact!', emoji: '🧠', type: 'fact' },
    { label: 'Nacho Quote!', emoji: '🦌', type: 'quote' },
    { label: 'New Sticker!', emoji: '🦌✨', type: 'sticker' },
    // Rare tickets
    { label: '🎟️ 50 Tickets!!', emoji: '🔥', type: 'ticket', value: 50 },
    { label: '🎟️ 100 Tickets!!!', emoji: '💎', type: 'ticket', value: 100 },
    { label: '🎟️ 1,000 TICKETS!', emoji: '🏆', type: 'ticket', value: 1000 },
    { label: '🎟️ 10,000 JACKPOT!', emoji: '👑', type: 'ticket', value: 10000 },
];
// Weights — total ~100000
var SPIN_WEIGHTS = [
    20000,  // 1 ticket — 20%
    15000,  // 2 tickets — 15%
    10000,  // 3 tickets — 10%
    5000,   // 5 tickets — 5%
    3000,   // 10 tickets — 3%
    12000,  // +10 pts — 12%
    6000,   // +25 pts — 6%
    2000,   // +50 pts — 2%
    8000,   // Bitcoin fact — 8%
    7000,   // Nacho quote — 7%
    5000,   // Sticker — 5%
    1000,   // 50 tickets — 1%
    100,    // 100 tickets — 0.1%
    1,      // 1000 tickets — 0.001%
    0.01,   // 10000 jackpot — 0.00001%
];

function awardSpinPrize(prize) {
    if (prize.type === 'ticket') {
        // Award orange tickets via Firestore
        if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth.currentUser && !auth.currentUser.isAnonymous) {
            db.collection('users').doc(auth.currentUser.uid).update({
                orangeTickets: firebase.firestore.FieldValue.increment(prize.value)
            }).catch(function() {});
            if (typeof currentUser !== 'undefined' && currentUser) {
                currentUser.orangeTickets = (currentUser.orangeTickets || 0) + prize.value;
            }
        }
        if (typeof showToast === 'function') showToast('🎟️ +' + prize.value.toLocaleString() + ' Orange Ticket' + (prize.value !== 1 ? 's' : '') + '!');
    } else if (prize.type === 'points') {
        if (typeof awardPoints === 'function') awardPoints(prize.value, '🎡 Spin reward!');
    } else if (prize.type === 'fact') {
        var fact = typeof getDailyFact === 'function' ? getDailyFact() : 'Bitcoin is freedom money!';
        if (typeof showToast === 'function') showToast('🧠 ' + fact);
    } else if (prize.type === 'quote') {
        var quotes = ['Stay humble. Stack sats.', 'Not your keys, not your coins!', 'Tick tock, next block.', 'There is no second best.', 'Number go up!', 'Bitcoin fixes this.', 'Don\'t trust. Verify.'];
        var q = quotes[Math.floor(Math.random() * quotes.length)];
        if (typeof speakEasterEgg === 'function') speakEasterEgg(q);
        else if (typeof showToast === 'function') showToast('🦌 ' + q);
    } else if (prize.type === 'sticker') {
        var allStickers = ['wave','brain','fire','moon','cheese','crown','sleep','love','cool','diamond','lightning','stack'];
        var owned = JSON.parse(localStorage.getItem('btc_nacho_stickers') || '[]');
        var unowned = allStickers.filter(function(s) { return owned.indexOf(s) === -1; });
        if (unowned.length > 0) {
            var pick = unowned[Math.floor(Math.random() * unowned.length)];
            if (typeof earnSticker === 'function') earnSticker(pick);
        } else {
            // All stickers owned — give 5 tickets instead
            if (typeof showToast === 'function') showToast('🦌 All stickers collected! +5 bonus tickets!');
            awardSpinPrize({ type: 'ticket', value: 5 });
        }
    }
}

window.canSpin = function() {
    var lastSpin = localStorage.getItem('btc_last_spin') || '';
    var today = new Date().toISOString().split('T')[0];
    return lastSpin !== today;
};

// Show spin banner on homepage if user hasn't spun today
window.updateSpinBanner = function() {
    var banner = document.getElementById('dailySpinBanner');
    if (!banner) return;
    if (canSpin()) {
        banner.style.display = 'block';
        banner.innerHTML = '<div onclick="if(typeof showSpinWheel===\'function\')showSpinWheel()" style="background:linear-gradient(135deg,#f7931a,#ea580c);border-radius:14px;padding:16px;cursor:pointer;display:flex;align-items:center;gap:14px;touch-action:manipulation;-webkit-tap-highlight-color:rgba(0,0,0,0.2);">' +
            '<div style="font-size:2.5rem;animation:nachoModeBounce 2s ease-in-out infinite;">🎡</div>' +
            '<div style="flex:1;">' +
                '<div style="color:#fff;font-size:1rem;font-weight:800;">Daily Spin Ready!</div>' +
                '<div style="color:rgba(255,255,255,0.8);font-size:0.8rem;">Tap to spin and win Orange Tickets! 🎟️</div>' +
            '</div>' +
            '<div style="color:#fff;font-size:1.5rem;">→</div>' +
        '</div>';
    } else {
        banner.style.display = 'none';
    }
};
setTimeout(function() { if (typeof updateSpinBanner === 'function') updateSpinBanner(); }, 1000);

window.showSpinWheel = function() {
    if (!canSpin()) {
        if (typeof showToast === 'function') showToast('🎡 Already spun today! Come back tomorrow.');
        return;
    }
    // Track if user is logged in at time of opening
    window._spinUserLoggedIn = !!(typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous);
    var html = '<div id="spinOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;">' +
        '<div style="background:var(--bg-side);border:2px solid var(--accent);border-radius:24px;padding:28px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(247,147,26,0.3);">' +
        '<div style="font-size:0.7rem;color:var(--accent);text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-bottom:4px;">Daily Reward</div>' +
        '<div style="font-size:1.6rem;font-weight:900;color:var(--heading);margin-bottom:16px;">🎡 Spin the Wheel</div>' +
        '<div id="spinWheelContainer" style="position:relative;width:180px;height:180px;margin:0 auto 20px;border-radius:50%;border:4px solid var(--accent);background:radial-gradient(circle,var(--card-bg) 0%,var(--bg-side) 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 0 30px rgba(247,147,26,0.2),inset 0 0 20px rgba(0,0,0,0.3);">' +
            '<div id="spinWheelDisplay" style="font-size:4.5rem;transition:transform 0.1s;">🎟️</div>' +
            '<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);font-size:1.5rem;">▼</div>' +
        '</div>' +
        '<button id="spinBtn" onclick="doSpin()" style="padding:16px 40px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:14px;font-size:1.2rem;font-weight:800;cursor:pointer;font-family:inherit;touch-action:manipulation;box-shadow:0 4px 15px rgba(247,147,26,0.4);transition:0.2s;letter-spacing:1px;" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'\'">SPIN!</button>' +
        '</div></div>';
    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
    if (typeof playEngagementSound === 'function') playEngagementSound('click');
};

window.doSpin = function() {
    var btn = document.getElementById('spinBtn');
    var display = document.getElementById('spinWheelDisplay');
    var container = document.getElementById('spinWheelContainer');
    if (!btn || !display) return;
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.textContent = 'SPINNING...';

    // Determine prize upfront
    var weightTotal = SPIN_WEIGHTS.reduce(function(a, b) { return a + b; }, 0);
    var r = Math.random() * weightTotal;
    var cumulative = 0;
    var prizeIdx = 0;
    for (var w = 0; w < SPIN_WEIGHTS.length; w++) {
        cumulative += SPIN_WEIGHTS[w];
        if (r <= cumulative) { prizeIdx = w; break; }
    }

    // Animate with realistic deceleration
    var totalFrames = 30 + Math.floor(Math.random() * 15);
    var frame = 0;
    var rotation = 0;

    function spinFrame() {
        frame++;
        // Deceleration curve: fast start, slow end
        var progress = frame / totalFrames;
        var speed = Math.max(0, 1 - Math.pow(progress, 2)); // Quadratic deceleration

        // Show random emoji, slowing down
        var idx = frame % SPIN_PRIZES.length;
        display.textContent = SPIN_PRIZES[idx].emoji;

        // Rotate the container for visual spin effect
        rotation += speed * 30;
        if (container) container.style.transform = 'rotate(' + rotation + 'deg)';

        // Scale pulse on each tick
        display.style.transform = 'scale(' + (1 + speed * 0.2) + ')';

        if (frame < totalFrames) {
            // Variable timing: fast at start (50ms), slow at end (200ms)
            var delay = 50 + (1 - speed) * 200;
            setTimeout(spinFrame, delay);
        } else {
            // Final — show prize
            if (container) container.style.transform = 'rotate(0deg)';
            display.textContent = SPIN_PRIZES[prizeIdx].emoji;
            display.style.transform = 'scale(1.4)';
            if (container) container.style.borderColor = '#22c55e';
            if (container) container.style.boxShadow = '0 0 40px rgba(34,197,94,0.4),inset 0 0 20px rgba(0,0,0,0.3)';

            setTimeout(function() {
                var prize = SPIN_PRIZES[prizeIdx];
                var isBig = (prize.type === 'ticket' && prize.value >= 50) || (prize.type === 'points' && prize.value >= 50);

                display.style.transform = 'scale(1)';
                var spinDate = new Date().toISOString().split('T')[0];
                localStorage.setItem('btc_last_spin', spinDate);
                // Sync to Firestore so spin tracks across devices
                if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth.currentUser && !auth.currentUser.isAnonymous) {
                    db.collection('users').doc(auth.currentUser.uid).update({ lastSpinDate: spinDate }).catch(function(){});
                }

                // Replace entire modal with result
                var overlay = document.getElementById('spinOverlay');
                if (overlay) {
                    var resultHtml = '<div style="background:var(--bg-side);border:2px solid ' + (isBig ? '#22c55e' : 'var(--accent)') + ';border-radius:24px;padding:28px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 20px 60px ' + (isBig ? 'rgba(34,197,94,0.3)' : 'rgba(247,147,26,0.3)') + ';animation:fadeSlideIn 0.3s;">' +
                        '<div style="font-size:4rem;margin-bottom:8px;">' + prize.emoji + '</div>' +
                        '<div style="font-size:' + (isBig ? '1.6rem' : '1.3rem') + ';font-weight:900;color:' + (isBig ? '#22c55e' : 'var(--accent)') + ';margin-bottom:4px;">' + prize.label + '</div>' +
                        (isBig ? '<div style="font-size:0.9rem;color:var(--heading);font-weight:700;margin-bottom:12px;">🎉 AMAZING WIN! 🎉</div>' : '<div style="margin-bottom:12px;"></div>') +
                        '<button onclick="document.getElementById(\'spinOverlay\').remove();if(typeof updateSpinBanner===\'function\')updateSpinBanner()" style="padding:14px 32px;background:' + (isBig ? '#22c55e' : 'var(--accent)') + ';color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;">Awesome! 🦌</button>' +
                    '</div>';
                    overlay.innerHTML = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this){this.remove();if(typeof updateSpinBanner===\'function\')updateSpinBanner()}">' + resultHtml + '</div>';
                }

                // Check if user is logged in to claim
                var isLoggedIn = !!(typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous);
                if (isLoggedIn) {
                    awardSpinPrize(prize);
                } else {
                    // Store pending prize — awarded after sign-in
                    localStorage.setItem('btc_pending_spin_prize', JSON.stringify({ type: prize.type, value: prize.value, label: prize.label }));
                    // Replace dismiss button with sign-in prompt
                    var overlay2 = document.getElementById('spinOverlay');
                    if (overlay2) {
                        var inner = overlay2.querySelector('[style*="border-radius:24px"]');
                        if (inner) {
                            inner.innerHTML = '<div style="font-size:4rem;margin-bottom:8px;">' + prize.emoji + '</div>' +
                                '<div style="font-size:' + (isBig ? '1.6rem' : '1.3rem') + ';font-weight:900;color:var(--accent);margin-bottom:8px;">' + prize.label + '</div>' +
                                '<div style="background:var(--card-bg);border:2px solid var(--accent);border-radius:12px;padding:14px;margin-bottom:16px;">' +
                                    '<div style="font-size:0.9rem;color:var(--heading);font-weight:700;margin-bottom:4px;">🔒 Sign in to claim your prize!</div>' +
                                    '<div style="font-size:0.8rem;color:var(--text-muted);line-height:1.4;">Create a free account or sign in now to receive your ' + prize.label + '. Your reward is saved and will be awarded instantly!</div>' +
                                '</div>' +
                                '<button onclick="document.getElementById(\'spinOverlay\').remove();if(typeof showUsernamePrompt===\'function\')showUsernamePrompt()" style="padding:14px 32px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;width:100%;">Sign In to Claim →</button>' +
                                '<button onclick="document.getElementById(\'spinOverlay\').remove();if(typeof updateSpinBanner===\'function\')updateSpinBanner()" style="margin-top:8px;padding:10px;background:none;border:none;color:var(--text-faint);font-size:0.8rem;cursor:pointer;font-family:inherit;">Skip (prize will be lost)</button>';
                        }
                    }
                    if (typeof playEngagementSound === 'function') playEngagementSound('win');
                    return;
                }

                if (typeof playEngagementSound === 'function') playEngagementSound('win');
                if (typeof haptic === 'function') haptic(isBig ? 'heavy' : 'success');

                // Confetti for big wins
                if (isBig && typeof launchConfetti === 'function') launchConfetti();
            }, 600);
        }
    }

    // Start spinning
    if (typeof playEngagementSound === 'function') playEngagementSound('spin');
    spinFrame();
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
                '<button onclick="makePrediction(\'higher\',' + price + ')" style="flex:1;padding:14px;background:#22c55e;color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;">📈 Higher</button>' +
                '<button onclick="makePrediction(\'lower\',' + price + ')" style="flex:1;padding:14px;background:#ef4444;color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;">📉 Lower</button>' +
            '</div></div></div>';
        var div = document.createElement('div');
        div.innerHTML = html;
        document.body.appendChild(div.firstChild);
    });
};

window.makePrediction = function(direction, price) {
    var prediction = {
        direction: direction,
        price: price,
        timestamp: Date.now(),
        checkAfter: Date.now() + 86400000 // 24 hours
    };
    localStorage.setItem('btc_prediction', JSON.stringify(prediction));
    // Sync to Firestore so prediction tracks across devices
    if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth.currentUser && !auth.currentUser.isAnonymous) {
        db.collection('users').doc(auth.currentUser.uid).update({ prediction: prediction }).catch(function(){});
    }
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
window._stickerToastsReady = false;
setTimeout(function() { window._stickerToastsReady = true; }, 10000); // Suppress sticker toasts for first 10s

window.earnSticker = function(stickerId) {
    var stickers = JSON.parse(localStorage.getItem('btc_nacho_stickers') || '[]');
    if (stickers.indexOf(stickerId) !== -1) return; // Already have it
    stickers.push(stickerId);
    localStorage.setItem('btc_nacho_stickers', JSON.stringify(stickers));
    // Only toast after initial load (prevents 5+ toasts on first visit)
    if (window._stickerToastsReady && typeof showToast === 'function') showToast('🦌 New sticker earned!');
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
    { title: 'Chapter 4: Mining the Mountain', text: 'Nacho discovered bears mining Bitcoin deep in the mountain, guessing billions of random numbers every second, racing to find the right one. "We don\'t solve puzzles," they growled. "We GUESS — and the energy we spend proves we did real work. That\'s what keeps Bitcoin secure." ⛏️🐻', lesson: 'Proof of work secures Bitcoin through energy expenditure, not puzzle-solving.' },
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

window.showNachoStory = function(chapterIdx) {
    var progress = getNachoStoryProgress();
    var lastRead = localStorage.getItem('btc_nacho_story_date') || '';
    var today = new Date().toISOString().split('T')[0];
    var alreadyReadToday = lastRead === today;

    // If called with a specific chapter, show that chapter (re-read mode)
    var viewIdx = (typeof chapterIdx === 'number') ? chapterIdx : Math.min(progress, NACHO_STORY.length - 1);
    var chapter = NACHO_STORY[viewIdx];
    var isCurrentChapter = viewIdx === Math.min(progress, NACHO_STORY.length - 1);
    var isNew = progress < NACHO_STORY.length && isCurrentChapter && !alreadyReadToday;
    var isComplete = progress >= NACHO_STORY.length;

    // Build chapter list for previous chapters
    var chapterListHtml = '';
    if (progress > 0) {
        chapterListHtml = '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;">' +
            '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Previous Chapters</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">';
        for (var i = 0; i <= Math.min(progress, NACHO_STORY.length - 1); i++) {
            var isCurrent = i === viewIdx;
            chapterListHtml += '<button onclick="event.stopPropagation();document.getElementById(\'nachoStoryOverlay\').remove();showNachoStory(' + i + ')" style="padding:4px 10px;border-radius:8px;border:1px solid ' + (isCurrent ? 'var(--accent)' : 'var(--border)') + ';background:' + (isCurrent ? 'var(--accent)' : 'var(--card-bg)') + ';color:' + (isCurrent ? '#fff' : 'var(--text-muted)') + ';font-size:0.7rem;cursor:pointer;font-family:inherit;font-weight:' + (isCurrent ? '700' : '500') + ';">' + (i + 1) + '</button>';
        }
        chapterListHtml += '</div></div>';
    }

    // Button: advance if new chapter, or just close if re-reading
    var buttonHtml = '';
    if (isNew) {
        buttonHtml = '<button onclick="advanceNachoStory();document.getElementById(\'nachoStoryOverlay\').remove()" style="padding:12px 24px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;width:100%;">Continue →</button>';
    } else if (isCurrentChapter && alreadyReadToday && !isComplete) {
        buttonHtml = '<button onclick="document.getElementById(\'nachoStoryOverlay\').remove()" style="padding:12px 24px;background:var(--card-bg);border:1px solid var(--border);color:var(--text-muted);border-radius:10px;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;width:100%;">📖 Next chapter tomorrow!</button>';
    } else if (isComplete) {
        buttonHtml = '<button onclick="document.getElementById(\'nachoStoryOverlay\').remove()" style="padding:12px 24px;background:#22c55e;color:#fff;border:none;border-radius:10px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;width:100%;">🎉 Story Complete!</button>';
    } else {
        buttonHtml = '<button onclick="document.getElementById(\'nachoStoryOverlay\').remove()" style="padding:12px 24px;background:var(--card-bg);border:1px solid var(--border);color:var(--text);border-radius:10px;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;width:100%;">Close</button>';
    }

    var html = '<div id="nachoStoryOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)this.remove()">' +
        '<div style="background:var(--bg-side);border:2px solid var(--accent);border-radius:20px;padding:24px;max-width:400px;width:100%;text-align:center;max-height:85vh;overflow-y:auto;">' +
        '<div style="font-size:0.7rem;color:var(--accent);text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">📖 Nacho\'s Story</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);margin-bottom:12px;">' + chapter.title + '</div>' +
        '<div style="color:var(--text);font-size:0.9rem;line-height:1.6;margin-bottom:16px;text-align:left;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;">' + chapter.text + '</div>' +
        '<div style="color:var(--accent);font-size:0.8rem;font-weight:600;margin-bottom:16px;text-align:left;">💡 Lesson: ' + chapter.lesson + '</div>' +
        '<div style="color:var(--text-faint);font-size:0.75rem;margin-bottom:12px;">Chapter ' + (viewIdx + 1) + ' of ' + NACHO_STORY.length + '</div>' +
        buttonHtml +
        chapterListHtml +
        '</div></div>';

    // Remove existing overlay if any
    var existing = document.getElementById('nachoStoryOverlay');
    if (existing) existing.remove();

    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
};

window.advanceNachoStory = function() {
    var progress = getNachoStoryProgress();
    if (progress < NACHO_STORY.length) {
        var newProgress = progress + 1;
        var today = new Date().toISOString().split('T')[0];
        localStorage.setItem('btc_nacho_story', newProgress.toString());
        localStorage.setItem('btc_nacho_story_date', today);
        // Sync to Firestore
        if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth.currentUser && !auth.currentUser.isAnonymous) {
            db.collection('users').doc(auth.currentUser.uid).update({
                nachoStoryProgress: newProgress,
                nachoStoryDate: today
            }).catch(function(){});
        }
        if (typeof awardPoints === 'function') awardPoints(10, '📖 Story chapter read!');
    }
};

// ---- #16: Sound Effects ----
// Global sound gate — never play audio when page isn't visible
window.canPlaySound = function() {
    if (document.hidden || document.visibilityState === 'hidden') return false;
    if (localStorage.getItem('btc_audio') === 'false') return false;
    return true;
};

window.playEngagementSound = function(type) {
    if (!canPlaySound()) return;
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

// ---- Claim pending spin prize after sign-in ----
function checkPendingSpinPrize() {
    var pending = localStorage.getItem('btc_pending_spin_prize');
    if (!pending) return;
    var isLoggedIn = !!(typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous);
    if (!isLoggedIn) return;
    try {
        var prize = JSON.parse(pending);
        localStorage.removeItem('btc_pending_spin_prize');
        awardSpinPrize(prize);
        if (typeof showToast === 'function') showToast('🎡 Spin prize claimed: ' + prize.label + '!');
        if (typeof haptic === 'function') haptic('success');
    } catch(e) { localStorage.removeItem('btc_pending_spin_prize'); }
}
// Check every 3 seconds (catches sign-in)
setInterval(checkPendingSpinPrize, 3000);

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
