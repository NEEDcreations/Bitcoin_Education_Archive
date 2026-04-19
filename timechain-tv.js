
(function() {
'use strict';

var STATIONS = [
    {
        "id": "ai-nostr",
        "name": "AI, Nostr & Decentralized Web",
        "emoji": "⚡",
        "desc": "Nostr, value4value, AI x Bitcoin, censorship-resistant networks",
        "color": "#22d3ee",
        "videos": [
            {"id":"qn-Zp491t4Y","title":"How To Use NOSTR - A Decentralized Censorship Resistant Social Layer","duration":4433},
            {"id":"0YDj1QdL2Zs","title":"Jack Dorsey explains how Nostr works in 2 minutes","duration":140},
            {"id":"Czkv54pQfTI","title":"How To Get Started With Nostr","duration":415},
            {"id":"XUsk7cqZyKU","title":"Nostr Past, Present, and Future","duration":2881},
            {"id":"NVm_jGdwTjQ","title":"Nostr for Beginners w/ Derek Ross","duration":2243},
            {"id":"fG1IDm-lQek","title":"Damus For NOSTR - Tutorial","duration":3672},
            {"id":"Q6f6bdKWqF8","title":"Nostr Explained! The Social Network That Can’t Be CENSORED!","duration":545},
            {"id":"zteh-aHb4cM","title":"WATCH This Before Starting Nostr (Safety and Privacy Tips!!)","duration":434},
            {"id":"lj0zzGpQ6mc","title":"What is Nostr? A simple explanation.","duration":108},
            {"id":"PWKd9aoZ-Cg","title":"The Past & Future Of DMs And Private Group Chats On Nostr","duration":1782},
            {"id":"rpc15bNDX-s","title":"Nostr Protocol Overview & Damus App Tutorial","duration":1494},
            {"id":"-EhXdsJr8Hw","title":"NOSTR Explained for Beginners ⚡️✨","duration":1429},
            {"id":"u_U2obseVwY","title":"How to Start with Nostr Today | Presentation","duration":316},
            {"id":"Q7Q4IcwVDjY","title":"What is Nostr? The New Decentralized Network","duration":60},
            {"id":"FYbQLja9Oe8","title":"What are \"zaps\" in Nostr/Damus? ⚡️","duration":225},
            {"id":"fEXa-dBClN0","title":"Is This the New Industrial Revolution? AI, NOSTR & Bitcoin Lightning | Roland from Alby Hub","duration":3666},
            {"id":"G0FmzKp1CRk","title":"strfry: An Efficient Server for the Nostr Protocol - Doug Hoyte - CppNorth 2023","duration":3108},
            {"id":"Opio9Ny8HT8","title":"Apple to REMOVE Nostr Client from App Store #bitcoin #nostr #shorts","duration":61},
            {"id":"8mSyMCJlSwA","title":"Nostr: A simple, open protocol enabling global, decentralized, and censorship-resistant social media","duration":3147},
            {"id":"Ua64ymE6KQ0","title":"Bitcoin and Nostr w/ Jack Mallers and Miljan","duration":2015},
            {"id":"S6y2Vy2N9oY","title":"NOSTR TOOLKIT: Linking To Your Own Lightning Node With Voltage","duration":4370},
            {"id":"gLV8i8KtkfI","title":"S15 E21: Fiatjaf on Nostr, Drivechains & Why Lightning Sucks","duration":6880},
            {"id":"VrHoprrAops","title":"How to Earn Bitcoin on Nostr with Primal (from Day 1) #bitcoin #nostr #primal #socialmedia","duration":369},
            {"id":"-9IoQCeCaqU","title":"How to receive nostr zaps to your own node - Voltage Nostr toolkit walkthrough","duration":317},
            {"id":"Eu0rNhmENXQ","title":"NOSTR Workshop w/Sebastian Hagens (Sebastix)","duration":1809},
            {"id":"ElTSvRbltyg","title":"Nostr Polls on Amethyst, NIP69 demo","duration":132},
            {"id":"LNJ4qSyxDqY","title":"Building NOSTR with Damus & Zaps Creator Will Casarin (BWP57)","duration":4669},
            {"id":"yIccRIEr2gQ","title":"Nostr Explained Visually for Beginners","duration":985},
            {"id":"2qBsSP6a2z4","title":"Playing around on the new Damus App! (Decentralized Twitter Clone for Nostr)","duration":233},
            {"id":"tj9DnTV_avA","title":"Nostr App Damus Review & Tutorial - Decentralized Social Media","duration":722},
            {"id":"x2M9d-Qg6xs","title":"[log 00003] Damus Web - A Nostr Client","duration":470},
            {"id":"arrswch0a1E","title":"Damus app - Nostr client - what is it & how it works? FULL OVERVIEW","duration":735},
            {"id":"Qd4Po4i7wvc","title":"PRIMAL: Nostr Decentralized Social Media Meets Bitcoin! Full Tutorial","duration":2875},
            {"id":"ButstuTuea8","title":"Jack Dorsey's biggest problem with Elon Musk's X (formerly Twitter)","duration":470},
            {"id":"mwbyKIFzmS0","title":"Unstoppable Money And Free Speech (Nostr)","duration":337},
            {"id":"XoGntcN5mh0","title":"When This Goes Viral, It's Too Late (Nostr 2025 Guide) - Miljan Braticevic","duration":5348},
            {"id":"zxkaUxzr4xY","title":"What Nostr Brings to Bitcoin","duration":1308},
            {"id":"k3tt87jeYnc","title":"NOSTR Account in 10 Minuten erstellen!","duration":644},
            {"id":"3vbwkTVuf6w","title":"CONTENT CREATORS: Why YOU Should Use #Nostr & How to Build a BIG Audience - JEFF BOOTH","duration":399},
            {"id":"TarmfsQK-oI","title":"Primal, the Bitcoin Powered Social Network Built on Nostr. Full Tutorial!","duration":800},
            {"id":"Kuqs4bYGEEk","title":"Nostr Start Guide for Beginners | Account setup & wallet connect for Zaps","duration":1132},
            {"id":"4sxon4ajrCM","title":"Zapvertising on Nostr: All Your Models Are Broken","duration":1643},
            {"id":"heJ5Iw_UpD8","title":"Primal Crash Course","duration":275},
            {"id":"NrUnJAovloQ","title":"Primal's Approach to Nostr","duration":2095},
            {"id":"kqR_IQfKic8","title":"NOSTR vs Tech Monopolies, the Future of Social Media & Primal 2.0 - MILJAN (THE Bitcoin Podcast)","duration":6436},
            {"id":"3Xt4GzPg7w8","title":"Ex Twitter CEO Jack Dorsey discusses BITCOIN with Joe Rogan","duration":347},
            {"id":"Ybe09ImCnvk","title":"Edward Snowden and Jack Dorsey on Nostr","duration":4793},
            {"id":"UubHnejeG44","title":"Jack Dorsey and Bitcoin","duration":466},
            {"id":"8GhEezzto4Y","title":"Nostr: Decentralized Social Media & Bitcoin w/ William Casarin (BTC111)","duration":3011},
            {"id":"qUwXRDrfJU0","title":"ODELL X JACK: ALL CAPS FIRESIDE","duration":3241},
            {"id":"IFMNyyami0g","title":"O QUE É NOSTR?","duration":546},
            {"id":"1qtKwPB-IdM","title":"Nostr: Freie Meinungsäußerung auf Social Media | Ausschnitt aus dem Livestream","duration":548},
            {"id":"j0eMHXx6zdg","title":"The Future of Bitcoin - Jack Dorsey","duration":1491}
        ]
    },
    {
        "id": "art-philosophy",
        "name": "Art & Philosophy",
        "emoji": "🎨",
        "desc": "Bitcoin art, ordinals & deeper meaning",
        "color": "#a855f7",
        "videos": [
            {
                "id": "2Jf8sxF8QFQ",
                "title": "Miami debuts Bitcoin Bull Statue",
                "duration": 162
            },
            {
                "id": "83mw71TLYjY",
                "title": "Leveling Up Your Collection: PSA Grading for Bitcoin Trading Cards",
                "duration": 1890
            },
            {
                "id": "YZ2B-Qnm0eM",
                "title": "The Timechain Codex by FractalEncrypt",
                "duration": 77
            },
            {
                "id": "nvPJ_F845ms",
                "title": "Sam Kimbrow & Asanoha on Bitcoin Culture - Movement of Art Ep. 1",
                "duration": 4583
            },
            {
                "id": "7DIp6D-68cQ",
                "title": "Can Bitcoin Rebuild Civilization? - Saifedean Ammous",
                "duration": 3033
            },
            {
                "id": "occ9L0dMMO4",
                "title": "Bitcoin 2024 Art Exhibit - Bitcoin Bob",
                "duration": 542
            },
            {
                "id": "ic6pDq3OAec",
                "title": "Philosophy of Bitcoin - First Principles",
                "duration": 1948
            },
            {
                "id": "9-S17oAxIqA",
                "title": "Bitcoin Pencil Art Timelapse - Bitcoin Apex",
                "duration": 792
            },
            {
                "id": "Q4owb6f9gbM",
                "title": "FractalEncrypt & Rebel Money on Bitcoin Art & Time - Movement of Art Ep. 5",
                "duration": 4034
            },
            {
                "id": "SogEkk3-XnA",
                "title": "I BOUGHT THIS BITCOIN NFT! (BRC-20, NFTs, Ordinals)",
                "duration": 668
            },
            {
                "id": "b4Q8Y3Rg7Rc",
                "title": "Frederic Guimont on Ratel & Bitcoin Comics - Bitcoin Art Podcast",
                "duration": 7619
            },
            {
                "id": "1gnIbVFnuCY",
                "title": "The Biggest Scam in Human History - Robert Breedlove",
                "duration": 5936
            },
            {
                "id": "vPUpdXZPpbQ",
                "title": "Nashville Bitcoin Mural - Sound Money",
                "duration": 40
            },
            {
                "id": "edyO5-L9un8",
                "title": "Marcus Connor & The Bitcoin Roller Coaster Guy",
                "duration": 3732
            },
            {
                "id": "P0WZCTDDGXQ",
                "title": "Create and List Your Own Bitcoin Ordinals - Ordinals Explained Ep. 5",
                "duration": 98
            },
            {
                "id": "JffTkZZC2z8",
                "title": "What is Money? - Robert Breedlove",
                "duration": 4931
            },
            {
                "id": "cgzH1jScIn0",
                "title": "Bitcoin NFTs - Ordinals Explained Full Guide (Wallet Setup & Mint)",
                "duration": 987
            },
            {
                "id": "IUpIoZIoO2Q",
                "title": "Ripping BitBlockBoom Packs (Bitcoin Trading Cards)",
                "duration": 185
            },
            {
                "id": "Tr7XO-SQw5g",
                "title": "Marcus Connor, Pepenardo & Rare Scrilla on Memes - Movement of Art Ep. 3",
                "duration": 5055
            },
            {
                "id": "gb2S1Filtic",
                "title": "How Bitcoin Fixes Fiat's Millennium of Mistakes - Saifedean",
                "duration": 1587
            },
            {
                "id": "yMoVGgR6h0Y",
                "title": "Money: The Language of Power - Robert Breedlove",
                "duration": 4307
            },
            {
                "id": "lRr9ofu0tnk",
                "title": "Bitcoin Art Magazine Unleashed",
                "duration": 5762
            },
            {
                "id": "Z0_9Jw56l4k",
                "title": "Opening 2 Packs Of Bitcoin Trading Cards",
                "duration": 1086
            },
            {
                "id": "yvdZsN5s9sc",
                "title": "Based Trading Cards Movement",
                "duration": 5679
            },
            {
                "id": "VLRt0QOZ3TE",
                "title": "Bitcoin Trading Cards: The Scarcest Collectibles on Earth",
                "duration": 128
            },
            {
                "id": "h9jO1cipnc8",
                "title": "2024 Bitcoin Trading Cards Halving Edition Whale Packs - Launch Announcement",
                "duration": 60
            },
            {
                "id": "xwufPksmi9w",
                "title": "Cracking A Pack Of Based Trading Cards Series 3 - Warriors Vs Villains",
                "duration": 483
            },
            {
                "id": "Ifi-Hg3n3bc",
                "title": "Bitcoin Ordinals Explained: How To Make Your First Bitcoin NFT",
                "duration": 233
            },
            {
                "id": "l5a6-9mNqho",
                "title": "World's Largest Bitcoin Sculpture",
                "duration": 58
            },
            {
                "id": "FiFwaHCRz7s",
                "title": "Bitcoin's BRC-20 Explosion: Everything You Need To Know About Ordinals",
                "duration": 286
            },
            {
                "id": "W03SVhhOaEU",
                "title": "The Bitcoin Full Node Sculpture 7.0 - A Cypherpunk Chronometer (MirrorNode)",
                "duration": 53
            },
            {
                "id": "N3a8IQXKjeY",
                "title": "What are Ordinals? - Ordinals Explained Ep. 2",
                "duration": 86
            },
            {
                "id": "RwO9lB-rloo",
                "title": "Bitcoin, Art, and Freedom with Madex",
                "duration": 5309
            },
            {
                "id": "uIaUj6Nsi70",
                "title": "2024: A Landmark Year for Bitcoin Trading Cards - Bold New Look",
                "duration": 16
            },
            {
                "id": "JPJyDYmovJo",
                "title": "A FULL BOX of Bitcoin Trading Cards - BTC Viking",
                "duration": 755
            },
            {
                "id": "33emHIL1IoU",
                "title": "The Bitcoin Full Node Sculpture - Eric Weiss",
                "duration": 292
            },
            {
                "id": "XHBydlTt2jM",
                "title": "The Rise of Ordinals and Art on Bitcoin",
                "duration": 1499
            },
            {
                "id": "KxTWC3ShYDE",
                "title": "Just-B on Airbrush Mastery - Bitcoin Art Podcast",
                "duration": 7385
            },
            {
                "id": "XrD617FIfJM",
                "title": "FractalEncrypt's Bitcoin Full Node - DESIGN Feature for Block04",
                "duration": 62
            },
            {
                "id": "gNOnNz4d_mI",
                "title": "Tone Vays Rips BitBlockBoom 2024 Bitcoin Trading Cards Packs",
                "duration": 327
            },
            {
                "id": "sntmLivV56M",
                "title": "Adam O'Brien & Brandon Gentile Ripping BitBlockBoom 2024 Packs",
                "duration": 364
            },
            {
                "id": "indFxEWINDA",
                "title": "We Gave Bitcoin Trading Cards to No-Coiners - Here's What Happened",
                "duration": 939
            },
            {
                "id": "pcVCt2utTW4",
                "title": "How to Make a Bitcoin Ordinal Inscription in Under Two Minutes",
                "duration": 369
            },
            {
                "id": "iFb2MMUZBYs",
                "title": "Bitcoin Artist Trevor Jones Augments Reality",
                "duration": 382
            },
            {
                "id": "bHj-a4_nX78",
                "title": "FractalEncrypt Bitcoin Full Node Sculpture",
                "duration": 30
            },
            {
                "id": "3e36FXH5Hlw",
                "title": "Amy DiGi on Community, Craft & Handmade Bitcoin Art - Bitcoin Art Podcast Ep. 2",
                "duration": 4744
            },
            {
                "id": "KORJr5ZfzWI",
                "title": "Bitcoin Full Node Sculpture",
                "duration": 37
            },
            {
                "id": "UrCN7oG_4YY",
                "title": "Bitcoin NFTs: How to Create Ordinal Inscriptions",
                "duration": 707
            },
            {
                "id": "tgM5wwpwpzA",
                "title": "Ariel B., Flo M., Antonio B. & Psyfer on Stories & Myths - Movement of Art Ep. 2",
                "duration": 4435
            },
            {
                "id": "8TN7mq6cK7g",
                "title": "Bitcoin Art with FractalEncrypt - Freedom Footprint",
                "duration": 5006
            },
            {
                "id": "EPUNITbXwEM",
                "title": "Bitcoin Trading Cards: Collectible Art To Orange Pill The World",
                "duration": 1673
            },
            {
                "id": "GRby6vAPwHI",
                "title": "Bitcoin, Art, and Our Divine Lost Knowledge - Ariel Birdie",
                "duration": 4258
            },
            {
                "id": "JQg_s0wt96M",
                "title": "Bitcoin Trading Cards Are Back With Series Two",
                "duration": 897
            },
            {
                "id": "e1ojV8YwA2c",
                "title": "Gus Grillasca on Rare Pepes, BTC Art & Creative Engineering - Bitcoin Art Podcast Ep. 1",
                "duration": 5503
            },
            {
                "id": "5gl2xVJ9mTw",
                "title": "What are Satributes & Recursions? - Ordinals Explained Ep. 3",
                "duration": 120
            },
            {
                "id": "PqFz8R1CZYo",
                "title": "Bitcoin as a Kardashev-Scale Technology - Robert Breedlove",
                "duration": 755
            },
            {
                "id": "0qS_oBk-tbY",
                "title": "FractalEncrypt: Artistic Bitcoin Education - Bitcoin With Jake #44",
                "duration": 3722
            },
            {
                "id": "wYhpD6Y6E8E",
                "title": "Meet Based Trading Cards - Bitcoin Culture You Can Hold",
                "duration": 53
            },
            {
                "id": "cKkokcMMnpc",
                "title": "Bitcoin Aligns with the Laws of Nature - Robert Breedlove",
                "duration": 5472
            },
            {
                "id": "wSLejJ88VGQ",
                "title": "Ripping Spirit of Satoshi Packs (Bitcoin Trading Cards)",
                "duration": 236
            },
            {
                "id": "rYiWd-qIRQA",
                "title": "Kontext on Writing, Music & Stoicism - Bitcoin Art Podcast Ep. 5",
                "duration": 5758
            },
            {
                "id": "j3QJlyRMHpI",
                "title": "Art on Bitcoin: Shaping the Future of Digital Creativity",
                "duration": 469
            },
            {
                "id": "NALikCvCyes",
                "title": "The Truth About Money, Inflation and Bitcoin - Robert Breedlove",
                "duration": 6119
            },
            {
                "id": "RnducAborVw",
                "title": "Bitcoin Art Gallery - Miami 2022",
                "duration": 418
            },
            {
                "id": "8FxyOC26TYE",
                "title": "What's In A Based Trading Cards Bitcoin Pack?",
                "duration": 736
            },
            {
                "id": "-vKBCrUyCEU",
                "title": "Bitcoin Ordinals Explained",
                "duration": 421
            },
            {
                "id": "omKlwzKmKBE",
                "title": "Bitcoin Trading Cards: Understanding True Scarcity and Value",
                "duration": 263
            },
            {
                "id": "HVKq5qfZSqU",
                "title": "FractalEncrypt Bitcoin Full Node Book & Canvas - Bitcoin 2022 Conference",
                "duration": 47
            },
            {
                "id": "EaU5yFi61hg",
                "title": "Yonat Vaks on Her Artistic Journey & Bitcoin Art - Bitcoin Art Podcast Ep. 3",
                "duration": 6067
            },
            {
                "id": "ImZDBBjdX6s",
                "title": "Opening The BOX! 24 Packs of BTC Trading Cards - Crypto Viking",
                "duration": 751
            },
            {
                "id": "3nA4HhsbZMQ",
                "title": "Anik Malcolm on Finding Purpose in Bitcoin Art - Bitcoin Art Podcast Ep. 4",
                "duration": 4016
            },
            {
                "id": "MRnmP7pbR0s",
                "title": "Creating Meaningful Art with FractalEncrypt",
                "duration": 3582
            },
            {
                "id": "H1oc5HKixBg",
                "title": "The Bitcoin Full Node Sculpture 4.0 - A Cypherpunk Chronometer",
                "duration": 59
            },
            {
                "id": "Mqc6M8rZRi8",
                "title": "BITCOIN TRADING CARDS?",
                "duration": 1065
            },
            {
                "id": "SKIIif9WQok",
                "title": "Bitcoin Renaissance Legacy: Beyond Digital Gold",
                "duration": 1242
            },
            {
                "id": "lo7eeL1E_VQ",
                "title": "A Madex Manifesto",
                "duration": 281
            },
            {
                "id": "OszL_Q2wvNQ",
                "title": "Welcome to Ordinals! What is Ordinal Theory? - Ordinals Explained Ep. 1",
                "duration": 80
            },
            {
                "id": "BrfJgr19MPY",
                "title": "Alex Schaefer on Burning Banks & Protest Art - The Whole Entire Universe",
                "duration": 6031
            },
            {
                "id": "bgDwvJOtSSY",
                "title": "Naomi Olson on Ocean Art & Aloha Energy - The Whole Entire Universe",
                "duration": 4967
            },
            {
                "id": "QVg0ZmxrYLo",
                "title": "Bitcoin's Most Beautifully Absurd Art Drop",
                "duration": 504
            },
            {
                "id": "Q5Wxg53qu9s",
                "title": "The Bitcoin Full Node Sculpture #2 of 10",
                "duration": 16
            },
            {
                "id": "AKri5ZKYPAk",
                "title": "LSD, Shrooms, DMT, Mescaline... and Bitcoin",
                "duration": 1140
            }]
    },
    {
        "id": "orange-pill",
        "name": "Beginners 101 & Orange Pill",
        "emoji": "🟠",
        "desc": "Start here — Bitcoin basics + the orange pill journey",
        "color": "#f7931a",
        "videos": [
            {"id":"bBC-nXj3Ng4","title":"But how does bitcoin actually work?","duration":1516},
            {"id":"SSo_EIwHSd4","title":"How does a blockchain work - Simply Explained","duration":360},
            {"id":"41JCpzvnn_0","title":"What is Bitcoin?  Bitcoin Explained Simply","duration":769},
            {"id":"pSTNhBlfV_s","title":"Watch Crypto expert explain the Blockchain to Congress","duration":356},
            {"id":"s4g1XFU8Gto","title":"Bitcoin explained and made simple","duration":205},
            {"id":"vLTGfSja_Xk","title":"Casually Explained: Bitcoin","duration":638},
            {"id":"jkSeosiLmh4","title":"How to mine BITCOIN with your Home PC or Laptop!","duration":784},
            {"id":"mrtSAgcpack","title":"What is Bitcoin Mining for Beginners - Short and Simple","duration":126},
            {"id":"l9jOJk30eQs","title":"How Bitcoin Works in 5 Minutes (Technical)","duration":326},
            {"id":"hYip_Vuv8J0","title":"Blockchain Expert Explains One Concept in 5 Levels of Difficulty | WIRED","duration":1070},
            {"id":"5Uh720poZ8w","title":"What is Bitcoin? - Bitcoin 101","duration":157},
            {"id":"sZvhLDWjD_I","title":"How Bitcoin Fixes Broken Money | Welcome to Bitcoin | Introductory Course (Unit 1)","duration":896},
            {"id":"I1uefzJJ6nM","title":"Bitcoin 101 - Intro to Paper Wallets & Cold Storage - Bitcoin Security & Fun with Sloppy Wallets","duration":1617},
            {"id":"jk89usrtNEk","title":"Bitcoin 101 - Getting Your BTCs out of Your Paper Wallets & Cold Storage - Fun with Sloppy Wallets","duration":654},
            {"id":"Bhe61JaNFLU","title":"Bitcoin 101 - What is Bitcoin?","duration":1353},
            {"id":"d7ID3fKAFQM","title":"Jack Mallers \"Intro to Bitcoin\" at Bitcoin Atlantis 2024","duration":2859},
            {"id":"Cw29h7LhEuE","title":"Bitcoin Update - just buy $1 worth of bitcoin please!","duration":384},
            {"id":"ywka38FnqqY","title":"The Tragic Story of Telling your Friends to Buy Bitcoin (2011-2021)","duration":178},
            {"id":"3QH7ZTibV-Q","title":"How to Buy Bitcoin (in 2 minutes) - 2024 Updated","duration":161},
            {"id":"l1si5ZWLgy0","title":"Introduction to Bitcoin: what is bitcoin and why does it matter?","duration":2237},
            {"id":"UlKZ83REIkA","title":"Bitcoin for Beginners: Bitcoin Explained in Simple Terms","duration":1792},
            {"id":"i9nUMvpT2rM","title":"Blockchain for Beginners","duration":1339},
            {"id":"xxfUpIV9wRI","title":"Bitcoin Q&A: What is a Private Key?","duration":1098},
            {"id":"RPR5dtmXnY8","title":"Bitcoin Q&A: Where Can I Buy and Spend Bitcoin?","duration":253},
            {"id":"Vfq7LNDCdNQ","title":"Andreas Antonopoulos explaining Bitcoin and money 🎙It is one of the best speeches you will ever hear","duration":1499},
            {"id":"WPLsTgYWeBA","title":"Andreas M. Antonopoulos: Why I Bought Bitcoin [2024]","duration":3444},
            {"id":"EiW4lKrMXQ4","title":"My First Bitcoin Talk on Bitcoin Neutrality From 2013","duration":1822},
            {"id":"y6egEeOSgjI","title":"Bitcoin Q&A: Is Bitcoin a Good Investment?","duration":174},
            {"id":"rJlgpOQp7Ig","title":"Orange Pill [OP26] - Monetizing Dissent","duration":3600},
            {"id":"LKYVbahTjQM","title":"Giving Strangers $50 Bitcoin or $5 Cash (Social Experiment)","duration":440},
            {"id":"l3c8l4rgp6s","title":"Inside Costa Rica's Secret Bitcoin Community - Get Based TV","duration":1139},
            {"id":"SS8-qjP-yAo","title":"We Investigated Canada's Secret Bitcoin City - Get Based TV","duration":851},
            {"id":"6qVq7T-NJdE","title":"Gen Z Knows the System Is Broken... Bitcoin is the Escape Plan - Julian Figueroa","duration":4860},
            {"id":"zdJiltpWi3A","title":"The 3 Biggest Bitcoin Myths (Stop Believing Them) - Get Based TV","duration":827},
            {"id":"HPkjH3Yeih4","title":"What is the ONE THING Preventing Bitcoin from Reaching $100k?","duration":623},
            {"id":"Uh-eTnRXCr8","title":"Bitcoin Street Interviews Edinburgh - Mike Still","duration":1400},
            {"id":"rc744Z9IjhY","title":"Andreas Antonopoulos: The Internet of Money - What is Bitcoin?","duration":1099},
            {"id":"H85UfhYV_pA","title":"Smart Money is Selling Real Estate for Bitcoin - Terence Michael","duration":6670},
            {"id":"D22zHDCE6-0","title":"Did El Salvador Just Give Up On Bitcoin? - Get Based TV","duration":837},
            {"id":"6xIq0FdmsIA","title":"Andreas Antonopoulos: Internet of Money - Keynote","duration":2359},
            {"id":"IuVkUqdqkcc","title":"Buy Bitcoin When It Looks Like This - Exit Manual","duration":653},
            {"id":"7O10xS_sQoE","title":"The Hidden Tax You Pay to Rich People - Julian Figueroa","duration":437},
            {"id":"heA1fZzRAFs","title":"Orange Pill: The Bitcoin Guide","duration":2625},
            {"id":"Nls1keqHlz8","title":"Show This Video At The Dinner Table To Orange Pill Your Family!","duration":194},
            {"id":"nTRdmYX-0h8","title":"Warming Up to Bitcoin - The Future of Sustainable Heating? - Get Based TV","duration":548},
            {"id":"y1KXs3uE42I","title":"Andreas Antonopoulos: Why Bitcoin Matters - Internet of Money","duration":1641},
            {"id":"XG7v4XFL7mc","title":"Stossel: Is Bitcoin Better Money?","duration":298},
            {"id":"xyxRCwJVBUc","title":"Bitcoin Expert Breaks Down Historic RFK Jr. Speech - Get Based TV","duration":1149},
            {"id":"KW_wYvZ1eZg","title":"Andreas Antonopoulos: Decentralization & The Future of Money","duration":5024},
            {"id":"Fp9xhVeWUMs","title":"Asking Strangers About Bitcoin & Cryptocurrency","duration":694},
            {"id":"T_hXPEh8S60","title":"Becoming A Bitcoin Maximalist: The Journey (Asking REAL People)","duration":623},
            {"id":"iXxeIahvAOQ","title":"Building a Bitcoin World - Interview with BTC Sessions - Get Based TV","duration":5049},
            {"id":"N5aAkIo-93Q","title":"Crypto Street Interviews: Las Vegas Episode 1","duration":996},
            {"id":"Sv9VAocAA80","title":"Max Keiser: Bitcoin Will Replace the Dollar","duration":822},
            {"id":"NuKcDkaH2fc","title":"Orange Pill [OP40] - The Dust Bowl of Money","duration":5285},
            {"id":"HhxcdMIJTLA","title":"Telling People About Bitcoin Never Works - Exit Manual","duration":450},
            {"id":"Qaj7TfHxVBU","title":"El Salvador's Broken Bitcoin Revolution - Get Based TV","duration":2012},
            {"id":"arkn9rqczJ8","title":"I Asked Bitcoin Billionaires For Crypto Advice","duration":501},
            {"id":"xegEpCLT0CQ","title":"A Practical Approach to Orange Pilling","duration":1060},
            {"id":"ExUeCIscbNU","title":"Something is Deeply Wrong with the Economy Right Now - Julian Figueroa","duration":287},
            {"id":"gt4HBSUjENE","title":"Would You Rather Have $100 Or 1 Bitcoin?","duration":486},
            {"id":"r34hkJBeE-M","title":"How I Lost 14 Bitcoins - Exit Manual","duration":555},
            {"id":"CgCX1K-uD7o","title":"IS CRYPTO A SCAM? (Asking The Public)","duration":591},
            {"id":"03V2j-KUFho","title":"Is Bitcoin Actually Just a Cult? - Get Based TV","duration":1418},
            {"id":"og5zZssEWIc","title":"Bitcoin Street Interviews Birmingham - Mike Still","duration":473},
            {"id":"MQvvLwxxxdM","title":"The Banks are BROKE","duration":102},
            {"id":"4xGTGqsy4SM","title":"ORANGE PILL PODCAST - Episode 0001","duration":5081},
            {"id":"ztTICG37kxA","title":"I Asked Strangers About Bitcoin... It Got Awkward","duration":403},
            {"id":"4QVuQH2DEJM","title":"Orange Pill [OP23] - Bitcoin Reveals the Fiat Dark Ages","duration":4736},
            {"id":"Bt2Z-_nhpwQ","title":"How to Orange Pill Anyone","duration":840},
            {"id":"4hWMHLF-OEg","title":"Inside Peru's Hidden Bitcoin Revolution - Get Based TV (Full Movie)","duration":2379},
            {"id":"sLcNmZwMOz0","title":"Drunk People React To Bitcoin - Street Interviews!","duration":610},
            {"id":"4tqXvMNOuHk","title":"Bitcoin Ethical Superiority Explained - Exit Manual","duration":45},
            {"id":"exK5yFEuBsk","title":"Remember, Remember the 5th of November - Bitcoin","duration":127},
            {"id":"YT-38EneBWw","title":"Bitcoin Street Interviews London - Mike Still","duration":1491},
            {"id":"ZkgkxB8s9bw","title":"Can Bitcoin Be Futureproof? - w/ Adam O'Brien - Get Based TV","duration":3586},
            {"id":"vclZlAFXpEI","title":"Give Me 9 Minutes and You Will Understand Bitcoin - Exit Manual","duration":600},
            {"id":"jdZXDSfRXFw","title":"Why Make Bitcoin Videos?","duration":417},
            {"id":"Y1FGz6rJR6A","title":"Is this one of the most IMPORTANT moments in Bitcoin History???","duration":847},
            {"id":"6tEruQ1sl_c","title":"Why Can't we Just Save Money? Why Are We Forced to Invest?","duration":334},
            {"id":"boWa573lchk","title":"What the h@!& is the Agentic Bitcoin Internet???","duration":434},
            {"id":"mdOyyipbUIg","title":"Bitcoin vs Real Estate | The Ultimate Wealth Test","duration":511},
            {"id":"Ym5kXxZ0eKg","title":"New ALL TIME HIGHS in 2026?","duration":492},
            {"id":"QmfTqIbEBmk","title":"Global Debt is COLLIDING with AI deflation, and it's going to get UGLY","duration":537},
            {"id":"CkfjTUzopho","title":"Bitcoin THRIVES in CHAOS!","duration":507},
            {"id":"uOnlGmN89ws","title":"The Perfect Environment for Bitcoin is Coming!","duration":244},
            {"id":"L-jWILQF5l0","title":"Is Bitcoin Inevitable? The Answer Might surprise you!","duration":414},
            {"id":"fetDXOjZ5Q4","title":"The Global Order Is Collapsing. What does this mean for Bitcoin?","duration":430},
            {"id":"bsOUzoC0jdg","title":"AI Will Copy Everything Digital - EXCEPT BITCOIN.","duration":377},
            {"id":"Jab0pJklPwk","title":"The Ultimate Math of A Bitcoin Denominated World","duration":340},
            {"id":"6Ojh969zABM","title":"The Multipolar World - And What it Means for BITCOIN","duration":458},
            {"id":"wClCVfnfCpo","title":"Bitcoin Price Manipulation CONFIRMED! Jane St, ETF's and what happens next","duration":433},
            {"id":"mhn9HgAhrss","title":"The MOST Important Thing to Understand about Money!","duration":281},
            {"id":"a7fmTcHIyQQ","title":"Is Bitcoin entering a SUPERCYCLE? What does this mean for the price?","duration":446},
            {"id":"vTwkW2KHgB0","title":"Why Bitcoin is an Issue of National Security","duration":442},
            {"id":"SGb7QMZwJd8","title":"11. Bitcoin Fundamentals Explained Simply!","duration":603},
            {"id":"Anu0kDFTQvc","title":"Why Bitcoin Will Become the Next Global Reserve Asset","duration":360},
            {"id":"rCfAjgBhp5k","title":"Why Game Theory means Bitcoin wins!","duration":340},
            {"id":"ES7f2gBNMe0","title":"When Is the Best Time To Buy Bitcoin?","duration":328},
            {"id":"azw7KpdQD0w","title":"Is Bitcoin is the ONLY asset worth buying?","duration":410},
            {"id":"JjnaYQIUZLw","title":"Why Stablecoins Supercharge Bitcoin Adoption","duration":470},
            {"id":"e7CIeZmaNEs","title":"Bitcoin Adoption Is Going Mainstream!","duration":71},
            {"id":"8HaVTfzFFG0","title":"Bitcoin is Going Up Forever  #bitcoin101","duration":74},
            {"id":"3B6asZvHoSA","title":"7. Is Bitcoin Too Expensive?","duration":367},
            {"id":"BzLFQqpzI04","title":"6. Does Bitcoin Have No Intrinsic Value?","duration":266},
            {"id":"djw0zYXyAlo","title":"Percent of the Network  #bitcoin","duration":89},
            {"id":"4UDkbGMvGIY","title":"5. The Biggest Risks to Bitcoin","duration":610},
            {"id":"IOzCrgCDSy8","title":"4. Is Bitcoin Just for Criminals?","duration":182},
            {"id":"9y6glDnsH04","title":"3. Bitcoin's Environmental Impact","duration":319},
            {"id":"H_kQb8xG5Bo","title":"2. Is Bitcoin A Ponzi Scheme?","duration":299},
            {"id":"dDa4UrYZCPA","title":"1.  Is Bitcoin's Volatility a Bad thing? Or an Advantage?","duration":438},
            {"id":"o5LZML8VaE4","title":"Episode 10 - What happens when Bitcoin wins?","duration":274},
            {"id":"bF5SMoqJEJQ","title":"Tariffs Explained In 60 Seconds","duration":73},
            {"id":"aNEaBzrcs1o","title":"Episode 9 -  How Bitcoin Empowers You","duration":257},
            {"id":"lrSWrVSkT1U","title":"Bitcoin In 60 Seconds","duration":75},
            {"id":"ltxmMo7I9Fw","title":"Episode 8: Bitcoin Is Energy Backed Money","duration":338},
            {"id":"SZ4W07fv-0A","title":"Episode 5 - Why Is Bitcoin Different From Crypto?","duration":381},
            {"id":"ZwFEKGa64KM","title":"Episode 4 - Can Governments Ban Bitcoin","duration":412},
            {"id":"_m7KggCKicU","title":"4 - Bitcoin Is Actually LIFE ENERGY!","duration":155},
            {"id":"IAfpjwzvUks","title":"Episode 3. Can you increase Bitcoin's Supply?","duration":333},
            {"id":"kjsUN_9siKw","title":"Episode 1: Grow Your Wealth, AND Fix the World: Bitcoin!","duration":499},
            {"id":"WkkBma768h8","title":"Why Psychedelics Unlock Hidden Dimensions of the Mind","duration":900},
            {"id":"dcyCOre17Bc","title":"BITCOIN BULL RUN 2025. WATCH THIS.","duration":485},
            {"id":"Vp_-3Z8luTQ","title":"Bitcoin breaks ONE MILLION Swedish kronor","duration":369},
            {"id":"ru8UaqxXwiY","title":"Why Bitcoin is the Future of Money","duration":765},
            {"id":"poa6kNXEJxw","title":"Watch this before the bitcoin revolution","duration":486},
            {"id":"w9YktzBIazM","title":"Your money is spying on you","duration":649},
            {"id":"n9QlPzzahXg","title":"DEAD AND ALIVE","duration":564},
            {"id":"oVKMN7oYSs8","title":"The Next 50 Generations: Bitcoin, Psychedelics, and Human Evolution","duration":697},
            {"id":"ONfuVlCGQNA","title":"The world's most expensive clock","duration":429},
            {"id":"mUY_5ysXYOs","title":"The Genie, Bitcoin, and the Financial Dark Ages","duration":484},
            {"id":"L5Lb1prBbHI","title":"Bitcoin will outlive the Pyramids","duration":445},
            {"id":"Qr4DyTFMxkI","title":"Bitcoin and DNA","duration":366},
            {"id":"qU9oMiq77xw","title":"What's the scarcest thing in the world?","duration":381},
            {"id":"_oHkdEQ9AaI","title":"Is discipline really important?","duration":195},
            {"id":"cbnL1yOv1VU","title":"Bitcoin: The Inverse of Clown World","duration":404},
            {"id":"X7adN61eEjg","title":"Bitcoin and the Kardashev Scale","duration":723},
            {"id":"BagsxlVsog0","title":"WHY ARE WE BULLISH? Giacomo Zucco, Roman Reher, Ioni Appelberg","duration":7230},
            {"id":"x78Y7TE9eyo","title":"BITCOIN'S NEXT BULL RUN","duration":414},
            {"id":"TIkqBZnrKJM","title":"EVERYTHING will fail. Except...","duration":465},
            {"id":"Mvchzpbv2hE","title":"Bitcoin's REAL effect on the environment","duration":421},
            {"id":"6fu-w7gvPpk","title":"YOU ARE NOT PREPARED!!","duration":498},
            {"id":"5VAX3JL_l90","title":"Bitcoin: Why collectivists win","duration":683},
            {"id":"_9TI4Pzl-RQ","title":"SEPARATION OF MONEY AND STATE","duration":451},
            {"id":"7vl_ziH6OJo","title":"Bitcoin's price curve will not be S-shaped","duration":242},
            {"id":"4bHAQOevZrI","title":"Bitcoin: Everything a trade","duration":413},
            {"id":"-PsbNprqTgI","title":"Bitcoin is not going to go away","duration":255},
            {"id":"s-kKDR30Fb8","title":"Bitcoin is like real estate in Manhattan","duration":241},
            {"id":"Cj9sWNgx9KU","title":"One bitcoin is all you need","duration":97},
            {"id":"mZ3nXx9V55M","title":"The Next Paradigm in Medicine","duration":501},
            {"id":"GZokpamL-84","title":"AI, Energy, Bitcoin: The Foundation of the Future","duration":365},
            {"id":"TmOlADL_llQ","title":"Bitcoin Quantum Exposure Weekly Report (4/7/26 - 4/14/26)","duration":302},
            {"id":"hL-pFg3vZds","title":"Bitcoin Target & Block Hashes Animation (3/4/26 Update)","duration":116},
            {"id":"8aOJxfJ-SNE","title":"Bitcoin Price Distribution Animation (1/8/26 Update)","duration":109},
            {"id":"W3xniwhdpTk","title":"BTC Map: Latin America Bitcoin Merchant Adoption Per 100k Population (12/27/25 Update)","duration":85},
            {"id":"QipRYAxErJ0","title":"BTC Map: Global Bitcoin Merchant Adoption Per 100k Population (12/21/25 Update)","duration":94},
            {"id":"83-Q19F_uw0","title":"BTC Map: U.S. Bitcoin Merchant Adoption Per 100k Population (12/19/25 Update)","duration":84},
            {"id":"Rnw6aJM1ni8","title":"BTC Map: U.S. Bitcoin Merchant Adoption (12/16/25 Update)","duration":84},
            {"id":"2-fEEC9_YT8","title":"BTC Map: Global Bitcoin Merchant Adoption (12/14/25 Update)","duration":194},
            {"id":"R87W6PFl868","title":"Top 10 Cryptocurrencies By Market Cap & Bitcoin Dominance (12/7/25 Update)","duration":83},
            {"id":"TFu9_nT_SAI","title":"Bitcoin Never Look Back Price (12/2/25 Update)","duration":109},
            {"id":"SV-HZftkKXM","title":"Bitcoin’s Blockchain History (Genesis - 923,040)","duration":112},
            {"id":"zKAjd4IGbPQ","title":"Bitcoin HODL Waves Animation (11/9/25 Update)","duration":112},
            {"id":"K33t8HmWipQ","title":"Bitcoin Just Hit Its 200th Daily Close Above $100k","duration":107},
            {"id":"kBoSO7612v0","title":"Top 10 Cryptocurrencies By Market Cap & Bitcoin Dominance (9/18/25 Update)","duration":80},
            {"id":"INLz3aHUKiM","title":"Bitcoin Days Since All Time High Animation (8/24/25 Update)","duration":107},
            {"id":"D7uSIlNXYag","title":"Total global wealth in terms of bitcoin (7/18/25 update)","duration":107},
            {"id":"HD6vcASMA8o","title":"Bitcoin Target & Block Hashes Animation (5/23/25 Update)","duration":108},
            {"id":"5KTiwi59CUk","title":"Bitcoin Days Since All Time High Animation (5/21/25 Update)","duration":104},
            {"id":"zob5dUOAcv0","title":"Bitcoin 1Y, 2Y, 3Y, 4Y Candles Animation (5/18/25 Update)","duration":109},
            {"id":"ieiwq2m9aWg","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (5/14/25 Update)","duration":85},
            {"id":"EqXouxS5co4","title":"Bitcoin HODL Waves & Price Animation (5/12/25 Update)","duration":108},
            {"id":"ZMmq4zYUviY","title":"Bitcoin HODL Waves Animation (5/9/25 Update)","duration":108},
            {"id":"ywthH7eyXOI","title":"Bitcoin Days Since All Time High (4/30/25 Update)","duration":104},
            {"id":"k_F-Qs57B2U","title":"Bitcoin: Daily DCA Cost Basis (4/28/25 Update)","duration":89},
            {"id":"iEzOIb8oCPc","title":"Bitcoin Supply Distribution & Age by Realized Price (4/18/25 Update)","duration":203},
            {"id":"nsAGFlrRDV8","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (3/23/25 Update)","duration":83},
            {"id":"7uWMertPuGQ","title":"Top 10 Cryptocurrencies By Market Cap & Bitcoin Dominance (3/8/25 Update)","duration":149},
            {"id":"tLHn38mDXW8","title":"Bitcoin Target Hash Animation (3/7/25 Update)","duration":107},
            {"id":"yb2p0WnP53M","title":"Bitcoin: Days Spent at a Loss Animation (3/3/25 Update)","duration":99},
            {"id":"E4HV-xGAXug","title":"Bitcoin: Supply, Difficulty, & Price Animation (2/18/25 Update)","duration":103},
            {"id":"caPiK1H7xDM","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (1/28/25 Update)","duration":82},
            {"id":"4WXXZLYgdgA","title":"Bitcoin Price Distribution Animation (1/13/25 Update)","duration":101},
            {"id":"CmogAUugkDo","title":"Bitcoin: Compound Annual Growth Rate (CAGR) Animation (12/31/24 Update)","duration":76},
            {"id":"mYK4rZSrBL8","title":"Bitcoin: Daily DCA Cost Basis (12/16/24 Update)","duration":86},
            {"id":"8e6hTYr9Gv0","title":"Bitcoin Days Since All Time High (12/3/24 Update)","duration":101},
            {"id":"rFPp6vV80B4","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (11/25/24 Update)","duration":81},
            {"id":"0izbzc44Qcs","title":"Bitcoin Stock2FOMO Model (11/13/24 Update)","duration":79},
            {"id":"vMuuL97uqnc","title":"Bitcoin Price Distribution Animation (11/11/24 Update)","duration":100},
            {"id":"_KfdgZAFMf0","title":"Bitcoin HODL Waves Animation (11/7/24 Update)","duration":100},
            {"id":"3w4AbAmedVs","title":"Bitcoin: Compound Annual Growth Rate (CAGR) Animation (10/16/24 Update)","duration":74},
            {"id":"55oRomg3D1Y","title":"Revisiting The Patoshi Pattern: The Double Helix","duration":68},
            {"id":"sZ7TUop46zU","title":"Bitcoin HODL Waves Animation (10/1/24 Update)","duration":99},
            {"id":"v-fPWB9r9gk","title":"Revisiting The Patoshi Pattern","duration":1217},
            {"id":"MPyFfLboOFs","title":"Bitcoin: Daily DCA Cost Basis (9/24/24 Update)","duration":85},
            {"id":"Xu4R3Ae0yrQ","title":"Bitcoin Target Hash Animation (9/11/24 Update)","duration":103},
            {"id":"rjLhuqDaTu4","title":"Average Price: Ground Beef in Average U.S. City, BTC vs USD (9/7/24 Update)","duration":95},
            {"id":"LmUA_rWN4JQ","title":"Bitcoin Days Since All Time High (9/5/24 Update)","duration":99},
            {"id":"8J2xIqLhcB4","title":"Bitcoin Supply Distribution Animation (8/31/24 Update)","duration":99},
            {"id":"mnlskhJlWIU","title":"Bitcoin Market Cap Distribution Animation (8/28/24 Update)","duration":99},
            {"id":"5YDJfqxFaCI","title":"Bitcoin 200 Day Moving Average & 200 Week Moving Average (8/25/24 Update)","duration":94},
            {"id":"o6TH_eZhYuY","title":"Bitcoin: Profit vs Loss Animation (8/20/24 Update)","duration":94},
            {"id":"rOyCFVmAEQQ","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (6/23/24 Update)","duration":81},
            {"id":"xQgY49OSpLE","title":"Bitcoin Price on This Day Animation (6/12/24 Update)","duration":91},
            {"id":"AcLjBo6c3j8","title":"Bitcoin Target Hash Animation w/ Tomer Strolight (5/29/24 Update)","duration":205},
            {"id":"y48uAeHwZGg","title":"Bitcoin Has Officially Processed Over 1 Billion Transactions!","duration":97},
            {"id":"CNkgi1DU7xc","title":"Bitcoin 10-of-10 Multisig Testing with Sparrow and Nunchuk Wallet","duration":830},
            {"id":"_91klH3VsfE","title":"Bitcoin: Compound Annual Growth Rate (CAGR) Animation (4/26/24 Update)","duration":71},
            {"id":"HYjOrFqu3Ps","title":"Bitcoin 1/2/3/4 Year Window Animation (4/17/24 Update)","duration":283},
            {"id":"mVgPoQrbi7A","title":"Verifying Dice Roll Seed Generation with the SeedSigner, Coldcard, & Keystone","duration":840},
            {"id":"iWh0lfbvdLQ","title":"Coinkite Tapsigner Recovery using a Coldcard with Sparrow Wallet","duration":943},
            {"id":"6ojBttz49cA","title":"Importing a Coldcard Bitcoin Wallet (& Labels from Sparrow) into Nunchuk","duration":1087},
            {"id":"xDKxX42hHzM","title":"Bitcoin Price Distribution Animation (3/22/24 Update)","duration":96},
            {"id":"Xd2T6I_fuRU","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (3/7/24 Update)","duration":76},
            {"id":"qkBrK1Oaqkw","title":"Total global wealth in terms of bitcoin (3/4/24 update)","duration":97},
            {"id":"BnHLSB08W2M","title":"Bitcoin UTXO Management with Nunchuk Wallet","duration":1630},
            {"id":"P88istScPxM","title":"Bitcoin Daily DCA & HODL Animation (2/13/24 Update)","duration":81},
            {"id":"lBnOgWbo-0A","title":"Bitcoin: Profit vs Loss Animation (1/9/24 Update)","duration":90},
            {"id":"qxOhCvot77I","title":"Create & Verify Your Bitcoin Seed Phrase Using Dice + Coldcard + SeedSigner","duration":443},
            {"id":"M5-yY2XWdKM","title":"Download, Verify, & Flash SeedSigner v0.7.0 Software","duration":724},
            {"id":"k-58GrK6A8k","title":"Bitcoin Complete Price History (7/17/2010 - 11/12/2023)","duration":11679},
            {"id":"PBsmDwZFR6c","title":"We've officially mined 93% of all the bitcoin","duration":94},
            {"id":"4YC4vhCHNyE","title":"Bitcoin 1-Month Candles Animation (10/21/23 Update)","duration":165},
            {"id":"PPNOJLn3hQs","title":"Bitcoin-Only BitBox02 Setup & Import Into Sparrow Wallet","duration":1310},
            {"id":"b3nk4bj4vEA","title":"Bitcoin Seed Phrase Metal Backup Comparison & Demonstration","duration":1567},
            {"id":"32SZtxE0sWQ","title":"Coinkite BLOCKCLOCK Comparison - mini vs. micro","duration":422},
            {"id":"NvE5uUm6Jzc","title":"Bitcoin Issuance","duration":143},
            {"id":"l3VjHwheLX8","title":"Assembling Coldcard Mk4 3D printed battery case from BeansBulletsBTC","duration":126},
            {"id":"PnWZPgo5jbc","title":"Importing an Airgapped Coldcard Bitcoin Wallet into Sparrow Wallet","duration":541}
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
                "title": "The Bitcoin Conference 2025 - Day 1 Main Stage",
                "duration": 42897
            },
            {
                "id": "9UxAUryUKXM",
                "title": "Donald Trump 2024 Keynote - Nashville",
                "duration": 2979
            },
            {
                "id": "4S6lzgc7tFc",
                "title": "Bitcoin Beyond Capital: Freedom Money for the Global South (Femi Longe) - MIT Bitcoin Expo 2025",
                "duration": 1617
            },
            {
                "id": "75O56lhJMJI",
                "title": "Welcome to Bitcoin Country - Adopting BTC 2024",
                "duration": 807
            },
            {
                "id": "SFUiGTayVL8",
                "title": "Saifedean: Bitcoin & Tether - Drinking the Dollar Milkshake",
                "duration": 857
            },
            {
                "id": "TEVJUjOGmOI",
                "title": "Bitcoin Core Developer Roundtable - MIT Bitcoin Expo 2025",
                "duration": 2284
            },
            {
                "id": "f3NBhSXtE5g",
                "title": "Edward Snowden 2024 Keynote - Privacy",
                "duration": 1840
            },
            {
                "id": "kE3TpVS27os",
                "title": "JD Vance Keynote - Bitcoin 2025 Las Vegas",
                "duration": 42897
            },
            {
                "id": "vRuPeBAjLTI",
                "title": "JIMMY SONG | DESTROYING RENT SEEKING",
                "duration": 1948
            },
            {
                "id": "M-PIOaHxX4c",
                "title": "BitVM Creator Robin Linus: This Breakthrough Will Revolutionize Bitcoin - MIT Bitcoin Expo 2025",
                "duration": 1031
            },
            {
                "id": "RoRZE2DpEzE",
                "title": "Jack Mallers: The HODLers Dilemma - Bitcoin 2025 Keynote",
                "duration": 2098
            },
            {
                "id": "XT-B9k9t5B8",
                "title": "LIVE: The MIT Bitcoin Expo 2025 - Day 2 Full Stream",
                "duration": 30819
            },
            {
                "id": "R4gyS5mb9dE",
                "title": "Alex Gladstein: Dictators Should Be Afraid - Policy Summit 2025",
                "duration": 1159
            },
            {
                "id": "TTHU_N_n5Ks",
                "title": "PlanB Forum Lugano 2024 - Stephan Livera",
                "duration": 2854
            },
            {
                "id": "XVGME04z_3k",
                "title": "Bitcoin Amsterdam 2025 - Day 2 Livestream",
                "duration": 28160
            },
            {
                "id": "Hp-HlJ0PbpI",
                "title": "Bitcoin Thailand 2024 - Day 1",
                "duration": 33617
            },
            {
                "id": "gu9OulAijy4",
                "title": "The Pacific Bitcoin Conference",
                "duration": 840
            },
            {
                "id": "eEtxKbERWyA",
                "title": "Bitcoin Core Dev Jeremy Rubin: Building Char Network - MIT Bitcoin Expo 2025",
                "duration": 1466
            },
            {
                "id": "O9KnBcWMkpw",
                "title": "Michael Saylor 2024 Keynote - Nashville",
                "duration": 2243
            },
            {
                "id": "dMHhuY35NKY",
                "title": "Tor Project Co-Founder Roger Dingledine: Anonymity in Society - MIT Bitcoin Expo 2025",
                "duration": 1694
            },
            {
                "id": "dWaHWT15sOQ",
                "title": "Paolo Ardoino: Why Tether Loves Bitcoin - Bitcoin 2025",
                "duration": 1029
            },
            {
                "id": "LsLKr_dWdpU",
                "title": "The Eric Semler Interview - MIT Bitcoin Expo 2025",
                "duration": 704
            },
            {
                "id": "rXsRvBXbZyU",
                "title": "Lightning Network Co-Inventor Tadge Dryja: Here Comes the Hornet's Nest - MIT Bitcoin Expo 2025",
                "duration": 1462
            },
            {
                "id": "-LGpW2PKwHA",
                "title": "Bitcoin Core Developer Interview: Antoine Poinsot - MIT Bitcoin Expo 2025",
                "duration": 2141
            },
            {
                "id": "M2zGs2E-pfs",
                "title": "The Future of Corporate Bitcoin Adoption - MIT Bitcoin Expo 2025",
                "duration": 2437
            },
            {
                "id": "sNE-2ffq5MA",
                "title": "Fighting for Freedom Under Zimbabwe's Hyperinflation (Evan Mawarire) - MIT Bitcoin Expo 2025",
                "duration": 1628
            },
            {
                "id": "pt-Wv-M5uNA",
                "title": "Bitcoin MENA 2025 - Day 1 Livestream",
                "duration": 34980
            },
            {
                "id": "pDA2r4AblD0",
                "title": "How To Orange Pill Anyone - BitBlockBoom",
                "duration": 2119
            },
            {
                "id": "Ps3BU0edwqE",
                "title": "Adopting Bitcoin 2024 - Day 2 Livestream",
                "duration": 27456
            },
            {
                "id": "p6kBKSZqjn4",
                "title": "Bitcoin Conference 2025: Opening Day Marathon",
                "duration": 3916
            },
            {
                "id": "I3Qld_HXQuM",
                "title": "Nostrability Workshop - BBB 2024",
                "duration": 2961
            },
            {
                "id": "rNok4Ht6n1E",
                "title": "Bitcoin, Not Crypto: Why Bitcoin-Only VC Will Win (Nico Lechuga) - MIT Bitcoin Expo 2025",
                "duration": 799
            },
            {
                "id": "HGyiOlXg-XY",
                "title": "Top 10 Most Iconic Bitcoin Conference Moments",
                "duration": 302
            },
            {
                "id": "SVJCpnSANG4",
                "title": "Building Bitcoin Insurance for Financial Institutions (Anchorwatch) - MIT Bitcoin Expo 2025",
                "duration": 1001
            },
            {
                "id": "-NlgxiLgqZo",
                "title": "Why Nostr Feels Like Bitcoin in 2012 (Vitor Pamplona) - MIT Bitcoin Expo 2025",
                "duration": 956
            },
            {
                "id": "YQrfB9327jI",
                "title": "Bitcoin Amsterdam 2025 - Day 1 Livestream",
                "duration": 30966
            },
            {
                "id": "3e3KE40r_WM",
                "title": "The Bitcoin Conference 2025 - Day 1 Full Livestream",
                "duration": 33011
            },
            {
                "id": "IjR3Hj0aRW4",
                "title": "Howard Lutnick 2024 Keynote - Nashville",
                "duration": 1250
            },
            {
                "id": "wAv0T2nX0v0",
                "title": "Strategy CEO Phong Le: MIT Bitcoin Expo 2025 Keynote",
                "duration": 1474
            },
            {
                "id": "P1n7XipTCck",
                "title": "Bitcoin 2024 Nashville: Full GA Day 2 Livestream",
                "duration": 35272
            },
            {
                "id": "2qiJIFBJPIU",
                "title": "The Bitcoin Conference 2025 - Day 3 Livestream",
                "duration": 36591
            },
            {
                "id": "IXKLholMqwE",
                "title": "Former CFTC Chairman Tim Massad: Bitcoin & Digital Identity - MIT Bitcoin Expo 2025",
                "duration": 423
            },
            {
                "id": "rQMFrpUFcNM",
                "title": "Michael Saylor Keynote - Bitcoin MENA 2025",
                "duration": 2547
            },
            {
                "id": "0OiZY1MRHXo",
                "title": "Nostr Wallet Connect Workshop - BBB 2024",
                "duration": 2674
            },
            {
                "id": "6fgFyQEWiK4",
                "title": "Saifedean Ammous: How Bitcoin Could End Wars - Amsterdam 2025",
                "duration": 1691
            },
            {
                "id": "gn5sQC19rvM",
                "title": "MIT Digital Currency Initiative & Future of Bitcoin Research (Neha Nerula) - MIT Bitcoin Expo 2025",
                "duration": 1327
            },
            {
                "id": "QvtnQfVdLYU",
                "title": "What People Get Wrong About Bitcoin Core (Sjors Provoost) - MIT Bitcoin Expo 2025",
                "duration": 1022
            },
            {
                "id": "eRgHb8BGs18",
                "title": "Adopting Bitcoin 2024 - Day 1 Livestream",
                "duration": 32400
            },
            {
                "id": "jc4lkDeozCQ",
                "title": "Eric Trump speaks at Bitcoin Asia 2024",
                "duration": 2447
            },
            {
                "id": "--IFcOIEfl4",
                "title": "No Second Best - Jack Mallers Prague 2024",
                "duration": 2632
            },
            {
                "id": "lW8r9hq8-yU",
                "title": "Bitcoin Core Developer Interview: Gloria Zhao - MIT Bitcoin Expo 2025",
                "duration": 1834
            },
            {
                "id": "ckvTy0Fsc_M",
                "title": "Bitcoin Privacy on Trial: Samourai Wallet & Tornado Cash - MIT Bitcoin Expo 2025",
                "duration": 1526
            },
            {
                "id": "r8rQUEyAksg",
                "title": "BITCOIN DAY 2024",
                "duration": 30695
            },
            {
                "id": "reVebuAf_Cs",
                "title": "Michael Saylor: 21 Ways To Wealth - Bitcoin 2025 Keynote",
                "duration": 2211
            },
            {
                "id": "bLEv8FcfxfE",
                "title": "Why Bitcoin-Backed Lending Will Eat the World (Mauricio di Bartolomeo) - MIT Bitcoin Expo 2025",
                "duration": 874
            },
            {
                "id": "0XnB_ZqL6fo",
                "title": "Freedom Festival 2024 - Mass Adoption",
                "duration": 40
            },
            {
                "id": "e_yg6cLsQHE",
                "title": "Bitcoin Address Poisoning Attacks (Jameson Lopp) - MIT Bitcoin Expo 2025",
                "duration": 1547
            },
            {
                "id": "tO1QTCLrbB8",
                "title": "Matt Odell: Bitcoin-Native Venture Capital - MIT Bitcoin Expo 2025",
                "duration": 1724
            },
            {
                "id": "xCyPbFx0Ktg",
                "title": "Why Bitcoin Must Change - Or Be Left Behind (Jameson Lopp) - MIT Bitcoin Expo 2025",
                "duration": 1438
            },
            {
                "id": "4NoJnPmCVdU",
                "title": "Solving Bitcoin's Quantum Computing Threat: BIP 360 (Hunter Beast) - MIT Bitcoin Expo 2025",
                "duration": 1004
            },
            {
                "id": "veIuDwQTunw",
                "title": "Olaoluwa Osuntokun Keynote - Open Source Stage (Bitcoin 2022)",
                "duration": 1064
            },
            {
                "id": "OwJL0J_nPDE",
                "title": "Open Source Stage - Bitcoin 2022 Conference Day 3 (Full)",
                "duration": 16733
            },
            {
                "id": "j7R6CLnWI4M",
                "title": "Open Source Stage - Bitcoin 2022 Conference Day 1 (Full)",
                "duration": 18352
            },
            {
                "id": "L0Yh6VP6vxU",
                "title": "Open Source Stage - Bitcoin 2022 Conference Day 2 (Full)",
                "duration": 16817
            },
            {
                "id": "BjpzoplkqdI",
                "title": "📺 LIVE: Paris Blockchain Week 2026 | Day 1",
                "duration": 34051
            },
            {
                "id": "mJj6AJZnnBo",
                "title": "📺 LIVE: Paris Blockchain Week 2026 | Day 2",
                "duration": 32607
            },
            {
                "id": "Nqt3BClxlpk",
                "title": "Strategy CEO Phong Le: MIT Bitcoin Expo 2025 Keynote Speech",
                "duration": 1474
            }]
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
                "title": "Run with Bitcoin - Paco De La India",
                "duration": 76
            },
            {
                "id": "mkDpE6SjjCQ",
                "title": "Did the IMF Just KILL Bitcoin in El Salvador? (Joe Nakamoto)",
                "duration": 913
            },
            {
                "id": "BdaiLtKNFQA",
                "title": "The plan 40 Countries in 400 Days - Paco",
                "duration": 4320
            },
            {
                "id": "7A56oZAs7ZQ",
                "title": "El Salvador Bitcoin Adoption Documentary",
                "duration": 1066
            },
            {
                "id": "Ve6oLiWO0Mg",
                "title": "Traveling the World on Bitcoin - Airbtc",
                "duration": 1131
            },
            {
                "id": "LRSQSkiil0M",
                "title": "Inside the Bitcoin Revolution in Africa - Joe Nakamoto",
                "duration": 1068
            },
            {
                "id": "vlf4swtTBSM",
                "title": "Isla Mujeres is Becoming a Bitcoin Paradise! (Here's How)",
                "duration": 313
            },
            {
                "id": "7d7yJktKr2U",
                "title": "Is El Salvador Bending the Knee to the IMF? - John Dennehy (Joe Nakamoto #15)",
                "duration": 3453
            },
            {
                "id": "5hMZkxQtstU",
                "title": "167. Run with Bitcoin with Paco de la India",
                "duration": 5477
            },
            {
                "id": "0Ceey82hFTY",
                "title": "Booking Travel with Bitcoin - Travala",
                "duration": 759
            },
            {
                "id": "sIR0V6VKXLg",
                "title": "How One Woman is Building a Bitcoin Economy From Scratch in Mexico - Isabella Santos (BTC Isla)",
                "duration": 4516
            },
            {
                "id": "zgk-1pSMsZA",
                "title": "WTF the IMF, Tether and Bitcoin in El Salvador - Mike Peterson (Joe Nakamoto #13)",
                "duration": 6247
            },
            {
                "id": "ic_4-EFJogY",
                "title": "From Accenture to Bitcoin Maximalist - Alexandre Laizet",
                "duration": 503
            },
            {
                "id": "e0EPQg20SaQ",
                "title": "What 1792 Days in Bitcoin Taught Me - Get Based TV",
                "duration": 554
            },
            {
                "id": "LXB0d_3WntM",
                "title": "Bitcoin is Ready to Replace the Broken USD - Isabella Santos (BTC Isla)",
                "duration": 3724
            },
            {
                "id": "TauW_pLnstw",
                "title": "The Bitcoin Paradise You Have Never Heard Of - Joe Nakamoto",
                "duration": 1274
            },
            {
                "id": "rudY3-9X7gU",
                "title": "I'm Back From El Salvador (Joe Nakamoto)",
                "duration": 543
            },
            {
                "id": "emS6_vlQKa4",
                "title": "Everyday Bitcoin #3 - Isa Santos (BTC Isla, Get Based)",
                "duration": 2654
            },
            {
                "id": "WoN0SVY73zo",
                "title": "You Can Live on Bitcoin in Lugano - Joe Nakamoto",
                "duration": 1018
            },
            {
                "id": "R8xZd8v7b50",
                "title": "Bitcoin Beach: El Salvador's Bitcoin Economy",
                "duration": 1348
            },
            {
                "id": "4Bmni2lHYo8",
                "title": "Isabella Santos on Bitcoin Community Building",
                "duration": 3644
            },
            {
                "id": "DfDWubdqU5I",
                "title": "I Begged Strangers for Bitcoin in Madeira - Joe Nakamoto",
                "duration": 833
            },
            {
                "id": "PHYCAE2n55M",
                "title": "Isabella Santos on Bitcoin Media, Freedom & Building a Circular Economy",
                "duration": 2271
            },
            {
                "id": "kKSFh5Xxe3w",
                "title": "48 Hours in El Salvador Paying Only With Bitcoin",
                "duration": 1272
            },
            {
                "id": "FelWKV6wVJU",
                "title": "Living on Bitcoin in a Small Town - Joe Nakamoto",
                "duration": 1275
            },
            {
                "id": "QV-m5lNLxeM",
                "title": "Interview with Julian Figueroa From Get Based (Joe Nakamoto)",
                "duration": 4741
            },
            {
                "id": "pxvDunp9820",
                "title": "Bitcoin in Peru: How a Poisoned Town Survives - Joe Nakamoto",
                "duration": 666
            },
            {
                "id": "mxfD7Pef4iU",
                "title": "Building a Bitcoin Circular Economy: The BTC Isla Story",
                "duration": 4383
            },
            {
                "id": "cs3nEVX9ZWA",
                "title": "Bitcoin Is Transforming Access to Electricity and Finance - Gladstein",
                "duration": 1800
            },
            {
                "id": "UPp0Xbk4bFo",
                "title": "The Truth Behind Cuba's Bitcoin Revolution (Joe Nakamoto)",
                "duration": 1602
            },
            {
                "id": "BnR_kB44hy0",
                "title": "Bitcoin Berlín: The Secret Bitcoin City of El Salvador - Joe Nakamoto",
                "duration": 691
            },
            {
                "id": "mmOrwgouveI",
                "title": "The Secret Bitcoin City of El Salvador - Interview with Founders (Joe Nakamoto)",
                "duration": 4516
            },
            {
                "id": "gCi5jPHWVNE",
                "title": "Run with Bitcoin | Paco De la India Mumbai",
                "duration": 1759
            },
            {
                "id": "78YidaGwELw",
                "title": "Building Bottom-Up Bitcoin Economies - Isabella Santos (BTC Isla)",
                "duration": 2653
            },
            {
                "id": "waQJEjiPWhg",
                "title": "Bitcoin Culture Around the World",
                "duration": 305
            },
            {
                "id": "0hwC6BKJMpc",
                "title": "How Bitcoin is Revolutionizing Travel",
                "duration": 592
            },
            {
                "id": "eNOYnGtIm9E",
                "title": "Paco de la India | My Latin Life Podcast 210",
                "duration": 3489
            },
            {
                "id": "UoVsYht7cIo",
                "title": "Isabella Santos - The Unique Voice of Education, Entertainment & Empowerment",
                "duration": 4227
            },
            {
                "id": "Y7kwFxDNcek",
                "title": "Living on bitcoin in El Salvador",
                "duration": 912
            }]
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
                "title": "Funding Bitcoin Open Source - Bitcoin 2022 Conference",
                "duration": 1621
            },
            {
                "id": "JtzwTd9Ur5c",
                "title": "Competing with Free | DerGigi",
                "duration": 1192
            },
            {
                "id": "cmTrCoJKoig",
                "title": "Bitcoin Node From Scratch - Ubuntu + Bitcoin Knots + Solo Mining",
                "duration": 6128
            },
            {
                "id": "-O-BgOiV9AM",
                "title": "UMBREL TO START9 - Migrate Your Lightning Node",
                "duration": 1788
            },
            {
                "id": "9FE4mTr_6EI",
                "title": "How to Set Up a Bitcoin Node (MyNode)",
                "duration": 1062
            },
            {
                "id": "R_KTRRlZ-7c",
                "title": "Web5 Open to Build - Bitcoin 2023",
                "duration": 1071
            },
            {
                "id": "BNRvyrmBUhM",
                "title": "Become a Digital Sovereign with Start9",
                "duration": 2955
            },
            {
                "id": "JsJSsbp9g3M",
                "title": "Bitcoin Privacy is a Human Right",
                "duration": 255
            },
            {
                "id": "wihMTwJ_wWs",
                "title": "Sovereign Computing with Matt Hill of Start9",
                "duration": 2692
            },
            {
                "id": "fsAUhFr1VXU",
                "title": "Bitcoin Privacy Made Simple: Wasabi Wallet Tutorial",
                "duration": 1922
            },
            {
                "id": "DKBJ3_3ZomU",
                "title": "Start9 Embassy - Bitcoin Node And Personal Server Tutorial",
                "duration": 7176
            },
            {
                "id": "6Tr4-DL1c1s",
                "title": "Freedom Money: Der Gigi l Episode 1",
                "duration": 3092
            },
            {
                "id": "Cjxc9ERz2mU",
                "title": "Lightning Privacy: Concerns and Solutions - Open Source Stage (Bitcoin 2022)",
                "duration": 2401
            },
            {
                "id": "TpwnoPUyumA",
                "title": "Phoenix Wallet Tutorial - Self-Custody Lightning",
                "duration": 4158
            },
            {
                "id": "52pSd3I1nac",
                "title": "Wasabi CoinJoin Tutorial - Self Custody Privacy",
                "duration": 5071
            },
            {
                "id": "kmfzATMxCj4",
                "title": "Start9 vs Umbrel - What's the Difference? CEO Matt Hill Explains",
                "duration": 190
            },
            {
                "id": "BtbUGFHZTW8",
                "title": "Federated Chaumian Mints Overview - Bitcoin 2022 Conference",
                "duration": 830
            },
            {
                "id": "NKl-c-TS3yM",
                "title": "Covenants - Open Source Stage (Bitcoin 2022)",
                "duration": 2373
            },
            {
                "id": "mdnkZunIphA",
                "title": "The Role of Bitcoin Core Maintainers & the Path Forward",
                "duration": 1761
            },
            {
                "id": "gOo7rnqXeik",
                "title": "Open Source Software In Bitcoin",
                "duration": 754
            },
            {
                "id": "_bQCkoe4fXU",
                "title": "Web5: The Future of the Bitcoin-Based Internet - Polycarp Nakamoto",
                "duration": 5842
            },
            {
                "id": "QeCIVUH89KY",
                "title": "Switch to Bitcoin Knots on Start9 - Full Sovereignty",
                "duration": 258
            },
            {
                "id": "1XxG_qjY3EY",
                "title": "Home Bitcoin Solo Node Setup Guide (Umbrel)",
                "duration": 529
            },
            {
                "id": "7FWKc8lM4Ek",
                "title": "Neutrino: The Privacy Preserving Bitcoin Light Client",
                "duration": 2644
            },
            {
                "id": "kL0Yc8ngzS0",
                "title": "Bitcoin Fixes Double Standards - Guest Gigi",
                "duration": 4386
            },
            {
                "id": "U9hdav36WAo",
                "title": "How to Use Wasabi Wallet for Bitcoin CoinJoin",
                "duration": 1264
            },
            {
                "id": "3FW7jNB9Qp0",
                "title": "The Future of Lightning Development - Open Source Stage (Bitcoin 2022)",
                "duration": 1790
            },
            {
                "id": "n3Md7m4UQSQ",
                "title": "Preventing Attacks On Bitcoin - Open Source Stage (Bitcoin 2022)",
                "duration": 1502
            },
            {
                "id": "KNaOeLlD6NA",
                "title": "Build a Bitcoin Node on Raspberry Pi with Umbrel",
                "duration": 1675
            },
            {
                "id": "9JKpA7gqbW0",
                "title": "How To Run Your Own Bitcoin Node (And Fight Bitcoin Spam)",
                "duration": 816
            },
            {
                "id": "a0ycGl4jN8w",
                "title": "Run Bitcoin & Lightning Node in 30 mins - Umbrel Home",
                "duration": 1884
            },
            {
                "id": "7fvG11BByD4",
                "title": "Running Bitcoin Knots On Start9",
                "duration": 538
            },
            {
                "id": "t4yuwtIhQIg",
                "title": "Start9: One-Click Bitcoin Node Setup Guide",
                "duration": 4086
            },
            {
                "id": "qFfhr4sApso",
                "title": "RUN A BITCOIN NODE - Simple Tutorial With Umbrel Home",
                "duration": 3940
            },
            {
                "id": "lhzooru_B-o",
                "title": "How to Set Up a Bitcoin Node for just $300 | Step-by-Step Guide",
                "duration": 2148
            },
            {
                "id": "TASQj1hacuI",
                "title": "Bitcoin Privacy - Alex Gladstein",
                "duration": 664
            },
            {
                "id": "XRxbrfbeThg",
                "title": "Gigi on Internet Business Models & Freedom",
                "duration": 5910
            },
            {
                "id": "ekRzqy7D1wk",
                "title": "Cybersecurity Secrets for Protecting Bitcoin",
                "duration": 5437
            },
            {
                "id": "Ld2s9MyMKMU",
                "title": "Fastest way to build a Bitcoin Node in 2024",
                "duration": 532
            },
            {
                "id": "ubj5wpsmqN8",
                "title": "Bitcoin Full Node Security - 11 Tips To Keep Your Node Safe",
                "duration": 830
            },
            {
                "id": "gLCyRFZOdGQ",
                "title": "How to Run a Bitcoin Lightning Node",
                "duration": 2813
            },
            {
                "id": "cDYQ6A69-D4",
                "title": "Enhance Your Bitcoin Journey with Start9's Server Pure Upgrade",
                "duration": 1714
            },
            {
                "id": "ZZKoSmQu30Q",
                "title": "Best Bitcoin Hardware Wallets Compared - BTC Sessions",
                "duration": 3621
            },
            {
                "id": "nRoAyZG2taE",
                "title": "Switch from Bitcoin Core to Knots (Windows, Mac, Start9, Umbrel)",
                "duration": 5301
            },
            {
                "id": "3AmzFPMcgEY",
                "title": "Growth On Bitcoin & Lightning Is EXPLODING | Alyse Killeen - The Bitcoin Layer",
                "duration": 2440
            },
            {
                "id": "dy3vzz9pa3g",
                "title": "SegWit and BIP-110 Signaling Dashboard — Walkthrough",
                "duration": 469
            },
            {
                "id": "r4VBmza3TNw",
                "title": "Bitcoin: Soft Fork vs Hard Fork & BIP-110 Updates",
                "duration": 1400
            },
            {
                "id": "i0-2UhU-o2s",
                "title": "How Bitcoin Incentives and URSFs Kill Minority Soft Forks",
                "duration": 1720
            }]
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
                "title": "Saifedean Ammous - Principles of Economics, Bitcoin Standard & Fiat Standard",
                "duration": 3011
            },
            {
                "id": "soGXgiGoMRU",
                "title": "Broken Money Thesis Presentation - Lyn Alden",
                "duration": 3968
            },
            {
                "id": "Ai5z2T4WhWg",
                "title": "Why Bitcoin Matters - Economical, Ethical And Technological Perspective",
                "duration": 2131
            },
            {
                "id": "V2r0EaJQwLA",
                "title": "Lyn Alden: Bitcoin Long-Term Bull Case - Coin Stories",
                "duration": 687
            },
            {
                "id": "7tQIGuCyOHQ",
                "title": "Jeff Booth Masterclass: The Price of Tomorrow & Truth About Inflation",
                "duration": 4544
            },
            {
                "id": "NNlxZZ6f57Q",
                "title": "Jeff Booth: Why Bitcoin Frees Us From a Broken System",
                "duration": 4100
            },
            {
                "id": "dlCbXoQokx0",
                "title": "Governments Will Accumulate Bitcoin - Mike Alfred on Coin Stories",
                "duration": 640
            },
            {
                "id": "bs_pYdK8CU8",
                "title": "Lyn Alden: Why Our Financial System Fails",
                "duration": 5223
            },
            {
                "id": "jk_HWmmwiAs",
                "title": "How Money & Banking Work - Lyn Alden",
                "duration": 1950
            },
            {
                "id": "VssN8B0NWqY",
                "title": "The Fiat Standard Lecture 5: Universal Debt Slavery - Saifedean",
                "duration": 2853
            },
            {
                "id": "Ux-iV_9KAxk",
                "title": "Jeff Booth: Why Most People Will Get Wiped Out in the Transition",
                "duration": 600
            },
            {
                "id": "dIqs9hGNU9A",
                "title": "Inflation & the Collapse of Civilization",
                "duration": 4021
            },
            {
                "id": "lmfx960EQkY",
                "title": "Mike Maloney - The Best Video Series Ever Made About Money",
                "duration": 1766
            },
            {
                "id": "_nSF9yZWalA",
                "title": "Principles of Economics Lecture 10: Money",
                "duration": 5647
            },
            {
                "id": "HZx7t15d96M",
                "title": "Jeff Booth Explains Why Everything Is Getting More Expensive",
                "duration": 2814
            },
            {
                "id": "k3NN_NZOdhY",
                "title": "Lyn Alden Content: Broken Money Thesis",
                "duration": 3087
            },
            {
                "id": "pZvy0JRz9GE",
                "title": "Saifedean: Bitcoin & Tether - Las Vegas Keynote",
                "duration": 2576
            },
            {
                "id": "XLxGM47GdBU",
                "title": "The Fiat Standard with Dr. Saifedean Ammous",
                "duration": 3371
            },
            {
                "id": "drs6Q_OX0HE",
                "title": "Austrian Economics Intro - The Bitcoin Way",
                "duration": 5260
            },
            {
                "id": "eBTHI27B5rY",
                "title": "Bitcoin & The Return To Prosperity Through Deflation - Jeff Booth",
                "duration": 2765
            },
            {
                "id": "iFDe5kUUyT0",
                "title": "The Biggest Scam In History Of Mankind - Hidden Secrets of Money Ep 4",
                "duration": 1775
            },
            {
                "id": "Z71sOLsZpkI",
                "title": "Bitcoin Isn't Worth $65K, Your Dollars Are Worth Nothing - Jeff Booth",
                "duration": 10059
            },
            {
                "id": "TLhbc3moELQ",
                "title": "The Gold Standard: Chapters 1-4",
                "duration": 5575
            },
            {
                "id": "qawzs0QSzbI",
                "title": "Everything You've Ever Been Told About Money Is a Lie - Jeff Booth",
                "duration": 4218
            },
            {
                "id": "Ih0e8AXT_-s",
                "title": "Broken Money | Oslo Freedom Forum",
                "duration": 1200
            },
            {
                "id": "lB3mQImM-5Y",
                "title": "The Fiat Standard by Saifedean Ammous (Full Presentation)",
                "duration": 273
            },
            {
                "id": "G2vAm2hfW9U",
                "title": "Why Deflation is the Key to Abundance - Jeff Booth",
                "duration": 3521
            },
            {
                "id": "N41OC2sazbw",
                "title": "Jeff Booth on Bitcoin, AI, and Why Deflation Is Coming",
                "duration": 3570
            },
            {
                "id": "hdtY_iMeVEg",
                "title": "Bitcoin Will Hit $100 Trillion Market - Saifedean Ammous",
                "duration": 123
            },
            {
                "id": "FXvQcuIb5rU",
                "title": "The Immaculate Conception: Bitcoin vs Fiat Standard - Saifedean (EP 203)",
                "duration": 7126
            },
            {
                "id": "yDpMGUZZC4c",
                "title": "Bitcoin Is the Internet of Money - David Marcus on Coin Stories",
                "duration": 2597
            },
            {
                "id": "fOpnpECKaY8",
                "title": "Bitcoin, Austrian Economics & Future of Money - Seb Bunney",
                "duration": 4717
            },
            {
                "id": "TmV4Ns_ngSM",
                "title": "The Economics of Bitcoin - Saifedean",
                "duration": 2399
            },
            {
                "id": "DKaZ-h-Wwhg",
                "title": "Bitcoin & Austrian Economics - Peter St. Onge",
                "duration": 3087
            },
            {
                "id": "PQ2wj8dnpqo",
                "title": "What is money? | Ammous & Fridman",
                "duration": 624
            },
            {
                "id": "6RsPt2bhi1o",
                "title": "Jeff Booth: Bitcoin Crashed 30% - Why I Feel Incredible",
                "duration": 3769
            },
            {
                "id": "zr4eD3g5uQE",
                "title": "You Will Never Look At Bitcoin The Same Way Again - Jeff Booth",
                "duration": 4215
            },
            {
                "id": "t7rYIkl6lIQ",
                "title": "The Fiat Standard: Lecture 1 - Saifedean Ammous",
                "duration": 3110
            },
            {
                "id": "gp4U5aH_T6A",
                "title": "Bitcoin, Anarchy & Austrian Economics - Lex Fridman & Saifedean",
                "duration": 15281
            },
            {
                "id": "AdaHyUmRvCU",
                "title": "Austrian Economics & Monetary Policy of Bitcoin",
                "duration": 1095
            },
            {
                "id": "8rYl8wEotZk",
                "title": "Strategy CEO on Bitcoin Yields & Adoption - Coin Stories",
                "duration": 4025
            },
            {
                "id": "GbLndO2XfuI",
                "title": "Where Does Money Come From - Hidden Secrets Of Money Ep 5",
                "duration": 1799
            },
            {
                "id": "UIhieMtB_A0",
                "title": "The Everything Bubble Is Over: Michael Howell's Warning for 2026 - The Bitcoin Layer",
                "duration": 4085
            },
            {
                "id": "uRDk8BxQP0g",
                "title": "Will Private Credit Cause a Crisis? - The Bitcoin Layer",
                "duration": 412
            },
            {
                "id": "FMntwaNOEj4",
                "title": "Bitcoin Is Stupid Cheap Right Now | James Van Straten, CoinDesk - The Bitcoin Layer",
                "duration": 1582
            },
            {
                "id": "GA_7P8RdyRU",
                "title": "Oil Shock, Stablecoin Surge, and Bitcoin Isn't Flinching - The Bitcoin Layer",
                "duration": 312
            },
            {
                "id": "7fAhxz8GIAg",
                "title": "The Liquidity Signal That Called Bitcoin's Drop Is Still Red - The Bitcoin Layer",
                "duration": 1692
            },
            {
                "id": "7Nw64Jfb2Nw",
                "title": "Global Macro Update: Inflation Cools, Bond Yields Drop, & Bitcoin Reacts - The Bitcoin Layer",
                "duration": 1955
            },
            {
                "id": "8mpiEplIfU8",
                "title": "Global Macro Update: Gold, Silver, Bitcoin, and the Breakdown of the WTO Era - The Bitcoin Layer",
                "duration": 3711
            },
            {
                "id": "i42PYv_ouY8",
                "title": "JAPAN RATE CHECK Triggers a DOLLAR INDEX COLLAPSE - The Bitcoin Layer",
                "duration": 1006
            },
            {
                "id": "wW35okWUurM",
                "title": "Gold at $5,000 Signals MASSIVE Changes to the World Order - The Bitcoin Layer",
                "duration": 3419
            },
            {
                "id": "GDZqw6QkW-U",
                "title": "Is China Sitting on the BIGGEST DEBT BOMB in Modern History? - The Bitcoin Layer",
                "duration": 2617
            },
            {
                "id": "Xm47eTYJm_w",
                "title": "$95,000 Bitcoin & Fed Independence - The Bitcoin Layer",
                "duration": 1408
            },
            {
                "id": "crETxyQczyw",
                "title": "$1 QUADRILLION In Global Wealth: How Does It Impact Bitcoin? - The Bitcoin Layer",
                "duration": 2327
            },
            {
                "id": "OZVV62lqytw",
                "title": "US Treasuries MUST STABILIZE for Bitcoin to Move Higher - The Bitcoin Layer",
                "duration": 2192
            },
            {
                "id": "TwQugFm2qoo",
                "title": "Why STRATEGY Stands Alone & Why Most Bitcoin Treasury Companies Cannot Last - The Bitcoin Layer",
                "duration": 2348
            },
            {
                "id": "wzxydNI2-Go",
                "title": "INTEREST EXPENSE EXPLODES: Why The Fed Must Cut & What It Means For Bitcoin - The Bitcoin Layer",
                "duration": 1288
            },
            {
                "id": "NqBdAnhWB4U",
                "title": "Bitcoin Holds $90,000: Volatility, Yields, & The FED'S NEXT PRINT - The Bitcoin Layer",
                "duration": 1663
            },
            {
                "id": "mKNojhzp_oY",
                "title": "Can NVIDIA's EARNINGS JOLT Spark a Bitcoin Reversal? - The Bitcoin Layer",
                "duration": 1751
            },
            {
                "id": "_UA2lcEKjLs",
                "title": "Inside McKinsey's Global Wealth Report: What It Means for Bitcoin - The Bitcoin Layer",
                "duration": 1993
            },
            {
                "id": "BcS3QzXtfQc",
                "title": "Bitcoin Holds $100,000 as Stocks Recover: TBL Liquidity Explained - The Bitcoin Layer",
                "duration": 2291
            },
            {
                "id": "usUfMQcu9YQ",
                "title": "How the Fed Lost Control of Liquidity (and What It Means for Bitcoin) - The Bitcoin Layer",
                "duration": 2226
            },
            {
                "id": "EbTpOiO_-xA",
                "title": "Fed Liquidity Crunch Explained: Repo, QT, & Bitcoin's Reaction - The Bitcoin Layer",
                "duration": 1157
            },
            {
                "id": "CEmJQYEdYpk",
                "title": "Liquidity Tightens AGAIN: What the Repo Market Is Telling Us - The Bitcoin Layer",
                "duration": 1215
            },
            {
                "id": "wMhZD_7lbkU",
                "title": "THE FED ENDS QT: Fiscal Dominance, Repo Stress, & Bitcoin's Signal - The Bitcoin Layer",
                "duration": 2353
            },
            {
                "id": "jsoMWIx17Jc",
                "title": "A US and Argentina soybean alliance might be what pushes it over the edge. - The Bitcoin Layer",
                "duration": 162
            },
            {
                "id": "nvVR_fVU7Bc",
                "title": "Argentina just told China: no thanks. They want the U.S. as their 'partner of choice.' - The Bitcoin Layer",
                "duration": 125
            },
            {
                "id": "tBnsQeTbMU8",
                "title": "How High Can Gold & Silver Go?",
                "duration": 797
            },
            {
                "id": "2xW6Mg9k9l8",
                "title": "11 - The Coming Dollar Collapse",
                "duration": 1158
            },
            {
                "id": "tctq51pjbSY",
                "title": "8. Is Inflation Actually Necessary?",
                "duration": 319
            },
            {
                "id": "VgqH9lPiAbY",
                "title": "10 - What Comes After The Dollar?",
                "duration": 242
            },
            {
                "id": "1sAK4pORJkY",
                "title": "9 - Hyperinflation & Collapse (Extreme Case)",
                "duration": 153
            },
            {
                "id": "-SQbX9W0TBM",
                "title": "8 - Central Banking - Too Much Power?",
                "duration": 150
            },
            {
                "id": "Fn2_d5p8EcI",
                "title": "7 - Boom & Bust Cycles: A Feature of Fiat Money",
                "duration": 177
            },
            {
                "id": "0v4z6r6_6QI",
                "title": "6 - How New Money Benefits The Rich (Cantillon Effect)",
                "duration": 120
            },
            {
                "id": "QrUfS6SBBbM",
                "title": "5 - Why Government Debt Means Inflation is Necessary",
                "duration": 205
            },
            {
                "id": "aKuKbNpGvys",
                "title": "3 - The Ultimate Scam! How Banks Steal from YOU!",
                "duration": 201
            },
            {
                "id": "lxgDRK5cRhA",
                "title": "Episode 2: Bitcoin vs Gold: Why Digital Gold is Better",
                "duration": 481
            },
            {
                "id": "Zxr7W7Mg9pY",
                "title": "2: Inflation is STEALING from you! And How you can stop it!",
                "duration": 264
            },
            {
                "id": "vkV8r5udf18",
                "title": "1: Why Fiat Currencies are Ruining Your Life!",
                "duration": 336
            },
            {
                "id": "Vw5wKr_TJm0",
                "title": "HYPERBITCOINIZATION",
                "duration": 694
            },
            {
                "id": "DKDGXT3SENI",
                "title": "How will Bitcoin fare in the coming economic collapse?",
                "duration": 317
            },
            {
                "id": "csGEhR7JNVU",
                "title": "Bitcoin to 100,000,000 dollars?",
                "duration": 435
            },
            {
                "id": "_9JPeiTvREA",
                "title": "How Societies Collapse",
                "duration": 670
            },
            {
                "id": "DgaAU2eZLCI",
                "title": "Average Sales Price for New Houses, Bitcoin vs Dollar (11/6/25 Update)",
                "duration": 94
            },
            {
                "id": "VN3h0gmsuL4",
                "title": "Bitcoin Annualized Issuance Rate (Monetary Inflation) (9/21/25 Update)",
                "duration": 106
            },
            {
                "id": "77GH63y-UnY",
                "title": "Average Price: Electricity per Kilowatt-Hour in Average U.S. City, Bitcoin vs Dollar (9/9/25 Update)",
                "duration": 93
            },
            {
                "id": "LpccPgtC56g",
                "title": "Average Price: Ground Beef in Average U.S. City, Bitcoin vs Dollar (8/2/25 Update)",
                "duration": 93
            },
            {
                "id": "CZKA01K3vig",
                "title": "The Dollar is Crashing in Bitcoin Terms (7/17/25 Update)",
                "duration": 93
            },
            {
                "id": "y307cs3EV44",
                "title": "Economics of Dust: Post-Ordinals Bitcoin Output Analysis w/ Commentary",
                "duration": 614
            },
            {
                "id": "qZSjJk70FTA",
                "title": "Economics of Dust: Post-Ordinals Bitcoin Output Analysis",
                "duration": 70
            },
            {
                "id": "c8Utm_op9Ts",
                "title": "Bitcoin Annualized Issuance Rate (Monetary Inflation) (2/27/25 Update)",
                "duration": 103
            },
            {
                "id": "D2DLuDfYbRU",
                "title": "Bitcoin Annualized Issuance Rate (Monetary Inflation) (9/17/24 Update)",
                "duration": 99
            },
            {
                "id": "8PWRE5Ygam0",
                "title": "Bitcoin's Emergence As Sound Money",
                "duration": 1641
            }]
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
                "title": "The HRF's Fight for Freedom: Tools and Challenges for Activists - Gladstein",
                "duration": 2300
            },
            {
                "id": "n5K1lEDv8aM",
                "title": "Afghan Women Using Bitcoin Under Taliban - Gladstein",
                "duration": 741
            },
            {
                "id": "H-fQ7i8q5C8",
                "title": "Edward Snowden On Bitcoin",
                "duration": 1723
            },
            {
                "id": "8Aofh-rx_l8",
                "title": "Bitcoin's Censorship Resistance Makes It Superior - Breedlove",
                "duration": 353
            },
            {
                "id": "d5_cYWLpDs8",
                "title": "A Brief Look at Bitcoin Maximalism - Guy Swann",
                "duration": 1664
            },
            {
                "id": "GNzyaxizrNo",
                "title": "This Video Is For Ross Ulbricht - Get Based TV",
                "duration": 1076
            },
            {
                "id": "IBY8SdA3W4Y",
                "title": "Bitcoin for Generational Wealth & Freedom - Breedlove",
                "duration": 1589
            },
            {
                "id": "R7Z3IF5AgJI",
                "title": "Whitney Webb's Urgent Warning to the Bitcoin Community - Get Based TV",
                "duration": 881
            },
            {
                "id": "Y5wgZ3rFayQ",
                "title": "Bitcoin is Monetary Free Speech",
                "duration": 521
            },
            {
                "id": "r3f6liCAXzA",
                "title": "Alex Gladstein: Bitcoin, Freedom & Human Rights",
                "duration": 3566
            },
            {
                "id": "xLYYh4aPXAM",
                "title": "Bitcoin Is Protecting Human Rights - Alex Gladstein",
                "duration": 338
            },
            {
                "id": "RNHi8Qj2KrY",
                "title": "Ethereum - How A Lie Became Worth Billions - Get Based TV",
                "duration": 696
            },
            {
                "id": "PesTO9MRqJo",
                "title": "Bitcoin and Time with Gigi",
                "duration": 6150
            },
            {
                "id": "ZYN4X_l1ZXg",
                "title": "Financial Freedom and Bitcoin - HRF",
                "duration": 2695
            },
            {
                "id": "fSgsYDD2ob4",
                "title": "Alex Gladstein - The Role of Bitcoin for Human Rights",
                "duration": 1698
            },
            {
                "id": "lwbUwl8cNAI",
                "title": "Did The Bible Warn Us About Bitcoin? - Get Based TV",
                "duration": 943
            },
            {
                "id": "BoHNkX4OWQA",
                "title": "Jack Mallers on Bitcoin for El Salvador",
                "duration": 244
            },
            {
                "id": "lfPZteWuH3k",
                "title": "Crypto-Friendly Countries Interview",
                "duration": 2008
            },
            {
                "id": "zV_A2yMZl0w",
                "title": "Alex Gladstein: Bitcoin Privacy & Freedom - Bitcoin Magazine",
                "duration": 793
            },
            {
                "id": "oDaTIFKe3k4",
                "title": "4 Best Countries for Crypto Millionaires",
                "duration": 459
            },
            {
                "id": "Z_p70BzkMAs",
                "title": "Bitcoin Protects Human Rights - Gladstein & Balaji",
                "duration": 3118
            },
            {
                "id": "iWpeSs4yWZ8",
                "title": "THESE CELEBRITIES Might Be Arrested for Promoting Cryptocurrency? - Get Based TV",
                "duration": 61
            },
            {
                "id": "KY72n6UFg1s",
                "title": "Tax-Friendly Countries for Investors",
                "duration": 486
            },
            {
                "id": "kUiokNq5N1g",
                "title": "Snowden: CBDCs Are 'Cryptofascist Currency' - A Perversion of Crypto",
                "duration": 298
            },
            {
                "id": "dKDnkf6c250",
                "title": "Why Sell Your House for Bitcoin? - Breedlove Defense",
                "duration": 629
            },
            {
                "id": "1jdFBnoNuOU",
                "title": "Debt. Greed. Inflation. The Bible Saw It Coming. - Get Based TV",
                "duration": 910
            },
            {
                "id": "AcWcusXqClo",
                "title": "What Edward Snowden Just Said About Bitcoin",
                "duration": 471
            },
            {
                "id": "A-QpLdoDF14",
                "title": "Financial Freedom Against Tyranny",
                "duration": 572
            },
            {
                "id": "s2bVOVdSrN0",
                "title": "Digital IDs Just Went Live - Say Goodbye To Your Privacy & Money",
                "duration": 2231
            },
            {
                "id": "9O1u-NyQpI0",
                "title": "Why Financial Freedom Matters - Alex Gladstein",
                "duration": 1602
            },
            {
                "id": "LMeNe1tBsr4",
                "title": "Oslo Freedom Forum 2024 - Financial Freedom Track Full Livestream",
                "duration": 23584
            },
            {
                "id": "OPd9NcyIuy0",
                "title": "Edward Snowden: The Danger of CBDCs",
                "duration": 547
            },
            {
                "id": "ril70QIDz24",
                "title": "Bitcoin Is the Embodiment of Human Rights - Anita Posch",
                "duration": 1610
            },
            {
                "id": "p8vLlp67UnA",
                "title": "Why I Moved to Dubai - Nomad Capitalist",
                "duration": 533
            },
            {
                "id": "6QiDB-RwGGw",
                "title": "Best Countries for Digital Nomads",
                "duration": 821
            },
            {
                "id": "LNAFBnN4AHg",
                "title": "How The Bible Helped Me Understand The Capital War - The Bitcoin Layer",
                "duration": 2664
            },
            {
                "id": "WxggMzuGMsI",
                "title": "The Philosophy of Bitcoin & Fiat: Credit, Justice, & Sound Money - The Bitcoin Layer",
                "duration": 2399
            },
            {
                "id": "5l2wpPM-8IY",
                "title": "The Global Refugee Crisis & The Bitcoin Solution - The Bitcoin Layer",
                "duration": 2071
            },
            {
                "id": "XVSrPznq8ZU",
                "title": "Bitcoin Against Autocracy: A Modern Tool for Freedom - The Bitcoin Layer",
                "duration": 1042
            },
            {
                "id": "isiy70T-rKE",
                "title": "The Economic Philosophy of Bitcoin, Part II with Marty Bent | The Bitcoin Layer - The Bitcoin Layer",
                "duration": 3554
            },
            {
                "id": "2xRp4-9pZmM",
                "title": "The Economic Philosophy of Bitcoin, Part I with Bitstein | The Bitcoin Layer - The Bitcoin Layer",
                "duration": 3333
            },
            {
                "id": "8xurGFoKfjo",
                "title": "Episode 6: Bitcoin Self Custody: Financial Freedom",
                "duration": 250
            },
            {
                "id": "RLxi0jU-AXE",
                "title": "Bitcoin Self Custody: Passphrases",
                "duration": 1937
            },
            {
                "id": "Hee0elVtA9k",
                "title": "Bitcoin Self Custody: Signing Devices & Software Wallets",
                "duration": 790
            },
            {
                "id": "_MBEzS9GAME",
                "title": "Bitcoin Self Custody Q&A (12/19/23)",
                "duration": 3101
            }]
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
                "title": "Becoming a Sovereign Individual via Food & the Beef Initiative - Texas Slim",
                "duration": 3828
            },
            {
                "id": "iW419hInhHw",
                "title": "The Beef Initiative with Texas Slim (What is Money)",
                "duration": 3107
            },
            {
                "id": "6kEyLJMILU0",
                "title": "Texas Slim: Saving The American Rancher - The Crisis In The Beef Industry",
                "duration": 6099
            },
            {
                "id": "KcV9Dhz9gHY",
                "title": "Rebuilding El Salvador's Cattle Industry with Tom Taber",
                "duration": 2954
            },
            {
                "id": "i8Nq2pcNp60",
                "title": "Texas Slim & Jake Wolki: Beef Initiative & Industrial Food Complex",
                "duration": 3326
            },
            {
                "id": "iAEgMhq_FJs",
                "title": "Starting & Scaling a Successful Regenerative Ranching Business",
                "duration": 6991
            },
            {
                "id": "urKG9oi0krc",
                "title": "Exit The Matrix - Buy BTC Eat Meat",
                "duration": 7180
            },
            {
                "id": "TWkKPijaDyQ",
                "title": "Proof of Work Ep2: Fitness and Bitcoin",
                "duration": 4184
            },
            {
                "id": "JTDVwPdvu3E",
                "title": "Why We Need Our Farmers, and Our Farmers Need US",
                "duration": 4976
            },
            {
                "id": "TBd8GGKgRWo",
                "title": "Carnivore Legends Explain the Importance of Local Farms and Red Meat",
                "duration": 724
            },
            {
                "id": "cthDKq4SEqk",
                "title": "From Unhealth to Health - The Meat Mafia",
                "duration": 1826
            },
            {
                "id": "O3jeBF7S9ss",
                "title": "Treadmill, Chat, and Bitcoin",
                "duration": 2444
            },
            {
                "id": "xn9WtVYy1gU",
                "title": "Bitcoin Will FIX Our Food System - Here's How! w/ Texas Slim",
                "duration": 8826
            },
            {
                "id": "W4OQaqqFKj0",
                "title": "Proof of Work Ep1: Fitness and Bitcoin",
                "duration": 2872
            },
            {
                "id": "Pvmp0L5cbl8",
                "title": "Iron Sharpens Iron - Proof of Work Fitness",
                "duration": 90
            },
            {
                "id": "ohR7EIby7yY",
                "title": "Texas Slim: Truth Behind The War on Beef",
                "duration": 562
            },
            {
                "id": "CT8yuKUQ_No",
                "title": "Low Time Preference Aging - P.D. Mangan",
                "duration": 7216
            },
            {
                "id": "FJB7e8PP0wU",
                "title": "Proof Of Work(out) - July 2022",
                "duration": 148
            },
            {
                "id": "hL54mn7vW8w",
                "title": "Surf, Eat Meat, Repeat - Bitcoin Lifestyle",
                "duration": 2959
            },
            {
                "id": "vpEq89vPNHc",
                "title": "Jeff Booth on What if Everything We Know About Free Markets is Wrong?",
                "duration": 3835
            },
            {
                "id": "lhHKljqRa-M",
                "title": "Low Time Preference Lifestyle - Bitcoin Way",
                "duration": 3142
            },
            {
                "id": "mVMU1AFiSV0",
                "title": "Low Time Preference, Bitcoin and Health",
                "duration": 1594
            },
            {
                "id": "rwP_ggwOqTg",
                "title": "EMBRACE Deflation With Bitcoin! Guest Jeff Booth",
                "duration": 3891
            },
            {
                "id": "Rm5_wCObeQI",
                "title": "Carnivore Diet, Health Care Crisis & Bitcoin",
                "duration": 4920
            },
            {
                "id": "LjCRWwm0Xdk",
                "title": "Bitcoin Health Stack - Mind Body Sats",
                "duration": 1667
            },
            {
                "id": "rQZLFNkh0W8",
                "title": "Dr. Anthony Chaffee on The Future Of Farming",
                "duration": 4982
            },
            {
                "id": "c9D8p1kG0Cc",
                "title": "Bitcoin and Health with Jeff Booth",
                "duration": 632
            },
            {
                "id": "KfNkDQ-NI9U",
                "title": "Shawn Baker, the Carnivore MD",
                "duration": 6617
            },
            {
                "id": "BQCOJlFXvpU",
                "title": "The Carnivore Diet & Bitcoin - Dr. Shawn Baker",
                "duration": 6389
            },
            {
                "id": "jn8uc92Oymo",
                "title": "Bitcoin Is Transforming Health & Energy Access Globally",
                "duration": 3862
            },
            {
                "id": "pm7Ff5viURM",
                "title": "Jeff Booth Reveals How Much Bitcoin You Need!",
                "duration": 615
            }]
    },
    {
        "id": "history",
        "name": "History & Documentaries",
        "emoji": "📜",
        "desc": "Bitcoin's past — origins, cypherpunks, mainstream films",
        "color": "#92400e",
        "videos": [
            {"id":"kyija0bPeIY","title":"Behind Silk Road: How Ross Ulbricht Brought Black Market to the Web (Full Doc)","duration":3263},
            {"id":"NAg_rJ8mfVs","title":"The Government Hates Him - The Ross Ulbricht Story","duration":554},
            {"id":"oksraL7wN6Q","title":"God Bless Bitcoin - HD Version","duration":5352},
            {"id":"tPYYbIH372Y","title":"Bitcoin: History of \"Wholecoins\" (Outputs Worth Exactly 1 BTC)","duration":102},
            {"id":"oEgPTIN5hVE","title":"How Bitcoin Started: The Untold Story of Satoshi (Full Documentary)","duration":833},
            {"id":"hzPSxy55MPE","title":"Bitcoin: History of \"M-coins\" (Outputs Worth Exactly 1,000 BTC)","duration":106},
            {"id":"4_4lFX8t3I8","title":"Evolution of Cryptocurrency: 1983-2100","duration":488},
            {"id":"d9DqvX7CJOc","title":"The Fiat Standard: Can Bitcoin Fix This? - Saifedean","duration":5591},
            {"id":"hk3OLML16xY","title":"History of Bitcoin: 16 Year Anniversary","duration":611},
            {"id":"b1ruW89S4PM","title":"Satoshi Nakamoto: The Mysterious Genius Behind Bitcoin","duration":709},
            {"id":"EcYnz29l8_0","title":"Who ACTUALLY Created Bitcoin","duration":767},
            {"id":"tWU3O3X5kKE","title":"The Story behind Bitcoin Pizza Day","duration":119},
            {"id":"mgmVEtSgu3o","title":"Bitcoin FUD - Full Documentary","duration":3592},
            {"id":"pbFEexyOwkw","title":"Bitcoin History: From Zero to Hero","duration":793},
            {"id":"dMSv4mgiy1o","title":"How Bitcoin's Early Cypherpunks Paved the Way","duration":473},
            {"id":"jsccmbOT6FU","title":"Biggest Bitcoin Holders 2024","duration":228},
            {"id":"ecy7lLjDK6s","title":"Bitcoin: History of \"L-coins\" (Outputs Worth Exactly 50 BTC)","duration":109},
            {"id":"F5AiHEzu-uc","title":"Who is Satoshi Nakamoto? The True Story of Bitcoin's Creator","duration":78},
            {"id":"_Kav2K1DVWo","title":"The Most Elusive Identity On The Internet (ft. Nexpo)","duration":1802},
            {"id":"ao9SdxPtuIE","title":"Satoshi Nakamoto & The Origins of Bitcoin","duration":167},
            {"id":"tdxY61IJ24E","title":"Bitcoin: Who is Satoshi Nakamoto? - An Investigation","duration":3183},
            {"id":"QpbTljF0vY8","title":"The History of Bitcoin Mining - Doc","duration":148},
            {"id":"eoBmOf4GDyo","title":"Arrivano i Cypherpunk - History","duration":1000},
            {"id":"Fx0OcKcLQ0A","title":"Bitcoin's Creator Unveiled? Theories about Satoshi Nakamoto","duration":1826},
            {"id":"GpMP6Nh3FvU","title":"The Dark Side Of The Silk Road","duration":4485},
            {"id":"BoboO6QPGow","title":"Satoshi Nakamoto Goes Public and Denies He's Bitcoin Founder","duration":79},
            {"id":"3XEuqixD2Zg","title":"God Bless Bitcoin - Full Documentary","duration":5359},
            {"id":"DyV0OfU3-FU","title":"Satoshi Nakamoto - The Hidden History","duration":1556},
            {"id":"fsfoqdqyykI","title":"The Most Illegal Business In The World: Silk Road","duration":2672},
            {"id":"HDKQulqVCQg","title":"Bitcoin and the End of History","duration":956},
            {"id":"ZKwqNgG-Sv4","title":"Bitcoin: The End of Money As We Know It","duration":1471},
            {"id":"eRzb4vEneHA","title":"Historical Bitcoin UTXO Set Animation (4 Hour Version)","duration":14711},
            {"id":"4yFjOoDp6zY","title":"Bitcoin: History of \"Pi-coins\" (Outputs Worth Exactly 3.14 BTC or 3.14159265 BTC)","duration":104},
            {"id":"m7_WDzPyoqU","title":"I Live 500 Feet From a Bitcoin Mine - Investigative Doc","duration":1270},
            {"id":"N4m86PL4qs8","title":"Bitcoin: History of \"X-coins\" (Outputs Worth Exactly 10 BTC)","duration":109},
            {"id":"f-4Rs3Sqlhc","title":"History of Bitcoin - Complete Timeline","duration":602},
            {"id":"phtHSjSrsJ8","title":"What is Bitcoin's UNTOLD History?","duration":927},
            {"id":"4_tAOuMVFd0","title":"Digital Gold - Full Documentary","duration":3551},
            {"id":"dYFMoK1nDmc","title":"60 Minutes: Bitcoin Beach El Salvador - CBS","duration":65},
            {"id":"yt4L67C5_q8","title":"Historical Price of 1 USD in Terms of Bitcoin (11/12/24 Update)","duration":87},
            {"id":"GTdCeFyBVyk","title":"Historical Bitcoin UTXO Set Animation (2 Minute Version)","duration":106},
            {"id":"8Z4hGvUET8I","title":"Bitcoin: Beyond The Bubble","duration":2086},
            {"id":"XzSFu7aMCu8","title":"Truth About Satoshi Nakamoto - Complete Documentary","duration":356},
            {"id":"iSF0KGsFuI8","title":"Money Electric: The Bitcoin Mystery | HBO Trailer","duration":160},
            {"id":"vjGhiac85h4","title":"The History of Crypto Goes Further Back Than You Think","duration":603},
            {"id":"Peih23WVK54","title":"Dark Web King: From Student to Billionaire Drug Lord - Ross Ulbricht","duration":1511},
            {"id":"gcwnpvODd-8","title":"The Rise and Rise of Bitcoin | Official Trailer","duration":143},
            {"id":"Yh1dOmQJoWQ","title":"The Rise and Rise of Bitcoin (FULL)","duration":5796},
            {"id":"f39jflibxH4","title":"Oppenheimer vs Nakamoto","duration":590},
            {"id":"7RlaC9ZJNtA","title":"Unmasking the Creator of Bitcoin","duration":3198},
            {"id":"DomSK_oUGr4","title":"History of Bitcoin: 15 Year Anniversary","duration":579},
            {"id":"o-c_j2tgxDU","title":"What's REALLY Wrong with HBO's Bitcoin Documentary","duration":304},
            {"id":"h3nlVsy81wI","title":"The Bitcoin Mystery Revealed! - Swan","duration":584},
            {"id":"iqVuthH57wY","title":"The Evolution of Bitcoin Mining!","duration":3973},
            {"id":"QTyzyP2Afys","title":"Cryptocurrencies - The Future of Money? (DW Documentary)","duration":2547},
            {"id":"9vM0oIEhMag","title":"Cypherpunks Write Code - ReasonTV","duration":2635},
            {"id":"gQ8XKns2ipc","title":"The Satoshi Mystery: Origins of Bitcoin","duration":3191},
            {"id":"0r6zMdHcpW0","title":"Was Bitcoin a CIA Project? The Hidden Origins of Satoshi","duration":10222},
            {"id":"Bze53qwHS8o","title":"Mystery Founder of Bitcoin: Uncovering Satoshi Nakamoto - CNBC","duration":395},
            {"id":"SlbyHzYZXjA","title":"FBI Agent Explains Silk Road","duration":421},
            {"id":"GZI0qo3diUo","title":"Unlocking Crypto - The Bitcoin Field Guide","duration":6500},
            {"id":"iVym9wtopqs","title":"Banking on Bitcoin - Full Documentary","duration":5367},
            {"id":"LSvOFKf9okk","title":"Secret Monetary System Explained - Mike Maloney","duration":1289},
            {"id":"tEnDP6p_9rY","title":"Bitcoin Mining's Days Are Numbered - Cormint CEO","duration":2971},
            {"id":"IFVrVI4rZHM","title":"What Happened To Bitcoin's Founder?","duration":624},
            {"id":"chcASJW1pMs","title":"Satoshi Nakamoto - The Beginning of Bitcoin Documentary","duration":5021},
            {"id":"4d4OE7D2hqA","title":"Bitcoin: History of \"D-coins\" (Outputs Worth Exactly 500 BTC)","duration":107},
            {"id":"wSh_KzcY_dA","title":"60 Minutes: Stories About Cryptocurrency - CBS","duration":4000},
            {"id":"Mcz_4MvPlOE","title":"Cypherpunks & Bitcoin: End of History","duration":956},
            {"id":"OH-xRaHdqy4","title":"Japan Bitcoin Documentary - Why One Tokyo Company Is Changing Finance","duration":2326},
            {"id":"lFw-3wynj-o","title":"Adam Back is Satoshi Nakamoto - Hoskinson & Lex Fridman","duration":228},
            {"id":"3n_WnVPhRTo","title":"The Satoshi Nakamoto Enigma","duration":384},
            {"id":"FwWU1W7IGbY","title":"Seeking Satoshi - The Mystery Bitcoin Creator (Part 1)","duration":3353},
            {"id":"M1JKLXxFDZc","title":"Unconditional Advice for the Next Decade - Saifedean Ammous","duration":1282},
            {"id":"9cb94OuCR9U","title":"The Alleged CIA Connection to Bitcoin's Mysterious Origin","duration":498},
            {"id":"M7ZLNczMeS0","title":"Deep Web: The Untold Story of Bitcoin and the Silk Road","duration":5183},
            {"id":"DGNhX8nz7Eg","title":"Seeking Satoshi - The Mystery Bitcoin Creator (Part 2)","duration":2884},
            {"id":"S70MSDaLAKw","title":"Why Bitcoin's Creator Disappeared Forever","duration":1379},
            {"id":"3Cr1efEBo_M","title":"INSIDE SILK ROAD: The Billion-Dollar Dark Web Drug Empire","duration":654},
            {"id":"LjNMgeqUgks","title":"The Man Who Spent Millions of Bitcoin on Pizza - 60 Minutes","duration":42},
            {"id":"9npQ5f74Nr4","title":"The Cypherpunks: Freedom, Privacy, and the Genesis of Bitcoin","duration":3078},
            {"id":"KjMQvN7Fajs","title":"Who Created Bitcoin? The Mystery of Satoshi Nakamoto","duration":978}
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
                "title": "What is Inflation for Kids - Financial Education",
                "duration": 420
            },
            {
                "id": "EfKuZayeksI",
                "title": "Bitcoin for Kids - Simple Explanation",
                "duration": 692
            },
            {
                "id": "94I9L90h0_s",
                "title": "What is Cryptocurrency? - Kid-Friendly",
                "duration": 117
            },
            {
                "id": "vPMDpb9ho4s",
                "title": "Blockchain for Kids - Blockchain Explained for Beginners",
                "duration": 163
            },
            {
                "id": "9ymZlz2l53I",
                "title": "What is Bitcoin? For Kids and Teens",
                "duration": 107
            },
            {
                "id": "DQhF_4J2GKo",
                "title": "What is Cryptocurrency? Learn with Jess - STEM Kids Clubhouse",
                "duration": 704
            },
            {
                "id": "FtaUelnAXrc",
                "title": "Tuttle Twins S1E6 - Full Episode (Regulation Station)",
                "duration": 1434
            },
            {
                "id": "qVGWCJJcDXM",
                "title": "60 Minutes Tuttle Twins - Wholesome Cartoon Compilation for Family",
                "duration": 3627
            },
            {
                "id": "xvo_m_r2ubg",
                "title": "What is Bitcoin? Simple Explanation for Teens & Beginners",
                "duration": 203
            },
            {
                "id": "gS05vIvAW9I",
                "title": "Dollars or Bitcoin? Which One is Better? - Economics Explained (Tuttle Twins)",
                "duration": 419
            },
            {
                "id": "lV9aSAIVYok",
                "title": "Kids Finance - Inflation Explained",
                "duration": 67
            },
            {
                "id": "hSZyUI6rbC8",
                "title": "A Bitcoin Bash & Corrupted Cash - Full Episode (Tuttle Twins)",
                "duration": 1345
            },
            {
                "id": "J7mMQ3ERNdg",
                "title": "Tuttle Twins S1E11 - Full Episode (No Free Lunch)",
                "duration": 1337
            },
            {
                "id": "9NZTMmVBfK4",
                "title": "What My Kids Think of Bitcoin",
                "duration": 271
            },
            {
                "id": "mwSAuNb44lU",
                "title": "How Money Works Explained in One Minute",
                "duration": 71
            },
            {
                "id": "bDcGUxS9DHw",
                "title": "Tuttle Twins S1E9 - Full Episode (Fate of the Future)",
                "duration": 1275
            },
            {
                "id": "Td32UyXW9HE",
                "title": "How to Teach a Kid About Bitcoin (and Money)",
                "duration": 2656
            },
            {
                "id": "fTTGALaRZoc",
                "title": "Banking Explained - Money and Credit",
                "duration": 370
            },
            {
                "id": "RqJOqyzOmjw",
                "title": "Understanding Inflation - The Basics Explained (It's a Money Thing)",
                "duration": 198
            },
            {
                "id": "qyCXpr-ZDhE",
                "title": "What are Taxes? Simple Explanation for Teens and Beginners",
                "duration": 129
            },
            {
                "id": "agUawDBjwv4",
                "title": "Investing In Crypto For Your Kids - Should You?",
                "duration": 81
            },
            {
                "id": "BL5vUVQvmX4",
                "title": "What is Bitcoin? Explained in 3 Minutes - Tuttle Twins",
                "duration": 186
            },
            {
                "id": "dAujdH8Iwcg",
                "title": "Bitcoin Explained for Kids & Beginners - Digital Money Made Easy",
                "duration": 159
            },
            {
                "id": "uRU4ifbGolg",
                "title": "Tuttle Twins S1E7 - Full Episode (The Miraculous Pencil)",
                "duration": 1295
            },
            {
                "id": "s4g1XFU8Gto",
                "title": "Bitcoin Explained and Made Simple",
                "duration": 205
            },
            {
                "id": "o-PNlhhVhZ8",
                "title": "Hyperinflation Explained in One Minute",
                "duration": 71
            },
            {
                "id": "nqdv6Ad9Nt4",
                "title": "What is Bitcoin? (for kids)",
                "duration": 221
            },
            {
                "id": "Z3xdGIyIV54",
                "title": "How to Explain Bitcoin to Children - Dad & Daughter",
                "duration": 513
            },
            {
                "id": "B-IpiKURs3I",
                "title": "1 Hour Tuttle Twins Compilation",
                "duration": 3969
            },
            {
                "id": "t0ZAXwV1CI8",
                "title": "Cryptocurrency Explained For Kids",
                "duration": 324
            },
            {
                "id": "LuboVKBFnl0",
                "title": "When Money Is Controlled, Money Is Corrupted - Full Song (Tuttle Twins)",
                "duration": 159
            },
            {
                "id": "rT4ThQ55SD8",
                "title": "Who Invented Bitcoin? (for kids)",
                "duration": 229
            },
            {
                "id": "cv7SRW_kYLk",
                "title": "How to Teach Kids Where Money Comes From (5 Different Places)",
                "duration": 438
            },
            {
                "id": "jcu3hsaLO0Q",
                "title": "Tuttle Twins S1E12 - Full Episode (Season Finale)",
                "duration": 1614
            },
            {
                "id": "Z-qP41O-NxY",
                "title": "The Lesson on SOCIALISM School Didn't Teach You - Tuttle Twins Full Episode",
                "duration": 1399
            },
            {
                "id": "aRcXutXvfmM",
                "title": "Financial Literacy - Needs and Wants (Opportunity Costs)",
                "duration": 278
            },
            {
                "id": "0SDCdQcnKuQ",
                "title": "What Everyone Should Know About College - Tuttle Twins Full Episode",
                "duration": 1399
            },
            {
                "id": "aHVuaASswgA",
                "title": "The Truth About CBDCs (Central Bank Digital Currencies) - Economics Explained",
                "duration": 334
            },
            {
                "id": "GZ7y-yFdX9M",
                "title": "Who Invented Money? History of Money & Barter System - Dr Binocs Show",
                "duration": 336
            },
            {
                "id": "9CchpWy29es",
                "title": "Investing & Stocks - Cash Course (PragerU Kids)",
                "duration": 365
            },
            {
                "id": "DuR0KMBefj0",
                "title": "Tuttle Twins S2E2 - Don't Trash Success (Full Episode)",
                "duration": 2827
            },
            {
                "id": "zJHeIJGVCKI",
                "title": "How War Makes Millionaires?! - Economics Explained",
                "duration": 274
            },
            {
                "id": "XNu5ppFZbHo",
                "title": "What Gives a Dollar Bill Its Value? - TED-Ed",
                "duration": 232
            },
            {
                "id": "Y9RdoOBVmbI",
                "title": "Is School Failing You? - Albert Einstein (Tuttle Twins)",
                "duration": 228
            },
            {
                "id": "tQ1_8M1K0tM",
                "title": "Cryptocurrency Explained to Kids - Twins",
                "duration": 1268
            },
            {
                "id": "wgU-Xou0xYM",
                "title": "Tiny Economists Ep. 3 - What Is Money?",
                "duration": 247
            },
            {
                "id": "iy3n39Gnlpw",
                "title": "Tuttle Twins S1E5 - Full Episode (The Golden Rule)",
                "duration": 1466
            },
            {
                "id": "61G4YhJsSNo",
                "title": "What is BITCOIN - Bitcoin Explained to Kids, Teens and Adults",
                "duration": 837
            },
            {
                "id": "Bv9LCSMEgGQ",
                "title": "BITCOIN EXPLAINED FOR KIDS",
                "duration": 122
            },
            {
                "id": "_ekzsZZGfsk",
                "title": "First Kids Cartoon about Bitcoin!",
                "duration": 3501
            },
            {
                "id": "3nwprNzztQE",
                "title": "Bitcoin Explained for Kids & Teens (Parents: Show This to Your Kids!)",
                "duration": 371
            },
            {
                "id": "qnyqQvIii0U",
                "title": "Cryptocurrency Explained for Kids & Beginners",
                "duration": 141
            },
            {
                "id": "Iyq4khMiM9A",
                "title": "Saving vs Investing for Kids - Types of Investments Explained!",
                "duration": 151
            },
            {
                "id": "ZxEqoaFT73c",
                "title": "Bitcoin Is The Evolution Of Money - My Kids Won't Know Coins!",
                "duration": 221
            },
            {
                "id": "auIOUn0ubDk",
                "title": "What is Inflation? Explained for Kids (The Invisible Money Nibbler!)",
                "duration": 287
            }]
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
                "duration": 661
            },
            {
                "id": "9UIOeoBEjmw",
                "title": "Lightning Network Explained",
                "duration": 744
            },
            {
                "id": "CG69c71aSLQ",
                "title": "Lightning Network Explained - Easy Guide",
                "duration": 346
            },
            {
                "id": "rrr_zPmEiME",
                "title": "Bitcoins Lightning Network Explained",
                "duration": 334
            },
            {
                "id": "zEeMco4KqGs",
                "title": "Lightning Network for Beginners",
                "duration": 107
            },
            {
                "id": "bW7hvvjum9o",
                "title": "Lightning Network: Everything You Need To Know",
                "duration": 1271
            },
            {
                "id": "OQ2o5LUgOqE",
                "title": "Mutiny Wallet Tutorial - Bitcoin Lightning (self-custody)",
                "duration": 1312
            },
            {
                "id": "GKXQiDhRy34",
                "title": "How To Back Up A Bitcoin Wallet - Lightning Session",
                "duration": 130
            },
            {
                "id": "nd5fX2vHuDw",
                "title": "ALBY - Bitcoin Lightning Payments In Your Browser",
                "duration": 2535
            },
            {
                "id": "4kBCEbCWf1s",
                "title": "Lightning Network in Practice - Real Payments",
                "duration": 322
            },
            {
                "id": "ldUwf_s44Zg",
                "title": "Bitcoin Wallets Explained - Lightning Session",
                "duration": 108
            },
            {
                "id": "c9hnntAwSYg",
                "title": "Bitcoin's Lightning Network Surprises Us All!",
                "duration": 261
            },
            {
                "id": "5SbpyInuIJk",
                "title": "MUUN Bitcoin Wallet - On Chain and Lightning Combined!",
                "duration": 1295
            },
            {
                "id": "t_4b-y4T8bY",
                "title": "How To Use A Bitcoin Lightning Wallet: Breez - BTC Sessions",
                "duration": 1118
            },
            {
                "id": "7QAmlcrZD2U",
                "title": "The Lightning Network Explained in Under 3 Minutes",
                "duration": 171
            },
            {
                "id": "vmafxrT8eCU",
                "title": "Getting Started with Lightning Wallets",
                "duration": 943
            },
            {
                "id": "gkZJ1P-D0c4",
                "title": "Paying at McDonald's with Bitcoin Lightning in Lugano",
                "duration": 57
            },
            {
                "id": "Pef22g53zsg",
                "title": "Why Lightning is the Future of Payments",
                "duration": 2678
            },
            {
                "id": "qug6tCHPXtw",
                "title": "Bitfury Lightning Coffee Machine",
                "duration": 87
            },
            {
                "id": "to8XItlplac",
                "title": "Lightning Transactions & Protocol Deep Dive",
                "duration": 4636
            },
            {
                "id": "JGOzIUG2Rwk",
                "title": "How To Get Your Bitcoin Onto The Lightning Network - BTC Sessions",
                "duration": 140
            },
            {
                "id": "sQPKdozYhQ8",
                "title": "Beginners Guide to Coffee LN Payments",
                "duration": 130
            },
            {
                "id": "fympoUHx2b8",
                "title": "Creating A Custom Self-Custodial Bitcoin Lightning Address",
                "duration": 1391
            },
            {
                "id": "AW-7XBrSqCI",
                "title": "Bitcoin Lightning Network Demo: Phoenix Wallet",
                "duration": 30
            },
            {
                "id": "yKdK-7AtAMQ",
                "title": "Lightning Network - How It Actually Works",
                "duration": 1276
            },
            {
                "id": "7VyUqRyYT9w",
                "title": "Best Lightning Network Wallet - Low BTC Transaction Fees",
                "duration": 151
            },
            {
                "id": "sXBwRO7ML7w",
                "title": "Wallet Of Satoshi - Simple Bitcoin Lightning Wallet",
                "duration": 1540
            },
            {
                "id": "bVC4795helY",
                "title": "Lightning payment in Malaysia Cafe",
                "duration": 43
            },
            {
                "id": "JpmkIvB7rDE",
                "title": "Send From Any Exchange Direct To A Lightning Wallet - BTC Sessions",
                "duration": 136
            },
            {
                "id": "FwjX6ija9iM",
                "title": "Simple Bitcoin Wallet Tutorial - BTC, Lightning and Hardware",
                "duration": 1394
            },
            {
                "id": "39KpscRXyXY",
                "title": "Buying Coffee Using Bitcoin - LN",
                "duration": 34
            },
            {
                "id": "69QUHgHErx0",
                "title": "TOP Lightning Wallets in 2025 - How to Spend Bitcoin",
                "duration": 435
            },
            {
                "id": "i4z-2v_0H1k",
                "title": "How Lightning Network Will Change Bitcoin",
                "duration": 288
            },
            {
                "id": "x3Q9mEdelK4",
                "title": "Understanding Aqua Wallet - Bitcoin, Lightning, and Liquid",
                "duration": 1792
            },
            {
                "id": "bDzbKH5dwys",
                "title": "Zeus Wallet Tutorial - Embedded Lightning Node",
                "duration": 1761
            },
            {
                "id": "iVPNk2ZZ63w",
                "title": "Lightning Accounts With Blue Wallet and Umbrel",
                "duration": 1249
            },
            {
                "id": "tLZc-NLmV20",
                "title": "Lightning Network Deep Dive with Laolu 'Roasbeef' Osuntokun",
                "duration": 2891
            },
            {
                "id": "MGNvaJyZ25A",
                "title": "Lightning Network: Everything You Need To Know",
                "duration": 592
            },
            {
                "id": "T09HtifiP9c",
                "title": "Lightning Network: The Economics of Bitcoin's Global Payment Rails - The Bitcoin Layer",
                "duration": 2367
            },
            {
                "id": "h6-WezlpXx0",
                "title": "Lightning Network Is Layered Bitcoin - The Bitcoin Layer",
                "duration": 3126
            },
            {
                "id": "6C4Vsq1LF4o",
                "title": "Bitcoin's Lightning Network Is EXPLODING - The Bitcoin Layer",
                "duration": 2493
            },
            {
                "id": "GO3DX2ICitg",
                "title": "Cypherpunks & Lightning Network | Alex Leishman - The Bitcoin Layer",
                "duration": 1755
            },
            {
                "id": "LuZ0XN3eH5I",
                "title": "The Fatal Flaw in Bitcoin's Lightning Network? - Get Based TV",
                "duration": 805
            },
            {
                "id": "mKNpvPuoSzw",
                "title": "Episode 7: Lightning Network: How Bitcoin Beats the Banks",
                "duration": 287
            }]
    },
    {
        "id": "memes-comedy",
        "name": "Memes & Comedy",
        "emoji": "😂",
        "desc": "Funny Bitcoin videos & meme compilations",
        "color": "#facc15",
        "videos": [
            {
                "id": "oZwzttexaUM",
                "title": "Lil Bubble - All The Small Caps (Blink 182 - All The Small Things - Crypto/Bitcoin Version)",
                "duration": 140
            },
            {
                "id": "AjFNzFaI-2c",
                "title": "Hitler Reacts To Bitcoin Cash",
                "duration": 221
            },
            {
                "id": "dz4Gt-Oty9I",
                "title": "Drake - Started From the Bottom (Crypto/Bitcoin Parody - Lil Bubble)",
                "duration": 148
            },
            {
                "id": "zRDZFW4pBvw",
                "title": "Crypto Boy ft. Lil Bubble (salem ilese TikTok duet)",
                "duration": 66
            },
            {
                "id": "TjD4B3Vh9LQ",
                "title": "FOREVER LONG!? (Youth Group - Forever Young - Crypto Bitcoin Parody Version) - Lil Bubble",
                "duration": 150
            },
            {
                "id": "PEs1Ezk9htU",
                "title": "Lil Bubble - DeFi State Of Mind (Jay-Z ft. Alicia Keys - Empire State Of Mind - Crypto Parody)",
                "duration": 133
            },
            {
                "id": "5NleuGj2czk",
                "title": "Holding These Bags Like",
                "duration": 34
            },
            {
                "id": "bC-hvPM6JbA",
                "title": "Lil Bubble - Half On The Block (Happy Bitcoin Halving!)",
                "duration": 100
            },
            {
                "id": "42pUCIjC6ks",
                "title": "Lil Bubble - Pool & Chill (DeFi yield farming/impermanent loss diss)",
                "duration": 127
            },
            {
                "id": "BgtEyrZDn1s",
                "title": "Lil Bubble -  My Ponzi (Ginuwine - Pony - Bitcoin Parody Version)",
                "duration": 132
            },
            {
                "id": "EwEjrl13rZ0",
                "title": "Lil Bubble - Crypto DJ Set (live from the spaceship) - July 2021",
                "duration": 608
            },
            {
                "id": "OVnvE0vfOCA",
                "title": "Just A Ponzi That I Used To Hold (Gotye - Bitcoin & Crypto Crash Parody Version) - Lil Bubble",
                "duration": 212
            },
            {
                "id": "uql_VKemddY",
                "title": "Vibing with the Fed and Bitcoin 10 Hour Loop",
                "duration": 36000
            },
            {
                "id": "Ner16UBWdEg",
                "title": "Bitcoin Memes That Hit Different",
                "duration": 480
            },
            {
                "id": "1utTEIWXOhQ",
                "title": "Lil Bubble - How Low? (Ludacris - How Low - Crypto Version)",
                "duration": 102
            },
            {
                "id": "OKAbZhv8LxA",
                "title": "Gary Gensler Disses Crypto & Trump Meme Coin (Kendrick Lamar - Not Like Us - Crypto Parody)",
                "duration": 101
            },
            {
                "id": "sOlkuuAq8p0",
                "title": "Lil Bubble x The Dev - Drop It Like It's Hot (Crypto Parody Version) Snoop Dogg feat. Pharrell",
                "duration": 163
            },
            {
                "id": "aTqT5TDLtT8",
                "title": "Bitcoin History As Told By Memes",
                "duration": 340
            },
            {
                "id": "-weaa5SrVEU",
                "title": "Michael Saylor Needs Some Rest",
                "duration": 40
            },
            {
                "id": "J_4Js-CphjU",
                "title": "Will Your Crypto Portfolio Ever Recover?",
                "duration": 32
            },
            {
                "id": "1RV2Fpqpe48",
                "title": "Michael Saylor in The Age of Revolution - Google Ngram Meme",
                "duration": 25
            },
            {
                "id": "8zuAbAD5Bac",
                "title": "You Gotta Bag? You Gotta Gym - Home Altcoin Workout",
                "duration": 61
            },
            {
                "id": "0Y7qcaIkgMY",
                "title": "Appeasing Michael Saylor - Bitcoin Singularity",
                "duration": 3601
            },
            {
                "id": "27U4yhFqCVs",
                "title": "WHATS DROPPIN? (Jack Harlow - WHATS POPPIN - Bitcoin, crypto, trading parody) - Lil Bubble",
                "duration": 110
            },
            {
                "id": "4Ier6bkBcYI",
                "title": "When you sell crypto and it keeps going up",
                "duration": 16
            },
            {
                "id": "DBs-qkjMdXk",
                "title": "95-Year-Old Man Reacts to Bitcoin",
                "duration": 210
            },
            {
                "id": "x_aGUAJzv0A",
                "title": "Bitcoin Going To Zero? GFY! (Risitas feat. Elon Musk) Lil Bubble Remix",
                "duration": 82
            },
            {
                "id": "1_VwtHcfefg",
                "title": "Jay Sean - Down (Crypto/Bitcoin/Stock Market Parody Version) Lil Bubble",
                "duration": 161
            },
            {
                "id": "BgHEOhciWcQ",
                "title": "What Happens If You Never Buy Bitcoin?",
                "duration": 37
            },
            {
                "id": "Bse-4rjVg2k",
                "title": "The Game Of Cryptos - The wrath of the rightful heir (part 1)",
                "duration": 49
            },
            {
                "id": "TGRekmiWQMs",
                "title": "The Crypto Market Take Your Money Like (God's Plan)",
                "duration": 17
            },
            {
                "id": "CQPFIK1ikDQ",
                "title": "Vitalik Token2049 Song - A New Form Of Wealth (Lil Bubble Remix)",
                "duration": 77
            },
            {
                "id": "fWOOQShUUc4",
                "title": "SpaceX Falcon Heavy Launch",
                "duration": 25
            },
            {
                "id": "xfwpAhlVALQ",
                "title": "Gary Gensler - Smells Like Securities (Eminem - Without Me - Crypto Version) - Lil Bubble",
                "duration": 122
            },
            {
                "id": "qjjNgW4bZm8",
                "title": "Michael Saylor - One Chair (Lil Bubble Bitcoin House Remix)",
                "duration": 155
            },
            {
                "id": "6xfqzCqTiZs",
                "title": "BitBoy Crypto Rant (Heavy Metal Remix) - Lil Bubble",
                "duration": 64
            },
            {
                "id": "kmDzhA4UiRg",
                "title": "Trying To Decide Which Altcoin To Buy",
                "duration": 14
            },
            {
                "id": "mEqr-8-TKrA",
                "title": "30 People Turning Down FREE Bitcoin - Mike Still",
                "duration": 254
            },
            {
                "id": "Fvi6pdG_jZw",
                "title": "GigaChad Michael Saylor Best Moments - Bitcoin Song",
                "duration": 83
            },
            {
                "id": "Om_-M2fiNvw",
                "title": "When You HODL Through A Bear Market",
                "duration": 60
            },
            {
                "id": "dWdFNf_zXR4",
                "title": "When your crypto portfolio doesn't crash overnight",
                "duration": 11
            },
            {
                "id": "l-aVgXwnESM",
                "title": "When Bitcoin Encounters Fiat (No.2) - Crypto Memes",
                "duration": 79
            },
            {
                "id": "PtaYMGK0LVQ",
                "title": "Robot Just Stole My Job (Tesla Bot Optimus AI - Parody Song) - Lil Bubble",
                "duration": 132
            },
            {
                "id": "95Kmj3tKCow",
                "title": "HOW COULD THIS HAPPEN TO ME!? (Simple Plan - Untitled - Crypto/Bitcoin Parody Version) Lil Bubble",
                "duration": 176
            },
            {
                "id": "wIhTGB3wqV0",
                "title": "Michael Saylor Meme - NO SECOND BEST",
                "duration": 46
            },
            {
                "id": "DV-RHmRw4O8",
                "title": "Trying To Hold  Your Altcoin Bags",
                "duration": 7
            },
            {
                "id": "H_HZkcUP_O0",
                "title": "Bitcoin: Explained to Different Age Groups",
                "duration": 206
            },
            {
                "id": "61i2iDz7u04",
                "title": "BITCONNECT REMIX",
                "duration": 93
            },
            {
                "id": "T-Mmud_OsEM",
                "title": "When your homie tells you he can rap.. feat. Richard Heart (Prada Prada Prada)",
                "duration": 60
            },
            {
                "id": "4KWFKRbK1pY",
                "title": "We Got A Bitcoin Down (Bitcoin Crash March 2018)",
                "duration": 98
            },
            {
                "id": "NMDABNK8j_Q",
                "title": "Funniest Crypto Memes - He Sold? Edition",
                "duration": 68
            },
            {
                "id": "08kwAmgQt0w",
                "title": "FTX/Sam Bankman-Fried - That's a scam! (Meme song/interview drill rap remix)",
                "duration": 86
            },
            {
                "id": "6BqplqzuO6U",
                "title": "Lil Bubble - I Hold Bags Not Assets (Panic! At The Disco Crypto Parody)",
                "duration": 130
            },
            {
                "id": "2lpikrpQ0yQ",
                "title": "Lil Bubble - Have You Heard About NFTs? (Official Music Video)",
                "duration": 146
            },
            {
                "id": "yloMl7r57-8",
                "title": "Bobby Shmurda - Shmoney (Lil Bubble Crypto Verse - Tully Remix Competition)",
                "duration": 61
            },
            {
                "id": "E9EkVAEpqyo",
                "title": "Actual footage of crypto traders (Willy Wonka Crypto Boat Ride)",
                "duration": 126
            },
            {
                "id": "n7FXEpkuy0k",
                "title": "Lil Bubble - What A Dump (Haddaway - What Is Love - Crypto Bitcoin crash song)",
                "duration": 103
            },
            {
                "id": "Zai5F2_KMjA",
                "title": "THE END OF CRYPTO!? The crypto titanic goes down",
                "duration": 151
            },
            {
                "id": "RM1NdTvvtvk",
                "title": "Bitcoin Comedy Compilation",
                "duration": 614
            },
            {
                "id": "XVcPxApYijo",
                "title": "Bulls Is Back - 88N8 x Lil Bubble (prod. PyroDaGod) - LYRIC VIDEO",
                "duration": 172
            },
            {
                "id": "AKvWwZJ6gfA",
                "title": "Sigma Chad Michael Saylor - It's Going Up Forever Laura",
                "duration": 58
            },
            {
                "id": "rIx35hydpVE",
                "title": "When you buy all time high and it dips",
                "duration": 21
            },
            {
                "id": "UDu5LOf_E-w",
                "title": "Bitcoin Memes Compilation",
                "duration": 323
            },
            {
                "id": "hAxfwE9Oj2g",
                "title": "BIG BEAUTIFUL BITCOIN!",
                "duration": 164
            },
            {
                "id": "aUp6fogcPM0",
                "title": "Lil Bubble - The Rise of the Crypto Troopers",
                "duration": 116
            },
            {
                "id": "VEJVNaOptuo",
                "title": "Crypto HODLers Currently Like (Fight Club Crypto Meme)",
                "duration": 44
            },
            {
                "id": "UX1GIhOhkAE",
                "title": "Me Saying Bitcoin",
                "duration": 7
            },
            {
                "id": "8EoxggHmWxY",
                "title": "How to Mine Bitcoins (Classic)",
                "duration": 156
            },
            {
                "id": "Ma4c6PYT1Ec",
                "title": "When you sold your Bitcoin too early",
                "duration": 16
            },
            {
                "id": "wyjTXNebRvU",
                "title": "Lil Bubble  - Alt Season (The Ritual)",
                "duration": 137
            },
            {
                "id": "3mA_U4tYS8s",
                "title": "Hank Finds Out About Crypto Crash",
                "duration": 70
            },
            {
                "id": "fUFnLPblsBg",
                "title": "100% Saylor - Michael Saylor Best Moments",
                "duration": 102
            },
            {
                "id": "E6mK2aZbuSo",
                "title": "Recovery of a Lost Bitcoin Wallet from 2010",
                "duration": 144
            },
            {
                "id": "pPNBEGP9J1w",
                "title": "Jim Cramer - I made a mistake (SVB, Signature Bank & Meta Apology) Emo Remix (Parody song)",
                "duration": 65
            },
            {
                "id": "jQfowtEfbFY",
                "title": "The greatest meme of all time",
                "duration": 1022
            },
            {
                "id": "jJgb5xHp8cU",
                "title": "When You Try To Buy The Dip (Too Soon Junior!)",
                "duration": 53
            },
            {
                "id": "d6ham2mibiA",
                "title": "Bitcoin Street Reactions Compilation",
                "duration": 95
            },
            {
                "id": "BgZO1ppaneg",
                "title": "Best Crypto TikToks Compilation",
                "duration": 917
            },
            {
                "id": "exRCX38tHks",
                "title": "Giving Away Crypto or Cash! What Will The Public Take?! (Social Experiment)",
                "duration": 556
            },
            {
                "id": "aJIt3dUWEAs",
                "title": "Unleashing the Cyber Hornets: Michael Saylor on the Power of Bitcoin",
                "duration": 3600
            },
            {
                "id": "Lzl5t1Sracc",
                "title": "Funny Bitcoin Video #3 - Classic Compilation",
                "duration": 62
            },
            {
                "id": "EiZSozfvKMQ",
                "title": "Michael Saylor Lost His Mind - There Is No Second Best Meme",
                "duration": 51
            },
            {
                "id": "pMmcu8RzM2M",
                "title": "All The Way Up - Tesla Buys Bitcoin Edition (Fat Joe Crypto Parody)",
                "duration": 118
            },
            {
                "id": "t60cXhAXryM",
                "title": "HODL - When You Check Your Crypto Portfolio Today",
                "duration": 39
            },
            {
                "id": "mJUB86V57c4",
                "title": "Lil Bubble - Pump It Up (Crypto/Bitcoin Version) Joe Budden Parody",
                "duration": 127
            },
            {
                "id": "EFDMum1vs7Q",
                "title": "Pump It Up (Bitcoin Maximalist) 10 Hour Loop",
                "duration": 36057
            },
            {
                "id": "jZm1GZj6eEM",
                "title": "Asking People if They Have Invested in Cryptocurrencies",
                "duration": 306
            },
            {
                "id": "PJvi5uUY8Rk",
                "title": "Lil Bubble - Don't Hate The Game (Level 1)",
                "duration": 75
            },
            {
                "id": "RU4aHnZlHhM",
                "title": "Lil Bubble - Never Ever (selling back to tether)",
                "duration": 130
            },
            {
                "id": "nrtFeKuiAHA",
                "title": "Lil Bubble - Rug Star (Smash Mouth - All Star) Crypto Parody",
                "duration": 129
            },
            {
                "id": "Dg_fYjgizZA",
                "title": "The Current Crypto Market - San Andreas Earthquake Bitcoin Crash!",
                "duration": 89
            },
            {
                "id": "j4RuU_bn4Ug",
                "title": "Trying to get your friends to buy crypto",
                "duration": 74
            },
            {
                "id": "WsURYcLdBHM",
                "title": "The 2018 Crypto Market Crash",
                "duration": 125
            }]
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
                "title": "Mining BITCOIN at Home is EASY - Bitaxe Gamma",
                "duration": 1079
            },
            {
                "id": "rQFWgLQuGzo",
                "title": "VoskCoin Mining Farm Numbers",
                "duration": 620
            },
            {
                "id": "TVR0E6KVb-c",
                "title": "What is a Bitcoin Miner? Disassembling an S19 While Explaining",
                "duration": 614
            },
            {
                "id": "iQiWQAtThns",
                "title": "Marathon Digital Portfolio Overview",
                "duration": 208
            },
            {
                "id": "e4BtAMXuRKI",
                "title": "What is Bitcoin Mining? How to Earn from Cryptocurrency Mining",
                "duration": 747
            },
            {
                "id": "WbEn-fsAEqs",
                "title": "I Mined Bitcoin for 1 Year (Honest Results)",
                "duration": 694
            },
            {
                "id": "lDafxxAgmUI",
                "title": "MARA Granbury Facility Tour",
                "duration": 1254
            },
            {
                "id": "33i1PdSJgwA",
                "title": "How Bitcoin Mining Actually Works, Simplified",
                "duration": 253
            },
            {
                "id": "UAhQoKhzzbA",
                "title": "Marathon 200MW Mining Site Acquisition",
                "duration": 72
            },
            {
                "id": "DMfv8S8ffKA",
                "title": "Bitcoin Mining - Bloomberg Animated Explainer",
                "duration": 300
            },
            {
                "id": "cJo839Sg1ek",
                "title": "The 3 BEST Home Crypto Miners Under $500",
                "duration": 831
            },
            {
                "id": "JPanr1nsPA4",
                "title": "Mining BTC in Paraguay via Hydro - MARA",
                "duration": 85
            },
            {
                "id": "C4Z5yoWfnAU",
                "title": "Is Bitcoin Mining At Home Still Worth It in 2025?",
                "duration": 800
            },
            {
                "id": "hN0VH__AZSE",
                "title": "This Thing Earns $914 PER DAY?! Here's How",
                "duration": 679
            },
            {
                "id": "q7c00PE7khk",
                "title": "How To Set Up a Bitaxe To Mine Bitcoin (Step-by-Step)",
                "duration": 1231
            },
            {
                "id": "O9mRlrC1z2Y",
                "title": "Fort Worth Becomes First US City to Mine Bitcoin",
                "duration": 171
            },
            {
                "id": "dm4PljluiYM",
                "title": "Best Bitcoin Solo Miner 2025 - Bitaxe, NerdQaxe, Avalon Compared",
                "duration": 1322
            },
            {
                "id": "Bjcn5OZwgcs",
                "title": "Is Bitcoin Mining Still Profitable?",
                "duration": 600
            },
            {
                "id": "BpN8fCkExtE",
                "title": "When Blackmailing A Drug Lord Goes Terribly Wrong (Silk Road Agent)",
                "duration": 1934
            },
            {
                "id": "5Y2fkldA-lQ",
                "title": "The Early Days of Bitcoin Mining",
                "duration": 472
            },
            {
                "id": "YsYk8vyv32w",
                "title": "The History of Bitcoin Mining",
                "duration": 300
            },
            {
                "id": "F1ot1qS-VtQ",
                "title": "The POWERFUL $680 Home Bitcoin Miner - Nerd Octaxe",
                "duration": 1200
            },
            {
                "id": "ACAn_yL-Too",
                "title": "Bitcoin Mining - Inside a Real Facility",
                "duration": 720
            },
            {
                "id": "Gsswul2h5vE",
                "title": "This NEW Mini Home Bitcoin Miner Could Earn You 3.125 BTC!",
                "duration": 1003
            },
            {
                "id": "4HTtZhhXiAw",
                "title": "Bitcoin Mining Explained in 3 Minutes",
                "duration": 260
            },
            {
                "id": "CC8wQJuhP5g",
                "title": "Compass Mining Year in Review",
                "duration": 3039
            },
            {
                "id": "xxhPn52mdxA",
                "title": "This Solo Bitcoin Miner Found A Block! NerdQaxe++ Unboxing & Setup",
                "duration": 1016
            },
            {
                "id": "yxfvEK7Nj8s",
                "title": "Bitcoin Mining Explained in 10 Minutes",
                "duration": 935
            },
            {
                "id": "vOOh9CHUZQQ",
                "title": "5 Solo Mining Projects for Your Bitaxe or Avalon Nano",
                "duration": 767
            },
            {
                "id": "xQ7HwJ-voME",
                "title": "The PERFECT Mini Home Bitcoin Miner on a Budget!",
                "duration": 692
            },
            {
                "id": "ENQQXeEv2gI",
                "title": "Why Should You Run a Bitaxe?",
                "duration": 358
            },
            {
                "id": "L67es0ydJjE",
                "title": "Bitaxe Solo Mining Difficulty Explained",
                "duration": 507
            },
            {
                "id": "FMR1LO1rNYA",
                "title": "Perfect BEGINNER Home Bitcoin Miner in 2026!",
                "duration": 859
            },
            {
                "id": "YGkLWGM8os4",
                "title": "UAE Immersion Facility Ribbon Cutting",
                "duration": 61
            },
            {
                "id": "lHipE05v4jg",
                "title": "How Bitcoin Mining Works - Complete Guide",
                "duration": 1156
            },
            {
                "id": "El3y8AME8oA",
                "title": "How Bitcoin Mining Really Happens",
                "duration": 599
            },
            {
                "id": "t5S1Y6OopHo",
                "title": "BEST Home Miners 2024 Guide",
                "duration": 900
            },
            {
                "id": "5Wp6lInPQv0",
                "title": "The Cruel Reality of Bitcoin Mining - VoskCoin",
                "duration": 498
            },
            {
                "id": "Py3voZGT1To",
                "title": "Bitcoin Mining Explained Simply - Real ASIC Miner Running at Home",
                "duration": 270
            },
            {
                "id": "i4XV7Yq9GCM",
                "title": "The Future of Bitcoin Mining: Home Miners, Pools, & Open Source Innovation - The Bitcoin Layer",
                "duration": 2888
            },
            {
                "id": "a1aKbcSE4-E",
                "title": "Mainstream Media Has FLIPPED on Bitcoin Mining - The Bitcoin Layer",
                "duration": 1362
            },
            {
                "id": "824d2vmw2a0",
                "title": "U.S. Bitcoin Boom: 50M Users, $30B Mining & Bipartisan Momentum - The Bitcoin Layer",
                "duration": 2035
            },
            {
                "id": "-maK8nO9vqk",
                "title": "Bitcoin Mining Is Cleaning the Grid - Here's the Truth - The Bitcoin Layer",
                "duration": 2202
            },
            {
                "id": "jw6Cm_DpERM",
                "title": "Bitcoin Mining and Circular Economies Are Changing Africa's Future - The Bitcoin Layer",
                "duration": 1626
            },
            {
                "id": "X0YBOyI8ptE",
                "title": "BITCOIN BOILS THE OCEAN",
                "duration": 639
            },
            {
                "id": "2hFvQhMRnc4",
                "title": "Bitcoin Proof of Work",
                "duration": 1280
            },
            {
                "id": "XTb2jYYYg8Y",
                "title": "Bitcoin Mining Difficulty & Target Hash (11/22/25 Update)",
                "duration": 113
            },
            {
                "id": "S3gamO8-ZDg",
                "title": "Bitcoin: Historical Mining Difficulty & Target Hash (1/30/25 Update)",
                "duration": 106
            },
            {
                "id": "wQI3jZFdh2s",
                "title": "Bitcoin: Historical Mining Difficulty & Target Hash (11/21/24 Update)",
                "duration": 106
            },
            {
                "id": "ZeVxHolNxsg",
                "title": "Satoshi's Genius: POW + The Difficulty Adjustment",
                "duration": 578
            },
            {
                "id": "gDhoS-cZfU4",
                "title": "Bitcoin Difficulty Adjustment Animation (Difficulty Epoch 415)",
                "duration": 104
            },
            {
                "id": "JpDxQ90jwSA",
                "title": "Bitcoin Difficulty Adjustment (4hr Animation) [DE1 - DE414]",
                "duration": 13317
            },
            {
                "id": "8pOy8TOdyS4",
                "title": "Bitcoin Difficulty Adjustment (2/7/24 Update)",
                "duration": 533
            },
            {
                "id": "HbS80lfbBl4",
                "title": "Bitcoin Miner Transaction Fees: % of Block Reward (12/22/23 Update)",
                "duration": 81
            },
            {
                "id": "A5ssDib4-jk",
                "title": "Bitcoin: Historical Mining Difficulty & Target Hash (10/3/23 Update)",
                "duration": 97
            }]
    },
    {
        "id": "music",
        "name": "Music",
        "emoji": "🎵",
        "desc": "Bitcoin songs, rap & music videos",
        "color": "#ec4899",
        "videos": [
            {"id": "28PadE9ARDg", "title": "MusicSnake - Cold Storage [Hardware Wallet Crypto Song]", "duration": 206},
            {
                "id": "IrcN-zmCZMI",
                "title": "If It Was Not For Satoshi - Robbie P",
                "duration": 162
            },
            {
                "id": "YbzNJr26H-4",
                "title": "Welcome To The Blockchain - Toby Ganger + Decap",
                "duration": 240
            },
            {
                "id": "9EuH_ZGOlIs",
                "title": "Proof of Work: A Bitcoin Experience",
                "duration": 183
            },
            {
                "id": "8n5k714GOlA",
                "title": "HODL GANG - Bitcoin Rap Remix",
                "duration": 179
            },
            {
                "id": "fEXw-LU18Ww",
                "title": "Michael Saylor - There Is No Second Best (Lil Bubble Bitcoin House Remix)",
                "duration": 157
            },
            {
                "id": "nUUXOZAPWFQ",
                "title": "Crypto to Heaven (Stairway to Heaven Parody)",
                "duration": 481
            },
            {
                "id": "KglDZXcdQhk",
                "title": "Lil Bubble - Bitcoin Song (Official Music Video)",
                "duration": 117
            },
            {
                "id": "g_4JdozI-nc",
                "title": "Lil Bubble - The Orange Pill (Official Visualizer) ft. Michael Saylor",
                "duration": 145
            },
            {
                "id": "ioM33qIAfdY",
                "title": "Michael Saylor calls them poor!? (Lil Bubble House Remix) #bitcoin",
                "duration": 56
            },
            {
                "id": "BifVGcvJpxc",
                "title": "WAGMI",
                "duration": 115
            },
            {
                "id": "zBGofxUj9dc",
                "title": "Michael Saylor - Forever, Laura (Lil Bubble Bitcoin House Remix)",
                "duration": 192
            },
            {
                "id": "eH9b_qNbjEU",
                "title": "Bitcoin - Official Music Video (Teejay)",
                "duration": 227
            },
            {
                "id": "B5if2hthPCs",
                "title": "Michael Saylor - We Call Them Poor (Bitcoin House Remix) by Lil Bubble",
                "duration": 143
            },
            {
                "id": "FCA9i6MUCK0",
                "title": "Bitcoin Beats Mix - Volume 1",
                "duration": 1800
            },
            {
                "id": "0RZ1geieiao",
                "title": "Michael Saylor on the second best crypto currency 🤭 (Lil Bubble House Remix) #bitcoin",
                "duration": 52
            },
            {
                "id": "OQPq_5PTj9M",
                "title": "HAPPY BITCOIN HALVING! 🚀 Willy Wonka style? #Bitcoin #bitcoinhalving2024",
                "duration": 51
            },
            {
                "id": "9sY2ALb4UWE",
                "title": "Lil Bubble - Buying At The Top Forever (Official Visualizer) ft. Michael Saylor",
                "duration": 151
            },
            {
                "id": "IIqqMTT-ne0",
                "title": "Lil Bubble - 0-100 Freestyle (Bitcoin Bars)",
                "duration": 140
            },
            {
                "id": "VdAcvUVy7FE",
                "title": "We Will Bitcoin",
                "duration": 126
            },
            {
                "id": "rDCrlgKGACo",
                "title": "Anik The First - Be The Change (B.T.C.)",
                "duration": 209
            },
            {
                "id": "KQ7rn3oi-Pc",
                "title": "Blockchain - Money Man",
                "duration": 139
            },
            {
                "id": "A7TuFy0fcuw",
                "title": "Bitcoin Song - Community Playlist",
                "duration": 232
            },
            {
                "id": "s3UtbslfqS8",
                "title": "Gary Gensler, Isn't That True? - Bitcoin Heavy Metal",
                "duration": 315
            },
            {
                "id": "iqbScnkmf0s",
                "title": "Elaine Diane Taylor - Bitcoin Barbarians",
                "duration": 186
            },
            {
                "id": "1BwJh2HmX74",
                "title": "All of us were ready to ride it to zero -  Saylor on Bitcoin at $16,000 🤝 #bitcoin #michaelsaylor",
                "duration": 33
            },
            {
                "id": "szXTJN1gmxY",
                "title": "Lil Bubble - Bybit Games (BTC Brawl Theme Song)",
                "duration": 92
            },
            {
                "id": "109WLnpYkqE",
                "title": "Vibing with the FED and Bitcoin",
                "duration": 210
            },
            {
                "id": "FzUWMPfYV98",
                "title": "Freedom Engine",
                "duration": 223
            },
            {
                "id": "JACD8a2LZ_8",
                "title": "Lil Bubble - Green Christmas (Crypto Christmas EP - BONUS SONG)",
                "duration": 139
            },
            {
                "id": "6mJF3c90xe0",
                "title": "Shitcoin Casinos - Annonymal (Bitcoin Heavy Metal)",
                "duration": 230
            },
            {
                "id": "QL6_YmVoRlg",
                "title": "Truthseekers",
                "duration": 191
            },
            {
                "id": "htTL7C23684",
                "title": "Build The Chain",
                "duration": 145
            },
            {
                "id": "CmGGt4KL9kQ",
                "title": "Lil Bubble - 100 RACKS (Bitcoin $100k Anthem) Official Music Video",
                "duration": 149
            },
            {
                "id": "GZ0YMSLZjfQ",
                "title": "Welcome To The Blockchain - Music Video",
                "duration": 240
            },
            {
                "id": "SfwGpvrzIjs",
                "title": "Captain Youth – Bitcoin 🤑",
                "duration": 224
            },
            {
                "id": "UG7zLhEWanc",
                "title": "Remy: Bitcoin Billionaire",
                "duration": 175
            },
            {
                "id": "emcT185BXMQ",
                "title": "Carlos Matos - Take On Me (autotuned)",
                "duration": 112
            },
            {
                "id": "nO6A4N9zjgE",
                "title": "Rich Men North of Richmond - Full Band Cover",
                "duration": 176
            },
            {
                "id": "h9vxIh1ELAo",
                "title": "Oompa Loompa (Bitcoin Halving Remix) Lil Bubble",
                "duration": 85
            },
            {
                "id": "gSxKJJ9k3lA",
                "title": "The Ultimate Crypto Anthem - Betawi CryptoCoin",
                "duration": 394
            },
            {
                "id": "6AfHKbpgsi4",
                "title": "Too Bit To Fail & Hanspanzer - FOMO",
                "duration": 190
            },
            {
                "id": "3fxzaTg0vMQ",
                "title": "Lil Bubble - All The Bears Are Dead (Bitcoin 50k Edition - Lil Uzi Vert)",
                "duration": 120
            },
            {
                "id": "4J2UC3N_A_c",
                "title": "Time To Ride Or Die",
                "duration": 134
            },
            {
                "id": "M3TzVgGyBFs",
                "title": "Lil Nas X - Old Town Road (Bitcoin Version) Lil Bubble",
                "duration": 165
            },
            {
                "id": "e2cl0_jqu4I",
                "title": "Halvingbird (a Bitcoin Halving song)",
                "duration": 172
            },
            {
                "id": "KfTazf9z40w",
                "title": "Lil Bubble - Escape The Matrix (Official Visualizer) ft. Michael Saylor",
                "duration": 153
            },
            {
                "id": "Y5r6e1VcIBE",
                "title": "BITCOIN SONG - Pat Ryan",
                "duration": 280
            },
            {
                "id": "EPQJHNXdJfM",
                "title": "Crypto - Takeoff feat. Rich The Kid",
                "duration": 161
            },
            {
                "id": "c5wbgDLr-u0",
                "title": "Bitcoin Lofi Beats - Study & HODL",
                "duration": 1610
            },
            {
                "id": "vQkXrct78A4",
                "title": "Tileks - BITCOIN",
                "duration": 119
            },
            {
                "id": "9odyosmjIr0",
                "title": "Lil Bubble - Bitcoin Song (Lyric Video)",
                "duration": 119
            },
            {
                "id": "U252iiG8YP0",
                "title": "Jingle Bells, Bank Cartels! A Bitcoin Christmas Song",
                "duration": 121
            },
            {
                "id": "XcerPhwbIFs",
                "title": "Orange Pill rApp - Wallet Stay Stackin'!",
                "duration": 189
            },
            {
                "id": "Vz9iCgiSZrM",
                "title": "Bitcoin's Back - Lil Bubble (Backstreet Boys Parody)",
                "duration": 141
            },
            {
                "id": "b8uRhNfxe60",
                "title": "New #Bitcoin all time high!? 🚀",
                "duration": 41
            },
            {
                "id": "oJO5WbsbMAU",
                "title": "Ones Who Came Before",
                "duration": 124
            },
            {
                "id": "KRopo3nofl4",
                "title": "10,000 Bitcoin Remix - Laura Saggers",
                "duration": 86
            },
            {
                "id": "bZb2qBrVHVY",
                "title": "Bitcoins from Heaven",
                "duration": 50
            },
            {
                "id": "XEBWtbhq0Ts",
                "title": "All About That Bitcoin - Naomi van der Velde",
                "duration": 157
            },
            {
                "id": "fG5PKg81mEQ",
                "title": "Fliponomics - Robbie P",
                "duration": 196
            },
            {
                "id": "WrEVpNdYkrs",
                "title": "B.R.E.A.M. - Zhou Tonged (Wu-Tang C.R.E.A.M. Parody)",
                "duration": 154
            },
            {
                "id": "-ZqQNaNcDz4",
                "title": "Congratulations (Post Malone Bitcoin Parody) BTC All Time High 🚀",
                "duration": 146
            },
            {
                "id": "VT_aEKr0BVY",
                "title": "Bitcoin Song - 13inlet",
                "duration": 198
            },
            {
                "id": "o5XBSF6w7I4",
                "title": "MusicSnake - Stack Sats (feat. Michael Saylor)",
                "duration": 176
            },
            {
                "id": "gVrWLhcau94",
                "title": "The Call",
                "duration": 140
            },
            {
                "id": "c21GLKrC2Gg",
                "title": "Bitcoin Only (feat. C. Scott Muzic) - Wonx316",
                "duration": 217
            },
            {
                "id": "1pqIFDI18ZY",
                "title": "Lil Bubble - Jingle Bells (Please Don't Sell) - Crypto Christmas EP",
                "duration": 105
            },
            {
                "id": "-Y13lkBvsQw",
                "title": "Ghost Town Remix (Orange Pill Edition)",
                "duration": 173
            },
            {
                "id": "Otkg4Ftx6GI",
                "title": "The Bitcoin Song",
                "duration": 225
            },
            {
                "id": "248Zbw1oPnw",
                "title": "Enhancer",
                "duration": 203
            },
            {
                "id": "pADgAmNzxek",
                "title": "We Are All Bitcoins",
                "duration": 227
            },
            {
                "id": "RglKdIovlX0",
                "title": "BANK - Bitcoin Music Video",
                "duration": 141
            },
            {
                "id": "AzpRvdaMGfY",
                "title": "Bitcoin House vinyls are here & you can watch me unbox in my slippers 🙏 #bitcoin #michaelsaylor",
                "duration": 32
            },
            {
                "id": "RIsZyg8OXlI",
                "title": "10,000 Bitcoins - Laura Saggers",
                "duration": 231
            },
            {
                "id": "ZUsOvjH-lRU",
                "title": "Lil Bubble - Satoshi As My Witness (Official Music Video)",
                "duration": 151
            },
            {
                "id": "Wtj1x9aT9Zk",
                "title": "Crypto Weekly Rap Up (Bitcoin Rap) - Week 1",
                "duration": 126
            },
            {
                "id": "U5JnpsDzw2k",
                "title": "Bitcoin All The Way Up - Dollar Vigilante feat. Freenauts",
                "duration": 169
            },
            {
                "id": "27BwXfrJxcs",
                "title": "Death to Fiat - The Skull of Satoshi (Bitcoin Heavy Metal)",
                "duration": 209
            },
            {
                "id": "cWgGOFlb15U",
                "title": "In Our Minds",
                "duration": 150
            },
            {
                "id": "ohtsx2hGGzI",
                "title": "Lil Bubble - Bitcoin Baby (Official Visualizer) ft. Michael Saylor",
                "duration": 234
            },
            {
                "id": "S99tOmXywZU",
                "title": "Let Me Escape",
                "duration": 107
            },
            {
                "id": "AJUAHhKYOIU",
                "title": "Greatest Teacher",
                "duration": 144
            },
            {
                "id": "bJKGdKqd3sc",
                "title": "The Hodler",
                "duration": 234
            },
            {
                "id": "VMLakjlz6us",
                "title": "Ode to Satoshi - Roger 9000",
                "duration": 490
            },
            {
                "id": "eqxNbGvNamY",
                "title": "Lovesong for Satoshi Nakamoto (Bitcoin Whitepaper)",
                "duration": 257
            },
            {
                "id": "6ZKzapbQPZA",
                "title": "Banksters Paradise - A Bitcoin Song",
                "duration": 270
            },
            {
                "id": "AJzCQaIXelE",
                "title": "Bitcoin Girl - Original Music Video",
                "duration": 248
            },
            {
                "id": "1VEMq8kDG68",
                "title": "It's Math - Greg Foss & Pleb Music",
                "duration": 78
            },
            {
                "id": "lG08pD-8upE",
                "title": "Bitcoin Slang Remix - Robbie P",
                "duration": 197
            },
            {
                "id": "ipDpjANJ7fU",
                "title": "Save The Young",
                "duration": 174
            },
            {
                "id": "BRbVhsoPzmI",
                "title": "Crypto Weekly Rap Up (Bitcoin Rap) - Week 4",
                "duration": 160
            },
            {
                "id": "QvZ7K_0_SiY",
                "title": "Lil Bubble - Liquidated (Avril Lavigne - Complicated | Bitcoin Parody Version)",
                "duration": 149
            },
            {
                "id": "W-Z_hlzZYBw",
                "title": "Jason Saulnier - Bitcoin We're in Love",
                "duration": 240
            },
            {
                "id": "R5AoOA5j85A",
                "title": "Lil Bubble - All I Want For Christmas Is Mass Adoption (Crypto Christmas EP)",
                "duration": 140
            },
            {
                "id": "VtLAl3eFYhQ",
                "title": "Lil Bubble - Moon Boy (Official Visualizer)",
                "duration": 112
            },
            {
                "id": "AKqdUAhX3nA",
                "title": "Bitcoin Is Hope ft. Michael Saylor",
                "duration": 175
            },
            {
                "id": "K2ku1A5Ox8U",
                "title": "Blame it on MT.GOX",
                "duration": 234
            },
            {
                "id": "_YvLh4pUB4Y",
                "title": "The Times They Are A-Changin' (Bitcoin version)",
                "duration": 119
            },
            {
                "id": "yp0diaVLPrQ",
                "title": "Mark Zuckerberg's Sister Sings to Crypto",
                "duration": 141
            },
            {
                "id": "7wBg1lBKtyg",
                "title": "Lil Bubble - When Moon? (Mad World - Bitcoin Parody)",
                "duration": 79
            },
            {
                "id": "U4W05HzAWuM",
                "title": "The Plan",
                "duration": 140
            },
            {
                "id": "r-vbEOo2x4Y",
                "title": "LFG",
                "duration": 114
            },
            {
                "id": "PYeUQpbMy1o",
                "title": "Love You Like A Bitcoin",
                "duration": 240
            },
            {
                "id": "qDUjrUot2C0",
                "title": "Lil Bubble - Buy More Bitcoin (Official Visualizer) ft. Andrew Tate",
                "duration": 204
            },
            {
                "id": "PL0yOu0dNwo",
                "title": "Mainframe - Proof of Freedom",
                "duration": 133
            },
            {
                "id": "_hQRxuYBx0w",
                "title": "Chuty - Bitcoin (Videoclip Oficial)",
                "duration": 210
            },
            {
                "id": "qki2ZIhnA6M",
                "title": "Captain Youth – Bitcoin Money (Official Lyric Video)",
                "duration": 212
            },
            {
                "id": "_pv-uKXaBFc",
                "title": "Bitcoin's Better Than Gold",
                "duration": 213
            },
            {
                "id": "IGeM1XWuLS4",
                "title": "Rules That Will Survive",
                "duration": 125
            },
            {
                "id": "9I9l8vlTvJE",
                "title": "Toxic Maximalist - The Orange Pill Jam Project",
                "duration": 218
            },
            {
                "id": "nvlvG18AcCo",
                "title": "Bitcoin Bob: Money Monopoly",
                "duration": 140
            },
            {
                "id": "lvw5XX6IQkc",
                "title": "Sell in May (Thunderstruck Crypto Parody)",
                "duration": 296
            },
            {
                "id": "kdvTkddp1F0",
                "title": "Don't Get Zhou Tonged!!! - Zhou Tonged",
                "duration": 157
            },
            {
                "id": "ZAmIm2TkrUM",
                "title": "Bitcoin's Going To The Moon (Jpop)",
                "duration": 220
            },
            {
                "id": "Hgqdss3DY5M",
                "title": "Lil Bubble - Man With Bitcoin (Official Visualizer)",
                "duration": 142
            },
            {
                "id": "dgKlBQmGQ98",
                "title": "Most Toxic Bitcoin Maxi - Robbie P",
                "duration": 208
            },
            {
                "id": "DNYzHGM50Ys",
                "title": "Too Bit To Fail - Proof of Word EP",
                "duration": 1560
            },
            {
                "id": "SIFN4u13FEU",
                "title": "Diamond Hands & Laser Eyes - Robbie P (Official Music Video)",
                "duration": 184
            },
            {
                "id": "Bv9Ug00PZZU",
                "title": "Avoided Wars",
                "duration": 154
            },
            {
                "id": "-UyRTltUv7w",
                "title": "Genesis Block",
                "duration": 157
            },
            {
                "id": "gIEQ0dPBOoY",
                "title": "Trying to hodl sh!*coins like (Fast n Furious Crypto Meme)",
                "duration": 85
            },
            {
                "id": "ZLYx-SXUjUk",
                "title": "Richard - The Flood ft Tomer Strolight",
                "duration": 166
            },
            {
                "id": "_fymw1iOfiM",
                "title": "Lil Bubble - ALL TIME HIGH (Bitcoin Anthem - Official Music Video)",
                "duration": 118
            },
            {
                "id": "UdbOaVdIUTM",
                "title": "The Bitcoin Song - Ohio Toast Ska Man",
                "duration": 139
            },
            {
                "id": "gu122fUBlxA",
                "title": "Captain Youth – Maul Me (Lyric Video)",
                "duration": 175
            },
            {
                "id": "vyKA1pW0CBA",
                "title": "Bitcoin All The Way Up (Remix) - Dollar Vigilante feat. Freenauts",
                "duration": 173
            },
            {
                "id": "vnMBfreYTA4",
                "title": "Lil Bubble - Dammit (Blink 182 Crypto Parody Version)",
                "duration": 157
            },
            {
                "id": "3lUUDwSSkWo",
                "title": "Bitcoin Miner's Daughter",
                "duration": 212
            },
            {
                "id": "U5NGVH8HDaw",
                "title": "Bitcoin Boomdeyada!",
                "duration": 66
            },
            {
                "id": "skhA8n8iRCc",
                "title": "It's Too Late To Sell The Highs (Timbaland - Apologize - Crypto Crash Parody Version)",
                "duration": 140
            },
            {
                "id": "mkKFR5sB44s",
                "title": "Pizza Day",
                "duration": 210
            },
            {
                "id": "YyCoM4WTU74",
                "title": "Stack Sats - Jack Mallers x Pleb Music",
                "duration": 97
            },
            {
                "id": "6KNOqrjkNaE",
                "title": "Crypto Weekly Rap Up (Bitcoin Rap) - Week 2",
                "duration": 205
            },
            {
                "id": "37Bc5ZmvX8Y",
                "title": "Lil Bubble - Old Saint Nicholas (Crypto Christmas)",
                "duration": 130
            },
            {
                "id": "gIbyaej97mI",
                "title": "Hope In Numbers",
                "duration": 131
            },
            {
                "id": "VQ8H3qGkrFM",
                "title": "When Moon Remix (Lil Bubble in Paris) @ Binance Blockchain Week 2022",
                "duration": 111
            },
            {
                "id": "eSB4VJliyww",
                "title": "Lil Bubble - F*cking Zero (Official Visualizer) ft. Michael Saylor",
                "duration": 155
            },
            {
                "id": "_c9WOks2mvg",
                "title": "Pump It Higher",
                "duration": 156
            },
            {
                "id": "J4pLMsk-nVA",
                "title": "SATS OVER EVERYTHING - Manlikekweks x Encorebeats",
                "duration": 218
            },
            {
                "id": "DZNUMcOGbq4",
                "title": "All The Way Up (Bitcoin Rap Parody)",
                "duration": 149
            },
            {
                "id": "4kmWR5bWHAc",
                "title": "Andrew Tate - Buy More Bitcoin (Lil Bubble House Remix)",
                "duration": 216
            },
            {
                "id": "v0JS5jGg_vQ",
                "title": "Lil Bubble - Bitcoin House DJ Set (Vol. 1) - Bitcoin House Mix",
                "duration": 2387
            },
            {
                "id": "7gfBP8kPzRA",
                "title": "The Bitcoin Song - Jay-Z Empire State of Mind Parody",
                "duration": 99
            },
            {
                "id": "UjkYo7t15yk",
                "title": "Bitcoin (Official Video) - Shehbaaz",
                "duration": 228
            }]
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
                "title": "Why Bitcoin Booms in October - Simply Bitcoin",
                "duration": 717
            },
            {
                "id": "Q_FFfWvq-z8",
                "title": "CNBC: The Greatest Crypto Bull Run Of Our Lifetime HAPPENING NOW",
                "duration": 527
            },
            {
                "id": "LGYcl4hwUOI",
                "title": "Bitcoin at 200-Week Moving Average - Buy Signal?",
                "duration": 682
            },
            {
                "id": "b_u1O9qzG6U",
                "title": "Big Bitcoin Adoption News!",
                "duration": 1517
            },
            {
                "id": "N7Z7tpwSlBg",
                "title": "Strategy CEO on 2026 Bitcoin Outlook - Fox Business",
                "duration": 603
            },
            {
                "id": "G0csA1i4rtU",
                "title": "Bitcoin ETFs Explained: The Future of Crypto in 2025",
                "duration": 745
            },
            {
                "id": "DyMVHXz9Tgs",
                "title": "Bitcoin ETFs Survive First Stress Test - Bloomberg",
                "duration": 2644
            },
            {
                "id": "1nsIy7PWXyY",
                "title": "Bitcoin Price Analysis - Key Levels",
                "duration": 782
            },
            {
                "id": "uX4jfBZWpkY",
                "title": "What's Behind Bitcoin's Remarkable Surge?",
                "duration": 63
            },
            {
                "id": "HOYnvEVOTJA",
                "title": "Simply Bitcoin - Daily News Update",
                "duration": 4561
            },
            {
                "id": "CyVyCOHODk4",
                "title": "Ted Cruz: Why the Left Hates Bitcoin and Cryptocurrencies",
                "duration": 1386
            },
            {
                "id": "zo1pZlgAvpY",
                "title": "Is This the Final Bitcoin Crash Before All-Time Highs? - Simply Bitcoin",
                "duration": 1208
            },
            {
                "id": "S2WPt7ZO1rk",
                "title": "Bitcoin Touches 13-Month High - Valkyrie Refiles for Spot ETF (CNBC)",
                "duration": 701
            },
            {
                "id": "iQOiQZ_g97I",
                "title": "Wall Street Week - The Crypto Craze",
                "duration": 122
            },
            {
                "id": "WSBQunQ2jJA",
                "title": "The Time Has Come - El Salvador Makes Bitcoin Legal Tender",
                "duration": 90
            },
            {
                "id": "bOBiu9zP5jA",
                "title": "Bitcoin Owner Will Lose $260 Million If He Can't Remember Password - TODAY",
                "duration": 186
            },
            {
                "id": "kh-YqlKC23k",
                "title": "Why Bitcoin Is Still King in 2025 - USA & UK Adoption",
                "duration": 170
            },
            {
                "id": "omyLCxja20g",
                "title": "FED Sabotages the Bitcoin Bank - Simply Bitcoin EP 601",
                "duration": 4169
            },
            {
                "id": "0sGgpNg_2IM",
                "title": "Bitcoin Tops $100K - Big Finance Admits Wrong (The Bitcoin Group #433)",
                "duration": 6965
            },
            {
                "id": "5c03NCvohCA",
                "title": "Bitcoin ETF Record Performance - Bloomberg",
                "duration": 927
            },
            {
                "id": "241nNtbdXaA",
                "title": "Bitcoin Experts Predict 2025 Will Be the Year of Mass Adoption",
                "duration": 883
            },
            {
                "id": "inSLOPC8grc",
                "title": "Bitcoin: Better Than Bonds",
                "duration": 788
            },
            {
                "id": "W-ArTN0Xj4c",
                "title": "Bitcoin Surges and Vanguard Allows Crypto ETF Trading - CNBC",
                "duration": 793
            },
            {
                "id": "BSiQHfEUabI",
                "title": "Bitcoin Hits New All-Time High - CNBC",
                "duration": 128
            },
            {
                "id": "wR6SJgMnstE",
                "title": "Using Bitcoin as an Inflationary Hedge",
                "duration": 281
            },
            {
                "id": "zyUxPX7Mp2U",
                "title": "Bitcoin Could Go Past $100k This Year - Chainalysis CEO",
                "duration": 297
            },
            {
                "id": "-LPit2bEWAo",
                "title": "BlackRock CEO on Bitcoin ETF Success - CNBC",
                "duration": 353
            },
            {
                "id": "K4ciiDyUvUo",
                "title": "Larry Fink: Bitcoin is Digital Gold - CNBC",
                "duration": 153
            },
            {
                "id": "dEnbFU-HySk",
                "title": "Shark Tank's Robert Herjavec Says Bitcoin Price Will Skyrocket Again - CNBC",
                "duration": 144
            },
            {
                "id": "wC4nzqrgvik",
                "title": "Iran Used Bitcoin To Break US Sanctions - Simply Bitcoin",
                "duration": 492
            },
            {
                "id": "WaEBc2prSPE",
                "title": "Next-Gen Bitcoin ETFs Outperforming - Bloomberg",
                "duration": 2680
            },
            {
                "id": "DDk6-tdHeXQ",
                "title": "Bitcoin Technical Analysis - Elliott Wave",
                "duration": 2078
            },
            {
                "id": "CbEHD0esI_A",
                "title": "MicroStrategy Bitcoin Reserve Strategy - CNBC",
                "duration": 110
            },
            {
                "id": "DnT8bUl_DM8",
                "title": "Bitcoin Is Being Repriced by AI",
                "duration": 947
            },
            {
                "id": "2PvvIoi7l_Y",
                "title": "Lebanon Banks Close Doors on Customers - Bitcoin Fixes This",
                "duration": 2879
            },
            {
                "id": "diF93mE7nqg",
                "title": "Bitcoin Rises to All-Time High",
                "duration": 75
            },
            {
                "id": "dy2ZTOq22bQ",
                "title": "Cathie Wood Increased Her Bitcoin Price Prediction for 2025",
                "duration": 511
            },
            {
                "id": "gij6bJkyH2w",
                "title": "Individual Ownership Peaked in 2024 and What Comes Next for Bitcoin - The Bitcoin Layer",
                "duration": 2395
            },
            {
                "id": "InoqMzIarF0",
                "title": "Inside Bitcoin's Trend Shift: Bear Zone, Liquidations, & Key Support - The Bitcoin Layer",
                "duration": 2937
            },
            {
                "id": "Eds4tmPrs9s",
                "title": "Bitcoin's Hidden Signals REVEALED in the TBL Chart Pack - The Bitcoin Layer",
                "duration": 3181
            },
            {
                "id": "yIID9ubQLgk",
                "title": "Beyond the Headlines: How to Really Understand Financial Markets. - The Bitcoin Layer",
                "duration": 1774
            },
            {
                "id": "RIPIG7YBh8s",
                "title": "RECESSION WATCH, Economic Update, & SOFR Trouble - The Bitcoin Layer",
                "duration": 1940
            },
            {
                "id": "hSlcy29ETjQ",
                "title": "Bitcoin Update: $500-Million ETF Inflows, Market Absorbs Mt. Gox BTC, $50K Level Defended - The Bitcoin Layer",
                "duration": 1141
            },
            {
                "id": "8MKP-Su-cvg",
                "title": "Bitcoin Update: ETF-Buyers, BTC Dominance, Stocks Correlation - The Bitcoin Layer",
                "duration": 795
            },
            {
                "id": "TfjSdlopmrk",
                "title": "Commercial Real Estate Update: Property Is DOWN 30%, Equity Is GONE - The Bitcoin Layer",
                "duration": 1545
            },
            {
                "id": "8hyuhziDWoQ",
                "title": "Bitcoin Market Insights: Mt. Gox, ETF Flows, and Short-Term Holder Analysis - The Bitcoin Layer",
                "duration": 1407
            },
            {
                "id": "26amYt4DB-s",
                "title": "Bitcoin Approaching A KEY Support Level... Will It Bounce Or Break? - The Bitcoin Layer",
                "duration": 904
            }]
    },
    {
        "id": "podcasts-debates",
        "name": "Podcasts, Debates & Spaces",
        "emoji": "🎙️",
        "desc": "Long-form Bitcoin conversations, debates & recorded X Spaces",
        "color": "#ef4444",
        "videos": [
            {"id":"XJU8r6WiipM","title":"Bitcoin vs Gold - Response to Peter Schiff","duration":1690},
            {"id":"MmdQKU0YNX4","title":"Bitcoin Will Hit $850K - Max Keiser Prediction","duration":977},
            {"id":"K5bZ4HPpwxw","title":"Fixing Government Corruption - WBD","duration":6182},
            {"id":"xa5iT1nklyU","title":"Brian Kelly vs Peter Schiff - Bitcoin Bull vs Bear","duration":672},
            {"id":"2ZaMzWZyXe8","title":"Wall Street Meets Bitcoin: Orange-Pilling Finance - Strive CEO","duration":1348},
            {"id":"l1Rgq8UY3zo","title":"Why Bitcoin is Different - Stephan Livera","duration":669},
            {"id":"1jZQNo_rRsQ","title":"Bitcoin Poised for Cycle Top? Corporate Treasuries - Saifedean","duration":1763},
            {"id":"3YuscY1L1zE","title":"Why You Should Be a Bitcoin Maximalist","duration":541},
            {"id":"tbCVXyUGO3o","title":"I Bought This Instead of Bitcoin - Mark Moss","duration":387},
            {"id":"wBEqw-PSBlg","title":"Why Selling Bitcoin for Fiat Misses the Picture - Mark Moss","duration":610},
            {"id":"aN2G0Uvahf8","title":"What Bitcoin Did - Beginner Guide","duration":3437},
            {"id":"meCoGKugjMQ","title":"Marty Bent on the Power of Bitcoin","duration":3155},
            {"id":"nMicPEQM4HY","title":"Maximalism is Dead? | Peter McCormack","duration":1541},
            {"id":"to7FF7ZmBl0","title":"Lyn Alden: No Massive Bust or Boom? - Coin Stories","duration":3383},
            {"id":"TUO10-HcdvY","title":"The Ultimate Bitcoin vs. Everything Debate Loop","duration":2923},
            {"id":"yCtVkIEIhCg","title":"Bitcoin Can Never Go to Zero - Robert Breedlove","duration":442},
            {"id":"j89aAqfezX8","title":"Saving Bedford - Peter McCormack","duration":6434},
            {"id":"bhSGC08V47U","title":"Stephan Livera on Bitcoin Maximalism","duration":2547},
            {"id":"x0kNGaxLg18","title":"Lyn Alden: Why This Bitcoin Cycle Disappointed - Coin Stories","duration":3320},
            {"id":"0rlnVQoiVyc","title":"History of Bitcoin w/ Marty Bent","duration":5039},
            {"id":"N_qo_-QRqAM","title":"No More 4-Year Cycles? - Stephan Livera","duration":4128},
            {"id":"4Q1AasS6HLU","title":"Bitcoin 101 - Stephan Livera Podcast","duration":799},
            {"id":"J6I-OzXItfA","title":"Jack Dorsey Explains Bitcoin","duration":125},
            {"id":"ANtyYqcXR9w","title":"Marty Bent: Tales from The Crypt","duration":5936},
            {"id":"sTxdYxGqYDo","title":"Stephan Livera: Why Bitcoin Only","duration":1708},
            {"id":"unCR7k3-aoE","title":"Bitcoin Is the Apex Asset - Robert Breedlove","duration":916},
            {"id":"6WxdkRk8cs4","title":"Stephan Livera: Bitcoin Education Deep Dive","duration":3706},
            {"id":"QT_YDxTl1FQ","title":"Jack Mallers: Bitcoin Maximalist Post-GENIUS Act","duration":1621},
            {"id":"9DuhDgqx21w","title":"Peter Schiff: Bitcoin Strategy is a Fraud","duration":3431},
            {"id":"Bh7LBF9cU6w","title":"Stock-to-Flow & Power Law Debate Marathon","duration":736},
            {"id":"HwNSykjO-gI","title":"Lyn Alden: Changing World Order - Coin Stories","duration":3630},
            {"id":"oMDHTVwSRHI","title":"1 Bitcoin Is All You Need","duration":1233},
            {"id":"JaMJi1_1tkA","title":"Bitcoin Rap Battle: Hamilton vs. Satoshi - ft. EpicLloyd","duration":362},
            {"id":"227anLxQ0mU","title":"The Money Printer Is Back On with Lyn Alden - The Bitcoin Layer","duration":3688},
            {"id":"yWTLczpO808","title":"RISE of the American Empire with Brent Johnson - The Bitcoin Layer","duration":3428},
            {"id":"IYOpQ2RYhpI","title":"Inside the Global Liquidity Shift Powering Bitcoin with Dr. Jeff Ross - The Bitcoin Layer","duration":2765},
            {"id":"dkph5lF2KmA","title":"This CEO Just Raised $750 Million to Buy Bitcoin With ZERO Debt - The Bitcoin Layer","duration":1922},
            {"id":"nQ0s2exh9x8","title":"Corporations Just Surpassed ETFs in Bitcoin Buying-Here's What It Means with Matthew Sigel - The Bitcoin Layer","duration":1629},
            {"id":"3j8iFIZ4TGM","title":"I Went Down a Eurodollar Rabbit Hole with AI - The Bitcoin Layer","duration":1969},
            {"id":"sJinwqKz7zQ","title":"Global Liquidity Update with Michael Howell: The Case for a U.S. Gold Revaluation Is Building - The Bitcoin Layer","duration":2857},
            {"id":"wjMvbpBanog","title":"America's Big Reset: Kill the IRS, Split the Dollar, and Fund It All with Sovereign Wealth - The Bitcoin Layer","duration":2282},
            {"id":"TgjFQpFQ-5A","title":"Your Wealth Is Melting: Freeze It with Bitcoin - The Bitcoin Layer","duration":2301},
            {"id":"HUcjmoi7zm4","title":"Retire with Bitcoin: Leveraging IRAs, Custody, and Long-Term Wealth Strategies - The Bitcoin Layer","duration":1347},
            {"id":"DZ2c8CWkwxg","title":"Can We Really Abolish the Federal Reserve? An Interview with Peter St Onge - The Bitcoin Layer","duration":3010},
            {"id":"bCiIcbR8r9w","title":"Mastering Bitcoin Self-Custody with BTC Sessions - The Bitcoin Layer","duration":2268},
            {"id":"t-7GGhmipt0","title":"Operation Chokepoint 2.0: The Fed's Secret War on Crypto with Caitlin Long - The Bitcoin Layer","duration":3498},
            {"id":"iYLbtVutcDQ","title":"HOUSING MARKET CRISIS Is Developing with Melody Wright - The Bitcoin Layer","duration":2044},
            {"id":"iYVMX0zdp64","title":"The BITCOIN Act of 2024 with Senator Cynthia Lummis - The Bitcoin Layer","duration":1976},
            {"id":"VTCzVWgJJWs","title":"Bitcoin As The Apex Predator - Robert Breedlove (Pomp Podcast)","duration":4176},
            {"id":"HrehEWYj16s","title":"Robert Breedlove: Philosophy of Bitcoin from First Principles - Lex Fridman","duration":14629},
            {"id":"OfWJSEmDiKI","title":"Will Bitcoin Survive the Spam Wars?","duration":496},
            {"id":"mEbfbAllsO4","title":"Twitter Spaces recording | Halloween Special - 10 Scariest Moments in #bitcoin & #crypto","duration":3353},
            {"id":"66HRDI_Vxhc","title":"El Salvador Passes Bitcoin Law | Twitter Spaces - Hosted by Nic Carter ft. ES President Nayib Bukele","duration":7265},
            {"id":"ti28Lq5hSVA","title":"Bitcoin, Chapter 11 & The Great Depression of the 2020s Update | X Space AMA","duration":3879},
            {"id":"runHWEAoLnc","title":"Twitter Spaces 03.11.2022 | Emergency Broadcast - A Message To Judge Glenn on Celsius","duration":2984},
            {"id":"rVFRWOK9Bqc","title":"Twitter Spaces AMA recording 🔴 | Emergency Broadcast - FTX Chapter 11 | 11.11.2022","duration":4315},
            {"id":"ITvc8lgpfzk","title":"Twitter Spaces: Wizards Weekly with Peter Brandt & JK","duration":1741},
            {"id":"lmPmRxurssU","title":"Bitcoin vs. Crypto: Why Bitcoin Only - Twitter Spaces","duration":6588},
            {"id":"zx3nyQ3gDHQ","title":"Xapo Talks X Spaces - Bitcoin Loans  Explained! Borrow Against Your Bitcoin","duration":3009},
            {"id":"1L1IO2Bgmrc","title":"BTCPayServer Twitter Spaces - How to become a #Bitcoin contributor","duration":4385},
            {"id":"ta56F9sjszk","title":"Bitcoin Is Digital Energy - Michael Saylor (Twitter Spaces Replay) Dec 28, 2021","duration":4777},
            {"id":"kkGDfuTj1Ew","title":"Bitcoin: There Is No Second Best - Michael Saylor & Greg Foss Twitter Spaces","duration":7870},
            {"id":"Xs4YtUqhF-8","title":"Bitcoin Freedom vs. Government Servitude - Bitcoin Magazine Twitter Spaces","duration":9328},
            {"id":"WNsVIxymEtM","title":"Bitcoin, not Slavecoins with Aleks Svetski - Twitter Spaces","duration":5927},
            {"id":"jlVLCeHxQ2M","title":"Nic Carter - Proof of Work vs Proof of Stake: Bitcoin Magazine Spaces","duration":5588},
            {"id":"y5e-PhaGm_4","title":"Orange Pill App Twitter Spaces Jan 2023 - Jeff Booth, Breedlove, Knut, Daniel Prince, BTC Sessions","duration":7100},
            {"id":"KpQX-04LxJ8","title":"Mark Cuban DEBATE Vs. Bitcoiners (Preston Pysh, Pomp, Peter McCormack, and others) - Twitter Spaces","duration":5657},
            {"id":"yLl00j5p8Nc","title":"Mark Cuban debating #Bitcoin on spaces","duration":1114},
            {"id":"2OHTUDACasc","title":"Mark Cuban talking bitcoin on Twitter Spaces W/ Preston Pysh, Pomp, Peter McCormack + 15K listeners","duration":5663}
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
                "title": "Trump's Policies - Strategic Bitcoin Reserve & Stablecoin Law",
                "duration": 823
            },
            {
                "id": "TE0eFKTJEfQ",
                "title": "Bitcoin Policy Outlook 2025 - Strategic Reserves, BitBonds & Privacy",
                "duration": 3211
            },
            {
                "id": "tWWb0-A0Rdk",
                "title": "Bitcoin Laws Are Changing | SAF",
                "duration": 4003
            },
            {
                "id": "jfUX8d80ifw",
                "title": "Mined In America Act FT. Dennis Porter",
                "duration": 2432
            },
            {
                "id": "pBMnPec4AC4",
                "title": "Congressman Tom Emmer SLAMS SEC Chair Gary Gensler",
                "duration": 341
            },
            {
                "id": "h_oAr4wn7M4",
                "title": "House Financial Services Committee Hearing: Oversight of the SEC",
                "duration": 19400
            },
            {
                "id": "_6PvTUqyRt8",
                "title": "Alex Gladstein on Bitcoin Freedom",
                "duration": 599
            },
            {
                "id": "WO6Ww-MLQGs",
                "title": "Wyoming Senator Cynthia Lummis - Texas Blockchain Summit",
                "duration": 1359
            },
            {
                "id": "pR4t4dRdajw",
                "title": "Bitcoin vs Authoritarianism - Gladstein",
                "duration": 1266
            },
            {
                "id": "YqWoj2eFDp4",
                "title": "Right To Mine Policy - Dennis Porter",
                "duration": 1720
            },
            {
                "id": "7ZSpFWEd-x0",
                "title": "Gary Gensler Testifies - Left SHAKING After Crypto Questions",
                "duration": 3155
            },
            {
                "id": "boZ7yJOFBk0",
                "title": "Crushing Anti-BTC Legislation - Porter",
                "duration": 2932
            },
            {
                "id": "kqOx7PjbNOw",
                "title": "Shootin Straight Episode 3: Senator Cynthia Lummis",
                "duration": 2778
            },
            {
                "id": "vr1M2anvbWU",
                "title": "Trump's Bitcoin Reserve Plan - Power Move or Trap?",
                "duration": 679
            },
            {
                "id": "P7IQeU31R0o",
                "title": "House Holds Joint Crypto Hearing - CNBC Crypto World",
                "duration": 600
            },
            {
                "id": "5IHNLgkO6Ls",
                "title": "Trump Signs Order to Establish Strategic Reserve of Cryptocurrencies",
                "duration": 376
            },
            {
                "id": "DJhgLMMAPHQ",
                "title": "Trump Nominates Crypto Advocate Paul Atkins as SEC Chair",
                "duration": 41
            },
            {
                "id": "tja-5y_FvgY",
                "title": "Regulatory Shackles Are Off",
                "duration": 1567
            },
            {
                "id": "MuobSz7534s",
                "title": "Paving the Frontier - Dennis Porter",
                "duration": 3119
            },
            {
                "id": "YwZseBZOc6U",
                "title": "The Bitcoin Strategic Reserve",
                "duration": 1855
            },
            {
                "id": "kN5codbLCCY",
                "title": "Bitcoin Regulation: National Security Issue",
                "duration": 740
            },
            {
                "id": "kSbMU5CbFM0",
                "title": "Bitcoin vs Authoritarianism - HRF",
                "duration": 9217
            },
            {
                "id": "UVg4AjuPBQU",
                "title": "Sen. Lummis on Crypto Oversight Bill - Stablecoins Need Hard Assets",
                "duration": 470
            },
            {
                "id": "jMg3U-51Obw",
                "title": "GOP Rep Unveils Bold Crypto Tax Twist - No Capital Gains",
                "duration": 200
            },
            {
                "id": "m3es0G4m_R4",
                "title": "Sen. Lummis Questions Gary Gensler (SEC) and Rohit Chopra (CFPB)",
                "duration": 560
            },
            {
                "id": "nDSPY2XMmL0",
                "title": "New Hampshire's Strategic Crypto Reserve - What to Know",
                "duration": 416
            },
            {
                "id": "_E_5Hk-vRj8",
                "title": "Bitcoin U.S. Reserve in 30 Days?",
                "duration": 1410
            },
            {
                "id": "jjl_kp9v-Eg",
                "title": "Washington's Crypto Awakening: The Lawmaker Town Hall",
                "duration": 3188
            },
            {
                "id": "78xSNqLfJDA",
                "title": "Dem Lawmaker Urges Yellen To Crack Down On Crypto Bros",
                "duration": 301
            },
            {
                "id": "R-Rd12saPh8",
                "title": "The Fight for Bitcoin in America",
                "duration": 0
            },
            {
                "id": "lwJpvqMeLJg",
                "title": "Bitcoin Breaking Records - SuperTalk",
                "duration": 340
            },
            {
                "id": "c1l7EFvyTyM",
                "title": "Gary Gensler GRILLED on Crypto at Congress Committee Hearing",
                "duration": 6651
            },
            {
                "id": "5VczGHHbDTQ",
                "title": "The AI-Pentagon War That Every Bitcoiner Needs to Understand - The Bitcoin Layer",
                "duration": 1733
            },
            {
                "id": "V82emH4q6o0",
                "title": "Claude Eclipses Trump as the Most Important Force in Global Macro - The Bitcoin Layer",
                "duration": 2697
            },
            {
                "id": "AXKL48mnU0E",
                "title": "Japan's Historic Election, Yen Defense, & Why Bitcoin Is Still a Liquidity Trade - The Bitcoin Layer",
                "duration": 1938
            },
            {
                "id": "pnG86iyRsbA",
                "title": "The Trump Doctrine Has ARRIVED, Here's What It Means for 2026 - The Bitcoin Layer",
                "duration": 2072
            },
            {
                "id": "Ef5flMEKmic",
                "title": "What Falling Gas Prices Signal for Bitcoin & The 2026 Midterm Elections - The Bitcoin Layer",
                "duration": 3370
            },
            {
                "id": "-C13zU-ZsT8",
                "title": "EUROPEAN BREAKING POINT: Italy Takes Gold Back, Sovereign Bond Crisis, & Bitcoin w/ Matt Dines - The Bitcoin Layer",
                "duration": 3099
            },
            {
                "id": "yOtZaPuVpTE",
                "title": "THE MOST IMPORTANT DOCUMENT OF 2025: What the New U.S. National Security Strategy Means for Markets - The Bitcoin Layer",
                "duration": 3598
            },
            {
                "id": "yuBTr3jLFQQ",
                "title": "INSIDE THE SELLOFF: Bitcoin, Sanctions, & The Liquidity Drain - The Bitcoin Layer",
                "duration": 1631
            },
            {
                "id": "pCDyEsZJVLI",
                "title": "America's Grand Strategy: Repo, China, Jensen Huang, & Bitcoin's Next Move - The Bitcoin Layer",
                "duration": 3239
            },
            {
                "id": "3f170IT1nQU",
                "title": "Bitcoin Reacts to Tariff Tensions: What's Next for Price & Liquidity - The Bitcoin Layer",
                "duration": 1943
            },
            {
                "id": "12zBLvoVRFQ",
                "title": "Element Zero",
                "duration": 1401
            }]
    },
    {
        "id": "saylor",
        "name": "Saylor Series & Corporations",
        "emoji": "👑",
        "desc": "Michael Saylor's complete Bitcoin masterclass - strategy, philosophy & the future of money",
        "color": "#f7931a",
        "videos": [
            {
                "id": "1c7weMce8_A",
                "title": "Give Me a Lever Long Enough | True North Podcast | Ep. 17",
                "duration": 5856
            },
            {
                "id": "fzg9I7hHdzs",
                "title": "Economics, Inflation, Interest Rates & Competition - The Saylor Series Episode 9",
                "duration": 6153
            },
            {
                "id": "cyL2t75YLQM",
                "title": "Building Japan's Bitcoin Standard w/ Simon Gerovich | Strategy World 2026",
                "duration": 892
            },
            {
                "id": "LP5W_BUXnEw",
                "title": "Bitcoin, Economics & Mimetics - Saylor & Robert Breedlove",
                "duration": 4891
            },
            {
                "id": "z3saVEaGiFI",
                "title": "The Bitcoin Index Inclusion Question w/Dylan LeClair, Tyler Evans, Alexandre Laizet & George Mekhail",
                "duration": 1376
            },
            {
                "id": "Z6QPPhdQCEM",
                "title": "Why Strategy ($MSTR) stock did not fall back down to $20 #bitcoin #mstr #trading",
                "duration": 63
            },
            {
                "id": "TjgrV6M2VyU",
                "title": "What does it take for $MSTR to meet their dividend obligations? #mstr #bitcoin",
                "duration": 111
            },
            {
                "id": "TPCHXc7qf2U",
                "title": "The Reality of AI in 2026 #trading #mstr #bitcoin #ai",
                "duration": 105
            },
            {
                "id": "nuKqepvkOqI",
                "title": "All In On Bitcoin | The Jeff Walton Story",
                "duration": 3452
            },
            {
                "id": "b-_UvOwM3LE",
                "title": "Bitcoin Supercycle | The Hurdle Rate Ep. 29",
                "duration": 3174
            },
            {
                "id": "wcJtAcOjlTM",
                "title": "Bitcoin-Linked Convertibles | Strategy World 2026",
                "duration": 975
            },
            {
                "id": "DrxZJY9EhWM",
                "title": "MSTR Q4 2025 Earnings Call Analysis: The Digital Credit Stress Test | BFC Show Ep. 25",
                "duration": 4536
            },
            {
                "id": "6fBhCOV1LH0",
                "title": "Why Bitcoin Is Emerging as Prime Collateral w/ Hunter Albright of SALT Lending | BFC Show Ep. 29",
                "duration": 2677
            },
            {
                "id": "VWHBbtUWBEE",
                "title": "Financial Leverage & Bear Sightings | True North Podcast | Ep. 9",
                "duration": 8860
            },
            {
                "id": "CcztyNj5gps",
                "title": "The Great Unraveling: Why Bonds Are Dead & Bitcoin Is Rising w/ Mark Moss",
                "duration": 916
            },
            {
                "id": "D8KVtBKQBtE",
                "title": "Navigating MSTR and BTC | True North Podcast | Ep. 1",
                "duration": 7618
            },
            {
                "id": "dPvVqTlPRPY",
                "title": "Credit Ratings for Digital Capital | The Hurdle Rate Ep. 33",
                "duration": 3261
            },
            {
                "id": "iBgYVIyiYzI",
                "title": "Up To Par | True North Podcast | Ep. 52",
                "duration": 4087
            },
            {
                "id": "kCHcX7Xw104",
                "title": "Unlocking Value in Bitcoin Treasury Companies w/ Tyler Evans, Loren Asmus, John Riggins, Mason Foard",
                "duration": 1828
            },
            {
                "id": "FDr6VQq7FjQ",
                "title": "Commercial Banks Are Moving Into Bitcoin Credit",
                "duration": 95
            },
            {
                "id": "QdKlVpR5jpU",
                "title": "Morgan Stanley Announces New Bitcoin ETF",
                "duration": 506
            },
            {
                "id": "eS5VL35RNvE",
                "title": "True North Orlando 2025 - Conviction as a service | Ben Werkman",
                "duration": 950
            },
            {
                "id": "zeKFDibW0nQ",
                "title": "Every Company Will Be a Bitcoin Treasury Company w/ Adam Back and Tyler Evans",
                "duration": 1450
            },
            {
                "id": "dogJz_CfQW8",
                "title": "Inspiring and Relaxing Michael Saylor Speaks about Bitcoin for 1H",
                "duration": 3600
            },
            {
                "id": "003pvQdffr4",
                "title": "Strategic Risk Taking | The Hurlde Rate Ep. 23",
                "duration": 3175
            },
            {
                "id": "rv8HD3l0VEE",
                "title": "Building a Digital Empire | True North Podcast | Ep. 36",
                "duration": 7343
            },
            {
                "id": "sjYANTSww34",
                "title": "Michael Saylor Briefly Explains Why Bitcoin Is The Best Store of Value",
                "duration": 223
            },
            {
                "id": "lr4EjqoV0IE",
                "title": "📺 Bitcoin Breaks $77k + Why #Bitcoin is Better | BFC Show @ Strategy World 2026",
                "duration": 26536
            },
            {
                "id": "rHJskIc92H4",
                "title": "The Federal Reserve Is Broken | Bitcoiners Explain Why",
                "duration": 702
            },
            {
                "id": "KWBPeSQmn_I",
                "title": "Michael Saylor: We Built an Investment That Solves Every Investor's Biggest Dilemma",
                "duration": 88
            },
            {
                "id": "qOM3oKj5FmY",
                "title": "The Rise Of Bitcoin Treasuries w/ Tim Kotzman, Konrad Leasser, Wyatt O'Rourke & VIjay Selvam",
                "duration": 1276
            },
            {
                "id": "soNo3KkYGiU",
                "title": "Michael Saylor On Why Microsoft Needs A Bitcoin Strategy | Bitcoin for Corporations 2025",
                "duration": 1148
            },
            {
                "id": "1LLtefID_VE",
                "title": "The Hurdle Rate Is High | The Hurdle Rate Ep. 39",
                "duration": 2488
            },
            {
                "id": "6P97_koDGtA",
                "title": "Bitcoin vs Manhattan Real Estate in 1776 - Michael Saylor",
                "duration": 872
            },
            {
                "id": "WQGt4Lqx4dY",
                "title": "The Preferred Strategy is Digital Credit | The Hurdle Rate Ep. 34",
                "duration": 3108
            },
            {
                "id": "BWB6-2Agaqc",
                "title": "Wall Street Digital Gold Rush | True North Podcast | Ep. 31",
                "duration": 7295
            },
            {
                "id": "JS7lOkTgER4",
                "title": "Post $MSTR Q1 2025 Earnings call - reflections & breakdown",
                "duration": 2837
            },
            {
                "id": "CG68sLoBaGE",
                "title": "$MSTR True North - Episode 14 - Have Space Suit, Will Travel (1/22/25)",
                "duration": 7389
            },
            {
                "id": "raJ6uR_wTPQ",
                "title": "True North Now - Inside look at Semler Scientific | Featuring Eric Semler & Joe Burnett",
                "duration": 2620
            },
            {
                "id": "O3Nn0iPbN6s",
                "title": "True North Orlando 2025 - From Basements to Stages | Jeff and Crew",
                "duration": 3219
            },
            {
                "id": "mC43pZkpTec",
                "title": "Michael Saylor: Bitcoin, Inflation & Future of Money - Lex Fridman #276",
                "duration": 14215
            },
            {
                "id": "Ib33Jy5cOP4",
                "title": "Why Digital Credit is the Future of Global Finance #mstr #bitcoin #finance",
                "duration": 60
            },
            {
                "id": "HSqlTJjs36g",
                "title": "Michael Saylor's Strategy World 2026 Keynote: Digital Credit",
                "duration": 3032
            },
            {
                "id": "IdPKzulKdFI",
                "title": "Is Michael Saylor a Threat For Owning So Much Bitcoin?",
                "duration": 257
            },
            {
                "id": "DiU3od1PvS0",
                "title": "📺 LIVE: Over 12,000 BTC in ONE DAY from Strategy's STRC ATM - What will it hit today?",
                "duration": 30066
            },
            {
                "id": "5jLPnGVm0k4",
                "title": "T'was The Night Before Earnings | True North Podcast | Ep. 25",
                "duration": 5500
            },
            {
                "id": "sVNbuZx7VqQ",
                "title": "What Strategy ($MSTR) Could Be Worth In 5 Years",
                "duration": 802
            },
            {
                "id": "DuGoa1BmEu4",
                "title": "Bitcoin as a Generational Investment Opportunity w/ Katie Stockton, Hong Kim & Duke Waldrop",
                "duration": 1424
            },
            {
                "id": "xn607rFc1U8",
                "title": "True North Pulse - MSTR has a 91% chance of qualifying for the S&P 500 | Jeff Walton",
                "duration": 387
            },
            {
                "id": "PPdRbAmYK6c",
                "title": "Fireside Q&A: David Bailey & George Mekhail | Bitcoin for Corporations Symposium @ Bitcoin Asia 2025",
                "duration": 1449
            },
            {
                "id": "IzMSMzt6TDA",
                "title": "How Bitcoin Makes FIRE a Reality w/ Trey Sellers of Unchained",
                "duration": 375
            },
            {
                "id": "QypTOT49SnI",
                "title": "Why Bitcoin Treasury Companies Are Embracing Volatility w/ Metaplanet, Semler Scientific & Fold",
                "duration": 1611
            },
            {
                "id": "4A4goufTTI8",
                "title": "\"Rate My Stock / Risk of Credit\" | True North Podcast | Ep. 43",
                "duration": 7126
            },
            {
                "id": "0Hc1wsSSyvM",
                "title": "Translating Bitcoin for Legacy Corporates w/ Sam Callahan, Khing Oei, Lennart Lopin & Sean Bill",
                "duration": 1404
            },
            {
                "id": "lCKY-vfV4Ck",
                "title": "Week of Jan 17 Expiration | True North Podcast | Ep. 13",
                "duration": 5739
            },
            {
                "id": "nNt3WQnb00g",
                "title": "True North Now - Inside look at H100 | Featuring CEO Sander Andersen",
                "duration": 2028
            },
            {
                "id": "53s-U4SEI9s",
                "title": "Proof of Performance: The KPIs That Matter",
                "duration": 1423
            },
            {
                "id": "aZr_jfK9R10",
                "title": "Why Short Term Losses Lead to Long Term Wins for Strategy. #mstr #digitalcredit #bitcoin",
                "duration": 93
            },
            {
                "id": "yQL9yua9Yq0",
                "title": "Michael Saylor on Bitcoin: The Digital Transformation",
                "duration": 3032
            },
            {
                "id": "Ux44HPsGcjY",
                "title": "An Increasingly Digital World | The Hurdle Rate Podcast Ep.52",
                "duration": 3236
            },
            {
                "id": "KjFCRhhTO18",
                "title": "A Digital Credit Treasury | The Hurdle Rate Podcast Ep.51",
                "duration": 3634
            },
            {
                "id": "TXvvMGrZDAw",
                "title": "Billionaire Destroys Peter Schiff's Gold Argument - Michael Saylor",
                "duration": 450
            },
            {
                "id": "MOZejVJrhXU",
                "title": "Jeff Walton pitching Michael Saylor on a business idea",
                "duration": 128
            },
            {
                "id": "UC1R-lChYr4",
                "title": "What is Credit Risk? | True North Podcast | Ep.53",
                "duration": 7586
            },
            {
                "id": "ytmhmixeCRo",
                "title": "The Bitcoin Interview That YouTube Tried To Delete",
                "duration": 3012
            },
            {
                "id": "RK6t570jdgs",
                "title": "Strategy ($MSTR) Balance sheet vs Coinbase ($COIN)",
                "duration": 327
            },
            {
                "id": "aWtzOQTv8Dc",
                "title": "Saylor vs Dorsey: Battle for Bitcoin's Future",
                "duration": 917
            },
            {
                "id": "gCfA1lkmJo4",
                "title": "Michael Saylor - The Greatest Bitcoin Explanation",
                "duration": 619
            },
            {
                "id": "UtY3kTlf0cI",
                "title": "True North Now - Inside look at The Blockchain Group | Featuring Alexandre Laizet",
                "duration": 3740
            },
            {
                "id": "6cfdK5PWsxI",
                "title": "The M&A Era has Begun | The Hurdle Rate Ep. 28",
                "duration": 3033
            },
            {
                "id": "2RSKfdPcQ0g",
                "title": "The Credit Industry Is Changing",
                "duration": 473
            },
            {
                "id": "aUEhwe2GvtY",
                "title": "Bitcoin Economics and Evolution - The Saylor Series Episode 16",
                "duration": 5371
            },
            {
                "id": "UA29De0t3i0",
                "title": "True North Now - Bitcoin Core, OP_RETURN & Knots Explained | Featuring Rob Hamilton (Anchorwatch)",
                "duration": 3682
            },
            {
                "id": "tSAvXsMQjYg",
                "title": "What is Bitcoin? - Michael Saylor & Tucker Carlson (Nov 2021)",
                "duration": 396
            },
            {
                "id": "7gvogsnkjdc",
                "title": "SaylorWaves - 1 Hour of Relaxing Saylor Speaking about Bitcoin",
                "duration": 3634
            },
            {
                "id": "4Buu1h_89hY",
                "title": "Michael Saylor: Bitcoin Is As Risky As Crossing a Street",
                "duration": 667
            },
            {
                "id": "4QM0PwPOg90",
                "title": "Strategy's ($MSTR) Bitcoin Backed Credit Products",
                "duration": 2692
            },
            {
                "id": "VkHQHu5vYHs",
                "title": "Bitcoin, AI and The New QE | The Hurdle Rate Podcast Ep.53",
                "duration": 3615
            },
            {
                "id": "rP2YjjuQn5A",
                "title": "Liberation Day Chess | True North Podcast | Ep. 22",
                "duration": 7266
            },
            {
                "id": "FWXivDbeyWw",
                "title": "Strategy ($MSTR) Balance Sheet UPDATE",
                "duration": 499
            },
            {
                "id": "3MwB99iAYfY",
                "title": "Bitcoin Education Institute | Strategy World 2026",
                "duration": 697
            },
            {
                "id": "x1S9bQoSDUg",
                "title": "MSTR Can Buy More BTC Than Sellers Can Sell | True North Podcast | Ep. 62",
                "duration": 5825
            },
            {
                "id": "g2aE7hVKH1o",
                "title": "Structurally Bullish | The Hurdle Rate Ep. 41",
                "duration": 3580
            },
            {
                "id": "IEugtyLaaAQ",
                "title": "This Could Drive Bitcoin to $1,000,000",
                "duration": 342
            },
            {
                "id": "GUrt5xVBWMk",
                "title": "Michael Saylor Is A Bitcoin Genius - Pomp Podcast",
                "duration": 446
            },
            {
                "id": "qPtBbjFR5ak",
                "title": "The Next Trillion Dollar Company | Phong Le Interview",
                "duration": 3264
            },
            {
                "id": "YXi8DybUxqM",
                "title": "Michael Saylor & Phong Le: The Transformative Power of AI + BTC | Strategy World 2025 Keynote",
                "duration": 4719
            },
            {
                "id": "k7LEBbzVdHg",
                "title": "Beyond HODLing: Bitcoin Yield Strategies | Bitcoin MENA 2025",
                "duration": 1383
            },
            {
                "id": "MhNrsdAwaUM",
                "title": "The Death of Gold - The Saylor Series Episode 10",
                "duration": 4817
            },
            {
                "id": "S2ziezeoK4E",
                "title": "What's Actually Happening To Bitcoin & The Economy Right Now - Saylor",
                "duration": 2708
            },
            {
                "id": "IU1gzKQOYkA",
                "title": "Mitigating Volatility: Risk-Adjusted Bitcoin Treasury Strategies with BitMEX CEO Stefan Lutz",
                "duration": 1452
            },
            {
                "id": "p8G0JLe47Ws",
                "title": "Bitcoin vs. Gold (Who wins?) #gold #bitcoin #money",
                "duration": 89
            },
            {
                "id": "YFgJVIhc79E",
                "title": "Waiting For The World To Catch Up | True North Podcast | Ep. 59",
                "duration": 6387
            },
            {
                "id": "9jgoAqTErfs",
                "title": "Michael Saylor Brilliantly Explains Bitcoin's Superiority",
                "duration": 1253
            },
            {
                "id": "Tr2DBZIzrwQ",
                "title": "Zoom Out - We're Early | The Hurdle Rate Ep. 26",
                "duration": 2582
            },
            {
                "id": "uiFn8X96Zi4",
                "title": "Redefining Corporate Treasury: Prevalon Energy’s STRC Adoption | Strategy World 2026",
                "duration": 760
            },
            {
                "id": "FM638pY34uo",
                "title": "The Digital Credit Landscape | The Hurdle Rate Ep. 31",
                "duration": 3678
            },
            {
                "id": "LtcbR98uTJQ",
                "title": "The Saylor Series | Part 1: The History of Money, Bitcoin & the Machine Economy",
                "duration": 3646
            },
            {
                "id": "oPbHTD3vCEU",
                "title": "Strategy Launches STRE (“Stream”) Euro-Denominated Perpetual Preferred Stock Offering with 10% Yield",
                "duration": 1709
            },
            {
                "id": "GUUUF9ApuXw",
                "title": "How Metaplanet Turns Bitcoin Treasury Strategy Into Revenue",
                "duration": 81
            },
            {
                "id": "OA3DGM0vgtM",
                "title": "Michael Saylor Keynote - 2024 Cantor Fitzgerald Conference",
                "duration": 3539
            },
            {
                "id": "TfizaD0EF4I",
                "title": "Digital Assets at Morgan Stanley | Strategy World 2026",
                "duration": 1561
            },
            {
                "id": "CodcEnDtXtI",
                "title": "The Private Credit Bitcoin Cycle w/ Matt Dines | Bitcoin for Corporations Ep. 13",
                "duration": 3926
            },
            {
                "id": "9jsmGd9puYU",
                "title": "Saylor: Bitcoin vs Real Estate - Why BTC Wins",
                "duration": 646
            },
            {
                "id": "8XbR73Et0E4",
                "title": "Metaplanet and the BOJ's Debt Trap: The BTC Treasury Perfect Storm? w/ Dylan LeClair & Phil Geiger",
                "duration": 3845
            },
            {
                "id": "tvUQLJmQxuY",
                "title": "What's The End Game of a Bitcoin Treasury Company? - Austin Alexander, Alexandre Laizet, Jesse Myers",
                "duration": 1807
            },
            {
                "id": "YxlfOsFYAt4",
                "title": "Bitcoin Treasury Companies Are the Bridge to $20 Trillion",
                "duration": 111
            },
            {
                "id": "BcLBApRGdTo",
                "title": "Some Pretty Good Money Printing | The Hurdle Rate Ep.50",
                "duration": 3635
            },
            {
                "id": "X785ZNCW87g",
                "title": "How Real Is Strategy’s Bankruptcy Risk? ($MSTR)",
                "duration": 449
            },
            {
                "id": "5PkWE5sPqE4",
                "title": "Strategy ($MSTR) Digital Credit vs The World",
                "duration": 594
            },
            {
                "id": "3twzBeUU_HU",
                "title": "Wall Street Could Kick These Bitcoin Companies Out",
                "duration": 133
            },
            {
                "id": "AOGcC7Zyjy0",
                "title": "$MSTR & $STRK Preferred Stock thoughts 3/13/25",
                "duration": 2151
            },
            {
                "id": "EeeZSiZQ5q4",
                "title": "New Market Structures Using STRC & Bitcoin-Linked Products | Strategy World 2026",
                "duration": 603
            },
            {
                "id": "cVFfZ6XA6vA",
                "title": "What if Berkshire Hathaway dumped $373B into $STRC #bitcoin #digitalcredit #mstr",
                "duration": 68
            },
            {
                "id": "EoFVjY7AswM",
                "title": "Focus on the Future | The Hurdle Rate Ep. 30",
                "duration": 2876
            },
            {
                "id": "59vC4JxWIQU",
                "title": "Michael Saylor Keynote Address - BTC in DC 2025",
                "duration": 2364
            },
            {
                "id": "RI4xEHI7tGg",
                "title": "Michael Saylor - PBD Podcast Ep. 212",
                "duration": 7187
            },
            {
                "id": "-gqZiDZ_eNg",
                "title": "True North Orlando 2025 - Opening remarks from CEO of Strategy | Phong Le",
                "duration": 229
            },
            {
                "id": "g9hUmh6NnAg",
                "title": "Metaplanet: From COVID Collapse to Bitcoin Treasury Strategy",
                "duration": 120
            },
            {
                "id": "Sc9_2I3-LdE",
                "title": "The Revolution of Digital Credit | True North Podcast | Ep. 45",
                "duration": 6982
            },
            {
                "id": "Yd1UFNvqwWQ",
                "title": "How Bitcoin Changes Everything - The Saylor Series Episode 17",
                "duration": 5378
            },
            {
                "id": "dAFJzsJdfJI",
                "title": "Why Michael Saylor Went ALL IN On Bitcoin",
                "duration": 636
            },
            {
                "id": "3oo_slJedus",
                "title": "New Year, The Bottom's In | True North Podcast | Ep. 50",
                "duration": 7723
            },
            {
                "id": "Uc26OItd0JU",
                "title": "Joe Rogan and Michael Saylor on Bitcoin",
                "duration": 126
            },
            {
                "id": "0JNkMSvVpQk",
                "title": "MSTR stock could move up QUICKLY #trading #bitcoin #mstr",
                "duration": 117
            },
            {
                "id": "Aa-4HW_1RGY",
                "title": "If You Build It, They Will Come | True North Podcast | Ep. 21",
                "duration": 8521
            },
            {
                "id": "8h8Pyy4s12w",
                "title": "Michael Saylor on Fox News: Why El Salvador Adopted Bitcoin",
                "duration": 342
            },
            {
                "id": "7KYylYAdBm8",
                "title": "Software is going to zero #ai #mstr #bitcoin",
                "duration": 77
            },
            {
                "id": "PyYogQEnPNE",
                "title": "Should You Buy Bitcoin? - Michael Saylor",
                "duration": 219
            },
            {
                "id": "7KniD4pcsJ8",
                "title": "Securing the Institutional Frontier w/ Mike Belshe of BitGo",
                "duration": 498
            },
            {
                "id": "1R0J-myYPM0",
                "title": "Michael Saylor: Bitcoin is Hope",
                "duration": 387
            },
            {
                "id": "_wNqRmv81qY",
                "title": "Why Strategy Buys Bitcoin Even in a Bear Market! #mstr #investing #bitcoin",
                "duration": 85
            },
            {
                "id": "LbddD5vmFCY",
                "title": "True North Now - Inside look at The SmarterWeb Company | Featuring CEO Andrew Webley",
                "duration": 2912
            },
            {
                "id": "ACmMK_ruxn4",
                "title": "Have Space Suit, Will Travel | True North Podcast | Ep. 14",
                "duration": 7389
            },
            {
                "id": "d4XxuxnreBs",
                "title": "True Cost of Inflation - Michael Saylor & Lex Fridman",
                "duration": 885
            },
            {
                "id": "Wz2LE_21q5c",
                "title": "\"Pref Analysis / Deep Dive\" | True North Podcast | Ep. 42",
                "duration": 6050
            },
            {
                "id": "HtGSq8QphY4",
                "title": "Treasury Execution  Exchanges, OTC Desks and Custodians w/ Nick Coombs, Jonathan Ovadia & Allen Helm",
                "duration": 1299
            },
            {
                "id": "ctZz5Dl5OEE",
                "title": "New way of building wealth in your 20's  #bitcoin #mstr #investing",
                "duration": 74
            },
            {
                "id": "WrR95PFYDFQ",
                "title": "Michael Saylor On Buying Bitcoin With His Balance Sheet - Pomp Podcast #385",
                "duration": 5085
            },
            {
                "id": "VSB_lXxJbDA",
                "title": "Rewiring The Credit Curve | True North Podcast | Ep. 32",
                "duration": 6868
            },
            {
                "id": "fAldRInw4EA",
                "title": "The Mechanics of Capital and Digital Credit | True North Podcast | Ep. 61",
                "duration": 6879
            },
            {
                "id": "V-SQTNYZinw",
                "title": "Bitcoin Treasury Pitfalls: Is It Always The Right Move? | Bitcoin MENA 2025",
                "duration": 1250
            },
            {
                "id": "iojnUC6SXoQ",
                "title": "True North Orlando 2025 - Setting Sail with Satoshi & Saylor | Tim Kotzman",
                "duration": 320
            },
            {
                "id": "Umo16GF91HU",
                "title": "The Quiet Accumulation | True North Podcast | Ep. 56",
                "duration": 6518
            },
            {
                "id": "aFGCKwPNH4I",
                "title": "The Defining Question of Our Time in History - Michael Saylor",
                "duration": 194
            },
            {
                "id": "PXC0spZ2M4U",
                "title": "Is Bitcoin Digital Gold? - Michael Saylor",
                "duration": 402
            },
            {
                "id": "sLDz5_Xalak",
                "title": "Strategy ($MSTR) 2022 vs 2026: What Changed",
                "duration": 676
            },
            {
                "id": "-SrOHgdyuBQ",
                "title": "First 10 Years of Your Career are Important! #mstr #trading #retirement #financialplanning #bitcoin",
                "duration": 70
            },
            {
                "id": "bCj06VkJPMg",
                "title": "Why STRC Is the Most Important Security in All of Bitcoin | Strategy World 2026",
                "duration": 504
            },
            {
                "id": "l1YeMuTUjuY",
                "title": "The Equitization of Bitcoin: Treasury CEO Khing Oei | BFC Symposium, Amsterdam 2025",
                "duration": 936
            },
            {
                "id": "mBAJ-kZ1F2o",
                "title": "The Fiat Deflation Paradox: Bitcoin & AI as the Ideal Combination for Investors  | BFC Show Ep 24",
                "duration": 2353
            },
            {
                "id": "y8IH0OwFyW4",
                "title": "Michael Saylor: Why Bitcoin is a Truth Machine",
                "duration": 601
            },
            {
                "id": "tNJp3qBH1sw",
                "title": "Bitcoin is Cybernetic Life - The Saylor Series Episode 13",
                "duration": 5548
            },
            {
                "id": "qoDg83TKFYs",
                "title": "Steven Lubka: Let the Super Cycle Begin | Bitcoin for Corporations Ep. 15",
                "duration": 4252
            },
            {
                "id": "68gbrVgwxDQ",
                "title": "How capital will move between Bitcoin and Preferred Equities  #trading #bitcoin",
                "duration": 123
            },
            {
                "id": "NiBPWzNm1Jo",
                "title": "Inside Brazil's Corporate Bitcoin Boom w/ Israel Salmen & Mason Foard | BFC Ep. 18",
                "duration": 2706
            },
            {
                "id": "LnLSVgOgngc",
                "title": "Engineering the Institutional Bitcoin Economy | Bitcoin MENA 2025",
                "duration": 1293
            },
            {
                "id": "Y7FsiPuF3z4",
                "title": "SaylorSpace - Travel Through Cosmos with Michael Saylor on Bitcoin",
                "duration": 3628
            },
            {
                "id": "VGkyVoNw9v8",
                "title": "Tech Themes thru History - The Saylor Series Episode 3",
                "duration": 4592
            },
            {
                "id": "mjWzlAl5ss8",
                "title": "MSTR's Bold BTC Bet | True North Podcast | Ep. 6",
                "duration": 5756
            },
            {
                "id": "WoS5GSjOP0Y",
                "title": "True North Pulse - MSTR Q2 Earnings Explained: $11B net income & S&P 500 Hype | Jeff Walton",
                "duration": 819
            },
            {
                "id": "FTGSQdoS5Sc",
                "title": "Michael Saylor: Bitcoin Quantum Resistance & Strategy's Bitcoin Cybersecurity Program",
                "duration": 108
            },
            {
                "id": "tebx6tULPnM",
                "title": "Digital Credit Boom Is Coming",
                "duration": 456
            },
            {
                "id": "vkIq85Ha1fc",
                "title": "The First Regulated STRC ETF Is Here | Strategy World 2026",
                "duration": 487
            },
            {
                "id": "w2e3nL7xMz0",
                "title": "Why Corporations Are Putting Bitcoin on Their Balance Sheet - Pomp Podcast #595",
                "duration": 3184
            },
            {
                "id": "mpyijmce67E",
                "title": "A Time To Build | The Hurdle Rate Ep.47",
                "duration": 2954
            },
            {
                "id": "GYKslGw0P5I",
                "title": "Pensions, Private Equity & Digital Credit | The Hurdle Rate Ep. 42",
                "duration": 3744
            },
            {
                "id": "l3KxDiSgjpk",
                "title": "True North Orlando 2025 - The DNA of a Bitcoin portfolio  | Dan Hillary",
                "duration": 571
            },
            {
                "id": "ssEMtaRwra0",
                "title": "The Saylor Series | Part 3: Bitcoin as the Ultimate Asset",
                "duration": 13151
            },
            {
                "id": "y4Wtwbmszow",
                "title": "True North Now - Knots & Bitcoin: Spam, Filters, and the Fight for the Network | Featuring Mechanic",
                "duration": 3677
            },
            {
                "id": "wba5XJHKPqg",
                "title": "Saylor: Bitcoin Halving Will Drive Demand Through the Roof",
                "duration": 236
            },
            {
                "id": "cPcS7mViJGE",
                "title": "Bitwise CIO Explains Why Bitcoin Can Reach $1.3M Conservatively",
                "duration": 129
            },
            {
                "id": "ErhdjIY5ogs",
                "title": "A Structural Shift | The Hurdle Rate Podcast | Ep. 55",
                "duration": 3061
            },
            {
                "id": "b4Y88YFlGpk",
                "title": "Amplified Bitcoin and Digital Credit | The Hurdle Rate Ep. 35",
                "duration": 4808
            },
            {
                "id": "oKhVBv_A9pI",
                "title": "MSTR Q4 2025 Earnings Call: Bitcoin Is Now Backed by Politicians, Institutions & Banks",
                "duration": 391
            },
            {
                "id": "EP0XfP2HCCM",
                "title": "Regulatory Panel | Strategy World 2026",
                "duration": 1802
            },
            {
                "id": "ggd-qnM9iwI",
                "title": "Jeff challenges you to look at the bond market.",
                "duration": 69
            },
            {
                "id": "DHtXzMSBlHQ",
                "title": "Power Of Collateral | True North Podcast | Ep. 30",
                "duration": 6866
            },
            {
                "id": "_Nvh_xScNPY",
                "title": "SaylorJungle - 1 Hour Relaxing Saylor with Forest Rain Sounds",
                "duration": 3581
            },
            {
                "id": "3r_Z3U0jIA4",
                "title": "The Best Message Is Digital Credit | The Hurlde Rate Ep. 43",
                "duration": 3768
            },
            {
                "id": "aixlSH2jo_4",
                "title": "Calling The Shot | True North Podcast | Ep. 63",
                "duration": 6082
            },
            {
                "id": "3GkA2grVaNw",
                "title": "Michael Saylor Explains Why Bitcoin is Superior to Gold",
                "duration": 607
            },
            {
                "id": "tkqlubjSC9I",
                "title": "Bitcoin, AI and The New QE | The Hurdle Rate Podcast | Ep. 53",
                "duration": 3615
            },
            {
                "id": "qBPtUf50XVg",
                "title": "Saylor BEST Bitcoin Podcast: Why You NEED 0.1 Bitcoin in 2025",
                "duration": 5333
            },
            {
                "id": "XU5u5gl6EIs",
                "title": "Why Bitcoin is the Perfect Monetary System - Saylor Explains in Plain English",
                "duration": 712
            },
            {
                "id": "7wHQGnfnWAs",
                "title": "Weeks When Decades Happen | True North Podcast | Ep. 20",
                "duration": 6313
            },
            {
                "id": "C13Dicxc1wc",
                "title": "Bitcoin for Corporations Symposium | Bitcoin MENA 2025",
                "duration": 25802
            },
            {
                "id": "yz9R_EfIesM",
                "title": "BTC credit markets will be bigger than bitcoin itself #bitcoinforcorporations #bitcointreasury",
                "duration": 80
            },
            {
                "id": "VKC0__vEbc8",
                "title": "The Future of Corporate Bitcoin Adoption | MIT Bitcoin Expo 2025",
                "duration": 2437
            },
            {
                "id": "c3E91-RGjQE",
                "title": "EXCLUSIVE: Michael Saylor Masterclass On Bitcoin",
                "duration": 8740
            },
            {
                "id": "8XwV0KHo92Q",
                "title": "How much more leverage can $MSTR take on?",
                "duration": 78
            },
            {
                "id": "-7Sw3rbIxvI",
                "title": "Pure Play vs Operating Cash Flows: What's the Optimal Bitcoin Treasury Strategy? #BTC #Markets",
                "duration": 92
            },
            {
                "id": "DqHEgdThGuU",
                "title": "Issuer Perspective of Investing in Digital Credit | Strategy World 2026",
                "duration": 1871
            },
            {
                "id": "NT8KDT0Bjkk",
                "title": "How ETFs Lead to More #Bitcoin w/ Matt Hougan of Bitwise",
                "duration": 412
            },
            {
                "id": "Rty7BQyUkHM",
                "title": "NEW Michael Saylor Interview on Bitcoin (12-Minute Summary)",
                "duration": 751
            },
            {
                "id": "RMp-c6ADsVE",
                "title": "Let's Talk About Leverage | True North Podcast | Ep. 11",
                "duration": 8094
            },
            {
                "id": "_GHU3v3mqwE",
                "title": "Digital Risk w/ Jeff Walton | Strategy World 2026",
                "duration": 932
            },
            {
                "id": "iAltqb7iLf8",
                "title": "The Future Runs on Digital Credit | Strategy World 2026",
                "duration": 607
            },
            {
                "id": "CHwCZIp5Xnc",
                "title": "\"And Then They Fight You\" | True North Podcast | Ep. 46",
                "duration": 6663
            },
            {
                "id": "07MA4bVy_tM",
                "title": "Strategy ($MSTR) Balance Sheet & Digital Credit",
                "duration": 642
            },
            {
                "id": "H99AdvqhUE0",
                "title": "Michael Saylor: Why 21 Million Changes Everything",
                "duration": 764
            },
            {
                "id": "d3Ryy9CWfLc",
                "title": "Bitcoin Treasury Strategy: Does Cash Flow Still Matter?",
                "duration": 1318
            },
            {
                "id": "nXAfbiZFvjM",
                "title": "$MSTR True North - $STRF ATM - Investment Grade Analysis & Market Comp Simulation",
                "duration": 4321
            },
            {
                "id": "wWejtrifr4w",
                "title": "MSTR Built a 46 Year Bitcoin Safety Net. #mstr #bitcoin #digitalcredit",
                "duration": 61
            },
            {
                "id": "mJ4rDOQ39JQ",
                "title": "The Semler Acquisition: Strive's Bitcoin Credit POWERHOUSE w/ Matt Cole & Jeff Walton | BFC Ep. 14",
                "duration": 4026
            },
            {
                "id": "MlIyPhpRFow",
                "title": "Strategy₿ Q4 '24 Earnings Call | True North Podcast | Ep. 16",
                "duration": 7076
            },
            {
                "id": "OtOaE24IGlA",
                "title": "Tokenization: The Next Era of Corporate Finance | Strategy World 2026",
                "duration": 1782
            },
            {
                "id": "_BUT5f9tRNM",
                "title": "Is The Tide Turning? | True North Podcast | Ep. 58",
                "duration": 6265
            },
            {
                "id": "blkHhCz5_nY",
                "title": "Tucker Carlson Interview with Michael Saylor about Bitcoin",
                "duration": 449
            },
            {
                "id": "hzcmndorLwQ",
                "title": "Saylor: Bitcoin + Digital Credit = The Future of Money (Full Keynote)",
                "duration": 2225
            },
            {
                "id": "X7847QWh8nw",
                "title": "Volatility is Vitality | True North Podcast | Ep. 5",
                "duration": 7119
            },
            {
                "id": "wdJFeSY8UVk",
                "title": "Michael Saylor on Tucker Carlson Today - Full Interview",
                "duration": 4836
            },
            {
                "id": "j088KB4wDh8",
                "title": "Bitcoin Adoption Trends w/ Alex Leishman | Strategy World 2026",
                "duration": 455
            },
            {
                "id": "ZTO9GrKVNPw",
                "title": "Navigating The Storm | True North Podcast | Ep. 37",
                "duration": 7686
            },
            {
                "id": "c8trwUs7oRQ",
                "title": "\"Zero is the Wrong Number\" — Why You Can't Ignore Bitcoin Anymore w/ Hunter Albright of SALT Lending",
                "duration": 207
            },
            {
                "id": "QBLGZqYTmn8",
                "title": "MicroStrategy's Bitcoin Strategy Is INSANE - Pomp Podcast",
                "duration": 2499
            },
            {
                "id": "rcGeY0OzWdQ",
                "title": "Michael Saylor: Money is Energy - Breedlove & Lex Fridman",
                "duration": 457
            },
            {
                "id": "sp90Dh2Igr0",
                "title": "Europe's First Bitcoin Treasury Company | Strategy World 2026",
                "duration": 573
            },
            {
                "id": "BO4LnHoOcM4",
                "title": "Investment Banker Christian Lopez: Why EVERY Balance Sheet Will Hold BTC | BFC Ep. 13",
                "duration": 3674
            },
            {
                "id": "WvUE_Yvktwk",
                "title": "Bitcoin's Seven Layers of Security #2 - The Saylor Series Episode 15",
                "duration": 4498
            },
            {
                "id": "zQwaUUOzNSs",
                "title": "The Asymmetry of Bitcoin-Backed Credit | MSTR Q4 2025 Earnings Call",
                "duration": 102
            },
            {
                "id": "N3J868zhH9g",
                "title": "Bitcoin Is Encrypted Energy - Saylor & Breedlove",
                "duration": 612
            },
            {
                "id": "uUUwuxTquws",
                "title": "Michael Saylor Bought $7 Billion In Bitcoin - Pomp Podcast",
                "duration": 447
            },
            {
                "id": "uILb-qRPLGo",
                "title": "True North Exchange - Recapitalizing the world on Bitcoin | with @amitisinvesting",
                "duration": 5172
            },
            {
                "id": "o3WT9wz0oOk",
                "title": "What's Actually Happening with Strategy ($MSTR) Stock Price w/ Adam Livingston",
                "duration": 8022
            },
            {
                "id": "ffjHKvulDns",
                "title": "Michael Saylor Addresses Bitcoin Treasury Skeptics",
                "duration": 929
            },
            {
                "id": "zBTJkiHE4vs",
                "title": "The Great Equalizer: Why AI is the Ultimate Tool for Global Empowerment w/ Mason Foard of Meliuz",
                "duration": 491
            },
            {
                "id": "S_-1q3zdUYo",
                "title": "An Increasingly Digital World | The Hurdle Rate Podcast Ep.52",
                "duration": 3236
            },
            {
                "id": "YMxuzzYqPi8",
                "title": "Volatility's Return & Bitcoin Treasuries | True North Podcast | Ep. 19",
                "duration": 6229
            },
            {
                "id": "3AzYUGjSf-w",
                "title": "Bitcoin is disrupting the $300+ Trillion Credit Market.  #mstr #bitcoin #investing #investing",
                "duration": 61
            },
            {
                "id": "y2mugodJ6gc",
                "title": "What is Credit w/ special guest Adam Livingston | True North Podcast | Ep. 41",
                "duration": 8129
            },
            {
                "id": "awA2vnfEB2Y",
                "title": "Michael Saylor Explains High Powered Digital Money",
                "duration": 136
            },
            {
                "id": "ckj0w5p1bLA",
                "title": "Bitcoin in Wealth Management Portfolios | Strategy World 2026",
                "duration": 1106
            },
            {
                "id": "IdFlPrpi5cc",
                "title": "Build The Structure | The Hurdle Rate Ep.46",
                "duration": 2971
            },
            {
                "id": "coHC_9ApBdg",
                "title": "Michael Saylor: The Bitcoin Standard for Corporations",
                "duration": 7002
            },
            {
                "id": "sS7hLOJlyRQ",
                "title": "The Incentives Are Aligned | The Hurdle Rate Ep. 38",
                "duration": 3500
            },
            {
                "id": "4ClRqE1Dbqs",
                "title": "Bullish Digital Credit | The Hurdle Rate Ep.48",
                "duration": 3251
            },
            {
                "id": "RGI4N223lSU",
                "title": "Why Bitcoin Sovereignty Beats ETF Convenience w/ Trey Sellers of Unchained | BFC Show Ep 31",
                "duration": 3813
            },
            {
                "id": "WOpTi_qJUiw",
                "title": "Bitcoin's Transaction Volume Exceeded American Express - Saylor",
                "duration": 371
            },
            {
                "id": "_WZ_I_xWTXk",
                "title": "Noise in the Market | The Hurdle Rate Ep. 23",
                "duration": 3416
            },
            {
                "id": "XdgP25UcHB0",
                "title": "Bitcoin for Corporations - Saylor & Dorsey",
                "duration": 15110
            },
            {
                "id": "_27ZZJXv4gw",
                "title": "Michael Saylor & Bill Miller - Bitcoin 2023 Conference Miami",
                "duration": 1732
            },
            {
                "id": "oHnoxfjAPqo",
                "title": "Michael Saylor Bitcoin for Corporations 2025 Keynote Speech",
                "duration": 3909
            },
            {
                "id": "2NwaMg0VyC8",
                "title": "Bitcoin, Bonds and Breakthroughs | True North Podcast | Ep. 7",
                "duration": 8257
            },
            {
                "id": "r1_8RumNLLI",
                "title": "Protect Index Integrity: A Response to MSCI's Digital Asset Proposal",
                "duration": 323
            },
            {
                "id": "JAgkx45l9no",
                "title": "Digital Assets at TD Bank | Strategy World 2026",
                "duration": 1765
            },
            {
                "id": "mEHJYJg5mew",
                "title": "Bitcoin’s 13% Yield: The Digital Credit Revolution w/ Strive's Matt Cole, Ben Werkman, & Jeff Walton",
                "duration": 518
            },
            {
                "id": "C4i3OjkrBTc",
                "title": "The Starting Line | The Hurdle Rate Ep. 27",
                "duration": 3183
            },
            {
                "id": "24c_s3QQsWc",
                "title": "Bitcoin for Corporations Adoption Update w/ George Mekhail | Strategy World 2026",
                "duration": 782
            },
            {
                "id": "JjAtLGXKUrs",
                "title": "Inside the Digital Credit Revolution | The Hurdle Rate Ep. 36",
                "duration": 3280
            },
            {
                "id": "Q9zn96gOy0U",
                "title": "Jeff asks a trick question. #mstr #bitcoin #realestate #strc",
                "duration": 61
            },
            {
                "id": "FsGONQow-nE",
                "title": "The Strategic Case for Bitcoin Treasuries in Europe w/ Alexandre Laizet, Jesse Myers, Tyler Evans",
                "duration": 1350
            },
            {
                "id": "v4jHjIfMT8k",
                "title": "Defeating the Single Point of Failure w/ Mike Belshe of BitGo | BFC Show Ep. 33",
                "duration": 3079
            },
            {
                "id": "t8QSR0y9rls",
                "title": "Strategy ($MSTR) vs. Bitcoin Supply: The Convergence",
                "duration": 197
            },
            {
                "id": "YtQhBfLNeGY",
                "title": "Inject The Bitcoin Volatility Virus | True North Podcast | Ep. 33",
                "duration": 7818
            },
            {
                "id": "rhT9B1ZUkUY",
                "title": "Strategy ($MSTR) Will Get To 1,000,000 BTC",
                "duration": 324
            },
            {
                "id": "BYCfwMrS-VM",
                "title": "Strategy (MSTR) Q4 2025 Earnings Call w/ Analyst Q&A",
                "duration": 7307
            },
            {
                "id": "xzHc5x9muT0",
                "title": "Post Election Discussion | True North Podcast | Ep. 3",
                "duration": 5578
            },
            {
                "id": "2u9jJPzd5Wo",
                "title": "$MSTR’s $1.44B USD Reserve Just Proved The Business Model",
                "duration": 456
            },
            {
                "id": "tqL6RdHaH_Q",
                "title": "LIVE: Bitcoin for Corporations - Day 2 | Strategy World 2026",
                "duration": 31411
            },
            {
                "id": "slOVowPqhAc",
                "title": "New Market Structures using STRC & Bitcoin-Linked Products | Strategy World 2026",
                "duration": 1842
            },
            {
                "id": "dGm8YA96oOs",
                "title": "Mathematically Comparing Hypothetical Risk Profiles |$STRC vs $SATA",
                "duration": 355
            },
            {
                "id": "4az78ODE3Zc",
                "title": "Digital Credit Clarity | The Hurdle Rate Ep. 44",
                "duration": 3443
            },
            {
                "id": "J1STZqH_FRY",
                "title": "Weathering The Storm | True North Podcast | Ep. 55",
                "duration": 4804
            },
            {
                "id": "CAkVu_Dou4E",
                "title": "BTC-Backed Financing For Corporations w/Jeff Walton, Hunter Albright, Wyatt O'Rourke & Russ Jacobsen",
                "duration": 1462
            },
            {
                "id": "FVuKRYuhv8w",
                "title": "Michael Saylor: The Bitcoin Treasury Endgame - An Exclusive At-Home Interview",
                "duration": 5381
            },
            {
                "id": "fNizwumVk4I",
                "title": "Banks Perspective of Investing in Digital Credit | Strategy World 2026",
                "duration": 809
            },
            {
                "id": "Da6T6Jati18",
                "title": "Strategy ($MSTR) Explained In 12 Minutes",
                "duration": 712
            },
            {
                "id": "vMw0KuAIGTM",
                "title": "Chapter 2 \"Full Sail Ahead\" | True North Podcast | Ep. 39",
                "duration": 7814
            },
            {
                "id": "c2USwEB-D48",
                "title": "This German Company is Future Proofing Its Balance Sheet With Bitcoin",
                "duration": 265
            },
            {
                "id": "YsrHaQ_DOcY",
                "title": "Rate Cuts, AI Bubbles, and Why Bitcoin Wins Either Way",
                "duration": 371
            },
            {
                "id": "D6lqLqPYgTI",
                "title": "True North Now - Another inside look at The SmarterWeb Company | Featuring CEO Andrew Webley",
                "duration": 2159
            },
            {
                "id": "gcV_7uil_0A",
                "title": "Analyst Q&A: MSTR Q4 2025 Earnings Call",
                "duration": 2802
            },
            {
                "id": "peiCCZdOXuI",
                "title": "The Reflexive Demand Shock Is Not Priced In w/ Alexandre Laizet | Bitcoin for Corporations Ep. 16",
                "duration": 4069
            },
            {
                "id": "9gWXcmkUaD4",
                "title": "Did Bitcoin Just Gain A Powerful Ally?💥 #MSCI",
                "duration": 69
            },
            {
                "id": "zoZiw1cSOBY",
                "title": "The Trade Idea Nobody Is Talking About ($STRC)",
                "duration": 521
            },
            {
                "id": "TYZyaebvheQ",
                "title": "The Roadmap for BTC Treasury Adoption in Untapped Markets | Bitcoin MENA 2025",
                "duration": 1302
            },
            {
                "id": "D1jpLbw3qQ8",
                "title": "The Management of The Treasury | The Hurdle Rate Podcast | Ep. 54",
                "duration": 3132
            },
            {
                "id": "hqoagNBtIps",
                "title": "Michael Saylor: Bitcoin Prophecy - BTC Prague 2025",
                "duration": 2854
            },
            {
                "id": "Is99RsbExvE",
                "title": "Margin Isn't Calling! | True North Podcast | Ep. 54",
                "duration": 6782
            },
            {
                "id": "GSko_cbikfk",
                "title": "$MSTR True North - $STRK and $STRF 101 - Jeff Walton & Dan Hillery analysis",
                "duration": 2978
            },
            {
                "id": "BJgIbOkyBn8",
                "title": "Fed Signals and Equity Stakes | The Hurdle Rate Ep. 24",
                "duration": 3569
            },
            {
                "id": "IZhS7z91xXc",
                "title": "Bitcoin Treasury Fundraising in Bear VS Bull Markets w/ Brandon Green & Robert Harrison",
                "duration": 966
            },
            {
                "id": "6vvp_3uftyE",
                "title": "Methods for Generating Bitcoin Income | Strategy World 2026",
                "duration": 1131
            },
            {
                "id": "d9OQ0UYSwLI",
                "title": "Are Bitcoin Treasury Companies the Buyers of Last Resort? #bitcoinforcorporations #bitcoinstrategy",
                "duration": 115
            },
            {
                "id": "bjvMt0xaSUQ",
                "title": "The Saylor Series | Part 4: The Future of Bitcoin & Civilization",
                "duration": 831
            },
            {
                "id": "Um_qzLz_YIw",
                "title": "Michael Saylor: Bitcoin Is Digital Capital—Here’s Why It Matters",
                "duration": 174
            },
            {
                "id": "5UssVPlRllQ",
                "title": "Bitcoin Treasury Operations Roadmap | Strategy World 2026",
                "duration": 1212
            },
            {
                "id": "RsoUxYJBKbU",
                "title": "True North Orlando 2025 - Where are we going? | Jeff Walton",
                "duration": 908
            },
            {
                "id": "8Mhu6dxj7qk",
                "title": "WE HAVE LASER EYES - Michael Saylor at BTCPrague 2023",
                "duration": 1990
            },
            {
                "id": "s_0ggp41rT4",
                "title": "Bitcoin Common Misconceptions - Saylor & Robert Breedlove",
                "duration": 8152
            },
            {
                "id": "3-vBBYEXv6M",
                "title": "Saylor: Bitcoin as Apex Capital Strategy in the AI Age",
                "duration": 3909
            },
            {
                "id": "A7X5NXHVx1I",
                "title": "How Family Offices & Institutions Are Positioning for Bitcoin | Bitcoin MENA 2025",
                "duration": 1623
            },
            {
                "id": "ChWZHwMkuwk",
                "title": "Why AI Deflation Will Push Capital Into Bitcoin w/ Mason Foard of Méliuz | BFC Show Ep. 30",
                "duration": 1525
            },
            {
                "id": "kFP_1ulQ4uI",
                "title": "SaylorRain - Relaxing Saylor Speaks on Bitcoin with Rain Sounds (1H)",
                "duration": 3600
            },
            {
                "id": "JzsrwmPzttw",
                "title": "Fishing For The Fixed Income | True North Podcast | Ep. 29",
                "duration": 7440
            },
            {
                "id": "cd67ujAiuHA",
                "title": "Banking Bitcoin: Integrating BTC into Traditional Finance | Strategy World 2026",
                "duration": 635
            },
            {
                "id": "_N7fZFcPjcc",
                "title": "\"2026 the year of digital credit\" | True North Podcast | Ep. 44",
                "duration": 4614
            },
            {
                "id": "T9sRVEIOQL8",
                "title": "Putting Your Assets to Work | BFC Symposium, Amsterdam 2025",
                "duration": 1297
            },
            {
                "id": "NWgDhtCXNWA",
                "title": "Analyst Q&A: MSTR Q3 2025 Earnings Call",
                "duration": 2179
            },
            {
                "id": "D_yIKnHOuWg",
                "title": "Michael Saylor Answers the Question of Our Time",
                "duration": 327
            },
            {
                "id": "XbEOeRylUCw",
                "title": "Michael Saylor: Bitcoin, FTX, Bear Market",
                "duration": 7364
            },
            {
                "id": "0majxELKVEo",
                "title": "Thanksgiving Week | True North Podcast | Ep. 8",
                "duration": 4231
            },
            {
                "id": "v4na2pycrcc",
                "title": "The Future is Bitcoin with Michael Saylor - Moonshots & Mindsets",
                "duration": 5392
            },
            {
                "id": "99liY3HDiG0",
                "title": "On/Off/On/Off/On/Off | True North Podcast | Ep. 23",
                "duration": 7024
            },
            {
                "id": "9xhks3PPI3w",
                "title": "Beneath The Surface, A System In Motion | True North Podcast | Ep. 60",
                "duration": 6879
            },
            {
                "id": "YnlFl8weBE0",
                "title": "Bitcoin Is Entering the Capital Markets Era | Strategy World 2026",
                "duration": 704
            },
            {
                "id": "CdBOuVaqYvY",
                "title": "Digital Capital Theory & Analysis w/ Allard Peng | BFC Show Ep. #22",
                "duration": 3959
            },
            {
                "id": "VwTzTuc4qDk",
                "title": "LIVE: Bitcoin for Corporations - Day 1 | Strategy World 2026",
                "duration": 18242
            },
            {
                "id": "G9SRFBXIOeE",
                "title": "Strive Chiefs play Bitcoin Trivia! #bitcoin #bitcointreasury #bitcoinconference",
                "duration": 79
            },
            {
                "id": "MSMJBmo_q4s",
                "title": "Saylor: Bitcoin as Treasury Reserve Asset",
                "duration": 240
            },
            {
                "id": "SojzZxhMf00",
                "title": "The Virtues of Strong Money - The Saylor Series Episode 7",
                "duration": 5493
            },
            {
                "id": "4kWvkws8qD4",
                "title": "$MSTR will be the biggest company in the world. #trading #investing #bitcoin",
                "duration": 78
            },
            {
                "id": "LgLUHYESVsI",
                "title": "The Trillion Dollar Idea ($STRC)",
                "duration": 456
            },
            {
                "id": "VeFTC_DzqS8",
                "title": "Michael Saylor & Simon Gerovich Fireside Chat | Bitcoin MENA 2025",
                "duration": 1754
            },
            {
                "id": "CUilC81qgQ8",
                "title": "Preferred Equity Demand | The Hurdle Rate Ep.45",
                "duration": 3910
            },
            {
                "id": "hzyJ0tK9f2k",
                "title": "MicroStrategy is Getting Stronger... Here's How We Know",
                "duration": 380
            },
            {
                "id": "8xVmeckJeXo",
                "title": "Michael Saylor: Why Corporate Bitcoin Treasuries Empower Individual Holders",
                "duration": 100
            },
            {
                "id": "6d9bPPI77zg",
                "title": "\"MSTR Uptober\" | True North Podcast | Ep. 40",
                "duration": 7821
            },
            {
                "id": "fCkABdwjxtE",
                "title": "Michael Saylor at Bitcoin Atlantis 2024",
                "duration": 3069
            },
            {
                "id": "EIH2k857E1Y",
                "title": "STRC'ing The Limits | True North Podcast | Ep. 34",
                "duration": 7665
            },
            {
                "id": "Hfdq-Wl1fRQ",
                "title": "Michael Saylor Explains Why Going All In on Bitcoin Could Be Genius",
                "duration": 820
            },
            {
                "id": "Mz1LhRXwY1Q",
                "title": "\"Wall Street Has Woken Up” w/ Matt Hougan of Bitwise | BFC Show Ep. 34",
                "duration": 2968
            },
            {
                "id": "_T6Wu5d3IY0",
                "title": "$MSTR True North - In the Mind of Richard Byworth with Jeff Walton",
                "duration": 4164
            },
            {
                "id": "ODPZpZfSUEM",
                "title": "Derivatives Strategies | Strategy World 2026",
                "duration": 755
            },
            {
                "id": "Qv9meQd7S_M",
                "title": "The Importance of Index Inclusion for Digital Asset Treasury Companies | Strategy World 2026",
                "duration": 1003
            },
            {
                "id": "6WVXmSz2RWw",
                "title": "How Bitcoin Will Succeed.",
                "duration": 62
            },
            {
                "id": "gRnspOucXNg",
                "title": "Michael Saylor - Bitcoin Zen",
                "duration": 57
            },
            {
                "id": "rkaXG5abVYY",
                "title": "Commodity, Security, Token | The Hurdle Rate Ep. 22",
                "duration": 3124
            },
            {
                "id": "Z-38QA3hqRs",
                "title": "BTC v MSCI: The Fight to Keep Bitcoin Companies in Global Indexes w/ George Mekhail | BFC Show Ep 21",
                "duration": 3830
            },
            {
                "id": "E2fZBPb0Q9A",
                "title": "\"I want MSTR to stand for MONSTER\"",
                "duration": 85
            },
            {
                "id": "eDZu7ay1etQ",
                "title": "Bitcoin is Powered by Chaos #mstr #trading #bitcoin",
                "duration": 80
            },
            {
                "id": "iue1CHo_F-o",
                "title": "Will Travel For Bitcoin | The Hurdle Rate Ep. 25",
                "duration": 2647
            },
            {
                "id": "aIiZGnvyMQY",
                "title": "The Bitcoin Orchestra | True North Podcast | Ep. 24",
                "duration": 7209
            },
            {
                "id": "U2Q1A75EAk8",
                "title": "The Brutal Truth About Bitcoin #trading #mstr #strc #bitcoin",
                "duration": 65
            },
            {
                "id": "OmrKYS2qcXw",
                "title": "The Capital Fortress | True North Podcast | Ep. 47",
                "duration": 5291
            },
            {
                "id": "_iQni1dCqDY",
                "title": "Bitcoin Trading Like a Currency — And Institutions Know It",
                "duration": 88
            },
            {
                "id": "p3vNo6JcC7s",
                "title": "Bear is for Building | True North Podcast | Ep. 49",
                "duration": 7003
            },
            {
                "id": "zCvYKTLGGRc",
                "title": "Bitcoin Treasuries & The New Credit Paradigm w/ Jeff Walton of Strive",
                "duration": 1134
            },
            {
                "id": "UQjmBvmyfqA",
                "title": "Listening to Michael Saylor ALL Day - Transcendental Bitcoin Meditation",
                "duration": 43
            },
            {
                "id": "fZfg1Gtcg08",
                "title": "100% Saylor - Michael Saylor Best Moments",
                "duration": 210
            },
            {
                "id": "JoTOaJWnZGQ",
                "title": "MSTR & BTC Highs | True North Podcast | Ep. 4",
                "duration": 6526
            },
            {
                "id": "9v3h7fPefHE",
                "title": "Land will be very valuable in the future #realestate #bitcoin #mstr #ai",
                "duration": 65
            },
            {
                "id": "6osK1CXno80",
                "title": "Michael Saylor GETS ANGRY Talking About Bitcoin",
                "duration": 2177
            },
            {
                "id": "L1odkMa4PCE",
                "title": "Signals From True North Live | True North Podcast | Ep. 57",
                "duration": 7029
            },
            {
                "id": "LL2040c-DKU",
                "title": "Equity Analysts Roundtable | Strategy World 2026",
                "duration": 1913
            },
            {
                "id": "NTaBNGpfWaE",
                "title": "Digital Credit is for Corporations | The Hurdle Rate Ep.49",
                "duration": 4190
            },
            {
                "id": "takcCQySsPw",
                "title": "Bitcoin is Global | Strategy World 2026",
                "duration": 811
            },
            {
                "id": "aJPByFnBcNg",
                "title": "BTC Opportunity Cost EVERYWHERE | True North Podcast | Ep. 27",
                "duration": 7598
            },
            {
                "id": "ykvjtK30HiA",
                "title": "Michael Saylor & The Ultimate Bitcoin Strategy",
                "duration": 5766
            },
            {
                "id": "1PkMFIa7rmQ",
                "title": "21 Rules of Bitcoin - Saylor Prague 2024",
                "duration": 2415
            },
            {
                "id": "UADTd7gCuXo",
                "title": "THERE IS NO SECOND BEST - Saylor at BTCPrague 2023",
                "duration": 2442
            },
            {
                "id": "CfgEBrerp2o",
                "title": "Digital. Capital. Designed. | Strategy World 2026",
                "duration": 796
            },
            {
                "id": "50VwsS0401Q",
                "title": "True North Orlando 2025 - MSTR True North Live | Panel",
                "duration": 2813
            },
            {
                "id": "CYT0AxQxa7o",
                "title": "Why Bitcoin Succeeds - The Saylor Series Episode 12",
                "duration": 6045
            },
            {
                "id": "DpxMhcxi4wI",
                "title": "The Nakamoto Flywheel Strategy for Scaling a Bitcoin Treasury with BTC Inc | BFC Show Ep. 28",
                "duration": 3157
            },
            {
                "id": "SyANPFkOpME",
                "title": "Did we reach ATH during a bear market? #bitcoin",
                "duration": 72
            },
            {
                "id": "dVfmTMo_mO0",
                "title": "Celebrating Bitcoin Price with Relaxing Michael Saylor Speaking (10H)",
                "duration": 36762
            },
            {
                "id": "ZcjFrIMw2sI",
                "title": "Michael Saylor Keynote - The 2022 Atlas Society Gala",
                "duration": 1253
            },
            {
                "id": "n7YE7wskfyw",
                "title": "The Most Hated Rally in Finance | True North Podcast | Ep. 10",
                "duration": 8074
            },
            {
                "id": "J38-PQ6X8HI",
                "title": "Michael Saylor: Satoshi Opened A Portal Into Cyberspace",
                "duration": 8203
            },
            {
                "id": "uODBZGzKdzE",
                "title": "Why Metaplanet’s Bitcoin Strategy Has Dylan LeClair Bullish",
                "duration": 62
            },
            {
                "id": "ig9pu0XRtNM",
                "title": "Bitcoin as Power to the People - Saylor & Robert Breedlove",
                "duration": 4664
            },
            {
                "id": "PxnlhBP-wRs",
                "title": "Jeff Walton Explains Digital Risk | Strategy World 2026",
                "duration": 940
            },
            {
                "id": "GocJIgAY-WI",
                "title": "Interactive Q&A with Michael Saylor & Phong Le | Strategy World 2026",
                "duration": 3267
            },
            {
                "id": "uEPERVZWNoQ",
                "title": "Set Up For A Supercycle | The Hurdle Rate Ep. 40",
                "duration": 2790
            },
            {
                "id": "UkFp45QBL2Y",
                "title": "Bitcoin as a Technological Invention, Not Just an Asset",
                "duration": 69
            },
            {
                "id": "kxBdefymFiw",
                "title": "Bitcoin Treasuries: The Next Corporate Playbook w/ Adam Back, Siddarth Bharwani & Gurpreet Oberoi",
                "duration": 1318
            },
            {
                "id": "lIODLyOWqpE",
                "title": "Bitcoin: There Is No Second Best | Michael Saylor at Bitcoin for Corporations",
                "duration": 3807
            },
            {
                "id": "Y5_AtkCpfhI",
                "title": "\"Bitcoin  Did This\" | True North Podcast | Ep. 51",
                "duration": 7264
            },
            {
                "id": "HHyCHEH1FGw",
                "title": "BTC vs Gold: The Capital Base Layer Bull Thesis, Disrupting Credit Markets w/ Khing Oei | BFC Ep. 17",
                "duration": 4114
            },
            {
                "id": "k0adfjcSDHs",
                "title": "MicroStrategy: The Case for Bitcoin on Corporate Balance Sheets | Bitcoin for Corporations",
                "duration": 3052
            },
            {
                "id": "Gy0ySjTc8p4",
                "title": "LIVE: Strategy (MSTR) Q3 2025 Earnings Call",
                "duration": 6755
            },
            {
                "id": "_ZRc6plqG0s",
                "title": "A Digital Dollar Backed by Bitcoin With 30% Yield | Strategy World 2026",
                "duration": 751
            },
            {
                "id": "xXI2OFzQinI",
                "title": "True North Orlando 2025 - Volatility, Options and Full Gamma | Grain of Salt",
                "duration": 2211
            },
            {
                "id": "hV_sgkHhApo",
                "title": "SaylorNight - Relaxing Saylor Speaks on Bitcoin in the Night (1H)",
                "duration": 3684
            },
            {
                "id": "7aJTOCN501g",
                "title": "Saylor Reveals the TOP Bitcoin Secrets - Digital Asset Summit 2025",
                "duration": 2050
            },
            {
                "id": "9qfWBr9Ggzg",
                "title": "Why Digital Credit?",
                "duration": 269
            },
            {
                "id": "G0l1X9XvDe4",
                "title": "\"The iPhone Moment\" | True North Podcast | Ep. 35",
                "duration": 7051
            },
            {
                "id": "RbkLz9C39y0",
                "title": "Bitcoin's Seven Layers of Security - The Saylor Series Episode 14",
                "duration": 4721
            },
            {
                "id": "ItvfKfYUd0c",
                "title": "BTC Prague 2025 - Michael Saylor FULL KEYNOTE",
                "duration": 2855
            },
            {
                "id": "yxEq_g5BIjg",
                "title": "\"High Powered Digital Money\" | True North Podcast | Ep. 48",
                "duration": 3932
            },
            {
                "id": "49ADpogjahE",
                "title": "STRC x SATA - BTC Risk & BTC Credit",
                "duration": 1390
            },
            {
                "id": "G_VIAI9uXQk",
                "title": "True North Orlando - The people behinds the scenes | TheBitcoinGal, Trollstein and J64",
                "duration": 638
            },
            {
                "id": "f5mfgko8ELc",
                "title": "The German Bitcoin Advantage: aifinyo CEO Garry Krugljakow | BFC Ep. 20",
                "duration": 3129
            },
            {
                "id": "7hyoONj4nEY",
                "title": "What One Billionaire Knows About Outlasting a Dollar Collapse - Jordan Peterson EP 554",
                "duration": 5245
            },
            {
                "id": "8893dpSiNiE",
                "title": "How to Value Bitcoin Treasury Companies w/ Andrew Webley, Matt Cole & Gurpreet Oberoi",
                "duration": 1280
            },
            {
                "id": "gbr95uDuF94",
                "title": "Bitcoin’s \"iPhone Moment\" is Here w/ Strive Chief Officers | BFC Show Ep. 32",
                "duration": 2686
            },
            {
                "id": "9OHeub2XLwU",
                "title": "Strategy ($MSTR) Balance Sheet UPDATE",
                "duration": 339
            },
            {
                "id": "VVk1LohR-KE",
                "title": "$MSTR True North - Strategy World 2025 - Digital Transformation of Investor Relations",
                "duration": 4675
            },
            {
                "id": "uFTqXnEym04",
                "title": "How MicroStrategy is Changing Credit Markets Forever",
                "duration": 522
            },
            {
                "id": "3FrBqdCxZb4",
                "title": "Media Roundtable | BFC Symposium, Amsterdam 2025",
                "duration": 2878
            },
            {
                "id": "1Ms7ql_S63A",
                "title": "The Saylor Series | Part 2: Bitcoin as Digital Gold & Property Rights",
                "duration": 6446
            },
            {
                "id": "fTMZxghP45c",
                "title": "True North Orlando 2025 - Make Bitcoin Work for You | Solei",
                "duration": 358
            },
            {
                "id": "CA_XnoCk4sY",
                "title": "Michael Saylor Has DOUBLED His Bitcoin Investment!",
                "duration": 305
            },
            {
                "id": "m4vV3XtWYMw",
                "title": "Convertibles on Deck | True North Podcast | Ep. 18",
                "duration": 6370
            },
            {
                "id": "B4P_0LN60Rs",
                "title": "Is This the New Bitcoin Meta? Inside the Nakamoto Vision w/ Tyler Evans of Nakamoto",
                "duration": 240
            },
            {
                "id": "gSc6BC1Kh2g",
                "title": "Digital Gold: Harder, Smarter, Stronger, Faster - The Saylor Series Episode 6",
                "duration": 5028
            },
            {
                "id": "ao2RJhVpIW4",
                "title": "Meet Them Where They're At | The Hurdle Rate Ep. 37",
                "duration": 3200
            },
            {
                "id": "1Mr9PknsM_Y",
                "title": "Michael Saylor's Best Explanation of Bitcoin",
                "duration": 349
            },
            {
                "id": "_pVKQYdnsMc",
                "title": "Michael Saylor Explains the Digital Credit Revolution",
                "duration": 811
            },
            {
                "id": "TWSl9mdoYds",
                "title": "Expert Analyzes the Impact of a Bitcoin ETF - Michael Saylor",
                "duration": 402
            },
            {
                "id": "BHBfDF9Of1Y",
                "title": "Financial Engineering 101 | True North Podcast | Ep. 15",
                "duration": 7620
            },
            {
                "id": "5oI5hDDYYgk",
                "title": "New Year, Same Business | True North Podcast | Ep. 12",
                "duration": 8762
            },
            {
                "id": "tkFnDInGouA",
                "title": "Wealth and Treasury Management in the Bitcoin and AI Era | Strategy World 2026",
                "duration": 726
            },
            {
                "id": "J2GAFWLNOhQ",
                "title": "Strategy's Preferred Stock $STRC | Why Is It Valuable?",
                "duration": 375
            },
            {
                "id": "JeIHtWg7YJQ",
                "title": "$STRDing Toward BTC Fixed Income | True North Podcast | Ep. 28",
                "duration": 7643
            },
            {
                "id": "LBKld0QdXnk",
                "title": "Bitcoin Is Being Adopted By A Country As Sovereign Money - Pomp Podcast #585",
                "duration": 3647
            },
            {
                "id": "5GTVLqVi_Qw",
                "title": "Capital Gravity Converging & Teeth Scarcity | True North Podcast | Ep. 26",
                "duration": 8386
            },
            {
                "id": "W9NlSAmpDFI",
                "title": "The Dynamics of Scarcity & the Digital Gold Rush w/Dylan LeClair, Tracy Hoyos-Lopez & George Mekhail",
                "duration": 1263
            },
            {
                "id": "nC37CqWpxfI",
                "title": "Saylor & Dorsey Interview",
                "duration": 3400
            },
            {
                "id": "547yEgp4-TM",
                "title": "Q3 Earnings in Review | True North Podcast | Ep. 2",
                "duration": 9420
            },
            {
                "id": "LFlA0YKXbrc",
                "title": "Africans Get Bitcoin Faster Than Fortune 500 CEOs",
                "duration": 118
            },
            {
                "id": "D446irWy6kA",
                "title": "How Bitcoin changed his life. #mstr #bitcoin #trading",
                "duration": 83
            },
            {
                "id": "DAXC9km8Wlk",
                "title": "Bitcoin: Zero Percent Inflation - Saylor & Robert Breedlove",
                "duration": 8063
            },
            {
                "id": "sVUzpZkz6t0",
                "title": "The Societal Ripple Effects Of Corporate Bitcoin Adoption w/ Stafford Masie and Tracy Hoyos-Lopez",
                "duration": 1584
            },
            {
                "id": "XJjH_fJ7kEI",
                "title": "Treasury CEO: will the 4 year bitcoin cycle continue?  #bitcoinforcorporations #bitcointreasury",
                "duration": 72
            },
            {
                "id": "gHpnTOoGv7Q",
                "title": "Saylor: Why Bitcoin Will Birth a New Generation of Trillion-Dollar Companies",
                "duration": 900
            },
            {
                "id": "0LPXxbg5r38",
                "title": "No Days Off | True North Podcast | Ep. 38",
                "duration": 3029
            },
            {
                "id": "0yFvw8XMQuM",
                "title": "ANALYSIS: MSTR Q3 Earnings Call | The \"BTC Refinery\" Model",
                "duration": 3456
            },
            {
                "id": "wSwQxTq147Q",
                "title": "Chill SaylorVibes - The Margin Call (Bitcoin Lo-fi)",
                "duration": 2966
            },
            {
                "id": "swoZxZyqpT8",
                "title": "Michael Saylor On How Bitcoin Can Change Everything",
                "duration": 544
            },
            {
                "id": "xr52rDogbAQ",
                "title": "\"Satoshi is the poet, Jeff Booth is the prophet, and Saylor is the prince.\"",
                "duration": 142
            },
            {
                "id": "GrYXPqnyHdc",
                "title": "“This Is the Product.” — Why Bitcoin Treasury Companies Actually Work",
                "duration": 220
            },
            {
                "id": "DLgUQ1HGUXE",
                "title": "Bitcoin Capital Markets: Evolving Instruments for Institutions",
                "duration": 1577
            },
            {
                "id": "q9Yo9woraoE",
                "title": "Bitcoin Long Term Capital Market Assumptions w/Matt Hougan (Bitwise CIO)",
                "duration": 1461
            },
            {
                "id": "tO2bjYx_LBg",
                "title": "The BIGGEST Story in Finance - Why STRC will change the world!",
                "duration": 509
            },
            {
                "id": "hVFmgzUuioQ",
                "title": "Will Michael Saylor's Strategy Become the Worlds MOST VALUABLE COMPANY?",
                "duration": 891
            },
            {
                "id": "nr9tQmTeA20",
                "title": "Bitcoin Treasury Companies Eating the Bond Market",
                "duration": 329
            }]
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
                "title": "Take The Bitcoin Orange Pill - How To Guide",
                "duration": 597
            },
            {
                "id": "Sxv6wpU1380",
                "title": "Is This Bitcoin Final Cycle? - Luke Mikic",
                "duration": 385
            },
            {
                "id": "bw5Gepxo2Ps",
                "title": "Bitcoin Network Effects Model - 10x Users = 100x Price",
                "duration": 1108
            },
            {
                "id": "nlvx2-3LUhM",
                "title": "Bitcoin Power Law Explained | SLP624",
                "duration": 6396
            },
            {
                "id": "yhcbMUh3YTo",
                "title": "The Generational Bitcoin Price Run Begins",
                "duration": 749
            },
            {
                "id": "_rMwlS1aHFs",
                "title": "The Physics of Bitcoins 10M Future",
                "duration": 4295
            },
            {
                "id": "KR8EZo5IesE",
                "title": "Tom Lee: Bitcoin to  Million Path",
                "duration": 495
            },
            {
                "id": "vjwFusEnfiE",
                "title": "The Power Law Lens on Bitcoin - Santostasi",
                "duration": 864
            },
            {
                "id": "iww09Eeql_o",
                "title": "PlanB: Stock-to-Flow Model & Future Price Predictions",
                "duration": 602
            },
            {
                "id": "lyTHPcHDOk8",
                "title": "Rational Root: Bitcoin Will Hit $600k then $6 Million",
                "duration": 1268
            },
            {
                "id": "6WdwTR_S2Ig",
                "title": "Bitcoin Stock-To-Flow Model",
                "duration": 763
            },
            {
                "id": "BpKfLfGbf0Q",
                "title": "Bitcoin Hyperbitcoinization: $1.5M by 2028?",
                "duration": 1562
            },
            {
                "id": "wjObfPHlPOk",
                "title": "Understanding S2F Live Charts",
                "duration": 305
            },
            {
                "id": "C9KPRcmFJWI",
                "title": "Bitcoin to $180K - Pomp Investments Prediction",
                "duration": 2361
            },
            {
                "id": "GzZecXEUJTI",
                "title": "Realistically Reaching  Million",
                "duration": 840
            },
            {
                "id": "W3SKpO0q9QI",
                "title": "Roadmap To Crypto's $10 Trillion Market Cap - Ben Cowen",
                "duration": 4421
            },
            {
                "id": "hzeAkfnuBKo",
                "title": "PlanB: Bitcoin Will Hit $135k by Christmas! Stock-to-Flow Proof",
                "duration": 664
            },
            {
                "id": "LU5RqsGwvBg",
                "title": "Bitcoins Path to M: Schwab",
                "duration": 401
            },
            {
                "id": "jzY_SxnTLNA",
                "title": "Bitcoin Is the Economic Singularity - Luke Mikic",
                "duration": 1168
            },
            {
                "id": "IWUEPFAHksc",
                "title": "Bitcoin Bull Market Support Band - Benjamin Cowen",
                "duration": 466
            },
            {
                "id": "qX2fbQgxJig",
                "title": "Why Bitcoin Could Reach $64M - Luke Mikic",
                "duration": 2893
            },
            {
                "id": "LkmVUMRh9vo",
                "title": "Bitcoin: Where In The Cycle Are We? - Benjamin Cowen",
                "duration": 547
            },
            {
                "id": "3DijExIkark",
                "title": "Bitcoin On-Chain Analysis: MVRV Z-Score Explained",
                "duration": 452
            },
            {
                "id": "tPQs6eQ4zIU",
                "title": "Stock to Flow - Prediciting Price?",
                "duration": 578
            },
            {
                "id": "bPYl1-KBE50",
                "title": "The Ultimate Orange Pill - Bitcoin & Risk",
                "duration": 1784
            },
            {
                "id": "uF6Wx4Hr6iU",
                "title": "Tom Lee: Bullish Bitcoin Outlook & Corporate Treasuries - Coin Stories",
                "duration": 1907
            },
            {
                "id": "iDgDl9jzEmk",
                "title": "Bitcoin Price Prediction Models Explained",
                "duration": 1227
            },
            {
                "id": "JLuTDwclOP0",
                "title": "The Resilience of Stock-to-Flow with PlanB - Bitcoin Standard Podcast",
                "duration": 6906
            },
            {
                "id": "93dyVDxP7K0",
                "title": "Bitcoin Logarithmic Regression",
                "duration": 402
            },
            {
                "id": "Z51vRLKvco4",
                "title": "Retiring on 0.1 Bitcoin - Luke Mikic",
                "duration": 3350
            },
            {
                "id": "XW1GUeBe0Rs",
                "title": "The Bitcoin Power Law WiM509",
                "duration": 8577
            },
            {
                "id": "yM06uqse6Ks",
                "title": "The Science Behind M Bitcoin",
                "duration": 5433
            },
            {
                "id": "wOi9XqeJy2E",
                "title": "Cathie Wood - New 2025 Prediction for Bitcoin & Ethereum",
                "duration": 1108
            },
            {
                "id": "D8QuMzEnvvM",
                "title": "Bitcoin Bear Market: SOPR Signals Losses as Liquidity Rolls Over - The Bitcoin Layer",
                "duration": 439
            },
            {
                "id": "kCi1gYaIbBc",
                "title": "Only 8 Years Until Bitcoin Hits $1 Million (The Math Proves It) - The Bitcoin Layer",
                "duration": 3043
            },
            {
                "id": "pkZqnM22l8Y",
                "title": "Bitcoin May Have Already Bottomed During War Markets - The Bitcoin Layer",
                "duration": 416
            },
            {
                "id": "AQ3ZnmAD_HQ",
                "title": "The REAL Reason Bitcoin Is Crashing - And What Comes Next - The Bitcoin Layer",
                "duration": 3354
            },
            {
                "id": "_FaM-IIt1bg",
                "title": "Bitcoin Enters Bear Market Behavior, What On-Chain Metrics Are Showing - The Bitcoin Layer",
                "duration": 2727
            },
            {
                "id": "0zUmhXgotMg",
                "title": "HERE COMES VANGUARD: Why Bitcoin Hits New All-Time Highs in 2026 - The Bitcoin Layer",
                "duration": 2998
            },
            {
                "id": "9gyreHKE5XY",
                "title": "BITCOIN'S 4-YEAR CYCLE NEVER EXISTED | Next Bubble 2027 w/ Stephen Perrenod - The Bitcoin Layer",
                "duration": 3441
            },
            {
                "id": "ppQfJMY9yYA",
                "title": "BITCOIN CRASHES THROUGH $100,000 While Macro Volatility Surges & Trend Structure Weakens - The Bitcoin Layer",
                "duration": 928
            },
            {
                "id": "Q9C4jbZoxIE",
                "title": "BITCOIN PUMPING: Fed Cuts, Liquidity, & The Next Breakout - The Bitcoin Layer",
                "duration": 1315
            },
            {
                "id": "44kS3j5L8AA",
                "title": "Bitcoin Breakout or Fade: $119,000 Test & Market Behavior - The Bitcoin Layer",
                "duration": 2495
            },
            {
                "id": "hIy9mb0-uSs",
                "title": "Bitcoin Price Levels to Watch: Short-Term Holders in Control - The Bitcoin Layer",
                "duration": 2017
            },
            {
                "id": "9c33ShgXBzg",
                "title": "Big Money Wants $1 Million Bitcoin - The Bitcoin Layer",
                "duration": 122
            },
            {
                "id": "2pDlaOGA2ac",
                "title": "Bitcoin: Everything there is, divided by 21 million",
                "duration": 547
            },
            {
                "id": "8jUsgjRhxlI",
                "title": "JUST IN - 95% of the 21 million bitcoin has now been mined!",
                "duration": 108
            },
            {
                "id": "MzxIZ4_f3e0",
                "title": "JUST IN - 94.5% of the 21 million bitcoin has now been mined!",
                "duration": 105
            },
            {
                "id": "yG3QiyCLoDA",
                "title": "Bitcoin Halving Progress Animation (9/12/24 Update)",
                "duration": 99
            },
            {
                "id": "_dKDHAsNAV4",
                "title": "JUST IN - 94% of the 21 million bitcoin has now been mined!",
                "duration": 99
            },
            {
                "id": "ym28FC_tbNM",
                "title": "The Bitcoin Halving: Why use the bitwise shift operation?",
                "duration": 553
            },
            {
                "id": "-wB6Si4jZYc",
                "title": "How the Bitcoin Halving Works (Code Walkthrough)",
                "duration": 737
            }]
    },
    {
        "id": "tutorials",
        "name": "Tutorials, Builders & DIY",
        "emoji": "📚",
        "desc": "Learn Bitcoin step by step — tutorials, builder stories & DIY hardware projects",
        "color": "#f7931a",
        "videos": [
            {
                "id": "hluk1tQun78",
                "title": "Understanding The Fed's Balance Sheet with Andy Constan - The Bitcoin Layer",
                "duration": 3841
            },
            {
                "id": "vPMUGP3Opy8",
                "title": "The PERFECT Bitcoin Security and Privacy Setup!",
                "duration": 2324
            },
            {
                "id": "_j4aSynAiX0",
                "title": "How Multi-Sig Makes All Bitcoiners Safer",
                "duration": 702
            },
            {
                "id": "iAdmvl3Z_cM",
                "title": "Clone Hardware Wallets. Same Seed on Multiple Devices (Trezor, Ledger, Keepkey, Coldcard, SafePal)",
                "duration": 357
            },
            {
                "id": "jkSeosiLmh4",
                "title": "How to mine BITCOIN with your Home PC or Laptop!",
                "duration": 784
            },
            {
                "id": "bsAznpEupIg",
                "title": "Easiest Bitcoin Wallet Setup (Aqua) - BTC Sessions",
                "duration": 2132
            },
            {
                "id": "4cXIUrCQExg",
                "title": "How to mine BITCOIN with your PC or Laptop!",
                "duration": 667
            },
            {
                "id": "P0yBusy5_Zc",
                "title": "HOW TO BUILD A BITCOIN NODE",
                "duration": 287
            },
            {
                "id": "cRRB_WzZpTM",
                "title": "BIP85: Segregated Bitcoin Accounts From One Seed (Uncle Jim Mode)",
                "duration": 3915
            },
            {
                "id": "tuUO-Q4_b5c",
                "title": "How to Buy Bitcoins in 2024 (4 Methods Reviewed)",
                "duration": 590
            },
            {
                "id": "XFoJUhxBAPQ",
                "title": "EP1: Meet Me in the Mempool w/ @wiz, Co-Founder & CEO Mempool.space",
                "duration": 2941
            },
            {
                "id": "_ZnTkrCjavs",
                "title": "How To Play the Bitcoin Lottery (It’s Easier Than You Think)",
                "duration": 597
            },
            {
                "id": "peCazF38jBQ",
                "title": "I Mined Bitcoin for 24 Hours on a Raspberry Pi",
                "duration": 673
            },
            {
                "id": "MlHa66QdLH4",
                "title": "Bitcoin Difficulty Epoch 416 Walkthrough",
                "duration": 147
            },
            {
                "id": "ck6vBhC35jY",
                "title": "Das kleinste Crypto Mining Rig für zuhause | DIY",
                "duration": 473
            },
            {
                "id": "T2KgXsmD10Y",
                "title": "EP19: The State of Mining and Media w/ Colin Harper, Writer and Researcher - Luxor Technologies",
                "duration": 3132
            },
            {
                "id": "6b0xTB2sE8E",
                "title": "Bull Bitcoin Wallet Full Tutorial - BTC Sessions",
                "duration": 5663
            },
            {
                "id": "-oujfwYj-zc",
                "title": "Bitcoin Node Count Dashboard — Walkthrough",
                "duration": 352
            },
            {
                "id": "HjnOMkbLOf8",
                "title": "EP15: Bitcoin is Good, pt. 2 w/ Grant McCarty, Co-Executive Director - Bitcoin Policy Institute",
                "duration": 3004
            },
            {
                "id": "41JCpzvnn_0",
                "title": "Bitcoin for Beginners - 99Bitcoins",
                "duration": 769
            },
            {
                "id": "yJpvfRl03Tw",
                "title": "How To Use Sparrow Bitcoin Wallet - In Depth Tutorial (BTC Sessions)",
                "duration": 6803
            },
            {
                "id": "9SUdFCRf-dc",
                "title": "EP12: Building Community with Bitcoin w/ Yusuf Nessary - Built With Bitcoin Foundation",
                "duration": 2856
            },
            {
                "id": "nCaGVYx3rgo",
                "title": "How to get your Amazon ESP32 2432S028 to work as a NerdMiner",
                "duration": 1144
            },
            {
                "id": "ltZEZM7OEu0",
                "title": "EP11: Bringing Bitcoin to Local Business w/ Michael Atwood, Founder - Oshi",
                "duration": 3270
            },
            {
                "id": "7EmshGDXi04",
                "title": "Bitcoin Replace By Fee & Child Pays For Parent Tutorial using Sparrow Wallet",
                "duration": 911
            },
            {
                "id": "5_p9tGq43Xw",
                "title": "Making $40 A DAY With A Cellphone Crypto Home Miner",
                "duration": 851
            },
            {
                "id": "6rpTjEpvUtc",
                "title": "i automated my home lab (and CLOUD) with Ansible",
                "duration": 764
            },
            {
                "id": "xAwbhE8EXAw",
                "title": "EP7: What to Expect at TABConf w/ Co-Organizer Michael Tidwell",
                "duration": 3616
            },
            {
                "id": "BXhJ18kcZEo",
                "title": "The COOLEST Home BITCOIN Miner Right Now!",
                "duration": 928
            },
            {
                "id": "18QvarVLofU",
                "title": "This Home Bitcoin Miner could Earn you 3.125 BTC! Bitaxe Gamma",
                "duration": 899
            },
            {
                "id": "JbxmMy0AprA",
                "title": "EP14: Bitcoin and the (R)Evolution of Media w/ Nico, Host - SimplyBitcoin",
                "duration": 3185
            },
            {
                "id": "QTmI7PXNZhI",
                "title": "CH1: Post-Show Recap w/ Justine Harper, VP, BD - Unchained Capital",
                "duration": 2561
            },
            {
                "id": "3Grj3Datdfw",
                "title": "Game-Changing Bitcoin Wallet (Cove) - BTC Sessions",
                "duration": 1893
            },
            {
                "id": "Sxo169CCfIc",
                "title": "How To Use Multisig Bitcoin Wallets With Electrum",
                "duration": 1471
            },
            {
                "id": "z3sldY-4ZKM",
                "title": "How to Check, Delete, & Recover a Bitcoin Seed Phrase",
                "duration": 1746
            },
            {
                "id": "IyW9Dn_--ME",
                "title": "The BEST Home Bitcoin Miner in 2025",
                "duration": 697
            },
            {
                "id": "S098zQKg2D4",
                "title": "The PERFECT Cold Hardware Wallet - Explained",
                "duration": 763
            },
            {
                "id": "qeBpYPcx1wg",
                "title": "Build & Run Your Own Bitcoin Node On A Raspberry Pi",
                "duration": 516
            },
            {
                "id": "Tr1bntrBOY0",
                "title": "Bitcoin & Liquidity Academy 2: How $37 Trillion in US Debt Shapes Global Markets - The Bitcoin Layer",
                "duration": 1549
            },
            {
                "id": "ydtPKYE-0eQ",
                "title": "$48 a day WITHOUT a Mining Rig! Crypto Passive Income",
                "duration": 482
            },
            {
                "id": "c8ytiynbnpk",
                "title": "Your First Bitcoin Wallet - BTC Sessions",
                "duration": 2555
            },
            {
                "id": "KbuOyBoTZmc",
                "title": "How to Set Up Your New Bitaxe, Part 1/4",
                "duration": 262
            },
            {
                "id": "DzikmY4S42Y",
                "title": "Start9 Tutorial: Set up your Bitcoin Node and Personal Server.",
                "duration": 1148
            },
            {
                "id": "tlQGO-Na7Io",
                "title": "How to Transfer Your Bitcoin from Ledger to Coldcard",
                "duration": 1523
            },
            {
                "id": "3xw-lMBbMds",
                "title": "Why & How to Run a Bitcoin/Lightning Node w/ MyNode",
                "duration": 1198
            },
            {
                "id": "IxgNp2h5j8w",
                "title": "How To Buy, Use and Secure Bitcoin - BTC Sessions",
                "duration": 1632
            },
            {
                "id": "P-5aFxDNqFs",
                "title": "EP26: Accounting For Bitcoin w/ Joe Wood, Founder - Satoshi Pacioli Accounting Services",
                "duration": 3247
            },
            {
                "id": "TeZiAhwkvKU",
                "title": "EP8: Good for Bitcoiners, Good for Bitcoin w/ SeedSigner",
                "duration": 3782
            },
            {
                "id": "4Lsr7lsy6Tk",
                "title": "How to Set Up a Bitcoin Node at Home",
                "duration": 79
            },
            {
                "id": "ri38Nc-Rrzg",
                "title": "How To Set Up Your OWN Bitcoin Node FOR FREE!!! + SOLO Mine To It",
                "duration": 892
            },
            {
                "id": "nZOlb69FF6k",
                "title": "AI Will COLLAPSE the Financial System - Here's How to Survive (and Thrive)",
                "duration": 581
            },
            {
                "id": "krrUQGMKhPo",
                "title": "Bitcoin UTXO Consolidation Tutorial",
                "duration": 879
            },
            {
                "id": "8zM_1lOXtBU",
                "title": "Bitcoin 2-of-4 Multisig Wallet Tutorial Using Sparrow Wallet",
                "duration": 3725
            },
            {
                "id": "k6QuA2KWQvY",
                "title": "HOW TO MAKE YOUR OWN NERD MINER V2 #BITCOIN #crypto #btc #cryptocurrencymining #crypto",
                "duration": 479
            },
            {
                "id": "bBC-nXj3Ng4",
                "title": "How Bitcoin Works Under the Hood",
                "duration": 1516
            },
            {
                "id": "O1KaAboPX44",
                "title": "How To Buy Bitcoin For Beginners - Step by Step",
                "duration": 586
            },
            {
                "id": "B4-fIKroG_M",
                "title": "How to make a 3$ usb drive into a secure crypto wallet",
                "duration": 593
            },
            {
                "id": "PeBE4VV6fWk",
                "title": "Bitcoin Self-Custody Made Easy (Bitkey)",
                "duration": 944
            },
            {
                "id": "9uodS6FBsdw",
                "title": "How to Choose the BEST Cold Wallet for 2026",
                "duration": 653
            },
            {
                "id": "niXxUrpkoRA",
                "title": "How To Create Infinite Bitcoin Wallets (Passphrase)",
                "duration": 714
            },
            {
                "id": "rYAFyFsN5UE",
                "title": "My mini Bitcoin USB miner setup explained for solo mining Bitcoin",
                "duration": 659
            },
            {
                "id": "mOCUqbFQ57o",
                "title": "Bitcoin Daily DCA & HODL Animation Walkthrough",
                "duration": 695
            },
            {
                "id": "FEBRIQeiqfg",
                "title": "How To Make A USB #Crypto Wallet | OFFLINE STORAGE | DIY/Tutorial | 2022",
                "duration": 678
            },
            {
                "id": "4PvA7oYDXu8",
                "title": "Crypto Wallets Explained (Beginners Guide 2025)",
                "duration": 1090
            },
            {
                "id": "mibKrTvtlyQ",
                "title": "Misty Breez Bitcoin Wallet Setup - BTC Sessions",
                "duration": 1822
            },
            {
                "id": "iTno3A4jE0Y",
                "title": "Bitcoin & Liquidity Academy 1: Understanding Balance Sheets, Capital, and Treasuries - The Bitcoin Layer",
                "duration": 1548
            },
            {
                "id": "1LhcDJ8bgQU",
                "title": "Bitcoin RBF (Replace By Fee) Tutorial",
                "duration": 1077
            },
            {
                "id": "_WS4TiOvLFM",
                "title": "Gold Nugget NerdMiner 2 Lottery Miner (Bitcoin Merch) - Setup and Reset Guide",
                "duration": 336
            },
            {
                "id": "GbEJ0neZkxQ",
                "title": "WSB Update & Bitcoin Dominance Dashboard — Walkthrough",
                "duration": 469
            },
            {
                "id": "JdatHrGUHO0",
                "title": "EP27: Devs Who Can Hack It w/ Alekos Filini & Daniela Brozzoni, Developers - BDK, Founders - hack.bs",
                "duration": 3125
            },
            {
                "id": "vmf_LtnagTs",
                "title": "Bitcoin Cold Storage Tutorial",
                "duration": 2386
            },
            {
                "id": "CwX35qCL1f4",
                "title": "How to Get Started with Bitcoin Mining (Full Beginner Guide)",
                "duration": 1006
            },
            {
                "id": "EARJ_b1C1HU",
                "title": "$25 USB Nerd Miner Setup | Bitcoin Merch Guide",
                "duration": 269
            },
            {
                "id": "ZcsLaDoVPNU",
                "title": "CH2: Post-Show Recap w/ Sidd, Writer and Rider - Bitcoin Tour of America",
                "duration": 3260
            },
            {
                "id": "X0aaySypick",
                "title": "Bitcoin & Liquidity Academy 3: Primary Dealers, U.S. Treasuries & the Fed - The Bitcoin Layer",
                "duration": 1318
            },
            {
                "id": "1gH33qosYXU",
                "title": "EP16: Category Creation: Proof-of-Funds w/ Sam Abbassi, CEO - Hoseki",
                "duration": 2918
            },
            {
                "id": "01VQpFPCMek",
                "title": "Nerd Miner 2 How to set up on your home or office Wi-Fi from start to hashing coins",
                "duration": 1175
            },
            {
                "id": "pcbYq2LCWwk",
                "title": "LIQUIDITY Explained SIMPLY: How It Really Moves BITCOIN - The Bitcoin Layer",
                "duration": 1007
            },
            {
                "id": "YrKo0QGWIuY",
                "title": "Raspberry Pi Zero Project | Cryptocurrency Hardware Wallet",
                "duration": 441
            },
            {
                "id": "bvUxEFGfVi8",
                "title": "EP20: Bitcoin Changes Everything w/ P, Programming Director - Swan Bitcoin",
                "duration": 3258
            },
            {
                "id": "Gc2en3nHxA4",
                "title": "What is Bitcoin - Simply Explained",
                "duration": 97
            },
            {
                "id": "RhPf4toA79A",
                "title": "HARDWARE-WALLET ERKLÄRT! 🔐 SO verwahrst DU BITCOIN SICHER!",
                "duration": 773
            },
            {
                "id": "ZpX1wNchiD4",
                "title": "EP17: Bitcoin Just Works w/ Harry Sudock, VP, Strategy - Griid",
                "duration": 3087
            },
            {
                "id": "LxTkLwpV1Po",
                "title": "Permissionless Bitcoin Wallets - They Cannot Be Stopped!",
                "duration": 3492
            },
            {
                "id": "AFoQ6Ymj8-w",
                "title": "EP22: Risk Management through Miniscript w/ Rob Hamilton, Co-Founder & CEO - AnchorWatch",
                "duration": 2451
            },
            {
                "id": "jMf6Gqo3J4I",
                "title": "WHAT IS A BITCOIN NODE? & 5 Reasons To Run A Bitcoin Full Node!",
                "duration": 338
            },
            {
                "id": "dCAr2urEe1o",
                "title": "ENTROPIA - Generate Permissionless Bitcoin Wallets",
                "duration": 2461
            },
            {
                "id": "GR-E0aaFf0c",
                "title": "Bitcoin Explained for Complete Beginners",
                "duration": 2759
            },
            {
                "id": "qyVYPHVaeO4",
                "title": "I Turned an OLD PC into a Bitcoin Mining Rig",
                "duration": 791
            },
            {
                "id": "UYUfXWlAleA",
                "title": "01 - myNode series - Why run a Bitcoin node",
                "duration": 594
            },
            {
                "id": "cBKrrKzZSd4",
                "title": "EP18: Stay Humble, Stack Stats w/ Matt Odell, Bitcoiner",
                "duration": 3521
            },
            {
                "id": "lh7tYnOk3AU",
                "title": "EP3: Bitcoin Is Good w/ David Zell, Founder & Co-Executive Director of the Bitcoin Policy Institute",
                "duration": 3125
            },
            {
                "id": "KT8zri-XN58",
                "title": "EP24: Mastering Miner Management w/ Dan Lawrence, Co-Founder & CEO - OBM, Inc./Foreman",
                "duration": 3213
            },
            {
                "id": "N6ax-ZmTsDc",
                "title": "EP23: Tangible Tools for Digital Money w/ NVK, Co-Founder & CEO - Coinkite",
                "duration": 2882
            },
            {
                "id": "pWmgu5eA4y4",
                "title": "Evil RBFer Scenario Walkthrough using Sparrow Wallet",
                "duration": 783
            },
            {
                "id": "gH0DkA_VGQg",
                "title": "EP10: Learning (and Earning) with Lightning w/ Nate, Education and Support - Voltage",
                "duration": 2875
            },
            {
                "id": "281Gal2xztI",
                "title": "Bitcoin Quantum Exposure Dashboard (FULL) — Download & Walkthrough",
                "duration": 1419
            },
            {
                "id": "5GCBWyHkklc",
                "title": "EP2: Bringing Bitcoin to the World w/ Ben Price, Co-Founder & CEO The Bitcoin Company",
                "duration": 3272
            },
            {
                "id": "QabBSVF08KE",
                "title": "Easiest way to Run a Bitcoin Node! | How to connect hardware wallet to your own Node with Sparrow.",
                "duration": 278
            },
            {
                "id": "wWnUvCNeYEo",
                "title": "Crypto Wallets Explained! (Beginners' Guide!) 📲 🔑 (2025 Edition!) ⭐⭐⭐⭐⭐ Ultimate Step-by-Step! 😎",
                "duration": 1199
            },
            {
                "id": "TTS0Ufkv4xc",
                "title": "EP9: Designing for Bitcoin w/ Stephen DeLorme, Designer - Bitcoin Design Community",
                "duration": 3158
            },
            {
                "id": "9ExAt9EUCNc",
                "title": "How to be remembered forever",
                "duration": 463
            },
            {
                "id": "xhDQT4TeNIU",
                "title": "Perfect Privacy with eNuts: Instant Free Bitcoin Transactions",
                "duration": 3070
            },
            {
                "id": "SPP81mGYeZw",
                "title": "If I Wanted to Secure My Crypto in 2026, I’d Do THIS",
                "duration": 923
            },
            {
                "id": "Cyf7JjpygB4",
                "title": "How To Build a GPU Mining Rig in 2026 - PROFITABLE!!",
                "duration": 1107
            },
            {
                "id": "FAYmE5-40PQ",
                "title": "Coldcard Bitcoin Hardware Wallet - FULL TUTORIAL (BTC Sessions)",
                "duration": 6890
            },
            {
                "id": "l0dzOwyPqFI",
                "title": "How to make passive income running blockchain nodes",
                "duration": 576
            },
            {
                "id": "_Qxm70pFM4E",
                "title": "Bitcoin Quantum Exposure Dashboard — Walkthrough",
                "duration": 992
            },
            {
                "id": "H47wmnfASds",
                "title": "EP4: Bitcoin is Hard. Bitcoin is Easy. w/ Justine Harper, VP, BD - Unchained Capital",
                "duration": 2762
            },
            {
                "id": "MTrKwsCg9d8",
                "title": "🔌 Gold Nugget Nerd Miner Unboxing & Setup | Start Solo Mining Bitcoin Today! 💡",
                "duration": 288
            },
            {
                "id": "YeEy7pOre04",
                "title": "The Best Bitcoin Hardware Wallet | ColdCard MK4 Setup Tutorial",
                "duration": 1084
            },
            {
                "id": "kgaUK47CEPY",
                "title": "EP25: Making Bitcoin Accessible w/ Conor Okus, Product Manager - Spiral",
                "duration": 3270
            },
            {
                "id": "vyJ4EvjXDcg",
                "title": "EP21: Building (Multiple) Bitcoin Businesses w/ Marty Bent, Founder - TFTC",
                "duration": 2891
            },
            {
                "id": "cx0E2ICJXLY",
                "title": "Is Bitcoin Mining Worth It In 2025??",
                "duration": 891
            },
            {
                "id": "3QH7ZTibV-Q",
                "title": "How to Buy Bitcoin (in 2 minutes) - 2024 Updated",
                "duration": 161
            },
            {
                "id": "OZK5hdKfb18",
                "title": "Bitcoin Security Best Practices",
                "duration": 2955
            },
            {
                "id": "fgAKXfVzc7c",
                "title": "Start9 OS Bitcoin Node Tutorial - DIY Hardware, How To Set Up, Download & Why I Moved from Umbrel.",
                "duration": 827
            },
            {
                "id": "Xjrq1f3pNMY",
                "title": "EP5: Bitcoin Across America w/ Sidd, Writer and Rider - Bitcoin Tour of America",
                "duration": 3693
            },
            {
                "id": "pDSQVX8oQSA",
                "title": "How to Send Crypto TO Cold Wallets (BEGINNER'S GUIDE)",
                "duration": 575
            },
            {
                "id": "pgYBgXFqIjw",
                "title": "EP13: The Beefsteak w/ awayslice, the Beefsteak Guy",
                "duration": 2860
            },
            {
                "id": "k5h7A7kRM8Y",
                "title": "How to make a 24 word Bitcoin seed phrase with 256 coins",
                "duration": 236
            },
            {
                "id": "zEFEoBZfpb4",
                "title": "How to Set Up Your Nerdminer v2 / NMminer | Full Configuration Guide",
                "duration": 253
            },
            {
                "id": "oj_W3xOlt6U",
                "title": "Cracking Unsafe Bitcoin Wallets + Coldcard Mk4 Warning",
                "duration": 598
            },
            {
                "id": "95FonGULBtc",
                "title": "EP6: Bitcoin, Beef, and Building Locally w/ Texas Slim, Founder - The Beef Initiative",
                "duration": 3002
            },
            {
                "id": "Y3iAwLG6NlA",
                "title": "Bitcoin Wallets That Change Everything in 2026 - BTC Sessions",
                "duration": 1907
            },
            {
                "id": "rKjce1jCxSM",
                "title": "Bitcoin Beginner Mistakes to Avoid",
                "duration": 1812
            },
            {
                "id": "7iplbbcLfJU",
                "title": "How Does a Crypto Hardware Wallet Work?",
                "duration": 519
            },
            {
                "id": "lVhdpmhYxbI",
                "title": "EP28: Facilitating FOSS Development w/ Haley Berkoe, Program Manager - Spiral",
                "duration": 3108
            }]
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
                _syncYTVolume();
            }
        }
    });
}

function onPlayerStateChange(event) {
    if (_apiFailed || typeof YT === 'undefined') return;

    // User paused (via YT controls, spacebar, tap, or our remote)
    if (event.data === YT.PlayerState.PAUSED) {
        _isPaused = true;
        _updatePauseButtons(true);
        // Show Jump to Live when user explicitly pauses
        _showSyncButtons(true);
    }

    // Video playing - check if user is at live position or drifted
    if (event.data === YT.PlayerState.PLAYING) {
        _isPaused = false;
        _updatePauseButtons(false);
        // Check if they're actually at the live position (hide/show Jump to Live accordingly)
        checkDrift();
    }

    // Video ended - advance to next video immediately
    if (event.data === YT.PlayerState.ENDED) {
        _isPaused = false;
        _advanceToNextVideo();
    }

    // Buffering
    if (event.data === YT.PlayerState.BUFFERING) {
        _isPaused = false;
    }
}

function _updatePauseButtons(paused) {
    var btn = document.getElementById('remote-pause-btn');
    var btn2 = document.getElementById('remote-pause-btn-inline');
    if (btn) btn.textContent = paused ? '\u25b6' : '\u23f8';
    if (btn2) btn2.textContent = paused ? '\u25b6' : '\u23f8';
}

function _showSyncButtons(show) {
    var btn = document.getElementById('tctv-sync-btn');
    if (btn) btn.style.display = show ? 'block' : 'none';
}

// Advance to the next scheduled video on the current station
function _advanceToNextVideo() {
    if (_isPaused || !_currentStation) return;
    var station = STATIONS.find(function(s) { return s.id === _currentStation; });
    if (!station) return;
    var state = getPlaybackState(station);
    if (!state.video) return;

    // Update NOW PLAYING (single source of truth)
    _setNP(station.id, state.video);

    // Reuse existing YT player if possible (avoids autoplay restrictions)
    if (!_apiFailed && _ytPlayer && _ytPlayer.loadVideoById && _ytPlayer.playVideo) {
        _currentVideoId = state.video.id;
        try {
            _ytPlayer.loadVideoById(state.video.id, Math.floor(state.offset));
            _ytPlayer.playVideo();
        } catch(e) {
            loadVideo(state.video.id, state.offset);
        }
        _syncYTVolume();
        _showSyncButtons(false);
        return;
    }

    // Fallback: full reload (iframe path or no player)
    _currentVideoId = state.video.id;
    loadVideo(state.video.id, state.offset);
}

function checkDrift() {
    if (_apiFailed || !_ytPlayer || !_ytPlayer.getCurrentTime || !_currentStation || _isPaused) return;
    var station = STATIONS.find(function(s) { return s.id === _currentStation; });
    if (!station) return;
    var state = getPlaybackState(station);
    if (!state.video) return;

    var currentTime;
    try { currentTime = _ytPlayer.getCurrentTime(); } catch(e) { return; }

    // Check if we're on the wrong video entirely
    var wrongVideo = (state.video.id !== _currentVideoId);

    // Check time drift within the correct video
    var drift = wrongVideo ? 999 : Math.abs(currentTime - state.offset);
    _showSyncButtons(drift > 5);
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
    // Clear both desktop-inline and mobile inputs
    ['remote-ch-input', 'remote-ch-input-inline'].forEach(function(id) {
        var input = document.getElementById(id);
        if (input) { input.value = ''; input.blur(); }
    });
};

// ────────────────────────────────────────────────────────
// Channel Guide Modal
// ────────────────────────────────────────────────────────
// Curated featured bitcoiners per channel (visible in the Guide modal).
var _CHANNEL_FEATURED = {
    'art-philosophy': [
        'FractalEncrypt', 'Based Trading Cards', 'Bitcoin Art Podcast', 'Amy DiGi',
        'Yonat Vaks', 'Anik Malcolm', 'Robert Breedlove', 'Knut Svanholm',
        'Allen Farrington', 'Gigi', 'Ordinals', 'Bitcoin Bull Statue'
    ],
    'conferences-events': [
        'Bitcoin 2024 Nashville', 'BTC Prague', 'MIT Bitcoin Expo', 'Bitcoin Atlantis',
        'Adopting Bitcoin', 'Strategy World', 'Bitcoin MENA', 'Bitcoin Asia',
        'TABConf', 'Bitcoin Amsterdam', 'Open Source Stage', 'Paris Blockchain Week'
    ],
    'culture-travel': [
        'Max Keiser', 'Stacy Herbert', 'Paco de la India', 'Aleksandar Svetski',
        'Bitcoin Beach (El Salvador)', 'Bukele\'s El Salvador', 'BTC Map', 'Africa Bitcoin',
        'Lugano Plan B', 'Madeira', 'Citadel21', 'Built With Bitcoin Foundation'
    ],
    'dev-privacy-nodes': [
        'Adam Back', 'Jameson Lopp', 'Matt Corallo', 'Peter Todd', 'Andreas Antonopoulos',
        'Roasbeef (Olaoluwa Osuntokun)', 'Pieter Wuille', 'Greg Maxwell', 'Wasabi Wallet',
        'Samourai Wallet', 'Bitcoin Magazine', 'Open Source Stage', 'Sparrow Wallet'
    ],
    'economics-money': [
        'Lyn Alden', 'Saifedean Ammous', 'Jeff Booth', 'Greg Foss', 'Luke Gromen',
        'Preston Pysh', 'Andy Edstrom', 'James Lavish', 'Lawrence Lepard',
        'Mike Maloney', 'Rafael Yakobi', 'The Bitcoin Standard', 'Hidden Forces'
    ],
    'freedom-sovereignty': [
        'Edward Snowden', 'Alex Gladstein', 'Jameson Lopp', 'Erik Cason',
        'Andreas Antonopoulos', 'Human Rights Foundation', 'Roya Mahboob', 'Farida Nabourema',
        'Anita Posch', 'Ross Ulbricht', 'Erik Voorhees', 'Caitlin Long'
    ],
    'health-fitness': [
        'Saifedean Ammous', 'Aleks Svetski', 'Anders Larsson', 'Bitcoin Mindset',
        'Tom Bilyeu', 'Carnivore MD (Paul Saladino)', 'Jordan Peterson on time preference',
        'Bitcoin & Beef', 'Texas Slim', 'The Beef Initiative', 'Low Time Preference'
    ],
    'history': [
        'Andreas Antonopoulos', 'Adam Back', 'Hal Finney', 'Wei Dai', 'Nick Szabo',
        'Cypherpunks', 'Satoshi Nakamoto', 'Mt. Gox', 'Pizza Day', 'Patoshi Pattern',
        'Genesis Block', 'God Bless Bitcoin', 'Hard Money', 'This Machine Greens',
        'Banking on Bitcoin', 'The Rise & Rise of Bitcoin', 'Bitcoin: End of Money',
        'Stacked Studios', 'Magic Internet Money'
    ],
    'kids-family': [
        'Tuttle Twins', 'Bitcoin for Kids', 'Scott Beebe', 'Family Bitcoin',
        'Stacy Herbert', 'Bitcoin Buddies', 'Heart Bitcoin', 'Q the Lightning',
        'Bitcoin Books for Children', 'Hodl Camp'
    ],
    'lightning': [
        'Elizabeth Stark (Lightning Labs)', 'Roy Sheinfeld (Breez)', 'Roasbeef',
        'Strike / Jack Mallers', 'Wallet of Satoshi', 'Phoenix Wallet', 'Alby',
        'Mutiny Wallet', 'Voltage', 'NWC (Nostr Wallet Connect)', 'LNbits',
        'Zaprite', 'The Bitcoin Layer'
    ],
    'memes-comedy': [
        'Lil Bubble', 'Crypto Casey skits', 'Hitler Reacts to Bitcoin Cash',
        'Bitcoin Memes Compilation', 'Sigma Saylor', 'Crypto Boy parody',
        'Rug Star (Smash Mouth parody)', 'WHATS DROPPIN parody', 'The Crypto Verse',
        'Bitcoin Boomer reacts', 'Drake "Started From the Bottom" parody'
    ],
    'mining': [
        'The Hobbyist Miner', 'Marathon Digital', 'Riot Platforms', 'Compass Mining',
        'CleanSpark', 'Hut 8', 'Bitaxe', 'NerdMiner', 'Modern Mining', 'Your Friend Andy',
        'Sebs FinTech Channel', 'Antminer', 'Whatsminer', 'Off-Grid Mining', 'Solo Miner'
    ],
    'music': [
        'Lil Bubble', 'Captain Youth', 'The Higher Low', 'Bitcoin House Vol. 1 & 2',
        'Saylor Bitcoin House Remixes', 'WAGMI anthem', 'Satoshi As My Witness',
        '100 RACKS Bitcoin Anthem', 'Gary Gensler - Smells Like Securities',
        'Crypto Christmas EP', 'There Is No Second Best (remix)', 'LFG'
    ],
    'news': [
        'Whale Wire', 'Bitcoin Magazine', 'Daily Bitcoin Updates', 'Market Briefings',
        '60 Minutes Bitcoin Beach', 'Bloomberg Crypto', 'CNBC Squawk Box',
        'BlockTV', 'Coindesk TV', 'Real Vision', 'Wicked Smart Bitcoin updates'
    ],
    'orange-pill': [
        'Andreas Antonopoulos', '3Blue1Brown', '99Bitcoins', 'Casually Explained',
        'CuriousInventor', 'WIRED', 'The Guardian', 'CNET', 'Swan Bitcoin',
        'BTCSessions', 'Bitcoin.com', 'Davinci Jeremie', 'Jack Mallers (Atlantis)',
        'The Bitcoin Fix', 'Ioni Appelberg', 'Robert Breedlove', 'Saifedean Ammous',
        'Knut Svanholm', 'Lyn Alden', 'Get Based TV', 'Simply Bitcoin', 'Bitcoin University'
    ],
    'podcasts-debates': [
        'Joe Rogan', 'Lex Fridman', 'Peter McCormack (WBD)', 'What Bitcoin Did',
        'Pomp Podcast', 'Tom Bilyeu (Impact Theory)', 'Stephan Livera Podcast',
        'Bitcoin Audible', 'TFTC (Marty Bent)', 'Once Bitten', 'Bitcoin Layer Podcast',
        'Bitcoin Magazine Podcast', 'Saifedean Podcast', 'Coin Stories (Natalie Brunell)',
        'X Spaces: Saylor & Greg Foss', 'X Spaces: El Salvador Law (Nic Carter)',
        'X Spaces: Mark Cuban debates Pomp/Pysh/PeterMcCormack',
        'X Spaces: Orange Pill App (Jeff Booth, Breedlove, Knut)',
        'X Spaces: Bitcoin vs Crypto', 'X Spaces: Nic Carter PoW vs PoS',
        'X Spaces: BTCPayServer, Xapo, Simon Dixon, TFTC'
    ],
    'politics-regulation': [
        'Sen. Cynthia Lummis', 'Brian Armstrong (Coinbase)', 'Caitlin Long',
        'Donald Trump (BTC 2024)', 'Bitcoin Policy Institute', 'David Zell',
        'Grant McCarty', 'Vivek Ramaswamy', 'RFK Jr.', 'Sen. Tim Scott',
        'Gary Gensler (the SEC saga)', 'Custodia Bank', 'Strategic Bitcoin Reserve'
    ],
    'saylor': [
        'Michael Saylor', 'Phong Le', 'Jeff Walton', 'Simon Gerovich (Metaplanet)',
        'Strive Asset Management', 'Strategy ($MSTR)', 'True North Podcast',
        'Hurdle Rate Podcast', 'Bitcoin for Corporations (BFC)', 'STRC / STRF / STRK / STRD',
        'Adam Livingston', 'Dylan LeClair', 'George Mekhail', 'Tim Kotzman'
    ],
    'future-predictions': [
        'PlanB (Stock-to-Flow)', 'Willy Woo', 'Lyn Alden', 'Wicked Smart Bitcoin',
        'Bitcoin Power Law', 'Pi Cycle Top', 'NUPL', 'MVRV', 'Puell Multiple',
        'Rainbow Chart', 'Bitcoin Halving Models', 'Saylor $13M target', '$1M Bitcoin'
    ],
    'tutorials': [
        'Builders In Bitcoin podcast', 'Wicked Smart Bitcoin', 'NVK (Coinkite)',
        'SeedSigner team', 'The Hobbyist Miner', 'BTCSessions', 'Sparrow Wallet tutorials',
        'Coldcard guides', 'Nunchuk', 'Umbrel', 'Start9', 'RaspiBlitz', 'MyNode',
        'Bitaxe builds', 'NerdMiner builds', 'Voltage Lightning', 'CuriousInventor'
    ],
    'ai-nostr': [
        'Jack Dorsey', 'Will Casarin (Damus)', 'Fiatjaf (Nostr creator)', 'Miljan Bratic (Primal)',
        'BTC Sessions', 'Snowden on Nostr', 'Castig', 'Daniella.io', 'Anita Posch',
        'Derek Ross', 'Sebastix (Sebastian Hagens)', 'Bitcoin University', 'Voltage zaps',
        'Damus client', 'Primal client', 'Amethyst', 'Iris', 'NIPs / Nostr Wallet Connect',
        'Value4Value (Podcasting 2.0)', 'Fountain', 'AI agents x Lightning'
    ]
};

window.tctvOpenGuide = function() {
    if (typeof window.nachoPlaySound === 'function') window.nachoPlaySound('tctv-beep');
    // Don't double-open
    if (document.getElementById('tctv-guide-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'tctv-guide-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:300000;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;animation:tctvGuideFade 0.2s ease-out;';
    overlay.onclick = function(e) { if (e.target === overlay) tctvCloseGuide(); };

    var modal = document.createElement('div');
    modal.style.cssText = 'background:#0a0a0a;border:2px solid #f7931a;border-radius:16px;width:100%;max-width:720px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 80px rgba(247,147,26,0.25);overflow:hidden;';

    // Header
    var hdr = '<div style="padding:16px 20px;background:#161616;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center;">' +
        '<div>' +
            '<div style="font-size:1.1rem;font-weight:900;color:#f7931a;letter-spacing:1px;">📺 CHANNEL GUIDE</div>' +
            '<div style="font-size:0.7rem;color:#888;margin-top:2px;">21 channels · click any channel to tune in</div>' +
        '</div>' +
        '<button onclick="tctvCloseGuide()" style="width:36px;height:36px;border-radius:50%;background:#1a1a1a;border:1px solid #333;color:#aaa;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Close">✕</button>' +
    '</div>';

    // Body
    var body = '<div style="flex:1;overflow-y:auto;padding:8px;-webkit-overflow-scrolling:touch;">';
    for (var i = 0; i < STATIONS.length; i++) {
        var s = STATIONS[i];
        var featured = _CHANNEL_FEATURED[s.id] || [];
        var featuredHtml = featured.length
            ? '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">' +
              featured.map(function(n) { return '<span style="font-size:0.65rem;padding:2px 8px;background:rgba(247,147,26,0.12);border:1px solid rgba(247,147,26,0.25);border-radius:10px;color:#f7c878;">' + n + '</span>'; }).join('') +
              '</div>'
            : '';
        var isActive = s.id === _currentStation;
        body += '<div onclick="tctvCloseGuide();window.switchStation(\'' + s.id + '\')" style="padding:12px 14px;margin:4px;border-radius:10px;background:' + (isActive ? 'rgba(247,147,26,0.18)' : '#161616') + ';border:1px solid ' + (isActive ? '#f7931a' : '#222') + ';cursor:pointer;transition:0.15s;" onmouseover="this.style.background=\'rgba(247,147,26,0.10)\';this.style.borderColor=\'#f7931a\';" onmouseout="this.style.background=\'' + (isActive ? 'rgba(247,147,26,0.18)' : '#161616') + '\';this.style.borderColor=\'' + (isActive ? '#f7931a' : '#222') + '\';">' +
            '<div style="display:flex;align-items:center;gap:10px;">' +
                '<div style="flex:0 0 44px;height:44px;border-radius:8px;background:' + (s.color || '#f7931a') + ';display:flex;align-items:center;justify-content:center;font-size:1.4rem;">' + (s.emoji || '📺') + '</div>' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:0.95rem;font-weight:800;color:#fff;"><span style="color:#f7931a;font-family:Courier New,monospace;font-weight:700;">CH ' + (i + 1) + '</span> · ' + s.name + (isActive ? ' <span style="font-size:0.6rem;color:#22c55e;font-weight:700;margin-left:4px;">● NOW</span>' : '') + '</div>' +
                    '<div style="font-size:0.75rem;color:#aaa;margin-top:3px;line-height:1.4;">' + (s.desc || '') + '</div>' +
                    featuredHtml +
                '</div>' +
            '</div>' +
        '</div>';
    }
    body += '</div>';

    modal.innerHTML = hdr + body;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Esc to close
    var escHandler = function(e) { if (e.key === 'Escape') tctvCloseGuide(); };
    document.addEventListener('keydown', escHandler);
    overlay._escHandler = escHandler;
};

window.tctvCloseGuide = function() {
    var ov = document.getElementById('tctv-guide-overlay');
    if (!ov) return;
    if (ov._escHandler) document.removeEventListener('keydown', ov._escHandler);
    ov.style.opacity = '0';
    ov.style.transition = 'opacity 0.15s ease-out';
    setTimeout(function() { ov.remove(); }, 150);
};

window.tctvRemotePause = function() {
    if (typeof window.nachoPlaySound === 'function') window.nachoPlaySound('tctv-beep');

    if (!_isPaused) {
        // Pause the video - onPlayerStateChange will handle UI
        if (_ytPlayer && _ytPlayer.pauseVideo) _ytPlayer.pauseVideo();
        // Fallback for iframe mode
        _isPaused = true;
        _updatePauseButtons(true);
        _showSyncButtons(true);
    } else {
        // Resume - jump to live (sync to global clock)
        syncPlayer();
    }
};

window.tctvRemoteVolume = function(dir) {
    // Get current volume from app state (single source of truth)
    var current = Math.round((typeof window.audioVolume === 'number' ? window.audioVolume : 0.5) * 100);
    var next = Math.max(0, Math.min(100, current + (dir * 10)));

    // Any manual volume change exits mute
    window._tctvMuted = false;

    // Set app volume (0-1 scale) - this persists to localStorage
    if (typeof window.setVolume === 'function') {
        window.setVolume(next / 100);
    }

    // Apply to YT player iframe
    _applyYTVolume(next);
    _updateMuteButtons(false);

    // Show toast
    var icon = next === 0 ? '\ud83d\udd07' : next <= 30 ? '\ud83d\udd08' : next <= 60 ? '\ud83d\udd09' : '\ud83d\udd0a';
    if (typeof showToast === 'function') showToast(icon + ' Volume: ' + next + '%');

    // Update label if visible
    var label = document.getElementById('tctv-vol-label');
    if (label) label.textContent = next + '%';
};

function _applyYTVolume(vol) {
    try {
        if (!_ytPlayer) return;
        // Check player state - getPlayerState returns -1 if unstarted
        var state = typeof _ytPlayer.getPlayerState === 'function' ? _ytPlayer.getPlayerState() : -1;
        if (state === -1) return; // Player not ready
        if (typeof _ytPlayer.setVolume === 'function') _ytPlayer.setVolume(vol);
        if (vol === 0 && typeof _ytPlayer.mute === 'function') _ytPlayer.mute();
        else if (vol > 0 && typeof _ytPlayer.unMute === 'function') _ytPlayer.unMute();
    } catch(e) {}
}

// Sync YT player volume with app volume on player ready/load
function _syncYTVolume() {
    if (typeof window.audioVolume !== 'number') return;
    var vol = Math.round(window.audioVolume * 100);
    // Delay slightly - player needs a moment after loadVideoById
    setTimeout(function() { _applyYTVolume(vol); }, 500);
}

// Mute toggle — preserves last unmuted volume so unmute restores to it.
window._tctvMuted = false;
window._tctvPreMuteVolume = null;
window.tctvRemoteMute = function() {
    var current = Math.round((typeof window.audioVolume === 'number' ? window.audioVolume : 0.5) * 100);
    if (!window._tctvMuted && current > 0) {
        // MUTE — remember current volume, then force volume to 0 everywhere
        window._tctvPreMuteVolume = current;
        window._tctvMuted = true;
        // Set app volume to 0 so it persists across video transitions / _syncYTVolume calls
        if (typeof window.setVolume === 'function') window.setVolume(0);
        // Belt + suspenders: force YT player volume to 0 AND call .mute()
        try {
            if (_ytPlayer) {
                if (typeof _ytPlayer.setVolume === 'function') _ytPlayer.setVolume(0);
                if (typeof _ytPlayer.mute === 'function') _ytPlayer.mute();
            }
        } catch(e) {}
        _updateMuteButtons(true);
        if (typeof showToast === 'function') showToast('\ud83d\udd07 Muted');
    } else {
        // UNMUTE — restore previous volume (or 50% if we don't have one)
        var restore = (typeof window._tctvPreMuteVolume === 'number' && window._tctvPreMuteVolume > 0) ? window._tctvPreMuteVolume : 50;
        window._tctvMuted = false;
        // Restore app volume (persists across transitions)
        if (typeof window.setVolume === 'function') window.setVolume(restore / 100);
        // Force YT player back up
        try {
            if (_ytPlayer) {
                if (typeof _ytPlayer.unMute === 'function') _ytPlayer.unMute();
                if (typeof _ytPlayer.setVolume === 'function') _ytPlayer.setVolume(restore);
            }
        } catch(e) {}
        _updateMuteButtons(false);
        if (typeof showToast === 'function') showToast('\ud83d\udd0a Unmuted: ' + restore + '%');
    }
};

function _updateMuteButtons(muted) {
    var ids = ['remote-mute-btn', 'remote-mute-btn-inline'];
    for (var i = 0; i < ids.length; i++) {
        var b = document.getElementById(ids[i]);
        if (!b) continue;
        b.textContent = muted ? '\ud83d\udd07' : '\ud83d\udd08';
        b.setAttribute('title', muted ? 'Unmute' : 'Mute');
        b.style.background = muted ? '#991b1b' : '';
        b.style.borderColor = muted ? '#dc2626' : '';
    }
}

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
    if (couch) couch.style.display = 'none';
    _ensureCouchRestoreBtn();
    var restoreBtn = document.getElementById('nacho-couch-restore');
    if (restoreBtn) {
        _applyCouchPosition(restoreBtn);
        restoreBtn.style.display = 'flex';
    }
    // Save collapsed state
    try { localStorage.setItem('tctv_couch_collapsed', '1'); } catch(e) {}
};

window.tctvRestoreCouch = function() {
    var couch = document.getElementById('nacho-couch');
    var restoreBtn = document.getElementById('nacho-couch-restore');
    if (couch) {
        // Apply saved position when restoring couch too
        _applyCouchPosition(couch);
        couch.style.display = 'block';
    }
    if (restoreBtn) restoreBtn.style.display = 'none';
    // Save restored state
    try { localStorage.removeItem('tctv_couch_collapsed'); } catch(e) {}
};

// Ensure the restore button exists (creates it dynamically)
function _ensureCouchRestoreBtn() {
    var existing = document.getElementById('nacho-couch-restore');
    if (existing) return existing;
    var btn = document.createElement('div');
    btn.id = 'nacho-couch-restore';
    btn.innerHTML = '🛋️';
    btn.title = 'Restore Couch Nacho';
    btn.style.cssText = 'position:fixed;left:20px;bottom:140px;z-index:200001;width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#f7931a,#ea580c);border:2px solid rgba(255,255,255,0.3);color:#fff;font-size:1.5rem;display:none;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 15px rgba(247,147,26,0.4);transition:transform 0.2s,box-shadow 0.2s;touch-action:none;';
    if (window.innerWidth <= 900) {
        btn.style.left = '10px';
        btn.style.bottom = '100px';
        btn.style.width = '44px';
        btn.style.height = '44px';
        btn.style.fontSize = '1.3rem';
    }
    btn.onclick = function() { tctvRestoreCouch(); };
    document.body.appendChild(btn);
    _initCouchRestoreDrag(btn);
    return btn;
}

// Apply saved position to an element (couch or restore button)
function _applyCouchPosition(el) {
    try {
        var pos = JSON.parse(localStorage.getItem('tctv_couch_position') || '{}');
        if (pos.left !== undefined) el.style.left = pos.left + 'px';
        if (pos.bottom !== undefined) el.style.bottom = pos.bottom + 'px';
    } catch(e) {}
}

// Save couch/rest position
function _saveCouchPosition(el) {
    try {
        var left = parseFloat(el.style.left) || 0;
        var bottom = parseFloat(el.style.bottom) || 0;
        // Clamp to viewport bounds
        left = Math.max(0, Math.min(window.innerWidth - 60, left));
        bottom = Math.max(50, Math.min(window.innerHeight - 150, bottom));
        localStorage.setItem('tctv_couch_position', JSON.stringify({left: left, bottom: bottom}));
    } catch(e) {}
}

// Make restore button draggable (matching sprite nacho behavior)
function _initCouchRestoreDrag(btn) {
    var isDragging = false, startX, startY, startLeft, startBottom;
    var hasMoved = false;
    btn.addEventListener('pointerdown', function(e) {
        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = btn.offsetLeft;
        startBottom = parseFloat(btn.style.bottom) || (window.innerWidth <= 900 ? 100 : 140);
        btn.style.transition = 'none';
        btn.setPointerCapture(e.pointerId);
    });
    btn.addEventListener('pointermove', function(e) {
        if (!isDragging) return;
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
        var newLeft = startLeft + dx;
        var newBottom = startBottom - dy;
        // Clamp
        newLeft = Math.max(0, Math.min(window.innerWidth - 60, newLeft));
        newBottom = Math.max(50, Math.min(window.innerHeight - 150, newBottom));
        btn.style.left = newLeft + 'px';
        btn.style.bottom = newBottom + 'px';
    });
    btn.addEventListener('pointerup', function(e) {
        if (isDragging) {
            isDragging = false;
            btn.releasePointerCapture(e.pointerId);
            btn.style.transition = 'transform 0.2s, box-shadow 0.2s';
            _saveCouchPosition(btn);
        }
    });
    var clickHandler = function(e) {
        // Only fire if we didn't drag significantly
        if (hasMoved) return;
        tctvRestoreCouch();
    };
    // Use click event (separate from pointer events) for restoration
    btn.addEventListener('click', clickHandler);
}

window.tctvMinimizeAd = function() {
    var ad = document.getElementById('tctv-ad-sidebar-content');
    var adM = document.getElementById('tctv-ad-mobile-content');
    var btnD = document.getElementById('tctv-ad-restore-desktop');
    var btnM = document.getElementById('tctv-ad-restore-mobile');
    if (ad) ad.style.display = 'none';
    if (adM) adM.style.display = 'none';
    if (btnD) btnD.style.display = 'flex';
    if (btnM) btnM.style.display = 'flex';
    try { localStorage.setItem('tctv_ad_minimized', '1'); } catch(e) {}
};

window.tctvRestoreAd = function() {
    var ad = document.getElementById('tctv-ad-sidebar-content');
    var adM = document.getElementById('tctv-ad-mobile-content');
    var btnD = document.getElementById('tctv-ad-restore-desktop');
    var btnM = document.getElementById('tctv-ad-restore-mobile');
    if (ad) ad.style.display = 'block';
    if (adM) adM.style.display = 'block';
    if (btnD) btnD.style.display = 'none';
    if (btnM) btnM.style.display = 'none';
    try { localStorage.removeItem('tctv_ad_minimized'); } catch(e) {}
};

window.tctvCopyEmail = function() {
    var email = 'info.603btc@gmail.com';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(function() {
            if (typeof showToast === 'function') showToast('\u2709\ufe0f Email copied!');
        }).catch(function() {
            _tctvFallbackCopy(email);
        });
    } else {
        _tctvFallbackCopy(email);
    }
};
function _tctvFallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); if (typeof showToast === 'function') showToast('\u2709\ufe0f Email copied!'); }
    catch(e) { if (typeof showToast === 'function') showToast('Copy: ' + text); }
    document.body.removeChild(ta);
}

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

// Couch Nacho drag — only via the #couchNachoDragHandle button.
// Supports both touch (mobile) and mouse (desktop), with visual feedback
// while dragging. Matches sprite Nacho's drag-handle pattern.
(function() {
    var _dragging = false, _startX = 0, _startY = 0, _origLeft = 0, _origBottom = 0;

    function handleDown(clientX, clientY, e) {
        var couch = document.getElementById('nacho-couch');
        if (!couch || couch.style.display === 'none') return false;
        var handle = document.getElementById('couchNachoDragHandle');
        if (!handle || !handle.contains(e.target)) return false;
        _dragging = true;
        _startX = clientX;
        _startY = clientY;
        var rect = couch.getBoundingClientRect();
        _origLeft = rect.left;
        _origBottom = window.innerHeight - rect.bottom;
        couch.style.transition = 'none';
        couch.style.opacity = '0.85';
        handle.style.background = 'rgba(247,147,26,0.9)';
        handle.style.cursor = 'grabbing';
        var hs = handle.querySelector('span');
        if (hs) hs.style.color = '#fff';
        return true;
    }

    function handleMove(clientX, clientY) {
        if (!_dragging) return;
        var couch = document.getElementById('nacho-couch');
        if (!couch) return;
        var dx = clientX - _startX;
        var dy = clientY - _startY;
        couch.style.left = (_origLeft + dx) + 'px';
        couch.style.bottom = (_origBottom - dy) + 'px';
        couch.style.right = 'auto';
    }

    function handleUp() {
        if (!_dragging) return;
        _dragging = false;
        var couch = document.getElementById('nacho-couch');
        if (couch) {
            couch.style.transition = '0.3s';
            couch.style.opacity = '';
            _saveCouchPosition(couch);
        }
        var handle = document.getElementById('couchNachoDragHandle');
        if (handle) {
            handle.style.background = 'rgba(255,255,255,0.9)';
            handle.style.cursor = 'grab';
            var hs = handle.querySelector('span');
            if (hs) hs.style.color = '#888';
        }
    }

    // Touch
    document.addEventListener('touchstart', function(e) {
        if (handleDown(e.touches[0].clientX, e.touches[0].clientY, e)) {
            e.preventDefault();
        }
    }, { passive: false });
    document.addEventListener('touchmove', function(e) {
        if (!_dragging) return;
        e.preventDefault();
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    document.addEventListener('touchend', handleUp);
    document.addEventListener('touchcancel', handleUp);

    // Mouse
    document.addEventListener('mousedown', function(e) {
        if (handleDown(e.clientX, e.clientY, e)) {
            e.preventDefault();
        }
    });
    document.addEventListener('mousemove', function(e) {
        handleMove(e.clientX, e.clientY);
    });
    document.addEventListener('mouseup', handleUp);
})();

// ── Master UI Update Functions ──
// ── NOW PLAYING — Single Source of Truth ──
// All writes to the header go through _setNP(). State lives in this object;
// the DOM is a view of this state. Any stale write is impossible because
// _renderNP() always renders from _np, not from ad-hoc parameters.
var _np = { stationId: null, videoId: null, videoTitle: null };

function _renderNP() {
    var chEl = document.getElementById('tctv-now-ch');
    var npEl = document.getElementById('tctv-now-playing');
    if (!_np.stationId) {
        if (chEl) chEl.textContent = '';
        if (npEl) npEl.textContent = '';
        return;
    }
    var idx = STATIONS.findIndex(function(s) { return s.id === _np.stationId; });
    if (idx < 0) return;
    var station = STATIONS[idx];
    if (chEl) chEl.textContent = 'CH. ' + (idx + 1) + ' · ' + (station.emoji ? station.emoji + ' ' : '') + station.name;
    if (npEl) npEl.textContent = _np.videoTitle || (station.emoji + ' ' + station.name);
}

// Update state + re-render. Only triggers DOM writes when something changed.
// stationId: string (required), videoObj: { id, title } or null.
function _setNP(stationId, videoObj) {
    var videoId = videoObj ? videoObj.id : null;
    var videoTitle = videoObj ? videoObj.title : null;
    if (_np.stationId === stationId && _np.videoId === videoId && _np.videoTitle === videoTitle) return;
    _np.stationId = stationId;
    _np.videoId = videoId;
    _np.videoTitle = videoTitle;
    _renderNP();
}

window.syncPlayer = function() {
    if (!_currentStation) return;
    var station = STATIONS.find(function(s) { return s.id === _currentStation; });
    if (!station) return;
    var state = getPlaybackState(station);
    if (!state.video) return;

    // Clear paused state and hide sync button
    _isPaused = false;
    _updatePauseButtons(false);
    _showSyncButtons(false);

    // Update Header (single source of truth)
    _setNP(station.id, state.video);

    // Jump to live: reuse existing player when possible
    if (!_apiFailed && _ytPlayer && _ytPlayer.loadVideoById && _ytPlayer.playVideo) {
        _currentVideoId = state.video.id;
        try {
            _ytPlayer.loadVideoById(state.video.id, Math.floor(state.offset));
            _ytPlayer.playVideo();
        } catch(e) {
            loadVideo(state.video.id, state.offset);
        }
        _syncYTVolume();
    } else {
        loadVideo(state.video.id, state.offset);
    }
}

// ── Timeline & Moving EPG ──
function updateTimeline() {
    if (!_currentStation) return;
    var nowMs = Date.now();
    var station = STATIONS.find(function(s) { return s.id === _currentStation; });
    if (!station) return;
    var state = getPlaybackState(station);

    // Sync Header — only update title if station matches. Prevents old
    // station's video from showing during a switch.
    if (_np.stationId === _currentStation) {
        _setNP(_currentStation, state.video);
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

    // Periodic drift check (every ~3 seconds)
    if (!_isPaused) {
        if (!window._tctvLastDriftCheck || Date.now() - window._tctvLastDriftCheck > 3000) {
            window._tctvLastDriftCheck = Date.now();
            checkDrift();
        }
    }
}

function _renderEPG() {
    var now = new Date();
    var nowMs = now.getTime();
    var gridStartMs = nowMs - (60 * 60 * 1000);
    window._tctvGridStartMs = gridStartMs;

    var html = '<div id="tctv-epg-wrapper" style="padding:8px 0 0;">';
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

    html += '<div id="tctv-epg-container" style="flex:1;overflow-x:auto;overflow-y:hidden;position:relative;background:#0a0a0a;cursor:grab;-webkit-overflow-scrolling: touch;">';
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
    // Add body class so CSS can hide non-TCTV chrome on mobile (sign-up banner etc.)
    document.body.classList.add('tctv-active');
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
        /* Desktop & Tablet: Floating wide remote on the right edge */
        @media (min-width: 768px) {
            /* Hide sidebar ad (moved below channel list per user request) */
            #tctv-ad-sidebar { display: none !important; }
            /* Show the below-EPG ad on all screen sizes */
            #tctv-ad-mobile { display: block !important; }
            #tctv-remote-sidebar {
                position: fixed;
                right: 0;
                top: 15vh;
                z-index: 200000;
                display: block !important;
                flex: none !important;
                pointer-events: none;
            }
            #tctv-remote-sidebar > * { pointer-events: auto; }
            #tctv-remote { display: none !important; }
        }
        @media (max-width: 767px) {
            #tctv-ad-sidebar, #tctv-remote-sidebar { display: none !important; }
            #tctv-remote { display: flex !important; }
        }
        /* Style for the floating wide 160px remote (Desktop/Tablet) */
        #tctv-remote-inline {
            width: 160px;
            background: #222;
            border: 3px solid #111;
            border-radius: 20px 0 0 20px;
            padding: 14px 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8), inset 0 2px 5px rgba(255,255,255,0.1);
            display: flex;
            flex-direction: column;
            gap: 10px;
            align-items: center;
            transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        /* Collapsed: slide most of the remote off-screen. Leave a narrow 18px
           strip visible so the user can grab it via the drag handle. All other
           parts of the remote have pointer-events:none so they can't steal
           taps meant for the video (e.g. the YouTube fullscreen button). */
        #tctv-remote-inline.collapsed {
            transform: translateX(142px);
            opacity: 0.5;
            pointer-events: none;
        }
        /* Keep the drag handle tappable even when collapsed so the user can open the remote.
           Use ::before to extend the hit area without changing the visual size. */
        #tctv-remote-inline.collapsed > [onclick*="tctvToggleRemote"] {
            pointer-events: auto;
            cursor: pointer;
            position: relative;
        }
        #tctv-remote-inline.collapsed > [onclick*="tctvToggleRemote"]::before {
            content: '';
            position: absolute;
            top: -10px;
            bottom: -10px;
            left: -8px;
            right: -8px;
            /* invisible enlarged hit target around the small drag handle */
        }
        #tctv-remote-inline:not(.collapsed) { pointer-events: auto; }
        #tctv-remote-sidebar:hover #tctv-remote-inline,
        #tctv-remote-sidebar:focus-within #tctv-remote-inline {
            opacity: 1;
            transform: translateX(0);
            pointer-events: auto;
        }

        .remote-btn { width: 44px; height: 44px; border-radius: 50%; background: #333; border: 2px solid #444; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 0 #111; position: relative; }
        .remote-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #111; }
        .remote-btn.red { background: #dc2626; border-color: #ef4444; }
        .remote-btn.blue { background: #2563eb; border-color: #3b82f6; }
        .remote-label { font-size: 0.55rem; color: #666; font-weight: 800; margin-top: -8px; text-transform: uppercase; }
        .remote-input { width: 44px; padding: 4px; background: #111; border: 1px solid #444; border-radius: 6px; color: var(--accent); font-family: 'Courier New', monospace; font-weight: 800; font-size: 0.9rem; text-align: center; outline: none; }
        .remote-input:focus { border-color: var(--accent); box-shadow: 0 0 10px rgba(247,147,26,0.3); }
        #nacho-couch { position: fixed; left: 20px; bottom: 140px; z-index: 200000; pointer-events: none; transition: 0.5s; display: none; }
        #nacho-couch-restore { position: fixed; left: 20px; bottom: 140px; z-index: 200001; width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, #f7931a, #ea580c); border: 2px solid rgba(255,255,255,0.3); color: #fff; font-size: 1.5rem; display: none; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 15px rgba(247,147,26,0.4); transition: transform 0.2s, box-shadow 0.2s; touch-action: none; }
        #nacho-couch-restore:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(247,147,26,0.6); }
        @media (max-width: 767px) { #nacho-couch-restore { left: 10px; bottom: 100px; width: 44px; height: 44px; font-size: 1.3rem; } }
        @media (min-width: 768px) {
            #nacho-couch { display: block; }
        }
        /* Tablets and Laptops — Shrink video to leave vertical room for channel scrolling.
           Previously 66vh video + 33vh EPG = all 21 channels crammed into 33vh. Now the
           video is smaller and the page below scrolls naturally through the EPG. */
        @media (min-width: 768px) and (max-width: 1280px) { 
            .tctv-video-wrap { max-width: 900px !important; width: 100% !important; flex: 1 1 auto !important; margin: 0 auto !important; }
            /* Video: comfortable 45vh (was 66vh) — leaves room below for native page scroll */
            #tctv-video-container { 
                height: 45vh !important; 
                max-height: 45vh !important; 
                min-height: 320px !important; 
                border-radius: 12px !important; 
            }
            #tctv-player { height: 100% !important; max-height: 45vh !important; }
            /* Let the EPG flow naturally (native page scroll takes it from here) */
            #tctv-epg-wrapper { 
                height: auto !important; 
                max-height: none !important;
                min-height: auto !important;
                overflow: visible !important; 
                background: #0a0a0a !important;
                position: relative !important;
                z-index: 5 !important;
                margin-top: 10px !important;
            }
            #tctv-epg-container { height: auto !important; min-height: auto !important; }
        }
        /* Hide chrome that competes with TCTV on mobile (sign-up banner, user-display) */
        @media (max-width: 767px) {
            body.tctv-active #userDisplay,
            body.tctv-active #signinBanner,
            body.tctv-active .signin-banner { display: none !important; }
        }
        /* Mobile — horizontal in-flow remote bar below video (overrides the legacy fixed vertical style) */
        @media (max-width: 767px) {
            #tctv-remote {
                position: static !important;
                top: auto !important; right: auto !important;
                width: auto !important;
                flex-direction: row !important;
                flex-wrap: nowrap !important;
                overflow-x: auto !important;
                -webkit-overflow-scrolling: touch !important;
                padding: 8px 10px !important;
                gap: 6px !important;
                border-radius: 0 !important;
                border-width: 0 0 1px 0 !important;
                border-color: #222 !important;
                justify-content: center !important;
                align-items: center !important;
                box-shadow: none !important;
                transform: none !important;
            }
            #tctv-remote.collapsed { transform: none !important; opacity: 1 !important; }
        }
        /* Mobile — aggressive resizing for small screens. */
        @media (max-width: 767px) {
            #tctv-remote { padding: 4px 6px !important; gap: 4px !important; }
            .remote-btn { width: 32px !important; height: 32px !important; font-size: 0.8rem !important; }

            /* Video: Capped at 100% width to prevent horizontal scroll */
            #tctv-video-container {
                width: 100% !important;
                max-width: 100% !important;
                height: calc((100vh - 210px) * 0.62) !important;
                max-height: calc((100vh - 210px) * 0.62) !important;
                min-height: 200px !important;
            }
            #tctv-player { width: 100% !important; max-height: calc((100vh - 210px) * 0.62) !important; height: 100% !important; }

            /* EPG (channel guide): ~1/3 of remaining space, scrollable */
            #tctv-epg-wrapper {
                height: calc((100vh - 210px) * 0.36) !important;
                max-height: calc((100vh - 210px) * 0.36) !important;
                min-height: 140px !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                -webkit-overflow-scrolling: touch !important;
                background: #0a0a0a !important;
                position: relative !important;
                z-index: 5 !important;
                margin-top: 4px !important;
            }
            #tctv-epg-container { height: auto !important; min-height: 100% !important; }
        }
        /* Very short screens (landscape phones) — pull video down to keep EPG visible */
        @media (max-width: 768px) and (max-height: 600px) {
            #tctv-video-container { height: calc((100vh - 180px) * 0.6) !important; max-height: calc((100vh - 180px) * 0.6) !important; }
            #tctv-player { max-height: calc((100vh - 180px) * 0.6) !important; }
            #tctv-epg-wrapper { height: calc((100vh - 180px) * 0.38) !important; max-height: calc((100vh - 180px) * 0.38) !important; }
        }
        @keyframes nachoSway { 0%, 100% { transform: rotate(-1deg) translateY(0); } 50% { transform: rotate(1deg) translateY(-5px); } }
        @keyframes tctvGuideFade { from { opacity: 0; } to { opacity: 1; } }
    `;
    document.head.appendChild(style);

    var html = '<div style="background:#0a0a0a;min-height:100vh;color:#fff;font-family:inherit;width:100%;">';

    html += '<div style="position:sticky;top:0;z-index:200000;background:#0a0a0a;width:100%;"> ' +
            '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#111;border-bottom:1px solid rgba(247,147,26,0.3);width:100%;box-sizing:border-box;"><div onclick="goHome()" style="cursor:pointer;display:flex;align-items:center;gap:8px;"><span style="color:var(--text-muted);font-size:0.8rem;">←</span><span style="color:#f7931a;font-weight:900;font-size:1rem;letter-spacing:2px;">TIMECHAIN TV</span></div><div style="display:flex;align-items:center;gap:6px;"><span id="tctv-main-viewers" style="font-size:0.7rem;color:#22c55e;font-weight:600;"></span><span style="width:8px;height:8px;background:#ef4444;border-radius:50%;display:inline-block;box-shadow:0 0 6px #ef4444;"></span><span style="color:#ef4444;font-size:0.7rem;font-weight:800;letter-spacing:1px;">LIVE</span></div></div>';

    // Desktop: side-by-side layout with couch left, video center, wide remote right
    html += '<div style="display:flex;align-items:center;justify-content:center;gap:10px;background:#0a0a0a;padding:6px 10px;flex-wrap:wrap;">';
    var _tctvAdMinimized = false;
    try { _tctvAdMinimized = localStorage.getItem('tctv_ad_minimized') === '1'; } catch(e) {}
    // Left side - TCTV Ad (desktop only)
    html += '<div id="tctv-ad-sidebar" style="flex:0 0 auto;display:none;" class="desktop-only">' +
            '<div id="tctv-ad-sidebar-content" style="position:relative;width:140px;padding:12px;background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.15);border-radius:12px;text-align:center;' + (_tctvAdMinimized ? 'display:none;' : '') + '">' +
            '<button onclick="tctvMinimizeAd()" style="position:absolute;top:4px;right:4px;width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,0.08);border:1px solid #333;color:#666;font-size:0.6rem;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;" title="Minimize">\u2715</button>' +
            '<div style="font-size:1.5rem;margin-bottom:6px;">\ud83d\udcfa</div>' +
            '<div style="font-size:0.65rem;color:#ccc;font-weight:600;line-height:1.4;">Get your YouTube channel streaming on Timechain TV 24/7!</div>' +
            '<div style="margin-top:8px;font-size:0.6rem;color:#f7931a;font-weight:700;">Inquire at:</div>' +
            '<a href="mailto:info.603btc@gmail.com" style="font-size:0.55rem;color:#aaa;text-decoration:none;word-break:break-all;" onmouseover="this.style.color=\'#f7931a\'" onmouseout="this.style.color=\'#aaa\'">info.603btc@gmail.com</a>' +
            '<button onclick="tctvCopyEmail()" style="display:block;margin:8px auto 0;padding:4px 10px;background:rgba(247,147,26,0.15);border:1px solid rgba(247,147,26,0.3);border-radius:6px;color:#f7931a;font-size:0.55rem;font-weight:700;cursor:pointer;">\ud83d\udccb Copy Email</button>' +
            '</div>' +
            '<button id="tctv-ad-restore-desktop" onclick="tctvRestoreAd()" style="' + (_tctvAdMinimized ? 'display:flex;' : 'display:none;') + 'width:36px;height:36px;border-radius:50%;background:#1a1a1a;border:1px solid rgba(247,147,26,0.3);color:#f7931a;font-size:1.1rem;cursor:pointer;align-items:center;justify-content:center;margin:0 auto;" title="Show ad">\ud83d\udcfa</button>' +
            '</div>';
    // Center - Video player (takes full center/right area, fixed remote floats on top)
    html += '<div style="flex:1 1 auto;min-width:0;width:100%;max-width:1100px;" class="tctv-video-wrap">' +
            '<div style="position:relative;aspect-ratio:16/9;max-height:55vh;width:100%;margin:0 auto;background:#000;overflow:hidden;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.5);" id="tctv-video-container">' +
            '<div id="tctv-sync-btn" style="position:absolute;bottom:20px;left:20px;display:none;z-index:6;">' +
                '<button onclick="syncPlayer()" style="background:#f7931a;color:#000;border:none;padding:8px 16px;border-radius:20px;font-weight:900;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.5);">⚡ JUMP TO LIVE</button>' +
            '</div>' +
            '<div id="tctv-player"></div>' +
            '</div></div>';
    // Sidebar Remote (Fixed to edge via CSS above)
    html += '<div id="tctv-remote-sidebar">' +
            '<div id="tctv-remote-inline" class="collapsed">' +
            '<div onclick="tctvToggleRemote()" style="width:40px;height:5px;background:#444;border-radius:3px;cursor:pointer;"></div>' +
            // Top row: PWR + GUIDE
            '<div style="display:flex;gap:12px;align-items:flex-start;justify-content:center;width:100%;">' +
                '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
                    '<button class="remote-btn red" onclick="goHome()" id="remote-pwr-btn-inline" title="Power OFF">⏻</button>' +
                    '<span class="remote-label">PWR</span>' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
                    '<button class="remote-btn" style="background:#f7931a;border-color:#fbbf24;font-size:0.95rem;font-weight:900;color:#111;" onclick="tctvOpenGuide()" title="Channel Guide">☰</button>' +
                    '<span class="remote-label">GUIDE</span>' +
                '</div>' +
            '</div>' +
            // CH and VOL side-by-side
            '<div style="display:flex;gap:8px;align-items:flex-start;justify-content:center;width:100%;">' +
                '<div style="background:#1a1a1a;border-radius:12px;padding:8px 4px;display:flex;flex-direction:column;gap:8px;align-items:center;">' +
                    '<button class="remote-btn" onclick="tctvRemoteChannel(1)">▲</button>' +
                    '<input type="text" id="remote-ch-input-inline" class="remote-input" style="width:44px;padding:3px;font-size:0.75rem;" placeholder="#" maxlength="2" inputmode="numeric" title="Type 1-21 and hit Enter" onkeydown="if(event.key===\'Enter\')tctvDirectChannel(this.value)">' +
                    '<button class="remote-btn" onclick="tctvRemoteChannel(-1)">▼</button>' +
                    '<span class="remote-label" style="margin:0">CH</span>' +
                '</div>' +
                '<div style="background:#1a1a1a;border-radius:12px;padding:8px 4px;display:flex;flex-direction:column;gap:8px;align-items:center;">' +
                    '<button class="remote-btn" onclick="tctvRemoteVolume(1)">▲</button>' +
                    '<button class="remote-btn" id="remote-mute-btn-inline" onclick="tctvRemoteMute()" title="Mute" style="font-size:1rem;">\ud83d\udd08</button>' +
                    '<button class="remote-btn" onclick="tctvRemoteVolume(-1)">▼</button>' +
                    '<span class="remote-label" style="margin:0">VOL</span>' +
                '</div>' +
            '</div>' +
            // Bottom row: PLAY + BACK side-by-side
            '<div style="display:flex;gap:10px;align-items:center;justify-content:center;width:100%;margin-top:2px;">' +
                '<button class="remote-btn blue" style="border-radius:10px;font-size:1.1rem;" onclick="tctvRemotePause()" id="remote-pause-btn-inline" title="Pause/Play">⏸</button>' +
                '<button class="remote-btn blue" style="border-radius:10px;font-size:0.7rem;font-weight:900;" onclick="tctvRemoteBack()">BACK</button>' +
            '</div>' +
            '</div></div>';
    html += '</div>';
    html += '<div style="padding:10px 16px;background:#161616;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center;"><div style="flex:1;min-width:0;"><div style="font-size:0.65rem;color:#f7931a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">NOW PLAYING <span id="tctv-now-ch" style="color:#aaa;"></span></div><div id="tctv-now-playing" style="font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#ddd;">Loading...</div></div>' +
            '<div style="display:flex;align-items:center;gap:8px;"><div id="tctv-time-left" style="font-size:0.75rem;color:#888;font-weight:600;flex-shrink:0;font-variant-numeric:tabular-nums;"></div></div></div>';
    html += '<div style="height:3px;background:#222;"><div id="tctv-progress" style="height:100%;background:#f7931a;width:0%;transition:width 1s linear;"></div></div>';

    // Mobile Remote - horizontal bar below video/progress, inside sticky header
    html += '<div id="tctv-remote">' +
            '<button class="remote-btn red" style="border-radius:8px;width:32px;height:32px;font-size:0.9rem;" onclick="goHome()" id="remote-pwr-btn" title="Power OFF">\u23fb</button>' +
            '<button class="remote-btn" style="border-radius:8px;background:#f7931a;border-color:#fbbf24;color:#111;font-weight:900;font-size:0.9rem;" onclick="tctvOpenGuide()" title="Channel Guide">\u2630</button>' +
            '<button class="remote-btn" style="border-radius:8px;" onclick="tctvRemoteChannel(1)">CH\u25b2</button>' +
            '<button class="remote-btn" style="border-radius:8px;" onclick="tctvRemoteChannel(-1)">CH\u25bc</button>' +
            '<input type="text" id="remote-ch-input" class="remote-input" placeholder="#" maxlength="2" onkeydown="if(event.key===\'Enter\')tctvDirectChannel(this.value)" inputmode="numeric">' +
            '<button class="remote-btn" style="border-radius:8px;" onclick="tctvRemoteVolume(1)">\ud83d\udd0a</button>' +
            '<button class="remote-btn" style="border-radius:8px;" onclick="tctvRemoteVolume(-1)">\ud83d\udd09</button>' +
            '<button class="remote-btn" id="remote-mute-btn" style="border-radius:8px;" onclick="tctvRemoteMute()" title="Mute">\ud83d\udd08</button>' +
            '<button class="remote-btn blue" style="border-radius:8px;font-size:0.9rem;" onclick="tctvRemotePause()" id="remote-pause-btn" title="Pause/Play">\u23f8</button>' +
            '<button class="remote-btn blue" style="border-radius:8px;font-size:0.6rem;font-weight:900;" onclick="tctvRemoteBack()">BACK</button>' +
            '</div>';

    html += '</div>'; // end sticky header

    // Couch Nacho (floating, draggable) — dynamic bubble updates every 3-5 min with
    // station-aware commentary driven by _tctvCouchTick (below).
    html += '<div id="nacho-couch">' +
            '<div id="nacho-couch-inner" style="position:relative;width:240px;height:140px;display:flex;align-items:center;justify-content:center;pointer-events:auto;">' +
            '<span style="font-size:7rem;position:absolute;bottom:0;filter:drop-shadow(0 10px 20px rgba(0,0,0,0.5));">\ud83d\udecb\ufe0f</span>' +
            '<div style="position:absolute;bottom:35px;left:70px;transition:0.3s;animation:nachoSway 4s ease-in-out infinite;">' +
            '<img src="nacho-deer.svg" style="width:75px;height:75px;">' +
            '<span style="position:absolute;bottom:0;right:-4px;font-size:2rem;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3));">\ud83c\udf7f</span>' +
            '<div id="couch-nacho-bubble" style="position:absolute;top:-32px;right:-40px;min-width:90px;max-width:200px;background:white;color:#111;padding:6px 11px;border-radius:14px;font-size:0.7rem;font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,0.35);white-space:normal;line-height:1.35;text-align:center;transition:opacity 0.3s ease, transform 0.3s ease;opacity:1;transform:translateY(0);">Chill vibes... \ud83d\udcfa\ud83c\udf7f</div>' +
            '</div>' +
            '<button onclick="tctvToggleCouch()" style="position:absolute;top:-8px;right:-8px;width:24px;height:24px;border-radius:50%;background:#333;border:1px solid #555;color:#aaa;font-size:0.7rem;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5;">\u2715</button>' +
            '<div id="couchNachoDragHandle" style="position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:40px;height:16px;background:rgba(255,255,255,0.9);border:1.5px solid rgba(247,147,26,0.5);border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:grab;z-index:6;touch-action:none;-webkit-touch-callout:none;box-shadow:0 2px 6px rgba(0,0,0,0.4);" title="Drag to move Nacho"><span style="font-size:0.6rem;color:#888;pointer-events:none;letter-spacing:1px;">\u283f</span></div>' +
            '</div></div>';

    html += _renderEPG();
    // Ad below channel guide (all devices, minimizable)
    html += '<div id="tctv-ad-mobile" style="margin:24px auto 16px;max-width:380px;text-align:center;">' +
        '<div id="tctv-ad-mobile-content" style="padding:14px 18px;background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.15);border-radius:12px;position:relative;' + (_tctvAdMinimized ? 'display:none;' : '') + '">' +
            '<button onclick="tctvMinimizeAd()" style="position:absolute;top:6px;right:8px;width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,0.08);border:1px solid #333;color:#666;font-size:0.6rem;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;" title="Minimize">\u2715</button>' +
            '<div style="font-size:1.3rem;margin-bottom:4px;">\ud83d\udcfa</div>' +
            '<div style="font-size:0.7rem;color:#ccc;font-weight:600;line-height:1.4;">Get your YouTube channel streaming on Timechain TV 24/7!</div>' +
            '<div style="margin-top:8px;font-size:0.6rem;color:#f7931a;font-weight:700;">Inquire at:</div>' +
            '<a href="mailto:info.603btc@gmail.com" style="display:inline-block;margin-top:4px;font-size:0.65rem;color:#aaa;text-decoration:none;font-weight:700;">info.603btc@gmail.com</a>' +
            '<button onclick="tctvCopyEmail()" style="display:block;margin:8px auto 0;padding:5px 14px;background:rgba(247,147,26,0.15);border:1px solid rgba(247,147,26,0.3);border-radius:6px;color:#f7931a;font-size:0.65rem;font-weight:700;cursor:pointer;">\ud83d\udccb Copy Email</button>' +
        '</div>' +
        '<button id="tctv-ad-restore-mobile" onclick="tctvRestoreAd()" style="' + (_tctvAdMinimized ? 'display:flex;' : 'display:none;') + 'width:36px;height:36px;border-radius:50%;background:#1a1a1a;border:1px solid rgba(247,147,26,0.3);color:#f7931a;font-size:1.1rem;cursor:pointer;align-items:center;justify-content:center;margin:8px auto;" title="Show ad">\ud83d\udcfa</button>' +
        '</div>';
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

    // Initial station switch (population of DOM)
    switchStation(activeStation, true);

    if (_syncInterval) clearInterval(_syncInterval);
    _syncInterval = setInterval(updateTimeline, 1000);

    // Start Nacho reactions
    if (typeof startTctvReactions === 'function') startTctvReactions();

    // Restore couch nacho collapse state (if previously collapsed)
    (function() {
        try {
            var wasCollapsed = localStorage.getItem('tctv_couch_collapsed') === '1';
            if (wasCollapsed) {
                var couch = document.getElementById('nacho-couch');
                if (couch) couch.style.display = 'none';
                _ensureCouchRestoreBtn();
                var restoreBtn = document.getElementById('nacho-couch-restore');
                if (restoreBtn) {
                    _applyCouchPosition(restoreBtn);
                    restoreBtn.style.display = 'flex';
                }
            }
        } catch(e) {}
    })();

    // Ensure we are tracked as the current "channel" for the system's scroll/back logic
    window.currentChannelId = 'timechain-tv';
};

window.switchStation = function(stationId, forceUpdate) {
    if (stationId === _currentStation && !forceUpdate) return;
    
    _lastStation = _currentStation;
    var stationObj = STATIONS.find(function(s) { return s.id === stationId; });
    if (!stationObj) return;

    var state = null;
    try { state = getPlaybackState(stationObj); } catch(e) {}
    
    // Commit new station + NOW PLAYING in one synchronous block.
    // After this line, _currentStation and _np.stationId are in lockstep.
    _currentStation = stationId;
    _setNP(stationId, state && state.video ? state.video : null);

    showChannelNoise(stationObj.emoji + ' ' + stationObj.name);
    saveStation(stationId);
    joinStation(stationId);

    if (state && state.video) {
        loadVideo(state.video.id, state.offset);
        setTimeout(function() { _syncYTVolume(); }, 200);
    }

    // Sidebar highlight
    document.querySelectorAll('[data-station-id]').forEach(function(el) {
        var isActive = el.getAttribute('data-station-id') === stationId;
        el.style.background = isActive ? 'rgba(247,147,26,0.12)' : 'transparent';
        var nameEl = el.querySelector('[data-ch-name]');
        if (nameEl) nameEl.style.color = isActive ? '#f7931a' : '#ccc';
    });

    if (typeof window.nachoPlaySound === 'function') window.nachoPlaySound('tctv-beep');

    // Couch Nacho reacts to the channel change (after a short beat for the noise overlay)
    setTimeout(function() { try { _couchReactToStationChange(); } catch(e) {} }, 1500);

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
// ---- Couch-Nacho station commentary ----
// Per-station lines (picked randomly, padded with generic lines).
var _TCTV_STATION_LINES = {
    'art-philosophy': [
        "Orange pixels make the best portraits. 🎨",
        "Philosophy + Bitcoin = time well spent. 🤔",
        "Art on a timechain? Lindy already. 🧊"
    ],
    'conferences-events': [
        "Imagine being in that crowd. 👋",
        "Conference season is like Bitcoin summer. ☀️",
        "Hands up if you've hugged a stranger over orange coin. 🤗"
    ],
    'culture-travel': [
        "Everywhere I go, sats follow. 🌍⚡",
        "El Salvador was just the beginning. 🍊",
        "Nomad-core but with a cold card. 🌊"
    ],
    'dev-privacy-nodes': [
        "Run your node. Don't trust, verify. 🔒",
        "Devs shipping while fiat crumbles. 🛠️",
        "Coinjoin, tor, your own relay — chef's kiss. 👩‍🍳"
    ],
    'economics-money': [
        "Printer goes brrrr, Bitcoin stays fixed. 💵→💰",
        "Sound money hits different. 🔔",
        "Austrian Twitter is eating good tonight. 🤨"
    ],
    'freedom-sovereignty': [
        "12 words. 12 superpowers. 🗝",
        "Your keys. Your future. 👑",
        "Permissionless = priceless. 🔓"
    ],
    'health-fitness': [
        "Low time preference = long time horizon. 🏃",
        "Gym today. Sats tomorrow. 💪",
        "Steak, sunshine, stacking. 🥩☀️₿"
    ],
    'history': [
        "Every cycle teaches the same lesson. 📚",
        "We're early. Still. 🕰️",
        "Satoshi dropped this on us and dipped. 👻",
        "Popcorn time. 🍿",
        "Hard Money. Banking on Bitcoin. The classics. 🎬"
    ],
    'kids-family': [
        "Future gen stacking from day one. ❤️₿",
        "Kids get Bitcoin faster than adults. 🚀",
        "Orange pill for the whole family. 👨‍👩‍👧‍👦"
    ],
    'lightning': [
        "Zap zap zap ⚡⚡⚡",
        "Instant, nearly-free, global. 🌐",
        "Once you Lightning, you can't go back. 🚨"
    ],
    'memes-comedy': [
        "Have fun staying poor. 😂",
        "Memes are a load-bearing asset class. 💀",
        "Bitcoin humor >>> shitcoin copium. 😄"
    ],
    'mining': [
        "Hashrate looks beefy today. 🌋",
        "ASICs go brrrr — SHA-256 for days. 🔥",
        "Proof-of-Work = proof this matters. ⛏️"
    ],
    'music': [
        "This beat has hyperbitcoinized my ears. 🎵",
        "Play it again. 🎶",
        "Bitcoin has the best soundtrack in finance. 🎧"
    ],
    'news': [
        "Another day, another adoption milestone. 📰",
        "Boomers are starting to get it. 😅",
        "Bullish as hell. 📈"
    ],
    'orange-pill': [
        "Orange pilled = forever changed. 🍊💊",
        "Someone is getting this today. 🙌",
        "The pill has no expiration date. ⏳"
    ],
    'podcasts-debates': [
        "Bring the headphones next time. 🎧",
        "Great debate energy tonight. 👀",
        "Ideas sharpen on other ideas. ⚔️",
        "Recorded X Spaces — conversations that used to disappear. 🕊️",
        "Saylor, Cuban, Nic Carter. Pull up a chair. 📣"
    ],
    'politics-regulation': [
        "Nobody can ban math. ✋",
        "Bitcoin is apolitical but deeply political. 🏛️",
        "Fix the money, fix the world. 🔧"
    ],
    'saylor': [
        "Saylor really knows how to channel that energy! ⚡",
        "Laser eyes activated. 👁️⚡",
        "Hope is not a strategy — but Bitcoin is. 🙏"
    ],
    'future-predictions': [
        "Number go up is a feature, not a bug. 📈",
        "Trading is hard. Stacking is easy. 🍹",
        "Bitcoin→∞, fiat→0. ✨"
    ],
    'tutorials': [
        "Self-custody is a skill. Learn it. 🔑",
        "Take notes. Screenshot. Practice. 📝",
        "One step. One sat. One at a time. 👣"
    ],
    'ai-nostr': [
        "Notes by relays signed by keys. The new web. 🔑",
        "Zap a stranger today. ⚡",
        "Censorship-resistant social. Finally. 🔊",
        "AI agents paying each other in sats. The future is weird. 🤖⚡",
        "Damus, Primal, Amethyst — your home server is your phone. 📱"
    ]
};
var _TCTV_GENERIC_LINES = [
    "Mmm... freshly popped corn and Bitcoin knowledge! ⚡",
    "Proof of Steak? I prefer Proof of Popcorn! 🥩🍿",
    "Timechain TV is my love language. 📺💕",
    "Couldn't look away if I tried. 👀",
    "Bitcoin never sleeps — and apparently neither do I. 😴",
    "10 minutes in, another 10 pts in the bag. 💰",
    "Orange-pilled and cozied up. 🧡🛋️",
    "Every block a gift. 📦",
    "This show. These stats. Perfect combo. 🧑‍🍳",
    "Pleb life is the good life. 🦌"
];

function _showCouchBubble(text) {
    var b = document.getElementById('couch-nacho-bubble');
    if (!b) return;
    // Fade out, swap text, fade in
    b.style.opacity = '0';
    b.style.transform = 'translateY(-6px)';
    setTimeout(function() {
        b.textContent = text;
        b.style.opacity = '1';
        b.style.transform = 'translateY(0)';
    }, 280);
}

function _pickCouchLine() {
    var s = STATIONS.find(function(st) { return st.id === _currentStation; });
    if (!s) return _TCTV_GENERIC_LINES[Math.floor(Math.random() * _TCTV_GENERIC_LINES.length)];
    var stationLines = _TCTV_STATION_LINES[s.id] || [];
    // 65% chance station-specific, 35% generic, so it stays fresh
    var pool = (stationLines.length && Math.random() < 0.65) ? stationLines : _TCTV_GENERIC_LINES;
    return pool[Math.floor(Math.random() * pool.length)];
}

function _tctvIsActive() {
    // TCTV is active if we're on the TCTV route OR the player element exists in DOM
    return (window.currentChannelId === 'timechain-tv')
        || !!document.getElementById('tctv-player')
        || !!window._tctvActive;
}

function _scheduleNextCouchTick() {
    // Random 3-5 minutes
    var delay = 180000 + Math.floor(Math.random() * 120000);
    _tctvReactionInterval = setTimeout(function() {
        if (!_tctvIsActive()) return;
        // Don't talk over the user if the couch itself is hidden
        var couch = document.getElementById('nacho-couch');
        if (!couch || couch.style.display === 'none') {
            _scheduleNextCouchTick();
            return;
        }
        _showCouchBubble(_pickCouchLine());
        _scheduleNextCouchTick();
    }, delay);
}

function startTctvReactions() {
    if (_tctvReactionInterval) {
        try { clearTimeout(_tctvReactionInterval); } catch(e) {}
        try { clearInterval(_tctvReactionInterval); } catch(e) {}
    }
    // Greet on entry (10-30s after enter), then every 3-5 min
    setTimeout(function() {
        if (!_tctvIsActive()) return;
        var couch = document.getElementById('nacho-couch');
        if (couch && couch.style.display !== 'none') {
            _showCouchBubble(_pickCouchLine());
        }
    }, 12000 + Math.floor(Math.random() * 18000));
    _scheduleNextCouchTick();
}

// Refresh the couch bubble when the user switches channels (immediate feedback)
function _couchReactToStationChange() {
    if (!_tctvIsActive()) return;
    var couch = document.getElementById('nacho-couch');
    if (!couch || couch.style.display === 'none') return;
    _showCouchBubble(_pickCouchLine());
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
    if (_tctvReactionInterval) {
        try { clearInterval(_tctvReactionInterval); } catch(e) {}
        try { clearTimeout(_tctvReactionInterval); } catch(e) {}
        _tctvReactionInterval = null;
    }
    if (_viewerUnsub) { _viewerUnsub(); _viewerUnsub = null; }
    var iframe = document.getElementById('tctv-player');
    if (iframe) iframe.src = '';
    _currentVideoId = null;
    _np = { stationId: null, videoId: null, videoTitle: null };
    window._tctvActive = false;
    document.body.classList.remove('tctv-active');
    var s = document.getElementById('tctv-remote-styles');
    if (s) s.remove();
    if (typeof _tctvRestoreSpriteNacho === 'function') _tctvRestoreSpriteNacho();
    // Remove tooltip if lingering
    var tip = document.getElementById('tctv-epg-tooltip');
    if (tip) tip.remove();
};

})();
