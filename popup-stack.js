// Shared sheet stack and the first-sign-in popup queue.
// Esc and the phone Back button close only the top sheet.
// Focus stays inside that sheet. Floaters hide while any sheet is open.
(function (root) {
    'use strict';

    var closers = typeof WeakMap === 'function' ? new WeakMap() : null;
    var closerList = [];
    var seq = 0;
    var pushed = 0;
    var ignorePop = 0;
    var lastFocus = null;

    function doc() {
        return root.document || null;
    }

    function rememberCloser(el, fn) {
        if (!el || typeof fn !== 'function') return;
        if (closers) closers.set(el, fn);
        else closerList.push({ el: el, fn: fn });
    }

    function closerFor(el) {
        if (!el) return null;
        if (closers && closers.has(el)) return closers.get(el);
        for (var i = closerList.length - 1; i >= 0; i--) {
            if (closerList[i].el === el) return closerList[i].fn;
        }
        return null;
    }

    function zOf(el) {
        var z = 0;
        if (!el) return 0;
        if (el.style && el.style.zIndex) {
            var inline = parseInt(el.style.zIndex, 10);
            if (inline > z) z = inline;
        }
        try {
            if (root.getComputedStyle) {
                var computed = parseInt(root.getComputedStyle(el).zIndex, 10);
                if (computed > z) z = computed;
            }
        } catch (e) {}
        return z;
    }

    function shown(el) {
        if (!el || el.nodeType !== 1) return false;
        if (el.hidden || (el.getAttribute && el.getAttribute('hidden') != null && el.getAttribute('hidden') !== 'false')) return false;
        if (el.id === 'tosModal' || el.id === 'questModal' || el.id === 'usernameModal' || el.id === 'lb' || el.id === 'leaderboard') {
            return !!(el.classList && el.classList.contains('open'));
        }
        if (el.id === 'notifPanel') {
            var transform = (el.style && el.style.transform) || '';
            return transform.indexOf('100%') === -1 && transform.indexOf('(0') !== -1;
        }
        if (el.style && el.style.display === 'none') return false;
        try {
            if (root.getComputedStyle) {
                var cs = root.getComputedStyle(el);
                if (cs.display === 'none' || cs.visibility === 'hidden') return false;
            }
        } catch (e2) {}
        return true;
    }

    function giftingChildOpen(document) {
        if (!document || !document.getElementById) return false;
        return !!(document.getElementById('decryptCipherOverlay') || document.getElementById('cipherClaimOverlay') || document.getElementById('peerPickerOverlay') || document.getElementById('keyPickerOverlay'));
    }

    function collect() {
        var document = doc();
        if (!document || !document.querySelectorAll) return [];
        var nodes = document.querySelectorAll('[role="dialog"], .gifting-overlay, #tosModal, #questModal, #usernameModal, #lb, #leaderboard, #btcIntroOverlay, #nachoQuestOverlay, #postSpinGiftOverlay, #spinModal, #notifPanel, [data-btc-sheet="1"]');
        var seen = [];
        var out = [];
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            if (seen.indexOf(el) !== -1) continue;
            var host = el;
            if (el.getAttribute && el.getAttribute('role') === 'dialog' && el.parentNode && el.parentNode.id && shown(el.parentNode) && (el.parentNode.id === 'tosModal' || el.parentNode.classList && el.parentNode.classList.contains('gifting-overlay'))) {
                host = el.parentNode;
            }
            if (seen.indexOf(host) !== -1) continue;
            if (!shown(host)) continue;
            seen.push(host);
            out.push(host);
        }
        out.sort(function (a, b) { return zOf(a) - zOf(b); });
        return out;
    }

    function top() {
        var layers = collect();
        return layers.length ? layers[layers.length - 1] : null;
    }

    function focusables(rootEl) {
        var out = [];
        if (!rootEl) return out;
        var sel = 'button, [href], input, select, textarea, [tabindex]';
        var list = rootEl.querySelectorAll ? rootEl.querySelectorAll(sel) : [];
        for (var i = 0; i < list.length; i++) {
            var node = list[i];
            if (node.disabled) continue;
            if (node.getAttribute && node.getAttribute('tabindex') === '-1' && node.tagName !== 'DIV') continue;
            if (node.tagName === 'DIV' && node.getAttribute('tabindex') === '-1') continue;
            out.push(node);
        }
        return out;
    }

    function dialogRoot(el) {
        if (!el) return null;
        if (el.getAttribute && el.getAttribute('role') === 'dialog') return el;
        var inner = el.querySelector ? el.querySelector('[role="dialog"]') : null;
        return inner || el;
    }

    function focusFirst(el) {
        var box = dialogRoot(el);
        var items = focusables(box);
        var target = items.length ? items[0] : box;
        if (target && target.focus) {
            try { target.focus(); } catch (e) {}
        }
    }

    function pushHistory() {
        try {
            if (!root.history || !root.history.pushState) return;
            root.history.pushState({ btcSheet: ++seq }, '', (root.location && root.location.href) || '');
            pushed++;
        } catch (e) {}
    }

    function popHistory() {
        if (pushed < 1) return;
        pushed--;
        ignorePop++;
        try { root.history.back(); } catch (e) { ignorePop = Math.max(0, ignorePop - 1); }
    }

    function closeEl(el, fromPop) {
        if (!el) return false;
        var fn = closerFor(el);
        if (fn) {
            try { fn(); } catch (e) {}
        } else if (el.id === 'tosModal' && typeof root._dismissTos === 'function') {
            root._dismissTos();
        } else if (el.id === 'postSpinGiftOverlay') {
            var later = el.querySelector && el.querySelector('.gift-later-btn');
            if (later && later.click) later.click();
            else if (el.remove) el.remove();
        } else if (el.id === 'questModal' && typeof root.closeQuest === 'function') {
            root.closeQuest();
        } else if (el.classList && el.classList.contains('open')) {
            el.classList.remove('open');
            if (el.getAttribute) el.setAttribute('aria-hidden', 'true');
        } else if (el.remove) {
            el.remove();
        }
        if (!fromPop) popHistory();
        if (lastFocus && lastFocus.focus) {
            try { lastFocus.focus(); } catch (e2) {}
        }
        sync();
        return true;
    }

    function sync() {
        var document = doc();
        if (!document || !document.body) return;
        var layers = collect();
        var open = layers.length > 0;
        document.body.classList.toggle('btc-sheet-open', open);
        if (document.documentElement) document.documentElement.classList.toggle('btc-sheet-open', open);
        if (!open) return;
        var current = layers[layers.length - 1];
        if (!current._btcSheetArmed) {
            current._btcSheetArmed = true;
            if (!lastFocus) lastFocus = document.activeElement || null;
            if (!giftingChildOpen(document)) pushHistory();
            focusFirst(current);
        }
    }

    function onKey(e) {
        if (!e) return;
        var document = doc();
        if (!document) return;
        if (giftingChildOpen(document)) return;
        var current = top();
        if (!current) return;
        var key = e.key || '';
        if (key === 'Escape' || key === 'Esc' || e.keyCode === 27) {
            if (e.preventDefault) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
            closeEl(current, false);
            return;
        }
        if (key !== 'Tab') return;
        var box = dialogRoot(current);
        var items = focusables(box);
        if (!items.length) {
            if (e.preventDefault) e.preventDefault();
            if (box && box.focus) { try { box.focus(); } catch (err) {} }
            return;
        }
        var first = items[0];
        var last = items[items.length - 1];
        var active = document.activeElement;
        if (e.shiftKey) {
            if (active === first || !box.contains(active)) {
                if (e.preventDefault) e.preventDefault();
                try { last.focus(); } catch (err2) {}
            }
        } else if (active === last || !box.contains(active)) {
            if (e.preventDefault) e.preventDefault();
            try { first.focus(); } catch (err3) {}
        }
    }

    function onPop() {
        if (ignorePop > 0) {
            ignorePop--;
            return;
        }
        var document = doc();
        if (giftingChildOpen(document)) return;
        if (pushed > 0) pushed--;
        var current = top();
        if (!current) return;
        closeEl(current, true);
    }

    function bind() {
        var document = doc();
        if (!document || document._btcSheetBound || !document.addEventListener) return;
        document._btcSheetBound = true;
        document.addEventListener('keydown', onKey, true);
        root.addEventListener('popstate', onPop);
        if (typeof root.MutationObserver === 'function' && document.body) {
            var timer = null;
            new root.MutationObserver(function () {
                if (timer) return;
                timer = root.setTimeout(function () {
                    timer = null;
                    sync();
                }, 30);
            }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'open', 'style', 'aria-modal'] });
        }
        sync();
    }

    var ORDER = ['gift', 'terms', 'pace', 'quiz', 'quest'];
    var state = {};
    var shows = {};
    var signedIn = false;
    var waitTimer = null;

    function stepState(kind) {
        return state[kind] || 'pending';
    }

    function pump() {
        if (!signedIn) return;
        for (var i = 0; i < ORDER.length; i++) {
            var kind = ORDER[i];
            var cur = stepState(kind);
            if (cur === 'done' || cur === 'skip') continue;
            if (cur === 'showing') return;
            if (cur === 'pending') return;
            if (cur === 'ready' && typeof shows[kind] === 'function') {
                state[kind] = 'showing';
                try { shows[kind](); }
                catch (e) {
                    state[kind] = 'done';
                    pump();
                }
                return;
            }
        }
    }

    function armWait() {
        if (waitTimer) return;
        waitTimer = root.setTimeout(function () {
            waitTimer = null;
            if (!signedIn) return;
            if (stepState('gift') === 'pending') state.gift = 'skip';
            if (stepState('terms') === 'pending') state.terms = 'skip';
            pump();
        }, 12000);
    }

    var queue = {
        order: ORDER.slice(),
        onSignedIn: function () {
            signedIn = true;
            armWait();
            if (typeof root.btcBeginSignedInOnboarding === 'function') {
                try { root.btcBeginSignedInOnboarding(); } catch (e) {}
            }
            pump();
        },
        holdUntilSignedIn: function () {
            signedIn = false;
        },
        isSignedIn: function () { return signedIn; },
        ready: function (kind, fn) {
            if (ORDER.indexOf(kind) === -1) return;
            shows[kind] = fn;
            if (state[kind] === 'showing' || state[kind] === 'done') return;
            state[kind] = 'ready';
            pump();
        },
        skip: function (kind) {
            if (ORDER.indexOf(kind) === -1) return;
            if (state[kind] === 'showing' || state[kind] === 'done') return;
            state[kind] = 'skip';
            pump();
        },
        done: function (kind) {
            if (ORDER.indexOf(kind) === -1) return;
            state[kind] = 'done';
            pump();
        },
        isTurn: function (kind) {
            if (!signedIn) return false;
            for (var i = 0; i < ORDER.length; i++) {
                var cur = ORDER[i];
                if (cur === kind) return stepState(cur) === 'showing' || stepState(cur) === 'ready';
                var s = stepState(cur);
                if (s !== 'done' && s !== 'skip') return false;
            }
            return false;
        },
        stateOf: function (kind) { return stepState(kind); },
        pump: pump
    };

    var sheet = {
        setCloser: rememberCloser,
        top: top,
        sync: sync,
        closeTop: function () {
            var current = top();
            if (!current) return false;
            return closeEl(current, false);
        },
        layers: collect
    };

    root.btcOnboardingQueue = queue;
    root.btcSheet = sheet;

    function injectCss() {
        var document = doc();
        if (!document || document.getElementById('btcSheetStyles')) return;
        var style = document.createElement('style');
        style.id = 'btcSheetStyles';
        style.textContent = ''
            + 'body.btc-sheet-open #btc-quest-pill,'
            + 'body.btc-sheet-open #nachoQuestPill,'
            + 'body.btc-sheet-open #inviteCard,'
            + 'body.btc-sheet-open #invitePill,'
            + 'body.btc-sheet-open #inviteGuestPill,'
            + 'body.btc-sheet-open .invite-pill,'
            + 'body.btc-sheet-open #nacho-container,'
            + 'body.btc-sheet-open #fabMinimizeBtn,'
            + 'body.btc-sheet-open #fabExpandBtn,'
            + 'body.btc-sheet-open #aiToolsBtn,'
            + 'body.btc-sheet-open #dashboardFloatBtn,'
            + 'body.btc-sheet-open #lbFloatBtn,'
            + 'body.btc-sheet-open #chatOverlayBtn,'
            + 'body.btc-sheet-open #spinReminderFab,'
            + 'body.btc-sheet-open #tctv-drip'
            + '{display:none !important;visibility:hidden !important;pointer-events:none !important;}'
            + '#btcSigningShell{display:none;box-sizing:border-box;width:100%;max-width:520px;margin:12px auto 16px;padding:18px 16px;border-radius:16px;border:1px solid rgba(247,147,26,0.45);background:#111827;color:#f8fafc;font-weight:800;font-size:1.05rem;text-align:center;}'
            + 'html.btc-signing-in #btcSigningShell{display:block;}'
            + 'html.btc-signing-in #homeGuestActions,html.btc-signing-in #homeHero{display:none !important;}'
            + '@media (max-width:360px){#btcSigningShell{font-size:1rem;padding:16px 12px;}}';
        (document.head || document.documentElement).appendChild(style);
    }

    if (doc()) {
        if (doc().readyState === 'loading') doc().addEventListener('DOMContentLoaded', function () { injectCss(); bind(); });
        else { injectCss(); bind(); }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { queue: queue, sheet: sheet, shown: shown, focusables: focusables };
    }
})(typeof window !== 'undefined' ? window : globalThis);
