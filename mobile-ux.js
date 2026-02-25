// =============================================
// 📱 Mobile UX Enhancements
// Pull-to-refresh, bottom nav, reading progress,
// scroll position memory, haptic feedback,
// page transitions, double-tap upvote,
// streak banner, daily challenge, progress rings,
// welcome back message
// =============================================

(function() {

// ---- #1: Pull-to-Refresh ----
var pullStartY = 0, pullDist = 0, pullEl = null;
function initPullToRefresh() {
    var main = document.getElementById('main');
    if (!main) return;

    // Create pull indicator
    pullEl = document.createElement('div');
    pullEl.id = 'pullRefreshIndicator';
    pullEl.style.cssText = 'position:absolute;top:-50px;left:50%;transform:translateX(-50%);background:var(--accent);color:#fff;padding:8px 16px;border-radius:20px;font-size:0.8rem;font-weight:600;z-index:60;transition:0.3s;opacity:0;pointer-events:none;';
    pullEl.textContent = '↓ Pull to refresh';
    main.style.position = 'relative';
    main.insertBefore(pullEl, main.firstChild);

    main.addEventListener('touchstart', function(e) {
        if (main.scrollTop <= 0) pullStartY = e.touches[0].clientY;
        else pullStartY = 0;
    }, { passive: true });

    main.addEventListener('touchmove', function(e) {
        if (!pullStartY) return;
        pullDist = e.touches[0].clientY - pullStartY;
        if (pullDist > 0 && pullDist < 150 && main.scrollTop <= 0) {
            pullEl.style.top = Math.min(pullDist - 50, 20) + 'px';
            pullEl.style.opacity = Math.min(pullDist / 80, 1);
            pullEl.textContent = pullDist > 80 ? '↑ Release to refresh' : '↓ Pull to refresh';
        }
    }, { passive: true });

    main.addEventListener('touchend', function() {
        if (pullDist > 80 && main.scrollTop <= 0) {
            pullEl.textContent = '🔄 Refreshing...';
            pullEl.style.top = '10px';
            setTimeout(function() { location.reload(); }, 500);
        } else {
            pullEl.style.top = '-50px';
            pullEl.style.opacity = '0';
        }
        pullStartY = 0;
        pullDist = 0;
    }, { passive: true });
}

// ---- #2: Bottom Navigation Bar ----
function initBottomNav() {
    if (!('ontouchstart' in window) && window.innerWidth > 900) return; // Desktop skip

    var nav = document.createElement('div');
    nav.id = 'bottomNav';
    nav.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:200;background:var(--bg-side,#0a0a0a);border-top:1px solid var(--border);padding:6px 0 env(safe-area-inset-bottom,6px);display:none;';
    // Show immediately on mobile
    if (window.innerWidth <= 900) nav.style.display = 'block';
    nav.innerHTML =
        '<div style="display:flex;justify-content:space-around;align-items:center;max-width:500px;margin:0 auto;">' +
            '<button onclick="goHome()" class="bnav-btn" id="bnavHome"><span>🏠</span><span>Home</span></button>' +
            '<button onclick="if(typeof toggleMenu===\'function\')toggleMenu();setTimeout(function(){var si=document.getElementById(\'searchInput\');if(si){si.focus();si.click();}},300)" class="bnav-btn" id="bnavSearch"><span>🔍</span><span>Search</span></button>' +
            '<button onclick="enterNachoMode()" class="bnav-btn" id="bnavNacho"><span>🦌</span><span>Nacho</span></button>' +
            '<button onclick="go(\'forum\')" class="bnav-btn" id="bnavForum"><span>🗣️</span><span>Forum</span></button>' +
            '<button onclick="toggleMenu();setTimeout(updateMenuBtn,100)" class="bnav-btn" id="bnavMenu"><span>' + (sidebar.classList.contains('open') ? '✕' : '☰') + '</span><span>' + (sidebar.classList.contains('open') ? 'Hide' : 'Menu') + '</span></button>' +
        '</div>';

    // Add styles
    var style = document.createElement('style');
    style.textContent =
        '.bnav-btn{background:none;border:none;color:var(--text-faint);font-size:0.6rem;cursor:pointer;font-family:inherit;padding:4px 8px;display:flex;flex-direction:column;align-items:center;gap:2px;touch-action:manipulation;-webkit-tap-highlight-color:rgba(247,147,26,0.2);transition:0.2s;min-width:48px;}' +
        '.bnav-btn span:first-child{font-size:1.3rem;}' +
        '.bnav-btn:active,.bnav-btn.active{color:var(--accent);}' +
        '@media(min-width:901px){#bottomNav{display:none!important;}}' +
        '@media(max-width:900px){#bottomNav{display:block!important;}.messages{padding-bottom:140px!important;}.home-page{padding-bottom:100px!important;}}';
    document.head.appendChild(style);
    document.body.appendChild(nav);
}

// Update menu button label based on sidebar state
window.updateMenuBtn = function() {
    var btn = document.getElementById('bnavMenu');
    var sidebar = document.getElementById('sidebar');
    if (!btn || !sidebar) return;
    var isOpen = sidebar.classList.contains('open');
    btn.innerHTML = '<span>' + (isOpen ? '✕' : '☰') + '</span><span>' + (isOpen ? 'Close' : 'Menu') + '</span>';
};

// ---- #4: Reading Progress Indicator ----
function initReadingProgress() {
    var bar = document.createElement('div');
    bar.id = 'readingProgress';
    bar.style.cssText = 'position:fixed;top:0;left:0;height:3px;background:var(--accent);z-index:999;width:0;transition:width 0.1s;pointer-events:none;';
    document.body.appendChild(bar);

    var main = document.getElementById('main');
    if (!main) return;
    main.addEventListener('scroll', function() {
        var scrollTop = main.scrollTop;
        var scrollHeight = main.scrollHeight - main.clientHeight;
        if (scrollHeight <= 0) { bar.style.width = '0'; return; }
        var pct = Math.min(100, (scrollTop / scrollHeight) * 100);
        bar.style.width = pct + '%';
    });
}

// ---- #5: Scroll Position Memory ----
window._scrollPositions = {};
var origGo = window.go;
if (origGo) {
    window.go = async function(id, btn, fromPopState) {
        // Save current scroll position before navigating
        var main = document.getElementById('main');
        var currentHash = location.hash.slice(1);
        if (currentHash && main) window._scrollPositions[currentHash] = main.scrollTop;

        await origGo(id, btn, fromPopState);

        // Restore scroll position if returning to a previously visited channel
        if (window._scrollPositions[id] && main) {
            setTimeout(function() { main.scrollTop = window._scrollPositions[id]; }, 100);
        }
    };
}

// ---- #6: Haptic Feedback ----
window.haptic = function(type) {
    if (localStorage.getItem('btc_haptic') === 'false') return;
    if (!navigator.vibrate) return;
    switch(type) {
        case 'light': navigator.vibrate(10); break;
        case 'medium': navigator.vibrate(25); break;
        case 'heavy': navigator.vibrate([30, 50, 30]); break;
        case 'success': navigator.vibrate([15, 30, 15, 30, 15]); break;
        case 'error': navigator.vibrate([50, 30, 50]); break;
        default: navigator.vibrate(15);
    }
};

// Hook into existing functions to add haptics
var _origAwardPoints = window.awardPoints;
if (_origAwardPoints) {
    window.awardPoints = function() {
        haptic('success');
        return _origAwardPoints.apply(this, arguments);
    };
}
// Haptic on level-up celebrations
var _origShowLevelUp = window.showLevelUpCelebration;
if (_origShowLevelUp) {
    window.showLevelUpCelebration = function() {
        haptic('heavy');
        return _origShowLevelUp.apply(this, arguments);
    };
}

// ---- #7: Page Transitions ----
(function() {
    var style = document.createElement('style');
    style.textContent =
        '@keyframes slideInRight{from{transform:translateX(30px);opacity:0}to{transform:translateX(0);opacity:1}}' +
        '@keyframes slideInLeft{from{transform:translateX(-30px);opacity:0}to{transform:translateX(0);opacity:1}}' +
        '@keyframes slideInUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}' +
        '.page-transition-right{animation:slideInRight 0.25s ease-out;}' +
        '.page-transition-left{animation:slideInLeft 0.25s ease-out;}' +
        '.page-transition-up{animation:slideInUp 0.2s ease-out;}';
    document.head.appendChild(style);

    // Add transition class when navigating
    var main = document.getElementById('main');
    if (main) {
        var observer = new MutationObserver(function() {
            var hero = document.getElementById('hero');
            if (hero && hero.innerHTML) {
                hero.classList.remove('page-transition-right');
                void hero.offsetWidth; // Force reflow
                hero.classList.add('page-transition-right');
            }
        });
        observer.observe(document.getElementById('hero') || main, { childList: true });
    }
})();

// ---- #8: Double-tap to Upvote (Forum) ----
var lastTapTime = 0;
document.addEventListener('touchend', function(e) {
    var now = Date.now();
    if (now - lastTapTime < 300) {
        // Double tap detected
        var forumPost = e.target.closest && e.target.closest('[onclick*="forumViewPost"]');
        if (forumPost) {
            // Find the upvote button inside
            var upBtn = forumPost.querySelector('[onclick*="forumVotePost"]');
            if (upBtn) { upBtn.click(); haptic('medium'); }
            e.preventDefault();
        }
    }
    lastTapTime = now;
}, { passive: false });

// ---- #10: Daily Streak Banner ----
function showStreakBanner() {
    var streak = 0;
    if (typeof currentUser !== 'undefined' && currentUser) streak = currentUser.streak || 0;
    if (streak < 2) return; // Only show for 2+ days

    var existing = document.getElementById('streakBanner');
    if (existing) return; // Already shown this session

    var banner = document.createElement('div');
    banner.id = 'streakBanner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:300;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;padding:10px 16px;text-align:center;font-size:0.85rem;font-weight:700;cursor:pointer;animation:slideInUp 0.3s;';
    banner.innerHTML = '🔥 Day ' + streak + ' streak! Keep it alive! <span style="opacity:0.7;font-size:0.75rem;margin-left:8px;">tap to dismiss</span>';
    banner.onclick = function() { banner.style.transition = '0.3s'; banner.style.transform = 'translateY(-100%)'; setTimeout(function() { banner.remove(); }, 300); };
    document.body.appendChild(banner);

    // Auto-dismiss after 5 seconds
    setTimeout(function() {
        if (banner.parentNode) {
            banner.style.transition = '0.3s';
            banner.style.transform = 'translateY(-100%)';
            setTimeout(function() { if (banner.parentNode) banner.remove(); }, 300);
        }
    }, 5000);
}

// ---- #11: Daily Challenge ----
var DAILY_CHALLENGES = [
    { id: 'read', text: '📖 Read a new channel', check: function() { return sessionStorage.getItem('btc_new_channel_read') === 'true'; } },
    { id: 'nacho', text: '🦌 Ask Nacho a question', check: function() { return parseInt(sessionStorage.getItem('btc_nacho_asked') || '0') > 0; } },
    { id: 'quiz', text: '🎮 Complete a quiz question', check: function() { return sessionStorage.getItem('btc_quiz_done') === 'true'; } },
    { id: 'explore', text: '🗺️ Visit 3 different channels', check: function() { return parseInt(sessionStorage.getItem('btc_channels_today') || '0') >= 3; } },
    { id: 'forum', text: '🗣️ Visit the Community Forum', check: function() { return sessionStorage.getItem('btc_forum_visited') === 'true'; } },
    { id: 'streak', text: '🔥 Log in to keep your streak', check: function() { return true; } }, // Always completable
    { id: 'favorite', text: '⭐ Save a channel to favorites', check: function() { return sessionStorage.getItem('btc_fav_added') === 'true'; } },
];

function getDailyChallenge() {
    var today = new Date().toISOString().split('T')[0];
    var dayNum = Math.floor(new Date(today).getTime() / 86400000);
    return DAILY_CHALLENGES[dayNum % DAILY_CHALLENGES.length];
}

function renderDailyChallenge() {
    var challenge = getDailyChallenge();
    var today = new Date().toISOString().split('T')[0];
    var completed = localStorage.getItem('btc_challenge_done') === today;

    var el = document.getElementById('dailyChallengeCard');
    if (!el) return;

    if (completed) {
        el.style.borderColor = '#22c55e';
        el.style.background = 'rgba(34,197,94,0.05)';
        el.innerHTML = '<div style="display:flex;align-items:center;gap:10px;">' +
            '<span style="font-size:1.5rem;">✅</span>' +
            '<div><div style="color:#22c55e;font-size:0.85rem;font-weight:700;">Daily Challenge Complete! +15 pts 🎉</div>' +
            '<div style="color:var(--text-faint);font-size:0.7rem;">' + challenge.text + ' — Done! Come back tomorrow.</div></div></div>';
    } else {
        el.style.borderColor = 'var(--border)';
        el.style.background = 'var(--card-bg)';
        el.innerHTML = '<div style="display:flex;align-items:center;gap:10px;">' +
            '<span style="font-size:1.3rem;">🎯</span>' +
            '<div><div style="color:var(--accent);font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Today\'s Challenge</div>' +
            '<div style="color:var(--text);font-size:0.85rem;font-weight:600;">' + challenge.text + '</div></div></div>';
    }
}

// Check challenge completion periodically
function checkDailyChallenge() {
    var today = new Date().toISOString().split('T')[0];
    if (localStorage.getItem('btc_challenge_done') === today) return;

    var challenge = getDailyChallenge();
    if (challenge.check()) {
        localStorage.setItem('btc_challenge_done', today);
        if (typeof awardPoints === 'function') awardPoints(15, '🎯 Daily challenge!');
        if (typeof showToast === 'function') showToast('🎯 Daily challenge complete! +15 pts');
        haptic('success');
        renderDailyChallenge();
    }
}
setInterval(checkDailyChallenge, 5000);

// Track channel visits for challenge
var _origGoForChallenge = window.go;
if (_origGoForChallenge) {
    // Wrap to track
    var _realGo = window.go;
    window.go = async function(id) {
        var result = await _realGo.apply(this, arguments);
        if (id && id !== 'forum') {
            var count = parseInt(sessionStorage.getItem('btc_channels_today') || '0') + 1;
            sessionStorage.setItem('btc_channels_today', count);
            var visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
            if (visited.indexOf(id) === -1) sessionStorage.setItem('btc_new_channel_read', 'true');
        }
        if (id === 'forum') sessionStorage.setItem('btc_forum_visited', 'true');
        return result;
    };
}

// Track Nacho questions for daily challenge
var _origNachoUnified = window.nachoUnifiedAnswer;
if (_origNachoUnified) {
    window.nachoUnifiedAnswer = function(q, cb) {
        sessionStorage.setItem('btc_nacho_asked', '1');
        return _origNachoUnified.apply(this, arguments);
    };
}

// Track quiz completion for daily challenge
var _origQuizAnswer = window.nachoQuizAnswer;
if (_origQuizAnswer) {
    window.nachoQuizAnswer = function() {
        sessionStorage.setItem('btc_quiz_done', 'true');
        return _origQuizAnswer.apply(this, arguments);
    };
}

// Track favorite added for daily challenge
var _origToggleFav = window.toggleFav;
if (_origToggleFav) {
    window.toggleFav = function() {
        sessionStorage.setItem('btc_fav_added', 'true');
        return _origToggleFav.apply(this, arguments);
    };
}

// ---- #12: Progress Rings on Homepage ----
window.renderProgressRings = function() {
    var el = document.getElementById('progressRings');
    if (!el) return;

    var totalChannels = typeof CHANNELS !== 'undefined' ? Object.keys(CHANNELS).length : 146;
    var visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]').length;
    var streak = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.streak || 0 : 0;
    var points = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.points || 0 : 0;
    var interactions = parseInt(localStorage.getItem('btc_nacho_interactions') || '0');

    function ring(pct, color, label, value) {
        var r = 32, c = 2 * Math.PI * r;
        var offset = c - (pct / 100) * c;
        return '<div style="text-align:center;min-width:70px;">' +
            '<svg width="72" height="72" viewBox="0 0 72 72">' +
                '<circle cx="36" cy="36" r="' + r + '" fill="none" stroke="var(--border)" stroke-width="5"/>' +
                '<circle cx="36" cy="36" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + offset + '" transform="rotate(-90 36 36)" style="transition:stroke-dashoffset 1s;"/>' +
                '<text x="36" y="40" text-anchor="middle" fill="var(--text)" font-size="13" font-weight="700">' + value + '</text>' +
            '</svg>' +
            '<div style="color:var(--text-faint);font-size:0.65rem;margin-top:2px;">' + label + '</div></div>';
    }

    el.innerHTML = '<div style="display:flex;justify-content:center;gap:16px;flex-wrap:wrap;">' +
        ring(Math.min(100, (visited / totalChannels) * 100), '#f7931a', 'Channels', visited + '/' + totalChannels) +
        ring(Math.min(100, streak * 5), '#22c55e', 'Streak', '🔥' + streak) +
        ring(Math.min(100, (points / 21000) * 100), '#8B5CF6', 'Points', points > 999 ? Math.floor(points/1000) + 'k' : points) +
        ring(Math.min(100, interactions * 2), '#3B82F6', 'Nacho', interactions) +
    '</div>';
};

// ---- #13: Welcome Back Message from Nacho ----
function showWelcomeBack() {
    if (typeof forceShowBubble !== 'function') return;
    if (sessionStorage.getItem('btc_welcomed_back')) return;
    sessionStorage.setItem('btc_welcomed_back', 'true');

    var name = '';
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.username) name = currentUser.username;
    var streak = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.streak || 0 : 0;
    var hour = new Date().getHours();
    var timeGreeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
    var challenge = getDailyChallenge();

    var msg = '';
    if (name && streak >= 2) {
        msg = 'Good ' + timeGreeting.toLowerCase() + ', ' + name + '! ☀️ Day ' + streak + ' streak — you\'re on fire! 🔥 Today\'s challenge: ' + challenge.text;
    } else if (name) {
        msg = 'Hey ' + name + '! 🦌 Welcome back! Today\'s challenge: ' + challenge.text;
    } else {
        msg = 'Welcome back! 🦌 Today\'s challenge: ' + challenge.text;
    }

    // Delay to let the page load
    setTimeout(function() { forceShowBubble(msg); }, 3000);
}

// ---- Initialize Everything ----
function initMobileUX() {
    console.log('[MobileUX] Initializing...');
    initPullToRefresh();
    initBottomNav();
    initReadingProgress();

    // Wait for user data to load
    setTimeout(function() {
        showStreakBanner();
        showWelcomeBack();
        renderDailyChallenge();
        if (typeof renderProgressRings === 'function') renderProgressRings();
    }, 2500);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileUX);
} else {
    initMobileUX();
}

})();
