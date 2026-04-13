
(function() {
'use strict';

var STATIONS = [
    {
        "id": "art-philosophy",
        "name": "Art & Philosophy",
        "emoji": "🎨",
        "desc": "Bitcoin art, ordinals & deeper meaning",
        "color": "#a855f7",
        "videos": [
            {
                "id": "QVg0ZmxrYLo",
                "title": "Bitcoin's Most Beautifully Absurd Art Drop",
                "duration": 1020
            },
            {
                "id": "j3QJlyRMHpI",
                "title": "Art on Bitcoin: Shaping the Future of Digital Creativity",
                "duration": 2700
            },
            {
                "id": "XHBydlTt2jM",
                "title": "The Rise of Ordinals and Art on Bitcoin",
                "duration": 1800
            },
            {
                "id": "UrCN7oG_4YY",
                "title": "Bitcoin NFTs: How to Create Ordinal Inscriptions",
                "duration": 900
            },
            {
                "id": "ic6pDq3OAec",
                "title": "Philosophy of Bitcoin — First Principles",
                "duration": 3600
            },
            {
                "id": "yMoVGgR6h0Y",
                "title": "Money: The Language of Power — Robert Breedlove",
                "duration": 3600
            },
            {
                "id": "NALikCvCyes",
                "title": "The Truth About Money, Inflation and Bitcoin — Robert Breedlove",
                "duration": 2400
            },
            {
                "id": "JffTkZZC2z8",
                "title": "What is Money? — Robert Breedlove",
                "duration": 1800
            },
            {
                "id": "1gnIbVFnuCY",
                "title": "The Biggest Scam in Human History — Robert Breedlove",
                "duration": 5400
            },
            {
                "id": "PqFz8R1CZYo",
                "title": "Bitcoin as a Kardashev-Scale Technology — Robert Breedlove",
                "duration": 2400
            },
            {
                "id": "cKkokcMMnpc",
                "title": "Bitcoin Aligns with the Laws of Nature — Robert Breedlove",
                "duration": 1800
            },
            {
                "id": "N3J868zhH9g",
                "title": "Bitcoin Is Encrypted Energy — Breedlove & Saylor",
                "duration": 2400
            },
            {
                "id": "7DIp6D-68cQ",
                "title": "Can Bitcoin Rebuild Civilization? — Saifedean Ammous",
                "duration": 3033
            },
            {
                "id": "gb2S1Filtic",
                "title": "How Bitcoin Fixes Fiat's Millennium of Mistakes — Saifedean",
                "duration": 1587
            },
            {
                "id": "SKIIif9WQok",
                "title": "Bitcoin Renaissance Legacy: Beyond Digital Gold",
                "duration": 1242
            },
            {
                "id": "MRnmP7pbR0s",
                "duration": 3600,
                "title": "Creating Meaningful Art with FractalEncrypt"
            },
            {
                "id": "33emHIL1IoU",
                "duration": 900,
                "title": "The Bitcoin Full Node Sculpture - Eric Weiss"
            },
            {
                "id": "9-S17oAxIqA",
                "duration": 600,
                "title": "Bitcoin Pencil Art Timelapse - Bitcoin Apex"
            },
            {
                "id": "KxTWC3ShYDE",
                "duration": 7200,
                "title": "Just-B on Airbrush Mastery - Bitcoin Art Podcast"
            },
            {
                "id": "lRr9ofu0tnk",
                "duration": 180,
                "title": "Bitcoin Art Magazine Unleashed"
            },
            {
                "id": "edyO5-L9un8",
                "duration": 3600,
                "title": "Marcus Connor & The Bitcoin Roller Coaster Guy"
            },
            {
                "id": "yvdZsN5s9sc",
                "duration": 2400,
                "title": "Based Trading Cards Movement"
            },
            {
                "id": "Mqc6M8rZRi8",
                "duration": 600,
                "title": "BITCOIN TRADING CARDS?"
            },
            {
                "id": "RwO9lB-rloo",
                "duration": 3600,
                "title": "Bitcoin, Art, and Freedom with Madex"
            },
            {
                "id": "lo7eeL1E_VQ",
                "duration": 300,
                "title": "A Madex Manifesto"
            },
            {
                "id": "occ9L0dMMO4",
                "duration": 600,
                "title": "Bitcoin 2024 Art Exhibit - Bitcoin Bob"
            },
            {
                "id": "RnducAborVw",
                "duration": 180,
                "title": "Bitcoin Art Gallery - Miami 2022"
            },
            {
                "id": "2Jf8sxF8QFQ",
                "duration": 120,
                "title": "Miami debuts Bitcoin Bull Statue"
            },
            {
                "id": "vPUpdXZPpbQ",
                "duration": 180,
                "title": "Nashville Bitcoin Mural - Sound Money"
            },
            {
                "id": "9UxAUryUKXM",
                "duration": 36000,
                "title": "10 Hours of Bitcoin Lofi & Philosophy"
            }
        ]
    },
    {
        "id": "conferences-events",
        "name": "Conferences & Events",
        "emoji": "🎤",
        "desc": "Bitcoin conference speeches & keynotes",
        "color": "#6366f1",
        "videos": [
            {
                "id": "XdgP25UcHB0",
                "title": "Bitcoin for Corporations — Saylor & Dorsey",
                "duration": 12600
            },
            {
                "id": "HGyiOlXg-XY",
                "title": "Top 10 Most Iconic Bitcoin Conference Moments",
                "duration": 1200
            },
            {
                "id": "pDA2r4AblD0",
                "title": "How To Orange Pill Anyone — BitBlockBoom",
                "duration": 2400
            },
            {
                "id": "gCfA1lkmJo4",
                "title": "Michael Saylor — The Greatest Bitcoin Explanation",
                "duration": 1200
            },
            {
                "id": "nC37CqWpxfI",
                "title": "Saylor & Dorsey Interview",
                "duration": 3400
            },
            {
                "id": "reVebuAf_Cs",
                "title": "Michael Saylor: 21 Ways To Wealth — Bitcoin 2025 Keynote",
                "duration": 2211
            },
            {
                "id": "RoRZE2DpEzE",
                "title": "Jack Mallers: The HODLers Dilemma — Bitcoin 2025 Keynote",
                "duration": 2098
            },
            {
                "id": "6fgFyQEWiK4",
                "title": "Saifedean Ammous: How Bitcoin Could End Wars — Amsterdam 2025",
                "duration": 1691
            },
            {
                "id": "hqoagNBtIps",
                "title": "Michael Saylor: Bitcoin Prophecy — BTC Prague 2025",
                "duration": 2400
            },
            {
                "id": "SFUiGTayVL8",
                "title": "Saifedean: Bitcoin & Tether — Drinking the Dollar Milkshake",
                "duration": 857
            },
            {
                "id": "dWaHWT15sOQ",
                "title": "Paolo Ardoino: Why Tether Loves Bitcoin — Bitcoin 2025",
                "duration": 1029
            },
            {
                "id": "R4gyS5mb9dE",
                "title": "Alex Gladstein: Dictators Should Be Afraid — Policy Summit 2025",
                "duration": 1800
            },
            {
                "id": "O9KnBcWMkpw",
                "duration": 2243,
                "title": "Michael Saylor 2024 Keynote - Nashville"
            },
            {
                "id": "9UxAUryUKXM",
                "duration": 2979,
                "title": "Donald Trump 2024 Keynote - Nashville"
            },
            {
                "id": "f3NBhSXtE5g",
                "duration": 1840,
                "title": "Edward Snowden 2024 Keynote - Privacy"
            },
            {
                "id": "IjR3Hj0aRW4",
                "duration": 1250,
                "title": "Howard Lutnick 2024 Keynote - Nashville"
            },
            {
                "id": "1PkMFIa7rmQ",
                "duration": 2415,
                "title": "21 Rules of Bitcoin - Saylor Prague 2024"
            },
            {
                "id": "--IFcOIEfl4",
                "duration": 2632,
                "title": "No Second Best - Jack Mallers Prague 2024"
            },
            {
                "id": "vRuPeBAjLTI",
                "duration": 1948,
                "title": "JIMMY SONG | DESTROYING RENT SEEKING"
            },
            {
                "id": "75O56lhJMJI",
                "duration": 3600,
                "title": "Welcome to Bitcoin Country - Adopting BTC 2024"
            },
            {
                "id": "0XnB_ZqL6fo",
                "duration": 1200,
                "title": "Freedom Festival 2024 - Mass Adoption"
            },
            {
                "id": "TTHU_N_n5Ks",
                "duration": 2820,
                "title": "PlanB Forum Lugano 2024 - Stephan Livera"
            },
            {
                "id": "TUO10-HcdvY",
                "duration": 2880,
                "title": "DEBATE: Bitcoin Ossification | Lugano 2024"
            },
            {
                "id": "kE3TpVS27os",
                "duration": 1200,
                "title": "JD Vance Keynote - Bitcoin 2025 Las Vegas"
            },
            {
                "id": "jc4lkDeozCQ",
                "duration": 3600,
                "title": "Eric Trump speaks at Bitcoin Asia 2024"
            },
            {
                "id": "0OiZY1MRHXo",
                "duration": 600,
                "title": "Nostr Wallet Connect Workshop - BBB 2024"
            },
            {
                "id": "I3Qld_HXQuM",
                "duration": 600,
                "title": "Nostrability Workshop - BBB 2024"
            },
            {
                "id": "gu9OulAijy4",
                "duration": 7200,
                "title": "The Pacific Bitcoin Conference"
            },
            {
                "id": "P1n7XipTCck",
                "duration": 33805,
                "title": "Bitcoin 2024 Nashville: Full GA Day 2 Livestream"
            },
            {
                "id": "p6kBKSZqjn4",
                "duration": 18000,
                "title": "Bitcoin Conference 2025: Opening Day Marathon"
            }
        ]
    },
    {
        "id": "culture-travel",
        "name": "Culture, Travel & Adoption",
        "emoji": "🌍",
        "desc": "Bitcoin culture worldwide & global adoption",
        "color": "#f97316",
        "videos": [
            {
                "id": "Ve6oLiWO0Mg",
                "title": "Traveling the World on Bitcoin — Airbtc",
                "duration": 900
            },
            {
                "id": "0hwC6BKJMpc",
                "title": "How Bitcoin is Revolutionizing Travel",
                "duration": 720
            },
            {
                "id": "kKSFh5Xxe3w",
                "title": "48 Hours in El Salvador Paying Only With Bitcoin",
                "duration": 1200
            },
            {
                "id": "R8xZd8v7b50",
                "title": "Bitcoin Beach: El Salvador's Bitcoin Economy",
                "duration": 1500
            },
            {
                "id": "0Ceey82hFTY",
                "title": "Booking Travel with Bitcoin — Travala",
                "duration": 600
            },
            {
                "id": "e0EPQg20SaQ",
                "title": "What 1792 Days in Bitcoin Taught Me — Get Based TV",
                "duration": 540
            },
            {
                "id": "LRSQSkiil0M",
                "title": "Inside the Bitcoin Revolution in Africa — Joe Nakamoto",
                "duration": 1200
            },
            {
                "id": "TauW_pLnstw",
                "title": "The Bitcoin Paradise You Have Never Heard Of — Joe Nakamoto",
                "duration": 900
            },
            {
                "id": "FelWKV6wVJU",
                "title": "Living on Bitcoin in a Small Town — Joe Nakamoto",
                "duration": 1080
            },
            {
                "id": "WoN0SVY73zo",
                "title": "You Can Live on Bitcoin in Lugano — Joe Nakamoto",
                "duration": 1500
            },
            {
                "id": "waQJEjiPWhg",
                "title": "Bitcoin Culture Around the World",
                "duration": 1200
            },
            {
                "id": "7A56oZAs7ZQ",
                "title": "El Salvador Bitcoin Adoption Documentary",
                "duration": 1800
            },
            {
                "id": "BnR_kB44hy0",
                "title": "Bitcoin Berlín: The Secret Bitcoin City of El Salvador — Joe Nakamoto",
                "duration": 1200
            },
            {
                "id": "DfDWubdqU5I",
                "title": "I Begged Strangers for Bitcoin in Madeira — Joe Nakamoto",
                "duration": 900
            },
            {
                "id": "pxvDunp9820",
                "title": "Bitcoin in Peru: How a Poisoned Town Survives — Joe Nakamoto",
                "duration": 1080
            },
            {
                "id": "ic_4-EFJogY",
                "title": "From Accenture to Bitcoin Maximalist — Alexandre Laizet",
                "duration": 503
            },
            {
                "id": "cs3nEVX9ZWA",
                "title": "Bitcoin Is Transforming Access to Electricity and Finance — Gladstein",
                "duration": 1800
            },
            {
                "id": "twjTUa8njRo",
                "duration": 456,
                "title": "Run with Bitcoin - Paco De La India"
            },
            {
                "id": "eNOYnGtIm9E",
                "duration": 2700,
                "title": "Paco de la India | My Latin Life Podcast 210"
            },
            {
                "id": "BdaiLtKNFQA",
                "duration": 1800,
                "title": "The plan 40 Countries in 400 Days - Paco"
            },
            {
                "id": "5hMZkxQtstU",
                "duration": 3600,
                "title": "167. Run with Bitcoin with Paco de la India"
            },
            {
                "id": "gCi5jPHWVNE",
                "duration": 1200,
                "title": "Run with Bitcoin | Paco De la India Mumbai"
            },
            {
                "id": "mB0U_22_q4s",
                "duration": 36000,
                "title": "10 Hours of Bitcoin Travel & Adoption Stories"
            }
        ]
    },
    {
        "id": "podcasts-debates",
        "name": "Podcasts & Debates",
        "emoji": "🎙️",
        "desc": "Bitcoin podcasts, debates & discussions",
        "color": "#ef4444",
        "videos": [
            {
                "id": "xa5iT1nklyU",
                "title": "Brian Kelly vs Peter Schiff — Bitcoin Bull vs Bear",
                "duration": 600
            },
            {
                "id": "XJU8r6WiipM",
                "title": "Bitcoin vs Gold — Response to Peter Schiff",
                "duration": 2400
            },
            {
                "id": "9DuhDgqx21w",
                "title": "Peter Schiff: Bitcoin Strategy is a Fraud",
                "duration": 1800
            },
            {
                "id": "aWtzOQTv8Dc",
                "title": "Saylor vs Dorsey: Battle for Bitcoin's Future",
                "duration": 720
            },
            {
                "id": "J6I-OzXItfA",
                "title": "Jack Dorsey Explains Bitcoin",
                "duration": 600
            },
            {
                "id": "tbCVXyUGO3o",
                "title": "I Bought This Instead of Bitcoin — Mark Moss",
                "duration": 1200
            },
            {
                "id": "D_yIKnHOuWg",
                "title": "Michael Saylor Answers the Question of Our Time",
                "duration": 600
            },
            {
                "id": "QT_YDxTl1FQ",
                "title": "Jack Mallers: Bitcoin Maximalist Post-GENIUS Act",
                "duration": 1800
            },
            {
                "id": "3YuscY1L1zE",
                "title": "Why You Should Be a Bitcoin Maximalist",
                "duration": 900
            },
            {
                "id": "d5_cYWLpDs8",
                "title": "A Brief History of Bitcoin Maximalism",
                "duration": 1500
            },
            {
                "id": "yCtVkIEIhCg",
                "title": "Bitcoin Can Never Go to Zero — Robert Breedlove",
                "duration": 1200
            },
            {
                "id": "unCR7k3-aoE",
                "title": "Bitcoin Is the Apex Asset — Robert Breedlove",
                "duration": 1500
            },
            {
                "id": "1jZQNo_rRsQ",
                "title": "Bitcoin Poised for Cycle Top? Corporate Treasuries — Saifedean",
                "duration": 1763
            },
            {
                "id": "MmdQKU0YNX4",
                "title": "Bitcoin Will Hit $850K — Max Keiser Prediction",
                "duration": 1200
            },
            {
                "id": "wBEqw-PSBlg",
                "title": "Why Selling Bitcoin for Fiat Misses the Picture — Mark Moss",
                "duration": 1800
            },
            {
                "id": "2ZaMzWZyXe8",
                "title": "Wall Street Meets Bitcoin: Orange-Pilling Finance — Strive CEO",
                "duration": 1320
            },
            {
                "id": "JaMJi1_1tkA",
                "title": "Bitcoin Rap Battle: Hamilton vs. Satoshi — ft. EpicLloyd",
                "duration": 600
            },
            {
                "id": "gp4U5aH_T6A",
                "duration": 10800,
                "title": "Economics & Bitcoin Debate - Lex Fridman & Saifedean"
            },
            {
                "id": "TUO10-HcdvY",
                "duration": 36000,
                "title": "The Ultimate Bitcoin vs. Everything Debate Loop"
            },
            {
                "id": "Bh7LBF9cU6w",
                "duration": 18000,
                "title": "Stock-to-Flow & Power Law Debate Marathon"
            },
            {
                "id": "l1Rgq8UY3zo",
                "title": "Why Bitcoin is Different — Stephan Livera",
                "duration": 3600
            },
            {
                "id": "4Q1AasS6HLU",
                "title": "Bitcoin 101 — Stephan Livera Podcast",
                "duration": 4200
            },
            {
                "id": "N_qo_-QRqAM",
                "title": "No More 4-Year Cycles? — Stephan Livera",
                "duration": 3000
            },
            {
                "id": "aN2G0Uvahf8",
                "title": "What Bitcoin Did — Beginner Guide",
                "duration": 5400
            },
            {
                "id": "oMDHTVwSRHI",
                "title": "1 Bitcoin Is All You Need",
                "duration": 2400
            },
            {
                "id": "x0kNGaxLg18",
                "title": "Lyn Alden: Why This Bitcoin Cycle Disappointed — Coin Stories",
                "duration": 3320
            },
            {
                "id": "HwNSykjO-gI",
                "title": "Lyn Alden: Changing World Order — Coin Stories",
                "duration": 3630
            },
            {
                "id": "to7FF7ZmBl0",
                "title": "Lyn Alden: No Massive Bust or Boom? — Coin Stories",
                "duration": 3383
            },
            {
                "id": "bhSGC08V47U",
                "title": "Stephan Livera on Bitcoin Maximalism",
                "duration": 3600
            },
            {
                "id": "6WxdkRk8cs4",
                "title": "Stephan Livera: Bitcoin Education Deep Dive",
                "duration": 2700
            },
            {
                "id": "sTxdYxGqYDo",
                "title": "Stephan Livera: Why Bitcoin Only",
                "duration": 3000
            },
            {
                "id": "j89aAqfezX8",
                "title": "Saving Bedford - Peter McCormack",
                "duration": 6434
            },
            {
                "id": "K5bZ4HPpwxw",
                "title": "Fixing Government Corruption - WBD",
                "duration": 6182
            },
            {
                "id": "nMicPEQM4HY",
                "title": "Maximalism is Dead? | Peter McCormack",
                "duration": 1541
            },
            {
                "id": "0rlnVQoiVyc",
                "title": "History of Bitcoin w/ Marty Bent",
                "duration": 3000
            },
            {
                "id": "meCoGKugjMQ",
                "title": "Marty Bent on the Power of Bitcoin",
                "duration": 3600
            },
            {
                "id": "ANtyYqcXR9w",
                "title": "Marty Bent: Tales from The Crypt",
                "duration": 3600
            }
        ]
    },
    {
        "id": "saylor",
        "name": "Saylor Series",
        "emoji": "👑",
        "desc": "Michael Saylor's complete Bitcoin masterclass - strategy, philosophy & the future of money",
        "color": "#f7931a",
        "videos": [
            {
                "id": "N3J868zhH9g",
                "title": "Bitcoin Is Encrypted Energy — Saylor & Breedlove",
                "duration": 2400
            },
            {
                "id": "LtcbR98uTJQ",
                "title": "The Saylor Series | Part 1: The History of Money, Bitcoin & the Machine Economy",
                "duration": 7200
            },
            {
                "id": "1Ms7ql_S63A",
                "title": "The Saylor Series | Part 2: Bitcoin as Digital Gold & Property Rights",
                "duration": 7800
            },
            {
                "id": "ssEMtaRwra0",
                "title": "The Saylor Series | Part 3: Bitcoin as the Ultimate Asset",
                "duration": 8100
            },
            {
                "id": "bjvMt0xaSUQ",
                "title": "The Saylor Series | Part 4: The Future of Bitcoin & Civilization",
                "duration": 7500
            },
            {
                "id": "1Mr9PknsM_Y",
                "title": "Michael Saylor's Best Explanation of Bitcoin",
                "duration": 1200
            },
            {
                "id": "reVebuAf_Cs",
                "title": "Michael Saylor: 21 Ways To Wealth — Bitcoin 2025 Keynote",
                "duration": 2211
            },
            {
                "id": "hqoagNBtIps",
                "title": "Michael Saylor: Bitcoin Prophecy — BTC Prague 2025",
                "duration": 2400
            },
            {
                "id": "1PkMFIa7rmQ",
                "title": "21 Rules of Bitcoin - Saylor Prague 2024",
                "duration": 2415
            },
            {
                "id": "gCfA1lkmJo4",
                "title": "Michael Saylor — The Greatest Bitcoin Explanation",
                "duration": 1200
            },
            {
                "id": "O9KnBcWMkpw",
                "duration": 2243,
                "title": "Michael Saylor 2024 Keynote - Nashville"
            },
            {
                "id": "XdgP25UcHB0",
                "title": "Bitcoin for Corporations — Saylor & Dorsey",
                "duration": 12600
            },
            {
                "id": "nC37CqWpxfI",
                "title": "Saylor & Dorsey Interview",
                "duration": 3400
            },
            {
                "id": "D_yIKnHOuWg",
                "title": "Michael Saylor Answers the Question of Our Time",
                "duration": 600
            },
            {
                "id": "3-vBBYEXv6M",
                "title": "Saylor: Bitcoin as Apex Capital Strategy in the AI Age",
                "duration": 2100
            },
            {
                "id": "aWtzOQTv8Dc",
                "title": "Saylor vs Dorsey: Battle for Bitcoin's Future",
                "duration": 720
            },
            {
                "id": "yQL9yua9Yq0",
                "title": "Michael Saylor on Bitcoin: The Digital Transformation",
                "duration": 3600
            },
            {
                "id": "KxTWC3ShYDE",
                "title": "Saylor: Why Bitcoin is the Only Scarce Asset",
                "duration": 1800
            },
            {
                "id": "k0cE2U8F8_Q",
                "title": "Michael Saylor: Bitcoin is Hope",
                "duration": 2700
            },
            {
                "id": "fZfg1Gtcg08",
                "title": "100% Saylor — Michael Saylor Best Moments",
                "duration": 600
            },
            {
                "id": "9jsmGd9puYU",
                "title": "Saylor: Bitcoin vs Real Estate - Why BTC Wins",
                "duration": 646
            },
            {
                "id": "coHC_9ApBdg",
                "title": "Michael Saylor: The Bitcoin Standard for Corporations",
                "duration": 5400
            },
            {
                "id": "W2R5h8K9jL0",
                "title": "Saylor: Bitcoin as Treasury Reserve Asset",
                "duration": 4200
            },
            {
                "id": "B4nK8mP2qS6",
                "title": "Michael Saylor on Bitcoin and the Future of Finance",
                "duration": 4800
            }
        ]
    },
    {
        "id": "dev-privacy-nodes",
        "name": "Dev, Privacy & Nodes",
        "emoji": "💻",
        "desc": "Building on Bitcoin, privacy & running nodes",
        "color": "#22c55e",
        "videos": [
            {
                "id": "yKdK-7AtAMQ",
                "title": "Bitcoin Lightning Network — How It Actually Works",
                "duration": 1276
            },
            {
                "id": "CG69c71aSLQ",
                "title": "Lightning Network Explained — Easy Guide",
                "duration": 600
            },
            {
                "id": "gLCyRFZOdGQ",
                "title": "How to Run a Bitcoin Lightning Node",
                "duration": 1800
            },
            {
                "id": "TASQj1hacuI",
                "title": "Bitcoin Privacy — Alex Gladstein",
                "duration": 2400
            },
            {
                "id": "MGNvaJyZ25A",
                "title": "Lightning Network: Everything You Need To Know",
                "duration": 900
            },
            {
                "id": "fsAUhFr1VXU",
                "title": "Bitcoin Privacy Made Simple: Wasabi Wallet Tutorial",
                "duration": 1860
            },
            {
                "id": "52pSd3I1nac",
                "title": "Wasabi CoinJoin Tutorial — Self Custody Privacy",
                "duration": 5040
            },
            {
                "id": "U9hdav36WAo",
                "title": "How to Use Wasabi Wallet for Bitcoin CoinJoin",
                "duration": 600
            },
            {
                "id": "KNaOeLlD6NA",
                "title": "Build a Bitcoin Node on Raspberry Pi with Umbrel",
                "duration": 1200
            },
            {
                "id": "QeCIVUH89KY",
                "title": "Switch to Bitcoin Knots on Start9 — Full Sovereignty",
                "duration": 900
            },
            {
                "id": "t4yuwtIhQIg",
                "title": "Start9: One-Click Bitcoin Node Setup Guide",
                "duration": 1500
            },
            {
                "id": "cmTrCoJKoig",
                "title": "Bitcoin Node From Scratch — Ubuntu + Bitcoin Knots + Solo Mining",
                "duration": 1800
            },
            {
                "id": "TpwnoPUyumA",
                "title": "Phoenix Wallet Tutorial — Self-Custody Lightning",
                "duration": 1500
            },
            {
                "id": "ZZKoSmQu30Q",
                "title": "Best Bitcoin Hardware Wallets Compared — BTC Sessions",
                "duration": 3621
            },
            {
                "id": "XRxbrfbeThg",
                "duration": 5910,
                "title": "Gigi on Internet Business Models & Freedom"
            },
            {
                "id": "JtzwTd9Ur5c",
                "duration": 900,
                "title": "Competing with Free | DerGigi"
            },
            {
                "id": "6Tr4-DL1c1s",
                "duration": 1800,
                "title": "Freedom Money: Der Gigi l Episode 1"
            },
            {
                "id": "ekRzqy7D1wk",
                "duration": 3600,
                "title": "Cybersecurity Secrets for Protecting Bitcoin"
            },
            {
                "id": "kL0Yc8ngzS0",
                "duration": 1200,
                "title": "Bitcoin Fixes Double Standards - Guest Gigi"
            },
            {
                "id": "9FE4mTr_6EI",
                "duration": 1200,
                "title": "How to Set Up a Bitcoin Node (MyNode)"
            },
            {
                "id": "lhzooru_B-o",
                "duration": 1200,
                "title": "Set Up a Bitcoin Node for just 00"
            },
            {
                "id": "Ld2s9MyMKMU",
                "duration": 600,
                "title": "Fastest way to build a Bitcoin Node in 2024"
            }
        ]
    },
    {
        "id": "documentaries",
        "name": "Documentaries",
        "emoji": "🎬",
        "desc": "Bitcoin documentaries & films",
        "color": "#dc2626",
        "videos": [
            {
                "id": "3XEuqixD2Zg",
                "title": "God Bless Bitcoin — Full Documentary",
                "duration": 5352
            },
            {
                "id": "8Z4hGvUET8I",
                "title": "Bitcoin: Beyond The Bubble",
                "duration": 4800
            },
            {
                "id": "mgmVEtSgu3o",
                "title": "Bitcoin FUD — Full Documentary",
                "duration": 3600
            },
            {
                "id": "4_tAOuMVFd0",
                "title": "Digital Gold — Full Documentary",
                "duration": 5400
            },
            {
                "id": "GZI0qo3diUo",
                "title": "Unlocking Crypto — The Bitcoin Field Guide",
                "duration": 6500
            },
            {
                "id": "ZKwqNgG-Sv4",
                "title": "Bitcoin: The End of Money As We Know It",
                "duration": 5020
            },
            {
                "id": "oksraL7wN6Q",
                "title": "God Bless Bitcoin — HD Version",
                "duration": 5352
            },
            {
                "id": "iVym9wtopqs",
                "title": "Banking on Bitcoin — Full Documentary",
                "duration": 5400
            },
            {
                "id": "m7_WDzPyoqU",
                "title": "I Live 500 Feet From a Bitcoin Mine — Investigative Doc",
                "duration": 1260
            },
            {
                "id": "tEnDP6p_9rY",
                "title": "Bitcoin Mining's Days Are Numbered — Cormint CEO",
                "duration": 2940
            },
            {
                "id": "d9DqvX7CJOc",
                "title": "The Fiat Standard: Can Bitcoin Fix This? — Saifedean",
                "duration": 5591
            },
            {
                "id": "M1JKLXxFDZc",
                "title": "Unconditional Advice for the Next Decade — Saifedean Ammous",
                "duration": 1282
            },
            {
                "id": "Yh1dOmQJoWQ",
                "duration": 5820,
                "title": "The Rise and Rise of Bitcoin (FULL)"
            },
            {
                "id": "gQ8XKns2ipc",
                "duration": 3120,
                "title": "The Satoshi Mystery: Origins of Bitcoin"
            },
            {
                "id": "4_4lFX8t3I8",
                "duration": 3600,
                "title": "Evolution of Cryptocurrency: 1983–2100"
            },
            {
                "id": "gcwnpvODd-8",
                "duration": 120,
                "title": "The Rise and Rise of Bitcoin | Official Trailer"
            },
            {
                "id": "iSF0KGsFuI8",
                "duration": 180,
                "title": "Money Electric: The Bitcoin Mystery | HBO Trailer"
            },
            {
                "id": "QpbTljF0vY8",
                "duration": 2400,
                "title": "The History of Bitcoin Mining - Doc"
            },
            {
                "id": "iqVuthH57wY",
                "duration": 1800,
                "title": "The Evolution of Bitcoin Mining!"
            }
        ]
    },
    {
        "id": "economics-money",
        "name": "Economics & Money",
        "emoji": "💰",
        "desc": "Austrian economics, inflation & sound money",
        "color": "#eab308",
        "videos": [
            {
                "id": "gp4U5aH_T6A",
                "title": "Bitcoin, Anarchy & Austrian Economics — Lex Fridman & Saifedean",
                "duration": 10800
            },
            {
                "id": "DKaZ-h-Wwhg",
                "title": "Bitcoin & Austrian Economics — Peter St. Onge",
                "duration": 3600
            },
            {
                "id": "fOpnpECKaY8",
                "title": "Bitcoin, Austrian Economics & Future of Money — Seb Bunney",
                "duration": 4200
            },
            {
                "id": "drs6Q_OX0HE",
                "title": "Austrian Economics Intro — The Bitcoin Way",
                "duration": 3000
            },
            {
                "id": "AdaHyUmRvCU",
                "title": "Austrian Economics & Monetary Policy of Bitcoin",
                "duration": 1800
            },
            {
                "id": "pZvy0JRz9GE",
                "title": "Saifedean: Bitcoin & Tether — Las Vegas Keynote",
                "duration": 2576
            },
            {
                "id": "hdtY_iMeVEg",
                "title": "Bitcoin Will Hit $100 Trillion Market — Saifedean Ammous",
                "duration": 123
            },
            {
                "id": "dlCbXoQokx0",
                "title": "Governments Will Accumulate Bitcoin — Mike Alfred on Coin Stories",
                "duration": 1800
            },
            {
                "id": "8rYl8wEotZk",
                "title": "Strategy CEO on Bitcoin Yields & Adoption — Coin Stories",
                "duration": 2400
            },
            {
                "id": "V2r0EaJQwLA",
                "title": "Lyn Alden: Bitcoin Long-Term Bull Case — Coin Stories",
                "duration": 2400
            },
            {
                "id": "yDpMGUZZC4c",
                "title": "Bitcoin Is the Internet of Money — David Marcus on Coin Stories",
                "duration": 1800
            },
            {
                "id": "jk_HWmmwiAs",
                "duration": 1800,
                "title": "How Money & Banking Work - Lyn Alden"
            },
            {
                "id": "Ih0e8AXT_-s",
                "duration": 1200,
                "title": "Broken Money | Oslo Freedom Forum"
            },
            {
                "id": "soGXgiGoMRU",
                "duration": 3960,
                "title": "Broken Money Thesis Presentation - Lyn Alden"
            },
            {
                "id": "k3NN_NZOdhY",
                "duration": 3060,
                "title": "Lyn Alden Content: Broken Money Thesis"
            },
            {
                "id": "_nSF9yZWalA",
                "duration": 3600,
                "title": "Principles of Economics Lecture 10: Money"
            },
            {
                "id": "dIqs9hGNU9A",
                "duration": 3600,
                "title": "Inflation & the Collapse of Civilization"
            },
            {
                "id": "PQ2wj8dnpqo",
                "duration": 3600,
                "title": "What is money? | Ammous & Fridman"
            },
            {
                "id": "TLhbc3moELQ",
                "duration": 3600,
                "title": "The Gold Standard: Chapters 1-4"
            },
            {
                "id": "bs_pYdK8CU8",
                "duration": 2400,
                "title": "Lyn Alden: Why Our Financial System Fails"
            },
            {
                "id": "TmV4Ns_ngSM",
                "duration": 3600,
                "title": "The Economics of Bitcoin - Saifedean"
            }
        ]
    },
    {
        "id": "freedom-sovereignty",
        "name": "Freedom & Self-Sovereignty",
        "emoji": "🗽",
        "desc": "Human rights, financial freedom & sovereignty",
        "color": "#0ea5e9",
        "videos": [
            {
                "id": "xLYYh4aPXAM",
                "title": "Bitcoin Is Protecting Human Rights — Alex Gladstein",
                "duration": 1800
            },
            {
                "id": "TASQj1hacuI",
                "title": "Bitcoin as Freedom Money — Wyoming Symposium",
                "duration": 2400
            },
            {
                "id": "Z_p70BzkMAs",
                "title": "Bitcoin Protects Human Rights — Gladstein & Balaji",
                "duration": 3600
            },
            {
                "id": "A-QpLdoDF14",
                "title": "Financial Freedom Against Tyranny",
                "duration": 1200
            },
            {
                "id": "ZYN4X_l1ZXg",
                "title": "Financial Freedom and Bitcoin — HRF",
                "duration": 1800
            },
            {
                "id": "BoHNkX4OWQA",
                "title": "Jack Mallers on Bitcoin for El Salvador",
                "duration": 1200
            },
            {
                "id": "d5_cYWLpDs8",
                "title": "A Brief Look at Bitcoin Maximalism — Guy Swann",
                "duration": 1800
            },
            {
                "id": "Y5wgZ3rFayQ",
                "title": "Bitcoin is Monetary Free Speech",
                "duration": 1200
            },
            {
                "id": "zV_A2yMZl0w",
                "title": "Alex Gladstein: Bitcoin Privacy & Freedom — Bitcoin Magazine",
                "duration": 1800
            },
            {
                "id": "n5K1lEDv8aM",
                "title": "Afghan Women Using Bitcoin Under Taliban — Gladstein",
                "duration": 1500
            },
            {
                "id": "IBY8SdA3W4Y",
                "title": "Bitcoin for Generational Wealth & Freedom — Breedlove",
                "duration": 1500
            },
            {
                "id": "dKDnkf6c250",
                "title": "Why Sell Your House for Bitcoin? — Breedlove Defense",
                "duration": 1200
            },
            {
                "id": "8Aofh-rx_l8",
                "title": "Bitcoin's Censorship Resistance Makes It Superior — Breedlove",
                "duration": 1500
            },
            {
                "id": "oDaTIFKe3k4",
                "duration": 900,
                "title": "4 Best Countries for Crypto Millionaires"
            },
            {
                "id": "lfPZteWuH3k",
                "duration": 900,
                "title": "Crypto-Friendly Countries Interview"
            },
            {
                "id": "KY72n6UFg1s",
                "duration": 900,
                "title": "Tax-Friendly Countries for Investors"
            },
            {
                "id": "6QiDB-RwGGw",
                "duration": 1200,
                "title": "Best Countries for Digital Nomads"
            },
            {
                "id": "mB0U_22_q4s",
                "duration": 1200,
                "title": "Living in El Salvador - First Hand Report"
            },
            {
                "id": "p8vLlp67UnA",
                "duration": 1800,
                "title": "Why I Moved to Dubai - Nomad Capitalist"
            },
            {
                "id": "PesTO9MRqJo",
                "duration": 2400,
                "title": "Bitcoin and Time with Gigi"
            }
        ]
    },
    {
        "id": "future-predictions",
        "name": "Trading & Predictions",
        "emoji": "🔮",
        "desc": "Analysis, price models & market theories",
        "color": "#8b5cf6",
        "videos": [
            {
                "id": "BpKfLfGbf0Q",
                "title": "Bitcoin Hyperbitcoinization: $1.5M by 2028?",
                "duration": 1800
            },
            {
                "id": "iDgDl9jzEmk",
                "title": "Bitcoin Price Prediction Models Explained",
                "duration": 2400
            },
            {
                "id": "1Mr9PknsM_Y",
                "title": "Michael Saylor's Best Explanation of Bitcoin",
                "duration": 1200
            },
            {
                "id": "hrjBK6AXAMk",
                "title": "Take The Bitcoin Orange Pill — How To Guide",
                "duration": 1500
            },
            {
                "id": "bPYl1-KBE50",
                "title": "The Ultimate Orange Pill — Bitcoin & Risk",
                "duration": 900
            },
            {
                "id": "qX2fbQgxJig",
                "title": "Why Bitcoin Could Reach $64M — Luke Mikic",
                "duration": 3600
            },
            {
                "id": "jzY_SxnTLNA",
                "title": "Bitcoin Is the Economic Singularity — Luke Mikic",
                "duration": 2400
            },
            {
                "id": "Z51vRLKvco4",
                "title": "Retiring on 0.1 Bitcoin — Luke Mikic",
                "duration": 1800
            },
            {
                "id": "Sxv6wpU1380",
                "title": "Is This Bitcoin Final Cycle? — Luke Mikic",
                "duration": 2700
            },
            {
                "id": "bw5Gepxo2Ps",
                "title": "Bitcoin Network Effects Model — 10x Users = 100x Price",
                "duration": 2400
            },
            {
                "id": "uF6Wx4Hr6iU",
                "title": "Tom Lee: Bullish Bitcoin Outlook & Corporate Treasuries — Coin Stories",
                "duration": 1800
            },
            {
                "id": "C9KPRcmFJWI",
                "title": "Bitcoin to $180K — Pomp Investments Prediction",
                "duration": 1500
            },
            {
                "id": "3-vBBYEXv6M",
                "title": "Saylor: Bitcoin as Apex Capital Strategy in the AI Age",
                "duration": 2100
            },
            {
                "id": "vjwFusEnfiE",
                "duration": 840,
                "title": "The Power Law Lens on Bitcoin - Santostasi"
            },
            {
                "id": "nlvx2-3LUhM",
                "duration": 3600,
                "title": "Bitcoin Power Law Explained | SLP624"
            },
            {
                "id": "_rMwlS1aHFs",
                "duration": 1800,
                "title": "The Physics of Bitcoins 10M Future"
            },
            {
                "id": "yM06uqse6Ks",
                "duration": 3600,
                "title": "The Science Behind M Bitcoin"
            },
            {
                "id": "XW1GUeBe0Rs",
                "duration": 7200,
                "title": "The Bitcoin Power Law WiM509"
            },
            {
                "id": "6WdwTR_S2Ig",
                "duration": 900,
                "title": "Bitcoin Stock-To-Flow Model"
            },
            {
                "id": "tPQs6eQ4zIU",
                "duration": 900,
                "title": "Stock to Flow - Prediciting Price?"
            },
            {
                "id": "Bh7LBF9cU6w",
                "duration": 900,
                "title": "Plan B Model Will Break in 2026"
            },
            {
                "id": "wjObfPHlPOk",
                "duration": 900,
                "title": "Understanding S2F Live Charts"
            },
            {
                "id": "KR8EZo5IesE",
                "duration": 300,
                "title": "Tom Lee: Bitcoin to  Million Path"
            },
            {
                "id": "LU5RqsGwvBg",
                "duration": 600,
                "title": "Bitcoins Path to M: Schwab"
            },
            {
                "id": "GzZecXEUJTI",
                "duration": 900,
                "title": "Realistically Reaching  Million"
            }
        ]
    },
    {
        "id": "health-fitness",
        "name": "Health & Fitness",
        "emoji": "💪",
        "desc": "Bitcoin mindset, carnivore & low time preference",
        "color": "#16a34a",
        "videos": [
            {
                "id": "mVMU1AFiSV0",
                "title": "Low Time Preference, Bitcoin and Health",
                "duration": 3600
            },
            {
                "id": "BQCOJlFXvpU",
                "title": "The Carnivore Diet & Bitcoin — Dr. Shawn Baker",
                "duration": 6400
            },
            {
                "id": "Rm5_wCObeQI",
                "title": "Carnivore Diet, Health Care Crisis & Bitcoin",
                "duration": 4920
            },
            {
                "id": "LjCRWwm0Xdk",
                "title": "Bitcoin Health Stack — Mind Body Sats",
                "duration": 1800
            },
            {
                "id": "c9D8p1kG0Cc",
                "title": "Bitcoin and Health with Jeff Booth",
                "duration": 2400
            },
            {
                "id": "lhHKljqRa-M",
                "title": "Low Time Preference Lifestyle — Bitcoin Way",
                "duration": 1800
            },
            {
                "id": "jn8uc92Oymo",
                "title": "Bitcoin Is Transforming Health & Energy Access Globally",
                "duration": 1500
            },
            {
                "id": "Pvmp0L5cbl8",
                "duration": 60,
                "title": "Iron Sharpens Iron - Proof of Work Fitness"
            },
            {
                "id": "W4OQaqqFKj0",
                "duration": 1200,
                "title": "Proof of Work Ep1: Fitness and Bitcoin"
            },
            {
                "id": "TWkKPijaDyQ",
                "duration": 1200,
                "title": "Proof of Work Ep2: Fitness and Bitcoin"
            },
            {
                "id": "FJB7e8PP0wU",
                "duration": 300,
                "title": "Proof Of Work(out) - July 2022"
            },
            {
                "id": "O3jeBF7S9ss",
                "duration": 1800,
                "title": "Treadmill, Chat, and Bitcoin"
            },
            {
                "id": "KfNkDQ-NI9U",
                "duration": 3600,
                "title": "Shawn Baker, the Carnivore MD"
            },
            {
                "id": "urKG9oi0krc",
                "duration": 600,
                "title": "Exit The Matrix - Buy BTC Eat Meat"
            }
        ]
    },
    {
        "id": "history",
        "name": "History",
        "emoji": "📜",
        "desc": "Bitcoin origins, cypherpunks & Satoshi",
        "color": "#92400e",
        "videos": [
            {
                "id": "dMSv4mgiy1o",
                "title": "How Bitcoin's Early Cypherpunks Paved the Way",
                "duration": 1500
            },
            {
                "id": "f-4Rs3Sqlhc",
                "title": "History of Bitcoin — Complete Timeline",
                "duration": 2400
            },
            {
                "id": "8Z4hGvUET8I",
                "title": "Bitcoin: Beyond The Bubble — Origins",
                "duration": 4800
            },
            {
                "id": "iVym9wtopqs",
                "title": "The History of Bitcoin — Full Timeline",
                "duration": 3600
            },
            {
                "id": "ZKwqNgG-Sv4",
                "title": "Bitcoin: The End of Money As We Know It",
                "duration": 5000
            },
            {
                "id": "DyV0OfU3-FU",
                "title": "Satoshi Nakamoto — The Hidden History",
                "duration": 2400
            },
            {
                "id": "LjNMgeqUgks",
                "title": "The Man Who Spent Millions of Bitcoin on Pizza — 60 Minutes",
                "duration": 42
            },
            {
                "id": "pbFEexyOwkw",
                "title": "Bitcoin History: From Zero to Hero",
                "duration": 1800
            },
            {
                "id": "dYFMoK1nDmc",
                "title": "60 Minutes: Bitcoin Beach El Salvador — CBS",
                "duration": 780
            },
            {
                "id": "wSh_KzcY_dA",
                "title": "60 Minutes: Stories About Cryptocurrency — CBS",
                "duration": 4000
            },
            {
                "id": "Mcz_4MvPlOE",
                "duration": 3600,
                "title": "Cypherpunks & Bitcoin: End of History"
            },
            {
                "id": "9vM0oIEhMag",
                "duration": 3600,
                "title": "Cypherpunks Write Code - ReasonTV"
            },
            {
                "id": "HDKQulqVCQg",
                "duration": 1800,
                "title": "Bitcoin and the End of History"
            },
            {
                "id": "eoBmOf4GDyo",
                "duration": 1800,
                "title": "Arrivano i Cypherpunk - History"
            },
            {
                "id": "gQ8XKns2ipc",
                "duration": 3120,
                "title": "The Satoshi Mystery: Origins of Bitcoin"
            },
            {
                "id": "h3nlVsy81wI",
                "duration": 3600,
                "title": "The Bitcoin Mystery Revealed! - Swan"
            },
            {
                "id": "7RlaC9ZJNtA",
                "duration": 2400,
                "title": "Unmasking the Creator of Bitcoin"
            },
            {
                "id": "3n_WnVPhRTo",
                "duration": 1800,
                "title": "The Satoshi Nakamoto Enigma"
            },
            {
                "id": "tWU3O3X5kKE",
                "duration": 600,
                "title": "The Story behind Bitcoin Pizza Day"
            },
            {
                "id": "iqVuthH57wY",
                "duration": 1800,
                "title": "The Evolution of Bitcoin Mining!"
            }
        ]
    },
    {
        "id": "kids-family",
        "name": "Kids & Family",
        "emoji": "👶",
        "desc": "Bitcoin explained for young audiences",
        "color": "#f472b6",
        "videos": [
            {
                "id": "BL5vUVQvmX4",
                "title": "What is Bitcoin? Explained in 3 Minutes — Tuttle Twins",
                "duration": 180
            },
            {
                "id": "qnyqQvIii0U",
                "title": "Cryptocurrency Explained for Kids & Beginners",
                "duration": 600
            },
            {
                "id": "94I9L90h0_s",
                "title": "What is Cryptocurrency? — Kid-Friendly",
                "duration": 300
            },
            {
                "id": "Z3xdGIyIV54",
                "title": "How to Explain Bitcoin to Children — Dad & Daughter",
                "duration": 480
            },
            {
                "id": "tQ1_8M1K0tM",
                "title": "Cryptocurrency Explained to Kids — Twins",
                "duration": 360
            },
            {
                "id": "EfKuZayeksI",
                "title": "Bitcoin for Kids — Simple Explanation",
                "duration": 420
            },
            {
                "id": "9ymZlz2l53I",
                "title": "What is Bitcoin? For Kids and Teens",
                "duration": 360
            },
            {
                "id": "B-IpiKURs3I",
                "duration": 3600,
                "title": "1 Hour Tuttle Twins Compilation"
            },
            {
                "id": "_ekzsZZGfsk",
                "duration": 3600,
                "title": "First Kids Cartoon about Bitcoin!"
            }
        ]
    },
    {
        "id": "lightning",
        "name": "Lightning",
        "emoji": "⚡",
        "desc": "Lightning Network & Layer 2",
        "color": "#7c3aed",
        "videos": [
            {
                "id": "yKdK-7AtAMQ",
                "title": "Lightning Network — How It Actually Works",
                "duration": 1276
            },
            {
                "id": "CG69c71aSLQ",
                "title": "Lightning Network Explained — Easy Guide",
                "duration": 600
            },
            {
                "id": "9UIOeoBEjmw",
                "title": "Lightning Network Explained",
                "duration": 480
            },
            {
                "id": "zEeMco4KqGs",
                "title": "Lightning Network for Beginners",
                "duration": 360
            },
            {
                "id": "bW7hvvjum9o",
                "title": "Lightning Network: Everything You Need To Know",
                "duration": 900
            },
            {
                "id": "vmafxrT8eCU",
                "title": "Getting Started with Lightning Wallets",
                "duration": 720
            },
            {
                "id": "i4z-2v_0H1k",
                "title": "How Lightning Network Will Change Bitcoin",
                "duration": 1200
            },
            {
                "id": "4kBCEbCWf1s",
                "title": "Lightning Network in Practice — Real Payments",
                "duration": 900
            },
            {
                "id": "Pef22g53zsg",
                "title": "Why Lightning is the Future of Payments",
                "duration": 1500
            },
            {
                "id": "69QUHgHErx0",
                "title": "TOP Lightning Wallets in 2025 — How to Spend Bitcoin",
                "duration": 1200
            },
            {
                "id": "bDzbKH5dwys",
                "title": "Zeus Wallet Tutorial — Embedded Lightning Node",
                "duration": 1500
            },
            {
                "id": "qug6tCHPXtw",
                "duration": 300,
                "title": "Bitfury Lightning Coffee Machine"
            },
            {
                "id": "bVC4795helY",
                "duration": 300,
                "title": "Lightning payment in Malaysia Cafe"
            },
            {
                "id": "39KpscRXyXY",
                "duration": 300,
                "title": "Buying Coffee Using Bitcoin - LN"
            },
            {
                "id": "sQPKdozYhQ8",
                "duration": 600,
                "title": "Beginners Guide to Coffee LN Payments"
            },
            {
                "id": "rrr_zPmEiME",
                "duration": 600,
                "title": "Bitcoins Lightning Network Explained"
            },
            {
                "id": "to8XItlplac",
                "duration": 3600,
                "title": "Lightning Transactions & Protocol Deep Dive"
            },
            {
                "id": "TpwnoPUyumA",
                "duration": 1500,
                "title": "Phoenix Wallet Setup & Tutorial"
            }
        ]
    },
    {
        "id": "memes-comedy",
        "name": "Memes & Comedy",
        "emoji": "😂",
        "desc": "Funny Bitcoin videos & meme compilations",
        "color": "#facc15",
        "videos": [
            {
                "id": "UDu5LOf_E-w",
                "title": "Bitcoin Memes Compilation",
                "duration": 600
            },
            {
                "id": "NMDABNK8j_Q",
                "title": "Funniest Crypto Memes — He Sold? Edition",
                "duration": 480
            },
            {
                "id": "RM1NdTvvtvk",
                "title": "Bitcoin Comedy Compilation",
                "duration": 720
            },
            {
                "id": "BgZO1ppaneg",
                "title": "Best Crypto TikToks Compilation",
                "duration": 540
            },
            {
                "id": "Ner16UBWdEg",
                "title": "Bitcoin Memes That Hit Different",
                "duration": 480
            },
            {
                "id": "heA1fZzRAFs",
                "title": "Funniest Bitcoin Moments Compilation",
                "duration": 600
            },
            {
                "id": "mEqr-8-TKrA",
                "title": "30 People Turning Down FREE Bitcoin — Mike Still",
                "duration": 420
            },
            {
                "id": "d6ham2mibiA",
                "title": "Bitcoin Street Reactions Compilation",
                "duration": 540
            },
            {
                "id": "UX1GIhOhkAE",
                "title": "Me Saying Bitcoin",
                "duration": 180
            },
            {
                "id": "61i2iDz7u04",
                "title": "BITCONNECT REMIX",
                "duration": 240
            },
            {
                "id": "fUFnLPblsBg",
                "title": "100% Saylor — Michael Saylor Best Moments",
                "duration": 600
            },
            {
                "id": "tWU3O3X5kKE",
                "duration": 600,
                "title": "The Story of Bitcoin Pizza Day"
            },
            {
                "id": "EFDMum1vs7Q",
                "duration": 36000,
                "title": "Pump It Up (Bitcoin Maximalist) 10 Hour Loop"
            },
            {
                "id": "uql_VKemddY",
                "duration": 36000,
                "title": "Vibing with the Fed and Bitcoin 10 Hour Loop"
            }
        ]
    },
    {
        "id": "mining",
        "name": "Mining",
        "emoji": "⛏️",
        "desc": "How Bitcoin mining works",
        "color": "#ea580c",
        "videos": [
            {
                "id": "El3y8AME8oA",
                "title": "How Bitcoin Mining Really Happens",
                "duration": 900
            },
            {
                "id": "lHipE05v4jg",
                "title": "How Bitcoin Mining Works — Complete Guide",
                "duration": 1200
            },
            {
                "id": "33i1PdSJgwA",
                "title": "How Bitcoin Mining Actually Works, Simplified",
                "duration": 600
            },
            {
                "id": "4HTtZhhXiAw",
                "title": "Bitcoin Mining Explained in 3 Minutes",
                "duration": 180
            },
            {
                "id": "yxfvEK7Nj8s",
                "title": "Bitcoin Mining Explained in 10 Minutes",
                "duration": 600
            },
            {
                "id": "DMfv8S8ffKA",
                "title": "Bitcoin Mining — Bloomberg Animated Explainer",
                "duration": 300
            },
            {
                "id": "5Wp6lInPQv0",
                "title": "The Cruel Reality of Bitcoin Mining — VoskCoin",
                "duration": 1200
            },
            {
                "id": "rQFWgLQuGzo",
                "title": "VoskCoin Mining Farm Numbers",
                "duration": 900
            },
            {
                "id": "CC8wQJuhP5g",
                "title": "Compass Mining Year in Review",
                "duration": 1800
            },
            {
                "id": "ACAn_yL-Too",
                "title": "Bitcoin Mining — Inside a Real Facility",
                "duration": 720
            },
            {
                "id": "Bjcn5OZwgcs",
                "title": "Is Bitcoin Mining Still Profitable?",
                "duration": 600
            },
            {
                "id": "C4Z5yoWfnAU",
                "title": "Is Bitcoin Mining At Home Still Worth It in 2025?",
                "duration": 1200
            },
            {
                "id": "lDafxxAgmUI",
                "duration": 900,
                "title": "MARA Granbury Facility Tour"
            },
            {
                "id": "UAhQoKhzzbA",
                "duration": 600,
                "title": "Marathon 200MW Mining Site Acquisition"
            },
            {
                "id": "YsYk8vyv32w",
                "duration": 300,
                "title": "The History of Bitcoin Mining"
            },
            {
                "id": "5Y2fkldA-lQ",
                "duration": 1800,
                "title": "The Early Days of Bitcoin Mining"
            },
            {
                "id": "JPanr1nsPA4",
                "duration": 600,
                "title": "Mining BTC in Paraguay via Hydro - MARA"
            },
            {
                "id": "YGkLWGM8os4",
                "duration": 300,
                "title": "UAE Immersion Facility Ribbon Cutting"
            },
            {
                "id": "iQiWQAtThns",
                "duration": 600,
                "title": "Marathon Digital Portfolio Overview"
            },
            {
                "id": "t5S1Y6OopHo",
                "duration": 900,
                "title": "BEST Home Miners 2024 Guide"
            }
        ]
    },
    {
        "id": "music",
        "name": "Music",
        "emoji": "🎵",
        "desc": "Bitcoin songs, rap & music videos",
        "color": "#ec4899",
        "videos": [
            {
                "id": "8n5k714GOlA",
                "title": "HODL GANG — Bitcoin Rap Remix",
                "duration": 240
            },
            {
                "id": "eH9b_qNbjEU",
                "title": "Bitcoin — Official Music Video (Teejay)",
                "duration": 210
            },
            {
                "id": "EPQJHNXdJfM",
                "title": "Crypto — Takeoff feat. Rich The Kid",
                "duration": 180
            },
            {
                "id": "KQ7rn3oi-Pc",
                "title": "Blockchain — Money Man",
                "duration": 195
            },
            {
                "id": "VpvwgDjQLGA",
                "title": "Bitcoin All The Way Up — Dollar Vigilante",
                "duration": 240
            },
            {
                "id": "f-4Rs3Sqlhc",
                "title": "Bitcoin Anthem — Crypto Music",
                "duration": 210
            },
            {
                "id": "dgKlBQmGQ98",
                "title": "Most Toxic Bitcoin Maxi — Robbie P",
                "duration": 240
            },
            {
                "id": "IrcN-zmCZMI",
                "title": "If It Was Not For Satoshi — Robbie P",
                "duration": 210
            },
            {
                "id": "lG08pD-8upE",
                "title": "Bitcoin Slang Remix — Robbie P",
                "duration": 225
            },
            {
                "id": "CnTxBAeGfaQ",
                "title": "Diamond Hands & Laser Eyes — Robbie P",
                "duration": 240
            },
            {
                "id": "fG5PKg81mEQ",
                "title": "Fliponomics — Robbie P",
                "duration": 210
            },
            {
                "id": "A7TuFy0fcuw",
                "title": "Bitcoin Song — Community Playlist",
                "duration": 240
            },
            {
                "id": "c5wbgDLr-u0",
                "title": "Bitcoin Lofi Beats — Study & HODL",
                "duration": 3600
            },
            {
                "id": "gSxKJJ9k3lA",
                "title": "The Ultimate Crypto Anthem — Betawi CryptoCoin",
                "duration": 394
            },
            {
                "id": "_c9WOks2mvg",
                "title": "Pump It Higher",
                "duration": 210
            },
            {
                "id": "FCA9i6MUCK0",
                "title": "Bitcoin Beats Mix — Volume 1",
                "duration": 1800
            },
            {
                "id": "XcerPhwbIFs",
                "title": "Orange Pill rApp — Wallet Stay Stackin'!",
                "duration": 240
            },
            {
                "id": "Y5r6e1VcIBE",
                "title": "BITCOIN SONG — Pat Ryan",
                "duration": 210
            },
            {
                "id": "fZfg1Gtcg08",
                "title": "Bitcoin Baron — ytcracker",
                "duration": 270
            },
            {
                "id": "yp0diaVLPrQ",
                "title": "Mark Zuckerberg's Sister Sings to Crypto",
                "duration": 240
            },
            {
                "id": "YbzNJr26H-4",
                "title": "Welcome To The Blockchain — Toby Ganger + Decap",
                "duration": 240
            },
            {
                "id": "U5NGVH8HDaw",
                "title": "Bitcoin Boomdeyada!",
                "duration": 180
            },
            {
                "id": "kdvTkddp1F0",
                "title": "Don't Get Zhou Tonged!!! — Zhou Tonged",
                "duration": 210
            },
            {
                "id": "nO6A4N9zjgE",
                "title": "Rich Men North of Richmond — Full Band Cover",
                "duration": 210
            },
            {
                "id": "RIsZyg8OXlI",
                "title": "10,000 Bitcoins — Laura Saggers",
                "duration": 240
            },
            {
                "id": "RglKdIovlX0",
                "title": "BANK — Bitcoin Music Video",
                "duration": 210
            },
            {
                "id": "s3UtbslfqS8",
                "title": "Gary Gensler, Isn't That True? — Bitcoin Heavy Metal",
                "duration": 240
            },
            {
                "id": "9I9l8vlTvJE",
                "title": "Toxic Maximalist — The Orange Pill Jam Project",
                "duration": 270
            },
            {
                "id": "DNYzHGM50Ys",
                "title": "Too Bit To Fail — Proof of Word EP",
                "duration": 240
            },
            {
                "id": "VMLakjlz6us",
                "title": "Ode to Satoshi — Roger 9000",
                "duration": 300
            },
            {
                "id": "BifVGcvJpxc",
                "title": "WAGMI",
                "duration": 210
            },
            {
                "id": "AQwyOhLBsI4",
                "title": "Stacking Sats — Jack Mallers",
                "duration": 240
            },
            {
                "id": "9johJ8eyucQ",
                "title": "It's Math — Greg Foss & Pleb Music",
                "duration": 270
            },
            {
                "id": "6ZKzapbQPZA",
                "title": "Banksters Paradise — A Bitcoin Song",
                "duration": 270
            },
            {
                "id": "Vz9iCgiSZrM",
                "title": "Bitcoin's Back — Lil Bubble (Backstreet Boys Parody)",
                "duration": 210
            },
            {
                "id": "GZ0YMSLZjfQ",
                "title": "Welcome To The Blockchain — Music Video",
                "duration": 240
            },
            {
                "id": "Otkg4Ftx6GI",
                "title": "The Bitcoin Song",
                "duration": 210
            },
            {
                "id": "7gfBP8kPzRA",
                "title": "The Bitcoin Song — Jay-Z Empire State of Mind Parody",
                "duration": 270
            },
            {
                "id": "WrEVpNdYkrs",
                "title": "B.R.E.A.M. — Zhou Tonged (Wu-Tang C.R.E.A.M. Parody)",
                "duration": 240
            },
            {
                "id": "AKqdUAhX3nA",
                "title": "Bitcoin Is Hope ft. Michael Saylor",
                "duration": 240
            },
            {
                "id": "KRopo3nofl4",
                "title": "10,000 Bitcoin Remix — Laura Saggers",
                "duration": 240
            },
            {
                "id": "U252iiG8YP0",
                "title": "Jingle Bells, Bank Cartels! A Bitcoin Christmas Song",
                "duration": 210
            }
        ]
    },
    {
        "id": "news",
        "name": "News",
        "emoji": "📰",
        "desc": "Latest Bitcoin news & market updates",
        "color": "#3b82f6",
        "videos": [
            {
                "id": "LGYcl4hwUOI",
                "title": "Bitcoin at 200-Week Moving Average — Buy Signal?",
                "duration": 1200
            },
            {
                "id": "kN5codbLCCY",
                "title": "Bitcoin Regulation Becoming National Security",
                "duration": 900
            },
            {
                "id": "DDk6-tdHeXQ",
                "title": "Bitcoin Technical Analysis — Elliott Wave",
                "duration": 1500
            },
            {
                "id": "HOYnvEVOTJA",
                "title": "Simply Bitcoin — Daily News Update",
                "duration": 3600
            },
            {
                "id": "1nsIy7PWXyY",
                "title": "Bitcoin Price Analysis — Key Levels",
                "duration": 1200
            },
            {
                "id": "K4ciiDyUvUo",
                "title": "Larry Fink: Bitcoin is Digital Gold — CNBC",
                "duration": 480
            },
            {
                "id": "-LPit2bEWAo",
                "title": "BlackRock CEO on Bitcoin ETF Success — CNBC",
                "duration": 600
            },
            {
                "id": "wSh_KzcY_dA",
                "title": "60 Minutes: Stories About Cryptocurrency — CBS",
                "duration": 4000
            },
            {
                "id": "CbEHD0esI_A",
                "title": "MicroStrategy Bitcoin Reserve Strategy — CNBC",
                "duration": 420
            },
            {
                "id": "BSiQHfEUabI",
                "title": "Bitcoin Hits New All-Time High — CNBC",
                "duration": 360
            },
            {
                "id": "5c03NCvohCA",
                "title": "Bitcoin ETF Record Performance — Bloomberg",
                "duration": 480
            },
            {
                "id": "N7Z7tpwSlBg",
                "title": "Strategy CEO on 2026 Bitcoin Outlook — Fox Business",
                "duration": 540
            },
            {
                "id": "DyMVHXz9Tgs",
                "title": "Bitcoin ETFs Survive First Stress Test — Bloomberg",
                "duration": 420
            },
            {
                "id": "dYFMoK1nDmc",
                "title": "60 Minutes: Bitcoin Beach El Salvador — CBS",
                "duration": 780
            },
            {
                "id": "WaEBc2prSPE",
                "title": "Next-Gen Bitcoin ETFs Outperforming — Bloomberg",
                "duration": 360
            },
            {
                "id": "wC4nzqrgvik",
                "title": "Iran Used Bitcoin To Break US Sanctions — Simply Bitcoin",
                "duration": 1800
            },
            {
                "id": "c3LyvfHQ9BE",
                "title": "Why Bitcoin Booms in October — Simply Bitcoin",
                "duration": 1200
            },
            {
                "id": "zo1pZlgAvpY",
                "title": "Is This the Final Bitcoin Crash Before All-Time Highs? — Simply Bitcoin",
                "duration": 1500
            }
        ]
    },
    {
        "id": "orange-pill",
        "name": "Orange Pill",
        "emoji": "🟠",
        "desc": "The Internet of Money & Bitcoin essentials",
        "color": "#f7931a",
        "videos": [
            {
                "id": "gCfA1lkmJo4",
                "title": "The Greatest Bitcoin Explanation — Michael Saylor",
                "duration": 1200
            },
            {
                "id": "1Mr9PknsM_Y",
                "title": "Saylor's Best Explanation Under 20 Minutes",
                "duration": 1200
            },
            {
                "id": "xegEpCLT0CQ",
                "title": "A Practical Approach to Orange Pilling",
                "duration": 1800
            },
            {
                "id": "heA1fZzRAFs",
                "title": "Orange Pill: The Bitcoin Guide",
                "duration": 900
            },
            {
                "id": "Bt2Z-_nhpwQ",
                "title": "How to Orange Pill Anyone",
                "duration": 600
            },
            {
                "id": "YT-38EneBWw",
                "title": "Bitcoin Street Interviews London — Mike Still",
                "duration": 1440
            },
            {
                "id": "og5zZssEWIc",
                "title": "Bitcoin Street Interviews Birmingham — Mike Still",
                "duration": 1500
            },
            {
                "id": "Uh-eTnRXCr8",
                "title": "Bitcoin Street Interviews Edinburgh — Mike Still",
                "duration": 1400
            },
            {
                "id": "vclZlAFXpEI",
                "title": "Give Me 9 Minutes and You Will Understand Bitcoin — Exit Manual",
                "duration": 600
            },
            {
                "id": "HhxcdMIJTLA",
                "title": "Telling People About Bitcoin Never Works — Exit Manual",
                "duration": 450
            },
            {
                "id": "r34hkJBeE-M",
                "title": "How I Lost 14 Bitcoins — Exit Manual",
                "duration": 555
            },
            {
                "id": "IuVkUqdqkcc",
                "title": "Buy Bitcoin When It Looks Like This — Exit Manual",
                "duration": 653
            },
            {
                "id": "4tqXvMNOuHk",
                "title": "Bitcoin Ethical Superiority Explained — Exit Manual",
                "duration": 480
            },
            {
                "id": "Sv9VAocAA80",
                "title": "Max Keiser: Bitcoin Will Replace the Dollar",
                "duration": 1200
            },
            {
                "id": "exK5yFEuBsk",
                "title": "Remember, Remember the 5th of November — Bitcoin",
                "duration": 180
            },
            {
                "id": "MQvvLwxxxdM",
                "title": "The Banks are BROKE",
                "duration": 600
            },
            {
                "id": "6xIq0FdmsIA",
                "duration": 4320,
                "title": "Andreas Antonopoulos: Internet of Money - Keynote"
            },
            {
                "id": "rc744Z9IjhY",
                "duration": 3600,
                "title": "Andreas Antonopoulos: The Internet of Money - What is Bitcoin?"
            },
            {
                "id": "y1KXs3uE42I",
                "duration": 5400,
                "title": "Andreas Antonopoulos: Why Bitcoin Matters - Internet of Money"
            },
            {
                "id": "KW_wYvZ1eZg",
                "duration": 4800,
                "title": "Andreas Antonopoulos: Decentralization & The Future of Money"
            },
            {
                "id": "y37M6WJks0A",
                "duration": 4200,
                "title": "Andreas Antonopoulos: Bitcoin vs Traditional Banking"
            },
            {
                "id": "oXjY5A7jW2Q",
                "duration": 3900,
                "title": "Andreas Antonopoulos: The Architecture of Trust"
            },
            {
                "id": "xS2F7G8H9I0",
                "duration": 4500,
                "title": "Andreas Antonopoulos: Money as a Content Type"
            },
            {
                "id": "p6kBKStI-Q1",
                "duration": 3600,
                "title": "Andreas Antonopoulos: Bitcoin for Beginners - Full Explainer"
            },
            {
                "id": "vT6U9R2tU7V",
                "duration": 5100,
                "title": "Andreas Antonopoulos: The Future of Cryptocurrency"
            },
            {
                "id": "wQ7V3S8vW9X",
                "duration": 3300,
                "title": "Andreas Antonopoulos: Understanding the Blockchain"
            }
        ]
    },
    {
        "id": "politics-regulation",
        "name": "Politics & Regulation",
        "emoji": "🏛️",
        "desc": "Government policy, ETFs & legal battles",
        "color": "#64748b",
        "videos": [
            {
                "id": "kN5codbLCCY",
                "title": "Bitcoin Regulation: National Security Issue",
                "duration": 900
            },
            {
                "id": "pR4t4dRdajw",
                "title": "Bitcoin vs Authoritarianism — Gladstein",
                "duration": 2400
            },
            {
                "id": "_6PvTUqyRt8",
                "title": "Alex Gladstein on Bitcoin Freedom",
                "duration": 1800
            },
            {
                "id": "kSbMU5CbFM0",
                "title": "Bitcoin vs Authoritarianism — HRF",
                "duration": 2100
            },
            {
                "id": "Y5wgZ3rFayQ",
                "title": "Financial Sovereignty & Bitcoin Policy",
                "duration": 1800
            },
            {
                "id": "R4gyS5mb9dE",
                "title": "Gladstein: Bitcoin Is a Tool Dictators Should Fear — 2025 Summit",
                "duration": 1800
            },
            {
                "id": "zV_A2yMZl0w",
                "title": "Gladstein: Bitcoin Privacy Technologies Redefining Money",
                "duration": 1800
            },
            {
                "id": "MuobSz7534s",
                "duration": 3119,
                "title": "Paving the Frontier - Dennis Porter"
            },
            {
                "id": "boZ7yJOFBk0",
                "duration": 2932,
                "title": "Crushing Anti-BTC Legislation - Porter"
            },
            {
                "id": "YqWoj2eFDp4",
                "duration": 1800,
                "title": "Right To Mine Policy - Dennis Porter"
            },
            {
                "id": "R-Rd12saPh8",
                "duration": 1200,
                "title": "The Fight for Bitcoin in America"
            },
            {
                "id": "_E_5Hk-vRj8",
                "duration": 1410,
                "title": "Bitcoin U.S. Reserve in 30 Days?"
            },
            {
                "id": "tWWb0-A0Rdk",
                "duration": 1200,
                "title": "Bitcoin Laws Are Changing | SAF"
            },
            {
                "id": "jfUX8d80ifw",
                "duration": 1200,
                "title": "Mined In America Act FT. Dennis Porter"
            },
            {
                "id": "lwJpvqMeLJg",
                "duration": 340,
                "title": "Bitcoin Breaking Records - SuperTalk"
            }
        ]
    },
    {
        "id": "tutorials",
        "name": "Tutorials",
        "emoji": "📚",
        "desc": "Learn Bitcoin step by step",
        "color": "#f7931a",
        "videos": [
            {
                "id": "El3y8AME8oA",
                "title": "Bitcoin Explained — Breaking It Down Simply",
                "duration": 900
            },
            {
                "id": "lHipE05v4jg",
                "title": "How Bitcoin Works — Complete Beginner Guide",
                "duration": 1200
            },
            {
                "id": "41JCpzvnn_0",
                "title": "Bitcoin for Beginners — 99Bitcoins",
                "duration": 720
            },
            {
                "id": "Gc2en3nHxA4",
                "title": "What is Bitcoin — Simply Explained",
                "duration": 540
            },
            {
                "id": "bBC-nXj3Ng4",
                "title": "How Bitcoin Works Under the Hood",
                "duration": 1320
            },
            {
                "id": "c8ytiynbnpk",
                "title": "Your First Bitcoin Wallet — BTC Sessions",
                "duration": 1500
            },
            {
                "id": "3Grj3Datdfw",
                "title": "Game-Changing Bitcoin Wallet (Cove) — BTC Sessions",
                "duration": 1600
            },
            {
                "id": "bsAznpEupIg",
                "title": "Easiest Bitcoin Wallet Setup (Aqua) — BTC Sessions",
                "duration": 2400
            },
            {
                "id": "IxgNp2h5j8w",
                "title": "How To Buy, Use and Secure Bitcoin — BTC Sessions",
                "duration": 1800
            },
            {
                "id": "6b0xTB2sE8E",
                "title": "Bull Bitcoin Wallet Full Tutorial — BTC Sessions",
                "duration": 5500
            },
            {
                "id": "mibKrTvtlyQ",
                "title": "Misty Breez Bitcoin Wallet Setup — BTC Sessions",
                "duration": 900
            },
            {
                "id": "Y3iAwLG6NlA",
                "title": "Bitcoin Wallets That Change Everything in 2026 — BTC Sessions",
                "duration": 1200
            },
            {
                "id": "Gc2en3nHxA4",
                "title": "Bitcoin Simply Explained in 5 Minutes",
                "duration": 300
            },
            {
                "id": "f-4Rs3Sqlhc",
                "title": "Complete History of Bitcoin in 12 Minutes",
                "duration": 720
            },
            {
                "id": "Ner16UBWdEg",
                "title": "Bitcoin in 2025 — What You Need to Know",
                "duration": 600
            },
            {
                "id": "4Lsr7lsy6Tk",
                "title": "How to Set Up a Bitcoin Node at Home",
                "duration": 1800
            },
            {
                "id": "OZK5hdKfb18",
                "title": "Bitcoin Security Best Practices",
                "duration": 900
            },
            {
                "id": "vmf_LtnagTs",
                "title": "Bitcoin Cold Storage Tutorial",
                "duration": 1200
            },
            {
                "id": "rKjce1jCxSM",
                "title": "Bitcoin Beginner Mistakes to Avoid",
                "duration": 780
            },
            {
                "id": "GR-E0aaFf0c",
                "title": "Bitcoin Explained for Complete Beginners",
                "duration": 600
            },
            {
                "id": "Y3iAwLG6NlA",
                "title": "Bitcoin Wallets That Change Everything in 2026 — BTC Sessions",
                "duration": 1906
            },
            {
                "id": "ZZKoSmQu30Q",
                "title": "Best Hardware Wallet Comparison 2025 — BTC Sessions",
                "duration": 3621
            },
            {
                "id": "KNaOeLlD6NA",
                "title": "Build Your Own Bitcoin Node with Umbrel — Raspberry Pi",
                "duration": 1200
            },
            {
                "id": "TpwnoPUyumA",
                "title": "Phoenix Wallet Setup — Self-Custody Lightning Made Easy",
                "duration": 1500
            },
            {
                "id": "lhzooru_B-o",
                "duration": 36000,
                "title": "10 Hours of Bitcoin Tutorials: Node & Wallet Setup"
            }
        ]
    }
];

// ── Station Persistence ──
var _lastStation = null;
var _isPaused = false;

function getInitialStation() {
    try {
        var saved = localStorage.getItem('tctv_lastStation');
        if (saved && STATIONS.some(function(s) { return s.id === saved; })) return saved;
    } catch(e) {}
    return STATIONS[Math.floor(Math.random() * STATIONS.length)].id;
}
function saveStation(stationId) {
    try { localStorage.setItem('tctv_lastStation', stationId); } catch(e) {}
}

// ── Global Clock Engine ──
function getPlaybackState(station) {
    var totalDuration = 0;
    for (var i = 0; i < station.videos.length; i++) {
        totalDuration += station.videos[i].duration;
    }
    if (totalDuration === 0) return { videoIndex: 0, offset: 0, video: station.videos[0] };
    var globalSec = Math.floor(Date.now() / 1000);
    var position = globalSec % totalDuration;
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

// ── Presence System ──
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

function joinStation(stationId) {
    if (_currentStation) _deletePresence();
    _currentStation = stationId;
    _writePresence(stationId);
    if (_viewerHeartbeat) clearInterval(_viewerHeartbeat);
    _viewerHeartbeat = setInterval(function() {
        if (_currentStation) _writePresence(_currentStation);
    }, 30000);
    if (!_viewerUnsub && typeof firebase !== 'undefined' && firebase.firestore) {
        var db = firebase.firestore();
        _viewerUnsub = db.collection('tctv_presence').onSnapshot(function(snap) {
            var counts = {};
            var now = Date.now();
            snap.forEach(function(doc) {
                var d = doc.data();
                if (!d.station || !d.ts) return;
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

function _deletePresence() {
    if (typeof firebase === 'undefined' || !firebase.firestore) return;
    firebase.firestore().collection('tctv_presence').doc(_getViewerId()).delete().catch(function() {});
}

function updateViewerBadges() {
    STATIONS.forEach(function(s) {
        var el = document.getElementById('tctv-viewers-' + s.id);
        if (el) {
            var count = _viewerCounts[s.id] || 0;
            el.textContent = count > 0 ? count + ' watching' : '';
        }
    });
    var mainCount = document.getElementById('tctv-main-viewers');
    if (mainCount && _currentStation) {
        var c = _viewerCounts[_currentStation] || 0;
        mainCount.textContent = c > 0 ? '👁 ' + c + ' live' : '';
    }
}

// ── White Noise Loading ──
function showWhiteNoise(callback) {
    var overlay = document.createElement('div');
    overlay.id = 'tctvNoise';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:200000;background:#000;display:flex;align-items:center;justify-content:center;flex-direction:column;';
    var canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 240;
    canvas.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;opacity:0.6;';
    overlay.appendChild(canvas);
    var title = document.createElement('div');
    title.style.cssText = 'position:relative;z-index:2;text-align:center;';
    title.innerHTML = '<div style="font-size:2.5rem;font-weight:900;color:#f7931a;text-shadow:0 0 30px rgba(247,147,26,0.5);letter-spacing:4px;margin-bottom:8px;">TIMECHAIN TV</div>' +
        '<div style="font-size:0.85rem;color:#888;letter-spacing:2px;">TUNING IN...</div>';
    overlay.appendChild(title);
document.body.appendChild(overlay);

    // White noise audio
    var audioCtx = null;
    var noiseNode = null;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        var bufferSize = audioCtx.sampleRate * 0.5;
        var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        var chData = buffer.getChannelData(0);
        for (var s = 0; s < bufferSize; s++) chData[s] = Math.random() * 2 - 1;
        noiseNode = audioCtx.createBufferSource();
        noiseNode.buffer = buffer;
        noiseNode.loop = true;
        var gain = audioCtx.createGain();
        gain.gain.value = 0.06;
        noiseNode.connect(gain);
        gain.connect(audioCtx.destination);
        noiseNode.start();
    } catch(e) {}

    
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

var ctx = canvas.getContext("2d");
    var noiseInterval = setInterval(function() {
        var imgData = ctx.createImageData(canvas.width, canvas.height);
        var data = imgData.data;
        for (var i = 0; i < data.length; i += 4) {
            var v = Math.random() * 255;
            data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
    }, 50);
    setTimeout(function() {
        overlay.style.transition = 'opacity 0.5s';
        overlay.style.opacity = "0"; if (noiseNode) { try { noiseNode.stop(); } catch(e) {} } if (audioCtx) { try { audioCtx.close(); } catch(e) {} }
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

function loadVideo(videoId, startSeconds) {
    var old = document.getElementById('tctv-player');
    if (!old) return;
    var wrap = old.parentElement;
    _currentVideoId = videoId;
    old.remove();
    var iframe = document.createElement('iframe');
    iframe.id = 'tctv-player';
    iframe.style.cssText = 'width:100%;height:100%;border:none;';
    iframe.setAttribute('allow', 'autoplay; encrypted-media');
    iframe.setAttribute('allowfullscreen', '');
    
    // Force autoplay=1. Note: muted=1 is often required for autoplay, but if the user has interacted with the page earlier audio may play.
    iframe.src = 'https://www.youtube.com/embed/' + videoId +
        '?start=' + Math.floor(startSeconds) +
        '&autoplay=1&controls=1&modestbranding=1&rel=0' +
        '&showinfo=0&iv_load_policy=3&playsinline=1&wmode=opaque';
    wrap.appendChild(iframe);
}

// ── Remote Functions ──
window.tctvRemoteChannel = function(dir) {
    var idx = STATIONS.findIndex(function(s) { return s.id === _currentStation; });
    var nextIdx = (idx + dir + STATIONS.length) % STATIONS.length;
    window.switchStation(STATIONS[nextIdx].id);
};

window.tctvRemoteBack = function() {
    if (_lastStation) window.switchStation(_lastStation);
};

window.tctvDirectChannel = function(val) {
    var num = parseInt(val);
    if (isNaN(num) || num < 1 || num > STATIONS.length) return;
    window.switchStation(STATIONS[num - 1].id);
    var input = document.getElementById('remote-ch-input');
    if (input) { input.value = ''; input.blur(); }
};

window.tctvRemotePause = function() {
    _isPaused = !_isPaused;
    var btn = document.getElementById('remote-pause-btn');
    var btn2 = document.getElementById('remote-pause-btn-inline');
    var p = document.getElementById('tctv-player');
    var overlay = document.getElementById('tctv-pause-overlay');
    var syncBtn = document.getElementById('tctv-sync-btn');
    
    if (_isPaused) {
        if (btn) btn.textContent = '▶';
        if (btn2) btn2.textContent = '▶';
        if (p) p.style.display = 'none';
        if (overlay) overlay.style.display = 'flex';
        // Stop audio by clearing src
        if (p) p.src = 'about:blank';
    } else {
        if (btn) btn.textContent = '⏸';
        if (btn2) btn2.textContent = '⏸';
        if (p) p.style.display = 'block';
        if (overlay) overlay.style.display = 'none';
        if (syncBtn) syncBtn.style.display = 'inline-block';
        syncPlayer();
    }
};

window.tctvToggleRemote = function() {
    var r = document.getElementById('tctv-remote');
    if (r) r.classList.toggle('collapsed');
    // Also toggle inline remote if present
    var ri = document.getElementById('tctv-remote-inline');
    if (ri) ri.classList.toggle('collapsed');
};

function syncPlayer() {
    if (!_currentStation) return;
    var station = STATIONS.find(function(s) { return s.id === _currentStation; });
    if (!station) return;
    var state = getPlaybackState(station);
    if (!state.video) return;
    
    var np = document.getElementById('tctv-now-playing');
    if (np) np.textContent = state.video.title;
    
    loadVideo(state.video.id, state.offset);
    
    var syncBtn = document.getElementById('tctv-sync-btn');
    if (syncBtn) syncBtn.style.display = 'none';
}

// ── Timeline & Moving EPG ──
function updateTimeline() {
    if (!_currentStation) return;
    var nowMs = Date.now();
    var station = STATIONS.find(function(s) { return s.id === _currentStation; });
    var state = getPlaybackState(station);

    var bar = document.getElementById('tctv-progress');
    if (bar && state.video) {
        var pct = ((state.video.duration - state.remaining) / state.video.duration) * 100;
        bar.style.width = pct + '%';
    }

    var timeLeft = document.getElementById('tctv-time-left');
    if (timeLeft) {
        var mins = Math.floor(state.remaining / 60);
        var secs = state.remaining % 60;
        timeLeft.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
    }

    // Shift EPG Slider
    var slider = document.getElementById('tctv-epg-slider');
    var container = document.getElementById('tctv-epg-container');
    if (slider && container && window._tctvGridStartMs) {
        var nowOffsetPx = ((nowMs - window._tctvGridStartMs) / 60000) * 10;
        var containerWidth = container.clientWidth;
        var nowLineTargetPx = containerWidth * 0.25;
        var shiftX = nowLineTargetPx - nowOffsetPx;
        slider.style.transform = 'translateX(' + shiftX + 'px)';
    }

    // Refresh block colors tracker
    STATIONS.forEach(function(s) {
        var sState = getPlaybackState(s);
        var blocks = document.querySelectorAll('[data-vid-id^="' + s.id + '-"]');
        blocks.forEach(function(b) {
            var idx = parseInt(b.getAttribute('data-vid-id').split('-').pop());
            var isNow = (idx === sState.videoIndex);
            b.style.background = isNow ? (s.color + '40') : '#1a1a1a';
            b.style.borderColor = isNow ? s.color : '#2a2a2a';
            var text = b.querySelector('span');
            if (text) text.style.color = isNow ? '#fff' : '#999';
        });
    });

    if (state.video && state.video.id !== _currentVideoId) {
        syncPlayer();
    }
}

function _renderEPG() {
    var now = new Date();
    var nowMs = now.getTime();
    var gridStartMs = nowMs - (60 * 60 * 1000); 
    window._tctvGridStartMs = gridStartMs;

    var html = '<div style="padding:8px 0 0;">';
    html += '<div style="display:flex;position:relative;background:#0a0a0a;">';

    html += '<div style="width:160px;flex-shrink:0;z-index:10;background:#0a0a0a;border-right:1px solid #222;">';
    html += '<div style="height:24px;"></div>';
    STATIONS.forEach(function(s, idx) {
        var isActive = s.id === _currentStation;
        html += '<div onclick="switchStation(\'' + s.id + '\')" data-station-id="' + s.id + '" style="height:54px;display:flex;align-items:center;gap:4px;padding:0 6px;cursor:pointer;border-bottom:1px solid #1a1a1a;background:' + (isActive ? 'rgba(247,147,26,0.12)' : 'transparent') + ';">';
        html += '<span style="font-size:0.65rem;font-weight:800;color:' + (isActive ? '#f7931a' : '#666') + ';min-width:16px;text-align:right;">' + (idx + 1) + '</span>';
        html += '<span style="font-size:1.1rem;">' + s.emoji + '</span>';
        html += '<div style="min-width:0;">';
        html += '<div data-ch-name style="font-size:0.72rem;font-weight:700;color:' + (isActive ? '#f7931a' : '#ccc') + ';line-height:1.1;">' + s.name + '</div>';
        html += '<span id="tctv-viewers-' + s.id + '" style="font-size:0.55rem;color:#22c55e;font-weight:600;"></span>';
        html += '</div></div>';
    });
    html += '</div>';

    html += '<div id="tctv-epg-container" style="flex:1;overflow:hidden;position:relative;background:#0a0a0a;cursor:grab;">';
    html += '<div id="tctv-epg-slider" style="position:absolute;top:0;left:0;height:100%;transition:transform 1s linear;">';
    html += '<div style="height:24px;position:relative;border-bottom:1px solid #333;display:flex;">';
    for (var i = 0; i < 13; i++) {
        var markMs = gridStartMs - (gridStartMs % 1800000) + (i * 1800000);
        var markX = ((markMs - gridStartMs) / 60000) * 10;
        var d = new Date(markMs);
        var h = d.getHours(), m = d.getMinutes();
        var label = (h % 12 || 12) + ":" + (m < 10 ? '0' : '') + m + (h >= 12 ? ' PM' : ' AM');
        html += '<div style="position:absolute;left:' + markX + 'px;top:0;font-size:0.6rem;color:#777;font-weight:700;border-left:1px solid #333;padding-left:4px;height:24px;line-height:24px;">' + label + '</div>';
    }
    html += '</div>';

    STATIONS.forEach(function(s) {
        html += '<div onclick="switchStation(\'' + s.id + '\')" style="height:54px;position:relative;border-bottom:1px solid #1a1a1a;">';
        var state = getPlaybackState(s);
        if (state.video) {
            var gridEndMs = gridStartMs + (6 * 3600000);
            var tempMs = Date.now() - (state.offset * 1000);
            var tempIdx = state.videoIndex;
            while (tempMs > gridStartMs) {
                tempIdx = (tempIdx - 1 + s.videos.length) % s.videos.length;
                tempMs -= s.videos[tempIdx].duration * 1000;
            }
            while (tempMs < gridEndMs) {
                var vid = s.videos[tempIdx];
                var drawStart = Math.max(tempMs, gridStartMs);
                var drawEnd = Math.min(tempMs + vid.duration * 1000, gridEndMs);
                var leftPx = ((drawStart - gridStartMs) / 60000) * 10;
                var widthPx = ((drawEnd - drawStart) / 60000) * 10;
                if (widthPx > 2) {
                    var isLive = (tempMs <= Date.now() && (tempMs + vid.duration * 1000) > Date.now());
                    var bg = isLive ? s.color + '40' : '#1a1a1a';
                    var br = isLive ? s.color : '#2a2a2a';
                    html += '<div data-vid-id="' + s.id + '-' + tempIdx + '" style="position:absolute;left:' + leftPx + 'px;top:6px;height:42px;width:' + (widthPx - 4) + 'px;background:' + bg + ';border:1px solid ' + br + ';border-radius:4px;display:flex;align-items:center;padding:0 8px;overflow:hidden;">';
                    html += '<span style="font-size:0.7rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:' + (isLive ? '#fff' : '#999') + ';">' + vid.title + '</span>';
                    html += '</div>';
                }
                tempMs += vid.duration * 1000;
                tempIdx = (tempIdx + 1) % s.videos.length;
            }
        }
        html += '</div>';
    });
    html += '</div>';
    html += '<div id="tctv-fixed-now" style="position:absolute;left:25%;top:0;bottom:0;width:2px;background:#ef4444;box-shadow:0 0 10px #ef4444;z-index:20;pointer-events:none;">';
    html += '<div style="position:absolute;top:0;left:-14px;background:#ef4444;color:#fff;font-size:0.55rem;font-weight:900;padding:1px 4px;border-radius:2px;">NOW</div>';
    html += '</div>';
    html += '</div></div></div>';
    return html;
}

window.renderTimechainTV = function() {
    var fc = document.getElementById('forumContainer');
    if (!fc) return;
    if (window._tctvActive && document.getElementById('tctv-player')) return;
    window._tctvActive = true;
    _isPaused = false;
    
    showWhiteNoise(function() {
        console.log('[TCTV] Initial Tuning Complete');
    });

    try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('portrait').catch(function() {}); } catch(e) {}
    
    var activeStation = _currentStation || getInitialStation();
    
    // ── History Sync ──
    if (window.location.hash !== '#timechain-tv') {
        history.replaceState({ channel: 'timechain-tv' }, '', '#timechain-tv');
    }
    
    var style = document.createElement('style');
    style.id = 'tctv-remote-styles';
    style.textContent = `
        /* Desktop: sidebar layout (couch left, video center, remote right) */
        @media (min-width: 1200px) {
            #nacho-couch-sidebar.desktop-only, #tctv-remote-sidebar.desktop-only { display: block !important; }
        }
        @media (max-width: 1199px) {
            #nacho-couch-sidebar, #tctv-remote-sidebar { display: none !important; }
        }
        /* Legacy fixed-position elements (hidden on desktop with sidebar layout) */
        #tctv-remote { position: fixed; right: 20px; top: 160px; width: 80px; background: #222; border: 3px solid #111; border-radius: 20px; padding: 15px 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.8), inset 0 2px 5px rgba(255,255,255,0.1); z-index: 200000; transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; gap: 12px; align-items: center; }
        #tctv-remote.collapsed { transform: translateX(65px); opacity: 0.8; }
        #tctv-remote:hover { opacity: 1; transform: translateX(0); }
        #tctv-remote-inline { transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        #tctv-remote-inline.collapsed { transform: translateX(45px); opacity: 0.5; }
        #tctv-remote-inline:hover { opacity: 1; transform: translateX(0); }
        .remote-btn { width: 44px; height: 44px; border-radius: 50%; background: #333; border: 2px solid #444; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 0 #111; position: relative; }
        .remote-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #111; }
        .remote-btn.red { background: #dc2626; border-color: #ef4444; }
        .remote-btn.blue { background: #2563eb; border-color: #3b82f6; }
        .remote-label { font-size: 0.55rem; color: #666; font-weight: 800; margin-top: -8px; text-transform: uppercase; }
        .remote-input { width: 44px; padding: 4px; background: #111; border: 1px solid #444; border-radius: 6px; color: var(--accent); font-family: 'Courier New', monospace; font-weight: 800; font-size: 0.9rem; text-align: center; outline: none; }
        .remote-input:focus { border-color: var(--accent); box-shadow: 0 0 10px rgba(247,147,26,0.3); }
        #nacho-couch { position: fixed; left: 20px; bottom: 140px; z-index: 200000; pointer-events: none; transition: 0.5s; display: none; }
        @media (min-width: 901px) { 
            #nacho-couch { display: block; } 
        }
        /* Mobile — maximize video, minimize other UI */
        @media (max-width: 900px) { 
            #tctv-remote { position: relative; top: 0; right: 0; width: 100%; height: auto; flex-direction: row; justify-content: center; padding: 6px; border-radius: 0; border: none; border-bottom: 1px solid #222; box-shadow: none; transform: none !important; opacity: 1 !important; z-index: 10; gap: 10px; }
            #tctv-remote.collapsed { transform: none; opacity: 1; }
            .remote-btn { width: 38px; height: 38px; font-size: 1rem; box-shadow: 0 2px 0 #111; }
            .remote-label { display: none; }
            .remote-input { width: 34px; font-size: 0.8rem; }
            #nacho-couch { position: relative; bottom: 0; left: 0; display: flex !important; width: 100%; justify-content: center; padding: 4px 0; background: #0a0a0a; border-bottom: 1px solid #222; transform: none !important; margin: 0; z-index: 1 !important; height: 60px; overflow: hidden; }
            #nacho-couch > div { height: 60px !important; transform: scale(0.7); transform-origin: center; }
            #nacho-couch-sidebar, #tctv-remote-sidebar { display: none !important; }
            /* Make video larger on mobile */
            .tctv-video-wrap { max-width: 100% !important; width: 100% !important; flex: none !important; }
            #tctv-video-container { max-height: 65vh !important; border-radius: 0 !important; }
            #tctv-player { max-height: 65vh !important; }
        }
        @keyframes nachoSway { 0%, 100% { transform: rotate(-1deg) translateY(0); } 50% { transform: rotate(1deg) translateY(-5px); } }
    `;
    document.head.appendChild(style);

    var html = '<div style="background:#0a0a0a;min-height:100vh;color:#fff;font-family:inherit;">';
    
// Remote
    var remoteHtml = '<div id="tctv-remote" class="collapsed desktop-only">' +
            '<div onclick="tctvToggleRemote()" style="width:30px;height:5px;background:#444;border-radius:3px;cursor:pointer;margin-bottom:5px;"></div>' +
            '<button class="remote-btn red" onclick="tctvRemotePause()" id="remote-pause-btn" title="Pause/Play">⏸</button><span class="remote-label">PWR</span>' +
            '<div style="background:#1a1a1a;border-radius:12px;padding:8px 4px;display:flex;flex-direction:column;gap:10px;">' +
                '<button class="remote-btn" onclick="tctvRemoteChannel(1)">▲</button>' +
                '<span class="remote-label" style="margin:0">CH</span>' +
                '<button class="remote-btn" onclick="tctvRemoteChannel(-1)">▼</button>' +
            '</div>' +
            '<button class="remote-btn blue" style="border-radius:10px;font-size:0.7rem;font-weight:900;" onclick="tctvRemoteBack()">BACK</button>' +
            '</div>';

    // Nacho on Couch
    var couchHtml = '<div id="nacho-couch" class="desktop-only">' +
            '<div style="position:relative;width:240px;height:160px;display:flex;align-items:center;justify-content:center;">' +
            '<span style="font-size:8rem;position:absolute;bottom:0;filter:drop-shadow(0 10px 20px rgba(0,0,0,0.5));">🛋️</span>' +
            '<div style="position:absolute;bottom:45px;left:70px;transition:0.3s;animation:nachoSway 4s ease-in-out infinite;">' +
            '<img src="nacho-deer.svg" style="width:85px;height:85px;">' +
            '<span style="position:absolute;top:-25px;right:-30px;background:white;color:black;padding:4px 10px;border-radius:12px;font-size:0.7rem;font-weight:700;box-shadow:0 4px 10px rgba(0,0,0,0.2);white-space:nowrap;animation:pulse 3s infinite;">Chill vibes... 📺🍿</span>' +
            '</div>' +
            '</div></div>';

    html += '<div style="position:sticky;top:0;z-index:100;background:#0a0a0a;">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#111;border-bottom:1px solid rgba(247,147,26,0.3);"><div onclick="goHome()" style="cursor:pointer;display:flex;align-items:center;gap:8px;"><span style="color:var(--text-muted);font-size:0.8rem;">←</span><span style="color:#f7931a;font-weight:900;font-size:1rem;letter-spacing:2px;">TIMECHAIN TV</span></div><div style="display:flex;align-items:center;gap:6px;"><span id="tctv-main-viewers" style="font-size:0.7rem;color:#22c55e;font-weight:600;"></span><span style="width:8px;height:8px;background:#ef4444;border-radius:50%;display:inline-block;box-shadow:0 0 6px #ef4444;"></span><span style="color:#ef4444;font-size:0.7rem;font-weight:800;letter-spacing:1px;">LIVE</span></div></div>';
    // Desktop: side-by-side layout with couch left, video center, remote right
    html += '<div style="display:flex;align-items:center;justify-content:center;gap:20px;background:#0a0a0a;padding:10px;">';
    // Left side - Couch Nacho (desktop only, inside layout flow)
    html += '<div id="nacho-couch-sidebar" style="flex:0 0 auto;display:none;" class="desktop-only">' +
            '<div style="position:relative;width:200px;height:160px;display:flex;align-items:center;justify-content:center;">' +
            '<span style="font-size:7rem;position:absolute;bottom:0;filter:drop-shadow(0 10px 20px rgba(0,0,0,0.5));">🛋️</span>' +
            '<div style="position:absolute;bottom:45px;left:60px;transition:0.3s;animation:nachoSway 4s ease-in-out infinite;">' +
            '<img src="nacho-deer.svg" style="width:75px;height:75px;">' +
            '<span style="position:absolute;top:-20px;right:-20px;background:white;color:black;padding:4px 10px;border-radius:12px;font-size:0.65rem;font-weight:700;box-shadow:0 4px 10px rgba(0,0,0,0.2);white-space:nowrap;animation:pulse 3s infinite;">Chill vibes... 📺🍿</span>' +
            '</div>' +
            '</div></div>';
    // Center - Video player (narrower on desktop, full width on mobile)
    html += '<div style="flex:0 1 auto;max-width:calc(100% - 280px);min-width:0;" class="tctv-video-wrap">' +
            '<div style="position:relative;aspect-ratio:16/9;max-height:40vh;background:#000;overflow:hidden;border-radius:8px;" id="tctv-video-container">' +
            '<div id="tctv-pause-overlay" style="position:absolute;inset:0;background:rgba(0,0,0,0.9);z-index:5;display:none;align-items:center;justify-content:center;flex-direction:column;gap:15px;">' +
                '<div style="font-size:3rem;animation:pulse 2s infinite;">🎬</div>' +
                '<div style="color:#f7931a;font-weight:900;letter-spacing:2px;">STANDBY</div>' +
                '<button onclick="tctvRemotePause()" style="background:var(--accent);color:#fff;border:none;padding:12px 24px;border-radius:12px;font-weight:800;cursor:pointer;">RESUME LIVE</button>' +
            '</div>' +
            '<iframe id="tctv-player" style="width:100%;height:100%;border:none;" allow="autoplay; encrypted-media"></iframe>' +
            '</div></div>';
    // Right side - Remote (desktop only, inside layout flow)
    html += '<div id="tctv-remote-sidebar" style="flex:0 0 auto;display:none;" class="desktop-only">' +
            '<div id="tctv-remote-inline" class="collapsed" style="width:80px;background:#222;border:3px solid #111;border-radius:20px;padding:15px 10px;box-shadow:0 10px 40px rgba(0,0,0,0.8),inset 0 2px 5px rgba(255,255,255,0.1);display:flex;flex-direction:column;gap:12px;align-items:center;">' +
            '<div onclick="tctvToggleRemote()" style="width:30px;height:5px;background:#444;border-radius:3px;cursor:pointer;margin-bottom:5px;"></div>' +
            '<button class="remote-btn red" onclick="tctvRemotePause()" id="remote-pause-btn-inline" title="Pause/Play">⏸</button><span class="remote-label">PWR</span>' +
            '<div style="background:#1a1a1a;border-radius:12px;padding:8px 4px;display:flex;flex-direction:column;gap:10px;">' +
                '<button class="remote-btn" onclick="tctvRemoteChannel(1)">▲</button>' +
                '<span class="remote-label" style="margin:0">CH</span>' +
                '<button class="remote-btn" onclick="tctvRemoteChannel(-1)">▼</button>' +
            '</div>' +
            '<button class="remote-btn blue" style="border-radius:10px;font-size:0.7rem;font-weight:900;" onclick="tctvRemoteBack()">BACK</button>' +
            '</div></div>';
    html += '</div>';
    html += '<div style="padding:10px 16px;background:#161616;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center;"><div style="flex:1;min-width:0;"><div style="font-size:0.65rem;color:#f7931a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">NOW PLAYING</div><div id="tctv-now-playing" style="font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#ddd;">Loading...</div></div>' +
            '<div style="display:flex;align-items:center;gap:8px;"><button onclick="syncPlayer()" id="tctv-sync-btn" style="background:#ef4444;border:none;color:#fff;font-size:0.6rem;font-weight:900;padding:4px 8px;border-radius:4px;cursor:pointer;animation:pulse 2s infinite;display:none;">JUMP TO LIVE</button><div id="tctv-time-left" style="font-size:0.75rem;color:#888;font-weight:600;flex-shrink:0;font-variant-numeric:tabular-nums;"></div></div></div>';
    html += '<div style="height:3px;background:#222;"><div id="tctv-progress" style="height:100%;background:#f7931a;width:0%;transition:width 1s linear;"></div></div></div>';

    // Mobile Lounge & Remote Area (Stays sticky/fixed on desktop, injected here for mobile flow)
    html += '<div class="tctv-mobile-ui-stack">';
    
    // Nacho on Couch
    html += '<div id="nacho-couch">' +
            '<div style="position:relative;width:240px;height:140px;display:flex;align-items:center;justify-content:center;">' +
            '<span style="font-size:7rem;position:absolute;bottom:0;filter:drop-shadow(0 10px 20px rgba(0,0,0,0.5));">🛋️</span>' +
            '<div style="position:absolute;bottom:35px;left:70px;transition:0.3s;animation:nachoSway 4s ease-in-out infinite;">' +
            '<img src="nacho-deer.svg" style="width:75px;height:75px;">' +
            '<span style="position:absolute;top:-25px;right:-30px;background:white;color:black;padding:4px 10px;border-radius:12px;font-size:0.7rem;font-weight:700;box-shadow:0 4px 10px rgba(0,0,0,0.2);white-space:nowrap;animation:pulse 3s infinite;">Chill vibes... 📺🍿</span>' +
            '</div>' +
            '</div></div>';

    // Remote
    html += '<div id="tctv-remote" class="collapsed">' +
            '<div onclick="tctvToggleRemote()" class="desktop-only" style="width:30px;height:5px;background:#444;border-radius:3px;cursor:pointer;margin-bottom:5px;"></div>' +
            '<button class="remote-btn red" onclick="tctvRemotePause()" id="remote-pause-btn" title="Pause/Play">⏸</button>' +
            '<div style="background:#1a1a1a;border-radius:12px;padding:8px 4px;display:flex;flex-direction:row;align-items:center;gap:12px;">' +
                '<button class="remote-btn" onclick="tctvRemoteChannel(-1)">▼</button>' +
                '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
                    '<span style="color:#666;font-size:0.7rem;font-weight:900;">#</span>' +
                    '<input type="text" id="remote-ch-input" class="remote-input" placeholder="--" maxlength="2" onkeydown="if(event.key===\'Enter\')tctvDirectChannel(this.value)" inputmode="numeric">' +
                '</div>' +
                '<button class="remote-btn" onclick="tctvRemoteChannel(1)">▲</button>' +
            '</div>' +
            '<button class="remote-btn blue" style="border-radius:10px;font-size:0.7rem;font-weight:900;" onclick="tctvRemoteBack()">BACK</button>' +
            '</div>';
            
    html += '</div>'; // end mobile-ui-stack

    html += _renderEPG();
    html += '<div style="height:120px;"></div></div>';
    fc.innerHTML = html;

    _currentStation = activeStation;
    saveStation(activeStation);
    joinStation(activeStation);
    syncPlayer();
    if (_syncInterval) clearInterval(_syncInterval);
    _syncInterval = setInterval(updateTimeline, 1000);
    
    // Ensure we are tracked as the current "channel" for the system's scroll/back logic
    window.currentChannelId = 'timechain-tv';
};

window.switchStation = function(stationId) {
    if (stationId === _currentStation) return;
    _lastStation = _currentStation;
    var stationObj = STATIONS.find(function(s) { return s.id === stationId; });
    showChannelNoise(stationObj ? stationObj.emoji + ' ' + stationObj.name : '');
    _currentStation = stationId;
    saveStation(stationId);
    joinStation(stationId);
    var state = getPlaybackState(stationObj);
    if (state.video) loadVideo(state.video.id, state.offset);
    document.querySelectorAll('[data-station-id]').forEach(function(el) {
        var isActive = el.getAttribute('data-station-id') === stationId;
        el.style.background = isActive ? 'rgba(247,147,26,0.12)' : 'transparent';
        var nameEl = el.querySelector('[data-ch-name]');
        if (nameEl) nameEl.style.color = isActive ? '#f7931a' : '#ccc';
    });
};

function showChannelNoise(stationName) {
    var playerWrap = document.getElementById('tctv-player') ? document.getElementById('tctv-player').parentElement : null;
    if (!playerWrap) return;
    var overlay = document.createElement('div');
    overlay.id = 'tctvChNoise';
    overlay.style.cssText = 'position:absolute;inset:0;z-index:10;background:#000;display:flex;align-items:center;justify-content:center;';
    var canvas = document.createElement('canvas');
    canvas.width = 160; canvas.height = 90;
    canvas.style.cssText = 'width:100%;height:100%;object-fit:cover;opacity:0.6;';
    overlay.appendChild(canvas);
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
    setTimeout(function() {
        overlay.style.transition = 'opacity 0.3s';
        overlay.style.opacity = '0';
        setTimeout(function() { clearInterval(noiseInterval); overlay.remove(); }, 300);
    }, 800);
}

window.cleanupTimechainTV = function() {
    if (_syncInterval) { clearInterval(_syncInterval); _syncInterval = null; }
    if (_viewerUnsub) { _viewerUnsub(); _viewerUnsub = null; }
    var iframe = document.getElementById('tctv-player');
    if (iframe) iframe.src = '';
    _currentVideoId = null;
    window._tctvActive = false;
    var s = document.getElementById('tctv-remote-styles');
    if (s) s.remove();
};

})();
