// © 2024-2026 603BTC LLC. All rights reserved.
// Bitcoin Education Archive — Peer Gifting System
// Lazy-loaded. Requires: firebase, auth, db, currentUser, showToast, escapeHtml

(function() {
'use strict';

var GIFT_OPEN_DAILY_MAX = 20;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _callCF(name, data) {
    if (typeof firebase === 'undefined' || !firebase.functions) return Promise.reject(new Error('Firebase unavailable'));
    return firebase.functions().httpsCallable(name)(data || {});
}

function _isSignedIn() {
    return typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous;
}

function _getPeers() {
    return (typeof window._myPeers !== 'undefined' && window._myPeers instanceof Set)
        ? window._myPeers
        : new Set((typeof currentUser !== 'undefined' && currentUser ? currentUser.peers || [] : []));
}

// ─── Award Daily Gifts (called after spin) ───────────────────────────────────

window.awardDailyGifts = async function() {
    if (!_isSignedIn()) return;
    try {
        var result = await _callCF('awardDailyGifts', {});
        var d = result.data;
        if (d && d.alreadyAwarded) return; // silent — already got gifts today
        if (d && d.giftsAdded > 0) {
            if (typeof showToast === 'function') showToast('🎁 +' + d.giftsAdded + ' gifts added to your inventory!', 3500);
        }
    } catch(e) {
        console.warn('[gifting] awardDailyGifts failed:', e.message);
    }
};

// ─── Load gift inventory from Firestore ──────────────────────────────────────

window.loadGiftInventory = async function() {
    if (!_isSignedIn() || typeof db === 'undefined') return { inventory: [], received: [] };
    var uid = auth.currentUser.uid;
    try {
        // Fetch inventory gifts (owned by user, not yet sent)
        var invSnap = await db.collection('gifts')
            .where('ownerId', '==', uid)
            .where('status', '==', 'inventory')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        var inventory = invSnap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });

        // Fetch received gifts (sent to user, awaiting open)
        var recvSnap = await db.collection('gifts')
            .where('ownerId', '==', uid)
            .where('status', '==', 'sent')
            .orderBy('sentAt', 'desc')
            .limit(50)
            .get();
        var received = recvSnap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });

        return { inventory: inventory, received: received };
    } catch(e) {
        console.warn('[gifting] loadGiftInventory error:', e.message);
        return { inventory: [], received: [] };
    }
};

// ─── Send Gift ────────────────────────────────────────────────────────────────

window.sendGiftToPeer = async function(giftId, recipientUid, recipientName, onDone) {
    if (!_isSignedIn()) { if (typeof showToast === 'function') showToast('🔐 Sign in to send gifts'); return; }
    try {
        await _callCF('sendGift', { giftId: giftId, recipientUid: recipientUid });
        if (typeof showToast === 'function') showToast('🎁 Gift sent to ' + (typeof escapeHtml === 'function' ? escapeHtml(recipientName || 'your peer') : (recipientName || 'your peer')) + '! +25 XP 🎉', 3500);
        if (typeof onDone === 'function') onDone();
    } catch(e) {
        var msg = e.message || 'Failed to send gift';
        if (msg.indexOf('peers') !== -1) msg = 'You must be peers to send a gift 🧡';
        if (typeof showToast === 'function') showToast('❌ ' + msg, 4000);
    }
};

// ─── Open Gift — animation + reveal ──────────────────────────────────────────

window.openGiftModal = async function(giftId) {
    if (!_isSignedIn()) { if (typeof showToast === 'function') showToast('🔐 Sign in to open gifts'); return; }

    // Show animation overlay immediately
    var overlay = document.createElement('div');
    overlay.id = 'giftOpenOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:120000;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;padding:20px;';

    var inner = document.createElement('div');
    inner.style.cssText = 'background:var(--bg-side,#1a1a2e);border:2px solid #f7931a;border-radius:20px;padding:40px 32px;max-width:340px;width:100%;text-align:center;position:relative;box-shadow:0 8px 40px rgba(247,147,26,0.3);';

    inner.innerHTML =
        '<div id="giftAnimEmoji" style="font-size:5rem;margin-bottom:12px;display:inline-block;animation:giftBounce 0.6s ease-out;">🎁</div>' +
        '<div style="color:#f7931a;font-weight:800;font-size:1.1rem;margin-bottom:6px;">Opening gift...</div>' +
        '<div style="color:var(--text-muted);font-size:0.85rem;">From a peer 🧡</div>';

    overlay.appendChild(inner);
    document.body.appendChild(overlay);

    // Inject animation CSS once
    if (!document.getElementById('giftAnimStyle')) {
        var style = document.createElement('style');
        style.id = 'giftAnimStyle';
        style.textContent =
            '@keyframes giftBounce{0%{transform:scale(0.5)}60%{transform:scale(1.2)}80%{transform:scale(0.95)}100%{transform:scale(1)}}' +
            '@keyframes giftShake{0%,100%{transform:rotate(0deg)}20%{transform:rotate(-8deg)}40%{transform:rotate(8deg)}60%{transform:rotate(-6deg)}80%{transform:rotate(6deg)}}' +
            '@keyframes giftReveal{from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}}' +
            '@keyframes giftConfetti{to{transform:translateY(200px) rotate(720deg);opacity:0}}';
        document.head.appendChild(style);
    }

    // Shake after bounce
    setTimeout(function() {
        var emoji = document.getElementById('giftAnimEmoji');
        if (emoji) emoji.style.animation = 'giftShake 0.5s ease-in-out';
    }, 700);

    // Call CF
    var ticketCount = null;
    var cfError = null;
    try {
        var result = await _callCF('openGift', { giftId: giftId });
        ticketCount = result.data && result.data.ticketCount ? result.data.ticketCount : 1;
        // Update local currentUser
        if (typeof currentUser !== 'undefined' && currentUser) {
            currentUser.orangeTickets = (currentUser.orangeTickets || 0) + ticketCount;
        }
    } catch(e) {
        cfError = e.message || 'Failed to open gift';
    }

    // Wait for shake to finish, then reveal
    setTimeout(function() {
        if (!document.getElementById('giftOpenOverlay')) return;
        inner.innerHTML = cfError
            ? '<div style="font-size:3rem;margin-bottom:12px;">❌</div>' +
              '<div style="color:#ef4444;font-weight:700;font-size:1rem;margin-bottom:16px;">' + (typeof escapeHtml === 'function' ? escapeHtml(cfError) : cfError) + '</div>' +
              '<button onclick="document.getElementById(\'giftOpenOverlay\').remove()" style="padding:10px 24px;background:#ef4444;color:#fff;border:none;border-radius:10px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">Close</button>'
            : '<div style="animation:giftReveal 0.4s ease-out;">' +
              '<div style="font-size:5rem;margin-bottom:8px;">🎫</div>' +
              '<div style="font-size:3rem;font-weight:900;color:#f7931a;margin-bottom:4px;">' + ticketCount + '</div>' +
              '<div style="color:#fff;font-weight:800;font-size:1.2rem;margin-bottom:6px;">Orange Ticket' + (ticketCount !== 1 ? 's' : '') + '!</div>' +
              '<div style="color:#94a3b8;font-size:0.85rem;margin-bottom:20px;">Added to your wallet 🧡</div>' +
              '<button onclick="document.getElementById(\'giftOpenOverlay\').remove()" style="padding:12px 28px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 16px rgba(247,147,26,0.4);">Sweet! ✨</button>' +
              '</div>';

        if (!cfError) {
            // Confetti
            if (typeof launchConfetti === 'function') {
                try { launchConfetti(); } catch(e2) {}
            } else {
                var colors = ['#f7931a','#fbbf24','#22c55e','#3b82f6'];
                for (var i = 0; i < 20; i++) {
                    (function(i) {
                        var dot = document.createElement('div');
                        dot.style.cssText = 'position:fixed;width:8px;height:8px;border-radius:50%;pointer-events:none;z-index:120001;left:' + (30 + 40 * Math.random()) + '%;top:' + (10 + 20 * Math.random()) + '%;background:' + colors[i % colors.length] + ';animation:giftConfetti 1.2s ease-out ' + (0.1 * Math.random()) + 's forwards;';
                        document.body.appendChild(dot);
                        setTimeout(function() { dot.remove(); }, 1500);
                    })(i);
                }
            }
            // Toast
            if (typeof showToast === 'function') showToast('+' + ticketCount + ' 🎫 Orange Ticket' + (ticketCount !== 1 ? 's' : '') + ' added!', 3000);
            // Auto-close
            setTimeout(function() {
                var ov = document.getElementById('giftOpenOverlay');
                if (ov) ov.remove();
            }, 3500);
        }
    }, 1300);

    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
};

// ─── Peer picker overlay (for sending from inventory) ────────────────────────

window.showGiftPeerPicker = function(giftId, onSent) {
    if (!_isSignedIn()) return;
    var peers = _getPeers();
    var peerArr = Array.from(peers);

    if (peerArr.length === 0) {
        if (typeof showToast === 'function') showToast('Add peers first to send gifts! Go to Settings → Account 🧡', 4000);
        return;
    }

    var existing = document.getElementById('giftPeerPickerOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'giftPeerPickerOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:110000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;';

    var peerListHtml = '';
    // We need usernames — load from public_profiles
    var inner = document.createElement('div');
    inner.style.cssText = 'background:var(--bg-side,#1a1a2e);border:2px solid #f7931a;border-radius:18px;padding:24px;max-width:360px;width:100%;max-height:80vh;overflow-y:auto;';
    inner.innerHTML =
        '<button onclick="document.getElementById(\'giftPeerPickerOverlay\').remove()" style="float:right;background:none;border:1px solid var(--border,#333);color:var(--text-muted,#888);width:28px;height:28px;border-radius:6px;font-size:0.9rem;cursor:pointer;">✕</button>' +
        '<div style="font-size:1.5rem;margin-bottom:8px;">🎁</div>' +
        '<div style="color:#f7931a;font-weight:800;font-size:1.05rem;margin-bottom:4px;">Send Gift</div>' +
        '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:16px;">Pick a peer to send this gift to</div>' +
        '<div id="giftPeerList" style="display:flex;flex-direction:column;gap:8px;"><div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.85rem;">Loading peers...</div></div>';

    overlay.appendChild(inner);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

    // Load peer names from public_profiles
    Promise.all(peerArr.slice(0, 20).map(function(uid) {
        return db.collection('public_profiles').doc(uid).get()
            .then(function(doc) { return { uid: uid, username: doc.exists ? (doc.data().username || 'Bitcoiner') : 'Bitcoiner' }; })
            .catch(function() { return { uid: uid, username: 'Bitcoiner' }; });
    })).then(function(peers) {
        var list = document.getElementById('giftPeerList');
        if (!list) return;
        list.innerHTML = peers.map(function(p) {
            return '<button onclick="window._doSendGiftToPeer(\'' + p.uid + '\',\'' + (typeof escapeHtml === 'function' ? escapeHtml(p.username) : p.username) + '\',\'' + giftId + '\')" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.2);border-radius:10px;color:var(--text,#fff);cursor:pointer;font-family:inherit;font-size:0.9rem;font-weight:600;text-align:left;transition:0.15s;">' +
                '<span style="font-size:1.1rem;">🧡</span>' +
                '<span>' + (typeof escapeHtml === 'function' ? escapeHtml(p.username) : p.username) + '</span>' +
                '</button>';
        }).join('');
    });

    window._doSendGiftToPeer = function(recipientUid, recipientName, giftId) {
        document.getElementById('giftPeerPickerOverlay') && document.getElementById('giftPeerPickerOverlay').remove();
        window.sendGiftToPeer(giftId, recipientUid, recipientName, function() {
            if (typeof onSent === 'function') onSent();
        });
    };
};

// ─── Settings Tab — Gifts ─────────────────────────────────────────────────────

window.renderGiftsSettingsTab = async function() {
    var container = document.getElementById('giftsTabContent');
    if (!container) return;
    if (!_isSignedIn()) {
        container.innerHTML = '<div style="text-align:center;padding:40px 20px;"><div style="font-size:3rem;margin-bottom:12px;">🎁</div><div style="color:var(--text-muted);font-size:0.9rem;">Sign in to send and receive gifts!</div></div>';
        return;
    }
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.85rem;">Loading gifts...</div>';
    try {
        var data = await window.loadGiftInventory();
        var inventory = data.inventory;
        var received = data.received;
        var html = '';

        // Received gifts (open these)
        if (received.length > 0) {
            html += '<div style="margin-bottom:20px;">' +
                '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1.2px;font-weight:800;margin-bottom:10px;">📬 Received Gifts (' + received.length + ')</div>';
            received.forEach(function(g) {
                var from = typeof escapeHtml === 'function' ? escapeHtml(g.sentByName || 'A peer') : (g.sentByName || 'A peer');
                html += '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(247,147,26,0.07);border:1px solid rgba(247,147,26,0.25);border-radius:12px;margin-bottom:8px;">' +
                    '<span style="font-size:2rem;">🎁</span>' +
                    '<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:0.9rem;color:var(--text);">Gift from ' + from + '</div>' +
                    '<div style="font-size:0.75rem;color:var(--text-muted);">Tap to open — contains Orange Tickets!</div></div>' +
                    '<button onclick="window.openGiftModal(\'' + g.id + '\').then(function(){if(typeof showSettingsPage===\'function\')showSettingsPage(\'gifts\')})" style="padding:8px 14px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:8px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;">Open 🎁</button>' +
                    '</div>';
            });
            html += '</div>';
        }

        // Inventory gifts (send these)
        html += '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1.2px;font-weight:800;margin-bottom:10px;">🎒 Your Gift Inventory (' + inventory.length + '/50)</div>';
        if (inventory.length === 0) {
            html += '<div style="text-align:center;padding:28px 20px;background:var(--card-bg,rgba(255,255,255,0.03));border:1px solid var(--border);border-radius:12px;color:var(--text-muted);font-size:0.85rem;">' +
                '<div style="font-size:2.5rem;margin-bottom:8px;">🎡</div>' +
                'Spin the daily wheel to earn 5 gifts!' +
                '</div>';
        } else {
            inventory.forEach(function(g, idx) {
                html += '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--card-bg,rgba(255,255,255,0.03));border:1px solid var(--border);border-radius:12px;margin-bottom:8px;">' +
                    '<span style="font-size:2rem;">🎁</span>' +
                    '<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:0.9rem;color:var(--text);">Gift #' + (idx + 1) + '</div>' +
                    '<div style="font-size:0.75rem;color:var(--text-muted);">Contains 1-3 Orange Tickets 🎫</div></div>' +
                    '<button onclick="window.showGiftPeerPicker(\'' + g.id + '\',function(){if(typeof showSettingsPage===\'function\')showSettingsPage(\'gifts\')})" style="padding:8px 14px;background:rgba(247,147,26,0.12);border:1px solid rgba(247,147,26,0.3);color:#f7931a;border-radius:8px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;">Send 🧡</button>' +
                    '</div>';
            });
        }

        // Info card
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-top:16px;">' +
            '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;font-weight:800;margin-bottom:8px;">How Gifts Work</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.8;">' +
            '<strong style="color:var(--text);">🎡 Earn:</strong> Spin the daily wheel to earn 5 gifts.<br>' +
            '<strong style="color:var(--text);">🧡 Send:</strong> Send gifts to your peers. You earn +25 XP per gift sent!<br>' +
            '<strong style="color:var(--text);">🎁 Open:</strong> Your peers can open up to 20 gifts per day.<br>' +
            '<strong style="color:var(--text);">🎫 Rewards:</strong> Each gift contains 1-3 Orange Tickets.' +
            '</div></div>';

        container.innerHTML = html;
    } catch(e) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444;font-size:0.85rem;">Could not load gifts: ' + (e.message || 'error') + '</div>';
    }
};

console.log('[gifting] v1 loaded');
})();
