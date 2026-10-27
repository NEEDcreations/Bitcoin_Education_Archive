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
            '<button type="button" onclick="window.toggleAppsMenu(event)" class="bnav-btn" id="bnavApps" aria-expanded="false" aria-controls="appsMenu"><span class="bnav-icon">🧭</span><span class="bnav-label" style="line-height:1.1;font-size:0.55rem;">Explore<br>Apps</span></button>' +
            '<button type="button" onclick="toggleMobileLearnMenu()" class="bnav-btn" id="bnavLearn" aria-expanded="false" aria-controls="mobileLearnMenu" style="position:relative;"><span class="bnav-icon">🎓</span><span class="bnav-label">Learn</span></button>' +
            '<button onclick="if(typeof toggleNotifOverlay===\'function\')toggleNotifOverlay()" class="bnav-btn" id="bnavNotif" style="position:relative;"><span class="bnav-icon">🔔</span><span class="bnav-label">Alerts</span><span id="bnavNotifBadge" style="display:none;position:absolute;top:2px;right:4px;background:#ef4444;color:#fff;font-size:0.55rem;font-weight:800;padding:1px 4px;border-radius:6px;min-width:12px;text-align:center;"></span></button>' +
            '<button onclick="if(typeof showSettings===\'function\')showSettings()" class="bnav-btn" id="bnavSettings" style="position:relative;"><span class="bnav-icon">⚙️</span><span class="bnav-label">Settings</span><span class="whats-new-dot" hidden></span></button>' +
        '</div>';

    // Add styles
    var style = document.createElement('style');
    style.textContent =
        '.bnav-btn{background:none;border:none;color:var(--text-dim,#666);font-size:0.6rem;cursor:pointer;font-family:inherit;padding:6px 0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:0.2s;flex:1;min-width:0;min-height:44px;}' +
        '.bnav-icon{font-size:1.3rem;line-height:1;display:block;transition:transform 0.2s;}' +
        '.bnav-label{font-size:0.55rem;line-height:1;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}' +
        '.bnav-btn:active .bnav-icon{transform:scale(1.2);}' +
        '.bnav-btn.active{color:var(--accent);}' +
        '@media(min-width:901px){#bottomNav{display:none!important;}}' +
        '@media(max-width:900px){#bottomNav{display:block!important;visibility:visible!important;opacity:1!important;}' +
        '#main{padding-bottom:calc(var(--above-fab, calc(72px + env(safe-area-inset-bottom, 0px) + 12px + 48px + 12px)) + 44px + var(--fab-gap, 12px))!important;}}';
    document.head.appendChild(style);
    document.body.appendChild(nav);
    watchBottomNavHeight();
    if (typeof window._applyWhatsNew === 'function') window._applyWhatsNew();
}

// --bnav-h is the nav's height above the safe-area inset. CSS adds
// env(safe-area-inset-bottom) so the FAB gap tracks both pieces.
function readSafeAreaBottom() {
    var probe = document.getElementById('bqSafeAreaProbe');
    if (!probe) {
        probe = document.createElement('div');
        probe.id = 'bqSafeAreaProbe';
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden;';
        document.body.appendChild(probe);
    }
    return probe.getBoundingClientRect().height || 0;
}

function syncBottomNavHeight() {
    var root = document.documentElement;
    if (window.innerWidth > 900) {
        root.style.setProperty('--bnav-h', '0px');
        return;
    }
    var nav = document.getElementById('bottomNav');
    if (!nav) return;
    var full = nav.getBoundingClientRect().height;
    if (!(full > 0)) return;
    var above = Math.max(0, Math.round((full - readSafeAreaBottom()) * 100) / 100);
    root.style.setProperty('--bnav-h', above + 'px');
}

function watchBottomNavHeight() {
    syncBottomNavHeight();
    var nav = document.getElementById('bottomNav');
    if (nav && window.ResizeObserver && !nav._bnavWatch) {
        nav._bnavWatch = true;
        new ResizeObserver(function() { syncBottomNavHeight(); }).observe(nav);
    }
    if (!window._bnavResizeBound) {
        window._bnavResizeBound = true;
        window.addEventListener('resize', syncBottomNavHeight);
        window.addEventListener('orientationchange', syncBottomNavHeight);
    }
}

// Hide the floating row while a chat or DM composer is in use, and while
// Nacho Mode or an open composer would sit under the buttons.
function syncFabHold() {
    if (window.innerWidth > 900) {
        document.body.classList.remove('kb-open');
        document.body.classList.remove('fab-hold');
        return;
    }
    function shown(el) {
        if (!el || !el.getClientRects || !el.getClientRects().length) return false;
        var overlay = el.closest && el.closest('#chatOverlay');
        if (overlay && !document.body.classList.contains('chat-panel-open')) return false;
        return true;
    }
    var active = document.activeElement;
    var typing = !!(active && active.matches && active.matches('#globalChatInput, #dmInput') && shown(active));
    var vv = window.visualViewport;
    var keyboard = !!(typing && vv && vv.height < window.innerHeight - 80);
    document.body.classList.toggle('kb-open', typing || keyboard);

    var overlayOpen = document.body.classList.contains('chat-panel-open');
    var hub = document.getElementById('chatContent');
    var hubOpen = !!(hub && shown(hub) && !(hub.closest && hub.closest('#chatOverlay')));
    var dmOpen = shown(document.getElementById('dmInput'));
    var nachoMode = !!document.getElementById('nachoModeScreen');
    document.body.classList.toggle('fab-hold', overlayOpen || hubOpen || dmOpen || nachoMode || typing);
}
window.syncFabHold = syncFabHold;

function initComposerKeyboard() {
    if (window._fabHoldBound) return;
    window._fabHoldBound = true;
    document.addEventListener('focusin', syncFabHold);
    document.addEventListener('focusout', function() { setTimeout(syncFabHold, 60); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', syncFabHold);
    var fabHoldTimer = null;
    new MutationObserver(function() {
        clearTimeout(fabHoldTimer);
        fabHoldTimer = setTimeout(syncFabHold, 40);
    }).observe(document.body, { childList: true, subtree: true });
    syncFabHold();
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
    var streakMode = 'advanced';
    try {
        streakMode = (typeof window.getExperienceMode === 'function' && window.getExperienceMode()) || localStorage.getItem('btc_experience_mode') || 'advanced';
    } catch (eStreak) {}
    if (streakMode === 'lite') return;
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
        if (typeof showToast === 'function') showToast('🎯 Daily challenge complete! +100 XP');
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
    var raidLine = document.getElementById('todayRaidLine');
    if (raidLine) {
        if (activeBoss) {
            raidLine.textContent = '⚔️ Raid: ' + (activeBoss.name || 'Boss') + ' ' + (activeBoss.current || 0) + '/' + (activeBoss.target || 0);
        } else if (upcomingBoss) {
            raidLine.textContent = '⚔️ Raid: ' + (upcomingBoss.name || 'soon');
        }
        raidLine.hidden = false;
    }

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

    var totalChannels = typeof CHANNELS !== 'undefined' ? Object.keys(CHANNELS).length : 145;
    // Display only. getExploredCount uses the server-written visited list.
    var visited = window.getExploredCount ? window.getExploredCount() : safeJSON('btc_visited_channels', []).length;
    if (visited > totalChannels) visited = totalChannels;
    var streak = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.streak || 0 : 0;
    var points = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.points || 0 : 0;
    var interactions = parseInt(localStorage.getItem('btc_nacho_interactions') || '0');
    var sfHashes = (typeof currentUser !== 'undefined' && currentUser && typeof currentUser.sfTotalHashes === 'number') ? currentUser.sfTotalHashes : 0;

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

    el.innerHTML = '<div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">' +
        ring(Math.min(100, (visited / totalChannels) * 100), '#f7931a', 'Topics', visited + '/' + totalChannels) +
        ring(Math.min(100, streak * 5), '#22c55e', 'Streak', '🔥' + streak) +
        ring(Math.min(100, (points / 21000) * 100), '#8B5CF6', 'XP', points > 999 ? Math.floor(points/1000) + 'k' : points) +
        ring(Math.min(100, interactions * 2), '#3B82F6', 'Nacho', interactions) +
        ring(Math.min(100, sfHashes / 1000 * 100), '#eab308', 'Hashes', sfHashes > 999 ? Math.floor(sfHashes / 1000) + 'k' : sfHashes) +
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
    banner.style.cssText = 'position:fixed;bottom:var(--above-fab, calc(72px + env(safe-area-inset-bottom, 0px) + 12px + 48px + 12px));left:50%;transform:translateX(-50%);z-index:99999;background:linear-gradient(135deg,#1a1a2e,#16213e);border:2px solid #f7931a;border-radius:16px;padding:16px 20px;max-width:340px;width:90%;box-shadow:0 8px 32px rgba(247,147,26,0.3);animation:slideUp 0.4s ease;font-family:inherit;';
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
        banner.style.cssText = 'position:fixed;bottom:var(--above-fab, calc(72px + env(safe-area-inset-bottom, 0px) + 12px + 48px + 12px));left:50%;transform:translateX(-50%);z-index:99999;background:linear-gradient(135deg,#1a1a2e,#16213e);border:2px solid #f7931a;border-radius:16px;padding:16px 20px;max-width:340px;width:90%;box-shadow:0 8px 32px rgba(247,147,26,0.3);animation:slideUp 0.4s ease;font-family:inherit;';
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

// ---- Mobile Learn + Explore Apps ----
// Phone sheets and desktop #homeLearnMenu / #homeAppsMenu both render
// window.BQ_LEARN_MENU and window.BQ_EXPLORE_APPS from features.registry.js.
// Wallet taps wait until wallet-router.js has patched go().
var MOBILE_SHEET_Z = '2100020';
window.SCHOLAR_SCRIPT = 'scholar.js?v=20261026_v2377';

function ensureMobileSheetStyle() {
    if (document.getElementById('mobileSheetStyle')) return;
    var style = document.createElement('style');
    style.id = 'mobileSheetStyle';
    style.textContent =
        '@media(max-width:900px){' +
        '#mobileLearnMenu,#appsMenu{z-index:' + MOBILE_SHEET_Z + '!important;}' +
        '#questHubOverlay,#questModal,#aiToolsPanel,#leaderboard,#btcDashOverlay{z-index:2100030!important;}' +
        '#aiToolsPanel{bottom:var(--bnav-h,72px)!important;}' +
        '#btcDashOverlay{padding-bottom:calc(var(--above-fab,160px) + 16px)!important;}' +
        '#mobileLearnMenu button,#appsMenu button{min-height:44px;}' +
        '}' +
        '@media(max-width:360px){' +
        '#appsMenu > div{grid-template-columns:1fr!important;}' +
        '}';
    (document.head || document.documentElement).appendChild(style);
}

function mobileExperienceMode() {
    var mode = '';
    try {
        if (typeof window.getExperienceMode === 'function') mode = window.getExperienceMode() || '';
    } catch (e) {}
    if (!mode) {
        try { mode = localStorage.getItem('btc_experience_mode') || ''; } catch (e2) {}
    }
    if (mode === 'lite' || mode === 'beginner' || mode === 'intermediate' || mode === 'advanced') return mode;
    return 'advanced';
}

function experienceModeName(mode) {
    if (typeof window.bqExperienceModeMeta === 'function') return window.bqExperienceModeMeta(mode).name;
    if (mode === 'lite') return 'Lite';
    if (mode === 'beginner') return 'Guided';
    if (mode === 'intermediate') return 'Balanced';
    return 'Everything';
}

function openExperienceModeSettings() {
    if (typeof window.bqOpenExperienceModeSettings === 'function') {
        window.bqOpenExperienceModeSettings();
        return;
    }
    closeMobileSheets();
    var desk = document.getElementById('homeAppsMenu');
    if (desk) desk.style.display = 'none';
    if (typeof showSettings === 'function') showSettings();
    setTimeout(function() {
        if (typeof showSettingsPage === 'function') showSettingsPage('prefs');
        setTimeout(function() {
            var card = document.getElementById('experienceModeCard');
            if (card && card.scrollIntoView) card.scrollIntoView({ block: 'center' });
        }, 220);
    }, 150);
}

function appendHiddenAppsHint(parent, mode) {
    var count = 0;
    if (typeof window.bqHiddenExploreAppCount === 'function') count = window.bqHiddenExploreAppCount(mode);
    else {
        (window.BQ_EXPLORE_APPS || []).forEach(function(item) {
            if (item.modes && item.modes.indexOf(mode) === -1) count++;
        });
    }
    if (!count) return;
    var line = document.createElement('p');
    line.className = 'bq-hidden-apps';
    line.style.cssText = 'grid-column:1 / -1;margin:8px 0 0;font-size:0.78rem;line-height:1.4;color:var(--text-muted);font-weight:600;';
    var text = document.createElement('span');
    text.textContent = count + ' apps hidden in ' + experienceModeName(mode) + ' mode, ';
    var show = document.createElement('button');
    show.type = 'button';
    show.textContent = 'Show all';
    show.style.cssText = 'background:none;border:none;padding:0;min-height:44px;color:var(--accent,#f7931a);font:inherit;font-weight:800;cursor:pointer;text-decoration:underline;';
    show.addEventListener('click', function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        openExperienceModeSettings();
    });
    line.appendChild(text);
    line.appendChild(show);
    parent.appendChild(line);
}

function appVisibleInMode(item, mode) {
    return !item.modes || item.modes.indexOf(mode) !== -1;
}

window.exploreAppsForMode = function(mode) {
    var which = mode || mobileExperienceMode();
    var apps = window.BQ_EXPLORE_APPS || [];
    var out = [];
    var i;
    for (i = 0; i < apps.length; i++) {
        if (appVisibleInMode(apps[i], which)) out.push(apps[i]);
    }
    return out;
};

function mobileSheetBox() {
    // Bottom stays above the chat button and the bottom bar (--above-fab).
    // The sheet grows up to 70vh so a short phone shows more than a fixed top gap allows.
    return 'position:fixed;left:8px;right:8px;' +
        'top:max(8px, calc(100dvh - var(--above-fab, 160px) - 70vh));' +
        'bottom:var(--above-fab, 160px);' +
        'max-height:70vh;' +
        'max-width:420px;margin:0 auto;z-index:' + MOBILE_SHEET_Z + ';' +
        'overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;' +
        'background:var(--bg-side,#0f172a);border:1px solid var(--border);border-radius:20px;' +
        'padding:14px 14px 16px;box-shadow:0 16px 48px rgba(0,0,0,0.55);';
}

function sheetFocusables(menu) {
    var nodes = menu.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    var out = [];
    var i;
    for (i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.disabled || el.getAttribute('aria-hidden') === 'true') continue;
        out.push(el);
    }
    return out;
}

function dismissSheet(menu, opts) {
    if (!menu || !menu.isConnected) return;
    var skipFocus = opts && opts.skipFocus;
    var sel = menu.getAttribute('data-return-focus');
    if (menu._detachDismiss) menu._detachDismiss();
    menu.remove();
    var returnBtn = sel && document.querySelector(sel);
    if (returnBtn) returnBtn.setAttribute('aria-expanded', 'false');
    if (skipFocus) return;
    if (document.getElementById('mobileLearnMenu') || document.getElementById('appsMenu')) return;
    if (returnBtn && returnBtn.focus) returnBtn.focus();
}

function bindSheetDismiss(menu, toggleSelector) {
    menu.setAttribute('data-return-focus', toggleSelector);
    function detach() {
        document.removeEventListener('click', onDoc);
        document.removeEventListener('keydown', onKey);
    }
    function onDoc(e) {
        if (!menu.isConnected) { detach(); return; }
        if (menu.contains(e.target)) return;
        if (toggleSelector && e.target.closest && e.target.closest(toggleSelector)) return;
        dismissSheet(menu);
    }
    function onKey(e) {
        if (!menu.isConnected) { detach(); return; }
        if (e.key === 'Tab') {
            var items = sheetFocusables(menu);
            if (!items.length) { e.preventDefault(); return; }
            var first = items[0];
            var last = items[items.length - 1];
            var active = document.activeElement;
            if (items.indexOf(active) === -1) {
                e.preventDefault();
                (e.shiftKey ? last : first).focus();
                return;
            }
            if (e.shiftKey && active === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
            return;
        }
        if (e.key !== 'Escape') return;
        if (window._bqEscapeTop && window._bqEscapeTop !== 'sheet') return;
        e.preventDefault();
        dismissSheet(menu);
    }
    menu._detachDismiss = detach;
    setTimeout(function() {
        if (!menu.isConnected) return;
        document.addEventListener('click', onDoc);
        document.addEventListener('keydown', onKey);
    }, 0);
    return detach;
}

function closeMobileSheets() {
    var learn = document.getElementById('mobileLearnMenu');
    if (learn) dismissSheet(learn);
    var apps = document.getElementById('appsMenu');
    if (apps) dismissSheet(apps);
}

function loadScriptOnce(src, done, onError) {
    if (typeof window._loadDeferred === 'function') window._loadDeferred();
    var existing = document.querySelector('script[src="' + src + '"]');
    if (existing && existing.getAttribute('data-failed') === '1') {
        existing.remove();
        existing = null;
    }
    function markLoaded(script) {
        script.setAttribute('data-loaded', '1');
        if (done) done();
    }
    function markFailed(script) {
        script.setAttribute('data-failed', '1');
        if (onError) setTimeout(onError, 0);
    }
    if (!existing) {
        var script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.addEventListener('load', function() { markLoaded(script); });
        script.addEventListener('error', function() { markFailed(script); });
        document.body.appendChild(script);
        return;
    }
    if (existing.getAttribute('data-loaded') === '1') {
        if (done) done();
        return;
    }
    existing.addEventListener('load', function() { markLoaded(existing); });
    existing.addEventListener('error', function() { markFailed(existing); });
}

function pollUntil(ready, limit, onTimeout) {
    if (ready()) return;
    var n = 0;
    var max = limit || 40;
    var timer = setInterval(function() {
        n += 1;
        if (ready()) {
            clearInterval(timer);
            return;
        }
        if (n > max) {
            clearInterval(timer);
            if (onTimeout) onTimeout();
        }
    }, 100);
}

window.openCertification = function(type) {
    var kind = type === 'technical' ? 'technical' : 'properties';
    function start() {
        if (typeof window.startScholarQuest !== 'function') return false;
        window.startScholarQuest(kind);
        return true;
    }
    if (start()) return;
    var src = window.SCHOLAR_SCRIPT || 'scholar.js';
    var existing = document.querySelector('script[src="' + src + '"]') || document.querySelector('script[src^="scholar.js"]');
    if (existing) {
        existing.addEventListener('load', function() { start(); });
        pollUntil(start, 50);
        return;
    }
    loadScriptOnce(src, start);
    pollUntil(start, 50);
};

window.openMeetupBuilder = function() {
    window._mbRouted = true;
    window._skipIRLRules = true;
    try { localStorage.setItem('btc_irl_rules_accepted', 'true'); } catch (e) {}
    if (typeof window._loadDeferred === 'function') window._loadDeferred();
    if (typeof go === 'function') go('irl-sync');
    setTimeout(function() {
        var ro = document.getElementById('irlRulesOverlay');
        if (ro) ro.remove();
        var tries = 0;
        var timer = setInterval(function() {
            var ro2 = document.getElementById('irlRulesOverlay');
            if (ro2) ro2.remove();
            var el = document.getElementById('meetupBuilderSection');
            if (el) {
                clearInterval(timer);
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            if (++tries > 30) clearInterval(timer);
        }, 300);
    }, 1500);
};

window.openSpendBitcoin = function() {
    if (typeof go === 'function') go('marketplace');
    setTimeout(function() {
        if (typeof renderMarketplace === 'function') renderMarketplace({ section: 'merchants' });
    }, 500);
};

function openDailyQuests() {
    if (typeof window._loadDeferred === 'function') window._loadDeferred();
    function start() {
        if (typeof window.showQuestHub !== 'function') return false;
        window.showQuestHub();
        return true;
    }
    pollUntil(start, 40);
}

function openProofOfPlay() {
    if (typeof window.enterProofOfPlay === 'function') {
        window.enterProofOfPlay();
        return;
    }
    loadScriptOnce('proof-of-play.js?v=20260609_pop');
    pollUntil(function() {
        if (typeof window.enterProofOfPlay !== 'function') return false;
        window.enterProofOfPlay();
        return true;
    }, 30);
}

function walletRouteReady() {
    return window._bqWalletRouteReady === true && typeof window.go === 'function' && typeof window.renderLightning === 'function';
}

var WALLET_SCRIPT_SRCS = [
    'lightning.js?v=20261023_v2323',
    'lightning-tips.js?v=20261022_v2279',
    'wallet-router.js?v=20261026_v2402'
];
var _walletTapQueued = false;

function removeUnloadedScript(src) {
    var tag = document.querySelector('script[src="' + src + '"]');
    if (tag && tag.getAttribute('data-loaded') !== '1') tag.remove();
}

function flushWalletTap() {
    if (!_walletTapQueued || !walletRouteReady()) return;
    _walletTapQueued = false;
    window.go('wallet');
}

function failWalletLoad() {
    if (!_walletTapQueued) return;
    _walletTapQueued = false;
    WALLET_SCRIPT_SRCS.forEach(removeUnloadedScript);
    if (typeof showToast === 'function') showToast('Wallet did not load. Opening it now.');
    if (typeof window.go === 'function') window.go('wallet');
    else window.location.hash = 'wallet';
}

function openWalletWhenReady() {
    if (walletRouteReady()) {
        window.go('wallet');
        return;
    }
    if (_walletTapQueued) return;
    _walletTapQueued = true;
    var settled = false;
    function giveUp() {
        if (settled) return;
        settled = true;
        failWalletLoad();
    }
    if (typeof window._loadDeferred === 'function') window._loadDeferred();
    loadScriptOnce(WALLET_SCRIPT_SRCS[0], null, giveUp);
    loadScriptOnce(WALLET_SCRIPT_SRCS[1], null, giveUp);
    loadScriptOnce(WALLET_SCRIPT_SRCS[2], flushWalletTap, giveUp);
    pollUntil(function() {
        if (!walletRouteReady()) return false;
        if (settled) return true;
        settled = true;
        flushWalletTap();
        return true;
    }, 80, giveUp);
}
window.openWalletWhenReady = openWalletWhenReady;

function runSurfaceAction(item) {
    if (!item) return;
    if (item.kind === 'go' && item.arg === 'wallet') openWalletWhenReady();
    else if (item.kind === 'go' && typeof go === 'function') go(item.arg);
    else if (item.kind === 'hub') openDailyQuests();
    else if (item.kind === 'cert') window.openCertification(item.arg);
    else if (item.kind === 'meetup') window.openMeetupBuilder();
    else if (item.kind === 'spend') window.openSpendBitcoin();
    else if (item.kind === 'pop') openProofOfPlay();
    else if (item.kind === 'fn' && typeof window[item.arg] === 'function') window[item.arg]();
    else if (item.kind === 'browse' && typeof toggleMenu === 'function') toggleMenu();
}

function learnItems(view) {
    var menu = window.BQ_LEARN_MENU;
    if (!menu) return [];
    var list = view === 'quests' ? menu.quests : menu.root;
    var mode = mobileExperienceMode();
    return (list || []).filter(function(item) {
        return !item.modes || item.modes.indexOf(mode) !== -1;
    });
}

function learnButton(item) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-learn-id', item.id);
    btn.style.cssText = 'min-height:44px;padding:12px 14px;background-color:var(--bg-side,#0f172a);background-image:' + (item.bg || 'none') +
        ';border:1px solid ' + (item.color || 'var(--border)') + ';color:' + (item.color || 'var(--text)') +
        ';border-radius:12px;font-weight:800;cursor:pointer;font-size:0.9rem;text-align:left;font-family:inherit;touch-action:manipulation;display:flex;align-items:flex-start;gap:10px;width:100%;';
    var icon = document.createElement('span');
    icon.textContent = item.emoji || '';
    icon.setAttribute('aria-hidden', 'true');
    icon.style.cssText = 'font-size:1.15rem;flex-shrink:0;line-height:1.4;';
    var col = document.createElement('span');
    col.style.cssText = 'display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;';
    var nameRow = document.createElement('span');
    nameRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
    var name = document.createElement('span');
    name.textContent = item.title;
    nameRow.appendChild(name);
    if (item.hint) {
        var hint = document.createElement('span');
        hint.textContent = item.hint;
        hint.style.cssText = 'margin-left:auto;font-size:0.68rem;font-weight:700;opacity:0.8;flex-shrink:0;';
        nameRow.appendChild(hint);
    }
    var desc = document.createElement('span');
    desc.textContent = item.desc || '';
    desc.style.cssText = 'font-size:0.74rem;font-weight:500;color:var(--text-muted);line-height:1.35;white-space:normal;';
    col.appendChild(nameRow);
    col.appendChild(desc);
    btn.appendChild(icon);
    btn.appendChild(col);
    return btn;
}

window.renderMobileLearnMenu = function(menu, view) {
    if (!menu) return;
    ensureMobileSheetStyle();
    var which = view === 'quests' ? 'quests' : 'root';
    menu.setAttribute('data-learn-view', which);
    while (menu.firstChild) menu.removeChild(menu.firstChild);

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;';
    if (which === 'quests') {
        var back = document.createElement('button');
        back.type = 'button';
        back.setAttribute('data-learn-id', 'back');
        back.textContent = '← Back';
        back.setAttribute('aria-label', 'Back to Learn');
        back.style.cssText = 'min-height:44px;padding:8px 12px;background:none;border:1px solid var(--border);color:var(--text);border-radius:10px;font-weight:800;cursor:pointer;font-family:inherit;font-size:0.85rem;';
        back.addEventListener('click', function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            window.renderMobileLearnMenu(menu, 'root');
        });
        header.appendChild(back);
    }
    var title = document.createElement('h2');
    title.id = 'mobileLearnTitle';
    title.style.cssText = 'color:var(--heading);font-size:1.05rem;font-weight:800;margin:0;flex:1;';
    title.textContent = which === 'quests' ? 'Quests' : 'Learn';
    header.appendChild(title);
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'min-width:44px;min-height:44px;background:none;border:none;color:var(--text-faint);font-size:1.2rem;cursor:pointer;font-family:inherit;';
    closeBtn.addEventListener('click', function() { dismissSheet(menu); });
    header.appendChild(closeBtn);
    menu.appendChild(header);

    var list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    var items = learnItems(which);
    if (!items.length) {
        var empty = document.createElement('p');
        empty.textContent = 'Learn menu is still loading.';
        empty.style.cssText = 'margin:0;color:var(--text-muted);font-size:0.85rem;';
        list.appendChild(empty);
    }
    items.forEach(function(item) {
        var btn = learnButton(item);
        btn.addEventListener('click', function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            if (item.kind === 'quests') {
                window.renderMobileLearnMenu(menu, 'quests');
                return;
            }
            closeMobileSheets();
            runSurfaceAction(item);
        });
        list.appendChild(btn);
        if (item.browse) {
            var browse = document.createElement('button');
            browse.type = 'button';
            browse.setAttribute('data-learn-id', 'browse-topics');
            browse.textContent = 'Browse all 145 topics';
            browse.style.cssText = 'min-height:44px;margin:-2px 0 2px 28px;padding:8px 10px;background:none;border:none;color:var(--text-muted);font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;text-align:left;text-decoration:underline;';
            browse.addEventListener('click', function(ev) {
                ev.preventDefault();
                ev.stopPropagation();
                closeMobileSheets();
                if (typeof toggleMenu === 'function') toggleMenu();
            });
            list.appendChild(browse);
        }
    });
    menu.appendChild(list);
};

window.toggleMobileLearnMenu = function() {
    var existing = document.getElementById('mobileLearnMenu');
    if (existing) { dismissSheet(existing); return; }
    var appsMenu = document.getElementById('appsMenu');
    if (appsMenu) dismissSheet(appsMenu, { skipFocus: true });

    ensureMobileSheetStyle();
    var menu = document.createElement('div');
    menu.id = 'mobileLearnMenu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-modal', 'true');
    menu.setAttribute('aria-labelledby', 'mobileLearnTitle');
    menu.style.cssText = mobileSheetBox();
    document.body.appendChild(menu);
    window.renderMobileLearnMenu(menu, 'root');
    var closeBtn = menu.querySelector('[aria-label="Close"]');
    if (closeBtn && closeBtn.focus) closeBtn.focus();
    bindSheetDismiss(menu, '#bnavLearn');
    var learnBtn = document.getElementById('bnavLearn');
    if (learnBtn) learnBtn.setAttribute('aria-expanded', 'true');
};

window.openMobileExploreApps = function() {
    var existing = document.getElementById('appsMenu');
    if (existing) { dismissSheet(existing); return; }
    var learn = document.getElementById('mobileLearnMenu');
    if (learn) dismissSheet(learn, { skipFocus: true });
    ensureMobileSheetStyle();

    var menu = document.createElement('div');
    menu.id = 'appsMenu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-modal', 'true');
    menu.setAttribute('aria-labelledby', 'mobileAppsTitle');
    menu.style.cssText = mobileSheetBox();

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;position:sticky;top:-14px;background:var(--bg-side,#0f172a);z-index:1;padding-bottom:8px;';
    var title = document.createElement('h2');
    title.id = 'mobileAppsTitle';
    title.textContent = 'Explore Apps';
    title.style.cssText = 'margin:0;flex:1;color:var(--heading);font-size:1.05rem;font-weight:800;';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'min-width:44px;min-height:44px;background:none;border:none;color:var(--text-faint);font-size:1.2rem;cursor:pointer;font-family:inherit;';
    closeBtn.addEventListener('click', function() { dismissSheet(menu); });
    header.appendChild(title);
    header.appendChild(closeBtn);
    menu.appendChild(header);

    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';
    var apps = window.exploreAppsForMode();
    apps.forEach(function(item) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'apps-grid-btn';
        btn.setAttribute('data-app-id', item.id);
        if (item.id === 'wallet') btn.setAttribute('data-wallet-nav', '1');
        btn.style.cssText = 'min-height:44px;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;color:var(--text);cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:4px;font-family:inherit;touch-action:manipulation;width:100%;';
        if (item.wide) btn.style.gridColumn = '1 / -1';
        var name = document.createElement('span');
        name.className = 'app-title';
        name.textContent = (item.emoji ? item.emoji + ' ' : '') + item.title;
        name.style.cssText = 'font-size:0.82rem;font-weight:800;line-height:1.3;';
        var desc = document.createElement('span');
        desc.className = 'app-desc';
        desc.textContent = item.desc || '';
        desc.style.cssText = 'font-size:0.68rem;font-weight:500;color:var(--text-muted);line-height:1.35;white-space:normal;';
        btn.appendChild(name);
        btn.appendChild(desc);
        btn.addEventListener('click', function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            closeMobileSheets();
            runSurfaceAction(item);
        });
        grid.appendChild(btn);
    });
    if (!apps.length) {
        var empty = document.createElement('p');
        empty.textContent = 'Explore Apps is still loading.';
        empty.style.cssText = 'grid-column:1 / -1;margin:0;color:var(--text-muted);';
        grid.appendChild(empty);
    }
    appendHiddenAppsHint(grid, mobileExperienceMode());
    menu.appendChild(grid);
    document.body.appendChild(menu);
    if (closeBtn.focus) closeBtn.focus();
    bindSheetDismiss(menu, '#bnavApps');
    var appsBtn = document.getElementById('bnavApps');
    if (appsBtn) appsBtn.setAttribute('aria-expanded', 'true');
    if (typeof playSound === 'function') playSound('pop');
};

function desktopModalOpen() {
    var settings = document.getElementById('usernameModal');
    var terms = document.getElementById('tosModal');
    return (settings && settings.classList.contains('open')) || (terms && terms.classList.contains('open'));
}

function menuIsOpen(el) {
    if (!el) return false;
    var display = el.style.display;
    return display && display !== 'none';
}

function closeDesktopMenu(menu, toggleId) {
    if (!menu) return;
    menu.style.display = 'none';
    if (menu.id === 'homeLearnMenu') menu.setAttribute('data-learn-view', 'root');
    var toggle = document.getElementById(toggleId);
    if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
        if (toggle.focus) toggle.focus();
    }
}

window.renderDesktopLearnMenu = function(view) {
    var menu = document.getElementById('homeLearnMenu');
    if (!menu || !window.BQ_LEARN_MENU) return;
    var which = view === 'quests' ? 'quests' : 'root';
    menu.setAttribute('data-learn-view', which);
    menu.setAttribute('data-registry-menu', 'learn');
    menu.setAttribute('role', 'group');
    menu.setAttribute('aria-label', which === 'quests' ? 'Quests' : 'Learn');
    var toggle = document.getElementById('homeLearnBtn');
    if (toggle) toggle.setAttribute('aria-controls', 'homeLearnMenu');
    while (menu.firstChild) menu.removeChild(menu.firstChild);
    if (which === 'quests') {
        var back = document.createElement('button');
        back.type = 'button';
        back.setAttribute('data-learn-id', 'back');
        back.textContent = '← Back';
        back.setAttribute('aria-label', 'Back to Learn');
        back.style.cssText = 'min-height:44px;padding:8px 12px;background:none;border:1px solid var(--border);color:var(--text);border-radius:8px;font-weight:800;cursor:pointer;font-family:inherit;font-size:0.85rem;text-align:left;';
        back.addEventListener('click', function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            window.renderDesktopLearnMenu('root');
            var quests = menu.querySelector('[data-learn-id="quests"]');
            if (quests && quests.focus) quests.focus();
        });
        menu.appendChild(back);
    }
    learnItems(which).forEach(function(item) {
        var btn = learnButton(item);
        btn.addEventListener('click', function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            if (item.kind === 'quests') {
                window.renderDesktopLearnMenu('quests');
                var backBtn = menu.querySelector('[data-learn-id="back"]');
                if (backBtn && backBtn.focus) backBtn.focus();
                return;
            }
            closeDesktopMenu(menu, 'homeLearnBtn');
            runSurfaceAction(item);
        });
        menu.appendChild(btn);
    });
};

window.renderDesktopAppsMenu = function() {
    var menu = document.getElementById('homeAppsMenu');
    if (!menu || !window.BQ_EXPLORE_APPS) return;
    menu.setAttribute('data-registry-menu', 'apps');
    menu.setAttribute('role', 'group');
    menu.setAttribute('aria-label', 'Explore Apps');
    var toggle = document.getElementById('homeAppsBtn');
    if (toggle) toggle.setAttribute('aria-controls', 'homeAppsMenu');
    var grid = menu.querySelector('[data-apps-grid]');
    if (!grid) {
        grid = document.createElement('div');
        grid.setAttribute('data-apps-grid', '1');
        grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';
        menu.appendChild(grid);
    }
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    window.exploreAppsForMode().forEach(function(item) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'apps-grid-btn';
        btn.setAttribute('data-app-id', item.id);
        if (item.id === 'nacho') btn.id = 'nqNachoBtn';
        if (item.wide) btn.style.gridColumn = '1 / -1';
        if (item.id === 'wallet') {
            btn.setAttribute('data-wallet-nav', '1');
            btn.style.cssText = 'padding:12px 5px;min-height:44px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.85rem;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;grid-column:1 / -1;touch-action:manipulation;font-family:inherit;';
            btn.textContent = (item.emoji ? item.emoji + ' ' : '') + item.title;
        } else {
            btn.setAttribute('data-app-modes', (item.modes || []).join(' '));
            var name = document.createElement('span');
            name.className = 'app-title';
            name.textContent = (item.emoji ? item.emoji + ' ' : '') + item.title;
            var desc = document.createElement('span');
            desc.className = 'app-desc';
            desc.textContent = item.desc || '';
            btn.appendChild(name);
            btn.appendChild(desc);
        }
        btn.addEventListener('click', function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            closeDesktopMenu(menu, 'homeAppsBtn');
            runSurfaceAction(item);
        });
        grid.appendChild(btn);
    });
    appendHiddenAppsHint(grid, mobileExperienceMode());
};

window.renderDesktopHomeMenus = function() {
    var learn = document.getElementById('homeLearnMenu');
    var keepQuests = learn && menuIsOpen(learn) && learn.getAttribute('data-learn-view') === 'quests';
    if (learn && !keepQuests) learn.setAttribute('data-learn-view', 'root');
    window.renderDesktopLearnMenu(keepQuests ? 'quests' : 'root');
    window.renderDesktopAppsMenu();
};

function appHandledOverlayOpen() {
    function openClass(id) {
        var el = document.getElementById(id);
        return !!(el && el.classList.contains('open'));
    }
    if (openClass('usernameModal') || openClass('tosModal') || openClass('questModal') || openClass('lb')) return true;
    var topics = document.getElementById('topicsBrowser');
    if (topics && topics.isConnected && !topics.hidden) return true;
    var search = document.getElementById('searchOverlay');
    if (search && (search.getAttribute('data-open') === '1' || (search.style.display && search.style.display !== 'none'))) return true;
    var ids = ['nachoStoryOverlay', 'spinModal', 'donateModal', 'kbHelpModal', 'pvpOverlay', 'nachoModeScreen', 'tipOverlay'];
    var i;
    for (i = 0; i < ids.length; i++) {
        if (document.getElementById(ids[i])) return true;
    }
    if (document.body.classList.contains('fab-tools-open')) return true;
    return false;
}

function overlayAboveMenus() {
    if (appHandledOverlayOpen()) return true;
    if (document.getElementById('questHubOverlay') || document.getElementById('btcDashOverlay')) return true;
    if (window._aiToolsOpen && document.getElementById('aiToolsPanel')) return true;
    var board = document.getElementById('leaderboard');
    return !!(board && board.classList.contains('open') && !board.classList.contains('minimized'));
}

function closeUnmanagedOverlay() {
    var questHub = document.getElementById('questHubOverlay');
    if (questHub) {
        if (typeof window._closeQuestScreen === 'function') window._closeQuestScreen();
        else questHub.remove();
        return true;
    }
    if (window._aiToolsOpen && document.getElementById('aiToolsPanel') && typeof window.toggleAITools === 'function') {
        window.toggleAITools();
        return true;
    }
    if (document.getElementById('btcDashOverlay')) {
        if (typeof window.closeDashboard === 'function') window.closeDashboard();
        else document.getElementById('btcDashOverlay').remove();
        return true;
    }
    var board = document.getElementById('leaderboard');
    if (board && board.classList.contains('open') && !board.classList.contains('minimized')) {
        if (typeof window.toggleLeaderboard === 'function') window.toggleLeaderboard();
        else board.classList.remove('open');
        return true;
    }
    return false;
}

if (!window._desktopMenuKeys) {
    window._desktopMenuKeys = true;
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        if (overlayAboveMenus()) {
            window._bqEscapeTop = 'overlay';
            if (!appHandledOverlayOpen() && closeUnmanagedOverlay()) {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
            return;
        }
        var learnSheet = document.getElementById('mobileLearnMenu');
        var appsSheet = document.getElementById('appsMenu');
        if (learnSheet || appsSheet) {
            window._bqEscapeTop = 'sheet';
            e.preventDefault();
            e.stopImmediatePropagation();
            dismissSheet(learnSheet || appsSheet);
            return;
        }
        window._bqEscapeTop = 'menu';
    }, true);
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape' || window._bqEscapeTop !== 'menu' || desktopModalOpen()) return;
        var learn = document.getElementById('homeLearnMenu');
        var apps = document.getElementById('homeAppsMenu');
        if (menuIsOpen(learn)) {
            e.preventDefault();
            if (learn.getAttribute('data-learn-view') === 'quests') {
                window.renderDesktopLearnMenu('root');
                var quests = learn.querySelector('[data-learn-id="quests"]');
                if (quests && quests.focus) quests.focus();
                return;
            }
            closeDesktopMenu(learn, 'homeLearnBtn');
            return;
        }
        if (menuIsOpen(apps)) {
            e.preventDefault();
            closeDesktopMenu(apps, 'homeAppsBtn');
        }
    });
}

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
    initComposerKeyboard();

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
