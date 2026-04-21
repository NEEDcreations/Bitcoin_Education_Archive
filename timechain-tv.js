
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
                {"id":"hJEGnXlYcOA","title":"♟️Web5 Creator Network, Zion with Justin Rezvani | Ep. #59","duration":2582},
                {"id":"NrUnJAovloQ","title":"Primal's Approach to Nostr","duration":2095},
                {"id":"TarmfsQK-oI","title":"Primal, the Bitcoin Powered Social Network Built on Nostr. Full Tutorial!","duration":800},
                {"id":"WzTeiQ9U9bU","title":"Web5: Open to Build - Block/TBD","duration":3328},
                {"id":"arrswch0a1E","title":"Damus app - Nostr client - what is it & how it works? FULL OVERVIEW","duration":735},
                {"id":"V8_d-1PUJsc","title":"Disarm the tyrants with Will from Damus #nostr #socialmedia #freespeech","duration":60},
                {"id":"Kuqs4bYGEEk","title":"Nostr Start Guide for Beginners | Account setup & wallet connect for Zaps","duration":1132},
                {"id":"20rTKJLtnCY","title":"Bitcoin, Web3, and Web5","duration":643},
                {"id":"47Q8jhuUSnA","title":"What Peter Did (Bitcoin Talk with Peter McCormack on THE Bitcoin Podcast)","duration":5310},
                {"id":"ElTSvRbltyg","title":"Nostr Polls on Amethyst, NIP69 demo","duration":132},
                {"id":"wMH64rshd6c","title":"Is Web5 Already Here?","duration":212},
                {"id":"wdz4wJeYkdI","title":"Web5 : Will it truly decentralise the internet?","duration":203},
                {"id":"BY2t8skbsDE","title":"Beginners: Multi-User Web5 App Tutorial","duration":4180},
                {"id":"RGSK993C-Ag","title":"Web5 The Decentralized Web Platform","duration":1971},
                {"id":"xUFMzQYM2AE","title":"The Next Internet Revolution: Decentralized AI Networks and Web5","duration":453},
                {"id":"2wAVyId6QHc","title":"Tutorial: Building a Decentralized Todo App with Web5","duration":665},
                {"id":"HDR_8BkSCMA","title":"What's Web5 - Pt 1 🌐 | #web5 #web3 #shorts","duration":61},
                {"id":"Vw3i2LeVa_Y","title":"An Intro to TBD's Web5 and Decentralized Web Nodes","duration":3307},
                {"id":"HDZWWFSZUF0","title":"Web5... The Web3 Killer?","duration":140},
                {"id":"NO0r69TmOvs","title":"A Summary of Web5 Components that will shape the decentralized Web Platform","duration":359},
                {"id":"Ytdr34GF-sc","title":"Web5: The Future of the Internet BEYOND Web3!","duration":849},
                {"id":"F-CANNnJ76M","title":"Jack Dorsey's Bitcoin Vision Just Became Real #bitcoin #square","duration":84},
                {"id":"3Xt4GzPg7w8","title":"Ex Twitter CEO Jack Dorsey discusses BITCOIN with Joe Rogan","duration":347},
                {"id":"Opio9Ny8HT8","title":"Apple to REMOVE Nostr Client from App Store #bitcoin #nostr #shorts","duration":61},
                {"id":"u_U2obseVwY","title":"How to Start with Nostr Today | Presentation","duration":316},
                {"id":"PWKd9aoZ-Cg","title":"The Past & Future Of DMs And Private Group Chats On Nostr","duration":1782},
                {"id":"8mSyMCJlSwA","title":"Nostr: A simple, open protocol enabling global, decentralized, and censorship-resistant social media","duration":3147},
                {"id":"2qBsSP6a2z4","title":"Playing around on the new Damus App! (Decentralized Twitter Clone for Nostr)","duration":233},
                {"id":"Z0e4bl4MEcY","title":"Jack Dorsey's Stablecoin Bet  Bitcoin's Future or Capitulation","duration":124},
                {"id":"JQFDlCqAAME","title":"TBD & Web5 Thoughts (June 14th)","duration":105},
                {"id":"_bQCkoe4fXU","title":"Web5: The Future of the Bitcoin-Based Internet with Polycarp Nakamoto (WiM512)","duration":5842},
                {"id":"G0FmzKp1CRk","title":"strfry: An Efficient Server for the Nostr Protocol - Doug Hoyte - CppNorth 2023","duration":3108},
                {"id":"FENW6p3giNk","title":"How Jack Dorsey's TBD is Building a Web5 Toolkit for the Future","duration":273},
                {"id":"lcBPUqGwl24","title":"What Did People Think About Bitcoin In 2022?","duration":60},
                {"id":"IyVgilv_hzY","title":"Jack Dorsey Introduces Web5","duration":1323},
                {"id":"MkAutSzZPlw","title":"Pay DID Web5 Demo","duration":275},
                {"id":"9PoA9327sXU","title":"WTF is Web5 & Other Unknowable Mysteries | Web3 Anarchy","duration":2048},
                {"id":"TbeTU5JH5ps","title":"TrustXchange: Web5 Decentralized Finance and Identity Application","duration":292},
                {"id":"tj9DnTV_avA","title":"Nostr App Damus Review & Tutorial - Decentralized Social Media","duration":722},
                {"id":"lQU3ES-3i2I","title":"Day 442 - What is Jack Dorsey and TBD's Web5, ION and tbDEX?  We explain.","duration":1659},
                {"id":"-MY5sB1_GnY","title":"Web5 the Bitcoin based internet","duration":705},
                {"id":"zxkaUxzr4xY","title":"What Nostr Brings to Bitcoin","duration":1308},
                {"id":"XUsk7cqZyKU","title":"Nostr Past, Present, and Future","duration":2881},
                {"id":"uHv9T7Fv2ts","title":"Will Web5 Be a Web3 Killer? Jack Dorsey's TBD Project Explained Simply","duration":424},
                {"id":"Czkv54pQfTI","title":"How To Get Started With Nostr","duration":415},
                {"id":"8GhEezzto4Y","title":"Nostr: Decentralized Social Media & Bitcoin w/ William Casarin (BTC111)","duration":3011},
                {"id":"lj0zzGpQ6mc","title":"What is Nostr? A simple explanation.","duration":108},
                {"id":"0_w6ply1R0M","title":"Web3, web4, web5 and Jack Dorseys plans with bitcoin 👀","duration":767},
                {"id":"4sxon4ajrCM","title":"Zapvertising on Nostr: All Your Models Are Broken","duration":1643},
                {"id":"pJgMp8qVgMk","title":"Web5 Reimagining Digital Identity With Generative AI","duration":2920},
                {"id":"w9ASjv7xiWk","title":"WEB5: AN EXTRA DECENTRALIZED WEB PLATFORM","duration":460},
                {"id":"HPsp4fa5jY8","title":"Web5 and Bitcoin: The Future is Here","duration":1049},
                {"id":"rpc15bNDX-s","title":"Nostr Protocol Overview & Damus App Tutorial","duration":1494},
                {"id":"zzUXjkweZ6k","title":"did you know this? #bitcoin","duration":61},
                {"id":"VrHoprrAops","title":"How to Earn Bitcoin on Nostr with Primal (from Day 1) #bitcoin #nostr #primal #socialmedia","duration":369},
                {"id":"1AdRRpvBpf8","title":"What is Web5 and does it already exist? | Web5 Simplified","duration":2161},
                {"id":"8XX8AgXnY2I","title":"Web5 Protocols with Roles","duration":825},
                {"id":"qn-Zp491t4Y","title":"How To Use NOSTR - A Decentralized Censorship Resistant Social Layer","duration":4433},
                {"id":"MXzWtxR4uZ4","title":"Bitcoin, Nostr & Privacy AI: Kontrolle zurückgewinnen","duration":176},
                {"id":"dWUO0zBKnlo","title":"Debugging Web5 Chat Application","duration":3711},
                {"id":"h_oG9AEFztw","title":"Jack Dorsey-backed TBD Launches New Web5 Toolkit to Decentralize the Internet","duration":119},
                {"id":"Bu5Mtvy97-4","title":"The Currency Wars and Bitcoin's Neutrality: We Didn't Start the Fire [Talk from 2016]","duration":1681},
                {"id":"GmZalQuQoIM","title":"Farida Nabourema / Lyn Alden / Alex Gladstein / Jack Dorsey at Bitcoin Atlantis 2024","duration":3182},
                {"id":"r7ntlxEvVQ8","title":"Build a Decentralized Blog with Web5","duration":3087},
                {"id":"4ZvowA1d7dE","title":"Web5 - Beginners Workshop: 'Mean Girls' Application","duration":5589},
                {"id":"heJ5Iw_UpD8","title":"Primal Crash Course","duration":275},
                {"id":"gLV8i8KtkfI","title":"S15 E21: Fiatjaf on Nostr, Drivechains & Why Lightning Sucks","duration":6880},
                {"id":"mwbyKIFzmS0","title":"Unstoppable Money And Free Speech (Nostr)","duration":337},
                {"id":"p9UkCmhafkk","title":"What is web5? The future of Social media........","duration":232},
                {"id":"78k8qAEzDBM","title":"Jack Dorsey's TBD to Launch Web5","duration":329},
                {"id":"FYbQLja9Oe8","title":"What are \"zaps\" in Nostr/Damus? ⚡️","duration":225},
                {"id":"1HfcS7Cxnwo","title":"What is Jack Dorsey's Web5? | The Tech Whisperer | Jaspreetbindra","duration":133},
                {"id":"nusKpnFr3IY","title":"\\\"Exploring Web 5.0: The Next Evolution of the Internet\\\" #Web5.0 #searchslabs #virtualblockchain","duration":612},
                {"id":"M9c5CI3-4FM","title":"Beginner’s Guide to DIF & Google's Web5 Community Node","duration":3544},
                {"id":"fEXa-dBClN0","title":"Is This the New Industrial Revolution? AI, NOSTR & Bitcoin Lightning | Roland from Alby Hub","duration":3666},
                {"id":"FPoLTkNMzf8","title":"A Rogue Developer’s Critical Take on Dorsey’s Web5","duration":159},
                {"id":"oN5cB5ACC-8","title":"How to Query DWN Records by Tags | Web5 in 5","duration":257},
                {"id":"SyANPFkOpME","title":"Did we reach ATH during a bear market? #bitcoin","duration":72},
                {"id":"KgZYtsj9-V0","title":"Meet Web5","duration":86},
                {"id":"yzqGrtWnLLo","title":"one stop shop news on nostr","duration":55},
                {"id":"QrzHD5z9p1s","title":"Web5: An Open Source Trust Layer for the Web - Angie Jones, TBD (a business unit of Block)","duration":1623},
                {"id":"0YDj1QdL2Zs","title":"Jack Dorsey explains how Nostr works in 2 minutes","duration":140},
                {"id":"MWNs-KeoH6k","title":"En route to unpacking web5 technologies.","duration":86},
                {"id":"J6I-OzXItfA","title":"Jack Dorsey Explains Bitcoin","duration":125},
                {"id":"aOWemFCAI-c","title":"web3 and web5 Bitcoin All Market Web 2022 #web3 #web5ngay #bitcoin #crypto #cryptoupdate","duration":633},
                {"id":"Ybe09ImCnvk","title":"Edward Snowden and Jack Dorsey on Nostr","duration":4793},
                {"id":"zIN1ggt5ATg","title":"Jack Dorsey’s Bitcoin project TBD plan to trademark ‘Web5’","duration":66},
                {"id":"Qd4Po4i7wvc","title":"PRIMAL: Nostr Decentralized Social Media Meets Bitcoin! Full Tutorial","duration":2875},
                {"id":"v8CQN8nK3gs","title":"Web5: An open source decentralised web platform","duration":1994},
                {"id":"Q6f6bdKWqF8","title":"Nostr Explained! The Social Network That Can’t Be CENSORED!","duration":545},
                {"id":"fG1IDm-lQek","title":"Damus For NOSTR - Tutorial","duration":3672},
                {"id":"3oLP0mRB6yI","title":"Jack Dorsey Reveals Bitcoin-Based WEB5","duration":515},
                {"id":"owbkzvLhblk","title":"Verifiable Credentials for Data Unlocking. core of web5","duration":925},
                {"id":"behkkIPeB0I","title":"Web5 Explained In 2 Minutes | What is Web5? | Yash Ekbote","duration":139},
                {"id":"bSyETtbViOk","title":"Dylan LeClair On Bitcoin, Nostr, Ordinals, Regulation, & The Fed","duration":2250},
                {"id":"ZGQLy5caaxk","title":"Jack Dorsey’s TBD Is Building an 'Extra' Decentralized 'Web5' on Bitcoin","duration":168},
                {"id":"qUwXRDrfJU0","title":"ODELL X JACK: ALL CAPS FIRESIDE","duration":3241},
                {"id":"LNJ4qSyxDqY","title":"Building NOSTR with Damus & Zaps Creator Will Casarin (BWP57)","duration":4669},
                {"id":"NVm_jGdwTjQ","title":"Nostr for Beginners w/ Derek Ross","duration":2243},
                {"id":"0OiZY1MRHXo","title":"Nostr Wallet Connect Workshop - BBB 2024","duration":2674},
                {"id":"MVb-l-9Zel8","title":"Web1,web2,web3,web5 , web7 and hundreds of web next explained. What is the future of AI humanity?","duration":1944},
                {"id":"zteh-aHb4cM","title":"WATCH This Before Starting Nostr (Safety and Privacy Tips!!)","duration":434},
                {"id":"TG56gKl84kE","title":"Web5 Explained in Under 3 Minutes","duration":174},
                {"id":"-9IoQCeCaqU","title":"How to receive nostr zaps to your own node - Voltage Nostr toolkit walkthrough","duration":317},
                {"id":"Q7Q4IcwVDjY","title":"What is Nostr? The New Decentralized Network","duration":60},
                {"id":"UubHnejeG44","title":"Jack Dorsey and Bitcoin","duration":466},
                {"id":"Ua64ymE6KQ0","title":"Bitcoin and Nostr w/ Jack Mallers and Miljan","duration":2015},
                {"id":"RlS-f7eWuF8","title":"Did Bitcoin Front-Run the Iran War Panic?","duration":98},
                {"id":"WtXhsFD2PjU","title":"Web5: True Decentralization Or Marketing Gimmick?","duration":1251},
                {"id":"k3tt87jeYnc","title":"NOSTR Account in 10 Minuten erstellen!","duration":644},
                {"id":"ButstuTuea8","title":"Jack Dorsey's biggest problem with Elon Musk's X (formerly Twitter)","duration":470},
                {"id":"S6y2Vy2N9oY","title":"NOSTR TOOLKIT: Linking To Your Own Lightning Node With Voltage","duration":4370},
                {"id":"NVXAOOhWi-4","title":"Desiree Dickerson on Building THNDR Games, Competitive Leagues, and Cross-App Identiy on Nostr | E99","duration":4668},
                {"id":"0e-e4HlPXlg","title":"WHAT IS WEB5 ?? WHY JACK DORSEY ANNOUNCED WEB5?? WILL IT REPLACE WEB 3.0??","duration":424},
                {"id":"fK1f-Bis4gU","title":"What is Web5? Jack Dorsey comes out with Web5 (Web3 Killer?) | Ali Solanki","duration":233},
                {"id":"Eu0rNhmENXQ","title":"NOSTR Workshop w/Sebastian Hagens (Sebastix)","duration":1809},
                {"id":"3vbwkTVuf6w","title":"CONTENT CREATORS: Why YOU Should Use #Nostr & How to Build a BIG Audience - JEFF BOOTH","duration":399},
                {"id":"lwbUwl8cNAI","title":"Did The Bible Warn Us About Bitcoin? - Get Based TV","duration":943},
                {"id":"B567h6MFLzE","title":"Web5 and the Decentralized Self: Reclaiming Your Digital Footprint","duration":336},
                {"id":"-EhXdsJr8Hw","title":"NOSTR Explained for Beginners ⚡️✨","duration":1429},
                {"id":"x2M9d-Qg6xs","title":"[log 00003] Damus Web - A Nostr Client","duration":470},
                {"id":"yIccRIEr2gQ","title":"Nostr Explained Visually for Beginners","duration":985},
                {"id":"9gWXcmkUaD4","title":"Did Bitcoin Just Gain A Powerful Ally?💥 #MSCI","duration":69},
                {"id":"exDH4s6ikJ0","title":"What is WEB5? WEB5 Explained For Beginners!","duration":568},
                {"id":"kqR_IQfKic8","title":"NOSTR vs Tech Monopolies, the Future of Social Media & Primal 2.0 - MILJAN (THE Bitcoin Podcast)","duration":6436},
                {"id":"AbbBHntSypI","title":"Issue Verifiable Credentials With Web5","duration":4051},
                {"id":"j0eMHXx6zdg","title":"The Future of Bitcoin - Jack Dorsey","duration":1491},
                {"id":"012e9R3v6VM","title":"VerifiedEntity | Verified businesses using Web5 DIDs and decentralized web nodes.","duration":180},
                {"id":"qiVzn9ADHq0","title":"billionaire Jack Dorsey is going ALL IN on Bitcoin 👀","duration":61},
                {"id":"ilhxlFUOSzk","title":"Web5 Explained... By a Bitcoin Maximalist","duration":1020},
                {"id":"4kOBPE63eUc","title":"Quick start with Web5.js","duration":1123},
                {"id":"XoGntcN5mh0","title":"When This Goes Viral, It's Too Late (Nostr 2025 Guide) - Miljan Braticevic","duration":5348},
                {"id":"0BvU0nC2BcM","title":"Web5 - A simplified look into becoming a walking Human API #web5","duration":268}
            ]
        },
        {
            "id": "art-philosophy",
            "name": "Art & Philosophy",
            "emoji": "🎨",
            "desc": "Bitcoin art, ordinals & deeper meaning",
            "color": "#a855f7",
            "videos": [
                {"id":"SogEkk3-XnA","title":"I BOUGHT THIS BITCOIN NFT! (BRC-20, NFTs, Ordinals)","duration":668},
                {"id":"JPJyDYmovJo","title":"A FULL BOX of Bitcoin Trading Cards - BTC Viking","duration":755},
                {"id":"ic6pDq3OAec","title":"Philosophy of Bitcoin - First Principles","duration":1949},
                {"id":"EaU5yFi61hg","title":"Yonat Vaks on Her Artistic Journey & Bitcoin Art - Bitcoin Art Podcast Ep. 3","duration":6067},
                {"id":"8FxyOC26TYE","title":"What's In A Based Trading Cards Bitcoin Pack?","duration":737},
                {"id":"b4Q8Y3Rg7Rc","title":"Frederic Guimont on Ratel & Bitcoin Comics - Bitcoin Art Podcast","duration":7620},
                {"id":"QVg0ZmxrYLo","title":"Bitcoin's Most Beautifully Absurd Art Drop","duration":504},
                {"id":"8TN7mq6cK7g","title":"Bitcoin Art with FractalEncrypt - Freedom Footprint","duration":5006},
                {"id":"sntmLivV56M","title":"Adam O'Brien & Brandon Gentile Ripping BitBlockBoom 2024 Packs","duration":364},
                {"id":"3nA4HhsbZMQ","title":"Anik Malcolm on Finding Purpose in Bitcoin Art - Bitcoin Art Podcast Ep. 4","duration":4016},
                {"id":"Q5Wxg53qu9s","title":"The Bitcoin Full Node Sculpture #2 of 10","duration":16},
                {"id":"RnducAborVw","title":"Bitcoin Art Gallery - Miami 2022","duration":419},
                {"id":"PqFz8R1CZYo","title":"Bitcoin as a Kardashev-Scale Technology - Robert Breedlove","duration":755},
                {"id":"Mqc6M8rZRi8","title":"BITCOIN TRADING CARDS?","duration":1066},
                {"id":"cKkokcMMnpc","title":"Bitcoin Aligns with the Laws of Nature - Robert Breedlove","duration":5473},
                {"id":"EPUNITbXwEM","title":"Bitcoin Trading Cards: Collectible Art To Orange Pill The World","duration":1674},
                {"id":"l5a6-9mNqho","title":"World's Largest Bitcoin Sculpture","duration":58},
                {"id":"scKs1X9rcTU","title":"Martin Lukas Ostachowski, Modeotec & TC on Visualizing Bitcoin | The Movement of Art Ep. 6","duration":5782},
                {"id":"XHBydlTt2jM","title":"The Rise of Ordinals and Art on Bitcoin","duration":1499},
                {"id":"OszL_Q2wvNQ","title":"Welcome to Ordinals! What is Ordinal Theory? - Ordinals Explained Ep. 1","duration":80},
                {"id":"JffTkZZC2z8","title":"What is Money? - Robert Breedlove","duration":4932},
                {"id":"0qS_oBk-tbY","title":"FractalEncrypt: Artistic Bitcoin Education - Bitcoin With Jake #44","duration":3723},
                {"id":"AKri5ZKYPAk","title":"LSD, Shrooms, DMT, Mescaline... and Bitcoin","duration":1140},
                {"id":"SKIIif9WQok","title":"Bitcoin Renaissance Legacy: Beyond Digital Gold","duration":1242},
                {"id":"cgzH1jScIn0","title":"Bitcoin NFTs - Ordinals Explained Full Guide (Wallet Setup & Mint)","duration":987},
                {"id":"83mw71TLYjY","title":"Leveling Up Your Collection: PSA Grading for Bitcoin Trading Cards","duration":1891},
                {"id":"XrD617FIfJM","title":"FractalEncrypt's Bitcoin Full Node - DESIGN Feature for Block04","duration":63},
                {"id":"UrCN7oG_4YY","title":"Bitcoin NFTs: How to Create Ordinal Inscriptions","duration":708},
                {"id":"vPUpdXZPpbQ","title":"Nashville Bitcoin Mural - Sound Money","duration":41},
                {"id":"ImZDBBjdX6s","title":"Opening The BOX! 24 Packs of BTC Trading Cards - Crypto Viking","duration":752},
                {"id":"IUpIoZIoO2Q","title":"Ripping BitBlockBoom Packs (Bitcoin Trading Cards)","duration":185},
                {"id":"GwA4zt9R1AU","title":"How is #Bitcoin anti-war? Erik Cason and American HODL on #TPBPod","duration":54},
                {"id":"1gnIbVFnuCY","title":"The Biggest Scam in Human History - Robert Breedlove","duration":5936},
                {"id":"5gl2xVJ9mTw","title":"What are Satributes & Recursions? - Ordinals Explained Ep. 3","duration":121},
                {"id":"j3QJlyRMHpI","title":"Art on Bitcoin: Shaping the Future of Digital Creativity","duration":470},
                {"id":"NALikCvCyes","title":"The Truth About Money, Inflation and Bitcoin - Robert Breedlove","duration":6120},
                {"id":"XTFoHv8GXj0","title":"Bitcoin Art: Genesis Edition Hardcover Book","duration":44},
                {"id":"Q4owb6f9gbM","title":"FractalEncrypt & Rebel Money on Bitcoin Art & Time - Movement of Art Ep. 5","duration":4034},
                {"id":"7DIp6D-68cQ","title":"Can Bitcoin Rebuild Civilization? - Saifedean Ammous","duration":3033},
                {"id":"-vKBCrUyCEU","title":"Bitcoin Ordinals Explained","duration":421},
                {"id":"VLRt0QOZ3TE","title":"Bitcoin Trading Cards: The Scarcest Collectibles on Earth","duration":128},
                {"id":"GRby6vAPwHI","title":"Bitcoin, Art, and Our Divine Lost Knowledge - Ariel Birdie","duration":4258},
                {"id":"yvdZsN5s9sc","title":"Based Trading Cards Movement","duration":5680},
                {"id":"Ifi-Hg3n3bc","title":"Bitcoin Ordinals Explained: How To Make Your First Bitcoin NFT","duration":233},
                {"id":"wYhpD6Y6E8E","title":"Meet Based Trading Cards - Bitcoin Culture You Can Hold","duration":53},
                {"id":"iFb2MMUZBYs","title":"Bitcoin Artist Trevor Jones Augments Reality","duration":382},
                {"id":"uIaUj6Nsi70","title":"2024: A Landmark Year for Bitcoin Trading Cards - Bold New Look","duration":16},
                {"id":"rYiWd-qIRQA","title":"Kontext on Writing, Music & Stoicism - Bitcoin Art Podcast Ep. 5","duration":5759},
                {"id":"gb2S1Filtic","title":"How Bitcoin Fixes Fiat's Millennium of Mistakes - Saifedean","duration":1587},
                {"id":"omKlwzKmKBE","title":"Bitcoin Trading Cards: Understanding True Scarcity and Value","duration":264},
                {"id":"RwO9lB-rloo","title":"Bitcoin, Art, and Freedom with Madex","duration":5310},
                {"id":"2Jf8sxF8QFQ","title":"Miami debuts Bitcoin Bull Statue","duration":163},
                {"id":"Z0_9Jw56l4k","title":"Opening 2 Packs Of Bitcoin Trading Cards","duration":1087},
                {"id":"9-S17oAxIqA","title":"Bitcoin Pencil Art Timelapse - Bitcoin Apex","duration":792},
                {"id":"h9jO1cipnc8","title":"2024 Bitcoin Trading Cards Halving Edition Whale Packs - Launch Announcement","duration":61},
                {"id":"BrfJgr19MPY","title":"Alex Schaefer on Burning Banks & Protest Art - The Whole Entire Universe","duration":6032},
                {"id":"indFxEWINDA","title":"We Gave Bitcoin Trading Cards to No-Coiners - Here's What Happened","duration":939},
                {"id":"yMoVGgR6h0Y","title":"Money: The Language of Power - Robert Breedlove","duration":4307},
                {"id":"JQg_s0wt96M","title":"Bitcoin Trading Cards Are Back With Series Two","duration":898},
                {"id":"YZ2B-Qnm0eM","title":"The Timechain Codex by FractalEncrypt","duration":77},
                {"id":"FiFwaHCRz7s","title":"Bitcoin's BRC-20 Explosion: Everything You Need To Know About Ordinals","duration":286},
                {"id":"P0WZCTDDGXQ","title":"Create and List Your Own Bitcoin Ordinals - Ordinals Explained Ep. 5","duration":99},
                {"id":"nvPJ_F845ms","title":"Sam Kimbrow & Asanoha on Bitcoin Culture - Movement of Art Ep. 1","duration":4583},
                {"id":"edyO5-L9un8","title":"Marcus Connor & The Bitcoin Roller Coaster Guy","duration":3732},
                {"id":"gNOnNz4d_mI","title":"Tone Vays Rips BitBlockBoom 2024 Bitcoin Trading Cards Packs","duration":328},
                {"id":"3e36FXH5Hlw","title":"Amy DiGi on Community, Craft & Handmade Bitcoin Art - Bitcoin Art Podcast Ep. 2","duration":4744},
                {"id":"33emHIL1IoU","title":"The Bitcoin Full Node Sculpture - Eric Weiss","duration":293},
                {"id":"lo7eeL1E_VQ","title":"A Madex Manifesto","duration":281},
                {"id":"e1ojV8YwA2c","title":"Gus Grillasca on Rare Pepes, BTC Art & Creative Engineering - Bitcoin Art Podcast Ep. 1","duration":5503},
                {"id":"wSLejJ88VGQ","title":"Ripping Spirit of Satoshi Packs (Bitcoin Trading Cards)","duration":236},
                {"id":"xwufPksmi9w","title":"Cracking A Pack Of Based Trading Cards Series 3 - Warriors Vs Villains","duration":484},
                {"id":"bgDwvJOtSSY","title":"Naomi Olson on Ocean Art & Aloha Energy - The Whole Entire Universe","duration":4967},
                {"id":"KORJr5ZfzWI","title":"Bitcoin Full Node Sculpture","duration":38},
                {"id":"btiN4DabrRk","title":"Bitcoin, 'Christian Anarchy', and the Logic of Belief","duration":6256},
                {"id":"N3a8IQXKjeY","title":"What are Ordinals? - Ordinals Explained Ep. 2","duration":86},
                {"id":"bHj-a4_nX78","title":"FractalEncrypt Bitcoin Full Node Sculpture","duration":30},
                {"id":"lRr9ofu0tnk","title":"Bitcoin Art Magazine Unleashed","duration":5762},
                {"id":"Tr7XO-SQw5g","title":"Marcus Connor, Pepenardo & Rare Scrilla on Memes - Movement of Art Ep. 3","duration":5056},
                {"id":"MRnmP7pbR0s","title":"Creating Meaningful Art with FractalEncrypt","duration":3582},
                {"id":"pcVCt2utTW4","title":"How to Make a Bitcoin Ordinal Inscription in Under Two Minutes","duration":369},
                {"id":"tgM5wwpwpzA","title":"Ariel B., Flo M., Antonio B. & Psyfer on Stories & Myths - Movement of Art Ep. 2","duration":4436},
                {"id":"KxTWC3ShYDE","title":"Just-B on Airbrush Mastery - Bitcoin Art Podcast","duration":7385}
            ]
        },
        {
            "id": "orange-pill",
            "name": "Beginners 101 & Orange Pill",
            "emoji": "🟠",
            "desc": "Start here — Bitcoin basics + the orange pill journey",
            "color": "#f7931a",
            "videos": [
                {"id":"J8YgqbQyYB8","title":"Andreas Antonopoulos educating an empty room on the bitcoin value proposition when it was $100.","duration":129},
                {"id":"mnlskhJlWIU","title":"Bitcoin Market Cap Distribution Animation (8/28/24 Update)","duration":99},
                {"id":"Jh1TJAeQm3o","title":"Why the US Dollar Dominated the World After WWII","duration":105},
                {"id":"z4RyPyS_Cas","title":"Bitcoin Built a System Traditional Finance Can't Touch #bitcoin #finance #shorts","duration":58},
                {"id":"n9QlPzzahXg","title":"DEAD AND ALIVE","duration":564},
                {"id":"wClCVfnfCpo","title":"Bitcoin Price Manipulation CONFIRMED! Jane St, ETF's and what happens next","duration":433},
                {"id":"aHvoUyclQrE","title":"Scottish Stock Investor Is Asked About Bitcoin In 2022","duration":59},
                {"id":"Ut1g5fFeamc","title":"Are You Built for Bitcoin’s Volatility?","duration":57},
                {"id":"Ae4nF0Bu75I","title":"Bitcoin is long-term Savings Technology","duration":49},
                {"id":"9sK--GhseBE","title":"He Left 1,000,000 BTC and Disappeared – Satoshi Claus (Bitcoin Bedtime Story)","duration":4807},
                {"id":"y48uAeHwZGg","title":"Bitcoin Has Officially Processed Over 1 Billion Transactions!","duration":97},
                {"id":"CkfjTUzopho","title":"Bitcoin THRIVES in CHAOS!","duration":507},
                {"id":"dDa4UrYZCPA","title":"1.  Is Bitcoin's Volatility a Bad thing? Or an Advantage?","duration":438},
                {"id":"d7ID3fKAFQM","title":"Jack Mallers \"Intro to Bitcoin\" at Bitcoin Atlantis 2024","duration":2859},
                {"id":"4WXXZLYgdgA","title":"Bitcoin Price Distribution Animation (1/13/25 Update)","duration":101},
                {"id":"TgG915kVQrg","title":"Brits Making Bitcoin Price Predictions in 2021","duration":442},
                {"id":"S7LV9xJLz4Q","title":"The Fastest Asset Ever Built (0 to $1 Trillion Bitcoin Bedtime Story)","duration":7670},
                {"id":"ZkgkxB8s9bw","title":"Can Bitcoin Be Futureproof? - w/ Adam O'Brien - Get Based TV","duration":3586},
                {"id":"mYK4rZSrBL8","title":"Bitcoin: Daily DCA Cost Basis (12/16/24 Update)","duration":86},
                {"id":"6qVq7T-NJdE","title":"Gen Z Knows the System Is Broken... Bitcoin is the Escape Plan - Julian Figueroa","duration":4860},
                {"id":"ieiwq2m9aWg","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (5/14/25 Update)","duration":85},
                {"id":"DLsIcIoLSsI","title":"Bitcoin = Money + Time + Energy + Information by @dergigi","duration":1524},
                {"id":"boWa573lchk","title":"What the h@!& is the Agentic Bitcoin Internet???","duration":434},
                {"id":"4tqXvMNOuHk","title":"Bitcoin Ethical Superiority Explained - Exit Manual","duration":45},
                {"id":"TmOlADL_llQ","title":"Bitcoin Quantum Exposure Weekly Report (4/7/26 - 4/14/26)","duration":302},
                {"id":"hW36zox-xR8","title":"Jack Mallers","duration":7084},
                {"id":"rFPp6vV80B4","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (11/25/24 Update)","duration":81},
                {"id":"Ym5kXxZ0eKg","title":"New ALL TIME HIGHS in 2026?","duration":492},
                {"id":"DDOgW7F3YNs","title":"The $1M Bitcoin Bet with Balaji Srinivasan and Alex Gladstein (WiM289)","duration":4841},
                {"id":"uOnlGmN89ws","title":"The Perfect Environment for Bitcoin is Coming!","duration":244},
                {"id":"BzLFQqpzI04","title":"6. Does Bitcoin Have No Intrinsic Value?","duration":266},
                {"id":"YT-38EneBWw","title":"Bitcoin Street Interviews London - Mike Still","duration":1491},
                {"id":"Otoz02b9PiY","title":"\\\"Bitcoin Cultures\\\" presentation for Strike","duration":3337},
                {"id":"cCvCvnwd0so","title":"Will Full Blocks Destroy Bitcoin?","duration":854},
                {"id":"RPR5dtmXnY8","title":"Bitcoin Q&A: Where Can I Buy and Spend Bitcoin?","duration":253},
                {"id":"BfUJnKFacNU","title":"SVB, Signature Bank and Silvergate Were PURPOSEFULLY Collapsed In Order To CRUSH Crypto","duration":1114},
                {"id":"w9YktzBIazM","title":"Your money is spying on you","duration":649},
                {"id":"e7CIeZmaNEs","title":"Bitcoin Adoption Is Going Mainstream!","duration":71},
                {"id":"56L0Mm1isIE","title":"I Don't Want To Know About Bitcoin","duration":23},
                {"id":"R87W6PFl868","title":"Top 10 Cryptocurrencies By Market Cap & Bitcoin Dominance (12/7/25 Update)","duration":83},
                {"id":"lPbp3dZCCUY","title":"The Top 6 Massively Bullish 2026 Bitcoin Catalysts!","duration":1014},
                {"id":"s4g1XFU8Gto","title":"Bitcoin explained and made simple","duration":205},
                {"id":"8e6hTYr9Gv0","title":"Bitcoin Days Since All Time High (12/3/24 Update)","duration":101},
                {"id":"ALyumQ90yz0","title":"Asking European Girls If I Can Send Them Bitcoin","duration":40},
                {"id":"5hfEBupAeo4","title":"All Wars Are Bankers' Wars","duration":2614},
                {"id":"KG0Q05Lnm7s","title":"Why Bitcoin matters for human rights, in two minutes","duration":128},
                {"id":"HhxcdMIJTLA","title":"Telling People About Bitcoin Never Works - Exit Manual","duration":452},
                {"id":"5YDJfqxFaCI","title":"Bitcoin 200 Day Moving Average & 200 Week Moving Average (8/25/24 Update)","duration":94},
                {"id":"kBoSO7612v0","title":"Top 10 Cryptocurrencies By Market Cap & Bitcoin Dominance (9/18/25 Update)","duration":80},
                {"id":"wk6-nqOkZMc","title":"Advanced Civilizations Don't Print Money, They Harvest Energy #kardashev #bitcoin","duration":86},
                {"id":"4xGTGqsy4SM","title":"ORANGE PILL PODCAST - Episode 0001","duration":5081},
                {"id":"l3c8l4rgp6s","title":"Inside Costa Rica's Secret Bitcoin Community - Get Based TV","duration":1139},
                {"id":"xQgY49OSpLE","title":"Bitcoin Price on This Day Animation (6/12/24 Update)","duration":91},
                {"id":"E4HV-xGAXug","title":"Bitcoin: Supply, Difficulty, & Price Animation (2/18/25 Update)","duration":103},
                {"id":"4UDkbGMvGIY","title":"5. The Biggest Risks to Bitcoin","duration":610},
                {"id":"jqnI3OQA110","title":"Why Bitcoin’s Correlation Is Breaking: Inflation Shock, Tech Selloff, and MicroStrategy Buying Spree","duration":315},
                {"id":"LZBUJwHhH24","title":"Regulators Isolate the Bitcoin Industry | Hard Money","duration":603},
                {"id":"Nls1keqHlz8","title":"Show This Video At The Dinner Table To Orange Pill Your Family!","duration":194},
                {"id":"btF6nKHo2i0","title":"An Economic Hit Man Confesses and Calls to Action | John Perkins | TEDxTraverseCity","duration":1116},
                {"id":"SS8-qjP-yAo","title":"We Investigated Canada's Secret Bitcoin City - Get Based TV","duration":851},
                {"id":"l9jOJk30eQs","title":"How Bitcoin Works in 5 Minutes (Technical)","duration":326},
                {"id":"83-Q19F_uw0","title":"BTC Map: U.S. Bitcoin Merchant Adoption Per 100k Population (12/19/25 Update)","duration":84},
                {"id":"U3Y5Cab1nlA","title":"Quantum Computing and Bitcoin (16 July 2019)","duration":6777},
                {"id":"jkSeosiLmh4","title":"How to mine BITCOIN with your Home PC or Laptop!","duration":784},
                {"id":"nTRdmYX-0h8","title":"Warming Up to Bitcoin - The Future of Sustainable Heating? - Get Based TV","duration":548},
                {"id":"og5zZssEWIc","title":"Bitcoin Street Interviews Birmingham - Mike Still","duration":473},
                {"id":"YLDpujqF7-4","title":"CNBC: AI Found Bitcoin's Weak Spot. It's Not What You Think.","duration":146},
                {"id":"Vqn7bJZXX8Q","title":"Bitcoin Has No Competition","duration":705},
                {"id":"a7fmTcHIyQQ","title":"Is Bitcoin entering a SUPERCYCLE? What does this mean for the price?","duration":446},
                {"id":"stN03wk_Wzs","title":"Cryptocurrency Explained: All the ships are sinking (Currency Wars II)","duration":2325},
                {"id":"tmaNeKVlvx0","title":"English Guy Speaks INCREDIBLE Arabic","duration":683},
                {"id":"_KfdgZAFMf0","title":"Bitcoin HODL Waves Animation (11/7/24 Update)","duration":100},
                {"id":"CmogAUugkDo","title":"Bitcoin: Compound Annual Growth Rate (CAGR) Animation (12/31/24 Update)","duration":76},
                {"id":"8J2xIqLhcB4","title":"Bitcoin Supply Distribution Animation (8/31/24 Update)","duration":99},
                {"id":"5KTiwi59CUk","title":"Bitcoin Days Since All Time High Animation (5/21/25 Update)","duration":104},
                {"id":"Fp9xhVeWUMs","title":"Asking Strangers About Bitcoin & Cryptocurrency","duration":694},
                {"id":"f52ElIVn1so","title":"The system you hate is still your only option? #Bitcoin #Economy #Mindset","duration":64},
                {"id":"4QVuQH2DEJM","title":"Orange Pill [OP23] - Bitcoin Reveals the Fiat Dark Ages","duration":4736},
                {"id":"vMuuL97uqnc","title":"Bitcoin Price Distribution Animation (11/11/24 Update)","duration":100},
                {"id":"3l4tn0v0Eyc","title":"Not your keys, not your Bitcoin #Bitcoin #Security","duration":38},
                {"id":"5VAX3JL_l90","title":"Bitcoin: Why collectivists win","duration":683},
                {"id":"ujQogDtaHU8","title":"What is Bitcoin? Simply explained by Peter Van Valkenburgh","duration":52},
                {"id":"vwkRsp0gqX4","title":"Bitcoin Halving 2024: How It's Different This Time, Myths Debunked, Bitcoin Bugs, and More","duration":890},
                {"id":"ExUeCIscbNU","title":"Something is Deeply Wrong with the Economy Right Now - Julian Figueroa","duration":287},
                {"id":"1Lcu7ZCJYnw","title":"DCA Live: Bitcoin, ETF's & Impact, Rotation, Web3, PlanB Retracement, Celsius and more","duration":4122},
                {"id":"Bt2Z-_nhpwQ","title":"How to Orange Pill Anyone","duration":840},
                {"id":"cqg9EeydwRc","title":"Bitcoin OG Is Still Bullish In 2022 [UNCUT]","duration":711},
                {"id":"NuKcDkaH2fc","title":"Orange Pill [OP40] - The Dust Bowl of Money","duration":5285},
                {"id":"ONvg9SbauMg","title":"The Stories We Tell About Money","duration":2848},
                {"id":"WkkBma768h8","title":"Why Psychedelics Unlock Hidden Dimensions of the Mind","duration":900},
                {"id":"41JCpzvnn_0","title":"What is Bitcoin?  Bitcoin Explained Simply","duration":769},
                {"id":"xAcaBBZrqlI","title":"Cash or Bitcoin? [2022]","duration":56},
                {"id":"CgCX1K-uD7o","title":"IS CRYPTO A SCAM? (Asking The Public)","duration":591},
                {"id":"_9TI4Pzl-RQ","title":"SEPARATION OF MONEY AND STATE","duration":451},
                {"id":"WPLsTgYWeBA","title":"Andreas M. Antonopoulos: Why I Bought Bitcoin [2024]","duration":3444},
                {"id":"D3n6lLeuPQA","title":"\\\"Seven distinct network effects of bitcoin\\\" - Trace Mayer","duration":469},
                {"id":"HYjOrFqu3Ps","title":"Bitcoin 1/2/3/4 Year Window Animation (4/17/24 Update)","duration":283},
                {"id":"kjsUN_9siKw","title":"Episode 1: Grow Your Wealth, AND Fix the World: Bitcoin!","duration":499},
                {"id":"YY4NqAC0O58","title":"F. Schubert, \\\"Trout\\\" quintet.","duration":2419},
                {"id":"T_hXPEh8S60","title":"Becoming A Bitcoin Maximalist: The Journey (Asking REAL People)","duration":623},
                {"id":"QC1HYFB8ExQ","title":"Lyn Alden on Why Bitcoin Didn't Explode This Cycle","duration":57},
                {"id":"PFQ9bCtlyPA","title":"You're Running Out Of Time (Bitcoin)","duration":782},
                {"id":"ZiFlXHLjbfI","title":"I FOUGHT THIS MAN IN A CAGE... Now We're Talking BITCOIN!","duration":5701},
                {"id":"Idnf0BQQI04","title":"SENDING BITCOIN TO STRANGERS [2022] (now worth $1,000+)","duration":1019},
                {"id":"LCM6YnCpdlE","title":"The U.S. dollar 'as we know it' will be dead in 10 yrs, bitcoin price to hit $2 million in 5 yrs","duration":1558},
                {"id":"Xu4R3Ae0yrQ","title":"Bitcoin Target Hash Animation (9/11/24 Update)","duration":103},
                {"id":"H_kQb8xG5Bo","title":"2. Is Bitcoin A Ponzi Scheme?","duration":299},
                {"id":"ulimNuaKIQM","title":"Slaying The Bitcoin Bear Whale","duration":777},
                {"id":"Uh-eTnRXCr8","title":"Bitcoin Street Interviews Edinburgh - Mike Still","duration":1397},
                {"id":"x78Y7TE9eyo","title":"BITCOIN'S NEXT BULL RUN","duration":414},
                {"id":"Qr4DyTFMxkI","title":"Bitcoin and DNA","duration":366},
                {"id":"tCrC-3ItEko","title":"Cash Or Bitcoin? [2022]","duration":57},
                {"id":"cbnL1yOv1VU","title":"Bitcoin: The Inverse of Clown World","duration":404},
                {"id":"Jab0pJklPwk","title":"The Ultimate Math of A Bitcoin Denominated World","duration":340},
                {"id":"u92BMyUzw9o","title":"The US Debt Crisis is Getting SCARY | Bitcoin is the Escape","duration":1061},
                {"id":"rjLhuqDaTu4","title":"Average Price: Ground Beef in Average U.S. City, BTC vs USD (9/7/24 Update)","duration":95},
                {"id":"MPyFfLboOFs","title":"Bitcoin: Daily DCA Cost Basis (9/24/24 Update)","duration":85},
                {"id":"gt4HBSUjENE","title":"Would You Rather Have $100 Or 1 Bitcoin?","duration":486},
                {"id":"mhn9HgAhrss","title":"The MOST Important Thing to Understand about Money!","duration":281},
                {"id":"XG7v4XFL7mc","title":"Stossel: Is Bitcoin Better Money?","duration":298},
                {"id":"3w4AbAmedVs","title":"Bitcoin: Compound Annual Growth Rate (CAGR) Animation (10/16/24 Update)","duration":74},
                {"id":"SSo_EIwHSd4","title":"How does a blockchain work - Simply Explained","duration":360},
                {"id":"hYip_Vuv8J0","title":"Blockchain Expert Explains One Concept in 5 Levels of Difficulty | WIRED","duration":1070},
                {"id":"M1XPOFgjNPk","title":"What US Taxpayers With Crypto NEED to do before Dec 31, 2024 - Get into the Safeharbor!","duration":5871},
                {"id":"xDKxX42hHzM","title":"Bitcoin Price Distribution Animation (3/22/24 Update)","duration":96},
                {"id":"dT9y-KQbqi4","title":"How I hacked a hardware crypto wallet and recovered $2 million","duration":1938},
                {"id":"sZ7TUop46zU","title":"Bitcoin HODL Waves Animation (10/1/24 Update)","duration":99},
                {"id":"mZ3nXx9V55M","title":"The Next Paradigm in Medicine","duration":501},
                {"id":"7O10xS_sQoE","title":"The Hidden Tax You Pay to Rich People - Julian Figueroa","duration":437},
                {"id":"TFu9_nT_SAI","title":"Bitcoin Never Look Back Price (12/2/25 Update)","duration":109},
                {"id":"ltxmMo7I9Fw","title":"Episode 8: Bitcoin Is Energy Backed Money","duration":338},
                {"id":"4bHAQOevZrI","title":"Bitcoin: Everything a trade","duration":413},
                {"id":"k-58GrK6A8k","title":"Bitcoin Complete Price History (7/17/2010 - 11/12/2023)","duration":11679},
                {"id":"yVs_9zcnHrw","title":"Roger 9000 - SATOSHI SET ME FREE (Clip)","duration":94},
                {"id":"m5wLGRSGi7U","title":"This week in Bitcoin - 10 years of Satoshi (2 November 2018)","duration":4006},
                {"id":"wHQrvCGVkTw","title":"BORDER WALLETS: Storing Bitcoin In Your Brain","duration":1921},
                {"id":"azw7KpdQD0w","title":"Is Bitcoin is the ONLY asset worth buying?","duration":410},
                {"id":"QipRYAxErJ0","title":"BTC Map: Global Bitcoin Merchant Adoption Per 100k Population (12/21/25 Update)","duration":94},
                {"id":"ywka38FnqqY","title":"The Tragic Story of Telling your Friends to Buy Bitcoin (2011-2021)","duration":178},
                {"id":"6kQNGgZ4B6c","title":"Is Bitcoin Halal? [Birmingham, 2022]","duration":229},
                {"id":"5Uh720poZ8w","title":"What is Bitcoin? - Bitcoin 101","duration":157},
                {"id":"KW_wYvZ1eZg","title":"Andreas Antonopoulos: Decentralization & The Future of Money","duration":5024},
                {"id":"lJSPwqOyGYQ","title":"When Everything Else Fails, Bitcoin Stays","duration":72},
                {"id":"w5Tu3eXMDhM","title":"Gershwin-Rhapsody in Blue, Edisher Savitski, Piano","duration":1280},
                {"id":"swVjVfq457k","title":"Simon Dixon's TEDx talk from 2012 with 2020 perspective.","duration":434},
                {"id":"mdOyyipbUIg","title":"Bitcoin vs Real Estate | The Ultimate Wealth Test","duration":511},
                {"id":"smTNsjHoMTA","title":"I Gave Away $600 Of Bitcoin In One Day","duration":53},
                {"id":"r7lm7IHnKDw","title":"The Bitcoin Revolution in Africa: Explained","duration":1014},
                {"id":"D7uSIlNXYag","title":"Total global wealth in terms of bitcoin (7/18/25 update)","duration":107},
                {"id":"KU8rhQoe90M","title":"Joseph Haydn, Sonata in F Major, Hob XVI:23. Edisher Savitski,  Piano","duration":752},
                {"id":"wgMFxpRP70o","title":"Bitcoin as a store of value (11/23/24 Update)","duration":55},
                {"id":"k_F-Qs57B2U","title":"Bitcoin: Daily DCA Cost Basis (4/28/25 Update)","duration":89},
                {"id":"SV-HZftkKXM","title":"Bitcoin’s Blockchain History (Genesis - 923,040)","duration":112},
                {"id":"NvE5uUm6Jzc","title":"Bitcoin Issuance","duration":143},
                {"id":"INLz3aHUKiM","title":"Bitcoin Days Since All Time High Animation (8/24/25 Update)","duration":107},
                {"id":"X7adN61eEjg","title":"Bitcoin and the Kardashev Scale","duration":723},
                {"id":"TTFB50-qTvA","title":"This is why smart money chooses Bitcoin over gold #bitcoin #wealth #shorts","duration":53},
                {"id":"MQvvLwxxxdM","title":"The Banks are BROKE","duration":102},
                {"id":"z8qfz3AcgdU","title":"The three little pigs in crypto (29 December 2020)","duration":706},
                {"id":"-PsbNprqTgI","title":"Bitcoin is not going to go away","duration":255},
                {"id":"l1si5ZWLgy0","title":"Introduction to Bitcoin: what is bitcoin and why does it matter?","duration":2237},
                {"id":"oVKMN7oYSs8","title":"The Next 50 Generations: Bitcoin, Psychedelics, and Human Evolution","duration":697},
                {"id":"ES7f2gBNMe0","title":"When Is the Best Time To Buy Bitcoin?","duration":328},
                {"id":"hc7TNDccwcs","title":"Bitcoin SURGES to 75k! Is RISK ON Regime Back","duration":593},
                {"id":"L-jWILQF5l0","title":"Is Bitcoin Inevitable? The Answer Might surprise you!","duration":414},
                {"id":"qkBrK1Oaqkw","title":"Total global wealth in terms of bitcoin (3/4/24 update)","duration":97},
                {"id":"LKYVbahTjQM","title":"Giving Strangers $50 Bitcoin or $5 Cash (Social Experiment)","duration":440},
                {"id":"55oRomg3D1Y","title":"Revisiting The Patoshi Pattern: The Double Helix","duration":68},
                {"id":"2qjF6A68oi0","title":"Bitcoin 200 Day Moving Average & 200 Week Moving Average (2/17/25 Update)","duration":51},
                {"id":"yb2p0WnP53M","title":"Bitcoin: Days Spent at a Loss Animation (3/3/25 Update)","duration":99},
                {"id":"QK88ICGn1-k","title":"SENDING BITCOIN TO STRANGERS IN 2022 [now worth +$2,000]","duration":442},
                {"id":"yiME-izD-Ss","title":"Lightning Hack Day Istanbul, February 26th 2022","duration":2553},
                {"id":"vclZlAFXpEI","title":"Give Me 9 Minutes and You Will Understand Bitcoin - Exit Manual","duration":599},
                {"id":"AcLjBo6c3j8","title":"Bitcoin Target Hash Animation w/ Tomer Strolight (5/29/24 Update)","duration":205},
                {"id":"H85UfhYV_pA","title":"Smart Money is Selling Real Estate for Bitcoin - Terence Michael","duration":6670},
                {"id":"-RZgq0mtD18","title":"Nick Szabo on Cypherpunks, Money and Bitcoin","duration":5978},
                {"id":"wH6l0D4kopw","title":"Where do I go from here?","duration":278},
                {"id":"EiW4lKrMXQ4","title":"My First Bitcoin Talk on Bitcoin Neutrality From 2013","duration":1822},
                {"id":"glrlipCbb1w","title":"Should You Move To Thailand?","duration":289},
                {"id":"RZZNQGJIC7A","title":"HOW MUCH BITCOIN SHOULD YOU BUY?","duration":873},
                {"id":"o6TH_eZhYuY","title":"Bitcoin: Profit vs Loss Animation (8/20/24 Update)","duration":94},
                {"id":"zKAjd4IGbPQ","title":"Bitcoin HODL Waves Animation (11/9/25 Update)","duration":112},
                {"id":"r34hkJBeE-M","title":"How I Lost 14 Bitcoins - Exit Manual","duration":555},
                {"id":"Sv9VAocAA80","title":"Max Keiser: Bitcoin Will Replace the Dollar","duration":822},
                {"id":"UlKZ83REIkA","title":"Bitcoin for Beginners: Bitcoin Explained in Simple Terms","duration":1792},
                {"id":"ZyC9pAqBkX8","title":"Is the Cycle Going to Break? With Willy Woo","duration":3855},
                {"id":"IAFKJVLNVQA","title":"Wences Casares Explains Bitcoin","duration":845},
                {"id":"y1KXs3uE42I","title":"Andreas Antonopoulos: Why Bitcoin Matters - Internet of Money","duration":1641},
                {"id":"vLTGfSja_Xk","title":"Casually Explained: Bitcoin","duration":638},
                {"id":"qU9oMiq77xw","title":"What's the scarcest thing in the world?","duration":381},
                {"id":"HPkjH3Yeih4","title":"What is the ONE THING Preventing Bitcoin from Reaching $100k?","duration":623},
                {"id":"6W9BH4jsjHM","title":"Teaching In Thailand: Is The Grass Greener?","duration":720},
                {"id":"RFSBWrAllzw","title":"Human B | Die Reise in den Bitcoin-Kaninchenbau (english subtitles)","duration":4428},
                {"id":"zpNlG3VtcBM","title":"Bitcoin - The End of Money As We Know It | Award-Winning | Full Documentary","duration":3604},
                {"id":"EqXouxS5co4","title":"Bitcoin HODL Waves & Price Animation (5/12/25 Update)","duration":108},
                {"id":"Z3RDnL1zN3M","title":"Bitcoin aligns incentives","duration":57},
                {"id":"_13CHbTGu-Q","title":"Tucker Carlson advises us to buy Bitcoin","duration":418},
                {"id":"Hzg5f1U4dkw","title":"14 PEOPLE TURNING DOWN FREE BITCOIN [2022]","duration":700},
                {"id":"zob5dUOAcv0","title":"Bitcoin 1Y, 2Y, 3Y, 4Y Candles Animation (5/18/25 Update)","duration":109},
                {"id":"o5LZML8VaE4","title":"Episode 10 - What happens when Bitcoin wins?","duration":274},
                {"id":"TzjfyHuugUU","title":"The Art of Hodling with American Hodl","duration":47},
                {"id":"03V2j-KUFho","title":"Is Bitcoin Actually Just a Cult? - Get Based TV","duration":1418},
                {"id":"jZ35AD4ebAM","title":"Sold All My Bitcoin And Now I Regret It","duration":37},
                {"id":"_Y6xAwBB5_A","title":"Mastering Crypto Security: Safeguarding Your Digital World Isn't Magic - Jan 2024","duration":71},
                {"id":"vTwkW2KHgB0","title":"Why Bitcoin is an Issue of National Security","duration":442},
                {"id":"W7hHoO0H3F0","title":"This Date Changed Everything for Bitcoin #FinancialFreedom #Satoshi","duration":48},
                {"id":"ip646IX-WrA","title":"HISTORY FOR SLEEP | 💰 From Salt to Bitcoin | Bedtime Stories for Adults | Soft-Spoken","duration":5537},
                {"id":"RKZ0Wc55dFE","title":"Is the four year Bitcoin cycle finally over? #Wealth #Strategy","duration":61},
                {"id":"hRHkmrmrQCA","title":"The History of Money: From Barter to Bitcoin | Relaxing Sleep Story","duration":8505},
                {"id":"ywthH7eyXOI","title":"Bitcoin Days Since All Time High (4/30/25 Update)","duration":104},
                {"id":"-L_RCKJVNXc","title":"F. Schubert, Sonata in B-flat Major, D. 960; Edisher Savitski-Piano","duration":2705},
                {"id":"6Ojh969zABM","title":"The Multipolar World - And What it Means for BITCOIN","duration":458},
                {"id":"BagsxlVsog0","title":"WHY ARE WE BULLISH? Giacomo Zucco, Roman Reher, Ioni Appelberg","duration":7230},
                {"id":"3B6asZvHoSA","title":"7. Is Bitcoin Too Expensive?","duration":367},
                {"id":"9iGFXqhNRAM","title":"Bitcoin’s Cycle Fakeout: Why This Bottom Isn’t 2022 and What Comes Next","duration":278},
                {"id":"MXGHLlFQfY8","title":"L. Van Beethoven, Sonata Op. 26 in A-flat Major. Edisher Savitski, Piano","duration":1126},
                {"id":"Xd2T6I_fuRU","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (3/7/24 Update)","duration":76},
                {"id":"nEfUJtpZc_o","title":"Bitcoin Can be used for good or ill","duration":31},
                {"id":"rJlgpOQp7Ig","title":"Orange Pill [OP26] - Monetizing Dissent","duration":5058},
                {"id":"K33t8HmWipQ","title":"Bitcoin Just Hit Its 200th Daily Close Above $100k","duration":107},
                {"id":"JIxwTx7o_B4","title":"Bitcoin 101 | Balaji Srinivasan","duration":1681},
                {"id":"4YC4vhCHNyE","title":"Bitcoin 1-Month Candles Animation (10/21/23 Update)","duration":165},
                {"id":"Anu0kDFTQvc","title":"Why Bitcoin Will Become the Next Global Reserve Asset","duration":360},
                {"id":"AYtNBHAdP0c","title":"C. Franck, Piano Quintet in F minor","duration":2016},
                {"id":"Nst2MCLBSZQ","title":"ReMastering - Bitcoin & the Elements of Trust: how do chemistry, cooking, & lego relate to bitcoin?","duration":1156},
                {"id":"6tEruQ1sl_c","title":"Why Can't we Just Save Money? Why Are We Forced to Invest?","duration":334},
                {"id":"Bhe61JaNFLU","title":"Bitcoin 101 - What is Bitcoin?","duration":1353},
                {"id":"LxkCOjgbSpo","title":"Saying No To Free Bitcoin #1","duration":28},
                {"id":"t427XrY6ofw","title":"The Surprising Sound of Silence, A Blast from the Past! (1 min video)","duration":66},
                {"id":"Rnw6aJM1ni8","title":"BTC Map: U.S. Bitcoin Merchant Adoption (12/16/25 Update)","duration":84},
                {"id":"k7baducIk-Y","title":"Bitcoin Historical Block Sizes (2/8/25 Update)","duration":53},
                {"id":"Wvz86FGjSfo","title":"READY!!! BITCOIN TARGET $450.000 ACCORDING TO THIS AMAZING CHART!!! HODL ADA and SOL or SELL??","duration":879},
                {"id":"O-P0ExXK7bY","title":"Bitcoin as a store of value (4/30/24 Update)","duration":51},
                {"id":"Cj9sWNgx9KU","title":"One bitcoin is all you need","duration":97},
                {"id":"0izbzc44Qcs","title":"Bitcoin Stock2FOMO Model (11/13/24 Update)","duration":79},
                {"id":"IAfpjwzvUks","title":"Episode 3. Can you increase Bitcoin's Supply?","duration":333},
                {"id":"ONfuVlCGQNA","title":"The world's most expensive clock","duration":429},
                {"id":"0qx6qVxN5EQ","title":"Ansel Lindner - The History of Money","duration":685},
                {"id":"N5aAkIo-93Q","title":"Crypto Street Interviews: Las Vegas Episode 1","duration":996},
                {"id":"PXuCH89Arv4","title":"HCPP22 | Janine - Blockchain Surveillance, Cyber Mercenaries, and Intelligence","duration":2787},
                {"id":"xyxRCwJVBUc","title":"Bitcoin Expert Breaks Down Historic RFK Jr. Speech - Get Based TV","duration":1149},
                {"id":"GSwW5yCse1s","title":"Edisher Savitski-Chopin Sonata #3 in B Minor, Op. 58","duration":1846},
                {"id":"jx37_PTwybs","title":"\\\"We're gettin' the bitcoin boyz!\\\"","duration":30},
                {"id":"7vl_ziH6OJo","title":"Bitcoin's price curve will not be S-shaped","duration":242},
                {"id":"8aOJxfJ-SNE","title":"Bitcoin Price Distribution Animation (1/8/26 Update)","duration":109},
                {"id":"pSTNhBlfV_s","title":"Watch Crypto expert explain the Blockchain to Congress","duration":356},
                {"id":"LmUA_rWN4JQ","title":"Bitcoin Days Since All Time High (9/5/24 Update)","duration":99},
                {"id":"leqjwiQidlk","title":"Milton Friedman Predicts Bitcoin In 1999","duration":268},
                {"id":"fvIVw0KF3NM","title":"Former Free State Project Prez calls for a Free Ross Movement","duration":603},
                {"id":"ZwFEKGa64KM","title":"Episode 4 - Can Governments Ban Bitcoin","duration":412},
                {"id":"4ufIptJY5Ss","title":"Visiting The Hottest Country On Earth 🔥 Kuwait Vlog 🇰🇼","duration":3617},
                {"id":"jk1XrmiNgr4","title":"CASH OR BITCOIN? Offering People £20 Cash or 0.002 BTC [2022]","duration":601},
                {"id":"HCRr9VkLA1A","title":"Spanish Tourist Gets 200,000 SATS (0.002 BTC)! #bitcoin #dublin #interview","duration":44},
                {"id":"kd8ReEcAi0A","title":"How War Broke the Gold Standard","duration":111},
                {"id":"aNEaBzrcs1o","title":"Episode 9 -  How Bitcoin Empowers You","duration":257},
                {"id":"JjnaYQIUZLw","title":"Why Stablecoins Supercharge Bitcoin Adoption","duration":470},
                {"id":"L5Lb1prBbHI","title":"Bitcoin will outlive the Pyramids","duration":445},
                {"id":"P88istScPxM","title":"Bitcoin Daily DCA & HODL Animation (2/13/24 Update)","duration":81},
                {"id":"ax8L8FezwGg","title":"Bitcoin Bear Market Street Interviews [London, July 2022]","duration":595},
                {"id":"bohI45qhHA0","title":"Bitcoin is Rational Optimism, Altcoins are Nihilism - American Hodl","duration":140},
                {"id":"sLcNmZwMOz0","title":"Drunk People React To Bitcoin - Street Interviews!","duration":610},
                {"id":"oMTg9yGQVOg","title":"Why don't I talk to women? When will I return to Kuwait? Who is my role model? [Mike Still Q&A 2024]","duration":1636},
                {"id":"lBnOgWbo-0A","title":"Bitcoin: Profit vs Loss Animation (1/9/24 Update)","duration":90},
                {"id":"0mE0fNMUotc","title":"Quantum vs. Bitcoin: Hype, Secrecy, and the Case for Quantum-Resistant Insurance","duration":272},
                {"id":"7ro85G6kclk","title":"Bedtime Finance: The Story of Bitcoin and Cryptocurrency","duration":8405},
                {"id":"bBC-nXj3Ng4","title":"But how does bitcoin actually work?","duration":1516},
                {"id":"rc744Z9IjhY","title":"Andreas Antonopoulos: The Internet of Money - What is Bitcoin?","duration":1099},
                {"id":"_J_6ux6_Iy8","title":"Get started with bitcoin - Matt Odell","duration":41},
                {"id":"nsAGFlrRDV8","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (3/23/25 Update)","duration":83},
                {"id":"poa6kNXEJxw","title":"Watch this before the bitcoin revolution","duration":486},
                {"id":"Y1FGz6rJR6A","title":"Is this one of the most IMPORTANT moments in Bitcoin History???","duration":847},
                {"id":"jdZXDSfRXFw","title":"Why Make Bitcoin Videos?","duration":417},
                {"id":"xUNGFZDO8mM","title":"Andreas M. Antonopoulos educates Senate of Canada about Bitcoin  (Oct 8, ENG)","duration":6767},
                {"id":"rOyCFVmAEQQ","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (6/23/24 Update)","duration":81},
                {"id":"QgapLaLlWac","title":"Sidechain RSK - Convidada Solange Gueiros","duration":4635},
                {"id":"BYHSrzTfeMY","title":"BITCOIN IS GOING TO A MILLION DOLLARS [here's why...]","duration":412},
                {"id":"68jc2KVnLmg","title":"Bitcoin Stock2FOMO Model","duration":49},
                {"id":"_oHkdEQ9AaI","title":"Is discipline really important?","duration":195},
                {"id":"CqNEQS80-h4","title":"#Bitcoin #MCC2019 Luke Dashjr \\\"Briefly, Why Block Sizes Shouldn't Be Too Big\\\"","duration":1100},
                {"id":"zdJiltpWi3A","title":"The 3 Biggest Bitcoin Myths (Stop Believing Them) - Get Based TV","duration":827},
                {"id":"qj0IGSc0sew","title":"Your 60/40 Portfolio Failed When You Needed It Most","duration":1034},
                {"id":"SZ4W07fv-0A","title":"Episode 5 - Why Is Bitcoin Different From Crypto?","duration":381},
                {"id":"VKCVJFzGXLc","title":"How the Petrodollar Took Over the World","duration":60},
                {"id":"rCfAjgBhp5k","title":"Why Game Theory means Bitcoin wins!","duration":340},
                {"id":"Zz961ZSFgw8","title":"Twitter Integrates Bitcoin with Jack Mallers","duration":3300},
                {"id":"HT9x5oU6yYo","title":"Bitcoin On-Chain and Cycle Analysis: The Rational Root","duration":1417},
                {"id":"ztTICG37kxA","title":"I Asked Strangers About Bitcoin... It Got Awkward","duration":403},
                {"id":"iXxeIahvAOQ","title":"Building a Bitcoin World - Interview with BTC Sessions - Get Based TV","duration":5049},
                {"id":"sZvhLDWjD_I","title":"How Bitcoin Fixes Broken Money | Welcome to Bitcoin | Introductory Course (Unit 1)","duration":896},
                {"id":"yQr5rJ3CEIc","title":"People Thought Bitcoin Was Expensive In 2021","duration":320},
                {"id":"LgI0liAee4s","title":"Escaping the Global Banking Cartel - Bitcoin as an Exit","duration":2213},
                {"id":"gi7w4Xzvpt8","title":"M. Mussorgsky \\\"Pictures at an Exhibition\\\". Edisher Savitski, Piano","duration":1976},
                {"id":"8b4kOK_aKuw","title":"Speaking Arabic With The Locals In Kuwait","duration":1507},
                {"id":"TbP8E0jwQJY","title":"Quantum Breaks Bitcoin? \\\"Never Going to Happen\\\"","duration":38},
                {"id":"HD6vcASMA8o","title":"Bitcoin Target & Block Hashes Animation (5/23/25 Update)","duration":108},
                {"id":"QmfTqIbEBmk","title":"Global Debt is COLLIDING with AI deflation, and it's going to get UGLY","duration":537},
                {"id":"QeLuOC9NjlE","title":"Cash Or Bitcoin? [2022]","duration":57},
                {"id":"v-fPWB9r9gk","title":"Revisiting The Patoshi Pattern","duration":1217},
                {"id":"hL-pFg3vZds","title":"Bitcoin Target & Block Hashes Animation (3/4/26 Update)","duration":116},
                {"id":"ru8UaqxXwiY","title":"Why Bitcoin is the Future of Money","duration":765},
                {"id":"sMoqtZZ-tiM","title":"Bitcoin + Islam: a conversation with 'Muslim Bitcoiner'","duration":3100},
                {"id":"R2Ohxdwtp80","title":"Bitcoin and Banks - Breaking Bitcoin 2017 Paris","duration":1789},
                {"id":"EH6vE97qIP4","title":"1. Introduction for 15.S12 Blockchain and Money, Fall 2018","duration":3724},
                {"id":"Pc_C-xI3b88","title":"Bitcoin vs Gold [are you ready?]","duration":57},
                {"id":"mUY_5ysXYOs","title":"The Genie, Bitcoin, and the Financial Dark Ages","duration":484},
                {"id":"9cPa4EgHDuc","title":"Massive amount of credit destruction incoming #crypto #bitcoin #wealth","duration":80},
                {"id":"QYKduDat0IY","title":"Bitcoin vs Central Banks: The Monetary Cold War Accelerates","duration":1007},
                {"id":"caPiK1H7xDM","title":"Bitcoin: Epoch-Over-Epoch Growth Animation (1/28/25 Update)","duration":82},
                {"id":"Ub5QwtzwzgY","title":"Visiting The Avenues Mall [Kuwait Vlog]","duration":1619},
                {"id":"_91klH3VsfE","title":"Bitcoin: Compound Annual Growth Rate (CAGR) Animation (4/26/24 Update)","duration":71},
                {"id":"lrSWrVSkT1U","title":"Bitcoin In 60 Seconds","duration":75},
                {"id":"iEzOIb8oCPc","title":"Bitcoin Supply Distribution & Age by Realized Price (4/18/25 Update)","duration":203},
                {"id":"Vp_-3Z8luTQ","title":"Bitcoin breaks ONE MILLION Swedish kronor","duration":369},
                {"id":"JHJhYE-3Azk","title":"Man who threw away 8,000 BITCOIN (!) is on BBC Radio 2","duration":891},
                {"id":"_m7KggCKicU","title":"4 - Bitcoin Is Actually LIFE ENERGY!","duration":155},
                {"id":"xB5Xr-2SIpA","title":"BITCOIN HAS FAILED","duration":926},
                {"id":"dcyCOre17Bc","title":"BITCOIN BULL RUN 2025. WATCH THIS.","duration":485},
                {"id":"W3xniwhdpTk","title":"BTC Map: Latin America Bitcoin Merchant Adoption Per 100k Population (12/27/25 Update)","duration":85},
                {"id":"fw3WkySh_Ho","title":"Consensus Algorithms, Blockchain Technology and Bitcoin UCL - by Andreas M. Antonopoulos","duration":5062},
                {"id":"7ZCfDHwtUuo","title":"Bitcoin: The Separation of Money and State","duration":392},
                {"id":"licq7RxaCVE","title":"People Making Bitcoin Price Predictions in 2022","duration":432},
                {"id":"7uWMertPuGQ","title":"Top 10 Cryptocurrencies By Market Cap & Bitcoin Dominance (3/8/25 Update)","duration":149},
                {"id":"GgFQgfssHBo","title":"Bitcoin Cultures - Unconfiscatale 2022","duration":4243},
                {"id":"Znzm-WJ0c2U","title":"Revolutionary Tech Rides on Historic Infrastructure -  Bitcoin and Horses? (short)","duration":85},
                {"id":"9y6glDnsH04","title":"3. Bitcoin's Environmental Impact","duration":319},
                {"id":"6fu-w7gvPpk","title":"YOU ARE NOT PREPARED!!","duration":498},
                {"id":"heA1fZzRAFs","title":"Orange Pill: The Bitcoin Guide","duration":2625},
                {"id":"IuVkUqdqkcc","title":"Buy Bitcoin When It Looks Like This - Exit Manual","duration":654},
                {"id":"xegEpCLT0CQ","title":"A Practical Approach to Orange Pilling","duration":1060},
                {"id":"jST-ZSwVEfw","title":"Giving Out Bitcoin To Strangers","duration":45},
                {"id":"IkoxrYcwEAI","title":"How Governments Change Money During War","duration":90},
                {"id":"32SZtxE0sWQ","title":"Coinkite BLOCKCLOCK Comparison - mini vs. micro","duration":422},
                {"id":"OWxhobO1YnQ","title":"Small Moves, Massive Damage Due to Leverage #bitcoin #economy #finance","duration":44},
                {"id":"oCNVi3J9qjM","title":"CASH OR BITCOIN? Asking People In The Streets [2022]","duration":485},
                {"id":"y6egEeOSgjI","title":"Bitcoin Q&A: Is Bitcoin a Good Investment?","duration":174},
                {"id":"bsOUzoC0jdg","title":"AI Will Copy Everything Digital - EXCEPT BITCOIN.","duration":377},
                {"id":"i9nUMvpT2rM","title":"Blockchain for Beginners","duration":1339},
                {"id":"2_Hfmm7R_IE","title":"L. van Beethoven, Piano Concerto #5, Op. 73","duration":2419},
                {"id":"gIVp2Pxy_fg","title":"Does Bitcoin Become More Decentralized Over Time?","duration":57},
                {"id":"Mvchzpbv2hE","title":"Bitcoin's REAL effect on the environment","duration":421},
                {"id":"SGb7QMZwJd8","title":"11. Bitcoin Fundamentals Explained Simply!","duration":603},
                {"id":"exK5yFEuBsk","title":"Remember, Remember the 5th of November - Bitcoin","duration":127},
                {"id":"3QH7ZTibV-Q","title":"How to Buy Bitcoin (in 2 minutes) - 2024 Updated","duration":161},
                {"id":"thjyTyyRlyU","title":"Inside A Kuwaiti Diwaniya [Kuwait Vlog]","duration":647},
                {"id":"So6g2yq_978","title":"Baltic Honeybadger (2017)","duration":6133},
                {"id":"PBsmDwZFR6c","title":"We've officially mined 93% of all the bitcoin","duration":94},
                {"id":"s-kKDR30Fb8","title":"Bitcoin is like real estate in Manhattan","duration":241},
                {"id":"_rAIa-f_xao","title":"Random Guy Gets Free Bitcoin","duration":40},
                {"id":"tLHn38mDXW8","title":"Bitcoin Target Hash Animation (3/7/25 Update)","duration":107},
                {"id":"arkn9rqczJ8","title":"I Asked Bitcoin Billionaires For Crypto Advice","duration":501},
                {"id":"bF5SMoqJEJQ","title":"Tariffs Explained In 60 Seconds","duration":73},
                {"id":"eZbl-vVvvTo","title":"Chatting With Arabs [Middle East Vlog]","duration":1630},
                {"id":"2-fEEC9_YT8","title":"BTC Map: Global Bitcoin Merchant Adoption (12/14/25 Update)","duration":194},
                {"id":"oq3nPlEeWFc","title":"GENIUS Investor Said This About Crypto...","duration":813},
                {"id":"fetDXOjZ5Q4","title":"The Global Order Is Collapsing. What does this mean for Bitcoin?","duration":430},
                {"id":"ZMmq4zYUviY","title":"Bitcoin HODL Waves Animation (5/9/25 Update)","duration":108},
                {"id":"A7b5FRQejqo","title":"Johannes Brahms, Ballades 3 & 4, Op. 10","duration":826},
                {"id":"xXUIIlVSJ3g","title":"Why Does Bitcoin Scale In Layers? | E96","duration":464},
                {"id":"Vfq7LNDCdNQ","title":"Andreas Antonopoulos explaining Bitcoin and money 🎙It is one of the best speeches you will ever hear","duration":1499},
                {"id":"GZokpamL-84","title":"AI, Energy, Bitcoin: The Foundation of the Future","duration":365},
                {"id":"8HaVTfzFFG0","title":"Bitcoin is Going Up Forever  #bitcoin101","duration":74},
                {"id":"IOzCrgCDSy8","title":"4. Is Bitcoin Just for Criminals?","duration":182},
                {"id":"TIkqBZnrKJM","title":"EVERYTHING will fail. Except...","duration":465},
                {"id":"qlU_6USlQEU","title":"Shitcoin Apologism Steelmanned & Bitcoin Scaling Panel with Adam Back at Baltic Honeybadger 2019","duration":2422},
                {"id":"djw0zYXyAlo","title":"Percent of the Network  #bitcoin","duration":89}
            ]
        },
        {
            "id": "conferences-events",
            "name": "Conferences & Events",
            "emoji": "🎤",
            "desc": "Bitcoin conference speeches & keynotes",
            "color": "#6366f1",
            "videos": [
                {"id":"3e3KE40r_WM","title":"The Bitcoin Conference 2025 - Day 1 Full Livestream","duration":33012},
                {"id":"hzcmndorLwQ","title":"Saylor: Bitcoin + Digital Credit = The Future of Money (Full Keynote)","duration":2225},
                {"id":"wAv0T2nX0v0","title":"Strategy CEO Phong Le: MIT Bitcoin Expo 2025 Keynote","duration":1474},
                {"id":"RoRZE2DpEzE","title":"Jack Mallers: The HODLers Dilemma - Bitcoin 2025 Keynote","duration":2099},
                {"id":"BtbUGFHZTW8","title":"Federated Chaumian Mints Overview - Bitcoin 2022 Conference","duration":830},
                {"id":"HVKq5qfZSqU","title":"FractalEncrypt Bitcoin Full Node Book & Canvas - Bitcoin 2022 Conference","duration":48},
                {"id":"SFUiGTayVL8","title":"Saifedean: Bitcoin & Tether - Drinking the Dollar Milkshake","duration":858},
                {"id":"Hp-HlJ0PbpI","title":"Bitcoin Thailand 2024 - Day 1","duration":33617},
                {"id":"occ9L0dMMO4","title":"Bitcoin 2024 Art Exhibit - Bitcoin Bob","duration":543},
                {"id":"M-PIOaHxX4c","title":"BitVM Creator Robin Linus: This Breakthrough Will Revolutionize Bitcoin - MIT Bitcoin Expo 2025","duration":1032},
                {"id":"dWaHWT15sOQ","title":"Paolo Ardoino: Why Tether Loves Bitcoin - Bitcoin 2025","duration":1030},
                {"id":"SVJCpnSANG4","title":"Building Bitcoin Insurance for Financial Institutions (Anchorwatch) - MIT Bitcoin Expo 2025","duration":1001},
                {"id":"4S6lzgc7tFc","title":"Bitcoin Beyond Capital: Freedom Money for the Global South (Femi Longe) - MIT Bitcoin Expo 2025","duration":1618},
                {"id":"cOmUpp3J9Ck","title":"Living on Bitcoin 2020 -- what it's REALLY like!","duration":1021},
                {"id":"gn5sQC19rvM","title":"MIT Digital Currency Initiative & Future of Bitcoin Research (Neha Nerula) - MIT Bitcoin Expo 2025","duration":1327},
                {"id":"75O56lhJMJI","title":"Welcome to Bitcoin Country - Adopting BTC 2024","duration":808},
                {"id":"fePW13cq4eM","title":"Wartime Bitcoin - Bitcoin 2022 Conference","duration":1520},
                {"id":"W8mpzwCf8SE","title":"Bitcoin 2021: How To Value Bitcoin","duration":748},
                {"id":"f3NBhSXtE5g","title":"Edward Snowden 2024 Keynote - Privacy","duration":1840},
                {"id":"OwJL0J_nPDE","title":"Open Source Stage - Bitcoin 2022 Conference Day 3 (Full)","duration":16733},
                {"id":"rNok4Ht6n1E","title":"Bitcoin, Not Crypto: Why Bitcoin-Only VC Will Win (Nico Lechuga) - MIT Bitcoin Expo 2025","duration":800},
                {"id":"ng3dRbm2PHs","title":"Funding Bitcoin Open Source - Bitcoin 2022 Conference","duration":1621},
                {"id":"IjR3Hj0aRW4","title":"Howard Lutnick 2024 Keynote - Nashville","duration":1250},
                {"id":"6xIq0FdmsIA","title":"Andreas Antonopoulos: Internet of Money - Keynote","duration":2359},
                {"id":"--IFcOIEfl4","title":"No Second Best - Jack Mallers Prague 2024","duration":2632},
                {"id":"n3Md7m4UQSQ","title":"Preventing Attacks On Bitcoin - Open Source Stage (Bitcoin 2022)","duration":1502},
                {"id":"YQrfB9327jI","title":"Bitcoin Amsterdam 2025 - Day 1 Livestream","duration":30967},
                {"id":"MZEO1-XVaWM","title":"Bitcoin Is an Exit Strategy (Not Crypto) | Keynote","duration":1164},
                {"id":"bLEv8FcfxfE","title":"Why Bitcoin-Backed Lending Will Eat the World (Mauricio di Bartolomeo) - MIT Bitcoin Expo 2025","duration":875},
                {"id":"j7R6CLnWI4M","title":"Open Source Stage - Bitcoin 2022 Conference Day 1 (Full)","duration":18352},
                {"id":"Ps3BU0edwqE","title":"Adopting Bitcoin 2024 - Day 2 Livestream","duration":27456},
                {"id":"P1n7XipTCck","title":"Bitcoin 2024 Nashville: Full GA Day 2 Livestream","duration":35273},
                {"id":"9UxAUryUKXM","title":"Donald Trump 2024 Keynote - Nashville","duration":2979},
                {"id":"tO1QTCLrbB8","title":"Matt Odell: Bitcoin-Native Venture Capital - MIT Bitcoin Expo 2025","duration":1724},
                {"id":"9e5JejAWrwY","title":"The Bitcoin Conference 2025 - Day 1 Main Stage","duration":42898},
                {"id":"TTHU_N_n5Ks","title":"PlanB Forum Lugano 2024 - Stephan Livera","duration":2854},
                {"id":"0XnB_ZqL6fo","title":"Freedom Festival 2024 - Mass Adoption","duration":41},
                {"id":"6fgFyQEWiK4","title":"Saifedean Ammous: How Bitcoin Could End Wars - Amsterdam 2025","duration":1692},
                {"id":"M2zGs2E-pfs","title":"The Future of Corporate Bitcoin Adoption - MIT Bitcoin Expo 2025","duration":2437},
                {"id":"XT-B9k9t5B8","title":"LIVE: The MIT Bitcoin Expo 2025 - Day 2 Full Stream","duration":30819},
                {"id":"gu9OulAijy4","title":"The Pacific Bitcoin Conference","duration":840},
                {"id":"rSSnyJpFNZU","title":"Bitcoin 2021: Banking The Unbanked | Jack Dorsey & Alex Gladstein","duration":1821},
                {"id":"xCyPbFx0Ktg","title":"Why Bitcoin Must Change - Or Be Left Behind (Jameson Lopp) - MIT Bitcoin Expo 2025","duration":1439},
                {"id":"pt-Wv-M5uNA","title":"Bitcoin MENA 2025 - Day 1 Livestream","duration":34980},
                {"id":"z9Li4I2onqk","title":"Sparrow Desktop Workshop - Bitcoin 2023","duration":1647},
                {"id":"2qiJIFBJPIU","title":"The Bitcoin Conference 2025 - Day 3 Livestream","duration":36592},
                {"id":"L0Yh6VP6vxU","title":"Open Source Stage - Bitcoin 2022 Conference Day 2 (Full)","duration":16817},
                {"id":"LsLKr_dWdpU","title":"The Eric Semler Interview - MIT Bitcoin Expo 2025","duration":704},
                {"id":"IXKLholMqwE","title":"Former CFTC Chairman Tim Massad: Bitcoin & Digital Identity - MIT Bitcoin Expo 2025","duration":424},
                {"id":"VKC0__vEbc8","title":"The Future of Corporate Bitcoin Adoption | MIT Bitcoin Expo 2025","duration":2437},
                {"id":"kE3TpVS27os","title":"JD Vance Keynote - Bitcoin 2025 Las Vegas","duration":42897},
                {"id":"jc4lkDeozCQ","title":"Eric Trump speaks at Bitcoin Asia 2024","duration":2448},
                {"id":"e_yg6cLsQHE","title":"Bitcoin Address Poisoning Attacks (Jameson Lopp) - MIT Bitcoin Expo 2025","duration":1548},
                {"id":"-NlgxiLgqZo","title":"Why Nostr Feels Like Bitcoin in 2012 (Vitor Pamplona) - MIT Bitcoin Expo 2025","duration":957},
                {"id":"R_KTRRlZ-7c","title":"Web5 Open to Build - Bitcoin 2023","duration":1071},
                {"id":"p6kBKSZqjn4","title":"Bitcoin Conference 2025: Opening Day Marathon","duration":3916},
                {"id":"M6LhYlKOrVI","title":"Web5: Explained by Daniel Buchner (Block) - Bitcoin 2023 Conference in Miami","duration":798},
                {"id":"veIuDwQTunw","title":"Olaoluwa Osuntokun Keynote - Open Source Stage (Bitcoin 2022)","duration":1064},
                {"id":"DortAVYgd4Y","title":"Why Bitcoin 2026 Could Be the Most Important Conference Yet","duration":1652},
                {"id":"R4gyS5mb9dE","title":"Alex Gladstein: Dictators Should Be Afraid - Policy Summit 2025","duration":1160},
                {"id":"Nqt3BClxlpk","title":"Strategy CEO Phong Le: MIT Bitcoin Expo 2025 Keynote Speech","duration":1474},
                {"id":"XVGME04z_3k","title":"Bitcoin Amsterdam 2025 - Day 2 Livestream","duration":28161},
                {"id":"pZvy0JRz9GE","title":"Saifedean: Bitcoin & Tether - Las Vegas Keynote","duration":2576},
                {"id":"sNE-2ffq5MA","title":"Fighting for Freedom Under Zimbabwe's Hyperinflation (Evan Mawarire) - MIT Bitcoin Expo 2025","duration":1629},
                {"id":"4NoJnPmCVdU","title":"Solving Bitcoin's Quantum Computing Threat: BIP 360 (Hunter Beast) - MIT Bitcoin Expo 2025","duration":1004},
                {"id":"pDA2r4AblD0","title":"How To Orange Pill Anyone - BitBlockBoom","duration":2119},
                {"id":"eRgHb8BGs18","title":"Adopting Bitcoin 2024 - Day 1 Livestream","duration":32400},
                {"id":"vRuPeBAjLTI","title":"JIMMY SONG | DESTROYING RENT SEEKING","duration":1949},
                {"id":"r8rQUEyAksg","title":"BITCOIN DAY 2024","duration":30696},
                {"id":"3FW7jNB9Qp0","title":"The Future of Lightning Development - Open Source Stage (Bitcoin 2022)","duration":1790},
                {"id":"HGyiOlXg-XY","title":"Top 10 Most Iconic Bitcoin Conference Moments","duration":303},
                {"id":"NKl-c-TS3yM","title":"Covenants - Open Source Stage (Bitcoin 2022)","duration":2373}
            ]
        },
        {
            "id": "culture-travel",
            "name": "Culture, Travel & Adoption",
            "emoji": "🌍",
            "desc": "Bitcoin culture worldwide & global adoption",
            "color": "#f97316",
            "videos": [
                {"id":"pLIxmIMHL44","title":"Bitcoin Nation State Adoption Paradox - A Trojan Horse w/ Alex Gladstein (BTC231)","duration":3792},
                {"id":"dYFMoK1nDmc","title":"60 Minutes: Bitcoin Beach El Salvador - CBS","duration":65},
                {"id":"0hwC6BKJMpc","title":"How Bitcoin is Revolutionizing Travel","duration":592},
                {"id":"KcV9Dhz9gHY","title":"Rebuilding El Salvador's Cattle Industry with Tom Taber","duration":2954},
                {"id":"TauW_pLnstw","title":"The Bitcoin Paradise You Have Never Heard Of - Joe Nakamoto","duration":1274},
                {"id":"pxvDunp9820","title":"Bitcoin in Peru: How a Poisoned Town Survives - Joe Nakamoto","duration":666},
                {"id":"UPp0Xbk4bFo","title":"The Truth Behind Cuba's Bitcoin Revolution (Joe Nakamoto)","duration":1602},
                {"id":"BGSnKYEd0l4","title":"Bitcoin Gibt Frauen Ihr Recht Auf Eigentum","duration":59},
                {"id":"3R9Ap6vhwO0","title":"Paying for Steak in El Salvador with Bitcoin—It's Devastatingly Simple with the Blockstream App","duration":26},
                {"id":"dKld7vP7jz0","title":"041 - Niko Laamanen: Leaderless Organisations, Moving to Madeira & Bitcoin Adoption","duration":4900},
                {"id":"7A56oZAs7ZQ","title":"El Salvador Bitcoin Adoption Documentary","duration":1067},
                {"id":"eO5_xYBXiVk","title":"Knots (BIP110) Debate from Plan ₿ Forum El Salvador 2026 – Luke, Mechanic, Bier, Tone, Giacomo","duration":2870},
                {"id":"r7Mn07CIJVk","title":"#092 Andreas M. Antonopoulos: Bitcoin Outlook 2021","duration":3263},
                {"id":"X0UVXuVbGYA","title":"Phil Gibson | The Social Schelling Point of Bitcoin #18","duration":4949},
                {"id":"_ToVLRneMS0","title":"MASSIVE BITCOIN ADOPTION in Nigeria, People Reject CBDC | EP 613","duration":3817},
                {"id":"R8xZd8v7b50","title":"Bitcoin Beach: El Salvador's Bitcoin Economy","duration":1349},
                {"id":"koshi4yTzQo","title":"\\\"I Don't Depend on Anyone Anymore\\\" - Bitcoin in Mozambique","duration":1083},
                {"id":"XCIth8DRuL8","title":"Toxic Happy Hour #52 - 6 Toxic Ladies Talk Bitcoin w/Pubby and Danish","duration":10768},
                {"id":"etury0dNkIU","title":"Stephen Dodge: Are high bitcoin transaction fees secretly killing Bitcoin forever for average pleb?","duration":3938},
                {"id":"KmQ0ft3Gr-8","title":"Lina Seiche: Reality of Life in El Salvador, Nayib Bukele, Safety, Bitcoin, Business & Why Move Here","duration":3375},
                {"id":"twjTUa8njRo","title":"Run with Bitcoin - Paco De La India","duration":76},
                {"id":"hwchWBR451A","title":"Sovereign Individuals Spend & Replace Bitcoin with André Loja | SLP695","duration":3692},
                {"id":"zgk-1pSMsZA","title":"WTF the IMF, Tether and Bitcoin in El Salvador - Mike Peterson (Joe Nakamoto #13)","duration":6248},
                {"id":"emS6_vlQKa4","title":"Everyday Bitcoin #3 - Isa Santos (BTC Isla, Get Based)","duration":2654},
                {"id":"Y7kwFxDNcek","title":"Living on bitcoin in El Salvador","duration":912},
                {"id":"eQRUoMFFjsU","title":"The Bitcoin Cheat Code | Mark Moss","duration":4387},
                {"id":"WoN0SVY73zo","title":"You Can Live on Bitcoin in Lugano - Joe Nakamoto","duration":1018},
                {"id":"kKSFh5Xxe3w","title":"48 Hours in El Salvador Paying Only With Bitcoin","duration":1272},
                {"id":"FLmW_czpXXg","title":"BITCOIN: A TROJAN HORSE FOR FREEDOM w/ Alex Gladstein","duration":5717},
                {"id":"d5RiLf9LdSo","title":"Simply Bitcoin Interview by Nico Moran at Plan B El Salvador 2026","duration":1798},
                {"id":"u5EQ92mNK5U","title":"🌀 The Age of Truth: Bitcoin, Nihilism & The End of Fiat Delusions | High Hash Rate Podcast","duration":3976},
                {"id":"k-lnRLOY43o","title":"Eric Weiss: The Future of Crypto, Institutions vs Plebs and the Threats to Bitcoin","duration":4305},
                {"id":"A2FMkHpO-eY","title":"Building a Bitcoin Citadel Mindset , with Brad Mills | Relai Bitcoin Podcast #114","duration":3607},
                {"id":"mkDpE6SjjCQ","title":"Did the IMF Just KILL Bitcoin in El Salvador? (Joe Nakamoto)","duration":913},
                {"id":"zh1MFyLNjrk","title":"Easy In. Impossible Out. | The Convenience Trap","duration":133},
                {"id":"BnR_kB44hy0","title":"Bitcoin Berlín: The Secret Bitcoin City of El Salvador - Joe Nakamoto","duration":691},
                {"id":"mxfD7Pef4iU","title":"Building a Bitcoin Circular Economy: The BTC Isla Story","duration":4383},
                {"id":"4W4QeJ_djos","title":"Bitcoin is Freedom Money with Anita Posch","duration":3169},
                {"id":"7d7yJktKr2U","title":"Is El Salvador Bending the Knee to the IMF? - John Dennehy (Joe Nakamoto #15)","duration":3454},
                {"id":"qnMDb2MZo9g","title":"Will Bitcoin Become The Only Reserve Asset? Bitcoin vs the State","duration":146},
                {"id":"mmOrwgouveI","title":"The Secret Bitcoin City of El Salvador - Interview with Founders (Joe Nakamoto)","duration":4516},
                {"id":"gCi5jPHWVNE","title":"Run with Bitcoin | Paco De la India Mumbai","duration":1759},
                {"id":"IRnygiyuG0k","title":"Twitter Spaces: LIVE from El Salvador Congress - La Bitcoinizacion","duration":4605},
                {"id":"2iHqeCy16os","title":"How to build your own Bitcoin Citadel","duration":5299},
                {"id":"LRSQSkiil0M","title":"Inside the Bitcoin Revolution in Africa - Joe Nakamoto","duration":1068},
                {"id":"qoGuqqrXowY","title":"André Loja on Bringing Bitcoin to Madeira","duration":3404},
                {"id":"PHYCAE2n55M","title":"Isabella Santos on Bitcoin Media, Freedom & Building a Circular Economy","duration":2271},
                {"id":"QV-m5lNLxeM","title":"Interview with Julian Figueroa From Get Based (Joe Nakamoto)","duration":4741},
                {"id":"0xcYAr-UtZk","title":"#26 Anita Posch - Bitcoin Education in Africa","duration":3331},
                {"id":"eNOYnGtIm9E","title":"Paco de la India | My Latin Life Podcast 210","duration":3489},
                {"id":"DfDWubdqU5I","title":"I Begged Strangers for Bitcoin in Madeira - Joe Nakamoto","duration":833},
                {"id":"ubHCMpo_Iek","title":"nrc28 | Can the Próspera + Bitcoin model save Honduras? Zussel Abigail Ramos thinks so.","duration":3240},
                {"id":"rudY3-9X7gU","title":"I'm Back From El Salvador (Joe Nakamoto)","duration":543},
                {"id":"e0EPQg20SaQ","title":"What 1792 Days in Bitcoin Taught Me - Get Based TV","duration":555},
                {"id":"waQJEjiPWhg","title":"Bitcoin Culture Around the World","duration":305},
                {"id":"GCor6z-X_eA","title":"This Is Why El Salvador Chose Bitcoin | Blockstream at Plan B El Salvador Day 2","duration":53},
                {"id":"6Sn1ZlXU6y0","title":"Reclaiming Agency in a Shifting World","duration":65},
                {"id":"3GZ0ygDSbV0","title":"The Challenges Of Using Bitcoin In Zimbabwe | Alexandria | The Anita Posch Show #152","duration":5298},
                {"id":"LXB0d_3WntM","title":"Bitcoin is Ready to Replace the Broken USD - Isabella Santos (BTC Isla)","duration":3724},
                {"id":"4Bmni2lHYo8","title":"Isabella Santos on Bitcoin Community Building","duration":3644},
                {"id":"c8UMS3n47ZE","title":"Life After Bitcoin With Peter McCormack","duration":5001},
                {"id":"0x0yLT5LVM0","title":"Build Your BITCOIN CITADEL! Personal Freedom Revolution | Takota Coen","duration":3801},
                {"id":"VJLPkapxNRw","title":"Bitcoin für die Zivilgesellschaft – Freiheit, Privatsphäre und Selbstbestimmung","duration":1294},
                {"id":"0Ceey82hFTY","title":"Booking Travel with Bitcoin - Travala","duration":759},
                {"id":"BoHNkX4OWQA","title":"Jack Mallers on Bitcoin for El Salvador","duration":244},
                {"id":"a75GbcbUyfA","title":"BTCPayServer Twitter Spaces - #Bitcoin accepter here - El Salvador Edition","duration":2723},
                {"id":"cs3nEVX9ZWA","title":"Bitcoin Is Transforming Access to Electricity and Finance - Gladstein","duration":1795},
                {"id":"Ve6oLiWO0Mg","title":"Traveling the World on Bitcoin - Airbtc","duration":1132},
                {"id":"BBZvTt8oErU","title":"Prospera ZEDE - MUST VISIT Private/Bitcoin City w/ Erick A. Brimen - Roatan, Honduras","duration":5335},
                {"id":"UoVsYht7cIo","title":"Isabella Santos - The Unique Voice of Education, Entertainment & Empowerment","duration":4227},
                {"id":"66HRDI_Vxhc","title":"El Salvador Passes Bitcoin Law | Twitter Spaces - Hosted by Nic Carter ft. ES President Nayib Bukele","duration":7265},
                {"id":"vlf4swtTBSM","title":"Isla Mujeres is Becoming a Bitcoin Paradise! (Here's How)","duration":314},
                {"id":"Isrhajmf9cc","title":"Anita Posch, Bitcoin for Fairness Executive Director & Bitcoin Advocate In Conversation With Trevor","duration":4233},
                {"id":"NgGV3CYj3fI","title":"Bitcoin Adoption in Zimbabwe by YeBo Bitcoin","duration":508},
                {"id":"Lq6ZDqwA8UA","title":"The Bitcoin Football Club with Peter McCormack & Dominic Frisby","duration":5420},
                {"id":"xnkgvaCgLTQ","title":"Javascript and Bitcoin -- Lesson 3 of the Pleb Dev Course","duration":3876},
                {"id":"CfpxNSI4HJ0","title":"Bitcoin Entrepreneur Reveals Why 6-Figure Earners Are Still Poor","duration":4898},
                {"id":"bHLEA9fRUQc","title":"Building Bitcoin for Africans, By Africans: Lessons From 5 Years on the Ground - ABC 2025","duration":627},
                {"id":"qzIA5E9LoUo","title":"Blockstream & Bitcoin's Best: Enterprise & Institutions Day in El Salvador 🇸🇻","duration":36},
                {"id":"ic_4-EFJogY","title":"From Accenture to Bitcoin Maximalist - Alexandre Laizet","duration":503},
                {"id":"Y0KSCjo2IJI","title":"Reflecting on Bitcoin Legalization in El Salvador - Bitcoin Spaces","duration":5912},
                {"id":"D22zHDCE6-0","title":"Did El Salvador Just Give Up On Bitcoin? - Get Based TV","duration":837},
                {"id":"BdaiLtKNFQA","title":"The plan 40 Countries in 400 Days - Paco","duration":4320},
                {"id":"FelWKV6wVJU","title":"Living on Bitcoin in a Small Town - Joe Nakamoto","duration":1276},
                {"id":"JhxFbvgqvwU","title":"Alex Gladstein | Argentina's Bitcoin Adoption | EP 137","duration":3630},
                {"id":"5scEV0IVYeY","title":"Why BIP110 (aka Knots) is a Hostile Attack on Bitcoin - Plan ₿ Forum El Salvador 2026","duration":1670},
                {"id":"Qaj7TfHxVBU","title":"El Salvador's Broken Bitcoin Revolution - Get Based TV","duration":2012},
                {"id":"78YidaGwELw","title":"Building Bottom-Up Bitcoin Economies - Isabella Santos (BTC Isla)","duration":2653},
                {"id":"5hMZkxQtstU","title":"167. Run with Bitcoin with Paco de la India","duration":5477},
                {"id":"sIR0V6VKXLg","title":"How One Woman is Building a Bitcoin Economy From Scratch in Mexico - Isabella Santos (BTC Isla)","duration":4517},
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
                {"id":"JzPsex18Bv8","title":"Whirlpool is Back! Ashigaru Revives CoinJoin for #bitcoin  Privacy","duration":60},
                {"id":"ubj5wpsmqN8","title":"Bitcoin Full Node Security - 11 Tips To Keep Your Node Safe","duration":830},
                {"id":"wihMTwJ_wWs","title":"Sovereign Computing with Matt Hill of Start9","duration":2692},
                {"id":"ekRzqy7D1wk","title":"Cybersecurity Secrets for Protecting Bitcoin","duration":5437},
                {"id":"qFfhr4sApso","title":"RUN A BITCOIN NODE - Simple Tutorial With Umbrel Home","duration":3940},
                {"id":"ZaaTR9qBpQI","title":"Why Bitcoin Layer-2s and Confidential Transactions Are the Future of Finance","duration":63},
                {"id":"WfDmcyvAZgI","title":"Adam Back: Bitcoin Is a Multi-Millennia Monetary Invention Better Than Gold","duration":49},
                {"id":"KQ_gz-tpGkU","title":"Adam Back: Bitcoin's Addressable Market Is Hundreds of Trillions of Dollars","duration":47},
                {"id":"6poXI01pIMs","title":"Institutional Grade Security for Your Bitcoin: Jade Plus Anti-Exfil","duration":61},
                {"id":"nRoAyZG2taE","title":"Switch from Bitcoin Core to Knots (Windows, Mac, Start9, Umbrel)","duration":5301},
                {"id":"-LGpW2PKwHA","title":"Bitcoin Core Developer Interview: Antoine Poinsot - MIT Bitcoin Expo 2025","duration":2141},
                {"id":"Gs6ji-kKmY8","title":"Adam Back Explains the @LiquidNetwork $4B in Real-World Assets Trading 24/7 on Bitcoin Layer-2","duration":40},
                {"id":"cDYQ6A69-D4","title":"Enhance Your Bitcoin Journey with Start9's Server Pure Upgrade","duration":1714},
                {"id":"DKBJ3_3ZomU","title":"Start9 Embassy - Bitcoin Node And Personal Server Tutorial","duration":7176},
                {"id":"lW8r9hq8-yU","title":"Bitcoin Core Developer Interview: Gloria Zhao - MIT Bitcoin Expo 2025","duration":1835},
                {"id":"gOo7rnqXeik","title":"Open Source Software In Bitcoin","duration":754},
                {"id":"ckvTy0Fsc_M","title":"Bitcoin Privacy on Trial: Samourai Wallet & Tornado Cash - MIT Bitcoin Expo 2025","duration":1526},
                {"id":"gUGJje2jvck","title":"Proton Wallet w/ Andy Yen","duration":3279},
                {"id":"JXTFPKmF3Fs","title":"We are all Satoshi.","duration":14},
                {"id":"7FWKc8lM4Ek","title":"Neutrino: The Privacy Preserving Bitcoin Light Client","duration":2644},
                {"id":"AgqkcDyOsbY","title":"Pay With Bitcoin at Your Favourite Shops Using Lightning and the Blockstream App","duration":40},
                {"id":"1XxG_qjY3EY","title":"Home Bitcoin Solo Node Setup Guide (Umbrel)","duration":529},
                {"id":"U9hdav36WAo","title":"How to Use Wasabi Wallet for Bitcoin CoinJoin","duration":1264},
                {"id":"cXATaj0YJeQ","title":"Adam Back: Bitcoin Is Like Buying Internet Stocks in the Early 90s","duration":34},
                {"id":"i0-2UhU-o2s","title":"How Bitcoin Incentives and URSFs Kill Minority Soft Forks","duration":1720},
                {"id":"JtzwTd9Ur5c","title":"Competing with Free | DerGigi","duration":1192},
                {"id":"FooHZd6LviI","title":"IF energy = currency THEN Bitcoin | They're Just Now Figuring Out What Bitcoiners Already Knew","duration":10},
                {"id":"Dlxttzs5tXI","title":"Start9 Labs CEO Matt Hill Interview Lightning Ventures 3/24/2022","duration":3473},
                {"id":"9npQ5f74Nr4","title":"The Cypherpunks: Freedom, Privacy, and the Genesis of Bitcoin","duration":3078},
                {"id":"DpTiayQkCUQ","title":"Bitcoin Ownership Is Lower Than You Think—It's Still Early and You Know It","duration":20},
                {"id":"6ArUlNTsooM","title":"Bitcoin must be secure against powerful adversaries. Not just “what if”","duration":41},
                {"id":"kmfzATMxCj4","title":"Start9 vs Umbrel - What's the Difference? CEO Matt Hill Explains","duration":190},
                {"id":"TASQj1hacuI","title":"Bitcoin Privacy - Alex Gladstein","duration":664},
                {"id":"XRxbrfbeThg","title":"Gigi on Internet Business Models & Freedom","duration":5910},
                {"id":"fgAKXfVzc7c","title":"Start9 OS Bitcoin Node Tutorial - DIY Hardware, How To Set Up, Download & Why I Moved from Umbrel.","duration":827},
                {"id":"PVHN_y7Bz0A","title":"POV: You're Running Away From Your Problems With Your Bitcoin Using Blockstream Jade","duration":20},
                {"id":"ehhtq_gtC3M","title":"\\\"Quantum Will Break Bitcoin\\\" - Adam Back Explains Why That's Wrong","duration":53},
                {"id":"Z0696dgyxZI","title":"How to Actually Spend Bitcoin in Real Life (It's Easy In 2026 with Blockstream)","duration":66},
                {"id":"kYNrQhZTwWg","title":"Bitcoin privacy becoming more popular","duration":60},
                {"id":"UA29De0t3i0","title":"True North Now - Bitcoin Core, OP_RETURN & Knots Explained | Featuring Rob Hamilton (Anchorwatch)","duration":3682},
                {"id":"Cjxc9ERz2mU","title":"Lightning Privacy: Concerns and Solutions - Open Source Stage (Bitcoin 2022)","duration":2401},
                {"id":"zV_A2yMZl0w","title":"Alex Gladstein: Bitcoin Privacy & Freedom - Bitcoin Magazine","duration":793},
                {"id":"nvBsNKsZ6uY","title":"“From 10% to 50%\\\" The Bitcoin Moment Everyone Has – Adam Back","duration":72},
                {"id":"r4VBmza3TNw","title":"Bitcoin: Soft Fork vs Hard Fork & BIP-110 Updates","duration":1400},
                {"id":"mDyBbGCiBUU","title":"Nic Carter: Bitcoin Core Values, Layered Scaling, and Blocksize Debates | Lex Fridman Podcast #173","duration":8835},
                {"id":"QvtnQfVdLYU","title":"What People Get Wrong About Bitcoin Core (Sjors Provoost) - MIT Bitcoin Expo 2025","duration":1023},
                {"id":"6BIAgpzmNGY","title":"Soundbite: What is money, and why do we need a parallel form of it in Bitcoin and/or Monero?","duration":52},
                {"id":"QeCIVUH89KY","title":"Switch to Bitcoin Knots on Start9 - Full Sovereignty","duration":258},
                {"id":"LrLsS7-woN0","title":"SimpleX chat and how privacy aligns with the future of computing w/ Evgeny from SimpleX","duration":5746},
                {"id":"rLuT4AA8daA","title":"Post-Quantum Bitcoin Requires Difficult Trade-offs - Not Free Upgrades","duration":56},
                {"id":"mdnkZunIphA","title":"The Role of Bitcoin Core Maintainers & the Path Forward","duration":1761},
                {"id":"xaj-CQntobU","title":"Everybody Buys Bitcoin at the Price They Deserve","duration":20},
                {"id":"cyWzGPQpIhc","title":"Epstein Funded Bitcoin Core: Shocking 2015 Revelation","duration":80},
                {"id":"-O-BgOiV9AM","title":"UMBREL TO START9 - Migrate Your Lightning Node","duration":1788},
                {"id":"P7KCb5vFBEI","title":"How Kagi is fixing search w/ Vlad Prelovac","duration":2743},
                {"id":"oxVg9QfcuBk","title":"Soundbite: Matt's biggest fear for Bitcoin privacy is that people rely on custodial privacy","duration":56},
                {"id":"KNaOeLlD6NA","title":"Build a Bitcoin Node on Raspberry Pi with Umbrel","duration":1675},
                {"id":"7fvG11BByD4","title":"Running Bitcoin Knots On Start9","duration":538},
                {"id":"yVP_WGXSThA","title":"How to Protect Your Privacy: Safe Use of Non-KYC Bitcoin","duration":254},
                {"id":"t4yuwtIhQIg","title":"Start9: One-Click Bitcoin Node Setup Guide","duration":4086},
                {"id":"Fa9AvF4jk1o","title":"UMBREL - How To Use Your Bitcoin and Lightning Node (NEW)","duration":3272},
                {"id":"BNRvyrmBUhM","title":"Become a Digital Sovereign with Start9","duration":2955},
                {"id":"kL0Yc8ngzS0","title":"Bitcoin Fixes Double Standards - Guest Gigi","duration":4386},
                {"id":"SSbgVHQrGjg","title":"Bitcoin Core 2024 Development","duration":196},
                {"id":"JsJSsbp9g3M","title":"Bitcoin Privacy is a Human Right","duration":255},
                {"id":"ckm1rBJR8Vc","title":"An open-source security platform w/ Zach Herbert from Foundation","duration":4211},
                {"id":"Rw8wdeTYTJU","title":"#Bitcoin Wallet Trezor CoinJoin Update with Wasabi and Chainalysis:  You Should Be Concerned!","duration":57},
                {"id":"3pc-mRpED5E","title":"#bitcoin nodeWars Ronindojo vs  Umbrel vs  Start 9","duration":57},
                {"id":"Uf-hjzgIpX0","title":"Understanding Seed Phrases: How to Secure Your Bitcoin Without Relying on Third Parties","duration":41},
                {"id":"dMHhuY35NKY","title":"Tor Project Co-Founder Roger Dingledine: Anonymity in Society - MIT Bitcoin Expo 2025","duration":1695},
                {"id":"iVPNk2ZZ63w","title":"Lightning Accounts With Blue Wallet and Umbrel","duration":1249},
                {"id":"fsAUhFr1VXU","title":"Bitcoin Privacy Made Simple: Wasabi Wallet Tutorial","duration":1922},
                {"id":"a0ycGl4jN8w","title":"Run Bitcoin & Lightning Node in 30 mins - Umbrel Home","duration":1884},
                {"id":"_-Acfj4SO6g","title":"Top Bitcoin Privacy Tips & Tricks for 2025","duration":3187},
                {"id":"TEVJUjOGmOI","title":"Bitcoin Core Developer Roundtable - MIT Bitcoin Expo 2025","duration":2284},
                {"id":"DzikmY4S42Y","title":"Start9 Tutorial: Set up your Bitcoin Node and Personal Server.","duration":1148},
                {"id":"eEtxKbERWyA","title":"Bitcoin Core Dev Jeremy Rubin: Building Char Network - MIT Bitcoin Expo 2025","duration":1466},
                {"id":"mpEs0FKqv7k","title":"\\\"Bitcoin Is the Hurdle Rate\\\" - Adam Back Explains What This Means for Every Company in '26 on Forbes","duration":31},
                {"id":"22U4f_OatM4","title":"Bitcoin Is Geopolitically Neutral Money Like Gold Throughout History - Adam Back","duration":60},
                {"id":"mC0lX806NjI","title":"Bitcoin Core 2023 Development","duration":194},
                {"id":"xhDQT4TeNIU","title":"Perfect Privacy with eNuts: Instant Free Bitcoin Transactions","duration":3070},
                {"id":"D2AjX1PB5HE","title":"Bitcoin and Ossification w/ Jameson Lopp","duration":4818},
                {"id":"GWraOJDyFs4","title":"Bitcoin: The Inflation Hedge Every Company Will Eventually Adopt","duration":25},
                {"id":"3AmzFPMcgEY","title":"Growth On Bitcoin & Lightning Is EXPLODING | Alyse Killeen - The Bitcoin Layer","duration":2440},
                {"id":"6Tr4-DL1c1s","title":"Freedom Money: Der Gigi l Episode 1","duration":3092},
                {"id":"njNcv50dVGg","title":"Bitcoin Follows Geopolitics Short-Term, Decorrelates Long-Term - Adam Back on CNBC","duration":58},
                {"id":"IYnzBVMJhTI","title":"Beer for Bitcoin over Tor","duration":32},
                {"id":"JujTD58xTZU","title":"Bitcoin Outperformed EVERY Asset Class for 15 Years — Why It Beats Gold","duration":36},
                {"id":"yAwKISWTMvM","title":"Lightning Speed Bitcoin Payments Without Giving Up Custody","duration":52}
            ]
        },
        {
            "id": "economics-money",
            "name": "Economics & Money",
            "emoji": "💰",
            "desc": "Austrian economics, inflation & sound money",
            "color": "#eab308",
            "videos": [
                {"id":"NNlxZZ6f57Q","title":"Jeff Booth: Why Bitcoin Frees Us From a Broken System","duration":4100},
                {"id":"2-zrgOKK2UM","title":"The easy money trap","duration":61},
                {"id":"0fQ5k1q8FVo","title":"Bitcoin and Stocks vs the Dollar  - [Rich Dad's StockCast]","duration":1926},
                {"id":"crETxyQczyw","title":"$1 QUADRILLION In Global Wealth: How Does It Impact Bitcoin? - The Bitcoin Layer","duration":2327},
                {"id":"-SQbX9W0TBM","title":"8 - Central Banking - Too Much Power?","duration":150},
                {"id":"Vw5wKr_TJm0","title":"HYPERBITCOINIZATION","duration":694},
                {"id":"F8lfLqnhuGs","title":"The Fed's Losing Battle with Deflation (w/ Jeff Booth)","duration":2718},
                {"id":"t7rYIkl6lIQ","title":"The Fiat Standard: Lecture 1 - Saifedean Ammous","duration":3110},
                {"id":"fOpnpECKaY8","title":"Bitcoin, Austrian Economics & Future of Money - Seb Bunney","duration":4717},
                {"id":"BP4zLPhZIj4","title":"$50 Weekly DCA: Gold vs Bitcoin (8/29/25 Update)","duration":51},
                {"id":"DKaZ-h-Wwhg","title":"Bitcoin & Austrian Economics - Peter St. Onge","duration":3087},
                {"id":"hdtY_iMeVEg","title":"Bitcoin Will Hit $100 Trillion Market - Saifedean Ammous","duration":124},
                {"id":"eBTHI27B5rY","title":"Bitcoin & The Return To Prosperity Through Deflation - Jeff Booth","duration":2765},
                {"id":"Yo1yIuRTLko","title":"Why Bitcoin is Generational Wealth","duration":2283},
                {"id":"FMntwaNOEj4","title":"Bitcoin Is Stupid Cheap Right Now | James Van Straten, CoinDesk - The Bitcoin Layer","duration":1582},
                {"id":"yDpMGUZZC4c","title":"Bitcoin Is the Internet of Money - David Marcus on Coin Stories","duration":2597},
                {"id":"g1QGbBhKLDQ","title":"The origins of fiat money","duration":37},
                {"id":"TwQugFm2qoo","title":"Why STRATEGY Stands Alone & Why Most Bitcoin Treasury Companies Cannot Last - The Bitcoin Layer","duration":2348},
                {"id":"7EZsBBKjens","title":"Lyn Alden 2024 Interview - Bitcoin Prediction in 2024","duration":723},
                {"id":"bhogkKgH-o0","title":"Lyn Alden 2024 Interview - Money Systems and Their Instability.","duration":1431},
                {"id":"TmV4Ns_ngSM","title":"The Economics of Bitcoin - Saifedean","duration":2399},
                {"id":"Fn2_d5p8EcI","title":"7 - Boom & Bust Cycles: A Feature of Fiat Money","duration":177},
                {"id":"P5tVGJCHDoQ","title":"Why gold, not platinum?","duration":58},
                {"id":"HZx7t15d96M","title":"Jeff Booth Explains Why Everything Is Getting More Expensive","duration":2814},
                {"id":"soGXgiGoMRU","title":"Broken Money Thesis Presentation - Lyn Alden","duration":3968},
                {"id":"ImIP0izB6SY","title":"Bitcoin is Generational Wealth | Peter Dunworth","duration":4166},
                {"id":"Z71sOLsZpkI","title":"Bitcoin Isn't Worth $65K, Your Dollars Are Worth Nothing - Jeff Booth","duration":10059},
                {"id":"iFDe5kUUyT0","title":"The Biggest Scam In History Of Mankind - Hidden Secrets of Money Ep 4","duration":1775},
                {"id":"jdYzif981SQ","title":"Bitcoin Dad: The Window for Generational Wealth Is Closing","duration":5104},
                {"id":"k3NN_NZOdhY","title":"Lyn Alden Content: Broken Money Thesis","duration":3087},
                {"id":"uRDk8BxQP0g","title":"Will Private Credit Cause a Crisis? - The Bitcoin Layer","duration":412},
                {"id":"CZKA01K3vig","title":"The Dollar is Crashing in Bitcoin Terms (7/17/25 Update)","duration":93},
                {"id":"XNE7MKOEsFQ","title":"Lyn Alden 2024 Interview - The Growing Importance of Bitcoin","duration":631},
                {"id":"AdaHyUmRvCU","title":"Austrian Economics & Monetary Policy of Bitcoin","duration":1095},
                {"id":"UIhieMtB_A0","title":"The Everything Bubble Is Over: Michael Howell's Warning for 2026 - The Bitcoin Layer","duration":4085},
                {"id":"Zxr7W7Mg9pY","title":"2: Inflation is STEALING from you! And How you can stop it!","duration":264},
                {"id":"TLhbc3moELQ","title":"The Gold Standard: Chapters 1-4","duration":5575},
                {"id":"y307cs3EV44","title":"Economics of Dust: Post-Ordinals Bitcoin Output Analysis w/ Commentary","duration":614},
                {"id":"jsoMWIx17Jc","title":"A US and Argentina soybean alliance might be what pushes it over the edge. - The Bitcoin Layer","duration":162},
                {"id":"bs_pYdK8CU8","title":"Lyn Alden: Why Our Financial System Fails","duration":5223},
                {"id":"EbTpOiO_-xA","title":"Fed Liquidity Crunch Explained: Repo, QT, & Bitcoin's Reaction - The Bitcoin Layer","duration":1157},
                {"id":"GA_7P8RdyRU","title":"Oil Shock, Stablecoin Surge, and Bitcoin Isn't Flinching - The Bitcoin Layer","duration":312},
                {"id":"0v4z6r6_6QI","title":"6 - How New Money Benefits The Rich (Cantillon Effect)","duration":120},
                {"id":"gp4U5aH_T6A","title":"Bitcoin, Anarchy & Austrian Economics - Lex Fridman & Saifedean","duration":15281},
                {"id":"Ux-iV_9KAxk","title":"Jeff Booth: Why Most People Will Get Wiped Out in the Transition","duration":600},
                {"id":"vkV8r5udf18","title":"1: Why Fiat Currencies are Ruining Your Life!","duration":336},
                {"id":"WxKmFBpq_8M","title":"$50 Weekly DCA: Gold vs Bitcoin (5/13/25 Update)","duration":49},
                {"id":"jk_HWmmwiAs","title":"How Money & Banking Work - Lyn Alden","duration":1950},
                {"id":"y1EYoyW9fhU","title":"We Need Honest Money","duration":27},
                {"id":"qawzs0QSzbI","title":"Everything You've Ever Been Told About Money Is a Lie - Jeff Booth","duration":4218},
                {"id":"usUfMQcu9YQ","title":"How the Fed Lost Control of Liquidity (and What It Means for Bitcoin) - The Bitcoin Layer","duration":2226},
                {"id":"OZVV62lqytw","title":"US Treasuries MUST STABILIZE for Bitcoin to Move Higher - The Bitcoin Layer","duration":2192},
                {"id":"X8IAeTu8Irs","title":"The truth of fiat money","duration":78},
                {"id":"_9JPeiTvREA","title":"How Societies Collapse","duration":670},
                {"id":"GDZqw6QkW-U","title":"Is China Sitting on the BIGGEST DEBT BOMB in Modern History? - The Bitcoin Layer","duration":2617},
                {"id":"GbLndO2XfuI","title":"Where Does Money Come From - Hidden Secrets Of Money Ep 5","duration":1799},
                {"id":"2xW6Mg9k9l8","title":"11 - The Coming Dollar Collapse","duration":1158},
                {"id":"Ai5z2T4WhWg","title":"Why Bitcoin Matters - Economical, Ethical And Technological Perspective","duration":2131},
                {"id":"qZSjJk70FTA","title":"Economics of Dust: Post-Ordinals Bitcoin Output Analysis","duration":70},
                {"id":"XLxGM47GdBU","title":"The Fiat Standard with Dr. Saifedean Ammous","duration":3371},
                {"id":"VN3h0gmsuL4","title":"Bitcoin Annualized Issuance Rate (Monetary Inflation) (9/21/25 Update)","duration":106},
                {"id":"wW35okWUurM","title":"Gold at $5,000 Signals MASSIVE Changes to the World Order - The Bitcoin Layer","duration":3419},
                {"id":"7tQIGuCyOHQ","title":"Jeff Booth Masterclass: The Price of Tomorrow & Truth About Inflation","duration":4544},
                {"id":"VgqH9lPiAbY","title":"10 - What Comes After The Dollar?","duration":242},
                {"id":"3PF893H5v74","title":"Inflation is just like alcoholism","duration":34},
                {"id":"8mpiEplIfU8","title":"Global Macro Update: Gold, Silver, Bitcoin, and the Breakdown of the WTO Era - The Bitcoin Layer","duration":3711},
                {"id":"nvVR_fVU7Bc","title":"Argentina just told China: no thanks. They want the U.S. as their 'partner of choice.' - The Bitcoin Layer","duration":125},
                {"id":"Xm47eTYJm_w","title":"$95,000 Bitcoin & Fed Independence - The Bitcoin Layer","duration":1408},
                {"id":"dIqs9hGNU9A","title":"Inflation & the Collapse of Civilization","duration":4021},
                {"id":"6RsPt2bhi1o","title":"Jeff Booth: Bitcoin Crashed 30% - Why I Feel Incredible","duration":3769},
                {"id":"zr4eD3g5uQE","title":"You Will Never Look At Bitcoin The Same Way Again - Jeff Booth","duration":4215},
                {"id":"wzxydNI2-Go","title":"INTEREST EXPENSE EXPLODES: Why The Fed Must Cut & What It Means For Bitcoin - The Bitcoin Layer","duration":1288},
                {"id":"PQ2wj8dnpqo","title":"What is money? | Ammous & Fridman","duration":624},
                {"id":"LpccPgtC56g","title":"Average Price: Ground Beef in Average U.S. City, Bitcoin vs Dollar (8/2/25 Update)","duration":93},
                {"id":"NqBdAnhWB4U","title":"Bitcoin Holds $90,000: Volatility, Yields, & The FED'S NEXT PRINT - The Bitcoin Layer","duration":1663},
                {"id":"drs6Q_OX0HE","title":"Austrian Economics Intro - The Bitcoin Way","duration":5260},
                {"id":"sKN0scdPZsA","title":"Bitcoin is freedom money Ft. Guy Swann","duration":37},
                {"id":"wMhZD_7lbkU","title":"THE FED ENDS QT: Fiscal Dominance, Repo Stress, & Bitcoin's Signal - The Bitcoin Layer","duration":2353},
                {"id":"Ih0e8AXT_-s","title":"Broken Money | Oslo Freedom Forum","duration":1200},
                {"id":"1sAK4pORJkY","title":"9 - Hyperinflation & Collapse (Extreme Case)","duration":153},
                {"id":"lB3mQImM-5Y","title":"The Fiat Standard by Saifedean Ammous (Full Presentation)","duration":273},
                {"id":"Hob0-KYPqEg","title":"Bitcoin is financial freedom","duration":59},
                {"id":"tctq51pjbSY","title":"8. Is Inflation Actually Necessary?","duration":319},
                {"id":"tBnsQeTbMU8","title":"How High Can Gold & Silver Go?","duration":797},
                {"id":"D2DLuDfYbRU","title":"Bitcoin Annualized Issuance Rate (Monetary Inflation) (9/17/24 Update)","duration":99},
                {"id":"8rYl8wEotZk","title":"Strategy CEO on Bitcoin Yields & Adoption - Coin Stories","duration":4025},
                {"id":"c8Utm_op9Ts","title":"Bitcoin Annualized Issuance Rate (Monetary Inflation) (2/27/25 Update)","duration":103},
                {"id":"7Nw64Jfb2Nw","title":"Global Macro Update: Inflation Cools, Bond Yields Drop, & Bitcoin Reacts - The Bitcoin Layer","duration":1955},
                {"id":"8PWRE5Ygam0","title":"Bitcoin's Emergence As Sound Money","duration":1641},
                {"id":"N41OC2sazbw","title":"Jeff Booth on Bitcoin, AI, and Why Deflation Is Coming","duration":3570},
                {"id":"ndj8LzSfEDk","title":"If a money is easy to create more of","duration":35},
                {"id":"z4MUIcyqIbw","title":"Highlight: Unwritten Chapters of The Fiat Standard","duration":60},
                {"id":"G2vAm2hfW9U","title":"Why Deflation is the Key to Abundance - Jeff Booth","duration":3521},
                {"id":"CK7Gli9nltE","title":"Global Macro Director at Fidelity Shares His Investing Strategies For Bitcoin | Jurrien Timmer","duration":3124},
                {"id":"V2r0EaJQwLA","title":"Lyn Alden: Bitcoin Long-Term Bull Case - Coin Stories","duration":687},
                {"id":"_UA2lcEKjLs","title":"Inside McKinsey's Global Wealth Report: What It Means for Bitcoin - The Bitcoin Layer","duration":1993},
                {"id":"csGEhR7JNVU","title":"Bitcoin to 100,000,000 dollars?","duration":435},
                {"id":"aKuKbNpGvys","title":"3 - The Ultimate Scam! How Banks Steal from YOU!","duration":201},
                {"id":"BcS3QzXtfQc","title":"Bitcoin Holds $100,000 as Stocks Recover: TBL Liquidity Explained - The Bitcoin Layer","duration":2291},
                {"id":"X60jZY87A6k","title":"What is money?","duration":91},
                {"id":"dlCbXoQokx0","title":"Governments Will Accumulate Bitcoin - Mike Alfred on Coin Stories","duration":640},
                {"id":"7fAhxz8GIAg","title":"The Liquidity Signal That Called Bitcoin's Drop Is Still Red - The Bitcoin Layer","duration":1692},
                {"id":"DgaAU2eZLCI","title":"Average Sales Price for New Houses, Bitcoin vs Dollar (11/6/25 Update)","duration":94},
                {"id":"CEmJQYEdYpk","title":"Liquidity Tightens AGAIN: What the Repo Market Is Telling Us - The Bitcoin Layer","duration":1215},
                {"id":"DKDGXT3SENI","title":"How will Bitcoin fare in the coming economic collapse?","duration":317},
                {"id":"Jv7616ZV4CA","title":"$50 Weekly DCA: Gold vs Bitcoin (12/24/24 Update)","duration":46},
                {"id":"i42PYv_ouY8","title":"JAPAN RATE CHECK Triggers a DOLLAR INDEX COLLAPSE - The Bitcoin Layer","duration":1006},
                {"id":"_T4K9fJ-DMA","title":"Your Savings Are at Risk | \\\"The Bitcoin Standard” Microcourse, in Partnership with Genius Academy.","duration":60},
                {"id":"u6002_r1kSw","title":"Lyn Alden 2024 Interview - Bitcoin ETFs: Catalysts for Price and Demand","duration":630},
                {"id":"77GH63y-UnY","title":"Average Price: Electricity per Kilowatt-Hour in Average U.S. City, Bitcoin vs Dollar (9/9/25 Update)","duration":93},
                {"id":"QrUfS6SBBbM","title":"5 - Why Government Debt Means Inflation is Necessary","duration":205},
                {"id":"7LcxJzUrGd8","title":"Saifedean Ammous - Principles of Economics, Bitcoin Standard & Fiat Standard","duration":3011},
                {"id":"FXvQcuIb5rU","title":"The Immaculate Conception: Bitcoin vs Fiat Standard - Saifedean (EP 203)","duration":7126},
                {"id":"_nSF9yZWalA","title":"Principles of Economics Lecture 10: Money","duration":5647},
                {"id":"lxgDRK5cRhA","title":"Episode 2: Bitcoin vs Gold: Why Digital Gold is Better","duration":481},
                {"id":"VssN8B0NWqY","title":"The Fiat Standard Lecture 5: Universal Debt Slavery - Saifedean","duration":2853},
                {"id":"lmfx960EQkY","title":"Mike Maloney - The Best Video Series Ever Made About Money","duration":1766},
                {"id":"mKNojhzp_oY","title":"Can NVIDIA's EARNINGS JOLT Spark a Bitcoin Reversal? - The Bitcoin Layer","duration":1751}
            ]
        },
        {
            "id": "freedom-sovereignty",
            "name": "Freedom, Sovereignty & Self-Custody",
            "emoji": "🗽",
            "desc": "Human rights, financial freedom, self-custody & sovereignty",
            "color": "#0ea5e9",
            "videos": [
                {"id":"5l2wpPM-8IY","title":"The Global Refugee Crisis & The Bitcoin Solution - The Bitcoin Layer","duration":2071},
                {"id":"ZZKoSmQu30Q","title":"Best Bitcoin Hardware Wallets Compared - BTC Sessions","duration":3621},
                {"id":"nJW37bfmsWA","title":"Ownership = Self-Custody | Reap The Full Advantages Of Bitcoin","duration":19},
                {"id":"LMeNe1tBsr4","title":"Oslo Freedom Forum 2024 - Financial Freedom Track Full Livestream","duration":23584},
                {"id":"Qd8ymRwrokg","title":"COLDCARD Spending Policy & 2FA","duration":300},
                {"id":"llCrHefbZa0","title":"Bitcoin Hardware Wallet Glow-Up 🚨 Jade Plus in Rose Gold, Stealth Black & Soverign Green Launches","duration":11},
                {"id":"vTllOOLlJEI","title":"COLDCARD Bag Number check #selfcustody #bitcoin","duration":15},
                {"id":"QabBSVF08KE","title":"Easiest way to Run a Bitcoin Node! | How to connect hardware wallet to your own Node with Sparrow.","duration":278},
                {"id":"FSRmf_d3gnY","title":"HRF Calls for Justice for Navalny's Imprisoned Lawyers","duration":193},
                {"id":"FAYmE5-40PQ","title":"Coldcard Bitcoin Hardware Wallet - FULL TUTORIAL (BTC Sessions)","duration":6890},
                {"id":"BnHLSB08W2M","title":"Bitcoin UTXO Management with Nunchuk Wallet","duration":1630},
                {"id":"qxOhCvot77I","title":"Create & Verify Your Bitcoin Seed Phrase Using Dice + Coldcard + SeedSigner","duration":443},
                {"id":"Hee0elVtA9k","title":"Bitcoin Self Custody: Signing Devices & Software Wallets","duration":790},
                {"id":"oDaTIFKe3k4","title":"4 Best Countries for Crypto Millionaires","duration":459},
                {"id":"1H7FqG_FmCw","title":"Assembling Specter-DIY hardware wallet in 5 minutes","duration":338},
                {"id":"vmf_LtnagTs","title":"Bitcoin Cold Storage Tutorial","duration":2386},
                {"id":"n5K1lEDv8aM","title":"Afghan Women Using Bitcoin Under Taliban - Gladstein","duration":741},
                {"id":"-yepJZ788WY","title":"Reckless Review in VR","duration":3682},
                {"id":"S098zQKg2D4","title":"The PERFECT Cold Hardware Wallet - Explained","duration":763},
                {"id":"bCiIcbR8r9w","title":"Mastering Bitcoin Self-Custody with BTC Sessions - The Bitcoin Layer","duration":2268},
                {"id":"SNffLDSLEoU","title":"Reckless VR: Alex Gladstein, Human Rights Foundation","duration":4371},
                {"id":"MjMPDUWWegw","title":"COLDCARD Co-Sign (CCC)","duration":203},
                {"id":"P3U3jZTMXOk","title":"COLDCARD + Cove Wallet Quick Start Guide","duration":124},
                {"id":"PPNOJLn3hQs","title":"Bitcoin-Only BitBox02 Setup & Import Into Sparrow Wallet","duration":1310},
                {"id":"Sxo169CCfIc","title":"How To Use Multisig Bitcoin Wallets With Electrum","duration":1471},
                {"id":"DG1zrlAVdys","title":"BTCIOT Tutorial: Bowser, DIY Bitcoin Hardware Wallet","duration":1752},
                {"id":"cdiVmxRaOoA","title":"Making self-custody safe with Jameson Lopp. Trezor Twitter Spaces","duration":6167},
                {"id":"2xRp4-9pZmM","title":"The Economic Philosophy of Bitcoin, Part I with Bitstein | The Bitcoin Layer - The Bitcoin Layer","duration":3333},
                {"id":"jk89usrtNEk","title":"Bitcoin 101 - Getting Your BTCs out of Your Paper Wallets & Cold Storage - Fun with Sloppy Wallets","duration":654},
                {"id":"vPMUGP3Opy8","title":"This Is The PERFECT Bitcoin Security and Privacy Setup!","duration":2324},
                {"id":"RNHi8Qj2KrY","title":"Ethereum - How A Lie Became Worth Billions - Get Based TV","duration":696},
                {"id":"YeEy7pOre04","title":"The Best Bitcoin Hardware Wallet | ColdCard MK4 Setup Tutorial","duration":1084},
                {"id":"28PadE9ARDg","title":"MusicSnake - Cold Storage [Hardware Wallet Crypto Song]","duration":206},
                {"id":"pJF_PAki4N8","title":"COLDCARD + Bull Bitcoin","duration":119},
                {"id":"52pSd3I1nac","title":"Wasabi CoinJoin Tutorial - Self Custody Privacy","duration":5071},
                {"id":"ABvcLlv457k","title":"Blockstream App 5.2.0: Lightning Payments From Cold Storage","duration":122},
                {"id":"cNiO_nbdq3Y","title":"Danger: 7 Bitcoin Blind Spots That Will Wipe Out 99% in 2026 | BTC Sessions","duration":1609},
                {"id":"TeZiAhwkvKU","title":"EP8: Good for Bitcoiners, Good for Bitcoin w/ SeedSigner","duration":3782},
                {"id":"PeBE4VV6fWk","title":"Bitcoin Self-Custody Made Easy (Bitkey)","duration":944},
                {"id":"1jdFBnoNuOU","title":"Debt. Greed. Inflation. The Bible Saw It Coming. - Get Based TV","duration":910},
                {"id":"IgAI5uyUs-E","title":"Celebrities & Dictators | Human Rights Foundation","duration":154},
                {"id":"4kbRqOYiOVk","title":"Debanked  Bitcoin Self Custody Is Your REAL Safety Net!","duration":39},
                {"id":"8zM_1lOXtBU","title":"Bitcoin 2-of-4 Multisig Wallet Tutorial Using Sparrow Wallet","duration":3725},
                {"id":"GNzyaxizrNo","title":"This Video Is For Ross Ulbricht - Get Based TV","duration":1076},
                {"id":"z3n1uZrNvXo","title":"How To Self Custody Your Bitcoin","duration":1494},
                {"id":"jLcu6T1diCM","title":"Maple AI for Human Rights","duration":670},
                {"id":"qul5v0qopCQ","title":"Want the perfect tool to hide your dirty money? Look no further than a shell company.","duration":63},
                {"id":"i72_p2hdtnw","title":"The HRF's Fight for Freedom: Tools and Challenges for Activists - Gladstein","duration":2300},
                {"id":"8xurGFoKfjo","title":"Episode 6: Bitcoin Self Custody: Financial Freedom","duration":250},
                {"id":"5fOhkHbZz_8","title":"Your Bitcoin Deserves Better Than an Exchange — Take Self-Custody with Blockstream Jade","duration":72},
                {"id":"s2bVOVdSrN0","title":"Digital IDs Just Went Live - Say Goodbye To Your Privacy & Money","duration":2231},
                {"id":"CNkgi1DU7xc","title":"Bitcoin 10-of-10 Multisig Testing with Sparrow and Nunchuk Wallet","duration":830},
                {"id":"Y5wgZ3rFayQ","title":"Bitcoin is Monetary Free Speech","duration":521},
                {"id":"Ir1frVs1gNE","title":"Secure Passwords","duration":219},
                {"id":"tUZLc0sjlEE","title":"SALE ANNOUNCEMENT: Path to Self Custody Workshop Bundle Sale Through Jan 2024","duration":102},
                {"id":"9VWduKV8EpE","title":"You're Not Too Stupid for Bitcoin Self-Custody—No One Taught You (Give us 3 Minutes","duration":178},
                {"id":"EqoYtMS8FZU","title":"Hack-Proof Bitcoin in 15 min: Coldcard Q Setup for Total Beginners","duration":993},
                {"id":"7EmshGDXi04","title":"Bitcoin Replace By Fee & Child Pays For Parent Tutorial using Sparrow Wallet","duration":911},
                {"id":"n3iQ3UOWgZg","title":"Introducing Coldcard Mk5","duration":61},
                {"id":"InDyHPcgNdk","title":"Bitcoin Security | Coldcard Q Air-Gapped Setup","duration":2280},
                {"id":"F5rJHIiIEQA","title":"How to Self-Custody Bitcoin (Even If You Always Lose Everything)","duration":41},
                {"id":"PnWZPgo5jbc","title":"Importing an Airgapped Coldcard Bitcoin Wallet into Sparrow Wallet","duration":541},
                {"id":"-XjZUKIC1KE","title":"Bitcoin VR Worlds","duration":538},
                {"id":"63EbTT2rjyE","title":"2025 NK Insider Forum","duration":214},
                {"id":"_MBEzS9GAME","title":"Bitcoin Self Custody Q&A (12/19/23)","duration":3101},
                {"id":"6ojBttz49cA","title":"Importing a Coldcard Bitcoin Wallet (& Labels from Sparrow) into Nunchuk","duration":1087},
                {"id":"A-QpLdoDF14","title":"Financial Freedom Against Tyranny","duration":572},
                {"id":"ZYN4X_l1ZXg","title":"Financial Freedom and Bitcoin - HRF","duration":2695},
                {"id":"H6PM4mbGwp8","title":"Bitcoin Hardware Wallet Unboxing - Setting Up Blockstream Jade Plus in Rose Gold","duration":63},
                {"id":"8Aofh-rx_l8","title":"Bitcoin's Censorship Resistance Makes It Superior - Breedlove","duration":353},
                {"id":"dP5xdXj0Bp4","title":"Are ETFs better than self custody? Currency Wars 2 and VR Class (1 min video)","duration":68},
                {"id":"isiy70T-rKE","title":"The Economic Philosophy of Bitcoin, Part II with Marty Bent | The Bitcoin Layer - The Bitcoin Layer","duration":3554},
                {"id":"lfPZteWuH3k","title":"Crypto-Friendly Countries Interview","duration":2008},
                {"id":"p8vLlp67UnA","title":"Why I Moved to Dubai - Nomad Capitalist","duration":533},
                {"id":"xxfUpIV9wRI","title":"Bitcoin Q&A: What is a Private Key?","duration":1098},
                {"id":"z3sldY-4ZKM","title":"How to Check, Delete, & Recover a Bitcoin Seed Phrase","duration":1746},
                {"id":"AcWcusXqClo","title":"What Edward Snowden Just Said About Bitcoin","duration":471},
                {"id":"vweXlKOYi_A","title":"BR093 - ECDSA Key Extraction, ESP32 Vuln, COLDCARD, Nunchuk, CTV Revival? + MORE ft. Rob & Vivek","duration":5297},
                {"id":"KY72n6UFg1s","title":"Tax-Friendly Countries for Investors","duration":486},
                {"id":"jvi0EDzLFTU","title":"Open standards matter #bitcoin #selfcustody","duration":26},
                {"id":"xLYYh4aPXAM","title":"Bitcoin Is Protecting Human Rights - Alex Gladstein","duration":338},
                {"id":"oj_W3xOlt6U","title":"Cracking Unsafe Bitcoin Wallets + Coldcard Mk4 Warning","duration":598},
                {"id":"LNAFBnN4AHg","title":"How The Bible Helped Me Understand The Capital War - The Bitcoin Layer","duration":2664},
                {"id":"krzoDpWfVq8","title":"BR096 - OP_RETURN Debate, Core Governance, Future Soft Forks, COLDCARD + MORE ft. Rob, Odell & Craig","duration":3984},
                {"id":"o-iDeLZ4BiE","title":"PAYNYMS In Sparrow Wallet - Privacy Preserving Public Bitcoin IDs","duration":1271},
                {"id":"4YXklLh2srA","title":"Setting up a multisig wallet with Specter and Electrum","duration":428},
                {"id":"M5-yY2XWdKM","title":"Download, Verify, & Flash SeedSigner v0.7.0 Software","duration":724},
                {"id":"1IIBhvQFNvs","title":"Tutorial - Multi Signatur with Sparrow Wallet, BitBox & Jade & Specter DIY","duration":1196},
                {"id":"WxggMzuGMsI","title":"The Philosophy of Bitcoin & Fiat: Credit, Justice, & Sound Money - The Bitcoin Layer","duration":2399},
                {"id":"IBY8SdA3W4Y","title":"Bitcoin for Generational Wealth & Freedom - Breedlove","duration":1589},
                {"id":"OPd9NcyIuy0","title":"Edward Snowden: The Danger of CBDCs","duration":547},
                {"id":"A-ombaK0iIY","title":"Adam Back: Bitcoin Traders Learn the Hard Way. Cold Storage Wins Every Time.","duration":30},
                {"id":"8q_dEPaof-c","title":"A new tool to help kleptocrats launder both their money and their reputations? The sports industry.","duration":70},
                {"id":"EbV6CqoBM1Y","title":"looking for the best way to store your seed phrase?","duration":57},
                {"id":"PesTO9MRqJo","title":"Bitcoin and Time with Gigi","duration":6150},
                {"id":"ePx5lBSI0es","title":"Andreas Clarifies: When is Multisig the RIGHT tool to use for your bitcoin security? (January 2024)","duration":338},
                {"id":"Z_p70BzkMAs","title":"Bitcoin Protects Human Rights - Gladstein & Balaji","duration":3118},
                {"id":"7iplbbcLfJU","title":"How Does a Crypto Hardware Wallet Work?","duration":519},
                {"id":"YrKo0QGWIuY","title":"Raspberry Pi Zero Project | Cryptocurrency Hardware Wallet","duration":441},
                {"id":"kUiokNq5N1g","title":"Snowden: CBDCs Are 'Cryptofascist Currency' - A Perversion of Crypto","duration":298},
                {"id":"_EVDtos8ZgI","title":"SPARROW: Learn The BEST Bitcoin Wallet In 15 Minutes!","duration":899},
                {"id":"ril70QIDz24","title":"Bitcoin Is the Embodiment of Human Rights - Anita Posch","duration":1610},
                {"id":"iWh0lfbvdLQ","title":"Coinkite Tapsigner Recovery using a Coldcard with Sparrow Wallet","duration":943},
                {"id":"gRvJBnlNxPY","title":"Tutorial - Build Specter DIY (your own hardware wallet)","duration":1184},
                {"id":"6BSxN2cyqx8","title":"\\\"Doors to Freedom\\\" at Art Week Miami Beach","duration":143},
                {"id":"GsSnTrHSlR0","title":"Tyranny Tracker Launch Event Livestream | HRF Introduces a New Global Democracy Index","duration":9119},
                {"id":"k5h7A7kRM8Y","title":"How to make a 24 word Bitcoin seed phrase with 256 coins","duration":236},
                {"id":"UNt_tC9kId8","title":"Take Self-Custody of Bitcoin Off the Exchange in Minutes! Blockstream Jade Plus Setup","duration":71},
                {"id":"gwABJO-kaM8","title":"Buying Bitcoin Using Dollar Cost Averaging & Avoiding Dust UTXO - Self Custody Series - Feb 2024","duration":390},
                {"id":"JaWC0FBS6M0","title":"How to Use Specter Wallet for Bitcoin Multi Sig","duration":1719},
                {"id":"_w4hgpCdr4M","title":"Bitcoin Lightning Payments From Cold Storage? Jade Plus is the First Hardware Wallet To Do It","duration":45},
                {"id":"eWbBnqRcIo0","title":"Attack Vectors in Real Life: Being your own Bitcoin Bank","duration":1747},
                {"id":"gp2PdFuY2-I","title":"If Someone Steals Your Hardware Wallet, Can They Get Your Bitcoin?","duration":82},
                {"id":"mVgPoQrbi7A","title":"Verifying Dice Roll Seed Generation with the SeedSigner, Coldcard, & Keystone","duration":840},
                {"id":"iWpeSs4yWZ8","title":"THESE CELEBRITIES Might Be Arrested for Promoting Cryptocurrency? - Get Based TV","duration":61},
                {"id":"fSgsYDD2ob4","title":"Alex Gladstein - The Role of Bitcoin for Human Rights","duration":1698},
                {"id":"I1uefzJJ6nM","title":"Bitcoin 101 - Intro to Paper Wallets & Cold Storage - Bitcoin Security & Fun with Sloppy Wallets","duration":1617},
                {"id":"Bg0r0DQVcDg","title":"Key Teleport","duration":267},
                {"id":"r3f6liCAXzA","title":"Alex Gladstein: Bitcoin, Freedom & Human Rights","duration":3566},
                {"id":"XWfTyGpNXxM","title":"A Treatise on Metal Bitcoin Seed Storage Design","duration":1777},
                {"id":"YKTLZcfaL4A","title":"BR094: COLDCARD KeyTeleport, Harbor, Ark, AI Code, Trezor Vuln, Coinbase Phishing +MORE ft Rob, Paul","duration":5329},
                {"id":"qr3TGnsB6YI","title":"OLD GUIDE- NEW GUIDE LINK IN VIDEO How To Use Specter Wallet","duration":434},
                {"id":"tlQGO-Na7Io","title":"How to Transfer Your Bitcoin from Ledger to Coldcard","duration":1523},
                {"id":"uSa6UW5iCEU","title":"Tyranny Tracker Launch Event | HRF Introduces a New Global Democracy Index","duration":174},
                {"id":"f-8elm8xCLs","title":"Using An Old Phone As A Hardware Wallet","duration":1710},
                {"id":"dO9SvaZ4wz0","title":"COLDCARD MK5 First Look: Reincarnated!","duration":1662},
                {"id":"R7Z3IF5AgJI","title":"Whitney Webb's Urgent Warning to the Bitcoin Community - Get Based TV","duration":881},
                {"id":"n_bU0bSJglw","title":"Don’t Lose Your Bitcoin Generational Wealth | BTC Sessions","duration":4336},
                {"id":"6zRIE8ScGOM","title":"Bitkey Cold Storage from Jack Dorsey’s Block: Self Custody with No Seed Phrase #partner","duration":29},
                {"id":"yzJ9bRFkwmo","title":"How To Make A DIY Cold Storage Bitcoin Wallet","duration":1261},
                {"id":"qLCt4RFmtNQ","title":"DIY Bitcoin Cold Storage | How to Build and Use a SeedSigner","duration":1466},
                {"id":"9O1u-NyQpI0","title":"Why Financial Freedom Matters - Alex Gladstein","duration":1602},
                {"id":"pWmgu5eA4y4","title":"Evil RBFer Scenario Walkthrough using Sparrow Wallet","duration":783},
                {"id":"iAdmvl3Z_cM","title":"Clone Hardware Wallets. Same Seed on Multiple Devices (Trezor, Ledger, Keepkey, Coldcard, SafePal)","duration":357},
                {"id":"xfHeUFCk4hY","title":"Secure Notes","duration":173},
                {"id":"XVSrPznq8ZU","title":"Bitcoin Against Autocracy: A Modern Tool for Freedom - The Bitcoin Layer","duration":1042},
                {"id":"7C2yroJgkqM","title":"This New Bitcoin Wallet Is Almost IMPOSSIBLE To Hack (Coldcard Mk5 Just Dropped)","duration":32},
                {"id":"RLxi0jU-AXE","title":"Bitcoin Self Custody: Passphrases","duration":1937},
                {"id":"ETo64Er7RiA","title":"Running LLMs Locally for Human Rights","duration":1267},
                {"id":"4TY2qze4Uos","title":"2025 Freedom Fellowship Working Retreat","duration":96},
                {"id":"qKxDcK_2Uhg","title":"COLDCARD Spending Policy #bitcoin #selfcustody","duration":40},
                {"id":"pRc2VM16aEU","title":"I Turned My Bitcoin Seed Phrase Into a QR Code","duration":62},
                {"id":"d5_cYWLpDs8","title":"A Brief Look at Bitcoin Maximalism - Guy Swann","duration":1664},
                {"id":"xQXuc8v-LdQ","title":"Traveling With Bitcoin? Blockstream Jade Is the Only Hardware Wallet to Carry","duration":21},
                {"id":"dKDnkf6c250","title":"Why Sell Your House for Bitcoin? - Breedlove Defense","duration":629},
                {"id":"l3VjHwheLX8","title":"Assembling Coldcard Mk4 3D printed battery case from BeansBulletsBTC","duration":126},
                {"id":"b3nk4bj4vEA","title":"Bitcoin Seed Phrase Metal Backup Comparison & Demonstration","duration":1567},
                {"id":"H-fQ7i8q5C8","title":"Edward Snowden On Bitcoin","duration":1723},
                {"id":"6QiDB-RwGGw","title":"Best Countries for Digital Nomads","duration":821}
            ]
        },
        {
            "id": "health-fitness",
            "name": "Health & Fitness",
            "emoji": "💪",
            "desc": "Bitcoin mindset, carnivore & low time preference",
            "color": "#16a34a",
            "videos": [
                {"id":"BQCOJlFXvpU","title":"The Carnivore Diet & Bitcoin - Dr. Shawn Baker","duration":6389},
                {"id":"c9D8p1kG0Cc","title":"Bitcoin and Health with Jeff Booth","duration":632},
                {"id":"jn8uc92Oymo","title":"Bitcoin Is Transforming Health & Energy Access Globally","duration":3862},
                {"id":"pm7Ff5viURM","title":"Jeff Booth Reveals How Much Bitcoin You Need!","duration":615},
                {"id":"Pvmp0L5cbl8","title":"Iron Sharpens Iron - Proof of Work Fitness","duration":90},
                {"id":"iW419hInhHw","title":"The Beef Initiative with Texas Slim (What is Money)","duration":3107},
                {"id":"LjCRWwm0Xdk","title":"Bitcoin Health Stack - Mind Body Sats","duration":1667},
                {"id":"rQZLFNkh0W8","title":"Dr. Anthony Chaffee on The Future Of Farming","duration":4982},
                {"id":"Dv8q_gOUcJo","title":"Becoming a Sovereign Individual via Food & the Beef Initiative - Texas Slim","duration":3828},
                {"id":"6kEyLJMILU0","title":"Texas Slim: Saving The American Rancher - The Crisis In The Beef Industry","duration":6099},
                {"id":"FJB7e8PP0wU","title":"Proof Of Work(out) - July 2022","duration":148},
                {"id":"xn9WtVYy1gU","title":"Bitcoin Will FIX Our Food System - Here's How! w/ Texas Slim","duration":8826},
                {"id":"ohR7EIby7yY","title":"Texas Slim: Truth Behind The War on Beef","duration":562},
                {"id":"mVMU1AFiSV0","title":"Low Time Preference, Bitcoin and Health","duration":1594},
                {"id":"iAEgMhq_FJs","title":"Starting & Scaling a Successful Regenerative Ranching Business","duration":6991},
                {"id":"JTDVwPdvu3E","title":"Why We Need Our Farmers, and Our Farmers Need US","duration":4976},
                {"id":"Rm5_wCObeQI","title":"Carnivore Diet, Health Care Crisis & Bitcoin","duration":4917},
                {"id":"hL54mn7vW8w","title":"Surf, Eat Meat, Repeat - Bitcoin Lifestyle","duration":2959},
                {"id":"TWkKPijaDyQ","title":"Proof of Work Ep2: Fitness and Bitcoin","duration":4184},
                {"id":"lhHKljqRa-M","title":"Low Time Preference Lifestyle - Bitcoin Way","duration":3142},
                {"id":"rwP_ggwOqTg","title":"EMBRACE Deflation With Bitcoin! Guest Jeff Booth","duration":3891},
                {"id":"vpEq89vPNHc","title":"Jeff Booth on What if Everything We Know About Free Markets is Wrong?","duration":3835},
                {"id":"KfNkDQ-NI9U","title":"Shawn Baker, the Carnivore MD","duration":6617},
                {"id":"i8Nq2pcNp60","title":"Texas Slim & Jake Wolki: Beef Initiative & Industrial Food Complex","duration":3326},
                {"id":"W4OQaqqFKj0","title":"Proof of Work Ep1: Fitness and Bitcoin","duration":2872},
                {"id":"TBd8GGKgRWo","title":"Carnivore Legends Explain the Importance of Local Farms and Red Meat","duration":724},
                {"id":"cthDKq4SEqk","title":"From Unhealth to Health - The Meat Mafia","duration":1826},
                {"id":"CT8yuKUQ_No","title":"Low Time Preference Aging - P.D. Mangan","duration":7216},
                {"id":"urKG9oi0krc","title":"Exit The Matrix - Buy BTC Eat Meat","duration":7180},
                {"id":"O3jeBF7S9ss","title":"Treadmill, Chat, and Bitcoin","duration":2444}
            ]
        },
        {
            "id": "history",
            "name": "History & Documentaries",
            "emoji": "📜",
            "desc": "Bitcoin's past — origins, cypherpunks, mainstream films",
            "color": "#92400e",
            "videos": [
                {"id":"4_4lFX8t3I8","title":"Evolution of Cryptocurrency: 1983-2100","duration":488},
                {"id":"hk3OLML16xY","title":"History of Bitcoin: 16 Year Anniversary","duration":611},
                {"id":"4hWMHLF-OEg","title":"Inside Peru's Hidden Bitcoin Revolution - Get Based TV (Full Movie)","duration":2379},
                {"id":"oEgPTIN5hVE","title":"How Bitcoin Started: The Untold Story of Satoshi (Full Documentary)","duration":833},
                {"id":"tdxY61IJ24E","title":"Bitcoin: Who is Satoshi Nakamoto? - An Investigation","duration":3183},
                {"id":"eoBmOf4GDyo","title":"Arrivano i Cypherpunk - History","duration":1000},
                {"id":"f39jflibxH4","title":"Oppenheimer vs Nakamoto","duration":590},
                {"id":"xw9VshkgxJ4","title":"The Great Reset and the Rise of Bitcoin | Award Winning Documentary","duration":4668},
                {"id":"tWU3O3X5kKE","title":"The Story behind Bitcoin Pizza Day","duration":119},
                {"id":"d9DqvX7CJOc","title":"The Fiat Standard: Can Bitcoin Fix This? - Saifedean","duration":5592},
                {"id":"gcwnpvODd-8","title":"The Rise and Rise of Bitcoin | Official Trailer","duration":143},
                {"id":"q7CgCdwJCqU","title":"Hal Finney's contributions to Bitcoin","duration":41},
                {"id":"QTyzyP2Afys","title":"Cryptocurrencies - The Future of Money? (DW Documentary)","duration":2547},
                {"id":"vjGhiac85h4","title":"The History of Crypto Goes Further Back Than You Think","duration":603},
                {"id":"pbFEexyOwkw","title":"Bitcoin History: From Zero to Hero","duration":793},
                {"id":"ao9SdxPtuIE","title":"Satoshi Nakamoto & The Origins of Bitcoin","duration":167},
                {"id":"LSvOFKf9okk","title":"Secret Monetary System Explained - Mike Maloney","duration":1289},
                {"id":"GZI0qo3diUo","title":"Unlocking Crypto - The Bitcoin Field Guide","duration":6500},
                {"id":"S70MSDaLAKw","title":"Why Bitcoin's Creator Disappeared Forever","duration":1379},
                {"id":"f-4Rs3Sqlhc","title":"History of Bitcoin - Complete Timeline","duration":602},
                {"id":"3Cr1efEBo_M","title":"INSIDE SILK ROAD: The Billion-Dollar Dark Web Drug Empire","duration":654},
                {"id":"jsccmbOT6FU","title":"Biggest Bitcoin Holders 2024","duration":228},
                {"id":"7RlaC9ZJNtA","title":"Unmasking the Creator of Bitcoin","duration":3198},
                {"id":"iSF0KGsFuI8","title":"Money Electric: The Bitcoin Mystery | HBO Trailer","duration":160},
                {"id":"GTdCeFyBVyk","title":"Historical Bitcoin UTXO Set Animation (2 Minute Version)","duration":106},
                {"id":"M1JKLXxFDZc","title":"Unconditional Advice for the Next Decade - Saifedean Ammous","duration":1283},
                {"id":"3Rnqst5qCgA","title":"Bitcoin is Generational Wealth - A Short Film","duration":883},
                {"id":"kyija0bPeIY","title":"Behind Silk Road: How Ross Ulbricht Brought Black Market to the Web (Full Doc)","duration":3263},
                {"id":"DyV0OfU3-FU","title":"Satoshi Nakamoto - The Hidden History","duration":1556},
                {"id":"9vM0oIEhMag","title":"Cypherpunks Write Code - ReasonTV","duration":2635},
                {"id":"3XEuqixD2Zg","title":"God Bless Bitcoin - Full Documentary","duration":5359},
                {"id":"IFVrVI4rZHM","title":"What Happened To Bitcoin's Founder?","duration":624},
                {"id":"tPYYbIH372Y","title":"Bitcoin: History of \"Wholecoins\" (Outputs Worth Exactly 1 BTC)","duration":102},
                {"id":"3n_WnVPhRTo","title":"The Satoshi Nakamoto Enigma","duration":384},
                {"id":"2TNhojuAxMI","title":"Magic Money: The Bitcoin Revolution","duration":3302},
                {"id":"9cb94OuCR9U","title":"The Alleged CIA Connection to Bitcoin's Mysterious Origin","duration":498},
                {"id":"o-c_j2tgxDU","title":"What's REALLY Wrong with HBO's Bitcoin Documentary","duration":304},
                {"id":"h3nlVsy81wI","title":"The Bitcoin Mystery Revealed! - Swan","duration":584},
                {"id":"phtHSjSrsJ8","title":"What is Bitcoin's UNTOLD History?","duration":927},
                {"id":"H1oc5HKixBg","title":"The Bitcoin Full Node Sculpture 4.0 - A Cypherpunk Chronometer","duration":60},
                {"id":"M7ZLNczMeS0","title":"Deep Web: The Untold Story of Bitcoin and the Silk Road","duration":5183},
                {"id":"Yh1dOmQJoWQ","title":"The Rise and Rise of Bitcoin (FULL)","duration":5796},
                {"id":"b-7dMVcVWgc","title":"\\\"This Machine Greens\\\" - Bitcoin Documentary - Online Premiere","duration":2285},
                {"id":"gsuMfKA7wFg","title":"Bitcoin is Beautiful | a Short Film by Tomer Strolight","duration":329},
                {"id":"DomSK_oUGr4","title":"History of Bitcoin: 15 Year Anniversary","duration":579},
                {"id":"HDKQulqVCQg","title":"Bitcoin and the End of History","duration":956},
                {"id":"yt4L67C5_q8","title":"Historical Price of 1 USD in Terms of Bitcoin (11/12/24 Update)","duration":87},
                {"id":"Fx0OcKcLQ0A","title":"Bitcoin's Creator Unveiled? Theories about Satoshi Nakamoto","duration":1826},
                {"id":"wzJLuEU8ejo","title":"FULL MOVIE: The Legendary Treasure of Satoshi Nakamoto","duration":5400},
                {"id":"_0axyH2X6mI","title":"Morgan Spurlock Living with Bitcoin 2015. The Future of Bitcoin","duration":2516},
                {"id":"m7_WDzPyoqU","title":"I Live 500 Feet From a Bitcoin Mine - Investigative Doc","duration":1270},
                {"id":"chcASJW1pMs","title":"Satoshi Nakamoto - The Beginning of Bitcoin Documentary","duration":5021},
                {"id":"0r6zMdHcpW0","title":"Was Bitcoin a CIA Project? The Hidden Origins of Satoshi","duration":10222},
                {"id":"W03SVhhOaEU","title":"The Bitcoin Full Node Sculpture 7.0 - A Cypherpunk Chronometer (MirrorNode)","duration":53},
                {"id":"0rlnVQoiVyc","title":"History of Bitcoin w/ Marty Bent","duration":5039},
                {"id":"DGNhX8nz7Eg","title":"Seeking Satoshi - The Mystery Bitcoin Creator (Part 2)","duration":2884},
                {"id":"XzSFu7aMCu8","title":"Truth About Satoshi Nakamoto - Complete Documentary","duration":356},
                {"id":"KjMQvN7Fajs","title":"Who Created Bitcoin? The Mystery of Satoshi Nakamoto","duration":978},
                {"id":"4_tAOuMVFd0","title":"Digital Gold - Full Documentary","duration":3551},
                {"id":"oksraL7wN6Q","title":"God Bless Bitcoin - HD Version","duration":5352},
                {"id":"lFw-3wynj-o","title":"Adam Back is Satoshi Nakamoto - Hoskinson & Lex Fridman","duration":228},
                {"id":"Cw29h7LhEuE","title":"Bitcoin Update - just buy $1 worth of bitcoin please!","duration":384},
                {"id":"OH-xRaHdqy4","title":"Japan Bitcoin Documentary - Why One Tokyo Company Is Changing Finance","duration":2326},
                {"id":"LjNMgeqUgks","title":"The Man Who Spent Millions of Bitcoin on Pizza - 60 Minutes","duration":42},
                {"id":"BoboO6QPGow","title":"Satoshi Nakamoto Goes Public and Denies He's Bitcoin Founder","duration":79},
                {"id":"SlbyHzYZXjA","title":"FBI Agent Explains Silk Road","duration":421},
                {"id":"N4m86PL4qs8","title":"Bitcoin: History of \"X-coins\" (Outputs Worth Exactly 10 BTC)","duration":109},
                {"id":"gQ8XKns2ipc","title":"The Satoshi Mystery: Origins of Bitcoin","duration":3191},
                {"id":"fsfoqdqyykI","title":"The Most Illegal Business In The World: Silk Road","duration":2672},
                {"id":"Mcz_4MvPlOE","title":"Cypherpunks & Bitcoin: End of History","duration":956},
                {"id":"GpMP6Nh3FvU","title":"The Dark Side Of The Silk Road","duration":4485},
                {"id":"Bze53qwHS8o","title":"Mystery Founder of Bitcoin: Uncovering Satoshi Nakamoto - CNBC","duration":395},
                {"id":"b1ruW89S4PM","title":"Satoshi Nakamoto: The Mysterious Genius Behind Bitcoin","duration":709},
                {"id":"NAg_rJ8mfVs","title":"The Government Hates Him - The Ross Ulbricht Story","duration":554},
                {"id":"iVym9wtopqs","title":"Banking on Bitcoin - Full Documentary","duration":5367},
                {"id":"Peih23WVK54","title":"Dark Web King: From Student to Billionaire Drug Lord - Ross Ulbricht","duration":1511},
                {"id":"ZKwqNgG-Sv4","title":"Bitcoin: The End of Money As We Know It","duration":1471},
                {"id":"hzPSxy55MPE","title":"Bitcoin: History of \"M-coins\" (Outputs Worth Exactly 1,000 BTC)","duration":106},
                {"id":"4yFjOoDp6zY","title":"Bitcoin: History of \"Pi-coins\" (Outputs Worth Exactly 3.14 BTC or 3.14159265 BTC)","duration":104},
                {"id":"dMSv4mgiy1o","title":"How Bitcoin's Early Cypherpunks Paved the Way","duration":473},
                {"id":"ecy7lLjDK6s","title":"Bitcoin: History of \"L-coins\" (Outputs Worth Exactly 50 BTC)","duration":109},
                {"id":"eRzb4vEneHA","title":"Historical Bitcoin UTXO Set Animation (4 Hour Version)","duration":14711},
                {"id":"mgmVEtSgu3o","title":"Bitcoin FUD - Full Documentary","duration":3592},
                {"id":"_Kav2K1DVWo","title":"The Most Elusive Identity On The Internet (ft. Nexpo)","duration":1802},
                {"id":"FwWU1W7IGbY","title":"Seeking Satoshi - The Mystery Bitcoin Creator (Part 1)","duration":3353},
                {"id":"wSh_KzcY_dA","title":"60 Minutes: Stories About Cryptocurrency - CBS","duration":4000},
                {"id":"F5AiHEzu-uc","title":"Who is Satoshi Nakamoto? The True Story of Bitcoin's Creator","duration":78},
                {"id":"8Z4hGvUET8I","title":"Bitcoin: Beyond The Bubble","duration":2086},
                {"id":"4d4OE7D2hqA","title":"Bitcoin: History of \"D-coins\" (Outputs Worth Exactly 500 BTC)","duration":107},
                {"id":"EcYnz29l8_0","title":"Who ACTUALLY Created Bitcoin","duration":767}
            ]
        },
        {
            "id": "kids-family",
            "name": "Kids & Family",
            "emoji": "👶",
            "desc": "Bitcoin explained for young audiences",
            "color": "#f472b6",
            "videos": [
                {"id":"Bv9LCSMEgGQ","title":"BITCOIN EXPLAINED FOR KIDS","duration":122},
                {"id":"h4AsgigwgmY","title":"Why Were Seashells Used As Money? | Tuttle Twins","duration":171},
                {"id":"51ythXeqw40","title":"The SECRET TAX of inflation?","duration":61},
                {"id":"OmcUAOv9jAg","title":"The Gold Standard Explained | Tuttle Twins","duration":314},
                {"id":"-VVJsoYZwcE","title":"Can Charity Do More Harm Than Good? | Tuttle Twins |","duration":285},
                {"id":"YDH1Ca4TnkM","title":"Inflation doesn’t just happen randomly…#tuttletwins","duration":45},
                {"id":"dAujdH8Iwcg","title":"Bitcoin Explained for Kids & Beginners - Digital Money Made Easy","duration":159},
                {"id":"Q-GZ1K1FjsI","title":"Fridgetopia & the Federal Freezerve | Tuttle Twins","duration":453},
                {"id":"-PYYhxLk38g","title":"SHAmory with Scott and Mallory Sibley #bitcoin #money #crypto #cryptocurrency","duration":2865},
                {"id":"gS05vIvAW9I","title":"Dollars or Bitcoin? Which One is Better? - Economics Explained (Tuttle Twins)","duration":419},
                {"id":"Z3xdGIyIV54","title":"How to Explain Bitcoin to Children - Dad & Daughter","duration":513},
                {"id":"auIOUn0ubDk","title":"What is Inflation? Explained for Kids (The Invisible Money Nibbler!)","duration":287},
                {"id":"gf41D0SVNWk","title":"Building a Family Bitcoin Business - Pablo & Michael (Panties For Bitcoin) - #021","duration":2654},
                {"id":"Z-qP41O-NxY","title":"The Lesson on SOCIALISM School Didn't Teach You - Tuttle Twins Full Episode","duration":1399},
                {"id":"agUawDBjwv4","title":"Investing In Crypto For Your Kids - Should You?","duration":81},
                {"id":"F4vEKLqf_K4","title":"When Innovation Destroys Jobs… and Creates Even More | Tuttle Twins Meet Henry Ford","duration":408},
                {"id":"wgU-Xou0xYM","title":"Tiny Economists Ep. 3 - What Is Money?","duration":247},
                {"id":"vPMDpb9ho4s","title":"Blockchain for Kids - Blockchain Explained for Beginners","duration":163},
                {"id":"_jk_1LSH6rI","title":"Building a Family Bitcoin Business - Pablo & Michael (Panties For Bitcoin) - 021","duration":2654},
                {"id":"B-IpiKURs3I","title":"1 Hour Tuttle Twins Compilation","duration":3969},
                {"id":"bDcGUxS9DHw","title":"Tuttle Twins S1E9 - Full Episode (Fate of the Future)","duration":1275},
                {"id":"MdC_0X71n88","title":"Scott Sibley  - SHAmory Bitcoin Card Game","duration":2164},
                {"id":"qyCXpr-ZDhE","title":"What are Taxes? Simple Explanation for Teens and Beginners","duration":129},
                {"id":"61G4YhJsSNo","title":"What is BITCOIN - Bitcoin Explained to Kids, Teens and Adults","duration":837},
                {"id":"3fjKKApmAKM","title":"Alternative Education Meets Global Bitcoin Adventures - Michael From Trailblazer Academy - #011","duration":3746},
                {"id":"zY_T-FNDgaM","title":"EP92: Bitcoin Karma with Scott, Mallory and Charlotte Sibley","duration":2671},
                {"id":"mwSAuNb44lU","title":"How Money Works Explained in One Minute","duration":71},
                {"id":"zJHeIJGVCKI","title":"How War Makes Millionaires?! - Economics Explained","duration":274},
                {"id":"3nwprNzztQE","title":"Bitcoin Explained for Kids & Teens (Parents: Show This to Your Kids!)","duration":371},
                {"id":"lDNem8PxfT8","title":"Equity vs. Equality - Meet Thomas Sowell | Tuttle Twins","duration":324},
                {"id":"9CchpWy29es","title":"Investing & Stocks - Cash Course (PragerU Kids)","duration":365},
                {"id":"RzjCvabZ4QU","title":"Why are Entry Level Workers Losing Jobs? - Tuttle Twins","duration":323},
                {"id":"9WJgukEL168","title":"Hockey, Homeschooling, and Bitcoin - Brandon Gentile - #009","duration":5295},
                {"id":"rT4ThQ55SD8","title":"Who Invented Bitcoin? (for kids)","duration":229},
                {"id":"FtaUelnAXrc","title":"Tuttle Twins S1E6 - Full Episode (Regulation Station)","duration":1434},
                {"id":"t0ZAXwV1CI8","title":"Cryptocurrency Explained For Kids","duration":324},
                {"id":"9ymZlz2l53I","title":"What is Bitcoin? For Kids and Teens","duration":107},
                {"id":"aRcXutXvfmM","title":"Financial Literacy - Needs and Wants (Opportunity Costs)","duration":278},
                {"id":"0SDCdQcnKuQ","title":"What Everyone Should Know About College - Tuttle Twins Full Episode","duration":1399},
                {"id":"xTX-RRemYJU","title":"How Bad Money Makes Us Think Short-Term | Tuttle Twins","duration":467},
                {"id":"BL5vUVQvmX4","title":"What is Bitcoin? Explained in 3 Minutes - Tuttle Twins","duration":186},
                {"id":"XNu5ppFZbHo","title":"What Gives a Dollar Bill Its Value? - TED-Ed","duration":232},
                {"id":"LuboVKBFnl0","title":"When Money Is Controlled, Money Is Corrupted - Full Song (Tuttle Twins)","duration":159},
                {"id":"Iyq4khMiM9A","title":"Saving vs Investing for Kids - Types of Investments Explained!","duration":151},
                {"id":"tAbeAZJQLYE","title":"How Equity Failed \\\"The Fellowship of the Championship Ring\\\" - Tuttle Twins","duration":576},
                {"id":"aHVuaASswgA","title":"The Truth About CBDCs (Central Bank Digital Currencies) - Economics Explained","duration":334},
                {"id":"jv1O3IXoV4k","title":"Sneak Peek Tuttle Twins Season 4!","duration":138},
                {"id":"X4uFSUpiifE","title":"Raising a Bilingual Bitcoin Family in NYC - Umi Miyahara - #016","duration":3040},
                {"id":"qVGWCJJcDXM","title":"60 Minutes Tuttle Twins - Wholesome Cartoon Compilation for Family","duration":3627},
                {"id":"cv7SRW_kYLk","title":"How to Teach Kids Where Money Comes From (5 Different Places)","duration":438},
                {"id":"lV9aSAIVYok","title":"Kids Finance - Inflation Explained","duration":67},
                {"id":"ikVMo6-lf3M","title":"Hockey, Homeschooling, and Bitcoin - Brandon Gentile - 009","duration":5295},
                {"id":"qnyqQvIii0U","title":"Cryptocurrency Explained for Kids & Beginners","duration":141},
                {"id":"tQ1_8M1K0tM","title":"Cryptocurrency Explained to Kids - Twins","duration":1268},
                {"id":"7olIXRL79sw","title":"Scott Sibley: Our Kids will pay EVERYTHING in Bitcoin!","duration":3332},
                {"id":"V-TeANzcKAA","title":"Bee Money | Teen Titans Go! | Cartoon Network","duration":125},
                {"id":"Td32UyXW9HE","title":"How to Teach a Kid About Bitcoin (and Money)","duration":2656},
                {"id":"XIehKAjwCsw","title":"Scott Sibley of SHAmory - A Card Game For Bitcoin Mass Adoption","duration":2343},
                {"id":"fTTGALaRZoc","title":"Banking Explained - Money and Credit","duration":370},
                {"id":"uRU4ifbGolg","title":"Tuttle Twins S1E7 - Full Episode (The Miraculous Pencil)","duration":1295},
                {"id":"jcu3hsaLO0Q","title":"Tuttle Twins S1E12 - Full Episode (Season Finale)","duration":1614},
                {"id":"Aul03GabnhY","title":"What happens when money isn’t backed by anything? #goldstandard","duration":76},
                {"id":"DuR0KMBefj0","title":"Tuttle Twins S2E2 - Don't Trash Success (Full Episode)","duration":2827},
                {"id":"hSZyUI6rbC8","title":"A Bitcoin Bash & Corrupted Cash - Full Episode (Tuttle Twins)","duration":1345},
                {"id":"YR50A20lNzo","title":"Bitcoin's Family Revolution - Seb Bunney - #018","duration":4333},
                {"id":"Bwc46DAEGcA","title":"Fun Ways to Teach Kids About Bitcoin","duration":3695},
                {"id":"PwPoT5Adc6M","title":"STEM Meets Bitcoin: Fun, Educational Tools for Kids - Scott Sibley","duration":1702},
                {"id":"94I9L90h0_s","title":"What is Cryptocurrency? - Kid-Friendly","duration":117},
                {"id":"iy3n39Gnlpw","title":"Tuttle Twins S1E5 - Full Episode (The Golden Rule)","duration":1466},
                {"id":"EfKuZayeksI","title":"Bitcoin for Kids - Simple Explanation","duration":692},
                {"id":"9NZTMmVBfK4","title":"What My Kids Think of Bitcoin","duration":271},
                {"id":"BIh5OyZiHgA","title":"Teach Your Kids About Bitcoin With This Card Game! (BWP117)","duration":2199},
                {"id":"RqJOqyzOmjw","title":"Understanding Inflation - The Basics Explained (It's a Money Thing)","duration":198},
                {"id":"IHVVVaMY10c","title":"“When money is controlled, money is corrupted!” #tuttletwins","duration":39},
                {"id":"xvo_m_r2ubg","title":"What is Bitcoin? Simple Explanation for Teens & Beginners","duration":203},
                {"id":"3I81-P_lwvw","title":"What is Inflation for Kids - Financial Education","duration":341},
                {"id":"T83mK4jj2NE","title":"FF-140: Scott Sibley on teaching Bitcoin to children and raising kids today","duration":2800},
                {"id":"J7mMQ3ERNdg","title":"Tuttle Twins S1E11 - Full Episode (No Free Lunch)","duration":1337},
                {"id":"DQhF_4J2GKo","title":"What is Cryptocurrency? Learn with Jess - STEM Kids Clubhouse","duration":704},
                {"id":"o-PNlhhVhZ8","title":"Hyperinflation Explained in One Minute","duration":71},
                {"id":"4FUJHRihK1o","title":"Bitcoin's Family Revolution - Seb Bunney - 018","duration":4333},
                {"id":"_ekzsZZGfsk","title":"First Kids Cartoon about Bitcoin!","duration":3501},
                {"id":"Y9RdoOBVmbI","title":"Is School Failing You? - Albert Einstein (Tuttle Twins)","duration":228},
                {"id":"nqdv6Ad9Nt4","title":"What is Bitcoin? (for kids)","duration":221},
                {"id":"O3Vf2m-DIh0","title":"When money is easy to make, society begins to break. #goldstandard","duration":50},
                {"id":"rIYfipLBp2w","title":"Isn’t it just made up money? 🤔","duration":60},
                {"id":"GZ7y-yFdX9M","title":"Who Invented Money? History of Money & Barter System - Dr Binocs Show","duration":336},
                {"id":"ZxEqoaFT73c","title":"Bitcoin Is The Evolution Of Money - My Kids Won't Know Coins!","duration":221}
            ]
        },
        {
            "id": "lightning",
            "name": "Lightning",
            "emoji": "⚡",
            "desc": "Lightning Network & Layer 2",
            "color": "#7c3aed",
            "videos": [
                {"id":"yKdK-7AtAMQ","title":"Lightning Network - How It Actually Works","duration":1277},
                {"id":"to8XItlplac","title":"Lightning Transactions & Protocol Deep Dive","duration":4636},
                {"id":"LXY0L8eeG3k","title":"Exploring the Lightning Network Daemon (lnd) 0.4 Beta Release","duration":4451},
                {"id":"Pef22g53zsg","title":"Why Lightning is the Future of Payments","duration":2678},
                {"id":"rqgRPqx2v_g","title":"Bitcoin doesn’t rely on stability, it's built to endure.","duration":239},
                {"id":"y6opPXlgG_I","title":"The Lightning Network: Business Ready Solutions with BootstrapBandit - Bitcoin Twitter Spaces Live","duration":7207},
                {"id":"9DVyI2A7MzU","title":"Lightning in a High Fee Environment with Niftynei, D++ & Nate (SLP483)","duration":5053},
                {"id":"mKNpvPuoSzw","title":"Episode 7: Lightning Network: How Bitcoin Beats the Banks","duration":287},
                {"id":"O_IX0QOr9-o","title":"Lessons from running a Lightning Network Routing Node | The Bitcoin Plebs Podcast – Episode 11","duration":4463},
                {"id":"8zQh8cvHpFM","title":"The Exit Door Is Bitcoin","duration":140},
                {"id":"XBrQ4veNyOI","title":"Masterclass su Lightning Network alla BWR23","duration":5694},
                {"id":"NchsNf7Zfp4","title":"The Mechanics of Bitcoins's Lightning Network","duration":3726},
                {"id":"39KpscRXyXY","title":"Buying Coffee Using Bitcoin - LN","duration":34},
                {"id":"GSTnvQyuXEE","title":"Setup Core Lightning And Zeus Bitcoin Wallet","duration":4473},
                {"id":"rXsRvBXbZyU","title":"Lightning Network Co-Inventor Tadge Dryja: Here Comes the Hornet's Nest - MIT Bitcoin Expo 2025","duration":1463},
                {"id":"Z9KDghxOaa8","title":"Men who can be both right and sit tight are uncommon","duration":77},
                {"id":"CG69c71aSLQ","title":"Lightning Network Explained - Easy Guide","duration":346},
                {"id":"GO3DX2ICitg","title":"Cypherpunks & Lightning Network | Alex Leishman - The Bitcoin Layer","duration":1755},
                {"id":"LRZy-VtCPe4","title":"Lightning 101: Node Profitability feat PLEBNET","duration":4092},
                {"id":"bVC4795helY","title":"Lightning payment in Malaysia Cafe","duration":43},
                {"id":"68yTli5qRTc","title":"How to Add Bitcoin Lightning Payments to Any App with the Breez SDK","duration":3771},
                {"id":"LLblHYLf9JI","title":"WHY ARE WE BULLISH? Plebnet Takeover - JC, KP, VS, Walton","duration":4847},
                {"id":"bW7hvvjum9o","title":"Lightning Network: Everything You Need To Know","duration":1271},
                {"id":"lHJ3kFbUVbM","title":"Developing Lightning Apps on LND, LN Data Models, and Concepts with Alex Bosworth","duration":3172},
                {"id":"nvfFH8hnGpc","title":"No matter what they promise, the only solution is to print.","duration":150},
                {"id":"KItleddMYFU","title":"How To Run A Bitcoin Lightning Network Node - Step By Step Tutorial","duration":4442},
                {"id":"fympoUHx2b8","title":"Creating A Custom Self-Custodial Bitcoin Lightning Address","duration":1391},
                {"id":"rrr_zPmEiME","title":"Bitcoins Lightning Network Explained","duration":334},
                {"id":"sQPKdozYhQ8","title":"Beginners Guide to Coffee LN Payments","duration":130},
                {"id":"3yQUhHdjNuc","title":"Wallet of Satoshi Made Simple: Send Bitcoin Fast, Even If You’re New!","duration":4007},
                {"id":"Dx5jRyTTFlo","title":"There will only ever be 21 million #bitcoin","duration":66},
                {"id":"sXBwRO7ML7w","title":"Wallet Of Satoshi - Simple Bitcoin Lightning Wallet","duration":1540},
                {"id":"8Iv5teYS2q8","title":"Bitcoin is the new monetary pressure valve.","duration":296},
                {"id":"3SExtDDAh2g","title":"Understanding Lightning Network with @Jestopher_BTC | Value Stack 20","duration":4525},
                {"id":"hFpZmQmQJJw","title":"The Lightning Network: Non-Custodial Mobile Wallets (Blixt, lnurl, bolt11, & bolt12) - Spaces","duration":3865},
                {"id":"tLZc-NLmV20","title":"Lightning Network Deep Dive with Laolu 'Roasbeef' Osuntokun","duration":2891},
                {"id":"GKXQiDhRy34","title":"How To Back Up A Bitcoin Wallet - Lightning Session","duration":130},
                {"id":"RQDfd86yWL0","title":"Is the United States government silently stacking bitcoin?","duration":112},
                {"id":"JpmkIvB7rDE","title":"Send From Any Exchange Direct To A Lightning Wallet - BTC Sessions","duration":136},
                {"id":"5SbpyInuIJk","title":"MUUN Bitcoin Wallet - On Chain and Lightning Combined!","duration":1295},
                {"id":"BeCGnY_aVUM","title":"Mutiny Wallet Meetup #23 2024-04-11","duration":3153},
                {"id":"69QUHgHErx0","title":"TOP Lightning Wallets in 2025 - How to Spend Bitcoin","duration":435},
                {"id":"vyDtzx_PYNk","title":"Bitcoin Lightning Wallets Compared","duration":661},
                {"id":"cuBJe1YPNNU","title":"Zapping on Nostr? Sending Satoshis Via The Lightning Network","duration":60},
                {"id":"WIhSHjDrnE4","title":"Die 5 besten Bitcoin Lightning-Wallets | Mit Jens Leinert","duration":3594},
                {"id":"qug6tCHPXtw","title":"Bitfury Lightning Coffee Machine","duration":87},
                {"id":"AYAreuNzx58","title":"Lightning Network: what is it? why should I care? what can I do with it? Enjoy bitcoin like its 2013","duration":1610},
                {"id":"IH5sbZRR-uc","title":"Design Review #37: Mutiny Wallet","duration":4273},
                {"id":"t_4b-y4T8bY","title":"How To Use A Bitcoin Lightning Wallet: Breez - BTC Sessions","duration":1118},
                {"id":"nd5fX2vHuDw","title":"ALBY - Bitcoin Lightning Payments In Your Browser","duration":2535},
                {"id":"MGNvaJyZ25A","title":"Lightning Network: Everything You Need To Know","duration":592},
                {"id":"vmafxrT8eCU","title":"Getting Started with Lightning Wallets","duration":943},
                {"id":"QVK-9wewQN4","title":"Strike Bitcoin Line Of Credit: What It Is & How I Use It","duration":1704},
                {"id":"bDzbKH5dwys","title":"Zeus Wallet Tutorial - Embedded Lightning Node","duration":1761},
                {"id":"fEPW6RXMGmA","title":"Mastering the Lightning Network with Andreas and René - Bonus Livestream Event","duration":9079},
                {"id":"x3Q9mEdelK4","title":"Understanding Aqua Wallet - Bitcoin, Lightning, and Liquid","duration":1792},
                {"id":"waGkZgldmYM","title":"What’s Your Bitcoin Strategy?","duration":51},
                {"id":"LLH2QYnyDZg","title":"Ben Carman on Lightning Privacy, Building Mutiny, and Browser-Based Lightning Wallets | E89","duration":4492},
                {"id":"7QAmlcrZD2U","title":"The Lightning Network Explained in Under 3 Minutes","duration":171},
                {"id":"ldUwf_s44Zg","title":"Bitcoin Wallets Explained - Lightning Session","duration":108},
                {"id":"TpwnoPUyumA","title":"Phoenix Wallet Tutorial - Self-Custody Lightning","duration":4158},
                {"id":"JGOzIUG2Rwk","title":"How To Get Your Bitcoin Onto The Lightning Network - BTC Sessions","duration":140},
                {"id":"OQ2o5LUgOqE","title":"Mutiny Wallet Tutorial - Bitcoin Lightning (self-custody)","duration":1312},
                {"id":"6C4Vsq1LF4o","title":"Bitcoin's Lightning Network Is EXPLODING - The Bitcoin Layer","duration":2493},
                {"id":"372FBiomA2E","title":"Get Ready: Lightning Wallet Test 2024","duration":53},
                {"id":"5qISqqGnQOc","title":"Tony Giorgio on Building Mutiny Wallet, Browsers over App Stores, and Lightning Everywhere | E115","duration":5501},
                {"id":"nYqYHgAtUho","title":"SLP412 Moritz of Alby - Making Lightning On the Web Easy","duration":3247},
                {"id":"9UIOeoBEjmw","title":"Lightning Network Explained","duration":744},
                {"id":"i4z-2v_0H1k","title":"How Lightning Network Will Change Bitcoin","duration":288},
                {"id":"_e_D5s-XQm4","title":"Citadel Dispatch E39: running a lightning routing node and plebnet","duration":4989},
                {"id":"eRRk-Y3bPX8","title":"America’s future runs on hard money: Bitcoin.","duration":146},
                {"id":"hcaBe25MCWM","title":"This COMPLETELY Changes Lightning Network…","duration":276},
                {"id":"4kBCEbCWf1s","title":"Lightning Network in Practice - Real Payments","duration":322},
                {"id":"bUbee0BUquo","title":"Mutiny Wallet - Get Started With Bitcoin","duration":3623},
                {"id":"7VyUqRyYT9w","title":"Best Lightning Network Wallet - Low BTC Transaction Fees","duration":151},
                {"id":"eHwZVZLAOl0","title":"Swan Lounge: Plebnet and the Bitcoin Lightning Network","duration":6966},
                {"id":"gkZJ1P-D0c4","title":"Paying at McDonald's with Bitcoin Lightning in Lugano","duration":57},
                {"id":"LuZ0XN3eH5I","title":"The Fatal Flaw in Bitcoin's Lightning Network? - Get Based TV","duration":805},
                {"id":"T09HtifiP9c","title":"Lightning Network: The Economics of Bitcoin's Global Payment Rails - The Bitcoin Layer","duration":2367},
                {"id":"HQXc0-B4Qvw","title":"Policy Is The Plot: Why Bitcoin Thrives In Financial Respression","duration":2960},
                {"id":"h6-WezlpXx0","title":"Lightning Network Is Layered Bitcoin - The Bitcoin Layer","duration":3126},
                {"id":"9Th5BPBVpTE","title":"Tutorial da carteira Breez para Lightning Network","duration":3730},
                {"id":"AW-7XBrSqCI","title":"Bitcoin Lightning Network Demo: Phoenix Wallet","duration":30},
                {"id":"c9hnntAwSYg","title":"Bitcoin's Lightning Network Surprises Us All!","duration":261},
                {"id":"zEeMco4KqGs","title":"Lightning Network for Beginners","duration":107},
                {"id":"T7UbakVyak0","title":"Don't let fiat fool you. The party is just getting started.","duration":140}
            ]
        },
        {
            "id": "memes-comedy",
            "name": "Memes & Comedy",
            "emoji": "😂",
            "desc": "Funny Bitcoin videos & meme compilations",
            "color": "#facc15",
            "videos": [
                {"id":"E9EkVAEpqyo","title":"Actual footage of crypto traders (Willy Wonka Crypto Boat Ride)","duration":126},
                {"id":"crSb1sHYiTI","title":"We ain’t selling our #bitcoin 🤠  #music","duration":19},
                {"id":"RM1NdTvvtvk","title":"Bitcoin Comedy Compilation","duration":614},
                {"id":"d6ham2mibiA","title":"Bitcoin Street Reactions Compilation","duration":95},
                {"id":"aTqT5TDLtT8","title":"Bitcoin History As Told By Memes","duration":340},
                {"id":"Ner16UBWdEg","title":"Bitcoin Memes That Hit Different","duration":599},
                {"id":"DV-RHmRw4O8","title":"Trying To Hold  Your Altcoin Bags","duration":7},
                {"id":"dWdFNf_zXR4","title":"When your crypto portfolio doesn't crash overnight","duration":11},
                {"id":"nOh-7SzI6gM","title":"Exit Fiat, Enter Bitcoin - A Matrix Meme","duration":162},
                {"id":"3mA_U4tYS8s","title":"Hank Finds Out About Crypto Crash","duration":70},
                {"id":"uql_VKemddY","title":"Vibing with the Fed and Bitcoin 10 Hour Loop","duration":36001},
                {"id":"jJgb5xHp8cU","title":"When You Try To Buy The Dip (Too Soon Junior!)","duration":53},
                {"id":"exRCX38tHks","title":"Giving Away Crypto or Cash! What Will The Public Take?! (Social Experiment)","duration":556},
                {"id":"jZm1GZj6eEM","title":"Asking People if They Have Invested in Cryptocurrencies","duration":306},
                {"id":"fWOOQShUUc4","title":"SpaceX Falcon Heavy Launch","duration":25},
                {"id":"E6mK2aZbuSo","title":"Recovery of a Lost Bitcoin Wallet from 2010","duration":144},
                {"id":"vH7mMhmTNKw","title":"Boomers Want Bitcoin, But They're All Missing The Point","duration":150},
                {"id":"AjFNzFaI-2c","title":"Hitler Reacts To Bitcoin Cash","duration":221},
                {"id":"BgHEOhciWcQ","title":"What Happens If You Never Buy Bitcoin?","duration":37},
                {"id":"j03aH5KQEfY","title":"The #Bitcoin #etf  didn't pump my bags!","duration":56},
                {"id":"Dg_fYjgizZA","title":"The Current Crypto Market - San Andreas Earthquake Bitcoin Crash!","duration":89},
                {"id":"TGRekmiWQMs","title":"The Crypto Market Take Your Money Like (God's Plan)","duration":17},
                {"id":"K4QFLMDOwtU","title":"We simply buy the bitcoin dip #bitcoin #crypto #housemusic #djremix","duration":20},
                {"id":"5NleuGj2czk","title":"Holding These Bags Like","duration":34},
                {"id":"jmH4S6G4TO8","title":"I had a blast DJing at the Lugano Plan B afterparty in Switzerland on the wknd 🚀 #bitcoin","duration":18},
                {"id":"a1rCk3HPW1c","title":"Dont Scare the Normies  #podcast #bitcoin #normies","duration":46},
                {"id":"UX1GIhOhkAE","title":"Me Saying Bitcoin","duration":7},
                {"id":"Zai5F2_KMjA","title":"THE END OF CRYPTO!? The crypto titanic goes down","duration":151},
                {"id":"Y8XiT5VuQAM","title":"Asking Boomers About Bitcoin [2022]","duration":51},
                {"id":"Lzl5t1Sracc","title":"Funny Bitcoin Video #3 - Classic Compilation","duration":62},
                {"id":"Bse-4rjVg2k","title":"The Game Of Cryptos - The wrath of the rightful heir (part 1)","duration":49},
                {"id":"mEqr-8-TKrA","title":"30 People Turning Down FREE Bitcoin - Mike Still","duration":254},
                {"id":"8zuAbAD5Bac","title":"You Gotta Bag? You Gotta Gym - Home Altcoin Workout","duration":61},
                {"id":"ACnFdoZ38NA","title":"Who let this guy on 🙅‍♂️ #bitcoin #crypto #dj","duration":12},
                {"id":"uoUhhwyawLg","title":"The Bitcoin Standard - Matrix Meme","duration":117},
                {"id":"-ZqQNaNcDz4","title":"Congratulations (Post Malone Bitcoin Parody) BTC All Time High 🚀","duration":146},
                {"id":"kmDzhA4UiRg","title":"Trying To Decide Which Altcoin To Buy","duration":14},
                {"id":"VEJVNaOptuo","title":"Crypto HODLers Currently Like (Fight Club Crypto Meme)","duration":44},
                {"id":"H_HZkcUP_O0","title":"Bitcoin: Explained to Different Age Groups","duration":206},
                {"id":"4KWFKRbK1pY","title":"We Got A Bitcoin Down (Bitcoin Crash March 2018)","duration":98},
                {"id":"rIx35hydpVE","title":"When you buy all time high and it dips","duration":21},
                {"id":"y1GKMmAcd2I","title":"Bitcoin Meme - Matrix","duration":93},
                {"id":"pPNBEGP9J1w","title":"Jim Cramer - I made a mistake (SVB, Signature Bank & Meta Apology) Emo Remix (Parody song)","duration":65},
                {"id":"cQIa5qDcF6k","title":"Boris Johnson SLAMMED for Bitcoin Ponzi Scheme Lie!","duration":127},
                {"id":"gIEQ0dPBOoY","title":"Trying to hodl sh!*coins like (Fast n Furious Crypto Meme)","duration":85},
                {"id":"61i2iDz7u04","title":"BITCONNECT REMIX","duration":93},
                {"id":"DBs-qkjMdXk","title":"95-Year-Old Man Reacts to Bitcoin","duration":210},
                {"id":"J_4Js-CphjU","title":"Will Your Crypto Portfolio Ever Recover?","duration":32},
                {"id":"pMmcu8RzM2M","title":"All The Way Up - Tesla Buys Bitcoin Edition (Fat Joe Crypto Parody)","duration":118},
                {"id":"NMDABNK8j_Q","title":"Funniest Crypto Memes - He Sold? Edition","duration":68},
                {"id":"EFDMum1vs7Q","title":"Pump It Up (Bitcoin Maximalist) 10 Hour Loop","duration":36057},
                {"id":"7gfBP8kPzRA","title":"The Bitcoin Song - Jay-Z Empire State of Mind Parody","duration":99},
                {"id":"UDu5LOf_E-w","title":"Bitcoin Memes Compilation","duration":323},
                {"id":"xgtZVD4rPz8","title":"#bitcoin  Lightning boost from pleb #miners  lightens the mood","duration":57},
                {"id":"UxGtkFbXY70","title":"\\\"Bitcoiners Will HATE This About Boomers Buying Bitcoin\\\" — Bob Burnett Exposes Uncomfortable Truth","duration":102},
                {"id":"WrEVpNdYkrs","title":"B.R.E.A.M. - Zhou Tonged (Wu-Tang C.R.E.A.M. Parody)","duration":154},
                {"id":"WsURYcLdBHM","title":"The 2018 Crypto Market Crash","duration":125},
                {"id":"T-Mmud_OsEM","title":"When your homie tells you he can rap.. feat. Richard Heart (Prada Prada Prada)","duration":60},
                {"id":"BgZO1ppaneg","title":"Best Crypto TikToks Compilation","duration":917},
                {"id":"OKAbZhv8LxA","title":"Gary Gensler Disses Crypto & Trump Meme Coin (Kendrick Lamar - Not Like Us - Crypto Parody)","duration":101},
                {"id":"IUJNG2w-7WQ","title":"I made a song about grown men panic selling their #Bitcoin","duration":19},
                {"id":"j4RuU_bn4Ug","title":"Trying to get your friends to buy crypto","duration":74},
                {"id":"ibr2i-IulKE","title":"They Targeted Him With The Most Twisted Bitcoin Scam","duration":126},
                {"id":"jQfowtEfbFY","title":"The greatest meme of all time","duration":1022},
                {"id":"nUUXOZAPWFQ","title":"Crypto to Heaven (Stairway to Heaven Parody)","duration":481},
                {"id":"4Ier6bkBcYI","title":"When you sell crypto and it keeps going up","duration":16},
                {"id":"t60cXhAXryM","title":"HODL - When You Check Your Crypto Portfolio Today","duration":39},
                {"id":"skhA8n8iRCc","title":"It's Too Late To Sell The Highs (Timbaland - Apologize - Crypto Crash Parody Version)","duration":140},
                {"id":"l-aVgXwnESM","title":"When Bitcoin Encounters Fiat (No.2) - Crypto Memes","duration":79},
                {"id":"BnDnEhOJpns","title":"Is Your Bitcoin Real  The Crypto Scam Epidemic EXPOSED!","duration":76},
                {"id":"lvw5XX6IQkc","title":"Sell in May (Thunderstruck Crypto Parody)","duration":296},
                {"id":"DZNUMcOGbq4","title":"All The Way Up (Bitcoin Rap Parody)","duration":149},
                {"id":"hAxfwE9Oj2g","title":"BIG BEAUTIFUL BITCOIN!","duration":164},
                {"id":"Ma4c6PYT1Ec","title":"When you sold your Bitcoin too early","duration":16},
                {"id":"Om_-M2fiNvw","title":"When You HODL Through A Bear Market","duration":60},
                {"id":"wIhTGB3wqV0","title":"Michael Saylor Meme - NO SECOND BEST","duration":46},
                {"id":"8EoxggHmWxY","title":"How to Mine Bitcoins (Classic)","duration":156},
                {"id":"GSh8Aqa3zzM","title":"Bitcoin is going to zero","duration":213},
                {"id":"08kwAmgQt0w","title":"FTX/Sam Bankman-Fried - That's a scam! (Meme song/interview drill rap remix)","duration":86},
                {"id":"qoMX9IJaiRM","title":"Bitcoin has its own DJ now 🤝 #bitcoin #housemusic #dj #crypto","duration":18}
            ]
        },
        {
            "id": "mining",
            "name": "Mining",
            "emoji": "⛏️",
            "desc": "How Bitcoin mining works",
            "color": "#ea580c",
            "videos": [
                {"id":"pXkreVWYlfA","title":"Mining Bitcoin: Mining Pool Overview & Comparison","duration":1313},
                {"id":"LBlFj8yQ-4g","title":"Get Off Zero! Governments Are Buying and Mining Bitcoin Now (Adam Back Explains Why)","duration":53},
                {"id":"3v7U7WEgxzw","title":"Stephan Livera & Whit Gibbs on Twitter Spaces: Compass Mining Discuss Delays","duration":4375},
                {"id":"y3dqhixzGVo","title":"Mining Bitcoin with pencil and paper","duration":472},
                {"id":"iQiWQAtThns","title":"Marathon Digital Portfolio Overview","duration":208},
                {"id":"Bjcn5OZwgcs","title":"Is Bitcoin Mining Still Profitable?","duration":703},
                {"id":"au7LAQ0-3NI","title":"E31: The Game Theory of Mining Stacks & Bitcoin - Twitter Spaces with Xan Ditkoff","duration":3399},
                {"id":"qyVYPHVaeO4","title":"I Turned an OLD PC into a Bitcoin Mining Rig","duration":791},
                {"id":"MOXZAjI-arY","title":"POW Summit - The Hunt for the Real Bitcoin Hashrate","duration":2121},
                {"id":"-maK8nO9vqk","title":"Bitcoin Mining Is Cleaning the Grid - Here's the Truth - The Bitcoin Layer","duration":2202},
                {"id":"yxfvEK7Nj8s","title":"Bitcoin Mining Explained in 10 Minutes","duration":935},
                {"id":"G8WWJSOoKQw","title":"Don't Fall Into the FanBoy Pessimist Dichotomy : #bitcoin mining Pools","duration":57},
                {"id":"XolVXJGhmj0","title":"Lohnt sich Bitcoin Mining mit deiner Solaranlage? So viel verdienst du wirklich! (+Anleitung)","duration":1732},
                {"id":"TVR0E6KVb-c","title":"What is a Bitcoin Miner? Disassembling an S19 While Explaining","duration":614},
                {"id":"YGkLWGM8os4","title":"UAE Immersion Facility Ribbon Cutting","duration":61},
                {"id":"t5S1Y6OopHo","title":"BEST Home Miners 2024 Guide","duration":1311},
                {"id":"uHVoG8B5e5o","title":"Why Africa’s Bitcoin Adoption Is Years Ahead of the West","duration":3117},
                {"id":"Cyf7JjpygB4","title":"How To Build a GPU Mining Rig in 2026 - PROFITABLE!!","duration":1107},
                {"id":"33i1PdSJgwA","title":"How Bitcoin Mining Actually Works, Simplified","duration":253},
                {"id":"6byhBd6FtEo","title":"Bitcoin Mining: The Unlikely Environmental Hero w/ Daniel Batten | The Culture Bit","duration":3076},
                {"id":"jw6Cm_DpERM","title":"Bitcoin Mining and Circular Economies Are Changing Africa's Future - The Bitcoin Layer","duration":1626},
                {"id":"jDDIyqHvRUY","title":"Mining BITCOIN at Home is EASY - Bitaxe Gamma","duration":1079},
                {"id":"58LrQ0Q89x0","title":"₿🛠️ Satoshi's 21 #011: Mining Basics + Stratum V2 ⛏️","duration":2880},
                {"id":"JpDxQ90jwSA","title":"Bitcoin Difficulty Adjustment (4hr Animation) [DE1 - DE414]","duration":13317},
                {"id":"hN0VH__AZSE","title":"This Thing Earns $914 PER DAY?! Here's How","duration":679},
                {"id":"A5ssDib4-jk","title":"Bitcoin: Historical Mining Difficulty & Target Hash (10/3/23 Update)","duration":97},
                {"id":"-IwS37HgNMs","title":"Lyn Alden: Bitcoin Mining Can Actually SOLVE the Energy Crisis","duration":60},
                {"id":"Uq5DQFugOv8","title":"Bitcoin Revolutionizing Renewable Energy w/ Daniel Batten (BTC225)","duration":3294},
                {"id":"kX27SWRLZuo","title":"Institutional Bitcoin Mining | Compass Spaces Recording","duration":2808},
                {"id":"11dB4qzjDwA","title":"NATION STATE BITCOIN MINING w/ Daniel Batten","duration":4698},
                {"id":"CAPp5Elrw9o","title":"Jon Invents a new #bitcoin #mining  machine the Kaboomracks X9","duration":43},
                {"id":"7AN4JSfKW8g","title":"Sovereign Wealth Fund Adoption of Bitcoin and the Death of Energy Misinformation","duration":1629},
                {"id":"-pcjgtY3Cm0","title":"The BEST explanation of bitcoin mining under 1 minute","duration":60},
                {"id":"YsYk8vyv32w","title":"The History of Bitcoin Mining","duration":786},
                {"id":"ZeVxHolNxsg","title":"Satoshi's Genius: POW + The Difficulty Adjustment","duration":578},
                {"id":"824d2vmw2a0","title":"U.S. Bitcoin Boom: 50M Users, $30B Mining & Bipartisan Momentum - The Bitcoin Layer","duration":2035},
                {"id":"4HTtZhhXiAw","title":"Bitcoin Mining Explained in 3 Minutes","duration":260},
                {"id":"CC8wQJuhP5g","title":"Compass Mining Year in Review","duration":3039},
                {"id":"MTrKwsCg9d8","title":"🔌 Gold Nugget Nerd Miner Unboxing & Setup | Start Solo Mining Bitcoin Today! 💡","duration":288},
                {"id":"sN892KuvEiw","title":"Bitcoin mining is better real estate","duration":51},
                {"id":"vOOh9CHUZQQ","title":"5 Solo Mining Projects for Your Bitaxe or Avalon Nano","duration":767},
                {"id":"Py3voZGT1To","title":"Bitcoin Mining Explained Simply - Real ASIC Miner Running at Home","duration":270},
                {"id":"JPanr1nsPA4","title":"Mining BTC in Paraguay via Hydro - MARA","duration":85},
                {"id":"UAhQoKhzzbA","title":"Marathon 200MW Mining Site Acquisition","duration":72},
                {"id":"u4XvKcJSmKM","title":"How Bitcoin Helps Create Energy Abundance","duration":1097},
                {"id":"XZFc4un1nDA","title":"The Source of Bitcoin Misinformation, Ep 449 Daniel Batten","duration":3714},
                {"id":"5Wp6lInPQv0","title":"The Cruel Reality of Bitcoin Mining - VoskCoin","duration":498},
                {"id":"meFwMSsKBw4","title":"🚨 NEW BITCOIN (hashrate) ATH 🚨","duration":58},
                {"id":"X0YBOyI8ptE","title":"BITCOIN BOILS THE OCEAN","duration":639},
                {"id":"XTb2jYYYg8Y","title":"Bitcoin Mining Difficulty & Target Hash (11/22/25 Update)","duration":113},
                {"id":"xxhPn52mdxA","title":"This Solo Bitcoin Miner Found A Block! NerdQaxe++ Unboxing & Setup","duration":1016},
                {"id":"lDafxxAgmUI","title":"MARA Granbury Facility Tour","duration":1254},
                {"id":"18QvarVLofU","title":"This Home Bitcoin Miner could Earn you 3.125 BTC! Bitaxe Gamma","duration":899},
                {"id":"ACAn_yL-Too","title":"Bitcoin Mining - Inside a Real Facility","duration":2959},
                {"id":"O9mRlrC1z2Y","title":"Fort Worth Becomes First US City to Mine Bitcoin","duration":171},
                {"id":"ZWEBRT-1ndw","title":"S17 E14: Kristian Csepcsar on Braiins & The History of Bitcoin Mining","duration":6109},
                {"id":"fRqr5wD2b8w","title":"Bitcoin Difficulty Adjustment Animation (Difficulty Epoch 414)","duration":35},
                {"id":"tEnDP6p_9rY","title":"Bitcoin Mining's Days Are Numbered - Cormint CEO","duration":2971},
                {"id":"a1aKbcSE4-E","title":"Mainstream Media Has FLIPPED on Bitcoin Mining - The Bitcoin Layer","duration":1362},
                {"id":"i4XV7Yq9GCM","title":"The Future of Bitcoin Mining: Home Miners, Pools, & Open Source Innovation - The Bitcoin Layer","duration":2888},
                {"id":"BpN8fCkExtE","title":"When Blackmailing A Drug Lord Goes Terribly Wrong (Silk Road Agent)","duration":1934},
                {"id":"ydtPKYE-0eQ","title":"$48 a day WITHOUT a Mining Rig! Crypto Passive Income","duration":482},
                {"id":"mi319LxnFYo","title":"“A New, Different, Wave of Bitcoin Adopters” (SoB#049) - Daniel Batten","duration":3118},
                {"id":"3TOvhNSOGAY","title":"The future of Bitcoin Mining with Sue Ennis and Hut8 Mining | Twitter Spaces Podcast","duration":2633},
                {"id":"rQFWgLQuGzo","title":"VoskCoin Mining Farm Numbers","duration":620},
                {"id":"dm4PljluiYM","title":"Best Bitcoin Solo Miner 2025 - Bitaxe, NerdQaxe, Avalon Compared","duration":1322},
                {"id":"LhCkVj8oQ3E","title":"What is the Bitcoin Difficulty adjustment?","duration":1100},
                {"id":"P6bulrD75R4","title":"Umbrel Bitcoin Node and Mining Pool - Tutorial & Review","duration":1496},
                {"id":"FMR1LO1rNYA","title":"Perfect BEGINNER Home Bitcoin Miner in 2026!","duration":859},
                {"id":"KpiASrjdfTE","title":"Bitcoin Difficulty Adjustment Animation (Difficulty Epoch 412)","duration":35},
                {"id":"cJo839Sg1ek","title":"The 3 BEST Home Crypto Miners Under $500","duration":831},
                {"id":"lHipE05v4jg","title":"How Bitcoin Mining Works - Complete Guide","duration":1156},
                {"id":"_lVlL0Tcybc","title":"Centralisation of mining pools","duration":32},
                {"id":"GPbpI-S7C5I","title":"This Bitcoin Mining Dashboard Changes EVERYTHING","duration":1930},
                {"id":"QpbTljF0vY8","title":"The History of Bitcoin Mining - Doc","duration":148},
                {"id":"BeDIjO-2J-c","title":"Bitcoin Difficulty Adjustment Animation (Difficulty Epoch 413)","duration":38},
                {"id":"C4Z5yoWfnAU","title":"Is Bitcoin Mining At Home Still Worth It in 2025?","duration":800},
                {"id":"mrtSAgcpack","title":"What is Bitcoin Mining for Beginners - Short and Simple","duration":126},
                {"id":"KbuOyBoTZmc","title":"How to Set Up Your New Bitaxe, Part 1/4","duration":262},
                {"id":"e4BtAMXuRKI","title":"What is Bitcoin Mining? How to Earn from Cryptocurrency Mining","duration":747},
                {"id":"T2KgXsmD10Y","title":"EP19: The State of Mining and Media w/ Colin Harper, Writer and Researcher - Luxor Technologies","duration":3132},
                {"id":"iqVuthH57wY","title":"The Evolution of Bitcoin Mining!","duration":3973},
                {"id":"Y2jx_c5dMkQ","title":"Make Millions Turning Trash Into Bitcoin | Daniel Batten","duration":1988},
                {"id":"xQ7HwJ-voME","title":"The PERFECT Mini Home Bitcoin Miner on a Budget!","duration":692},
                {"id":"S3gamO8-ZDg","title":"Bitcoin: Historical Mining Difficulty & Target Hash (1/30/25 Update)","duration":106},
                {"id":"Ci8EXSy606Q","title":"Why Environmental Investors Are Reconsidering Bitcoin? - Daniel Batten (Ep 165)","duration":2835},
                {"id":"2hFvQhMRnc4","title":"Bitcoin Proof of Work","duration":1280},
                {"id":"cx0E2ICJXLY","title":"Is Bitcoin Mining Worth It In 2025??","duration":891},
                {"id":"sw_zmtCKGeQ","title":"Antminer S19j Pro Hashboard Repair - Bitcoin ASIC Miner Repair LIVE - 017","duration":6434},
                {"id":"cmTrCoJKoig","title":"Bitcoin Node From Scratch - Ubuntu + Bitcoin Knots + Solo Mining","duration":6128},
                {"id":"rYAFyFsN5UE","title":"My mini Bitcoin USB miner setup explained for solo mining Bitcoin","duration":659},
                {"id":"L67es0ydJjE","title":"Bitaxe Solo Mining Difficulty Explained","duration":507},
                {"id":"oxzMkDLO8BY","title":"How Bitcoin Will Unlock $65 Trillion: Daniel Batten","duration":2716},
                {"id":"7Wy1ZCjil_8","title":"I Spent 500+ Hours Researching Bitcoin and Made a Shocking Discovery","duration":4749},
                {"id":"9krNJvpGpfk","title":"Vented Gas vs Flare Gas Bitcoin Mining Explained w/ Daniel Batten","duration":2283},
                {"id":"ck6vBhC35jY","title":"Das kleinste Crypto Mining Rig für zuhause | DIY","duration":473},
                {"id":"gDhoS-cZfU4","title":"Bitcoin Difficulty Adjustment Animation (Difficulty Epoch 415)","duration":104},
                {"id":"xr-uMjNa6m4","title":"Antminer S19j Pro \\\"0 ASIC\\\" Repair - Bitcoin ASIC Miner Repair LIVE - 022","duration":10290},
                {"id":"EizVwqRbDSE","title":"Bitcoin Mining's Energy Problem & ESG Panel from Future Blockchain Summit","duration":1862},
                {"id":"EscTYW3GWeQ","title":"Mining for an Abundant Future – Beau Turner, Troy Cross w/ Daniel Batten","duration":1820},
                {"id":"DMfv8S8ffKA","title":"Bitcoin Mining - Bloomberg Animated Explainer","duration":51},
                {"id":"q7c00PE7khk","title":"How To Set Up a Bitaxe To Mine Bitcoin (Step-by-Step)","duration":1231},
                {"id":"46asG9gUY4Q","title":"Uncomfortable Truths of #bitcoin  Mining","duration":42},
                {"id":"CNBd4Gdla-M","title":"Wohin mit all dem PV Überschuss? Bitcoin mining mit gebrauchten S19jPro von 21energy aus Österreich","duration":1798},
                {"id":"WbEn-fsAEqs","title":"I Mined Bitcoin for 1 Year (Honest Results)","duration":694},
                {"id":"F1ot1qS-VtQ","title":"The POWERFUL $680 Home Bitcoin Miner - Nerd Octaxe","duration":945},
                {"id":"5Y2fkldA-lQ","title":"The Early Days of Bitcoin Mining","duration":472},
                {"id":"SHQq01QwG4E","title":"Beginners Guide To Home Bitcoin Mining 2026","duration":1318},
                {"id":"3PwZkjUisDM","title":"How to: Bitcoin Mining with Flared Gas","duration":1770},
                {"id":"El3y8AME8oA","title":"How Bitcoin Mining Really Happens","duration":599},
                {"id":"CwX35qCL1f4","title":"How to Get Started with Bitcoin Mining (Full Beginner Guide)","duration":1006},
                {"id":"bXOehGbWksM","title":"Bitcoin Mining 2025 erklärt – Lohnt es sich noch?","duration":1133},
                {"id":"Gsswul2h5vE","title":"This NEW Mini Home Bitcoin Miner Could Earn You 3.125 BTC!","duration":1003},
                {"id":"wQI3jZFdh2s","title":"Bitcoin: Historical Mining Difficulty & Target Hash (11/21/24 Update)","duration":106},
                {"id":"PQwRX8dCFTU","title":"Bitcoin Mining - Renewable Energy’s Trojan Horse?","duration":1811},
                {"id":"ENQQXeEv2gI","title":"Why Should You Run a Bitaxe?","duration":358},
                {"id":"hZKlPadZ4j4","title":"Renewable Energy and Bitcoin Mining","duration":3421},
                {"id":"8pOy8TOdyS4","title":"Bitcoin Difficulty Adjustment (2/7/24 Update)","duration":533},
                {"id":"HbS80lfbBl4","title":"Bitcoin Miner Transaction Fees: % of Block Reward (12/22/23 Update)","duration":81},
                {"id":"la4Aj2RrR64","title":"What I WISH I KNEW Before I Started Mining Bitcoin BTC...","duration":1113},
                {"id":"5v-t9NOkExU","title":"This NEW Home BITCOIN Miner could Earn you 3.125 BTC!","duration":1232},
                {"id":"SNSkRFY0QeI","title":"Free Bitcoin ebooks from Braiins","duration":36},
                {"id":"M7PRiPHM4BU","title":"Importance of Capital in Bitcoin mining","duration":42}
            ]
        },
        {
            "id": "music",
            "name": "Music",
            "emoji": "🎵",
            "desc": "Bitcoin songs, rap & music videos",
            "color": "#ec4899",
            "videos": [
                {"id":"QL6_YmVoRlg","title":"Truthseekers","duration":191},
                {"id":"ZLYx-SXUjUk","title":"Richard - The Flood ft Tomer Strolight","duration":166},
                {"id":"SfwGpvrzIjs","title":"Captain Youth – Bitcoin 🤑","duration":224},
                {"id":"aynV4UOU-As","title":"Flume - Holdin On (Official Video)","duration":155},
                {"id":"ImfZTycPzbE","title":"Muse - Compliance (Live) - Turku Rockfest 14.6.2025 Finland","duration":250},
                {"id":"pTrxWW6creQ","title":"NEUNOSIEM, ZRW, J.KIN - Don't Trust","duration":251},
                {"id":"vQkXrct78A4","title":"Tileks - BITCOIN","duration":119},
                {"id":"_jPFFu4gj8o","title":"Hi-Rez ft. Jimmy Levy - Welcome to the Revolution  「Lyrics」","duration":212},
                {"id":"AQVIaBeUaus","title":"Song for Marcella (A Tribute to Bobby Sands)","duration":262},
                {"id":"AeCHP-4iRbM","title":"Get Up, Stand Up (1973) - Bob Marley & The Wailers","duration":200},
                {"id":"6ZKzapbQPZA","title":"Banksters Paradise - A Bitcoin Song","duration":264},
                {"id":"KYXgxhyAiwk","title":"Dax - Oliver Anthony \\\"Rich Men North Of Richmond\\\" Remix [Official Video]","duration":183},
                {"id":"7pAr6B7fqyM","title":"Freedom","duration":367},
                {"id":"kdvTkddp1F0","title":"Don't Get Zhou Tonged!!! - Zhou Tonged","duration":157},
                {"id":"IeKDJbJSVoo","title":"War","duration":204},
                {"id":"avToLPdSerk","title":"Tatiana Moroz Performing \\\"The Silk Road\\\" LIVE in Studio!","duration":242},
                {"id":"mZFxv1PT-QQ","title":"Gramatik & BRANX - Future Crypto","duration":207},
                {"id":"-UyRTltUv7w","title":"Genesis Block","duration":157},
                {"id":"NzU5njGMq-w","title":"Ego Death","duration":244},
                {"id":"Hgqdss3DY5M","title":"Lil Bubble - Man With Bitcoin (Official Visualizer)","duration":142},
                {"id":"vnMBfreYTA4","title":"Lil Bubble - Dammit (Blink 182 Crypto Parody Version)","duration":157},
                {"id":"5Uis4flerMI","title":"Feuer über Fiat","duration":213},
                {"id":"-N4jf6rtyuw","title":"Gnarls Barkley - Crazy (Official Video) [4K Remaster]","duration":181},
                {"id":"qR4fzaXe6vw","title":"In Our Minds","duration":150},
                {"id":"ixZDTiXiHsc","title":"Three Days Grace - Riot (Official Audio)","duration":208},
                {"id":"IrcN-zmCZMI","title":"If It Was Not For Satoshi - Robbie P","duration":162},
                {"id":"JYJ6QJqy92s","title":"Killing in the Name","duration":314},
                {"id":"R5AoOA5j85A","title":"Lil Bubble - All I Want For Christmas Is Mass Adoption (Crypto Christmas EP)","duration":140},
                {"id":"OQPq_5PTj9M","title":"HAPPY BITCOIN HALVING! 🚀 Willy Wonka style? #Bitcoin #bitcoinhalving2024","duration":51},
                {"id":"VT_aEKr0BVY","title":"Bitcoin Song - 13inlet","duration":198},
                {"id":"Vh1uCDPOLx0","title":"Refugee (Radio Edit)","duration":227},
                {"id":"H_vQt_v8Jmw","title":"Rage Against The Machine - Freedom (Official HD Video)","duration":360},
                {"id":"LlY90lG_Fuw","title":"Pharrell Williams - Freedom (Official Video)","duration":166},
                {"id":"_pv-uKXaBFc","title":"Bitcoin's Better Than Gold","duration":213},
                {"id":"hRhj3lfWzrI","title":"Aurora- The Seed Haik Concert Live","duration":280},
                {"id":"PEs1Ezk9htU","title":"Lil Bubble - DeFi State Of Mind (Jay-Z ft. Alicia Keys - Empire State Of Mind - Crypto Parody)","duration":133},
                {"id":"UjkYo7t15yk","title":"Bitcoin (Official Video) - Shehbaaz","duration":228},
                {"id":"i1_idiGFUjM","title":"Antico - We need freedom - Red Zone (1991)","duration":300},
                {"id":"xMohBUCVJ64","title":"Stacking Sats","duration":197},
                {"id":"U5JnpsDzw2k","title":"Bitcoin All The Way Up - Dollar Vigilante feat. Freenauts","duration":169},
                {"id":"K5yDgEVafg8","title":"Never Give Up (The Bitcoin Halving Song)","duration":233},
                {"id":"KRopo3nofl4","title":"10,000 Bitcoin Remix - Laura Saggers","duration":86},
                {"id":"pWGDcE9YsFE","title":"Most Toxic Bitcoin Maxi Vertical & Lyric Captioned!! (Official Music Video 2023) by ROBBIE P","duration":208},
                {"id":"kKIsjAuMDyo","title":"The Plan","duration":140},
                {"id":"qOHEfVQFs2Q","title":"Hope","duration":121},
                {"id":"Gyi_BtemEcA","title":"Ashtray","duration":171},
                {"id":"IGeM1XWuLS4","title":"Rules That Will Survive","duration":125},
                {"id":"ErgNY-mox34","title":"Superzyklus – prod. by Orange Pill Reality 🎸🔥","duration":241},
                {"id":"e2cl0_jqu4I","title":"Halvingbird (a Bitcoin Halving song)","duration":172},
                {"id":"2RRpl_TBlDQ","title":"Bitcoin","duration":244},
                {"id":"s3xXVsGANNI","title":"The Ballad Of Surfer Jim (feat. The Toxic Pleb Chorus)","duration":96},
                {"id":"oZwzttexaUM","title":"Lil Bubble - All The Small Caps (Blink 182 - All The Small Things - Crypto/Bitcoin Version)","duration":140},
                {"id":"EwEjrl13rZ0","title":"Lil Bubble - Crypto DJ Set (live from the spaceship) - July 2021","duration":608},
                {"id":"OJ62RzJkYUo","title":"Pixies - Where Is My Mind? (Official Lyric Video)","duration":230},
                {"id":"vtwJ00ck0nI","title":"Swiss Bank Bitcoin (Bitcoin Anthem)","duration":198},
                {"id":"9EeRN2qwDU0","title":"Bitcoin Anthem","duration":245},
                {"id":"Qr49drtKtbk","title":"Digital Gold Becomes A 'Danger Zone' | Why SEBI Is Warning Against Digital Gold Buying | Explained","duration":281},
                {"id":"mR8_ldc9lag","title":"Criminal","duration":320},
                {"id":"M3TzVgGyBFs","title":"Lil Nas X - Old Town Road (Bitcoin Version) Lil Bubble","duration":165},
                {"id":"chPDTUjnWgA","title":"POWER (Album Version (Edited))","duration":293},
                {"id":"MqDCuSWr8p8","title":"Tatiana Moroz - Love Song","duration":170},
                {"id":"TmWhY_irAXE","title":"Pet","duration":275},
                {"id":"XVcPxApYijo","title":"Bulls Is Back - 88N8 x Lil Bubble (prod. PyroDaGod) - LYRIC VIDEO","duration":172},
                {"id":"tQ3VgWkgLr8","title":"CAKE - Nugget (Official Audio)","duration":240},
                {"id":"CmGGt4KL9kQ","title":"Lil Bubble - 100 RACKS (Bitcoin $100k Anthem) Official Music Video","duration":149},
                {"id":"3lUUDwSSkWo","title":"Bitcoin Miner's Daughter","duration":212},
                {"id":"IpCJ5ct_pgk","title":"Evolution to Revolution - \\\"Love and Liberty\\\" - Tatiana Moroz","duration":201},
                {"id":"4J2UC3N_A_c","title":"Time To Ride Or Die","duration":134},
                {"id":"Vz9iCgiSZrM","title":"Bitcoin's Back - Lil Bubble (Backstreet Boys Parody)","duration":141},
                {"id":"iqbScnkmf0s","title":"Elaine Diane Taylor - Bitcoin Barbarians","duration":186},
                {"id":"TjD4B3Vh9LQ","title":"FOREVER LONG!? (Youth Group - Forever Young - Crypto Bitcoin Parody Version) - Lil Bubble","duration":150},
                {"id":"htTL7C23684","title":"Build The Chain","duration":145},
                {"id":"l5-gja10qkw","title":"Highly Suspect - My Name Is Human [Official Video]","duration":259},
                {"id":"LHPKOy3dtqQ","title":"Green Day - Revolution Radio (Official Lyric Video)","duration":181},
                {"id":"c21GLKrC2Gg","title":"Bitcoin Only (feat. C. Scott Muzic) - Wonx316","duration":217},
                {"id":"42pUCIjC6ks","title":"Lil Bubble - Pool & Chill (DeFi yield farming/impermanent loss diss)","duration":127},
                {"id":"szXTJN1gmxY","title":"Lil Bubble - Bybit Games (BTC Brawl Theme Song)","duration":92},
                {"id":"NNBHn-cHtrI","title":"Bitcoin 101: How Do I Get Bitcoin?","duration":326},
                {"id":"u7u1TCkiIjQ","title":"10000 Bitcoins","duration":195},
                {"id":"_hQRxuYBx0w","title":"Chuty - Bitcoin (Videoclip Oficial)","duration":209},
                {"id":"cDmWR520hgk","title":"Roll The Old Timechain Along","duration":186},
                {"id":"248Zbw1oPnw","title":"Enhancer","duration":203},
                {"id":"Y1Lott3zNwk","title":"Skillet - Revolution (Audio Visualizer)","duration":186},
                {"id":"U4W05HzAWuM","title":"The Plan","duration":140},
                {"id":"6yCIDkFI7ew","title":"The Black Keys - Gold On The Ceiling [Official Music Video]","duration":226},
                {"id":"2WFTCz56lco","title":"What A Wonderful World - Joey Ramone - Lyrics","duration":142},
                {"id":"OVnvE0vfOCA","title":"Just A Ponzi That I Used To Hold (Gotye - Bitcoin & Crypto Crash Parody Version) - Lil Bubble","duration":212},
                {"id":"zqABrIOjIgU","title":"Tatiana Moroz Performs The Bitcoin Jingle | Miami Crypto Experience 2021","duration":131},
                {"id":"h7I_DqVzYjI","title":"Bitcoin","duration":30},
                {"id":"bJKGdKqd3sc","title":"The Hodler","duration":234},
                {"id":"_fymw1iOfiM","title":"Lil Bubble - ALL TIME HIGH (Bitcoin Anthem - Official Music Video)","duration":118},
                {"id":"IToRg7qX-V0","title":"toxic happy hour!!!!","duration":48},
                {"id":"RzvOlN7o6UE","title":"Ones Who Came Before","duration":121},
                {"id":"Ee_uujKuJMI","title":"Green Day - American Idiot [Official Music Video] [4K Upgrade]","duration":182},
                {"id":"NEnaxCLcSL8","title":"One Bit Wonder","duration":112},
                {"id":"DaECuEX6WtU","title":"LMFAO - Sorry for Bitcoin Hodlin! ($100K Bitcoin Song)","duration":310},
                {"id":"s3UtbslfqS8","title":"Gary Gensler, Isn't That True? - Bitcoin Heavy Metal","duration":315},
                {"id":"bC-hvPM6JbA","title":"Lil Bubble - Half On The Block (Happy Bitcoin Halving!)","duration":100},
                {"id":"hjhVos8L3Kg","title":"Love Anthem","duration":240},
                {"id":"D3JCOzq9qFE","title":"Ep. 10 Scott Sibley of SHAmory - Kids Can Grasp Bitcoin Through This Simple Card Game","duration":2457},
                {"id":"eqxNbGvNamY","title":"Lovesong for Satoshi Nakamoto (Bitcoin Whitepaper)","duration":257},
                {"id":"8n5k714GOlA","title":"HODL GANG - Bitcoin Rap Remix","duration":179},
                {"id":"9IclmVdWNbI","title":"Green Day - Know Your Enemy [Official Music Video]","duration":193},
                {"id":"vyKA1pW0CBA","title":"Bitcoin All The Way Up (Remix) - Dollar Vigilante feat. Freenauts","duration":173},
                {"id":"Etk0eS8cIZQ","title":"Level Up","duration":88},
                {"id":"FCA9i6MUCK0","title":"Bitcoin Beats Mix - Volume 1","duration":1796},
                {"id":"Rtc1KPPzbls","title":"F.I.A.S.O.M. Pt. 2","duration":170},
                {"id":"ZAmIm2TkrUM","title":"Bitcoin's Going To The Moon (Jpop)","duration":220},
                {"id":"_5ukACItUh0","title":"E.Cole I - Inflation (Official Lyric Video)","duration":185},
                {"id":"ZrLUOnORg2U","title":"Coin Bros - Buy the F@ck!ng dip! (PROD. BG3NIUS)","duration":143},
                {"id":"40eqoQHJU_E","title":"George Michael - Freedom! '90 (Official Lyric Video)","duration":387},
                {"id":"L7F345IxRuI","title":"Fire of Freedom | The Orange Pill Jam Project","duration":438},
                {"id":"sBpkQfuQp9g","title":"Chris Webby - Lullaby (feat. Bria Lee)","duration":207},
                {"id":"82KBQkJgIJs","title":"Lugano PlanB \\\"The Song\\\" | The Orange Pill Jam Project","duration":354},
                {"id":"W-Z_hlzZYBw","title":"Jason Saulnier - Bitcoin We're in Love","duration":242},
                {"id":"Uu0qmgshc4o","title":"Beyoncé  - Freedom (feat. Kendrick Lamar) (Lyrics)","duration":267},
                {"id":"qUNX6nyCL9Q","title":"BITCOIN Ballin'","duration":203},
                {"id":"aXQM72Xll3o","title":"Tatiana Moroz  - The Bitcoin Jingle","duration":247},
                {"id":"oL6KtX9iIsA","title":"salem ilese - crypto ₿oy (official lyric video)","duration":142},
                {"id":"ySPw_-09nnI","title":"Magic Internet Money","duration":636},
                {"id":"fD9nikHty2k","title":"Pleb Run This","duration":208},
                {"id":"G_vegzt68Xo","title":"Running a successful Bitcoin Business with Scott Sibley Of SHAmory - Voltage Twitter Spaces","duration":1634},
                {"id":"5rtTUO275wk","title":"Lil Bubble - All The Way Up (Official Visualizer)","duration":132},
                {"id":"HKtsdZs9LJo","title":"Cage The Elephant - Ain't No Rest For The Wicked (Official Video)","duration":185},
                {"id":"YQG7vcrQIlg","title":"Zac Brown Band - Free (Feat. Joey & Rory) [Live]","duration":250},
                {"id":"2DquYAJG1hA","title":"88N8 X Lil Bubble The Bulls Is Back","duration":172},
                {"id":"AJUAHhKYOIU","title":"Greatest Teacher","duration":144},
                {"id":"gIbyaej97mI","title":"Hope In Numbers","duration":131},
                {"id":"QvZ7K_0_SiY","title":"Lil Bubble - Liquidated (Avril Lavigne - Complicated | Bitcoin Parody Version)","duration":149},
                {"id":"dz4Gt-Oty9I","title":"Drake - Started From the Bottom (Crypto/Bitcoin Parody - Lil Bubble)","duration":148},
                {"id":"UdbOaVdIUTM","title":"The Bitcoin Song - Ohio Toast Ska Man","duration":139},
                {"id":"2lpikrpQ0yQ","title":"Lil Bubble - Have You Heard About NFTs? (Official Music Video)","duration":146},
                {"id":"hZJRJpbGkG4","title":"War","duration":231},
                {"id":"YtyrRpGAg34","title":"John Williams - Main Title from Star Wars | London Symphony Orchestra","duration":345},
                {"id":"Bv9Ug00PZZU","title":"Avoided Wars","duration":154},
                {"id":"c5wbgDLr-u0","title":"Bitcoin Lofi Beats - Study & HODL","duration":1610},
                {"id":"A7TuFy0fcuw","title":"Bitcoin Song - Community Playlist","duration":232},
                {"id":"3hYZbyWZW-E","title":"Lil Bubble - In My Spaceship (Official Visualizer)","duration":132},
                {"id":"r-vbEOo2x4Y","title":"LFG","duration":114},
                {"id":"37Bc5ZmvX8Y","title":"Lil Bubble - Old Saint Nicholas (Crypto Christmas)","duration":130},
                {"id":"KwVbcjJYctM","title":"Clubbed to Death (from \\\"The Matrix\\\")","duration":244},
                {"id":"JGPgxoIPY6Q","title":"Boys Like Girls - The Great Escape","duration":208},
                {"id":"dgKlBQmGQ98","title":"Most Toxic Bitcoin Maxi - Robbie P","duration":208},
                {"id":"ZUsOvjH-lRU","title":"Lil Bubble - Satoshi As My Witness (Official Music Video)","duration":151},
                {"id":"G8g-UGSjtG4","title":"Greedy Life","duration":376},
                {"id":"w47yNylcEU0","title":"DCA2BTC","duration":208},
                {"id":"uEFWJ4eB8Bc","title":"Bitcoin Card Game Rated Best of Stem 2021 | Scott and Mallory Sibley | Shamory","duration":1629},
                {"id":"69uczA-41nE","title":"Blockchain Sees It All","duration":88},
                {"id":"UBQ4mDsuWeI","title":"Central Bank","duration":167},
                {"id":"BeiouJGHeE8","title":"Ty Dolla $ign - Ego Death (feat. Kanye West, FKA twigs & Skrillex) [Lyric Video]","duration":230},
                {"id":"A4AsxKXfsYQ","title":"Tech N9ne believe full lyrics","duration":239},
                {"id":"Kf9O25j1PSs","title":"Lil Bubble - SpaceX (Official Visualizer)","duration":104},
                {"id":"wa6Ex4Shxes","title":"Ringing of Revolution","duration":435},
                {"id":"roxSjlgmR5M","title":"Something's Got to Give","duration":259},
                {"id":"1utTEIWXOhQ","title":"Lil Bubble - How Low? (Ludacris - How Low - Crypto Version)","duration":102},
                {"id":"FzUWMPfYV98","title":"Freedom Engine","duration":223},
                {"id":"0LhJR11B1CE","title":"Bags On Exchanges","duration":241},
                {"id":"d7ZOCibyihc","title":"FOMO","duration":188},
                {"id":"JACD8a2LZ_8","title":"Lil Bubble - Green Christmas (Crypto Christmas EP - BONUS SONG)","duration":139},
                {"id":"27BwXfrJxcs","title":"Death to Fiat - The Skull of Satoshi (Bitcoin Heavy Metal)","duration":209},
                {"id":"-zkcuaJY7AQ","title":"All That Remains - A War You Cannot Win (Visualizer Video)","duration":226},
                {"id":"VQ8H3qGkrFM","title":"When Moon Remix (Lil Bubble in Paris) @ Binance Blockchain Week 2022","duration":111},
                {"id":"lG08pD-8upE","title":"Bitcoin Slang Remix - Robbie P","duration":197},
                {"id":"x_aGUAJzv0A","title":"Bitcoin Going To Zero? GFY! (Risitas feat. Elon Musk) Lil Bubble Remix","duration":82},
                {"id":"1pqIFDI18ZY","title":"Lil Bubble - Jingle Bells (Please Don't Sell) - Crypto Christmas EP","duration":105},
                {"id":"aNrpN9oAUlo","title":"Bitcoin Baller","duration":107},
                {"id":"fG5PKg81mEQ","title":"Fliponomics - Robbie P","duration":196},
                {"id":"xWAwK2fHArc","title":"Bitcoin Song - No Regulators (Warren G - Regulators)","duration":257},
                {"id":"qDUjrUot2C0","title":"Lil Bubble - Buy More Bitcoin (Official Visualizer) ft. Andrew Tate","duration":204},
                {"id":"PtaYMGK0LVQ","title":"Robot Just Stole My Job (Tesla Bot Optimus AI - Parody Song) - Lil Bubble","duration":132},
                {"id":"1_VwtHcfefg","title":"Jay Sean - Down (Crypto/Bitcoin/Stock Market Parody Version) Lil Bubble","duration":161},
                {"id":"kL3KuEQaQVw","title":"For What It's Worth","duration":158},
                {"id":"gSxKJJ9k3lA","title":"The Ultimate Crypto Anthem - Betawi CryptoCoin","duration":395},
                {"id":"J29Kp6ofbww","title":"Major Lazer - Get Free (feat. Amber Coffman) (Chrome Sparks Remix) (Official Lyric Video)","duration":261},
                {"id":"gdnzBNMfZfo","title":"The Doors - Break On Through (To The Other Side) [Official Video]","duration":151},
                {"id":"VMLakjlz6us","title":"Ode to Satoshi - Roger 9000","duration":490},
                {"id":"8ClyXbLv7pA","title":"The Point of No Return | Immortal Technique","duration":253},
                {"id":"gZDdV4d4g4k","title":"Choyna","duration":179},
                {"id":"0ws8HqK0dsc","title":"The Shores of Sovereignty","duration":282},
                {"id":"NbHUM9iElkQ","title":"Bullish","duration":162},
                {"id":"qlJdTtSNpcI","title":"HODL On","duration":196},
                {"id":"3uvMvtyt0R8","title":"Hope in Numbers","duration":131},
                {"id":"S99tOmXywZU","title":"Let Me Escape","duration":107},
                {"id":"KnIozPJWTPM","title":"Glory (From the Motion Picture \\\"Selma\\\") - Common & John Legend","duration":262},
                {"id":"LBsYqETjc8c","title":"Empowering Bitcoin Literacy: SHAmory's Educational Journey","duration":791},
                {"id":"mQ9Y_KoOldU","title":"Bottomshelf Bitcoin ep. 56 - Scott Sibley and SHAmory","duration":2089},
                {"id":"s88r_q7oufE","title":"Queens Of The Stone Age - No One Knows (Official Music Video)","duration":259},
                {"id":"CbElk8D3-e8","title":"Oflow - Bitcoin (The Anthem) Audio","duration":154},
                {"id":"eH9b_qNbjEU","title":"Bitcoin - Official Music Video (Teejay)","duration":227},
                {"id":"HuSTyAgt8Uo","title":"Bitcoin Song","duration":209},
                {"id":"dT4hLudO-is","title":"IMAGINE : JOHN LENNON (Lyrics)","duration":184},
                {"id":"U252iiG8YP0","title":"Jingle Bells, Bank Cartels! A Bitcoin Christmas Song","duration":121},
                {"id":"iBJFo3p7gNc","title":"Lil Bubble - 100 Racks (Official Visualizer)","duration":149},
                {"id":"b8uRhNfxe60","title":"New #Bitcoin all time high!? 🚀","duration":41},
                {"id":"3KmLpdVR9Yw","title":"Mailman","duration":267},
                {"id":"Qx3PdGcA5Zs","title":"Stay Humble Stack Sats","duration":132},
                {"id":"yloMl7r57-8","title":"Bobby Shmurda - Shmoney (Lil Bubble Crypto Verse - Tully Remix Competition)","duration":61},
                {"id":"ipDpjANJ7fU","title":"Save The Young","duration":174},
                {"id":"WqkjYKUXERQ","title":"Billy Joel - We Didn't Start the Fire (Audio)","duration":292},
                {"id":"oNuionfkJFQ","title":"In The Music (as made famous by The Roots feat. Malik B. Porn)","duration":253},
                {"id":"9SuaT17NolA","title":"Satoshi Love Song さとしの恋��","duration":132},
                {"id":"0xjxJ-P9VbY","title":"The Shores Of Sovereignty","duration":272},
                {"id":"_OGqQO06JP8","title":"Wavin'  Flag (Coca-Cola® Celebration Mix)","duration":220},
                {"id":"YbzNJr26H-4","title":"Welcome To The Blockchain - Toby Ganger + Decap","duration":241},
                {"id":"Y3eFCbBjToY","title":"Better Days","duration":260},
                {"id":"XZbvb3pD81E","title":"Cantillionaires Game","duration":151},
                {"id":"qS8aIYlsuI4","title":"Whitewoods - Free Ross Anthem","duration":283},
                {"id":"YkKEuJwu7iM","title":"Metallica - ...And Justice For All (Remixed and Remastered)","duration":590},
                {"id":"DNYzHGM50Ys","title":"Too Bit To Fail - Proof of Word EP","duration":1560},
                {"id":"QP3zRBtgvJo","title":"MUSE - COMPLIANCE [Official Music Video]","duration":222},
                {"id":"oF4lleeOPe8","title":"Future of Money","duration":134},
                {"id":"KglDZXcdQhk","title":"Lil Bubble - Bitcoin Song (Official Music Video)","duration":117},
                {"id":"8KkDyLrgMMo","title":"Tenacious D   The Government Totally Sucks Lyrics","duration":98},
                {"id":"pADgAmNzxek","title":"We Are All Bitcoins","duration":227},
                {"id":"gu122fUBlxA","title":"Captain Youth – Maul Me (Lyric Video)","duration":175},
                {"id":"Xl1f47AkroY","title":"Lil Bubble - My Bags Are Dumping (Official Visualizer)","duration":139},
                {"id":"YyCoM4WTU74","title":"Stack Sats - Jack Mallers x Pleb Music","duration":97},
                {"id":"q31WY0Aobro","title":"Sex Pistols - Anarchy In The UK","duration":217},
                {"id":"bsDXHwhL3fw","title":"Leveling Up Bitcoin Education: How SHAmory Turns Learning Into a Game for All Ages with Scott Sibley","duration":2961},
                {"id":"Otkg4Ftx6GI","title":"The Bitcoin Song","duration":225},
                {"id":"E94KORpOpo4","title":"Lil Bubble - Dump (Lyric Video)","duration":145},
                {"id":"emcT185BXMQ","title":"Carlos Matos - Take On Me (autotuned)","duration":112},
                {"id":"amHdpiVZ5fg","title":"Ego Death (Extended Version)","duration":340},
                {"id":"zkeuo9brMnI","title":"Theo Katzman - Corn Does Grow [Official Video]","duration":225},
                {"id":"PJvi5uUY8Rk","title":"Lil Bubble - Don't Hate The Game (Level 1)","duration":75},
                {"id":"2FXN1Z6Q004","title":"Ray Charles - America The Beautiful (Official Audio)","duration":218},
                {"id":"XS37JKYc-gA","title":"Bitcoin Baron","duration":210},
                {"id":"vUvIzshYyv8","title":"What is a Central Bank? | Back to Basics","duration":144},
                {"id":"J4pLMsk-nVA","title":"SATS OVER EVERYTHING - Manlikekweks x Encorebeats","duration":218},
                {"id":"Lx262ep1I0I","title":"Fumble - Writings on the wall (Official video)","duration":149},
                {"id":"cHKudSFnQLM","title":"\\\"Don't Stop\\\" Fleetwood Mac performed by Rumours of Fleetwood Mac","duration":210},
                {"id":"KQ7rn3oi-Pc","title":"Blockchain - Money Man","duration":139},
                {"id":"qKSNABST4b0","title":"Rage Against The Machine - Take The Power Back (Official Audio)","duration":338},
                {"id":"igvP806798U","title":"Born To Be Wild","duration":213},
                {"id":"WJaxFbdjm8c","title":"Ai Generated Music Video - Deltron 3030 - Virus","duration":267},
                {"id":"cWgGOFlb15U","title":"In Our Minds","duration":150},
                {"id":"BHBO7dFI4nA","title":"Energy Freq","duration":166},
                {"id":"G-ip-MHg6Zc","title":"Tatiana Moroz - Never Give Up (Live at the DC Blockchain Summit)","duration":216},
                {"id":"X_hcqAJS6sw","title":"Tatiana Moroz - Playin' The Cards","duration":553},
                {"id":"6cXL8TJnY1E","title":"Inflation Blues","duration":255},
                {"id":"xfwpAhlVALQ","title":"Gary Gensler - Smells Like Securities (Eminem - Without Me - Crypto Version) - Lil Bubble","duration":122},
                {"id":"39VlJOcFv94","title":"Bitcoin Anthem,  Bitcoin to the Moon - Anime Music Video","duration":246},
                {"id":"Ec_HjprLjqo","title":"Rationale II Freedom (Lyric video)","duration":226},
                {"id":"dUU7qGCQHmU","title":"Goldfinger - Open Your Eyes (Live Mtv)","duration":172},
                {"id":"HF9uhRqcNSo","title":"Lil Bubble - Let It Pump (Official Visualizer)","duration":111},
                {"id":"9odyosmjIr0","title":"Lil Bubble - Bitcoin Song (Lyric Video)","duration":119},
                {"id":"PYeUQpbMy1o","title":"Love You Like A Bitcoin","duration":242},
                {"id":"T3deOQPJ2H8","title":"Freedom (Sub Focus & Wilkinson)","duration":243},
                {"id":"27U4yhFqCVs","title":"WHATS DROPPIN? (Jack Harlow - WHATS POPPIN - Bitcoin, crypto, trading parody) - Lil Bubble","duration":110},
                {"id":"C38ACpjr8Pw","title":"Say Yeah","duration":140},
                {"id":"BRbVhsoPzmI","title":"Crypto Weekly Rap Up (Bitcoin Rap) - Week 4","duration":160},
                {"id":"d0KWiDGi_ek","title":"Muse - Uprising [HD]","duration":304},
                {"id":"Z7kz32JF3h8","title":"NYKNYC","duration":30},
                {"id":"wTy_VZ52UcI","title":"Bitcoin Song","duration":260},
                {"id":"MVqNXGzqlZE","title":"\\\"Stand Proud\\\" (feat. Shana Halligan, Tahir Panton, Keznamdi)","duration":266},
                {"id":"95Kmj3tKCow","title":"HOW COULD THIS HAPPEN TO ME!? (Simple Plan - Untitled - Crypto/Bitcoin Parody Version) Lil Bubble","duration":176},
                {"id":"gGJdWNnC80s","title":"Don't Tread on Me (Remastered)","duration":241},
                {"id":"KLukwDVzETI","title":"Satoshi's Magic (A Big Bitcoin Christmas)","duration":236},
                {"id":"iqn9bUc751E","title":"Ode to Satoshi","duration":181},
                {"id":"BifVGcvJpxc","title":"WAGMI","duration":115},
                {"id":"1XH2I1vh2Co","title":"We are fucking stupid","duration":118},
                {"id":"U5NGVH8HDaw","title":"Bitcoin Boomdeyada!","duration":66},
                {"id":"K3b6SGoN6dA","title":"BLACK SABBATH - \\\"War Pigs\\\" (Live Video)","duration":452},
                {"id":"fjFGInQZnyY","title":"Testing Bitcoin 123","duration":121},
                {"id":"ILP36_0tooU","title":"K'NAAN -Wavin' FLAG (coca-cola celebration mix)  LYRICS","duration":225},
                {"id":"k8ukx0LKJRo","title":"Have Fun Staying Poor","duration":185},
                {"id":"6xfqzCqTiZs","title":"BitBoy Crypto Rant (Heavy Metal Remix) - Lil Bubble","duration":64},
                {"id":"tJrtRnA7xe4","title":"HODL On Ye Bitcoin Sailors (feat. The Toxic Pleb Chorus)","duration":247},
                {"id":"MQzXrrFvSKs","title":"MultiBoi Using Pico Flasher is INCREDIBLE","duration":112},
                {"id":"109WLnpYkqE","title":"Vibing with the FED and Bitcoin","duration":180},
                {"id":"9Ug7udnfbcE","title":"Oliver Anthony - Rich Men North of Richmond (Lyric Video)","duration":191},
                {"id":"BgtEyrZDn1s","title":"Lil Bubble -  My Ponzi (Ginuwine - Pony - Bitcoin Parody Version)","duration":132},
                {"id":"9ZYH8v42a2w","title":"Ray Charles - America The Beautiful (Official Video)","duration":216},
                {"id":"yv5xonFSC4c","title":"Bob Marley & The Wailers - Redemption Song (Official Music Video)","duration":236},
                {"id":"y29kmnhjtc8","title":"Iyah May Karmageddon Lyric Music Video","duration":211},
                {"id":"8peRa8Bxq5Y","title":"BITCOIN BALLER","duration":178},
                {"id":"bWXazVhlyxQ","title":"Rage Against The Machine - Killing In the Name (Official HD Video)","duration":314},
                {"id":"S9DjpDY-PIY","title":"Tatiana Moroz | Inside Bitcoins Chicago","duration":3161},
                {"id":"kQMK1WnJV-w","title":"Bitcoins","duration":244},
                {"id":"qfYqdSsAldc","title":"Hyperbitcoinization (You're Not Ready)","duration":151},
                {"id":"0C2-brBpVMw","title":"Federal Reserve","duration":277},
                {"id":"wNFY8lJhm0A","title":"Kygo, Zak Abel - Freedom","duration":198},
                {"id":"RglKdIovlX0","title":"BANK - Bitcoin Music Video","duration":141},
                {"id":"4xmckWVPRaI","title":"Twisted Sister - We're Not Gonna Take It (Official Music Video)","duration":272},
                {"id":"HAwC0swp96I","title":"Gramatik - Satoshi Nakamoto MUSIC VIDEO (feat. Adrian Lau & ProbCause)","duration":267},
                {"id":"4kmWR5bWHAc","title":"Andrew Tate - Buy More Bitcoin (Lil Bubble House Remix)","duration":216},
                {"id":"cP--viN-QeU","title":"Faith in My Money","duration":197},
                {"id":"v0JS5jGg_vQ","title":"Lil Bubble - Bitcoin House DJ Set (Vol. 1) - Bitcoin House Mix","duration":2387},
                {"id":"lc29W5PkM30","title":"Pennywise - Fuck Authority (LIVE from Red Bull Sound Space at KROQ)","duration":194},
                {"id":"q7Ol-YDS4Jc","title":"The Interrupters - \\\"Take Back The Power\\\"","duration":201},
                {"id":"aUp6fogcPM0","title":"Lil Bubble - The Rise of the Crypto Troopers","duration":116},
                {"id":"9EuH_ZGOlIs","title":"Proof of Work: A Bitcoin Experience","duration":183},
                {"id":"y1KOsdUBjbs","title":"Tatiana Moroz - The Bitcoin Jingle (Live at the DC Blockchain Summit)","duration":159},
                {"id":"d6Nt-TgueSM","title":"Let Me Escape","duration":106},
                {"id":"a6HnpGWA-NY","title":"Dark Market","duration":161},
                {"id":"WTJSt4wP2ME","title":"K'NAAN - Wavin' Flag (Coca-Cola Celebration Mix)","duration":225},
                {"id":"awbmTxD7sMM","title":"K'Naan - Wavin' Flag (lyrics) [HD]","duration":224},
                {"id":"mJUB86V57c4","title":"Lil Bubble - Pump It Up (Crypto/Bitcoin Version) Joe Budden Parody","duration":127},
                {"id":"nO6A4N9zjgE","title":"Rich Men North of Richmond - Full Band Cover","duration":176},
                {"id":"mkKFR5sB44s","title":"Pizza Day","duration":206},
                {"id":"xUs83qYjgFg","title":"Inflation","duration":181},
                {"id":"vyrU5hHrFJQ","title":"Dream of Empire","duration":139},
                {"id":"3RiwksNFRTo","title":"Wgmi","duration":115},
                {"id":"nrtFeKuiAHA","title":"Lil Bubble - Rug Star (Smash Mouth - All Star) Crypto Parody","duration":129},
                {"id":"9I9l8vlTvJE","title":"Toxic Maximalist - The Orange Pill Jam Project","duration":218},
                {"id":"gVrWLhcau94","title":"The Call","duration":140},
                {"id":"u4Mocusd1OU","title":"Soulja Boy - Bitcoin (Official Audio)","duration":186},
                {"id":"zRDZFW4pBvw","title":"Crypto Boy ft. Lil Bubble (salem ilese TikTok duet)","duration":66},
                {"id":"XEBWtbhq0Ts","title":"All About That Bitcoin - Naomi van der Velde","duration":157},
                {"id":"oQlqCjM4tAg","title":"Government Out","duration":184},
                {"id":"w8KQmps-Sog","title":"Muse - Uprising [Official Video]","duration":252},
                {"id":"VtLAl3eFYhQ","title":"Lil Bubble - Moon Boy (Official Visualizer)","duration":112},
                {"id":"VyfL2TUS0rk","title":"We Need Freedom (Red Zone)","duration":306},
                {"id":"6AfHKbpgsi4","title":"Too Bit To Fail & Hanspanzer - FOMO","duration":190},
                {"id":"h9vxIh1ELAo","title":"Oompa Loompa (Bitcoin Halving Remix) Lil Bubble","duration":85},
                {"id":"6mJF3c90xe0","title":"Shitcoin Casinos - Annonymal (Bitcoin Heavy Metal)","duration":230},
                {"id":"k4kj7JKSWYI","title":"21million","duration":121},
                {"id":"_c9WOks2mvg","title":"Pump It Higher","duration":156},
                {"id":"rDCrlgKGACo","title":"Anik The First - Be The Change (B.T.C.)","duration":209},
                {"id":"FbxycFX3idc","title":"Gramatik - Satoshi Nakamoto Feat. Adrian Lau & ProbCause","duration":267},
                {"id":"wyjTXNebRvU","title":"Lil Bubble  - Alt Season (The Ritual)","duration":137},
                {"id":"qki2ZIhnA6M","title":"Captain Youth – Bitcoin Money (Official Lyric Video)","duration":212},
                {"id":"IIqqMTT-ne0","title":"Lil Bubble - 0-100 Freestyle (Bitcoin Bars)","duration":140},
                {"id":"3v9hjdvnBx8","title":"Not in Yer Wallet","duration":150},
                {"id":"V7-4mTV9ODM","title":"All Over the World","duration":165},
                {"id":"n7FXEpkuy0k","title":"Lil Bubble - What A Dump (Haddaway - What Is Love - Crypto Bitcoin crash song)","duration":103},
                {"id":"kjpV9UPBEdw","title":"Lfg","duration":114},
                {"id":"AJzCQaIXelE","title":"Bitcoin Girl - Original Music Video","duration":248},
                {"id":"VdAcvUVy7FE","title":"We Will Bitcoin","duration":126},
                {"id":"BM1IF4UoZ1Y","title":"Tatiana Moroz - Never Give Up (Live from Bitcoin Halving Party)","duration":229},
                {"id":"bZb2qBrVHVY","title":"Bitcoins from Heaven","duration":50},
                {"id":"UuyisfVLk10","title":"Federal Reserve","duration":32},
                {"id":"XcerPhwbIFs","title":"Orange Pill rApp - Wallet Stay Stackin'!","duration":189},
                {"id":"jXwOd99Gcds","title":"100K ON THE WAY (Remix)","duration":148},
                {"id":"Geh6M87Njcs","title":"Take The Power Back","duration":337},
                {"id":"SMVEFDtAxJc","title":"Bitcoin Anthem","duration":90},
                {"id":"ZSthLmvh6Fk","title":"Main Title (From \\\"Star Wars\\\")","duration":349},
                {"id":"sOlkuuAq8p0","title":"Lil Bubble x The Dev - Drop It Like It's Hot (Crypto Parody Version) Snoop Dogg feat. Pharrell","duration":163},
                {"id":"EPQJHNXdJfM","title":"Crypto - Takeoff feat. Rich The Kid","duration":161},
                {"id":"sA1zVnvzfm4","title":"Tatiana Moroz  - The Silk Road","duration":265},
                {"id":"F3hTW9e20d8","title":"The Hanging Tree’ James Newton Howard ft. Jennifer Lawrence (Official Audio)","duration":216},
                {"id":"Qc6-Ra2wWc8","title":"Bitcoin Children's Books & Card Game With Scott Sibley of SHAMORY w/ @jarrettcarpenter | E81 - MTB","duration":1860},
                {"id":"wW5iomxXXRI","title":"The Bitcoin Song","duration":133},
                {"id":"MN9PAdVn7l0","title":"Lil Bubble - BTFD (House Remix) Visualizer","duration":132},
                {"id":"3cCxzR9NjhI","title":"The Panic Is On","duration":177},
                {"id":"yp0diaVLPrQ","title":"Mark Zuckerberg's Sister Sings to Crypto","duration":141},
                {"id":"78QQ4L44xj0","title":"Aint Gotta Dollar (Laundry Room Edition)","duration":125},
                {"id":"Wtj1x9aT9Zk","title":"Crypto Weekly Rap Up (Bitcoin Rap) - Week 1","duration":126},
                {"id":"QjRSZSDTjgY","title":"HAUNT ME","duration":160},
                {"id":"ELKbtFljucQ","title":"Paolo Nutini - Iron Sky [Abbey Road Live Session]","duration":382},
                {"id":"PL0yOu0dNwo","title":"Mainframe - Proof of Freedom","duration":133},
                {"id":"K2ku1A5Ox8U","title":"Blame it on MT.GOX","duration":234},
                {"id":"_Mc_OM5oNA8","title":"AURORA - The Seed","duration":281},
                {"id":"UCENTf_LWYA","title":"Frank Sinatra - That's Life (Audio)","duration":187},
                {"id":"Y5r6e1VcIBE","title":"BITCOIN SONG - Pat Ryan","duration":280},
                {"id":"Mp405FRK15Q","title":"Anti-Crypto | The Orange Pill Jam Project","duration":330},
                {"id":"6KNOqrjkNaE","title":"Crypto Weekly Rap Up (Bitcoin Rap) - Week 2","duration":205},
                {"id":"SKnRdQiH3-k","title":"Skillet - \\\"The Resistance\\\" [Official Lyric Video]","duration":241},
                {"id":"_iGtBkLn7uM","title":"Sxtxshx Nxkxmxtx","duration":175},
                {"id":"_YvLh4pUB4Y","title":"The Times They Are A-Changin' (Bitcoin version)","duration":119},
                {"id":"CQPFIK1ikDQ","title":"Vitalik Token2049 Song - A New Form Of Wealth (Lil Bubble Remix)","duration":77},
                {"id":"DH-tCLh2PM8","title":"21 Million Bitcoin","duration":115},
                {"id":"SIFN4u13FEU","title":"Diamond Hands & Laser Eyes - Robbie P (Official Music Video)","duration":184},
                {"id":"Q9z_cVn4gZg","title":"Chris Webby - Know My Rights (feat. Xander Goodheart)","duration":200},
                {"id":"B0xceHDpHcc","title":"Redemption Song (1991) - Bob Marley & The Wailers","duration":228},
                {"id":"zHxobd1WLno","title":"Imagine (Ultimate Mix)","duration":187},
                {"id":"PCW6BkSp1Sc","title":"deadmau5 - Antisec (ft. YTCracker)","duration":173},
                {"id":"6BqplqzuO6U","title":"Lil Bubble - I Hold Bags Not Assets (Panic! At The Disco Crypto Parody)","duration":130},
                {"id":"GZ0YMSLZjfQ","title":"Welcome To The Blockchain - Music Video","duration":242},
                {"id":"-Y13lkBvsQw","title":"Ghost Town Remix (Orange Pill Edition)","duration":173},
                {"id":"1VEMq8kDG68","title":"It's Math - Greg Foss & Pleb Music","duration":78},
                {"id":"PerQ-v7Doec","title":"John Stossel has Tatiana Moroz on to talk about Bitcoin!","duration":248},
                {"id":"m_dEsgzWFsU","title":"Propaganda","duration":338},
                {"id":"GxalY2vHZro","title":"1 BTC = 1 BTC","duration":158},
                {"id":"3fxzaTg0vMQ","title":"Lil Bubble - All The Bears Are Dead (Bitcoin 50k Edition - Lil Uzi Vert)","duration":120},
                {"id":"7qZbiMPQgyg","title":"Skillet - Rise Up [Official Audio]","duration":238},
                {"id":"vUUgTsMXjCI","title":"The Bitcoin Jingle performed by Tatiana Moroz (Tatiana Coin)!","duration":636},
                {"id":"CBufq6ous9I","title":"Stackin Sats","duration":182},
                {"id":"Xyxdlfa9TY0","title":"Inflation","duration":195},
                {"id":"5TAm-W3Hgis","title":"Chris Webby - North of Richmond (Remix) [Lyrics]","duration":197},
                {"id":"RIsZyg8OXlI","title":"10,000 Bitcoins - Laura Saggers","duration":231},
                {"id":"1a9SsvGp7kc","title":"[Clean] Robin Schulz - All We Got (feat. KIDDO)","duration":192},
                {"id":"UG7zLhEWanc","title":"Remy: Bitcoin Billionaire","duration":175},
                {"id":"OASbLz9R90o","title":"Intenet Money","duration":94},
                {"id":"SaC7lOaa3q4","title":"Magic Internet Money 🎧 High-Energy Electronic Track | Cyberpunk Club Music - TheLauSats","duration":261},
                {"id":"Xv8FBjo1Y8I","title":"Tracy Chapman - Talkin' Bout A Revolution (Official Music Video)","duration":175},
                {"id":"GFIZ05E3zEE","title":"Vices","duration":300},
                {"id":"_8I8tWmQqAE","title":"Peer2peer","duration":143},
                {"id":"C_ptrffwUQs","title":"Freedom - Sub Focus & Wilkinson ( Audio Oficial )","duration":241},
                {"id":"nvlvG18AcCo","title":"Bitcoin Bob: Money Monopoly","duration":140},
                {"id":"Tvn6H8zo5_c","title":"Tech N9ne - Believe Türkçe Çeviri","duration":235},
                {"id":"d-H_Q100u74","title":"SHAmory CARD GAME and COOL KIDS PRODUCTS w/ Scott and Mallory Sibley #Bitcoin","duration":1404},
                {"id":"7wBg1lBKtyg","title":"Lil Bubble - When Moon? (Mad World - Bitcoin Parody)","duration":79},
                {"id":"JWSpLFvzGII","title":"Tatiana Moroz - Keep Your Chin Up","duration":370},
                {"id":"NQ1BBJFBjvg","title":"Madeon - Mania (Official Audio)","duration":155},
                {"id":"JfQycjqZK3c","title":"Kygo - Freedom w/ Zak Abel (Official Audio)","duration":199},
                {"id":"P1dzJhqy97I","title":"YungManny - Bitcoin (Manny Phantom)","duration":100},
                {"id":"CgZEKDzgJwI","title":"Avoided Wars","duration":154},
                {"id":"xAVTyex_9E8","title":"Lil Bubble - BTFD (Official Music Video)","duration":124},
                {"id":"pFS4zYWxzNA","title":"clubbed to death - Matrix soundtrack","duration":455},
                {"id":"r9dyTI_is-Q","title":"SAVE US - Bruised [OFFICIAL VIDEO]","duration":178},
                {"id":"_qcvxLefJdY","title":"Immutable","duration":156},
                {"id":"s_x-KGxOcRA","title":"The Vandals - Anarchy Burger (Hold The Government) (Lyrics)","duration":114},
                {"id":"RU4aHnZlHhM","title":"Lil Bubble - Never Ever (selling back to tether)","duration":130},
                {"id":"oJO5WbsbMAU","title":"Ones Who Came Before","duration":124},
                {"id":"e9kWhWgmg7E","title":"Rules That Will Survive","duration":125},
                {"id":"m1ytm0vs1v8","title":"Pay Me In Bitcoin","duration":207},
                {"id":"Y3ywicffOj4","title":"Fleetwood Mac - Dreams (Official Music Video) [4K]","duration":264},
                {"id":"beW981FRwd0","title":"The New Division - Opium (Official Music Video)","duration":311},
                {"id":"bK95lWHl7js","title":"Megadeth - Dystopia (Official Music Video)","duration":316}
            ]
        },
        {
            "id": "news",
            "name": "News",
            "emoji": "📰",
            "desc": "Latest Bitcoin news & market updates",
            "color": "#3b82f6",
            "videos": [
                {"id":"2PvvIoi7l_Y","title":"Lebanon Banks Close Doors on Customers - Bitcoin Fixes This","duration":2879},
                {"id":"S2WPt7ZO1rk","title":"Bitcoin Touches 13-Month High - Valkyrie Refiles for Spot ETF (CNBC)","duration":701},
                {"id":"FfM3RrM3cDQ","title":"Satoshi Nakamoto's Old Wallet Format Could Be Quantum Computing's Easiest Target","duration":59},
                {"id":"3TeJHOceTJE","title":"Politicians Cannot Control Bitcoin!","duration":48},
                {"id":"VujZYyPXKxo","title":"BITCOIN LIVE : BTC ROLLER COASTER, RUSSELL 2000 ATH! 420 STREAM","duration":5898},
                {"id":"HJ5gAg9F0Ok","title":"Bitcoin Supply Shock Incoming!","duration":23},
                {"id":"6FdfT3KZ04I","title":"Russell Okung: NFL Players Bought Bitcoin Because They Believed in Me","duration":98},
                {"id":"BcZlcZBix28","title":"Jack Mallers: Donald Trump Needed Bitcoin — Bitcoin Didn't Need Him","duration":106},
                {"id":"IF13rALnr48","title":"Balaji Interview: The American System is Breaking - Bitcoin is the Escape Plan","duration":4492},
                {"id":"VLWUAgYOBv0","title":"LIVE: Bitcoin for Corporations - Day 2 | Strategy World 2026","duration":31401},
                {"id":"CyVyCOHODk4","title":"Ted Cruz: Why the Left Hates Bitcoin and Cryptocurrencies","duration":1386},
                {"id":"LGYcl4hwUOI","title":"Bitcoin at 200-Week Moving Average - Buy Signal?","duration":682},
                {"id":"-LPit2bEWAo","title":"BlackRock CEO on Bitcoin ETF Success - CNBC","duration":353},
                {"id":"9kdZHs5DXYo","title":"US Strikes Iran, Banks Lobby Against Stablecoin Bill & Why AI's Future Chooses Bitcoin | BPH Ep 30","duration":3668},
                {"id":"8MKP-Su-cvg","title":"Bitcoin Update: ETF-Buyers, BTC Dominance, Stocks Correlation - The Bitcoin Layer","duration":795},
                {"id":"VB7taeOBHZE","title":"RABBIT HOLE RECAP #395: STAY HUMBLE AND STACK SATS","duration":6604},
                {"id":"Z8mMQ12ej2c","title":"Bitcoin MENA 2025 | Day 2 Livestream","duration":33671},
                {"id":"t781m-jnwlE","title":"Arthur Hayes: Why $1M Bitcoin Is Simple Math","duration":60},
                {"id":"1aZmvheAW58","title":"Michael Saylors Latest $1B Bitcoin Buy Changes Everything | EP 1482","duration":5851},
                {"id":"zo1pZlgAvpY","title":"Is This the Final Bitcoin Crash Before All-Time Highs? - Simply Bitcoin","duration":1208},
                {"id":"gij6bJkyH2w","title":"Individual Ownership Peaked in 2024 and What Comes Next for Bitcoin - The Bitcoin Layer","duration":2395},
                {"id":"diF93mE7nqg","title":"Bitcoin Rises to All-Time High","duration":75},
                {"id":"EoPrAGei8W4","title":"Rabbit Hole Recap: Bitcoin Week of 2020.12.28","duration":6121},
                {"id":"Q_FFfWvq-z8","title":"CNBC: The Greatest Crypto Bull Run Of Our Lifetime HAPPENING NOW","duration":527},
                {"id":"jXjelwCFC9A","title":"Saifedean Ammous: Economic Incentive Is What Always Wins with Any Currency","duration":91},
                {"id":"kWrIHMV3PMM","title":"Bitcoin's Energy Use: Debunking the Climate Myth!","duration":129},
                {"id":"eUEfZ4Gbl7c","title":"Saylor's STRC Is Accelerating The Bitcoin Bull Run | Rabbit Hole Recap #405","duration":7498},
                {"id":"ymN5RDDycmU","title":"Peter Schiff Admits He's Bitcoin's Greatest Salesman","duration":41},
                {"id":"DVHvATfMldg","title":"Rabbit Hole Recap 231: There's a run on the bitcoin banks!","duration":8338},
                {"id":"sibP8Rt3ePw","title":"Bitcoin EXPLOSION Imminent? Billionaires & Politicians BET BIG!","duration":33},
                {"id":"RIPIG7YBh8s","title":"RECESSION WATCH, Economic Update, & SOFR Trouble - The Bitcoin Layer","duration":1940},
                {"id":"DDzBbXDQDeg","title":"Bitcoin Fixes Fiat's Leaky Bucket","duration":119},
                {"id":"IIx1sJX1c_0","title":"Adam Back: If They Know You Have Bitcoin, They'll Sweat You For It","duration":64},
                {"id":"xiNKd-1ExA8","title":"Building Japan's Bitcoin Standard w/ Simon Gerovich | Strategy World 2026","duration":892},
                {"id":"K4ciiDyUvUo","title":"Larry Fink: Bitcoin is Digital Gold - CNBC","duration":153},
                {"id":"grSXA-0EjaE","title":"From Substack Writer to White House Bitcoin Correspondent","duration":49},
                {"id":"yJcd0oauPjc","title":"Is Bitcoin Overtaking Gold?","duration":33},
                {"id":"bOBiu9zP5jA","title":"Bitcoin Owner Will Lose $260 Million If He Can't Remember Password - TODAY","duration":186},
                {"id":"UrmY3F8VBmM","title":"LIVE: Bitcoin for Corporations - Day 1 | Strategy World 2026","duration":22564},
                {"id":"W-ArTN0Xj4c","title":"Bitcoin Surges and Vanguard Allows Crypto ETF Trading - CNBC","duration":793},
                {"id":"8hyuhziDWoQ","title":"Bitcoin Market Insights: Mt. Gox, ETF Flows, and Short-Term Holder Analysis - The Bitcoin Layer","duration":1407},
                {"id":"IsSiNri5pkI","title":"🔥Krypto: BREAKING NEWS! Weitere Eskalation! Bitcoin und Altcoin Live-Trading🔥","duration":7924},
                {"id":"kxZa2ya-W3M","title":"Russell Okung: Why I Became the First NFL Player Paid in Bitcoin","duration":27},
                {"id":"dEnbFU-HySk","title":"Shark Tank's Robert Herjavec Says Bitcoin Price Will Skyrocket Again - CNBC","duration":144},
                {"id":"eqFDi_OYVj8","title":"Rabbit Hole Recap 226: FTX BLOWS UP - Takes House of Cards with it, MOVE BITCOIN OFF EXCHANGES","duration":8264},
                {"id":"MGalqKZKTy4","title":"MicroStrategy's Billion Dollar Bitcoin Strategy Revealed!","duration":32},
                {"id":"N7Z7tpwSlBg","title":"Strategy CEO on 2026 Bitcoin Outlook - Fox Business","duration":603},
                {"id":"9RRaWDNj3Zk","title":"The REAL Truth About STRC — Saylor's Risky Genius Exposed!","duration":1256},
                {"id":"ipvIaHKN9ts","title":"Every Time The Media Buried Bitcoin","duration":56},
                {"id":"iQOiQZ_g97I","title":"Wall Street Week - The Crypto Craze","duration":122},
                {"id":"UbvZmjfE46I","title":"Jack Mallers: You're Better Off on Bitcoin's Team Than Standing in Its Way","duration":63},
                {"id":"c3t4CHROkg8","title":"This Data Says Bitcoin Is About To Explode | Are You Ready?","duration":720},
                {"id":"DyMVHXz9Tgs","title":"Bitcoin ETFs Survive First Stress Test - Bloomberg","duration":2644},
                {"id":"5gUy_BWAtcM","title":"Bitcoin's Road to $400K","duration":83},
                {"id":"qjRxtYpTC70","title":"Trump, Iran, and Bitcoin: The Strait of Hormuz Scandal Exposed!","duration":67},
                {"id":"kh-YqlKC23k","title":"Why Bitcoin Is Still King in 2025 - USA & UK Adoption","duration":170},
                {"id":"7RkbxNOWb-8","title":"Bitcoin's Next Move: Banks, ETFs, and Market Signals","duration":37},
                {"id":"JYM69n6IIxw","title":"What the US Government Is Planning for Bitcoin in 2026","duration":5379},
                {"id":"GJ1yyHGJr3U","title":"Dylan LeClair: Bitcoin Is Cracking the Corporate Matrix","duration":38},
                {"id":"wC4nzqrgvik","title":"Iran Used Bitcoin To Break US Sanctions - Simply Bitcoin","duration":492},
                {"id":"REuLN4ycfEI","title":"Bitcoin OG Explains The Shift Nobody Talks About","duration":5447},
                {"id":"IlgJYb-AzlY","title":"🚨LIVE US BÖRSENSTART! Neue Woche - Neue Bärische Aussichten! Kann Bitcoin weiter Stand halten?","duration":10286},
                {"id":"XXOPGpPdxXQ","title":"Bitcoin's SHOCKING Rise to $76K: What's REALLY Happening?","duration":81},
                {"id":"wR6SJgMnstE","title":"Using Bitcoin as an Inflationary Hedge","duration":281},
                {"id":"gwIF2pcrkdA","title":"Bitcoin Defies Global Economics!","duration":55},
                {"id":"L0_eUNCtPgU","title":"Bitcoin Hits $78K!!!","duration":59},
                {"id":"ufjJhl7HVOc","title":"Donald Trump: \\\"Never Sell Your Bitcoin\\\"","duration":121},
                {"id":"EqUTGjyRvAE","title":"🚨BITCOIN LIVE TRADING: ACHTUNG US BÖRSENSTART!!! 🔥🔥🔥","duration":27665},
                {"id":"EUlq4iW3QhI","title":"Natalie Brunell on the Sovereign Bitcoin Race Worldwide | Bitcoin Magazine Podcast Ep 7","duration":3177},
                {"id":"hSlcy29ETjQ","title":"Bitcoin Update: $500-Million ETF Inflows, Market Absorbs Mt. Gox BTC, $50K Level Defended - The Bitcoin Layer","duration":1141},
                {"id":"gyhh2bFBa6g","title":"STRATEGIC BITCOIN RESERVE WITH ODELL AND MARTY BENT: RABBIT HOLE RECAP #347","duration":4897},
                {"id":"jmUnGP3lDhY","title":"Rabbit Hole Recap: Bitcoin Week of 2021.05.24","duration":7245},
                {"id":"vGktxX58Cqk","title":"BlackRock's Bitcoin Buy & Global Geopolitics Shift!","duration":75},
                {"id":"BSiQHfEUabI","title":"Bitcoin Hits New All-Time High - CNBC","duration":128},
                {"id":"x8wQ4Ws9pSU","title":"Former Government Insider: What Happens If China Acquires 2 Million Bitcoin First?","duration":5670},
                {"id":"5-CPkVESKz8","title":"Iran Is Collecting Bitcoin!","duration":91},
                {"id":"uX4jfBZWpkY","title":"What's Behind Bitcoin's Remarkable Surge?","duration":63},
                {"id":"b_u1O9qzG6U","title":"Big Bitcoin Adoption News!","duration":1517},
                {"id":"5c03NCvohCA","title":"Bitcoin ETF Record Performance - Bloomberg","duration":927},
                {"id":"e2YOEaQiZZc","title":"Wargaming the Oil Crisis, Bitcoin's Role in US-China Competition, & AI Agent Payments | BPH Ep 31","duration":3665},
                {"id":"xDUZKNpIKRs","title":"Donald Trump: \\\"Bitcoin Is Not Threatening the Dollar. Washington Is.\\\"","duration":42},
                {"id":"XRurouuH9uE","title":"The Morgan Stanley Bitcoin Takeover just Accelerated! (Here's The Proof) | EP 1481","duration":5098},
                {"id":"R8DFZkPggeE","title":"Bitcoin's Growth Is Proof We Don't Need Inflation","duration":54},
                {"id":"omyLCxja20g","title":"FED Sabotages the Bitcoin Bank - Simply Bitcoin EP 601","duration":4169},
                {"id":"n-_lzEfVfwI","title":"How Bitcoin Is Quietly Sparking Change Around the World","duration":41},
                {"id":"5hfmQhB31TU","title":"Saylor Predicts Bitcoin WON'T Stop PUMPING | Rabbit Hole Recap #361","duration":6874},
                {"id":"c1qQiRQUdJo","title":"Bitcoin's Massive Supply Shock Incoming!","duration":57},
                {"id":"KM4GaSiJFYo","title":"Why The Quantum Problem Affects Bitcoin More Than Banks Or Any Other Industry","duration":50},
                {"id":"-GYg7kJFLvs","title":"Money Yield: The Perpetual Motion Machine of Finance","duration":48},
                {"id":"G0csA1i4rtU","title":"Bitcoin ETFs Explained: The Future of Crypto in 2025","duration":745},
                {"id":"inSLOPC8grc","title":"Bitcoin: Better Than Bonds","duration":788},
                {"id":"pRM3MVZs9Kg","title":"Bitcoin Servers: Professor Jiang's Biggest Myth Exposed!","duration":66},
                {"id":"t4uCA6RNHkg","title":"Elon Musk: The Root Problem Is The Money!","duration":36},
                {"id":"XNzcJ3NWqS4","title":"Bitcoin Story: 4th Grade Lesson on Money & Value","duration":50},
                {"id":"BL4EuamrVB0","title":"FIRST BITCOIN COMPANY IN THE S&P 500 | Rabbit Hole Recap #367","duration":7856},
                {"id":"26amYt4DB-s","title":"Bitcoin Approaching A KEY Support Level... Will It Bounce Or Break? - The Bitcoin Layer","duration":904},
                {"id":"JvP2BJFdWVM","title":"Eric Trump: \\\"The Bitcoin Revolution Isn't Coming. It's Already Here.\\\"","duration":49},
                {"id":"-7qeECTonLw","title":"Bitcoin's Most Accurate Model Reveals Exactly When Bitcoin Hits $22M | Matthew Mežinskis","duration":6821},
                {"id":"DnT8bUl_DM8","title":"Bitcoin Is Being Repriced by AI","duration":947},
                {"id":"ODJ-FpEIQvc","title":"Dr. Jack Kruse Exposed Every Fraud In Bitcoin","duration":5641},
                {"id":"WaEBc2prSPE","title":"Next-Gen Bitcoin ETFs Outperforming - Bloomberg","duration":2680},
                {"id":"9bXvWZM5TAQ","title":"NEW REPORT: $3.41T Giant SENDS HUGE BITCOIN WARNING [FULL BREAKDOWN] | EP 1472","duration":5067},
                {"id":"ILT8CwA518M","title":"Peter McCormack: How Real Bedford Won 7 Trophies With Bitcoin","duration":91},
                {"id":"JAya0jNyr4M","title":"Bitcoin Live Trading: Fakeout or Full Send?! BTC at CRITICAL LEVEL EP1975","duration":7971},
                {"id":"a4Dt2DUghT4","title":"The Separation Of YOUR Money And Government Is Finally Happening","duration":53},
                {"id":"uufo1hejgJE","title":"The ONLY Gold Standard That Actually Worked","duration":51},
                {"id":"9xt97nMkRNc","title":"Bitcoin: The Unstoppable Force vs. Manipulation","duration":69},
                {"id":"PpOd8joKdcY","title":"Understand the Risk, See the Opportunity With Bitcoin","duration":79},
                {"id":"L9dlmSYsHFs","title":"🔴 LIVE Bitcoin Trading! Achtung: Droht JETZT der nächste DUMP?","duration":11856},
                {"id":"OyA6eKmys4E","title":"Strategy Buys 4,000 Bitcoin in 30 Minutes | Bitcoin's Price Floor Just Changed FOREVER","duration":1005},
                {"id":"ZsLUgWEKFJI","title":"Bitcoin: The Future is Here. Are You Ready?","duration":53},
                {"id":"2F9Ol9cNrm4","title":"Iran War Affecting America's strategic BTC Reserve?","duration":72},
                {"id":"l1OR3gxO8U8","title":"Arthur Hayes: The 3 Things That Send Bitcoin to $1,000,000","duration":80},
                {"id":"VR_YrY6qBQw","title":"Bitcoin's Surging Price: Global Chaos Fuels Bitcoin!","duration":47},
                {"id":"7n8LaaPkROw","title":"JD Vance: If China Hates Bitcoin, The US Should Love It","duration":124},
                {"id":"HOYnvEVOTJA","title":"Simply Bitcoin - Daily News Update","duration":4561},
                {"id":"nTJW3b0sHBs","title":"Citi & Morgan Stanley: Bitcoin Price Surge Is Near!","duration":69},
                {"id":"QgzEKIVgB_M","title":"Bitcoin: Jetzt entscheidet sich alles! + Live Trading --- 🔴","duration":7450},
                {"id":"OvmzIyOqgRU","title":"How A Bitcoin Journalist Got Inside Trump’s White House | Bitcoin Magazine Podcast Ep 5","duration":4620},
                {"id":"wip8XgpSocI","title":"The Mainstream Media Is LYING to You About Bitcoin!","duration":982},
                {"id":"yvkmOa4XSrg","title":"Big Beautiful BITCOIN | RABBIT HOLE RECAP #364","duration":5189},
                {"id":"TfjSdlopmrk","title":"Commercial Real Estate Update: Property Is DOWN 30%, Equity Is GONE - The Bitcoin Layer","duration":1545},
                {"id":"rweDTKgv96Y","title":"Simon Dixon | How The Banking System Turned YOU into a DEBT SLAVE","duration":4169},
                {"id":"CbEHD0esI_A","title":"MicroStrategy Bitcoin Reserve Strategy - CNBC","duration":110},
                {"id":"yeZnFzYjwW0","title":"Jack Mallers: I Price Bitcoin the Same Way I Value My Life","duration":71},
                {"id":"q9luFpyJTaw","title":"The Monetary Singularity Is Here And Everyone Is Asleep!","duration":1260},
                {"id":"Eds4tmPrs9s","title":"Bitcoin's Hidden Signals REVEALED in the TBL Chart Pack - The Bitcoin Layer","duration":3181},
                {"id":"EeDvxILLdXI","title":"You'll Pay The Price For Bitcoin That You Deserve","duration":47},
                {"id":"b3WwE75J5nE","title":"How To Unlock Returns with Bitcoin!","duration":55},
                {"id":"H3a2M8C7yM0","title":"$100K BITCOIN WITH ODELL AND MARTY BENT: RABBIT HOLE RECAP #334","duration":5711},
                {"id":"InoqMzIarF0","title":"Inside Bitcoin's Trend Shift: Bear Zone, Liquidations, & Key Support - The Bitcoin Layer","duration":2937},
                {"id":"iuoj2DMpww8","title":"CLARITY Act: Tether's Role in US Dollar Hegemony & Bitcoin","duration":112},
                {"id":"zyUxPX7Mp2U","title":"Bitcoin Could Go Past $100k This Year - Chainalysis CEO","duration":297},
                {"id":"Mk8uyKUYy50","title":"Bitcoin ETF Launch: Banks Bet on Crypto's Future!","duration":33},
                {"id":"c3LyvfHQ9BE","title":"Why Bitcoin Booms in October - Simply Bitcoin","duration":717},
                {"id":"-z3QYaeVNlk","title":"Bitcoin's Geopolitical Future: Iran's Sanctions & Trump's Reaction!","duration":78},
                {"id":"241nNtbdXaA","title":"Bitcoin Experts Predict 2025 Will Be the Year of Mass Adoption","duration":883},
                {"id":"4AGJRX2BYsE","title":"The Greatest Lie Ever Told Is The Dollar In Your Pocket","duration":1153},
                {"id":"0sGgpNg_2IM","title":"Bitcoin Tops $100K - Big Finance Admits Wrong (The Bitcoin Group #433)","duration":6965},
                {"id":"QWdT3978z_k","title":"DOLLAR ENDGAME: How the Iran War Destroyed the System It Was Trying to Save","duration":1653},
                {"id":"yIID9ubQLgk","title":"Beyond the Headlines: How to Really Understand Financial Markets. - The Bitcoin Layer","duration":1774},
                {"id":"nqWxMp6DeSc","title":"Rabbit Hole Recap: Bitcoin Week of 2021.06.14","duration":7636},
                {"id":"DzAWHsa-zP0","title":"#172: RABBIT HOLE RECAP - New Bitcoin All Time High","duration":8696},
                {"id":"vNOW8qQZ67o","title":"BREAKING: First US Bank Launches Bitcoin ETF and it's NOT Who You Think | EP 1477","duration":4807},
                {"id":"qIvVWHfitb8","title":"Bitcoin's Most Accurate Model Predicts MASSIVE Price Surge By Year-End! | Matthew Mežinskis","duration":6384},
                {"id":"G_iI651Z8Is","title":"Winklevoss: The Gold Framework for 1M Dollar Bitcoin","duration":38},
                {"id":"Bb-4dtPc_20","title":"Jack Mallers: Gold Failed Humanity, So We Engineered Something Better","duration":106},
                {"id":"Ac9-_2oTJJw","title":"Money's Value: Why Your Dollar Isn't What It Seems","duration":42},
                {"id":"Fkf194LYPgU","title":"How Close is Quantum Computing to Breaking Bitcoin?","duration":85},
                {"id":"iN_lKjryY5A","title":"Coinbase Puts To Rest Their Fight With The Bitcoin Community","duration":32},
                {"id":"Mf8o5UUaBZ0","title":"Bitcoin vs. Gold & Dollar: A New Financial Era","duration":34},
                {"id":"vk9aIjHBKuw","title":"Btc Live Trading | Crypto Live Trading | Live Trading | Live Crypto Trading | Bitcoin Live Trading","duration":15752}
            ]
        },
        {
            "id": "podcasts-debates",
            "name": "Podcasts, Debates & Spaces",
            "emoji": "🎙️",
            "desc": "Long-form Bitcoin conversations, debates & recorded X Spaces",
            "color": "#ef4444",
            "videos": [
                {"id":"hTsJHCFG6n0","title":"76. Homeschooling with Daniel Prince​ | The Bitcoin Standard Podcast","duration":5389},
                {"id":"TUO10-HcdvY","title":"The Ultimate Bitcoin vs. Everything Debate Loop","duration":2923},
                {"id":"OiQBMFuRodE","title":"311. The Bitcoin vs Gold Debate: Saifedean Ammous vs Peter Schiff","duration":3045},
                {"id":"zYUspccYxXA","title":"The Real Reason Bitcoiners are Joining Climate Protests","duration":5405},
                {"id":"tnLS6oI9K1k","title":"Twitter Space AMA with Simon Dixon & Plan C - Discussing Celsius Chapter 11 and more | 09.09.2022","duration":11222},
                {"id":"M2lkYHuAskk","title":"Strive: Amplified Bitcoin Exposure Engine with Matt Cole | SLP710","duration":4136},
                {"id":"aO-KlhO-cyQ","title":"The Hidden War on Your Meat Supply Nobody Wants You to Know About w/ Casey Parker","duration":4243},
                {"id":"C5aN5yHbAzE","title":"Macro Breaking Point: Iran, AI & Why Bitcoin is the Ultimate Growth Asset with Jordi Visser","duration":2195},
                {"id":"iYLbtVutcDQ","title":"HOUSING MARKET CRISIS Is Developing with Melody Wright - The Bitcoin Layer","duration":2044},
                {"id":"gUao53ovces","title":"Opting out of the #Chinese system by using #Bitcoin is an act of protest","duration":58},
                {"id":"Rmh6WGxHYNE","title":"What is the IMF and do they like Bitcoin?","duration":11},
                {"id":"X7ua58iwcd4","title":"OpenClaw and Self Sovereign AI w/ Alex Gladstein & Justin Moon (TECH015)","duration":3929},
                {"id":"lC-jN7McpRU","title":"S16 E31: Andrew Camilleri \\\"Kukks\\\" on Ark, BTCPay & Bitcoin Open Source Software","duration":12157},
                {"id":"ivdnEb45x6w","title":"Why 21M Bitcoin Won’t Exist Until 2140","duration":83},
                {"id":"AE5Qj9WEp7A","title":"Chat_142 - Ai, Bitcoin and 5th Generation Warfare with Jordan and Average Gary","duration":7688},
                {"id":"ko27xXMTMG8","title":"The Global Debt Bubble has No Escape Valve | Eric Yakes","duration":6055},
                {"id":"-3D--AjAhIw","title":"The Bank-State War Machine, Counter-Elites & Digital Slavery with Natalie Smolenski","duration":2615},
                {"id":"FLive_w-3jc","title":"Bitcoin Fixes Capitalism | Allen Farrington x Peter McCormack","duration":8511},
                {"id":"Z6eE5WJW-WI","title":"Is the Quantum Threat to Bitcoin Actually Real? | Alex Pruden","duration":4659},
                {"id":"rVFRWOK9Bqc","title":"Twitter Spaces AMA recording 🔴 | Emergency Broadcast - FTX Chapter 11 | 11.11.2022","duration":4315},
                {"id":"IYOpQ2RYhpI","title":"Inside the Global Liquidity Shift Powering Bitcoin with Dr. Jeff Ross - The Bitcoin Layer","duration":2765},
                {"id":"u5I76GF5gMI","title":"CFA EXPLAINS: 3 lessons to get rich with Bitcoin","duration":676},
                {"id":"lXaCwTrYQ8g","title":"TPB106 - What Happened to The Progressive Movement? with Margot Paez","duration":7058},
                {"id":"g6FVDJsCGE8","title":"What Private Equity Doesn't Want You To Know","duration":3799},
                {"id":"F0DgYow85hI","title":"Bitcoin Mastermind Q4 2024 w/ Joe Carlasare, Jeff Ross, & American HODL (BTC213)","duration":4626},
                {"id":"b2UzxUDnOTQ","title":"Miami: The Bitcoin City with Mayor Francis Suarez","duration":3278},
                {"id":"DXn4KolDiMY","title":"5 Years In Prison For Building A Bitcoin Wallet | Lauren Rodriguez","duration":3766},
                {"id":"XWp4qcDXHsY","title":"Zuby on COVID, Clown World & Why Bitcoin Wins | BIS #193","duration":3820},
                {"id":"VxZUGJGw9h0","title":"Vlad Costea on Bitcoin and Inflation in Romania, TcConf 2019, Cluj, Romania","duration":1994},
                {"id":"t-7GGhmipt0","title":"Operation Chokepoint 2.0: The Fed's Secret War on Crypto with Caitlin Long - The Bitcoin Layer","duration":3498},
                {"id":"8m7YyAfcubs","title":"Bitcoin Adoption Runs On Imitation","duration":54},
                {"id":"ikPnr23h7qg","title":"Proof of Stake (PoS) Versus Proof of Work (PoW) w/ Jason Lowery (BTC098)","duration":7963},
                {"id":"29u-F8O8WAA","title":"The Physics of Bitcoin with Giovanni | SLP732","duration":3553},
                {"id":"mz4gfO1qo8Y","title":"Lyn Alden: Bitcoin’s Energy Usage Isn’t a Problem. Here’s Why. (Twitter Spaces Live Stream)","duration":8549},
                {"id":"TAfOwAas250","title":"Forensic Accountant Just Exposed A Trillion Dollar Crisis | Nick Nemeth","duration":4651},
                {"id":"HQHg8uCbiQk","title":"Someone Quietly ACCELERATED The Bitcoin Supply Shock","duration":1812},
                {"id":"U3fQvvEecc0","title":"Too Soft To Fork? | THE BITCOIN BRIEF 68","duration":4161},
                {"id":"jlVLCeHxQ2M","title":"Nic Carter - Proof of Work vs Proof of Stake: Bitcoin Magazine Spaces","duration":5588},
                {"id":"Lyu5CfME3e8","title":"StartOS v0.4 with CryptoSquid | FREEDOM TECH FRIDAY 36","duration":3546},
                {"id":"G3KMjMkf9V4","title":"$1B monthly volume on lightning with Sam Wouters | SLP725","duration":3235},
                {"id":"7xmzjZimgbw","title":"0.1 Bitcoin Will Be Impossible To Own (They're Making Sure Of It)","duration":931},
                {"id":"6WxdkRk8cs4","title":"Stephan Livera: Bitcoin Education Deep Dive","duration":3706},
                {"id":"XNS1Qs2n0Uc","title":"Eric Weinstein on Bitcoin","duration":8767},
                {"id":"XJU8r6WiipM","title":"Bitcoin vs Gold - Response to Peter Schiff","duration":1690},
                {"id":"JHRBmuA8ba0","title":"Bruce Fenton - The spirit and mission of Bitcoin was bringing meaningful change to the world.","duration":76},
                {"id":"3CEROEMaebM","title":"Reflections on Satoshi with Adam Back and Pete Rizzo - Bitcoin Magazine Podcast","duration":2883},
                {"id":"meCoGKugjMQ","title":"Marty Bent on the Power of Bitcoin","duration":3155},
                {"id":"OfWJSEmDiKI","title":"Will Bitcoin Survive the Spam Wars?","duration":496},
                {"id":"8q2ADElnxcc","title":"Will #Bitcoin save you?","duration":66},
                {"id":"Vv_zB7WkgyI","title":"The Setup for Bitcoin's Most Violent Move Yet Is Already in Place | Peruvian Bull","duration":4022},
                {"id":"CtIjpJ5-qYs","title":"They Found What The COVID Vaccines Leave Inside You Then The Cover-Up Started","duration":4024},
                {"id":"MGdCLNmc5zc","title":"Voyager Creditors - You Can Do Better | Simon Dixon Twitter Space Recording 🔴","duration":7360},
                {"id":"hC-I9YXEP_c","title":"The System Cannot Survive What’s Coming | Jeff Booth","duration":4285},
                {"id":"UsZuXMNx75U","title":"BTC Prague 2026 with Matyas Kuchar | SLP733","duration":2523},
                {"id":"aADg9rQFWxc","title":"Bitcoin at $75k...next Stop $100k?","duration":5291},
                {"id":"5knRPPlLCVg","title":"Burner vs other wallets","duration":42},
                {"id":"iNrsC2P_ydA","title":"Vitalik Buterin: Ethereum is a Bitcoin Sidechain","duration":97},
                {"id":"NAG9gD5zC2w","title":"Lobby groups and influence with Susie Ward on #tpbpod #podcast #bitcoin","duration":48},
                {"id":"qtOPcQTiPBM","title":"76. Thomas Massie vs Donald Trump","duration":6671},
                {"id":"MmdQKU0YNX4","title":"Bitcoin Will Hit $850K - Max Keiser Prediction","duration":977},
                {"id":"mEbfbAllsO4","title":"Twitter Spaces recording | Halloween Special - 10 Scariest Moments in #bitcoin & #crypto","duration":3353},
                {"id":"CjCKDojQLYI","title":"This Has Only Happened 4 Times In 50 Years. This Time Bitcoin Exists.","duration":970},
                {"id":"AxANOz8ghm4","title":"Bitcoin Is a Brilliant Scam and I Can Prove It (⁨@CasuallyFinance⁩ video review)","duration":2703},
                {"id":"2ZaMzWZyXe8","title":"Wall Street Meets Bitcoin: Orange-Pilling Finance - Strive CEO","duration":1348},
                {"id":"HR-D-3xsRls","title":"How to get more Bitcoin if you own real estate","duration":680},
                {"id":"XaNNNp6JuYI","title":"Proof Of Work - Fuck Around And Find Out T-Shirt #proofofwork #bitcoin","duration":17},
                {"id":"3xaHgh8WL-w","title":"Does Bitcoin Bring More Love Into the World? Jeff Booth Answers","duration":68},
                {"id":"P3SrVRiEn9k","title":"Maximalism and The Right To Own Your Money - Twitter Spaces","duration":5720},
                {"id":"lmPmRxurssU","title":"Bitcoin vs. Crypto: Why Bitcoin Only - Twitter Spaces","duration":6588},
                {"id":"_8bmmgOJsIQ","title":"Wall Street's Secret Plan to Suppress Bitcoin Prices for US Government Accumulation | Vince Lanci","duration":6279},
                {"id":"jYzKvJiKnO0","title":"Peptides, Fasting, and the Future of Longevity w/ Miguel & Carlos","duration":10491},
                {"id":"YQtkZsStZh4","title":"God Bless Bitcoin w/ Jeff Booth, Mark Moss, Stephan Livera, and Brian Dixon","duration":1836},
                {"id":"yWTLczpO808","title":"RISE of the American Empire with Brent Johnson - The Bitcoin Layer","duration":3428},
                {"id":"QT_YDxTl1FQ","title":"Jack Mallers: Bitcoin Maximalist Post-GENIUS Act","duration":1621},
                {"id":"h-JBUhG2nrw","title":"Mark Yusko: The Bitcoin Price is a Liar - Why to Watch Gold | Bitcoin Magazine Podcast","duration":5596},
                {"id":"_J_QXAQ8vxk","title":"Bitcoin for Beginners Q&A with Guy Swann (Clubhouse Audio Stream)","duration":9875},
                {"id":"D9_vFNt5ops","title":"TWITTER SPACES: POST $ETH MERGE! FASTER? CHEAPER? WHAT ABOUT #MINERS?","duration":6138},
                {"id":"q3_OlLs_9wE","title":"Saylor Wants to Convert the Entire System — The MNAV Cycle Explained | Ep 268 Clip","duration":931},
                {"id":"_0zMFfvXblA","title":"Pomp Podcast #248: Preston Pysh Explains Why Bitcoin's Volatility is a Feature, Not a Bug","duration":5066},
                {"id":"1U7MnwPVuvc","title":"Guns N' Glazes | THE BITCOIN BRIEF 72","duration":3363},
                {"id":"UDYk9bVlvTo","title":"Improving SimpleX w/ Evgeny from SimpleX and Daniel Keller from Flux","duration":4065},
                {"id":"sBZuvWUjgbM","title":"HODL Magoo, who are you?  Is he bearish, and Volcano Bond concerns - BMS 053","duration":5109},
                {"id":"c5mYqPZyvQY","title":"Taunton Firefighters make history adding #Bitcoin to balance sheet #firefighter #union #progressive","duration":58},
                {"id":"XQWyq0ch0c4","title":"What we Learn from Occupy Wallstreet for the Upcoming Election with Alan Minsky","duration":5598},
                {"id":"LxkwUXo5VUQ","title":"They're Panicking. We're Not.","duration":3403},
                {"id":"T6yiueyLYNo","title":"Proof of Work vs Proof of Stake - BM Pro Twitter Spaces","duration":4946},
                {"id":"UPqXkAmygHQ","title":"Worldcoin: The GAP In Consciousness #DigitalID #1984 #MakeOrwellFiction #cryptoscam","duration":316},
                {"id":"yCtVkIEIhCg","title":"Bitcoin Can Never Go to Zero - Robert Breedlove","duration":442},
                {"id":"0oKW_NChFPk","title":"Bitcoin vs Crypto: Svetski vs Bitboy - Bitcoin Magazine LIVE #25","duration":8541},
                {"id":"bhSGC08V47U","title":"Stephan Livera on Bitcoin Maximalism","duration":2547},
                {"id":"Yc3nuGCZKB0","title":"UTXOs, Spam & Bitcoin's Integrity with Martin Habovstiak | SLP729","duration":3510},
                {"id":"f2OyRTu8x3A","title":"The Real Robotics Timeline w/ Ken Goldberg (TECH010)","duration":3435},
                {"id":"zDzEyhF2G8U","title":"John Carvalho - Redefine Bitcoin's Base Unit","duration":34},
                {"id":"l1Rgq8UY3zo","title":"Why Bitcoin is Different - Stephan Livera","duration":669},
                {"id":"yLl00j5p8Nc","title":"Mark Cuban debating #Bitcoin on spaces","duration":1114},
                {"id":"B3gTk4M8ZKY","title":"The Rich Own Nothing, Except Bitcoin","duration":917},
                {"id":"oieuMELB-CI","title":"Fluffy Pony - AI Agents money","duration":72},
                {"id":"lEgxtmKld0I","title":"The Hidden System Running the World and How You Can Escape It with Simon Dixon","duration":4941},
                {"id":"whWGMiE7hbs","title":"Why do so many people lose money when they buy Bitcoin?","duration":690},
                {"id":"nMicPEQM4HY","title":"Maximalism is Dead? | Peter McCormack","duration":1542},
                {"id":"V4LwatVM5Vg","title":"Bitcoin Street Interviews [Bristol, 2021]","duration":962},
                {"id":"7tW_OQ-z3mI","title":"Bitcoin & Current Market Conditions w/ Preston Pysh (Twitter Spaces 02/10/2022)","duration":4079},
                {"id":"3j8iFIZ4TGM","title":"I Went Down a Eurodollar Rabbit Hole with AI - The Bitcoin Layer","duration":1969},
                {"id":"Mi_Y2jGxOx4","title":"The Dollar Is the Titanic… And Most People Are Still Dancing","duration":403},
                {"id":"0anySRVB404","title":"Luke Gromen Global Macro and Bitcoin Q1 2025 (BTC215)","duration":3948},
                {"id":"w8JXdYmllZ4","title":"US dollars on Bitcoin Lightning w/ Luke Gromen & Preston Pysh (BTC220)","duration":2512},
                {"id":"3NiTwVBzt9I","title":"He Found Bitcoin on a 13-Year-Old Hard Drive. Now He's Fixing It. | Josh @secsovereign | #270","duration":4549},
                {"id":"FqWGQZJevH0","title":"245. Strike with Jack Mallers","duration":5629},
                {"id":"Hz-KrFDpRsk","title":"The Bitcoin Revolution w/ Jack Mallers & Dylan LeClair","duration":2874},
                {"id":"DiRj_LfZw9E","title":"S17 E17: Lukas Hozda on BIP110, Bitcoin & Rust","duration":5959},
                {"id":"RO1IfGz4W9w","title":"Blockware Intelligence Twitter Space 4/27/2022","duration":3129},
                {"id":"3uPJzCbO5eo","title":"Bitcoin's iPhone Moment — STRC & the Conversion of the Financial System | Ep 268","duration":6433},
                {"id":"XSqpDgF5TXY","title":"is this the next bitcoin hub??","duration":83},
                {"id":"2nFniJp3Zfs","title":"Prime Time with Q | FREEDOM TECH FRIDAY 37","duration":3568},
                {"id":"xbE591bPcY4","title":"This could be the END of Bitcoin (@ProfSteveKeen video review)","duration":3316},
                {"id":"a6axEr17jAw","title":"Corrupt academics and politicians w/ Peter St Onge #bitcoin #freedomtech #freedomofspeech #economics","duration":60},
                {"id":"Mg-A9f_YevA","title":"Monetary Domination & The Death of Thought | Bradley Rettler","duration":5848},
                {"id":"KLi_u6r0vYU","title":"Jerome Powell CANNOT Fix Inflation","duration":1004},
                {"id":"vx4n9dxVHHM","title":"BR097 - Cove Wallet, Harbor, Sparrow, JoinMarket, Coinbase Breach + MORE ft. Praveen, Ben & Paul","duration":4368},
                {"id":"GCjTQTx8bdo","title":"Cameron's original interest in BTC","duration":53},
                {"id":"x0kNGaxLg18","title":"Lyn Alden: Why This Bitcoin Cycle Disappointed - Coin Stories","duration":3319},
                {"id":"HwNSykjO-gI","title":"Lyn Alden: Changing World Order - Coin Stories","duration":3629},
                {"id":"VrIJgf5IEhY","title":"This Is The Macro Reset | Nik Bhatia","duration":5093},
                {"id":"IODFNfSIesk","title":"Former Combat Vet On Bitcoin, Gold, And Firearms w/ Alex Stanczyk","duration":5730},
                {"id":"YYJ_Le97ldA","title":"The Debt Crisis Is Already Here | Lyn Alden","duration":5129},
                {"id":"Xs4YtUqhF-8","title":"Bitcoin Freedom vs. Government Servitude - Bitcoin Magazine Twitter Spaces","duration":9328},
                {"id":"GhahF-yN4fM","title":"Fighting AI-Powered Tyranny w/ Whitney Webb #bitcoin #freedomtech #podcast #tftc #liberty","duration":56},
                {"id":"CEkcV28fdKY","title":"Max Keiser and Stacy Herbert Interview - Bitcoin Magazine LIVE #36","duration":9656},
                {"id":"s24B6PxtshQ","title":"Vlad Costea on Bitcoin Maximalism PoW Summit 2023, Prague","duration":2164},
                {"id":"ZNa8QZOaPSM","title":"Bitcoin's lack of innovation","duration":31},
                {"id":"1T6E7ktmNSg","title":"Strategy's CEO: This Product Grew Faster Than the iPhone — and It's Paying 11.5% Yield to Everyone","duration":2186},
                {"id":"KzahdJi_tso","title":"Bitcoin ETF and All Time High Price Talk with Dylan LeClair and Sam Rule - Twitter Spaces","duration":4291},
                {"id":"eSGqBMSZioc","title":"Bitcoin Veterans: GET ON THE MISSION (Official Documentary)","duration":2593},
                {"id":"gnfSKr4Rdvc","title":"Buy #Bitcoin, Study Bitcoin, Hold Bitcoin","duration":60},
                {"id":"WNsVIxymEtM","title":"Bitcoin, not Slavecoins with Aleks Svetski - Twitter Spaces","duration":5927},
                {"id":"NhrN_M_4-EE","title":"246. USD vs BTC: Debate with Brent Johnson","duration":4201},
                {"id":"EMbvgJnG_-s","title":"Broken Money w/ Lyn Alden (BTC146)","duration":5191},
                {"id":"YaaKnXFiz38","title":"BITCOIN WHALES are accumulating at the highest rate in 2 months","duration":2510},
                {"id":"2OHTUDACasc","title":"Mark Cuban talking bitcoin on Twitter Spaces W/ Preston Pysh, Pomp, Peter McCormack + 15K listeners","duration":5663},
                {"id":"p7bS96N8qzs","title":"Caitlin Long: Why Avanti Will Be a New Kind of Crypto Bank - Ep.216","duration":3898},
                {"id":"G1Izg_b17mw","title":"Bitcoin  The ALWAYS LIQUID 24 7 Crypto Market!","duration":15},
                {"id":"BAHMoY4-n8c","title":"BREAKING: Coinbase Got Caught Secretly Killing Bitcoin","duration":2478},
                {"id":"0UqPnxJ2n9U","title":"S17 E16: Summer Meng on Bitmars & Selling Bitcoin ASIC Miners","duration":3862},
                {"id":"VTCzVWgJJWs","title":"Bitcoin As The Apex Predator - Robert Breedlove (Pomp Podcast)","duration":4176},
                {"id":"nQ0s2exh9x8","title":"Corporations Just Surpassed ETFs in Bitcoin Buying-Here's What It Means with Matthew Sigel - The Bitcoin Layer","duration":1629},
                {"id":"M4RPTungLqs","title":"This Bitcoin On-Chain Metric Just Flashed – What It Means for 2026 with James \\\"Checkmatey\\\"","duration":2965},
                {"id":"gnHKuak0m0k","title":"The Bitcoin Retirement Accelerator Cohort - LIMITED SPOTS (If you're 40+, this is for you!)","duration":2206},
                {"id":"WLm9wPw8b5U","title":"S17 E15: Danny & Chad on OPNET & ETH Smart Contracts on Bitcoin Layer 1","duration":6400},
                {"id":"WovyQkSdONI","title":"Is AGI Here? Clawdbot, Local AI Agent Swarms w/ Pablo Fernandez & Trey Sellers (TECH014)","duration":4222},
                {"id":"N_qo_-QRqAM","title":"No More 4-Year Cycles? - Stephan Livera","duration":4128},
                {"id":"eduyejnogMo","title":"BTC060: Bitcoin Tech w/ Stephan Livera","duration":3944},
                {"id":"jPF5Dj9NFyI","title":"Bitcoin Tax Attorney Exposed The IRS's Real Plan","duration":2843},
                {"id":"Nq3qLlcbFK0","title":"Monthly Tech Round-up: Davos WEF, Claude Cowork, and MacroHard w/ Seb Bunney (TECH013)","duration":4087},
                {"id":"b_6dQ6SjSO0","title":"🚨SPECIAL EDITION: Citrea Trusted Setup Ceremony – LIVE from a Secret Location! 🚨","duration":1492},
                {"id":"4Q1AasS6HLU","title":"Bitcoin 101 - Stephan Livera Podcast","duration":799},
                {"id":"a7ZVCyLry4A","title":"You Are Literally Not Bullish Enough!","duration":1849},
                {"id":"y39z8VIIlVQ","title":"How to Upset the World of Bitcoin with Independent Journalism","duration":304},
                {"id":"al8C4b4utho","title":"Jeff Park on Why Owning 1 Bitcoin Is Young People's American Dream","duration":4187},
                {"id":"D5Z-L-3svyo","title":"Radio Silent Play Twitter Spaces 10/24/21 - PART 1","duration":1869},
                {"id":"SLJvZFlQQmc","title":"Why Everyone Is Wrong About Inflation | Ansel Lindner","duration":3532},
                {"id":"1aJqI6ONIQI","title":"If You Don't Understand Bitcoin, You Don't Understand Money","duration":821},
                {"id":"GCY9a7SGYyc","title":"Jack Mallers on XXI (21) and Strike Borrowing and Lending (BTC235)","duration":3909},
                {"id":"WqZVm-hZnPM","title":"#Bitcoin as Trojan Horse in strategic reserve debate? #usbitcoinstrategicreserve #politics","duration":56},
                {"id":"WiB2bgXcMuQ","title":"Bitcoin Will Make Crazy Politicians Powerless","duration":1852},
                {"id":"KKNGEr7Mc38","title":"Clarity Act, Bitcoin AI Education, and Payments w/ Parker Lewis (BTC258)","duration":3627},
                {"id":"_jmRAaN3HyY","title":"In 18 minutes, I'll show you how to retire AT LEAST a decade earlier with Bitcoin","duration":1119},
                {"id":"j8FhuFcHY3o","title":"Prime Time with Zach Herbert | FREEDOM TECH FRIDAY 34","duration":3731},
                {"id":"wognvydJlWk","title":"Scientist Reveals: Bitcoin is Kinda Cringe?","duration":3773},
                {"id":"8z-A-gsMNjA","title":"The Stoics Figured Out Bitcoin 2,000 Years Before Satoshi | Connor Dolan | #269","duration":4987},
                {"id":"QDqvxXCOWLY","title":"The Dollar Illusion That's Fooling the World. Here's the Truth. | Nik Bhatia | #271","duration":5427},
                {"id":"4t9DzDr6qBk","title":"The Bitcoin Treasury Strategy w/ Andrew Kang, Eric Semler, Simon Gerovich, and Dylan  LeClair","duration":2568},
                {"id":"LqM-D9vXX0A","title":"He Gave Warehouse Workers Bitcoin Instead of Cash Bonuses, Then Turnover Dropped From 108% to 17%!","duration":1559},
                {"id":"yrZxeQh1LQ0","title":"Why Twenty One Capital Is More About Volatility Than Bitcoin","duration":4485},
                {"id":"gXgaoltJPMc","title":"Bitcoin Artifact Story That Changed Everything w/ Coin Dad","duration":7299},
                {"id":"kMDSsyAEvd8","title":"Small Businesses Embracing Bitcoin w/ Michael from Oshi App - Voltage Twitter Spaces","duration":2975},
                {"id":"lBqLz5hvSHA","title":"MicroStrategy Deep Dive w/ Jeff Walton (BTC175)","duration":3822},
                {"id":"HrehEWYj16s","title":"Robert Breedlove: Philosophy of Bitcoin from First Principles - Lex Fridman","duration":14629},
                {"id":"NW-UeY5jgIo","title":"TRILLIONS into Bitcoin when the Shutdown Ends!","duration":995},
                {"id":"5KlgTxpodD4","title":"Macro Analysis, Financial Fragility and Bitcoin as the End Game with Preston Pysh","duration":3523},
                {"id":"cX4Zw-woels","title":"Trump Tariffs Netanyahu","duration":6456},
                {"id":"GgLUbr4mzfg","title":"How The Dollar Became The Global Reserve Currency - Bitcoin Spaces Live with Alex Gladstein","duration":4477},
                {"id":"Rl6kAlYZGQc","title":"The potential for hyperinflation w/ EJ Antoni #bitcoin #inflation #tftc #podcast #economics","duration":60},
                {"id":"ti28Lq5hSVA","title":"Bitcoin, Chapter 11 & The Great Depression of the 2020s Update | X Space AMA","duration":3879},
                {"id":"zUlP3RufbTM","title":"Exploring Bitcoin for Social Good with Trey Walsh","duration":4872},
                {"id":"RUI5XmQn3L0","title":"Can Bitcoin help you retire early? with Trey Sellers | SLP727","duration":2877},
                {"id":"M67oEW2zKkI","title":"S17 E18: Dr. K (Karl Kreder) on Quai & Scaling Proof of Work","duration":13678},
                {"id":"vbPsIS31yuc","title":"Can AI be private? w/ Marks from OpenSecret","duration":3287},
                {"id":"oMDHTVwSRHI","title":"1 Bitcoin Is All You Need","duration":1233},
                {"id":"K_Wh8PgaK48","title":"Hearts On Fire | PMM 17","duration":3219},
                {"id":"KfomU3Kf3sk","title":"Twitter Space AMA Recording | Part 2 of 7 | Custody & Investment Accounts","duration":3711},
                {"id":"UldXIvXatY8","title":"Bitcoin Treasury Companies: Risk, Reward & mNAV with Blake Canfield | SLP666","duration":4671},
                {"id":"TcocGqqUt3E","title":"Emancipation From Financial Patriarchy with Anita Posch","duration":3122},
                {"id":"gD1UVeooENM","title":"Making Bitcoin Quantum-Proof with Hunter Beast | BIS #187","duration":4414},
                {"id":"RppT_BiG4iQ","title":"Without Bitcoin, Gen Z is in Trouble!","duration":962},
                {"id":"6EdlQq-7OB4","title":"How Private Equity Is Coming to Crypto's Most Profitable Companies","duration":4119},
                {"id":"tbCVXyUGO3o","title":"I Bought This Instead of Bitcoin - Mark Moss","duration":387},
                {"id":"0fm1im0SX_4","title":"Buy Bitcoin to reach your \\\"retirement number\\\" 10+ years sooner","duration":976},
                {"id":"UFS4QYLKSAM","title":"Bitcoin Mastermind Q2 2025 w/ Joe Carlasare, Jeff Ross, & American HODL (BTC244)","duration":4874},
                {"id":"xqL9z_deowY","title":"There's Hope for Bitcoin with James Van Straten | SLP731","duration":2545},
                {"id":"3zNQst9699o","title":"BTC049: Bitcoin On-chain Data Analysis w/ Willy Woo","duration":4203},
                {"id":"MDNq9bfmIpA","title":"Trump Just Made Everyone That Has Bitcoin RICH!","duration":650},
                {"id":"R1IV91XNYxU","title":"Anita Posch on Why ‘Bitcoin Is a Tool for Freedom’ – Especially in Africa - Ep. 531","duration":3732},
                {"id":"cNtIuN3717U","title":"Why the Next 12 Months Will Be HUGE for Bitcoin! - Preston Pysh TFTC Ep. 528","duration":4584},
                {"id":"2i16_gO45mQ","title":"I bought all my gear with BTC","duration":34},
                {"id":"NZYc1yTj584","title":"Leaks and Larceny | THE BITCOIN BRIEF 73","duration":3681},
                {"id":"aOopWCMewwo","title":"How Can Bitcoiners Survive?","duration":47},
                {"id":"Q38g0ct8P7k","title":"Europe Is Broken — But This Country Is Becoming the World's Most Bitcoin-Friendly Nation","duration":1858},
                {"id":"WalXMUhstac","title":"Long-Term Holders Driving the Bitcoin Market w/ Dylan LeClair (BTC127)","duration":4556},
                {"id":"cnuvwEGNcsY","title":"The Bitcoin Flywheel: How Corporate Strategies Are Reshaping Crypto","duration":5176},
                {"id":"K3gTLBMsmNU","title":"Microstrategy and Five Issues It MUST Overcome or Else...","duration":744},
                {"id":"G6QIFIRsBno","title":"Bitcoin SURGES After Geopolitical Events  Outperforming SPY & Gold!","duration":27},
                {"id":"77W1Plqdges","title":"Seed Oils Are Terrible For Skin Cells","duration":43},
                {"id":"qhtTBFUaoc8","title":"The AI Future Is Overhyped. Why Bitcoin Still Matters | Junseth","duration":6011},
                {"id":"5FlwJlcwFK8","title":"Terminal Velocity | THE BITCOIN BRIEF 67","duration":5313},
                {"id":"Ut8keXlTyjw","title":"Bitcoin Mastermind Q3 2025 w/ Joe Carlasare, Jeff Ross, & American HODL (BTC252)","duration":5014},
                {"id":"wUMxd-C4CZk","title":"Bitcoin for Fairness with Anita Posch","duration":3831},
                {"id":"zx3nyQ3gDHQ","title":"Xapo Talks X Spaces - Bitcoin Loans  Explained! Borrow Against Your Bitcoin","duration":3009},
                {"id":"4G_5yr47y_M","title":"why 70% of el salvadorians not make money?","duration":41},
                {"id":"TabQtyUfgfc","title":"Phil Potter on Bitfinex and Tether","duration":6094},
                {"id":"wckGA8C7pYs","title":"MicroStrategy 2025 w/ Jeff Walton (BTC217)","duration":3808},
                {"id":"DCYCz186KAU","title":"Peter Todd and Guy Swann - Swan Signal Live - A Bitcoin Show - E47","duration":5791},
                {"id":"OtTMwrSe110","title":"China Is Breaking Gold & Silver Free From Western Manipulation — Peruvian Bull","duration":315},
                {"id":"0pM7oshoTqo","title":"What Happened to the Progressive Movement? with Margot Paez - FULL VIDEO","duration":7058},
                {"id":"pVMwby6TFSA","title":"I Spoke To Bitcoin's Most Connected Insider. He Told Me Everything","duration":3504},
                {"id":"K-_G8FapFqg","title":"Why California Should Lead with Bitcoin","duration":52},
                {"id":"ANDO2ddjfe0","title":"Lyn Alden's Advice for Bitcoin Investors Feeling \\\"Behind\\\"","duration":580},
                {"id":"sJinwqKz7zQ","title":"Global Liquidity Update with Michael Howell: The Case for a U.S. Gold Revaluation Is Building - The Bitcoin Layer","duration":2857},
                {"id":"3YuscY1L1zE","title":"Why You Should Be a Bitcoin Maximalist","duration":541},
                {"id":"fYsqdauqsJs","title":"Trump Quietly Made Bitcoin The Best Asset In America","duration":542},
                {"id":"GHJJbKCgQY8","title":"Good times and Friday fireside chat with Magoo - Crypto World Radio #bitcoin #crypto","duration":10471},
                {"id":"RA2cvfdwy0I","title":"Bitcoin & Macro Overview Q4 2025 w/ Luke Gromen (BTC254)","duration":3700},
                {"id":"1Is8m_sAXn0","title":"The Bull Case for Bitcoin with Lyn Alden","duration":123},
                {"id":"gIN3zSklstU","title":"The Perfect Destruction of Nature with Anjan Sundaram","duration":5788},
                {"id":"xQTdSJAmSK8","title":"We All Eat | The Confab 25: Chet","duration":4061},
                {"id":"RRnp_3lDhaY","title":"JP Morgan Just Cut Off China's Silver Supply (Here's What Happens Next) | Vince Lanci","duration":3896},
                {"id":"LnjVY0bqt_c","title":"Bitcoin's iPhone Moment — Two Financial Systems Are Running Simultaneously | Ep 268 Clip","duration":1224},
                {"id":"dn57JPSRmfE","title":"Ups and Downs | THE BITCOIN BRIEF 71","duration":3480},
                {"id":"tVqHgMvvEiE","title":"After a 50% Drop, Bitcoin Sends a Signal Wall Street Can’t Ignore","duration":2268},
                {"id":"-hgf7tdhfGk","title":"079. The Second Renaissance","duration":5758},
                {"id":"ITvc8lgpfzk","title":"Twitter Spaces: Wizards Weekly with Peter Brandt & JK","duration":1741},
                {"id":"_zwIvwA8Pfw","title":"Preparing for the next wave of bitcoin adoption w/ Matt from Unchained #bitcoin #freedomtech #tftc","duration":49},
                {"id":"ENW3PL50yPw","title":"The History of AI and Chatbots w/ Dr. Richard Wallace (TECH011)","duration":2919},
                {"id":"RB3CWGKa-Ac","title":"I'm doing something I've never done before...","duration":663},
                {"id":"K_RXWIjIwpo","title":"Bitcoin Will Be Worth Trillions?! | Saifedean Ammous","duration":4195},
                {"id":"jTpCzXOUiUk","title":"Luke Dashjr Pleading Poverty (Ben Arc, S16 E17)","duration":366},
                {"id":"I_C79ZzfZSQ","title":"MAKE BITCOIN NONPARTISAN AGAIN with Jason Brett","duration":5000},
                {"id":"jWyPRfEQdaA","title":"Is Vitalik Buterin Still a Bitcoiner?","duration":194},
                {"id":"z93Y2ueLTZk","title":"Cluster Mempool Explained with Pieter Wuille | SLP730","duration":3172},
                {"id":"-otqTQAtztI","title":"Bitcoin, The Fed, & The End Of The World | Magoo","duration":3188},
                {"id":"eT4-4h6A-SY","title":"BITCOIN The Fastest Horse In The Race!","duration":2328},
                {"id":"227anLxQ0mU","title":"The Money Printer Is Back On with Lyn Alden - The Bitcoin Layer","duration":3688},
                {"id":"9DuhDgqx21w","title":"Peter Schiff: Bitcoin Strategy is a Fraud","duration":3431},
                {"id":"LK_Bi2enXXY","title":"How to Orange Pill Anyone with Daniel Batten | Bitcoin Infinity Show #190","duration":4172},
                {"id":"iYVMX0zdp64","title":"The BITCOIN Act of 2024 with Senator Cynthia Lummis - The Bitcoin Layer","duration":1976},
                {"id":"r3-N5_UFHq8","title":"Bitcoin spam debates with Charlie Spears | SLP724","duration":3299},
                {"id":"rGKhRObDRdA","title":"Iran Isn't About Oil... It's About the British Empire | Tom Luongo","duration":6540},
                {"id":"sGGg-_9Y2Lo","title":"Bitcoin Macro Hangout: Preston Pysh, James Lavish, Susie Reilly","duration":3482},
                {"id":"sTxdYxGqYDo","title":"Stephan Livera: Why Bitcoin Only","duration":1708},
                {"id":"Bh7LBF9cU6w","title":"Stock-to-Flow & Power Law Debate Marathon","duration":736},
                {"id":"F2-I72n9rxs","title":"The Bitcoin White Pill with Marty Bent","duration":5045},
                {"id":"-UxU83QmFNM","title":"The next step for VPNs w/ Carl Dong from Obscura","duration":3743},
                {"id":"1L1IO2Bgmrc","title":"BTCPayServer Twitter Spaces - How to become a #Bitcoin contributor","duration":4385},
                {"id":"to7FF7ZmBl0","title":"Lyn Alden: No Massive Bust or Boom? - Coin Stories","duration":3384},
                {"id":"DZ2c8CWkwxg","title":"Can We Really Abolish the Federal Reserve? An Interview with Peter St Onge - The Bitcoin Layer","duration":3010},
                {"id":"qxFgDkiwUJc","title":"Jimmy Song & Anita Posch | Swan Signal Live | EP 122","duration":3577},
                {"id":"salvzDUGS_w","title":"Low Testosterone Is a Silent Epidemic w/ Miguel & Carlos","duration":9725},
                {"id":"z-FfHGQXRG4","title":"BR019 - Proof of Keys Day Twitter Space ft. Lopp, Craig Raw, Lazy Ninja, mshodl, Rijndael & guests","duration":9192},
                {"id":"Xv9TnieldbM","title":"AI, Robots & Inflation Fuel Socialism, Is Quantum a Threat to Bitcoin? | Preston Pysh & Larry Lepard","duration":5279},
                {"id":"q0KB6u4etXU","title":"Will Bitcoin End The State? with Stephan Livera","duration":5163},
                {"id":"E6Fu34imwvM","title":"Twitter spaces AMA Recording 08.11.2022 | emergency broadcast FTX Fall","duration":5274},
                {"id":"WF3lNZPsToA","title":"Rain, Rigs and Real Talk | ACTION NEWS!!! 19","duration":2438},
                {"id":"5Ihs4sOkI_g","title":"He Lost Everything — Then Found His Bitcoin on an Old Hard Drive | Secure Sovereign Ep 270 Clip","duration":293},
                {"id":"VS44Fu4ttjM","title":"BR092 - NWC, DeepSeek, AI Coding, Sparrow, Bitcoin Keeper, Calculating Tx Sizes + MORE ft. Paul","duration":5354},
                {"id":"sab9Qc-HU-Y","title":"Vitalik Buterin: Ethereum's Scaling Plans & Challenges","duration":76},
                {"id":"KpQX-04LxJ8","title":"Mark Cuban DEBATE Vs. Bitcoiners (Preston Pysh, Pomp, Peter McCormack, and others) - Twitter Spaces","duration":5657},
                {"id":"wjMvbpBanog","title":"America's Big Reset: Kill the IRS, Split the Dollar, and Fund It All with Sovereign Wealth - The Bitcoin Layer","duration":2282},
                {"id":"j89aAqfezX8","title":"Saving Bedford - Peter McCormack","duration":6434},
                {"id":"A2xszwHf3Zc","title":"1 BTC = ∞ USD","duration":50},
                {"id":"xa5iT1nklyU","title":"Brian Kelly vs Peter Schiff - Bitcoin Bull vs Bear","duration":672},
                {"id":"UiXSPHD53OQ","title":"Bitcoin++ and making Bitcoin dev great w/ Nifty Nei","duration":2860},
                {"id":"WIXgXYpU8Xk","title":"A Bitcoin Maximalist On Central Banks With Daniel Prince - Fed Watch - Bitcoin Magazine","duration":3198},
                {"id":"TgjFQpFQ-5A","title":"Your Wealth Is Melting: Freeze It with Bitcoin - The Bitcoin Layer","duration":2301},
                {"id":"y5e-PhaGm_4","title":"Orange Pill App Twitter Spaces Jan 2023 - Jeff Booth, Breedlove, Knut, Daniel Prince, BTC Sessions","duration":7100},
                {"id":"jisxBD2fhFs","title":"Where is the retail Bitcoin investor? BitcoinIRA.com/natalie","duration":43},
                {"id":"DO5-zt-SpeA","title":"Bitcoin & Real Estate w/ Leon Wankum (BTC164)","duration":3318},
                {"id":"EdrAOkUoE-E","title":"Will Stablecoins help in Bitcoin adoption? with Gareth Grobler | SLP726","duration":2546},
                {"id":"FMWIWKG7eBs","title":"Bitcoin Marketing  Know Your Audience's Needs First!","duration":30},
                {"id":"EuWaIGQOkZE","title":"1 Bitcoin will buy 50 years of your salary","duration":851},
                {"id":"ksrx66uAV6k","title":"The Entity That Controls AI Controls the World w/ Toufi Saliba","duration":5742},
                {"id":"HUcjmoi7zm4","title":"Retire with Bitcoin: Leveraging IRAs, Custody, and Long-Term Wealth Strategies - The Bitcoin Layer","duration":1347},
                {"id":"XJDkWavCCQU","title":"Magoo VS George Gammon","duration":5652},
                {"id":"CuAkiWJWD0A","title":"Curtis Green - Bitcoin has gone from spend to HODL. Is it a net positive?","duration":40},
                {"id":"dcHt0HgQMgc","title":"Bitcoin Market Deep Dive: Dylan LeClair: Full Interview","duration":1926},
                {"id":"wrFMBZ5cPZI","title":"Breaking FUD in Neuchâtel, November 16th 2023 (Vlad Costea)","duration":2852},
                {"id":"gUWl9HSEdiE","title":"Bitcoin  Secure Your Future & Bypass the State for Generations","duration":37},
                {"id":"1aMOrtr1rN4","title":"Bitcoin World #8: Bitcoin in Zimbabwe with Anita Posch","duration":4011},
                {"id":"9dRKVoTaVoY","title":"Chat_132 - How to Stack More Bitcoin [THE Bitcoin Podcast]","duration":3980},
                {"id":"9KxH6QESYsQ","title":"Ungovernable Podcasting | The Confab 26: Barry & ChadF","duration":4389},
                {"id":"chRpbV2_6cI","title":"What Bitcoin Did with Jack Mallers, Matt Odell, & Harry Sudock","duration":9557},
                {"id":"W967FCvarrw","title":"Satoshi is AI? Trump Time Traveling, Fact or Fiction? #Bitcoin #crypto #timetravel #trump","duration":485},
                {"id":"HGAMuaQ1LZg","title":"Bitcoin and AI w/ Guy Swann (BTC148)","duration":6335},
                {"id":"BP7er6VYab0","title":"Bitcoin Security with the Frostsnap Team | FREEDOM TECH FRIDAY 35","duration":3616},
                {"id":"WlAw1S366HE","title":"Why Was Charlie Kirk Killed and the Impact to Turning Point USA","duration":1481},
                {"id":"fekdmit9sgE","title":"Get your money out of the system. - Godfrey Bloom","duration":60},
                {"id":"Xhnd8rL-3YA","title":"Guy Swann & Vijay Boyapati | Swan Signal | EP 112","duration":4118},
                {"id":"9psB9oOaLVA","title":"Power Law, Bitcoin & MicroStrategy with Sina | SLP619","duration":3810},
                {"id":"wskEO0eBo3U","title":"Colonel Tim Kirk","duration":6124},
                {"id":"K5bZ4HPpwxw","title":"Fixing Government Corruption - WBD","duration":6182},
                {"id":"b_3T5S1li90","title":"NumoPay: Tap-to-Pay Bitcoin with Calle | SLP728","duration":2641},
                {"id":"bzzFBvzONBo","title":"Bitcoin Mastermind Q1 2026 w/ Joe Carlasare, Jeff Ross, & American HODL (BTC257)","duration":4878},
                {"id":"5mtuEf3zxTE","title":"Monthly Tech Round-up: Datacenters in Space, AI5 Chip, Tesla Versus Waymo w/ Seb Bunney (TECH012)","duration":4203},
                {"id":"p0tvK8smhrc","title":"The US's Economic Hitman w/ John Perkins (BTC181)","duration":3128},
                {"id":"u9FEoGQSOgM","title":"STRC is the world's fastest growing financial product","duration":1620},
                {"id":"3U-QUw8xgPU","title":"Twitter Spaces AMA - The Future of Crypto Yield","duration":4164},
                {"id":"JuZZmxrt6SI","title":"UNLOCKING $1 TRILLION to Send Bitcoin Back to $120K!","duration":548},
                {"id":"eUOTOWCxoxM","title":"Why Centralization Always Fails with Nick Hudson | Bitcoin Infinity Show #196","duration":5304},
                {"id":"-FsGZqLQlXk","title":"SLP86 PlanB - Frontrunning the Bitcoin Halvening?","duration":4886},
                {"id":"6_qyBmRCPzA","title":"Jeff Booth x Voltage - Bitcoin & Lightning Discussion Twitter Space","duration":2953},
                {"id":"P_C7ign3xMk","title":"A Once In A Lifetime Financial Reset Is About To Make Everyone That Has Bitcoin RICH","duration":854},
                {"id":"s7-l7gzm_PE","title":"Bitcoin & Theoretical Physics w/ Jeff Booth, Jack & Nick (BTC259)","duration":4657},
                {"id":"JF_6r7DYnLw","title":"What Institutions Get Wrong About Bitcoin with Ed Juline | BIS #197","duration":4160},
                {"id":"JPrM0J-eUfU","title":"The Collapse Has Already Started | Jeff Ross","duration":4789},
                {"id":"Ledb57Gv3oQ","title":"Government Out of Control w/ Dave Smith, Luke Gromen, Mark Moss and Guy Swann","duration":1988},
                {"id":"zvg91cf10K4","title":"20 Things That Are A Complete Waste Of Money Once You Understand Bitcoin","duration":1139},
                {"id":"nhLBbXqQG9Y","title":"Surveil Yourself with Stealth | FREEDOM TECH FRIDAY 33","duration":3594},
                {"id":"rPD13rKqg60","title":"Experts Doubt $1 MILLION Bitcoin. But We Know the Dollar's Days Are Numbered!","duration":600},
                {"id":"dkph5lF2KmA","title":"This CEO Just Raised $750 Million to Buy Bitcoin With ZERO Debt - The Bitcoin Layer","duration":1922},
                {"id":"biotJvfDmIM","title":"He Was Right About Q1. His Q2 Warning Changes Everything.","duration":5022},
                {"id":"WQndQYOx4I8","title":"Bitcoin is a cheat code in the game called \\\"money\\\"","duration":1789},
                {"id":"UWljJr7tl9M","title":"While You Were Watching Iran, They Changed Your Money Forever","duration":1986},
                {"id":"UzGuqZP9DeA","title":"The Hidden Financial Mechanism Nobody Understands Yet w/ Radu Chichi","duration":5966},
                {"id":"neoBZX6-g3o","title":"What Does Zooko Think About Pirate Chain? (S16 E29 Short)","duration":200},
                {"id":"BNg4Mo6B4cM","title":"The Revenge Of The Nodes with Aaron Segal and Greg Foss - Twitter Spaces","duration":7328},
                {"id":"y1leqqCohjU","title":"Make Honest Money  Ethics First, Monetize Your Passions!","duration":27},
                {"id":"nM504_upkZg","title":"Banks Silently Closed The Exit","duration":985},
                {"id":"unCR7k3-aoE","title":"Bitcoin Is the Apex Asset - Robert Breedlove","duration":916},
                {"id":"dlbQNj9q5Xk","title":"BTC106: FTX Failure, GBTC, Genesis DCG & More w/ Dylan LeClair","duration":4255},
                {"id":"1rYg2-URBKA","title":"240. Preston Pysh","duration":5509},
                {"id":"nc72lrV1mms","title":"Escaping the technocracy w/ Gabriel Custodiet and UrbanHacker","duration":3504},
                {"id":"AJrPTqcHsm4","title":"The Great Bitcoin Scaling Debate: A Pleb UnderGround Twitter/X Spaces Special | EP 68","duration":7490},
                {"id":"4S3qibfXXzU","title":"Debunking Bitcoin Energy FUD - Swan Lounge","duration":6203},
                {"id":"1jZQNo_rRsQ","title":"Bitcoin Poised for Cycle Top? Corporate Treasuries - Saifedean","duration":1763},
                {"id":"KrzgMJZvA1U","title":"SLP115 Trace Mayer - Bitcoin as Ultimate Collateral","duration":3916},
                {"id":"0QldDMrQms0","title":"If You Only Watch One Bitcoin Video, Make It This","duration":881},
                {"id":"YqCI76V75vc","title":"The Biggest Exit Liquidity Trap In History Is Being Set Right Now","duration":4361},
                {"id":"Qf-wkbWe2uk","title":"Saifedean Ammous: The Fiat Endgame, Strategic Reserves and Stablecoins | The Culture Bit","duration":3319},
                {"id":"HBk6nH7DYqE","title":"Dylan LeClair on Metaplanet's Bitcoin Bet: How Corporate Treasuries are Transforming Global Finance","duration":3154},
                {"id":"ANtyYqcXR9w","title":"Marty Bent: Tales from The Crypt","duration":5936},
                {"id":"aMVi5L70rMI","title":"Neutral Reserve Assets and AI to Drive Bitcoin #gold #bitcoin","duration":91},
                {"id":"LGHbrj53qtY","title":"Prof Jiang doesn't understand Bitcoin","duration":2221},
                {"id":"tta5XMvqVv0","title":"Max Keiser and Daniel Prince - Swan Signal Live - A Bitcoin Show - E48","duration":4825},
                {"id":"zflAVKCaPfU","title":"Why Poor People Rarely Buy Bitcoin","duration":388},
                {"id":"JaMJi1_1tkA","title":"Bitcoin Rap Battle: Hamilton vs. Satoshi - ft. EpicLloyd","duration":362},
                {"id":"ngZKzSjrfo4","title":"Why Hookup Culture Is Leaving an Entire Generation Empty w/ Stefanos Sifandos","duration":6221},
                {"id":"WfVyfNg1Tik","title":"Bitcoin Makes You Zoom Out. Stoicism Pulls You Back In. | Connor Dolan Episode 268 Clip","duration":137},
                {"id":"h2SC_H-7qnk","title":"Meet The Pro-Bitcoin Democrat Running for Governor of California","duration":3906},
                {"id":"H5EkNlRyUo4","title":"He's Read Every Quantum Paper, Here's How It Affects Bitcoin | Brandon Black","duration":3951},
                {"id":"wBEqw-PSBlg","title":"Why Selling Bitcoin for Fiat Misses the Picture - Mark Moss","duration":610},
                {"id":"GyXXMjYyR0Q","title":"#Bitcoin is our anchor to truth in a sea of lies with Carlos Toriello #elections #democracy #TPBPod","duration":58},
                {"id":"1_MmozSQuUU","title":"This One Decision By Schwab Changes The Math On Bitcoin Forever","duration":2024},
                {"id":"o3pcZ0sEGyY","title":"Dave Smith Breaking Bitcoin Echo Chamber on Joe Rogan | EP 875","duration":5250},
                {"id":"fbrQrcVu0NU","title":"Untangling Knots vs  Core | THE BITCOIN BRIEF 66","duration":4987},
                {"id":"runHWEAoLnc","title":"Twitter Spaces 03.11.2022 | Emergency Broadcast - A Message To Judge Glenn on Celsius","duration":2984},
                {"id":"aN2G0Uvahf8","title":"What Bitcoin Did - Beginner Guide","duration":3437},
                {"id":"VnDIvyRAF34","title":"Dylan LeClair Bitcoin Market Overview (BTC155)","duration":5182}
            ]
        },
        {
            "id": "politics-regulation",
            "name": "Politics & Regulation",
            "emoji": "🏛️",
            "desc": "Government policy, ETFs & legal battles",
            "color": "#64748b",
            "videos": [
                {"id":"boZ7yJOFBk0","title":"Crushing Anti-BTC Legislation - Porter","duration":2933},
                {"id":"pR4t4dRdajw","title":"Bitcoin vs Authoritarianism - Gladstein","duration":1266},
                {"id":"tWWb0-A0Rdk","title":"Bitcoin Laws Are Changing | SAF","duration":4003},
                {"id":"UVg4AjuPBQU","title":"Sen. Lummis on Crypto Oversight Bill - Stablecoins Need Hard Assets","duration":470},
                {"id":"kqOx7PjbNOw","title":"Shootin Straight Episode 3: Senator Cynthia Lummis","duration":2778},
                {"id":"_E_5Hk-vRj8","title":"Bitcoin U.S. Reserve in 30 Days?","duration":1410},
                {"id":"YqWoj2eFDp4","title":"Right To Mine Policy - Dennis Porter","duration":1720},
                {"id":"vr1M2anvbWU","title":"Trump's Bitcoin Reserve Plan - Power Move or Trap?","duration":679},
                {"id":"5IHNLgkO6Ls","title":"Trump Signs Order to Establish Strategic Reserve of Cryptocurrencies","duration":376},
                {"id":"Ef5flMEKmic","title":"What Falling Gas Prices Signal for Bitcoin & The 2026 Midterm Elections - The Bitcoin Layer","duration":3370},
                {"id":"HjnOMkbLOf8","title":"EP15: Bitcoin is Good, pt. 2 w/ Grant McCarty, Co-Executive Director - Bitcoin Policy Institute","duration":3004},
                {"id":"P7IQeU31R0o","title":"House Holds Joint Crypto Hearing - CNBC Crypto World","duration":595},
                {"id":"TE0eFKTJEfQ","title":"Bitcoin Policy Outlook 2025 - Strategic Reserves, BitBonds & Privacy","duration":3211},
                {"id":"5VczGHHbDTQ","title":"The AI-Pentagon War That Every Bitcoiner Needs to Understand - The Bitcoin Layer","duration":1733},
                {"id":"lwJpvqMeLJg","title":"Bitcoin Breaking Records - SuperTalk","duration":341},
                {"id":"BwhyCmnRlJo","title":"CZ Reveals What US Bitcoin Policy Is Doing to the Global Market","duration":110},
                {"id":"iOrbrNwUtfI","title":"SEC Clears path to CBDC","duration":214},
                {"id":"pnG86iyRsbA","title":"The Trump Doctrine Has ARRIVED, Here's What It Means for 2026 - The Bitcoin Layer","duration":2072},
                {"id":"lh7tYnOk3AU","title":"EP3: Bitcoin Is Good w/ David Zell, Founder & Co-Executive Director of the Bitcoin Policy Institute","duration":3125},
                {"id":"kSbMU5CbFM0","title":"Bitcoin vs Authoritarianism - HRF","duration":9217},
                {"id":"YwZseBZOc6U","title":"The Bitcoin Strategic Reserve","duration":1855},
                {"id":"-C13zU-ZsT8","title":"EUROPEAN BREAKING POINT: Italy Takes Gold Back, Sovereign Bond Crisis, & Bitcoin w/ Matt Dines - The Bitcoin Layer","duration":3099},
                {"id":"pCDyEsZJVLI","title":"America's Grand Strategy: Repo, China, Jensen Huang, & Bitcoin's Next Move - The Bitcoin Layer","duration":3239},
                {"id":"3f170IT1nQU","title":"Bitcoin Reacts to Tariff Tensions: What's Next for Price & Liquidity - The Bitcoin Layer","duration":1943},
                {"id":"jfUX8d80ifw","title":"Mined In America Act FT. Dennis Porter","duration":2432},
                {"id":"_6PvTUqyRt8","title":"Alex Gladstein on Bitcoin Freedom","duration":599},
                {"id":"pBMnPec4AC4","title":"Congressman Tom Emmer SLAMS SEC Chair Gary Gensler","duration":341},
                {"id":"V82emH4q6o0","title":"Claude Eclipses Trump as the Most Important Force in Global Macro - The Bitcoin Layer","duration":2697},
                {"id":"jjl_kp9v-Eg","title":"Washington's Crypto Awakening: The Lawmaker Town Hall","duration":3188},
                {"id":"12zBLvoVRFQ","title":"Element Zero","duration":1401},
                {"id":"tja-5y_FvgY","title":"Regulatory Shackles Are Off","duration":1567},
                {"id":"WSBQunQ2jJA","title":"The Time Has Come - El Salvador Makes Bitcoin Legal Tender","duration":90},
                {"id":"78xSNqLfJDA","title":"Dem Lawmaker Urges Yellen To Crack Down On Crypto Bros","duration":301},
                {"id":"7lBVDgMkdiA","title":"Why Agentic Payments are BULLISH for Bitcoin Tax Exemption | Bitcoin Policy Hour Ep 32","duration":3655},
                {"id":"c1l7EFvyTyM","title":"Gary Gensler GRILLED on Crypto at Congress Committee Hearing","duration":6651},
                {"id":"yuBTr3jLFQQ","title":"INSIDE THE SELLOFF: Bitcoin, Sanctions, & The Liquidity Drain - The Bitcoin Layer","duration":1631},
                {"id":"yOtZaPuVpTE","title":"THE MOST IMPORTANT DOCUMENT OF 2025: What the New U.S. National Security Strategy Means for Markets - The Bitcoin Layer","duration":3598},
                {"id":"MuobSz7534s","title":"Paving the Frontier - Dennis Porter","duration":3119},
                {"id":"R-Rd12saPh8","title":"The Fight for Bitcoin in America","duration":2718},
                {"id":"nDSPY2XMmL0","title":"New Hampshire's Strategic Crypto Reserve - What to Know","duration":416},
                {"id":"kN5codbLCCY","title":"Bitcoin Regulation: National Security Issue","duration":740},
                {"id":"zmGKUflR6lc","title":"The Implications of Outlawing Bitcoin (First Principles) - Article by Gigi","duration":576},
                {"id":"jMg3U-51Obw","title":"GOP Rep Unveils Bold Crypto Tax Twist - No Capital Gains","duration":200},
                {"id":"7ZSpFWEd-x0","title":"Gary Gensler Testifies - Left SHAKING After Crypto Questions","duration":3155},
                {"id":"h_oAr4wn7M4","title":"House Financial Services Committee Hearing: Oversight of the SEC","duration":19400},
                {"id":"-nKmcQPmQkk","title":"Is Google's Quantum Breakthrough a Threat to Bitcoin? | Bitcoin Policy Hour Ep 33","duration":3753},
                {"id":"m3es0G4m_R4","title":"Sen. Lummis Questions Gary Gensler (SEC) and Rohit Chopra (CFPB)","duration":560},
                {"id":"AXKL48mnU0E","title":"Japan's Historic Election, Yen Defense, & Why Bitcoin Is Still a Liquidity Trade - The Bitcoin Layer","duration":1938},
                {"id":"WO6Ww-MLQGs","title":"Wyoming Senator Cynthia Lummis - Texas Blockchain Summit","duration":1359},
                {"id":"Yo8WskjkELU","title":"Unmasking Satoshi Is Bad for Bitcoin | Bitcoin Policy Hour Episode 34","duration":3831},
                {"id":"n4AcHMN4veo","title":"Congresswoman Buys $250K Bitcoin: Insider Trading?","duration":33},
                {"id":"DJhgLMMAPHQ","title":"Trump Nominates Crypto Advocate Paul Atkins as SEC Chair","duration":41},
                {"id":"kJEzpYjVsB4","title":"Trump's Policies - Strategic Bitcoin Reserve & Stablecoin Law","duration":823}
            ]
        },
        {
            "id": "saylor",
            "name": "Saylor Series & Corporations",
            "emoji": "👑",
            "desc": "Michael Saylor's complete Bitcoin masterclass - strategy, philosophy & the future of money",
            "color": "#f7931a",
            "videos": [
                {"id":"547yEgp4-TM","title":"Q3 Earnings in Review | True North Podcast | Ep. 2","duration":9420},
                {"id":"TYZyaebvheQ","title":"The Roadmap for BTC Treasury Adoption in Untapped Markets | Bitcoin MENA 2025","duration":1302},
                {"id":"9sY2ALb4UWE","title":"Lil Bubble - Buying At The Top Forever (Official Visualizer) ft. Michael Saylor","duration":151},
                {"id":"sVNbuZx7VqQ","title":"What Strategy ($MSTR) Could Be Worth In 5 Years","duration":802},
                {"id":"yz9R_EfIesM","title":"BTC credit markets will be bigger than bitcoin itself #bitcoinforcorporations #bitcointreasury","duration":80},
                {"id":"iAltqb7iLf8","title":"The Future Runs on Digital Credit | Strategy World 2026","duration":607},
                {"id":"wE7RPLCr7_M","title":"Michael Saylor: Bitcoin Volatility Is Satoshi's Gift to You","duration":54},
                {"id":"4az78ODE3Zc","title":"Digital Credit Clarity | The Hurdle Rate Ep. 44","duration":3443},
                {"id":"n7YE7wskfyw","title":"The Most Hated Rally in Finance | True North Podcast | Ep. 10","duration":8074},
                {"id":"FsGONQow-nE","title":"The Strategic Case for Bitcoin Treasuries in Europe w/ Alexandre Laizet, Jesse Myers, Tyler Evans","duration":1350},
                {"id":"7aJTOCN501g","title":"Saylor Reveals the TOP Bitcoin Secrets - Digital Asset Summit 2025","duration":2050},
                {"id":"8XwV0KHo92Q","title":"How much more leverage can $MSTR take on?","duration":78},
                {"id":"m4vV3XtWYMw","title":"Convertibles on Deck | True North Podcast | Ep. 18","duration":6370},
                {"id":"FTGSQdoS5Sc","title":"Michael Saylor: Bitcoin Quantum Resistance & Strategy's Bitcoin Cybersecurity Program","duration":108},
                {"id":"y8IH0OwFyW4","title":"Michael Saylor: Why Bitcoin is a Truth Machine","duration":601},
                {"id":"DD1Y-Uhj4Og","title":"Did Michael Saylor & Strategy Just TRIGGER a Bitcoin STAMPEDE?","duration":769},
                {"id":"zBTJkiHE4vs","title":"The Great Equalizer: Why AI is the Ultimate Tool for Global Empowerment w/ Mason Foard of Meliuz","duration":491},
                {"id":"iBgYVIyiYzI","title":"Up To Par | True North Podcast | Ep. 52","duration":4087},
                {"id":"jYiWGXBga4o","title":"There is no second best - Michael Saylor","duration":35},
                {"id":"gHpnTOoGv7Q","title":"Saylor: Why Bitcoin Will Birth a New Generation of Trillion-Dollar Companies","duration":900},
                {"id":"sS7hLOJlyRQ","title":"The Incentives Are Aligned | The Hurdle Rate Ep. 38","duration":3500},
                {"id":"aZr_jfK9R10","title":"Why Short Term Losses Lead to Long Term Wins for Strategy. #mstr #digitalcredit #bitcoin","duration":93},
                {"id":"Da6T6Jati18","title":"Strategy ($MSTR) Explained In 12 Minutes","duration":712},
                {"id":"7KniD4pcsJ8","title":"Securing the Institutional Frontier w/ Mike Belshe of BitGo","duration":498},
                {"id":"nuKqepvkOqI","title":"All In On Bitcoin | The Jeff Walton Story","duration":3452},
                {"id":"fNizwumVk4I","title":"Banks Perspective of Investing in Digital Credit | Strategy World 2026","duration":809},
                {"id":"nNt3WQnb00g","title":"True North Now - Inside look at H100 | Featuring CEO Sander Andersen","duration":2028},
                {"id":"nC37CqWpxfI","title":"Saylor & Dorsey Interview","duration":3398},
                {"id":"tO2bjYx_LBg","title":"The BIGGEST Story in Finance - Why STRC will change the world!","duration":509},
                {"id":"Hfdq-Wl1fRQ","title":"Michael Saylor Explains Why Going All In on Bitcoin Could Be Genius","duration":820},
                {"id":"MhNrsdAwaUM","title":"The Death of Gold - The Saylor Series Episode 10","duration":4817},
                {"id":"ytmhmixeCRo","title":"The Bitcoin Interview That YouTube Tried To Delete","duration":3012},
                {"id":"TXvvMGrZDAw","title":"Billionaire Destroys Peter Schiff's Gold Argument - Michael Saylor","duration":450},
                {"id":"ckj0w5p1bLA","title":"Bitcoin in Wealth Management Portfolios | Strategy World 2026","duration":1106},
                {"id":"flQRjxe7zpg","title":"Michael Saylor's Massive $49 Billion Bitcoin Purchase!","duration":87},
                {"id":"fAldRInw4EA","title":"The Mechanics of Capital and Digital Credit | True North Podcast | Ep. 61","duration":6879},
                {"id":"XJjH_fJ7kEI","title":"Treasury CEO: will the 4 year bitcoin cycle continue?  #bitcoinforcorporations #bitcointreasury","duration":72},
                {"id":"gRnspOucXNg","title":"Michael Saylor - Bitcoin Zen","duration":57},
                {"id":"1BwJh2HmX74","title":"All of us were ready to ride it to zero -  Saylor on Bitcoin at $16,000 🤝 #bitcoin #michaelsaylor","duration":33},
                {"id":"3oo_slJedus","title":"New Year, The Bottom's In | True North Podcast | Ep. 50","duration":7723},
                {"id":"_QN0RcQFf6w","title":"Michael Saylor on Bitcoin Principles (SLP536)","duration":10225},
                {"id":"J1STZqH_FRY","title":"Weathering The Storm | True North Podcast | Ep. 55","duration":4804},
                {"id":"MOZejVJrhXU","title":"Jeff Walton pitching Michael Saylor on a business idea","duration":128},
                {"id":"vkIq85Ha1fc","title":"The First Regulated STRC ETF Is Here | Strategy World 2026","duration":487},
                {"id":"WrR95PFYDFQ","title":"Michael Saylor On Buying Bitcoin With His Balance Sheet - Pomp Podcast #385","duration":5085},
                {"id":"BWB6-2Agaqc","title":"Wall Street Digital Gold Rush | True North Podcast | Ep. 31","duration":7295},
                {"id":"VGkyVoNw9v8","title":"Tech Themes thru History - The Saylor Series Episode 3","duration":4592},
                {"id":"1R0J-myYPM0","title":"Michael Saylor: Bitcoin is Hope","duration":387},
                {"id":"YXi8DybUxqM","title":"Michael Saylor & Phong Le: The Transformative Power of AI + BTC | Strategy World 2025 Keynote","duration":4719},
                {"id":"9OHeub2XLwU","title":"Strategy ($MSTR) Balance Sheet UPDATE","duration":339},
                {"id":"4QM0PwPOg90","title":"Strategy's ($MSTR) Bitcoin Backed Credit Products","duration":2692},
                {"id":"VkHQHu5vYHs","title":"Bitcoin, AI and The New QE | The Hurdle Rate Podcast Ep.53","duration":3615},
                {"id":"07MA4bVy_tM","title":"Strategy ($MSTR) Balance Sheet & Digital Credit","duration":642},
                {"id":"8893dpSiNiE","title":"How to Value Bitcoin Treasury Companies w/ Andrew Webley, Matt Cole & Gurpreet Oberoi","duration":1280},
                {"id":"Gy0ySjTc8p4","title":"LIVE: Strategy (MSTR) Q3 2025 Earnings Call","duration":6755},
                {"id":"4kWvkws8qD4","title":"$MSTR will be the biggest company in the world. #trading #investing #bitcoin","duration":78},
                {"id":"6d9bPPI77zg","title":"\"MSTR Uptober\" | True North Podcast | Ep. 40","duration":7821},
                {"id":"qOM3oKj5FmY","title":"The Rise Of Bitcoin Treasuries w/ Tim Kotzman, Konrad Leasser, Wyatt O'Rourke & VIjay Selvam","duration":1276},
                {"id":"7hyoONj4nEY","title":"What One Billionaire Knows About Outlasting a Dollar Collapse - Jordan Peterson EP 554","duration":5245},
                {"id":"C4i3OjkrBTc","title":"The Starting Line | The Hurdle Rate Ep. 27","duration":3183},
                {"id":"E2fZBPb0Q9A","title":"\"I want MSTR to stand for MONSTER\"","duration":85},
                {"id":"cd67ujAiuHA","title":"Banking Bitcoin: Integrating BTC into Traditional Finance | Strategy World 2026","duration":635},
                {"id":"W9NlSAmpDFI","title":"The Dynamics of Scarcity & the Digital Gold Rush w/Dylan LeClair, Tracy Hoyos-Lopez & George Mekhail","duration":1263},
                {"id":"tSAvXsMQjYg","title":"What is Bitcoin? - Michael Saylor & Tucker Carlson (Nov 2021)","duration":396},
                {"id":"zeKFDibW0nQ","title":"Every Company Will Be a Bitcoin Treasury Company w/ Adam Back and Tyler Evans","duration":1450},
                {"id":"7gvogsnkjdc","title":"SaylorWaves - 1 Hour of Relaxing Saylor Speaking about Bitcoin","duration":3634},
                {"id":"hzyJ0tK9f2k","title":"MicroStrategy is Getting Stronger... Here's How We Know","duration":380},
                {"id":"fEXw-LU18Ww","title":"Michael Saylor - There Is No Second Best (Lil Bubble Bitcoin House Remix)","duration":157},
                {"id":"gCfA1lkmJo4","title":"Michael Saylor - The Greatest Bitcoin Explanation","duration":620},
                {"id":"C13Dicxc1wc","title":"Bitcoin for Corporations Symposium | Bitcoin MENA 2025","duration":25802},
                {"id":"JAgkx45l9no","title":"Digital Assets at TD Bank | Strategy World 2026","duration":1765},
                {"id":"fzg9I7hHdzs","title":"Economics, Inflation, Interest Rates & Competition - The Saylor Series Episode 9","duration":6153},
                {"id":"vMw0KuAIGTM","title":"Chapter 2 \"Full Sail Ahead\" | True North Podcast | Ep. 39","duration":7814},
                {"id":"fCkABdwjxtE","title":"Michael Saylor at Bitcoin Atlantis 2024","duration":3069},
                {"id":"1kyXKI0m_LI","title":"LIVE: Strategy (MSTR) Q4 2025 Earnings Call","duration":7307},
                {"id":"JjAtLGXKUrs","title":"Inside the Digital Credit Revolution | The Hurdle Rate Ep. 36","duration":3280},
                {"id":"5PkWE5sPqE4","title":"Strategy ($MSTR) Digital Credit vs The World","duration":594},
                {"id":"yxEq_g5BIjg","title":"\"High Powered Digital Money\" | True North Podcast | Ep. 48","duration":3932},
                {"id":"dAFJzsJdfJI","title":"Why Michael Saylor Went ALL IN On Bitcoin","duration":636},
                {"id":"hVFmgzUuioQ","title":"Will Michael Saylor's Strategy Become the Worlds MOST VALUABLE COMPANY?","duration":891},
                {"id":"kkGDfuTj1Ew","title":"Bitcoin: There Is No Second Best - Michael Saylor & Greg Foss Twitter Spaces","duration":7870},
                {"id":"003pvQdffr4","title":"Strategic Risk Taking | The Hurlde Rate Ep. 23","duration":3175},
                {"id":"IdPKzulKdFI","title":"Is Michael Saylor a Threat For Owning So Much Bitcoin?","duration":257},
                {"id":"uILb-qRPLGo","title":"True North Exchange - Recapitalizing the world on Bitcoin | with @amitisinvesting","duration":5172},
                {"id":"J38-PQ6X8HI","title":"Michael Saylor: Satoshi Opened A Portal Into Cyberspace","duration":8203},
                {"id":"Fvi6pdG_jZw","title":"GigaChad Michael Saylor Best Moments - Bitcoin Song","duration":83},
                {"id":"8eaJ3VuzhmY","title":"Michael Saylor Responds to Bitcoin Critics","duration":6715},
                {"id":"5jLPnGVm0k4","title":"T'was The Night Before Earnings | True North Podcast | Ep. 25","duration":5500},
                {"id":"takcCQySsPw","title":"Bitcoin is Global | Strategy World 2026","duration":811},
                {"id":"G_VIAI9uXQk","title":"True North Orlando - The people behinds the scenes | TheBitcoinGal, Trollstein and J64","duration":638},
                {"id":"nr9tQmTeA20","title":"Bitcoin Treasury Companies Eating the Bond Market","duration":329},
                {"id":"oHnoxfjAPqo","title":"Michael Saylor Bitcoin for Corporations 2025 Keynote Speech","duration":3909},
                {"id":"nXAfbiZFvjM","title":"$MSTR True North - $STRF ATM - Investment Grade Analysis & Market Comp Simulation","duration":4321},
                {"id":"dGm8YA96oOs","title":"Mathematically Comparing Hypothetical Risk Profiles |$STRC vs $SATA","duration":355},
                {"id":"T9sRVEIOQL8","title":"Putting Your Assets to Work | BFC Symposium, Amsterdam 2025","duration":1297},
                {"id":"BYk1Id2j7_8","title":"Michael Saylor's Deep-Dive on Bitcoin Energy Misconceptions (BTC099)","duration":10450},
                {"id":"qoDg83TKFYs","title":"Steven Lubka: Let the Super Cycle Begin | Bitcoin for Corporations Ep. 15","duration":4252},
                {"id":"WQGt4Lqx4dY","title":"The Preferred Strategy is Digital Credit | The Hurdle Rate Ep. 34","duration":3108},
                {"id":"QI3nWhrZ1-k","title":"NEW MicroStrategy CEO Michael Saylor Interview - 12/28 Twitter Spaces w/ Eric Weiss","duration":4102},
                {"id":"_GHU3v3mqwE","title":"Digital Risk w/ Jeff Walton | Strategy World 2026","duration":932},
                {"id":"xn607rFc1U8","title":"True North Pulse - MSTR has a 91% chance of qualifying for the S&P 500 | Jeff Walton","duration":387},
                {"id":"ggd-qnM9iwI","title":"Jeff challenges you to look at the bond market.","duration":69},
                {"id":"w2e3nL7xMz0","title":"Why Corporations Are Putting Bitcoin on Their Balance Sheet - Pomp Podcast #595","duration":3184},
                {"id":"_pVKQYdnsMc","title":"Michael Saylor Explains the Digital Credit Revolution","duration":811},
                {"id":"0JNkMSvVpQk","title":"MSTR stock could move up QUICKLY #trading #bitcoin #mstr","duration":117},
                {"id":"gSc6BC1Kh2g","title":"Digital Gold: Harder, Smarter, Stronger, Faster - The Saylor Series Episode 6","duration":5028},
                {"id":"b0KU4cJgj6g","title":"Michael Saylor: The Bitcoin Treasury Endgame","duration":5381},
                {"id":"mjWzlAl5ss8","title":"MSTR's Bold BTC Bet | True North Podcast | Ep. 6","duration":5756},
                {"id":"qRGGjK7oupw","title":"Bitcoin Supply Shock: Michael Saylor's Massive Accumulation!","duration":38},
                {"id":"EeeZSiZQ5q4","title":"New Market Structures Using STRC & Bitcoin-Linked Products | Strategy World 2026","duration":603},
                {"id":"qQlMFaX4dbA","title":"Colin's Michael Saylor impression","duration":26},
                {"id":"Mz1LhRXwY1Q","title":"\"Wall Street Has Woken Up” w/ Matt Hougan of Bitwise | BFC Show Ep. 34","duration":2968},
                {"id":"8XbR73Et0E4","title":"Metaplanet and the BOJ's Debt Trap: The BTC Treasury Perfect Storm? w/ Dylan LeClair & Phil Geiger","duration":3845},
                {"id":"49ADpogjahE","title":"STRC x SATA - BTC Risk & BTC Credit","duration":1390},
                {"id":"rkaXG5abVYY","title":"Commodity, Security, Token | The Hurdle Rate Ep. 22","duration":3124},
                {"id":"N3J868zhH9g","title":"Bitcoin Is Encrypted Energy - Saylor & Breedlove","duration":613},
                {"id":"p8G0JLe47Ws","title":"Bitcoin vs. Gold (Who wins?) #gold #bitcoin #money","duration":89},
                {"id":"RId-NJHsHRI","title":"Michael Saylor’s Strategy Buys $1.28 BILLION more in #Bitcoin","duration":72},
                {"id":"CYT0AxQxa7o","title":"Why Bitcoin Succeeds - The Saylor Series Episode 12","duration":6045},
                {"id":"uFTqXnEym04","title":"How MicroStrategy is Changing Credit Markets Forever","duration":522},
                {"id":"yjDPsXw99X8","title":"Michael Saylor Exposes the Bitcoin Rehypothecation Problem","duration":70},
                {"id":"rhT9B1ZUkUY","title":"Strategy ($MSTR) Will Get To 1,000,000 BTC","duration":324},
                {"id":"wdJFeSY8UVk","title":"Michael Saylor on Tucker Carlson Today - Full Interview","duration":4836},
                {"id":"HHyCHEH1FGw","title":"BTC vs Gold: The Capital Base Layer Bull Thesis, Disrupting Credit Markets w/ Khing Oei | BFC Ep. 17","duration":4114},
                {"id":"GocJIgAY-WI","title":"Interactive Q&A with Michael Saylor & Phong Le | Strategy World 2026","duration":3267},
                {"id":"WvUE_Yvktwk","title":"Bitcoin's Seven Layers of Security #2 - The Saylor Series Episode 15","duration":4498},
                {"id":"3e4gcMXNNpM","title":"Michael Saylor’s reaction to Bitcoin price crash","duration":79},
                {"id":"_Nvh_xScNPY","title":"SaylorJungle - 1 Hour Relaxing Saylor with Forest Rain Sounds","duration":3581},
                {"id":"xr52rDogbAQ","title":"\"Satoshi is the poet, Jeff Booth is the prophet, and Saylor is the prince.\"","duration":142},
                {"id":"g2aE7hVKH1o","title":"Structurally Bullish | The Hurdle Rate Ep. 41","duration":3580},
                {"id":"AzpRvdaMGfY","title":"Bitcoin House vinyls are here & you can watch me unbox in my slippers 🙏 #bitcoin #michaelsaylor","duration":32},
                {"id":"YtQhBfLNeGY","title":"Inject The Bitcoin Volatility Virus | True North Podcast | Ep. 33","duration":7818},
                {"id":"BHBfDF9Of1Y","title":"Financial Engineering 101 | True North Podcast | Ep. 15","duration":7620},
                {"id":"bjvMt0xaSUQ","title":"The Saylor Series | Part 4: The Future of Bitcoin & Civilization","duration":831},
                {"id":"99liY3HDiG0","title":"On/Off/On/Off/On/Off | True North Podcast | Ep. 23","duration":7024},
                {"id":"-cx1Am2UFCA","title":"Why Bitcoin: Michael Saylor Interview - #Bitcoin #LostCoins $MSTR #Future #Math Education + more","duration":4832},
                {"id":"RI4xEHI7tGg","title":"Michael Saylor - PBD Podcast Ep. 212","duration":7187},
                {"id":"o5XBSF6w7I4","title":"MusicSnake - Stack Sats (feat. Michael Saylor)","duration":176},
                {"id":"k0adfjcSDHs","title":"MicroStrategy: The Case for Bitcoin on Corporate Balance Sheets | Bitcoin for Corporations","duration":3052},
                {"id":"FWXivDbeyWw","title":"Strategy ($MSTR) Balance Sheet UPDATE","duration":499},
                {"id":"JS7lOkTgER4","title":"Post $MSTR Q1 2025 Earnings call - reflections & breakdown","duration":2837},
                {"id":"Z-38QA3hqRs","title":"BTC v MSCI: The Fight to Keep Bitcoin Companies in Global Indexes w/ George Mekhail | BFC Show Ep 21","duration":3830},
                {"id":"OBaNWJ5vLQI","title":"What Shall We Do With Michael Saylor?","duration":156},
                {"id":"3r_Z3U0jIA4","title":"The Best Message Is Digital Credit | The Hurlde Rate Ep. 43","duration":3768},
                {"id":"RGI4N223lSU","title":"Why Bitcoin Sovereignty Beats ETF Convenience w/ Trey Sellers of Unchained | BFC Show Ep 31","duration":3813},
                {"id":"IdFlPrpi5cc","title":"Build The Structure | The Hurdle Rate Ep.46","duration":2971},
                {"id":"BJgIbOkyBn8","title":"Fed Signals and Equity Stakes | The Hurdle Rate Ep. 24","duration":3569},
                {"id":"4NLgRlObe1w","title":"The Predator-Prey Dynamics Of Bitcoin: Michael Saylor - Bitcoin Magazine","duration":5793},
                {"id":"d4XxuxnreBs","title":"True Cost of Inflation - Michael Saylor & Lex Fridman","duration":885},
                {"id":"EiZSozfvKMQ","title":"Michael Saylor Lost His Mind - There Is No Second Best Meme","duration":51},
                {"id":"LbddD5vmFCY","title":"True North Now - Inside look at The SmarterWeb Company | Featuring CEO Andrew Webley","duration":2912},
                {"id":"ig9pu0XRtNM","title":"Bitcoin as Power to the People - Saylor & Robert Breedlove","duration":4664},
                {"id":"Y7FsiPuF3z4","title":"SaylorSpace - Travel Through Cosmos with Michael Saylor on Bitcoin","duration":3628},
                {"id":"eS5VL35RNvE","title":"True North Orlando 2025 - Conviction as a service | Ben Werkman","duration":950},
                {"id":"Qv9meQd7S_M","title":"The Importance of Index Inclusion for Digital Asset Treasury Companies | Strategy World 2026","duration":1003},
                {"id":"DuGoa1BmEu4","title":"Bitcoin as a Generational Investment Opportunity w/ Katie Stockton, Hong Kim & Duke Waldrop","duration":1424},
                {"id":"hqoagNBtIps","title":"Michael Saylor: Bitcoin Prophecy - BTC Prague 2025","duration":2855},
                {"id":"BO4LnHoOcM4","title":"Investment Banker Christian Lopez: Why EVERY Balance Sheet Will Hold BTC | BFC Ep. 13","duration":3674},
                {"id":"kCHcX7Xw104","title":"Unlocking Value in Bitcoin Treasury Companies w/ Tyler Evans, Loren Asmus, John Riggins, Mason Foard","duration":1828},
                {"id":"UADTd7gCuXo","title":"THERE IS NO SECOND BEST - Saylor at BTCPrague 2023","duration":2442},
                {"id":"6WVXmSz2RWw","title":"How Bitcoin Will Succeed.","duration":62},
                {"id":"D8KVtBKQBtE","title":"Navigating MSTR and BTC | True North Podcast | Ep. 1","duration":7618},
                {"id":"eRvBj7j24B0","title":"97. Bitcoin Strategy with Michael Saylor CEO of Microstrategy","duration":10530},
                {"id":"aIiZGnvyMQY","title":"The Bitcoin Orchestra | True North Podcast | Ep. 24","duration":7209},
                {"id":"oFJym2CKMQ8","title":"Michael Saylor's Definitive Case for Bitcoin","duration":296},
                {"id":"LBKld0QdXnk","title":"Bitcoin Is Being Adopted By A Country As Sovereign Money - Pomp Podcast #585","duration":3647},
                {"id":"XdgP25UcHB0","title":"Bitcoin for Corporations - Saylor & Dorsey","duration":15111},
                {"id":"S_-1q3zdUYo","title":"An Increasingly Digital World | The Hurdle Rate Podcast Ep.52","duration":3236},
                {"id":"UtY3kTlf0cI","title":"True North Now - Inside look at The Blockchain Group | Featuring Alexandre Laizet","duration":3740},
                {"id":"xerlqYufU2s","title":"\\\"If Your Buying MSTR or STRC This Is 100% Guaranteed For Bitcoin\\\" — Brandon Gentile","duration":83},
                {"id":"AKvWwZJ6gfA","title":"Sigma Chad Michael Saylor - It's Going Up Forever Laura","duration":58},
                {"id":"uUUwuxTquws","title":"Michael Saylor Bought $7 Billion In Bitcoin - Pomp Podcast","duration":447},
                {"id":"yl2q52XWG6s","title":"Michael Saylor Predicts $400T Bitcoin After Buying $1B in a Single Day!","duration":1215},
                {"id":"VeFTC_DzqS8","title":"Michael Saylor & Simon Gerovich Fireside Chat | Bitcoin MENA 2025","duration":1754},
                {"id":"rp7MwBSLGHQ","title":"Michael Saylor Responds to Bitcoin in Epstein Files","duration":56},
                {"id":"iue1CHo_F-o","title":"Will Travel For Bitcoin | The Hurdle Rate Ep. 25","duration":2647},
                {"id":"Rty7BQyUkHM","title":"NEW Michael Saylor Interview on Bitcoin (12-Minute Summary)","duration":751},
                {"id":"-gqZiDZ_eNg","title":"True North Orlando 2025 - Opening remarks from CEO of Strategy | Phong Le","duration":229},
                {"id":"QdKlVpR5jpU","title":"Morgan Stanley Announces New Bitcoin ETF","duration":506},
                {"id":"kxBdefymFiw","title":"Bitcoin Treasuries: The Next Corporate Playbook w/ Adam Back, Siddarth Bharwani & Gurpreet Oberoi","duration":1318},
                {"id":"ioM33qIAfdY","title":"Michael Saylor calls them poor!? (Lil Bubble House Remix) #bitcoin","duration":56},
                {"id":"9T2Ri7IzrsE","title":"Q&A with Michael Saylor, Phong Le, James Lavish & Natalie Brunell | Strategy World 2026","duration":3267},
                {"id":"_wNqRmv81qY","title":"Why Strategy Buys Bitcoin Even in a Bear Market! #mstr #investing #bitcoin","duration":85},
                {"id":"9jsmGd9puYU","title":"Saylor: Bitcoin vs Real Estate - Why BTC Wins","duration":647},
                {"id":"AX2qaZrPrlY","title":"Michael Saylor on Why Bitcoin Swings Wild #bitcoin #volatility #shorts","duration":52},
                {"id":"ZTO9GrKVNPw","title":"Navigating The Storm | True North Podcast | Ep. 37","duration":7686},
                {"id":"cuRRVo2Cmsc","title":"Why Bitcoin Now: Michael Saylor on the Best Way for Companies to Buy Bitcoin - Ep.209","duration":5883},
                {"id":"ohtsx2hGGzI","title":"Lil Bubble - Bitcoin Baby (Official Visualizer) ft. Michael Saylor","duration":234},
                {"id":"RMp-c6ADsVE","title":"Let's Talk About Leverage | True North Podcast | Ep. 11","duration":8094},
                {"id":"s_0ggp41rT4","title":"Bitcoin Common Misconceptions - Saylor & Robert Breedlove","duration":8152},
                {"id":"OmrKYS2qcXw","title":"The Capital Fortress | True North Podcast | Ep. 47","duration":5291},
                {"id":"UC1R-lChYr4","title":"What is Credit Risk? | True North Podcast | Ep.53","duration":7586},
                {"id":"ODPZpZfSUEM","title":"Derivatives Strategies | Strategy World 2026","duration":755},
                {"id":"yQL9yua9Yq0","title":"Michael Saylor on Bitcoin: The Digital Transformation","duration":3032},
                {"id":"3axVO-3iKjg","title":"Michael Saylor explains why Bitcoin's creator doesn't matter","duration":61},
                {"id":"3GkA2grVaNw","title":"Michael Saylor Explains Why Bitcoin is Superior to Gold","duration":607},
                {"id":"OA3DGM0vgtM","title":"Michael Saylor Keynote - 2024 Cantor Fitzgerald Conference","duration":3539},
                {"id":"JeIHtWg7YJQ","title":"$STRDing Toward BTC Fixed Income | True North Podcast | Ep. 28","duration":7643},
                {"id":"0RZ1geieiao","title":"Michael Saylor on the second best crypto currency 🤭 (Lil Bubble House Remix) #bitcoin","duration":52},
                {"id":"lIODLyOWqpE","title":"Bitcoin: There Is No Second Best | Michael Saylor at Bitcoin for Corporations","duration":3807},
                {"id":"g9hUmh6NnAg","title":"Metaplanet: From COVID Collapse to Bitcoin Treasury Strategy","duration":120},
                {"id":"q9Yo9woraoE","title":"Bitcoin Long Term Capital Market Assumptions w/Matt Hougan (Bitwise CIO)","duration":1461},
                {"id":"8h8Pyy4s12w","title":"Michael Saylor on Fox News: Why El Salvador Adopted Bitcoin","duration":342},
                {"id":"o3WT9wz0oOk","title":"What's Actually Happening with Strategy ($MSTR) Stock Price w/ Adam Livingston","duration":8022},
                {"id":"TjgrV6M2VyU","title":"What does it take for $MSTR to meet their dividend obligations? #mstr #bitcoin","duration":111},
                {"id":"6P97_koDGtA","title":"Bitcoin vs Manhattan Real Estate in 1776 - Michael Saylor","duration":872},
                {"id":"oPbHTD3vCEU","title":"Strategy Launches STRE (“Stream”) Euro-Denominated Perpetual Preferred Stock Offering with 10% Yield","duration":1709},
                {"id":"0LPXxbg5r38","title":"No Days Off | True North Podcast | Ep. 38","duration":3029},
                {"id":"2NwaMg0VyC8","title":"Bitcoin, Bonds and Breakthroughs | True North Podcast | Ep. 7","duration":8257},
                {"id":"Uc26OItd0JU","title":"Joe Rogan and Michael Saylor on Bitcoin","duration":126},
                {"id":"HSqlTJjs36g","title":"Michael Saylor's Strategy World 2026 Keynote: Digital Credit","duration":3032},
                {"id":"k7XhzXMSAPo","title":"239. Michael Saylor's 4 years of bitcoin","duration":8428},
                {"id":"-SrOHgdyuBQ","title":"First 10 Years of Your Career are Important! #mstr #trading #retirement #financialplanning #bitcoin","duration":70},
                {"id":"68gbrVgwxDQ","title":"How capital will move between Bitcoin and Preferred Equities  #trading #bitcoin","duration":123},
                {"id":"YFgJVIhc79E","title":"Waiting For The World To Catch Up | True North Podcast | Ep. 59","duration":6387},
                {"id":"5oI5hDDYYgk","title":"New Year, Same Business | True North Podcast | Ep. 12","duration":8762},
                {"id":"9xhks3PPI3w","title":"Beneath The Surface, A System In Motion | True North Podcast | Ep. 60","duration":6879},
                {"id":"rcGeY0OzWdQ","title":"Michael Saylor: Money is Energy - Breedlove & Lex Fridman","duration":457},
                {"id":"SojzZxhMf00","title":"The Virtues of Strong Money - The Saylor Series Episode 7","duration":5493},
                {"id":"ErhdjIY5ogs","title":"A Structural Shift | The Hurdle Rate Podcast | Ep. 55","duration":3061},
                {"id":"NiBPWzNm1Jo","title":"Inside Brazil's Corporate Bitcoin Boom w/ Israel Salmen & Mason Foard | BFC Ep. 18","duration":2706},
                {"id":"dPvVqTlPRPY","title":"Credit Ratings for Digital Capital | The Hurdle Rate Ep. 33","duration":3261},
                {"id":"QBLGZqYTmn8","title":"MicroStrategy's Bitcoin Strategy Is INSANE - Pomp Podcast","duration":2499},
                {"id":"_iQni1dCqDY","title":"Bitcoin Trading Like a Currency — And Institutions Know It","duration":88},
                {"id":"DqHEgdThGuU","title":"Issuer Perspective of Investing in Digital Credit | Strategy World 2026","duration":1871},
                {"id":"G0l1X9XvDe4","title":"\"The iPhone Moment\" | True North Podcast | Ep. 35","duration":7051},
                {"id":"kFP_1ulQ4uI","title":"SaylorRain - Relaxing Saylor Speaks on Bitcoin with Rain Sounds (1H)","duration":3605},
                {"id":"ffjHKvulDns","title":"Michael Saylor Addresses Bitcoin Treasury Skeptics","duration":929},
                {"id":"peiCCZdOXuI","title":"The Reflexive Demand Shock Is Not Priced In w/ Alexandre Laizet | Bitcoin for Corporations Ep. 16","duration":4069},
                {"id":"LP5W_BUXnEw","title":"Bitcoin, Economics & Mimetics - Saylor & Robert Breedlove","duration":4891},
                {"id":"IzMSMzt6TDA","title":"How Bitcoin Makes FIRE a Reality w/ Trey Sellers of Unchained","duration":375},
                {"id":"VWHBbtUWBEE","title":"Financial Leverage & Bear Sightings | True North Podcast | Ep. 9","duration":8860},
                {"id":"53s-U4SEI9s","title":"Proof of Performance: The KPIs That Matter","duration":1423},
                {"id":"c3E91-RGjQE","title":"EXCLUSIVE: Michael Saylor Masterclass On Bitcoin","duration":8740},
                {"id":"0yFvw8XMQuM","title":"ANALYSIS: MSTR Q3 Earnings Call | The \"BTC Refinery\" Model","duration":3456},
                {"id":"uODBZGzKdzE","title":"Why Metaplanet’s Bitcoin Strategy Has Dylan LeClair Bullish","duration":62},
                {"id":"rv8HD3l0VEE","title":"Building a Digital Empire | True North Podcast | Ep. 36","duration":7343},
                {"id":"tvUQLJmQxuY","title":"What's The End Game of a Bitcoin Treasury Company? - Austin Alexander, Alexandre Laizet, Jesse Myers","duration":1807},
                {"id":"Sc9_2I3-LdE","title":"The Revolution of Digital Credit | True North Podcast | Ep. 45","duration":6982},
                {"id":"RsoUxYJBKbU","title":"True North Orlando 2025 - Where are we going? | Jeff Walton","duration":908},
                {"id":"RK6t570jdgs","title":"Strategy ($MSTR) Balance sheet vs Coinbase ($COIN)","duration":327},
                {"id":"aFGCKwPNH4I","title":"The Defining Question of Our Time in History - Michael Saylor","duration":194},
                {"id":"fUFnLPblsBg","title":"100% Saylor - Michael Saylor Best Moments","duration":102},
                {"id":"LFlA0YKXbrc","title":"Africans Get Bitcoin Faster Than Fortune 500 CEOs","duration":118},
                {"id":"1RV2Fpqpe48","title":"Michael Saylor in The Age of Revolution - Google Ngram Meme","duration":25},
                {"id":"Umo16GF91HU","title":"The Quiet Accumulation | True North Podcast | Ep. 56","duration":6518},
                {"id":"oKhVBv_A9pI","title":"MSTR Q4 2025 Earnings Call: Bitcoin Is Now Backed by Politicians, Institutions & Banks","duration":391},
                {"id":"9jgoAqTErfs","title":"Michael Saylor Brilliantly Explains Bitcoin's Superiority","duration":1253},
                {"id":"1PkMFIa7rmQ","title":"21 Rules of Bitcoin - Saylor Prague 2024","duration":2415},
                {"id":"zCvYKTLGGRc","title":"Bitcoin Treasuries & The New Credit Paradigm w/ Jeff Walton of Strive","duration":1134},
                {"id":"O3Nn0iPbN6s","title":"True North Orlando 2025 - From Basements to Stages | Jeff and Crew","duration":3219},
                {"id":"9qfWBr9Ggzg","title":"Why Digital Credit?","duration":269},
                {"id":"59vC4JxWIQU","title":"Michael Saylor Keynote Address - BTC in DC 2025","duration":2364},
                {"id":"zoZiw1cSOBY","title":"The Trade Idea Nobody Is Talking About ($STRC)","duration":521},
                {"id":"S2ziezeoK4E","title":"What's Actually Happening To Bitcoin & The Economy Right Now - Saylor","duration":2708},
                {"id":"3-vBBYEXv6M","title":"Saylor: Bitcoin as Apex Capital Strategy in the AI Age","duration":3909},
                {"id":"L1odkMa4PCE","title":"Signals From True North Live | True North Podcast | Ep. 57","duration":7029},
                {"id":"Wz2LE_21q5c","title":"\"Pref Analysis / Deep Dive\" | True North Podcast | Ep. 42","duration":6050},
                {"id":"TWSl9mdoYds","title":"Expert Analyzes the Impact of a Bitcoin ETF - Michael Saylor","duration":402},
                {"id":"J2GAFWLNOhQ","title":"Strategy's Preferred Stock $STRC | Why Is It Valuable?","duration":375},
                {"id":"Is99RsbExvE","title":"Margin Isn't Calling! | True North Podcast | Ep. 54","duration":6782},
                {"id":"zQwaUUOzNSs","title":"The Asymmetry of Bitcoin-Backed Credit | MSTR Q4 2025 Earnings Call","duration":102},
                {"id":"xzHc5x9muT0","title":"Post Election Discussion | True North Podcast | Ep. 3","duration":5578},
                {"id":"V-SQTNYZinw","title":"Bitcoin Treasury Pitfalls: Is It Always The Right Move? | Bitcoin MENA 2025","duration":1250},
                {"id":"_BUT5f9tRNM","title":"Is The Tide Turning? | True North Podcast | Ep. 58","duration":6265},
                {"id":"mTeqO63hGI4","title":"Michael Saylor Dismantles the Strongest Argument *Against* Bitcoin","duration":50},
                {"id":"ctZz5Dl5OEE","title":"New way of building wealth in your 20's  #bitcoin #mstr #investing","duration":74},
                {"id":"tqL6RdHaH_Q","title":"LIVE: Bitcoin for Corporations - Day 2 | Strategy World 2026","duration":31411},
                {"id":"j088KB4wDh8","title":"Bitcoin Adoption Trends w/ Alex Leishman | Strategy World 2026","duration":455},
                {"id":"Um_qzLz_YIw","title":"Michael Saylor: Bitcoin Is Digital Capital—Here’s Why It Matters","duration":174},
                {"id":"U2Q1A75EAk8","title":"The Brutal Truth About Bitcoin #trading #mstr #strc #bitcoin","duration":65},
                {"id":"rHJskIc92H4","title":"The Federal Reserve Is Broken | Bitcoiners Explain Why","duration":702},
                {"id":"X785ZNCW87g","title":"How Real Is Strategy’s Bankruptcy Risk? ($MSTR)","duration":449},
                {"id":"qPtBbjFR5ak","title":"The Next Trillion Dollar Company | Phong Le Interview","duration":3264},
                {"id":"6cfdK5PWsxI","title":"The M&A Era has Begun | The Hurdle Rate Ep. 28","duration":3033},
                {"id":"D6lqLqPYgTI","title":"True North Now - Another inside look at The SmarterWeb Company | Featuring CEO Andrew Webley","duration":2159},
                {"id":"1Ms7ql_S63A","title":"The Saylor Series | Part 2: Bitcoin as Digital Gold & Property Rights","duration":6446},
                {"id":"k7LEBbzVdHg","title":"Beyond HODLing: Bitcoin Yield Strategies | Bitcoin MENA 2025","duration":1383},
                {"id":"sp90Dh2Igr0","title":"Europe's First Bitcoin Treasury Company | Strategy World 2026","duration":573},
                {"id":"dVfmTMo_mO0","title":"Celebrating Bitcoin Price with Relaxing Michael Saylor Speaking (10H)","duration":36762},
                {"id":"YMxuzzYqPi8","title":"Volatility's Return & Bitcoin Treasuries | True North Podcast | Ep. 19","duration":6229},
                {"id":"0Hc1wsSSyvM","title":"Translating Bitcoin for Legacy Corporates w/ Sam Callahan, Khing Oei, Lennart Lopin & Sean Bill","duration":1404},
                {"id":"OtOaE24IGlA","title":"Tokenization: The Next Era of Corporate Finance | Strategy World 2026","duration":1782},
                {"id":"VVk1LohR-KE","title":"$MSTR True North - Strategy World 2025 - Digital Transformation of Investor Relations","duration":4675},
                {"id":"Q9zn96gOy0U","title":"Jeff asks a trick question. #mstr #bitcoin #realestate #strc","duration":61},
                {"id":"WOpTi_qJUiw","title":"Bitcoin's Transaction Volume Exceeded American Express - Saylor","duration":371},
                {"id":"1LLtefID_VE","title":"The Hurdle Rate Is High | The Hurdle Rate Ep. 39","duration":2488},
                {"id":"LnLSVgOgngc","title":"Engineering the Institutional Bitcoin Economy | Bitcoin MENA 2025","duration":1293},
                {"id":"p3vNo6JcC7s","title":"Bear is for Building | True North Podcast | Ep. 49","duration":7003},
                {"id":"l1YeMuTUjuY","title":"The Equitization of Bitcoin: Treasury CEO Khing Oei | BFC Symposium, Amsterdam 2025","duration":936},
                {"id":"eDZu7ay1etQ","title":"Bitcoin is Powered by Chaos #mstr #trading #bitcoin","duration":80},
                {"id":"l3KxDiSgjpk","title":"True North Orlando 2025 - The DNA of a Bitcoin portfolio  | Dan Hillary","duration":571},
                {"id":"DpxMhcxi4wI","title":"The Nakamoto Flywheel Strategy for Scaling a Bitcoin Treasury with BTC Inc | BFC Show Ep. 28","duration":3157},
                {"id":"CA_XnoCk4sY","title":"Michael Saylor Has DOUBLED His Bitcoin Investment!","duration":305},
                {"id":"KWBPeSQmn_I","title":"Michael Saylor: We Built an Investment That Solves Every Investor's Biggest Dilemma","duration":88},
                {"id":"3twzBeUU_HU","title":"Wall Street Could Kick These Bitcoin Companies Out","duration":133},
                {"id":"3AzYUGjSf-w","title":"Bitcoin is disrupting the $300+ Trillion Credit Market.  #mstr #bitcoin #investing #investing","duration":61},
                {"id":"4ClRqE1Dbqs","title":"Bullish Digital Credit | The Hurdle Rate Ep.48","duration":3251},
                {"id":"sLDz5_Xalak","title":"Strategy ($MSTR) 2022 vs 2026: What Changed","duration":676},
                {"id":"zBGofxUj9dc","title":"Michael Saylor - Forever, Laura (Lil Bubble Bitcoin House Remix)","duration":192},
                {"id":"YsrHaQ_DOcY","title":"Rate Cuts, AI Bubbles, and Why Bitcoin Wins Either Way","duration":371},
                {"id":"r3fjhCedp-U","title":"Bitcoin Survival Logic: Saylor's Strategy Dominates Geopolitics","duration":36},
                {"id":"EP0XfP2HCCM","title":"Regulatory Panel | Strategy World 2026","duration":1802},
                {"id":"qBPtUf50XVg","title":"Saylor BEST Bitcoin Podcast: Why You NEED 0.1 Bitcoin in 2025","duration":5333},
                {"id":"1c7weMce8_A","title":"Give Me a Lever Long Enough | True North Podcast | Ep. 17","duration":5856},
                {"id":"wba5XJHKPqg","title":"Saylor: Bitcoin Halving Will Drive Demand Through the Roof","duration":236},
                {"id":"UQjmBvmyfqA","title":"Listening to Michael Saylor ALL Day - Transcendental Bitcoin Meditation","duration":43},
                {"id":"D_yIKnHOuWg","title":"Michael Saylor Answers the Question of Our Time","duration":327},
                {"id":"aWtzOQTv8Dc","title":"Saylor vs Dorsey: Battle for Bitcoin's Future","duration":917},
                {"id":"ZcjFrIMw2sI","title":"Michael Saylor Keynote - The 2022 Atlas Society Gala","duration":1253},
                {"id":"aJIt3dUWEAs","title":"Unleashing the Cyber Hornets: Michael Saylor on the Power of Bitcoin","duration":3600},
                {"id":"agzUmY0w1-A","title":"Don't Panic: Michael Saylor on Quantum Computing and Bitcoin's Future","duration":171},
                {"id":"IEugtyLaaAQ","title":"This Could Drive Bitcoin to $1,000,000","duration":342},
                {"id":"sjYANTSww34","title":"Michael Saylor Briefly Explains Why Bitcoin Is The Best Store of Value","duration":223},
                {"id":"VwTzTuc4qDk","title":"LIVE: Bitcoin for Corporations - Day 1 | Strategy World 2026","duration":18242},
                {"id":"3MwB99iAYfY","title":"Bitcoin Education Institute | Strategy World 2026","duration":697},
                {"id":"Y5_AtkCpfhI","title":"\"Bitcoin  Did This\" | True North Podcast | Ep. 51","duration":7264},
                {"id":"uEPERVZWNoQ","title":"Set Up For A Supercycle | The Hurdle Rate Ep. 40","duration":2790},
                {"id":"RbkLz9C39y0","title":"Bitcoin's Seven Layers of Security - The Saylor Series Episode 14","duration":4721},
                {"id":"BxYClOh-Mlo","title":"Michael Saylor: $2M to $40M With One Simple Bitcoin Strategy","duration":113},
                {"id":"O9KnBcWMkpw","title":"Michael Saylor 2024 Keynote - Nashville","duration":2244},
                {"id":"y4Wtwbmszow","title":"True North Now - Knots & Bitcoin: Spam, Filters, and the Fight for the Network | Featuring Mechanic","duration":3677},
                {"id":"wcJtAcOjlTM","title":"Bitcoin-Linked Convertibles | Strategy World 2026","duration":975},
                {"id":"KfTazf9z40w","title":"Lil Bubble - Escape The Matrix (Official Visualizer) ft. Michael Saylor","duration":153},
                {"id":"GYKslGw0P5I","title":"Pensions, Private Equity & Digital Credit | The Hurdle Rate Ep. 42","duration":3744},
                {"id":"PXC0spZ2M4U","title":"Is Bitcoin Digital Gold? - Michael Saylor","duration":402},
                {"id":"FVuKRYuhv8w","title":"Michael Saylor: The Bitcoin Treasury Endgame - An Exclusive At-Home Interview","duration":5381},
                {"id":"v4jHjIfMT8k","title":"Defeating the Single Point of Failure w/ Mike Belshe of BitGo | BFC Show Ep. 33","duration":3079},
                {"id":"tkFnDInGouA","title":"Wealth and Treasury Management in the Bitcoin and AI Era | Strategy World 2026","duration":726},
                {"id":"0Y7qcaIkgMY","title":"Appeasing Michael Saylor - Bitcoin Singularity","duration":3601},
                {"id":"IZhS7z91xXc","title":"Bitcoin Treasury Fundraising in Bear VS Bull Markets w/ Brandon Green & Robert Harrison","duration":966},
                {"id":"PyYogQEnPNE","title":"Should You Buy Bitcoin? - Michael Saylor","duration":219},
                {"id":"v4na2pycrcc","title":"The Future is Bitcoin with Michael Saylor - Moonshots & Mindsets","duration":5392},
                {"id":"MSMJBmo_q4s","title":"Saylor: Bitcoin as Treasury Reserve Asset","duration":240},
                {"id":"_T6Wu5d3IY0","title":"$MSTR True North - In the Mind of Richard Byworth with Jeff Walton","duration":4164},
                {"id":"z3saVEaGiFI","title":"The Bitcoin Index Inclusion Question w/Dylan LeClair, Tyler Evans, Alexandre Laizet & George Mekhail","duration":1376},
                {"id":"rQMFrpUFcNM","title":"Michael Saylor Keynote - Bitcoin MENA 2025","duration":2547},
                {"id":"D446irWy6kA","title":"How Bitcoin changed his life. #mstr #bitcoin #trading","duration":83},
                {"id":"PxnlhBP-wRs","title":"Jeff Walton Explains Digital Risk | Strategy World 2026","duration":940},
                {"id":"mJ4rDOQ39JQ","title":"The Semler Acquisition: Strive's Bitcoin Credit POWERHOUSE w/ Matt Cole & Jeff Walton | BFC Ep. 14","duration":4026},
                {"id":"DrxZJY9EhWM","title":"MSTR Q4 2025 Earnings Call Analysis: The Digital Credit Stress Test | BFC Show Ep. 25","duration":4536},
                {"id":"EoFVjY7AswM","title":"Focus on the Future | The Hurdle Rate Ep. 30","duration":2876},
                {"id":"ykvjtK30HiA","title":"Michael Saylor & The Ultimate Bitcoin Strategy","duration":5766},
                {"id":"bCj06VkJPMg","title":"Why STRC Is the Most Important Security in All of Bitcoin | Strategy World 2026","duration":504},
                {"id":"dogJz_CfQW8","title":"Inspiring and Relaxing Michael Saylor Speaks about Bitcoin for 1H","duration":3602},
                {"id":"6vvp_3uftyE","title":"Methods for Generating Bitcoin Income | Strategy World 2026","duration":1131},
                {"id":"raJ6uR_wTPQ","title":"True North Now - Inside look at Semler Scientific | Featuring Eric Semler & Joe Burnett","duration":2620},
                {"id":"r1_8RumNLLI","title":"Protect Index Integrity: A Response to MSCI's Digital Asset Proposal","duration":323},
                {"id":"p0RMnov0i3Q","title":"Bitcoin's BIGGEST Opportunity: Saylor's Genius Strategy Revealed!","duration":72},
                {"id":"ssEMtaRwra0","title":"The Saylor Series | Part 3: Bitcoin as the Ultimate Asset","duration":13151},
                {"id":"4A4goufTTI8","title":"\"Rate My Stock / Risk of Credit\" | True North Podcast | Ep. 43","duration":7126},
                {"id":"VSB_lXxJbDA","title":"Rewiring The Credit Curve | True North Podcast | Ep. 32","duration":6868},
                {"id":"7wHQGnfnWAs","title":"Weeks When Decades Happen | True North Podcast | Ep. 20","duration":6313},
                {"id":"JzsrwmPzttw","title":"Fishing For The Fixed Income | True North Podcast | Ep. 29","duration":7440},
                {"id":"gbr95uDuF94","title":"Bitcoin’s \"iPhone Moment\" is Here w/ Strive Chief Officers | BFC Show Ep. 32","duration":2686},
                {"id":"1Mr9PknsM_Y","title":"Michael Saylor's Best Explanation of Bitcoin","duration":349},
                {"id":"cyL2t75YLQM","title":"Building Japan's Bitcoin Standard w/ Simon Gerovich | Strategy World 2026","duration":892},
                {"id":"d3Ryy9CWfLc","title":"Bitcoin Treasury Strategy: Does Cash Flow Still Matter?","duration":1318},
                {"id":"LtcbR98uTJQ","title":"The Saylor Series | Part 1: The History of Money, Bitcoin & the Machine Economy","duration":3646},
                {"id":"_ZRc6plqG0s","title":"A Digital Dollar Backed by Bitcoin With 30% Yield | Strategy World 2026","duration":751},
                {"id":"6osK1CXno80","title":"Michael Saylor GETS ANGRY Talking About Bitcoin","duration":2177},
                {"id":"FM638pY34uo","title":"The Digital Credit Landscape | The Hurdle Rate Ep. 31","duration":3678},
                {"id":"CUilC81qgQ8","title":"Preferred Equity Demand | The Hurdle Rate Ep.45","duration":3910},
                {"id":"c8trwUs7oRQ","title":"\"Zero is the Wrong Number\" — Why You Can't Ignore Bitcoin Anymore w/ Hunter Albright of SALT Lending","duration":207},
                {"id":"wWejtrifr4w","title":"MSTR Built a 46 Year Bitcoin Safety Net. #mstr #bitcoin #digitalcredit","duration":61},
                {"id":"DiU3od1PvS0","title":"📺 LIVE: Over 12,000 BTC in ONE DAY from Strategy's STRC ATM - What will it hit today?","duration":30066},
                {"id":"YnlFl8weBE0","title":"Bitcoin Is Entering the Capital Markets Era | Strategy World 2026","duration":704},
                {"id":"CfgEBrerp2o","title":"Digital. Capital. Designed. | Strategy World 2026","duration":796},
                {"id":"OR23DNZQ36U","title":"Michael Saylor: The truth about quantum threat to Bitcoin","duration":54},
                {"id":"fZfg1Gtcg08","title":"100% Saylor - Michael Saylor Best Moments","duration":210},
                {"id":"ItvfKfYUd0c","title":"BTC Prague 2025 - Michael Saylor FULL KEYNOTE","duration":2855},
                {"id":"XbEOeRylUCw","title":"Michael Saylor: Bitcoin, FTX, Bear Market","duration":7364},
                {"id":"CHwCZIp5Xnc","title":"\"And Then They Fight You\" | True North Podcast | Ep. 46","duration":6663},
                {"id":"uiFn8X96Zi4","title":"Redefining Corporate Treasury: Prevalon Energy’s STRC Adoption | Strategy World 2026","duration":760},
                {"id":"JtujhPY4Wtg","title":"Bank said no 😭 #bitcoin #crypto #michaelsaylor","duration":10},
                {"id":"5GTVLqVi_Qw","title":"Capital Gravity Converging & Teeth Scarcity | True North Podcast | Ep. 26","duration":8386},
                {"id":"N6vOLQ3qJiA","title":"Michael Saylor's 5 Most Powerful Bitcoin Moments (Updated 2026)","duration":303},
                {"id":"TfizaD0EF4I","title":"Digital Assets at Morgan Stanley | Strategy World 2026","duration":1561},
                {"id":"QypTOT49SnI","title":"Why Bitcoin Treasury Companies Are Embracing Volatility w/ Metaplanet, Semler Scientific & Fold","duration":1611},
                {"id":"c2USwEB-D48","title":"This German Company is Future Proofing Its Balance Sheet With Bitcoin","duration":265},
                {"id":"MlIyPhpRFow","title":"Strategy₿ Q4 '24 Earnings Call | True North Podcast | Ep. 16","duration":7076},
                {"id":"EF5iiDgdfg8","title":"Michael Saylor's Bitcoin HODLing Strategy!","duration":34},
                {"id":"PPdRbAmYK6c","title":"Fireside Q&A: David Bailey & George Mekhail | Bitcoin for Corporations Symposium @ Bitcoin Asia 2025","duration":1449},
                {"id":"eSB4VJliyww","title":"Lil Bubble - F*cking Zero (Official Visualizer) ft. Michael Saylor","duration":155},
                {"id":"GUUUF9ApuXw","title":"How Metaplanet Turns Bitcoin Treasury Strategy Into Revenue","duration":81},
                {"id":"0GnG_3iHhrw","title":"Michael Saylor Told Eric Trump to Mortgage Mar-a-Lago for Bitcoin","duration":112},
                {"id":"Aa-4HW_1RGY","title":"If You Build It, They Will Come | True North Podcast | Ep. 21","duration":8521},
                {"id":"iojnUC6SXoQ","title":"True North Orlando 2025 - Setting Sail with Satoshi & Saylor | Tim Kotzman","duration":320},
                {"id":"BYCfwMrS-VM","title":"Strategy (MSTR) Q4 2025 Earnings Call w/ Analyst Q&A","duration":7307},
                {"id":"B4P_0LN60Rs","title":"Is This the New Bitcoin Meta? Inside the Nakamoto Vision w/ Tyler Evans of Nakamoto","duration":240},
                {"id":"qjjNgW4bZm8","title":"Michael Saylor - One Chair (Lil Bubble Bitcoin House Remix)","duration":155},
                {"id":"cPcS7mViJGE","title":"Bitwise CIO Explains Why Bitcoin Can Reach $1.3M Conservatively","duration":129},
                {"id":"5UssVPlRllQ","title":"Bitcoin Treasury Operations Roadmap | Strategy World 2026","duration":1212},
                {"id":"b4Y88YFlGpk","title":"Amplified Bitcoin and Digital Credit | The Hurdle Rate Ep. 35","duration":4808},
                {"id":"GrYXPqnyHdc","title":"“This Is the Product.” — Why Bitcoin Treasury Companies Actually Work","duration":220},
                {"id":"mBAJ-kZ1F2o","title":"The Fiat Deflation Paradox: Bitcoin & AI as the Ideal Combination for Investors  | BFC Show Ep 24","duration":2353},
                {"id":"AKqdUAhX3nA","title":"Bitcoin Is Hope ft. Michael Saylor","duration":175},
                {"id":"mpyijmce67E","title":"A Time To Build | The Hurdle Rate Ep.47","duration":2954},
                {"id":"f5mfgko8ELc","title":"The German Bitcoin Advantage: aifinyo CEO Garry Krugljakow | BFC Ep. 20","duration":3129},
                {"id":"fTMZxghP45c","title":"True North Orlando 2025 - Make Bitcoin Work for You | Solei","duration":358},
                {"id":"4Buu1h_89hY","title":"Michael Saylor: Bitcoin Is As Risky As Crossing a Street","duration":667},
                {"id":"xXI2OFzQinI","title":"True North Orlando 2025 - Volatility, Options and Full Gamma | Grain of Salt","duration":2211},
                {"id":"D1jpLbw3qQ8","title":"The Management of The Treasury | The Hurdle Rate Podcast | Ep. 54","duration":3132},
                {"id":"UkFp45QBL2Y","title":"Bitcoin as a Technological Invention, Not Just an Asset","duration":69},
                {"id":"XLvCCm3gUcw","title":"Bitcoin House in Vegas 🚀 #bitcoin #michaelsaylor","duration":24},
                {"id":"AOGcC7Zyjy0","title":"$MSTR & $STRK Preferred Stock thoughts 3/13/25","duration":2151},
                {"id":"ACmMK_ruxn4","title":"Have Space Suit, Will Travel | True North Podcast | Ep. 14","duration":7389},
                {"id":"DLgUQ1HGUXE","title":"Bitcoin Capital Markets: Evolving Instruments for Institutions","duration":1577},
                {"id":"rP2YjjuQn5A","title":"Liberation Day Chess | True North Podcast | Ep. 22","duration":7266},
                {"id":"wSwQxTq147Q","title":"Chill SaylorVibes - The Margin Call (Bitcoin Lo-fi)","duration":2966},
                {"id":"aixlSH2jo_4","title":"Calling The Shot | True North Podcast | Ep. 63","duration":6082},
                {"id":"tebx6tULPnM","title":"Digital Credit Boom Is Coming","duration":456},
                {"id":"B5if2hthPCs","title":"Michael Saylor - We Call Them Poor (Bitcoin House Remix) by Lil Bubble","duration":143},
                {"id":"IU1gzKQOYkA","title":"Mitigating Volatility: Risk-Adjusted Bitcoin Treasury Strategies with BitMEX CEO Stefan Lutz","duration":1452},
                {"id":"soNo3KkYGiU","title":"Michael Saylor On Why Microsoft Needs A Bitcoin Strategy | Bitcoin for Corporations 2025","duration":1148},
                {"id":"7KYylYAdBm8","title":"Software is going to zero #ai #mstr #bitcoin","duration":77},
                {"id":"9v3h7fPefHE","title":"Land will be very valuable in the future #realestate #bitcoin #mstr #ai","duration":65},
                {"id":"H99AdvqhUE0","title":"Michael Saylor: Why 21 Million Changes Everything","duration":764},
                {"id":"b-_UvOwM3LE","title":"Bitcoin Supercycle | The Hurdle Rate Ep. 29","duration":3174},
                {"id":"2RSKfdPcQ0g","title":"The Credit Industry Is Changing","duration":473},
                {"id":"LgLUHYESVsI","title":"The Trillion Dollar Idea ($STRC)","duration":456},
                {"id":"CodcEnDtXtI","title":"The Private Credit Bitcoin Cycle w/ Matt Dines | Bitcoin for Corporations Ep. 13","duration":3926},
                {"id":"gcV_7uil_0A","title":"Analyst Q&A: MSTR Q4 2025 Earnings Call","duration":2802},
                {"id":"x1S9bQoSDUg","title":"MSTR Can Buy More BTC Than Sellers Can Sell | True North Podcast | Ep. 62","duration":5825},
                {"id":"Yd1UFNvqwWQ","title":"How Bitcoin Changes Everything - The Saylor Series Episode 17","duration":5378},
                {"id":"d9OQ0UYSwLI","title":"Are Bitcoin Treasury Companies the Buyers of Last Resort? #bitcoinforcorporations #bitcoinstrategy","duration":115},
                {"id":"CdBOuVaqYvY","title":"Digital Capital Theory & Analysis w/ Allard Peng | BFC Show Ep. #22","duration":3959},
                {"id":"A7X5NXHVx1I","title":"How Family Offices & Institutions Are Positioning for Bitcoin | Bitcoin MENA 2025","duration":1623},
                {"id":"swoZxZyqpT8","title":"Michael Saylor On How Bitcoin Can Change Everything","duration":544},
                {"id":"G9SRFBXIOeE","title":"Strive Chiefs play Bitcoin Trivia! #bitcoin #bitcointreasury #bitcoinconference","duration":79},
                {"id":"Ib33Jy5cOP4","title":"Why Digital Credit is the Future of Global Finance #mstr #bitcoin #finance","duration":60},
                {"id":"cVFfZ6XA6vA","title":"What if Berkshire Hathaway dumped $373B into $STRC #bitcoin #digitalcredit #mstr","duration":68},
                {"id":"24c_s3QQsWc","title":"Bitcoin for Corporations Adoption Update w/ George Mekhail | Strategy World 2026","duration":782},
                {"id":"8Mhu6dxj7qk","title":"WE HAVE LASER EYES - Michael Saylor at BTCPrague 2023","duration":1990},
                {"id":"blkHhCz5_nY","title":"Tucker Carlson Interview with Michael Saylor about Bitcoin","duration":449},
                {"id":"GSko_cbikfk","title":"$MSTR True North - $STRK and $STRF 101 - Jeff Walton & Dan Hillery analysis","duration":2978},
                {"id":"GO2HffGUIN4","title":"BREAKING: Michael Saylor BREAKS Bitcoin Echo Chamber | EP 738","duration":4548},
                {"id":"EIH2k857E1Y","title":"STRC'ing The Limits | True North Podcast | Ep. 34","duration":7665},
                {"id":"0majxELKVEo","title":"Thanksgiving Week | True North Podcast | Ep. 8","duration":4231},
                {"id":"raxpm9Qu7rI","title":"Top 5 Moments w/ Michael Saylor, Jeff Booth, Cory Klippsten, Gigi, and more! (BTC120)","duration":5739},
                {"id":"tkqlubjSC9I","title":"Bitcoin, AI and The New QE | The Hurdle Rate Podcast | Ep. 53","duration":3615},
                {"id":"CAkVu_Dou4E","title":"BTC-Backed Financing For Corporations w/Jeff Walton, Hunter Albright, Wyatt O'Rourke & Russ Jacobsen","duration":1462},
                {"id":"Ux44HPsGcjY","title":"An Increasingly Digital World | The Hurdle Rate Podcast Ep.52","duration":3236},
                {"id":"GUrt5xVBWMk","title":"Michael Saylor Is A Bitcoin Genius - Pomp Podcast","duration":446},
                {"id":"YxlfOsFYAt4","title":"Bitcoin Treasury Companies Are the Bridge to $20 Trillion","duration":111},
                {"id":"8xVmeckJeXo","title":"Michael Saylor: Why Corporate Bitcoin Treasuries Empower Individual Holders","duration":100},
                {"id":"awA2vnfEB2Y","title":"Michael Saylor Explains High Powered Digital Money","duration":136},
                {"id":"JoTOaJWnZGQ","title":"MSTR & BTC Highs | True North Podcast | Ep. 4","duration":6526},
                {"id":"X7847QWh8nw","title":"Volatility is Vitality | True North Podcast | Ep. 5","duration":7119},
                {"id":"NTaBNGpfWaE","title":"Digital Credit is for Corporations | The Hurdle Rate Ep.49","duration":4190},
                {"id":"t8QSR0y9rls","title":"Strategy ($MSTR) vs. Bitcoin Supply: The Convergence","duration":197},
                {"id":"lCKY-vfV4Ck","title":"Week of Jan 17 Expiration | True North Podcast | Ep. 13","duration":5739},
                {"id":"NWgDhtCXNWA","title":"Analyst Q&A: MSTR Q3 2025 Earnings Call","duration":2179},
                {"id":"_27ZZJXv4gw","title":"Michael Saylor & Bill Miller - Bitcoin 2023 Conference Miami","duration":1732},
                {"id":"DHtXzMSBlHQ","title":"Power Of Collateral | True North Podcast | Ep. 30","duration":6866},
                {"id":"slOVowPqhAc","title":"New Market Structures using STRC & Bitcoin-Linked Products | Strategy World 2026","duration":1842},
                {"id":"_WZ_I_xWTXk","title":"Noise in the Market | The Hurdle Rate Ep. 23","duration":3416},
                {"id":"reVebuAf_Cs","title":"Michael Saylor: 21 Ways To Wealth - Bitcoin 2025 Keynote","duration":2212},
                {"id":"Z6QPPhdQCEM","title":"Why Strategy ($MSTR) stock did not fall back down to $20 #bitcoin #mstr #trading","duration":63},
                {"id":"tNJp3qBH1sw","title":"Bitcoin is Cybernetic Life - The Saylor Series Episode 13","duration":5548},
                {"id":"mC43pZkpTec","title":"Michael Saylor: Bitcoin, Inflation & Future of Money - Lex Fridman #276","duration":14215},
                {"id":"sVUzpZkz6t0","title":"The Societal Ripple Effects Of Corporate Bitcoin Adoption w/ Stafford Masie and Tracy Hoyos-Lopez","duration":1584},
                {"id":"y2mugodJ6gc","title":"What is Credit w/ special guest Adam Livingston | True North Podcast | Ep. 41","duration":8129},
                {"id":"CcztyNj5gps","title":"The Great Unraveling: Why Bonds Are Dead & Bitcoin Is Rising w/ Mark Moss","duration":916},
                {"id":"Tr2DBZIzrwQ","title":"Zoom Out - We're Early | The Hurdle Rate Ep. 26","duration":2582},
                {"id":"ChWZHwMkuwk","title":"Why AI Deflation Will Push Capital Into Bitcoin w/ Mason Foard of Méliuz | BFC Show Ep. 30","duration":1525},
                {"id":"hV_sgkHhApo","title":"SaylorNight - Relaxing Saylor Speaks on Bitcoin in the Night (1H)","duration":3684},
                {"id":"XU5u5gl6EIs","title":"Why Bitcoin is the Perfect Monetary System - Saylor Explains in Plain English","duration":712},
                {"id":"coHC_9ApBdg","title":"Michael Saylor: The Bitcoin Standard for Corporations","duration":7002},
                {"id":"dXix6OIU1hw","title":"Bitcoin is Digital Energy - Michael Saylor at the MIT Bitcoin Expo","duration":2830},
                {"id":"BcLBApRGdTo","title":"Some Pretty Good Money Printing | The Hurdle Rate Ep.50","duration":3635},
                {"id":"-7Sw3rbIxvI","title":"Pure Play vs Operating Cash Flows: What's the Optimal Bitcoin Treasury Strategy? #BTC #Markets","duration":92},
                {"id":"g_4JdozI-nc","title":"Lil Bubble - The Orange Pill (Official Visualizer) ft. Michael Saylor","duration":145},
                {"id":"-weaa5SrVEU","title":"Michael Saylor Needs Some Rest","duration":40},
                {"id":"aUEhwe2GvtY","title":"Bitcoin Economics and Evolution - The Saylor Series Episode 16","duration":5371},
                {"id":"wvhUQJtHamk","title":"Michael Saylor: Fix the Money, Fix the World!","duration":42},
                {"id":"lr4EjqoV0IE","title":"📺 Bitcoin Breaks $77k + Why #Bitcoin is Better | BFC Show @ Strategy World 2026","duration":26536},
                {"id":"DAXC9km8Wlk","title":"Bitcoin: Zero Percent Inflation - Saylor & Robert Breedlove","duration":8063},
                {"id":"MfCGltYG2EQ","title":"Michael Saylor on Why Traditional Investors Missed Out #bitcoin #shorts","duration":60},
                {"id":"ta56F9sjszk","title":"Bitcoin Is Digital Energy - Michael Saylor (Twitter Spaces Replay) Dec 28, 2021","duration":4777},
                {"id":"NT8KDT0Bjkk","title":"How ETFs Lead to More #Bitcoin w/ Matt Hougan of Bitwise","duration":412},
                {"id":"CG68sLoBaGE","title":"$MSTR True North - Episode 14 - Have Space Suit, Will Travel (1/22/25)","duration":7389},
                {"id":"3FrBqdCxZb4","title":"Media Roundtable | BFC Symposium, Amsterdam 2025","duration":2878},
                {"id":"CTA3PKB4PoI","title":"Bitcoin & Michael Saylor - A Masterclass in Economic Calculation (BTC005)","duration":8985},
                {"id":"HtGSq8QphY4","title":"Treasury Execution  Exchanges, OTC Desks and Custodians w/ Nick Coombs, Jonathan Ovadia & Allen Helm","duration":1299},
                {"id":"hZfoWMbNA30","title":"Michael Saylor: Why Bitcoin Can't Be Stopped","duration":48},
                {"id":"50VwsS0401Q","title":"True North Orlando 2025 - MSTR True North Live | Panel","duration":2813},
                {"id":"ao2RJhVpIW4","title":"Meet Them Where They're At | The Hurdle Rate Ep. 37","duration":3200},
                {"id":"WoS5GSjOP0Y","title":"True North Pulse - MSTR Q2 Earnings Explained: $11B net income & S&P 500 Hype | Jeff Walton","duration":819},
                {"id":"TPCHXc7qf2U","title":"The Reality of AI in 2026 #trading #mstr #bitcoin #ai","duration":105},
                {"id":"6fBhCOV1LH0","title":"Why Bitcoin Is Emerging as Prime Collateral w/ Hunter Albright of SALT Lending | BFC Show Ep. 29","duration":2677},
                {"id":"2u9jJPzd5Wo","title":"$MSTR’s $1.44B USD Reserve Just Proved The Business Model","duration":456},
                {"id":"KjFCRhhTO18","title":"A Digital Credit Treasury | The Hurdle Rate Podcast Ep.51","duration":3634},
                {"id":"FDr6VQq7FjQ","title":"Commercial Banks Are Moving Into Bitcoin Credit","duration":95},
                {"id":"mEHJYJg5mew","title":"Bitcoin’s 13% Yield: The Digital Credit Revolution w/ Strive's Matt Cole, Ben Werkman, & Jeff Walton","duration":518},
                {"id":"_N7fZFcPjcc","title":"\"2026 the year of digital credit\" | True North Podcast | Ep. 44","duration":4614},
                {"id":"LL2040c-DKU","title":"Equity Analysts Roundtable | Strategy World 2026","duration":1913},
                {"id":"aJPByFnBcNg","title":"BTC Opportunity Cost EVERYWHERE | True North Podcast | Ep. 27","duration":7598}
            ]
        },
        {
            "id": "future-predictions",
            "name": "Trading & Predictions",
            "emoji": "🔮",
            "desc": "Analysis, price models & market theories",
            "color": "#8b5cf6",
            "videos": [
                {"id":"WwpJY5rmP_A","title":"Bitcoin Price Distribution Animation (6/7/25 Update)","duration":55},
                {"id":"hzeAkfnuBKo","title":"PlanB: Bitcoin Will Hit $135k by Christmas! Stock-to-Flow Proof","duration":664},
                {"id":"iDgDl9jzEmk","title":"Bitcoin Price Prediction Models Explained","duration":1227},
                {"id":"sY3Mpl061Bg","title":"Private Q&A - Technical Analysis & Bitcoin - September 22nd - 24th, 2021","duration":2852},
                {"id":"jzY_SxnTLNA","title":"Bitcoin Is the Economic Singularity - Luke Mikic","duration":1168},
                {"id":"wjObfPHlPOk","title":"Understanding S2F Live Charts","duration":305},
                {"id":"93dyVDxP7K0","title":"Bitcoin Logarithmic Regression","duration":402},
                {"id":"0zUmhXgotMg","title":"HERE COMES VANGUARD: Why Bitcoin Hits New All-Time Highs in 2026 - The Bitcoin Layer","duration":2998},
                {"id":"vjwFusEnfiE","title":"The Power Law Lens on Bitcoin - Santostasi","duration":864},
                {"id":"BpKfLfGbf0Q","title":"Bitcoin Hyperbitcoinization: $1.5M by 2028?","duration":1562},
                {"id":"qX2fbQgxJig","title":"Why Bitcoin Could Reach $64M - Luke Mikic","duration":2893},
                {"id":"wksv5U_y4S4","title":"Unconfiscatable 2022 - Scammy Awards!!!","duration":4157},
                {"id":"3DijExIkark","title":"Bitcoin On-Chain Analysis: MVRV Z-Score Explained","duration":452},
                {"id":"44kS3j5L8AA","title":"Bitcoin Breakout or Fade: $119,000 Test & Market Behavior - The Bitcoin Layer","duration":2495},
                {"id":"rF4PfhMI084","title":"Bitcoin Unit of Account Animation (12/4/25 Update)","duration":46},
                {"id":"kCi1gYaIbBc","title":"Only 8 Years Until Bitcoin Hits $1 Million (The Math Proves It) - The Bitcoin Layer","duration":3043},
                {"id":"_dKDHAsNAV4","title":"JUST IN - 94% of the 21 million bitcoin has now been mined!","duration":99},
                {"id":"KR8EZo5IesE","title":"Tom Lee: Bitcoin to  Million Path","duration":495},
                {"id":"lHhbd9n6c-w","title":"jack mallers bitcoin price prediction","duration":45},
                {"id":"wOi9XqeJy2E","title":"Cathie Wood - New 2025 Prediction for Bitcoin & Ethereum","duration":1108},
                {"id":"C9KPRcmFJWI","title":"Bitcoin to $180K - Pomp Investments Prediction","duration":2361},
                {"id":"D8QuMzEnvvM","title":"Bitcoin Bear Market: SOPR Signals Losses as Liquidity Rolls Over - The Bitcoin Layer","duration":439},
                {"id":"6WdwTR_S2Ig","title":"Bitcoin Stock-To-Flow Model","duration":763},
                {"id":"2pDlaOGA2ac","title":"Bitcoin: Everything there is, divided by 21 million","duration":547},
                {"id":"iww09Eeql_o","title":"PlanB: Stock-to-Flow Model & Future Price Predictions","duration":602},
                {"id":"B2cevp_ppwU","title":"Bitcoin: Compound Annual Growth Rate (CAGR) Animation (10/12/25 Update)","duration":43},
                {"id":"HOOvX4evAVc","title":"Trading Panel from Future Blockchian Summit - Dubai","duration":1544},
                {"id":"W3SKpO0q9QI","title":"Roadmap To Crypto's $10 Trillion Market Cap - Ben Cowen","duration":4421},
                {"id":"1nsIy7PWXyY","title":"Bitcoin Price Analysis - Key Levels","duration":782},
                {"id":"uF6Wx4Hr6iU","title":"Tom Lee: Bullish Bitcoin Outlook & Corporate Treasuries - Coin Stories","duration":1907},
                {"id":"AQ3ZnmAD_HQ","title":"The REAL Reason Bitcoin Is Crashing - And What Comes Next - The Bitcoin Layer","duration":3354},
                {"id":"i-ekbxrESqU","title":"🔴 BTC: Elliott Wave Analysis Price Prediction | Bitcoin Forecast & Key Levels | Q&A","duration":11707},
                {"id":"SElcOQYfXok","title":"Bitcoin's BIG Price Prediction: $1.3M+ by 2035?","duration":69},
                {"id":"Sxv6wpU1380","title":"Is This Bitcoin Final Cycle? - Luke Mikic","duration":385},
                {"id":"Q9C4jbZoxIE","title":"BITCOIN PUMPING: Fed Cuts, Liquidity, & The Next Breakout - The Bitcoin Layer","duration":1315},
                {"id":"tPQs6eQ4zIU","title":"Stock to Flow - Prediciting Price?","duration":578},
                {"id":"DDk6-tdHeXQ","title":"Bitcoin Technical Analysis - Elliott Wave","duration":2078},
                {"id":"pkZqnM22l8Y","title":"Bitcoin May Have Already Bottomed During War Markets - The Bitcoin Layer","duration":416},
                {"id":"6ULmQlHKO7w","title":"Private Q&A - Technical Analysis & Bitcoin - September 27th, 2021","duration":1307},
                {"id":"GzZecXEUJTI","title":"Realistically Reaching  Million","duration":840},
                {"id":"jqSVCD6GC4E","title":"Private Q&A - Technical Analysis & Bitcoin - October 4th, 2021","duration":4261},
                {"id":"lN0vjNEIRJA","title":"Bitcoin Halving Progress Animation (9/6/25 Update)","duration":21},
                {"id":"wuGElsNvHZU","title":"Bitcoin Market Cap Distribution Animation (2/28/25 Update)","duration":54},
                {"id":"ym28FC_tbNM","title":"The Bitcoin Halving: Why use the bitwise shift operation?","duration":553},
                {"id":"6zFglF1aMKc","title":"Will 1 Bitcoin Be Generational Wealth? Whales Selling, Legacy Planning & Price Drivers","duration":3443},
                {"id":"XW1GUeBe0Rs","title":"The Bitcoin Power Law WiM509","duration":8577},
                {"id":"Cu4wL_pmPEk","title":"Advantages of Bitcoin's Transparency by Tone Vays","duration":48},
                {"id":"dy2ZTOq22bQ","title":"Cathie Wood Increased Her Bitcoin Price Prediction for 2025","duration":511},
                {"id":"hrjBK6AXAMk","title":"Take The Bitcoin Orange Pill - How To Guide","duration":597},
                {"id":"_rMwlS1aHFs","title":"The Physics of Bitcoins 10M Future","duration":4295},
                {"id":"_FaM-IIt1bg","title":"Bitcoin Enters Bear Market Behavior, What On-Chain Metrics Are Showing - The Bitcoin Layer","duration":2727},
                {"id":"Z51vRLKvco4","title":"Retiring on 0.1 Bitcoin - Luke Mikic","duration":3350},
                {"id":"yG3QiyCLoDA","title":"Bitcoin Halving Progress Animation (9/12/24 Update)","duration":99},
                {"id":"JLuTDwclOP0","title":"The Resilience of Stock-to-Flow with PlanB - Bitcoin Standard Podcast","duration":6906},
                {"id":"9c33ShgXBzg","title":"Big Money Wants $1 Million Bitcoin - The Bitcoin Layer","duration":122},
                {"id":"l95Uf91mOo0","title":"Surviving Sun's Micronova & Pole Flip by Ben Davidson at Observer Ranch","duration":3309},
                {"id":"ppQfJMY9yYA","title":"BITCOIN CRASHES THROUGH $100,000 While Macro Volatility Surges & Trend Structure Weakens - The Bitcoin Layer","duration":928},
                {"id":"nlvx2-3LUhM","title":"Bitcoin Power Law Explained | SLP624","duration":6396},
                {"id":"hIy9mb0-uSs","title":"Bitcoin Price Levels to Watch: Short-Term Holders in Control - The Bitcoin Layer","duration":2017},
                {"id":"EK1QkfuDUFg","title":"$50 Weekly DCA Starting in 2021: Bitcoin vs Gold (12/23/25 Update)","duration":36},
                {"id":"lyTHPcHDOk8","title":"Rational Root: Bitcoin Will Hit $600k then $6 Million","duration":1268},
                {"id":"yhcbMUh3YTo","title":"The Generational Bitcoin Price Run Begins","duration":749},
                {"id":"bw5Gepxo2Ps","title":"Bitcoin Network Effects Model - 10x Users = 100x Price","duration":1108},
                {"id":"LU5RqsGwvBg","title":"Bitcoins Path to M: Schwab","duration":401},
                {"id":"9gyreHKE5XY","title":"BITCOIN'S 4-YEAR CYCLE NEVER EXISTED | Next Bubble 2027 w/ Stephen Perrenod - The Bitcoin Layer","duration":3441},
                {"id":"yM06uqse6Ks","title":"The Science Behind M Bitcoin","duration":5433},
                {"id":"LkmVUMRh9vo","title":"Bitcoin: Where In The Cycle Are We? - Benjamin Cowen","duration":547},
                {"id":"CJiQBVnbdpI","title":"jack mallers bitcoin price prediction","duration":45},
                {"id":"IWUEPFAHksc","title":"Bitcoin Bull Market Support Band - Benjamin Cowen","duration":466},
                {"id":"8jUsgjRhxlI","title":"JUST IN - 95% of the 21 million bitcoin has now been mined!","duration":108},
                {"id":"bPYl1-KBE50","title":"The Ultimate Orange Pill - Bitcoin & Risk","duration":1784},
                {"id":"MzxIZ4_f3e0","title":"JUST IN - 94.5% of the 21 million bitcoin has now been mined!","duration":105},
                {"id":"PthPuVb1s9k","title":"$50 Weekly DCA: NASDAQ vs Bitcoin (1/23/25 Update)","duration":47}
            ]
        },
        {
            "id": "tutorials",
            "name": "Tutorials, Builders & DIY",
            "emoji": "📚",
            "desc": "Learn Bitcoin step by step — tutorials, builder stories & DIY hardware projects",
            "color": "#f7931a",
            "videos": [
                {"id":"ZcsLaDoVPNU","title":"CH2: Post-Show Recap w/ Sidd, Writer and Rider - Bitcoin Tour of America","duration":3260},
                {"id":"9SUdFCRf-dc","title":"EP12: Building Community with Bitcoin w/ Yusuf Nessary - Built With Bitcoin Foundation","duration":2856},
                {"id":"7IeGjkAvvyI","title":"Every Investor Is About To Get Blindsided By Bitcoin (James Check)","duration":1591},
                {"id":"kGa1ji7sxtA","title":"Oil Trade Getting Worse – Warren Buffet Sends Warning Every Bitcoiner Must Hear","duration":1858},
                {"id":"ri38Nc-Rrzg","title":"How To Set Up Your OWN Bitcoin Node FOR FREE!!! + SOLO Mine To It","duration":892},
                {"id":"AFoQ6Ymj8-w","title":"EP22: Risk Management through Miniscript w/ Rob Hamilton, Co-Founder & CEO - AnchorWatch","duration":2451},
                {"id":"rt5gqE0DsSk","title":"The Last Oil Crisis — Gold Did Something NOBODY Expected | Prof. St Onge","duration":115},
                {"id":"bvUxEFGfVi8","title":"EP20: Bitcoin Changes Everything w/ P, Programming Director - Swan Bitcoin","duration":3258},
                {"id":"Xjrq1f3pNMY","title":"EP5: Bitcoin Across America w/ Sidd, Writer and Rider - Bitcoin Tour of America","duration":3693},
                {"id":"GR-E0aaFf0c","title":"Bitcoin Explained for Complete Beginners","duration":2759},
                {"id":"hluk1tQun78","title":"Understanding The Fed's Balance Sheet with Andy Constan - The Bitcoin Layer","duration":3841},
                {"id":"mibKrTvtlyQ","title":"Misty Breez Bitcoin Wallet Setup - BTC Sessions","duration":1822},
                {"id":"mOCUqbFQ57o","title":"Bitcoin Daily DCA & HODL Animation Walkthrough","duration":695},
                {"id":"H47wmnfASds","title":"EP4: Bitcoin is Hard. Bitcoin is Easy. w/ Justine Harper, VP, BD - Unchained Capital","duration":2762},
                {"id":"2Z1BzwxdP4I","title":"ALBY HUB - Run A Bitcoin Lightning Node TUTORIAL","duration":4436},
                {"id":"I3Qld_HXQuM","title":"Nostrability Workshop - BBB 2024","duration":2961},
                {"id":"cRRB_WzZpTM","title":"BIP85: Segregated Bitcoin Accounts From One Seed (Uncle Jim Mode)","duration":3915},
                {"id":"JdatHrGUHO0","title":"EP27: Devs Who Can Hack It w/ Alekos Filini & Daniela Brozzoni, Developers - BDK, Founders - hack.bs","duration":3125},
                {"id":"4PvA7oYDXu8","title":"Crypto Wallets Explained (Beginners Guide 2025)","duration":1090},
                {"id":"MlHa66QdLH4","title":"Bitcoin Difficulty Epoch 416 Walkthrough","duration":147},
                {"id":"IxgNp2h5j8w","title":"How To Buy, Use and Secure Bitcoin - BTC Sessions","duration":1632},
                {"id":"XwMiBkh_svE","title":"Tutorial - Sending and Receiving Multi-Signature Wallet","duration":1301},
                {"id":"JbxmMy0AprA","title":"EP14: Bitcoin and the (R)Evolution of Media w/ Nico, Host - SimplyBitcoin","duration":3185},
                {"id":"nZOlb69FF6k","title":"AI Will COLLAPSE the Financial System - Here's How to Survive (and Thrive)","duration":581},
                {"id":"6b0xTB2sE8E","title":"Bull Bitcoin Wallet Full Tutorial - BTC Sessions","duration":5663},
                {"id":"ltZEZM7OEu0","title":"EP11: Bringing Bitcoin to Local Business w/ Michael Atwood, Founder - Oshi","duration":3270},
                {"id":"3Grj3Datdfw","title":"Game-Changing Bitcoin Wallet (Cove) - BTC Sessions","duration":1893},
                {"id":"5GCBWyHkklc","title":"EP2: Bringing Bitcoin to the World w/ Ben Price, Co-Founder & CEO The Bitcoin Company","duration":3272},
                {"id":"tuUO-Q4_b5c","title":"How to Buy Bitcoins in 2024 (4 Methods Reviewed)","duration":590},
                {"id":"cBKrrKzZSd4","title":"EP18: Stay Humble, Stack Stats w/ Matt Odell, Bitcoiner","duration":3521},
                {"id":"UYUfXWlAleA","title":"01 - myNode series - Why run a Bitcoin node","duration":594},
                {"id":"SPP81mGYeZw","title":"If I Wanted to Secure My Crypto in 2026, I’d Do THIS","duration":923},
                {"id":"EARJ_b1C1HU","title":"$25 USB Nerd Miner Setup | Bitcoin Merch Guide","duration":269},
                {"id":"iU2I1TchOB8","title":"Bitcoin UTXO Count Back Below 170m","duration":41},
                {"id":"lVhdpmhYxbI","title":"EP28: Facilitating FOSS Development w/ Haley Berkoe, Program Manager - Spiral","duration":3108},
                {"id":"4YoPN1Oa8Ys","title":"WSB Update & BIP-110 Signaling Dashboard Update","duration":297},
                {"id":"yJpvfRl03Tw","title":"How To Use Sparrow Bitcoin Wallet - In Depth Tutorial (BTC Sessions)","duration":6803},
                {"id":"pDSQVX8oQSA","title":"How to Send Crypto TO Cold Wallets (BEGINNER'S GUIDE)","duration":575},
                {"id":"Y3iAwLG6NlA","title":"Bitcoin Wallets That Change Everything in 2026 - BTC Sessions","duration":1907},
                {"id":"-oujfwYj-zc","title":"Bitcoin Node Count Dashboard — Walkthrough","duration":352},
                {"id":"-wB6Si4jZYc","title":"How the Bitcoin Halving Works (Code Walkthrough)","duration":737},
                {"id":"qLHewsI_iqA","title":"\\\"If It Stays Closed, They Know It's Over\\\" — Trump Can't Execute Global Reset | Simon Dixon & Lepard","duration":1193},
                {"id":"9FE4mTr_6EI","title":"How to Set Up a Bitcoin Node (MyNode)","duration":1062},
                {"id":"BXhJ18kcZEo","title":"The COOLEST Home BITCOIN Miner Right Now!","duration":928},
                {"id":"VpDhVS79eG0","title":"The Quantum 'Fix' Is A Backdoor To Bitcoin — And BlackRock Knows It","duration":1250},
                {"id":"4Lsr7lsy6Tk","title":"How to Set Up a Bitcoin Node at Home","duration":79},
                {"id":"XFoJUhxBAPQ","title":"EP1: Meet Me in the Mempool w/ @wiz, Co-Founder & CEO Mempool.space","duration":2941},
                {"id":"TTS0Ufkv4xc","title":"EP9: Designing for Bitcoin w/ Stephen DeLorme, Designer - Bitcoin Design Community","duration":3158},
                {"id":"iTno3A4jE0Y","title":"Bitcoin & Liquidity Academy 1: Understanding Balance Sheets, Capital, and Treasuries - The Bitcoin Layer","duration":1548},
                {"id":"3xw-lMBbMds","title":"Why & How to Run a Bitcoin/Lightning Node w/ MyNode","duration":1198},
                {"id":"OZK5hdKfb18","title":"Bitcoin Security Best Practices","duration":2955},
                {"id":"9JKpA7gqbW0","title":"How To Run Your Own Bitcoin Node (And Fight Bitcoin Spam)","duration":816},
                {"id":"XvZ2GUg-KMk","title":"Walker America Delves Into Bitcoin’s Secret Trojan Horse","duration":101},
                {"id":"95FonGULBtc","title":"EP6: Bitcoin, Beef, and Building Locally w/ Texas Slim, Founder - The Beef Initiative","duration":3002},
                {"id":"9ExAt9EUCNc","title":"How to be remembered forever","duration":463},
                {"id":"J7fz0zOg72o","title":"The Secret War Between Trump and China Nobody Is Talking About","duration":1239},
                {"id":"_EdlTGOD9jg","title":"Francis Pouliot Drops a TRUTHBOMB About Bitcoin","duration":104},
                {"id":"B4-fIKroG_M","title":"How to make a 3$ usb drive into a secure crypto wallet","duration":593},
                {"id":"4cRCkhqvUYc","title":"{Full Tutorial} Start and Manage a Bitcoin Lightning Node","duration":6048},
                {"id":"pgYBgXFqIjw","title":"EP13: The Beefsteak w/ awayslice, the Beefsteak Guy","duration":2860},
                {"id":"dy3vzz9pa3g","title":"SegWit and BIP-110 Signaling Dashboard — Walkthrough","duration":469},
                {"id":"QTmI7PXNZhI","title":"CH1: Post-Show Recap w/ Justine Harper, VP, BD - Unchained Capital","duration":2561},
                {"id":"c8ytiynbnpk","title":"Your First Bitcoin Wallet - BTC Sessions","duration":2555},
                {"id":"jMf6Gqo3J4I","title":"WHAT IS A BITCOIN NODE? & 5 Reasons To Run A Bitcoin Full Node!","duration":338},
                {"id":"RhPf4toA79A","title":"HARDWARE-WALLET ERKLÄRT! 🔐 SO verwahrst DU BITCOIN SICHER!","duration":773},
                {"id":"nCaGVYx3rgo","title":"How to get your Amazon ESP32 2432S028 to work as a NerdMiner","duration":1144},
                {"id":"_ZnTkrCjavs","title":"How To Play the Bitcoin Lottery (It’s Easier Than You Think)","duration":597},
                {"id":"qAKdgQiPTTQ","title":"Lawrence Lepard Warns \\\"Most People Will Miss This Bitcoin Opportunity - DON'T Let It Be You\\\"","duration":90},
                {"id":"zEFEoBZfpb4","title":"How to Set Up Your Nerdminer v2 / NMminer | Full Configuration Guide","duration":253},
                {"id":"vyJ4EvjXDcg","title":"EP21: Building (Multiple) Bitcoin Businesses w/ Marty Bent, Founder - TFTC","duration":2891},
                {"id":"GbEJ0neZkxQ","title":"WSB Update & Bitcoin Dominance Dashboard — Walkthrough","duration":469},
                {"id":"_Qxm70pFM4E","title":"Bitcoin Quantum Exposure Dashboard — Walkthrough","duration":992},
                {"id":"wWnUvCNeYEo","title":"Crypto Wallets Explained! (Beginners' Guide!) 📲 🔑 (2025 Edition!) ⭐⭐⭐⭐⭐ Ultimate Step-by-Step! 😎","duration":1199},
                {"id":"rKjce1jCxSM","title":"Bitcoin Beginner Mistakes to Avoid","duration":1812},
                {"id":"xAwbhE8EXAw","title":"EP7: What to Expect at TABConf w/ Co-Organizer Michael Tidwell","duration":3616},
                {"id":"peCazF38jBQ","title":"I Mined Bitcoin for 24 Hours on a Raspberry Pi","duration":673},
                {"id":"4cXIUrCQExg","title":"How to mine BITCOIN with your PC or Laptop!","duration":667},
                {"id":"krrUQGMKhPo","title":"Bitcoin UTXO Consolidation Tutorial","duration":879},
                {"id":"_WS4TiOvLFM","title":"Gold Nugget NerdMiner 2 Lottery Miner (Bitcoin Merch) - Setup and Reset Guide","duration":336},
                {"id":"m78wkn9Drdk","title":"Why Everyone's Wrong About the Bitcoin Bottom | James Check","duration":3492},
                {"id":"k6QuA2KWQvY","title":"HOW TO MAKE YOUR OWN NERD MINER V2 #BITCOIN #crypto #btc #cryptocurrencymining #crypto","duration":479},
                {"id":"aAf0rilUfe4","title":"“There’s 0% Chance My Bitcoin Can Be Stolen” — Terrence Michael","duration":99},
                {"id":"Tr1bntrBOY0","title":"Bitcoin & Liquidity Academy 2: How $37 Trillion in US Debt Shapes Global Markets - The Bitcoin Layer","duration":1549},
                {"id":"N6ax-ZmTsDc","title":"EP23: Tangible Tools for Digital Money w/ NVK, Co-Founder & CEO - Coinkite","duration":2882},
                {"id":"qeBpYPcx1wg","title":"Build & Run Your Own Bitcoin Node On A Raspberry Pi","duration":516},
                {"id":"Gc2en3nHxA4","title":"What is Bitcoin - Simply Explained","duration":97},
                {"id":"W6uYVBAuYq0","title":"Do Not Download This Fake Bitcoin App ($Millions Already Stolen)","duration":1243},
                {"id":"TCU-soMs1wY","title":"Trace Mayer at the Bitcoin/Cryptocurrency Workshop on 3/15/15","duration":3262},
                {"id":"P-5aFxDNqFs","title":"EP26: Accounting For Bitcoin w/ Joe Wood, Founder - Satoshi Pacioli Accounting Services","duration":3247},
                {"id":"ZWUGS92Dv8U","title":"The LAST Phase of Building the New World Order Is Here | Simon Dixon","duration":4451},
                {"id":"bsAznpEupIg","title":"Easiest Bitcoin Wallet Setup (Aqua) - BTC Sessions","duration":2132},
                {"id":"gLCyRFZOdGQ","title":"How to Run a Bitcoin Lightning Node","duration":2813},
                {"id":"1gH33qosYXU","title":"EP16: Category Creation: Proof-of-Funds w/ Sam Abbassi, CEO - Hoseki","duration":2918},
                {"id":"LsR11IQESCs","title":"$40k or $80k — Two of The Smartest People In Bitcoin Just Told Us Which","duration":486},
                {"id":"v06TBoxUsAs","title":"Setup tutorial - Specter Shield (Lite) with BlueWallet","duration":1349},
                {"id":"9uodS6FBsdw","title":"How to Choose the BEST Cold Wallet for 2026","duration":653},
                {"id":"KT8zri-XN58","title":"EP24: Mastering Miner Management w/ Dan Lawrence, Co-Founder & CEO - OBM, Inc./Foreman","duration":3213},
                {"id":"z22HnACwl7k","title":"The Banks Know Something Terrifying About AI — And They're Not Telling You","duration":1635},
                {"id":"6rpTjEpvUtc","title":"i automated my home lab (and CLOUD) with Ansible","duration":764},
                {"id":"01VQpFPCMek","title":"Nerd Miner 2 How to set up on your home or office Wi-Fi from start to hashing coins","duration":1175},
                {"id":"sO3_c3dfTeU","title":"Easily MINE BITCOIN With The Avalon Nano 3S (You could win $300,000!) Unboxing and Tutorial","duration":3691},
                {"id":"lhzooru_B-o","title":"How to Set Up a Bitcoin Node for just $300 | Step-by-Step Guide","duration":2148},
                {"id":"gH0DkA_VGQg","title":"EP10: Learning (and Earning) with Lightning w/ Nate, Education and Support - Voltage","duration":2875},
                {"id":"1LhcDJ8bgQU","title":"Bitcoin RBF (Replace By Fee) Tutorial","duration":1077},
                {"id":"_j4aSynAiX0","title":"How Multi-Sig Makes All Bitcoiners Safer","duration":702},
                {"id":"O1KaAboPX44","title":"How To Buy Bitcoin For Beginners - Step by Step","duration":586},
                {"id":"kgaUK47CEPY","title":"EP25: Making Bitcoin Accessible w/ Conor Okus, Product Manager - Spiral","duration":3270},
                {"id":"5_p9tGq43Xw","title":"Making $40 A DAY With A Cellphone Crypto Home Miner","duration":851},
                {"id":"281Gal2xztI","title":"Bitcoin Quantum Exposure Dashboard (FULL) — Download & Walkthrough","duration":1419},
                {"id":"IyW9Dn_--ME","title":"The BEST Home Bitcoin Miner in 2025","duration":697},
                {"id":"FwjX6ija9iM","title":"Simple Bitcoin Wallet Tutorial - BTC, Lightning and Hardware","duration":1394},
                {"id":"niXxUrpkoRA","title":"How To Create Infinite Bitcoin Wallets (Passphrase)","duration":714},
                {"id":"X0aaySypick","title":"Bitcoin & Liquidity Academy 3: Primary Dealers, U.S. Treasuries & the Fed - The Bitcoin Layer","duration":1318},
                {"id":"FEBRIQeiqfg","title":"How To Make A USB #Crypto Wallet | OFFLINE STORAGE | DIY/Tutorial | 2022","duration":678},
                {"id":"dCAr2urEe1o","title":"ENTROPIA - Generate Permissionless Bitcoin Wallets","duration":2461},
                {"id":"pcbYq2LCWwk","title":"LIQUIDITY Explained SIMPLY: How It Really Moves BITCOIN - The Bitcoin Layer","duration":1007},
                {"id":"P0yBusy5_Zc","title":"HOW TO BUILD A BITCOIN NODE","duration":287},
                {"id":"ZpX1wNchiD4","title":"EP17: Bitcoin Just Works w/ Harry Sudock, VP, Strategy - Griid","duration":3087},
                {"id":"l0dzOwyPqFI","title":"How to make passive income running blockchain nodes","duration":576},
                {"id":"LxTkLwpV1Po","title":"Permissionless Bitcoin Wallets - They Cannot Be Stopped!","duration":3492},
                {"id":"Ld2s9MyMKMU","title":"Fastest way to build a Bitcoin Node in 2024","duration":532}
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
    // Track views by comparing against our OWN last-joined marker — NOT _currentStation,
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
            // Pause heartbeat but keep current station — if they come back in <65s we still count
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
    }).catch(function() { /* race with another client — they got the +1 */ });
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
    }).catch(function() { /* another client raised it first — fine */ });
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

// ——— BlockSurf ———
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
    _blockSurfFetchTip().then(_blockSurfHandleHeight).catch(function() { /* ignore transient fetch errors */ });
}

// WebSocket handle for real-time block push from mempool.space. When connected,
// we hear about new blocks within ~1–2 seconds of discovery — orders of magnitude
// faster than polling. We keep a short interval as a fallback in case the socket
// drops.
window._blockSurfWS = null;
window._blockSurfWSRetry = 0;

function _blockSurfHandleHeight(h) {
    if (!h || isNaN(h)) return;
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
            showToast('🏄 New block #' + h + ' — surfing to ' + next.emoji + ' ' + next.name);
        }
        if (typeof window.switchStation === 'function') window.switchStation(next.id);
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
    } catch(e) { /* WebSocket not available — fall back to polling only */ }
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
        if (typeof showToast === 'function') showToast('🏄 BlockSurf ON — I’ll hop channels on every new block.');
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
        '<div style="color:#ddd;line-height:1.45;">Every time a new Bitcoin block is mined (~10 min), the channel automatically changes to a random channel. Sit back and let the chain change the channel.</div>';
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
        'Anita Posch', 'Ross Ulbricht', 'Erik Voorhees', 'Caitlin Long',
        // Self-custody hardware & wallets
        'NVK / Coinkite', 'Coldcard', 'Sparrow Wallet', 'SeedSigner',
        'Foundation Passport', 'Specter', 'Nunchuk', 'BTCPay Server',
        'Wasabi', 'Samourai', 'BTC Sessions', 'Wicked Smart Bitcoin'
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
            /* On mobile the app has a position:fixed .mobile-bar at the top.
               The TCTV sticky header needs to sit BELOW it, not underneath. */
            #tctv-sticky-header {
                top: calc(58px + env(safe-area-inset-top, 0px)) !important;
                display: flex !important;
                flex-direction: column !important;
            }
            /* Order children so the horizontal remote sits directly below the
               title row (TIMECHAIN TV + BlockSurf + live count), then the video,
               then Now Playing and progress. The sticky header's first child is
               the title row — pin it to order:-2, remote to order:-1, everything
               else defaults to 0 in source order. */
            #tctv-sticky-header > div:first-child { order: -2 !important; }
            #tctv-remote { order: -1 !important; margin: 0 !important; border-bottom: 1px solid #222 !important; background: #0a0a0a !important; }
            #tctv-video-row { padding: 0 !important; gap: 0 !important; }
            #tctv-video-container { border-radius: 0 !important; }
        }
        @media (max-width: 480px) {
            #tctv-sticky-header {
                top: calc(54px + env(safe-area-inset-top, 0px)) !important;
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
            /* Show ~30px of the remote at the right edge (was 18px) so the
               pull-tab is clearly visible. */
            transform: translateX(130px);
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
           The collapsed remote is translated 142px to the right (so only 18px pokes
           into the viewport from the right edge). We anchor the tap zone to the
           right side of the remote and make it wide enough to cover both the
           visible strip AND ~30px into the viewport for comfortable thumb tapping. */
        .tctv-remote-tap-zone {
            display: none;
            position: absolute;
            top: 0;
            bottom: 0;
            /* Anchor to the right edge of the collapsed (translated) remote.
               Width = the 18px visible strip + ~32px inward = 50px reachable. */
            right: 0;
            width: 50px;
            z-index: 5;
            cursor: pointer;
            pointer-events: auto;
            background: linear-gradient(270deg, rgba(247,147,26,0.25) 0%, rgba(247,147,26,0.05) 60%, transparent 100%);
            border-left: 2px solid rgba(247,147,26,0.4);
            box-shadow: -2px 0 12px rgba(247,147,26,0.15);
        }
        #tctv-remote-inline.collapsed .tctv-remote-tap-zone {
            display: block;
        }
        /* Little visual pull-tab arrow inside the tap zone to hint interactivity */
        #tctv-remote-inline.collapsed .tctv-remote-tap-zone::before {
            content: '◀';
            position: absolute;
            right: 6px;
            top: 50%;
            transform: translateY(-50%);
            color: #f7931a;
            font-size: 14px;
            font-weight: 900;
            opacity: 0.9;
            text-shadow: 0 0 4px rgba(0,0,0,0.8);
            animation: tctvRemotePulse 2s ease-in-out infinite;
        }
        @keyframes tctvRemotePulse {
            0%, 100% { transform: translateY(-50%) translateX(0); opacity: 0.9; }
            50% { transform: translateY(-50%) translateX(-4px); opacity: 1; }
        }
        /* Keep the drag handle tappable too — redundant safety net */
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
        /* Hide the floating sprite Nacho toggle whenever TCTV is the active page. */
        body.tctv-active #nacho-toggle,
        body.tctv-active #nacho-container {
            display: none !important;
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
        /* Mobile — stacked two-row remote bar below video (overrides the legacy fixed vertical style) */
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
        /* Mobile — aggressive resizing for small screens. */
        @media (max-width: 767px) {
            #tctv-remote { padding: 4px 6px !important; gap: 4px !important; }
            .remote-btn { width: 32px !important; height: 32px !important; font-size: 0.8rem !important; }

            /* Split (Phil spec 2026-04-20):
               Remote bar moved ABOVE the video into the previously dead black
               space, so we can let the video shrink to a tighter aspect-ratio
               box and hand more vertical space back to the channel list.
               Channel list (EPG) target ~ 40vh on mobile.
               Video container target ~ 45% of usable height (was 55%). */
            #tctv-video-container {
                width: 100% !important;
                max-width: 100% !important;
                height: calc((100vh - 170px) * 0.48) !important;
                max-height: calc((100vh - 170px) * 0.48) !important;
                min-height: 180px !important;
                margin: 0 !important;
                box-shadow: none !important;
            }
            #tctv-player { width: 100% !important; max-height: calc((100vh - 170px) * 0.48) !important; height: 100% !important; }

            /* EPG (channel list): expanded to ~40vh of viewport now that the remote
               sits above the video. Always scrollable. */
            #tctv-epg-wrapper {
                height: 40vh !important;
                max-height: 40vh !important;
                min-height: 200px !important;
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

    var _bsOn = false;
    try { _bsOn = localStorage.getItem('tctv_blocksurf') === '1'; } catch(e) {}
    html += '<div id="tctv-sticky-header" style="position:sticky;top:0;z-index:200000;background:#0a0a0a;width:100%;"> ' +
            '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#111;border-bottom:1px solid rgba(247,147,26,0.3);width:100%;box-sizing:border-box;"><div onclick="goHome()" style="cursor:pointer;display:flex;align-items:center;gap:8px;"><span style="color:var(--text-muted);font-size:0.8rem;">←</span><span style="color:#f7931a;font-weight:900;font-size:1rem;letter-spacing:2px;">TIMECHAIN TV</span></div><div style="display:flex;align-items:center;gap:6px;">' +
            // BlockSurf toggle — stuck to the left of viewers+LIVE, out of the way of everything else.
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
            // Full-height invisible tap zone on the left edge — easy to tap on tablet/touch
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
    html += '<div style="padding:10px 16px;background:#161616;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center;"><div style="flex:1;min-width:0;"><div style="font-size:0.65rem;color:#f7931a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">NOW PLAYING <span id="tctv-now-ch" style="color:#aaa;"></span></div><div id="tctv-now-playing" style="font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#ddd;">Loading...</div></div>' +
            '<div style="display:flex;align-items:center;gap:8px;"><div id="tctv-time-left" style="font-size:0.75rem;color:#888;font-weight:600;flex-shrink:0;font-variant-numeric:tabular-nums;"></div></div></div>';
    html += '<div style="height:3px;background:#222;"><div id="tctv-progress" style="height:100%;background:#f7931a;width:0%;transition:width 1s linear;"></div></div>';

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
    // so DOM order doesn't matter — he floats at bottom-left as before.
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
    // Legal disclaimer — very dim, bottom of TCTV, applies to all channel content
    html += '<div style="max-width:720px;margin:18px auto 8px;padding:14px 22px;font-size:0.62rem;line-height:1.55;color:#555;text-align:center;letter-spacing:0.2px;opacity:0.65;">' +
        '<div style="font-weight:700;font-size:0.58rem;color:#666;margin-bottom:6px;text-transform:uppercase;letter-spacing:1.2px;">Disclaimer</div>' +
        'Timechain TV aggregates publicly embeddable videos from third-party YouTube channels. Bitcoin Education Archive does not own, host, endorse, or verify any of the content shown. Views and opinions expressed belong solely to the original creators. ' +
        'Nothing on Timechain TV constitutes financial, investment, legal, or tax advice. Bitcoin is volatile and you can lose money — do your own research and consult licensed professionals before making any financial decisions. ' +
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
        "Permissionless = priceless. 🔓",
        "Not your keys, not your coins. Still true. 🔐",
        "Hardware wallets: training wheels for sovereignty. 🛠️",
        "Self-custody is freedom in practice, not in theory. 🧭"
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
    // Clean up presence tracking — stops heartbeat and deletes the presence doc
    try { _leavePresence(); } catch(e) {}
    var iframe = document.getElementById('tctv-player');
    if (iframe) iframe.src = '';
    _currentVideoId = null;
    _np = { stationId: null, videoId: null, videoTitle: null };
    window._tctvActive = false;
    document.body.classList.remove('tctv-active');
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
