// Satoshi's Favor epoch / window payout admin panel.
// Breakdown + typed Approve. Players claim through claimCipherWin after approve.
(function () {
    'use strict';
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function fmt(n) { return Math.floor(Number(n) || 0).toLocaleString('en-US'); }
    function call(name, data) {
        return firebase.functions().httpsCallable(name)(data || {});
    }

    function potTable(bd, payouts, resultId) {
        bd = bd || { recipients: [], excluded: [] };
        var h = '<div style="font-weight:800;margin:10px 0 4px;">Pot of sats ' + fmt(bd.pot) +
            ' · allocated ' + fmt(bd.satsTotal) + (bd.balanced ? ' ✅' : ' ⚠️') + '</div>';
        h += '<div style="overflow-x:auto"><table style="width:100%;font-size:.72rem;border-collapse:collapse">' +
            '<tr style="text-align:left;color:var(--text-muted)"><th>#</th><th>Player</th><th>uid</th><th>Why</th><th>Share</th><th>Sats</th><th>Mode</th><th>Status</th></tr>';
        (bd.recipients || []).forEach(function (r, i) {
            var id = 'sfpay_' + resultId + '_' + r.uid;
            var st = payouts && payouts[id];
            var label = !st ? '—' : (st.ok ? (st.claimStatus || st.status) : ('❌ ' + esc(st.error || st.status)));
            h += '<tr style="border-top:1px solid var(--border)"><td>' + (i + 1) + '</td><td>' + esc(r.username) +
                '</td><td>' + esc(r.uidShort) + '</td><td>' + esc(r.why || '') + '</td><td>' + (r.sharePct || 0) +
                '%</td><td>' + fmt(r.sats) + '</td><td>' + esc(r.mode || '') + '</td><td>' + label + '</td></tr>';
        });
        h += '</table></div>';
        if ((bd.excluded || []).length) {
            h += '<details style="margin-top:4px;font-size:.7rem"><summary>Excluded (' + bd.excluded.length + ')</summary>';
            bd.excluded.forEach(function (x) {
                h += '<div>' + esc(x.username) + ' (' + esc(x.uidShort) + ') · ' + esc(x.why || '') +
                    ' · ' + esc(x.reason) + '</div>';
            });
            h += '</details>';
        }
        return h;
    }

    async function render(host) {
        if (!host) return;
        host.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:.8rem;">Loading Favor payouts…</div>';
        try {
            var listRes = (await call('adminFavorPayoutBreakdown', {})).data || {};
            var items = listRes.list || [];
            var h = '<div style="padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--card-bg);">' +
                '<div style="font-weight:900;margin-bottom:8px;">⛏️ Favor pots of sats (admin approve)</div>' +
                '<div style="font-size:.72rem;color:var(--text-muted);margin-bottom:8px;">Nothing auto-pays. Type APPROVE &lt;id&gt; to let players claim.</div>';
            if (!items.length) {
                h += '<div style="font-size:.78rem;color:var(--text-faint);">No Favor payout results yet.</div></div>';
                host.innerHTML = h;
                return;
            }
            h += '<label style="font-size:.75rem;font-weight:700;">Result </label><select id="sfpPick" style="margin:0 8px 8px 0;padding:6px;border-radius:8px;">';
            items.forEach(function (it, i) {
                h += '<option value="' + esc(it.resultId) + '"' + (i === 0 ? ' selected' : '') + '>' +
                    esc(it.resultId) + ' · ' + fmt(it.pot) + ' sats · ' + esc(it.payoutStatus) + '</option>';
            });
            h += '</select><div id="sfpDetail"></div></div>';
            host.innerHTML = h;
            async function showOne(id) {
                var box = document.getElementById('sfpDetail');
                if (!box) return;
                box.innerHTML = '<div style="font-size:.75rem;color:var(--text-muted);">Loading…</div>';
                try {
                    var d = (await call('adminFavorPayoutBreakdown', { resultId: id })).data || {};
                    var anyFail = d.payoutStatus === 'approved_with_failures';
                    var html = '<div style="font-size:.78rem;margin:8px 0;">Status: <b>' + esc(d.payoutStatus || '') + '</b></div>';
                    html += potTable(d.breakdown, d.payouts, d.resultId);
                    var clusters = (d.breakdown && d.breakdown.lightningClusters) || [];
                    if (clusters.length) {
                        html += '<details open style="margin-top:8px;font-size:.72rem"><summary>Shared Lightning clusters (' + clusters.length + ') — excluded from Approve</summary>';
                        clusters.forEach(function (c) {
                            html += '<div>' + esc(c.addressMasked) + ' · ' + (c.count || 0) + ' accounts · ' + fmt(c.sats) + ' sats';
                            if (c.uidShorts && c.uidShorts.length) html += ' · ' + c.uidShorts.map(esc).join(', ');
                            html += '</div>';
                        });
                        html += '</details>';
                    }
                    var flags = (d.breakdown && d.breakdown.flags) || [];
                    if (flags.length) {
                        html += '<div style="margin-top:6px;font-size:.72rem;color:#fbbf24;">Flags: ';
                        flags.forEach(function (f, i) {
                            html += (i ? '; ' : '') + esc(f.kind) + ' ' + esc(f.username || f.addressMasked || '') + ' ' + (f.sharePct || 0) + '%';
                        });
                        html += '</div>';
                    }
                    if (d.perBlockSats) html += '<div style="font-size:.72rem;color:var(--text-muted);margin-top:4px;">Per block: ' + fmt(d.perBlockSats) + ' sats</div>';
                    if (d.payoutStatus === 'awaiting_admin_approval' || anyFail) {
                        html += '<div style="margin-top:10px;font-size:.72rem;">Type <code>APPROVE ' + esc(d.resultId) + '</code> below, then confirm.</div>' +
                            '<input id="sfpConfirm" placeholder="APPROVE ' + esc(d.resultId) + '" style="width:100%;margin-top:6px;padding:8px;border-radius:8px;border:1px solid var(--border);font-family:monospace;font-size:.78rem;" />' +
                            '<button id="sfpApprove" style="margin-top:10px;padding:10px 16px;border-radius:10px;border:none;background:#eab308;color:#1a1300;font-weight:900;cursor:pointer">' +
                            (anyFail ? '🔁 Retry failed' : '✅ Approve &amp; unlock claims') + '</button>';
                    }
                    box.innerHTML = html;
                    var btn = document.getElementById('sfpApprove');
                    if (btn) btn.onclick = async function () {
                        var typed = (document.getElementById('sfpConfirm') || {}).value || '';
                        if (typed !== ('APPROVE ' + d.resultId)) {
                            if (typeof showToast === 'function') showToast('Confirmation text does not match.');
                            return;
                        }
                        if (!confirm('Approve Favor pot ' + d.resultId + '? Players will be able to claim.')) return;
                        btn.disabled = true;
                        try {
                            var res = (await call('adminApproveFavorPayout', { resultId: d.resultId, confirm: typed })).data;
                            if (typeof showToast === 'function') {
                                showToast(res.failed ? (res.failed + ' failed. Tap Retry.') : 'Approved. Players can claim now.');
                            }
                            showOne(d.resultId);
                        } catch (e) {
                            if (typeof showToast === 'function') showToast('Approve failed.');
                            btn.disabled = false;
                        }
                    };
                } catch (e) {
                    box.innerHTML = '<div style="color:#ef4444;font-size:.78rem;">Could not load breakdown.</div>';
                }
            }
            var pick = document.getElementById('sfpPick');
            if (pick) {
                pick.onchange = function () { showOne(pick.value); };
                showOne(pick.value);
            }
        } catch (e) {
            host.innerHTML = '<div style="padding:12px;color:#ef4444;font-size:.8rem;">Favor payouts admin unavailable.</div>';
        }
    }

    window.renderFavorPayoutAdmin = render;

    // Mount into the existing admin tools area when present.
    function tryMount() {
        var host = document.getElementById('favorPayoutAdmin') || document.getElementById('adminFavorPayouts');
        if (!host) {
            var tools = document.getElementById('adminToolsPanel') || document.getElementById('adminPanel');
            if (tools && !document.getElementById('favorPayoutAdmin')) {
                host = document.createElement('div');
                host.id = 'favorPayoutAdmin';
                host.style.marginTop = '16px';
                tools.appendChild(host);
            }
        }
        if (host && typeof firebase !== 'undefined' && firebase.functions) render(host);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(tryMount, 1500); });
    else setTimeout(tryMount, 1500);
})();
