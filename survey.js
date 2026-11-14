// Home-screen notices: the pause heads-up (everyone) and the Citadel Spark
// survey banner + form (signed-in players who haven't taken it).
//
// Pause notice copy is Phil-approved (FINAL_COPY.md, Nov 14 2026). The
// return date is one config value below (RETURN_DATE).
//
// The survey grants nothing on the client. submitSurvey (server) checks App
// Check, rate limit, the kill switch, and grants 25 OrangeTix once per uid.
// Question ids match functions/src/survey.js (tests/test-survey.js checks).
(function () {
    'use strict';

    // ---- Config -----------------------------------------------------------
    // Return date shown in the pause notice and the offline page. Change it
    // here and in kill-switch.js (OFFLINE_RETURN_DATE) together.
    var RETURN_DATE = 'January 3, 2027';
    var SUBSTACK_SUBSCRIBE = 'https://603btc.substack.com/subscribe';
    var SURVEY_ID = 'citadel_spark_2026';
    var REWARD_TICKETS = 25;
    var OPENED_AT_DEFAULT_MS = Date.parse('2026-11-14T18:00:00Z');
    var LAPSED_DAYS = 90;
    var MAX_TEXT = 1000;
    var SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
    var USER_DONE_FIELD = 'surveyDone_' + SURVEY_ID;
    var PAUSE_SNOOZE_KEY = 'bq_pause_notice_snooze_v1';
    var SURVEY_SNOOZE_KEY = 'bq_survey_snooze_' + SURVEY_ID;
    var SURVEY_DONE_KEY = 'bq_survey_done_' + SURVEY_ID;

    var PAUSE_TEXT = 'Bitcoin Quest is taking a short break and returns ' + RETURN_DATE +
        ' with Citadels, our biggest update yet, plus Premium. Your XP, badges and progress are saved exactly as they are. ' +
        'Unclaimed Satoshi\'s Favor rewards stay on your account until we\'re back. Get an email the moment we\'re back.';
    var PAUSE_BUTTON = 'Get email updates';

    var SURVEY_TITLE = 'Citadel Spark survey';
    var SURVEY_BANNER = 'Help shape Citadel Spark. Take a 3-minute survey and get ' + REWARD_TICKETS + ' OrangeTix.';
    var SURVEY_BANNER_BUTTON = 'Take the survey';
    var SURVEY_INTRO = 'About 3 minutes. Only the first question is required. Send your answers and get ' + REWARD_TICKETS + ' OrangeTix, once per account.';
    // Accounts created after the survey opened get no OrangeTix (server-side
    // rule in functions/src/survey.js). They see copy with no reward promise.
    var SURVEY_BANNER_PLAIN = 'Help shape Citadel Spark. Take a 3-minute survey.';
    var SURVEY_INTRO_PLAIN = 'About 3 minutes. Only the first question is required.';
    var DONE_PLAIN = 'Thanks! Your answers are saved.';

    // Display copy. Ids and option keys must match functions/src/survey.js.
    var QUESTIONS = {
        q1: { type: 'single', required: true, text: 'How did you first find the app?',
            options: [['friend', 'A friend'], ['x', 'X'], ['youtube', 'YouTube'], ['search', 'Search'], ['meetup', 'Meetup or event'], ['school', 'School'], ['other', 'Other']] },
        q2: { type: 'multi', text: 'What keeps you coming back?', hint: 'Pick any.',
            options: [['lessons', 'Lessons'], ['quests', 'Quests'], ['rewards', 'Rewards'], ['nook', 'Nook'], ['ciphers', 'Ciphers'], ['chat', 'Chat'], ['other', 'Other']] },
        q3: { type: 'text', text: 'What\u2019s the most frustrating part right now?' },
        q4: { type: 'scale', min: 1, max: 5, text: 'How easy are the lessons to follow?', low: 'Hard', high: 'Easy' },
        q5: { type: 'text', text: 'Which topics should we add next?' },
        q6: { type: 'scale', min: 1, max: 5, text: 'How much do the rewards matter to why you play?', low: 'Not at all', high: 'A lot' },
        q8: { type: 'single', text: 'Would you play a build-and-defend mode where you build a Citadel and defend it from scam-coin raiders?',
            options: [['yes', 'Yes'], ['maybe', 'Maybe'], ['no', 'No']] },
        q9: { type: 'single', text: 'Which would you use most?',
            options: [['building', 'Building'], ['defending', 'Defending'], ['raiding', 'Raiding others'], ['decorating', 'Decorating']] },
        q10: { type: 'multi', exclusive: 'none', text: 'Which paid extras would you consider?', hint: 'Pick any.',
            options: [['cosmetics', 'Cosmetics'], ['build_space', 'Extra build space'], ['rewards_limit', 'A raised rewards limit'], ['none', 'None']] },
        q11: { type: 'scale', min: 0, max: 10, text: 'How likely are you to recommend the app to a friend?', low: 'Not likely', high: 'Very likely' },
        q12: { type: 'text', text: 'Anything else we should know?' },
        stop: { type: 'text', text: 'What made you stop?' }
    };
    var VARIANTS = {
        full: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q8', 'q9', 'q10', 'q11', 'q12'],
        lapsed: ['q1', 'q3', 'q8', 'q12', 'stop']
    };
    // Lapsed players see "What made you stop?" right after Q1.
    var LAPSED_ORDER = ['q1', 'stop', 'q3', 'q8', 'q12'];

    var state = {
        uid: null,
        anon: true,
        done: false,
        lapsed: false,
        closed: false,
        userChecked: false
    };

    // ---- Helpers ------------------------------------------------------------
    function now() { return Date.now(); }
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
    function snoozed(k) {
        var t = Number(lsGet(k) || 0);
        return t > 0 && now() - t < SNOOZE_MS;
    }
    function toMillis(v) {
        if (!v) return null;
        if (typeof v === 'number') return v;
        if (typeof v.toMillis === 'function') return v.toMillis();
        if (typeof v.seconds === 'number') return v.seconds * 1000;
        return null;
    }
    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }
    function cleanRef(v) {
        var s = String(v || '').trim();
        return /^[A-Za-z0-9_-]{1,40}$/.test(s) ? s : '';
    }
    function currentRef() {
        var r = '';
        try { r = new URLSearchParams(location.search).get('ref') || ''; } catch (e) { r = ''; }
        return cleanRef(r) || cleanRef(lsGet('btc_referral_code'));
    }
    function pauseLink() {
        var ref = currentRef();
        return SUBSTACK_SUBSCRIBE + '?utm_source=app&utm_medium=pause_notice&utm_campaign=' + encodeURIComponent(ref || 'pause_notice');
    }
    function offline() { return window._bqKillSwitchOn === true; }

    // Same rule as the server (functions/src/survey.js closedReason).
    function closedFrom(ks, cfg) {
        cfg = cfg || {};
        if (cfg.closed === true) return true;
        var openedAt = toMillis(cfg.openedAt) || OPENED_AT_DEFAULT_MS;
        if (ks && ks.enabled === true) {
            var until = toMillis(ks.autoReenableAt);
            if (!until || now() < until) return true;
        }
        var since = ks ? toMillis(ks.since) : null;
        return !!(since && since > openedAt);
    }

    function ensureStyle() {
        if (document.getElementById('bqNoticeStyle')) return;
        var s = document.createElement('style');
        s.id = 'bqNoticeStyle';
        s.textContent =
            '.bq-notice{position:relative;display:flex;flex-direction:column;gap:10px;text-align:left;margin:0 auto 14px;max-width:640px;padding:14px 44px 14px 16px;border-radius:14px;font-family:inherit;line-height:1.45;box-sizing:border-box;}' +
            '.bq-notice p{margin:0;font-size:0.95rem;}' +
            '.bq-notice-pause{background:#1a1408;color:#fde68a;border:1px solid #f7931a;}' +
            '.bq-notice-survey{background:#0f1b33;color:#dbeafe;border:1px solid #3b82f6;}' +
            '.bq-notice-kicker{font-size:0.72rem !important;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;opacity:0.85;}' +
            '.bq-notice-actions{display:flex;flex-wrap:wrap;gap:8px;}' +
            '.bq-notice-btn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:8px 14px;border-radius:10px;font-weight:700;font-size:0.92rem;text-decoration:none;cursor:pointer;font-family:inherit;border:0;}' +
            '.bq-notice-pause .bq-notice-btn{background:#f7931a;color:#111;}' +
            '.bq-notice-survey .bq-notice-btn{background:#3b82f6;color:#fff;}' +
            '.bq-notice-x{position:absolute;top:6px;right:6px;width:36px;height:36px;border:0;background:transparent;color:inherit;font-size:1.3rem;line-height:1;cursor:pointer;border-radius:8px;opacity:0.75;}' +
            '.bq-notice-x:hover,.bq-notice-x:focus-visible{opacity:1;background:rgba(255,255,255,0.08);}' +
            '#bqSurveyModal{position:fixed;inset:0;z-index:450000;background:rgba(3,7,18,0.82);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 12px;box-sizing:border-box;}' +
            '#bqSurveyModal .bqs-card{width:100%;max-width:600px;background:#0b1220;color:#e2e8f0;border:1px solid #334155;border-radius:16px;padding:20px 18px;box-sizing:border-box;font-family:inherit;text-align:left;}' +
            '#bqSurveyModal h2{margin:0 0 6px;font-size:1.3rem;color:#fff;}' +
            '#bqSurveyModal .bqs-intro{margin:0 0 16px;color:#94a3b8;font-size:0.92rem;line-height:1.45;}' +
            '#bqSurveyModal fieldset{border:0;margin:0 0 18px;padding:0;}' +
            '#bqSurveyModal legend{font-weight:700;font-size:0.98rem;line-height:1.4;margin-bottom:8px;color:#f1f5f9;padding:0;}' +
            '#bqSurveyModal .bqs-hint{font-weight:400;color:#94a3b8;font-size:0.85rem;}' +
            '#bqSurveyModal .bqs-opts{display:flex;flex-wrap:wrap;gap:8px;}' +
            '#bqSurveyModal .bqs-opt{position:relative;display:inline-flex;}' +
            '#bqSurveyModal .bqs-opt input{position:absolute;opacity:0;width:1px;height:1px;}' +
            '#bqSurveyModal .bqs-opt span{display:inline-flex;align-items:center;justify-content:center;min-width:40px;min-height:38px;padding:6px 12px;border:1px solid #475569;border-radius:999px;font-size:0.9rem;cursor:pointer;user-select:none;}' +
            '#bqSurveyModal .bqs-opt input:checked + span{background:#f7931a;border-color:#f7931a;color:#111;font-weight:700;}' +
            '#bqSurveyModal .bqs-opt input:focus-visible + span{outline:2px solid #93c5fd;outline-offset:2px;}' +
            '#bqSurveyModal .bqs-scale-ends{display:flex;justify-content:space-between;font-size:0.78rem;color:#94a3b8;margin-top:4px;}' +
            '#bqSurveyModal textarea{width:100%;min-height:76px;box-sizing:border-box;border-radius:10px;border:1px solid #475569;background:#111827;color:#e2e8f0;padding:10px;font-family:inherit;font-size:0.95rem;resize:vertical;}' +
            '#bqSurveyModal .bqs-err{color:#fca5a5;font-size:0.9rem;min-height:1.2em;margin:4px 0 10px;}' +
            '#bqSurveyModal .bqs-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;}' +
            '#bqSurveyModal .bqs-actions button{min-height:42px;padding:8px 16px;border-radius:10px;font-weight:700;font-family:inherit;cursor:pointer;font-size:0.95rem;}' +
            '#bqSurveyModal .bqs-send{background:#f7931a;border:0;color:#111;}' +
            '#bqSurveyModal .bqs-send[disabled]{opacity:0.6;cursor:default;}' +
            '#bqSurveyModal .bqs-cancel{background:transparent;border:1px solid #475569;color:#e2e8f0;}' +
            '#bqSurveyModal .bqs-done{text-align:center;padding:16px 0;}' +
            '#bqSurveyModal .bqs-done p{font-size:1.05rem;line-height:1.5;margin:0 0 16px;}';
        (document.head || document.documentElement).appendChild(s);
    }

    function homeSlot() {
        var home = document.getElementById('home');
        if (!home) return null;
        var inner = home.querySelector('.home-inner') || home;
        var slot = document.getElementById('bqHomeNotices');
        if (!slot) {
            slot = el('div');
            slot.id = 'bqHomeNotices';
            var chip = document.getElementById('homeSignedInChip');
            if (chip && chip.parentNode === inner) inner.insertBefore(slot, chip.nextSibling);
            else inner.insertBefore(slot, inner.firstChild);
        }
        return slot;
    }

    function removeById(id) {
        var e = document.getElementById(id);
        if (e && e.parentNode) e.parentNode.removeChild(e);
    }

    // ---- Pause notice (everyone) ------------------------------------------
    function renderPause() {
        if (offline() || snoozed(PAUSE_SNOOZE_KEY)) { removeById('bqPauseNotice'); return; }
        if (document.getElementById('bqPauseNotice')) return;
        var slot = homeSlot();
        if (!slot) return;
        ensureStyle();
        var box = el('section', 'bq-notice bq-notice-pause');
        box.id = 'bqPauseNotice';
        box.setAttribute('role', 'region');
        box.setAttribute('aria-label', 'App update');
        box.appendChild(el('p', 'bq-notice-text', PAUSE_TEXT));
        var actions = el('div', 'bq-notice-actions');
        var a = el('a', 'bq-notice-btn', PAUSE_BUTTON);
        a.href = pauseLink();
        a.target = '_blank';
        a.rel = 'noopener';
        actions.appendChild(a);
        box.appendChild(actions);
        var x = el('button', 'bq-notice-x', '\u00D7');
        x.type = 'button';
        x.setAttribute('aria-label', 'Dismiss');
        x.addEventListener('click', function () {
            lsSet(PAUSE_SNOOZE_KEY, String(now()));
            removeById('bqPauseNotice');
        });
        box.appendChild(x);
        slot.insertBefore(box, slot.firstChild);
    }

    // ---- Survey banner ------------------------------------------------------
    // Display hint only; the server decides the grant.
    function rewardShown() {
        var opened = state.openedAt || OPENED_AT_DEFAULT_MS;
        return !!(state.createdMs && state.createdMs < opened);
    }

    function surveyEligible() {
        return !!(state.uid && !state.anon && state.userChecked && !state.done && !state.closed && !offline()
            && lsGet(SURVEY_DONE_KEY) !== state.uid);
    }

    function renderSurveyBanner() {
        if (!surveyEligible() || snoozed(SURVEY_SNOOZE_KEY)) { removeById('bqSurveyBanner'); return; }
        if (document.getElementById('bqSurveyBanner')) return;
        var slot = homeSlot();
        if (!slot) return;
        ensureStyle();
        var box = el('section', 'bq-notice bq-notice-survey');
        box.id = 'bqSurveyBanner';
        box.setAttribute('role', 'region');
        box.setAttribute('aria-label', SURVEY_TITLE);
        box.appendChild(el('p', 'bq-notice-kicker', SURVEY_TITLE));
        box.appendChild(el('p', 'bq-notice-text', rewardShown() ? SURVEY_BANNER : SURVEY_BANNER_PLAIN));
        var actions = el('div', 'bq-notice-actions');
        var b = el('button', 'bq-notice-btn', SURVEY_BANNER_BUTTON);
        b.type = 'button';
        b.addEventListener('click', openSurvey);
        actions.appendChild(b);
        box.appendChild(actions);
        var x = el('button', 'bq-notice-x', '\u00D7');
        x.type = 'button';
        x.setAttribute('aria-label', 'Dismiss');
        x.addEventListener('click', function () {
            lsSet(SURVEY_SNOOZE_KEY, String(now()));
            removeById('bqSurveyBanner');
        });
        box.appendChild(x);
        var pause = document.getElementById('bqPauseNotice');
        if (pause && pause.parentNode === slot) slot.insertBefore(box, pause.nextSibling);
        else slot.appendChild(box);
    }

    // ---- Survey form --------------------------------------------------------
    function buildQuestion(id, n) {
        var q = QUESTIONS[id];
        var fs = el('fieldset');
        fs.setAttribute('data-q', id);
        var legend = el('legend');
        legend.appendChild(document.createTextNode(n + '. ' + q.text + ' '));
        if (q.required) legend.appendChild(el('span', 'bqs-hint', '(required)'));
        else if (q.hint) legend.appendChild(el('span', 'bqs-hint', q.hint));
        fs.appendChild(legend);
        if (q.type === 'text') {
            var ta = el('textarea');
            ta.name = id;
            ta.maxLength = MAX_TEXT;
            ta.setAttribute('aria-label', q.text);
            fs.appendChild(ta);
            return fs;
        }
        var opts = el('div', 'bqs-opts');
        var list = q.options;
        if (q.type === 'scale') {
            list = [];
            for (var i = q.min; i <= q.max; i++) list.push([String(i), String(i)]);
        }
        list.forEach(function (o) {
            var lab = el('label', 'bqs-opt');
            var inp = el('input');
            inp.type = q.type === 'multi' ? 'checkbox' : 'radio';
            inp.name = id;
            inp.value = o[0];
            if (q.type === 'multi' && q.exclusive) {
                inp.addEventListener('change', function () {
                    if (!inp.checked) return;
                    var all = fs.querySelectorAll('input[name="' + id + '"]');
                    for (var k = 0; k < all.length; k++) {
                        var other = all[k];
                        if (other === inp) continue;
                        if (inp.value === q.exclusive || other.value === q.exclusive) other.checked = false;
                    }
                });
            }
            lab.appendChild(inp);
            lab.appendChild(el('span', null, o[1]));
            opts.appendChild(lab);
        });
        fs.appendChild(opts);
        if (q.type === 'scale') {
            var ends = el('div', 'bqs-scale-ends');
            ends.appendChild(el('span', null, q.min + ' = ' + q.low));
            ends.appendChild(el('span', null, q.max + ' = ' + q.high));
            fs.appendChild(ends);
        }
        return fs;
    }

    function collect(form, variant) {
        var answers = {};
        VARIANTS[variant].forEach(function (id) {
            var q = QUESTIONS[id];
            if (q.type === 'text') {
                var ta = form.querySelector('textarea[name="' + id + '"]');
                var v = ta ? ta.value.trim() : '';
                if (v) answers[id] = v.slice(0, MAX_TEXT);
            } else if (q.type === 'multi') {
                var picked = [];
                var boxes = form.querySelectorAll('input[name="' + id + '"]:checked');
                for (var i = 0; i < boxes.length; i++) picked.push(boxes[i].value);
                if (picked.length) answers[id] = picked;
            } else {
                var r = form.querySelector('input[name="' + id + '"]:checked');
                if (r) answers[id] = q.type === 'scale' ? Number(r.value) : r.value;
            }
        });
        return answers;
    }

    function closeSurvey() {
        removeById('bqSurveyModal');
        document.removeEventListener('keydown', onKey, true);
    }
    function onKey(e) { if (e.key === 'Escape') closeSurvey(); }

    function showDone(card, message) {
        while (card.firstChild) card.removeChild(card.firstChild);
        var d = el('div', 'bqs-done');
        d.appendChild(el('h2', null, SURVEY_TITLE));
        d.appendChild(el('p', null, message));
        var ok = el('button', 'bqs-send', 'Done');
        ok.type = 'button';
        ok.style.cssText = 'min-height:42px;padding:8px 20px;border-radius:10px;font-weight:700;border:0;background:#f7931a;color:#111;cursor:pointer;font-family:inherit;';
        ok.addEventListener('click', closeSurvey);
        d.appendChild(ok);
        card.appendChild(d);
        ok.focus();
    }

    function openSurvey() {
        if (document.getElementById('bqSurveyModal')) return;
        ensureStyle();
        var variant = state.lapsed ? 'lapsed' : 'full';
        var modal = el('div');
        modal.id = 'bqSurveyModal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'bqSurveyTitle');
        var card = el('div', 'bqs-card');
        var h = el('h2', null, SURVEY_TITLE);
        h.id = 'bqSurveyTitle';
        card.appendChild(h);
        if (!state.uid || state.anon) {
            showDone(card, 'Sign in to take the survey.');
            modal.appendChild(card);
            document.body.appendChild(modal);
            return;
        }
        if (state.done || lsGet(SURVEY_DONE_KEY) === state.uid) {
            showDone(card, 'You\u2019ve already taken the survey. Thanks!');
            modal.appendChild(card);
            document.body.appendChild(modal);
            return;
        }
        if (state.closed || offline()) {
            showDone(card, 'The survey is closed. Thanks for playing!');
            modal.appendChild(card);
            document.body.appendChild(modal);
            return;
        }
        card.appendChild(el('p', 'bqs-intro', rewardShown() ? SURVEY_INTRO : SURVEY_INTRO_PLAIN));
        var form = el('form');
        form.noValidate = true;
        var order = variant === 'lapsed' ? LAPSED_ORDER : VARIANTS.full;
        order.forEach(function (id, i) { form.appendChild(buildQuestion(id, i + 1)); });
        var err = el('div', 'bqs-err');
        err.setAttribute('role', 'alert');
        form.appendChild(err);
        var actions = el('div', 'bqs-actions');
        var cancel = el('button', 'bqs-cancel', 'Not now');
        cancel.type = 'button';
        cancel.addEventListener('click', closeSurvey);
        var send = el('button', 'bqs-send', 'Send my answers');
        send.type = 'submit';
        actions.appendChild(cancel);
        actions.appendChild(send);
        form.appendChild(actions);
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            err.textContent = '';
            var answers = collect(form, variant);
            if (!answers.q1) {
                err.textContent = 'Please answer question 1.';
                var first = form.querySelector('input[name="q1"]');
                if (first) first.focus();
                return;
            }
            send.disabled = true;
            send.textContent = 'Sending\u2026';
            var call;
            try { call = firebase.functions().httpsCallable('submitSurvey'); }
            catch (ex) { call = null; }
            if (!call) {
                send.disabled = false;
                send.textContent = 'Send my answers';
                err.textContent = 'Could not reach the server. Try again in a moment.';
                return;
            }
            call({ surveyId: SURVEY_ID, variant: variant, answers: answers }).then(function (res) {
                var d = (res && res.data) || {};
                state.done = true;
                lsSet(SURVEY_DONE_KEY, state.uid);
                removeById('bqSurveyBanner');
                if (d.already) showDone(card, 'You\u2019ve already taken the survey. Thanks!');
                else if (d.granted === false || !d.tickets) showDone(card, DONE_PLAIN);
                else showDone(card, 'Thanks! ' + d.tickets + ' OrangeTix are on your account.');
            }, function (ex) {
                send.disabled = false;
                send.textContent = 'Send my answers';
                var code = ex && ex.code ? String(ex.code).replace(/^functions\//, '') : '';
                if (code === 'failed-precondition' && ex.message && /closed/i.test(ex.message)) {
                    state.closed = true;
                    removeById('bqSurveyBanner');
                    showDone(card, 'The survey is closed. Thanks for playing!');
                    return;
                }
                if (code === 'unavailable') { err.textContent = 'The app is offline right now. Try again later.'; return; }
                if (code === 'resource-exhausted') { err.textContent = 'Too many tries. Wait a few minutes and try again.'; return; }
                err.textContent = (ex && ex.message && code !== 'internal') ? ex.message : 'Something went wrong. Try again in a moment.';
            });
        });
        card.appendChild(form);
        modal.appendChild(card);
        modal.addEventListener('click', function (e) { if (e.target === modal) closeSurvey(); });
        document.addEventListener('keydown', onKey, true);
        document.body.appendChild(modal);
        var focus = form.querySelector('input,textarea');
        if (focus) focus.focus();
    }

    // ---- Data -----------------------------------------------------------------
    function loadConfig() {
        if (typeof firebase === 'undefined' || !firebase.firestore) return;
        var db;
        try { db = firebase.firestore(); } catch (e) { return; }
        Promise.all([
            db.doc('config/killSwitch').get().then(function (s) { return s.exists ? s.data() : null; }, function () { return null; }),
            db.doc('config/survey').get().then(function (s) { return s.exists ? s.data() : null; }, function () { return null; })
        ]).then(function (r) {
            state.closed = closedFrom(r[0], r[1]);
            state.openedAt = toMillis(r[1] && r[1].openedAt) || OPENED_AT_DEFAULT_MS;
            removeById('bqSurveyBanner');
            renderAll();
        });
    }

    function loadUser(user) {
        state.uid = user ? user.uid : null;
        state.anon = !user || user.isAnonymous === true;
        state.userChecked = false;
        state.done = false;
        state.lapsed = false;
        state.createdMs = user ? (Date.parse((user.metadata && user.metadata.creationTime) || '') || 0) : 0;
        removeById('bqSurveyBanner');
        if (!user || state.anon) { renderAll(); return; }
        var db;
        try { db = firebase.firestore(); } catch (e) { return; }
        db.collection('users').doc(user.uid).get().then(function (snap) {
            if (state.uid !== user.uid) return;
            var d = snap.exists ? (snap.data() || {}) : {};
            state.done = !!d[USER_DONE_FIELD];
            var last = toMillis(d.lastVisit) || toMillis(d.lastActive);
            state.lapsed = !!(last && now() - last > LAPSED_DAYS * 24 * 60 * 60 * 1000);
            state.userChecked = true;
            renderAll();
        }, function () {
            state.userChecked = true;
            renderAll();
        });
    }

    function renderAll() {
        renderPause();
        renderSurveyBanner();
    }

    var booted = false;
    function boot() {
        if (booted) return;
        if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) return;
        booted = true;
        loadConfig();
        try { firebase.auth().onAuthStateChanged(loadUser); } catch (e) { /* auth not ready */ }
        if (location.hash === '#survey') setTimeout(openSurvey, 1500);
    }

    function start() {
        renderPause();
        boot();
        var tries = 0;
        var t = setInterval(function () {
            tries++;
            if (!booted) boot();
            renderAll();
            if ((booted && tries > 8) || tries > 60) clearInterval(t);
        }, 500);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();

    window.bqOpenSurvey = openSurvey;
    window.bqRefreshHomeNotices = renderAll;
    window.bqSurveySpec = { id: SURVEY_ID, questions: QUESTIONS, variants: VARIANTS, lapsedOrder: LAPSED_ORDER, returnDate: RETURN_DATE, pauseText: PAUSE_TEXT };
})();
