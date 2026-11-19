/* Shared badge/title popover. Hover, tap, and keyboard focus. No inline handlers. */
(function (root) {
    if (!root || root._bqBadgePopoverInstalled) return;
    root._bqBadgePopoverInstalled = true;

    var hideTimer = null;
    var currentId = '';

    function entryOf(id) {
        if (root.BQBadgeIndex && typeof root.BQBadgeIndex.get === 'function') return root.BQBadgeIndex.get(id);
        return null;
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function ensure() {
        var el = document.getElementById('bqBadgePopover');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'bqBadgePopover';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'false');
        el.hidden = true;
        el.style.cssText = 'position:fixed;z-index:400010;display:none;max-width:min(280px,calc(100vw - 24px));background:#1a1a2e;border:1px solid var(--accent,#f7931a);color:var(--text,#e2e8f0);padding:12px 14px;border-radius:12px;font-size:0.8rem;line-height:1.45;box-shadow:0 8px 32px rgba(0,0,0,0.85);';
        document.body.appendChild(el);
        return el;
    }
    function isOwnCore(anchor) {
        if (!anchor || anchor.getAttribute('data-bq-badge') !== 'core_contributor') return false;
        if (anchor.getAttribute('data-bq-own') === '1') return true;
        try {
            var uid = anchor.getAttribute('data-bq-uid') || '';
            return !!(root.auth && root.auth.currentUser && uid && root.auth.currentUser.uid === uid);
        } catch (e) { return false; }
    }
    function fill(el, entry, anchor) {
        var html = '<div style="font-weight:800;font-size:0.95rem;margin-bottom:6px;">' +
            esc((entry.emoji ? entry.emoji + ' ' : '') + entry.name) + '</div>';
        html += '<div>' + esc(entry.desc) + '</div>';
        if (entry.how && entry.how !== entry.desc) {
            html += '<div style="margin-top:8px;color:var(--text-muted,#94a3b8);"><strong>How to earn it.</strong> ' + esc(entry.how) + '</div>';
        }
        if (isOwnCore(anchor) && typeof currentUser !== 'undefined' && currentUser && Number(currentUser.coreContributorUntil) > Date.now()) {
            var on = currentUser.showCoreContributor !== false;
            html += '<label style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer;">' +
                '<input type="checkbox" id="bqShowCorePop"' + (on ? ' checked' : '') + '>' +
                '<span>Show Core Contributor</span></label>';
        }
        el.innerHTML = html;
        var box = el.querySelector('#bqShowCorePop');
        if (box) {
            box.addEventListener('change', function () {
                if (typeof root._setShowCoreContributor === 'function') root._setShowCoreContributor(box.checked);
            });
        }
    }
    function place(el, anchor, ev) {
        var vw = window.innerWidth || 320;
        var vh = window.innerHeight || 480;
        var tw = el.offsetWidth || 240;
        var th = el.offsetHeight || 80;
        var x = 12, y = 12;
        if (ev && (ev.clientX || ev.clientY)) {
            x = ev.clientX - tw / 2;
            y = ev.clientY - th - 12;
        } else if (anchor && anchor.getBoundingClientRect) {
            var r = anchor.getBoundingClientRect();
            x = r.left + r.width / 2 - tw / 2;
            y = r.top - th - 8;
            if (y < 8) y = r.bottom + 8;
        }
        x = Math.max(8, Math.min(x, vw - tw - 8));
        y = Math.max(8, Math.min(y, vh - th - 8));
        el.style.left = x + 'px';
        el.style.top = y + 'px';
    }
    function show(anchor, ev) {
        var id = anchor && anchor.getAttribute('data-bq-badge');
        var entry = entryOf(id);
        if (!entry) return;
        clearTimeout(hideTimer);
        hideTimer = null;
        currentId = id;
        var el = ensure();
        fill(el, entry, anchor);
        el.hidden = false;
        el.style.display = 'block';
        place(el, anchor, ev);
        el.setAttribute('data-bq-open-id', id);
    }
    function hide() {
        var el = document.getElementById('bqBadgePopover');
        if (!el) return;
        el.style.display = 'none';
        el.hidden = true;
        currentId = '';
    }
    function scheduleHide() {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hide, 220);
    }
    function cancelHide() {
        clearTimeout(hideTimer);
        hideTimer = null;
    }

    document.addEventListener('pointerover', function (e) {
        var a = e.target && e.target.closest && e.target.closest('[data-bq-badge]');
        var pop = document.getElementById('bqBadgePopover');
        if (pop && pop.contains(e.target)) { cancelHide(); return; }
        if (!a) return;
        if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) show(a, e);
    });
    document.addEventListener('pointerout', function (e) {
        var pop = document.getElementById('bqBadgePopover');
        var to = e.relatedTarget;
        if (pop && to && pop.contains(to)) { cancelHide(); return; }
        var a = e.target && e.target.closest && e.target.closest('[data-bq-badge]');
        if (a || (pop && pop.contains(e.target))) scheduleHide();
    });
    document.addEventListener('focusin', function (e) {
        var a = e.target && e.target.closest && e.target.closest('[data-bq-badge]');
        if (a) show(a, e);
    });
    document.addEventListener('focusout', function (e) {
        var pop = document.getElementById('bqBadgePopover');
        var to = e.relatedTarget;
        if (pop && to && (pop.contains(to) || (to.closest && to.closest('[data-bq-badge]')))) return;
        scheduleHide();
    });
    document.addEventListener('click', function (e) {
        var a = e.target && e.target.closest && e.target.closest('[data-bq-badge]');
        var pop = document.getElementById('bqBadgePopover');
        if (a) {
            e.preventDefault();
            var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
            if (!fine && pop && pop.style.display === 'block' && pop.getAttribute('data-bq-open-id') === a.getAttribute('data-bq-badge')) {
                hide();
                return;
            }
            show(a, e);
            return;
        }
        if (pop && pop.contains(e.target)) {
            cancelHide();
            return;
        }
        hide();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') hide();
        if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.closest && e.target.closest('[data-bq-badge]')) {
            e.preventDefault();
            show(e.target.closest('[data-bq-badge]'), e);
        }
    });
    document.addEventListener('change', function (e) {
        if (e.target && e.target.id === 'tfShowCore') {
            if (typeof root._setShowCoreContributor === 'function') root._setShowCoreContributor(!!e.target.checked);
        }
    });

    root._bqHideBadgePopover = hide;
    root._setShowCoreContributor = function (on) {
        if (typeof currentUser === 'undefined' || !currentUser) return;
        if (typeof auth === 'undefined' || !auth.currentUser || auth.currentUser.isAnonymous) return;
        currentUser.showCoreContributor = !!on;
        if (typeof db !== 'undefined' && db) {
            db.collection('users').doc(auth.currentUser.uid).update({ showCoreContributor: !!on }).catch(function () {});
        }
        if (typeof showToast === 'function') showToast(on ? 'Core Contributor is visible' : 'Core Contributor is hidden');
        if (typeof root._tfRepaint === 'function') root._tfRepaint();
        var pill = document.getElementById('settingsTitlePill');
        if (pill && typeof root._tfTitleDef === 'function') {
            /* updated on repaint in ranking */
        }
        if (typeof updateRankUI === 'function') try { updateRankUI(); } catch (err) {}
        var box = document.getElementById('tfShowCore');
        if (box) box.checked = !!on;
        var popBox = document.getElementById('bqShowCorePop');
        if (popBox) popBox.checked = !!on;
    };
})(typeof window !== 'undefined' ? window : this);
