// © 2024-2026 603BTC LLC. All rights reserved.
// =============================================
// ⚡ Lightning Tips — Core Engine
// Provides the tipping overlay & payment flow.
// Uses WebLN / NWC connection from lightning.js.
// Load AFTER lightning.js.
// =============================================

(function() {
'use strict';

// ─── Check Lightning Connection ──────────────────────────

function isLnConnected() {
    // Check if lightning.js has an active connection
    var state = null;
    try { state = JSON.parse(localStorage.getItem('btc_ln_state')); } catch(e) {}
    if (state && state.method === 'nwc' && state.nwcRelay) return true;
    if (state && state.method === 'webln' && typeof window.webln !== 'undefined') return true;
    // Also check live WebLN
    if (typeof window.webln !== 'undefined') return true;
    return false;
}

function getLnMethod() {
    try {
        var s = JSON.parse(localStorage.getItem('btc_ln_state'));
        return s ? s.method : null;
    } catch(e) { return null; }
}

// ─── Send Payment via Connected Wallet ───────────────────
// This calls into WebLN or shows a BOLT11 for manual payment

async function sendLnPayment(bolt11) {
    var method = getLnMethod();
    if (method === 'webln' && window.webln) {
        await window.webln.enable();
        return window.webln.sendPayment(bolt11);
    }
    // NWC: payment would go through relay (complex for tips; show copy instead)
    // For simplicity, show the invoice for the user to pay in their wallet
    return null;
}

async function makeInvoice(amountSats, memo) {
    var method = getLnMethod();
    if (method === 'webln' && window.webln) {
        await window.webln.enable();
        var result = await window.webln.makeInvoice({ amount: amountSats, defaultMemo: memo });
        return result.paymentRequest;
    }
    return null;
}

// ─── Tip Overlay ─────────────────────────────────────────
// Universal overlay for sending tips / payments

/**
 * Show the tip/payment overlay.
 *
 * @param {Object} opts
 * @param {string} opts.recipientName   — Display name of recipient
 * @param {string} [opts.recipientUid]  — Firestore UID (for recording)
 * @param {string} [opts.context]       — e.g. 'forum_post', 'beats_track', 'leaderboard'
 * @param {string} [opts.contextId]     — e.g. post ID, track ID
 * @param {number} [opts.suggestedAmount] — Pre-fill amount in sats
 * @param {boolean} [opts.fixedAmount]  — If true, user cannot change amount
 * @param {string} [opts.lightningAddress] — If recipient has a LN address
 * @param {string} [opts.bolt11]        — Pre-made invoice to pay directly
 * @param {string} [opts.label]         — Button label override (e.g. "Buy Ticket" vs "Tip")
 * @param {Function} [opts.onSuccess]   — Callback after successful payment
 */
window.showTipOverlay = function(opts) {
    opts = opts || {};
    var name = opts.recipientName || 'this user';
    var amount = opts.suggestedAmount || '';
    var fixed = opts.fixedAmount || false;
    var label = opts.label || 'Send Tip';
    var hasBolt11 = !!opts.bolt11;
    var hasLnAddr = !!opts.lightningAddress;
    var connected = isLnConnected();

    var ov = document.createElement('div');
    ov.id = 'tipOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeSlideIn 0.25s ease-out;';
    ov.onclick = function(e) { if (e.target === ov) ov.remove(); };

    var presets = [100, 500, 1000, 5000, 10000, 21000];

    var presetsHtml = '';
    if (!fixed) {
        presetsHtml = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;justify-content:center;">';
        presets.forEach(function(p) {
            var display = p >= 1000 ? (p / 1000) + 'K' : p;
            presetsHtml += '<button onclick="document.getElementById(\'tipAmount\').value=' + p + '" style="padding:6px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.78rem;font-weight:600;cursor:pointer;font-family:inherit;transition:0.15s;touch-action:manipulation;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' + display + ' sats</button>';
        });
        presetsHtml += '</div>';
    }

    // Connection status banner
    var connBanner = connected
        ? '<div style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:10px;margin-bottom:14px;font-size:0.75rem;color:#22c55e;"><div style="width:7px;height:7px;border-radius:50%;background:#22c55e;"></div> Lightning wallet connected</div>'
        : '<div style="padding:10px 12px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.2);border-radius:10px;margin-bottom:14px;font-size:0.75rem;color:#eab308;text-align:center;">⚡ No wallet connected — invoice will be shown to copy<br><button onclick="this.closest(\'[id]\').remove();go(\'lightning\')" style="margin-top:6px;padding:5px 14px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;">Connect Wallet</button></div>';

    ov.innerHTML = '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:22px;padding:26px;max-width:380px;width:100%;animation:fadeSlideIn 0.3s ease-out;">' +
        // Header
        '<div style="text-align:center;margin-bottom:16px;">' +
            '<div style="font-size:2rem;margin-bottom:6px;">⚡</div>' +
            '<h3 style="color:var(--heading);font-size:1.15rem;font-weight:800;margin:0 0 4px;">' + escapeHtml(label) + '</h3>' +
            '<p style="color:var(--text-muted);font-size:0.82rem;margin:0;">to <strong style="color:var(--accent);">' + escapeHtml(name) + '</strong></p>' +
        '</div>' +

        connBanner +

        // Amount input
        (fixed ? '<div style="text-align:center;margin-bottom:14px;"><div style="font-size:1.6rem;font-weight:900;color:var(--accent);">' + (amount || 0).toLocaleString() + ' sats</div></div>'
         : '<div style="margin-bottom:6px;">' +
                '<input type="number" id="tipAmount" placeholder="Amount in sats" min="1" value="' + (amount || '') + '" style="width:100%;padding:13px;background:var(--input-bg);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:1.1rem;font-family:inherit;outline:none;text-align:center;box-sizing:border-box;font-weight:700;" oninput="updateTipUsd()">' +
                '<div id="tipUsdDisplay" style="text-align:center;color:var(--text-faint);font-size:0.72rem;margin-top:3px;height:14px;"></div>' +
            '</div>'
        ) +

        presetsHtml +

        // Pay button
        '<button id="tipPayBtn" onclick="executeTip()" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:14px;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;transition:0.2s;touch-action:manipulation;margin-bottom:6px;">⚡ ' + escapeHtml(label) + '</button>' +

        '<div id="tipResult" style="margin-top:8px;text-align:center;font-size:0.82rem;"></div>' +

        // LN address info
        (hasLnAddr ? '<div style="text-align:center;margin-top:8px;font-size:0.72rem;color:var(--text-faint);">Lightning Address: ' + escapeHtml(opts.lightningAddress) + '</div>' : '') +

        '<button onclick="this.closest(\'[id=tipOverlay]\').remove()" style="width:100%;padding:9px;background:none;border:none;color:var(--text-faint);font-size:0.82rem;cursor:pointer;font-family:inherit;margin-top:6px;">Cancel</button>' +
    '</div>';

    document.body.appendChild(ov);

    // Store opts for executeTip
    window._tipOpts = opts;

    // Show USD equivalent
    window.updateTipUsd = function() {
        var el = document.getElementById('tipUsdDisplay');
        var amt = parseInt(document.getElementById('tipAmount').value) || 0;
        if (el && amt > 0 && window._btcPriceCache) {
            el.textContent = '≈ $' + ((amt / 100000000) * window._btcPriceCache.price).toFixed(2);
        } else if (el) {
            el.textContent = '';
        }
    };
    if (!fixed) setTimeout(window.updateTipUsd, 100);
};

// ─── Execute Tip / Payment ───────────────────────────────

window.executeTip = async function() {
    var opts = window._tipOpts || {};
    var btn = document.getElementById('tipPayBtn');
    var res = document.getElementById('tipResult');
    var amtInput = document.getElementById('tipAmount');
    var amount = opts.fixedAmount ? opts.suggestedAmount : (amtInput ? parseInt(amtInput.value) : 0);

    if (!amount || amount < 1) {
        res.innerHTML = '<span style="color:#ef4444;">Enter an amount</span>';
        return;
    }
    if (amount > 10000000) {
        res.innerHTML = '<span style="color:#ef4444;">Max 10M sats per tip</span>';
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Processing…';

    var method = getLnMethod();
    var memo = '⚡ Tip to ' + (opts.recipientName || 'user') + (opts.context ? ' (' + opts.context + ')' : '');

    try {
        // If we have a pre-made invoice, pay it directly
        if (opts.bolt11) {
            if (method === 'webln' && window.webln) {
                await window.webln.enable();
                await window.webln.sendPayment(opts.bolt11);
                showTipSuccess(amount, opts);
                return;
            }
            // No WebLN — show invoice to copy
            showInvoiceCopy(opts.bolt11, amount, opts);
            return;
        }

        // If no Lightning Address provided, try to look it up from Firestore
        if (!opts.lightningAddress && opts.recipientUid && typeof db !== 'undefined') {
            try {
                var userDoc = await db.collection('users').doc(opts.recipientUid).get();
                if (userDoc.exists) {
                    var userData = userDoc.data();
                    if (userData.lightning && userData.lightning.includes('@')) {
                        opts.lightningAddress = userData.lightning;
                    }
                }
            } catch(e) { /* user doc not accessible or doesn't exist */ }
        }

        // If recipient has a Lightning Address, construct LNURL-pay flow
        if (opts.lightningAddress) {
            // Parse LN address → LNURL-pay endpoint
            var parts = opts.lightningAddress.split('@');
            if (parts.length === 2) {
                try {
                    var lnurlResp = await fetch('https://' + parts[1] + '/.well-known/lnurlp/' + parts[0]);
                    if (lnurlResp.ok) {
                        var lnurlData = await lnurlResp.json();
                        if (lnurlData.callback) {
                            var msats = amount * 1000;
                            var cbUrl = lnurlData.callback + (lnurlData.callback.includes('?') ? '&' : '?') + 'amount=' + msats;
                            var cbResp = await fetch(cbUrl);
                            var cbData = await cbResp.json();
                            if (cbData.pr) {
                                if (method === 'webln' && window.webln) {
                                    await window.webln.enable();
                                    await window.webln.sendPayment(cbData.pr);
                                    showTipSuccess(amount, opts);
                                    return;
                                }
                                showInvoiceCopy(cbData.pr, amount, opts);
                                return;
                            }
                        }
                    }
                } catch(e) {
                    console.warn('[TIP] LNURL-pay error:', e);
                }
            }
        }

        // WebLN: create invoice via recipient's wallet then pay (not possible without their wallet)
        // For tips without LN address or bolt11: show instructions
        if (method === 'webln' && window.webln) {
            // We can't create an invoice FOR the recipient via WebLN
            // Show a "request invoice" message
            res.innerHTML = '<div style="padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;text-align:left;margin-top:8px;">' +
                '<div style="color:var(--heading);font-size:0.82rem;font-weight:700;margin-bottom:4px;">⚡ No Lightning Address found</div>' +
                '<div style="color:var(--text-muted);font-size:0.78rem;line-height:1.5;"><strong>' + escapeHtml(opts.recipientName || 'This user') + '</strong> hasn\'t set up a Lightning Address yet. Ask them to add one in <strong>Settings → Profile → Lightning</strong>, or send them an invoice via DMs.</div>' +
                (opts.recipientUid ? '<button onclick="this.closest(\'[id=tipOverlay]\').remove();if(typeof openDMConversation===\'function\')openDMConversation(\'' + opts.recipientUid + '\',\'' + escapeHtml(opts.recipientName || '') + '\',\'⚡ Tip: ' + amount + ' sats\');else go(\'dms\')" style="width:100%;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;margin-top:8px;">💬 DM to request invoice</button>' : '') +
            '</div>';
            btn.textContent = '⚡ ' + (opts.label || 'Send Tip');
            btn.disabled = false;
            return;
        }

        // No wallet connected, no LN address, no invoice
        res.innerHTML = '<div style="padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;text-align:left;margin-top:4px;">' +
            '<div style="color:var(--heading);font-size:0.82rem;font-weight:700;margin-bottom:4px;">⚡ Can\'t tip yet</div>' +
            '<div style="color:var(--text-muted);font-size:0.78rem;line-height:1.5;margin-bottom:8px;"><strong>' + escapeHtml(opts.recipientName || 'This user') + '</strong> hasn\'t added a Lightning Address to their profile yet. Ask them to add one in Settings → Profile.</div>' +
            '<button onclick="this.closest(\'[id=tipOverlay]\').remove();go(\'lightning\')" style="width:100%;padding:9px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;">⚡ Connect Your Wallet</button>' +
        '</div>';
        btn.textContent = '⚡ ' + (opts.label || 'Send Tip');
        btn.disabled = false;

    } catch(e) {
        res.innerHTML = '<span style="color:#ef4444;">' + escapeHtml(e.message || 'Payment failed') + '</span>';
        btn.textContent = '⚡ ' + (opts.label || 'Send Tip');
        btn.disabled = false;
    }
};

// ─── Success Screen ──────────────────────────────────────

function showTipSuccess(amount, opts) {
    var ov = document.getElementById('tipOverlay');
    if (!ov) return;
    ov.querySelector('div').innerHTML = '<div style="text-align:center;padding:20px;animation:fadeSlideIn 0.3s;">' +
        '<div style="font-size:3rem;margin-bottom:12px;">⚡</div>' +
        '<div style="color:#22c55e;font-size:1.3rem;font-weight:900;margin-bottom:6px;">Tip Sent!</div>' +
        '<div style="color:var(--heading);font-size:1.1rem;font-weight:700;margin-bottom:4px;">' + amount.toLocaleString() + ' sats</div>' +
        '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:20px;">to ' + escapeHtml(opts.recipientName || 'user') + '</div>' +
        '<button onclick="this.closest(\'[id=tipOverlay]\').remove()" style="padding:12px 30px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">Done ✓</button>' +
    '</div>';

    if (typeof showToast === 'function') showToast('⚡ ' + amount.toLocaleString() + ' sats sent!');
    if (typeof awardPoints === 'function') awardPoints(10, 'Lightning tip sent');
    if (typeof opts.onSuccess === 'function') opts.onSuccess(amount);
}

// ─── Invoice Copy Screen (fallback when no WebLN) ────────

function showInvoiceCopy(bolt11, amount, opts) {
    var btn = document.getElementById('tipPayBtn');
    var res = document.getElementById('tipResult');
    btn.style.display = 'none';

    res.innerHTML = '<div style="padding:14px;background:var(--card-bg);border:1px solid var(--accent);border-radius:12px;margin-top:8px;">' +
        '<div style="font-size:0.72rem;color:var(--text-faint);text-transform:uppercase;margin-bottom:4px;">Invoice for ' + amount.toLocaleString() + ' sats</div>' +
        '<div style="padding:8px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;font-family:monospace;font-size:0.6rem;color:var(--text);word-break:break-all;max-height:70px;overflow-y:auto;line-height:1.4;cursor:pointer;margin-bottom:8px;" onclick="navigator.clipboard.writeText(\'' + bolt11 + '\');if(typeof showToast===\'function\')showToast(\'📋 Invoice copied!\')">' + bolt11.substr(0, 120) + '…</div>' +
        '<button onclick="navigator.clipboard.writeText(\'' + bolt11 + '\');if(typeof showToast===\'function\')showToast(\'📋 Invoice copied!\')" style="width:100%;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">📋 Copy Invoice</button>' +
        '<div style="color:var(--text-faint);font-size:0.7rem;margin-top:6px;text-align:center;">Paste this invoice into your Lightning wallet to pay</div>' +
    '</div>';
}

// ─── Quick Tip Button Generator ──────────────────────────
// Returns an HTML string for a tip button that can be injected into any UI

/**
 * Generate tip button HTML
 * @param {Object} p
 * @param {string} p.recipientName
 * @param {string} p.recipientUid
 * @param {string} p.context — 'forum_post', 'beats_track', 'leaderboard', etc.
 * @param {string} [p.contextId]
 * @param {string} [p.lightningAddress]
 * @param {number} [p.amount] — If set, skip the amount picker
 * @param {string} [p.label] — Button text (default: "⚡ Tip")
 * @param {string} [p.size] — 'sm' | 'md' (default: 'sm')
 */
window.tipButtonHtml = function(p) {
    var esc = typeof escapeHtml === 'function' ? escapeHtml : function(s) { return s; };
    var size = p.size || 'sm';
    var label = p.label || '⚡ Tip';
    var pad = size === 'md' ? 'padding:8px 16px;font-size:0.82rem;' : 'padding:4px 12px;font-size:0.72rem;';
    
    var argsJson = JSON.stringify({
        recipientName: p.recipientName || '',
        recipientUid: p.recipientUid || '',
        context: p.context || '',
        contextId: p.contextId || '',
        lightningAddress: p.lightningAddress || '',
        suggestedAmount: p.amount || null,
        fixedAmount: !!p.amount,
        label: p.label || 'Send Tip',
    }).replace(/'/g, "\\'").replace(/"/g, '&quot;');

    return '<button onclick="event.stopPropagation();showTipOverlay(JSON.parse(this.getAttribute(\'data-tip\').replace(/&quot;/g,\'\\&quot;\')))" data-tip="' + argsJson + '" style="' + pad + 'background:rgba(234,179,8,0.06);border:1px solid rgba(234,179,8,0.2);border-radius:10px;color:#eab308;font-weight:700;cursor:pointer;font-family:inherit;transition:0.15s;touch-action:manipulation;display:inline-flex;align-items:center;gap:4px;" onmouseover="this.style.background=\'rgba(234,179,8,0.15)\';this.style.borderColor=\'#eab308\'" onmouseout="this.style.background=\'rgba(234,179,8,0.06)\';this.style.borderColor=\'rgba(234,179,8,0.2)\'">' + label + '</button>';
};

// ─── Simple data attribute approach for tip buttons ──────
// Tip buttons use data-tip JSON and parse it on click
// This avoids issues with inline onclick escaping

document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-tip-action]');
    if (!btn) return;
    e.stopPropagation();
    try {
        var opts = JSON.parse(btn.getAttribute('data-tip-action'));
        showTipOverlay(opts);
    } catch(err) {
        console.warn('[TIP] Invalid tip data:', err);
    }
});

console.log('[TIP] Lightning tips engine loaded');
})();
