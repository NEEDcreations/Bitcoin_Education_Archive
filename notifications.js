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
        }, function(err) { console.warn('[notif] Listener error:', err); });

    // Also check unread DMs
    checkUnreadDMs();
    setInterval(checkUnreadDMs, 30000); // every 30s
};

function checkUnreadDMs() {
    if (!auth || !auth.currentUser || typeof db === 'undefined') return;
    var uid = auth.currentUser.uid;
    db.collection('conversations')
        .where('participants', 'array-contains', uid)
        .where('lastMessageAt', '>', new Date(Date.now() - 86400000)) // last 24h
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
            var icons = { upvote: '👍', reply: '💬', tip: '⚡', comment: '💬', like: '❤️', mention: '🔔' };
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
        if (list) list.innerHTML = '<div style="color:#ef4444;text-align:center;padding:20px;">Error loading notifications</div>';
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
    else if (targetType === 'dm' && targetId) { if (typeof showInbox === 'function') showInbox(); }
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

// Initialize on auth state change
if (typeof auth !== 'undefined' && auth) {
    auth.onAuthStateChanged(function(user) {
        if (user && !user.isAnonymous) {
            setTimeout(initNotifications, 2000);
        }
    });
}
