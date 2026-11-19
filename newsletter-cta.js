// 603BTC Newsletter subscribe CTA. Opens Substack's own page; never collects email.
(function (root) {
    'use strict';

    var SUBSCRIBE = 'https://603btc.substack.com/subscribe';
    var FLAG = 'btc_newsletter_cta_seen';
    var TITLE = 'Get the weekly 603BTC Newsletter';
    var REF_COPY = "Get the weekly 603BTC Newsletter so you don't fall behind your friend.";
    var SOURCE = 'bq-app';
    var CARD_ID = 'bqNewsletterCta';
    var pendingFirstQuest = false;
    var retryTimer = null;

    function subscribeUrl(medium) {
        return SUBSCRIBE + '?utm_source=' + encodeURIComponent(SOURCE) + '&utm_medium=' + encodeURIComponent(medium || 'menu');
    }

    function hasSeen() {
        try { return root.localStorage && root.localStorage.getItem(FLAG) === '1'; }
        catch (e) { return false; }
    }

    function markSeen() {
        try { if (root.localStorage) root.localStorage.setItem(FLAG, '1'); } catch (e) {}
    }

    function arrivedWithRef() {
        try {
            var stored = root.localStorage && root.localStorage.getItem('btc_referral_code');
            if (stored) {
                var own = '';
                try {
                    if (typeof currentUser !== 'undefined' && currentUser && currentUser.referralCode) {
                        own = String(currentUser.referralCode);
                    }
                } catch (e2) {}
                if (!own || String(stored) !== own) return true;
            }
        } catch (e) {}
        try {
            var loc = root.location;
            if (loc && loc.search) {
                var params = new URLSearchParams(loc.search);
                if (params.get('ref')) return true;
            }
        } catch (e3) {}
        return false;
    }

    function promptCopy() {
        return arrivedWithRef() ? REF_COPY : TITLE;
    }

    function promptMedium() {
        return arrivedWithRef() ? 'ref-dispatch' : 'post-quest';
    }

    function modalOpen(el) {
        if (!el) return false;
        if (el.classList && el.classList.contains('open')) return true;
        if (el.hidden) return false;
        return false;
    }

    function pvpOrBattleOpen() {
        if (root._pvpActive || root._examActive || root._scholarExamActive) return true;
        try {
            var hash = (root.location && root.location.hash) || '';
            if (hash === '#pvp' || hash.indexOf('#pvp') === 0) return true;
        } catch (e) {}
        var d = root.document;
        if (!d || !d.getElementById) return false;
        if (d.getElementById('pvpOverlay') || d.getElementById('pvpQuestion') || d.getElementById('pvpNameOverlay')) {
            var pvp = d.getElementById('pvpOverlay') || d.getElementById('pvpNameOverlay') || d.getElementById('pvpQuestion');
            if (pvp && root.btcSheet && typeof root.btcSheet.top === 'function') {
                /* fall through to layer check below */
            }
            if (pvp && pvp.offsetParent !== null) return true;
            try {
                if (pvp && root.getComputedStyle) {
                    var cs = root.getComputedStyle(pvp);
                    if (cs && cs.display !== 'none' && cs.visibility !== 'hidden') {
                        if (typeof pvp.getBoundingClientRect === 'function') {
                            var box = pvp.getBoundingClientRect();
                            if (box && box.width > 0 && box.height > 0) return true;
                        }
                    }
                }
            } catch (e2) {}
        }
        return false;
    }

    function otherModalOpen() {
        var d = root.document;
        if (!d || !d.getElementById) return false;
        if (modalOpen(d.getElementById('questModal'))) return true;
        if (modalOpen(d.getElementById('tosModal'))) return true;
        if (modalOpen(d.getElementById('usernameModal'))) return true;
        if (d.getElementById('mfaSignInOverlay') || d.getElementById('totpSignInOverlay') || d.getElementById('btcIntroOverlay')) return true;
        var repick = d.getElementById('usernameRepick');
        if (repick) {
            try {
                if (root.getComputedStyle && root.getComputedStyle(repick).display !== 'none') return true;
            } catch (e) {}
        }
        if (root.btcSheet && typeof root.btcSheet.top === 'function') {
            var top = root.btcSheet.top();
            if (top && top.id !== CARD_ID) return true;
        }
        return false;
    }

    function isBusy() {
        return pvpOrBattleOpen() || otherModalOpen();
    }

    function shouldShow(opts) {
        opts = opts || {};
        if (hasSeen() && !opts.force) return false;
        if (!opts.force && !pendingFirstQuest && !opts.pendingFirstQuest) return false;
        if (opts.inPvp || (opts.checkBusy !== false && isBusy())) return false;
        return true;
    }

    function clearRetry() {
        if (retryTimer && root.clearTimeout) root.clearTimeout(retryTimer);
        retryTimer = null;
    }

    function scheduleRetry() {
        if (retryTimer || !root.setTimeout) return;
        var tries = 0;
        function tick() {
            retryTimer = null;
            tries += 1;
            if (hasSeen() || !pendingFirstQuest) return;
            if (!isBusy()) {
                showPrompt();
                return;
            }
            if (tries < 30 && root.setTimeout) retryTimer = root.setTimeout(tick, 2000);
        }
        retryTimer = root.setTimeout(tick, 400);
    }

    function removeCard() {
        var d = root.document;
        if (!d) return;
        var el = d.getElementById(CARD_ID);
        if (el && el.parentNode) el.parentNode.removeChild(el);
        if (root.btcSheet && typeof root.btcSheet.sync === 'function') {
            try { root.btcSheet.sync(); } catch (e) {}
        }
    }

    function closeCard() {
        markSeen();
        pendingFirstQuest = false;
        clearRetry();
        removeCard();
    }

    function showPrompt(opts) {
        opts = opts || {};
        if (!opts.force && !shouldShow({ checkBusy: true })) {
            if (pendingFirstQuest && !hasSeen()) scheduleRetry();
            return false;
        }
        var d = root.document;
        if (!d || !d.createElement || !d.body) return false;
        removeCard();
        var copy = promptCopy();
        var medium = promptMedium();
        var href = subscribeUrl(medium);

        var card = d.createElement('div');
        card.id = CARD_ID;
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-labelledby', 'bqNewsletterCtaTitle');
        card.setAttribute('aria-modal', 'false');

        var close = d.createElement('button');
        close.type = 'button';
        close.id = 'bqNewsletterCtaClose';
        close.setAttribute('aria-label', 'Close');
        close.textContent = '\u00d7';
        close.addEventListener('click', function (e) {
            if (e && e.preventDefault) e.preventDefault();
            closeCard();
        });

        var title = d.createElement('p');
        title.id = 'bqNewsletterCtaTitle';
        title.textContent = copy;

        var link = d.createElement('a');
        link.id = 'bqNewsletterCtaLink';
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = TITLE;
        link.addEventListener('click', function () { markSeen(); pendingFirstQuest = false; });

        card.appendChild(close);
        card.appendChild(title);
        card.appendChild(link);

        var style = d.getElementById('bqNewsletterCtaStyle');
        if (!style) {
            style = d.createElement('style');
            style.id = 'bqNewsletterCtaStyle';
            style.textContent =
                '#' + CARD_ID + '{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));'
                + 'z-index:240000;max-width:351px;margin:0 auto;box-sizing:border-box;padding:16px 16px 16px 16px;'
                + 'background:var(--card-bg,#1a1a2e);color:var(--text,#e5e7eb);border:1px solid var(--border,rgba(255,255,255,.14));'
                + 'border-radius:16px;box-shadow:0 8px 28px rgba(0,0,0,.35);font-family:inherit;}'
                + '#' + CARD_ID + ' #' + 'bqNewsletterCtaTitle' + '{margin:0 44px 12px 0;font-size:1rem;font-weight:700;line-height:1.35;color:var(--heading,var(--text,#e5e7eb));}'
                + '#' + CARD_ID + ' #' + 'bqNewsletterCtaClose' + '{position:absolute;top:8px;right:8px;width:44px;height:44px;min-width:44px;min-height:44px;'
                + 'border:none;border-radius:10px;background:transparent;color:var(--text-muted,#9ca3af);font-size:1.4rem;line-height:1;'
                + 'cursor:pointer;font-family:inherit;touch-action:manipulation;}'
                + '#' + CARD_ID + ' #' + 'bqNewsletterCtaLink' + '{display:flex;align-items:center;justify-content:center;min-height:44px;padding:10px 14px;'
                + 'box-sizing:border-box;border-radius:12px;background:var(--accent,#f7931a);color:#fff;font-weight:800;font-size:0.95rem;'
                + 'text-decoration:none;text-align:center;font-family:inherit;touch-action:manipulation;}'
                + '[data-theme="light"] #' + CARD_ID + '{background:#fff;color:#0f172a;border-color:rgba(15,23,42,.12);box-shadow:0 8px 28px rgba(15,23,42,.16);}';
            (d.head || d.documentElement).appendChild(style);
        }

        d.body.appendChild(card);
        if (root.btcSheet && typeof root.btcSheet.setCloser === 'function') {
            try {
                root.btcSheet.setCloser(card, function () { closeCard(); return true; });
                if (typeof root.btcSheet.sync === 'function') root.btcSheet.sync();
            } catch (e4) {}
        }
        if (!opts.force) markSeen();
        pendingFirstQuest = false;
        clearRetry();
        return true;
    }

    function noteFirstQuestFinished() {
        if (hasSeen()) return;
        pendingFirstQuest = true;
    }

    function tryShowAfterQuest() {
        if (!pendingFirstQuest || hasSeen()) return;
        showPrompt();
    }

    function menuHref() {
        return subscribeUrl('menu');
    }

    var api = {
        SUBSCRIBE: SUBSCRIBE,
        FLAG: FLAG,
        TITLE: TITLE,
        REF_COPY: REF_COPY,
        subscribeUrl: subscribeUrl,
        menuHref: menuHref,
        siteHref: function () { return subscribeUrl('site'); },
        hasSeen: hasSeen,
        markSeen: markSeen,
        arrivedWithRef: arrivedWithRef,
        promptCopy: promptCopy,
        promptMedium: promptMedium,
        shouldShow: shouldShow,
        isBusy: isBusy,
        noteFirstQuestFinished: noteFirstQuestFinished,
        tryShowAfterQuest: tryShowAfterQuest,
        showPrompt: showPrompt,
        closeCard: closeCard,
        _setPending: function (v) { pendingFirstQuest = !!v; },
        _pending: function () { return pendingFirstQuest; }
    };

    root.btcNewsletterCta = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
