// ---- USER NOTIFICATIONS SYSTEM ----
// Red badge on username display + DM badge on bottom nav
// Firestore collection: notifications/{notifId}

window._notifCount = 0;
window._notifUnsub = null;
window._dmUnreadCount = 0;

// ---- NWC Security Alert (2026-08-04) ----
// Fires on sign-in if the user has an active NWC wallet in localStorage.
// NWC state is client-only — server cannot target these users by UID.
// Shows a 60-second sticky banner + writes a deduped Firestore notification.
window._checkNWCSecurityAlert = function() {
    var DEDUP_KEY = 'btc_nwc_sec_alert_v1';
    if (localStorage.getItem(DEDUP_KEY)) return;
    var lnState = null;
    try { lnState = JSON.parse(localStorage.getItem('btc_ln_state') || 'null'); } catch(e) {}
    if (!lnState || lnState.method !== 'nwc') return;
    localStorage.setItem(DEDUP_KEY, '1');
    // Write persistent in-app notification (deduped doc ID — safe to re-call)
    if (typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous && typeof db !== 'undefined') {
        var uid = auth.currentUser.uid;
        db.collection('notifications').doc('nwc_sec_alert_v1_' + uid.replace(/[^a-zA-Z0-9]/g,'_')).set({
            recipientId: uid,
            senderId: 'system',
            senderName: 'Bitcoin Quest Team',
            type: 'security',
            message: '\ud83d\udd10 Security Notice (NWC Wallet): A vulnerability was patched where your NWC connection string secret was visible to relay operators. Please generate a new NWC URI from your wallet app as a precaution. Your funds are NOT at risk. Questions? info.603btc@gmail.com',
            targetType: null,
            targetId: null,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function() {});
    }
    // 60-second sticky dismissible banner
    if (document.getElementById('nwcSecAlert')) return;
    if (typeof window.claimSessionPopup === 'function') window.claimSessionPopup('nwc');
    var timeLeft = 60;
    var banner = document.createElement('div');
    banner.id = 'nwcSecAlert';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:999999;' +
        'background:linear-gradient(135deg,#4338ca,#7c3aed);color:#fff;padding:14px 16px 16px;' +
        'box-shadow:0 -4px 32px rgba(0,0,0,0.55);font-family:inherit;';
    banner.innerHTML =
        '<style>@keyframes _nwcUp{from{transform:translateY(100%)}to{transform:translateY(0)}}' +
        '#nwcSecAlert{animation:_nwcUp 0.4s ease-out}</style>' +
        '<div style="max-width:720px;margin:0 auto;display:flex;align-items:flex-start;gap:12px;">' +
            '<div style="font-size:1.5rem;flex-shrink:0;padding-top:2px;">\ud83d\udd10</div>' +
            '<div style="flex:1;min-width:0;">' +
                '<div style="font-weight:800;font-size:0.9rem;margin-bottom:4px;">Security Notice — Action Required (NWC Wallet Users)</div>' +
                '<div style="font-size:0.78rem;line-height:1.55;opacity:0.93;">' +
                    'A vulnerability has been patched (caught via Kimi K3 code audit) where your NWC connection string secret was visible to whoever operates the relay endpoint in your NWC URI. ' +
                    '<strong>Please generate a new NWC URI</strong> from your wallet app (Alby Hub, Umbrel, Zeus, LNbits, etc.) and reconnect. ' +
                    'This is precautionary — your funds are NOT at risk and we do not hold user funds. ' +
                    'We are always working to keep Bitcoin Quest secure and apologise this occurred. ' +
                    'Questions? <strong>info.603btc@gmail.com</strong> — Phil' +
                '</div>' +
            '</div>' +
            '<div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:6px;">' +
                '<span id="_nwcAlertTimer" style="font-size:0.65rem;opacity:0.65;">' + timeLeft + 's</span>' +
                '<button id="_nwcAlertDismiss" style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);' +
                    'color:#fff;padding:5px 14px;border-radius:7px;font-size:0.75rem;cursor:pointer;font-family:inherit;white-space:nowrap;">\u2715 Dismiss</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(banner);
    var _dismiss = function() {
        var b = document.getElementById('nwcSecAlert');
        if (b) { b.style.opacity = '0'; b.style.transition = 'opacity 0.4s'; setTimeout(function() { b.remove(); }, 400); }
        clearInterval(_cd);
    };
    document.getElementById('_nwcAlertDismiss').addEventListener('click', _dismiss);
    var _cd = setInterval(function() {
        timeLeft--;
        var el = document.getElementById('_nwcAlertTimer');
        if (el) el.textContent = timeLeft + 's';
        if (timeLeft <= 0) { _dismiss(); }
    }, 1000);
};

// One combined unlock toast for badges the counter backfill already granted.
// The flag is server-written. The client only asks the callable to clear it.
window.presentBadgeBackfillToast = function(user) {
    var toast = user && user.badgeBackfillToast;
    if (!toast || toast.v !== 1 || !toast.message) return;
    if (window._badgeBackfillToastShown) return;
    // A deep link hides toasts. Leave the server flag so the next
    // ordinary home load can show this once.
    if (window._directLinkMode) return;
    if (typeof showToast !== 'function') return;
    window._badgeBackfillToastShown = true;
    showToast(toast.message, 6500);
    try {
        var ack = firebase.functions().httpsCallable('ackBadgeBackfillToast');
        ack({}).catch(function() {});
    } catch (e) {}
};

function presentBadgeCollection() {
    var lb = document.getElementById('leaderboard');
    var open = lb && lb.classList.contains('open') && !lb.classList.contains('minimized');
    if (!open && typeof toggleLeaderboard === 'function') toggleLeaderboard();
    var tries = 0;
    var timer = setInterval(function() {
        tries += 1;
        var headers = document.querySelectorAll('#leaderboard h4');
        for (var i = 0; i < headers.length; i++) {
            if (headers[i].textContent === 'Your Badges') {
                headers[i].scrollIntoView({ block: 'start' });
                clearInterval(timer);
                return;
            }
        }
        if (tries > 20) clearInterval(timer);
    }, 300);
}

// Start listening for notifications
window.initNotifications = function() {
    if (!auth || !auth.currentUser || typeof db === 'undefined') return;
    var uid = auth.currentUser.uid;

    // Cleanup previous listener
    if (window._notifUnsub) { window._notifUnsub(); window._notifUnsub = null; }

    // NWC security alert — fires once per device if NWC wallet is connected
    setTimeout(window._checkNWCSecurityAlert, 3000);
    db.collection('users').doc(uid).get().then(function(snap) {
        if (snap.exists) window.presentBadgeBackfillToast(snap.data());
    }).catch(function() {});
    if (typeof window.syncPushRegistration === 'function') window.syncPushRegistration();
    if (typeof window.schedulePushPrompt === 'function') window.schedulePushPrompt();
    window._pushSnapReady = false;

    // Listen for unread notifications
    window._notifUnsub = db.collection('notifications')
        .where('recipientId', '==', uid)
        .where('read', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .onSnapshot(function(snap) {
            window._notifCount = snap.size;
            updateNotifBadge();
            // Track received tips for badge counter
            snap.docChanges().forEach(function(change) {
                if (change.type !== 'added') return;
                var nd = change.doc.data();
                if (nd.type === 'tip') {
                    var _tr = parseInt(localStorage.getItem('btc_tips_received') || '0'); localStorage.setItem('btc_tips_received', String(_tr + 1));
                    // Coin pickup sound for tip received
                    if (typeof window.playCoinSound === 'function') window.playCoinSound();
                }
                // Partnership level-up popup — fires live when CF writes the notification
                if (nd.type === 'peer_level_up') {
                    showPartnershipLevelUpPopup(nd);
                }
                // A shared cipher prize. No push. The reveal runs once, then
                // ackCipherShare sets the server flag so the next visit skips it.
                if (nd.type === 'cipher_share' && nd.revealed !== true) {
                    var sharePayload = {};
                    var shareKey;
                    for (shareKey in nd) if (Object.prototype.hasOwnProperty.call(nd, shareKey)) sharePayload[shareKey] = nd[shareKey];
                    sharePayload.id = change.doc.id;
                    (function(payload) {
                        var tries = 0;
                        var timer = setInterval(function() {
                            if (typeof window.showCipherShareReveal === 'function') {
                                clearInterval(timer);
                                window.showCipherShareReveal(payload);
                            } else if (++tries > 40) clearInterval(timer);
                        }, 250);
                    })(sharePayload);
                }
                // Skip the initial unread backlog. Later arrivals are high-value moments.
                if (window._pushSnapReady && typeof window.notePushMoment === 'function') {
                    var pt = nd.type;
                    if (pt === 'leaderboard_reward' || pt === 'tip' || pt === 'sats') window.notePushMoment('win');
                    if (pt === 'keys_received' || pt === 'peer_request' || pt === 'peer_accepted' || pt === 'peer_level_up' || pt === 'gift_received') window.notePushMoment('gift');
                }
            });
            window._pushSnapReady = true;
        }, function(err) { console.warn('[notif] Listener error:', err); });

    // Listen for unread DMs via onSnapshot (replaces 30s polling — saves ~2800 reads/user/day)
    startDMListener(uid);
};

function startDMListener(uid) {
    if (window._dmUnsub) { window._dmUnsub(); window._dmUnsub = null; }
    if (!uid || typeof db === 'undefined') return;
    try {
        window._dmUnsub = db.collection('dm_conversations')
            .where('participants', 'array-contains', uid)
            .where('lastMessageTime', '>', new Date(Date.now() - 86400000))
            .onSnapshot(function(snap) {
                var unread = 0;
                snap.forEach(function(doc) {
                    var d = doc.data();
                    var lastRead = d['lastRead_' + uid];
                    if (d.lastMessageTime && (!lastRead || d.lastMessageTime.toMillis() > lastRead.toMillis())) {
                        unread++;
                    }
                });
                window._dmUnreadCount = unread;
                updateDMBadge();
            }, function(err) {
                console.warn('[notif] DM listener error:', err);
                // Fallback: one-time read, no retry loop
                checkUnreadDMsOnce();
            });
    } catch(e) {
        checkUnreadDMsOnce();
    }
    // Refresh the 24h window every 30 min so stale conversations drop off
    if (window._dmRefreshTimer) clearInterval(window._dmRefreshTimer);
    window._dmRefreshTimer = setInterval(function() { startDMListener(uid); }, 1800000);
}

// One-time fallback (no interval) — used only if onSnapshot fails
function checkUnreadDMsOnce() {
    if (!auth || !auth.currentUser || typeof db === 'undefined') return;
    var uid = auth.currentUser.uid;
    db.collection('dm_conversations')
        .where('participants', 'array-contains', uid)
        .where('lastMessageTime', '>', new Date(Date.now() - 86400000))
        .get().then(function(snap) {
            var unread = 0;
            snap.forEach(function(doc) {
                var d = doc.data();
                var lastRead = d['lastRead_' + uid];
                if (d.lastMessageTime && (!lastRead || d.lastMessageTime.toMillis() > lastRead.toMillis())) {
                    unread++;
                }
            });
            window._dmUnreadCount = unread;
            updateDMBadge();
        }).catch(function() {});
}

// Update the red notification dot on username display
function updateNotifBadge() {
    var count = window._notifCount || 0;
    // Add/update badge on userDisplay
    var ud = document.getElementById('userDisplay');
    if (!ud) return;
    var existing = document.getElementById('notifBadge');
    if (count > 0) {
        if (!existing) {
            var badge = document.createElement('div');
            badge.id = 'notifBadge';
            badge.style.cssText = 'position:absolute;top:-4px;left:-4px;background:#ef4444;color:#fff;font-size:0.6rem;font-weight:800;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px;cursor:pointer;z-index:10;';
            badge.onclick = function(e) { e.stopPropagation(); showNotifications(); };
            ud.style.position = 'relative';
            ud.appendChild(badge);
        }
        existing = document.getElementById('notifBadge');
        if (existing) existing.textContent = count > 9 ? '9+' : count;
    } else if (existing) {
        existing.remove();
    }
}

// Update DM unread badge on bottom nav
function updateDMBadge() {
    var badge = document.getElementById('bnavMsgBadge');
    if (badge) {
        if (window._dmUnreadCount > 0) {
            badge.textContent = window._dmUnreadCount > 9 ? '9+' : window._dmUnreadCount;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
}

function notifIcon(n) {
    if (n && n.icon && String(n.icon).length <= 8 && String(n.icon).indexOf('<') === -1) return n.icon;
    var icons = {
        upvote: '👍', reply: '💬', tip: '⚡', comment: '💬', like: '❤️', mention: '🔔',
        level_up: '🎉', badge: '🏅', quest: '🏆', spin: '🎡', prediction: '📊',
        welcome: '👋', chat_mention: '💬', dj: '🎧', referral: '👥', closet: '👔',
        sats: '⚡', dm: '💬', streak: '🔥', milestone: '🗺️', buddy: '🤝',
        leaderboard_reward: '🏆', security: '🔐', reward: '✨', inventory: '🎒'
    };
    var icon = (n && icons[n.type]) || '🔔';
    if (n && n.type === 'peer_request') icon = '🧡';
    if (n && n.type === 'peer_accepted') icon = '🧡';
    if (n && n.type === 'gift_received') icon = '🎁';
    if (n && n.type === 'keys_received') icon = '🔑';
    if (n && n.type === 'cipher_share') icon = '🔓';
    if (n && n.type === 'peer_level_up') icon = '⚡';
    return icon;
}

var NOTIF_TARGET_TYPES = {
    forum_post: 1, article: 1, dm: 1, peer_request: 1,
    beats_track: 1, marketplace: 1, song: 1, chat: 1, pvp: 1, buddy: 1,
    topic_post: 1, badges: 1
};

function notifSafeId(value, max) {
    max = max || 64;
    return typeof value === 'string' && value.length >= 1 && value.length <= max && /^[A-Za-z0-9_-]+$/.test(value);
}

function notifSafeTarget(targetType, targetId) {
    if (!targetType || !NOTIF_TARGET_TYPES[targetType]) return { type: '', id: '' };
    if (targetType === 'peer_request' || targetType === 'chat') {
        return { type: targetType, id: notifSafeId(targetId, 64) ? targetId : '' };
    }
    if (!notifSafeId(targetId, 64)) return { type: '', id: '' };
    return { type: targetType, id: targetId };
}

function notifEscape(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function notifNameHtml(n, message, fromUid) {
    var html = notifEscape(message || '');
    var uid = '';
    if (n && n.senderId && typeof userTagUidOk === 'function' && userTagUidOk(String(n.senderId))) uid = String(n.senderId);
    else if (fromUid && typeof userTagUidOk === 'function' && userTagUidOk(String(fromUid))) uid = String(fromUid);
    var senderName = n && (n.senderName || n.fromName) ? String(n.senderName || n.fromName) : '';
    if (!uid || !senderName || typeof userTag !== 'function') return html;
    var escapedName = notifEscape(senderName);
    if (!escapedName || html.indexOf(escapedName) === -1) return html;
    return html.replace(escapedName, userTag(uid, senderName));
}

function notifCardHtml(docId, n, variant) {
    n = n || {};
    var safeDoc = notifSafeId(docId, 128) ? docId : '';
    var target = notifSafeTarget(n.targetType, n.targetId);
    var giftId = (n.type === 'gift_received' && notifSafeId(n.giftId, 64)) ? n.giftId : '';
    var fromUid = (n.type === 'peer_request' && notifSafeId(n.fromUid, 64)) ? n.fromUid : '';
    var isUnread = !n.read;
    var sheet = variant === 'sheet';
    var timeStr = '';
    if (n.createdAt && n.createdAt.toDate) {
        var ts = n.createdAt.toDate();
        timeStr = sheet
            ? formatNotifTime(ts)
            : (typeof timeAgo === 'function' ? timeAgo(ts) : ts.toLocaleDateString());
    }
    var completed = n.status === 'completed';
    var extra = '';
    if (!completed && fromUid && safeDoc) {
        extra = '<div style="display:flex;gap:6px;margin-top:6px;">' +
            '<button type="button" class="notif-peer-btn" data-peer-action="accept" data-from-uid="' + notifEscape(fromUid) + '" data-notif-id="' + notifEscape(safeDoc) + '" style="flex:1;padding:5px 8px;background:#f97316;border:none;border-radius:6px;color:#fff;font-size:0.78rem;font-weight:600;cursor:pointer;font-family:inherit;">Accept</button>' +
            '<button type="button" class="notif-peer-btn" data-peer-action="decline" data-from-uid="' + notifEscape(fromUid) + '" data-notif-id="' + notifEscape(safeDoc) + '" style="flex:1;padding:5px 8px;background:none;border:1px solid var(--border);border-radius:6px;color:var(--text-muted);font-size:0.78rem;cursor:pointer;font-family:inherit;">Decline</button>' +
            '</div>';
    }
    if (!completed && n.type === 'keys_received') {
        extra = '<div style="margin-top:6px;"><button type="button" class="notif-keys-btn" style="width:100%;padding:7px 8px;background:linear-gradient(135deg,#f7931a,#ea580c);border:none;border-radius:6px;color:#fff;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">🔑 See keys</button></div>';
    }
    if (!completed && giftId && safeDoc) {
        extra = '<div style="margin-top:6px;">' +
            '<button type="button" class="notif-open-gift" data-gift-id="' + notifEscape(giftId) + '" data-notif-id="' + notifEscape(safeDoc) + '" style="width:100%;padding:7px 8px;background:linear-gradient(135deg,#f7931a,#ea580c);border:none;border-radius:6px;color:#fff;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">🎁 Open Gift</button>' +
            '</div>';
    }
    if (completed) {
        extra = '<div class="notif-status" style="margin-top:6px;font-size:0.72rem;font-weight:800;color:var(--text-muted);">Completed</div>';
    }
    var message = n.message || '';
    if ((target.type === 'beats_track' || n.targetType === 'beats_track') && typeof beatsCensor === 'function') {
        message = beatsCensor(message);
    }
    var icon = notifIcon(n);
    var iconHtml = '';
    if (!icon || message.indexOf(icon) !== 0) {
        iconHtml = '<span style="font-size:' + (sheet ? '1.2rem' : '1.1rem') + ';flex-shrink:0;">' + notifEscape(icon) + '</span>';
    }
    var statusAttr = (n.status === 'completed') ? ' data-status="completed"' : '';
    return '<div class="notif-card"' + statusAttr + ' data-notif-id="' + notifEscape(safeDoc) + '" data-target-type="' + notifEscape(target.type) + '" data-target-id="' + notifEscape(target.id) + '" data-unread="' + (isUnread ? '1' : '0') + '" style="padding:' + (sheet ? '12px 16px' : '10px') + ';border-bottom:1px solid var(--border);background:' + (isUnread ? 'rgba(247,147,26,0.04)' : 'none') + ';cursor:pointer;">' +
        '<div style="display:flex;gap:' + (sheet ? '10px' : '8px') + ';align-items:flex-start;">' +
            iconHtml +
            '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:0.82rem;color:var(--text);line-height:1.4;' + (isUnread ? 'font-weight:600;' : '') + '">' + notifNameHtml(n, message, fromUid) + '</div>' +
                notifAmountChips(n, message) +
                '<div style="font-size:' + (sheet ? '0.65rem' : '0.7rem') + ';color:var(--text-faint);margin-top:' + (sheet ? '3px' : '2px') + ';">' + notifEscape(timeStr) + '</div>' +
            '</div>' +
            (isUnread ? '<div style="width:8px;height:8px;border-radius:50%;background:#f7931a;flex-shrink:0;margin-top:6px;"></div>' : '') +
        '</div>' + extra +
    '</div>';
}

function bindNotifCards(root, closeAfter) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('.notif-card').forEach(function(row) {
        row.addEventListener('click', function() {
            var id = row.getAttribute('data-notif-id') || '';
            var safe = notifSafeTarget(row.getAttribute('data-target-type') || '', row.getAttribute('data-target-id') || '');
            if (!notifSafeId(id, 128)) return;
            handleNotifClick(id, safe.type, safe.id);
            if (closeAfter && typeof toggleNotifOverlay === 'function') toggleNotifOverlay();
        });
        row.addEventListener('mouseover', function() { row.style.background = 'rgba(255,255,255,0.03)'; });
        row.addEventListener('mouseout', function() {
            row.style.background = row.getAttribute('data-unread') === '1' ? 'rgba(247,147,26,0.04)' : 'none';
        });
    });
    root.querySelectorAll('.notif-open-gift').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var giftId = btn.getAttribute('data-gift-id') || '';
            var id = btn.getAttribute('data-notif-id') || '';
            if (!notifSafeId(giftId, 64) || !notifSafeId(id, 128)) return;
            if (typeof window.openGiftModal === 'function') {
                window.openGiftModal(giftId);
                try { db.collection('notifications').doc(id).update({ read: true }); } catch (err) {}
            } else if (typeof showToast === 'function') showToast('Loading gifts...');
        });
    });
    root.querySelectorAll('.notif-peer-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var action = btn.getAttribute('data-peer-action') || '';
            var fromUid = btn.getAttribute('data-from-uid') || '';
            var id = btn.getAttribute('data-notif-id') || '';
            if ((action !== 'accept' && action !== 'decline') || !notifSafeId(fromUid, 64) || !notifSafeId(id, 128)) return;
            handlePeerNotifAction(action, fromUid, id, btn);
        });
    });
    root.querySelectorAll('.notif-keys-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (typeof window.openNookInventory === 'function') window.openNookInventory();
        });
    });
}

function notifAmountChips(n, message) {
    if (!n) return '';
    var chips = [];
    function chip(v, label, bg) {
        var num = Number(v);
        if (!num) return;
        var sign = num > 0 ? '+' : '';
        chips.push('<span style="display:inline-block;margin:4px 6px 0 0;padding:2px 8px;border-radius:999px;background:' + bg + ';color:var(--text);font-size:0.68rem;font-weight:800;line-height:1.4;">' + sign + num.toLocaleString() + ' ' + label + '</span>');
    }
    var xpNum = Number(n.xp) || 0;
    if (!message || String(message).indexOf('(+' + xpNum + ' XP)') === -1) chip(n.xp, 'XP', 'rgba(247,147,26,0.18)');
    chip(n.tickets, '🎟️', 'rgba(249,115,22,0.18)');
    chip(n.sats, 'sats', 'rgba(234,179,8,0.2)');
    chip(n.freezes, '🧊', 'rgba(56,189,248,0.18)');
    if (!chips.length) return '';
    return '<div style="display:flex;flex-wrap:wrap;margin-top:2px;">' + chips.join('') + '</div>';
}

function _localRewardList() {
    try { return JSON.parse(localStorage.getItem('btc_local_reward_notices') || '[]'); }
    catch (e) { return []; }
}

function _stashLocalReward(id, message, icon, kind) {
    if (!id || !message) return;
    try {
        var list = _localRewardList();
        if (list.some(function(x) { return x.id === id; })) return;
        list.push({ id: String(id).slice(0, 120), message: String(message).slice(0, 180), icon: icon || '🔔', kind: kind || '', ts: Date.now(), read: false });
        if (list.length > 80) list = list.slice(list.length - 80);
        localStorage.setItem('btc_local_reward_notices', JSON.stringify(list));
    } catch (e) {}
    if (typeof _updatePointsBadge === 'function') _updatePointsBadge();
}

function _isSignedInAccount() {
    return !!(auth && auth.currentUser && !auth.currentUser.isAnonymous);
}

// Signed-in badge/rank notices come from Cloud Functions. Titles, hidden
// badges, and closet drops are still awarded in the browser, so those stay
// on this device for every user. Anonymous progress is entirely local.
function _visibleLocalRewards() {
    var list = _localRewardList();
    if (!_isSignedInAccount()) return list;
    return list.filter(function(n) {
        return n.kind === 'title' || n.kind === 'hidden' || n.kind === 'closet';
    });
}

function _localRewardHtml() {
    var visible = _visibleLocalRewards();
    if (!visible.length) return '';
    var esc = typeof escapeHtml === 'function' ? escapeHtml : function(s) { return s || ''; };
    var html = '';
    for (var i = visible.length - 1; i >= 0; i--) {
        var n = visible[i];
        html += '<div style="padding:12px 16px;border-bottom:1px solid var(--border);background:' + (n.read ? 'none' : 'rgba(247,147,26,0.04)') + ';">' +
            '<div style="display:flex;gap:10px;align-items:flex-start;">' +
                '<span style="font-size:1.2rem;flex-shrink:0;">' + notifIcon(n) + '</span>' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:0.82rem;color:var(--text);line-height:1.4;">' + esc(n.message || '') + '</div>' +
                    '<div style="font-size:0.65rem;color:var(--text-faint);margin-top:3px;">On this device</div>' +
                '</div>' +
            '</div></div>';
    }
    try {
        var seen = {};
        visible.forEach(function(n) { seen[n.id] = true; });
        var list = _localRewardList();
        list.forEach(function(n) { if (seen[n.id]) n.read = true; });
        localStorage.setItem('btc_local_reward_notices', JSON.stringify(list));
    } catch (e) {}
    if (typeof _updatePointsBadge === 'function') _updatePointsBadge();
    return html;
}

// Show notifications panel
window.showNotifications = async function() {
    if (!auth || !auth.currentUser || typeof db === 'undefined') return;
    var uid = auth.currentUser.uid;

    var overlay = document.createElement('div');
    overlay.id = 'notifOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.7);display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var card = document.createElement('div');
    card.style.cssText = 'background:var(--bg-side,#1a1a2e);border:1px solid var(--border);border-radius:16px;padding:20px;max-width:400px;width:100%;margin:40px auto;max-height:70vh;overflow-y:auto;';
    card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<h3 style="color:var(--heading);margin:0;">🔔 Notifications</h3>' +
        '<div style="display:flex;gap:8px;">' +
            '<button onclick="markAllNotifsRead()" style="padding:4px 10px;background:none;border:1px solid var(--border);border-radius:6px;color:var(--text-muted);font-size:0.7rem;cursor:pointer;font-family:inherit;">Mark all read</button>' +
            '<button onclick="document.getElementById(\'notifOverlay\').remove()" style="background:none;border:1px solid var(--border);color:var(--text-muted);width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;">✕</button>' +
        '</div></div>' +
        '<div id="notifList"><div style="text-align:center;padding:20px;color:var(--text-muted);">Loading...</div></div>';

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Load notifications
    try {
        var snap = await db.collection('notifications')
            .where('recipientId', '==', uid)
            .orderBy('createdAt', 'desc')
            .limit(30)
            .get();

        var list = document.getElementById('notifList');
        if (!list) return;
        if (snap.empty) {
            var onlyLocal = _localRewardHtml();
            list.innerHTML = onlyLocal || '<div style="text-align:center;padding:30px;color:var(--text-faint);">No notifications yet! 🦌</div>';
            return;
        }

        var html = _localRewardHtml();
        snap.forEach(function(doc) {
            html += notifCardHtml(doc.id, doc.data(), 'panel');
        });
        list.innerHTML = html;
        bindNotifCards(list, false);
    } catch(e) {
        var list = document.getElementById('notifList');
        if (list) list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.82rem;">Could not load notifications</div>';
    }
};

// Peer notification action handler
window.handlePeerNotifAction = async function(action, fromUid, notifId, btnEl) {
    if (!btnEl) return;
    btnEl.disabled = true;
    btnEl.textContent = '...';
    try {
        var fn = firebase.functions().httpsCallable('managePeer');
        await fn({ action: action, targetUid: fromUid });
        // Dismiss the notification row
        var row = btnEl.closest('[data-notif-id]');
        if (row) row.remove();
        if (typeof showToast === 'function') {
            showToast(action === 'accept' ? 'Peer request accepted! 🧡' : 'Request declined');
        }
        if (action === 'accept') {
            // Refresh peer cache
            if (auth && auth.currentUser && typeof db !== 'undefined') {
                db.collection('users').doc(auth.currentUser.uid).get().then(function(snap) {
                    if (snap.exists) window._myPeers = new Set(snap.data().peers || []);
                });
            }
        }
    } catch(e) {
        btnEl.disabled = false;
        btnEl.textContent = action === 'accept' ? 'Accept' : 'Decline';
        if (typeof showToast === 'function') showToast('Error: ' + (e.message || 'Try again'));
    }
};

// Handle notification click — navigate to content
window.handleNotifClick = async function(notifId, targetType, targetId) {
    if (!notifSafeId(notifId, 128)) return;
    var safe = notifSafeTarget(targetType, targetId);
    try { await db.collection('notifications').doc(notifId).update({ read: true }); } catch(e) {}
    var ov = document.getElementById('notifOverlay');
    if (ov) ov.remove();
    if (safe.type === 'forum_post' && safe.id) { if (typeof forumViewPost === 'function') forumViewPost(safe.id); }
    else if (safe.type === 'article' && safe.id) { if (typeof articleView === 'function') articleView(safe.id); }
    else if (safe.type === 'dm' && safe.id) {
        // targetId is convoId (uid1_uid2). Extract the other user's UID and open their DM directly.
        try {
            var notifDoc = await db.collection('notifications').doc(notifId).get();
            var nd = notifDoc.exists ? notifDoc.data() : null;
            if (nd && nd.senderId && typeof openDM === 'function') {
                openDM(nd.senderId, nd.senderName || 'Bitcoiner');
            } else if (typeof showInbox === 'function') {
                showInbox();
            }
        } catch(e) {
            if (typeof showInbox === 'function') showInbox();
        }
    }
    else if (safe.type === 'peer_request') {
        if (typeof showSettingsPage === 'function') showSettingsPage('peers');
        return;
    }
    else if (safe.type === 'badges') {
        presentBadgeCollection();
        return;
    }
    else if (safe.type === 'topic_post' && safe.id) {
        try {
            var topicNotice = await db.collection('notifications').doc(notifId).get();
            var topicData = topicNotice.exists ? topicNotice.data() : null;
            var topicChannel = topicData && topicData.topicChannel;
            if (topicChannel && typeof window.bqOpenTopicPost === 'function') window.bqOpenTopicPost(topicChannel, safe.id);
        } catch (e) {}
    }
};

// Mark all as read
window.markAllNotifsRead = async function() {
    if (!auth || !auth.currentUser) return;
    var uid = auth.currentUser.uid;
    try {
        var snap = await db.collection('notifications')
            .where('recipientId', '==', uid)
            .where('read', '==', false)
            .get();
        var batch = db.batch();
        snap.forEach(function(doc) { batch.update(doc.ref, { read: true }); });
        await batch.commit();
        if (typeof showToast === 'function') showToast('✅ All notifications marked as read');
        var ov = document.getElementById('notifOverlay');
        if (ov) ov.remove();
    } catch(e) {}
};

// Send a notification to a user
window.sendNotification = async function(recipientId, type, message, targetType, targetId) {
    if (!recipientId || !auth || !auth.currentUser) return;
    if (recipientId === auth.currentUser.uid) return; // don't notify yourself
    try {
        var safeTarget = notifSafeTarget(targetType, targetId);
        await db.collection('notifications').add({
            recipientId: recipientId,
            senderId: auth.currentUser.uid,
            senderName: (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Someone',
            type: type,
            message: message,
            targetType: safeTarget.type || null,
            targetId: safeTarget.id || null,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch(e) { console.warn('[notif] Send error:', e); }
};

// ---- Notification Overlay (floating 🔔 button) ----
var _notifOverlayOpen = false;

function createNotifOverlay() {
    if (document.getElementById('notifOverlayBtn')) return;
    try {
        var _ph = location.hostname;
        if ((_ph === 'localhost' || _ph === '127.0.0.1') && /previewPush=/.test(location.search || '')) return;
    } catch (e) {}

    var btn = document.createElement('button');
    btn.id = 'notifOverlayBtn';
    btn.innerHTML = '🔔';
    btn.title = 'Notifications';
    btn.style.cssText = 'position:fixed;top:12px;right:20px;z-index:300;width:44px;height:44px;border-radius:50%;background:var(--card-bg,#1a1a2e);color:#fff;border:1px solid var(--border);font-size:1.1rem;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.4);transition:transform 0.2s,opacity 0.2s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;';
    btn.onclick = toggleNotifOverlay;

    // Badge
    var badge = document.createElement('span');
    badge.id = 'notifOverlayBadge';
    badge.style.cssText = 'display:none;position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:0.55rem;font-weight:800;padding:2px 5px;border-radius:8px;min-width:14px;text-align:center;';
    btn.appendChild(badge);

    // Panel
    var panel = document.createElement('div');
    panel.id = 'notifPanel';
    panel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:298;height:65vh;max-height:500px;background:var(--bg,#0a0a0f);border-top:2px solid #6366f1;border-radius:16px 16px 0 0;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.22,1,0.36,1);display:flex;flex-direction:column;box-shadow:0 -8px 32px rgba(0,0,0,0.5);';

    var header = document.createElement('div');
    header.style.cssText = 'flex-shrink:0;border-bottom:1px solid var(--border);';
    header.innerHTML = '<div style="padding:10px 16px 0;display:flex;align-items:center;justify-content:space-between;">' +
        '<span style="font-weight:700;font-size:0.85rem;color:var(--heading,#fff);">🔔 Notifications</span>' +
        '<button onclick="toggleNotifOverlay()" style="background:none;border:none;color:var(--text-faint);font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>' +
    '</div>' +
    '<div style="display:flex;gap:6px;padding:8px 16px 8px;">' +
        '<button id="notifTabAll" onclick="window._notifTab=\'all\';_setNotifTabActive();renderNotifList()" style="padding:5px 14px;border-radius:16px;border:1px solid var(--accent);background:var(--accent);color:#fff;font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">All</button>' +
        '<button id="notifTabPts" onclick="window._notifTab=\'points\';_setNotifTabActive();_renderPointsTab()" style="padding:5px 14px;border-radius:16px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">⚡ XP</button>' +
        '<button onclick="markAllNotifsRead();_markAllPointsRead();renderNotifList()" style="margin-left:auto;padding:4px 10px;background:none;border:1px solid var(--border);border-radius:6px;color:var(--text-muted);font-size:0.6rem;cursor:pointer;font-family:inherit;">Mark all read</button>' +
    '</div>';

    var body = document.createElement('div');
    body.id = 'notifPanelBody';
    body.style.cssText = 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;';

    panel.appendChild(header);
    panel.appendChild(body);
    document.body.appendChild(panel);
    document.body.appendChild(btn);

    var style = document.createElement('style');
    style.textContent = '@media(min-width:901px){#notifPanel{max-width:400px;right:16px;left:auto;border-radius:16px 16px 0 0;}}@media(max-width:900px){#notifOverlayBtn{display:none!important;}}';
    document.head.appendChild(style);

    // Position notif bell to left of userDisplay on desktop, or inside branding dashboard
// Position notif bell to left of userDisplay on desktop, or inside branding dashboard
    function positionNotifBell() {
        if (window.innerWidth <= 900) return;
        var placeholder = document.getElementById('notifBellPlaceholder');
        var nb = document.getElementById('notifOverlayBtn');
        if (!nb) return;

        if (placeholder) {
            // Tablet/Laptop: Move bell next to dashboard info
            var rect = placeholder.getBoundingClientRect();
            nb.style.position = 'fixed';
            nb.style.top = (rect.top - 2) + 'px';
            nb.style.left = (rect.left - 2) + 'px';
            nb.style.right = 'auto';
            nb.style.margin = '0';
            nb.style.boxShadow = 'none';
            nb.style.background = 'rgba(255,255,255,0.05)';
        } else {
            // Traditional position fallback
            var ud = document.getElementById('userDisplay');
            if (ud && ud.style.display !== 'none' && ud.offsetWidth > 0) {
                nb.style.top = ud.style.top || '12px';
                nb.style.right = (parseInt(ud.style.right || '20') + ud.offsetWidth + 12) + 'px';
                nb.style.left = 'auto';
            } else {
                nb.style.top = '12px';
                nb.style.right = '20px';
                nb.style.left = 'auto';
            }
        }
    }
    // Re-position periodically (userDisplay loads async)
    setInterval(positionNotifBell, 2000);
    setTimeout(positionNotifBell, 1500);
}

window.toggleNotifOverlay = function() {
    var panel = document.getElementById('notifPanel');
    var btn = document.getElementById('notifOverlayBtn');
    if (!panel) return;

    _notifOverlayOpen = !_notifOverlayOpen;
    window._notifOverlayOpen = _notifOverlayOpen;
    panel.style.transform = _notifOverlayOpen ? 'translateY(0)' : 'translateY(100%)';

    if (btn) {
        btn.innerHTML = _notifOverlayOpen ? '✕' : '🔔';
        var badge = document.getElementById('notifOverlayBadge');
        if (!_notifOverlayOpen && badge) btn.appendChild(badge);
    }

    if (_notifOverlayOpen) {
        history.pushState({ modal: 'notif' }, '', window.location.pathname + window.location.hash);
        window._notifTab = 'all';
        _setNotifTabActive();
        renderNotifList();
        // Clear badges
        var b = document.getElementById('notifOverlayBadge');
        if (b) b.style.display = 'none';
        var bb = document.getElementById('bnavNotifBadge');
        if (bb) bb.style.display = 'none';
    }
};

window.renderNotifList = async function() {
    var body = document.getElementById('notifPanelBody');
    if (!body) return;
    if (!auth || !auth.currentUser) {
        // Auth not ready yet — retry after short delay
        setTimeout(function() { if (typeof renderNotifList === 'function') renderNotifList(); }, 1500);
        body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.8rem;">Loading...</div>';
        return;
    }
    body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.8rem;">Loading...</div>';

    try {
        var snap = await db.collection('notifications')
            .where('recipientId', '==', auth.currentUser.uid)
            .orderBy('createdAt', 'desc')
            .limit(40)
            .get();

        if (snap.empty) {
            var onlyLocal = _localRewardHtml();
            body.innerHTML = onlyLocal || '<div style="text-align:center;padding:40px 20px;"><div style="font-size:2rem;margin-bottom:8px;">🔔</div><div style="color:var(--text-muted);font-size:0.85rem;">No notifications yet!</div></div>';
            return;
        }

        var html = _localRewardHtml();
        snap.forEach(function(doc) {
            html += notifCardHtml(doc.id, doc.data(), 'sheet');
        });
        body.innerHTML = html;
        bindNotifCards(body, true);
    } catch(e) {
        console.warn('[notif] renderNotifList error:', e);
        body.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:1.5rem;margin-bottom:8px;">🔔</div><div style="color:var(--text-muted);font-size:0.82rem;">No notifications yet</div></div>';
    }
};

function formatNotifTime(d) {
    var now = Date.now();
    var diff = Math.floor((now - d.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Update overlay badge when notification count changes
var _origUpdateNotifBadge = updateNotifBadge;
updateNotifBadge = function() {
    _origUpdateNotifBadge();
    // Merge server notif count + local points count
    _updatePointsBadge();
};

// ---- Self-Notifications (local events → Firestore) ----
// Notify on level up (leaderboard rank)
window.notifySelfLevelUp = function(minPts, levelName, emoji) {
    // Signed-in rank-ups are written once by the Cloud Function that grants the XP
    // (doc id rank_<uid>_<slug>). Anonymous and logged-out progress never reaches it.
    if (_isSignedInAccount()) return;
    _stashLocalReward('rank_' + (levelName || minPts), (emoji || '🎉') + ' Rank up: ' + (levelName || 'a new level') + '!', emoji || '🎉', 'rank');
};

// Notify on badge unlock
window.notifySelfBadge = function(badgeName, badgeEmoji) {
    // Signed-in catalog badges are notified once by awardPoints (badge_<uid>_<id>).
    // Anonymous earns stay on this device: rules block anonymous notification writes.
    if (_isSignedInAccount()) return;
    _stashLocalReward('badge_' + (badgeName || 'badge'), (badgeEmoji || '🏅') + ' New badge: ' + (badgeName || 'New badge') + '!', badgeEmoji || '🏅', 'badge');
};

// Notify on quest complete
window.notifySelfQuest = function(questName) {
    // gradeQuest writes the feed entry. Client creates of type quest are rejected.
};

// Notify on tip received (includes sender name)
window.notifyTipReceived = function(recipientId, amount, senderName) {
    if (!recipientId || !auth || !auth.currentUser) return;
    var name = senderName || (typeof currentUser !== 'undefined' && currentUser && currentUser.username) || 'Someone';
    db.collection('notifications').add({
        recipientId: recipientId,
        senderId: auth.currentUser.uid,
        senderName: name,
        type: 'tip',
        message: '⚡ @' + name + ' tipped you ' + (amount ? amount.toLocaleString() + ' sats' : '') + '!',
        targetType: null, targetId: null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
};

// Notify spin available
window.notifySpinAvailable = function() {
    if (!auth || !auth.currentUser) return;
    // Check if we already notified today
    var key = 'btc_spin_notif_' + new Date().toDateString();
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    db.collection('notifications').add({
        recipientId: auth.currentUser.uid,
        senderId: 'system', senderName: 'System',
        type: 'spin',
        message: '🎡 Your daily spin is ready! Try your luck for prizes.',
        targetType: null, targetId: null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
};

// Notify price prediction result
window.notifyPredictionResult = function(correct, direction) {
    // resolvePredictions writes the result. XP still arrives through awardPoints.
};

// Notify spin wheel result
window.notifySelfSpin = function(rewardText) {
    // dailySpin writes the feed entry inside the same transaction as the grant.
};

// Notify referral reward
window.notifySelfReferral = function(ticketsEarned) {
    // verifyReferral writes both ticket notices. Client creates are rejected.
};

// Notify Nacho closet item unlock
window.notifySelfClosetItem = function(itemName, itemEmoji) {
    // The spin function records a generic closet drop. The specific item is
    // chosen in the browser, so the named unlock stays on this device, once.
    _stashLocalReward('closet_' + (itemName || 'item'), (itemEmoji || '👔') + ' New closet item: ' + (itemName || 'Unknown') + '!', itemEmoji || '👔', 'closet');
};

// Notify @mention in global chat
window.notifyChatMention = function(recipientUid, senderName, preview) {
    if (!recipientUid || !auth || !auth.currentUser) return;
    if (recipientUid === auth.currentUser.uid) return;
    db.collection('notifications').add({
        recipientId: recipientUid,
        senderId: auth.currentUser.uid,
        senderName: senderName || 'Someone',
        type: 'chat_mention',
        message: '💬 @' + (senderName || 'Someone') + ' mentioned you in Global Chat: "' + (preview || '').substring(0, 60) + '"',
        targetType: 'chat', targetId: null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
};

// Tab switching UI
window._notifTab = 'all';
function _setNotifTabActive() {
    var allBtn = document.getElementById('notifTabAll');
    var ptsBtn = document.getElementById('notifTabPts');
    if (allBtn) {
        allBtn.style.background = window._notifTab === 'all' ? 'var(--accent)' : 'none';
        allBtn.style.color = window._notifTab === 'all' ? '#fff' : 'var(--text-muted)';
        allBtn.style.borderColor = window._notifTab === 'all' ? 'var(--accent)' : 'var(--border)';
    }
    if (ptsBtn) {
        ptsBtn.style.background = window._notifTab === 'points' ? 'var(--accent)' : 'none';
        ptsBtn.style.color = window._notifTab === 'points' ? '#fff' : 'var(--text-muted)';
        ptsBtn.style.borderColor = window._notifTab === 'points' ? 'var(--accent)' : 'var(--border)';
    }
}

// Init overlay
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(createNotifOverlay, 2500); });
} else {
    setTimeout(createNotifOverlay, 2500);
}

// Initialize on auth state change
if (typeof auth !== 'undefined' && auth) {
    auth.onAuthStateChanged(function(user) {
        if (user && !user.isAnonymous) {
            setTimeout(initNotifications, 2000);
        }
    });
}

// ---- Additional notification helpers ----

// notifySelfPoints is now defined in ranking.js (bundle) so it's available
// before this lazy-loaded script. Badge updates are called via _updatePointsBadge
// which is defined below and available once this script loads.

// Count unread points notifications
function _getUnreadPointsCount() {
    var local = 0;
    try {
        local = _visibleLocalRewards().filter(function(e) { return !e.read; }).length;
    } catch (e) {}
    try {
        var log = JSON.parse(localStorage.getItem('btc_points_log') || '[]');
        return log.filter(function(e) { return !e.read; }).length + local;
    } catch(e) { return local; }
}

// Update badge to include points count
function _updatePointsBadge() {
    var ptsCount = _getUnreadPointsCount();
    var serverCount = window._notifCount || 0;
    var total = serverCount + ptsCount;
    var badge = document.getElementById('notifOverlayBadge');
    if (badge) {
        if (total > 0 && !_notifOverlayOpen) {
            badge.textContent = total > 9 ? '9+' : total;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
    var bnavBadge = document.getElementById('bnavNotifBadge');
    if (bnavBadge) {
        if (total > 0 && !_notifOverlayOpen) {
            bnavBadge.textContent = total > 9 ? '9+' : total;
            bnavBadge.style.display = 'block';
        } else {
            bnavBadge.style.display = 'none';
        }
    }
}

// Mark all local points as read
function _markAllPointsRead() {
    try {
        var log = JSON.parse(localStorage.getItem('btc_points_log') || '[]');
        log.forEach(function(e) { e.read = true; });
        localStorage.setItem('btc_points_log', JSON.stringify(log));
    } catch(e) {}
    _updatePointsBadge();
}

// Render the points log tab
function _renderPointsTab() {
    var body = document.getElementById('notifPanelBody');
    if (!body) return;
    var log;
    try { log = JSON.parse(localStorage.getItem('btc_points_log') || '[]'); } catch(e) { log = []; }
    if (log.length === 0) {
        body.innerHTML = '<div style="text-align:center;padding:40px 20px;"><div style="font-size:2rem;margin-bottom:8px;">⭐</div><div style="color:var(--text-muted);font-size:0.85rem;">No XP earned yet!</div><div style="color:var(--text-faint);font-size:0.75rem;margin-top:4px;">Explore channels, answer quizzes, and chat with Nacho to earn XP.</div></div>';
        return;
    }
    // Mark all as read when viewing
    _markAllPointsRead();
    // Render most recent first
    var html = '';
    // Today total
    var today = new Date().toDateString();
    var todayTotal = 0;
    log.forEach(function(e) { if (new Date(e.ts).toDateString() === today) todayTotal += e.pts; });
    if (todayTotal > 0) {
        html += '<div style="padding:10px 16px;background:rgba(247,147,26,0.06);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;"><span style="font-size:0.75rem;color:var(--text-muted);font-weight:700;">Today\'s earnings</span><span style="font-size:0.85rem;font-weight:800;color:var(--accent);">+' + todayTotal + ' XP</span></div>';
    }
    for (var i = log.length - 1; i >= 0; i--) {
        var e = log[i];
        var ts = e.ts ? formatNotifTime(new Date(e.ts)) : '';
        html += '<div style="padding:10px 16px;border-bottom:1px solid var(--border);">' +
            '<div style="display:flex;gap:10px;align-items:flex-start;">' +
                '<span style="font-size:1.2rem;flex-shrink:0;">⭐</span>' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:0.82rem;color:var(--text);line-height:1.4;">+' + e.pts + ' XP — ' + (typeof escapeHtml === 'function' ? escapeHtml(e.reason) : e.reason) + '</div>' +
                    '<div style="font-size:0.65rem;color:var(--text-faint);margin-top:3px;">' + ts + '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }
    html += '<div style="text-align:center;padding:12px;"><button onclick="if(confirm(\'Clear XP history?\')){{localStorage.removeItem(\'btc_points_log\');_renderPointsTab()}}" style="padding:6px 14px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-faint);font-size:0.7rem;cursor:pointer;font-family:inherit;">Clear history</button></div>';
    body.innerHTML = html;
}

// Notify on sats claim
window.notifySelfSatsClaim = function(amount) {
    // claimSats writes the notice only after the wallet payment succeeds.
};

// Notify on forum reply to your post
window.notifyForumReply = function(recipientId, replierName, postTitle, postId) {
    if (!auth || !auth.currentUser || recipientId === auth.currentUser.uid) return;
    db.collection('notifications').add({
        recipientId: recipientId,
        senderId: auth.currentUser.uid,
        senderName: replierName || 'Someone',
        type: 'reply',
        message: '💬 @' + (replierName || 'Someone') + ' replied to your post: "' + (postTitle || '').substring(0, 50) + '"',
        targetType: 'forum_post', targetId: postId || null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
};

// Notify on forum upvote
window.notifyForumUpvote = function(recipientId, voterName, postTitle, postId) {
    if (!auth || !auth.currentUser || recipientId === auth.currentUser.uid) return;
    db.collection('notifications').add({
        recipientId: recipientId,
        senderId: auth.currentUser.uid,
        senderName: voterName || 'Someone',
        type: 'upvote',
        message: '👍 @' + (voterName || 'Someone') + ' upvoted your post: "' + (postTitle || '').substring(0, 50) + '"',
        targetType: 'forum_post', targetId: postId || null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
};

// Notify artist on song comment
window.notifySongComment = function(artistUid, commenterName, songTitle, songId) {
    if (!auth || !auth.currentUser || artistUid === auth.currentUser.uid) return;
    db.collection('notifications').add({
        recipientId: artistUid,
        senderId: auth.currentUser.uid,
        senderName: commenterName || 'Someone',
        type: 'comment',
        message: '💬 @' + (commenterName || 'Someone') + ' commented on your track: "' + (songTitle || '').substring(0, 40) + '"',
        targetType: 'song', targetId: songId || null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
};

// Notify artist on song like
window.notifySongLike = function(artistUid, likerName, songTitle, songId) {
    if (!auth || !auth.currentUser || artistUid === auth.currentUser.uid) return;
    db.collection('notifications').add({
        recipientId: artistUid,
        senderId: auth.currentUser.uid,
        senderName: likerName || 'Someone',
        type: 'like',
        message: '❤️ @' + (likerName || 'Someone') + ' liked your track: "' + (songTitle || '').substring(0, 40) + '"',
        targetType: 'song', targetId: songId || null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
};

// Notify on DM received
window.notifyDMReceived = function(recipientId, senderName) {
    if (!auth || !auth.currentUser || recipientId === auth.currentUser.uid) return;
    db.collection('notifications').add({
        recipientId: recipientId,
        senderId: auth.currentUser.uid,
        senderName: senderName || 'Someone',
        type: 'dm',
        message: '💬 New message from @' + (senderName || 'Someone'),
        targetType: 'dm', targetId: null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
};

// Notify on daily streak milestone
window.notifySelfStreak = function(streakDays) {
    // recordDailyVisit writes the streak ticket / freeze notice.
};

// Notify on exploration milestone
window.notifySelfExploration = function(channelCount, pct) {
    if (!auth || !auth.currentUser) return;
    db.collection('notifications').add({
        recipientId: auth.currentUser.uid,
        senderId: 'system', senderName: 'System',
        type: 'milestone',
        message: '🗺️ Explored ' + channelCount + ' topics (' + pct + '%)! Keep discovering!',
        targetType: null, targetId: null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
};

// ── Partnership Level-Up Popup ─────────────────────────────────────────────
// Triggered live when the CF writes a peer_level_up notification to Firestore.
// Session-guarded so it only fires once per level-up event, not on every reload.
var _shownPartnershipPopups = new Set();

window.showPartnershipLevelUpPopup = function(notifData) {
    if (!notifData) return;
    var levelNum  = notifData.levelNum  || 1;
    var levelName = notifData.levelName || 'Opening Channel';
    var peerId    = notifData.peerId    || '';

    // Session guard — prevent double-fire on snapshot replay
    var guardKey = peerId + '_lvl' + levelNum;
    if (_shownPartnershipPopups.has(guardKey)) return;
    _shownPartnershipPopups.add(guardKey);
    if (typeof window.claimSessionPopup === 'function') window.claimSessionPopup('levelup');

    var LEVEL_META = {
        2: { emoji: '🟨', color: '#eab308', glow: 'rgba(234,179,8,0.35)',  xp: '3,000',   subtitle: 'First exchange. The channel is opening.' },
        3: { emoji: '⚡', color: '#f7931a', glow: 'rgba(247,147,26,0.4)',  xp: '21,000',  subtitle: 'You\'re routing value to each other.' },
        4: { emoji: '⚙️', color: '#94a3b8', glow: 'rgba(148,163,184,0.35)', xp: '44,000', subtitle: 'You\'ve dialled in the fee rate together.' },
        5: { emoji: '🔗', color: '#3b82f6', glow: 'rgba(59,130,246,0.35)', xp: '50,000',  subtitle: 'Inbound and outbound, perfectly balanced.' },
        6: { emoji: '🟠', color: '#f7931a', glow: 'rgba(247,147,26,0.5)',  xp: '100,000', subtitle: 'No limits. Big volume. Wumbo mode activated.' },
    };
    var meta = LEVEL_META[levelNum] || { emoji: '⚡', color: '#f7931a', glow: 'rgba(247,147,26,0.35)', xp: '', subtitle: '' };

    // Fetch peer's username for the popup
    var peerName = 'Your partner';
    var fetchPromise = (peerId && typeof db !== 'undefined')
        ? db.collection('public_profiles').doc(peerId).get().then(function(d) {
            if (d.exists && d.data().username) peerName = d.data().username;
          }).catch(function() {})
        : Promise.resolve();

    fetchPromise.then(function() {
        // Remove any existing partnership popup
        var existing = document.getElementById('partnershipLevelUpModal');
        if (existing) existing.remove();

        // Confetti burst
        if (typeof launchConfetti === 'function') launchConfetti();

        var overlay = document.createElement('div');
        overlay.id = 'partnershipLevelUpModal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;display:flex;justify-content:center;align-items:center;padding:20px;animation:fadeIn 0.3s ease-out;';

        overlay.innerHTML =
            '<div style="background:var(--bg-side,#0f0f1a);border:1px solid ' + meta.color + ';border-radius:24px;padding:36px 28px;max-width:360px;width:100%;text-align:center;box-shadow:0 0 40px ' + meta.glow + ',0 20px 60px rgba(0,0,0,0.6);animation:fadeSlideIn 0.4s ease-out;position:relative;">' +

            // Lightning streak decoration
            '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,'+meta.color+',transparent);border-radius:24px 24px 0 0;"></div>' +

            // Level badge
            '<div style="font-size:4.5rem;margin-bottom:4px;animation:badgeBounce 0.6s ease-out;">' + meta.emoji + '</div>' +

            // Eyebrow
            '<div style="color:' + meta.color + ';font-size:0.7rem;text-transform:uppercase;letter-spacing:3px;font-weight:800;margin-bottom:10px;">⚡ Partnership Level Up</div>' +

            // Level name
            '<div style="color:var(--heading,#fff);font-size:1.7rem;font-weight:900;margin-bottom:6px;">' + escapeHtml(levelName) + '</div>' +

            // Peer name
            '<div style="color:var(--text-muted,#aaa);font-size:0.9rem;margin-bottom:4px;">with <strong style="color:var(--text,#eee);">' + (typeof userTag === 'function' ? userTag(peerId, peerName) : escapeHtml(peerName)) + '</strong></div>' +

            // Subtitle / flavour
            '<div style="color:var(--text-faint,#666);font-size:0.82rem;font-style:italic;margin-bottom:18px;line-height:1.5;">' + escapeHtml(meta.subtitle) + '</div>' +

            // XP reward pill
            (meta.xp ? '<div style="display:inline-block;background:linear-gradient(135deg,rgba(247,147,26,0.15),rgba(247,147,26,0.08));border:1px solid rgba(247,147,26,0.3);border-radius:20px;padding:6px 18px;margin-bottom:22px;">' +
                '<span style="color:#f7931a;font-weight:800;font-size:1rem;">+' + meta.xp + ' XP</span>' +
                '<span style="color:var(--text-faint,#666);font-size:0.78rem;"> each</span>' +
            '</div>' : '') +

            // Progress dots
            '<div style="display:flex;justify-content:center;gap:8px;margin-bottom:24px;">' +
                [1,2,3,4,5,6].map(function(i) {
                    return '<div style="width:' + (i === levelNum ? '20px' : '8px') + ';height:8px;border-radius:4px;background:' + (i <= levelNum ? meta.color : 'var(--border,#333)') + ';transition:all 0.3s;"></div>';
                }).join('') +
            '</div>' +

            // Close button
            '<button onclick="document.getElementById(\'partnershipLevelUpModal\').remove()" style="width:100%;padding:12px;background:linear-gradient(135deg,' + meta.color + ','+meta.color+'cc);color:#fff;border:none;border-radius:12px;font-size:0.95rem;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:0.5px;">Let\'s go! ⚡</button>' +
            '</div>';

        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.remove();
        });

        // Auto-dismiss after 12s
        setTimeout(function() {
            var m = document.getElementById('partnershipLevelUpModal');
            if (m) m.style.animation = 'fadeOut 0.4s ease-in forwards';
            setTimeout(function() {
                var m2 = document.getElementById('partnershipLevelUpModal');
                if (m2) m2.remove();
            }, 400);
        }, 12000);
    });
};


// Client-awarded titles, hidden badges, and module badges. The live copies
// live in the bundle, so this wraps them after they exist. Each id is written
// once (localStorage). Signed-in catalog badges stay on the server.
var CLIENT_AWARD_COPY = {"hidden":{"genesis":{"e":"📜","n":"Genesis Reader","d":"Read the whitepaper channel"},"nacho_curious":{"e":"❓","n":"Curious Deer","d":"Ask Nacho your first question"},"ticket_bronze":{"e":"🐟","n":"Ticket Fish","d":"Earn 25 Orange Tickets"},"ticket_silver":{"e":"🦈","n":"Ticket Shark","d":"Earn 50 Orange Tickets"},"ticket_gold":{"e":"🐋","n":"Ticket Whale","d":"Earn 100 Orange Tickets"},"nacho_10q":{"e":"🔍","n":"Inquisitive Buck","d":"Ask Nacho 10 questions"},"collector":{"e":"💎","n":"Collector","d":"Save 10+ topics to favorites"},"first_post":{"e":"📣","n":"Town Crier","d":"Make your first Pleb Talk post"},"first_reply":{"e":"💬","n":"Conversationalist","d":"Reply to a forum post"},"market_seller":{"e":"🏪","n":"Merchant","d":"List an item on Lightning Mart"},"market_buyer":{"e":"🛍️","n":"Shopper","d":"Contact a seller on the marketplace"},"donor_100":{"e":"🫷","n":"Giving Pleb","d":"Donate 100 XP for charity"},"donor_500":{"e":"💛","n":"Stack Sharer","d":"Donate 500 XP for charity"},"donor_1000":{"e":"🧡","n":"Community Builder","d":"Donate 1,000 XP for charity"},"donor_5000":{"e":"❤️","n":"Archive Patron","d":"Donate 5,000 XP for charity"},"donor_10000":{"e":"🔥","n":"Sats Saint","d":"Donate 10,000 XP for charity"},"donor_25000":{"e":"⚡","n":"Lightning Philanthropist","d":"Donate 25,000 XP for charity"},"donor_100000":{"e":"👑","n":"Legend of the Archive","d":"Donate 100,000 XP for charity"},"night_owl":{"e":"🦉","n":"Night Owl","d":"Visit the archive after midnight"},"speed_runner":{"e":"⚡","n":"Speed Runner","d":"Visit 15+ channels in one session"},"scholar":{"e":"🎓","n":"Bitcoin Scholar","d":"Pass the Scholar Certification"},"nacho_20q":{"e":"🏅","n":"20 Questions","d":"Ask Nacho 20 questions"},"explorer_10":{"e":"🗺️","n":"Curious Pleb","d":"Explore 10 topics"},"explorer_25":{"e":"🐇","n":"Rabbit Holer","d":"Explore 25 topics"},"explorer_50":{"e":"📚","n":"Half Stack","d":"Explore 50 topics"},"explorer_100":{"e":"💯","n":"Century Club","d":"Explore 100 topics"},"explorer_all":{"e":"👑","n":"Archive Master","d":"Explore every single topic"},"marathon":{"e":"🏃","n":"Marathon Reader","d":"Spent 30+ minutes reading in one session"},"early_adopter":{"e":"🌅","n":"Early Adopter","d":"Browsing between 5am and 7am"},"weekend_warrior":{"e":"🎉","n":"Weekend Warrior","d":"Learning Bitcoin on a weekend"},"triple_threat":{"e":"🎯","n":"Triple Threat","d":"Completed a quest, sent a chat message, and read a channel in one session"},"nacho_50q":{"e":"🧙","n":"Nacho Sage","d":"Ask Nacho 50 questions"},"bookmark_collector":{"e":"📚","n":"Bookmark Hoarder","d":"Bookmarked 20+ messages"},"pvp_streak":{"e":"🔱","n":"Undefeated","d":"Won 5 PVP battles in a row"},"sats_maxed":{"e":"👑","n":"Faucet King","d":"Claimed all 15,000 sats from the faucet"},"streak_freeze":{"e":"🧊","n":"Ice Shield","d":"Used a streak freeze to save your streak"},"nacho_closet_full":{"e":"👗","n":"Fashionista","d":"Unlocked all Nacho closet items from the spin wheel"},"ghost_reader":{"e":"👻","n":"Ghost Reader","d":"Visited the archive every day for a week without earning any points"},"whitepaper_pilgrim":{"e":"📜","n":"Whitepaper Pilgrim","d":"Read the whitepaper channel 10 times in separate sessions"},"insomniac":{"e":"🌑","n":"Insomniac","d":"Visited the archive between 2am and 4am on 3 separate occasions"},"contrarian":{"e":"🙃","n":"The Contrarian","d":"Voted against the majority in 10 daily polls"},"block_42":{"e":"🎱","n":"Block 42","d":"Discovered something hidden in the archive"},"rabbit_hole":{"e":"🕳️","n":"Rabbit Hole","d":"Spent 3 hours straight learning in one session"},"the_plebeian":{"e":"🫡","n":"The Plebeian","d":"Reached the leaderboard top 100 without a single referral"},"silent_donor":{"e":"🤫","n":"Silent Donor","d":"Donated XP to charity without ever sharing your referral link"},"dust_collector":{"e":"🧹","n":"Dust Collector","d":"Claimed sats from the faucet 21 days in a row"},"hash_obsessed":{"e":"⛏️","n":"Hash Obsessed","d":"Contributed 25,000 hashes to Satoshi\\"},"search_sleuth":{"e":"🔎","n":"Search Sleuth","d":"Used every search in the archive — topics, users, badges, forum, marketplace, beats, and GIFs"},"nacho_friend":{"e":"🦌","n":"Nacho's Friend","d":"Interact with Nacho"},"donor_50000":{"e":"🏆","n":"Satoshi's Steward","d":"Donate 50,000 XP for charity"}},"titles":{"the_completionist":{"e":"🗺️","n":"The Completionist","d":"Mapped every corner of the Archive"},"quest_legend":{"e":"⚔️","n":"Quest Legend","d":"A hundred quests. Countless battles won."},"hash_lord":{"e":"☄️","n":"Hash Lord","d":"10,000 nonces ground into dust"},"hash_god":{"e":"⚡","n":"Hash God","d":"100,000 hashes. You ARE the network."},"satoshis_chosen":{"e":"💎","n":"Satoshi's Chosen","d":"Fortune favors the relentless"},"block_solver":{"e":"🌞","n":"Block Solver","d":"Cracked the code. Won the sats."},"hodler_supreme":{"e":"🪩","n":"HODLer Supreme","d":"365 days. No days off."},"the_satellite":{"e":"🛰️","n":"The Satellite","d":"100 hours deep in the Timechain"},"timechain_surfer":{"e":"🏄","n":"Timechain Surfer","d":"Surfed 100 channels. Seen it all."},"chat_legend":{"e":"📯","n":"Chat Legend","d":"The voice of the Archive"},"the_devoted":{"e":"💠","n":"The Devoted","d":"30 days of relentless conversation"},"pvp_legend":{"e":"🥇","n":"PVP Legend","d":"100 wins. Undefeated in Bitcoin knowledge."},"raid_warlord":{"e":"🔱","n":"Raid Warlord","d":"100 damage dealt. Bosses tremble."},"dragon_slayer":{"e":"🐲","n":"Dragon Slayer","d":"Ten bosses defeated. A true slayer."},"the_viral_plebian":{"e":"👑","n":"The Viral Plebian","d":"Orange-pilled 100 souls"},"satoshis_disciple":{"e":"🟠","n":"Satoshi's Disciple","d":"365 Daily Trifectas. Absolute dedication."},"trifecta_legend":{"e":"🏆","n":"Trifecta Legend","d":"90 consecutive days of learning, trivia, and polling"},"double_scholar":{"e":"🏛️","n":"Double Scholar","d":"Bitcoin Scholar AND Protocol Expert"},"trivia_titan":{"e":"🏅","n":"Trivia Titan","d":"100 correct answers. Living Bitcoin encyclopedia."},"the_devotee":{"e":"🔱","n":"The Devotee","d":"30-day trivia streak. No excuses."},"vinyl_master":{"e":"🎼","n":"Vinyl Master","d":"100 songs broadcast to the Archive"},"nachos_confidant":{"e":"🤫","n":"Nacho's Confidant","d":"500 conversations with the deer himself"},"regional_leader":{"e":"🌆","n":"Regional Leader","d":"10 Bitcoin events hosted. The community builder."},"twenty_one_million":{"e":"₿","n":"21 Million Dreams","d":"Claimed 21,000 sats. Lived the number."},"proof_of_pain":{"e":"🕱️","n":"Proof of Pain","d":"1,000 terrible hashes. Respect."},"trail_master":{"e":"🏁","n":"Trail Master","d":"Completed every trail Nacho laid out"},"to_the_moon":{"e":"🌕","n":"To the Moon","d":"Walked 5,000km. Unreal."},"democracy_maxi":{"e":"⚖️","n":"Democracy Maxi","d":"100 polls voted. The voice of reason."},"sat_slinger":{"e":"💰","n":"Sat Slinger","d":"10,000 sats tipped. Pure generosity."},"community_darling":{"e":"🌟","n":"Community Darling","d":"50 tips received from the Archive community"},"time_traveler":{"e":"⏳","n":"Time Traveler","d":"100 correct predictions. Saw the future."},"the_long_walker":{"e":"💎","n":"The Long Walker","d":"30-day Proof of Walk streak. Committed."},"chancellor":{"e":"📰","n":"Chancellor on Brink","d":"50 badges. The banks are already nervous."},"the_archivist_t":{"e":"🏛️","n":"The Archivist","d":"100 badges. You don't use the Archive — you are it."},"hall_of_fame_t":{"e":"🏆","n":"Hall of Fame","d":"150 badges. A true legend."},"satoshis_revenge_t":{"e":"⚔️","n":"Satoshi's Revenge","d":"200 badges. The network never forgets."},"satoshis_vendetta_t":{"e":"🗡️","n":"Satoshi's Vendetta","d":"250 badges. Deeper than most will ever go."},"satoshis_ghost_t":{"e":"👻","n":"Satoshi's Ghost","d":"300 badges. So rare nobody knows if it's been done."},"satoshis_covenant_t":{"e":"📜","n":"Satoshi's Covenant","d":"350 badges. Bound to the protocol, forever."},"satoshis_cipher_t":{"e":"🔐","n":"Satoshi's Cipher","d":"400 badges. You have cracked something most never will."},"grand_scholar":{"e":"🎓","n":"Grand Scholar","d":"All certifications and trails. The complete picture."},"jack_of_all_t":{"e":"🃏","n":"Jack of All Trades","d":"A badge in every category. Truly well-rounded."},"master_miner_t":{"e":"⛏️","n":"Master Miner","d":"Every mining badge earned. The forge never cools."},"satoshi_scholar_t":{"e":"🎓","n":"Satoshi Scholar","d":"The Scholar Set complete. Knowledge is sovereignty."},"community_pillar_t":{"e":"🌐","n":"Community Pillar","d":"The Social Set done. The Archive runs on people like you."},"diamond_hands_set_t":{"e":"💎","n":"Diamond Hands","d":"The Streak Set finished. Unbreakable."},"arena_champion_t":{"e":"👑","n":"Arena Champion","d":"The Fighter Set complete. Dominant."},"archive_builder_t":{"e":"🔧","n":"Archive Builder","d":"The Builder Set done. You shaped this place."},"world_traveler_t":{"e":"🗺️","n":"World Traveler","d":"The Explorer Set complete. Every path walked."},"bitcoin_cal_hero_t":{"e":"🎊","n":"Bitcoin Calendar Hero","d":"All calendar badges. You never miss a Bitcoin holiday."},"challenge_master_t":{"e":"🏅","n":"Challenge Master","d":"The Daily Set complete. Every day, every challenge."},"timechain_veteran_t":{"e":"🛸","n":"Timechain Veteran","d":"The TCTV Set complete. You've seen everything."},"lightning_lord_t":{"e":"⚡","n":"Lightning Lord","d":"The Lightning Set complete. Pure Bitcoin velocity."},"trail_blazer_t":{"e":"🏔️","n":"Trail Blazer","d":"The Trails Set blazed. Nacho is proud."},"beats_maestro_t":{"e":"🎤","n":"Beats Maestro","d":"The Beats Set complete. Music and Bitcoin forever."},"trifecta_god_t":{"e":"🌞","n":"Trifecta God","d":"The Trifecta Set complete. Daily discipline personified."},"irl_set_t":{"e":"🏟️","n":"IRL Champion","d":"The IRL Set complete. Bitcoin isn't just on a screen."},"spin_set_t":{"e":"🎰","n":"Wheel of Fortune","d":"The Spin Set complete. Fortune favored you enough."},"pow_set_t":{"e":"👟","n":"Proof of Walker","d":"The Proof of Walk Set complete. Every step counted."},"chat_immortal_t":{"e":"♾️","n":"Chat Immortal","d":"1,000 messages. You are the chat."},"reaction_god_t":{"e":"🔮","n":"Reaction God","d":"500 reactions. You feel everything."},"dj_legend_t":{"e":"🎛️","n":"DJ Legend","d":"50 DJ sets. The decks are your home."},"super_fan_t":{"e":"🌟","n":"Super Fan","d":"100 DJ sets listened to. Front row every time."},"audiophile_t":{"e":"🎧","n":"The Audiophile","d":"500 tracks on Bitcoin Beats. Pure devotion."},"forum_legend_t":{"e":"🏛️","n":"Forum Legend","d":"100 forum posts. Your words shaped the debate."},"staff_writer_t":{"e":"🗞️","n":"Staff Writer","d":"10 articles published. The pen is mightier."},"unstoppable_pvp_t":{"e":"💥","n":"Unstoppable","d":"5 PVP wins in a row. Nobody can touch you."},"diamond_hands_100_t":{"e":"💎","n":"Diamond Hands","d":"100-day streak. Most quit long ago."},"wheel_addict_t":{"e":"🎡","n":"Wheel Addict","d":"30-day spin streak. Fortune favors the consistent."},"century_spinner_t":{"e":"🏅","n":"Century Spinner","d":"100 spins. No shame, only gains."},"precision_forecaster_t":{"e":"🎯","n":"Precision Forecaster","d":"70%+ accuracy across 20+ predictions. You see the chart."},"nostradamus_t":{"e":"🔮","n":"Nostradamus","d":"10 correct in a row. The oracle speaks."},"flex_legend_t":{"e":"🦁","n":"Flex Legend","d":"1,000 Flex actions. Physical and financial sovereignty."},"full_stack_human_t":{"e":"🧬","n":"Full Stack Human","d":"Every Flex action done. The complete sovereign."},"legend_mode_t":{"e":"🏆","n":"Legend Mode","d":"All 8 features in one session. A true Archive legend."},"nachos_bestie_t":{"e":"🧡","n":"Nacho's Bestie","d":"250 Nacho interactions. He considers you a friend."},"super_spreader_t":{"e":"📡","n":"Super Spreader","d":"Referred 50 people. Orange pill machine."},"sat_hoarder_t":{"e":"🏦","n":"Sat Hoarder","d":"10,000 sats claimed. The stack begins."},"favor_champion_t":{"e":"🏅","n":"Favor Champion","d":"10× Satoshi's Favor activated. The community owes you."},"golden_nonce_t":{"e":"✨","n":"Golden Nonce","d":"Hash under 100,000. Almost divine luck."},"asic_mode_t":{"e":"🖥️","n":"ASIC Mode","d":"1,000 SF hashes. Dedicated."},"summit_conqueror_t":{"e":"🏔️","n":"Summit Conqueror","d":"The hardest Nacho trail. The summit was yours."},"pow_titan_t":{"e":"🌍","n":"The Titan","d":"1,000 km walked. A thousand kilometers of conviction."},"story_master_t":{"e":"🦧","n":"Story Master","d":"All 7 chapters of Nacho's Story. You know the whole tale."},"scene_regular_t":{"e":"🗺️","n":"Scene Regular","d":"5 IRL events attended. You show up in person."},"tip_magnet_t":{"e":"🧲","n":"Tip Magnet","d":"10 tips received. The community loves what you bring."},"community_hero_t":{"e":"⚡","n":"Community Hero","d":"Participated in a weekly community challenge. Showed up."},"sovereign_individual":{"e":"🗽","n":"Sovereign Individual","d":"200 days of orange-pilled devotion"}}};

function _clientAwardMessage(meta, fallbackName, label) {
    var emoji = (meta && meta.e) || '🏅';
    var name = (meta && meta.n) || fallbackName || 'New badge';
    var desc = meta && meta.d ? ' ' + meta.d : '';
    return { icon: emoji, message: (emoji + ' ' + label + ': ' + name + '!' + desc).slice(0, 180) };
}

function _installClientAwardNotices() {
    if (typeof window.checkHiddenBadges === 'function' && !window.checkHiddenBadges._rn) {
        var origHidden = window.checkHiddenBadges;
        var wrappedHidden = function() {
            var before = [];
            try { before = JSON.parse(localStorage.getItem('btc_hidden_badges') || '[]'); } catch (e) {}
            var ret = origHidden.apply(this, arguments);
            var after = [];
            try { after = JSON.parse(localStorage.getItem('btc_hidden_badges') || '[]'); } catch (e2) {}
            after.forEach(function(id) {
                if (before.indexOf(id) !== -1) return;
                var built = _clientAwardMessage((CLIENT_AWARD_COPY.hidden || {})[id], id, 'New badge');
                _stashLocalReward('hbadge_' + id, built.message, built.icon, 'hidden');
            });
            return ret;
        };
        wrappedHidden._rn = true;
        window.checkHiddenBadges = wrappedHidden;
    }
    if (typeof window.awardHiddenBadge === 'function' && !window.awardHiddenBadge._rn) {
        var origAward = window.awardHiddenBadge;
        var wrappedAward = function(badgeId, toastMsg, pts) {
            var before = [];
            try { before = JSON.parse(localStorage.getItem('btc_hidden_badges') || '[]'); } catch (e) {}
            var ret = origAward.apply(this, arguments);
            if (before.indexOf(badgeId) !== -1) return ret;
            if (!_isSignedInAccount()) return ret;
            var meta = (CLIENT_AWARD_COPY.hidden || {})[badgeId];
            var built = meta
                ? _clientAwardMessage(meta, badgeId, 'New badge')
                : { icon: '🏅', message: ('🏅 New badge: ' + (toastMsg || badgeId || 'New badge') + '!').slice(0, 180) };
            _stashLocalReward('hbadge_' + (badgeId || toastMsg || 'badge'), built.message, built.icon, 'hidden');
            return ret;
        };
        wrappedAward._rn = true;
        window.awardHiddenBadge = wrappedAward;
    }
    if (typeof window._checkAndAwardTitles === 'function' && !window._checkAndAwardTitles._rn) {
        var origTitles = window._checkAndAwardTitles;
        var wrappedTitles = function() {
            var before = [];
            try {
                before = ((typeof currentUser !== 'undefined' && currentUser && currentUser.earnedTitles) || []).slice();
            } catch (e) {}
            var ret = origTitles.apply(this, arguments);
            var after = [];
            try {
                after = (typeof currentUser !== 'undefined' && currentUser && currentUser.earnedTitles) || [];
            } catch (e2) {}
            after.forEach(function(id) {
                if (before.indexOf(id) !== -1) return;
                var built = _clientAwardMessage((CLIENT_AWARD_COPY.titles || {})[id], id, 'New title');
                _stashLocalReward('title_' + id, built.message, built.icon, 'title');
            });
            return ret;
        };
        wrappedTitles._rn = true;
        window._checkAndAwardTitles = wrappedTitles;
    }
}
_installClientAwardNotices();
setInterval(_installClientAwardNotices, 2000);
// ---- Web push: token, settings, soft opt-in ----
// The browser permission prompt runs only from a button tap.
// Public VAPID key only. Senders and prefs checks live on the server.
(function() {
    var VAPID = 'BF_YipiWF9DWsA4HA44xJwYOZkHuLZ1lE9nBxiF96Ba7mgGgWA3IsG4aUjEnc_PoLuYpsxRLsmjsHSjEvL_Xt-E';
    var FALLBACK_DEFAULTS = {
        rewards: true, gifts: true, favor: true, pvp: true, predictions: true,
        mentions: true, dms: true, plebtalk: false, reminders: true, news: false, referrals: true
    };
    var CATS = [
        ['rewards', 'Rewards & wins', 'Sats, tickets, raffles, and weekly wins'],
        ['gifts', 'Peer keys & gifts', 'Keys, gifts, and friendship level-ups'],
        ['favor', "Satoshi's Favor", 'When a Favor window opens'],
        ['pvp', 'PvP lobby', 'Challenges and open lobbies'],
        ['predictions', 'Prediction results', 'Hits, misses, and ticket payouts'],
        ['mentions', 'Chat mentions', 'When someone @mentions you'],
        ['dms', 'Direct messages', 'New direct messages'],
        ['plebtalk', 'PlebTalk & Marketplace', 'Marketplace messages'],
        ['reminders', 'Daily reminders', 'Streak, spin, and quest reminders'],
        ['news', 'News & Hot Topics', 'Hot Topics digests'],
        ['referrals', 'Referrals', 'When a referral pays off']
    ];
    var CONTEXT_COPY = {
        win: 'You just won something. Want a heads-up next time? \uD83D\uDD14',
        gift: 'A peer just sent you something. Want to know next time? \uD83D\uDD14',
        favor: "Satoshi's Favor is open. Want a heads-up for the next window? \uD83D\uDD14",
        pvp: 'A PvP lobby is live. Want a challenge notice next time? \uD83D\uDD14'
    };
    var _promptStarted = false;
    var _considering = false;
    var _cachedUser = null;

    function prefsApi() { return window.PushPrefs || null; }

    function defaults() {
        var api = prefsApi();
        return (api && api.DEFAULTS) || FALLBACK_DEFAULTS;
    }

    function num(v) {
        var n = typeof v === 'number' ? v : parseInt(v, 10);
        return isFinite(n) ? n : 0;
    }

    function signedIn() {
        return typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous;
    }

    function uid() {
        return signedIn() ? auth.currentUser.uid : '';
    }

    function isIos() {
        var ua = navigator.userAgent || '';
        if (/iPad|iPhone|iPod/.test(ua)) return true;
        return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    }

    function isStandalone() {
        try {
            if (window.navigator.standalone === true) return true;
            return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
        } catch (e) { return false; }
    }

    function iosNeedsInstall() {
        return isIos() && !isStandalone();
    }

    function permissionState() {
        if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
        return Notification.permission || 'default';
    }

    function uiBusy() {
        var quest = document.getElementById('questModal');
        if (quest && (quest.classList.contains('open') || (quest.style.display && quest.style.display !== 'none' && quest.offsetParent !== null))) return true;
        var userModal = document.getElementById('usernameModal');
        if (userModal && userModal.classList.contains('open')) return true;
        var tos = document.getElementById('tosModal');
        if (tos && (tos.classList.contains('open') || tos.style.display === 'flex' || tos.style.display === 'block')) return true;
        if (window._giftOpening || window._pvpActive || window._examActive) return true;
        try { if (localStorage.getItem('btc_onboarding_active') === '1') return true; } catch (e) {}
        return false;
    }

    function popupTaken() {
        try { return !!sessionStorage.getItem('btc_session_popup'); } catch (e) { return false; }
    }

    window.claimSessionPopup = function(name) {
        try {
            if (sessionStorage.getItem('btc_session_popup')) return false;
            sessionStorage.setItem('btc_session_popup', String(name || '1').slice(0, 24));
            return true;
        } catch (e) { return false; }
    };

    function deviceId() {
        var existing = '';
        try { existing = localStorage.getItem('btc_push_device') || ''; } catch (e) {}
        if (/^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
        var id = '';
        try {
            var bytes = new Uint8Array(12);
            crypto.getRandomValues(bytes);
            id = Array.prototype.map.call(bytes, function(b) { return ('0' + b.toString(16)).slice(-2); }).join('');
        } catch (e2) {
            id = 'd' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        }
        id = String(id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
        if (id.length < 8) id = ('device' + Date.now().toString(36)).slice(0, 16);
        try { localStorage.setItem('btc_push_device', id); } catch (e3) {}
        return id;
    }

    function platformLabel() {
        var label = 'web';
        if (isIos()) label = 'ios';
        else if (/Android/i.test(navigator.userAgent || '')) label = 'android';
        if (isStandalone()) label += '-pwa';
        return label.slice(0, 40);
    }

    function readLocalPrompt() {
        try { return JSON.parse(localStorage.getItem('btc_notif_prompt') || '{}') || {}; }
        catch (e) { return {}; }
    }

    function mergePrompt(server) {
        var local = readLocalPrompt();
        var remote = server || {};
        return {
            count: Math.max(num(local.count), num(remote.count)),
            lastAsked: Math.max(num(local.lastAsked), num(remote.lastAsked)),
            stopped: local.stopped === true || remote.stopped === true,
            dontAsk: local.dontAsk === true || remote.dontAsk === true
        };
    }

    function persistPrompt(next) {
        var prev = mergePrompt(_cachedUser && _cachedUser.notifPrompt);
        var stored = {
            count: Math.max(prev.count, Math.max(0, Math.min(3, num(next.count)))),
            lastAsked: Math.max(prev.lastAsked, num(next.lastAsked)),
            stopped: prev.stopped === true || next.stopped === true,
            dontAsk: prev.dontAsk === true || next.dontAsk === true
        };
        try { localStorage.setItem('btc_notif_prompt', JSON.stringify(stored)); } catch (e) {}
        if (!signedIn() || typeof db === 'undefined' || !firebase || !firebase.firestore) return;
        db.collection('users').doc(uid()).set({ notifPrompt: stored }, { merge: true }).catch(function() {});
    }

    function bumpSession() {
        try {
            if (sessionStorage.getItem('btc_push_session_marked') === '1') {
                return Math.max(1, num(localStorage.getItem('btc_push_sessions')) || 1);
            }
            sessionStorage.setItem('btc_push_session_marked', '1');
            var n = num(localStorage.getItem('btc_push_sessions')) + 1;
            localStorage.setItem('btc_push_sessions', String(n));
            return n;
        } catch (e) { return 1; }
    }

    function daysSinceVisit(user) {
        var raw = '';
        try { raw = sessionStorage.getItem('btc_push_prev_visit') || ''; } catch (e) {}
        if (!raw && user && user.lastVisit) raw = String(user.lastVisit);
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw || '');
        if (!m) return 0;
        var then = Date.UTC(+m[1], +m[2] - 1, +m[3]);
        var shifted = new Date(Date.now() - 5 * 3600000);
        var today = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
        var diff = Math.floor((today - then) / 86400000);
        return diff > 0 ? diff : 0;
    }

    function loadUser() {
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.uid) {
            _cachedUser = currentUser;
        }
        if (!signedIn() || typeof db === 'undefined') return Promise.resolve(_cachedUser || {});
        return db.collection('users').doc(uid()).get().then(function(snap) {
            _cachedUser = snap.exists ? (snap.data() || {}) : {};
            return _cachedUser;
        }).catch(function() { return _cachedUser || {}; });
    }

    function ensureStyles() {
        if (document.getElementById('pushSettingsCss')) return;
        var st = document.createElement('style');
        st.id = 'pushSettingsCss';
        st.textContent = ''
            + '#settings-notifications{scroll-margin-top:72px;text-align:left;}'
            + '#settings-notifications.notif-flash{outline:2px solid var(--accent);outline-offset:4px;border-radius:14px;}'
            + '.push-settings{background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin:0 0 16px;color:var(--text);}'
            + '.push-kicker{font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;}'
            + '.push-status{color:var(--text-muted);font-size:0.95rem;line-height:1.45;margin:0 0 12px;}'
            + '.push-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--border);}'
            + '.push-row b{display:block;color:var(--text);font-size:1rem;font-weight:700;}'
            + '.push-row span{display:block;color:var(--text-muted);font-size:0.85rem;line-height:1.35;margin-top:2px;}'
            + '.push-settings button,.push-opt-card button{font-family:inherit;font-size:16px;min-height:44px;border-radius:10px;cursor:pointer;touch-action:manipulation;}'
            + '.push-switch{padding:8px 16px;border:1px solid var(--border);background:var(--bg-side);color:var(--text-muted);font-weight:700;}'
            + '.push-switch.on{background:#22c55e;color:#fff;border-color:#22c55e;}'
            + '.push-switch.blocked{background:var(--bg-side);color:#ef4444;border-color:#ef4444;}'
            + '.push-help{background:var(--bg-side);border:1px solid var(--border);border-radius:10px;padding:12px;color:var(--text-muted);font-size:0.9rem;line-height:1.45;margin-top:8px;}'
            + '.push-test{width:100%;margin-top:12px;background:var(--accent);color:#fff;border:none;font-weight:800;}'
            + '#pushOptIn{position:fixed;inset:0;z-index:480000;background:var(--overlay);display:flex;align-items:flex-end;justify-content:center;padding:16px;padding-bottom:max(16px,env(safe-area-inset-bottom));}'
            + '@media(min-width:720px){#pushOptIn{align-items:center;}}'
            + '.push-opt-card{width:100%;max-width:420px;background:var(--bg-side);color:var(--text);border:1px solid var(--border);border-radius:18px;padding:22px 18px 16px;box-shadow:0 20px 50px rgba(0,0,0,0.35);position:relative;}'
            + '.push-opt-card h2{font-size:1.25rem;line-height:1.3;margin:0 28px 10px 0;color:var(--heading,#fff);}'
            + '.push-opt-card ul,.push-opt-card ol{margin:0 0 14px 1.1rem;padding:0;color:var(--text);font-size:1rem;line-height:1.45;}'
            + '.push-opt-card li{margin:4px 0;}'
            + '.push-opt-card .push-primary,.push-opt-card .push-secondary,.push-opt-card .push-quiet{display:block;width:100%;margin-top:8px;}'
            + '.push-primary{background:var(--accent);color:#fff;border:none;font-weight:800;}'
            + '.push-secondary{background:var(--card-bg);color:var(--text);border:1px solid var(--border);font-weight:700;}'
            + '.push-quiet{background:transparent;color:var(--text-muted);border:none;font-weight:600;}'
            + '.push-x{position:absolute;top:8px;right:8px;width:44px;min-height:44px;background:transparent;color:var(--text-muted);border:none;font-size:1.2rem;}';
        document.head.appendChild(st);
    }

    function catChecked(map, key) {
        if (map && Object.prototype.hasOwnProperty.call(map, key)) return map[key] === true;
        return defaults()[key] === true;
    }

    function masterMode(map) {
        var perm = permissionState();
        if (perm === 'unsupported') return 'unsupported';
        if (perm === 'denied') return 'blocked';
        if (perm === 'granted' && map && map.master === true) return 'on';
        return 'off';
    }

    function toast(msg) {
        if (typeof showToast === 'function') showToast(msg);
    }

    function plain(s) {
        return String(s || '').replace(/[<>&]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
    }

    function savePref(key, value) {
        if (window._pushPreview) {
            window._pushPreviewPrefs = window._pushPreviewPrefs || {};
            window._pushPreviewPrefs[key] = value === true;
            return Promise.resolve();
        }
        if (!signedIn() || typeof db === 'undefined') {
            toast('Sign in to save notification settings');
            return Promise.resolve();
        }
        var nest = {};
        nest[key] = value === true;
        var patch = {};
        patch['notificationPrefs.' + key] = value === true;
        return db.collection('users').doc(uid()).update(patch).catch(function() {
            return db.collection('users').doc(uid()).set({ notificationPrefs: nest }, { merge: true }).catch(function() {
                toast('Could not save that setting');
            });
        });
    }

    function unregisterMessagingWorkers() {
        if (!navigator.serviceWorker || !navigator.serviceWorker.getRegistrations) return Promise.resolve();
        return navigator.serviceWorker.getRegistrations().then(function(list) {
            var jobs = [];
            list.forEach(function(reg) {
                var worker = reg.active || reg.installing || reg.waiting;
                var url = worker && worker.scriptURL ? worker.scriptURL : '';
                if (url.indexOf('firebase-messaging-sw.js') !== -1) jobs.push(reg.unregister());
            });
            return Promise.all(jobs);
        }).catch(function() {});
    }

    function swRegistration() {
        return unregisterMessagingWorkers().then(function() {
            return navigator.serviceWorker.register('/sw.js');
        });
    }

    function registerPushToken(opts) {
        var silent = opts && opts.silent;
        if (!signedIn() || typeof db === 'undefined' || typeof firebase === 'undefined' || !firebase.messaging) {
            if (!silent) toast('Sign in on this device to turn notifications on');
            return Promise.resolve(false);
        }
        return swRegistration().then(function(reg) {
            return firebase.messaging().getToken({ vapidKey: VAPID, serviceWorkerRegistration: reg });
        }).then(function(token) {
            if (!token || token.length < 20) throw new Error('no-token');
            var parent = db.collection('push_tokens').doc(uid());
            var ref = parent.collection('devices').doc(deviceId());
            return parent.set({
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).then(function() {
                return ref.set({
                    token: token,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    platform: platformLabel(),
                    ua: String(navigator.userAgent || '').slice(0, 160)
                });
            });
        }).then(function() {
            return savePref('master', true);
        }).then(function() {
            bindForeground();
            if (!silent) toast('Notifications on for this device');
            return true;
        }).catch(function() {
            if (!silent) toast('Could not register this device for notifications');
            return false;
        });
    }

    function disableThisDevice() {
        var jobs = [savePref('master', false)];
        if (signedIn() && typeof db !== 'undefined') {
            jobs.push(db.collection('push_tokens').doc(uid()).collection('devices').doc(deviceId()).delete().catch(function() {}));
        }
        if (typeof firebase !== 'undefined' && firebase.messaging) {
            try { jobs.push(firebase.messaging().deleteToken().catch(function() {})); } catch (e) {}
        }
        return Promise.all(jobs);
    }

    window.enablePushFromTap = function() {
        if (window._pushPreview) return Promise.resolve(false);
        if (iosNeedsInstall()) {
            showOptInCard({ show: true, kind: 'install', askIndex: 1, showDontAsk: false, reason: 'settings' }, true);
            return Promise.resolve(false);
        }
        if (permissionState() === 'unsupported') {
            toast('This browser cannot show notifications');
            return Promise.resolve(false);
        }
        if (permissionState() === 'denied') {
            toast('Notifications are blocked in the browser settings');
            return Promise.resolve(false);
        }
        var ask = permissionState() === 'granted'
            ? Promise.resolve('granted')
            : Notification.requestPermission();
        return Promise.resolve(ask).then(function(result) {
            if (result === 'granted') return registerPushToken();
            persistPrompt({ count: mergePrompt(_cachedUser && _cachedUser.notifPrompt).count, lastAsked: Date.now(), stopped: true, dontAsk: false });
            toast('Notifications stay off');
            return false;
        });
    };

    function bindForeground() {
        if (window._pushFgBound || typeof firebase === 'undefined' || !firebase.messaging) return;
        try {
            firebase.messaging().onMessage(function(payload) {
                var n = (payload && payload.notification) || {};
                var d = (payload && payload.data) || {};
                var title = plain(n.title || d.title || 'Bitcoin Quest');
                var body = plain(n.body || d.body || '');
                toast(body ? (title + ': ' + body) : title);
            });
            window._pushFgBound = true;
        } catch (e) {}
    }

    function bindNav() {
        if (window._pushNavBound || !navigator.serviceWorker) return;
        window._pushNavBound = true;
        navigator.serviceWorker.addEventListener('message', function(ev) {
            var data = ev.data || {};
            if (data.type !== 'PUSH_NAV' || !data.url) return;
            try {
                var u = new URL(data.url, location.origin);
                if (u.origin !== location.origin) return;
                location.href = u.pathname + u.search + u.hash;
            } catch (e) {}
        });
    }
    bindNav();

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function renderInto(root, map) {
        ensureStyles();
        root.textContent = '';
        var box = el('div', 'push-settings');
        box.appendChild(el('div', 'push-kicker', 'Notifications'));
        if (!signedIn() && !window._pushPreview) {
            box.appendChild(el('p', 'push-status', 'Sign in to choose what this device can tell you about.'));
            root.appendChild(box);
            return;
        }
        var mode = masterMode(map);
        var perm = permissionState();
        var permWord = perm === 'granted' ? 'allowed' : (perm === 'denied' ? 'blocked' : (perm === 'unsupported' ? 'unavailable' : 'not asked yet'));
        var paused = false;
        if (prefsApi() && prefsApi().categoryAllowed && map && map.master === false) {
            paused = prefsApi().categoryAllowed({ notificationPrefs: map }, 'rewards') === false;
        }
        box.appendChild(el('p', 'push-status', 'Browser permission: ' + permWord + (paused ? '. The master switch is pausing every category.' : '.')));
        var masterRow = el('div', 'push-row');
        var masterCopy = el('div');
        masterCopy.appendChild(el('b', '', 'All notifications'));
        masterCopy.appendChild(el('span', '', mode === 'blocked' ? 'Blocked in this browser' : 'Master switch for this account'));
        var masterBtn = el('button', 'push-switch' + (mode === 'on' ? ' on' : '') + (mode === 'blocked' ? ' blocked' : ''));
        masterBtn.type = 'button';
        masterBtn.id = 'pushMasterBtn';
        masterBtn.textContent = mode === 'on' ? 'On' : (mode === 'blocked' ? 'Blocked' : (mode === 'unsupported' ? 'Unavailable' : 'Off'));
        masterBtn.addEventListener('click', function() {
            if (mode === 'blocked' || mode === 'unsupported' || iosNeedsInstall()) {
                var help = document.getElementById('pushBlockedHelp');
                if (help) help.hidden = false;
                if (iosNeedsInstall()) {
                    showOptInCard({ show: true, kind: 'install', askIndex: 1, showDontAsk: false, reason: 'settings' }, true);
                }
                return;
            }
            var next = mode !== 'on';
            var job = next ? window.enablePushFromTap() : disableThisDevice();
            Promise.resolve(job).then(function() { window.renderNotificationSettings(); });
        });
        masterRow.appendChild(masterCopy);
        masterRow.appendChild(masterBtn);
        box.appendChild(masterRow);

        var help = el('div', 'push-help');
        help.id = 'pushBlockedHelp';
        help.hidden = mode !== 'blocked' && !iosNeedsInstall();
        if (iosNeedsInstall()) {
            help.textContent = 'Add to Home Screen to get notifications. In Safari, tap Share, then Add to Home Screen, then open Bitcoin Quest from that icon. Push works for installed apps on iOS 16.4 or newer.';
        } else {
            help.textContent = 'Notifications are blocked. In Chrome or Edge, click the lock icon, set Notifications to Allow, and reload. In Firefox, click the lock and clear the block. On iPhone, install the Home Screen app and turn notifications on in Settings, then Notifications.';
        }
        box.appendChild(help);

        CATS.forEach(function(row) {
            var key = row[0];
            var on = catChecked(map, key);
            var line = el('div', 'push-row');
            var copy = el('div');
            copy.appendChild(el('b', '', row[1]));
            copy.appendChild(el('span', '', row[2]));
            var btn = el('button', 'push-switch' + (on ? ' on' : ''));
            btn.type = 'button';
            btn.setAttribute('data-push-cat', key);
            btn.textContent = on ? 'On' : 'Off';
            btn.addEventListener('click', function() {
                var turningOn = btn.textContent !== 'On';
                savePref(key, turningOn).then(function() { window.renderNotificationSettings(); });
            });
            line.appendChild(copy);
            line.appendChild(btn);
            box.appendChild(line);
        });

        var testBtn = el('button', 'push-test', 'Send me a test notification');
        testBtn.type = 'button';
        testBtn.id = 'pushTestBtn';
        testBtn.addEventListener('click', function() {
            if (window._pushPreview) { toast('Preview only'); return; }
            if (!signedIn() || typeof firebase === 'undefined' || !firebase.functions) {
                toast('Sign in to send a test');
                return;
            }
            if (permissionState() !== 'granted') {
                toast('Turn notifications on first');
                return;
            }
            testBtn.disabled = true;
            firebase.functions().httpsCallable('sendTestPush')({ uid: uid() }).then(function(res) {
                var data = (res && res.data) || {};
                if (data.ok) toast('Test sent. Check your notifications.');
                else if (data.reason === 'rate') toast('Test limit reached. Try again later.');
                else if (data.reason === 'no-token') toast('This device is not registered yet.');
                else toast('Test did not send.');
            }).catch(function() {
                toast('Test did not send.');
            }).then(function() { testBtn.disabled = false; });
        });
        box.appendChild(testBtn);
        root.appendChild(box);
    }

    window.renderNotificationSettings = function() {
        var root = document.getElementById('settings-notifications');
        if (!root) return;
        if (window._pushPreview) {
            renderInto(root, window._pushPreviewPrefs || {});
            return;
        }
        renderInto(root, (_cachedUser && _cachedUser.notificationPrefs) || {});
        loadUser().then(function(user) {
            if (!document.getElementById('settings-notifications')) return;
            renderInto(document.getElementById('settings-notifications'), (user && user.notificationPrefs) || {});
        });
    };

    function closeOptIn() {
        var node = document.getElementById('pushOptIn');
        if (node) node.remove();
        document.removeEventListener('keydown', onOptInKey);
    }

    function onOptInKey(ev) {
        if (ev.key === 'Escape') closeOptIn();
    }

    function showOptInCard(decision, preview) {
        if (!decision || !decision.show) return;
        if (document.getElementById('pushOptIn')) return;
        ensureStyles();
        var install = decision.kind === 'install';
        var overlay = el('div');
        overlay.id = 'pushOptIn';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'pushOptInTitle');
        var card = el('div', 'push-opt-card');
        var closer = el('button', 'push-x', '\u2715');
        closer.type = 'button';
        closer.setAttribute('aria-label', 'Close');
        closer.addEventListener('click', closeOptIn);
        card.appendChild(closer);
        var title = (decision.kind === 'context' && CONTEXT_COPY[decision.context])
            || 'Want a heads-up when something good happens? \uD83D\uDD14';
        if (install) title = 'Add to Home Screen to get notifications';
        var h = el('h2');
        h.id = 'pushOptInTitle';
        h.textContent = title;
        card.appendChild(h);
        if (install) {
            var steps = document.createElement('ol');
            ['Tap the Share button in Safari.', 'Tap Add to Home Screen.', 'Open Bitcoin Quest from the new icon. Push works on iOS 16.4 or newer.'].forEach(function(step) {
                steps.appendChild(el('li', '', step));
            });
            card.appendChild(steps);
        } else {
            var list = document.createElement('ul');
            ['Sats wins and reward drops', 'Peer keys and gifts', "Satoshi's Favor windows and PvP challenges"].forEach(function(item) {
                list.appendChild(el('li', '', item));
            });
            card.appendChild(list);
        }
        function finish(extra) {
            closeOptIn();
            if (preview) return;
            if (extra) persistPrompt(extra);
        }
        if (install) {
            var got = el('button', 'push-primary', 'Got it');
            got.type = 'button';
            got.addEventListener('click', function() { finish(null); });
            card.appendChild(got);
        } else {
            var turn = el('button', 'push-primary', 'Turn on');
            turn.type = 'button';
            turn.addEventListener('click', function() {
                closeOptIn();
                if (preview) return;
                window.enablePushFromTap();
            });
            card.appendChild(turn);
        }
        var choose = el('button', 'push-secondary', 'Choose what I get');
        choose.type = 'button';
        choose.addEventListener('click', function() {
            closeOptIn();
            if (!preview) window.openNotificationSettings();
        });
        card.appendChild(choose);
        var later = el('button', 'push-quiet', 'Not now');
        later.type = 'button';
        later.addEventListener('click', function() { finish(null); });
        card.appendChild(later);
        if (decision.showDontAsk) {
            var never = el('button', 'push-quiet', "Don't ask again");
            never.type = 'button';
            never.addEventListener('click', function() {
                finish({ stopped: true, dontAsk: true, count: decision.askIndex || 2, lastAsked: Date.now() });
            });
            card.appendChild(never);
        }
        overlay.addEventListener('click', function(ev) { if (ev.target === overlay) finish(null); });
        card.addEventListener('click', function(ev) { ev.stopPropagation(); });
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        document.addEventListener('keydown', onOptInKey);
    }

    function probeContext(stored) {
        if (window._pushMoment) return Promise.resolve(window._pushMoment);
        if (!stored || num(stored.count) < 1 || stored.stopped || stored.dontAsk) return Promise.resolve(null);
        var api = prefsApi();
        var gap = api ? api.REASK_MS : (30 * 86400000);
        if (!stored.lastAsked || (Date.now() - stored.lastAsked) < gap) return Promise.resolve(null);
        if (!signedIn() || typeof db === 'undefined') return Promise.resolve(null);
        return db.collection('satoshiFavor').doc('current').get().then(function(snap) {
            if (snap.exists && snap.data() && snap.data().favorActive === true) return 'favor';
            return null;
        }).catch(function() { return null; }).then(function(found) {
            if (found) return found;
            return db.collection('pvp_lobby').where('status', '==', 'waiting').limit(1).get().then(function(lobby) {
                return lobby.empty ? null : 'pvp';
            }).catch(function() { return null; });
        });
    }

    function considerPrompt() {
        if (window._pushPreview || _considering) return;
        if (!prefsApi() || !signedIn()) return;
        try { if (sessionStorage.getItem('btc_push_prompt_shown') === '1') return; } catch (e) {}
        _considering = true;
        var sessionCount = bumpSession();
        loadUser().then(function(user) {
            var stored = mergePrompt(user && user.notifPrompt);
            if (permissionState() === 'denied' && stored.stopped !== true) {
                persistPrompt({ count: stored.count, lastAsked: stored.lastAsked, stopped: true, dontAsk: stored.dontAsk });
            }
            return probeContext(stored).then(function(context) {
                var decision = prefsApi().decidePrompt({
                    now: Date.now(),
                    permission: permissionState(),
                    prompt: stored,
                    sessionCount: sessionCount,
                    totalVisits: num(user && (user.totalVisits || (typeof currentUser !== 'undefined' && currentUser && currentUser.totalVisits))),
                    daysSinceVisit: daysSinceVisit(user || (typeof currentUser !== 'undefined' ? currentUser : null)),
                    context: context,
                    iosNeedsInstall: iosNeedsInstall(),
                    busy: uiBusy(),
                    popupTaken: popupTaken()
                });
                if (!decision.show) return;
                if (uiBusy() || popupTaken()) return;
                if (!window.claimSessionPopup('push')) return;
                try { sessionStorage.setItem('btc_push_prompt_shown', '1'); } catch (e2) {}
                persistPrompt({
                    count: stored.count + 1,
                    lastAsked: Date.now(),
                    stopped: stored.stopped,
                    dontAsk: stored.dontAsk
                });
                showOptInCard(decision, false);
            });
        }).catch(function() {}).then(function() { _considering = false; });
    }

    window.notePushMoment = function(kind) {
        if (kind !== 'win' && kind !== 'gift' && kind !== 'favor' && kind !== 'pvp') return;
        window._pushMoment = kind;
        considerPrompt();
    };

    window.openNotificationSettings = function() {
        window._highlightNotifSettings = true;
        var modal = document.getElementById('usernameModal');
        if (modal) modal.style.zIndex = '700000';
        if (typeof window.showSettings === 'function') window.showSettings();
        if (typeof showSettingsPage === 'function' && signedIn()) {
            showSettingsPage('prefs');
            return;
        }
        setTimeout(function() {
            if (typeof showSettingsPage === 'function') showSettingsPage('prefs');
        }, 700);
    };

    window.syncPushRegistration = function() {
        if (!signedIn() || permissionState() !== 'granted') return;
        loadUser().then(function(user) {
            var map = user && user.notificationPrefs;
            if (!map || map.master !== true) return;
            registerPushToken({ silent: true });
        });
    };

    window.schedulePushPrompt = function() {
        try {
            if (sessionStorage.getItem('btc_open_notif_settings') === '1') {
                sessionStorage.removeItem('btc_open_notif_settings');
                setTimeout(window.openNotificationSettings, 500);
            }
        } catch (e) {}
        if (_promptStarted) return;
        _promptStarted = true;
        setTimeout(considerPrompt, 4000);
        setTimeout(considerPrompt, 20000);
        setTimeout(considerPrompt, 60000);
    };

    function mountSettingsPreview() {
        ensureStyles();
        window._pushPreview = true;
        window._pushPreviewPrefs = { rewards: true, gifts: true, dms: true };
        var modal = document.getElementById('usernameModal');
        var box = modal && modal.querySelector('.username-box');
        if (!modal || !box) {
            modal = document.createElement('div');
            modal.id = 'pushPreviewSettings';
            modal.style.cssText = 'position:fixed;inset:0;z-index:800000;background:var(--overlay);overflow:auto;padding:16px;';
            box = document.createElement('div');
            box.style.cssText = 'background:var(--bg-side);color:var(--text);border:1px solid var(--border);border-radius:24px;padding:20px 16px;max-width:440px;width:100%;margin:10px auto;';
            modal.appendChild(box);
            document.body.appendChild(modal);
        } else {
            modal.classList.add('open');
            modal.style.display = 'block';
            modal.style.zIndex = '800000';
            box.style.textAlign = 'left';
            box.style.maxWidth = '440px';
        }
        box.textContent = '';
        var kicker = el('div', 'push-kicker', 'Preferences');
        box.appendChild(kicker);
        var host = el('div');
        host.id = 'settings-notifications';
        box.appendChild(host);
        window.renderNotificationSettings();
    }

    function bootPreview() {
        var host = location.hostname;
        if (host !== 'localhost' && host !== '127.0.0.1') return;
        var params;
        try { params = new URLSearchParams(location.search); } catch (e) { return; }
        var mode = params.get('previewPush');
        if (!mode) return;
        if (params.get('theme') === 'light') document.body.setAttribute('data-theme', 'light');
        document.body.style.opacity = '1';
        window._pushPreview = true;
        if (mode === 'settings') mountSettingsPreview();
        else {
            showOptInCard({
                show: true,
                kind: mode === 'install' ? 'install' : (mode === 'reask' ? 'context' : 'standard'),
                context: mode === 'reask' ? 'win' : null,
                askIndex: mode === 'reask' ? 2 : 1,
                showDontAsk: mode === 'reask',
                reason: 'preview'
            }, true);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootPreview);
    else bootPreview();
})();
