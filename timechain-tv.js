// © 2024-2026 603BTC LLC. All rights reserved.
// timechain-tv.js — Timechain TV: Live Bitcoin Television
// All users watch the same content at the same time — no rewind, no fast forward.

(function() {
'use strict';

// ── Station Definitions ──
// Each station is a "channel" with a themed playlist of YouTube videos
// Videos play in order, looping forever, synced to global clock
var STATIONS = [
    {
        id: 'art-philosophy',
        name: 'Art & Philosophy',
        emoji: '🎨',
        desc: 'Bitcoin art, ordinals & deeper meaning',
        color: '#a855f7',
        videos: [
            { id: 'QVg0ZmxrYLo', title: 'Bitcoin\'s Most Beautifully Absurd Art Drop', duration: 1020 },
            { id: 'j3QJlyRMHpI', title: 'Art on Bitcoin: Shaping the Future of Digital Creativity', duration: 2700 },
            { id: 'XHBydlTt2jM', title: 'The Rise of Ordinals and Art on Bitcoin', duration: 1800 },
            { id: 'UrCN7oG_4YY', title: 'Bitcoin NFTs: How to Create Ordinal Inscriptions', duration: 900 },
            { id: 'ic6pDq3OAec', title: 'Philosophy of Bitcoin — First Principles', duration: 3600 },
            { id: 'yMoVGgR6h0Y', title: 'Money: The Language of Power — Robert Breedlove', duration: 3600 },
            { id: 'NALikCvCyes', title: 'The Truth About Money, Inflation and Bitcoin — Robert Breedlove', duration: 2400 },
            { id: 'JffTkZZC2z8', title: 'What is Money? — Robert Breedlove', duration: 1800 },
            { id: '1gnIbVFnuCY', title: 'The Biggest Scam in Human History — Robert Breedlove', duration: 5400 },
            { id: 'PqFz8R1CZYo', title: 'Bitcoin as a Kardashev-Scale Technology — Robert Breedlove', duration: 2400 },
            { id: 'cKkokcMMnpc', title: 'Bitcoin Aligns with the Laws of Nature — Robert Breedlove', duration: 1800 },
            { id: 'N3J868zhH9g', title: 'Bitcoin Is Encrypted Energy — Breedlove & Saylor', duration: 2400 },
            { id: '7DIp6D-68cQ', title: 'Can Bitcoin Rebuild Civilization? — Saifedean Ammous', duration: 3033 },
            { id: 'gb2S1Filtic', title: 'How Bitcoin Fixes Fiat\'s Millennium of Mistakes — Saifedean', duration: 1587 },
            { id: 'SKIIif9WQok', title: 'Bitcoin Renaissance Legacy: Beyond Digital Gold', duration: 1242 },
        ]
    },
    {
        id: 'conferences-events',
        name: 'Conferences & Events',
        emoji: '🎤',
        desc: 'Bitcoin conference speeches & keynotes',
        color: '#6366f1',
        videos: [
            { id: 'XdgP25UcHB0', title: 'Bitcoin for Corporations — Saylor & Dorsey', duration: 12600 },
            { id: 'HGyiOlXg-XY', title: 'Top 10 Most Iconic Bitcoin Conference Moments', duration: 1200 },
            { id: 'pDA2r4AblD0', title: 'How To Orange Pill Anyone — BitBlockBoom', duration: 2400 },
            { id: 'gCfA1lkmJo4', title: 'Michael Saylor — The Greatest Bitcoin Explanation', duration: 1200 },
            { id: 'nC37CqWpxfI', title: 'Saylor & Dorsey Interview', duration: 3400 },
            { id: 'reVebuAf_Cs', title: 'Michael Saylor: 21 Ways To Wealth — Bitcoin 2025 Keynote', duration: 2211 },
            { id: 'RoRZE2DpEzE', title: 'Jack Mallers: The HODLers Dilemma — Bitcoin 2025 Keynote', duration: 2098 },
            { id: '6fgFyQEWiK4', title: 'Saifedean Ammous: How Bitcoin Could End Wars — Amsterdam 2025', duration: 1691 },
            { id: 'hqoagNBtIps', title: 'Michael Saylor: Bitcoin Prophecy — BTC Prague 2025', duration: 2400 },
            { id: 'SFUiGTayVL8', title: 'Saifedean: Bitcoin & Tether — Drinking the Dollar Milkshake', duration: 857 },
            { id: 'dWaHWT15sOQ', title: 'Paolo Ardoino: Why Tether Loves Bitcoin — Bitcoin 2025', duration: 1029 },
            { id: 'R4gyS5mb9dE', title: 'Alex Gladstein: Dictators Should Be Afraid — Policy Summit 2025', duration: 1800 },
        ]
    },
    {
        id: 'culture-travel',
        name: 'Culture, Travel & Adoption',
        emoji: '🌍',
        desc: 'Bitcoin culture worldwide & global adoption',
        color: '#f97316',
        videos: [
            { id: 'Ve6oLiWO0Mg', title: 'Traveling the World on Bitcoin — Airbtc', duration: 900 },
            { id: '0hwC6BKJMpc', title: 'How Bitcoin is Revolutionizing Travel', duration: 720 },
            { id: 'kKSFh5Xxe3w', title: '48 Hours in El Salvador Paying Only With Bitcoin', duration: 1200 },
            { id: 'R8xZd8v7b50', title: 'Bitcoin Beach: El Salvador\'s Bitcoin Economy', duration: 1500 },
            { id: '0Ceey82hFTY', title: 'Booking Travel with Bitcoin — Travala', duration: 600 },
            { id: 'e0EPQg20SaQ', title: 'What 1792 Days in Bitcoin Taught Me — Get Based TV', duration: 540 },
            { id: 'LRSQSkiil0M', title: 'Inside the Bitcoin Revolution in Africa — Joe Nakamoto', duration: 1200 },
            { id: 'TauW_pLnstw', title: 'The Bitcoin Paradise You Have Never Heard Of — Joe Nakamoto', duration: 900 },
            { id: 'FelWKV6wVJU', title: 'Living on Bitcoin in a Small Town — Joe Nakamoto', duration: 1080 },
            { id: 'WoN0SVY73zo', title: 'You Can Live on Bitcoin in Lugano — Joe Nakamoto', duration: 1500 },
            { id: 'waQJEjiPWhg', title: 'Bitcoin Culture Around the World', duration: 1200 },
            { id: '7A56oZAs7ZQ', title: 'El Salvador Bitcoin Adoption Documentary', duration: 1800 },
            { id: 'BnR_kB44hy0', title: 'Bitcoin Berlín: The Secret Bitcoin City of El Salvador — Joe Nakamoto', duration: 1200 },
            { id: 'DfDWubdqU5I', title: 'I Begged Strangers for Bitcoin in Madeira — Joe Nakamoto', duration: 900 },
            { id: 'pxvDunp9820', title: 'Bitcoin in Peru: How a Poisoned Town Survives — Joe Nakamoto', duration: 1080 },
            { id: 'ic_4-EFJogY', title: 'From Accenture to Bitcoin Maximalist — Alexandre Laizet', duration: 503 },
            { id: 'cs3nEVX9ZWA', title: 'Bitcoin Is Transforming Access to Electricity and Finance — Gladstein', duration: 1800 },
        ]
    },
    {
        id: 'debates',
        name: 'Debates',
        emoji: '💬',
        desc: 'Bull vs bear & maximalist debates',
        color: '#ef4444',
        videos: [
            { id: 'xa5iT1nklyU', title: 'Brian Kelly vs Peter Schiff — Bitcoin Bull vs Bear', duration: 600 },
            { id: 'XJU8r6WiipM', title: 'Bitcoin vs Gold — Response to Peter Schiff', duration: 2400 },
            { id: '9DuhDgqx21w', title: 'Peter Schiff: Bitcoin Strategy is a Fraud', duration: 1800 },
            { id: 'aWtzOQTv8Dc', title: 'Saylor vs Dorsey: Battle for Bitcoin\'s Future', duration: 720 },
            { id: 'J6I-OzXItfA', title: 'Jack Dorsey Explains Bitcoin', duration: 600 },
            { id: 'tbCVXyUGO3o', title: 'I Bought This Instead of Bitcoin — Mark Moss', duration: 1200 },
            { id: 'D_yIKnHOuWg', title: 'Michael Saylor Answers the Question of Our Time', duration: 600 },
            { id: 'QT_YDxTl1FQ', title: 'Jack Mallers: Bitcoin Maximalist Post-GENIUS Act', duration: 1800 },
            { id: '3YuscY1L1zE', title: 'Why You Should Be a Bitcoin Maximalist', duration: 900 },
            { id: 'd5_cYWLpDs8', title: 'A Brief History of Bitcoin Maximalism', duration: 1500 },
            { id: 'yCtVkIEIhCg', title: 'Bitcoin Can Never Go to Zero — Robert Breedlove', duration: 1200 },
            { id: 'unCR7k3-aoE', title: 'Bitcoin Is the Apex Asset — Robert Breedlove', duration: 1500 },
            { id: '1jZQNo_rRsQ', title: 'Bitcoin Poised for Cycle Top? Corporate Treasuries — Saifedean', duration: 1763 },
            { id: 'MmdQKU0YNX4', title: 'Bitcoin Will Hit $850K — Max Keiser Prediction', duration: 1200 },
            { id: 'wBEqw-PSBlg', title: 'Why Selling Bitcoin for Fiat Misses the Picture — Mark Moss', duration: 1800 },
            { id: '2ZaMzWZyXe8', title: 'Wall Street Meets Bitcoin: Orange-Pilling Finance — Strive CEO', duration: 1320 },
            { id: 'JaMJi1_1tkA', title: 'Bitcoin Rap Battle: Hamilton vs. Satoshi — ft. EpicLloyd', duration: 600 },
        ]
    },
    {
        id: 'dev-privacy-nodes',
        name: 'Dev, Privacy & Nodes',
        emoji: '💻',
        desc: 'Building on Bitcoin, privacy & running nodes',
        color: '#22c55e',
        videos: [
            { id: 'yKdK-7AtAMQ', title: 'Bitcoin Lightning Network — How It Actually Works', duration: 1276 },
            { id: 'CG69c71aSLQ', title: 'Lightning Network Explained — Easy Guide', duration: 600 },
            { id: 'gLCyRFZOdGQ', title: 'How to Run a Bitcoin Lightning Node', duration: 1800 },
            { id: 'TASQj1hacuI', title: 'Bitcoin Privacy — Alex Gladstein', duration: 2400 },
            { id: 'MGNvaJyZ25A', title: 'Lightning Network: Everything You Need To Know', duration: 900 },
            { id: 'fsAUhFr1VXU', title: 'Bitcoin Privacy Made Simple: Wasabi Wallet Tutorial', duration: 1860 },
            { id: '52pSd3I1nac', title: 'Wasabi CoinJoin Tutorial — Self Custody Privacy', duration: 5040 },
            { id: 'U9hdav36WAo', title: 'How to Use Wasabi Wallet for Bitcoin CoinJoin', duration: 600 },
            { id: 'KNaOeLlD6NA', title: 'Build a Bitcoin Node on Raspberry Pi with Umbrel', duration: 1200 },
            { id: 'QeCIVUH89KY', title: 'Switch to Bitcoin Knots on Start9 — Full Sovereignty', duration: 900 },
            { id: 't4yuwtIhQIg', title: 'Start9: One-Click Bitcoin Node Setup Guide', duration: 1500 },
            { id: 'cmTrCoJKoig', title: 'Bitcoin Node From Scratch — Ubuntu + Bitcoin Knots + Solo Mining', duration: 1800 },
            { id: 'TpwnoPUyumA', title: 'Phoenix Wallet Tutorial — Self-Custody Lightning', duration: 1500 },
            { id: 'ZZKoSmQu30Q', title: 'Best Bitcoin Hardware Wallets Compared — BTC Sessions', duration: 3621 },
        ]
    },
    {
        id: 'documentaries',
        name: 'Documentaries',
        emoji: '🎬',
        desc: 'Bitcoin documentaries & films',
        color: '#dc2626',
        videos: [
            { id: '3XEuqixD2Zg', title: 'God Bless Bitcoin — Full Documentary', duration: 5352 },
            { id: '8Z4hGvUET8I', title: 'Bitcoin: Beyond The Bubble', duration: 4800 },
            { id: 'mgmVEtSgu3o', title: 'Bitcoin FUD — Full Documentary', duration: 3600 },
            { id: '4_tAOuMVFd0', title: 'Digital Gold — Full Documentary', duration: 5400 },
            { id: 'GZI0qo3diUo', title: 'Unlocking Crypto — The Bitcoin Field Guide', duration: 6500 },
            { id: 'ZKwqNgG-Sv4', title: 'Bitcoin: The End of Money As We Know It', duration: 5020 },
            { id: 'oksraL7wN6Q', title: 'God Bless Bitcoin — HD Version', duration: 5352 },
            { id: 'iVym9wtopqs', title: 'Banking on Bitcoin — Full Documentary', duration: 5400 },
            { id: 'm7_WDzPyoqU', title: 'I Live 500 Feet From a Bitcoin Mine — Investigative Doc', duration: 1260 },
            { id: 'tEnDP6p_9rY', title: 'Bitcoin Mining\'s Days Are Numbered — Cormint CEO', duration: 2940 },
            { id: 'd9DqvX7CJOc', title: 'The Fiat Standard: Can Bitcoin Fix This? — Saifedean', duration: 5591 },
            { id: 'M1JKLXxFDZc', title: 'Unconditional Advice for the Next Decade — Saifedean Ammous', duration: 1282 },
        ]
    },
    {
        id: 'economics-money',
        name: 'Economics & Money',
        emoji: '💰',
        desc: 'Austrian economics, inflation & sound money',
        color: '#eab308',
        videos: [
            { id: 'gp4U5aH_T6A', title: 'Bitcoin, Anarchy & Austrian Economics — Lex Fridman & Saifedean', duration: 10800 },
            { id: 'DKaZ-h-Wwhg', title: 'Bitcoin & Austrian Economics — Peter St. Onge', duration: 3600 },
            { id: 'fOpnpECKaY8', title: 'Bitcoin, Austrian Economics & Future of Money — Seb Bunney', duration: 4200 },
            { id: 'drs6Q_OX0HE', title: 'Austrian Economics Intro — The Bitcoin Way', duration: 3000 },
            { id: 'AdaHyUmRvCU', title: 'Austrian Economics & Monetary Policy of Bitcoin', duration: 1800 },
            { id: 'pZvy0JRz9GE', title: 'Saifedean: Bitcoin & Tether — Las Vegas Keynote', duration: 2576 },
            { id: 'hdtY_iMeVEg', title: 'Bitcoin Will Hit $100 Trillion Market — Saifedean Ammous', duration: 123 },
            { id: 'dlCbXoQokx0', title: 'Governments Will Accumulate Bitcoin — Mike Alfred on Coin Stories', duration: 1800 },
            { id: '8rYl8wEotZk', title: 'Strategy CEO on Bitcoin Yields & Adoption — Coin Stories', duration: 2400 },
            { id: 'V2r0EaJQwLA', title: 'Lyn Alden: Bitcoin Long-Term Bull Case — Coin Stories', duration: 2400 },
            { id: 'yDpMGUZZC4c', title: 'Bitcoin Is the Internet of Money — David Marcus on Coin Stories', duration: 1800 },
        ]
    },
    {
        id: 'freedom-sovereignty',
        name: 'Freedom & Self-Sovereignty',
        emoji: '🗽',
        desc: 'Human rights, financial freedom & sovereignty',
        color: '#0ea5e9',
        videos: [
            { id: 'xLYYh4aPXAM', title: 'Bitcoin Is Protecting Human Rights — Alex Gladstein', duration: 1800 },
            { id: 'TASQj1hacuI', title: 'Bitcoin as Freedom Money — Wyoming Symposium', duration: 2400 },
            { id: 'Z_p70BzkMAs', title: 'Bitcoin Protects Human Rights — Gladstein & Balaji', duration: 3600 },
            { id: 'A-QpLdoDF14', title: 'Financial Freedom Against Tyranny', duration: 1200 },
            { id: 'ZYN4X_l1ZXg', title: 'Financial Freedom and Bitcoin — HRF', duration: 1800 },
            { id: 'BoHNkX4OWQA', title: 'Jack Mallers on Bitcoin for El Salvador', duration: 1200 },
            { id: 'd5_cYWLpDs8', title: 'A Brief Look at Bitcoin Maximalism — Guy Swann', duration: 1800 },
            { id: 'Y5wgZ3rFayQ', title: 'Bitcoin is Monetary Free Speech', duration: 1200 },
            { id: 'zV_A2yMZl0w', title: 'Alex Gladstein: Bitcoin Privacy & Freedom — Bitcoin Magazine', duration: 1800 },
            { id: 'n5K1lEDv8aM', title: 'Afghan Women Using Bitcoin Under Taliban — Gladstein', duration: 1500 },
            { id: 'IBY8SdA3W4Y', title: 'Bitcoin for Generational Wealth & Freedom — Breedlove', duration: 1500 },
            { id: 'dKDnkf6c250', title: 'Why Sell Your House for Bitcoin? — Breedlove Defense', duration: 1200 },
            { id: '8Aofh-rx_l8', title: 'Bitcoin\'s Censorship Resistance Makes It Superior — Breedlove', duration: 1500 },
        ]
    },
    {
        id: 'future-predictions',
        name: 'Future & Predictions',
        emoji: '🔮',
        desc: 'Hyperbitcoinization & price predictions',
        color: '#8b5cf6',
        videos: [
            { id: 'BpKfLfGbf0Q', title: 'Bitcoin Hyperbitcoinization: $1.5M by 2028?', duration: 1800 },
            { id: 'iDgDl9jzEmk', title: 'Bitcoin Price Prediction Models Explained', duration: 2400 },
            { id: '1Mr9PknsM_Y', title: 'Michael Saylor\'s Best Explanation of Bitcoin', duration: 1200 },
            { id: 'hrjBK6AXAMk', title: 'Take The Bitcoin Orange Pill — How To Guide', duration: 1500 },
            { id: 'bPYl1-KBE50', title: 'The Ultimate Orange Pill — Bitcoin & Risk', duration: 900 },
            { id: "qX2fbQgxJig", title: "Why Bitcoin Could Reach $64M — Luke Mikic", duration: 3600 },
            { id: "jzY_SxnTLNA", title: "Bitcoin Is the Economic Singularity — Luke Mikic", duration: 2400 },
            { id: "Z51vRLKvco4", title: "Retiring on 0.1 Bitcoin — Luke Mikic", duration: 1800 },
            { id: "Sxv6wpU1380", title: "Is This Bitcoin Final Cycle? — Luke Mikic", duration: 2700 },
            { id: 'bw5Gepxo2Ps', title: 'Bitcoin Network Effects Model — 10x Users = 100x Price', duration: 2400 },
            { id: 'uF6Wx4Hr6iU', title: 'Tom Lee: Bullish Bitcoin Outlook & Corporate Treasuries — Coin Stories', duration: 1800 },
            { id: 'C9KPRcmFJWI', title: 'Bitcoin to $180K — Pomp Investments Prediction', duration: 1500 },
            { id: '3-vBBYEXv6M', title: 'Saylor: Bitcoin as Apex Capital Strategy in the AI Age', duration: 2100 },
        ]
    },
    {
        id: 'health-fitness',
        name: 'Health & Fitness',
        emoji: '💪',
        desc: 'Bitcoin mindset, carnivore & low time preference',
        color: '#16a34a',
        videos: [
            { id: 'mVMU1AFiSV0', title: 'Low Time Preference, Bitcoin and Health', duration: 3600 },
            { id: 'BQCOJlFXvpU', title: 'The Carnivore Diet & Bitcoin — Dr. Shawn Baker', duration: 6400 },
            { id: 'Rm5_wCObeQI', title: 'Carnivore Diet, Health Care Crisis & Bitcoin', duration: 4920 },
            { id: 'LjCRWwm0Xdk', title: 'Bitcoin Health Stack — Mind Body Sats', duration: 1800 },
            { id: 'c9D8p1kG0Cc', title: 'Bitcoin and Health with Jeff Booth', duration: 2400 },
            { id: 'lhHKljqRa-M', title: 'Low Time Preference Lifestyle — Bitcoin Way', duration: 1800 },
            { id: 'jn8uc92Oymo', title: 'Bitcoin Is Transforming Health & Energy Access Globally', duration: 1500 },
        ]
    },
    {
        id: 'history',
        name: 'History',
        emoji: '📜',
        desc: 'Bitcoin origins, cypherpunks & Satoshi',
        color: '#92400e',
        videos: [
            { id: 'dMSv4mgiy1o', title: 'How Bitcoin\'s Early Cypherpunks Paved the Way', duration: 1500 },
            { id: 'f-4Rs3Sqlhc', title: 'History of Bitcoin — Complete Timeline', duration: 2400 },
            { id: '8Z4hGvUET8I', title: 'Bitcoin: Beyond The Bubble — Origins', duration: 4800 },
            { id: 'iVym9wtopqs', title: 'The History of Bitcoin — Full Timeline', duration: 3600 },
            { id: 'ZKwqNgG-Sv4', title: 'Bitcoin: The End of Money As We Know It', duration: 5000 },
            { id: 'DyV0OfU3-FU', title: 'Satoshi Nakamoto — The Hidden History', duration: 2400 },
            { id: 'LjNMgeqUgks', title: 'The Man Who Spent Millions of Bitcoin on Pizza — 60 Minutes', duration: 42 },
            { id: 'pbFEexyOwkw', title: 'Bitcoin History: From Zero to Hero', duration: 1800 },
            { id: 'dYFMoK1nDmc', title: '60 Minutes: Bitcoin Beach El Salvador — CBS', duration: 780 },
            { id: 'wSh_KzcY_dA', title: '60 Minutes: Stories About Cryptocurrency — CBS', duration: 4000 },
        ]
    },
    {
        id: 'kids-family',
        name: 'Kids & Family',
        emoji: '👶',
        desc: 'Bitcoin explained for young audiences',
        color: '#f472b6',
        videos: [
            { id: 'BL5vUVQvmX4', title: 'What is Bitcoin? Explained in 3 Minutes — Tuttle Twins', duration: 180 },
            { id: 'qnyqQvIii0U', title: 'Cryptocurrency Explained for Kids & Beginners', duration: 600 },
            { id: '94I9L90h0_s', title: 'What is Cryptocurrency? — Kid-Friendly', duration: 300 },
            { id: 'Z3xdGIyIV54', title: 'How to Explain Bitcoin to Children — Dad & Daughter', duration: 480 },
            { id: 'tQ1_8M1K0tM', title: 'Cryptocurrency Explained to Kids — Twins', duration: 360 },
            { id: 'EfKuZayeksI', title: 'Bitcoin for Kids — Simple Explanation', duration: 420 },
            { id: '9ymZlz2l53I', title: 'What is Bitcoin? For Kids and Teens', duration: 360 },
        ]
    },
    {
        id: 'lightning',
        name: 'Lightning',
        emoji: '⚡',
        desc: 'Lightning Network & Layer 2',
        color: '#7c3aed',
        videos: [
            { id: 'yKdK-7AtAMQ', title: 'Lightning Network — How It Actually Works', duration: 1276 },
            { id: 'CG69c71aSLQ', title: 'Lightning Network Explained — Easy Guide', duration: 600 },
            { id: '9UIOeoBEjmw', title: 'Lightning Network Explained', duration: 480 },
            { id: 'zEeMco4KqGs', title: 'Lightning Network for Beginners', duration: 360 },
            { id: 'bW7hvvjum9o', title: 'Lightning Network: Everything You Need To Know', duration: 900 },
            { id: 'vmafxrT8eCU', title: 'Getting Started with Lightning Wallets', duration: 720 },
            { id: 'i4z-2v_0H1k', title: 'How Lightning Network Will Change Bitcoin', duration: 1200 },
            { id: '4kBCEbCWf1s', title: 'Lightning Network in Practice — Real Payments', duration: 900 },
            { id: 'Pef22g53zsg', title: 'Why Lightning is the Future of Payments', duration: 1500 },
            { id: '69QUHgHErx0', title: 'TOP Lightning Wallets in 2025 — How to Spend Bitcoin', duration: 1200 },
            { id: 'bDzbKH5dwys', title: 'Zeus Wallet Tutorial — Embedded Lightning Node', duration: 1500 },
        ]
    },
    {
        id: 'memes-comedy',
        name: 'Memes & Comedy',
        emoji: '😂',
        desc: 'Funny Bitcoin videos & meme compilations',
        color: '#facc15',
        videos: [
            { id: 'UDu5LOf_E-w', title: 'Bitcoin Memes Compilation', duration: 600 },
            { id: 'NMDABNK8j_Q', title: 'Funniest Crypto Memes — He Sold? Edition', duration: 480 },
            { id: 'RM1NdTvvtvk', title: 'Bitcoin Comedy Compilation', duration: 720 },
            { id: 'BgZO1ppaneg', title: 'Best Crypto TikToks Compilation', duration: 540 },
            { id: 'Ner16UBWdEg', title: 'Bitcoin Memes That Hit Different', duration: 480 },
            { id: 'heA1fZzRAFs', title: 'Funniest Bitcoin Moments Compilation', duration: 600 },
            { id: 'mEqr-8-TKrA', title: '30 People Turning Down FREE Bitcoin — Mike Still', duration: 420 },
            { id: 'd6ham2mibiA', title: 'Bitcoin Street Reactions Compilation', duration: 540 },
            { id: 'UX1GIhOhkAE', title: 'Me Saying Bitcoin', duration: 180 },
            { id: '61i2iDz7u04', title: 'BITCONNECT REMIX', duration: 240 },
            { id: 'fUFnLPblsBg', title: '100% Saylor — Michael Saylor Best Moments', duration: 600 },
        ]
    },
    {
        id: 'mining',
        name: 'Mining',
        emoji: '⛏️',
        desc: 'How Bitcoin mining works',
        color: '#ea580c',
        videos: [
            { id: 'El3y8AME8oA', title: 'How Bitcoin Mining Really Happens', duration: 900 },
            { id: 'lHipE05v4jg', title: 'How Bitcoin Mining Works — Complete Guide', duration: 1200 },
            { id: '33i1PdSJgwA', title: 'How Bitcoin Mining Actually Works, Simplified', duration: 600 },
            { id: '4HTtZhhXiAw', title: 'Bitcoin Mining Explained in 3 Minutes', duration: 180 },
            { id: 'yxfvEK7Nj8s', title: 'Bitcoin Mining Explained in 10 Minutes', duration: 600 },
            { id: 'DMfv8S8ffKA', title: 'Bitcoin Mining — Bloomberg Animated Explainer', duration: 300 },
            { id: '5Wp6lInPQv0', title: 'The Cruel Reality of Bitcoin Mining — VoskCoin', duration: 1200 },
            { id: 'rQFWgLQuGzo', title: 'VoskCoin Mining Farm Numbers', duration: 900 },
            { id: 'CC8wQJuhP5g', title: 'Compass Mining Year in Review', duration: 1800 },
            { id: 'ACAn_yL-Too', title: 'Bitcoin Mining — Inside a Real Facility', duration: 720 },
            { id: 'Bjcn5OZwgcs', title: 'Is Bitcoin Mining Still Profitable?', duration: 600 },
            { id: 'C4Z5yoWfnAU', title: 'Is Bitcoin Mining At Home Still Worth It in 2025?', duration: 1200 },
        ]
    },
    {
        id: 'music',
        name: 'Music',
        emoji: '🎵',
        desc: 'Bitcoin songs, rap & music videos',
        color: '#ec4899',
        videos: [
            { id: '8n5k714GOlA', title: 'HODL GANG — Bitcoin Rap Remix', duration: 240 },
            { id: 'eH9b_qNbjEU', title: 'Bitcoin — Official Music Video (Teejay)', duration: 210 },
            { id: 'EPQJHNXdJfM', title: 'Crypto — Takeoff feat. Rich The Kid', duration: 180 },
            { id: 'KQ7rn3oi-Pc', title: 'Blockchain — Money Man', duration: 195 },
            { id: 'VpvwgDjQLGA', title: 'Bitcoin All The Way Up — Dollar Vigilante', duration: 240 },
            { id: 'f-4Rs3Sqlhc', title: 'Bitcoin Anthem — Crypto Music', duration: 210 },
            { id: 'dgKlBQmGQ98', title: 'Most Toxic Bitcoin Maxi — Robbie P', duration: 240 },
            { id: 'IrcN-zmCZMI', title: 'If It Was Not For Satoshi — Robbie P', duration: 210 },
            { id: 'lG08pD-8upE', title: 'Bitcoin Slang Remix — Robbie P', duration: 225 },
            { id: 'CnTxBAeGfaQ', title: 'Diamond Hands & Laser Eyes — Robbie P', duration: 240 },
            { id: 'fG5PKg81mEQ', title: 'Fliponomics — Robbie P', duration: 210 },
            { id: 'A7TuFy0fcuw', title: 'Bitcoin Song — Community Playlist', duration: 240 },
            { id: 'c5wbgDLr-u0', title: 'Bitcoin Lofi Beats — Study & HODL', duration: 3600 },
            { id: 'gSxKJJ9k3lA', title: 'The Ultimate Crypto Anthem — Betawi CryptoCoin', duration: 394 },
            { id: '_c9WOks2mvg', title: 'Pump It Higher', duration: 210 },
            { id: 'FCA9i6MUCK0', title: 'Bitcoin Beats Mix — Volume 1', duration: 1800 },
            { id: 'XcerPhwbIFs', title: 'Orange Pill rApp — Wallet Stay Stackin\'!', duration: 240 },
            { id: 'Y5r6e1VcIBE', title: 'BITCOIN SONG — Pat Ryan', duration: 210 },
            { id: 'fZfg1Gtcg08', title: 'Bitcoin Baron — ytcracker', duration: 270 },
            { id: 'yp0diaVLPrQ', title: 'Mark Zuckerberg\'s Sister Sings to Crypto', duration: 240 },
            { id: 'YbzNJr26H-4', title: 'Welcome To The Blockchain — Toby Ganger + Decap', duration: 240 },
            { id: 'U5NGVH8HDaw', title: 'Bitcoin Boomdeyada!', duration: 180 },
            { id: 'kdvTkddp1F0', title: 'Don\'t Get Zhou Tonged!!! — Zhou Tonged', duration: 210 },
            { id: 'nO6A4N9zjgE', title: 'Rich Men North of Richmond — Full Band Cover', duration: 210 },
            { id: 'RIsZyg8OXlI', title: '10,000 Bitcoins — Laura Saggers', duration: 240 },
            { id: 'RglKdIovlX0', title: 'BANK — Bitcoin Music Video', duration: 210 },
            { id: 's3UtbslfqS8', title: 'Gary Gensler, Isn\'t That True? — Bitcoin Heavy Metal', duration: 240 },
            { id: '9I9l8vlTvJE', title: 'Toxic Maximalist — The Orange Pill Jam Project', duration: 270 },
            { id: 'DNYzHGM50Ys', title: 'Too Bit To Fail — Proof of Word EP', duration: 240 },
            { id: 'VMLakjlz6us', title: 'Ode to Satoshi — Roger 9000', duration: 300 },
            { id: 'BifVGcvJpxc', title: 'WAGMI', duration: 210 },
            { id: 'AQwyOhLBsI4', title: 'Stacking Sats — Jack Mallers', duration: 240 },
            { id: '9johJ8eyucQ', title: 'It\'s Math — Greg Foss & Pleb Music', duration: 270 },
            { id: '6ZKzapbQPZA', title: 'Banksters Paradise — A Bitcoin Song', duration: 270 },
            { id: 'Vz9iCgiSZrM', title: 'Bitcoin\'s Back — Lil Bubble (Backstreet Boys Parody)', duration: 210 },
            { id: 'GZ0YMSLZjfQ', title: 'Welcome To The Blockchain — Music Video', duration: 240 },
            { id: 'Otkg4Ftx6GI', title: 'The Bitcoin Song', duration: 210 },
            { id: '7gfBP8kPzRA', title: 'The Bitcoin Song — Jay-Z Empire State of Mind Parody', duration: 270 },
            { id: 'WrEVpNdYkrs', title: 'B.R.E.A.M. — Zhou Tonged (Wu-Tang C.R.E.A.M. Parody)', duration: 240 },
            { id: 'AKqdUAhX3nA', title: 'Bitcoin Is Hope ft. Michael Saylor', duration: 240 },
            { id: 'KRopo3nofl4', title: '10,000 Bitcoin Remix — Laura Saggers', duration: 240 },
            { id: 'U252iiG8YP0', title: 'Jingle Bells, Bank Cartels! A Bitcoin Christmas Song', duration: 210 },
        ]
    },
    {
        id: 'news',
        name: 'News',
        emoji: '📰',
        desc: 'Latest Bitcoin news & market updates',
        color: '#3b82f6',
        videos: [
            { id: 'LGYcl4hwUOI', title: 'Bitcoin at 200-Week Moving Average — Buy Signal?', duration: 1200 },
            { id: 'kN5codbLCCY', title: 'Bitcoin Regulation Becoming National Security', duration: 900 },
            { id: 'DDk6-tdHeXQ', title: 'Bitcoin Technical Analysis — Elliott Wave', duration: 1500 },
            { id: 'HOYnvEVOTJA', title: 'Simply Bitcoin — Daily News Update', duration: 3600 },
            { id: '1nsIy7PWXyY', title: 'Bitcoin Price Analysis — Key Levels', duration: 1200 },
            { id: 'K4ciiDyUvUo', title: 'Larry Fink: Bitcoin is Digital Gold — CNBC', duration: 480 },
            { id: '-LPit2bEWAo', title: 'BlackRock CEO on Bitcoin ETF Success — CNBC', duration: 600 },
            { id: 'wSh_KzcY_dA', title: '60 Minutes: Stories About Cryptocurrency — CBS', duration: 4000 },
            { id: 'CbEHD0esI_A', title: 'MicroStrategy Bitcoin Reserve Strategy — CNBC', duration: 420 },
            { id: 'BSiQHfEUabI', title: 'Bitcoin Hits New All-Time High — CNBC', duration: 360 },
            { id: '5c03NCvohCA', title: 'Bitcoin ETF Record Performance — Bloomberg', duration: 480 },
            { id: 'N7Z7tpwSlBg', title: 'Strategy CEO on 2026 Bitcoin Outlook — Fox Business', duration: 540 },
            { id: 'DyMVHXz9Tgs', title: 'Bitcoin ETFs Survive First Stress Test — Bloomberg', duration: 420 },
            { id: 'dYFMoK1nDmc', title: '60 Minutes: Bitcoin Beach El Salvador — CBS', duration: 780 },
            { id: 'WaEBc2prSPE', title: 'Next-Gen Bitcoin ETFs Outperforming — Bloomberg', duration: 360 },
            { id: 'wC4nzqrgvik', title: 'Iran Used Bitcoin To Break US Sanctions — Simply Bitcoin', duration: 1800 },
            { id: 'c3LyvfHQ9BE', title: 'Why Bitcoin Booms in October — Simply Bitcoin', duration: 1200 },
            { id: 'zo1pZlgAvpY', title: 'Is This the Final Bitcoin Crash Before All-Time Highs? — Simply Bitcoin', duration: 1500 },
        ]
    },
    {
        id: 'orange-pill',
        name: 'Orange Pill',
        emoji: '🟠',
        desc: 'Best videos to share with beginners',
        color: '#f7931a',
        videos: [
            { id: 'gCfA1lkmJo4', title: 'The Greatest Bitcoin Explanation — Michael Saylor', duration: 1200 },
            { id: '1Mr9PknsM_Y', title: 'Saylor\'s Best Explanation Under 20 Minutes', duration: 1200 },
            { id: 'xegEpCLT0CQ', title: 'A Practical Approach to Orange Pilling', duration: 1800 },
            { id: 'heA1fZzRAFs', title: 'Orange Pill: The Bitcoin Guide', duration: 900 },
            { id: 'Bt2Z-_nhpwQ', title: 'How to Orange Pill Anyone', duration: 600 },
            { id: 'YT-38EneBWw', title: 'Bitcoin Street Interviews London — Mike Still', duration: 1440 },
            { id: 'og5zZssEWIc', title: 'Bitcoin Street Interviews Birmingham — Mike Still', duration: 1500 },
            { id: 'Uh-eTnRXCr8', title: 'Bitcoin Street Interviews Edinburgh — Mike Still', duration: 1400 },
            { id: 'vclZlAFXpEI', title: 'Give Me 9 Minutes and You Will Understand Bitcoin — Exit Manual', duration: 600 },
            { id: 'HhxcdMIJTLA', title: 'Telling People About Bitcoin Never Works — Exit Manual', duration: 450 },
            { id: 'r34hkJBeE-M', title: 'How I Lost 14 Bitcoins — Exit Manual', duration: 555 },
            { id: 'IuVkUqdqkcc', title: 'Buy Bitcoin When It Looks Like This — Exit Manual', duration: 653 },
            { id: '4tqXvMNOuHk', title: 'Bitcoin Ethical Superiority Explained — Exit Manual', duration: 480 },
            { id: 'Sv9VAocAA80', title: 'Max Keiser: Bitcoin Will Replace the Dollar', duration: 1200 },
            { id: 'exK5yFEuBsk', title: 'Remember, Remember the 5th of November — Bitcoin', duration: 180 },
            { id: 'MQvvLwxxxdM', title: 'The Banks are BROKE', duration: 600 },
        ]
    },
    {
        id: 'podcasts',
        name: 'Podcasts',
        emoji: '🎙️',
        desc: 'Best Bitcoin podcast clips & episodes',
        color: '#14b8a6',
        videos: [
            { id: 'l1Rgq8UY3zo', title: 'Why Bitcoin is Different — Stephan Livera', duration: 3600 },
            { id: '4Q1AasS6HLU', title: 'Bitcoin 101 — Stephan Livera Podcast', duration: 4200 },
            { id: 'N_qo_-QRqAM', title: 'No More 4-Year Cycles? — Stephan Livera', duration: 3000 },
            { id: 'aN2G0Uvahf8', title: 'What Bitcoin Did — Beginner Guide', duration: 5400 },
            { id: 'oMDHTVwSRHI', title: '1 Bitcoin Is All You Need', duration: 2400 },
            { id: 'x0kNGaxLg18', title: 'Lyn Alden: Why This Bitcoin Cycle Disappointed — Coin Stories', duration: 3320 },
            { id: 'HwNSykjO-gI', title: 'Lyn Alden: Changing World Order — Coin Stories', duration: 3630 },
            { id: 'to7FF7ZmBl0', title: 'Lyn Alden: No Massive Bust or Boom? — Coin Stories', duration: 3383 },
            { id: 'bhSGC08V47U', title: 'Stephan Livera on Bitcoin Maximalism', duration: 3600 },
            { id: '6WxdkRk8cs4', title: 'Stephan Livera: Bitcoin Education Deep Dive', duration: 2700 },
            { id: 'sTxdYxGqYDo', title: 'Stephan Livera: Why Bitcoin Only', duration: 3000 },
            { id: 'x0kNGaxLg18', title: 'Lyn Alden: Why This Bitcoin Cycle Disappointed — Coin Stories', duration: 3320 },
            { id: 'HwNSykjO-gI', title: 'Lyn Alden: Changing World Order — Coin Stories', duration: 3630 },
            { id: 'to7FF7ZmBl0', title: 'Lyn Alden: No Massive Bust or Boom? — Coin Stories', duration: 3383 },
        ]
    },
    {
        id: 'politics-regulation',
        name: 'Politics & Regulation',
        emoji: '🏛️',
        desc: 'Government policy, ETFs & legal battles',
        color: '#64748b',
        videos: [
            { id: 'kN5codbLCCY', title: 'Bitcoin Regulation: National Security Issue', duration: 900 },
            { id: 'pR4t4dRdajw', title: 'Bitcoin vs Authoritarianism — Gladstein', duration: 2400 },
            { id: '_6PvTUqyRt8', title: 'Alex Gladstein on Bitcoin Freedom', duration: 1800 },
            { id: 'kSbMU5CbFM0', title: 'Bitcoin vs Authoritarianism — HRF', duration: 2100 },
            { id: 'Y5wgZ3rFayQ', title: 'Financial Sovereignty & Bitcoin Policy', duration: 1800 },
            { id: 'R4gyS5mb9dE', title: 'Gladstein: Bitcoin Is a Tool Dictators Should Fear — 2025 Summit', duration: 1800 },
            { id: 'zV_A2yMZl0w', title: 'Gladstein: Bitcoin Privacy Technologies Redefining Money', duration: 1800 },
        ]
    },
    {
        id: 'tutorials',
        name: 'Tutorials',
        emoji: '📚',
        desc: 'Learn Bitcoin step by step',
        color: '#f7931a',
        videos: [
            { id: 'El3y8AME8oA', title: 'Bitcoin Explained — Breaking It Down Simply', duration: 900 },
            { id: 'lHipE05v4jg', title: 'How Bitcoin Works — Complete Beginner Guide', duration: 1200 },
            { id: '41JCpzvnn_0', title: 'Bitcoin for Beginners — 99Bitcoins', duration: 720 },
            { id: 'Gc2en3nHxA4', title: 'What is Bitcoin — Simply Explained', duration: 540 },
            { id: 'bBC-nXj3Ng4', title: 'How Bitcoin Works Under the Hood', duration: 1320 },
            { id: 'c8ytiynbnpk', title: 'Your First Bitcoin Wallet — BTC Sessions', duration: 1500 },
            { id: '3Grj3Datdfw', title: 'Game-Changing Bitcoin Wallet (Cove) — BTC Sessions', duration: 1600 },
            { id: 'bsAznpEupIg', title: 'Easiest Bitcoin Wallet Setup (Aqua) — BTC Sessions', duration: 2400 },
            { id: 'IxgNp2h5j8w', title: 'How To Buy, Use and Secure Bitcoin — BTC Sessions', duration: 1800 },
            { id: '6b0xTB2sE8E', title: 'Bull Bitcoin Wallet Full Tutorial — BTC Sessions', duration: 5500 },
            { id: 'mibKrTvtlyQ', title: 'Misty Breez Bitcoin Wallet Setup — BTC Sessions', duration: 900 },
            { id: 'Y3iAwLG6NlA', title: 'Bitcoin Wallets That Change Everything in 2026 — BTC Sessions', duration: 1200 },
            { id: 'Gc2en3nHxA4', title: 'Bitcoin Simply Explained in 5 Minutes', duration: 300 },
            { id: 'f-4Rs3Sqlhc', title: 'Complete History of Bitcoin in 12 Minutes', duration: 720 },
            { id: 'Ner16UBWdEg', title: 'Bitcoin in 2025 — What You Need to Know', duration: 600 },
            { id: '4Lsr7lsy6Tk', title: 'How to Set Up a Bitcoin Node at Home', duration: 1800 },
            { id: 'OZK5hdKfb18', title: 'Bitcoin Security Best Practices', duration: 900 },
            { id: 'vmf_LtnagTs', title: 'Bitcoin Cold Storage Tutorial', duration: 1200 },
            { id: 'rKjce1jCxSM', title: 'Bitcoin Beginner Mistakes to Avoid', duration: 780 },
            { id: 'GR-E0aaFf0c', title: 'Bitcoin Explained for Complete Beginners', duration: 600 },
            { id: 'Y3iAwLG6NlA', title: 'Bitcoin Wallets That Change Everything in 2026 — BTC Sessions', duration: 1906 },
            { id: 'ZZKoSmQu30Q', title: 'Best Hardware Wallet Comparison 2025 — BTC Sessions', duration: 3621 },
            { id: 'KNaOeLlD6NA', title: 'Build Your Own Bitcoin Node with Umbrel — Raspberry Pi', duration: 1200 },
            { id: 'TpwnoPUyumA', title: 'Phoenix Wallet Setup — Self-Custody Lightning Made Easy', duration: 1500 },
        ]
    }
];


// ── Station Persistence ──
// Save last station so user returns to it; first visit picks random
function getInitialStation() {
    try {
        var saved = localStorage.getItem('tctv_lastStation');
        if (saved && STATIONS.some(function(s) { return s.id === saved; })) return saved;
    } catch(e) {}
    // First visit: random station
    return STATIONS[Math.floor(Math.random() * STATIONS.length)].id;
}
function saveStation(stationId) {
    try { localStorage.setItem('tctv_lastStation', stationId); } catch(e) {}
}

// ── Global Clock Engine ──
// Given current time, calculate which video + offset for a station
function getPlaybackState(station) {
    var totalDuration = 0;
    for (var i = 0; i < station.videos.length; i++) {
        totalDuration += station.videos[i].duration;
    }
    if (totalDuration === 0) return { videoIndex: 0, offset: 0, video: station.videos[0] };

    // Position in the loop based on Unix timestamp (seconds)
    var globalSec = Math.floor(Date.now() / 1000);
    var position = globalSec % totalDuration;

    // Find which video we're in
    var elapsed = 0;
    for (var j = 0; j < station.videos.length; j++) {
        if (position < elapsed + station.videos[j].duration) {
            return {
                videoIndex: j,
                offset: position - elapsed,
                video: station.videos[j],
                remaining: station.videos[j].duration - (position - elapsed),
                totalDuration: totalDuration,
                position: position
            };
        }
        elapsed += station.videos[j].duration;
    }
    return { videoIndex: 0, offset: 0, video: station.videos[0] };
}

// ── Viewer Counting (Presence-Based) ──
// Each viewer writes a personal doc with timestamp + station.
// Docs older than 60s are stale (viewer gone). Heartbeat every 30s.
var _viewerUnsub = null;
var _currentStation = null;
var _viewerId = null;
var _viewerHeartbeat = null;
var _viewerCounts = {};

function _getViewerId() {
    if (_viewerId) return _viewerId;
    try {
        _viewerId = localStorage.getItem('tctv_viewerId');
        if (_viewerId) return _viewerId;
    } catch(e) {}
    _viewerId = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem('tctv_viewerId', _viewerId); } catch(e) {}
    return _viewerId;
}

function _writePresence(stationId) {
    if (typeof firebase === 'undefined' || !firebase.firestore) return;
    var db = firebase.firestore();
    db.collection('tctv_presence').doc(_getViewerId()).set({
        station: stationId,
        ts: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function() {});
}

function _deletePresence() {
    if (typeof firebase === 'undefined' || !firebase.firestore) return;
    var db = firebase.firestore();
    db.collection('tctv_presence').doc(_getViewerId()).delete().catch(function() {});
}

function joinStation(stationId) {
    leaveStation();
    _currentStation = stationId;

    // Write presence immediately
    _writePresence(stationId);

    // Heartbeat every 30s to stay "alive"
    _viewerHeartbeat = setInterval(function() {
        if (_currentStation) _writePresence(_currentStation);
    }, 30000);

    // Listen for all presence docs (real-time)
    if (!_viewerUnsub && typeof firebase !== 'undefined' && firebase.firestore) {
        var db = firebase.firestore();
        _viewerUnsub = db.collection('tctv_presence').onSnapshot(function(snap) {
            var counts = {};
            var now = Date.now();
            snap.forEach(function(doc) {
                var d = doc.data();
                if (!d.station || !d.ts) return;
                // Only count docs with timestamp within last 60s
                var docTime = d.ts.toMillis ? d.ts.toMillis() : 0;
                if (now - docTime < 65000) {
                    counts[d.station] = (counts[d.station] || 0) + 1;
                }
            });
            _viewerCounts = counts;
            updateViewerBadges();
        });
    }
}

function leaveStation() {
    if (_currentStation) {
        _deletePresence();
    }
    if (_viewerHeartbeat) { clearInterval(_viewerHeartbeat); _viewerHeartbeat = null; }
    _currentStation = null;
}

function updateViewerBadges() {
    STATIONS.forEach(function(s) {
        var el = document.getElementById('tctv-viewers-' + s.id);
        if (el) {
            var count = _viewerCounts[s.id] || 0;
            el.textContent = count > 0 ? count + ' watching' : '';
        }
    });
    // Also update main viewer count
    var mainCount = document.getElementById('tctv-main-viewers');
    if (mainCount && _currentStation) {
        var c = _viewerCounts[_currentStation] || 0;
        mainCount.textContent = c > 0 ? '👁 ' + c + ' live' : '';
    }
}

// ── White Noise Loading Screen ──
function showWhiteNoise(callback) {
    var overlay = document.createElement('div');
    overlay.id = 'tctvNoise';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:200000;background:#000;display:flex;align-items:center;justify-content:center;flex-direction:column;';

    // Canvas for static noise
    var canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    canvas.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;opacity:0.6;';
    overlay.appendChild(canvas);

    // Title overlay
    var title = document.createElement('div');
    title.style.cssText = 'position:relative;z-index:2;text-align:center;';
    title.innerHTML = '<div style="font-size:2.5rem;font-weight:900;color:#f7931a;text-shadow:0 0 30px rgba(247,147,26,0.5);letter-spacing:4px;margin-bottom:8px;">TIMECHAIN TV</div>' +
        '<div style="font-size:0.85rem;color:#888;letter-spacing:2px;">TUNING IN...</div>';
    overlay.appendChild(title);

    document.body.appendChild(overlay);

    // Animate static noise
    var ctx = canvas.getContext('2d');
    var noiseInterval = setInterval(function() {
        var imgData = ctx.createImageData(canvas.width, canvas.height);
        var data = imgData.data;
        for (var i = 0; i < data.length; i += 4) {
            var v = Math.random() * 255;
            data[i] = v;
            data[i + 1] = v;
            data[i + 2] = v;
            data[i + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
    }, 50);

    // White noise audio
    var audioCtx = null;
    var noiseNode = null;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        var bufferSize = audioCtx.sampleRate * 0.5; // 0.5 seconds
        var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        var channelData = buffer.getChannelData(0);
        for (var s = 0; s < bufferSize; s++) {
            channelData[s] = Math.random() * 2 - 1;
        }
        noiseNode = audioCtx.createBufferSource();
        noiseNode.buffer = buffer;
        noiseNode.loop = true;
        var gain = audioCtx.createGain();
        gain.gain.value = 0.06;
        noiseNode.connect(gain);
        gain.connect(audioCtx.destination);
        noiseNode.start();
    } catch(e) {}

    // Fade out after 1.5s
    setTimeout(function() {
        overlay.style.transition = 'opacity 0.5s';
        overlay.style.opacity = '0';
        if (noiseNode) { try { noiseNode.stop(); } catch(e) {} }
        if (audioCtx) { try { audioCtx.close(); } catch(e) {} }
        setTimeout(function() {
            clearInterval(noiseInterval);
            overlay.remove();
            if (callback) callback();
        }, 500);
    }, 1500);
}

// ── YouTube Player ──
var _currentVideoId = null;
var _syncInterval = null;
var _channelSwitchTimer = null;

// Simple iframe embed — no YouTube API needed
function loadVideo(videoId, startSeconds) {
    var old = document.getElementById('tctv-player');
    if (!old) return;
    var wrap = old.parentElement;
    _currentVideoId = videoId;

    // Destroy and recreate iframe — browsers grant autoplay more reliably
    // on a fresh iframe element vs. changing src on an existing one
    old.remove();
    var iframe = document.createElement('iframe');
    iframe.id = 'tctv-player';
    iframe.style.cssText = 'width:100%;height:100%;border:none;';
    iframe.setAttribute('allow', 'autoplay; encrypted-media');
    iframe.setAttribute('allowfullscreen', '');
    iframe.src = 'https://www.youtube.com/embed/' + videoId +
        '?start=' + Math.floor(startSeconds) +
        '&autoplay=1&controls=1&modestbranding=1&rel=0' +
        '&showinfo=0&iv_load_policy=3&playsinline=1';
    wrap.appendChild(iframe);
}

// createPlayer removed — using simple iframe embeds

function syncPlayer() {
    if (!_currentStation) return;
    var station = STATIONS.find(function(s) { return s.id === _currentStation; });
    if (!station) return;

    var state = getPlaybackState(station);
    if (!state.video) return;

    // Update now playing info
    var nowPlaying = document.getElementById('tctv-now-playing');
    if (nowPlaying) {
        nowPlaying.textContent = state.video.title;
    }
    var timeLeft = document.getElementById('tctv-time-left');
    if (timeLeft) {
        var mins = Math.floor(state.remaining / 60);
        var secs = state.remaining % 60;
        timeLeft.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs + ' left';
    }

    // Check if we need to switch videos
    if (state.video.id !== _currentVideoId) {
        loadVideo(state.video.id, state.offset);
    }
}

// ── Timeline Bar ──
function updateTimeline() {
    if (!_currentStation) return;
    var station = STATIONS.find(function(s) { return s.id === _currentStation; });
    if (!station) return;
    var state = getPlaybackState(station);

    // Update progress within current video
    var bar = document.getElementById('tctv-progress');
    if (bar && state.video) {
        var pct = ((state.video.duration - state.remaining) / state.video.duration) * 100;
        bar.style.width = pct + '%';
    }

    // Update time display
    var timeLeft = document.getElementById('tctv-time-left');
    if (timeLeft) {
        var mins = Math.floor(state.remaining / 60);
        var secs = state.remaining % 60;
        timeLeft.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
    }

    // Check for video transition
    if (state.video && state.video.id !== _currentVideoId) {
        syncPlayer();
    }
}

// ── Main Render ──
window.renderTimechainTV = function() {
    var fc = document.getElementById('forumContainer');
    if (!fc) return;

    if (window._tctvActive && document.getElementById('tctv-player')) return;
    window._tctvActive = true;

    // Restore last station or pick random on first visit
    var activeStation = _currentStation || getInitialStation();

    var html = '<div style="background:#0a0a0a;min-height:100vh;color:#fff;font-family:inherit;">';

    // Sticky top section: header + video + now playing + progress
    html += '<div style="position:sticky;top:0;z-index:100;background:#0a0a0a;">';

    // Header bar
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#111;border-bottom:1px solid rgba(247,147,26,0.3);">';
    html += '<div onclick="goHome()" style="cursor:pointer;display:flex;align-items:center;gap:8px;">';
    html += '<span style="color:var(--text-muted);font-size:0.8rem;">←</span>';
    html += '<span style="color:#f7931a;font-weight:900;font-size:1rem;letter-spacing:2px;">TIMECHAIN TV</span>';
    html += '</div>';
    html += '<div style="display:flex;align-items:center;gap:6px;">';
    html += '<span id="tctv-main-viewers" style="font-size:0.7rem;color:#22c55e;font-weight:600;"></span>';
    html += '<span style="width:8px;height:8px;background:#ef4444;border-radius:50%;display:inline-block;box-shadow:0 0 6px #ef4444;"></span>';
    html += '<span style="color:#ef4444;font-size:0.7rem;font-weight:800;letter-spacing:1px;">LIVE</span>';
    html += '</div></div>';

    // Video player area (click-blocking overlay prevents pause)
    html += '<div style="position:relative;width:100%;aspect-ratio:16/9;max-height:40vh;background:#000;overflow:hidden;">';
    html += '<iframe id="tctv-player" style="width:100%;height:100%;border:none;" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
    html += '</div>';

    // Now playing bar
    html += '<div style="padding:10px 16px;background:#161616;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center;">';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:0.65rem;color:#f7931a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">NOW PLAYING</div>';
    html += '<div id="tctv-now-playing" style="font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#ddd;">Loading...</div>';
    html += '</div>';
    html += '<div id="tctv-time-left" style="font-size:0.75rem;color:#888;font-weight:600;flex-shrink:0;margin-left:12px;font-variant-numeric:tabular-nums;"></div>';
    html += '</div>';

    // Progress bar
    html += '<div style="height:3px;background:#222;"><div id="tctv-progress" style="height:100%;background:#f7931a;width:0%;transition:width 1s linear;"></div></div>';

    // Close sticky top section
    html += '</div>';

    // Channel guide
    html += '<div style="padding:12px 16px 8px;"><div style="font-size:0.65rem;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">CHANNELS</div></div>';

    html += '<div style="display:flex;flex-direction:column;gap:2px;padding:0 8px 120px;">';
    STATIONS.forEach(function(s, idx) {
        var isActive = s.id === activeStation;
        var state = getPlaybackState(s);
        var pct = state.video ? Math.round(((state.video.duration - state.remaining) / state.video.duration) * 100) : 0;
        var chNum = idx + 1;

        html += '<div data-station-id="' + s.id + '" onclick="switchStation(\'' + s.id + '\')" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;cursor:pointer;transition:0.2s;background:' + (isActive ? 'rgba(247,147,26,0.1)' : 'transparent') + ';border:1px solid ' + (isActive ? 'rgba(247,147,26,0.3)' : 'transparent') + ';">';

        // Channel number
        html += '<div data-ch-num style="width:24px;font-size:0.7rem;font-weight:800;color:' + (isActive ? '#f7931a' : '#555') + ';text-align:center;flex-shrink:0;">' + chNum + '</div>';

        // Station icon
        html += '<div style="width:40px;height:40px;border-radius:10px;background:' + s.color + '20;border:1px solid ' + s.color + '40;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">' + s.emoji + '</div>';

        // Station info
        html += '<div style="flex:1;min-width:0;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<div data-ch-name style="font-weight:700;font-size:0.85rem;color:' + (isActive ? '#f7931a' : '#ddd') + ';">' + s.name + '</div>';
        html += '<span id="tctv-viewers-' + s.id + '" style="font-size:0.6rem;color:#22c55e;font-weight:600;"></span>';
        html += '</div>';
        html += '<div style="font-size:0.72rem;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (state.video ? state.video.title : s.desc) + '</div>';
        // Mini progress bar
        html += '<div style="height:2px;background:#222;border-radius:1px;margin-top:4px;overflow:hidden;"><div style="height:100%;background:' + s.color + ';width:' + pct + '%;transition:width 1s linear;"></div></div>';
        html += '</div>';

        // Live indicator (always rendered, hidden when not active)
        html += '<div data-live-dot style="width:8px;height:8px;background:#ef4444;border-radius:50%;box-shadow:0 0 6px #ef4444;flex-shrink:0;display:' + (isActive ? 'inline-block' : 'none') + ';"></div>';

        html += '</div>';
    });
    html += '</div>';

    html += '</div>';
    fc.innerHTML = html;

    // Start playback
    var _startPlayback = function() {
        _currentStation = activeStation;
        saveStation(activeStation);
        joinStation(activeStation);

        var station = STATIONS.find(function(s) { return s.id === activeStation; });
        if (station) {
            var state = getPlaybackState(station);
            if (state.video) {
                loadVideo(state.video.id, state.offset);
                var np = document.getElementById('tctv-now-playing');
                if (np) np.textContent = state.video.title;
            }
        }
        // Sync every second for timeline bar + video transitions
        if (_syncInterval) clearInterval(_syncInterval);
        _syncInterval = setInterval(updateTimeline, 1000);
    };

    if (!window._tctvFirstLoadDone) {
        window._tctvFirstLoadDone = true;
        // Start loading video DURING white noise so it's ready when noise ends
        _startPlayback();
        showWhiteNoise(null);
    } else {
        _startPlayback();
    }
};

// ── Channel Switch White Noise ──
// Brief noise overlay on the video area while new station loads underneath
function showChannelNoise(stationName) {
    var playerWrap = document.getElementById('tctv-player') ? document.getElementById('tctv-player').parentElement : null;
    if (!playerWrap) return;

    var overlay = document.createElement('div');
    overlay.id = 'tctvChNoise';
    overlay.style.cssText = 'position:absolute;inset:0;z-index:10;background:#000;display:flex;align-items:center;justify-content:center;';

    var canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    canvas.style.cssText = 'width:100%;height:100%;object-fit:cover;opacity:0.6;';
    overlay.appendChild(canvas);

    // Station name flash — centered within the overlay
    var label = document.createElement('div');
    label.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2;color:#f7931a;font-weight:900;font-size:1.1rem;letter-spacing:3px;text-shadow:0 0 20px rgba(247,147,26,0.5);text-align:center;white-space:nowrap;';
    label.textContent = stationName || '';
    overlay.appendChild(label);

    playerWrap.style.position = 'relative';
    playerWrap.appendChild(overlay);

    var ctx = canvas.getContext('2d');
    var noiseInterval = setInterval(function() {
        var imgData = ctx.createImageData(canvas.width, canvas.height);
        var d = imgData.data;
        for (var i = 0; i < d.length; i += 4) {
            var v = Math.random() * 255;
            d[i] = v; d[i+1] = v; d[i+2] = v; d[i+3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
    }, 50);

    // Brief audio burst
    var audioCtx = null;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        var bufSize = audioCtx.sampleRate * 0.3;
        var buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        var ch = buf.getChannelData(0);
        for (var s = 0; s < bufSize; s++) ch[s] = Math.random() * 2 - 1;
        var node = audioCtx.createBufferSource();
        node.buffer = buf;
        node.loop = true;
        var gain = audioCtx.createGain();
        gain.gain.value = 0.045;
        node.connect(gain);
        gain.connect(audioCtx.destination);
        node.start();
        setTimeout(function() { try { node.stop(); audioCtx.close(); } catch(e) {} }, 800);
    } catch(e) {}

    // Fade out after 0.8s
    setTimeout(function() {
        overlay.style.transition = 'opacity 0.3s';
        overlay.style.opacity = '0';
        setTimeout(function() {
            clearInterval(noiseInterval);
            overlay.remove();
        }, 300);
    }, 800);
}

// ── Channel Switching ──
// Scroll everything to top — called immediately and repeatedly
function _tctvScrollTop() {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
    var fc = document.getElementById('forumContainer');
    if (fc) fc.scrollTop = 0;
    var main = document.getElementById('main');
    if (main) main.scrollTop = 0;
}

window.switchStation = function(stationId) {
    if (stationId === _currentStation) return;

    // Show white noise overlay while video loads underneath
    var stationObj = STATIONS.find(function(s) { return s.id === stationId; });
    showChannelNoise(stationObj ? stationObj.emoji + ' ' + stationObj.name : '');

    leaveStation();
    _currentStation = stationId;
    saveStation(stationId);
    joinStation(stationId);

    var station = STATIONS.find(function(s) { return s.id === stationId; });
    if (!station) return;

    var state = getPlaybackState(station);

    // Load new video (starts loading behind the noise overlay)
    if (state.video) {
        loadVideo(state.video.id, state.offset);
    }

    // Update now playing text
    var np = document.getElementById('tctv-now-playing');
    if (np && state.video) np.textContent = state.video.title;

    // Update channel list highlighting (without destroying DOM)
    document.querySelectorAll('[data-station-id]').forEach(function(el) {
        var sid = el.getAttribute('data-station-id');
        var isActive = sid === stationId;
        el.style.background = isActive ? 'rgba(247,147,26,0.1)' : 'transparent';
        el.style.borderColor = isActive ? 'rgba(247,147,26,0.3)' : 'transparent';
        // Update channel number color
        var numEl = el.querySelector('[data-ch-num]');
        if (numEl) numEl.style.color = isActive ? '#f7931a' : '#555';
        // Update name color
        var nameEl = el.querySelector('[data-ch-name]');
        if (nameEl) nameEl.style.color = isActive ? '#f7931a' : '#ddd';
        // Show/hide live dot
        var dot = el.querySelector('[data-live-dot]');
        if (dot) dot.style.display = isActive ? 'inline-block' : 'none';
    });

};

// ── Cleanup ──
window.cleanupTimechainTV = function() {
    leaveStation();
    if (_syncInterval) { clearInterval(_syncInterval); _syncInterval = null; }
    if (window._tctvPlayEnforcer) { clearInterval(window._tctvPlayEnforcer); window._tctvPlayEnforcer = null; }
    if (_viewerUnsub) { _viewerUnsub(); _viewerUnsub = null; }
    var iframe = document.getElementById('tctv-player');
    if (iframe) iframe.src = '';
    _currentVideoId = null;
    window._tctvActive = false;
};

// Handle leaving the page
window.addEventListener('pagehide', function() { leaveStation(); });
window.addEventListener('beforeunload', function() { leaveStation(); });

console.log('[TIMECHAIN TV] Module loaded — ' + STATIONS.length + ' stations');
})();
