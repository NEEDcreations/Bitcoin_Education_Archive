// © 2024-2026 603BTC LLC. All rights reserved.
// One-tap 18+ confirmation for new sign-ups and existing users at next login.
// The server callable confirmAge18 writes over18 + over18ConfirmedAt (and
// ageConfirmed18). Ads should keep reading the user doc field over18
// (PR #401 hasKnownAdultAge). window._bqAgeConfirmed18 is a same-tab helper.
(function (root) {
    'use strict';

    var COPY = {
        title: 'Quick check',
        body: 'Bitcoin Quest is for adults 18 and older.',
        button: "I'm 18 or older"
    };

    // Lucide "badge-check".
    var LUCIDE_BADGE_CHECK = '<svg class="lucide-badge-check" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.78 4 4 0 0 1 0-6.74Z"></path><path d="m9 12 2 2 4-4"></path></svg>';

    var SESSION_DISMISS = 'bq_age_confirm_dismissed';
    var OVERLAY_ID = 'ageConfirmOverlay';
    var waiting = false;
    var watchTimer = null;

    function isConfirmed(user) {
        if (!user) return false;
        return user.over18 === true || user.ageConfirmed18 === true;
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
        title.textContent = COPY.title;
        title.style.cssText = 'margin:0 0 8px;font-size:1.25rem;font-weight:800;color:#f1f5f9;';

        var body = document.createElement('p');
        body.textContent = COPY.body;
        body.style.cssText = 'margin:0 0 20px;font-size:0.95rem;line-height:1.45;color:#e2e8f0;';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'ageConfirmBtn';
        btn.style.cssText = 'min-height:44px;width:100%;padding:10px 16px;background:#f7931a;color:#0f172a;border:none;border-radius:12px;font-size:0.95rem;font-weight:800;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;gap:8px;';
        btn.innerHTML = LUCIDE_BADGE_CHECK + '<span></span>';
        btn.querySelector('span').textContent = COPY.button;

        var busy = false;
        btn.addEventListener('click', function () {
            if (busy) return;
            busy = true;
            btn.disabled = true;
            var label = btn.querySelector('span');
            if (label) label.textContent = 'Saving...';
            confirmOnServer().then(function (ok) {
                if (ok) {
                    setHelper(true);
                    patchProfileCache({ over18: true, ageConfirmed18: true });
                    try {
                        if (typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') {
                            root.dispatchEvent(new root.CustomEvent('bq-age-confirmed', { detail: { over18: true } }));
                        }
                    } catch (e) {}
                    closeOverlay();
                    finishQueue('done');
                } else {
                    busy = false;
                    btn.disabled = false;
                    if (label) label.textContent = COPY.button;
                    if (typeof root.showToast === 'function') root.showToast('Error saving. Please try again.');
                }
            });
        });

        overlay.addEventListener('click', function (e) { if (e.target === overlay) dismiss(); });
        card.appendChild(closeBtn);
        card.appendChild(iconWrap);
        card.appendChild(title);
        card.appendChild(body);
        card.appendChild(btn);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        if (root.btcSheet && root.btcSheet.setCloser) {
            try { root.btcSheet.setCloser(overlay, dismiss); } catch (e) {}
        }
        if (root.btcSheet && root.btcSheet.sync) {
            try { root.btcSheet.sync(); } catch (e) {}
        }
        try { btn.focus(); } catch (e) {}
    }

    function confirmOnServer() {
        function fail() { return Promise.resolve(false); }
        try {
            if (!root.firebase || !root.firebase.functions) return fail();
            var fn = root.firebase.functions().httpsCallable('confirmAge18');
            return Promise.resolve(fn({})).then(function (res) {
                var data = (res && res.data) || {};
                return data.success === true || data.over18 === true || data.ageConfirmed18 === true;
            }).catch(function () { return false; });
        } catch (e) {
            return fail();
        }
    }

    function skipPrompt() {
        setHelper(false);
        finishQueue('skip');
    }

    function consider(user, found) {
        // No user doc (or a failed load after retries): skip. Do not show
        // the prompt, and never call confirmAge18 until sign-up has created
        // the profile.
        if (found === false || user == null) {
            skipPrompt();
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
