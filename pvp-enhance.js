// =============================================
// ⚔️ PVP Enhancements — Bolt-on features
// Sudden Death, Speed Bonus, Taunts, Match History
// =============================================
!function() {
'use strict';

// ---- 1. SUDDEN DEATH ----
// Override reroll text to show "SUDDEN DEATH" instead of "Both wrong!"
var _origResultShown = false;
var _sdObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
            if (node.nodeType === 1 && node.textContent) {
                // Detect reroll result screen
                if (node.textContent.indexOf('Both wrong!') !== -1) {
                    var rerollDiv = node.querySelector ? node.querySelector('div[style*="font-size:3rem"]') : null;
                    if (rerollDiv) {
                        rerollDiv.textContent = '⚡';
                    }
                    var textDiv = node.querySelector ? node.querySelector('div[style*="font-weight:800"]') : null;
                    if (textDiv && textDiv.textContent.indexOf('Both wrong') !== -1) {
                        textDiv.textContent = '⚡ SUDDEN DEATH!';
                        textDiv.style.color = '#f7931a';
                        textDiv.style.letterSpacing = '2px';
                    }
                    var subText = node.querySelector ? node.querySelector('div[style*="text-faint"]') : null;
                    if (subText && subText.textContent.indexOf('Next question') !== -1) {
                        subText.textContent = 'Neither got it — next question decides!';
                    }
                }
            }
        });
    });
});

// ---- 2. SPEED BONUS VISUAL ----
// Show "⚡ LIGHTNING FAST!" when answering in under 3 seconds
var _questionShownAt = 0;
var _speedObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
            if (node.nodeType !== 1) return;
            // Detect question appearing (has pvpQuestion id)
            if (node.id === 'pvpOverlay' || (node.querySelector && node.querySelector('#pvpQuestion'))) {
                _questionShownAt = Date.now();
            }
            // Detect "Correct! Waiting for opponent" or "Wrong!"
            if (node.textContent && (node.textContent.indexOf('Correct! Waiting') !== -1 || node.textContent.indexOf('Wrong!') !== -1 || node.textContent.indexOf("Time's up") !== -1)) {
                var elapsed = Date.now() - _questionShownAt;
                if (elapsed < 3000 && elapsed > 0 && node.textContent.indexOf('Correct') !== -1) {
                    var speedBadge = document.createElement('div');
                    speedBadge.style.cssText = 'text-align:center;margin-top:8px;font-size:0.85rem;font-weight:800;color:#f7931a;animation:pvpSlideIn 0.3s ease;';
                    speedBadge.textContent = '⚡ LIGHTNING FAST! (' + (elapsed / 1000).toFixed(1) + 's)';
                    node.parentElement.insertBefore(speedBadge, node.nextSibling);
                    if (typeof haptic === 'function') haptic('medium');
                }
            }
        });
    });
});

// ---- 3. TAUNT EMOJIS ----
// Add taunt buttons when waiting for opponent's answer
var TAUNTS = ['😂', '🔥', '💀', '😎', '🤔', '⚡'];
var _lastTauntTime = 0;

window._pvpSendTaunt = function(emoji) {
    if (Date.now() - _lastTauntTime < 3000) return; // 3s cooldown
    _lastTauntTime = Date.now();
    
    if (typeof db === 'undefined' || !db) return;
    var matchId = window._pvpGetMatchId ? window._pvpGetMatchId() : null;
    if (!matchId) {
        // Try to find it from the PVP state
        var overlay = document.getElementById('pvpOverlay');
        if (!overlay) return;
    }
    
    // Show taunt locally
    _showTauntBubble(emoji, true);
    
    // Write taunt to Firestore (other player reads via snapshot)
    try {
        var uid = auth.currentUser ? auth.currentUser.uid : '';
        if (uid) {
            // Use a lightweight approach — write to a taunts subcollection isn't worth the reads
            // Instead, just show it locally. For real cross-player taunts, we'd need the match doc.
            // For now, taunts are local fun only (both players see their own taunts).
        }
    } catch(e) {}
};

function _showTauntBubble(emoji, isMine) {
    var bubble = document.createElement('div');
    bubble.style.cssText = 'position:fixed;' + (isMine ? 'bottom:200px;right:20px;' : 'bottom:200px;left:20px;') + 
        'z-index:100010;font-size:3rem;animation:pvpTauntFloat 1.5s ease forwards;pointer-events:none;';
    bubble.textContent = emoji;
    document.body.appendChild(bubble);
    setTimeout(function() { bubble.remove(); }, 1500);
}

// Inject taunt bar into the waiting-for-opponent screen
var _tauntObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
            if (node.nodeType !== 1) return;
            // Detect "Waiting for opponent" text
            if (node.textContent && node.textContent.indexOf('Waiting for opponent') !== -1 && !document.getElementById('pvpTauntBar')) {
                var bar = document.createElement('div');
                bar.id = 'pvpTauntBar';
                bar.style.cssText = 'display:flex;justify-content:center;gap:8px;margin-top:12px;animation:pvpSlideIn 0.3s ease;';
                TAUNTS.forEach(function(t) {
                    var btn = document.createElement('button');
                    btn.textContent = t;
                    btn.style.cssText = 'font-size:1.5rem;background:var(--card-bg,#1a1a2e);border:1px solid var(--border);border-radius:50%;width:44px;height:44px;cursor:pointer;transition:0.2s;touch-action:manipulation;display:flex;align-items:center;justify-content:center;';
                    btn.onclick = function() { 
                        _pvpSendTaunt(t);
                        btn.style.transform = 'scale(1.3)';
                        btn.style.opacity = '0.5';
                        setTimeout(function() { btn.style.transform = ''; btn.style.opacity = '1'; }, 300);
                    };
                    bar.appendChild(btn);
                });
                node.parentElement.appendChild(bar);
            }
        });
    });
});

// ---- 4. MATCH HISTORY ----
// Save match results to localStorage and show on lobby
window._pvpSaveMatchHistory = function(opponentName, myScore, oppScore, won) {
    try {
        var history = JSON.parse(localStorage.getItem('btc_pvp_history') || '[]');
        history.unshift({
            opponent: opponentName,
            myScore: myScore,
            oppScore: oppScore,
            won: won,
            date: Date.now()
        });
        if (history.length > 10) history = history.slice(0, 10);
        localStorage.setItem('btc_pvp_history', JSON.stringify(history));
    } catch(e) {}
};

// Hook into match result to save history
var _historyObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
            if (node.nodeType !== 1) return;
            // Detect VICTORY/DEFEAT screen
            if (node.textContent && (node.textContent.indexOf('VICTORY!') !== -1 || node.textContent.indexOf('DEFEAT') !== -1)) {
                var isWin = node.textContent.indexOf('VICTORY!') !== -1;
                // Extract scores from the result screen
                var scoreEls = node.querySelectorAll ? node.querySelectorAll('div[style*="font-size:2rem"][style*="font-weight:900"]') : [];
                var myScore = 0, oppScore = 0;
                if (scoreEls.length >= 2) {
                    myScore = parseInt(scoreEls[0].textContent) || 0;
                    oppScore = parseInt(scoreEls[1].textContent) || 0;
                }
                // Get opponent name
                var oppNameEls = node.querySelectorAll ? node.querySelectorAll('div[style*="font-weight:700"][style*="font-size:0.85rem"]') : [];
                var oppName = oppNameEls.length >= 2 ? oppNameEls[1].textContent : 'Unknown';
                
                _pvpSaveMatchHistory(oppName, myScore, oppScore, isWin);
            }
        });
    });
});

// Inject match history into lobby
function _injectMatchHistory() {
    var lobby = document.getElementById('pvpLobbyStatus');
    if (!lobby || document.getElementById('pvpMatchHistory')) return;
    
    var history;
    try { history = JSON.parse(localStorage.getItem('btc_pvp_history') || '[]'); } catch(e) { return; }
    if (history.length === 0) return;
    
    var html = '<div id="pvpMatchHistory" style="background:var(--card-bg,#1a1a2e);border:1px solid var(--border);border-radius:16px;padding:14px;margin-bottom:16px;text-align:left;">' +
        '<div style="font-size:0.65rem;color:var(--accent);font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📜 Recent Battles</div>';
    
    history.slice(0, 5).forEach(function(match) {
        var ago = _timeAgo(match.date);
        var icon = match.won ? '🏆' : '💀';
        var color = match.won ? '#22c55e' : '#ef4444';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">' +
            '<span style="font-size:1rem;">' + icon + '</span>' +
            '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:0.8rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">vs ' + _escHtml(match.opponent) + '</div>' +
                '<div style="font-size:0.65rem;color:var(--text-faint);">' + ago + '</div>' +
            '</div>' +
            '<div style="font-size:0.85rem;font-weight:800;color:' + color + ';">' + match.myScore + '-' + match.oppScore + '</div>' +
        '</div>';
    });
    
    html += '</div>';
    
    // Insert after the lobby status
    lobby.insertAdjacentHTML('afterend', html);
}

function _timeAgo(ts) {
    var diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
}

function _escHtml(s) {
    return s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
}

// ---- Add CSS for taunt animation ----
var style = document.createElement('style');
style.textContent = '@keyframes pvpTauntFloat { 0% { opacity:1; transform:translateY(0) scale(1); } 50% { opacity:1; transform:translateY(-40px) scale(1.3); } 100% { opacity:0; transform:translateY(-80px) scale(0.8); } }';
document.head.appendChild(style);

// ---- Start observers when PVP overlay opens ----
var _pvpMainObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
            if (node.nodeType === 1 && node.id === 'pvpOverlay') {
                // PVP overlay appeared — start all observers
                _sdObserver.observe(node, { childList: true, subtree: true });
                _speedObserver.observe(node, { childList: true, subtree: true });
                _tauntObserver.observe(node, { childList: true, subtree: true });
                _historyObserver.observe(node, { childList: true, subtree: true });
                
                // Inject match history into lobby
                setTimeout(_injectMatchHistory, 500);
            }
        });
        m.removedNodes.forEach(function(node) {
            if (node.nodeType === 1 && node.id === 'pvpOverlay') {
                // Cleanup
                _sdObserver.disconnect();
                _speedObserver.disconnect();
                _tauntObserver.disconnect();
                _historyObserver.disconnect();
            }
        });
    });
});

// Watch document.body for PVP overlay
if (document.body) {
    _pvpMainObserver.observe(document.body, { childList: true });
} else {
    document.addEventListener('DOMContentLoaded', function() {
        _pvpMainObserver.observe(document.body, { childList: true });
    });
}

console.log('[PVP] Enhancements loaded — Sudden Death, Speed Bonus, Taunts, Match History');
}();
