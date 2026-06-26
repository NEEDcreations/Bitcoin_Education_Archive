/**
 * Satoshi's Favor - Client-side module
 * Features: Streak Multiplier, Session Leaderboard, Near-Miss Feedback,
 *           Community Heat Meter, Second Mining Rig, Hash Booster wiring,
 *           Post-Win Ceremony + Global Chat / GGs Announcement
 */
(function() {
    'use strict';

    // ── Difficulty History ────────────────────────────────────────
    // Date        | Target  | Blocks Found | Change
    // 2026-06-02  |   1,000 |      0       | Genesis (launch)
    // 2026-06-21  |  30,000 |      0       | +2,900% — no winner in 19 days, ~1:3,333 odds now
    const DIFFICULTY_TARGET = 30000;
    window.SF_DIFFICULTY_TARGET = DIFFICULTY_TARGET; // expose for other modules
    const HASH_MAX = 100000000;
    const HASHES_PER_MINUTE = 10;
    const HASH_WINDOW_MS = 60000; // 60 seconds
    const POINTS_TARGET = 21;

    let favorState = null;
    let favorUnsub = null;
    let countdownInterval = null;
    let minerCountdownInterval = null;
    let hashListener = null;
    let sessionLeaderboardUnsub = null;  // Feature 2C cleanup
    let hashTimestamps = []; // rolling window of recent hash times
    let hashTimestamps2 = []; // Feature 5: Rig 2 cooldown timestamps
    let _prevFavorActive = null; // null = first snapshot, not yet initialized

    // Feature 1: Streak multiplier state (localStorage-backed)
    // btc_sf_window_streak: int — consecutive windows participated in
    // sfState.myHashCount: hashes submitted this window (resets on window change)
    var sfState = { myHashCount: 0, currentWindowId: null };

    function _sfGetStreak() {
        return parseInt(localStorage.getItem('btc_sf_window_streak') || '0') || 0;
    }
    function _sfSetStreak(n) {
        localStorage.setItem('btc_sf_window_streak', String(Math.max(0, n)));
    }

    // Effective hash rate per minute (may be boosted by streak or weekly boost)
    function _sfEffectiveRate() {
        if (window._sfBoostActive) return 20; // community boost
        if (_sfGetStreak() >= 3) return 15;   // streak boost
        return HASHES_PER_MINUTE;
    }

    // Feature 4: Community heat meter state
    var _sfTotalHashes = 0;

    // ─── SF CHAT + NEWS ANNOUNCEMENTS ───
    var SF_ANNOUNCE_DEDUP_MS = 4 * 60 * 60 * 1000; // 4 hours — one announce per SF activation window
    function _nachoSFAnnounce(type) {
        if (typeof db === 'undefined' || !db) return;
        if (typeof auth === 'undefined' || !auth || !auth.currentUser) return;
        var uid = auth.currentUser.uid;
        var isAdmin = auth.currentUser.email &&
            (auth.currentUser.email === 'needcreations@gmail.com' || auth.currentUser.email === 'info.603btc@gmail.com' || auth.currentUser.email === 'najemchris8@gmail.com');
        var nachoUid = isAdmin ? 'nacho-bot' : uid;
        var msg = type === 'start'
            ? "⛏️ **Satoshi's Favor has begun!** The community earned enough points — the mining window is now OPEN! Head to the Quest Hub and start hashing. Every hash is a chance to win 21,000 sats! ⚡🦌"
            : "⏱️ **Satoshi's Favor has ended.** The mining window is now closed — great effort everyone! Keep earning points to trigger the next one. Every topic, quiz, and contribution gets us closer. 🦌";
        var field = type === 'start' ? 'startAnnouncedAt' : 'endAnnouncedAt';
        var dedupRef = db.collection('satoshiFavor').doc('announceDedup');
        db.runTransaction(function(txn) {
            return txn.get(dedupRef).then(function(doc) {
                var data = doc.exists ? doc.data() : {};
                var existing = data[field];
                var existingMs = existing && existing.toMillis ? existing.toMillis() : (typeof existing === 'number' ? existing : 0);
                if (existingMs && (Date.now() - existingMs) < SF_ANNOUNCE_DEDUP_MS) {
                    throw Object.assign(new Error('sf_already_announced'), { _dedupSkip: true });
                }
                var patch = {};
                patch[field] = firebase.firestore.FieldValue.serverTimestamp();
                if (doc.exists) {
                    txn.update(dedupRef, patch);
                } else {
                    txn.set(dedupRef, patch);
                }
            });
        }).then(function() {
            var ts = firebase.firestore.FieldValue.serverTimestamp();
            db.collection('global_chat').add({
                uid: nachoUid,
                name: '🦌 Nacho',
                text: msg,
                isNachoAuto: false,
                ts: ts
            }).then(function() {
                if (typeof bridgeToTelegram === 'function') bridgeToTelegram({ user: '🦌 Nacho', text: msg });
            }).catch(function(e) { console.warn('[SF] GC announce failed:', e); });
            db.collection('announcements').add({
                uid: nachoUid,
                name: '🦌 Nacho',
                text: msg,
                isNachoAuto: true,
                ts: ts
            }).catch(function(e) { console.warn('[SF] News announce failed:', e); });
        }).catch(function(err) {
            if (!err._dedupSkip) console.warn('[SF] announce txn failed:', err);
        });
    }

    // ─── INIT ───
    function initSatoshiFavor() {
        if (typeof db === 'undefined' || !db) {
            setTimeout(initSatoshiFavor, 100);
            return;
        }
        var _cached = null;
        try { _cached = JSON.parse(localStorage.getItem('btc_favor_state_cache') || 'null'); } catch(e) {}
        if (_cached && !favorState) {
            favorState = _cached;
            renderHomeBanner();
        }
        listenToFavorState();
        _checkWeeklySFBoost();
        console.log('[FAVOR] Initialized');
    }

    function _checkWeeklySFBoost() {
        if (typeof db === 'undefined') return;
        db.collection('weekly_challenges').orderBy('startDate', 'desc').limit(1).get().then(function(snap) {
            if (snap.empty) return;
            var data = snap.docs[0].data();
            if (!data.sfBoostActive) return;
            var today = new Date().toISOString().split('T')[0];
            if (data.startDate && data.endDate && today >= data.startDate && today <= data.endDate) {
                window._sfBoostActive = true;
                console.log('[FAVOR] Community boost active: 20 hashes/min');
                var sfBanner = document.getElementById('sfBoostBanner');
                if (!sfBanner) {
                    var sfUI = document.getElementById('satoshiFavorUI');
                    if (sfUI) {
                        var banner = document.createElement('div');
                        banner.id = 'sfBoostBanner';
                        banner.style.cssText = 'background:rgba(247,147,26,0.12);border:1px solid #f7931a;border-radius:10px;padding:10px 14px;margin-bottom:10px;text-align:center;font-size:0.8rem;font-weight:700;color:#f7931a;';
                        banner.textContent = '⚡ Community Boost Active! 20 hashes/min!';
                        sfUI.insertBefore(banner, sfUI.firstChild);
                    }
                }
            }
        }).catch(function() {});
    }

    // ─── LISTENER ───
    function listenToFavorState() {
        console.log('[FAVOR] Starting listener...');
        const stateRef = db.collection('satoshiFavor').doc('current');
        favorUnsub = stateRef.onSnapshot((doc) => {
            console.log('[FAVOR] Got state update, exists:', doc.exists);
            var prevWindowId = favorState ? (favorState.currentCycleId || null) : null;
            favorState = doc.exists ? doc.data() : { points: 0, favorActive: false };
            console.log('[FAVOR] State:', favorState);

            // Feature 4: read totalHashes from window doc
            _sfTotalHashes = (favorState.totalHashes || 0);

            // Cache to localStorage
            try {
                var _cacheData = { points: favorState.points || 0, favorActive: favorState.favorActive || false };
                if (favorState.favorEndBase && favorState.favorEndBase.toMillis) _cacheData.favorEndBaseMs = favorState.favorEndBase.toMillis();
                if (favorState.bonusMinutes) _cacheData.bonusMinutes = favorState.bonusMinutes;
                localStorage.setItem('btc_favor_state_cache', JSON.stringify(_cacheData));
            } catch(e) {}

            var nowActive = favorState.favorActive && isFavorEffectivelyActive();

            if (_prevFavorActive === null) {
                // First snapshot — record state, set up window tracking
                _prevFavorActive = nowActive;
                if (nowActive && favorState.currentCycleId) {
                    sfState.currentWindowId = favorState.currentCycleId;
                }
                updateAllUIs();
                return;
            }

            if (nowActive && !_prevFavorActive) {
                // Feature 1: Window opened — check streak and apply boost
                var streak = _sfGetStreak();
                if (streak >= 3) {
                    // Streak boost active — reset streak and tag this window
                    _sfSetStreak(0);
                    window._sfStreakBoostThisWindow = true;
                    console.log('[FAVOR] Streak boost activated! 15 hashes/min this window.');
                } else {
                    window._sfStreakBoostThisWindow = false;
                }
                sfState.myHashCount = 0;
                sfState.currentWindowId = favorState.currentCycleId || null;

                if (typeof window.forceShowBubble === 'function') {
                    window.forceShowBubble("⛏️ SATOSHI'S FAVOR IS ACTIVE! The community hit 21 points — time to mine! Click below to start hashing! ⛏️🦌", 'fire');
                }
                _nachoSFAnnounce('start');
            } else if (!nowActive && _prevFavorActive) {
                // Feature 1: Window closed — update streak based on participation
                if (sfState.myHashCount > 0) {
                    _sfSetStreak(_sfGetStreak() + 1);
                    console.log('[FAVOR] Streak incremented to', _sfGetStreak());
                } else {
                    _sfSetStreak(0);
                    console.log('[FAVOR] Streak reset — no hashes submitted this window');
                }
                window._sfStreakBoostThisWindow = false;
                sfState.myHashCount = 0;

                // Clean up session leaderboard listener
                if (sessionLeaderboardUnsub) {
                    sessionLeaderboardUnsub();
                    sessionLeaderboardUnsub = null;
                }

                if (typeof window.forceShowBubble === 'function') {
                    window.forceShowBubble("⛏️ Satoshi's Favor has ended! Keep earning points for the next activation! 🦌", 'default');
                }
                _nachoSFAnnounce('end');
            }

            // New window started (different cycleId) — reset myHashCount
            if (favorState.currentCycleId && favorState.currentCycleId !== prevWindowId && nowActive) {
                sfState.myHashCount = 0;
                sfState.currentWindowId = favorState.currentCycleId;
            }

            _prevFavorActive = nowActive;

            if (favorState.favorActive && !isFavorEffectivelyActive()) {
                if (typeof firebase !== 'undefined' && firebase.functions) {
                    firebase.functions().httpsCallable('checkFavorState')({})
                        .then(function(res) { console.log('[FAVOR] Server auto-reset expired favor:', res.data); })
                        .catch(function(err) { console.warn('[FAVOR] Server auto-reset failed:', err); });
                }
            }

            updateAllUIs();
        }, (err) => console.error('[FAVOR] Listener error:', err));
    }

    // ─── EXPIRY CHECK ───
    function isFavorEffectivelyActive() {
        if (!favorState || !favorState.favorActive) return false;
        var endBase = 0;
        if (favorState.favorEndBase && typeof favorState.favorEndBase.toMillis === 'function') {
            endBase = favorState.favorEndBase.toMillis();
        } else if (typeof favorState.favorEndBaseMs === 'number') {
            endBase = favorState.favorEndBaseMs;
        }
        var bonusMs = (favorState.bonusMinutes || 0) * 60 * 1000;
        return (endBase + bonusMs) > Date.now();
    }

    window._resolveFavorState = function() {
        if (!favorState) return null;
        if (favorState.favorActive && !isFavorEffectivelyActive()) {
            return Object.assign({}, favorState, { favorActive: false, bonusMinutes: 0 });
        }
        return favorState;
    };

    // ─── UI UPDATES ───
    function updateAllUIs() {
        renderHomeBanner();
        renderChatBanner();
        updateQuestHubTab();
    }

    function renderHomeBanner() {
        const homeInner = document.querySelector('#home .home-inner');
        if (!homeInner) return;

        let banner = document.getElementById('satoshiFavorHomeBanner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'satoshiFavorHomeBanner';
            banner.style.cssText = 'width: 100%; margin: 0 0 20px 0; box-sizing: border-box; align-self: center;';
            homeInner.prepend(banner);
            console.log('[FAVOR] Injected banner at top of home-inner');
        }

        banner.innerHTML = buildBannerHTML('home');
        if (favorState && favorState.favorActive) startCountdown('homeCountdown');
    }

    function renderChatBanner() {
        const existing = document.getElementById('satoshiFavorChatBanner');
        if (!existing) return;
        try {
            existing.innerHTML = buildBannerHTML('chat');
            if (favorState.favorActive) startCountdown('chatCountdown');
        } catch(e) {
            console.error('[FAVOR] Chat banner render error:', e);
        }
    }

    function buildBannerHTML(context) {
        const isActive = isFavorEffectivelyActive();
        const points = favorState.points || 0;
        const isCompact = context === 'chat';

        if (isActive) {
            return `<div class="favor-banner-active" style="${isCompact?'padding:8px 12px;':'padding:12px 16px;margin-bottom:16px;'}background:linear-gradient(135deg,rgba(247,147,26,0.15),rgba(247,147,26,0.05));border:2px solid var(--accent);border-radius:12px;text-align:center;animation:favorPulse 2s ease-in-out infinite;cursor:pointer;" onclick="window.showQuestHub && window.showQuestHub(); window._questHubTab = 'favor'; setTimeout(function(){ if(window._renderQuestHubTab) window._renderQuestHubTab(); }, 50);"><div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;"><span style="font-size:${isCompact?'1.2rem':'1.5rem'};">✨⛏️</span><span style="font-size:${isCompact?'0.85rem':'1rem'};font-weight:800;color:var(--accent);">SATOSHI'S FAVOR</span><span style="font-size:${isCompact?'0.7rem':'0.8rem'};color:var(--text-muted);background:rgba(0,0,0,0.3);padding:2px 8px;border-radius:6px;" id="${context}Countdown">--:--:--</span></div><div style="font-size:${isCompact?'0.65rem':'0.75rem'};color:var(--text-muted);margin-top:4px;">Mine now! Click to hash →</div></div><style>@keyframes favorPulse{0%,100%{box-shadow:0 0 0 0 rgba(247,147,26,0.4)}50%{box-shadow:0 0 0 10px rgba(247,147,26,0)}}</style>`;
        } else {
            const pct = Math.min(100, (points / POINTS_TARGET) * 100);
            const remaining = POINTS_TARGET - points;
            return `<div class="favor-banner-progress" style="${isCompact?'padding:6px 10px;':'padding:10px 14px;margin-bottom:16px;'}background:var(--card-bg);border:1px solid var(--border);border-radius:10px;cursor:pointer;transition:border-color 0.2s;" onclick="window.showQuestHub && window.showQuestHub(); window._questHubTab = 'favor'; setTimeout(function(){ if(window._renderQuestHubTab) window._renderQuestHubTab(); }, 50);" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px;"><div style="display:flex;align-items:center;gap:6px;"><span style="font-size:${isCompact?'1rem':'1.2rem'};">✨⛏️</span><span style="font-size:${isCompact?'0.75rem':'0.85rem'};font-weight:700;color:var(--heading);">Satoshi's Favor</span></div><span style="font-size:${isCompact?'0.7rem':'0.75rem'};color:var(--text-muted);">${points}/${POINTS_TARGET} points · ${remaining} to go</span></div><div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;"><div style="height:100%;background:linear-gradient(90deg,var(--accent),#ffd700);width:${pct}%;transition:width 0.5s;border-radius:3px;"></div></div></div>`;
        }
    }

    function startCountdown(elementId) {
        if (countdownInterval) clearInterval(countdownInterval);

        const tick = () => {
            const el = document.getElementById(elementId);
            if (!el || !favorState || !favorState.favorActive) {
                clearInterval(countdownInterval);
                return;
            }
            var endBase = 0;
            if (favorState.favorEndBase && typeof favorState.favorEndBase.toMillis === 'function') endBase = favorState.favorEndBase.toMillis();
            else if (typeof favorState.favorEndBaseMs === 'number') endBase = favorState.favorEndBaseMs;
            const bonusMs = (favorState.bonusMinutes || 0) * 60 * 1000;
            const remaining = (endBase + bonusMs) - Date.now();

            if (remaining <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                if (typeof firebase !== 'undefined' && firebase.functions) {
                    firebase.functions().httpsCallable('checkFavorState')({})
                        .then(function(res) { console.log('[FAVOR] Server reset after expiry:', res.data); })
                        .catch(function(err) { console.warn('[FAVOR] Server reset call failed:', err); });
                }
                updateAllUIs();
                return;
            }
            const hrs = Math.floor(remaining / 3600000);
            const mins = Math.floor((remaining % 3600000) / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            el.textContent = `${hrs}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        };
        tick();
        countdownInterval = setInterval(tick, 1000);
    }

    function updateQuestHubTab() {
        const btn = document.getElementById('qhTabFavor');
        if (!btn) return;
        if (favorState && favorState.favorActive) {
            btn.style.borderColor = 'var(--accent)';
            btn.style.boxShadow = '0 0 10px rgba(247,147,26,0.3)';
        } else {
            btn.style.borderColor = 'var(--border)';
            btn.style.boxShadow = 'none';
        }
    }

    // ─── MINER MODAL ───
    window.openSatoshiFavorMiner = function() {
        if (!favorState || !favorState.favorActive) {
            showToast('Satoshi\'s Favor is not currently active. Keep earning points!');
            return;
        }
        showMinerModal();
    };

    window.closeSatoshiFavorMiner = function() {
        const overlay = document.getElementById('satoshiFavorMinerOverlay');
        if (overlay) overlay.remove();
        if (hashListener) hashListener();
        if (sessionLeaderboardUnsub) { sessionLeaderboardUnsub(); sessionLeaderboardUnsub = null; }
        if (minerCountdownInterval) clearInterval(minerCountdownInterval);
        if (window._sfCooldownTimer) clearInterval(window._sfCooldownTimer);
        if (window.closeSatoshiFavorMiner._toastTimer) clearTimeout(window.closeSatoshiFavorMiner._toastTimer);
        window._sfSecondRigChargeConsumed = false; // reset per-session flag
        // Reopen Quest Hub if we came from there
        if (window._qhReopenOnMinerClose) {
            window._qhReopenOnMinerClose = false;
            if (typeof showQuestHub === 'function') {
                showQuestHub();
                window._questHubTab = 'favor';
                setTimeout(function() { if (typeof _renderQuestHubTab === 'function') _renderQuestHubTab(); }, 50);
            }
        }
    };

    // ─── Feature 1: Streak UI indicator ───
    function _buildStreakIndicatorHTML() {
        var streak = _sfGetStreak();
        var streakBoostActive = window._sfStreakBoostThisWindow;
        if (streakBoostActive) {
            return '<div style="text-align:center;padding:8px 12px;background:linear-gradient(135deg,rgba(247,147,26,0.2),rgba(234,179,8,0.1));border:1px solid #f7931a;border-radius:10px;margin-bottom:10px;">' +
                '<span style="font-size:0.82rem;font-weight:800;color:#f7931a;">⚡ STREAK BOOST: 15 hashes/min!</span>' +
                '</div>';
        }
        if (streak === 0) {
            return '<div style="text-align:center;padding:6px;font-size:0.72rem;color:var(--text-muted);margin-bottom:8px;">⛏️ Mine 3 windows in a row for a speed boost!</div>';
        }
        var dots = '';
        for (var i = 0; i < 3; i++) {
            dots += i < streak
                ? '<span style="font-size:1rem;color:#f7931a;">●</span>'
                : '<span style="font-size:1rem;color:var(--border);">○</span>';
        }
        return '<div style="text-align:center;padding:6px;margin-bottom:8px;">' +
            '<span style="font-size:0.8rem;font-weight:700;color:var(--heading);">🔥 Mining Streak: ' + dots + '</span>' +
            '<span style="font-size:0.7rem;color:var(--text-muted);display:block;margin-top:2px;">' + streak + '/3 — next window boosts to 15/min</span>' +
            '</div>';
    }

    // ─── Feature 4: Community heat meter HTML ───
    function _buildHeatMeterHTML() {
        var total = _sfTotalHashes || 0;
        var MAX_HEAT = 500;
        var pct = Math.min(100, (total / MAX_HEAT) * 100);
        var color = total < 100 ? '#3b82f6' : total < 300 ? '#f7931a' : '#ef4444';
        var emoji = total < 100 ? '🌡️' : total < 300 ? '🔥' : '🚨';
        var bar = '<div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-top:6px;">' +
            '<div style="height:100%;width:' + pct.toFixed(1) + '%;background:' + color + ';border-radius:4px;transition:width 0.5s;"></div>' +
            '</div>';
        return '<div id="sfHeatMeter" style="padding:8px 12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;margin-bottom:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<span style="font-size:0.8rem;font-weight:700;color:var(--heading);">' + emoji + ' Community Heat</span>' +
            '<span style="font-size:0.78rem;color:' + color + ';font-weight:800;">' + total.toLocaleString() + ' hashes</span>' +
            '</div>' + bar +
            '</div>';
    }

    // ─── Feature 6: Hash booster UI ───
    function _buildBoosterBannerHTML() {
        var u = typeof currentUser !== 'undefined' && currentUser ? currentUser : {};
        var boosterHashes = u.hashBoosterHashes || 0;
        if (boosterHashes <= 0) return '';
        return '<div id="sfBoosterBanner" style="padding:8px 12px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.4);border-radius:10px;margin-bottom:10px;text-align:center;font-size:0.8rem;font-weight:700;color:#f7931a;">' +
            '⚡ Booster active: +' + boosterHashes + ' bonus hashes available' +
            '</div>';
    }

    function showMinerModal() {
        var u = typeof currentUser !== 'undefined' && currentUser ? currentUser : {};
        var hasSecondRig = (u.secondRigCharges || 0) > 0;
        var boosterHashes = u.hashBoosterHashes || 0;

        const overlay = document.createElement('div');
        overlay.id = 'satoshiFavorMinerOverlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:100001;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);padding:20px;';
        overlay.onclick = (e) => { if (e.target === overlay) window.closeSatoshiFavorMiner(); };

        // Determine effective hash rate
        var streak = _sfGetStreak();
        var streakBoostActive = window._sfStreakBoostThisWindow;
        var effectiveRateDisplay = streakBoostActive ? 15 : (window._sfBoostActive ? 20 : HASHES_PER_MINUTE);

        // Second rig buttons HTML
        var hashBtnsHTML = hasSecondRig
            ? '<div style="display:flex;gap:8px;margin-bottom:16px;">' +
              '<button id="minerHashBtn" onclick="window.minerDoHash(1)" style="flex:1;padding:14px;background:linear-gradient(135deg,var(--accent),#e8720c);border:none;border-radius:12px;color:#fff;font-size:1rem;font-weight:800;cursor:pointer;">⛏️ Hash #1</button>' +
              '<button id="minerHashBtn2" onclick="window.minerDoHash(2)" style="flex:1;padding:14px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);border:none;border-radius:12px;color:#fff;font-size:1rem;font-weight:800;cursor:pointer;">⛏️ Hash #2</button>' +
              '</div>'
            : '<button id="minerHashBtn" onclick="window.minerDoHash(1)" style="width:100%;padding:16px;background:linear-gradient(135deg,var(--accent),#e8720c);border:none;border-radius:12px;color:#fff;font-size:1.1rem;font-weight:800;cursor:pointer;margin-bottom:8px;">⛏️ HASH</button>' +
              '<div style="text-align:center;margin-bottom:8px;"><a onclick="window.closeSatoshiFavorMiner();window.showQuestHub&&window.showQuestHub();window._questHubTab=\'nook\';setTimeout(function(){if(window._renderQuestHubTab)window._renderQuestHubTab();},50);" style="font-size:0.72rem;color:var(--text-muted);cursor:pointer;text-decoration:underline;">⚡ Want more hashing power? → Get Second Rig in Nacho\'s Nook</a></div>';

        // Feature 2B: Session leaderboard panel (only during active window)
        var sessionLBPanel = '<div id="sfSessionLB" style="border-top:1px solid var(--border);padding-top:12px;margin-bottom:12px;">' +
            '<div style="font-weight:700;color:var(--heading);margin-bottom:8px;font-size:0.85rem;">👥 This Window — Live Leaderboard</div>' +
            '<div id="sfSessionLBList" style="max-height:160px;overflow-y:auto;"><div style="color:var(--text-muted);text-align:center;padding:8px;font-size:0.78rem;">Loading...</div></div>' +
            '</div>';

        overlay.innerHTML =
            '<div id="satoshiFavorMinerModal" style="background:var(--bg-side);border:1px solid var(--border);width:100%;max-width:480px;max-height:90vh;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;">' +
            '<div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">' +
            '<div style="display:flex;align-items:center;gap:10px;">' +
            '<span style="font-size:1.5rem;">✨⛏️</span>' +
            '<div><div style="font-weight:800;color:var(--heading);">Satoshi\'s Favor Mining</div>' +
            '<div style="font-size:0.75rem;color:var(--text-muted);">Target: &lt; ' + DIFFICULTY_TARGET + ' · Win 21,000 sats!</div></div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:8px;"><button onclick="window.closeSatoshiFavorMiner()" style="background:none;border:1px solid var(--border);border-radius:8px;padding:5px 12px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;">← Back</button><button onclick="window._qhReopenOnMinerClose=false;window.closeSatoshiFavorMiner()" style="background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer;">✕</button></div>' +
            '</div>' +
            '<div style="padding:16px 20px;overflow-y:auto;">' +
            // Feature 6: Booster banner
            _buildBoosterBannerHTML() +
            // Feature 1: Streak indicator
            _buildStreakIndicatorHTML() +
            // Feature 4: Heat meter
            _buildHeatMeterHTML() +
            '<div style="background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:10px;padding:12px;margin-bottom:16px;font-size:0.8rem;color:var(--text-muted);">' +
            'Generate a hash (0–100,000,000). If your hash is below <strong style="color:#22c55e;">' + DIFFICULTY_TARGET.toLocaleString() + '</strong> (the difficulty target), you win <strong style="color:var(--accent);">21,000 sats!</strong> That\'s a 1 in 3,333 chance per hash (~0.03%). You get ' + effectiveRateDisplay + ' hashes per minute.' +
            '</div>' +
            '<div style="text-align:center;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-muted);">Time Remaining</div>' +
            '<div id="minerCountdown" style="font-size:2rem;font-weight:900;color:var(--accent);font-family:monospace;">--:--:--</div>' +
            '</div>' +
            '<div style="text-align:center;margin-bottom:16px;">' +
            '<div id="minerVisual" style="font-size:4rem;line-height:1;transition:transform 0.1s;">⛏️</div>' +
            '<div id="hashOutput" style="font-size:1.3rem;font-weight:800;margin-top:8px;font-family:monospace;color:var(--heading);">Ready to mine</div>' +
            '<div id="hashMessage" style="font-size:0.85rem;color:var(--text-muted);margin-top:4px;min-height:1.2em;"></div>' +
            // Feature 3: Near-miss toast container
            '<div id="sfNearMissToast" style="display:none;margin-top:8px;padding:8px 12px;background:rgba(247,147,26,0.15);border:1px solid rgba(247,147,26,0.4);border-radius:10px;font-size:0.8rem;font-weight:700;color:#f7931a;"></div>' +
            '</div>' +
            '<div style="display:flex;justify-content:center;gap:20px;margin-bottom:16px;font-size:0.8rem;">' +
            '<div style="text-align:center;"><div style="color:var(--text-muted);">Target</div><div style="font-weight:800;color:#22c55e;">&lt; ' + DIFFICULTY_TARGET + '</div></div>' +
            '<div style="text-align:center;"><div style="color:var(--text-muted);">Odds</div><div style="font-weight:800;">1:3,333</div></div>' +
            '<div style="text-align:center;"><div style="color:var(--text-muted);">Rig 1</div><div id="hashCooldown" style="font-weight:800;color:var(--accent);">Ready</div></div>' +
            (hasSecondRig ? '<div style="text-align:center;"><div style="color:var(--text-muted);">Rig 2</div><div id="hashCooldown2" style="font-weight:800;color:#8b5cf6;">Ready</div></div>' : '') +
            '</div>' +
            hashBtnsHTML +
            sessionLBPanel +
            '<div style="border-top:1px solid var(--border);padding-top:12px;">' +
            '<div style="font-weight:700;color:var(--heading);margin-bottom:8px;">⛏️ Community Hashes</div>' +
            '<div id="hashList" style="max-height:300px;overflow-y:auto;"><div style="color:var(--text-muted);text-align:center;padding:12px;font-size:0.8rem;">Loading...</div></div>' +
            '</div>' +
            '</div>' +
            '</div>';

        document.body.appendChild(overlay);
        loadRecentHashes();
        loadSessionLeaderboard();   // Feature 2B
        startMinerCountdown();
        updateCooldownDisplay();
    }

    function startMinerCountdown() {
        if (minerCountdownInterval) clearInterval(minerCountdownInterval);

        const tick = () => {
            const el = document.getElementById('minerCountdown');
            if (!el) return;
            if (!favorState || !favorState.favorActive) { el.textContent = 'EXPIRED'; return; }
            var endBase = 0;
            if (favorState.favorEndBase && typeof favorState.favorEndBase.toMillis === 'function') endBase = favorState.favorEndBase.toMillis();
            else if (typeof favorState.favorEndBaseMs === 'number') endBase = favorState.favorEndBaseMs;
            const bonusMs = (favorState.bonusMinutes || 0) * 60 * 1000;
            const remaining = (endBase + bonusMs) - Date.now();
            if (remaining <= 0) { el.textContent = '00:00:00'; disableHashButton(); return; }
            const hrs = Math.floor(remaining / 3600000);
            const mins = Math.floor((remaining % 3600000) / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            el.textContent = `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        };
        tick();
        minerCountdownInterval = setInterval(tick, 1000);
    }

    // ─── Feature 2B: Live session leaderboard listener ───
    function loadSessionLeaderboard() {
        var lbList = document.getElementById('sfSessionLBList');
        if (!lbList) return;
        if (!favorState || !favorState.favorActive || !favorState.currentCycleId) {
            lbList.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:8px;font-size:0.78rem;">No active window</div>';
            return;
        }

        if (sessionLeaderboardUnsub) sessionLeaderboardUnsub();

        var myUid = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : null;

        sessionLeaderboardUnsub = db.collection('satoshiFavor').doc('current')
            .collection('session_hashes')
            .orderBy('count', 'desc')
            .limit(10)
            .onSnapshot(function(snap) {
                var el = document.getElementById('sfSessionLBList');
                if (!el) return;
                if (snap.empty) {
                    el.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:8px;font-size:0.78rem;">No hashes yet — be first!</div>';
                    return;
                }
                var html = '';
                var rank = 1;
                snap.forEach(function(doc) {
                    var d = doc.data();
                    var isMe = d.uid === myUid;
                    var bgStyle = isMe ? 'background:rgba(247,147,26,0.12);border:1px solid rgba(247,147,26,0.4);' : 'background:var(--card-bg);border:1px solid var(--border);';
                    var nameColor = isMe ? '#f7931a' : 'var(--text-muted)';
                    var medalEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
                    html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 10px;border-radius:8px;margin-bottom:3px;' + bgStyle + '">' +
                        '<span style="font-size:0.78rem;min-width:22px;text-align:center;">' + medalEmoji + '</span>' +
                        '<span style="flex:1;font-size:0.78rem;font-weight:700;color:' + nameColor + ';">@' + escapeHtml(d.username || 'Anon') + '</span>' +
                        '<span style="font-size:0.78rem;font-family:monospace;color:' + (isMe ? '#f7931a' : 'var(--text)') + ';font-weight:700;">' + (d.count || 0) + ' hashes</span>' +
                        '</div>';
                    rank++;
                });
                el.innerHTML = html;
            }, function(err) {
                console.error('[FAVOR] Session LB error:', err);
                var el = document.getElementById('sfSessionLBList');
                if (el) el.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:8px;font-size:0.78rem;">Could not load</div>';
            });
    }

    // ─── Feature 3: Near-miss / unlucky toast ───
    var _nearMissMessages = [
        '⚡ NEAR MISS! That hash almost won — don\'t stop now!',
        '🎯 That was CLOSE. Within 15% of changing everything...',
        '🔥 You\'re running hot! That hash was right at the edge!',
        '⚡ SO CLOSE! You were within 15% of the target! Keep hashing!',
    ];
    var _unluckyMessages = [
        '💀 Satoshi saw that hash and cringed.',
        '😂 That hash was so far off it looped around. Almost.',
        '🎲 That was statistically one of the worst hashes possible. Respect.',
        '📉 That hash is giving bear market energy.',
        '☠️ If hashes were grades, that one just failed summer school.',
    ];

    function _showNearMissToast(msg) {
        var el = document.getElementById('sfNearMissToast');
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'block';
        if (window._sfNMTimer) clearTimeout(window._sfNMTimer);
        window._sfNMTimer = setTimeout(function() {
            var e2 = document.getElementById('sfNearMissToast');
            if (e2) e2.style.display = 'none';
        }, 2500);
    }

    function _checkNearMissUnlucky(value) {
        if (value <= DIFFICULTY_TARGET) return; // Won — don't show
        var nearMissThreshold = Math.floor(DIFFICULTY_TARGET * 1.15);
        var unluckyThreshold = Math.floor(HASH_MAX * 0.80);

        if (value <= nearMissThreshold) {
            var msg = _nearMissMessages[Math.floor(Math.random() * _nearMissMessages.length)];
            _showNearMissToast(msg);
        } else if (value > unluckyThreshold) {
            var msg2 = _unluckyMessages[Math.floor(Math.random() * _unluckyMessages.length)];
            _showNearMissToast(msg2);
        }
    }

    // ─── Feature 4: Heat meter updater (called after each hash) ───
    function _updateHeatMeterDisplay() {
        var el = document.getElementById('sfHeatMeter');
        if (!el) return;
        _sfTotalHashes++;
        el.outerHTML = _buildHeatMeterHTML();
    }

    // ─── Feature 7A: Winner overlay ───
    function _showWinnerCelebration(value) {
        // Remove existing if any
        var existing = document.getElementById('sfWinnerOverlay');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'sfWinnerOverlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:200000;display:flex;align-items:center;justify-content:center;pointer-events:all;';

        // Confetti CSS animation
        var confettiCSS = '<style>' +
            '@keyframes sfConfettiFall{0%{transform:translateY(-100px) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}' +
            '.sf-confetti{position:fixed;top:0;pointer-events:none;animation:sfConfettiFall linear both;}' +
            '@keyframes sfWinPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}' +
            '</style>';

        // Generate confetti pieces
        var confettiHTML = '';
        var colors = ['#f7931a','#22c55e','#eab308','#3b82f6','#ff6b9d'];
        for (var i = 0; i < 40; i++) {
            var left = Math.random() * 100;
            var delay = Math.random() * 2;
            var duration = 2 + Math.random() * 3;
            var size = 8 + Math.random() * 10;
            var color = colors[Math.floor(Math.random() * colors.length)];
            confettiHTML += '<div class="sf-confetti" style="left:' + left + '%;width:' + size + 'px;height:' + size + 'px;background:' + color + ';border-radius:2px;animation-delay:' + delay + 's;animation-duration:' + duration + 's;"></div>';
        }

        overlay.innerHTML = confettiCSS + confettiHTML +
            '<div style="background:linear-gradient(135deg,rgba(0,0,0,0.95),rgba(21,5,0,0.98));border:2px solid #f7931a;border-radius:24px;padding:40px 32px;text-align:center;max-width:360px;animation:sfWinPulse 1s ease-in-out infinite;box-shadow:0 0 60px rgba(247,147,26,0.5);">' +
            '<div style="font-size:5rem;margin-bottom:12px;">🦌</div>' +
            '<div style="font-size:1.8rem;font-weight:900;color:#f7931a;margin-bottom:8px;">⚡ YOU WON!</div>' +
            '<div style="font-size:1.1rem;font-weight:800;color:#22c55e;margin-bottom:16px;">A winner is you!</div>' +
            '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;">Winning hash:</div>' +
            '<div style="font-family:monospace;font-size:1.3rem;font-weight:900;color:#22c55e;margin-bottom:16px;">' + value.toLocaleString() + '</div>' +
            '<div style="font-size:0.95rem;color:#eab308;font-weight:800;margin-bottom:20px;">🎉 21,000 sats incoming!</div>' +
            '<div style="font-size:0.72rem;color:var(--text-faint);">Auto-dismisses in 8 seconds · Tap to close</div>' +
            '</div>';

        overlay.onclick = function() { overlay.remove(); };
        document.body.appendChild(overlay);

        // Auto-dismiss after 8 seconds
        setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 8000);

        // Also trigger confetti via existing system if available
        if (typeof window.launchConfetti === 'function') {
            try { window.launchConfetti(); } catch(e) {}
        }
    }

    // ─── HASHING (Rig 1 and Rig 2) ───
    window.minerDoHash = async function(rig) {
        rig = rig || 1;
        if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
            showToast('Please sign in to mine.');
            return;
        }

        var u = typeof currentUser !== 'undefined' && currentUser ? currentUser : {};
        var boosterHashes = u.hashBoosterHashes || 0;
        var hasSecondRig = (u.secondRigCharges || 0) > 0;

        // Use appropriate timestamps array for the rig
        var timestamps = rig === 2 ? hashTimestamps2 : hashTimestamps;
        var btnId = rig === 2 ? 'minerHashBtn2' : 'minerHashBtn';
        var cooldownId = rig === 2 ? 'hashCooldown2' : 'hashCooldown';

        const btn = document.getElementById(btnId);
        const visual = document.getElementById('minerVisual');
        const output = document.getElementById('hashOutput');
        const msg = document.getElementById('hashMessage');

        if (!favorState || !favorState.favorActive) {
            showToast('Satoshi\'s Favor has expired.');
            return;
        }

        // Feature 1+6: Effective rate (streak boost or community boost)
        var effectiveRate = _sfEffectiveRate();

        // Feature 6: Also include booster hashes — each booster hash is an extra allowed call
        // Booster hashes tracked server-side (hashBoosterHashes), we just allow the extra calls
        // The CF does not enforce a separate booster check — it shares the rate window.
        // We track boosterHashes usage locally; actual consumption tracked on Firestore by separate mechanism.
        var now60 = Date.now();
        var allTs = (rig === 2) ? hashTimestamps2 : hashTimestamps;
        allTs = allTs.filter(function(t) { return now60 - t < HASH_WINDOW_MS; });
        if (rig === 2) hashTimestamps2 = allTs; else hashTimestamps = allTs;

        var allowedThisWindow = effectiveRate + (boosterHashes > 0 ? boosterHashes : 0);
        if (allTs.length >= allowedThisWindow) {
            var oldest = allTs[0];
            var waitMs = HASH_WINDOW_MS - (now60 - oldest);
            showToast((rig === 2 ? 'Rig 2 rate limit: ' : 'Rate limit: ') + Math.ceil(waitMs / 1000) + 's ('+effectiveRate+'/min)');
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = (rig === 2 ? '⛏️ RIG 2...' : '⛏️ HASHING...'); btn.style.opacity = '0.7'; }

        let shake = setInterval(() => {
            if (visual) visual.style.transform = `rotate(${Math.random() * 10 - 5}deg) scale(${0.95 + Math.random() * 0.1})`;
            if (output) output.textContent = Math.floor(Math.random() * HASH_MAX).toLocaleString();
        }, 50);

        try {
            const fn = firebase.functions().httpsCallable('hashForFavor');
            const result = await fn({});
            clearInterval(shake);

            const { value, isWinner, hashId } = result.data;

            // Record timestamp for this rig
            if (rig === 2) hashTimestamps2.push(Date.now()); else hashTimestamps.push(Date.now());

            // Consume one Second Rig charge on first use per session
            if (rig === 2 && !window._sfSecondRigChargeConsumed) {
                window._sfSecondRigChargeConsumed = true;
                if (typeof db !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
                    db.collection('users').doc(auth.currentUser.uid).update({
                        secondRigCharges: firebase.firestore.FieldValue.increment(-1)
                    }).then(function() {
                        if (typeof currentUser !== 'undefined' && currentUser && currentUser.secondRigCharges > 0) {
                            currentUser.secondRigCharges = currentUser.secondRigCharges - 1;
                        }
                    }).catch(function() {});
                }
            }

            // Feature 1: track myHashCount for streak
            sfState.myHashCount++;

            // Track mining stats for badges
            var _sfH = parseInt(localStorage.getItem('btc_sf_hashes') || '0') + 1;
            localStorage.setItem('btc_sf_hashes', _sfH.toString());
            var _sfBest = parseInt(localStorage.getItem('btc_sf_best_hash') || '999999999');
            if (value < _sfBest) localStorage.setItem('btc_sf_best_hash', value.toString());
            if (isWinner) localStorage.setItem('btc_sf_solved_block', 'true');
            if (typeof window._trackCombo === 'function') window._trackCombo('sf');

            if (visual) visual.style.transform = 'scale(1)';
            if (output) {
                output.textContent = value.toLocaleString();
                output.style.color = isWinner ? '#22c55e' : (value < DIFFICULTY_TARGET * 10 ? '#f7931a' : 'var(--text-muted)');
            }

            if (isWinner) {
                if (msg) msg.innerHTML = '<strong style="color:#22c55e;font-size:1.1rem;">🏆 WINNER! You solved a block!</strong><br>21,000 sats incoming! Check your DMs.';
                if (visual) visual.textContent = '🎉';
                // Feature 7A: Winner ceremony
                _showWinnerCelebration(value);
                announceWinner(value);
            } else {
                if (msg) {
                    const diff = value - DIFFICULTY_TARGET;
                    msg.textContent = diff < 10000 ? `So close! Only ${diff.toLocaleString()} over target` : `${(value/1000000).toFixed(2)}M · Keep trying!`;
                }
                // Feature 3: Near-miss / unlucky feedback
                _checkNearMissUnlucky(value);
            }

            // Feature 4: Update heat meter display
            _sfTotalHashes++;
            var heatEl = document.getElementById('sfHeatMeter');
            if (heatEl) heatEl.outerHTML = _buildHeatMeterHTML();

            loadRecentHashes();

        } catch (err) {
            clearInterval(shake);
            if (visual) visual.style.transform = 'scale(1)';
            if (output) output.textContent = 'Error';
            if (msg) msg.textContent = err.message || 'Hash failed. Try again.';
            console.error('[FAVOR] Hash error:', err);
        }

        if (btn) { btn.disabled = false; btn.textContent = (rig === 2 ? '⛏️ Hash #2' : (hasSecondRig ? '⛏️ Hash #1' : '⛏️ HASH')); btn.style.opacity = '1'; }
        updateCooldownDisplay();
    };

    function updateCooldownDisplay() {
        const el = document.getElementById('hashCooldown');
        const el2 = document.getElementById('hashCooldown2');

        if (window._sfCooldownTimer) clearInterval(window._sfCooldownTimer);

        var u = typeof currentUser !== 'undefined' && currentUser ? currentUser : {};
        var effectiveRate = _sfEffectiveRate();

        const update = () => {
            const now2 = Date.now();

            // Rig 1
            if (el) {
                const recent = hashTimestamps.filter(t => now2 - t < HASH_WINDOW_MS);
                const remaining = effectiveRate - recent.length;
                if (remaining > 0) {
                    el.textContent = remaining + '/' + effectiveRate + ' left';
                    el.style.color = remaining <= 2 ? 'var(--accent)' : '#22c55e';
                } else {
                    const oldest = recent[0];
                    const waitSec = Math.ceil((HASH_WINDOW_MS - (now2 - oldest)) / 1000);
                    el.textContent = waitSec + 's';
                    el.style.color = '#ef4444';
                }
            }

            // Rig 2
            if (el2) {
                const recent2 = hashTimestamps2.filter(t => now2 - t < HASH_WINDOW_MS);
                const remaining2 = effectiveRate - recent2.length;
                if (remaining2 > 0) {
                    el2.textContent = remaining2 + '/' + effectiveRate + ' left';
                    el2.style.color = remaining2 <= 2 ? '#8b5cf6' : '#22c55e';
                } else {
                    const oldest2 = recent2[0];
                    const waitSec2 = Math.ceil((HASH_WINDOW_MS - (now2 - oldest2)) / 1000);
                    el2.textContent = waitSec2 + 's';
                    el2.style.color = '#ef4444';
                }
            }
        };
        update();
        window._sfCooldownTimer = setInterval(update, 1000);
    }

    function disableHashButton() {
        const btn = document.getElementById('minerHashBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'EXPIRED'; btn.style.opacity = '0.5'; }
        const btn2 = document.getElementById('minerHashBtn2');
        if (btn2) { btn2.disabled = true; btn2.textContent = 'EXPIRED'; btn2.style.opacity = '0.5'; }
    }

    // ─── HASH LOG ───
    function loadRecentHashes() {
        const list = document.getElementById('hashList');
        if (!list || !favorState) return;

        const cycleId = favorState.currentCycleId;
        if (!cycleId) {
            list.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:12px;font-size:0.8rem;">No hashes yet</div>';
            return;
        }

        if (hashListener) hashListener();

        const q = db.collection('satoshiFavor').doc('current').collection('hashes')
            .where('cycleId', '==', cycleId)
            .orderBy('timestamp', 'desc')
            .limit(50);

        hashListener = q.onSnapshot((snap) => {
            if (snap.empty) {
                list.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:12px;font-size:0.8rem;">No hashes yet. Be the first!</div>';
                return;
            }

            let html = '';

            snap.docs.forEach((doc) => {
                const h = doc.data();
                const isMe = h.isMe || false;
                const isWin = h.isWinner;
                const val = h.value.toLocaleString();
                const time = h.timestamp ? new Date(h.timestamp.toMillis()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '--:--';
                const name = escapeHtml(h.username || 'Anon');

                if (isWin) {
                    html += `<div style="padding:12px 14px;margin-bottom:6px;background:linear-gradient(135deg,rgba(34,197,94,0.2),rgba(34,197,94,0.08));border:2px solid #22c55e;border-radius:10px;animation:favorPulse 2s ease-in-out infinite;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><span style="font-weight:900;font-size:0.95rem;color:#22c55e;">🏆 WINNER — ${name}</span><span style="color:var(--text-faint);font-size:0.68rem;">${time}</span></div><div style="font-family:monospace;font-size:1.1rem;font-weight:900;color:#22c55e;text-align:center;">${val}</div></div>`;
                } else if (isMe) {
                    html += `<div style="padding:6px 12px;margin-bottom:3px;background:rgba(247,147,26,0.1);border:1px solid var(--accent);border-radius:8px;display:flex;justify-content:space-between;align-items:center;"><span style="font-weight:700;color:var(--accent);font-size:0.82rem;">@${name}</span><span style="font-family:monospace;font-size:0.85rem;font-weight:700;color:var(--heading);">${val}</span><span style="color:var(--text-faint);font-size:0.68rem;">${time}</span></div>`;
                } else {
                    html += `<div style="padding:5px 12px;margin-bottom:2px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;"><span style="color:var(--text-muted);font-size:0.8rem;">@${name}</span><span style="font-family:monospace;font-size:0.82rem;color:var(--text);">${val}</span><span style="color:var(--text-faint);font-size:0.68rem;">${time}</span></div>`;
                }
            });

            list.innerHTML = html;
        }, (err) => {
            console.error('[FAVOR] Hash log error:', err);
            list.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:12px;">Failed to load hashes</div>';
        });
    }

    function announceWinner(value) {
        if (typeof window.nachoGlobalAnnounce !== 'function') return;
        const name = typeof currentUser !== 'undefined' && currentUser && currentUser.username ? currentUser.username : 'Someone';
        window.nachoGlobalAnnounce(`\uD83C\uDFC6 @${name} SOLVED A BLOCK with hash ${value.toLocaleString()}! 21,000 sats earned! \u26CF\uFE0F \u27A1\uFE0F [Satoshi's Favor](#favor)`, auth.currentUser ? auth.currentUser.uid : '');
    }

    // ─── CONTRIBUTION HOOKS ───
    window.contributeSatoshiFavor = async function(source, detail) {
        if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) return;
        var wasFavorActive = favorState && favorState.favorActive;
        var username = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'A community member';

        try {
            const fn = firebase.functions().httpsCallable('contributeFavor');
            const result = await fn({ source, detail });
            const data = result.data;

            var howEarned = '';
            if (source === 'level_up') {
                howEarned = '@' + username + ' leveled up to ' + (detail || 'a new rank') + '!';
            } else if (source === 'level_up_5') {
                howEarned = '@' + username + ' leveled up to ' + (detail || 'a new rank') + '! (+5 points)';
            } else if (source === 'level_up_10') {
                howEarned = '@' + username + ' leveled up to ' + (detail || 'a new rank') + '! (+10 points)';
            } else if (source === 'badge_earned') {
                howEarned = '@' + username + ' earned a badge: ' + (detail || '🏅') + '!';
            }

            var SF_BONUS_PER_POINT = 3;
            var sourcePoints = { 'daily_all_three': 1, 'level_up': 1, 'level_up_5': 5, 'level_up_10': 10, 'badge_earned': 1 };
            var earnedPoints = sourcePoints[source] || 1;
            var bonusAdded = earnedPoints * SF_BONUS_PER_POINT;

            if (data.favorActive && !wasFavorActive) {
                var _sfAct = parseInt(localStorage.getItem('btc_sf_activations') || '0') + 1;
                localStorage.setItem('btc_sf_activations', _sfAct.toString());
                var activateMsg = '⛏️ SATOSHI\'S FAVOR IS NOW ACTIVE!';
                if (howEarned) activateMsg += ' ' + howEarned;
                activateMsg += ' Mine now for 60 minutes! ➡️ [Satoshi\'s Favor](#favor)';
                window.nachoGlobalAnnounce && window.nachoGlobalAnnounce(activateMsg, '');
            } else if (data.favorActive && wasFavorActive) {
                if (typeof window.nachoGlobalAnnounce === 'function') {
                    var extMsg;
                    if (source === 'daily_all_three') {
                        extMsg = '⛏️ @' + username + "'s daily trifecta extended Satoshi's Favor by +" + bonusAdded + ' minutes! ⏳ ➡️ [Satoshi\'s Favor](#favor)';
                    } else if (howEarned) {
                        extMsg = '🦌 ' + howEarned + ' Satoshi extended his blessing! +' + bonusAdded + ' bonus minutes ⏳ ➡️ [Satoshi\'s Favor](#favor)';
                    }
                    if (extMsg) window.nachoGlobalAnnounce(extMsg, '');
                }
            } else if (!data.favorActive && howEarned) {
                var ptsRem = 21 - (data.points || 0);
                if (ptsRem > 0 && typeof window.nachoGlobalAnnounce === 'function') {
                    var ptLabel = earnedPoints > 1 ? ('+' + earnedPoints) : '+1';
                    window.nachoGlobalAnnounce('🦌 ' + howEarned + ' ' + ptLabel + ' toward Satoshi\'s Favor! ' + ptsRem + ' more to go ⛏️ ➡️ [Satoshi\'s Favor](#favor)', '');
                }
            }

            return data;
        } catch (err) {
            console.error('[FAVOR] Contribution error:', err);
            throw err;
        }
    };

    // ─── ANNOUNCEMENTS ───
    window.announceSatoshiFavorProgress = function(pointsRemaining) {
        if (typeof window.nachoGlobalAnnounce !== 'function') return;

        const msgs = [
            `🦌 The community just earned a Satoshi's Favor point! ${pointsRemaining} more to activate mining! ⛏️ ➡️ [Satoshi's Favor](#favor)`,
            `🦌 +1 to Satoshi's Favor! Only ${pointsRemaining} points needed to start mining! ⛏️ ➡️ [Satoshi's Favor](#favor)`,
            `🦌 Getting closer! ${pointsRemaining} more points and Satoshi's Favor activates! ⛏️ ➡️ [Satoshi's Favor](#favor)`
        ];
        const msg = msgs[Math.floor(Math.random() * msgs.length)];
        window.nachoGlobalAnnounce(msg, '');
    };

    window.announceSatoshiFavorCompleted = function(pointsRemaining) {
        if (typeof window.nachoGlobalAnnounce !== 'function') return;
        window.nachoGlobalAnnounce(`🦌 Daily quests completed! ${pointsRemaining} more points needed for Satoshi's Favor! ⛏️ ➡️ [Satoshi's Favor](#favor)`, '');
    };

    // ─── UTILS ───
    function escapeHtml(s) {
        return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function showToast(msg) {
        if (typeof window.showToast === 'function') window.showToast(msg);
        else console.log('[FAVOR]', msg);
    }

    window._closeAnyOverlay = function() {
        document.querySelectorAll('[id$="Overlay"]').forEach(function(el) {
            if (el.id.includes('chat')) return;
            el.remove();
        });
    };

    // ─── EXPORTS ───
    window._renderFavorChatBanner = renderChatBanner;
    window._renderSatoshiFavorHome = renderHomeBanner;

    // ─── START ───
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSatoshiFavor);
    } else {
        initSatoshiFavor();
    }
})();
