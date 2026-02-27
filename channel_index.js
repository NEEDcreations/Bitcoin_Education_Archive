const fs = require('fs');

const channels = {
  "0_mining__hashing": {
    "cat": "Additional Info",
    "desc": "Deep dive into Bitcoin mining and hashing — how SHA-256 works at the bit level.",
    "file": "data/H_0_mining__hashing.json",
    "title": "0⃣Mining (Hashing)"
  },
  "100_sats": {
    "cat": "Additional Info",
    "desc": "What can you do with just 100 satoshis? More than you think.",
    "file": "data/H_100_sats.json",
    "title": "💯100 sats"
  },
  "1_first_principles": {
    "cat": "Additional Info",
    "desc": "First principles thinking applied to Bitcoin — reasoning from fundamentals, not analogies.",
    "file": "data/H_1_first_principles.json",
    "title": "1⃣First Principles"
  },
  "2__solved_technical_problems": {
    "cat": "Additional Info",
    "desc": "The technical problems Bitcoin solved — digital scarcity, double-spending, and Byzantine fault tolerance.",
    "file": "data/H_2__solved_technical_problems.json",
    "title": "2⃣ Solved Technical Problems"
  },
  "analogies": {
    "cat": "Additional Info",
    "desc": "The best analogies for explaining Bitcoin to anyone — from trees to brains to hearts.",
    "file": "data/H_analogies.json",
    "title": "🔋Analogies"
  },
  "apps-tools": {
    "cat": "Resources",
    "desc": "Bitcoin apps, tools, services, and platforms — everything you need to use Bitcoin daily.",
    "file": "data/R_apps-tools.json",
    "title": "🍎apps-tools-services-models"
  },
  "art-inspiration": {
    "cat": "Resources",
    "desc": "Bitcoin art, inspiration, and motivational content from the community.",
    "file": "data/R_art-inspiration.json",
    "title": "🤩art-inspiration-motivation"
  },
  "articles-threads": {
    "cat": "Resources",
    "desc": "The best Bitcoin articles and Twitter threads — curated deep dives into every aspect of Bitcoin.",
    "file": "data/R_articles-threads.json",
    "title": "📃articles-threads"
  },
  "austrian_school_of_economics": {
    "cat": "Additional Info",
    "desc": "Austrian Economics and Bitcoin: Mises, Hayek, sound money theory, and the intellectual foundation.",
    "file": "data/H_austrian_school_of_economics.json",
    "title": "🇦🇹Austrian School of Economics"
  },
  "bip119": {
    "cat": "Additional Info",
    "desc": "BIP-119 (CheckTemplateVerify) — what it is, why it's controversial, and the community debate.",
    "file": "data/H_bip119.json",
    "title": "🚧BIP119"
  },
  "bitcoin_exam": {
    "cat": "Additional Info",
    "desc": "Test questions for a Bitcoin exam — study material and self-assessment.",
    "file": "data/H_bitcoin_exam.json",
    "title": "🎓Bitcoin Exam"
  },
  "bitcoin_vs_real_estate": {
    "cat": "Additional Info",
    "desc": "Bitcoin vs. real estate as an investment — comparing the two hardest assets.",
    "file": "data/H_bitcoin_vs_real_estate.json",
    "title": "Bitcoin vs Real Estate"
  },
  "bitvm": {
    "cat": "Experienced Topics",
    "desc": "BitVM: computation on Bitcoin without changing the protocol. A new frontier for Bitcoin programmability.",
    "file": "data/E_bitvm.json",
    "title": "🖥bitvm"
  },
  "block_time-block-size": {
    "cat": "Additional Info",
    "desc": "Why Bitcoin uses 10-minute blocks and how block size affects the network.",
    "file": "data/H_block_time-block-size.json",
    "title": "⏰Block Time-Block-Size"
  },
  "blockchain-timechain": {
    "cat": "Experienced Topics",
    "desc": "How the Bitcoin blockchain (timechain) works — blocks, transactions, timestamps, and the immutable ledger.",
    "file": "data/E_blockchain-timechain.json",
    "title": "⛓blockchain-timechain-transactions-addresses"
  },
  "books": {
    "cat": "Resources",
    "desc": "The essential Bitcoin reading list: The Bitcoin Standard, 21 Lessons, Mastering Bitcoin, and more.",
    "file": "data/R_books.json",
    "title": "📚books"
  },
  "burn_bitcoin": {
    "cat": "Additional Info",
    "desc": "How Bitcoin can be burned (made permanently unspendable) and why people do it.",
    "file": "data/H_burn_bitcoin.json",
    "title": "Burn bitcoin"
  },
  "byzantine_generals__problem": {
    "cat": "Additional Info",
    "desc": "The Byzantine Generals' Problem — the computer science challenge Satoshi solved.",
    "file": "data/H_byzantine_generals__problem.json",
    "title": "⚔Byzantine Generals’ Problem"
  },
  "charts": {
    "cat": "Resources",
    "desc": "Bitcoin price charts, on-chain analytics, stock-to-flow, and data visualizations.",
    "file": "data/R_charts.json",
    "title": "📊charts"
  },
  "chaumian-mints": {
    "cat": "Experienced Topics",
    "desc": "Chaumian ecash, Cashu, and blinded signatures — the cutting edge of Bitcoin privacy technology.",
    "file": "data/E_chaumian-mints.json",
    "title": "💸layer-2-chaumian-mints-ecash"
  },
  "chaumian_e-cash_and_blind_signatures": {
    "cat": "Additional Info",
    "desc": "David Chaum's ecash, blind signatures, and the cryptographic foundations of digital privacy.",
    "file": "data/H_chaumian_e-cash_and_blind_signatures.json",
    "title": "💲Chaumian E-cash and Blind Signatures"
  },
  "coin_mixing_coinjoin_coin_control_utxo": {
    "cat": "Additional Info",
    "desc": "CoinJoin, coin mixing, UTXO management — advanced Bitcoin privacy techniques.",
    "file": "data/H_coin_mixing_coinjoin_coin_control_utxo.json",
    "title": "🌀Coin Mixing/Coinjoin/Coin Control/UTXO Management"
  },
  "consensus": {
    "cat": "Additional Info",
    "desc": "How Bitcoin achieves consensus without a central authority — Nakamoto Consensus and beyond.",
    "file": "data/H_consensus.json",
    "title": "🤝Consensus"
  },
  "core-source-code": {
    "cat": "Experienced Topics",
    "desc": "Bitcoin Core's source code, forks, testnet, and the open-source development process.",
    "file": "data/E_core-source-code.json",
    "title": "💾core-source-code-forks-testnet-future-potential-upgrades"
  },
  "cryptography": {
    "cat": "Experienced Topics",
    "desc": "The cryptographic foundations of Bitcoin — SHA-256, elliptic curves, digital signatures, and the cypherpunk legacy.",
    "file": "data/E_cryptography.json",
    "title": "🔒cryptography-cypherpunks"
  },
  "ctv-covenants": {
    "cat": "Experienced Topics",
    "desc": "BIP-119, CTV, and Bitcoin covenants — proposed upgrades and the debates around them.",
    "file": "data/E_ctv-covenants.json",
    "title": "📜ctv-bip119-covenants"
  },
  "curriculum": {
    "cat": "Resources",
    "desc": "Bitcoin education curriculum and presentations for teachers and students.",
    "file": "data/R_curriculum.json",
    "title": "🎓curriculum-presentations"
  },
  "cyles": {
    "cat": "Additional Info",
    "desc": "Bitcoin's 4-year cycles, Gartner Hype Cycles, and whether the pattern continues.",
    "file": "data/H_cyles.json",
    "title": "🚲Cyles"
  },
  "decentralized": {
    "cat": "Properties Layer 1",
    "desc": "Why no single person, company, or government controls Bitcoin — and why that's the most important feature.",
    "file": "data/D_decentralized.json",
    "title": "👪decentralized-censorship-resistant-ungovernable-incorruptible-trustless-unconfiscatable-updatable"
  },
  "derivation_path": {
    "cat": "Additional Info",
    "desc": "HD wallet derivation paths — how your seed phrase generates all your addresses.",
    "file": "data/H_derivation_path.json",
    "title": "↕Derivation Path"
  },
  "developers": {
    "cat": "Experienced Topics",
    "desc": "Building on Bitcoin — resources, guides, and paths for developers who want to contribute.",
    "file": "data/E_developers.json",
    "title": "🖥developers"
  },
  "difficulty-adjustment": {
    "cat": "Experienced Topics",
    "desc": "The most elegant part of Bitcoin's design — how the network self-adjusts every 2,016 blocks.",
    "file": "data/E_difficulty-adjustment.json",
    "title": "😤difficulty-adjustment"
  },
  "discrete_log_contracts__dlcs": {
    "cat": "Additional Info",
    "desc": "DLCs (Discrete Log Contracts) — smart contracts on Bitcoin using oracle signatures.",
    "file": "data/H_discrete_log_contracts__dlcs.json",
    "title": "📝Discrete Log Contracts (DLCs)?"
  },
  "dollar-bitcoin_milkshake_theory": {
    "cat": "Additional Info",
    "desc": "The Dollar-Bitcoin Milkshake Theory — how global dollar demand and Bitcoin intersect.",
    "file": "data/H_dollar-bitcoin_milkshake_theory.json",
    "title": "🥤Dollar-Bitcoin Milkshake Theory"
  },
  "dominant": {
    "cat": "Properties Layer 1",
    "desc": "Bitcoin's brand recognition, network effects, and why it has maintained the #1 position since 2009.",
    "file": "data/D_dominant.json",
    "title": "🏆dominant-recognizable-brand-legitimate-limitless-infinite-exponential-transformative-revolutionary"
  },
  "dust": {
    "cat": "Additional Info",
    "desc": "Dust UTXOs: what they are, why they're a problem, and how to manage them.",
    "file": "data/H_dust.json",
    "title": "⏳Dust"
  },
  "elevator_pitches": {
    "cat": "Additional Info",
    "desc": "Quick 20-30 second explanations of why Bitcoin matters — for every audience.",
    "file": "data/H_elevator_pitches.json",
    "title": "↕Elevator Pitches"
  },
  "energy": {
    "cat": "Experienced Topics",
    "desc": "The truth about Bitcoin's energy use: 0.1% of global energy, renewable mining, methane capture, and grid stabilization.",
    "file": "data/E_energy.json",
    "title": "💡energy"
  },
  "environment___energy": {
    "cat": "Additional Info",
    "desc": "Bitcoin and the environment: energy usage facts, renewable mining, and debunking the FUD.",
    "file": "data/H_environment___energy.json",
    "title": "🌳Environment & Energy"
  },
  "evidence-against-alts": {
    "cat": "Experienced Topics",
    "desc": "Why every altcoin fails against Bitcoin — premines, centralization, broken promises, and the evidence.",
    "file": "data/E_evidence-against-alts.json",
    "title": "⚠evidence-against-ethereum-other-alt-coins-crypto-defi-nfts-web3-monero-bsv-bch-cbdcs-other-projects"
  },
  "extension-blocks": {
    "cat": "Experienced Topics",
    "desc": "Extension blocks and other proposed scaling solutions for Bitcoin.",
    "file": "data/E_extension-blocks.json",
    "title": "🚧extension-blocks-and-other-proposed-scaling-solutions"
  },
  "faith___religion": {
    "cat": "Additional Info",
    "desc": "Bitcoin and faith — how sound money relates to religious and spiritual values.",
    "file": "data/H_faith___religion.json",
    "title": "🙏Faith & Religion"
  },
  "faq-glossary": {
    "cat": "Resources",
    "desc": "Bitcoin FAQ, glossary of terms, and quick answers to common questions.",
    "file": "data/R_faq-glossary.json",
    "title": "❓faq-glossary-search-ai-calendar"
  },
  "fedi-ark": {
    "cat": "Experienced Topics",
    "desc": "Fedimints, Ark, and Bitcoin's privacy/scaling layers — community custody with enhanced privacy.",
    "file": "data/E_fedi-ark.json",
    "title": "🛡layer-2-fedi-ark"
  },
  "fedimints": {
    "cat": "Additional Info",
    "desc": "Fedimints: community custody with enhanced privacy using federated Chaumian mints.",
    "file": "data/H_fedimints.json",
    "title": "💚Fedimints"
  },
  "feedback_loops": {
    "cat": "Additional Info",
    "desc": "Bitcoin's feedback loops — the self-reinforcing cycles that drive adoption and security.",
    "file": "data/H_feedback_loops.json",
    "title": "➰Feedback Loops"
  },
  "free_and_open_source_software__foss": {
    "cat": "Additional Info",
    "desc": "Free and open source software (FOSS) projects connected to Bitcoin.",
    "file": "data/H_free_and_open_source_software__foss.json",
    "title": "💿Free and Open Source Software (FOSS)"
  },
  "fun-facts": {
    "cat": "Resources",
    "desc": "Mind-blowing Bitcoin trivia: Pizza Day, Satoshi's birthday code, lost coins, and 200+ amazing facts.",
    "file": "data/R_fun-facts.json",
    "title": "🎉fun-facts"
  },
  "game_theory": {
    "cat": "Additional Info",
    "desc": "Game theory and Bitcoin: Nash equilibrium, prisoner's dilemma, and strategic incentives.",
    "file": "data/H_game_theory.json",
    "title": "🏈Game Theory"
  },
  "games": {
    "cat": "Resources",
    "desc": "Bitcoin-themed games and gamified learning experiences.",
    "file": "data/R_games.json",
    "title": "🎮games"
  },
  "geopolitics___macroeconomics": {
    "cat": "Additional Info",
    "desc": "Bitcoin's role in geopolitics: nation-state adoption, reserve currencies, and macro trends.",
    "file": "data/H_geopolitics___macroeconomics.json",
    "title": "💰Geopolitics & Macroeconomics"
  },
  "giga-chad": {
    "cat": "Resources",
    "desc": "Michael Saylor, MicroStrategy, and the corporate Bitcoin movement.",
    "file": "data/R_giga-chad.json",
    "title": "👑giga-chad"
  },
  "governance": {
    "cat": "Additional Info",
    "desc": "How Bitcoin is governed — consensus mechanisms, BIPs, and decentralized decision-making.",
    "file": "data/H_governance.json",
    "title": "🏛Governance"
  },
  "graphics": {
    "cat": "Resources",
    "desc": "Bitcoin infographics, charts, diagrams, and visual explanations.",
    "file": "data/R_graphics.json",
    "title": "🎨graphics"
  },
  "ham_radio": {
    "cat": "Additional Info",
    "desc": "Using Bitcoin without internet — ham radio, mesh networks, and offline transactions.",
    "file": "data/H_ham_radio.json",
    "title": "Ham Radio"
  },
  "hardware": {
    "cat": "Resources",
    "desc": "Bitcoin hardware: mining rigs, hardware wallets, nodes, and open-source projects like Bitaxe.",
    "file": "data/R_hardware.json",
    "title": "💻hardware"
  },
  "health": {
    "cat": "Resources",
    "desc": "Bitcoin and health: low time preference living, breaking free from the system.",
    "file": "data/R_health.json",
    "title": "🥩health"
  },
  "history": {
    "cat": "Resources",
    "desc": "The complete history of Bitcoin — from the cypherpunks to today.",
    "file": "data/R_history.json",
    "title": "📆history"
  },
  "human_rights__social_justice_and_freedo": {
    "cat": "Additional Info",
    "desc": "Bitcoin as a tool for human rights, social justice, and financial freedom worldwide.",
    "file": "data/H_human_rights__social_justice_and_freedo.json",
    "title": "🗽Human Rights, Social Justice and Freedom"
  },
  "improved_incentive_structure": {
    "cat": "Additional Info",
    "desc": "How Bitcoin's incentive structure improves civilization — aligning individual and collective interests.",
    "file": "data/H_improved_incentive_structure.json",
    "title": "✅Improved Incentive Structure"
  },
  "informational-sites": {
    "cat": "Resources",
    "desc": "Bitcoin dashboards, tools, courses, newsletters, communities, and educational websites.",
    "file": "data/R_informational-sites.json",
    "title": "📃informational-sites"
  },
  "international": {
    "cat": "Resources",
    "desc": "Bitcoin resources in multiple languages and global adoption stories.",
    "file": "data/R_international.json",
    "title": "🌍international"
  },
  "investment-strategy": {
    "cat": "Experienced Topics",
    "desc": "DCA, HODL, lump sum strategies, taxes, retirement planning, and thinking long-term with Bitcoin.",
    "file": "data/E_investment-strategy.json",
    "title": "🤑investment-strategy"
  },
  "jobs-earn": {
    "cat": "Resources",
    "desc": "Bitcoin job boards, entrepreneurship resources, and ways to earn sats.",
    "file": "data/R_jobs-earn.json",
    "title": "👷job-postings"
  },
  "laws_of_thermodynamics": {
    "cat": "Additional Info",
    "desc": "How Bitcoin follows the laws of thermodynamics — energy, entropy, and proof of work.",
    "file": "data/H_laws_of_thermodynamics.json",
    "title": "🔥Laws of Thermodynamics"
  },
  "layer-2-lightning": {
    "cat": "Experienced Topics",
    "desc": "The Lightning Network: instant, nearly-free Bitcoin payments. How Bitcoin scales without sacrificing decentralization.",
    "file": "data/E_layer-2-lightning.json",
    "title": "⚡layer-2-lightning"
  },
  "layer-3-sidechains": {
    "cat": "Experienced Topics",
    "desc": "Sidechains, Liquid Network, and layer-3 applications built on top of Bitcoin.",
    "file": "data/E_layer-3-sidechains.json",
    "title": "📱layer-3-sidechain-applications"
  },
  "lightning_node": {
    "cat": "Additional Info",
    "desc": "Running a Lightning Network node — setup guides, routing, and earning sats.",
    "file": "data/H_lightning_node.json",
    "title": "⚡ Lightning Node"
  },
  "lindy_effect": {
    "cat": "Additional Info",
    "desc": "The Lindy Effect: the longer Bitcoin survives, the longer it will survive.",
    "file": "data/H_lindy_effect.json",
    "title": "👴Lindy Effect"
  },
  "market_cap": {
    "cat": "Additional Info",
    "desc": "Bitcoin's market cap potential — can it reach millions per coin? The math says yes.",
    "file": "data/H_market_cap.json",
    "title": "🧢Market Cap"
  },
  "math": {
    "cat": "Additional Info",
    "desc": "The mathematics of Bitcoin — from SHA-256 to elliptic curves to probability.",
    "file": "data/H_math.json",
    "title": "➕Math"
  },
  "mathematics": {
    "cat": "Additional Info",
    "desc": "Advanced mathematical concepts underlying Bitcoin's protocol and security.",
    "file": "data/H_mathematics.json",
    "title": "➕Mathematics"
  },
  "maximalism": {
    "cat": "Experienced Topics",
    "desc": "Why people who study Bitcoin the most become maximalists. The case for Bitcoin-only.",
    "file": "data/E_maximalism.json",
    "title": "💯maximalism"
  },
  "memes-funny": {
    "cat": "Resources",
    "desc": "The best Bitcoin memes, jokes, and humor from the community. Laugh while you learn.",
    "file": "data/R_memes-funny.json",
    "title": "😂memes-funny"
  },
  "mev": {
    "cat": "Additional Info",
    "desc": "MEV (Miner Extractable Value) in Bitcoin — what it is and its implications.",
    "file": "data/H_mev.json",
    "title": "⛏MEV"
  },
  "mining": {
    "cat": "Experienced Topics",
    "desc": "How Bitcoin mining actually works — nonces, SHA-256 hashing, difficulty adjustment, and the brute-force lottery.",
    "file": "data/E_mining.json",
    "title": "🌋mining"
  },
  "misconceptions-fud": {
    "cat": "Resources",
    "desc": "Every Bitcoin myth debunked: too volatile, wastes energy, used by criminals, no intrinsic value — all wrong.",
    "file": "data/R_misconceptions-fud.json",
    "title": "🤡common-misconceptions-fud-debunked"
  },
  "money": {
    "cat": "Properties Layer 1",
    "desc": "What money actually is, how it works, and why Bitcoin satisfies every property of sound money better than anything before it.",
    "file": "data/D_money.json",
    "title": "💰money"
  },
  "movies-tv": {
    "cat": "Resources",
    "desc": "Bitcoin documentaries, films, and TV appearances. From The Big Short to Bitcoin-specific docs.",
    "file": "data/R_movies-tv.json",
    "title": "🎬movies-tv-documentaries"
  },
  "music": {
    "cat": "Resources",
    "desc": "Bitcoin-inspired music, songs, and audio content from the community.",
    "file": "data/R_music.json",
    "title": "🎵music"
  },
  "network_effects": {
    "cat": "Additional Info",
    "desc": "Bitcoin's network effects — why the most adopted network wins and keeps winning.",
    "file": "data/H_network_effects.json",
    "title": "🌐Network Effects"
  },
  "news-adoption": {
    "cat": "Resources",
    "desc": "Latest Bitcoin news, adoption milestones, and real-world usage stories.",
    "file": "data/R_news-adoption.json",
    "title": "📰news-adoption"
  },
  "nodes": {
    "cat": "Experienced Topics",
    "desc": "Run your own Bitcoin node. Don't trust, verify. How 14,000+ nodes keep the network decentralized.",
    "file": "data/E_nodes.json",
    "title": "💻nodes"
  },
  "nostr": {
    "cat": "Resources",
    "desc": "Nostr: the decentralized social protocol Bitcoiners are building on. Social media you can't be censored from.",
    "file": "data/R_nostr.json",
    "title": "💜nostr"
  },
  "one-stop-shop": {
    "cat": "Resources",
    "desc": "The best resources to understand Bitcoin's value as fast as possible. Start here if you're new.",
    "file": "data/R_one-stop-shop.json",
    "title": "🛑one-stop-shop"
  },
  "op-codes": {
    "cat": "Experienced Topics",
    "desc": "OP_CAT, Simplicity, and Bitcoin's scripting language — the building blocks of smart functionality.",
    "file": "data/E_op-codes.json",
    "title": "👨‍💻op-codes-simplicity"
  },
  "open_source": {
    "cat": "Additional Info",
    "desc": "What free and open source really means — and why it matters for Bitcoin.",
    "file": "data/H_open_source.json",
    "title": "⭕Open Source"
  },
  "oracle": {
    "cat": "Additional Info",
    "desc": "Oracles in Bitcoin — how external data connects to the blockchain.",
    "file": "data/H_oracle.json",
    "title": "🔮Oracle"
  },
  "orange-pilling": {
    "cat": "Additional Info",
    "desc": "The art of orange-pilling — strategies for explaining Bitcoin to different audiences.",
    "file": "data/H_orange-pilling.json",
    "title": "🟠Orange-Pilling"
  },
  "ordinals": {
    "cat": "Additional Info",
    "desc": "Bitcoin Ordinals and inscriptions — NFTs on the world's most secure blockchain.",
    "file": "data/H_ordinals.json",
    "title": "Ordinals"
  },
  "ordinals__nfts_on_bitcoin__and_block_spa": {
    "cat": "Additional Info",
    "desc": "The Ordinals debate: NFTs on Bitcoin, block space economics, and community perspectives.",
    "file": "data/H_ordinals__nfts_on_bitcoin__and_block_spa.json",
    "title": "Ordinals, NFTs on Bitcoin, and Block Space"
  },
  "organic": {
    "cat": "Properties Layer 1",
    "desc": "How Bitcoin grew from an idea worth nothing to a trillion-dollar network — without marketing, without a company, without a leader.",
    "file": "data/D_organic.json",
    "title": "🌳organic"
  },
  "peace_and_anti-war": {
    "cat": "Additional Info",
    "desc": "Can a Bitcoin Standard end wars? The case for Bitcoin as a force for peace.",
    "file": "data/H_peace_and_anti-war.json",
    "title": "☮Peace and Anti-War"
  },
  "peaceful": {
    "cat": "Properties Layer 1",
    "desc": "Bitcoin is voluntary, permissionless, borderless, and unstoppable. No one forces you to use it — and no one can stop you.",
    "file": "data/D_peaceful.json",
    "title": "☮peaceful"
  },
  "philosophy": {
    "cat": "Additional Info",
    "desc": "The philosophy of Bitcoin — from first principles to existential implications.",
    "file": "data/H_philosophy.json",
    "title": "🍎Philosophy"
  },
  "podcasts": {
    "cat": "Resources",
    "desc": "Top Bitcoin podcasts: Bitcoin Audible, What Bitcoin Did, Stephan Livera, and more.",
    "file": "data/R_podcasts.json",
    "title": "🔊podcasts"
  },
  "poems-stories": {
    "cat": "Resources",
    "desc": "Bitcoin poetry, short stories, jokes, and creative writing from the community.",
    "file": "data/R_poems-stories.json",
    "title": "📒poems-stories-jokes"
  },
  "politics": {
    "cat": "Additional Info",
    "desc": "Bitcoin and politics — how Bitcoin intersects with government policy and elections.",
    "file": "data/H_politics.json",
    "title": "🏛Politics"
  },
  "pow-vs-pos": {
    "cat": "Experienced Topics",
    "desc": "Why Proof of Work is fundamentally superior to Proof of Stake — energy, security, fairness, and decentralization.",
    "file": "data/E_pow-vs-pos.json",
    "title": "💪proof-of-work-vs-proof-of-stake"
  },
  "predictions": {
    "cat": "Additional Info",
    "desc": "Bitcoin predictions timestamped by the community — bold calls and their outcomes.",
    "file": "data/H_predictions.json",
    "title": "🔮Predictions"
  },
  "privacy-nonkyc": {
    "cat": "Experienced Topics",
    "desc": "Financial privacy as a human right. KYC, non-KYC stacking, and protecting your sovereignty.",
    "file": "data/E_privacy-nonkyc.json",
    "title": "🤫privacy-nonkyc"
  },
  "problems-of-money": {
    "cat": "Experienced Topics",
    "desc": "The broken fiat system: inflation, money printing, the Cantillon Effect, and why today's money is failing everyone.",
    "file": "data/E_problems-of-money.json",
    "title": "📉the-problems-of-money"
  },
  "programmable": {
    "cat": "Properties Layer 1",
    "desc": "Bitcoin as programmable money — interoperable, pseudonymous, resilient, and thermodynamically sound.",
    "file": "data/D_programmable.json",
    "title": "🤖programmable"
  },
  "projects-diy": {
    "cat": "Resources",
    "desc": "DIY Bitcoin projects: build your own node, Lightning ATM, and more.",
    "file": "data/R_projects-diy.json",
    "title": "🔧projects-diy"
  },
  "public_key_vs_private_key": {
    "cat": "Additional Info",
    "desc": "Public keys vs. private keys — the cryptographic foundation of Bitcoin ownership.",
    "file": "data/H_public_key_vs_private_key.json",
    "title": "🗝Public Key vs Private Key"
  },
  "rbf": {
    "cat": "Additional Info",
    "desc": "Replace-By-Fee (RBF) — how to speed up stuck Bitcoin transactions.",
    "file": "data/H_rbf.json",
    "title": "↔RBF"
  },
  "referral-links": {
    "cat": "Referral Links",
    "desc": "Curated Bitcoin referral links — earn free sats with trusted platforms like River, Fold, and Strike.",
    "file": "data/H_referral-links.json",
    "title": "🔗free-btc-referral-links"
  },
  "regulation": {
    "cat": "Experienced Topics",
    "desc": "Bitcoin and government: bans, adoption, legal tender, ETFs, and why regulation can't stop decentralization.",
    "file": "data/E_regulation.json",
    "title": "🏛regulation-policy"
  },
  "research-theses": {
    "cat": "Resources",
    "desc": "Academic research papers and theses on Bitcoin, monetary policy, and cryptographic systems.",
    "file": "data/R_research-theses.json",
    "title": "✍research-theses"
  },
  "risks__threats__attack_vectors__weaknes": {
    "cat": "Additional Info",
    "desc": "Bitcoin's risks, threats, and attack vectors — what could go wrong and why it probably won't.",
    "file": "data/H_risks__threats__attack_vectors__weaknes.json",
    "title": "⚔Risks, Threats, Attack Vectors"
  },
  "rollups": {
    "cat": "Additional Info",
    "desc": "Rollups on Bitcoin — scaling and privacy solutions using off-chain computation.",
    "file": "data/H_rollups.json",
    "title": "🥐Rollups"
  },
  "satoshi-nakamoto": {
    "cat": "Resources",
    "desc": "The mystery of Bitcoin's creator: who was Satoshi Nakamoto? The evidence, theories, and legacy.",
    "file": "data/R_satoshi-nakamoto.json",
    "title": "🦸satoshi-nakamoto"
  },
  "sats__or__bits": {
    "cat": "Additional Info",
    "desc": "The sats vs. bits debate — which denomination should Bitcoin use?",
    "file": "data/H_sats__or__bits.json",
    "title": "Sats or Bits?"
  },
  "scalability": {
    "cat": "Additional Info",
    "desc": "Can Bitcoin scale to serve the world? Layers, Lightning, and the path forward.",
    "file": "data/H_scalability.json",
    "title": "🌐Scalability"
  },
  "scarce": {
    "cat": "Properties Layer 1",
    "desc": "Only 21 million will ever exist. Explore what makes Bitcoin the scarcest asset humanity has ever created.",
    "file": "data/D_scarce.json",
    "title": "🍀scarce"
  },
  "secure": {
    "cat": "Properties Layer 1",
    "desc": "How Bitcoin's network security makes it virtually impossible to hack — protected by more computing power than anything on Earth.",
    "file": "data/D_secure.json",
    "title": "™secure"
  },
  "self-custody": {
    "cat": "Experienced Topics",
    "desc": "Not your keys, not your coins. Learn how to truly own your Bitcoin with wallets, seed phrases, and security.",
    "file": "data/E_self-custody.json",
    "title": "🔑self-custody"
  },
  "sidechains": {
    "cat": "Additional Info",
    "desc": "Bitcoin sidechains like Liquid — benefits, tradeoffs, and use cases.",
    "file": "data/H_sidechains.json",
    "title": "♻Sidechains"
  },
  "simplified_payment_verification__spv": {
    "cat": "Additional Info",
    "desc": "SPV (Simplified Payment Verification) — lightweight Bitcoin verification without a full node.",
    "file": "data/H_simplified_payment_verification__spv.json",
    "title": "✔SPV"
  },
  "smart-contracts": {
    "cat": "Experienced Topics",
    "desc": "Smart contracts on Bitcoin — what's possible, what's coming, and why Bitcoin's approach is different.",
    "file": "data/E_smart-contracts.json",
    "title": "📱smart-contracts"
  },
  "social-media": {
    "cat": "Resources",
    "desc": "Bitcoin Twitter/X accounts, influencers, and social media communities to follow.",
    "file": "data/R_social-media.json",
    "title": "👍social-media"
  },
  "soft_vs_hard_forks": {
    "cat": "Additional Info",
    "desc": "Soft forks vs. hard forks — how Bitcoin upgrades while maintaining consensus.",
    "file": "data/H_soft_vs_hard_forks.json",
    "title": "🍴Soft vs Hard Forks"
  },
  "softwar": {
    "cat": "Additional Info",
    "desc": "Jason Lowery's Softwar thesis — Bitcoin as a non-lethal alternative to physical warfare.",
    "file": "data/H_softwar.json",
    "title": "Softwar"
  },
  "stablecoins": {
    "cat": "Additional Info",
    "desc": "The role of stablecoins in the Bitcoin economy — and why they're not a threat to Bitcoin.",
    "file": "data/H_stablecoins.json",
    "title": "🪙Stablecoins"
  },
  "stratum_v2": {
    "cat": "Additional Info",
    "desc": "Stratum V2 — the next-generation mining protocol for better decentralization and efficiency.",
    "file": "data/H_stratum_v2.json",
    "title": "🟩Stratum V2"
  },
  "submarine_swap": {
    "cat": "Additional Info",
    "desc": "Submarine swaps — trustlessly moving Bitcoin between on-chain and Lightning.",
    "file": "data/H_submarine_swap.json",
    "title": "⛵Submarine Swap"
  },
  "supranational": {
    "cat": "Properties Layer 1",
    "desc": "Bitcoin transcends nations and governments. Explore the Lindy Effect, settlement finality, and dilution-proof money.",
    "file": "data/D_supranational.json",
    "title": "🕊supranational"
  },
  "swag-merch": {
    "cat": "Resources",
    "desc": "Bitcoin merchandise, clothing, and businesses where you can spend your sats.",
    "file": "data/R_swag-merch.json",
    "title": "👕swag-merch"
  },
  "swaps": {
    "cat": "Additional Info",
    "desc": "How to swap between on-chain Bitcoin and Lightning — tools, techniques, and protocols.",
    "file": "data/H_swaps.json",
    "title": "↔Swaps"
  },
  "ta_tips": {
    "cat": "Additional Info",
    "desc": "Technical analysis tips for Bitcoin — chart patterns, indicators, and trading education.",
    "file": "data/H_ta_tips.json",
    "title": "📈TA Tips"
  },
  "tail_emission": {
    "cat": "Additional Info",
    "desc": "The tail emission debate — should Bitcoin ever have perpetual block rewards?",
    "file": "data/H_tail_emission.json",
    "title": "🐈Tail Emission"
  },
  "taproot": {
    "cat": "Additional Info",
    "desc": "Taproot: Bitcoin's latest major upgrade — Schnorr signatures, script improvements, and privacy.",
    "file": "data/H_taproot.json",
    "title": "🧰Taproot"
  },
  "taro": {
    "cat": "Additional Info",
    "desc": "Taro (now Taproot Assets) — issuing assets on the Bitcoin and Lightning networks.",
    "file": "data/H_taro.json",
    "title": "🥕Taro"
  },
  "the_future": {
    "cat": "Additional Info",
    "desc": "How Bitcoin could change the future — hyperbitcoinization, global adoption, and beyond.",
    "file": "data/H_the_future.json",
    "title": "🔮The Future"
  },
  "time": {
    "cat": "Additional Info",
    "desc": "How Bitcoin keeps time — block time, timestamps, and the decentralized clock.",
    "file": "data/H_time.json",
    "title": "⏰Time"
  },
  "time_preference": {
    "cat": "Additional Info",
    "desc": "Time preference: how sound money encourages long-term thinking and civilization building.",
    "file": "data/H_time_preference.json",
    "title": "🕑Time Preference"
  },
  "toxicity": {
    "cat": "Additional Info",
    "desc": "Is Bitcoin community toxicity real? Or is it integrity? The debate and its meaning.",
    "file": "data/H_toxicity.json",
    "title": "☣ Toxicity"
  },
  "transaction_fees": {
    "cat": "Additional Info",
    "desc": "Bitcoin transaction fees — how they work, fee markets, and long-term sustainability.",
    "file": "data/H_transaction_fees.json",
    "title": "💲Transaction Fees"
  },
  "unpopular_opinions": {
    "cat": "Additional Info",
    "desc": "Unpopular opinions in the Bitcoin space — controversial takes and honest debates.",
    "file": "data/H_unpopular_opinions.json",
    "title": "💀Unpopular Opinions"
  },
  "use-cases": {
    "cat": "Properties Layer 1",
    "desc": "Real-world uses for Bitcoin: savings, payments, remittances, store of value, and more.",
    "file": "data/D_use-cases.json",
    "title": "✔use-cases"
  },
  "utxos": {
    "cat": "Additional Info",
    "desc": "UTXOs (Unspent Transaction Outputs) — the fundamental building block of Bitcoin transactions.",
    "file": "data/H_utxos.json",
    "title": "🕳UTXOs"
  },
  "vbyte": {
    "cat": "Additional Info",
    "desc": "Virtual bytes (vBytes) — how Bitcoin measures transaction weight for fee calculation.",
    "file": "data/H_vbyte.json",
    "title": "🏋vByte"
  },
  "videos": {
    "cat": "Resources",
    "desc": "Must-watch Bitcoin lectures, talks, and presentations from Andreas Antonopoulos, Michael Saylor, and others.",
    "file": "data/R_videos.json",
    "title": "📺videos"
  },
  "web5": {
    "cat": "Resources",
    "desc": "Web5 and decentralized web technologies built on Bitcoin.",
    "file": "data/R_web5.json",
    "title": "5⃣web5"
  },
  "whitepaper": {
    "cat": "Properties Layer 1",
    "desc": "The 9-page document that started it all. Published October 31, 2008 by Satoshi Nakamoto — the foundation of Bitcoin.",
    "file": "data/D_whitepaper.json",
    "title": "📄whitepaper"
  }
};
