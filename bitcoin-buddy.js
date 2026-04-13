// © 2024-2026 603BTC LLC. All rights reserved.
// bitcoin-buddy.js — Bitcoin Buddy Matching System
// Connect users by experience level for 1-on-1 Bitcoin conversations

(function() {
'use strict';

var COLLECTION = 'buddy_pool';
var MATCH_COLLECTION = 'buddy_matches';

window.showBuddyFinder = function() {
    var auth = typeof firebase !== 'undefined' ? firebase.auth() : null;
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
        else if (typeof showToast === 'function') showToast('🔒 Sign in to find a Bitcoin Buddy');
        return;
    }

    var uid = auth.currentUser.uid;
    var _db = firebase.firestore();

    // Check for existing match first
    _db.collection(MATCH_COLLECTION).where('user1.uid', '==', uid).limit(1).get().then(function(snap1) {
        if (!snap1.empty) { _showExistingMatch(snap1.docs[0], uid); return; }
        _db.collection(MATCH_COLLECTION).where('user2.uid', '==', uid).limit(1).get().then(function(snap2) {
            if (!snap2.empty) { _showExistingMatch(snap2.docs[0], uid); return; }
            // Also check if user is already in the pool waiting
            _db.collection(COLLECTION).where('uid', '==', uid).limit(1).get().then(function(poolSnap) {
                if (!poolSnap.empty) { _showWaitingInPool(poolSnap.docs[0]); return; }
                _showFreshBuddyForm();
            }).catch(function() { _showFreshBuddyForm(); });
        }).catch(function() { _showFreshBuddyForm(); });
    }).catch(function() { _showFreshBuddyForm(); });
};

function _showExistingMatch(matchDoc, myUid) {
    var m = matchDoc.data();
    var isUser1 = m.user1.uid === myUid;
    var me = isUser1 ? m.user1 : m.user2;
    var buddy = isUser1 ? m.user2 : m.user1;
    var matchedAt = m.matchedAt ? (m.matchedAt.toDate ? m.matchedAt.toDate() : new Date(m.matchedAt)) : null;
    var matchedStr = matchedAt ? matchedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'recently';

    var overlay = document.createElement('div');
    overlay.id = 'buddyFinderOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var html = '<div style="background:var(--bg-side,#1a1a2e);border:1px solid var(--accent);border-radius:20px;max-width:440px;width:100%;padding:28px;animation:fadeSlideIn 0.3s;">';
    html += '<div style="text-align:center;margin-bottom:20px;">' +
        '<div style="font-size:3rem;margin-bottom:8px;">🤝🦌</div>' +
        '<h2 style="color:var(--heading);font-size:1.2rem;margin:0 0 4px;">You Have a Buddy!</h2>' +
        '<p style="color:var(--text-muted);font-size:0.8rem;">Matched ' + matchedStr + '</p>' +
    '</div>';

    html += '<div style="padding:16px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:14px;margin-bottom:16px;">';
    html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">';
    html += '<div style="width:48px;height:48px;border-radius:50%;background:rgba(34,197,94,0.15);border:2px solid rgba(34,197,94,0.3);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">' + (buddy.username ? buddy.username.charAt(0).toUpperCase() : '?') + '</div>';
    html += '<div><div style="font-weight:800;color:var(--heading);font-size:1rem;">@' + (buddy.username || 'User') + '</div>';
    html += '<div style="font-size:0.75rem;color:var(--text-muted);">' + (buddy.goal === 'teach' ? '🎓 Teacher' : '📖 Learner') + ' · ' + (buddy.level || 'beginner').charAt(0).toUpperCase() + (buddy.level || 'beginner').slice(1) + '</div></div>';
    html += '</div>';
    if (buddy.intro) html += '<div style="font-size:0.8rem;color:var(--text);font-style:italic;padding:8px 0;border-top:1px solid rgba(34,197,94,0.15);">"' + buddy.intro + '"</div>';
    html += '</div>';

    html += '<div style="font-size:0.75rem;color:var(--text-muted);text-align:center;margin-bottom:16px;">Your role: ' + (me.goal === 'teach' ? '🎓 Teacher' : '📖 Learner') + '</div>';

    // Action buttons
    html += '<button onclick="document.getElementById(\'buddyFinderOverlay\').remove();if(typeof openDM===\'function\')openDM(\'' + buddy.uid + '\',\'' + (buddy.username || 'User').replace(/[\\'"]/g, '') + '\')" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-weight:800;font-size:0.95rem;cursor:pointer;font-family:inherit;margin-bottom:8px;">💬 Open Conversation</button>';
    html += '<button onclick="_rerollBuddy(\'' + matchDoc.id + '\')" id="rerollBtn" style="width:100%;padding:12px;background:none;border:1px solid rgba(239,68,68,0.3);border-radius:12px;color:#ef4444;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:8px;">🔄 Find a New Buddy</button>';
    html += '<div style="text-align:center;font-size:0.65rem;color:var(--text-faint);margin-bottom:12px;">This will unmatch you and put you back in the pool</div>';
    html += '<button onclick="document.getElementById(\'buddyFinderOverlay\').remove()" style="width:100%;padding:8px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-faint);font-size:0.8rem;cursor:pointer;font-family:inherit;">Close</button>';
    html += '</div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);
}

window._rerollBuddy = async function(matchDocId) {
    var btn = document.getElementById('rerollBtn');
    if (btn) { btn.disabled = true; btn.textContent = '🔄 Unmatching...'; }

    try {
        var _db = firebase.firestore();
        var auth = firebase.auth();
        var uid = auth.currentUser.uid;
        var username = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Bitcoiner';

        // Get match data before deleting (so we know our preferences)
        var matchDoc = await _db.collection(MATCH_COLLECTION).doc(matchDocId).get();
        var matchData = matchDoc.exists ? matchDoc.data() : null;
        var me = matchData ? (matchData.user1.uid === uid ? matchData.user1 : matchData.user2) : null;
        var level = me ? me.level : 'beginner';
        var goal = me ? me.goal : 'learn';
        var intro = me ? (me.intro || '') : '';

        // Delete the match
        await _db.collection(MATCH_COLLECTION).doc(matchDocId).delete();

        // Close overlay and show fresh form with previous preferences
        document.getElementById('buddyFinderOverlay').remove();

        if (typeof showToast === 'function') showToast('🔄 Unmatched! Finding a new buddy...');

        // Re-open the finder with pre-filled preferences
        setTimeout(function() {
            _showFreshBuddyForm();
            // Pre-select previous choices after render
            setTimeout(function() {
                if (level) selectBuddyLevel(level);
                if (goal) selectBuddyGoal(goal);
                var introEl = document.getElementById('buddyIntro');
                if (introEl && intro) introEl.value = intro;
            }, 200);
        }, 300);
    } catch(e) {
        console.error('[BUDDY] Reroll failed:', e);
        if (btn) { btn.disabled = false; btn.textContent = '🔄 Find a New Buddy'; }
        if (typeof showToast === 'function') showToast('⚠️ Something went wrong. Try again.');
    }
};

function _showWaitingInPool(poolDoc) {
    var d = poolDoc.data();
    var overlay = document.createElement('div');
    overlay.id = 'buddyFinderOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var joinedStr = d.joinedAt ? (d.joinedAt.toDate ? d.joinedAt.toDate() : new Date(d.joinedAt)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'recently';

    var html = '<div style="background:var(--bg-side,#1a1a2e);border:1px solid var(--accent);border-radius:20px;max-width:440px;width:100%;padding:28px;animation:fadeSlideIn 0.3s;">';
    html += '<div style="text-align:center;margin-bottom:20px;">' +
        '<div style="font-size:3rem;margin-bottom:8px;">⏳🦌</div>' +
        '<h2 style="color:var(--heading);font-size:1.2rem;margin:0 0 4px;">Waiting for a Match</h2>' +
        '<p style="color:var(--text-muted);font-size:0.8rem;">In the pool since ' + joinedStr + '</p>' +
    '</div>';

    html += '<div style="padding:14px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:12px;margin-bottom:16px;text-align:center;">';
    html += '<div style="font-size:0.75rem;color:var(--accent);font-weight:700;">Your Profile</div>';
    html += '<div style="font-size:0.85rem;color:var(--text);margin-top:4px;">📊 ' + (d.level || 'beginner').charAt(0).toUpperCase() + (d.level || 'beginner').slice(1) + ' · ' + (d.goal === 'learn' ? '📖 Looking to learn' : '🎓 Looking to teach') + '</div>';
    if (d.intro) html += '<div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;font-style:italic;">"' + d.intro + '"</div>';
    html += '</div>';

    html += '<div style="font-size:0.8rem;color:var(--text-muted);text-align:center;margin-bottom:16px;line-height:1.5;">We\'ll pair you with a ' + (d.goal === 'learn' ? 'teacher' : 'learner') + ' when one joins.<br>You\'ll get a DM when matched! 🧡</div>';

    html += '<button onclick="_leavePool(\'' + poolDoc.id + '\')" style="width:100%;padding:12px;background:none;border:1px solid rgba(239,68,68,0.3);border-radius:12px;color:#ef4444;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:8px;">🚪 Leave Pool</button>';
    html += '<button onclick="document.getElementById(\'buddyFinderOverlay\').remove()" style="width:100%;padding:8px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-faint);font-size:0.8rem;cursor:pointer;font-family:inherit;">Close</button>';
    html += '</div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);
}

window._leavePool = async function(poolDocId) {
    try {
        await firebase.firestore().collection(COLLECTION).doc(poolDocId).delete();
        document.getElementById('buddyFinderOverlay').remove();
        if (typeof showToast === 'function') showToast('👋 Left the buddy pool');
    } catch(e) {
        if (typeof showToast === 'function') showToast('⚠️ Something went wrong');
    }
};

function _showFreshBuddyForm() {
    var overlay = document.createElement('div');
    overlay.id = 'buddyFinderOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var username = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Bitcoiner';

    var html = '<div style="background:var(--bg-side,#1a1a2e);border:1px solid var(--accent);border-radius:20px;max-width:440px;width:100%;padding:28px;animation:fadeSlideIn 0.3s;">';

    html += '<div style="text-align:center;margin-bottom:20px;">' +
        '<div style="font-size:3rem;margin-bottom:8px;">🤝🦌</div>' +
        '<h2 style="color:var(--heading);font-size:1.2rem;margin:0 0 4px;">Find a Bitcoin Buddy</h2>' +
        '<p style="color:var(--text-muted);font-size:0.8rem;">Get matched with another Bitcoiner for 1-on-1 conversation</p>' +
    '</div>';

    // Experience level
    html += '<div style="margin-bottom:16px;">' +
        '<label style="display:block;font-size:0.7rem;color:var(--text-faint);font-weight:700;margin-bottom:8px;text-transform:uppercase;">Your Experience Level</label>' +
        '<div style="display:flex;gap:8px;">' +
            _buddyBtn('beginner', '🌱', 'Beginner', 'New to Bitcoin') +
            _buddyBtn('intermediate', '📚', 'Intermediate', 'Know the basics') +
            _buddyBtn('advanced', '🧠', 'Advanced', 'Deep knowledge') +
        '</div></div>';

    // What they want
    html += '<div style="margin-bottom:16px;">' +
        '<label style="display:block;font-size:0.7rem;color:var(--text-faint);font-weight:700;margin-bottom:8px;text-transform:uppercase;">I Want To</label>' +
        '<div style="display:flex;gap:8px;">' +
            _buddyGoalBtn('learn', '📖', 'Learn', 'Find a mentor') +
            _buddyGoalBtn('teach', '🎓', 'Teach', 'Help someone') +
        '</div></div>';

    // Optional intro
    html += '<div style="margin-bottom:16px;">' +
        '<label style="display:block;font-size:0.7rem;color:var(--text-faint);font-weight:700;margin-bottom:4px;text-transform:uppercase;">Quick Intro (optional)</label>' +
        '<textarea id="buddyIntro" placeholder="What are you interested in learning/teaching about Bitcoin?" rows="2" maxlength="200" style="width:100%;padding:10px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:10px;color:var(--text);outline:none;resize:none;font-family:inherit;font-size:0.85rem;box-sizing:border-box;"></textarea>' +
    '</div>';

    html += '<button onclick="submitBuddyRequest()" id="buddySubmitBtn" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-weight:800;font-size:0.95rem;cursor:pointer;font-family:inherit;">🤝 Find My Buddy</button>';
    html += '<button onclick="document.getElementById(\'buddyFinderOverlay\').remove()" style="width:100%;margin-top:8px;padding:8px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-faint);font-size:0.8rem;cursor:pointer;font-family:inherit;">Cancel</button>';

    html += '</div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    // Default selections
    window._buddyLevel = 'beginner';
    window._buddyGoal = 'learn';
    setTimeout(function() {
        var lvl = document.querySelector('[data-buddy-level="beginner"]');
        var goal = document.querySelector('[data-buddy-goal="learn"]');
        if (lvl) lvl.style.borderColor = 'var(--accent)';
        if (goal) goal.style.borderColor = 'var(--accent)';
    }, 100);
};

function _buddyBtn(id, emoji, label, sub) {
    return '<button data-buddy-level="' + id + '" onclick="selectBuddyLevel(\'' + id + '\')" style="flex:1;padding:10px 8px;background:var(--card-bg);border:2px solid var(--border);border-radius:10px;cursor:pointer;font-family:inherit;text-align:center;transition:0.2s;touch-action:manipulation;">' +
        '<div style="font-size:1.2rem;">' + emoji + '</div>' +
        '<div style="color:var(--text);font-size:0.75rem;font-weight:700;">' + label + '</div>' +
        '<div style="color:var(--text-faint);font-size:0.6rem;">' + sub + '</div></button>';
}

function _buddyGoalBtn(id, emoji, label, sub) {
    return '<button data-buddy-goal="' + id + '" onclick="selectBuddyGoal(\'' + id + '\')" style="flex:1;padding:10px 8px;background:var(--card-bg);border:2px solid var(--border);border-radius:10px;cursor:pointer;font-family:inherit;text-align:center;transition:0.2s;touch-action:manipulation;">' +
        '<div style="font-size:1.2rem;">' + emoji + '</div>' +
        '<div style="color:var(--text);font-size:0.75rem;font-weight:700;">' + label + '</div>' +
        '<div style="color:var(--text-faint);font-size:0.6rem;">' + sub + '</div></button>';
}

window.selectBuddyLevel = function(lvl) {
    window._buddyLevel = lvl;
    document.querySelectorAll('[data-buddy-level]').forEach(function(b) {
        b.style.borderColor = b.getAttribute('data-buddy-level') === lvl ? 'var(--accent)' : 'var(--border)';
    });
};

window.selectBuddyGoal = function(goal) {
    window._buddyGoal = goal;
    document.querySelectorAll('[data-buddy-goal]').forEach(function(b) {
        b.style.borderColor = b.getAttribute('data-buddy-goal') === goal ? 'var(--accent)' : 'var(--border)';
    });
};

window.submitBuddyRequest = async function() {
    var btn = document.getElementById('buddySubmitBtn');
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) {
        if (typeof showToast === 'function') showToast('⚠️ Still loading. Please try again in a moment.');
        return;
    }
    var _auth = firebase.auth();
    var _db = firebase.firestore();
    if (!_auth.currentUser) {
        if (typeof showToast === 'function') showToast('🔒 Please sign in first.');
        return;
    }

    btn.disabled = true;
    btn.textContent = '🔍 Searching for a match...';

    var uid = _auth.currentUser.uid;
    var username = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Bitcoiner';
    var level = window._buddyLevel || 'beginner';
    var goal = window._buddyGoal || 'learn';
    var intro = (document.getElementById('buddyIntro') ? document.getElementById('buddyIntro').value.trim() : '').substring(0, 200);
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';

    try {
        // Remove any existing pool entry (simple get-all then filter client-side)
        var allPool = await _db.collection(COLLECTION).limit(50).get();
        allPool.forEach(function(doc) {
            if (doc.data().uid === uid) doc.ref.delete();
        });

        // Try to find a complementary match (learner↔teacher only)
        var match = null;
        var complementaryGoal = goal === 'learn' ? 'teach' : 'learn';

        var candidates = [];
        allPool.forEach(function(doc) {
            var d = doc.data();
            if (d.uid !== uid && d.goal === complementaryGoal) candidates.push({ id: doc.id, data: d });
        });
        if (candidates.length > 0) match = candidates[0];

        if (match) {
            // Match found! Remove both from pool and create match record
            await _db.collection(COLLECTION).doc(match.id).delete();

            // 🔒 SECURITY (L-NEW-10): Use deterministic ID for match document
            var convoId = _getBuddyConvoId(uid, match.data.uid);
            await _db.collection(MATCH_COLLECTION).doc(convoId).set({
                user1: { uid: uid, username: username, level: level, goal: goal, intro: intro },
                user2: { uid: match.data.uid, username: match.data.username, level: match.data.level, goal: match.data.goal, intro: match.data.intro || '' },
                matchedAt: firebase.firestore.FieldValue.serverTimestamp(),
                tz1: tz,
                tz2: match.data.tz || 'Unknown'
            });

            // Open DM with the matched user
            document.getElementById('buddyFinderOverlay').remove();

            if (typeof showToast === 'function') showToast('🤝 Bitcoin Buddy found! Opening conversation...');
            if (typeof awardPoints === 'function') awardPoints(20, '🤝 Bitcoin Buddy match!');

            // Build Nacho's welcome message for the DM
            var learnerName = goal === 'learn' ? username : match.data.username;
            var teacherName = goal === 'teach' ? username : match.data.username;
            var learnerLevel = goal === 'learn' ? level : match.data.level;
            var learnerIntro = goal === 'learn' ? intro : (match.data.intro || '');
            var teacherIntro = goal === 'teach' ? intro : (match.data.intro || '');

            var icebreakers = [
                'What first got you interested in Bitcoin?',
                'What\'s the most mind-blowing thing you\'ve learned about Bitcoin so far?',
                'If you could explain Bitcoin to your parents in one sentence, what would you say?',
                'What Bitcoin topic are you most curious about right now?',
                'Have you ever orange-pilled someone? How did it go?'
            ];
            var icebreaker = icebreakers[Math.floor(Math.random() * icebreakers.length)];

            var nachoWelcome = '🎉 It\'s a match! Welcome to your Bitcoin Buddy conversation!\n\n' +
                '🎓 Teacher: @' + teacherName + '\n' +
                '📖 Learner: @' + learnerName + ' (' + learnerLevel + ')' +
                (learnerIntro ? '\n\n' + learnerName + ' wants to learn about: "' + learnerIntro + '"' : '') +
                (teacherIntro ? '\n' + teacherName + ' says: "' + teacherIntro + '"' : '') +
                '\n\nI\'m Nacho 🦌 — your Bitcoin education deer! Here\'s how this works:' +
                '\n\n• Ask ANY Bitcoin question and I\'ll answer it right away' +
                '\n• @' + teacherName + ' can jump in anytime to add real-world context, tips, and personal experience on top of my answers' +
                '\n• Between Nacho + a real teacher, you\'ve got the best of both worlds! 🧡' +
                '\n\n🧊 Icebreaker to get started: "' + icebreaker + '"';

            // Open DM and send Nacho's welcome message
            var convoId = _getBuddyConvoId(uid, match.data.uid);
            setTimeout(function() {
                _sendNachoBuddyMessage(convoId, uid, match.data.uid, username, match.data.username, nachoWelcome);
                setTimeout(function() {
                    if (typeof openDM === 'function') {
                        openDM(match.data.uid, match.data.username);
                    }
                }, 500);
            }, 300);

        } else {
            // No match available — add to pool
            await _db.collection(COLLECTION).add({
                uid: uid,
                username: username,
                level: level,
                goal: goal,
                intro: intro,
                tz: tz,
                joinedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Show confirmation in the overlay itself
            var overlay = document.getElementById('buddyFinderOverlay');
            if (overlay) {
                var inner = overlay.querySelector('div > div') || overlay.firstElementChild;
                if (inner) {
                    inner.innerHTML =
                        '<div style="text-align:center;padding:20px;">' +
                            '<div style="font-size:3rem;margin-bottom:16px;">✅</div>' +
                            '<h2 style="color:var(--heading);font-size:1.2rem;margin:0 0 8px;">You\'re in the Buddy Pool!</h2>' +
                            '<p style="color:var(--text-muted);font-size:0.85rem;line-height:1.6;margin:0 0 16px;">' +
                                (goal === 'learn'
                                    ? 'We\'ll pair you with a teacher when one joins. You\'ll get a DM notification when matched!'
                                    : 'We\'ll pair you with a learner when one joins. You\'ll get a DM notification when matched!') +
                            '</p>' +
                            '<div style="padding:12px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:12px;margin-bottom:16px;">' +
                                '<div style="font-size:0.75rem;color:#22c55e;font-weight:700;">Your Profile</div>' +
                                '<div style="font-size:0.8rem;color:var(--text);margin-top:4px;">📊 ' + level.charAt(0).toUpperCase() + level.slice(1) + ' · ' + (goal === 'learn' ? '📖 Looking to learn' : '🎓 Looking to teach') + '</div>' +
                            '</div>' +
                            '<button onclick="document.getElementById(\'buddyFinderOverlay\').remove()" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-weight:800;font-size:0.95rem;cursor:pointer;font-family:inherit;">👍 Got it!</button>' +
                        '</div>';
                }
            }
        }
    } catch(e) {
        console.error('[BUDDY]', e);
        btn.disabled = false;
        btn.textContent = '🤝 Find My Buddy';
        if (typeof showToast === 'function') showToast('⚠️ Something went wrong. Please try again.');
    }
};

// Inject Buddy button into Global Chat header
function injectBuddyButton() {
    var chatHub = document.querySelector('#globalChatMessages');
    if (!chatHub) return;
    var parent = chatHub.parentElement;
    if (!parent || document.getElementById('buddyBtn')) return;

    // Find the chat header area
    var header = parent.querySelector('div[style*="border-bottom"]') || parent.firstElementChild;
    if (!header) return;

    var btn = document.createElement('button');
    btn.id = 'buddyBtn';
    btn.style.cssText = 'padding:5px 10px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:8px;color:#22c55e;font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;touch-action:manipulation;transition:0.2s;';
    btn.textContent = '🤝 Find a Buddy';
    btn.onclick = function() { showBuddyFinder(); };

    header.appendChild(btn);
}

// Also add to settings/profile
var _origRenderChat2 = window.renderChatHub;
if (_origRenderChat2) {
    window.renderChatHub = function(tab) {
        _origRenderChat2(tab);
        setTimeout(injectBuddyButton, 1000);
    };
}

// MutationObserver for dynamic injection
if (typeof MutationObserver !== 'undefined') {
    var buddyObs = new MutationObserver(function() {
        if (document.getElementById('globalChatMessages') && !document.getElementById('buddyBtn')) {
            injectBuddyButton();
        }
    });
    if (document.body) buddyObs.observe(document.body, { childList: true, subtree: true });
}

// ---- Nacho buddy pool alerts ----
// Check buddy pool periodically and have Nacho nudge users
// Triggers: 2-3 min after session start, max once every 3 sessions
var BUDDY_ALERT_KEY = 'btc_buddy_alert_session';
var BUDDY_ALERT_COUNT_KEY = 'btc_buddy_alert_count';

function checkBuddyPoolAlert() {
    // Don't alert if user isn't signed in
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.auth().currentUser) return;
    var uid = firebase.auth().currentUser.uid;

    // Rate limit: only show every 3 sessions
    var count = parseInt(localStorage.getItem(BUDDY_ALERT_COUNT_KEY) || '0');
    if (sessionStorage.getItem(BUDDY_ALERT_KEY)) return; // already shown this session
    if (count % 3 !== 0) {
        // Increment and skip
        sessionStorage.setItem(BUDDY_ALERT_KEY, '1');
        localStorage.setItem(BUDDY_ALERT_COUNT_KEY, (count + 1).toString());
        return;
    }

    // Check if user is already in the pool
    var _db = firebase.firestore();
    _db.collection(COLLECTION).limit(50).get().then(function(snap) {
        var waiting = [];
        var userInPool = false;
        snap.forEach(function(doc) {
            var d = doc.data();
            if (d.uid === uid) { userInPool = true; return; }
            waiting.push(d);
        });

        // Don't alert if user is already in pool or nobody is waiting
        if (userInPool || waiting.length === 0) {
            sessionStorage.setItem(BUDDY_ALERT_KEY, '1');
            localStorage.setItem(BUDDY_ALERT_COUNT_KEY, (count + 1).toString());
            return;
        }

        // Build the alert message
        var learners = waiting.filter(function(d) { return d.goal === 'learn'; }).length;
        var teachers = waiting.filter(function(d) { return d.goal === 'teach'; }).length;
        var msg = '';
        if (teachers > 0 && learners > 0) {
            msg = '🤝 ' + teachers + ' experienced ' + (teachers === 1 ? 'teacher' : 'teachers') + ' and ' + learners + ' ' + (learners === 1 ? 'learner' : 'learners') + ' waiting in the Buddy Pool!';
        } else if (teachers > 0) {
            msg = '🎓 ' + teachers + ' experienced ' + (teachers === 1 ? 'teacher is' : 'teachers are') + ' waiting to help in the Buddy Pool!';
        } else {
            msg = '🌱 ' + learners + ' new ' + (learners === 1 ? 'learner is' : 'learners are') + ' looking for a Bitcoin mentor in the Buddy Pool!';
        }
        msg += '<br><br><span onclick="if(typeof renderChatHub===\'function\'){renderChatHub(\'global\');}if(typeof showToast===\'function\')showToast(\'Look for the 🤝 Find a Buddy button above the chat!\')" style="color:#f7931a;font-weight:700;cursor:pointer;text-decoration:underline;">Open Global Chat to find a buddy →</span>';

        // Show via Nacho bubble
        var bubble = document.getElementById('nacho-bubble');
        var textEl = document.getElementById('nacho-text');
        if (bubble && textEl && typeof forceShowBubble !== 'undefined') {
            // Use interactive bubble so it stays visible
            textEl.innerHTML = msg;
            bubble.setAttribute('data-interactive', 'true');
            bubble.classList.add('show');
            if (typeof clearNachoBubbleTimeout === 'function') clearNachoBubbleTimeout();
            if (typeof setPose === 'function') setPose('happy');
            // Auto-hide after 15s
            setTimeout(function() {
                if (bubble.getAttribute('data-interactive') === 'true') {
                    bubble.removeAttribute('data-interactive');
                    bubble.classList.remove('show');
                }
            }, 15000);
        } else if (typeof showToast === 'function') {
            // Fallback to toast
            showToast(msg.replace(/<br>/g, ' ').replace(/<[^>]+>/g, ''), 8000);
        }

        sessionStorage.setItem(BUDDY_ALERT_KEY, '1');
        localStorage.setItem(BUDDY_ALERT_COUNT_KEY, (count + 1).toString());
    }).catch(function() {});
}

// Trigger 2.5 minutes into the session
setTimeout(checkBuddyPoolAlert, 150000);

// ---- Nacho in Buddy DMs ----

// Generate deterministic conversation ID (must match messaging.js logic)
function _getBuddyConvoId(uid1, uid2) {
    return uid1 < uid2 ? uid1 + '_' + uid2 : uid2 + '_' + uid1;
}

// Send a Nacho system message into a DM conversation
// Uses current user's UID as senderUid (Firestore rules require it) but marks as Nacho
function _sendNachoBuddyMessage(convoId, uid1, uid2, name1, name2, text) {
    if (typeof firebase === 'undefined' || !firebase.firestore) return;
    var auth = firebase.auth();
    if (!auth || !auth.currentUser) return;
    var _db = firebase.firestore();
    var convoRef = _db.collection('dm_conversations').doc(convoId);
    var myUid = auth.currentUser.uid;

    var msgData = {
        senderUid: myUid,
        senderName: '🦌 Nacho',
        text: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        isNachoAuto: true
    };

    // Ensure conversation doc exists with buddy flag
    var convoData = {
        participants: [uid1, uid2],
        lastMessage: text.substring(0, 100),
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        lastSenderUid: myUid,
        isBuddyMatch: true
    };
    convoData.participantNames = {};
    convoData.participantNames[uid1] = name1;
    convoData.participantNames[uid2] = name2;

    convoRef.set(convoData, { merge: true }).then(function() {
        return convoRef.collection('messages').add(msgData);
    }).then(function() {
        console.log('[BUDDY] Nacho welcome message sent to convo:', convoId);
    }).catch(function(e) {
        console.error('[BUDDY] Failed to send Nacho message:', e);
    });
}

// Listen for new messages in buddy DMs and have Nacho auto-answer questions
// This hooks into the DM message listener in messaging.js
var _buddyNachoDebounce = {};
var _origSendDM = window.sendDM;
if (_origSendDM) {
    window.sendDM = function(convoId, recipientUid, recipientName) {
        // Call original sendDM first
        _origSendDM.apply(this, arguments);

        // After sending, check if this is a buddy conversation and the message has a question
        setTimeout(function() {
            _checkBuddyNachoReply(convoId, recipientUid, recipientName);
        }, 1000);
    };
}

function _checkBuddyNachoReply(convoId, recipientUid, recipientName) {
    if (typeof firebase === 'undefined' || !firebase.firestore) return;
    var _db = firebase.firestore();

    // Check if this is a buddy conversation
    _db.collection('dm_conversations').doc(convoId).get().then(function(doc) {
        if (!doc.exists || !doc.data().isBuddyMatch) return;

        // Get the latest message
        return _db.collection('dm_conversations').doc(convoId).collection('messages')
            .orderBy('createdAt', 'desc').limit(1).get().then(function(snap) {
                if (snap.empty) return;
                var lastMsg = snap.docs[0].data();

                // Don't reply to Nacho's own messages
                if (lastMsg.senderUid === 'nacho-bot' || lastMsg.isNachoAuto) return;

                var text = (lastMsg.text || '').trim();
                // Answer if: has a question mark, OR starts with "nacho"/"hey nacho"
                var isQuestion = text.includes('?');
                var isNachoCall = /^(hey\s+)?nacho[,:\s]/i.test(text) || /\bnacho\b/i.test(text);

                if (!isQuestion && !isNachoCall) return;

                // Debounce: don't reply to same convo within 5 seconds
                if (_buddyNachoDebounce[convoId] && Date.now() - _buddyNachoDebounce[convoId] < 5000) return;
                _buddyNachoDebounce[convoId] = Date.now();

                // Strip "nacho" prefix for cleaner question parsing
                var cleanQ = text.replace(/^(hey\s+)?nacho[,:\s]*/i, '').trim();
                if (!cleanQ) cleanQ = text;

                if (typeof nachoUnifiedAnswer !== 'function') return;

                nachoUnifiedAnswer(cleanQ, function(result) {
                    if (!result || !result.answer) return;
                    if (result.type === 'fallback') return; // Don't send generic fallbacks

                    var answer = '🦌 ' + result.answer;

                    // Trim to reasonable length for DM
                    if (answer.length > 800) answer = answer.substring(0, 797) + '...';

                    // Get current user info for convo update
                    var auth = firebase.auth();
                    if (!auth.currentUser) return;
                    var myUid = auth.currentUser.uid;
                    var participants = doc.data().participants || [];
                    var otherUid = participants.find(function(p) { return p !== myUid; }) || recipientUid;

                    var nachoMsg = {
                        senderUid: auth.currentUser.uid,
                        senderName: '🦌 Nacho',
                        text: answer,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        isNachoAuto: true
                    };

                    // Small delay so it feels natural
                    setTimeout(function() {
                        _db.collection('dm_conversations').doc(convoId).collection('messages').add(nachoMsg)
                            .then(function() {
                                // Update conversation metadata
                                _db.collection('dm_conversations').doc(convoId).set({
                                    lastMessage: answer.substring(0, 100),
                                    lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
                                    lastSenderUid: auth.currentUser ? auth.currentUser.uid : 'system'
                                }, { merge: true });
                                console.log('[BUDDY] Nacho answered in buddy DM:', convoId);
                            }).catch(function(e) { console.error('[BUDDY] Nacho reply failed:', e); });
                    }, 1500 + Math.random() * 1500); // 1.5-3s delay for natural feel
                });
            });
    }).catch(function(e) { console.error('[BUDDY] Check failed:', e); });
}

console.log('[BUDDY] Bitcoin Buddy matching system loaded (with Nacho DM support)');
})();
