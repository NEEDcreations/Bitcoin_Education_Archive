
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
                {"id":"2qBsSP6a2z4","title":"Playing around on the new Damus App! (Decentralized Twitter Clone for Nostr)","duration":233},
                {"id":"Ybe09ImCnvk","title":"Edward Snowden and Jack Dorsey on Nostr","duration":4793},
                {"id":"Vw3i2LeVa_Y","title":"An Intro to TBD's Web5 and Decentralized Web Nodes","duration":3307},
                {"id":"v8CQN8nK3gs","title":"Web5: An open source decentralised web platform","duration":1994},
                {"id":"uHv9T7Fv2ts","title":"Will Web5 Be a Web3 Killer? Jack Dorsey's TBD Project Explained Simply","duration":424},
                {"id":"wdz4wJeYkdI","title":"Web5 : Will it truly decentralise the internet?","duration":203},
                {"id":"WtXhsFD2PjU","title":"Web5: True Decentralization Or Marketing Gimmick?","duration":1251},
                {"id":"lQU3ES-3i2I","title":"Day 442 - What is Jack Dorsey and TBD's Web5, ION and tbDEX?  We explain.","duration":1659},
                {"id":"wMH64rshd6c","title":"Is Web5 Already Here?","duration":212},
                {"id":"TG56gKl84kE","title":"Web5 Explained in Under 3 Minutes","duration":174},
                {"id":"fK1f-Bis4gU","title":"What is Web5? Jack Dorsey comes out with Web5 (Web3 Killer?) | Ali Solanki","duration":233},
                {"id":"0OiZY1MRHXo","title":"GUDNUF | NOSTR WALLET CONNECT | NOSTR WORKSHOPS | BITBLOCKBOOM 2024","duration":2674},
                {"id":"RlS-f7eWuF8","title":"Did Bitcoin Front-Run the Iran War Panic?","duration":98},
                {"id":"3oLP0mRB6yI","title":"Jack Dorsey Reveals Bitcoin-Based WEB5","duration":515},
                {"id":"-EhXdsJr8Hw","title":"NOSTR Explained for Beginners ⚡️✨","duration":1429},
                {"id":"fG1IDm-lQek","title":"Damus For NOSTR - Tutorial","duration":3672},
                {"id":"VrHoprrAops","title":"How to Earn Bitcoin on Nostr with Primal (from Day 1) #bitcoin #nostr #primal #socialmedia","duration":369},
                {"id":"-9IoQCeCaqU","title":"How to receive nostr zaps to your own node - Voltage Nostr toolkit walkthrough","duration":317},
                {"id":"x2M9d-Qg6xs","title":"[log 00003] Damus Web - A Nostr Client","duration":470},
                {"id":"1HfcS7Cxnwo","title":"What is Jack Dorsey's Web5? | The Tech Whisperer | Jaspreetbindra","duration":133},
                {"id":"lcBPUqGwl24","title":"What Did People Think About Bitcoin In 2022?","duration":60},
                {"id":"kqR_IQfKic8","title":"NOSTR vs Tech Monopolies, the Future of Social Media & Primal 2.0 - MILJAN (THE Bitcoin Podcast)","duration":6436},
                {"id":"Ytdr34GF-sc","title":"Web5: The Future of the Internet BEYOND Web3!","duration":849},
                {"id":"exDH4s6ikJ0","title":"What is WEB5? WEB5 Explained For Beginners!","duration":568},
                {"id":"nusKpnFr3IY","title":"\\\"Exploring Web 5.0: The Next Evolution of the Internet\\\" #Web5.0 #searchslabs #virtualblockchain","duration":612},
                {"id":"fEXa-dBClN0","title":"Is This the New Industrial Revolution? AI, NOSTR & Bitcoin Lightning | Roland from Alby Hub","duration":3666},
                {"id":"TarmfsQK-oI","title":"Primal, the Bitcoin Powered Social Network Built on Nostr. Full Tutorial!","duration":800},
                {"id":"zteh-aHb4cM","title":"WATCH This Before Starting Nostr (Safety and Privacy Tips!!)","duration":434},
                {"id":"NVm_jGdwTjQ","title":"Nostr for Beginners w/ Derek Ross","duration":2243},
                {"id":"M9c5CI3-4FM","title":"Beginner's Guide to DIF & Google's Web5 Community Node","duration":3544},
                {"id":"S6y2Vy2N9oY","title":"NOSTR TOOLKIT: Linking To Your Own Lightning Node With Voltage","duration":4370},
                {"id":"J6I-OzXItfA","title":"Jack Dorsey Explains Bitcoin To Michael Saylor","duration":125},
                {"id":"XoGntcN5mh0","title":"When This Goes Viral, It's Too Late (Nostr 2025 Guide) - Miljan Braticevic","duration":5348},
                {"id":"WzTeiQ9U9bU","title":"Web5: Open to Build - Block/TBD","duration":3328},
                {"id":"RGSK993C-Ag","title":"Web5 The Decentralized Web Platform","duration":1971},
                {"id":"p9UkCmhafkk","title":"What is web5? The future of Social media........","duration":232},
                {"id":"qiVzn9ADHq0","title":"billionaire Jack Dorsey is going ALL IN on Bitcoin 👀","duration":61},
                {"id":"8GhEezzto4Y","title":"Nostr: Decentralized Social Media & Bitcoin w/ William Casarin (BTC111)","duration":3011},
                {"id":"20rTKJLtnCY","title":"Bitcoin, Web3, and Web5","duration":643},
                {"id":"zIN1ggt5ATg","title":"Jack Dorsey's Bitcoin project TBD plan to trademark 'Web5'","duration":66},
                {"id":"0BvU0nC2BcM","title":"Web5 - A simplified look into becoming a walking Human API #web5","duration":268},
                {"id":"FENW6p3giNk","title":"How Jack Dorsey's TBD is Building a Web5 Toolkit for the Future","duration":273},
                {"id":"HDZWWFSZUF0","title":"Web5... The Web3 Killer?","duration":140},
                {"id":"4kOBPE63eUc","title":"Quick start with Web5.js","duration":1123},
                {"id":"qn-Zp491t4Y","title":"How To Use NOSTR - A Decentralized Censorship Resistant Social Layer","duration":4433},
                {"id":"MkAutSzZPlw","title":"Pay DID Web5 Demo","duration":275},
                {"id":"arrswch0a1E","title":"Damus app - Nostr client - what is it & how it works? FULL OVERVIEW","duration":735},
                {"id":"zzUXjkweZ6k","title":"did you know this? #bitcoin","duration":61},
                {"id":"3vbwkTVuf6w","title":"CONTENT CREATORS: Why YOU Should Use #Nostr & How to Build a BIG Audience - JEFF BOOTH","duration":399},
                {"id":"HrZE4kj9ZhY","title":"NOSTR vs Twitter: What's the Difference?","duration":179},
                {"id":"lwbUwl8cNAI","title":"Did The Bible Warn Us About Bitcoin?","duration":943},
                {"id":"aOWemFCAI-c","title":"web3 and web5 Bitcoin All Market Web 2022 #web3 #web5ngay #bitcoin #crypto #cryptoupdate","duration":633},
                {"id":"zxkaUxzr4xY","title":"What Nostr Brings to Bitcoin","duration":1308},
                {"id":"Czkv54pQfTI","title":"How To Get Started With Nostr","duration":415},
                {"id":"TbeTU5JH5ps","title":"TrustXchange: Web5 Decentralized Finance and Identity Application","duration":292},
                {"id":"Opio9Ny8HT8","title":"Apple to REMOVE Nostr Client from App Store #bitcoin #nostr #shorts","duration":61},
                {"id":"AbbBHntSypI","title":"Issue Verifiable Credentials With Web5","duration":4051},
                {"id":"UubHnejeG44","title":"Jack Dorsey and Bitcoin","duration":466},
                {"id":"F-CANNnJ76M","title":"Jack Dorsey's Bitcoin Vision Just Became Real #bitcoin #square","duration":84},
                {"id":"BY2t8skbsDE","title":"Beginners: Multi-User Web5 App Tutorial","duration":4180},
                {"id":"yIccRIEr2gQ","title":"Nostr Explained Visually for Beginners","duration":985},
                {"id":"PWKd9aoZ-Cg","title":"The Past & Future Of DMs And Private Group Chats On Nostr","duration":1782},
                {"id":"oN5cB5ACC-8","title":"How to Query DWN Records by Tags | Web5 in 5","duration":257},
                {"id":"heJ5Iw_UpD8","title":"Primal Crash Course","duration":275},
                {"id":"3Xt4GzPg7w8","title":"Ex Twitter CEO Jack Dorsey discusses BITCOIN with Joe Rogan","duration":347},
                {"id":"Z0e4bl4MEcY","title":"Jack Dorsey's Stablecoin Bet  Bitcoin's Future or Capitulation","duration":124},
                {"id":"xUFMzQYM2AE","title":"The Next Internet Revolution: Decentralized AI Networks and Web5","duration":453},
                {"id":"9PoA9327sXU","title":"WTF is Web5 & Other Unknowable Mysteries | Web3 Anarchy","duration":2048},
                {"id":"JQFDlCqAAME","title":"TBD & Web5 Thoughts (June 14th)","duration":105},
                {"id":"QrzHD5z9p1s","title":"Web5: An Open Source Trust Layer for the Web - Angie Jones, TBD (a business unit of Block)","duration":1623},
                {"id":"Kuqs4bYGEEk","title":"Nostr Start Guide for Beginners | Account setup & wallet connect for Zaps","duration":1132},
                {"id":"NrUnJAovloQ","title":"Primal's Approach to Nostr","duration":2095},
                {"id":"bSyETtbViOk","title":"Dylan LeClair On Bitcoin, Nostr, Ordinals, Regulation, & The Fed","duration":2250},
                {"id":"2wAVyId6QHc","title":"Tutorial: Building a Decentralized Todo App with Web5","duration":665},
                {"id":"GmZalQuQoIM","title":"Farida Nabourema / Lyn Alden / Alex Gladstein / Jack Dorsey at Bitcoin Atlantis 2024","duration":3182},
                {"id":"qUwXRDrfJU0","title":"ODELL X JACK: ALL CAPS FIRESIDE","duration":3241},
                {"id":"R_KTRRlZ-7c","title":"Web5 Open to Build - Bitcoin 2023","duration":1071},
                {"id":"r7ntlxEvVQ8","title":"Build a Decentralized Blog with Web5","duration":3087},
                {"id":"Q6f6bdKWqF8","title":"Nostr Explained! The Social Network That Can't Be CENSORED!","duration":545},
                {"id":"47Q8jhuUSnA","title":"What Peter Did (Bitcoin Talk with Peter McCormack on THE Bitcoin Podcast)","duration":5310},
                {"id":"0e-e4HlPXlg","title":"WHAT IS WEB5 ?? WHY JACK DORSEY ANNOUNCED WEB5?? WILL IT REPLACE WEB 3.0??","duration":424},
                {"id":"LNJ4qSyxDqY","title":"Building NOSTR with Damus & Zaps Creator Will Casarin (BWP57)","duration":4669},
                {"id":"8XX8AgXnY2I","title":"Web5 Protocols with Roles","duration":825},
                {"id":"-MY5sB1_GnY","title":"Web5 the Bitcoin based internet","duration":705},
                {"id":"XUsk7cqZyKU","title":"Nostr Past, Present, and Future","duration":2881},
                {"id":"KgZYtsj9-V0","title":"Meet Web5","duration":86},
                {"id":"w9ASjv7xiWk","title":"WEB5: AN EXTRA DECENTRALIZED WEB PLATFORM","duration":460},
                {"id":"IyVgilv_hzY","title":"Jack Dorsey Introduces Web5","duration":1323},
                {"id":"HPsp4fa5jY8","title":"Web5 and Bitcoin: The Future is Here","duration":1049},
                {"id":"MWNs-KeoH6k","title":"En route to unpacking web5 technologies.","duration":86},
                {"id":"Eu0rNhmENXQ","title":"NOSTR Workshop w/Sebastian Hagens (Sebastix)","duration":1809},
                {"id":"gLV8i8KtkfI","title":"S15 E21: Fiatjaf on Nostr, Drivechains & Why Lightning Sucks","duration":6880},
                {"id":"4ZvowA1d7dE","title":"Web5 - Beginners Workshop: 'Mean Girls' Application","duration":5589},
                {"id":"mwbyKIFzmS0","title":"Unstoppable Money And Free Speech (Nostr)","duration":337},
                {"id":"lj0zzGpQ6mc","title":"What is Nostr? A simple explanation.","duration":108},
                {"id":"1AdRRpvBpf8","title":"What is Web5 and does it already exist? | Web5 Simplified","duration":2161},
                {"id":"dWUO0zBKnlo","title":"Debugging Web5 Chat Application","duration":3711},
                {"id":"owbkzvLhblk","title":"Verifiable Credentials for Data Unlocking. core of web5","duration":925},
                {"id":"rpc15bNDX-s","title":"Nostr Protocol Overview & Damus App Tutorial","duration":1494},
                {"id":"V8_d-1PUJsc","title":"Disarm the tyrants with Will from Damus #nostr #socialmedia #freespeech","duration":60},
                {"id":"SyANPFkOpME","title":"Did we reach ATH during a bear market? #bitcoin","duration":72},
                {"id":"G0FmzKp1CRk","title":"strfry: An Efficient Server for the Nostr Protocol - Doug Hoyte - CppNorth 2023","duration":3108},
                {"id":"B567h6MFLzE","title":"Web5 and the Decentralized Self: Reclaiming Your Digital Footprint","duration":336},
                {"id":"pJgMp8qVgMk","title":"Web5 Reimagining Digital Identity With Generative AI","duration":2920},
                {"id":"tj9DnTV_avA","title":"Nostr App Damus Review & Tutorial - Decentralized Social Media","duration":722},
                {"id":"HDR_8BkSCMA","title":"What's Web5 - Pt 1 🌐 | #web5 #web3 #shorts","duration":61},
                {"id":"8mSyMCJlSwA","title":"Nostr: A simple, open protocol enabling global, decentralized, and censorship-resistant social media","duration":3147},
                {"id":"ZGQLy5caaxk","title":"Jack Dorsey's TBD Is Building an 'Extra' Decentralized 'Web5' on Bitcoin","duration":168},
                {"id":"Bu5Mtvy97-4","title":"The Currency Wars and Bitcoin's Neutrality: We Didn't Start the Fire [Talk from 2016]","duration":1681},
                {"id":"Q7Q4IcwVDjY","title":"What is Nostr? The New Decentralized Network","duration":60},
                {"id":"4sxon4ajrCM","title":"Zapvertising on Nostr: All Your Models Are Broken","duration":1643},
                {"id":"hJEGnXlYcOA","title":"♟️Web5 Creator Network, Zion with Justin Rezvani | Ep. #59","duration":2582},
                {"id":"yzqGrtWnLLo","title":"one stop shop news on nostr","duration":55},
                {"id":"9gWXcmkUaD4","title":"Did Bitcoin Just Gain A Powerful Ally?💥 #MSCI","duration":69},
                {"id":"NO0r69TmOvs","title":"A Summary of Web5 Components that will shape the decentralized Web Platform","duration":359},
                {"id":"MVb-l-9Zel8","title":"Web1,web2,web3,web5 , web7 and hundreds of web next explained. What is the future of AI humanity?","duration":1944},
                {"id":"FYbQLja9Oe8","title":"What are \"zaps\" in Nostr/Damus? ⚡️","duration":225},
                {"id":"ButstuTuea8","title":"Jack Dorsey's biggest problem with Elon Musk's X (formerly Twitter)","duration":470},
                {"id":"NVXAOOhWi-4","title":"Desiree Dickerson on Building THNDR Games, Competitive Leagues, and Cross-App Identiy on Nostr | E99","duration":4668},
                {"id":"0YDj1QdL2Zs","title":"Jack Dorsey explains how Nostr works in 2 minutes","duration":140},
                {"id":"j0eMHXx6zdg","title":"The Future of Bitcoin - Jack Dorsey","duration":1491},
                {"id":"Qd4Po4i7wvc","title":"PRIMAL: Nostr Decentralized Social Media Meets Bitcoin! Full Tutorial","duration":2875},
                {"id":"u_U2obseVwY","title":"How to Start with Nostr Today | Presentation","duration":316},
                {"id":"78k8qAEzDBM","title":"Jack Dorsey's TBD to Launch Web5","duration":329},
                {"id":"Ua64ymE6KQ0","title":"Bitcoin and Nostr w/ Jack Mallers and Miljan","duration":2015},
                {"id":"ilhxlFUOSzk","title":"Web5 Explained... By a Bitcoin Maximalist","duration":1020},
                {"id":"FPoLTkNMzf8","title":"A Rogue Developer's Critical Take on Dorsey's Web5","duration":159},
                {"id":"h_oG9AEFztw","title":"Jack Dorsey-backed TBD Launches New Web5 Toolkit to Decentralize the Internet","duration":119},
                {"id":"0_w6ply1R0M","title":"Web3, web4, web5 and Jack Dorseys plans with bitcoin 👀","duration":767},
                {"id":"behkkIPeB0I","title":"Web5 Explained In 2 Minutes | What is Web5? | Yash Ekbote","duration":139},
                {"id":"ElTSvRbltyg","title":"Nostr Polls on Amethyst, NIP69 demo","duration":132},
                {"id":"012e9R3v6VM","title":"VerifiedEntity | Verified businesses using Web5 DIDs and decentralized web nodes.","duration":180},
                {"id":"_bQCkoe4fXU","title":"Web5: The Future of the Bitcoin-Based Internet with Polycarp Nakamoto (WiM512)","duration":5842}
            ]
        },
        {
            "id": "art-philosophy",
            "name": "Art & Philosophy",
            "emoji": "🎨",
            "desc": "Bitcoin art, ordinals & deeper meaning",
            "color": "#a855f7",
            "videos": [
                {"id":"9-S17oAxIqA","title":"175H BITCOIN PENCIL ART TIMELAPSE 4K - 'Human perfection' by Bitcoin Apex","duration":792},
                {"id":"pcVCt2utTW4","title":"How to Make a Bitcoin Ordinal Inscription in Under Two Minutes | Bitcoin Ordinals","duration":369},
                {"id":"2Jf8sxF8QFQ","title":"Miami debuts Bitcoin Bull statue","duration":163},
                {"id":"EaU5yFi61hg","title":"Yonat Vaks on Her Artistic Journey & Bitcoin Art | Bitcoin Art Podcast w/ Asanoha Ep. 3","duration":6067},
                {"id":"uIaUj6Nsi70","title":"2024: A Landmark Year for Bitcoin Trading Cards - Discover Our Bold New Look!","duration":16},
                {"id":"XTFoHv8GXj0","title":"Bitcoin Art: Genesis Edition Hardcover Book","duration":44},
                {"id":"b4Q8Y3Rg7Rc","title":"Frederic Guimont on Ratel & Bitcoin Comics | Bitcoin Art Podcast w/ Asanoha X Spaces v1","duration":7620},
                {"id":"Tr7XO-SQw5g","title":"Marcus Connor, Pepenardo & Rare Scrilla on Memes | The Movement of Art w/ Yonat Vaks Ep. 3","duration":5056},
                {"id":"wSLejJ88VGQ","title":"Ripping Spirit of Satoshi Packs (Bitcoin Trading Cards)","duration":236},
                {"id":"lQsVjSMfjS8","title":"Becoming Your Bitcoin-Self w/ Tomer Strolight","duration":9234},
                {"id":"Mqc6M8rZRi8","title":"BITCOIN TRADING CARDS?","duration":1066},
                {"id":"lRr9ofu0tnk","title":"Bitcoin Art Magazine Unleashed! with Asanoha","duration":5762},
                {"id":"e1ojV8YwA2c","title":"Gus Grillasca on Rare Pepes, BTC Art & Creative Engineering | Bitcoin Art Podcast w/ Asanoha Ep. 1","duration":5503},
                {"id":"SKIIif9WQok","title":"The Bitcoin Renaissance Legacy : Beyond Digital Gold Ep. 2","duration":1242},
                {"id":"7DIp6D-68cQ","title":"280. Can Bitcoin Rebuild Civilization?","duration":3033},
                {"id":"XrD617FIfJM","title":"Fractal Encrypt's Bitcoin Full Node - Our DESIGN feature for Block04","duration":63},
                {"id":"8FxyOC26TYE","title":"Whats In A Based Trading Cards Bitcoin Trading Cards Pack","duration":737},
                {"id":"yMoVGgR6h0Y","title":"Money: The Language of Power with Robert Breedlove (WiM530)","duration":4307},
                {"id":"rYiWd-qIRQA","title":"Kontext on Writing, Music & Stoicism | Bitcoin Art Podcast w/ Asanoha Ep. 5","duration":5759},
                {"id":"scKs1X9rcTU","title":"Martin Lukas Ostachowski, Modeotec & TC on Visualizing Bitcoin | The Movement of Art Ep. 6","duration":5782},
                {"id":"N3a8IQXKjeY","title":"What are Ordinals? | Ordinals Explained: Episode 2","duration":86},
                {"id":"UrCN7oG_4YY","title":"Bitcoin NFTs: How to Create Ordinal Inscriptions | Complete Tutorial","duration":708},
                {"id":"-vKBCrUyCEU","title":"Bitcoin Ordinals Explained","duration":421},
                {"id":"JffTkZZC2z8","title":"What is Money? | Robert Breedlove","duration":4932},
                {"id":"occ9L0dMMO4","title":"Bitcoin2024 Art Exhibit as narrated by Bitcoin Bob","duration":543},
                {"id":"52T543jP_gE","title":"The Greatest Heist In History: By Tomer Strolight","duration":584},
                {"id":"l5a6-9mNqho","title":"World's largest Bitcoin sculpture","duration":58},
                {"id":"Ifi-Hg3n3bc","title":"Bitcoin Ordinals Explained: How To Make Your First Bitcoin NFT","duration":233},
                {"id":"sntmLivV56M","title":"Adam O'Brien & Brandon Gentile ripping BitBlockBoom 2024 Commemorative Packs","duration":364},
                {"id":"GRby6vAPwHI","title":"Bitcoin, Art, and Our Divine, Lost Knowledge - with Ariel Birdie","duration":4258},
                {"id":"AKri5ZKYPAk","title":"LSD, Shrooms, DMT, Mescaline... and Bitcoin","duration":1140},
                {"id":"KORJr5ZfzWI","title":"Bitcoin Full Node Sculpture","duration":38},
                {"id":"KxTWC3ShYDE","title":"Just-B on Airbrush Mastery, Collector Culture & BTC Art | Bitcoin Art Podcast w/ Asanoha X Spaces v1","duration":7385},
                {"id":"-NVUQILq1pA","title":"Hello. I Am Bitcoin. | Tomer Strolight","duration":775},
                {"id":"tnL-7_wAsKY","title":"How Bitcoin is Unlocking Human Potential | Tomer Strolight","duration":3537},
                {"id":"indFxEWINDA","title":"We Gave Bitcoin Trading Cards to No-Coiners - Here's What Happened","duration":939},
                {"id":"gsuMfKA7wFg","title":"Bitcoin is Beautiful | a Short Film by Tomer Strolight","duration":329},
                {"id":"ic6pDq3OAec","title":"Austrian Economics And Understanding Bitcoin with Hodlberry: Meet The Taco Plebs","duration":1949},
                {"id":"xwufPksmi9w","title":"Cracking A Pack Of Based Trading Cards Bitcoin Trading Cards Series 3 Warriors Vs Villains ","duration":484},
                {"id":"eKjrh3sUeVc","title":"Bitcoin is Synchronizing Human Consciousness | Tomer Strolight","duration":3354},
                {"id":"VLRt0QOZ3TE","title":"Bitcoin Trading Cards: Celebrate the Revolution with the Scarcest Collectibles on Earth","duration":128},
                {"id":"yvdZsN5s9sc","title":"Alladin, Asanoha & TheRealBitcoinJesus on Based Trading Cards | The Movement of Art Ep. 4","duration":5680},
                {"id":"83mw71TLYjY","title":"Leveling Up Your Collection: PSA Grading for Bitcoin Trading Cards","duration":1891},
                {"id":"iIWViimqRMU","title":"The Legendary Treasure of Satoshi Nakamoto | Tomer Strolight","duration":2314},
                {"id":"XHBydlTt2jM","title":"The Rise of Ordinals and Art on Bitcoin - Panel at NFT.NYC 2024","duration":1499},
                {"id":"iFb2MMUZBYs","title":"Bitcoin Artist Trevor Jones Augments Reality on Milk from CoinSpice.io","duration":382},
                {"id":"gNOnNz4d_mI","title":"Tone Vays rips BitBlockBoom 2024 Bitcoin Trading Cards packs with Brandon Gentile","duration":328},
                {"id":"tgM5wwpwpzA","title":"Ariel B., Flo M., Antonio B. & Psyfer on Stories & Myths | The Movement of Art w/ Yonat Vaks Ep. 2","duration":4436},
                {"id":"RwO9lB-rloo","title":"Bitcoin, Art, and Freedom with Madex | Bitcoin Infinity Show #148","duration":5310},
                {"id":"5gl2xVJ9mTw","title":"What are Satributes & Recursions? | Ordinals Explained: Episode 3","duration":121},
                {"id":"P0WZCTDDGXQ","title":"Create and List Your Own Bitcoin Ordinals | Ordinals Explained: Episode 5","duration":99},
                {"id":"cKkokcMMnpc","title":"Buy Bitcoin for Your Bloodline w/ Robert Breedlove (WiM589)","duration":5473},
                {"id":"bHj-a4_nX78","title":"Fractal Encrypt Bitcoin Full Node Sculpture","duration":30},
                {"id":"PqFz8R1CZYo","title":"Bitcoin is BREAKING The Kardashev Scale (Trump's Bitcoin Advisor)","duration":755},
                {"id":"h9jO1cipnc8","title":"Launch Announcement: 2024 Bitcoin Trading Cards Halving Edition Whale Packs","duration":61},
                {"id":"33emHIL1IoU","title":"Eric Weiss - The Bitcoin Full Node Sculpture","duration":293},
                {"id":"Z0_9Jw56l4k","title":"Opening 2 Packs Of Bitcoin Trading Cards \\\"RARE SERIES\\\" Collect Ultra Rare Cards And Learn About BTC","duration":1087},
                {"id":"FiFwaHCRz7s","title":"Bitcoin's BRC-20 Explosion: Everything You Need To Know About Ordinals","duration":286},
                {"id":"EPUNITbXwEM","title":"Bitcoin Trading Cards: Collectible Art To Orange Pill The World","duration":1674},
                {"id":"nvPJ_F845ms","title":"Sam Kimbrow & Asanoha on Bitcoin Culture | The Movement of Art w/ Yonat Vaks Ep. 1","duration":4583},
                {"id":"j3QJlyRMHpI","title":"Ordinals Paris 2025 - Art on Bitcoin: Shaping the Future of Digital Creativity","duration":470},
                {"id":"Q4owb6f9gbM","title":"FractalEncrypt & Rebel Money on Bitcoin Art & Time | The Movement of Art w/ Yonat Vaks Ep. 5","duration":4034},
                {"id":"JPJyDYmovJo","title":"A FULL BOX of Bitcoin Trading Cards | w/ BTC Viking","duration":755},
                {"id":"omKlwzKmKBE","title":"Bitcoin Trading Cards: A Tool for Understanding True Scarcity and Value","duration":264},
                {"id":"lo7eeL1E_VQ","title":"A Madex Manifesto","duration":281},
                {"id":"SogEkk3-XnA","title":"I BOUGHT THIS BITCOIN NFT!!!!!!!!!!! (BRC-20, NFTs, Ordinals)","duration":668},
                {"id":"IUpIoZIoO2Q","title":"Ripping BitBlockBoom Packs (Bitcoin Trading Cards)","duration":185},
                {"id":"rJmn1kIpeYU","title":"Why Bitcoin Gives You What Money CANT Buy | Tomer Strolight","duration":777},
                {"id":"Q5Wxg53qu9s","title":"The Bitcoin Full Node Sculpture #2 of 10 -Updated!","duration":16},
                {"id":"NALikCvCyes","title":"The Truth About Money, Inflation, and Bitcoin - Robert Breedlove","duration":6120},
                {"id":"wYhpD6Y6E8E","title":"Meet Based Trading Cards - Bitcoin Culture You Can Hold","duration":53},
                {"id":"YZ2B-Qnm0eM","title":"The Timechain Codex by FractalEncrypt","duration":77},
                {"id":"1gnIbVFnuCY","title":"This Is the Biggest Scam in Human History - And It's Happening Right Now | Robert Breedlove","duration":5936},
                {"id":"gb2S1Filtic","title":"How Bitcoin Fixes Fiat's Millennium of Mistakes w/ Saifedean Ammous & Stephan Livera","duration":1587},
                {"id":"MRnmP7pbR0s","title":"Creating Meaningful Art with FractalEncrypt - Bitcoin Infinity Show 121","duration":3582},
                {"id":"GwA4zt9R1AU","title":"How is #Bitcoin anti-war? Erik Cason and American HODL on #TPBPod","duration":54},
                {"id":"JQg_s0wt96M","title":"Bitcoin Trading Cards Are Back With Series Two \\\"Fud Busters\\\" Getting Lucky Opening Packs!","duration":898},
                {"id":"QVg0ZmxrYLo","title":"Atomic Bitcoin Butt Flowers: Bitcoin's Most Beautifully Absurd Art Drop Yet","duration":504},
                {"id":"pp59Yvi_QSE","title":"Bitcoin: An Empire For Us All - By Tomer Strolight","duration":615},
                {"id":"edyO5-L9un8","title":"Marcus Connor & The Bitcoin Roller Coaster Guy | Bitcoin Art Podcast w/ Asanoha Ep. 6","duration":3732},
                {"id":"3e36FXH5Hlw","title":"Amy DiGi on Community, Craft & Handmade Bitcoin Art | Bitcoin Art Podcast w/ Asanoha Ep. 2","duration":4744},
                {"id":"bgDwvJOtSSY","title":"Naomi Olson on Ocean Art & Aloha Energy | THE WHOLE ENTIRE UNIVERSE w/ Anik Malcolm X Spaces v1","duration":4967},
                {"id":"vPUpdXZPpbQ","title":"Nashville Bitcoin Mural - Sound Money in Music City","duration":41},
                {"id":"3nA4HhsbZMQ","title":"Anik Malcolm on Finding Purpose in Bitcoin Art | Bitcoin Art Podcast w/ Asanoha Ep. 4","duration":4016},
                {"id":"0qS_oBk-tbY","title":"Fractal Encrypt: Artistic Bitcoin Education - #Bitcoin With Jake #44","duration":3723},
                {"id":"RnducAborVw","title":"Bitcoin art gallery Miami 2022","duration":419},
                {"id":"ImZDBBjdX6s","title":"Opening The BOX!!! 24 Packs of BTC Trading Cards | w/ Crypto Viking","duration":752},
                {"id":"BrfJgr19MPY","title":"Alex Schaefer on Burning Banks & Protest Art | THE WHOLE ENTIRE UNIVERSE w/ Anik Malcolm X Spaces v1","duration":6032},
                {"id":"8TN7mq6cK7g","title":"#Bitcoin #Art with FractalEncrypt - Freedom Footprint 28","duration":5006},
                {"id":"ySPw_-09nnI","title":"Magic Internet Money","duration":636},
                {"id":"OszL_Q2wvNQ","title":"Welcome to Ordinals! What is Ordinal Theory? | Ordinals Explained: Episode 1","duration":80},
                {"id":"btiN4DabrRk","title":"Bitcoin, 'Christian Anarchy', and the Logic of Belief","duration":6256}
            ]
        },
        {
            "id": "orange-pill",
            "name": "Beginners 101, Orange-pill & Self-Custody",
            "emoji": "🟠",
            "desc": "Start here - Bitcoin basics + the orange pill journey",
            "color": "#f7931a",
            "videos": [
                {"id":"xDKxX42hHzM","title":"Bitcoin Price Distribution Animation (3/22/24 Update)","duration":96},
                {"id":"smTNsjHoMTA","title":"I Gave Away $600 Of Bitcoin In One Day","duration":53},
                {"id":"Qd8ymRwrokg","title":"COLDCARD Spending Policy & 2FA","duration":300},
                {"id":"k-58GrK6A8k","title":"Bitcoin Complete Price History (7/17/2010 - 11/12/2023)","duration":11679},
                {"id":"f-8elm8xCLs","title":"Using An Old Phone As A Hardware Wallet","duration":1710},
                {"id":"mYK4rZSrBL8","title":"Bitcoin: Daily DCA Cost Basis (12/16/24 Update)","duration":86},
                {"id":"Xd2T6I_fuRU","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (3/7/24 Update)","duration":76},
                {"id":"Q6euy5W1js4","title":"Bitcoin and Unstoppable Code: The Difference Between Can't and Won't","duration":1948},
                {"id":"qLCt4RFmtNQ","title":"DIY Bitcoin Cold Storage | How to Build and Use a SeedSigner","duration":1466},
                {"id":"SMtdXB6g6HI","title":"The Ultimate Bitcoin 101 with Vijay Boyapati","duration":4448},
                {"id":"YT-38EneBWw","title":"Bitcoin Street Interviews [London, 2021]","duration":1491},
                {"id":"z8qfz3AcgdU","title":"The three little pigs in crypto (29 December 2020)","duration":706},
                {"id":"Bg0r0DQVcDg","title":"Key Teleport","duration":267},
                {"id":"dO9SvaZ4wz0","title":"COLDCARD MK5 First Look: Reincarnated!","duration":1662},
                {"id":"ax8L8FezwGg","title":"Bitcoin Bear Market Street Interviews [London, July 2022]","duration":595},
                {"id":"i9nUMvpT2rM","title":"Blockchain for Beginners","duration":1339},
                {"id":"sZ7TUop46zU","title":"Bitcoin HODL Waves Animation (10/1/24 Update)","duration":99},
                {"id":"rJlgpOQp7Ig","title":"ORANGE PILL [OP26] - Monetizing Dissent","duration":5058},
                {"id":"1Lcu7ZCJYnw","title":"DCA Live: Bitcoin, ETF's & Impact, Rotation, Web3, PlanB Retracement, Celsius and more","duration":4122},
                {"id":"qU9oMiq77xw","title":"What's the scarcest thing in the world?","duration":381},
                {"id":"ZyC9pAqBkX8","title":"Is the Cycle Going to Break? With Willy Woo","duration":3855},
                {"id":"oq3nPlEeWFc","title":"GENIUS Investor Said This About Crypto...","duration":813},
                {"id":"yiME-izD-Ss","title":"Lightning Hack Day Istanbul, February 26th 2022","duration":2553},
                {"id":"3w4AbAmedVs","title":"Bitcoin: Compound Annual Growth Rate (CAGR) Animation (10/16/24 Update)","duration":74},
                {"id":"0qx6qVxN5EQ","title":"Ansel Lindner - The History of Money","duration":685},
                {"id":"x78Y7TE9eyo","title":"BITCOIN'S NEXT BULL RUN","duration":414},
                {"id":"EH6vE97qIP4","title":"1. Introduction for 15.S12 Blockchain and Money, Fall 2018","duration":3724},
                {"id":"LKYVbahTjQM","title":"Giving Strangers $50 Bitcoin or $5 Cash (Social Experiment)","duration":440},
                {"id":"Bt2Z-_nhpwQ","title":"Orange Pilling Yourself with these Bitcoin Resources","duration":840},
                {"id":"TzjfyHuugUU","title":"The Art of Hodling with American Hodl","duration":47},
                {"id":"5fOhkHbZz_8","title":"Your Bitcoin Deserves Better Than an Exchange - Take Self-Custody with Blockstream Jade","duration":72},
                {"id":"ywthH7eyXOI","title":"Bitcoin Days Since All Time High (4/30/25 Update)","duration":104},
                {"id":"_91klH3VsfE","title":"Bitcoin: Compound Annual Growth Rate (CAGR) Animation (4/26/24 Update)","duration":71},
                {"id":"e7CIeZmaNEs","title":"Bitcoin Adoption Is Going Mainstream!","duration":71},
                {"id":"QmfTqIbEBmk","title":"Global Debt is COLLIDING with AI deflation, and it's going to get UGLY","duration":537},
                {"id":"N5aAkIo-93Q","title":"Crypto Street Interviews: Las Vegas Episode 1","duration":996},
                {"id":"8e6hTYr9Gv0","title":"Bitcoin Days Since All Time High (12/3/24 Update)","duration":101},
                {"id":"SGb7QMZwJd8","title":"11. Bitcoin Fundamentals Explained Simply!","duration":603},
                {"id":"4YC4vhCHNyE","title":"Bitcoin 1-Month Candles Animation (10/21/23 Update)","duration":165},
                {"id":"azw7KpdQD0w","title":"Is Bitcoin is the ONLY asset worth buying?","duration":410},
                {"id":"INLz3aHUKiM","title":"Bitcoin Days Since All Time High Animation (8/24/25 Update)","duration":107},
                {"id":"RPR5dtmXnY8","title":"Bitcoin Q&A: Where Can I Buy and Spend Bitcoin?","duration":253},
                {"id":"7iplbbcLfJU","title":"How Does a Crypto Hardware Wallet Work?","duration":519},
                {"id":"ieiwq2m9aWg","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (5/14/25 Update)","duration":85},
                {"id":"dT9y-KQbqi4","title":"How I hacked a hardware crypto wallet and recovered $2 million","duration":1938},
                {"id":"mZ3nXx9V55M","title":"The Next Paradigm in Medicine","duration":501},
                {"id":"68jc2KVnLmg","title":"Bitcoin Stock2FOMO Model","duration":49},
                {"id":"JIxwTx7o_B4","title":"Bitcoin 101 | Balaji Srinivasan","duration":1681},
                {"id":"GgFQgfssHBo","title":"Bitcoin Cultures - Unconfiscatale 2022","duration":4243},
                {"id":"yb2p0WnP53M","title":"Bitcoin: Days Spent at a Loss Animation (3/3/25 Update)","duration":99},
                {"id":"EqXouxS5co4","title":"Bitcoin HODL Waves & Price Animation (5/12/25 Update)","duration":108},
                {"id":"lBnOgWbo-0A","title":"Bitcoin: Profit vs Loss Animation (1/9/24 Update)","duration":90},
                {"id":"bfxHtrVT7Zg","title":"Saifedean Ammous explains Bitcoin to Lex Fridman","duration":382},
                {"id":"IAFKJVLNVQA","title":"Wences Casares Explains Bitcoin","duration":845},
                {"id":"Znzm-WJ0c2U","title":"Revolutionary Tech Rides on Historic Infrastructure -  Bitcoin and Horses? (short)","duration":85},
                {"id":"iEzOIb8oCPc","title":"Bitcoin Supply Distribution & Age by Realized Price (4/18/25 Update)","duration":203},
                {"id":"9iGFXqhNRAM","title":"Bitcoin's Cycle Fakeout: Why This Bottom Isn't 2022 and What Comes Next","duration":278},
                {"id":"qxOhCvot77I","title":"Create & Verify Your Bitcoin Seed Phrase Using Dice + Coldcard + SeedSigner","duration":443},
                {"id":"w5Tu3eXMDhM","title":"Gershwin-Rhapsody in Blue, Edisher Savitski, Piano","duration":1280},
                {"id":"aHvoUyclQrE","title":"Scottish Stock Investor Is Asked About Bitcoin In 2022","duration":59},
                {"id":"y6egEeOSgjI","title":"Bitcoin Q&A: Is Bitcoin a Good Investment?","duration":174},
                {"id":"DG1zrlAVdys","title":"BTCIOT Tutorial: Bowser, DIY Bitcoin Hardware Wallet","duration":1752},
                {"id":"0mE0fNMUotc","title":"Quantum vs. Bitcoin: Hype, Secrecy, and the Case for Quantum-Resistant Insurance","duration":272},
                {"id":"nTRdmYX-0h8","title":"Warming Up to Bitcoin - The Future of Sustainable Heating?","duration":548},
                {"id":"b3nk4bj4vEA","title":"Bitcoin Seed Phrase Metal Backup Comparison & Demonstration","duration":1567},
                {"id":"-L_RCKJVNXc","title":"F. Schubert, Sonata in B-flat Major, D. 960; Edisher Savitski-Piano","duration":2705},
                {"id":"xfHeUFCk4hY","title":"Secure Notes","duration":173},
                {"id":"1IIBhvQFNvs","title":"Tutorial - Multi Signatur with Sparrow Wallet, BitBox & Jade & Specter DIY","duration":1196},
                {"id":"JaWC0FBS6M0","title":"How to Use Specter Wallet for Bitcoin Multi Sig","duration":1719},
                {"id":"2qjF6A68oi0","title":"Bitcoin 200 Day Moving Average & 200 Week Moving Average (2/17/25 Update)","duration":51},
                {"id":"PXuCH89Arv4","title":"HCPP22 | Janine - Blockchain Surveillance, Cyber Mercenaries, and Intelligence","duration":2787},
                {"id":"TIkqBZnrKJM","title":"EVERYTHING will fail. Except...","duration":465},
                {"id":"t1brCcgi174","title":"THE BITCOIN STANDARD SUMMARY | Bitcoin Explained","duration":1014},
                {"id":"SZ4W07fv-0A","title":"Episode 5 - Why Is Bitcoin Different From Crypto?","duration":381},
                {"id":"F5rJHIiIEQA","title":"How to Self-Custody Bitcoin (Even If You Always Lose Everything)","duration":41},
                {"id":"mVgPoQrbi7A","title":"Verifying Dice Roll Seed Generation with the SeedSigner, Coldcard, & Keystone","duration":840},
                {"id":"5KTiwi59CUk","title":"Bitcoin Days Since All Time High Animation (5/21/25 Update)","duration":104},
                {"id":"NvE5uUm6Jzc","title":"Bitcoin Issuance","duration":143},
                {"id":"fkmEfNNGMm8","title":"The Bullish Case for Bitcoin - by Vijay Boyapati","duration":4772},
                {"id":"cbnL1yOv1VU","title":"Bitcoin: The Inverse of Clown World","duration":404},
                {"id":"eZbl-vVvvTo","title":"Chatting With Arabs [Middle East Vlog]","duration":1630},
                {"id":"eWbBnqRcIo0","title":"Attack Vectors in Real Life: Being your own Bitcoin Bank","duration":1747},
                {"id":"_KfdgZAFMf0","title":"Bitcoin HODL Waves Animation (11/7/24 Update)","duration":100},
                {"id":"A7b5FRQejqo","title":"Johannes Brahms, Ballades 3 & 4, Op. 10","duration":826},
                {"id":"iXxeIahvAOQ","title":"Building a Bitcoin World | Interview with Ben Perrin aka BTC Sessions","duration":5049},
                {"id":"ePx5lBSI0es","title":"Andreas Clarifies: When is Multisig the RIGHT tool to use for your bitcoin security? (January 2024)","duration":338},
                {"id":"m5wLGRSGi7U","title":"This week in Bitcoin - 10 years of Satoshi (2 November 2018)","duration":4006},
                {"id":"Sv9VAocAA80","title":"\\\"FINAL WARNING! I WON'T Say This Again!\\\" - Max Keiser 2025 Bitcoin Prediction","duration":822},
                {"id":"AYtNBHAdP0c","title":"C. Franck, Piano Quintet in F minor","duration":2016},
                {"id":"4WXXZLYgdgA","title":"Bitcoin Price Distribution Animation (1/13/25 Update)","duration":101},
                {"id":"LCM6YnCpdlE","title":"The U.S. dollar 'as we know it' will be dead in 10 yrs, bitcoin price to hit $2 million in 5 yrs","duration":1558},
                {"id":"z3n1uZrNvXo","title":"How To Self Custody Your Bitcoin","duration":1494},
                {"id":"TTFB50-qTvA","title":"This is why smart money chooses Bitcoin over gold #bitcoin #wealth #shorts","duration":53},
                {"id":"9cPa4EgHDuc","title":"Massive amount of credit destruction incoming #crypto #bitcoin #wealth","duration":80},
                {"id":"aNEaBzrcs1o","title":"Episode 9 -  How Bitcoin Empowers You","duration":257},
                {"id":"8HaVTfzFFG0","title":"Bitcoin is Going Up Forever  #bitcoin101","duration":74},
                {"id":"qlU_6USlQEU","title":"Shitcoin Apologism Steelmanned & Bitcoin Scaling Panel with Adam Back at Baltic Honeybadger 2019","duration":2422},
                {"id":"J8YgqbQyYB8","title":"Andreas Antonopoulos educating an empty room on the bitcoin value proposition when it was $100.","duration":129},
                {"id":"NNBHn-cHtrI","title":"Bitcoin 101: How Do I Get Bitcoin?","duration":326},
                {"id":"bRtFCXkNpWI","title":"What is Bitcoin? (In 2 minutes)","duration":131},
                {"id":"MxIrc1rxhyI","title":"The Killer App: Engineering the Properties of Money","duration":1755},
                {"id":"rjLhuqDaTu4","title":"Average Price: Ground Beef in Average U.S. City, BTC vs USD (9/7/24 Update)","duration":95},
                {"id":"UiaJtzFkGxc","title":"Why Your Dollar Ain't Shit | Guy Swann","duration":227},
                {"id":"4UDkbGMvGIY","title":"5. The Biggest Risks to Bitcoin","duration":610},
                {"id":"vclZlAFXpEI","title":"give me 9 minutes, and you'll finally understand bitcoin","duration":599},
                {"id":"HhxcdMIJTLA","title":"it sucks, but telling people about Bitcoin never works...","duration":452},
                {"id":"Nst2MCLBSZQ","title":"ReMastering - Bitcoin & the Elements of Trust: how do chemistry, cooking, & lego relate to bitcoin?","duration":1156},
                {"id":"BzLFQqpzI04","title":"6. Does Bitcoin Have No Intrinsic Value?","duration":266},
                {"id":"YLDpujqF7-4","title":"CNBC: AI Found Bitcoin's Weak Spot. It's Not What You Think.","duration":146},
                {"id":"_rAIa-f_xao","title":"Random Guy Gets Free Bitcoin","duration":40},
                {"id":"ru8UaqxXwiY","title":"Why Bitcoin is the Future of Money","duration":765},
                {"id":"ulimNuaKIQM","title":"Slaying The Bitcoin Bear Whale","duration":777},
                {"id":"ZkgkxB8s9bw","title":"Can Bitcoin Be Futureproof? | w/ Adam O'Brien","duration":3586},
                {"id":"l9jOJk30eQs","title":"How Bitcoin Works in 5 Minutes (Technical)","duration":326},
                {"id":"stN03wk_Wzs","title":"Cryptocurrency Explained: All the ships are sinking (Currency Wars II)","duration":2325},
                {"id":"nsAGFlrRDV8","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (3/23/25 Update)","duration":83},
                {"id":"6uXAbJQoZlE","title":"Investing in Education Instead of Speculation","duration":2230},
                {"id":"QYKduDat0IY","title":"Bitcoin vs Central Banks: The Monetary Cold War Accelerates","duration":1007},
                {"id":"Uh-eTnRXCr8","title":"Bitcoin Street Interviews [Edinburgh, 2022]","duration":1397},
                {"id":"Vp_-3Z8luTQ","title":"Bitcoin breaks ONE MILLION Swedish kronor","duration":369},
                {"id":"hYip_Vuv8J0","title":"Blockchain Expert Explains One Concept in 5 Levels of Difficulty | WIRED","duration":1070},
                {"id":"TgG915kVQrg","title":"Brits Making Bitcoin Price Predictions in 2021","duration":442},
                {"id":"rFPp6vV80B4","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (11/25/24 Update)","duration":81},
                {"id":"btF6nKHo2i0","title":"An Economic Hit Man Confesses and Calls to Action | John Perkins | TEDxTraverseCity","duration":1116},
                {"id":"4xGTGqsy4SM","title":"ORANGE PILL PODCAST - Episode 0001","duration":5081},
                {"id":"wHQrvCGVkTw","title":"BORDER WALLETS: Storing Bitcoin In Your Brain","duration":1921},
                {"id":"CNkgi1DU7xc","title":"Bitcoin 10-of-10 Multisig Testing with Sparrow and Nunchuk Wallet","duration":830},
                {"id":"mdOyyipbUIg","title":"Bitcoin vs Real Estate | The Ultimate Wealth Test","duration":511},
                {"id":"ExUeCIscbNU","title":"Something is deeply wrong with the economy right now.","duration":287},
                {"id":"bBC-nXj3Ng4","title":"But how does bitcoin actually work?","duration":1516},
                {"id":"PFQ9bCtlyPA","title":"You're Running Out Of Time (Bitcoin)","duration":782},
                {"id":"_MBEzS9GAME","title":"Bitcoin Self Custody Q&A (12/19/23)","duration":3101},
                {"id":"8aOJxfJ-SNE","title":"Bitcoin Price Distribution Animation (1/8/26 Update)","duration":109},
                {"id":"E4HV-xGAXug","title":"Bitcoin: Supply, Difficulty, & Price Animation (2/18/25 Update)","duration":103},
                {"id":"QC1HYFB8ExQ","title":"Lyn Alden on Why Bitcoin Didn't Explode This Cycle","duration":57},
                {"id":"k5h7A7kRM8Y","title":"How to make a 24 word Bitcoin seed phrase with 256 coins","duration":236},
                {"id":"5hfEBupAeo4","title":"All Wars Are Bankers' Wars","duration":2614},
                {"id":"A-ombaK0iIY","title":"Adam Back: Bitcoin Traders Learn the Hard Way. Cold Storage Wins Every Time.","duration":30},
                {"id":"Jqf6o5ZL63U","title":"UNLOCKED: 1 Million Bitcoin - The Secret Of Satoshi | Tomer Strolight","duration":2390},
                {"id":"CmogAUugkDo","title":"Bitcoin: Compound Annual Growth Rate (CAGR) Animation (12/31/24 Update)","duration":76},
                {"id":"iWh0lfbvdLQ","title":"Coinkite Tapsigner Recovery using a Coldcard with Sparrow Wallet","duration":943},
                {"id":"uOnlGmN89ws","title":"The Perfect Environment for Bitcoin is Coming!","duration":244},
                {"id":"M5-yY2XWdKM","title":"Download, Verify, & Flash SeedSigner v0.7.0 Software","duration":724},
                {"id":"Ir1frVs1gNE","title":"Secure Passwords","duration":219},
                {"id":"Jh1TJAeQm3o","title":"Why the US Dollar Dominated the World After WWII","duration":105},
                {"id":"41JCpzvnn_0","title":"What is Bitcoin?  Bitcoin Explained Simply","duration":769},
                {"id":"rOyCFVmAEQQ","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (6/23/24 Update)","duration":81},
                {"id":"bVEMa7YkefY","title":"Bitcoin: Money as Language & the Multi-currency Future","duration":1603},
                {"id":"UlKZ83REIkA","title":"Bitcoin for Beginners: Bitcoin Explained in Simple Terms","duration":1792},
                {"id":"1bFSolYm72I","title":"Fiat vs Crypto vs Bitcoin: Why most people still dont get it | Joe Burnett","duration":226},
                {"id":"ZiFlXHLjbfI","title":"I FOUGHT THIS MAN IN A CAGE... Now We're Talking BITCOIN!","duration":5701},
                {"id":"K33t8HmWipQ","title":"Bitcoin Just Hit Its 200th Daily Close Above $100k","duration":107},
                {"id":"BYHSrzTfeMY","title":"BITCOIN IS GOING TO A MILLION DOLLARS [here's why...]","duration":412},
                {"id":"6Ojh969zABM","title":"The Multipolar World - And What it Means for BITCOIN","duration":458},
                {"id":"Vfq7LNDCdNQ","title":"Andreas Antonopoulos explaining Bitcoin and money 🎙It is one of the best speeches you will ever hear","duration":1499},
                {"id":"heA1fZzRAFs","title":"Orange Pill App is Bitcoin's Social Layer! Deep Dive w/ CEO Matteo Pellegrini","duration":2625},
                {"id":"lRhQ10zHsQc","title":"When can you retire on 1 bitcoin? | Joe Burnett","duration":213},
                {"id":"pWmgu5eA4y4","title":"Evil RBFer Scenario Walkthrough using Sparrow Wallet","duration":783},
                {"id":"xQXuc8v-LdQ","title":"Traveling With Bitcoin? Blockstream Jade Is the Only Hardware Wallet to Carry","duration":21},
                {"id":"s-kKDR30Fb8","title":"Bitcoin is like real estate in Manhattan","duration":241},
                {"id":"LxkCOjgbSpo","title":"Saying No To Free Bitcoin #1","duration":28},
                {"id":"ip646IX-WrA","title":"HISTORY FOR SLEEP | 💰 From Salt to Bitcoin | Bedtime Stories for Adults | Soft-Spoken","duration":5537},
                {"id":"jdZXDSfRXFw","title":"Why Make Bitcoin Videos?","duration":417},
                {"id":"vweXlKOYi_A","title":"BR093 - ECDSA Key Extraction, ESP32 Vuln, COLDCARD, Nunchuk, CTV Revival? + MORE ft. Rob & Vivek","duration":5297},
                {"id":"oCNVi3J9qjM","title":"CASH OR BITCOIN? Asking People In The Streets [2022]","duration":485},
                {"id":"qr3TGnsB6YI","title":"OLD GUIDE- NEW GUIDE LINK IN VIDEO How To Use Specter Wallet","duration":434},
                {"id":"s4g1XFU8Gto","title":"Bitcoin explained and made simple","duration":205},
                {"id":"y1KXs3uE42I","title":"The Internet of Money by Andreas Antonopoulos [On Books #48]","duration":1641},
                {"id":"lPbp3dZCCUY","title":"The Top 6 Massively Bullish 2026 Bitcoin Catalysts!","duration":1014},
                {"id":"Hee0elVtA9k","title":"Bitcoin Self Custody: Signing Devices & Software Wallets","duration":790},
                {"id":"IkoxrYcwEAI","title":"How Governments Change Money During War","duration":90},
                {"id":"ZwFEKGa64KM","title":"Episode 4 - Can Governments Ban Bitcoin","duration":412},
                {"id":"gIVp2Pxy_fg","title":"Does Bitcoin Become More Decentralized Over Time?","duration":57},
                {"id":"YR50A20lNzo","title":"Bitcoin's Family Revolution - Seb Bunney - #018","duration":4333},
                {"id":"zpNlG3VtcBM","title":"Bitcoin - The End of Money As We Know It | Award-Winning | Full Documentary","duration":3604},
                {"id":"YKTLZcfaL4A","title":"BR094: COLDCARD KeyTeleport, Harbor, Ark, AI Code, Trezor Vuln, Coinbase Phishing +MORE ft Rob, Paul","duration":5329},
                {"id":"U3Y5Cab1nlA","title":"Quantum Computing and Bitcoin (16 July 2019)","duration":6777},
                {"id":"Fp9xhVeWUMs","title":"Asking Strangers About Bitcoin & Crypto Currency","duration":694},
                {"id":"JHJhYE-3Azk","title":"Man who threw away 8,000 BITCOIN (!) is on BBC Radio 2","duration":891},
                {"id":"Ub5QwtzwzgY","title":"Visiting The Avenues Mall [Kuwait Vlog]","duration":1619},
                {"id":"Bhe61JaNFLU","title":"Bitcoin 101 - What is Bitcoin?","duration":1353},
                {"id":"vUvIzshYyv8","title":"What is a Central Bank? | Back to Basics","duration":144},
                {"id":"ZMmq4zYUviY","title":"Bitcoin HODL Waves Animation (5/9/25 Update)","duration":108},
                {"id":"7C2yroJgkqM","title":"This New Bitcoin Wallet Is Almost IMPOSSIBLE To Hack (Coldcard Mk5 Just Dropped)","duration":32},
                {"id":"RFSBWrAllzw","title":"Human B | Die Reise in den Bitcoin-Kaninchenbau (english subtitles)","duration":4428},
                {"id":"IAfpjwzvUks","title":"Episode 3. Can you increase Bitcoin's Supply?","duration":333},
                {"id":"OWxhobO1YnQ","title":"Small Moves, Massive Damage Due to Leverage #bitcoin #economy #finance","duration":44},
                {"id":"7vl_ziH6OJo","title":"Bitcoin's price curve will not be S-shaped","duration":242},
                {"id":"HYjOrFqu3Ps","title":"Bitcoin 1/2/3/4 Year Window Animation (4/17/24 Update)","duration":283},
                {"id":"QoiR4aNbTOw","title":"Decentralized Globalization: Cryptocurrencies are Superpowers for Everyone","duration":2256},
                {"id":"z4RyPyS_Cas","title":"Bitcoin Built a System Traditional Finance Can't Touch #bitcoin #finance #shorts","duration":58},
                {"id":"kjsUN_9siKw","title":"Episode 1: Grow Your Wealth, AND Fix the World: Bitcoin!","duration":499},
                {"id":"ONvg9SbauMg","title":"The Stories We Tell About Money","duration":2848},
                {"id":"sMoqtZZ-tiM","title":"Bitcoin + Islam: a conversation with 'Muslim Bitcoiner'","duration":3100},
                {"id":"xUNGFZDO8mM","title":"Andreas M. Antonopoulos educates Senate of Canada about Bitcoin  (Oct 8, ENG)","duration":6767},
                {"id":"rCfAjgBhp5k","title":"Why Game Theory means Bitcoin wins!","duration":340},
                {"id":"jk1XrmiNgr4","title":"CASH OR BITCOIN? Offering People £20 Cash or 0.002 BTC [2022]","duration":601},
                {"id":"onc__HhGUmY","title":"Own Bitcoin or not - This is what life looks like at $1,000,000 | Tomer Strolight","duration":6833},
                {"id":"pRc2VM16aEU","title":"I Turned My Bitcoin Seed Phrase Into a QR Code","duration":62},
                {"id":"S098zQKg2D4","title":"The PERFECT Cold Hardware Wallet - Explained","duration":763},
                {"id":"k_F-Qs57B2U","title":"Bitcoin: Daily DCA Cost Basis (4/28/25 Update)","duration":89},
                {"id":"sZvhLDWjD_I","title":"How Bitcoin Fixes Broken Money | Welcome to Bitcoin | Introductory Course (Unit 1)","duration":896},
                {"id":"Ym5kXxZ0eKg","title":"New ALL TIME HIGHS in 2026?","duration":492},
                {"id":"zW0wwLiNXTE","title":"The Bullish Case For Bitcoin with Vijay Boyapati - Pacific Bitcoin 2023","duration":1446},
                {"id":"cCvCvnwd0so","title":"Will Full Blocks Destroy Bitcoin?","duration":854},
                {"id":"LA9A1RyXv9s","title":"What is Bitcoin? An entertaining non-technical explainer on what bitcoin is and why it matters.","duration":1227},
                {"id":"CqNEQS80-h4","title":"#Bitcoin #MCC2019 Luke Dashjr \\\"Briefly, Why Block Sizes Shouldn't Be Too Big\\\"","duration":1100},
                {"id":"qkBrK1Oaqkw","title":"Total global wealth in terms of bitcoin (3/4/24 update)","duration":97},
                {"id":"gEw951PsSFc","title":"Vijay Boyapati's Bullish Case for Bitcoin","duration":5137},
                {"id":"Qr4DyTFMxkI","title":"Bitcoin and DNA","duration":366},
                {"id":"YY4NqAC0O58","title":"F. Schubert, \\\"Trout\\\" quintet.","duration":2419},
                {"id":"6xIq0FdmsIA","title":"The Internet of Money: Five Years Later","duration":2359},
                {"id":"l3c8l4rgp6s","title":"Inside Costa Rica's Secret Bitcoin Community","duration":1139},
                {"id":"_9TI4Pzl-RQ","title":"SEPARATION OF MONEY AND STATE","duration":451},
                {"id":"SS8-qjP-yAo","title":"We Investigated Canada's Secret Bitcoin City","duration":851},
                {"id":"sLcNmZwMOz0","title":"Drunk People React To Bitcoin - Street Interviews!","duration":610},
                {"id":"QgapLaLlWac","title":"Sidechain RSK - Convidada Solange Gueiros","duration":4635},
                {"id":"XWfTyGpNXxM","title":"A Treatise on Metal Bitcoin Seed Storage Design","duration":1777},
                {"id":"SV-HZftkKXM","title":"Bitcoin's Blockchain History (Genesis - 923,040)","duration":112},
                {"id":"-PsbNprqTgI","title":"Bitcoin is not going to go away","duration":255},
                {"id":"4QVuQH2DEJM","title":"Orange Pill [OP23] - Bitcoin Reveals the Fiat Dark Ages","duration":4736},
                {"id":"CkfjTUzopho","title":"Bitcoin THRIVES in CHAOS!","duration":507},
                {"id":"W7hHoO0H3F0","title":"This Date Changed Everything for Bitcoin #FinancialFreedom #Satoshi","duration":48},
                {"id":"W2oRRGVo9xs","title":"What it Feels Like to Fall Down the Bitcoin Rabbit Hole | Guy Swann","duration":101},
                {"id":"l3VjHwheLX8","title":"Assembling Coldcard Mk4 3D printed battery case from BeansBulletsBTC","duration":126},
                {"id":"8b4kOK_aKuw","title":"Speaking Arabic With The Locals In Kuwait","duration":1507},
                {"id":"tCrC-3ItEko","title":"Cash Or Bitcoin? [2022]","duration":57},
                {"id":"H85UfhYV_pA","title":"Smart Money is Selling Real Estate for Bitcoin w/ Terence Michael","duration":6670},
                {"id":"rc744Z9IjhY","title":"The Greatest Crypto Explanation Ever? Understand Bitcoin and Crypto Like Never Before (from 2017)","duration":1099},
                {"id":"EELJ00mi91M","title":"What it Feels Like to Be a Bitcoiner in the 2020s | Guy Swann","duration":53},
                {"id":"LmUA_rWN4JQ","title":"Bitcoin Days Since All Time High (9/5/24 Update)","duration":99},
                {"id":"hc7TNDccwcs","title":"Bitcoin SURGES to 75k! Is RISK ON Regime Back","duration":593},
                {"id":"_m7KggCKicU","title":"4 - Bitcoin Is Actually LIFE ENERGY!","duration":155},
                {"id":"y48uAeHwZGg","title":"Bitcoin Has Officially Processed Over 1 Billion Transactions!","duration":97},
                {"id":"KW_wYvZ1eZg","title":"Andreas Antonopoulos: Bitcoin is not currency; it's the internet of money!","duration":5024},
                {"id":"v-fPWB9r9gk","title":"Revisiting The Patoshi Pattern","duration":1217},
                {"id":"6kQNGgZ4B6c","title":"Is Bitcoin Halal? [Birmingham, 2022]","duration":229},
                {"id":"7ZCfDHwtUuo","title":"Bitcoin: The Separation of Money and State","duration":392},
                {"id":"TeZiAhwkvKU","title":"EP8: Good for Bitcoiners, Good for Bitcoin w/ SeedSigner","duration":3782},
                {"id":"mhn9HgAhrss","title":"The MOST Important Thing to Understand about Money!","duration":281},
                {"id":"PBsmDwZFR6c","title":"We've officially mined 93% of all the bitcoin","duration":94},
                {"id":"zKAjd4IGbPQ","title":"Bitcoin HODL Waves Animation (11/9/25 Update)","duration":112},
                {"id":"FyK4P7ZdOK8","title":"Cryptocurrency Explained: Money as a System-of-Control","duration":1032},
                {"id":"hbp-vNcV54w","title":"The Bullish Case for Bitcoin w/ Vijay Boyapati","duration":6774},
                {"id":"TmOlADL_llQ","title":"Bitcoin Quantum Exposure Weekly Report (4/7/26 - 4/14/26)","duration":302},
                {"id":"bF5SMoqJEJQ","title":"Tariffs Explained In 60 Seconds","duration":73},
                {"id":"jZ35AD4ebAM","title":"Sold All My Bitcoin And Now I Regret It","duration":37},
                {"id":"k7baducIk-Y","title":"Bitcoin Historical Block Sizes (2/8/25 Update)","duration":53},
                {"id":"T_hXPEh8S60","title":"Becoming A Bitcoin Maximalist: The Journey [Asking REAL People]","duration":623},
                {"id":"PnWZPgo5jbc","title":"Importing an Airgapped Coldcard Bitcoin Wallet into Sparrow Wallet","duration":541},
                {"id":"xB5Xr-2SIpA","title":"BITCOIN HAS FAILED","duration":926},
                {"id":"_Y6xAwBB5_A","title":"Mastering Crypto Security: Safeguarding Your Digital World Isn't Magic - Jan 2024","duration":71},
                {"id":"arkn9rqczJ8","title":"I Asked Bitcoin Billionaires For Crypto Advice","duration":501},
                {"id":"vMuuL97uqnc","title":"Bitcoin Price Distribution Animation (11/11/24 Update)","duration":100},
                {"id":"o6TH_eZhYuY","title":"Bitcoin: Profit vs Loss Animation (8/20/24 Update)","duration":94},
                {"id":"PPNOJLn3hQs","title":"Bitcoin-Only BitBox02 Setup & Import Into Sparrow Wallet","duration":1310},
                {"id":"t427XrY6ofw","title":"The Surprising Sound of Silence, A Blast from the Past! (1 min video)","duration":66},
                {"id":"jqnI3OQA110","title":"Why Bitcoin's Correlation Is Breaking: Inflation Shock, Tech Selloff, and MicroStrategy Buying Spree","duration":315},
                {"id":"pJF_PAki4N8","title":"COLDCARD + Bull Bitcoin","duration":119},
                {"id":"S7LV9xJLz4Q","title":"The Fastest Asset Ever Built (0 to $1 Trillion Bitcoin Bedtime Story)","duration":7670},
                {"id":"5Uh720poZ8w","title":"What is Bitcoin? - Bitcoin 101","duration":157},
                {"id":"6qVq7T-NJdE","title":"Gen Z Knows the System Is Broken... Bitcoin is the Escape Plan","duration":4860},
                {"id":"_EVDtos8ZgI","title":"SPARROW: Learn The BEST Bitcoin Wallet In 15 Minutes!","duration":899},
                {"id":"HCRr9VkLA1A","title":"Spanish Tourist Gets 200,000 SATS (0.002 BTC)! #bitcoin #dublin #interview","duration":44},
                {"id":"QR6FuA_r4WY","title":"Why You Need Bitcoin | Full Interview With Vijay Boyapati","duration":3978},
                {"id":"oj_W3xOlt6U","title":"Cracking Unsafe Bitcoin Wallets + Coldcard Mk4 Warning (Insecure Dice Based Seeds & Private Keys)","duration":598},
                {"id":"6tEruQ1sl_c","title":"Why Can't we Just Save Money? Why Are We Forced to Invest?","duration":334},
                {"id":"licq7RxaCVE","title":"People Making Bitcoin Price Predictions in 2022","duration":432},
                {"id":"MzUqKbP33iA","title":"What is Bitcoin? | A Bitcoin for Beginners Guide by Saifedean Ammous","duration":607},
                {"id":"fvIVw0KF3NM","title":"Former Free State Project Prez calls for a Free Ross Movement","duration":603},
                {"id":"5lr7CSHKIIc","title":"Zooming out, what could bitcoin be worth? $1m, $5.5m, or $24m+ | Joe Burnett","duration":194},
                {"id":"ojXxuibPLp4","title":"What Does $6 Trillion Mean | Guy Swann","duration":278},
                {"id":"9y6glDnsH04","title":"3. Bitcoin's Environmental Impact","duration":319},
                {"id":"2_Hfmm7R_IE","title":"L. van Beethoven, Piano Concerto #5, Op. 73","duration":2419},
                {"id":"mnlskhJlWIU","title":"Bitcoin Market Cap Distribution Animation (8/28/24 Update)","duration":99},
                {"id":"9sK--GhseBE","title":"He Left 1,000,000 BTC and Disappeared - Satoshi Claus (Bitcoin Bedtime Story)","duration":4807},
                {"id":"CgCX1K-uD7o","title":"IS CRYPTO A SCAM? (ASKING THE PUBLIC)","duration":591},
                {"id":"Nls1keqHlz8","title":"Show This Video At The Dinner Table To Orange Pill Your Family! Bitcoin Explained SIMPLY!","duration":194},
                {"id":"coN7PaJte7k","title":"Bitcoin fixes money - Conversation with Tomer Strolight","duration":4041},
                {"id":"mUY_5ysXYOs","title":"The Genie, Bitcoin, and the Financial Dark Ages","duration":484},
                {"id":"f52ElIVn1so","title":"The system you hate is still your only option? #Bitcoin #Economy #Mindset","duration":64},
                {"id":"yQr5rJ3CEIc","title":"People Thought Bitcoin Was Expensive In 2021","duration":320},
                {"id":"vTwkW2KHgB0","title":"Why Bitcoin is an Issue of National Security","duration":442},
                {"id":"hW36zox-xR8","title":"Jack Mallers","duration":7084},
                {"id":"TFu9_nT_SAI","title":"Bitcoin Never Look Back Price (12/2/25 Update)","duration":109},
                {"id":"IuVkUqdqkcc","title":"buy bitcoin when it looks like this (thank me later)","duration":654},
                {"id":"6zRIE8ScGOM","title":"Bitkey Cold Storage from Jack Dorsey's Block: Self Custody with No Seed Phrase #partner","duration":29},
                {"id":"xxfUpIV9wRI","title":"Bitcoin Q&A: What is a Private Key?","duration":1098},
                {"id":"6vFgBGdmDgs","title":"Bitcoin: Money As A Content Type and the Grand Arc of Technology","duration":2118},
                {"id":"eo-0BgrKxiI","title":"Open Blockchains for Cashless Developed Economies","duration":2383},
                {"id":"jST-ZSwVEfw","title":"Giving Out Bitcoin To Strangers","duration":45},
                {"id":"Mvchzpbv2hE","title":"Bitcoin's REAL effect on the environment","duration":421},
                {"id":"Yo_oDkHRbGU","title":"How Inflation Destroys Civilization | Guy Swann","duration":60},
                {"id":"nJW37bfmsWA","title":"Ownership = Self-Custody | Reap The Full Advantages Of Bitcoin","duration":19},
                {"id":"og5zZssEWIc","title":"Bitcoin Street Interviews [Birmingham, 2022]","duration":473},
                {"id":"fetDXOjZ5Q4","title":"The Global Order Is Collapsing. What does this mean for Bitcoin?","duration":430},
                {"id":"8zM_1lOXtBU","title":"Bitcoin 2-of-4 Multisig Wallet Tutorial using Sparrow Wallet in Testnet","duration":3725},
                {"id":"n4F-h4xuXMk","title":"Worse than Useless: Financial Surveillance","duration":1270},
                {"id":"vLTGfSja_Xk","title":"Casually Explained: Bitcoin","duration":638},
                {"id":"83-Q19F_uw0","title":"BTC Map: U.S. Bitcoin Merchant Adoption Per 100k Population (12/19/25 Update)","duration":84},
                {"id":"ltxmMo7I9Fw","title":"Episode 8: Bitcoin Is Energy Backed Money","duration":338},
                {"id":"w9YktzBIazM","title":"Your money is spying on you","duration":649},
                {"id":"boWa573lchk","title":"What the h@!& is the Agentic Bitcoin Internet???","duration":434},
                {"id":"zdJiltpWi3A","title":"The 3 Biggest Bitcoin Myths (Stop Believing Them)","duration":827},
                {"id":"poa6kNXEJxw","title":"Watch this before the bitcoin revolution","duration":486},
                {"id":"7O10xS_sQoE","title":"The hidden tax you pay to rich people.","duration":437},
                {"id":"PeBE4VV6fWk","title":"Bitcoin Self-Custody Made Easy (Bitkey)","duration":944},
                {"id":"cdiVmxRaOoA","title":"Making self-custody safe with Jameson Lopp. Trezor Twitter Spaces","duration":6167},
                {"id":"thBDnb0QQdM","title":"How much bitcoin do you need to retire in 5 years? | Joe Burnett","duration":185},
                {"id":"3DDD2Iuauqg","title":"Guy Swann explains what is money, what is Bitcoin, and why Bitcoin is better money","duration":3472},
                {"id":"L5Lb1prBbHI","title":"Bitcoin will outlive the Pyramids","duration":445},
                {"id":"xAcaBBZrqlI","title":"Cash or Bitcoin? [2022]","duration":56},
                {"id":"ONfuVlCGQNA","title":"The world's most expensive clock","duration":429},
                {"id":"2-fEEC9_YT8","title":"BTC Map: Global Bitcoin Merchant Adoption (12/14/25 Update)","duration":194},
                {"id":"AmW0SWUogTI","title":"Michael Saylors Brilliant Waterfall Analogy Will Change How You See Bitcoin Forever | Joe Burnett","duration":629},
                {"id":"caPiK1H7xDM","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (1/28/25 Update)","duration":82},
                {"id":"Vny43gBOO-4","title":"Fractional Reserve Banking, Explained in 2 Minutes","duration":127},
                {"id":"bbCcXwdCB6A","title":"Dear Government... | Guy Swann","duration":60},
                {"id":"QeLuOC9NjlE","title":"Cash Or Bitcoin? [2022]","duration":57},
                {"id":"swVjVfq457k","title":"Simon Dixon's TEDx talk from 2012 with 2020 perspective.","duration":434},
                {"id":"P3U3jZTMXOk","title":"COLDCARD + Cove Wallet Quick Start Guide","duration":124},
                {"id":"56L0Mm1isIE","title":"I Don't Want To Know About Bitcoin","duration":23},
                {"id":"YrKo0QGWIuY","title":"Raspberry Pi Zero Project | Cryptocurrency Hardware Wallet","duration":441},
                {"id":"Idnf0BQQI04","title":"SENDING BITCOIN TO STRANGERS [2022] (now worth $1,000+)","duration":1019},
                {"id":"WPLsTgYWeBA","title":"Andreas M. Antonopoulos: Why I Bought Bitcoin [2024]","duration":3444},
                {"id":"Sxo169CCfIc","title":"How To Use Multisig Bitcoin Wallets With Electrum","duration":1471},
                {"id":"9VWduKV8EpE","title":"You're Not Too Stupid for Bitcoin Self-Custody-No One Taught You (Give us 3 Minutes","duration":178},
                {"id":"RLxi0jU-AXE","title":"Bitcoin Self Custody: Passphrases","duration":1937},
                {"id":"03V2j-KUFho","title":"Is Bitcoin Actually Just a Cult?","duration":1418},
                {"id":"3l4tn0v0Eyc","title":"Not your keys, not your Bitcoin #Bitcoin #Security","duration":38},
                {"id":"thjyTyyRlyU","title":"Inside A Kuwaiti Diwaniya [Kuwait Vlog]","duration":647},
                {"id":"n3iQ3UOWgZg","title":"Introducing Coldcard Mk5","duration":61},
                {"id":"yzJ9bRFkwmo","title":"How To Make A DIY Cold Storage Bitcoin Wallet","duration":1261},
                {"id":"3QH7ZTibV-Q","title":"How to Buy Bitcoin (in 2 minutes) - 2024 Updated","duration":161},
                {"id":"_oHkdEQ9AaI","title":"Is discipline really important?","duration":195},
                {"id":"_J_6ux6_Iy8","title":"Get started with bitcoin - Matt Odell","duration":41},
                {"id":"Y1FGz6rJR6A","title":"Is this one of the most IMPORTANT moments in Bitcoin History???","duration":847},
                {"id":"M1XPOFgjNPk","title":"What US Taxpayers With Crypto NEED to do before Dec 31, 2024 - Get into the Safeharbor!","duration":5871},
                {"id":"TbP8E0jwQJY","title":"Quantum Breaks Bitcoin? \\\"Never Going to Happen\\\"","duration":38},
                {"id":"Jab0pJklPwk","title":"The Ultimate Math of A Bitcoin Denominated World","duration":340},
                {"id":"QK88ICGn1-k","title":"SENDING BITCOIN TO STRANGERS IN 2022 [now worth +$2,000]","duration":442},
                {"id":"qKxDcK_2Uhg","title":"COLDCARD Spending Policy #bitcoin #selfcustody","duration":40},
                {"id":"-RZgq0mtD18","title":"Nick Szabo on Cypherpunks, Money and Bitcoin","duration":5978},
                {"id":"5VAX3JL_l90","title":"Bitcoin: Why collectivists win","duration":683},
                {"id":"qj0IGSc0sew","title":"Your 60/40 Portfolio Failed When You Needed It Most","duration":1034},
                {"id":"D2585vKzLb4","title":"Vijay Boyapati: The Bullish Case For Bitcoin","duration":3921},
                {"id":"RKZ0Wc55dFE","title":"Is the four year Bitcoin cycle finally over? #Wealth #Strategy","duration":61},
                {"id":"QabBSVF08KE","title":"Easiest way to Run a Bitcoin Node! | How to connect hardware wallet to your own Node with Sparrow.","duration":278},
                {"id":"EiW4lKrMXQ4","title":"My First Bitcoin Talk on Bitcoin Neutrality From 2013","duration":1822},
                {"id":"6ojBttz49cA","title":"Importing a Coldcard Bitcoin Wallet (& Labels from Sparrow) into Nunchuk","duration":1087},
                {"id":"3YdMXC9fpVY","title":"When Should You Sell Bitcoin? | Guy Swann","duration":414},
                {"id":"7uWMertPuGQ","title":"Top 10 Cryptocurrencies By Market Cap & Bitcoin Dominance (3/8/25 Update)","duration":149},
                {"id":"ZZKoSmQu30Q","title":"Best Bitcoin Hardware Wallet? Side-by-Side Comparison (2025 Edition)","duration":3621},
                {"id":"4YXklLh2srA","title":"Setting up a multisig wallet with Specter and Electrum","duration":428},
                {"id":"Vqn7bJZXX8Q","title":"Bitcoin Has No Competition","duration":705},
                {"id":"iAdmvl3Z_cM","title":"Clone Hardware Wallets. Same Seed on Multiple Devices (Trezor, Ledger, Keepkey, Coldcard, SafePal)","duration":357},
                {"id":"R2Ohxdwtp80","title":"Bitcoin and Banks - Breaking Bitcoin 2017 Paris","duration":1789},
                {"id":"tUZLc0sjlEE","title":"SALE ANNOUNCEMENT: Path to Self Custody Workshop Bundle Sale Through Jan 2024","duration":102},
                {"id":"XG7v4XFL7mc","title":"Stossel: Is Bitcoin Better Money?","duration":298},
                {"id":"ALyumQ90yz0","title":"Asking European Girls If I Can Send Them Bitcoin","duration":40},
                {"id":"DLsIcIoLSsI","title":"Bitcoin = Money + Time + Energy + Information by @dergigi","duration":1524},
                {"id":"l1si5ZWLgy0","title":"Introduction to Bitcoin: what is bitcoin and why does it matter?","duration":2237},
                {"id":"twxt4NpO-Hs","title":"Satoshi's Final Battle Against Fiat Money (The Lord of the Rings) | Guy Swann","duration":208},
                {"id":"H6PM4mbGwp8","title":"Bitcoin Hardware Wallet Unboxing - Setting Up Blockstream Jade Plus in Rose Gold","duration":63},
                {"id":"r34hkJBeE-M","title":"How I lost 14 bitcoins | My most expensive lessons","duration":555},
                {"id":"3fjKKApmAKM","title":"Alternative Education Meets Global Bitcoin Adventures - Michael From Trailblazer Academy - #011","duration":3746},
                {"id":"hRHkmrmrQCA","title":"The History of Money: From Barter to Bitcoin | Relaxing Sleep Story","duration":8505},
                {"id":"Rnw6aJM1ni8","title":"BTC Map: U.S. Bitcoin Merchant Adoption (12/16/25 Update)","duration":84},
                {"id":"RZZNQGJIC7A","title":"HOW MUCH BITCOIN SHOULD YOU BUY?","duration":873},
                {"id":"3B6asZvHoSA","title":"7. Is Bitcoin Too Expensive?","duration":367},
                {"id":"KU8rhQoe90M","title":"Joseph Haydn, Sonata in F Major, Hob XVI:23. Edisher Savitski,  Piano","duration":752},
                {"id":"oVKMN7oYSs8","title":"The Next 50 Generations: Bitcoin, Psychedelics, and Human Evolution","duration":697},
                {"id":"KG0Q05Lnm7s","title":"Why Bitcoin matters for human rights, in two minutes","duration":128},
                {"id":"u92BMyUzw9o","title":"The US Debt Crisis is Getting SCARY | Bitcoin is the Escape","duration":1061},
                {"id":"HD6vcASMA8o","title":"Bitcoin Target & Block Hashes Animation (5/23/25 Update)","duration":108},
                {"id":"djw0zYXyAlo","title":"Percent of the Network  #bitcoin","duration":89},
                {"id":"Z3RDnL1zN3M","title":"Bitcoin aligns incentives","duration":57},
                {"id":"wClCVfnfCpo","title":"Bitcoin Price Manipulation CONFIRMED! Jane St, ETF's and what happens next","duration":433},
                {"id":"n9QlPzzahXg","title":"DEAD AND ALIVE","duration":564},
                {"id":"ujQogDtaHU8","title":"What is Bitcoin? Simply explained by Peter Van Valkenburgh","duration":52},
                {"id":"6fu-w7gvPpk","title":"YOU ARE NOT PREPARED!!","duration":498},
                {"id":"jx37_PTwybs","title":"\\\"We're gettin' the bitcoin boyz!\\\"","duration":30},
                {"id":"O-P0ExXK7bY","title":"Bitcoin as a store of value (4/30/24 Update)","duration":51},
                {"id":"InDyHPcgNdk","title":"Bitcoin Security | Coldcard Q Air-Gapped Setup","duration":2280},
                {"id":"YeEy7pOre04","title":"The Best Bitcoin Hardware Wallet | ColdCard MK4 Setup Tutorial","duration":1084},
                {"id":"glrlipCbb1w","title":"Should You Move To Thailand?","duration":289},
                {"id":"tmaNeKVlvx0","title":"English Guy Speaks INCREDIBLE Arabic","duration":683},
                {"id":"hL-pFg3vZds","title":"Bitcoin Target & Block Hashes Animation (3/4/26 Update)","duration":116},
                {"id":"o-iDeLZ4BiE","title":"PAYNYMS In Sparrow Wallet - Privacy Preserving Public Bitcoin IDs","duration":1271},
                {"id":"lJSPwqOyGYQ","title":"When Everything Else Fails, Bitcoin Stays","duration":72},
                {"id":"MQvvLwxxxdM","title":"The Banks are BROKE","duration":102},
                {"id":"xQgY49OSpLE","title":"Bitcoin Price on This Day Animation (6/12/24 Update)","duration":91},
                {"id":"Xu4R3Ae0yrQ","title":"Bitcoin Target Hash Animation (9/11/24 Update)","duration":103},
                {"id":"QipRYAxErJ0","title":"BTC Map: Global Bitcoin Merchant Adoption Per 100k Population (12/21/25 Update)","duration":94},
                {"id":"X7adN61eEjg","title":"Bitcoin and the Kardashev Scale","duration":723},
                {"id":"jvi0EDzLFTU","title":"Open standards matter #bitcoin #selfcustody","duration":26},
                {"id":"Zz961ZSFgw8","title":"Twitter Integrates Bitcoin with Jack Mallers","duration":3300},
                {"id":"bCiIcbR8r9w","title":"Mastering Bitcoin Self-Custody with BTC Sessions","duration":2268},
                {"id":"gRvJBnlNxPY","title":"Tutorial - Build Specter DIY (your own hardware wallet)","duration":1184},
                {"id":"AcLjBo6c3j8","title":"Bitcoin Target Hash Animation w/ Tomer Strolight (5/29/24 Update)","duration":205},
                {"id":"5JDrK7sP3gA","title":"The Greatest Bitcoin Explanation of ALL TIME (in Under 10 Minutes)","duration":594},
                {"id":"MPyFfLboOFs","title":"Bitcoin: Daily DCA Cost Basis (9/24/24 Update)","duration":85},
                {"id":"HPkjH3Yeih4","title":"What is the ONE THING Preventing Bitcoin from Reaching $100k? [ASKING PEOPLE]","duration":623},
                {"id":"jk89usrtNEk","title":"Bitcoin 101 - Getting Your BTCs out of Your Paper Wallets & Cold Storage - Fun with Sloppy Wallets","duration":654},
                {"id":"Otoz02b9PiY","title":"\\\"Bitcoin Cultures\\\" presentation for Strike","duration":3337},
                {"id":"yVs_9zcnHrw","title":"Roger 9000 - SATOSHI SET ME FREE (Clip)","duration":94},
                {"id":"fw3WkySh_Ho","title":"Consensus Algorithms, Blockchain Technology and Bitcoin UCL - by Andreas M. Antonopoulos","duration":5062},
                {"id":"_w4hgpCdr4M","title":"Bitcoin Lightning Payments From Cold Storage? Jade Plus is the First Hardware Wallet To Do It","duration":45},
                {"id":"zob5dUOAcv0","title":"Bitcoin 1Y, 2Y, 3Y, 4Y Candles Animation (5/18/25 Update)","duration":109},
                {"id":"pSTNhBlfV_s","title":"Watch Crypto expert explain the Blockchain to Congress","duration":356},
                {"id":"tlQGO-Na7Io","title":"How to Transfer Your Bitcoin from Ledger to Coldcard","duration":1523},
                {"id":"DDOgW7F3YNs","title":"The $1M Bitcoin Bet with Balaji Srinivasan and Alex Gladstein (WiM289)","duration":4841},
                {"id":"nkNhSPxFsnY","title":"The Bitcoin Standard | Saifedean Ammous","duration":965},
                {"id":"z3sldY-4ZKM","title":"How to Check, Delete, & Recover a Bitcoin Seed Phrase","duration":1746},
                {"id":"Hzg5f1U4dkw","title":"14 PEOPLE TURNING DOWN FREE BITCOIN [2022]","duration":700},
                {"id":"ywka38FnqqY","title":"The Tragic Story of Telling your Friends to Buy Bitcoin (2011-2021)","duration":178},
                {"id":"FAYmE5-40PQ","title":"Coldcard Bitcoin Hardware Wallet - FULL TUTORIAL","duration":6890},
                {"id":"ABvcLlv457k","title":"Blockstream App 5.2.0: Lightning Payments From Cold Storage","duration":122},
                {"id":"a7fmTcHIyQQ","title":"Is Bitcoin entering a SUPERCYCLE? What does this mean for the price?","duration":446},
                {"id":"WkkBma768h8","title":"Why Psychedelics Unlock Hidden Dimensions of the Mind","duration":900},
                {"id":"SSo_EIwHSd4","title":"How does a blockchain work - Simply Explained","duration":360},
                {"id":"LZBUJwHhH24","title":"Regulators Isolate the Bitcoin Industry | Hard Money","duration":603},
                {"id":"gt4HBSUjENE","title":"Would You Rather have $100 Or 1 Bitcoin?","duration":486},
                {"id":"GSwW5yCse1s","title":"Edisher Savitski-Chopin Sonata #3 in B Minor, Op. 58","duration":1846},
                {"id":"6W9BH4jsjHM","title":"Teaching In Thailand: Is The Grass Greener?","duration":720},
                {"id":"wH6l0D4kopw","title":"Where do I go from here?","duration":278},
                {"id":"IOzCrgCDSy8","title":"4. Is Bitcoin Just for Criminals?","duration":182},
                {"id":"EbV6CqoBM1Y","title":"looking for the best way to store your seed phrase?","duration":57},
                {"id":"HVHLkd2HV1Y","title":"Vijay Boyapati on The Evolution of the Bullish Case for Bitcoin","duration":842},
                {"id":"D3n6lLeuPQA","title":"\\\"Seven distinct network effects of bitcoin\\\" - Trace Mayer","duration":469},
                {"id":"r7lm7IHnKDw","title":"The Bitcoin Revolution in Africa: Explained","duration":1014},
                {"id":"8J2xIqLhcB4","title":"Bitcoin Supply Distribution Animation (8/31/24 Update)","duration":99},
                {"id":"j3mFJhqKF1g","title":"Tomers 90 minute intro to bitcoin","duration":7191},
                {"id":"ztTICG37kxA","title":"I asked strangers about bitcoin... it got awkward","duration":403},
                {"id":"dDa4UrYZCPA","title":"1.  Is Bitcoin's Volatility a Bad thing? Or an Advantage?","duration":438},
                {"id":"5YDJfqxFaCI","title":"Bitcoin 200 Day Moving Average & 200 Week Moving Average (8/25/24 Update)","duration":94},
                {"id":"dcyCOre17Bc","title":"BITCOIN BULL RUN 2025. WATCH THIS.","duration":485},
                {"id":"Cj9sWNgx9KU","title":"One bitcoin is all you need","duration":97},
                {"id":"gi7w4Xzvpt8","title":"M. Mussorgsky \\\"Pictures at an Exhibition\\\". Edisher Savitski, Piano","duration":1976},
                {"id":"gwABJO-kaM8","title":"Buying Bitcoin Using Dollar Cost Averaging & Avoiding Dust UTXO - Self Custody Series - Feb 2024","duration":390},
                {"id":"I1uefzJJ6nM","title":"Bitcoin 101 - Intro to Paper Wallets & Cold Storage - Bitcoin Security & Fun with Sloppy Wallets","duration":1617},
                {"id":"EAKmVV2pe8k","title":"Zoom out: How to think about bitcoin | Joe Burnett","duration":220},
                {"id":"BnHLSB08W2M","title":"Bitcoin UTXO Management with Nunchuk Wallet","duration":1630},
                {"id":"Wvz86FGjSfo","title":"READY!!! BITCOIN TARGET $450.000 ACCORDING TO THIS AMAZING CHART!!! HODL ADA and SOL or SELL??","duration":879},
                {"id":"H_kQb8xG5Bo","title":"2. Is Bitcoin A Ponzi Scheme?","duration":299},
                {"id":"BfUJnKFacNU","title":"SVB, Signature Bank and Silvergate Were PURPOSEFULLY Collapsed In Order To CRUSH Crypto","duration":1114},
                {"id":"UNt_tC9kId8","title":"Take Self-Custody of Bitcoin Off the Exchange in Minutes! Blockstream Jade Plus Setup","duration":71},
                {"id":"7EmshGDXi04","title":"Bitcoin Replace By Fee & Child Pays For Parent Tutorial using Sparrow Wallet","duration":911},
                {"id":"P88istScPxM","title":"Bitcoin Daily DCA & HODL Animation (2/13/24 Update)","duration":81},
                {"id":"krzoDpWfVq8","title":"BR096 - OP_RETURN Debate, Core Governance, Future Soft Forks, COLDCARD + MORE ft. Rob, Odell & Craig","duration":3984},
                {"id":"xyxRCwJVBUc","title":"Bitcoin Expert Breaks Down Historic RFK Jr. Speech","duration":1149},
                {"id":"d7ID3fKAFQM","title":"Jack Mallers \"Intro to Bitcoin\" at Bitcoin Atlantis 2024","duration":2859},
                {"id":"nEfUJtpZc_o","title":"Bitcoin Can be used for good or ill","duration":31},
                {"id":"GZokpamL-84","title":"AI, Energy, Bitcoin: The Foundation of the Future","duration":365},
                {"id":"o5LZML8VaE4","title":"Episode 10 - What happens when Bitcoin wins?","duration":274},
                {"id":"55oRomg3D1Y","title":"Revisiting The Patoshi Pattern: The Double Helix","duration":68},
                {"id":"32SZtxE0sWQ","title":"Coinkite BLOCKCLOCK Comparison - mini vs. micro","duration":422},
                {"id":"wgMFxpRP70o","title":"Bitcoin as a store of value (11/23/24 Update)","duration":55},
                {"id":"L-jWILQF5l0","title":"Is Bitcoin Inevitable? The Answer Might surprise you!","duration":414},
                {"id":"exK5yFEuBsk","title":"Remember, remember the 5th of November #bitcoin","duration":127},
                {"id":"prHax4yrncY","title":"Programmable Money: Hard Promises, Soft Contracts by Andreas M. Antonopoulos","duration":681},
                {"id":"4tqXvMNOuHk","title":"Bitcoin's ethical superiority, explained simply by @exitmanual","duration":45},
                {"id":"Pc_C-xI3b88","title":"Bitcoin vs Gold [are you ready?]","duration":57},
                {"id":"llCrHefbZa0","title":"Bitcoin Hardware Wallet Glow-Up 🚨 Jade Plus in Rose Gold, Stealth Black & Soverign Green Launches","duration":11},
                {"id":"lrSWrVSkT1U","title":"Bitcoin In 60 Seconds","duration":75},
                {"id":"vwkRsp0gqX4","title":"Bitcoin Halving 2024: How It's Different This Time, Myths Debunked, Bitcoin Bugs, and More","duration":890},
                {"id":"So6g2yq_978","title":"Baltic Honeybadger (2017)","duration":6133},
                {"id":"gp2PdFuY2-I","title":"If Someone Steals Your Hardware Wallet, Can They Get Your Bitcoin?","duration":82},
                {"id":"1H7FqG_FmCw","title":"Assembling Specter-DIY hardware wallet in 5 minutes","duration":338},
                {"id":"tLHn38mDXW8","title":"Bitcoin Target Hash Animation (3/7/25 Update)","duration":107},
                {"id":"V9msCz-Uppo","title":"What is the long term growth rate of bitcoin? | Joe Burnett","duration":187},
                {"id":"Ae4nF0Bu75I","title":"Bitcoin is long-term Savings Technology","duration":49},
                {"id":"LgI0liAee4s","title":"Escaping the Global Banking Cartel - Bitcoin as an Exit","duration":2213},
                {"id":"EqoYtMS8FZU","title":"Hack-Proof Bitcoin in 15 min: Coldcard Q Setup for Total Beginners","duration":993},
                {"id":"jkSeosiLmh4","title":"How to mine BITCOIN with your Home PC or Laptop!","duration":784},
                {"id":"kBoSO7612v0","title":"Top 10 Cryptocurrencies By Market Cap & Bitcoin Dominance (9/18/25 Update)","duration":80},
                {"id":"7ro85G6kclk","title":"Bedtime Finance: The Story of Bitcoin and Cryptocurrency","duration":8405},
                {"id":"0izbzc44Qcs","title":"Bitcoin Stock2FOMO Model (11/13/24 Update)","duration":79},
                {"id":"ES7f2gBNMe0","title":"When Is the Best Time To Buy Bitcoin?","duration":328},
                {"id":"kd8ReEcAi0A","title":"How War Broke the Gold Standard","duration":111},
                {"id":"9WJgukEL168","title":"Hockey, Homeschooling, and Bitcoin - Brandon Gentile - #009","duration":5295},
                {"id":"NuKcDkaH2fc","title":"Orange Pill [OP40] - The Dust Bowl of Money","duration":5285},
                {"id":"VKCVJFzGXLc","title":"How the Petrodollar Took Over the World","duration":60},
                {"id":"R87W6PFl868","title":"Top 10 Cryptocurrencies By Market Cap & Bitcoin Dominance (12/7/25 Update)","duration":83},
                {"id":"leqjwiQidlk","title":"Milton Friedman Predicts Bitcoin In 1999","duration":268},
                {"id":"MjMPDUWWegw","title":"COLDCARD Co-Sign (CCC)","duration":203},
                {"id":"BagsxlVsog0","title":"WHY ARE WE BULLISH? Giacomo Zucco, Roman Reher, Ioni Appelberg","duration":7230},
                {"id":"cqg9EeydwRc","title":"Bitcoin OG Is Still Bullish In 2022 [UNCUT]","duration":711},
                {"id":"W3xniwhdpTk","title":"BTC Map: Latin America Bitcoin Merchant Adoption Per 100k Population (12/27/25 Update)","duration":85},
                {"id":"D7uSIlNXYag","title":"Total global wealth in terms of bitcoin (7/18/25 update)","duration":107},
                {"id":"n_bU0bSJglw","title":"Don't Lose Your Bitcoin Generational Wealth | BTC Sessions","duration":4336},
                {"id":"85dpFHybONw","title":"Why Bitcoin Will Survive Any Attack - Even Nuclear War! | Tomer Strolight","duration":849},
                {"id":"_13CHbTGu-Q","title":"Tucker Carlson advises us to buy Bitcoin","duration":418},
                {"id":"MXGHLlFQfY8","title":"L. Van Beethoven, Sonata Op. 26 in A-flat Major. Edisher Savitski, Piano","duration":1126},
                {"id":"vTllOOLlJEI","title":"COLDCARD Bag Number check #selfcustody #bitcoin","duration":15},
                {"id":"xegEpCLT0CQ","title":"A Practical Approach To Orange Pilling w/ Sam Wouters","duration":1060},
                {"id":"Ut1g5fFeamc","title":"Are You Built for Bitcoin's Volatility?","duration":57},
                {"id":"Anu0kDFTQvc","title":"Why Bitcoin Will Become the Next Global Reserve Asset","duration":360},
                {"id":"xXUIIlVSJ3g","title":"Why Does Bitcoin Scale In Layers? | E96","duration":464},
                {"id":"HaJ1hvon0E0","title":"Bitcoin: Where the Laws of Mathematics Prevail","duration":1428},
                {"id":"JjnaYQIUZLw","title":"Why Stablecoins Supercharge Bitcoin Adoption","duration":470},
                {"id":"4bHAQOevZrI","title":"Bitcoin: Everything a trade","duration":413},
                {"id":"oMTg9yGQVOg","title":"Why don't I talk to women? When will I return to Kuwait? Who is my role model? [Mike Still Q&A 2024]","duration":1636},
                {"id":"wk6-nqOkZMc","title":"Advanced Civilizations Don't Print Money, They Harvest Energy #kardashev #bitcoin","duration":86},
                {"id":"G-25w7Zh8zk","title":"Bitcoin: A New Species of Money - An Evolutionary Perspective on Currency","duration":4844},
                {"id":"HT9x5oU6yYo","title":"Bitcoin On-Chain and Cycle Analysis: The Rational Root","duration":1417},
                {"id":"4ufIptJY5Ss","title":"Visiting The Hottest Country On Earth 🔥 Kuwait Vlog 🇰🇼","duration":3617},
                {"id":"Ngp5tNxX22k","title":"Why is Bitcoin Mining Even a Thing? | Guy Swann","duration":476},
                {"id":"bohI45qhHA0","title":"Bitcoin is Rational Optimism, Altcoins are Nihilism - American Hodl","duration":140},
                {"id":"bsOUzoC0jdg","title":"AI Will Copy Everything Digital - EXCEPT BITCOIN.","duration":377}
            ]
        },
        {
            "id": "conferences-events",
            "name": "Conferences & Events",
            "emoji": "🎤",
            "desc": "Bitcoin conference speeches & keynotes",
            "color": "#6366f1",
            "videos": [
                {"id":"Ps3BU0edwqE","title":"Adopting Bitcoin 2024 | Day 2 Livestream","duration":27456},
                {"id":"L0Yh6VP6vxU","title":"Open Source Stage - #Bitcoin 2022 Conference - DAY 2","duration":16817},
                {"id":"NKl-c-TS3yM","title":"Covenants - Open Source Stage - Bitcoin 2022 Conference","duration":2373},
                {"id":"rSSnyJpFNZU","title":"Bitcoin 2021: Banking The Unbanked | Jack Dorsey & Alex Gladstein","duration":1821},
                {"id":"IjR3Hj0aRW4","title":"Howard Lutnick at Bitcoin Conference 2024 in Nashville","duration":1250},
                {"id":"4S6lzgc7tFc","title":"Bitcoin Beyond Capital: Freedom Money for the Global South w/ Femi Longe | MIT Bitcoin Expo 2025","duration":1618},
                {"id":"M-PIOaHxX4c","title":"BitVM Creator Explains: This Breakthrough Will REVOLUTIONIZE Bitcoin w/ Robin Linus","duration":1032},
                {"id":"M6LhYlKOrVI","title":"Web5: Explained by Daniel Buchner (Block) - Bitcoin 2023 Conference in Miami","duration":798},
                {"id":"2qiJIFBJPIU","title":"The Bitcoin Conference 2025 | Day 3 Livestream","duration":36592},
                {"id":"9e5JejAWrwY","title":"The Bitcoin Conference 2025 | Day 1 Livestream","duration":42898},
                {"id":"j7R6CLnWI4M","title":"Open Source Stage - #Bitcoin 2022 Conference - DAY 1","duration":18352},
                {"id":"r8rQUEyAksg","title":"BITCOIN DAY 2024","duration":30696},
                {"id":"veIuDwQTunw","title":"Olaoluwa Osuntokun: Keynote - Open Source Stage - Bitcoin 2022 Conference","duration":1064},
                {"id":"rNok4Ht6n1E","title":"Bitcoin, Not Crypto: Why Bitcoin-Only VC Will Win w/ Nico Lechuga | MIT Bitcoin Expo 2025","duration":800},
                {"id":"--IFcOIEfl4","title":"Jack Mallers - There Is No Second Best (BTC Prague 2024 Keynote)","duration":2632},
                {"id":"MZEO1-XVaWM","title":"Bitcoin Is an Exit Strategy (Not Crypto) | Keynote","duration":1164},
                {"id":"-NlgxiLgqZo","title":"Why Nostr Feels Like Bitcoin in 2012: Vitor Pamplona | MIT Bitcoin Expo 2025","duration":957},
                {"id":"n3Md7m4UQSQ","title":"Preventing Attacks On Bitcoin - Open Source Stage - Bitcoin 2022 Conference","duration":1502},
                {"id":"HGyiOlXg-XY","title":"Top 10 Most ICONIC Bitcoin Conference Moments","duration":303},
                {"id":"p6kBKSZqjn4","title":"2024/2025 Bitcoin Bull Market Overview w/ James Check (BTC210)","duration":3916},
                {"id":"gu9OulAijy4","title":"The Pacific Btc Conference Presented by @Swan_Bitcoin","duration":840},
                {"id":"f3NBhSXtE5g","title":"Edward Snowden Bitcoin 2024 Keynote Speech","duration":1840},
                {"id":"DortAVYgd4Y","title":"Why Bitcoin 2026 Could Be the Most Important Conference Yet","duration":1652},
                {"id":"wAv0T2nX0v0","title":"Strategy CEO Phong Le: MIT Bitcoin Expo 2025 Keynote Speech","duration":1474},
                {"id":"VKC0__vEbc8","title":"The Future of Corporate Bitcoin Adoption | MIT Bitcoin Expo 2025","duration":2437},
                {"id":"Nqt3BClxlpk","title":"Strategy CEO Phong Le: MIT Bitcoin Expo 2025 Keynote Speech","duration":1474},
                {"id":"hzcmndorLwQ","title":"Michael Saylor: Bitcoin + Digital Credit = The Future of Money | Full Keynote","duration":2225},
                {"id":"R4gyS5mb9dE","title":"Alex Gladstein: Bitcoin is the Most Powerful Human Rights Tech of the 21st Century","duration":1160},
                {"id":"75O56lhJMJI","title":"Welcome to Bitcoin Country - Adopting Bitcoin 2024","duration":808},
                {"id":"gn5sQC19rvM","title":"The MIT Digital Currency Initiative and the Future of Bitcoin Research w/ Neha Nerula","duration":1327},
                {"id":"XT-B9k9t5B8","title":"LIVE: The MIT Bitcoin Expo 2025 | Day 2","duration":30819},
                {"id":"xCyPbFx0Ktg","title":"Why Bitcoin Must Change - Or Be Left Behind w/ Jameson Lopp","duration":1439},
                {"id":"6fgFyQEWiK4","title":"Saifedean Ammous Bitcoin Amsterdam 2025 Keynote Speech","duration":1692},
                {"id":"SVJCpnSANG4","title":"Building Bitcoin Insurance for Financial Institutions w/ Anchorwatch | MIT Bitcoin Expo 2025","duration":1001},
                {"id":"3e3KE40r_WM","title":"The Bitcoin Conference 2025 | Day 1 Livestream","duration":33012},
                {"id":"W8mpzwCf8SE","title":"Bitcoin 2021: How To Value Bitcoin","duration":748},
                {"id":"pt-Wv-M5uNA","title":"Bitcoin MENA 2025 | Day 1 Livestream","duration":34980},
                {"id":"dWaHWT15sOQ","title":"Paolo Ardoino: Why Tether Loves Bitcoin | Bitcoin 2025","duration":1030},
                {"id":"pZvy0JRz9GE","title":"279. Bitcoin and Tether: Las Vegas Keynote","duration":2576},
                {"id":"YQrfB9327jI","title":"Bitcoin Amsterdam 2025 | Day 1 Livestream","duration":30967},
                {"id":"4NoJnPmCVdU","title":"Solving Bitcoin's Quantum Computing Threat: BIP 360 With Hunter Beast | MIT Bitcoin Expo 2025","duration":1004},
                {"id":"fePW13cq4eM","title":"Wartime Bitcoin - Bitcoin 2022 Conference","duration":1520},
                {"id":"kE3TpVS27os","title":"Bitcoin Conference Las Vegas LIVE: JD Vance delivers Keynote Address at Bitcoin Conference | N18G","duration":42897},
                {"id":"pDA2r4AblD0","title":"How To Orange Pill Anyone | Dante Cook at BitBlockBoom 2025","duration":2119},
                {"id":"vRuPeBAjLTI","title":"JIMMY SONG | DESTROYING RENT SEEKING | BITBLOCKBOOM 2024","duration":1949},
                {"id":"ng3dRbm2PHs","title":"Funding Bitcoin Open Source - Bitcoin 2022 Conference","duration":1621},
                {"id":"tO1QTCLrbB8","title":"Matt Odell: Bitcoin-Native Venture Capital | MIT Bitcoin Expo 2025","duration":1724},
                {"id":"TTHU_N_n5Ks","title":"PlanB Forum Lugano 2024 interviews SLP612","duration":2854},
                {"id":"OwJL0J_nPDE","title":"Open Source Stage - #Bitcoin 2022 Conference - DAY 3","duration":16733},
                {"id":"P1n7XipTCck","title":"The Bitcoin 2024 Conference Livestream | GA Day 2","duration":35273},
                {"id":"XVGME04z_3k","title":"Bitcoin Amsterdam 2025 | Day 2 Livestream","duration":28161},
                {"id":"3FW7jNB9Qp0","title":"Bitcoin 2022 Conference - The Future of Lightning Development - Open Source Stage","duration":1790},
                {"id":"HVKq5qfZSqU","title":"FractalEncrypt Bitcoin Full Node book and canvas at Bitcoin 2022 Conference","duration":48},
                {"id":"9UxAUryUKXM","title":"Donald Trump Bitcoin 2024 Keynote Speech","duration":2979},
                {"id":"BtbUGFHZTW8","title":"Federated Chaumian Mints Overview - Bitcoin 2022 Conference","duration":830},
                {"id":"cOmUpp3J9Ck","title":"Living on Bitcoin 2020 -- what it's REALLY like!","duration":1021},
                {"id":"bLEv8FcfxfE","title":"Why Bitcoin-Backed Lending Will EAT the World | Mauricio di Bartolomeo @ MIT Bitcoin Expo 2025","duration":875},
                {"id":"SFUiGTayVL8","title":"Saifedean Ammous: Bitcoin & Tether - Drinking The Dollar Milkshake | Bitcoin 2025","duration":858},
                {"id":"LsLKr_dWdpU","title":"The Eric Semler Interview | MIT Bitcoin Expo 2025","duration":704},
                {"id":"M2zGs2E-pfs","title":"The Future of Corporate Bitcoin Adoption | MIT Bitcoin Expo 2025","duration":2437},
                {"id":"jc4lkDeozCQ","title":"WATCH LIVE: Eric Trump speaks at Bitcoin Asia conference","duration":2448},
                {"id":"eRgHb8BGs18","title":"Adopting Bitcoin 2024 | Day 1 Livestream","duration":32400},
                {"id":"sNE-2ffq5MA","title":"Fighting for Freedom Under Zimbabwe's Hyperinflation: Evan Mawarire | MIT Bitcoin Expo 2025","duration":1629},
                {"id":"e_yg6cLsQHE","title":"Bitcoin Address Poisoning Attacks w/ Jameson Lopp | MIT Bitcoin Expo 2025","duration":1548},
                {"id":"IXKLholMqwE","title":"Former CFTC Chairman Tim Massad: Bitcoin & Digital Identity | MIT Bitcoin Expo 2025","duration":424},
                {"id":"RoRZE2DpEzE","title":"Jack Mallers Bitcoin 2025 Keynote Speech: The HODLers Dilemma","duration":2099}
            ]
        },
        {
            "id": "culture-travel",
            "name": "Culture, Travel & Adoption",
            "emoji": "🌍",
            "desc": "Bitcoin culture worldwide & global adoption",
            "color": "#f97316",
            "videos": [
                {"id":"dKld7vP7jz0","title":"041 - Niko Laamanen: Leaderless Organisations, Moving to Madeira & Bitcoin Adoption","duration":4900},
                {"id":"Qaj7TfHxVBU","title":"El Salvador's Broken Bitcoin Revolution","duration":2012},
                {"id":"mkDpE6SjjCQ","title":"Did the IMF just KILL BITCOIN in El Salvador?","duration":913},
                {"id":"eO5_xYBXiVk","title":"Knots (BIP110) Debate from Plan ₿ Forum El Salvador 2026 - Luke, Mechanic, Bier, Tone, Giacomo","duration":2870},
                {"id":"Isrhajmf9cc","title":"Anita Posch, Bitcoin for Fairness Executive Director & Bitcoin Advocate In Conversation With Trevor","duration":4233},
                {"id":"pLIxmIMHL44","title":"Bitcoin Nation State Adoption Paradox - A Trojan Horse w/ Alex Gladstein (BTC231)","duration":3792},
                {"id":"JhxFbvgqvwU","title":"Alex Gladstein | Argentina's Bitcoin Adoption | EP 137","duration":3630},
                {"id":"WoN0SVY73zo","title":"You can live on #bitcoin in Lugano - Documentary with Joe Nakamoto - Cointelegraph","duration":1018},
                {"id":"koshi4yTzQo","title":"\\\"I Don't Depend on Anyone Anymore\\\" - Bitcoin in Mozambique","duration":1083},
                {"id":"TauW_pLnstw","title":"The Bitcoin Paradise You've Never Heard Of (Curaçao)","duration":1274},
                {"id":"D22zHDCE6-0","title":"Did El Salvador Just Give Up On Bitcoin?","duration":837},
                {"id":"emS6_vlQKa4","title":"EVERYDAY BITCOIN #3 - ISA SANTOS (BTC ISLA, GET BASED)","duration":2654},
                {"id":"sIR0V6VKXLg","title":"How One Woman is Building a Bitcoin Economy From Scratch in Mexico | Isabella Santos @btcisla","duration":4517},
                {"id":"BoHNkX4OWQA","title":"Strike CEO Jack Mallers on bringing bitcoin to El Salvador","duration":244},
                {"id":"etury0dNkIU","title":"Stephen Dodge: Are high bitcoin transaction fees secretly killing Bitcoin forever for average pleb?","duration":3938},
                {"id":"Y0KSCjo2IJI","title":"Reflecting on Bitcoin Legalization in El Salvador - Bitcoin Spaces","duration":5912},
                {"id":"BnR_kB44hy0","title":"Bitcoin Berlín: The Secret Bitcoin City of El Salvador ","duration":691},
                {"id":"3GZ0ygDSbV0","title":"The Challenges Of Using Bitcoin In Zimbabwe | Alexandria | The Anita Posch Show #152","duration":5298},
                {"id":"BBZvTt8oErU","title":"Prospera ZEDE - MUST VISIT Private/Bitcoin City w/ Erick A. Brimen - Roatan, Honduras","duration":5335},
                {"id":"IRnygiyuG0k","title":"Twitter Spaces: LIVE from El Salvador Congress - La Bitcoinizacion","duration":4605},
                {"id":"QV-m5lNLxeM","title":"Interview with Julian Figueroa From Get Based","duration":4741},
                {"id":"vlf4swtTBSM","title":"Isla Mujeres is Becoming a Bitcoin Paradise! (Here's How) 🇲🇽⚡","duration":314},
                {"id":"cs3nEVX9ZWA","title":"The Financial Privilege Gap. Alex Gladstein on Freedom, Money, Bitcoin and Human Rights.","duration":1795},
                {"id":"0xcYAr-UtZk","title":"#26 Anita Posch - Bitcoin Education in Africa","duration":3331},
                {"id":"e0EPQg20SaQ","title":"I wasted 5 years learning this about bitcoin... I'll teach you in 9 minutes","duration":555},
                {"id":"kKSFh5Xxe3w","title":"Surviving on BITCOIN for 48 Hours in El Salvador 🇸🇻","duration":1272},
                {"id":"r7Mn07CIJVk","title":"#092 Andreas M. Antonopoulos: Bitcoin Outlook 2021","duration":3263},
                {"id":"d5RiLf9LdSo","title":"Simply Bitcoin Interview by Nico Moran at Plan B El Salvador 2026","duration":1798},
                {"id":"qoGuqqrXowY","title":"André Loja on Bringing Bitcoin to Madeira","duration":3404},
                {"id":"hwchWBR451A","title":"Sovereign Individuals Spend & Replace Bitcoin with André Loja | SLP695","duration":3692},
                {"id":"Ve6oLiWO0Mg","title":"What Happens When You Travel Using Only Bitcoin? | Airbtc in XFounders Stories","duration":1132},
                {"id":"7d7yJktKr2U","title":"Is El Salvador Bending the Knee to the IMF with John Dennehy #15","duration":3454},
                {"id":"xnkgvaCgLTQ","title":"Javascript and Bitcoin -- Lesson 3 of the Pleb Dev Course","duration":3876},
                {"id":"FelWKV6wVJU","title":"Living on Bitcoin in a Small Town. Is it even possible?","duration":1276},
                {"id":"0hwC6BKJMpc","title":"The Hidden Travel Fees Costing You $240 Per Trip (Bitcoin Fixes This)","duration":592},
                {"id":"KcV9Dhz9gHY","title":"Rebuilding El Salvador's Cattle Industry with Tom Taber","duration":2954},
                {"id":"DfDWubdqU5I","title":"I BEGGED STRANGERS FOR BITCOIN... and it worked!!!","duration":833},
                {"id":"bHLEA9fRUQc","title":"Building Bitcoin for Africans, By Africans: Lessons From 5 Years on the Ground - ABC 2025","duration":627},
                {"id":"pxvDunp9820","title":"Bitcoin in Peru: How a Poisoned Town in the Amazon Survives","duration":666},
                {"id":"u5EQ92mNK5U","title":"🌀 The Age of Truth: Bitcoin, Nihilism & The End of Fiat Delusions | High Hash Rate Podcast","duration":3976},
                {"id":"gCi5jPHWVNE","title":"Run with Bitcoin | Paco De la India | World Mumbai Forum 2021","duration":1759},
                {"id":"2iHqeCy16os","title":"How to build your own Bitcoin Citadel","duration":5299},
                {"id":"dYFMoK1nDmc","title":"How bitcoin came to El Zonte, according to Mike Peterson","duration":65},
                {"id":"VJLPkapxNRw","title":"Bitcoin für die Zivilgesellschaft - Freiheit, Privatsphäre und Selbstbestimmung","duration":1294},
                {"id":"0Ceey82hFTY","title":"Travel the WORLD and EARN CRYPTOCURRENCY!","duration":759},
                {"id":"A2FMkHpO-eY","title":"Building a Bitcoin Citadel Mindset , with Brad Mills | Relai Bitcoin Podcast #114","duration":3607},
                {"id":"BdaiLtKNFQA","title":"Paco de la India - the name Run With Bitcoin, the plan 40 Countries in 400 Days, the results AMAZING","duration":4320},
                {"id":"UPp0Xbk4bFo","title":"The Truth Behind Cuba's Bitcoin Revolution | What it Really Looks Like","duration":1602},
                {"id":"7A56oZAs7ZQ","title":"Adam Back Denies He Is Anonymous Bitcoin Founder Satoshi Nakamoto","duration":1067},
                {"id":"4W4QeJ_djos","title":"Bitcoin is Freedom Money with Anita Posch","duration":3169},
                {"id":"KmQ0ft3Gr-8","title":"Lina Seiche: Reality of Life in El Salvador, Nayib Bukele, Safety, Bitcoin, Business & Why Move Here","duration":3375},
                {"id":"UoVsYht7cIo","title":"Isabella Santos - The Unique Voice of Education, Entertainment & Empowerment | Ep. 40","duration":4227},
                {"id":"CfpxNSI4HJ0","title":"Bitcoin Entrepreneur Reveals Why 6-Figure Earners Are Still Poor","duration":4898},
                {"id":"0x0yLT5LVM0","title":"Build Your BITCOIN CITADEL! Personal Freedom Revolution | Takota Coen","duration":3801},
                {"id":"rudY3-9X7gU","title":"I'm Back From El Salvador","duration":543},
                {"id":"NgGV3CYj3fI","title":"Bitcoin Adoption in Zimbabwe by YeBo Bitcoin","duration":508},
                {"id":"XCIth8DRuL8","title":"Toxic Happy Hour #52 - 6 Toxic Ladies Talk Bitcoin w/Pubby and Danish","duration":10768},
                {"id":"eNOYnGtIm9E","title":"Paco de la India (Running on Bitcoin) | My Latin Life Podcast 210 🌴","duration":3489},
                {"id":"a75GbcbUyfA","title":"BTCPayServer Twitter Spaces - #Bitcoin accepter here - El Salvador Edition","duration":2723},
                {"id":"twjTUa8njRo","title":"Run with Bitcoin","duration":76},
                {"id":"5hMZkxQtstU","title":"167. Run with Bitcoin with Paco de la India","duration":5477},
                {"id":"zgk-1pSMsZA","title":"WTF the IMF, Tether and Bitcoin in El Salvador?: Mike Peterson #13","duration":6248},
                {"id":"Y7kwFxDNcek","title":"Living on bitcoin in El Salvador","duration":912},
                {"id":"waQJEjiPWhg","title":"How The Trumps Blew $1 Billion On Bitcoin","duration":305},
                {"id":"5scEV0IVYeY","title":"Why BIP110 (aka Knots) is a Hostile Attack on Bitcoin - Plan ₿ Forum El Salvador 2026","duration":1670},
                {"id":"ubHCMpo_Iek","title":"nrc28 | Can the Próspera + Bitcoin model save Honduras? Zussel Abigail Ramos thinks so.","duration":3240},
                {"id":"zh1MFyLNjrk","title":"Easy In. Impossible Out. | The Convenience Trap","duration":133},
                {"id":"ic_4-EFJogY","title":"From Accenture to Bitcoin Maximalist: Alexandre Laizet's Origin Story | The Blockchain Report","duration":503},
                {"id":"eQRUoMFFjsU","title":"The Bitcoin Cheat Code | Mark Moss","duration":4387},
                {"id":"66HRDI_Vxhc","title":"El Salvador Passes Bitcoin Law | Twitter Spaces - Hosted by Nic Carter ft. ES President Nayib Bukele","duration":7265},
                {"id":"c8UMS3n47ZE","title":"Life After Bitcoin With Peter McCormack","duration":5001},
                {"id":"LXB0d_3WntM","title":"Bitcoin is ready to replace the broken USD | Isabella Santos","duration":3724},
                {"id":"78YidaGwELw","title":"Building bottom-up bitcoin economies with Isabella Santos","duration":2653},
                {"id":"mmOrwgouveI","title":"The Secret Bitcoin City of El Salvador-Interview with Founders Gerardo and Evelyn","duration":4516},
                {"id":"X0UVXuVbGYA","title":"Phil Gibson | The Social Schelling Point of Bitcoin #18","duration":4949},
                {"id":"mxfD7Pef4iU","title":"Building a Bitcoin Circular Economy: The BTC Isla Story","duration":4383},
                {"id":"6Sn1ZlXU6y0","title":"Reclaiming Agency in a Shifting World","duration":65},
                {"id":"4Bmni2lHYo8","title":"Stackuj.cz: Isabella Santos on Bitcoin community building","duration":3644},
                {"id":"qzIA5E9LoUo","title":"Blockstream & Bitcoin's Best: Enterprise & Institutions Day in El Salvador 🇸🇻","duration":36},
                {"id":"Lq6ZDqwA8UA","title":"The Bitcoin Football Club with Peter McCormack & Dominic Frisby","duration":5420},
                {"id":"_ToVLRneMS0","title":"MASSIVE BITCOIN ADOPTION in Nigeria, People Reject CBDC | EP 613","duration":3817},
                {"id":"R8xZd8v7b50","title":"Bitcoin: You Need to Pay Attention Now","duration":1349},
                {"id":"LRSQSkiil0M","title":"INSIDE THE BITCOIN REVOLUTION IN AFRICA'S LARGEST SLUM","duration":1068},
                {"id":"qnMDb2MZo9g","title":"Will Bitcoin Become The Only Reserve Asset? Bitcoin vs the State","duration":146},
                {"id":"GCor6z-X_eA","title":"This Is Why El Salvador Chose Bitcoin | Blockstream at Plan B El Salvador Day 2","duration":53},
                {"id":"3R9Ap6vhwO0","title":"Paying for Steak in El Salvador with Bitcoin-It's Devastatingly Simple with the Blockstream App","duration":26},
                {"id":"k-lnRLOY43o","title":"Eric Weiss: The Future of Crypto, Institutions vs Plebs and the Threats to Bitcoin","duration":4305},
                {"id":"WVpqXtms0Hs","title":"What Is Slowing Down Bitcoin Adoption?","duration":329}
            ]
        },
        {
            "id": "dev-privacy-nodes",
            "name": "Dev, Privacy & Nodes",
            "emoji": "💻",
            "desc": "Building on Bitcoin, privacy & running nodes",
            "color": "#22c55e",
            "videos": [
                {"id":"ckm1rBJR8Vc","title":"An open-source security platform w/ Zach Herbert from Foundation","duration":4211},
                {"id":"JsJSsbp9g3M","title":"Bitcoin Privacy is a Human Right","duration":255},
                {"id":"wihMTwJ_wWs","title":"Sovereign Computing with Matt Hill of Start9","duration":2692},
                {"id":"6Tr4-DL1c1s","title":"Freedom Money: Der Gigi l Episode 1","duration":3092},
                {"id":"yVP_WGXSThA","title":"How to Protect Your Privacy: Safe Use of Non-KYC Bitcoin","duration":254},
                {"id":"3AmzFPMcgEY","title":"Growth On Bitcoin & Lightning Is EXPLODING | Alyse Killeen","duration":2440},
                {"id":"yAwKISWTMvM","title":"Lightning Speed Bitcoin Payments Without Giving Up Custody","duration":52},
                {"id":"QeCIVUH89KY","title":"How to Switch from Bitcoin Core to Knots on Start9 (And Why It Matters!)","duration":258},
                {"id":"ckvTy0Fsc_M","title":"Bitcoin Privacy on Trial: Samourai Wallet and Tornado Cash | MIT Bitcoin Expo 2025","duration":1526},
                {"id":"KQ_gz-tpGkU","title":"Adam Back: Bitcoin's Addressable Market Is Hundreds of Trillions of Dollars","duration":47},
                {"id":"zV_A2yMZl0w","title":"Alex Gladstein - Bitcoin's Killer App: Defunding Dictators | Bitcoin Politics","duration":793},
                {"id":"gOo7rnqXeik","title":"Open Source Software In Bitcoin","duration":754},
                {"id":"JujTD58xTZU","title":"Bitcoin Outperformed EVERY Asset Class for 15 Years - Why It Beats Gold","duration":36},
                {"id":"D2AjX1PB5HE","title":"Bitcoin and Ossification w/ Jameson Lopp","duration":4818},
                {"id":"mDyBbGCiBUU","title":"Nic Carter: Bitcoin Core Values, Layered Scaling, and Blocksize Debates | Lex Fridman Podcast #173","duration":8835},
                {"id":"FooHZd6LviI","title":"IF energy = currency THEN Bitcoin | They're Just Now Figuring Out What Bitcoiners Already Knew","duration":10},
                {"id":"P7KCb5vFBEI","title":"How Kagi is fixing search w/ Vlad Prelovac","duration":2743},
                {"id":"qFfhr4sApso","title":"RUN A BITCOIN NODE: Simple Tutorial With UMBREL Home","duration":3940},
                {"id":"cyWzGPQpIhc","title":"Epstein Funded Bitcoin Core: Shocking 2015 Revelation","duration":80},
                {"id":"7FWKc8lM4Ek","title":"Neutrino: The Privacy Preserving Bitcoin Light Client","duration":2644},
                {"id":"Cjxc9ERz2mU","title":"Bitcoin Conference 2022 - Lightning Privacy (Concerns and Solutions) - Open Source Stage","duration":2401},
                {"id":"kmfzATMxCj4","title":"Start9 vs. Umbrel. What's the difference? CEO Matt Hill explains","duration":190},
                {"id":"PVHN_y7Bz0A","title":"POV: You're Running Away From Your Problems With Your Bitcoin Using Blockstream Jade","duration":20},
                {"id":"s2bVOVdSrN0","title":"Digital IDs Just Went Live - Say Goodbye To Your Privacy & Money","duration":2231},
                {"id":"r4VBmza3TNw","title":"Bitcoin: Soft Fork vs Hard Fork & BIP-110 Updates","duration":1400},
                {"id":"gUGJje2jvck","title":"Proton Wallet w/ Andy Yen","duration":3279},
                {"id":"nvBsNKsZ6uY","title":"From 10% to 50% - The Bitcoin Moment Everyone Has - Adam Back","duration":72},
                {"id":"KNaOeLlD6NA","title":"How To Build and Run a Bitcoin Node: Raspberry Pi & Umbrel","duration":1675},
                {"id":"xaj-CQntobU","title":"Everybody Buys Bitcoin at the Price They Deserve","duration":20},
                {"id":"WfDmcyvAZgI","title":"Adam Back: Bitcoin Is a Multi-Millennia Monetary Invention Better Than Gold","duration":49},
                {"id":"XRxbrfbeThg","title":"Gigi on Internet Business Models, Value 4 Value, and Freedom in an Information Age | E56","duration":5910},
                {"id":"LrLsS7-woN0","title":"SimpleX chat and how privacy aligns with the future of computing w/ Evgeny from SimpleX","duration":5746},
                {"id":"-O-BgOiV9AM","title":"UMBREL TO START9: Migrate Your Lightning Node","duration":1788},
                {"id":"6BIAgpzmNGY","title":"Soundbite: What is money, and why do we need a parallel form of it in Bitcoin and/or Monero?","duration":52},
                {"id":"oxVg9QfcuBk","title":"Soundbite: Matt's biggest fear for Bitcoin privacy is that people rely on custodial privacy","duration":56},
                {"id":"TASQj1hacuI","title":"Bitcoin is a Powerful Tool for Human Rights | Wyoming Blockchain Symposium","duration":664},
                {"id":"DpTiayQkCUQ","title":"Bitcoin Ownership Is Lower Than You Think-It's Still Early and You Know It","duration":20},
                {"id":"QvtnQfVdLYU","title":"What People Get Wrong About Bitcoin Core | Sjors Provoost @ MIT Bitcoin Expo 2025","duration":1023},
                {"id":"a0ycGl4jN8w","title":"Run Bitcoin & Lightning Node in 30 mins: Umbrel Home","duration":1884},
                {"id":"rLuT4AA8daA","title":"Post-Quantum Bitcoin Requires Difficult Trade-offs - Not Free Upgrades","duration":56},
                {"id":"mC0lX806NjI","title":"Bitcoin Core 2023 Development","duration":194},
                {"id":"ekRzqy7D1wk","title":"Cybersecurity Secrets for Protecting Your Digital Life and Bitcoin","duration":5437},
                {"id":"i0-2UhU-o2s","title":"How Bitcoin Incentives and URSFs Kill Minority Soft Forks","duration":1720},
                {"id":"eEtxKbERWyA","title":"Bitcoin Core Dev Jeremy Rubin: Building Char Network | MIT Bitcoin Expo 2025","duration":1466},
                {"id":"DKBJ3_3ZomU","title":"Start9 Embassy: Bitcoin Node And Personal Server TUTORIAL","duration":7176},
                {"id":"Dlxttzs5tXI","title":"Start9 Labs CEO Matt Hill Interview Lightning Ventures 3/24/2022","duration":3473},
                {"id":"3pc-mRpED5E","title":"#bitcoin nodeWars Ronindojo vs  Umbrel vs  Start 9","duration":57},
                {"id":"JzPsex18Bv8","title":"Whirlpool is Back! Ashigaru Revives CoinJoin for #bitcoin  Privacy","duration":60},
                {"id":"ZaaTR9qBpQI","title":"Why Bitcoin Layer-2s and Confidential Transactions Are the Future of Finance","duration":63},
                {"id":"AgqkcDyOsbY","title":"Pay With Bitcoin at Your Favourite Shops Using Lightning and the Blockstream App","duration":40},
                {"id":"52pSd3I1nac","title":"WASABI - Coinjoin Wallet For Bitcoin Privacy TUTORIAL","duration":5071},
                {"id":"jMf6Gqo3J4I","title":"WHAT IS A BITCOIN NODE? & 5 Reasons To Run A Bitcoin Full Node!","duration":338},
                {"id":"7fvG11BByD4","title":"Running Bitcoin Knots On Start9","duration":538},
                {"id":"xhDQT4TeNIU","title":"Unlock Perfect Privacy with eNuts: Instant, Free Bitcoin Transactions Tutorial","duration":3070},
                {"id":"U9hdav36WAo","title":"Use Wasabi Wallet for Bitcoin Privacy and Coinjoins","duration":1264},
                {"id":"mdnkZunIphA","title":"The Role of Bitcoin Core Maintainers & the Path Forward","duration":1761},
                {"id":"kYNrQhZTwWg","title":"Bitcoin privacy becoming more popular","duration":60},
                {"id":"Z0696dgyxZI","title":"How to Actually Spend Bitcoin in Real Life (It's Easy In 2026 with Blockstream)","duration":66},
                {"id":"fsAUhFr1VXU","title":"Bitcoin Privacy Made Simple: Wasabi Wallet Step-by-Step Tutorial","duration":1922},
                {"id":"BNRvyrmBUhM","title":"Become a Digital Sovereign with Start9","duration":2955},
                {"id":"9npQ5f74Nr4","title":"Andreas M Antonopoulos - The Future of Cryptocurrencies","duration":3078},
                {"id":"-LGpW2PKwHA","title":"Bitcoin Core Developer Interview: Antoine Poinsot | MIT Bitcoin Expo 2025","duration":2141},
                {"id":"njNcv50dVGg","title":"Bitcoin Follows Geopolitics Short-Term, Decorrelates Long-Term - Adam Back on CNBC","duration":58},
                {"id":"ehhtq_gtC3M","title":"\\\"Quantum Will Break Bitcoin\\\" - Adam Back Explains Why That's Wrong","duration":53},
                {"id":"GWraOJDyFs4","title":"Bitcoin: The Inflation Hedge Every Company Will Eventually Adopt","duration":25},
                {"id":"iVPNk2ZZ63w","title":"Lightning Accounts With Blue Wallet and Umbrel","duration":1249},
                {"id":"6poXI01pIMs","title":"Institutional Grade Security for Your Bitcoin: Jade Plus Anti-Exfil","duration":61},
                {"id":"JXTFPKmF3Fs","title":"We are all Satoshi.","duration":14},
                {"id":"fgAKXfVzc7c","title":"Start9 OS Bitcoin Node Tutorial - DIY Hardware, How To Set Up, Download & Why I Moved from Umbrel.","duration":827},
                {"id":"IYnzBVMJhTI","title":"Beer for Bitcoin over Tor","duration":32},
                {"id":"lW8r9hq8-yU","title":"Bitcoin Core Developer Interview: Gloria Zhao | MIT Bitcoin Expo 2025","duration":1835},
                {"id":"6ArUlNTsooM","title":"Bitcoin must be secure against powerful adversaries. Not just \"what if\"","duration":41},
                {"id":"kL0Yc8ngzS0","title":"Bitcoin Fixes Double Standards Like WallStreetBets - Guest Gigi","duration":4386},
                {"id":"UA29De0t3i0","title":"True North Now - Bitcoin Core, OP_RETURN & Knots Explained | Featuring Rob Hamilton (Anchorwatch)","duration":3682},
                {"id":"Fa9AvF4jk1o","title":"UMBREL - How To Use Your Bitcoin and Lightning Node (NEW)","duration":3272},
                {"id":"SSbgVHQrGjg","title":"Bitcoin Core 2024 Development","duration":196},
                {"id":"TEVJUjOGmOI","title":"Bitcoin Core Developer Roundtable | MIT Bitcoin Expo 2025","duration":2284},
                {"id":"JtzwTd9Ur5c","title":"Competing with Free | DerGigi","duration":1192},
                {"id":"DzikmY4S42Y","title":"Start9 Tutorial: Set up your Bitcoin Node and Personal Server.","duration":1148},
                {"id":"ubj5wpsmqN8","title":"🟧 Bitcoin Full Node Security - 11 Tips To Keep Your Node Safe","duration":830},
                {"id":"mpEs0FKqv7k","title":"\\\"Bitcoin Is the Hurdle Rate\\\" - Adam Back Explains What This Means for Every Company in '26 on Forbes","duration":31},
                {"id":"vPMUGP3Opy8","title":"This Is The PERFECT Bitcoin Security and Privacy Setup!","duration":2324},
                {"id":"cDYQ6A69-D4","title":"Enhance Your Bitcoin Journey with Start9's Server Pure UPGRADE: Here's How","duration":1714},
                {"id":"_-Acfj4SO6g","title":"Top Bitcoin Privacy Tips & Tricks for 2025","duration":3187},
                {"id":"dMHhuY35NKY","title":"Tor Project Co-Founder Roger Dingledine: The Use of Anonymity in Society | MIT Bitcoin Expo 2025","duration":1695},
                {"id":"cXATaj0YJeQ","title":"Adam Back: Bitcoin Is Like Buying Internet Stocks in the Early 90s","duration":34},
                {"id":"Gs6ji-kKmY8","title":"Adam Back Explains the @LiquidNetwork $4B in Real-World Assets Trading 24/7 on Bitcoin Layer-2","duration":40},
                {"id":"22U4f_OatM4","title":"Bitcoin Is Geopolitically Neutral Money Like Gold Throughout History - Adam Back","duration":60},
                {"id":"UYUfXWlAleA","title":"01 - myNode series - Why run a Bitcoin node","duration":594},
                {"id":"Rw8wdeTYTJU","title":"#Bitcoin Wallet Trezor CoinJoin Update with Wasabi and Chainalysis:  You Should Be Concerned!","duration":57},
                {"id":"t4yuwtIhQIg","title":"Bitcoin Mechanic Node Workshop at Bitcoin Valley Meetup","duration":4086},
                {"id":"1XxG_qjY3EY","title":"Home Bitcoin Solo Node Setup Guide (Umbrel)","duration":529},
                {"id":"Uf-hjzgIpX0","title":"Understanding Seed Phrases: How to Secure Your Bitcoin Without Relying on Third Parties","duration":41},
                {"id":"nRoAyZG2taE","title":"Switch from Bitcoin Core to Knots (Windows, Mac, Linux, Start9, Umbrel, MyNode, and Raspiblitz)","duration":5301}
            ]
        },
        {
            "id": "economics-money",
            "name": "Economics & Money",
            "emoji": "💰",
            "desc": "Austrian economics, inflation & sound money",
            "color": "#eab308",
            "videos": [
                {"id":"Jv7616ZV4CA","title":"$50 Weekly DCA: Gold vs Bitcoin (12/24/24 Update)","duration":46},
                {"id":"VgqH9lPiAbY","title":"10 - What Comes After The Dollar?","duration":242},
                {"id":"V2r0EaJQwLA","title":"Lyn Alden on Bitcoin's Long-Term Bull Case","duration":687},
                {"id":"_9JPeiTvREA","title":"How Societies Collapse","duration":670},
                {"id":"7EZsBBKjens","title":"Lyn Alden 2024 Interview - Bitcoin Prediction in 2024","duration":723},
                {"id":"P5tVGJCHDoQ","title":"Why gold, not platinum?","duration":58},
                {"id":"CEmJQYEdYpk","title":"Liquidity Tightens AGAIN: What the Repo Market Is Telling Us","duration":1215},
                {"id":"qawzs0QSzbI","title":"Jeff Booth 'Losing $500M Was The Best Thing That Ever Happened To Me'","duration":4218},
                {"id":"Vw5wKr_TJm0","title":"HYPERBITCOINIZATION","duration":694},
                {"id":"Hob0-KYPqEg","title":"Bitcoin is financial freedom","duration":59},
                {"id":"Ai5z2T4WhWg","title":"Why Bitcoin Matters & Why You Should Care | Economical, Ethical And Technological Perspective","duration":2131},
                {"id":"drs6Q_OX0HE","title":"241. Austrian economics intro with The Bitcoin Way","duration":5260},
                {"id":"Z71sOLsZpkI","title":"Bitcoin Isn't Worth $77K, Your Dollars Are Worth Nothing | Jeff Booth","duration":10059},
                {"id":"bs_pYdK8CU8","title":"Broken Money w/ Lyn Alden (TIP574)","duration":5223},
                {"id":"y1EYoyW9fhU","title":"We Need Honest Money","duration":27},
                {"id":"BP4zLPhZIj4","title":"$50 Weekly DCA: Gold vs Bitcoin (8/29/25 Update)","duration":51},
                {"id":"GDZqw6QkW-U","title":"Is China Sitting on the BIGGEST DEBT BOMB in Modern History?","duration":2617},
                {"id":"TmV4Ns_ngSM","title":"Bitcoin Economist Saifedean Ammous on monetary history.","duration":2399},
                {"id":"u6002_r1kSw","title":"Lyn Alden 2024 Interview - Bitcoin ETFs: Catalysts for Price and Demand","duration":630},
                {"id":"uRDk8BxQP0g","title":"Will Private Credit Cause a Crisis?","duration":412},
                {"id":"csGEhR7JNVU","title":"Bitcoin to 100,000,000 dollars?","duration":435},
                {"id":"VssN8B0NWqY","title":"286. The Fiat Standard: Lecture 5 - Fiat Balances: Universal Debt Slavery","duration":2853},
                {"id":"d9DqvX7CJOc","title":"302. The Fiat Standard Chapter 18: Can Bitcoin Fix This?","duration":5592},
                {"id":"t7rYIkl6lIQ","title":"282. The Fiat Standard: Lecture 1","duration":3110},
                {"id":"-SQbX9W0TBM","title":"8 - Central Banking - Too Much Power?","duration":150},
                {"id":"PQ2wj8dnpqo","title":"What is money? | Saifedean Ammous and Lex Fridman","duration":624},
                {"id":"wW35okWUurM","title":"Gold at $5,000 Signals MASSIVE Changes to the World Order","duration":3419},
                {"id":"QrUfS6SBBbM","title":"5 - Why Government Debt Means Inflation is Necessary","duration":205},
                {"id":"BcS3QzXtfQc","title":"Bitcoin Holds $100,000 as Stocks Recover: TBL Liquidity Explained","duration":2291},
                {"id":"0v4z6r6_6QI","title":"6 - How New Money Benefits The Rich (Cantillon Effect)","duration":120},
                {"id":"dIqs9hGNU9A","title":"Fiat Money, Inflation & the Collapse of Civilization | Saifedean Ammous","duration":4021},
                {"id":"soGXgiGoMRU","title":"Broken Money  Why Our Financial System Is Failing US And How We Can Make It Better 2 06 24","duration":3968},
                {"id":"7LcxJzUrGd8","title":"Saifedean Ammous - Principles of Economics, The Bitcoin Standard & The Fiat Standard","duration":3011},
                {"id":"Qr49drtKtbk","title":"Digital Gold Becomes A 'Danger Zone' | Why SEBI Is Warning Against Digital Gold Buying | Explained","duration":281},
                {"id":"6RsPt2bhi1o","title":"Jeff Booth: Bitcoin Crashed 30% - Why I Feel Incredible","duration":3769},
                {"id":"aHVuaASswgA","title":"The Truth About CBDCs (Central Bank Digital Currencies) | Economics Explained","duration":334},
                {"id":"k3NN_NZOdhY","title":"Lyn Alden's Full Broken Money Thesis in under 50min","duration":3087},
                {"id":"usUfMQcu9YQ","title":"How the Fed Lost Control of Liquidity (and What It Means for Bitcoin)","duration":2226},
                {"id":"vkV8r5udf18","title":"1: Why Fiat Currencies are Ruining Your Life!","duration":336},
                {"id":"3PF893H5v74","title":"Inflation is just like alcoholism","duration":34},
                {"id":"_nSF9yZWalA","title":"320. Principles of Economics Lecture 10: Money","duration":5647},
                {"id":"aKuKbNpGvys","title":"3 - The Ultimate Scam! How Banks Steal from YOU!","duration":201},
                {"id":"lB3mQImM-5Y","title":"The Fiat Standard by Saifedean Ammous","duration":273},
                {"id":"HZx7t15d96M","title":"Jeff Booth Explains Why Everything Is Getting More Expensive","duration":2814},
                {"id":"GbLndO2XfuI","title":"Hidden Secrets Of Money Ep 5  -  Where Does Money Come From  -  Mike Maloney 720p","duration":1799},
                {"id":"jk_HWmmwiAs","title":"How Money & Banking Work (& why they're broken today) - Lyn Alden","duration":1950},
                {"id":"tBnsQeTbMU8","title":"How High Can Gold & Silver Go?","duration":797},
                {"id":"8mpiEplIfU8","title":"Global Macro Update: Gold, Silver, Bitcoin, and the Breakdown of the WTO Era","duration":3711},
                {"id":"wzxydNI2-Go","title":"INTEREST EXPENSE EXPLODES: Why The Fed Must Cut & What It Means For Bitcoin","duration":1288},
                {"id":"crETxyQczyw","title":"$1 QUADRILLION In Global Wealth: How Does It Impact Bitcoin?","duration":2327},
                {"id":"Ux-iV_9KAxk","title":"Jeff Booth: This Is Why Most People Will Get Wiped Out in the Transition","duration":600},
                {"id":"NqBdAnhWB4U","title":"Bitcoin Holds $90,000: Volatility, Yields, & The FED'S NEXT PRINT","duration":1663},
                {"id":"qZSjJk70FTA","title":"Economics of Dust: Post-Ordinals Bitcoin Output Analysis","duration":70},
                {"id":"7fAhxz8GIAg","title":"The Liquidity Signal That Called Bitcoin's Drop Is Still Red","duration":1692},
                {"id":"XLxGM47GdBU","title":"The Fiat Standard with Dr. Saifedean Ammous","duration":3371},
                {"id":"G2vAm2hfW9U","title":"Why Deflation is the Key to Abundance with Jeff Booth","duration":3521},
                {"id":"jdYzif981SQ","title":"Bitcoin Dad: The Window for Generational Wealth Is Closing","duration":5104},
                {"id":"Xm47eTYJm_w","title":"$95,000 Bitcoin & Fed Independence","duration":1408},
                {"id":"LSvOFKf9okk","title":"Secret  monetary system explained by Mike Maloney","duration":1289},
                {"id":"TLhbc3moELQ","title":"252. The Gold Standard: Chapters 1-4","duration":5575},
                {"id":"8rYl8wEotZk","title":"Why Bitcoin Is 'Farm-to-Table Money' | Phong Le, CEO of Strategy","duration":4025},
                {"id":"DgaAU2eZLCI","title":"Average Sales Price for New Houses, Bitcoin vs Dollar (11/6/25 Update)","duration":94},
                {"id":"tctq51pjbSY","title":"8. Is Inflation Actually Necessary?","duration":319},
                {"id":"_UA2lcEKjLs","title":"Inside McKinsey's Global Wealth Report: What It Means for Bitcoin","duration":1993},
                {"id":"WxKmFBpq_8M","title":"$50 Weekly DCA: Gold vs Bitcoin (5/13/25 Update)","duration":49},
                {"id":"8PWRE5Ygam0","title":"Bitcoin's Emergence As Sound Money","duration":1641},
                {"id":"wMhZD_7lbkU","title":"THE FED ENDS QT: Fiscal Dominance, Repo Stress, & Bitcoin's Signal","duration":2353},
                {"id":"_T4K9fJ-DMA","title":"Your Savings Are at Risk | The Bitcoin Standard Microcourse, in Partnership with Genius Academy.","duration":60},
                {"id":"g1QGbBhKLDQ","title":"The origins of fiat money","duration":37},
                {"id":"7Nw64Jfb2Nw","title":"Global Macro Update: Inflation Cools, Bond Yields Drop, & Bitcoin Reacts","duration":1955},
                {"id":"i42PYv_ouY8","title":"JAPAN RATE CHECK Triggers a DOLLAR INDEX COLLAPSE","duration":1006},
                {"id":"AdaHyUmRvCU","title":"Introduction To Austrian Economics & The Monetary Policy of Bitcoin","duration":1095},
                {"id":"DyV0OfU3-FU","title":"Money vs Currency - Hidden Secrets Of Money Episode 1 - Mike Maloney","duration":1556},
                {"id":"UIhieMtB_A0","title":"The Everything Bubble Is Over: Michael Howell's Warning for 2026","duration":4085},
                {"id":"sKN0scdPZsA","title":"Bitcoin is freedom money Ft. Guy Swann","duration":37},
                {"id":"X8IAeTu8Irs","title":"The truth of fiat money","duration":78},
                {"id":"GA_7P8RdyRU","title":"Oil Shock, Stablecoin Surge, and Bitcoin Isn't Flinching","duration":312},
                {"id":"VN3h0gmsuL4","title":"Bitcoin Annualized Issuance Rate (Monetary Inflation) (9/21/25 Update)","duration":106},
                {"id":"2xW6Mg9k9l8","title":"11 - The Coming Dollar Collapse","duration":1158},
                {"id":"jsoMWIx17Jc","title":"A US and Argentina soybean alliance might be what pushes it over the edge.","duration":162},
                {"id":"ImIP0izB6SY","title":"Bitcoin is Generational Wealth | Peter Dunworth","duration":4166},
                {"id":"N41OC2sazbw","title":"Jeff Booth on Bitcoin, AI, and Why Deflation Is Coming","duration":3570},
                {"id":"OZVV62lqytw","title":"US Treasuries MUST STABILIZE for Bitcoin to Move Higher","duration":2192},
                {"id":"c8Utm_op9Ts","title":"Bitcoin Annualized Issuance Rate (Monetary Inflation) (2/27/25 Update)","duration":103},
                {"id":"y307cs3EV44","title":"Economics of Dust: Post-Ordinals Bitcoin Output Analysis w/ Commentary","duration":614},
                {"id":"2-zrgOKK2UM","title":"The easy money trap","duration":61},
                {"id":"DKaZ-h-Wwhg","title":"Bitcoin & The Austrian School of Economics with Peter St. Onge | The Bitcoin Layer","duration":3087},
                {"id":"Ih0e8AXT_-s","title":"Lyn Alden | Broken Money","duration":1200},
                {"id":"lmfx960EQkY","title":"Mike Maloney - The best video series ever made about money.  Must watch for everyone!","duration":1766},
                {"id":"DKDGXT3SENI","title":"How will Bitcoin fare in the coming economic collapse?","duration":317},
                {"id":"FMntwaNOEj4","title":"Bitcoin Is Stupid Cheap Right Now | James Van Straten, CoinDesk","duration":1582},
                {"id":"CZKA01K3vig","title":"The Dollar is Crashing in Bitcoin Terms (7/17/25 Update)","duration":93},
                {"id":"ndj8LzSfEDk","title":"If a money is easy to create more of","duration":35},
                {"id":"Zxr7W7Mg9pY","title":"2: Inflation is STEALING from you! And How you can stop it!","duration":264},
                {"id":"D2DLuDfYbRU","title":"Bitcoin Annualized Issuance Rate (Monetary Inflation) (9/17/24 Update)","duration":99},
                {"id":"FXvQcuIb5rU","title":"The Immaculate Conception: Bitcoin vs Fiat Standard | Dr. Saifedean Ammous | EP 203","duration":7126},
                {"id":"gp4U5aH_T6A","title":"Saifedean Ammous: Bitcoin, Anarchy, and Austrian Economics | Lex Fridman Podcast #284","duration":15281},
                {"id":"iFDe5kUUyT0","title":"The Biggest Scam In The History Of Mankind - Hidden Secrets of Money Ep 4","duration":1775},
                {"id":"zr4eD3g5uQE","title":"You Will Never Look At Bitcoin The Same Way Again - Jeff Booth","duration":4215},
                {"id":"NNlxZZ6f57Q","title":"Jeff Booth: Why Bitcoin Frees Us From a Broken System","duration":4100},
                {"id":"TwQugFm2qoo","title":"Why STRATEGY Stands Alone & Why Most Bitcoin Treasury Companies Cannot Last","duration":2348},
                {"id":"z4MUIcyqIbw","title":"Highlight: Unwritten Chapters of The Fiat Standard","duration":60},
                {"id":"1sAK4pORJkY","title":"9 - Hyperinflation & Collapse (Extreme Case)","duration":153},
                {"id":"Yo1yIuRTLko","title":"Why Bitcoin is Generational Wealth","duration":2283},
                {"id":"nvVR_fVU7Bc","title":"Argentina just told China: no thanks. They want the U.S. as their 'partner of choice.'","duration":125},
                {"id":"lxgDRK5cRhA","title":"Episode 2: Bitcoin vs Gold: Why Digital Gold is Better","duration":481},
                {"id":"mKNojhzp_oY","title":"Can NVIDIA's EARNINGS JOLT Spark a Bitcoin Reversal?","duration":1751},
                {"id":"EbTpOiO_-xA","title":"Fed Liquidity Crunch Explained: Repo, QT, & Bitcoin's Reaction","duration":1157},
                {"id":"F8lfLqnhuGs","title":"The Fed's Losing Battle with Deflation (w/ Jeff Booth)","duration":2718},
                {"id":"X60jZY87A6k","title":"What is money?","duration":91},
                {"id":"XNE7MKOEsFQ","title":"Lyn Alden 2024 Interview - The Growing Importance of Bitcoin","duration":631},
                {"id":"Fn2_d5p8EcI","title":"7 - Boom & Bust Cycles: A Feature of Fiat Money","duration":177},
                {"id":"77GH63y-UnY","title":"Average Price: Electricity per Kilowatt-Hour in Average U.S. City, Bitcoin vs Dollar (9/9/25 Update)","duration":93},
                {"id":"bhogkKgH-o0","title":"Lyn Alden 2024 Interview - Money Systems and Their Instability.","duration":1431},
                {"id":"dlCbXoQokx0","title":"COIN STORIES CLIPS | When Will Governments Buy Bitcoin? Mike Alfred's Bold Prediction","duration":640},
                {"id":"CK7Gli9nltE","title":"Global Macro Director at Fidelity Shares His Investing Strategies For Bitcoin | Jurrien Timmer","duration":3124},
                {"id":"0fQ5k1q8FVo","title":"Bitcoin and Stocks vs the Dollar  - [Rich Dad's StockCast]","duration":1926},
                {"id":"fOpnpECKaY8","title":"Unveiling the Monetary Paradigm Shift: Bitcoin, Austrian Economics, the Future of Money | Seb Bunney","duration":4717},
                {"id":"yDpMGUZZC4c","title":"Bitcoin Will Power the Internet of Money and Tokenize Real World Assets with David Marcus","duration":2597},
                {"id":"LpccPgtC56g","title":"Average Price: Ground Beef in Average U.S. City, Bitcoin vs Dollar (8/2/25 Update)","duration":93},
                {"id":"eBTHI27B5rY","title":"Bitcoin & The Return To Prosperity Through Deflation with Jeff Booth | The Bitcoin Layer","duration":2765},
                {"id":"7tQIGuCyOHQ","title":"Jeff Booth Masterclass: The Price of Tomorrow & the Truth About Inflation, Deflation and Bitcoin","duration":4544},
                {"id":"hdtY_iMeVEg","title":"Saifedean Ammous predicts #Bitcoin will hit $100 TRILLION Market Cap ie $5.2M per BTC","duration":124}
            ]
        },
        {
            "id": "freedom-sovereignty",
            "name": "Freedom, Sovereignty & Homesteading",
            "emoji": "🗽",
            "desc": "Human rights, financial freedom, homesteading & sovereignty",
            "color": "#0ea5e9",
            "videos": [
                {"id":"wuOd5_M9yDQ","title":"Raising Chickens: Everything You Need To Know!","duration":1394},
                {"id":"a-zaAie8UZs","title":"How Joel Salatins Farming Style CAN Feed the World","duration":2540},
                {"id":"8G8cH740_TQ","title":"How to raise chickens in your backyard (10 tips)","duration":480},
                {"id":"jLcu6T1diCM","title":"Maple AI for Human Rights","duration":670},
                {"id":"pR4t4dRdajw","title":"Banking on Freedom - How Bitcoin Enforces Human Rights","duration":1266},
                {"id":"uZH1_0sHc7Q","title":"Your First 5 Steps to Starting a Homesteading Journey","duration":672},
                {"id":"2xRp4-9pZmM","title":"The Economic Philosophy of Bitcoin, Part I with Bitstein | The Bitcoin Layer","duration":3333},
                {"id":"9O1u-NyQpI0","title":"Why Financial Freedom Matters | Alex Gladstein","duration":1602},
                {"id":"qVB93llL5xw","title":"Quit Your Job and Farm Full Time: Joel Salatins Recipe for Success","duration":391},
                {"id":"GsSnTrHSlR0","title":"Tyranny Tracker Launch Event Livestream | HRF Introduces a New Global Democracy Index","duration":9119},
                {"id":"PesTO9MRqJo","title":"73. Bitcoin and Time with Gigi","duration":6150},
                {"id":"acjpwIxZzlA","title":"Self-Sufficiency Made Easier Using These 12 Principles!","duration":1161},
                {"id":"9dp-5YAQ4VM","title":"How to quit your job and start farming: Feat. Joel Salatin","duration":2742},
                {"id":"isiy70T-rKE","title":"The Economic Philosophy of Bitcoin, Part II with Marty Bent | The Bitcoin Layer","duration":3554},
                {"id":"xbBdIG--b58","title":"Inside Africas Food Forest Mega-Project","duration":851},
                {"id":"6QiDB-RwGGw","title":"Top 5 Most Underrated Countries You Might Want to Live in","duration":821},
                {"id":"85e7jsqbSd4","title":"How to Start a Homestead in 2025 | 5 Beginner Steps to Self-Sufficient Living","duration":473},
                {"id":"_o-ekivajw4","title":"Stunning TINY Permaculture Backyard Kitchen Garden (With 30 Fruit Trees!)","duration":615},
                {"id":"ss1BjW2kSNs","title":"World Famous Permaculture Property Tour | David Holmgren and Su Dennett Melliodora","duration":686},
                {"id":"fSgsYDD2ob4","title":"Alex Gladstein - The Role of Bitcoin for Human Rights, Interview at San Francisco Blockchain Week","duration":1698},
                {"id":"wjKzvvOA6Zg","title":"How I designed my permaculture food forest: A step by step guide","duration":1230},
                {"id":"4-7O3fOXXKo","title":"Joe Rogan Experience #1478 - Joel Salatin","duration":7757},
                {"id":"cNiO_nbdq3Y","title":"Danger: 7 Bitcoin Blind Spots That Will Wipe Out 99% in 2026 | BTC Sessions","duration":1609},
                {"id":"IBY8SdA3W4Y","title":"Gary's Economics is WRONG About Bitcoin","duration":1589},
                {"id":"RNHi8Qj2KrY","title":"Ethereum - How A Lie Became Worth Billions","duration":696},
                {"id":"4kbRqOYiOVk","title":"Debanked  Bitcoin Self Custody Is Your REAL Safety Net!","duration":39},
                {"id":"5l2wpPM-8IY","title":"The Global Refugee Crisis & The Bitcoin Solution","duration":2071},
                {"id":"9km7jI-mP8Q","title":"The TRUTH about OFF GRID LIVING in 2025 that NO ONE WILL TELL YOU","duration":756},
                {"id":"XVSrPznq8ZU","title":"Bitcoin Against Autocracy: A Modern Tool for Freedom","duration":1042},
                {"id":"SNffLDSLEoU","title":"Reckless VR: Alex Gladstein, Human Rights Foundation","duration":4371},
                {"id":"ril70QIDz24","title":"Bitcoin Is the Embodiment of Human Rights | Anita Posch Talk","duration":1610},
                {"id":"0XnB_ZqL6fo","title":"MassAdoption presents : Freedom Festival 2024","duration":41},
                {"id":"4TY2qze4Uos","title":"2025 Freedom Fellowship Working Retreat","duration":96},
                {"id":"OPd9NcyIuy0","title":"Edward Snowden | \\\"The Future of Crypto Is Not What It Seems\\\"","duration":547},
                {"id":"0mP4ADWY0xY","title":"25 Amish Tricks for Living Off Grid in a Cold Climate","duration":1179},
                {"id":"r3f6liCAXzA","title":"BCB026_ALEX GLADSTEIN: Bitcoin, Freedom & Human Rights","duration":3566},
                {"id":"DoKh7SdbnXM","title":"5 Tasks You Should Do EVERY DAY in the Veggie Garden","duration":1052},
                {"id":"ETo64Er7RiA","title":"Running LLMs Locally for Human Rights","duration":1267},
                {"id":"YBPLrr9Hph0","title":"Incredible 1.5-Acre Syntropic Food Forest with Over 250 Plant Species","duration":1471},
                {"id":"FTpMrI_vavI","title":"How To Be Free In 2024: Start An Off Grid Homestead","duration":958},
                {"id":"FLmW_czpXXg","title":"BITCOIN: A TROJAN HORSE FOR FREEDOM w/ Alex Gladstein","duration":5717},
                {"id":"PHYCAE2n55M","title":"🔥 ISABELLA SANTOS ON BITCOIN MEDIA, FREEDOM & BUILDING A CIRCULAR ECONOMY!","duration":2271},
                {"id":"1jdFBnoNuOU","title":"Debt. Greed. Inflation. The Bible Saw It Coming.","duration":910},
                {"id":"n5K1lEDv8aM","title":"Bitcoin is Digital Freedom: A Fireside Chat with Roya Mahboob | 2025 Bitcoin Policy Summit","duration":741},
                {"id":"qul5v0qopCQ","title":"Want the perfect tool to hide your dirty money? Look no further than a shell company.","duration":63},
                {"id":"rFFSBzsPn0k","title":"Family Transforms Tiny Suburban Backyard into Thriving Permaculture Gardens","duration":853},
                {"id":"OJZ2wRakOh0","title":"14 Years Living Off-Grid in a Self-Built Cabin & Farming Tons of Food on the Land","duration":637},
                {"id":"GNzyaxizrNo","title":"This Video Is For Ross Ulbricht.","duration":1076},
                {"id":"1qrrFIO-iXQ","title":"Florida Organic Edible / Tropical Garden Food Forest Tour","duration":1560},
                {"id":"dKDnkf6c250","title":"BILLIONAIRE: \\\"Sell Your Home. BUY BITCOIN.\\\"","duration":629},
                {"id":"H-fQ7i8q5C8","title":"Edward Snowden On Bitcoin","duration":1723},
                {"id":"muX8fIQLJjw","title":"My Biggest Mistake Building a Food Forest","duration":58},
                {"id":"kUiokNq5N1g","title":"Edward Snowden Refers to CBDCs as 'Cryptofascist Currency' - Closer to Being a Perversion of Crypto","duration":298},
                {"id":"BuYGS5pLRZg","title":"THIS FARM CRACKED THE CODE #1: Water Wizard of Oregon","duration":672},
                {"id":"-yepJZ788WY","title":"Reckless Review in VR","duration":3682},
                {"id":"Y5wgZ3rFayQ","title":"Lightning for Financial Freedom - Carla Kirk-Cohen","duration":521},
                {"id":"p8vLlp67UnA","title":"Where to Move with Bitcoin at $100K","duration":533},
                {"id":"LMeNe1tBsr4","title":"Oslo Freedom Forum 2024 | Financial Freedom Track Livestream","duration":23584},
                {"id":"6BSxN2cyqx8","title":"\\\"Doors to Freedom\\\" at Art Week Miami Beach","duration":143},
                {"id":"FSRmf_d3gnY","title":"HRF Calls for Justice for Navalny's Imprisoned Lawyers","duration":193},
                {"id":"9R-utqpmwmE","title":"Planning a Vegetable Garden for Beginners: The 5 Golden Rules 🏆","duration":306},
                {"id":"hU9C4rbK6wg","title":"How to Preserve a Year's Worth of Food WITHOUT GOING INSANE","duration":1126},
                {"id":"dP5xdXj0Bp4","title":"Are ETFs better than self custody? Currency Wars 2 and VR Class (1 min video)","duration":68},
                {"id":"A-QpLdoDF14","title":"CFF UFM HRF | Financial Freedom Against Tyranny · Anna Chekhovich","duration":572},
                {"id":"R7Z3IF5AgJI","title":"Whitney Webb's Urgent Warning to the Bitcoin Community","duration":881},
                {"id":"lfPZteWuH3k","title":"Crypto-Friendly Countries🚩Nomad Capitalist INTERVIEW","duration":2008},
                {"id":"-XjZUKIC1KE","title":"Bitcoin VR Worlds","duration":538},
                {"id":"b5Xgw_DqmEw","title":"How I Turned My Yard Into a Food Paradise","duration":791},
                {"id":"TJ3DUI7NvNk","title":"7 Ways this Farm Harvests FREE Water","duration":798},
                {"id":"63EbTT2rjyE","title":"2025 NK Insider Forum","duration":214},
                {"id":"uSa6UW5iCEU","title":"Tyranny Tracker Launch Event | HRF Introduces a New Global Democracy Index","duration":174},
                {"id":"9md3fIfMWiQ","title":"TIMELAPSE- Couple Builds House in 20 Minutes","duration":1114},
                {"id":"IgAI5uyUs-E","title":"Celebrities & Dictators | Human Rights Foundation","duration":154},
                {"id":"8xurGFoKfjo","title":"Episode 6: Bitcoin Self Custody: Financial Freedom","duration":250},
                {"id":"8q_dEPaof-c","title":"A new tool to help kleptocrats launder both their money and their reputations? The sports industry.","duration":70},
                {"id":"Z_p70BzkMAs","title":"Bitcoin Protects Human Rights with Alex Gladstein","duration":3118},
                {"id":"LNAFBnN4AHg","title":"How The Bible Helped Me Understand The Capital War","duration":2664},
                {"id":"79s_PJ0E2CQ","title":"Rain Water Harvesting System Top Mistakes! Don't Make These!","duration":668},
                {"id":"KY72n6UFg1s","title":"Tax-Friendly Countries for Crypto Investors","duration":486},
                {"id":"R3DJ2O-8XLU","title":"Astonishing Backyard Garden Harvest, Suburban Permaculture Food Forest","duration":1772},
                {"id":"BXzz5b7kVQM","title":"A highly productive small-scale urban garden | Urban Farming","duration":435},
                {"id":"jPTG0-syzrM","title":"One Year's Worth of Food | GIANT Pantry Tour | 1600+ Jars!!","duration":2596},
                {"id":"IgI8h68EiU8","title":"Canning 101: A Beginner's Guide (Back to Basics)","duration":2071},
                {"id":"kSbMU5CbFM0","title":"Alex Gladstein: Bitcoin, Authoritarianism, and Human Rights | Lex Fridman Podcast #231","duration":9217},
                {"id":"d5_cYWLpDs8","title":"A Brief Look at Bitcoin Maximalism (Speaking Of Bitcoin Episode 497)","duration":1664},
                {"id":"WEeICYjlfUQ","title":"So You Want To Start A Homestead? (Beginner Tips From A Beginner)","duration":606},
                {"id":"iWpeSs4yWZ8","title":"THESE CELEBRITIES might be arrested for promoting Cryptocurrency?","duration":61},
                {"id":"ZYN4X_l1ZXg","title":"Financial Freedom and Bitcoin","duration":2695},
                {"id":"c1P666wDfsc","title":"10 Permaculture Projects For Your Backyard","duration":845},
                {"id":"vmf_LtnagTs","title":"Bitcoin To $250K Or Gold To $10K? Investor Reveals The Smarter Bet | E.B. Tucker","duration":2386},
                {"id":"xLYYh4aPXAM","title":"Bitcoin Is Protecting Human Rights Around the World","duration":338},
                {"id":"i72_p2hdtnw","title":"The HRF's Fight for Freedom: Tools and Challenges for Activists- Alex Gladstein","duration":2300},
                {"id":"1HA4zY8xCyY","title":"Building a Cabin from Pallet Wood: Cheap Off Grid Homestead","duration":1490},
                {"id":"6CrpwE0Yq9g","title":"The Big Lie of Modern Homesteading","duration":951},
                {"id":"WxggMzuGMsI","title":"The Philosophy of Bitcoin & Fiat: Credit, Justice, & Sound Money","duration":2399},
                {"id":"5n452vfBX8U","title":"What I Wish I Knew BEFORE Getting Backyard Chickens","duration":533},
                {"id":"u34R01BEPdE","title":"Using SQUARE FOOT Gardening Easily DOUBLED the Harvests","duration":843},
                {"id":"AcWcusXqClo","title":"What Edward Snowden Just Said About Bitcoin","duration":471},
                {"id":"_6PvTUqyRt8","title":"Bitcoin For Human Rights | Backstage w/ Christian Keroles & Alex Gladstein","duration":599},
                {"id":"oDaTIFKe3k4","title":"4 Best Countries for Crypto Millionaires","duration":459}
            ]
        },
        {
            "id": "health-fitness",
            "name": "Health, Fitness & Mindfulness",
            "emoji": "💪",
            "desc": "Lifting form, sleep science, mindfulness & low time preference",
            "color": "#16a34a",
            "videos": [
                {"id":"V6m-XlPnqxI","title":"Changing Paradigms | Regenerative Agriculture Documentary","duration":1394},
                {"id":"lIo9FcrljDk","title":"Master Your Sleep & Be More Alert When Awake | Huberman Lab Essentials","duration":2041},
                {"id":"jn8uc92Oymo","title":"US & Wall Street Bitcoin Adoption is Killing the IMF (Without Knowing It!) | Alex Gladstein","duration":3862},
                {"id":"poOf8b2WE2g","title":"Using Your Nervous System to Enhance Your Immune System","duration":7232},
                {"id":"oLwTC-lAJws","title":"How to Fix Rounded Shoulders (GONE IN 4 STEPS!)","duration":841},
                {"id":"hvPGfcAgk9Y","title":"Dr. Matt Walker: Protocols to Improve Your Sleep | Huberman Lab Guest Series","duration":9775},
                {"id":"NYN3UGCYisk","title":"Common Deadlift Errors ft. Austin Baraki","duration":613},
                {"id":"T4PFt4czJw0","title":"UK doctor switches to 80% ULTRA-processed food diet for 30 days | BBC","duration":553},
                {"id":"vczr0WuYK9g","title":"Calisthenics for Beginners | In Depth Step-by-Step Guide to Building Strength and Muscle","duration":1541},
                {"id":"F5TNiggsH1A","title":"Corrupt Food Industry | Hidden Work | Dangerous additives | Documentary","duration":3147},
                {"id":"Pvmp0L5cbl8","title":"Iron sharpens iron.  Practicing kicks with the homie","duration":90},
                {"id":"dBnniua6-oM","title":"Sugar: THE BITTER TRUTH","duration":5377},
                {"id":"sAWnYi4xf5g","title":"Dr. Peter Attia on how to make your final decade of life as enjoyable as possible","duration":807},
                {"id":"DkS1pkKpILY","title":"What Alcohol Does to Your Body, Brain & Health","duration":7262},
                {"id":"wGnRcX53XBQ","title":"Heres What Blue Light Actually Does To Your Body","duration":405},
                {"id":"gR_f-iwUGY4","title":"The Optimal Morning Routine - Andrew Huberman","duration":989},
                {"id":"WDv4AWk0J3U","title":"How to Feel Energized & Sleep Better With One Morning Activity","duration":392},
                {"id":"DnvWAP99r3Y","title":"Dr David Sinclair: Can Aging Be Reversed? After 8 Weeks, Cells Appeared 75% Younger In Tests!","duration":8947},
                {"id":"jf8PhnEib5k","title":"Eckhart Tolle: A New Earth | Oprah's Book Club Bonus Episode","duration":3187},
                {"id":"VvBzsUesQ68","title":"Oprah Winfrey Early Interview with Eckhart Tolle — Power of Now, A New Earth","duration":5188},
                {"id":"VF6lPon9x4o","title":"My Opinion Of The Carnivore Diet","duration":58},
                {"id":"HHhEPUp5X_I","title":"How Mindfulness Can Bring Balance to Your World | Eckhart Tolle | Rubin Report","duration":4825},
                {"id":"jPpUNAFHgxM","title":"Alan Watts - Guided Meditation (Awakening The Mind)","duration":885},
                {"id":"wYREQkVtvEc","title":"How To Deadlift: Starting Strength 5 Step Deadlift","duration":482},
                {"id":"iAEgMhq_FJs","title":"Starting & Scaling a Successful Regenerative Ranching Business w/ Jacob Wolki","duration":6991},
                {"id":"W4OQaqqFKj0","title":"Proof of Work Ep1  \\\"Parallels in fitness and Bitcoin\\\"","duration":2872},
                {"id":"DWmGArQBtFI","title":"How to Fix \"Low Back\" Pain (INSTANTLY!)","duration":563},
                {"id":"JTDVwPdvu3E","title":"Why We Need Our Farmers, and Our Farmers Need US (BWP125)","duration":4976},
                {"id":"ZToicYcHIOU","title":"Daily Calm | 10 Minute Mindfulness Meditation | Be Present","duration":630},
                {"id":"i8Nq2pcNp60","title":"Texas Slim & Jake Wolki: Beef Initiative & Industrial Food Complex | Regenerative Health Podcast #15","duration":3326},
                {"id":"qPKd99Pa2iU","title":"Dr. Paul Conti: How to Improve Your Mental Health | Huberman Lab Guest Series","duration":11718},
                {"id":"pwaWilO_Pig","title":"Joe Rogan Experience #1109 - Matthew Walker","duration":6933},
                {"id":"Dv8q_gOUcJo","title":"Becoming an Sovereign Individual via Food & the Beef Initiative w/ Texas Slim","duration":3828},
                {"id":"-l9hVUzayH0","title":"The Issue With Ultra-Processed Foods | Jordan Peterson","duration":41},
                {"id":"GLy2rYHwUqY","title":"Total Body Yoga | Deep Stretch | Yoga With Adriene","duration":2713},
                {"id":"K60xHx836T0","title":"Winning The Mental Battle of Physical Fitness and Obesity | TEDx","duration":1112},
                {"id":"O3jeBF7S9ss","title":"Week 120 - Day 2 | GYM | Treadmill and Chat | Bitcoin | AI | Community","duration":2444},
                {"id":"VL5Ab0T07e4","title":"Build A Bigger Deadlift With Perfect Technique (Conventional Form)","duration":536},
                {"id":"wlACYsTEayA","title":"Why sunscreen looks so WEIRD in UV","duration":125},
                {"id":"YdHClX1Gzgo","title":"How to Wake Up from an Unhappy Life with Eckhart Tolle","duration":723},
                {"id":"UF0nqolsNZc","title":"Using Light (Sunlight, Blue Light & Red Light) to Optimize Health | Andrew Huberman","duration":8623},
                {"id":"LU6Oi80n5J4","title":"Wim Hof Guided Breathing (3 rounds with onscreen timer)","duration":905},
                {"id":"BQCOJlFXvpU","title":"The Carnivore Diet & Bitcoin | Dr. Shawn Baker","duration":6389},
                {"id":"rwP_ggwOqTg","title":"EMBRACE Deflation With Bitcoin! Guest JEFF BOOTH","duration":3891},
                {"id":"q8BGYhreaco","title":"The Obesity Epidemic, Explained","duration":3165},
                {"id":"aBISYSQjpUg","title":"Eckhart Tolle — Reality Is Beyond Thought","duration":5209},
                {"id":"0BNejY1e9ik","title":"Wim Hof Method Guided Breathing for Beginners (3 Rounds Slow Pace)","duration":660},
                {"id":"nm1TxQj9IsQ","title":"Master Your Sleep & Be More Alert When Awake","duration":4925},
                {"id":"pq6WHJzOkno","title":"Using Deliberate Cold Exposure for Health and Performance | Huberman Lab","duration":8109},
                {"id":"75doh5hJVRI","title":"Anti Aging Doctor's Key to Looking Younger | Joe Rogan","duration":970},
                {"id":"gP1NA5f4LfE","title":"Joe Rogan Experience #1108 - Peter Attia","duration":10300},
                {"id":"g-7ZWPCWv0U","title":"How to Fix Your Posture in 4 Moves! (PERMANENTLY)","duration":559},
                {"id":"_rGipsgBfQY","title":"Eckhart Tolle Reveals the Secret to Fulfillment Through Stillness and Action","duration":5692},
                {"id":"ZKC3hiyLeRc","title":"Dr. Jason Fung - The Aetiology of Obesity","duration":2252},
                {"id":"uxM_CLsvieE","title":"Joe Rogan Experience #901 - Dr. Rhonda Patrick","duration":10600},
                {"id":"BHY0FxzoKZE","title":"The Brain-Changing Benefits of Exercise | Wendy Suzuki | TED","duration":783},
                {"id":"K4Ze-Sp6aUE","title":"The Science of Eating for Health, Fat Loss & Lean Muscle | Dr. Layne Norton","duration":13775},
                {"id":"K81-SLUFo9c","title":"NEVER DO PULL-UPS LIKE THIS! | 10 Most Common Mistakes","duration":715},
                {"id":"Dp3truKibtc","title":"5 Training Mistakes Everyone Makes When They Start Lifting","duration":749},
                {"id":"LjCRWwm0Xdk","title":"Bitcoin Carnivore Diet","duration":1667},
                {"id":"j5WCgs2dyaE","title":"I Survived 24 Hours W/ Wim Hof","duration":913},
                {"id":"c9D8p1kG0Cc","title":"Why Jeff Booth Wrote The Price of Tomorrow (THE Bitcoin Podcast)","duration":632},
                {"id":"pUP0rSIu2TI","title":"I AVOID 5 FOODS & my body is 30 YEARS YOUNGER! Harvard Genetics Professor David Sinclair","duration":869},
                {"id":"Us8n8VBQn_c","title":"The World's No.1 Sleep Expert: The 6 Sleep Hacks You NEED! Matthew Walker","duration":7541},
                {"id":"BVChr0wiKyA","title":"Are Seed Oils Bad For Your Health?","duration":55},
                {"id":"bEbtf7uS6P8","title":"Dr. Matthew Walker on Sleep for Enhancing Learning, Creativity, Immunity, and Glymphatic System","duration":9435},
                {"id":"bEv6CCg2BC8","title":"How To Get A Huge Squat With Perfect Technique (Fix Mistakes)","duration":660},
                {"id":"bs_Ej32IYgo","title":"Untamed Strength: \"How To\" SQUAT - High bar/Low bar","duration":1566},
                {"id":"5MuIMqhT8DM","title":"Sleep Is Your Superpower | Matt Walker | TED","duration":1159},
                {"id":"LjbblNr14iA","title":"Eckhart Tolle Taught Me To Manifest Better Than Anyone Else | Lewis Howes","duration":5680},
                {"id":"Rm5_wCObeQI","title":"Carnivore Diet, Health Care Crisis, and Bitcoin with Dr. Shawn Baker (WiM463)","duration":4917},
                {"id":"v7AYKMP6rOE","title":"Yoga For Complete Beginners - 20 Minute Home Yoga Workout!","duration":1425},
                {"id":"U3HlEF_E9fo","title":"How To Squat Properly: 3 Mistakes Harming Your Lower Back (FIX THESE!)","duration":575},
                {"id":"2jPOkbLih1c","title":"Eckhart Tolle: 3 Deadly Habits That Destroy the Law of Attraction | Lewis Howes","duration":5683},
                {"id":"vD-dEl7R2Bg","title":"Ranking Every Exercise From WORST To BEST! - Ft. Jeff Nippard","duration":1988},
                {"id":"urKG9oi0krc","title":"Dollar vs. Diet: Dr. Paul Saladino Dives into America's Nutritional Crisis","duration":7180},
                {"id":"gcNh17Ckjgg","title":"How to PROPERLY Squat for Growth (4 Easy Steps)","duration":435},
                {"id":"PKfR6bAXr-c","title":"Longevity & Why I now eat One Meal a Day","duration":969},
                {"id":"7kGnfXXIKZM","title":"Dr. Chris Knobbe - Diseases of Civilization: Are Seed Oil Excesses the Unifying Mechanism?","duration":2723},
                {"id":"LLVf3d0rqqY","title":"How to do Intermittent Fasting: Complete Guide","duration":1523},
                {"id":"TWkKPijaDyQ","title":"Proof Of Work Ep2 \\\"Parallels in Fitness and Bitcoin\\\"","duration":4184},
                {"id":"CT8yuKUQ_No","title":"102. Low Time Preference Aging w/ P.D. Mangan","duration":7216},
                {"id":"hmkoFDMAvkc","title":"Do NOT Cook with This!!!","duration":471},
                {"id":"GQskSm1OpXU","title":"The Crossover Between Bitcoin and Carnivore Diet","duration":60},
                {"id":"pm7Ff5viURM","title":"Jeff Booth Reveals How Much Bitcoin You Need!","duration":615},
                {"id":"XxWcirHIwVo","title":"How to PROPERLY Deadlift for Growth (5 Easy Steps)","duration":483},
                {"id":"TBd8GGKgRWo","title":"Carnivore Legends Explain the Importance of Local Farms and Red Meat","duration":724},
                {"id":"-Mbr55h3BeQ","title":"The Official Push-Up Checklist (AVOID MISTAKES!)","duration":655},
                {"id":"LG53Vxum0as","title":"How to Focus to Change Your Brain","duration":5383},
                {"id":"8cvhwquPqJ0","title":"BECOMING SUPERHUMAN WITH ICE MAN - Wim Hof","duration":2576},
                {"id":"f1Zc7EYXdds","title":"How To Be PRESENT: Eckhart Tolle's Insights","duration":1632},
                {"id":"QmOF0crdyRU","title":"Controlling Your Dopamine For Motivation, Focus & Satisfaction","duration":8192},
                {"id":"6p_yaNFSYao","title":"Mindfulness Meditation - Guided 10 Minutes","duration":588},
                {"id":"hJbRpHZr_d0","title":"Yoga For Anxiety and Stress","duration":1675},
                {"id":"6kEyLJMILU0","title":"Texas Slim: Texas Slim: Saving The American Rancher - The Crisis In The Beef Industry | MMP #289","duration":6099},
                {"id":"rQmqVVmMB3k","title":"The $100 Billion Dollar Ingredient making your Food Toxic","duration":1701},
                {"id":"myv7yydtCKc","title":"Junk food, sugar and additives - The dark side of the food industry | DW Documentary","duration":2546},
                {"id":"KfNkDQ-NI9U","title":"262. Shawn Baker, the Carnivore MD","duration":6617},
                {"id":"zPmgTJGPzlg","title":"A Dialogue with Ram Dass and Eckhart Tolle","duration":7222},
                {"id":"jN0pRAqiUJU","title":"Best Exercises for Overall Health & Longevity | Dr. Peter Attia & Dr. Andrew Huberman","duration":634},
                {"id":"JPxjOflSTTo","title":"The Best Science-Based Morning Routine","duration":55},
                {"id":"RqcOCBb4arc","title":"The PERFECT 10 Minute Daily Posture Routine (FIX YOUR SIT!)","duration":646},
                {"id":"omuAtS7zOa0","title":"7-Step ATG Mobility Routine (Plus 4-Step Shoulder Routine)","duration":1214},
                {"id":"sIvJTfGxdFo","title":"The Official Pull-Up Checklist (AVOID MISTAKES!)","duration":791},
                {"id":"hCDzSR6bW10","title":"The Official Deadlift Checklist (AVOID MISTAKES!)","duration":916},
                {"id":"BFBZCZ5OCXc","title":"Why Seed Oils Took Over Our Food","duration":43},
                {"id":"XcvhERcZpWw","title":"Micronutrients for Health & Longevity | Dr. Rhonda Patrick","duration":10173},
                {"id":"3dppG0JwPag","title":"EAT THIS EVERY DAY To Heal Your Brain, Gut & Body | Dr. Mark Hyman","duration":9065},
                {"id":"FEsl2xNDrmg","title":"Japanese Oldest Doctors: Just Eat These Every Day and You Will Live to 100","duration":612},
                {"id":"7nJgHBbEgsE","title":"Dr. Jason Fung: Fasting as a Therapeutic Option for Weight Loss","duration":4288},
                {"id":"ohR7EIby7yY","title":"Texas Slim: From Fake Meat to Edible Insects, Truth Behind The War on Beef | The Nation Speaks","duration":562},
                {"id":"rQZLFNkh0W8","title":"Dr. Anthony Chaffee on The Future Of Farming","duration":4982},
                {"id":"slwgXXVXM3I","title":"Fast food, fat profits: Obesity in America | Al Jazeera Documentary","duration":1395},
                {"id":"h2aWYjSA1Jc","title":"Sleep Toolkit: Tools for Optimizing Sleep & Sleep-Wake Timing","duration":6115},
                {"id":"foU1qgOdtwg","title":"Meditation: Eckhart Tolle","duration":2182},
                {"id":"AKGrmY8OSHM","title":"#NSDR (Non-Sleep Deep Rest) with Dr. Andrew Huberman","duration":650},
                {"id":"aXflBZXAucQ","title":"Why We Sleep: Science of Sleep & Dreams | Matthew Walker | Talks at Google","duration":3292},
                {"id":"iW419hInhHw","title":"The Beef Initiative with Texas Slim (WiM224)","duration":3107},
                {"id":"FJB7e8PP0wU","title":"Proof Of Work(out) - DrOrangePill - July 2022","duration":148},
                {"id":"ceFyF9px20Y","title":"Fat Chance: Fructose 2.0","duration":5175},
                {"id":"n9IxomBusuw","title":"The Biology of Slowing & Reversing Aging | Dr. David Sinclair","duration":7843},
                {"id":"EFyMXM398YI","title":"Eckhart Tolle: A New Earth | Oprah's Book Club","duration":3203},
                {"id":"kBWAon7ItDw","title":"How To PROPERLY Barbell Row For A Bigger Back (Stop Making These Mistakes!)","duration":571},
                {"id":"dOyNbfZQ9O4","title":"Cathedra Bitcoin: Building a Bitcoin Mining Company | The Meat Mafia Podcast","duration":5244},
                {"id":"J_ekvFybels","title":"How to Squat: The Definitive Guide","duration":976},
                {"id":"4Y2ZdHCOXok","title":"How to PROPERLY Bench Press for Growth (5 Easy Steps)","duration":485},
                {"id":"QsYre__-aro","title":"STOP Doing Dumbbell Press Like This (5 Mistakes Slowing Your Chest Gains)","duration":449},
                {"id":"IT94xC35u6k","title":"20 min Fat Burning Workout for TOTAL BEGINNERS (Achievable, No Equipment)","duration":1338},
                {"id":"Ho9em79_0qg","title":"Yoga For Hips & Lower Back Release | Yoga With Adriene","duration":1400},
                {"id":"wTBSGgbIvsY","title":"How Meditation Works & Science-Based Effective Meditations","duration":8762},
                {"id":"92kYDVjX0G0","title":"Peter Attia on The Best Exercises for Longevity","duration":371},
                {"id":"lDQofCXuYik","title":"McDonalds Secret Ingredients You Never Knew About | Paul Saladino","duration":823},
                {"id":"TUADs-CK7vI","title":"Fat Fiction: The Hidden Dangers Of Low-Fat Diets: Full Movie Documentary","duration":6136},
                {"id":"hZeoyYOYgg4","title":"How to be Completely Carefree - Teachings from Eckhart Tolle","duration":508},
                {"id":"n28W4AmvMDE","title":"How Sugar & Processed Foods Impact Your Health | Dr. Robert Lustig","duration":12561},
                {"id":"qVek72z3F1U","title":"The Smartest Push Pull Legs Routine (Fully Explained)","duration":1145},
                {"id":"vpEq89vPNHc","title":"Ep.22: Jeff Booth on What if everything we know about free markets is wrong?","duration":3835},
                {"id":"PgGtNgLSCqU","title":"The Power of Now — Animated Summary","duration":1009},
                {"id":"lhHKljqRa-M","title":"How to SURVIVE The \\\"Final Reset\\\" of The Economy | Jeff Booth","duration":3142},
                {"id":"mVMU1AFiSV0","title":"Low Time Preference, Bitcoin and Health with Mind / Matter - Meet the Taco Plebs","duration":1594},
                {"id":"8PDKtaigIOw","title":"The two metrics that are most significantly associated with longevity","duration":59},
                {"id":"5GSeWdjyr1c","title":"A Guided Meditation on the Body, Space, and Awareness with Yongey Mingyur Rinpoche","duration":879},
                {"id":"cthDKq4SEqk","title":"From Unhealth to Health with The Meat Mafia","duration":1826},
                {"id":"k_RiNPKJNdE","title":"How farmers are protecting the soil and our food security | DW Documentary","duration":2546},
                {"id":"WFcYF_pxLgA","title":"How to Exercise & Eat for Optimal Health & Longevity | Dr. Gabrielle Lyon","duration":11017},
                {"id":"LpSDuDIaBGk","title":"Why Social Health Is Key to Happiness and Longevity | TED","duration":576},
                {"id":"hL54mn7vW8w","title":"Surf... Eat Meat... Repeat... \\\"The Remembering\\\" Animal Based Gathering In Santa Teresa Costa Rica","duration":2959},
                {"id":"Wk9p3dhMYdk","title":"How I FIXED My Terrible Sleep - 10 Habits","duration":612},
                {"id":"DTCmprPCDqc","title":"Exercise, Nutrition, Hormones for Vitality & Longevity | Dr. Peter Attia","duration":10203},
                {"id":"ouCWNRvPk20","title":"How to Build, Maintain & Repair Gut Health | Dr. Justin Sonnenburg","duration":8079},
                {"id":"xn9WtVYy1gU","title":"Bitcoin Will FIX Our Food System - Here's How! w/ Texas Slim (BWP37)","duration":8826}
            ]
        },
        {
            "id": "history",
            "name": "History & Documentaries",
            "emoji": "📜",
            "desc": "Bitcoin's past - origins, cypherpunks, mainstream films",
            "color": "#92400e",
            "videos": [
                {"id":"F5AiHEzu-uc","title":"The Historical Mystery : WHO IS SATOSHI NAKAMOTO? The True Story of Bitcoin's Creator","duration":78},
                {"id":"eRzb4vEneHA","title":"Historical Bitcoin UTXO Set Animation (4 Hour Version)","duration":14711},
                {"id":"4yFjOoDp6zY","title":"Bitcoin: History of \"Pi-coins\" (Outputs Worth Exactly 3.14 BTC or 3.14159265 BTC)","duration":104},
                {"id":"tWU3O3X5kKE","title":"The story behind \\\"Bitcoin Pizza Day\\\"","duration":119},
                {"id":"gcwnpvODd-8","title":"The Rise and Rise of Bitcoin | Official Trailer (2014)","duration":143},
                {"id":"Mcz_4MvPlOE","title":"[Cypherpunks & Bitcoin] Ep4 - Bitcoin and the End of History","duration":956},
                {"id":"fsfoqdqyykI","title":"The Most Illegal Business In The World: Silk Road","duration":2672},
                {"id":"Bze53qwHS8o","title":"Mystery Founder Of Bitcoin: Uncovering Satoshi Nakamoto's Identity Of Bitcoin Matters | CNBC","duration":395},
                {"id":"tPYYbIH372Y","title":"Bitcoin: History of \"Wholecoins\" (Outputs Worth Exactly 1 BTC)","duration":102},
                {"id":"iSF0KGsFuI8","title":"Money Electric: The Bitcoin Mystery | Official Trailer | HBO","duration":160},
                {"id":"EcYnz29l8_0","title":"Who ACTUALLY Created Bitcoin","duration":767},
                {"id":"_Kav2K1DVWo","title":"The Most Elusive Identity On The Internet - Pt. 1 (Ft. Nexpo)","duration":1802},
                {"id":"f39jflibxH4","title":"Oppenheimer vs Nakamoto","duration":590},
                {"id":"GpMP6Nh3FvU","title":"The Dark Side Of The Silk Road","duration":4485},
                {"id":"N4m86PL4qs8","title":"Bitcoin: History of \"X-coins\" (Outputs Worth Exactly 10 BTC)","duration":109},
                {"id":"wSh_KzcY_dA","title":"Stories About Cryptocurrency | 60 Minutes Full Episodes","duration":4000},
                {"id":"OH-xRaHdqy4","title":"Japan Bitcoin Documentary - Why One Tokyo Company Is Changing Global Finance Forever","duration":2326},
                {"id":"SlbyHzYZXjA","title":"FBI agent explains Silk Road","duration":421},
                {"id":"NAg_rJ8mfVs","title":"The Government hates him // The Ross Ulbricht story","duration":554},
                {"id":"tdxY61IJ24E","title":"Bitcoin: Qui est Satoshi Nakamoto ? - Enquête sur la plus grande énigme numérique - Documentaire AT","duration":3183},
                {"id":"0rlnVQoiVyc","title":"Beginner's Guide #5: The History of Bitcoin with Marty Bent","duration":5039},
                {"id":"FwWU1W7IGbY","title":"Seeking Satoshi - The Mystery Bitcoin Creator /part 1/","duration":3353},
                {"id":"3XEuqixD2Zg","title":"God Bless Bitcoin | Full HD Movie | Documentary | Why Bitcoin is the Best Form of Money","duration":5359},
                {"id":"M1JKLXxFDZc","title":"BITCOIN ONLY: Saifedean's \\\"Unconditional\\\" Advice for the Next Decade","duration":1283},
                {"id":"W03SVhhOaEU","title":"The Bitcoin Full Node Sculpture 7.0 - A Cypherpunk Chronometer - MirrorNode","duration":53},
                {"id":"3Cr1efEBo_M","title":"INSIDE SILK ROAD: The Billion-Dollar Dark Web Drug Empire","duration":654},
                {"id":"4hWMHLF-OEg","title":"Inside Peru's Hidden Bitcoin Revolution | Full Movie","duration":2379},
                {"id":"lFw-3wynj-o","title":"Adam Back is Satoshi Nakamoto | Charles Hoskinson and Lex Fridman","duration":228},
                {"id":"DGNhX8nz7Eg","title":"Seeking Satoshi - The Mystery Bitcoin Creator /part 2/","duration":2884},
                {"id":"LjNMgeqUgks","title":"Meet the man who spent millions worth of bitcoin on pizza","duration":42},
                {"id":"4_tAOuMVFd0","title":"A Remedy Against Inflation? | Bitcoin: Digital Gold | FULL Cryptocurrency Documentary 2026","duration":3551},
                {"id":"2TNhojuAxMI","title":"Magic Money: The Bitcoin Revolution","duration":3302},
                {"id":"mgmVEtSgu3o","title":"Bitcoin FUD | Cryptocurrency Documentary | Full Movie | Blockchain","duration":3592},
                {"id":"yt4L67C5_q8","title":"Historical Price of 1 USD in Terms of Bitcoin (11/12/24 Update)","duration":87},
                {"id":"S70MSDaLAKw","title":"Why Bitcoin's Creator Disappeared Forever...","duration":1379},
                {"id":"dMSv4mgiy1o","title":"How Bitcoin's early cypherpunks paved the way for Satoshi!","duration":473},
                {"id":"9vM0oIEhMag","title":"Cypherpunks Write Code","duration":2635},
                {"id":"BoboO6QPGow","title":"Satoshi Nakamoto goes public and denies he's bitcoin founder","duration":79},
                {"id":"b-7dMVcVWgc","title":"\\\"This Machine Greens\\\" - Bitcoin Documentary - Online Premiere","duration":2285},
                {"id":"oEgPTIN5hVE","title":"How Bitcoin Started: The Untold Story of Satoshi Nakamoto (Full Documentary)","duration":833},
                {"id":"KjMQvN7Fajs","title":"Who Created Bitcoin? The Mystery of Satoshi Nakamoto","duration":978},
                {"id":"GZI0qo3diUo","title":"Unlocking Crypto | The Bitcoin Field Guide | Full Documentary Movie | Free Movie","duration":6500},
                {"id":"QTyzyP2Afys","title":"Cryptocurrencies - The future of money? | DW Documentary","duration":2547},
                {"id":"wzJLuEU8ejo","title":"FULL MOVIE: The Legendary Treasure of Satoshi Nakamoto","duration":5400},
                {"id":"3Rnqst5qCgA","title":"Bitcoin is Generational Wealth - A Short Film","duration":883},
                {"id":"ao9SdxPtuIE","title":"Satoshi Nakamoto & The Origins of Bitcoin","duration":167},
                {"id":"9cb94OuCR9U","title":"The Alleged CIA Connection to Bitcoin's Mysterious Origin","duration":498},
                {"id":"8Z4hGvUET8I","title":"Bitcoin: Beyond The Bubble | Full Documentary","duration":2086},
                {"id":"eoBmOf4GDyo","title":"La storia di Bitcoin: episodio 3 | Arrivano i Cypherpunk","duration":1000},
                {"id":"ecy7lLjDK6s","title":"Bitcoin: History of \"L-coins\" (Outputs Worth Exactly 50 BTC)","duration":109},
                {"id":"h3nlVsy81wI","title":"The Bitcoin Mystery Revealed! Who is Satoshi Nakamoto?","duration":584},
                {"id":"xw9VshkgxJ4","title":"The Great Reset and the Rise of Bitcoin | Award Winning Documentary","duration":4668},
                {"id":"GTdCeFyBVyk","title":"Historical Bitcoin UTXO Set Animation (2 Minute Version)","duration":106},
                {"id":"q7CgCdwJCqU","title":"Hal Finney's contributions to Bitcoin","duration":41},
                {"id":"m7_WDzPyoqU","title":"I Live 500 Feet From A Bitcoin Mine. My Life Is Hell.","duration":1270},
                {"id":"chcASJW1pMs","title":"Satoshi Nakamoto - The Beginning of Bitcoin Documentary 2019","duration":5021},
                {"id":"4_4lFX8t3I8","title":"Evolution of Cryptocurrency: Then, Now & Future (1983-2100)","duration":488},
                {"id":"f-4Rs3Sqlhc","title":"the most important video on bitcoin i will ever make....","duration":602},
                {"id":"3n_WnVPhRTo","title":"The BITCOIN Unsolved Mystery | Satoshi Nakamoto Enigma | Cryptocurrency | ENDEVR Explains","duration":384},
                {"id":"XzSFu7aMCu8","title":"Human or Alien? Truth About Satoshi Nakamoto and Bitcoin Creator, Complete Documentary in English","duration":356},
                {"id":"Fx0OcKcLQ0A","title":"🧙 Bitcoin's creator unveiled? Theories about Satoshi Nakamoto","duration":1826},
                {"id":"M7ZLNczMeS0","title":"Deep Web: The Untold Story of Bitcoin and the Silk Road","duration":5183},
                {"id":"oksraL7wN6Q","title":"God Bless Bitcoin | Full Movie | Documentary","duration":5352},
                {"id":"7RlaC9ZJNtA","title":"Unmasking the Creator of Bitcoin","duration":3198},
                {"id":"phtHSjSrsJ8","title":"What is Bitcoin's UNTOLD History?","duration":927},
                {"id":"Yh1dOmQJoWQ","title":"The Rise and Rise of Bitcoin (1080p) FULL DOCUMENTARY - Bitcoin, Crypto, Money","duration":5796},
                {"id":"jsccmbOT6FU","title":"Biggest Bitcoin Holders 2024","duration":228},
                {"id":"4d4OE7D2hqA","title":"Bitcoin: History of \"D-coins\" (Outputs Worth Exactly 500 BTC)","duration":107},
                {"id":"H1oc5HKixBg","title":"The Bitcoin Full Node Sculpture 4.0 - A Cypherpunk Chronometer","duration":60},
                {"id":"pbFEexyOwkw","title":"Finding Satoshi","duration":793},
                {"id":"b1ruW89S4PM","title":"Satoshi Nakamoto: The Mysterious Genius Behind Bitcoin","duration":709},
                {"id":"hzPSxy55MPE","title":"Bitcoin: History of \"M-coins\" (Outputs Worth Exactly 1,000 BTC)","duration":106},
                {"id":"Cw29h7LhEuE","title":"Bitcoin Update - just buy $1 worth of bitcoin please!","duration":384},
                {"id":"Peih23WVK54","title":"Dark Web King: From Bedroom Student to Billionaire Drug Lord | The Untold Story of Ross Ulbricht","duration":1511},
                {"id":"vjGhiac85h4","title":"The History of Crypto Goes Further Back Than You Think","duration":603},
                {"id":"IFVrVI4rZHM","title":"What Happened To Bitcoin's Founder?","duration":624},
                {"id":"ZKwqNgG-Sv4","title":"Bitcoin: The Trust Machine","duration":1471},
                {"id":"gQ8XKns2ipc","title":"The Satoshi Mystery The Origins of Bitcoin","duration":3191},
                {"id":"kyija0bPeIY","title":"Behind Silk Road: How Ross Ulbricht Brought Black Market to the Web | SLICE WHO | FULL DOCUMENTARY","duration":3263},
                {"id":"o-c_j2tgxDU","title":"What's REALLY Wrong with HBO's Bitcoin Documentary","duration":304},
                {"id":"hk3OLML16xY","title":"History of Bitcoin: 16 Year Anniversary","duration":611},
                {"id":"HDKQulqVCQg","title":"Bitcoin and the End of History","duration":956},
                {"id":"DomSK_oUGr4","title":"History of Bitcoin: 15 Year Anniversary","duration":579},
                {"id":"_0axyH2X6mI","title":"Morgan Spurlock Living with Bitcoin 2015. The Future of Bitcoin","duration":2516}
            ]
        },
        {
            "id": "kids-family",
            "name": "Kids & Family",
            "emoji": "👶",
            "desc": "Bitcoin explained for young audiences",
            "color": "#f472b6",
            "videos": [
                {"id":"Y9RdoOBVmbI","title":"Is School Failing You? - Albert Einstein | Tuttle Twins |","duration":228},
                {"id":"51ythXeqw40","title":"The SECRET TAX of inflation?","duration":61},
                {"id":"SOTXIpvwzwU","title":"Libertys Kids - Born Free And Equal","duration":1387},
                {"id":"qnyqQvIii0U","title":"Cryptocurrency Explained for Kids & Beginners: A Simple & Fun Guide","duration":141},
                {"id":"agUawDBjwv4","title":"Investing In Crypto For Your Kids: Should You?","duration":81},
                {"id":"MdC_0X71n88","title":"Scott Sibley  - SHAmory Bitcoin Card Game","duration":2164},
                {"id":"bDcGUxS9DHw","title":"Tuttle Twins S1E9 Full Episode \\\"Dumpsters & Disobedience\\\" | Angel","duration":1275},
                {"id":"YDH1Ca4TnkM","title":"Inflation doesn't just happen randomly...#tuttletwins","duration":45},
                {"id":"nqdv6Ad9Nt4","title":"What is Bitcoin? (for kids)","duration":221},
                {"id":"YimuIdEZSNY","title":"Balanced Diet - AumSum Kids","duration":331},
                {"id":"O3Vf2m-DIh0","title":"When money is easy to make, society begins to break. #goldstandard","duration":50},
                {"id":"RqJOqyzOmjw","title":"Understanding Inflation: The Basics Explained | It's a Money Thing","duration":198},
                {"id":"usHRc7G0gVo","title":"Statue of Liberty for Kids - FreeSchool","duration":282},
                {"id":"xTX-RRemYJU","title":"How Bad Money Makes Us Think Short-Term | Tuttle Twins","duration":467},
                {"id":"hSZyUI6rbC8","title":"A Bitcoin Bash & Corrupted Cash - Full Episode | Tuttle Twins |","duration":1345},
                {"id":"Sm56aKWVVoU","title":"How A Billionaire Taught His Kids Money Skills","duration":23},
                {"id":"BIh5OyZiHgA","title":"Teach Your Kids About Bitcoin With This Card Game! (BWP117)","duration":2199},
                {"id":"GPOv72Awo68","title":"How it Happened - The 2008 Financial Crisis: Crash Course Economics","duration":685},
                {"id":"JTl211YlFzc","title":"Internet Safety for Kids - Twinkl USA","duration":192},
                {"id":"otmgFQHbaDo","title":"Fiscal Policy and Stimulus: Crash Course Economics #8","duration":714},
                {"id":"94I9L90h0_s","title":"What is cryptocurrency? Bitcoin, blockchain & how it works","duration":117},
                {"id":"jcu3hsaLO0Q","title":"Tuttle Twins S1E12 Full Episode \\\"The Fight for the Future\\\" | Angel","duration":1614},
                {"id":"zs86WYACbr8","title":"Libertys Kids: The Intolerable Acts (2/2)","duration":651},
                {"id":"Bv9LCSMEgGQ","title":"BITCOIN EXPLAINED FOR KIDS","duration":122},
                {"id":"EfKuZayeksI","title":"What is Crypto | Cryptocurrency Explained for Kids | Crypto For Kids","duration":692},
                {"id":"uRU4ifbGolg","title":"Tuttle Twins S1E7 Full Episode \\\"Cake, Pies, & Flat Earth Guys\\\" | Angel","duration":1295},
                {"id":"yiKeLOKc1tw","title":"Online Privacy for Kids - Smile and Learn","duration":199},
                {"id":"IiXx7EmvGvg","title":"THATS ACTUALLY ILLEGAL?! Civil Disobedience | Tuttle Twins","duration":56},
                {"id":"zY_T-FNDgaM","title":"EP92: Bitcoin Karma with Scott, Mallory and Charlotte Sibley","duration":2671},
                {"id":"8k8I17idJg8","title":"Its actually illegal to do THAT?! | Tuttle Twins","duration":123},
                {"id":"FtaUelnAXrc","title":"Tuttle Twins S1E6 Full Episode \\\"The Inflation Monster\\\" | Angel","duration":1434},
                {"id":"3I81-P_lwvw","title":"What is Inflation for Kids| Financial Education | Financial Capability |Finance for Kids | Inflation","duration":341},
                {"id":"TyP09S0UEzA","title":"Laws, Rights & Responsibilities - Freedom of Speech","duration":156},
                {"id":"g9aDizJpd_s","title":"Supply and Demand: Crash Course Economics #4","duration":622},
                {"id":"KEhbYNmY3N4","title":"What REALLY Happens When You Start Exercising (Animated)","duration":546},
                {"id":"J7mMQ3ERNdg","title":"Tuttle Twins S1E11 Full Episode \\\"Free Speech Freestyle\\\" | Angel","duration":1337},
                {"id":"Kt-QIflZTik","title":"Tuttle Twins S1E1 - When Laws Give You Lemons","duration":1230},
                {"id":"zJHeIJGVCKI","title":"How War Makes Millionaires?! | Economics Explained","duration":274},
                {"id":"slKV2AiUOFk","title":"Healthy vs Unhealthy Foods Quiz for Kids","duration":292},
                {"id":"uNkMcaN-mMM","title":"Trapped In Communist Cuba | Tuttle Twins","duration":338},
                {"id":"3ez10ADR_gM","title":"Intro to Economics: Crash Course Econ #1","duration":729},
                {"id":"mQ9Y_KoOldU","title":"Bottomshelf Bitcoin ep. 56 - Scott Sibley and SHAmory","duration":2089},
                {"id":"GkNObgK43Z4","title":"Libertys Kids: The Boston Tea Party (2/2)","duration":651},
                {"id":"XNu5ppFZbHo","title":"What gives a dollar bill its value? - Doug Levinson","duration":232},
                {"id":"o-PNlhhVhZ8","title":"Hyperinflation Explained in One Minute","duration":71},
                {"id":"V-TeANzcKAA","title":"Bee Money | Teen Titans Go! | Cartoon Network","duration":125},
                {"id":"aRcXutXvfmM","title":"Financial Literacy-Needs and Wants | Learn about needs, wants, and opportunity costs","duration":278},
                {"id":"1dq7mMort9o","title":"Monetary Policy and the Federal Reserve: Crash Course Economics","duration":565},
                {"id":"d8uTB5XorBw","title":"Macroeconomics: Crash Course Economics #5","duration":823},
                {"id":"BL5vUVQvmX4","title":"What is Bitcoin? Explained in 3 Minutes | Tuttle Twins","duration":186},
                {"id":"Iyq4khMiM9A","title":"Saving vs Investing for Kids 💰🌱 | Types of Investments Explained with Fun Examples!","duration":151},
                {"id":"spAyoI-MZuk","title":"Libertys Kids - The Boston Tea Party","duration":1402},
                {"id":"UW5d58P4aM0","title":"5 Top Tips to Stay Safe Online","duration":104},
                {"id":"gf41D0SVNWk","title":"Building a Family Bitcoin Business - Pablo & Michael (Panties For Bitcoin) - #021","duration":2654},
                {"id":"X4uFSUpiifE","title":"Raising a Bilingual Bitcoin Family in NYC - Umi Miyahara - #016","duration":3040},
                {"id":"-VVJsoYZwcE","title":"Can Charity Do More Harm Than Good? | Tuttle Twins |","duration":285},
                {"id":"rT4ThQ55SD8","title":"Who Invented Bitcoin? (for kids)","duration":229},
                {"id":"_ekzsZZGfsk","title":"The World's First Kids Cartoon about Bitcoin! ⚡️ 🔴 Livestream Premiere | S2 E3 - Tuttle Twins |","duration":3501},
                {"id":"9NZTMmVBfK4","title":"What my kids think of bitcoin","duration":271},
                {"id":"lDNem8PxfT8","title":"Equity vs. Equality - Meet Thomas Sowell | Tuttle Twins","duration":324},
                {"id":"F4vEKLqf_K4","title":"When Innovation Destroys Jobs... and Creates Even More | Tuttle Twins Meet Henry Ford","duration":408},
                {"id":"Aul03GabnhY","title":"What happens when money isn't backed by anything? #goldstandard","duration":76},
                {"id":"U9d9JiyBRCI","title":"Tuttle Twins Episode 2 War of the Worms","duration":984},
                {"id":"Na3pq9wqJlA","title":"Libertys Kids: Midnight Ride (1/2)","duration":651},
                {"id":"auIOUn0ubDk","title":"What is Inflation? Explained for Kids (👾The Invisible Money Nibbler!)","duration":287},
                {"id":"ZxEqoaFT73c","title":"BITCOIN IS THE EVOLUTION OF MONEY!!! My kids kids won't know coins & notes or the word change!","duration":221},
                {"id":"ZP4UHlPpBFQ","title":"The Inflation Monster | Tuttle Twins","duration":60},
                {"id":"xyQY8a-ng6g","title":"How the food you eat affects your brain - TED-Ed","duration":293},
                {"id":"eKdc9429GwM","title":"Pups of Liberty: The Dog-claration of Independence","duration":1081},
                {"id":"94MGZ0Kv_co","title":"Americas Economic Secret Sauce - PragerU Kids","duration":382},
                {"id":"OmcUAOv9jAg","title":"The Gold Standard Explained | Tuttle Twins","duration":314},
                {"id":"_jk_1LSH6rI","title":"Building a Family Bitcoin Business - Pablo & Michael (Panties For Bitcoin) - 021","duration":2654},
                {"id":"t0ZAXwV1CI8","title":"Cryptocurrency Explained For Kids","duration":324},
                {"id":"GJ-FWHN3ljI","title":"Libertys Kids: The Boston Tea Party (1/2)","duration":651},
                {"id":"9CchpWy29es","title":"Investing & Stocks | Cash Course | PragerU Kids","duration":365},
                {"id":"lV9aSAIVYok","title":"Kids Finance - Inflation explained ","duration":67},
                {"id":"dAujdH8Iwcg","title":"Bitcoin Explained for Kids & Beginners | Digital Money Made Easy","duration":159},
                {"id":"WIA4_l8z7_0","title":"What is Inflation in 2 Minutes | Tuttle Twins","duration":160},
                {"id":"4L4qjUPHJvU","title":"Tuttle Twins Season 2 Official Trailer","duration":103},
                {"id":"DjeQOKF-3Eg","title":"Libertys Kids: United We Stand (1/2)","duration":651},
                {"id":"vPMDpb9ho4s","title":"Blockchain for Kids | Blockchain Explained for Beginners","duration":163},
                {"id":"jzD9rGe7fo4","title":"Ottos Tales: Lets Visit the Liberty Bell - PragerU Kids","duration":805},
                {"id":"DQhF_4J2GKo","title":"What is Cryptocurrency? Learn with Jess in the STEM Kids Clubhouse","duration":704},
                {"id":"RzjCvabZ4QU","title":"Why are Entry Level Workers Losing Jobs? - Tuttle Twins","duration":323},
                {"id":"Td32UyXW9HE","title":"How to Teach a Kid About Bitcoin (and Money) | Ep. 87 - #87 Kitty","duration":2656},
                {"id":"7olIXRL79sw","title":"Scott Sibley: Our Kids will pay EVERYTHING in Bitcoin!","duration":3332},
                {"id":"wgU-Xou0xYM","title":"Tiny Economists Ep. 3 | What Is Money? 💵 (For Kids!)","duration":247},
                {"id":"T83mK4jj2NE","title":"FF-140: Scott Sibley on teaching Bitcoin to children and raising kids today","duration":2800},
                {"id":"XIehKAjwCsw","title":"Scott Sibley of SHAmory - A Card Game For Bitcoin Mass Adoption","duration":2343},
                {"id":"jsTB7gSfDPI","title":"Constitution for Kids","duration":341},
                {"id":"B-IpiKURs3I","title":"1 Hour Tuttle Twins Compilation | Bitcoin, Bill of Rights & George Washington Lessons for Kids","duration":3969},
                {"id":"qyCXpr-ZDhE","title":"What are Taxes? A Simple Explanation for Teens and Beginners","duration":129},
                {"id":"xvo_m_r2ubg","title":"What is Bitcoin? A Simple Explanation for Teens and Beginners","duration":203},
                {"id":"qVGWCJJcDXM","title":"60 Minutes Tuttle Twins | Wholesome Cartoon Compilation for Family","duration":3627},
                {"id":"HxySrSbSY7o","title":"Being Safe on the Internet - AMAZE","duration":178},
                {"id":"Z-qP41O-NxY","title":"The lesson on SOCIALISM school didn't teach you - FULL EPISODE","duration":1399},
                {"id":"LuboVKBFnl0","title":"🎶 When Money Is Controlled Money Is Corrupted - Full Song | Tuttle Twins |","duration":159},
                {"id":"mwSAuNb44lU","title":"How Money Works Explained in One Minute","duration":71},
                {"id":"rIYfipLBp2w","title":"Isn't it just made up money? 🤔","duration":60},
                {"id":"cv7SRW_kYLk","title":"How to Teach Kids Where Money Comes From (5 Different Places)","duration":438},
                {"id":"ISIp8Y3tfT8","title":"Incentives: The Usual Suspects - PragerU Kids","duration":368},
                {"id":"Dugn51K_6WA","title":"Money and Finance: Crash Course Economics #11","duration":636},
                {"id":"tQ1_8M1K0tM","title":"Cryptocurrency Explained To Kids","duration":1268},
                {"id":"3sUCSGVYzI0","title":"Deficits and Debts: Crash Course Economics #9","duration":451},
                {"id":"tAbeAZJQLYE","title":"How Equity Failed \\\"The Fellowship of the Championship Ring\\\" - Tuttle Twins","duration":576},
                {"id":"DuR0KMBefj0","title":"🔴 Livestream Premiere - S2 E2 - Don't Trash Success | Tuttle Twins | Full Episode on the Angel App |","duration":2827},
                {"id":"ZBZWgrfZFbU","title":"Digestive System - Dr. Binocs Show","duration":227},
                {"id":"PwPoT5Adc6M","title":"STEM Meets Bitcoin: Fun, Educational Tools for Kids - Scott Sibley","duration":1702},
                {"id":"_ify35SJcrI","title":"Healthy Habits! Kids Songs - Super Simple Songs","duration":2128},
                {"id":"sLLg7l_rSuY","title":"Libertys Kids: The Shot Heard Round the World (1/2)","duration":651},
                {"id":"iy3n39Gnlpw","title":"Tuttle Twins S1E5 Full Episode \\\"Rising Tides & Dirty Deals\\\" | Angel","duration":1466},
                {"id":"MijgDZ3Pc0s","title":"Kindergarten teacher teaching financial literacy","duration":57},
                {"id":"fALa2zjlSN0","title":"Libertys Kids: The Intolerable Acts (1/2)","duration":651},
                {"id":"z2LDK1dLXUs","title":"Seek truth over teams! | Tuttle Twins","duration":60},
                {"id":"-PYYhxLk38g","title":"SHAmory with Scott and Mallory Sibley #bitcoin #money #crypto #cryptocurrency","duration":2865},
                {"id":"jv1O3IXoV4k","title":"Sneak Peek Tuttle Twins Season 4!","duration":138},
                {"id":"WAe2czS_wog","title":"Milton Friedman Teaches About Inflation in Rome | Tuttle Twins","duration":59},
                {"id":"GZ7y-yFdX9M","title":"Who Invented Money? | The History of Money | Barter System of Exchange | The Dr Binocs Show","duration":336},
                {"id":"MjPpG2e71Ec","title":"Private and Personal Information - Common Sense","duration":97},
                {"id":"nVEyG3C-Mqw","title":"Cyber Security for Kids","duration":250},
                {"id":"VEQaH4LruUo","title":"What is a calorie? - TED-Ed","duration":252},
                {"id":"9ymZlz2l53I","title":"Cryptocurrencies like bitcoin explained | CBC Kids News","duration":107},
                {"id":"08Sc9NQGccY","title":"Risky Business of National Budgets - PragerU Kids","duration":348},
                {"id":"IHVVVaMY10c","title":"'When money is controlled, money is corrupted!' #tuttletwins","duration":39},
                {"id":"fTTGALaRZoc","title":"Banking Explained - Money and Credit","duration":370},
                {"id":"3nwprNzztQE","title":"Bitcoin Explained for Kids & Teens (Parents: Show This to Your Kids!)","duration":371},
                {"id":"Z3xdGIyIV54","title":"How to explain Bitcoin and crypto to children?","duration":513},
                {"id":"Bwc46DAEGcA","title":"Fun Ways to Teach Kids About Bitcoin","duration":3695},
                {"id":"T8-85cZRI9o","title":"Inflation and Bubbles and Tulips: Crash Course Economics #7","duration":625},
                {"id":"D3JCOzq9qFE","title":"Ep. 10 Scott Sibley of SHAmory - Kids Can Grasp Bitcoin Through This Simple Card Game","duration":2457},
                {"id":"2tYiMqom9Go","title":"Seashells as Money? | Tuttle Twins","duration":60},
                {"id":"ZJKaqn2RrQ4","title":"Libertys Kids - We the People","duration":1398},
                {"id":"gS05vIvAW9I","title":"Dollars or Bitcoin? Which one is better? | Economics Explained","duration":419},
                {"id":"Q-GZ1K1FjsI","title":"Fridgetopia & the Federal Freezerve | Tuttle Twins","duration":453},
                {"id":"B43YEW2FvDs","title":"Economic Systems and Macroeconomics: Crash Course Economics","duration":618},
                {"id":"LK3Cs8EgOQo","title":"Libertys Kids - The First Fourth of July","duration":1398},
                {"id":"0SDCdQcnKuQ","title":"What Everyone Should Know About College - Tuttle Twins FULL EPISODE","duration":1399},
                {"id":"h4AsgigwgmY","title":"Why Were Seashells Used As Money? | Tuttle Twins","duration":171},
                {"id":"61G4YhJsSNo","title":"What is BITCOIN (Bitcoin explained to kids, teens and adults.)","duration":837}
            ]
        },
        {
            "id": "lightning",
            "name": "Lightning",
            "emoji": "⚡",
            "desc": "Lightning Network & Layer 2",
            "color": "#7c3aed",
            "videos": [
                {"id":"XBrQ4veNyOI","title":"Masterclass su Lightning Network alla BWR23","duration":5694},
                {"id":"vyDtzx_PYNk","title":"Bitcoin Lightning Wallets Compared","duration":661},
                {"id":"7QAmlcrZD2U","title":"The Lightning Network Explained in Under 3 Minutes","duration":171},
                {"id":"y6opPXlgG_I","title":"The Lightning Network: Business Ready Solutions with BootstrapBandit - Bitcoin Twitter Spaces Live","duration":7207},
                {"id":"LRZy-VtCPe4","title":"Lightning 101: Node Profitability feat PLEBNET","duration":4092},
                {"id":"MGNvaJyZ25A","title":"Bitcoin Lightning Network: How to Send and Receive Payments","duration":592},
                {"id":"GO3DX2ICitg","title":"Cypherpunks & Lightning Network | Alex Leishman","duration":1755},
                {"id":"fEPW6RXMGmA","title":"Mastering the Lightning Network with Andreas and René - Bonus Livestream Event","duration":9079},
                {"id":"x3Q9mEdelK4","title":"Understanding Aqua Wallet: The Mobile Wallet for Bitcoin, Lightning, and Liquid Networks","duration":1792},
                {"id":"9Th5BPBVpTE","title":"Tutorial da carteira Breez para Lightning Network","duration":3730},
                {"id":"_e_D5s-XQm4","title":"Citadel Dispatch E39: running a lightning routing node and plebnet","duration":4989},
                {"id":"CG69c71aSLQ","title":"BITCOIN LIGHTNING NETWORK EXPLAINED ⚡ - Easy Guide to Use & Join.","duration":346},
                {"id":"BeCGnY_aVUM","title":"Mutiny Wallet Meetup #23 2024-04-11","duration":3153},
                {"id":"LLblHYLf9JI","title":"WHY ARE WE BULLISH? Plebnet Takeover - JC, KP, VS, Walton","duration":4847},
                {"id":"7VyUqRyYT9w","title":"Best Lightning Network Wallet - low BTC transaction fees","duration":151},
                {"id":"RQDfd86yWL0","title":"Is the United States government silently stacking bitcoin?","duration":112},
                {"id":"i4z-2v_0H1k","title":"Strike CEO: Worst Thing Is Not Owning Enough Bitcoin","duration":288},
                {"id":"6C4Vsq1LF4o","title":"Bitcoin's Lightning Network Is EXPLODING","duration":2493},
                {"id":"9DVyI2A7MzU","title":"Lightning in a High Fee Environment with Niftynei, D++ & Nate (SLP483)","duration":5053},
                {"id":"O_IX0QOr9-o","title":"Lessons from running a Lightning Network Routing Node | The Bitcoin Plebs Podcast - Episode 11","duration":4463},
                {"id":"ldUwf_s44Zg","title":"LIGHTNING SESSION: Bitcoin Wallets Explained","duration":108},
                {"id":"5qISqqGnQOc","title":"Tony Giorgio on Building Mutiny Wallet, Browsers over App Stores, and Lightning Everywhere | E115","duration":5501},
                {"id":"eHwZVZLAOl0","title":"Swan Lounge: Plebnet and the Bitcoin Lightning Network","duration":6966},
                {"id":"yKdK-7AtAMQ","title":"Bitcoin Lightning Network Explained: How it Actually Works","duration":1277},
                {"id":"cuBJe1YPNNU","title":"Zapping on Nostr? Sending Satoshis Via The Lightning Network","duration":60},
                {"id":"bW7hvvjum9o","title":"Bitcoin Lightning Network: Everything you need to know!","duration":1271},
                {"id":"tLZc-NLmV20","title":"Lightning Network Deep Dive with Laolu 'Roasbeef' Osuntokun","duration":2891},
                {"id":"nd5fX2vHuDw","title":"ALBY - Bitcoin Lightning Payments In Your Browser","duration":2535},
                {"id":"mKNpvPuoSzw","title":"Episode 7: Lightning Network: How Bitcoin Beats the Banks","duration":287},
                {"id":"3yQUhHdjNuc","title":"Wallet of Satoshi Made Simple: Send Bitcoin Fast, Even If You're New!","duration":4007},
                {"id":"HQXc0-B4Qvw","title":"Policy Is The Plot: Why Bitcoin Thrives In Financial Respression","duration":2960},
                {"id":"4kBCEbCWf1s","title":"Jack Mallers: Bitcoin Doesn't Need Trump - Trump Needs Bitcoin","duration":322},
                {"id":"372FBiomA2E","title":"Get Ready: Lightning Wallet Test 2024","duration":53},
                {"id":"t_4b-y4T8bY","title":"How To Use A Bitcoin Lightning Wallet: Breez","duration":1118},
                {"id":"5SbpyInuIJk","title":"MUUN BITCOIN WALLET - On Chain and Lightning Combined!","duration":1295},
                {"id":"bDzbKH5dwys","title":"Self-Custodial Lightning Made Easy (Full Zeus Wallet Tutorial)","duration":1761},
                {"id":"Z9KDghxOaa8","title":"Men who can be both right and sit tight are uncommon","duration":77},
                {"id":"39KpscRXyXY","title":"Buying Coffee Using Bitcoin - Lightning Network","duration":34},
                {"id":"qug6tCHPXtw","title":"Bitfury Presents: The Lightning Network Coffee Machine","duration":87},
                {"id":"QVK-9wewQN4","title":"Strike Bitcoin Line Of Credit: What It Is & How I Use It","duration":1704},
                {"id":"AYAreuNzx58","title":"Lightning Network: what is it? why should I care? what can I do with it? Enjoy bitcoin like its 2013","duration":1610},
                {"id":"WIhSHjDrnE4","title":"Die 5 besten Bitcoin Lightning-Wallets | Mit Jens Leinert","duration":3594},
                {"id":"lHJ3kFbUVbM","title":"Developing Lightning Apps on LND, LN Data Models, and Concepts with Alex Bosworth","duration":3172},
                {"id":"rrr_zPmEiME","title":"Bitcoin's Lightning Network, Simply Explained!","duration":334},
                {"id":"9UIOeoBEjmw","title":"Lightning Network Explained","duration":744},
                {"id":"Pef22g53zsg","title":"Jack Mallers Delivers The BEST Bitcoin Explanation of ALL TIME!","duration":2678},
                {"id":"sQPKdozYhQ8","title":"Beginner's Guide to Using the Lightning Network for Coffee-Size Payments","duration":130},
                {"id":"AW-7XBrSqCI","title":"Bitcoin Lightning Network Demo: Phoenix Wallet","duration":30},
                {"id":"IH5sbZRR-uc","title":"Design Review #37: Mutiny Wallet","duration":4273},
                {"id":"JGOzIUG2Rwk","title":"LIGHTNING SESSION: How To Get Your Bitcoin Onto The Lightning Network","duration":140},
                {"id":"OQ2o5LUgOqE","title":"Mutiny Wallet Tutorial  - Bitcoin Lightning Wallet (self-custody)","duration":1312},
                {"id":"hFpZmQmQJJw","title":"The Lightning Network: Non-Custodial Mobile Wallets (Blixt, lnurl, bolt11, & bolt12) - Spaces","duration":3865},
                {"id":"h6-WezlpXx0","title":"Lightning Network Is Layered Bitcoin","duration":3126},
                {"id":"8Iv5teYS2q8","title":"Bitcoin is the new monetary pressure valve.","duration":296},
                {"id":"eRRk-Y3bPX8","title":"America's future runs on hard money: Bitcoin.","duration":146},
                {"id":"waGkZgldmYM","title":"What's Your Bitcoin Strategy?","duration":51},
                {"id":"to8XItlplac","title":"Bitcoin Lightning Transactions & Protocol Deep Dive","duration":4636},
                {"id":"zEeMco4KqGs","title":"Lightning Network Explained for Beginners!","duration":107},
                {"id":"LXY0L8eeG3k","title":"Exploring the Lightning Network Daemon (lnd) 0.4 Beta Release","duration":4451},
                {"id":"Dx5jRyTTFlo","title":"There will only ever be 21 million #bitcoin","duration":66},
                {"id":"fympoUHx2b8","title":"Creating A Custom Self-Custodial Bitcoin Lightning Address","duration":1391},
                {"id":"8zQh8cvHpFM","title":"The Exit Door Is Bitcoin","duration":140},
                {"id":"NchsNf7Zfp4","title":"The Mechanics of Bitcoins's Lightning Network","duration":3726},
                {"id":"gkZJ1P-D0c4","title":"🇨🇭 Paying at McDonald's with #Bitcoin lightning  ⚡️ in Lugano, Switzerland.","duration":57},
                {"id":"bUbee0BUquo","title":"Mutiny Wallet - Get Started With Bitcoin","duration":3623},
                {"id":"T7UbakVyak0","title":"Don't let fiat fool you. The party is just getting started.","duration":140},
                {"id":"nYqYHgAtUho","title":"SLP412 Moritz of Alby - Making Lightning On the Web Easy","duration":3247},
                {"id":"c9hnntAwSYg","title":"Bitcoin's Lightning Network Surprises Us All!","duration":261},
                {"id":"T09HtifiP9c","title":"Lightning Network: The Economics of Bitcoin's Global Payment Rails","duration":2367},
                {"id":"vmafxrT8eCU","title":"How to Use Bitcoin Lightning Network (Wallets, Send, Receive)","duration":943},
                {"id":"LuZ0XN3eH5I","title":"The Fatal Flaw in Bitcoin's Lightning Network?","duration":805},
                {"id":"3SExtDDAh2g","title":"Understanding Lightning Network with @Jestopher_BTC | Value Stack 20","duration":4525},
                {"id":"KItleddMYFU","title":"How To Run A Bitcoin Lightning Network Node - Step By Step Tutorial","duration":4442},
                {"id":"rqgRPqx2v_g","title":"Bitcoin doesn't rely on stability, it's built to endure.","duration":239},
                {"id":"bVC4795helY","title":"Lightning payment on the Bitcoin network. Fast and easy at MyEspresso Cafe, Subang Jaya, Malaysia","duration":43},
                {"id":"LLH2QYnyDZg","title":"Ben Carman on Lightning Privacy, Building Mutiny, and Browser-Based Lightning Wallets | E89","duration":4492},
                {"id":"nvfFH8hnGpc","title":"No matter what they promise, the only solution is to print.","duration":150},
                {"id":"rXsRvBXbZyU","title":"Lightning Network Co-Inventor Tadge Dryja: Here Comes the Hornet's Nest | MIT Bitcoin Expo 2025","duration":1463},
                {"id":"hcaBe25MCWM","title":"This COMPLETELY Changes Lightning Network...","duration":276},
                {"id":"sXBwRO7ML7w","title":"Wallet Of Satoshi - Simple Bitcoin Lightning Wallet","duration":1540},
                {"id":"JpmkIvB7rDE","title":"LIGHTNING SESSION: Send From Any Exchange Direct To A Lightning Wallet","duration":136},
                {"id":"69QUHgHErx0","title":"How to Actually Spend Your Bitcoin! TOP Lightning Wallets in 2025","duration":435},
                {"id":"68yTli5qRTc","title":"How to Add Bitcoin Lightning Payments to Any App with the Breez SDK","duration":3771}
            ]
        },
        {
            "id": "memes-comedy",
            "name": "Memes & Comedy",
            "emoji": "😂",
            "desc": "Funny Bitcoin videos & meme compilations",
            "color": "#facc15",
            "videos": [
                {"id":"3QwYfZaxhGw","title":"Each time Bitcoin crashes","duration":11},
                {"id":"Bse-4rjVg2k","title":"The Game Of Cryptos - The wrath of the rightful heir (part 1)","duration":49},
                {"id":"b-KbXSEd3Bw","title":"Listen to the drumming. it's time.","duration":43},
                {"id":"nTJrTWH5lB8","title":"Time for the Bitcoin Bulls to fight back","duration":77},
                {"id":"4Ier6bkBcYI","title":"When you sell crypto and it keeps going up","duration":16},
                {"id":"hD926ifNkAU","title":"i don't think i will, Skyler. #Bitcoin 🔊","duration":27},
                {"id":"RSLypkZzuFI","title":"nature is amazing 🤯🔊","duration":83},
                {"id":"E_yVj7FgP_0","title":"🥺","duration":19},
                {"id":"wXqfm0wMZWY","title":"\"What's in the Fed's Box?\"","duration":246},
                {"id":"BKk2E7W30N8","title":"yeah ₿aby, yeah!","duration":132},
                {"id":"QfXGSrwLD2E","title":"\"Hi, I'm Hayden Davis. Welcome to Crypto!\"","duration":46},
                {"id":"F8Pn8OxQUL8","title":"The Prophecy Stackchain","duration":140},
                {"id":"O21TYjLUio0","title":"👀","duration":15},
                {"id":"RLCXTg5E0Dk","title":"\"because we choose to\" #LaserRayUntil100k    #DSB","duration":24},
                {"id":"8EoxggHmWxY","title":"How to Mine Bitcoins (Classic)","duration":156},
                {"id":"xANxOErROAM","title":"Join the winning team, buy and hodl Bitcoin It's that simple.","duration":16},
                {"id":"o9IkO3X84d0","title":"Sometimes I get a little...","duration":34},
                {"id":"bnVVwM_YTNA","title":"😎","duration":41},
                {"id":"08kwAmgQt0w","title":"FTX/Sam Bankman-Fried - That's a scam! (Meme song/interview drill rap remix)","duration":86},
                {"id":"5NleuGj2czk","title":"Holding These Bags Like","duration":34},
                {"id":"DxmdC4Rx9kI","title":"Bitcoiners using Vision Pro","duration":92},
                {"id":"xgtZVD4rPz8","title":"#bitcoin  Lightning boost from pleb #miners  lightens the mood","duration":57},
                {"id":"TNSsUzzie7A","title":"#Bitcoin  The Journey Of Stacking Sats","duration":135},
                {"id":"1K2apFT7Qzk","title":"💎👐","duration":49},
                {"id":"Zai5F2_KMjA","title":"THE END OF CRYPTO!? The crypto titanic goes down","duration":151},
                {"id":"-sjIcGJveeE","title":"Some Like It Hot And Steemy","duration":46},
                {"id":"Z65HXDZNTFk","title":"Bitcoin Bull Market Corrections","duration":35},
                {"id":"NjCLRAG2OgM","title":"Be your own hero. Stack it. Hodl it. Meme it. #Bitcoin","duration":86},
                {"id":"ct0U_wXEux8","title":"LIVE LIKE I WILL DIE TOMORROWDIE LIKE I DON'T CARE IF I LIVE AGAIN","duration":135},
                {"id":"rxJ_Vfcri4k","title":"\"we're soldiers\"","duration":42},
                {"id":"XEtJwHcqrec","title":"I am yellow.","duration":37},
                {"id":"DhSKs-eCjIY","title":"😤","duration":41},
                {"id":"j03aH5KQEfY","title":"The #Bitcoin #etf  didn't pump my bags!","duration":56},
                {"id":"eCumKg9hS4E","title":"trader's song","duration":82},
                {"id":"E7KQwBWJ7i0","title":"Bitcoin explained (Funny)","duration":52},
                {"id":"Cdql1rYiw18","title":"did u grab it? 🥎 👀 🔊","duration":72},
                {"id":"UX1GIhOhkAE","title":"Me Saying Bitcoin","duration":7},
                {"id":"6p7uHVWBCO4","title":"bitcoiners vs normies","duration":41},
                {"id":"l0kL2Zi-MYw","title":"Just do the math bro...","duration":17},
                {"id":"fWOOQShUUc4","title":"SpaceX Falcon Heavy Launch","duration":25},
                {"id":"0IdcMe24Ly0","title":"Bitcoin will save the world","duration":120},
                {"id":"exRCX38tHks","title":"Giving Away Crypto or Cash! What Will The Public Take?! (Social Experiment)","duration":556},
                {"id":"58IWY4-Yrk4","title":"SpongeBob Bitcoin Economics 101","duration":39},
                {"id":"o_H3BpuFxoY","title":"There will be signs","duration":20},
                {"id":"4bNlAJ74BkE","title":"Wat A Wonderful Bitcoin World (DSB Spaces) video by @lokobtc","duration":140},
                {"id":"1U8_cldCQus","title":"Funny Money: PROOF OF WORK - Episode 3","duration":140},
                {"id":"ZUMMrMwOhOc","title":"we can hodl longer than you can fud.","duration":20},
                {"id":"OY4d0INKkFQ","title":"finding out your son bought XRP 🌈😣","duration":47},
                {"id":"WrEVpNdYkrs","title":"B.R.E.A.M. - Zhou Tonged (Wu-Tang C.R.E.A.M. Parody)","duration":154},
                {"id":"HtjL-7Ynbb0","title":"DON'T. STOP. BELIEVIN' 🙌 #DSB","duration":17},
                {"id":"OqcQ0FWuE-w","title":"February 11, 2026","duration":10},
                {"id":"V60slClqKJ4","title":"Bitcoin Bull Run Vibes","duration":48},
                {"id":"I0CoVoiRG0U","title":"₿🐰🕳️","duration":41},
                {"id":"JqHXoB6t9ls","title":"🫠","duration":15},
                {"id":"aJm8DjP5rI4","title":"Is ETH dead?","duration":76},
                {"id":"-meXp491eGI","title":"Eyes on target!","duration":15},
                {"id":"ugHpLS5unpo","title":"Bear Before The Halving","duration":213},
                {"id":"hAxfwE9Oj2g","title":"BIG BEAUTIFUL BITCOIN!","duration":164},
                {"id":"eEpoVN22VZ4","title":"me after the end of the last DSB","duration":13},
                {"id":"-GCvn4HqHOk","title":"THE PROPHECY WILL BE FULFILLED","duration":30},
                {"id":"MTtzAicM1OA","title":"whenever Bitcoin pumps i be like","duration":22},
                {"id":"5_sjNBZEE5I","title":"Investing 4 Dummies (Crypto Parody)","duration":49},
                {"id":"Dg_fYjgizZA","title":"The Current Crypto Market - San Andreas Earthquake Bitcoin Crash!","duration":89},
                {"id":"iyhVkLvUtHw","title":"consolidation ♾️","duration":20},
                {"id":"1Eo59xYuYJ8","title":"Our Bitcoin Journey Has Just Begun 🚀","duration":53},
                {"id":"x3Midd4X3Sw","title":"Quantum Freddy 🔊","duration":108},
                {"id":"Quay7LYIELI","title":"VALHALLA AWAITS","duration":302},
                {"id":"jQfowtEfbFY","title":"The greatest meme of all time","duration":1022},
                {"id":"PiFjVILGEw8","title":"Bitcoin is being such a drama kid","duration":9},
                {"id":"dzpxbDxYk-Q","title":"BSV Christmas be like","duration":141},
                {"id":"dE-lwMkjnNY","title":"Engage The Believin' 🔥🚀","duration":61},
                {"id":"CPyVAJS0hqQ","title":"\"Whatever, princess.\"","duration":66},
                {"id":"ENyCUYcGZtI","title":"Bitcoin Bang Bank!","duration":32},
                {"id":"uql_VKemddY","title":"Vibing with the Fed and Bitcoin 10 Hour Loop","duration":36001},
                {"id":"MDCfK2wQ5kw","title":"\"there is no second best\" in Spanish🇪🇸 Mandarin🇨🇳 Arabic and German🇩🇪","duration":67},
                {"id":"jowej5AxvgM","title":"Frankie Goes Higher","duration":116},
                {"id":"J_4Js-CphjU","title":"Will Your Crypto Portfolio Ever Recover?","duration":32},
                {"id":"vKoa8CsXBqA","title":"Saylor Triggered Interview","duration":22},
                {"id":"BgHEOhciWcQ","title":"What Happens If You Never Buy Bitcoin?","duration":37},
                {"id":"IUJNG2w-7WQ","title":"I made a song about grown men panic selling their #Bitcoin","duration":19},
                {"id":"nUUXOZAPWFQ","title":"Crypto to Heaven (Stairway to Heaven Parody)","duration":481},
                {"id":"3TbCmm-MnXA","title":"betch!","duration":11},
                {"id":"qdIhlz53a5U","title":"LoKoBTC - Luke, The Master Orange Piller (Bitcoin Meme)","duration":411},
                {"id":"TVXGwkuRZ0A","title":"WHAT YOU DIDN'T SEE IN THAT DEBATE","duration":81},
                {"id":"k9jkP8UE33s","title":"everything is \"macro\" now 🥺🔊","duration":15},
                {"id":"GjANe91ir6I","title":"#notgonnanode","duration":59},
                {"id":"skhA8n8iRCc","title":"It's Too Late To Sell The Highs (Timbaland - Apologize - Crypto Crash Parody Version)","duration":140},
                {"id":"WZSe-mFnk_w","title":"Saylor's new narrative","duration":52},
                {"id":"tKHm7Q-s88o","title":"November 25, 2024","duration":11},
                {"id":"iA-fJl5TqLc","title":"Happy Spooky Saylor Halloween Everyone! 👻🎃🪓","duration":241},
                {"id":"fCvNLpQ-MBs","title":"Quantum Nic 🔊","duration":117},
                {"id":"mEqr-8-TKrA","title":"30 People Turning Down FREE Bitcoin - Mike Still","duration":254},
                {"id":"k4NBjRp7OGY","title":"Cypher Based","duration":28},
                {"id":"nKjIBrbKkZQ","title":"Bitcoiners when BTC isn't pumping","duration":39},
                {"id":"P4eH-b6zoNU","title":"\"no\"","duration":18},
                {"id":"X_hzClMjIVE","title":"Eleutheria","duration":239},
                {"id":"PUO7q7LrnWw","title":"mmmm bitcoin","duration":32},
                {"id":"TGRekmiWQMs","title":"The Crypto Market Take Your Money Like (God's Plan)","duration":17},
                {"id":"j0oVcjzy5Mg","title":"Calm yourself. Bitcoin will do crazier things on the road above 100k, that is the way. 🔊","duration":29},
                {"id":"KAY6vkxe-Kg","title":"still","duration":9},
                {"id":"Ma4c6PYT1Ec","title":"When you sold your Bitcoin too early","duration":16},
                {"id":"vH7mMhmTNKw","title":"Boomers Want Bitcoin, But They're All Missing The Point","duration":150},
                {"id":"dWdFNf_zXR4","title":"When your crypto portfolio doesn't crash overnight","duration":11},
                {"id":"3mA_U4tYS8s","title":"Hank Finds Out About Crypto Crash","duration":70},
                {"id":"cCk1bIMsEOc","title":"🔥58k🔥","duration":15},
                {"id":"KIAQyZtNns0","title":"Did you know that, anon?","duration":81},
                {"id":"a1rCk3HPW1c","title":"Dont Scare the Normies  #podcast #bitcoin #normies","duration":46},
                {"id":"otJ_HHBTGi0","title":"Saylor is pissed","duration":14},
                {"id":"DZNUMcOGbq4","title":"All The Way Up (Bitcoin Rap Parody)","duration":149},
                {"id":"kj9KxIsaLMg","title":"Merry Christmas 😑","duration":49},
                {"id":"Bu5g6Hjxd-s","title":"cypherpunk 2077 has no bugs #Bitcoin #cyperpunk2077  🔊","duration":13},
                {"id":"qoMX9IJaiRM","title":"Bitcoin has its own DJ now 🤝 #bitcoin #housemusic #dj #crypto","duration":18},
                {"id":"ZotZAUmdquA","title":"razzle dazzle","duration":68},
                {"id":"j4RuU_bn4Ug","title":"Trying to get your friends to buy crypto","duration":74},
                {"id":"I8Tf8s_-bb8","title":".plzstop","duration":52},
                {"id":"mrNOYudaMAc","title":"NFTs - SNL","duration":205},
                {"id":"-MYqnJ7ygkg","title":"Funny Money: INFLATION - Episode 1","duration":140},
                {"id":"5l6HeZa0hOw","title":"DSB Announcement","duration":68},
                {"id":"WsURYcLdBHM","title":"The 2018 Crypto Market Crash","duration":125},
                {"id":"kmDzhA4UiRg","title":"Trying To Decide Which Altcoin To Buy","duration":14},
                {"id":"2TzLmBW243A","title":"Frankie Goes Even Higher (audio)","duration":297},
                {"id":"J47EE-v5iK4","title":"It's Time To Meme Back Bitcoin","duration":140},
                {"id":"ALy_fG5Skg4","title":"What u talking about, BIS? Bitcoin.","duration":56},
                {"id":"ODSbs6NImlc","title":"Spreading the #Bitcoin message","duration":18},
                {"id":"xm4ZOFBrhns","title":"They Found Bitcoin","duration":9},
                {"id":"E6mK2aZbuSo","title":"Recovery of a Lost Bitcoin Wallet from 2010","duration":144},
                {"id":"gxsdXwkzkVA","title":"The One with the Paper Bitcoiners","duration":132},
                {"id":"8EjDHHbiJQ8","title":"some HODL Bitcoin for different...reasons 🎯","duration":16},
                {"id":"8zuAbAD5Bac","title":"You Gotta Bag? You Gotta Gym - Home Altcoin Workout","duration":61},
                {"id":"0PkXPIWbRqI","title":"saylor mad at danny","duration":74},
                {"id":"hNV2ZNmE-jc","title":"Bitcoin edging to 100k","duration":25},
                {"id":"YWNlc7EEgDc","title":"they not like plebs, be humble.","duration":28},
                {"id":"-Qvyj21jJ_Q","title":"Yellow's mspaint Bitcoin TA","duration":139},
                {"id":"aSY4jU0Md-c","title":"Warning: Strobe Lighting And Freedom 🔊","duration":42},
                {"id":"wIhTGB3wqV0","title":"Michael Saylor Meme - NO SECOND BEST","duration":46},
                {"id":"xXH0VDJC_N0","title":"🚨 Live footage of Fred Krueger rugpulling his meme coin","duration":25},
                {"id":"9PuKbkGHtPY","title":"BREAKING: First interview of Peter Schiff after the Puerto Rico regulators closed the bank accounts🤯","duration":76},
                {"id":"j43f_8xmHMA","title":"Tucker & Bukele","duration":104},
                {"id":"XpRou-xLcj0","title":"Sacrifice","duration":135},
                {"id":"-gP9tmVDTew","title":"End his Odyssey, help him back to his Ithaca. DONATE HERE: defendingbtc.com","duration":139},
                {"id":"EFDMum1vs7Q","title":"Pump It Up (Bitcoin Maximalist) 10 Hour Loop","duration":36057},
                {"id":"MiF99_J67pI","title":"An important #bitcoin announcement","duration":11},
                {"id":"XJI6RQ6diis","title":"when the stack iz good","duration":11},
                {"id":"yR2wIceNei8","title":"nckl","duration":130},
                {"id":"GfWh1dfUkx0","title":"Bart Got Rich with Bitcoin - Homer Ruined EVERYTHING","duration":47},
                {"id":"E9EkVAEpqyo","title":"Actual footage of crypto traders (Willy Wonka Crypto Boat Ride)","duration":126},
                {"id":"jmH4S6G4TO8","title":"I had a blast DJing at the Lugano Plan B afterparty in Switzerland on the wknd 🚀 #bitcoin","duration":18},
                {"id":"xKJuFr7CQDA","title":"Bitcoin 🚀 is inevitable","duration":53},
                {"id":"zscAzHvXTGs","title":"one of those moments","duration":55},
                {"id":"RkHNvAXnejU","title":"Saylor Got Stack","duration":37},
                {"id":"D4XYQcLPNKk","title":"'Number Go Up' - the new fragrance by Saylor. Smell the Conviction.","duration":37},
                {"id":"lvw5XX6IQkc","title":"Sell in May (Thunderstruck Crypto Parody)","duration":296},
                {"id":"85s-LP4joww","title":"🔥58k🔥","duration":102},
                {"id":"d6ham2mibiA","title":"$100 or 1 Bitcoin?? | Street Interviews","duration":95},
                {"id":"pMmcu8RzM2M","title":"All The Way Up - Tesla Buys Bitcoin Edition (Fat Joe Crypto Parody)","duration":118},
                {"id":"crSb1sHYiTI","title":"We ain't selling our #bitcoin 🤠  #music","duration":19},
                {"id":"_1RIyjJXZmk","title":"Funny Money: CENSORSHIP-Episode 2","duration":134},
                {"id":"OKAbZhv8LxA","title":"Gary Gensler Disses Crypto & Trump Meme Coin (Kendrick Lamar - Not Like Us - Crypto Parody)","duration":101},
                {"id":"CTiHKjz_nQE","title":"There is noh second best coin","duration":4},
                {"id":"YvL28Bdk7hE","title":"gang gang Bitcoin gang gang","duration":24},
                {"id":"b6tbDDvhxx8","title":"oh noh","duration":15},
                {"id":"Ilv7ZMoM1GI","title":"We can't simplify it any more: Buy & Hodl Bitcoin. It's easy.","duration":124},
                {"id":"8aYr2ueCFvs","title":"HOW CRYPTOCURRENCY WORKS","duration":39},
                {"id":"y1GKMmAcd2I","title":"Bitcoin Meme - Matrix","duration":93},
                {"id":"Gt7ijJ91m30","title":"Everything In Its Right Place","duration":131},
                {"id":"Ner16UBWdEg","title":"Best Crypto Influencer YouTube Channels 2024","duration":599},
                {"id":"qX3Mv95SiiI","title":"just... don't, oke? 😠","duration":19},
                {"id":"G1oCVSUT_LY","title":"\"Try me\"","duration":124},
                {"id":"a18aPOwThrQ","title":"Bitcoin ist das Beste","duration":19},
                {"id":"Q-u9UZbb5rQ","title":"WE WILL NOT GO QUIETLY INTO THE BEAR NIGHT. WE WILL NOT VANISH WITHOUT A FIGHT!","duration":107},
                {"id":"IhC_RF6Srro","title":"Stuck.","duration":123},
                {"id":"msOTN99S3QI","title":"just stop","duration":23},
                {"id":"JZYZoQQ6LJQ","title":"Chris Record - HODL GANG - Bitcoin Rap Remix","duration":219},
                {"id":"id3awzDq5Jw","title":"Types of People When Bitcoin Pumps","duration":61},
                {"id":"dlMgnXFpJJg","title":"ATH 99460","duration":23},
                {"id":"wuwen4uvAAc","title":"How it feels to be a Bitcoiner","duration":99},
                {"id":"4KWFKRbK1pY","title":"We Got A Bitcoin Down (Bitcoin Crash March 2018)","duration":98},
                {"id":"T-Mmud_OsEM","title":"When your homie tells you he can rap.. feat. Richard Heart (Prada Prada Prada)","duration":60},
                {"id":"wlW0BonuObM","title":"I guess they're not ready yet","duration":57},
                {"id":"LuBsHTw4aL0","title":"Bitcooooiiiiiiiiiiinn","duration":34},
                {"id":"sRVoVbR8PMc","title":"😐","duration":11},
                {"id":"yw7ycZLRSLI","title":"but Im still hodling","duration":8},
                {"id":"pV4cYQpJPr0","title":"good things come to those who wait","duration":96},
                {"id":"AjFNzFaI-2c","title":"Hitler Reacts To Bitcoin Cash","duration":221},
                {"id":"b0ETH5dORdM","title":"Better Call Kwon","duration":40},
                {"id":"3FerZELAvxU","title":"The Prophecy 2.0 (DSB Spaces)","duration":140},
                {"id":"aTqT5TDLtT8","title":"Bitcoin History As Told By Memes | Memehub Specials V2","duration":340},
                {"id":"pmyuKA9oLSk","title":"choose ₿ life","duration":64},
                {"id":"2xNkgXCsYi4","title":"the bear market is here, we don't care about that now","duration":15},
                {"id":"J_eJAOXYTXA","title":"this explains the \"sighs\"","duration":16},
                {"id":"7hcVZRO1n2w","title":"Are you ready?","duration":16},
                {"id":"_y22pSmSecU","title":"Cordanoh","duration":46},
                {"id":"mIEEfSgk0H0","title":"There Is No Second Best Fungus","duration":153},
                {"id":"jZm1GZj6eEM","title":"Asking People if They Have Invested in Cryptocurrencies","duration":306},
                {"id":"SmI_OA08aoA","title":"The Look","duration":25},
                {"id":"lVmgDzGzN8I","title":"ETF AD TRANSLATION","duration":19},
                {"id":"oCqkVZVPOe8","title":"crypto traders be like...","duration":336},
                {"id":"d5unCentQ-E","title":"No More!","duration":11},
                {"id":"396oE9wWgEU","title":"When Bitcoin hits all time high","duration":14},
                {"id":"FHchUwgJMjM","title":"everything is oke 👀","duration":23},
                {"id":"RM1NdTvvtvk","title":"GREATEST BITCOIN VIDEO MEMES OF ALL TIME! (OBSCENELY BULLISH)","duration":614},
                {"id":"ElYRMPWr5LM","title":"Stack That \"Doom\"","duration":140},
                {"id":"v6PtLRHMiRY","title":"The Fiat Empire Strikes Back?","duration":101},
                {"id":"vYwSe_YormI","title":"🔫","duration":9},
                {"id":"tulPNA-2OwE","title":"the best?","duration":31},
                {"id":"rIx35hydpVE","title":"When you buy all time high and it dips","duration":21},
                {"id":"x7UO3LC-_t4","title":"Michael Saylor simply explains how Strategy works: The MacroEncabulator","duration":177},
                {"id":"NIv_fOT_3F0","title":"naka diz 🥜","duration":37},
                {"id":"uvQdBWrY7hM","title":"Thanks buddy!","duration":69},
                {"id":"w3qr-aA6OuE","title":"Bitcoin Hodlers Of The Lost Ark","duration":88},
                {"id":"rIWQEjHKOJw","title":"OPT OUT 58K. CHOOSE HOPE. ₿ELIEVE.","duration":98},
                {"id":"VOFU_L-jRnw","title":"One Corn To Bit Them All 🌋","duration":43},
                {"id":"NQ73hwkyYXA","title":"Everyone Is Welcomed On Yellow's Katamaran! ⛵ 🌞","duration":68},
                {"id":"Jl6dTxyATUI","title":"NO ONE DISSES HAGGIS AND GETS AWAY WITH IT","duration":177},
                {"id":"61i2iDz7u04","title":"BITCONNECT REMIX","duration":93},
                {"id":"ob1HDb1Cvfc","title":"the feeling I get whenever I stack sats 💛","duration":26},
                {"id":"MqqFFxZcrQw","title":"\"hex hex heeex\"","duration":68},
                {"id":"-ZqQNaNcDz4","title":"Congratulations (Post Malone Bitcoin Parody) BTC All Time High 🚀","duration":146},
                {"id":"nJohVKT0vv8","title":"Bitcoin World 🌍","duration":80},
                {"id":"mNa61cAFZO0","title":"Bitcoin 💛","duration":78},
                {"id":"BejkssODABQ","title":"The Bitcoin Miners Of The World 🌎","duration":39},
                {"id":"U-IVo-qVU7Q","title":"BTFD","duration":52},
                {"id":"gIEQ0dPBOoY","title":"Trying to hodl sh!*coins like (Fast n Furious Crypto Meme)","duration":85},
                {"id":"wH8DwZRb3UA","title":"#Bitcoin doesn't care","duration":19},
                {"id":"XDHTDtFEyH0","title":"58k DIZ NUTS","duration":13},
                {"id":"ibr2i-IulKE","title":"They Targeted Him With The Most Twisted Bitcoin Scam","duration":126},
                {"id":"rkIDiYLTpto","title":"₿oom!?","duration":44},
                {"id":"H_HZkcUP_O0","title":"Bitcoin: Explained to Different Age Groups","duration":206},
                {"id":"NHIzSVi8Rcg","title":"behind the scenes of that interview","duration":87},
                {"id":"uoUhhwyawLg","title":"The Bitcoin Standard - Matrix Meme","duration":117},
                {"id":"50B6SVW3Yg0","title":"Crypto Scammers Sound Like Beetlejuice","duration":29},
                {"id":"32zVkVwrhcc","title":"https://bitcoinhalvingparty.com","duration":112},
                {"id":"9i0pAD_LmSU","title":"we all are a special kind of crazy innit","duration":200},
                {"id":"kcJiReSPKWw","title":"Saylor getting ready for another podcast 🔊","duration":92},
                {"id":"Uu9TbGWylF8","title":"When the stock market crashes...","duration":56},
                {"id":"qX635qk8RXk","title":"Bitcoin! 🎶 🎷🦭","duration":43},
                {"id":"r_OdAX-G4nY","title":"What's My Name Again?","duration":72},
                {"id":"IkSwJs3YAh0","title":"Nothing","duration":19},
                {"id":"cQIa5qDcF6k","title":"Boris Johnson SLAMMED for Bitcoin Ponzi Scheme Lie!","duration":127},
                {"id":"sxoJfoMg94E","title":"Dont make us say WE TOLD YOU SO!","duration":10},
                {"id":"aDrNFlw96Lo","title":"wtf","duration":51},
                {"id":"ybrdHkKaRk0","title":"Bitcoin Blinding Lights","duration":73},
                {"id":"AhLsRQfziDQ","title":"It's Friday!","duration":38},
                {"id":"OTVJ6nl5uY0","title":"Types of Bitcoin Haters #shorts #bitcoin #crypto","duration":50},
                {"id":"Lzl5t1Sracc","title":"Funny Bitcoin Video #3 - Classic Compilation","duration":62},
                {"id":"qr3KX-hGDxA","title":"🫨","duration":75},
                {"id":"T351bA0ni1A","title":"Michael Saylor's morning routine","duration":105},
                {"id":"TM0Wg2f3QqI","title":"We are SICK and TIRED","duration":15},
                {"id":"GSh8Aqa3zzM","title":"Bitcoin is going to zero","duration":213},
                {"id":"al2cjeIgDmQ","title":"Be the Penguin","duration":62},
                {"id":"em1J9zzXq8Q","title":"They Live, can you see them? 🤡🌎","duration":67},
                {"id":"zbxGnspZ6U4","title":"GET UP ♉","duration":16},
                {"id":"xXjB8ns6zd0","title":"when we think we are over 58k","duration":10},
                {"id":"BIJGPQcONjU","title":"Before and After","duration":21},
                {"id":"t60cXhAXryM","title":"HODL - When You Check Your Crypto Portfolio Today","duration":39},
                {"id":"TdDdSw6xnTQ","title":"wow faketoshi so triggered 👀","duration":16},
                {"id":"BgZO1ppaneg","title":"Best Crypto TikToks Compilation","duration":917},
                {"id":"NGkeLbx_4E4","title":"Bitcoin is going to ZERO meme | 2021 pump compilation","duration":355},
                {"id":"DBs-qkjMdXk","title":"95-Year-Old Man Reacts to Bitcoin","duration":210},
                {"id":"SpzDVT8dufM","title":"🪰.jpeg","duration":51},
                {"id":"ACnFdoZ38NA","title":"Who let this guy on 🙅‍♂️ #bitcoin #crypto #dj","duration":12},
                {"id":"lFPHBiFo9Jc","title":"Types of Bitcoin Twitter Personalities","duration":57},
                {"id":"vHwi6Y1GKc0","title":"Be the protagonist","duration":197},
                {"id":"OZvddTgUbk4","title":"👀 Bitcoin 📈📉","duration":36},
                {"id":"aFDYZikHbxI","title":"Roger Ver is outraged again & rage quits","duration":58},
                {"id":"7MjUeL-yMFM","title":"Ideas Don't Die. #Bitcoin","duration":46},
                {"id":"pPNBEGP9J1w","title":"Jim Cramer - I made a mistake (SVB, Signature Bank & Meta Apology) Emo Remix (Parody song)","duration":65},
                {"id":"q-z1qD9ldJw","title":"crypto spaces","duration":77},
                {"id":"UnAeRYCN8ms","title":"Hodlers Of The Bitcoin","duration":139},
                {"id":"Y8XiT5VuQAM","title":"Asking Boomers About Bitcoin [2022]","duration":51},
                {"id":"CElTifZ-o-A","title":"Bitcoin Memes Are POWERFUL","duration":40},
                {"id":"V_06QgEebJQ","title":"The most important thing said at the U.S. Senate Banking Committee press conference","duration":25},
                {"id":"BnDnEhOJpns","title":"Is Your Bitcoin Real  The Crypto Scam Epidemic EXPOSED!","duration":76},
                {"id":"bhwN95oAdjA","title":"Paper Bitcoin Treasury Companies","duration":77},
                {"id":"XA7ap-CxuNQ","title":"👀","duration":10},
                {"id":"obihCq0QHeY","title":"TO VALHALLA AND BEYOND","duration":30},
                {"id":"93u019nKtNc","title":"#pardonsamourai","duration":82},
                {"id":"XbKjt0zoi8w","title":"Over 100k vibe check!","duration":13},
                {"id":"9Dey6KXmXh8","title":"Dennis Porter's Vengeance","duration":64},
                {"id":"nqvF3ItfuB8","title":"wow so rude","duration":27},
                {"id":"-nPCXdODVII","title":"Just try me","duration":124},
                {"id":"JQMM58WEw9s","title":"Bitcoin's master plan","duration":59},
                {"id":"l-aVgXwnESM","title":"When Bitcoin Encounters Fiat (No.2) - Crypto Memes","duration":79},
                {"id":"dJUrK1ghZic","title":"Pump It Up (Bitcoin Maximalist Remix)","duration":140},
                {"id":"ipKyaG6sr-g","title":"Bitcoin vs Haters 🔊","duration":28},
                {"id":"Om_-M2fiNvw","title":"When You HODL Through A Bear Market","duration":60},
                {"id":"PVVQvkU8q-Q","title":"Can you?","duration":37},
                {"id":"NMDABNK8j_Q","title":"Funniest Crypto Memes - He Sold? Edition","duration":68},
                {"id":"1VQ0EtIov04","title":"old fiat world vs hyperbitcoinization","duration":127},
                {"id":"ctGOcMR9NBc","title":"Don't Stop ₿elieving 💛","duration":193},
                {"id":"7gfBP8kPzRA","title":"The Bitcoin Song - Jay-Z Empire State of Mind Parody","duration":99},
                {"id":"wXo8Jqupea8","title":"🎶\"sometimes I'm alone, sometimes I'm not, sometimes I'm broke...🎶...helo?\"","duration":73},
                {"id":"qVGcT0JwzQI","title":"Go fish? Nah. Bitcoin.","duration":42},
                {"id":"DV-RHmRw4O8","title":"Trying To Hold  Your Altcoin Bags","duration":7},
                {"id":"VEJVNaOptuo","title":"Crypto HODLers Currently Like (Fight Club Crypto Meme)","duration":44},
                {"id":"K4QFLMDOwtU","title":"We simply buy the bitcoin dip #bitcoin #crypto #housemusic #djremix","duration":20},
                {"id":"O6Nup7s185I","title":"Bit Block Boom 2024: The Ultimate Bitcoin Maximalist Conference","duration":37},
                {"id":"m-6H5UN1QpA","title":"wat just happened","duration":5},
                {"id":"MY3epSlBvlM","title":"He buys Bitcoin, We buy Tesla","duration":58},
                {"id":"nA3msAb-yUA","title":"BITCOIN CRYPTO MEME COMPILATION #1","duration":616},
                {"id":"UDu5LOf_E-w","title":"Bitcoin Memes Compilation","duration":323},
                {"id":"nOh-7SzI6gM","title":"Exit Fiat, Enter Bitcoin - A Matrix Meme","duration":162},
                {"id":"ggJ7rzsNE3Q","title":"don't make it mad. #Bitcoin 🔊","duration":22},
                {"id":"IXd8ZeGqvBM","title":"Retard.eth","duration":225},
                {"id":"mLczyXIIqJg","title":"what a Journey","duration":50},
                {"id":"UxGtkFbXY70","title":"\\\"Bitcoiners Will HATE This About Boomers Buying Bitcoin\\\" - Bob Burnett Exposes Uncomfortable Truth","duration":102},
                {"id":"Pxpb3lD0q5s","title":"CTV","duration":128},
                {"id":"HhfIWMYKo-g","title":"Many Thanks (DSB Spaces) video by @lokobtc","duration":140},
                {"id":"u7aaFO8nVhg","title":"December 6, 2024","duration":20},
                {"id":"i8pr23L-oC0","title":"Bitcoiner's nod","duration":17},
                {"id":"jJgb5xHp8cU","title":"When You Try To Buy The Dip (Too Soon Junior!)","duration":53},
                {"id":"LvT6_R9Fi-w","title":"Saylor on Joe Rogan","duration":42},
                {"id":"yL0xF-ng5H8","title":"realization","duration":62},
                {"id":"2topnUzwzM4","title":"the bitpomp trilogy","duration":97},
                {"id":"JZXL3Z_VZ-M","title":"Mallers VS Armstrong","duration":68},
                {"id":"TBKlv71-MkA","title":"Backstage with Saylor and Peterson","duration":64},
                {"id":"5bFn9OtWQu4","title":"2023: A Debt Odyssey","duration":46}
            ]
        },
        {
            "id": "mining",
            "name": "Mining",
            "emoji": "⛏️",
            "desc": "How Bitcoin mining works",
            "color": "#ea580c",
            "videos": [
                {"id":"dm4PljluiYM","title":"Best Bitcoin solo miner 2025 - Bitaxe, NerdQaxe, Avalon Q, Nano 3s & more compared!","duration":1322},
                {"id":"sN892KuvEiw","title":"Bitcoin mining is better real estate","duration":51},
                {"id":"KbuOyBoTZmc","title":"How to Set Up Your New Bitaxe, Part 1/4","duration":262},
                {"id":"q7c00PE7khk","title":"How To Set Up a Bitaxe To Mine Bitcoin (Step-by-Step Guide)","duration":1231},
                {"id":"YsYk8vyv32w","title":"The Amazing History of Bitcoin Mining","duration":786},
                {"id":"ck6vBhC35jY","title":"Das kleinste Crypto Mining Rig für zuhause | DIY","duration":473},
                {"id":"ZWEBRT-1ndw","title":"S17 E14: Kristian Csepcsar on Braiins & The History of Bitcoin Mining","duration":6109},
                {"id":"T2KgXsmD10Y","title":"EP19: The State of Mining and Media w/ Colin Harper, Writer and Researcher - Luxor Technologies","duration":3132},
                {"id":"LhCkVj8oQ3E","title":"What is the Bitcoin Difficulty adjustment?","duration":1100},
                {"id":"cx0E2ICJXLY","title":"Is Bitcoin Mining Worth It In 2025??","duration":891},
                {"id":"EscTYW3GWeQ","title":"Mining for an Abundant Future - Beau Turner, Troy Cross w/ Daniel Batten","duration":1820},
                {"id":"O9mRlrC1z2Y","title":"Fort Worth becomes first city in the U.S. to mine bitcoin","duration":171},
                {"id":"A5ssDib4-jk","title":"Bitcoin: Historical Mining Difficulty & Target Hash (10/3/23 Update)","duration":97},
                {"id":"5Wp6lInPQv0","title":"Cruel Reality of Bitcoin Mining - Speedrunning Bankruptcy","duration":498},
                {"id":"e4BtAMXuRKI","title":"What is Bitcoin Mining? How to Earn Money from Cryptocurrency Mining?","duration":747},
                {"id":"BeDIjO-2J-c","title":"Bitcoin Difficulty Adjustment Animation (Difficulty Epoch 413)","duration":38},
                {"id":"33i1PdSJgwA","title":"How Bitcoin Mining Actually Works, Simplified","duration":253},
                {"id":"sw_zmtCKGeQ","title":"Antminer S19j Pro Hashboard Repair - Bitcoin ASIC Miner Repair LIVE - 017","duration":6434},
                {"id":"Py3voZGT1To","title":"Bitcoin Mining Explained Simply | Real ASIC Miner Running at Home","duration":270},
                {"id":"gDhoS-cZfU4","title":"Bitcoin Difficulty Adjustment Animation (Difficulty Epoch 415)","duration":104},
                {"id":"i4XV7Yq9GCM","title":"The Future of Bitcoin Mining: Home Miners, Pools, & Open Source Innovation","duration":2888},
                {"id":"-maK8nO9vqk","title":"Bitcoin Mining Is Cleaning the Grid - Here's the Truth - The Bitcoin Layer","duration":2202},
                {"id":"18QvarVLofU","title":"This Home Bitcoin Miner could Earn you 3.125 BTC! Bitaxe Gamma","duration":899},
                {"id":"rYAFyFsN5UE","title":"My mini Bitcoin USB miner setup explained for solo mining Bitcoin","duration":659},
                {"id":"4HTtZhhXiAw","title":"How Does Bitcoin Mining ACTUALLY Work? Explained In 3 Minutes","duration":260},
                {"id":"Uq5DQFugOv8","title":"Bitcoin Revolutionizing Renewable Energy w/ Daniel Batten (BTC225)","duration":3294},
                {"id":"M7PRiPHM4BU","title":"Importance of Capital in Bitcoin mining","duration":42},
                {"id":"cJo839Sg1ek","title":"These Are the 3 BEST Home Crypto Miners Under $500!","duration":831},
                {"id":"jw6Cm_DpERM","title":"Bitcoin Mining and Circular Economies Are Changing Africa's Future - The Bitcoin Layer","duration":1626},
                {"id":"7Wy1ZCjil_8","title":"I Spent 500+ Hours Researching Bitcoin and Made a Shocking Discovery","duration":4749},
                {"id":"BXhJ18kcZEo","title":"The COOLEST Home BITCOIN Miner Right Now!","duration":928},
                {"id":"jDDIyqHvRUY","title":"Mining BITCOIN at Home is EASY - Bitaxe Gamma","duration":1079},
                {"id":"mi319LxnFYo","title":"'A New, Different, Wave of Bitcoin Adopters' (SoB#049) - Daniel Batten","duration":3118},
                {"id":"BpN8fCkExtE","title":"When Blackmailing A Drug Lord Goes Terribly Wrong","duration":1934},
                {"id":"5Y2fkldA-lQ","title":"The Early Days of Bitcoin Mining","duration":472},
                {"id":"5v-t9NOkExU","title":"This NEW Home BITCOIN Miner could Earn you 3.125 BTC!","duration":1232},
                {"id":"FMR1LO1rNYA","title":"Perfect BEGINNER Home BITCOIN Miner in 2026!","duration":859},
                {"id":"xr-uMjNa6m4","title":"Antminer S19j Pro \\\"0 ASIC\\\" Repair - Bitcoin ASIC Miner Repair LIVE - 022","duration":10290},
                {"id":"3TOvhNSOGAY","title":"The future of Bitcoin Mining with Sue Ennis and Hut8 Mining | Twitter Spaces Podcast","duration":2633},
                {"id":"QpbTljF0vY8","title":"Satoshi Nakamoto Mines The First Bitcoin | On This Day","duration":148},
                {"id":"-pcjgtY3Cm0","title":"The BEST explanation of bitcoin mining under 1 minute","duration":60},
                {"id":"iqVuthH57wY","title":"The Evolution of Bitcoin Mining!","duration":3973},
                {"id":"L67es0ydJjE","title":"Bitaxe Solo Mining Difficulty Explained","duration":507},
                {"id":"lDafxxAgmUI","title":"MARA Granbury Facility Tour | Latest Bitcoin Mining Stock News | Top Stocks to Watch | MARA Stock","duration":1254},
                {"id":"3PwZkjUisDM","title":"How to: Bitcoin Mining with Flared Gas","duration":1770},
                {"id":"au7LAQ0-3NI","title":"E31: The Game Theory of Mining Stacks & Bitcoin - Twitter Spaces with Xan Ditkoff","duration":3399},
                {"id":"Gsswul2h5vE","title":"This NEW Mini Home BITCOIN Miner could Earn you 3.125 BTC!","duration":1003},
                {"id":"oxzMkDLO8BY","title":"How Bitcoin Will Unlock $65 Trillion: Daniel Batten","duration":2716},
                {"id":"3v7U7WEgxzw","title":"Stephan Livera & Whit Gibbs on Twitter Spaces: Compass Mining Discuss Delays","duration":4375},
                {"id":"jfUX8d80ifw","title":"NEW: \\\"THE MINED IN AMERICA ACT\\\" CHANGES BITCOIN MINING FOREVER FT. DENNIS PORTER","duration":2432},
                {"id":"6byhBd6FtEo","title":"Bitcoin Mining: The Unlikely Environmental Hero w/ Daniel Batten | The Culture Bit","duration":3076},
                {"id":"xQ7HwJ-voME","title":"The PERFECT Mini Home BITCOIN Miner on a Budget!","duration":692},
                {"id":"XolVXJGhmj0","title":"Lohnt sich Bitcoin Mining mit deiner Solaranlage? So viel verdienst du wirklich! (+Anleitung)","duration":1732},
                {"id":"SHQq01QwG4E","title":"Beginners Guide To Home Bitcoin Mining 2026","duration":1318},
                {"id":"pXkreVWYlfA","title":"Mining Bitcoin: Mining Pool Overview & Comparison","duration":1313},
                {"id":"-IwS37HgNMs","title":"Lyn Alden: Bitcoin Mining Can Actually SOLVE the Energy Crisis","duration":60},
                {"id":"hN0VH__AZSE","title":"This Thing Earns $914 PER DAY?! Here's How","duration":679},
                {"id":"_lVlL0Tcybc","title":"Centralisation of mining pools","duration":32},
                {"id":"SNSkRFY0QeI","title":"Free Bitcoin ebooks from Braiins","duration":36},
                {"id":"CC8wQJuhP5g","title":"Compass Mining Year in Review | Start Mining Bitcoin Now | Latest Bitcoin Mining News Today","duration":3039},
                {"id":"LBlFj8yQ-4g","title":"Get Off Zero! Governments Are Buying and Mining Bitcoin Now (Adam Back Explains Why)","duration":53},
                {"id":"GPbpI-S7C5I","title":"This Bitcoin Mining Dashboard Changes EVERYTHING","duration":1930},
                {"id":"El3y8AME8oA","title":"Breaking Down How Bitcoin Mining Really Happens - Explained Like You're Five","duration":599},
                {"id":"HbS80lfbBl4","title":"Bitcoin Miner Transaction Fees: % of Block Reward (12/22/23 Update)","duration":81},
                {"id":"TVR0E6KVb-c","title":"What is a Bitcoin Miner? Disassembling an S19 While Explaining","duration":614},
                {"id":"uHVoG8B5e5o","title":"Why Africa's Bitcoin Adoption Is Years Ahead of the West","duration":3117},
                {"id":"XZFc4un1nDA","title":"The Source of Bitcoin Misinformation, Ep 449 Daniel Batten","duration":3714},
                {"id":"P6bulrD75R4","title":"Umbrel Bitcoin Node and Mining Pool - Tutorial & Review","duration":1496},
                {"id":"meFwMSsKBw4","title":"🚨 NEW BITCOIN (hashrate) ATH 🚨","duration":58},
                {"id":"t5S1Y6OopHo","title":"BEST Home Miners 2024 Guide","duration":1311},
                {"id":"G8WWJSOoKQw","title":"Don't Fall Into the FanBoy Pessimist Dichotomy : #bitcoin mining Pools","duration":57},
                {"id":"KpiASrjdfTE","title":"Bitcoin Difficulty Adjustment Animation (Difficulty Epoch 412)","duration":35},
                {"id":"CNBd4Gdla-M","title":"Wohin mit all dem PV Überschuss? Bitcoin mining mit gebrauchten S19jPro von 21energy aus Österreich","duration":1798},
                {"id":"XTb2jYYYg8Y","title":"Bitcoin Mining Difficulty & Target Hash (11/22/25 Update)","duration":113},
                {"id":"DMfv8S8ffKA","title":"How Does Bitcoin Mining Work?","duration":51},
                {"id":"a1aKbcSE4-E","title":"Mainstream Media Has FLIPPED on Bitcoin Mining","duration":1362},
                {"id":"cmTrCoJKoig","title":"Setup a Bitcoin Node and Solo CK Pool - 2025","duration":6128},
                {"id":"WbEn-fsAEqs","title":"I Mined Bitcoin for 1 Year (Honest Results)","duration":694},
                {"id":"CAPp5Elrw9o","title":"Jon Invents a new #bitcoin #mining  machine the Kaboomracks X9","duration":43},
                {"id":"EizVwqRbDSE","title":"Bitcoin Mining's Energy Problem & ESG Panel from Future Blockchain Summit","duration":1862},
                {"id":"Cyf7JjpygB4","title":"How To Build a GPU Mining Rig in 2026 - PROFITABLE!!","duration":1107},
                {"id":"y3dqhixzGVo","title":"Mining Bitcoin with pencil and paper","duration":472},
                {"id":"X0YBOyI8ptE","title":"BITCOIN BOILS THE OCEAN","duration":639},
                {"id":"F1ot1qS-VtQ","title":"The POWERFUL $680 Home Bitcoin Miner to Solo or Pool mine BTC! Nerd Octaxe","duration":945},
                {"id":"JpDxQ90jwSA","title":"Bitcoin Difficulty Adjustment (4hr Animation) [DE1 - DE414]","duration":13317},
                {"id":"C4Z5yoWfnAU","title":"Is Bitcoin Mining At Home Still Worth It In 2025!?!","duration":800},
                {"id":"yxfvEK7Nj8s","title":"Bitcoin Mining Explained in 10 Minutes","duration":935},
                {"id":"46asG9gUY4Q","title":"Uncomfortable Truths of #bitcoin  Mining","duration":42},
                {"id":"9krNJvpGpfk","title":"Vented Gas vs Flare Gas Bitcoin Mining Explained w/ Daniel Batten","duration":2283},
                {"id":"fRqr5wD2b8w","title":"Bitcoin Difficulty Adjustment Animation (Difficulty Epoch 414)","duration":35},
                {"id":"PQwRX8dCFTU","title":"Bitcoin Mining - Renewable Energy's Trojan Horse?","duration":1811},
                {"id":"Bjcn5OZwgcs","title":"Is Bitcoin Mining Still Profitable?","duration":703},
                {"id":"ACAn_yL-Too","title":"Bitcoin Mining 101 w/ Adam Haynes (BTC218)","duration":2959},
                {"id":"824d2vmw2a0","title":"U.S. Bitcoin Boom: 50M Users, $30B Mining & Bipartisan Momentum","duration":2035},
                {"id":"7AN4JSfKW8g","title":"Sovereign Wealth Fund Adoption of Bitcoin and the Death of Energy Misinformation","duration":1629},
                {"id":"wQI3jZFdh2s","title":"Bitcoin: Historical Mining Difficulty & Target Hash (11/21/24 Update)","duration":106},
                {"id":"kX27SWRLZuo","title":"Institutional Bitcoin Mining | Compass Spaces Recording","duration":2808},
                {"id":"2hFvQhMRnc4","title":"Bitcoin Proof of Work","duration":1280},
                {"id":"JPanr1nsPA4","title":"Mining Bitcoin in Paraguay  with 100% Hydro Energy | Marathon Digital Holdings","duration":85},
                {"id":"la4Aj2RrR64","title":"What I WISH I KNEW Before I Started Mining Bitcoin BTC...","duration":1113},
                {"id":"Y2jx_c5dMkQ","title":"Make Millions Turning Trash Into Bitcoin | Daniel Batten","duration":1988},
                {"id":"ENQQXeEv2gI","title":"Why Should You Run a Bitaxe?","duration":358},
                {"id":"S3gamO8-ZDg","title":"Bitcoin: Historical Mining Difficulty & Target Hash (1/30/25 Update)","duration":106},
                {"id":"xxhPn52mdxA","title":"This Solo Bitcoin Miner Found A Block! NerdQaxe++ Unboxing & Setup","duration":1016},
                {"id":"rQFWgLQuGzo","title":"It's been pretty rough lately... Minings never been this bad","duration":620},
                {"id":"58LrQ0Q89x0","title":"₿🛠️ Satoshi's 21 #011: Mining Basics + Stratum V2 ⛏️","duration":2880},
                {"id":"mrtSAgcpack","title":"What is Bitcoin Mining for Beginners - Short and Simple","duration":126},
                {"id":"ydtPKYE-0eQ","title":"$48 a day WITHOUT a Mining Rig! Crypto Passive Income","duration":482},
                {"id":"Ci8EXSy606Q","title":"Why Environmental Investors Are Reconsidering Bitcoin? - Daniel Batten (Ep 165)","duration":2835},
                {"id":"CwX35qCL1f4","title":"How to Get Started with Bitcoin Mining (Full Beginner Guide)","duration":1006},
                {"id":"MTrKwsCg9d8","title":"🔌 Gold Nugget Nerd Miner Unboxing & Setup | Start Solo Mining Bitcoin Today! 💡","duration":288},
                {"id":"UAhQoKhzzbA","title":"Marathon to Aquire 200MW Bitcoin Mining Site Near Wind Farm","duration":72},
                {"id":"lHipE05v4jg","title":"How Bitcoin Mining Works: A Complete Beginner's Guide","duration":1156},
                {"id":"u4XvKcJSmKM","title":"How Bitcoin Helps Create Energy Abundance","duration":1097},
                {"id":"MOXZAjI-arY","title":"POW Summit - The Hunt for the Real Bitcoin Hashrate","duration":2121},
                {"id":"iQiWQAtThns","title":"Marathon Digital Portfolio Overview","duration":208},
                {"id":"11dB4qzjDwA","title":"NATION STATE BITCOIN MINING w/ Daniel Batten","duration":4698},
                {"id":"qyVYPHVaeO4","title":"I Turned an OLD PC into a Bitcoin Mining Rig","duration":791},
                {"id":"8pOy8TOdyS4","title":"Bitcoin Difficulty Adjustment (2/7/24 Update)","duration":533},
                {"id":"hZKlPadZ4j4","title":"Renewable Energy and Bitcoin Mining","duration":3421},
                {"id":"vOOh9CHUZQQ","title":"5 Solo Mining Projekte für deinen Bitaxe oder Avalon Nano 3/S","duration":767},
                {"id":"YGkLWGM8os4","title":"UAE Immersion Facility Ribbon Cutting","duration":61},
                {"id":"ZeVxHolNxsg","title":"Satoshi's Genius: POW + The Difficulty Adjustment","duration":578},
                {"id":"tEnDP6p_9rY","title":"Bitcoin mining's days are numbered","duration":2971}
            ]
        },
        {
            "id": "music",
            "name": "Music",
            "emoji": "🎵",
            "desc": "Bitcoin songs, rap & music videos",
            "color": "#ec4899",
            "videos": [
                {"id":"xxvN4b42RAQ","title":"Breathe Carolina & Dropgun Ft. Kaleena Zanders - Rhythm Is A Dancer (Official Music Video)","duration":178},
                {"id":"sA1zVnvzfm4","title":"Tatiana Moroz  - The Silk Road","duration":265},
                {"id":"urq8iJaaXQc","title":"Robbie P - Feelin Like a Villain feat Snoop Dogg [Animated Music Video by @TenthDan]","duration":132},
                {"id":"bFoFN9Sbk2w","title":"K'NAAN - Bang Bang (Official Music Video) ft. Adam Levine","duration":184},
                {"id":"x_aGUAJzv0A","title":"Bitcoin Going To Zero? GFY! (Risitas feat. Elon Musk) Lil Bubble Remix","duration":82},
                {"id":"9or1H3-H0d0","title":"Sam Feldt & Sigma ft. Gia Koka - 2 Hearts","duration":187},
                {"id":"1VEMq8kDG68","title":"It's Math   Greg Foss & Pleb Music","duration":78},
                {"id":"avToLPdSerk","title":"Tatiana Moroz Performing \\\"The Silk Road\\\" LIVE in Studio!","duration":242},
                {"id":"Fvbt84QvVYI","title":"Avicii - Dear Boy (Live in Uncasville, True Tour 2014)","duration":213},
                {"id":"roxSjlgmR5M","title":"Something's Got to Give","duration":259},
                {"id":"CQPFIK1ikDQ","title":"Vitalik Token2049 Song - A New Form Of Wealth (Lil Bubble Remix)","duration":77},
                {"id":"9emhE6lVHDc","title":"Fiatdolla-The Hottest New Drug","duration":63},
                {"id":"aQUlA8Hcv4s","title":"Electric Light Orchestra - Mr. Blue Sky","duration":295},
                {"id":"7JjbxIK47d4","title":"Crypto Rap Up (Bitcoin Rap) - Puns","duration":99},
                {"id":"QP3zRBtgvJo","title":"MUSE - COMPLIANCE [Official Music Video]","duration":222},
                {"id":"zkeuo9brMnI","title":"Theo Katzman - Corn Does Grow [Official Video]","duration":225},
                {"id":"9kogqHS7UeA","title":"LUPTAȚI IMPOTRIVA LUI FUD #Bitcoin","duration":109},
                {"id":"9EeRN2qwDU0","title":"Bitcoin Anthem","duration":245},
                {"id":"IIqqMTT-ne0","title":"Lil Bubble - 0-100 Freestyle (Bitcoin Bars)","duration":140},
                {"id":"_jPFFu4gj8o","title":"Hi-Rez ft. Jimmy Levy - Welcome to the Revolution  「Lyrics」","duration":212},
                {"id":"qDUjrUot2C0","title":"Lil Bubble - Buy More Bitcoin (Official Visualizer) ft. Andrew Tate","duration":204},
                {"id":"v1kQaLp3U8o","title":"It's HODLin' Time","duration":139},
                {"id":"y5pp-usAFg4","title":"Tony Romera - Take Me ft. Dorothy Sherman | Insomniac Records","duration":192},
                {"id":"eimgRedLkkU","title":"Empire Of The Sun - Walking On A Dream","duration":200},
                {"id":"EPQJHNXdJfM","title":"Crypto - Takeoff feat. Rich The Kid","duration":161},
                {"id":"U5NGVH8HDaw","title":"Bitcoin boomdeyada!","duration":66},
                {"id":"AQq5M04lju4","title":"Bitcoin is Fueling Monetary Change - Some People Don't Like That","duration":90},
                {"id":"HK0tFMIwut0","title":"The Bitcoin Holiday Song","duration":106},
                {"id":"evwlr16PoLY","title":"Pendulum - The Island (Steve Angello, AN21, Max Vangeli Remix)","duration":400},
                {"id":"cJUflpmTp0s","title":"Wuki - Ain't It Fun [Wukileak]","duration":267},
                {"id":"8ClyXbLv7pA","title":"The Point of No Return | Immortal Technique","duration":253},
                {"id":"QjRSZSDTjgY","title":"HAUNT ME","duration":160},
                {"id":"uuccepPeIXk","title":"Spin Doctors - Two Princes","duration":256},
                {"id":"pWGDcE9YsFE","title":"Most Toxic Bitcoin Maxi Vertical & Lyric Captioned!! (Official Music Video 2023) by ROBBIE P","duration":208},
                {"id":"8peRa8Bxq5Y","title":"BITCOIN BALLER","duration":178},
                {"id":"_YvLh4pUB4Y","title":"The Times They Are A-Changin' (Bitcoin version)","duration":119},
                {"id":"IuIXe6IsUMY","title":"SATS ON ICE | @TatumTurnUp x @manlikekweks x @Encorebeats","duration":185},
                {"id":"ic1I5xNsuAE","title":"Goldfinger - The City","duration":200},
                {"id":"L7F345IxRuI","title":"Fire of Freedom | The Orange Pill Jam Project","duration":438},
                {"id":"cP--viN-QeU","title":"Faith in My Money","duration":197},
                {"id":"69uczA-41nE","title":"Blockchain Sees It All","duration":88},
                {"id":"Iaa03itxNZ0","title":"Bastille - Good Grief (Don Diablo Remix)","duration":175},
                {"id":"xMohBUCVJ64","title":"Stacking Sats","duration":197},
                {"id":"CbElk8D3-e8","title":"Oflow - Bitcoin (The Anthem) Audio","duration":154},
                {"id":"EwEjrl13rZ0","title":"Lil Bubble - Crypto DJ Set (live from the spaceship) - July 2021","duration":608},
                {"id":"4kmWR5bWHAc","title":"Andrew Tate - Buy More Bitcoin (Lil Bubble House Remix)","duration":216},
                {"id":"KYXgxhyAiwk","title":"Dax - Oliver Anthony \\\"Rich Men North Of Richmond\\\" Remix [Official Video]","duration":183},
                {"id":"aUp6fogcPM0","title":"Lil Bubble - The Rise of the Crypto Troopers","duration":116},
                {"id":"d0KWiDGi_ek","title":"Muse - Uprising [HD]","duration":304},
                {"id":"OVnvE0vfOCA","title":"Just A Ponzi That I Used To Hold (Gotye - Bitcoin & Crypto Crash Parody Version) - Lil Bubble","duration":212},
                {"id":"UG7zLhEWanc","title":"Remy: Bitcoin Billionaire","duration":175},
                {"id":"qfYqdSsAldc","title":"Hyperbitcoinization (You're Not Ready)","duration":151},
                {"id":"IrcN-zmCZMI","title":"IF IT WASN'T FOR SATOSHI | Music Video By ROBBIE P #bitcoinmusic #bitcoin","duration":162},
                {"id":"ELKbtFljucQ","title":"Paolo Nutini - Iron Sky [Abbey Road Live Session]","duration":382},
                {"id":"bEeaS6fuUoA","title":"Bill Withers - Lovely Day","duration":256},
                {"id":"GR3Liudev18","title":"Chappell Roan - Pink Pony Club","duration":281},
                {"id":"95Kmj3tKCow","title":"HOW COULD THIS HAPPEN TO ME!? (Simple Plan - Untitled - Crypto/Bitcoin Parody Version) Lil Bubble","duration":176},
                {"id":"IGeM1XWuLS4","title":"Rules That Will Survive","duration":125},
                {"id":"WJaxFbdjm8c","title":"Ai Generated Music Video - Deltron 3030 - Virus","duration":267},
                {"id":"XVcPxApYijo","title":"Bulls Is Back - 88N8 x Lil Bubble (prod. PyroDaGod) - LYRIC VIDEO","duration":172},
                {"id":"1utTEIWXOhQ","title":"Lil Bubble - How Low? (Ludacris - How Low - Crypto Version)","duration":102},
                {"id":"gZDdV4d4g4k","title":"Choyna","duration":179},
                {"id":"vyKA1pW0CBA","title":"BITCOIN \\\"ALL THE WAY UP\\\" - Remix - Music Video - The Dollar Vigilante feat  Freenauts & Jeff Berwick","duration":173},
                {"id":"3RiwksNFRTo","title":"Wgmi","duration":115},
                {"id":"ZSthLmvh6Fk","title":"Main Title (From \\\"Star Wars\\\")","duration":349},
                {"id":"6WJOWloG7Gs","title":"LoKo - 'Thank You' by Yellow","duration":140},
                {"id":"Gyi_BtemEcA","title":"Ashtray","duration":171},
                {"id":"Xl1f47AkroY","title":"Lil Bubble - My Bags Are Dumping (Official Visualizer)","duration":139},
                {"id":"6nI9-tbZozw","title":"SATS OUT @ChanceTheRapper #starsout #bitcoin","duration":60},
                {"id":"BRbVhsoPzmI","title":"Crypto Weekly Rap Up (Bitcoin Rap) - Week#4","duration":160},
                {"id":"A7TuFy0fcuw","title":"The proudhon song (bitcoin is a bubble)","duration":232},
                {"id":"2YOKsEBDR3k","title":"FIGHT THE FUD #Bitcoin","duration":109},
                {"id":"HAwC0swp96I","title":"Gramatik - Satoshi Nakamoto MUSIC VIDEO (feat. Adrian Lau & ProbCause)","duration":267},
                {"id":"YbzNJr26H-4","title":"Toby Ganger + Decap - Welcome To The Blockchain (The Bitcoin Song)","duration":241},
                {"id":"2RRpl_TBlDQ","title":"Bitcoin","duration":244},
                {"id":"9Ug7udnfbcE","title":"Oliver Anthony - Rich Men North of Richmond (Lyric Video)","duration":191},
                {"id":"6yCIDkFI7ew","title":"The Black Keys - Gold On The Ceiling [Official Music Video]","duration":226},
                {"id":"tvpOdef8CCc","title":"Bitcoin Slang (Epic ₿itcoin Rap Song) MUST WATCH!!!","duration":222},
                {"id":"C6MOKXm8x50","title":"Fall Out Boy - Dance, Dance","duration":278},
                {"id":"2vhJS3-aAgw","title":"SIKS - Older (Official Music Video)","duration":150},
                {"id":"e2cl0_jqu4I","title":"Halvingbird (a Bitcoin Halving song)","duration":172},
                {"id":"2lpikrpQ0yQ","title":"Lil Bubble - Have You Heard About NFTs? (Official Music Video)","duration":146},
                {"id":"BHBO7dFI4nA","title":"Energy Freq","duration":166},
                {"id":"SKnRdQiH3-k","title":"Skillet - \\\"The Resistance\\\" [Official Lyric Video]","duration":241},
                {"id":"yv5xonFSC4c","title":"Bob Marley & The Wailers - Redemption Song (Official Music Video)","duration":236},
                {"id":"JUK0ONX3B8s","title":"Pump It Up/Humble Sat Stacker","duration":188},
                {"id":"6cXL8TJnY1E","title":"Inflation Blues","duration":255},
                {"id":"u7u1TCkiIjQ","title":"10000 Bitcoins","duration":195},
                {"id":"8Q-K8gSBYRo","title":"Apache Indian - Boom Shack A Lack (Official Music Video)","duration":226},
                {"id":"KnIozPJWTPM","title":"Glory (From the Motion Picture \\\"Selma\\\") - Common & John Legend","duration":262},
                {"id":"6BqplqzuO6U","title":"Lil Bubble - I Hold Bags Not Assets (Panic! At The Disco Crypto Parody)","duration":130},
                {"id":"ousaiByU1ko","title":"Blues Traveler - Run-Around","duration":267},
                {"id":"_fymw1iOfiM","title":"Lil Bubble - ALL TIME HIGH (Bitcoin Anthem - Official Music Video)","duration":118},
                {"id":"YCME_bIuF3k","title":"Opiuo - Jelly (feat. Texture Like Sun)","duration":247},
                {"id":"fD9nikHty2k","title":"Pleb Run This","duration":208},
                {"id":"Xv8FBjo1Y8I","title":"Tracy Chapman - Talkin' Bout A Revolution (Official Music Video)","duration":175},
                {"id":"MN9PAdVn7l0","title":"Lil Bubble - BTFD (House Remix) Visualizer","duration":132},
                {"id":"J16lInLZRms","title":"Creed - Higher (Official HD Music Video)","duration":283},
                {"id":"Y3eFCbBjToY","title":"Better Days","duration":260},
                {"id":"wTy_VZ52UcI","title":"Bitcoin Song","duration":260},
                {"id":"K3b6SGoN6dA","title":"BLACK SABBATH - \\\"War Pigs\\\" (Live Video)","duration":452},
                {"id":"iqn9bUc751E","title":"Ode to Satoshi","duration":181},
                {"id":"yloMl7r57-8","title":"Bobby Shmurda - Shmoney (Lil Bubble Crypto Verse - Tully Remix Competition)","duration":61},
                {"id":"_hQRxuYBx0w","title":"Chuty - Bitcoin (Videoclip Oficial) [Prod. Nerso & Verse]","duration":209},
                {"id":"Hxo4S66POH4","title":"Bitcoin Pump It Up Remix","duration":98},
                {"id":"igvP806798U","title":"Born To Be Wild (Single Version)","duration":213},
                {"id":"6ZKzapbQPZA","title":"Banksters Paradise  (A Bitcoin Song)","duration":264},
                {"id":"oL6KtX9iIsA","title":"salem ilese - crypto ₿oy (official lyric video)","duration":142},
                {"id":"-zkcuaJY7AQ","title":"All That Remains - A War You Cannot Win (Visualizer Video)","duration":226},
                {"id":"qS8aIYlsuI4","title":"Whitewoods - Free Ross Anthem","duration":283},
                {"id":"-gYittQbVR0","title":"I Love Bitcoin Remix","duration":168},
                {"id":"Jnq9wPDoDKg","title":"Sixpence None The Richer - Kiss Me","duration":196},
                {"id":"_pv-uKXaBFc","title":"Bitcoin's Better Than Gold","duration":213},
                {"id":"JYJ6QJqy92s","title":"Killing in the Name","duration":314},
                {"id":"sBpkQfuQp9g","title":"Chris Webby - Lullaby (feat. Bria Lee)","duration":207},
                {"id":"UuyisfVLk10","title":"Federal Reserve","duration":32},
                {"id":"4jBDnYE1WjI","title":"Galantis - Peanut Butter Jelly","duration":234},
                {"id":"xoUVtthd7gY","title":"Bastille - Pompeii (Audien Remix)","duration":293},
                {"id":"ImfZTycPzbE","title":"Muse - Compliance (Live) - Turku Rockfest 14.6.2025 Finland","duration":250},
                {"id":"TjD4B3Vh9LQ","title":"FOREVER LONG!? (Youth Group - Forever Young - Crypto Bitcoin Parody Version) - Lil Bubble","duration":150},
                {"id":"wyjTXNebRvU","title":"Lil Bubble  - Alt Season (The Ritual)","duration":137},
                {"id":"42pUCIjC6ks","title":"Lil Bubble - Pool & Chill (DeFi yield farming/impermanent loss diss)","duration":127},
                {"id":"QvZ7K_0_SiY","title":"Lil Bubble - Liquidated (Avril Lavigne - Complicated | Bitcoin Parody Version)","duration":149},
                {"id":"qR4fzaXe6vw","title":"In Our Minds","duration":150},
                {"id":"Y5r6e1VcIBE","title":"BITCOIN SONG","duration":280},
                {"id":"DNYzHGM50Ys","title":"Too Bit To Fail - Proof of Word EP","duration":1560},
                {"id":"PYeUQpbMy1o","title":"Love You Like A Bitcoin","duration":242},
                {"id":"q7Ol-YDS4Jc","title":"The Interrupters - \\\"Take Back The Power\\\"","duration":201},
                {"id":"Q3aLqqWQhxY","title":"Where is My Mind [Orange Pill Edition] ft. John Vallis & American HODL","duration":141},
                {"id":"0NpUmajMDQw","title":"GAMPER & DADONI - Bittersweet Symphony (feat. Emily Roberts) (OFFICIAL MUSIC VIDEO)","duration":204},
                {"id":"c5wbgDLr-u0","title":"Bitcoin Playlist (all songs) | simsek music","duration":1610},
                {"id":"E94KORpOpo4","title":"Lil Bubble - Dump (Lyric Video)","duration":145},
                {"id":"VyfL2TUS0rk","title":"We Need Freedom (Red Zone)","duration":306},
                {"id":"xWAwK2fHArc","title":"Bitcoin Song - No Regulators (Warren G - Regulators)","duration":257},
                {"id":"RG9kGQfOJWg","title":"B L O C K  P A R T Y #bitcoin #bitcoinmining","duration":65},
                {"id":"H_vQt_v8Jmw","title":"Rage Against The Machine - Freedom (Official HD Video)","duration":360},
                {"id":"htTL7C23684","title":"Build The Chain","duration":145},
                {"id":"YkKEuJwu7iM","title":"Metallica - ...And Justice For All (Remixed and Remastered)","duration":590},
                {"id":"-Y13lkBvsQw","title":"Kanye West - Ghost Town Remix [Orange Pill Edition]","duration":173},
                {"id":"sGVa8jUmuk0","title":"The 12 Steps to Serfdom","duration":212},
                {"id":"B8j4mn4eF-c","title":"Thurston Harris - Little Bitty Pretty One","duration":141},
                {"id":"8n5k714GOlA","title":"Chris Record - BACK TO MY CRYPTO - Bitcoin Rap Remix #HODLGANG","duration":179},
                {"id":"Lx262ep1I0I","title":"Fumble - Writings on the wall (Official video)","duration":149},
                {"id":"_ovdm2yX4MA","title":"Avicii - Levels","duration":199},
                {"id":"tJrtRnA7xe4","title":"HODL On Ye Bitcoin Sailors (feat. The Toxic Pleb Chorus)","duration":247},
                {"id":"fC_q9KPczAg","title":"Barenaked Ladies - One Week","duration":175},
                {"id":"DroPwAsPMSs","title":"TomoCoin - Proof of Care Submission","duration":130},
                {"id":"ErgNY-mox34","title":"Superzyklus - prod. by Orange Pill Reality 🎸🔥","duration":241},
                {"id":"yTM9SFaeIgU","title":"SNBRN - Feel My Love","duration":205},
                {"id":"LHPKOy3dtqQ","title":"Green Day - Revolution Radio (Official Lyric Video)","duration":181},
                {"id":"mZFxv1PT-QQ","title":"Gramatik & BRANX - Future Crypto","duration":207},
                {"id":"dgKlBQmGQ98","title":"Most Toxic Bitcoin Maxi (Official Music Video 2023) by ROBBIE P","duration":208},
                {"id":"Y1Lott3zNwk","title":"Skillet - Revolution (Audio Visualizer)","duration":186},
                {"id":"emcT185BXMQ","title":"Carlos Matos - Take On Me (autotuned)","duration":112},
                {"id":"XZbvb3pD81E","title":"Cantillionaires Game","duration":151},
                {"id":"Vz9iCgiSZrM","title":"Lil Bubble - Bitcoin's Back - Backstreet Boys Bitcoin Parody","duration":141},
                {"id":"Qx3PdGcA5Zs","title":"Stay Humble Stack Sats","duration":132},
                {"id":"Tf6goF7JyFE","title":"New York Time-traveling Journalist","duration":136},
                {"id":"x1DVrUXk2H8","title":"KEEP MY SATS IN THE TREZOR #music #bitcoin #bitcoinwallet @TrezorWallet","duration":61},
                {"id":"OJ62RzJkYUo","title":"Pixies - Where Is My Mind? (Official Lyric Video)","duration":230},
                {"id":"beW981FRwd0","title":"The New Division - Opium (Official Music Video)","duration":311},
                {"id":"IBiGEbiSjy0","title":"GORILLA SATS","duration":162},
                {"id":"cDYAaZnSEf8","title":"Justin Mylo - Chasing Shadows (Official Music Video)","duration":196},
                {"id":"n7FXEpkuy0k","title":"Lil Bubble - What A Dump (Haddaway - What Is Love - Crypto Bitcoin crash song)","duration":103},
                {"id":"0ws8HqK0dsc","title":"The Shores of Sovereignty","duration":282},
                {"id":"fjFGInQZnyY","title":"Testing Bitcoin 123","duration":121},
                {"id":"2GADx4Hy-Gg","title":"Avicii - You Make Me","duration":231},
                {"id":"oF4lleeOPe8","title":"Future of Money","duration":134},
                {"id":"bJKGdKqd3sc","title":"The Hodler","duration":234},
                {"id":"vQ9xKDPysyU","title":"Tungevaag, CLMD - DANCE","duration":173},
                {"id":"6VJBBUqr1wM","title":"Avicii - Silhouettes","duration":285},
                {"id":"248Zbw1oPnw","title":"Enhancer","duration":203},
                {"id":"27U4yhFqCVs","title":"WHATS DROPPIN? (Jack Harlow - WHATS POPPIN - Bitcoin, crypto, trading parody) - Lil Bubble","duration":110},
                {"id":"YyCoM4WTU74","title":"Jack Mallers - Stack Sats by @plebmusic","duration":97},
                {"id":"VdAcvUVy7FE","title":"We Will Bitcoin","duration":126},
                {"id":"sOlkuuAq8p0","title":"Lil Bubble x The Dev - Drop It Like It's Hot (Crypto Parody Version) Snoop Dogg feat. Pharrell","duration":163},
                {"id":"PEQxEJ5_5zA","title":"Make Your Own Kind of Music (Mama Cass Elliott)","duration":167},
                {"id":"wW5iomxXXRI","title":"The Bitcoin Song","duration":133},
                {"id":"rDCrlgKGACo","title":"Anik The First - Be The Change (B.T.C.)","duration":209},
                {"id":"7qZbiMPQgyg","title":"Skillet - Rise Up [Official Audio]","duration":238},
                {"id":"idP3tyRsUrE","title":"PAY ATTENTION TO #BITCOIN","duration":47},
                {"id":"aynV4UOU-As","title":"Flume - Holdin On (Official Video)","duration":155},
                {"id":"HxL19VWL9TM","title":"Jaxomy x Agatino Romero x Raffaella Carra - Pedro","duration":146},
                {"id":"KQ7rn3oi-Pc","title":"Money Man - Blockchain (Official Video)","duration":139},
                {"id":"Wtj1x9aT9Zk","title":"Crypto Weekly Rap Up (Bitcoin Rap) - Week 1","duration":126},
                {"id":"m_dEsgzWFsU","title":"Propaganda","duration":338},
                {"id":"vyrU5hHrFJQ","title":"Dream of Empire","duration":139},
                {"id":"ipDpjANJ7fU","title":"Save The Young","duration":174},
                {"id":"DaECuEX6WtU","title":"LMFAO - Sorry for Bitcoin Hodlin! ($100K Bitcoin Song)","duration":310},
                {"id":"cDmWR520hgk","title":"Roll The Old Timechain Along","duration":186},
                {"id":"ijMaYfpW4KE","title":"BTC or ETH, we're all fighting the same fight.","duration":52},
                {"id":"9ZYH8v42a2w","title":"Ray Charles - America The Beautiful (Official Video)","duration":216},
                {"id":"k8ukx0LKJRo","title":"Have Fun Staying Poor","duration":185},
                {"id":"z8uEvqUvy0A","title":"Bitcoin Waits for You","duration":124},
                {"id":"tTflIh5sU-Q","title":"Mark Knight & Beverley Knight (ft. London Community Gospel Choir) - Everything's Gonna Be Alright","duration":218},
                {"id":"wYsMjEeEg4g","title":"Harvey Danger - Flagpole Sitta","duration":223},
                {"id":"9IclmVdWNbI","title":"Green Day - Know Your Enemy [Official Music Video]","duration":193},
                {"id":"RU4aHnZlHhM","title":"Lil Bubble - Never Ever (selling back to tether)","duration":130},
                {"id":"u1OfRSnQOss","title":"BITCOIN IS DEAD!!!","duration":102},
                {"id":"2FXN1Z6Q004","title":"Ray Charles - America The Beautiful (Official Audio)","duration":218},
                {"id":"Otkg4Ftx6GI","title":"The Bitcoin Song","duration":225},
                {"id":"nNMidaMLmrQ","title":"Star Spangled Bitcoin (Bitcoin Halving Anthem)","duration":70},
                {"id":"Uu0qmgshc4o","title":"Beyoncé  - Freedom (feat. Kendrick Lamar) (Lyrics)","duration":267},
                {"id":"MNgJBIx-hK8","title":"Dave Matthews Band - Ants Marching","duration":268},
                {"id":"OQPq_5PTj9M","title":"HAPPY BITCOIN HALVING! 🚀 Willy Wonka style? #Bitcoin #bitcoinhalving2024","duration":51},
                {"id":"47JKf4-bSoc","title":"David Bowie, Bob Dylan, Kanye West - Kids Remix [Orange-Pill Edition]","duration":112},
                {"id":"7nSr2P6blYM","title":"Akon - Akon's Beautiful Day (Official Music Video)","duration":172},
                {"id":"78QQ4L44xj0","title":"Aint Gotta Dollar (Laundry Room Edition)","duration":125},
                {"id":"XxJT8NDT4JQ","title":"NO PAPER NO VISA #nostr #bitcoin","duration":60},
                {"id":"JACD8a2LZ_8","title":"Lil Bubble - Green Christmas (Crypto Christmas EP - BONUS SONG)","duration":139},
                {"id":"vUUgTsMXjCI","title":"The Bitcoin Jingle performed by Tatiana Moroz (Tatiana Coin)!","duration":636},
                {"id":"yyDm6ia_eR8","title":"The Sat Stacker ft. Drake, Kendrick Lamar","duration":115},
                {"id":"0LhJR11B1CE","title":"Bags On Exchanges","duration":241},
                {"id":"oZwzttexaUM","title":"Lil Bubble - All The Small Caps (Blink 182 - All The Small Things - Crypto/Bitcoin Version)","duration":140},
                {"id":"UjkYo7t15yk","title":"👍 2018 | Bitcoin(Official Video) Shehbaaz | 👍 | Vardhman Recordz","duration":228},
                {"id":"Q9z_cVn4gZg","title":"Chris Webby - Know My Rights (feat. Xander Goodheart)","duration":200},
                {"id":"aXQM72Xll3o","title":"Tatiana Moroz  - The Bitcoin Jingle","duration":247},
                {"id":"-bb5UOTsWqE","title":"SPELL FREEDOM | @manlikekweks x @Encorebeats","duration":204},
                {"id":"IeKDJbJSVoo","title":"War","duration":204},
                {"id":"s_x-KGxOcRA","title":"The Vandals - Anarchy Burger (Hold The Government) (Lyrics)","duration":114},
                {"id":"V1bFr2SWP1I","title":"Israel Kamakawiwoole - Over the Rainbow","duration":228},
                {"id":"lG08pD-8upE","title":"Bitcoin Slang (Remix) [OFFICIAL MUSIC VIDEO] By ROBBIE P *Epic Bitcoin Rap Song Revamped*","duration":197},
                {"id":"bK95lWHl7js","title":"Megadeth - Dystopia (Official Music Video)","duration":316},
                {"id":"Bv9Ug00PZZU","title":"Avoided Wars","duration":154},
                {"id":"P1dzJhqy97I","title":"YungManny - Bitcoin (Manny Phantom)","duration":100},
                {"id":"1XH2I1vh2Co","title":"We are fucking stupid","duration":118},
                {"id":"IsuVMdnF8A0","title":"Zedd - Spectrum ft. Matthew Koma","duration":248},
                {"id":"XS37JKYc-gA","title":"Bitcoin Baron","duration":210},
                {"id":"zHxobd1WLno","title":"Imagine (Ultimate Mix)","duration":187},
                {"id":"kKIsjAuMDyo","title":"The Plan","duration":140},
                {"id":"Gs069dndIYk","title":"Earth, Wind & Fire - September","duration":216},
                {"id":"cWgGOFlb15U","title":"In Our Minds","duration":150},
                {"id":"0A1ewwo1120","title":"Dave Matthews Band - Tripping Billies (Live in Europe 2009)","duration":386},
                {"id":"_5ukACItUh0","title":"E.Cole I - Inflation (Official Lyric Video)","duration":185},
                {"id":"MVqNXGzqlZE","title":"\\\"Stand Proud\\\" (feat. Shana Halligan, Tahir Panton, Keznamdi)","duration":266},
                {"id":"CBufq6ous9I","title":"Stackin Sats","duration":182},
                {"id":"JfQycjqZK3c","title":"Kygo - Freedom w/ Zak Abel (Official Audio)","duration":199},
                {"id":"H43xhkHxkzs","title":"I N T E R S E L L E R #Bitcoin","duration":51},
                {"id":"9bljFUfIshM","title":"Avicii - Sunset Jesus","duration":266},
                {"id":"hRhj3lfWzrI","title":"Aurora- The Seed Haik Concert Live","duration":280},
                {"id":"3cCxzR9NjhI","title":"The Panic Is On","duration":177},
                {"id":"xAVTyex_9E8","title":"Lil Bubble - BTFD (Official Music Video)","duration":124},
                {"id":"Hgqdss3DY5M","title":"Lil Bubble - Man With Bitcoin (Official Visualizer)","duration":142},
                {"id":"ciR1hA-QslE","title":"Cry Me a Bitcoin","duration":128},
                {"id":"pyTthqApWGw","title":"GORILLAS IN PARIS #bitcoin #paris","duration":150},
                {"id":"wRgDybQ8WWg","title":"Iyah May - Good Citizen - Music Video","duration":305},
                {"id":"58k14xd2WJA","title":"San Holo - brighter days (ft. Bipolar Sunshine) [Official Lyric Video]","duration":249},
                {"id":"NbHUM9iElkQ","title":"Bullish","duration":162},
                {"id":"IToRg7qX-V0","title":"toxic happy hour!!!!","duration":48},
                {"id":"5XR7naZ_zZA","title":"Galantis - Runaway (U & I)","duration":264},
                {"id":"CgZEKDzgJwI","title":"Avoided Wars","duration":154},
                {"id":"9Yhjcn81Xfk","title":"LoKoBTC - Freedom Ain't Free (Official Video)","duration":233},
                {"id":"AJzCQaIXelE","title":"Bitcoin Girl - Original Music Video","duration":248},
                {"id":"oJO5WbsbMAU","title":"Ones Who Came Before","duration":124},
                {"id":"SCkOOq4rHus","title":"Robbie P - Rich In Bitcoin featuring Man Like Kweks [Official Audio]","duration":116},
                {"id":"DH-tCLh2PM8","title":"21 Million Bitcoin","duration":115},
                {"id":"qOHEfVQFs2Q","title":"Hope","duration":121},
                {"id":"UBQ4mDsuWeI","title":"Central Bank","duration":167},
                {"id":"Xyxdlfa9TY0","title":"Inflation","duration":195},
                {"id":"lc29W5PkM30","title":"Pennywise - Fuck Authority (LIVE from Red Bull Sound Space at KROQ)","duration":194},
                {"id":"ZrLUOnORg2U","title":"Coin Bros - Buy the F@ck!ng dip! (PROD. BG3NIUS)","duration":143},
                {"id":"Y3ywicffOj4","title":"Fleetwood Mac - Dreams (Official Music Video) [4K]","duration":264},
                {"id":"gIbyaej97mI","title":"Hope In Numbers","duration":131},
                {"id":"v6BtEESQaAA","title":"K'naan - 70 Excuses","duration":250},
                {"id":"-Fj9mzIPjrA","title":"Scouting For Girls - She's So Lovely [Official Music Video]","duration":229},
                {"id":"qliXxDyvnak","title":"MAGIC! - Rude (Zedd Remix)","duration":276},
                {"id":"6mJF3c90xe0","title":"Shitcoin Casinos - Annonymal (Bitcoin Heavy Metal)","duration":230},
                {"id":"bC-hvPM6JbA","title":"Lil Bubble - Half On The Block (Happy Bitcoin Halving!)","duration":100},
                {"id":"gGJdWNnC80s","title":"Don't Tread on Me (Remastered)","duration":241},
                {"id":"tQ3VgWkgLr8","title":"CAKE - Nugget (Official Audio)","duration":240},
                {"id":"Ec_HjprLjqo","title":"Rationale II Freedom (Lyric video)","duration":226},
                {"id":"3Y71iDvCYXA","title":"Elvis Costello & The Attractions - Pump It Up","duration":194},
                {"id":"7wBg1lBKtyg","title":"Lil Bubble - When Moon? (Mad World - Bitcoin Parody)","duration":79},
                {"id":"iBJFo3p7gNc","title":"Lil Bubble - 100 Racks (Official Visualizer)","duration":149},
                {"id":"6xfqzCqTiZs","title":"BitBoy Crypto Rant (Heavy Metal Remix) - Lil Bubble","duration":64},
                {"id":"TmWhY_irAXE","title":"Pet","duration":275},
                {"id":"JWSpLFvzGII","title":"Tatiana Moroz - Keep Your Chin Up","duration":370},
                {"id":"_Mc_OM5oNA8","title":"AURORA - The Seed","duration":281},
                {"id":"3v9hjdvnBx8","title":"Not in Yer Wallet","duration":150},
                {"id":"YtyrRpGAg34","title":"John Williams - Main Title from Star Wars | London Symphony Orchestra","duration":345},
                {"id":"BfnjX88Va4Y","title":"Endor - Pump It Up (Official Video)","duration":151},
                {"id":"RzvOlN7o6UE","title":"Ones Who Came Before","duration":121},
                {"id":"xUs83qYjgFg","title":"Inflation","duration":181},
                {"id":"hCPBqWSwr7I","title":"The (time)Chain","duration":169},
                {"id":"BM1IF4UoZ1Y","title":"Tatiana Moroz - Never Give Up (Live from Bitcoin Halving Party)","duration":229},
                {"id":"hjhVos8L3Kg","title":"Love Anthem","duration":240},
                {"id":"xwP9gC5BW-E","title":"CRYPTO SUPERSTAR | CYPRESS HILL PARODY OF RAP SUPERSTAR","duration":118},
                {"id":"mJUB86V57c4","title":"Lil Bubble - Pump It Up (Crypto/Bitcoin Version) Joe Budden Parody","duration":127},
                {"id":"JGPgxoIPY6Q","title":"Boys Like Girls - The Great Escape","duration":208},
                {"id":"u9muTnTQ5qs","title":"Jamiroquai - Canned Heat","duration":235},
                {"id":"y29kmnhjtc8","title":"Iyah May Karmageddon Lyric Music Video","duration":211},
                {"id":"mR8_ldc9lag","title":"Criminal","duration":320},
                {"id":"G-ip-MHg6Zc","title":"Tatiana Moroz - Never Give Up (Live at the DC Blockchain Summit)","duration":216},
                {"id":"_qcvxLefJdY","title":"Immutable","duration":156},
                {"id":"kdvTkddp1F0","title":"Zhou Tonged - Don't Get Zhou Tonged!!! (Sister Nancy - Bam Bam)","duration":157},
                {"id":"k4kj7JKSWYI","title":"21million","duration":121},
                {"id":"sy1dYFGkPUE","title":"Justice - D.A.N.C.E.","duration":181},
                {"id":"Mp405FRK15Q","title":"Anti-Crypto | The Orange Pill Jam Project","duration":330},
                {"id":"WTJSt4wP2ME","title":"K'NAAN - Wavin' Flag (Coca-Cola Celebration Mix)","duration":225},
                {"id":"r_X-o5i8cFo","title":"DCA2BTC #bitcoin @Reelrichard @manlikekweks @nogoodnode","duration":53},
                {"id":"w8KQmps-Sog","title":"Muse - Uprising [Official Video]","duration":252},
                {"id":"mkKFR5sB44s","title":"Pizza Day","duration":206},
                {"id":"VQ8H3qGkrFM","title":"When Moon Remix (Lil Bubble in Paris) @ Binance Blockchain Week 2022","duration":111},
                {"id":"PjML7PXGsUo","title":"Crypto Weekly Rap Up (Bitcoin Rap) - Week#3","duration":126},
                {"id":"82bSw5uAkBQ","title":"MONEY, MONEY, MONEY","duration":136},
                {"id":"LlY90lG_Fuw","title":"Pharrell Williams - Freedom (Official Video)","duration":166},
                {"id":"q31WY0Aobro","title":"Sex Pistols - Anarchy In The UK","duration":217},
                {"id":"r9dyTI_is-Q","title":"SAVE US - Bruised [OFFICIAL VIDEO]","duration":178},
                {"id":"VT_aEKr0BVY","title":"Bitcoin Song (by 13inlet)","duration":198},
                {"id":"9SuaT17NolA","title":"Satoshi Love Song さとしの恋歌","duration":132},
                {"id":"S99tOmXywZU","title":"Let Me Escape","duration":107},
                {"id":"6KNOqrjkNaE","title":"Crypto Weekly Rap Up (Bitcoin Rap) - Week#2","duration":205},
                {"id":"XEBWtbhq0Ts","title":"All About That Bitcoin - Naomi van der Velde","duration":157},
                {"id":"5I3zvXUhjbU","title":"Bitcoin vs. GOLD","duration":65},
                {"id":"17ozSeGw-fY","title":"Calvin Harris - Sweet Nothing ft. Florence Welch","duration":269},
                {"id":"XTaKJ8SlXw4","title":"Why Gold is Better than Bitcoin","duration":45},
                {"id":"Vh1uCDPOLx0","title":"Refugee (Radio Edit)","duration":227},
                {"id":"ILP36_0tooU","title":"K'NAAN -Wavin' FLAG (coca-cola celebration mix)  LYRICS","duration":225},
                {"id":"d6Nt-TgueSM","title":"Let Me Escape","duration":106},
                {"id":"4gaQc-tiIR0","title":"The End of Bitcoin?","duration":54},
                {"id":"_ahb5yP0pck","title":"SATS IN THE TREZOR 906,777","duration":213},
                {"id":"IpCJ5ct_pgk","title":"Evolution to Revolution - \\\"Love and Liberty\\\" - Tatiana Moroz","duration":201},
                {"id":"PCW6BkSp1Sc","title":"deadmau5 - Antisec (ft. YTCracker)","duration":173},
                {"id":"WqkjYKUXERQ","title":"Billy Joel - We Didn't Start the Fire (Audio)","duration":292},
                {"id":"O2r_4fAr7Zs","title":"The Aliens Are Laughing At Us","duration":87},
                {"id":"3lUUDwSSkWo","title":"Bitcoin Miner's Daughter","duration":212},
                {"id":"2Y6Nne8RvaA","title":"Kungs vs Cookin on 3 Burners - This Girl","duration":198},
                {"id":"KRopo3nofl4","title":"Laura Saggers - 10,000 Bitcoin Remix","duration":86},
                {"id":"Xq-knHXSKYY","title":"Avicii - For A Better Day","duration":254},
                {"id":"vtdfzVYtfXQ","title":"BITCOIN DADA - HOW TO ⚡️ #btc #music #kenya #bitcoin","duration":56},
                {"id":"G8g-UGSjtG4","title":"Greedy Life","duration":376},
                {"id":"9I9l8vlTvJE","title":"Toxic Maximalist - The Orange Pill Jam Project","duration":218},
                {"id":"oNuionfkJFQ","title":"In The Music (as made famous by The Roots feat. Malik B. Porn)","duration":253},
                {"id":"4xmckWVPRaI","title":"Twisted Sister - We're Not Gonna Take It (Official Music Video)","duration":272},
                {"id":"cEiNCWBFkx0","title":"LoKoBTC - Pump It Higher (feat. AnthonyDessauer)","duration":140},
                {"id":"16y1AkoZkmQ","title":"Boney M. - Rasputin","duration":270},
                {"id":"37Bc5ZmvX8Y","title":"Lil Bubble - Old Saint Nicholas (Crypto Christmas)","duration":130},
                {"id":"sXQVicNodMw","title":"Kaskade - Atmosphere","duration":254},
                {"id":"1pqIFDI18ZY","title":"Lil Bubble - Jingle Bells (Please Don't Sell) - Crypto Christmas EP","duration":105},
                {"id":"TW-B0nae4to","title":"Going Cashless, I see the whole setup. (Rap Performance) #onetakelive #cbdc #lyricvideo","duration":173},
                {"id":"2WFTCz56lco","title":"What A Wonderful World - Joey Ramone - Lyrics","duration":142},
                {"id":"0C2-brBpVMw","title":"Federal Reserve","duration":277},
                {"id":"XcerPhwbIFs","title":"Orange Pill rApp - Wallet Stay Stackin'!","duration":189},
                {"id":"GZ0YMSLZjfQ","title":"Toby + Decap - Welcome To The Blockchain (The Bitcoin Song) MUSIC VIDEO","duration":242},
                {"id":"u4Mocusd1OU","title":"Soulja Boy - Bitcoin (Official Audio)","duration":186},
                {"id":"PEs1Ezk9htU","title":"Lil Bubble - DeFi State Of Mind (Jay-Z ft. Alicia Keys - Empire State Of Mind - Crypto Parody)","duration":133},
                {"id":"SaC7lOaa3q4","title":"Magic Internet Money 🎧 High-Energy Electronic Track | Cyberpunk Club Music - TheLauSats","duration":261},
                {"id":"eH9b_qNbjEU","title":"Teejay - Bitcoin (Official Music Video)","duration":227},
                {"id":"eqxNbGvNamY","title":"Lovesong for Satoshi Nakamoto Bitcoin Whitepaper (\\\"Everything Has Changed\\\", Taylor Swift cover)","duration":257},
                {"id":"ZaI2IlHwmgQ","title":"The Black Eyed Peas - Pump It (Official Music Video)","duration":226},
                {"id":"s88r_q7oufE","title":"Queens Of The Stone Age - No One Knows (Official Music Video)","duration":259},
                {"id":"wNFY8lJhm0A","title":"Kygo, Zak Abel - Freedom","duration":198},
                {"id":"chPDTUjnWgA","title":"POWER (Album Version (Edited))","duration":293},
                {"id":"UCENTf_LWYA","title":"Frank Sinatra - That's Life (Audio)","duration":187},
                {"id":"wa6Ex4Shxes","title":"Ringing of Revolution","duration":435},
                {"id":"3hYZbyWZW-E","title":"Lil Bubble - In My Spaceship (Official Visualizer)","duration":132},
                {"id":"_OGqQO06JP8","title":"Wavin'  Flag (Coca-Cola® Celebration Mix)","duration":220},
                {"id":"PL0yOu0dNwo","title":"Mainframe - Proof of Freedom","duration":133},
                {"id":"F3hTW9e20d8","title":"The Hanging Tree' James Newton Howard ft. Jennifer Lawrence (Official Audio)","duration":216},
                {"id":"pFS4zYWxzNA","title":"clubbed to death - Matrix soundtrack","duration":455},
                {"id":"ZsXaaTgJZzI","title":"All Falls Down [Orange Pill Edition]","duration":153},
                {"id":"6JCLY0Rlx6Q","title":"WALK THE MOON - Shut Up and Dance","duration":247},
                {"id":"YQG7vcrQIlg","title":"Zac Brown Band - Free (Feat. Joey & Rory) [Live]","duration":250},
                {"id":"KwVbcjJYctM","title":"Clubbed to Death (from \\\"The Matrix\\\")","duration":244},
                {"id":"mFa0vQtNfRw","title":"The Grinches of Tyranny (BANNED Christmas Song)","duration":177},
                {"id":"2DquYAJG1hA","title":"88N8 X Lil Bubble The Bulls Is Back","duration":172},
                {"id":"NQ1BBJFBjvg","title":"Madeon - Mania (Official Audio)","duration":155},
                {"id":"Cl6Rz1Uvi2M","title":"Fred again.. - Delilah (pull me out of this)","duration":252},
                {"id":"Fgd8T1XYOmA","title":"LoKoBTC - S.R.E.A.M (C.R.E.A.M. Bitcoin Remix)","duration":110},
                {"id":"h0rSYEoBMYM","title":"Goldfinger - Superman","duration":176},
                {"id":"YkxopBlMWLw","title":"Runaway [Orange Pill Edition]","duration":134},
                {"id":"qj5zT4t7S6c","title":"Sigala - Sweet Lovin","duration":214},
                {"id":"M3TzVgGyBFs","title":"Lil Nas X - Old Town Road (Bitcoin Version) Lil Bubble","duration":165},
                {"id":"nO6A4N9zjgE","title":"Rich men north of Richmond - full band non-official version/cover (Lyric video)","duration":176},
                {"id":"AX-5PHQ1_Kg","title":"Bitcoin Is Always True","duration":112},
                {"id":"82KBQkJgIJs","title":"Lugano PlanB \\\"The Song\\\" | The Orange Pill Jam Project","duration":354},
                {"id":"SfwGpvrzIjs","title":"Captain Youth - Bitcoin 🤑","duration":224},
                {"id":"tvtJPs8IDgU","title":"Counting Crows - Big Yellow Taxi ft. Vanessa Carlton","duration":226},
                {"id":"vtwJ00ck0nI","title":"Swiss Bank Bitcoin (Bitcoin Anthem)","duration":198},
                {"id":"3KmLpdVR9Yw","title":"Mailman","duration":267},
                {"id":"gdnzBNMfZfo","title":"The Doors - Break On Through (To The Other Side) [Official Video]","duration":151},
                {"id":"sXIrST5mbSU","title":"LoKoBTC - Toxic Maxi (Official Meme Video)","duration":149},
                {"id":"ofC8w1GvcGU","title":"Last Day Of School by The Wylde Bunch","duration":263},
                {"id":"QNi-PnKwQDI","title":"The Most Blunderful Time of the Year","duration":148},
                {"id":"TxI0F-LSBSk","title":"ALL TIME HIGH, LESSONS OF REGRET [LYRIC VIDEO]","duration":208},
                {"id":"W-Z_hlzZYBw","title":"Jason Saulnier - Bitcoin We're in Love (Official Music Video)","duration":242},
                {"id":"aNrpN9oAUlo","title":"Bitcoin Baller","duration":107},
                {"id":"T3deOQPJ2H8","title":"Freedom (Sub Focus & Wilkinson)","duration":243},
                {"id":"QL6_YmVoRlg","title":"Truthseekers","duration":191},
                {"id":"2ZGRzdywXqs","title":"Say Anything - Alive With The Glory Of Love (MUSIC VIDEO)","duration":262},
                {"id":"x3idGV-7kSQ","title":"Journey - Don't Stop Believin' (Official Video RCF)","duration":249},
                {"id":"VcjzHMhBtf0","title":"Journey - Don't Stop Believin' (Escape Tour 1981: Live In Houston)","duration":252},
                {"id":"-GD9cjJqF64","title":"Bitcoin: A New Hope","duration":93},
                {"id":"vQkXrct78A4","title":"Тилэкс - BITCOIN","duration":119},
                {"id":"B0xceHDpHcc","title":"Redemption Song (1991) - Bob Marley & The Wailers","duration":228},
                {"id":"5rtTUO275wk","title":"Lil Bubble - All The Way Up (Official Visualizer)","duration":132},
                {"id":"Kf9O25j1PSs","title":"Lil Bubble - SpaceX (Official Visualizer)","duration":104},
                {"id":"0xjxJ-P9VbY","title":"The Shores Of Sovereignty","duration":272},
                {"id":"Ee_uujKuJMI","title":"Green Day - American Idiot [Official Music Video] [4K Upgrade]","duration":182},
                {"id":"-UyRTltUv7w","title":"Genesis Block","duration":157},
                {"id":"J4pLMsk-nVA","title":"SATS OVER EVERYTHING | ​⁠@manlikekweks x @Encorebeats","duration":218},
                {"id":"ozx898ADTxM","title":"Sigala - Easy Love","duration":178},
                {"id":"s3UtbslfqS8","title":"Gary Gensler, isn't that true? Bitcoin Heavy Metal - Annonymal","duration":315},
                {"id":"Xw8qrQ6HxEU","title":"BITCOIN is for LOVERS!","duration":57},
                {"id":"C38ACpjr8Pw","title":"Say Yeah","duration":140},
                {"id":"yp0diaVLPrQ","title":"Mark Zuckerberg's Sister Sings to Crypto","duration":141},
                {"id":"9odyosmjIr0","title":"Lil Bubble - Bitcoin Song (Lyric Video)","duration":119},
                {"id":"bZb2qBrVHVY","title":"Bitcoins from Heaven","duration":50},
                {"id":"NzU5njGMq-w","title":"Ego Death","duration":244},
                {"id":"R5AoOA5j85A","title":"Lil Bubble - All I Want For Christmas Is Mass Adoption (Crypto Christmas EP)","duration":140},
                {"id":"erG5rgNYSdk","title":"Weezer - Island In The Sun","duration":201},
                {"id":"r-vbEOo2x4Y","title":"LFG","duration":114},
                {"id":"27BwXfrJxcs","title":"Death to Fiat - The Skull of Satoshi - Greenpeace is a such a Fraud -  Annonymal Bitcoin Heavy Metal","duration":209},
                {"id":"3fxzaTg0vMQ","title":"Lil Bubble - All The Bears Are Dead (Bitcoin 50k Edition - Lil Uzi Vert)","duration":120},
                {"id":"gVrWLhcau94","title":"The Call","duration":140},
                {"id":"Geh6M87Njcs","title":"Take The Power Back","duration":337},
                {"id":"39VlJOcFv94","title":"Bitcoin Anthem,  Bitcoin to the Moon - Anime Music Video","duration":246},
                {"id":"Rtc1KPPzbls","title":"F.I.A.S.O.M. Pt. 2","duration":170},
                {"id":"BifVGcvJpxc","title":"WAGMI","duration":115},
                {"id":"LMZsaYLqAys","title":"CODE IS SPEECH","duration":70},
                {"id":"w47yNylcEU0","title":"DCA2BTC","duration":208},
                {"id":"_iGtBkLn7uM","title":"Sxtxshx Nxkxmxtx","duration":175},
                {"id":"h7I_DqVzYjI","title":"Bitcoin","duration":30},
                {"id":"SIFN4u13FEU","title":"DIAMOND HANDS & LASER EYES (OFFICIAL MUSIC VIDEO 2024)","duration":184},
                {"id":"RIsZyg8OXlI","title":"10'000 Bitcoins  - Laura Saggers - Original Music Video","duration":231},
                {"id":"K5yDgEVafg8","title":"Never Give Up (The Bitcoin Halving Song)","duration":233},
                {"id":"qUNX6nyCL9Q","title":"BITCOIN Ballin'","duration":203},
                {"id":"PWgvGjAhvIw","title":"Outkast - Hey Ya!","duration":304},
                {"id":"RglKdIovlX0","title":"BANK","duration":141},
                {"id":"z9porfO8C_Q","title":"Kygo - Stay ft. Maty Noyes (Official Video)","duration":244},
                {"id":"qKSNABST4b0","title":"Rage Against The Machine - Take The Power Back (Official Audio)","duration":338},
                {"id":"NEnaxCLcSL8","title":"One Bit Wonder","duration":112},
                {"id":"wkSxvQHhF_4","title":"LoKoBTC - ZAP2ZAP (feat. HomerHodl)","duration":107},
                {"id":"Etk0eS8cIZQ","title":"Level Up","duration":88},
                {"id":"GxalY2vHZro","title":"1 BTC = 1 BTC","duration":158},
                {"id":"U4W05HzAWuM","title":"The Plan","duration":140},
                {"id":"zxJwgU4JzLw","title":"Bitcoin Genesis Block: The Separation of Money & State","duration":106},
                {"id":"n8F55puGHIs","title":"Ricky Martin - Livin la Vida Loca","duration":223},
                {"id":"28PadE9ARDg","title":"MusicSnake - Cold Storage [Hardware Wallet Crypto Song]","duration":206},
                {"id":"coULYfYVUiA","title":"TOKYO CITADEL REMIX #bitcoin #nostr","duration":51},
                {"id":"gSxKJJ9k3lA","title":"🎵 Betawi CryptoCoin - The Ultimate Crypto Anthem Official Music Video","duration":395},
                {"id":"FQlAEiCb8m0","title":"Stardust - Music Sounds Better With You (Official Music Video)","duration":263},
                {"id":"FCA9i6MUCK0","title":"Bitcoin Beats Mix - Volume 1","duration":1796},
                {"id":"g5JqPxmYhlo","title":"King Harvest - Dancing in the Moonlight","duration":172},
                {"id":"ZUsOvjH-lRU","title":"Lil Bubble - Satoshi As My Witness (Official Music Video)","duration":151},
                {"id":"40eqoQHJU_E","title":"George Michael - Freedom! '90 (Official Lyric Video)","duration":387},
                {"id":"SMVEFDtAxJc","title":"Bitcoin Anthem","duration":90},
                {"id":"9EcjWd-O4jI","title":"Technotronic - Pump Up The Jam (Official Music Video)","duration":222},
                {"id":"a13xrgCM21s","title":"Where is My Mind [Orange Pill Edition] ft. John Vallis & American HODL (Audio Only)","duration":143},
                {"id":"HKtsdZs9LJo","title":"Cage The Elephant - Ain't No Rest For The Wicked (Official Video)","duration":185},
                {"id":"K2ku1A5Ox8U","title":"Blame it on MT.GOX","duration":234},
                {"id":"kjpV9UPBEdw","title":"Lfg","duration":114},
                {"id":"_8I8tWmQqAE","title":"Peer2peer","duration":143},
                {"id":"dUU7qGCQHmU","title":"Goldfinger - Open Your Eyes (Live Mtv)","duration":172},
                {"id":"CmGGt4KL9kQ","title":"Lil Bubble - 100 RACKS (Bitcoin $100k Anthem) Official Music Video","duration":149},
                {"id":"vnMBfreYTA4","title":"Lil Bubble - Dammit (Blink 182 Crypto Parody Version)","duration":157},
                {"id":"A4AsxKXfsYQ","title":"Tech N9ne believe full lyrics","duration":239},
                {"id":"7pAr6B7fqyM","title":"Freedom","duration":367},
                {"id":"__eWQtXVt3o","title":"DIAMOND HANDS & LASER EYES (ONE TAKE BITCOIN RAP) Inspired by El Salvador making BTC Legal Tender","duration":163},
                {"id":"kL3KuEQaQVw","title":"For What It's Worth","duration":158},
                {"id":"b8uRhNfxe60","title":"New #Bitcoin all time high!? 🚀","duration":41},
                {"id":"DWpsoCkihwI","title":"Currency Crisis of Confidence","duration":167},
                {"id":"amHdpiVZ5fg","title":"Ego Death (Extended Version)","duration":340},
                {"id":"qetW6R9Jxs4","title":"Eric Prydz - Call On Me","duration":174},
                {"id":"c21GLKrC2Gg","title":"Bitcoin Only (feat. C. Scott Muzic) - Wonx316","duration":217},
                {"id":"tEpAmY2BCT4","title":"LoKoBTC - ₿ Party","duration":193},
                {"id":"NALgMW0nOBQ","title":"GOING CASHLESS | Lyric Music Video By Robbie P  #bitcoinmusic","duration":153},
                {"id":"bWXazVhlyxQ","title":"Rage Against The Machine - Killing In the Name (Official HD Video)","duration":314},
                {"id":"gGdGFtwCNBE","title":"The Killers - Mr. Brightside","duration":228},
                {"id":"hZJRJpbGkG4","title":"War","duration":231},
                {"id":"HDvjzx5CKiU","title":"Michael Saylor \"We Call Them..\" #bitcoin #DnB #remix","duration":49},
                {"id":"J29Kp6ofbww","title":"Major Lazer - Get Free (feat. Amber Coffman) (Chrome Sparks Remix) (Official Lyric Video)","duration":261},
                {"id":"PtaYMGK0LVQ","title":"Robot Just Stole My Job (Tesla Bot Optimus AI - Parody Song) - Lil Bubble","duration":132},
                {"id":"VMLakjlz6us","title":"Roger 9000 - Ode to Satoshi","duration":490},
                {"id":"dT4hLudO-is","title":"IMAGINE : JOHN LENNON (Lyrics)","duration":184},
                {"id":"ZLYx-SXUjUk","title":"Richard - The Flood ft Tomer Strolight","duration":166},
                {"id":"GaVkEgi1tIg","title":"Avicii, David Guetta - Sunshine","duration":362},
                {"id":"qlJdTtSNpcI","title":"HODL On","duration":196},
                {"id":"d7ZOCibyihc","title":"FOMO","duration":188},
                {"id":"s3xXVsGANNI","title":"The Ballad Of Surfer Jim (feat. The Toxic Pleb Chorus)","duration":96},
                {"id":"YalLzdOSUGU","title":"The Great Re-Sat [Salvatore Ganacci - Horse Remix - Orange Pill Edition]","duration":93},
                {"id":"h9vxIh1ELAo","title":"Oompa Loompa (Bitcoin Halving Remix) Lil Bubble","duration":85},
                {"id":"MqDCuSWr8p8","title":"Tatiana Moroz - Love Song","duration":170},
                {"id":"2PM-20RRUYY","title":"Salem ilese - Crypto Boy [Lyrics]","duration":144},
                {"id":"OASbLz9R90o","title":"Intenet Money","duration":94},
                {"id":"AeCHP-4iRbM","title":"Get Up, Stand Up (1973) - Bob Marley & The Wailers","duration":200},
                {"id":"HgzGwKwLmgM","title":"Queen - Dont Stop Me Now","duration":212},
                {"id":"s8XIgR5OGJc","title":"The Chainsmokers - Dont Let Me Down (Illenium Remix)","duration":220},
                {"id":"3uvMvtyt0R8","title":"Hope in Numbers","duration":131},
                {"id":"vTABPqiYJC4","title":"The Mooney Suzuki - Alive & Amplified","duration":187},
                {"id":"zRDZFW4pBvw","title":"Crypto Boy ft. Lil Bubble (salem ilese TikTok duet)","duration":66},
                {"id":"szXTJN1gmxY","title":"Lil Bubble - Bybit Games (BTC Brawl Theme Song)","duration":92},
                {"id":"_eOMKmRSgvU","title":"RICH IN BITCOIN feat. @manlikekweks  [Animated Music Video by Tenthdan]","duration":116},
                {"id":"0UwOeQ6LPT8","title":"Robbie P - Most Humble Fiat Minimalist [Official Audio]","duration":174},
                {"id":"AJUAHhKYOIU","title":"Greatest Teacher","duration":144},
                {"id":"m1ytm0vs1v8","title":"Pay Me In Bitcoin","duration":207},
                {"id":"Vf5Y_DRAyYw","title":"MOTi - Friday (feat. JGUAR)","duration":206},
                {"id":"pADgAmNzxek","title":"MV 张张《我们都是比特币 We are all bitcoins》","duration":227},
                {"id":"5TAm-W3Hgis","title":"Chris Webby - North of Richmond (Remix) [Lyrics]","duration":197},
                {"id":"cHKudSFnQLM","title":"\\\"Don't Stop\\\" Fleetwood Mac performed by Rumours of Fleetwood Mac","duration":210},
                {"id":"S2hPUqdYqMs","title":"WHAT UP KING 👑 #bitcoin #music","duration":161},
                {"id":"l5-gja10qkw","title":"Highly Suspect - My Name Is Human [Official Video]","duration":259},
                {"id":"1MPZRcyTrcU","title":"Randy Newman - You've Got a Friend in Me (From Toy Story)","duration":128},
                {"id":"KLukwDVzETI","title":"Satoshi's Magic (A Big Bitcoin Christmas)","duration":236},
                {"id":"C_ptrffwUQs","title":"Freedom - Sub Focus & Wilkinson ( Audio Oficial )","duration":241},
                {"id":"awbmTxD7sMM","title":"K'Naan - Wavin' Flag (lyrics) [HD]","duration":224},
                {"id":"BeiouJGHeE8","title":"Ty Dolla $ign - Ego Death (feat. Kanye West, FKA twigs & Skrillex) [Lyric Video]","duration":230},
                {"id":"D3TD4KHB038","title":"ODESZA - All We Need (Dzeko & Torres Remix)","duration":189},
                {"id":"V6iKSUoUN48","title":"Avicii - Broken Arrows","duration":255},
                {"id":"6AfHKbpgsi4","title":"Too Bit To Fail & Hanspanzer - FOMO","duration":190},
                {"id":"v0JS5jGg_vQ","title":"Lil Bubble - Bitcoin House DJ Set (Vol. 1) - Bitcoin House Mix","duration":2387},
                {"id":"BgtEyrZDn1s","title":"Lil Bubble -  My Ponzi (Ginuwine - Pony - Bitcoin Parody Version)","duration":132},
                {"id":"4J2UC3N_A_c","title":"Time To Ride Or Die","duration":134},
                {"id":"iqbScnkmf0s","title":"Elaine Diane Taylor - Bitcoin Barbarians","duration":186},
                {"id":"UdbOaVdIUTM","title":"The Bitcoin Song - Ohio Toast Ska Man (Official) - Song by Aled Thomas","duration":139},
                {"id":"gu122fUBlxA","title":"Captain Youth - Maul Me (Lyric Video)","duration":175},
                {"id":"2M-cIEvv9N0","title":"P A R I S #bitcoin","duration":56},
                {"id":"y1KOsdUBjbs","title":"Tatiana Moroz - The Bitcoin Jingle (Live at the DC Blockchain Summit)","duration":159},
                {"id":"JiWMqQvXzNA","title":"LoKoBTC - Because I Got High (Stackchain Remix)","duration":105},
                {"id":"jXwOd99Gcds","title":"100K ON THE WAY (Remix)","duration":148},
                {"id":"5Uba9nQTxKM","title":"Zap Me, Mama","duration":164},
                {"id":"q8GPkQGMLAo","title":"My Fair Bitcoin","duration":70},
                {"id":"dnDC3uWjhlo","title":"The Notorious B.I.G. - Ten Sats Commandments","duration":122},
                {"id":"zTDeEJyCmNA","title":"Supermode - Tell Me Why","duration":177},
                {"id":"i4gtFm0NBLY","title":"SPEND SATS IN TZ {843962}","duration":208},
                {"id":"mwumlxIZiNA","title":"Kap Slap ft. M. Bronx - Felt This Good","duration":220},
                {"id":"U5JnpsDzw2k","title":"Dollar Vigilante feat. Freenauts - BITCOIN ALL THE WAY UP","duration":169},
                {"id":"KglDZXcdQhk","title":"Lil Bubble - Bitcoin Song (Official Music Video)","duration":117},
                {"id":"ixZDTiXiHsc","title":"Three Days Grace - Riot (Official Audio)","duration":208},
                {"id":"VtLAl3eFYhQ","title":"Lil Bubble - Moon Boy (Official Visualizer)","duration":112},
                {"id":"qki2ZIhnA6M","title":"Captain Youth - Bitcoin Money (Official Lyric Video)","duration":212},
                {"id":"9tuBn_FEFdg","title":"Bitcoin is Defiance","duration":108},
                {"id":"HF9uhRqcNSo","title":"Lil Bubble - Let It Pump (Official Visualizer)","duration":111},
                {"id":"1_VwtHcfefg","title":"Jay Sean - Down (Crypto/Bitcoin/Stock Market Parody Version) Lil Bubble","duration":161},
                {"id":"oQlqCjM4tAg","title":"Government Out","duration":184},
                {"id":"PJvi5uUY8Rk","title":"Lil Bubble - Don't Hate The Game (Level 1)","duration":75},
                {"id":"R43PCsV92R4","title":"Avicii - City Lights (Lyric Video)","duration":389},
                {"id":"S8jhXmfdRFY","title":"Otto Knows - Million Voices","duration":190},
                {"id":"nrtFeKuiAHA","title":"Lil Bubble - Rug Star (Smash Mouth - All Star) Crypto Parody","duration":129},
                {"id":"9EuH_ZGOlIs","title":"Proof of Work: A Bitcoin Experience","duration":183},
                {"id":"109WLnpYkqE","title":"Vibing with the FED and Bitcoin. Embrace it.","duration":180},
                {"id":"MBv19ch_yMQ","title":"Crypto Weekly Rap Up (Bitcoin Rap) - Week#5","duration":151},
                {"id":"-o1Oa5s_HOg","title":"RADIOACTIVE BITCOIN HOPE (feat. REEL RICHARD & THE CHARACTER) [MUSIC VIDEO]","duration":169},
                {"id":"dz4Gt-Oty9I","title":"Drake - Started From the Bottom (Crypto/Bitcoin Parody - Lil Bubble)","duration":148},
                {"id":"-N4jf6rtyuw","title":"Gnarls Barkley - Crazy (Official Video) [4K Remaster]","duration":181},
                {"id":"FbxycFX3idc","title":"Gramatik - Satoshi Nakamoto Feat. Adrian Lau & ProbCause","duration":267},
                {"id":"zqABrIOjIgU","title":"Tatiana Moroz Performs The Bitcoin Jingle | Miami Crypto Experience 2021","duration":131},
                {"id":"SpIgOm5vFkE","title":"Martin Garrix & Zedd - Follow","duration":222},
                {"id":"2dh3o2g528Q","title":"TRPC THNDR #bitcoin #music #games","duration":58},
                {"id":"HuSTyAgt8Uo","title":"Bitcoin Song","duration":209},
                {"id":"i1_idiGFUjM","title":"Antico - We need freedom - Red Zone (1991)","duration":300},
                {"id":"U252iiG8YP0","title":"Jingle Bells, Bank Cartels! A Bitcoin Christmas Song","duration":121},
                {"id":"IAU0wkabfzY","title":"Toxic ft Orange Pill Jam, Man Like Kweks","duration":141},
                {"id":"qlrdha8wD7o","title":"MIAMI BOYS CHOIR - Yerushalayim @ Madison Square Garden","duration":277},
                {"id":"X_hcqAJS6sw","title":"Tatiana Moroz - Playin' The Cards","duration":553},
                {"id":"V7-4mTV9ODM","title":"All Over the World","duration":165},
                {"id":"nvlvG18AcCo","title":"Bitcoin Bob: Money Monopoly","duration":140},
                {"id":"a6HnpGWA-NY","title":"Dark Market","duration":161},
                {"id":"e9kWhWgmg7E","title":"Rules That Will Survive","duration":125},
                {"id":"8KkDyLrgMMo","title":"Tenacious D   The Government Totally Sucks Lyrics","duration":98},
                {"id":"_c9WOks2mvg","title":"Pump It Higher","duration":156},
                {"id":"N-V3zqvtbCM","title":"Dion Timmer - Shiawase [Monstercat Release]","duration":218},
                {"id":"FzUWMPfYV98","title":"Freedom Engine","duration":223},
                {"id":"MQzXrrFvSKs","title":"MultiBoi Using Pico Flasher is INCREDIBLE","duration":112},
                {"id":"1a9SsvGp7kc","title":"[Clean] Robin Schulz - All We Got (feat. KIDDO)","duration":192},
                {"id":"kQMK1WnJV-w","title":"Bitcoins","duration":244},
                {"id":"xfwpAhlVALQ","title":"Gary Gensler - Smells Like Securities (Eminem - Without Me - Crypto Version) - Lil Bubble","duration":122},
                {"id":"ByXbXg-Zny8","title":"Eric Prydz - Pjanoo","duration":199},
                {"id":"fG5PKg81mEQ","title":"ROBBIE P - FLIPONOMICS (MUSIC VIDEO)","duration":196}
            ]
        },
        {
            "id": "news",
            "name": "News",
            "emoji": "📰",
            "desc": "Latest Bitcoin news & market updates",
            "color": "#3b82f6",
            "videos": [
                {"id":"5-CPkVESKz8","title":"Iran Is Collecting Bitcoin!","duration":91},
                {"id":"IsSiNri5pkI","title":"🔥Krypto: BREAKING NEWS! Weitere Eskalation! Bitcoin und Altcoin Live-Trading🔥","duration":7924},
                {"id":"VujZYyPXKxo","title":"BITCOIN LIVE : BTC ROLLER COASTER, RUSSELL 2000 ATH! 420 STREAM","duration":5898},
                {"id":"MGalqKZKTy4","title":"MicroStrategy's Billion Dollar Bitcoin Strategy Revealed!","duration":32},
                {"id":"c1qQiRQUdJo","title":"Bitcoin's Massive Supply Shock Incoming!","duration":57},
                {"id":"yvkmOa4XSrg","title":"Big Beautiful BITCOIN | RABBIT HOLE RECAP #364","duration":5189},
                {"id":"hSlcy29ETjQ","title":"Bitcoin Update: $500-Million ETF Inflows, Market Absorbs Mt. Gox BTC, $50K Level Defended","duration":1141},
                {"id":"pRM3MVZs9Kg","title":"Bitcoin Servers: Professor Jiang's Biggest Myth Exposed!","duration":66},
                {"id":"EoPrAGei8W4","title":"Rabbit Hole Recap: Bitcoin Week of 2020.12.28","duration":6121},
                {"id":"8MKP-Su-cvg","title":"Bitcoin Update: ETF-Buyers, BTC Dominance, Stocks Correlation - The Bitcoin Layer","duration":795},
                {"id":"LGYcl4hwUOI","title":"Bitcoin at 200-Week Moving Average - Buy Signal?","duration":682},
                {"id":"q9luFpyJTaw","title":"The Monetary Singularity Is Here And Everyone Is Asleep!","duration":1260},
                {"id":"VB7taeOBHZE","title":"RABBIT HOLE RECAP #395: STAY HUMBLE AND STACK SATS","duration":6604},
                {"id":"XNzcJ3NWqS4","title":"Bitcoin Story: 4th Grade Lesson on Money & Value","duration":50},
                {"id":"TfjSdlopmrk","title":"Commercial Real Estate Update: Property Is DOWN 30%, Equity Is GONE","duration":1545},
                {"id":"6FdfT3KZ04I","title":"Russell Okung: NFL Players Bought Bitcoin Because They Believed in Me","duration":98},
                {"id":"e2YOEaQiZZc","title":"Wargaming the Oil Crisis, Bitcoin's Role in US-China Competition, & AI Agent Payments | BPH Ep 31","duration":3665},
                {"id":"Eds4tmPrs9s","title":"Bitcoin's Hidden Signals REVEALED in the TBL Chart Pack","duration":3181},
                {"id":"N7Z7tpwSlBg","title":"Inside the future of Bitcoin","duration":603},
                {"id":"0sGgpNg_2IM","title":"The Bitcoin Group #433 - Bitcoin tops $100K - Big Finance Admits Wrong - Bitcoin Winners","duration":6965},
                {"id":"DyMVHXz9Tgs","title":"Bitcoin ETFs face First Real Stress Test, Opportunities in Live Sports | ETF IQ 2/9/2026","duration":2644},
                {"id":"qjRxtYpTC70","title":"Trump, Iran, and Bitcoin: The Strait of Hormuz Scandal Exposed!","duration":67},
                {"id":"HOYnvEVOTJA","title":"The Breakout Bitcoin Needs Before the S&P Changes Its Mind","duration":4561},
                {"id":"t781m-jnwlE","title":"Arthur Hayes: Why $1M Bitcoin Is Simple Math","duration":60},
                {"id":"xDUZKNpIKRs","title":"Donald Trump: \\\"Bitcoin Is Not Threatening the Dollar. Washington Is.\\\"","duration":42},
                {"id":"L0_eUNCtPgU","title":"Bitcoin Hits $78K!!!","duration":59},
                {"id":"grSXA-0EjaE","title":"From Substack Writer to White House Bitcoin Correspondent","duration":49},
                {"id":"241nNtbdXaA","title":"BITCOIN EXPERTS PREDICT 2025 WILL BE THE YEAR OF MASS ADOPTION - PRICE PREDICTIONS AND INDICATORS","duration":883},
                {"id":"IF13rALnr48","title":"Balaji Interview: The American System is Breaking - Bitcoin is the Escape Plan","duration":4492},
                {"id":"kWrIHMV3PMM","title":"Bitcoin's Energy Use: Debunking the Climate Myth!","duration":129},
                {"id":"Mk8uyKUYy50","title":"Bitcoin ETF Launch: Banks Bet on Crypto's Future!","duration":33},
                {"id":"BcZlcZBix28","title":"Jack Mallers: Donald Trump Needed Bitcoin - Bitcoin Didn't Need Him","duration":106},
                {"id":"omyLCxja20g","title":"FED SABATOGES the Bitcoin Bank | EP 601","duration":4169},
                {"id":"-7qeECTonLw","title":"Bitcoin's Most Accurate Model Reveals Exactly When Bitcoin Hits $22M | Matthew Mežinskis","duration":6821},
                {"id":"VLWUAgYOBv0","title":"LIVE: Bitcoin for Corporations - Day 2 | Strategy World 2026","duration":31401},
                {"id":"Q_FFfWvq-z8","title":"CNBC: The Greatest Crypto Bull Run Of Our Lifetime HAPPENING NOW","duration":527},
                {"id":"gyhh2bFBa6g","title":"STRATEGIC BITCOIN RESERVE WITH ODELL AND MARTY BENT: RABBIT HOLE RECAP #347","duration":4897},
                {"id":"8hyuhziDWoQ","title":"Bitcoin Market Insights: Mt. Gox, ETF Flows, and Short-Term Holder Analysis - The Bitcoin Layer","duration":1407},
                {"id":"HJ5gAg9F0Ok","title":"Bitcoin Supply Shock Incoming!","duration":23},
                {"id":"OyA6eKmys4E","title":"Strategy Buys 4,000 Bitcoin in 30 Minutes | Bitcoin's Price Floor Just Changed FOREVER","duration":1005},
                {"id":"2PvvIoi7l_Y","title":"Lebanon Banks Close Doors on Customers - Bitcoin Fixes This","duration":2879},
                {"id":"CyVyCOHODk4","title":"Ted Cruz: Why the Left Hates Bitcoin and Cryptocurrencies","duration":1386},
                {"id":"ZsLUgWEKFJI","title":"Bitcoin: The Future is Here. Are You Ready?","duration":53},
                {"id":"K4ciiDyUvUo","title":"Larry Fink: Bitcoin is Digital Gold - CNBC","duration":153},
                {"id":"t4uCA6RNHkg","title":"Elon Musk: The Root Problem Is The Money!","duration":36},
                {"id":"JvP2BJFdWVM","title":"Eric Trump: \\\"The Bitcoin Revolution Isn't Coming. It's Already Here.\\\"","duration":49},
                {"id":"5c03NCvohCA","title":"Bitcoin and ether end 2025 with losses, but industry optimism on the horizon: CNBC Crypto World","duration":927},
                {"id":"CbEHD0esI_A","title":"Strategy's new cash reserve signals a defensive turn for bitcoin's top proxy","duration":110},
                {"id":"REuLN4ycfEI","title":"Bitcoin OG Explains The Shift Nobody Talks About","duration":5447},
                {"id":"5hfmQhB31TU","title":"Saylor Predicts Bitcoin WON'T Stop PUMPING | Rabbit Hole Recap #361","duration":6874},
                {"id":"yIID9ubQLgk","title":"Beyond the Headlines: How to Really Understand Financial Markets.","duration":1774},
                {"id":"InoqMzIarF0","title":"Inside Bitcoin's Trend Shift: Bear Zone, Liquidations, & Key Support","duration":2937},
                {"id":"R8DFZkPggeE","title":"Bitcoin's Growth Is Proof We Don't Need Inflation","duration":54},
                {"id":"DnT8bUl_DM8","title":"Bitcoin Is Being Repriced by AI","duration":947},
                {"id":"wR6SJgMnstE","title":"Using Bitcoin as an Inflationary Hedge","duration":281},
                {"id":"9xt97nMkRNc","title":"Bitcoin: The Unstoppable Force vs. Manipulation","duration":69},
                {"id":"FfM3RrM3cDQ","title":"Satoshi Nakamoto's Old Wallet Format Could Be Quantum Computing's Easiest Target","duration":59},
                {"id":"7n8LaaPkROw","title":"JD Vance: If China Hates Bitcoin, The US Should Love It","duration":124},
                {"id":"rweDTKgv96Y","title":"How The Banking System Turned YOU into a DEBT SLAVE","duration":4169},
                {"id":"IIx1sJX1c_0","title":"Adam Back: If They Know You Have Bitcoin, They'll Sweat You For It","duration":64},
                {"id":"jXjelwCFC9A","title":"Saifedean Ammous: Economic Incentive Is What Always Wins with Any Currency","duration":91},
                {"id":"3TeJHOceTJE","title":"Politicians Cannot Control Bitcoin!","duration":48},
                {"id":"uX4jfBZWpkY","title":"What's Behind Bitcoin's Remarkable Surge?","duration":63},
                {"id":"c3t4CHROkg8","title":"This Data Says Bitcoin Is About To Explode | Are You Ready?","duration":720},
                {"id":"zo1pZlgAvpY","title":"Is This the Final Bitcoin Crash Before All-Time Highs? - Simply Bitcoin","duration":1208},
                {"id":"RIPIG7YBh8s","title":"RECESSION WATCH, Economic Update, & SOFR Trouble - The Bitcoin Layer","duration":1940},
                {"id":"Bb-4dtPc_20","title":"Jack Mallers: Gold Failed Humanity, So We Engineered Something Better","duration":106},
                {"id":"qIvVWHfitb8","title":"Bitcoin's Most Accurate Model Predicts MASSIVE Price Surge By Year-End! | Matthew Mežinskis","duration":6384},
                {"id":"S2WPt7ZO1rk","title":"Bitcoin Touches 13-Month High - Valkyrie Refiles for Spot ETF (CNBC)","duration":701},
                {"id":"vk9aIjHBKuw","title":"Btc Live Trading | Crypto Live Trading | Live Trading | Live Crypto Trading | Bitcoin Live Trading","duration":15752},
                {"id":"kh-YqlKC23k","title":"Why Bitcoin Is Still King in 2025 | USA & UK Adoption, Regulation & Price Outlook","duration":170},
                {"id":"26amYt4DB-s","title":"Bitcoin Approaching A KEY Support Level... Will It Bounce Or Break?","duration":904},
                {"id":"JYM69n6IIxw","title":"What the US Government Is Planning for Bitcoin in 2026","duration":5379},
                {"id":"nqWxMp6DeSc","title":"Rabbit Hole Recap: Bitcoin Week of 2021.06.14","duration":7636},
                {"id":"BSiQHfEUabI","title":"Bitcoin touches new all-time highs, topping $118,000 as institutions pile into ETFs","duration":128},
                {"id":"wip8XgpSocI","title":"The Mainstream Media Is LYING to You About Bitcoin!","duration":982},
                {"id":"DVHvATfMldg","title":"Rabbit Hole Recap 231: There's a run on the bitcoin banks!","duration":8338},
                {"id":"jmUnGP3lDhY","title":"Rabbit Hole Recap: Bitcoin Week of 2021.05.24","duration":7245},
                {"id":"9RRaWDNj3Zk","title":"The REAL Truth About STRC - Saylor's Risky Genius Exposed!","duration":1256},
                {"id":"b3WwE75J5nE","title":"How To Unlock Returns with Bitcoin!","duration":55},
                {"id":"ufjJhl7HVOc","title":"Donald Trump: \\\"Never Sell Your Bitcoin\\\"","duration":121},
                {"id":"wC4nzqrgvik","title":"PlanB Just Updated His Predictions & Shared Massive Update On Bitcoin For 2026!","duration":492},
                {"id":"WaEBc2prSPE","title":"Next Gen Bitcoin ETFs, Refiners Outperform Broader Market | ETF IQ 4/6/2026","duration":2680},
                {"id":"yJcd0oauPjc","title":"Is Bitcoin Overtaking Gold?","duration":33},
                {"id":"G0csA1i4rtU","title":"Bitcoin ETFs Explained: The Future of Crypto in 2025!","duration":745},
                {"id":"inSLOPC8grc","title":"Bitcoin: Better Than Bonds","duration":788},
                {"id":"c3LyvfHQ9BE","title":"Why Bitcoin BOOMS in October! (The Pattern No One Talks About)","duration":717},
                {"id":"DzAWHsa-zP0","title":"#172: RABBIT HOLE RECAP - New Bitcoin All Time High","duration":8696},
                {"id":"GJ1yyHGJr3U","title":"Dylan LeClair: Bitcoin Is Cracking the Corporate Matrix","duration":38},
                {"id":"iuoj2DMpww8","title":"CLARITY Act: Tether's Role in US Dollar Hegemony & Bitcoin","duration":112},
                {"id":"sibP8Rt3ePw","title":"Bitcoin EXPLOSION Imminent? Billionaires & Politicians BET BIG!","duration":33},
                {"id":"5gUy_BWAtcM","title":"Bitcoin's Road to $400K","duration":83},
                {"id":"l1OR3gxO8U8","title":"Arthur Hayes: The 3 Things That Send Bitcoin to $1,000,000","duration":80},
                {"id":"Ac9-_2oTJJw","title":"Money's Value: Why Your Dollar Isn't What It Seems","duration":42},
                {"id":"BL4EuamrVB0","title":"FIRST BITCOIN COMPANY IN THE S&P 500 | Rabbit Hole Recap #367","duration":7856},
                {"id":"Mf8o5UUaBZ0","title":"Bitcoin vs. Gold & Dollar: A New Financial Era","duration":34},
                {"id":"2F9Ol9cNrm4","title":"Iran War Affecting America's strategic BTC Reserve?","duration":72},
                {"id":"ipvIaHKN9ts","title":"Every Time The Media Buried Bitcoin","duration":56},
                {"id":"dEnbFU-HySk","title":"Shark Tank's Robert Herjavec Says Bitcoin Price Will Skyrocket Again - CNBC","duration":144},
                {"id":"VR_YrY6qBQw","title":"Bitcoin's Surging Price: Global Chaos Fuels Bitcoin!","duration":47},
                {"id":"7RkbxNOWb-8","title":"Bitcoin's Next Move: Banks, ETFs, and Market Signals","duration":37},
                {"id":"W-ArTN0Xj4c","title":"Bitcoin Surges and Vanguard Allows Crypto ETF Trading - CNBC","duration":793},
                {"id":"H3a2M8C7yM0","title":"$100K BITCOIN WITH ODELL AND MARTY BENT: RABBIT HOLE RECAP #334","duration":5711},
                {"id":"9kdZHs5DXYo","title":"US Strikes Iran, Banks Lobby Against Stablecoin Bill & Why AI's Future Chooses Bitcoin | BPH Ep 30","duration":3668},
                {"id":"4AGJRX2BYsE","title":"The Greatest Lie Ever Told Is The Dollar In Your Pocket","duration":1153},
                {"id":"eqFDi_OYVj8","title":"Rabbit Hole Recap 226: FTX BLOWS UP - Takes House of Cards with it, MOVE BITCOIN OFF EXCHANGES","duration":8264},
                {"id":"gwIF2pcrkdA","title":"Bitcoin Defies Global Economics!","duration":55},
                {"id":"bOBiu9zP5jA","title":"Bitcoin Owner Will Lose $260 Million If He Can't Remember Password - TODAY","duration":186},
                {"id":"a4Dt2DUghT4","title":"The Separation Of YOUR Money And Government Is Finally Happening","duration":53},
                {"id":"ILT8CwA518M","title":"Peter McCormack: How Real Bedford Won 7 Trophies With Bitcoin","duration":91},
                {"id":"iQOiQZ_g97I","title":"Wall Street Week: The Crypto Craze","duration":122},
                {"id":"x8wQ4Ws9pSU","title":"Former Government Insider: What Happens If China Acquires 2 Million Bitcoin First?","duration":5670},
                {"id":"eUEfZ4Gbl7c","title":"Saylor's STRC Is Accelerating The Bitcoin Bull Run | Rabbit Hole Recap #405","duration":7498},
                {"id":"PerQ-v7Doec","title":"John Stossel has Tatiana Moroz on to talk about Bitcoin!","duration":248},
                {"id":"ODJ-FpEIQvc","title":"Dr. Jack Kruse Exposed Every Fraud In Bitcoin","duration":5641},
                {"id":"IlgJYb-AzlY","title":"🚨LIVE US BÖRSENSTART! Neue Woche - Neue Bärische Aussichten! Kann Bitcoin weiter Stand halten?","duration":10286},
                {"id":"Z8mMQ12ej2c","title":"Bitcoin MENA 2025 | Day 2 Livestream","duration":33671},
                {"id":"UrmY3F8VBmM","title":"LIVE: Bitcoin for Corporations - Day 1 | Strategy World 2026","duration":22564},
                {"id":"UbvZmjfE46I","title":"Jack Mallers: You're Better Off on Bitcoin's Team Than Standing in Its Way","duration":63},
                {"id":"DDzBbXDQDeg","title":"Bitcoin Fixes Fiat's Leaky Bucket","duration":119},
                {"id":"vGktxX58Cqk","title":"BlackRock's Bitcoin Buy & Global Geopolitics Shift!","duration":75},
                {"id":"1aZmvheAW58","title":"Michael Saylors Latest $1B Bitcoin Buy Changes Everything | EP 1482","duration":5851},
                {"id":"nTJW3b0sHBs","title":"Citi & Morgan Stanley: Bitcoin Price Surge Is Near!","duration":69},
                {"id":"n-_lzEfVfwI","title":"How Bitcoin Is Quietly Sparking Change Around the World","duration":41},
                {"id":"uufo1hejgJE","title":"The ONLY Gold Standard That Actually Worked","duration":51},
                {"id":"OvmzIyOqgRU","title":"How A Bitcoin Journalist Got Inside Trump's White House | Bitcoin Magazine Podcast Ep 5","duration":4620},
                {"id":"vNOW8qQZ67o","title":"BREAKING: First US Bank Launches Bitcoin ETF and it's NOT Who You Think | EP 1477","duration":4807},
                {"id":"EUlq4iW3QhI","title":"Natalie Brunell on the Sovereign Bitcoin Race Worldwide | Bitcoin Magazine Podcast Ep 7","duration":3177},
                {"id":"b_u1O9qzG6U","title":"Big Bitcoin Adoption News!","duration":1517},
                {"id":"-LPit2bEWAo","title":"BlackRock CEO on Bitcoin ETF Success - CNBC","duration":353},
                {"id":"JAya0jNyr4M","title":"Bitcoin Live Trading: Fakeout or Full Send?! BTC at CRITICAL LEVEL EP1975","duration":7971},
                {"id":"Fkf194LYPgU","title":"How Close is Quantum Computing to Breaking Bitcoin?","duration":85},
                {"id":"PpOd8joKdcY","title":"Understand the Risk, See the Opportunity With Bitcoin","duration":79},
                {"id":"ymN5RDDycmU","title":"Peter Schiff Admits He's Bitcoin's Greatest Salesman","duration":41},
                {"id":"9bXvWZM5TAQ","title":"NEW REPORT: $3.41T Giant SENDS HUGE BITCOIN WARNING [FULL BREAKDOWN] | EP 1472","duration":5067},
                {"id":"xiNKd-1ExA8","title":"Building Japan's Bitcoin Standard w/ Simon Gerovich | Strategy World 2026","duration":892},
                {"id":"KM4GaSiJFYo","title":"Why The Quantum Problem Affects Bitcoin More Than Banks Or Any Other Industry","duration":50},
                {"id":"XXOPGpPdxXQ","title":"Bitcoin's SHOCKING Rise to $76K: What's REALLY Happening?","duration":81},
                {"id":"gij6bJkyH2w","title":"Individual Ownership Peaked in 2024 and What Comes Next for Bitcoin - The Bitcoin Layer","duration":2395},
                {"id":"diF93mE7nqg","title":"Bitcoin Rises to All-Time High","duration":75},
                {"id":"-z3QYaeVNlk","title":"Bitcoin's Geopolitical Future: Iran's Sanctions & Trump's Reaction!","duration":78},
                {"id":"zyUxPX7Mp2U","title":"Bitcoin Could Go Past $100k This Year: Chainalysis CEO:","duration":297},
                {"id":"-GYg7kJFLvs","title":"Money Yield: The Perpetual Motion Machine of Finance","duration":48},
                {"id":"QWdT3978z_k","title":"DOLLAR ENDGAME: How the Iran War Destroyed the System It Was Trying to Save","duration":1653},
                {"id":"G_iI651Z8Is","title":"Winklevoss: The Gold Framework for 1M Dollar Bitcoin","duration":38},
                {"id":"kxZa2ya-W3M","title":"Russell Okung: Why I Became the First NFL Player Paid in Bitcoin","duration":27},
                {"id":"yeZnFzYjwW0","title":"Jack Mallers: I Price Bitcoin the Same Way I Value My Life","duration":71},
                {"id":"XRurouuH9uE","title":"The Morgan Stanley Bitcoin Takeover just Accelerated! (Here's The Proof) | EP 1481","duration":5098},
                {"id":"iN_lKjryY5A","title":"Coinbase Puts To Rest Their Fight With The Bitcoin Community","duration":32},
                {"id":"EeDvxILLdXI","title":"You'll Pay The Price For Bitcoin That You Deserve","duration":47}
            ]
        },
        {
            "id": "podcasts-debates",
            "name": "Podcasts, Debates & Spaces",
            "emoji": "🎙️",
            "desc": "Long-form Bitcoin conversations, debates & recorded X Spaces",
            "color": "#ef4444",
            "videos": [
                {"id":"meCoGKugjMQ","title":"Marty Bent on the Power of Bitcoin","duration":3155},
                {"id":"runHWEAoLnc","title":"Twitter Spaces 03.11.2022 | Emergency Broadcast - A Message To Judge Glenn on Celsius","duration":2984},
                {"id":"ikPnr23h7qg","title":"Proof of Stake (PoS) Versus Proof of Work (PoW) w/ Jason Lowery (BTC098)","duration":7963},
                {"id":"1Is8m_sAXn0","title":"The Bull Case for Bitcoin with Lyn Alden","duration":123},
                {"id":"DiRj_LfZw9E","title":"S17 E17: Lukas Hozda on BIP110, Bitcoin & Rust","duration":5959},
                {"id":"OtTMwrSe110","title":"China Is Breaking Gold & Silver Free From Western Manipulation - Peruvian Bull","duration":315},
                {"id":"9KxH6QESYsQ","title":"Ungovernable Podcasting | The Confab 26: Barry & ChadF","duration":4389},
                {"id":"9psB9oOaLVA","title":"Power Law, Bitcoin & MicroStrategy with Sina | SLP619","duration":3810},
                {"id":"wBEqw-PSBlg","title":"COIN STORIES CLIPS | Mark Moss on Bitcoin Volatility, Gold vs Bonds & the End of 80% BTC Drawdowns","duration":610},
                {"id":"P_C7ign3xMk","title":"A Once In A Lifetime Financial Reset Is About To Make Everyone That Has Bitcoin RICH","duration":854},
                {"id":"rVFRWOK9Bqc","title":"Twitter Spaces AMA recording 🔴 | Emergency Broadcast - FTX Chapter 11 | 11.11.2022","duration":4315},
                {"id":"j8FhuFcHY3o","title":"Prime Time with Zach Herbert | FREEDOM TECH FRIDAY 34","duration":3731},
                {"id":"u9FEoGQSOgM","title":"STRC is the world's fastest growing financial product","duration":1620},
                {"id":"AxANOz8ghm4","title":"Bitcoin Is a Brilliant Scam and I Can Prove It (⁨@CasuallyFinance⁩ video review)","duration":2703},
                {"id":"hZmvpQDcABw","title":"A Financial Reset has Begun | Luke Gromen | What Bitcoin Did","duration":4010},
                {"id":"x0kNGaxLg18","title":"Lyn Alden: Why This Bitcoin Cycle Was a Disappointment, And What Comes Next","duration":3319},
                {"id":"xqL9z_deowY","title":"There's Hope for Bitcoin with James Van Straten | SLP731","duration":2545},
                {"id":"T3v1GrPCRvM","title":"The Magic of Bitcoin with Tomer Strolight | Peter McCormack","duration":3652},
                {"id":"EMbvgJnG_-s","title":"Broken Money w/ Lyn Alden (BTC146)","duration":5191},
                {"id":"to7FF7ZmBl0","title":"Lyn Alden: No Massive Bust or Boom? - Coin Stories","duration":3384},
                {"id":"dcHt0HgQMgc","title":"Bitcoin Market Deep Dive: Dylan LeClair: Full Interview","duration":1926},
                {"id":"RUI5XmQn3L0","title":"Can Bitcoin help you retire early? with Trey Sellers | SLP727","duration":2877},
                {"id":"DZ2c8CWkwxg","title":"Can We Really Abolish the Federal Reserve? An Interview with Peter St Onge - The Bitcoin Layer","duration":3010},
                {"id":"bhSGC08V47U","title":"Stephan Livera on Bitcoin Maximalism","duration":2547},
                {"id":"mEbfbAllsO4","title":"Twitter Spaces recording | Halloween Special - 10 Scariest Moments in #bitcoin & #crypto","duration":3353},
                {"id":"3xaHgh8WL-w","title":"Does Bitcoin Bring More Love Into the World? Jeff Booth Answers","duration":68},
                {"id":"Rmh6WGxHYNE","title":"What is the IMF and do they like Bitcoin?","duration":11},
                {"id":"VnDIvyRAF34","title":"Dylan LeClair Bitcoin Market Overview (BTC155)","duration":5182},
                {"id":"G_vegzt68Xo","title":"Running a successful Bitcoin Business with Scott Sibley Of SHAmory - Voltage Twitter Spaces","duration":1634},
                {"id":"_zwIvwA8Pfw","title":"Preparing for the next wave of bitcoin adoption w/ Matt from Unchained #bitcoin #freedomtech #tftc","duration":49},
                {"id":"0fm1im0SX_4","title":"Buy Bitcoin to reach your \\\"retirement number\\\" 10+ years sooner","duration":976},
                {"id":"RppT_BiG4iQ","title":"Without Bitcoin, Gen Z is in Trouble!","duration":962},
                {"id":"Vv_zB7WkgyI","title":"The Setup for Bitcoin's Most Violent Move Yet Is Already in Place | Peruvian Bull","duration":4022},
                {"id":"K5bZ4HPpwxw","title":"Only Bitcoin Can Stop Government Corruption | Peter McCormack","duration":6182},
                {"id":"0UqPnxJ2n9U","title":"S17 E16: Summer Meng on Bitmars & Selling Bitcoin ASIC Miners","duration":3862},
                {"id":"25l-AiKimic","title":"Gold Is Being Repriced & Bitcoin Is Next | Caitlin Long | What Bitcoin Did","duration":5180},
                {"id":"o3pcZ0sEGyY","title":"Dave Smith Breaking Bitcoin Echo Chamber on Joe Rogan | EP 875","duration":5250},
                {"id":"eduyejnogMo","title":"BTC060: Bitcoin Tech w/ Stephan Livera","duration":3944},
                {"id":"WNsVIxymEtM","title":"Bitcoin, not Slavecoins with Aleks Svetski - Twitter Spaces","duration":5927},
                {"id":"y39z8VIIlVQ","title":"How to Upset the World of Bitcoin with Independent Journalism","duration":304},
                {"id":"3NiTwVBzt9I","title":"He Found Bitcoin on a 13-Year-Old Hard Drive. Now He's Fixing It. | Josh @secsovereign | #270","duration":4549},
                {"id":"Mi_Y2jGxOx4","title":"The Dollar Is the Titanic... And Most People Are Still Dancing","duration":403},
                {"id":"U3fQvvEecc0","title":"Too Soft To Fork? | THE BITCOIN BRIEF 68","duration":4161},
                {"id":"neoBZX6-g3o","title":"What Does Zooko Think About Pirate Chain? (S16 E29 Short)","duration":200},
                {"id":"fYsqdauqsJs","title":"Trump Quietly Made Bitcoin The Best Asset In America","duration":542},
                {"id":"LK_Bi2enXXY","title":"How to Orange Pill Anyone with Daniel Batten | Bitcoin Infinity Show #190","duration":4172},
                {"id":"RO1IfGz4W9w","title":"Blockware Intelligence Twitter Space 4/27/2022","duration":3129},
                {"id":"xa5iT1nklyU","title":"Brian Kelly vs Peter Schiff - Bitcoin Bull vs Bear","duration":672},
                {"id":"q3_OlLs_9wE","title":"Saylor Wants to Convert the Entire System - The MNAV Cycle Explained | Ep 268 Clip","duration":931},
                {"id":"kg0_ChMHvjQ","title":"Inflation, War & $475K Bitcoin w/ Jeff Ross | What Bitcoin Did","duration":3899},
                {"id":"gD1UVeooENM","title":"Making Bitcoin Quantum-Proof with Hunter Beast | BIS #187","duration":4414},
                {"id":"lBqLz5hvSHA","title":"MicroStrategy Deep Dive w/ Jeff Walton (BTC175)","duration":3822},
                {"id":"GyXXMjYyR0Q","title":"#Bitcoin is our anchor to truth in a sea of lies with Carlos Toriello #elections #democracy #TPBPod","duration":58},
                {"id":"sBZuvWUjgbM","title":"HODL Magoo, who are you?  Is he bearish, and Volcano Bond concerns - BMS 053","duration":5109},
                {"id":"YYJ_Le97ldA","title":"The Debt Crisis Is Already Here | Lyn Alden","duration":5129},
                {"id":"MGdCLNmc5zc","title":"Voyager Creditors - You Can Do Better | Simon Dixon Twitter Space Recording 🔴","duration":7360},
                {"id":"vknNY3oTABc","title":"The Deflation Boogie Man | Guy Swann - Bitcoin Audible","duration":357},
                {"id":"AJrPTqcHsm4","title":"The Great Bitcoin Scaling Debate: A Pleb UnderGround Twitter/X Spaces Special | EP 68","duration":7490},
                {"id":"VS44Fu4ttjM","title":"BR092 - NWC, DeepSeek, AI Coding, Sparrow, Bitcoin Keeper, Calculating Tx Sizes + MORE ft. Paul","duration":5354},
                {"id":"NhrN_M_4-EE","title":"246. USD vs BTC: Debate with Brent Johnson","duration":4201},
                {"id":"FLive_w-3jc","title":"Bitcoin Fixes Capitalism | Allen Farrington x Peter McCormack","duration":8511},
                {"id":"wjMvbpBanog","title":"America's Big Reset: Kill the IRS, Split the Dollar, and Fund It All with Sovereign Wealth - The Bitcoin Layer","duration":2282},
                {"id":"jlVLCeHxQ2M","title":"Nic Carter - Proof of Work vs Proof of Stake: Bitcoin Magazine Spaces","duration":5588},
                {"id":"kMDSsyAEvd8","title":"Small Businesses Embracing Bitcoin w/ Michael from Oshi App - Voltage Twitter Spaces","duration":2975},
                {"id":"yCtVkIEIhCg","title":"Bitcoin Can Never Go to Zero - Robert Breedlove","duration":442},
                {"id":"-UxU83QmFNM","title":"The next step for VPNs w/ Carl Dong from Obscura","duration":3743},
                {"id":"7tW_OQ-z3mI","title":"Bitcoin & Current Market Conditions w/ Preston Pysh (Twitter Spaces 02/10/2022)","duration":4079},
                {"id":"Mg-A9f_YevA","title":"Monetary Domination & The Death of Thought | Bradley Rettler","duration":5848},
                {"id":"9dRKVoTaVoY","title":"Chat_132 - How to Stack More Bitcoin [THE Bitcoin Podcast]","duration":3980},
                {"id":"-w-aYVXcOk4","title":"10 Rules for Life with Michael Saylor | What Bitcoin Did","duration":7340},
                {"id":"sHdRT9t1V2E","title":"The Give-A-Shit Matrix | Guy Swann - Bitcoin Audible","duration":284},
                {"id":"xQTdSJAmSK8","title":"We All Eat | The Confab 25: Chet","duration":4061},
                {"id":"C5aN5yHbAzE","title":"Macro Breaking Point: Iran, AI & Why Bitcoin is the Ultimate Growth Asset with Jordi Visser","duration":2195},
                {"id":"sGGg-_9Y2Lo","title":"Bitcoin Macro Hangout: Preston Pysh, James Lavish, Susie Reilly","duration":3482},
                {"id":"5FlwJlcwFK8","title":"Terminal Velocity | THE BITCOIN BRIEF 67","duration":5313},
                {"id":"xN_T696aqKA","title":"Bitcoin, Gold & the Coming Liquidity Pivot | Lyn Alden | What Bitcoin Did","duration":4750},
                {"id":"YaaKnXFiz38","title":"BITCOIN WHALES are accumulating at the highest rate in 2 months","duration":2510},
                {"id":"RB3CWGKa-Ac","title":"I'm doing something I've never done before...","duration":663},
                {"id":"DCYCz186KAU","title":"Peter Todd and Guy Swann - Swan Signal Live - A Bitcoin Show - E47","duration":5791},
                {"id":"rPD13rKqg60","title":"Experts Doubt $1 MILLION Bitcoin. But We Know the Dollar's Days Are Numbered!","duration":600},
                {"id":"TcocGqqUt3E","title":"Emancipation From Financial Patriarchy with Anita Posch","duration":3122},
                {"id":"UsZuXMNx75U","title":"BTC Prague 2026 with Matyas Kuchar | SLP733","duration":2523},
                {"id":"IYOpQ2RYhpI","title":"Inside the Global Liquidity Shift Powering Bitcoin with Dr. Jeff Ross","duration":2765},
                {"id":"wskEO0eBo3U","title":"Colonel Tim Kirk","duration":6124},
                {"id":"F0DgYow85hI","title":"Bitcoin Mastermind Q4 2024 w/ Joe Carlasare, Jeff Ross, & American HODL (BTC213)","duration":4626},
                {"id":"OfWJSEmDiKI","title":"Will Bitcoin Survive the Spam Wars?","duration":496},
                {"id":"F2-I72n9rxs","title":"The Bitcoin White Pill with Marty Bent","duration":5045},
                {"id":"KKNGEr7Mc38","title":"Clarity Act, Bitcoin AI Education, and Payments w/ Parker Lewis (BTC258)","duration":3627},
                {"id":"4S3qibfXXzU","title":"Debunking Bitcoin Energy FUD - Swan Lounge","duration":6203},
                {"id":"pVMwby6TFSA","title":"I Spoke To Bitcoin's Most Connected Insider. He Told Me Everything","duration":3504},
                {"id":"WQndQYOx4I8","title":"Bitcoin is a cheat code in the game called \\\"money\\\"","duration":1789},
                {"id":"Z6eE5WJW-WI","title":"Is the Quantum Threat to Bitcoin Actually Real? | Alex Pruden","duration":4659},
                {"id":"WF3lNZPsToA","title":"Rain, Rigs and Real Talk | ACTION NEWS!!! 19","duration":2438},
                {"id":"sJinwqKz7zQ","title":"Global Liquidity Update with Michael Howell: The Case for a U.S. Gold Revaluation Is Building - The Bitcoin Layer","duration":2857},
                {"id":"GhahF-yN4fM","title":"Fighting AI-Powered Tyranny w/ Whitney Webb #bitcoin #freedomtech #podcast #tftc #liberty","duration":56},
                {"id":"zx3nyQ3gDHQ","title":"Xapo Talks X Spaces - Bitcoin Loans  Explained! Borrow Against Your Bitcoin","duration":3009},
                {"id":"a7ZVCyLry4A","title":"You Are Literally Not Bullish Enough!","duration":1849},
                {"id":"yrZxeQh1LQ0","title":"Why Twenty One Capital Is More About Volatility Than Bitcoin","duration":4485},
                {"id":"Q38g0ct8P7k","title":"Europe Is Broken - But This Country Is Becoming the World's Most Bitcoin-Friendly Nation","duration":1858},
                {"id":"J85O-ckNxCw","title":"Michael Saylor | The Bitcoin Treasury Debate Gets Heated | What Bitcoin Did","duration":7494},
                {"id":"l1Rgq8UY3zo","title":"Why Bitcoin is Different w/ Stephan Livera","duration":669},
                {"id":"BAHMoY4-n8c","title":"BREAKING: Coinbase Got Caught Secretly Killing Bitcoin","duration":2478},
                {"id":"WfVyfNg1Tik","title":"Bitcoin Makes You Zoom Out. Stoicism Pulls You Back In. | Connor Dolan Episode 268 Clip","duration":137},
                {"id":"lwmyaxpJwoc","title":"Bitcoin is Forever Money with Michael Saylor | What Bitcoin Did","duration":9033},
                {"id":"XaNNNp6JuYI","title":"Proof Of Work - Fuck Around And Find Out T-Shirt #proofofwork #bitcoin","duration":17},
                {"id":"JPrM0J-eUfU","title":"The Collapse Has Already Started | Jeff Ross","duration":4789},
                {"id":"D2dPq6VQfcA","title":"The Distortion of Money with Jeff Booth | What Bitcoin Did","duration":5610},
                {"id":"jGW1SmLPH6E","title":"The Next Liquidity Wave Will Look Completely Different w/ Peter Dunworth | Joe Burnett","duration":3601},
                {"id":"ko27xXMTMG8","title":"The Global Debt Bubble has No Escape Valve | Eric Yakes","duration":6055},
                {"id":"pCYeq6R5JcU","title":"Jack Mallers on Why Bitcoin | What Bitcoin Did","duration":3388},
                {"id":"x4-e5wq5AJ8","title":"Bitcoin is Digital Energy with Michael Saylor | What Bitcoin Did","duration":9168},
                {"id":"ANDO2ddjfe0","title":"Lyn Alden's Advice for Bitcoin Investors Feeling \\\"Behind\\\"","duration":580},
                {"id":"iVym9wtopqs","title":"Bitcoin: The Future of Money? | Bitcoiner Book Club | EP 186","duration":5367},
                {"id":"MmdQKU0YNX4","title":"Bitcoin Will Hit $850K - Max Keiser Prediction","duration":977},
                {"id":"al8C4b4utho","title":"Jeff Park on Why Owning 1 Bitcoin Is Young People's American Dream","duration":4187},
                {"id":"XNS1Qs2n0Uc","title":"Eric Weinstein on Bitcoin","duration":8767},
                {"id":"1aMOrtr1rN4","title":"Bitcoin World #8: Bitcoin in Zimbabwe with Anita Posch","duration":4011},
                {"id":"M4RPTungLqs","title":"This Bitcoin On-Chain Metric Just Flashed - What It Means for 2026 with James \\\"Checkmatey\\\"","duration":2965},
                {"id":"3zNQst9699o","title":"BTC049: Bitcoin On-chain Data Analysis w/ Willy Woo","duration":4203},
                {"id":"5Ihs4sOkI_g","title":"He Lost Everything - Then Found His Bitcoin on an Old Hard Drive | Secure Sovereign Ep 270 Clip","duration":293},
                {"id":"WIXgXYpU8Xk","title":"A Bitcoin Maximalist On Central Banks With Daniel Prince - Fed Watch - Bitcoin Magazine","duration":3198},
                {"id":"1_MmozSQuUU","title":"This One Decision By Schwab Changes The Math On Bitcoin Forever","duration":2024},
                {"id":"XJDkWavCCQU","title":"Magoo VS George Gammon","duration":5652},
                {"id":"JAwLcqTfCTs","title":"The Great Taking is coming. Time to get prepared. | Guy Swann","duration":61},
                {"id":"3CEROEMaebM","title":"Reflections on Satoshi with Adam Back and Pete Rizzo - Bitcoin Magazine Podcast","duration":2883},
                {"id":"V4LwatVM5Vg","title":"Bitcoin Street Interviews [Bristol, 2021]","duration":962},
                {"id":"zvg91cf10K4","title":"20 Things That Are A Complete Waste Of Money Once You Understand Bitcoin","duration":1139},
                {"id":"gIN3zSklstU","title":"The Perfect Destruction of Nature with Anjan Sundaram","duration":5788},
                {"id":"6_qyBmRCPzA","title":"Jeff Booth x Voltage - Bitcoin & Lightning Discussion Twitter Space","duration":2953},
                {"id":"wUMxd-C4CZk","title":"Bitcoin for Fairness with Anita Posch","duration":3831},
                {"id":"XWp4qcDXHsY","title":"Zuby on COVID, Clown World & Why Bitcoin Wins | BIS #193","duration":3820},
                {"id":"D9_vFNt5ops","title":"TWITTER SPACES: POST $ETH MERGE! FASTER? CHEAPER? WHAT ABOUT #MINERS?","duration":6138},
                {"id":"p7bS96N8qzs","title":"Caitlin Long: Why Avanti Will Be a New Kind of Crypto Bank - Ep.216","duration":3898},
                {"id":"fbrQrcVu0NU","title":"Untangling Knots vs  Core | THE BITCOIN BRIEF 66","duration":4987},
                {"id":"y1leqqCohjU","title":"Make Honest Money  Ethics First, Monetize Your Passions!","duration":27},
                {"id":"2nFniJp3Zfs","title":"Prime Time with Q | FREEDOM TECH FRIDAY 37","duration":3568},
                {"id":"KpQX-04LxJ8","title":"Mark Cuban DEBATE Vs. Bitcoiners (Preston Pysh, Pomp, Peter McCormack, and others) - Twitter Spaces","duration":5657},
                {"id":"b2UzxUDnOTQ","title":"Miami: The Bitcoin City with Mayor Francis Suarez","duration":3278},
                {"id":"I_C79ZzfZSQ","title":"MAKE BITCOIN NONPARTISAN AGAIN with Jason Brett","duration":5000},
                {"id":"xbE591bPcY4","title":"This could be the END of Bitcoin (@ProfSteveKeen video review)","duration":3316},
                {"id":"Nq3qLlcbFK0","title":"Monthly Tech Round-up: Davos WEF, Claude Cowork, and MacroHard w/ Seb Bunney (TECH013)","duration":4087},
                {"id":"cnuvwEGNcsY","title":"The Bitcoin Flywheel: How Corporate Strategies Are Reshaping Crypto","duration":5176},
                {"id":"0pM7oshoTqo","title":"What Happened to the Progressive Movement? with Margot Paez - FULL VIDEO","duration":7058},
                {"id":"H5EkNlRyUo4","title":"He's Read Every Quantum Paper, Here's How It Affects Bitcoin | Brandon Black","duration":3951},
                {"id":"jPF5Dj9NFyI","title":"Bitcoin Tax Attorney Exposed The IRS's Real Plan","duration":2843},
                {"id":"0r6zMdHcpW0","title":"Was Bitcoin a CIA Project? The Hidden Origins of Satoshi Nakamoto | #BitcoinHardTalk Ep.103","duration":10222},
                {"id":"EuWaIGQOkZE","title":"1 Bitcoin will buy 50 years of your salary","duration":851},
                {"id":"29u-F8O8WAA","title":"The Physics of Bitcoin with Giovanni | SLP732","duration":3553},
                {"id":"bsDXHwhL3fw","title":"Leveling Up Bitcoin Education: How SHAmory Turns Learning Into a Game for All Ages with Scott Sibley","duration":2961},
                {"id":"GCY9a7SGYyc","title":"Jack Mallers on XXI (21) and Strike Borrowing and Lending (BTC235)","duration":3909},
                {"id":"7xmzjZimgbw","title":"0.1 Bitcoin Will Be Impossible To Own (They're Making Sure Of It)","duration":931},
                {"id":"UiXSPHD53OQ","title":"Bitcoin++ and making Bitcoin dev great w/ Nifty Nei","duration":2860},
                {"id":"q0KB6u4etXU","title":"Will Bitcoin End The State? with Stephan Livera","duration":5163},
                {"id":"eT4-4h6A-SY","title":"BITCOIN The Fastest Horse In The Race!","duration":2328},
                {"id":"JHRBmuA8ba0","title":"Bruce Fenton - The spirit and mission of Bitcoin was bringing meaningful change to the world.","duration":76},
                {"id":"3U-QUw8xgPU","title":"Twitter Spaces AMA - The Future of Crypto Yield","duration":4164},
                {"id":"aOopWCMewwo","title":"How Can Bitcoiners Survive?","duration":47},
                {"id":"RpcZ1DvCAf8","title":"Beginner's Guide #1: Andreas M. Antonopoulos on Why We Need Bitcoin | What Bitcoin Did","duration":3707},
                {"id":"iNrsC2P_ydA","title":"Vitalik Buterin: Ethereum is a Bitcoin Sidechain","duration":97},
                {"id":"ENW3PL50yPw","title":"The History of AI and Chatbots w/ Dr. Richard Wallace (TECH011)","duration":2919},
                {"id":"OiQBMFuRodE","title":"311. The Bitcoin vs Gold Debate: Saifedean Ammous vs Peter Schiff","duration":3045},
                {"id":"OLvKvMm3XAg","title":"Dr. Jeff Ross & Tomer Strolight | Philosophy + Economics | Simply Bitcoin IRL","duration":4105},
                {"id":"dlbQNj9q5Xk","title":"BTC106: FTX Failure, GBTC, Genesis DCG & More w/ Dylan LeClair","duration":4255},
                {"id":"tVqHgMvvEiE","title":"After a 50% Drop, Bitcoin Sends a Signal Wall Street Can't Ignore","duration":2268},
                {"id":"KfomU3Kf3sk","title":"Twitter Space AMA Recording | Part 2 of 7 | Custody & Investment Accounts","duration":3711},
                {"id":"8q2ADElnxcc","title":"Will #Bitcoin save you?","duration":66},
                {"id":"VTCzVWgJJWs","title":"Bitcoin As The Apex Predator - Robert Breedlove (Pomp Podcast)","duration":4176},
                {"id":"4G_5yr47y_M","title":"why 70% of el salvadorians not make money?","duration":41},
                {"id":"R1IV91XNYxU","title":"Anita Posch on Why 'Bitcoin Is a Tool for Freedom' - Especially in Africa - Ep. 531","duration":3732},
                {"id":"zUlP3RufbTM","title":"Exploring Bitcoin for Social Good with Trey Walsh","duration":4872},
                {"id":"227anLxQ0mU","title":"The Money Printer Is Back On with Lyn Alden - The Bitcoin Layer","duration":3688},
                {"id":"S9DjpDY-PIY","title":"Tatiana Moroz | Inside Bitcoins Chicago","duration":3161},
                {"id":"BF0v2MSR0tU","title":"Jack Mallers Orange Pilling the IMF with Bitcoin | What Bitcoin Did","duration":4588},
                {"id":"lC-jN7McpRU","title":"S16 E31: Andrew Camilleri \\\"Kukks\\\" on Ark, BTCPay & Bitcoin Open Source Software","duration":12157},
                {"id":"DXn4KolDiMY","title":"5 Years In Prison For Building A Bitcoin Wallet | Lauren Rodriguez","duration":3766},
                {"id":"1rYg2-URBKA","title":"240. Preston Pysh","duration":5509},
                {"id":"GCjTQTx8bdo","title":"Cameron's original interest in BTC","duration":53},
                {"id":"nMicPEQM4HY","title":"Peter McCormack: Bitcoin Maximalism is Dead (Long Live Bitcoin Maximalism)","duration":1542},
                {"id":"-otqTQAtztI","title":"Bitcoin, The Fed, & The End Of The World | Magoo","duration":3188},
                {"id":"1jZQNo_rRsQ","title":"Saifedean: Bitcoin Poised for Cycle Top? Corporate Treasuries, Wealth Concentration & Gold Standard","duration":1763},
                {"id":"JuZZmxrt6SI","title":"UNLOCKING $1 TRILLION to Send Bitcoin Back to $120K!","duration":548},
                {"id":"iYVMX0zdp64","title":"The BITCOIN Act of 2024 with Senator Cynthia Lummis - The Bitcoin Layer","duration":1976},
                {"id":"KLi_u6r0vYU","title":"Jerome Powell CANNOT Fix Inflation","duration":1004},
                {"id":"CuAkiWJWD0A","title":"Curtis Green - Bitcoin has gone from spend to HODL. Is it a net positive?","duration":40},
                {"id":"ksrx66uAV6k","title":"The Entity That Controls AI Controls the World w/ Toufi Saliba","duration":5742},
                {"id":"6EdlQq-7OB4","title":"How Private Equity Is Coming to Crypto's Most Profitable Companies","duration":4119},
                {"id":"JaMJi1_1tkA","title":"Bitcoin Rap Battle Debate: Hamilton vs. Satoshi (BITCOIN GIVEAWAY) [feat. EpicLloyd, TimDeLaGhetto]","duration":362},
                {"id":"0oKW_NChFPk","title":"Bitcoin vs Crypto: Svetski vs Bitboy - Bitcoin Magazine LIVE #25","duration":8541},
                {"id":"ZNa8QZOaPSM","title":"Bitcoin's lack of innovation","duration":31},
                {"id":"4t9DzDr6qBk","title":"The Bitcoin Treasury Strategy w/ Andrew Kang, Eric Semler, Simon Gerovich, and Dylan  LeClair","duration":2568},
                {"id":"1U7MnwPVuvc","title":"Guns N' Glazes | THE BITCOIN BRIEF 72","duration":3363},
                {"id":"HGAMuaQ1LZg","title":"Bitcoin and AI w/ Guy Swann (BTC148)","duration":6335},
                {"id":"8cDypB_GSp8","title":"WHY ARE WE BULLISH? Tomer Strolight, Brad Mills, Nik Bhatia","duration":6385},
                {"id":"UPqXkAmygHQ","title":"Worldcoin: The GAP In Consciousness #DigitalID #1984 #MakeOrwellFiction #cryptoscam","duration":316},
                {"id":"DnHOxZgvdWM","title":"How the IMF & World Bank Exploit Poor Countries with Alex Gladstein | What Bitcoin Did","duration":5289},
                {"id":"cX4Zw-woels","title":"Trump Tariffs Netanyahu","duration":6456},
                {"id":"dn57JPSRmfE","title":"Ups and Downs | THE BITCOIN BRIEF 71","duration":3480},
                {"id":"DO5-zt-SpeA","title":"Bitcoin & Real Estate w/ Leon Wankum (BTC164)","duration":3318},
                {"id":"zDzEyhF2G8U","title":"John Carvalho - Redefine Bitcoin's Base Unit","duration":34},
                {"id":"0anySRVB404","title":"Luke Gromen Global Macro and Bitcoin Q1 2025 (BTC215)","duration":3948},
                {"id":"WovyQkSdONI","title":"Is AGI Here? Clawdbot, Local AI Agent Swarms w/ Pablo Fernandez & Trey Sellers (TECH014)","duration":4222},
                {"id":"mz4gfO1qo8Y","title":"Lyn Alden: Bitcoin's Energy Usage Isn't a Problem. Here's Why. (Twitter Spaces Live Stream)","duration":8549},
                {"id":"8m7YyAfcubs","title":"Bitcoin Adoption Runs On Imitation","duration":54},
                {"id":"nM504_upkZg","title":"Banks Silently Closed The Exit","duration":985},
                {"id":"LBsYqETjc8c","title":"Empowering Bitcoin Literacy: SHAmory's Educational Journey","duration":791},
                {"id":"qxFgDkiwUJc","title":"Jimmy Song & Anita Posch | Swan Signal Live | EP 122","duration":3577},
                {"id":"0QldDMrQms0","title":"If You Only Watch One Bitcoin Video, Make It This","duration":881},
                {"id":"aO-KlhO-cyQ","title":"The Hidden War on Your Meat Supply Nobody Wants You to Know About w/ Casey Parker","duration":4243},
                {"id":"RA2cvfdwy0I","title":"Bitcoin & Macro Overview Q4 2025 w/ Luke Gromen (BTC254)","duration":3700},
                {"id":"jYzKvJiKnO0","title":"Peptides, Fasting, and the Future of Longevity w/ Miguel & Carlos","duration":10491},
                {"id":"77W1Plqdges","title":"Seed Oils Are Terrible For Skin Cells","duration":43},
                {"id":"K_Wh8PgaK48","title":"Hearts On Fire | PMM 17","duration":3219},
                {"id":"unCR7k3-aoE","title":"Bitcoin OGs EXPOSE Billionaires' Lies About Bitcoin and Ethereum - Robert Breedlove Explains","duration":916},
                {"id":"nQ0s2exh9x8","title":"Corporations Just Surpassed ETFs in Bitcoin Buying-Here's What It Means with Matthew Sigel - The Bitcoin Layer","duration":1629},
                {"id":"p0tvK8smhrc","title":"The US's Economic Hitman w/ John Perkins (BTC181)","duration":3128},
                {"id":"YQtkZsStZh4","title":"God Bless Bitcoin w/ Jeff Booth, Mark Moss, Stephan Livera, and Brian Dixon","duration":1836},
                {"id":"jWyPRfEQdaA","title":"Is Vitalik Buterin Still a Bitcoiner?","duration":194},
                {"id":"r3-N5_UFHq8","title":"Bitcoin spam debates with Charlie Spears | SLP724","duration":3299},
                {"id":"Bh7LBF9cU6w","title":"Stock-to-Flow & Power Law Debate Marathon","duration":736},
                {"id":"hTsJHCFG6n0","title":"76. Homeschooling with Daniel Prince​ | The Bitcoin Standard Podcast","duration":5389},
                {"id":"jTpCzXOUiUk","title":"Luke Dashjr Pleading Poverty (Ben Arc, S16 E17)","duration":366},
                {"id":"UzGuqZP9DeA","title":"The Hidden Financial Mechanism Nobody Understands Yet w/ Radu Chichi","duration":5966},
                {"id":"NW-UeY5jgIo","title":"TRILLIONS into Bitcoin when the Shutdown Ends!","duration":995},
                {"id":"ITvc8lgpfzk","title":"Twitter Spaces: Wizards Weekly with Peter Brandt & JK","duration":1741},
                {"id":"G1Izg_b17mw","title":"Bitcoin  The ALWAYS LIQUID 24 7 Crypto Market!","duration":15},
                {"id":"Xs4YtUqhF-8","title":"Bitcoin Freedom vs. Government Servitude - Bitcoin Magazine Twitter Spaces","duration":9328},
                {"id":"0W2jEedynbc","title":"Bitcoin & The End of the Dollar System w/ Luke Gromen | What Bitcoin Did","duration":4558},
                {"id":"GgLUbr4mzfg","title":"How The Dollar Became The Global Reserve Currency - Bitcoin Spaces Live with Alex Gladstein","duration":4477},
                {"id":"BP7er6VYab0","title":"Bitcoin Security with the Frostsnap Team | FREEDOM TECH FRIDAY 35","duration":3616},
                {"id":"Hz-KrFDpRsk","title":"The Bitcoin Revolution w/ Jack Mallers & Dylan LeClair","duration":2874},
                {"id":"lmPmRxurssU","title":"Bitcoin vs. Crypto: Why Bitcoin Only - Twitter Spaces","duration":6588},
                {"id":"5mtuEf3zxTE","title":"Monthly Tech Round-up: Datacenters in Space, AI5 Chip, Tesla Versus Waymo w/ Seb Bunney (TECH012)","duration":4203},
                {"id":"tta5XMvqVv0","title":"Max Keiser and Daniel Prince - Swan Signal Live - A Bitcoin Show - E48","duration":4825},
                {"id":"4Q1AasS6HLU","title":"Bitcoin 101 - Stephan Livera Podcast","duration":799},
                {"id":"3uPJzCbO5eo","title":"Bitcoin's iPhone Moment - STRC & the Conversion of the Financial System | Ep 268","duration":6433},
                {"id":"AE5Qj9WEp7A","title":"Chat_142 - Ai, Bitcoin and 5th Generation Warfare with Jordan and Average Gary","duration":7688},
                {"id":"GHJJbKCgQY8","title":"Good times and Friday fireside chat with Magoo - Crypto World Radio #bitcoin #crypto","duration":10471},
                {"id":"MDNq9bfmIpA","title":"Trump Just Made Everyone That Has Bitcoin RICH!","duration":650},
                {"id":"_jmRAaN3HyY","title":"In 18 minutes, I'll show you how to retire AT LEAST a decade earlier with Bitcoin","duration":1119},
                {"id":"y5e-PhaGm_4","title":"Orange Pill App Twitter Spaces Jan 2023 - Jeff Booth, Breedlove, Knut, Daniel Prince, BTC Sessions","duration":7100},
                {"id":"JF_6r7DYnLw","title":"What Institutions Get Wrong About Bitcoin with Ed Juline | BIS #197","duration":4160},
                {"id":"KrzgMJZvA1U","title":"SLP115 Trace Mayer - Bitcoin as Ultimate Collateral","duration":3916},
                {"id":"nc72lrV1mms","title":"Escaping the technocracy w/ Gabriel Custodiet and UrbanHacker","duration":3504},
                {"id":"1aJqI6ONIQI","title":"If You Don't Understand Bitcoin, You Don't Understand Money","duration":821},
                {"id":"qdx_alPrmVY","title":"Why El Salvador Made Bitcoin Legal Tender with President Nayib Bukele | What Bitcoin Did","duration":3962},
                {"id":"f2OyRTu8x3A","title":"The Real Robotics Timeline w/ Ken Goldberg (TECH010)","duration":3435},
                {"id":"K0yESdK22Aw","title":"Guy Swann - Bitcoin An Unstoppable Force - BitBlockBoom","duration":1952},
                {"id":"UFS4QYLKSAM","title":"Bitcoin Mastermind Q2 2025 w/ Joe Carlasare, Jeff Ross, & American HODL (BTC244)","duration":4874},
                {"id":"D5Z-L-3svyo","title":"Radio Silent Play Twitter Spaces 10/24/21 - PART 1","duration":1869},
                {"id":"b-HaISUDvCc","title":"The Bitcoin Brain with Tomer Strolight | Peter McCormack","duration":4100},
                {"id":"eUOTOWCxoxM","title":"Why Centralization Always Fails with Nick Hudson | Bitcoin Infinity Show #196","duration":5304},
                {"id":"tbCVXyUGO3o","title":"I Bought This Instead of Bitcoin - Mark Moss","duration":387},
                {"id":"CjCKDojQLYI","title":"This Has Only Happened 4 Times In 50 Years. This Time Bitcoin Exists.","duration":970},
                {"id":"Yc3nuGCZKB0","title":"UTXOs, Spam & Bitcoin's Integrity with Martin Habovstiak | SLP729","duration":3510},
                {"id":"UDYk9bVlvTo","title":"Improving SimpleX w/ Evgeny from SimpleX and Daniel Keller from Flux","duration":4065},
                {"id":"ti28Lq5hSVA","title":"Bitcoin, Chapter 11 & The Great Depression of the 2020s Update | X Space AMA","duration":3879},
                {"id":"vbPsIS31yuc","title":"Can AI be private? w/ Marks from OpenSecret","duration":3287},
                {"id":"fekdmit9sgE","title":"Get your money out of the system. - Godfrey Bloom","duration":60},
                {"id":"CEkcV28fdKY","title":"Max Keiser and Stacy Herbert Interview - Bitcoin Magazine LIVE #36","duration":9656},
                {"id":"Ledb57Gv3oQ","title":"Government Out of Control w/ Dave Smith, Luke Gromen, Mark Moss and Guy Swann","duration":1988},
                {"id":"ngZKzSjrfo4","title":"Why Hookup Culture Is Leaving an Entire Generation Empty w/ Stefanos Sifandos","duration":6221},
                {"id":"b_6dQ6SjSO0","title":"🚨SPECIAL EDITION: Citrea Trusted Setup Ceremony - LIVE from a Secret Location! 🚨","duration":1492},
                {"id":"M2lkYHuAskk","title":"Strive: Amplified Bitcoin Exposure Engine with Matt Cole | SLP710","duration":4136},
                {"id":"8z-A-gsMNjA","title":"The Stoics Figured Out Bitcoin 2,000 Years Before Satoshi | Connor Dolan | #269","duration":4987},
                {"id":"chRpbV2_6cI","title":"What Bitcoin Did with Jack Mallers, Matt Odell, & Harry Sudock","duration":9557},
                {"id":"WqZVm-hZnPM","title":"#Bitcoin as Trojan Horse in strategic reserve debate? #usbitcoinstrategicreserve #politics","duration":56},
                {"id":"K-_G8FapFqg","title":"Why California Should Lead with Bitcoin","duration":52},
                {"id":"aMVi5L70rMI","title":"Neutral Reserve Assets and AI to Drive Bitcoin #gold #bitcoin","duration":91},
                {"id":"KeTzV0kP2S4","title":"Has the Debt Spiral Started? | Luke Gromen | What Bitcoin Did","duration":4806},
                {"id":"HwNSykjO-gI","title":"Lyn Alden on Changing World Order: Reserve Currency Tradeoffs, Trade Deficits & U.S. Hegemony Shift","duration":3629},
                {"id":"rZRN8Z9WN0s","title":"The System Is Rigged & Bitcoin Is The Exit | Simon Dixon | What Bitcoin Did","duration":6505},
                {"id":"UldXIvXatY8","title":"Bitcoin Treasury Companies: Risk, Reward & mNAV with Blake Canfield | SLP666","duration":4671},
                {"id":"NSyfxI2wWC0","title":"The $60 Billion Bitcoin Bet | Strategy CEO Phong Le | What Bitcoin Did","duration":4576},
                {"id":"6WxdkRk8cs4","title":"Bitcoin for Everybody w/ Parker Lewis & Stephan Livera: Saylor Live Sessions","duration":3706},
                {"id":"iYLbtVutcDQ","title":"HOUSING MARKET CRISIS Is Developing with Melody Wright","duration":2044},
                {"id":"eSGqBMSZioc","title":"Bitcoin Veterans: GET ON THE MISSION (Official Documentary)","duration":2593},
                {"id":"XSqpDgF5TXY","title":"is this the next bitcoin hub??","duration":83},
                {"id":"NAG9gD5zC2w","title":"Lobby groups and influence with Susie Ward on #tpbpod #podcast #bitcoin","duration":48},
                {"id":"bzzFBvzONBo","title":"Bitcoin Mastermind Q1 2026 w/ Joe Carlasare, Jeff Ross, & American HODL (BTC257)","duration":4878},
                {"id":"biotJvfDmIM","title":"He Was Right About Q1. His Q2 Warning Changes Everything.","duration":5022},
                {"id":"VRA8VIsO-rQ","title":"Jeff Booth | AI, Bitcoin, & The Collapse Of The Fiat Economy | What Bitcoin Did","duration":4242},
                {"id":"G3KMjMkf9V4","title":"$1B monthly volume on lightning with Sam Wouters | SLP725","duration":3235},
                {"id":"c5mYqPZyvQY","title":"Taunton Firefighters make history adding #Bitcoin to balance sheet #firefighter #union #progressive","duration":58},
                {"id":"T6yiueyLYNo","title":"Proof of Work vs Proof of Stake - BM Pro Twitter Spaces","duration":4946},
                {"id":"FMWIWKG7eBs","title":"Bitcoin Marketing  Know Your Audience's Needs First!","duration":30},
                {"id":"lXaCwTrYQ8g","title":"TPB106 - What Happened to The Progressive Movement? with Margot Paez","duration":7058},
                {"id":"qhtTBFUaoc8","title":"The AI Future Is Overhyped. Why Bitcoin Still Matters | Junseth","duration":6011},
                {"id":"N_qo_-QRqAM","title":"No More 4-Year Cycles? - Stephan Livera","duration":4128},
                {"id":"hC-I9YXEP_c","title":"The System Cannot Survive What's Coming | Jeff Booth","duration":4285},
                {"id":"Qc6-Ra2wWc8","title":"Bitcoin Children's Books & Card Game With Scott Sibley of SHAMORY w/ @jarrettcarpenter | E81 - MTB","duration":1860},
                {"id":"Qf-wkbWe2uk","title":"Saifedean Ammous: The Fiat Endgame, Strategic Reserves and Stablecoins | The Culture Bit","duration":3319},
                {"id":"wrFMBZ5cPZI","title":"Breaking FUD in Neuchâtel, November 16th 2023 (Vlad Costea)","duration":2852},
                {"id":"LxkwUXo5VUQ","title":"They're Panicking. We're Not.","duration":3403},
                {"id":"salvzDUGS_w","title":"Low Testosterone Is a Silent Epidemic w/ Miguel & Carlos","duration":9725},
                {"id":"aN2G0Uvahf8","title":"Beginner's Guide #4: What is Bitcoin with Stephan Livera","duration":3437},
                {"id":"_8bmmgOJsIQ","title":"Wall Street's Secret Plan to Suppress Bitcoin Prices for US Government Accumulation | Vince Lanci","duration":6279},
                {"id":"gXgaoltJPMc","title":"Bitcoin Artifact Story That Changed Everything w/ Coin Dad","duration":7299},
                {"id":"HrehEWYj16s","title":"Robert Breedlove: Philosophy of Bitcoin from First Principles - Lex Fridman","duration":14629},
                {"id":"Ut8keXlTyjw","title":"Bitcoin Mastermind Q3 2025 w/ Joe Carlasare, Jeff Ross, & American HODL (BTC252)","duration":5014},
                {"id":"sab9Qc-HU-Y","title":"Vitalik Buterin: Ethereum's Scaling Plans & Challenges","duration":76},
                {"id":"6NbBknQJgNI","title":"The Last Word on Bitcoin's Energy Consumption - By Nic Carter | Bitcoin Audible","duration":733},
                {"id":"yLl00j5p8Nc","title":"Mark Cuban debating #Bitcoin on spaces","duration":1114},
                {"id":"zYUspccYxXA","title":"The Real Reason Bitcoiners are Joining Climate Protests","duration":5405},
                {"id":"gVnEWAR-06s","title":"The Fed Pivot, Bitcoin vs Gold & The Return Of QE | Lawrence Lepard | What Bitcoin Did","duration":4503},
                {"id":"1L1IO2Bgmrc","title":"BTCPayServer Twitter Spaces - How to become a #Bitcoin contributor","duration":4385},
                {"id":"G6QIFIRsBno","title":"Bitcoin SURGES After Geopolitical Events  Outperforming SPY & Gold!","duration":27},
                {"id":"3YuscY1L1zE","title":"Why You Should Be a Bitcoin Maximalist","duration":541},
                {"id":"9fRzhDURCro","title":"Guy Swann: Rotten Money, Rotten Society (BitBlockBoom 2024)","duration":2273},
                {"id":"M67oEW2zKkI","title":"S17 E18: Dr. K (Karl Kreder) on Quai & Scaling Proof of Work","duration":13678},
                {"id":"h-JBUhG2nrw","title":"Mark Yusko: The Bitcoin Price is a Liar - Why to Watch Gold | Bitcoin Magazine Podcast","duration":5596},
                {"id":"E6Fu34imwvM","title":"Twitter spaces AMA Recording 08.11.2022 | emergency broadcast FTX Fall","duration":5274},
                {"id":"LnjVY0bqt_c","title":"Bitcoin's iPhone Moment - Two Financial Systems Are Running Simultaneously | Ep 268 Clip","duration":1224},
                {"id":"QDqvxXCOWLY","title":"The Dollar Illusion That's Fooling the World. Here's the Truth. | Nik Bhatia | #271","duration":5427},
                {"id":"WLm9wPw8b5U","title":"S17 E15: Danny & Chad on OPNET & ETH Smart Contracts on Bitcoin Layer 1","duration":6400},
                {"id":"zflAVKCaPfU","title":"Why Poor People Rarely Buy Bitcoin","duration":388},
                {"id":"TgjFQpFQ-5A","title":"Your Wealth Is Melting: Freeze It with Bitcoin - The Bitcoin Layer","duration":2301},
                {"id":"wckGA8C7pYs","title":"MicroStrategy 2025 w/ Jeff Walton (BTC217)","duration":3808},
                {"id":"b_3T5S1li90","title":"NumoPay: Tap-to-Pay Bitcoin with Calle | SLP728","duration":2641},
                {"id":"2OHTUDACasc","title":"Mark Cuban talking bitcoin on Twitter Spaces W/ Preston Pysh, Pomp, Peter McCormack + 15K listeners","duration":5663},
                {"id":"YqCI76V75vc","title":"The Biggest Exit Liquidity Trap In History Is Being Set Right Now","duration":4361},
                {"id":"QT_YDxTl1FQ","title":"Jack Mallers: Bitcoin Maximalist Post-GENIUS Act","duration":1621},
                {"id":"j89aAqfezX8","title":"Saving Bedford - Peter McCormack","duration":6434},
                {"id":"B3gTk4M8ZKY","title":"The Rich Own Nothing, Except Bitcoin","duration":917},
                {"id":"XQWyq0ch0c4","title":"What we Learn from Occupy Wallstreet for the Upcoming Election with Alan Minsky","duration":5598},
                {"id":"X7ua58iwcd4","title":"OpenClaw and Self Sovereign AI w/ Alex Gladstein & Justin Moon (TECH015)","duration":3929},
                {"id":"-hgf7tdhfGk","title":"079. The Second Renaissance","duration":5758},
                {"id":"-FsGZqLQlXk","title":"SLP86 PlanB - Frontrunning the Bitcoin Halvening?","duration":4886},
                {"id":"K3gTLBMsmNU","title":"Microstrategy and Five Issues It MUST Overcome or Else...","duration":744},
                {"id":"qtOPcQTiPBM","title":"76. Thomas Massie vs Donald Trump","duration":6671},
                {"id":"HUcjmoi7zm4","title":"Retire with Bitcoin: Leveraging IRAs, Custody, and Long-Term Wealth Strategies - The Bitcoin Layer","duration":1347},
                {"id":"DzIhnqW11yA","title":"What does the world look like at $10,000,000 BTC? with Fred Krueger | Joe Burnett","duration":4408},
                {"id":"jisxBD2fhFs","title":"Where is the retail Bitcoin investor? BitcoinIRA.com/natalie","duration":43},
                {"id":"z93Y2ueLTZk","title":"Cluster Mempool Explained with Pieter Wuille | SLP730","duration":3172},
                {"id":"K_RXWIjIwpo","title":"Bitcoin Will Be Worth Trillions?! | Saifedean Ammous","duration":4195},
                {"id":"XJU8r6WiipM","title":"Bitcoin vs Gold - Response to Peter Schiff","duration":1690},
                {"id":"NZYc1yTj584","title":"Leaks and Larceny | THE BITCOIN BRIEF 73","duration":3681},
                {"id":"ANtyYqcXR9w","title":"Marty Bent: Tales from The Crypt - A Bitcoin Podcast","duration":5936},
                {"id":"yWTLczpO808","title":"RISE of the American Empire with Brent Johnson - The Bitcoin Layer","duration":3428},
                {"id":"cNtIuN3717U","title":"Why the Next 12 Months Will Be HUGE for Bitcoin! - Preston Pysh TFTC Ep. 528","duration":4584},
                {"id":"5knRPPlLCVg","title":"Burner vs other wallets","duration":42},
                {"id":"t-7GGhmipt0","title":"Operation Chokepoint 2.0: The Fed's Secret War on Crypto with Caitlin Long","duration":3498},
                {"id":"FqWGQZJevH0","title":"245. Strike with Jack Mallers","duration":5629},
                {"id":"TUO10-HcdvY","title":"DEBATE: Bitcoin Ossification | Lugano's Plan ₿ Forum 2024","duration":2923},
                {"id":"u5I76GF5gMI","title":"CFA EXPLAINS: 3 lessons to get rich with Bitcoin","duration":676},
                {"id":"_J_QXAQ8vxk","title":"Bitcoin for Beginners Q&A with Guy Swann (Clubhouse Audio Stream)","duration":9875},
                {"id":"BbgR5ceiqL4","title":"Is MSTR a Ponzi? | Lyn Alden & Andy Constan | What Bitcoin Did","duration":6139},
                {"id":"sTxdYxGqYDo","title":"Stephan Livera: Why Bitcoin Only","duration":1708},
                {"id":"aADg9rQFWxc","title":"Bitcoin at $75k...next Stop $100k?","duration":5291},
                {"id":"vx4n9dxVHHM","title":"BR097 - Cove Wallet, Harbor, Sparrow, JoinMarket, Coinbase Breach + MORE ft. Praveen, Ben & Paul","duration":4368},
                {"id":"LqM-D9vXX0A","title":"He Gave Warehouse Workers Bitcoin Instead of Cash Bonuses, Then Turnover Dropped From 108% to 17%!","duration":1559},
                {"id":"A2xszwHf3Zc","title":"1 BTC = ∞ USD","duration":50},
                {"id":"Lyu5CfME3e8","title":"StartOS v0.4 with CryptoSquid | FREEDOM TECH FRIDAY 36","duration":3546},
                {"id":"re5CqaZXfCI","title":"Deflationary Crunch, The Big Print & Buying Bitcoin Back Lower w/ Luke Gromen | Joe Burnett","duration":3591},
                {"id":"d-H_Q100u74","title":"SHAmory CARD GAME and COOL KIDS PRODUCTS w/ Scott and Mallory Sibley #Bitcoin","duration":1404},
                {"id":"LGHbrj53qtY","title":"Prof Jiang doesn't understand Bitcoin","duration":2221},
                {"id":"_0zMFfvXblA","title":"Pomp Podcast #248: Preston Pysh Explains Why Bitcoin's Volatility is a Feature, Not a Bug","duration":5066},
                {"id":"Xv9TnieldbM","title":"AI, Robots & Inflation Fuel Socialism, Is Quantum a Threat to Bitcoin? | Preston Pysh & Larry Lepard","duration":5279},
                {"id":"whWGMiE7hbs","title":"Why do so many people lose money when they buy Bitcoin?","duration":690},
                {"id":"HR-D-3xsRls","title":"How to get more Bitcoin if you own real estate","duration":680},
                {"id":"UWljJr7tl9M","title":"While You Were Watching Iran, They Changed Your Money Forever","duration":1986},
                {"id":"5KlgTxpodD4","title":"Macro Analysis, Financial Fragility and Bitcoin as the End Game with Preston Pysh","duration":3523},
                {"id":"TAfOwAas250","title":"Forensic Accountant Just Exposed A Trillion Dollar Crisis | Nick Nemeth","duration":4651},
                {"id":"oieuMELB-CI","title":"Fluffy Pony - AI Agents money","duration":72},
                {"id":"W967FCvarrw","title":"Satoshi is AI? Trump Time Traveling, Fact or Fiction? #Bitcoin #crypto #timetravel #trump","duration":485},
                {"id":"WiB2bgXcMuQ","title":"Bitcoin Will Make Crazy Politicians Powerless","duration":1852},
                {"id":"3j8iFIZ4TGM","title":"I Went Down a Eurodollar Rabbit Hole with AI","duration":1969},
                {"id":"uEFWJ4eB8Bc","title":"Bitcoin Card Game Rated Best of Stem 2021 | Scott and Mallory Sibley | Shamory","duration":1629},
                {"id":"tnLS6oI9K1k","title":"Twitter Space AMA with Simon Dixon & Plan C - Discussing Celsius Chapter 11 and more | 09.09.2022","duration":11222},
                {"id":"RRnp_3lDhaY","title":"JP Morgan Just Cut Off China's Silver Supply (Here's What Happens Next) | Vince Lanci","duration":3896},
                {"id":"2ZaMzWZyXe8","title":"Wall Street Meets Bitcoin: Orange-Pilling Finance - Strive CEO","duration":1348},
                {"id":"z-FfHGQXRG4","title":"BR019 - Proof of Keys Day Twitter Space ft. Lopp, Craig Raw, Lazy Ninja, mshodl, Rijndael & guests","duration":9192},
                {"id":"gnHKuak0m0k","title":"The Bitcoin Retirement Accelerator Cohort - LIMITED SPOTS (If you're 40+, this is for you!)","duration":2206},
                {"id":"IODFNfSIesk","title":"Former Combat Vet On Bitcoin, Gold, And Firearms w/ Alex Stanczyk","duration":5730},
                {"id":"HQHg8uCbiQk","title":"Someone Quietly ACCELERATED The Bitcoin Supply Shock","duration":1812},
                {"id":"EdrAOkUoE-E","title":"Will Stablecoins help in Bitcoin adoption? with Gareth Grobler | SLP726","duration":2546},
                {"id":"VrIJgf5IEhY","title":"This Is The Macro Reset | Nik Bhatia","duration":5093},
                {"id":"9DuhDgqx21w","title":"Peter Schiff: Bitcoin Strategy is a Fraud","duration":3431},
                {"id":"49Zbuhl-5cE","title":"Is Bitcoin Warfare? With Jason Lowery | What Bitcoin Did","duration":8580},
                {"id":"nhLBbXqQG9Y","title":"Surveil Yourself with Stealth | FREEDOM TECH FRIDAY 33","duration":3594},
                {"id":"ivdnEb45x6w","title":"Why 21M Bitcoin Won't Exist Until 2140","duration":83},
                {"id":"WlAw1S366HE","title":"Why Was Charlie Kirk Killed and the Impact to Turning Point USA","duration":1481},
                {"id":"Xhnd8rL-3YA","title":"Guy Swann & Vijay Boyapati | Swan Signal | EP 112","duration":4118},
                {"id":"P3SrVRiEn9k","title":"Maximalism and The Right To Own Your Money - Twitter Spaces","duration":5720},
                {"id":"lEgxtmKld0I","title":"The Hidden System Running the World and How You Can Escape It with Simon Dixon","duration":4941},
                {"id":"s7-l7gzm_PE","title":"Bitcoin & Theoretical Physics w/ Jeff Booth, Jack & Nick (BTC259)","duration":4657},
                {"id":"BNg4Mo6B4cM","title":"The Revenge Of The Nodes with Aaron Segal and Greg Foss - Twitter Spaces","duration":7328},
                {"id":"VxZUGJGw9h0","title":"Vlad Costea on Bitcoin and Inflation in Romania, TcConf 2019, Cluj, Romania","duration":1994},
                {"id":"dkph5lF2KmA","title":"This CEO Just Raised $750 Million to Buy Bitcoin With ZERO Debt","duration":1922},
                {"id":"wognvydJlWk","title":"Scientist Reveals: Bitcoin is Kinda Cringe?","duration":3773},
                {"id":"HBk6nH7DYqE","title":"Dylan LeClair on Metaplanet's Bitcoin Bet: How Corporate Treasuries are Transforming Global Finance","duration":3154},
                {"id":"2i16_gO45mQ","title":"I bought all my gear with BTC","duration":34},
                {"id":"Rl6kAlYZGQc","title":"The potential for hyperinflation w/ EJ Antoni #bitcoin #inflation #tftc #podcast #economics","duration":60},
                {"id":"1T6E7ktmNSg","title":"Strategy's CEO: This Product Grew Faster Than the iPhone - and It's Paying 11.5% Yield to Everyone","duration":2186},
                {"id":"WalXMUhstac","title":"Long-Term Holders Driving the Bitcoin Market w/ Dylan LeClair (BTC127)","duration":4556},
                {"id":"rGKhRObDRdA","title":"Iran Isn't About Oil... It's About the British Empire | Tom Luongo","duration":6540},
                {"id":"gnfSKr4Rdvc","title":"Buy #Bitcoin, Study Bitcoin, Hold Bitcoin","duration":60},
                {"id":"s24B6PxtshQ","title":"Vlad Costea on Bitcoin Maximalism PoW Summit 2023, Prague","duration":2164},
                {"id":"KzahdJi_tso","title":"Bitcoin ETF and All Time High Price Talk with Dylan LeClair and Sam Rule - Twitter Spaces","duration":4291},
                {"id":"SLJvZFlQQmc","title":"Why Everyone Is Wrong About Inflation | Ansel Lindner","duration":3532},
                {"id":"w8JXdYmllZ4","title":"US dollars on Bitcoin Lightning w/ Luke Gromen & Preston Pysh (BTC220)","duration":2512},
                {"id":"-3D--AjAhIw","title":"The Bank-State War Machine, Counter-Elites & Digital Slavery with Natalie Smolenski","duration":2615},
                {"id":"a6axEr17jAw","title":"Corrupt academics and politicians w/ Peter St Onge #bitcoin #freedomtech #freedomofspeech #economics","duration":60},
                {"id":"h2SC_H-7qnk","title":"Meet The Pro-Bitcoin Democrat Running for Governor of California","duration":3906},
                {"id":"TabQtyUfgfc","title":"Phil Potter on Bitfinex and Tether","duration":6094},
                {"id":"gUao53ovces","title":"Opting out of the #Chinese system by using #Bitcoin is an act of protest","duration":58},
                {"id":"oMDHTVwSRHI","title":"1 Bitcoin Is All You Need","duration":1233},
                {"id":"gUWl9HSEdiE","title":"Bitcoin  Secure Your Future & Bypass the State for Generations","duration":37},
                {"id":"g6FVDJsCGE8","title":"Bitcoin Just Killed Private Equity","duration":3799}
            ]
        },
        {
            "id": "politics-regulation",
            "name": "Politics & Regulation",
            "emoji": "🏛️",
            "desc": "Government policy, ETFs & legal battles",
            "color": "#64748b",
            "videos": [
                {"id":"R-Rd12saPh8","title":"The Fight for Bitcoin in America","duration":2718},
                {"id":"pBMnPec4AC4","title":"Congressman Tom Emmer SLAMS SEC Chair Gary Gensler","duration":341},
                {"id":"lwJpvqMeLJg","title":"Dennis Porter - Bitcoin Breaking Records","duration":341},
                {"id":"h_oAr4wn7M4","title":"House Financial Services Committee Hearing: Oversight of the SEC","duration":19400},
                {"id":"kN5codbLCCY","title":"Bitcoin Regulation: National Security Issue","duration":740},
                {"id":"vr1M2anvbWU","title":"Trump's Bitcoin Reserve Plan Power Move or Trap? | The Blockchain Report","duration":679},
                {"id":"iOrbrNwUtfI","title":"SEC Clears path to CBDC","duration":214},
                {"id":"jjl_kp9v-Eg","title":"Washington's Crypto Awakening: The Lawmaker Town Hall","duration":3188},
                {"id":"Ef5flMEKmic","title":"What Falling Gas Prices Signal for Bitcoin & The 2026 Midterm Elections","duration":3370},
                {"id":"c1l7EFvyTyM","title":"Gary Gensler GRILLED on Crypto at Congress Committee Hearing","duration":6651},
                {"id":"HjnOMkbLOf8","title":"EP15: Bitcoin is Good, pt. 2 w/ Grant McCarty, Co-Executive Director - Bitcoin Policy Institute","duration":3004},
                {"id":"7ZSpFWEd-x0","title":"Gary Gensler Testifies - Left SHAKING After Crypto Questions","duration":3155},
                {"id":"jMg3U-51Obw","title":"GOP Rep Unveils Bold Crypto Tax Twist - No Capital Gains","duration":200},
                {"id":"kJEzpYjVsB4","title":"Trump's Policies - Strategic Bitcoin Reserve & Stablecoin Law","duration":823},
                {"id":"AXKL48mnU0E","title":"Japan's Historic Election, Yen Defense, & Why Bitcoin Is Still a Liquidity Trade - The Bitcoin Layer","duration":1938},
                {"id":"_E_5Hk-vRj8","title":"Bitcoin U.S. Reserve in 30 days? w/ Dennis Porter","duration":1410},
                {"id":"12zBLvoVRFQ","title":"Element Zero","duration":1401},
                {"id":"pCDyEsZJVLI","title":"America's Grand Strategy: Repo, China, Jensen Huang, & Bitcoin's Next Move","duration":3239},
                {"id":"5VczGHHbDTQ","title":"The AI-Pentagon War That Every Bitcoiner Needs to Understand","duration":1733},
                {"id":"V82emH4q6o0","title":"Claude Eclipses Trump as the Most Important Force in Global Macro - The Bitcoin Layer","duration":2697},
                {"id":"7lBVDgMkdiA","title":"Why Agentic Payments are BULLISH for Bitcoin Tax Exemption | Bitcoin Policy Hour Ep 32","duration":3655},
                {"id":"n4AcHMN4veo","title":"Congresswoman Buys $250K Bitcoin: Insider Trading?","duration":33},
                {"id":"nDSPY2XMmL0","title":"New Hampshire's Strategic Crypto Reserve - What to Know","duration":416},
                {"id":"78xSNqLfJDA","title":"Dem Lawmaker Urges Yellen To Crack Down On Crypto Bros","duration":301},
                {"id":"BwhyCmnRlJo","title":"CZ Reveals What US Bitcoin Policy Is Doing to the Global Market","duration":110},
                {"id":"DJhgLMMAPHQ","title":"Trump Nominates Crypto Advocate Paul Atkins as SEC Chair","duration":41},
                {"id":"YqWoj2eFDp4","title":"Right To Mine: Effective Bitcoin Policy - Dennis Porter","duration":1720},
                {"id":"tja-5y_FvgY","title":"Regulatory Shackles Are Off","duration":1567},
                {"id":"Yo8WskjkELU","title":"Unmasking Satoshi Is Bad for Bitcoin | Bitcoin Policy Hour Episode 34","duration":3831},
                {"id":"WSBQunQ2jJA","title":"The Time Has Come - El Salvador Makes Bitcoin Legal Tender","duration":90},
                {"id":"WO6Ww-MLQGs","title":"Wyoming Senator Cynthia Lummis - Texas Blockchain Summit","duration":1359},
                {"id":"-C13zU-ZsT8","title":"EUROPEAN BREAKING POINT: Italy Takes Gold Back, Sovereign Bond Crisis, & Bitcoin w/ Matt Dines","duration":3099},
                {"id":"zmGKUflR6lc","title":"The Implications of Outlawing Bitcoin (First Principles) - Article by Gigi","duration":576},
                {"id":"MuobSz7534s","title":"Paving the Frontier - Dennis Porter","duration":3119},
                {"id":"yOtZaPuVpTE","title":"THE MOST IMPORTANT DOCUMENT OF 2025: What the New U.S. National Security Strategy Means for Markets - The Bitcoin Layer","duration":3598},
                {"id":"yuBTr3jLFQQ","title":"INSIDE THE SELLOFF: Bitcoin, Sanctions, & The Liquidity Drain - The Bitcoin Layer","duration":1631},
                {"id":"m3es0G4m_R4","title":"Sen. Lummis Questions Gary Gensler (SEC) and Rohit Chopra (CFPB)","duration":560},
                {"id":"YwZseBZOc6U","title":"The Bitcoin strategic Reserve","duration":1855},
                {"id":"P7IQeU31R0o","title":"House holds joint crypto hearing, and ex-Coinbase worker sentenced to prison: CNBC Crypto World","duration":595},
                {"id":"lh7tYnOk3AU","title":"EP3: Bitcoin Is Good w/ David Zell, Founder & Co-Executive Director of the Bitcoin Policy Institute","duration":3125},
                {"id":"TE0eFKTJEfQ","title":"Bitcoin Policy Outlook 2025: State-Level Strategic Reserves, BitBonds and Privacy w/ Zack Shapiro","duration":3211},
                {"id":"5IHNLgkO6Ls","title":"Trump signs order to establish strategic reserve of cryptocurrencies","duration":376},
                {"id":"tWWb0-A0Rdk","title":"Dennis Porter: Bitcoin Laws Are Changing, Here's What You Need to Know","duration":4003},
                {"id":"kqOx7PjbNOw","title":"Shootin Straight Episode 3: Senator Cynthia Lummis","duration":2778},
                {"id":"boZ7yJOFBk0","title":"Crushing Anti-Bitcoin Legislation with Dennis Porter","duration":2933},
                {"id":"-nKmcQPmQkk","title":"Is Google's Quantum Breakthrough a Threat to Bitcoin? | Bitcoin Policy Hour Ep 33","duration":3753},
                {"id":"UVg4AjuPBQU","title":"Sen. Lummis on Crypto Oversight Bill, and why stablecoins need to be backed by hard assets","duration":470},
                {"id":"3f170IT1nQU","title":"Bitcoin Reacts to Tariff Tensions: What's Next for Price & Liquidity","duration":1943},
                {"id":"pnG86iyRsbA","title":"The Trump Doctrine Has ARRIVED, Here's What It Means for 2026","duration":2072}
            ]
        },
        {
            "id": "saylor",
            "name": "Saylor Series & Corporations",
            "emoji": "👑",
            "desc": "Michael Saylor's complete Bitcoin masterclass - strategy, philosophy & the future of money",
            "color": "#f7931a",
            "videos": [
                {"id":"aJIt3dUWEAs","title":"Unleashing the Cyber Hornets: Michael Saylor on the Power of Bitcoin","duration":3600},
                {"id":"WrR95PFYDFQ","title":"Michael Saylor On Buying Bitcoin With His Balance Sheet - Pomp Podcast #385","duration":5085},
                {"id":"8xVmeckJeXo","title":"Michael Saylor: Why Corporate Bitcoin Treasuries Empower Individual Holders","duration":100},
                {"id":"fzg9I7hHdzs","title":"Economics, Inflation, Interest Rates & Competition - The Saylor Series Episode 9","duration":6153},
                {"id":"1PkMFIa7rmQ","title":"Michael Saylor - 21 Rules of Bitcoin (BTC Prague 2024 Keynote)","duration":2415},
                {"id":"YMxuzzYqPi8","title":"Volatility's Return & Bitcoin Treasuries | True North Podcast | Ep. 19","duration":6229},
                {"id":"3axVO-3iKjg","title":"Michael Saylor explains why Bitcoin's creator doesn't matter","duration":61},
                {"id":"YnlFl8weBE0","title":"Bitcoin Is Entering the Capital Markets Era | Strategy World 2026","duration":704},
                {"id":"hqoagNBtIps","title":"Michael Saylor: Bitcoin Prophecy - BTC Prague 2025","duration":2855},
                {"id":"ZTO9GrKVNPw","title":"Navigating The Storm | True North Podcast | Ep. 37","duration":7686},
                {"id":"Aa-4HW_1RGY","title":"If You Build It, They Will Come | True North Podcast | Ep. 21","duration":8521},
                {"id":"ctZz5Dl5OEE","title":"New way of building wealth in your 20's  #bitcoin #mstr #investing","duration":74},
                {"id":"RK6t570jdgs","title":"Strategy ($MSTR) Balance sheet vs Coinbase ($COIN)","duration":327},
                {"id":"FsGONQow-nE","title":"The Strategic Case for Bitcoin Treasuries in Europe w/ Alexandre Laizet, Jesse Myers, Tyler Evans","duration":1350},
                {"id":"tvUQLJmQxuY","title":"What's The End Game of a Bitcoin Treasury Company? - Austin Alexander, Alexandre Laizet, Jesse Myers","duration":1807},
                {"id":"iojnUC6SXoQ","title":"True North Orlando 2025 - Setting Sail with Satoshi & Saylor | Tim Kotzman","duration":320},
                {"id":"6fBhCOV1LH0","title":"Why Bitcoin Is Emerging as Prime Collateral w/ Hunter Albright of SALT Lending | BFC Show Ep. 29","duration":2677},
                {"id":"3AzYUGjSf-w","title":"Bitcoin is disrupting the $300+ Trillion Credit Market.  #mstr #bitcoin #investing #investing","duration":61},
                {"id":"J2GAFWLNOhQ","title":"Strategy's Preferred Stock $STRC | Why Is It Valuable?","duration":375},
                {"id":"_iQni1dCqDY","title":"Bitcoin Trading Like a Currency - And Institutions Know It","duration":88},
                {"id":"3oo_slJedus","title":"New Year, The Bottom's In | True North Podcast | Ep. 50","duration":7723},
                {"id":"d4XxuxnreBs","title":"True Cost of Inflation - Michael Saylor & Lex Fridman","duration":885},
                {"id":"3GkA2grVaNw","title":"Michael Saylor Explains Why Bitcoin is Superior to Gold","duration":607},
                {"id":"07MA4bVy_tM","title":"Strategy ($MSTR) Balance Sheet & Digital Credit","duration":642},
                {"id":"g9hUmh6NnAg","title":"Metaplanet: From COVID Collapse to Bitcoin Treasury Strategy","duration":120},
                {"id":"LL2040c-DKU","title":"Equity Analysts Roundtable | Strategy World 2026","duration":1913},
                {"id":"gbr95uDuF94","title":"Bitcoin's \"iPhone Moment\" is Here w/ Strive Chief Officers | BFC Show Ep. 32","duration":2686},
                {"id":"Qv9meQd7S_M","title":"The Importance of Index Inclusion for Digital Asset Treasury Companies | Strategy World 2026","duration":1003},
                {"id":"TXvvMGrZDAw","title":"Billionaire Destroys Peter Schiff's Gold Argument - Michael Saylor","duration":450},
                {"id":"yz9R_EfIesM","title":"BTC credit markets will be bigger than bitcoin itself #bitcoinforcorporations #bitcointreasury","duration":80},
                {"id":"rQMFrpUFcNM","title":"Michael Saylor Keynote - Bitcoin MENA 2025","duration":2547},
                {"id":"yQL9yua9Yq0","title":"Michael Saylor on Bitcoin: The Digital Transformation","duration":3032},
                {"id":"aJPByFnBcNg","title":"BTC Opportunity Cost EVERYWHERE | True North Podcast | Ep. 27","duration":7598},
                {"id":"r1_8RumNLLI","title":"Protect Index Integrity: A Response to MSCI's Digital Asset Proposal","duration":323},
                {"id":"GSko_cbikfk","title":"$MSTR True North - $STRK and $STRF 101 - Jeff Walton & Dan Hillery analysis","duration":2978},
                {"id":"BcLBApRGdTo","title":"Some Pretty Good Money Printing | The Hurdle Rate Ep.50","duration":3635},
                {"id":"2RSKfdPcQ0g","title":"The Credit Industry Is Changing","duration":473},
                {"id":"_N7fZFcPjcc","title":"\"2026 the year of digital credit\" | True North Podcast | Ep. 44","duration":4614},
                {"id":"awA2vnfEB2Y","title":"Michael Saylor Explains High Powered Digital Money","duration":136},
                {"id":"uiFn8X96Zi4","title":"Redefining Corporate Treasury: Prevalon Energy's STRC Adoption | Strategy World 2026","duration":760},
                {"id":"jYiWGXBga4o","title":"There is no second best - Michael Saylor","duration":35},
                {"id":"reVebuAf_Cs","title":"Michael Saylor: 21 Ways To Wealth - Bitcoin 2025 Keynote","duration":2212},
                {"id":"hV_sgkHhApo","title":"SaylorNight - Relaxing Saylor Speaks on Bitcoin in the Night (1H)","duration":3684},
                {"id":"99liY3HDiG0","title":"On/Off/On/Off/On/Off | True North Podcast | Ep. 23","duration":7024},
                {"id":"J38-PQ6X8HI","title":"Michael Saylor: Satoshi Opened A Portal Into Cyberspace","duration":8203},
                {"id":"aZr_jfK9R10","title":"Why Short Term Losses Lead to Long Term Wins for Strategy. #mstr #digitalcredit #bitcoin","duration":93},
                {"id":"6P97_koDGtA","title":"Bitcoin vs Manhattan Real Estate in 1776 - Michael Saylor","duration":872},
                {"id":"8893dpSiNiE","title":"How to Value Bitcoin Treasury Companies w/ Andrew Webley, Matt Cole & Gurpreet Oberoi","duration":1280},
                {"id":"n7YE7wskfyw","title":"The Most Hated Rally in Finance | True North Podcast | Ep. 10","duration":8074},
                {"id":"Uc26OItd0JU","title":"Joe Rogan and Michael Saylor on Bitcoin","duration":126},
                {"id":"fEXw-LU18Ww","title":"Michael Saylor - There Is No Second Best (Lil Bubble Bitcoin House Remix)","duration":157},
                {"id":"UC1R-lChYr4","title":"What is Credit Risk? | True North Podcast | Ep.53","duration":7586},
                {"id":"d9OQ0UYSwLI","title":"Are Bitcoin Treasury Companies the Buyers of Last Resort? #bitcoinforcorporations #bitcoinstrategy","duration":115},
                {"id":"XU5u5gl6EIs","title":"Why Bitcoin is the Perfect Monetary System - Saylor Explains in Plain English","duration":712},
                {"id":"zBTJkiHE4vs","title":"The Great Equalizer: Why AI is the Ultimate Tool for Global Empowerment w/ Mason Foard of Meliuz","duration":491},
                {"id":"53s-U4SEI9s","title":"Proof of Performance: The KPIs That Matter","duration":1423},
                {"id":"N6vOLQ3qJiA","title":"Michael Saylor's 5 Most Powerful Bitcoin Moments (Updated 2026)","duration":303},
                {"id":"WvUE_Yvktwk","title":"Bitcoin's Seven Layers of Security #2 - The Saylor Series Episode 15","duration":4498},
                {"id":"Y7FsiPuF3z4","title":"SaylorSpace - Travel Through Cosmos with Michael Saylor on Bitcoin","duration":3628},
                {"id":"0JNkMSvVpQk","title":"MSTR stock could move up QUICKLY #trading #bitcoin #mstr","duration":117},
                {"id":"9qfWBr9Ggzg","title":"Why Digital Credit?","duration":269},
                {"id":"1Ms7ql_S63A","title":"The Saylor Series | Part 2: Bitcoin as Digital Gold & Property Rights","duration":6446},
                {"id":"dogJz_CfQW8","title":"Inspiring and Relaxing Michael Saylor Speaks about Bitcoin for 1H","duration":3602},
                {"id":"rv8HD3l0VEE","title":"Building a Digital Empire | True North Podcast | Ep. 36","duration":7343},
                {"id":"sVUzpZkz6t0","title":"The Societal Ripple Effects Of Corporate Bitcoin Adoption w/ Stafford Masie and Tracy Hoyos-Lopez","duration":1584},
                {"id":"NiBPWzNm1Jo","title":"Inside Brazil's Corporate Bitcoin Boom w/ Israel Salmen & Mason Foard | BFC Ep. 18","duration":2706},
                {"id":"soNo3KkYGiU","title":"Michael Saylor On Why Microsoft Needs A Bitcoin Strategy | Bitcoin for Corporations 2025","duration":1148},
                {"id":"EF5iiDgdfg8","title":"Michael Saylor's Bitcoin HODLing Strategy!","duration":34},
                {"id":"tqL6RdHaH_Q","title":"LIVE: Bitcoin for Corporations - Day 2 | Strategy World 2026","duration":31411},
                {"id":"hZfoWMbNA30","title":"Michael Saylor: Why Bitcoin Can't Be Stopped","duration":48},
                {"id":"TjgrV6M2VyU","title":"What does it take for $MSTR to meet their dividend obligations? #mstr #bitcoin","duration":111},
                {"id":"O9KnBcWMkpw","title":"Michael Saylor 2024 Keynote - Nashville","duration":2244},
                {"id":"LtcbR98uTJQ","title":"The Saylor Series | Part 1: The History of Money, Bitcoin & the Machine Economy","duration":3646},
                {"id":"-gqZiDZ_eNg","title":"True North Orlando 2025 - Opening remarks from CEO of Strategy | Phong Le","duration":229},
                {"id":"D1jpLbw3qQ8","title":"The Management of The Treasury | The Hurdle Rate Podcast | Ep. 54","duration":3132},
                {"id":"gSc6BC1Kh2g","title":"Digital Gold: Harder, Smarter, Stronger, Faster - The Saylor Series Episode 6","duration":5028},
                {"id":"mC43pZkpTec","title":"Michael Saylor: Bitcoin, Inflation & Future of Money - Lex Fridman #276","duration":14215},
                {"id":"sp90Dh2Igr0","title":"Europe's First Bitcoin Treasury Company | Strategy World 2026","duration":573},
                {"id":"wvhUQJtHamk","title":"Michael Saylor: Fix the Money, Fix the World!","duration":42},
                {"id":"4NLgRlObe1w","title":"The Predator-Prey Dynamics Of Bitcoin: Michael Saylor - Bitcoin Magazine","duration":5793},
                {"id":"2u9jJPzd5Wo","title":"$MSTR's $1.44B USD Reserve Just Proved The Business Model","duration":456},
                {"id":"0Y7qcaIkgMY","title":"Appeasing Michael Saylor - Bitcoin Singularity","duration":3601},
                {"id":"ykvjtK30HiA","title":"Michael Saylor & The Ultimate Bitcoin Strategy","duration":5766},
                {"id":"B5if2hthPCs","title":"Michael Saylor - We Call Them Poor (Bitcoin House Remix) by Lil Bubble","duration":143},
                {"id":"y4Wtwbmszow","title":"True North Now - Knots & Bitcoin: Spam, Filters, and the Fight for the Network | Featuring Mechanic","duration":3677},
                {"id":"wba5XJHKPqg","title":"Saylor: Bitcoin Halving Will Drive Demand Through the Roof","duration":236},
                {"id":"tkFnDInGouA","title":"Wealth and Treasury Management in the Bitcoin and AI Era | Strategy World 2026","duration":726},
                {"id":"ckj0w5p1bLA","title":"Bitcoin in Wealth Management Portfolios | Strategy World 2026","duration":1106},
                {"id":"cuRRVo2Cmsc","title":"Why Bitcoin Now: Michael Saylor on the Best Way for Companies to Buy Bitcoin - Ep.209","duration":5883},
                {"id":"0GnG_3iHhrw","title":"Michael Saylor Told Eric Trump to Mortgage Mar-a-Lago for Bitcoin","duration":112},
                {"id":"mEHJYJg5mew","title":"Bitcoin's 13% Yield: The Digital Credit Revolution w/ Strive's Matt Cole, Ben Werkman, & Jeff Walton","duration":518},
                {"id":"c2USwEB-D48","title":"This German Company is Future Proofing Its Balance Sheet With Bitcoin","duration":265},
                {"id":"1BwJh2HmX74","title":"All of us were ready to ride it to zero -  Saylor on Bitcoin at $16,000 🤝 #bitcoin #michaelsaylor","duration":33},
                {"id":"tSAvXsMQjYg","title":"What is Bitcoin? - Michael Saylor & Tucker Carlson (Nov 2021)","duration":396},
                {"id":"EP0XfP2HCCM","title":"Regulatory Panel | Strategy World 2026","duration":1802},
                {"id":"4A4goufTTI8","title":"\"Rate My Stock / Risk of Credit\" | True North Podcast | Ep. 43","duration":7126},
                {"id":"1Mr9PknsM_Y","title":"Michael Saylor's Best Explanation of Bitcoin","duration":349},
                {"id":"Wz2LE_21q5c","title":"\"Pref Analysis / Deep Dive\" | True North Podcast | Ep. 42","duration":6050},
                {"id":"Fvi6pdG_jZw","title":"GigaChad Michael Saylor Best Moments - Bitcoin Song","duration":83},
                {"id":"ao2RJhVpIW4","title":"Meet Them Where They're At | The Hurdle Rate Ep. 37","duration":3200},
                {"id":"OtOaE24IGlA","title":"Tokenization: The Next Era of Corporate Finance | Strategy World 2026","duration":1782},
                {"id":"JAgkx45l9no","title":"Digital Assets at TD Bank | Strategy World 2026","duration":1765},
                {"id":"49ADpogjahE","title":"STRC x SATA - BTC Risk & BTC Credit","duration":1390},
                {"id":"3FrBqdCxZb4","title":"Media Roundtable | BFC Symposium, Amsterdam 2025","duration":2878},
                {"id":"BGmo58IMxvM","title":"Michael Saylor discovered a bitcoin printer | Joe Burnett","duration":208},
                {"id":"O3Nn0iPbN6s","title":"True North Orlando 2025 - From Basements to Stages | Jeff and Crew","duration":3219},
                {"id":"6WVXmSz2RWw","title":"How Bitcoin Will Succeed.","duration":62},
                {"id":"qOM3oKj5FmY","title":"The Rise Of Bitcoin Treasuries w/ Tim Kotzman, Konrad Leasser, Wyatt O'Rourke & VIjay Selvam","duration":1276},
                {"id":"IZhS7z91xXc","title":"Bitcoin Treasury Fundraising in Bear VS Bull Markets w/ Brandon Green & Robert Harrison","duration":966},
                {"id":"3r_Z3U0jIA4","title":"The Best Message Is Digital Credit | The Hurlde Rate Ep. 43","duration":3768},
                {"id":"2NwaMg0VyC8","title":"Bitcoin, Bonds and Breakthroughs | True North Podcast | Ep. 7","duration":8257},
                {"id":"CA_XnoCk4sY","title":"Michael Saylor Has DOUBLED His Bitcoin Investment!","duration":305},
                {"id":"raxpm9Qu7rI","title":"Top 5 Moments w/ Michael Saylor, Jeff Booth, Cory Klippsten, Gigi, and more! (BTC120)","duration":5739},
                {"id":"sVNbuZx7VqQ","title":"What Strategy ($MSTR) Could Be Worth In 5 Years","duration":802},
                {"id":"XLvCCm3gUcw","title":"Bitcoin House in Vegas 🚀 #bitcoin #michaelsaylor","duration":24},
                {"id":"j088KB4wDh8","title":"Bitcoin Adoption Trends w/ Alex Leishman | Strategy World 2026","duration":455},
                {"id":"ErhdjIY5ogs","title":"A Structural Shift | The Hurdle Rate Podcast | Ep. 55","duration":3061},
                {"id":"m4vV3XtWYMw","title":"Convertibles on Deck | True North Podcast | Ep. 18","duration":6370},
                {"id":"c8trwUs7oRQ","title":"\"Zero is the Wrong Number\" - Why You Can't Ignore Bitcoin Anymore w/ Hunter Albright of SALT Lending","duration":207},
                {"id":"LFlA0YKXbrc","title":"Africans Get Bitcoin Faster Than Fortune 500 CEOs","duration":118},
                {"id":"xzHc5x9muT0","title":"Post Election Discussion | True North Podcast | Ep. 3","duration":5578},
                {"id":"g2aE7hVKH1o","title":"Structurally Bullish | The Hurdle Rate Ep. 41","duration":3580},
                {"id":"Sc9_2I3-LdE","title":"The Revolution of Digital Credit | True North Podcast | Ep. 45","duration":6982},
                {"id":"DrxZJY9EhWM","title":"MSTR Q4 2025 Earnings Call Analysis: The Digital Credit Stress Test | BFC Show Ep. 25","duration":4536},
                {"id":"DHtXzMSBlHQ","title":"Power Of Collateral | True North Podcast | Ep. 30","duration":6866},
                {"id":"1LLtefID_VE","title":"The Hurdle Rate Is High | The Hurdle Rate Ep. 39","duration":2488},
                {"id":"_BUT5f9tRNM","title":"Is The Tide Turning? | True North Podcast | Ep. 58","duration":6265},
                {"id":"mTeqO63hGI4","title":"Michael Saylor Dismantles the Strongest Argument *Against* Bitcoin","duration":50},
                {"id":"003pvQdffr4","title":"Strategic Risk Taking | The Hurlde Rate Ep. 23","duration":3175},
                {"id":"B4P_0LN60Rs","title":"Is This the New Bitcoin Meta? Inside the Nakamoto Vision w/ Tyler Evans of Nakamoto","duration":240},
                {"id":"BxYClOh-Mlo","title":"Michael Saylor: $2M to $40M With One Simple Bitcoin Strategy","duration":113},
                {"id":"4az78ODE3Zc","title":"Digital Credit Clarity | The Hurdle Rate Ep. 44","duration":3443},
                {"id":"ACmMK_ruxn4","title":"Have Space Suit, Will Travel | True North Podcast | Ep. 14","duration":7389},
                {"id":"k0adfjcSDHs","title":"MicroStrategy: The Case for Bitcoin on Corporate Balance Sheets | Bitcoin for Corporations","duration":3052},
                {"id":"TPCHXc7qf2U","title":"The Reality of AI in 2026 #trading #mstr #bitcoin #ai","duration":105},
                {"id":"C4i3OjkrBTc","title":"The Starting Line | The Hurdle Rate Ep. 27","duration":3183},
                {"id":"iue1CHo_F-o","title":"Will Travel For Bitcoin | The Hurdle Rate Ep. 25","duration":2647},
                {"id":"hzyJ0tK9f2k","title":"MicroStrategy is Getting Stronger... Here's How We Know","duration":380},
                {"id":"YFgJVIhc79E","title":"Waiting For The World To Catch Up | True North Podcast | Ep. 59","duration":6387},
                {"id":"AKvWwZJ6gfA","title":"Sigma Chad Michael Saylor - It's Going Up Forever Laura","duration":58},
                {"id":"gzaQsWiaGfg","title":"MicroStrategy joins Nasdaq 100 - passive funds are coming for bitcoin | Joe Burnett","duration":243},
                {"id":"vMw0KuAIGTM","title":"Chapter 2 \"Full Sail Ahead\" | True North Podcast | Ep. 39","duration":7814},
                {"id":"AzpRvdaMGfY","title":"Bitcoin House vinyls are here & you can watch me unbox in my slippers 🙏 #bitcoin #michaelsaylor","duration":32},
                {"id":"7KYylYAdBm8","title":"Software is going to zero #ai #mstr #bitcoin","duration":77},
                {"id":"VSB_lXxJbDA","title":"Rewiring The Credit Curve | True North Podcast | Ep. 32","duration":6868},
                {"id":"EeeZSiZQ5q4","title":"New Market Structures Using STRC & Bitcoin-Linked Products | Strategy World 2026","duration":603},
                {"id":"FVuKRYuhv8w","title":"Michael Saylor: The Bitcoin Treasury Endgame - An Exclusive At-Home Interview","duration":5381},
                {"id":"wE7RPLCr7_M","title":"Michael Saylor: Bitcoin Volatility Is Satoshi's Gift to You","duration":54},
                {"id":"raJ6uR_wTPQ","title":"True North Now - Inside look at Semler Scientific | Featuring Eric Semler & Joe Burnett","duration":2620},
                {"id":"wcJtAcOjlTM","title":"Bitcoin-Linked Convertibles | Strategy World 2026","duration":975},
                {"id":"LbddD5vmFCY","title":"True North Now - Inside look at The SmarterWeb Company | Featuring CEO Andrew Webley","duration":2912},
                {"id":"coHC_9ApBdg","title":"Michael Saylor: The Bitcoin Standard for Corporations","duration":7002},
                {"id":"kCHcX7Xw104","title":"Unlocking Value in Bitcoin Treasury Companies w/ Tyler Evans, Loren Asmus, John Riggins, Mason Foard","duration":1828},
                {"id":"S_-1q3zdUYo","title":"An Increasingly Digital World | The Hurdle Rate Podcast Ep.52","duration":3236},
                {"id":"p3vNo6JcC7s","title":"Bear is for Building | True North Podcast | Ep. 49","duration":7003},
                {"id":"l3KxDiSgjpk","title":"True North Orlando 2025 - The DNA of a Bitcoin portfolio  | Dan Hillary","duration":571},
                {"id":"sS7hLOJlyRQ","title":"The Incentives Are Aligned | The Hurdle Rate Ep. 38","duration":3500},
                {"id":"MSMJBmo_q4s","title":"Saylor: Bitcoin as Treasury Reserve Asset","duration":240},
                {"id":"aWtzOQTv8Dc","title":"Saylor vs Dorsey: Battle for Bitcoin's Future","duration":917},
                {"id":"YxlfOsFYAt4","title":"Bitcoin Treasury Companies Are the Bridge to $20 Trillion","duration":111},
                {"id":"-weaa5SrVEU","title":"Michael Saylor Needs Some Rest","duration":40},
                {"id":"y2mugodJ6gc","title":"What is Credit w/ special guest Adam Livingston | True North Podcast | Ep. 41","duration":8129},
                {"id":"D6lqLqPYgTI","title":"True North Now - Another inside look at The SmarterWeb Company | Featuring CEO Andrew Webley","duration":2159},
                {"id":"nC37CqWpxfI","title":"Saylor & Dorsey Interview","duration":3398},
                {"id":"zBGofxUj9dc","title":"Michael Saylor - Forever, Laura (Lil Bubble Bitcoin House Remix)","duration":192},
                {"id":"CodcEnDtXtI","title":"The Private Credit Bitcoin Cycle w/ Matt Dines | Bitcoin for Corporations Ep. 13","duration":3926},
                {"id":"SaOw1lM_IgI","title":"Outperforming the money printer is difficult without bitcoin | Tad Smith | Joe Burnett","duration":379},
                {"id":"takcCQySsPw","title":"Bitcoin is Global | Strategy World 2026","duration":811},
                {"id":"AOGcC7Zyjy0","title":"$MSTR & $STRK Preferred Stock thoughts 3/13/25","duration":2151},
                {"id":"68gbrVgwxDQ","title":"How capital will move between Bitcoin and Preferred Equities  #trading #bitcoin","duration":123},
                {"id":"0majxELKVEo","title":"Thanksgiving Week | True North Podcast | Ep. 8","duration":4231},
                {"id":"Ux44HPsGcjY","title":"An Increasingly Digital World | The Hurdle Rate Podcast Ep.52","duration":3236},
                {"id":"dAFJzsJdfJI","title":"Why Michael Saylor Went ALL IN On Bitcoin","duration":636},
                {"id":"fUFnLPblsBg","title":"100% Saylor - Michael Saylor Best Moments","duration":102},
                {"id":"DAXC9km8Wlk","title":"Bitcoin: Zero Percent Inflation - Saylor & Robert Breedlove","duration":8063},
                {"id":"o3WT9wz0oOk","title":"What's Actually Happening with Strategy ($MSTR) Stock Price w/ Adam Livingston","duration":8022},
                {"id":"aUEhwe2GvtY","title":"Bitcoin Economics and Evolution - The Saylor Series Episode 16","duration":5371},
                {"id":"DiU3od1PvS0","title":"📺 LIVE: Over 12,000 BTC in ONE DAY from Strategy's STRC ATM - What will it hit today?","duration":30066},
                {"id":"7gvogsnkjdc","title":"SaylorWaves - 1 Hour of Relaxing Saylor Speaking about Bitcoin","duration":3634},
                {"id":"qjjNgW4bZm8","title":"Michael Saylor - One Chair (Lil Bubble Bitcoin House Remix)","duration":155},
                {"id":"D8KVtBKQBtE","title":"Navigating MSTR and BTC | True North Podcast | Ep. 1","duration":7618},
                {"id":"b-_UvOwM3LE","title":"Bitcoin Supercycle | The Hurdle Rate Ep. 29","duration":3174},
                {"id":"peiCCZdOXuI","title":"The Reflexive Demand Shock Is Not Priced In w/ Alexandre Laizet | Bitcoin for Corporations Ep. 16","duration":4069},
                {"id":"zCvYKTLGGRc","title":"Bitcoin Treasuries & The New Credit Paradigm w/ Jeff Walton of Strive","duration":1134},
                {"id":"kkGDfuTj1Ew","title":"Bitcoin: There Is No Second Best - Michael Saylor & Greg Foss Twitter Spaces","duration":7870},
                {"id":"Yd1UFNvqwWQ","title":"How Bitcoin Changes Everything - The Saylor Series Episode 17","duration":5378},
                {"id":"OBaNWJ5vLQI","title":"What Shall We Do With Michael Saylor?","duration":156},
                {"id":"ffjHKvulDns","title":"Michael Saylor Addresses Bitcoin Treasury Skeptics","duration":929},
                {"id":"p8G0JLe47Ws","title":"Bitcoin vs. Gold (Who wins?) #gold #bitcoin #money","duration":89},
                {"id":"GO2HffGUIN4","title":"BREAKING: Michael Saylor BREAKS Bitcoin Echo Chamber | EP 738","duration":4548},
                {"id":"dPvVqTlPRPY","title":"Credit Ratings for Digital Capital | The Hurdle Rate Ep. 33","duration":3261},
                {"id":"-cx1Am2UFCA","title":"Why Bitcoin: Michael Saylor Interview - #Bitcoin #LostCoins $MSTR #Future #Math Education + more","duration":4832},
                {"id":"Rty7BQyUkHM","title":"NEW Michael Saylor Interview on Bitcoin (12-Minute Summary)","duration":751},
                {"id":"PPdRbAmYK6c","title":"Fireside Q&A: David Bailey & George Mekhail | Bitcoin for Corporations Symposium @ Bitcoin Asia 2025","duration":1449},
                {"id":"G0l1X9XvDe4","title":"\"The iPhone Moment\" | True North Podcast | Ep. 35","duration":7051},
                {"id":"eRvBj7j24B0","title":"97. Bitcoin Strategy with Michael Saylor CEO of Microstrategy","duration":10530},
                {"id":"uUUwuxTquws","title":"Michael Saylor Bought $7 Billion In Bitcoin - Pomp Podcast","duration":447},
                {"id":"CUilC81qgQ8","title":"Preferred Equity Demand | The Hurdle Rate Ep.45","duration":3910},
                {"id":"ChWZHwMkuwk","title":"Why AI Deflation Will Push Capital Into Bitcoin w/ Mason Foard of Méliuz | BFC Show Ep. 30","duration":1525},
                {"id":"E2fZBPb0Q9A","title":"\"I want MSTR to stand for MONSTER\"","duration":85},
                {"id":"7KniD4pcsJ8","title":"Securing the Institutional Frontier w/ Mike Belshe of BitGo","duration":498},
                {"id":"_GHU3v3mqwE","title":"Digital Risk w/ Jeff Walton | Strategy World 2026","duration":932},
                {"id":"FTGSQdoS5Sc","title":"Michael Saylor: Bitcoin Quantum Resistance & Strategy's Bitcoin Cybersecurity Program","duration":108},
                {"id":"VwTzTuc4qDk","title":"LIVE: Bitcoin for Corporations - Day 1 | Strategy World 2026","duration":18242},
                {"id":"agzUmY0w1-A","title":"Don't Panic: Michael Saylor on Quantum Computing and Bitcoin's Future","duration":171},
                {"id":"5oI5hDDYYgk","title":"New Year, Same Business | True North Podcast | Ep. 12","duration":8762},
                {"id":"1c7weMce8_A","title":"Give Me a Lever Long Enough | True North Podcast | Ep. 17","duration":5856},
                {"id":"9sY2ALb4UWE","title":"Lil Bubble - Buying At The Top Forever (Official Visualizer) ft. Michael Saylor","duration":151},
                {"id":"3e4gcMXNNpM","title":"Michael Saylor's reaction to Bitcoin price crash","duration":79},
                {"id":"Umo16GF91HU","title":"The Quiet Accumulation | True North Podcast | Ep. 56","duration":6518},
                {"id":"zoZiw1cSOBY","title":"The Trade Idea Nobody Is Talking About ($STRC)","duration":521},
                {"id":"PxnlhBP-wRs","title":"Jeff Walton Explains Digital Risk | Strategy World 2026","duration":940},
                {"id":"eDZu7ay1etQ","title":"Bitcoin is Powered by Chaos #mstr #trading #bitcoin","duration":80},
                {"id":"RMp-c6ADsVE","title":"Let's Talk About Leverage | True North Podcast | Ep. 11","duration":8094},
                {"id":"H99AdvqhUE0","title":"Micheal Saylor: \\\"Everyone Who Owns ANY BTC Needs To Hear This\\\" 2025 Bitcoin Prediction","duration":764},
                {"id":"A7X5NXHVx1I","title":"How Family Offices & Institutions Are Positioning for Bitcoin | Bitcoin MENA 2025","duration":1623},
                {"id":"G_VIAI9uXQk","title":"True North Orlando - The people behinds the scenes | TheBitcoinGal, Trollstein and J64","duration":638},
                {"id":"4Buu1h_89hY","title":"Michael Saylor 'Bitcoin Is As Risky As Crossing a Street'","duration":667},
                {"id":"slOVowPqhAc","title":"New Market Structures using STRC & Bitcoin-Linked Products | Strategy World 2026","duration":1842},
                {"id":"cyL2t75YLQM","title":"Building Japan's Bitcoin Standard w/ Simon Gerovich | Strategy World 2026","duration":892},
                {"id":"MhNrsdAwaUM","title":"The Death of Gold - The Saylor Series Episode 10","duration":4817},
                {"id":"UkFp45QBL2Y","title":"Bitcoin as a Technological Invention, Not Just an Asset","duration":69},
                {"id":"ytmhmixeCRo","title":"The Bitcoin Interview That YouTube Tried To Delete","duration":3012},
                {"id":"xXI2OFzQinI","title":"True North Orlando 2025 - Volatility, Options and Full Gamma | Grain of Salt","duration":2211},
                {"id":"rcGeY0OzWdQ","title":"Michael Saylor: Money is Energy - Breedlove & Lex Fridman","duration":457},
                {"id":"xn607rFc1U8","title":"True North Pulse - MSTR has a 91% chance of qualifying for the S&P 500 | Jeff Walton","duration":387},
                {"id":"oHnoxfjAPqo","title":"Michael Saylor Bitcoin for Corporations 2025 Keynote Speech","duration":3909},
                {"id":"y8IH0OwFyW4","title":"Michael Saylor: Why Bitcoin is a Truth Machine","duration":601},
                {"id":"lIODLyOWqpE","title":"Bitcoin: There Is No Second Best | Michael Saylor at Bitcoin for Corporations","duration":3807},
                {"id":"0Hc1wsSSyvM","title":"Translating Bitcoin for Legacy Corporates w/ Sam Callahan, Khing Oei, Lennart Lopin & Sean Bill","duration":1404},
                {"id":"k7XhzXMSAPo","title":"239. Michael Saylor's 4 years of bitcoin","duration":8428},
                {"id":"BWB6-2Agaqc","title":"Wall Street Digital Gold Rush | True North Podcast | Ep. 31","duration":7295},
                {"id":"Um_qzLz_YIw","title":"Michael Saylor: Bitcoin Is Digital Capital-Here's Why It Matters","duration":174},
                {"id":"eS5VL35RNvE","title":"True North Orlando 2025 - Conviction as a service | Ben Werkman","duration":950},
                {"id":"BO4LnHoOcM4","title":"Investment Banker Christian Lopez: Why EVERY Balance Sheet Will Hold BTC | BFC Ep. 13","duration":3674},
                {"id":"gCfA1lkmJo4","title":"Michael Saylor - The Greatest Bitcoin Explanation","duration":620},
                {"id":"tNJp3qBH1sw","title":"Bitcoin is Cybernetic Life - The Saylor Series Episode 13","duration":5548},
                {"id":"JjAtLGXKUrs","title":"Inside the Digital Credit Revolution | The Hurdle Rate Ep. 36","duration":3280},
                {"id":"l1YeMuTUjuY","title":"The Equitization of Bitcoin: Treasury CEO Khing Oei | BFC Symposium, Amsterdam 2025","duration":936},
                {"id":"CYT0AxQxa7o","title":"Why Bitcoin Succeeds - The Saylor Series Episode 12","duration":6045},
                {"id":"KjFCRhhTO18","title":"A Digital Credit Treasury | The Hurdle Rate Podcast Ep.51","duration":3634},
                {"id":"dGm8YA96oOs","title":"Mathematically Comparing Hypothetical Risk Profiles |$STRC vs $SATA","duration":355},
                {"id":"WQGt4Lqx4dY","title":"The Preferred Strategy is Digital Credit | The Hurdle Rate Ep. 34","duration":3108},
                {"id":"sLDz5_Xalak","title":"Strategy ($MSTR) 2022 vs 2026: What Changed","duration":676},
                {"id":"z3saVEaGiFI","title":"The Bitcoin Index Inclusion Question w/Dylan LeClair, Tyler Evans, Alexandre Laizet & George Mekhail","duration":1376},
                {"id":"3-vBBYEXv6M","title":"Michael Saylor Bitcoin for Corporations 2025 Keynote Speech","duration":3909},
                {"id":"oPbHTD3vCEU","title":"Strategy Launches STRE ('Stream') Euro-Denominated Perpetual Preferred Stock Offering with 10% Yield","duration":1709},
                {"id":"HtGSq8QphY4","title":"Treasury Execution  Exchanges, OTC Desks and Custodians w/ Nick Coombs, Jonathan Ovadia & Allen Helm","duration":1299},
                {"id":"f5mfgko8ELc","title":"The German Bitcoin Advantage: aifinyo CEO Garry Krugljakow | BFC Ep. 20","duration":3129},
                {"id":"iBgYVIyiYzI","title":"Up To Par | True North Podcast | Ep. 52","duration":4087},
                {"id":"7hyoONj4nEY","title":"What One Billionaire Knows About Outlasting a Dollar Collapse - Jordan Peterson EP 554","duration":5245},
                {"id":"qQlMFaX4dbA","title":"Colin's Michael Saylor impression","duration":26},
                {"id":"PyYogQEnPNE","title":"Should You Buy Bitcoin? - Michael Saylor","duration":219},
                {"id":"DLgUQ1HGUXE","title":"Bitcoin Capital Markets: Evolving Instruments for Institutions","duration":1577},
                {"id":"CdBOuVaqYvY","title":"Digital Capital Theory & Analysis w/ Allard Peng | BFC Show Ep. #22","duration":3959},
                {"id":"V-SQTNYZinw","title":"Bitcoin Treasury Pitfalls: Is It Always The Right Move? | Bitcoin MENA 2025","duration":1250},
                {"id":"rP2YjjuQn5A","title":"Liberation Day Chess | True North Podcast | Ep. 22","duration":7266},
                {"id":"nuKqepvkOqI","title":"All In On Bitcoin | The Jeff Walton Story","duration":3452},
                {"id":"UADTd7gCuXo","title":"THERE IS NO SECOND BEST - Saylor at BTCPrague 2023","duration":2442},
                {"id":"Z6QPPhdQCEM","title":"Why Strategy ($MSTR) stock did not fall back down to $20 #bitcoin #mstr #trading","duration":63},
                {"id":"aIiZGnvyMQY","title":"The Bitcoin Orchestra | True North Podcast | Ep. 24","duration":7209},
                {"id":"fAldRInw4EA","title":"The Mechanics of Capital and Digital Credit | True North Podcast | Ep. 61","duration":6879},
                {"id":"L1odkMa4PCE","title":"Signals From True North Live | True North Podcast | Ep. 57","duration":7029},
                {"id":"sjYANTSww34","title":"Michael Saylor Briefly Explains Why Bitcoin Is The Best Store of Value","duration":223},
                {"id":"Is99RsbExvE","title":"Margin Isn't Calling! | True North Podcast | Ep. 54","duration":6782},
                {"id":"nr9tQmTeA20","title":"Bitcoin Treasury Companies Eating the Bond Market","duration":329},
                {"id":"ggd-qnM9iwI","title":"Jeff challenges you to look at the bond market.","duration":69},
                {"id":"RGI4N223lSU","title":"Why Bitcoin Sovereignty Beats ETF Convenience w/ Trey Sellers of Unchained | BFC Show Ep 31","duration":3813},
                {"id":"DD1Y-Uhj4Og","title":"Did Michael Saylor & Strategy Just TRIGGER a Bitcoin STAMPEDE?","duration":769},
                {"id":"DpxMhcxi4wI","title":"The Nakamoto Flywheel Strategy for Scaling a Bitcoin Treasury with BTC Inc | BFC Show Ep. 28","duration":3157},
                {"id":"3MwB99iAYfY","title":"Bitcoin Education Institute | Strategy World 2026","duration":697},
                {"id":"v4jHjIfMT8k","title":"Defeating the Single Point of Failure w/ Mike Belshe of BitGo | BFC Show Ep. 33","duration":3079},
                {"id":"9jgoAqTErfs","title":"Michael Saylor Brilliantly Explains Bitcoin's Superiority","duration":1253},
                {"id":"50VwsS0401Q","title":"True North Orlando 2025 - MSTR True North Live | Panel","duration":2813},
                {"id":"N3J868zhH9g","title":"Bitcoin Is Encrypted Energy - Saylor & Breedlove","duration":613},
                {"id":"o5XBSF6w7I4","title":"MusicSnake - Stack Sats (feat. Michael Saylor)","duration":176},
                {"id":"r3fjhCedp-U","title":"Bitcoin Survival Logic: Saylor's Strategy Dominates Geopolitics","duration":36},
                {"id":"CAkVu_Dou4E","title":"BTC-Backed Financing For Corporations w/Jeff Walton, Hunter Albright, Wyatt O'Rourke & Russ Jacobsen","duration":1462},
                {"id":"1kyXKI0m_LI","title":"LIVE: Strategy (MSTR) Q4 2025 Earnings Call","duration":7307},
                {"id":"1R0J-myYPM0","title":"Michael Saylor: Bitcoin is Hope","duration":387},
                {"id":"QI3nWhrZ1-k","title":"NEW MicroStrategy CEO Michael Saylor Interview - 12/28 Twitter Spaces w/ Eric Weiss","duration":4102},
                {"id":"tebx6tULPnM","title":"Digital Credit Boom Is Coming","duration":456},
                {"id":"fNizwumVk4I","title":"Banks Perspective of Investing in Digital Credit | Strategy World 2026","duration":809},
                {"id":"6d9bPPI77zg","title":"\"MSTR Uptober\" | True North Podcast | Ep. 40","duration":7821},
                {"id":"8Mhu6dxj7qk","title":"WE HAVE LASER EYES - Michael Saylor at BTCPrague 2023","duration":1990},
                {"id":"d3Ryy9CWfLc","title":"Bitcoin Treasury Strategy: Does Cash Flow Still Matter?","duration":1318},
                {"id":"rkaXG5abVYY","title":"Commodity, Security, Token | The Hurdle Rate Ep. 22","duration":3124},
                {"id":"FM638pY34uo","title":"The Digital Credit Landscape | The Hurdle Rate Ep. 31","duration":3678},
                {"id":"_T6Wu5d3IY0","title":"$MSTR True North - In the Mind of Richard Byworth with Jeff Walton","duration":4164},
                {"id":"EIH2k857E1Y","title":"STRC'ing The Limits | True North Podcast | Ep. 34","duration":7665},
                {"id":"9xhks3PPI3w","title":"Beneath The Surface, A System In Motion | True North Podcast | Ep. 60","duration":6879},
                {"id":"SojzZxhMf00","title":"The Virtues of Strong Money - The Saylor Series Episode 7","duration":5493},
                {"id":"qPtBbjFR5ak","title":"The Next Trillion Dollar Company | Phong Le Interview","duration":3264},
                {"id":"yjDPsXw99X8","title":"Michael Saylor Exposes the Bitcoin Rehypothecation Problem","duration":70},
                {"id":"JzsrwmPzttw","title":"Fishing For The Fixed Income | True North Podcast | Ep. 29","duration":7440},
                {"id":"Q9zn96gOy0U","title":"Jeff asks a trick question. #mstr #bitcoin #realestate #strc","duration":61},
                {"id":"6osK1CXno80","title":"Michael Saylor GETS ANGRY Talking About Bitcoin","duration":2177},
                {"id":"G9SRFBXIOeE","title":"Strive Chiefs play Bitcoin Trivia! #bitcoin #bitcointreasury #bitcoinconference","duration":79},
                {"id":"fTMZxghP45c","title":"True North Orlando 2025 - Make Bitcoin Work for You | Solei","duration":358},
                {"id":"8XbR73Et0E4","title":"Metaplanet and the BOJ's Debt Trap: The BTC Treasury Perfect Storm? w/ Dylan LeClair & Phil Geiger","duration":3845},
                {"id":"uILb-qRPLGo","title":"True North Exchange - Recapitalizing the world on Bitcoin | with @amitisinvesting","duration":5172},
                {"id":"vkIq85Ha1fc","title":"The First Regulated STRC ETF Is Here | Strategy World 2026","duration":487},
                {"id":"mpyijmce67E","title":"A Time To Build | The Hurdle Rate Ep.47","duration":2954},
                {"id":"LP5W_BUXnEw","title":"Bitcoin, Economics, & Mimetics with Robert Breedlove","duration":4891},
                {"id":"IEugtyLaaAQ","title":"This Could Drive Bitcoin to $1,000,000","duration":342},
                {"id":"gHpnTOoGv7Q","title":"Saylor: Why Bitcoin Will Birth a New Generation of Trillion-Dollar Companies","duration":900},
                {"id":"9v3h7fPefHE","title":"Land will be very valuable in the future #realestate #bitcoin #mstr #ai","duration":65},
                {"id":"9OHeub2XLwU","title":"Strategy ($MSTR) Balance Sheet UPDATE","duration":339},
                {"id":"t8QSR0y9rls","title":"Strategy ($MSTR) vs. Bitcoin Supply: The Convergence","duration":197},
                {"id":"OR23DNZQ36U","title":"Michael Saylor: The truth about quantum threat to Bitcoin","duration":54},
                {"id":"BHBfDF9Of1Y","title":"Financial Engineering 101 | True North Podcast | Ep. 15","duration":7620},
                {"id":"QBLGZqYTmn8","title":"MicroStrategy's Bitcoin Strategy Is INSANE - Pomp Podcast","duration":2499},
                {"id":"5GTVLqVi_Qw","title":"Capital Gravity Converging & Teeth Scarcity | True North Podcast | Ep. 26","duration":8386},
                {"id":"5UssVPlRllQ","title":"Bitcoin Treasury Operations Roadmap | Strategy World 2026","duration":1212},
                {"id":"mJ4rDOQ39JQ","title":"The Semler Acquisition: Strive's Bitcoin Credit POWERHOUSE w/ Matt Cole & Jeff Walton | BFC Ep. 14","duration":4026},
                {"id":"7aJTOCN501g","title":"Saylor Reveals the TOP Bitcoin Secrets - Digital Asset Summit 2025","duration":2050},
                {"id":"xerlqYufU2s","title":"\\\"If Your Buying MSTR or STRC This Is 100% Guaranteed For Bitcoin\\\" - Brandon Gentile","duration":83},
                {"id":"8eaJ3VuzhmY","title":"Michael Saylor Responds to Bitcoin Critics","duration":6715},
                {"id":"MOZejVJrhXU","title":"Jeff Walton pitching Michael Saylor on a business idea","duration":128},
                {"id":"FWXivDbeyWw","title":"Strategy ($MSTR) Balance Sheet UPDATE","duration":499},
                {"id":"DqHEgdThGuU","title":"Issuer Perspective of Investing in Digital Credit | Strategy World 2026","duration":1871},
                {"id":"7wHQGnfnWAs","title":"Weeks When Decades Happen | True North Podcast | Ep. 20","duration":6313},
                {"id":"fCkABdwjxtE","title":"Michael Saylor at Bitcoin Atlantis 2024","duration":3069},
                {"id":"8h8Pyy4s12w","title":"Michael Saylor on Fox News: Why El Salvador Adopted Bitcoin","duration":342},
                {"id":"ioM33qIAfdY","title":"Michael Saylor calls them poor!? (Lil Bubble House Remix) #bitcoin","duration":56},
                {"id":"zQwaUUOzNSs","title":"The Asymmetry of Bitcoin-Backed Credit | MSTR Q4 2025 Earnings Call","duration":102},
                {"id":"Tr2DBZIzrwQ","title":"Zoom Out - We're Early | The Hurdle Rate Ep. 26","duration":2582},
                {"id":"RsoUxYJBKbU","title":"True North Orlando 2025 - Where are we going? | Jeff Walton","duration":908},
                {"id":"JtujhPY4Wtg","title":"Bank said no 😭 #bitcoin #crypto #michaelsaylor","duration":10},
                {"id":"_ZRc6plqG0s","title":"A Digital Dollar Backed by Bitcoin With 30% Yield | Strategy World 2026","duration":751},
                {"id":"X785ZNCW87g","title":"How Real Is Strategy's Bankruptcy Risk? ($MSTR)","duration":449},
                {"id":"nNt3WQnb00g","title":"True North Now - Inside look at H100 | Featuring CEO Sander Andersen","duration":2028},
                {"id":"iAltqb7iLf8","title":"The Future Runs on Digital Credit | Strategy World 2026","duration":607},
                {"id":"YtQhBfLNeGY","title":"Inject The Bitcoin Volatility Virus | True North Podcast | Ep. 33","duration":7818},
                {"id":"HSqlTJjs36g","title":"Michael Saylor's Strategy World 2026 Keynote: Digital Credit","duration":3032},
                {"id":"CcztyNj5gps","title":"The Great Unraveling: Why Bonds Are Dead & Bitcoin Is Rising w/ Mark Moss","duration":916},
                {"id":"EiZSozfvKMQ","title":"Michael Saylor Lost His Mind - There Is No Second Best Meme","duration":51},
                {"id":"VWHBbtUWBEE","title":"Financial Leverage & Bear Sightings | True North Podcast | Ep. 9","duration":8860},
                {"id":"lCKY-vfV4Ck","title":"Week of Jan 17 Expiration | True North Podcast | Ep. 13","duration":5739},
                {"id":"T9sRVEIOQL8","title":"Putting Your Assets to Work | BFC Symposium, Amsterdam 2025","duration":1297},
                {"id":"_pVKQYdnsMc","title":"Michael Saylor Explains the Digital Credit Revolution","duration":811},
                {"id":"CTA3PKB4PoI","title":"Bitcoin & Michael Saylor - A Masterclass in Economic Calculation (BTC005)","duration":8985},
                {"id":"ig9pu0XRtNM","title":"Bitcoin as Power to the People - Saylor & Robert Breedlove","duration":4664},
                {"id":"YsrHaQ_DOcY","title":"Rate Cuts, AI Bubbles, and Why Bitcoin Wins Either Way","duration":371},
                {"id":"TYZyaebvheQ","title":"The Roadmap for BTC Treasury Adoption in Untapped Markets | Bitcoin MENA 2025","duration":1302},
                {"id":"uFTqXnEym04","title":"How MicroStrategy is Changing Credit Markets Forever","duration":522},
                {"id":"VGkyVoNw9v8","title":"Tech Themes thru History - The Saylor Series Episode 3","duration":4592},
                {"id":"dVfmTMo_mO0","title":"Celebrating Bitcoin Price with Relaxing Michael Saylor Speaking (10H)","duration":36762},
                {"id":"wWejtrifr4w","title":"MSTR Built a 46 Year Bitcoin Safety Net. #mstr #bitcoin #digitalcredit","duration":61},
                {"id":"mjWzlAl5ss8","title":"MSTR's Bold BTC Bet | True North Podcast | Ep. 6","duration":5756},
                {"id":"0RZ1geieiao","title":"Michael Saylor on the second best crypto currency 🤭 (Lil Bubble House Remix) #bitcoin","duration":52},
                {"id":"CfgEBrerp2o","title":"Digital. Capital. Designed. | Strategy World 2026","duration":796},
                {"id":"p0RMnov0i3Q","title":"Bitcoin's BIGGEST Opportunity: Saylor's Genius Strategy Revealed!","duration":72},
                {"id":"1RV2Fpqpe48","title":"Michael Saylor in The Age of Revolution - Google Ngram viewer meme","duration":25},
                {"id":"CHwCZIp5Xnc","title":"\"And Then They Fight You\" | True North Podcast | Ep. 46","duration":6663},
                {"id":"zeKFDibW0nQ","title":"Every Company Will Be a Bitcoin Treasury Company w/ Adam Back and Tyler Evans","duration":1450},
                {"id":"WoS5GSjOP0Y","title":"True North Pulse - MSTR Q2 Earnings Explained: $11B net income & S&P 500 Hype | Jeff Walton","duration":819},
                {"id":"aFGCKwPNH4I","title":"The Defining Question of Our Time in History","duration":194},
                {"id":"D_yIKnHOuWg","title":"Michael Saylor Answers the Question of Our Time","duration":327},
                {"id":"OA3DGM0vgtM","title":"Michael Saylor Keynote - 2024 Cantor Fitzgerald Conference","duration":3539},
                {"id":"MfCGltYG2EQ","title":"Michael Saylor on Why Traditional Investors Missed Out #bitcoin #shorts","duration":60},
                {"id":"EoFVjY7AswM","title":"Focus on the Future | The Hurdle Rate Ep. 30","duration":2876},
                {"id":"oKhVBv_A9pI","title":"MSTR Q4 2025 Earnings Call: Bitcoin Is Now Backed by Politicians, Institutions & Banks","duration":391},
                {"id":"QypTOT49SnI","title":"Why Bitcoin Treasury Companies Are Embracing Volatility w/ Metaplanet, Semler Scientific & Fold","duration":1611},
                {"id":"oFJym2CKMQ8","title":"Michael Saylor's Definitive Case for Bitcoin","duration":296},
                {"id":"VVk1LohR-KE","title":"$MSTR True North - Strategy World 2025 - Digital Transformation of Investor Relations","duration":4675},
                {"id":"BYk1Id2j7_8","title":"Michael Saylor's Deep-Dive on Bitcoin Energy Misconceptions (BTC099)","duration":10450},
                {"id":"uODBZGzKdzE","title":"Why Metaplanet's Bitcoin Strategy Has Dylan LeClair Bullish","duration":62},
                {"id":"rhT9B1ZUkUY","title":"Strategy ($MSTR) Will Get To 1,000,000 BTC","duration":324},
                {"id":"g_4JdozI-nc","title":"Lil Bubble - The Orange Pill (Official Visualizer) ft. Michael Saylor","duration":145},
                {"id":"4QM0PwPOg90","title":"Strategy's ($MSTR) Bitcoin Backed Credit Products","duration":2692},
                {"id":"mBAJ-kZ1F2o","title":"The Fiat Deflation Paradox: Bitcoin & AI as the Ideal Combination for Investors  | BFC Show Ep 24","duration":2353},
                {"id":"yl2q52XWG6s","title":"Michael Saylor Predicts $400T Bitcoin After Buying $1B in a Single Day!","duration":1215},
                {"id":"8XwV0KHo92Q","title":"How much more leverage can $MSTR take on?","duration":78},
                {"id":"1s2VxdywjIY","title":"If I reach 10% of the supply, bitcoin hits $50 million - Saylor | Joe Burnett","duration":252},
                {"id":"U2Q1A75EAk8","title":"The Brutal Truth About Bitcoin #trading #mstr #strc #bitcoin","duration":65},
                {"id":"XdgP25UcHB0","title":"Bitcoin for Corporations - Saylor & Dorsey","duration":15111},
                {"id":"kFP_1ulQ4uI","title":"SaylorRain Relaxing Michael Saylor speaks on Bitcoin with rain sounds (1H)","duration":3605},
                {"id":"rHJskIc92H4","title":"The Federal Reserve Is Broken | Bitcoiners Explain Why","duration":702},
                {"id":"IzMSMzt6TDA","title":"How Bitcoin Makes FIRE a Reality w/ Trey Sellers of Unchained","duration":375},
                {"id":"0LPXxbg5r38","title":"No Days Off | True North Podcast | Ep. 38","duration":3029},
                {"id":"_wNqRmv81qY","title":"Why Strategy Buys Bitcoin Even in a Bear Market! #mstr #investing #bitcoin","duration":85},
                {"id":"fZfg1Gtcg08","title":"100% Saylor - Michael Saylor Best Moments","duration":210},
                {"id":"cVFfZ6XA6vA","title":"What if Berkshire Hathaway dumped $373B into $STRC #bitcoin #digitalcredit #mstr","duration":68},
                {"id":"DuGoa1BmEu4","title":"Bitcoin as a Generational Investment Opportunity w/ Katie Stockton, Hong Kim & Duke Waldrop","duration":1424},
                {"id":"xr52rDogbAQ","title":"\"Satoshi is the poet, Jeff Booth is the prophet, and Saylor is the prince.\"","duration":142},
                {"id":"ZcjFrIMw2sI","title":"Michael Saylor Keynote - The 2022 Atlas Society Gala","duration":1253},
                {"id":"c3E91-RGjQE","title":"EXCLUSIVE: Michael Saylor Masterclass On Bitcoin","duration":8740},
                {"id":"GYKslGw0P5I","title":"Pensions, Private Equity & Digital Credit | The Hurdle Rate Ep. 42","duration":3744},
                {"id":"b4Y88YFlGpk","title":"Amplified Bitcoin and Digital Credit | The Hurdle Rate Ep. 35","duration":4808},
                {"id":"LBKld0QdXnk","title":"Bitcoin Is Being Adopted By A Country As Sovereign Money - Pomp Podcast #585","duration":3647},
                {"id":"q9Yo9woraoE","title":"Bitcoin Long Term Capital Market Assumptions w/Matt Hougan (Bitwise CIO)","duration":1461},
                {"id":"OmrKYS2qcXw","title":"The Capital Fortress | True North Podcast | Ep. 47","duration":5291},
                {"id":"9T2Ri7IzrsE","title":"Q&A with Michael Saylor, Phong Le, James Lavish & Natalie Brunell | Strategy World 2026","duration":3267},
                {"id":"Hfdq-Wl1fRQ","title":"Michael Saylor Explains Why Going All In on Bitcoin Could Be Genius","duration":820},
                {"id":"_QN0RcQFf6w","title":"Michael Saylor on Bitcoin Principles (SLP536)","duration":10225},
                {"id":"UtY3kTlf0cI","title":"True North Now - Inside look at The Blockchain Group | Featuring Alexandre Laizet","duration":3740},
                {"id":"TfizaD0EF4I","title":"Digital Assets at Morgan Stanley | Strategy World 2026","duration":1561},
                {"id":"GUrt5xVBWMk","title":"Michael Saylor Is A Bitcoin Genius - Pomp Podcast","duration":446},
                {"id":"IdPKzulKdFI","title":"Is Michael Saylor a Threat For Owning So Much Bitcoin?","duration":257},
                {"id":"5jLPnGVm0k4","title":"T'was The Night Before Earnings | True North Podcast | Ep. 25","duration":5500},
                {"id":"ssEMtaRwra0","title":"The Saylor Series | Part 3: Bitcoin as the Ultimate Asset","duration":13151},
                {"id":"k7LEBbzVdHg","title":"Beyond HODLing: Bitcoin Yield Strategies | Bitcoin MENA 2025","duration":1383},
                {"id":"XJjH_fJ7kEI","title":"Treasury CEO: will the 4 year bitcoin cycle continue?  #bitcoinforcorporations #bitcointreasury","duration":72},
                {"id":"aixlSH2jo_4","title":"Calling The Shot | True North Podcast | Ep. 63","duration":6082},
                {"id":"UQjmBvmyfqA","title":"Listening to Michael Saylor ALL Day - Transcendental Bitcoin Meditation","duration":43},
                {"id":"nXAfbiZFvjM","title":"$MSTR True North - $STRF ATM - Investment Grade Analysis & Market Comp Simulation","duration":4321},
                {"id":"_WZ_I_xWTXk","title":"Noise in the Market | The Hurdle Rate Ep. 23","duration":3416},
                {"id":"_27ZZJXv4gw","title":"Michael Saylor & Bill Miller - Bitcoin 2023 Conference Miami","duration":1732},
                {"id":"AKqdUAhX3nA","title":"Bitcoin Is Hope ft. Michael Saylor","duration":175},
                {"id":"LnLSVgOgngc","title":"Engineering the Institutional Bitcoin Economy | Bitcoin MENA 2025","duration":1293},
                {"id":"J1STZqH_FRY","title":"Weathering The Storm | True North Podcast | Ep. 55","duration":4804},
                {"id":"JoTOaJWnZGQ","title":"MSTR & BTC Highs | True North Podcast | Ep. 4","duration":6526},
                {"id":"AX2qaZrPrlY","title":"Michael Saylor on Why Bitcoin Swings Wild #bitcoin #volatility #shorts","duration":52},
                {"id":"cPcS7mViJGE","title":"Bitwise CIO Explains Why Bitcoin Can Reach $1.3M Conservatively","duration":129},
                {"id":"b0KU4cJgj6g","title":"Michael Saylor: The Bitcoin Treasury Endgame","duration":5381},
                {"id":"Mz1LhRXwY1Q","title":"'Wall Street Has Woken Up' w/ Matt Hougan of Bitwise | BFC Show Ep. 34","duration":2968},
                {"id":"8Aofh-rx_l8","title":"This is Why Bitcoin BEATS Stocks - Michael Saylor","duration":353},
                {"id":"x1S9bQoSDUg","title":"MSTR Can Buy More BTC Than Sellers Can Sell | True North Podcast | Ep. 62","duration":5825},
                {"id":"5PkWE5sPqE4","title":"Strategy ($MSTR) Digital Credit vs The World","duration":594},
                {"id":"0yFvw8XMQuM","title":"ANALYSIS: MSTR Q3 Earnings Call | The \"BTC Refinery\" Model","duration":3456},
                {"id":"cd67ujAiuHA","title":"Banking Bitcoin: Integrating BTC into Traditional Finance | Strategy World 2026","duration":635},
                {"id":"JeIHtWg7YJQ","title":"$STRDing Toward BTC Fixed Income | True North Podcast | Ep. 28","duration":7643},
                {"id":"BYCfwMrS-VM","title":"Strategy (MSTR) Q4 2025 Earnings Call w/ Analyst Q&A","duration":7307},
                {"id":"Z-38QA3hqRs","title":"BTC v MSCI: The Fight to Keep Bitcoin Companies in Global Indexes w/ George Mekhail | BFC Show Ep 21","duration":3830},
                {"id":"s_0ggp41rT4","title":"Bitcoin Common Misconceptions - Saylor & Robert Breedlove","duration":8152},
                {"id":"yxEq_g5BIjg","title":"\"High Powered Digital Money\" | True North Podcast | Ep. 48","duration":3932},
                {"id":"GUUUF9ApuXw","title":"How Metaplanet Turns Bitcoin Treasury Strategy Into Revenue","duration":81},
                {"id":"NWgDhtCXNWA","title":"Analyst Q&A: MSTR Q3 2025 Earnings Call","duration":2179},
                {"id":"RI4xEHI7tGg","title":"Michael Saylor - PBD Podcast Ep. 212","duration":7187},
                {"id":"wdJFeSY8UVk","title":"Michael Saylor on Tucker Carlson Today - Full Interview","duration":4836},
                {"id":"JS7lOkTgER4","title":"Post $MSTR Q1 2025 Earnings call - reflections & breakdown","duration":2837},
                {"id":"3twzBeUU_HU","title":"Wall Street Could Kick These Bitcoin Companies Out","duration":133},
                {"id":"lr4EjqoV0IE","title":"📺 Bitcoin Breaks $77k + Why #Bitcoin is Better | BFC Show @ Strategy World 2026","duration":26536},
                {"id":"Ib33Jy5cOP4","title":"Why Digital Credit is the Future of Global Finance #mstr #bitcoin #finance","duration":60},
                {"id":"NTaBNGpfWaE","title":"Digital Credit is for Corporations | The Hurdle Rate Ep.49","duration":4190},
                {"id":"D446irWy6kA","title":"How Bitcoin changed his life. #mstr #bitcoin #trading","duration":83},
                {"id":"4ClRqE1Dbqs","title":"Bullish Digital Credit | The Hurdle Rate Ep.48","duration":3251},
                {"id":"CG68sLoBaGE","title":"$MSTR True North - Episode 14 - Have Space Suit, Will Travel (1/22/25)","duration":7389},
                {"id":"HHyCHEH1FGw","title":"BTC vs Gold: The Capital Base Layer Bull Thesis, Disrupting Credit Markets w/ Khing Oei | BFC Ep. 17","duration":4114},
                {"id":"flQRjxe7zpg","title":"Michael Saylor's Massive $49 Billion Bitcoin Purchase!","duration":87},
                {"id":"Y5_AtkCpfhI","title":"\"Bitcoin  Did This\" | True North Podcast | Ep. 51","duration":7264},
                {"id":"PXC0spZ2M4U","title":"Is Bitcoin Digital Gold? - Michael Saylor","duration":402},
                {"id":"24c_s3QQsWc","title":"Bitcoin for Corporations Adoption Update w/ George Mekhail | Strategy World 2026","duration":782},
                {"id":"4kWvkws8qD4","title":"$MSTR will be the biggest company in the world. #trading #investing #bitcoin","duration":78},
                {"id":"v4na2pycrcc","title":"The Future is Bitcoin with Michael Saylor - Moonshots & Mindsets","duration":5392},
                {"id":"bCj06VkJPMg","title":"Why STRC Is the Most Important Security in All of Bitcoin | Strategy World 2026","duration":504},
                {"id":"VeFTC_DzqS8","title":"Michael Saylor & Simon Gerovich Fireside Chat | Bitcoin MENA 2025","duration":1754},
                {"id":"TWSl9mdoYds","title":"Crypto bear market? Expert analyzes the impact of a Bitcoin ETF","duration":402},
                {"id":"qoDg83TKFYs","title":"Steven Lubka: Let the Super Cycle Begin | Bitcoin for Corporations Ep. 15","duration":4252},
                {"id":"hVFmgzUuioQ","title":"Will Michael Saylor's Strategy Become the Worlds MOST VALUABLE COMPANY?","duration":891},
                {"id":"eSB4VJliyww","title":"Lil Bubble - F*cking Zero (Official Visualizer) ft. Michael Saylor","duration":155},
                {"id":"XbEOeRylUCw","title":"Michael Saylor: Bitcoin, FTX, Bear Market","duration":7364},
                {"id":"59vC4JxWIQU","title":"Michael Saylor's Keynote Address - BTC in DC 2025","duration":2364},
                {"id":"IdFlPrpi5cc","title":"Build The Structure | The Hurdle Rate Ep.46","duration":2971},
                {"id":"tO2bjYx_LBg","title":"The BIGGEST Story in Finance - Why STRC will change the world!","duration":509},
                {"id":"dXix6OIU1hw","title":"Bitcoin is Digital Energy - Michael Saylor at the MIT Bitcoin Expo","duration":2830},
                {"id":"blkHhCz5_nY","title":"Tucker Carlson Interview with Michael Saylor about Bitcoin","duration":449},
                {"id":"QdKlVpR5jpU","title":"Morgan Stanley Announces New Bitcoin ETF","duration":506},
                {"id":"W9NlSAmpDFI","title":"The Dynamics of Scarcity & the Digital Gold Rush w/Dylan LeClair, Tracy Hoyos-Lopez & George Mekhail","duration":1263},
                {"id":"YXi8DybUxqM","title":"Michael Saylor & Phong Le: The Transformative Power of AI + BTC | Strategy World 2025 Keynote","duration":4719},
                {"id":"6vvp_3uftyE","title":"Methods for Generating Bitcoin Income | Strategy World 2026","duration":1131},
                {"id":"BJgIbOkyBn8","title":"Fed Signals and Equity Stakes | The Hurdle Rate Ep. 24","duration":3569},
                {"id":"KWBPeSQmn_I","title":"Michael Saylor: We Built an Investment That Solves Every Investor's Biggest Dilemma","duration":88},
                {"id":"kxBdefymFiw","title":"Bitcoin Treasuries: The Next Corporate Playbook w/ Adam Back, Siddarth Bharwani & Gurpreet Oberoi","duration":1318},
                {"id":"_Nvh_xScNPY","title":"SaylorJungle - 1 Hour Relaxing Saylor with Forest Rain Sounds","duration":3581},
                {"id":"X7847QWh8nw","title":"Volatility is Vitality | True North Podcast | Ep. 5","duration":7119},
                {"id":"S2ziezeoK4E","title":"What's Actually Happening To Bitcoin & The Economy Right Now","duration":2708},
                {"id":"ta56F9sjszk","title":"Bitcoin Is Digital Energy - Michael Saylor (Twitter Spaces Replay) Dec 28, 2021","duration":4777},
                {"id":"bjvMt0xaSUQ","title":"The Saylor Series | Part 4: The Future of Bitcoin & Civilization","duration":831},
                {"id":"gcV_7uil_0A","title":"Analyst Q&A: MSTR Q4 2025 Earnings Call","duration":2802},
                {"id":"Gy0ySjTc8p4","title":"LIVE: Strategy (MSTR) Q3 2025 Earnings Call","duration":6755},
                {"id":"WOpTi_qJUiw","title":"Bitcoin's Transaction Volume Exceeded American Express - Saylor","duration":371},
                {"id":"ItvfKfYUd0c","title":"BTC Prague 2025 - Michael Saylor FULL KEYNOTE","duration":2855},
                {"id":"gRnspOucXNg","title":"Michael Saylor - Bitcoin Zen","duration":57},
                {"id":"NT8KDT0Bjkk","title":"How ETFs Lead to More #Bitcoin w/ Matt Hougan of Bitwise","duration":412},
                {"id":"qRGGjK7oupw","title":"Bitcoin Supply Shock: Michael Saylor's Massive Accumulation!","duration":38},
                {"id":"GocJIgAY-WI","title":"Interactive Q&A with Michael Saylor & Phong Le | Strategy World 2026","duration":3267},
                {"id":"w2e3nL7xMz0","title":"Why Corporations Are Putting Bitcoin on Their Balance Sheet - Pomp Podcast #595","duration":3184},
                {"id":"547yEgp4-TM","title":"Q3 Earnings in Review | True North Podcast | Ep. 2","duration":9420},
                {"id":"MlIyPhpRFow","title":"Strategy₿ Q4 '24 Earnings Call | True North Podcast | Ep. 16","duration":7076},
                {"id":"VkHQHu5vYHs","title":"Bitcoin, AI and The New QE | The Hurdle Rate Podcast Ep.53","duration":3615},
                {"id":"IU1gzKQOYkA","title":"Mitigating Volatility: Risk-Adjusted Bitcoin Treasury Strategies with BitMEX CEO Stefan Lutz","duration":1452},
                {"id":"rp7MwBSLGHQ","title":"Michael Saylor Responds to Bitcoin in Epstein Files","duration":56},
                {"id":"tkqlubjSC9I","title":"Bitcoin, AI and The New QE | The Hurdle Rate Podcast | Ep. 53","duration":3615},
                {"id":"FDr6VQq7FjQ","title":"Commercial Banks Are Moving Into Bitcoin Credit","duration":95},
                {"id":"GrYXPqnyHdc","title":"'This Is the Product.' - Why Bitcoin Treasury Companies Actually Work","duration":220},
                {"id":"-SrOHgdyuBQ","title":"First 10 Years of Your Career are Important! #mstr #trading #retirement #financialplanning #bitcoin","duration":70},
                {"id":"9jsmGd9puYU","title":"Saylor: Bitcoin vs Real Estate - Why BTC Wins","duration":647},
                {"id":"RId-NJHsHRI","title":"Michael Saylor's Strategy Buys $1.28 BILLION more in #Bitcoin","duration":72},
                {"id":"wSwQxTq147Q","title":"Chill SaylorVibes | The Margin Call | Bitcoin Lo-fi","duration":2966},
                {"id":"KfTazf9z40w","title":"Lil Bubble - Escape The Matrix (Official Visualizer) ft. Michael Saylor","duration":153},
                {"id":"LgLUHYESVsI","title":"The Trillion Dollar Idea ($STRC)","duration":456},
                {"id":"Da6T6Jati18","title":"Strategy ($MSTR) Explained In 12 Minutes","duration":712},
                {"id":"uEPERVZWNoQ","title":"Set Up For A Supercycle | The Hurdle Rate Ep. 40","duration":2790},
                {"id":"6cfdK5PWsxI","title":"The M&A Era has Begun | The Hurdle Rate Ep. 28","duration":3033},
                {"id":"C13Dicxc1wc","title":"Bitcoin for Corporations Symposium | Bitcoin MENA 2025","duration":25802},
                {"id":"qBPtUf50XVg","title":"Saylor BEST Bitcoin Podcast: Why You NEED 0.1 Bitcoin in 2025","duration":5333},
                {"id":"RbkLz9C39y0","title":"Bitcoin's Seven Layers of Security - The Saylor Series Episode 14","duration":4721},
                {"id":"ohtsx2hGGzI","title":"Lil Bubble - Bitcoin Baby (Official Visualizer) ft. Michael Saylor","duration":234},
                {"id":"swoZxZyqpT8","title":"Michael Saylor On How Bitcoin Can Change Everything","duration":544},
                {"id":"ODPZpZfSUEM","title":"Derivatives Strategies | Strategy World 2026","duration":755},
                {"id":"-7Sw3rbIxvI","title":"Pure Play vs Operating Cash Flows: What's the Optimal Bitcoin Treasury Strategy? #BTC #Markets","duration":92}
            ]
        },
        {
            "id": "future-predictions",
            "name": "Trading & Predictions",
            "emoji": "🔮",
            "desc": "Analysis, price models & market theories",
            "color": "#8b5cf6",
            "videos": [
                {"id":"8zmzGH7RvvM","title":"PlanB and Willy Woo: Understanding the Bitcoin Market using On-Chain Data","duration":6132},
                {"id":"SdpGjry0Dtc","title":"What will be the Bitcoin Price After The Halving?","duration":25},
                {"id":"hzeAkfnuBKo","title":"PlanB: Bitcoin Will Hit $135k by Christmas! Stock-to-Flow Proof","duration":664},
                {"id":"SElcOQYfXok","title":"Bitcoin's BIG Price Prediction: $1.3M+ by 2035?","duration":69},
                {"id":"wuGElsNvHZU","title":"Bitcoin Market Cap Distribution Animation (2/28/25 Update)","duration":54},
                {"id":"WwpJY5rmP_A","title":"Bitcoin Price Distribution Animation (6/7/25 Update)","duration":55},
                {"id":"kCi1gYaIbBc","title":"Only 8 Years Until Bitcoin Hits $1 Million (The Math Proves It) - The Bitcoin Layer","duration":3043},
                {"id":"BSHZ1vjTRXo","title":"The Biggest AI Trade isnt NVDA or Anthropic. Its Bitcoin | Joe Burnett","duration":507},
                {"id":"IWUEPFAHksc","title":"Bitcoin Bull Market Support Band - Benjamin Cowen","duration":466},
                {"id":"dy2ZTOq22bQ","title":"Cathie Wood Increased Her Bitcoin Price Prediction for 2025","duration":511},
                {"id":"hrjBK6AXAMk","title":"Take The Bitcoin Orange Pill - How To Guide","duration":597},
                {"id":"93dyVDxP7K0","title":"Bitcoin Logarithmic Regression","duration":402},
                {"id":"AQ3ZnmAD_HQ","title":"The REAL Reason Bitcoin Is Crashing - And What Comes Next - The Bitcoin Layer","duration":3354},
                {"id":"qX2fbQgxJig","title":"Why Bitcoin Could Reach $64M - Luke Mikic","duration":2893},
                {"id":"LkmVUMRh9vo","title":"Bitcoin: Where In The Cycle Are We? - Benjamin Cowen","duration":547},
                {"id":"vjwFusEnfiE","title":"The Power Law Lens on Bitcoin - Santostasi","duration":864},
                {"id":"uNP-25pnOCk","title":"Bitcoin Risk Metric","duration":953},
                {"id":"Sxv6wpU1380","title":"Is This Bitcoin Final Cycle? - Luke Mikic","duration":385},
                {"id":"_rMwlS1aHFs","title":"The Physics of Bitcoins 10M Future","duration":4295},
                {"id":"i-ekbxrESqU","title":"🔴 BTC: Elliott Wave Analysis Price Prediction | Bitcoin Forecast & Key Levels | Q&A","duration":11707},
                {"id":"6WdwTR_S2Ig","title":"Bitcoin Stock-To-Flow Model","duration":763},
                {"id":"XW1GUeBe0Rs","title":"The Bitcoin Power Law WiM509","duration":8577},
                {"id":"nlvx2-3LUhM","title":"Bitcoin Power Law Explained | SLP624","duration":6396},
                {"id":"EK1QkfuDUFg","title":"$50 Weekly DCA Starting in 2021: Bitcoin vs Gold (12/23/25 Update)","duration":36},
                {"id":"2pDlaOGA2ac","title":"Bitcoin: Everything there is, divided by 21 million","duration":547},
                {"id":"l95Uf91mOo0","title":"Surviving Sun's Micronova & Pole Flip by Ben Davidson at Observer Ranch","duration":3309},
                {"id":"_FaM-IIt1bg","title":"Bitcoin Enters Bear Market Behavior, What On-Chain Metrics Are Showing - The Bitcoin Layer","duration":2727},
                {"id":"9c33ShgXBzg","title":"Big Money Wants $1 Million Bitcoin - The Bitcoin Layer","duration":122},
                {"id":"bw5Gepxo2Ps","title":"Bitcoin Network Effects Model - 10x Users = 100x Price","duration":1108},
                {"id":"pkZqnM22l8Y","title":"Bitcoin May Have Already Bottomed During War Markets - The Bitcoin Layer","duration":416},
                {"id":"Cu4wL_pmPEk","title":"Advantages of Bitcoin's Transparency by Tone Vays","duration":48},
                {"id":"KR8EZo5IesE","title":"Tom Lee: Bitcoin to  Million Path","duration":495},
                {"id":"B2cevp_ppwU","title":"Bitcoin: Compound Annual Growth Rate (CAGR) Animation (10/12/25 Update)","duration":43},
                {"id":"1nsIy7PWXyY","title":"Bitcoin Price Analysis - Key Levels","duration":782},
                {"id":"JLuTDwclOP0","title":"The Resilience of Stock-to-Flow with PlanB - Bitcoin Standard Podcast","duration":6906},
                {"id":"zW6Ktg0GygE","title":"Bitcoin: Lengthening Cycles, Stock-to-Flow, and the Four Year Cycle","duration":2998},
                {"id":"Q9C4jbZoxIE","title":"BITCOIN PUMPING: Fed Cuts, Liquidity, & The Next Breakout - The Bitcoin Layer","duration":1315},
                {"id":"D8QuMzEnvvM","title":"Bitcoin Bear Market: SOPR Signals Losses as Liquidity Rolls Over - The Bitcoin Layer","duration":439},
                {"id":"6ULmQlHKO7w","title":"Private Q&A - Technical Analysis & Bitcoin - September 27th, 2021","duration":1307},
                {"id":"MzxIZ4_f3e0","title":"JUST IN - 94.5% of the 21 million bitcoin has now been mined!","duration":105},
                {"id":"LU5RqsGwvBg","title":"Bitcoins Path to M: Schwab","duration":401},
                {"id":"uF6Wx4Hr6iU","title":"Tom Lee: Bullish Bitcoin Outlook & Corporate Treasuries - Coin Stories","duration":1907},
                {"id":"npw_L5TKoYc","title":"Bitcoin Market Cycles","duration":887},
                {"id":"sY3Mpl061Bg","title":"Private Q&A - Technical Analysis & Bitcoin - September 22nd - 24th, 2021","duration":2852},
                {"id":"hIy9mb0-uSs","title":"Bitcoin Price Levels to Watch: Short-Term Holders in Control - The Bitcoin Layer","duration":2017},
                {"id":"tPQs6eQ4zIU","title":"Stock to Flow - Prediciting Price?","duration":578},
                {"id":"DDk6-tdHeXQ","title":"Bitcoin Technical Analysis - Elliott Wave","duration":2078},
                {"id":"wksv5U_y4S4","title":"Unconfiscatable 2022 - Scammy Awards!!!","duration":4157},
                {"id":"lyTHPcHDOk8","title":"Rational Root: Bitcoin Will Hit $600k then $6 Million","duration":1268},
                {"id":"jzY_SxnTLNA","title":"Bitcoin Is the Economic Singularity - Luke Mikic","duration":1168},
                {"id":"8jUsgjRhxlI","title":"JUST IN - 95% of the 21 million bitcoin has now been mined!","duration":108},
                {"id":"iDgDl9jzEmk","title":"Bitcoin Price Prediction Models Explained","duration":1227},
                {"id":"G6-oiCC4hyg","title":"Bitcoin, AI, MSTR, and Why Fear Creates Opportunity | Tad Smith | Joe Burnett","duration":3552},
                {"id":"_dKDHAsNAV4","title":"JUST IN - 94% of the 21 million bitcoin has now been mined!","duration":99},
                {"id":"0zUmhXgotMg","title":"HERE COMES VANGUARD: Why Bitcoin Hits New All-Time Highs in 2026 - The Bitcoin Layer","duration":2998},
                {"id":"HOOvX4evAVc","title":"Trading Panel from Future Blockchian Summit - Dubai","duration":1544},
                {"id":"lN0vjNEIRJA","title":"Bitcoin Halving Progress Animation (9/6/25 Update)","duration":21},
                {"id":"yG3QiyCLoDA","title":"Bitcoin Halving Progress Animation (9/12/24 Update)","duration":99},
                {"id":"9gyreHKE5XY","title":"BITCOIN'S 4-YEAR CYCLE NEVER EXISTED | Next Bubble 2027 w/ Stephen Perrenod - The Bitcoin Layer","duration":3441},
                {"id":"BpKfLfGbf0Q","title":"Bitcoin Hyperbitcoinization: $1.5M by 2028?","duration":1562},
                {"id":"6CiFVI24CXM","title":"Bitcoin Risk Metric: How I Navigate Crypto","duration":1152},
                {"id":"lGhFX4Pwj6Y","title":"Technical Analysis is Hard (until you see this)","duration":1295},
                {"id":"ul34Jfh-LOk","title":"How to Read Candlestick Charts (with ZERO experience)","duration":3318},
                {"id":"BIQd1sbXVRU","title":"BTC012: Bitcoin On-Chain Analysis W/ Plan B & Willy Woo","duration":4103},
                {"id":"W3SKpO0q9QI","title":"Roadmap To Crypto's $10 Trillion Market Cap - Ben Cowen","duration":4421},
                {"id":"o33kMV2z_-U","title":"Bitcoin Rainbow Chart Explained (Halving Price Regression)","duration":97},
                {"id":"ppQfJMY9yYA","title":"BITCOIN CRASHES THROUGH $100,000 While Macro Volatility Surges & Trend Structure Weakens - The Bitcoin Layer","duration":928},
                {"id":"lHhbd9n6c-w","title":"jack mallers bitcoin price prediction","duration":45},
                {"id":"yhcbMUh3YTo","title":"The Generational Bitcoin Price Run Begins","duration":749},
                {"id":"ym28FC_tbNM","title":"The Bitcoin Halving: Why use the bitwise shift operation?","duration":553},
                {"id":"PubdncDgCYw","title":"The Bitcoin Halving Cycle Explained","duration":274},
                {"id":"cmcavhda5hE","title":"Bitcoin Halving Cycle Profit Indicator","duration":422},
                {"id":"CJiQBVnbdpI","title":"jack mallers bitcoin price prediction","duration":45},
                {"id":"Z51vRLKvco4","title":"Retiring on 0.1 Bitcoin - Luke Mikic","duration":3350},
                {"id":"bPYl1-KBE50","title":"The Ultimate Orange Pill - Bitcoin & Risk","duration":1784},
                {"id":"wOi9XqeJy2E","title":"Cathie Wood - New 2025 Prediction for Bitcoin & Ethereum","duration":1108},
                {"id":"44kS3j5L8AA","title":"Bitcoin Breakout or Fade: $119,000 Test & Market Behavior - The Bitcoin Layer","duration":2495},
                {"id":"_OfHZJWYZ5g","title":"$10,000,000 Bitcoin by 2035 is still possible. Heres how | Joe Burnett","duration":333},
                {"id":"wjObfPHlPOk","title":"Understanding S2F Live Charts","duration":305},
                {"id":"3DijExIkark","title":"Bitcoin On-Chain Analysis: MVRV Z-Score Explained","duration":452},
                {"id":"ceiVXjXrEcI","title":"Bitcoin Market Cycle ROI: Different perspectives","duration":1716},
                {"id":"eynxyoKgpng","title":"The Only Technical Analysis Video You Will Ever Need (Full Course)","duration":4655},
                {"id":"jqSVCD6GC4E","title":"Private Q&A - Technical Analysis & Bitcoin - October 4th, 2021","duration":4261},
                {"id":"eOyWMANRkVI","title":"The One Bitcoin Chart That You Need For Success In 2025","duration":515},
                {"id":"C9KPRcmFJWI","title":"Bitcoin to $180K - Pomp Investments Prediction","duration":2361},
                {"id":"GzZecXEUJTI","title":"Realistically Reaching  Million","duration":840},
                {"id":"UokvHHmx_Po","title":"Bitcoin: Risk Analysis and Predictions","duration":1287},
                {"id":"PthPuVb1s9k","title":"$50 Weekly DCA: NASDAQ vs Bitcoin (1/23/25 Update)","duration":47},
                {"id":"iww09Eeql_o","title":"PlanB: Stock-to-Flow Model & Future Price Predictions","duration":602},
                {"id":"6zFglF1aMKc","title":"Will 1 Bitcoin Be Generational Wealth? Whales Selling, Legacy Planning & Price Drivers","duration":3443},
                {"id":"rF4PfhMI084","title":"Bitcoin Unit of Account Animation (12/4/25 Update)","duration":46},
                {"id":"EBs-Nmp2T8k","title":"When Will The Bitcoin Bull Market End? Halving Cycle Analysis","duration":602},
                {"id":"yM06uqse6Ks","title":"The Science Behind M Bitcoin","duration":5433}
            ]
        },
        {
            "id": "tutorials",
            "name": "Tutorials, Builders & DIY",
            "emoji": "📚",
            "desc": "Learn Bitcoin step by step - tutorials, builder stories & DIY hardware projects",
            "color": "#f7931a",
            "videos": [
                {"id":"kGa1ji7sxtA","title":"Oil Trade Getting Worse - Warren Buffet Sends Warning Every Bitcoiner Must Hear","duration":1858},
                {"id":"JbxmMy0AprA","title":"EP14: Bitcoin and the (R)Evolution of Media w/ Nico, Host - SimplyBitcoin","duration":3185},
                {"id":"_Qxm70pFM4E","title":"Bitcoin Quantum Exposure Dashboard - Walkthrough","duration":992},
                {"id":"1LhcDJ8bgQU","title":"Bitcoin RBF (Replace By Fee) Tutorial","duration":1077},
                {"id":"rKjce1jCxSM","title":"Bitcoin Beginner Mistakes to Avoid","duration":1812},
                {"id":"FEBRIQeiqfg","title":"How To Make A USB #Crypto Wallet | OFFLINE STORAGE | DIY/Tutorial | 2022","duration":678},
                {"id":"6rpTjEpvUtc","title":"i automated my home lab (and CLOUD) with Ansible","duration":764},
                {"id":"ZWUGS92Dv8U","title":"The LAST Phase of Building the New World Order Is Here | Simon Dixon","duration":4451},
                {"id":"P-5aFxDNqFs","title":"EP26: Accounting For Bitcoin w/ Joe Wood, Founder - Satoshi Pacioli Accounting Services","duration":3247},
                {"id":"9ExAt9EUCNc","title":"How to be remembered forever","duration":463},
                {"id":"O1KaAboPX44","title":"How To Buy Bitcoin For Beginners | Step by Step","duration":586},
                {"id":"nCaGVYx3rgo","title":"How to get your Amazon ESP32 2432S028 to work as a NerdMiner","duration":1144},
                {"id":"mOCUqbFQ57o","title":"Bitcoin Daily DCA & HODL Animation Walkthrough","duration":695},
                {"id":"95FonGULBtc","title":"EP6: Bitcoin, Beef, and Building Locally w/ Texas Slim, Founder - The Beef Initiative","duration":3002},
                {"id":"J7fz0zOg72o","title":"The Secret War Between Trump and China Nobody Is Talking About","duration":1239},
                {"id":"TCU-soMs1wY","title":"Trace Mayer at the Bitcoin/Cryptocurrency Workshop on 3/15/15","duration":3262},
                {"id":"IyW9Dn_--ME","title":"The BEST Home Bitcoin Miner in 2025","duration":697},
                {"id":"_ZnTkrCjavs","title":"How To Play the Bitcoin Lottery (It's Easier Than You Think)","duration":597},
                {"id":"4Lsr7lsy6Tk","title":"Unlocking the World: How Cryptocurrency is Transforming Travel for the Modern Explorer","duration":79},
                {"id":"5_p9tGq43Xw","title":"Making $40 A DAY With A Cellphone Crypto Home Miner","duration":851},
                {"id":"iTno3A4jE0Y","title":"Bitcoin & Liquidity Academy 1: Understanding Balance Sheets, Capital, and Treasuries","duration":1548},
                {"id":"Gc2en3nHxA4","title":"What is Bitcoin - Simply Explained","duration":97},
                {"id":"Y3iAwLG6NlA","title":"Bitcoin Wallets and Hardware That Change Everything in 2026","duration":1907},
                {"id":"vyJ4EvjXDcg","title":"EP21: Building (Multiple) Bitcoin Businesses w/ Marty Bent, Founder - TFTC","duration":2891},
                {"id":"_WS4TiOvLFM","title":"Gold Nugget NerdMiner 2 Lottery Miner (Bitcoin Merch) - Setup and Reset Guide","duration":336},
                {"id":"AFoQ6Ymj8-w","title":"EP22: Risk Management through Miniscript w/ Rob Hamilton, Co-Founder & CEO - AnchorWatch","duration":2451},
                {"id":"tuUO-Q4_b5c","title":"How to Buy Bitcoins in 2024? (4 different methods reviewed)","duration":590},
                {"id":"dy3vzz9pa3g","title":"SegWit and BIP-110 Signaling Dashboard - Walkthrough","duration":469},
                {"id":"GR-E0aaFf0c","title":"Bitcoin Billionaire's Playlist 🚀💎 - LoFi That Elevates Wealth & Vision","duration":2759},
                {"id":"mibKrTvtlyQ","title":"Misty Breez BITCOIN Wallet: Setup in 5 Minutes! FULL TUTORIAL 2025","duration":1822},
                {"id":"m78wkn9Drdk","title":"Why Everyone's Wrong About the Bitcoin Bottom | James Check","duration":3492},
                {"id":"qeBpYPcx1wg","title":"Build & Run Your Own Bitcoin Node On A Raspberry Pi","duration":516},
                {"id":"-wB6Si4jZYc","title":"How the Bitcoin Halving Works (Code Walkthrough)","duration":737},
                {"id":"4cXIUrCQExg","title":"How to mine BITCOIN with your PC or Laptop!","duration":667},
                {"id":"niXxUrpkoRA","title":"How To Create Infinite Bitcoin Wallets (Passphrase)","duration":714},
                {"id":"iU2I1TchOB8","title":"Bitcoin UTXO Count Back Below 170m","duration":41},
                {"id":"I3Qld_HXQuM","title":"ELSAT | Nostrability | NOSTR WORKSHOPS | BITBLOCKBOOM 2024","duration":2961},
                {"id":"H47wmnfASds","title":"EP4: Bitcoin is Hard. Bitcoin is Easy. w/ Justine Harper, VP, BD - Unchained Capital","duration":2762},
                {"id":"l0dzOwyPqFI","title":"How to make passive income running blockchain nodes","duration":576},
                {"id":"_EdlTGOD9jg","title":"Francis Pouliot Drops a TRUTHBOMB About Bitcoin","duration":104},
                {"id":"xAwbhE8EXAw","title":"EP7: What to Expect at TABConf w/ Co-Organizer Michael Tidwell","duration":3616},
                {"id":"-oujfwYj-zc","title":"Bitcoin Node Count Dashboard - Walkthrough","duration":352},
                {"id":"cgzH1jScIn0","title":"Bitcoin NFTs - Ordinals Explained Full Guide 🎮 On Wallet Setup & Mint - English","duration":987},
                {"id":"TTS0Ufkv4xc","title":"EP9: Designing for Bitcoin w/ Stephen DeLorme, Designer - Bitcoin Design Community","duration":3158},
                {"id":"GSTnvQyuXEE","title":"Setup Core Lightning And Zeus Bitcoin Wallet","duration":4473},
                {"id":"IxgNp2h5j8w","title":"How To Buy, Use and Secure Bitcoin","duration":1632},
                {"id":"N6ax-ZmTsDc","title":"EP23: Tangible Tools for Digital Money w/ NVK, Co-Founder & CEO - Coinkite","duration":2882},
                {"id":"4PvA7oYDXu8","title":"Crypto Wallets Explained (Beginners Guide 2025)","duration":1090},
                {"id":"Xjrq1f3pNMY","title":"EP5: Bitcoin Across America w/ Sidd, Writer and Rider - Bitcoin Tour of America","duration":3693},
                {"id":"cRRB_WzZpTM","title":"BIP85: Segregated Bitcoin Accounts From One Seed (UNCLE JIM MODE)","duration":3915},
                {"id":"9FE4mTr_6EI","title":"How to Set Up a Bitcoin Node with Raspberry Pi & MyNode (Step-by-Step Guide)","duration":1062},
                {"id":"lVhdpmhYxbI","title":"EP28: Facilitating FOSS Development w/ Haley Berkoe, Program Manager - Spiral","duration":3108},
                {"id":"FwjX6ija9iM","title":"Simple Bitcoin Wallet Tutorial - BTC, Lightning and Hardware","duration":1394},
                {"id":"cBKrrKzZSd4","title":"EP18: Stay Humble, Stack Stats w/ Matt Odell, Bitcoiner","duration":3521},
                {"id":"dCAr2urEe1o","title":"ENTROPIA - Generate Permissionless Bitcoin Wallets","duration":2461},
                {"id":"ri38Nc-Rrzg","title":"How To Set Up Your OWN Bitcoin Node FOR FREE!!! + SOLO Mine To It","duration":892},
                {"id":"z22HnACwl7k","title":"The Banks Know Something Terrifying About AI - And They're Not Telling You","duration":1635},
                {"id":"bvUxEFGfVi8","title":"EP20: Bitcoin Changes Everything w/ P, Programming Director - Swan Bitcoin","duration":3258},
                {"id":"4YoPN1Oa8Ys","title":"WSB Update & BIP-110 Signaling Dashboard Update","duration":297},
                {"id":"LsR11IQESCs","title":"$40k or $80k - Two of The Smartest People In Bitcoin Just Told Us Which","duration":486},
                {"id":"9uodS6FBsdw","title":"How to Choose the BEST Cold Wallet for 2026","duration":653},
                {"id":"9JKpA7gqbW0","title":"How To Run Your Own Bitcoin Node (And Fight Bitcoin Spam)","duration":816},
                {"id":"peCazF38jBQ","title":"I Mined Bitcoin for 24 Hours on a Raspberry Pi","duration":673},
                {"id":"EARJ_b1C1HU","title":"$25 USB Nerd Miner Setup | Bitcoin Merch Guide","duration":269},
                {"id":"hluk1tQun78","title":"Understanding The Fed's Balance Sheet with Andy Constan","duration":3841},
                {"id":"VpDhVS79eG0","title":"The Quantum 'Fix' Is A Backdoor To Bitcoin - And BlackRock Knows It","duration":1250},
                {"id":"qAKdgQiPTTQ","title":"Lawrence Lepard Warns \\\"Most People Will Miss This Bitcoin Opportunity - DON'T Let It Be You\\\"","duration":90},
                {"id":"2Z1BzwxdP4I","title":"ALBY HUB - Run A Bitcoin Lightning Node TUTORIAL","duration":4436},
                {"id":"ltZEZM7OEu0","title":"EP11: Bringing Bitcoin to Local Business w/ Michael Atwood, Founder - Oshi","duration":3270},
                {"id":"z9Li4I2onqk","title":"Sparrow Desktop Workshop - Bitcoin 2023","duration":1647},
                {"id":"01VQpFPCMek","title":"Nerd Miner 2 How to set up on your home or office Wi-Fi from start to hashing coins","duration":1175},
                {"id":"zEFEoBZfpb4","title":"How to Set Up Your Nerdminer v2 / NMminer | Full Configuration Guide","duration":253},
                {"id":"LxTkLwpV1Po","title":"Permissionless Bitcoin Wallets - They Cannot Be Stopped!","duration":3492},
                {"id":"XwMiBkh_svE","title":"Tutorial - Sending and Receiving Multi-Signature Wallet","duration":1301},
                {"id":"kgaUK47CEPY","title":"EP25: Making Bitcoin Accessible w/ Conor Okus, Product Manager - Spiral","duration":3270},
                {"id":"5GCBWyHkklc","title":"EP2: Bringing Bitcoin to the World w/ Ben Price, Co-Founder & CEO The Bitcoin Company","duration":3272},
                {"id":"yJpvfRl03Tw","title":"How To Use Sparrow Bitcoin Wallet - In Depth Tutorial","duration":6803},
                {"id":"Ld2s9MyMKMU","title":"Fastest way to build a Bitcoin Node in 2024!","duration":532},
                {"id":"OZK5hdKfb18","title":"Bitcoin Bulls Eye Major Breakout","duration":2955},
                {"id":"v06TBoxUsAs","title":"Setup tutorial - Specter Shield (Lite) with BlueWallet","duration":1349},
                {"id":"GbEJ0neZkxQ","title":"WSB Update & Bitcoin Dominance Dashboard - Walkthrough","duration":469},
                {"id":"QTmI7PXNZhI","title":"CH1: Post-Show Recap w/ Justine Harper, VP, BD - Unchained Capital","duration":2561},
                {"id":"ZpX1wNchiD4","title":"EP17: Bitcoin Just Works w/ Harry Sudock, VP, Strategy - Griid","duration":3087},
                {"id":"qLHewsI_iqA","title":"\\\"If It Stays Closed, They Know It's Over\\\" - Trump Can't Execute Global Reset | Simon Dixon & Lepard","duration":1193},
                {"id":"sO3_c3dfTeU","title":"Easily MINE BITCOIN With The Avalon Nano 3S (You could win $300,000!) Unboxing and Tutorial","duration":3691},
                {"id":"X0aaySypick","title":"Bitcoin & Liquidity Academy 3: Primary Dealers, U.S. Treasuries & the Fed","duration":1318},
                {"id":"4cRCkhqvUYc","title":"{Full Tutorial} Start and Manage a Bitcoin Lightning Node","duration":6048},
                {"id":"nZOlb69FF6k","title":"AI Will COLLAPSE the Financial System - Here's How to Survive (and Thrive)","duration":581},
                {"id":"gLCyRFZOdGQ","title":"How to Run a Bitcoin Lightning Node","duration":2813},
                {"id":"pcbYq2LCWwk","title":"LIQUIDITY Explained SIMPLY: How It Really Moves BITCOIN","duration":1007},
                {"id":"k6QuA2KWQvY","title":"HOW TO MAKE YOUR OWN NERD MINER V2 #BITCOIN #crypto #btc #cryptocurrencymining #crypto","duration":479},
                {"id":"TpwnoPUyumA","title":"Phoenix BITCOIN Wallet: Lightning Self Custody MADE EASY! FULL TUTORIAL 2025","duration":4158},
                {"id":"9SUdFCRf-dc","title":"EP12: Building Community with Bitcoin w/ Yusuf Nessary - Built With Bitcoin Foundation","duration":2856},
                {"id":"GKXQiDhRy34","title":"LIGHTNING SESSION: How To Back Up A Bitcoin Wallet","duration":130},
                {"id":"lhzooru_B-o","title":"How to Set Up a Bitcoin Node for just $300 | Step-by-Step Guide","duration":2148},
                {"id":"B4-fIKroG_M","title":"How to make a 3$ usb drive into a secure crypto wallet","duration":593},
                {"id":"Tr1bntrBOY0","title":"Bitcoin & Liquidity Academy 2: How $37 Trillion in US Debt Shapes Global Markets - The Bitcoin Layer","duration":1549},
                {"id":"_j4aSynAiX0","title":"How Multi-Sig Makes All Bitcoiners Safer","duration":702},
                {"id":"MlHa66QdLH4","title":"Bitcoin Difficulty Epoch 416 Walkthrough","duration":147},
                {"id":"JdatHrGUHO0","title":"EP27: Devs Who Can Hack It w/ Alekos Filini & Daniela Brozzoni, Developers - BDK, Founders - hack.bs","duration":3125},
                {"id":"7IeGjkAvvyI","title":"Every Investor Is About To Get Blindsided By Bitcoin (James Check)","duration":1591},
                {"id":"gH0DkA_VGQg","title":"EP10: Learning (and Earning) with Lightning w/ Nate, Education and Support - Voltage","duration":2875},
                {"id":"c8ytiynbnpk","title":"Your First Bitcoin Wallet - BTC Sessions","duration":2555},
                {"id":"SPP81mGYeZw","title":"If I Wanted to Secure My Crypto in 2026, I'd Do THIS","duration":923},
                {"id":"pDSQVX8oQSA","title":"How to Send Crypto TO Cold Wallets (BEGINNER'S GUIDE)","duration":575},
                {"id":"krrUQGMKhPo","title":"Bitcoin UTXO Consolidation Tutorial","duration":879},
                {"id":"P0yBusy5_Zc","title":"HOW TO BUILD A BITCOIN NODE","duration":287},
                {"id":"aAf0rilUfe4","title":"'There's 0% Chance My Bitcoin Can Be Stolen' - Terrence Michael","duration":99},
                {"id":"pgYBgXFqIjw","title":"EP13: The Beefsteak w/ awayslice, the Beefsteak Guy","duration":2860},
                {"id":"281Gal2xztI","title":"Bitcoin Quantum Exposure Dashboard (FULL) - Download & Walkthrough","duration":1419},
                {"id":"XFoJUhxBAPQ","title":"EP1: Meet Me in the Mempool w/ @wiz, Co-Founder & CEO Mempool.space","duration":2941},
                {"id":"ZcsLaDoVPNU","title":"CH2: Post-Show Recap w/ Sidd, Writer and Rider - Bitcoin Tour of America","duration":3260},
                {"id":"bsAznpEupIg","title":"Easiest Bitcoin Wallet Setup (Aqua) - BTC Sessions","duration":2132},
                {"id":"wWnUvCNeYEo","title":"Crypto Wallets Explained! (Beginners' Guide!) 📲 🔑 (2025 Edition!) ⭐⭐⭐⭐⭐ Ultimate Step-by-Step! 😎","duration":1199},
                {"id":"XvZ2GUg-KMk","title":"Walker America Delves Into Bitcoin's Secret Trojan Horse","duration":101},
                {"id":"W6uYVBAuYq0","title":"Do Not Download This Fake Bitcoin App ($Millions Already Stolen)","duration":1243},
                {"id":"1gH33qosYXU","title":"EP16: Category Creation: Proof-of-Funds w/ Sam Abbassi, CEO - Hoseki","duration":2918},
                {"id":"rt5gqE0DsSk","title":"The Last Oil Crisis - Gold Did Something NOBODY Expected | Prof. St Onge","duration":115},
                {"id":"3xw-lMBbMds","title":"Why & How to Run a Bitcoin/Lightning Node w/ MyNode","duration":1198},
                {"id":"6b0xTB2sE8E","title":"Why You NEED The Bull Bitcoin Wallet: Full Tutorial","duration":5663},
                {"id":"3Grj3Datdfw","title":"No One Is Talking About This GAME-CHANGING Bitcoin Wallet | Cove Tutorial w/BTC Sessions","duration":1893},
                {"id":"KT8zri-XN58","title":"EP24: Mastering Miner Management w/ Dan Lawrence, Co-Founder & CEO - OBM, Inc./Foreman","duration":3213}
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
        // serverTimestamp() for authoritative staleness filtering across clients, PLUS
        // a client-side millisecond timestamp so the local snapshot (which sees ts=null
        // while the server write is pending) can still fall back to a real value and
        // keep the viewer counted without blinking out.
        ts: firebase.firestore.FieldValue.serverTimestamp(),
        tsClient: Date.now()
    }).catch(function() {});
}

function joinStation(stationId) {
    // Track views by comparing against our OWN last-joined marker - NOT _currentStation,
    // because callers set _currentStation BEFORE invoking us, which would mask transitions.
    var prevJoined = window._tctvLastJoined || null;
    if (prevJoined && prevJoined !== stationId) _deletePresence();
    _currentStation = stationId;
    _writePresence(stationId);
    // Count a view whenever we tune in to a different station than last time
    // (including the very first tune-in when prevJoined is null).
    if (prevJoined !== stationId) {
        _bumpTctvViews();
        window._tctvLastJoined = stationId;
    }
    if (_viewerHeartbeat) clearInterval(_viewerHeartbeat);
    _viewerHeartbeat = setInterval(function() {
        if (_currentStation) _writePresence(_currentStation);
    }, 30000);
    // Render the viewer badges immediately so the user sees themselves as a viewer
    // without waiting for the Firestore snapshot round-trip.
    try { updateViewerBadges(); } catch(e) {}
    if (!_viewerUnsub && typeof firebase !== 'undefined' && firebase.firestore) {
        var db = firebase.firestore();
        _viewerUnsub = db.collection('tctv_presence').onSnapshot(function(snap) {
            var counts = {};
            var now = Date.now();
            snap.forEach(function(doc) {
                var d = doc.data();
                if (!d.station) return;
                // Prefer server timestamp; when pending (ts=null for local-only writes),
                // fall back to the client timestamp we now also write. This avoids the
                // "blink out" where a viewer briefly shows as 2 then drops to 1 while
                // the server timestamp round-trips.
                var docTime = 0;
                if (d.ts && d.ts.toMillis) docTime = d.ts.toMillis();
                else if (typeof d.tsClient === 'number') docTime = d.tsClient;
                if (!docTime) return;
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

function _leavePresence() {
    // Full teardown: stop heartbeat, delete presence doc, unsubscribe from snapshot
    if (_viewerHeartbeat) { clearInterval(_viewerHeartbeat); _viewerHeartbeat = null; }
    if (_currentStation) { _deletePresence(); _currentStation = null; }
    window._tctvLastJoined = null;
    if (_viewerUnsub) { try { _viewerUnsub(); } catch(e) {} _viewerUnsub = null; }
    if (_tctvPeakUnsub) { try { _tctvPeakUnsub(); } catch(e) {} _tctvPeakUnsub = null; }
    if (_tctvViewsUnsub) { try { _tctvViewsUnsub(); } catch(e) {} _tctvViewsUnsub = null; }
    _tctvPeakLastWriteAt = 0;
    _viewerCounts = {};
    // Hide peak tooltip if visible
    try { if (typeof window.tctvHidePeakTip === 'function') window.tctvHidePeakTip(); } catch(e) {}
}

// Clean up presence when user closes tab / navigates away
(function installPresenceUnload() {
    if (typeof window === 'undefined') return;
    if (window._tctvPresenceUnloadInstalled) return;
    window._tctvPresenceUnloadInstalled = true;
    var bye = function() {
        if (_currentStation) {
            try { _deletePresence(); } catch(e) {}
        }
    };
    // pagehide is the most reliable cross-browser (also fires on iOS Safari BFCache)
    window.addEventListener('pagehide', bye);
    window.addEventListener('beforeunload', bye);
    // visibilitychange: when tab is hidden for a while, stop heartbeat to avoid ghost presence
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') {
            // Pause heartbeat but keep current station - if they come back in <65s we still count
            if (_viewerHeartbeat) { clearInterval(_viewerHeartbeat); _viewerHeartbeat = null; }
        } else if (document.visibilityState === 'visible' && _currentStation && !_viewerHeartbeat) {
            // Resume heartbeat + immediate write
            _writePresence(_currentStation);
            _viewerHeartbeat = setInterval(function() {
                if (_currentStation) _writePresence(_currentStation);
            }, 30000);
        }
    });
})();

// ── TCTV Public Counters ───────────────────────────────────────────────────
// tctv_stats/views { count: number, ts: serverTimestamp }
// tctv_stats/peak  { peak:  number, ts: serverTimestamp }
// Everyone (anon + auth) can write. Rules enforce value shape.
var _tctvPeak = 0;
var _tctvTotalViews = 0;
var _tctvPeakUnsub = null;
var _tctvViewsUnsub = null;
var _tctvPeakLastWriteAt = 0;

function _subscribeTctvStats() {
    if (typeof firebase === 'undefined' || !firebase.firestore) return;
    var fs = firebase.firestore();
    if (!_tctvPeakUnsub) {
        try {
            _tctvPeakUnsub = fs.collection('tctv_stats').doc('peak').onSnapshot(function(doc) {
                _tctvPeak = (doc.exists && doc.data() && doc.data().peak) || 0;
            });
        } catch (e) {}
    }
    if (!_tctvViewsUnsub) {
        try {
            _tctvViewsUnsub = fs.collection('tctv_stats').doc('views').onSnapshot(function(doc) {
                _tctvTotalViews = (doc.exists && doc.data() && doc.data().count) || 0;
            });
        } catch (e) {}
    }
}

// Bump tctv_stats/views atomically via transaction so concurrent +1s don't clobber.
function _bumpTctvViews() {
    if (typeof firebase === 'undefined' || !firebase.firestore) return;
    var fs = firebase.firestore();
    var ref = fs.collection('tctv_stats').doc('views');
    fs.runTransaction(function(tx) {
        return tx.get(ref).then(function(doc) {
            var ts = firebase.firestore.FieldValue.serverTimestamp();
            if (!doc.exists) {
                tx.set(ref, { count: 1, ts: ts });
            } else {
                var cur = (doc.data() && doc.data().count) || 0;
                tx.update(ref, { count: cur + 1, ts: ts });
            }
        });
    }).catch(function() { /* race with another client - they got the +1 */ });
}

function _maybeBumpTctvPeak(currentTotal) {
    // Only attempt if we appear to beat the current peak. Rate-limit per client.
    if (!currentTotal || currentTotal <= _tctvPeak) return;
    var now = Date.now();
    if (now - _tctvPeakLastWriteAt < 30000) return;
    _tctvPeakLastWriteAt = now;
    if (typeof firebase === 'undefined' || !firebase.firestore) return;
    var fs = firebase.firestore();
    var ref = fs.collection('tctv_stats').doc('peak');
    // Use a transaction so we only bump if our value is still greater than latest server state.
    fs.runTransaction(function(tx) {
        return tx.get(ref).then(function(doc) {
            var ts = firebase.firestore.FieldValue.serverTimestamp();
            var existing = (doc.exists && doc.data() && doc.data().peak) || 0;
            if (currentTotal > existing) {
                if (!doc.exists) tx.set(ref, { peak: currentTotal, ts: ts });
                else tx.update(ref, { peak: currentTotal, ts: ts });
                _tctvPeak = currentTotal;
            }
        });
    }).catch(function() { /* another client raised it first - fine */ });
}

window.tctvShowPeakTip = function(ev) {
    var el = document.getElementById('tctv-main-viewers');
    if (!el) return;
    var existing = document.getElementById('tctv-peak-tip');
    if (existing) existing.remove();
    var tip = document.createElement('div');
    tip.id = 'tctv-peak-tip';
    function fmt(n) { return (n || 0).toLocaleString('en-US'); }
    tip.innerHTML =
        '<div style="display:flex;justify-content:space-between;gap:18px;"><span style="color:#aaa;">Total:</span><strong style="color:#fff;">' + fmt(_tctvTotalViews) + '</strong></div>' +
        '<div style="display:flex;justify-content:space-between;gap:18px;margin-top:4px;"><span style="color:#aaa;">Peak:</span><strong style="color:#f7931a;">' + fmt(_tctvPeak) + '</strong></div>';
    tip.style.cssText = 'position:fixed;z-index:300001;background:#111;color:#fff;font-size:0.8rem;padding:10px 14px;border-radius:8px;border:1px solid rgba(247,147,26,0.4);box-shadow:0 4px 14px rgba(0,0,0,0.6);pointer-events:none;min-width:150px;line-height:1.4;white-space:nowrap;';
    document.body.appendChild(tip);
    // Position below the counter
    var rect = el.getBoundingClientRect();
    var tipW = tip.offsetWidth || 200;
    var x = Math.max(8, Math.min(window.innerWidth - tipW - 8, rect.right - tipW));
    var y = rect.bottom + 8;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    // Auto-hide after 3s (handles tap-and-release on touch)
    if (window._tctvPeakTipTimer) clearTimeout(window._tctvPeakTipTimer);
    window._tctvPeakTipTimer = setTimeout(function() {
        var t = document.getElementById('tctv-peak-tip');
        if (t) t.remove();
    }, 3000);
};

window.tctvHidePeakTip = function() {
    var existing = document.getElementById('tctv-peak-tip');
    if (existing) existing.remove();
    if (window._tctvPeakTipTimer) { clearTimeout(window._tctvPeakTipTimer); window._tctvPeakTipTimer = null; }
};

// --- BlockSurf ---
// Auto-change the active station every time a new Bitcoin block is mined.
// Polls mempool.space /api/blocks/tip/height every 20s while TCTV is open and
// BlockSurf is toggled ON. First poll is used as the baseline; any subsequent
// increase triggers window.switchStation() to a random different station.
window._blockSurfHeight = null;
window._blockSurfTimer = null;

function _blockSurfApplyToggleStyles() {
    var btn = document.getElementById('tctv-blocksurf-toggle');
    var dot = document.getElementById('tctv-blocksurf-dot');
    if (!btn) return;
    var on = btn.getAttribute('aria-pressed') === 'true';
    btn.style.border = '1px solid ' + (on ? '#f7931a' : '#333');
    btn.style.background = on ? 'rgba(247,147,26,0.18)' : 'rgba(255,255,255,0.04)';
    btn.style.color = on ? '#f7931a' : '#888';
    if (dot) {
        dot.style.background = on ? '#22c55e' : '#444';
        dot.style.boxShadow = on ? '0 0 5px #22c55e' : 'none';
    }
}

function _blockSurfFetchTip() {
    return fetch('https://mempool.space/api/blocks/tip/height')
        .then(function(r) { return r.text(); })
        .then(function(t) { return parseInt(t, 10); });
}

function _blockSurfPoll() {
    try { if (localStorage.getItem('tctv_blocksurf') !== '1') return; } catch(e) {}
    _blockSurfFetchTip().then(_blockSurfHandleHeight).catch(function() { /* ignore transient fetch errors */ });
}

// WebSocket handle for real-time block push from mempool.space. When connected,
// we hear about new blocks within ~1-2 seconds of discovery - orders of magnitude
// faster than polling. We keep a short interval as a fallback in case the socket
// drops.
window._blockSurfWS = null;
window._blockSurfWSRetry = 0;

function _blockSurfHandleHeight(h) {
    if (!h || isNaN(h)) return;
    // Guard: don't surf if BlockSurf was turned off (race between WS message and close)
    try { if (localStorage.getItem('tctv_blocksurf') !== '1') return; } catch(e) {}
    if (window._blockSurfHeight == null) { window._blockSurfHeight = h; return; }
    if (h > window._blockSurfHeight) {
        window._blockSurfHeight = h;
        _blockSurfSurfNow(h);
    }
}

function _blockSurfSurfNow(h) {
    try {
        var currentId = (window._np && window._np.stationId) || window._currentStation;
        var candidates = STATIONS.filter(function(s) { return s.id !== currentId; });
        if (!candidates.length) return;
        var next = candidates[Math.floor(Math.random() * candidates.length)];
        var btn = document.getElementById('tctv-blocksurf-toggle');
        if (btn) {
            btn.style.boxShadow = '0 0 0 4px rgba(247,147,26,0.35)';
            setTimeout(function(){ if (btn) btn.style.boxShadow = ''; }, 1200);
        }
        if (typeof showToast === 'function') {
            showToast('🏄 New block #' + h + ' - surfing to ' + next.emoji + ' ' + next.name);
        }
        if (typeof window.switchStation === 'function') window.switchStation(next.id);
        // Force now-playing re-render after channel noise clears (1s).
        // switchStation sets _np immediately, but the noise overlay may cause
        // the DOM update to appear stale on some devices. Re-rendering after
        // the overlay fades guarantees the user sees the correct info.
        setTimeout(function() {
            try {
                var st = STATIONS.find(function(s) { return s.id === window._currentStation; });
                if (st) {
                    var ps = getPlaybackState(st);
                    if (ps && ps.video) {
                        // Bypass the _setNP early-return by resetting _np first
                        window._np = { stationId: null, videoId: null, videoTitle: null };
                        _setNP(st.id, ps.video);
                    }
                }
            } catch(e) {}
        }, 1200);
    } catch(e) { /* swallow */ }
}

function _blockSurfConnectWS() {
    if (window._blockSurfWS) return; // already connected / connecting
    try {
        var ws = new WebSocket('wss://mempool.space/api/v1/ws');
        window._blockSurfWS = ws;
        ws.onopen = function() {
            window._blockSurfWSRetry = 0;
            // Subscribe to the blocks feed. mempool.space expects `{ "action": "want", "data": ["blocks"] }`.
            try { ws.send(JSON.stringify({ action: 'want', data: ['blocks'] })); } catch(e) {}
            // Also ask for the current block so we seed baseline immediately.
            try { ws.send(JSON.stringify({ action: 'init' })); } catch(e) {}
        };
        ws.onmessage = function(ev) {
            try {
                var msg = JSON.parse(ev.data);
                // mempool.space sends { block: { height, ... } } on new blocks and
                // { blocks: [...] } on init. Handle both shapes.
                if (msg && msg.block && typeof msg.block.height === 'number') {
                    _blockSurfHandleHeight(msg.block.height);
                } else if (msg && Array.isArray(msg.blocks) && msg.blocks.length) {
                    var top = msg.blocks[0];
                    if (top && typeof top.height === 'number') _blockSurfHandleHeight(top.height);
                }
            } catch(e) { /* ignore malformed */ }
        };
        ws.onclose = function() {
            window._blockSurfWS = null;
            // Exponential backoff, capped at 30s. Only retry while user still has BlockSurf on.
            try {
                if (localStorage.getItem('tctv_blocksurf') === '1') {
                    var delay = Math.min(30000, 1000 * Math.pow(2, Math.min(5, window._blockSurfWSRetry++)));
                    setTimeout(_blockSurfConnectWS, delay);
                }
            } catch(e) {}
        };
        ws.onerror = function() { try { ws.close(); } catch(e) {} };
    } catch(e) { /* WebSocket not available - fall back to polling only */ }
}

function _blockSurfStart() {
    if (window._blockSurfTimer || window._blockSurfWS) return;
    // Seed baseline immediately so the very next block triggers a surf, even if
    // the WS init message is slow.
    _blockSurfFetchTip().then(function(h) {
        if (h && !isNaN(h) && window._blockSurfHeight == null) window._blockSurfHeight = h;
    }).catch(function() {});
    // Primary: WebSocket push from mempool.space (near-instant on new blocks).
    _blockSurfConnectWS();
    // Fallback: poll every 5s in case the socket stalls or is blocked by a network.
    // The WS path will usually fire first; this just keeps us honest if it doesn't.
    window._blockSurfTimer = setInterval(_blockSurfPoll, 5000);
}

function _blockSurfStop() {
    if (window._blockSurfTimer) { clearInterval(window._blockSurfTimer); window._blockSurfTimer = null; }
    if (window._blockSurfWS) { try { window._blockSurfWS.close(); } catch(e) {} window._blockSurfWS = null; }
    window._blockSurfHeight = null;
    window._blockSurfWSRetry = 0;
}

window.tctvToggleBlockSurf = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var btn = document.getElementById('tctv-blocksurf-toggle');
    if (!btn) return;
    var willBeOn = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', willBeOn ? 'true' : 'false');
    try { localStorage.setItem('tctv_blocksurf', willBeOn ? '1' : '0'); } catch(e) {}
    _blockSurfApplyToggleStyles();
    if (willBeOn) {
        _blockSurfStart();
        if (typeof showToast === 'function') showToast('🏄 BlockSurf ON - I\'ll hop channels on every new block.');
    } else {
        _blockSurfStop();
        if (typeof showToast === 'function') showToast('BlockSurf OFF');
    }
};

window.tctvShowBlockSurfTip = function(ev) {
    var el = document.getElementById('tctv-blocksurf-toggle');
    if (!el) return;
    var existing = document.getElementById('tctv-blocksurf-tip');
    if (existing) existing.remove();
    var tip = document.createElement('div');
    tip.id = 'tctv-blocksurf-tip';
    tip.innerHTML =
        '<div style="font-weight:800;color:#f7931a;margin-bottom:4px;letter-spacing:0.5px;">🏄 BLOCKSURF</div>' +
        '<div style="color:#ddd;line-height:1.45;">Every time a new Bitcoin block is mined (~10 min), the channel automatically changes to a random channel. Sit back and let the chain decide your future!</div>';
    tip.style.cssText = 'position:fixed;z-index:300001;background:#111;color:#fff;font-size:0.75rem;padding:10px 12px;border-radius:10px;border:1px solid rgba(247,147,26,0.45);box-shadow:0 4px 14px rgba(0,0,0,0.6);pointer-events:none;max-width:230px;line-height:1.4;';
    document.body.appendChild(tip);
    var rect = el.getBoundingClientRect();
    var tipW = tip.offsetWidth || 220;
    var x = Math.max(8, Math.min(window.innerWidth - tipW - 8, rect.right - tipW));
    var y = rect.bottom + 8;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    if (window._tctvBlockSurfTipTimer) clearTimeout(window._tctvBlockSurfTipTimer);
    window._tctvBlockSurfTipTimer = setTimeout(function() {
        var t = document.getElementById('tctv-blocksurf-tip');
        if (t) t.remove();
    }, 5000);
};

window.tctvHideBlockSurfTip = function() {
    var t = document.getElementById('tctv-blocksurf-tip');
    if (t) t.remove();
    if (window._tctvBlockSurfTipTimer) { clearTimeout(window._tctvBlockSurfTipTimer); window._tctvBlockSurfTipTimer = null; }
};

// Kick off the poller on TCTV render if the toggle was previously ON.
window._blockSurfMaybeResume = function() {
    try {
        if (localStorage.getItem('tctv_blocksurf') === '1') _blockSurfStart();
    } catch(e) {}
};

function updateViewerBadges() {
    // Lazy-subscribe to public stats docs
    _subscribeTctvStats();

    // Ensure the current viewer is always counted on THEIR current station,
    // even before the Firestore snapshot comes back with their own write.
    var effectiveCounts = {};
    for (var k in _viewerCounts) if (_viewerCounts.hasOwnProperty(k)) effectiveCounts[k] = _viewerCounts[k];
    if (_currentStation && !effectiveCounts[_currentStation]) {
        effectiveCounts[_currentStation] = 1;
    }
    // Per-channel counts AND running total across ALL stations
    var totalLive = 0;
    STATIONS.forEach(function(s) {
        var count = effectiveCounts[s.id] || 0;
        totalLive += count;
        var el = document.getElementById('tctv-viewers-' + s.id);
        if (el) {
            el.textContent = count > 0 ? count + ' watching' : '';
        }
    });

    // If this total beats the known peak, try to bump it (rate-limited)
    _maybeBumpTctvPeak(totalLive);
    // Header counter = total live viewers across ALL channels (not just current)
    var mainCount = document.getElementById('tctv-main-viewers');
    if (mainCount) {
        if (totalLive > 0) {
            mainCount.textContent = '👁 ' + totalLive + (totalLive === 1 ? ' live' : ' live');
        } else if (_currentStation) {
            // At minimum the current viewer should count as 1
            mainCount.textContent = '👁 1 live';
        } else {
            mainCount.textContent = '';
        }
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
        // Lowered 25% from 0.06 per Phil - initial-load static was too loud.
        gain.gain.value = 0.045;
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
        gain.gain.value = 0.034; // -25% per Phil
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

// iOS autoplay policy: mobile Safari (iPhone/iPad/iPadOS) will not autoplay
// video with sound. We detect iOS and start muted, then unmute on first user
// interaction with the player area. Desktop + Android retain existing behavior.
var _TCTV_IS_IOS = (function() {
    try {
        var ua = navigator.userAgent || '';
        // Classic iPhone/iPad/iPod
        if (/iPhone|iPad|iPod/i.test(ua)) return true;
        // iPadOS 13+ reports as Mac but has touch
        if (/Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1) return true;
    } catch (e) {}
    return false;
})();
var _tctvAutoUnmuteArmed = false; // whether we've wired the first-tap unmute hook
var _tctvHintShown = false;       // whether we've shown the "tap to unmute" hint this session
var _tctvIosUnmuted = false;      // iOS: has the user tapped to unmute at least once?

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
    // iOS: start muted so autoplay works. Other platforms: start unmuted.
    var muteFlag = _TCTV_IS_IOS ? '1' : '0';
    iframe.src = 'https://www.youtube.com/embed/' + videoId +
        '?start=' + Math.floor(startSeconds) +
        '&autoplay=1&controls=1&modestbranding=1&rel=0' +
        '&showinfo=0&iv_load_policy=3&playsinline=1&wmode=opaque&mute=' + muteFlag;
    wrap.appendChild(iframe);
    if (_TCTV_IS_IOS) _showTctvUnmuteHint();
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

    var _playerVars = {
        'autoplay': 1,
        'controls': 1,
        'modestbranding': 1,
        'rel': 0,
        'showinfo': 0,
        'iv_load_policy': 3,
        'playsinline': 1,
        'start': Math.floor(startSeconds)
    };
    // iOS requires muted autoplay. User unmutes via first tap handler below.
    if (_TCTV_IS_IOS) _playerVars.mute = 1;

    _ytPlayer = new YT.Player('tctv-player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: _playerVars,
        events: {
            'onStateChange': onPlayerStateChange,
            'onReady': function(event) {
                // On iOS, keep muted initially so autoplay fires. Desktop/Android
                // get the user's saved volume right away.
                if (_TCTV_IS_IOS) {
                    try { event.target.mute(); } catch (e) {}
                    event.target.playVideo();
                    _showTctvUnmuteHint();
                    _armTctvFirstTapUnmute();
                } else {
                    event.target.playVideo();
                    _syncYTVolume();
                }
                _armBotWallWatchdog();
            },
            'onError': function(event) {
                // YT error codes 2, 5, 100, 101, 150 - only surface if user has
                // NEVER successfully played a video on this device. If they've
                // played at least one, videos clearly work for them and it's a
                // per-video issue (region lock, takedown) we shouldn't blame on
                // the bot-wall.
                _maybeShowBotWall('yt-error-' + event.data);
            }
        }
    });
}

// ---- iOS muted-autoplay helpers ----
// Shows a small "Tap to unmute" hint on top of the player once per session on
// iOS devices. The hint disappears on any first user interaction with the player
// (or the remote's volume/mute buttons), and the player is unmuted to the
// user's saved volume at that moment.
function _showTctvUnmuteHint() {
    if (_tctvHintShown) return;
    if (!_TCTV_IS_IOS) return;
    _tctvHintShown = true;
    try {
        var wrap = document.getElementById('tctv-video-container');
        if (!wrap) return;
        var old = document.getElementById('tctv-unmute-hint');
        if (old) old.remove();
        var hint = document.createElement('button');
        hint.id = 'tctv-unmute-hint';
        hint.type = 'button';
        hint.setAttribute('aria-label', 'Tap to unmute');
        hint.innerHTML = '\ud83d\udd07 Tap to unmute';
        hint.style.cssText = 'position:absolute;top:12px;left:50%;transform:translateX(-50%);' +
            'z-index:9;background:rgba(0,0,0,0.78);color:#fff;font-size:0.82rem;font-weight:700;' +
            'border:1px solid rgba(247,147,26,0.6);border-radius:999px;padding:8px 14px;' +
            'cursor:pointer;font-family:inherit;box-shadow:0 4px 18px rgba(0,0,0,0.45);' +
            'touch-action:manipulation;-webkit-tap-highlight-color:transparent;' +
            'animation:tctvUnmutePulse 1.6s ease-in-out infinite;';
        if (!document.getElementById('tctvUnmuteHintKeyframes')) {
            var s = document.createElement('style');
            s.id = 'tctvUnmuteHintKeyframes';
            s.textContent = '@keyframes tctvUnmutePulse{0%,100%{box-shadow:0 4px 18px rgba(0,0,0,0.45),0 0 0 0 rgba(247,147,26,0.45);}50%{box-shadow:0 4px 18px rgba(0,0,0,0.45),0 0 0 14px rgba(247,147,26,0);}}';
            document.head.appendChild(s);
        }
        hint.onclick = function(ev) {
            if (ev) ev.stopPropagation();
            _tctvUnmuteNow();
        };
        wrap.appendChild(hint);
    } catch (e) {}
}
function _hideTctvUnmuteHint() {
    var hint = document.getElementById('tctv-unmute-hint');
    if (hint) hint.remove();
}
function _tctvUnmuteNow() {
    // Called by the hint button OR any first tap on the player wrapper.
    // If the user has explicitly muted via the remote earlier, respect that.
    if (window._tctvMuted) { _hideTctvUnmuteHint(); return; }
    _tctvIosUnmuted = true;
    var vol = Math.round((typeof window.audioVolume === 'number' ? window.audioVolume : 0.5) * 100);
    if (vol === 0) vol = 50; // default if stored volume was zero
    try {
        if (_ytPlayer && typeof _ytPlayer.unMute === 'function') _ytPlayer.unMute();
        if (_ytPlayer && typeof _ytPlayer.setVolume === 'function') _ytPlayer.setVolume(vol);
    } catch (e) {}
    if (typeof window.setVolume === 'function') window.setVolume(vol / 100);
    if (typeof _updateMuteButtons === 'function') _updateMuteButtons(false);
    _hideTctvUnmuteHint();
}
function _armTctvFirstTapUnmute() {
    if (_tctvAutoUnmuteArmed) return;
    if (!_TCTV_IS_IOS) return;
    _tctvAutoUnmuteArmed = true;
    var wrap = document.getElementById('tctv-video-container');
    if (!wrap) return;
    var handler = function(ev) {
        // Unmute on the first real interaction inside the player container.
        _tctvUnmuteNow();
        wrap.removeEventListener('touchend', handler, true);
        wrap.removeEventListener('click', handler, true);
    };
    wrap.addEventListener('touchend', handler, true);
    wrap.addEventListener('click', handler, true);
}

// ---- YouTube bot-wall detection ----
// Goal: show a one-time helper banner only for users who never successfully load
// a video (likely hitting YouTube's 'Sign in to confirm you're not a bot' wall).
// Never shows for users whose videos play fine.
window._tctvAnyVideoPlayed = (function(){
    try { return localStorage.getItem('tctv_any_video_played') === '1'; } catch(e) { return false; }
})();
window._tctvBotWallArmed = false;
window._tctvBotWallTimer = null;

function _armBotWallWatchdog() {
    // Only ever armed once per session, and only if the user has never played
    // a video successfully. If they have, we trust the player implicitly.
    if (window._tctvAnyVideoPlayed) return;
    if (window._tctvBotWallArmed) return;
    window._tctvBotWallArmed = true;
    // If the video doesn't reach PLAYING state within 20 seconds, surface the banner.
    window._tctvBotWallTimer = setTimeout(function() {
        _maybeShowBotWall('no-playback-20s');
    }, 20000);
}

function _markVideoPlayed() {
    if (window._tctvAnyVideoPlayed) return;
    window._tctvAnyVideoPlayed = true;
    try { localStorage.setItem('tctv_any_video_played', '1'); } catch(e) {}
    // Cancel any pending bot-wall check and hide banner if shown.
    if (window._tctvBotWallTimer) { clearTimeout(window._tctvBotWallTimer); window._tctvBotWallTimer = null; }
    var b = document.getElementById('tctv-botwall-banner');
    if (b) b.remove();
}

function _maybeShowBotWall(reason) {
    if (window._tctvAnyVideoPlayed) return; // User plays videos fine, never show
    if (document.getElementById('tctv-botwall-banner')) return; // Already showing
    var wrap = document.getElementById('tctv-player') ? document.getElementById('tctv-player').parentElement : null;
    if (!wrap) return;
    var banner = document.createElement('div');
    banner.id = 'tctv-botwall-banner';
    banner.setAttribute('data-reason', reason);
    banner.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:8;max-width:92%;background:#111;border:1px solid rgba(247,147,26,0.5);border-radius:12px;padding:14px 18px;color:#fff;font-size:0.85rem;line-height:1.4;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,0.6);';
    banner.innerHTML =
        '<div style="font-weight:900;color:#f7931a;margin-bottom:6px;font-size:0.95rem;">📺 Video blocked by YouTube\'s bot-check</div>' +
        '<div style="color:#ddd;margin-bottom:10px;">YouTube sometimes shows a "Sign in to confirm you\'re not a bot" wall inside its player. That\'s YouTube\'s block, not ours. Quickest fixes:</div>' +
        '<ul style="text-align:left;color:#ddd;margin:0 auto 10px;padding-left:20px;max-width:360px;">' +
            '<li>Sign into Google/YouTube in this browser</li>' +
            '<li>Turn off private/incognito mode or strict tracking protection</li>' +
            '<li>If on a VPN, try without it</li>' +
        '</ul>' +
        '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
            '<button onclick="window.open(\'https://accounts.google.com/signin\', \'_blank\')" style="background:#f7931a;color:#000;border:none;padding:7px 14px;border-radius:8px;font-weight:800;font-size:0.8rem;cursor:pointer;font-family:inherit;">Sign into YouTube</button>' +
            '<button onclick="document.getElementById(\'tctv-botwall-banner\').remove()" style="background:transparent;color:#999;border:1px solid #444;padding:7px 14px;border-radius:8px;font-weight:700;font-size:0.8rem;cursor:pointer;font-family:inherit;">Dismiss</button>' +
        '</div>';
    wrap.style.position = 'relative';
    wrap.appendChild(banner);
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
        // Successful playback: user's browser can play YT videos. Kill the bot-wall
        // watchdog and remember so we never surface the banner for them again.
        if (typeof _markVideoPlayed === 'function') _markVideoPlayed();
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
        'Anita Posch', 'Ross Ulbricht', 'Erik Voorhees', 'Caitlin Long',
        // Self-custody hardware & wallets
        'NVK / Coinkite', 'Coldcard', 'Sparrow Wallet', 'SeedSigner',
        'Foundation Passport', 'Specter', 'Nunchuk', 'BTCPay Server',
        'Wasabi', 'Samourai', 'BTC Sessions', 'Wicked Smart Bitcoin'
    ],
    'health-fitness': [
        'Saifedean Ammous', 'Aleks Svetski', 'Anders Larsson', 'Bitcoin Mindset',
        'Tom Bilyeu', 'Carnivore MD (Paul Saladino)', 'Jordan Peterson on time preference',
        'Bitcoin & Beef', 'Texas Slim', 'The Beef Initiative', 'Low Time Preference',
        'Jeff Nippard', 'Jeremy Ethier', 'Athlean-X', 'Alan Thrall', 'Calgary Barbell',
        'Matthew Walker', 'Andrew Huberman', 'Eckhart Tolle', 'Alan Watts', 'Mindfulness',
        'Sleep Science', 'Weightlifting Form', 'Meditation', 'Consciousness'
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

// Seek the YT player by `delta` seconds (negative = rewind, positive = fast-forward).
// Clamps to [0, video duration]. Falls back silently if the player can't seek.
window.tctvRemoteSeek = function(delta) {
    if (typeof window.nachoPlaySound === 'function') window.nachoPlaySound('tctv-beep');
    if (_apiFailed || !_ytPlayer || !_ytPlayer.getCurrentTime || !_ytPlayer.seekTo) return;
    try {
        var cur = _ytPlayer.getCurrentTime();
        var dur = (typeof _ytPlayer.getDuration === 'function') ? _ytPlayer.getDuration() : 0;
        var target = Math.max(0, cur + delta);
        if (dur && target > dur - 1) target = Math.max(0, dur - 1);
        _ytPlayer.seekTo(target, true);
        // A manual seek puts us off the live schedule; show Jump-to-Live so the
        // user can resync whenever they want.
        _showSyncButtons(true);
        if (typeof showToast === 'function') {
            showToast((delta < 0 ? '⏪ ' : '⏩ ') + (delta < 0 ? '-' : '+') + Math.abs(delta) + 's');
        }
    } catch(e) { /* ignore */ }
};

window.tctvRemoteVolume = function(dir) {
    // Get current volume from app state (single source of truth)
    var current = Math.round((typeof window.audioVolume === 'number' ? window.audioVolume : 0.5) * 100);
    var next = Math.max(0, Math.min(100, current + (dir * 10)));

    // Any manual volume change exits mute
    window._tctvMuted = false;
    // iOS: a manual volume bump counts as user gesture → unmute from now on
    if (_TCTV_IS_IOS && !_tctvIosUnmuted) { _tctvIosUnmuted = true; _hideTctvUnmuteHint(); }

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

// Sync YT player volume with app volume on player ready/load.
// IMPORTANT: on iOS, if the user has not yet tapped to unmute, we must NOT
// restore sound - otherwise the browser will reject autoplay and playback will
// stall. The `_tctvIosUnmuted` flag gets flipped by `_tctvUnmuteNow()` on the
// first tap, after which volume syncs behave normally.
function _syncYTVolume() {
    if (typeof window.audioVolume !== 'number') return;
    if (_TCTV_IS_IOS && !_tctvIosUnmuted) {
        // Keep muted so autoplay keeps working across channel/video switches.
        setTimeout(function() {
            try {
                if (_ytPlayer && typeof _ytPlayer.mute === 'function') _ytPlayer.mute();
            } catch (e) {}
        }, 500);
        return;
    }
    var vol = Math.round(window.audioVolume * 100);
    // Delay slightly - player needs a moment after loadVideoById
    setTimeout(function() { _applyYTVolume(vol); }, 500);
}

// Mute toggle - preserves last unmuted volume so unmute restores to it.
window._tctvMuted = false;
window._tctvPreMuteVolume = null;
window.tctvRemoteMute = function() {
    var current = Math.round((typeof window.audioVolume === 'number' ? window.audioVolume : 0.5) * 100);
    if (!window._tctvMuted && current > 0) {
        // MUTE - remember current volume, then force volume to 0 everywhere
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
        // UNMUTE - restore previous volume (or 50% if we don't have one)
        var restore = (typeof window._tctvPreMuteVolume === 'number' && window._tctvPreMuteVolume > 0) ? window._tctvPreMuteVolume : 50;
        window._tctvMuted = false;
        // iOS: user tapped unmute → valid gesture, allow sound from now on
        if (_TCTV_IS_IOS && !_tctvIosUnmuted) { _tctvIosUnmuted = true; _hideTctvUnmuteHint(); }
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

// Couch Nacho drag - only via the #couchNachoDragHandle button.
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
// ── NOW PLAYING - Single Source of Truth ──
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

    // Sync Header - only update if the video in the player matches what clock says.
    // If they differ, the player is still finishing the current video — don't
    // overwrite the title until the video actually changes (via ENDED event).
    if (_np.stationId === _currentStation && state.video && state.video.id === _currentVideoId) {
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
        // Sync the sticky time header slider with the main EPG slider
        var timeSlider = document.getElementById('tctv-time-slider');
        if (timeSlider) timeSlider.style.transform = 'translateX(' + shiftX + 'px)';
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

    // Only update Now Playing text if clock says different video.
    // Do NOT force video change here — let YouTube's ENDED event handle transitions.
    // Forcing advance based on clock causes desync when stored durations don't
    // exactly match YouTube's actual video length.
    if (state.video && state.video.id !== _currentVideoId) {
        // Just update the title display, don't force a video load
        _setNP(_currentStation, state.video);
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

    var html = '<div id="tctv-epg-wrapper" style="padding:0;">';

    // Sticky time header row - stays visible while scrolling through channels.
    // The inner slider syncs its translateX with the main EPG slider in updateTimeline.
    html += '<div id="tctv-time-row" style="position:sticky;top:0;z-index:20;display:flex;background:#0a0a0a;border-bottom:1px solid #333;">';
    html += '<div style="width:160px;flex-shrink:0;background:#0a0a0a;border-right:1px solid #222;"></div>';
    html += '<div id="tctv-time-scroll" style="flex:1;overflow-x:auto;overflow-y:hidden;position:relative;height:24px;scrollbar-width:none;-ms-overflow-style:none;">';
    html += '<div id="tctv-time-slider" style="position:absolute;top:0;left:0;height:100%;transition:transform 1s linear;">';
    for (var i = 0; i < 13; i++) {
        var markMs = gridStartMs - (gridStartMs % 1800000) + (i * 1800000);
        var markX = ((markMs - gridStartMs) / 60000) * 10;
        var d = new Date(markMs);
        var h = d.getHours(), m = d.getMinutes();
        var label = (h % 12 || 12) + ":" + (m < 10 ? '0' : '') + m + (h >= 12 ? ' PM' : ' AM');
        html += '<div style="position:absolute;left:' + markX + 'px;top:0;font-size:0.6rem;color:#777;font-weight:700;border-left:1px solid #333;padding-left:4px;height:24px;line-height:24px;">' + label + '</div>';
    }
    html += '</div></div></div>';

    // Channel rows: labels left + timeline right
    html += '<div style="display:flex;position:relative;background:#0a0a0a;">';

    html += '<div style="width:160px;flex-shrink:0;z-index:10;background:#0a0a0a;border-right:1px solid #222;">';
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
    // Shrink leaderboard FAB to just 🏆 so it doesn't cover the channel guide
    var _lbFab = document.getElementById('lbFloatBtn');
    if (_lbFab) { _lbFab._origText = _lbFab.innerHTML; _lbFab.innerHTML = '\ud83c\udfc6'; }
    if (typeof _tctvHideSpriteNacho === 'function') _tctvHideSpriteNacho();
    // Resume BlockSurf poller if user had it enabled last session.
    if (typeof window._blockSurfMaybeResume === 'function') window._blockSurfMaybeResume();

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
            /* On mobile the header is a capped flex child (not sticky).
               flex/max-height set in the main mobile block below. */
            #tctv-sticky-header {
                position: relative !important;
                top: auto !important;
            }
            /* Order children so the horizontal remote sits directly below the
               title row (TIMECHAIN TV + BlockSurf + live count), then the video,
               then Now Playing and progress. The sticky header's first child is
               the title row - pin it to order:-2, remote to order:-1, everything
               else defaults to 0 in source order. */
            #tctv-sticky-header > div:first-child { order: -2 !important; flex: 0 0 auto !important; padding: 6px 12px !important; }
            #tctv-remote { order: -1 !important; margin: 0 !important; border-bottom: 1px solid #222 !important; background: #0a0a0a !important; }
            #tctv-video-row { padding: 0 !important; gap: 0 !important; align-items: stretch !important; }
            #tctv-video-container { border-radius: 0 !important; }
        }
        @media (max-width: 480px) {
            #tctv-sticky-header {
                top: auto !important;
            }
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
        /* Collapsed: slide most of the remote off-screen. Parts have pointer-events:none
           so they don't steal taps from the video (YouTube fullscreen button etc).
           The dedicated .tctv-remote-tap-zone child IS tappable and spans the full
           visible edge for reliable touch targeting. */
        #tctv-remote-inline.collapsed {
            /* Show ~50px of the remote at the right edge so the
               pull-tab is clearly visible on all screen sizes. */
            transform: translateX(110px);
            opacity: 1;
            /* Remote itself stays hit-testable so the tap zone works.
               Individual buttons inside are disabled via the rule below so
               they don't intercept clicks on the YouTube player when the
               remote is collapsed. */
            pointer-events: auto;
            position: relative;
        }
        /* When collapsed, disable all interactive descendants EXCEPT the tap zone */
        #tctv-remote-inline.collapsed *:not(.tctv-remote-tap-zone):not(.tctv-remote-tap-zone *) {
            pointer-events: none !important;
        }
        /* When EXPANDED, ALL descendants must receive clicks. This overrides any
           stale pointer-events:none from animation transitions or other cascades. */
        #tctv-remote-inline:not(.collapsed),
        #tctv-remote-inline:not(.collapsed) * {
            pointer-events: auto !important;
        }
        /* Full-height tap zone on the VISIBLE edge of the remote.
           The collapsed remote is translated 110px to the right (so ~50px pokes
           into the viewport from the right edge). Tap zone covers the visible
           strip for comfortable tapping. */
        .tctv-remote-tap-zone {
            display: none;
            position: absolute;
            top: 0;
            bottom: 0;
            /* Anchor to the LEFT (visible) edge of the collapsed remote.
               When collapsed the remote is translated 110px right, so ~50px
               of its left side pokes into the viewport. */
            left: 0;
            width: 50px;
            z-index: 5;
            cursor: pointer;
            pointer-events: auto;
            background: linear-gradient(90deg, rgba(247,147,26,0.5) 0%, rgba(247,147,26,0.15) 70%, transparent 100%);
            border-right: 2px solid rgba(247,147,26,0.6);
            box-shadow: 2px 0 16px rgba(247,147,26,0.3);
            border-radius: 8px 0 0 8px;
        }
        #tctv-remote-inline.collapsed .tctv-remote-tap-zone {
            display: block;
        }
        /* Pull-tab arrow on the visible left edge - points left to hint "pull me" */
        #tctv-remote-inline.collapsed .tctv-remote-tap-zone::before {
            content: '◀';
            position: absolute;
            left: 12px;
            top: 18px;
            transform: none;
            color: #f7931a;
            font-size: 22px;
            font-weight: 900;
            opacity: 1;
            text-shadow: 0 0 8px rgba(247,147,26,0.4), 0 0 4px rgba(0,0,0,0.8);
            animation: tctvRemotePulse 2s ease-in-out infinite;
        }
        @keyframes tctvRemotePulse {
            0%, 100% { transform: translateX(0); opacity: 0.8; }
            50% { transform: translateX(-6px); opacity: 1; }
        }
        /* Hide scrollbar on the sticky time row */
        #tctv-time-scroll::-webkit-scrollbar { display: none; }
        /* Thin scrollbar for EPG channel list */
        #tctv-epg-wrapper::-webkit-scrollbar { width: 6px; }
        #tctv-epg-wrapper::-webkit-scrollbar-track { background: #111; }
        #tctv-epg-wrapper::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        /* Keep the drag handle tappable too - redundant safety net */
        #tctv-remote-inline.collapsed > [onclick*="tctvToggleRemote"] {
            pointer-events: auto;
            cursor: pointer;
            position: relative;
            z-index: 6;
        }
        #tctv-remote-inline:not(.collapsed) { pointer-events: auto; }
        #tctv-remote-sidebar:hover #tctv-remote-inline,
        #tctv-remote-sidebar:focus-within #tctv-remote-inline {
            opacity: 1;
            transform: translateX(0);
            pointer-events: auto;
        }
        /* When the sidebar is hovered/focused, the remote is visually fully out
           and the user expects buttons to work. Restore pointer-events on ALL
           descendants, overriding the collapsed-state disable rule above. */
        #tctv-remote-sidebar:hover #tctv-remote-inline *,
        #tctv-remote-sidebar:focus-within #tctv-remote-inline * {
            pointer-events: auto !important;
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
        @media (min-width: 768px) {
            #nacho-couch { display: block; }
        }
        /* Mobile: show couch Nacho in-flow between channel list and the ad. */
        @media (max-width: 767px) {
            #nacho-couch {
                display: flex !important;
                position: static !important;
                left: auto !important;
                bottom: auto !important;
                margin: 18px auto 8px !important;
                justify-content: center !important;
                align-items: center !important;
                pointer-events: auto !important;
            }
            #nacho-couch-inner { width: 200px !important; height: 120px !important; }
            #nacho-couch-inner > span:first-child { font-size: 6rem !important; }
            #nacho-couch-inner > div img { width: 62px !important; height: 62px !important; }
            /* Mobile-specific couch restore button (smaller, in-flow) */
            #nacho-couch-restore {
                position: static !important;
                left: auto !important;
                bottom: auto !important;
                margin: 10px auto !important;
                width: 44px !important;
                height: 44px !important;
                font-size: 1.3rem !important;
            }
        }
        /* Hide floating UI elements that steal space during TCTV. */
        body.tctv-active #nacho-toggle,
        body.tctv-active #nacho-container {
            display: none !important;
        }
        body.tctv-active #lbFloatBtn {
            padding: 10px 12px !important;
            min-width: 0 !important;
            font-size: 1.1rem !important;
            line-height: 1 !important;
        }
        body.tctv-active #guestPointsBanner {
            display: none !important;
        }
        @media (max-width: 767px) {
            body.tctv-active #bottomNav,
            body.tctv-active .mobile-bar {
                display: none !important;
            }
            /* Zero out the <main> padding that normally clears the fixed mobile-bar.
               Without this, there's a white gap at the top of the TCTV page. */
            body.tctv-active main {
                padding-top: 0 !important;
            }
        }
        /* Tablets and Laptops - Shrink video to leave vertical room for channel scrolling.
           Previously 66vh video + 33vh EPG = all 21 channels crammed into 33vh. Now the
           video is smaller and the page below scrolls naturally through the EPG. */
        @media (min-width: 768px) and (max-width: 1280px) {
            .tctv-video-wrap { max-width: 900px !important; width: 100% !important; flex: 1 1 auto !important; margin: 0 auto !important; }
            /* Video: comfortable 45vh (was 66vh) - leaves room below for native page scroll */
            #tctv-video-container {
                height: 45vh !important;
                max-height: 45vh !important;
                min-height: 320px !important;
                border-radius: 12px !important;
            }
            #tctv-player { height: 100% !important; max-height: 45vh !important; }
            /* Let the EPG flow naturally (native page scroll takes it from here) */
            #tctv-epg-wrapper {
                max-height: 50vh !important;
                overflow-y: auto !important;
                overflow-x: auto !important;
                background: #0a0a0a !important;
                position: relative !important;
                z-index: 5 !important;
                margin-top: 10px !important;
                scrollbar-width: thin !important;
                scrollbar-color: #444 #111 !important;
            }
            #tctv-epg-container { height: auto !important; min-height: auto !important; overflow-x: visible !important; }
        }
        /* Large desktops: EPG scroll container for sticky time row */
        @media (min-width: 1281px) {
            #tctv-epg-wrapper {
                max-height: 50vh !important;
                overflow-y: auto !important;
                overflow-x: auto !important;
                scrollbar-width: thin !important;
                scrollbar-color: #444 #111 !important;
            }
            #tctv-epg-container { overflow-x: visible !important; }
        }
        /* Keep user-display hidden on mobile TCTV, but the sign-up banner (guestPointsBanner)
           is kept visible with a minimize/expand toggle so users always stay in control. */
        @media (max-width: 767px) {
            body.tctv-active #userDisplay { display: none !important; }
            body.tctv-active #guestPointsBanner.banner-min {
                max-width: 44px !important;
                min-width: 44px !important;
                padding: 6px !important;
                overflow: hidden !important;
            }
            body.tctv-active #guestPointsBanner.banner-min > :not(.banner-toggle) { display: none !important; }
        }
        /* Mobile - stacked two-row remote bar below video (overrides the legacy fixed vertical style) */
        @media (max-width: 767px) {
            #tctv-remote {
                position: static !important;
                top: auto !important; right: auto !important;
                width: auto !important;
                display: flex !important;
                flex-direction: column !important;
                flex-wrap: nowrap !important;
                padding: 8px 10px !important;
                gap: 4px !important;
                border-radius: 0 !important;
                border-width: 0 0 1px 0 !important;
                border-color: #222 !important;
                justify-content: center !important;
                align-items: center !important;
                box-shadow: none !important;
                transform: none !important;
            }
            #tctv-remote.collapsed { transform: none !important; opacity: 1 !important; }
            /* Seek row buttons keep a comfortable tap area without being square. */
            #tctv-remote .tctv-remote-row-seek .remote-btn {
                height: 30px !important;
                width: auto !important;
            }
        }
        /* Mobile - viewport-locked flex layout.
           Phil's spec (firm): channel guide fills at LEAST 1/3 of the screen,
           always visible without scrolling on ANY device (including iPhone SE).
           We achieve this by making #tctv-page a flex column locked to the exact
           available viewport height (total vh minus the app's fixed mobile-bar at
           top and bottom-nav at bottom). The video section flexes to fill 2/3 and
           the EPG fills the remaining 1/3 - guaranteed, no scroll required.
           100dvh is used where supported (Safari 15.4+) for dynamic viewport on
           iOS (accounts for URL bar show/hide). Fallback to 100vh for older. */
        @media (max-width: 767px) {
            /* Lock the page into a viewport-filling flex column.
               Both .mobile-bar and #bottomNav are hidden via tctv-active,
               so the page gets the full viewport. Only subtract safe areas. */
            #tctv-page {
                display: flex !important;
                flex-direction: column !important;
                height: 100vh !important;
                height: 100dvh !important;
                min-height: 0 !important;
                max-height: 100dvh !important;
                overflow: hidden !important;
                padding: 0 !important;
                margin: 0 !important;
                box-sizing: border-box !important;
            }
            /* Sticky header becomes a capped flex child - holds title, remote,
               video, now-playing, and progress. Capped at 67% so EPG always
               gets its 33%. Uses flex-column internally so the video row
               shrinks when the header hits its max. */
            #tctv-sticky-header {
                position: relative !important;
                top: auto !important;
                flex: 1 1 67% !important;
                max-height: 67% !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                min-height: 0 !important;
            }
            /* Video row: fills remaining space inside the header after
               title bar, remote, now-playing and progress take their share.
               overflow:hidden clips the video cleanly at the row boundary
               so it never bleeds under now-playing. */
            #tctv-video-row {
                flex: 1 1 auto !important;
                min-height: 80px !important;
                overflow: hidden !important;
            }
            /* Now-playing bar, progress, and remote are fixed-height.
               Only the video row flexes/shrinks inside the header. */
            #tctv-np-bar {
                flex: 0 0 auto !important;
                padding: 4px 10px !important;
                margin-top: auto !important;
            }
            #tctv-np-bar * { font-size: 0.7rem !important; }
            #tctv-np-bar #tctv-now-playing { font-size: 0.75rem !important; }
            #tctv-progress-bar { flex: 0 0 3px !important; }
            /* Shrink the remote vertically so it takes less of the 2/3 budget. */
            #tctv-remote { padding: 3px 6px !important; gap: 3px !important; flex: 0 0 auto !important; }
            .remote-btn { width: 30px !important; height: 28px !important; font-size: 0.72rem !important; }
            #tctv-remote .tctv-remote-row-seek .remote-btn { height: 26px !important; }
            #tctv-remote input.remote-input { height: 28px !important; }

            /* Video: 16:9 aspect ratio but clipped by the parent's overflow:hidden
               so it never pushes other elements out. The container may be taller
               than 16:9 allows - YouTube fills the extra space with black bars. */
            #tctv-video-container {
                width: 100% !important;
                max-width: 100% !important;
                height: 100% !important;
                max-height: 100% !important;
                min-height: 0 !important;
                margin: 0 !important;
                box-shadow: none !important;
                border-radius: 0 !important;
            }
            #tctv-player { width: 100% !important; height: 100% !important; max-height: none !important; }

            /* EPG: fills remaining vertical space - guaranteed 1/3 minimum.
               iOS fix: explicit touch-action so vertical swipes always scroll the
               channel list, and horizontal swipes scroll the timeline only when on
               the timeline. */
            #tctv-epg-wrapper {
                flex: 1 1 33% !important;
                min-height: 33% !important;
                max-height: none !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                -webkit-overflow-scrolling: touch !important;
                touch-action: pan-y !important;
                background: #0a0a0a !important;
                position: relative !important;
                z-index: 5 !important;
                margin-top: 0 !important;
                overscroll-behavior: contain !important;
                /* Extra bottom padding so the last channel scrolls past iOS Safari
                   bottom chrome (home indicator + toolbar). 80px covers the worst
                   case (iPhone SE with full toolbar visible). */
                padding-bottom: 80px !important;
            }
            #tctv-epg-container {
                height: auto !important;
                min-height: 100% !important;
                touch-action: pan-x pan-y !important;
                -webkit-overflow-scrolling: touch !important;
            }
            /* Couch Nacho and ad are pushed to overflow - accessible by scrolling
               the EPG wrapper to the bottom, but don't steal viewport space. */
            #nacho-couch { display: none !important; }
            #tctv-ad-mobile { display: none !important; }
            #tctv-disclaimer { display: none !important; }
            #tctv-disclaimer + div { display: none !important; }
        }
        /* Very short screens (landscape phones) - same flex approach but tighter video budget */
        @media (max-width: 768px) and (max-height: 600px) {
            #tctv-video-row { max-height: 35% !important; }
            #tctv-epg-wrapper { min-height: 38% !important; flex: 1 1 38% !important; }
        }
        @keyframes nachoSway { 0%, 100% { transform: rotate(-1deg) translateY(0); } 50% { transform: rotate(1deg) translateY(-5px); } }
        @keyframes tctvGuideFade { from { opacity: 0; } to { opacity: 1; } }
    `;
    document.head.appendChild(style);

    var html = '<div id="tctv-page" style="background:#0a0a0a;min-height:100vh;color:#fff;font-family:inherit;width:100%;">';

    var _bsOn = false;
    try { _bsOn = localStorage.getItem('tctv_blocksurf') === '1'; } catch(e) {}
    html += '<div id="tctv-sticky-header" style="position:sticky;top:0;z-index:200000;background:#0a0a0a;width:100%;"> ' +
            '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#111;border-bottom:1px solid rgba(247,147,26,0.3);width:100%;box-sizing:border-box;"><div onclick="goHome()" style="cursor:pointer;display:flex;align-items:center;gap:8px;"><span style="color:var(--text-muted);font-size:0.8rem;">←</span><span style="color:#f7931a;font-weight:900;font-size:1rem;letter-spacing:2px;">TIMECHAIN TV</span></div><div style="display:flex;align-items:center;gap:6px;">' +
            // BlockSurf toggle - stuck to the left of viewers+LIVE, out of the way of everything else.
            '<button id="tctv-blocksurf-toggle" onclick="tctvToggleBlockSurf(event)" onmouseenter="tctvShowBlockSurfTip(event)" onmouseleave="tctvHideBlockSurfTip()" aria-label="BlockSurf: auto-change channel every Bitcoin block" aria-pressed="' + (_bsOn ? 'true' : 'false') + '" style="display:inline-flex;align-items:center;gap:4px;padding:3px 7px;margin-right:4px;border-radius:999px;border:1px solid ' + (_bsOn ? '#f7931a' : '#333') + ';background:' + (_bsOn ? 'rgba(247,147,26,0.18)' : 'rgba(255,255,255,0.04)') + ';color:' + (_bsOn ? '#f7931a' : '#888') + ';font-size:0.65rem;font-weight:800;letter-spacing:0.5px;cursor:pointer;font-family:inherit;touch-action:manipulation;user-select:none;transition:0.18s;">' +
                '<span style="font-size:0.8rem;line-height:1;">🏄</span>' +
                '<span>BLOCKSURF</span>' +
                '<span id="tctv-blocksurf-dot" style="width:6px;height:6px;border-radius:50%;background:' + (_bsOn ? '#22c55e' : '#444') + ';box-shadow:' + (_bsOn ? '0 0 5px #22c55e' : 'none') + ';"></span>' +
            '</button>' +
            '<span id="tctv-main-viewers" style="font-size:0.7rem;color:#22c55e;font-weight:600;cursor:pointer;user-select:none;touch-action:manipulation;" onclick="tctvShowPeakTip(event)" onmouseenter="tctvShowPeakTip(event)" onmouseleave="tctvHidePeakTip()"></span><span style="width:8px;height:8px;background:#ef4444;border-radius:50%;display:inline-block;box-shadow:0 0 6px #ef4444;"></span><span style="color:#ef4444;font-size:0.7rem;font-weight:800;letter-spacing:1px;">LIVE</span></div></div>';

    // Desktop: side-by-side layout with couch left, video center, wide remote right
    html += '<div id="tctv-video-row" style="display:flex;align-items:center;justify-content:center;gap:10px;background:#0a0a0a;padding:6px 10px;flex-wrap:wrap;">';
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
            // Full-height invisible tap zone on the left edge - easy to tap on tablet/touch
            '<div class="tctv-remote-tap-zone" onclick="tctvToggleRemote()" title="Open remote"></div>' +
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
            // Seek row: -15s / +15s
            '<div style="display:flex;gap:8px;align-items:center;justify-content:center;width:100%;margin-top:2px;">' +
                '<button class="remote-btn" style="border-radius:10px;font-size:0.7rem;font-weight:900;" onclick="tctvRemoteSeek(-15)" title="Rewind 15s">-15s</button>' +
                '<button class="remote-btn" style="border-radius:10px;font-size:0.7rem;font-weight:900;" onclick="tctvRemoteSeek(15)" title="Skip forward 15s">+15s</button>' +
            '</div>' +
            // Bottom row: PLAY + BACK side-by-side
            '<div style="display:flex;gap:10px;align-items:center;justify-content:center;width:100%;margin-top:2px;">' +
                '<button class="remote-btn blue" style="border-radius:10px;font-size:1.1rem;" onclick="tctvRemotePause()" id="remote-pause-btn-inline" title="Pause/Play">⏸</button>' +
                '<button class="remote-btn blue" style="border-radius:10px;font-size:0.7rem;font-weight:900;" onclick="tctvRemoteBack()">BACK</button>' +
            '</div>' +
            '</div></div>';
    html += '</div>';
    html += '<div id="tctv-np-bar" style="padding:10px 16px;background:#161616;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center;"><div style="flex:1;min-width:0;"><div style="font-size:0.65rem;color:#f7931a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">NOW PLAYING <span id="tctv-now-ch" style="color:#aaa;"></span></div><div id="tctv-now-playing" style="font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#ddd;">Loading...</div></div>' +
            '<div style="display:flex;align-items:center;gap:8px;"><div id="tctv-time-left" style="font-size:0.75rem;color:#888;font-weight:600;flex-shrink:0;font-variant-numeric:tabular-nums;"></div></div></div>';
    html += '<div id="tctv-progress-bar" style="height:3px;background:#222;"><div id="tctv-progress" style="height:100%;background:#f7931a;width:0%;transition:width 1s linear;"></div></div>';

    // Mobile Remote - horizontal bar below video/progress, inside sticky header
    html += '<div id="tctv-remote">' +
            '<div class="tctv-remote-row-primary" style="display:flex;gap:4px;align-items:center;justify-content:center;flex-wrap:nowrap;">' +
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
            '</div>' +
            '<div class="tctv-remote-row-seek" style="display:flex;gap:8px;align-items:center;justify-content:center;margin-top:6px;">' +
                '<button class="remote-btn" style="border-radius:8px;font-size:0.72rem;font-weight:900;padding:0 10px;width:auto;min-width:64px;height:30px;" onclick="tctvRemoteSeek(-15)" title="Rewind 15s">\u23ea -15s</button>' +
                '<button class="remote-btn" style="border-radius:8px;font-size:0.72rem;font-weight:900;padding:0 10px;width:auto;min-width:64px;height:30px;" onclick="tctvRemoteSeek(15)" title="Skip forward 15s">+15s \u23e9</button>' +
            '</div>' +
            '</div>';

    html += '</div>'; // end sticky header

    // Couch Nacho markup (shared; CSS decides desktop floating vs mobile in-flow).
    // Placed AFTER the EPG in DOM order so that on mobile (static positioning) Nacho
    // appears under the channel list and above the ad. On desktop he's position:fixed
    // so DOM order doesn't matter - he floats at bottom-left as before.
    var _couchHtml = '<div id="nacho-couch">' +
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
    // Couch Nacho rendered AFTER the EPG so on mobile (static pos) he sits between
    // the channel list and the ad; on desktop he's position:fixed so DOM order is moot.
    html += _couchHtml;
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
    // Legal disclaimer - very dim, bottom of TCTV, applies to all channel content
    html += '<div id="tctv-disclaimer" style="max-width:720px;margin:18px auto 8px;padding:14px 22px;font-size:0.62rem;line-height:1.55;color:#555;text-align:center;letter-spacing:0.2px;opacity:0.65;">' +
        '<div style="font-weight:700;font-size:0.58rem;color:#666;margin-bottom:6px;text-transform:uppercase;letter-spacing:1.2px;">Disclaimer</div>' +
        'Timechain TV aggregates publicly embeddable videos from third-party YouTube channels. Bitcoin Education Archive does not own, host, endorse, or verify any of the content shown. Views and opinions expressed belong solely to the original creators. ' +
        'Nothing on Timechain TV constitutes financial, investment, legal, or tax advice. Bitcoin is volatile and you can lose money - do your own research and consult licensed professionals before making any financial decisions. ' +
        'Price predictions, strategies, and endorsements shown are the opinions of the speakers, not ours. ' +
        '<a href="/terms.html" style="color:#777;text-decoration:underline;">Terms</a> · <a href="/privacy.html" style="color:#777;text-decoration:underline;">Privacy</a>' +
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
        // Mobile: long-press to reveal the full title (500ms hold, no movement).
        // A quick tap or any swipe/scroll cancels the timer so scrolling through the
        // channel guide is not hijacked by the tooltip. (AAR: 2026-04-22)
        var _activeTipEl = null;
        var _lpTimer = null;
        var _lpStartY = 0, _lpStartX = 0;
        var _lpTarget = null;
        var LP_DELAY = 500;       // ms to qualify as long-press
        var LP_MOVE_THRESHOLD = 10; // px - anything beyond = user is scrolling
        function cancelLongPress() {
            if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; }
            _lpTarget = null;
        }
        epgC.addEventListener('touchstart', function(e) {
            var bl = e.target.closest('[data-vid-id]');
            // Any new touch clears an open tooltip so it doesn't linger over scroll.
            if (_activeTipEl) { hideTip(_activeTipEl); _activeTipEl = null; }
            cancelLongPress();
            if (!bl) return;
            _lpTarget = bl;
            _lpStartX = e.touches[0].clientX;
            _lpStartY = e.touches[0].clientY;
            _lpTimer = setTimeout(function() {
                if (!_lpTarget) return;
                _activeTipEl = _lpTarget;
                showTip(_lpTarget, { clientX: _lpStartX, clientY: _lpStartY });
                // Haptic feedback if supported, so the user knows long-press fired.
                try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {}
                if (hideTimer) clearTimeout(hideTimer);
                var captured = _lpTarget;
                hideTimer = setTimeout(function() { hideTip(captured); if (_activeTipEl === captured) _activeTipEl = null; }, 3000);
                _lpTimer = null;
                _lpTarget = null;
            }, LP_DELAY);
        }, { passive: true });
        epgC.addEventListener('touchmove', function(e) {
            if (!_lpTimer) return;
            var dx = Math.abs(e.touches[0].clientX - _lpStartX);
            var dy = Math.abs(e.touches[0].clientY - _lpStartY);
            if (dx > LP_MOVE_THRESHOLD || dy > LP_MOVE_THRESHOLD) cancelLongPress();
        }, { passive: true });
        epgC.addEventListener('touchend', cancelLongPress, { passive: true });
        epgC.addEventListener('touchcancel', cancelLongPress, { passive: true });

        // Sync the sticky time header with manual horizontal scrolling.
        // When the user drags/scrolls the EPG timeline left/right, the
        // time row's container must scroll by the same amount.
        epgC.addEventListener('scroll', function() {
            var timeScroll = document.getElementById('tctv-time-scroll');
            if (timeScroll) timeScroll.scrollLeft = epgC.scrollLeft;
        }, { passive: true });
    })();

    _currentStation = activeStation;
    saveStation(activeStation);
    joinStation(activeStation);

    // Initial station switch — skip noise on first load for faster video render.
    // Set a flag so switchStation skips showChannelNoise on this first call.
    window._tctvSkipFirstNoise = true;
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

    // Skip noise on very first load for faster video render
    if (window._tctvSkipFirstNoise) {
        window._tctvSkipFirstNoise = false;
    } else {
        showChannelNoise(stationObj.emoji + ' ' + stationObj.name);
    }
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
        "Coinjoin, tor, your own relay - chef's kiss. 👩‍🍳"
    ],
    'economics-money': [
        "Printer goes brrrr, Bitcoin stays fixed. 💵→💰",
        "Sound money hits different. 🔔",
        "Austrian Twitter is eating good tonight. 🤨"
    ],
    'freedom-sovereignty': [
        "12 words. 12 superpowers. 🗝",
        "Your keys. Your future. 👑",
        "Permissionless = priceless. 🔓",
        "Not your keys, not your coins. Still true. 🔐",
        "Hardware wallets: training wheels for sovereignty. 🛠️",
        "Self-custody is freedom in practice, not in theory. 🧭"
    ],
    'health-fitness': [
        "Low time preference = long time horizon. 🏃",
        "Gym today. Sats tomorrow. 💪",
        "Steak, sunshine, stacking. 🥩☀️₿",
        "Form check. Mind check. Stack sats. 🧘‍♂️",
        "Sleep is the ultimate proof of work. 😴",
        "Be present. Lift heavy. Stay humble. 🏋️"
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
        "ASICs go brrrr - SHA-256 for days. 🔥",
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
        "Recorded X Spaces - conversations that used to disappear. 🕊️",
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
        "Hope is not a strategy - but Bitcoin is. 🙏"
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
        "Damus, Primal, Amethyst - your home server is your phone. 📱"
    ]
};
var _TCTV_GENERIC_LINES = [
    "Mmm... freshly popped corn and Bitcoin knowledge! ⚡",
    "Proof of Steak? I prefer Proof of Popcorn! 🥩🍿",
    "Timechain TV is my love language. 📺💕",
    "Couldn't look away if I tried. 👀",
    "Bitcoin never sleeps - and apparently neither do I. 😴",
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
        gain.gain.value = 0.034; // -25% per Phil
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
    // Clean up presence tracking - stops heartbeat and deletes the presence doc
    try { _leavePresence(); } catch(e) {}
    var iframe = document.getElementById('tctv-player');
    if (iframe) iframe.src = '';
    _currentVideoId = null;
    _np = { stationId: null, videoId: null, videoTitle: null };
    window._tctvActive = false;
    document.body.classList.remove('tctv-active');
    // Restore leaderboard FAB text
    var _lbFab = document.getElementById('lbFloatBtn');
    if (_lbFab && _lbFab._origText) { _lbFab.innerHTML = _lbFab._origText; }
    var s = document.getElementById('tctv-remote-styles');
    if (s) s.remove();
    if (typeof _tctvRestoreSpriteNacho === 'function') _tctvRestoreSpriteNacho();
    // Stop BlockSurf poller on TCTV exit.
    if (typeof _blockSurfStop === 'function') _blockSurfStop();
    // Clean up any lingering BlockSurf tooltip.
    var bsTip = document.getElementById('tctv-blocksurf-tip');
    if (bsTip) bsTip.remove();
    // Remove tooltip if lingering
    var tip = document.getElementById('tctv-epg-tooltip');
    if (tip) tip.remove();
};

})();
