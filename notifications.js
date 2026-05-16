// ---- USER NOTIFICATIONS SYSTEM ----
// Red badge on username display + DM badge on bottom nav
// Firestore collection: notifications/{notifId}

window._notifCount = 0;
window._notifUnsub = null;
window._dmUnreadCount = 0;

// Start listening for notifications
window.initNotifications = function() {
    if (!auth || !auth.currentUser || typeof db === 'undefined') return;
    var uid = auth.currentUser.uid;

    // Cleanup previous listener
    if (window._notifUnsub) { window._notifUnsub(); window._notifUnsub = null; }

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
                if (change.type === 'added' && change.doc.data().type === 'tip') {
                    var _tr = parseInt(localStorage.getItem('btc_tips_received') || '0'); localStorage.setItem('btc_tips_received', String(_tr + 1));
                }
            });
        }, function(err) { console.warn('[notif] Listener error:', err); });

    // Listen for unread DMs via onSnapshot (replaces 30s polling — saves ~2800 reads/user/day)
    startDMListener(uid);
};

function startDMListener(uid) {
    if (window._dmUnsub) { window._dmUnsub(); window._dmUnsub = null; }
    if (!uid || typeof db === 'undefined') return;
    try {
        window._dmUnsub = db.collection('conversations')
            .where('participants', 'array-contains', uid)
            .where('lastMessageAt', '>', new Date(Date.now() - 86400000))
            .onSnapshot(function(snap) {
                var unread = 0;
                snap.forEach(function(doc) {
                    var d = doc.data();
                    var lastRead = d['lastRead_' + uid];
                    if (d.lastMessageAt && (!lastRead || d.lastMessageAt.toMillis() > lastRead.toMillis())) {
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
    db.collection('conversations')
        .where('participants', 'array-contains', uid)
        .where('lastMessageAt', '>', new Date(Date.now() - 86400000))
        .get().then(function(snap) {
            var unread = 0;
            snap.forEach(function(doc) {
                var d = doc.data();
                var lastRead = d['lastRead_' + uid];
                if (d.lastMessageAt && (!lastRead || d.lastMessageAt.toMillis() > lastRead.toMillis())) {
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
        if (snap.empty) { list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-faint);">No notifications yet! 🦌</div>'; return; }

        var html = '';
        snap.forEach(function(doc) {
            var n = doc.data();
            var esc = typeof escapeHtml === 'function' ? escapeHtml : function(s) { return s; };
            var timeStr = n.createdAt && n.createdAt.toDate ? (typeof timeAgo === 'function' ? timeAgo(n.createdAt.toDate()) : n.createdAt.toDate().toLocaleDateString()) : '';
            var isUnread = !n.read;
            var icons = { upvote: '👍', reply: '💬', tip: '⚡', comment: '💬', like: '❤️', mention: '🔔', level_up: '🎉', badge: '🏅', quest: '🏆', spin: '🎡', sats: '⚡', dm: '💬', streak: '🔥', milestone: '🗺️' };
            var icon = icons[n.type] || '🔔';

            html += '<div style="padding:10px;border-bottom:1px solid var(--border);background:' + (isUnread ? 'rgba(247,147,26,0.04)' : 'none') + ';cursor:pointer;" onclick="handleNotifClick(\'' + doc.id + '\',\'' + (n.targetType || '') + '\',\'' + (n.targetId || '') + '\')">' +
                '<div style="display:flex;gap:8px;align-items:flex-start;">' +
                    '<span style="font-size:1.1rem;flex-shrink:0;">' + icon + '</span>' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="font-size:0.82rem;color:var(--text);line-height:1.4;' + (isUnread ? 'font-weight:600;' : '') + '">' + esc(n.message || '') + '</div>' +
                        '<div style="font-size:0.7rem;color:var(--text-faint);margin-top:2px;">' + timeStr + '</div>' +
                    '</div>' +
                    (isUnread ? '<div style="width:8px;height:8px;border-radius:50%;background:#f7931a;flex-shrink:0;margin-top:6px;"></div>' : '') +
                '</div>' +
            '</div>';
        });
        list.innerHTML = html;
    } catch(e) {
        var list = document.getElementById('notifList');
        if (list) list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.82rem;">Could not load notifications</div>';
    }
};

// Handle notification click — navigate to content
window.handleNotifClick = async function(notifId, targetType, targetId) {
    // Mark as read
    try { await db.collection('notifications').doc(notifId).update({ read: true }); } catch(e) {}
    // Close overlay
    var ov = document.getElementById('notifOverlay');
    if (ov) ov.remove();
    // Navigate
    if (targetType === 'forum_post' && targetId) { if (typeof forumViewPost === 'function') forumViewPost(targetId); }
    else if (targetType === 'article' && targetId) { if (typeof articleView === 'function') articleView(targetId); }
    else if (targetType === 'dm' && targetId) {
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
        await db.collection('notifications').add({
            recipientId: recipientId,
            senderId: auth.currentUser.uid,
            senderName: (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Someone',
            type: type,
            message: message,
            targetType: targetType || null,
            targetId: targetId || null,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch(e) { console.warn('[notif] Send error:', e); }
};

// ---- Notification Overlay (floating 🔔 button) ----
var _notifOverlayOpen = false;

function createNotifOverlay() {
    if (document.getElementById('notifOverlayBtn')) return;

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
    header.style.cssText = 'flex-shrink:0;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);';
    header.innerHTML = '<span style="font-weight:700;font-size:0.85rem;color:var(--heading,#fff);">🔔 Notifications</span>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
            '<button onclick="markAllNotifsRead();renderNotifList()" style="padding:4px 10px;background:none;border:1px solid var(--border);border-radius:6px;color:var(--text-muted);font-size:0.65rem;cursor:pointer;font-family:inherit;">Mark all read</button>' +
            '<button onclick="toggleNotifOverlay()" style="background:none;border:none;color:var(--text-faint);font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>' +
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
        renderNotifList();
        // Clear badge
        var b = document.getElementById('notifOverlayBadge');
        if (b) b.style.display = 'none';
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
            body.innerHTML = '<div style="text-align:center;padding:40px 20px;"><div style="font-size:2rem;margin-bottom:8px;">🔔</div><div style="color:var(--text-muted);font-size:0.85rem;">No notifications yet!</div></div>';
            return;
        }

        var html = '';
        var icons = { upvote: '👍', reply: '💬', tip: '⚡', comment: '💬', like: '❤️', mention: '🔔', level_up: '🎉', badge: '🏅', quest: '🏆', spin: '🎡', prediction: '📊', welcome: '👋', chat_mention: '💬', dj: '🎧', referral: '👥', closet: '👔', sats: '⚡', dm: '💬', streak: '🔥', milestone: '🗺️', buddy: '🤝' };
        snap.forEach(function(doc) {
            var n = doc.data();
            var e = typeof escapeHtml === 'function' ? escapeHtml : function(s) { return s || ''; };
            var ts = n.createdAt && n.createdAt.toDate ? n.createdAt.toDate() : null;
            var timeStr = ts ? formatNotifTime(ts) : '';
            var isUnread = !n.read;
            var icon = icons[n.type] || '🔔';

            html += '<div onclick="handleNotifClick(\'' + doc.id + '\',\'' + (n.targetType || '') + '\',\'' + (n.targetId || '') + '\');toggleNotifOverlay()" style="padding:12px 16px;border-bottom:1px solid var(--border);background:' + (isUnread ? 'rgba(247,147,26,0.04)' : 'none') + ';cursor:pointer;transition:0.15s;" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'' + (isUnread ? 'rgba(247,147,26,0.04)' : 'none') + '\'">' +
                '<div style="display:flex;gap:10px;align-items:flex-start;">' +
                    '<span style="font-size:1.2rem;flex-shrink:0;">' + icon + '</span>' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="font-size:0.82rem;color:var(--text);line-height:1.4;' + (isUnread ? 'font-weight:600;' : '') + '">' + e(n.message || '') + '</div>' +
                        '<div style="font-size:0.65rem;color:var(--text-faint);margin-top:3px;">' + timeStr + '</div>' +
                    '</div>' +
                    (isUnread ? '<div style="width:8px;height:8px;border-radius:50%;background:#f7931a;flex-shrink:0;margin-top:6px;"></div>' : '') +
                '</div>' +
            '</div>';
        });
        body.innerHTML = html;
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
    var count = window._notifCount || 0;
    var badge = document.getElementById('notifOverlayBadge');
    if (badge) {
        if (count > 0 && !_notifOverlayOpen) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
    // Mirror to bottom nav badge
    var bnavBadge = document.getElementById('bnavNotifBadge');
    if (bnavBadge) {
        if (count > 0 && !_notifOverlayOpen) {
            bnavBadge.textContent = count > 9 ? '9+' : count;
            bnavBadge.style.display = 'block';
        } else {
            bnavBadge.style.display = 'none';
        }
    }
};

// ---- Self-Notifications (local events → Firestore) ----
// Notify on level up (leaderboard rank)
window.notifySelfLevelUp = function(minPts, levelName, emoji) {
    if (!auth || !auth.currentUser) return;
    db.collection('notifications').add({
        recipientId: auth.currentUser.uid,
        senderId: 'system',
        senderName: 'System',
        type: 'level_up',
        message: (emoji || '🎉') + ' You ranked up to ' + (levelName || 'a new level') + '! (' + (minPts || 0) + '+ pts)',
        targetType: null, targetId: null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
};

// Notify on badge unlock
window.notifySelfBadge = function(badgeName, badgeEmoji) {
    if (!auth || !auth.currentUser) return;
    db.collection('notifications').add({
        recipientId: auth.currentUser.uid,
        senderId: 'system', senderName: 'System',
        type: 'badge',
        message: (badgeEmoji || '🏅') + ' Badge unlocked: ' + (badgeName || 'New Badge') + '!',
        targetType: null, targetId: null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
};

// Notify on quest complete
window.notifySelfQuest = function(questName) {
    if (!auth || !auth.currentUser) return;
    db.collection('notifications').add({
        recipientId: auth.currentUser.uid,
        senderId: 'system', senderName: 'System',
        type: 'quest',
        message: '🏆 Quest complete: ' + (questName || 'Quest') + '! Check your rewards.',
        targetType: null, targetId: null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
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
    if (!auth || !auth.currentUser) return;
    db.collection('notifications').add({
        recipientId: auth.currentUser.uid,
        senderId: 'system', senderName: 'System',
        type: 'prediction',
        message: correct ? '📊 ✅ Your price prediction was correct! Bitcoin went ' + (direction || 'up') + '.' : '📊 ❌ Your price prediction was wrong. Better luck tomorrow!',
        targetType: null, targetId: null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
};

// Notify spin wheel result
window.notifySelfSpin = function(rewardText) {
    if (!auth || !auth.currentUser) return;
    db.collection('notifications').add({
        recipientId: auth.currentUser.uid,
        senderId: 'system', senderName: 'System',
        type: 'spin',
        message: '🎡 Daily Spin: ' + (rewardText || 'You won a prize!'),
        targetType: null, targetId: null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
};

// Notify referral reward
window.notifySelfReferral = function(ticketsEarned) {
    if (!auth || !auth.currentUser) return;
    db.collection('notifications').add({
        recipientId: auth.currentUser.uid,
        senderId: 'system', senderName: 'System',
        type: 'referral',
        message: '👥 Referral verified! You earned ' + ticketsEarned + ' Orange Ticket' + (ticketsEarned > 1 ? 's' : '') + '!',
        targetType: null, targetId: null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
};

// Notify Nacho closet item unlock
window.notifySelfClosetItem = function(itemName, itemEmoji) {
    if (!auth || !auth.currentUser) return;
    db.collection('notifications').add({
        recipientId: auth.currentUser.uid,
        senderId: 'system', senderName: 'System',
        type: 'closet',
        message: (itemEmoji || '👔') + ' New Nacho closet item: ' + (itemName || 'Unknown') + '! Equip it in Settings.',
        targetType: null, targetId: null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
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

// Notify on points earned
window.notifySelfPoints = function(pts, reason) {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) return;
    if (!pts || pts < 1) return;
    // Throttle: max 1 points notification per 45 seconds to avoid spam
    var now = Date.now();
    window._lastPointsNotif = window._lastPointsNotif || 0;
    if (now - window._lastPointsNotif < 45000) return;
    window._lastPointsNotif = now;
    var msg = '🎯 +' + pts + ' pts';
    if (reason) msg += ' — ' + reason;
    db.collection('notifications').add({
        recipientId: auth.currentUser.uid,
        senderId: 'system', senderName: 'System',
        type: 'points',
        message: msg,
        targetType: null, targetId: null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
};

// Notify on sats claim
window.notifySelfSatsClaim = function(amount) {
    if (!auth || !auth.currentUser) return;
    db.collection('notifications').add({
        recipientId: auth.currentUser.uid,
        senderId: 'system', senderName: 'System',
        type: 'sats',
        message: '⚡ You claimed ' + amount + ' sats! Check your Lightning wallet.',
        targetType: null, targetId: null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
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
    if (!auth || !auth.currentUser) return;
    db.collection('notifications').add({
        recipientId: auth.currentUser.uid,
        senderId: 'system', senderName: 'System',
        type: 'streak',
        message: '🔥 ' + streakDays + '-day streak! Keep it going!',
        targetType: null, targetId: null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
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
