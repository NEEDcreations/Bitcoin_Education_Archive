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

            await _db.collection(MATCH_COLLECTION).add({
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

            // Send icebreaker via DM
            setTimeout(function() {
                if (typeof openDM === 'function') {
                    openDM(match.data.uid, match.data.username);
                } else if (typeof showInbox === 'function') {
                    showInbox();
                }
            }, 500);

            // Nacho sends an icebreaker suggestion
            setTimeout(function() {
                if (typeof showToast === 'function') {
                    var icebreakers = [
                        '🦌 Icebreaker: "What first got you interested in Bitcoin?"',
                        '🦌 Icebreaker: "What\'s the most mind-blowing thing you\'ve learned about Bitcoin?"',
                        '🦌 Icebreaker: "If you could explain Bitcoin to your parents in one sentence, what would you say?"',
                        '🦌 Icebreaker: "What Bitcoin topic do you find most confusing?"',
                        '🦌 Icebreaker: "Have you ever orange-pilled someone? How did it go?"',
                    ];
                    showToast(icebreakers[Math.floor(Math.random() * icebreakers.length)]);
                }
            }, 3000);

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

console.log('[BUDDY] Bitcoin Buddy matching system loaded');
})();
