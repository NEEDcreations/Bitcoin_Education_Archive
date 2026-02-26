'use strict';

// =============================================
// Bitcoin Education Archive - Messaging System
// Online Presence + User Profiles + Direct Messages
// =============================================

// ---- CONFIG ----
var MSG_CONFIG = {
    onlineThreshold: 5 * 60 * 1000,    // 5 min = online (green)
    awayThreshold: 15 * 60 * 1000,     // 15 min = away (yellow)
    presenceInterval: 60 * 1000,        // Update presence every 60s
    maxMsgLength: 500,                  // Max characters per message
    maxMsgsPerHour: 30,                 // Rate limit
    maxConvoHistory: 100,               // Max messages loaded per conversation
    unreadPollInterval: 30 * 1000,      // Check unread every 30s
};

// ---- SECURITY & SAFETY ----

// Scam/phishing link detection
var SUSPICIOUS_PATTERNS = [
    /send\s*(?:me|ur|your)\s*(?:btc|bitcoin|sats|seed|key|phrase)/i,
    /(?:double|triple|multiply)\s*(?:your|ur)\s*(?:btc|bitcoin|sats|crypto)/i,
    /(?:free|win|won|claim|airdrop)\s*(?:btc|bitcoin|sats|crypto|nft)/i,
    /(?:invest|deposit)\s*(?:now|today|here)\b/i,
    /(?:guaranteed|100%)\s*(?:return|profit|roi)/i,
    /send\s*\d+\s*(?:btc|sats)\s*(?:to|and)\s*(?:get|receive|earn)/i,
    /(?:seed|private)\s*(?:phrase|key)\s*(?:here|now|please|share)/i,
    /(?:validate|verify|sync)\s*(?:your|ur)\s*(?:wallet|account)/i,
    /(?:connect|link)\s*(?:your|ur)\s*(?:wallet|metamask|phantom)/i,
    /(?:nigerian|prince|inheritance|lottery)\s*(?:fund|money|payment)/i,
];

// Suspicious URL patterns
var SUSPICIOUS_URLS = [
    /bit\.ly|tinyurl|t\.co|goo\.gl|is\.gd|buff\.ly|ow\.ly|rebrand\.ly/i,   // URL shorteners
    /(?:discord\.gift|discordapp\.gift|nitro.*free)/i,                        // Discord scams
    /(?:steamcommunity|steampowered).*(?:gift|trade|login)/i,                 // Steam scams
    /(?:wallet|connect|validate|sync|claim|airdrop).*(?:\.com|\.io|\.xyz|\.site|\.app)/i,  // Crypto scam sites
    /(?:dapp|defi|swap|bridge|mint).*(?:\.com|\.io|\.xyz|\.site)/i,           // DeFi scam sites
];

// Blocked content
var BLOCKED_CONTENT = [
    /(?:child|minor|underage).*(?:porn|nude|nsfw)/i,
    /(?:kill|murder|attack|bomb|shoot).*(?:yourself|someone|them|people|school)/i,
    /\b(?:doxx|doxing|swat)\b/i,
];

// Warn about external links
function containsSuspiciousLink(text) {
    // Check for URLs
    var urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
    var urls = text.match(urlPattern) || [];
    for (var i = 0; i < urls.length; i++) {
        for (var j = 0; j < SUSPICIOUS_URLS.length; j++) {
            if (SUSPICIOUS_URLS[j].test(urls[i])) return 'suspicious_link';
        }
    }
    return null;
}

function containsScamPattern(text) {
    for (var i = 0; i < SUSPICIOUS_PATTERNS.length; i++) {
        if (SUSPICIOUS_PATTERNS[i].test(text)) return true;
    }
    return false;
}

function containsBlockedContent(text) {
    for (var i = 0; i < BLOCKED_CONTENT.length; i++) {
        if (BLOCKED_CONTENT[i].test(text)) return true;
    }
    return false;
}

// Sanitize message text (strip HTML, limit length)
function sanitizeMessage(text) {
    if (!text) return '';
    // Strip any HTML tags
    text = text.replace(/<[^>]*>/g, '');
    // Trim whitespace
    text = text.trim();
    // Enforce max length
    if (text.length > MSG_CONFIG.maxMsgLength) text = text.substring(0, MSG_CONFIG.maxMsgLength);
    return text;
}

// ---- BLOCK/UNBLOCK USERS ----
window.getBlockedUsers = function() {
    try { return JSON.parse(localStorage.getItem('btc_blocked_users') || '[]'); } catch(e) { return []; }
};

window.isUserBlocked = function(uid) {
    return getBlockedUsers().indexOf(uid) !== -1;
};

window.blockUser = function(uid, username) {
    if (!uid) return;
    var blocked = getBlockedUsers();
    if (blocked.indexOf(uid) !== -1) return; // Already blocked
    blocked.push(uid);
    localStorage.setItem('btc_blocked_users', JSON.stringify(blocked));
    // Also save to Firestore for cross-device sync
    if (auth && auth.currentUser && db) {
        db.collection('users').doc(auth.currentUser.uid).update({
            blockedUsers: firebase.firestore.FieldValue.arrayUnion(uid)
        }).catch(function(){});
    }
    if (typeof showToast === 'function') showToast('🚫 Blocked ' + (username || 'user') + '. You won\'t see their messages.');
    // Close DM if open with this user
    closeDM();
};

window.unblockUser = function(uid, username) {
    if (!uid) return;
    var blocked = getBlockedUsers();
    blocked = blocked.filter(function(id) { return id !== uid; });
    localStorage.setItem('btc_blocked_users', JSON.stringify(blocked));
    if (auth && auth.currentUser && db) {
        db.collection('users').doc(auth.currentUser.uid).update({
            blockedUsers: firebase.firestore.FieldValue.arrayRemove(uid)
        }).catch(function(){});
    }
    if (typeof showToast === 'function') showToast('✅ Unblocked ' + (username || 'user'));
};

// ---- REPORT USER ----
window.reportUser = function(uid, username, reason) {
    if (!uid || !auth || !auth.currentUser) return;
    var reporterName = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.username : 'Anonymous';

    // Show report dialog if no reason provided
    if (!reason) {
        var html = '<div id="reportModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10003;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)this.remove()">' +
            '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:340px;width:100%;">' +
            '<div style="font-size:1rem;font-weight:800;color:var(--heading);margin-bottom:12px;">🚩 Report ' + escapeHtml(username || 'User') + '</div>' +
            '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px;">Why are you reporting this user?</div>' +
            '<button onclick="submitReport(\'' + uid + '\',\'' + escapeHtml(username || '').replace(/'/g, "\\'") + '\',\'spam\')" style="width:100%;padding:10px;margin-bottom:6px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.85rem;cursor:pointer;font-family:inherit;text-align:left;">📧 Spam / Unwanted messages</button>' +
            '<button onclick="submitReport(\'' + uid + '\',\'' + escapeHtml(username || '').replace(/'/g, "\\'") + '\',\'scam\')" style="width:100%;padding:10px;margin-bottom:6px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.85rem;cursor:pointer;font-family:inherit;text-align:left;">🎣 Scam / Phishing</button>' +
            '<button onclick="submitReport(\'' + uid + '\',\'' + escapeHtml(username || '').replace(/'/g, "\\'") + '\',\'harassment\')" style="width:100%;padding:10px;margin-bottom:6px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.85rem;cursor:pointer;font-family:inherit;text-align:left;">😡 Harassment / Abuse</button>' +
            '<button onclick="submitReport(\'' + uid + '\',\'' + escapeHtml(username || '').replace(/'/g, "\\'") + '\',\'inappropriate\')" style="width:100%;padding:10px;margin-bottom:6px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.85rem;cursor:pointer;font-family:inherit;text-align:left;">🔞 Inappropriate content</button>' +
            '<button onclick="submitReport(\'' + uid + '\',\'' + escapeHtml(username || '').replace(/'/g, "\\'") + '\',\'impersonation\')" style="width:100%;padding:10px;margin-bottom:6px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.85rem;cursor:pointer;font-family:inherit;text-align:left;">🎭 Impersonation</button>' +
            '<button onclick="document.getElementById(\'reportModal\').remove()" style="width:100%;padding:10px;margin-top:4px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;font-family:inherit;">Cancel</button>' +
            '</div></div>';
        var div = document.createElement('div');
        div.innerHTML = html;
        document.body.appendChild(div.firstChild);
        return;
    }
};

window.submitReport = function(uid, username, reason) {
    var modal = document.getElementById('reportModal');
    if (modal) modal.remove();

    if (!db || !auth || !auth.currentUser) return;
    var reporterName = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.username : 'Anonymous';

    db.collection('reports').add({
        reportedUid: uid,
        reportedName: username,
        reporterUid: auth.currentUser.uid,
        reporterName: reporterName,
        reason: reason,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
    }).then(function() {
        if (typeof showToast === 'function') showToast('🚩 Report submitted. Thank you for keeping the community safe.');
        // Auto-block the reported user
        blockUser(uid, username);
    }).catch(function() {
        if (typeof showToast === 'function') showToast('Failed to submit report');
    });
};

// ---- RESTORE BLOCKED LIST FROM FIRESTORE ----
function restoreBlockedList() {
    if (!auth || !auth.currentUser || !db) return;
    db.collection('users').doc(auth.currentUser.uid).get().then(function(doc) {
        if (doc.exists && doc.data().blockedUsers) {
            var remote = doc.data().blockedUsers;
            var local = getBlockedUsers();
            var merged = Array.from(new Set(local.concat(remote)));
            localStorage.setItem('btc_blocked_users', JSON.stringify(merged));
        }
    }).catch(function(){});
}

// ---- ONLINE PRESENCE ----
var _presenceTimer = null;

function updatePresence() {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) return;
    if (!db) return;
    try {
        db.collection('users').doc(auth.currentUser.uid).update({
            lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            isOnline: true,
        }).catch(function() {});
    } catch(e) {}
}

function startPresenceTracking() {
    updatePresence();
    if (_presenceTimer) clearInterval(_presenceTimer);
    _presenceTimer = setInterval(updatePresence, MSG_CONFIG.presenceInterval);

    // Mark offline on page close
    window.addEventListener('beforeunload', function() {
        if (auth && auth.currentUser && !auth.currentUser.isAnonymous && db) {
            // Use sendBeacon pattern - update via navigator if available
            try {
                db.collection('users').doc(auth.currentUser.uid).update({
                    isOnline: false,
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                });
            } catch(e) {}
        }
    });

    // Also update on visibility change (tab focus)
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') updatePresence();
    });
}

window.getOnlineStatus = function(lastSeen) {
    if (!lastSeen) return { status: 'offline', color: '#6b7280', label: 'Offline', dot: '⚫' };
    var ts = lastSeen.toDate ? lastSeen.toDate().getTime() : (typeof lastSeen === 'number' ? lastSeen : new Date(lastSeen).getTime());
    var diff = Date.now() - ts;
    if (diff < MSG_CONFIG.onlineThreshold) return { status: 'online', color: '#22c55e', label: 'Online', dot: '🟢' };
    if (diff < MSG_CONFIG.awayThreshold) return { status: 'away', color: '#eab308', label: 'Away', dot: '🟡' };
    return { status: 'offline', color: '#6b7280', label: 'Offline', dot: '⚫' };
};

// ---- STATUS DOT HTML (for leaderboard/forum) ----
window.onlineStatusDot = function(lastSeen) {
    var s = getOnlineStatus(lastSeen);
    if (s.status === 'offline') return '';
    return '<span title="' + s.label + '" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + s.color + ';margin-left:4px;vertical-align:middle;' + (s.status === 'online' ? 'box-shadow:0 0 6px ' + s.color + ';' : '') + '"></span>';
};

// ---- USER PROFILE MODAL ----
window.showUserProfile = function(uid) {
    if (!uid || !db) return;

    // Don't show profile for yourself (go to settings instead)
    if (auth && auth.currentUser && auth.currentUser.uid === uid) {
        if (typeof showSettings === 'function') showSettings();
        return;
    }

    // Show loading
    var loadingHtml = '<div id="userProfileModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)this.remove()">' +
        '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:20px;padding:30px;max-width:360px;width:100%;text-align:center;">' +
        '<div style="color:var(--text-muted);font-size:0.9rem;">Loading profile...</div></div></div>';
    var d = document.createElement('div');
    d.innerHTML = loadingHtml;
    document.body.appendChild(d.firstChild);

    db.collection('users').doc(uid).get().then(function(doc) {
        if (!doc.exists) {
            var modal = document.getElementById('userProfileModal');
            if (modal) modal.remove();
            if (typeof showToast === 'function') showToast('User not found');
            return;
        }
        var u = doc.data();
        var status = getOnlineStatus(u.lastSeen);
        var lvl = typeof getLevel === 'function' ? getLevel(u.points || 0) : { name: 'Newbie', emoji: '🌱' };
        var joinDate = u.createdAt ? (u.createdAt.toDate ? u.createdAt.toDate().toLocaleDateString() : 'Unknown') : 'Unknown';
        var displayBadge = u.displayBadge || lvl.emoji;

        // Count badges
        var badgeCount = 0;
        if (u.visibleBadges) badgeCount += u.visibleBadges.length;
        if (u.hiddenBadges) badgeCount += u.hiddenBadges.length;

        var canMessage = auth && auth.currentUser && !auth.currentUser.isAnonymous && auth.currentUser.uid !== uid;

        var html = '<div id="userProfileModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)this.remove()">' +
            '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:20px;padding:30px;max-width:360px;width:100%;">' +
            // Close button
            '<button onclick="document.getElementById(\'userProfileModal\').remove()" style="float:right;background:none;border:1px solid var(--border);color:var(--text-muted);width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">✕</button>' +
            // Avatar & name
            '<div style="text-align:center;margin-bottom:16px;">' +
                '<div style="font-size:2.5rem;margin-bottom:8px;">' + displayBadge + '</div>' +
                '<div style="color:var(--heading);font-weight:800;font-size:1.2rem;">' + escapeHtml(u.username || 'Bitcoiner') +
                    '<span title="' + status.label + '" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + status.color + ';margin-left:6px;vertical-align:middle;' + (status.status === 'online' ? 'box-shadow:0 0 8px ' + status.color + ';' : '') + '"></span>' +
                '</div>' +
                '<div style="color:var(--text-muted);font-size:0.85rem;margin-top:4px;">' + lvl.name + ' · ' + (u.points || 0).toLocaleString() + ' pts</div>' +
                '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:2px;">' + status.label + '</div>' +
            '</div>' +
            // Stats grid
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">' +
                profileStat('🏅', badgeCount, 'Badges') +
                profileStat('📖', (u.readChannels ? u.readChannels.length : u.visitedChannelsList ? u.visitedChannelsList.length : 0), 'Channels') +
                profileStat('🎟️', u.orangeTickets || 0, 'Tickets') +
            '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">' +
                profileStat('🗣️', u.forumPosts || 0, 'Posts') +
                profileStat('🔥', u.streak || 0, 'Streak') +
                profileStat('📅', joinDate, 'Joined') +
            '</div>' +
            // Message button
            (canMessage ?
                '<button onclick="document.getElementById(\'userProfileModal\').remove();openDM(\'' + uid + '\',\'' + escapeHtml(u.username || 'Bitcoiner').replace(/'/g, "\\'") + '\')" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;">💬 Message ' + escapeHtml(u.username || 'Bitcoiner') + '</button>'
                : (!auth || !auth.currentUser || auth.currentUser.isAnonymous ?
                    '<button onclick="document.getElementById(\'userProfileModal\').remove();if(typeof showUsernamePrompt===\'function\')showUsernamePrompt()" style="width:100%;padding:14px;background:var(--card-bg);border:1px solid var(--border);color:var(--text-muted);border-radius:12px;font-size:0.9rem;cursor:pointer;font-family:inherit;">🔒 Sign in to message</button>'
                    : '')) +
            // Block & Report buttons
            (canMessage ?
                '<div style="display:flex;gap:8px;margin-top:8px;">' +
                    (isUserBlocked(uid) ?
                        '<button onclick="unblockUser(\'' + uid + '\',\'' + escapeHtml(u.username || '').replace(/'/g, "\\'") + '\');document.getElementById(\'userProfileModal\').remove()" style="flex:1;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;">✅ Unblock</button>'
                        : '<button onclick="blockUser(\'' + uid + '\',\'' + escapeHtml(u.username || '').replace(/'/g, "\\'") + '\');document.getElementById(\'userProfileModal\').remove()" style="flex:1;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;">🚫 Block</button>') +
                    '<button onclick="document.getElementById(\'userProfileModal\').remove();reportUser(\'' + uid + '\',\'' + escapeHtml(u.username || '').replace(/'/g, "\\'") + '\')" style="flex:1;padding:10px;background:none;border:1px solid #ef4444;border-radius:10px;color:#ef4444;font-size:0.8rem;cursor:pointer;font-family:inherit;">🚩 Report</button>' +
                '</div>' : '') +
            '</div></div>';

        var modal = document.getElementById('userProfileModal');
        if (modal) modal.remove();
        var div = document.createElement('div');
        div.innerHTML = html;
        document.body.appendChild(div.firstChild);
    }).catch(function() {
        var modal = document.getElementById('userProfileModal');
        if (modal) modal.remove();
        if (typeof showToast === 'function') showToast('Could not load profile');
    });
};

function profileStat(emoji, value, label) {
    return '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:8px 4px;text-align:center;">' +
        '<div style="font-size:0.75rem;">' + emoji + '</div>' +
        '<div style="font-size:0.85rem;font-weight:700;color:var(--heading);">' + value + '</div>' +
        '<div style="font-size:0.6rem;color:var(--text-faint);">' + label + '</div></div>';
}

function timeAgo(ts) {
    if (!ts) return '';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    var diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString();
}

function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- DIRECT MESSAGING ----

// Rate limiting
var _msgSentTimestamps = [];

function checkRateLimit() {
    var now = Date.now();
    _msgSentTimestamps = _msgSentTimestamps.filter(function(t) { return now - t < 3600000; });
    return _msgSentTimestamps.length < MSG_CONFIG.maxMsgsPerHour;
}

// Get or create a conversation between two users
function getConversationId(uid1, uid2) {
    // Deterministic: always sort UIDs so both users get same convo ID
    return uid1 < uid2 ? uid1 + '_' + uid2 : uid2 + '_' + uid1;
}

// Open DM with a user
window.openDM = function(recipientUid, recipientName) {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('🔒 Sign in to send messages');
        if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
        return;
    }

    // Block check
    if (isUserBlocked(recipientUid)) {
        if (typeof showToast === 'function') showToast('🚫 This user is blocked. Unblock them to message.');
        return;
    }

    var myUid = auth.currentUser.uid;
    var myName = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Bitcoiner';
    var convoId = getConversationId(myUid, recipientUid);

    showDMWindow(convoId, recipientUid, recipientName, myUid, myName);
};

// DM chat window
function showDMWindow(convoId, otherUid, otherName, myUid, myName) {
    // Remove existing
    var old = document.getElementById('dmWindow');
    if (old) old.remove();
    if (window._dmUnsubscribe) { window._dmUnsubscribe(); window._dmUnsubscribe = null; }

    var html = '<div id="dmWindow" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10002;display:flex;align-items:flex-end;justify-content:center;padding:0;" onclick="if(event.target===this)closeDM()">' +
        '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:20px 20px 0 0;max-width:500px;width:100%;height:80vh;max-height:600px;display:flex;flex-direction:column;overflow:hidden;">' +
        // Header
        '<div style="padding:16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">' +
            '<div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="event.stopPropagation();closeDM();showUserProfile(\'' + otherUid + '\')">' +
                '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);">💬 ' + escapeHtml(otherName) + '</div>' +
                '<div id="dmStatusDot"></div>' +
            '</div>' +
            '<div style="display:flex;gap:6px;align-items:center;">' +
                '<button onclick="event.stopPropagation();reportUser(\'' + otherUid + '\',\'' + escapeHtml(otherName).replace(/'/g, "\\'") + '\')" style="background:none;border:1px solid var(--border);color:var(--text-faint);width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:0.8rem;display:flex;align-items:center;justify-content:center;" title="Report user">🚩</button>' +
                '<button onclick="closeDM()" style="background:none;border:1px solid var(--border);color:var(--text-muted);width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">✕</button>' +
            '</div>' +
        '</div>' +
        // Messages area
        // Safety banner
        '<div style="padding:8px 16px;background:rgba(234,179,8,0.1);border-bottom:1px solid rgba(234,179,8,0.2);font-size:0.7rem;color:#eab308;text-align:center;flex-shrink:0;">⚠️ Never share your seed phrase, private keys, or send Bitcoin to strangers.</div>' +
        '<div id="dmMessages" style="flex:1;overflow-y:auto;padding:16px;-webkit-overflow-scrolling:touch;"></div>' +
        // Input area
        '<div style="padding:12px 16px;border-top:1px solid var(--border);flex-shrink:0;display:flex;gap:8px;align-items:center;">' +
            '<input type="text" id="dmInput" maxlength="' + MSG_CONFIG.maxMsgLength + '" placeholder="Type a message..." style="flex:1;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:0.9rem;font-family:inherit;outline:none;" onkeydown="if(event.key===\'Enter\')sendDM(\'' + convoId + '\',\'' + otherUid + '\',\'' + escapeHtml(otherName).replace(/'/g, "\\'") + '\')">' +
            '<button onclick="sendDM(\'' + convoId + '\',\'' + otherUid + '\',\'' + escapeHtml(otherName).replace(/'/g, "\\'") + '\')" style="padding:12px 16px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.9rem;flex-shrink:0;">Send</button>' +
        '</div>' +
        '</div></div>';

    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);

    // Focus input
    setTimeout(function() {
        var inp = document.getElementById('dmInput');
        if (inp) inp.focus();
    }, 300);

    // Load messages + listen for real-time updates
    loadDMMessages(convoId, myUid, otherUid, otherName);

    // Update other user's online status
    db.collection('users').doc(otherUid).get().then(function(doc) {
        if (doc.exists) {
            var s = getOnlineStatus(doc.data().lastSeen);
            var dot = document.getElementById('dmStatusDot');
            if (dot) dot.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + s.color + ';' + (s.status === 'online' ? 'box-shadow:0 0 6px ' + s.color + ';' : '') + '" title="' + s.label + '"></span>';
        }
    }).catch(function() {});
}

window.closeDM = function() {
    if (window._dmUnsubscribe) { window._dmUnsubscribe(); window._dmUnsubscribe = null; }
    var w = document.getElementById('dmWindow');
    if (w) w.remove();
};

function loadDMMessages(convoId, myUid, otherUid, otherName) {
    var container = document.getElementById('dmMessages');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:20px;">Loading messages...</div>';

    // Real-time listener on messages
    window._dmUnsubscribe = db.collection('dm_conversations').doc(convoId)
        .collection('messages')
        .orderBy('createdAt', 'asc')
        .limit(MSG_CONFIG.maxConvoHistory)
        .onSnapshot(function(snap) {
            container.innerHTML = '';

            if (snap.empty) {
                container.innerHTML = '<div style="text-align:center;padding:40px 20px;">' +
                    '<div style="font-size:2rem;margin-bottom:8px;">💬</div>' +
                    '<div style="color:var(--text-muted);font-size:0.85rem;">Start a conversation with ' + escapeHtml(otherName) + '!</div>' +
                    '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:4px;">Messages are private between you two.</div></div>';
                return;
            }

            var lastDate = '';
            snap.forEach(function(doc) {
                var m = doc.data();
                var isMe = m.senderUid === myUid;
                var time = m.createdAt ? (m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt)) : new Date();
                var dateStr = time.toLocaleDateString();

                // Date separator
                if (dateStr !== lastDate) {
                    container.innerHTML += '<div style="text-align:center;color:var(--text-faint);font-size:0.7rem;margin:12px 0 8px;">' + dateStr + '</div>';
                    lastDate = dateStr;
                }

                var timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                // Scam warning on incoming messages
                var scamWarn = (!isMe && (containsScamPattern(m.text) || containsSuspiciousLink(m.text))) ?
                    '<div style="font-size:0.65rem;color:#ef4444;margin-top:4px;padding:3px 6px;background:rgba(239,68,68,0.1);border-radius:4px;">⚠️ This message may contain a scam. Never send money to strangers.</div>' : '';
                container.innerHTML += '<div style="display:flex;justify-content:' + (isMe ? 'flex-end' : 'flex-start') + ';margin-bottom:6px;">' +
                    '<div style="max-width:80%;padding:10px 14px;border-radius:' + (isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px') + ';background:' + (isMe ? 'var(--accent)' : 'var(--card-bg)') + ';color:' + (isMe ? '#fff' : 'var(--text)') + ';font-size:0.85rem;line-height:1.5;word-break:break-word;">' +
                        escapeHtml(m.text) + scamWarn +
                        '<div style="font-size:0.6rem;color:' + (isMe ? 'rgba(255,255,255,0.6)' : 'var(--text-faint)') + ';margin-top:4px;text-align:right;">' + timeStr + '</div>' +
                    '</div></div>';
            });

            // Scroll to bottom
            container.scrollTop = container.scrollHeight;

            // Mark messages as read
            markDMRead(convoId, myUid);
        }, function(err) {
            container.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:20px;">Could not load messages</div>';
        });
}

// Send a DM
window.sendDM = function(convoId, recipientUid, recipientName) {
    var inp = document.getElementById('dmInput');
    if (!inp) return;
    var text = sanitizeMessage(inp.value);
    if (!text) return;
    if (text.length > MSG_CONFIG.maxMsgLength) {
        if (typeof showToast === 'function') showToast('Message too long (max ' + MSG_CONFIG.maxMsgLength + ' chars)');
        return;
    }

    // Block check
    if (isUserBlocked(recipientUid)) {
        if (typeof showToast === 'function') showToast('🚫 You have blocked this user');
        return;
    }

    // Blocked content check
    if (containsBlockedContent(text)) {
        if (typeof showToast === 'function') showToast('⛔ Message contains prohibited content');
        return;
    }

    // Scam detection — warn but allow send
    if (containsScamPattern(text)) {
        if (typeof showToast === 'function') showToast('⚠️ Warning: Your message looks like it could be a scam. Please be careful.');
    }

    // Suspicious link warning
    var linkCheck = containsSuspiciousLink(text);
    if (linkCheck) {
        if (typeof showToast === 'function') showToast('⚠️ Warning: Suspicious link detected. Be cautious with URLs.');
    }

    // Rate limit
    if (!checkRateLimit()) {
        if (typeof showToast === 'function') showToast('⏳ Slow down! Max ' + MSG_CONFIG.maxMsgsPerHour + ' messages per hour.');
        return;
    }

    var myUid = auth.currentUser.uid;
    var myName = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Bitcoiner';

    inp.value = '';
    _msgSentTimestamps.push(Date.now());

    // Ensure conversation document exists
    var convoRef = db.collection('dm_conversations').doc(convoId);
    var msgData = {
        senderUid: myUid,
        senderName: myName,
        text: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    // Update conversation metadata + add message
    convoRef.set({
        participants: [myUid, recipientUid],
        participantNames: { [myUid]: myName, [recipientUid]: recipientName },
        lastMessage: text,
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        lastSenderUid: myUid,
        // Track unread per participant
        ['unread_' + recipientUid]: firebase.firestore.FieldValue.increment(1),
    }, { merge: true }).then(function() {
        return convoRef.collection('messages').add(msgData);
    }).catch(function(err) {
        if (typeof showToast === 'function') showToast('Failed to send message');
    });
};

// Mark conversation as read
function markDMRead(convoId, myUid) {
    db.collection('dm_conversations').doc(convoId).update({
        ['unread_' + myUid]: 0,
    }).catch(function() {});
}

// ---- INBOX ----
window.showInbox = function() {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('🔒 Sign in to see messages');
        if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
        return;
    }

    var myUid = auth.currentUser.uid;

    // Remove existing
    var old = document.getElementById('dmInbox');
    if (old) old.remove();

    var html = '<div id="dmInbox" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10002;display:flex;align-items:flex-end;justify-content:center;padding:0;" onclick="if(event.target===this)this.remove()">' +
        '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:20px 20px 0 0;max-width:500px;width:100%;height:70vh;max-height:500px;display:flex;flex-direction:column;overflow:hidden;">' +
        '<div style="padding:16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">' +
            '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);">📬 Messages</div>' +
            '<button onclick="document.getElementById(\'dmInbox\').remove()" style="background:none;border:1px solid var(--border);color:var(--text-muted);width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">✕</button>' +
        '</div>' +
        '<div id="dmInboxList" style="flex:1;overflow-y:auto;padding:8px;-webkit-overflow-scrolling:touch;">' +
            '<div style="text-align:center;color:var(--text-faint);padding:20px;">Loading...</div>' +
        '</div></div></div>';

    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);

    // Load conversations
    db.collection('dm_conversations')
        .where('participants', 'array-contains', myUid)
        .orderBy('lastMessageTime', 'desc')
        .limit(30)
        .get()
        .then(function(snap) {
            var list = document.getElementById('dmInboxList');
            if (!list) return;

            if (snap.empty) {
                list.innerHTML = '<div style="text-align:center;padding:40px 20px;">' +
                    '<div style="font-size:2rem;margin-bottom:8px;">📬</div>' +
                    '<div style="color:var(--text-muted);font-size:0.85rem;">No messages yet</div>' +
                    '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:4px;">Tap a user on the leaderboard to start chatting!</div></div>';
                return;
            }

            list.innerHTML = '';
            snap.forEach(function(doc) {
                var c = doc.data();
                var otherUid = c.participants.find(function(p) { return p !== myUid; });
                var otherName = c.participantNames ? (c.participantNames[otherUid] || 'User') : 'User';
                var unread = c['unread_' + myUid] || 0;
                var lastMsg = c.lastMessage || '';
                if (lastMsg.length > 50) lastMsg = lastMsg.substring(0, 50) + '...';
                var lastTime = c.lastMessageTime ? timeAgo(c.lastMessageTime) : '';
                var isFromMe = c.lastSenderUid === myUid;

                list.innerHTML += '<div onclick="document.getElementById(\'dmInbox\').remove();openDM(\'' + otherUid + '\',\'' + escapeHtml(otherName).replace(/'/g, "\\'") + '\')" style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;cursor:pointer;transition:0.2s;border:1px solid ' + (unread > 0 ? 'var(--accent)' : 'transparent') + ';background:' + (unread > 0 ? 'var(--accent-bg,rgba(247,147,26,0.05))' : 'none') + ';" onmouseover="this.style.background=\'var(--card-bg)\'" onmouseout="this.style.background=\'' + (unread > 0 ? 'var(--accent-bg,rgba(247,147,26,0.05))' : 'none') + '\'">' +
                    '<div style="width:42px;height:42px;border-radius:50%;background:var(--card-bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">' + (otherName.charAt(0).toUpperCase() || '?') + '</div>' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                            '<div style="font-weight:' + (unread > 0 ? '800' : '600') + ';color:var(--heading);font-size:0.9rem;">' + escapeHtml(otherName) + '</div>' +
                            '<div style="font-size:0.65rem;color:var(--text-faint);flex-shrink:0;">' + lastTime + '</div>' +
                        '</div>' +
                        '<div style="font-size:0.8rem;color:' + (unread > 0 ? 'var(--text)' : 'var(--text-muted)') + ';font-weight:' + (unread > 0 ? '600' : '400') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (isFromMe ? 'You: ' : '') + escapeHtml(lastMsg) + '</div>' +
                    '</div>' +
                    (unread > 0 ? '<div style="background:var(--accent);color:#fff;font-size:0.65rem;font-weight:800;padding:2px 7px;border-radius:10px;flex-shrink:0;">' + unread + '</div>' : '') +
                '</div>';
            });
        }).catch(function() {
            var list = document.getElementById('dmInboxList');
            if (list) list.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:20px;">Could not load messages</div>';
        });
};

// ---- UNREAD COUNT BADGE ----
var _unreadCount = 0;
var _unreadTimer = null;

function checkUnreadCount() {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous || !db) return;
    var myUid = auth.currentUser.uid;

    db.collection('dm_conversations')
        .where('participants', 'array-contains', myUid)
        .get()
        .then(function(snap) {
            var total = 0;
            snap.forEach(function(doc) {
                var c = doc.data();
                total += (c['unread_' + myUid] || 0);
            });
            _unreadCount = total;
            updateUnreadBadge();
        }).catch(function() {});
}

function updateUnreadBadge() {
    // Update inbox button badges
    var badges = document.querySelectorAll('.dm-unread-badge');
    badges.forEach(function(b) {
        if (_unreadCount > 0) {
            b.textContent = _unreadCount > 99 ? '99+' : _unreadCount;
            b.style.display = 'inline-flex';
        } else {
            b.style.display = 'none';
        }
    });

    // Update bottom nav badge
    var navBadge = document.getElementById('bnavMsgBadge');
    if (navBadge) {
        if (_unreadCount > 0) {
            navBadge.textContent = _unreadCount;
            navBadge.style.display = 'block';
        } else {
            navBadge.style.display = 'none';
        }
    }
}

function startUnreadPolling() {
    checkUnreadCount();
    if (_unreadTimer) clearInterval(_unreadTimer);
    _unreadTimer = setInterval(checkUnreadCount, MSG_CONFIG.unreadPollInterval);
}

// ---- INIT ----
window.initMessaging = function() {
    // Start presence tracking
    startPresenceTracking();
    // Restore blocked users list from Firestore
    restoreBlockedList();
    // Start unread polling (with delay to let auth settle)
    setTimeout(startUnreadPolling, 5000);
};

// Auto-init when auth is ready
if (typeof auth !== 'undefined' && auth && auth.currentUser) {
    initMessaging();
}
