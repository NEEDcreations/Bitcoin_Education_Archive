// Shared "How to Earn XP" copy. Settings → Sats and the guide FAQ both use this.
// Amounts match the server grant paths. Do not put a number here that those paths do not pay.
(function () {
    var CAP_LINE = 'One daily cap, from 5:00 UTC: full XP through 500, half through 900, then a quarter until 1,000. Extra is not saved. Exam XP uses this cap. Guest XP you already earned, up to 500, does not.';

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
                'Double XP hour doubles reading, visits, chat, forum, Beats, flex, lessons, story, a prediction you make, the channel quiz, the tip challenge, and sending keys',
                'These stay at the amounts above: quests, trivia, polls, a correct prediction, TV, say hi, the daily five, walks, gifts, ciphers, badges, exams, the wheel, the starter quest, peer rewards, and topic and reply bonuses'
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
                'Scholar exam or Protocol exam, passed: <strong>2,100 XP</strong>, once each. It counts toward the daily cap',
                'Starter quest: <strong>25 XP</strong> a step. The quiz step is <strong>50 XP</strong> and 2 orange tickets',
                'Nacho\'s Trails: badges only. Those badges do not pay XP',
                'Asking Nacho: an orange ticket, not XP'
            ]
        },
        {
            id: 'ep_social',
            title: '💬 Community & Social',
            items: [
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
                'Peer level-up: both friends get <strong>3,000, 21,000, 44,000, 50,000, or 100,000 XP</strong> on the books. Only what fits in today\'s cap is kept'
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

    function sectionHtml(section) {
        return '<div style="margin-bottom:6px;border:1px solid var(--border);border-radius:10px;overflow:hidden;">' +
            '<button onclick="event.stopPropagation();var c=document.getElementById(\'' + section.id + '\');c.style.display=c.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'.ea\').textContent=c.style.display===\'none\'?\'▶\':\'▼\'" style="width:100%;padding:10px 12px;background:rgba(255,255,255,0.03);border:none;cursor:pointer;display:flex;align-items:center;gap:8px;font-family:inherit;touch-action:manipulation;">' +
            '<span class="ea" style="color:var(--text-faint);font-size:0.7rem;">▶</span>' +
            '<span style="color:var(--text);font-size:0.8rem;font-weight:700;">' + section.title + '</span></button>' +
            '<div id="' + section.id + '" style="display:none;padding:8px 12px 10px;font-size:0.76rem;color:var(--text-muted);line-height:1.7;">' + section.items.join('<br>') + '</div></div>';
    }

    function renderEarnXpGuide() {
        var html = '<div style="margin:0 0 10px;font-size:0.76rem;color:var(--text-muted);line-height:1.55;">' + CAP_LINE + '</div>';
        for (var i = 0; i < SECTIONS.length; i++) html += sectionHtml(SECTIONS[i]);
        return html;
    }

    window.EARN_XP_CAP_LINE = CAP_LINE;
    window.EARN_XP_SECTIONS = SECTIONS;
    window.renderEarnXpGuide = renderEarnXpGuide;
})();
