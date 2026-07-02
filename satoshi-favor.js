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
    // 2026-06-21  |  30,000 |      0       | -96.67% difficulty drop — no winner in 19 days, ~1:3,333 odds now
    // 2026-06-30  |  15,000 |      0       | +100% difficulty raise — tightening odds to ~1:6,667
    // 2026-07-02  |  10,000 |      0       | +50% difficulty raise — tightening odds to ~1:10,000
    const DIFFICULTY_TARGET = 10000;
    // ── Difficulty history (ordered oldest→newest) ─────────────────
    // Add a new entry here whenever the target changes. quests.js reads
    // window.SF_DIFFICULTY_HISTORY to render the Difficulty History table
    // automatically — no manual HTML edits needed.
    const SF_DIFFICULTY_HISTORY = [
        { date: '2026-06-02', target: 1000,  label: 'Genesis' },
        { date: '2026-06-21', target: 30000, label: '-96.67% drop' },
        { date: '2026-06-30', target: 15000, label: '+100% raise' },
        { date: '2026-07-02', target: 10000, label: '+50% raise' },
    ];
    window.SF_DIFFICULTY_TARGET  = DIFFICULTY_TARGET;   // expose for other modules
    window.SF_DIFFICULTY_HISTORY = SF_DIFFICULTY_HISTORY; // expose for difficulty table
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
        var val = Math.max(0, n);
        localStorage.setItem('btc_sf_window_streak', String(val));
        // Persist to Firestore so streak survives new device / session
        try {
            if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser && !firebase.auth().currentUser.isAnonymous && firebase.firestore) {
                firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid)
                    .update({ sfWindowStreak: val }).catch(function() {});
            }
        } catch(e) {}
    }

    // Effective hash rate per minute (may be boosted by streak or weekly boost)
    // Community heat bonus: +1 hash/min per 1000 community hashes, capped at +10
    function _sfCommunityHeatBonus() {
        return Math.min(10, Math.floor((_sfTotalHashes || 0) / 1000));
    }

    function _sfEffectiveRate() {
        var base = HASHES_PER_MINUTE;
        // Streak boost: +5 flat
        if (_sfGetStreak() >= 3) base = 15;
        // Community-wide 2x boost: doubles the base (applied before heat stacking)
        if (window._sfBoostActive) base = base * 2;
        // Community heat bonus: +1 per 1000 hashes, caps at +10 (stacks additively)
        base += _sfCommunityHeatBonus();
        return base;
    }

    // Feature 4: Community heat meter state
    var _sfTotalHashes = 0;

    // ─── SF CHAT + NEWS ANNOUNCEMENTS ───
    var SF_ANNOUNCE_DEDUP_MS = 4 * 60 * 60 * 1000; // 4 hours — fallback dedup
    function _nachoSFAnnounce(type) {
        if (typeof db === 'undefined' || !db) return;
        if (typeof auth === 'undefined' || !auth || !auth.currentUser) return;
        var uid = auth.currentUser.uid;
        var isAdmin = auth.currentUser.email &&
            (auth.currentUser.email === 'needcreations@gmail.com' || auth.currentUser.email === 'info.603btc@gmail.com' || auth.currentUser.email === 'najemchris8@gmail.com');
        var nachoUid = isAdmin ? 'nacho-bot' : uid;
        var msg = type === 'start'
            ? "⛏️ **Satoshi's Favor has begun!** The community earned enough points — the mining window is now OPEN! Head to the Quest Hub and start hashing. Every hash is a chance to win 21,000 sats! ⚡🦌\nhttps://bitcoineducation.quest/#sf"
            : "⏱️ **Satoshi's Favor has ended.** The mining window is now closed — great effort everyone! Keep earning points to trigger the next one. Completing daily activities, earning badges and ranking up all get us closer to mining again. 🦌";

        // Dedup key: cycle-scoped so a stale tab reconnecting after >4h can't re-fire
        // 'end' is keyed to the cycleId that just ended — a new cycle gets a fresh key.
        // 'start' is also cycle-scoped so double-fires are blocked for the same window.
        var cycleId = (favorState && favorState.currentCycleId) || 'unknown';
        var field = type === 'start' ? ('startAnnounced_' + cycleId) : ('endAnnounced_' + cycleId);

        var dedupRef = db.collection('satoshiFavor').doc('announceDedup');
        db.runTransaction(function(txn) {
            return txn.get(dedupRef).then(function(doc) {
                var data = doc.exists ? doc.data() : {};
                // Cycle-scoped: if this cycleId was already announced for this type, skip
                if (data[field]) {
                    throw Object.assign(new Error('sf_already_announced'), { _dedupSkip: true });
                }
                // Fallback: also block if announced within 4h (handles unknown/missing cycleId edge case)
                var legacyField = type === 'start' ? 'startAnnouncedAt' : 'endAnnouncedAt';
                var legacy = data[legacyField];
                var legacyMs = legacy && legacy.toMillis ? legacy.toMillis() : (typeof legacy === 'number' ? legacy : 0);
                if (legacyMs && (Date.now() - legacyMs) < SF_ANNOUNCE_DEDUP_MS) {
                    throw Object.assign(new Error('sf_already_announced'), { _dedupSkip: true });
                }
                var patch = {};
                patch[field] = firebase.firestore.FieldValue.serverTimestamp();
                patch[legacyField] = firebase.firestore.FieldValue.serverTimestamp();
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
        // Refresh secondRigCharges from Firestore before rendering modal
        // so a rig purchased in the Nook always shows up without a page reload
        var uid = (typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) ? auth.currentUser.uid : null;
        if (uid && typeof db !== 'undefined') {
            db.collection('users').doc(uid).get().then(function(doc) {
                if (doc.exists) {
                    var fresh = doc.data();
                    if (typeof currentUser !== 'undefined' && currentUser) {
                        currentUser.secondRigCharges = fresh.secondRigCharges || 0;
                        currentUser.hashBoosterHashes = fresh.hashBoosterHashes || 0;
                    }
                }
                showMinerModal();
            }).catch(function() { showMinerModal(); });
        } else {
            showMinerModal();
        }
    };

    window.closeSatoshiFavorMiner = function() {
        const overlay = document.getElementById('satoshiFavorMinerOverlay');
        if (overlay) overlay.remove();
        if (hashListener) hashListener();
        if (sessionLeaderboardUnsub) { sessionLeaderboardUnsub(); sessionLeaderboardUnsub = null; }
        if (minerCountdownInterval) clearInterval(minerCountdownInterval);
        if (window._sfCooldownTimer) clearInterval(window._sfCooldownTimer);
        if (window.closeSatoshiFavorMiner._toastTimer) clearTimeout(window.closeSatoshiFavorMiner._toastTimer);
        // Do NOT reset _sfSecondRigConsumedCycle here — charge is consumed for the whole SF window,
        // not just one miner session. Closing and reopening should not restore the rig.
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
    // Heat tiers: every 1,000 hashes = +1 hash/min for ALL users (caps at 10,000 = +10)
    function _buildHeatMeterHTML() {
        var total = _sfTotalHashes || 0;
        var MAX_HEAT = 10000;
        var pct = Math.min(100, (total / MAX_HEAT) * 100);
        var bonus = Math.min(10, Math.floor(total / 1000));

        // Color gradient: blue → orange → red → deep crimson as heat climbs
        var color;
        if      (total <  1000) color = '#3b82f6';          // cool blue
        else if (total <  2000) color = '#f59e0b';          // amber
        else if (total <  3000) color = '#f97316';          // orange
        else if (total <  4000) color = '#ef4444';          // red
        else if (total <  6000) color = '#dc2626';          // deep red
        else if (total <  8000) color = '#b91c1c';          // darker red
        else                    color = '#7f1d1d';          // near-black crimson

        var emoji = total < 1000 ? '🌡️' : total < 3000 ? '🔥' : total < 6000 ? '🔥🔥' : '🚨🔥';

        var bonusLabel = bonus > 0
            ? '<span style="font-size:0.72rem;color:' + color + ';font-weight:800;">+' + bonus + ' bonus hashes/min</span>'
            : '<span style="font-size:0.72rem;color:var(--text-faint);">1,000 community hashes = +1/min for everyone</span>';

        var nextTier = bonus < 10 ? ((bonus + 1) * 1000) : null;
        var nextLabel = nextTier
            ? '<span style="font-size:0.68rem;color:var(--text-faint);">Next: +' + (bonus + 1) + '/min @ ' + nextTier.toLocaleString() + ' hashes</span>'
            : '<span style="font-size:0.68rem;color:#22c55e;font-weight:700;">🏆 MAX HEAT — +10/min!</span>';

        var bar = '<div style="height:10px;background:var(--border);border-radius:5px;overflow:hidden;margin-top:6px;position:relative;">' +
            '<div style="height:100%;width:' + pct.toFixed(1) + '%;background:' + color + ';border-radius:5px;transition:width 0.6s;box-shadow:0 0 ' + (bonus * 2) + 'px ' + color + ';"></div>' +
            '</div>';

        return '<div id="sfHeatMeter" style="padding:10px 12px;background:var(--card-bg);border:1px solid ' + (bonus > 0 ? color : 'var(--border)') + ';border-radius:10px;margin-bottom:10px;transition:border-color 0.5s;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<span style="font-size:0.8rem;font-weight:700;color:var(--heading);">' + emoji + ' Community Heat</span>' +
            '<span style="font-size:0.78rem;color:' + color + ';font-weight:800;">' + total.toLocaleString() + ' / 10,000</span>' +
            '</div>' + bar +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;">' +
            bonusLabel + nextLabel +
            '</div>' +
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
        // If this SF window's charge was already consumed (even if miner was closed+reopened), treat as no rig
        var _cycleNow = (favorState && favorState.currentCycleId) || 'unknown';
        var hasSecondRig = (u.secondRigCharges || 0) > 0 && window._sfSecondRigConsumedCycle !== _cycleNow;
        var boosterHashes = u.hashBoosterHashes || 0;

        const overlay = document.createElement('div');
        overlay.id = 'satoshiFavorMinerOverlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:100001;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);padding:20px;';
        overlay.onclick = (e) => { if (e.target === overlay) window.closeSatoshiFavorMiner(); };

        // Determine effective hash rate
        var effectiveRateDisplay = _sfEffectiveRate();

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
            '<div id="sfRateInfoBox" style="background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:10px;padding:12px;margin-bottom:16px;font-size:0.8rem;color:var(--text-muted);">' +
            'Generate a hash (0–100,000,000). If your hash is below <strong style="color:#22c55e;">' + DIFFICULTY_TARGET.toLocaleString() + '</strong> (the difficulty target), you win <strong style="color:var(--accent);">21,000 sats!</strong> That\'s a 1 in 10,000 chance per hash (~0.01%). You get <strong style="color:var(--accent);" id="sfRateInfoNum">' + effectiveRateDisplay + '</strong> hashes per minute.' +
            '</div>' +
            '<div style="text-align:center;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-muted);">Time Remaining</div>' +
            '<div id="minerCountdown" style="font-size:2rem;font-weight:900;color:var(--accent);font-family:monospace;">--:--:--</div>' +
            '</div>' +
            '<div style="text-align:center;margin-bottom:16px;min-height:148px;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
            '<div id="minerVisual" style="font-size:4rem;line-height:1;transition:transform 0.1s;">⛏️</div>' +
            '<div id="hashOutput" style="font-size:1.3rem;font-weight:800;margin-top:8px;font-family:monospace;color:var(--heading);">Ready to mine</div>' +
            '<div id="hashMessage" style="font-size:0.85rem;color:var(--text-muted);margin-top:4px;min-height:2.4em;line-height:1.2;"></div>' +
            // Feature 3: Near-miss toast container — visibility toggle keeps layout stable
            '<div id="sfNearMissToast" style="visibility:hidden;margin-top:8px;padding:8px 12px;background:rgba(247,147,26,0.15);border:1px solid rgba(247,147,26,0.4);border-radius:10px;font-size:0.8rem;font-weight:700;color:#f7931a;"></div>' +
            '</div>' +
            '<div style="display:flex;justify-content:center;gap:20px;margin-bottom:16px;font-size:0.8rem;">' +
            '<div style="text-align:center;"><div style="color:var(--text-muted);">Target</div><div style="font-weight:800;color:#22c55e;">&lt; ' + DIFFICULTY_TARGET + '</div></div>' +
            '<div style="text-align:center;"><div style="color:var(--text-muted);">Odds</div><div style="font-weight:800;">1:10,000</div></div>' +
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
        var thisCycleId = favorState.currentCycleId;

        // Filter by cycleId so leaderboard only shows hashes from THIS window
        sessionLeaderboardUnsub = db.collection('satoshiFavor').doc('current')
            .collection('session_hashes')
            .where('cycleId', '==', thisCycleId)
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
        '😤 Agonizingly close. Satoshi felt that one.',
        '🎰 That\'s not a miss — that\'s a warmup. Hit it again!',
        '⚔️ You\'re within striking distance. ONE MORE!',
        '💨 That hash brushed the target on its way past. SO CLOSE.',
        '🧲 You\'re in the zone! The winning hash is nearby!',
        '🏹 Arrow grazed the bullseye. Notch another one!',
        '🪙 Satoshi is watching. That was dangerously close to 21M sats.',
        '🔑 You just about unlocked the block. Try again — now!',
        '⛏️ The mining gods are teasing you. Don\'t let them win!',
        '🥵 That hash had YOUR NAME on it. Almost!',
        '💥 TANTALIZINGLY close. The target can smell your breath.',
        '🎯 Snipers would call that a graze. Keep firing!',
        '🚀 T-minus inches from a win. Full throttle!',
        '🧊 Ice cold focus — you\'re dialed in. ONE MORE HASH.',
        '🧬 Your hash DNA is mutating toward victory. Almost there!',
        '⚡ Lightning missed the rod by millimeters. Strike again!',
        '🏆 Within 15% of glory. Most miners never get this close.',
        '🌊 Riding the wave right to shore. Don\'t wipe out now!',
        '🎸 That hash RIPPED. And fell one thread short of the win.',
        '🦌 Nacho believes in you. That was VERY close!',
        '🔥 The network can feel the heat coming off your rig. KEEP GOING!',
    ];
    var _unluckyMessages = [
        '💀 Satoshi saw that hash and cringed.',
        '😂 That hash was so far off it looped around. Almost.',
        '🎲 That was statistically one of the worst hashes possible. Respect.',
        '📉 That hash is giving bear market energy.',
        '☠️ If hashes were grades, that one just failed summer school.',
        '🪣 You didn\'t just miss — you missed in the wrong galaxy.',
        '🗑️ That hash walked past the target doing a 180 the entire time.',
        '💸 That hash is the on-chain fee equivalent of absolutely terrible.',
        '🐢 Somewhere a GPU is embarrassed on your behalf.',
        '😬 That hash peaked at the absolute worst end of the spectrum. Bold.',
        '🦆 That hash quacked. It did not mine.',
        '🤡 The clown nose just honked on that one. Try again champ.',
        '📡 Signal lost. Hash sent to the wrong blockchain entirely.',
        '🌵 Dry. Barren. That hash was a desert.',
        '🔇 Satoshi has left the chat after seeing that hash.',
        '😩 That\'s in the bottom 20%. You\'re basically anti-mining.',
        '🧻 That hash was softer than fiat. And we all know how that ends.',
        '🏴‍☠️ Even Craig Wright\'s fake Bitcoin wouldn\'t claim that hash.',
        '💔 That hash told the target it needs some space.',
        '🎻 The world\'s smallest violin is playing for that hash.',
        '🐌 Slower than a Blockstream satellite uplink on a cloudy day.',
        '🧲 That hash repelled the target like gold repels the Federal Reserve.',
        '🍀 You have ALL the luck — unfortunately it\'s the bad kind.',
        '🪦 R.I.P. that hash. Gone but not close enough.',
        '🦖 That hash is so far from target it\'s practically pre-Satoshi.',
    ];
    var _nmLastIdx = -1;
    var _ulLastIdx = -1;

    function _pickRandom(pool, lastIdx) {
        if (pool.length <= 1) return { msg: pool[0] || '', idx: 0 };
        var idx;
        do { idx = Math.floor(Math.random() * pool.length); } while (idx === lastIdx);
        return { msg: pool[idx], idx: idx };
    }

    function _showNearMissToast(msg) {
        var el = document.getElementById('sfNearMissToast');
        if (!el) return;
        el.textContent = msg;
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        if (window._sfNMTimer) clearTimeout(window._sfNMTimer);
        window._sfNMTimer = setTimeout(function() {
            var e2 = document.getElementById('sfNearMissToast');
            if (e2) { e2.style.visibility = 'hidden'; e2.style.opacity = '0'; }
        }, 3500);
    }

    function _checkNearMissUnlucky(value) {
        if (value <= DIFFICULTY_TARGET) return; // Won — don't show
        var nearMissThreshold = Math.floor(DIFFICULTY_TARGET * 1.15);
        var unluckyThreshold = Math.floor(HASH_MAX * 0.85);

        if (value <= nearMissThreshold) {
            var pick = _pickRandom(_nearMissMessages, _nmLastIdx);
            _nmLastIdx = pick.idx;
            _showNearMissToast(pick.msg);
        } else if (value > unluckyThreshold) {
            var pick2 = _pickRandom(_unluckyMessages, _ulLastIdx);
            _ulLastIdx = pick2.idx;
            _showNearMissToast(pick2.msg);
        }
    }

    // ─── Feature 4: Heat meter updater (called after each hash) ───
    function _updateHeatMeterDisplay() {
        var el = document.getElementById('sfHeatMeter');
        if (!el) return;
        _sfTotalHashes++;
        el.outerHTML = _buildHeatMeterHTML();
        // Also refresh the rate display in the info box (heat bonus may have ticked up)
        var rateEl = document.getElementById('sfRateInfoNum');
        if (rateEl) rateEl.textContent = _sfEffectiveRate();
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

        // Feature 6: Booster hashes bypass the cooldown entirely.
        // When boosterHashes > 0, skip the rate-limit check — server will also skip it and decrement.
        // Once exhausted, cooldown resumes as normal.
        var now60 = Date.now();
        var allTs = (rig === 2) ? hashTimestamps2 : hashTimestamps;
        allTs = allTs.filter(function(t) { return now60 - t < HASH_WINDOW_MS; });
        if (rig === 2) hashTimestamps2 = allTs; else hashTimestamps = allTs;

        if (boosterHashes <= 0) {
            // Normal rate limit check
            if (allTs.length >= effectiveRate) {
                var oldest = allTs[0];
                var waitMs = HASH_WINDOW_MS - (now60 - oldest);
                showToast((rig === 2 ? 'Rig 2 rate limit: ' : 'Rate limit: ') + Math.ceil(waitMs / 1000) + 's ('+effectiveRate+'/min)');
                return;
            }
        }
        // If booster active, skip rate-limit check — server handles decrement

        if (btn) { btn.disabled = true; btn.textContent = (rig === 2 ? '⛏️ RIG 2...' : '⛏️ HASHING...'); btn.style.opacity = '0.7'; }

        let shake = setInterval(() => {
            if (visual) visual.style.transform = `rotate(${Math.random() * 10 - 5}deg) scale(${0.95 + Math.random() * 0.1})`;
            if (output) output.textContent = Math.floor(Math.random() * HASH_MAX).toLocaleString();
        }, 50);

        try {
            const fn = firebase.functions().httpsCallable('hashForFavor');
            const result = await fn({ rig: rig });
            clearInterval(shake);

            const { value, isWinner, hashId } = result.data;

            // Record timestamp for this rig
            if (rig === 2) hashTimestamps2.push(Date.now()); else hashTimestamps.push(Date.now());

            // If booster was active, decrement client-side counter so UI stays in sync
            if (typeof currentUser !== 'undefined' && currentUser && (currentUser.hashBoosterHashes || 0) > 0) {
                currentUser.hashBoosterHashes = Math.max(0, (currentUser.hashBoosterHashes || 0) - 1);
            }

            // Rig 2 charge is now consumed server-side in hashForFavor CF.
            // Update client-side counter when server confirms first use this cycle.
            var _cycleId = (favorState && favorState.currentCycleId) || 'unknown';
            if (rig === 2 && window._sfSecondRigConsumedCycle !== _cycleId) {
                window._sfSecondRigConsumedCycle = _cycleId;
                // Reflect decrement in local currentUser so UI updates immediately
                if (typeof currentUser !== 'undefined' && currentUser && (currentUser.secondRigCharges || 0) > 0) {
                    currentUser.secondRigCharges = currentUser.secondRigCharges - 1;
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

            // ---- Lucky / Unlucky badge tracking ----
            if (value < 1000000) {
                var luckyCount = parseInt(localStorage.getItem('btc_sf_lucky_count') || '0') + 1;
                localStorage.setItem('btc_sf_lucky_count', luckyCount);
                if (typeof checkBadges === 'function') checkBadges();
            } else if (value > 99000000) {
                var unluckyCount = parseInt(localStorage.getItem('btc_sf_unlucky_count') || '0') + 1;
                localStorage.setItem('btc_sf_unlucky_count', unluckyCount);
                if (typeof checkBadges === 'function') checkBadges();
            }

            // Feature 4: Update heat meter display (also refreshes rate info)
            _updateHeatMeterDisplay();

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

        const update = () => {
            const now2 = Date.now();
            // Read fresh each tick — heat bonus may have changed
            var effectiveRate = _sfEffectiveRate();

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

            // Optimistically update local favorState so the bar re-renders immediately
            // without waiting for the Firestore listener to fire (can lag 1-3s)
            if (favorState && typeof data.points === 'number') {
                favorState.points = data.points;
                if (typeof data.favorActive === 'boolean') favorState.favorActive = data.favorActive;
                updateAllUIs();
            }

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
                window.nachoGlobalAnnounce && window.nachoGlobalAnnounce(activateMsg, (auth && auth.currentUser) ? auth.currentUser.uid : '');
            } else if (data.favorActive && wasFavorActive) {
                if (typeof window.nachoGlobalAnnounce === 'function') {
                    var extMsg;
                    if (source === 'daily_all_three') {
                        extMsg = '⛏️ @' + username + "'s daily trifecta extended Satoshi's Favor by +" + bonusAdded + ' minutes! ⏳ ➡️ [Satoshi\'s Favor](#favor)';
                    } else if (howEarned) {
                        extMsg = '🦌 ' + howEarned + ' Satoshi extended his blessing! +' + bonusAdded + ' bonus minutes ⏳ ➡️ [Satoshi\'s Favor](#favor)';
                    }
                    if (extMsg) window.nachoGlobalAnnounce(extMsg, (auth && auth.currentUser) ? auth.currentUser.uid : '');
                }
            } else if (!data.favorActive && howEarned) {
                var ptsRem = 21 - (data.points || 0);
                if (ptsRem > 0 && typeof window.nachoGlobalAnnounce === 'function') {
                    var ptLabel = earnedPoints > 1 ? ('+' + earnedPoints) : '+1';
                    window.nachoGlobalAnnounce('🦌 ' + howEarned + ' ' + ptLabel + ' toward Satoshi\'s Favor! ' + ptsRem + ' more to go ⛏️ ➡️ [Satoshi\'s Favor](#favor)', (auth && auth.currentUser) ? auth.currentUser.uid : '');
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
    // Expose SF active check for other modules (e.g. badge announcements)
    window._isSatoshiFavorActive = function() {
        return !!(favorState && favorState.favorActive && isFavorEffectivelyActive());
    };

    // ─── FLOAT WIDGET ───────────────────────────────────────────────────────────
    // Small persistent mining button shown anywhere in the app while SF is active.
    // Lets users hash without leaving TCTV (or any other page).
    var _sfFloatCooldownTimer = null;
    var _sfFloatShown = false;
    var _sfFloatTCTVNudgeDone = false;

    function _sfUpdateFloat() {
        var isActive = !!(favorState && favorState.favorActive && isFavorEffectivelyActive());
        var isLoggedIn = !!(typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous);

        // Remove widget if SF ended or user logged out
        if (!isActive || !isLoggedIn) {
            var existing = document.getElementById('sfFloatWidget');
            if (existing) {
                existing.style.transform = 'scale(0)';
                setTimeout(function() { if (existing.parentNode) existing.remove(); }, 200);
            }
            if (_sfFloatCooldownTimer) { clearInterval(_sfFloatCooldownTimer); _sfFloatCooldownTimer = null; }
            _sfFloatShown = false;
            return;
        }

        // Create widget if not present
        if (!document.getElementById('sfFloatWidget')) {
            var w = document.createElement('div');
            w.id = 'sfFloatWidget';
            w.style.cssText = [
                'position:fixed',
                'bottom:145px',              // above mobile bottom nav + FAB row
                'right:14px',
                'z-index:9000',
                'display:flex',
                'flex-direction:column',
                'align-items:center',
                'gap:5px',
                'transform:scale(0)',
                'transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            ].join(';');

            w.innerHTML =
                // Hash button
                '<button id="sfFloatBtn" onclick="window._sfFloatHash()" style="' +
                    'width:54px;height:54px;border-radius:50%;' +
                    'background:linear-gradient(135deg,#f7931a,#e8720c);' +
                    'border:none;color:#fff;font-size:1.4rem;cursor:pointer;' +
                    'box-shadow:0 4px 16px rgba(247,147,26,0.5);' +
                    'display:flex;align-items:center;justify-content:center;' +
                    'font-family:inherit;transition:transform 0.15s,opacity 0.15s;' +
                    'touch-action:manipulation;">⛏️</button>' +
                // Cooldown label
                '<div id="sfFloatLabel" style="' +
                    'font-size:0.58rem;font-weight:800;color:#f7931a;' +
                    'background:rgba(0,0,0,0.7);padding:2px 6px;border-radius:6px;' +
                    'white-space:nowrap;pointer-events:none;letter-spacing:0.3px;">HASH</div>' +
                // TCTV link hint
                '<a href="#timechain-tv" onclick="if(typeof go===\'function\'){go(\'timechain-tv\');} return false;" style="' +
                    'font-size:0.52rem;color:rgba(255,255,255,0.7);text-decoration:none;' +
                    'background:rgba(0,0,0,0.5);padding:2px 5px;border-radius:5px;' +
                    'white-space:nowrap;letter-spacing:0.2px;' +
                    'transition:color 0.15s;">📺 TCTV</a>';

            document.body.appendChild(w);

            // Animate in
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    w.style.transform = 'scale(1)';
                });
            });

            // One-time TCTV nudge toast after 3s
            if (!_sfFloatTCTVNudgeDone) {
                _sfFloatTCTVNudgeDone = true;
                setTimeout(function() {
                    if (typeof showToast === 'function') {
                        showToast('⛏️ Satoshi\'s Favor is live! Tap the orange button to hash from anywhere — <a href="#timechain-tv" onclick="if(typeof go===\'function\'){go(\'timechain-tv\');}" style="color:#f7931a;font-weight:700;">even while watching Timechain TV</a>! 📺', 6000);
                    }
                }, 3000);
            }

            _sfFloatShown = true;
        }

        // Start cooldown ticker
        if (!_sfFloatCooldownTimer) {
            _sfFloatCooldownTimer = setInterval(_sfFloatTickCooldown, 500);
        }
    }

    function _sfFloatTickCooldown() {
        var label = document.getElementById('sfFloatLabel');
        var btn = document.getElementById('sfFloatBtn');
        if (!label || !btn) { clearInterval(_sfFloatCooldownTimer); _sfFloatCooldownTimer = null; return; }

        // Calculate time until next hash is available
        var effectiveRate = _sfEffectiveRate();
        var now = Date.now();
        var recent = hashTimestamps.filter(function(t) { return now - t < HASH_WINDOW_MS; });
        var canHash = recent.length < effectiveRate;

        if (canHash) {
            label.textContent = 'HASH';
            btn.style.opacity = '1';
            btn.style.transform = 'scale(1)';
        } else {
            // Show seconds until oldest ts falls outside the window
            var oldest = recent[0];
            var waitMs = HASH_WINDOW_MS - (now - oldest);
            var waitSec = Math.ceil(waitMs / 1000);
            label.textContent = waitSec + 's';
            btn.style.opacity = '0.55';
        }
    }

    window._sfFloatHash = async function() {
        var btn = document.getElementById('sfFloatBtn');
        var label = document.getElementById('sfFloatLabel');

        // Check logged in
        if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
            if (typeof showToast === 'function') showToast('Sign in to mine!');
            return;
        }
        if (!favorState || !favorState.favorActive) {
            if (typeof showToast === 'function') showToast('Satoshi\'s Favor is not active.');
            return;
        }

        // Check client-side rate limit
        var effectiveRate = _sfEffectiveRate();
        var now = Date.now();
        hashTimestamps = hashTimestamps.filter(function(t) { return now - t < HASH_WINDOW_MS; });
        if ((typeof currentUser === 'undefined' || !currentUser || !(currentUser.hashBoosterHashes > 0)) && hashTimestamps.length >= effectiveRate) {
            var oldest = hashTimestamps[0];
            var waitSec = Math.ceil((HASH_WINDOW_MS - (now - oldest)) / 1000);
            if (typeof showToast === 'function') showToast('⏳ ' + waitSec + 's until next hash');
            return;
        }

        // Animate button
        if (btn) { btn.textContent = '💫'; btn.style.transform = 'scale(0.88)'; btn.style.opacity = '0.7'; }
        if (label) label.textContent = '...';

        try {
            var fn = firebase.functions().httpsCallable('hashForFavor');
            var result = await fn({ rig: 1 });
            var data = result.data;
            var value = data.value;
            var isWinner = data.isWinner;

            // Record timestamp
            hashTimestamps.push(Date.now());

            // Decrement booster if active
            if (typeof currentUser !== 'undefined' && currentUser && (currentUser.hashBoosterHashes || 0) > 0) {
                currentUser.hashBoosterHashes = Math.max(0, currentUser.hashBoosterHashes - 1);
            }

            if (btn) { btn.textContent = isWinner ? '🏆' : '⛏️'; btn.style.transform = 'scale(1)'; btn.style.opacity = '1'; }

            if (isWinner) {
                if (typeof showToast === 'function') showToast('🏆 YOU WON! Hash: ' + value.toLocaleString() + ' — 21,000 sats incoming!', 6000);
                if (typeof window.launchConfetti === 'function') window.launchConfetti();
            } else {
                // Brief flash of the hash value in the label
                if (label) {
                    label.textContent = value.toLocaleString();
                    setTimeout(function() { _sfFloatTickCooldown(); }, 1200);
                }
                if (typeof showToast === 'function') showToast('⛏️ Hash: ' + value.toLocaleString() + (value < 100000 ? ' 🔥 So close!' : ''), 2000);
            }

            // Update SF hashes count for badges
            var hc = parseInt(localStorage.getItem('btc_sf_hashes') || '0') + 1;
            localStorage.setItem('btc_sf_hashes', hc.toString());

        } catch(e) {
            if (btn) { btn.textContent = '⛏️'; btn.style.transform = 'scale(1)'; btn.style.opacity = '1'; }
            var msg = (e && e.message) || '';
            if (msg.indexOf('rate') !== -1 || msg.indexOf('exhausted') !== -1) {
                if (typeof showToast === 'function') showToast('⏳ Rate limit — wait a moment');
            } else {
                if (typeof showToast === 'function') showToast('Hash failed — try again');
            }
            console.error('[SF FLOAT] Hash error:', msg);
        }
    };

    // Hook into updateAllUIs so widget appears/disappears with SF state changes
    var _origUpdateAllUIs = typeof updateAllUIs === 'function' ? updateAllUIs : null;
    function _sfFloatHookUpdateAllUIs() { _sfUpdateFloat(); }
    // Patch updateAllUIs to also call float update
    if (typeof updateAllUIs === 'function') {
        var _updateAllUIsOrig = updateAllUIs;
        updateAllUIs = function() {
            _updateAllUIsOrig();
            _sfUpdateFloat();
        };
    }

    // ─── START ───
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSatoshiFavor);
    } else {
        initSatoshiFavor();
    }
})();
