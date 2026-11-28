// © 2024-2026 603BTC LLC. All rights reserved.
// Two-button age confirmation for new sign-ups and existing users at next login.
// "I'm 18 or older" calls confirmAge18, which writes over18 + over18ConfirmedAt
// (and ageConfirmed18). "I'm under 18" calls confirmAgeUnder18, which writes
// server-only ageUnder18 + ageUnder18At. Ads should keep reading the user doc
// field over18 (PR #401 hasKnownAdultAge). window._bqAgeConfirmed18 is a
// same-tab helper and stays false when the user is under 18 or dismisses.
// Dismissing asks again on the next visit; a saved under-18 answer does not.
//
// Sats need a confirmed 18+ answer (server-enforced; feat/sats-require-18plus).
// bqSatsAge18Check(user) runs before a sats action and re-shows this prompt
// when the age is unconfirmed. bqSatsAge18Handle(responseOrError) does the same
// when a payout callable answers with code age_18_required.
// The guardian step cannot be skipped: no Not now, no close button, no
// Escape, and a tab-session dismiss is ignored for a saved under-18 answer
// that still lacks the guardian checkbox.
(function (root) {
    'use strict';

    var COPY = {
        title: 'Quick age check',
        body: 'Please tell us your age group. You can keep playing either way.',
        over18: "I'm 18 or older",
        under18: "I'm under 18",
        guardian: 'My parent or guardian says it\'s OK for me to play Bitcoin Quest.',
        continueLabel: 'Continue',
        back: 'Back',
        notNow: 'Not now',
        satsRequired: "Confirm you're 18+ to earn sats.",
        satsUnder18: 'Sats are for players 18 and older.',
        satsBlocked: 'Your age confirmation needs a review. Contact support to earn sats.',
        satsThanks: "Thanks! You're confirmed. Try that again."
    };
    var SATS_CODE = 'age_18_required';

    var BUTTON_STYLE = 'min-height:44px;width:100%;padding:10px 16px;background:#334155;color:#f1f5f9;border:1px solid #64748b;border-radius:12px;font-size:0.95rem;font-weight:800;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;';

    // Lucide "badge-check". Used on the header only, not on a choice button.
    var LUCIDE_BADGE_CHECK = '<svg class="lucide-badge-check" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.78 4 4 0 0 1 0-6.74Z"></path><path d="m9 12 2 2 4-4"></path></svg>';

    var SESSION_DISMISS = 'bq_age_confirm_dismissed';
    var OVERLAY_ID = 'ageConfirmOverlay';
    var waiting = false;
    var watchTimer = null;
    var satsUserRef = null;
    var satsPromptOpen = false;

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

    function hasGuardianOk(user) {
        return !!(user && user.guardianOk === true);
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
        if (q) {
            try {
                if (kind === 'skip' && typeof q.skip === 'function') q.skip('age');
                else if (typeof q.done === 'function') q.done('age');
            } catch (e) {}
        }
        // Tell the username step the age step is fully done (confirmed or
        // dismissed), even when the onboarding queue is missing, so
        // loadUserDoc skip/retry paths still flush. Sign-out is not a
        // decision for the next account.
        try {
            var signedOut = false;
            try {
                signedOut = !(root.firebase && typeof root.firebase.auth === 'function' && root.firebase.auth().currentUser);
            } catch (eAuth) { signedOut = false; }
            if (signedOut) {
                root._bqAgeDecision = 'none';
                root._deferUntilAge = [];
                return;
            }
            root._bqAgeDecision = 'done';
            if (typeof root.flushAfterAge === 'function') root.flushAfterAge();
        } catch (eFlush) {}
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
        throttled: 'Too many tries. Wait a minute and try again.',
        denied: "You don't have permission to do that. Refresh and sign in again.",
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
        var code = codeOf(e);
        if (code === 'resource-exhausted') return MSG.throttled;
        if (code === 'permission-denied') return MSG.denied;
        if (isAppCheckError(e)) return MSG.appCheck;
        if (code === 'unavailable' || code === 'deadline-exceeded') return MSG.offline;
        return MSG.generic;
    }

    // Waits for App Check before the call, and retries once after a fresh
    // token when an early tap still loses the race. Resolves { ok, error }.
    function callAge(name, payload) {
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
                return fn(payload || {});
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

    function showModal(opts) {
        var document = root.document;
        if (!document || !document.body) return;
        if (document.getElementById(OVERLAY_ID)) return;
        var fromSats = !!(opts && opts.fromSats);
        if (otherModalOpen()) {
            if (watchTimer) return;
            watchTimer = root.setTimeout(function () {
                watchTimer = null;
                showModal(opts);
            }, 300);
            return;
        }
        satsPromptOpen = fromSats;
        // Opened from a sats action: closing it just closes it. Nothing is
        // recorded as dismissed and the onboarding queue is not touched.
        var closeFn = fromSats ? closeOverlay : dismiss;

        var overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'ageConfirmTitle');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:100040;background:rgba(15,23,42,0.72);display:flex;align-items:center;justify-content:center;padding:20px;';
        // Sats screens (claim modal, Settings) sit above 100040. Stack over them.
        if (fromSats && typeof root._bqAboveModalsZ === 'function') {
            try { overlay.style.zIndex = String(root._bqAboveModalsZ(100040)); } catch (eZ) {}
        }

        var card = document.createElement('div');
        card.style.cssText = 'position:relative;background:#1e293b;border:1px solid #334155;border-radius:20px;padding:28px 24px 22px;max-width:360px;width:100%;text-align:center;color:#e2e8f0;font-family:inherit;box-shadow:0 16px 40px rgba(15,23,42,0.45);';

        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = 'position:absolute;top:10px;right:12px;background:none;border:none;color:#94a3b8;font-size:1.4rem;line-height:1;cursor:pointer;padding:4px 8px;font-family:inherit;';
        closeBtn.addEventListener('click', closeFn);

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
        actions.id = 'ageConfirmActions';
        actions.style.cssText = 'display:flex;flex-direction:column;gap:10px;width:100%;';

        var overBtn = makeChoiceButton(document, 'ageConfirmBtn', COPY.over18);
        var underBtn = makeChoiceButton(document, 'ageUnder18Btn', COPY.under18);

        bindChoice(overBtn, COPY.over18, 'confirmAge18', function () {
            setHelper(true);
            patchProfileCache({ over18: true, ageConfirmed18: true });
            if (satsUserRef) {
                try { satsUserRef.over18 = true; satsUserRef.ageConfirmed18 = true; } catch (eU) {}
            }
            fireAgeEvent('bq-age-confirmed', { over18: true });
            var wasSats = satsPromptOpen;
            closeOverlay();
            finishQueue('done');
            if (wasSats && typeof root.showToast === 'function') root.showToast(COPY.satsThanks);
        });
        underBtn.addEventListener('click', function () {
            showGuardianStep(overlay, card, { allowBack: true });
        });

        actions.appendChild(overBtn);
        actions.appendChild(underBtn);

        overlay.addEventListener('click', function (e) { if (e.target === overlay && !overlay.getAttribute('data-age-step')) closeFn(); });
        card.appendChild(closeBtn);
        card.appendChild(iconWrap);
        card.appendChild(title);
        card.appendChild(body);
        card.appendChild(actions);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        if (root.btcSheet && root.btcSheet.setCloser) {
            try { root.btcSheet.setCloser(overlay, closeFn); } catch (e) {}
        }
        if (root.btcSheet && root.btcSheet.sync) {
            try { root.btcSheet.sync(); } catch (e) {}
        }
        try { title.focus(); } catch (e) {}

        if (opts && opts.needGuardian) {
            showGuardianStep(overlay, card, { allowBack: false });
        }
    }

    function showGuardianStep(overlay, card, stepOpts) {
        var document = root.document;
        if (!document || !card) return;
        var allowBack = !!(stepOpts && stepOpts.allowBack);
        overlay.setAttribute('data-age-step', allowBack ? 'guardian' : 'guardian-required');

        var closeBtn = null;
        var i;
        for (i = 0; i < card.children.length; i++) {
            if (card.children[i] && card.children[i].getAttribute && card.children[i].getAttribute('aria-label') === 'Close') {
                closeBtn = card.children[i];
                break;
            }
        }
        // The guardian step has no close button. Back (when offered) is the only way out.
        if (closeBtn) closeBtn.style.display = 'none';

        var actions = document.getElementById('ageConfirmActions');
        if (!actions) {
            for (i = 0; i < card.children.length; i++) {
                if (card.children[i] && card.children[i].id === 'ageConfirmActions') actions = card.children[i];
            }
        }
        // The actions div may not have an id yet; find the one that holds the choice buttons.
        if (!actions) {
            for (i = 0; i < card.children.length; i++) {
                var child = card.children[i];
                if (child && child.children) {
                    var hasUnder = false;
                    var j;
                    for (j = 0; j < child.children.length; j++) {
                        if (child.children[j] && child.children[j].id === 'ageUnder18Btn') hasUnder = true;
                    }
                    if (hasUnder) actions = child;
                }
            }
        }
        if (!actions) return;
        actions.id = 'ageConfirmActions';
        while (actions.children.length) {
            if (actions.removeChild) actions.removeChild(actions.children[0]);
            else actions.children.shift();
        }

        var boxLabel = document.createElement('label');
        boxLabel.id = 'ageGuardianOkLabel';
        boxLabel.setAttribute('for', 'ageGuardianOk');
        boxLabel.style.cssText = 'display:flex;align-items:flex-start;gap:10px;text-align:left;margin:0 0 14px;font-size:0.95rem;line-height:1.45;color:#e2e8f0;cursor:pointer;min-height:44px;';

        var box = document.createElement('input');
        box.type = 'checkbox';
        box.id = 'ageGuardianOk';
        box.checked = false;
        box.style.cssText = 'width:20px;height:20px;margin-top:2px;flex:0 0 auto;cursor:pointer;';

        var boxText = document.createElement('span');
        boxText.textContent = COPY.guardian;
        boxLabel.appendChild(box);
        boxLabel.appendChild(boxText);

        var continueBtn = makeChoiceButton(document, 'ageGuardianContinue', COPY.continueLabel);
        continueBtn.disabled = true;
        continueBtn.setAttribute('aria-disabled', 'true');

        function syncContinue() {
            var on = !!box.checked;
            continueBtn.disabled = !on;
            continueBtn.setAttribute('aria-disabled', on ? 'false' : 'true');
        }
        box.addEventListener('change', syncContinue);
        box.addEventListener('click', function () {
            // Test DOM stubs do not toggle .checked on click.
            if (box.checked === false || box.checked === true) {
                /* leave as the environment set it */
            }
            syncContinue();
        });

        var busy = false;
        continueBtn.addEventListener('click', function () {
            if (busy || !box.checked || continueBtn.disabled) return;
            busy = true;
            continueBtn.disabled = true;
            var label = continueBtn.querySelector('span');
            if (label) label.textContent = 'Saving...';
            callAge('confirmAgeUnder18', { guardianOk: true }).then(function (result) {
                if (result.ok) {
                    setHelper(false);
                    patchProfileCache({ ageUnder18: true, guardianOk: true });
                    fireAgeEvent('bq-age-under18', { ageUnder18: true, guardianOk: true });
                    closeOverlay();
                    finishQueue('done');
                } else {
                    busy = false;
                    syncContinue();
                    if (label) label.textContent = COPY.continueLabel;
                    if (typeof root.showToast === 'function') root.showToast(result.error);
                    showGuardianError(result.error);
                }
            });
        });

        actions.appendChild(boxLabel);
        actions.appendChild(continueBtn);
        if (allowBack) {
            var backBtn = makeChoiceButton(document, 'ageGuardianBack', COPY.back);
            backBtn.addEventListener('click', function () {
                var again = satsPromptOpen;
                closeOverlay();
                showModal(again ? { fromSats: true } : undefined);
            });
            actions.appendChild(backBtn);
        }

        // A save error shows the message and keeps the step open. There is no
        // Not now: the checkbox is how the player continues, and a dismiss is
        // never treated as consent or as a skip.
        function showGuardianError(msg) {
            var err = document.getElementById('ageGuardianError');
            if (!err) {
                err = document.createElement('p');
                err.id = 'ageGuardianError';
                err.setAttribute('role', 'alert');
                err.style.cssText = 'margin:10px 0 0;font-size:0.9rem;line-height:1.4;color:#fca5a5;text-align:left;';
                actions.appendChild(err);
            }
            err.textContent = msg || MSG.generic;
        }

        if (root.btcSheet && root.btcSheet.setCloser) {
            try {
                root.btcSheet.setCloser(overlay, allowBack ? function () {
                    var again = satsPromptOpen;
                    closeOverlay();
                    showModal(again ? { fromSats: true } : undefined);
                } : function () {});
            } catch (e) {}
        }
        try { box.focus(); } catch (e) {}
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
        // Kids / Classroom (including under 13) stay on that path and
        // never see this prompt. Do not change their age fields.
        if (isKidsAccount(user) || isBlocked(user)) {
            setHelper(false);
            finishQueue('skip');
            return;
        }
        if (isConfirmed(user)) {
            setHelper(true);
            finishQueue('skip');
            return;
        }
        if (isUnder18(user) && hasGuardianOk(user)) {
            setHelper(false);
            finishQueue('skip');
            return;
        }
        setHelper(false);
        // A saved under-18 answer still needs the guardian checkbox before
        // the player can continue on a regular account. Nothing can dismiss
        // it: no Not now, no Close, no Escape, and a stale session dismiss is
        // ignored. A dismiss writes nothing and never counts as consent.
        if (isUnder18(user) && !hasGuardianOk(user)) {
            // A session dismiss never skips this step (no Not now, no Escape).
            var showGuardian = function () { showModal({ needGuardian: true }); };
            var qg = queue();
            if (qg && typeof qg.ready === 'function') qg.ready('age', showGuardian);
            else showGuardian();
            return;
        }
        if (sessionDismissed()) {
            finishQueue('skip');
            return;
        }
        var q = queue();
        if (q && typeof q.ready === 'function') q.ready('age', showModal);
        else showModal();
    }

    // Username sign-ups are Firebase anonymous accounts with a server-set
    // username (RLDA-57). They get the age check too. A bare anonymous
    // guest (no username yet) is skipped until sign-up finishes; popup-stack
    // calls bqAgeConfirmRecheck from onSignedIn at that point.
    function hasUsername(user) {
        return !!(user && typeof user.username === 'string' && user.username.trim().length > 0);
    }

    function loadUserDoc(uid, tries, anon) {
        tries = tries || 0;
        try {
            if (!root.firebase || !root.firebase.firestore) {
                consider(null, false);
                return;
            }
            root.firebase.firestore().collection('users').doc(uid).get().then(function (snap) {
                if (snap && snap.exists) {
                    var data = snap.data() || {};
                    if (anon && !hasUsername(data)) {
                        consider(null, false);
                        return;
                    }
                    consider(data, true);
                    return;
                }
                if (tries < 8) {
                    root.setTimeout(function () { loadUserDoc(uid, tries + 1, anon); }, 400);
                    return;
                }
                consider(null, false);
            }).catch(function () {
                if (tries < 8) {
                    root.setTimeout(function () { loadUserDoc(uid, tries + 1, anon); }, 400);
                    return;
                }
                consider(null, false);
            });
        } catch (e) {
            consider(null, false);
        }
    }

    function onAuthUser(user) {
        if (!user) {
            try {
                root._bqAgeDecision = 'none';
                root._deferUntilAge = [];
            } catch (eClear) {}
            setHelper(false);
            clearDismissed();
            closeOverlay();
            finishQueue('skip');
            return;
        }
        try { root._bqAgeDecision = 'pending'; } catch (ePend) {}
        loadUserDoc(user.uid, 0, !!user.isAnonymous);
    }

    // Called by popup-stack's onSignedIn (username sign-up just finished).
    // Returns true when it will decide the age step asynchronously, so the
    // queue can hold the step as pending instead of running past it.
    function recheck() {
        try {
            if (!root.firebase || typeof root.firebase.auth !== 'function') return false;
            var u = root.firebase.auth().currentUser;
            if (!u || !u.isAnonymous) return false;
            var q = queue();
            if (q && typeof q.stateOf === 'function') {
                var st = q.stateOf('age');
                if (st === 'done' || st === 'showing') return false;
            }
            loadUserDoc(u.uid, 0, true);
            return true;
        } catch (e) {
            return false;
        }
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

    // ---- Sats need a confirmed 18+ answer ----------------------------------
    // The server is the real gate. These helpers only turn its answer (or a
    // stale local profile) into the right prompt, so nobody has to guess why a
    // sats action did nothing.

    function toast(msg) {
        if (typeof root.showToast === 'function') {
            try { root.showToast(msg); } catch (e) {}
        }
    }

    // null when the user may go ahead, else { reason, canConfirm, needGuardian, message }.
    function satsBlock(user) {
        if (!user) return null;
        if (isBlocked(user)) return { reason: 'blocked', canConfirm: false, needGuardian: false, message: COPY.satsBlocked };
        if (isKidsAccount(user)) return { reason: 'kids', canConfirm: false, needGuardian: false, message: COPY.satsUnder18 };
        if (isUnder18(user)) return { reason: 'under18', canConfirm: false, needGuardian: !hasGuardianOk(user), message: COPY.satsUnder18 };
        if (!isConfirmed(user)) return { reason: 'unconfirmed', canConfirm: true, needGuardian: false, message: COPY.satsRequired };
        return null;
    }

    function blockForReason(reason) {
        if (reason === 'blocked') return { reason: reason, canConfirm: false, needGuardian: false, message: COPY.satsBlocked };
        if (reason === 'under18' || reason === 'kids') return { reason: reason, canConfirm: false, needGuardian: false, message: COPY.satsUnder18 };
        return { reason: 'unconfirmed', canConfirm: true, needGuardian: false, message: COPY.satsRequired };
    }

    function promptForSats(block, user) {
        satsUserRef = user || null;
        toast(block.message);
        if (block.canConfirm) {
            clearDismissed();
            showModal({ fromSats: true });
        } else if (block.needGuardian) {
            showModal({ fromSats: true, needGuardian: true });
        }
    }

    // Call before a sats action with the signed-in user's profile. Returns true
    // when the action may continue. Returns false after toasting the reason and
    // re-showing the age prompt. No profile means the server decides (true).
    function satsAge18Check(user) {
        var block = satsBlock(user);
        if (!block) return true;
        promptForSats(block, user);
        return false;
    }

    // The age_18_required code from a payout callable: either a returned
    // { success: false, code } body or a thrown HttpsError with details.code.
    function ageCodeInfo(x) {
        if (!x || typeof x !== 'object') return null;
        if (x.code === SATS_CODE) return { reason: x.reason || '' };
        var d = x.details;
        if (d && typeof d === 'object' && d.code === SATS_CODE) return { reason: d.reason || '' };
        if (x.data && typeof x.data === 'object' && x.data.code === SATS_CODE) return { reason: x.data.reason || '' };
        return null;
    }

    function isAge18Required(x) {
        return !!ageCodeInfo(x);
    }

    // Returns true when x was an age_18_required answer (and it has been
    // handled), so the caller can skip its generic error toast.
    function satsAge18Handle(x, user) {
        var info = ageCodeInfo(x);
        if (!info) return false;
        var block = blockForReason(info.reason);
        // An unconfirmed answer from the server wins over a stale local profile.
        if (user && block.reason !== 'unconfirmed') {
            var local = satsBlock(user);
            if (local && local.needGuardian && block.reason === 'under18') block.needGuardian = true;
        }
        promptForSats(block, user);
        return true;
    }

    setHelper(false);
    root.bqAgeConfirmCopy = COPY;
    root.bqAgeConfirmed18FromUser = isConfirmed;
    root.bqAgeUnder18FromUser = isUnder18;
    root.bqSatsAge18Check = satsAge18Check;
    root.bqSatsAge18Handle = satsAge18Handle;
    root.bqIsAge18Required = isAge18Required;
    root.showAgeConfirmPrompt = showModal;
    root.bqAgeConfirmRecheck = recheck;
    root._bqDismissAgeConfirm = dismiss;

    if (root.document && (root.document.readyState === 'complete' || root.document.readyState === 'interactive')) {
        boot();
    } else if (root.document && root.document.addEventListener) {
        root.document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(typeof window !== 'undefined' ? window : this);
