// Admin tools panel. Lazy-loaded by ranking.js only after the signed-in
// account's Firebase custom claim admin === true is re-read. Non-admins never
// download this file. It holds no admin data and grants nothing: every tile
// opens an existing admin screen, and every admin action is still checked on
// the server (context.auth.token.admin === true).
(function () {
    'use strict';

    var QUESTS_SRC = '/quests.js?v=20261109_v2542';

    function isAdmin() { return window._isAdminClaim === true; }

    function closeAll() {
        if (typeof window.bqCloseAdminPanel === 'function') window.bqCloseAdminPanel();
    }

    function goView(id) {
        if (typeof window.go === 'function') { window.go(id); return; }
        try { location.hash = id; } catch (e) {}
    }

    function openQuestHubFavor() {
        if (typeof window.showQuestHub === 'function') { window.showQuestHub('favor'); return; }
        var s = document.createElement('script');
        s.src = QUESTS_SRC;
        s.async = true;
        s.onload = function () {
            if (typeof window.showQuestHub === 'function') window.showQuestHub('favor');
        };
        document.head.appendChild(s);
    }

    function openChat() {
        if (typeof window.openGlobalChatForCipher === 'function') { window.openGlobalChatForCipher(); return; }
        if (typeof window.toggleChatOverlay === 'function') { window.toggleChatOverlay(); return; }
        goView('chat');
    }

    function settings(id) {
        return function () {
            if (typeof window.openSettingsAdminSection === 'function') window.openSettingsAdminSection(id);
        };
    }

    // Each tool: what it is, a one-line tip (always visible), and a short
    // "how" line that the (i) button shows on tap or hover.
    var GROUPS = [
        {
            title: 'Safety',
            tools: [
                {
                    id: 'killSwitch', icon: '\uD83D\uDED1', name: 'Kill switch',
                    tip: 'Take the app offline for everyone, then bring it back.',
                    how: 'Checks that a recent backup exists (a stale backup warns, never blocks), asks you to type OFFLINE and a reason, then flips first and starts a database snapshot. You can still use Admin tools while it is off.',
                    open: openKillSwitch
                }
            ]
        },
        {
            title: 'Payouts',
            tools: [
                {
                    id: 'cipherWins', icon: '\uD83D\uDD10', name: 'Cipher sats wins',
                    tip: 'See every cipher sats win and mark it paid once the sats are sent.',
                    how: 'Opens Settings \u203A Account \u203A Admin. Red "Flagged" wins are banned or sats-disabled accounts, so don\u2019t pay those.',
                    open: settings('cipherWinsAdmin')
                },
                {
                    id: 'factionPrize', icon: '\uD83C\uDFC6', name: 'Faction race payouts',
                    tip: 'Check the winners\u2019 and losers\u2019 pots, then approve the race payout.',
                    how: 'Preview only while a race is open. After it ends, tap Approve & pay. Players then claim their own sats.',
                    open: settings('factionPrizeAdmin')
                },
                {
                    id: 'faucetAbuse', icon: '\uD83D\uDEB0', name: 'Faucet abuse reports',
                    tip: 'Review accounts flagged for farming sats and ban the ones that are.',
                    how: 'The report updates daily at 8 AM ET (13:00 UTC). It shows display names only. Ban uses your admin sign-in.',
                    open: settings('faucetAbuseAdmin')
                },
                {
                    id: 'factionBackfill', icon: '\uD83D\uDC1D', name: 'Faction totals recount',
                    tip: 'Recount Cyber Hornets vs Honey Badgers if the scoreboard looks wrong.',
                    how: 'Opens Quest Hub \u203A Satoshi\u2019s Favor. The Backfill button is under the faction scoreboard.',
                    open: openQuestHubFavor
                }
            ]
        },
        {
            title: 'Moderation',
            tools: [
                {
                    id: 'chat', icon: '\uD83D\uDCAC', name: 'Global Chat',
                    tip: 'Pin, unpin, or delete any message in Global Chat.',
                    how: 'Open a message\u2019s menu to pin or delete it. A pinned message shows at the top for everyone.',
                    open: openChat
                },
                {
                    id: 'forum', icon: '\uD83D\uDDE3\uFE0F', name: 'Forum',
                    tip: 'Delete any post or reply, and pin important articles.',
                    how: 'Delete and Pin buttons appear on every post and article for admins.',
                    open: function () { goView('forum'); }
                },
                {
                    id: 'topics', icon: '\uD83D\uDCDD', name: 'Topic discussions',
                    tip: 'See how many times a post was reported, then hide it or bring it back.',
                    how: 'Open any topic\u2019s discussion. Hidden posts stay visible to you, marked hidden.',
                    open: function () { goView('home'); if (typeof window.showToast === 'function') window.showToast('Open any topic, then its discussion'); }
                },
                {
                    id: 'market', icon: '\uD83D\uDED2', name: 'Marketplace',
                    tip: 'Remove any listing that breaks the marketplace rules.',
                    how: 'Open a listing. Admins see Delete on every listing, not just their own.',
                    open: function () { goView('marketplace'); }
                },
                {
                    id: 'beats', icon: '\uD83C\uDFB5', name: 'Bitcoin Beats',
                    tip: 'Delete any track or comment on Bitcoin Beats.',
                    how: 'Open a track\u2019s \u22EF menu for Delete. Comments show a delete button for admins.',
                    open: function () { goView('bitcoin-beats'); }
                }
            ]
        }
    ];

    var CSS =
        '#bqAdminPanel{position:fixed;inset:0;z-index:470000;display:flex;align-items:flex-end;justify-content:center;background:rgba(2,6,23,0.62);}' +
        '#bqAdminPanel .bap-sheet{width:100%;max-width:560px;max-height:88vh;overflow-y:auto;-webkit-overflow-scrolling:touch;box-sizing:border-box;background:var(--bg,#0b1220);color:var(--text,#e2e8f0);border:1px solid var(--border,#334155);border-radius:20px 20px 0 0;padding:16px 14px calc(16px + env(safe-area-inset-bottom,0px));box-shadow:0 -10px 40px rgba(0,0,0,0.4);font-family:inherit;}' +
        '@media (min-width:700px){#bqAdminPanel{align-items:center;}#bqAdminPanel .bap-sheet{border-radius:20px;padding:20px;}}' +
        '#bqAdminPanel .bap-head{display:flex;align-items:center;gap:10px;margin-bottom:4px;}' +
        '#bqAdminPanel .bap-title{font-size:1.25rem;font-weight:900;color:var(--heading,#fff);flex:1;}' +
        '#bqAdminPanel .bap-x{width:44px;height:44px;border-radius:12px;border:1px solid var(--border,#334155);background:transparent;color:var(--text,#e2e8f0);font-size:1.2rem;cursor:pointer;}' +
        '#bqAdminPanel .bap-note{font-size:0.78rem;color:var(--text-muted,#94a3b8);margin:0 0 12px;line-height:1.4;}' +
        '#bqAdminPanel .bap-group{font-size:0.7rem;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#f7931a;margin:14px 2px 8px;}' +
        '#bqAdminPanel .bap-row{display:flex;align-items:stretch;gap:8px;margin-bottom:8px;}' +
        '#bqAdminPanel .bap-tile{flex:1;min-width:0;display:flex;align-items:center;gap:12px;min-height:64px;padding:10px 12px;border-radius:14px;border:1px solid var(--border,#334155);background:var(--card-bg,#111827);color:inherit;text-align:left;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;}' +
        '#bqAdminPanel .bap-tile:hover,#bqAdminPanel .bap-tile:focus-visible{border-color:#f7931a;outline:none;}' +
        '#bqAdminPanel .bap-ico{font-size:1.5rem;flex-shrink:0;width:32px;text-align:center;}' +
        '#bqAdminPanel .bap-txt{display:flex;flex-direction:column;min-width:0;}' +
        '#bqAdminPanel .bap-name{font-size:0.98rem;font-weight:800;color:var(--heading,#fff);}' +
        '#bqAdminPanel .bap-tip{font-size:0.8rem;color:var(--text-muted,#94a3b8);line-height:1.35;margin-top:2px;}' +
        '#bqAdminPanel .bap-how{display:none;font-size:0.76rem;line-height:1.4;color:var(--text,#e2e8f0);background:rgba(247,147,26,0.10);border:1px solid rgba(247,147,26,0.35);border-radius:10px;padding:8px 10px;margin:-2px 0 10px;}' +
        '#bqAdminPanel .bap-how[data-open="1"]{display:block;}' +
        '#bqAdminPanel .bap-i{width:44px;flex-shrink:0;border-radius:14px;border:1px solid var(--border,#334155);background:transparent;color:#f7931a;font-size:1.05rem;font-weight:900;cursor:pointer;font-family:inherit;}' +
        '#bqAdminPanel .bap-i[aria-expanded="true"]{background:rgba(247,147,26,0.15);border-color:#f7931a;}' +
        '[data-theme="light"] #bqAdminPanel .bap-sheet{background:#f8fafc;color:#0f172a;border-color:#cbd5e1;}' +
        '[data-theme="light"] #bqAdminPanel .bap-title,[data-theme="light"] #bqAdminPanel .bap-name{color:#0f172a;}' +
        '[data-theme="light"] #bqAdminPanel .bap-tile{background:#fff;border-color:#e2e8f0;}' +
        '[data-theme="light"] #bqAdminPanel .bap-tip,[data-theme="light"] #bqAdminPanel .bap-note{color:#475569;}' +
        '[data-theme="light"] #bqAdminPanel .bap-how{color:#0f172a;}' +
        '[data-theme="light"] #bqAdminPanel .bap-x{color:#0f172a;border-color:#cbd5e1;}';

    var KSCSS =
        '#bqKillSwitchUi{position:fixed;inset:0;z-index:480000;display:flex;align-items:flex-end;justify-content:center;background:rgba(2,6,23,0.72);}' +
        '@media (min-width:700px){#bqKillSwitchUi{align-items:center;}}' +
        '#bqKillSwitchUi .ksu-sheet{width:100%;max-width:560px;max-height:92vh;overflow-y:auto;-webkit-overflow-scrolling:touch;box-sizing:border-box;background:var(--bg,#0b1220);color:var(--text,#e2e8f0);border:1px solid var(--border,#334155);border-radius:20px 20px 0 0;padding:16px 14px calc(16px + env(safe-area-inset-bottom,0px));font-family:inherit;}' +
        '@media (min-width:700px){#bqKillSwitchUi .ksu-sheet{border-radius:20px;padding:20px;}}' +
        '#bqKillSwitchUi h2{margin:0;font-size:1.2rem;font-weight:900;flex:1;}' +
        '#bqKillSwitchUi .ksu-head{display:flex;align-items:center;gap:10px;margin-bottom:8px;}' +
        '#bqKillSwitchUi .ksu-x{width:44px;height:44px;border-radius:12px;border:1px solid var(--border,#334155);background:transparent;color:inherit;font-size:1.2rem;cursor:pointer;}' +
        '#bqKillSwitchUi p,#bqKillSwitchUi li{font-size:0.88rem;line-height:1.45;margin:0 0 8px;}' +
        '#bqKillSwitchUi .ok{color:#86efac;}' +
        '#bqKillSwitchUi .warn{color:#fbbf24;}' +
        '#bqKillSwitchUi .bad{color:#fca5a5;}' +
        '#bqKillSwitchUi label{display:block;font-size:0.8rem;font-weight:700;margin:10px 0 4px;}' +
        '#bqKillSwitchUi input,#bqKillSwitchUi textarea,#bqKillSwitchUi select{width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid var(--border,#334155);background:var(--input-bg,#0b1220);color:inherit;font-family:inherit;}' +
        '#bqKillSwitchUi .ksu-row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;}' +
        '#bqKillSwitchUi .ksu-go{flex:1;min-height:44px;border:0;border-radius:12px;background:#b91c1c;color:#fff;font-weight:800;cursor:pointer;font-family:inherit;}' +
        '#bqKillSwitchUi .ksu-go.on{background:#15803d;}' +
        '#bqKillSwitchUi .ksu-cancel{min-height:44px;padding:0 14px;border-radius:12px;border:1px solid var(--border,#334155);background:transparent;color:inherit;cursor:pointer;font-family:inherit;}' +
        '#bqKillSwitchUi .ksu-status{font-size:0.82rem;color:var(--text-muted,#94a3b8);min-height:18px;margin-top:8px;}';

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    var lastFocus = null;

    function onKey(ev) {
        if (ev.key === 'Escape') closeAll();
    }

    window.bqCloseAdminPanel = function () {
        var root = document.getElementById('bqAdminPanel');
        if (root && root.parentNode) root.parentNode.removeChild(root);
        document.removeEventListener('keydown', onKey);
        if (lastFocus && typeof lastFocus.focus === 'function') { try { lastFocus.focus(); } catch (e) {} }
        lastFocus = null;
    };

    window.bqOpenAdminPanel = function () {
        if (!isAdmin()) { closeAll(); return; }
        if (document.getElementById('bqAdminPanel')) return;
        if (!document.getElementById('bqAdminPanelCss')) {
            var st = document.createElement('style');
            st.id = 'bqAdminPanelCss';
            st.textContent = CSS;
            document.head.appendChild(st);
        }
        lastFocus = document.activeElement;
        var root = el('div');
        root.id = 'bqAdminPanel';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-labelledby', 'bqAdminPanelTitle');
        root.addEventListener('click', function (ev) { if (ev.target === root) closeAll(); });

        var sheet = el('div', 'bap-sheet');
        var head = el('div', 'bap-head');
        var title = el('div', 'bap-title', '\uD83D\uDEE1\uFE0F Admin tools');
        title.id = 'bqAdminPanelTitle';
        var x = el('button', 'bap-x', '\u2715');
        x.type = 'button';
        x.setAttribute('aria-label', 'Close admin tools');
        x.addEventListener('click', closeAll);
        head.appendChild(title);
        head.appendChild(x);
        sheet.appendChild(head);
        sheet.appendChild(el('p', 'bap-note',
            'Only admin accounts see this. Tap a tool to open it, or tap \u24D8 for how it works. The server checks your admin access again on every action.'));

        GROUPS.forEach(function (g) {
            sheet.appendChild(el('div', 'bap-group', g.title));
            g.tools.forEach(function (t) {
                var row = el('div', 'bap-row');
                var tile = el('button', 'bap-tile');
                tile.type = 'button';
                tile.setAttribute('data-tool', t.id);
                tile.title = t.tip;
                var ico = el('span', 'bap-ico', t.icon);
                ico.setAttribute('aria-hidden', 'true');
                var txt = el('span', 'bap-txt');
                txt.appendChild(el('span', 'bap-name', t.name));
                txt.appendChild(el('span', 'bap-tip', t.tip));
                tile.appendChild(ico);
                tile.appendChild(txt);
                tile.addEventListener('click', function () {
                    if (!isAdmin()) { closeAll(); return; }
                    closeAll();
                    try { t.open(); } catch (e) {}
                });
                var how = el('div', 'bap-how', t.how);
                how.id = 'bapHow_' + t.id;
                var info = el('button', 'bap-i', '\u24D8');
                info.type = 'button';
                info.title = t.how;
                info.setAttribute('aria-label', 'How ' + t.name + ' works');
                info.setAttribute('aria-expanded', 'false');
                info.setAttribute('aria-controls', how.id);
                info.addEventListener('click', function () {
                    var open = how.getAttribute('data-open') === '1';
                    how.setAttribute('data-open', open ? '0' : '1');
                    info.setAttribute('aria-expanded', open ? 'false' : 'true');
                });
                row.appendChild(tile);
                row.appendChild(info);
                sheet.appendChild(row);
                sheet.appendChild(how);
            });
        });

        root.appendChild(sheet);
        document.body.appendChild(root);
        document.addEventListener('keydown', onKey);
        var first = sheet.querySelector('.bap-tile');
        if (first) { try { first.focus({ preventScroll: true }); } catch (e) {} }
    };


    function escapeHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function closeKillSwitchUi() {
        var el = document.getElementById('bqKillSwitchUi');
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    function callKillSwitch(payload) {
        if (typeof firebase === 'undefined' || !firebase.functions) {
            return Promise.reject(new Error('Functions are not ready. Refresh and try again.'));
        }
        return firebase.functions().httpsCallable('adminSetKillSwitch')(payload).then(function (res) {
            return (res && res.data) || {};
        });
    }

    function renderChecks(preflight) {
        if (!preflight || !preflight.checks) return '<p>Checking backups\u2026</p>';
        var items = preflight.checks.map(function (c) {
            var cls = c.skipped ? '' : (c.ok ? 'ok' : 'warn');
            var mark = c.skipped ? '\u2014' : (c.ok ? '\u2713' : '!');
            return '<li class="' + cls + '">' + escapeHtml(mark + ' ' + c.label + ': ' + (c.detail || '')) + '</li>';
        }).join('');
        var head = preflight.ok
            ? '<p class="ok">Backups look current.</p>'
            : '<p class="warn">A backup check failed. You can still go offline \u2014 a stale backup is a warning, not a block.</p>';
        return head + '<ul style="padding-left:18px;margin:0 0 10px;">' + items + '</ul>';
    }

    function renderSnapshot(snap) {
        if (!snap) return '<p>No snapshot yet.</p>';
        var st = snap.status || 'unknown';
        var cls = st === 'SUCCESS' ? 'ok' : (st === 'FAILED' || st === 'START_FAILED' ? 'bad' : '');
        var line = 'Snapshot: ' + st;
        if (snap.operationName) line += ' (operation ' + snap.operationName.split('/').pop() + ')';
        if (snap.error) line += ' \u2014 ' + snap.error;
        return '<p class="' + cls + '">' + escapeHtml(line) + '</p>';
    }

    function openKillSwitch() {
        if (!isAdmin()) return;
        closeKillSwitchUi();
        if (!document.getElementById('bqKillSwitchUiCss')) {
            var st = document.createElement('style');
            st.id = 'bqKillSwitchUiCss';
            st.textContent = KSCSS;
            document.head.appendChild(st);
        }
        var root = document.createElement('div');
        root.id = 'bqKillSwitchUi';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-labelledby', 'bqKillSwitchTitle');
        var sheet = document.createElement('div');
        sheet.className = 'ksu-sheet';
        sheet.innerHTML =
            '<div class="ksu-head"><h2 id="bqKillSwitchTitle">Kill switch</h2><button type="button" class="ksu-x" aria-label="Close">\u2715</button></div>' +
            '<p>Turning this on takes Bitcoin Quest offline for everyone except admins. Payouts and rewards pause. A database snapshot starts right after the app stops, and a failed snapshot will not turn it back on.</p>' +
            '<div id="ksuState"><p>Loading current status and backups\u2026</p></div>' +
            '<div id="ksuForm" style="display:none">' +
            '<label for="ksuReason">Reason (required, shown to admins only)</label>' +
            '<textarea id="ksuReason" rows="2" maxlength="200" placeholder="Why are you flipping this?"></textarea>' +
            '<label for="ksuConfirm">Type <span id="ksuWord">OFFLINE</span> to confirm</label>' +
            '<input id="ksuConfirm" type="text" autocomplete="off" autocapitalize="characters">' +
            '<label for="ksuReenable" id="ksuReenableLab">Auto-return (optional)</label>' +
            '<select id="ksuReenable">' +
            '<option value="">Stay off until an admin turns it on</option>' +
            '<option value="30">30 minutes</option>' +
            '<option value="60">1 hour</option>' +
            '<option value="180">3 hours</option>' +
            '<option value="720">12 hours</option>' +
            '<option value="1440">24 hours</option>' +
            '</select>' +
            '<label id="ksuOverrideLab" style="display:none"><input type="checkbox" id="ksuOverride"> I understand a backup is stale or missing, and I still want to go offline.</label>' +
            '<div class="ksu-row">' +
            '<button type="button" class="ksu-go" id="ksuGo">Go offline</button>' +
            '<button type="button" class="ksu-cancel" id="ksuCancel">Cancel</button>' +
            '</div></div>' +
            '<div class="ksu-status" id="ksuStatus"></div>';
        root.appendChild(sheet);
        document.body.appendChild(root);
        function close() { closeKillSwitchUi(); }
        sheet.querySelector('.ksu-x').addEventListener('click', close);
        sheet.querySelector('#ksuCancel').addEventListener('click', close);
        root.addEventListener('click', function (ev) { if (ev.target === root) close(); });

        var state = { on: false, preflight: null, needsOverride: false };

        function paint() {
            var box = sheet.querySelector('#ksuState');
            var form = sheet.querySelector('#ksuForm');
            var word = sheet.querySelector('#ksuWord');
            var go = sheet.querySelector('#ksuGo');
            var reLab = sheet.querySelector('#ksuReenableLab');
            var re = sheet.querySelector('#ksuReenable');
            var ovLab = sheet.querySelector('#ksuOverrideLab');
            var heading = state.on
                ? '<p class="warn">The app is currently <strong>offline</strong>.</p>'
                : '<p>The app is currently <strong>online</strong>.</p>';
            box.innerHTML = heading + renderChecks(state.preflight) + renderSnapshot(state.snapshot);
            form.style.display = 'block';
            word.textContent = state.on ? 'ONLINE' : 'OFFLINE';
            go.textContent = state.on ? 'Bring the app back' : 'Go offline';
            go.className = 'ksu-go' + (state.on ? ' on' : '');
            reLab.style.display = state.on ? 'none' : '';
            re.style.display = state.on ? 'none' : '';
            ovLab.style.display = (!state.on && state.needsOverride) ? 'block' : 'none';
        }

        callKillSwitch({ action: 'preflight' }).then(function (data) {
            state.on = !!(data.state && data.state.on);
            state.preflight = data.preflight || null;
            state.snapshot = data.state && data.state.snapshot;
            state.needsOverride = !!(data.preflight && data.preflight.ok === false);
            paint();
        }).catch(function (e) {
            sheet.querySelector('#ksuState').innerHTML = '<p class="bad">Could not read status. ' + escapeHtml((e && e.message) || e) + '</p>';
        });

        sheet.querySelector('#ksuGo').addEventListener('click', function () {
            var action = state.on ? 'off' : 'on';
            var reason = (sheet.querySelector('#ksuReason').value || '').trim();
            var confirm = (sheet.querySelector('#ksuConfirm').value || '').trim();
            var status = sheet.querySelector('#ksuStatus');
            var go = sheet.querySelector('#ksuGo');
            var override = !!(sheet.querySelector('#ksuOverride') && sheet.querySelector('#ksuOverride').checked);
            var mins = sheet.querySelector('#ksuReenable').value;
            status.textContent = '';
            if (reason.length < 8) { status.textContent = 'Add a short reason (at least 8 characters).'; return; }
            if (confirm !== (action === 'on' ? 'OFFLINE' : 'ONLINE')) {
                status.textContent = 'Type ' + (action === 'on' ? 'OFFLINE' : 'ONLINE') + ' to confirm.';
                return;
            }
            go.disabled = true;
            go.textContent = 'Checking your sign-in\u2026';
            var payload = { action: action, reason: reason, confirm: confirm, override: override };
            if (action === 'on' && mins) payload.reenableInMinutes = Number(mins);

            function afterProof(proof) {
                if (proof) payload.freshProofId = proof;
                go.textContent = action === 'on' ? 'Going offline\u2026' : 'Bringing it back\u2026';
                return callKillSwitch(payload).then(function (data) {
                    if (data && data.needsOverride) {
                        state.needsOverride = true;
                        state.preflight = data.preflight || state.preflight;
                        paint();
                        status.textContent = 'A backup is stale or missing. Tick the override box if you still want to go offline.';
                        go.disabled = false;
                        go.textContent = 'Go offline';
                        return;
                    }
                    state.on = !!data.on;
                    state.snapshot = data.snapshot || (data.state && data.state.snapshot) || state.snapshot;
                    if (data.preflight) state.preflight = data.preflight;
                    state.needsOverride = false;
                    sheet.querySelector('#ksuConfirm').value = '';
                    paint();
                    var snapLine = data.snapshot
                        ? (' Snapshot: ' + (data.snapshot.status || 'started') + (data.snapshot.error ? (' \u2014 ' + data.snapshot.error) : '') + '.')
                        : '';
                    status.textContent = (data.changed
                        ? (data.on ? 'The app is now offline.' : 'The app is back online.')
                        : 'No change \u2014 it was already in that state.') + snapLine;
                    go.disabled = false;
                    if (typeof window.bqKillSwitchApply === 'function') window.bqKillSwitchApply(!!data.on);
                });
            }

            var step = (typeof window._showFreshStepUp === 'function')
                ? window._showFreshStepUp('adminSetKillSwitch')
                : Promise.resolve(null);
            step.then(function (proof) {
                if (proof === null && typeof window._showFreshStepUp === 'function') {
                    go.disabled = false;
                    go.textContent = state.on ? 'Bring the app back' : 'Go offline';
                    status.textContent = 'Enter a fresh authenticator code to continue.';
                    return;
                }
                return afterProof(proof);
            }).catch(function (e) {
                go.disabled = false;
                go.textContent = state.on ? 'Bring the app back' : 'Go offline';
                var msg = (e && (e.message || (e.details && e.details.message))) || String(e);
                if (String((e && e.code) || '').indexOf('failed-precondition') !== -1 || /sign in again|too new|two-factor/i.test(msg)) {
                    status.textContent = msg;
                } else {
                    status.textContent = msg;
                }
            });
        });
    }

    window.bqAdminPanelTools = GROUPS;
    window.bqOpenKillSwitch = openKillSwitch;
})();
