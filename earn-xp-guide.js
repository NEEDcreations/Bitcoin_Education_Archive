// Shared "How to Earn XP" copy. Settings → Sats and the guide FAQ both use this.
// Amounts match the server grant paths. Do not put a number here that those paths do not pay.
(function () {
    var CAP_LINE = 'One daily cap, from 5:00 UTC: full XP through 500, half through 900, then a quarter until 1,000. Extra is not saved. Scholar and Protocol exams are not limited by this cap. Guest XP you already earned, up to 500, does not.';

    var SECTIONS = [
        {
            id: 'ep_read',
            title: '📚 Reading & Exploring',
            items: [
                'Open a new topic: <strong>10 XP</strong>, once each',
                'Explore 10 topics: <strong>50 XP</strong>, once',
                'Exploration milestones: <strong>50, 100, 200, and 500 XP</strong> at 25%, 50%, 75%, and 100%, once each'
            ]
        },
        {
            id: 'ep_daily',
            title: '✅ Daily Activities',
            items: [
                'Daily visit: <strong>5 XP</strong>',
                'Welcome bonus when you sign up: <strong>5 XP</strong>, once',
                'Flex action: <strong>5 XP</strong>. Finish 5 in a day: <strong>50 XP</strong>',
                'Daily spin, once a day: <strong>10, 25, or 50 XP</strong>, or tickets, a freeze, or a closet item. A closet result also pays <strong>25 XP</strong>',
                'Price prediction: <strong>5 XP</strong> to make one. <strong>25 XP</strong> if it is right',
                'Timechain TV: <strong>100 XP</strong> and 1 orange ticket after 10 minutes, once a day',
                'Say hi in chat: <strong>50 XP</strong> and 1 orange ticket, once a day',
                'Daily five (quest, trivia, poll, say hi, and TV): <strong>100 XP</strong> and 1 orange ticket',
                'Proof of Walk: <strong>50 XP per km</strong>, up to 42 km on that activity\'s date',
                'Visit streak badges pay <strong>50, 150, 500, or 2,000 XP</strong>',
                'Double XP doubles every way you earn XP. Sats, orange tickets, and other non-XP rewards stay the same'
            ]
        },
        {
            id: 'ep_quiz',
            title: '🧠 Quizzes & Learning',
            items: [
                'Daily quest: <strong>100 XP</strong> for 5 of 5, <strong>50 XP</strong> for 3 or 4, <strong>25 XP</strong> on a retry. Up to 3 a day. Fewer than 3 right pays nothing',
                'Daily trivia, correct: <strong>50 XP</strong>. A wrong answer pays nothing',
                'Daily poll: <strong>50 XP</strong>, once a day',
                'Daily quest, trivia, and poll on the same day: 1 Satoshi\'s Favor point for the pool, not extra XP',
                'Channel quiz, right answer: <strong>5 XP</strong> in a bubble, <strong>10 XP</strong> in chat',
                'Learning lesson: <strong>50 XP</strong> once for each of the 8 lessons, plus a <strong>50 XP</strong> badge. Finish all eight: a <strong>150 XP</strong> badge',
                'Nacho\'s Story: <strong>15 XP</strong> a chapter, once each (7 chapters). Finish the story: <strong>100 XP</strong>',
                'Scholar exam or Protocol exam, passed: <strong>2,100 XP</strong>, once each, not limited by the daily cap',
                'Starter quest: <strong>25 XP</strong> a step. The quiz step is <strong>50 XP</strong> and 2 orange tickets',
                'Nacho\'s Trails: badges only. Those badges do not pay XP',
                'Asking Nacho: an orange ticket, not XP'
            ]
        },
        {
            id: 'ep_social',
            title: '💬 Community & Social',
            items: [
                'Publish an article: <strong>30 XP</strong>, once per article, up to 2 a day, at least 300 characters and 50 words',
                'Forum post: <strong>10 XP</strong>',
                'Forum reply: <strong>5 XP</strong>',
                'Article comment: <strong>5 XP</strong>',
                'Feedback: <strong>5 XP</strong>',
                'Global chat message: <strong>5 XP</strong>',
                'Chat streak, once each: <strong>10 XP</strong> at 3 days, <strong>25 XP</strong> at 7 days, <strong>100 XP</strong> at 30 days',
                'Topic conversation: <strong>10 XP</strong> to start, <strong>5 XP</strong> to reply, <strong>2 XP</strong> to the starter when someone else replies (up to 5 of those). Conversations stop at <strong>40 XP</strong> a day',
                'Reply to a new person in chat: <strong>50 XP</strong> the first time that day, then <strong>25 XP</strong>, up to 10 a day',
                'Accept a peer request: <strong>10 XP</strong> for each of you, up to 3 a day',
                'Invite a friend: 50 orange tickets each when they reach Maxi, not XP. Referral badges pay <strong>10, 150, 500, or 2,000 XP</strong>'
            ]
        },
        {
            id: 'ep_lightning',
            title: '⚡ Lightning & Marketplace',
            items: [
                'Lightning tip on a tip-challenge day: <strong>100 XP</strong> once, after the payment is confirmed',
                'Save a Lightning address: a <strong>10 XP</strong> badge',
                'First marketplace listing, and first message to a seller: a <strong>10 XP</strong> badge each'
            ]
        },
        {
            id: 'ep_music',
            title: '🎵 Music & Content',
            items: [
                'Listen to a full Beats track: <strong>10 XP</strong>',
                'Upload a track: <strong>50 XP</strong>',
                'Comment on a Beats track: <strong>10 XP</strong>',
                'Upload a batch: <strong>25 XP</strong> per track, and that award stops at <strong>50 XP</strong>'
            ]
        },
        {
            id: 'ep_pvp',
            title: '⚔️ PVP & Competitions',
            items: [
                'Win: <strong>50 XP</strong>, and 1 orange ticket the first win that day',
                'Draw: <strong>5 XP</strong>',
                'Loss after you scored: <strong>25 XP</strong>. A loss with no score pays nothing',
                'Win badges pay <strong>10, 50, 150, or 500 XP</strong>'
            ]
        },
        {
            id: 'ep_gifts',
            title: '🎁 Gifts, Keys & Ciphers',
            items: [
                'Open a gift: it can be <strong>50, 100, or 150 XP</strong>, or tickets, keys, ciphers, or a closet item',
                'A second Nacho shoutout in the same week: <strong>100 XP</strong> instead',
                'Send keys to a peer: <strong>25 XP</strong>',
                'Open a cipher: usually <strong>50 to 250 XP</strong>, and up to 10 orange tickets. Some opens pay sats instead. 21 opens a day',
                'When a peer opens a matching cipher with a key you sent, you both get that same prize',
                'A peer uses your key: <strong>10 XP</strong> for you, up to 3 a day',
                'Peer level-up: each friend gets XP up to whatever still fits in their own 1,000 daily cap. On a fresh day that is <strong>1,000 XP</strong>'
            ]
        },
        {
            id: 'ep_badges',
            title: '🏅 Badges',
            items: [
                'Paying badges are <strong>10, 50, 150, 500, or 2,000 XP</strong>, and each one adds 1 Satoshi\'s Favor point. Some badges are just for show and pay nothing',
                'Milestone badges: <strong>500 XP</strong> at 50 and at 100 badges. <strong>2,000 XP</strong> from 150 badges on'
            ]
        },
        {
            id: 'ep_big',
            title: '🏆 Big Achievements',
            items: [
                'Set your country: a <strong>10 XP</strong> badge',
                'A new rank adds <strong>1, 5, or 10</strong> Satoshi\'s Favor points to the community pool. That is not personal XP',
                'Guest XP moves with you when you sign in, up to <strong>500</strong>. That move does not use the daily cap'
            ]
        }
    ];

    function escapeText(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function plainSectionText(section) {
        return (section.title + '\n' + section.items.join('\n')).replace(/<[^>]+>/g, '').toLowerCase();
    }

    function resolveSectionId(value) {
        var raw = String(value || '').replace(/^#/, '').trim().toLowerCase();
        if (!raw) return '';
        var i;
        for (i = 0; i < SECTIONS.length; i++) {
            if (SECTIONS[i].id === raw) return SECTIONS[i].id;
        }
        if (raw.length < 3) return '';
        for (i = 0; i < SECTIONS.length; i++) {
            if (plainSectionText(SECTIONS[i]).indexOf(raw) !== -1) return SECTIONS[i].id;
        }
        return '';
    }

    function sectionIdFromHash(hash) {
        var raw = String(hash || '').replace(/^#/, '').trim().toLowerCase();
        var i;
        for (i = 0; i < SECTIONS.length; i++) {
            if (SECTIONS[i].id === raw) return SECTIONS[i].id;
        }
        return '';
    }

    function linkedSectionId() {
        if (typeof window._earnXpOpenId === 'string' && window._earnXpOpenId) {
            var pending = resolveSectionId(window._earnXpOpenId);
            if (pending) return pending;
        }
        var hash = '';
        try { hash = (window.location && window.location.hash) || ''; } catch (e) {}
        return sectionIdFromHash(hash);
    }

    function sectionStartsOpen(section, index) {
        var linked = linkedSectionId();
        if (linked) return section.id === linked;
        return index === 0;
    }

    function domId(prefix, id) {
        return (prefix || '') + id;
    }

    function sectionHtml(section, index, prefix) {
        var open = sectionStartsOpen(section, index);
        var items = '';
        for (var i = 0; i < section.items.length; i++) {
            items += '<li style="margin:0 0 10px;">' + section.items[i] + '</li>';
        }
        var label = escapeText(section.title) + ' (' + section.items.length + ')';
        var id = domId(prefix, section.id);
        var buttonId = id + '_btn';
        return '<div class="earn-xp-section" data-earn-section="' + section.id + '" style="margin:0 0 10px;border:1px solid var(--border);border-radius:10px;overflow:hidden;text-align:left;">' +
            '<h3 style="margin:0;font:inherit;font-weight:inherit;">' +
            '<button type="button" id="' + buttonId + '" class="earn-xp-toggle" aria-expanded="' + (open ? 'true' : 'false') + '" aria-controls="' + id + '" style="width:100%;min-height:44px;height:auto;padding:0 14px;box-sizing:border-box;background:rgba(255,255,255,0.03);border:none;cursor:pointer;display:flex;align-items:center;gap:8px;font-family:inherit;touch-action:manipulation;color:var(--text);">' +
            '<span class="earn-xp-chevron" aria-hidden="true"></span>' +
            '<span style="color:var(--text);font-size:15px;font-weight:700;text-align:left;line-height:1.3;">' + label + '</span></button></h3>' +
            '<div id="' + id + '" class="earn-xp-panel" role="region" aria-labelledby="' + buttonId + '"' + (open ? '' : ' hidden') + ' style="padding:12px 14px 4px;font-size:14px;color:var(--text-muted);line-height:1.45;">' +
            '<ul style="margin:0;padding:0 0 0 18px;">' + items + '</ul></div></div>';
    }

    function setSectionOpen(id, open) {
        var btn = document.getElementById(id + '_btn');
        var panel = document.getElementById(id);
        if (!btn || !panel) return false;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) panel.removeAttribute('hidden');
        else panel.setAttribute('hidden', '');
        return true;
    }

    function toggleEarnXpSection(btn) {
        if (!btn || !btn.getAttribute) return;
        var id = btn.getAttribute('aria-controls');
        if (!id) return;
        var open = btn.getAttribute('aria-expanded') === 'true';
        setSectionOpen(id, !open);
    }

    function expandEarnXpPanel() {
        var panel = document.getElementById('earnXPContent');
        var btn = document.getElementById('earnXPToggle');
        if (panel) {
            panel.hidden = false;
            panel.style.display = 'block';
        }
        if (btn) btn.setAttribute('aria-expanded', 'true');
    }

    function toggleEarnXpPanel(btn) {
        var panel = document.getElementById('earnXPContent');
        if (!panel || !btn) return;
        var open = btn.getAttribute('aria-expanded') === 'true';
        var next = !open;
        btn.setAttribute('aria-expanded', next ? 'true' : 'false');
        if (next) {
            panel.hidden = false;
            panel.style.display = 'block';
        } else {
            panel.hidden = true;
            panel.style.display = 'none';
        }
    }

    function openEarnXpSection(idOrQuery) {
        var id = resolveSectionId(idOrQuery);
        if (!id) return false;
        window._earnXpOpenId = id;
        var opened = false;
        try {
            var modal = document.getElementById('usernameModal');
            if (modal) modal.classList.add('open');
            if (!document.getElementById(id) && typeof window.showSettingsPage === 'function') {
                window.showSettingsPage('sats');
            }
            expandEarnXpPanel();
            opened = setSectionOpen(id, true);
            var panel = document.getElementById(id);
            if (panel && panel.scrollIntoView) {
                try { panel.scrollIntoView({ block: 'nearest' }); } catch (e) {}
            }
        } finally {
            window._earnXpOpenId = '';
        }
        return opened;
    }

    function syncEarnXpDisclosures() {
        var id = linkedSectionId();
        if (!id) return false;
        expandEarnXpPanel();
        var opened = setSectionOpen(id, true);
        var panel = document.getElementById(id);
        if (panel && panel.scrollIntoView) {
            try { panel.scrollIntoView({ block: 'nearest' }); } catch (e) {}
        }
        return opened;
    }

    function renderEarnXpGuide(prefix) {
        if (prefix && !/^[A-Za-z0-9_-]+$/.test(prefix)) prefix = '';
        ensureEarnXpStyles();
        var html = '<div style="margin:0 0 12px;font-size:14px;color:var(--text-muted);line-height:1.45;text-align:left;">' + CAP_LINE + '</div>';
        for (var i = 0; i < SECTIONS.length; i++) html += sectionHtml(SECTIONS[i], i, prefix || '');
        return html;
    }

    function ensureEarnXpStyles() {
        if (typeof document === 'undefined' || !document.getElementById || document.getElementById('earnXpDisclosureStyle')) return;
        var style = document.createElement('style');
        style.id = 'earnXpDisclosureStyle';
        style.textContent = '' +
            '.earn-xp-chevron{flex:0 0 16px;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;color:var(--text-faint);}' +
            '.earn-xp-chevron:before{content:"";display:block;width:8px;height:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(-45deg);transform-origin:center;}' +
            '[aria-expanded="true"] > .earn-xp-chevron:before{transform:rotate(45deg);}' +
            '.earn-xp-panel[hidden]{display:none !important;}' +
            '.earn-xp-toggle:focus{outline:none;}' +
            '.earn-xp-toggle:focus-visible{outline:2px solid var(--accent,#f7931a);outline-offset:-2px;}' +
            '#earnXPToggle:focus{outline:none;}' +
            '#earnXPToggle:focus-visible{outline:2px solid var(--accent,#f7931a);outline-offset:-2px;}';
        (document.head || document.documentElement).appendChild(style);
    }

    function onEarnXpClick(event) {
        var btn = event.target && event.target.closest ? event.target.closest('.earn-xp-toggle') : null;
        if (!btn) return;
        if (btn._earnXpFromKey) {
            btn._earnXpFromKey = false;
            return;
        }
        event.stopPropagation();
        toggleEarnXpSection(btn);
    }

    function onEarnXpKey(event) {
        var btn = event.target && event.target.closest ? event.target.closest('.earn-xp-toggle') : null;
        if (!btn) return;
        if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
        event.preventDefault();
        event.stopPropagation();
        btn._earnXpFromKey = true;
        toggleEarnXpSection(btn);
        setTimeout(function () { btn._earnXpFromKey = false; }, 0);
    }

    if (typeof document !== 'undefined' && document.addEventListener) {
        // Capture: Settings stops clicks inside #earnXPContent, so a bubbling
        // listener never sees a tap on a section header.
        document.addEventListener('click', onEarnXpClick, true);
        document.addEventListener('keydown', onEarnXpKey);
        window.addEventListener('hashchange', function () {
            var id = sectionIdFromHash((window.location && window.location.hash) || '');
            if (id) openEarnXpSection(id);
        });
        ensureEarnXpStyles();
        // A #ep_* link is already in the URL on first paint, so hashchange never fires.
        setTimeout(function () {
            var id = sectionIdFromHash((window.location && window.location.hash) || '');
            if (id) openEarnXpSection(id);
        }, 0);
    }

    window.EARN_XP_CAP_LINE = CAP_LINE;
    window.EARN_XP_SECTIONS = SECTIONS;
    window.renderEarnXpGuide = renderEarnXpGuide;
    window.toggleEarnXpSection = toggleEarnXpSection;
    window.toggleEarnXpPanel = toggleEarnXpPanel;
    window.openEarnXpSection = openEarnXpSection;
    window.syncEarnXpDisclosures = syncEarnXpDisclosures;
    window.earnXpSectionStartsOpen = sectionStartsOpen;
})();
