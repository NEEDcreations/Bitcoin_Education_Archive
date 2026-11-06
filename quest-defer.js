// One gate for popup quests. If the reader is typing, in a sheet, or mid-gesture,
// the quest waits and is offered again later. Rewards stay on the server.
(function () {
    var IDLE_MS = 2500;
    var GESTURE_MS = 700;
    var REOFFER_MS = 45000;
    var COMPOSERS = {
        'topic-discussion-input': 1,
        'td-inline-input': 1,
        'globalChatInput': 1,
        'dmInput': 1,
        'forumReplyInput': 1,
        'articleReplyInput': 1,
        'beatsCommentInput': 1
    };
    var queue = [];
    var idleTimer = null;
    var idleSince = 0;
    var wrapTimer = null;

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

    function isSearchField(el) {
        if (!el) return false;
        var id = String(el.id || '');
        if (id === 'searchInput' || id === 'searchOverlayInput') return true;
        return String(el.type || '').toLowerCase() === 'search';
    }

    function isLocked(el) {
        if (!el) return false;
        if (el.readOnly || el.disabled) return true;
        if (!el.getAttribute) return false;
        if (el.getAttribute('readonly') != null || el.getAttribute('disabled') != null) return true;
        return false;
    }

    // Focused text entry counts. Selects, read-only fields, and search boxes do not.
    function isTextEntry(el) {
        if (!el || el.nodeType !== 1 || isLocked(el) || isSearchField(el)) return false;
        var tag = String(el.tagName || '').toUpperCase();
        if (tag === 'SELECT') return false;
        if (tag === 'TEXTAREA') return true;
        if (el.isContentEditable) return true;
        if (el.getAttribute && el.getAttribute('contenteditable') === 'true') return true;
        if (tag === 'INPUT') {
            var type = String(el.type || 'text').toLowerCase();
            if (type === 'hidden' || type === 'button' || type === 'submit' || type === 'checkbox' || type === 'radio' || type === 'file' || type === 'range' || type === 'color' || type === 'image' || type === 'search') return false;
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

    function draftText(el) {
        if (!el) return '';
        if (el.value != null && String(el.tagName || '').toUpperCase() !== 'DIV') return String(el.value);
        return String(el.textContent || '');
    }

    function composerDraftBusy() {
        var ids = Object.keys(COMPOSERS);
        var i;
        for (i = 0; i < ids.length; i++) {
            var el = byId(ids[i]);
            if (!el || isLocked(el) || !fieldVisible(el)) continue;
            if (String(draftText(el) || '').trim()) return true;
        }
        return false;
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
        if (isTextEntry(active) && fieldVisible(active)) return true;
        if (active && active === document.activeElement && isSearchField(active) && !isLocked(active) && fieldVisible(active)) return true;
        if (composerDraftBusy()) return true;
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

    function conversationOpen() {
        return !!(modalById('topic-convo-modal', 'convo') || (typeof window.bqTopicConversationOpen === 'function' && window.bqTopicConversationOpen()));
    }

    function capturePlace() {
        if (window._btcQuestReturn) return window._btcQuestReturn;
        var channelId = window.currentChannelId || '';
        var area = byId('topic-discussion-input');
        var draft = area ? String(area.value || '') : '';
        if (!draft && typeof window.bqReadTopicDraft === 'function') draft = String(window.bqReadTopicDraft(channelId) || '');
        if (draft && channelId && typeof window.bqSaveTopicDraft === 'function') window.bqSaveTopicDraft(channelId, draft);
        var active = document && document.activeElement;
        var interrupted = conversationOpen();
        window._btcQuestReturn = {
            channelId: channelId,
            draft: draft,
            interrupted: interrupted,
            focusId: (active && active.id) || ''
        };
        return window._btcQuestReturn;
    }

    window.btcClearQuestReturn = function () {
        window._btcQuestReturn = null;
    };

    function restorePlace() {
        var place = window._btcQuestReturn;
        window._btcQuestReturn = null;
        if (!place || !place.interrupted) return;
        if (place.channelId && window.currentChannelId && place.channelId !== window.currentChannelId) return;
        if (place.draft && place.channelId && typeof window.bqSaveTopicDraft === 'function') {
            window.bqSaveTopicDraft(place.channelId, place.draft);
        }
        if (typeof window.bqRestoreTopicConversation === 'function') {
            window.bqRestoreTopicConversation({ channelId: place.channelId, draft: place.draft, focus: true });
        }
    }

    function hidePill() {
        var pill = byId('btc-quest-pill');
        if (!pill) return;
        pill.hidden = true;
        if (pill.style) pill.style.display = 'none';
    }

    function eventOnPill(event) {
        var pill = byId('btc-quest-pill');
        if (!pill || !event) return false;
        var target = event.target;
        if (!target) return false;
        if (target === pill) return true;
        return typeof pill.contains === 'function' && pill.contains(target);
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
            // Bottom center, above the mobile nav. The home logo is top center.
            pill.style.cssText = 'position:fixed;left:0;right:0;bottom:calc(72px + env(safe-area-inset-bottom, 0px) + 36px);margin:0 auto;width:max-content;max-width:calc(100vw - 32px);z-index:360000;padding:10px 16px;min-height:44px;border-radius:999px;border:1px solid #f7931a;background:#1a1208;color:#fff;font-weight:800;font-family:inherit;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.4);touch-action:manipulation;';
            function takePill(event) {
                if (event && event.preventDefault) event.preventDefault();
                if (event && event.stopPropagation) event.stopPropagation();
                window._btcPointerDown = false;
                window._btcGestureUntil = 0;
                openQueuedNow();
            }
            pill.addEventListener('pointerdown', takePill);
            pill.addEventListener('click', takePill);
            document.body.appendChild(pill);
        }
        pill.hidden = false;
        if (pill.style) pill.style.display = 'block';
    }

    function enqueue(open, id, holdMs, opts) {
        opts = opts || {};
        var key = id || 'quest';
        queue = queue.filter(function (item) { return item.id !== key; });
        queue.push({
            id: key,
            open: open,
            holdUntil: holdMs ? Date.now() + holdMs : 0,
            pillOnly: !!opts.pillOnly
        });
    }

    function openItem(item) {
        hidePill();
        idleSince = 0;
        window._btcPointerDown = false;
        window._btcGestureUntil = 0;
        window._btcQuestBypassBusy = true;
        try { if (item && item.open) item.open(); }
        finally { window._btcQuestBypassBusy = false; }
        if (queue.length) arm();
    }

    function openQueuedNow() {
        if (!queue.length) { hidePill(); return; }
        openItem(queue.shift());
    }

    function runQueue() {
        if (!queue.length) { hidePill(); return; }
        if (window.btcUserBusy()) { hidePill(); arm(); return; }
        var idx = -1;
        var i;
        for (i = 0; i < queue.length; i++) {
            var item = queue[i];
            if (item.pillOnly) continue;
            if (item.holdUntil && Date.now() < item.holdUntil) continue;
            idx = i;
            break;
        }
        if (idx < 0) { showPill(); arm(); return; }
        openItem(queue.splice(idx, 1)[0]);
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
            if (Date.now() - idleSince >= idleDelay()) {
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

    window.btcQueueQuest = function (open, id, holdMs, opts) {
        if (typeof open !== 'function') return;
        capturePlace();
        enqueue(open, id || 'quest', holdMs == null ? REOFFER_MS : holdMs, opts);
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

    // Drop the open class only. Inline display or visibility would hide the
    // shared modal from the quiz picker and the Scholar exam, which only add open.
    window.btcReleaseQuestLayer = function () {
        var modal = byId('questModal');
        if (modal) {
            if (modal.classList) modal.classList.remove('open');
            if (modal.style) {
                modal.style.display = '';
                modal.style.pointerEvents = '';
                modal.style.visibility = '';
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
        if (!quest || window._btcLastQuestDeliberate) return;
        window.btcQueueQuest(function () {
            window._btcQuestBypassBusy = true;
            try {
                if (typeof window.showQuest === 'function') window.showQuest(quest, false);
            } finally {
                window._btcQuestBypassBusy = false;
            }
        }, 'reoffer-quest', 0, { pillOnly: true });
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
        window._btcBubbleQuiz = null;
        window._nachoTriviaXClose = true;
        if (typeof window.hideBubble === 'function') window.hideBubble(true);
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
        window._nachoTriviaXClose = true;
        if (typeof window.hideBubble === 'function') window.hideBubble(true);
        restorePlace();
        window._btcTriviaDismissing = false;
    };

    function tryWrapQuests() {
        if (typeof window.generateAndShowQuest === 'function' && !window.generateAndShowQuest._btcWrapped) {
            var origGen = window.generateAndShowQuest;
            window.generateAndShowQuest = function (manual) {
                window._btcQuestDeliberate = !!manual;
                var args = arguments;
                if (!manual && !window._btcQuestBypassBusy && window.btcUserBusy()) {
                    window._btcQuestDeliberate = false;
                    window.btcDeferQuestIfBusy(function () {
                        window._btcQuestBypassBusy = true;
                        try { origGen.apply(window, args); }
                        finally { window._btcQuestBypassBusy = false; }
                    }, 'auto-quest');
                    return;
                }
                try {
                    return origGen.apply(window, args);
                } finally {
                    window._btcQuestDeliberate = false;
                }
            };
            window.generateAndShowQuest._btcWrapped = true;
        }
        if (typeof window.showQuest === 'function' && !window.showQuest._btcWrapped) {
            var origShow = window.showQuest;
            window.showQuest = function (quest) {
                rememberQuest(quest);
                window._btcLastQuestDeliberate = !!window._btcQuestDeliberate;
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

    function hooksInstalled() {
        return !!(window.generateAndShowQuest && window.generateAndShowQuest._btcWrapped
            && window.showQuest && window.showQuest._btcWrapped
            && window.closeQuest && window.closeQuest._btcWrapped
            && window.skipQuest && window.skipQuest._btcWrapped);
    }

    tryWrapQuests();
    if (!hooksInstalled() && typeof setInterval === 'function') {
        wrapTimer = setInterval(function () {
            tryWrapQuests();
            if (hooksInstalled() && wrapTimer) {
                clearInterval(wrapTimer);
                wrapTimer = null;
            }
        }, 500);
        if (wrapTimer && typeof wrapTimer.unref === 'function') wrapTimer.unref();
    }

    function markGesture() {
        window._btcGestureUntil = Date.now() + GESTURE_MS;
        idleSince = 0;
    }
    function down(event) {
        if (eventOnPill(event)) {
            window._btcPointerDown = false;
            window._btcGestureUntil = 0;
            return;
        }
        window._btcPointerDown = true;
        markGesture();
    }
    function up(event) {
        if (eventOnPill(event)) {
            window._btcPointerDown = false;
            window._btcGestureUntil = 0;
            return;
        }
        window._btcPointerDown = false;
        markGesture();
    }
    on(document, 'pointerdown', down);
    on(document, 'pointerup', up);
    on(document, 'pointercancel', function (event) {
        if (eventOnPill(event)) {
            window._btcPointerDown = false;
            window._btcGestureUntil = 0;
            return;
        }
        window._btcPointerDown = false;
    });
    on(document, 'touchstart', down);
    on(document, 'touchend', up);
    on(document, 'wheel', function (event) {
        if (eventOnPill(event)) return;
        markGesture();
    });
    on(document, 'scroll', function (event) {
        if (eventOnPill(event)) return;
        markGesture();
    });
    on(window, 'scroll', function (event) {
        if (eventOnPill(event)) return;
        markGesture();
    });
})();
