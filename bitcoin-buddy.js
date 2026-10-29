// © 2024-2026 603BTC LLC. All rights reserved.
// bitcoin-buddy.js — Find a Bitcoin Buddy
// The server matches, writes the welcome, and grants XP. This file only renders.

var BUDDY_PENDING_KEY = 'btc_buddy_pending';
var BUDDY_LEVELS = ['beginner', 'intermediate', 'advanced'];

function planOnboardingChoice(input) {
    var src = input || {};
    var choice = String(src.choice || src.goal || '').trim().toLowerCase();
    if (choice === 'not now' || choice === 'later' || choice === 'skip' || choice === 'not-now') {
        return { choice: 'later', store: null };
    }
    if (choice !== 'learn' && choice !== 'teach') return { choice: '', store: null };
    var level = String(src.level || 'beginner').trim().toLowerCase();
    if (BUDDY_LEVELS.indexOf(level) === -1) level = 'beginner';
    return { choice: choice, store: { level: level, goal: choice } };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        planOnboardingChoice: planOnboardingChoice,
        BUDDY_PENDING_KEY: BUDDY_PENDING_KEY,
    };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
(function () {
'use strict';

var LEVELS = ['beginner', 'intermediate', 'advanced'];
var GOALS = ['learn', 'teach'];
var POOL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
var choice = { level: 'beginner', goal: 'learn' };

function toast(msg) {
    if (typeof showToast === 'function') showToast(msg);
}

function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

function ensureStyle() {
    if (document.getElementById('buddyFinderStyle')) return;
    var style = document.createElement('style');
    style.id = 'buddyFinderStyle';
    style.textContent = [
        '.buddy-overlay{position:fixed;inset:0;z-index:260001;background:rgba(0,0,0,.92);display:flex;align-items:flex-start;justify-content:center;padding:12px;overflow:auto;box-sizing:border-box;-webkit-overflow-scrolling:touch;}',
        '.buddy-card{background:var(--bg-side,#1a1a2e);border:1px solid var(--accent,#f7931a);border-radius:16px;width:100%;max-width:440px;padding:16px;box-sizing:border-box;margin:0 auto 24px;color:var(--text,#e2e8f0);}',
        '.buddy-card h2{font-size:18px;line-height:1.3;margin:0 0 6px;color:var(--heading,#fff);font-weight:800;}',
        '.buddy-card p,.buddy-card label,.buddy-meta,.buddy-note{font-size:13px;line-height:1.45;margin:0;color:var(--text-muted,#cbd5e1);}',
        '.buddy-kicker{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text-faint,#94a3b8);margin:14px 0 8px;}',
        '.buddy-choices{display:flex;flex-wrap:wrap;gap:8px;}',
        '.buddy-choice{flex:1 1 30%;min-width:0;min-height:44px;padding:8px 6px;background:var(--card-bg,#111827);border:2px solid var(--border,#334155);border-radius:10px;color:var(--text,#e2e8f0);font-family:inherit;cursor:pointer;text-align:center;}',
        '.buddy-choice.is-on{border-color:var(--accent,#f7931a);}',
        '.buddy-choice b{display:block;font-size:14px;font-weight:700;}',
        '.buddy-choice span{display:block;font-size:12px;color:var(--text-faint,#94a3b8);}',
        '.buddy-intro{width:100%;min-height:64px;box-sizing:border-box;padding:10px;margin-top:4px;background:rgba(255,255,255,.05);border:1px solid var(--border,#334155);border-radius:10px;color:var(--text,#e2e8f0);font-family:inherit;font-size:16px;resize:vertical;}',
        '.buddy-action,.buddy-ghost,.buddy-danger{display:block;width:100%;min-height:44px;margin-top:8px;padding:10px 12px;border-radius:12px;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;box-sizing:border-box;}',
        '.buddy-action{background:var(--accent,#f7931a);color:#fff;border:none;}',
        '.buddy-ghost{background:none;border:1px solid var(--border,#334155);color:var(--text-muted,#cbd5e1);font-weight:700;}',
        '.buddy-danger{background:none;border:1px solid rgba(239,68,68,.45);color:#f87171;}',
        '.buddy-safety{margin:12px 0;padding:10px 12px;border-radius:10px;background:rgba(234,179,8,.1);border:1px solid rgba(234,179,8,.35);color:#fde68a;font-size:13px;line-height:1.45;}',
        '.buddy-panel{margin:12px 0;padding:12px;border-radius:12px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);}',
        '.buddy-name{font-size:16px;font-weight:800;color:var(--heading,#fff);}',
        '.buddy-quote{margin-top:8px;font-size:13px;font-style:italic;color:var(--text,#e2e8f0);}',
        '@media (max-width:360px){.buddy-overlay{padding:8px;}.buddy-choice{flex:1 1 100%;}}'
    ].join('');
    document.head.appendChild(style);
}

function mountCard(screen) {
    ensureStyle();
    var old = document.getElementById('buddyFinderOverlay');
    if (old) old.remove();
    var overlay = el('div', 'buddy-overlay');
    overlay.id = 'buddyFinderOverlay';
    overlay.addEventListener('click', function (event) {
        if (event.target === overlay) overlay.remove();
    });
    var card = el('div', 'buddy-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('data-buddy-screen', screen);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    return card;
}

function closeBtn(card) {
    var btn = el('button', 'buddy-ghost', 'Close');
    btn.type = 'button';
    btn.addEventListener('click', function () {
        var overlay = document.getElementById('buddyFinderOverlay');
        if (overlay) overlay.remove();
    });
    card.appendChild(btn);
}

function levelName(level) {
    if (LEVELS.indexOf(level) === -1) return 'Beginner';
    return level.charAt(0).toUpperCase() + level.slice(1);
}

function goalName(goal) {
    return goal === 'teach' ? 'Looking to teach' : 'Looking to learn';
}

function roleName(goal) {
    return goal === 'teach' ? 'Teacher' : 'Learner';
}

function msOf(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (value.toDate) return value.toDate().getTime();
    if (value.toMillis) return value.toMillis();
    var parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function waitLabel(ms) {
    var delta = Math.max(0, Date.now() - ms);
    if (delta < 60000) return 'less than a minute';
    var minutes = Math.floor(delta / 60000);
    if (minutes < 60) return minutes + (minutes === 1 ? ' minute' : ' minutes');
    var hours = Math.floor(minutes / 60);
    if (hours < 48) return hours + (hours === 1 ? ' hour' : ' hours');
    var days = Math.floor(hours / 24);
    return days + (days === 1 ? ' day' : ' days');
}

function whenLabel(ms) {
    try {
        return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (e) {
        return new Date(ms).toLocaleString();
    }
}

function callableError(err, fallback) {
    var code = err && err.code ? String(err.code) : '';
    var message = err && err.message ? String(err.message) : '';
    if (code.indexOf('resource-exhausted') !== -1) return message || 'Please wait a few seconds before trying again.';
    if (code.indexOf('invalid-argument') !== -1) return message || 'Pick a level and whether you want to learn or teach.';
    if (code.indexOf('unauthenticated') !== -1) return 'Sign in to find a Bitcoin Buddy.';
    if (code.indexOf('failed-precondition') !== -1) return message || 'Create an account before finding a Bitcoin Buddy.';
    if (code.indexOf('permission-denied') !== -1) return message || 'That action is not allowed.';
    if (code.indexOf('unavailable') !== -1) return message || "Couldn't reach buddy matching. Try again shortly.";
    if (message && message.length < 180 && message.indexOf('internal') === -1 && message.indexOf('FirebaseError') === -1) return message;
    return fallback;
}

function callBuddy(name, data) {
    if (typeof firebase === 'undefined' || !firebase.functions) {
        return Promise.reject({ code: 'unavailable', message: 'Still loading. Try again in a moment.' });
    }
    return firebase.functions().httpsCallable(name)(data || {});
}

function signedInUid() {
    if (typeof firebase === 'undefined' || !firebase.auth) return '';
    var auth = firebase.auth();
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) return '';
    return auth.currentUser.uid;
}

function requireSignIn() {
    if (signedInUid()) return true;
    if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
    else toast('Sign in to find a Bitcoin Buddy.');
    return false;
}

function paintChoices(card, group, selected) {
    card.querySelectorAll('[data-buddy-' + group + ']').forEach(function (btn) {
        if (btn.getAttribute('data-buddy-' + group) === selected) btn.classList.add('is-on');
        else btn.classList.remove('is-on');
    });
}

function addChoice(card, group, id, emoji, label, sub) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'buddy-choice' + (choice[group] === id ? ' is-on' : '');
    btn.setAttribute('data-buddy-' + group, id);
    btn.appendChild(el('div', '', emoji));
    btn.appendChild(el('b', '', label));
    btn.appendChild(el('span', '', sub));
    btn.addEventListener('click', function () {
        choice[group] = id;
        paintChoices(card, group, id);
    });
    return btn;
}

function renderForm(prefill) {
    if (prefill) {
        if (LEVELS.indexOf(prefill.level) !== -1) choice.level = prefill.level;
        if (GOALS.indexOf(prefill.goal) !== -1) choice.goal = prefill.goal;
    }
    var card = mountCard('form');
    card.appendChild(el('h2', '', 'Find a Bitcoin Buddy'));
    card.appendChild(el('p', 'buddy-note', 'Get matched with another Bitcoiner. We notify you when a buddy is found.'));

    var levelLabel = el('div', 'buddy-kicker', 'Your experience level');
    card.appendChild(levelLabel);
    var levels = el('div', 'buddy-choices');
    levels.appendChild(addChoice(card, 'level', 'beginner', '🌱', 'Beginner', 'New to Bitcoin'));
    levels.appendChild(addChoice(card, 'level', 'intermediate', '📚', 'Intermediate', 'Know the basics'));
    levels.appendChild(addChoice(card, 'level', 'advanced', '🧠', 'Advanced', 'Deep knowledge'));
    card.appendChild(levels);

    card.appendChild(el('div', 'buddy-kicker', 'I want to'));
    var goals = el('div', 'buddy-choices');
    goals.appendChild(addChoice(card, 'goal', 'learn', '📖', 'Learn', 'Find a mentor'));
    goals.appendChild(addChoice(card, 'goal', 'teach', '🎓', 'Teach', 'Help someone'));
    card.appendChild(goals);

    card.appendChild(el('div', 'buddy-kicker', 'Quick intro, optional'));
    var intro = document.createElement('textarea');
    intro.id = 'buddyIntro';
    intro.className = 'buddy-intro';
    intro.maxLength = 200;
    intro.rows = 3;
    intro.placeholder = 'What do you want to learn or teach about Bitcoin?';
    if (prefill && prefill.intro) intro.value = String(prefill.intro).slice(0, 200);
    card.appendChild(intro);

    var safety = el('div', 'buddy-safety', 'Never share keys or seed words, and never send money.');
    card.appendChild(safety);

    var replacing = prefill && prefill.replacing;
    var submit = el('button', 'buddy-action', replacing ? 'Find a new buddy' : 'Find my buddy');
    submit.type = 'button';
    submit.id = 'buddySubmitBtn';
    submit.addEventListener('click', function () {
        if (replacing) submitFindNew(submit);
        else submitRequest(submit);
    });
    card.appendChild(submit);
    closeBtn(card);
}

function renderWaiting(pool, mode) {
    var joined = Number(pool.joinedAtMs) || msOf(pool.joinedAt) || Date.now();
    var expires = Number(pool.expiresAtMs) || (joined + POOL_TTL_MS);
    var card = mountCard(mode === 'nomatch' ? 'nomatch' : 'waiting');
    card.appendChild(el('h2', '', mode === 'nomatch' ? 'No buddy is available yet' : 'Waiting for a match'));
    card.appendChild(el('p', 'buddy-note', mode === 'nomatch'
        ? "You're in the pool. We'll notify you when a buddy is found."
        : "You're still in the pool. We'll notify you when a buddy is found."));
    var panel = el('div', 'buddy-panel');
    panel.appendChild(el('div', 'buddy-name', levelName(pool.level) + ' · ' + goalName(pool.goal)));
    if (pool.intro) panel.appendChild(el('div', 'buddy-quote', pool.intro));
    card.appendChild(panel);
    card.appendChild(el('p', 'buddy-meta', 'You have been waiting ' + waitLabel(joined) + '.'));
    card.appendChild(el('p', 'buddy-meta', 'This request expires ' + whenLabel(expires) + '.'));
    var leave = el('button', 'buddy-danger', 'Leave the pool');
    leave.type = 'button';
    leave.addEventListener('click', function () { leavePool(leave); });
    card.appendChild(leave);
    closeBtn(card);
}

function renderMatched(match) {
    var buddy = match.buddy || {};
    var me = match.me || {};
    var card = mountCard('matched');
    card.appendChild(el('h2', '', 'You have a buddy'));
    var when = match.matchedAtMs ? whenLabel(match.matchedAtMs) : 'recently';
    card.appendChild(el('p', 'buddy-note', 'Matched ' + when + '.'));
    var panel = el('div', 'buddy-panel');
    var initial = (buddy.username || '?').charAt(0).toUpperCase();
    panel.appendChild(el('div', 'buddy-name', initial + '  @' + (buddy.username || 'Bitcoiner')));
    panel.appendChild(el('p', 'buddy-meta', roleName(buddy.goal) + ' · ' + levelName(buddy.level)));
    if (buddy.intro) panel.appendChild(el('div', 'buddy-quote', buddy.intro));
    card.appendChild(panel);
    card.appendChild(el('p', 'buddy-meta', 'Your role: ' + roleName(me.goal) + '.'));
    var open = el('button', 'buddy-action', 'Open conversation');
    open.type = 'button';
    open.addEventListener('click', function () {
        var overlay = document.getElementById('buddyFinderOverlay');
        if (overlay) overlay.remove();
        if (typeof openDM === 'function') openDM(buddy.uid, buddy.username || 'Bitcoiner');
        else toast('The conversation opens from Messages.');
    });
    card.appendChild(open);
    var again = el('button', 'buddy-ghost', 'Find a new buddy');
    again.type = 'button';
    again.addEventListener('click', function () { confirmFindNew(match, me); });
    card.appendChild(again);
    var end = el('button', 'buddy-danger', 'End buddy');
    end.type = 'button';
    end.addEventListener('click', function () { endMatch(match.id, end, me); });
    card.appendChild(end);
    card.appendChild(el('p', 'buddy-meta', 'This ends the match and notifies your buddy.'));
    var block = el('button', 'buddy-ghost', 'Block');
    block.type = 'button';
    block.addEventListener('click', function () {
        if (typeof blockUser === 'function') blockUser(buddy.uid, buddy.username || '');
        endMatch(match.id, block, null);
    });
    card.appendChild(block);
    var report = el('button', 'buddy-ghost', 'Report this buddy');
    report.type = 'button';
    report.addEventListener('click', function () {
        window.onBuddyReported = function (reportedUid) {
            if (reportedUid !== buddy.uid) return;
            if (!window.confirm('End this buddy match? The conversation stays available.')) return;
            endMatch(match.id, report, null);
        };
        if (typeof window.submitReport === 'function') window.submitReport(buddy.uid, buddy.username || '', 'buddy');
        else toast('Reporting is unavailable right now.');
    });
    card.appendChild(report);
    closeBtn(card);
}

function submitRequest(btn) {
    if (!requireSignIn()) return;
    btn.disabled = true;
    btn.textContent = 'Searching for a match...';
    var introEl = document.getElementById('buddyIntro');
    var intro = introEl ? String(introEl.value || '').slice(0, 200) : '';
    callBuddy('requestBuddyMatch', {
        level: choice.level,
        goal: choice.goal,
        intro: intro
    }).then(function (res) {
        var data = res && res.data ? res.data : {};
        if (data.status === 'matched' && data.match) {
            toast(data.created ? 'You have a Bitcoin Buddy. A notification was sent to both of you.' : 'You already have a Bitcoin Buddy.');
            renderMatched(data.match);
            return;
        }
        renderWaiting(data.pool || {
            level: choice.level,
            goal: choice.goal,
            intro: intro,
            joinedAtMs: Date.now(),
            expiresAtMs: Date.now() + POOL_TTL_MS
        }, 'nomatch');
    }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Find my buddy';
        toast(callableError(err, "Couldn't reach buddy matching. Try again shortly."));
    });
}

function leavePool(btn) {
    btn.disabled = true;
    btn.textContent = 'Leaving...';
    callBuddy('leaveBuddyPool', {}).then(function (res) {
        var data = res && res.data ? res.data : {};
        var overlay = document.getElementById('buddyFinderOverlay');
        if (overlay) overlay.remove();
        toast(data.removed ? 'You left the buddy pool.' : "You weren't in the buddy pool.");
    }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Leave the pool';
        toast(callableError(err, "Couldn't leave the buddy pool. Try again shortly."));
    });
}

function confirmFindNew(match, me) {
    if (!window.confirm('This ends the current match and looks for a new buddy. The conversation stays available. Your buddy is told the match ended.')) return;
    var next = { replacing: (match && match.id) || '1', level: me && me.level, goal: me && me.goal };
    renderForm(next);
}

function submitFindNew(btn) {
    if (!requireSignIn()) return;
    btn.disabled = true;
    btn.textContent = 'Looking for a new buddy...';
    var introEl = document.getElementById('buddyIntro');
    var intro = introEl ? String(introEl.value || '').slice(0, 200) : '';
    callBuddy('findNewBuddy', {
        level: choice.level,
        goal: choice.goal,
        intro: intro
    }).then(function (res) {
        var data = res && res.data ? res.data : {};
        if (data.status === 'matched' && data.match) {
            toast('You have a Bitcoin Buddy. A notification was sent to both of you.');
            renderMatched(data.match);
            return;
        }
        renderWaiting(data.pool || {
            level: choice.level,
            goal: choice.goal,
            intro: intro,
            joinedAtMs: Date.now(),
            expiresAtMs: Date.now() + POOL_TTL_MS
        }, 'nomatch');
    }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Find a new buddy';
        toast(callableError(err, "Couldn't look for a new buddy. Try again shortly."));
    });
}

function endMatch(matchId, btn, me) {
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Ending...';
    }
    callBuddy('endBuddy', { matchId: matchId || '' }).then(function () {
        toast('Buddy ended. Your buddy was notified.');
        renderForm(me);
    }).catch(function (err) {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'End buddy';
        }
        toast(callableError(err, "Couldn't end that buddy match. Try again shortly."));
    });
}

function db() {
    return firebase.firestore();
}

function loadExisting(uid) {
    var userPromise = db().collection('users').doc(uid).get().catch(function () { return null; });
    return userPromise.then(function (userSnap) {
        var activeId = userSnap && userSnap.exists ? userSnap.get('activeBuddyId') : '';
        if (activeId) {
            return db().collection('buddy_matches').doc(activeId).get().then(function (matchSnap) {
                if (matchSnap.exists) {
                    var data = matchSnap.data() || {};
                    renderMatched({
                        id: matchSnap.id,
                        matchedAtMs: msOf(data.matchedAtMs) || msOf(data.matchedAt),
                        me: data.user1 && data.user1.uid === uid ? data.user1 : data.user2,
                        buddy: data.user1 && data.user1.uid === uid ? data.user2 : data.user1
                    });
                    return true;
                }
                return false;
            });
        }
        return false;
    }).then(function (shown) {
        if (shown) return;
        return db().collection('buddy_pool').doc(uid).get().then(function (poolSnap) {
            if (poolSnap.exists) renderWaiting(poolSnap.data() || {}, 'waiting');
            else renderForm(null);
        });
    });
}

function storeBuddyPending(plan) {
    try {
        if (!plan || !plan.store) localStorage.removeItem(BUDDY_PENDING_KEY);
        else localStorage.setItem(BUDDY_PENDING_KEY, JSON.stringify(plan.store));
    } catch (e) {}
}

window._submitBuddyFromOnboarding = function (level, goal) {
    var plan = planOnboardingChoice({ level: level, goal: goal, choice: goal });
    if (!plan.store) {
        storeBuddyPending(null);
        return;
    }
    if (!signedInUid()) {
        storeBuddyPending(plan);
        return;
    }
    storeBuddyPending(null);
    callBuddy('requestBuddyMatch', {
        level: plan.store.level,
        goal: plan.store.goal,
        intro: ''
    }).catch(function () {});
};

function flushBuddyPending() {
    if (!signedInUid()) return;
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(BUDDY_PENDING_KEY) || 'null'); } catch (e) { raw = null; }
    if (!raw || !raw.goal) return;
    window._submitBuddyFromOnboarding(raw.level || 'beginner', raw.goal);
}

function paintAccountReview() {
    if (document.getElementById('buddyReviewScreen')) return;
    var overlay = el('div', 'buddy-overlay');
    overlay.id = 'buddyReviewScreen';
    var card = el('div', 'buddy-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Your account is under review');
    card.appendChild(el('h2', '', 'Your account is under review'));
    card.appendChild(el('p', 'buddy-note', 'You can keep browsing and stay signed in. Sending messages, matching, and rewards are paused until the review is finished.'));
    var browse = el('button', 'buddy-action', 'Keep browsing');
    browse.type = 'button';
    browse.addEventListener('click', function () { overlay.remove(); });
    card.appendChild(browse);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
}

function watchAccountReview() {
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) return;
    firebase.auth().onAuthStateChanged(function (user) {
        var old = window._buddyReviewUnsub;
        if (typeof old === 'function') old();
        window._buddyReviewUnsub = null;
        if (!user || user.isAnonymous) return;
        window._buddyReviewUnsub = firebase.firestore().collection('users').doc(user.uid).onSnapshot(function (snap) {
            var lock = snap.exists ? snap.get('lock') : null;
            if (lock && lock.state === 'locked') paintAccountReview();
        }, function () {});
    });
}

function attachBuddyReport(otherUid, otherName) {
    if (!otherUid || !signedInUid()) return;
    var myUid = signedInUid();
    var convoId = myUid < otherUid ? myUid + '_' + otherUid : otherUid + '_' + myUid;
    db().collection('dm_conversations').doc(convoId).get().then(function (snap) {
        if (!snap.exists || snap.get('isBuddyMatch') !== true) return;
        var header = document.querySelector('#dmWindow button[title="Report user"]');
        if (!header || document.getElementById('buddyDmReport')) return;
        var btn = el('button', '', 'Report this buddy');
        btn.id = 'buddyDmReport';
        btn.type = 'button';
        btn.style.cssText = 'background:none;border:1px solid var(--border,#334155);color:var(--text,#e2e8f0);min-height:44px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;font-family:inherit;';
        btn.addEventListener('click', function (event) {
            event.stopPropagation();
            window.onBuddyReported = function (reportedUid) {
                if (reportedUid !== otherUid) return;
                if (!window.confirm('End this buddy match? The conversation stays available.')) return;
                endMatch('', null, null);
            };
            if (typeof window.submitReport === 'function') window.submitReport(otherUid, otherName || '', 'buddy');
            else if (typeof reportUser === 'function') reportUser(otherUid, otherName || '', 'buddy');
        });
        if (header.parentNode) header.parentNode.insertBefore(btn, header);
    }).catch(function () {});
}

function installBuddyReportHook() {
    if (typeof window.openDM !== 'function' || window.openDM._buddyReport) return;
    var prev = window.openDM;
    var wrapped = function (recipientUid, recipientName) {
        var result = prev.apply(this, arguments);
        setTimeout(function () { attachBuddyReport(recipientUid, recipientName); }, 0);
        return result;
    };
    wrapped._buddyReport = true;
    window.openDM = wrapped;
}

window.renderBuddyReportsAdmin = function (containerId) {
    var root = document.getElementById(containerId);
    if (!root || window._isAdminClaim !== true || typeof firebase === 'undefined' || !firebase.firestore) return;
    root.textContent = '';
    var card = el('div', '');
    card.style.cssText = 'background:var(--card-bg,#111827);border:1px solid var(--border,#334155);border-radius:12px;padding:14px;';
    card.appendChild(el('div', '', 'Buddy reports'));
    var status = el('div', '', 'Loading...');
    status.style.cssText = 'font-size:13px;color:var(--text-muted,#cbd5e1);margin-top:6px;';
    card.appendChild(status);
    root.appendChild(card);
    Promise.all([
        firebase.firestore().collection('buddy_flags').where('status', '==', 'open').orderBy('createdAt', 'desc').limit(20).get(),
        firebase.firestore().collection('buddy_borderline').where('status', '==', 'open').orderBy('createdAt', 'desc').limit(20).get()
    ]).then(function (snaps) {
        var snap = snaps[0];
        var border = snaps[1];
        status.textContent = '';
        var shown = 0;
        snap.forEach(function (docSnap) {
            var data = docSnap.data() || {};
            shown++;
            var block = el('div', '');
            block.style.cssText = 'border-top:1px solid var(--border,#334155);padding-top:8px;margin-top:8px;';
            var who = String(data.reportedUid || '').slice(0, 6);
            block.appendChild(el('div', '', (data.severity || 'flag') + ' · ' + who));
            var snippet = el('div', '', data.snippet || '');
            snippet.style.cssText = 'font-size:12px;color:var(--text-muted,#cbd5e1);margin:4px 0;';
            block.appendChild(snippet);
            if (data.severity === 'high' && data.reportedUid) {
                ['unlock', 'keep_locked', 'ban', 'unlock_and_dismiss'].forEach(function (action) {
                    var btn = el('button', 'buddy-ghost', action.replace(/_/g, ' '));
                    btn.type = 'button';
                    btn.style.marginTop = '6px';
                    btn.addEventListener('click', function () {
                        callBuddy('adminResolveLock', { uid: data.reportedUid, action: action }).then(function () {
                            toast('Saved.');
                            window.renderBuddyReportsAdmin(containerId);
                        }).catch(function (err) {
                            toast(callableError(err, 'That action did not save.'));
                        });
                    });
                    block.appendChild(btn);
                });
            }
            card.appendChild(block);
        });
        border.forEach(function (docSnap) {
            var data = docSnap.data() || {};
            shown++;
            var block = el('div', '');
            block.style.cssText = 'border-top:1px solid var(--border,#334155);padding-top:8px;margin-top:8px;';
            block.appendChild(el('div', '', 'borderline · ' + String(data.senderUid || '').slice(0, 6)));
            var snippet = el('div', '', data.text || '');
            snippet.style.cssText = 'font-size:12px;color:var(--text-muted,#cbd5e1);margin:4px 0;';
            block.appendChild(snippet);
            ['lock', 'ban', 'dismiss'].forEach(function (action) {
                var btn = el('button', 'buddy-ghost', action);
                btn.type = 'button';
                btn.style.marginTop = '6px';
                btn.addEventListener('click', function () {
                    callBuddy('adminResolveBorderline', { flagId: docSnap.id, action: action }).then(function () {
                        toast('Saved.');
                        window.renderBuddyReportsAdmin(containerId);
                    }).catch(function (err) {
                        toast(callableError(err, 'That action did not save.'));
                    });
                });
                block.appendChild(btn);
            });
            card.appendChild(block);
        });
        if (!shown) status.textContent = 'No buddy reports waiting.';
    }).catch(function () {
        status.textContent = 'Could not load buddy reports.';
    });
};

window.showBuddyFinder = function () {
    if (!requireSignIn()) return;
    var uid = signedInUid();
    if (typeof firebase === 'undefined' || !firebase.firestore) {
        toast('Still loading. Try again in a moment.');
        return;
    }
    loadExisting(uid).catch(function (err) {
        var code = err && err.code ? String(err.code) : '';
        if (code.indexOf('permission') !== -1) toast("Couldn't load your buddy status. Try again.");
        else toast("Couldn't load your buddy status. Try again shortly.");
        renderForm(null);
    });
};

window._renderBuddyPreview = function (screen, model) {
    if (screen === 'waiting') renderWaiting(model || {}, 'waiting');
    else if (screen === 'nomatch') renderWaiting(model || {}, 'nomatch');
    else if (screen === 'matched') renderMatched(model || { buddy: {}, me: {} });
    else renderForm(model || null);
};

function wrapNotifClick() {
    if (typeof window.handleNotifClick !== 'function' || window.handleNotifClick._buddy) return;
    var prev = window.handleNotifClick;
    var wrapped = function (notifId, targetType, targetId) {
        var result = prev.apply(this, arguments);
        if (targetType === 'buddy') window.showBuddyFinder();
        return result;
    };
    wrapped._buddy = true;
    window.handleNotifClick = wrapped;
}

var notifTries = 0;
var notifTimer = setInterval(function () {
    notifTries++;
    wrapNotifClick();
    if ((window.handleNotifClick && window.handleNotifClick._buddy) || notifTries > 40) clearInterval(notifTimer);
}, 500);

if (window._pendingBuddy) {
    window._pendingBuddy = false;
    window.showBuddyFinder();
}

watchAccountReview();
var hookTries = 0;
var hookTimer = setInterval(function () {
    hookTries++;
    installBuddyReportHook();
    flushBuddyPending();
    if ((window.openDM && window.openDM._buddyReport) || hookTries > 40) clearInterval(hookTimer);
}, 500);

console.log('[BUDDY] Find a Bitcoin Buddy ready');
})();
}
