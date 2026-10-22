// © 2024-2026 603BTC LLC. All rights reserved.
// Bitcoin Education Archive — Gifting, Keys & Ciphers System
// Lazy-loaded. Requires: firebase, auth, db, currentUser, showToast, escapeHtml

(function() {
'use strict';

var CIPHER_DECRYPT_DAILY_MAX = 21;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _callCF(name, data) {
    if (typeof firebase === 'undefined' || !firebase.functions) return Promise.reject(new Error('Firebase unavailable'));
    return firebase.functions().httpsCallable(name)(data || {});
}

function _isSignedIn() {
    return typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous;
}

function _getUid() {
    return auth.currentUser.uid;
}

function _esc(s) {
    return typeof escapeHtml === 'function' ? escapeHtml(s || '') : (s || '');
}

// ─── Inject shared CSS once ───────────────────────────────────────────────────
function _injectGiftingCSS() {
    if (document.getElementById('giftingCSS')) return;
    var s = document.createElement('style');
    s.id = 'giftingCSS';
    s.textContent = [
        '@keyframes giftBounce{0%{transform:scale(0.5)}60%{transform:scale(1.3)}80%{transform:scale(0.95)}100%{transform:scale(1)}}',
        '@keyframes giftShake{0%,100%{transform:rotate(0deg)}20%{transform:rotate(-10deg)}40%{transform:rotate(10deg)}60%{transform:rotate(-7deg)}80%{transform:rotate(7deg)}}',
        '@keyframes giftReveal{from{opacity:0;transform:scale(0.8) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}',
        '@keyframes giftConfetti{to{transform:translateY(220px) rotate(720deg);opacity:0}}',
        '@keyframes decryptScan{0%{opacity:0.4}50%{opacity:1}100%{opacity:0.4}}',
        '@keyframes decryptReveal{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}',
        '@keyframes decryptConfetti{to{transform:translateY(220px) rotate(720deg);opacity:0}}',
        '@keyframes decryptPulse{0%,100%{text-shadow:0 0 8px #f7931a}50%{text-shadow:0 0 24px #f7931a,0 0 48px rgba(247,147,26,0.5)}}',
        '@keyframes wrongKey{0%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}100%{transform:translateX(0)}}',
        '.gifting-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:120000;display:flex;align-items:center;justify-content:center;padding:16px;}',
        '.gifting-modal{background:var(--card-bg,#0f172a);border:1px solid rgba(247,147,26,0.25);border-radius:20px;padding:28px 24px;max-width:380px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(247,147,26,0.12);max-height:90vh;overflow-y:auto;}',
    ].join('');
    document.head.appendChild(s);
}

// ─── Award Daily Gifts — called after spin ────────────────────────────────────
// Returns gifts to client and triggers the post-spin open modal immediately.

window.awardDailyGifts = async function() {
    if (!_isSignedIn()) return;
    _injectGiftingCSS();
    try {
        var result = await _callCF('awardDailyGifts', {});
        var d = result.data;
        if (!d) return;
        if (d.alreadyAwarded) return; // silent
        if (d.giftsAdded > 0 && Array.isArray(d.gifts) && d.gifts.length > 0) {
            window.showPostSpinGiftModal(d.gifts);
        }
    } catch(e) {
        console.warn('[gifting] awardDailyGifts failed:', e.message);
    }
};

// ─── Post-spin gift modal ─────────────────────────────────────────────────────
// Shows right after spin. User opens gifts 1-by-1 or all at once.

window.showPostSpinGiftModal = function(gifts) {
    _injectGiftingCSS();
    var existing = document.getElementById('postSpinGiftOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'postSpinGiftOverlay';
    overlay.className = 'gifting-overlay';

    var count = gifts.length;
    overlay.innerHTML =
        '<div class="gifting-modal">' +
        '<div style="font-size:3rem;margin-bottom:4px;animation:giftBounce 0.6s ease-out;">🎁</div>' +
        '<div style="color:#f7931a;font-weight:900;font-size:1.25rem;margin-bottom:4px;">You won ' + count + ' gift' + (count > 1 ? 's' : '') + '!</div>' +
        '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:20px;">Open them to collect your rewards</div>' +
        '<div id="postSpinGiftList" style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;"></div>' +
        '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
        '<button id="openAllGiftsBtn" style="padding:12px 24px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:12px;font-size:0.95rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 16px rgba(247,147,26,0.35);">✨ Open All</button>' +
        '<button onclick="document.getElementById(\'postSpinGiftOverlay\').remove()" style="padding:12px 20px;background:transparent;color:var(--text-muted);border:1px solid var(--border,#333);border-radius:12px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;">Open Later</button>' +
        '</div></div>';

    document.body.appendChild(overlay);

    var listEl = document.getElementById('postSpinGiftList');
    gifts.forEach(function(g, i) {
        var row = document.createElement('div');
        row.id = 'giftRow_' + g.id;
        row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.2);border-radius:12px;';
        row.innerHTML =
            '<span style="font-size:1.6rem;">🎁</span>' +
            '<div style="flex:1;color:var(--text-muted);font-size:0.85rem;">Gift ' + (i + 1) + '</div>' +
            '<button onclick="window.openSingleGift(\'' + g.id + '\',\'' + g.rewardType + '\')" style="padding:7px 14px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:8px;font-size:0.8rem;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap;">Open 🎁</button>';
        if (listEl) listEl.appendChild(row);
    });

    // Open all button
    var openAllBtn = document.getElementById('openAllGiftsBtn');
    if (openAllBtn) {
        openAllBtn.onclick = async function() {
            openAllBtn.disabled = true;
            openAllBtn.textContent = 'Opening...';
            var summary = { tickets: 0, xp: 0, keys: [], ciphers: [], shields: 0, closet: [], nacho: 0 };
            for (var i = 0; i < gifts.length; i++) {
                var g = gifts[i];
                var row = document.getElementById('giftRow_' + g.id);
                if (row) row.style.opacity = '0.5';
                try {
                    var res = await _callCF('openGift', { giftId: g.id });
                    var rw = res.data && res.data.reward ? res.data.reward : { rewardType: 'tickets', ticketCount: 1 };
                    if (row) {
                        row.innerHTML = '<span style="font-size:1.2rem;">' + _rewardEmoji(rw) + '</span><div style="flex:1;font-size:0.82rem;color:var(--text);">' + _rewardLabel(rw) + '</div><span style="color:#34d399;font-size:0.8rem;font-weight:700;">✓</span>';
                        row.style.opacity = '1';
                        row.style.borderColor = 'rgba(52,211,153,0.3)';
                        row.style.background = 'rgba(52,211,153,0.05)';
                    }
                    _accumulateReward(summary, rw);
                } catch(e) {
                    if (row) { row.style.opacity = '1'; }
                }
                await new Promise(function(r) { setTimeout(r, 180); });
            }
            openAllBtn.textContent = '🎉 All opened!';
            openAllBtn.style.background = '#34d399';
            openAllBtn.onclick = null;
            // Show summary toast
            var parts = [];
            if (summary.tickets > 0)  parts.push('+' + summary.tickets + ' 🎫');
            if (summary.xp > 0)       parts.push('+' + summary.xp + ' XP');
            if (summary.keys.length)  parts.push(summary.keys.length + ' 🔑 key' + (summary.keys.length > 1 ? 's' : ''));
            if (summary.ciphers.length) parts.push(summary.ciphers.length + ' 🔒 cipher' + (summary.ciphers.length > 1 ? 's' : ''));
            if (summary.shields > 0)  parts.push(summary.shields + ' 🛡️');
            if (typeof showToast === 'function' && parts.length)
                showToast('🎁 Gifts opened! ' + parts.join(' · '), 4000);
            // Refresh keys/ciphers tabs if visible
            setTimeout(function() {
                if (typeof window.renderKeysTab === 'function')    window.renderKeysTab('keysTabContent');
                if (typeof window.renderCiphersTab === 'function') window.renderCiphersTab('ciphersTabContent');
            }, 500);
        };
    }
};

function _rewardEmoji(rw) {
    if (rw.rewardType === 'tickets')       return '🎫';
    if (rw.rewardType === 'xp_bonus')      return '⭐';
    if (rw.rewardType === 'streak_shield') return '🛡️';
    if (rw.rewardType === 'closet_item')   return rw.itemEmoji || '👑';
    if (rw.rewardType === 'nacho_shoutout') return '🦌';
    if (rw.rewardType === 'keys')          return '🔑';
    if (rw.rewardType === 'locked_ciphers') return '🔒';
    return '🎁';
}

function _rewardLabel(rw) {
    if (rw.rewardType === 'tickets')       return '+' + (rw.ticketCount || 1) + ' Orange Ticket' + ((rw.ticketCount || 1) > 1 ? 's' : '');
    if (rw.rewardType === 'xp_bonus')      return '+' + (rw.xpAmount || 50) + ' XP Bonus';
    if (rw.rewardType === 'streak_shield') return 'Streak Shield';
    if (rw.rewardType === 'closet_item')   return rw.itemName || 'Rare Closet Item';
    if (rw.rewardType === 'nacho_shoutout') return 'Nacho Shoutout! 🦌';
    if (rw.rewardType === 'keys') {
        var labels = (rw.keyLabels || []).join(', ');
        return (rw.keyLabels || []).length + ' Key' + ((rw.keyLabels || []).length > 1 ? 's' : '') + (labels ? ': ' + labels : '');
    }
    if (rw.rewardType === 'locked_ciphers') {
        var clabels = (rw.cipherLabels || []).join(', ');
        return (rw.cipherLabels || []).length + ' Locked Cipher' + ((rw.cipherLabels || []).length > 1 ? 's' : '') + (clabels ? ': ' + clabels : '');
    }
    return 'Reward';
}

function _accumulateReward(summary, rw) {
    if (rw.rewardType === 'tickets')       summary.tickets += (rw.ticketCount || 1);
    if (rw.rewardType === 'xp_bonus')      summary.xp += (rw.xpAmount || 50);
    if (rw.rewardType === 'streak_shield') summary.shields++;
    if (rw.rewardType === 'closet_item')   summary.closet.push(rw.itemName || '?');
    if (rw.rewardType === 'nacho_shoutout') summary.nacho++;
    if (rw.rewardType === 'keys')          summary.keys.push(...(rw.keyLabels || []));
    if (rw.rewardType === 'locked_ciphers') summary.ciphers.push(...(rw.cipherLabels || []));
}

// ─── Open single gift (with animation) ───────────────────────────────────────

window.openSingleGift = async function(giftId, knownType) {
    _injectGiftingCSS();
    var row = document.getElementById('giftRow_' + giftId);
    if (row) {
        var btn = row.querySelector('button');
        if (btn) { btn.disabled = true; btn.textContent = 'Opening...'; }
    }
    try {
        var res = await _callCF('openGift', { giftId: giftId });
        var rw = res.data && res.data.reward ? res.data.reward : { rewardType: 'tickets', ticketCount: 1 };
        if (row) {
            row.innerHTML = '<span style="font-size:1.4rem;animation:giftReveal 0.4s ease-out;">' + _rewardEmoji(rw) + '</span><div style="flex:1;font-size:0.9rem;font-weight:700;color:var(--text);animation:giftReveal 0.4s ease-out;">' + _rewardLabel(rw) + '</div><span style="color:#34d399;font-weight:700;">✓</span>';
            row.style.borderColor = 'rgba(52,211,153,0.35)';
            row.style.background = 'rgba(52,211,153,0.06)';
        }
        if (typeof showToast === 'function') showToast('🎁 ' + _rewardLabel(rw) + '!', 3000);
        setTimeout(function() {
            if (typeof window.renderKeysTab === 'function')    window.renderKeysTab('keysTabContent');
            if (typeof window.renderCiphersTab === 'function') window.renderCiphersTab('ciphersTabContent');
        }, 400);
    } catch(e) {
        if (row) {
            var btn2 = row.querySelector('button');
            if (btn2) { btn2.disabled = false; btn2.textContent = 'Open 🎁'; }
        }
        if (typeof showToast === 'function') showToast('❌ ' + (e.message || 'Failed to open gift'), 3000);
    }
};

// ─── Load key inventory ───────────────────────────────────────────────────────

window.loadKeyInventory = async function() {
    if (!_isSignedIn() || typeof db === 'undefined') return { inventory: [], received: [] };
    var uid = _getUid();
    try {
        var invSnap = await db.collection('keys').where('ownerId','==',uid).where('status','==','inventory').orderBy('createdAt','desc').limit(100).get();
        var recvSnap = await db.collection('keys').where('ownerId','==',uid).where('status','==','sent').orderBy('sentAt','desc').limit(100).get();
        return {
            inventory: invSnap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); }),
            received:  recvSnap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); }),
        };
    } catch(e) {
        console.warn('[gifting] loadKeyInventory error:', e.message);
        return { inventory: [], received: [] };
    }
};

// ─── Load cipher inventory ────────────────────────────────────────────────────

window.loadCipherInventory = async function() {
    if (!_isSignedIn() || typeof db === 'undefined') return { ciphers: [] };
    var uid = _getUid();
    try {
        var snap = await db.collection('locked_ciphers').where('ownerId','==',uid).where('status','==','inventory').orderBy('createdAt','desc').limit(200).get();
        return { ciphers: snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); }) };
    } catch(e) {
        console.warn('[gifting] loadCipherInventory error:', e.message);
        return { ciphers: [] };
    }
};

// ─── Render Keys Tab ──────────────────────────────────────────────────────────

window.renderKeysTab = async function(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div style="padding:10px;color:var(--text-muted);font-size:0.82rem;">Loading keys...</div>';
    try {
        var data = await window.loadKeyInventory();
        var inv  = data.inventory;
        var recv = data.received;
        if (!inv.length && !recv.length) {
            el.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:0.82rem;">No keys yet — open gifts from the daily spin to earn keys! 🎡</div>';
            return;
        }
        var html = '';
        if (inv.length) {
            html += '<div style="font-size:0.68rem;font-weight:800;color:var(--text-faint);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">🔑 Your Keys — Send to Peers (' + inv.length + ')</div>';
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">';
            inv.forEach(function(k) {
                html += '<div style="padding:7px 12px;background:rgba(247,147,26,0.1);border:1.5px solid rgba(247,147,26,0.4);border-radius:8px;font-family:monospace;font-size:0.95rem;font-weight:900;color:#f7931a;letter-spacing:1px;">🔑 ' + _esc(k.label) + '</div>';
            });
            html += '</div>';
        }
        if (recv.length) {
            html += '<div style="font-size:0.68rem;font-weight:800;color:var(--text-faint);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">📬 Keys Received From Peers (' + recv.length + ')</div>';
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">';
            recv.forEach(function(k) {
                var sentBy = k.sentByName ? ' from ' + _esc(k.sentByName) : '';
                html += '<div style="padding:7px 12px;background:rgba(167,139,250,0.1);border:1.5px solid rgba(167,139,250,0.4);border-radius:8px;font-family:monospace;font-size:0.95rem;font-weight:900;color:#a78bfa;letter-spacing:1px;" title="' + sentBy + '">🔑 ' + _esc(k.label) + '</div>';
            });
            html += '</div>';
            html += '<div style="font-size:0.7rem;color:var(--text-faint);margin-top:2px;">Use these to decrypt matching ciphers below ⬇️</div>';
        }
        el.innerHTML = html;
    } catch(e) {
        el.innerHTML = '<div style="color:#ef4444;font-size:0.82rem;padding:10px;">Error loading keys</div>';
    }
};

// ─── Render Ciphers Tab ───────────────────────────────────────────────────────

window.renderCiphersTab = async function(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div style="padding:10px;color:var(--text-muted);font-size:0.82rem;">Loading ciphers...</div>';
    try {
        var cipherData = await window.loadCipherInventory();
        var ciphers    = cipherData.ciphers;
        var keyData    = await window.loadKeyInventory();
        var recvKeys   = keyData.received; // keys received from peers — usable for decrypting

        if (!ciphers.length) {
            el.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:0.82rem;">No locked ciphers yet — open gifts to earn them! 🎁<br><span style="font-size:0.72rem;opacity:0.7;margin-top:4px;display:block;">Then ask peers to send you the matching key label to decrypt.</span></div>';
            return;
        }

        // Group by label so duplicates are obvious
        var grouped = {};
        ciphers.forEach(function(c) {
            if (!grouped[c.label]) grouped[c.label] = [];
            grouped[c.label].push(c);
        });

        var html = '<div style="display:flex;flex-direction:column;gap:8px;">';
        Object.keys(grouped).sort().forEach(function(label) {
            var group = grouped[label];
            // Find a usable received key with this label
            var matchingKey = null;
            for (var i = 0; i < recvKeys.length; i++) {
                if (recvKeys[i].label === label) { matchingKey = recvKeys[i]; break; }
            }
            group.forEach(function(c, idx) {
                var hasKey = matchingKey && idx === 0; // only first cipher can use the key
                html += '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:' + (hasKey ? 'rgba(52,211,153,0.06)' : 'rgba(99,102,241,0.06)') + ';border:1px solid ' + (hasKey ? 'rgba(52,211,153,0.3)' : 'rgba(99,102,241,0.2)') + ';border-radius:12px;">' +
                    '<div style="text-align:center;min-width:44px;">' +
                    '<div style="font-size:1.5rem;">' + (hasKey ? '🔓' : '🔒') + '</div>' +
                    '<div style="font-family:monospace;font-size:0.8rem;font-weight:900;color:' + (hasKey ? '#34d399' : '#a78bfa') + ';letter-spacing:1px;margin-top:2px;">' + _esc(label) + '</div>' +
                    (group.length > 1 && idx === 0 ? '<div style="font-size:0.6rem;color:var(--text-faint);">×' + group.length + '</div>' : '') +
                    '</div>' +
                    '<div style="flex:1;min-width:0;">' +
                    (hasKey
                        ? '<div style="font-size:0.82rem;font-weight:700;color:#34d399;">✅ Matching key ready!</div><div style="font-size:0.7rem;color:var(--text-faint);">From ' + _esc(matchingKey.sentByName || 'a peer') + '</div>'
                        : '<div style="font-size:0.82rem;font-weight:700;color:var(--text);">Needs a <span style="font-family:monospace;color:#a78bfa;">' + _esc(label) + '</span> key</div><div style="font-size:0.7rem;color:var(--text-faint);">Ask in chat for a ' + _esc(label) + ' key 💬</div>'
                    ) +
                    '</div>' +
                    (hasKey
                        ? '<button onclick="window.decryptCipherModal(\'' + c.id + '\',\'' + _esc(label) + '\')" style="padding:8px 14px;background:linear-gradient(135deg,#34d399,#10b981);color:#fff;border:none;border-radius:8px;font-size:0.8rem;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap;">🔓 Decrypt</button>'
                        : '<button onclick="navigator.clipboard&&navigator.clipboard.writeText(\'Anyone have a ' + _esc(label) + ' key? I need one to decrypt my cipher!\').then(function(){if(typeof showToast===\'function\')showToast(\'📋 Message copied! Paste in chat\',2500);})" style="padding:8px 12px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);color:#a78bfa;border-radius:8px;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;">📋 Copy ask</button>'
                    ) +
                    '</div>';
                if (group.length > 1 && idx === 0) {
                    // Skip rendering duplicates — they show as ×N
                    for (var j = 1; j < group.length; j++) { /* skip */ }
                }
            });
            // Only render first of each group (duplicates shown as ×N)
            grouped[label] = [group[0]];
        });
        html += '</div>';
        html += '<div style="margin-top:10px;font-size:0.7rem;color:var(--text-faint);text-align:center;">21 decrypts per day max. Each decrypt uses one peer-sent key.</div>';
        el.innerHTML = html;
    } catch(e) {
        el.innerHTML = '<div style="color:#ef4444;font-size:0.82rem;padding:10px;">Error loading ciphers</div>';
    }
};

// ─── Decrypt Cipher Modal ─────────────────────────────────────────────────────
// ECDSA animation → reveal big reward. Wrong label → send-back option.

window.decryptCipherModal = async function(cipherId, cipherLabel) {
    if (!_isSignedIn()) { if (typeof showToast === 'function') showToast('🔐 Sign in to decrypt'); return; }
    _injectGiftingCSS();

    // Find matching peer-sent key
    var uid = _getUid();
    var matchingKey = null;
    try {
        var keySnap = await db.collection('keys')
            .where('ownerId','==',uid)
            .where('status','==','sent')
            .where('label','==',cipherLabel)
            .limit(1).get();
        if (!keySnap.empty) matchingKey = Object.assign({ id: keySnap.docs[0].id }, keySnap.docs[0].data());
    } catch(e) { console.warn('[gifting] key lookup error:', e.message); }

    if (!matchingKey) {
        if (typeof showToast === 'function')
            showToast('🔑 No matching ' + cipherLabel + ' key found. Ask a peer in chat!', 4500);
        return;
    }

    var existing = document.getElementById('decryptCipherOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'decryptCipherOverlay';
    overlay.className = 'gifting-overlay';
    overlay.innerHTML =
        '<div class="gifting-modal">' +
        '<div id="dcLabelDisplay" style="font-family:monospace;font-size:2.8rem;font-weight:900;color:#a78bfa;letter-spacing:4px;margin-bottom:6px;">🔒 ' + _esc(cipherLabel) + '</div>' +
        '<div style="color:var(--text-muted);font-size:0.78rem;margin-bottom:16px;">Applying key <span style="font-family:monospace;color:#f7931a;font-weight:700;">' + _esc(cipherLabel) + '</span></div>' +
        '<div id="dcHexStream" style="font-family:monospace;font-size:0.72rem;color:#f7931a;word-break:break-all;min-height:52px;margin-bottom:16px;padding:10px;background:rgba(247,147,26,0.05);border-radius:8px;letter-spacing:1px;line-height:1.6;animation:decryptScan 1s ease-in-out infinite;"></div>' +
        '<div id="dcStatus" style="color:var(--text-muted);font-size:0.85rem;font-weight:600;min-height:22px;"></div>' +
        '<div id="dcResult" style="display:none;"></div>' +
        '</div>';
    document.body.appendChild(overlay);

    var hexEl  = document.getElementById('dcHexStream');
    var statEl = document.getElementById('dcStatus');

    var hexChars = '0123456789ABCDEF';
    var streamLen = 48;

    // Phase 1: cycle random hex for 1.5s
    statEl.textContent = 'Verifying ECDSA signature...';
    var cycleInterval = setInterval(function() {
        var str = '3045022100';
        for (var i = 0; i < streamLen; i++) str += hexChars[Math.floor(Math.random() * 16)];
        str += '0220' + Array.from({length: 30}, function() { return hexChars[Math.floor(Math.random() * 16)]; }).join('');
        if (hexEl) hexEl.textContent = str;
    }, 45);

    await new Promise(function(r) { setTimeout(r, 1500); });
    clearInterval(cycleInterval);

    // Phase 2: lock in char by char over 0.8s
    statEl.textContent = 'Signature verified ✓';
    var finalHash = '3045022100' + Array.from({length: streamLen}, function() { return hexChars[Math.floor(Math.random() * 16)]; }).join('') +
                    '0220' + Array.from({length: 30}, function() { return hexChars[Math.floor(Math.random() * 16)]; }).join('');
    for (var ci = 0; ci < finalHash.length; ci++) {
        var locked = finalHash.slice(0, ci + 1);
        var remaining = finalHash.slice(ci + 1).split('').map(function() { return hexChars[Math.floor(Math.random() * 16)]; }).join('');
        if (hexEl) hexEl.textContent = locked + remaining;
        await new Promise(function(r) { setTimeout(r, 12); });
    }
    if (hexEl) { hexEl.textContent = finalHash; hexEl.style.animation = 'none'; hexEl.style.opacity = '1'; }

    statEl.textContent = 'Decrypting cipher...';

    // Phase 3: call CF
    var result, cfError;
    try {
        result = await _callCF('decryptCipher', { cipherId: cipherId, keyId: matchingKey.id });
    } catch(e) {
        cfError = e.message || 'Decryption failed';
    }

    var ov       = document.getElementById('decryptCipherOverlay');
    if (!ov) return;
    var resultDiv = ov.querySelector('#dcResult');
    var statusDiv = ov.querySelector('#dcStatus');
    var hexDiv    = ov.querySelector('#dcHexStream');

    if (cfError) {
        if (statusDiv) statusDiv.textContent = '';
        if (hexDiv)    hexDiv.style.display = 'none';
        if (resultDiv) {
            resultDiv.style.display = 'block';
            // Check if it's a label mismatch (shouldn't happen but handle gracefully)
            var isMismatch = cfError.indexOf('LABEL_MISMATCH') !== -1 || cfError.indexOf('does not match') !== -1;
            resultDiv.innerHTML = '<div style="animation:wrongKey 0.5s ease-in-out;color:#ef4444;font-size:0.9rem;margin-bottom:14px;">❌ ' + (isMismatch ? 'Wrong key for this cipher!' : _esc(cfError)) + '</div>' +
                (isMismatch ? '<button onclick="window._sendKeyBack(\'' + matchingKey.id + '\',\'' + _esc(cipherLabel) + '\',\'' + _esc(matchingKey.sentBy || '') + '\',\'' + _esc(matchingKey.sentByName || 'peer') + '\')" style="display:block;width:100%;margin-bottom:8px;padding:10px;background:rgba(247,147,26,0.12);border:1px solid rgba(247,147,26,0.3);border-radius:10px;color:#f7931a;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">↩️ Send key back to sender</button>' : '') +
                '<button onclick="document.getElementById(\'decryptCipherOverlay\').remove()" style="width:100%;padding:10px;background:none;border:1px solid var(--border,#333);border-radius:10px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;font-family:inherit;">Keep key &amp; close</button>';
        }
        return;
    }

    // Success!
    var labelDisp = ov.querySelector('#dcLabelDisplay');
    if (labelDisp) labelDisp.innerHTML = '🔓 <span style="color:#f7931a;animation:decryptPulse 1.2s ease-in-out 2;">' + _esc(cipherLabel) + '</span>';
    if (statusDiv) statusDiv.textContent = '';
    if (hexDiv) { hexDiv.style.animation = 'none'; hexDiv.style.color = '#34d399'; }

    // Decrypt count
    var decCount = '';
    try {
        var uSnap = await db.collection('users').doc(uid).get();
        if (uSnap.exists) {
            var cnt = uSnap.data().ciphersDecryptedToday || 1;
            decCount = '<div style="font-size:0.7rem;color:var(--text-faint);margin-top:8px;">' + cnt + ' / 21 decrypts used today</div>';
        }
    } catch(e) {}

    var rw = (result && result.data && result.data.reward) ? result.data.reward : { rewardType: 'tickets', ticketCount: 5 };
    if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<div style="animation:decryptReveal 0.45s ease-out;">' + _buildCipherRewardHTML(rw) + decCount + '</div>';
    }

    // Confetti
    var colors = ['#f7931a','#fbbf24','#a78bfa','#34d399','#f472b6','#60a5fa'];
    for (var fi = 0; fi < 14; fi++) {
        var dot = document.createElement('div');
        dot.style.cssText = 'position:fixed;width:8px;height:8px;border-radius:50%;pointer-events:none;z-index:120001;left:' + (20 + 60 * Math.random()) + '%;top:' + (5 + 25 * Math.random()) + '%;background:' + colors[fi % colors.length] + ';animation:decryptConfetti 1.3s ease-out ' + (0.05 * Math.random()) + 's forwards;';
        document.body.appendChild(dot);
        setTimeout(function(d) { if (d && d.parentNode) d.parentNode.removeChild(d); }, 1500, dot);
    }

    if (typeof showToast === 'function') {
        var toastMsg = '🔓 Cipher cracked! ' + _rewardLabel(rw) + ' 🎉';
        showToast(toastMsg, 4000);
    }

    // Refresh cipher + key display
    setTimeout(function() {
        if (typeof window.renderKeysTab === 'function')    window.renderKeysTab('keysTabContent');
        if (typeof window.renderCiphersTab === 'function') window.renderCiphersTab('ciphersTabContent');
    }, 600);
};

function _buildCipherRewardHTML(rw) {
    var closeBtn = '<button onclick="document.getElementById(\'decryptCipherOverlay\').remove()" style="margin-top:12px;padding:12px 28px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 16px rgba(247,147,26,0.4);">';
    if (rw.rewardType === 'tickets') {
        return '<div style="font-size:2.4rem;margin-bottom:8px;">🎫</div>' +
            '<div style="color:#f7931a;font-weight:900;font-size:1.3rem;">+' + (rw.ticketCount || 5) + ' Orange Tickets!</div>' +
            '<div style="color:var(--text-muted);font-size:0.78rem;margin:4px 0 0;">Your cipher held secrets 🧡</div>' +
            closeBtn + 'Collect! ✓</button>';
    } else if (rw.rewardType === 'xp_bonus') {
        return '<div style="font-size:2.4rem;margin-bottom:8px;">⭐</div>' +
            '<div style="color:#fbbf24;font-weight:900;font-size:1.3rem;">+' + (rw.xpAmount || 250) + ' XP!</div>' +
            '<div style="color:var(--text-muted);font-size:0.78rem;margin:4px 0 0;">Big brain energy 🧠</div>' +
            closeBtn + 'Collect! ✓</button>';
    } else if (rw.rewardType === 'closet_item') {
        return '<div style="font-size:2.4rem;margin-bottom:8px;">' + (rw.itemEmoji || '👑') + '</div>' +
            '<div style="color:#a78bfa;font-weight:900;font-size:1.2rem;">' + _esc(rw.itemName || 'Rare Item') + '!</div>' +
            '<div style="color:var(--text-muted);font-size:0.78rem;margin:4px 0 0;">Ultra rare closet drop 🎁</div>' +
            closeBtn + 'Collect! ✓</button>';
    } else if (rw.rewardType === 'nacho_shoutout') {
        return '<div style="font-size:2.4rem;margin-bottom:8px;">🦌</div>' +
            '<div style="color:#f7931a;font-weight:900;font-size:1.2rem;">Nacho Shoutout!</div>' +
            '<div style="color:var(--text-muted);font-size:0.78rem;margin:4px 0 0;">Ultra rare — Nacho is posting about you! 🦌⚡</div>' +
            closeBtn + '🦌 ✓</button>';
    }
    return '<div style="color:#f7931a;font-weight:700;margin-bottom:12px;">🔓 Cipher decrypted!</div>' + closeBtn + 'Close</button>';
}

// ─── Send key back (no daily limit) ──────────────────────────────────────────

window._sendKeyBack = async function(keyId, keyLabel, recipientUid, recipientName) {
    if (!recipientUid) {
        if (typeof showToast === 'function') showToast('❌ Cannot find original sender to return key', 3000);
        return;
    }
    var btn = event && event.target ? event.target : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Sending back...'; }
    try {
        await _callCF('sendKeys', { keyIds: [keyId], recipientUid: recipientUid, bypassDailyLimit: true });
        if (typeof showToast === 'function')
            showToast('↩️ Key ' + keyLabel + ' sent back to ' + (recipientName || 'sender') + '!', 3000);
        var ov = document.getElementById('decryptCipherOverlay');
        if (ov) ov.remove();
    } catch(e) {
        if (btn) { btn.disabled = false; btn.textContent = '↩️ Send key back to sender'; }
        if (typeof showToast === 'function') showToast('❌ ' + (e.message || 'Failed to send back'), 3000);
    }
};

// ─── Key picker for sending to a peer ────────────────────────────────────────

window.showKeyPickerForPeer = async function(recipientUid, recipientName, onDone) {
    if (!_isSignedIn()) { if (typeof showToast === 'function') showToast('🔐 Sign in to send keys'); return; }
    _injectGiftingCSS();

    // ── Peer check ─────────────────────────────────────────────────────────
    var isPeer = (typeof window._myPeers !== 'undefined' && window._myPeers instanceof Set)
        ? window._myPeers.has(recipientUid)
        : ((typeof currentUser !== 'undefined' && currentUser && Array.isArray(currentUser.peers))
            ? currentUser.peers.indexOf(recipientUid) !== -1
            : false);

    if (!isPeer) {
        // Show not-peers toast with an Add Peer button
        var toastContainer = document.createElement('div');
        toastContainer.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:130000;background:#1e293b;border:1px solid rgba(247,147,26,0.4);border-radius:14px;padding:14px 18px;max-width:320px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
        toastContainer.innerHTML =
            '<div style="font-size:0.9rem;font-weight:700;color:var(--text);margin-bottom:8px;">🧡 Not peers yet!</div>' +
            '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px;">You need to be peers with ' + _esc(recipientName || 'this user') + ' before you can send keys.</div>' +
            '<div style="display:flex;gap:8px;justify-content:center;">' +
            '<button onclick="if(typeof window.managePeer===\'function\'){window.managePeer(\'add\',\''+recipientUid+'\').then(function(){if(typeof showToast===\'function\')showToast(\'🧡 Peer request sent!\',3000);});} this.closest(\'[style*=position]\').remove()" style="padding:8px 16px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:9px;font-size:0.85rem;font-weight:800;cursor:pointer;font-family:inherit;">Add Peer 🧡</button>' +
            '<button onclick="this.closest(\'[style*=position]\').remove()" style="padding:8px 14px;background:none;border:1px solid var(--border,#333);color:var(--text-muted);border-radius:9px;font-size:0.85rem;cursor:pointer;font-family:inherit;">Close</button>' +
            '</div>';
        document.body.appendChild(toastContainer);
        setTimeout(function() { if (toastContainer.parentNode) toastContainer.parentNode.removeChild(toastContainer); }, 6000);
        return;
    }

    var existing = document.getElementById('keyPickerOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'keyPickerOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:110000;display:flex;align-items:flex-end;justify-content:center;padding:0;';
    overlay.innerHTML =
        '<div style="background:var(--card-bg,#0f172a);border:1px solid var(--border,#1e293b);border-radius:20px 20px 0 0;padding:24px;width:100%;max-width:480px;max-height:80vh;overflow-y:auto;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
        '<div style="color:#f7931a;font-weight:800;font-size:1.05rem;">🔑 Send Keys to ' + _esc(recipientName || 'peer') + '</div>' +
        '<button onclick="document.getElementById(\'keyPickerOverlay\').remove()" style="background:none;border:1px solid var(--border,#333);color:var(--text-muted);width:28px;height:28px;border-radius:6px;font-size:0.9rem;cursor:pointer;">✕</button>' +
        '</div>' +
        '<div style="color:var(--text-muted);font-size:0.78rem;margin-bottom:14px;">Select up to 3 keys. They can use them to decrypt their ciphers.</div>' +
        '<div id="kpDailyStatus" style="margin-bottom:10px;"></div>' +
        '<div id="kpKeyList" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;min-height:40px;"><div style="color:var(--text-muted);font-size:0.85rem;">Loading...</div></div>' +
        '<div id="kpSelCount" style="font-size:0.75rem;color:var(--text-faint);margin-bottom:10px;"></div>' +
        '<button id="kpSendBtn" disabled style="width:100%;padding:13px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;opacity:0.35;">Send Keys 🔑</button>' +
        '</div>';
    document.body.appendChild(overlay);

    var today = new Date().toISOString().slice(0, 10);
    var uid   = _getUid();

    // Check daily limit
    try {
        var pairSnap = await db.collection('key_send_pairs').doc(uid + '_' + recipientUid + '_' + today).get();
        var statusEl = document.getElementById('kpDailyStatus');
        if (statusEl) {
            statusEl.innerHTML = pairSnap.exists
                ? '<div style="padding:9px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:8px;color:#ef4444;font-size:0.78rem;font-weight:700;">⏰ Already sent keys to this peer today. Come back tomorrow!</div>'
                : '<div style="padding:7px;background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.2);border-radius:8px;color:#34d399;font-size:0.75rem;">✅ 1 send available today</div>';
            if (pairSnap.exists) {
                var sb = document.getElementById('kpSendBtn');
                if (sb) { sb.disabled = true; sb.style.opacity = '0.25'; sb.textContent = 'Already sent today'; }
                document.getElementById('kpKeyList').innerHTML = '';
                return;
            }
        }
    } catch(e) {}

    var data = await window.loadKeyInventory();
    var keys = data.inventory;
    var listDiv = document.getElementById('kpKeyList');
    if (!listDiv) return;

    if (!keys.length) {
        listDiv.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:10px;">No keys in inventory. Open gifts from the daily spin first! 🎡</div>';
        return;
    }

    var selected = [];

    function _renderChips() {
        listDiv.innerHTML = '';
        keys.forEach(function(k) {
            var isSel = selected.indexOf(k.id) !== -1;
            var chip  = document.createElement('button');
            chip.style.cssText = 'padding:10px 16px;font-family:monospace;font-size:1rem;font-weight:900;letter-spacing:1px;border-radius:10px;cursor:pointer;transition:0.15s;border:2px solid ' + (isSel ? '#f7931a' : 'rgba(247,147,26,0.3)') + ';background:' + (isSel ? 'rgba(247,147,26,0.2)' : 'rgba(247,147,26,0.05)') + ';color:' + (isSel ? '#f7931a' : 'var(--text-muted)') + ';';
            chip.textContent = (isSel ? '✓ ' : '') + k.label;
            chip.onclick = function() {
                var idx = selected.indexOf(k.id);
                if (idx !== -1) { selected.splice(idx, 1); }
                else {
                    if (selected.length >= 3) { if (typeof showToast === 'function') showToast('Max 3 keys per send', 2000); return; }
                    selected.push(k.id);
                }
                _renderChips();
            };
            listDiv.appendChild(chip);
        });
        var sc = document.getElementById('kpSelCount');
        if (sc) sc.textContent = selected.length + ' / 3 selected';
        var sb = document.getElementById('kpSendBtn');
        if (sb) { sb.disabled = selected.length === 0; sb.style.opacity = selected.length > 0 ? '1' : '0.35'; }
    }

    _renderChips();

    var sendBtn = document.getElementById('kpSendBtn');
    if (sendBtn) {
        sendBtn.onclick = async function() {
            if (!selected.length) return;
            sendBtn.disabled = true; sendBtn.textContent = 'Sending...';
            try {
                await _callCF('sendKeys', { keyIds: selected, recipientUid: recipientUid });
                var count = selected.length;
                if (typeof showToast === 'function')
                    showToast('🔑 ' + count + ' key' + (count > 1 ? 's' : '') + ' sent to ' + _esc(recipientName || 'your peer') + '! +25 XP 🎉', 3500);
                var ov2 = document.getElementById('keyPickerOverlay');
                if (ov2) ov2.remove();
                if (typeof onDone === 'function') onDone();
                setTimeout(function() { if (typeof window.renderKeysTab === 'function') window.renderKeysTab('keysTabContent'); }, 400);
            } catch(e) {
                sendBtn.disabled = false; sendBtn.textContent = 'Send Keys 🔑';
                if (typeof showToast === 'function') showToast('❌ ' + (e.message || 'Failed to send keys'), 3500);
            }
        };
    }
};

// ─── Gifts settings tab ────────────────────────────────────────────────────────

window.renderGiftsSettingsTab = async function() {
    var container = document.getElementById('giftsTabContent');
    if (!container) return;
    if (!_isSignedIn()) {
        container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:0.9rem;">🔐 Sign in to view your gifts</div>';
        return;
    }
    container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:0.85rem;">Loading...</div>';
    try {
        // Show unopened gifts (any that haven't been opened yet from today)
        var uid   = _getUid();
        var snap  = await db.collection('gifts').where('ownerId','==',uid).where('status','==','unopened').limit(20).get();
        var gifts = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
        var html  = '';
        if (gifts.length > 0) {
            html += '<div style="background:rgba(247,147,26,0.07);border:1px solid rgba(247,147,26,0.25);border-radius:12px;padding:14px;margin-bottom:14px;">';
            html += '<div style="color:#f7931a;font-weight:800;font-size:0.9rem;margin-bottom:10px;">🎁 ' + gifts.length + ' unopened gift' + (gifts.length > 1 ? 's' : '') + ' waiting!</div>';
            html += '<button onclick="window.showPostSpinGiftModal(' + JSON.stringify(gifts.map(function(g){return{id:g.id,rewardType:g.rewardType||\'unknown\'};})) + ')" style="width:100%;padding:11px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:10px;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;">✨ Open My Gifts</button>';
            html += '</div>';
        }
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;">';
        html += '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;font-weight:800;margin-bottom:8px;">How it works</div>';
        html += '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.9;">';
        html += '<b style="color:var(--text);">🎡 Spin</b> the daily wheel to win 2-5 gifts.<br>';
        html += '<b style="color:var(--text);">🎁 Open</b> gifts immediately — they contain keys, locked ciphers, XP, and tickets.<br>';
        html += '<b style="color:var(--text);">🔑 Send keys</b> to peers from their profile card.<br>';
        html += '<b style="color:var(--text);">🔒 Collect ciphers</b> — ask in chat for the matching key label to decrypt.<br>';
        html += '<b style="color:var(--text);">🔓 Decrypt</b> with a peer-sent matching key for big rewards!';
        html += '</div></div>';
        container.innerHTML = html;
    } catch(e) {
        container.innerHTML = '<div style="color:#ef4444;font-size:0.85rem;padding:16px;">Could not load: ' + _esc(e.message || 'error') + '</div>';
    }
};

console.log('[gifting] v2 loaded');
