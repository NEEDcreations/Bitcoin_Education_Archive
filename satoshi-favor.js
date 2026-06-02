/**
 * Satoshi's Favor - Client-side module
 */
(function() {
    'use strict';

    const DIFFICULTY_TARGET = 1000;
    const HASH_MAX = 100000000;
    const COOLDOWN_SECONDS = 60; // 10 hashes per 60 seconds = 1 every 60 seconds (max 10 per minute enforced by server)
    const POINTS_TARGET = 21;

    let favorState = null;
    let favorUnsub = null;
    let countdownInterval = null;
    let minerCountdownInterval = null;
    let hashListener = null;
    let lastHashTime = 0;

    // ─── INIT ───
    function initSatoshiFavor() {
        if (typeof db === 'undefined' || !db) {
            setTimeout(initSatoshiFavor, 2000);
            return;
        }
        listenToFavorState();
        console.log('[FAVOR] Initialized');
    }

    // ─── LISTENER ───
    function listenToFavorState() {
        console.log('[FAVOR] Starting listener...');
        const stateRef = db.collection('satoshiFavor').doc('current');
        favorUnsub = stateRef.onSnapshot((doc) => {
            console.log('[FAVOR] Got state update, exists:', doc.exists);
            favorState = doc.exists ? doc.data() : { points: 0, favorActive: false };
            console.log('[FAVOR] State:', favorState);
            updateAllUIs();
        }, (err) => console.error('[FAVOR] Listener error:', err));
    }

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
            // Explicit centering
            banner.style.cssText = 'width: 100%; margin: 0 0 20px 0; box-sizing: border-box; align-self: center;';
            
            // Insert at the VERY top of home-inner
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
        const isActive = favorState.favorActive;
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
            const endBase = favorState.favorEndBase ? favorState.favorEndBase.toMillis() : 0;
            const bonusMs = (favorState.bonusMinutes || 0) * 60 * 1000;
            const remaining = (endBase + bonusMs) - Date.now();

            if (remaining <= 0) {
                el.textContent = '00:00:00';
                el.style.color = '#ef4444';
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
        if (minerCountdownInterval) clearInterval(minerCountdownInterval);
    };

    function showMinerModal() {
        const overlay = document.createElement('div');
        overlay.id = 'satoshiFavorMinerOverlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:100001;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);padding:20px;';
        overlay.onclick = (e) => { if (e.target === overlay) window.closeSatoshiFavorMiner(); };

        overlay.innerHTML = `
            <div id="satoshiFavorMinerModal" style="background:var(--bg-side);border:1px solid var(--border);width:100%;max-width:480px;max-height:90vh;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;">
                <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:1.5rem;">✨⛏️</span>
                        <div>
                            <div style="font-weight:800;color:var(--heading);">Satoshi's Favor Mining</div>
                            <div style="font-size:0.75rem;color:var(--text-muted);">Target: &lt; ${DIFFICULTY_TARGET} · Win 21,000 sats!</div>
                        </div>
                    </div>
                    <button onclick="window.closeSatoshiFavorMiner()" style="background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer;">✕</button>
                </div>
                <div style="padding:16px 20px;overflow-y:auto;">
                    <div style="background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:10px;padding:12px;margin-bottom:16px;font-size:0.8rem;color:var(--text-muted);">
                        Generate a hash (0–100,000,000). If below ${DIFFICULTY_TARGET}, you win! That's a <strong style="color:var(--accent);">1 in 100,000</strong> chance. 10 hashes per minute (1 every 6 sec).
                    </div>

                    <div style="text-align:center;margin-bottom:16px;">
                        <div style="font-size:0.75rem;color:var(--text-muted);">Time Remaining</div>
                        <div id="minerCountdown" style="font-size:2rem;font-weight:900;color:var(--accent);font-family:monospace;">--:--:--</div>
                    </div>

                    <div style="text-align:center;margin-bottom:16px;">
                        <div id="minerVisual" style="font-size:4rem;line-height:1;transition:transform 0.1s;">⛏️</div>
                        <div id="hashOutput" style="font-size:1.3rem;font-weight:800;margin-top:8px;font-family:monospace;color:var(--heading);">Ready to mine</div>
                        <div id="hashMessage" style="font-size:0.85rem;color:var(--text-muted);margin-top:4px;min-height:1.2em;"></div>
                    </div>

                    <div style="display:flex;justify-content:center;gap:20px;margin-bottom:16px;font-size:0.8rem;">
                        <div style="text-align:center;"><div style="color:var(--text-muted);">Target</div><div style="font-weight:800;color:#22c55e;">&lt; ${DIFFICULTY_TARGET}</div></div>
                        <div style="text-align:center;"><div style="color:var(--text-muted);">Odds</div><div style="font-weight:800;">1:100,000</div></div>
                        <div style="text-align:center;"><div style="color:var(--text-muted);">Cooldown</div><div id="hashCooldown" style="font-weight:800;color:var(--accent);">Ready</div></div>
                    </div>

                    <button id="minerHashBtn" onclick="window.minerDoHash()" style="width:100%;padding:16px;background:linear-gradient(135deg,var(--accent),#e8720c);border:none;border-radius:12px;color:#fff;font-size:1.1rem;font-weight:800;cursor:pointer;margin-bottom:16px;">⛏️ HASH</button>

                    <div style="border-top:1px solid var(--border);padding-top:12px;">
                        <div style="font-weight:700;color:var(--heading);margin-bottom:8px;">Recent Hashes</div>
                        <div id="hashList" style="max-height:160px;overflow-y:auto;"><div style="color:var(--text-muted);text-align:center;padding:12px;font-size:0.8rem;">Loading...</div></div>
                    </div>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        loadRecentHashes();
        startMinerCountdown();
        updateCooldownDisplay();
    }

    function startMinerCountdown() {
        if (minerCountdownInterval) clearInterval(minerCountdownInterval);

        const tick = () => {
            const el = document.getElementById('minerCountdown');
            if (!el) return;
            if (!favorState || !favorState.favorActive) { el.textContent = 'EXPIRED'; return; }
            const endBase = favorState.favorEndBase ? favorState.favorEndBase.toMillis() : 0;
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

    // ─── HASHING ───
    window.minerDoHash = async function() {
        if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
            showToast('Please sign in to mine.');
            return;
        }

        const btn = document.getElementById('minerHashBtn');
        const visual = document.getElementById('minerVisual');
        const output = document.getElementById('hashOutput');
        const msg = document.getElementById('hashMessage');

        if (!favorState || !favorState.favorActive) {
            showToast('Satoshi\'s Favor has expired.');
            return;
        }

        const elapsed = (Date.now() - lastHashTime) / 1000;
        if (elapsed < COOLDOWN_SECONDS) {
            showToast(`Cooldown: wait ${Math.ceil(COOLDOWN_SECONDS - elapsed)}s`);
            return;
        }

        btn.disabled = true;
        btn.textContent = '⛏️ HASHING...';
        btn.style.opacity = '0.7';

        // Animation
        let shake = setInterval(() => {
            visual.style.transform = `rotate(${Math.random() * 10 - 5}deg) scale(${0.95 + Math.random() * 0.1})`;
            output.textContent = Math.floor(Math.random() * HASH_MAX).toLocaleString();
        }, 50);

        try {
            const fn = firebase.functions().httpsCallable('hashForFavor');
            const result = await fn({});
            clearInterval(shake);

            const { value, isWinner, hashId } = result.data;
            lastHashTime = Date.now();

            visual.style.transform = 'scale(1)';
            output.textContent = value.toLocaleString();
            output.style.color = isWinner ? '#22c55e' : (value < DIFFICULTY_TARGET * 10 ? '#f7931a' : 'var(--text-muted)');

            if (isWinner) {
                msg.innerHTML = '<strong style="color:#22c55e;font-size:1.1rem;">🏆 WINNER! You solved a block!</strong><br>21,000 sats incoming! Check your DMs.';
                visual.textContent = '🎉';
                announceWinner(value);
            } else {
                const diff = value - DIFFICULTY_TARGET;
                msg.textContent = diff < 10000 ? `So close! Only ${diff.toLocaleString()} over target` : `${(value/1000000).toFixed(2)}M · Keep trying!`;
            }

            loadRecentHashes();

        } catch (err) {
            clearInterval(shake);
            visual.style.transform = 'scale(1)';
            output.textContent = 'Error';
            msg.textContent = err.message || 'Hash failed. Try again.';
            console.error('[FAVOR] Hash error:', err);
        }

        btn.disabled = false;
        btn.textContent = '⛏️ HASH';
        btn.style.opacity = '1';
        updateCooldownDisplay();
    };

    function updateCooldownDisplay() {
        const el = document.getElementById('hashCooldown');
        if (!el) return;

        const update = () => {
            const elapsed = (Date.now() - lastHashTime) / 1000;
            const remaining = COOLDOWN_SECONDS - elapsed;
            if (remaining <= 0) {
                el.textContent = 'Ready';
                el.style.color = '#22c55e';
                return;
            }
            el.textContent = `${Math.ceil(remaining)}s`;
            el.style.color = 'var(--accent)';
            setTimeout(update, 1000);
        };
        update();
    }

    function disableHashButton() {
        const btn = document.getElementById('minerHashBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'EXPIRED'; btn.style.opacity = '0.5'; }
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
            .limit(20);

        hashListener = q.onSnapshot((snap) => {
            if (snap.empty) {
                list.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:12px;font-size:0.8rem;">No hashes yet. Be the first!</div>';
                return;
            }

            const myUid = auth && auth.currentUser ? auth.currentUser.uid : null;
            let html = '';

            snap.docs.forEach((doc) => {
                const h = doc.data();
                const isMe = h.uid === myUid;
                const isWin = h.isWinner;
                const val = h.value.toLocaleString();
                const time = h.timestamp ? new Date(h.timestamp.toMillis()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '--:--';

                const bg = isWin ? 'rgba(34,197,94,0.15)' : (isMe ? 'rgba(247,147,26,0.1)' : 'transparent');
                const border = isWin ? '#22c55e' : (isMe ? 'var(--accent)' : 'var(--border)');
                const bold = isMe ? 'font-weight:700;' : '';
                const icon = isWin ? '🏆 ' : '';

                html += `<div style="padding:8px 12px;margin-bottom:4px;background:${bg};border:1px solid ${border};border-radius:8px;display:flex;justify-content:space-between;align-items:center;${bold}"><span>${icon}${escapeHtml(h.username || 'Anon')}</span><span style="font-family:monospace;font-size:0.9rem;">${val}</span><span style="color:var(--text-faint);font-size:0.7rem;">${time}</span></div>`;
            });

            list.innerHTML = html;
        }, (err) => {
            console.error('[FAVOR] Hash log error:', err);
            list.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:12px;">Failed to load hashes</div>';
        });
    }

    function announceWinner(value) {
        if (typeof window.nachoGlobalAnnounce !== 'function') return;
        const name = currentUser && currentUser.username ? currentUser.username : 'Someone';
        window.nachoGlobalAnnounce(`🏆 @${name} SOLVED A BLOCK with hash ${value.toLocaleString()}! 21,000 sats earned! ⛏️ Satoshi's Favor active now!`, auth.currentUser ? auth.currentUser.uid : '');
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

            if (data.favorActive && !wasFavorActive) {
                // Just activated!
                window.nachoGlobalAnnounce && window.nachoGlobalAnnounce(
                    `⛏️ SATOSHI'S FAVOR IS NOW ACTIVE! The community earned enough points! Mine now for 60 minutes!`,
                    ''
                );
            } else if (data.favorActive && wasFavorActive) {
                // Extension — announce how the point was earned
                var howEarned = '';
                if (source === 'quiz_daily_3') {
                    howEarned = '🦌 @' + username + ' completed all 3 daily quests!';
                } else if (source === 'level_up') {
                    howEarned = '🦌 @' + username + ' leveled up to ' + (detail || 'a new rank') + '!';
                } else if (source === 'level_up_5') {
                    howEarned = '🦌 @' + username + ' leveled up to ' + (detail || 'a new rank') + '! (+5 points)';
                } else if (source === 'level_up_10') {
                    howEarned = '🦌 @' + username + ' leveled up to ' + (detail || 'a new rank') + '! (+10 points)';
                }
                if (howEarned && typeof window.nachoGlobalAnnounce === 'function') {
                    window.nachoGlobalAnnounce(howEarned + ' Satoshi extends his blessing. +3 minutes ⏳', '');
                }
            }

            return data;
        } catch (err) {
            console.error('[FAVOR] Contribution error:', err);
            return null;
        }
    };

    // ─── ANNOUNCEMENTS ───
    window.announceSatoshiFavorProgress = function(pointsRemaining) {
        if (typeof window.nachoGlobalAnnounce !== 'function') return;

        const msgs = [
            `🦌 The community just earned a Satoshi's Favor point! ${pointsRemaining} more to activate mining! ⛏️`,
            `🦌 +1 to Satoshi's Favor! Only ${pointsRemaining} points needed to start mining! ⛏️`,
            `🦌 Getting closer! ${pointsRemaining} more points and Satoshi's Favor activates! ⛏️`
        ];
        const msg = msgs[Math.floor(Math.random() * msgs.length)];
        window.nachoGlobalAnnounce(msg, '');
    };

    window.announceSatoshiFavorCompleted = function(pointsRemaining) {
        if (typeof window.nachoGlobalAnnounce !== 'function') return;
        window.nachoGlobalAnnounce(`🦌 Daily quests completed! ${pointsRemaining} more points needed for Satoshi's Favor! ⛏️`, '');
    };

    // ─── UTILS ───
    function escapeHtml(s) {
        return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function showToast(msg) {
        if (typeof window.showToast === 'function') window.showToast(msg);
        else console.log('[FAVOR]', msg);
    }

    // ─── UTILS ───
    window._closeAnyOverlay = function() {
        document.querySelectorAll('[id$="Overlay"]').forEach(function(el) {
            if (el.id.includes('chat')) return; // Don't close chat
            el.remove();
        });
    };

    // ─── EXPORTS ───
    window._resolveFavorState = () => favorState;
    window._renderFavorChatBanner = renderChatBanner;
    window._renderSatoshiFavorHome = renderHomeBanner;

    // ─── START ───
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSatoshiFavor);
    } else {
        initSatoshiFavor();
    }
})();
