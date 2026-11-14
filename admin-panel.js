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

    window.bqAdminPanelTools = GROUPS;
})();
