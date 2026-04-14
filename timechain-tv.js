
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
                "id": "2Jf8sxF8QFQ",
                "duration": 120,
                "title": "Miami debuts Bitcoin Bull Statue"
            },
            {
                "id": "83mw71TLYjY",
                "title": "Leveling Up Your Collection: PSA Grading for Bitcoin Trading Cards",
                "duration": 600
            },
            {
                "id": "YZ2B-Qnm0eM",
                "title": "The Timechain Codex by FractalEncrypt",
                "duration": 300
            },
            {
                "id": "nvPJ_F845ms",
                "title": "Sam Kimbrow & Asanoha on Bitcoin Culture — Movement of Art Ep. 1",
                "duration": 3600
            },
            {
                "id": "7DIp6D-68cQ",
                "title": "Can Bitcoin Rebuild Civilization? — Saifedean Ammous",
                "duration": 3033
            },
            {
                "id": "occ9L0dMMO4",
                "duration": 600,
                "title": "Bitcoin 2024 Art Exhibit - Bitcoin Bob"
            },
            {
                "id": "ic6pDq3OAec",
                "title": "Philosophy of Bitcoin — First Principles",
                "duration": 3600
            },
            {
                "id": "9-S17oAxIqA",
                "duration": 600,
                "title": "Bitcoin Pencil Art Timelapse - Bitcoin Apex"
            },
            {
                "id": "Q4owb6f9gbM",
                "title": "FractalEncrypt & Rebel Money on Bitcoin Art & Time — Movement of Art Ep. 5",
                "duration": 3600
            },
            {
                "id": "SogEkk3-XnA",
                "title": "I BOUGHT THIS BITCOIN NFT! (BRC-20, NFTs, Ordinals)",
                "duration": 900
            },
            {
                "id": "b4Q8Y3Rg7Rc",
                "title": "Frederic Guimont on Ratel & Bitcoin Comics — Bitcoin Art Podcast",
                "duration": 3600
            },
            {
                "id": "1gnIbVFnuCY",
                "title": "The Biggest Scam in Human History — Robert Breedlove",
                "duration": 5400
            },
            {
                "id": "vPUpdXZPpbQ",
                "duration": 180,
                "title": "Nashville Bitcoin Mural - Sound Money"
            },
            {
                "id": "edyO5-L9un8",
                "duration": 3600,
                "title": "Marcus Connor & The Bitcoin Roller Coaster Guy"
            },
            {
                "id": "P0WZCTDDGXQ",
                "title": "Create and List Your Own Bitcoin Ordinals — Ordinals Explained Ep. 5",
                "duration": 900
            },
            {
                "id": "JffTkZZC2z8",
                "title": "What is Money? — Robert Breedlove",
                "duration": 1800
            },
            {
                "id": "cgzH1jScIn0",
                "title": "Bitcoin NFTs — Ordinals Explained Full Guide (Wallet Setup & Mint)",
                "duration": 1200
            },
            {
                "id": "IUpIoZIoO2Q",
                "title": "Ripping BitBlockBoom Packs (Bitcoin Trading Cards)",
                "duration": 600
            },
            {
                "id": "N3J868zhH9g",
                "title": "Bitcoin Is Encrypted Energy — Breedlove & Saylor",
                "duration": 2400
            },
            {
                "id": "Tr7XO-SQw5g",
                "title": "Marcus Connor, Pepenardo & Rare Scrilla on Memes — Movement of Art Ep. 3",
                "duration": 3600
            },
            {
                "id": "9UxAUryUKXM",
                "duration": 36000,
                "title": "10 Hours of Bitcoin Lofi & Philosophy"
            },
            {
                "id": "gb2S1Filtic",
                "title": "How Bitcoin Fixes Fiat's Millennium of Mistakes — Saifedean",
                "duration": 1587
            },
            {
                "id": "yMoVGgR6h0Y",
                "title": "Money: The Language of Power — Robert Breedlove",
                "duration": 3600
            },
            {
                "id": "lRr9ofu0tnk",
                "duration": 180,
                "title": "Bitcoin Art Magazine Unleashed"
            },
            {
                "id": "Z0_9Jw56l4k",
                "title": "Opening 2 Packs Of Bitcoin Trading Cards",
                "duration": 600
            },
            {
                "id": "yvdZsN5s9sc",
                "duration": 2400,
                "title": "Based Trading Cards Movement"
            },
            {
                "id": "VLRt0QOZ3TE",
                "title": "Bitcoin Trading Cards: The Scarcest Collectibles on Earth",
                "duration": 300
            },
            {
                "id": "h9jO1cipnc8",
                "title": "2024 Bitcoin Trading Cards Halving Edition Whale Packs — Launch Announcement",
                "duration": 300
            },
            {
                "id": "xwufPksmi9w",
                "title": "Cracking A Pack Of Based Trading Cards Series 3 — Warriors Vs Villains",
                "duration": 600
            },
            {
                "id": "Ifi-Hg3n3bc",
                "title": "Bitcoin Ordinals Explained: How To Make Your First Bitcoin NFT",
                "duration": 900
            },
            {
                "id": "l5a6-9mNqho",
                "title": "World's Largest Bitcoin Sculpture",
                "duration": 300
            },
            {
                "id": "FiFwaHCRz7s",
                "title": "Bitcoin's BRC-20 Explosion: Everything You Need To Know About Ordinals",
                "duration": 1200
            },
            {
                "id": "W03SVhhOaEU",
                "title": "The Bitcoin Full Node Sculpture 7.0 — A Cypherpunk Chronometer (MirrorNode)",
                "duration": 600
            },
            {
                "id": "N3a8IQXKjeY",
                "title": "What are Ordinals? — Ordinals Explained Ep. 2",
                "duration": 600
            },
            {
                "id": "RwO9lB-rloo",
                "duration": 3600,
                "title": "Bitcoin, Art, and Freedom with Madex"
            },
            {
                "id": "uIaUj6Nsi70",
                "title": "2024: A Landmark Year for Bitcoin Trading Cards — Bold New Look",
                "duration": 300
            },
            {
                "id": "JPJyDYmovJo",
                "title": "A FULL BOX of Bitcoin Trading Cards — BTC Viking",
                "duration": 1200
            },
            {
                "id": "33emHIL1IoU",
                "duration": 900,
                "title": "The Bitcoin Full Node Sculpture - Eric Weiss"
            },
            {
                "id": "XHBydlTt2jM",
                "title": "The Rise of Ordinals and Art on Bitcoin",
                "duration": 1800
            },
            {
                "id": "KxTWC3ShYDE",
                "duration": 7200,
                "title": "Just-B on Airbrush Mastery - Bitcoin Art Podcast"
            },
            {
                "id": "XrD617FIfJM",
                "title": "FractalEncrypt's Bitcoin Full Node — DESIGN Feature for Block04",
                "duration": 600
            },
            {
                "id": "gNOnNz4d_mI",
                "title": "Tone Vays Rips BitBlockBoom 2024 Bitcoin Trading Cards Packs",
                "duration": 600
            },
            {
                "id": "sntmLivV56M",
                "title": "Adam O'Brien & Brandon Gentile Ripping BitBlockBoom 2024 Packs",
                "duration": 600
            },
            {
                "id": "indFxEWINDA",
                "title": "We Gave Bitcoin Trading Cards to No-Coiners — Here's What Happened",
                "duration": 600
            },
            {
                "id": "pcVCt2utTW4",
                "title": "How to Make a Bitcoin Ordinal Inscription in Under Two Minutes",
                "duration": 120
            },
            {
                "id": "iFb2MMUZBYs",
                "title": "Bitcoin Artist Trevor Jones Augments Reality",
                "duration": 600
            },
            {
                "id": "bHj-a4_nX78",
                "title": "FractalEncrypt Bitcoin Full Node Sculpture",
                "duration": 300
            },
            {
                "id": "3e36FXH5Hlw",
                "title": "Amy DiGi on Community, Craft & Handmade Bitcoin Art — Bitcoin Art Podcast Ep. 2",
                "duration": 3600
            },
            {
                "id": "KORJr5ZfzWI",
                "title": "Bitcoin Full Node Sculpture",
                "duration": 300
            },
            {
                "id": "UrCN7oG_4YY",
                "title": "Bitcoin NFTs: How to Create Ordinal Inscriptions",
                "duration": 900
            },
            {
                "id": "tgM5wwpwpzA",
                "title": "Ariel B., Flo M., Antonio B. & Psyfer on Stories & Myths — Movement of Art Ep. 2",
                "duration": 3600
            },
            {
                "id": "8TN7mq6cK7g",
                "title": "Bitcoin Art with FractalEncrypt — Freedom Footprint",
                "duration": 3600
            },
            {
                "id": "EPUNITbXwEM",
                "title": "Bitcoin Trading Cards: Collectible Art To Orange Pill The World",
                "duration": 600
            },
            {
                "id": "GRby6vAPwHI",
                "title": "Bitcoin, Art, and Our Divine Lost Knowledge — Ariel Birdie",
                "duration": 3600
            },
            {
                "id": "JQg_s0wt96M",
                "title": "Bitcoin Trading Cards Are Back With Series Two",
                "duration": 600
            },
            {
                "id": "e1ojV8YwA2c",
                "title": "Gus Grillasca on Rare Pepes, BTC Art & Creative Engineering — Bitcoin Art Podcast Ep. 1",
                "duration": 3600
            },
            {
                "id": "I0SecXkqums",
                "title": "Bitcoin Full Node Sculpture Lightning Auction Launch",
                "duration": 300
            },
            {
                "id": "5gl2xVJ9mTw",
                "title": "What are Satributes & Recursions? — Ordinals Explained Ep. 3",
                "duration": 600
            },
            {
                "id": "PqFz8R1CZYo",
                "title": "Bitcoin as a Kardashev-Scale Technology — Robert Breedlove",
                "duration": 2400
            },
            {
                "id": "0qS_oBk-tbY",
                "title": "FractalEncrypt: Artistic Bitcoin Education — Bitcoin With Jake #44",
                "duration": 3600
            },
            {
                "id": "wYhpD6Y6E8E",
                "title": "Meet Based Trading Cards — Bitcoin Culture You Can Hold",
                "duration": 600
            },
            {
                "id": "cKkokcMMnpc",
                "title": "Bitcoin Aligns with the Laws of Nature — Robert Breedlove",
                "duration": 1800
            },
            {
                "id": "wSLejJ88VGQ",
                "title": "Ripping Spirit of Satoshi Packs (Bitcoin Trading Cards)",
                "duration": 600
            },
            {
                "id": "rYiWd-qIRQA",
                "title": "Kontext on Writing, Music & Stoicism — Bitcoin Art Podcast Ep. 5",
                "duration": 3600
            },
            {
                "id": "j3QJlyRMHpI",
                "title": "Art on Bitcoin: Shaping the Future of Digital Creativity",
                "duration": 2700
            },
            {
                "id": "NALikCvCyes",
                "title": "The Truth About Money, Inflation and Bitcoin — Robert Breedlove",
                "duration": 2400
            },
            {
                "id": "RnducAborVw",
                "duration": 180,
                "title": "Bitcoin Art Gallery - Miami 2022"
            },
            {
                "id": "8FxyOC26TYE",
                "title": "What's In A Based Trading Cards Bitcoin Pack?",
                "duration": 600
            },
            {
                "id": "-vKBCrUyCEU",
                "title": "Bitcoin Ordinals Explained",
                "duration": 600
            },
            {
                "id": "omKlwzKmKBE",
                "title": "Bitcoin Trading Cards: Understanding True Scarcity and Value",
                "duration": 600
            },
            {
                "id": "HVKq5qfZSqU",
                "title": "FractalEncrypt Bitcoin Full Node Book & Canvas — Bitcoin 2022 Conference",
                "duration": 300
            },
            {
                "id": "EaU5yFi61hg",
                "title": "Yonat Vaks on Her Artistic Journey & Bitcoin Art — Bitcoin Art Podcast Ep. 3",
                "duration": 3600
            },
            {
                "id": "ImZDBBjdX6s",
                "title": "Opening The BOX! 24 Packs of BTC Trading Cards — Crypto Viking",
                "duration": 1200
            },
            {
                "id": "3nA4HhsbZMQ",
                "title": "Anik Malcolm on Finding Purpose in Bitcoin Art — Bitcoin Art Podcast Ep. 4",
                "duration": 3600
            },
            {
                "id": "MRnmP7pbR0s",
                "duration": 3600,
                "title": "Creating Meaningful Art with FractalEncrypt"
            },
            {
                "id": "H1oc5HKixBg",
                "title": "The Bitcoin Full Node Sculpture 4.0 — A Cypherpunk Chronometer",
                "duration": 600
            },
            {
                "id": "Mqc6M8rZRi8",
                "duration": 600,
                "title": "BITCOIN TRADING CARDS?"
            },
            {
                "id": "SKIIif9WQok",
                "title": "Bitcoin Renaissance Legacy: Beyond Digital Gold",
                "duration": 1242
            },
            {
                "id": "lo7eeL1E_VQ",
                "duration": 300,
                "title": "A Madex Manifesto"
            },
            {
                "id": "OszL_Q2wvNQ",
                "title": "Welcome to Ordinals! What is Ordinal Theory? — Ordinals Explained Ep. 1",
                "duration": 600
            },
            {
                "id": "EQSyE-EzOqM",
                "title": "Bitcoin Full Node Sculpture Auction Close",
                "duration": 180
            },
            {
                "id": "BrfJgr19MPY",
                "title": "Alex Schaefer on Burning Banks & Protest Art — The Whole Entire Universe",
                "duration": 3600
            },
            {
                "id": "bgDwvJOtSSY",
                "title": "Naomi Olson on Ocean Art & Aloha Energy — The Whole Entire Universe",
                "duration": 3600
            },
            {
                "id": "QVg0ZmxrYLo",
                "title": "Bitcoin's Most Beautifully Absurd Art Drop",
                "duration": 1020
            },
            {
                "id": "Q5Wxg53qu9s",
                "title": "The Bitcoin Full Node Sculpture #2 of 10",
                "duration": 300
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
                "id": "9e5JejAWrwY",
                "title": "The Bitcoin Conference 2025 — Day 1 Main Stage",
                "duration": 28800
            },
            {
                "id": "9UxAUryUKXM",
                "duration": 2979,
                "title": "Donald Trump 2024 Keynote - Nashville"
            },
            {
                "id": "4S6lzgc7tFc",
                "title": "Bitcoin Beyond Capital: Freedom Money for the Global South (Femi Longe) — MIT Bitcoin Expo 2025",
                "duration": 1800
            },
            {
                "id": "75O56lhJMJI",
                "duration": 3600,
                "title": "Welcome to Bitcoin Country - Adopting BTC 2024"
            },
            {
                "id": "SFUiGTayVL8",
                "title": "Saifedean: Bitcoin & Tether — Drinking the Dollar Milkshake",
                "duration": 857
            },
            {
                "id": "TEVJUjOGmOI",
                "title": "Bitcoin Core Developer Roundtable — MIT Bitcoin Expo 2025",
                "duration": 3600
            },
            {
                "id": "nC37CqWpxfI",
                "title": "Saylor & Dorsey Interview",
                "duration": 3400
            },
            {
                "id": "f3NBhSXtE5g",
                "duration": 1840,
                "title": "Edward Snowden 2024 Keynote - Privacy"
            },
            {
                "id": "kE3TpVS27os",
                "duration": 1200,
                "title": "JD Vance Keynote - Bitcoin 2025 Las Vegas"
            },
            {
                "id": "vRuPeBAjLTI",
                "duration": 1948,
                "title": "JIMMY SONG | DESTROYING RENT SEEKING"
            },
            {
                "id": "M-PIOaHxX4c",
                "title": "BitVM Creator Robin Linus: This Breakthrough Will Revolutionize Bitcoin — MIT Bitcoin Expo 2025",
                "duration": 1800
            },
            {
                "id": "RoRZE2DpEzE",
                "title": "Jack Mallers: The HODLers Dilemma — Bitcoin 2025 Keynote",
                "duration": 2098
            },
            {
                "id": "XdgP25UcHB0",
                "title": "Bitcoin for Corporations — Saylor & Dorsey",
                "duration": 12600
            },
            {
                "id": "XT-B9k9t5B8",
                "title": "LIVE: The MIT Bitcoin Expo 2025 — Day 2 Full Stream",
                "duration": 28800
            },
            {
                "id": "R4gyS5mb9dE",
                "title": "Alex Gladstein: Dictators Should Be Afraid — Policy Summit 2025",
                "duration": 1800
            },
            {
                "id": "TTHU_N_n5Ks",
                "duration": 2820,
                "title": "PlanB Forum Lugano 2024 - Stephan Livera"
            },
            {
                "id": "XVGME04z_3k",
                "title": "Bitcoin Amsterdam 2025 — Day 2 Livestream",
                "duration": 28800
            },
            {
                "id": "Hp-HlJ0PbpI",
                "title": "Bitcoin Thailand 2024 — Day 1",
                "duration": 18000
            },
            {
                "id": "gu9OulAijy4",
                "duration": 7200,
                "title": "The Pacific Bitcoin Conference"
            },
            {
                "id": "eEtxKbERWyA",
                "title": "Bitcoin Core Dev Jeremy Rubin: Building Char Network — MIT Bitcoin Expo 2025",
                "duration": 1200
            },
            {
                "id": "O9KnBcWMkpw",
                "duration": 2243,
                "title": "Michael Saylor 2024 Keynote - Nashville"
            },
            {
                "id": "1PkMFIa7rmQ",
                "duration": 2415,
                "title": "21 Rules of Bitcoin - Saylor Prague 2024"
            },
            {
                "id": "dMHhuY35NKY",
                "title": "Tor Project Co-Founder Roger Dingledine: Anonymity in Society — MIT Bitcoin Expo 2025",
                "duration": 1800
            },
            {
                "id": "dWaHWT15sOQ",
                "title": "Paolo Ardoino: Why Tether Loves Bitcoin — Bitcoin 2025",
                "duration": 1029
            },
            {
                "id": "LsLKr_dWdpU",
                "title": "The Eric Semler Interview — MIT Bitcoin Expo 2025",
                "duration": 1800
            },
            {
                "id": "rXsRvBXbZyU",
                "title": "Lightning Network Co-Inventor Tadge Dryja: Here Comes the Hornet's Nest — MIT Bitcoin Expo 2025",
                "duration": 1800
            },
            {
                "id": "-LGpW2PKwHA",
                "title": "Bitcoin Core Developer Interview: Antoine Poinsot — MIT Bitcoin Expo 2025",
                "duration": 1800
            },
            {
                "id": "M2zGs2E-pfs",
                "title": "The Future of Corporate Bitcoin Adoption — MIT Bitcoin Expo 2025",
                "duration": 1200
            },
            {
                "id": "sNE-2ffq5MA",
                "title": "Fighting for Freedom Under Zimbabwe's Hyperinflation (Evan Mawarire) — MIT Bitcoin Expo 2025",
                "duration": 1800
            },
            {
                "id": "pt-Wv-M5uNA",
                "title": "Bitcoin MENA 2025 — Day 1 Livestream",
                "duration": 28800
            },
            {
                "id": "pDA2r4AblD0",
                "title": "How To Orange Pill Anyone — BitBlockBoom",
                "duration": 2400
            },
            {
                "id": "Ps3BU0edwqE",
                "title": "Adopting Bitcoin 2024 — Day 2 Livestream",
                "duration": 28800
            },
            {
                "id": "TUO10-HcdvY",
                "duration": 2880,
                "title": "DEBATE: Bitcoin Ossification | Lugano 2024"
            },
            {
                "id": "p6kBKSZqjn4",
                "duration": 18000,
                "title": "Bitcoin Conference 2025: Opening Day Marathon"
            },
            {
                "id": "I3Qld_HXQuM",
                "duration": 600,
                "title": "Nostrability Workshop - BBB 2024"
            },
            {
                "id": "rNok4Ht6n1E",
                "title": "Bitcoin, Not Crypto: Why Bitcoin-Only VC Will Win (Nico Lechuga) — MIT Bitcoin Expo 2025",
                "duration": 1200
            },
            {
                "id": "HGyiOlXg-XY",
                "title": "Top 10 Most Iconic Bitcoin Conference Moments",
                "duration": 1200
            },
            {
                "id": "SVJCpnSANG4",
                "title": "Building Bitcoin Insurance for Financial Institutions (Anchorwatch) — MIT Bitcoin Expo 2025",
                "duration": 1200
            },
            {
                "id": "-NlgxiLgqZo",
                "title": "Why Nostr Feels Like Bitcoin in 2012 (Vitor Pamplona) — MIT Bitcoin Expo 2025",
                "duration": 1200
            },
            {
                "id": "YQrfB9327jI",
                "title": "Bitcoin Amsterdam 2025 — Day 1 Livestream",
                "duration": 28800
            },
            {
                "id": "3e3KE40r_WM",
                "title": "The Bitcoin Conference 2025 — Day 1 Full Livestream",
                "duration": 28800
            },
            {
                "id": "IjR3Hj0aRW4",
                "duration": 1250,
                "title": "Howard Lutnick 2024 Keynote - Nashville"
            },
            {
                "id": "wAv0T2nX0v0",
                "title": "Strategy CEO Phong Le: MIT Bitcoin Expo 2025 Keynote",
                "duration": 2400
            },
            {
                "id": "P1n7XipTCck",
                "duration": 33805,
                "title": "Bitcoin 2024 Nashville: Full GA Day 2 Livestream"
            },
            {
                "id": "2qiJIFBJPIU",
                "title": "The Bitcoin Conference 2025 — Day 3 Livestream",
                "duration": 28800
            },
            {
                "id": "IXKLholMqwE",
                "title": "Former CFTC Chairman Tim Massad: Bitcoin & Digital Identity — MIT Bitcoin Expo 2025",
                "duration": 1800
            },
            {
                "id": "rQMFrpUFcNM",
                "title": "Michael Saylor Keynote — Bitcoin MENA 2025",
                "duration": 2400
            },
            {
                "id": "hqoagNBtIps",
                "title": "Michael Saylor: Bitcoin Prophecy — BTC Prague 2025",
                "duration": 2400
            },
            {
                "id": "gCfA1lkmJo4",
                "title": "Michael Saylor — The Greatest Bitcoin Explanation",
                "duration": 1200
            },
            {
                "id": "0OiZY1MRHXo",
                "duration": 600,
                "title": "Nostr Wallet Connect Workshop - BBB 2024"
            },
            {
                "id": "6fgFyQEWiK4",
                "title": "Saifedean Ammous: How Bitcoin Could End Wars — Amsterdam 2025",
                "duration": 1691
            },
            {
                "id": "gn5sQC19rvM",
                "title": "MIT Digital Currency Initiative & Future of Bitcoin Research (Neha Nerula) — MIT Bitcoin Expo 2025",
                "duration": 1800
            },
            {
                "id": "QvtnQfVdLYU",
                "title": "What People Get Wrong About Bitcoin Core (Sjors Provoost) — MIT Bitcoin Expo 2025",
                "duration": 1200
            },
            {
                "id": "eRgHb8BGs18",
                "title": "Adopting Bitcoin 2024 — Day 1 Livestream",
                "duration": 28800
            },
            {
                "id": "jc4lkDeozCQ",
                "duration": 3600,
                "title": "Eric Trump speaks at Bitcoin Asia 2024"
            },
            {
                "id": "--IFcOIEfl4",
                "duration": 2632,
                "title": "No Second Best - Jack Mallers Prague 2024"
            },
            {
                "id": "lW8r9hq8-yU",
                "title": "Bitcoin Core Developer Interview: Gloria Zhao — MIT Bitcoin Expo 2025",
                "duration": 1800
            },
            {
                "id": "ckvTy0Fsc_M",
                "title": "Bitcoin Privacy on Trial: Samourai Wallet & Tornado Cash — MIT Bitcoin Expo 2025",
                "duration": 1800
            },
            {
                "id": "r8rQUEyAksg",
                "title": "BITCOIN DAY 2024",
                "duration": 14400
            },
            {
                "id": "reVebuAf_Cs",
                "title": "Michael Saylor: 21 Ways To Wealth — Bitcoin 2025 Keynote",
                "duration": 2211
            },
            {
                "id": "bLEv8FcfxfE",
                "title": "Why Bitcoin-Backed Lending Will Eat the World (Mauricio di Bartolomeo) — MIT Bitcoin Expo 2025",
                "duration": 1800
            },
            {
                "id": "0XnB_ZqL6fo",
                "duration": 1200,
                "title": "Freedom Festival 2024 - Mass Adoption"
            },
            {
                "id": "e_yg6cLsQHE",
                "title": "Bitcoin Address Poisoning Attacks (Jameson Lopp) — MIT Bitcoin Expo 2025",
                "duration": 1200
            },
            {
                "id": "tO1QTCLrbB8",
                "title": "Matt Odell: Bitcoin-Native Venture Capital — MIT Bitcoin Expo 2025",
                "duration": 1200
            },
            {
                "id": "xCyPbFx0Ktg",
                "title": "Why Bitcoin Must Change — Or Be Left Behind (Jameson Lopp) — MIT Bitcoin Expo 2025",
                "duration": 1800
            },
            {
                "id": "4NoJnPmCVdU",
                "title": "Solving Bitcoin's Quantum Computing Threat: BIP 360 (Hunter Beast) — MIT Bitcoin Expo 2025",
                "duration": 1800
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
                "id": "twjTUa8njRo",
                "duration": 456,
                "title": "Run with Bitcoin - Paco De La India"
            },
            {
                "id": "mkDpE6SjjCQ",
                "title": "Did the IMF Just KILL Bitcoin in El Salvador? (Joe Nakamoto)",
                "duration": 900
            },
            {
                "id": "BdaiLtKNFQA",
                "duration": 1800,
                "title": "The plan 40 Countries in 400 Days - Paco"
            },
            {
                "id": "7A56oZAs7ZQ",
                "title": "El Salvador Bitcoin Adoption Documentary",
                "duration": 1800
            },
            {
                "id": "Ve6oLiWO0Mg",
                "title": "Traveling the World on Bitcoin — Airbtc",
                "duration": 900
            },
            {
                "id": "LRSQSkiil0M",
                "title": "Inside the Bitcoin Revolution in Africa — Joe Nakamoto",
                "duration": 1200
            },
            {
                "id": "vlf4swtTBSM",
                "title": "Isla Mujeres is Becoming a Bitcoin Paradise! (Here's How)",
                "duration": 900
            },
            {
                "id": "mB0U_22_q4s",
                "duration": 36000,
                "title": "10 Hours of Bitcoin Travel & Adoption Stories"
            },
            {
                "id": "7d7yJktKr2U",
                "title": "Is El Salvador Bending the Knee to the IMF? — John Dennehy (Joe Nakamoto #15)",
                "duration": 1800
            },
            {
                "id": "5hMZkxQtstU",
                "duration": 3600,
                "title": "167. Run with Bitcoin with Paco de la India"
            },
            {
                "id": "0Ceey82hFTY",
                "title": "Booking Travel with Bitcoin — Travala",
                "duration": 600
            },
            {
                "id": "sIR0V6VKXLg",
                "title": "How One Woman is Building a Bitcoin Economy From Scratch in Mexico — Isabella Santos (BTC Isla)",
                "duration": 1200
            },
            {
                "id": "zgk-1pSMsZA",
                "title": "WTF the IMF, Tether and Bitcoin in El Salvador — Mike Peterson (Joe Nakamoto #13)",
                "duration": 1800
            },
            {
                "id": "ic_4-EFJogY",
                "title": "From Accenture to Bitcoin Maximalist — Alexandre Laizet",
                "duration": 503
            },
            {
                "id": "e0EPQg20SaQ",
                "title": "What 1792 Days in Bitcoin Taught Me — Get Based TV",
                "duration": 540
            },
            {
                "id": "LXB0d_3WntM",
                "title": "Bitcoin is Ready to Replace the Broken USD — Isabella Santos (BTC Isla)",
                "duration": 900
            },
            {
                "id": "TauW_pLnstw",
                "title": "The Bitcoin Paradise You Have Never Heard Of — Joe Nakamoto",
                "duration": 900
            },
            {
                "id": "rudY3-9X7gU",
                "title": "I'm Back From El Salvador (Joe Nakamoto)",
                "duration": 600
            },
            {
                "id": "emS6_vlQKa4",
                "title": "Everyday Bitcoin #3 — Isa Santos (BTC Isla, Get Based)",
                "duration": 1800
            },
            {
                "id": "WoN0SVY73zo",
                "title": "You Can Live on Bitcoin in Lugano — Joe Nakamoto",
                "duration": 1500
            },
            {
                "id": "R8xZd8v7b50",
                "title": "Bitcoin Beach: El Salvador's Bitcoin Economy",
                "duration": 1500
            },
            {
                "id": "4Bmni2lHYo8",
                "title": "Isabella Santos on Bitcoin Community Building",
                "duration": 1800
            },
            {
                "id": "DfDWubdqU5I",
                "title": "I Begged Strangers for Bitcoin in Madeira — Joe Nakamoto",
                "duration": 900
            },
            {
                "id": "PHYCAE2n55M",
                "title": "Isabella Santos on Bitcoin Media, Freedom & Building a Circular Economy",
                "duration": 3600
            },
            {
                "id": "kKSFh5Xxe3w",
                "title": "48 Hours in El Salvador Paying Only With Bitcoin",
                "duration": 1200
            },
            {
                "id": "FelWKV6wVJU",
                "title": "Living on Bitcoin in a Small Town — Joe Nakamoto",
                "duration": 1080
            },
            {
                "id": "QV-m5lNLxeM",
                "title": "Interview with Julian Figueroa From Get Based (Joe Nakamoto)",
                "duration": 1200
            },
            {
                "id": "pxvDunp9820",
                "title": "Bitcoin in Peru: How a Poisoned Town Survives — Joe Nakamoto",
                "duration": 1080
            },
            {
                "id": "mxfD7Pef4iU",
                "title": "Building a Bitcoin Circular Economy: The BTC Isla Story",
                "duration": 1200
            },
            {
                "id": "cs3nEVX9ZWA",
                "title": "Bitcoin Is Transforming Access to Electricity and Finance — Gladstein",
                "duration": 1800
            },
            {
                "id": "UPp0Xbk4bFo",
                "title": "The Truth Behind Cuba's Bitcoin Revolution (Joe Nakamoto)",
                "duration": 1200
            },
            {
                "id": "BnR_kB44hy0",
                "title": "Bitcoin Berlín: The Secret Bitcoin City of El Salvador — Joe Nakamoto",
                "duration": 1200
            },
            {
                "id": "mmOrwgouveI",
                "title": "The Secret Bitcoin City of El Salvador — Interview with Founders (Joe Nakamoto)",
                "duration": 1200
            },
            {
                "id": "gCi5jPHWVNE",
                "duration": 1200,
                "title": "Run with Bitcoin | Paco De la India Mumbai"
            },
            {
                "id": "78YidaGwELw",
                "title": "Building Bottom-Up Bitcoin Economies — Isabella Santos (BTC Isla)",
                "duration": 1800
            },
            {
                "id": "waQJEjiPWhg",
                "title": "Bitcoin Culture Around the World",
                "duration": 1200
            },
            {
                "id": "0hwC6BKJMpc",
                "title": "How Bitcoin is Revolutionizing Travel",
                "duration": 720
            },
            {
                "id": "eNOYnGtIm9E",
                "duration": 2700,
                "title": "Paco de la India | My Latin Life Podcast 210"
            },
            {
                "id": "UoVsYht7cIo",
                "title": "Isabella Santos — The Unique Voice of Education, Entertainment & Empowerment",
                "duration": 3600
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
                "id": "ng3dRbm2PHs",
                "title": "Funding Bitcoin Open Source — Bitcoin 2022 Conference",
                "duration": 1200
            },
            {
                "id": "JtzwTd9Ur5c",
                "duration": 900,
                "title": "Competing with Free | DerGigi"
            },
            {
                "id": "veIuDwQTunw",
                "title": "Olaoluwa Osuntokun Keynote — Open Source Stage (Bitcoin 2022)",
                "duration": 1800
            },
            {
                "id": "cmTrCoJKoig",
                "title": "Bitcoin Node From Scratch — Ubuntu + Bitcoin Knots + Solo Mining",
                "duration": 1800
            },
            {
                "id": "-O-BgOiV9AM",
                "title": "UMBREL TO START9 — Migrate Your Lightning Node",
                "duration": 900
            },
            {
                "id": "9FE4mTr_6EI",
                "duration": 1200,
                "title": "How to Set Up a Bitcoin Node (MyNode)"
            },
            {
                "id": "R_KTRRlZ-7c",
                "title": "Web5 Open to Build — Bitcoin 2023",
                "duration": 1800
            },
            {
                "id": "BNRvyrmBUhM",
                "title": "Become a Digital Sovereign with Start9",
                "duration": 1800
            },
            {
                "id": "JsJSsbp9g3M",
                "title": "Bitcoin Privacy is a Human Right",
                "duration": 1200
            },
            {
                "id": "wihMTwJ_wWs",
                "title": "Sovereign Computing with Matt Hill of Start9",
                "duration": 2400
            },
            {
                "id": "CG69c71aSLQ",
                "title": "Lightning Network Explained — Easy Guide",
                "duration": 600
            },
            {
                "id": "fsAUhFr1VXU",
                "title": "Bitcoin Privacy Made Simple: Wasabi Wallet Tutorial",
                "duration": 1860
            },
            {
                "id": "DKBJ3_3ZomU",
                "title": "Start9 Embassy — Bitcoin Node And Personal Server Tutorial",
                "duration": 1800
            },
            {
                "id": "OwJL0J_nPDE",
                "title": "Open Source Stage — Bitcoin 2022 Conference Day 3 (Full)",
                "duration": 28800
            },
            {
                "id": "6Tr4-DL1c1s",
                "duration": 1800,
                "title": "Freedom Money: Der Gigi l Episode 1"
            },
            {
                "id": "tLZc-NLmV20",
                "title": "Lightning Network Deep Dive with Laolu 'Roasbeef' Osuntokun",
                "duration": 2400
            },
            {
                "id": "Cjxc9ERz2mU",
                "title": "Lightning Privacy: Concerns and Solutions — Open Source Stage (Bitcoin 2022)",
                "duration": 1800
            },
            {
                "id": "TpwnoPUyumA",
                "title": "Phoenix Wallet Tutorial — Self-Custody Lightning",
                "duration": 1500
            },
            {
                "id": "j7R6CLnWI4M",
                "title": "Open Source Stage — Bitcoin 2022 Conference Day 1 (Full)",
                "duration": 28800
            },
            {
                "id": "52pSd3I1nac",
                "title": "Wasabi CoinJoin Tutorial — Self Custody Privacy",
                "duration": 5040
            },
            {
                "id": "kmfzATMxCj4",
                "title": "Start9 vs Umbrel — What's the Difference? CEO Matt Hill Explains",
                "duration": 1200
            },
            {
                "id": "BtbUGFHZTW8",
                "title": "Federated Chaumian Mints Overview — Bitcoin 2022 Conference",
                "duration": 1800
            },
            {
                "id": "NKl-c-TS3yM",
                "title": "Covenants — Open Source Stage (Bitcoin 2022)",
                "duration": 1800
            },
            {
                "id": "mdnkZunIphA",
                "title": "The Role of Bitcoin Core Maintainers & the Path Forward",
                "duration": 1800
            },
            {
                "id": "gOo7rnqXeik",
                "title": "Open Source Software In Bitcoin",
                "duration": 1200
            },
            {
                "id": "L0Yh6VP6vxU",
                "title": "Open Source Stage — Bitcoin 2022 Conference Day 2 (Full)",
                "duration": 28800
            },
            {
                "id": "_bQCkoe4fXU",
                "title": "Web5: The Future of the Bitcoin-Based Internet — Polycarp Nakamoto",
                "duration": 5400
            },
            {
                "id": "yKdK-7AtAMQ",
                "title": "Bitcoin Lightning Network — How It Actually Works",
                "duration": 1276
            },
            {
                "id": "QeCIVUH89KY",
                "title": "Switch to Bitcoin Knots on Start9 — Full Sovereignty",
                "duration": 900
            },
            {
                "id": "1XxG_qjY3EY",
                "title": "Home Bitcoin Solo Node Setup Guide (Umbrel)",
                "duration": 1200
            },
            {
                "id": "7FWKc8lM4Ek",
                "title": "Neutrino: The Privacy Preserving Bitcoin Light Client",
                "duration": 1200
            },
            {
                "id": "kL0Yc8ngzS0",
                "duration": 1200,
                "title": "Bitcoin Fixes Double Standards - Guest Gigi"
            },
            {
                "id": "U9hdav36WAo",
                "title": "How to Use Wasabi Wallet for Bitcoin CoinJoin",
                "duration": 600
            },
            {
                "id": "3FW7jNB9Qp0",
                "title": "The Future of Lightning Development — Open Source Stage (Bitcoin 2022)",
                "duration": 1800
            },
            {
                "id": "MGNvaJyZ25A",
                "title": "Lightning Network: Everything You Need To Know",
                "duration": 900
            },
            {
                "id": "n3Md7m4UQSQ",
                "title": "Preventing Attacks On Bitcoin — Open Source Stage (Bitcoin 2022)",
                "duration": 1800
            },
            {
                "id": "KNaOeLlD6NA",
                "title": "Build a Bitcoin Node on Raspberry Pi with Umbrel",
                "duration": 1200
            },
            {
                "id": "9JKpA7gqbW0",
                "title": "How To Run Your Own Bitcoin Node (And Fight Bitcoin Spam)",
                "duration": 1200
            },
            {
                "id": "a0ycGl4jN8w",
                "title": "Run Bitcoin & Lightning Node in 30 mins — Umbrel Home",
                "duration": 1800
            },
            {
                "id": "7fvG11BByD4",
                "title": "Running Bitcoin Knots On Start9",
                "duration": 900
            },
            {
                "id": "t4yuwtIhQIg",
                "title": "Start9: One-Click Bitcoin Node Setup Guide",
                "duration": 1500
            },
            {
                "id": "qFfhr4sApso",
                "title": "RUN A BITCOIN NODE — Simple Tutorial With Umbrel Home",
                "duration": 1500
            },
            {
                "id": "lhzooru_B-o",
                "duration": 1200,
                "title": "Set Up a Bitcoin Node for just 00"
            },
            {
                "id": "TASQj1hacuI",
                "title": "Bitcoin Privacy — Alex Gladstein",
                "duration": 2400
            },
            {
                "id": "XRxbrfbeThg",
                "duration": 5910,
                "title": "Gigi on Internet Business Models & Freedom"
            },
            {
                "id": "ekRzqy7D1wk",
                "duration": 3600,
                "title": "Cybersecurity Secrets for Protecting Bitcoin"
            },
            {
                "id": "Ld2s9MyMKMU",
                "duration": 600,
                "title": "Fastest way to build a Bitcoin Node in 2024"
            },
            {
                "id": "ubj5wpsmqN8",
                "title": "Bitcoin Full Node Security — 11 Tips To Keep Your Node Safe",
                "duration": 1200
            },
            {
                "id": "gLCyRFZOdGQ",
                "title": "How to Run a Bitcoin Lightning Node",
                "duration": 1800
            },
            {
                "id": "cDYQ6A69-D4",
                "title": "Enhance Your Bitcoin Journey with Start9's Server Pure Upgrade",
                "duration": 900
            },
            {
                "id": "ZZKoSmQu30Q",
                "title": "Best Bitcoin Hardware Wallets Compared — BTC Sessions",
                "duration": 3621
            },
            {
                "id": "nRoAyZG2taE",
                "title": "Switch from Bitcoin Core to Knots (Windows, Mac, Start9, Umbrel)",
                "duration": 1200
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
                "id": "oksraL7wN6Q",
                "title": "God Bless Bitcoin — HD Version",
                "duration": 5352
            },
            {
                "id": "QpbTljF0vY8",
                "duration": 2400,
                "title": "The History of Bitcoin Mining - Doc"
            },
            {
                "id": "OH-xRaHdqy4",
                "title": "Japan Bitcoin Documentary — Why One Tokyo Company Is Changing Finance",
                "duration": 1800
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
                "id": "gQ8XKns2ipc",
                "duration": 3120,
                "title": "The Satoshi Mystery: Origins of Bitcoin"
            },
            {
                "id": "oEgPTIN5hVE",
                "title": "How Bitcoin Started: The Untold Story of Satoshi (Full Documentary)",
                "duration": 3600
            },
            {
                "id": "GZI0qo3diUo",
                "title": "Unlocking Crypto — The Bitcoin Field Guide",
                "duration": 6500
            },
            {
                "id": "jsccmbOT6FU",
                "title": "Biggest Bitcoin Holders 2024",
                "duration": 900
            },
            {
                "id": "m7_WDzPyoqU",
                "title": "I Live 500 Feet From a Bitcoin Mine — Investigative Doc",
                "duration": 1260
            },
            {
                "id": "F5AiHEzu-uc",
                "title": "Who is Satoshi Nakamoto? The True Story of Bitcoin's Creator",
                "duration": 1200
            },
            {
                "id": "EcYnz29l8_0",
                "title": "Who ACTUALLY Created Bitcoin",
                "duration": 1200
            },
            {
                "id": "S70MSDaLAKw",
                "title": "Why Bitcoin's Creator Disappeared Forever",
                "duration": 1200
            },
            {
                "id": "Bze53qwHS8o",
                "title": "Mystery Founder of Bitcoin: Uncovering Satoshi Nakamoto — CNBC",
                "duration": 1800
            },
            {
                "id": "4_tAOuMVFd0",
                "title": "Digital Gold — Full Documentary",
                "duration": 5400
            },
            {
                "id": "FwWU1W7IGbY",
                "title": "Seeking Satoshi — The Mystery Bitcoin Creator (Part 1)",
                "duration": 1800
            },
            {
                "id": "9cb94OuCR9U",
                "title": "The Alleged CIA Connection to Bitcoin's Mysterious Origin",
                "duration": 1800
            },
            {
                "id": "3XEuqixD2Zg",
                "title": "God Bless Bitcoin — Full Documentary",
                "duration": 5352
            },
            {
                "id": "XzSFu7aMCu8",
                "title": "Truth About Satoshi Nakamoto — Complete Documentary",
                "duration": 2400
            },
            {
                "id": "o-c_j2tgxDU",
                "title": "What's REALLY Wrong with HBO's Bitcoin Documentary",
                "duration": 1200
            },
            {
                "id": "_Kav2K1DVWo",
                "title": "The Most Elusive Identity On The Internet (ft. Nexpo)",
                "duration": 2400
            },
            {
                "id": "Fx0OcKcLQ0A",
                "title": "Bitcoin's Creator Unveiled? Theories about Satoshi Nakamoto",
                "duration": 1200
            },
            {
                "id": "QTyzyP2Afys",
                "title": "Cryptocurrencies — The Future of Money? (DW Documentary)",
                "duration": 2700
            },
            {
                "id": "iVym9wtopqs",
                "title": "Banking on Bitcoin — Full Documentary",
                "duration": 5400
            },
            {
                "id": "8Z4hGvUET8I",
                "title": "Bitcoin: Beyond The Bubble",
                "duration": 4800
            },
            {
                "id": "Yh1dOmQJoWQ",
                "duration": 5820,
                "title": "The Rise and Rise of Bitcoin (FULL)"
            },
            {
                "id": "mgmVEtSgu3o",
                "title": "Bitcoin FUD — Full Documentary",
                "duration": 3600
            },
            {
                "id": "M1JKLXxFDZc",
                "title": "Unconditional Advice for the Next Decade — Saifedean Ammous",
                "duration": 1282
            },
            {
                "id": "iqVuthH57wY",
                "duration": 1800,
                "title": "The Evolution of Bitcoin Mining!"
            },
            {
                "id": "KjMQvN7Fajs",
                "title": "Who Created Bitcoin? The Mystery of Satoshi Nakamoto",
                "duration": 1500
            },
            {
                "id": "DGNhX8nz7Eg",
                "title": "Seeking Satoshi — The Mystery Bitcoin Creator (Part 2)",
                "duration": 1800
            },
            {
                "id": "4_4lFX8t3I8",
                "duration": 3600,
                "title": "Evolution of Cryptocurrency: 1983–2100"
            },
            {
                "id": "IFVrVI4rZHM",
                "title": "What Happened To Bitcoin's Founder?",
                "duration": 900
            },
            {
                "id": "ZKwqNgG-Sv4",
                "title": "Bitcoin: The End of Money As We Know It",
                "duration": 5020
            },
            {
                "id": "gcwnpvODd-8",
                "duration": 120,
                "title": "The Rise and Rise of Bitcoin | Official Trailer"
            },
            {
                "id": "tdxY61IJ24E",
                "title": "Bitcoin: Who is Satoshi Nakamoto? — An Investigation",
                "duration": 2400
            },
            {
                "id": "iSF0KGsFuI8",
                "duration": 180,
                "title": "Money Electric: The Bitcoin Mystery | HBO Trailer"
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
                "id": "7LcxJzUrGd8",
                "title": "Saifedean Ammous — Principles of Economics, Bitcoin Standard & Fiat Standard",
                "duration": 7200
            },
            {
                "id": "soGXgiGoMRU",
                "duration": 3960,
                "title": "Broken Money Thesis Presentation - Lyn Alden"
            },
            {
                "id": "Ai5z2T4WhWg",
                "title": "Why Bitcoin Matters — Economical, Ethical And Technological Perspective",
                "duration": 1800
            },
            {
                "id": "V2r0EaJQwLA",
                "title": "Lyn Alden: Bitcoin Long-Term Bull Case — Coin Stories",
                "duration": 2400
            },
            {
                "id": "7tQIGuCyOHQ",
                "title": "Jeff Booth Masterclass: The Price of Tomorrow & Truth About Inflation",
                "duration": 5400
            },
            {
                "id": "NNlxZZ6f57Q",
                "title": "Jeff Booth: Why Bitcoin Frees Us From a Broken System",
                "duration": 1800
            },
            {
                "id": "dlCbXoQokx0",
                "title": "Governments Will Accumulate Bitcoin — Mike Alfred on Coin Stories",
                "duration": 1800
            },
            {
                "id": "bs_pYdK8CU8",
                "duration": 2400,
                "title": "Lyn Alden: Why Our Financial System Fails"
            },
            {
                "id": "jk_HWmmwiAs",
                "duration": 1800,
                "title": "How Money & Banking Work - Lyn Alden"
            },
            {
                "id": "VssN8B0NWqY",
                "title": "The Fiat Standard Lecture 5: Universal Debt Slavery — Saifedean",
                "duration": 3600
            },
            {
                "id": "Ux-iV_9KAxk",
                "title": "Jeff Booth: Why Most People Will Get Wiped Out in the Transition",
                "duration": 1800
            },
            {
                "id": "dIqs9hGNU9A",
                "duration": 3600,
                "title": "Inflation & the Collapse of Civilization"
            },
            {
                "id": "lmfx960EQkY",
                "title": "Mike Maloney — The Best Video Series Ever Made About Money",
                "duration": 900
            },
            {
                "id": "_nSF9yZWalA",
                "duration": 3600,
                "title": "Principles of Economics Lecture 10: Money"
            },
            {
                "id": "HZx7t15d96M",
                "title": "Jeff Booth Explains Why Everything Is Getting More Expensive",
                "duration": 900
            },
            {
                "id": "k3NN_NZOdhY",
                "duration": 3060,
                "title": "Lyn Alden Content: Broken Money Thesis"
            },
            {
                "id": "pZvy0JRz9GE",
                "title": "Saifedean: Bitcoin & Tether — Las Vegas Keynote",
                "duration": 2576
            },
            {
                "id": "XLxGM47GdBU",
                "title": "The Fiat Standard with Dr. Saifedean Ammous",
                "duration": 3600
            },
            {
                "id": "drs6Q_OX0HE",
                "title": "Austrian Economics Intro — The Bitcoin Way",
                "duration": 3000
            },
            {
                "id": "eBTHI27B5rY",
                "title": "Bitcoin & The Return To Prosperity Through Deflation — Jeff Booth",
                "duration": 3600
            },
            {
                "id": "iFDe5kUUyT0",
                "title": "The Biggest Scam In History Of Mankind — Hidden Secrets of Money Ep 4",
                "duration": 1800
            },
            {
                "id": "Z71sOLsZpkI",
                "title": "Bitcoin Isn't Worth $65K, Your Dollars Are Worth Nothing — Jeff Booth",
                "duration": 600
            },
            {
                "id": "TLhbc3moELQ",
                "duration": 3600,
                "title": "The Gold Standard: Chapters 1-4"
            },
            {
                "id": "qawzs0QSzbI",
                "title": "Everything You've Ever Been Told About Money Is a Lie — Jeff Booth",
                "duration": 1800
            },
            {
                "id": "Ih0e8AXT_-s",
                "duration": 1200,
                "title": "Broken Money | Oslo Freedom Forum"
            },
            {
                "id": "lB3mQImM-5Y",
                "title": "The Fiat Standard by Saifedean Ammous (Full Presentation)",
                "duration": 3600
            },
            {
                "id": "G2vAm2hfW9U",
                "title": "Why Deflation is the Key to Abundance — Jeff Booth",
                "duration": 1800
            },
            {
                "id": "N41OC2sazbw",
                "title": "Jeff Booth on Bitcoin, AI, and Why Deflation Is Coming",
                "duration": 1800
            },
            {
                "id": "hdtY_iMeVEg",
                "title": "Bitcoin Will Hit $100 Trillion Market — Saifedean Ammous",
                "duration": 123
            },
            {
                "id": "FXvQcuIb5rU",
                "title": "The Immaculate Conception: Bitcoin vs Fiat Standard — Saifedean (EP 203)",
                "duration": 5400
            },
            {
                "id": "yDpMGUZZC4c",
                "title": "Bitcoin Is the Internet of Money — David Marcus on Coin Stories",
                "duration": 1800
            },
            {
                "id": "fOpnpECKaY8",
                "title": "Bitcoin, Austrian Economics & Future of Money — Seb Bunney",
                "duration": 4200
            },
            {
                "id": "TmV4Ns_ngSM",
                "duration": 3600,
                "title": "The Economics of Bitcoin - Saifedean"
            },
            {
                "id": "DKaZ-h-Wwhg",
                "title": "Bitcoin & Austrian Economics — Peter St. Onge",
                "duration": 3600
            },
            {
                "id": "PQ2wj8dnpqo",
                "duration": 3600,
                "title": "What is money? | Ammous & Fridman"
            },
            {
                "id": "6RsPt2bhi1o",
                "title": "Jeff Booth: Bitcoin Crashed 30% — Why I Feel Incredible",
                "duration": 1200
            },
            {
                "id": "zr4eD3g5uQE",
                "title": "You Will Never Look At Bitcoin The Same Way Again — Jeff Booth",
                "duration": 1200
            },
            {
                "id": "t7rYIkl6lIQ",
                "title": "The Fiat Standard: Lecture 1 — Saifedean Ammous",
                "duration": 5400
            },
            {
                "id": "gp4U5aH_T6A",
                "title": "Bitcoin, Anarchy & Austrian Economics — Lex Fridman & Saifedean",
                "duration": 10800
            },
            {
                "id": "AdaHyUmRvCU",
                "title": "Austrian Economics & Monetary Policy of Bitcoin",
                "duration": 1800
            },
            {
                "id": "8rYl8wEotZk",
                "title": "Strategy CEO on Bitcoin Yields & Adoption — Coin Stories",
                "duration": 2400
            },
            {
                "id": "GbLndO2XfuI",
                "title": "Where Does Money Come From — Hidden Secrets Of Money Ep 5",
                "duration": 1500
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
                "id": "i72_p2hdtnw",
                "title": "The HRF's Fight for Freedom: Tools and Challenges for Activists — Gladstein",
                "duration": 1800
            },
            {
                "id": "n5K1lEDv8aM",
                "title": "Afghan Women Using Bitcoin Under Taliban — Gladstein",
                "duration": 1500
            },
            {
                "id": "H-fQ7i8q5C8",
                "title": "Edward Snowden On Bitcoin",
                "duration": 600
            },
            {
                "id": "8Aofh-rx_l8",
                "title": "Bitcoin's Censorship Resistance Makes It Superior — Breedlove",
                "duration": 1500
            },
            {
                "id": "d5_cYWLpDs8",
                "title": "A Brief Look at Bitcoin Maximalism — Guy Swann",
                "duration": 1800
            },
            {
                "id": "GNzyaxizrNo",
                "title": "This Video Is For Ross Ulbricht — Get Based TV",
                "duration": 900
            },
            {
                "id": "IBY8SdA3W4Y",
                "title": "Bitcoin for Generational Wealth & Freedom — Breedlove",
                "duration": 1500
            },
            {
                "id": "R7Z3IF5AgJI",
                "title": "Whitney Webb's Urgent Warning to the Bitcoin Community — Get Based TV",
                "duration": 1800
            },
            {
                "id": "Y5wgZ3rFayQ",
                "title": "Bitcoin is Monetary Free Speech",
                "duration": 1200
            },
            {
                "id": "r3f6liCAXzA",
                "title": "Alex Gladstein: Bitcoin, Freedom & Human Rights",
                "duration": 3600
            },
            {
                "id": "xLYYh4aPXAM",
                "title": "Bitcoin Is Protecting Human Rights — Alex Gladstein",
                "duration": 1800
            },
            {
                "id": "RNHi8Qj2KrY",
                "title": "Ethereum — How A Lie Became Worth Billions — Get Based TV",
                "duration": 1200
            },
            {
                "id": "PesTO9MRqJo",
                "duration": 2400,
                "title": "Bitcoin and Time with Gigi"
            },
            {
                "id": "ZYN4X_l1ZXg",
                "title": "Financial Freedom and Bitcoin — HRF",
                "duration": 1800
            },
            {
                "id": "fSgsYDD2ob4",
                "title": "Alex Gladstein — The Role of Bitcoin for Human Rights",
                "duration": 1800
            },
            {
                "id": "lwbUwl8cNAI",
                "title": "Did The Bible Warn Us About Bitcoin? — Get Based TV",
                "duration": 1200
            },
            {
                "id": "mB0U_22_q4s",
                "duration": 1200,
                "title": "Living in El Salvador - First Hand Report"
            },
            {
                "id": "BoHNkX4OWQA",
                "title": "Jack Mallers on Bitcoin for El Salvador",
                "duration": 1200
            },
            {
                "id": "lfPZteWuH3k",
                "duration": 900,
                "title": "Crypto-Friendly Countries Interview"
            },
            {
                "id": "zV_A2yMZl0w",
                "title": "Alex Gladstein: Bitcoin Privacy & Freedom — Bitcoin Magazine",
                "duration": 1800
            },
            {
                "id": "oDaTIFKe3k4",
                "duration": 900,
                "title": "4 Best Countries for Crypto Millionaires"
            },
            {
                "id": "Z_p70BzkMAs",
                "title": "Bitcoin Protects Human Rights — Gladstein & Balaji",
                "duration": 3600
            },
            {
                "id": "iWpeSs4yWZ8",
                "title": "THESE CELEBRITIES Might Be Arrested for Promoting Cryptocurrency? — Get Based TV",
                "duration": 900
            },
            {
                "id": "KY72n6UFg1s",
                "duration": 900,
                "title": "Tax-Friendly Countries for Investors"
            },
            {
                "id": "kUiokNq5N1g",
                "title": "Snowden: CBDCs Are 'Cryptofascist Currency' — A Perversion of Crypto",
                "duration": 600
            },
            {
                "id": "dKDnkf6c250",
                "title": "Why Sell Your House for Bitcoin? — Breedlove Defense",
                "duration": 1200
            },
            {
                "id": "1jdFBnoNuOU",
                "title": "Debt. Greed. Inflation. The Bible Saw It Coming. — Get Based TV",
                "duration": 1200
            },
            {
                "id": "AcWcusXqClo",
                "title": "What Edward Snowden Just Said About Bitcoin",
                "duration": 600
            },
            {
                "id": "A-QpLdoDF14",
                "title": "Financial Freedom Against Tyranny",
                "duration": 1200
            },
            {
                "id": "s2bVOVdSrN0",
                "title": "Digital IDs Just Went Live — Say Goodbye To Your Privacy & Money",
                "duration": 1200
            },
            {
                "id": "9O1u-NyQpI0",
                "title": "Why Financial Freedom Matters — Alex Gladstein",
                "duration": 1200
            },
            {
                "id": "TASQj1hacuI",
                "title": "Bitcoin as Freedom Money — Wyoming Symposium",
                "duration": 2400
            },
            {
                "id": "LMeNe1tBsr4",
                "title": "Oslo Freedom Forum 2024 — Financial Freedom Track Full Livestream",
                "duration": 14400
            },
            {
                "id": "OPd9NcyIuy0",
                "title": "Edward Snowden: The Danger of CBDCs",
                "duration": 600
            },
            {
                "id": "ril70QIDz24",
                "title": "Bitcoin Is the Embodiment of Human Rights — Anita Posch",
                "duration": 1200
            },
            {
                "id": "p8vLlp67UnA",
                "duration": 1800,
                "title": "Why I Moved to Dubai - Nomad Capitalist"
            },
            {
                "id": "6QiDB-RwGGw",
                "duration": 1200,
                "title": "Best Countries for Digital Nomads"
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
                "id": "Dv8q_gOUcJo",
                "title": "Becoming a Sovereign Individual via Food & the Beef Initiative — Texas Slim",
                "duration": 3600
            },
            {
                "id": "iW419hInhHw",
                "title": "The Beef Initiative with Texas Slim (What is Money)",
                "duration": 5400
            },
            {
                "id": "6kEyLJMILU0",
                "title": "Texas Slim: Saving The American Rancher — The Crisis In The Beef Industry",
                "duration": 3600
            },
            {
                "id": "KcV9Dhz9gHY",
                "title": "Rebuilding El Salvador's Cattle Industry with Tom Taber",
                "duration": 1800
            },
            {
                "id": "i8Nq2pcNp60",
                "title": "Texas Slim & Jake Wolki: Beef Initiative & Industrial Food Complex",
                "duration": 3600
            },
            {
                "id": "iAEgMhq_FJs",
                "title": "Starting & Scaling a Successful Regenerative Ranching Business",
                "duration": 1800
            },
            {
                "id": "urKG9oi0krc",
                "duration": 600,
                "title": "Exit The Matrix - Buy BTC Eat Meat"
            },
            {
                "id": "TWkKPijaDyQ",
                "duration": 1200,
                "title": "Proof of Work Ep2: Fitness and Bitcoin"
            },
            {
                "id": "JTDVwPdvu3E",
                "title": "Why We Need Our Farmers, and Our Farmers Need US",
                "duration": 1800
            },
            {
                "id": "TBd8GGKgRWo",
                "title": "Carnivore Legends Explain the Importance of Local Farms and Red Meat",
                "duration": 1800
            },
            {
                "id": "cthDKq4SEqk",
                "title": "From Unhealth to Health — The Meat Mafia",
                "duration": 3600
            },
            {
                "id": "O3jeBF7S9ss",
                "duration": 1800,
                "title": "Treadmill, Chat, and Bitcoin"
            },
            {
                "id": "xn9WtVYy1gU",
                "title": "Bitcoin Will FIX Our Food System — Here's How! w/ Texas Slim",
                "duration": 3600
            },
            {
                "id": "W4OQaqqFKj0",
                "duration": 1200,
                "title": "Proof of Work Ep1: Fitness and Bitcoin"
            },
            {
                "id": "Pvmp0L5cbl8",
                "duration": 60,
                "title": "Iron Sharpens Iron - Proof of Work Fitness"
            },
            {
                "id": "ohR7EIby7yY",
                "title": "Texas Slim: Truth Behind The War on Beef",
                "duration": 1800
            },
            {
                "id": "CT8yuKUQ_No",
                "title": "Low Time Preference Aging — P.D. Mangan",
                "duration": 3600
            },
            {
                "id": "FJB7e8PP0wU",
                "duration": 300,
                "title": "Proof Of Work(out) - July 2022"
            },
            {
                "id": "hL54mn7vW8w",
                "title": "Surf, Eat Meat, Repeat — Bitcoin Lifestyle",
                "duration": 1200
            },
            {
                "id": "vpEq89vPNHc",
                "title": "Jeff Booth on What if Everything We Know About Free Markets is Wrong?",
                "duration": 3600
            },
            {
                "id": "lhHKljqRa-M",
                "title": "Low Time Preference Lifestyle — Bitcoin Way",
                "duration": 1800
            },
            {
                "id": "mVMU1AFiSV0",
                "title": "Low Time Preference, Bitcoin and Health",
                "duration": 3600
            },
            {
                "id": "rwP_ggwOqTg",
                "title": "EMBRACE Deflation With Bitcoin! Guest Jeff Booth",
                "duration": 3600
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
                "id": "rQZLFNkh0W8",
                "title": "Dr. Anthony Chaffee on The Future Of Farming",
                "duration": 1800
            },
            {
                "id": "c9D8p1kG0Cc",
                "title": "Bitcoin and Health with Jeff Booth",
                "duration": 2400
            },
            {
                "id": "KfNkDQ-NI9U",
                "duration": 3600,
                "title": "Shawn Baker, the Carnivore MD"
            },
            {
                "id": "BQCOJlFXvpU",
                "title": "The Carnivore Diet & Bitcoin — Dr. Shawn Baker",
                "duration": 6400
            },
            {
                "id": "jn8uc92Oymo",
                "title": "Bitcoin Is Transforming Health & Energy Access Globally",
                "duration": 1500
            },
            {
                "id": "pm7Ff5viURM",
                "title": "Jeff Booth Reveals How Much Bitcoin You Need!",
                "duration": 600
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
                "id": "3n_WnVPhRTo",
                "duration": 1800,
                "title": "The Satoshi Nakamoto Enigma"
            },
            {
                "id": "0r6zMdHcpW0",
                "title": "Was Bitcoin a CIA Project? The Hidden Origins of Satoshi",
                "duration": 3600
            },
            {
                "id": "phtHSjSrsJ8",
                "title": "What is Bitcoin's UNTOLD History?",
                "duration": 1200
            },
            {
                "id": "tWU3O3X5kKE",
                "duration": 600,
                "title": "The Story behind Bitcoin Pizza Day"
            },
            {
                "id": "b1ruW89S4PM",
                "title": "Satoshi Nakamoto: The Mysterious Genius Behind Bitcoin",
                "duration": 1800
            },
            {
                "id": "LSvOFKf9okk",
                "title": "Secret Monetary System Explained — Mike Maloney",
                "duration": 1800
            },
            {
                "id": "vjGhiac85h4",
                "title": "The History of Crypto Goes Further Back Than You Think",
                "duration": 1800
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
                "id": "h3nlVsy81wI",
                "duration": 3600,
                "title": "The Bitcoin Mystery Revealed! - Swan"
            },
            {
                "id": "NAg_rJ8mfVs",
                "title": "The Government Hates Him — The Ross Ulbricht Story",
                "duration": 1200
            },
            {
                "id": "wSh_KzcY_dA",
                "title": "60 Minutes: Stories About Cryptocurrency — CBS",
                "duration": 4000
            },
            {
                "id": "kyija0bPeIY",
                "title": "Behind Silk Road: How Ross Ulbricht Brought Black Market to the Web (Full Doc)",
                "duration": 5400
            },
            {
                "id": "fsfoqdqyykI",
                "title": "The Most Illegal Business In The World: Silk Road",
                "duration": 1800
            },
            {
                "id": "dYFMoK1nDmc",
                "title": "60 Minutes: Bitcoin Beach El Salvador — CBS",
                "duration": 780
            },
            {
                "id": "Mcz_4MvPlOE",
                "duration": 3600,
                "title": "Cypherpunks & Bitcoin: End of History"
            },
            {
                "id": "LjNMgeqUgks",
                "title": "The Man Who Spent Millions of Bitcoin on Pizza — 60 Minutes",
                "duration": 42
            },
            {
                "id": "BoboO6QPGow",
                "title": "Satoshi Nakamoto Goes Public and Denies He's Bitcoin Founder",
                "duration": 300
            },
            {
                "id": "3Cr1efEBo_M",
                "title": "INSIDE SILK ROAD: The Billion-Dollar Dark Web Drug Empire",
                "duration": 1800
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
                "id": "dMSv4mgiy1o",
                "title": "How Bitcoin's Early Cypherpunks Paved the Way",
                "duration": 1500
            },
            {
                "id": "SlbyHzYZXjA",
                "title": "FBI Agent Explains Silk Road",
                "duration": 600
            },
            {
                "id": "8Z4hGvUET8I",
                "title": "Bitcoin: Beyond The Bubble — Origins",
                "duration": 4800
            },
            {
                "id": "iqVuthH57wY",
                "duration": 1800,
                "title": "The Evolution of Bitcoin Mining!"
            },
            {
                "id": "lFw-3wynj-o",
                "title": "Adam Back is Satoshi Nakamoto — Hoskinson & Lex Fridman",
                "duration": 600
            },
            {
                "id": "eoBmOf4GDyo",
                "duration": 1800,
                "title": "Arrivano i Cypherpunk - History"
            },
            {
                "id": "GpMP6Nh3FvU",
                "title": "The Dark Side Of The Silk Road",
                "duration": 1500
            },
            {
                "id": "Peih23WVK54",
                "title": "Dark Web King: From Student to Billionaire Drug Lord — Ross Ulbricht",
                "duration": 2400
            },
            {
                "id": "gQ8XKns2ipc",
                "duration": 3120,
                "title": "The Satoshi Mystery: Origins of Bitcoin"
            },
            {
                "id": "f-4Rs3Sqlhc",
                "title": "History of Bitcoin — Complete Timeline",
                "duration": 2400
            },
            {
                "id": "pbFEexyOwkw",
                "title": "Bitcoin History: From Zero to Hero",
                "duration": 1800
            },
            {
                "id": "ao9SdxPtuIE",
                "title": "Satoshi Nakamoto & The Origins of Bitcoin",
                "duration": 1500
            },
            {
                "id": "M7ZLNczMeS0",
                "title": "Deep Web: The Untold Story of Bitcoin and the Silk Road",
                "duration": 1800
            },
            {
                "id": "7RlaC9ZJNtA",
                "duration": 2400,
                "title": "Unmasking the Creator of Bitcoin"
            },
            {
                "id": "chcASJW1pMs",
                "title": "Satoshi Nakamoto — The Beginning of Bitcoin Documentary",
                "duration": 2400
            },
            {
                "id": "9npQ5f74Nr4",
                "title": "The Cypherpunks: Freedom, Privacy, and the Genesis of Bitcoin",
                "duration": 600
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
                "id": "3I81-P_lwvw",
                "title": "What is Inflation for Kids — Financial Education",
                "duration": 420
            },
            {
                "id": "EfKuZayeksI",
                "title": "Bitcoin for Kids — Simple Explanation",
                "duration": 420
            },
            {
                "id": "94I9L90h0_s",
                "title": "What is Cryptocurrency? — Kid-Friendly",
                "duration": 300
            },
            {
                "id": "vPMDpb9ho4s",
                "title": "Blockchain for Kids — Blockchain Explained for Beginners",
                "duration": 420
            },
            {
                "id": "9ymZlz2l53I",
                "title": "What is Bitcoin? For Kids and Teens",
                "duration": 360
            },
            {
                "id": "DQhF_4J2GKo",
                "title": "What is Cryptocurrency? Learn with Jess — STEM Kids Clubhouse",
                "duration": 480
            },
            {
                "id": "FtaUelnAXrc",
                "title": "Tuttle Twins S1E6 — Full Episode (Regulation Station)",
                "duration": 1320
            },
            {
                "id": "qVGWCJJcDXM",
                "title": "60 Minutes Tuttle Twins — Wholesome Cartoon Compilation for Family",
                "duration": 3600
            },
            {
                "id": "xvo_m_r2ubg",
                "title": "What is Bitcoin? Simple Explanation for Teens & Beginners",
                "duration": 480
            },
            {
                "id": "gS05vIvAW9I",
                "title": "Dollars or Bitcoin? Which One is Better? — Economics Explained (Tuttle Twins)",
                "duration": 600
            },
            {
                "id": "lV9aSAIVYok",
                "title": "Kids Finance — Inflation Explained",
                "duration": 300
            },
            {
                "id": "hSZyUI6rbC8",
                "title": "A Bitcoin Bash & Corrupted Cash — Full Episode (Tuttle Twins)",
                "duration": 1320
            },
            {
                "id": "J7mMQ3ERNdg",
                "title": "Tuttle Twins S1E11 — Full Episode (No Free Lunch)",
                "duration": 1320
            },
            {
                "id": "9NZTMmVBfK4",
                "title": "What My Kids Think of Bitcoin",
                "duration": 300
            },
            {
                "id": "mwSAuNb44lU",
                "title": "How Money Works Explained in One Minute",
                "duration": 60
            },
            {
                "id": "bDcGUxS9DHw",
                "title": "Tuttle Twins S1E9 — Full Episode (Fate of the Future)",
                "duration": 1320
            },
            {
                "id": "Td32UyXW9HE",
                "title": "How to Teach a Kid About Bitcoin (and Money)",
                "duration": 1800
            },
            {
                "id": "fTTGALaRZoc",
                "title": "Banking Explained — Money and Credit",
                "duration": 360
            },
            {
                "id": "RqJOqyzOmjw",
                "title": "Understanding Inflation — The Basics Explained (It's a Money Thing)",
                "duration": 300
            },
            {
                "id": "qyCXpr-ZDhE",
                "title": "What are Taxes? Simple Explanation for Teens and Beginners",
                "duration": 420
            },
            {
                "id": "agUawDBjwv4",
                "title": "Investing In Crypto For Your Kids — Should You?",
                "duration": 600
            },
            {
                "id": "BL5vUVQvmX4",
                "title": "What is Bitcoin? Explained in 3 Minutes — Tuttle Twins",
                "duration": 180
            },
            {
                "id": "dAujdH8Iwcg",
                "title": "Bitcoin Explained for Kids & Beginners — Digital Money Made Easy",
                "duration": 360
            },
            {
                "id": "uRU4ifbGolg",
                "title": "Tuttle Twins S1E7 — Full Episode (The Miraculous Pencil)",
                "duration": 1320
            },
            {
                "id": "s4g1XFU8Gto",
                "title": "Bitcoin Explained and Made Simple",
                "duration": 360
            },
            {
                "id": "o-PNlhhVhZ8",
                "title": "Hyperinflation Explained in One Minute",
                "duration": 60
            },
            {
                "id": "nqdv6Ad9Nt4",
                "title": "What is Bitcoin? (for kids)",
                "duration": 300
            },
            {
                "id": "Z3xdGIyIV54",
                "title": "How to Explain Bitcoin to Children — Dad & Daughter",
                "duration": 480
            },
            {
                "id": "B-IpiKURs3I",
                "duration": 3600,
                "title": "1 Hour Tuttle Twins Compilation"
            },
            {
                "id": "t0ZAXwV1CI8",
                "title": "Cryptocurrency Explained For Kids",
                "duration": 360
            },
            {
                "id": "LuboVKBFnl0",
                "title": "When Money Is Controlled, Money Is Corrupted — Full Song (Tuttle Twins)",
                "duration": 180
            },
            {
                "id": "Kt-QIFlZTik",
                "title": "Tuttle Twins S1E1 Full Episode",
                "duration": 1320
            },
            {
                "id": "rT4ThQ55SD8",
                "title": "Who Invented Bitcoin? (for kids)",
                "duration": 300
            },
            {
                "id": "cv7SRW_kYLk",
                "title": "How to Teach Kids Where Money Comes From (5 Different Places)",
                "duration": 480
            },
            {
                "id": "jcu3hsaLO0Q",
                "title": "Tuttle Twins S1E12 — Full Episode (Season Finale)",
                "duration": 1320
            },
            {
                "id": "Z-qP41O-NxY",
                "title": "The Lesson on SOCIALISM School Didn't Teach You — Tuttle Twins Full Episode",
                "duration": 1320
            },
            {
                "id": "aRcXutXvfmM",
                "title": "Financial Literacy — Needs and Wants (Opportunity Costs)",
                "duration": 360
            },
            {
                "id": "0SDCdQcnKuQ",
                "title": "What Everyone Should Know About College — Tuttle Twins Full Episode",
                "duration": 1320
            },
            {
                "id": "aHVuaASswgA",
                "title": "The Truth About CBDCs (Central Bank Digital Currencies) — Economics Explained",
                "duration": 600
            },
            {
                "id": "GZ7y-yFdX9M",
                "title": "Who Invented Money? History of Money & Barter System — Dr Binocs Show",
                "duration": 600
            },
            {
                "id": "9CchpWy29es",
                "title": "Investing & Stocks — Cash Course (PragerU Kids)",
                "duration": 300
            },
            {
                "id": "DuR0KMBefj0",
                "title": "Tuttle Twins S2E2 — Don't Trash Success (Full Episode)",
                "duration": 1320
            },
            {
                "id": "zJHeIJGVCKI",
                "title": "How War Makes Millionaires?! — Economics Explained",
                "duration": 600
            },
            {
                "id": "XNu5ppFZbHo",
                "title": "What Gives a Dollar Bill Its Value? — TED-Ed",
                "duration": 240
            },
            {
                "id": "Y9RdoOBVmbI",
                "title": "Is School Failing You? — Albert Einstein (Tuttle Twins)",
                "duration": 1320
            },
            {
                "id": "tQ1_8M1K0tM",
                "title": "Cryptocurrency Explained to Kids — Twins",
                "duration": 360
            },
            {
                "id": "wgU-Xou0xYM",
                "title": "Tiny Economists Ep. 3 — What Is Money?",
                "duration": 300
            },
            {
                "id": "iy3n39Gnlpw",
                "title": "Tuttle Twins S1E5 — Full Episode (The Golden Rule)",
                "duration": 1320
            },
            {
                "id": "61G4YhJsSNo",
                "title": "What is BITCOIN — Bitcoin Explained to Kids, Teens and Adults",
                "duration": 480
            },
            {
                "id": "Bv9LCSMEgGQ",
                "title": "BITCOIN EXPLAINED FOR KIDS",
                "duration": 420
            },
            {
                "id": "_ekzsZZGfsk",
                "duration": 3600,
                "title": "First Kids Cartoon about Bitcoin!"
            },
            {
                "id": "3nwprNzztQE",
                "title": "Bitcoin Explained for Kids & Teens (Parents: Show This to Your Kids!)",
                "duration": 600
            },
            {
                "id": "qnyqQvIii0U",
                "title": "Cryptocurrency Explained for Kids & Beginners",
                "duration": 600
            },
            {
                "id": "Iyq4khMiM9A",
                "title": "Saving vs Investing for Kids — Types of Investments Explained!",
                "duration": 360
            },
            {
                "id": "ZxEqoaFT73c",
                "title": "Bitcoin Is The Evolution Of Money — My Kids Won't Know Coins!",
                "duration": 300
            },
            {
                "id": "auIOUn0ubDk",
                "title": "What is Inflation? Explained for Kids (The Invisible Money Nibbler!)",
                "duration": 300
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
                "id": "vyDtzx_PYNk",
                "title": "Bitcoin Lightning Wallets Compared",
                "duration": 900
            },
            {
                "id": "9UIOeoBEjmw",
                "title": "Lightning Network Explained",
                "duration": 480
            },
            {
                "id": "CG69c71aSLQ",
                "title": "Lightning Network Explained — Easy Guide",
                "duration": 600
            },
            {
                "id": "rrr_zPmEiME",
                "duration": 600,
                "title": "Bitcoins Lightning Network Explained"
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
                "id": "OQ2o5LUgOqE",
                "title": "Mutiny Wallet Tutorial — Bitcoin Lightning (self-custody)",
                "duration": 1200
            },
            {
                "id": "GKXQiDhRy34",
                "title": "How To Back Up A Bitcoin Wallet — Lightning Session",
                "duration": 600
            },
            {
                "id": "nd5fX2vHuDw",
                "title": "ALBY — Bitcoin Lightning Payments In Your Browser",
                "duration": 900
            },
            {
                "id": "4kBCEbCWf1s",
                "title": "Lightning Network in Practice — Real Payments",
                "duration": 900
            },
            {
                "id": "ldUwf_s44Zg",
                "title": "Bitcoin Wallets Explained — Lightning Session",
                "duration": 600
            },
            {
                "id": "c9hnntAwSYg",
                "title": "Bitcoin's Lightning Network Surprises Us All!",
                "duration": 600
            },
            {
                "id": "5SbpyInuIJk",
                "title": "MUUN Bitcoin Wallet — On Chain and Lightning Combined!",
                "duration": 900
            },
            {
                "id": "t_4b-y4T8bY",
                "title": "How To Use A Bitcoin Lightning Wallet: Breez — BTC Sessions",
                "duration": 900
            },
            {
                "id": "7QAmlcrZD2U",
                "title": "The Lightning Network Explained in Under 3 Minutes",
                "duration": 180
            },
            {
                "id": "vmafxrT8eCU",
                "title": "Getting Started with Lightning Wallets",
                "duration": 720
            },
            {
                "id": "gkZJ1P-D0c4",
                "title": "Paying at McDonald's with Bitcoin Lightning in Lugano",
                "duration": 120
            },
            {
                "id": "Pef22g53zsg",
                "title": "Why Lightning is the Future of Payments",
                "duration": 1500
            },
            {
                "id": "TpwnoPUyumA",
                "duration": 1500,
                "title": "Phoenix Wallet Setup & Tutorial"
            },
            {
                "id": "qug6tCHPXtw",
                "duration": 300,
                "title": "Bitfury Lightning Coffee Machine"
            },
            {
                "id": "to8XItlplac",
                "duration": 3600,
                "title": "Lightning Transactions & Protocol Deep Dive"
            },
            {
                "id": "JGOzIUG2Rwk",
                "title": "How To Get Your Bitcoin Onto The Lightning Network — BTC Sessions",
                "duration": 900
            },
            {
                "id": "sQPKdozYhQ8",
                "duration": 600,
                "title": "Beginners Guide to Coffee LN Payments"
            },
            {
                "id": "fympoUHx2b8",
                "title": "Creating A Custom Self-Custodial Bitcoin Lightning Address",
                "duration": 900
            },
            {
                "id": "AW-7XBrSqCI",
                "title": "Bitcoin Lightning Network Demo: Phoenix Wallet",
                "duration": 600
            },
            {
                "id": "yKdK-7AtAMQ",
                "title": "Lightning Network — How It Actually Works",
                "duration": 1276
            },
            {
                "id": "7VyUqRyYT9w",
                "title": "Best Lightning Network Wallet — Low BTC Transaction Fees",
                "duration": 900
            },
            {
                "id": "sXBwRO7ML7w",
                "title": "Wallet Of Satoshi — Simple Bitcoin Lightning Wallet",
                "duration": 600
            },
            {
                "id": "bVC4795helY",
                "duration": 300,
                "title": "Lightning payment in Malaysia Cafe"
            },
            {
                "id": "JpmkIvB7rDE",
                "title": "Send From Any Exchange Direct To A Lightning Wallet — BTC Sessions",
                "duration": 600
            },
            {
                "id": "FwjX6ija9iM",
                "title": "Simple Bitcoin Wallet Tutorial — BTC, Lightning and Hardware",
                "duration": 1200
            },
            {
                "id": "39KpscRXyXY",
                "duration": 300,
                "title": "Buying Coffee Using Bitcoin - LN"
            },
            {
                "id": "69QUHgHErx0",
                "title": "TOP Lightning Wallets in 2025 — How to Spend Bitcoin",
                "duration": 1200
            },
            {
                "id": "i4z-2v_0H1k",
                "title": "How Lightning Network Will Change Bitcoin",
                "duration": 1200
            },
            {
                "id": "x3Q9mEdelK4",
                "title": "Understanding Aqua Wallet — Bitcoin, Lightning, and Liquid",
                "duration": 900
            },
            {
                "id": "bDzbKH5dwys",
                "title": "Zeus Wallet Tutorial — Embedded Lightning Node",
                "duration": 1500
            },
            {
                "id": "iVPNk2ZZ63w",
                "title": "Lightning Accounts With Blue Wallet and Umbrel",
                "duration": 900
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
                "id": "exRCX38tHks",
                "title": "Giving Away Crypto or Cash! What Will The Public Take?! (Social Experiment)",
                "duration": 600
            },
            {
                "id": "Fvi6pdG_jZw",
                "title": "GigaChad Michael Saylor Best Moments — Bitcoin Song",
                "duration": 240
            },
            {
                "id": "3mA_U4tYS8s",
                "title": "Hank Finds Out About Crypto Crash",
                "duration": 180
            },
            {
                "id": "-weaa5SrVEU",
                "title": "Michael Saylor Needs Some Rest",
                "duration": 120
            },
            {
                "id": "H_HZkcUP_O0",
                "title": "Bitcoin: Explained to Different Age Groups",
                "duration": 300
            },
            {
                "id": "DBs-qkjMdXk",
                "title": "95-Year-Old Man Reacts to Bitcoin",
                "duration": 120
            },
            {
                "id": "UDu5LOf_E-w",
                "title": "Bitcoin Memes Compilation",
                "duration": 600
            },
            {
                "id": "Lzl5t1Sracc",
                "title": "Funny Bitcoin Video #3 — Classic Compilation",
                "duration": 300
            },
            {
                "id": "d6ham2mibiA",
                "title": "Bitcoin Street Reactions Compilation",
                "duration": 540
            },
            {
                "id": "aTqT5TDLtT8",
                "title": "Bitcoin History As Told By Memes",
                "duration": 600
            },
            {
                "id": "heA1fZzRAFs",
                "title": "Funniest Bitcoin Moments Compilation",
                "duration": 600
            },
            {
                "id": "0Y7qcaIkgMY",
                "title": "Appeasing Michael Saylor — Bitcoin Singularity",
                "duration": 180
            },
            {
                "id": "uql_VKemddY",
                "duration": 36000,
                "title": "Vibing with the Fed and Bitcoin 10 Hour Loop"
            },
            {
                "id": "UX1GIhOhkAE",
                "title": "Me Saying Bitcoin",
                "duration": 180
            },
            {
                "id": "AKvWwZJ6gfA",
                "title": "Sigma Chad Michael Saylor — It's Going Up Forever Laura",
                "duration": 120
            },
            {
                "id": "l-aVgXwnESM",
                "title": "When Bitcoin Encounters Fiat (No.2) — Crypto Memes",
                "duration": 120
            },
            {
                "id": "BgZO1ppaneg",
                "title": "Best Crypto TikToks Compilation",
                "duration": 540
            },
            {
                "id": "jZm1GZj6eEM",
                "title": "Asking People if They Have Invested in Cryptocurrencies",
                "duration": 300
            },
            {
                "id": "8EoxggHmWxY",
                "title": "How to Mine Bitcoins (Classic)",
                "duration": 240
            },
            {
                "id": "1RV2Fpqpe48",
                "title": "Michael Saylor in The Age of Revolution — Google Ngram Meme",
                "duration": 120
            },
            {
                "id": "EFDMum1vs7Q",
                "duration": 36000,
                "title": "Pump It Up (Bitcoin Maximalist) 10 Hour Loop"
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
                "id": "NMDABNK8j_Q",
                "title": "Funniest Crypto Memes — He Sold? Edition",
                "duration": 480
            },
            {
                "id": "61i2iDz7u04",
                "title": "BITCONNECT REMIX",
                "duration": 240
            },
            {
                "id": "mEqr-8-TKrA",
                "title": "30 People Turning Down FREE Bitcoin — Mike Still",
                "duration": 420
            },
            {
                "id": "BgHEOhciWcQ",
                "title": "What Happens If You Never Buy Bitcoin?",
                "duration": 300
            },
            {
                "id": "RM1NdTvvtvk",
                "title": "Bitcoin Comedy Compilation",
                "duration": 720
            },
            {
                "id": "hAxfwE9Oj2g",
                "title": "BIG BEAUTIFUL BITCOIN!",
                "duration": 120
            },
            {
                "id": "wIhTGB3wqV0",
                "title": "Michael Saylor Meme — NO SECOND BEST",
                "duration": 60
            },
            {
                "id": "E6mK2aZbuSo",
                "title": "Recovery of a Lost Bitcoin Wallet from 2010",
                "duration": 180
            },
            {
                "id": "EiZSozfvKMQ",
                "title": "Michael Saylor Lost His Mind — There Is No Second Best Meme",
                "duration": 120
            },
            {
                "id": "Ner16UBWdEg",
                "title": "Bitcoin Memes That Hit Different",
                "duration": 480
            },
            {
                "id": "aJIt3dUWEAs",
                "title": "Unleashing the Cyber Hornets: Michael Saylor on the Power of Bitcoin",
                "duration": 180
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
                "id": "jDDIyqHvRUY",
                "title": "Mining BITCOIN at Home is EASY — Bitaxe Gamma",
                "duration": 900
            },
            {
                "id": "rQFWgLQuGzo",
                "title": "VoskCoin Mining Farm Numbers",
                "duration": 900
            },
            {
                "id": "TVR0E6KVb-c",
                "title": "What is a Bitcoin Miner? Disassembling an S19 While Explaining",
                "duration": 1200
            },
            {
                "id": "iQiWQAtThns",
                "duration": 600,
                "title": "Marathon Digital Portfolio Overview"
            },
            {
                "id": "e4BtAMXuRKI",
                "title": "What is Bitcoin Mining? How to Earn from Cryptocurrency Mining",
                "duration": 600
            },
            {
                "id": "WbEn-fsAEqs",
                "title": "I Mined Bitcoin for 1 Year (Honest Results)",
                "duration": 1200
            },
            {
                "id": "lDafxxAgmUI",
                "duration": 900,
                "title": "MARA Granbury Facility Tour"
            },
            {
                "id": "33i1PdSJgwA",
                "title": "How Bitcoin Mining Actually Works, Simplified",
                "duration": 600
            },
            {
                "id": "UAhQoKhzzbA",
                "duration": 600,
                "title": "Marathon 200MW Mining Site Acquisition"
            },
            {
                "id": "DMfv8S8ffKA",
                "title": "Bitcoin Mining — Bloomberg Animated Explainer",
                "duration": 300
            },
            {
                "id": "cJo839Sg1ek",
                "title": "The 3 BEST Home Crypto Miners Under $500",
                "duration": 900
            },
            {
                "id": "JPanr1nsPA4",
                "duration": 600,
                "title": "Mining BTC in Paraguay via Hydro - MARA"
            },
            {
                "id": "C4Z5yoWfnAU",
                "title": "Is Bitcoin Mining At Home Still Worth It in 2025?",
                "duration": 1200
            },
            {
                "id": "hN0VH__AZSE",
                "title": "This Thing Earns $914 PER DAY?! Here's How",
                "duration": 900
            },
            {
                "id": "q7c00PE7khk",
                "title": "How To Set Up a Bitaxe To Mine Bitcoin (Step-by-Step)",
                "duration": 900
            },
            {
                "id": "O9mRlrC1z2Y",
                "title": "Fort Worth Becomes First US City to Mine Bitcoin",
                "duration": 300
            },
            {
                "id": "dm4PljluiYM",
                "title": "Best Bitcoin Solo Miner 2025 — Bitaxe, NerdQaxe, Avalon Compared",
                "duration": 1500
            },
            {
                "id": "Bjcn5OZwgcs",
                "title": "Is Bitcoin Mining Still Profitable?",
                "duration": 600
            },
            {
                "id": "BpN8fCkExtE",
                "title": "When Blackmailing A Drug Lord Goes Terribly Wrong (Silk Road Agent)",
                "duration": 1200
            },
            {
                "id": "5Y2fkldA-lQ",
                "duration": 1800,
                "title": "The Early Days of Bitcoin Mining"
            },
            {
                "id": "YsYk8vyv32w",
                "duration": 300,
                "title": "The History of Bitcoin Mining"
            },
            {
                "id": "F1ot1qS-VtQ",
                "title": "The POWERFUL $680 Home Bitcoin Miner — Nerd Octaxe",
                "duration": 1200
            },
            {
                "id": "ACAn_yL-Too",
                "title": "Bitcoin Mining — Inside a Real Facility",
                "duration": 720
            },
            {
                "id": "Gsswul2h5vE",
                "title": "This NEW Mini Home Bitcoin Miner Could Earn You 3.125 BTC!",
                "duration": 1200
            },
            {
                "id": "4HTtZhhXiAw",
                "title": "Bitcoin Mining Explained in 3 Minutes",
                "duration": 180
            },
            {
                "id": "CC8wQJuhP5g",
                "title": "Compass Mining Year in Review",
                "duration": 1800
            },
            {
                "id": "xxhPn52mdxA",
                "title": "This Solo Bitcoin Miner Found A Block! NerdQaxe++ Unboxing & Setup",
                "duration": 1200
            },
            {
                "id": "yxfvEK7Nj8s",
                "title": "Bitcoin Mining Explained in 10 Minutes",
                "duration": 600
            },
            {
                "id": "vOOh9CHUZQQ",
                "title": "5 Solo Mining Projects for Your Bitaxe or Avalon Nano",
                "duration": 1200
            },
            {
                "id": "xQ7HwJ-voME",
                "title": "The PERFECT Mini Home Bitcoin Miner on a Budget!",
                "duration": 900
            },
            {
                "id": "ENQQXeEv2gI",
                "title": "Why Should You Run a Bitaxe?",
                "duration": 900
            },
            {
                "id": "L67es0ydJjE",
                "title": "Bitaxe Solo Mining Difficulty Explained",
                "duration": 600
            },
            {
                "id": "FMR1LO1rNYA",
                "title": "Perfect BEGINNER Home Bitcoin Miner in 2026!",
                "duration": 900
            },
            {
                "id": "YGkLWGM8os4",
                "duration": 300,
                "title": "UAE Immersion Facility Ribbon Cutting"
            },
            {
                "id": "lHipE05v4jg",
                "title": "How Bitcoin Mining Works — Complete Guide",
                "duration": 1200
            },
            {
                "id": "El3y8AME8oA",
                "title": "How Bitcoin Mining Really Happens",
                "duration": 900
            },
            {
                "id": "t5S1Y6OopHo",
                "duration": 900,
                "title": "BEST Home Miners 2024 Guide"
            },
            {
                "id": "5Wp6lInPQv0",
                "title": "The Cruel Reality of Bitcoin Mining — VoskCoin",
                "duration": 1200
            },
            {
                "id": "Py3voZGT1To",
                "title": "Bitcoin Mining Explained Simply — Real ASIC Miner Running at Home",
                "duration": 900
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
                "id": "BRbVhsoPzmI",
                "title": "Crypto Weekly Rap Up (Bitcoin Rap) — Week 4",
                "duration": 240
            },
            {
                "id": "f-4Rs3Sqlhc",
                "title": "Bitcoin Anthem — Crypto Music",
                "duration": 210
            },
            {
                "id": "6ZKzapbQPZA",
                "title": "Banksters Paradise — A Bitcoin Song",
                "duration": 270
            },
            {
                "id": "nO6A4N9zjgE",
                "title": "Rich Men North of Richmond — Full Band Cover",
                "duration": 210
            },
            {
                "id": "W-Z_hlzZYBw",
                "title": "Jason Saulnier — Bitcoin We're in Love",
                "duration": 240
            },
            {
                "id": "UdbOaVdIUTM",
                "title": "The Bitcoin Song — Ohio Toast Ska Man",
                "duration": 210
            },
            {
                "id": "FCA9i6MUCK0",
                "title": "Bitcoin Beats Mix — Volume 1",
                "duration": 1800
            },
            {
                "id": "yp0diaVLPrQ",
                "title": "Mark Zuckerberg's Sister Sings to Crypto",
                "duration": 240
            },
            {
                "id": "vQkXrct78A4",
                "title": "Tileks — BITCOIN",
                "duration": 210
            },
            {
                "id": "6KNOqrjkNaE",
                "title": "Crypto Weekly Rap Up (Bitcoin Rap) — Week 2",
                "duration": 240
            },
            {
                "id": "c5wbgDLr-u0",
                "title": "Bitcoin Lofi Beats — Study & HODL",
                "duration": 3600
            },
            {
                "id": "AQwyOhLBsI4",
                "title": "Stacking Sats — Jack Mallers",
                "duration": 240
            },
            {
                "id": "e2cl0_jqu4I",
                "title": "Halvingbird (a Bitcoin Halving song)",
                "duration": 210
            },
            {
                "id": "s3UtbslfqS8",
                "title": "Gary Gensler, Isn't That True? — Bitcoin Heavy Metal",
                "duration": 240
            },
            {
                "id": "3lUUDwSSkWo",
                "title": "Bitcoin Miner's Daughter",
                "duration": 240
            },
            {
                "id": "RglKdIovlX0",
                "title": "BANK — Bitcoin Music Video",
                "duration": 210
            },
            {
                "id": "-Y13lkBvsQw",
                "title": "Ghost Town Remix (Orange Pill Edition)",
                "duration": 240
            },
            {
                "id": "EPQJHNXdJfM",
                "title": "Crypto — Takeoff feat. Rich The Kid",
                "duration": 180
            },
            {
                "id": "VpvwgDjQLGA",
                "title": "Bitcoin All The Way Up — Dollar Vigilante",
                "duration": 240
            },
            {
                "id": "6AfHKbpgsi4",
                "title": "Too Bit To Fail & Hanspanzer — FOMO",
                "duration": 240
            },
            {
                "id": "BifVGcvJpxc",
                "title": "WAGMI",
                "duration": 210
            },
            {
                "id": "J4pLMsk-nVA",
                "title": "SATS OVER EVERYTHING — Manlikekweks x Encorebeats",
                "duration": 210
            },
            {
                "id": "PL0yOu0dNwo",
                "title": "Mainframe — Proof of Freedom",
                "duration": 240
            },
            {
                "id": "9johJ8eyucQ",
                "title": "It's Math — Greg Foss & Pleb Music",
                "duration": 270
            },
            {
                "id": "lvw5XX6IQkc",
                "title": "Sell in May (Thunderstruck Crypto Parody)",
                "duration": 240
            },
            {
                "id": "9I9l8vlTvJE",
                "title": "Toxic Maximalist — The Orange Pill Jam Project",
                "duration": 270
            },
            {
                "id": "27BwXfrJxcs",
                "title": "Death to Fiat — The Skull of Satoshi (Bitcoin Heavy Metal)",
                "duration": 240
            },
            {
                "id": "-UyRTltUv7w",
                "title": "Genesis Block",
                "duration": 240
            },
            {
                "id": "UG7zLhEWanc",
                "title": "Remy: Bitcoin Billionaire",
                "duration": 210
            },
            {
                "id": "dgKlBQmGQ98",
                "title": "Most Toxic Bitcoin Maxi — Robbie P",
                "duration": 240
            },
            {
                "id": "pADgAmNzxek",
                "title": "We Are All Bitcoins",
                "duration": 240
            },
            {
                "id": "9EuH_ZGOlIs",
                "title": "Proof of Work: A Bitcoin Experience",
                "duration": 300
            },
            {
                "id": "_c9WOks2mvg",
                "title": "Pump It Higher",
                "duration": 210
            },
            {
                "id": "kdvTkddp1F0",
                "title": "Don't Get Zhou Tonged!!! — Zhou Tonged",
                "duration": 210
            },
            {
                "id": "bJKGdKqd3sc",
                "title": "The Hodler",
                "duration": 240
            },
            {
                "id": "AKqdUAhX3nA",
                "title": "Bitcoin Is Hope ft. Michael Saylor",
                "duration": 240
            },
            {
                "id": "iqbScnkmf0s",
                "title": "Elaine Diane Taylor — Bitcoin Barbarians",
                "duration": 300
            },
            {
                "id": "VT_aEKr0BVY",
                "title": "Bitcoin Song — 13inlet",
                "duration": 210
            },
            {
                "id": "7gfBP8kPzRA",
                "title": "The Bitcoin Song — Jay-Z Empire State of Mind Parody",
                "duration": 270
            },
            {
                "id": "htTL7C23684",
                "title": "Build The Chain",
                "duration": 210
            },
            {
                "id": "K2ku1A5Ox8U",
                "title": "Blame it on MT.GOX",
                "duration": 240
            },
            {
                "id": "CnTxBAeGfaQ",
                "title": "Diamond Hands & Laser Eyes — Robbie P",
                "duration": 240
            },
            {
                "id": "VMLakjlz6us",
                "title": "Ode to Satoshi — Roger 9000",
                "duration": 300
            },
            {
                "id": "KQ7rn3oi-Pc",
                "title": "Blockchain — Money Man",
                "duration": 195
            },
            {
                "id": "109WLnpYkqE",
                "title": "Vibing with the FED and Bitcoin",
                "duration": 210
            },
            {
                "id": "Otkg4Ftx6GI",
                "title": "The Bitcoin Song",
                "duration": 210
            },
            {
                "id": "mkKFR5sB44s",
                "title": "Pizza Day",
                "duration": 210
            },
            {
                "id": "Wtj1x9aT9Zk",
                "title": "Crypto Weekly Rap Up (Bitcoin Rap) — Week 1",
                "duration": 240
            },
            {
                "id": "_YvLh4pUB4Y",
                "title": "The Times They Are A-Changin' (Bitcoin version)",
                "duration": 240
            },
            {
                "id": "fG5PKg81mEQ",
                "title": "Fliponomics — Robbie P",
                "duration": 210
            },
            {
                "id": "_pv-uKXaBFc",
                "title": "Bitcoin's Better Than Gold",
                "duration": 240
            },
            {
                "id": "UjkYo7t15yk",
                "title": "Bitcoin (Official Video) — Shehbaaz",
                "duration": 240
            },
            {
                "id": "U5NGVH8HDaw",
                "title": "Bitcoin Boomdeyada!",
                "duration": 180
            },
            {
                "id": "RIsZyg8OXlI",
                "title": "10,000 Bitcoins — Laura Saggers",
                "duration": 240
            },
            {
                "id": "o5XBSF6w7I4",
                "title": "MusicSnake — Stack Sats (feat. Michael Saylor)",
                "duration": 240
            },
            {
                "id": "c21GLKrC2Gg",
                "title": "Bitcoin Only (feat. C. Scott Muzic) — Wonx316",
                "duration": 240
            },
            {
                "id": "_hQRxuYBx0w",
                "title": "Chuty — Bitcoin (Videoclip Oficial)",
                "duration": 210
            },
            {
                "id": "fZfg1Gtcg08",
                "title": "Bitcoin Baron — ytcracker",
                "duration": 270
            },
            {
                "id": "emcT185BXMQ",
                "title": "Carlos Matos — Take On Me (autotuned)",
                "duration": 210
            },
            {
                "id": "gSxKJJ9k3lA",
                "title": "The Ultimate Crypto Anthem — Betawi CryptoCoin",
                "duration": 394
            },
            {
                "id": "DZNUMcOGbq4",
                "title": "All The Way Up (Bitcoin Rap Parody)",
                "duration": 240
            },
            {
                "id": "ZAmIm2TkrUM",
                "title": "Bitcoin's Going To The Moon (Jpop)",
                "duration": 210
            },
            {
                "id": "lG08pD-8upE",
                "title": "Bitcoin Slang Remix — Robbie P",
                "duration": 225
            },
            {
                "id": "rDCrlgKGACo",
                "title": "Anik The First — Be The Change (B.T.C.)",
                "duration": 240
            },
            {
                "id": "AJzCQaIXelE",
                "title": "Bitcoin Girl — Original Music Video",
                "duration": 210
            },
            {
                "id": "GZ0YMSLZjfQ",
                "title": "Welcome To The Blockchain — Music Video",
                "duration": 240
            },
            {
                "id": "6mJF3c90xe0",
                "title": "Shitcoin Casinos — Annonymal (Bitcoin Heavy Metal)",
                "duration": 240
            },
            {
                "id": "PYeUQpbMy1o",
                "title": "Love You Like A Bitcoin",
                "duration": 240
            },
            {
                "id": "KRopo3nofl4",
                "title": "10,000 Bitcoin Remix — Laura Saggers",
                "duration": 240
            },
            {
                "id": "Vz9iCgiSZrM",
                "title": "Bitcoin's Back — Lil Bubble (Backstreet Boys Parody)",
                "duration": 210
            },
            {
                "id": "ipDpjANJ7fU",
                "title": "Save The Young",
                "duration": 240
            },
            {
                "id": "eH9b_qNbjEU",
                "title": "Bitcoin — Official Music Video (Teejay)",
                "duration": 210
            },
            {
                "id": "2991v7Mt1_g",
                "title": "MusicSnake — Cold Storage (Tiny Desk edition)",
                "duration": 240
            },
            {
                "id": "YbzNJr26H-4",
                "title": "Welcome To The Blockchain — Toby Ganger + Decap",
                "duration": 240
            },
            {
                "id": "vyKA1pW0CBA",
                "title": "BITCOIN — Music Video",
                "duration": 210
            },
            {
                "id": "Y5r6e1VcIBE",
                "title": "BITCOIN SONG — Pat Ryan",
                "duration": 210
            },
            {
                "id": "WrEVpNdYkrs",
                "title": "B.R.E.A.M. — Zhou Tonged (Wu-Tang C.R.E.A.M. Parody)",
                "duration": 240
            },
            {
                "id": "A7TuFy0fcuw",
                "title": "Bitcoin Song — Community Playlist",
                "duration": 240
            },
            {
                "id": "nUUXOZAPWFQ",
                "title": "Crypto to Heaven (Stairway to Heaven Parody)",
                "duration": 300
            },
            {
                "id": "eqxNbGvNamY",
                "title": "Lovesong for Satoshi Nakamoto (Bitcoin Whitepaper)",
                "duration": 240
            },
            {
                "id": "VdAcvUVy7FE",
                "title": "We Will Bitcoin",
                "duration": 210
            },
            {
                "id": "XcerPhwbIFs",
                "title": "Orange Pill rApp — Wallet Stay Stackin'!",
                "duration": 240
            },
            {
                "id": "XEBWtbhq0Ts",
                "title": "All About That Bitcoin — Naomi van der Velde",
                "duration": 210
            },
            {
                "id": "bZb2qBrVHVY",
                "title": "Bitcoins from Heaven",
                "duration": 240
            },
            {
                "id": "IrcN-zmCZMI",
                "title": "If It Was Not For Satoshi — Robbie P",
                "duration": 210
            },
            {
                "id": "U252iiG8YP0",
                "title": "Jingle Bells, Bank Cartels! A Bitcoin Christmas Song",
                "duration": 210
            },
            {
                "id": "ZLYx-SXUjUk",
                "title": "Richard — The Flood ft Tomer Strolight",
                "duration": 240
            },
            {
                "id": "nvlvG18AcCo",
                "title": "Bitcoin Bob: Money Monopoly",
                "duration": 240
            },
            {
                "id": "8n5k714GOlA",
                "title": "HODL GANG — Bitcoin Rap Remix",
                "duration": 240
            },
            {
                "id": "DNYzHGM50Ys",
                "title": "Too Bit To Fail — Proof of Word EP",
                "duration": 240
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
                "id": "c3LyvfHQ9BE",
                "title": "Why Bitcoin Booms in October — Simply Bitcoin",
                "duration": 1200
            },
            {
                "id": "Q_FFfWvq-z8",
                "title": "CNBC: The Greatest Crypto Bull Run Of Our Lifetime HAPPENING NOW",
                "duration": 600
            },
            {
                "id": "LGYcl4hwUOI",
                "title": "Bitcoin at 200-Week Moving Average — Buy Signal?",
                "duration": 1200
            },
            {
                "id": "b_u1O9qzG6U",
                "title": "Big Bitcoin Adoption News!",
                "duration": 600
            },
            {
                "id": "N7Z7tpwSlBg",
                "title": "Strategy CEO on 2026 Bitcoin Outlook — Fox Business",
                "duration": 540
            },
            {
                "id": "G0csA1i4rtU",
                "title": "Bitcoin ETFs Explained: The Future of Crypto in 2025",
                "duration": 900
            },
            {
                "id": "DyMVHXz9Tgs",
                "title": "Bitcoin ETFs Survive First Stress Test — Bloomberg",
                "duration": 420
            },
            {
                "id": "wSh_KzcY_dA",
                "title": "60 Minutes: Stories About Cryptocurrency — CBS",
                "duration": 4000
            },
            {
                "id": "1nsIy7PWXyY",
                "title": "Bitcoin Price Analysis — Key Levels",
                "duration": 1200
            },
            {
                "id": "uX4jfBZWpkY",
                "title": "What's Behind Bitcoin's Remarkable Surge?",
                "duration": 600
            },
            {
                "id": "HOYnvEVOTJA",
                "title": "Simply Bitcoin — Daily News Update",
                "duration": 3600
            },
            {
                "id": "CyVyCOHODk4",
                "title": "Ted Cruz: Why the Left Hates Bitcoin and Cryptocurrencies",
                "duration": 600
            },
            {
                "id": "zo1pZlgAvpY",
                "title": "Is This the Final Bitcoin Crash Before All-Time Highs? — Simply Bitcoin",
                "duration": 1500
            },
            {
                "id": "S2WPt7ZO1rk",
                "title": "Bitcoin Touches 13-Month High — Valkyrie Refiles for Spot ETF (CNBC)",
                "duration": 600
            },
            {
                "id": "kN5codbLCCY",
                "title": "Bitcoin Regulation Becoming National Security",
                "duration": 900
            },
            {
                "id": "iQOiQZ_g97I",
                "title": "Wall Street Week — The Crypto Craze",
                "duration": 900
            },
            {
                "id": "WSBQunQ2jJA",
                "title": "The Time Has Come — El Salvador Makes Bitcoin Legal Tender",
                "duration": 600
            },
            {
                "id": "bOBiu9zP5jA",
                "title": "Bitcoin Owner Will Lose $260 Million If He Can't Remember Password — TODAY",
                "duration": 600
            },
            {
                "id": "kh-YqlKC23k",
                "title": "Why Bitcoin Is Still King in 2025 — USA & UK Adoption",
                "duration": 900
            },
            {
                "id": "dYFMoK1nDmc",
                "title": "60 Minutes: Bitcoin Beach El Salvador — CBS",
                "duration": 780
            },
            {
                "id": "omyLCxja20g",
                "title": "FED Sabotages the Bitcoin Bank — Simply Bitcoin EP 601",
                "duration": 3600
            },
            {
                "id": "0sGgpNg_2IM",
                "title": "Bitcoin Tops $100K — Big Finance Admits Wrong (The Bitcoin Group #433)",
                "duration": 3600
            },
            {
                "id": "5c03NCvohCA",
                "title": "Bitcoin ETF Record Performance — Bloomberg",
                "duration": 480
            },
            {
                "id": "241nNtbdXaA",
                "title": "Bitcoin Experts Predict 2025 Will Be the Year of Mass Adoption",
                "duration": 900
            },
            {
                "id": "inSLOPC8grc",
                "title": "Bitcoin: Better Than Bonds",
                "duration": 600
            },
            {
                "id": "W-ArTN0Xj4c",
                "title": "Bitcoin Surges and Vanguard Allows Crypto ETF Trading — CNBC",
                "duration": 600
            },
            {
                "id": "BSiQHfEUabI",
                "title": "Bitcoin Hits New All-Time High — CNBC",
                "duration": 360
            },
            {
                "id": "wR6SJgMnstE",
                "title": "Using Bitcoin as an Inflationary Hedge",
                "duration": 600
            },
            {
                "id": "zyUxPX7Mp2U",
                "title": "Bitcoin Could Go Past $100k This Year — Chainalysis CEO",
                "duration": 600
            },
            {
                "id": "-LPit2bEWAo",
                "title": "BlackRock CEO on Bitcoin ETF Success — CNBC",
                "duration": 600
            },
            {
                "id": "K4ciiDyUvUo",
                "title": "Larry Fink: Bitcoin is Digital Gold — CNBC",
                "duration": 480
            },
            {
                "id": "dEnbFU-HySk",
                "title": "Shark Tank's Robert Herjavec Says Bitcoin Price Will Skyrocket Again — CNBC",
                "duration": 600
            },
            {
                "id": "wC4nzqrgvik",
                "title": "Iran Used Bitcoin To Break US Sanctions — Simply Bitcoin",
                "duration": 1800
            },
            {
                "id": "WaEBc2prSPE",
                "title": "Next-Gen Bitcoin ETFs Outperforming — Bloomberg",
                "duration": 360
            },
            {
                "id": "DDk6-tdHeXQ",
                "title": "Bitcoin Technical Analysis — Elliott Wave",
                "duration": 1500
            },
            {
                "id": "CbEHD0esI_A",
                "title": "MicroStrategy Bitcoin Reserve Strategy — CNBC",
                "duration": 420
            },
            {
                "id": "DnT8bUl_DM8",
                "title": "Bitcoin Is Being Repriced by AI",
                "duration": 600
            },
            {
                "id": "2PvvIoi7l_Y",
                "title": "Lebanon Banks Close Doors on Customers — Bitcoin Fixes This",
                "duration": 900
            },
            {
                "id": "diF93mE7nqg",
                "title": "Bitcoin Rises to All-Time High",
                "duration": 300
            },
            {
                "id": "dy2ZTOq22bQ",
                "title": "Cathie Wood Increased Her Bitcoin Price Prediction for 2025",
                "duration": 600
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
                "id": "rJlgpOQp7Ig",
                "title": "Orange Pill [OP26] — Monetizing Dissent",
                "duration": 3600
            },
            {
                "id": "gCfA1lkmJo4",
                "title": "The Greatest Bitcoin Explanation — Michael Saylor",
                "duration": 1200
            },
            {
                "id": "LKYVbahTjQM",
                "title": "Giving Strangers $50 Bitcoin or $5 Cash (Social Experiment)",
                "duration": 600
            },
            {
                "id": "l3c8l4rgp6s",
                "title": "Inside Costa Rica's Secret Bitcoin Community — Get Based TV",
                "duration": 1200
            },
            {
                "id": "wQ7V3S8vW9X",
                "duration": 3300,
                "title": "Andreas Antonopoulos: Understanding the Blockchain"
            },
            {
                "id": "SS8-qjP-yAo",
                "title": "We Investigated Canada's Secret Bitcoin City — Get Based TV",
                "duration": 1200
            },
            {
                "id": "6qVq7T-NJdE",
                "title": "Gen Z Knows the System Is Broken… Bitcoin is the Escape Plan — Julian Figueroa",
                "duration": 600
            },
            {
                "id": "zdJiltpWi3A",
                "title": "The 3 Biggest Bitcoin Myths (Stop Believing Them) — Get Based TV",
                "duration": 900
            },
            {
                "id": "HPkjH3Yeih4",
                "title": "What is the ONE THING Preventing Bitcoin from Reaching $100k?",
                "duration": 600
            },
            {
                "id": "Uh-eTnRXCr8",
                "title": "Bitcoin Street Interviews Edinburgh — Mike Still",
                "duration": 1400
            },
            {
                "id": "rc744Z9IjhY",
                "duration": 3600,
                "title": "Andreas Antonopoulos: The Internet of Money - What is Bitcoin?"
            },
            {
                "id": "H85UfhYV_pA",
                "title": "Smart Money is Selling Real Estate for Bitcoin — Terence Michael",
                "duration": 3600
            },
            {
                "id": "LuZ0XN3eH5I",
                "title": "The Fatal Flaw in Bitcoin's Lightning Network? — Get Based TV",
                "duration": 900
            },
            {
                "id": "D22zHDCE6-0",
                "title": "Did El Salvador Just Give Up On Bitcoin? — Get Based TV",
                "duration": 900
            },
            {
                "id": "6xIq0FdmsIA",
                "duration": 4320,
                "title": "Andreas Antonopoulos: Internet of Money - Keynote"
            },
            {
                "id": "IuVkUqdqkcc",
                "title": "Buy Bitcoin When It Looks Like This — Exit Manual",
                "duration": 653
            },
            {
                "id": "vQ8MvR1sW2X",
                "duration": 3900,
                "title": "Andreas Antonopoulos: The Architecture of Trust"
            },
            {
                "id": "7O10xS_sQoE",
                "title": "The Hidden Tax You Pay to Rich People — Julian Figueroa",
                "duration": 600
            },
            {
                "id": "heA1fZzRAFs",
                "title": "Orange Pill: The Bitcoin Guide",
                "duration": 900
            },
            {
                "id": "Nls1keqHlz8",
                "title": "Show This Video At The Dinner Table To Orange Pill Your Family!",
                "duration": 600
            },
            {
                "id": "nTRdmYX-0h8",
                "title": "Warming Up to Bitcoin — The Future of Sustainable Heating? — Get Based TV",
                "duration": 900
            },
            {
                "id": "y1KXs3uE42I",
                "duration": 5400,
                "title": "Andreas Antonopoulos: Why Bitcoin Matters - Internet of Money"
            },
            {
                "id": "XG7v4XFL7mc",
                "title": "Stossel: Is Bitcoin Better Money?",
                "duration": 900
            },
            {
                "id": "xyxRCwJVBUc",
                "title": "Bitcoin Expert Breaks Down Historic RFK Jr. Speech — Get Based TV",
                "duration": 900
            },
            {
                "id": "KW_wYvZ1eZg",
                "duration": 4800,
                "title": "Andreas Antonopoulos: Decentralization & The Future of Money"
            },
            {
                "id": "Fp9xhVeWUMs",
                "title": "Asking Strangers About Bitcoin & Cryptocurrency",
                "duration": 600
            },
            {
                "id": "T_hXPEh8S60",
                "title": "Becoming A Bitcoin Maximalist: The Journey (Asking REAL People)",
                "duration": 900
            },
            {
                "id": "iXxeIahvAOQ",
                "title": "Building a Bitcoin World — Interview with BTC Sessions — Get Based TV",
                "duration": 3600
            },
            {
                "id": "N5aAkIo-93Q",
                "title": "Crypto Street Interviews: Las Vegas Episode 1",
                "duration": 600
            },
            {
                "id": "Sv9VAocAA80",
                "title": "Max Keiser: Bitcoin Will Replace the Dollar",
                "duration": 1200
            },
            {
                "id": "NuKcDkaH2fc",
                "title": "Orange Pill [OP40] — The Dust Bowl of Money",
                "duration": 3600
            },
            {
                "id": "HhxcdMIJTLA",
                "title": "Telling People About Bitcoin Never Works — Exit Manual",
                "duration": 450
            },
            {
                "id": "Qaj7TfHxVBU",
                "title": "El Salvador's Broken Bitcoin Revolution — Get Based TV",
                "duration": 1200
            },
            {
                "id": "arkn9rqczJ8",
                "title": "I Asked Bitcoin Billionaires For Crypto Advice",
                "duration": 600
            },
            {
                "id": "xegEpCLT0CQ",
                "title": "A Practical Approach to Orange Pilling",
                "duration": 1800
            },
            {
                "id": "1Mr9PknsM_Y",
                "title": "Saylor's Best Explanation Under 20 Minutes",
                "duration": 1200
            },
            {
                "id": "ExUeCIscbNU",
                "title": "Something is Deeply Wrong with the Economy Right Now — Julian Figueroa",
                "duration": 600
            },
            {
                "id": "gt4HBSUjENE",
                "title": "Would You Rather Have $100 Or 1 Bitcoin?",
                "duration": 480
            },
            {
                "id": "r34hkJBeE-M",
                "title": "How I Lost 14 Bitcoins — Exit Manual",
                "duration": 555
            },
            {
                "id": "CgCX1K-uD7o",
                "title": "IS CRYPTO A SCAM? (Asking The Public)",
                "duration": 600
            },
            {
                "id": "03V2j-KUFho",
                "title": "Is Bitcoin Actually Just a Cult? — Get Based TV",
                "duration": 900
            },
            {
                "id": "og5zZssEWIc",
                "title": "Bitcoin Street Interviews Birmingham — Mike Still",
                "duration": 1500
            },
            {
                "id": "MQvvLwxxxdM",
                "title": "The Banks are BROKE",
                "duration": 600
            },
            {
                "id": "4xGTGqsy4SM",
                "title": "ORANGE PILL PODCAST — Episode 0001",
                "duration": 3600
            },
            {
                "id": "ztTICG37kxA",
                "title": "I Asked Strangers About Bitcoin... It Got Awkward",
                "duration": 600
            },
            {
                "id": "4QVuQH2DEJM",
                "title": "Orange Pill [OP23] — Bitcoin Reveals the Fiat Dark Ages",
                "duration": 3600
            },
            {
                "id": "Bt2Z-_nhpwQ",
                "title": "How to Orange Pill Anyone",
                "duration": 600
            },
            {
                "id": "4hWMHLF-OEg",
                "title": "Inside Peru's Hidden Bitcoin Revolution — Get Based TV (Full Movie)",
                "duration": 3600
            },
            {
                "id": "jNQpZ2T-WcQ",
                "duration": 4200,
                "title": "Andreas Antonopoulos: Bitcoin vs Traditional Banking"
            },
            {
                "id": "sLcNmZwMOz0",
                "title": "Drunk People React To Bitcoin — Street Interviews!",
                "duration": 480
            },
            {
                "id": "4tqXvMNOuHk",
                "title": "Bitcoin Ethical Superiority Explained — Exit Manual",
                "duration": 480
            },
            {
                "id": "exK5yFEuBsk",
                "title": "Remember, Remember the 5th of November — Bitcoin",
                "duration": 180
            },
            {
                "id": "YT-38EneBWw",
                "title": "Bitcoin Street Interviews London — Mike Still",
                "duration": 1440
            },
            {
                "id": "ZkgkxB8s9bw",
                "title": "Can Bitcoin Be Futureproof? — w/ Adam O'Brien — Get Based TV",
                "duration": 3600
            },
            {
                "id": "vclZlAFXpEI",
                "title": "Give Me 9 Minutes and You Will Understand Bitcoin — Exit Manual",
                "duration": 600
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
                "id": "XJU8r6WiipM",
                "title": "Bitcoin vs Gold — Response to Peter Schiff",
                "duration": 2400
            },
            {
                "id": "MmdQKU0YNX4",
                "title": "Bitcoin Will Hit $850K — Max Keiser Prediction",
                "duration": 1200
            },
            {
                "id": "K5bZ4HPpwxw",
                "title": "Fixing Government Corruption - WBD",
                "duration": 6182
            },
            {
                "id": "xa5iT1nklyU",
                "title": "Brian Kelly vs Peter Schiff — Bitcoin Bull vs Bear",
                "duration": 600
            },
            {
                "id": "2ZaMzWZyXe8",
                "title": "Wall Street Meets Bitcoin: Orange-Pilling Finance — Strive CEO",
                "duration": 1320
            },
            {
                "id": "D_yIKnHOuWg",
                "title": "Michael Saylor Answers the Question of Our Time",
                "duration": 600
            },
            {
                "id": "l1Rgq8UY3zo",
                "title": "Why Bitcoin is Different — Stephan Livera",
                "duration": 3600
            },
            {
                "id": "1jZQNo_rRsQ",
                "title": "Bitcoin Poised for Cycle Top? Corporate Treasuries — Saifedean",
                "duration": 1763
            },
            {
                "id": "3YuscY1L1zE",
                "title": "Why You Should Be a Bitcoin Maximalist",
                "duration": 900
            },
            {
                "id": "tbCVXyUGO3o",
                "title": "I Bought This Instead of Bitcoin — Mark Moss",
                "duration": 1200
            },
            {
                "id": "wBEqw-PSBlg",
                "title": "Why Selling Bitcoin for Fiat Misses the Picture — Mark Moss",
                "duration": 1800
            },
            {
                "id": "aN2G0Uvahf8",
                "title": "What Bitcoin Did — Beginner Guide",
                "duration": 5400
            },
            {
                "id": "meCoGKugjMQ",
                "title": "Marty Bent on the Power of Bitcoin",
                "duration": 3600
            },
            {
                "id": "gp4U5aH_T6A",
                "duration": 10800,
                "title": "Economics & Bitcoin Debate - Lex Fridman & Saifedean"
            },
            {
                "id": "nMicPEQM4HY",
                "title": "Maximalism is Dead? | Peter McCormack",
                "duration": 1541
            },
            {
                "id": "to7FF7ZmBl0",
                "title": "Lyn Alden: No Massive Bust or Boom? — Coin Stories",
                "duration": 3383
            },
            {
                "id": "TUO10-HcdvY",
                "duration": 36000,
                "title": "The Ultimate Bitcoin vs. Everything Debate Loop"
            },
            {
                "id": "yCtVkIEIhCg",
                "title": "Bitcoin Can Never Go to Zero — Robert Breedlove",
                "duration": 1200
            },
            {
                "id": "j89aAqfezX8",
                "title": "Saving Bedford - Peter McCormack",
                "duration": 6434
            },
            {
                "id": "bhSGC08V47U",
                "title": "Stephan Livera on Bitcoin Maximalism",
                "duration": 3600
            },
            {
                "id": "x0kNGaxLg18",
                "title": "Lyn Alden: Why This Bitcoin Cycle Disappointed — Coin Stories",
                "duration": 3320
            },
            {
                "id": "aWtzOQTv8Dc",
                "title": "Saylor vs Dorsey: Battle for Bitcoin's Future",
                "duration": 720
            },
            {
                "id": "0rlnVQoiVyc",
                "title": "History of Bitcoin w/ Marty Bent",
                "duration": 3000
            },
            {
                "id": "N_qo_-QRqAM",
                "title": "No More 4-Year Cycles? — Stephan Livera",
                "duration": 3000
            },
            {
                "id": "4Q1AasS6HLU",
                "title": "Bitcoin 101 — Stephan Livera Podcast",
                "duration": 4200
            },
            {
                "id": "J6I-OzXItfA",
                "title": "Jack Dorsey Explains Bitcoin",
                "duration": 600
            },
            {
                "id": "ANtyYqcXR9w",
                "title": "Marty Bent: Tales from The Crypt",
                "duration": 3600
            },
            {
                "id": "sTxdYxGqYDo",
                "title": "Stephan Livera: Why Bitcoin Only",
                "duration": 3000
            },
            {
                "id": "unCR7k3-aoE",
                "title": "Bitcoin Is the Apex Asset — Robert Breedlove",
                "duration": 1500
            },
            {
                "id": "6WxdkRk8cs4",
                "title": "Stephan Livera: Bitcoin Education Deep Dive",
                "duration": 2700
            },
            {
                "id": "QT_YDxTl1FQ",
                "title": "Jack Mallers: Bitcoin Maximalist Post-GENIUS Act",
                "duration": 1800
            },
            {
                "id": "9DuhDgqx21w",
                "title": "Peter Schiff: Bitcoin Strategy is a Fraud",
                "duration": 1800
            },
            {
                "id": "Bh7LBF9cU6w",
                "duration": 18000,
                "title": "Stock-to-Flow & Power Law Debate Marathon"
            },
            {
                "id": "HwNSykjO-gI",
                "title": "Lyn Alden: Changing World Order — Coin Stories",
                "duration": 3630
            },
            {
                "id": "oMDHTVwSRHI",
                "title": "1 Bitcoin Is All You Need",
                "duration": 2400
            },
            {
                "id": "JaMJi1_1tkA",
                "title": "Bitcoin Rap Battle: Hamilton vs. Satoshi — ft. EpicLloyd",
                "duration": 600
            },
            {
                "id": "d5_cYWLpDs8",
                "title": "A Brief History of Bitcoin Maximalism",
                "duration": 1500
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
                "id": "kJEzpYjVsB4",
                "title": "Trump's Policies — Strategic Bitcoin Reserve & Stablecoin Law",
                "duration": 900
            },
            {
                "id": "TE0eFKTJEfQ",
                "title": "Bitcoin Policy Outlook 2025 — Strategic Reserves, BitBonds & Privacy",
                "duration": 1800
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
                "id": "pBMnPec4AC4",
                "title": "Congressman Tom Emmer SLAMS SEC Chair Gary Gensler",
                "duration": 600
            },
            {
                "id": "h_oAr4wn7M4",
                "title": "House Financial Services Committee Hearing: Oversight of the SEC",
                "duration": 7200
            },
            {
                "id": "_6PvTUqyRt8",
                "title": "Alex Gladstein on Bitcoin Freedom",
                "duration": 1800
            },
            {
                "id": "WO6Ww-MLQGs",
                "title": "Wyoming Senator Cynthia Lummis — Texas Blockchain Summit",
                "duration": 1800
            },
            {
                "id": "pR4t4dRdajw",
                "title": "Bitcoin vs Authoritarianism — Gladstein",
                "duration": 2400
            },
            {
                "id": "YqWoj2eFDp4",
                "duration": 1800,
                "title": "Right To Mine Policy - Dennis Porter"
            },
            {
                "id": "7ZSpFWEd-x0",
                "title": "Gary Gensler Testifies — Left SHAKING After Crypto Questions",
                "duration": 900
            },
            {
                "id": "boZ7yJOFBk0",
                "duration": 2932,
                "title": "Crushing Anti-BTC Legislation - Porter"
            },
            {
                "id": "kqOx7PjbNOw",
                "title": "Shootin Straight Episode 3: Senator Cynthia Lummis",
                "duration": 1800
            },
            {
                "id": "vr1M2anvbWU",
                "title": "Trump's Bitcoin Reserve Plan — Power Move or Trap?",
                "duration": 1200
            },
            {
                "id": "P7IQeU31R0o",
                "title": "House Holds Joint Crypto Hearing — CNBC Crypto World",
                "duration": 600
            },
            {
                "id": "5IHNLgkO6Ls",
                "title": "Trump Signs Order to Establish Strategic Reserve of Cryptocurrencies",
                "duration": 600
            },
            {
                "id": "R4gyS5mb9dE",
                "title": "Gladstein: Bitcoin Is a Tool Dictators Should Fear — 2025 Summit",
                "duration": 1800
            },
            {
                "id": "DJhgLMMAPHQ",
                "title": "Trump Nominates Crypto Advocate Paul Atkins as SEC Chair",
                "duration": 600
            },
            {
                "id": "zV_A2yMZl0w",
                "title": "Gladstein: Bitcoin Privacy Technologies Redefining Money",
                "duration": 1800
            },
            {
                "id": "tja-5y_FvgY",
                "title": "Regulatory Shackles Are Off",
                "duration": 600
            },
            {
                "id": "MuobSz7534s",
                "duration": 3119,
                "title": "Paving the Frontier - Dennis Porter"
            },
            {
                "id": "YwZseBZOc6U",
                "title": "The Bitcoin Strategic Reserve",
                "duration": 900
            },
            {
                "id": "kN5codbLCCY",
                "title": "Bitcoin Regulation: National Security Issue",
                "duration": 900
            },
            {
                "id": "kSbMU5CbFM0",
                "title": "Bitcoin vs Authoritarianism — HRF",
                "duration": 2100
            },
            {
                "id": "UVg4AjuPBQU",
                "title": "Sen. Lummis on Crypto Oversight Bill — Stablecoins Need Hard Assets",
                "duration": 600
            },
            {
                "id": "jMg3U-51Obw",
                "title": "GOP Rep Unveils Bold Crypto Tax Twist — No Capital Gains",
                "duration": 600
            },
            {
                "id": "m3es0G4m_R4",
                "title": "Sen. Lummis Questions Gary Gensler (SEC) and Rohit Chopra (CFPB)",
                "duration": 1200
            },
            {
                "id": "nDSPY2XMmL0",
                "title": "New Hampshire's Strategic Crypto Reserve — What to Know",
                "duration": 900
            },
            {
                "id": "_E_5Hk-vRj8",
                "duration": 1410,
                "title": "Bitcoin U.S. Reserve in 30 Days?"
            },
            {
                "id": "jjl_kp9v-Eg",
                "title": "Washington's Crypto Awakening: The Lawmaker Town Hall",
                "duration": 3600
            },
            {
                "id": "Y5wgZ3rFayQ",
                "title": "Financial Sovereignty & Bitcoin Policy",
                "duration": 1800
            },
            {
                "id": "78xSNqLfJDA",
                "title": "Dem Lawmaker Urges Yellen To Crack Down On Crypto Bros",
                "duration": 600
            },
            {
                "id": "R-Rd12saPh8",
                "duration": 1200,
                "title": "The Fight for Bitcoin in America"
            },
            {
                "id": "lwJpvqMeLJg",
                "duration": 340,
                "title": "Bitcoin Breaking Records - SuperTalk"
            },
            {
                "id": "c1l7EFvyTyM",
                "title": "Gary Gensler GRILLED on Crypto at Congress Committee Hearing",
                "duration": 1800
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
                "id": "gCfA1lkmJo4",
                "title": "Michael Saylor — The Greatest Bitcoin Explanation",
                "duration": 1200
            },
            {
                "id": "3-vBBYEXv6M",
                "title": "Saylor: Bitcoin as Apex Capital Strategy in the AI Age",
                "duration": 2100
            },
            {
                "id": "ssEMtaRwra0",
                "title": "The Saylor Series | Part 3: Bitcoin as the Ultimate Asset",
                "duration": 8100
            },
            {
                "id": "B4nK8mP2qS6",
                "title": "Michael Saylor on Bitcoin and the Future of Finance",
                "duration": 4800
            },
            {
                "id": "reVebuAf_Cs",
                "title": "Michael Saylor: 21 Ways To Wealth — Bitcoin 2025 Keynote",
                "duration": 2211
            },
            {
                "id": "sjYANTSww34",
                "title": "Michael Saylor Briefly Explains Why Bitcoin Is The Best Store of Value",
                "duration": 600
            },
            {
                "id": "bjvMt0xaSUQ",
                "title": "The Saylor Series | Part 4: The Future of Bitcoin & Civilization",
                "duration": 7500
            },
            {
                "id": "XU5u5gl6EIs",
                "title": "Why Bitcoin is the Perfect Monetary System — Saylor Explains in Plain English",
                "duration": 1800
            },
            {
                "id": "VTCzVWgJJWs",
                "title": "Bitcoin As The Apex Predator — Robert Breedlove (Pomp Podcast)",
                "duration": 4200
            },
            {
                "id": "3GkA2grVaNw",
                "title": "Michael Saylor Explains Why Bitcoin is Superior to Gold",
                "duration": 1200
            },
            {
                "id": "_Nvh_xScNPY",
                "title": "SaylorJungle — 1 Hour Relaxing Saylor with Forest Rain Sounds",
                "duration": 3600
            },
            {
                "id": "QBLGZqYTmn8",
                "title": "MicroStrategy's Bitcoin Strategy Is INSANE — Pomp Podcast",
                "duration": 1200
            },
            {
                "id": "7aJTOCN501g",
                "title": "Saylor Reveals the TOP Bitcoin Secrets — Digital Asset Summit 2025",
                "duration": 2400
            },
            {
                "id": "9jgoAqTErfs",
                "title": "Michael Saylor Brilliantly Explains Bitcoin's Superiority",
                "duration": 1200
            },
            {
                "id": "CYT0AxQxa7o",
                "title": "Why Bitcoin Succeeds — The Saylor Series Episode 12",
                "duration": 5400
            },
            {
                "id": "D_yIKnHOuWg",
                "title": "Michael Saylor Answers the Question of Our Time",
                "duration": 600
            },
            {
                "id": "PXC0spZ2M4U",
                "title": "Is Bitcoin Digital Gold? — Michael Saylor",
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
                "id": "fzg9I7hHdzs",
                "title": "Economics, Inflation, Interest Rates & Competition — The Saylor Series Episode 9",
                "duration": 5400
            },
            {
                "id": "blkHhCz5_nY",
                "title": "Tucker Carlson Interview with Michael Saylor about Bitcoin",
                "duration": 3600
            },
            {
                "id": "IdPKzulKdFI",
                "title": "Is Michael Saylor a Threat For Owning So Much Bitcoin?",
                "duration": 900
            },
            {
                "id": "hqoagNBtIps",
                "title": "Michael Saylor: Bitcoin Prophecy — BTC Prague 2025",
                "duration": 2400
            },
            {
                "id": "6P97_koDGtA",
                "title": "Bitcoin vs Manhattan Real Estate in 1776 — Michael Saylor",
                "duration": 300
            },
            {
                "id": "kFP_1ulQ4uI",
                "title": "SaylorRain — Relaxing Saylor Speaks on Bitcoin with Rain Sounds (1H)",
                "duration": 3600
            },
            {
                "id": "tNJp3qBH1sw",
                "title": "Bitcoin is Cybernetic Life — The Saylor Series Episode 13",
                "duration": 5400
            },
            {
                "id": "qBPtUf50XVg",
                "title": "Saylor BEST Bitcoin Podcast: Why You NEED 0.1 Bitcoin in 2025",
                "duration": 3600
            },
            {
                "id": "7gvogsnkjdc",
                "title": "SaylorWaves — 1 Hour of Relaxing Saylor Speaking about Bitcoin",
                "duration": 3600
            },
            {
                "id": "1Ms7ql_S63A",
                "title": "The Saylor Series | Part 2: Bitcoin as Digital Gold & Property Rights",
                "duration": 7800
            },
            {
                "id": "OA3DGM0vgtM",
                "title": "Michael Saylor Keynote — 2024 Cantor Fitzgerald Conference",
                "duration": 3600
            },
            {
                "id": "LBKld0QdXnk",
                "title": "Bitcoin Is Being Adopted By A Country As Sovereign Money — Pomp Podcast #585",
                "duration": 3600
            },
            {
                "id": "wba5XJHKPqg",
                "title": "Saylor: Bitcoin Halving Will Drive Demand Through the Roof",
                "duration": 600
            },
            {
                "id": "dogJz_CfQW8",
                "title": "Inspiring and Relaxing Michael Saylor Speaks about Bitcoin for 1H",
                "duration": 3600
            },
            {
                "id": "GUrt5xVBWMk",
                "title": "Michael Saylor Is A Bitcoin Genius — Pomp Podcast",
                "duration": 1800
            },
            {
                "id": "gSc6BC1Kh2g",
                "title": "Digital Gold: Harder, Smarter, Stronger, Faster — The Saylor Series Episode 6",
                "duration": 5400
            },
            {
                "id": "7hyoONj4nEY",
                "title": "What One Billionaire Knows About Outlasting a Dollar Collapse — Jordan Peterson EP 554",
                "duration": 7200
            },
            {
                "id": "Hfdq-Wl1fRQ",
                "title": "Michael Saylor Explains Why Going All In on Bitcoin Could Be Genius",
                "duration": 1200
            },
            {
                "id": "Y7FsiPuF3z4",
                "title": "SaylorSpace — Travel Through Cosmos with Michael Saylor on Bitcoin",
                "duration": 3600
            },
            {
                "id": "w2e3nL7xMz0",
                "title": "Why Corporations Are Putting Bitcoin on Their Balance Sheet — Pomp Podcast #595",
                "duration": 3600
            },
            {
                "id": "RbkLz9C39y0",
                "title": "Bitcoin's Seven Layers of Security — The Saylor Series Episode 14",
                "duration": 5400
            },
            {
                "id": "dVfmTMo_mO0",
                "title": "Celebrating Bitcoin Price with Relaxing Michael Saylor Speaking (10H)",
                "duration": 36000
            },
            {
                "id": "hV_sgkHhApo",
                "title": "SaylorNight — Relaxing Saylor Speaks on Bitcoin in the Night (1H)",
                "duration": 3600
            },
            {
                "id": "KxTWC3ShYDE",
                "title": "Saylor: Why Bitcoin is the Only Scarce Asset",
                "duration": 1800
            },
            {
                "id": "MSMJBmo_q4s",
                "title": "Saylor: Bitcoin as Treasury Reserve Asset",
                "duration": 4200
            },
            {
                "id": "PyYogQEnPNE",
                "title": "Should You Buy Bitcoin? — Michael Saylor",
                "duration": 600
            },
            {
                "id": "S2ziezeoK4E",
                "title": "What's Actually Happening To Bitcoin & The Economy Right Now — Saylor",
                "duration": 1800
            },
            {
                "id": "s_0ggp41rT4",
                "title": "Bitcoin Common Misconceptions — Saylor & Robert Breedlove",
                "duration": 5400
            },
            {
                "id": "TWSl9mdoYds",
                "title": "Expert Analyzes the Impact of a Bitcoin ETF — Michael Saylor",
                "duration": 600
            },
            {
                "id": "O9KnBcWMkpw",
                "duration": 2243,
                "title": "Michael Saylor 2024 Keynote - Nashville"
            },
            {
                "id": "ytmhmixeCRo",
                "title": "The Bitcoin Interview That YouTube Tried To Delete",
                "duration": 3600
            },
            {
                "id": "swoZxZyqpT8",
                "title": "Michael Saylor On How Bitcoin Can Change Everything",
                "duration": 1800
            },
            {
                "id": "4Buu1h_89hY",
                "title": "Michael Saylor: Bitcoin Is As Risky As Crossing a Street",
                "duration": 600
            },
            {
                "id": "wSwQxTq147Q",
                "title": "Chill SaylorVibes — The Margin Call (Bitcoin Lo-fi)",
                "duration": 3600
            },
            {
                "id": "WOpTi_qJUiw",
                "title": "Bitcoin's Transaction Volume Exceeded American Express — Saylor",
                "duration": 600
            },
            {
                "id": "rcGeY0OzWdQ",
                "title": "Michael Saylor: Money is Energy — Breedlove & Lex Fridman",
                "duration": 600
            },
            {
                "id": "1Mr9PknsM_Y",
                "title": "Michael Saylor's Best Explanation of Bitcoin",
                "duration": 1200
            },
            {
                "id": "ig9pu0XRtNM",
                "title": "Bitcoin as Power to the People — Saylor & Robert Breedlove",
                "duration": 5400
            },
            {
                "id": "aFGCKwPNH4I",
                "title": "The Defining Question of Our Time in History — Michael Saylor",
                "duration": 1800
            },
            {
                "id": "Rty7BQyUkHM",
                "title": "NEW Michael Saylor Interview on Bitcoin (12-Minute Summary)",
                "duration": 720
            },
            {
                "id": "aUEhwe2GvtY",
                "title": "Bitcoin Economics and Evolution — The Saylor Series Episode 16",
                "duration": 5400
            },
            {
                "id": "MhNrsdAwaUM",
                "title": "The Death of Gold — The Saylor Series Episode 10",
                "duration": 5400
            },
            {
                "id": "VGkyVoNw9v8",
                "title": "Tech Themes thru History — The Saylor Series Episode 3",
                "duration": 5400
            },
            {
                "id": "1PkMFIa7rmQ",
                "title": "21 Rules of Bitcoin - Saylor Prague 2024",
                "duration": 2415
            },
            {
                "id": "ykvjtK30HiA",
                "title": "Michael Saylor & The Ultimate Bitcoin Strategy",
                "duration": 3600
            },
            {
                "id": "UADTd7gCuXo",
                "title": "THERE IS NO SECOND BEST — Saylor at BTCPrague 2023",
                "duration": 1800
            },
            {
                "id": "d4XxuxnreBs",
                "title": "True Cost of Inflation — Michael Saylor & Lex Fridman",
                "duration": 600
            },
            {
                "id": "RI4xEHI7tGg",
                "title": "Michael Saylor — PBD Podcast Ep. 212",
                "duration": 7200
            },
            {
                "id": "aWtzOQTv8Dc",
                "title": "Saylor vs Dorsey: Battle for Bitcoin's Future",
                "duration": 720
            },
            {
                "id": "LtcbR98uTJQ",
                "title": "The Saylor Series | Part 1: The History of Money, Bitcoin & the Machine Economy",
                "duration": 7200
            },
            {
                "id": "UQjmBvmyfqA",
                "title": "Listening to Michael Saylor ALL Day — Transcendental Bitcoin Meditation",
                "duration": 3600
            },
            {
                "id": "XbEOeRylUCw",
                "title": "Michael Saylor: Bitcoin, FTX, Bear Market",
                "duration": 3600
            },
            {
                "id": "H99AdvqhUE0",
                "title": "Michael Saylor: Why 21 Million Changes Everything",
                "duration": 2400
            },
            {
                "id": "N3J868zhH9g",
                "title": "Bitcoin Is Encrypted Energy — Saylor & Breedlove",
                "duration": 2400
            },
            {
                "id": "DAXC9km8Wlk",
                "title": "Bitcoin: Zero Percent Inflation — Saylor & Robert Breedlove",
                "duration": 5400
            },
            {
                "id": "dAFJzsJdfJI",
                "title": "Why Michael Saylor Went ALL IN On Bitcoin",
                "duration": 1800
            },
            {
                "id": "gRnspOucXNg",
                "title": "Michael Saylor — Bitcoin Zen",
                "duration": 300
            },
            {
                "id": "59vC4JxWIQU",
                "title": "Michael Saylor Keynote Address — BTC in DC 2025",
                "duration": 2400
            },
            {
                "id": "_27ZZJXv4gw",
                "title": "Michael Saylor & Bill Miller — Bitcoin 2023 Conference Miami",
                "duration": 3600
            },
            {
                "id": "Uc26OItd0JU",
                "title": "Joe Rogan and Michael Saylor on Bitcoin",
                "duration": 3600
            },
            {
                "id": "WvUE_Yvktwk",
                "title": "Bitcoin's Seven Layers of Security #2 — The Saylor Series Episode 15",
                "duration": 5400
            },
            {
                "id": "uUUwuxTquws",
                "title": "Michael Saylor Bought $7 Billion In Bitcoin — Pomp Podcast",
                "duration": 1800
            },
            {
                "id": "J38-PQ6X8HI",
                "title": "Michael Saylor: Satoshi Opened A Portal Into Cyberspace",
                "duration": 1200
            },
            {
                "id": "fZfg1Gtcg08",
                "title": "100% Saylor — Michael Saylor Best Moments",
                "duration": 600
            },
            {
                "id": "tSAvXsMQjYg",
                "title": "What is Bitcoin? — Michael Saylor & Tucker Carlson (Nov 2021)",
                "duration": 1800
            },
            {
                "id": "8h8Pyy4s12w",
                "title": "Michael Saylor on Fox News: Why El Salvador Adopted Bitcoin",
                "duration": 600
            },
            {
                "id": "6osK1CXno80",
                "title": "Michael Saylor GETS ANGRY Talking About Bitcoin",
                "duration": 600
            },
            {
                "id": "8Mhu6dxj7qk",
                "title": "WE HAVE LASER EYES — Michael Saylor at BTCPrague 2023",
                "duration": 2400
            },
            {
                "id": "c3E91-RGjQE",
                "title": "EXCLUSIVE: Michael Saylor Masterclass On Bitcoin",
                "duration": 7200
            },
            {
                "id": "fCkABdwjxtE",
                "title": "Michael Saylor at Bitcoin Atlantis 2024",
                "duration": 2400
            },
            {
                "id": "SojzZxhMf00",
                "title": "The Virtues of Strong Money — The Saylor Series Episode 7",
                "duration": 5400
            },
            {
                "id": "Yd1UFNvqwWQ",
                "title": "How Bitcoin Changes Everything — The Saylor Series Episode 17",
                "duration": 5400
            },
            {
                "id": "hzcmndorLwQ",
                "title": "Saylor: Bitcoin + Digital Credit = The Future of Money (Full Keynote)",
                "duration": 3600
            },
            {
                "id": "1R0J-myYPM0",
                "title": "Michael Saylor: Bitcoin is Hope",
                "duration": 2700
            },
            {
                "id": "LP5W_BUXnEw",
                "title": "Bitcoin, Economics & Mimetics — Saylor & Robert Breedlove",
                "duration": 5400
            },
            {
                "id": "HrehEWYj16s",
                "title": "Robert Breedlove: Philosophy of Bitcoin from First Principles — Lex Fridman",
                "duration": 7200
            },
            {
                "id": "CA_XnoCk4sY",
                "title": "Michael Saylor Has DOUBLED His Bitcoin Investment!",
                "duration": 1200
            },
            {
                "id": "nC37CqWpxfI",
                "title": "Saylor & Dorsey Interview",
                "duration": 3400
            },
            {
                "id": "TXvvMGrZDAw",
                "title": "Billionaire Destroys Peter Schiff's Gold Argument — Michael Saylor",
                "duration": 1200
            },
            {
                "id": "WrR95PFYDFQ",
                "title": "Michael Saylor On Buying Bitcoin With His Balance Sheet — Pomp Podcast #385",
                "duration": 5400
            },
            {
                "id": "gHpnTOoGv7Q",
                "title": "Saylor: Why Bitcoin Will Birth a New Generation of Trillion-Dollar Companies",
                "duration": 1800
            },
            {
                "id": "y8IH0OwFyW4",
                "title": "Michael Saylor: Why Bitcoin is a Truth Machine",
                "duration": 1200
            },
            {
                "id": "wdJFeSY8UVk",
                "title": "Michael Saylor on Tucker Carlson Today — Full Interview",
                "duration": 3600
            },
            {
                "id": "mC43pZkpTec",
                "title": "Michael Saylor: Bitcoin, Inflation & Future of Money — Lex Fridman #276",
                "duration": 10800
            },
            {
                "id": "ZcjFrIMw2sI",
                "title": "Michael Saylor Keynote — The 2022 Atlas Society Gala",
                "duration": 2400
            },
            {
                "id": "v4na2pycrcc",
                "title": "The Future is Bitcoin with Michael Saylor — Moonshots & Mindsets",
                "duration": 3600
            },
            {
                "id": "XdgP25UcHB0",
                "title": "Bitcoin for Corporations — Saylor & Dorsey",
                "duration": 12600
            },
            {
                "id": "ItvfKfYUd0c",
                "title": "BTC Prague 2025 — Michael Saylor FULL KEYNOTE",
                "duration": 3600
            },
            {
                "id": "yQL9yua9Yq0",
                "title": "Michael Saylor on Bitcoin: The Digital Transformation",
                "duration": 3600
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
                "id": "hrjBK6AXAMk",
                "title": "Take The Bitcoin Orange Pill — How To Guide",
                "duration": 1500
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
                "id": "nlvx2-3LUhM",
                "duration": 3600,
                "title": "Bitcoin Power Law Explained | SLP624"
            },
            {
                "id": "yhcbMUh3YTo",
                "title": "The Generational Bitcoin Price Run Begins",
                "duration": 1200
            },
            {
                "id": "_rMwlS1aHFs",
                "duration": 1800,
                "title": "The Physics of Bitcoins 10M Future"
            },
            {
                "id": "KR8EZo5IesE",
                "duration": 300,
                "title": "Tom Lee: Bitcoin to  Million Path"
            },
            {
                "id": "vjwFusEnfiE",
                "duration": 840,
                "title": "The Power Law Lens on Bitcoin - Santostasi"
            },
            {
                "id": "iww09Eeql_o",
                "title": "PlanB: Stock-to-Flow Model & Future Price Predictions",
                "duration": 1800
            },
            {
                "id": "lyTHPcHDOk8",
                "title": "Rational Root: Bitcoin Will Hit $600k then $6 Million",
                "duration": 1800
            },
            {
                "id": "6WdwTR_S2Ig",
                "duration": 900,
                "title": "Bitcoin Stock-To-Flow Model"
            },
            {
                "id": "BpKfLfGbf0Q",
                "title": "Bitcoin Hyperbitcoinization: $1.5M by 2028?",
                "duration": 1800
            },
            {
                "id": "wjObfPHlPOk",
                "duration": 900,
                "title": "Understanding S2F Live Charts"
            },
            {
                "id": "C9KPRcmFJWI",
                "title": "Bitcoin to $180K — Pomp Investments Prediction",
                "duration": 1500
            },
            {
                "id": "GzZecXEUJTI",
                "duration": 900,
                "title": "Realistically Reaching  Million"
            },
            {
                "id": "W3SKpO0q9QI",
                "title": "Roadmap To Crypto's $10 Trillion Market Cap — Ben Cowen",
                "duration": 1800
            },
            {
                "id": "hzeAkfnuBKo",
                "title": "PlanB: Bitcoin Will Hit $135k by Christmas! Stock-to-Flow Proof",
                "duration": 1200
            },
            {
                "id": "LU5RqsGwvBg",
                "duration": 600,
                "title": "Bitcoins Path to M: Schwab"
            },
            {
                "id": "jzY_SxnTLNA",
                "title": "Bitcoin Is the Economic Singularity — Luke Mikic",
                "duration": 2400
            },
            {
                "id": "IWUEPFAHksc",
                "title": "Bitcoin Bull Market Support Band — Benjamin Cowen",
                "duration": 1200
            },
            {
                "id": "qX2fbQgxJig",
                "title": "Why Bitcoin Could Reach $64M — Luke Mikic",
                "duration": 3600
            },
            {
                "id": "LkmVUMRh9vo",
                "title": "Bitcoin: Where In The Cycle Are We? — Benjamin Cowen",
                "duration": 1800
            },
            {
                "id": "3DijExIkark",
                "title": "Bitcoin On-Chain Analysis: MVRV Z-Score Explained",
                "duration": 1200
            },
            {
                "id": "tPQs6eQ4zIU",
                "duration": 900,
                "title": "Stock to Flow - Prediciting Price?"
            },
            {
                "id": "bPYl1-KBE50",
                "title": "The Ultimate Orange Pill — Bitcoin & Risk",
                "duration": 900
            },
            {
                "id": "Bh7LBF9cU6w",
                "duration": 900,
                "title": "Plan B Model Will Break in 2026"
            },
            {
                "id": "uF6Wx4Hr6iU",
                "title": "Tom Lee: Bullish Bitcoin Outlook & Corporate Treasuries — Coin Stories",
                "duration": 1800
            },
            {
                "id": "3-vBBYEXv6M",
                "title": "Saylor: Bitcoin as Apex Capital Strategy in the AI Age",
                "duration": 2100
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
                "id": "JLuTDwclOP0",
                "title": "The Resilience of Stock-to-Flow with PlanB — Bitcoin Standard Podcast",
                "duration": 3600
            },
            {
                "id": "93dyVDxP7K0",
                "title": "Bitcoin Logarithmic Regression",
                "duration": 1200
            },
            {
                "id": "Z51vRLKvco4",
                "title": "Retiring on 0.1 Bitcoin — Luke Mikic",
                "duration": 1800
            },
            {
                "id": "XW1GUeBe0Rs",
                "duration": 7200,
                "title": "The Bitcoin Power Law WiM509"
            },
            {
                "id": "yM06uqse6Ks",
                "duration": 3600,
                "title": "The Science Behind M Bitcoin"
            },
            {
                "id": "wOi9XqeJy2E",
                "title": "Cathie Wood — New 2025 Prediction for Bitcoin & Ethereum",
                "duration": 900
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
                "id": "f-4Rs3Sqlhc",
                "title": "Complete History of Bitcoin in 12 Minutes",
                "duration": 720
            },
            {
                "id": "FAYmE5-40PQ",
                "title": "Coldcard Bitcoin Hardware Wallet — FULL TUTORIAL (BTC Sessions)",
                "duration": 3600
            },
            {
                "id": "TpwnoPUyumA",
                "title": "Phoenix Wallet Setup — Self-Custody Lightning Made Easy",
                "duration": 1500
            },
            {
                "id": "Y3iAwLG6NlA",
                "title": "Bitcoin Wallets That Change Everything in 2026 — BTC Sessions",
                "duration": 1200
            },
            {
                "id": "rKjce1jCxSM",
                "title": "Bitcoin Beginner Mistakes to Avoid",
                "duration": 780
            },
            {
                "id": "dCAr2urEe1o",
                "title": "ENTROPIA — Generate Permissionless Bitcoin Wallets",
                "duration": 900
            },
            {
                "id": "oj_W3xOlt6U",
                "title": "Cracking Unsafe Bitcoin Wallets + Coldcard Mk4 Warning",
                "duration": 1800
            },
            {
                "id": "bBC-nXj3Ng4",
                "title": "How Bitcoin Works Under the Hood",
                "duration": 1320
            },
            {
                "id": "4Lsr7lsy6Tk",
                "title": "How to Set Up a Bitcoin Node at Home",
                "duration": 1800
            },
            {
                "id": "Sxo169CCfIc",
                "title": "How To Use Multisig Bitcoin Wallets With Electrum",
                "duration": 1800
            },
            {
                "id": "xhDQT4TeNIU",
                "title": "Perfect Privacy with eNuts: Instant Free Bitcoin Transactions",
                "duration": 900
            },
            {
                "id": "tuUO-Q4_b5c",
                "title": "How to Buy Bitcoins in 2024 (4 Methods Reviewed)",
                "duration": 900
            },
            {
                "id": "O1KaAboPX44",
                "title": "How To Buy Bitcoin For Beginners — Step by Step",
                "duration": 600
            },
            {
                "id": "3Grj3Datdfw",
                "title": "Game-Changing Bitcoin Wallet (Cove) — BTC Sessions",
                "duration": 1600
            },
            {
                "id": "vPMUGP3Opy8",
                "title": "The PERFECT Bitcoin Security and Privacy Setup!",
                "duration": 1800
            },
            {
                "id": "Gc2en3nHxA4",
                "title": "What is Bitcoin — Simply Explained",
                "duration": 540
            },
            {
                "id": "El3y8AME8oA",
                "title": "Bitcoin Explained — Breaking It Down Simply",
                "duration": 900
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
                "id": "lHipE05v4jg",
                "title": "How Bitcoin Works — Complete Beginner Guide",
                "duration": 1200
            },
            {
                "id": "ZZKoSmQu30Q",
                "title": "Best Hardware Wallet Comparison 2025 — BTC Sessions",
                "duration": 3621
            },
            {
                "id": "Ner16UBWdEg",
                "title": "Bitcoin in 2025 — What You Need to Know",
                "duration": 600
            },
            {
                "id": "OZK5hdKfb18",
                "title": "Bitcoin Security Best Practices",
                "duration": 900
            },
            {
                "id": "GR-E0aaFf0c",
                "title": "Bitcoin Explained for Complete Beginners",
                "duration": 600
            },
            {
                "id": "mibKrTvtlyQ",
                "title": "Misty Breez Bitcoin Wallet Setup — BTC Sessions",
                "duration": 900
            },
            {
                "id": "lhzooru_B-o",
                "duration": 36000,
                "title": "10 Hours of Bitcoin Tutorials: Node & Wallet Setup"
            },
            {
                "id": "KNaOeLlD6NA",
                "title": "Build Your Own Bitcoin Node with Umbrel — Raspberry Pi",
                "duration": 1200
            },
            {
                "id": "6b0xTB2sE8E",
                "title": "Bull Bitcoin Wallet Full Tutorial — BTC Sessions",
                "duration": 5500
            },
            {
                "id": "c8ytiynbnpk",
                "title": "Your First Bitcoin Wallet — BTC Sessions",
                "duration": 1500
            },
            {
                "id": "LxTkLwpV1Po",
                "title": "Permissionless Bitcoin Wallets — They Cannot Be Stopped!",
                "duration": 1200
            },
            {
                "id": "41JCpzvnn_0",
                "title": "Bitcoin for Beginners — 99Bitcoins",
                "duration": 720
            },
            {
                "id": "yJpvfRl03Tw",
                "title": "How To Use Sparrow Bitcoin Wallet — In Depth Tutorial (BTC Sessions)",
                "duration": 2400
            },
            {
                "id": "8zM_1lOXtBU",
                "title": "Bitcoin 2-of-4 Multisig Wallet Tutorial Using Sparrow Wallet",
                "duration": 1800
            },
            {
                "id": "cRRB_WzZpTM",
                "title": "BIP85: Segregated Bitcoin Accounts From One Seed (Uncle Jim Mode)",
                "duration": 1200
            },
            {
                "id": "3QH7ZTibV-Q",
                "title": "How to Buy Bitcoin (in 2 minutes) — 2024 Updated",
                "duration": 120
            },
            {
                "id": "vmf_LtnagTs",
                "title": "Bitcoin Cold Storage Tutorial",
                "duration": 1200
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
    // Prefer auth UID (Fix L-NEW-2)
    var auth = typeof firebase !== 'undefined' ? firebase.auth() : null;
    if (auth && auth.currentUser) return auth.currentUser.uid;

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
var _ytPlayer = null;
var _currentVideoId = null;
var _syncInterval = null;
var _apiReady = false;
var _apiFailed = false;
var _apiRetries = 0;
var _API_MAX_RETRIES = 25; // ~5 seconds (25 * 200ms)

// Load YT API once
(function loadYTApi() {
    if (window.YT && window.YT.Player) { _apiReady = true; return; }
    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = function() { _apiFailed = true; console.warn('[TCTV] YouTube API failed to load, using iframe fallback'); };
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    window.onYouTubeIframeAPIReady = function() { _apiReady = true; };
})();

function loadVideoFallback(videoId, startSeconds) {
    var wrap = document.getElementById('tctv-video-container');
    if (!wrap) return;
    var old = document.getElementById('tctv-player');
    if (old) old.remove();
    var iframe = document.createElement('iframe');
    iframe.id = 'tctv-player';
    iframe.style.cssText = 'width:100%;height:100%;border:none;';
    iframe.setAttribute('allow', 'autoplay; encrypted-media');
    iframe.setAttribute('allowfullscreen', '');
    iframe.src = 'https://www.youtube.com/embed/' + videoId +
        '?start=' + Math.floor(startSeconds) +
        '&autoplay=1&controls=1&modestbranding=1&rel=0' +
        '&showinfo=0&iv_load_policy=3&playsinline=1&wmode=opaque&mute=0';
    wrap.appendChild(iframe);
}

function loadVideo(videoId, startSeconds) {
    _currentVideoId = videoId;
    
    if (_ytPlayer && _ytPlayer.destroy) {
        try { _ytPlayer.destroy(); } catch(e) {}
        _ytPlayer = null;
    }

    // Create placeholder if needed
    var wrap = document.getElementById('tctv-video-container');
    if (!wrap) return;
    
    // Clear old player/iframe manually to be sure
    var old = document.getElementById('tctv-player');
    if (old) old.remove();

    // If API failed or timed out, use plain iframe fallback
    if (_apiFailed) {
        loadVideoFallback(videoId, startSeconds);
        return;
    }

    if (!_apiReady) {
        _apiRetries++;
        if (_apiRetries > _API_MAX_RETRIES) {
            console.warn('[TCTV] YouTube API timed out after ' + _API_MAX_RETRIES + ' retries, falling back to iframe');
            _apiFailed = true;
            loadVideoFallback(videoId, startSeconds);
            return;
        }
        // Create a temporary placeholder div while waiting
        var tmpDiv = document.createElement('div');
        tmpDiv.id = 'tctv-player';
        wrap.appendChild(tmpDiv);
        setTimeout(function() { loadVideo(videoId, startSeconds); }, 200);
        return;
    }
    
    _apiRetries = 0; // Reset on success
    var playerDiv = document.createElement('div');
    playerDiv.id = 'tctv-player';
    wrap.appendChild(playerDiv);

    _ytPlayer = new YT.Player('tctv-player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
            'autoplay': 1,
            'controls': 1,
            'modestbranding': 1,
            'rel': 0,
            'showinfo': 0,
            'iv_load_policy': 3,
            'playsinline': 1,
            'start': Math.floor(startSeconds)
        },
        events: {
            'onStateChange': onPlayerStateChange,
            'onReady': function(event) {
                event.target.playVideo();
            }
        }
    });
}

function onPlayerStateChange(event) {
    if (_apiFailed || typeof YT === 'undefined') return;
    var syncBtn = document.getElementById('tctv-sync-btn');
    var overlay = document.getElementById('tctv-pause-overlay');
    
    // User paused video manually
    if (event.data === YT.PlayerState.PAUSED && !_isPaused) {
        if (overlay) overlay.style.display = 'flex';
        var p = document.getElementById('tctv-player');
        if (p) p.style.opacity = '0.3';
    } 
    
    // User resumed video
    if (event.data === YT.PlayerState.PLAYING) {
        if (overlay) overlay.style.display = 'none';
        var p = document.getElementById('tctv-player');
        if (p) p.style.opacity = '1';
        
        // Check for time drift (seek)
        checkDrift();
    }

    // Video ended — advance to next video immediately
    if (event.data === YT.PlayerState.ENDED) {
        _advanceToNextVideo();
    }
}

// Advance to the next scheduled video on the current station
function _advanceToNextVideo() {
    if (_isPaused || !_currentStation) return;
    var station = STATIONS.find(function(s) { return s.id === _currentStation; });
    if (!station) return;
    var state = getPlaybackState(station);
    if (!state.video) return;

    // Update NOW PLAYING text
    var np = document.getElementById('tctv-now-playing');
    if (np) {
        np.textContent = state.video.title;
        np.setAttribute('data-current-vid', state.video.id);
    }
    _updateChNum();

    // Reuse existing YT player if possible (avoids autoplay restrictions)
    if (!_apiFailed && _ytPlayer && _ytPlayer.loadVideoById) {
        _currentVideoId = state.video.id;
        _ytPlayer.loadVideoById({
            videoId: state.video.id,
            startSeconds: Math.floor(state.offset)
        });
        var syncBtn = document.getElementById('tctv-sync-btn');
        if (syncBtn) syncBtn.style.display = 'none';
        return;
    }

    // Fallback: full reload (iframe path or no player)
    _currentVideoId = state.video.id;
    loadVideo(state.video.id, state.offset);
}

function checkDrift() {
    if (_apiFailed || !_ytPlayer || !_ytPlayer.getCurrentTime || !window._currentStation || _isPaused) return;
    var station = STATIONS.find(function(s) { return s.id === _currentStation; });
    var state = getPlaybackState(station);
    var currentTime = _ytPlayer.getCurrentTime();
    
    // If user is more than 5 seconds away from "live", show sync button
    var drift = Math.abs(currentTime - state.offset);
    var syncBtn = document.getElementById('tctv-sync-btn');
    if (syncBtn) {
        syncBtn.style.display = (drift > 5) ? 'inline-block' : 'none';
    }
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
    if (typeof window.nachoPlaySound === 'function') window.nachoPlaySound('tctv-beep');
    _isPaused = !_isPaused;
    var btn = document.getElementById('remote-pause-btn');
    var btn2 = document.getElementById('remote-pause-btn-inline');
    var p = document.getElementById('tctv-player');
    var overlay = document.getElementById('tctv-pause-overlay');
    var syncBtn = document.getElementById('tctv-sync-btn');
    
    if (_isPaused) {
        if (btn) btn.textContent = '▶';
        if (btn2) btn2.textContent = '▶';
        if (overlay) overlay.style.display = 'flex';
        if (_ytPlayer && _ytPlayer.pauseVideo) _ytPlayer.pauseVideo();
        if (p) p.style.opacity = '0.3';
    } else {
        if (btn) btn.textContent = '⏸';
        if (btn2) btn2.textContent = '⏸';
        if (overlay) overlay.style.display = 'none';
        if (p) p.style.opacity = '1';
        if (syncBtn) syncBtn.style.display = 'inline-block';
        if (_ytPlayer && _ytPlayer.playVideo) _ytPlayer.playVideo();
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

// Couch Nacho collapse/restore
window.tctvToggleCouch = function() {
    var couch = document.getElementById('nacho-couch');
    var restoreBtn = document.getElementById('nacho-couch-restore');
    if (couch) couch.style.display = 'none';
    if (restoreBtn) restoreBtn.style.display = 'flex';
};

window.tctvRestoreCouch = function() {
    var couch = document.getElementById('nacho-couch');
    var restoreBtn = document.getElementById('nacho-couch-restore');
    if (couch) couch.style.display = 'block';
    if (restoreBtn) restoreBtn.style.display = 'none';
};

window.tctvDismissAd = function() {
    var ad = document.getElementById('tctv-ad-sidebar');
    if (ad) { ad.style.visibility = 'hidden'; ad.style.width = '0'; ad.style.overflow = 'hidden'; }
    try { localStorage.setItem('tctv_ad_dismissed', '1'); } catch(e) {}
};

// Hide sprite Nacho when entering TCTV, restore on exit
window._tctvSpriteWasVisible = false;
window._tctvHideSpriteNacho = function() {
    var c = document.getElementById('nacho-container');
    if (c) {
        window._tctvSpriteWasVisible = !c.classList.contains('hidden');
        c.classList.add('hidden');
        c.style.display = 'none';
    }
};
window._tctvRestoreSpriteNacho = function() {
    var c = document.getElementById('nacho-container');
    if (c && window._tctvSpriteWasVisible) {
        c.style.display = '';
        c.classList.remove('hidden');
    }
};

// Couch Nacho drag (mobile touch)
(function() {
    var _dragging = false, _startX = 0, _startY = 0, _origLeft = 0, _origBottom = 0;
    document.addEventListener('touchstart', function(e) {
        var couch = document.getElementById('nacho-couch');
        if (!couch || 'none' === couch.style.display) return;
        var inner = document.getElementById('nacho-couch-inner');
        if (!inner || !inner.contains(e.target)) return;
        if (e.target.tagName === 'BUTTON') return;
        _dragging = true;
        _startX = e.touches[0].clientX;
        _startY = e.touches[0].clientY;
        var rect = couch.getBoundingClientRect();
        _origLeft = rect.left;
        _origBottom = window.innerHeight - rect.bottom;
        couch.style.transition = 'none';
    }, { passive: true });
    document.addEventListener('touchmove', function(e) {
        if (!_dragging) return;
        var couch = document.getElementById('nacho-couch');
        if (!couch) return;
        var dx = e.touches[0].clientX - _startX;
        var dy = e.touches[0].clientY - _startY;
        couch.style.left = (_origLeft + dx) + 'px';
        couch.style.bottom = (_origBottom - dy) + 'px';
        couch.style.right = 'auto';
    }, { passive: true });
    document.addEventListener('touchend', function() {
        if (!_dragging) return;
        _dragging = false;
        var couch = document.getElementById('nacho-couch');
        if (couch) couch.style.transition = '0.3s';
    });
})();

function _updateChNum() {
    var chEl = document.getElementById('tctv-now-ch');
    if (!chEl || !_currentStation) return;
    var idx = STATIONS.findIndex(function(s) { return s.id === _currentStation; });
    chEl.textContent = idx >= 0 ? 'CH. ' + (idx + 1) : '';
}

function syncPlayer() {
    if (!_currentStation) return;
    var station = STATIONS.find(function(s) { return s.id === _currentStation; });
    if (!station) return;
    var state = getPlaybackState(station);
    if (!state.video) return;
    
    var np = document.getElementById('tctv-now-playing');
    if (np) {
        np.textContent = state.video.title;
        np.setAttribute('data-current-vid', state.video.id);
    }
    
    loadVideo(state.video.id, state.offset);
    _updateChNum();
    
    var syncBtn = document.getElementById('tctv-sync-btn');
    if (syncBtn) syncBtn.style.display = 'none';
}

// ── Timeline & Moving EPG ──
function updateTimeline() {
    if (!_currentStation) return;
    var nowMs = Date.now();
    var station = STATIONS.find(function(s) { return s.id === _currentStation; });
    var state = getPlaybackState(station);

    var np = document.getElementById('tctv-now-playing');
    if (np && state.video && np.getAttribute('data-current-vid') !== state.video.id) {
        np.textContent = state.video.title;
        np.setAttribute('data-current-vid', state.video.id);
    }

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
        _advanceToNextVideo();
    }

    // Periodic drift check
    if (!_isPaused && Date.now() % 5000 < 1000) {
        checkDrift();
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
                    html += '<div data-vid-id="' + s.id + '-' + tempIdx + '" title="' + vid.title.replace(/"/g, '&quot;') + '" style="position:absolute;left:' + leftPx + 'px;top:6px;height:42px;width:' + (widthPx - 4) + 'px;background:' + bg + ';border:1px solid ' + br + ';border-radius:4px;display:flex;align-items:center;padding:0 8px;overflow:hidden;cursor:pointer;">';
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
    if (typeof _tctvHideSpriteNacho === 'function') _tctvHideSpriteNacho();
    
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
        @media (min-width: 901px) {
            #tctv-ad-sidebar.desktop-only, #tctv-remote-sidebar.desktop-only { display: block !important; }
            #tctv-remote, .tctv-mobile-ui-stack { display: none !important; }
        }
        @media (max-width: 900px) {
            #tctv-ad-sidebar, #tctv-remote-sidebar { display: none !important; }
            #tctv-remote, .tctv-mobile-ui-stack { display: flex !important; flex-direction: column; }
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
            #tctv-remote-sidebar { display: none !important; }
            #tctv-remote { position: fixed !important; top: 160px !important; right: 0px !important; width: 80px !important; height: auto !important; flex-direction: column !important; justify-content: center; padding: 15px 10px !important; border-radius: 20px 0 0 20px !important; border: 3px solid #111 !important; box-shadow: 0 10px 40px rgba(0,0,0,0.8) !important; display: flex !important; z-index: 200000 !important; transition: transform 0.3s ease !important; }
            #tctv-remote.collapsed { transform: translateX(75px) !important; opacity: 1 !important; }
            
            .remote-btn { width: 44px !important; height: 44px !important; font-size: 1.2rem !important; box-shadow: 0 4px 0 #111 !important; }
            .remote-label { display: block !important; margin: 0 !important; }
            .remote-input { width: 44px !important; font-size: 0.9rem !important; }
            
            #nacho-couch { position: fixed; bottom: 140px; left: 20px; display: block !important; width: auto !important; padding: 0 !important; background: transparent !important; border: none !important; z-index: 200000 !important; height: auto !important; }
            #nacho-couch > div { height: 160px !important; transform: scale(1) !important; }
            
            /* Fix guest sign-up banner visibility */
            #guestPointsBanner { z-index: 300000 !important; }
            
            /* Make video larger on mobile */
            .tctv-video-wrap { max-width: 100% !important; width: 100% !important; flex: none !important; }
            #tctv-video-container { max-height: 50vh !important; border-radius: 0 !important; }
            #tctv-player { max-height: 50vh !important; }
        }
        @keyframes nachoSway { 0%, 100% { transform: rotate(-1deg) translateY(0); } 50% { transform: rotate(1deg) translateY(-5px); } }
    `;
    document.head.appendChild(style);

    var html = '<div style="background:#0a0a0a;min-height:100vh;color:#fff;font-family:inherit;">';
    
    html += '<div style="position:sticky;top:0;z-index:100;background:#0a0a0a;">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#111;border-bottom:1px solid rgba(247,147,26,0.3);"><div onclick="goHome()" style="cursor:pointer;display:flex;align-items:center;gap:8px;"><span style="color:var(--text-muted);font-size:0.8rem;">←</span><span style="color:#f7931a;font-weight:900;font-size:1rem;letter-spacing:2px;">TIMECHAIN TV</span></div><div style="display:flex;align-items:center;gap:6px;"><span id="tctv-main-viewers" style="font-size:0.7rem;color:#22c55e;font-weight:600;"></span><span style="width:8px;height:8px;background:#ef4444;border-radius:50%;display:inline-block;box-shadow:0 0 6px #ef4444;"></span><span style="color:#ef4444;font-size:0.7rem;font-weight:800;letter-spacing:1px;">LIVE</span></div></div>';
    // Desktop: side-by-side layout with couch left, video center, remote right
    html += '<div style="display:flex;align-items:center;justify-content:center;gap:10px;background:#0a0a0a;padding:10px;">';
    // Left side - TCTV Ad (desktop only, dismissible)
    var _tctvAdDismissed = false;
    try { _tctvAdDismissed = localStorage.getItem('tctv_ad_dismissed') === '1'; } catch(e) {}
    html += '<div id="tctv-ad-sidebar" style="flex:0 0 auto;display:none;' + (_tctvAdDismissed ? 'visibility:hidden;width:0;overflow:hidden;' : '') + '" class="desktop-only">' +
            '<div style="position:relative;width:140px;padding:12px;background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.15);border-radius:12px;text-align:center;">' +
            '<button onclick="tctvDismissAd()" style="position:absolute;top:4px;right:4px;width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,0.08);border:1px solid #333;color:#666;font-size:0.6rem;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;" title="Dismiss">✕</button>' +
            '<div style="font-size:1.5rem;margin-bottom:6px;">📺</div>' +
            '<div style="font-size:0.65rem;color:#ccc;font-weight:600;line-height:1.4;">Get your YouTube channel streaming on Timechain TV 24/7!</div>' +
            '<div style="margin-top:8px;font-size:0.6rem;color:#f7931a;font-weight:700;">Inquire at:</div>' +
            '<a href="mailto:info.603btc@gmail.com" style="font-size:0.55rem;color:#aaa;text-decoration:none;word-break:break-all;" onmouseover="this.style.color=\'#f7931a\'" onmouseout="this.style.color=\'#aaa\'">info.603btc@gmail.com</a>' +
            '</div></div>';
    // Center - Video player (narrower on desktop, full width on mobile)
    html += '<div style="flex:1 1 auto;max-width:calc(100% - 150px);min-width:0;" class="tctv-video-wrap">' +
            '<div style="position:relative;aspect-ratio:16/9;max-height:45vh;max-width:1100px;margin:0 auto;background:#000;overflow:hidden;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.5);" id="tctv-video-container">' +
            '<div id="tctv-pause-overlay" style="position:absolute;inset:0;bottom:48px;background:rgba(0,0,0,0.9);z-index:5;display:none;align-items:center;justify-content:center;flex-direction:column;gap:15px;pointer-events:none;">' +
                '<div style="font-size:3rem;animation:pulse 2s infinite;">🎬</div>' +
                '<div style="color:#f7931a;font-weight:900;letter-spacing:2px;">STANDBY</div>' +
                '<button onclick="tctvRemotePause()" style="background:var(--accent);color:#fff;border:none;padding:12px 24px;border-radius:12px;font-weight:800;cursor:pointer;pointer-events:auto;">JUMP TO LIVE</button>' +
            '</div>' +
            '<div id="tctv-sync-btn" style="position:absolute;bottom:60px;right:20px;display:none;z-index:6;">' +
                '<button onclick="syncPlayer()" style="background:#f7931a;color:#000;border:none;padding:8px 16px;border-radius:20px;font-weight:900;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.5);">⚡ JUMP TO LIVE</button>' +
            '</div>' +
            '<div id="tctv-player"></div>' +
            '</div></div>';
    // Right side - Remote (desktop only, inside layout flow)
    html += '<div id="tctv-remote-sidebar" style="flex:0 0 auto;display:none;" class="desktop-only">' +
            '<div id="tctv-remote-inline" class="collapsed" style="width:80px;background:#222;border:3px solid #111;border-radius:20px;padding:15px 10px;box-shadow:0 10px 40px rgba(0,0,0,0.8),inset 0 2px 5px rgba(255,255,255,0.1);display:flex;flex-direction:column;gap:12px;align-items:center;">' +
            '<div onclick="tctvToggleRemote()" style="width:30px;height:5px;background:#444;border-radius:3px;cursor:pointer;margin-bottom:5px;"></div>' +
            // PWR Button (Red, returns to Home)
            '<button class="remote-btn red" onclick="goHome()" id="remote-pwr-btn-inline" title="Power OFF">⏻</button><span class="remote-label">PWR</span>' +
            '<div style="background:#1a1a1a;border-radius:12px;padding:8px 4px;display:flex;flex-direction:column;gap:10px;">' +
                '<button class="remote-btn" onclick="tctvRemoteChannel(1)">▲</button>' +
                '<span class="remote-label" style="margin:0">CH</span>' +
                '<button class="remote-btn" onclick="tctvRemoteChannel(-1)">▼</button>' +
            '</div>' +
            // Bottom Controls (Pause and Back)
            '<div style="display:flex;flex-direction:column;gap:8px;align-items:center;">' +
                '<button class="remote-btn blue" style="border-radius:10px;font-size:1.1rem;" onclick="tctvRemotePause()" id="remote-pause-btn-inline" title="Pause/Play">⏸</button>' +
                '<button class="remote-btn blue" style="border-radius:10px;font-size:0.7rem;font-weight:900;" onclick="tctvRemoteBack()">BACK</button>' +
            '</div>' +
            '</div></div>';
    html += '</div>';
    html += '<div style="padding:10px 16px;background:#161616;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center;"><div style="flex:1;min-width:0;"><div style="font-size:0.65rem;color:#f7931a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">NOW PLAYING <span id="tctv-now-ch" style="color:#aaa;"></span></div><div id="tctv-now-playing" style="font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#ddd;">Loading...</div></div>' +
            '<div style="display:flex;align-items:center;gap:8px;"><button onclick="syncPlayer()" id="tctv-sync-btn" style="background:#ef4444;border:none;color:#fff;font-size:0.6rem;font-weight:900;padding:4px 8px;border-radius:4px;cursor:pointer;animation:pulse 2s infinite;display:none;">JUMP TO LIVE</button><div id="tctv-time-left" style="font-size:0.75rem;color:#888;font-weight:600;flex-shrink:0;font-variant-numeric:tabular-nums;"></div></div></div>';
    html += '<div style="height:3px;background:#222;"><div id="tctv-progress" style="height:100%;background:#f7931a;width:0%;transition:width 1s linear;"></div></div></div>';

    // Mobile Lounge & Remote Area (Stays sticky/fixed on desktop, injected here for mobile flow)
    html += '<div class="tctv-mobile-ui-stack">';
    
    // Nacho on Couch (with drag + collapse)
    html += '<div id="nacho-couch">' +
            '<div id="nacho-couch-inner" style="position:relative;width:240px;height:140px;display:flex;align-items:center;justify-content:center;pointer-events:auto;">' +
            '<span style="font-size:7rem;position:absolute;bottom:0;filter:drop-shadow(0 10px 20px rgba(0,0,0,0.5));">🛋️</span>' +
            '<div style="position:absolute;bottom:35px;left:70px;transition:0.3s;animation:nachoSway 4s ease-in-out infinite;">' +
            '<img src="nacho-deer.svg" style="width:75px;height:75px;">' +
            '<span style="position:absolute;bottom:0;right:-4px;font-size:2rem;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3));">🍿</span>' +
            '<span style="position:absolute;top:-25px;right:-30px;background:white;color:black;padding:4px 10px;border-radius:12px;font-size:0.7rem;font-weight:700;box-shadow:0 4px 10px rgba(0,0,0,0.2);white-space:nowrap;animation:pulse 3s infinite;">Chill vibes... 📺🍿</span>' +
            '</div>' +
            '<button onclick="tctvToggleCouch()" style="position:absolute;top:-8px;right:-8px;width:24px;height:24px;border-radius:50%;background:#333;border:1px solid #555;color:#aaa;font-size:0.7rem;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5;">✕</button>' +
            '</div></div>' +
            '<button id="nacho-couch-restore" onclick="tctvRestoreCouch()" style="display:none;position:fixed;bottom:140px;left:8px;z-index:200000;width:40px;height:40px;border-radius:50%;background:#222;border:2px solid #f7931a;cursor:pointer;font-size:1.3rem;box-shadow:0 4px 15px rgba(0,0,0,0.5);">🦌</button>';

    // Remote (Mobile stacked flow)
    html += '<div id="tctv-remote" class="collapsed">' +
            '<div onclick="tctvToggleRemote()" style="width:30px;height:5px;background:#555;border-radius:3px;cursor:pointer;margin-bottom:5px;min-height:5px;"></div>' +
            // PWR Button (Red)
            '<button class="remote-btn red" onclick="goHome()" id="remote-pwr-btn" title="Power OFF">⏻</button>' +
            '<div style="background:#1a1a1a;border-radius:12px;padding:8px 4px;display:flex;flex-direction:row;align-items:center;gap:12px;">' +
                '<button class="remote-btn" onclick="tctvRemoteChannel(-1)">▼</button>' +
                '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
                    '<span style="color:#666;font-size:0.7rem;font-weight:900;">#</span>' +
                    '<input type="text" id="remote-ch-input" class="remote-input" placeholder="--" maxlength="2" onkeydown="if(event.key===\'Enter\')tctvDirectChannel(this.value)" inputmode="numeric">' +
                '</div>' +
                '<button class="remote-btn" onclick="tctvRemoteChannel(1)">▲</button>' +
            '</div>' +
            // Added Blue Pause button for mobile flow (horizontal layout)
            '<button class="remote-btn blue" style="border-radius:10px;font-size:1.1rem;" onclick="tctvRemotePause()" id="remote-pause-btn" title="Pause/Play">⏸</button>' +
            '<button class="remote-btn blue" style="border-radius:10px;font-size:0.7rem;font-weight:900;" onclick="tctvRemoteBack()">BACK</button>' +
            '</div>';
            
    html += '</div>'; // end mobile-ui-stack

    html += _renderEPG();
    html += '<div style="height:120px;"></div></div>';
    fc.innerHTML = html;

    // ── EPG Tooltip (mobile tap + desktop hover) ──
    (function() {
        var tip = document.createElement('div');
        tip.id = 'tctv-epg-tooltip';
        tip.style.cssText = 'position:fixed;z-index:9999;background:#111;color:#fff;font-size:0.75rem;padding:6px 10px;border-radius:6px;border:1px solid #333;pointer-events:none;opacity:0;transition:opacity 0.15s;max-width:280px;word-wrap:break-word;box-shadow:0 4px 12px rgba(0,0,0,0.6);white-space:normal;line-height:1.3;';
        document.body.appendChild(tip);
        var epgC = document.getElementById('tctv-epg-container');
        if (!epgC) return;
        var hideTimer = null;
        function showTip(el, e) {
            var t = el.getAttribute('title');
            if (!t) return;
            el.setAttribute('data-title', t);
            el.removeAttribute('title');
            tip.textContent = t;
            tip.style.opacity = '1';
            positionTip(e || el);
        }
        function positionTip(ref) {
            var r;
            if (ref.getBoundingClientRect) r = ref.getBoundingClientRect();
            else r = { left: ref.clientX || ref.touches[0].clientX, top: ref.clientY || ref.touches[0].clientY, width: 0, height: 0 };
            var x = (r.left || r.x) + (r.width || 0) / 2;
            var y = (r.top || r.y) - 8;
            tip.style.left = Math.min(x, window.innerWidth - 290) + 'px';
            tip.style.top = 'auto';
            tip.style.bottom = (window.innerHeight - y) + 'px';
        }
        function hideTip(el) {
            tip.style.opacity = '0';
            if (el && el.getAttribute('data-title')) {
                el.setAttribute('title', el.getAttribute('data-title'));
                el.removeAttribute('data-title');
            }
        }
        epgC.addEventListener('mouseover', function(e) {
            var bl = e.target.closest('[data-vid-id]');
            if (bl) showTip(bl, e);
        });
        epgC.addEventListener('mouseout', function(e) {
            var bl = e.target.closest('[data-vid-id]');
            if (bl) hideTip(bl);
        });
        var _activeTipEl = null;
        epgC.addEventListener('touchstart', function(e) {
            var bl = e.target.closest('[data-vid-id]');
            if (bl) {
                if (_activeTipEl === bl) { hideTip(bl); _activeTipEl = null; return; }
                if (_activeTipEl) hideTip(_activeTipEl);
                _activeTipEl = bl;
                showTip(bl, e.touches[0]);
                if (hideTimer) clearTimeout(hideTimer);
                hideTimer = setTimeout(function() { hideTip(bl); _activeTipEl = null; }, 3000);
            } else {
                if (_activeTipEl) { hideTip(_activeTipEl); _activeTipEl = null; }
            }
        }, { passive: true });
    })();

    _currentStation = activeStation;
    saveStation(activeStation);
    joinStation(activeStation);
    
    // Highlight initial station in EPG UI
    setTimeout(function() {
        var stationId = activeStation;
        document.querySelectorAll('[data-station-id]').forEach(function(el) {
            var isActive = el.getAttribute('data-station-id') === stationId;
            el.style.background = isActive ? 'rgba(247,147,26,0.12)' : 'transparent';
            var nameEl = el.querySelector('[data-ch-name]');
            if (nameEl) nameEl.style.color = isActive ? '#f7931a' : '#ccc';
        });
    }, 100);

    syncPlayer();
    if (_syncInterval) clearInterval(_syncInterval);
    _syncInterval = setInterval(updateTimeline, 1000);
    
    // Start Nacho reactions
    if (typeof startTctvReactions === 'function') startTctvReactions();
    
    // Ensure we are tracked as the current "channel" for the system's scroll/back logic
    window.currentChannelId = 'timechain-tv';
};

window.switchStation = function(stationId) {
    if (stationId === _currentStation) return;
    _lastStation = _currentStation;
    var stationObj = STATIONS.find(function(s) { return s.id === stationId; });
    
    var np = document.getElementById('tctv-now-playing');
    if (np) np.textContent = 'Tuning...';
    
    showChannelNoise(stationObj ? stationObj.emoji + ' ' + stationObj.name : '');
    _currentStation = stationId;
    saveStation(stationId);
    joinStation(stationId);
    var state = getPlaybackState(stationObj);
    if (state.video) {
        loadVideo(state.video.id, state.offset);
        // Update NOW PLAYING immediately with the new video title
        var np2 = document.getElementById('tctv-now-playing');
        if (np2) {
            np2.textContent = state.video.title;
            np2.setAttribute('data-current-vid', state.video.id);
        }
        _updateChNum();
    }
    document.querySelectorAll('[data-station-id]').forEach(function(el) {
        var isActive = el.getAttribute('data-station-id') === stationId;
        el.style.background = isActive ? 'rgba(247,147,26,0.12)' : 'transparent';
        var nameEl = el.querySelector('[data-ch-name]');
        if (nameEl) nameEl.style.color = isActive ? '#f7931a' : '#ccc';
    });
    
    // #3 Sound effect
    if (typeof window.nachoPlaySound === 'function') window.nachoPlaySound('tctv-beep');
    
    // #4 Pre-fetch next/prev
    try {
        var idx = STATIONS.findIndex(s => s.id === stationId);
        [STATIONS[(idx+1)%STATIONS.length], STATIONS[(idx-1+STATIONS.length)%STATIONS.length]].forEach(s => {
            if (s.file && (!V[s.id] || Date.now() - (V[s.id].ts||0) > 3600000)) {
                fetch(s.file).then(r => r.json()).then(d => { d.ts=Date.now(); V[s.id]=d; });
            }
        });
    } catch(e) {}
};

// #5 Nacho Reactions
var _tctvReactionInterval = null;
function startTctvReactions() {
    if (_tctvReactionInterval) clearInterval(_tctvReactionInterval);
    _tctvReactionInterval = setInterval(function() {
        if (window.currentPage !== 'timechain-tv') return;
        var s = STATIONS.find(st => st.id === _currentStation);
        if (!s) return;
        var q = [
            "This " + s.name + " channel is legit! 🍿",
            "Mmm... freshly popped corn and Bitcoin knowledge! ⚡",
            "Proof of Steak? No, I prefer Proof of Popcorn! 🥩🍿",
            "The blockchain is looking extra HARD today! 🛡️"
        ];
        if (s.id === 'saylor') q.push("Saylor really knows how to channel that energy! ⚡");
        var msg = q[Math.floor(Math.random()*q.length)];
        if (typeof forceShowBubble === 'function') {
            forceShowBubble(msg, 'cheese');
            setTimeout(() => { if (typeof hideBubble === 'function') hideBubble(true); }, 7000);
        }
    }, 600000); // 10 mins
}

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
    if (_tctvReactionInterval) { clearInterval(_tctvReactionInterval); _tctvReactionInterval = null; }
    if (_viewerUnsub) { _viewerUnsub(); _viewerUnsub = null; }
    var iframe = document.getElementById('tctv-player');
    if (iframe) iframe.src = '';
    _currentVideoId = null;
    window._tctvActive = false;
    var s = document.getElementById('tctv-remote-styles');
    if (s) s.remove();
    if (typeof _tctvRestoreSpriteNacho === 'function') _tctvRestoreSpriteNacho();
    // Remove tooltip if lingering
    var tip = document.getElementById('tctv-epg-tooltip');
    if (tip) tip.remove();
};

})();
