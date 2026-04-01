// © 2024-2026 603BTC LLC. All rights reserved.
// sats-vs-bits.js — Sats vs Bits Live Vote (Global Chat widget)
// The eternal Bitcoin debate — settled by taps

(function() {
'use strict';

var FIRESTORE_DOC = 'polls/sats_vs_bits';
var DAILY_LIMIT = 100;
var STORAGE_KEY = 'btc_svb_today';
var DEBOUNCE_MS = 300;

var localSats = 0, localBits = 0;
var pendingSats = 0, pendingBits = 0;
var flushTimer = null;
var todayTaps = 0;
var todayKey = '';

function getTodayKey() { return new Date().toISOString().split('T')[0]; }

function loadDailyTaps() {
    todayKey = getTodayKey();
    try {
        var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (saved.date === todayKey) { todayTaps = saved.taps || 0; }
        else { todayTaps = 0; saveDailyTaps(); }
    } catch(e) { todayTaps = 0; }
}

function saveDailyTaps() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey, taps: todayTaps }));
}

function getFingerprint() {
    // Device fingerprint to prevent multi-account cheating
    var parts = [
        screen.width, screen.height, screen.colorDepth,
        navigator.language, navigator.hardwareConcurrency || 0,
        navigator.platform, Intl.DateTimeFormat().resolvedOptions().timeZone
    ];
    var hash = 0;
    var str = parts.join('|');
    for (var i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    return 'svb_' + Math.abs(hash).toString(36);
}

function flushVotes() {
    if (pendingSats === 0 && pendingBits === 0) return;
    var db = typeof firebase !== 'undefined' ? firebase.firestore() : null;
    if (!db) return;

    var s = pendingSats, b = pendingBits;
    pendingSats = 0; pendingBits = 0;

    var update = {};
    if (s > 0) update.sats = firebase.firestore.FieldValue.increment(s);
    if (b > 0) update.bits = firebase.firestore.FieldValue.increment(b);

    // Also track per-device to limit abuse
    var fp = getFingerprint();
    var fpKey = 'devices.' + fp;
    update[fpKey] = firebase.firestore.FieldValue.increment(s + b);

    db.doc(FIRESTORE_DOC).set(update, { merge: true }).catch(function() {});
}

function castVote(side) {
    loadDailyTaps();
    if (todayTaps >= DAILY_LIMIT) {
        if (typeof showToast === 'function') showToast('⚡ You\'ve hit ' + DAILY_LIMIT + ' taps today! Come back tomorrow to keep voting.');
        return;
    }

    todayTaps++;
    saveDailyTaps();

    if (side === 'sats') { localSats++; pendingSats++; }
    else { localBits++; pendingBits++; }

    updateDisplay();
    animateTap(side);

    // Debounced Firestore write
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flushVotes, DEBOUNCE_MS);
}

function animateTap(side) {
    var el = document.getElementById(side === 'sats' ? 'svbSatsBtn' : 'svbBitsBtn');
    if (el) {
        el.style.transform = 'scale(1.15)';
        setTimeout(function() { el.style.transform = 'scale(1)'; }, 150);
    }
    // Float a +1
    var container = document.getElementById('svbWidget');
    if (container) {
        var float = document.createElement('span');
        float.textContent = '+1';
        float.style.cssText = 'position:absolute;' + (side === 'sats' ? 'left:25%;' : 'right:25%;') +
            'top:0;color:' + (side === 'sats' ? '#f7931a' : '#3b82f6') + ';font-size:0.75rem;font-weight:900;pointer-events:none;animation:svbFloat 0.8s ease-out forwards;z-index:5;';
        container.appendChild(float);
        setTimeout(function() { float.remove(); }, 800);
    }
}

function updateDisplay() {
    var satsEl = document.getElementById('svbSatsCount');
    var bitsEl = document.getElementById('svbBitsCount');
    var barEl = document.getElementById('svbBar');
    var remainEl = document.getElementById('svbRemaining');

    if (satsEl) satsEl.textContent = formatNum(localSats);
    if (bitsEl) bitsEl.textContent = formatNum(localBits);

    var total = localSats + localBits;
    if (barEl && total > 0) {
        var satsPct = Math.round(localSats / total * 100);
        barEl.innerHTML = '<div style="height:100%;width:' + satsPct + '%;background:linear-gradient(90deg,#f7931a,#ea580c);border-radius:4px;transition:width 0.3s;"></div>';
    }
    if (remainEl) {
        loadDailyTaps();
        var left = Math.max(0, DAILY_LIMIT - todayTaps);
        remainEl.textContent = left + ' taps left today';
    }
}

function formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
}

function injectWidget() {
    var djBar = document.getElementById('djNowPlaying');
    if (!djBar || document.getElementById('svbTrigger')) return;

    // Inject animation style
    if (!document.getElementById('svbStyles')) {
        var style = document.createElement('style');
        style.id = 'svbStyles';
        style.textContent = '@keyframes svbFloat { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(-30px); } }';
        document.head.appendChild(style);
    }

    // Small inline button next to DJ bar
    var trigger = document.createElement('button');
    trigger.id = 'svbTrigger';
    trigger.style.cssText = 'padding:5px 10px;background:linear-gradient(135deg,rgba(247,147,26,0.15),rgba(59,130,246,0.15));border:1px solid rgba(247,147,26,0.4);border-radius:8px;color:#f7931a;font-size:0.65rem;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap;touch-action:manipulation;transition:0.2s;letter-spacing:0.5px;';
    trigger.textContent = '⚡ SATS vs BITS — VOTE';
    trigger.onclick = function() { toggleSvbPanel(); };

    // Insert into the DJ action buttons row (find the row with Tune In button)
    var tuneBtn = djBar.querySelector('#djTuneBtn') || djBar.querySelector('button');
    var actionRow = tuneBtn ? tuneBtn.parentElement : null;
    if (actionRow && actionRow.style.display !== undefined) actionRow.appendChild(trigger);
    else djBar.appendChild(trigger);

    // Load live data
    loadLiveVotes();
}

function toggleSvbPanel() {
    var existing = document.getElementById('svbWidget');
    if (existing) { existing.remove(); return; }

    var djBar = document.getElementById('djNowPlaying');
    if (!djBar) return;

    var widget = document.createElement('div');
    widget.id = 'svbWidget';
    widget.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;z-index:5;padding:10px 12px;background:var(--bg-side,#0a0a1a);border-radius:12px;display:flex;flex-direction:column;justify-content:center;overflow:hidden;animation:fadeSlideIn 0.3s;';

    // Make djBar position:relative for absolute overlay
    djBar.style.position = 'relative';

    widget.innerHTML =
        '<button onclick="document.getElementById(\'svbWidget\').remove()" style="position:absolute;top:6px;right:8px;background:none;border:none;color:var(--text-faint);font-size:0.9rem;cursor:pointer;z-index:6;">✕</button>' +
        '<div style="text-align:center;font-size:0.6rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:6px;">⚡ Sats vs Bits — Cast Your Vote!</div>' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:16px;">' +
            '<div style="text-align:center;flex:1;">' +
                '<button id="svbSatsBtn" onclick="window._svbVote(\'sats\')" style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#f7931a,#ea580c);border:2px solid #f7931a;color:#fff;font-size:1.2rem;cursor:pointer;transition:transform 0.15s;display:flex;align-items:center;justify-content:center;margin:0 auto 3px;touch-action:manipulation;box-shadow:0 2px 10px rgba(247,147,26,0.3);">₿</button>' +
                '<div id="svbSatsCount" style="font-size:0.95rem;font-weight:900;color:#f7931a;">0</div>' +
                '<div style="font-size:0.55rem;color:var(--text-faint);font-weight:700;">SATS</div>' +
            '</div>' +
            '<div style="font-size:0.7rem;font-weight:900;color:var(--text-faint);letter-spacing:1px;">VS</div>' +
            '<div style="text-align:center;flex:1;">' +
                '<button id="svbBitsBtn" onclick="window._svbVote(\'bits\')" style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#6366f1);border:2px solid #3b82f6;color:#fff;font-size:1.2rem;cursor:pointer;transition:transform 0.15s;display:flex;align-items:center;justify-content:center;margin:0 auto 3px;touch-action:manipulation;box-shadow:0 2px 10px rgba(59,130,246,0.3);">ƀ</button>' +
                '<div id="svbBitsCount" style="font-size:0.95rem;font-weight:900;color:#3b82f6;">0</div>' +
                '<div style="font-size:0.55rem;color:var(--text-faint);font-weight:700;">BITS</div>' +
            '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:4px;margin-top:6px;">' +
            '<span style="font-size:0.5rem;color:#f7931a;font-weight:700;">SATS</span>' +
            '<div id="svbBar" style="flex:1;height:8px;background:linear-gradient(90deg,#3b82f6,#6366f1);border-radius:4px;overflow:hidden;"></div>' +
            '<span style="font-size:0.5rem;color:#3b82f6;font-weight:700;">BITS</span>' +
        '</div>' +
        '<div id="svbRemaining" style="text-align:center;font-size:0.5rem;color:var(--text-faint);margin-top:3px;">' + DAILY_LIMIT + ' taps left today</div>';

    djBar.appendChild(widget);
    updateDisplay();
}

function loadLiveVotes() {
    var db = typeof firebase !== 'undefined' ? firebase.firestore() : null;
    if (!db) return;

    // Real-time listener
    db.doc(FIRESTORE_DOC).onSnapshot(function(doc) {
        if (doc.exists) {
            var d = doc.data();
            localSats = d.sats || 0;
            localBits = d.bits || 0;

            // Anti-cheat: check device limit
            var fp = getFingerprint();
            var deviceTotal = (d.devices && d.devices[fp]) || 0;
            if (deviceTotal > 5000) {
                // This device has voted excessively — flag but don't block display
                console.warn('[SVB] Device has ' + deviceTotal + ' total votes');
            }
        }
        updateDisplay();
    }, function() {
        // Fallback: one-time read
        db.doc(FIRESTORE_DOC).get().then(function(doc) {
            if (doc.exists) {
                localSats = doc.data().sats || 0;
                localBits = doc.data().bits || 0;
                updateDisplay();
            }
        }).catch(function() {});
    });

    // Initialize Firestore doc if it doesn't exist
    db.doc(FIRESTORE_DOC).get().then(function(doc) {
        if (!doc.exists) {
            db.doc(FIRESTORE_DOC).set({ sats: 0, bits: 0, devices: {} });
        }
    }).catch(function() {});
}

// Global vote function
window._svbVote = function(side) { castVote(side); };

// Hook into renderChatHub to inject widget after DJ bar appears
var _checkInterval = null;
var _origRenderChat = window.renderChatHub;
if (_origRenderChat) {
    window.renderChatHub = function(tab) {
        _origRenderChat(tab);
        if (_checkInterval) clearInterval(_checkInterval);
        var tries = 0;
        _checkInterval = setInterval(function() {
            if (document.getElementById('djNowPlaying') || tries > 30) {
                clearInterval(_checkInterval);
                if (document.getElementById('djNowPlaying')) injectWidget();
            }
            tries++;
        }, 500);
    };
}

// Also try injection on DJ bar creation (MutationObserver)
if (typeof MutationObserver !== 'undefined') {
    var obs = new MutationObserver(function() {
        if (document.getElementById('djNowPlaying') && !document.getElementById('svbWidget')) {
            injectWidget();
        }
    });
    if (document.body) obs.observe(document.body, { childList: true, subtree: true });
}

loadDailyTaps();
console.log('[SVB] Sats vs Bits vote widget loaded');
})();
