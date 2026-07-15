// © 2024-2026 603BTC LLC. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
// =============================================
// 📱 Mobile UX Enhancements
// Bottom nav, scroll nav hide/show,
// scroll position memory, haptic feedback,
// page transitions, double-tap upvote,
// streak banner, daily challenge, progress rings,
// welcome back message
// =============================================

(function() {



// ---- #2: Bottom Navigation Bar ----
function initBottomNav() {
    // Always initialize bottom nav; CSS media queries hide it on larger screens
    var nav = document.createElement('div');
    nav.id = 'bottomNav';
    nav.className = 'mobile-nav';
    nav.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:200000;background:rgba(10,10,10,0.95);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-top:1px solid rgba(255,255,255,0.1);padding:10px 0 env(safe-area-inset-bottom,10px) 0;padding-bottom:max(env(safe-area-inset-bottom,10px),10px);display:none;transition:transform 0.25s ease;-webkit-transform:translateZ(0);transform:translateZ(0);';
    nav.innerHTML =
        '<div style="display:flex;justify-content:space-around;align-items:stretch;max-width:500px;margin:0 auto;">' +
            '<button onclick="goHome()" class="bnav-btn" id="bnavHome"><span class="bnav-icon">🏠</span><span class="bnav-label">Home</span></button>' +
            '<button onclick="window.toggleAppsMenu(event)" class="bnav-btn" id="bnavApps"><span class="bnav-icon">🧭</span><span class="bnav-label" style="line-height:1.1;font-size:0.55rem;">Explore<br>Apps</span></button>' +
            '<button onclick="toggleMobileLearnMenu()" class="bnav-btn" id="bnavLearn" style="position:relative;"><span class="bnav-icon">🎓</span><span class="bnav-label">Learn</span></button>' +
            '<button onclick="if(typeof toggleNotifOverlay===\'function\')toggleNotifOverlay()" class="bnav-btn" id="bnavNotif" style="position:relative;"><span class="bnav-icon">🔔</span><span class="bnav-label">Alerts</span><span id="bnavNotifBadge" style="display:none;position:absolute;top:2px;right:4px;background:#ef4444;color:#fff;font-size:0.55rem;font-weight:800;padding:1px 4px;border-radius:6px;min-width:12px;text-align:center;"></span></button>' +
            '<button onclick="if(typeof showSettings===\'function\')showSettings()" class="bnav-btn" id="bnavSettings"><span class="bnav-icon">⚙️</span><span class="bnav-label">Settings</span></button>' +
        '</div>';

    // Add styles
    var style = document.createElement('style');
    style.textContent =
        '.bnav-btn{background:none;border:none;color:var(--text-dim,#666);font-size:0.6rem;cursor:pointer;font-family:inherit;padding:6px 0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:0.2s;flex:1;min-width:0;}' +
        '.bnav-icon{font-size:1.3rem;line-height:1;display:block;transition:transform 0.2s;}' +
        '.bnav-label{font-size:0.55rem;line-height:1;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}' +
        '.bnav-btn:active .bnav-icon{transform:scale(1.2);}' +
        '.bnav-btn.active{color:var(--accent);}' +
        '@media(min-width:901px){#bottomNav{display:none!important;}}' +
        '@media(max-width:900px){#bottomNav{display:block!important;visibility:visible!important;opacity:1!important;}.messages{padding-bottom:140px!important;}.home-page{padding-bottom:100px!important;}}';
    document.head.appendChild(style);
    document.body.appendChild(nav);
}

// ---- #4: Dynamic Bottom Nav (hide on scroll down, show on scroll up) ----
function initScrollNav() {
    var main = document.getElementById('main');
    if (!main) return;
    var lastScrollTop = 0;
    var bnav = document.getElementById('bottomNav');
    if (!bnav) return;

    main.addEventListener('scroll', function() {
        if (window.innerWidth > 900) return;
        var scrollTop = main.scrollTop;
        var scrollDelta = scrollTop - lastScrollTop;
        if (scrollDelta > 10 && scrollTop > 200) {
            bnav.classList.add('nav-hidden');
        } else if (scrollDelta < -5 || scrollTop <= 10) {
            bnav.classList.remove('nav-hidden');
        }
        lastScrollTop = scrollTop;
    }, { passive: true });
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
    if (document.visibilityState !== 'visible') return;
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
    banner.style.cssText = 'position:fixed;top:32px;left:0;right:0;z-index:300;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;padding:10px 16px;text-align:center;font-size:0.85rem;font-weight:700;cursor:pointer;animation:slideInUp 0.3s;';
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
// Helper: date-stamped localStorage (persists across tabs/reloads, resets daily)
var _dcToday = new Date().toISOString().split('T')[0];
function _dcGet(key) {
    return localStorage.getItem(key + '_' + _dcToday) || null;
}
function _dcSet(key, val) {
    localStorage.setItem(key + '_' + _dcToday, val);
}
function _dcGetInt(key) {
    return parseInt(_dcGet(key) || '0', 10);
}
function _dcInc(key) {
    var v = _dcGetInt(key) + 1;
    _dcSet(key, String(v));
    return v;
}
var DAILY_CHALLENGES = [
    { id: 'read', text: '📖 Read a new channel', check: function() { return _dcGet('btc_new_channel_read') === 'true'; } },
    { id: 'nacho', text: '🦌 Ask Nacho a question', check: function() { return _dcGetInt('btc_nacho_asked') > 0; } },
    { id: 'quiz', text: '🎮 Complete a quiz question', check: function() { return _dcGet('btc_quiz_done') === 'true'; } },
    { id: 'explore', text: '🗺️ Visit 3 different channels', check: function() { return _dcGetInt('btc_channels_today') >= 3; } },
    { id: 'forum', text: '🗣️ Visit the PlebTalk', check: function() { return _dcGet('btc_forum_visited') === 'true'; } },
    { id: 'streak', text: '🔥 Log in to keep your streak', check: function() { return true; } }, // Always completable
    { id: 'favorite', text: '⭐ Save a channel to favorites', check: function() { return _dcGet('btc_fav_added') === 'true'; } },
    { id: 'tctv_10m', text: '📺 Watch 10 min of Timechain TV', check: function() { return _dcGetInt('btc_tctv_minutes') >= 10; } },
    { id: 'tctv_visit', text: '📺 Tune in to Timechain TV', check: function() { return _dcGet('btc_tctv_visited') === 'true'; } },
    { id: 'tctv_3ch', text: '📺 Watch 3 different TCTV stations', check: function() { try { var s = _dcGet('btc_tctv_stations_visited'); return s ? JSON.parse(s).length >= 3 : false; } catch(e) { return false; } } },
    { id: 'tctv_30m', text: '📺 Watch 30 min of Timechain TV', check: function() { return _dcGetInt('btc_tctv_minutes') >= 30; } },
    { id: 'tip_send', text: '⚡ Send a Lightning tip to someone', check: function() { return _dcGet('btc_tip_sent') === 'true'; } },
    { id: 'tip_3', text: '⚡ Send 3 Lightning tips today', check: function() { return _dcGetInt('btc_tips_sent_count') >= 3; } },
    { id: 'ln_setup', text: '⚡ Set up your Lightning wallet', check: function() { return !!(localStorage.getItem('btc_nwc_url') || localStorage.getItem('btc_ln_address') || (typeof currentUser !== 'undefined' && currentUser && currentUser.lightningAddress)); } },
    { id: 'chat_msg', text: '🌍 Send a message in Global Chat', check: function() { return _dcGet('btc_chat_sent') === 'true'; } },
    { id: 'pvp_battle', text: '⚔️ Complete a PVP trivia battle', check: function() { return _dcGet('btc_pvp_done') === 'true'; } },
    { id: 'beats_listen', text: '🎸 Listen to a track on Bitcoin Beats', check: function() { return _dcGet('btc_beats_played') === 'true'; } },
    { id: 'explore_5', text: '🗺️ Explore 5 different channels today', check: function() { return _dcGetInt('btc_channels_today') >= 5; } },
    { id: 'nacho_3', text: '🦌 Ask Nacho 3 questions', check: function() { return _dcGetInt('btc_nacho_asked') >= 3; } },
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
            '<span style="font-size:1.3rem;">✅</span>' +
            '<div><div style="color:#22c55e;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Today\'s Challenge ✔️</div>' +
            '<div style="color:var(--text-faint);font-size:0.8rem;"><s>' + challenge.text + '</s> — Done! +100 XP 🎉</div></div></div>';
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
window.checkDailyChallenge = function() {
    var today = new Date().toISOString().split('T')[0];
    if (localStorage.getItem('btc_challenge_done') === today) return;

    var challenge = getDailyChallenge();
    if (challenge.check()) {
        localStorage.setItem('btc_challenge_done', today);
        if (typeof awardPoints === 'function') awardPoints(100, '🎯 Daily challenge!');
        if (typeof awardOrangeTickets === 'function') awardOrangeTickets(5, '🎯 Daily challenge!');
        if (typeof showToast === 'function') showToast('🎯 Daily challenge complete! +100 XP + 🎟️ 5 tickets!');
        haptic('success');
        renderDailyChallenge();
        // Pulse the card to draw attention
        var el = document.getElementById('dailyChallengeCard');
        if (el) {
            el.style.transition = 'transform 0.3s, box-shadow 0.3s';
            el.style.transform = 'scale(1.03)';
            el.style.boxShadow = '0 0 20px rgba(34,197,94,0.4)';
            setTimeout(function() { el.style.transform = ''; el.style.boxShadow = ''; }, 1500);
        }
    }
}
setInterval(window.checkDailyChallenge, 3000);

// =============================================
// Raid Boss Home Card — compact countdown near daily challenge
// =============================================
window._raidHomeUnsub = null;
window._raidHomeTimer = null;

window.renderRaidBossHome = function() {
    var el = document.getElementById('raidBossHomeCard');
    if (!el) return;
    if (typeof firebase === 'undefined' || typeof db === 'undefined') { el.style.display = 'none'; return; }

    // Clean up any previous poll timer (no live listener — use polling to save reads)
    if (window._raidHomeUnsub) { window._raidHomeUnsub(); window._raidHomeUnsub = null; }
    if (window._raidHomeTimer) { clearInterval(window._raidHomeTimer); window._raidHomeTimer = null; }

    function _fetchRaidBossHome() {
        db.collection('raid_bosses')
            .orderBy('startTime', 'desc').limit(5)
            .get()
            .then(function(snap) {
                if (snap.empty) { el.style.display = 'none'; return; }
                var now = Date.now();
                var activeBoss = null;
                var upcomingBoss = null;
                var defeatedBoss = null;
                snap.forEach(function(doc) {
                    var d = doc.data();
                    d.id = doc.id;
                    var startMs = d.startTime && d.startTime.toDate ? d.startTime.toDate().getTime() : 0;
                    var endMs = d.endTime && d.endTime.toDate ? d.endTime.toDate().getTime() : 0;
                    if (!d.placeholder && !d.defeated && startMs <= now && endMs > now) {
                        if (!activeBoss) activeBoss = d;
                    } else if (d.placeholder && startMs > now) {
                        if (!upcomingBoss || startMs < (upcomingBoss.startTime && upcomingBoss.startTime.toDate ? upcomingBoss.startTime.toDate().getTime() : 0)) {
                            upcomingBoss = d;
                        }
                    } else if (d.defeated) {
                        if (!defeatedBoss) defeatedBoss = d;
                    }
                });
                _renderRaidHomeCard(el, activeBoss, upcomingBoss, defeatedBoss);
            })
            .catch(function() { el.style.display = 'none'; });
    }
    _fetchRaidBossHome();
    // Re-poll every 5 minutes — raid bosses don't change per-second
    window._raidHomePollTimer = setInterval(_fetchRaidBossHome, 300000);
};

function _renderRaidHomeCard(el, activeBoss, upcomingBoss, defeatedBoss) {
    if (window._raidHomeTimer) { clearInterval(window._raidHomeTimer); window._raidHomeTimer = null; }

    if (!activeBoss && !upcomingBoss && !defeatedBoss) { el.style.display = 'none'; return; }
    el.style.display = '';

    var openQH = "if(typeof showQuestHub==='function'){showQuestHub();setTimeout(function(){if(typeof window._questHubTab!=='undefined'){window._questHubTab='raid';if(typeof _renderQuestHubTab==='function')_renderQuestHubTab();}},300)}";
    var html = '';

    // Helper: format remaining time
    function _fmtDiff(targetMs) {
        var diff = Math.max(0, targetMs - Date.now());
        if (diff <= 0) return '\u23f3 Any moment now...';
        var d = Math.floor(diff / 86400000);
        var h = Math.floor((diff % 86400000) / 3600000);
        var m = Math.floor((diff % 3600000) / 60000);
        var s = Math.floor((diff % 60000) / 1000);
        if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
        if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
        return m + 'm ' + s + 's';
    }

    if (activeBoss) {
        var endMs = activeBoss.endTime && activeBoss.endTime.toDate ? activeBoss.endTime.toDate().getTime() : 0;
        var pct = activeBoss.target > 0 ? Math.min(100, Math.round((activeBoss.current || 0) / activeBoss.target * 100)) : 0;
        var remainingHP = Math.max(0, (activeBoss.target || 0) - (activeBoss.current || 0));
        var hpPct = Math.max(0, 100 - pct);
        var hpColor = hpPct <= 25 ? '#ef4444' : hpPct <= 50 ? '#f59e0b' : '#22c55e';
        var bossImg = activeBoss.image || '';
        // Client-side image fallback
        if (!bossImg) { var _imgMap = {'Channel-Crawler':'channel-crawler','Quiz-Crusader':'quiz-crusader','TV-Titan':'tv-titan','Beats-Baron':'beats-baron','Flash-Flash':'flash-flash','XP-Hoarder':'xp-hoarder','Poll-Patroller':'poll-patroller','Chat-Charger':'chat-charger','Badge-Builder':'badge-builder','Streak-Sage':'streak-sage','Topic-Explorer':'topic-explorer','Lightning-Lancer':'lightning-lancer','Forum-Forge':'forum-forge','Trivia-Tactician':'trivia-tactician','Content-Conqueror':'content-conqueror'}; if (_imgMap[activeBoss.name]) bossImg = 'https://assets.bitcoineducation.quest/images/raid-bosses/' + _imgMap[activeBoss.name] + '.png'; }

        html += '<div onclick="' + openQH + '" style="background:linear-gradient(135deg,rgba(139,92,246,0.1),rgba(109,40,217,0.04));border:1px solid #8b5cf6;border-radius:12px;padding:12px 16px;cursor:pointer;">' +
            '<div style="display:flex;align-items:center;gap:10px;">' +
                (bossImg ? '<img src="' + bossImg + '" style="width:48px;height:48px;border-radius:10px;object-fit:cover;border:1px solid rgba(139,92,246,0.3);flex-shrink:0;">' : '<span style="font-size:1.3rem;">\u2694\uFE0F</span>') +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="color:#a78bfa;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;">\u2694\uFE0F CURRENT RAID BOSS</div>' +
                    '<div style="color:var(--text);font-size:0.85rem;font-weight:700;">' + (activeBoss.name || 'Raid Boss') + '</div>' +
                    '<div style="background:rgba(100,100,100,0.15);border-radius:6px;height:8px;margin-top:5px;overflow:hidden;"><div style="height:100%;background:' + hpColor + ';border-radius:6px;width:' + hpPct + '%;transition:width 0.5s;"></div></div>' +
                    '<div style="display:flex;justify-content:space-between;margin-top:3px;">' +
                        '<span style="color:' + hpColor + ';font-size:0.68rem;font-weight:700;">\u2764\uFE0F ' + remainingHP + '/' + activeBoss.target + ' HP</span>' +
                        '<span id="raidHomeCountdown" style="color:var(--text-faint);font-size:0.68rem;font-weight:600;">\u23F1 ' + _fmtDiff(endMs) + '</span>' +
                    '</div>' +
                '</div>' +
                '<span style="font-size:1rem;color:var(--text-muted);flex-shrink:0;">\u203A</span>' +
            '</div></div>';

        window._raidActiveEndMs = endMs;
    }

    if (upcomingBoss) {
        var startMs2 = upcomingBoss.startTime && upcomingBoss.startTime.toDate ? upcomingBoss.startTime.toDate().getTime() : 0;
        var dateStr = new Date(startMs2).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        html += '<div onclick="' + openQH + '" style="' + (activeBoss ? 'margin-top:8px;' : '') + 'background:rgba(139,92,246,0.04);border:1px solid rgba(139,92,246,0.2);border-radius:10px;padding:8px 14px;cursor:pointer;">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
                '<span style="font-size:1rem;">\u2694\uFE0F</span>' +
                '<div style="flex:1;"><div style="color:var(--text-muted);font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">NEXT BOSS</div>' +
                '<div style="color:var(--text);font-size:0.8rem;font-weight:600;">' + (upcomingBoss.name || 'TBD') + ' \u2014 ' + dateStr + '</div>' +
                '<div id="raidHomeUpcomingCountdown" style="color:#8b5cf6;font-size:0.7rem;font-weight:600;margin-top:1px;">Starts in ' + _fmtDiff(startMs2) + '</div></div>' +
                '<span style="font-size:0.9rem;color:var(--text-faint);">\u203A</span>' +
            '</div></div>';

        window._raidUpcomingStartMs = startMs2;
    }

    // Defeated boss victory banner on home card
    if (defeatedBoss && !activeBoss) {
        var dName = typeof escapeHtml === 'function' ? escapeHtml(defeatedBoss.name || 'Raid Boss') : (defeatedBoss.name || 'Raid Boss');
        html = '<div onclick="' + openQH + '" style="background:linear-gradient(135deg,rgba(34,197,94,0.1),rgba(34,197,94,0.04));border:1px solid #22c55e;border-radius:12px;padding:12px 16px;cursor:pointer;' + (upcomingBoss ? 'margin-bottom:8px;' : '') + '">' +
            '<div style="display:flex;align-items:center;gap:10px;">' +
                '<span style="font-size:1.5rem;">\uD83D\uDC80</span>' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="color:#22c55e;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;">\uD83C\uDF89 BOSS DEFEATED!</div>' +
                    '<div style="color:var(--text);font-size:0.85rem;font-weight:700;">' + dName + ' has fallen!</div>' +
                    '<div style="color:var(--accent);font-size:0.72rem;font-weight:600;margin-top:2px;">\uD83C\uDFC6 Orange ticket drawing this Friday!</div>' +
                '</div>' +
                '<span style="font-size:1rem;color:var(--text-muted);flex-shrink:0;">\u203A</span>' +
            '</div></div>' + html;
    }

    el.innerHTML = html;

    // Update countdowns every second
    window._raidHomeTimer = setInterval(function() {
        var cdActive = document.getElementById('raidHomeCountdown');
        if (cdActive && window._raidActiveEndMs) cdActive.textContent = '\u23F1 ' + _fmtDiff(window._raidActiveEndMs);
        var cdUp = document.getElementById('raidHomeUpcomingCountdown');
        if (cdUp && window._raidUpcomingStartMs) cdUp.textContent = 'Starts in ' + _fmtDiff(window._raidUpcomingStartMs);
        if (!cdActive && !cdUp) { clearInterval(window._raidHomeTimer); window._raidHomeTimer = null; }
    }, 1000);
}

// Track channel visits for challenge — use a MutationObserver as backup
// so wrapping order doesn't matter
(function() {
    var _lastTrackedId = '';
    window._trackChallengeNav = function(id) {
        if (!id || id === _lastTrackedId) return;
        _lastTrackedId = id;
        if (id === 'forum' || id === 'marketplace' || id === 'bitcoin-beats' || id === 'irl-sync' || id === 'dms') {
            _dcSet('btc_forum_visited', 'true');
        }
        // Note: new-channel detection is handled in the go() wrapper BEFORE
        // the inner go() adds to btc_visited_channels. Don't re-check here
        // (it would always be false since go() already added it).
        // Check challenge immediately after nav
        setTimeout(function() { if (typeof checkDailyChallenge === 'function') checkDailyChallenge(); }, 500);
    };
})();

var _origGoForChallenge = window.go;
if (_origGoForChallenge) {
    // Wrap to track
    var _realGo = window.go;
    window.go = async function(id) {
        // Capture newness BEFORE inner go() adds to visited list
        var isNewChannel = false;
        if (id && id !== 'forum' && id !== 'marketplace' && id !== 'bitcoin-beats' && id !== 'irl-sync' && id !== 'dms') {
            var visited = safeJSON('btc_visited_channels', []);
            isNewChannel = visited.indexOf(id) === -1;
        }
        var result = await _realGo.apply(this, arguments);
        if (typeof window._trackChallengeNav === 'function') window._trackChallengeNav(id);
        if (id && id !== 'forum') {
            _dcInc('btc_channels_today');
            if (isNewChannel) _dcSet('btc_new_channel_read', 'true');
        }
        if (id === 'forum') _dcSet('btc_forum_visited', 'true');
        // Check challenge immediately
        setTimeout(function() { if (typeof checkDailyChallenge === 'function') checkDailyChallenge(); }, 300);
        return result;
    };
}

// Track Nacho questions for daily challenge
var _origNachoUnified = window.nachoUnifiedAnswer;
if (_origNachoUnified) {
    window.nachoUnifiedAnswer = function(q, cb) {
        _dcInc('btc_nacho_asked');
        return _origNachoUnified.apply(this, arguments);
    };
}

// Hashchange fallback — catches navigation even if go() wrapper is overridden
window.addEventListener('hashchange', function() {
    var h = location.hash.slice(1);
    if (h && typeof window._trackChallengeNav === 'function') window._trackChallengeNav(h);
});

// Quiz + Favorite tracking moved to index.html (inline definitions)
// Wrappers here can't work because those functions are defined after this file loads

// ---- #12: Progress Rings on Homepage ----
window.renderProgressRings = function() {
    var el = document.getElementById('progressRings');
    if (!el) return;

    var totalChannels = typeof CHANNELS !== 'undefined' ? Object.keys(CHANNELS).length : 146;
    // Use Firestore data first, fall back to localStorage
    var visited = 0;
    if (typeof currentUser !== 'undefined' && currentUser) {
        if (currentUser.readChannels && currentUser.readChannels.length) {
            visited = currentUser.readChannels.length;
        } else if (currentUser.channelsVisited) {
            visited = currentUser.channelsVisited;
        }
    }
    if (visited === 0) {
        visited = safeJSON('btc_visited_channels', []).length;
    }
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
        ring(Math.min(100, (visited / totalChannels) * 100), '#f7931a', 'Topics', visited + '/' + totalChannels) +
        ring(Math.min(100, streak * 5), '#22c55e', 'Streak', '🔥' + streak) +
        ring(Math.min(100, (points / 21000) * 100), '#8B5CF6', 'XP', points > 999 ? Math.floor(points/1000) + 'k' : points) +
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
// ---- PWA Install Prompt ----
var _deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    _deferredInstallPrompt = e;
    // Hybrid trigger: 90s on app + 3 channels visited
    if (!window.matchMedia('(display-mode: standalone)').matches) {
        var dismissed = localStorage.getItem('btc_pwa_dismissed');
        if (dismissed && Date.now() - parseInt(dismissed) < 7 * 86400000) return;
        window._pwaLoadTime = Date.now();
        // Check every 10s once the 90s floor is met
        window._pwaCheckInterval = setInterval(function() {
            var elapsed = Date.now() - (window._pwaLoadTime || Date.now());
            if (elapsed < 90000) return; // 90 second floor
            var visited = [];
            try { visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]'); } catch(e) {}
            if (visited.length >= 3) {
                clearInterval(window._pwaCheckInterval);
                showPWAInstallBanner();
            }
        }, 10000);
    }
});

function showPWAInstallBanner() {
    if (document.getElementById('pwaInstallBanner')) return;
    var banner = document.createElement('div');
    banner.id = 'pwaInstallBanner';
    banner.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:99999;background:linear-gradient(135deg,#1a1a2e,#16213e);border:2px solid #f7931a;border-radius:16px;padding:16px 20px;max-width:340px;width:90%;box-shadow:0 8px 32px rgba(247,147,26,0.3);animation:slideUp 0.4s ease;font-family:inherit;';
    banner.innerHTML = '<div style="display:flex;align-items:center;gap:12px;">' +
        '<div style="font-size:2rem;">🦌</div>' +
        '<div style="flex:1;">' +
            '<div style="color:#f7931a;font-weight:700;font-size:0.95rem;margin-bottom:4px;">Install Bitcoin Education</div>' +
            '<div style="color:#ccc;font-size:0.8rem;">Add to home screen for the best experience — works offline!</div>' +
        '</div>' +
        '<button onclick="dismissPWABanner()" style="background:none;border:none;color:#888;font-size:1.2rem;cursor:pointer;padding:4px;">✕</button>' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:12px;">' +
        '<button onclick="installPWA()" style="flex:1;padding:10px;background:#f7931a;border:none;border-radius:10px;color:#fff;font-weight:700;font-size:0.9rem;cursor:pointer;font-family:inherit;">Install App</button>' +
        '<button onclick="dismissPWABanner()" style="padding:10px 16px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:#ccc;font-size:0.85rem;cursor:pointer;font-family:inherit;">Not now</button>' +
    '</div>';
    // Add slideUp animation
    if (!document.getElementById('pwaAnimStyle')) {
        var style = document.createElement('style');
        style.id = 'pwaAnimStyle';
        style.textContent = '@keyframes slideUp{from{transform:translateX(-50%) translateY(100px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}';
        document.head.appendChild(style);
    }
    document.body.appendChild(banner);
}

window.installPWA = function() {
    if (_deferredInstallPrompt) {
        _deferredInstallPrompt.prompt();
        _deferredInstallPrompt.userChoice.then(function(result) {
            if (result.outcome === 'accepted') {
                if (typeof showToast === 'function') showToast('🦌 Welcome aboard! App installed!');
            }
            _deferredInstallPrompt = null;
        });
    }
    dismissPWABanner();
};

window.dismissPWABanner = function() {
    var banner = document.getElementById('pwaInstallBanner');
    if (banner) banner.remove();
    localStorage.setItem('btc_pwa_dismissed', Date.now().toString());
};

// ---- iOS "Add to Home Screen" Hint ----
(function() {
    // Only show on iOS Safari, not in standalone mode, not already dismissed
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|Chrome/.test(navigator.userAgent);
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (!isIOS || !isSafari || isStandalone) return;
    var dismissed = localStorage.getItem('btc_ios_a2hs_dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 30 * 86400000) return; // 30 days
    setTimeout(function() {
        if (document.getElementById('iosA2HSBanner')) return;
        var banner = document.createElement('div');
        banner.id = 'iosA2HSBanner';
        banner.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:99999;background:linear-gradient(135deg,#1a1a2e,#16213e);border:2px solid #f7931a;border-radius:16px;padding:16px 20px;max-width:340px;width:90%;box-shadow:0 8px 32px rgba(247,147,26,0.3);animation:slideUp 0.4s ease;font-family:inherit;';
        banner.innerHTML =
            '<div style="display:flex;align-items:flex-start;gap:12px;">' +
                '<div style="font-size:2rem;flex-shrink:0;">🦌</div>' +
                '<div style="flex:1;">' +
                    '<div style="color:#f7931a;font-weight:700;font-size:0.95rem;margin-bottom:4px;">Add to Home Screen</div>' +
                    '<div style="color:#ccc;font-size:0.8rem;line-height:1.5;">For the best experience, add this app to your home screen:</div>' +
                    '<div style="color:#94a3b8;font-size:0.78rem;line-height:1.6;margin-top:8px;">' +
                        '1. Tap the <strong style="color:#fff;">Share</strong> button <span style="font-size:1rem;vertical-align:middle;">⬆️</span> at the bottom<br>' +
                        '2. Scroll down and tap <strong style="color:#fff;">Add to Home Screen</strong>' +
                    '</div>' +
                '</div>' +
                '<button onclick="dismissIOSA2HS()" style="background:none;border:none;color:#888;font-size:1.2rem;cursor:pointer;padding:4px;flex-shrink:0;touch-action:manipulation;">✕</button>' +
            '</div>' +
            '<button onclick="dismissIOSA2HS()" style="width:100%;margin-top:12px;padding:10px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:#ccc;font-size:0.85rem;cursor:pointer;font-family:inherit;touch-action:manipulation;">Got it!</button>';
        if (!document.getElementById('pwaAnimStyle')) {
            var style = document.createElement('style');
            style.id = 'pwaAnimStyle';
            style.textContent = '@keyframes slideUp{from{transform:translateX(-50%) translateY(100px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}';
            document.head.appendChild(style);
        }
        document.body.appendChild(banner);
    }, 120000); // 120 seconds
})();

window.dismissIOSA2HS = function() {
    var banner = document.getElementById('iosA2HSBanner');
    if (banner) banner.remove();
    localStorage.setItem('btc_ios_a2hs_dismissed', Date.now().toString());
};

// ---- Mobile Learn Menu ----
window.toggleMobileLearnMenu = function() {
    var existing = document.getElementById('mobileLearnMenu');
    if (existing) { existing.remove(); return; }

    // Close apps menu if open
    var appsMenu = document.getElementById('appsMenu');
    if (appsMenu) appsMenu.remove();

    var menu = document.createElement('div');
    menu.id = 'mobileLearnMenu';
    menu.style.cssText = 'position:fixed;bottom:70px;left:8px;right:8px;z-index:250;' +
        'max-width:400px;margin:0 auto;' +
        'background:var(--bg-side,#0f0f23);border:1px solid var(--border);border-radius:20px;' +
        'padding:18px;box-shadow:0 -8px 40px rgba(0,0,0,0.6);' +
        'animation:fadeSlideIn 0.25s ease-out;';

    menu.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
            '<h3 style="color:var(--heading);font-size:1.05rem;font-weight:800;margin:0;">🎓 Learn</h3>' +
            '<button onclick="document.getElementById(\'mobileLearnMenu\').remove()" style="background:none;border:none;color:var(--text-faint);font-size:1.2rem;cursor:pointer;padding:4px;">✕</button>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
            '<button onclick="document.getElementById(\'mobileLearnMenu\').remove();go(\'one-stop-shop\')" style="padding:11px 14px;background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(37,99,235,0.08));border:1px solid #3b82f6;color:#3b82f6;border-radius:12px;font-weight:800;cursor:pointer;font-size:0.88rem;text-align:left;font-family:inherit;touch-action:manipulation;display:flex;align-items:flex-start;gap:10px;width:100%;"><span style="font-size:1.1rem;flex-shrink:0;line-height:1.4;">🟢</span><span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;"><span style="display:flex;align-items:center;gap:6px;">Brand New to Bitcoin?<span style="margin-left:auto;font-size:0.65rem;opacity:0.75;flex-shrink:0;">⭐ Start here</span></span><span style="font-size:0.72rem;font-weight:500;color:rgba(255,255,255,0.45);line-height:1.4;white-space:normal;">Zero jargon intro — start here if you\'ve never owned BTC</span></span></button><button onclick="document.getElementById(\'mobileLearnMenu\').remove();go(\'learning-quests\')" style="padding:11px 14px;background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(5,150,105,0.06));border:1px solid #10b981;color:#10b981;border-radius:12px;font-weight:800;cursor:pointer;font-size:0.88rem;text-align:left;font-family:inherit;touch-action:manipulation;display:flex;align-items:flex-start;gap:10px;width:100%;"><span style="font-size:1.1rem;flex-shrink:0;line-height:1.4;">📖</span><span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;"><span style="display:flex;align-items:center;gap:6px;">Learning Quests<span style="margin-left:auto;font-size:0.65rem;opacity:0.75;flex-shrink:0;">8 topics ▸</span></span><span style="font-size:0.72rem;font-weight:500;color:rgba(255,255,255,0.45);line-height:1.4;white-space:normal;">Slideshow lessons with key stats, graphics &amp; a quiz. 8 topics.</span></span></button><button onclick="document.getElementById(\'mobileLearnMenu\').remove();go(\'trails\')" style="padding:11px 14px;background:linear-gradient(135deg,rgba(247,147,26,0.1),rgba(234,88,12,0.05));border:1px solid var(--accent);color:var(--accent);border-radius:12px;font-weight:800;cursor:pointer;font-size:0.88rem;text-align:left;font-family:inherit;touch-action:manipulation;display:flex;align-items:flex-start;gap:10px;width:100%;"><span style="font-size:1.1rem;flex-shrink:0;line-height:1.4;">🦌🗺️</span><span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;"><span style="display:flex;align-items:center;gap:6px;">Nacho\'s Trails</span><span style="font-size:0.72rem;font-weight:500;color:rgba(255,255,255,0.45);line-height:1.4;white-space:normal;">Guided learning paths — Meadow, Mountain &amp; Summit levels</span></span></button><button onclick="document.getElementById(\'mobileLearnMenu\').remove();setTimeout(function(){if(typeof showQuestHub===\'function\')showQuestHub()},200)" style="padding:11px 14px;background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(109,40,217,0.08));border:1px solid #8b5cf6;color:#a78bfa;border-radius:12px;font-weight:800;cursor:pointer;font-size:0.88rem;text-align:left;font-family:inherit;touch-action:manipulation;display:flex;align-items:flex-start;gap:10px;width:100%;"><span style="font-size:1.1rem;flex-shrink:0;line-height:1.4;">🎯</span><span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;"><span style="display:flex;align-items:center;gap:6px;">Daily Quests</span><span style="font-size:0.72rem;font-weight:500;color:rgba(255,255,255,0.45);line-height:1.4;white-space:normal;">Daily quizzes, trivia &amp; polls — earn XP and climb the leaderboard</span></span></button><button onclick="document.getElementById(\'mobileLearnMenu\').remove();go(\'first-purchase\')" style="padding:11px 14px;background:linear-gradient(135deg,rgba(34,197,94,0.12),rgba(22,163,74,0.06));border:1px solid #22c55e;color:#22c55e;border-radius:12px;font-weight:800;cursor:pointer;font-size:0.88rem;text-align:left;font-family:inherit;touch-action:manipulation;display:flex;align-items:flex-start;gap:10px;width:100%;"><span style="font-size:1.1rem;flex-shrink:0;line-height:1.4;">🛒</span><span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;"><span style="display:flex;align-items:center;gap:6px;">Your First Bitcoin Purchase</span><span style="font-size:0.72rem;font-weight:500;color:rgba(255,255,255,0.45);line-height:1.4;white-space:normal;">Step-by-step guide to buying BTC safely from a trusted exchange</span></span></button><button onclick="document.getElementById(\'mobileLearnMenu\').remove();window._mbRouted=true;window._skipIRLRules=true;localStorage.setItem(\'btc_irl_rules_accepted\',\'true\');go(\'irl-sync\');setTimeout(function(){var ro=document.getElementById(\'irlRulesOverlay\');if(ro)ro.remove();var _t=0;var _i=setInterval(function(){var ro2=document.getElementById(\'irlRulesOverlay\');if(ro2)ro2.remove();var el=document.getElementById(\'meetupBuilderSection\');if(el){clearInterval(_i);el.scrollIntoView({behavior:\'smooth\',block:\'start\'});}if(++_t>30)clearInterval(_i);},300);},1500)" style="padding:11px 14px;background:linear-gradient(135deg,rgba(234,179,8,0.12),rgba(202,138,4,0.06));border:1px solid #eab308;color:#eab308;border-radius:12px;font-weight:800;cursor:pointer;font-size:0.88rem;text-align:left;font-family:inherit;touch-action:manipulation;display:flex;align-items:flex-start;gap:10px;width:100%;"><span style="font-size:1.1rem;flex-shrink:0;line-height:1.4;">🔨</span><span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;"><span style="display:flex;align-items:center;gap:6px;">Meetup Builder</span><span style="font-size:0.72rem;font-weight:500;color:rgba(255,255,255,0.45);line-height:1.4;white-space:normal;">Create or find a local Bitcoin meetup in your city</span></span></button><button onclick="document.getElementById(\'mobileLearnMenu\').remove();go(\'marketplace\');setTimeout(function(){renderMarketplace({section:\'merchants\'})},500)" style="padding:11px 14px;background:linear-gradient(135deg,rgba(239,68,68,0.15),rgba(220,38,38,0.08));border:1px solid #ef4444;color:#ef4444;border-radius:12px;font-weight:800;cursor:pointer;font-size:0.88rem;text-align:left;font-family:inherit;touch-action:manipulation;display:flex;align-items:flex-start;gap:10px;width:100%;"><span style="font-size:1.1rem;flex-shrink:0;line-height:1.4;">₿</span><span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;"><span style="display:flex;align-items:center;gap:6px;">Spend Bitcoin</span><span style="font-size:0.72rem;font-weight:500;color:rgba(255,255,255,0.45);line-height:1.4;white-space:normal;">Find merchants who accept sats — Lightning, on-chain &amp; more</span></span></button><button onclick="document.getElementById(\'mobileLearnMenu\').remove();toggleMenu()" style="padding:11px 14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-weight:800;cursor:pointer;font-size:0.88rem;text-align:left;font-family:inherit;touch-action:manipulation;display:flex;align-items:flex-start;gap:10px;width:100%;"><span style="font-size:1.1rem;flex-shrink:0;line-height:1.4;">📚</span><span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;"><span style="display:flex;align-items:center;gap:6px;">Browse All Topics <span style="margin-left:auto;font-size:0.65rem;opacity:0.75;flex-shrink:0;">146 ▸</span></span><span style="font-size:0.72rem;font-weight:500;color:rgba(255,255,255,0.7);line-height:1.4;">146 curated channels of Bitcoin education</span></span></button>' +
        '</div>';

    document.body.appendChild(menu);

    // Close on outside tap
    setTimeout(function() {
        document.addEventListener('click', function closeMLearn(e) {
            var m = document.getElementById('mobileLearnMenu');
            if (m && !m.contains(e.target) && !e.target.closest('#bnavLearn')) {
                m.remove();
                document.removeEventListener('click', closeMLearn);
            }
        });
    }, 100);
};

window.toggleMobileFlashcards = function() {
    var grid = document.getElementById('mLearnFlashGrid');
    var btn = document.getElementById('mLearnFlashBtn');
    if (!grid) return;
    if (grid.style.display === 'none') {
        grid.style.display = 'flex';
        if (btn) btn.textContent = '📚 Flashcards ▼';
    } else {
        grid.style.display = 'none';
        if (btn) btn.textContent = '📚 Flashcards ▶';
    }
};

function initMobileUX() {
    console.log('[MobileUX] Initializing...');
    initBottomNav();
    initScrollNav();

    // Wait for user data to load
    setTimeout(function() {
        showStreakBanner();
        showWelcomeBack();
        renderDailyChallenge();
        if (typeof renderRaidBossHome === 'function') renderRaidBossHome();
        if (typeof renderProgressRings === 'function') renderProgressRings();
    }, 2500);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileUX);
} else {
    initMobileUX();
}

})();
