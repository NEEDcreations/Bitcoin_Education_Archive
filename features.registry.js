// Bitcoin Quest feature registry — single source of truth for search, Nacho, and deep links.
// Loaded after bundle.min.js. Also usable from Node (require).
(function (root) {
    'use strict';
    var win = (typeof window !== 'undefined') ? window : root;

    function armHubLock(tab, sub) {
        win._bqHubLock = { tab: tab, sub: sub || '', until: Date.now() + 2500 };
        win._questHubTab = tab;
        if (sub) win._nookSubTab = sub;
    }
    function reapplyHubLock(tab, sub) {
        setTimeout(function () {
            var lock = win._bqHubLock;
            if (!lock || lock.tab !== tab || Date.now() > lock.until) return;
            win._questHubTab = tab;
            if (sub) win._nookSubTab = sub;
            if (typeof win._renderQuestHubTab === 'function') win._renderQuestHubTab();
        }, 400);
    }
    function questOpen(tab, sub) {
        return function () {
            if (typeof win.showQuestHub === 'function') win.showQuestHub();
            win._questHubTab = tab;
            if (sub) win._nookSubTab = sub;
            setTimeout(function () {
                if (typeof win._renderQuestHubTab === 'function') win._renderQuestHubTab();
            }, 80);
        };
    }
    function settingsOpen(page) {
        return function () {
            if (page === 'peers') {
                if (typeof win.showSettings === 'function') win.showSettings();
                setTimeout(function () {
                    if (typeof win.showSettingsPage === 'function') win.showSettingsPage('account');
                    setTimeout(function () {
                        var p = document.getElementById('peersSectionContent');
                        if (p) { p.style.display = 'block'; try { p.scrollIntoView({ block: 'center' }); } catch (e) {} }
                    }, 220);
                }, 80);
                return;
            }
            if (typeof win.showSettings === 'function') win.showSettings();
            if (page) setTimeout(function () {
                if (typeof win.showSettingsPage === 'function') win.showSettingsPage(page);
            }, 90);
        };
    }
    function goOpen(id) {
        return function () { if (typeof win.go === 'function') win.go(id); };
    }

    // kind -> opener. Each function body names a real app function so tests can see the call.
    function makeOpen(f) {
        var k = f.kind;
        if (k === 'home') return function () { if (typeof win.goHome === 'function') win.goHome(); };
        if (k === 'go') return goOpen(f.arg);
        if (k === 'quest') return questOpen(f.arg, f.arg2 || '');
        if (k === 'settings') return settingsOpen(f.arg || '');
        if (k === 'spin') return function () { if (typeof win.showSpinWheel === 'function') win.showSpinWheel(); };
        if (k === 'story') return function () { if (typeof win.showNachoStory === 'function') win.showNachoStory(); };
        if (k === 'nacho') return function () { if (typeof win.enterNachoMode === 'function') win.enterNachoMode(); };
        if (k === 'mini') return function () { if (typeof win.showNachoInput === 'function') win.showNachoInput(); };
        if (k === 'quiz') return function () { if (typeof win.nachoQuizMe === 'function') win.nachoQuizMe(); };
        if (k === 'eli5') return function () {
            if (typeof win.enterNachoMode === 'function') win.enterNachoMode();
            setTimeout(function () { if (typeof win.showEli5Prompt === 'function') win.showEli5Prompt(); }, 200);
        };
        if (k === 'closet') return function () {
            if (typeof win.openNachoCloset === 'function') { win.openNachoCloset(); return; }
            if (typeof win.showSettings === 'function') win.showSettings();
            setTimeout(function () {
                if (typeof win.showSettingsPage === 'function') win.showSettingsPage('prefs');
                var t = document.querySelector('[onclick*="nacho"]');
                if (t && t.click) t.click();
            }, 200);
        };
        if (k === 'lb') return function () {
            if (typeof win.toggleLeaderboard === 'function') win.toggleLeaderboard();
            else if (typeof win.showLeaderboardAuto === 'function') win.showLeaderboardAuto();
        };
        if (k === 'predict') return function () { if (typeof win.showPricePrediction === 'function') win.showPricePrediction(); };
        if (k === 'pvp') return function () { if (typeof win.enterPVPMode === 'function') win.enterPVPMode(); };
        if (k === 'pop') return function () { if (typeof win.enterProofOfPlay === 'function') win.enterProofOfPlay(); };
        if (k === 'pow') return function () {
            if (typeof win.renderProofOfWalk === 'function') win.renderProofOfWalk();
            else if (typeof win.showProofOfWalk === 'function') win.showProofOfWalk();
        };
        if (k === 'powsupport') return function () { if (typeof win.renderPOWSupport === 'function') win.renderPOWSupport(); };
        if (k === 'chat') return function () {
            if (typeof win.renderChatHub === 'function') win.renderChatHub('global');
            else if (typeof win.toggleChatOverlay === 'function') win.toggleChatOverlay();
            else if (typeof win.openGlobalChatForCipher === 'function') win.openGlobalChatForCipher();
        };
        if (k === 'sayhi') return function () {
            if (typeof win.openSayHi === 'function') win.openSayHi();
        };
        if (k === 'invite') return function () {
            if (typeof win.openInviteFriends === 'function') win.openInviteFriends(true);
        };
        if (k === 'dms') return function () {
            if (typeof win.showInbox === 'function') win.showInbox();
            else if (typeof win.renderChatHub === 'function') win.renderChatHub('dms');
            else if (typeof win.openDM === 'function') win.openDM();
        };
        if (k === 'buddy') return function () {
            if (typeof win.showBuddyFinder === 'function') win.showBuddyFinder();
            else if (typeof win.renderChatHub === 'function') win.renderChatHub('global');
        };
        if (k === 'donate') return function () { if (typeof win.showDonateModal === 'function') win.showDonateModal(); };
        if (k === 'faq') return function () {
            if (typeof win.showFAQ === 'function') win.showFAQ();
            else if (typeof win.showGuide === 'function') win.showGuide();
        };
        if (k === 'guide') return function () { if (typeof win.showGuide === 'function') win.showGuide(); };
        if (k === 'keyshelp') return function () { if (typeof win.showKeyboardHelp === 'function') win.showKeyboardHelp(); };
        if (k === 'notif') return function () { if (typeof win.showNotifications === 'function') win.showNotifications(); };
        if (k === 'signin') return function () { if (typeof win.showUsernamePrompt === 'function') win.showUsernamePrompt(); };
        if (k === 'onboarding') return function () { if (typeof win.showOnboardingIntro === 'function') win.showOnboardingIntro({ force: true }); };
        if (k === 'tip') return function () { if (typeof win.showTipOverlay === 'function') win.showTipOverlay(); };
        if (k === 'dash') return function () {
            if (typeof win.toggleDashboard === 'function') win.toggleDashboard();
            else if (typeof win.go === 'function') win.go('bitcoin-dashboard');
        };
        if (k === 'meme') return function () {
            if (typeof win.goRandomMeme === 'function') win.goRandomMeme();
            else if (typeof win.goRandom === 'function') win.goRandom();
        };
        if (k === 'random') return function () { if (typeof win.goRandom === 'function') win.goRandom(); };
        if (k === 'art') return function () { if (typeof win.goRandomArt === 'function') win.goRandomArt(); };
        if (k === 'graphic') return function () { if (typeof win.goRandomGraphic === 'function') win.goRandomGraphic(); };
        if (k === 'favor') return function () {
            if (typeof win.openSatoshiFavorMiner === 'function') win.openSatoshiFavorMiner();
            if (typeof win.showQuestHub === 'function') win.showQuestHub();
            win._questHubTab = 'favor';
            setTimeout(function () { if (typeof win._renderQuestHubTab === 'function') win._renderQuestHubTab(); }, 80);
        };
        if (k === 'gifts') return function () {
            if (typeof win.openAllPostSpinGifts === 'function') win.openAllPostSpinGifts();
            else if (typeof win.showSpinWheel === 'function') win.showSpinWheel();
        };
        if (k === 'hot') return function () {
            if (typeof win.goHome === 'function') win.goHome();
            setTimeout(function () {
                var el = document.getElementById('hotTopicsSection') || document.getElementById('hotTopicsSectionWrapper');
                if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 250);
        };
        if (k === 'inventory') return function () {
            armHubLock('nook', 'inventory');
            if (typeof win.openNookInventory === 'function') win.openNookInventory();
            else questOpen('nook', 'inventory')();
            reapplyHubLock('nook', 'inventory');
        };
        if (k === 'cipher') return function () {
            armHubLock('nook', 'inventory');
            if (typeof win.openKeysAndCiphers === 'function') win.openKeysAndCiphers();
            else if (typeof win.openNookInventory === 'function') win.openNookInventory();
            else questOpen('nook', 'inventory')();
            reapplyHubLock('nook', 'inventory');
        };
        if (k === 'raid') return function () {
            var lock = win._bqHubLock;
            if (lock && lock.tab && lock.tab !== 'raid' && Date.now() < lock.until) return;
            if (typeof win.openRaidHub === 'function') { win.openRaidHub(); return; }
            if (typeof win.showQuestHub === 'function') win.showQuestHub();
            win._questHubTab = 'raid';
            setTimeout(function () { if (typeof win._renderQuestHubTab === 'function') win._renderQuestHubTab(); }, 80);
        };
        if (k === 'audio') return function () { if (typeof win.toggleAudio === 'function') win.toggleAudio(); };
        if (k === 'tv') return function () {
            if (typeof win.showTCTV === 'function') win.showTCTV();
            else if (typeof win.go === 'function') win.go('timechain-tv');
        };
        if (k === 'tctvwatch') return function () {
            if (typeof win.startTctvDailyWatch === 'function') win.startTctvDailyWatch();
            else if (typeof win.go === 'function') win.go('timechain-tv');
        };
        return goOpen(f.arg || f.id);
    }

    // id, title, group, keywords, desc, how, follow, hash, aliases, kind, arg, arg2, priority, term, settingsPages, questTab, aux
    function R(p) { return p; }

    var RAW = [
        R({ id: 'home', title: 'Home page', group: 'Core', term: 'home', priority: 40,
            kw: 'home homepage main start back beginning logo',
            desc: 'Home is the front page where the sidebar, search, and main features live.',
            how: 'Tap the Bitcoin logo or use the Home control to get back to the home page.',
            follow: 'Want a brand-new starting point in the One Stop Shop channel?',
            hash: 'app/home', aliases: ['home'], kind: 'home' }),
        R({ id: 'channels', title: 'Education channels', group: 'Learn', term: 'lightning', priority: 30,
            kw: 'channels education sidebar topics lightning network learn read',
            desc: 'The sidebar lists the education channels, including the Lightning Network.',
            how: 'Open the sidebar and tap a channel. The Lightning Network channel covers instant Bitcoin payments.',
            follow: 'Want the brand-new One Stop Shop, or a guided trail?',
            hash: 'app/channels', aliases: ['channels'], kind: 'home', arg: 'layer-2-lightning' }),
        R({ id: 'one-stop-shop', title: 'Brand new? One Stop Shop', group: 'Learn', term: 'beginner', priority: 70,
            kw: 'beginner brand new one stop shop start newbie where do i start new to bitcoin',
            desc: 'One Stop Shop is the brand-new starting channel.',
            how: 'Open the One Stop Shop channel when you are brand new and want one place to start.',
            follow: 'After that, want Nacho\'s Trails for a guided path?',
            hash: 'one-stop-shop', aliases: ['one-stop-shop', 'newbie'], kind: 'go', arg: 'one-stop-shop' }),
        R({ id: 'random', title: 'Random meme', group: 'Learn', term: 'meme', priority: 55,
            kw: 'random meme memes art graphic surprise funny',
            desc: 'Jump to a random channel, meme, art piece, or graphic.',
            how: 'Ask for a random meme and Nacho opens one. Random channel, art, and graphic work the same way.',
            follow: 'Want a random Bitcoin channel instead of a meme?',
            hash: 'app/random', aliases: ['random', 'meme'], kind: 'meme',
            openFns: ['goRandomMeme', 'goRandom', 'goRandomArt', 'goRandomGraphic'] }),
        R({ id: 'trails', title: "Nacho's Trails", group: 'Learn', term: 'trails', priority: 60,
            kw: 'trails trail guided path meadow mountain summit modules learn',
            desc: "Nacho's Trails are guided learning paths: Meadow, Mountain, and Summit.",
            how: 'Open Trails and start a trail. Read the topics, then take the exam at the end.',
            follow: 'Want the shorter Learning Quests slideshows instead?',
            hash: 'trails', aliases: ['trails', 'learn', 'modules'], kind: 'go', arg: 'trails' }),
        R({ id: 'learning-quests', title: 'Learning Quests', group: 'Learn', term: 'learning quest', priority: 60,
            kw: 'learning quest lesson slideshow lessons',
            desc: 'Learning Quests are short lesson slideshows with a quiz at the end.',
            how: 'Open Learning Quests and pick a lesson. Each one is a slideshow plus a quiz.',
            follow: 'Want the longer guided Trails after the lesson?',
            hash: 'learning-quests', aliases: ['learning-quests'], kind: 'go', arg: 'learning-quests' }),
        R({ id: 'first-purchase', title: 'Your First Bitcoin Purchase', group: 'Learn', term: 'buy bitcoin', priority: 65,
            kw: 'buy bitcoin first purchase purchase guide how to buy',
            desc: 'A step-by-step guide for your first Bitcoin purchase.',
            how: 'Open Your First Bitcoin Purchase. It walks through how to buy, region by region. This is education, not financial advice.',
            follow: 'Once you have some, want to see how a Lightning wallet page works in the app?',
            hash: 'first-purchase', aliases: ['first-purchase', 'buy'], kind: 'go', arg: 'first-purchase' }),
        R({ id: 'flashcards', title: 'Flashcards', group: 'Learn', term: 'flashcards', priority: 60,
            kw: 'flashcard flashcards study cards',
            desc: 'Flashcards help you study Bitcoin topics.',
            how: 'Open Settings, then the Scholar page, and start the flashcards.',
            follow: 'Want the Scholar certification after you study?',
            hash: 'app/flashcards', aliases: ['flashcards'], kind: 'settings', arg: 'scholar', questTab: 'flashcards',
            openFns: ['showSettings', 'showSettingsPage'] }),
        R({ id: 'scholar', title: 'Scholar certification', group: 'Learn', term: 'scholar', priority: 60,
            kw: 'scholar certification certificate exam diploma shareable cert',
            desc: 'The Scholar and technical certifications, plus shareable certificates.',
            how: 'Open Settings → Scholar and take the exam. A passing certificate gets a public #cert link.',
            follow: 'Want flashcards to study first?',
            hash: 'app/scholar', aliases: ['scholar', 'cert'], kind: 'settings', arg: 'scholar',
            settingsPages: ['scholar'] }),
        R({ id: 'signal', title: 'The Signal newsletter', group: 'Learn', term: 'newsletter', priority: 60,
            kw: 'signal newsletter weekly',
            desc: 'The Signal is the weekly newsletter of curated Bitcoin reading.',
            how: 'Open Settings → Scholar. The Signal newsletter lives on that page.',
            follow: 'Want this week\'s Hot Topics in the sidebar too?',
            hash: 'app/signal', aliases: ['signal', 'newsletter'], kind: 'settings', arg: 'scholar' }),
        R({ id: 'story', title: "Nacho's Story", group: 'Nacho', term: 'story', priority: 50,
            kw: 'story chapter chapters adventure',
            desc: "Nacho's Story unlocks one new chapter a day.",
            how: "Open Nacho's Story from Nacho and read today's chapter.",
            follow: 'Want to dress Nacho up in the Closet after the chapter?',
            hash: 'app/story', aliases: ['story'], kind: 'story', openFns: ['showNachoStory'] }),
        R({ id: 'nacho-mode', title: 'Nacho Mode', group: 'Nacho', term: 'nacho mode', priority: 80,
            kw: 'nacho mode full screen chat tutor',
            desc: 'Nacho Mode is the full-screen chat with Nacho.',
            how: 'Open Nacho Mode with the button or by pressing N. The little bubble is a smaller version of the same chat.',
            follow: 'Want ELI5 answers in simpler words?',
            hash: 'nacho', aliases: ['nacho', 'nacho-mode'], kind: 'nacho', openFns: ['enterNachoMode'] }),
        R({ id: 'mini-nacho', title: 'Mini Nacho bubble', group: 'Nacho', term: 'ask nacho', priority: 75,
            kw: 'ask nacho mini bubble question tap nacho',
            desc: 'Mini Nacho is the bubble you tap to ask a question without leaving the page.',
            how: 'Tap Nacho, then ask. The same answers show up here and in Nacho Mode.',
            follow: 'Want the bigger Nacho Mode window?',
            hash: 'app/mini-nacho', aliases: ['mini-nacho', 'ask-nacho'], kind: 'mini', openFns: ['showNachoInput'] }),
        R({ id: 'quiz-me', title: 'Quiz Me', group: 'Nacho', term: 'quiz me', priority: 85,
            kw: 'quiz me pop quiz test me nacho quiz',
            desc: 'Quiz Me is Nacho\'s quick Bitcoin quiz.',
            how: 'Say "quiz me" and Nacho starts a short quiz.',
            follow: 'Want the daily quiz in Quest Hub instead?',
            hash: 'app/quiz-me', aliases: ['quiz-me'], kind: 'quiz', openFns: ['nachoQuizMe'] }),
        R({ id: 'closet', title: "Nacho's Closet", group: 'Nacho', term: 'closet', priority: 55,
            kw: 'closet outfit dress clothes wardrobe customize',
            desc: "Nacho's Closet is where you dress Nacho in outfits you unlock.",
            how: 'Open Settings and the Nacho section to change the outfit.',
            follow: 'Want to know how gifts can drop closet items?',
            hash: 'app/closet', aliases: ['closet'], kind: 'closet', openFns: ['openNachoCloset', 'showSettings', 'showSettingsPage'] }),
        R({ id: 'eli5', title: 'ELI5 mode', group: 'Nacho', term: 'eli5', priority: 70,
            kw: 'eli5 explain like im 5 five simple',
            desc: 'ELI5 mode makes Nacho explain like you are five.',
            how: 'In Nacho Mode, open ELI5 and turn it on. Answers stay short and simple.',
            follow: 'Want a normal explanation of the Quest Hub after that?',
            hash: 'app/eli5', aliases: ['eli5'], kind: 'eli5', openFns: ['showEli5Prompt', 'enterNachoMode'] }),
        R({ id: 'quest-hub', title: 'Quest Hub', group: 'Quests', term: 'quest hub', priority: 50,
            kw: 'quest hub quests hub',
            desc: 'Quest Hub holds the daily quiz, trivia, poll, Flex, Favor, raid, charity, community challenge, and the Nook.',
            how: 'Open Quest Hub from the menu. Pick a tab along the top.',
            follow: 'Want the daily quiz tab first?',
            hash: 'quests', aliases: ['quests', 'quest-hub'], kind: 'quest', arg: 'quiz', questTab: 'quests',
            openFns: ['showQuestHub'] }),
        R({ id: 'qh-quiz', title: 'Daily quiz', group: 'Quests', term: 'daily quiz', priority: 80,
            kw: 'daily quiz quest quiz',
            desc: 'The daily quiz is a Quest Hub tab.',
            how: 'Open Quest Hub and choose the Quiz tab. You get one scored run a day.',
            follow: 'Want the Trivia tab next to it?',
            hash: 'app/quiz', aliases: ['daily-quiz', 'qh-quiz'], kind: 'quest', arg: 'quiz', questTab: 'quiz' }),
        R({ id: 'qh-trivia', title: 'Daily trivia', group: 'Quests', term: 'trivia', priority: 80,
            kw: 'trivia daily trivia',
            desc: 'Daily trivia lives in Quest Hub.',
            how: 'Open Quest Hub and choose the Trivia tab.',
            follow: 'Want the Poll tab after trivia?',
            hash: 'app/trivia', aliases: ['trivia', 'qh-trivia'], kind: 'quest', arg: 'trivia', questTab: 'trivia' }),
        R({ id: 'qh-poll', title: 'Daily poll', group: 'Quests', term: 'poll', priority: 80,
            kw: 'poll daily poll vote',
            desc: 'The daily poll is a Quest Hub tab.',
            how: 'Open Quest Hub and choose the Poll tab to cast today\'s vote.',
            follow: 'Want Flex, the healthy-habits tab, next?',
            hash: 'app/poll', aliases: ['poll', 'qh-poll'], kind: 'quest', arg: 'poll', questTab: 'poll' }),
        R({ id: 'qh-flex', title: 'Flex', group: 'Quests', term: 'flex', priority: 75,
            kw: 'flex healthy habits lifestyle',
            desc: 'Flex is the Quest Hub tab of healthy Bitcoiner habits.',
            how: 'Open Quest Hub → Flex. Each habit is a small action worth XP, and the list resets on the daily schedule.',
            follow: 'Want the Community Challenge after Flex?',
            hash: 'app/flex', aliases: ['flex', 'qh-flex'], kind: 'quest', arg: 'flex', questTab: 'flex' }),
        R({ id: 'favor', title: "Satoshi's Favor", group: 'Quests', term: "satoshi's favor", priority: 70,
            kw: "satoshi's favor satoshis favor mining game hash mine",
            desc: "Satoshi's Favor is the community mining game. You contribute points, then hash during a window.",
            how: "Open Quest Hub → Favor, or open the miner. Hash during the window for a chance at the prize.",
            follow: 'Want a hash booster from the Nook for more hashes?',
            hash: 'favor', aliases: ['favor', 'sf', 'satoshi-favor'], kind: 'favor', questTab: 'favor',
            openFns: ['openSatoshiFavorMiner', 'showQuestHub'] }),
        R({ id: 'raid', title: 'Raid Boss', group: 'Quests', term: 'raid', priority: 80,
            kw: 'raid boss battle damage',
            desc: 'The raid boss is a community fight. You deal damage by earning badges and doing activities.',
            how: 'Open Quest Hub → Raid to see the boss, your damage, and the prize.',
            follow: 'Want the leaderboard of raiders next?',
            hash: 'app/raid', aliases: ['raid', 'raid-boss', 'questhub'], kind: 'raid', arg: 'raid', questTab: 'raid',
            openFns: ['openRaidHub', 'showQuestHub'] }),
        R({ id: 'citadel', title: 'Citadel', group: 'Quests', term: 'citadel', priority: 80,
            kw: 'citadel coming soon spend xp',
            desc: 'The Citadel is the coming-soon place to spend XP.',
            how: 'Open Quest Hub → Citadel. It is marked coming soon, so you can look but not spend yet.',
            follow: 'Want to spend tickets in the Nook today instead?',
            hash: 'app/citadel', aliases: ['citadel'], kind: 'quest', arg: 'citadel', questTab: 'citadel' }),
        R({ id: 'charity', title: 'Charity', group: 'Quests', term: 'charity', priority: 75,
            kw: 'charity donate xp donation faction',
            desc: 'Charity lets you donate XP. Your faction (Honey Badger or Cyber Hornet) is on the same screen.',
            how: 'Open Quest Hub → Charity, pick an amount of XP, and donate. This is separate from donating to the site.',
            follow: 'Want to choose your faction in Settings first?',
            hash: 'app/charity', aliases: ['charity'], kind: 'quest', arg: 'charity', questTab: 'charity' }),
        R({ id: 'community', title: 'Community Challenge', group: 'Quests', term: 'community challenge', priority: 70,
            kw: 'community challenge weekly goal',
            desc: 'The community challenge is a shared weekly goal in Quest Hub.',
            how: 'Open Quest Hub → Community to see the goal and chip in.',
            follow: 'Want Satoshi\'s Favor, which the challenge can speed up?',
            hash: 'app/community', aliases: ['community', 'community-challenge'], kind: 'quest', arg: 'community', questTab: 'community' }),
        R({ id: 'nook', title: "Nacho's Nook", group: 'Shop & items', term: 'nook', priority: 60,
            kw: 'nook shop buy tickets streak freeze hint double xp',
            desc: "Nacho's Nook is the shop inside Quest Hub. You spend Orange Tickets there.",
            how: 'Open Quest Hub → Nook/Inventory and use the shop side to buy items.',
            follow: 'Want your Inventory, where the items wait to be used?',
            hash: 'app/nook', aliases: ['nook'], kind: 'quest', arg: 'nook', questTab: 'nook' }),
        R({ id: 'inventory', title: 'Inventory', group: 'Shop & items', term: 'inventory', priority: 70,
            kw: 'inventory items bag owned',
            desc: 'Inventory is the Nook tab that holds items you own, including keys and locked ciphers.',
            how: 'Open Quest Hub → Nook/Inventory and switch to Inventory.',
            follow: 'Want to know how a locked cipher opens?',
            hash: 'app/inventory', aliases: ['inventory'], kind: 'inventory', questTab: 'nook',
            openFns: ['openNookInventory', 'showQuestHub'] }),
        R({ id: 'double-xp', title: 'Double XP charge', group: 'Shop & items', term: 'double xp', priority: 70,
            kw: 'double xp 2x multiplier charge',
            desc: 'A Double XP charge starts when you buy it and lasts 60 minutes.',
            how: 'Buying another charge while one is running adds another hour, and it doubles daily activity XP only.',
            follow: 'Want to see your XP and the daily cap on the Sats page?',
            hash: 'app/double-xp', aliases: ['double-xp'], kind: 'quest', arg: 'nook' }),
        R({ id: 'hint-token', title: 'Hint tokens', group: 'Shop & items', term: 'hint token', priority: 70,
            kw: 'hint token hints quiz help',
            desc: 'Hint tokens remove a wrong answer during a quiz.',
            how: 'Buy hint tokens in the Nook, then use one on a quiz question.',
            follow: 'Want the daily quiz, where a hint helps most?',
            hash: 'app/hint-token', aliases: ['hint-token', 'hints'], kind: 'quest', arg: 'nook' }),
        R({ id: 'streak-freeze', title: 'Streak freeze', group: 'Shop & items', term: 'streak freeze', priority: 70,
            kw: 'streak freeze protect streak',
            desc: 'A streak freeze protects your visit streak if you miss a day.',
            how: 'Buy a streak freeze in the Nook. You can see whether one is saved under Settings → Data.',
            follow: 'Want the daily spin, which also helps a streak?',
            hash: 'app/streak-freeze', aliases: ['streak-freeze'], kind: 'quest', arg: 'nook' }),
        R({ id: 'hash-booster', title: 'Hash booster', group: 'Shop & items', term: 'hash booster', priority: 70,
            kw: 'hash booster second rig hashes extra hash',
            desc: 'A hash booster is spent one hash at a time, and while charges remain that hash skips the per-minute limit.',
            how: 'A second rig is a separate rig with its own cooldown, and one charge unlocks rig 2 for the current cycle. It is not a larger booster.',
            follow: 'Want to open Satoshi\'s Favor now?',
            hash: 'app/hash-booster', aliases: ['hash-booster', 'second-rig'], kind: 'quest', arg: 'nook' }),
        R({ id: 'raffle', title: 'Orange ticket raffle', group: 'Shop & items', term: 'raffle', priority: 65,
            kw: 'raffle entries lottery',
            desc: 'The raffle takes Orange Ticket entries from the Nook. A winner is drawn on the 1st.',
            how: 'Open the Nook and buy raffle entries. More entries, better odds.',
            follow: 'Want to know how to earn the Orange Tickets you spend?',
            hash: 'app/raffle', aliases: ['raffle'], kind: 'quest', arg: 'nook' }),
        R({ id: 'gift-bag', title: 'Gift bag', group: 'Shop & items', term: 'gift bag', priority: 75,
            kw: 'gift bag shop keepsake',
            desc: 'The gift bag is a shop keepsake in the Nook. It is not the same as opening a gift from the wheel.',
            how: 'Open the Nook to see the gift bag. Gifts from the wheel open right away, and keys live in Inventory.',
            follow: 'Want to open gifts from the daily spin instead?',
            hash: 'app/gift-bag', aliases: ['gift-bag'], kind: 'quest', arg: 'nook' }),
        R({ id: 'wheel', title: 'Daily spin wheel', group: 'Rewards', term: 'spin', priority: 60,
            kw: 'spin wheel daily spin prize',
            desc: 'The daily spin wheel gives a free spin for tickets, XP, or a gift.',
            how: 'Open the daily spin wheel and take today\'s spin.',
            follow: 'If you land a gift, want to know how to open it?',
            hash: 'app/wheel', aliases: ['wheel', 'spin'], kind: 'spin', openFns: ['showSpinWheel'] }),
        R({ id: 'gifts', title: 'Gifts', group: 'Rewards', term: 'gifts', priority: 70,
            kw: 'gifts gift open present prize wheel',
            desc: 'Gifts come from the spin wheel. You open them for keys, locked ciphers, tickets, XP, or a rare prize.',
            how: 'Spin the wheel, then open the gift on the post-spin screen. You can also open gifts from Settings → Account → Peers.',
            follow: 'Want to know what a Nacho shoutout prize is?',
            hash: 'app/gifts', aliases: ['gifts', 'open gifts', 'open-gifts'], kind: 'gifts',
            openFns: ['openAllPostSpinGifts', 'openGift', 'openSingleGift', 'showSpinWheel'] }),
        R({ id: 'ciphers', title: 'Locked ciphers', group: 'Rewards', term: 'cipher', priority: 90,
            kw: 'cipher ciphers locked cipher decrypt unlock puzzle',
            desc: 'A locked cipher opens when you use a key with the same label.',
            how: 'If an accepted peer sent that key, you both get the same prize and they see a reveal of what you won.',
            follow: 'How do I get a key for my cipher?',
            hash: 'app/ciphers', aliases: ['ciphers', 'cipher', 'locked-cipher'], kind: 'cipher',
            openFns: ['openKeysAndCiphers', 'openNookInventory', 'openCipherWithMatch', 'showQuestHub'] }),
        R({ id: 'keys', title: 'Cipher keys', group: 'Rewards', term: 'keys', priority: 100,
            kw: 'key keys cipher key send key peer label',
            desc: 'Keys open locked ciphers with the same label, and you can send up to 3 a day to each accepted peer.',
            how: 'If a peer opens a cipher with your key, you both win the same prize and you see a reveal of what you won.',
            follow: 'Want to add a peer so you have someone to trade keys with?',
            hash: 'app/keys', aliases: ['keys', 'cipher-keys'], kind: 'cipher',
            openFns: ['openNookInventory', 'showPeerPickerForKeys', 'showKeyPickerForPeer'] }),
        R({ id: 'peers', title: 'Peers', group: 'Rewards', term: 'peers', priority: 60,
            kw: 'peers peer request add a peer friend',
            desc: 'Peers are people you connect with so you can send keys and grow a partnership.',
            how: 'Open Settings → Account → Peers. Send a peer request, and accept the ones you want.',
            follow: 'Want to know how partnership levels work?',
            hash: 'app/peers', aliases: ['peers'], kind: 'settings', arg: 'peers', settingsPages: ['peers'],
            openFns: ['showSettings', 'showSettingsPage'] }),
        R({ id: 'partnership', title: 'Partnership levels', group: 'Rewards', term: 'partnership', priority: 65,
            kw: 'partnership levels wumbo channel opening routing',
            desc: 'Partnership levels grow when you open a cipher with a key a peer sent you, from Opening Channel up to Wumbo.',
            how: 'Open Settings → Account → Peers to see the partnership level with each peer.',
            follow: 'Want to send that peer a key?',
            hash: 'app/partnership', aliases: ['partnership'], kind: 'settings', arg: 'peers' }),
        R({ id: 'shoutout', title: 'Nacho shoutout', group: 'Rewards', term: 'shoutout', priority: 80,
            kw: 'shoutout shoutouts rare prize global chat',
            desc: 'A Nacho shoutout is a rare gift prize. Nacho posts it in Global Chat.',
            how: 'Win one by opening gifts from the wheel. If it hits, the shoutout shows up in Global Chat.',
            follow: 'Want to open Global Chat and look?',
            hash: 'app/shoutout', aliases: ['shoutout'], kind: 'chat' }),
        R({ id: 'tickets', title: 'Orange tickets', group: 'Rewards', term: 'orange tickets', priority: 55,
            kw: 'orange tickets ticket balance earn tickets',
            desc: 'Orange Tickets are the shop currency. You earn them from the daily spin, activity, and referrals.',
            how: 'Your balance is in Settings → Account. Spend tickets in the Nook.',
            follow: 'Want the referral rule for earning 50 tickets?',
            hash: 'app/tickets', aliases: ['tickets', 'orange-tickets'], kind: 'settings', arg: 'account' }),
        R({ id: 'xp', title: 'XP and points', group: 'Rewards', term: 'overflow', priority: 50,
            kw: 'xp points experience overflow daily cap earn points',
            desc: 'XP (points) is how you rank up. Full XP through 500 a day, half through 900, then a quarter until the 1,000 daily cap. Each tier rounds down.',
            how: 'Earn points by reading, quests, chat, and badges. The Today card shows today’s XP, with 500, 900, and 1,000 above the bar and Full rate, Half rate, and Quarter rate underneath.',
            follow: 'Want a Double XP charge from the Nook?',
            hash: 'app/xp', aliases: ['xp', 'points'], kind: 'settings', arg: 'sats' }),
        R({ id: 'badges', title: 'Badges', group: 'Rewards', term: 'badges', priority: 55,
            kw: 'badges badge achievements',
            desc: 'Badges mark things you have done, from chat to quests to hidden goals.',
            how: 'Open the leaderboard to see badge progress, and the Nacho section of Settings for what you have equipped.',
            follow: 'Want the leaderboard standings too?',
            hash: 'app/badges', aliases: ['badges'], kind: 'lb', openFns: ['toggleLeaderboard'] }),
        R({ id: 'referral', title: 'Invite friends', group: 'Rewards', term: 'referral', priority: 78,
            kw: 'referral refer a friend invite friends invite referral link maxi share link',
            desc: 'Share your referral link from the home page. When a friend you refer reaches Maxi, you both get 50 orange tickets.',
            how: 'Open Invite friends. Copy or share your referral link. Your friend signs up with it, reaches Maxi (2,140 XP), and you both get 50 orange tickets automatically.',
            follow: 'Want to check your Orange Ticket balance?',
            hash: 'app/referral', aliases: ['referral', 'refer', 'invite', 'invite-friends'], kind: 'invite',
            openFns: ['openInviteFriends'] }),
        R({ id: 'sats', title: 'Claim sats', group: 'Rewards', term: 'faucet', priority: 70,
            kw: 'faucet claim sats withdraw payout sats',
            desc: 'The faucet lets you claim sats. The exact checks stay vague so it stays fair for real learners.',
            how: 'Open Settings → Sats and claim when you are eligible. Those details stay vague on purpose.',
            follow: 'Want to open Settings → Sats?',
            hash: 'sats', aliases: ['sats', 'wallet', 'faucet'], kind: 'settings', arg: 'sats', settingsPages: ['sats'],
            openFns: ['showSettings', 'showSettingsPage'] }),
        R({ id: 'ln-address', title: 'Lightning address', group: 'Rewards', term: 'lightning address', priority: 75,
            kw: 'lightning address tips receive',
            desc: 'Your Lightning address is where tips are sent.',
            how: 'Open Settings → Account and save a Lightning address that looks like an email (name@wallet).',
            follow: 'Want to open Settings → Account?',
            hash: 'app/lightning-address', aliases: ['lightning-address', 'ln-address'], kind: 'settings', arg: 'account',
            settingsPages: ['account', 'profile'] }),
        R({ id: 'predictions', title: 'Price prediction', group: 'Games', term: 'prediction', priority: 80,
            kw: 'prediction predictions price prediction up down 24h forecast',
            desc: 'Price prediction is a 24-hour game: you guess whether Bitcoin goes up or down.',
            how: 'Open Price Prediction, pick up or down, and check back in 24 hours. It is a game, not financial advice.',
            follow: 'Want the Bitcoin dashboard if you want mempool and fees instead of a guess?',
            hash: 'app/predictions', aliases: ['price-prediction', 'predict'], kind: 'predict',
            openFns: ['showPricePrediction'] }),
        R({ id: 'pvp', title: 'PvP trivia battles', group: 'Games', term: 'pvp', priority: 70,
            kw: 'pvp battle trivia duel versus lobby',
            desc: 'The PvP lobby is a live trivia battle against another player. Join the lobby and wait, or jump in when someone is already waiting.',
            how: 'Open the PvP lobby (#pvp) from search or Nacho, or tap Join lobby on the alert.',
            follow: 'Want the Proof of Play arcade as well?',
            hash: 'pvp', aliases: ['pvp', 'pvp-lobby'], kind: 'pvp', openFns: ['enterPVPMode'] }),
        R({ id: 'proof-of-play', title: 'Proof of Play arcade', group: 'Games', term: 'arcade', priority: 70,
            kw: 'arcade proof of play games play',
            desc: 'Proof of Play is the arcade of Bitcoin games, plus a PvP corner.',
            how: 'Open the arcade from the menu or the Proof of Play page.',
            follow: 'Want a PvP trivia battle instead of the arcade?',
            hash: 'proof-of-play', aliases: ['proof-of-play', 'proof-of-play-pvp', 'arcade'], kind: 'pop',
            openFns: ['enterProofOfPlay'] }),
        R({ id: 'proof-of-walk', title: 'Proof of Walk', group: 'Games', term: 'proof of walk', priority: 70,
            kw: 'proof of walk strava walking steps',
            desc: 'Proof of Walk connects Strava so a walk can earn XP. The support page is separate.',
            how: 'Open Proof of Walk and connect Strava. If the feature is paused, the page says so.',
            follow: 'Want Flex, the in-app healthy habits, while you wait?',
            hash: 'app/proof-of-walk', aliases: ['proof-of-walk', 'walk'], kind: 'pow',
            openFns: ['renderProofOfWalk', 'showProofOfWalk'] }),
        R({ id: 'pow-support', title: 'Proof of Walk support', group: 'Games', term: 'pow support', priority: 40, aux: true,
            kw: 'pow support proof of walk support',
            desc: 'The Proof of Walk support page explains the Strava connection.',
            how: 'Open the support page from its link. The walk feature itself is Proof of Walk.',
            follow: 'Want the Proof of Walk feature page?',
            hash: 'pow-support', aliases: ['pow-support'], kind: 'powsupport', openFns: ['renderPOWSupport'] }),
        R({ id: 'leaderboard', title: 'Leaderboard', group: 'Games', term: 'leaderboard', priority: 60,
            kw: 'leaderboard ranking all-time weekly monthly',
            desc: 'The leaderboard ranks players all-time, weekly, and monthly.',
            how: 'Open the leaderboard and switch the period tab.',
            follow: 'Want to see badges next to the ranks?',
            hash: 'app/leaderboard', aliases: ['leaderboard'], kind: 'lb', openFns: ['toggleLeaderboard', 'showLeaderboardAuto'] }),
        R({ id: 'global-chat', title: 'Global chat', group: 'Community', term: 'chat', priority: 70,
            kw: 'global chat chatroom live chat telegram',
            desc: 'Global chat is the live room, with a Telegram bridge.',
            how: 'Open the chat button and stay on the Global tab.',
            follow: 'Want direct messages instead of the public room?',
            hash: 'chat', aliases: ['chat', 'global-chat'], kind: 'chat', openFns: ['renderChatHub', 'toggleChatOverlay', 'openGlobalChatForCipher'] }),
        R({ id: 'say-hi', title: 'Say hi to the community', group: 'Community', term: 'say hi', priority: 82,
            kw: 'say hi say hello community hello daily hello wave sayhi',
            desc: 'Say hi in Global Chat once a day for 50 XP and 1 Orange Ticket.',
            how: 'On the home page, tap Say hi next to the daily spin. Global Chat opens. Send a message and the reward lands once per day.',
            follow: 'Want the daily spin, on the same home row?',
            hash: 'app/say-hi', aliases: ['say-hi', 'sayhi'], kind: 'sayhi',
            openFns: ['openSayHi'] }),
        R({ id: 'dms', title: 'Direct messages', group: 'Community', term: 'messages', priority: 65,
            kw: 'messages dms dm inbox direct message',
            desc: 'Direct messages are private chats.',
            how: 'Open the inbox, or the DMs tab in the chat hub. New accounts need a little XP and time before sending, to slow down scammers.',
            follow: 'Want to find a Bitcoin buddy to message?',
            hash: 'dms', aliases: ['dms', 'messages', 'inbox'], kind: 'dms', openFns: ['showInbox', 'openDM', 'renderChatHub'] }),
        R({ id: 'buddy', title: 'Bitcoin Buddy', group: 'Community', term: 'buddy', priority: 60,
            kw: 'buddy bitcoin buddy finder mentor',
            desc: 'Bitcoin Buddy pairs a learner with a teacher.',
            how: 'Open Global Chat, tap Find a Buddy, pick Learn or Teach and an experience level, and a match opens a direct message with an icebreaker.',
            follow: 'Want IRL meetups if you would rather meet in person?',
            hash: 'app/buddy', aliases: ['buddy'], kind: 'buddy', openFns: ['showBuddyFinder'] }),
        R({ id: 'forum', title: 'PlebTalk forum', group: 'Community', term: 'forum', priority: 55,
            kw: 'forum plebtalk articles discuss',
            desc: 'PlebTalk is the forum. Articles are the long-form tab inside it. Nacho posts a new discussion in Global Chat.',
            how: 'Open PlebTalk to read or start a discussion. A new top-level post can show up in Global Chat.',
            follow: 'Want Global Chat if you want something live instead?',
            hash: 'forum', aliases: ['forum', 'plebtalk'], kind: 'go', arg: 'forum' }),
        R({ id: 'marketplace', title: 'LightningMart marketplace', group: 'Community', term: 'marketplace', priority: 60,
            kw: 'marketplace market lightningmart buy sell',
            desc: 'LightningMart is the marketplace for buying and selling with sats. Nacho posts a new listing in Global Chat.',
            how: 'Open the marketplace to browse listings or post one. A new public listing can show up in Global Chat.',
            follow: 'Want to add a Lightning address so people can pay you?',
            hash: 'marketplace', aliases: ['marketplace'], kind: 'go', arg: 'marketplace' }),
        R({ id: 'irl', title: 'IRL Sync meetups', group: 'Community', term: 'meetup', priority: 50,
            kw: 'meetup irl sync meetups meetup in a box events',
            desc: 'IRL Sync lists Bitcoin meetups, and Meetup-in-a-Box has ready-made agendas.',
            how: 'Open IRL Sync to find a meetup or host one.',
            follow: 'Want the Meetup Builder to plan the details?',
            hash: 'irl-sync', aliases: ['irl-sync', 'meet', 'irl'], kind: 'go', arg: 'irl-sync' }),
        R({ id: 'meetup-builder', title: 'Meetup Builder', group: 'Community', term: 'meetup builder', priority: 75,
            kw: 'meetup builder plan venue',
            desc: 'Meetup Builder helps you plan, share, and discover Bitcoin meetups.',
            how: 'Open Meetup Builder, add the details, and share the plan.',
            follow: 'Want IRL Sync to see meetups other people posted?',
            hash: 'meetup-builder', aliases: ['meetup-builder'], kind: 'go', arg: 'meetup-builder' }),
        R({ id: 'sats-vs-bits', title: 'Sats vs Bits', group: 'Community', term: 'sats vs bits', priority: 70,
            kw: 'sats vs bits denomination vote bits',
            desc: 'Sats vs Bits is the live vote on what to call the small unit.',
            how: 'Open the chat hub and vote sats or bits.',
            follow: 'Want Global Chat after you vote?',
            hash: 'app/sats-vs-bits', aliases: ['sats-vs-bits'], kind: 'chat' }),
        R({ id: 'tips', title: 'Lightning tips', group: 'Community', term: 'tip', priority: 70,
            kw: 'tip tips zap send sats to a user',
            desc: 'You can tip another user with Lightning sats if they have an address.',
            how: 'Open a profile and use Tip. This is a tip to a person, not a donation to the site.',
            follow: 'Want to save your own Lightning address so people can tip you back?',
            hash: 'app/tips', aliases: ['tips', 'tip'], kind: 'tip', openFns: ['showTipOverlay'] }),
        R({ id: 'lightning-wallet', title: 'Lightning wallet page', group: 'Community', term: 'wallet', priority: 55,
            kw: 'lightning wallet connect wallet webln nwc',
            desc: 'The Lightning wallet page is where you connect a wallet for tips and payments.',
            how: 'Open the Lightning page and connect with a Lightning address, WebLN, or NWC.',
            follow: 'Want to save just an address in Settings instead?',
            hash: 'lightning', aliases: ['lightning', 'lightning-wallet'], kind: 'go', arg: 'lightning' }),
        R({ id: 'tctv-watch', title: 'Watch 10 minutes of Timechain TV', group: 'Rewards', term: 'watch 10', priority: 72,
            kw: 'watch 10 minutes daily challenge timechain tv reward xp orange tickets',
            desc: 'Watch 10 minutes of Timechain TV in a day to earn 100 XP and 1 orange ticket.',
            how: 'Tap Watch TV next to the daily spin. It opens Timechain TV and starts playback. The button shows minutes watched, then Done.',
            follow: 'Want the Timechain TV channels themselves?',
            hash: 'app/tctv-watch', aliases: ['tctv-watch'], kind: 'tctvwatch',
            openFns: ['startTctvDailyWatch', 'go'] }),
        R({ id: 'tv', title: 'Timechain TV', group: 'Media', term: 'tv', priority: 60,
            kw: 'tv timechain television watch video',
            desc: 'Timechain TV plays Bitcoin videos around the clock.',
            how: 'Open Timechain TV and pick a channel.',
            follow: 'Want Bitcoin Beats if you would rather listen to music?',
            hash: 'timechain-tv', aliases: ['timechain-tv', 'tv'], kind: 'tv', openFns: ['showTCTV', 'go'] }),
        R({ id: 'beats', title: 'Bitcoin Beats', group: 'Media', term: 'music', priority: 55,
            kw: 'music beats dj songs radio listen upload',
            desc: 'Bitcoin Beats is the music corner: listen, upload, DJ mode, and Nacho Radio.',
            how: 'Open Bitcoin Beats. Use the upload tab for tracks and the livestream tab for DJ mode.',
            follow: 'Want Timechain TV if you want video instead?',
            hash: 'bitcoin-beats', aliases: ['bitcoin-beats', 'beats'], kind: 'go', arg: 'bitcoin-beats',
            openFns: ['go', 'beatsTab'] }),
        R({ id: 'hot-topics', title: 'Hot Topics', group: 'Media', term: 'hot topics', priority: 80,
            kw: 'hot topics weekly sidebar',
            desc: 'Hot Topics is the weekly list in the sidebar.',
            how: 'Go home and scroll the sidebar to the Hot Topics section.',
            follow: 'Want The Signal newsletter for a longer weekly read?',
            hash: 'app/hot-topics', aliases: ['hot-topics', 'hottopics'], kind: 'hot' }),
        R({ id: 'dashboard', title: 'Bitcoin dashboard', group: 'Media', term: 'mempool', priority: 60,
            kw: 'mempool dashboard network fees hashrate indicators',
            desc: 'The dashboard shows mempool, fees, hashrate, and other network stats.',
            how: 'Open the Bitcoin dashboard from the menu or the network link.',
            follow: 'Want price prediction if you want a 24-hour up-or-down game?',
            hash: 'dashboard', aliases: ['dashboard', 'bitcoin-dashboard', 'metrics', 'network'], kind: 'dash',
            openFns: ['toggleDashboard', 'go'] }),
        R({ id: 'notifications', title: 'Notifications', group: 'Account', term: 'notifications', priority: 70,
            kw: 'notifications notification bell alerts',
            desc: 'The bell opens your notifications.',
            how: 'Tap the bell icon to open the notifications panel.',
            follow: 'Want Settings if you are looking for account controls instead?',
            hash: 'app/notifications', aliases: ['notifications'], kind: 'notif', openFns: ['showNotifications'] }),
        R({ id: 'settings', title: 'Settings', group: 'Account', term: 'settings', priority: 40,
            kw: 'settings account preferences security',
            desc: 'Settings has Account, Scholar, Sats, Prefs, Security, and Data.',
            how: 'Open Settings and pick a page along the top.',
            follow: 'Want the Security page for 2FA?',
            hash: 'app/settings', aliases: ['settings'], kind: 'settings', arg: '',
            openFns: ['showSettings', 'showSettingsPage'] }),
        R({ id: 'faction', title: 'Faction', group: 'Account', term: 'faction', priority: 70,
            kw: 'faction honey badger cyber hornet badger hornet team',
            desc: 'Your faction is Honey Badgers or Cyber Hornets, and the choice is permanent. It shows on the leaderboard and on charity.',
            how: 'Open Settings, then Account, and pick Honey Badgers or Cyber Hornets once.',
            follow: 'Want the charity tab, where the faction pools XP?',
            hash: 'app/faction', aliases: ['faction'], kind: 'settings', arg: 'account' }),
        R({ id: 'security', title: 'Security and 2FA', group: 'Account', term: '2fa', priority: 80,
            kw: '2fa two-factor two factor password authenticator block delete account',
            desc: 'The Security page has 2FA, your password, and blocking. Account deletion and linked sign-ins are on the Account tab.',
            how: 'Open Settings → Security and turn on 2FA with an authenticator app or the phone option. Open Settings → Account to delete the account or change an email sign-in.',
            follow: 'Want Preferences if you meant theme or dark mode?',
            hash: 'app/security', aliases: ['security', '2fa'], kind: 'settings', arg: 'security', settingsPages: ['security'] }),
        R({ id: 'delete-account', title: 'Delete account', group: 'Account', term: 'delete account', priority: 85,
            kw: 'delete account remove close deactivate erase',
            desc: 'Delete account is on the Account tab. You confirm your username, and any sats balance is forfeited. There is no waiting period.',
            how: 'Open Settings → Account and choose Delete account.',
            follow: 'Want Security if you meant 2FA instead?',
            hash: 'app/delete-account', aliases: ['delete-account'], kind: 'settings', arg: 'account', settingsPages: ['account'] }),
        R({ id: 'change-email', title: 'Change email', group: 'Account', term: 'change email', priority: 75,
            kw: 'change email update address add email',
            desc: 'Email sign-ins can change the address from the Account tab. Linked Google, X, GitHub, and Facebook emails stay with that sign-in.',
            how: 'Open Settings → Account and choose Change email or Add email.',
            follow: 'Want Sign-in methods on the Account tab to link another provider?',
            hash: 'app/change-email', aliases: ['change-email'], kind: 'settings', arg: 'account', settingsPages: ['account'] }),
        R({ id: 'prefs', title: 'Preferences', group: 'Account', term: 'dark mode', priority: 60,
            kw: 'dark mode theme oled font language ticker preferences prefs experience mode',
            desc: 'Preferences cover theme, dark mode, OLED, font size, language, the price ticker, Nacho, and experience mode.',
            how: 'Open Settings → Prefs and switch the theme to dark mode or light mode.',
            follow: 'Want keyboard shortcuts for the keys that do the same thing?',
            hash: 'app/prefs', aliases: ['prefs', 'preferences', 'dark-mode'], kind: 'settings', arg: 'prefs', settingsPages: ['prefs'] }),
        R({ id: 'export', title: 'Export my data', group: 'Account', term: 'export', priority: 70,
            kw: 'export download my data backup',
            desc: 'Export downloads a copy of your data.',
            how: 'Open Settings → Data and use Export.',
            follow: 'Want the Security page if you meant deleting the account?',
            hash: 'app/export', aliases: ['export'], kind: 'settings', arg: 'data', settingsPages: ['data'] }),
        R({ id: 'signin', title: 'Sign in', group: 'Account', term: 'sign in', priority: 55,
            kw: 'sign in login log in register account nostr email',
            desc: 'Sign in with email, a social account, or Nostr so progress syncs.',
            how: 'Open the sign-in window and pick email, Google, or Nostr.',
            follow: 'Want Settings after you are in?',
            hash: 'app/signin', aliases: ['signin', 'login'], kind: 'signin', openFns: ['showUsernamePrompt'] }),
        R({ id: 'donate', title: 'Donate to the archive', group: 'Account', term: 'donate', priority: 50,
            kw: 'donate donation support the archive contribute',
            desc: 'Donate sends sats to the archive itself.',
            how: 'Open the donate window and pick a method. Donating XP to charity is a different screen in Quest Hub.',
            follow: 'Want the charity tab if you meant donating XP?',
            hash: 'app/donate', aliases: ['donate'], kind: 'donate', openFns: ['showDonateModal'] }),
        R({ id: 'onboarding-intro', title: 'Welcome tour', group: 'Help', term: 'welcome tour', priority: 40,
            kw: 'welcome tour onboarding intro replay tour',
            desc: 'The welcome tour is a short summary of what you can do here.',
            how: 'It shows once. Replay it from Settings or Help.',
            follow: 'Want the FAQ instead?',
            hash: 'app/welcome-tour', aliases: ['welcome-tour', 'onboarding-intro'], kind: 'onboarding',
            openFns: ['showOnboardingIntro'] }),
        R({ id: 'faq', title: 'FAQ and guide', group: 'Help', term: 'faq', priority: 70,
            kw: 'faq guide help questions frequently asked',
            desc: 'The FAQ and the guide answer common questions about the app.',
            how: 'Open the FAQ for short answers, or the guide for the walkthrough.',
            follow: 'Want me to open a specific feature instead?',
            hash: 'faq', aliases: ['faq', 'guide'], kind: 'faq', openFns: ['showFAQ', 'showGuide'] }),
        R({ id: 'shortcuts', title: 'Keyboard shortcuts', group: 'Help', term: 'shortcuts', priority: 20,
            kw: 'keyboard shortcuts shortcut hotkey hotkeys',
            desc: 'Keyboard shortcuts: press ? for the full list. H is home, N is Nacho Mode.',
            how: 'Open the shortcut help, or press ? on your keyboard.',
            follow: 'Want cipher keys? Those are a different "keys," in Inventory.',
            hash: 'app/shortcuts', aliases: ['shortcuts', 'keyboard'], kind: 'keyshelp',
            openFns: ['showKeyboardHelp'] }),
        R({ id: 'exploration-map', title: 'Exploration Map', group: 'Help', term: 'exploration map', priority: 55,
            kw: 'exploration map visited topics progress coverage grid',
            desc: 'The Exploration Map shows which topics you have visited.',
            how: 'Go home and open the Exploration Map to see your coverage.',
            follow: 'Want the home page?',
            hash: 'app/exploration-map', aliases: ['exploration-map'], kind: 'home',
            openFns: ['goHome'] }),
        R({ id: 'online-status', title: 'Online Status', group: 'Account', term: 'online status', priority: 65,
            kw: 'online status presence invisible offline green dot activity',
            desc: 'Online Status lets you show or hide whether you are online to other people.',
            how: 'Open Settings → Prefs and change your online status.',
            follow: 'Want the rest of Preferences?',
            hash: 'app/online-status', aliases: ['online-status'], kind: 'settings', arg: 'prefs',
            settingsPages: ['prefs'], openFns: ['showSettings', 'showSettingsPage'] }),
        R({ id: 'profile-picture', title: 'Profile Picture', group: 'Account', term: 'profile picture', priority: 75,
            kw: 'profile picture photo avatar image upload pfp selfie portrait',
            desc: 'Your profile picture is the photo other people see on your account.',
            how: 'Open Settings → Account and upload or change your profile picture.',
            follow: 'Want the rest of your account settings?',
            hash: 'app/profile-picture', aliases: ['profile-picture'], kind: 'settings', arg: 'account',
            settingsPages: ['account', 'profile'], openFns: ['showSettings', 'showSettingsPage'] }),
        R({ id: 'audio', title: 'Sound effects', group: 'Help', term: 'audio', priority: 30, aux: true,
            kw: 'audio sound mute volume',
            desc: 'Sound effects can be turned on or off, and the volume slider sets how loud they are.',
            how: 'The sound toggle flips sound and remembers the choice. The M key opens a random meme, and it does not control sound.',
            follow: 'Want Preferences for the rest of the display options?',
            hash: 'app/audio', aliases: ['audio'], kind: 'audio', openFns: ['toggleAudio'] })
    ];

    var FEATURES = RAW.map(function (f) {
        f.keywords = (f.kw || '').split(/\s+/).filter(Boolean);
        f.aliases = f.aliases || [];
        f.open = makeOpen(f);
        f.openFns = f.openFns || [];
        f.hash = f.hash || ('app/' + f.id);
        f.priority = f.priority || 10;
        return f;
    });

    var BY_ID = {};
    FEATURES.forEach(function (f) { BY_ID[f.id] = f; });

    function answerText(f) {
        return f.desc + ' ' + f.how + (f.follow ? ' ' + f.follow : '');
    }

    function pack(id) {
        var f = BY_ID[id];
        if (!f) return null;
        return {
            featureId: f.id,
            id: f.id,
            title: f.title,
            answer: answerText(f),
            followUp: f.follow,
            siteAction: "window.bqOpenFeature('" + f.id + "')",
            siteLabel: 'Open it',
            isSiteNav: true,
            hash: f.hash
        };
    }

    var TYPOS = {
        ciper: 'cipher', cypher: 'cipher', ciphur: 'cipher',
        prediciton: 'prediction', predicition: 'prediction', predition: 'prediction', forcast: 'forecast',
        referal: 'referral', refferal: 'referral', referrral: 'referral',
        qest: 'quest', questt: 'quest',
        leaderbord: 'leaderboard', leadeboard: 'leaderboard', leaderbaord: 'leaderboard',
        notifcations: 'notifications', notificaton: 'notification', notifcation: 'notification',
        setings: 'settings', settigns: 'settings',
        inventroy: 'inventory', invetory: 'inventory', inventry: 'inventory',
        lightening: 'lightning', lightining: 'lightning', ligtning: 'lightning',
        fuacet: 'faucet', facuet: 'faucet',
        triva: 'trivia', trivai: 'trivia',
        schollar: 'scholar', schoar: 'scholar',
        keybord: 'keyboard', keybaord: 'keyboard',
        shorcut: 'shortcut', shortuct: 'shortcut',
        donaton: 'donation',
        mesage: 'message', messge: 'message',
        foram: 'forum',
        marketpalce: 'marketplace', marketplce: 'marketplace',
        dashbord: 'dashboard',
        tiket: 'ticket', tikcet: 'ticket',
        raffel: 'raffle',
        citidel: 'citadel', citadell: 'citadel',
        satosi: 'satoshi', satoshis: 'satoshi',
        favour: 'favor',
        whell: 'wheel',
        freind: 'friend', frend: 'friend',
        partneship: 'partnership',
        badeg: 'badge',
        shoutuot: 'shoutout',
        memepool: 'mempool', memepol: 'mempool',
        begginer: 'beginner', beginer: 'beginner',
        crytpo: 'crypto'
    };

    function fixTypos(s) {
        return String(s || '').split(/\s+/).map(function (w) {
            var bare = w.replace(/[^a-z0-9']/gi, '');
            var low = bare.toLowerCase();
            if (TYPOS[low]) return w.replace(bare, TYPOS[low]);
            return w;
        }).join(' ');
    }

    var STOP = { how: 1, do: 1, does: 1, i: 1, me: 1, my: 1, the: 1, a: 1, an: 1, to: 1, of: 1, is: 1, are: 1, was: 1, where: 1, what: 1, can: 1, for: 1, in: 1, on: 1, it: 1, this: 1, please: 1, want: 1, with: 1, you: 1, your: 1, and: 1, or: 1, from: 1, about: 1, should: 1, would: 1, could: 1, there: 1, that: 1, have: 1, get: 1, open: 1 };

    function stem(w) {
        if (w.length > 4 && w.slice(-3) === 'ies') return w.slice(0, -3) + 'y';
        if (w.length > 3 && w.slice(-1) === 's' && w.slice(-2) !== 'ss') return w.slice(0, -1);
        return w;
    }
    function norm(s) {
        return fixTypos(String(s || '').toLowerCase()).replace(/['’]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    function tokens(s) {
        return norm(s).split(' ').filter(Boolean).map(stem).filter(function (w) { return !STOP[w] && w.length > 1; });
    }
    function lev(a, b) {
        if (a === b) return 0;
        if (!a.length) return b.length;
        if (!b.length) return a.length;
        var prev = [];
        var cur = [];
        var i, j;
        for (j = 0; j <= b.length; j++) prev[j] = j;
        for (i = 1; i <= a.length; i++) {
            cur[0] = i;
            for (j = 1; j <= b.length; j++) {
                var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
                cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
            }
            var tmp = prev; prev = cur; cur = tmp;
        }
        return prev[b.length];
    }
    function tokenSim(q, t) {
        if (q === t) return 1;
        if (q.length >= 4 && t.length >= 4 && (t.indexOf(q) === 0 || q.indexOf(t) === 0)) return 0.82;
        if (q.length >= 5 && t.length >= 5) {
            var d = lev(q, t);
            var max = q.length >= 8 ? 2 : 1;
            if (d > 0 && d <= max && d / Math.max(q.length, t.length) <= 0.34) return 0.7;
        }
        return 0;
    }
    function bestSim(qt, list) {
        var best = 0;
        for (var i = 0; i < list.length; i++) {
            var s = tokenSim(qt, list[i]);
            if (s > best) best = s;
        }
        return best;
    }

    function scoreFeature(f, qTokens, phrase) {
        var titleT = tokens(f.title);
        var kwT = f.keywords.map(stem);
        var descT = tokens(f.desc + ' ' + f.how);
        var score = 0;
        for (var i = 0; i < qTokens.length; i++) {
            var qt = qTokens[i];
            var ts = bestSim(qt, titleT);
            var ks = bestSim(qt, kwT);
            var ds = bestSim(qt, descT);
            score += ts * 14 + ks * 11 + ds * 4;
        }
        if (phrase && norm(f.title + ' ' + f.kw).indexOf(phrase) !== -1) score += 18;
        if (qTokens.length === 1 && qTokens[0] === 'key') {
            if (f.id === 'keys') score += 40;
            if (f.id === 'shortcuts') score -= 30;
        }
        score += (f.priority || 0) * 0.02;
        return score;
    }

    function searchFeatures(query) {
        var phrase = norm(query);
        var qTokens = tokens(query);
        if (!phrase || phrase.length < 2) return [];
        if (!qTokens.length) qTokens = phrase.split(' ').map(stem);
        var rows = [];
        for (var i = 0; i < FEATURES.length; i++) {
            var f = FEATURES[i];
            var s = scoreFeature(f, qTokens, phrase);
            if (s >= 8) rows.push({ feature: f, score: s });
        }
        rows.sort(function (a, b) {
            if (b.score !== a.score) return b.score - a.score;
            return (b.feature.priority || 0) - (a.feature.priority || 0);
        });
        return rows;
    }

    // Ordered, specific-first. First hit wins. null means "let the Bitcoin KB answer".
    function resolveId(raw) {
        var s = norm(raw);
        if (!s || s.length < 2) return null;
        if (/bitcoin price|current price|price now|price of bitcoin|how much is bitcoin/.test(s) && !/predict/.test(s)) return null;
        if (/what is bitcoin\b|how does bitcoin work|who is satoshi nakamoto/.test(s) && !/favor|story|nook|raid|citadel/.test(s)) return null;

        if (/locked cipher|open (a |the |my )?(locked )?cipher|\bcipher\b/.test(s)) {
            if (/\bkey\b/.test(s) && /get|send|need|for my|from a peer|give/.test(s) && !/open (a |the |my )?locked|how do i open/.test(s)) return 'keys';
            return 'ciphers';
        }
        if (/keyboard shortcut|hotkey|what are the shortcuts|shortcut help/.test(s)) return 'shortcuts';
        if (/\bkey\b/.test(s) && /cipher|peer|inventory|send/.test(s)) return 'keys';
        if (/^keys?$|cipher keys|get a key|need a key/.test(s)) return 'keys';

        if (/2fa|two factor|two-factor|authenticator|turn on 2 ?fa|change (my )?password|delete (my )?account|block users/.test(s)) return 'security';
        if (/dark mode|oled|font size|light mode|theme|preferences|experience mode/.test(s)) return 'prefs';
        if (/export (my )?data|download my data/.test(s)) return 'export';
        if (/honey badger|cyber hornet|pick a faction|choose a faction|\bfaction\b/.test(s)) return 'faction';
        if (/lightning address|add my lightning|payout address/.test(s)) return 'ln-address';
        if (/claim sats|faucet|how do i claim|withdraw sats|cash out/.test(s)) return 'sats';
        if (/referral|refer a friend|referr|invite (a )?friend/.test(s)) return 'referral';

        if (/shout ?out/.test(s)) return 'shoutout';
        if (/gift bag/.test(s)) return 'gift-bag';
        if (/open (my |the |a )?gifts?|how do i open (my )?gift/.test(s)) return 'gifts';
        if (/partnership|wumbo/.test(s)) return 'partnership';
        if (/add a peer|\bpeers?\b|peer request/.test(s)) return 'peers';
        if (/double xp|2x xp/.test(s)) return 'double-xp';
        if (/hint token|\bhints?\b/.test(s) && /token|quiz|nook|what are hint/.test(s)) return 'hint-token';
        if (/streak freeze|freeze (my )?streak/.test(s)) return 'streak-freeze';
        if (/hash booster|second rig/.test(s)) return 'hash-booster';
        if (/raffle/.test(s)) return 'raffle';
        if (/inventory/.test(s)) return 'inventory';
        if (/nook|what can i buy/.test(s)) return 'nook';

        if (/price prediction|predict the price|prediction game|up or down/.test(s)) return 'predictions';
        // "Milton Friedman's Bitcoin prediction" is a history fact, not the 24-hour game.
        if (/\bpredictions?\b/.test(s) && !/friedman|milton|who predicted|predicted bitcoin/.test(s)) return 'predictions';
        if (/raid boss|\braid\b/.test(s)) return 'raid';
        if (/citadel/.test(s)) return 'citadel';
        if (/donate xp|xp to charity|\bcharity\b/.test(s)) return 'charity';
        if (/how do i donate|donate to (the )?(archive|site|app)|support the archive/.test(s)) return 'donate';
        if (/tip (another|a|other) user|how do i tip|lightning tip|send a tip/.test(s)) return 'tips';
        if (/community challenge/.test(s)) return 'community';
        if (/satoshi'?s favor|satoshi favor/.test(s)) return 'favor';
        if (/what is flex|flex in quest|flex tab|healthy habit/.test(s)) return 'qh-flex';
        if (/daily poll|where is the poll|\bpoll\b/.test(s)) return 'qh-poll';
        if (/daily trivia|where is the trivia|\btrivia\b/.test(s) && !/pvp|battle/.test(s)) return 'qh-trivia';
        if (/quiz me|^quiz me\b|pop quiz/.test(s)) return 'quiz-me';
        if (/daily quiz|where is the quiz|quest hub quiz/.test(s)) return 'qh-quiz';
        if (/quest hub|\bquesthub\b/.test(s)) return 'quest-hub';

        if (/hot topics?/.test(s)) return 'hot-topics';
        if (/where is the faq|\bfaq\b|the guide|show me the guide/.test(s)) return 'faq';
        if (/sats vs bits|sats or bits/.test(s)) return 'sats-vs-bits';
        if (/meetup builder/.test(s)) return 'meetup-builder';
        if (/proof of walk|\bstrava\b|\bwalk\b/.test(s) && !/proof of work/.test(s)) return 'proof-of-walk';
        if (/arcade|proof of play/.test(s)) return 'proof-of-play';
        if (/\bpvp\b|trivia battle/.test(s)) return 'pvp';
        if (/say hi|say hello|saying hi|community hello/.test(s)) return 'say-hi';
        if (/global chat/.test(s)) return 'global-chat';
        if (/direct message|\bdms?\b|\binbox\b/.test(s)) return 'dms';
        if (/bitcoin buddy|\bbuddy\b/.test(s)) return 'buddy';
        if (/plebtalk|\bforum\b/.test(s)) return 'forum';
        if (/marketplace|lightningmart|\bmarket\b/.test(s) && !/cap|stock/.test(s)) return 'marketplace';
        if (/watch 10|10 minutes of timechain|10 min of timechain|daily tv challenge|tctv daily watch/.test(s)) return 'tctv-watch';
        if (/timechain tv|\btv\b/.test(s)) return 'tv';
        if (/bitcoin music|bitcoin beats|\bbeats\b|dj mode|where can i listen/.test(s)) return 'beats';
        if (/mempool|network stats|bitcoin dashboard|\bdashboard\b/.test(s)) return 'dashboard';
        if (/notification/.test(s)) return 'notifications';
        if (/exploration map|visited topics/.test(s)) return 'exploration-map';
        if (/online status|go invisible|presence indicator/.test(s)) return 'online-status';
        if (/profile (picture|photo|pic)|\bavatar\b|\bpfp\b/.test(s)) return 'profile-picture';
        if (/where are the settings|open settings|\bsettings\b/.test(s) && !/nacho/.test(s)) return 'settings';
        if (/sign in|log in|login|create an account|how do i sign/.test(s)) return 'signin';
        if (/orange ticket/.test(s)) return 'tickets';
        if (/\bbadges?\b/.test(s)) return 'badges';
        if (/earn points|earn xp|overflow|how do i earn points|how do i earn xp|what are points|daily cap/.test(s)) return 'xp';
        if (/leaderboard/.test(s)) return 'leaderboard';
        if (/spin wheel|daily spin|\bwheel\b|\bspin\b/.test(s)) return 'wheel';
        if (/flashcard/.test(s)) return 'flashcards';
        if (/scholar|certification/.test(s)) return 'scholar';
        if (/signal|newsletter/.test(s)) return 'signal';
        if (/nacho'?s story|where is nacho/.test(s) && /story|chapter/.test(s)) return 'story';
        if (/dress|closet|outfit/.test(s)) return 'closet';
        if (/eli5|explain like i/.test(s)) return 'eli5';
        if (/nacho mode/.test(s)) return 'nacho-mode';
        if (/how do i ask you|ask nacho|mini nacho|ask you a question/.test(s)) return 'mini-nacho';
        if (/learning quest/.test(s)) return 'learning-quests';
        if (/nacho'?s trails|\btrails?\b/.test(s)) return 'trails';
        if (/brand new|where do i start|one stop|i am new|channels should i start|what channels should/.test(s)) return 'one-stop-shop';
        if (/first bitcoin|buy my first|how do i buy/.test(s)) return 'first-purchase';
        if (/random meme|show me a meme|\bmemes?\b/.test(s)) return 'random';
        if (/what is the lightning network|lightning network channel|education channels/.test(s)) return 'channels';
        if (/lightning wallet|connect a (lightning )?wallet|connect a lightning/.test(s)) return 'lightning-wallet';
        if (/home page|back to (the )?home|go home|get back to the home/.test(s)) return 'home';
        if (/find a (bitcoin )?meetup|irl sync|\bmeetup\b/.test(s)) return 'irl';
        if (/where is the (global )?chat|\bchat\b/.test(s) && !/nacho/.test(s)) return 'global-chat';

        var hits = searchFeatures(s).filter(function (h) { return !h.feature.aux; });
        if (!hits.length) return null;
        var top = hits[0];
        var second = hits[1] ? hits[1].score : 0;
        if (top.score < 18) return null;
        // "Satoshi" alone is not the Satoshi's Favor feature. A fuzzy hit needs a
        // distinctive title word, or two title words, before it steals a fact question.
        var qTokens = tokens(s);
        var titleHits = tokens(top.feature.title).filter(function (t) { return qTokens.indexOf(t) !== -1; });
        var genericTitle = { bitcoin: 1, satoshi: 1, nacho: 1 };
        var distinctive = titleHits.filter(function (t) { return !genericTitle[t]; });
        var featTokens = tokens(top.feature.title + ' ' + (top.feature.kw || ''));
        var outside = qTokens.filter(function (t) { return t.length >= 4 && featTokens.indexOf(t) === -1; });
        // Extra names ("Milton Friedman", "genesis block") mean this is a fact, not the feature.
        if (outside.length > 1) return null;
        if ((distinctive.length >= 1 || titleHits.length >= 2) && (top.score - second >= 6 || qIntent(s))) return top.feature.id;
        return null;
    }
    function qIntent(s) {
        return /how|where|open|find|show|earn|claim|turn|add|send|unlock|start|play|watch|listen|what is|what are/.test(s);
    }

    function resolveNachoFeature(input) {
        var id = resolveId(input);
        return id ? pack(id) : null;
    }

    function featureByHash(hash) {
        var h = String(hash || '').replace(/^#/, '').replace(/^\/app\//, 'app/').split('?')[0];
        if (!h) return null;
        if (h.indexOf('beats/') === 0 || h.indexOf('cert/') === 0) return null;
        if (h.indexOf('app/') === 0) {
            var id = h.slice(4);
            return BY_ID[id] || null;
        }
        for (var i = 0; i < FEATURES.length; i++) {
            var f = FEATURES[i];
            if (f.hash === h) return f;
            if (f.aliases.indexOf(h) !== -1) return f;
        }
        return null;
    }

    function openerReady(f) {
        var names = f.openFns || [];
        var needsQuest = f.kind === 'quest' || f.kind === 'cipher' || f.kind === 'inventory' || f.kind === 'favor' || f.kind === 'raid';
        if (needsQuest) {
            // ranking.js defines openKeysAndCiphers before quests.js loads. That is not ready.
            if (typeof win.showQuestHub === 'function' || typeof win.openNookInventory === 'function') return true;
            if (f.kind === 'raid' && typeof win.openRaidHub === 'function') return true;
            return false;
        }
        if (!names.length) return true;
        for (var j = 0; j < names.length; j++) {
            if (typeof win[names[j]] === 'function') return true;
        }
        return false;
    }

    function bqRouteHash(hash, attempt) {
        var f = featureByHash(hash);
        if (!f) return false;
        // Already opening a feature. Swallow only this feature hash so a channel
        // hashtag tapped during the window still falls through to handleHash.
        if (win._bqSuppressRoute) return true;
        // Don't steal a real education-channel hash (for example #predictions).
        var bare = String(hash || '').replace(/^#/, '');
        if (bare.indexOf('app/') !== 0 && bare.indexOf('/') === -1 && typeof win.CHANNELS === 'object' && win.CHANNELS && win.CHANNELS[bare] && f.hash !== bare && f.aliases.indexOf(bare) === -1) {
            return false;
        }
        // #questhub aliases Raid, and opening the hub rewrites every deep link to that hash.
        // Only a cold load with no prior deep link should open Raid. An open hub keeps its tab.
        if (bare === 'questhub') {
            var hubOpen = typeof document !== 'undefined' && document.getElementById && document.getElementById('questHubOverlay');
            var priorOther = win._bqDeepLinkHandled && win._bqLastRouted && win._bqLastRouted !== 'questhub';
            if (hubOpen || priorOther) return true;
        }
        var now = Date.now();
        if (!attempt) {
            if (win._bqLastRouted === bare && now - (win._bqLastRoutedAt || 0) < 800) return true;
            win._bqLastRouted = bare;
            win._bqLastRoutedAt = now;
        }
        if (!openerReady(f)) {
            // Claim the deep link so quests.js does not open Raid over a tab we are still waiting to show.
            win._bqDeepLinkHandled = true;
            if (typeof win._loadDeferred === 'function') {
                try { win._loadDeferred(); } catch (e0) {}
            }
            var n = (attempt || 0) + 1;
            if (n * 300 <= 10000) {
                setTimeout(function () { bqRouteHash(bare, n); }, 300);
                return true;
            }
        }
        // showQuestHub pushes #questhub. Ignore that hashchange, or it reopens Quiz a second later.
        win._bqSuppressRoute = true;
        win._bqDeepLinkHandled = true;
        setTimeout(function () { win._bqSuppressRoute = false; }, 1500);
        try { f.open(); } catch (e) {}
        return true;
    }

    function bqOpenFeature(id) {
        var f = BY_ID[id];
        if (!f) return;
        var hash = f.hash || ('app/' + f.id);
        win._bqSuppressRoute = true;
        try {
            if (win.history && win.history.pushState) win.history.pushState({ feature: f.id }, '', '#' + hash);
            else win.location.hash = hash;
        } catch (e) {}
        setTimeout(function () { win._bqSuppressRoute = false; }, 400);
        try { f.open(); } catch (e2) {}
    }

    function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderNachoAnswerCard(hit, question) {
        var f = BY_ID[hit.featureId || hit.id];
        // The follow-up is the chip only. The card body is the how-to.
        var text = f ? (f.desc + ' ' + f.how) : String(hit.answer || '');
        var follow = hit.followUp || (f && f.follow) || '';
        if (follow && text.indexOf(follow) !== -1) text = text.replace(follow, '').trim();
        var id = (f && f.id) || hit.featureId || '';
        var q = question || hit.q || (f && f.title) || '';
        var ground = resolveGround(q, null);
        var follows = [];
        if (follow && String(follow).length <= 90 && String(follow).slice(-1) === '?') follows.push(follow);
        (ground.followUps || []).forEach(function (item) {
            if (follows.length >= 3) return;
            if (follows.indexOf(item) === -1) follows.push(item);
        });
        win._bqLastFollowUps = follows.slice();
        win._bqLastFollowUp = follows[0] || '';
        var chip = follow
            ? '<button type="button" data-bq-chip="1" ontouchstart="event.stopPropagation();" onmousedown="event.stopPropagation();" onclick="event.stopPropagation();event.preventDefault();window.bqAskFollowUp(this.getAttribute(\'data-q\'))" data-q="' + esc(follow) + '" style="display:block;width:100%;margin-top:6px;padding:7px 8px;background:none;border:1px solid var(--border,#333);border-radius:8px;color:var(--text-muted,#aaa);font-size:0.78rem;cursor:pointer;font-family:inherit;text-align:left;">' + esc(follow) + '</button>'
            : '';
        var extras = follows.filter(function (item) { return item !== follow; });
        return '<div class="bq-nacho-card" data-bq-card="1" data-bq-chip="1" style="color:var(--text,#eee);line-height:1.55;">' +
            '<div>' + esc(text).replace(/\n/g, '<br>') + '</div>' +
            '<button type="button" data-bq-open="1" ontouchstart="event.stopPropagation();" onmousedown="event.stopPropagation();" onclick="event.stopPropagation();event.preventDefault();window.bqOpenFeature(\'' + id + '\')" style="width:100%;margin-top:10px;padding:10px;background:var(--accent,#f7931a);border:none;border-radius:8px;color:#fff;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;">Open it</button>' +
            '<a href="#' + esc(f ? f.hash : ('app/' + id)) + '" onclick="event.preventDefault();window.bqOpenFeature(\'' + id + '\')" style="display:block;margin-top:4px;text-align:center;font-size:0.72rem;color:var(--text-faint,#888);">#' + esc(f ? f.hash : id) + '</a>' +
            (ground.links && ground.links.length ? linkButtonsHtml(ground.links) : '') +
            chip +
            (extras.length ? followButtonsHtml(extras) : '') +
            '</div>';
    }

    function pickTip(q) {
        var s = norm(q || '');
        if (/price|buy|invest|sell/.test(s)) return 'Want the education page for your first Bitcoin purchase? It is not financial advice.';
        if (/wallet|seed|custody/.test(s)) return 'Want the self-custody channel, or the in-app Lightning wallet page?';
        if (/lightning|lnurl|bolt11/.test(s)) return 'Want the Lightning Network channel, or the in-app Lightning wallet page?';
        if (/halving|21 million|supply cap|block reward/.test(s)) return 'Want the Scarce channel for the supply cap and the halving?';
        if (/privacy|coinjoin|kyc/.test(s)) return 'Want the Privacy channel?';
        if (/full node|\bnode\b|consensus/.test(s)) return 'Want the Nodes channel?';
        if (/mining|hash/.test(s)) return 'Want Satoshi\'s Favor, the in-app hashing game?';
        if (/hello|how are you|thanks|thank|good morning/.test(s)) return 'Want me to open Quest Hub so you can earn a little XP today?';
        return '';
    }

    function titleKey(s) {
        return String(s || '')
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]/gu, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    // The registry also fills APP_PAGES, so the old search prints a second "⚡ App" row.
    function dropDuplicateAppRows(sr) {
        if (!sr || !sr.querySelectorAll) return;
        var keys = {};
        function addKey(s) {
            var k = titleKey(s);
            if (k) keys[k] = 1;
            var spaced = titleKey(String(s || '').replace(/[-_]/g, ' '));
            if (spaced) keys[spaced] = 1;
        }
        var cards = sr.querySelectorAll('[data-bq-feature]');
        var ci;
        for (ci = 0; ci < cards.length; ci++) {
            var label = cards[ci].querySelectorAll('div')[1];
            if (label) addKey(label.textContent);
            var feat = BY_ID[cards[ci].getAttribute('data-bq-feature')];
            if (!feat) continue;
            addKey(feat.title);
            var aliases = feat.aliases || [];
            for (var a = 0; a < aliases.length; a++) addKey(aliases[a]);
        }
        var rows = sr.querySelectorAll('.sr-item');
        for (ci = 0; ci < rows.length; ci++) {
            var row = rows[ci];
            if (row.getAttribute('data-bq-feature')) continue;
            var cat = row.querySelector('.sr-cat');
            if (!cat || cat.textContent.indexOf('App') === -1) continue;
            var titleDiv = row.querySelectorAll('div')[1];
            var appTitle = titleDiv ? titleDiv.textContent : '';
            if (keys[titleKey(appTitle)]) row.parentNode.removeChild(row);
        }
    }

    function bqAskFollowUp(text) {
        text = String(text || '');
        var mode = document.getElementById('nachoModeScreen');
        var modeInp = document.getElementById('nachoModeInput');
        if (mode && modeInp && typeof win.nachoModeSend === 'function') {
            modeInp.value = text;
            win.nachoModeSend();
            return;
        }
        if (typeof win.showNachoInput === 'function') win.showNachoInput();
        setTimeout(function () {
            var inp = document.getElementById('nachoInput');
            if (inp) {
                inp.value = text;
                if (typeof win.nachoAnswer === 'function') win.nachoAnswer();
            }
        }, 60);
    }

    function bqAskNacho(q) {
        win._bqSearchQuery = q || '';
        if (typeof win.showNachoInput === 'function') win.showNachoInput();
        setTimeout(function () {
            var inp = document.getElementById('nachoInput');
            if (inp) {
                inp.value = win._bqSearchQuery || '';
                if (inp.value && typeof win.nachoAnswer === 'function') win.nachoAnswer();
            }
        }, 80);
    }

    function appKnowledge() {
        var lines = [];
        for (var i = 0; i < FEATURES.length; i++) {
            var f = FEATURES[i];
            if (f.aux) continue;
            lines.push(f.title + ': ' + f.desc + ' ' + f.how);
        }
        var text = lines.join('\n');
        if (text.length > 9000) text = text.slice(0, 9000);
        return text;
    }

    // Top matching features only. The worker caps this again at 1500 chars.
    function appKnowledgeFor(q) {
        var hits = searchFeatures(q || '').filter(function (h) { return h.feature && !h.feature.aux; }).slice(0, 5);
        var lines = [];
        for (var i = 0; i < hits.length; i++) {
            var f = hits[i].feature;
            lines.push(f.title + ': ' + f.desc + ' ' + f.how);
        }
        var text = lines.join('\n');
        if (text.length > 1500) text = text.slice(0, 1500);
        return text;
    }

    function cleanLabel(s) {
        return String(s || '').replace(/[^A-Za-z0-9 .-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    }

    function userContext() {
        var u = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null;
        var name = (u && u.username) || '';
        try {
            if (!name) name = win.localStorage.getItem('btc_username') || '';
        } catch (e) {}
        var points = (u && u.points) || 0;
        var rank = '';
        try { if (typeof getLevel === 'function') rank = (getLevel(points) || {}).name || ''; } catch (e2) {}
        return { name: cleanLabel(name), rank: cleanLabel(rank), points: points | 0 };
    }

    function toAppPages() {
        return FEATURES.map(function (f) {
            return {
                id: '_' + f.id,
                featureId: f.id,
                title: f.title,
                desc: f.desc,
                keywords: f.keywords.join(' '),
                action: "window.bqOpenFeature('" + f.id + "')"
            };
        });
    }
    function toHashTargets() {
        var out = [];
        FEATURES.forEach(function (f) {
            var tags = [f.hash].concat(f.aliases);
            tags.forEach(function (tag) {
                if (!tag || tag.indexOf('/') !== -1) return;
                out.push({ tag: tag, label: f.title, featureId: f.id });
            });
        });
        return out;
    }
    function toSeoPages() {
        var ids = [];
        FEATURES.forEach(function (f) {
            if (f.hash && f.hash.indexOf('/') === -1 && ids.indexOf(f.hash) === -1) ids.push(f.hash);
        });
        return ids;
    }

    function installSearch(orig) {
        function bqCloseSearch() {
            var ov = document.getElementById('searchOverlay');
            if (ov) { ov.style.display = 'none'; ov.removeAttribute('data-open'); }
            var sr = document.getElementById('searchResults');
            if (sr) { sr.classList.remove('active'); sr.innerHTML = ''; }
            var side = document.getElementById('sidebarSearchResults');
            if (side && side !== sr) { side.classList.remove('active'); side.innerHTML = ''; }
            var cl = document.getElementById('channelList');
            if (cl) cl.style.display = '';
            ['searchInput', 'searchOverlayInput'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.value = '';
            });
            if (typeof win.isMobile === 'function' && win.isMobile()) {
                var sb = document.getElementById('sidebar');
                if (sb) sb.classList.remove('open');
            }
        }
        win.bqCloseSearch = bqCloseSearch;
        function resultsEl() {
            var overlay = document.getElementById('searchOverlay');
            var overlayOpen = overlay && (overlay.getAttribute('data-open') === '1' || overlay.style.display === 'flex');
            return overlayOpen ? document.getElementById('searchResults') : (document.getElementById('sidebarSearchResults') || document.getElementById('searchResults'));
        }
        function featureBlock(q) {
            var feats = searchFeatures(q).filter(function (row) { return row.feature && !row.feature.aux; }).slice(0, 12);
            if (!feats.length) return '';
            var html = '<div data-bq-feature-block="1"><div style="padding:8px 16px 4px;font-size:0.7rem;color:var(--text-faint);font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">' +
                feats.length + ' feature' + (feats.length === 1 ? '' : 's') + '</div><div>';
            feats.forEach(function (row) {
                var f = row.feature;
                var blurb = (f.id === 'ciphers' || f.id === 'keys') ? (f.desc + ' ' + f.how) : f.desc;
                html += '<div class="sr-item" data-bq-feature="' + f.id + '" style="border-left:3px solid var(--accent);cursor:pointer;" onclick="window.bqOpenFeature(\'' + f.id + '\');window.bqCloseSearch&&window.bqCloseSearch();">' +
                    '<div class="sr-cat">Feature</div>' +
                    '<div>' + esc(f.title) + '</div>' +
                    '<div class="sr-match">' + esc(blurb) + '</div>' +
                    '<button type="button" onclick="event.stopPropagation();event.preventDefault();window.bqOpenFeature(\'' + f.id + '\');window.bqCloseSearch&&window.bqCloseSearch();" style="margin-top:6px;padding:6px 12px;background:var(--accent,#f7931a);border:none;border-radius:8px;color:#fff;font-weight:800;cursor:pointer;font-family:inherit;">Open</button>' +
                    '</div>';
            });
            html += '</div></div>';
            return html;
        }
        function prependFeatures(q) {
            var sr = resultsEl();
            if (!sr) return;
            var old = sr.querySelector('[data-bq-feature-block]');
            if (old && old.parentNode) old.parentNode.removeChild(old);
            var block = featureBlock(q);
            win._bqSearchQuery = q;
            if (!block) return;
            var cl = document.getElementById('channelList');
            if (cl) cl.style.display = 'none';
            sr.classList.add('active');
            if (!sr.querySelector('.sr-item') && /No results/i.test(sr.textContent || '')) sr.innerHTML = '';
            sr.insertAdjacentHTML('afterbegin', block);
            dropDuplicateAppRows(sr);
        }
        var wrapped = function (q) {
            var text = (q == null) ? '' : String(q);
            ['searchInput', 'searchOverlayInput'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el && el.value !== text) el.value = text;
            });
            var low = text.toLowerCase();
            if (!text || text.length < 2 || low === 'satoshi' || low === 'deer') {
                if (typeof orig === 'function') return orig(text);
                return;
            }
            // Feature cards first, then the original channel and message search.
            if (typeof orig === 'function') {
                try { orig(text); } catch (e1) {}
            }
            prependFeatures(text);
            setTimeout(function () { prependFeatures(text); }, 650);
        };
        win._bqRefreshSearchFeatures = function (text) {
            try { prependFeatures(text); } catch (e2) {}
        };
        wrapped._bq = true;
        win.doSearch = wrapped;
    }

    var GROUND_LINKS = [
        { re: /\b(price|priced|ath|chart|charts|market|euro|euros|pound|pounds|yen)\b|\b(?:what(?:'s| is)|how much)\b[^?]{0,40}\bworth\b/i, ids: ['charts', 'market_cap', 'ta_tips'] },
        { re: /\b(fees?|mempool)\b/i, ids: ['transaction_fees', 'vbyte', 'blockchain-timechain'], skip: /\blightning\b/i },
        { re: /\b(height|timechain|current block)\b/i, ids: ['blockchain-timechain', 'block_time-block-size'] },
        { re: /\b(halving|scarce|21 million|subsidy)\b/i, ids: ['scarce', 'mining'] },
        { re: /\b(hashrate|hash rate|mining|difficulty)\b/i, ids: ['mining', 'difficulty-adjustment'] },
        { re: /\b(wallet|seed|custody|private key)\b/i, ids: ['self-custody', 'public_key_vs_private_key'] },
        { re: /\blightning\b/i, ids: ['layer-2-lightning', 'lightning_node'] },
        { re: /\b(buy|invest|dca|should i)\b/i, ids: ['investment-strategy', 'self-custody', 'charts'] },
        { re: /\butxos?\b/i, ids: ['utxos', 'blockchain-timechain'] },
        { re: /\b(node|verify|able)\b/i, ids: ['nodes', 'consensus'] }
    ];
    var FOLLOW_BY_RE = [
        { re: /\b(seed phrase|seed words|private key|custody|wallet)\b/i, qs: ['Why is self-custody important?', 'What is a seed phrase?', 'What does not your keys, not your coins mean?'] },
        { re: /\b(price|priced|ath|chart|charts|market|euro|euros|pound|pounds|yen)\b|\b(?:what(?:'s| is)|how much)\b[^?]{0,40}\bworth\b/i, qs: ['How much did Bitcoin change in 24 hours?', 'What is 1 Bitcoin in euros?', 'What are Bitcoin fees right now?'] },
        { re: /\b(fees?|mempool)\b/i, qs: ['What is the current block height?', 'What is a transaction fee?', 'When is the next Bitcoin halving?'], skip: /\blightning\b/i },
        { re: /\b(halving|subsidy|scarce)\b/i, qs: ['How many bitcoin have been mined?', 'What is the current block height?', 'What is proof of work?'] },
        { re: /\b(hashrate|hash rate|mining|difficulty)\b/i, qs: ['What is proof of work?', 'When is the next Bitcoin halving?', 'What is a Bitcoin node?'] },
        { re: /\b(height|timechain|block)\b/i, qs: ['When is the next Bitcoin halving?', 'What is the mempool?', 'What is a UTXO?'] },
        { re: /\blightning\b/i, qs: ['What is the Lightning Network?', 'What is a satoshi?', 'What are Bitcoin fees right now?'] },
        { re: /\b(buy|invest|dca)\b/i, qs: ['What is dollar-cost averaging?', 'Why is self-custody important?', 'What is the Bitcoin price right now?'] },
        { re: /\butxos?\b/i, qs: ['What is a transaction fee?', 'What is the current block height?', 'What is a Bitcoin node?'] }
    ];
    var GROUND_QUESTIONS = [
        'What is the Bitcoin price right now?',
        'What are Bitcoin fees right now?',
        'What is the current block height?',
        'When is the next Bitcoin halving?',
        'What is a satoshi?',
        'Why is self-custody important?',
        'What is the Lightning Network?',
        'What is proof of work?'
    ];

    function topicLinkTitle(id) {
        var table = (typeof CHANNELS !== 'undefined') ? CHANNELS : win.CHANNELS;
        var row = table && table[id];
        var raw = row && row.title ? String(row.title) : id;
        raw = raw.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!raw) raw = id;
        if (raw.length > 40) raw = raw.slice(0, 40).trim();
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    }

    function fallbackLinks(q) {
        var text = String(q || '').toLowerCase();
        var ids = [];
        GROUND_LINKS.forEach(function (row) {
            if (row.skip && row.skip.test(text)) return;
            if (row.re.test(text)) ids = ids.concat(row.ids);
        });
        if (!ids.length) ids = ['one-stop-shop', 'faq-glossary'];
        var out = [];
        var seen = {};
        ids.forEach(function (id) {
            if (seen[id] || out.length >= 3) return;
            seen[id] = 1;
            out.push({ id: id, title: topicLinkTitle(id), hash: id, kind: 'topic' });
        });
        return out;
    }

    function fallbackFollowUps(q) {
        var text = String(q || '');
        var current = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        var picked = null;
        FOLLOW_BY_RE.forEach(function (row) {
            if (!picked && !(row.skip && row.skip.test(text)) && row.re.test(text)) picked = row.qs;
        });
        var source = picked || GROUND_QUESTIONS;
        var out = [];
        source.forEach(function (item) {
            if (out.length >= 3) return;
            var key = item.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
            if (key === current) return;
            if (item.length > 90 || item.charAt(item.length - 1) !== '?') return;
            out.push(item);
        });
        return out.slice(0, 3);
    }

    win.bqNachoGround = {
        groundQuestion: function (q) {
            return { links: fallbackLinks(q), followUps: fallbackFollowUps(q) };
        }
    };

    function formatAsOf(value) {
        var ms = typeof value === 'number' ? value : Date.parse(value);
        if (!isFinite(ms)) return '';
        var label = '';
        try { label = new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }); } catch (e) { label = ''; }
        return label ? ('As of ' + label) : '';
    }

    function asOfHtml(value) {
        var label = formatAsOf(value);
        if (!label) return '';
        var iso = '';
        try { iso = new Date(typeof value === 'number' ? value : Date.parse(value)).toISOString(); } catch (e2) { iso = String(value); }
        return '<div data-bq-asof="' + esc(iso) + '" style="margin-top:6px;font-size:0.72rem;color:var(--text-faint,#666);">' + esc(label) + '</div>';
    }

    function resolveGround(q, result) {
        var links = result && result.links && result.links.length ? result.links.slice(0, 3) : [];
        var followUps = result && result.followUps && result.followUps.length ? result.followUps.slice(0, 3) : [];
        var g = null;
        if ((!links.length || followUps.length < 2) && win.bqNachoGround && typeof win.bqNachoGround.groundQuestion === 'function') {
            try { g = win.bqNachoGround.groundQuestion(q || ''); } catch (e) {}
        }
        if (!links.length) links = (g && g.links && g.links.length) ? g.links : fallbackLinks(q);
        if (followUps.length < 2) followUps = (g && g.followUps && g.followUps.length) ? g.followUps : fallbackFollowUps(q);
        return { links: links.slice(0, 3), followUps: followUps.slice(0, 3) };
    }

    function linkButtonsHtml(links) {
        var html = '<div data-bq-links="1" style="margin-top:10px;">';
        html += '<div style="font-size:0.7rem;color:var(--text-faint,#666);margin-bottom:6px;letter-spacing:0.4px;">Learn more</div>';
        for (var i = 0; i < links.length && i < 3; i++) {
            var L = links[i] || {};
            var id = String(L.id || '').replace(/[^a-z0-9_-]/gi, '');
            if (!id) continue;
            var kind = L.kind === 'app' ? 'app' : 'topic';
            var click = kind === 'app'
                ? "if(window.bqOpenFeature)window.bqOpenFeature('" + id + "');"
                : "if(typeof go==='function')go('" + id + "');if(typeof hideBubble==='function')hideBubble(true);";
            html += '<button type="button" data-bq-topic="' + id + '" data-bq-kind="' + kind + '" ontouchstart="event.stopPropagation();" onmousedown="event.stopPropagation();" onclick="event.stopPropagation();event.preventDefault();' + click + '" style="display:block;width:100%;margin-top:4px;padding:8px;background:var(--accent,#f7931a);border:none;border-radius:8px;color:#fff;font-size:0.82rem;font-weight:800;cursor:pointer;font-family:inherit;text-align:left;">\uD83D\uDCD6 ' + esc(L.title || id) + '</button>';
        }
        html += '</div>';
        return html;
    }

    function followButtonsHtml(list) {
        var html = '<div data-bq-followups="1" style="margin-top:8px;">';
        html += '<div style="font-size:0.7rem;color:var(--text-faint,#666);margin-bottom:4px;">You might also ask:</div>';
        for (var i = 0; i < list.length && i < 3; i++) {
            var text = String(list[i] || '').trim();
            if (!text) continue;
            html += '<button type="button" data-bq-chip="1" data-q="' + esc(text) + '" ontouchstart="event.stopPropagation();" onmousedown="event.stopPropagation();" onclick="event.stopPropagation();event.preventDefault();window.bqAskFollowUp(this.getAttribute(\'data-q\'))" style="display:block;width:100%;margin-top:4px;padding:6px 8px;background:none;border:1px solid var(--border,#333);border-radius:8px;color:var(--text-muted,#aaa);font-size:0.78rem;cursor:pointer;font-family:inherit;text-align:left;">' + esc(text) + '</button>';
        }
        html += '</div>';
        return html;
    }
    win.nachoGroundHtml = function (links, followUps) {
        return linkButtonsHtml(links || []) + followButtonsHtml(followUps || []);
    };

    function decorateResult(result, q) {
        if (!result || result.rendered || !result.answer) return result;
        if (result.type === 'crisis' || result.type === 'harm' || result.suppressFollowUps) {
            win._bqLastFollowUp = '';
            win._bqLastFollowUps = [];
            win._bqLastLinks = [];
            win._bqLastAsOf = null;
            return result;
        }
        if (result.asOf && !/data-bq-asof/.test(result.answer)) result.answer += asOfHtml(result.asOf);
        if (/data-bq-links/.test(result.answer) && /data-bq-followups/.test(result.answer)) return result;
        var ground = resolveGround(q, result);
        if (ground.links.length && !/data-bq-links/.test(result.answer)) {
            result.links = ground.links;
            result.answer += linkButtonsHtml(ground.links);
        }
        if (ground.followUps.length && !/data-bq-followups/.test(result.answer)) {
            result.followUps = ground.followUps;
            result.followUp = ground.followUps[0] || '';
            win._bqLastFollowUps = ground.followUps.slice();
            win._bqLastFollowUp = result.followUp;
            result.answer += followButtonsHtml(ground.followUps);
        }
        if (!result.plainAnswer) {
            result.plainAnswer = String(result.answer).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        return result;
    }

    function plainFeatureAnswer(hit) {
        var f = BY_ID[hit.featureId];
        var hash = (f && f.hash) || hit.hash || ('app/' + hit.featureId);
        var body = f ? answerText(f) : String(hit.answer || '');
        body = String(body).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        return { hash: hash, text: body + ' 👉 #' + hash };
    }

    function wrapUnified(orig) {
        var wrapped = function (question, cb) {
            win._bqLastLinks = [];
            win._bqLastFollowUps = [];
            win._bqLastFollowUp = '';
            win._bqLastAsOf = null;
            // Crisis, harm, and profanity beat every feature card.
            if (typeof win.nachoSafetyCheck === 'function' && win.nachoSafetyCheck(question)) {
                win._bqLastFollowUp = '';
                win._bqSuppressFollowUps = true;
                return orig(question, function (result) {
                    win._bqSuppressFollowUps = false;
                    win._bqLastFollowUp = '';
                    if (result) {
                        result.followUp = '';
                        result.suppressFollowUps = true;
                        if (result.answer) {
                            result.answer = String(result.answer).replace(/<(button|div)[^>]*data-bq-chip[\s\S]*?<\/\1>/gi, '');
                        }
                    }
                    cb(result);
                });
            }
            win._bqLastFollowUp = '';
            win._bqLastFollowUps = [];
            var hit = resolveNachoFeature(question);
            if (hit) {
                var plain = plainFeatureAnswer(hit);
                var card = renderNachoAnswerCard(hit, question);
                win._bqLastFollowUp = (win._bqLastFollowUps && win._bqLastFollowUps[0]) || hit.followUp || '';
                if (typeof win.nachoRemember === 'function') {
                    try { win.nachoRemember(question, plain.text); } catch (e) {}
                }
                cb({
                    type: 'site',
                    answer: card,
                    plainAnswer: plain.text,
                    rendered: true,
                    featureId: hit.featureId,
                    followUp: hit.followUp,
                    siteLabel: 'Open it',
                    hash: plain.hash
                });
                return;
            }
            return orig(question, function (result) {
                try { result = decorateResult(result, question); } catch (e) {}
                cb(result);
            });
        };
        wrapped._bq = true;
        wrapped._bqOrig = orig;
        return wrapped;
    }

    function installNacho() {
        if (typeof win.nachoUnifiedAnswer === 'function' && !win.nachoUnifiedAnswer._bq) {
            win.nachoUnifiedAnswer = wrapUnified(win.nachoUnifiedAnswer);
        }
        if (typeof win.nachoFollowUps === 'function' && !win.nachoFollowUps._bq) {
            var prev = win.nachoFollowUps;
            var wrapped = function (answerText) {
                var a = String(answerText || '');
                if (/call or text 988|crisis text line|findahelpline\.com|i care about you/i.test(a) || win._bqSuppressFollowUps) {
                    win._bqLastFollowUp = '';
                    return [];
                }
                if (a.indexOf('data-bq-followups') !== -1 || a.indexOf('data-bq-chip') !== -1) return [];
                if (win._bqLastFollowUps && win._bqLastFollowUps.length) return win._bqLastFollowUps.slice(0, 3);
                if (win._bqLastFollowUp && a.indexOf(String(win._bqLastFollowUp).slice(0, 24)) !== -1) return [];
                if (win._bqLastFollowUp) return [win._bqLastFollowUp];
                var list = [];
                try { list = prev(a) || []; } catch (e) {}
                return list.slice(0, 3);
            };
            wrapped._bq = true;
            win.nachoFollowUps = wrapped;
        }
    }

    function installRouter() {
        // app.js handleHash already calls bqRouteHash. A second listener opens twice.
        if (win._bqAppRoutesHash) return;
        if (win._bqRouter) return;
        win._bqRouter = true;
        function go() {
            var h = (win.location && win.location.hash || '').replace(/^#/, '');
            if (!h && win.location && /\/app\/[^/]+/.test(win.location.pathname || '')) {
                h = 'app/' + win.location.pathname.split('/app/')[1];
            }
            if (h) bqRouteHash(h);
        }
        if (win.addEventListener) {
            win.addEventListener('hashchange', go);
            win.addEventListener('load', function () { setTimeout(go, 600); });
        }
    }

    function patchSettingsPeers() {
        if (typeof win.showSettingsPage !== 'function' || win.showSettingsPage._bqPeers) return;
        var orig = win.showSettingsPage;
        var wrapped = function (tab) {
            if (tab === 'peers') return settingsOpen('peers')();
            if (tab === 'profile') return settingsOpen('account')();
            return orig.apply(this, arguments);
        };
        wrapped._bqPeers = true;
        try { win.showSettingsPage = wrapped; } catch (e) {}
    }

    var api = {
        FEATURES: FEATURES,
        BY_ID: BY_ID,
        searchFeatures: searchFeatures,
        resolveNachoFeature: resolveNachoFeature,
        featureByHash: featureByHash,
        toAppPages: toAppPages,
        toHashTargets: toHashTargets,
        toSeoPages: toSeoPages,
        answerText: answerText,
        renderNachoAnswerCard: renderNachoAnswerCard,
        titleKey: titleKey,
        dropDuplicateAppRows: dropDuplicateAppRows,
        appKnowledge: appKnowledge,
        appKnowledgeFor: appKnowledgeFor,
        userContext: userContext,
        wrapUnified: wrapUnified
    };

    win.FEATURE_REGISTRY = FEATURES;
    win.bqSearchFeatures = searchFeatures;
    win.resolveNachoFeature = resolveNachoFeature;
    win.bqOpenFeature = bqOpenFeature;
    win.bqRouteHash = bqRouteHash;
    win.bqOpenByHash = function (tag) { return bqRouteHash(tag); };
    win.bqHashTargets = toHashTargets;
    win.bqToAppPages = toAppPages;
    win.bqSeoPages = toSeoPages;
    win.bqAppKnowledge = appKnowledge;
    win.bqAppKnowledgeFor = appKnowledgeFor;
    win.bqUserContext = userContext;
    win.bqWrapUnified = wrapUnified;
    win.renderNachoAnswerCard = renderNachoAnswerCard;
    win.bqAskFollowUp = bqAskFollowUp;
    win.bqAskNacho = bqAskNacho;
    win.APP_PAGES = toAppPages();
    win._SEO_APP_PAGES = toSeoPages();

    if (typeof document !== 'undefined') {
        installSearch(win.doSearch);
        installNacho();
        installRouter();
        patchSettingsPeers();
        var tries = 0;
        var timer = setInterval(function () {
            tries++;
            installNacho();
            if (typeof win.doSearch === 'function' && !win.doSearch._bq) installSearch(win.doSearch);
            patchSettingsPeers();
            if (tries > 40) clearInterval(timer);
        }, 500);
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
