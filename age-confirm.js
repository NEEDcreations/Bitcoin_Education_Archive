// © 2024-2026 603BTC LLC. All rights reserved.
// Two-button age confirmation for new sign-ups and existing users at next login.
// "I'm 18 or older" calls confirmAge18, which writes over18 + over18ConfirmedAt
// (and ageConfirmed18). "I'm under 18" calls confirmAgeUnder18, which writes
// server-only ageUnder18 + ageUnder18At. Ads should keep reading the user doc
// field over18 (PR #401 hasKnownAdultAge). window._bqAgeConfirmed18 is a
// same-tab helper and stays false when the user is under 18 or dismisses.
// Dismissing asks again on the next visit; a saved under-18 answer does not.
(function (root) {
    'use strict';

    var COPY = {
        title: 'Quick age check',
        body: 'Please tell us your age group. You can keep playing either way.',
        over18: "I'm 18 or older",
        under18: "I'm under 18"
    };

    var BUTTON_STYLE = 'min-height:44px;width:100%;padding:10px 16px;background:#334155;color:#f1f5f9;border:1px solid #64748b;border-radius:12px;font-size:0.95rem;font-weight:800;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;';

    // Lucide "badge-check". Used on the header only, not on a choice button.
    var LUCIDE_BADGE_CHECK = '<svg class="lucide-badge-check" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.78 4 4 0 0 1 0-6.74Z"></path><path d="m9 12 2 2 4-4"></path></svg>';

    var SESSION_DISMISS = 'bq_age_confirm_dismissed';
    var OVERLAY_ID = 'ageConfirmOverlay';
    var waiting = false;
    var watchTimer = null;

    var KIDS_BOOL_FLAGS = ['isMinor', 'under13', 'kids', 'isKids', 'kidsMode'];
    var KIDS_AGE_BANDS = ['under13', 'minor', 'child', 'kids', 'kid'];
    var KIDS_ACCOUNT_LABELS = ['kids', 'kid', 'child', 'family-child', 'minor'];

    function isConfirmed(user) {
        if (!user) return false;
        return user.over18 === true || user.ageConfirmed18 === true;
    }

    function isUnder18(user) {
        return !!(user && user.ageUnder18 === true);
    }

    function isBlocked(user) {
        return !!(user && user.ageConfirmBlocked === true);
    }

    function isKidsAccount(user) {
        if (root.bqKidsAccount && typeof root.bqKidsAccount.isKidsAccount === 'function') {
            return !!root.bqKidsAccount.isKidsAccount(user);
        }
        if (!user) return false;
        var i;
        for (i = 0; i < KIDS_BOOL_FLAGS.length; i++) {
            if (user[KIDS_BOOL_FLAGS[i]] === true) return true;
        }
        var band = String(user.ageBand || user.age_band || '').toLowerCase();
        for (i = 0; i < KIDS_AGE_BANDS.length; i++) {
            if (band === KIDS_AGE_BANDS[i]) return true;
        }
        var label = String(user.accountType || user.planType || user.plan || user.role || user.mode || '').toLowerCase();
        for (i = 0; i < KIDS_ACCOUNT_LABELS.length; i++) {
            if (label === KIDS_ACCOUNT_LABELS[i]) return true;
        }
        return false;
    }

    function setHelper(value) {
        root._bqAgeConfirmed18 = !!value;
    }

    function queue() {
        return root.btcOnboardingQueue || null;
    }

    function sessionDismissed() {
        try { return root.sessionStorage && root.sessionStorage.getItem(SESSION_DISMISS) === '1'; }
        catch (e) { return false; }
    }

    function markDismissed() {
        try { if (root.sessionStorage) root.sessionStorage.setItem(SESSION_DISMISS, '1'); } catch (e) {}
    }

    function clearDismissed() {
        try { if (root.sessionStorage) root.sessionStorage.removeItem(SESSION_DISMISS); } catch (e) {}
    }

    function otherModalOpen() {
        var document = root.document;
        if (!document || !document.getElementById) return false;
        var ids = ['usernameModal', 'tosModal'];
        for (var i = 0; i < ids.length; i++) {
            var el = document.getElementById(ids[i]);
            if (el && el.classList && el.classList.contains('open')) return true;
        }
        return false;
    }

    function closeOverlay() {
        var document = root.document;
        if (!document) return;
        var old = document.getElementById(OVERLAY_ID);
        if (old && old.parentNode) old.parentNode.removeChild(old);
        if (root.btcSheet && root.btcSheet.sync) {
            try { root.btcSheet.sync(); } catch (e) {}
        }
    }

    function finishQueue(kind) {
        var q = queue();
        if (!q) return;
        try {
            if (kind === 'skip' && typeof q.skip === 'function') q.skip('age');
            else if (typeof q.done === 'function') q.done('age');
        } catch (e) {}
    }

    function patchProfileCache(fields) {
        try {
            var cached = JSON.parse(root.localStorage.getItem('btc_profile_cache') || 'null');
            if (cached && cached.data) {
                Object.keys(fields).forEach(function (k) { cached.data[k] = fields[k]; });
                root.localStorage.setItem('btc_profile_cache', JSON.stringify(cached));
            }
        } catch (e) {}
    }

    function dismiss() {
        markDismissed();
        closeOverlay();
        finishQueue('done');
        setHelper(false);
    }

    var MSG = {
        appCheck: 'Security check is still loading. Wait a moment and tap again.',
        appCheckFailed: 'Security check did not load. Refresh the page and try again.',
        offline: "Can't reach the server. Check your connection and try again.",
        generic: 'Could not save your answer. Please try again.'
    };

    // Resolves to a token string, '' when App Check never became ready, or
    // 'skip' when the page has no App Check helper (tests, old shells).
    function appCheckReady() {
        if (typeof root._btcAppCheckForClaim !== 'function') return Promise.resolve('skip');
        return Promise.resolve(root._btcAppCheckForClaim(8000)).catch(function () { return ''; });
    }

    function codeOf(e) {
        return String((e && e.code) || '').replace(/^functions\//, '');
    }

    function isAppCheckError(e) {
        var code = codeOf(e);
        return code === 'app-check-unavailable' || code === 'unauthenticated' || /app ?check/i.test(String((e && e.message) || ''));
    }

    function errorMessage(e) {
        if (root._btcRecaptchaFailed) return MSG.appCheckFailed;
        if (isAppCheckError(e)) return MSG.appCheck;
        var code = codeOf(e);
        if (code === 'unavailable' || code === 'deadline-exceeded') return MSG.offline;
        // The server's own messages for these codes are written for people.
        if ((code === 'resource-exhausted' || code === 'permission-denied') && e.message) return e.message;
        return MSG.generic;
    }

    // Waits for App Check before the call, and retries once after a fresh
    // token when an early tap still loses the race. Resolves { ok, error }.
    function callAge(name) {
        var fn;
        try {
            if (!root.firebase || !root.firebase.functions) return Promise.resolve({ ok: false, error: MSG.generic });
            fn = root.firebase.functions().httpsCallable(name);
        } catch (e) {
            return Promise.resolve({ ok: false, error: MSG.generic });
        }
        function attempt() {
            return appCheckReady().then(function (token) {
                if (token === '') {
                    var missing = new Error('App Check token is not ready');
                    missing.code = 'app-check-unavailable';
                    throw missing;
                }
                return fn({});
            });
        }
        return attempt().catch(function (e) {
            if (!isAppCheckError(e) || root._btcRecaptchaFailed) throw e;
            return attempt();
        }).then(function (res) {
            var data = (res && res.data) || {};
            var ok = name === 'confirmAgeUnder18'
                ? (data.success === true || data.ageUnder18 === true)
                : (data.success === true || data.over18 === true || data.ageConfirmed18 === true);
            return ok ? { ok: true } : { ok: false, error: MSG.generic };
        }).catch(function (e) {
            return { ok: false, error: errorMessage(e) };
        });
    }

    function fireAgeEvent(name, detail) {
        try {
            if (typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') {
                root.dispatchEvent(new root.CustomEvent(name, { detail: detail }));
            }
        } catch (e) {}
    }

    function bindChoice(btn, labelText, callable, onOk) {
        var busy = false;
        btn.addEventListener('click', function () {
            if (busy) return;
            busy = true;
            btn.disabled = true;
            var label = btn.querySelector('span');
            if (label) label.textContent = 'Saving...';
            callAge(callable).then(function (result) {
                if (result.ok) {
                    onOk();
                } else {
                    busy = false;
                    btn.disabled = false;
                    if (label) label.textContent = labelText;
                    if (typeof root.showToast === 'function') root.showToast(result.error);
                }
            });
        });
    }

    function makeChoiceButton(document, id, labelText) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = id;
        btn.style.cssText = BUTTON_STYLE;
        var span = document.createElement('span');
        span.textContent = labelText;
        btn.appendChild(span);
        return btn;
    }

    function showModal() {
        var document = root.document;
        if (!document || !document.body) return;
        if (document.getElementById(OVERLAY_ID)) return;
        if (otherModalOpen()) {
            if (watchTimer) return;
            watchTimer = root.setTimeout(function () {
                watchTimer = null;
                showModal();
            }, 300);
            return;
        }

        var overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'ageConfirmTitle');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:100040;background:rgba(15,23,42,0.72);display:flex;align-items:center;justify-content:center;padding:20px;';

        var card = document.createElement('div');
        card.style.cssText = 'position:relative;background:#1e293b;border:1px solid #334155;border-radius:20px;padding:28px 24px 22px;max-width:360px;width:100%;text-align:center;color:#e2e8f0;font-family:inherit;box-shadow:0 16px 40px rgba(15,23,42,0.45);';

        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = 'position:absolute;top:10px;right:12px;background:none;border:none;color:#94a3b8;font-size:1.4rem;line-height:1;cursor:pointer;padding:4px 8px;font-family:inherit;';
        closeBtn.addEventListener('click', dismiss);

        var iconWrap = document.createElement('div');
        iconWrap.style.cssText = 'width:48px;height:48px;border-radius:50%;background:#334155;color:#cbd5e1;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;';
        iconWrap.innerHTML = LUCIDE_BADGE_CHECK;

        var title = document.createElement('h2');
        title.id = 'ageConfirmTitle';
        title.setAttribute('tabindex', '-1');
        title.textContent = COPY.title;
        // tabindex=-1 + title.focus() is for the screen reader name, not a tab stop.
        // Drop the browser's default white focus box; buttons keep their focus style.
        title.style.cssText = 'margin:0 0 8px;font-size:1.25rem;font-weight:800;color:#f1f5f9;outline:none;';

        var body = document.createElement('p');
        body.textContent = COPY.body;
        body.style.cssText = 'margin:0 0 20px;font-size:0.95rem;line-height:1.45;color:#e2e8f0;';

        var actions = document.createElement('div');
        actions.style.cssText = 'display:flex;flex-direction:column;gap:10px;width:100%;';

        var overBtn = makeChoiceButton(document, 'ageConfirmBtn', COPY.over18);
        var underBtn = makeChoiceButton(document, 'ageUnder18Btn', COPY.under18);

        bindChoice(overBtn, COPY.over18, 'confirmAge18', function () {
            setHelper(true);
            patchProfileCache({ over18: true, ageConfirmed18: true });
            fireAgeEvent('bq-age-confirmed', { over18: true });
            closeOverlay();
            finishQueue('done');
        });
        bindChoice(underBtn, COPY.under18, 'confirmAgeUnder18', function () {
            setHelper(false);
            patchProfileCache({ ageUnder18: true });
            fireAgeEvent('bq-age-under18', { ageUnder18: true });
            closeOverlay();
            finishQueue('done');
        });

        actions.appendChild(overBtn);
        actions.appendChild(underBtn);

        overlay.addEventListener('click', function (e) { if (e.target === overlay) dismiss(); });
        card.appendChild(closeBtn);
        card.appendChild(iconWrap);
        card.appendChild(title);
        card.appendChild(body);
        card.appendChild(actions);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        if (root.btcSheet && root.btcSheet.setCloser) {
            try { root.btcSheet.setCloser(overlay, dismiss); } catch (e) {}
        }
        if (root.btcSheet && root.btcSheet.sync) {
            try { root.btcSheet.sync(); } catch (e) {}
        }
        try { title.focus(); } catch (e) {}
    }

    function skipPrompt() {
        setHelper(false);
        finishQueue('skip');
    }

    function consider(user, found) {
        // No user doc (or a failed load after retries): skip. Do not show
        // the prompt, and never call the age callables until sign-up has
        // created the profile.
        if (found === false || user == null) {
            skipPrompt();
            return;
        }
        if (isUnder18(user) || isBlocked(user) || isKidsAccount(user)) {
            setHelper(false);
            finishQueue('skip');
            return;
        }
        if (isConfirmed(user)) {
            setHelper(true);
            finishQueue('skip');
            return;
        }
        setHelper(false);
        if (sessionDismissed()) {
            finishQueue('skip');
            return;
        }
        var q = queue();
        if (q && typeof q.ready === 'function') q.ready('age', showModal);
        else showModal();
    }

    function loadUserDoc(uid, tries) {
        tries = tries || 0;
        try {
            if (!root.firebase || !root.firebase.firestore) {
                consider(null, false);
                return;
            }
            root.firebase.firestore().collection('users').doc(uid).get().then(function (snap) {
                if (snap && snap.exists) {
                    consider(snap.data() || {}, true);
                    return;
                }
                if (tries < 8) {
                    root.setTimeout(function () { loadUserDoc(uid, tries + 1); }, 400);
                    return;
                }
                consider(null, false);
            }).catch(function () {
                if (tries < 8) {
                    root.setTimeout(function () { loadUserDoc(uid, tries + 1); }, 400);
                    return;
                }
                consider(null, false);
            });
        } catch (e) {
            consider(null, false);
        }
    }

    function onAuthUser(user) {
        if (!user || user.isAnonymous) {
            setHelper(false);
            clearDismissed();
            closeOverlay();
            finishQueue('skip');
            return;
        }
        loadUserDoc(user.uid, 0);
    }

    function bindAuth() {
        if (waiting) return;
        try {
            if (!root.firebase || typeof root.firebase.auth !== 'function') return;
            waiting = true;
            root.firebase.auth().onAuthStateChanged(onAuthUser);
        } catch (e) {
            waiting = false;
        }
    }

    function boot() {
        setHelper(false);
        bindAuth();
        if (waiting) return;
        var n = 0;
        var timer = root.setInterval(function () {
            n++;
            bindAuth();
            if (waiting || n > 40) root.clearInterval(timer);
        }, 250);
    }

    setHelper(false);
    root.bqAgeConfirmCopy = COPY;
    root.bqAgeConfirmed18FromUser = isConfirmed;
    root.bqAgeUnder18FromUser = isUnder18;
    root.showAgeConfirmPrompt = showModal;
    root._bqDismissAgeConfirm = dismiss;

    if (root.document && (root.document.readyState === 'complete' || root.document.readyState === 'interactive')) {
        boot();
    } else if (root.document && root.document.addEventListener) {
        root.document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(typeof window !== 'undefined' ? window : this);
