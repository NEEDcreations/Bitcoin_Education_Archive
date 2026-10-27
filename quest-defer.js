// One gate for popup quests. If the reader is typing, in a sheet, or mid-gesture,
// the quest waits and is offered again later. Rewards stay on the server.
(function () {
    var IDLE_MS = 2500;
    var GESTURE_MS = 700;
    var REOFFER_MS = 45000;
    var queue = [];
    var idleTimer = null;
    var idleSince = 0;

    function idleDelay() {
        var n = window.BTC_QUEST_IDLE_MS;
        return (typeof n === 'number' && n >= 0) ? n : IDLE_MS;
    }

    function on(target, type, fn) {
        if (target && typeof target.addEventListener === 'function') target.addEventListener(type, fn, true);
    }

    function shown(el) {
        if (!el || el.nodeType !== 1) return false;
        if (el.hidden) return false;
        if (el.hasAttribute && el.hasAttribute('hidden')) return false;
        var style = el.style || {};
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (el.classList && el.classList.contains('hidden')) return false;
        return true;
    }

    function classOpen(el) {
        return !!(el && el.classList && el.classList.contains('open'));
    }

    function byId(id) {
        if (!document || typeof document.getElementById !== 'function') return null;
        return document.getElementById(id);
    }

    function isEditable(el) {
        if (!el || el.nodeType !== 1) return false;
        var tag = String(el.tagName || '').toUpperCase();
        if (tag === 'TEXTAREA') return true;
        if (tag === 'SELECT') return true;
        if (el.isContentEditable) return true;
        if (el.getAttribute && el.getAttribute('contenteditable') === 'true') return true;
        if (tag === 'INPUT') {
            var type = String(el.type || 'text').toLowerCase();
            if (type === 'hidden' || type === 'button' || type === 'submit' || type === 'checkbox' || type === 'radio' || type === 'file' || type === 'range' || type === 'color' || type === 'image') return false;
            return true;
        }
        return false;
    }

    function cssHidden(el) {
        if (typeof window.getComputedStyle !== 'function' || !el) return false;
        try {
            var cs = window.getComputedStyle(el);
            return !!(cs && (cs.display === 'none' || cs.visibility === 'hidden'));
        } catch (e) { return false; }
    }

    function fieldVisible(el) {
        var node = el;
        while (node && node.nodeType === 1) {
            if (!shown(node) || cssHidden(node)) return false;
            if (node.id === 'chatOverlay' && !window._chatOverlayOpen) return false;
            var transform = node.style && node.style.transform ? String(node.style.transform) : '';
            if (transform.indexOf('translateY(100%)') !== -1) return false;
            if (node === document.body) break;
            node = node.parentNode;
        }
        return !!el;
    }

    function eachField(fn) {
        if (document && typeof document.querySelectorAll === 'function') {
            var list = document.querySelectorAll('textarea, input, select, [contenteditable="true"]');
            var i;
            for (i = 0; i < list.length; i++) fn(list[i]);
            return;
        }
        ['topic-discussion-input', 'td-inline-input', 'nachoInput', 'nachoModeInput', 'searchInput', 'chatInput', 'dmInput'].forEach(function (id) {
            var el = byId(id);
            if (el) fn(el);
        });
    }

    function draftText(el) {
        if (!el) return '';
        if (el.value != null && String(el.tagName || '').toUpperCase() !== 'DIV') return String(el.value);
        return String(el.textContent || '');
    }

    function modalById(id, mode) {
        var el = byId(id);
        if (!fieldVisible(el)) return false;
        if (mode === 'class') return classOpen(el);
        if (mode === 'exists') return true;
        if (mode === 'convo') return classOpen(el);
        return classOpen(el) || (el.style && (el.style.display === 'flex' || el.style.display === 'block'));
    }

    function dialogOpen() {
        if (!document || typeof document.querySelectorAll !== 'function') {
            return modalById('topic-convo-modal', 'convo') || modalById('usernameModal', 'class') || modalById('questModal', 'class');
        }
        var nodes = document.querySelectorAll('[role="dialog"], [aria-modal="true"], .gifting-overlay');
        var i;
        for (i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            if (!fieldVisible(el)) continue;
            if (el.id === 'btc-quest-pill') continue;
            if (el.id === 'questModal' && !classOpen(el)) continue;
            if (el.id === 'topic-convo-modal' && !classOpen(el)) continue;
            if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') continue;
            return true;
        }
        return false;
    }

    window.btcUserBusy = function () {
        if (window._btcPointerDown) return true;
        if (window._btcGestureUntil && Date.now() < window._btcGestureUntil) return true;
        if (window._chatOverlayOpen || window._nachoMode || window._nachoBusy || window._examActive || window._scholarExamActive || window._pvpActive || window._giftOpening) return true;
        var active = document && document.activeElement;
        if (isEditable(active) && fieldVisible(active)) return true;
        var draftBusy = false;
        eachField(function (el) {
            if (draftBusy || !isEditable(el) || !fieldVisible(el)) return;
            if (el.id === 'btc-quest-pill') return;
            var quest = byId('questModal');
            if (quest && quest.contains && quest.contains(el) && classOpen(quest)) return;
            if (String(draftText(el) || '').trim()) draftBusy = true;
        });
        if (draftBusy) return true;
        if (modalById('topic-convo-modal', 'convo')) return true;
        var search = byId('searchOverlay');
        if (search && fieldVisible(search) && search.getAttribute && search.getAttribute('data-open') === '1') return true;
        if (modalById('usernameModal', 'class') || modalById('tosModal', 'class') || modalById('questModal', 'class')) return true;
        if (modalById('leaderboard', 'class') || modalById('donateModal', 'exists') || modalById('spinModal', 'exists')) return true;
        if (modalById('lnAuthModal', 'exists') || modalById('nostrAuthOverlay', 'exists') || modalById('tipOverlay', 'exists')) return true;
        if (modalById('questHubOverlay', 'exists') || modalById('guideOverlay', 'exists') || modalById('onboardingOverlay', 'exists')) return true;
        if (modalById('pvpOverlay', 'exists') || modalById('pvpNameOverlay', 'exists') || modalById('nachoModeScreen', 'exists')) return true;
        if (modalById('dmWindow', 'exists') || modalById('dmInbox', 'exists') || modalById('postSpinGiftOverlay', 'exists')) return true;
        if (modalById('userProfileModal', 'exists') || modalById('reportModal', 'exists') || modalById('kbHelpModal', 'exists')) return true;
        var invite = byId('inviteCard');
        if (invite && fieldVisible(invite) && invite.getAttribute && invite.getAttribute('data-state') === 'open') return true;
        if (typeof window.bqTopicConversationOpen === 'function' && window.bqTopicConversationOpen()) return true;
        if (dialogOpen()) return true;
        return false;
    };

    function capturePlace() {
        if (window._btcQuestReturn) return window._btcQuestReturn;
        var channelId = window.currentChannelId || '';
        var area = byId('topic-discussion-input');
        var inline = byId('td-inline-input');
        var draft = area ? String(area.value || '') : '';
        if (!draft && typeof window.bqReadTopicDraft === 'function') draft = String(window.bqReadTopicDraft(channelId) || '');
        if (draft && typeof window.bqSaveTopicDraft === 'function') window.bqSaveTopicDraft(channelId, draft);
        var active = document && document.activeElement;
        var writingHere = !!(area && active === area && fieldVisible(area));
        window._btcQuestReturn = {
            channelId: channelId,
            draft: draft,
            inlineDraft: inline ? String(inline.value || '') : '',
            convoOpen: !!(modalById('topic-convo-modal', 'convo') || writingHere),
            focusId: (active && active.id) || (writingHere ? 'topic-discussion-input' : '')
        };
        return window._btcQuestReturn;
    }

    function restorePlace() {
        var place = window._btcQuestReturn;
        window._btcQuestReturn = null;
        if (!place) return;
        if (place.draft && typeof window.bqSaveTopicDraft === 'function') window.bqSaveTopicDraft(place.channelId, place.draft);
        if (place.convoOpen && typeof window.bqRestoreTopicConversation === 'function') {
            window.bqRestoreTopicConversation({ channelId: place.channelId, draft: place.draft, focus: true });
            return;
        }
        if (place.focusId) {
            var el = byId(place.focusId);
            if (el && typeof el.focus === 'function') {
                try { el.focus(); } catch (e) {}
            }
        }
    }

    function hidePill() {
        var pill = byId('btc-quest-pill');
        if (!pill) return;
        pill.hidden = true;
        if (pill.style) pill.style.display = 'none';
    }

    function showPill() {
        if (!document || typeof document.createElement !== 'function' || !document.body) return;
        var pill = byId('btc-quest-pill');
        if (!pill) {
            pill = document.createElement('button');
            pill.id = 'btc-quest-pill';
            pill.type = 'button';
            pill.textContent = 'Quest ready';
            pill.setAttribute('aria-label', 'Quest ready. Tap to play it when you are free.');
            pill.style.cssText = 'position:fixed;top:calc(12px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);z-index:360000;padding:10px 16px;min-height:44px;border-radius:999px;border:1px solid #f7931a;background:#1a1208;color:#fff;font-weight:800;font-family:inherit;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.4);';
            pill.addEventListener('click', function (event) {
                if (event && event.preventDefault) event.preventDefault();
                window._btcQuestHoldUntil = 0;
                idleSince = Date.now() - idleDelay();
                runQueue();
            });
            document.body.appendChild(pill);
        }
        pill.hidden = false;
        if (pill.style) pill.style.display = 'block';
    }

    function enqueue(open, id, holdMs) {
        var key = id || 'quest';
        queue = queue.filter(function (item) { return item.id !== key; });
        queue.push({ id: key, open: open, holdMs: holdMs || 0 });
        if (holdMs) window._btcQuestHoldUntil = Math.max(window._btcQuestHoldUntil || 0, Date.now() + holdMs);
    }

    function held() {
        return Date.now() < (window._btcQuestHoldUntil || 0);
    }

    function runQueue() {
        if (!queue.length) { hidePill(); return; }
        if (window.btcUserBusy()) { hidePill(); arm(); return; }
        if (held()) { showPill(); arm(); return; }
        var item = queue.shift();
        hidePill();
        idleSince = 0;
        window._btcQuestBypassBusy = true;
        try { item.open(); }
        finally { window._btcQuestBypassBusy = false; }
        if (queue.length) arm();
    }

    function arm() {
        if (idleTimer) clearTimeout(idleTimer);
        function tick() {
            idleTimer = null;
            if (!queue.length) { hidePill(); return; }
            if (window.btcUserBusy()) {
                idleSince = 0;
                hidePill();
                idleTimer = setTimeout(tick, 300);
                return;
            }
            if (!idleSince) idleSince = Date.now();
            showPill();
            if (!held() && Date.now() - idleSince >= idleDelay()) {
                runQueue();
                return;
            }
            idleTimer = setTimeout(tick, 200);
        }
        idleTimer = setTimeout(tick, 200);
    }

    // Returns true when the quest was queued instead of opened.
    window.btcDeferQuestIfBusy = function (open, id) {
        if (typeof open !== 'function') return false;
        if (window._btcQuestBypassBusy) return false;
        if (!window.btcUserBusy()) return false;
        capturePlace();
        enqueue(open, id, 0);
        arm();
        return true;
    };

    window.btcQueueQuest = function (open, id, holdMs) {
        if (typeof open !== 'function') return;
        capturePlace();
        enqueue(open, id || 'quest', holdMs == null ? REOFFER_MS : holdMs);
        arm();
    };

    window.btcNoteSurfaceClosed = function () {
        idleSince = 0;
        if (queue.length) arm();
    };

    function questOpen() {
        var modal = byId('questModal');
        return !!(modal && classOpen(modal));
    }

    window.btcReleaseQuestLayer = function () {
        var modal = byId('questModal');
        if (modal) {
            if (modal.classList) modal.classList.remove('open');
            if (modal.style) {
                modal.style.display = 'none';
                modal.style.pointerEvents = 'none';
                modal.style.visibility = 'hidden';
            }
            if (modal.setAttribute) modal.setAttribute('aria-hidden', 'true');
        }
        if (document && typeof document.querySelectorAll === 'function') {
            var extras = document.querySelectorAll('.btc-quest-backdrop, #btcQuestShield');
            var i;
            for (i = 0; i < extras.length; i++) {
                if (extras[i] && extras[i].parentNode) extras[i].parentNode.removeChild(extras[i]);
            }
        }
        var body = document && document.body;
        if (body && body.style && !window.btcUserBusy()) {
            body.style.overflow = '';
        }
    };

    function decorateQuestModal() {
        var modal = byId('questModal');
        var inner = byId('questInner');
        if (!modal) return;
        if (modal.style) {
            modal.style.display = '';
            modal.style.pointerEvents = '';
            modal.style.visibility = '';
        }
        if (modal.classList) modal.classList.add('open');
        if (modal.setAttribute) {
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-hidden', 'false');
            modal.setAttribute('aria-label', 'Quest');
        }
        if (!inner || window._scholarExamActive) return;
        var existing = byId('questNotNowBtn');
        if (!existing && typeof document.createElement === 'function') {
            var btn = document.createElement('button');
            btn.id = 'questNotNowBtn';
            btn.type = 'button';
            btn.className = 'quest-not-now';
            btn.textContent = 'Not now / Back';
            btn.setAttribute('aria-label', 'Not now. Go back to where you were.');
            btn.addEventListener('click', function (event) {
                if (event && event.preventDefault) event.preventDefault();
                if (event && event.stopPropagation) event.stopPropagation();
                window.btcDismissQuest('button');
            });
            if (inner.insertBefore && inner.firstChild) inner.insertBefore(btn, inner.firstChild);
            else if (inner.appendChild) inner.appendChild(btn);
        }
        var skips = inner.querySelectorAll ? inner.querySelectorAll('.quest-skip') : [];
        var s;
        for (s = 0; s < skips.length; s++) {
            skips[s].textContent = 'Not now / Back';
            skips[s].setAttribute('aria-label', 'Not now. Go back to where you were.');
            skips[s].onclick = function (event) {
                if (event && event.preventDefault) event.preventDefault();
                if (event && event.stopPropagation) event.stopPropagation();
                window.btcDismissQuest('button');
            };
        }
    }

    function pushQuestHistory() {
        if (window._btcQuestHistoryPushed) return;
        if (typeof history === 'undefined' || !history || typeof history.pushState !== 'function') return;
        try {
            history.pushState({ overlay: 'quest' }, '', window.location ? window.location.href : '');
            window._btcQuestHistoryPushed = true;
        } catch (e) {}
    }

    function rememberQuest(quest) {
        if (quest) window._btcLastPopupQuest = quest;
    }

    function reofferQuest(quest) {
        if (!quest) return;
        window.btcQueueQuest(function () {
            window._btcQuestBypassBusy = true;
            try {
                if (typeof window.showQuest === 'function') window.showQuest(quest, false);
            } finally {
                window._btcQuestBypassBusy = false;
            }
        }, 'reoffer-quest', REOFFER_MS);
    }

    function popHistoryFirst(flagName, pendingName, reason) {
        if (reason === 'back') {
            window[flagName] = false;
            window[pendingName] = false;
            return false;
        }
        if (window[flagName] && typeof history !== 'undefined' && history && typeof history.back === 'function') {
            window[flagName] = false;
            window[pendingName] = true;
            try { history.back(); return true; } catch (e) { window[pendingName] = false; }
        }
        return false;
    }

    window.btcDismissQuest = function (reason) {
        if (window._scholarExamActive) return;
        var open = questOpen();
        if (!open && reason === 'back' && !window._btcQuestBackPending) return;
        if (window._btcDismissing) return;
        if (popHistoryFirst('_btcQuestHistoryPushed', '_btcQuestBackPending', reason)) return;
        window._btcDismissing = true;
        window._btcQuestBackPending = false;
        window._btcQuestHistoryPushed = false;
        var finished = window._questSubmitted === true;
        var quest = window._btcLastPopupQuest;
        if (typeof window.closeQuest === 'function') window.closeQuest();
        else window.btcReleaseQuestLayer();
        if (!finished && quest) reofferQuest(quest);
        else window._btcLastPopupQuest = null;
        window._btcDismissing = false;
    };

    window.btcDismissBubbleQuiz = function (reason) {
        if (window._btcBubbleDismissing) return;
        var bubble = byId('nacho-bubble');
        var showing = !!(bubble && bubble.classList && bubble.classList.contains('show') && bubble.getAttribute && bubble.getAttribute('data-trivia') === '1' && window._btcBubbleQuiz);
        if (!showing && reason === 'back' && !window._btcBubbleBackPending) return;
        if (popHistoryFirst('_btcBubbleHistory', '_btcBubbleBackPending', reason)) return;
        window._btcBubbleDismissing = true;
        window._btcBubbleBackPending = false;
        window._btcBubbleHistory = false;
        var q = window._btcBubbleQuiz;
        var awarded = !!(q && window._btcBubbleQuizAwarded === String(q.question || ''));
        window._btcBubbleQuiz = null;
        window._nachoTriviaXClose = true;
        if (typeof window.hideBubble === 'function') window.hideBubble(true);
        if (!awarded && q && typeof window._presentBubbleQuiz === 'function') {
            window.btcQueueQuest(function () { window._presentBubbleQuiz(q); }, 'bubble-quiz', REOFFER_MS);
        }
        restorePlace();
        window._btcBubbleDismissing = false;
    };

    window.btcDismissNachoTrivia = function (reason) {
        if (window._btcTriviaDismissing) return;
        var bubble = byId('nacho-bubble');
        var showing = !!(bubble && bubble.classList && bubble.classList.contains('show') && bubble.getAttribute && bubble.getAttribute('data-trivia') === '1');
        if (!showing && reason === 'back' && !window._btcTriviaBackPending) return;
        if (popHistoryFirst('_btcTriviaHistory', '_btcTriviaBackPending', reason)) return;
        window._btcTriviaDismissing = true;
        window._btcTriviaBackPending = false;
        window._btcTriviaHistory = false;
        var pending = window._btcNachoTriviaPending;
        var answered = window._btcNachoTriviaAnswered === true;
        window._nachoTriviaXClose = true;
        if (typeof window.hideBubble === 'function') window.hideBubble(true);
        if (!answered && pending && typeof window._replayNachoTrivia === 'function') {
            window.btcQueueQuest(function () { window._replayNachoTrivia(pending); }, 'nacho-trivia', REOFFER_MS);
        }
        restorePlace();
        window._btcTriviaDismissing = false;
    };

    function tryWrapQuests() {
        if (typeof window.generateAndShowQuest === 'function' && !window.generateAndShowQuest._btcWrapped) {
            var origGen = window.generateAndShowQuest;
            window.generateAndShowQuest = function (manual, targetChannelId, isRetake) {
                var args = arguments;
                if (!manual && !window._btcQuestBypassBusy && window.btcUserBusy()) {
                    window.btcDeferQuestIfBusy(function () {
                        window._btcQuestBypassBusy = true;
                        try { origGen.apply(window, args); }
                        finally { window._btcQuestBypassBusy = false; }
                    }, 'auto-quest');
                    return;
                }
                return origGen.apply(window, args);
            };
            window.generateAndShowQuest._btcWrapped = true;
        }
        if (typeof window.showQuest === 'function' && !window.showQuest._btcWrapped) {
            var origShow = window.showQuest;
            window.showQuest = function (quest, retry) {
                rememberQuest(quest);
                if (!window._btcQuestReturn) capturePlace();
                var result = origShow.apply(window, arguments);
                decorateQuestModal();
                pushQuestHistory();
                hidePill();
                return result;
            };
            window.showQuest._btcWrapped = true;
        }
        if (typeof window.closeQuest === 'function' && !window.closeQuest._btcWrapped) {
            var origClose = window.closeQuest;
            window.closeQuest = function () {
                window.btcReleaseQuestLayer();
                var result = origClose.apply(window, arguments);
                if (window._questSubmitted) window._btcLastPopupQuest = null;
                restorePlace();
                return result;
            };
            window.closeQuest._btcWrapped = true;
        }
        if (typeof window.skipQuest === 'function' && !window.skipQuest._btcWrapped) {
            window.skipQuest = function () { window.btcDismissQuest('button'); };
            window.skipQuest._btcWrapped = true;
        }
    }

    tryWrapQuests();
    if (typeof setInterval === 'function') {
        var wrapTimer = setInterval(tryWrapQuests, 500);
        if (wrapTimer && typeof wrapTimer.unref === 'function') wrapTimer.unref();
    }

    function markGesture() {
        window._btcGestureUntil = Date.now() + GESTURE_MS;
        idleSince = 0;
    }
    on(document, 'pointerdown', function () { window._btcPointerDown = true; markGesture(); });
    on(document, 'pointerup', function () { window._btcPointerDown = false; markGesture(); });
    on(document, 'pointercancel', function () { window._btcPointerDown = false; });
    on(document, 'touchstart', function () { window._btcPointerDown = true; markGesture(); });
    on(document, 'touchend', function () { window._btcPointerDown = false; markGesture(); });
    on(document, 'wheel', markGesture);
    on(document, 'scroll', markGesture);
    on(window, 'scroll', markGesture);
})();
