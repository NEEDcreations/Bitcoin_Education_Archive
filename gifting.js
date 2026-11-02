// © 2024-2026 603BTC LLC. All rights reserved.
// Bitcoin Quest — daily gifts, labeled keys, locked ciphers.
// Lazy-loaded. Rewards and limits are decided by Cloud Functions.

(function() {
'use strict';

var CIPHER_OPENS_PER_DAY = 21;

function _callCF(name, data) {
    if (typeof firebase === 'undefined' || !firebase.functions) return Promise.reject(new Error('Firebase unavailable'));
    return firebase.functions().httpsCallable(name)(data || {});
}

function _isSignedIn() {
    return typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous;
}

function _getUid() {
    return auth.currentUser.uid;
}

function _esc(s) {
    var text = String(s || '');
    if (typeof escapeHtml === 'function') return escapeHtml(text);
    return text.replace(/[&<>"']/g, function(ch) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
}

function _utcDay() {
    return new Date().toISOString().slice(0, 10);
}

function _toast(msg, ms) {
    if (typeof showToast === 'function') showToast(msg, ms || 3500);
}

var SATS_OFF_MSG = 'Sats are disabled on this account.';

async function _readSatsDisabled() {
    try {
        var uid = _getUid();
        if (uid && typeof db !== 'undefined') {
            var snap = await db.collection('users').doc(uid).get();
            var off = snap.exists && snap.data().satsDisabled === true;
            window._satsDisabled = off;
            if (typeof currentUser !== 'undefined' && currentUser) currentUser.satsDisabled = off;
            return off;
        }
    } catch (e) { /* fall through to the loaded profile */ }
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.satsDisabled === true) {
        window._satsDisabled = true;
        return true;
    }
    return window._satsDisabled === true;
}

function _satsOffNote(parent) {
    var note = document.createElement('div');
    note.style.cssText = 'padding:10px;margin-bottom:8px;border-radius:10px;background:rgba(239,68,68,0.08);color:#ef4444;font-size:0.8rem;font-weight:700;';
    note.textContent = SATS_OFF_MSG;
    parent.appendChild(note);
}

function _keySendToast(name, res) {
    var awarded = res && res.data ? res.data.xpAwarded : null;
    var xp = (typeof awarded === 'number') ? awarded : 25;
    var extra = xp > 0 ? ' +' + xp + ' XP' : ' Daily XP cap reached.';
    _toast('🔑 Sent to ' + name + '!' + extra);
}

function _injectGiftingCSS() {
    if (document.getElementById('giftingCSS')) return;
    var s = document.createElement('style');
    s.id = 'giftingCSS';
    s.textContent = [
        '@keyframes giftBounce{0%{transform:scale(0.5)}60%{transform:scale(1.15)}100%{transform:scale(1)}}',
        '@keyframes giftShake{0%,100%{transform:rotate(0)}20%{transform:rotate(-8deg)}40%{transform:rotate(8deg)}60%{transform:rotate(-5deg)}80%{transform:rotate(5deg)}}',
        '@keyframes giftBoxShake{0%,100%{transform:rotate(0) translateY(0)}12%{transform:rotate(-9deg)}28%{transform:rotate(9deg)}44%{transform:rotate(-6deg)}60%{transform:rotate(6deg)}76%{transform:rotate(-2deg) translateY(-3px)}88%{transform:rotate(0) translateY(-8px)}}',
        '@keyframes giftLidPop{0%{transform:translateY(0) rotate(0);opacity:1}45%{transform:translateY(-30px) rotate(-16deg);opacity:1}100%{transform:translateY(-52px) rotate(-28deg);opacity:0}}',
        '@keyframes giftSpark{0%{transform:translate(0,0) scale(0.3);opacity:0}25%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(1);opacity:0}}',
        '@keyframes giftPrizePop{0%{transform:scale(0.3);opacity:0}70%{transform:scale(1.12);opacity:1}100%{transform:scale(1);opacity:1}}',
        '@keyframes giftReveal{from{opacity:0;transform:scale(0.86)}to{opacity:1;transform:scale(1)}}',
        '@keyframes decryptScan{0%{opacity:0.45}50%{opacity:1}100%{opacity:0.45}}',
        '@keyframes decryptReveal{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}',
        '@keyframes decryptConfetti{to{transform:translateY(220px) rotate(720deg);opacity:0}}',
        '@keyframes decryptPulse{0%,100%{text-shadow:0 0 8px #f7931a}50%{text-shadow:0 0 24px #f7931a}}',
        '@keyframes giftBtnSpin{to{transform:rotate(360deg)}}',
        '.gifting-overlay{position:fixed;inset:0;background:rgba(2,6,23,0.82);z-index:480000;display:flex;align-items:center;justify-content:center;padding:16px;}',
        '.gifting-modal{background:#0f172a;background-color:#0f172a;color:#e2e8f0;opacity:1;border:1px solid rgba(247,147,26,0.35);border-radius:20px;padding:22px 18px;max-width:420px;width:100%;text-align:center;box-shadow:0 16px 50px rgba(0,0,0,0.45);max-height:90vh;overflow-y:auto;}',
        '[data-theme="light"] .gifting-modal{background:#ffffff;background-color:#ffffff;color:#1e293b;}',
        '.oled-theme .gifting-modal,[data-theme="oled"] .gifting-modal{background:#000000;background-color:#000000;color:#e2e8f0;}',
        '.gifting-modal button{min-height:44px;min-width:44px;box-sizing:border-box;}',
        '.gift-open-btn,.cipher-open-btn,.key-send-btn{min-height:44px;min-width:44px;padding:10px 16px;border:none;border-radius:10px;color:#fff;font-size:0.88rem;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;}',
        '.gift-open-btn{background:linear-gradient(135deg,#f7931a,#ea580c);}',
        '.gift-open-btn:disabled{cursor:progress;opacity:0.92;}',
        '.gift-later-btn{background:transparent;color:var(--text-muted,#94a3b8);border:1px solid var(--border,#334155);}',
        '.gift-btn-spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;display:inline-block;flex:0 0 auto;animation:giftBtnSpin 0.7s linear infinite;}',
        '.gift-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.28);border-radius:12px;}',
        '.gift-prize-emoji{font-size:2rem;line-height:1;flex-shrink:0;animation:giftReveal 0.35s ease-out;}',
        '.gift-prize-label{flex:1;min-width:120px;font-size:0.95rem;font-weight:800;line-height:1.3;}',
        '.gift-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}',
        '.gift-actions button{flex:1 1 132px;}',
        '.kc-card{display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg-side,#0f172a);border:1px solid var(--border,#333);border-radius:12px;}',
        '.kc-accent{color:#f7931a;}.kc-locked{color:#a78bfa;}.kc-match{color:#34d399;}',
        '[data-theme="light"] .kc-accent{color:#c2410c;}[data-theme="light"] .kc-locked{color:#6d28d9;}[data-theme="light"] .kc-match{color:#047857;}',
        '.gift-stage-box{position:relative;height:96px;display:flex;align-items:flex-end;justify-content:center;overflow:visible;}',
        '.gift-base{font-size:3.2rem;line-height:1;animation:giftBoxShake 0.72s ease-in-out;}',
        '.gift-lid{position:absolute;top:6px;font-size:1.5rem;animation:giftLidPop 0.5s ease-out 0.62s forwards;}',
        '.gift-prize-pop{position:absolute;top:8px;font-size:1.8rem;animation:giftPrizePop 0.45s ease-out 0.78s both;}',
        '@media (max-width:700px){.gifting-overlay{padding:12px;}.gifting-modal{padding:16px 12px;border-radius:16px;}.gift-actions{flex-direction:column;}.gift-actions button{width:100%;flex:1 1 auto;}}',
        '.kc-intro{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin:2px 0 10px;flex-wrap:wrap;}',
        '.kc-intro p{flex:1;min-width:160px;margin:0;}',
        '.kc-key-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;margin:14px 0 8px;}',
        '.kc-key-title{font-size:0.72rem;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;line-height:1.35;max-width:100%;}',
        '.kc-key-note{flex:1 1 12rem;min-width:min(100%,12rem);font-size:0.75rem;font-weight:600;line-height:1.35;letter-spacing:0;text-transform:none;color:var(--text-muted,#94a3b8);overflow-wrap:anywhere;}',
        '.kc-key-help{margin:0 0 12px;border:1px solid var(--border,#333);border-radius:12px;background:var(--bg-side,#0f172a);}',
        '.kc-key-help summary{cursor:pointer;font-size:0.82rem;font-weight:800;padding:10px 12px;color:var(--heading,#fff);}',
        '.kc-key-help summary:focus-visible{outline:2px solid #f7931a;outline-offset:2px;}',
        '.kc-key-help ol{margin:0;padding:0 12px 12px 28px;font-size:0.78rem;line-height:1.45;color:var(--text,#e2e8f0);}',
        '.kc-key-help li{margin:0 0 8px;}',
        '.kc-help-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;}',
        '.kc-help-link{min-height:40px;padding:8px 12px;background:transparent;border:1px solid var(--link,#60a5fa);border-radius:8px;color:var(--link,#60a5fa);font-size:0.78rem;font-weight:800;cursor:pointer;font-family:inherit;}',
        '.kc-send-wrap{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:0 1 auto;max-width:100%;}',
        '.kc-send-hint{margin:0;font-size:0.75rem;line-height:1.35;color:var(--text-muted,#94a3b8);text-align:right;max-width:12rem;overflow-wrap:anywhere;}',
        '.kc-card{max-width:100%;min-width:0;}',
        '.kc-stack-label{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:900;line-height:1.35;overflow-wrap:anywhere;word-break:break-word;min-width:0;}',
        '.kc-copy{flex:1;min-width:0;}',
        '.kc-copy-title,.kc-copy-note{overflow-wrap:anywhere;word-break:break-word;}',
        '@media (max-width:520px){.kc-card{flex-wrap:wrap;align-items:flex-start;}.kc-card .cipher-open-btn,.kc-card .key-send-btn{width:100%;}.kc-intro{flex-direction:column;align-items:flex-start;}.kc-send-wrap{width:100%;align-items:stretch;}.kc-send-hint{max-width:none;text-align:left;}}',
        '@media (max-width:360px){.kc-card{padding:10px 8px;gap:8px;}.kc-copy-title{font-size:0.84rem;}.kc-stack-label{font-size:0.95rem;}.kc-key-title{font-size:0.68rem;letter-spacing:0.04em;}.kc-key-note{flex-basis:100%;}}'
    ].join('');
    document.head.appendChild(s);
}

function _rewardEmoji(rw) {
    if (!rw) return '🎁';
    if (rw.rewardType === 'tickets') return '🎫';
    if (rw.rewardType === 'xp_bonus' || rw.rewardType === 'xp_tickets') return '⭐';
    if (rw.rewardType === 'streak_shield') return '🛡️';
    if (rw.rewardType === 'closet_item') return rw.itemEmoji || '👑';
    if (rw.rewardType === 'nacho_shoutout') return '🦌';
    if (rw.rewardType === 'keys') return '🔑';
    if (rw.rewardType === 'locked_ciphers') return '🔒';
    if (rw.rewardType === 'sats') return '⚡';
    return '🎁';
}

var SHOUTOUT_WEEK_MSG = "You already got a Nacho shoutout this week, so here's +100 XP!";

function _rewardLabel(rw) {
    if (!rw) return 'Reward';
    if (rw.shoutoutConverted) return rw.conversionMessage || SHOUTOUT_WEEK_MSG;
    if (rw.rewardType === 'tickets') return '+' + (rw.ticketCount || 1) + ' Orange Ticket' + ((rw.ticketCount || 1) > 1 ? 's' : '');
    if (rw.rewardType === 'xp_bonus') return '+' + (rw.xpAmount || 50) + ' XP' + (rw.doubled === true ? ' 2x' : '');
    if (rw.rewardType === 'xp_tickets') {
        var bits = ['+' + (rw.xpAmount || 50) + ' XP' + (rw.doubled === true ? ' 2x' : '')];
        if ((rw.ticketCount || 0) > 0) bits.push('+' + rw.ticketCount + ' ticket' + (rw.ticketCount > 1 ? 's' : ''));
        return bits.join(' and ');
    }
    if (rw.rewardType === 'streak_shield') return 'Streak Shield';
    if (rw.rewardType === 'closet_item') return rw.itemName || 'Closet item';
    if (rw.rewardType === 'nacho_shoutout') return 'Nacho Shoutout';
    if (rw.rewardType === 'keys') {
        var labels = (rw.keyLabels || []).join(', ');
        return (rw.keyLabels || []).length + ' key' + ((rw.keyLabels || []).length === 1 ? '' : 's') + (labels ? ' (' + labels + ')' : '');
    }
    if (rw.rewardType === 'locked_ciphers') {
        var cl = (rw.cipherLabels || []).join(', ');
        return (rw.cipherLabels || []).length + ' locked cipher' + ((rw.cipherLabels || []).length === 1 ? '' : 's') + (cl ? ' (' + cl + ')' : '');
    }
    if (rw.rewardType === 'sats') {
        var amt = (rw.satsAmount || 0).toLocaleString();
        if (rw.satsStatus === 'balance') return '+' + amt + ' sats added to your cipher balance';
        if (rw.satsStatus === 'pending') return amt + ' sats — Phil will pay this one';
        return amt + ' sats';
    }
    return 'Reward';
}

var _spentKeys = {};
var _spentCiphers = {};
var _cipherBusy = false;
var _giftsOpening = {};
var _openAllBusy = false;
var _forceServerHoldings = false;
// openGift flips that gift's status and applies daily XP, tickets, keys,
// closet items, and the weekly shoutout cap in one transaction. Parallel
// opens of different gifts conflict on the user doc and retry, so they
// cannot over-award those caps. Sats are not granted here. Keep a small
// pool so a burst still lines up on that one user document.
var GIFT_OPEN_CONCURRENCY = 3;
var GIFT_OPEN_ANIM_MS = 450;
var _giftQueue = [];
var _giftActiveCount = 0;
var _giftSettled = {};
var _giftWaiters = {};
var _giftPromises = {};
var _giftSilent = {};
var _giftAnimGen = 0;
var _holdingsRefresh = null;
var _holdingsRefreshQueued = false;
var _giftReturnFocus = null;
var _giftKeyBound = false;
var _giftLayerZ = 480000;

function _emptyEl(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
}

function _soundOn() {
    try {
        if (typeof window.audioEnabled === 'boolean' && window.audioEnabled === false) return false;
        if (localStorage.getItem('btc_audio') === 'false') return false;
        if (typeof window.audioVolume === 'number' && window.audioVolume <= 0) return false;
        var stored = parseFloat(localStorage.getItem('btc_volume') || '');
        if (isFinite(stored) && stored <= 0) return false;
    } catch (e) { return true; }
    return true;
}

function _soundGain() {
    var v = 0.5;
    if (typeof window.audioVolume === 'number' && isFinite(window.audioVolume)) v = window.audioVolume;
    else {
        try {
            var stored = parseFloat(localStorage.getItem('btc_volume') || '');
            if (isFinite(stored)) v = stored;
        } catch (e) { /* keep the modest default */ }
    }
    return Math.max(0.04, Math.min(0.18, v * 0.28));
}

function _audioCtx() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!window._sharedAudioCtx) {
        try { window._sharedAudioCtx = new AC(); } catch (e) { return null; }
    }
    return window._sharedAudioCtx;
}

function _unlockAudio() {
    var ctx = _audioCtx();
    if (ctx && ctx.state === 'suspended') {
        try { var p = ctx.resume(); if (p && p.catch) p.catch(function() {}); } catch (e) { /* iOS may reject until a tap */ }
    }
    if (ctx) {
        try {
            var buf = ctx.createBuffer(1, 1, ctx.sampleRate);
            var src = ctx.createBufferSource();
            src.buffer = buf;
            var silent = ctx.createGain();
            silent.gain.value = 0;
            src.connect(silent);
            silent.connect(ctx.destination);
            src.start(0);
        } catch (e) { /* the tap still resumed the context */ }
    }
    return ctx;
}

function _noiseBurst(ctx, when, dur, gainVal, freq) {
    var n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.7;
    var g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(when);
    src.stop(when + dur + 0.02);
}

function _tone(ctx, when, dur, freq, gainVal, type) {
    var osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, when);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gainVal), when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + dur + 0.02);
    return osc;
}

function _playGiftChime() {
    if (!_soundOn()) return;
    var ctx = _unlockAudio();
    if (!ctx) return;
    try {
        var t = ctx.currentTime + 0.02;
        var g = _soundGain();
        _noiseBurst(ctx, t + 0.55, 0.09, g * 0.9, 900);
        _tone(ctx, t + 0.55, 0.12, 520, g * 0.7, 'triangle');
        _tone(ctx, t + 0.66, 0.28, 880, g * 0.55, 'sine');
        _tone(ctx, t + 0.78, 0.36, 1320, g * 0.4, 'sine');
    } catch (e) { /* sound is optional */ }
}

function _playUnlockSound() {
    if (!_soundOn()) return;
    var ctx = _unlockAudio();
    if (!ctx) return;
    try {
        var t = ctx.currentTime + 0.02;
        var g = _soundGain();
        _noiseBurst(ctx, t, 0.045, g * 0.7, 1800);
        _noiseBurst(ctx, t + 0.18, 0.04, g * 0.6, 1400);
        _noiseBurst(ctx, t + 0.36, 0.04, g * 0.55, 1100);
        _noiseBurst(ctx, t + 0.54, 0.045, g * 0.5, 900);
        var whoosh = ctx.createOscillator();
        whoosh.type = 'sine';
        whoosh.frequency.setValueAtTime(90, t + 0.15);
        whoosh.frequency.linearRampToValueAtTime(180, t + 0.55);
        whoosh.frequency.linearRampToValueAtTime(55, t + 1.05);
        var wg = ctx.createGain();
        wg.gain.setValueAtTime(0.0001, t + 0.15);
        wg.gain.linearRampToValueAtTime(g * 0.45, t + 0.4);
        wg.gain.linearRampToValueAtTime(0.001, t + 1.05);
        whoosh.connect(wg);
        wg.connect(ctx.destination);
        whoosh.start(t + 0.15);
        whoosh.stop(t + 1.08);
        _tone(ctx, t + 1.05, 0.22, 70, g * 0.85, 'sine');
        _noiseBurst(ctx, t + 1.05, 0.08, g * 0.5, 180);
    } catch (e) { /* sound is optional */ }
}

function _paintSoundBtn(btn) {
    if (!btn) return;
    var on = _soundOn();
    btn.textContent = on ? '🔊 Sound on' : '🔇 Sound off';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}

function _toggleAppSound(btn) {
    _unlockAudio();
    if (typeof toggleAudio === 'function') toggleAudio();
    else {
        var on = !_soundOn();
        window.audioEnabled = on;
        try { localStorage.setItem('btc_audio', on ? 'true' : 'false'); } catch (e) { /* private mode */ }
    }
    _paintSoundBtn(btn);
    var other = document.getElementById(btn && btn.id === 'giftSoundToggle' ? 'nookSoundToggle' : 'giftSoundToggle');
    if (other) _paintSoundBtn(other);
}

function _soundButton(id) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = id;
    btn.style.cssText = 'min-height:44px;min-width:44px;padding:10px 14px;background:transparent;color:var(--text-muted);border:1px solid var(--border,#333);border-radius:10px;font-size:0.88rem;font-weight:800;cursor:pointer;font-family:inherit;flex-shrink:0;box-sizing:border-box;';
    _paintSoundBtn(btn);
    btn.onclick = function() { _toggleAppSound(btn); };
    return btn;
}

function _playHex(el, ms) {
    return new Promise(function(resolve) {
        if (!el) { setTimeout(resolve, ms); return; }
        var hex = '0123456789ABCDEF';
        el.style.animation = 'decryptScan 0.8s ease-in-out infinite';
        var timer = setInterval(function() {
            var s = '3045022100';
            for (var i = 0; i < 32; i++) s += hex[(Math.random() * 16) | 0];
            el.textContent = s;
        }, 45);
        setTimeout(function() {
            clearInterval(timer);
            el.style.animation = 'none';
            resolve();
        }, ms);
    });
}

function _playGiftOpen(stage) {
    var gen = ++_giftAnimGen;
    return new Promise(function(resolve) {
        var finished = false;
        function finish() {
            if (finished) return;
            finished = true;
            if (stage && gen === _giftAnimGen) {
                stage.style.display = 'none';
                _emptyEl(stage);
            }
            resolve();
        }
        try {
            if (!stage) { setTimeout(finish, GIFT_OPEN_ANIM_MS); return; }
            stage.style.display = 'block';
            stage.style.fontFamily = 'inherit';
            stage.style.background = 'transparent';
            stage.style.minHeight = '72px';
            _emptyEl(stage);
            var box = document.createElement('div');
            box.className = 'gift-stage-box';
            box.setAttribute('aria-hidden', 'true');
            var lid = document.createElement('div');
            lid.className = 'gift-lid';
            lid.textContent = '✨';
            var base = document.createElement('div');
            base.className = 'gift-base';
            base.textContent = '🎁';
            var pop = document.createElement('div');
            pop.className = 'gift-prize-pop';
            pop.textContent = '🎉';
            box.appendChild(lid);
            box.appendChild(base);
            box.appendChild(pop);
            var sparks = ['✦', '✧', '✨', '⭐'];
            for (var i = 0; i < 8; i++) {
                var s = document.createElement('span');
                s.textContent = sparks[i % sparks.length];
                s.style.cssText = 'position:absolute;left:50%;top:42%;font-size:0.95rem;pointer-events:none;animation:giftSpark 0.45s ease-out ' + (0.12 + i * 0.02) + 's forwards;';
                if (s.style.setProperty) {
                    s.style.setProperty('--dx', ((i - 3.5) * 16) + 'px');
                    s.style.setProperty('--dy', (-18 - (i % 3) * 14) + 'px');
                }
                box.appendChild(s);
            }
            stage.appendChild(box);
            setTimeout(finish, GIFT_OPEN_ANIM_MS);
        } catch (e) {
            finish();
        }
    });
}

function _numericZ(node) {
    if (!node || node.nodeType !== 1) return 0;
    var best = 0;
    if (node.style && node.style.zIndex) {
        var inline = parseInt(node.style.zIndex, 10);
        if (inline > best) best = inline;
    }
    var css = node.getAttribute && node.getAttribute('style');
    if (css) {
        var match = String(css).match(/z-index:\s*(\d+)/i);
        if (match) {
            var fromCss = parseInt(match[1], 10);
            if (fromCss > best) best = fromCss;
        }
    }
    if (typeof window.getComputedStyle === 'function') {
        try {
            var computed = parseInt(window.getComputedStyle(node).zIndex, 10);
            if (computed > best) best = computed;
        } catch (e) { /* a detached node has no computed style */ }
    }
    return best;
}

function _layerOpen(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.id === 'postSpinGiftOverlay') return false;
    if (node.getAttribute && node.getAttribute('hidden') != null) return false;
    if (node.style && node.style.display === 'none') return false;
    if (node.classList && node.classList.contains('open')) return true;
    if (node.id === 'spinModal' || node.id === 'questHubOverlay' || node.id === 'onboardingOverlay') return true;
    if (typeof window.getComputedStyle === 'function') {
        try {
            if (window.getComputedStyle(node).display === 'none') return false;
        } catch (e) { return false; }
    }
    return true;
}

function _raiseGiftLayer() {
    var top = 480000;
    function consider(node) {
        var cur = node;
        while (cur && cur !== document && cur !== document.documentElement) {
            if (_layerOpen(cur)) {
                var z = _numericZ(cur);
                if (z > top) top = z;
            }
            cur = cur.parentNode;
        }
    }
    if (document.activeElement) consider(document.activeElement);
    ['usernameModal', 'questHubOverlay', 'spinModal', 'onboardingOverlay', 'tosModal'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) consider(el);
    });
    var kids = document.body ? document.body.childNodes : [];
    for (var i = 0; i < kids.length; i++) consider(kids[i]);
    _giftLayerZ = top + 2;
    return _giftLayerZ;
}

// User-opened cipher, key send, claim, and inventory sit above the gift
// screen. Esc and Back close only that layer and return focus to the gift.
var _giftingChildren = [];
var _giftingPopBound = false;
var _giftingIgnorePop = 0;

function _topLayerZ() {
    var top = _giftLayerZ || 480000;
    var ids = ['postSpinGiftOverlay', 'decryptCipherOverlay', 'cipherClaimOverlay', 'peerPickerOverlay', 'keyPickerOverlay', 'questHubOverlay'];
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (!el) continue;
        var z = _numericZ(el);
        if (z > top) top = z;
    }
    return top + 2;
}

function _firstElementChild(node) {
    var kids = node && node.childNodes ? node.childNodes : [];
    for (var i = 0; i < kids.length; i++) {
        if (kids[i] && kids[i].nodeType === 1) return kids[i];
    }
    return null;
}

function _focusables(root) {
    var out = [];
    function walk(node) {
        if (!node || node.nodeType !== 1) return;
        var tag = String(node.tagName || '').toUpperCase();
        if ((tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'A' || tag === 'SELECT') && !node.disabled) out.push(node);
        var kids = node.childNodes || [];
        for (var i = 0; i < kids.length; i++) walk(kids[i]);
    }
    walk(root);
    return out;
}

function _bindGiftingPop() {
    if (_giftingPopBound || !window.addEventListener) return;
    _giftingPopBound = true;
    window.addEventListener('popstate', function() {
        if (_giftingIgnorePop > 0) {
            _giftingIgnorePop--;
            return;
        }
        var top = _giftingChildren.length ? _giftingChildren[_giftingChildren.length - 1] : null;
        if (!top) return;
        if (top.inventory) {
            setTimeout(function() {
                if (!document.getElementById('questHubOverlay')) _finishGiftingChild(top);
            }, 0);
            return;
        }
        if (!top.pushed) return;
        top.pushed = false;
        _finishGiftingChild(top);
    });
}

function _restoreGiftingFocus(entry) {
    var back = entry && entry.focus;
    if (back && _nodeInside(back, document.body) && typeof back.focus === 'function') {
        try { back.focus(); return; } catch (e) { /* the opener may be gone */ }
    }
    var gift = document.getElementById('postSpinGiftOverlay');
    var dialog = gift ? _firstElementChild(gift) : null;
    if (dialog && typeof dialog.focus === 'function') {
        try { dialog.focus(); } catch (e2) { /* focus is best-effort */ }
    }
}

function _finishGiftingChild(entry) {
    if (!entry) return;
    var idx = _giftingChildren.indexOf(entry);
    if (idx >= 0) _giftingChildren.splice(idx, 1);
    if (entry.el && entry.el.parentNode) entry.el.remove();
    _restoreGiftingFocus(entry);
}

function _mountGiftingChild(overlay, returnFocus) {
    if (!overlay) return;
    overlay.style.zIndex = String(_topLayerZ());
    var modal = _firstElementChild(overlay);
    if (modal) {
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        if (modal.getAttribute('tabindex') == null) modal.setAttribute('tabindex', '-1');
    }
    var pushed = false;
    try {
        if (typeof history !== 'undefined' && history && typeof history.pushState === 'function') {
            history.pushState({ giftingChild: overlay.id }, '', (window.location && window.location.href) || '');
            pushed = true;
        }
    } catch (e) { pushed = false; }
    _giftingChildren.push({ id: overlay.id, el: overlay, focus: returnFocus || null, pushed: pushed, modal: modal, inventory: false });
    _bindGiftingPop();
    setTimeout(function() {
        if (modal && typeof modal.focus === 'function') {
            try { modal.focus(); } catch (err) { /* focus is best-effort */ }
        }
    }, 30);
}

function _dismissGiftingChild(overlayOrId, reason) {
    var id = typeof overlayOrId === 'string' ? overlayOrId : (overlayOrId && overlayOrId.id);
    if (!id) return;
    var entry = null;
    for (var i = 0; i < _giftingChildren.length; i++) {
        if (_giftingChildren[i].id === id) { entry = _giftingChildren[i]; break; }
    }
    if (!entry) {
        var el = typeof overlayOrId === 'string' ? document.getElementById(id) : overlayOrId;
        if (el && el.parentNode) el.remove();
        return;
    }
    if (reason !== 'back' && entry.pushed && typeof history !== 'undefined' && history && typeof history.back === 'function') {
        entry.pushed = false;
        _giftingIgnorePop++;
        try { history.back(); } catch (err) { _giftingIgnorePop--; }
    }
    _finishGiftingChild(entry);
}

function _topGiftingChild() {
    for (var i = _giftingChildren.length - 1; i >= 0; i--) {
        var entry = _giftingChildren[i];
        if (entry.inventory) {
            if (document.getElementById('questHubOverlay')) return entry;
            continue;
        }
        if (entry.el && entry.el.parentNode) return entry;
    }
    return null;
}

function _closeInventoryOverGift() {
    var entry = null;
    for (var i = _giftingChildren.length - 1; i >= 0; i--) {
        if (_giftingChildren[i].inventory) { entry = _giftingChildren.splice(i, 1)[0]; break; }
    }
    var hub = document.getElementById('questHubOverlay');
    if (hub && hub.parentNode) hub.remove();
    if (window._qhPopHandler && window.removeEventListener) {
        window.removeEventListener('popstate', window._qhPopHandler);
        window._qhPopHandler = null;
    }
    var hash = (window.location && window.location.hash) || '';
    if (hash === '#questhub' && typeof history !== 'undefined' && history && typeof history.back === 'function') {
        _giftingIgnorePop++;
        try { history.back(); } catch (err) { _giftingIgnorePop--; }
    }
    _restoreGiftingFocus(entry);
}

function _trapGiftingTab(e, entry) {
    var root = (entry && entry.el) || document.getElementById('questHubOverlay');
    var items = _focusables(root);
    if (!items.length) return;
    var current = document.activeElement;
    var idx = items.indexOf(current);
    if (e.preventDefault) e.preventDefault();
    var next = e.shiftKey ? (idx <= 0 ? items[items.length - 1] : items[idx - 1]) : (idx < 0 || idx >= items.length - 1 ? items[0] : items[idx + 1]);
    if (next && typeof next.focus === 'function') {
        try { next.focus(); } catch (err) { /* keep the dialog focus */ }
    }
}

function _noteInventoryOverGift(returnFocus) {
    var hub = document.getElementById('questHubOverlay');
    if (!hub || !document.getElementById('postSpinGiftOverlay')) return;
    hub.style.zIndex = String(_topLayerZ());
    var modal = _firstElementChild(hub);
    if (modal) {
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        if (modal.getAttribute('tabindex') == null) modal.setAttribute('tabindex', '-1');
        if (typeof modal.focus === 'function') {
            try { modal.focus(); } catch (e) { /* focus is best-effort */ }
        }
    }
    _giftingChildren.push({ id: 'questHubOverlay', el: hub, focus: returnFocus || null, pushed: false, modal: modal, inventory: true });
    _bindGiftingPop();
}

function _confetti() {
    var colors = ['#f7931a', '#fbbf24', '#a78bfa', '#34d399', '#f472b6', '#60a5fa'];
    for (var i = 0; i < 12; i++) {
        var dot = document.createElement('div');
        dot.style.cssText = 'position:fixed;width:8px;height:8px;border-radius:50%;pointer-events:none;z-index:' + (_giftLayerZ + 8) + ';left:' + (15 + Math.random() * 70) + '%;top:' + (8 + Math.random() * 30) + '%;background:' + colors[i % colors.length] + ';animation:decryptConfetti 1.2s ease-out forwards;';
        document.body.appendChild(dot);
        setTimeout(function(d) { if (d && d.parentNode) d.parentNode.removeChild(d); }, 1400, dot);
    }
}

function _btn(label, bg) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = 'min-height:44px;min-width:44px;padding:10px 16px;background:' + (bg || 'linear-gradient(135deg,#f7931a,#ea580c)') + ';color:#fff;border:none;border-radius:10px;font-size:0.88rem;font-weight:800;cursor:pointer;font-family:inherit;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;';
    return b;
}

// ─── After the daily spin ────────────────────────────────────────────────────

window.awardDailyGifts = async function() {
    if (!_isSignedIn()) return;
    _injectGiftingCSS();
    window._suppressPendingGifts = true;
    try {
        var result = await _callCF('awardDailyGifts', {});
        var d = result.data || {};
        if (d.alreadyAwarded) {
            window._suppressPendingGifts = false;
            return;
        }
        if (d.giftsAdded > 0 && Array.isArray(d.gifts) && d.gifts.length) {
            _toast('🎁 ' + d.giftsAdded + ' gifts earned!');
            window.showPostSpinGiftModal(d.gifts);
        }
    } catch (e) {
        window._suppressPendingGifts = false;
        console.warn('[gifting] awardDailyGifts failed:', e.message);
    }
};

window.checkPendingGifts = async function() {
    if (window._pendingGiftsChecked || window._suppressPendingGifts) return;
    if (!_isSignedIn() || typeof db === 'undefined') return;
    window._pendingGiftsChecked = true;
    try {
        var snap = await db.collection('gifts')
            .where('ownerId', '==', _getUid())
            .where('status', 'in', ['unopened', 'inventory', 'sent'])
            .limit(40).get();
        if (window._suppressPendingGifts || document.getElementById('postSpinGiftOverlay')) return;
        if (snap.empty) return;
        var gifts = snap.docs.map(function(d) {
            return { id: d.id, rewardType: (d.data().rewardType || '') };
        });
        window.showPostSpinGiftModal(gifts, { pending: true });
    } catch (e) {
        console.warn('[gifting] pending gifts:', e.message);
    }
};

function _resetGiftOpenState() {
    _giftQueue = [];
    _giftActiveCount = 0;
    _giftSettled = {};
    _giftWaiters = {};
    _giftPromises = {};
    _giftSilent = {};
    _giftsOpening = {};
    _openAllBusy = false;
}

function _rowButton(giftId) {
    var row = document.getElementById('giftRow_' + giftId);
    if (!row) return null;
    var nodes = row.childNodes || [];
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i] && nodes[i].tagName === 'BUTTON') return nodes[i];
    }
    return null;
}

function _paintOpeningButton(btn) {
    if (!btn) return;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    _emptyEl(btn);
    var spin = document.createElement('span');
    spin.className = 'gift-btn-spin';
    spin.setAttribute('aria-hidden', 'true');
    var text = document.createElement('span');
    text.textContent = 'Opening…';
    btn.appendChild(spin);
    btn.appendChild(text);
}

function _showOpening(giftId) {
    var row = document.getElementById('giftRow_' + giftId);
    if (row) {
        row.style.opacity = '';
        row.setAttribute('data-gift-state', 'opening');
    }
    _paintOpeningButton(_rowButton(giftId));
}

function _settleGift(giftId) {
    var waiters = _giftWaiters[giftId] || [];
    delete _giftWaiters[giftId];
    delete _giftPromises[giftId];
    for (var i = 0; i < waiters.length; i++) {
        try { waiters[i](); } catch (e) { /* a waiter cannot stall the queue */ }
    }
}

function _nodeInside(node, root) {
    if (!node || !root) return false;
    if (typeof root.contains === 'function') return root.contains(node);
    var cur = node;
    while (cur) {
        if (cur === root) return true;
        cur = cur.parentNode;
    }
    return false;
}

function _isGiftAlreadyOpened(err) {
    var code = err && err.code ? String(err.code) : '';
    if (code === 'already-exists' || code === 'functions/already-exists') return true;
    var msg = err && err.message ? String(err.message) : '';
    return /already opened/i.test(msg);
}

function _removeUnopenedGift(giftId) {
    var gifts = window._postSpinGifts;
    if (!gifts || !gifts.length) return;
    for (var i = gifts.length - 1; i >= 0; i--) {
        if (gifts[i] && gifts[i].id === giftId) gifts.splice(i, 1);
    }
}

function _syncOpenAllButton() {
    var openAll = document.getElementById('openAllGiftsBtn');
    if (!openAll) return;
    var gifts = window._postSpinGifts || [];
    for (var i = 0; i < gifts.length; i++) {
        var id = gifts[i] && gifts[i].id;
        if (id && _giftSettled[id] !== 'ok') return;
    }
    openAll.disabled = true;
    openAll.removeAttribute('aria-busy');
    openAll.textContent = 'All opened';
    openAll.style.background = '#34d399';
}

function _closePostSpinGiftModal() {
    var overlay = document.getElementById('postSpinGiftOverlay');
    if (!overlay) return;
    var pending = overlay.getAttribute('data-pending') === '1';
    var back = _giftReturnFocus;
    _giftReturnFocus = null;
    overlay.remove();
    if (pending) window._suppressPendingGifts = true;
    if (back && typeof back.focus === 'function' && !_nodeInside(back, overlay)) {
        try { back.focus(); } catch (e) { /* the opener may already be gone */ }
    }
}

function _onGiftModalKeydown(e) {
    if (!e) return;
    var key = e.key;
    var top = _topGiftingChild();
    if (top && key === 'Tab') {
        _trapGiftingTab(e, top);
        return;
    }
    if (key !== 'Escape' && key !== 'Esc' && e.keyCode !== 27) return;
    if (top) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        if (top.inventory) _closeInventoryOverGift();
        else _dismissGiftingChild(top.id, 'escape');
        return;
    }
    if (!document.getElementById('postSpinGiftOverlay')) return;
    if (e.preventDefault) e.preventDefault();
    _closePostSpinGiftModal();
}

function _bindGiftModalKeys() {
    if (_giftKeyBound || !document.addEventListener) return;
    _giftKeyBound = true;
    document.addEventListener('keydown', _onGiftModalKeydown);
}

function _refreshHoldingsInBackground() {
    if (_holdingsRefresh) {
        _holdingsRefreshQueued = true;
        return;
    }
    var run = function() {
        _holdingsRefresh = Promise.resolve().then(function() {
            return _refreshHoldingsViews();
        }).catch(function() { /* holdings catch up on the next open */ }).then(function() {
            _holdingsRefresh = null;
            if (_holdingsRefreshQueued) {
                _holdingsRefreshQueued = false;
                run();
            }
        });
    };
    run();
}

function _enqueueGiftOpen(giftId, opts) {
    opts = opts || {};
    if (!giftId) return Promise.resolve();
    if (_giftSettled[giftId] === 'ok') return Promise.resolve();
    if (_giftsOpening[giftId]) return _giftPromises[giftId] || Promise.resolve();
    _giftsOpening[giftId] = true;
    _giftSilent[giftId] = !!opts.silent;
    _showOpening(giftId);
    var promise = new Promise(function(resolve) {
        if (!_giftWaiters[giftId]) _giftWaiters[giftId] = [];
        _giftWaiters[giftId].push(resolve);
    });
    _giftPromises[giftId] = promise;
    _giftQueue.push(giftId);
    _pumpGiftOpens();
    return promise;
}

function _pumpGiftOpens() {
    while (_giftQueue.length && _giftActiveCount < GIFT_OPEN_CONCURRENCY) {
        var giftId = _giftQueue.shift();
        _giftActiveCount++;
        _runGiftOpen(giftId);
    }
}

async function _runGiftOpen(giftId) {
    var silent = !!_giftSilent[giftId];
    delete _giftSilent[giftId];
    _unlockAudio();
    _playGiftChime();
    _injectGiftingCSS();
    var stage = document.getElementById('giftAnimStage');
    var anim = _playGiftOpen(stage);
    if (anim && anim.catch) anim.catch(function() {});
    try {
        var rw = await _openGiftRequest(giftId);
        _markGiftRow(giftId, rw, false);
        _giftSettled[giftId] = 'ok';
        _syncOpenAllButton();
        if (!silent) {
            _confetti();
            _toast('🎁 ' + _rewardLabel(rw), rw && rw.shoutoutConverted ? 6000 : undefined);
        }
        _refreshHoldingsInBackground();
    } catch (e) {
        if (_isGiftAlreadyOpened(e)) {
            _markGiftAlreadyOpened(giftId);
            _giftSettled[giftId] = 'ok';
            _removeUnopenedGift(giftId);
            _syncOpenAllButton();
            if (!silent) _toast('Already opened');
        } else {
            delete _giftSettled[giftId];
            _markGiftRow(giftId, null, true);
            var row = document.getElementById('giftRow_' + giftId);
            if (row) {
                var retry = _btn('Try again');
                retry.className = 'gift-open-btn';
                retry.onclick = function() { window.openSingleGift(giftId); };
                row.appendChild(retry);
            }
            _toast('❌ ' + ((e && e.message) || 'Could not open that gift'));
        }
    } finally {
        delete _giftsOpening[giftId];
        _giftActiveCount = Math.max(0, _giftActiveCount - 1);
        _pumpGiftOpens();
        _settleGift(giftId);
    }
}

window.showPostSpinGiftModal = function(gifts, opts) {
    _injectGiftingCSS();
    opts = opts || {};
    var previousFocus = document.activeElement || null;
    var layer = _raiseGiftLayer();
    var existing = document.getElementById('postSpinGiftOverlay');
    if (existing) {
        if (_nodeInside(previousFocus, existing)) previousFocus = _giftReturnFocus;
        existing.remove();
    }
    _giftReturnFocus = previousFocus;
    _resetGiftOpenState();
    window._postSpinGifts = gifts.slice();
    window._openedGiftRewards = [];

    var overlay = document.createElement('div');
    overlay.id = 'postSpinGiftOverlay';
    overlay.className = 'gifting-overlay';
    overlay.style.zIndex = String(layer);
    overlay.setAttribute('data-pending', opts.pending ? '1' : '0');

    var modal = document.createElement('div');
    modal.className = 'gifting-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'postSpinGiftTitle');
    modal.tabIndex = -1;
    modal.setAttribute('tabindex', '-1');

    var count = gifts.length;
    var title = document.createElement('div');
    var emoji = document.createElement('div');
    emoji.textContent = '🎁';
    emoji.style.cssText = 'font-size:2.6rem;animation:giftBounce 0.6s ease-out;';
    var heading = document.createElement('div');
    heading.id = 'postSpinGiftTitle';
    heading.style.cssText = 'color:#f7931a;font-weight:900;font-size:1.2rem;margin:4px 0;';
    heading.textContent = opts.pending
        ? ('You have ' + count + ' gift' + (count > 1 ? 's' : '') + ' to open')
        : ('You won ' + count + ' gift' + (count > 1 ? 's' : '') + '!');
    var sub = document.createElement('div');
    sub.style.cssText = 'color:var(--text-muted,#94a3b8);font-size:0.8rem;margin-bottom:8px;';
    sub.textContent = 'Open them now — gifts are not saved for later.';
    title.appendChild(emoji);
    title.appendChild(heading);
    title.appendChild(sub);
    modal.appendChild(title);

    var stage = document.createElement('div');
    stage.id = 'giftAnimStage';
    stage.style.cssText = 'display:none;font-family:monospace;font-size:0.68rem;color:#f7931a;word-break:break-all;min-height:36px;margin:0 0 10px;padding:8px;background:rgba(247,147,26,0.06);border-radius:8px;';
    modal.appendChild(stage);

    var list = document.createElement('div');
    list.id = 'postSpinGiftList';
    list.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:14px;text-align:left;';
    gifts.forEach(function(g, i) {
        var row = document.createElement('div');
        row.id = 'giftRow_' + g.id;
        row.className = 'gift-row';
        row.setAttribute('data-gift-state', 'closed');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.28);border-radius:12px;';
        var icon = document.createElement('span');
        icon.textContent = '🎁';
        icon.style.cssText = 'font-size:1.6rem;line-height:1;flex-shrink:0;';
        var label = document.createElement('div');
        label.className = 'gift-prize-label';
        label.style.cssText = 'flex:1;min-width:120px;color:var(--text-muted,#94a3b8);font-size:0.9rem;';
        label.textContent = 'Gift ' + (i + 1);
        var btn = _btn('Open gift');
        btn.className = 'gift-open-btn';
        btn.setAttribute('data-gift-id', g.id);
        btn.onclick = function() { window.openSingleGift(g.id); };
        row.appendChild(icon);
        row.appendChild(label);
        row.appendChild(btn);
        list.appendChild(row);
    });
    modal.appendChild(list);

    var follow = document.createElement('div');
    follow.id = 'giftFollowUp';
    follow.style.marginBottom = '12px';
    modal.appendChild(follow);

    var actions = document.createElement('div');
    actions.className = 'gift-actions';
    actions.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;';
    var openAll = _btn('Open all');
    openAll.id = 'openAllGiftsBtn';
    openAll.className = 'gift-open-btn';
    openAll.onclick = function() { window.openAllPostSpinGifts(); };
    var later = _btn(opts.pending ? 'Not now' : 'Close', 'transparent');
    later.className = 'gift-later-btn';
    later.style.border = '1px solid var(--border,#334155)';
    later.style.color = 'var(--text-muted,#94a3b8)';
    later.onclick = function() { _closePostSpinGiftModal(); };
    actions.appendChild(openAll);
    actions.appendChild(later);
    actions.appendChild(_soundButton('giftSoundToggle'));
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    _bindGiftModalKeys();
    try { modal.focus(); } catch (e) { /* focus is best-effort when the dialog opens */ }
};

function _markGiftRow(giftId, rw, failed) {
    var row = document.getElementById('giftRow_' + giftId);
    if (!row) return;
    _emptyEl(row);
    row.style.opacity = '';
    var icon = document.createElement('span');
    icon.className = failed ? 'gift-row-icon' : 'gift-prize-emoji';
    icon.style.cssText = failed
        ? 'font-size:1.6rem;line-height:1;flex-shrink:0;'
        : 'font-size:2rem;line-height:1;flex-shrink:0;animation:giftReveal 0.35s ease-out;';
    icon.textContent = failed ? '⚠️' : _rewardEmoji(rw);
    var label = document.createElement('div');
    label.className = 'gift-prize-label';
    label.style.cssText = 'flex:1;min-width:120px;font-size:0.95rem;font-weight:800;color:var(--text,#e2e8f0);line-height:1.3;';
    label.setAttribute('aria-live', 'polite');
    label.setAttribute('aria-atomic', 'true');
    row.appendChild(icon);
    row.appendChild(label);
    label.textContent = failed ? 'Could not open — try again' : _rewardLabel(rw);
    row.style.borderColor = failed ? 'rgba(239,68,68,0.45)' : 'rgba(52,211,153,0.45)';
    row.style.background = failed ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.1)';
    row.setAttribute('data-gift-state', failed ? 'failed' : 'opened');
    if (!failed) {
        var ok = document.createElement('span');
        ok.textContent = '✓';
        ok.style.cssText = 'color:#34d399;font-weight:800;font-size:1.1rem;flex-shrink:0;';
        row.appendChild(ok);
    }
}

function _markGiftAlreadyOpened(giftId) {
    var row = document.getElementById('giftRow_' + giftId);
    if (!row) return;
    _emptyEl(row);
    row.style.opacity = '';
    var icon = document.createElement('span');
    icon.className = 'gift-row-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.style.cssText = 'font-size:1.6rem;line-height:1;flex-shrink:0;';
    icon.textContent = '🎁';
    var label = document.createElement('div');
    label.className = 'gift-prize-label';
    label.style.cssText = 'flex:1;min-width:120px;font-size:0.95rem;font-weight:800;color:var(--text-muted,#94a3b8);line-height:1.3;';
    label.setAttribute('aria-live', 'polite');
    label.setAttribute('aria-atomic', 'true');
    row.appendChild(icon);
    row.appendChild(label);
    label.textContent = 'Already opened';
    row.style.borderColor = 'rgba(148,163,184,0.45)';
    row.style.background = 'rgba(148,163,184,0.1)';
    row.setAttribute('data-gift-state', 'already');
}

async function _openGiftRequest(giftId) {
    var res = await _callCF('openGift', { giftId: giftId });
    var rw = (res.data && res.data.reward) ? res.data.reward : { rewardType: 'tickets', ticketCount: 1 };
    window._openedGiftRewards.push(rw);
    return rw;
}

window.openSingleGift = function(giftId) {
    return _enqueueGiftOpen(giftId);
};

window.openAllPostSpinGifts = async function() {
    if (_openAllBusy) return;
    _openAllBusy = true;
    _unlockAudio();
    var openAll = document.getElementById('openAllGiftsBtn');
    if (openAll) _paintOpeningButton(openAll);
    var gifts = window._postSpinGifts || [];
    var tasks = [];
    var ids = [];
    try {
        for (var i = 0; i < gifts.length; i++) {
            var id = gifts[i] && gifts[i].id;
            if (!id || _giftSettled[id] === 'ok') continue;
            ids.push(id);
            tasks.push(_enqueueGiftOpen(id, { silent: true }));
        }
        await Promise.all(tasks);
        var summary = _summarize(window._openedGiftRewards || []);
        if (summary) _toast('🎁 Opened! ' + summary, 4500);
        if (ids.length) _confetti();
        if (openAll) {
            var anyFailed = false;
            for (var fi = 0; fi < ids.length; fi++) {
                if (_giftSettled[ids[fi]] !== 'ok') anyFailed = true;
            }
            if (!anyFailed) {
                _syncOpenAllButton();
            } else {
                openAll.disabled = false;
                openAll.removeAttribute('aria-busy');
                openAll.textContent = 'Open all';
                openAll.style.background = 'linear-gradient(135deg,#f7931a,#ea580c)';
            }
        }
        _refreshHoldingsInBackground();
    } finally {
        _openAllBusy = false;
    }
};

function _summarize(list) {
    var tickets = 0, xp = 0, keys = 0, ciphers = 0, shields = 0, sats = 0, converted = 0;
    list.forEach(function(rw) {
        if (rw.rewardType === 'tickets') tickets += rw.ticketCount || 1;
        if (rw.rewardType === 'xp_bonus' || rw.rewardType === 'xp_tickets') xp += rw.xpAmount || 0;
        if (rw.rewardType === 'xp_tickets') tickets += rw.ticketCount || 0;
        if (rw.rewardType === 'keys') keys += (rw.keyLabels || []).length;
        if (rw.rewardType === 'locked_ciphers') ciphers += (rw.cipherLabels || []).length;
        if (rw.rewardType === 'streak_shield') shields++;
        if (rw.rewardType === 'sats') sats += rw.satsAmount || 0;
        if (rw.shoutoutConverted) converted++;
    });
    var parts = [];
    if (tickets) parts.push('+' + tickets + ' tickets');
    if (xp) parts.push('+' + xp + ' XP');
    if (converted) parts.push(SHOUTOUT_WEEK_MSG);
    if (keys) parts.push(keys + ' key' + (keys > 1 ? 's' : ''));
    if (ciphers) parts.push(ciphers + ' cipher' + (ciphers > 1 ? 's' : ''));
    if (shields) parts.push(shields + ' shield' + (shields > 1 ? 's' : ''));
    if (sats) parts.push(sats + ' sats');
    return parts.join(' · ');
}

function _noteSpent(keyId, cipherId) {
    if (keyId) _spentKeys[keyId] = true;
    if (cipherId) _spentCiphers[cipherId] = true;
}

function _dropMatchBanner(label) {
    var nodes = document.querySelectorAll('[data-match-label]');
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].getAttribute('data-match-label') === label) nodes[i].remove();
    }
}

function _setCipherButtonsDisabled(disabled) {
    var btns = document.querySelectorAll('.cipher-open-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].disabled = !!disabled;
        btns[i].style.opacity = disabled ? '0.55' : '';
    }
}

async function _refreshHoldingsViews() {
    var host = document.getElementById('nookKeysCiphers');
    if (host && typeof window.renderKeysAndCiphersPanel === 'function') {
        _forceServerHoldings = true;
        await window.renderKeysAndCiphersPanel(host);
    }
    var box = document.getElementById('giftFollowUp');
    if (box) {
        _forceServerHoldings = true;
        await _showGiftFollowUp();
    }
    if (typeof window.refreshGiftBadges === 'function') await window.refreshGiftBadges();
}

async function _showGiftFollowUp() {
    var box = document.getElementById('giftFollowUp');
    if (!box) return;
    var rewards = window._openedGiftRewards || [];
    var keyIds = [];
    rewards.forEach(function(rw) {
        (rw.keyIds || []).forEach(function(id) {
            if (!_spentKeys[id]) keyIds.push(id);
        });
    });
    _emptyEl(box);
    if (keyIds.length) {
        var note = document.createElement('div');
        note.style.cssText = 'font-size:0.8rem;color:var(--text);margin-bottom:4px;';
        note.textContent = 'Send to a peer';
        var explain = document.createElement('div');
        explain.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;';
        explain.textContent = 'You got ' + keyIds.length + ' spare key' + (keyIds.length > 1 ? 's' : '') + '. Send up to 3 to one peer today. If a peer opens a cipher with your key, you both win the same prize. Or keep one to open a matching cipher.';
        var send = _btn('Send keys to a peer');
        send.style.width = '100%';
        send.style.marginBottom = '8px';
        var ids = keyIds.slice(0, 3);
        send.onclick = function() { window.showPeerPickerForKeys(ids); };
        box.appendChild(note);
        box.appendChild(explain);
        box.appendChild(send);
    }
    try {
        var matches = await _matchingLabels();
        var satsOff = matches.length ? await _readSatsDisabled() : false;
        if (satsOff) _satsOffNote(box);
        if (!satsOff) matches.forEach(function(m) {
            var banner = document.createElement('div');
            banner.setAttribute('data-match-label', m.label);
            banner.style.cssText = 'margin-top:8px;padding:10px;border-radius:10px;background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.35);text-align:left;';
            var t = document.createElement('div');
            t.style.cssText = 'font-weight:800;color:#34d399;font-size:0.85rem;margin-bottom:2px;';
            t.textContent = 'You have the ' + m.label + ' key! Open ' + m.label + ' cipher';
            var explain = document.createElement('div');
            explain.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;';
            explain.textContent = 'A matching key opens this cipher. Opening uses up the key and the cipher.';
            var b = _btn('Open ' + m.label, 'linear-gradient(135deg,#34d399,#10b981)');
            b.className = 'cipher-open-btn';
            b.style.width = '100%';
            b.disabled = _cipherBusy;
            b.onclick = function() { window.openCipherWithMatch(m.cipherId, m.label); };
            banner.appendChild(t);
            banner.appendChild(explain);
            banner.appendChild(b);
            box.appendChild(banner);
        });
    } catch (e) { /* inventory read can fail before rules deploy */ }
}

async function _matchingLabels() {
    var data = await _loadHoldings();
    var keyLabels = {};
    data.ownKeys.concat(data.peerKeys).forEach(function(k) { keyLabels[k.label] = true; });
    var seen = {};
    var out = [];
    data.ciphers.forEach(function(c) {
        if (keyLabels[c.label] && !seen[c.label]) {
            seen[c.label] = true;
            out.push({ label: c.label, cipherId: c.id });
        }
    });
    return out;
}

// ─── Holdings ────────────────────────────────────────────────────────────────

function _qget(q, server) {
    if (!server) return q.get();
    return q.get({ source: 'server' }).catch(function() { return q.get(); });
}

async function _loadHoldings() {
    var empty = { ownKeys: [], peerKeys: [], ciphers: [] };
    if (!_isSignedIn() || typeof db === 'undefined') return empty;
    var uid = _getUid();
    var server = _forceServerHoldings;
    _forceServerHoldings = false;
    try {
        var snaps = await Promise.all([
            _qget(db.collection('keys').where('ownerId', '==', uid).where('status', '==', 'inventory').limit(100), server),
            _qget(db.collection('keys').where('ownerId', '==', uid).where('status', '==', 'sent').limit(100), server),
            _qget(db.collection('locked_ciphers').where('ownerId', '==', uid).where('status', '==', 'inventory').limit(200), server),
        ]);
        function map(snap) { return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); }); }
        return {
            ownKeys: map(snaps[0]).filter(function(k) { return !_spentKeys[k.id]; }),
            peerKeys: map(snaps[1]).filter(function(k) { return !_spentKeys[k.id]; }),
            ciphers: map(snaps[2]).filter(function(c) { return !_spentCiphers[c.id]; }),
        };
    } catch (e) {
        console.warn('[gifting] holdings:', e.message);
        return empty;
    }
}

window.refreshGiftBadges = async function() {
    var el = document.getElementById('peersGiftsBadge');
    if (!_isSignedIn() || typeof db === 'undefined') return;
    var uid = _getUid();
    try {
        _forceServerHoldings = true;
        var holdings = await _loadHoldings();
        var giftSnap = await _qget(db.collection('gifts').where('ownerId', '==', uid).where('status', 'in', ['unopened', 'inventory', 'sent']).limit(40), true);
        if (!el) return;
        var parts = [];
        if (giftSnap.size > 0) parts.push('🎁 ' + giftSnap.size);
        var keyCount = holdings.ownKeys.length + holdings.peerKeys.length;
        if (keyCount > 0) parts.push('🔑 ' + keyCount);
        if (holdings.ciphers.length > 0) parts.push('🔒 ' + holdings.ciphers.length);
        if (!parts.length) { el.innerHTML = ''; return; }
        el.innerHTML = ' <span style="display:inline-block;background:rgba(247,147,26,0.15);border:1px solid rgba(247,147,26,0.35);border-radius:10px;padding:1px 7px;font-size:0.72rem;color:#f7931a;font-weight:800;">' + parts.join(' · ') + '</span>';
    } catch (e) { /* badge is decorative */ }
};

window.loadKeyInventory = async function() {
    var h = await _loadHoldings();
    return { inventory: h.ownKeys, received: h.peerKeys };
};

window.loadCipherInventory = async function() {
    var h = await _loadHoldings();
    return { ciphers: h.ciphers };
};

function _group(list) {
    var g = {};
    list.forEach(function(item) {
        var label = item.label || '?';
        if (!g[label]) g[label] = [];
        g[label].push(item);
    });
    return g;
}

// Same label and same sender share one row. A missing sender is a self-earned stack.
function _senderBucket(item) {
    if (!item) return '';
    if (item.sentBy) return String(item.sentBy);
    if (item.sentByName) return 'name:' + String(item.sentByName);
    if (item.status === 'sent') return 'peer';
    return '';
}

function _stacks(list) {
    var map = Object.create(null);
    var out = [];
    (list || []).forEach(function(item) {
        var label = item.label || '?';
        var bucket = _senderBucket(item);
        var key = label + '\n' + bucket;
        var stack = map[key];
        if (!stack) {
            stack = {
                label: label,
                sender: bucket ? String(item.sentByName || 'a peer') : '',
                items: [],
            };
            map[key] = stack;
            out.push(stack);
        }
        stack.items.push(item);
    });
    out.sort(function(a, b) {
        if (a.label !== b.label) return a.label < b.label ? -1 : 1;
        if (a.sender !== b.sender) return a.sender < b.sender ? -1 : 1;
        return 0;
    });
    return out;
}

function _times(count) {
    return count > 1 ? ' ×' + count : '';
}

function _stackPhrase(label, count, sender) {
    var text = String(label || '?') + _times(count);
    if (sender) text += ' from ' + sender;
    return text;
}

function _card(el) {
    var d = document.createElement('div');
    d.className = 'kc-card';
    d.style.marginBottom = '8px';
    el.appendChild(d);
    return d;
}

function cipherSatsBalanceValue() {
    var n = 0;
    if (typeof currentUser !== 'undefined' && currentUser) n = Math.floor(Number(currentUser.cipherSatsBalance) || 0);
    return n > 0 ? n : 0;
}

function mountCipherSatsBalance(parent, opts) {
    if (!parent) return null;
    var options = opts || {};
    var bal = typeof options.balance === 'number' ? options.balance : cipherSatsBalanceValue();
    if (bal < 0) bal = 0;
    var box = document.createElement('div');
    box.className = 'cipher-sats-balance';
    box.id = options.id || 'cipherSatsBalance';
    box.setAttribute('data-surface', options.surface || 'ciphers');
    box.style.cssText = 'margin:0 0 12px;padding:12px;border-radius:12px;border:1px solid rgba(247,147,26,0.45);background:rgba(247,147,26,0.08);text-align:center;';
    var label = document.createElement('div');
    label.style.cssText = 'font-size:0.68rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-muted);font-weight:800;';
    label.textContent = 'Cipher sats balance';
    var num = document.createElement('div');
    num.className = 'cipher-sats-balance-amount';
    num.style.cssText = 'font-size:1.35rem;font-weight:900;color:#f7931a;margin:4px 0;';
    num.textContent = bal.toLocaleString() + ' sats';
    var note = document.createElement('div');
    note.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;';
    note.textContent = 'Small sats wins from locked ciphers land here.';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cipher-sats-claim-btn';
    btn.textContent = 'Claim ' + Math.min(bal, 200).toLocaleString() + ' sats';
    var ready = bal >= 100 && !options.disabled;
    btn.disabled = !ready;
    btn.style.cssText = 'min-height:44px;padding:10px 14px;border:none;border-radius:10px;font-weight:800;font-family:inherit;width:100%;' + (ready ? 'background:#f7931a;color:#fff;cursor:pointer;' : 'background:var(--card-bg,#222);color:var(--text-muted);cursor:default;opacity:0.65;');
    btn.onclick = function() {
        if (!ready || typeof window.claimCipherSats !== 'function') return;
        window.claimCipherSats();
    };
    box.appendChild(label);
    box.appendChild(num);
    box.appendChild(note);
    box.appendChild(btn);
    parent.appendChild(box);
    return box;
}
window.mountCipherSatsBalance = mountCipherSatsBalance;

function _lockedCipherNote(parent, label) {
    var note = document.createElement('div');
    note.className = 'locked-cipher-note';
    note.style.cssText = 'margin:0 0 10px;padding:10px 12px;border-radius:12px;border:1px solid rgba(124,58,237,0.45);background:var(--bg-side);';
    var text = document.createElement('div');
    text.style.cssText = 'font-size:0.8rem;color:var(--text);line-height:1.45;';
    var which = label ? ('a ' + label + ' key') : 'a key with the same label, such as 3A';
    text.textContent = '🔒 Locked cipher: you need ' + which + ' to open it. Keys come from daily wheel gifts. Ask a peer to send you a matching key. Ask in Chat whether anyone has the key.';
    var chat = document.createElement('button');
    chat.type = 'button';
    chat.textContent = 'Open Global Chat';
    chat.style.cssText = 'margin-top:8px;min-height:40px;padding:8px 12px;background:transparent;border:1px solid var(--link);border-radius:8px;color:var(--link);font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;';
    chat.onclick = function() {
        if (typeof window.openGlobalChatForCipher === 'function') window.openGlobalChatForCipher();
    };
    note.appendChild(text);
    note.appendChild(chat);
    parent.appendChild(note);
    return note;
}

function _restorePanelZ(id) {
    var panel = document.getElementById(id);
    if (!panel || !panel.style) return;
    // Chat's default z-index lives on the element. Leaderboard's default lives in CSS.
    panel.style.zIndex = id === 'chatOverlay' ? '250000' : '';
}

function _closeCoversForPeople() {
    var settings = document.getElementById('usernameModal');
    if (settings && settings.classList.contains('open')) settings.classList.remove('open');
    if (typeof window._closeQuestScreen === 'function') window._closeQuestScreen();
    else {
        var hub = document.getElementById('questHubOverlay');
        if (hub && hub.parentNode) hub.parentNode.removeChild(hub);
    }
}

function _liftProfileAbovePanels() {
    function lift() {
        var modal = document.getElementById('userProfileModal');
        if (modal) modal.style.zIndex = '530000';
    }
    lift();
    setTimeout(lift, 40);
    setTimeout(lift, 400);
}

function _installPeopleStacking() {
    if (typeof window.showUserProfile === 'function' && !window.showUserProfile._liftsAbovePanels) {
        var origProfile = window.showUserProfile;
        var wrappedProfile = function() {
            var result = origProfile.apply(this, arguments);
            _liftProfileAbovePanels();
            return result;
        };
        wrappedProfile._liftsAbovePanels = true;
        window.showUserProfile = wrappedProfile;
    }
    if (typeof window.toggleChatOverlay === 'function' && !window.toggleChatOverlay._resetsPanelZ) {
        var origChat = window.toggleChatOverlay;
        var wrappedChat = function() {
            var wasOpen = !!window._chatOverlayOpen;
            var result = origChat.apply(this, arguments);
            if (wasOpen) _restorePanelZ('chatOverlay');
            return result;
        };
        wrappedChat._resetsPanelZ = true;
        window.toggleChatOverlay = wrappedChat;
    }
    if (typeof window.toggleLeaderboard === 'function' && !window.toggleLeaderboard._resetsPanelZ) {
        var origLb = window.toggleLeaderboard;
        var wrappedLb = function() {
            var panel = document.getElementById('leaderboard');
            var wasOpen = !!(panel && panel.classList.contains('open') && !panel.classList.contains('minimized'));
            var result = origLb.apply(this, arguments);
            if (wasOpen) _restorePanelZ('leaderboard');
            return result;
        };
        wrappedLb._resetsPanelZ = true;
        window.toggleLeaderboard = wrappedLb;
    }
}

function _openChatForKeys() {
    _installPeopleStacking();
    _closeCoversForPeople();
    _restorePanelZ('chatOverlay');
    if (typeof toggleChatOverlay === 'function') {
        if (!window._chatOverlayOpen) toggleChatOverlay();
        _restorePanelZ('chatOverlay');
        return;
    }
    if (typeof window.openGlobalChatForCipher === 'function') {
        window.openGlobalChatForCipher();
        _restorePanelZ('chatOverlay');
        setTimeout(function() { _restorePanelZ('chatOverlay'); }, 0);
        setTimeout(function() { _restorePanelZ('chatOverlay'); }, 350);
    }
}

function _openLeaderboardForKeys() {
    _installPeopleStacking();
    _closeCoversForPeople();
    if (typeof toggleLeaderboard === 'function') {
        var panel = document.getElementById('leaderboard');
        var showing = panel && panel.classList.contains('open') && !panel.classList.contains('minimized');
        if (!showing) toggleLeaderboard();
    }
    _restorePanelZ('leaderboard');
}

function _peopleLink(label, opener) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kc-help-link';
    btn.textContent = label;
    btn.onclick = opener;
    return btn;
}

function _keySendExplainer() {
    var details = document.createElement('details');
    details.className = 'kc-key-help';
    details.id = 'keySendHelp';
    var summary = document.createElement('summary');
    summary.textContent = 'How does sending keys work?';
    details.appendChild(summary);
    var list = document.createElement('ol');
    function addText(text) {
        var li = document.createElement('li');
        li.textContent = text;
        list.appendChild(li);
    }
    addText('Keys come from daily wheel gifts.');
    addText('You can only send keys to peers. The server turns down a send to anyone who is not already your peer.');
    var where = document.createElement('li');
    var whereText = document.createElement('div');
    whereText.textContent = 'Open Global Chat or the leaderboard and tap a name. Their profile card has an Add Peer button, and that button sends the peer request. Settings → Account → Peers lists the requests you already have, and you can accept them there.';
    var actions = document.createElement('div');
    actions.className = 'kc-help-actions';
    actions.appendChild(_peopleLink('Open Global Chat', _openChatForKeys));
    actions.appendChild(_peopleLink('Open Leaderboard', _openLeaderboardForKeys));
    where.appendChild(whereText);
    where.appendChild(actions);
    list.appendChild(where);
    addText('Once they accept, Send keys can deliver keys to them.');
    addText('If that peer opens a cipher with your key, you both win the same prize when both accounts are eligible. Each send is 1 to 3 keys, once per peer per day. The server stores that send on the UTC date and blocks another send until 5:00 UTC on the next UTC date.');
    details.appendChild(list);
    return details;
}

async function _readPeerCount() {
    if (window._myPeers && typeof window._myPeers.size === 'number') return window._myPeers.size;
    if (typeof currentUser !== 'undefined' && currentUser && Array.isArray(currentUser.peers)) return currentUser.peers.length;
    try {
        if (_isSignedIn() && typeof db !== 'undefined' && db) {
            var snap = await db.collection('users').doc(_getUid()).get();
            if (snap.exists) {
                var peers = snap.data().peers;
                var list = Array.isArray(peers) ? peers : [];
                window._myPeers = new Set(list);
                return list.length;
            }
        }
    } catch (e) { /* hint is display-only; the server still checks peers */ }
    return null;
}

function _copy(parent, title, explain) {
    var mid = document.createElement('div');
    mid.className = 'kc-copy';
    mid.style.cssText = 'flex:1;min-width:0;';
    var t = document.createElement('div');
    t.className = 'kc-copy-title';
    t.style.cssText = 'font-weight:800;font-size:0.88rem;color:var(--heading,#fff);overflow-wrap:anywhere;word-break:break-word;';
    t.textContent = title;
    var s = document.createElement('div');
    s.className = 'kc-copy-note';
    s.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-top:2px;line-height:1.35;overflow-wrap:anywhere;word-break:break-word;';
    s.textContent = explain;
    mid.appendChild(t);
    mid.appendChild(s);
    parent.appendChild(mid);
    return mid;
}

window.renderKeysAndCiphersPanel = async function(container) {
    var el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    _injectGiftingCSS();
    el.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:0.8rem;">Loading keys and ciphers…</div>';
    if (!_isSignedIn()) {
        el.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:0.8rem;">Sign in to see keys and locked ciphers.</div>';
        return;
    }
    var loaded = await Promise.all([_loadHoldings(), _readSatsDisabled(), _readPeerCount()]);
    var data = loaded[0];
    var satsOff = loaded[1];
    var peerCount = loaded[2];
    el.innerHTML = '';
    if (satsOff) _satsOffNote(el);

    var introRow = document.createElement('div');
    introRow.className = 'kc-intro';
    var intro = document.createElement('p');
    intro.style.cssText = 'font-size:0.78rem;color:var(--text-muted);line-height:1.4;';
    intro.textContent = 'A key and a cipher with the same label, like F6, are a pair. Open the pair, or send a spare key to a peer. If an accepted peer opens a matching cipher with a key you sent, you both get the same prize and you see a reveal of what you won. That counts as one of your 21 cipher opens that day, pays once per cipher, and includes sats only when both accounts are eligible. Smaller sats wins are added to your cipher sats balance.';
    introRow.appendChild(intro);
    introRow.appendChild(_soundButton('nookSoundToggle'));
    el.appendChild(introRow);
    if (!document.getElementById('cipherSatsBalanceInventory')) {
        mountCipherSatsBalance(el, { id: 'cipherSatsBalanceCiphers', surface: 'ciphers', disabled: !!satsOff });
    }

    var heading = document.createElement('div');
    heading.className = 'kc-accent';
    heading.style.cssText = 'font-size:0.72rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;margin:4px 0 8px;';
    heading.textContent = 'Locked ciphers';
    el.appendChild(heading);

    var cipherGroups = _group(data.ciphers);
    var ownGroups = _group(data.ownKeys);
    var peerGroups = _group(data.peerKeys);
    var labels = Object.keys(cipherGroups).sort();
    if (labels.length) _lockedCipherNote(el);

    if (!labels.length) {
        var empty = document.createElement('div');
        empty.style.cssText = 'padding:12px;border:1px dashed var(--border,#333);border-radius:12px;color:var(--text-muted);font-size:0.8rem;margin-bottom:12px;';
        empty.textContent = 'No locked ciphers yet. Spin the daily wheel and open your gifts — some gifts contain ciphers.';
        el.appendChild(empty);
    }

    labels.forEach(function(label) {
        var group = cipherGroups[label];
        var peerKey = (peerGroups[label] || [])[0] || null;
        var ownKey = (ownGroups[label] || [])[0] || null;
        var match = peerKey || ownKey;
        var card = _card(el);
        card.style.marginBottom = '8px';
        card.style.borderColor = match ? 'rgba(52,211,153,0.45)' : 'var(--border,#333)';
        var icon = document.createElement('div');
        icon.style.cssText = 'text-align:center;flex:0 0 auto;min-width:0;';
        var emoji = document.createElement('div');
        emoji.style.fontSize = '1.4rem';
        emoji.textContent = match ? '🔓' : '🔒';
        var mark = document.createElement('div');
        mark.className = (match ? 'kc-match' : 'kc-locked') + ' kc-stack-label';
        mark.style.fontSize = '0.95rem';
        mark.textContent = label + _times(group.length);
        icon.appendChild(emoji);
        icon.appendChild(mark);
        card.appendChild(icon);
        var countBit = group.length > 1 ? ' You have ' + group.length + '.' : '';
        if (match) {
            var fromWhom = peerKey ? (' This one came from ' + (peerKey.sentByName || 'a peer') + '.') : ' This one is yours.';
            var shareBit = peerKey ? ' If a peer sent this key, you both win the same prize.' : '';
            _copy(card,
                'You have the ' + label + ' key! Open ' + label + ' cipher',
                'A matching key opens this cipher. Opening uses up the key and the cipher.' + fromWhom + shareBit + countBit);
        } else {
            _copy(card,
                '🔒 Locked cipher ' + label,
                'You need a ' + label + ' key to open it. Keys come from daily wheel gifts. Ask a peer to send you that key. Ask in Chat whether anyone has the key.' + countBit);
            var chat = document.createElement('button');
            chat.type = 'button';
            chat.className = 'cipher-open-btn';
            chat.textContent = 'Open Global Chat';
            chat.style.cssText = 'padding:8px 12px;border-radius:8px;border:1px solid var(--link);background:transparent;color:var(--link);font-weight:800;';
            chat.onclick = function() {
                if (typeof window.openGlobalChatForCipher === 'function') window.openGlobalChatForCipher();
            };
            card.appendChild(chat);
        }
        if (match && !satsOff) {
            var open = _btn('Open cipher', 'linear-gradient(135deg,#34d399,#10b981)');
            open.className = 'cipher-open-btn';
            open.disabled = _cipherBusy;
            if (_cipherBusy) open.style.opacity = '0.55';
            open.onclick = function() { window.openCipherWithMatch(group[0].id, label); };
            card.appendChild(open);
        }
    });

    var keyHead = document.createElement('div');
    keyHead.className = 'kc-key-head';
    var keyTitle = document.createElement('div');
    keyTitle.className = 'kc-accent kc-key-title';
    keyTitle.textContent = 'Your keys — send to peers';
    var keyNote = document.createElement('div');
    keyNote.className = 'kc-key-note';
    keyNote.textContent = '(You need to send Peer Requests first)!';
    keyHead.appendChild(keyTitle);
    keyHead.appendChild(keyNote);
    el.appendChild(keyHead);
    el.appendChild(_keySendExplainer());

    var ownStacks = _stacks(data.ownKeys);
    if (!ownStacks.length) {
        var noKeys = document.createElement('div');
        noKeys.style.cssText = 'padding:12px;border:1px dashed var(--border,#333);border-radius:12px;color:var(--text-muted);font-size:0.8rem;margin-bottom:8px;';
        noKeys.textContent = 'No keys waiting to send. Open gifts from the daily wheel to earn some.';
        el.appendChild(noKeys);
    }
    ownStacks.forEach(function(stack) {
        var label = stack.label;
        var group = stack.items;
        var card = _card(el);
        var lab = document.createElement('div');
        lab.className = 'kc-accent kc-stack-label';
        lab.style.cssText = 'font-size:1.05rem;min-width:0;flex:0 1 auto;';
        lab.textContent = '🔑 ' + _stackPhrase(label, group.length, stack.sender);
        card.appendChild(lab);
        _copy(card,
            'Send to a peer',
            'If a peer opens a cipher with your key, you both win the same prize. One send of up to 3 keys per peer each day. You have ' + group.length + '.');
        var send = _btn('Send keys');
        send.className = 'key-send-btn';
        var ids = group.slice(0, 3).map(function(k) { return k.id; });
        send.onclick = function() { window.showPeerPickerForKeys(ids); };
        var sendWrap = document.createElement('div');
        sendWrap.className = 'kc-send-wrap';
        sendWrap.appendChild(send);
        if (peerCount === 0) {
            var noPeer = document.createElement('p');
            noPeer.className = 'kc-send-hint';
            noPeer.id = 'keySendPeerHint-' + String(label).replace(/[^A-Za-z0-9_-]/g, '');
            noPeer.textContent = 'No peers yet. Open "How does sending keys work?" above.';
            send.setAttribute('aria-describedby', noPeer.id);
            sendWrap.appendChild(noPeer);
        }
        card.appendChild(sendWrap);
    });
    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:0.72rem;color:var(--text-dim);margin:2px 0 8px;';
    hint.textContent = 'Spare keys are for peers, or for a cipher with the same label.';
    el.appendChild(hint);

    var recvHead = document.createElement('div');
    recvHead.className = 'kc-locked';
    recvHead.style.cssText = 'font-size:0.72rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;margin:12px 0 8px;';
    recvHead.textContent = 'Keys from peers';
    el.appendChild(recvHead);
    if (!data.peerKeys.length) {
        var noRecv = document.createElement('div');
        noRecv.style.cssText = 'font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;';
        noRecv.textContent = 'When a peer sends you a key, it shows up here.';
        el.appendChild(noRecv);
    }
    _stacks(data.peerKeys).forEach(function(stack) {
        var card = _card(el);
        var lab = document.createElement('div');
        lab.className = 'kc-locked';
        lab.style.cssText = 'font-size:1.15rem;flex:0 0 auto;';
        lab.setAttribute('aria-hidden', 'true');
        lab.textContent = '🔑';
        card.appendChild(lab);
        var phrase = _stackPhrase(stack.label, stack.items.length, stack.sender || 'a peer');
        var hasCipher = (cipherGroups[stack.label] || []).length > 0;
        _copy(card,
            phrase,
            hasCipher
                ? 'You have the ' + stack.label + ' key! Open the ' + stack.label + ' cipher above.'
                : 'Hold this until you get a ' + stack.label + ' cipher from a gift.');
        if (!satsOff && hasCipher) {
            var open = _btn('Open ' + stack.label, 'linear-gradient(135deg,#34d399,#10b981)');
            open.className = 'cipher-open-btn';
            open.disabled = _cipherBusy;
            if (_cipherBusy) open.style.opacity = '0.55';
            open.onclick = function() {
                var cipher = (cipherGroups[stack.label] || [])[0];
                if (!cipher) return;
                window.openCipherWithMatch(cipher.id, stack.label);
            };
            card.appendChild(open);
        }
    });

    var winsHost = document.createElement('div');
    winsHost.id = 'nookCipherWins';
    winsHost.style.marginTop = '12px';
    el.appendChild(winsHost);
    _renderMyWins(winsHost);

    var cap = document.createElement('div');
    cap.style.cssText = 'font-size:0.72rem;color:var(--text-dim);text-align:center;margin-top:8px;';
    cap.textContent = 'You can open up to ' + CIPHER_OPENS_PER_DAY + ' ciphers per day.';
    el.appendChild(cap);
};

window.renderKeysTab = function(containerId) { return window.renderKeysAndCiphersPanel(containerId); };
window.renderCiphersTab = window.renderKeysTab;

async function _renderMyWins(el) {
    try {
        var res = await _callCF('listMyCipherWins', {});
        var wins = (res.data && res.data.wins) || [];
        var open = wins.filter(function(w) { return w.status === 'claimable' || w.status === 'pending' || w.status === 'paying' || w.status === 'unknown'; });
        if (!open.length) { el.innerHTML = ''; return; }
        el.innerHTML = '';
        var h = document.createElement('div');
        h.style.cssText = 'font-size:0.72rem;font-weight:800;color:#f7931a;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;';
        h.textContent = 'Sats from ciphers';
        el.appendChild(h);
        open.forEach(function(w) {
            var card = _card(el);
            card.style.marginBottom = '8px';
            var mid = document.createElement('div');
            mid.style.flex = '1';
            var t = document.createElement('div');
            t.style.cssText = 'font-weight:800;font-size:0.88rem;';
            t.textContent = (w.amount || 0).toLocaleString() + ' sats';
            var s = document.createElement('div');
            s.style.cssText = 'font-size:0.72rem;color:var(--text-muted);';
            if (w.status === 'claimable') s.textContent = 'Cipher ' + (w.cipherLabel || '') + ' — ready to claim';
            else if (w.status === 'paying') s.textContent = 'Payment in progress';
            else if (w.status === 'unknown') s.textContent = 'Payment needs confirmation. Don\'t claim again — Phil will sort it out.';
            else s.textContent = 'Cipher ' + (w.cipherLabel || '') + ' — Phil pays prizes of 1,000 sats and up';
            mid.appendChild(t);
            mid.appendChild(s);
            card.appendChild(mid);
            if (w.status === 'claimable' && window._satsDisabled !== true) {
                var b = _btn('Claim');
                b.onclick = function() { window.showCipherClaim(w); };
                card.appendChild(b);
            }
        });
    } catch (e) { el.innerHTML = ''; }
}

// ─── Open a cipher ───────────────────────────────────────────────────────────

async function _findKeyForLabel(label) {
    var uid = _getUid();
    function pick(snap) {
        if (!snap || !snap.docs) return null;
        for (var i = 0; i < snap.docs.length; i++) {
            if (!_spentKeys[snap.docs[i].id]) return Object.assign({ id: snap.docs[i].id }, snap.docs[i].data());
        }
        return null;
    }
    async function query(status) {
        var q = db.collection('keys').where('ownerId', '==', uid).where('status', '==', status).where('label', '==', label).limit(5);
        return pick(await _qget(q, true));
    }
    return (await query('sent')) || (await query('inventory'));
}

window.openCipherWithMatch = function(cipherId, label) {
    window.decryptCipherModal(cipherId, label, null);
};

window.decryptCipherModal = function(cipherId, cipherLabel, knownKey) {
    _unlockAudio();
    if (_cipherBusy) return;
    _cipherBusy = true;
    _setCipherButtonsDisabled(true);
    _decryptCipherModal(cipherId, cipherLabel, knownKey).then(function() {
        _cipherBusy = false;
        _setCipherButtonsDisabled(false);
    }, function() {
        _cipherBusy = false;
        _setCipherButtonsDisabled(false);
    });
};

async function _decryptCipherModal(cipherId, cipherLabel, knownKey) {
    var returnFocus = document.activeElement || null;
    if (!_isSignedIn()) { _toast('Sign in to open a cipher'); return; }
    if (await _readSatsDisabled()) { _toast(SATS_OFF_MSG); return; }
    _injectGiftingCSS();
    var key = (knownKey && !_spentKeys[knownKey.id]) ? knownKey : null;
    if (!key) {
        try { key = await _findKeyForLabel(cipherLabel); } catch (e) { key = null; }
    }
    if (!key) { _toast('No matching ' + cipherLabel + ' key'); return; }

    var old = document.getElementById('decryptCipherOverlay');
    if (old) _dismissGiftingChild(old);
    var overlay = document.createElement('div');
    overlay.id = 'decryptCipherOverlay';
    overlay.className = 'gifting-overlay';
    var modal = document.createElement('div');
    modal.className = 'gifting-modal';
    var own = key.status === 'inventory';
    modal.innerHTML =
        '<div id="dcLabel" style="font-family:monospace;font-size:2.4rem;font-weight:900;color:#a78bfa;letter-spacing:3px;">🔒 ' + _esc(cipherLabel) + '</div>' +
        '<div id="dcUsing" style="color:var(--text-muted);font-size:0.78rem;margin:6px 0 12px;"></div>' +
        '<div id="dcHex" style="font-family:monospace;font-size:0.7rem;color:#f7931a;word-break:break-all;min-height:48px;margin-bottom:12px;padding:10px;background:rgba(247,147,26,0.05);border-radius:8px;"></div>' +
        '<div id="dcStatus" style="color:var(--text-muted);font-size:0.85rem;font-weight:600;">Checking the key…</div>' +
        '<div id="dcResult" style="display:none;"></div>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    var usingEl = document.getElementById('dcUsing');
    if (usingEl) {
        usingEl.textContent = own
            ? ('Using your own ' + cipherLabel + ' key')
            : ('Using the ' + cipherLabel + ' key from ' + (key.sentByName || 'a peer'));
    }
    _mountGiftingChild(overlay, returnFocus);

    var hexEl = document.getElementById('dcHex');
    var statusEl = document.getElementById('dcStatus');
    _playUnlockSound();
    var anim = _playHex(hexEl, 1200);
    var result, err;
    try { result = await _callCF('decryptCipher', { cipherId: cipherId, keyId: key.id }); }
    catch (e) { err = e.message || 'Could not open the cipher'; }
    await anim;

    // Clean up local state first, so stale cards and Open buttons go away
    // even when the user closed the overlay mid-animation.
    var staleErr = !!err && /already (opened|used|sent)|not found/i.test(String(err));
    if (!err) {
        _noteSpent(key.id, cipherId);
        _dropMatchBanner(cipherLabel);
        (window._openedGiftRewards || []).forEach(function(rwGift) {
            if (!rwGift.keyIds) return;
            rwGift.keyIds = rwGift.keyIds.filter(function(id) { return id !== key.id; });
        });
    } else if (staleErr) {
        if (/cipher/i.test(String(err))) { _noteSpent(null, cipherId); _dropMatchBanner(cipherLabel); }
        if (/key/i.test(String(err))) _noteSpent(key.id, null);
    }
    var refreshPromise = (!err || staleErr) ? _refreshHoldingsViews().catch(function() {}) : null;

    var resultDiv = document.getElementById('dcResult');
    if (!overlay.parentNode) { if (refreshPromise) await refreshPromise; return; }
    if (statusEl) statusEl.textContent = '';
    if (hexEl) hexEl.style.display = 'none';
    if (err) {
        if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '<div style="color:#ef4444;font-weight:700;margin-bottom:12px;">❌ ' + _esc(err) + '</div>';
            var close = _btn('Close', 'transparent');
            close.style.border = '1px solid var(--border,#333)';
            close.style.color = 'var(--text-muted)';
            close.style.width = '100%';
            close.onclick = function() { _dismissGiftingChild(overlay); };
            resultDiv.appendChild(close);
        }
        if (refreshPromise) await refreshPromise;
        return;
    }

    var labelEl = document.getElementById('dcLabel');
    if (labelEl) labelEl.innerHTML = '🔓 <span style="color:#f7931a;animation:decryptPulse 1.2s ease-in-out 2;">' + _esc(cipherLabel) + '</span>';
    var rw = (result && result.data && result.data.reward) ? result.data.reward : { rewardType: 'xp_tickets', xpAmount: 50, ticketCount: 0 };
    if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.style.animation = 'decryptReveal 0.4s ease-out';
        var emoji = document.createElement('div');
        emoji.style.cssText = 'font-size:2.4rem;margin-bottom:6px;';
        emoji.textContent = _rewardEmoji(rw);
        var line = document.createElement('div');
        line.style.cssText = 'color:#f7931a;font-weight:900;font-size:1.2rem;';
        line.textContent = _rewardLabel(rw);
        resultDiv.appendChild(emoji);
        resultDiv.appendChild(line);
        if (rw.cipherSatsBalance != null && typeof currentUser !== 'undefined' && currentUser) {
            currentUser.cipherSatsBalance = Math.max(0, Math.floor(Number(rw.cipherSatsBalance) || 0));
        }
        mountCipherSatsBalance(resultDiv, { id: 'cipherSatsBalanceOpen', surface: 'open' });
        if (rw.opensToday) {
            var used = document.createElement('div');
            used.style.cssText = 'font-size:0.72rem;color:var(--text-faint);margin-top:6px;';
            used.textContent = rw.opensToday + ' / ' + (rw.opensMax || CIPHER_OPENS_PER_DAY) + ' ciphers opened today';
            resultDiv.appendChild(used);
        }
        if (rw.rewardType === 'sats' && rw.satsStatus === 'claimable' && rw.winId) {
            var claim = _btn('Claim ' + (rw.satsAmount || '') + ' sats');
            claim.style.width = '100%';
            claim.style.marginTop = '12px';
            claim.onclick = function() { window.showCipherClaim({ id: rw.winId, amount: rw.satsAmount, cipherLabel: cipherLabel, status: 'claimable' }); };
            resultDiv.appendChild(claim);
        }
        var done = _btn('Nice!');
        done.style.width = '100%';
        done.style.marginTop = '10px';
        done.onclick = function() { _dismissGiftingChild(overlay); };
        resultDiv.appendChild(done);
    }
    _confetti();
    _toast('🔓 Cipher ' + cipherLabel + ' opened! ' + _rewardLabel(rw));
    await refreshPromise;
}

// ─── Claim a small sats win ──────────────────────────────────────────────────

window.showCipherClaim = function(win) {
    var returnFocus = document.activeElement || null;
    if (window._satsDisabled === true || (typeof currentUser !== 'undefined' && currentUser && currentUser.satsDisabled === true)) {
        _toast(SATS_OFF_MSG);
        return;
    }
    _injectGiftingCSS();
    var old = document.getElementById('cipherClaimOverlay');
    if (old) _dismissGiftingChild(old);
    var overlay = document.createElement('div');
    overlay.id = 'cipherClaimOverlay';
    overlay.className = 'gifting-overlay';
    var modal = document.createElement('div');
    modal.className = 'gifting-modal';
    modal.style.textAlign = 'left';
    var title = document.createElement('div');
    title.style.cssText = 'font-weight:900;color:#f7931a;font-size:1.05rem;margin-bottom:6px;text-align:center;';
    title.textContent = 'Claim ' + (win.amount || 0).toLocaleString() + ' sats';
    var help = document.createElement('div');
    help.style.cssText = 'font-size:0.78rem;color:var(--text-muted);margin-bottom:10px;text-align:center;';
    help.textContent = 'Paste a Lightning invoice for exactly this amount, or type a Lightning Address (name@wallet).';
    var input = document.createElement('textarea');
    input.id = 'cipherClaimInput';
    input.rows = 3;
    input.placeholder = 'lnbc… invoice   or   you@walletofsatoshi.com';
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid var(--border,#333);background:var(--input-bg,#111);color:var(--text,#fff);font-family:inherit;font-size:0.85rem;margin-bottom:10px;';
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;';
    var go = _btn('Pay me');
    go.style.flex = '1';
    var cancel = _btn('Cancel', 'transparent');
    cancel.style.border = '1px solid var(--border,#333)';
    cancel.style.color = 'var(--text-muted)';
    cancel.onclick = function() { _dismissGiftingChild(overlay); };
    go.onclick = async function() {
        var raw = (input.value || '').trim();
        if (!raw) { _toast('Paste an invoice or Lightning Address'); return; }
        go.disabled = true;
        go.textContent = 'Paying…';
        var payload = { winId: win.id };
        if (raw.toLowerCase().indexOf('lnbc') === 0) payload.invoice = raw;
        else payload.lightningAddress = raw;
        try {
            var res = await _callCF('claimCipherWin', payload);
            var d = res.data || {};
            if (!d.success) {
                go.disabled = false;
                go.textContent = 'Pay me';
                _toast('❌ ' + (d.error || 'Payment failed'));
                return;
            }
            _dismissGiftingChild(overlay);
            _toast('⚡ ' + (d.amount || win.amount) + ' sats sent!');
            var host = document.getElementById('nookKeysCiphers');
            if (host) window.renderKeysAndCiphersPanel(host);
        } catch (e) {
            go.disabled = false;
            go.textContent = 'Pay me';
            _toast('❌ ' + (e.message || 'Payment failed'));
        }
    };
    row.appendChild(go);
    row.appendChild(cancel);
    modal.appendChild(title);
    modal.appendChild(help);
    modal.appendChild(input);
    modal.appendChild(row);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    _mountGiftingChild(overlay, returnFocus);
    setTimeout(function() { input.focus(); }, 50);
};

// ─── Send keys ───────────────────────────────────────────────────────────────

window.showPeerPickerForKeys = async function(keyIds) {
    var returnFocus = document.activeElement || null;
    if (!_isSignedIn()) { _toast('Sign in to send keys'); return; }
    _injectGiftingCSS();
    var ids = (keyIds || []).slice(0, 3);
    if (!ids.length) { _toast('Pick a key first'); return; }
    var uid = _getUid();
    var peers = [];
    try {
        var doc = await db.collection('users').doc(uid).get();
        var list = (doc.exists && doc.data().peers) || [];
        var profiles = await Promise.all(list.slice(0, 40).map(function(p) {
            return db.collection('public_profiles').doc(p).get().then(function(s) {
                return { uid: p, name: s.exists ? (s.data().username || s.data().displayName || 'Bitcoiner') : 'Bitcoiner' };
            });
        }));
        peers = profiles;
    } catch (e) { peers = []; }

    var old = document.getElementById('peerPickerOverlay');
    if (old) _dismissGiftingChild(old);
    var overlay = document.createElement('div');
    overlay.id = 'peerPickerOverlay';
    overlay.className = 'gifting-overlay';
    overlay.style.alignItems = 'flex-end';
    var sheet = document.createElement('div');
    sheet.style.cssText = 'background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:18px 18px 0 0;padding:18px;width:100%;max-width:480px;max-height:80vh;overflow-y:auto;';
    var h = document.createElement('div');
    h.style.cssText = 'font-weight:800;color:#f7931a;margin-bottom:6px;';
    h.textContent = 'Send ' + ids.length + ' key' + (ids.length > 1 ? 's' : '') + ' to…';
    var sub = document.createElement('div');
    sub.style.cssText = 'font-size:0.75rem;color:#cbd5e1;margin-bottom:12px;';
    sub.textContent = 'Up to 3 keys per peer per day. If a peer opens a cipher with your key, you both win the same prize.';
    sheet.appendChild(h);
    sheet.appendChild(sub);
    if (!peers.length) {
        var none = document.createElement('div');
        none.style.cssText = 'font-size:0.85rem;color:#cbd5e1;margin-bottom:10px;line-height:1.4;';
        none.textContent = 'You have no peers yet. Open Global Chat or the leaderboard, tap a name, and press Add Peer on their profile.';
        var noneActions = document.createElement('div');
        noneActions.className = 'kc-help-actions';
        noneActions.style.marginBottom = '10px';
        noneActions.appendChild(_peopleLink('Open Global Chat', function() {
            _dismissGiftingChild(overlay);
            _openChatForKeys();
        }));
        noneActions.appendChild(_peopleLink('Open Leaderboard', function() {
            _dismissGiftingChild(overlay);
            _openLeaderboardForKeys();
        }));
        sheet.appendChild(none);
        sheet.appendChild(noneActions);
    }
    peers.forEach(function(p) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = p.name;
        b.style.cssText = 'display:block;width:100%;text-align:left;margin-bottom:8px;padding:12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.3);border-radius:10px;color:#e2e8f0;font-weight:700;cursor:pointer;font-family:inherit;';
        b.onclick = async function() {
            b.disabled = true;
            b.textContent = 'Sending…';
            try {
                var sent = await _callCF('sendKeys', { keyIds: ids, recipientUid: p.uid });
                ids.forEach(function(id) { _noteSpent(id); });
                _keySendToast(p.name, sent);
                _dismissGiftingChild(overlay);
                await _refreshHoldingsViews();
            } catch (e) {
                b.disabled = false;
                b.textContent = p.name;
                _toast('❌ ' + (e.message || 'Could not send'));
            }
        };
        sheet.appendChild(b);
    });
    var close = _btn('Close', 'transparent');
    close.style.border = '1px solid #334155';
    close.style.color = '#e2e8f0';
    close.style.width = '100%';
    close.onclick = function() { _dismissGiftingChild(overlay); };
    sheet.appendChild(close);
    overlay.appendChild(sheet);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) _dismissGiftingChild(overlay); });
    document.body.appendChild(overlay);
    _mountGiftingChild(overlay, returnFocus);
};

window.showKeyPickerForPeer = async function(recipientUid, recipientName) {
    var returnFocus = document.activeElement || null;
    if (!_isSignedIn()) { _toast('Sign in to send keys'); return; }
    _injectGiftingCSS();
    var isPeer = (window._myPeers && window._myPeers.has && window._myPeers.has(recipientUid));
    if (!isPeer && typeof currentUser !== 'undefined' && currentUser && Array.isArray(currentUser.peers)) {
        isPeer = currentUser.peers.indexOf(recipientUid) !== -1;
    }
    if (!isPeer) {
        _toast('Add ' + (recipientName || 'them') + ' as a peer before sending keys');
        return;
    }
    var holdings = await _loadHoldings();
    var keys = holdings.ownKeys;
    var old = document.getElementById('keyPickerOverlay');
    if (old) _dismissGiftingChild(old);
    var overlay = document.createElement('div');
    overlay.id = 'keyPickerOverlay';
    overlay.className = 'gifting-overlay';
    overlay.style.alignItems = 'flex-end';
    var sheet = document.createElement('div');
    sheet.style.cssText = 'background:#0f172a;color:#e2e8f0;border-radius:18px 18px 0 0;padding:18px;width:100%;max-width:480px;max-height:80vh;overflow:auto;border:1px solid #334155;';
    var h = document.createElement('div');
    h.style.cssText = 'font-weight:800;color:#f7931a;margin-bottom:8px;';
    h.textContent = 'Send keys to ' + (recipientName || 'peer');
    sheet.appendChild(h);
    var limit = document.createElement('div');
    limit.style.cssText = 'font-size:0.78rem;color:#cbd5e1;margin-bottom:10px;line-height:1.4;';
    limit.textContent = 'Up to 3 keys per peer per day. A key only opens a cipher with the same label. If a peer opens a cipher with your key, you both win the same prize.';
    sheet.appendChild(limit);

    var today = _utcDay();
    var offset = (typeof getDailyKey === 'function') ? getDailyKey() : today;
    try {
        var dates = today === offset ? [today] : [today, offset];
        var pairSnap = await db.collection('key_send_pairs').where('senderUid', '==', _getUid()).where('date', 'in', dates).limit(100).get();
        var alreadySent = false;
        pairSnap.forEach(function(d) {
            if (d.data().recipientUid === recipientUid) alreadySent = true;
        });
        if (alreadySent) {
            var blocked = document.createElement('div');
            blocked.style.cssText = 'padding:10px;border-radius:8px;background:rgba(252,165,165,0.12);color:#fca5a5;font-size:0.8rem;font-weight:700;margin-bottom:10px;';
            blocked.textContent = 'You already sent keys to this peer today.';
            sheet.appendChild(blocked);
            var closeBlocked = _btn('Close', 'transparent');
            closeBlocked.style.border = '1px solid #334155';
            closeBlocked.style.color = '#e2e8f0';
            closeBlocked.style.width = '100%';
            closeBlocked.onclick = function() { _dismissGiftingChild(overlay); };
            sheet.appendChild(closeBlocked);
            overlay.appendChild(sheet);
            document.body.appendChild(overlay);
            _mountGiftingChild(overlay, returnFocus);
            return;
        }
    } catch (e) { /* server still enforces the cap */ }

    if (!keys.length) {
        var none = document.createElement('div');
        none.style.cssText = 'color:#cbd5e1;font-size:0.85rem;margin-bottom:10px;';
        none.textContent = 'No keys to send. Open gifts from the daily wheel first.';
        sheet.appendChild(none);
    }
    var selected = [];
    var list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;';
    function paint() {
        list.innerHTML = '';
        keys.forEach(function(k) {
            var on = selected.indexOf(k.id) !== -1;
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.textContent = (on ? '✓ ' : '') + k.label;
            chip.style.cssText = 'padding:8px 12px;font-family:monospace;font-weight:900;border-radius:8px;cursor:pointer;border:2px solid ' + (on ? '#f7931a' : 'rgba(247,147,26,0.3)') + ';background:' + (on ? 'rgba(247,147,26,0.2)' : 'transparent') + ';color:' + (on ? '#f7931a' : '#cbd5e1') + ';';
            chip.onclick = function() {
                var idx = selected.indexOf(k.id);
                if (idx !== -1) selected.splice(idx, 1);
                else if (selected.length >= 3) _toast('Max 3 keys per send');
                else selected.push(k.id);
                paint();
                send.disabled = selected.length === 0;
                send.style.opacity = selected.length ? '1' : '0.4';
            };
            list.appendChild(chip);
        });
    }
    var send = _btn('Send keys');
    send.style.width = '100%';
    send.disabled = true;
    send.style.opacity = '0.4';
    send.onclick = async function() {
        send.disabled = true;
        send.textContent = 'Sending…';
        try {
            var sentIds = selected.slice();
            var sentKeys = await _callCF('sendKeys', { keyIds: sentIds, recipientUid: recipientUid });
            sentIds.forEach(function(id) { _noteSpent(id); });
            _keySendToast(recipientName || 'your peer', sentKeys);
            _dismissGiftingChild(overlay);
            await _refreshHoldingsViews();
        } catch (e) {
            send.disabled = false;
            send.textContent = 'Send keys';
            _toast('❌ ' + (e.message || 'Could not send'));
        }
    };
    paint();
    sheet.appendChild(list);
    sheet.appendChild(send);
    var close = _btn('Close', 'transparent');
    close.style.border = '1px solid #334155';
    close.style.color = '#e2e8f0';
    close.style.width = '100%';
    close.style.marginTop = '8px';
    close.onclick = function() { _dismissGiftingChild(overlay); };
    sheet.appendChild(close);
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    _mountGiftingChild(overlay, returnFocus);
};

// ─── Settings blurb: pending gifts only (the explanation is in the page) ────

window.renderGiftsSettingsTab = async function() {
    var container = document.getElementById('giftsTabContent');
    if (!container) return;
    if (!_isSignedIn()) {
        container.innerHTML = '';
        return;
    }
    try {
        var snap = await db.collection('gifts')
            .where('ownerId', '==', _getUid())
            .where('status', 'in', ['unopened', 'inventory', 'sent'])
            .limit(40).get();
        container.innerHTML = '';
        if (snap.empty) return;
        var gifts = snap.docs.map(function(d) { return { id: d.id }; });
        var wrap = document.createElement('div');
        wrap.style.cssText = 'margin-top:10px;padding:12px;border-radius:12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.3);';
        var t = document.createElement('div');
        t.style.cssText = 'font-weight:800;color:#f7931a;margin-bottom:8px;';
        t.textContent = gifts.length + ' gift' + (gifts.length > 1 ? 's' : '') + ' waiting to be opened';
        var b = _btn('Open them');
        b.style.width = '100%';
        b.onclick = function() { window.showPostSpinGiftModal(gifts, { pending: true }); };
        wrap.appendChild(t);
        wrap.appendChild(b);
        container.appendChild(wrap);
    } catch (e) {
        container.textContent = '';
    }
};

window.openNookInventory = function() {
    if (typeof showQuestHub !== 'function') return;
    var returnFocus = document.activeElement || null;
    var giftOpen = !!document.getElementById('postSpinGiftOverlay');
    showQuestHub();
    setTimeout(function() {
        window._questHubTab = 'nook';
        window._nookSubTab = 'inventory';
        if (typeof _renderQuestHubTab === 'function') _renderQuestHubTab();
        var hub = document.getElementById('questHubOverlay');
        var settings = document.getElementById('usernameModal');
        if (hub && settings && settings.classList.contains('open')) hub.style.zIndex = '450000';
        if (giftOpen) _noteInventoryOverGift(returnFocus);
    }, 120);
};

// ─── Admin ledger ────────────────────────────────────────────────────────────

window.renderCipherWinsAdmin = async function(container) {
    var el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el || window._isAdminClaim !== true) { if (el) el.innerHTML = ''; return; }
    el.innerHTML = '<div style="font-size:0.8rem;color:var(--text-muted);padding:8px;">Loading cipher wins…</div>';
    try {
        var res = await _callCF('adminListCipherWins', {});
        var wins = (res.data && res.data.wins) || [];
        el.innerHTML = '';
        var h = document.createElement('div');
        h.style.cssText = 'font-weight:800;color:#f7931a;margin-bottom:8px;';
        h.textContent = 'Cipher sats wins (' + wins.length + ')';
        el.appendChild(h);
        if (!wins.length) {
            var none = document.createElement('div');
            none.style.cssText = 'font-size:0.8rem;color:var(--text-muted);';
            none.textContent = 'No sats wins yet.';
            el.appendChild(none);
            return;
        }
        wins.forEach(function(w) {
            var card = document.createElement('div');
            card.style.cssText = 'padding:10px;margin-bottom:8px;border:1px solid var(--border,#333);border-radius:10px;font-size:0.78rem;';
            var line = document.createElement('div');
            line.style.fontWeight = '800';
            line.textContent = (w.amount || 0).toLocaleString() + ' sats — ' + (w.status || '') + (w.announced ? '' : ' (chat not posted)');
            var who = document.createElement('div');
            who.style.color = 'var(--text-muted)';
            who.textContent = '@' + (w.username || w.uid || '') + ' · cipher ' + (w.cipherLabel || '') +
                ' · key ' + (w.keyOrigin === 'peer' ? ('from ' + (w.keySentByName || w.keySentBy || 'a peer')) : 'their own') +
                ' · roll ' + (w.roll != null ? w.roll : '?');
            card.appendChild(line);
            card.appendChild(who);
            if (w.flagForAdmin) {
                var flag = document.createElement('div');
                flag.style.cssText = 'color:#ef4444;font-weight:800;margin-top:4px;';
                var why = w.claimBlockReason === 'sats_disabled' ? 'sats disabled' :
                    (w.claimBlockReason === 'sats_disabled_and_banned' ? 'banned and sats disabled' : 'banned');
                flag.textContent = 'Flagged: this account is ' + why + ' — do not pay this 1,000+ win.';
                card.appendChild(flag);
            } else if (w.claimBlocked) {
                var blocked = document.createElement('div');
                blocked.style.cssText = 'color:#f59e0b;font-weight:700;margin-top:4px;';
                blocked.textContent = 'Sats are disabled or this account is banned.';
                card.appendChild(blocked);
            }
            if (w.status === 'unknown') {
                var held = document.createElement('div');
                held.style.cssText = 'color:#f59e0b;font-weight:700;margin-top:4px;';
                held.textContent = 'Payment not confirmed. Check the wallet before marking this paid.';
                card.appendChild(held);
            }
            if (w.status !== 'paid' || w.announced !== true) {
                var b = _btn(w.status === 'paid' ? 'Post Nacho message' : 'Mark paid');
                b.style.marginTop = '8px';
                b.onclick = async function() {
                    b.disabled = true;
                    try {
                        await _callCF('adminMarkCipherWinPaid', { winId: w.id });
                        _toast('Marked paid');
                        window.renderCipherWinsAdmin(el);
                    } catch (e) {
                        b.disabled = false;
                        _toast('❌ ' + (e.message || 'Could not update'));
                    }
                };
                card.appendChild(b);
            }
            el.appendChild(card);
        });
    } catch (e) {
        el.innerHTML = '<div style="color:#ef4444;font-size:0.8rem;">Could not load wins. ' + _esc(e.message || '') + '</div>';
    }
};

var _shownCipherShares = {};
var _cipherShareQueue = [];
var _cipherSharePlaying = false;

window.showCipherShareReveal = function(notice) {
    notice = notice || {};
    if (notice.revealed === true) return;
    var shareId = String(notice.shareId || notice.cipherId || '');
    if (!shareId || _shownCipherShares[shareId]) return;
    _shownCipherShares[shareId] = true;
    _cipherShareQueue.push(notice);
    _drainCipherShareQueue();
};

function _drainCipherShareQueue() {
    if (_cipherSharePlaying) return;
    var notice = _cipherShareQueue.shift();
    if (!notice) return;
    _cipherSharePlaying = true;
    var shareId = String(notice.shareId || notice.cipherId || '');
    _injectGiftingCSS();
    _playUnlockSound();
    var old = document.getElementById('cipherShareOverlay');
    if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.id = 'cipherShareOverlay';
    overlay.className = 'gifting-overlay';
    overlay.style.zIndex = '480000';
    var modal = document.createElement('div');
    modal.className = 'gifting-modal';
    var who = notice.openerUsername || 'a Bitcoiner';
    var label = notice.cipherLabel || notice.cipherType || '';
    var message = notice.message || ('Your key opened @' + who + "'s cipher. You both won a cipher prize!");
    modal.innerHTML =
        '<div id="csLabel" style="font-family:monospace;font-size:2.2rem;font-weight:900;color:#a78bfa;letter-spacing:3px;">🔒 ' + _esc(label || 'cipher') + '</div>' +
        '<div style="color:var(--text-muted);font-size:0.78rem;margin:6px 0 12px;">A key you sent is opening a cipher…</div>' +
        '<div id="csHex" style="font-family:monospace;font-size:0.7rem;color:#f7931a;word-break:break-all;min-height:48px;margin-bottom:12px;padding:10px;background:rgba(247,147,26,0.05);border-radius:8px;"></div>' +
        '<div id="csResult" style="display:none;"></div>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    var hexEl = document.getElementById('csHex');
    _playHex(hexEl, 1200).then(function() {
        if (!overlay.parentNode) return;
        if (hexEl) hexEl.style.display = 'none';
        var labelEl = document.getElementById('csLabel');
        if (labelEl) labelEl.innerHTML = '🔓 <span style="color:#f7931a;animation:decryptPulse 1.2s ease-in-out 2;">' + _esc(label || 'cipher') + '</span>';
        var resultDiv = document.getElementById('csResult');
        if (!resultDiv) return;
        resultDiv.style.display = 'block';
        resultDiv.style.animation = 'decryptReveal 0.4s ease-out';
        var line = document.createElement('div');
        line.id = 'csShareMessage';
        line.style.cssText = 'color:#f7931a;font-weight:900;font-size:1.05rem;line-height:1.4;';
        line.textContent = message;
        resultDiv.appendChild(line);
        var done = _btn('Nice!');
        done.style.width = '100%';
        done.style.marginTop = '14px';
        done.onclick = function() {
            overlay.remove();
            _cipherSharePlaying = false;
            _drainCipherShareQueue();
        };
        resultDiv.appendChild(done);
        _confetti();
    });
    if (shareId) {
        _callCF('ackCipherShare', { shareId: shareId }).catch(function() {});
    }
}

function _boot() {
    var tries = 0;
    var timer = setInterval(function() {
        tries++;
        if (_isSignedIn() && typeof db !== 'undefined') {
            clearInterval(timer);
            window.checkPendingGifts();
        } else if (tries > 40) clearInterval(timer);
    }, 500);
}
_boot();
_installPeopleStacking();

console.log('[gifting] keys/ciphers loaded');
})();
