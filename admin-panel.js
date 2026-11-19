// Admin tools panel. Lazy-loaded by ranking.js only after the signed-in
// account's Firebase custom claim admin === true is re-read. Non-admins never
// download this file. It holds no admin data and grants nothing: every tile
// opens an existing admin screen, and every admin action is still checked on
// the server (context.auth.token.admin === true).
(function () {
    'use strict';

    var QUESTS_SRC = '/quests.js?v=20261112_v2545';

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
                    id: 'favorClaims', icon: '\u26A1', name: 'Satoshi\u2019s Favor claims',
                    tip: 'Freeze an epoch, open claims per epoch, clear a fee halt, release reviews.',
                    how: 'Every button asks for a fresh authenticator code. Freeze shows a dry run first, then Confirm freeze saves it. Turning claims on asks you to confirm the epoch list.',
                    open: openFavorClaims
                },
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

    // ---- Satoshi's Favor claims (admin) ------------------------------------
    // Freeze an epoch, turn claims on or off per epoch, clear a fee halt, and
    // release a manual-review block. Every action is a callable that checks
    // the admin claim and a fresh authenticator code on the server. This UI
    // never writes Firestore directly. It only reads two admin-readable paths:
    // config/satoshiFavorPayouts and sf_payout_results, plus the read-only
    // adminFavorBlockStatus callable for live block status and the fee halt.
    // Every value is shown with textContent, never parsed as HTML.

    var SF_MAX_EPOCH = 9999;

    var SF_REVIEW_COPY = {
        no_address: 'No Lightning address',
        shared_address: 'Address shared with another account',
        address_changed_after_close: 'Address set or changed after the epoch closed'
    };

    function sfParseEpochList(text) {
        var raw = String(text == null ? '' : text).trim();
        if (!raw) return { ok: true, epochs: [] };
        var parts = raw.split(/[\s,]+/).filter(function (p) { return p !== ''; });
        var out = [];
        for (var i = 0; i < parts.length; i++) {
            if (!/^\d{1,4}$/.test(parts[i])) return { ok: false, error: 'Epochs must be whole numbers like 1 or 1, 2.' };
            var n = Number(parts[i]);
            if (n < 1 || n > SF_MAX_EPOCH) return { ok: false, error: 'Epochs run from 1 to ' + SF_MAX_EPOCH + '.' };
            if (out.indexOf(n) === -1) out.push(n);
        }
        out.sort(function (a, b) { return a - b; });
        return { ok: true, epochs: out };
    }

    function sfParseEpoch(text) {
        var s = String(text == null ? '' : text).trim();
        if (!/^\d{1,4}$/.test(s)) return null;
        var n = Number(s);
        return n >= 1 && n <= SF_MAX_EPOCH ? n : null;
    }

    function sfMaskUid(uid) {
        var s = String(uid || '');
        return s ? s.slice(0, 5) + '\u2026' : '';
    }

    function sfMaskLn(addr) {
        var a = String(addr == null ? '' : addr).trim().toLowerCase();
        var at = a.indexOf('@');
        if (at < 1) return '';
        return a.slice(0, Math.min(2, at)) + '\u2026' + a.slice(at);
    }

    function sfSats(n) {
        var v = Math.floor(Number(n) || 0);
        return v.toLocaleString ? v.toLocaleString('en-US') : String(v);
    }

    // Split a freeze result into claimable and manual-review blocks.
    function sfSummarizeFreeze(data) {
        var blocks = (data && Array.isArray(data.blocks)) ? data.blocks : [];
        var s = { claimable: [], review: [], claimableSats: 0, reviewSats: 0 };
        blocks.forEach(function (b) {
            if (!b) return;
            if (b.manualReview) { s.review.push(b); s.reviewSats += Number(b.amount) || 0; }
            else { s.claimable.push(b); s.claimableSats += Number(b.amount) || 0; }
        });
        return s;
    }

    var SF_STATUS_COPY = {
        unclaimed: 'Unclaimed',
        manual_review: 'Manual review',
        paying: 'Paying now',
        unknown: 'Payment unknown (check wallet)',
        paid: 'Paid',
        rejected: 'Rejected'
    };
    var SF_STATUS_ORDER = ['unclaimed', 'manual_review', 'paying', 'unknown', 'paid', 'rejected'];

    // Server status rows -> a safe, display-only shape. Unknown statuses are
    // dropped; numbers are coerced. Nothing here is trusted as HTML.
    function sfNormalizeStatus(data) {
        var d = data && typeof data === 'object' ? data : {};
        var epochs = Array.isArray(d.epochs) ? d.epochs : [];
        var out = [];
        epochs.forEach(function (e) {
            var n = Number(e && e.epochNumber);
            if (!(n >= 1 && n <= SF_MAX_EPOCH) || Math.floor(n) !== n) return;
            var counts = {};
            var sats = {};
            SF_STATUS_ORDER.forEach(function (k) { counts[k] = 0; sats[k] = 0; });
            var blocks = [];
            (Array.isArray(e.blocks) ? e.blocks : []).forEach(function (b) {
                if (!b || !SF_STATUS_COPY.hasOwnProperty(b.status)) return;
                var amt = Math.max(0, Math.floor(Number(b.amount) || 0));
                counts[b.status] += 1;
                sats[b.status] += amt;
                blocks.push({
                    block: Math.floor(Number(b.block) || 0), amount: amt, status: b.status,
                    uid: String(b.uid || '').slice(0, 8), payTo: String(b.payTo || '').slice(0, 80),
                    reviewReason: String(b.reviewReason || '').slice(0, 60), released: b.released === true,
                    attempts: Math.max(0, Math.floor(Number(b.attempts) || 0)),
                    paidAtMs: typeof b.paidAtMs === 'number' ? b.paidAtMs : null
                });
            });
            out.push({ epochNumber: n, blocks: blocks, counts: counts, sats: sats });
        });
        out.sort(function (a, b) { return a.epochNumber - b.epochNumber; });
        var h = d.feeHalt && typeof d.feeHalt === 'object' ? d.feeHalt : null;
        return { ok: d.ok === true, epochs: out, feeHalt: h ? {
            halted: h.halted === true,
            reason: String(h.reason || '').slice(0, 60),
            routingFeeSats: typeof h.routingFeeSats === 'number' ? h.routingFeeSats : null,
            limitSats: typeof h.limitSats === 'number' ? h.limitSats : null,
            epoch: typeof h.epoch === 'number' ? h.epoch : null,
            block: typeof h.block === 'number' ? h.block : null,
            atMs: typeof h.atMs === 'number' ? h.atMs : null,
            clearedAtMs: typeof h.clearedAtMs === 'number' ? h.clearedAtMs : null
        } : null };
    }

    function sfFeeHaltText(h) {
        if (!h) return 'not loaded';
        if (!h.halted) return 'Off' + (h.clearedAtMs ? ' (cleared ' + new Date(h.clearedAtMs).toLocaleString() + ')' : '');
        var t = 'HALTED';
        if (h.routingFeeSats != null) t += ': fee ' + sfSats(h.routingFeeSats) + ' sats' + (h.limitSats != null ? ' over the ' + sfSats(h.limitSats) + '-sat limit' : '');
        if (h.epoch != null) t += ' (epoch ' + h.epoch + (h.block != null ? ', block ' + h.block : '') + ')';
        return t;
    }

    function sfErr(e) {
        return String((e && (e.message || (e.details && e.details.message))) || e || 'Something went wrong.');
    }

    // A fresh authenticator code for this one call. Resolves to the proof id,
    // or null when the admin cancels. Never reuses a proof.
    function sfStepUp(action) {
        if (typeof window._showFreshStepUp !== 'function') {
            return Promise.reject(new Error('Two-factor is not ready. Refresh and try again.'));
        }
        return Promise.resolve(window._showFreshStepUp(action));
    }

    function sfCall(name, payload) {
        if (typeof firebase === 'undefined' || !firebase.functions) {
            return Promise.reject(new Error('Functions are not ready. Refresh and try again.'));
        }
        return firebase.functions().httpsCallable(name)(payload).then(function (res) {
            return (res && res.data) || {};
        });
    }

    // Step up, then call. Resolves to { cancelled: true } or the callable data.
    function sfGuarded(stepAction, fnName, payload) {
        return sfStepUp(stepAction).then(function (proof) {
            if (!proof) return { cancelled: true };
            var p = {};
            Object.keys(payload || {}).forEach(function (k) { p[k] = payload[k]; });
            p.freshProofId = proof;
            return sfCall(fnName, p);
        });
    }

    function sfConfirm(text) {
        if (typeof window.confirm !== 'function') return false;
        try { return window.confirm(text) === true; } catch (e) { return false; }
    }

    var SFCSS = KSCSS.replace(/#bqKillSwitchUi/g, '#bqFavorUi').replace(/ksu-/g, 'sfu-') +
        '#bqFavorUi h3{font-size:0.95rem;font-weight:900;margin:16px 0 6px;color:#f7931a;}' +
        '#bqFavorUi .sfu-card{border:1px solid var(--border,#334155);border-radius:12px;padding:10px 12px;margin:6px 0;}' +
        '#bqFavorUi .sfu-kv{display:flex;justify-content:space-between;gap:10px;font-size:0.86rem;margin:2px 0;}' +
        '#bqFavorUi .sfu-k{color:var(--text-muted,#94a3b8);}' +
        '#bqFavorUi .sfu-v{font-weight:800;text-align:right;}' +
        '#bqFavorUi .sfu-go.alt{background:#1d4ed8;}' +
        '#bqFavorUi .sfu-go.warn{background:#b45309;}' +
        '#bqFavorUi .sfu-go:disabled{opacity:0.55;cursor:default;}' +
        '#bqFavorUi .sfu-chk{display:flex;align-items:center;gap:8px;font-size:0.9rem;font-weight:700;margin:8px 0 0;}' +
        '#bqFavorUi .sfu-chk input{width:auto;}' +
        '#bqFavorUi ul{padding-left:18px;margin:4px 0 8px;}';

    function closeFavorUi() {
        var n = document.getElementById('bqFavorUi');
        if (n && n.parentNode) n.parentNode.removeChild(n);
    }

    function sfKv(parent, k, v, cls) {
        var row = el('div', 'sfu-kv');
        row.appendChild(el('span', 'sfu-k', k));
        row.appendChild(el('span', 'sfu-v' + (cls ? ' ' + cls : ''), v));
        parent.appendChild(row);
        return row;
    }

    function sfButton(text, cls, id) {
        var b = el('button', cls || 'sfu-go', text);
        b.type = 'button';
        if (id) b.id = id;
        return b;
    }

    function sfInput(id, label, parent, attrs) {
        var lab = el('label', null, label);
        lab.setAttribute('for', id);
        var inp = el('input');
        inp.id = id;
        inp.type = 'text';
        inp.setAttribute('autocomplete', 'off');
        Object.keys(attrs || {}).forEach(function (k) { inp.setAttribute(k, attrs[k]); });
        parent.appendChild(lab);
        parent.appendChild(inp);
        return inp;
    }

    function sfClear(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    function openFavorClaims() {
        if (!isAdmin()) return;
        closeFavorUi();
        if (!document.getElementById('bqFavorUiCss')) {
            var st = document.createElement('style');
            st.id = 'bqFavorUiCss';
            st.textContent = SFCSS;
            document.head.appendChild(st);
        }
        var root = el('div');
        root.id = 'bqFavorUi';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-labelledby', 'bqFavorUiTitle');
        var sheet = el('div', 'sfu-sheet');
        var head = el('div', 'sfu-head');
        var h2 = el('h2', null, 'Satoshi\u2019s Favor claims');
        h2.id = 'bqFavorUiTitle';
        var x = sfButton('\u2715', 'sfu-x');
        x.setAttribute('aria-label', 'Close');
        head.appendChild(h2);
        head.appendChild(x);
        sheet.appendChild(head);
        sheet.appendChild(el('p', null, 'Every button here asks for a fresh authenticator code. The server checks your admin access again on each action.'));

        // 1. Current state
        sheet.appendChild(el('h3', null, 'Current state'));
        var stateBox = el('div', 'sfu-card');
        stateBox.id = 'sfuState';
        stateBox.appendChild(el('p', null, 'Loading\u2026'));
        sheet.appendChild(stateBox);
        var refresh = sfButton('Refresh', 'sfu-cancel', 'sfuRefresh');
        sheet.appendChild(refresh);

        // 2. Freeze an epoch
        sheet.appendChild(el('h3', null, 'Freeze an epoch'));
        sheet.appendChild(el('p', null, 'Locks in who won each block of a closed epoch. Preview first; nothing changes until you confirm.'));
        var freezeEpoch = sfInput('sfuFreezeEpoch', 'Epoch number', sheet, { inputmode: 'numeric', maxlength: '4', placeholder: '1' });
        var fRow = el('div', 'sfu-row');
        var fPreview = sfButton('Preview freeze (dry run)', 'sfu-go alt', 'sfuFreezePreview');
        var fConfirm = sfButton('Confirm freeze', 'sfu-go', 'sfuFreezeConfirm');
        fConfirm.style.display = 'none';
        fRow.appendChild(fPreview);
        fRow.appendChild(fConfirm);
        sheet.appendChild(fRow);
        var fOut = el('div');
        fOut.id = 'sfuFreezeOut';
        sheet.appendChild(fOut);
        var fStatus = el('div', 'sfu-status');
        fStatus.id = 'sfuFreezeStatus';
        sheet.appendChild(fStatus);

        // 3. Claims switch
        sheet.appendChild(el('h3', null, 'Claims'));
        var chkLab = el('label', 'sfu-chk');
        var chk = el('input');
        chk.type = 'checkbox';
        chk.id = 'sfuClaimsOn';
        chkLab.appendChild(chk);
        chkLab.appendChild(el('span', null, 'Claims on'));
        sheet.appendChild(chkLab);
        var epochsIn = sfInput('sfuEpochs', 'Open epochs (comma list, like 1 or 1, 2)', sheet, { inputmode: 'numeric', maxlength: '200', placeholder: '1' });
        var cRow = el('div', 'sfu-row');
        var cSave = sfButton('Save claim settings', 'sfu-go alt', 'sfuClaimsSave');
        cRow.appendChild(cSave);
        sheet.appendChild(cRow);
        var cStatus = el('div', 'sfu-status');
        cStatus.id = 'sfuClaimsStatus';
        sheet.appendChild(cStatus);

        // 4. Fee halt
        sheet.appendChild(el('h3', null, 'Fee halt'));
        sheet.appendChild(el('p', null, 'If a payout pays a routing fee over the limit, every claim pauses until an admin clears it. Check the fee in Alby Hub first.'));
        var hRow = el('div', 'sfu-row');
        var hClear = sfButton('Clear fee halt', 'sfu-go warn', 'sfuClearHalt');
        hRow.appendChild(hClear);
        sheet.appendChild(hRow);
        var hStatus = el('div', 'sfu-status');
        hStatus.id = 'sfuHaltStatus';
        sheet.appendChild(hStatus);

        // 5. Manual review
        sheet.appendChild(el('h3', null, 'Manual review'));
        sheet.appendChild(el('p', null, 'Blocks set aside when frozen. Release sends a block back to its frozen winner, who then claims it with every normal check. Release never pays by itself.'));
        var rBox = el('div');
        rBox.id = 'sfuReview';
        rBox.appendChild(el('p', null, 'Loading\u2026'));
        sheet.appendChild(rBox);

        // 6. Blocks by epoch (live status from the server, read only)
        sheet.appendChild(el('h3', null, 'Blocks by epoch'));
        sheet.appendChild(el('p', null, 'Every frozen block and where it stands: unclaimed, manual review, paid. Release all sends every manual-review block in an epoch back to its frozen winner, one at a time, with the same checks as the single Release button. It never pays by itself.'));
        var bBox = el('div');
        bBox.id = 'sfuBlocks';
        bBox.appendChild(el('p', null, 'Loading\u2026'));
        sheet.appendChild(bBox);

        var closeRow = el('div', 'sfu-row');
        var closeBtn = sfButton('Close', 'sfu-cancel', 'sfuClose');
        closeRow.appendChild(closeBtn);
        sheet.appendChild(closeRow);

        root.appendChild(sheet);
        document.body.appendChild(root);
        x.addEventListener('click', closeFavorUi);
        closeBtn.addEventListener('click', closeFavorUi);
        root.addEventListener('click', function (ev) { if (ev.target === root) closeFavorUi(); });

        var state = { cfg: null, preview: null, previewEpoch: null, status: null, allMsg: {} };

        function paintState() {
            sfClear(stateBox);
            var c = state.cfg;
            if (!c) { stateBox.appendChild(el('p', 'bad', 'Could not read the claim settings.')); return; }
            var on = c.claimsEnabled === true;
            var eps = Array.isArray(c.enabledEpochs) ? c.enabledEpochs : [1];
            sfKv(stateBox, 'Claims', on ? 'ON' : 'OFF', on ? 'ok' : 'warn');
            sfKv(stateBox, 'Open epochs', eps.length ? eps.join(', ') : 'none');
            if (c.perClaimCapSats != null) sfKv(stateBox, 'Per-claim cap', sfSats(c.perClaimCapSats) + ' sats');
            if (c.perUidDailySats != null) sfKv(stateBox, 'Per player per day', sfSats(c.perUidDailySats) + ' sats');
            if (c.siteDailySats != null) sfKv(stateBox, 'Site-wide per day', sfSats(c.siteDailySats) + ' sats');
            if (c.walletFloorSats != null) sfKv(stateBox, 'Wallet floor', sfSats(c.walletFloorSats) + ' sats');
            if (c.updatedBy) sfKv(stateBox, 'Last changed by', String(c.updatedBy));
            if (c.updatedAtMs) sfKv(stateBox, 'Last changed', new Date(Number(c.updatedAtMs)).toLocaleString());
            // sf_claim_counters/fee_halt is server-only (rules deny all client
            // reads). Its state comes from the read-only adminFavorBlockStatus.
            var fh = state.status && state.status.feeHalt;
            sfKv(stateBox, 'Fee halt', sfFeeHaltText(fh), fh ? (fh.halted ? 'bad' : 'ok') : '');
            chk.checked = on;
            epochsIn.value = eps.join(', ');
        }

        function loadState() {
            if (typeof firebase === 'undefined' || !firebase.firestore) {
                state.cfg = null; paintState(); return Promise.resolve();
            }
            return firebase.firestore().collection('config').doc('satoshiFavorPayouts').get().then(function (snap) {
                var d = (snap && snap.exists && typeof snap.data === 'function') ? (snap.data() || {}) : {};
                state.cfg = {
                    claimsEnabled: d.claimsEnabled === true,
                    enabledEpochs: Array.isArray(d.enabledEpochs) ? d.enabledEpochs.filter(function (e) { return typeof e === 'number'; }) : [1],
                    perClaimCapSats: d.perClaimCapSats, perUidDailySats: d.perUidDailySats,
                    siteDailySats: d.siteDailySats, walletFloorSats: d.walletFloorSats,
                    updatedBy: d.updatedBy, updatedAtMs: d.updatedAtMs
                };
                paintState();
            }).catch(function (e) {
                sfClear(stateBox);
                stateBox.appendChild(el('p', 'bad', 'Could not read the claim settings. ' + sfErr(e)));
            });
        }

        function paintReview(rows) {
            sfClear(rBox);
            // Once live status is loaded, drop blocks that already left review
            // (released, paid, rejected). Epochs without live status stay.
            if (state.status) {
                rows = rows.filter(function (r) {
                    var ep = null;
                    state.status.epochs.forEach(function (e) { if (e.epochNumber === r.epoch) ep = e; });
                    if (!ep) return true;
                    var b = null;
                    ep.blocks.forEach(function (x) { if (x.block === r.block) b = x; });
                    return !b || b.status === 'manual_review';
                });
            }
            if (!rows.length) { rBox.appendChild(el('p', 'ok', 'No blocks waiting for review.')); return; }
            rows.forEach(function (r) {
                var card = el('div', 'sfu-card');
                card.setAttribute('data-review', r.epoch + '_' + r.block);
                sfKv(card, 'Epoch ' + r.epoch + ', block ' + r.block, sfSats(r.amount) + ' sats');
                sfKv(card, 'Winner', sfMaskUid(r.uid));
                sfKv(card, 'Pays to', sfMaskLn(r.frozenLn) || 'no address');
                sfKv(card, 'Why', SF_REVIEW_COPY[r.manualReview] || String(r.manualReview));
                var noteId = 'sfuNote_' + r.epoch + '_' + r.block;
                var note = sfInput(noteId, 'Note (required, admins only)', card, { maxlength: '300', placeholder: 'Why it is safe to release' });
                var row = el('div', 'sfu-row');
                var rel = sfButton('Release to winner', 'sfu-go alt');
                row.appendChild(rel);
                card.appendChild(row);
                var st = el('div', 'sfu-status');
                card.appendChild(st);
                rel.addEventListener('click', function () {
                    var n = (note.value || '').trim();
                    if (n.length < 3) { st.textContent = 'Add a short note first.'; return; }
                    if (!sfConfirm('Release epoch ' + r.epoch + ' block ' + r.block + ' (' + sfSats(r.amount) + ' sats) to ' + (sfMaskLn(r.frozenLn) || 'its winner') + '? The winner can then claim it.')) return;
                    rel.disabled = true;
                    st.textContent = 'Checking your sign-in\u2026';
                    sfGuarded('adminResolveFavorReview', 'adminResolveFavorReview',
                        { epoch: r.epoch, block: r.block, action: 'release', note: n }).then(function (d) {
                        rel.disabled = false;
                        if (d.cancelled) { st.textContent = 'Enter a fresh authenticator code to continue.'; return; }
                        st.textContent = d.ok
                            ? (d.code === 'noop' ? 'Already released.' : 'Released. The winner can claim it now.')
                            : ('Not released: ' + String(d.code || 'refused') + '.');
                        st.className = 'sfu-status ' + (d.ok ? 'ok' : 'bad');
                    }).catch(function (e) {
                        rel.disabled = false;
                        st.textContent = sfErr(e);
                        st.className = 'sfu-status bad';
                    });
                });
                rBox.appendChild(card);
            });
        }

        function loadReview() {
            if (typeof firebase === 'undefined' || !firebase.firestore) { paintReview([]); return Promise.resolve(); }
            return firebase.firestore().collection('sf_payout_results').get().then(function (snap) {
                var rows = [];
                ((snap && snap.docs) || []).forEach(function (doc) {
                    var d = (doc && typeof doc.data === 'function') ? (doc.data() || {}) : {};
                    if (d.kind !== 'epoch_blocks' || !Array.isArray(d.blocks)) return;
                    // The frozen result stores epochNumber; the doc id is epoch_<n>.
                    var idm = /^epoch_(\d{1,4})$/.exec(String((doc && doc.id) || ''));
                    var ep = Number(d.epochNumber != null ? d.epochNumber : (idm ? idm[1] : NaN));
                    if (!(ep >= 1 && ep <= SF_MAX_EPOCH) || Math.floor(ep) !== ep) return;
                    d.blocks.forEach(function (b) {
                        if (b && b.manualReview) rows.push({ epoch: ep, block: Number(b.block), amount: b.amount, uid: b.uid, frozenLn: b.frozenLn, manualReview: b.manualReview });
                    });
                });
                rows.sort(function (a, b) { return (a.epoch - b.epoch) || (a.block - b.block); });
                paintReview(rows);
            }).catch(function (e) {
                sfClear(rBox);
                rBox.appendChild(el('p', 'bad', 'Could not read the review list. ' + sfErr(e)));
            });
        }

        function paintFreeze(data, epoch) {
            sfClear(fOut);
            var s = sfSummarizeFreeze(data);
            var card = el('div', 'sfu-card');
            var head = data.dryRun ? 'Preview for epoch ' + epoch + ' (nothing saved)'
                : (data.created ? 'Epoch ' + epoch + ' is now frozen.' : (data.existed ? 'Epoch ' + epoch + ' was already frozen.' : 'Epoch ' + epoch));
            card.appendChild(el('p', data.ok ? 'ok' : 'bad', head));
            if (!data.ok) card.appendChild(el('p', 'bad', 'Problem: ' + String(data.reason || 'unknown') + '.'));
            sfKv(card, 'Claimable', s.claimable.length + ' blocks, ' + sfSats(s.claimableSats) + ' sats');
            sfKv(card, 'Manual review', s.review.length + ' blocks, ' + sfSats(s.reviewSats) + ' sats');
            var ul = el('ul');
            (data.blocks || []).forEach(function (b) {
                var line = 'Block ' + b.block + ': ' + sfSats(b.amount) + ' sats to ' + String(b.payTo || 'no address') +
                    ' (' + String(b.uid || '') + ')' + (b.manualReview ? ' \u2014 review: ' + (SF_REVIEW_COPY[b.manualReview] || String(b.manualReview)) : '');
                ul.appendChild(el('li', b.manualReview ? 'warn' : '', line));
            });
            card.appendChild(ul);
            fOut.appendChild(card);
        }

        function resetFreezeConfirm() {
            state.preview = null;
            state.previewEpoch = null;
            fConfirm.style.display = 'none';
        }

        freezeEpoch.addEventListener('input', resetFreezeConfirm);

        fPreview.addEventListener('click', function () {
            var ep = sfParseEpoch(freezeEpoch.value);
            fStatus.className = 'sfu-status';
            if (ep == null) { fStatus.textContent = 'Enter an epoch number from 1 to ' + SF_MAX_EPOCH + '.'; return; }
            resetFreezeConfirm();
            sfClear(fOut);
            fPreview.disabled = true;
            fStatus.textContent = 'Checking your sign-in\u2026';
            sfGuarded('adminFreezeFavorEpoch', 'adminFreezeFavorEpoch', { epoch: ep, dryRun: true }).then(function (d) {
                fPreview.disabled = false;
                if (d.cancelled) { fStatus.textContent = 'Enter a fresh authenticator code to continue.'; return; }
                fStatus.textContent = '';
                paintFreeze(d, ep);
                if (d.ok && d.dryRun && !d.existed) {
                    state.preview = d;
                    state.previewEpoch = ep;
                    fConfirm.textContent = 'Confirm freeze of epoch ' + ep;
                    fConfirm.style.display = '';
                }
            }).catch(function (e) {
                fPreview.disabled = false;
                fStatus.textContent = sfErr(e);
                fStatus.className = 'sfu-status bad';
            });
        });

        fConfirm.addEventListener('click', function () {
            var ep = state.previewEpoch;
            if (ep == null || sfParseEpoch(freezeEpoch.value) !== ep) { resetFreezeConfirm(); fStatus.textContent = 'Preview again first.'; return; }
            var s = sfSummarizeFreeze(state.preview);
            if (!sfConfirm('Freeze epoch ' + ep + '? ' + s.claimable.length + ' blocks (' + sfSats(s.claimableSats) + ' sats) become claimable once claims are on, and ' +
                s.review.length + ' go to manual review. This cannot be undone.')) return;
            fConfirm.disabled = true;
            fPreview.disabled = true;
            fStatus.className = 'sfu-status';
            fStatus.textContent = 'Checking your sign-in\u2026';
            sfGuarded('adminFreezeFavorEpoch', 'adminFreezeFavorEpoch', { epoch: ep, dryRun: false }).then(function (d) {
                fConfirm.disabled = false;
                fPreview.disabled = false;
                if (d.cancelled) { fStatus.textContent = 'Enter a fresh authenticator code to continue.'; return; }
                fStatus.textContent = '';
                resetFreezeConfirm();
                paintFreeze(d, ep);
                loadReview();
            }).catch(function (e) {
                fConfirm.disabled = false;
                fPreview.disabled = false;
                fStatus.textContent = sfErr(e);
                fStatus.className = 'sfu-status bad';
            });
        });

        cSave.addEventListener('click', function () {
            cStatus.className = 'sfu-status';
            var parsed = sfParseEpochList(epochsIn.value);
            if (!parsed.ok) { cStatus.textContent = parsed.error; return; }
            var on = chk.checked === true;
            if (on && !parsed.epochs.length) { cStatus.textContent = 'List at least one epoch to open.'; return; }
            var wasOn = !!(state.cfg && state.cfg.claimsEnabled);
            var msg = on
                ? 'Turn claims ON for epoch' + (parsed.epochs.length > 1 ? 's ' : ' ') + parsed.epochs.join(', ') + '? Players in those epochs can claim real sats right away.'
                : (wasOn ? 'Turn claims OFF? No one can claim until you turn them back on.' : 'Save these settings with claims off?');
            if (!sfConfirm(msg)) return;
            cSave.disabled = true;
            cStatus.textContent = 'Checking your sign-in\u2026';
            sfGuarded('adminSetFavorClaims', 'adminSetFavorClaims', { claimsEnabled: on, enabledEpochs: parsed.epochs }).then(function (d) {
                cSave.disabled = false;
                if (d.cancelled) { cStatus.textContent = 'Enter a fresh authenticator code to continue.'; return; }
                if (d.config) {
                    state.cfg = {
                        claimsEnabled: d.config.claimsEnabled === true,
                        enabledEpochs: Array.isArray(d.config.enabledEpochs) ? d.config.enabledEpochs : [],
                        perClaimCapSats: d.config.perClaimCapSats, perUidDailySats: d.config.perUidDailySats,
                        siteDailySats: d.config.siteDailySats, walletFloorSats: d.config.walletFloorSats
                    };
                    paintState();
                }
                cStatus.textContent = 'Saved. Claims are ' + (on ? 'ON' : 'OFF') + '.';
                cStatus.className = 'sfu-status ok';
            }).catch(function (e) {
                cSave.disabled = false;
                cStatus.textContent = sfErr(e);
                cStatus.className = 'sfu-status bad';
            });
        });

        hClear.addEventListener('click', function () {
            hStatus.className = 'sfu-status';
            if (!sfConfirm('Clear the fee halt? Only do this after checking the fee in Alby Hub. Claims resume right away.')) return;
            hClear.disabled = true;
            hStatus.textContent = 'Checking your sign-in\u2026';
            sfGuarded('adminSetFavorClaims', 'adminSetFavorClaims', { clearFeeHalt: true }).then(function (d) {
                hClear.disabled = false;
                if (d.cancelled) { hStatus.textContent = 'Enter a fresh authenticator code to continue.'; return; }
                hStatus.textContent = d.feeHaltCleared || d.ok ? 'Fee halt cleared.' : 'No change.';
                hStatus.className = 'sfu-status ok';
            }).catch(function (e) {
                hClear.disabled = false;
                hStatus.textContent = sfErr(e);
                hStatus.className = 'sfu-status bad';
            });
        });

        function paintBlocks() {
            sfClear(bBox);
            var st = state.status;
            if (!st) { bBox.appendChild(el('p', 'bad', 'Could not read block status.')); return; }
            if (!st.epochs.length) { bBox.appendChild(el('p', null, 'No frozen epochs yet.')); return; }
            st.epochs.forEach(function (e) {
                var card = el('div', 'sfu-card');
                card.setAttribute('data-epoch', String(e.epochNumber));
                card.appendChild(el('p', null, 'Epoch ' + e.epochNumber));
                SF_STATUS_ORDER.forEach(function (k) {
                    if (!e.counts[k] && k !== 'unclaimed' && k !== 'paid' && k !== 'manual_review') return;
                    sfKv(card, SF_STATUS_COPY[k], e.counts[k] + ' blocks, ' + sfSats(e.sats[k]) + ' sats',
                        k === 'paid' ? 'ok' : (k === 'manual_review' || k === 'unknown' ? 'warn' : ''));
                });
                var ul = el('ul');
                e.blocks.forEach(function (b) {
                    var line = 'Block ' + b.block + ': ' + SF_STATUS_COPY[b.status] + ', ' + sfSats(b.amount) + ' sats to ' + (b.payTo || 'no address') +
                        ' (' + (b.uid || '?') + ')';
                    if (b.status === 'manual_review' && b.reviewReason) line += ' \u2014 ' + (SF_REVIEW_COPY[b.reviewReason] || b.reviewReason);
                    if (b.released && b.status === 'unclaimed') line += ' \u2014 released, waiting for the winner';
                    if (b.attempts) line += ' \u2014 ' + b.attempts + ' attempt' + (b.attempts === 1 ? '' : 's');
                    if (b.paidAtMs) line += ' \u2014 paid ' + new Date(b.paidAtMs).toLocaleString();
                    ul.appendChild(el('li', b.status === 'paid' ? 'ok' : (b.status === 'manual_review' || b.status === 'unknown' ? 'warn' : ''), line));
                });
                card.appendChild(ul);
                var msg = state.allMsg[e.epochNumber];
                if (msg && !(e.counts.manual_review > 0)) {
                    var done = el('div', msg.cls, msg.text);
                    done.id = 'sfuReleaseAllStatus_' + e.epochNumber;
                    card.appendChild(done);
                }
                if (e.counts.manual_review > 0) {
                    var noteId = 'sfuAllNote_' + e.epochNumber;
                    var note = sfInput(noteId, 'Note for Release all (required, admins only)', card, { maxlength: '280', placeholder: 'Why every review block in this epoch is safe to release' });
                    var row = el('div', 'sfu-row');
                    var all = sfButton('Release all ' + e.counts.manual_review + ' in epoch ' + e.epochNumber, 'sfu-go warn');
                    all.id = 'sfuReleaseAll_' + e.epochNumber;
                    row.appendChild(all);
                    card.appendChild(row);
                    var stl = el('div', 'sfu-status');
                    stl.id = 'sfuReleaseAllStatus_' + e.epochNumber;
                    if (msg) { stl.textContent = msg.text; stl.className = msg.cls; }
                    card.appendChild(stl);
                    all.addEventListener('click', function () {
                        var n = (note.value || '').trim();
                        stl.className = 'sfu-status';
                        if (n.length < 3) { stl.textContent = 'Add a short note first.'; return; }
                        if (!sfConfirm('Release all ' + e.counts.manual_review + ' manual-review blocks in epoch ' + e.epochNumber + ' (' + sfSats(e.sats.manual_review) + ' sats) to their frozen winners? Each winner can then claim with every normal check.')) return;
                        all.disabled = true;
                        stl.textContent = 'Checking your sign-in\u2026';
                        sfGuarded('adminReleaseAllFavorReview', 'adminReleaseAllFavorReview', { epoch: e.epochNumber, note: n }).then(function (d) {
                            all.disabled = false;
                            if (d.cancelled) { stl.textContent = 'Enter a fresh authenticator code to continue.'; return; }
                            if (!d.ok) { stl.textContent = 'Not released: ' + String(d.code || 'refused') + '.'; stl.className = 'sfu-status bad'; return; }
                            var res = Array.isArray(d.results) ? d.results : [];
                            var bad = res.filter(function (x) { return x && x.code !== 'released' && x.code !== 'noop'; });
                            var skipped = Array.isArray(d.skipped) ? d.skipped.length : 0;
                            stl.textContent = 'Released ' + (Number(d.released) || 0) + ' of ' + res.length + '.' +
                                (bad.length ? ' Refused: ' + bad.map(function (x) { return 'block ' + Number(x.block) + ' (' + String(x.code) + ')'; }).join(', ') + '.' : '') +
                                (skipped ? ' Skipped ' + skipped + ' in flight; use the single Release button after checking the wallet.' : '');
                            stl.className = 'sfu-status ' + (bad.length ? 'warn' : 'ok');
                            // Keep the result visible after the status repaint.
                            state.allMsg[e.epochNumber] = { text: stl.textContent, cls: stl.className };
                            loadStatus().then(loadReview);
                        }).catch(function (err) {
                            all.disabled = false;
                            stl.textContent = sfErr(err);
                            stl.className = 'sfu-status bad';
                        });
                    });
                }
                bBox.appendChild(card);
            });
        }

        function loadStatus() {
            return sfCall('adminFavorBlockStatus', {}).then(function (d) {
                state.status = sfNormalizeStatus(d);
                if (!state.status.ok) state.status = null;
                paintBlocks();
                if (state.cfg) paintState();
            }).catch(function (e) {
                state.status = null;
                sfClear(bBox);
                bBox.appendChild(el('p', 'bad', 'Could not read block status. ' + sfErr(e)));
            });
        }

        refresh.addEventListener('click', function () { loadState(); loadStatus().then(loadReview); });

        loadState();
        loadReview();
        loadStatus().then(loadReview);
    }

    window.bqOpenFavorClaims = openFavorClaims;
    window.bqFavorAdmin = {
        parseEpochList: sfParseEpochList,
        parseEpoch: sfParseEpoch,
        summarizeFreeze: sfSummarizeFreeze,
        maskUid: sfMaskUid,
        maskLn: sfMaskLn,
        normalizeStatus: sfNormalizeStatus,
        feeHaltText: sfFeeHaltText
    };

    window.bqAdminPanelTools = GROUPS;
    window.bqOpenKillSwitch = openKillSwitch;
})();
