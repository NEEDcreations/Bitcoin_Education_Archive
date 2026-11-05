// Faction race end prizes (client). Display only: the winner, badges, and
// payouts are decided on the server. Reads faction_race_public/current.
(function () {
    'use strict';
    var NAMES = { cyber_hornets: ['🐝', 'Cyber Hornets', 'Hive Mind Champion'], honey_badgers: ['🦡', 'Honey Badgers', "Honey Badger Don't Care Champion"] };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function fmt(n) { return Math.floor(Number(n) || 0).toLocaleString('en-US'); }

    function css() {
        if (document.getElementById('frpStyle')) return;
        var st = document.createElement('style');
        st.id = 'frpStyle';
        st.textContent =
            '#frpBanner{margin:10px auto;max-width:960px;padding:12px 14px;border-radius:14px;background:linear-gradient(135deg,#facc15,#eab308 45%,#f59e0b);color:#1a1300;font-weight:800;box-shadow:0 4px 18px rgba(234,179,8,.35);display:flex;align-items:center;gap:10px;flex-wrap:wrap}' +
            '#frpBanner .frpT{font-size:1rem;line-height:1.3;flex:1;min-width:200px}#frpBanner .frpS{font-size:.72rem;font-weight:600;opacity:.85}' +
            '.frp-gold{background:linear-gradient(160deg,rgba(250,204,21,.22),rgba(234,179,8,.08))!important;border:2px solid #eab308!important;box-shadow:0 0 18px rgba(234,179,8,.35)}' +
            '.frp-crown{display:block;font-size:.7rem;font-weight:900;color:#eab308;margin-bottom:4px;letter-spacing:.04em}';
        document.head.appendChild(st);
    }

    function paintBanner(d) {
        var old = document.getElementById('frpBanner');
        if (!d || !d.active || !NAMES[d.winner]) { if (old) old.remove(); return; }
        css();
        var w = NAMES[d.winner], l = NAMES[d.loser] || ['', '', ''];
        var html = '<span style="font-size:1.8rem">🏆</span><div class="frpT">' + w[0] + ' The ' + esc(w[1]) + ' won the race to 10,000!' +
            '<div class="frpS">Final score ' + fmt(d.finalTotals && d.finalTotals[d.winner]) + ' to ' + fmt(d.finalTotals && d.finalTotals[d.loser]) +
            '. ' + esc(l[1]) + ' get a head start in the next race. ' + l[0] + '</div></div>';
        var host = document.getElementById('todayCard');
        if (!host || !host.parentNode) return;
        if (!old) { old = document.createElement('div'); old.id = 'frpBanner'; old.setAttribute('role', 'status'); host.parentNode.insertBefore(old, host); }
        old.innerHTML = html;
    }

    function paintScoreboard(d) {
        ['cyber_hornets', 'honey_badgers'].forEach(function (f) {
            var el = document.getElementById(f === 'cyber_hornets' ? 'sfScoreHornets' : 'sfScoreBadgers');
            var card = el && el.parentElement;
            if (!card) return;
            var crown = card.querySelector('.frp-crown');
            var won = !!(d && d.active && d.winner === f);
            card.classList.toggle('frp-gold', won);
            if (won && !crown) { crown = document.createElement('span'); crown.className = 'frp-crown'; crown.textContent = '👑 RACE CHAMPIONS'; card.insertBefore(crown, card.firstChild); }
            if (!won && crown) crown.remove();
        });
    }

    var last = null;
    window._frpPaint = function (d) { last = d; css(); paintBanner(d); paintScoreboard(d); };
    function listen() {
        if (typeof firebase === 'undefined' || !firebase.firestore) return setTimeout(listen, 1500);
        try {
            firebase.firestore().collection('faction_race_public').doc('current').onSnapshot(function (s) {
                window._frpPaint(s.exists ? s.data() : null);
            }, function () {});
        } catch (e) {}
        // The Favor tab re-renders its cards; repaint the gold state when it does.
        setInterval(function () { if (last) paintScoreboard(last); }, 2000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', listen); else listen();

    // ── Admin: payout breakdown + Approve & pay ──
    function call(name, data) { return firebase.functions().httpsCallable(name)(data || {}); }

    function potTable(title, pot, statusById, raceId, side) {
        pot = pot || { recipients: [], excluded: [] };
        var h = '<div style="font-weight:800;margin:10px 0 4px;">' + esc(title) + ' · pot of sats ' + fmt(pot.pot) + ' · allocated ' + fmt(pot.satsTotal) +
            (pot.balanced ? ' ✅' : ' ⚠️ does not add up') + '</div>';
        h += '<div style="overflow-x:auto"><table style="width:100%;font-size:.72rem;border-collapse:collapse"><tr style="text-align:left;color:var(--text-muted)"><th>#</th><th>Player</th><th>uid</th><th>Contribution</th><th>Share</th><th>Sats</th><th>Status</th></tr>';
        (pot.recipients || []).forEach(function (r, i) {
            var st = statusById && statusById['frace_' + raceId + '_' + side + '_' + r.uid];
            var label = !st ? '—' : (st.ok ? (st.claimStatus || st.status) : '❌ ' + esc(st.error || st.status));
            h += '<tr style="border-top:1px solid var(--border)"><td>' + (i + 1) + '</td><td>' + esc(r.username) + '</td><td>' + esc(r.uidShort) + '</td><td>' + r.contribution + '</td><td>' + r.sharePct + '%</td><td>' + fmt(r.sats) + '</td><td>' + label + '</td></tr>';
        });
        h += '<tr style="border-top:2px solid var(--border);font-weight:800"><td></td><td>Total</td><td></td><td>' + pot.contributionTotal + '</td><td>100%</td><td>' + fmt(pot.satsTotal) + '</td><td></td></tr></table></div>';
        if ((pot.excluded || []).length) {
            h += '<details style="margin-top:4px;font-size:.7rem"><summary>Excluded (' + pot.excluded.length + ')</summary>';
            pot.excluded.forEach(function (x) { h += '<div>' + esc(x.username) + ' (' + esc(x.uidShort) + ') · ' + x.contribution + ' pts · ' + esc(x.reason) + '</div>'; });
            h += '</details>';
        }
        return h;
    }

    window.renderFactionPrizeAdmin = async function (container) {
        var el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el || window._isAdminClaim !== true) { if (el) el.innerHTML = ''; return; }
        el.innerHTML = '<div style="font-size:.8rem;color:var(--text-muted)">Loading faction race payouts…</div>';
        try {
            var d = (await call('adminFactionRaceBreakdown')).data || {};
            window._frpRenderAdmin(el, d);
        } catch (e) { el.textContent = 'Could not load faction race payouts.'; }
    };

    window._frpRenderAdmin = function (el, d) {
        var statusById = {};
        var payouts = d.payouts || {};
        Object.keys(payouts).forEach(function (k) { statusById[k] = payouts[k]; });
        var w = NAMES[d.winner] || ['', d.winner, ''];
        var h = '<div style="padding:12px;border:1px solid #eab308;border-radius:12px">' +
            '<div style="font-weight:900;color:#eab308">🏆 Faction race payouts · ' + esc(d.raceId) + '</div>' +
            '<div style="font-size:.72rem;color:var(--text-muted)">' + (d.dryRun ? 'Preview only: the race is still open. Assumes ' + esc(w[1]) + ' win.' : 'Winner: ' + w[0] + ' ' + esc(w[1]) + ' · status: ' + esc(d.payoutStatus)) + '</div>';
        h += potTable('Winners', d.winners, statusById, d.raceId, 'winners');
        h += potTable('Losers top 10', d.losers, statusById, d.raceId, 'losers');
        if (!d.dryRun) {
            var anyFail = Object.keys(statusById).some(function (k) { return !statusById[k].ok; });
            h += '<button id="frpApprove" style="margin-top:10px;padding:10px 16px;border-radius:10px;border:none;background:#eab308;color:#1a1300;font-weight:900;cursor:pointer">' +
                (d.payoutStatus === 'awaiting_admin_approval' ? '✅ Approve &amp; pay' : (anyFail ? '🔁 Retry failed' : '✔ Approved')) + '</button>' +
                '<div style="font-size:.66rem;color:var(--text-muted);margin-top:4px">Each player then claims their sats to their own Lightning Address. Every sats safety check runs again at claim time.</div>';
        }
        h += '</div>';
        el.innerHTML = h;
        var btn = document.getElementById('frpApprove');
        if (btn) btn.onclick = async function () {
            if (!confirm('Approve the pot of sats for ' + d.raceId + '?')) return;
            btn.disabled = true; btn.textContent = 'Approving…';
            try {
                var res = (await call('adminApproveFactionPayout', { raceId: d.raceId, confirm: 'APPROVE ' + d.raceId })).data;
                if (typeof showToast === 'function') showToast(res.failed ? res.failed + ' failed. Tap Retry.' : 'Approved. Players can claim now.');
            } catch (e) { if (typeof showToast === 'function') showToast('Approve failed.'); }
            window.renderFactionPrizeAdmin(el);
        };
    };
})();
