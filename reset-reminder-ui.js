// Home-page opt-in for reset reminders. Switches start off.
// Push uses the existing enablePushFromTap path when that script has loaded.
// If the browser never grants permission, an open tab still toasts a due
// reminder from the same clock the server uses.
(function () {
    var LOCAL = 'btc_reset_reminders';
    var SHOWN = 'btc_reset_reminder_shown';

    function api() { return window.ResetReminders || null; }

    function signedIn() {
        return typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous;
    }

    function uid() { return signedIn() ? auth.currentUser.uid : ''; }

    function toast(msg) {
        if (typeof showToast === 'function') showToast(msg);
    }

    function zone() {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
        catch (e) { return 'UTC'; }
    }

    function readLocal() {
        try { return JSON.parse(localStorage.getItem(LOCAL) || 'null'); }
        catch (e) { return null; }
    }

    function writeLocal(prefs) {
        try { localStorage.setItem(LOCAL, JSON.stringify(prefs)); } catch (e) {}
        window._resetReminderPrefs = prefs;
    }

    function blank() {
        var lib = api();
        if (!lib) return { optedIn: false, quietStart: 22, quietEnd: 8, timeZone: zone(), items: {} };
        return lib.sanitize({ timeZone: zone() });
    }

    function current() {
        var lib = api();
        var base = readLocal() || blank();
        return lib ? lib.sanitize(base) : base;
    }

    function ensureCss() {
        if (document.getElementById('resetReminderCss')) return;
        var st = document.createElement('style');
        st.id = 'resetReminderCss';
        st.textContent = ''
            + '#resetRemindersBtn{font-family:inherit;font-size:0.72rem;font-weight:800;color:#fff;background:var(--accent,#f7931a);border:none;border-radius:999px;padding:6px 10px;min-height:32px;cursor:pointer;touch-action:manipulation;}'
            + '#resetReminderModal{position:fixed;inset:0;z-index:480000;background:var(--overlay,rgba(0,0,0,.62));display:flex;align-items:flex-end;justify-content:center;padding:12px;padding-bottom:max(12px,env(safe-area-inset-bottom));}'
            + '@media(min-width:720px){#resetReminderModal{align-items:center;}}'
            + '#resetReminderCard{width:100%;max-width:520px;max-height:min(86vh,720px);overflow:auto;background:var(--bg-side,#16161f);color:var(--text,#e2e8f0);border:1px solid var(--border,rgba(255,255,255,.08));border-radius:16px;padding:18px 16px 14px;text-align:left;}'
            + '#resetReminderCard h2{margin:0 32px 8px 0;font-size:1.15rem;}'
            + '#resetReminderCard p{margin:0 0 12px;color:var(--text-muted,#94a3b8);font-size:0.88rem;line-height:1.45;}'
            + '.rr-group{margin:14px 0 6px;font-size:0.68rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint,#64748b);}'
            + '.rr-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--border,rgba(255,255,255,.08));}'
            + '.rr-row b{display:block;font-size:0.92rem;}'
            + '.rr-row span{display:block;color:var(--text-muted,#94a3b8);font-size:0.78rem;line-height:1.35;}'
            + '.rr-hours{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0 4px;}'
            + '.rr-hours label{font-size:0.8rem;color:var(--text-muted,#94a3b8);}'
            + '.rr-hours select{font:inherit;min-height:36px;border-radius:8px;border:1px solid var(--border,#333);background:var(--card-bg,#111);color:inherit;padding:4px 8px;}'
            + '#resetReminderCard button{font-family:inherit;min-height:40px;border-radius:10px;cursor:pointer;touch-action:manipulation;}'
            + '.rr-switch{padding:6px 12px;border:1px solid var(--border,#333);background:var(--card-bg,#111);color:var(--text-muted,#94a3b8);font-weight:800;}'
            + '.rr-switch.on{background:#22c55e;color:#fff;border-color:#22c55e;}'
            + '.rr-close{position:absolute;top:8px;right:8px;width:40px;background:transparent;color:var(--text-muted,#94a3b8);border:none;font-size:1.2rem;}'
            + '.rr-card-wrap{position:relative;}';
        document.head.appendChild(st);
    }

    function hourSelect(id, value) {
        var sel = document.createElement('select');
        sel.id = id;
        var h;
        for (h = 0; h < 24; h++) {
            var opt = document.createElement('option');
            opt.value = String(h);
            var label = (h % 12 || 12) + (h < 12 ? ' AM' : ' PM');
            opt.textContent = label;
            if (h === value) opt.selected = true;
            sel.appendChild(opt);
        }
        return sel;
    }

    function groupLabel(group) {
        if (group === 'daily') return 'Daily';
        if (group === 'weekly') return 'Weekly';
        if (group === 'monthly') return 'Monthly';
        return 'Other';
    }

    function persist(prefs) {
        var lib = api();
        var clean = lib ? lib.sanitize(prefs) : prefs;
        if (lib) clean.optedIn = lib.anyOn(clean.items) === true;
        writeLocal(clean);
        if (!signedIn() || typeof db === 'undefined' || !firebase || !firebase.firestore) {
            return Promise.resolve(clean);
        }
        var userRef = db.collection('users').doc(uid());
        var subRef = db.collection('reset_reminder_subs').doc(uid());
        var userWrite = userRef.set({ resetReminders: clean }, { merge: true });
        var subWrite = clean.optedIn
            ? subRef.set(clean)
            : subRef.delete().catch(function () {});
        var prefWrite = Promise.resolve();
        if (clean.optedIn && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            prefWrite = userRef.set({
                notificationPrefs: { master: true, reminders: true }
            }, { merge: true }).catch(function () {});
        }
        return Promise.all([userWrite, subWrite, prefWrite]).then(function () { return clean; });
    }

    function render(prefs) {
        ensureCss();
        var old = document.getElementById('resetReminderModal');
        if (old) old.remove();
        var lib = api();
        var catalog = (lib && lib.CATALOG) || [];
        var overlay = document.createElement('div');
        overlay.id = 'resetReminderModal';
        var card = document.createElement('div');
        card.id = 'resetReminderCard';
        card.className = 'rr-card-wrap';
        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'rr-close';
        close.setAttribute('aria-label', 'Close');
        close.textContent = '×';
        close.addEventListener('click', function () { overlay.remove(); });
        var title = document.createElement('h2');
        title.textContent = 'Reminder resets';
        var copy = document.createElement('p');
        copy.textContent = 'Each reset starts off. Turn on only the ones you want. A reminder is sent about an hour before that reset, and never during quiet hours. If this browser blocks push, the reminder still shows in the app while you have it open.';
        card.appendChild(close);
        card.appendChild(title);
        card.appendChild(copy);
        if (!signedIn()) {
            var need = document.createElement('p');
            need.textContent = 'Sign in to save these on your account.';
            card.appendChild(need);
        }
        var hours = document.createElement('div');
        hours.className = 'rr-hours';
        var startLab = document.createElement('label');
        startLab.textContent = 'Quiet from';
        startLab.htmlFor = 'rrQuietStart';
        var endLab = document.createElement('label');
        endLab.textContent = 'until';
        endLab.htmlFor = 'rrQuietEnd';
        var startSel = hourSelect('rrQuietStart', prefs.quietStart);
        var endSel = hourSelect('rrQuietEnd', prefs.quietEnd);
        startLab.appendChild(document.createTextNode(' '));
        hours.appendChild(startLab);
        hours.appendChild(startSel);
        hours.appendChild(endLab);
        hours.appendChild(endSel);
        card.appendChild(hours);
        var zoneNote = document.createElement('p');
        zoneNote.textContent = 'Quiet hours use ' + (prefs.timeZone || zone()) + '. Set both times the same to allow reminders all day.';
        card.appendChild(zoneNote);

        var lastGroup = '';
        catalog.forEach(function (item) {
            if (item.group !== lastGroup) {
                lastGroup = item.group;
                var heading = document.createElement('div');
                heading.className = 'rr-group';
                heading.textContent = groupLabel(item.group);
                card.appendChild(heading);
            }
            var row = document.createElement('div');
            row.className = 'rr-row';
            var text = document.createElement('div');
            var name = document.createElement('b');
            name.textContent = item.title;
            var detail = document.createElement('span');
            detail.textContent = item.body;
            text.appendChild(name);
            text.appendChild(detail);
            var on = prefs.items && prefs.items[item.id] === true;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rr-switch' + (on ? ' on' : '');
            btn.textContent = on ? 'On' : 'Off';
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            btn.addEventListener('click', function () {
                if (!signedIn()) {
                    toast('Sign in to save reminder resets');
                    if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
                    return;
                }
                var next = current();
                next.timeZone = zone();
                next.quietStart = parseInt(startSel.value, 10);
                next.quietEnd = parseInt(endSel.value, 10);
                next.items[item.id] = next.items[item.id] !== true;
                persist(next).then(function (saved) {
                    render(saved);
                    toast(saved.items[item.id] ? (item.title + ' reminder on') : (item.title + ' reminder off'));
                }).catch(function () {
                    toast('Could not save that reminder');
                });
            });
            row.appendChild(text);
            row.appendChild(btn);
            card.appendChild(row);
        });

        function saveHours() {
            var next = current();
            next.timeZone = zone();
            next.quietStart = parseInt(startSel.value, 10);
            next.quietEnd = parseInt(endSel.value, 10);
            persist(next).catch(function () { toast('Could not save quiet hours'); });
        }
        startSel.addEventListener('change', saveHours);
        endSel.addEventListener('change', saveHours);

        overlay.appendChild(card);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.remove();
        });
        document.body.appendChild(overlay);
    }

    function loadRemote() {
        if (!signedIn() || typeof db === 'undefined') return Promise.resolve(current());
        return db.collection('users').doc(uid()).get().then(function (snap) {
            var data = snap.exists ? (snap.data() || {}) : {};
            if (data.resetReminders) {
                var lib = api();
                var clean = lib ? lib.sanitize(data.resetReminders) : data.resetReminders;
                if (!clean.timeZone || clean.timeZone === 'UTC') clean.timeZone = zone();
                writeLocal(clean);
                return clean;
            }
            return current();
        }).catch(function () { return current(); });
    }

    function ensurePushScript() {
        if (typeof window.enablePushFromTap === 'function') return Promise.resolve();
        if (document.querySelector('script[src^="/notifications.js"]')) {
            return waitForPush(4000);
        }
        var s = document.createElement('script');
        s.src = '/notifications.js?v=20261106_v2512';
        s.async = true;
        document.body.appendChild(s);
        return waitForPush(4000);
    }

    function waitForPush(ms) {
        return new Promise(function (resolve) {
            var start = Date.now();
            (function tick() {
                if (typeof window.enablePushFromTap === 'function' || Date.now() - start > ms) resolve();
                else setTimeout(tick, 50);
            })();
        });
    }

    function openPanel() {
        loadRemote().then(function (prefs) {
            prefs.timeZone = prefs.timeZone && prefs.timeZone !== 'UTC' ? prefs.timeZone : zone();
            render(prefs);
        });
        if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
        ensurePushScript().then(function () {
            if (typeof window.enablePushFromTap === 'function') window.enablePushFromTap();
        });
    }

    window.openResetReminders = openPanel;

    function bind() {
        ensureCss();
        var btn = document.getElementById('resetRemindersBtn');
        if (btn && !btn._rr) {
            btn._rr = true;
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                openPanel();
            });
        }
        if (location.hash === '#reset-reminders') openPanel();
    }

    function shownMap() {
        try { return JSON.parse(localStorage.getItem(SHOWN) || '{}') || {}; }
        catch (e) { return {}; }
    }

    function markShown(key) {
        var map = shownMap();
        map[key] = Date.now();
        var keys = Object.keys(map);
        if (keys.length > 40) delete map[keys[0]];
        try { localStorage.setItem(SHOWN, JSON.stringify(map)); } catch (e) {}
    }

    function localTick() {
        var lib = api();
        if (!lib) return;
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') return;
        var prefs = current();
        if (prefs.optedIn !== true) return;
        var user = { resetReminders: prefs };
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.lastSatsClaim) {
            user.lastSatsClaim = currentUser.lastSatsClaim;
        }
        var due = lib.dueForUser(Date.now(), user);
        var seen = shownMap();
        due.forEach(function (hit) {
            if (seen[hit.occurrenceKey]) return;
            markShown(hit.occurrenceKey);
            toast(hit.title + '. ' + hit.body);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
    else bind();
    setInterval(localTick, 60000);
    setTimeout(localTick, 4000);
})();
