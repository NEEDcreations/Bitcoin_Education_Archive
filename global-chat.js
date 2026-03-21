// =============================================
// 💬 Global Chat — Real-time chatroom for all users
// =============================================
!function() {
'use strict';

var CHAT_COLLECTION = 'global_chat';
var MAX_MSG_LENGTH = 300;
var RATE_LIMIT_MS = 3000; // 3 seconds between messages
var MAX_MSGS_DISPLAY = 100;
var _chatUnsub = null;
var _lastSendTime = 0;
var _chatTab = 'global'; // 'global' or 'dms'

// Profanity filter
var BAD_WORDS = ['fuck','shit','bitch','dick','cock','pussy','cunt','nigger','nigga','fag','retard','nazi','hitler','kkk','porn','hentai','rape','pedo','kill yourself','kys'];
function containsProfanity(text) {
    var lower = text.toLowerCase().replace(/[0-9@$!*_\-]/g, function(c) {
        return {'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s','!':'i','*':''}[c] || c;
    });
    for (var i = 0; i < BAD_WORDS.length; i++) {
        if (lower.includes(BAD_WORDS[i])) return true;
    }
    return false;
}

// Spam detection: repeated messages, all caps, link spam
function isSpammy(text) {
    if (text.length > 0 && text === text.toUpperCase() && text.length > 20) return true; // ALL CAPS
    if ((text.match(/https?:\/\//g) || []).length > 2) return true; // Too many links
    if (/(.)\1{6,}/.test(text)) return true; // Repeated characters (aaaaaaa)
    return false;
}

// Escape HTML
function esc(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }

// Time format
function timeAgo(ts) {
    if (!ts) return '';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    var now = Date.now();
    var diff = Math.floor((now - d.getTime()) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---- Render Chat Hub (tabbed: Global Chat | DMs) ----
window.renderChatHub = function(initialTab) {
    _chatTab = initialTab || 'global';

    var container = document.getElementById('forumContainer');
    if (!container) return;

    // Hide other views
    document.getElementById('home').classList.add('hidden');
    document.getElementById('hero').style.display = 'none';
    document.getElementById('msgs').style.display = 'none';
    container.style.display = 'block';

    var html = '<div style="max-width:600px;margin:0 auto;padding:0;height:calc(100vh - 120px);display:flex;flex-direction:column;">';

    // Tab bar
    html += '<div style="display:flex;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg-side);">';
    html += '<button id="chatTabGlobal" onclick="switchChatTab(\'global\')" style="flex:1;padding:14px 0;background:none;border:none;border-bottom:2px solid ' + (_chatTab === 'global' ? 'var(--accent)' : 'transparent') + ';color:' + (_chatTab === 'global' ? 'var(--accent)' : 'var(--text-muted)') + ';font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">🌍 Global Chat</button>';
    html += '<button id="chatTabDMs" onclick="switchChatTab(\'dms\')" style="flex:1;padding:14px 0;background:none;border:none;border-bottom:2px solid ' + (_chatTab === 'dms' ? 'var(--accent)' : 'transparent') + ';color:' + (_chatTab === 'dms' ? 'var(--accent)' : 'var(--text-muted)') + ';font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">✉️ Direct Messages</button>';
    html += '</div>';

    // Content area
    html += '<div id="chatContent" style="flex:1;overflow:hidden;display:flex;flex-direction:column;"></div>';
    html += '</div>';

    container.innerHTML = html;

    if (_chatTab === 'global') {
        renderGlobalChat();
    } else {
        renderDMsTab();
    }

    // Push history state
    history.pushState({ channel: 'chat' }, '', '#chat');

    // Update bottom nav
    if (typeof setFloatingElementsVisible === 'function') setFloatingElementsVisible(true);
};

window.switchChatTab = function(tab) {
    _chatTab = tab;

    // Update tab styles
    var gTab = document.getElementById('chatTabGlobal');
    var dTab = document.getElementById('chatTabDMs');
    if (gTab) {
        gTab.style.borderBottomColor = tab === 'global' ? 'var(--accent)' : 'transparent';
        gTab.style.color = tab === 'global' ? 'var(--accent)' : 'var(--text-muted)';
    }
    if (dTab) {
        dTab.style.borderBottomColor = tab === 'dms' ? 'var(--accent)' : 'transparent';
        dTab.style.color = tab === 'dms' ? 'var(--accent)' : 'var(--text-muted)';
    }

    // Unsubscribe from global chat listener when switching away
    if (tab !== 'global' && _chatUnsub) {
        _chatUnsub();
        _chatUnsub = null;
    }

    if (tab === 'global') {
        renderGlobalChat();
    } else {
        renderDMsTab();
    }
};

// ---- Global Chat ----
function renderGlobalChat() {
    var content = document.getElementById('chatContent');
    if (!content) return;

    var isSignedIn = typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous;
    var hasUsername = typeof currentUser !== 'undefined' && currentUser && currentUser.username;

    content.innerHTML =
        '<div id="globalChatMessages" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 16px;display:flex;flex-direction:column;gap:6px;">' +
            '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.75rem;">Loading chat...</div>' +
        '</div>' +
        '<div style="flex-shrink:0;padding:10px 16px;border-top:1px solid var(--border);background:var(--bg-side);">' +
            (hasUsername ?
                '<div style="display:flex;gap:8px;align-items:center;">' +
                    '<input type="text" id="globalChatInput" placeholder="Say something..." maxlength="' + MAX_MSG_LENGTH + '" style="flex:1;padding:12px 16px;background:var(--input-bg);border:1px solid var(--border);border-radius:20px;color:var(--text);font-size:0.88rem;font-family:inherit;outline:none;box-sizing:border-box;" onkeydown="if(event.key===\'Enter\')sendGlobalChat()">' +
                    '<button onclick="sendGlobalChat()" style="padding:10px 16px;background:var(--accent);color:#fff;border:none;border-radius:20px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;touch-action:manipulation;">Send</button>' +
                '</div>' +
                '<div style="text-align:right;font-size:0.6rem;color:var(--text-faint);margin-top:3px;"><span id="globalChatCharCount">0</span>/' + MAX_MSG_LENGTH + '</div>'
            :
                '<div style="text-align:center;padding:8px;color:var(--text-muted);font-size:0.8rem;">' +
                    (isSignedIn ? 'Set a username in <a href="#" onclick="if(typeof showSettings===\'function\')showSettings();return false;" style="color:var(--accent);">Settings</a> to chat' :
                    '<button onclick="if(typeof showUsernamePrompt===\'function\')showUsernamePrompt()" style="padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.85rem;">Sign up to join the chat</button>') +
                '</div>'
            ) +
        '</div>';

    // Character counter
    var input = document.getElementById('globalChatInput');
    if (input) {
        input.addEventListener('input', function() {
            var counter = document.getElementById('globalChatCharCount');
            if (counter) counter.textContent = this.value.length;
        });
    }

    // Start listening for messages
    startChatListener();
}

function startChatListener() {
    if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }

    if (typeof db === 'undefined' || !db) {
        var el = document.getElementById('globalChatMessages');
        if (el) el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.8rem;">Chat unavailable — reconnecting...</div>';
        return;
    }

    _chatUnsub = db.collection(CHAT_COLLECTION)
        .orderBy('ts', 'desc')
        .limit(MAX_MSGS_DISPLAY)
        .onSnapshot(function(snapshot) {
            var msgs = [];
            snapshot.forEach(function(doc) {
                var d = doc.data();
                d._id = doc.id;
                msgs.push(d);
            });
            msgs.reverse(); // oldest first
            renderChatMessages(msgs);
        }, function(err) {
            console.error('[CHAT] Listener error:', err);
            var el = document.getElementById('globalChatMessages');
            if (el) el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.8rem;">Chat connection lost. Refresh to retry.</div>';
        });
}

function renderChatMessages(msgs) {
    var el = document.getElementById('globalChatMessages');
    if (!el) return;

    var myUid = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : null;
    var isAdmin = myUid && typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.email === 'needcreations@gmail.com';
    var wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;

    if (msgs.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:40px 20px;"><div style="font-size:2rem;margin-bottom:8px;">🌍</div><div style="color:var(--text-muted);font-size:0.85rem;">No messages yet. Be the first to say something!</div></div>';
        return;
    }

    var html = '';
    var lastDate = '';
    for (var i = 0; i < msgs.length; i++) {
        var m = msgs[i];
        var isMe = m.uid === myUid;
        var dateStr = m.ts ? (m.ts.toDate ? m.ts.toDate() : new Date(m.ts)).toLocaleDateString() : '';

        if (dateStr !== lastDate) {
            html += '<div style="text-align:center;margin:8px 0;"><span style="background:var(--card-bg);border:1px solid var(--border);padding:3px 10px;border-radius:10px;font-size:0.65rem;color:var(--text-faint);">' + dateStr + '</span></div>';
            lastDate = dateStr;
        }

        var nameColor = isMe ? 'var(--accent)' : '#6366f1';
        var bubbleBg = isMe ? 'var(--accent-bg,rgba(247,147,26,0.08))' : 'var(--card-bg)';
        var bubbleBorder = isMe ? 'rgba(247,147,26,0.2)' : 'var(--border)';
        var align = isMe ? 'flex-end' : 'flex-start';

        html += '<div style="display:flex;flex-direction:column;align-items:' + align + ';max-width:85%;">';
        html += '<div style="background:' + bubbleBg + ';border:1px solid ' + bubbleBorder + ';border-radius:' + (isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px') + ';padding:8px 12px;position:relative;">';
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">';
        html += '<span style="font-weight:700;font-size:0.75rem;color:' + nameColor + ';cursor:pointer;" onclick="if(typeof showUserProfile===\'function\')showUserProfile(\'' + (m.uid || '') + '\')">' + esc(m.name || 'Anon') + '</span>';
        html += '<span style="font-size:0.6rem;color:var(--text-faint);">' + timeAgo(m.ts) + '</span>';
        if (isAdmin && !isMe) {
            html += '<span onclick="deleteChatMsg(\'' + m._id + '\')" style="cursor:pointer;font-size:0.6rem;color:#ef4444;margin-left:auto;" title="Delete">🗑️</span>';
        }
        html += '</div>';
        html += '<div style="color:var(--text);font-size:0.85rem;line-height:1.5;word-break:break-word;">' + linkify(esc(m.text || '')) + '</div>';
        html += '</div></div>';
    }

    el.innerHTML = html;

    // Auto-scroll to bottom if user was near bottom
    if (wasAtBottom) {
        el.scrollTop = el.scrollHeight;
    }
}

// Convert URLs to links
function linkify(text) {
    return text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:var(--accent);word-break:break-all;">$1</a>');
}

// ---- Send Message ----
window.sendGlobalChat = function() {
    var input = document.getElementById('globalChatInput');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;

    // Validation
    if (text.length > MAX_MSG_LENGTH) {
        if (typeof showToast === 'function') showToast('Message too long (max ' + MAX_MSG_LENGTH + ' chars)');
        return;
    }

    // Rate limit
    var now = Date.now();
    if (now - _lastSendTime < RATE_LIMIT_MS) {
        if (typeof showToast === 'function') showToast('Slow down! Wait a moment before sending again.');
        return;
    }

    // Profanity check
    if (containsProfanity(text)) {
        if (typeof showToast === 'function') showToast('🚫 Message contains inappropriate language.');
        return;
    }

    // Spam check
    if (isSpammy(text)) {
        if (typeof showToast === 'function') showToast('🚫 Message flagged as spam. Please write normally.');
        return;
    }

    // Auth check
    if (typeof auth === 'undefined' || !auth || !auth.currentUser) {
        if (typeof showToast === 'function') showToast('Sign in to chat!');
        return;
    }

    var user = auth.currentUser;
    var username = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Anon';

    if (!username || username === 'Anon') {
        if (typeof showToast === 'function') showToast('Set a username first in Settings!');
        return;
    }

    // Check if user is muted (admin can mute via Firestore)
    var uid = user.uid;

    _lastSendTime = now;
    input.value = '';
    var counter = document.getElementById('globalChatCharCount');
    if (counter) counter.textContent = '0';

    // Write to Firestore
    db.collection(CHAT_COLLECTION).add({
        uid: uid,
        name: username,
        text: text,
        ts: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function(err) {
        console.error('[CHAT] Send error:', err);
        if (typeof showToast === 'function') showToast('Failed to send: ' + (err.message || 'Unknown error'));
    });

    // Award points for first chat message of the day
    var chatDay = 'btc_chat_day_' + new Date().toDateString();
    if (!localStorage.getItem(chatDay)) {
        localStorage.setItem(chatDay, '1');
        if (typeof awardPoints === 'function') awardPoints(5, '💬 Global Chat');
    }

    // Check if message is a question for Nacho — use KB finder to see if we know the answer
    var isNachoQuestion = false;
    if (text.includes('?') && typeof findAnswer === 'function') {
        var match = findAnswer(text);
        if (match) {
            isNachoQuestion = true;
        }
    }

    // Let Nacho answer in the global chat (async, non-blocking)
    if (isNachoQuestion && typeof nachoUnifiedAnswer === 'function') {
        nachoUnifiedAnswer(text, function(result) {
            result = result || {};
            var answer = (result.answer || "I can help with Bitcoin questions! Tap my bubble for a full chat. 🦌").replace(/<[^>]+>/g, '');
            // Wait slightly to avoid spamming immediate replies
            setTimeout(function() {
                var inputEl = document.getElementById('globalChatInput');
                // Don't answer if user is typing (to avoid duplicated questions)
                if (inputEl && inputEl.value.trim().length > 0) return;
                db.collection(CHAT_COLLECTION).add({
                    uid: 'nacho-bot',
                    name: '🦌 Nacho',
                    text: answer.substring(0, MAX_MSG_LENGTH),
                    ts: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(function(e) { console.error('[CHAT] Nacho reply failed:', e); });
            }, 2000 + Math.random() * 2000); // 2-4s delay feels natural
        });
    }
};

// Admin: delete a chat message
window.deleteChatMsg = function(msgId) {
    if (!confirm('Delete this message?')) return;
    db.collection(CHAT_COLLECTION).doc(msgId).delete().then(function() {
        if (typeof showToast === 'function') showToast('🗑️ Message deleted');
    }).catch(function() {
        if (typeof showToast === 'function') showToast('Failed to delete');
    });
};

// ---- DMs Tab (wraps existing showInbox) ----
function renderDMsTab() {
    var content = document.getElementById('chatContent');
    if (!content) return;

    // Create a container for the existing DM system
    content.innerHTML = '<div id="dmTabContainer" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;"></div>';

    // Use existing inbox renderer if available
    if (typeof window._renderInboxInto === 'function') {
        window._renderInboxInto(document.getElementById('dmTabContainer'));
    } else if (typeof showInbox === 'function') {
        // Fallback: render the existing inbox into forumContainer, then move it
        var fc = document.getElementById('forumContainer');
        var savedHtml = fc.innerHTML;
        showInbox();
        var inboxContent = fc.innerHTML;
        fc.innerHTML = savedHtml;
        // Re-render the chat hub with DM content injected
        var dmContainer = document.getElementById('dmTabContainer');
        if (dmContainer) dmContainer.innerHTML = inboxContent;
    } else {
        content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:0.85rem;">DMs not available yet. Sign in to enable messaging.</div>';
    }
}

// ---- Override showInbox to route through chat hub ----
var _origShowInbox = window.showInbox;
window.showInbox = function() {
    renderChatHub('dms');
};
// Keep original accessible
window._showInboxOriginal = _origShowInbox;

// ---- Cleanup on navigation ----
var _origGoHome = window.goHome;
if (_origGoHome) {
    window.goHome = function() {
        if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }
        return _origGoHome.apply(this, arguments);
    };
}

// ---- Hash route ----
// #chat opens global chat, #dms opens DMs tab
var _origGo = window.go;
if (_origGo) {
    window.go = function(id) {
        if (id === 'chat') {
            renderChatHub('global');
            return;
        }
        if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }
        return _origGo.apply(this, arguments);
    };
}

console.log('[CHAT] Global chat module loaded');
}();
