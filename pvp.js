// © 2024-2026 603BTC LLC. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
// =============================================
// Bitcoin Education Archive - PVP Trivia Mode
// Real-time 1v1 Bitcoin trivia battles
// =============================================

(function() {
    'use strict';

    // =============================================
    // PVP BADGE DEFINITIONS
    // =============================================
    const PVP_BADGE_DEFS = [
        { id: 'pvp_1',   name: 'First Blood',      emoji: '⚔️', desc: 'Won your first PVP match',     threshold: 1,   pts: 25 },
        { id: 'pvp_5',   name: 'Contender',         emoji: '🥊', desc: 'Won 5 PVP matches',            threshold: 5,   pts: 50 },
        { id: 'pvp_25',  name: 'Gladiator',         emoji: '🏟️', desc: 'Won 25 PVP matches',           threshold: 25,  pts: 100 },
        { id: 'pvp_50',  name: 'Champion',           emoji: '🏆', desc: 'Won 50 PVP matches',           threshold: 50,  pts: 200 },
        { id: 'pvp_100', name: 'PVP Legend',         emoji: '👑', desc: 'Won 100 PVP matches',          threshold: 100, pts: 500 },
    ];

    // Register PVP badges into global BADGE_DEFS if available
    if (typeof BADGE_DEFS !== 'undefined') {
        PVP_BADGE_DEFS.forEach(function(b) {
            var exists = BADGE_DEFS.some(function(d) { return d.id === b.id; });
            if (!exists) {
                BADGE_DEFS.push({
                    id: b.id,
                    name: b.name,
                    emoji: b.emoji,
                    desc: b.desc,
                    pts: b.pts,
                    check: function() {
                        var wins = parseInt(localStorage.getItem('btc_pvp_wins') || '0');
                        return wins >= b.threshold;
                    }
                });
            }
        });
    }

    // =============================================
    // PVP STATE
    // =============================================
    var pvpState = {
        active: false,
        inLobby: false,
        inMatch: false,
        matchId: null,
        lobbyDocId: null,
        opponentName: '',
        opponentUid: '',
        questions: [],
        currentQ: 0,
        myScore: 0,
        opponentScore: 0,
        myCorrect: 0,
        opponentCorrect: 0,
        streak: 0,
        roundWins: 0,     // questions won this round (whoever answers first correctly)
        opponentRoundWins: 0,
        answered: false,
        listenerUnsub: null,
        lobbyUnsub: null,
        tickerUnsub: null,
        isPlayer1: false,
    };

    // =============================================
    // QUESTION POOL — pulls from the QUESTION_BANK
    // =============================================
    function getAllQuestions() {
        if (typeof QUESTION_BANK === 'undefined') return [];
        var all = [];
        var keys = Object.keys(QUESTION_BANK);
        for (var i = 0; i < keys.length; i++) {
            var channelQs = QUESTION_BANK[keys[i]];
            for (var j = 0; j < channelQs.length; j++) {
                all.push(channelQs[j]);
            }
        }
        return all;
    }

    function pickRandomQuestions(count) {
        var pool = getAllQuestions();
        // Shuffle
        for (var i = pool.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
        }
        return pool.slice(0, count);
    }

    function formatQuestionForFirestore(q) {
        // Build shuffled options array with correct answer index
        var options = q.wrong.slice();
        var correctIdx = Math.floor(Math.random() * (options.length + 1));
        options.splice(correctIdx, 0, q.a);
        return { q: q.q, options: options, correct: correctIdx };
    }

    // =============================================
    // UTILITY
    // =============================================
    function getDb() {
        if (typeof firebase === 'undefined' || !firebase.firestore) return null;
        return firebase.firestore();
    }

    function getAuth() {
        if (typeof firebase === 'undefined' || !firebase.auth) return null;
        return firebase.auth();
    }

    function getMyUid() {
        var auth = getAuth();
        return auth && auth.currentUser ? auth.currentUser.uid : null;
    }

    function getMyDisplayName() {
        // Try localStorage username first (the app's display name)
        var name = localStorage.getItem('btc_username');
        if (name) return name;
        var auth = getAuth();
        if (auth && auth.currentUser && auth.currentUser.displayName) return auth.currentUser.displayName;
        return 'Anonymous Pleb';
    }

    // =============================================
    // LOBBY TICKER LISTENER
    // Watches for users waiting in PVP lobby
    // =============================================
    function startLobbyTicker() {
        var db = getDb();
        if (!db) return;

        // Listen to pvp_lobby for waiting players
        if (pvpState.tickerUnsub) pvpState.tickerUnsub();

        pvpState.tickerUnsub = db.collection('pvp_lobby')
            .where('status', '==', 'waiting')
            .onSnapshot(function(snap) {
                var myUid = getMyUid();
                var waitingOthers = [];
                snap.forEach(function(doc) {
                    var d = doc.data();
                    if (d.uid !== myUid) waitingOthers.push(d);
                });

                if (waitingOthers.length > 0 && !pvpState.active) {
                    injectTickerPVP(true);
                    showNachoPVPBubble();
                } else {
                    injectTickerPVP(false);
                }
            }, function(err) {
                console.log('PVP lobby ticker listener error:', err);
            });
    }

    // Inject/remove the PVP ticker message
    var _pvpTickerInjected = false;
    function injectTickerPVP(show) {
        if (show && !_pvpTickerInjected) {
            _pvpTickerInjected = true;
            // Add to TICKER_ITEMS if available
            if (typeof TICKER_ITEMS !== 'undefined') {
                // Remove old one if somehow still present
                for (var i = TICKER_ITEMS.length - 1; i >= 0; i--) {
                    if (TICKER_ITEMS[i].indexOf('PVP MODE') !== -1) TICKER_ITEMS.splice(i, 1);
                }
                TICKER_ITEMS.unshift('ANOTHER PLAYER IS WAITING FOR YOU IN PVP MODE. ⚔️');
            }
        } else if (!show && _pvpTickerInjected) {
            _pvpTickerInjected = false;
            if (typeof TICKER_ITEMS !== 'undefined') {
                for (var i = TICKER_ITEMS.length - 1; i >= 0; i--) {
                    if (TICKER_ITEMS[i].indexOf('PVP MODE') !== -1) TICKER_ITEMS.splice(i, 1);
                }
            }
        }
    }

    // Show Nacho bubble popup linking to PVP mode
    function showNachoPVPBubble() {
        if (pvpState.active || pvpState.inLobby || pvpState.inMatch) return;
        if (window._nachoBusy) return;
        if (window._nachoMode) return;

        var bubble = document.getElementById('nacho-bubble');
        var textEl = document.getElementById('nacho-text');
        if (!bubble || !textEl) return;

        // Don't interrupt interactive bubbles
        if (bubble.classList.contains('show') && bubble.getAttribute('data-interactive') === 'true') return;

        var html = '<div style="margin-bottom:8px;font-weight:700;color:var(--accent);font-size:0.9rem;">⚔️ PVP Challenge!</div>' +
            '<div style="color:var(--text);margin-bottom:10px;line-height:1.5;font-size:0.85rem;">Someone is waiting in the PVP arena! Think you know Bitcoin better?</div>' +
            '<button onmousedown="event.stopPropagation();" ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();enterPVPMode();" style="display:block;width:100%;padding:10px 16px;background:linear-gradient(135deg,#f7931a,#e8720c);border:none;border-radius:10px;color:#fff;font-size:0.85rem;font-weight:800;cursor:pointer;font-family:inherit;text-transform:uppercase;letter-spacing:1px;">Enter PVP Mode ⚔️</button>';

        textEl.innerHTML = html;
        bubble.setAttribute('data-interactive', 'true');
        bubble.classList.add('show');
        if (typeof clearNachoBubbleTimeout === 'function') clearNachoBubbleTimeout();
        if (typeof setPose === 'function') setPose('think');
    }

    // =============================================
    // PVP MODE — ENTRY POINT
    // =============================================
    window.enterPVPMode = function() {
        var auth = getAuth();
        if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
            // Show the sign-in modal with a message
            if (typeof showToast === 'function') showToast('⚔️ Sign in to play PVP Mode!');
            // Try to open the sign-in modal
            var modal = document.getElementById('usernameModal');
            if (modal) {
                modal.classList.add('open');
                // Store intent so after sign-in we can redirect to PVP
                sessionStorage.setItem('btc_pvp_pending', 'true');
            }
            return;
        }

        pvpState.active = true;
        pvpState.inLobby = true;
        pvpState.inMatch = false;

        // Push hash state for direct linking & back-button
        if (window.location.hash !== '#pvp') {
            history.pushState({ channel: 'pvp' }, '', '#pvp');
        }

        // Dismiss Nacho bubble
        var bubble = document.getElementById('nacho-bubble');
        if (bubble) { bubble.classList.remove('show'); bubble.removeAttribute('data-interactive'); }

        // Close apps menu
        var am = document.getElementById('appsMenu');
        if (am) am.style.display = 'none';

        renderPVPLobby();
        joinLobby();
    };

    window.exitPVPMode = function(skipForfeit) {
        var wasInMatch = pvpState.inMatch;
        var wasInLobby = pvpState.inLobby;
        var matchId = pvpState.matchId;
        var myKey = pvpState.isPlayer1 ? 'player1' : 'player2';
        var oppKey = pvpState.isPlayer1 ? 'player2' : 'player1';

        // FORFEIT LOGIC — only if manually leaving (not after match result or disconnect)
        if (wasInMatch && matchId && !skipForfeit) {
            var db = getDb();
            if (db) {
                // Mark self as forfeited in the match doc
                var update = {};
                update['status'] = 'forfeit';
                update['forfeitedBy'] = getMyUid();
                update['forfeitReason'] = 'manual_leave';
                db.collection('pvp_matches').doc(matchId).update(update).catch(function(){});

                // Give leaver a loss
                var losses = parseInt(localStorage.getItem('btc_pvp_losses') || '0') + 1;
                localStorage.setItem('btc_pvp_losses', losses.toString());
                savePVPStats(parseInt(localStorage.getItem('btc_pvp_wins') || '0'), losses);
                if (typeof showToast === 'function') showToast('💀 You forfeited — counted as a loss');
            }
        } else if (wasInLobby && !wasInMatch) {
            // Left lobby before match started — no penalty
            if (typeof showToast === 'function') showToast('⚔️ Left PVP lobby');
        } else if (!wasInMatch && !wasInLobby) {
            if (typeof showToast === 'function') showToast('⚔️ Left PVP Mode');
        }

        cleanupPVP();
        pvpState.active = false;
        pvpState.inLobby = false;
        pvpState.inMatch = false;

        var overlay = document.getElementById('pvpOverlay');
        if (overlay) overlay.remove();

        if (window.location.hash === '#pvp') {
            history.pushState({ home: true }, '', window.location.pathname);
        }
    };

    // =============================================
    // CLEANUP
    // =============================================
    function cleanupPVP() {
        if (pvpState._matchPoll) { clearInterval(pvpState._matchPoll); pvpState._matchPoll = null; }
        if (pvpState._heartbeat) { clearInterval(pvpState._heartbeat); pvpState._heartbeat = null; }
        if (pvpState._forceResultTimer) { clearTimeout(pvpState._forceResultTimer); pvpState._forceResultTimer = null; }
        pvpState._resultShown = false;
        pvpState._matchResultShown = false;
        if (pvpState.listenerUnsub) { pvpState.listenerUnsub(); pvpState.listenerUnsub = null; }
        if (pvpState.lobbyUnsub) { pvpState.lobbyUnsub(); pvpState.lobbyUnsub = null; }

        // Remove lobby entry
        var db = getDb();
        if (db && pvpState.lobbyDocId) {
            db.collection('pvp_lobby').doc(pvpState.lobbyDocId).delete().catch(function(){});
            pvpState.lobbyDocId = null;
        }

        pvpState.matchId = null;
        pvpState.currentQ = 0;
        pvpState.myScore = 0;
        pvpState.opponentScore = 0;
        pvpState.myCorrect = 0;
        pvpState.opponentCorrect = 0;
        pvpState.streak = 0;
        pvpState.roundWins = 0;
        pvpState.opponentRoundWins = 0;
        pvpState.answered = false;
        pvpState.questions = [];
    }

    // =============================================
    // RENDER — LOBBY
    // =============================================
    function renderPVPLobby() {
        var existing = document.getElementById('pvpOverlay');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'pvpOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:100002;background:var(--bg,#0a0a1a);display:flex;flex-direction:column;align-items:center;justify-content:center;overflow-y:auto;';

        var wins = parseInt(localStorage.getItem('btc_pvp_wins') || '0');
        var losses = parseInt(localStorage.getItem('btc_pvp_losses') || '0');

        overlay.innerHTML =
            '<div style="width:92%;max-width:480px;text-align:center;padding:20px;">' +
                // Header
                '<div style="margin-bottom:24px;">' +
                    '<div style="font-size:3rem;margin-bottom:8px;">⚔️</div>' +
                    '<h1 style="color:var(--accent,#f7931a);font-size:1.6rem;margin:0 0 4px;">PVP MODE</h1>' +
                    '<div style="color:var(--text-muted);font-size:0.8rem;">Bitcoin Trivia Battles — 1v1</div>' +
                '</div>' +
                // Stats
                '<div style="display:flex;justify-content:center;gap:24px;margin-bottom:28px;">' +
                    '<div style="text-align:center;">' +
                        '<div style="font-size:1.8rem;font-weight:800;color:#22c55e;">' + wins + '</div>' +
                        '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Wins</div>' +
                    '</div>' +
                    '<div style="text-align:center;">' +
                        '<div style="font-size:1.8rem;font-weight:800;color:#ef4444;">' + losses + '</div>' +
                        '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Losses</div>' +
                    '</div>' +
                '</div>' +
                // Searching animation
                '<div id="pvpLobbyStatus" style="margin-bottom:28px;">' +
                    '<div class="pvp-pulse" style="width:80px;height:80px;border-radius:50%;background:rgba(247,147,26,0.15);border:3px solid var(--accent);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;animation:pvpPulse 2s ease-in-out infinite;">' +
                        '<span style="font-size:2rem;">🔍</span>' +
                    '</div>' +
                    '<div style="color:var(--text);font-weight:700;font-size:1rem;">Searching for opponent...</div>' +
                    '<div style="color:var(--text-faint);font-size:0.8rem;margin-top:4px;">First come, first served matchmaking</div>' +
                '</div>' +
                // Rules
                '<div style="background:var(--card-bg,#1a1a2e);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:20px;text-align:left;">' +
                    '<div style="font-size:0.7rem;color:var(--accent);font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">How It Works</div>' +
                    '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.7;">' +
                        '5 questions per round. First to answer correctly wins 10 pts. ' +
                        'Answer streaks award bonus points. ' +
                        'Win 3 out of 5 to earn the victory and collect PVP badges!' +
                    '</div>' +
                '</div>' +
                // Badges preview
                '<div style="background:var(--card-bg,#1a1a2e);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:24px;text-align:left;">' +
                    '<div style="font-size:0.7rem;color:var(--accent);font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">PVP Badges</div>' +
                    '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
                        PVP_BADGE_DEFS.map(function(b) {
                            var earned = parseInt(localStorage.getItem('btc_pvp_wins') || '0') >= b.threshold;
                            return '<div style="padding:6px 10px;border-radius:8px;font-size:0.75rem;border:1px solid ' + (earned ? 'var(--accent)' : 'var(--border)') + ';background:' + (earned ? 'rgba(247,147,26,0.15)' : 'transparent') + ';color:' + (earned ? 'var(--accent)' : 'var(--text-faint)') + ';font-weight:' + (earned ? '700' : '500') + ';">' +
                                b.emoji + ' ' + b.name + ' (' + b.threshold + 'W)</div>';
                        }).join('') +
                    '</div>' +
                '</div>' +
                // Exit button
                '<button onclick="exitPVPMode()" style="padding:12px 32px;background:none;border:2px solid var(--border);border-radius:12px;color:var(--text-muted);font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">Leave Lobby</button>' +
            '</div>' +
            // PVP styles
            '<style>' +
                '@keyframes pvpPulse { 0%,100% { transform:scale(1); box-shadow:0 0 0 0 rgba(247,147,26,0.4); } 50% { transform:scale(1.08); box-shadow:0 0 30px rgba(247,147,26,0.3); } }' +
                '@keyframes pvpSlideIn { from { transform:translateY(20px);opacity:0; } to { transform:translateY(0);opacity:1; } }' +
                '@keyframes pvpCorrect { 0% { transform:scale(1); } 50% { transform:scale(1.05); } 100% { transform:scale(1); } }' +
                '@keyframes pvpShake { 0%,100% { transform:translateX(0); } 25% { transform:translateX(-5px); } 75% { transform:translateX(5px); } }' +
                '@keyframes pvpCountdown { from { transform:scale(0.5);opacity:0; } to { transform:scale(1);opacity:1; } }' +
                '.pvp-btn:hover { filter:brightness(1.15);transform:translateY(-1px); }' +
                '.pvp-btn:active { transform:translateY(0); }' +
            '</style>';

        document.body.appendChild(overlay);
    }

    // =============================================
    // LOBBY — JOIN & MATCHMAKING (real-time)
    // =============================================
    function joinLobby() {
        var db = getDb();
        var uid = getMyUid();
        if (!db || !uid) return;

        // Step 1: Try to find and match with an existing waiting player
        db.collection('pvp_lobby')
            .where('status', '==', 'waiting')
            .limit(5)
            .get()
            .then(function(snap) {
                var matched = false;
                snap.forEach(function(doc) {
                    if (matched) return;
                    var data = doc.data();
                    if (data.uid === uid) return; // skip self
                    matched = true;
                    createMatch(doc.id, data);
                });

                if (!matched) {
                    // No valid opponent found — add ourselves and listen
                    addToLobbyAndListen(uid);
                }
            })
            .catch(function(err) {
                console.error('PVP lobby query error:', err);
                // Index might not be ready — add to lobby and use polling fallback
                addToLobbyAndListen(uid);
            });
    }

    function addToLobbyAndListen(uid) {
        var db = getDb();
        if (!db) return;

        // Clean up any stale entries for this user first
        db.collection('pvp_lobby').where('uid', '==', uid).get().then(function(snap) {
            snap.forEach(function(doc) { doc.ref.delete(); });
        }).catch(function(){});

        // Add fresh lobby entry
        setTimeout(function() {
            db.collection('pvp_lobby').add({
                uid: uid,
                name: getMyDisplayName(),
                status: 'waiting',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(function(docRef) {
                pvpState.lobbyDocId = docRef.id;
                listenForMatch(docRef.id);
                // Also start polling for opponents (catches cases where real-time listener misses)
                startMatchmakingPoll(docRef.id, uid);
            }).catch(function(err) {
                console.error('PVP lobby join error:', err);
                if (typeof showToast === 'function') showToast('⚠️ Failed to join PVP lobby');
            });
        }, 500);
    }

    // Poll for opponents every 3 seconds as a fallback
    function startMatchmakingPoll(myLobbyDocId, myUid) {
        if (pvpState._matchPoll) clearInterval(pvpState._matchPoll);
        pvpState._matchPoll = setInterval(function() {
            if (pvpState.inMatch || !pvpState.inLobby) {
                clearInterval(pvpState._matchPoll);
                pvpState._matchPoll = null;
                return;
            }
            var db = getDb();
            if (!db) return;

            db.collection('pvp_lobby')
                .where('status', '==', 'waiting')
                .limit(5)
                .get()
                .then(function(snap) {
                    if (pvpState.inMatch) return; // already matched
                    snap.forEach(function(doc) {
                        if (pvpState.inMatch) return;
                        var data = doc.data();
                        if (data.uid === myUid) return;
                        // Found an opponent — match them!
                        clearInterval(pvpState._matchPoll);
                        pvpState._matchPoll = null;
                        createMatch(doc.id, data);
                    });
                })
                .catch(function(){});
        }, 3000);
    }

    function listenForMatch(lobbyDocId) {
        var db = getDb();
        if (!db) return;

        if (pvpState.lobbyUnsub) pvpState.lobbyUnsub();

        pvpState.lobbyUnsub = db.collection('pvp_lobby').doc(lobbyDocId)
            .onSnapshot(function(doc) {
                if (!doc.exists) return;
                var data = doc.data();
                if (data.status === 'matched' && data.matchId) {
                    // We've been matched!
                    pvpState.matchId = data.matchId;
                    pvpState.isPlayer1 = true;
                    pvpState.opponentName = data.opponentName || 'Opponent';
                    pvpState.opponentUid = data.opponentUid || '';
                    pvpState.inLobby = false;
                    pvpState.inMatch = true;

                    if (pvpState.lobbyUnsub) { pvpState.lobbyUnsub(); pvpState.lobbyUnsub = null; }

                    // Start listening to the match
                    listenToMatch(data.matchId);
                    showMatchFound();
                }
            });
    }

    function createMatch(waitingDocId, waitingData) {
        var db = getDb();
        var uid = getMyUid();
        if (!db || !uid) return;

        // Pick 5 questions
        var rawQuestions = pickRandomQuestions(5);
        var questions = rawQuestions.map(formatQuestionForFirestore);

        // Create match document
        var matchData = {
            player1: { uid: waitingData.uid, name: waitingData.name, score: 0, correct: 0, answers: [] },
            player2: { uid: uid, name: getMyDisplayName(), score: 0, correct: 0, answers: [] },
            questions: questions,
            currentQ: 0,
            status: 'countdown',  // countdown -> active -> question_result -> finished
            questionWinner: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            questionStartedAt: null,
        };

        db.collection('pvp_matches').add(matchData).then(function(docRef) {
            var matchId = docRef.id;

            // Update the waiting player's lobby entry
            db.collection('pvp_lobby').doc(waitingDocId).update({
                status: 'matched',
                matchId: matchId,
                opponentName: getMyDisplayName(),
                opponentUid: uid
            });

            // Remove our own lobby entry if we had one
            if (pvpState.lobbyDocId) {
                db.collection('pvp_lobby').doc(pvpState.lobbyDocId).delete().catch(function(){});
            }

            pvpState.matchId = matchId;
            pvpState.isPlayer1 = false;
            pvpState.opponentName = waitingData.name;
            pvpState.opponentUid = waitingData.uid;
            pvpState.inLobby = false;
            pvpState.inMatch = true;

            listenToMatch(matchId);
            showMatchFound();

        }).catch(function(err) {
            console.error('PVP match create error:', err);
            if (typeof showToast === 'function') showToast('⚠️ Failed to create PVP match');
        });
    }

    // =============================================
    // HELPER: Get player badge/level info
    // =============================================
    function getPlayerBadgeInfo(name, uid) {
        var lvlEmoji = '🌱';
        var lvlName = 'Newbie';
        var pvpBadge = '';
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.uid === uid) {
            if (typeof getLevel === 'function') {
                var lvl = getLevel(currentUser.points || 0);
                lvlEmoji = lvl.emoji || '🌱';
                lvlName = lvl.name || 'Newbie';
            }
            var w = parseInt(localStorage.getItem('btc_pvp_wins') || '0');
            if (w >= 100) pvpBadge = '👑';
            else if (w >= 50) pvpBadge = '🏆';
            else if (w >= 25) pvpBadge = '🏟️';
            else if (w >= 5) pvpBadge = '🥊';
            else if (w >= 1) pvpBadge = '⚔️';
        }
        return { emoji: lvlEmoji, name: lvlName, pvpBadge: pvpBadge };
    }

    // =============================================
    // MATCH FOUND — BATTLE INTRO ANIMATION + COUNTDOWN
    // =============================================
    function showMatchFound() {
        var overlay = document.getElementById('pvpOverlay');
        if (!overlay) return;

        var myName = getMyDisplayName();
        var oppName = pvpState.opponentName;
        var myInfo = getPlayerBadgeInfo(myName, getMyUid());

        // Phase 1: Battle intro animation — names orbit and collide
        overlay.innerHTML =
            '<style>' +
                '@keyframes pvpOrbitLeft { ' +
                    '0% { transform: translateX(-200px) translateY(0) scale(0.5); opacity: 0; }' +
                    '30% { transform: translateX(-80px) translateY(-40px) scale(0.8); opacity: 1; }' +
                    '60% { transform: translateX(20px) translateY(20px) scale(0.9); opacity: 1; }' +
                    '100% { transform: translateX(0) translateY(0) scale(1); opacity: 1; }' +
                '}' +
                '@keyframes pvpOrbitRight { ' +
                    '0% { transform: translateX(200px) translateY(0) scale(0.5); opacity: 0; }' +
                    '30% { transform: translateX(80px) translateY(40px) scale(0.8); opacity: 1; }' +
                    '60% { transform: translateX(-20px) translateY(-20px) scale(0.9); opacity: 1; }' +
                    '100% { transform: translateX(0) translateY(0) scale(1); opacity: 1; }' +
                '}' +
                '@keyframes pvpVsSlam { ' +
                    '0% { transform: scale(0); opacity: 0; }' +
                    '60% { transform: scale(1.5); opacity: 1; }' +
                    '100% { transform: scale(1); opacity: 1; }' +
                '}' +
                '@keyframes pvpShake { ' +
                    '0%,100% { transform: translateX(0); }' +
                    '25% { transform: translateX(-4px); }' +
                    '75% { transform: translateX(4px); }' +
                '}' +
            '</style>' +
            '<div style="width:92%;max-width:480px;text-align:center;padding:20px;">' +
                '<div style="font-size:1.8rem;margin-bottom:8px;color:var(--accent);font-weight:900;letter-spacing:3px;animation:pvpSlideIn 0.4s ease;">MATCH FOUND</div>' +
                '<div style="color:var(--text-faint);font-size:0.8rem;margin-bottom:32px;">Prepare for battle!</div>' +
                // Battle intro — players orbit in
                '<div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:32px;min-height:120px;">' +
                    // Player 1 (me)
                    '<div id="pvpPlayer1Card" style="text-align:center;animation:pvpOrbitLeft 1.5s ease forwards;">' +
                        '<div style="width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,#f7931a,#e8720c);display:flex;align-items:center;justify-content:center;font-size:1.8rem;margin:0 auto 8px;box-shadow:0 0 20px rgba(247,147,26,0.4);">' + myInfo.emoji + '</div>' +
                        '<div style="color:var(--text);font-weight:800;font-size:0.9rem;">' + escHtml(myName) + '</div>' +
                        '<div style="color:var(--text-faint);font-size:0.7rem;">' + myInfo.name + (myInfo.pvpBadge ? ' ' + myInfo.pvpBadge : '') + '</div>' +
                    '</div>' +
                    // VS (slams in)
                    '<div id="pvpVsText" style="font-size:2rem;font-weight:900;color:#ef4444;text-shadow:0 0 20px rgba(239,68,68,0.5);animation:pvpVsSlam 0.6s ease 1s forwards;opacity:0;">VS</div>' +
                    // Player 2 (opponent)
                    '<div id="pvpPlayer2Card" style="text-align:center;animation:pvpOrbitRight 1.5s ease forwards;">' +
                        '<div style="width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#4f46e5);display:flex;align-items:center;justify-content:center;font-size:1.8rem;margin:0 auto 8px;box-shadow:0 0 20px rgba(99,102,241,0.4);">🟣</div>' +
                        '<div style="color:var(--text);font-weight:800;font-size:0.9rem;">' + escHtml(oppName) + '</div>' +
                        '<div style="color:var(--text-faint);font-size:0.7rem;">Loading...</div>' +
                    '</div>' +
                '</div>' +
                // Countdown (appears after intro)
                '<div id="pvpCountdown" style="font-size:4rem;font-weight:900;color:var(--accent);opacity:0;min-height:80px;"></div>' +
                '<div id="pvpCountdownLabel" style="color:var(--text-faint);font-size:0.8rem;margin-top:8px;opacity:0;">Get ready...</div>' +
            '</div>';

        if (typeof haptic === 'function') haptic('medium');

        // Phase 2: After orbit animation (1.8s), shake the screen then start countdown
        setTimeout(function() {
            var overlay = document.getElementById('pvpOverlay');
            if (overlay) overlay.style.animation = 'pvpShake 0.3s ease 2';
            if (typeof haptic === 'function') haptic('heavy');
        }, 1800);

        // Phase 3: Start 3-2-1-BATTLE countdown at 2.5s
        setTimeout(function() {
            var countEl = document.getElementById('pvpCountdown');
            var labelEl = document.getElementById('pvpCountdownLabel');
            if (!countEl) return;
            countEl.style.opacity = '1';
            if (labelEl) labelEl.style.opacity = '1';
            countEl.textContent = '3';
            countEl.style.animation = 'pvpCountdown 0.5s ease';

            var sequence = [2, 1, 'BATTLE!'];
            var step = 0;
            var countInterval = setInterval(function() {
                if (step >= sequence.length) {
                    clearInterval(countInterval);
                    if (countEl) {
                        countEl.textContent = '⚔️ BATTLE! ⚔️';
                        countEl.style.color = '#f7931a';
                        countEl.style.fontSize = '3rem';
                        countEl.style.animation = 'none';
                        countEl.offsetHeight;
                        countEl.style.animation = 'pvpCountdown 0.5s ease';
                    }
                    if (typeof haptic === 'function') haptic('heavy');
                    setTimeout(function() {
                        if (!pvpState.isPlayer1) startNextQuestion();
                    }, 1000);
                    return;
                }
                if (countEl) {
                    countEl.textContent = sequence[step];
                    countEl.style.animation = 'none';
                    countEl.offsetHeight;
                    countEl.style.animation = 'pvpCountdown 0.5s ease';
                    if (sequence[step] === 1) countEl.style.color = '#ef4444';
                    else if (sequence[step] === 2) countEl.style.color = '#fbbf24';
                }
                if (typeof haptic === 'function') haptic('light');
                step++;
            }, 1000);
        }, 2500);
    }

    // =============================================
    // MATCH LISTENER
    // =============================================
    function listenToMatch(matchId) {
        var db = getDb();
        if (!db) return;

        if (pvpState.listenerUnsub) pvpState.listenerUnsub();

        // Start heartbeat — write presence every 5s so opponent can detect disconnects
        if (pvpState._heartbeat) clearInterval(pvpState._heartbeat);
        var myPresenceKey = pvpState.isPlayer1 ? 'player1LastSeen' : 'player2LastSeen';
        pvpState._heartbeat = setInterval(function() {
            if (!pvpState.inMatch || !pvpState.matchId) { clearInterval(pvpState._heartbeat); return; }
            var upd = {};
            upd[myPresenceKey] = Date.now();
            db.collection('pvp_matches').doc(matchId).update(upd).catch(function(){});
        }, 5000);
        // Write first heartbeat immediately
        var firstBeat = {};
        firstBeat[myPresenceKey] = Date.now();
        db.collection('pvp_matches').doc(matchId).update(firstBeat).catch(function(){});

        pvpState.listenerUnsub = db.collection('pvp_matches').doc(matchId)
            .onSnapshot(function(doc) {
                if (!doc.exists) return;
                var data = doc.data();

                pvpState.questions = data.questions || [];

                var myKey = pvpState.isPlayer1 ? 'player1' : 'player2';
                var oppKey = pvpState.isPlayer1 ? 'player2' : 'player1';

                pvpState.myScore = data[myKey].score;
                pvpState.opponentScore = data[oppKey].score;
                pvpState.myCorrect = data[myKey].correct;
                pvpState.opponentCorrect = data[oppKey].correct;

                // Count round wins from answers
                var myAnswers = data[myKey].answers || [];
                var oppAnswers = data[oppKey].answers || [];
                pvpState.roundWins = 0;
                pvpState.opponentRoundWins = 0;
                for (var i = 0; i < Math.min(myAnswers.length, oppAnswers.length); i++) {
                    if (myAnswers[i] && myAnswers[i].won) pvpState.roundWins++;
                    if (oppAnswers[i] && oppAnswers[i].won) pvpState.opponentRoundWins++;
                }

                if (data.status === 'active' && data.currentQ !== undefined) {
                    if (data.currentQ !== pvpState.currentQ || !document.getElementById('pvpQuestion')) {
                        pvpState.currentQ = data.currentQ;
                        pvpState.answered = false;
                        pvpState._resultShown = false;
                        renderQuestion(data);
                    }
                    // Safety: if both answered but status is still 'active', force-resolve
                    var myAns = data[myKey].answers || [];
                    var oppAns = data[oppKey].answers || [];
                    if (myAns.length > data.currentQ && oppAns.length > data.currentQ && pvpState.answered) {
                        if (!pvpState._forceResultTimer) {
                            pvpState._forceResultTimer = setTimeout(function() {
                                pvpState._forceResultTimer = null;
                                // Fresh read to get current state
                                db.collection('pvp_matches').doc(matchId).get().then(function(freshDoc) {
                                    if (!freshDoc.exists) return;
                                    var fd = freshDoc.data();
                                    if (fd.status !== 'active') return; // already resolved
                                    var qIdx = fd.currentQ;
                                    var fMyAns = (fd[myKey].answers || [])[qIdx];
                                    var fOppAns = (fd[oppKey].answers || [])[qIdx];
                                    if (!fMyAns || !fOppAns) return; // not both answered yet
                                    var winner = 'reroll';
                                    if (fMyAns.correct && !fOppAns.correct) winner = myKey;
                                    else if (!fMyAns.correct && fOppAns.correct) winner = oppKey;
                                    else if (fMyAns.correct && fOppAns.correct) winner = oppKey;
                                    // Both wrong = reroll
                                    if (winner === 'reroll') {
                                        var newQ = pickRandomQuestions(1);
                                        var fixUpdate = { questionWinner: 'reroll', status: 'question_result' };
                                        if (newQ.length > 0) {
                                            var qs = fd.questions.slice();
                                            qs[qIdx] = formatQuestionForFirestore(newQ[0]);
                                            fixUpdate['questions'] = qs;
                                        }
                                        // Clear answers for this question
                                        var clearedMy = (fd[myKey].answers || []).slice(0, qIdx);
                                        var clearedOpp = (fd[oppKey].answers || []).slice(0, qIdx);
                                        fixUpdate[myKey + '.answers'] = clearedMy;
                                        fixUpdate[oppKey + '.answers'] = clearedOpp;
                                        db.collection('pvp_matches').doc(matchId).update(fixUpdate).catch(function(){});
                                    } else {
                                        // Count decided questions
                                        var decided = 1; // this question
                                        for (var i = 0; i < qIdx; i++) {
                                            var a1 = (fd[myKey].answers || [])[i];
                                            var a2 = (fd[oppKey].answers || [])[i];
                                            if ((a1 && a1.won) || (a2 && a2.won)) decided++;
                                        }
                                        var fixUpdate = { questionWinner: winner, status: decided >= 5 ? 'finished' : 'question_result' };
                                        // Set won flags
                                        if (winner === myKey) {
                                            var myAFixed = (fd[myKey].answers || []).slice();
                                            if (myAFixed[qIdx]) myAFixed[qIdx] = Object.assign({}, myAFixed[qIdx], { won: true });
                                            fixUpdate[myKey + '.answers'] = myAFixed;
                                            fixUpdate[myKey + '.score'] = (fd[myKey].score || 0) + 10;
                                            fixUpdate[myKey + '.correct'] = (fd[myKey].correct || 0) + 1;
                                        } else {
                                            var oppAFixed = (fd[oppKey].answers || []).slice();
                                            if (oppAFixed[qIdx]) oppAFixed[qIdx] = Object.assign({}, oppAFixed[qIdx], { won: true });
                                            fixUpdate[oppKey + '.answers'] = oppAFixed;
                                            fixUpdate[oppKey + '.score'] = (fd[oppKey].score || 0) + 10;
                                            fixUpdate[oppKey + '.correct'] = (fd[oppKey].correct || 0) + 1;
                                        }
                                        db.collection('pvp_matches').doc(matchId).update(fixUpdate).catch(function(){});
                                    }
                                }).catch(function(){});
                            }, 2000);
                        }
                    }
                }

                if (data.status === 'question_result') {
                    // Guard: only render result once per question
                    if (!pvpState._resultShown) {
                        pvpState._resultShown = true;
                        renderQuestionResult(data);
                    }
                }

                if (data.status === 'finished') {
                    if (!pvpState._matchResultShown) {
                        pvpState._matchResultShown = true;
                        renderMatchResult(data);
                    }
                }

                // Opponent forfeited
                if (data.status === 'forfeit' && data.forfeitedBy !== getMyUid()) {
                    var myKey = pvpState.isPlayer1 ? 'player1' : 'player2';
                    var oppKey = pvpState.isPlayer1 ? 'player2' : 'player1';
                    var myQWins = 0, oppQWins = 0;
                    var myA = data[myKey].answers || [];
                    var opA = data[oppKey].answers || [];
                    for (var fi = 0; fi < 5; fi++) {
                        if (myA[fi] && myA[fi].won) myQWins++;
                        if (opA[fi] && opA[fi].won) oppQWins++;
                    }

                    if (data.forfeitReason === 'manual_leave') {
                        // Opponent manually left
                        if (myQWins > oppQWins) {
                            // I was winning — count as my win
                            var w = parseInt(localStorage.getItem('btc_pvp_wins') || '0') + 1;
                            localStorage.setItem('btc_pvp_wins', w.toString());
                            savePVPStats(w, parseInt(localStorage.getItem('btc_pvp_losses') || '0'));
                            if (typeof awardPoints === 'function') awardPoints(data[myKey].score || 10, '⚔️ PVP Victory (opponent forfeited)');
                            renderForfeitScreen(true, 'Your opponent left the match. You win! 🏆');
                        } else {
                            // I was losing or tied — no win, no loss
                            renderForfeitScreen(false, 'Your opponent left the match. No win or loss recorded.');
                        }
                    } else {
                        // Disconnect — no penalty for either
                        renderForfeitScreen(false, 'Your opponent disconnected. No win or loss recorded.');
                    }
                    if (pvpState.listenerUnsub) { pvpState.listenerUnsub(); pvpState.listenerUnsub = null; }
                }

            }, function(err) {
                console.error('PVP match listener error:', err);
            });
    }

    // =============================================
    // START NEXT QUESTION (called by player2 / match creator)
    // =============================================
    function startNextQuestion() {
        var db = getDb();
        if (!db || !pvpState.matchId) return;

        db.collection('pvp_matches').doc(pvpState.matchId).update({
            status: 'active',
            currentQ: pvpState.currentQ,
            questionWinner: null,
            questionStartedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    // =============================================
    // RENDER QUESTION
    // =============================================
    function renderQuestion(matchData) {
        var overlay = document.getElementById('pvpOverlay');
        if (!overlay) return;

        var qIdx = matchData.currentQ;
        var q = matchData.questions[qIdx];
        if (!q) return;

        var myKey = pvpState.isPlayer1 ? 'player1' : 'player2';
        var oppKey = pvpState.isPlayer1 ? 'player2' : 'player1';

        overlay.innerHTML =
            '<div style="width:92%;max-width:520px;padding:20px;">' +
                // Score bar
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
                    '<div style="text-align:left;">' +
                        '<div style="font-size:0.65rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">You</div>' +
                        '<div style="font-size:1.3rem;font-weight:800;color:#22c55e;">' + pvpState.myScore + '</div>' +
                    '</div>' +
                    '<div style="text-align:center;">' +
                        '<div style="font-size:0.65rem;color:var(--accent);font-weight:800;text-transform:uppercase;letter-spacing:1px;">Question ' + (qIdx + 1) + ' / 5</div>' +
                        '<div style="display:flex;gap:6px;justify-content:center;margin-top:4px;">' +
                            buildRoundDots(matchData) +
                        '</div>' +
                    '</div>' +
                    '<div style="text-align:right;">' +
                        '<div style="font-size:0.65rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">' + escHtml(pvpState.opponentName) + '</div>' +
                        '<div style="font-size:1.3rem;font-weight:800;color:#6366f1;">' + pvpState.opponentScore + '</div>' +
                    '</div>' +
                '</div>' +
                // Streak indicator
                (pvpState.streak > 1 ? '<div style="text-align:center;margin-bottom:8px;font-size:0.75rem;color:var(--accent);font-weight:700;">🔥 ' + pvpState.streak + ' streak!</div>' : '') +
                // Question
                '<div id="pvpQuestion" style="background:var(--card-bg,#1a1a2e);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:16px;animation:pvpSlideIn 0.4s ease;">' +
                    '<div style="color:var(--text);font-size:1rem;font-weight:700;line-height:1.6;text-align:center;">' + escHtml(q.q) + '</div>' +
                '</div>' +
                // Options
                '<div id="pvpOptions" style="display:flex;flex-direction:column;gap:8px;">' +
                    q.options.map(function(opt, idx) {
                        return '<button class="pvp-btn" onclick="pvpAnswer(' + qIdx + ',' + idx + ',this)" style="padding:14px 18px;background:var(--card-bg,#1a1a2e);border:2px solid var(--border);border-radius:12px;color:var(--text);font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;transition:all 0.2s;display:flex;align-items:center;gap:10px;">' +
                            '<span style="min-width:24px;height:24px;border-radius:50%;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:800;color:var(--text-faint);">' + String.fromCharCode(65 + idx) + '</span>' +
                            escHtml(opt) +
                        '</button>';
                    }).join('') +
                '</div>' +
                // Timer bar
                '<div style="margin-top:16px;height:4px;background:var(--border);border-radius:2px;overflow:hidden;">' +
                    '<div id="pvpTimer" style="height:100%;background:var(--accent);width:100%;transition:width 15s linear;"></div>' +
                '</div>' +
            '</div>';

        // Start timer animation
        setTimeout(function() {
            var timer = document.getElementById('pvpTimer');
            if (timer) timer.style.width = '0%';
        }, 100);

        // Auto-timeout after 15s — submit a "no answer"
        if (pvpState._questionTimeout) clearTimeout(pvpState._questionTimeout);
        pvpState._questionTimeout = setTimeout(function() {
            if (!pvpState.answered && pvpState.inMatch) {
                pvpAnswer(qIdx, -1, null); // -1 means timed out
            }
        }, 15000);
    }

    function buildRoundDots(matchData) {
        var html = '';
        var myKey = pvpState.isPlayer1 ? 'player1' : 'player2';
        var myAnswers = matchData[myKey].answers || [];

        for (var i = 0; i < 5; i++) {
            var color = 'var(--border)';
            var symbol = '';
            if (i < myAnswers.length) {
                if (myAnswers[i].won) { color = '#22c55e'; symbol = '✓'; }
                else if (myAnswers[i].correct) { color = '#eab308'; symbol = '·'; }
                else { color = '#ef4444'; symbol = '✗'; }
            } else if (i === pvpState.currentQ) {
                color = 'var(--accent)';
            }
            html += '<div style="width:10px;height:10px;border-radius:50%;background:' + color + ';font-size:6px;display:flex;align-items:center;justify-content:center;color:#fff;">' + symbol + '</div>';
        }
        return html;
    }

    // =============================================
    // ANSWER SUBMISSION
    // =============================================
    window.pvpAnswer = function(qIdx, selected, btn) {
        if (pvpState.answered) return;
        pvpState.answered = true;

        if (pvpState._questionTimeout) { clearTimeout(pvpState._questionTimeout); pvpState._questionTimeout = null; }

        var db = getDb();
        var uid = getMyUid();
        if (!db || !uid || !pvpState.matchId) return;

        var q = pvpState.questions[qIdx];
        var isCorrect = selected === q.correct;

        // Disable all buttons
        var opts = document.getElementById('pvpOptions');
        if (opts) {
            var btns = opts.querySelectorAll('button');
            for (var i = 0; i < btns.length; i++) {
                btns[i].disabled = true;
                btns[i].style.cursor = 'default';
                btns[i].style.opacity = '0.7';
            }
            // Highlight correct
            if (btns[q.correct]) {
                btns[q.correct].style.borderColor = '#22c55e';
                btns[q.correct].style.background = 'rgba(34,197,94,0.15)';
                btns[q.correct].style.opacity = '1';
            }
            // Highlight wrong selection
            if (selected >= 0 && selected !== q.correct && btns[selected]) {
                btns[selected].style.borderColor = '#ef4444';
                btns[selected].style.background = 'rgba(239,68,68,0.15)';
            }
        }

        // Show waiting for opponent text
        if (opts) {
            opts.insertAdjacentHTML('afterend',
                '<div style="text-align:center;margin-top:12px;color:var(--text-muted);font-size:0.8rem;animation:pvpPulse 2s infinite;">' +
                    (isCorrect ? '✅ Correct! Waiting for opponent...' : (selected < 0 ? '⏰ Time\'s up!' : '❌ Wrong! Waiting for opponent...')) +
                '</div>');
        }

        // Submit answer to Firestore
        var myKey = pvpState.isPlayer1 ? 'player1' : 'player2';

        var answerData = {
            selected: selected,
            correct: isCorrect,
            answeredAt: firebase.firestore.FieldValue.serverTimestamp(),
            won: false // will be determined by comparison
        };

        // Use a transaction to resolve who answered first
        var matchRef = db.collection('pvp_matches').doc(pvpState.matchId);

        db.runTransaction(function(transaction) {
            return transaction.get(matchRef).then(function(doc) {
                if (!doc.exists) throw new Error('Match not found');
                var data = doc.data();

                var myPlayerData = data[myKey];
                var oppKey = pvpState.isPlayer1 ? 'player2' : 'player1';
                var oppPlayerData = data[oppKey];

                // Check if we already answered this question
                if (myPlayerData.answers && myPlayerData.answers.length > qIdx) {
                    return; // already submitted
                }

                var newAnswers = (myPlayerData.answers || []).slice();
                newAnswers.push(answerData);

                var update = {};
                update[myKey + '.answers'] = newAnswers;

                // Check if opponent already answered this question
                var oppAnswers = oppPlayerData.answers || [];
                if (oppAnswers.length > qIdx) {
                    // Both have answered — determine winner
                    var oppAnswer = oppAnswers[qIdx];
                    var iWon = false;
                    var oppWon = false;

                    if (isCorrect && !oppAnswer.correct) {
                        // Only I got it right
                        iWon = true;
                    } else if (!isCorrect && oppAnswer.correct) {
                        // Only opponent got it right
                        oppWon = true;
                    } else if (isCorrect && oppAnswer.correct) {
                        // Both correct — first to answer wins
                        // The player already in the DB answered first (their transaction committed first)
                        oppWon = true;
                    } else {
                        // Both wrong — REROLL: pick a new question and reset this round
                        // Set status to 'reroll' so both clients show "Both wrong! New question..."
                        var newQ = pickRandomQuestions(1);
                        if (newQ.length > 0) {
                            var formatted = formatQuestionForFirestore(newQ[0]);
                            var questions = data.questions.slice();
                            questions[qIdx] = formatted;
                            update['questions'] = questions;
                        }
                        // Clear both players' answers for this question index
                        newAnswers.pop(); // remove the answer we just pushed
                        update[myKey + '.answers'] = newAnswers;
                        var oppCleared = oppAnswers.slice(0, qIdx); // remove opp's answer for this q
                        update[oppKey + '.answers'] = oppCleared;
                        update['questionWinner'] = 'reroll';
                        update['status'] = 'question_result'; // briefly show reroll screen
                        transaction.update(matchRef, update);
                        return;
                    }

                    // Update won flags
                    newAnswers[qIdx].won = iWon;
                    update[myKey + '.answers'] = newAnswers;

                    if (oppWon && !oppAnswer.won) {
                        var oppNewAnswers = oppAnswers.slice();
                        oppNewAnswers[qIdx] = Object.assign({}, oppAnswer, { won: true });
                        update[oppKey + '.answers'] = oppNewAnswers;
                    }

                    // Award points
                    if (iWon) {
                        var myWinStreak = 0;
                        for (var s = newAnswers.length - 1; s >= 0; s--) {
                            if (newAnswers[s].won) myWinStreak++;
                            else break;
                        }
                        var pts = 10 + (myWinStreak > 1 ? (myWinStreak - 1) * 5 : 0);
                        update[myKey + '.score'] = (myPlayerData.score || 0) + pts;
                        update[myKey + '.correct'] = (myPlayerData.correct || 0) + 1;
                        update['questionWinner'] = myKey;
                    } else if (oppWon) {
                        var oppWinStreak = 0;
                        var oppAns = oppAnswers.slice();
                        oppAns[qIdx] = Object.assign({}, oppAnswer, { won: true });
                        for (var s = oppAns.length - 1; s >= 0; s--) {
                            if (oppAns[s].won) oppWinStreak++;
                            else break;
                        }
                        var pts = 10 + (oppWinStreak > 1 ? (oppWinStreak - 1) * 5 : 0);
                        update[oppKey + '.score'] = (oppPlayerData.score || 0) + pts;
                        update[oppKey + '.correct'] = (oppPlayerData.correct || 0) + 1;
                        update['questionWinner'] = oppKey;
                    }

                    // This question was decided (someone won) — count total decided
                    // Simply: every question where iWon or oppWon is decided
                    // This current question IS decided since we're in the iWon/oppWon branch
                    var decidedCount = iWon || oppWon ? 1 : 0;
                    // Count previously decided questions from answers arrays
                    for (var dc = 0; dc < qIdx; dc++) {
                        if ((newAnswers[dc] && newAnswers[dc].won) || (oppAnswers[dc] && oppAnswers[dc].won)) decidedCount++;
                    }

                    if (decidedCount >= 5) {
                        update['status'] = 'finished';
                    } else {
                        update['status'] = 'question_result';
                    }
                }

                if (isCorrect) {
                    update[myKey + '.correct'] = (myPlayerData.correct || 0) + (oppAnswers.length <= qIdx ? 0 : (isCorrect ? 0 : 0));
                    // Correct count handled above when both answered
                }

                transaction.update(matchRef, update);
            });
        }).catch(function(err) {
            console.error('PVP answer transaction error:', err);
        });
    };

    // =============================================
    // RENDER QUESTION RESULT
    // =============================================
    function renderQuestionResult(matchData) {
        var overlay = document.getElementById('pvpOverlay');
        if (!overlay) return;

        var qIdx = matchData.currentQ;
        var winner = matchData.questionWinner;
        var myKey = pvpState.isPlayer1 ? 'player1' : 'player2';

        var iWon = winner === myKey;
        var isReroll = winner === 'reroll';

        var resultEmoji = isReroll ? '🔄' : (iWon ? '✅' : '❌');
        var resultText = isReroll ? 'Both wrong! New question incoming...' : (iWon ? 'You won this round!' : escHtml(pvpState.opponentName) + ' got it first!');
        var resultColor = isReroll ? '#eab308' : (iWon ? '#22c55e' : '#ef4444');

        // Update streak
        if (iWon) { pvpState.streak++; } else { pvpState.streak = 0; }

        overlay.innerHTML =
            '<div style="width:92%;max-width:480px;text-align:center;padding:20px;animation:pvpSlideIn 0.4s ease;">' +
                '<div style="font-size:3rem;margin-bottom:12px;">' + resultEmoji + '</div>' +
                '<div style="color:' + resultColor + ';font-size:1.2rem;font-weight:800;margin-bottom:8px;">' + resultText + '</div>' +
                (pvpState.streak > 1 ? '<div style="color:var(--accent);font-size:0.85rem;font-weight:700;margin-bottom:8px;">🔥 ' + pvpState.streak + ' streak! Bonus points!</div>' : '') +
                // Score update
                '<div style="display:flex;justify-content:center;gap:40px;margin:24px 0;">' +
                    '<div style="text-align:center;">' +
                        '<div style="font-size:0.65rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">You</div>' +
                        '<div style="font-size:2rem;font-weight:900;color:#22c55e;">' + matchData[myKey].score + '</div>' +
                    '</div>' +
                    '<div style="text-align:center;">' +
                        '<div style="font-size:0.65rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">' + escHtml(pvpState.opponentName) + '</div>' +
                        '<div style="font-size:2rem;font-weight:900;color:#6366f1;">' + matchData[pvpState.isPlayer1 ? 'player2' : 'player1'].score + '</div>' +
                    '</div>' +
                '</div>' +
                '<div style="color:var(--text-faint);font-size:0.8rem;">Next question in <span id="pvpNextTimer">3</span>s...</div>' +
            '</div>';

        // Auto-advance — rerolls are faster (2s) and reuse the same question slot
        var nextCount = isReroll ? 2 : 3;
        var nextInterval = setInterval(function() {
            nextCount--;
            var el = document.getElementById('pvpNextTimer');
            if (el) el.textContent = nextCount;
            if (nextCount <= 0) {
                clearInterval(nextInterval);
                if (!pvpState.isPlayer1) {
                    if (isReroll) {
                        // Same question index — the question was replaced in Firestore
                        startNextQuestion();
                    } else {
                        pvpState.currentQ = qIdx + 1;
                        startNextQuestion();
                    }
                }
            }
        }, 1000);
    }

    // =============================================
    // RENDER MATCH RESULT
    // =============================================
    function renderMatchResult(matchData) {
        var overlay = document.getElementById('pvpOverlay');
        if (!overlay) return;

        var myKey = pvpState.isPlayer1 ? 'player1' : 'player2';
        var oppKey = pvpState.isPlayer1 ? 'player2' : 'player1';

        var myData = matchData[myKey];
        var oppData = matchData[oppKey];

        // Count question wins (across all answers, including rerolled slots)
        var myQWins = 0, oppQWins = 0;
        var myAnswers = myData.answers || [];
        var oppAnswers = oppData.answers || [];
        for (var i = 0; i < myAnswers.length; i++) {
            if (myAnswers[i] && myAnswers[i].won) myQWins++;
        }
        for (var i = 0; i < oppAnswers.length; i++) {
            if (oppAnswers[i] && oppAnswers[i].won) oppQWins++;
        }
        var totalDecided = myQWins + oppQWins;

        var iWon = myQWins > oppQWins;
        var isDraw = myQWins === oppQWins; // should not happen with rerolls, but just in case

        // Save result
        if (iWon) {
            var wins = parseInt(localStorage.getItem('btc_pvp_wins') || '0') + 1;
            localStorage.setItem('btc_pvp_wins', wins.toString());
            // Award global points
            if (typeof awardPoints === 'function') awardPoints(myData.score, '⚔️ PVP Victory!');
            // Check for new PVP badges
            checkPVPBadges(wins);
            // Sync to Firebase
            savePVPStats(wins, parseInt(localStorage.getItem('btc_pvp_losses') || '0'));
        } else if (!isDraw) {
            var losses = parseInt(localStorage.getItem('btc_pvp_losses') || '0') + 1;
            localStorage.setItem('btc_pvp_losses', losses.toString());
            // Consolation points
            if (typeof awardPoints === 'function' && myData.score > 0) awardPoints(Math.floor(myData.score / 2), '⚔️ PVP Consolation');
            savePVPStats(parseInt(localStorage.getItem('btc_pvp_wins') || '0'), losses);
        } else {
            // Draw — small reward
            if (typeof awardPoints === 'function') awardPoints(5, '⚔️ PVP Draw');
        }

        var resultEmoji = iWon ? '🏆' : (isDraw ? '🤝' : '💀');
        var resultText = iWon ? 'VICTORY!' : (isDraw ? 'DRAW!' : 'DEFEAT');
        var resultColor = iWon ? '#22c55e' : (isDraw ? '#eab308' : '#ef4444');
        var resultSubtext = iWon ? 'You dominated! ' + myQWins + ' rounds won.' : (isDraw ? 'Evenly matched! ' + myQWins + '–' + oppQWins + ' tie.' : 'Better luck next time. ' + oppQWins + ' rounds to ' + myQWins + '.');

        // Toast notification
        if (typeof showToast === 'function') {
            if (iWon) showToast('🏆 PVP Victory! ' + myQWins + '–' + oppQWins + ' vs ' + escHtml(pvpState.opponentName));
            else if (isDraw) showToast('🤝 PVP Draw! ' + myQWins + '–' + oppQWins + ' vs ' + escHtml(pvpState.opponentName));
            else showToast('💀 PVP Defeat. ' + oppQWins + '–' + myQWins + ' vs ' + escHtml(pvpState.opponentName));
        }

        overlay.innerHTML =
            '<div style="width:92%;max-width:480px;text-align:center;padding:20px;animation:pvpSlideIn 0.5s ease;">' +
                '<div style="font-size:4rem;margin-bottom:12px;">' + resultEmoji + '</div>' +
                '<h1 style="color:' + resultColor + ';font-size:2.2rem;margin:0 0 4px;letter-spacing:3px;">' + resultText + '</h1>' +
                '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:24px;">' + resultSubtext + '</div>' +
                // Player cards with result labels
                '<div style="display:flex;justify-content:center;gap:24px;margin-bottom:24px;">' +
                    '<div style="text-align:center;padding:16px;background:' + (iWon ? 'rgba(34,197,94,0.1)' : 'var(--card-bg)') + ';border:2px solid ' + (iWon ? '#22c55e' : 'var(--border)') + ';border-radius:16px;flex:1;max-width:160px;">' +
                        '<div style="font-size:0.65rem;color:' + (iWon ? '#22c55e' : 'var(--text-faint)') + ';text-transform:uppercase;font-weight:800;letter-spacing:1px;margin-bottom:8px;">' + (iWon ? '🏆 WINNER' : (isDraw ? '🤝 DRAW' : 'LOST')) + '</div>' +
                        '<div style="font-size:2rem;font-weight:900;color:' + (iWon ? '#22c55e' : 'var(--text)') + ';">' + myData.score + '</div>' +
                        '<div style="color:var(--text);font-weight:700;font-size:0.85rem;margin-top:4px;">' + escHtml(getMyDisplayName()) + '</div>' +
                        '<div style="color:var(--text-faint);font-size:0.75rem;">' + myQWins + '/5 rounds won</div>' +
                    '</div>' +
                    '<div style="text-align:center;padding:16px;background:' + (!iWon && !isDraw ? 'rgba(239,68,68,0.1)' : 'var(--card-bg)') + ';border:2px solid ' + (!iWon && !isDraw ? '#ef4444' : 'var(--border)') + ';border-radius:16px;flex:1;max-width:160px;">' +
                        '<div style="font-size:0.65rem;color:' + (!iWon && !isDraw ? '#ef4444' : 'var(--text-faint)') + ';text-transform:uppercase;font-weight:800;letter-spacing:1px;margin-bottom:8px;">' + (!iWon && !isDraw ? '💀 LOST' : (isDraw ? '🤝 DRAW' : '🏆 WINNER')) + '</div>' +
                        '<div style="font-size:2rem;font-weight:900;color:' + (!iWon && !isDraw ? '#ef4444' : 'var(--text)') + ';">' + oppData.score + '</div>' +
                        '<div style="color:var(--text);font-weight:700;font-size:0.85rem;margin-top:4px;">' + escHtml(pvpState.opponentName) + '</div>' +
                        '<div style="color:var(--text-faint);font-size:0.75rem;">' + oppQWins + '/5 rounds won</div>' +
                    '</div>' +
                '</div>' +
                // Round breakdown dots
                '<div style="display:flex;justify-content:center;gap:8px;margin-bottom:28px;">' +
                    buildFinalRoundDots(myAnswers, oppAnswers) +
                '</div>' +
                // Buttons
                '<div style="display:flex;gap:12px;justify-content:center;">' +
                    '<button onclick="exitPVPMode(true);enterPVPMode();" class="pvp-btn" style="padding:14px 28px;background:linear-gradient(135deg,#f7931a,#e8720c);border:none;border-radius:12px;color:#fff;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;text-transform:uppercase;letter-spacing:1px;">Play Again ⚔️</button>' +
                    '<button onclick="exitPVPMode(true)" class="pvp-btn" style="padding:14px 28px;background:none;border:2px solid var(--border);border-radius:12px;color:var(--text-muted);font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">Leave</button>' +
                '</div>' +
            '</div>';

        // Cleanup match listener
        if (pvpState.listenerUnsub) { pvpState.listenerUnsub(); pvpState.listenerUnsub = null; }
        pvpState.inMatch = false;

        // Cleanup lobby doc
        var db = getDb();
        if (db && pvpState.lobbyDocId) {
            db.collection('pvp_lobby').doc(pvpState.lobbyDocId).delete().catch(function(){});
            pvpState.lobbyDocId = null;
        }
    }

    function renderForfeitScreen(iWin, message) {
        var overlay = document.getElementById('pvpOverlay');
        if (!overlay) return;
        var emoji = iWin ? '🏆' : '🚪';
        var color = iWin ? '#22c55e' : '#eab308';
        var title = iWin ? 'VICTORY!' : 'MATCH ENDED';
        overlay.innerHTML =
            '<div style="width:92%;max-width:480px;text-align:center;padding:20px;animation:pvpSlideIn 0.5s ease;">' +
                '<div style="font-size:4rem;margin-bottom:16px;">' + emoji + '</div>' +
                '<h1 style="color:' + color + ';font-size:1.8rem;margin:0 0 12px;letter-spacing:2px;">' + title + '</h1>' +
                '<div style="color:var(--text-muted);font-size:0.95rem;margin-bottom:32px;line-height:1.6;">' + message + '</div>' +
                '<div style="display:flex;gap:12px;justify-content:center;">' +
                    '<button onclick="exitPVPMode(true);enterPVPMode();" class="pvp-btn" style="padding:14px 28px;background:linear-gradient(135deg,#f7931a,#e8720c);border:none;border-radius:12px;color:#fff;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;">Play Again ⚔️</button>' +
                    '<button onclick="exitPVPMode(true)" class="pvp-btn" style="padding:14px 28px;background:none;border:2px solid var(--border);border-radius:12px;color:var(--text-muted);font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">Leave</button>' +
                '</div>' +
            '</div>';
        if (typeof showToast === 'function') showToast(iWin ? '🏆 You win — opponent forfeited!' : '🚪 Opponent left — match voided');
    }

    function buildFinalRoundDots(myAnswers, oppAnswers) {
        var html = '';
        for (var i = 0; i < 5; i++) {
            var myA = myAnswers[i];
            var oppA = oppAnswers[i];
            var color = 'var(--border)';
            var icon = '—';
            if (myA && myA.won) { color = '#22c55e'; icon = '✓'; }
            else if (oppA && oppA.won) { color = '#ef4444'; icon = '✗'; }
            else { color = '#eab308'; icon = '·'; }
            html += '<div style="width:36px;height:36px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:0.85rem;">' + icon + '</div>';
        }
        return html;
    }

    // =============================================
    // PVP BADGE CHECKING
    // =============================================
    function checkPVPBadges(wins) {
        PVP_BADGE_DEFS.forEach(function(b) {
            if (wins >= b.threshold) {
                var earned = typeof earnedBadges !== 'undefined' ? earnedBadges : new Set();
                if (!earned.has(b.id)) {
                    earned.add(b.id);
                    localStorage.setItem('btc_badges', JSON.stringify([...earned]));
                    // Show toast
                    if (typeof showToast === 'function') showToast(b.emoji + ' Badge Earned: ' + b.name + '! +' + b.pts + ' pts');
                    if (typeof awardPoints === 'function') awardPoints(b.pts, b.emoji + ' ' + b.name);
                    // Show badge celebration if available
                    if (typeof showBadgeToast === 'function') {
                        showBadgeToast(b);
                    }
                }
            }
        });
    }

    // Save PVP stats to Firebase + update in-memory currentUser for instant display
    function savePVPStats(wins, losses) {
        // Update in-memory user object so Settings/Profile show immediately
        if (typeof currentUser !== 'undefined' && currentUser) {
            currentUser.pvpWins = wins;
            currentUser.pvpLosses = losses;
        }

        var db = getDb();
        var uid = getMyUid();
        if (!db || !uid) return;

        db.collection('users').doc(uid).update({
            pvpWins: wins,
            pvpLosses: losses
        }).catch(function() {
            db.collection('users').doc(uid).set({
                pvpWins: wins,
                pvpLosses: losses
            }, { merge: true }).catch(function(){});
        });
    }

    // =============================================
    // HTML ESCAPING
    // =============================================
    function escHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // =============================================
    // INITIALIZE
    // =============================================
    function initPVP() {
        // Start lobby ticker listener once Firebase is ready
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged(function(user) {
                if (user && !user.isAnonymous) {
                    startLobbyTicker();

                    // Check if user was trying to enter PVP before sign-in
                    if (sessionStorage.getItem('btc_pvp_pending') === 'true') {
                        sessionStorage.removeItem('btc_pvp_pending');
                        setTimeout(function() {
                            if (typeof enterPVPMode === 'function') enterPVPMode();
                        }, 1000);
                    }
                }
            });
        }

        // Clean up stale lobby entries (older than 5 minutes)
        setTimeout(function() {
            var db = getDb();
            if (!db) return;
            var fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
            db.collection('pvp_lobby')
                .where('status', '==', 'waiting')
                .where('createdAt', '<', fiveMinAgo)
                .get()
                .then(function(snap) {
                    snap.forEach(function(doc) { doc.ref.delete(); });
                })
                .catch(function(){});
        }, 10000);
    }

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPVP);
    } else {
        setTimeout(initPVP, 2000); // Delay to let Firebase init first
    }

    // Expose for global access
    window.enterPVPMode = window.enterPVPMode;
    window.exitPVPMode = window.exitPVPMode;
    window.pvpAnswer = window.pvpAnswer;
    window.PVP_BADGE_DEFS = PVP_BADGE_DEFS;

})();
