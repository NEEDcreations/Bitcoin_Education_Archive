import { pack } from "./pack.mjs";

export const PART_H = [].concat(
    pack("books", [
    [
        "books-mastering-bitcoin",
        "What is Mastering Bitcoin about?",
        "Mastering Bitcoin is the technical book by Andreas Antonopoulos, and David Harding co-wrote the 3rd edition in 2023. It walks from what Bitcoin is through keys, wallets, transactions, script, signatures, fees, the network, the chain, mining, security, and second-layer applications. You can read all three editions free at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "github.com/bitcoinbook/bitcoinbook chapter files ch01-ch14 on the develop branch (CC BY-SA 4.0 LICENSE). btcbooks.org/mastering-bitcoin and btcbooks.org/mastering-bitcoin-3rd-edition."
    ],
    [
        "books-mastering-who",
        "Who wrote Mastering Bitcoin?",
        "Andreas Antonopoulos wrote the first edition in 2014, and David Harding joined him for the 2023 3rd edition. You can read it free at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "Same repo. Edition history from the repo and btcbooks.org listings."
    ],
    [
        "books-mastering-license",
        "Where can I read Mastering Bitcoin for free?",
        "You can read editions 1 through 3 free at github.com/bitcoinbook/bitcoinbook. The authors published the text there.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "Repo LICENSE versus README wording, checked via the plan's 2026-10-27 note and the public repo."
    ],
    [
        "books-mastering-intro",
        "What does the introduction of Mastering Bitcoin cover?",
        "The introduction defines Bitcoin and includes sections on its history and on getting started, including how to choose a wallet and the difference between a full node and a lightweight client. You can read that chapter free at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "ch01_intro.adoc headings: Introduction, History of Bitcoin, Getting Started, Choosing a Bitcoin Wallet, Full node versus Lightweight."
    ],
    [
        "books-mastering-how",
        "How does Mastering Bitcoin explain a payment?",
        "The chapter How Bitcoin Works is the overview before the later chapters split the system into parts. It sits between the introduction and the chapter on Bitcoin Core. You can read it free at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "ch02_overview.adoc heading: How Bitcoin Works."
    ],
    [
        "books-mastering-core",
        "What does Mastering Bitcoin say about Bitcoin Core?",
        "One chapter is Bitcoin Core: The Reference Implementation, the software most people mean by a full node. The book treats it as the reference, not as the only program allowed to exist. You can read it at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "developers",
            "nodes"
        ],
        "ch03_bitcoin-core.adoc heading."
    ],
    [
        "books-mastering-keys",
        "How does Mastering Bitcoin explain keys and addresses?",
        "A chapter titled Keys and Addresses covers the material that later wallet and transaction chapters assume. You can read it free at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "developers",
            "public_key_vs_private_key"
        ],
        "ch04_keys.adoc heading: Keys and Addresses."
    ],
    [
        "books-mastering-wallets",
        "What does the Mastering Bitcoin wallet chapter cover?",
        "The wallet chapter's top heading is Wallet Recovery. Later headings in that file cover deterministic keys, hierarchical deterministic derivation from BIP32, and seeds and recovery codes. You can read it at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "self-custody",
            "developers"
        ],
        "ch05_wallets.adoc headings: Wallet Recovery, Deterministic Key Generation, HD Key Generation (BIP32), Seeds and Recovery Codes."
    ],
    [
        "books-mastering-tx",
        "How does Mastering Bitcoin explain transactions?",
        "A chapter titled Transactions comes before the chapters on authorization, signatures, and fees. Together they are the book's account of how a payment is built and checked. You can read them free at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "ch06_transactions.adoc heading: Transactions."
    ],
    [
        "books-mastering-script",
        "What does Mastering Bitcoin teach about script?",
        "The chapter Authorization and Authentication is the book's treatment of Bitcoin script, the program that decides whether a spend is allowed. A later chapter covers digital signatures. You can read both free at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "developers",
            "op-codes"
        ],
        "ch07 heading Authorization and Authentication; ch08 heading Digital Signatures."
    ],
    [
        "books-mastering-fees",
        "How does Mastering Bitcoin explain fees?",
        "The chapter Transaction Fees is where the book explains the fee a sender attaches so miners will include a transaction. You can read it free at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "developers",
            "transaction_fees"
        ],
        "ch09_fees.adoc heading: Transaction Fees."
    ],
    [
        "books-mastering-network",
        "What does Mastering Bitcoin say about the network?",
        "The chapter The Bitcoin Network describes the peer-to-peer network that passes transactions and blocks. The following chapter is The Blockchain. You can read both free at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "nodes",
            "developers"
        ],
        "ch10 heading The Bitcoin Network; ch11 heading The Blockchain."
    ],
    [
        "books-mastering-mining",
        "How does Mastering Bitcoin explain mining?",
        "The chapter Mining and Consensus covers how blocks are found and how nodes agree. It is the book's account of proof of work, separate from the security chapter that follows. You can read it free at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "mining",
            "developers"
        ],
        "ch12_mining.adoc heading: Mining and Consensus."
    ],
    [
        "books-mastering-security",
        "What security topics does Mastering Bitcoin cover?",
        "A chapter titled Bitcoin Security sits after mining and before the chapter on second-layer applications. It is about how users and operators handle security. You can read it free at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "security",
            "developers"
        ],
        "ch13_security.adoc heading: Bitcoin Security."
    ],
    [
        "books-mastering-l2",
        "Does Mastering Bitcoin cover Lightning?",
        "The last main chapter is Second-Layer Applications, which is where the 3rd edition points past the base chain. The dedicated Lightning book is a separate free text. You can read the chapter free at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "layer-2-lightning",
            "developers"
        ],
        "ch14_applications.adoc heading: Second-Layer Applications."
    ],
    [
        "books-mastering-taproot",
        "Does the 3rd edition of Mastering Bitcoin include Taproot?",
        "The 2023 3rd edition brings the free book up to Taproot and Schnorr signatures, in the same repo as the earlier editions. You can read it free at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "taproot",
            "developers"
        ],
        "btcbooks.org/mastering-bitcoin-3rd-edition blurb: updated for Taproot and Schnorr. Repo LICENSE CC BY-SA 4.0."
    ],
    [
        "books-lnbook",
        "What is Mastering the Lightning Network about?",
        "Mastering the Lightning Network, by Andreas Antonopoulos, Olaoluwa Osuntokun, and Rene Pickhardt, is the technical book on Lightning payments. Its chapters run from an introduction and getting started through how Lightning works, nodes, channels, routing, onion routing, and security. You can read it free at github.com/lnbook/lnbook.",
        [
            "books",
            "layer-2-lightning",
            "developers"
        ],
        "lnbook chapter headings on the develop branch. LICENSE CC BY-SA 4.0. btcbooks.org/mastering-the-lightning-network."
    ],
    [
        "books-lnbook-who",
        "Who wrote Mastering the Lightning Network?",
        "Andreas Antonopoulos, Olaoluwa Osuntokun, and Rene Pickhardt wrote it, and it came out in 2021. You can read it free at github.com/lnbook/lnbook.",
        [
            "books",
            "layer-2-lightning",
            "developers"
        ],
        "Author line from btcbooks.org and the repo."
    ],
    [
        "books-lnbook-start",
        "How does Mastering the Lightning Network start?",
        "After the introduction, a chapter called Getting Started precedes How the Lightning Network Works and Lightning Node Software. Those are the book's on-ramp before channel and routing chapters. You can read them free at github.com/lnbook/lnbook.",
        [
            "books",
            "layer-2-lightning",
            "developers"
        ],
        "Headings: Getting Started; How the Lightning Network Works; Lightning Node Software."
    ],
    [
        "books-lnbook-node",
        "What does the Lightning book say about running a node?",
        "One chapter is Operating a Lightning Network Node, and another is Lightning Network Architecture. They describe software you run, not a hosted account. You can read it at github.com/lnbook/lnbook.",
        [
            "books",
            "layer-2-lightning",
            "nodes"
        ],
        "Headings from 05_node_operations and 06_lightning_architecture."
    ],
    [
        "books-lnbook-channels",
        "How does the Lightning book explain payment channels?",
        "A chapter titled Payment Channels explains the two-party channel, and a later chapter covers channel operation and payment forwarding. Routing across many channels is its own chapter. You can read it free at github.com/lnbook/lnbook.",
        [
            "books",
            "layer-2-lightning",
            "developers"
        ],
        "Headings: Payment Channels; Channel Operation and Payment Forwarding; Routing on a Network of Payment Channels."
    ],
    [
        "books-lnbook-onion",
        "What is onion routing in the Lightning book?",
        "The book has a chapter titled Onion Routing, which is how a Lightning payment hides the path from the nodes in the middle. Gossip and the channel graph, and pathfinding, are separate chapters. You can read them free at github.com/lnbook/lnbook.",
        [
            "books",
            "layer-2-lightning",
            "privacy-nonkyc"
        ],
        "Headings: Onion Routing; Gossip and the Channel Graph; Pathfinding and Payment Delivery."
    ],
    [
        "books-lnbook-protocol",
        "Does Mastering the Lightning Network cover the protocol?",
        "Later chapters include the wire protocol, Lightning's encrypted message transport, and Lightning payment requests. Those are the format, the encryption of messages, and the invoice a payer uses. You can read them free at github.com/lnbook/lnbook.",
        [
            "books",
            "layer-2-lightning",
            "developers"
        ],
        "Headings: Wire Protocol: Framing and Extensibility; Lightning's Encrypted Message Transport; Lightning Payment Requests."
    ],
    [
        "books-lnbook-privacy",
        "What does the Lightning book say about privacy?",
        "A chapter is titled Security and Privacy of the Lightning Network. You can read it free at github.com/lnbook/lnbook.",
        [
            "books",
            "layer-2-lightning",
            "privacy-nonkyc"
        ],
        "16_security_privacy_ln.asciidoc heading."
    ],
    [
        "books-21-lessons",
        "What is 21 Lessons by Gigi?",
        "21 Lessons is Gigi's book, grown out of the essay series What I've Learned From Bitcoin. It has 21 lessons in three parts: philosophy, economics, and technology. You can read it free at 21lessons.com.",
        [
            "books",
            "philosophy",
            "curriculum"
        ],
        "21lessons.com/toc (fetched 2026-10-27) lists the three parts and 21 lesson titles. Site footer CC BY-SA 4.0 per the catalog."
    ],
    [
        "books-21-philosophy",
        "What is in the philosophy part of 21 Lessons?",
        "Part one is seven lessons: immutability and change, the scarcity of scarcity, replication and locality, the problem of identity, an immaculate conception, the power of free speech, and the limits of knowledge. Those are the lesson titles. You can read them free at 21lessons.com.",
        [
            "books",
            "philosophy",
            "curriculum"
        ],
        "21lessons.com/toc lessons 1-7."
    ],
    [
        "books-21-economics",
        "What is in the economics part of 21 Lessons?",
        "Part two runs from financial ignorance, inflation, value, and money through the history and downfall of money, fractional reserve, and sound money. You can read those lessons free at 21lessons.com.",
        [
            "books",
            "philosophy",
            "problems-of-money"
        ],
        "21lessons.com/toc lessons 8-14."
    ],
    [
        "books-21-tech",
        "What is in the technology part of 21 Lessons?",
        "Part three covers strength in numbers, a reflection on don't trust verify, telling time takes work, move slowly and don't break things, privacy is not dead, cypherpunks write code, and metaphors for Bitcoin's future. You can read them free at 21lessons.com.",
        [
            "books",
            "philosophy",
            "developers"
        ],
        "21lessons.com/toc lessons 15-21."
    ],
    [
        "books-21-immutability",
        "What is the immutability lesson in 21 Lessons?",
        "Lesson 1 is titled Immutability and change. It is the opening philosophy lesson, about what Bitcoin makes hard to alter and what still changes around it. You can read it at 21lessons.com.",
        [
            "books",
            "philosophy",
            "curriculum"
        ],
        "21lessons.com/toc lesson 1 title."
    ],
    [
        "books-21-scarcity",
        "What is the scarcity lesson in 21 Lessons?",
        "Lesson 2 is titled The scarcity of scarcity. It sits in the philosophy part, before the economics lessons on inflation and sound money. You can read it free at 21lessons.com.",
        [
            "books",
            "philosophy",
            "scarce"
        ],
        "21lessons.com/toc lesson 2 title."
    ],
    [
        "books-21-immaculate",
        "What is the immaculate conception lesson in 21 Lessons?",
        "Lesson 5 is titled An immaculate conception. In this book that phrase is about how Bitcoin was launched, with no company and no premine in the lesson title. You can read it free at 21lessons.com.",
        [
            "books",
            "philosophy",
            "history"
        ],
        "21lessons.com/toc lesson 5 title. Entry describes the title, not a paraphrase of the essay."
    ],
    [
        "books-21-inflation",
        "What does 21 Lessons say about inflation?",
        "Lesson 9 is titled Inflation, in the economics part, near lessons on value, money, and sound money. You can read it free at 21lessons.com.",
        [
            "books",
            "philosophy",
            "problems-of-money"
        ],
        "21lessons.com/toc lesson 9."
    ],
    [
        "books-21-verify",
        "What does 21 Lessons say about don't trust, verify?",
        "Lesson 16 is titled Reflections on Don't Trust, Verify, in the technology part. The phrase means checking the chain yourself instead of trusting a screenshot. You can read it at 21lessons.com.",
        [
            "books",
            "philosophy",
            "nodes"
        ],
        "21lessons.com/toc lesson 16 title."
    ],
    [
        "books-21-privacy",
        "What does 21 Lessons say about privacy?",
        "Lesson 19 is titled Privacy is not dead, and lesson 20 is Cypherpunks write code. They are the technology-part lessons on privacy and on the people who wrote the tools. You can read both free at 21lessons.com.",
        [
            "books",
            "philosophy",
            "privacy-nonkyc"
        ],
        "21lessons.com/toc lessons 19 and 20."
    ],
    [
        "books-21-audio",
        "Is there an audio version of 21 Lessons?",
        "Guy Swann reads the book, and the contents page has the audio link. You can start free at 21lessons.com.",
        [
            "books",
            "philosophy",
            "curriculum"
        ],
        "21lessons.com/toc: Read by Guy Swann, HTML5 audio."
    ],
    [
        "books-21-parts",
        "How is 21 Lessons organized?",
        "A preface, an introduction, three chapters, and a conclusion. Chapter I is philosophy, chapter II is economics, and chapter III is technology, with 21 numbered lessons inside them. The contents page is at 21lessons.com.",
        [
            "books",
            "philosophy",
            "curriculum"
        ],
        "21lessons.com/toc structure."
    ],
    [
        "books-programming-bitcoin",
        "What is Programming Bitcoin about?",
        "Programming Bitcoin by Jimmy Song shows a programmer how to build a Bitcoin library from scratch. The chapter titles run from finite fields and elliptic curves through transactions, script, blocks, networking, and Segwit. You can read it free at github.com/jimmysong/programmingbitcoin.",
        [
            "books",
            "developers",
            "cryptography"
        ],
        "Chapter headings from ch01-ch14 asciidoc on the repo. README license CC BY-NC-ND 4.0 per the catalog. No quotations."
    ],
    [
        "books-programming-math",
        "What math does Programming Bitcoin start with?",
        "The first chapters are Finite Fields, Elliptic Curves, and Elliptic Curve Cryptography. They are the math the later transaction chapters use. You can read the book free at github.com/jimmysong/programmingbitcoin.",
        [
            "books",
            "developers",
            "math"
        ],
        "ch01 Finite Fields, ch02 Elliptic Curves, ch03 Elliptic Curve Cryptography."
    ],
    [
        "books-programming-tx",
        "How does Programming Bitcoin treat transactions?",
        "Chapters titled Transactions, Script, Transaction Creation and Validation, and Pay-to-Script Hash are the middle of the book. Serialization is the chapter just before transactions. You can read them free at github.com/jimmysong/programmingbitcoin.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "ch04 Serialization, ch05 Transactions, ch06 Script, ch07 Transaction Creation and Validation, ch08 Pay-to-Script Hash."
    ],
    [
        "books-programming-blocks",
        "What do the later Programming Bitcoin chapters cover?",
        "After transactions, the chapters are Blocks, Networking, Simplified Payment Verification, Bloom Filters, Segwit, and Advanced Topics and Next Steps. That is the path from a block to how a light client hears about it. You can read it at github.com/jimmysong/programmingbitcoin.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "ch09 through ch14 headings."
    ],
    [
        "books-programming-license",
        "Can I reuse code from Programming Bitcoin?",
        "You can read Programming Bitcoin free at github.com/jimmysong/programmingbitcoin. The authors allow reading, and they do not allow selling a rewritten copy.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "Catalog license note: CC BY-NC-ND 4.0 (README)."
    ],
    [
        "books-grokking",
        "What is Grokking Bitcoin about?",
        "Grokking Bitcoin by Kalle Rosenbaum is an illustrated guide to how Bitcoin works. Chapter files cover hashes and signatures, addresses, wallets, transactions, the chain, proof of work, the peer network, Segwit, and upgrades. You can read it free at github.com/kallerosenbaum/grokkingbitcoin.",
        [
            "books",
            "developers",
            "curriculum"
        ],
        "Repo filenames ch01 through ch11. LICENSE CC BY-NC-SA 4.0. btcbooks.org/grokking-bitcoin."
    ],
    [
        "books-grokking-early",
        "What do the early Grokking Bitcoin chapters cover?",
        "They are an introduction, then hash functions and signatures, addresses, and wallets. The book builds one picture at a time before it reaches blocks. You can read it free at github.com/kallerosenbaum/grokkingbitcoin.",
        [
            "books",
            "developers",
            "cryptography"
        ],
        "Filenames: ch01-introduction-to-bitcoin, ch02-hash-functions-and-signatures, ch03-addresses, ch04-wallets."
    ],
    [
        "books-grokking-chain",
        "How does Grokking Bitcoin explain the chain?",
        "Middle chapters are transactions, the blockchain, and proof of work, then the peer-to-peer network. A later chapter returns to transactions, which is why one file is named transactions revisited. It's available at github.com/kallerosenbaum/grokkingbitcoin.",
        [
            "books",
            "developers",
            "mining"
        ],
        "ch05 transactions, ch06 the blockchain, ch07 proof of work, ch08 peer-to-peer, ch09 transactions revisited."
    ],
    [
        "books-grokking-segwit",
        "Does Grokking Bitcoin cover Segwit?",
        "Yes. A chapter file is segregated witness, and the following one is Bitcoin upgrades. They come after the reader has seen transactions and proof of work. You can read both free at github.com/kallerosenbaum/grokkingbitcoin.",
        [
            "books",
            "developers",
            "soft_vs_hard_forks"
        ],
        "ch10-segregated-witness and ch11-bitcoin-upgrades."
    ],
    [
        "books-blocksize",
        "What is The Blocksize War book about?",
        "The Blocksize War, by Jonathan Bier, is a history of Bitcoin's fight over the block data limit from August 2015 to November 2017. The surface issue was how much data a block may hold, and the deeper issue was who sets the rules. The chapters came out weekly on the BitMEX Research blog from 22 March 2021, and you can read them free at farside.co.uk/the-blocksize-war-chapter-1-first-strike/.",
        [
            "books",
            "history",
            "block_time-block-size"
        ],
        "farside.co.uk/the-blocksize-war/ book synopsis, 15 Mar 2021. btcbooks.org/the-blocksize-war."
    ],
    [
        "books-blocksize-xt",
        "How does The Blocksize War describe the start?",
        "Chapter 1 is titled First Strike. It dates the break to August 15, 2015, when Mike Hearn released, and Gavin Andresen backed, an incompatible client called Bitcoin XT. You can read that chapter free at farside.co.uk/the-blocksize-war-chapter-1-first-strike/.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "Author's free chapter 1 on farside.co.uk. Own-words summary of the opening facts only."
    ],
    [
        "books-blocksize-users",
        "Who decided the blocksize war, according to the book?",
        "Bier's closing chapter, Victory, says end users had to opt in before a rule change stuck, and that miners and companies meeting in private could not force it. He dates the end to November 8, 2017, when the SegWit2x plan was dropped. You can read it at farside.co.uk/the-blocksize-war-chapter-21-victory/.",
        [
            "books",
            "history",
            "governance"
        ],
        "Free chapter 21, Victory, on farside.co.uk. Summary, not a quotation."
    ],
    [
        "books-blocksize-proposals",
        "Which proposals does The Blocksize War cover?",
        "The Victory chapter names Bitcoin XT, Bitcoin Classic, and Bitcoin Unlimited as proposals that fell, and it treats SegWit2x as the plan withdrawn in November 2017. The book is a chronology of those fights. You can start the chapters free at farside.co.uk/the-blocksize-war-chapter-1-first-strike/.",
        [
            "books",
            "history",
            "soft_vs_hard_forks"
        ],
        "Chapter 21 names XT, Classic, Unlimited, and the SegWit2x withdrawal."
    ],
    [
        "books-blocksize-read",
        "Where can I read The Blocksize War for free?",
        "Jonathan Bier published all 21 chapters weekly on the BitMEX Research blog from 22 March 2021. Farside hosts them now, and the old BitMEX blog no longer shows the chapter text. You can read the first chapter at farside.co.uk/the-blocksize-war-chapter-1-first-strike/.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "Chapters published weekly on the BitMEX Research blog from 22 March 2021. Farside hosts them at https://farside.co.uk/the-blocksize-war-chapter-1-first-strike/. The BitMEX blog URL now serves a wind-down homepage (checked 2026-10-27)."
    ],
    [
        "books-blocksize-rules",
        "What deeper question does The Blocksize War ask?",
        "Bier writes that a fight about block space exposed who is allowed to change Bitcoin's rules. His account includes conversations with people on both sides. You can start the chapters at farside.co.uk/the-blocksize-war-chapter-1-first-strike/.",
        [
            "books",
            "history",
            "governance"
        ],
        "Author synopsis on farside.co.uk/the-blocksize-war/."
    ],
    [
        "books-mastering-history",
        "What does Mastering Bitcoin say about Bitcoin's history?",
        "The introduction chapter includes a heading History of Bitcoin. It is the book's short account of how the system started, before the how-it-works chapter. You can read it free at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "ch01_intro.adoc heading: History of Bitcoin."
    ],
    [
        "books-mastering-start",
        "What does Getting Started cover in Mastering Bitcoin?",
        "Getting Started is a heading in the introduction, and it points a new reader at a wallet before the later chapters explain keys. The same chapter also contrasts full nodes with lightweight clients. You can read it at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "ch01 headings: Getting Started, and the full-node versus lightweight discussion."
    ],
    [
        "books-mastering-signatures",
        "What does Mastering Bitcoin say about digital signatures?",
        "A chapter is titled Digital Signatures. It follows Authorization and Authentication, which is the book's script chapter. You can read both free at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "ch08_signatures.adoc heading: Digital Signatures."
    ],
    [
        "books-mastering-chain",
        "What is the blockchain chapter in Mastering Bitcoin?",
        "The chapter The Blockchain follows The Bitcoin Network. It is the book's account of how blocks are chained, separate from the mining chapter. You can read it free at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "ch11 heading: The Blockchain."
    ],
    [
        "books-mastering-hd",
        "What does Mastering Bitcoin say about hierarchical keys?",
        "Inside the wallet chapter, a heading covers hierarchical deterministic keys from BIP32, under the top heading Wallet Recovery. It also covers seeds and recovery codes. You can read it at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "self-custody",
            "developers"
        ],
        "ch05 headings: HD Key Generation (BIP32); Seeds and Recovery Codes."
    ],
    [
        "books-mastering-nodes",
        "Does Mastering Bitcoin explain full nodes and light clients?",
        "The introduction contrasts a full node, which checks the chain, with a lightweight client. Later chapters return to the network those nodes form. You can see it at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "nodes",
            "developers"
        ],
        "ch01 discussion of full nodes versus lightweight clients."
    ],
    [
        "books-lnbook-how",
        "Which chapter explains how the Lightning Network works?",
        "How the Lightning Network Works is an early chapter, after Getting Started and before the node-software chapter. It is the book's overview before payment channels get their own chapter. You can read it free at github.com/lnbook/lnbook.",
        [
            "books",
            "layer-2-lightning",
            "developers"
        ],
        "Heading: How the Lightning Network Works."
    ],
    [
        "books-lnbook-software",
        "Which Lightning software does the Lightning book discuss?",
        "A chapter is titled Lightning Node Software. It sits near Operating a Lightning Network Node, and it is about software you run. You can read it at github.com/lnbook/lnbook.",
        [
            "books",
            "layer-2-lightning",
            "nodes"
        ],
        "Heading: Lightning Node Software."
    ],
    [
        "books-lnbook-routing",
        "How does the Lightning book explain routing?",
        "A chapter covers routing on a network of payment channels, separate from the chapter on a single channel. Onion routing and pathfinding are later chapters. You can read them free at github.com/lnbook/lnbook.",
        [
            "books",
            "layer-2-lightning",
            "developers"
        ],
        "Heading: Routing on a Network of Payment Channels."
    ],
    [
        "books-lnbook-gossip",
        "What is the channel graph in the Lightning book?",
        "The book has a chapter titled Gossip and the Channel Graph. That graph is how nodes learn which channels exist so a payment can be routed. You can read it at github.com/lnbook/lnbook.",
        [
            "books",
            "layer-2-lightning",
            "developers"
        ],
        "Heading: Gossip and the Channel Graph."
    ],
    [
        "books-lnbook-path",
        "How does the Lightning book explain pathfinding?",
        "Pathfinding and Payment Delivery is its own chapter, after onion routing and the channel graph. It is about choosing a route, not about mining a block. You can read it free at github.com/lnbook/lnbook.",
        [
            "books",
            "layer-2-lightning",
            "developers"
        ],
        "Heading: Pathfinding and Payment Delivery."
    ],
    [
        "books-lnbook-invoice",
        "What is a Lightning payment request in the book?",
        "A later chapter is Lightning Payment Requests, the invoice a payer uses. It sits near the wire protocol and the encrypted message transport. You can read them free at github.com/lnbook/lnbook.",
        [
            "books",
            "layer-2-lightning",
            "developers"
        ],
        "Heading: Lightning Payment Requests."
    ],
    [
        "books-lnbook-intro",
        "Does Mastering the Lightning Network have an introduction?",
        "The repo opens with an introduction chapter before Getting Started, and it closes with a conclusion. The working chapters in between cover channels, routing, and security. It's available at github.com/lnbook/lnbook.",
        [
            "books",
            "layer-2-lightning",
            "developers"
        ],
        "Repo files 01 introduction and 17 conclusion."
    ],
    [
        "books-programming-serialize",
        "What is the serialization chapter in Programming Bitcoin?",
        "Serialization is the chapter before Transactions. It is where the book shows how Bitcoin objects are turned into bytes. You can read it at in github.com/jimmysong/programmingbitcoin.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "ch04 heading: Serialization."
    ],
    [
        "books-programming-script",
        "What is the Script chapter in Programming Bitcoin?",
        "A chapter is titled Script. It comes after Transactions and before Transaction Creation and Validation. You can read it free at github.com/jimmysong/programmingbitcoin.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "ch06 heading: Script."
    ],
    [
        "books-programming-p2sh",
        "What is pay-to-script-hash in Programming Bitcoin?",
        "Pay-to-Script Hash is a chapter title in the middle of the book, after the script and validation chapters. It is one way a spending condition can be written. You can read it at github.com/jimmysong/programmingbitcoin.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "ch08 heading: Pay-to-Script Hash."
    ],
    [
        "books-programming-spv",
        "What does Programming Bitcoin say about light clients?",
        "Simplified Payment Verification is a chapter after Networking and before Bloom Filters. It is the book's treatment of a light client that does not store every block. You can read it free at github.com/jimmysong/programmingbitcoin.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "ch11 heading: Simplified Payment Verification."
    ],
    [
        "books-programming-bloom",
        "Why does Programming Bitcoin have a Bloom Filters chapter?",
        "Bloom Filters is the chapter after Simplified Payment Verification. In this book it is part of how a light client asks for transactions. You can read it at github.com/jimmysong/programmingbitcoin.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "ch12 heading: Bloom Filters."
    ],
    [
        "books-programming-segwit",
        "Does Programming Bitcoin cover witness data?",
        "Yes. Segwit is a late chapter, before Advanced Topics and Next Steps. You can read it free at github.com/jimmysong/programmingbitcoin.",
        [
            "books",
            "developers",
            "soft_vs_hard_forks"
        ],
        "ch13 heading: Segwit."
    ],
    [
        "books-grokking-hash",
        "What does Grokking Bitcoin say about hash functions?",
        "An early chapter file is hash functions and signatures. It comes after the introduction and before addresses and wallets. You can read it free at github.com/kallerosenbaum/grokkingbitcoin.",
        [
            "books",
            "developers",
            "cryptography"
        ],
        "Filename ch02-hash-functions-and-signatures."
    ],
    [
        "books-grokking-wallets",
        "What does Grokking Bitcoin say about wallets?",
        "The wallets chapter follows the addresses chapter. Both are early, before the book draws the chain. You can read them free at github.com/kallerosenbaum/grokkingbitcoin.",
        [
            "books",
            "self-custody",
            "developers"
        ],
        "Filenames ch03-addresses and ch04-wallets."
    ],
    [
        "books-grokking-pow",
        "How does Grokking Bitcoin explain proof of work?",
        "Proof of work is its own chapter, after the blockchain chapter and before the peer-to-peer chapter. It is a picture of mining, not a pool manual. You can read it at github.com/kallerosenbaum/grokkingbitcoin.",
        [
            "books",
            "mining",
            "developers"
        ],
        "Filename ch07-proof-of-work."
    ],
    [
        "books-grokking-p2p",
        "What does Grokking Bitcoin say about the peer network?",
        "A chapter file covers the peer-to-peer network, after proof of work and before transactions revisited. It is how the book shows nodes passing data. You can read it free at github.com/kallerosenbaum/grokkingbitcoin.",
        [
            "books",
            "nodes",
            "developers"
        ],
        "Filename ch08 peer-to-peer."
    ],
    [
        "books-grokking-upgrades",
        "What does Grokking Bitcoin say about upgrades?",
        "The last chapter file is Bitcoin upgrades, after segregated witness. It is the book's place for how the rules have changed. You can read it at github.com/kallerosenbaum/grokkingbitcoin.",
        [
            "books",
            "developers",
            "soft_vs_hard_forks"
        ],
        "Filename ch11-bitcoin-upgrades."
    ],
    [
        "books-grokking-tx2",
        "Why does Grokking Bitcoin revisit transactions?",
        "A chapter file is named transactions revisited, after the peer-to-peer chapter and before segregated witness. The first transactions chapter comes earlier. You can read both free at github.com/kallerosenbaum/grokkingbitcoin.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "Filename ch09 transactions revisited."
    ],
    [
        "books-blocksize-dates",
        "When did the blocksize fight happen, according to Bier?",
        "Bier's synopsis dates the fight from August 2015 to November 2017. Chapter 1 starts on August 15, 2015, and the Victory chapter ends on November 8, 2017. You can read the pages at farside.co.uk/the-blocksize-war/.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "Synopsis plus chapter 1 and chapter 21 dates on farside.co.uk."
    ],
    [
        "books-blocksize-count",
        "How many chapters does The Blocksize War have?",
        "The book has 21 chapters. They were published weekly on the BitMEX Research blog from 22 March 2021, and Farside hosts them now. You can read the first chapter at farside.co.uk/the-blocksize-war-chapter-1-first-strike/.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "BitMEX Research blog, weekly from 22 March 2021. Farside copy: https://farside.co.uk/the-blocksize-war-chapter-1-first-strike/."
    ],
    [
        "books-blocksize-surface",
        "What was the surface issue in The Blocksize War?",
        "The author's synopsis says the surface argument was how much data a block may hold. He says the deeper argument was who sets the protocol rules. You can read that at farside.co.uk/the-blocksize-war/.",
        [
            "books",
            "history",
            "block_time-block-size"
        ],
        "Author synopsis on farside.co.uk/the-blocksize-war/."
    ],
    [
        "books-21-identity",
        "What is the identity lesson in 21 Lessons?",
        "Lesson 4 is titled The problem of identity. It sits in the philosophy part, between replication and locality and the immaculate conception. You can read it at 21lessons.com.",
        [
            "books",
            "philosophy",
            "curriculum"
        ],
        "21lessons.com/toc lesson 4 title."
    ],
    [
        "books-21-speech",
        "What does 21 Lessons say about free speech?",
        "Lesson 6 is titled The power of free speech. It sits in the philosophy part. You can read it free at 21lessons.com.",
        [
            "books",
            "philosophy",
            "curriculum"
        ],
        "21lessons.com/toc lesson 6 title."
    ],
    [
        "books-21-sound",
        "What does 21 Lessons say about sound money?",
        "Sound money is one of the economics-part lesson titles, near fractional reserve and the history and downfall of money. You can read it free at 21lessons.com.",
        [
            "books",
            "philosophy",
            "money"
        ],
        "21lessons.com/toc economics-part titles."
    ],
    [
        "books-21-cypherpunks",
        "What does 21 Lessons say about cypherpunks?",
        "Lesson 20 is titled Cypherpunks write code. It follows Privacy is not dead in the technology part. You can read it at 21lessons.com.",
        [
            "books",
            "philosophy",
            "developers"
        ],
        "21lessons.com/toc lesson 20 title."
    ],
    [
        "books-softwar",
        "What is the Softwar thesis by Jason Lowery?",
        "Softwar is Jason Lowery's 2023 MIT thesis, later also sold as a book. He argues that proof of work can impose a physical cost in cyberspace, which he calls a form of power projection, and that analysts who only use a money frame will miss that. You can read the thesis free at hdl.handle.net/1721.1/153030.",
        [
            "books",
            "softwar",
            "research-theses"
        ],
        "MIT thesis PDF title page and abstract, CC BY 4.0, handle 1721.1/153030. Own-words summary of the abstract. btcbooks.org/softwar."
    ],
    [
        "books-softwar-who",
        "Who wrote the Softwar thesis?",
        "Jason Lowery wrote it for MIT's System Design and Management program, with Joan Rubin as advisor, dated February 2023. He had earlier degrees from the Air Force Institute of Technology and Baylor, as the title page states. You can read the thesis at hdl.handle.net/1721.1/153030.",
        [
            "books",
            "softwar",
            "research-theses"
        ],
        "Thesis title page, February 2023."
    ],
    [
        "books-softwar-name",
        "What does the word softwar mean in Lowery's thesis?",
        "Lowery uses softwar for the idea that proof of work lets a defender impose severe physical costs through cyberspace, not only for a payments app. The abstract calls the deliverable a theory, Power Projection Theory, rather than a finished policy. You can read the abstract at hdl.handle.net/1721.1/153030.",
        [
            "books",
            "softwar",
            "research-theses"
        ],
        "Abstract: Power Projection Theory and the softwar tactic. Paraphrase of the idea, not a quote."
    ],
    [
        "books-softwar-license",
        "Where is the legal free copy of Softwar?",
        "You can read the Softwar thesis free at hdl.handle.net/1721.1/153030. That file is the MIT copy.",
        [
            "books",
            "softwar",
            "research-theses"
        ],
        "dspace.mit.edu handle 1721.1/153030. Title page: CC BY 4.0."
    ],
    [
        "books-softwar-debate",
        "Is the Softwar thesis settled doctrine?",
        "No. It is one officer's master's thesis arguing that national-security readers should study proof of work as more than money. Readers disagree with the frame, and the thesis invites that argument. You can read it at hdl.handle.net/1721.1/153030.",
        [
            "books",
            "softwar",
            "geopolitics___macroeconomics"
        ],
        "Abstract states the goal is an alternate frame for researchers and policy. Debate noted as reception, not as a fact inside the thesis."
    ],
    [
        "books-softwar-book",
        "Is the Softwar book the same as the thesis?",
        "A 2023 book edition is a separate retail object from the thesis. The free document is the MIT thesis. You can read the thesis at hdl.handle.net/1721.1/153030.",
        [
            "books",
            "softwar",
            "research-theses"
        ],
        "btcbooks.org/softwar retail listing versus MIT handle."
    ],
    [
        "books-politics-bitcoin",
        "What is The Politics of Bitcoin about?",
        "The Politics of Bitcoin, by David Golumbia, came out in 2016 from the University of Minnesota Press in the Forerunners series. The book argues that much Bitcoin politics draws on cyberlibertarian and right-wing ideas, including economists and central-bank conspiracies. It's available at https://www.upress.umn.edu/9781517901806/the-politics-of-bitcoin/.",
        [
            "books",
            "politics",
            "history"
        ],
        "Publisher page https://www.upress.umn.edu/9781517901806/the-politics-of-bitcoin/ description and TOC, fetched 2026-10-27. No free full text confirmed on the publisher site. Not a pirate PDF."
    ],
    [
        "books-politics-who",
        "Who wrote The Politics of Bitcoin?",
        "David Golumbia wrote it. The press page notes that he taught at Virginia Commonwealth University and lived from 1963 to 2023. The book is his critique of Bitcoin politics. It's available at https://www.upress.umn.edu/9781517901806/the-politics-of-bitcoin/.",
        [
            "books",
            "politics",
            "philosophy"
        ],
        "Publisher author note."
    ],
    [
        "books-politics-chapters",
        "What chapters are in The Politics of Bitcoin?",
        "The press lists six chapters: Bitcoin and digital culture and right-wing politics, central banking and inflation, an overview of Bitcoin, central-banking conspiracy theories, software as a political program, and the future of Bitcoin and the blockchain. It's available at https://www.upress.umn.edu/9781517901806/the-politics-of-bitcoin/.",
        [
            "books",
            "politics",
            "misconceptions-fud"
        ],
        "Publisher table of contents."
    ],
    [
        "books-politics-free",
        "Is The Politics of Bitcoin free to read?",
        "The Politics of Bitcoin is a paid book. The University of Minnesota Press page is https://www.upress.umn.edu/9781517901806/the-politics-of-bitcoin/.",
        [
            "books",
            "politics",
            "curriculum"
        ],
        "Project MUSE page: Open Access No. Publisher catalog page is the legal link used here."
    ],
    [
        "books-cryptoeconomics",
        "What is Cryptoeconomics by Eric Voskuil?",
        "Cryptoeconomics by Eric Voskuil is a dense set of short chapters on Bitcoin and economic ideas, and the author says it is not a beginner book. You can read his free PDF at voskuil.org/cryptoeconomics/cryptoeconomics.pdf.",
        [
            "books",
            "developers",
            "austrian_school_of_economics"
        ],
        "Author PDF URL from the catalog. Blurb: dense, not for the uninitiated, all rights reserved. No quotations from the PDF."
    ],
    [
        "books-cryptoeconomics-who",
        "Who wrote Cryptoeconomics?",
        "Eric Voskuil wrote it, and it came out in 2021. You can read his free PDF at voskuil.org/cryptoeconomics/cryptoeconomics.pdf.",
        [
            "books",
            "austrian_school_of_economics",
            "developers"
        ],
        "btcbooks.org/cryptoeconomics."
    ],
    [
        "books-cryptoeconomics-level",
        "Is Cryptoeconomics a beginner book?",
        "The book is not for a first reader, and it does not repeat itself. A gentler book is a better start if the terms are new. You can still read his PDF at voskuil.org/cryptoeconomics/cryptoeconomics.pdf.",
        [
            "books",
            "curriculum",
            "austrian_school_of_economics"
        ],
        "Catalog blurb, own words."
    ],
    [
        "books-cryptoeconomics-rights",
        "Can I republish the Cryptoeconomics PDF?",
        "You can read the free PDF at voskuil.org/cryptoeconomics/cryptoeconomics.pdf. The author kept the rights, so share his link rather than posting your own copy.",
        [
            "books",
            "free_and_open_source_software__foss",
            "developers"
        ],
        "Catalog license note: free PDF, all rights reserved."
    ],
    [
        "books-cryptoeconomics-focus",
        "What field is Cryptoeconomics in?",
        "The title joins cryptography-based money to economics, and it assumes the reader knows Austrian economics. It is a Bitcoin book, not a guide to other tokens. You can read the PDF at voskuil.org/cryptoeconomics/cryptoeconomics.pdf.",
        [
            "books",
            "austrian_school_of_economics",
            "philosophy"
        ],
        "Title and catalog blurb."
    ],
    [
        "books-venice",
        "What is Bitcoin Is Venice about?",
        "Bitcoin Is Venice, by Allen Farrington and Sacha Meyers, is a 2022 book of essays that moves from a broken fiat system toward Bitcoin. You can read their free PDF at uncerto.com/book.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "uncerto.com/book author page. Catalog: free PDF, non-commercial. btcbooks.org/bitcoin-is-venice."
    ],
    [
        "books-venice-who",
        "Who wrote Bitcoin Is Venice?",
        "Allen Farrington and Sacha Meyers wrote it. A paid edition also exists. You can read the free PDF at uncerto.com/book.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-is-venice authors. uncerto.com/book returned 200 on 2026-10-27. The old /book-pdf path did not."
    ],
    [
        "books-venice-free",
        "Is Bitcoin Is Venice free?",
        "Yes. The authors offer a free PDF for your own reading at uncerto.com/book. They do not allow selling copies.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "Catalog license note and the live author URL."
    ],
    [
        "books-venice-idea",
        "What idea does Bitcoin Is Venice argue?",
        "The book tours errors in modern economic theory and in the fiat system, and it treats Bitcoin as the hopeful end of that tour. The Venice of the title is the authors' image. You can read the free PDF at uncerto.com/book.",
        [
            "books",
            "money",
            "austrian_school_of_economics"
        ],
        "Catalog blurb, rewritten. No chapter text copied."
    ],
    [
        "books-inventing",
        "What is Inventing Bitcoin by Yan Pritzker?",
        "Inventing Bitcoin is Yan Pritzker's short 2019 explanation of how Bitcoin was invented, for a reader with no technical background. You can read it free at swanbitcoin.com/inventing-bitcoin/.",
        [
            "books",
            "curriculum",
            "history"
        ],
        "swanbitcoin.com/inventing-bitcoin/ (200 on 2026-10-27). btcbooks.org/inventing-bitcoin subtitle and blurb."
    ],
    [
        "books-inventing-who",
        "Who wrote Inventing Bitcoin?",
        "Yan Pritzker wrote it in 2019. The subtitle says it explains the technology behind the first truly scarce and decentralized money. You can read it free at swanbitcoin.com/inventing-bitcoin/.",
        [
            "books",
            "curriculum",
            "scarce"
        ],
        "btcbooks.org/inventing-bitcoin."
    ],
    [
        "books-inventing-path",
        "How is Inventing Bitcoin organized?",
        "It walks through the invention step by step, and it can be read in about two hours. You can start free at swanbitcoin.com/inventing-bitcoin/.",
        [
            "books",
            "curriculum",
            "developers"
        ],
        "Catalog blurb: step by step, short read, no technical expertise required."
    ],
    [
        "books-inventing-free",
        "Is Inventing Bitcoin free?",
        "Yes. Swan hosts a free copy, and that page also notes an audio option. You can read it at swanbitcoin.com/inventing-bitcoin/.",
        [
            "books",
            "curriculum",
            "one-stop-shop"
        ],
        "Publisher page. Books channel post also points at this URL."
    ],
    [
        "books-inventing-level",
        "Do I need to code to read Inventing Bitcoin?",
        "No technical expertise is required. It is an introduction, not Mastering Bitcoin. You can read it at swanbitcoin.com/inventing-bitcoin/.",
        [
            "books",
            "curriculum",
            "faq"
        ],
        "Catalog blurb."
    ],
    [
        "books-inventing-share",
        "Can I share Inventing Bitcoin?",
        "The book invites you to share it, and Swan hosts the file. You can send people to swanbitcoin.com/inventing-bitcoin/.",
        [
            "books",
            "curriculum",
            "orange-pilling"
        ],
        "Catalog blurb: read it, then share it."
    ],
    [
        "books-why-strolight",
        "What is Why Bitcoin by Tomer Strolight?",
        "Why Bitcoin? Is Tomer Strolight's 2023 book, free from Swan with the author's blessing. It asks why a person would choose Bitcoin, why it uses energy, and why the author thinks nobody can stop it. You can read it at swanbitcoin.com/whybitcoin/.",
        [
            "books",
            "curriculum",
            "money"
        ],
        "swanbitcoin.com/whybitcoin/ (200). btcbooks.org/why-bitcoin-2023 blurb. Copyrighted; free copy is the publisher page, not a Drive file."
    ],
    [
        "books-why-strolight-energy",
        "Does Tomer Strolight's book ask about energy?",
        "Yes. The book asks why Bitcoin uses energy and why the author thinks it is more than money. You can read his free text at swanbitcoin.com/whybitcoin/.",
        [
            "books",
            "energy",
            "curriculum"
        ],
        "Catalog blurb questions, not a paraphrase of the chapters."
    ],
    [
        "books-why-strolight-stop",
        "Why does Strolight say nobody can stop Bitcoin?",
        "The book itself asks why nobody can stop Bitcoin. No company can switch it off, because many people run the software. You can read his version at swanbitcoin.com/whybitcoin/.",
        [
            "books",
            "decentralized",
            "curriculum"
        ],
        "Listing question plus the ordinary protocol fact that nodes run the rules. Book text not quoted."
    ],
    [
        "books-why-strolight-who",
        "Who wrote the 2023 book Why Bitcoin?",
        "Tomer Strolight wrote the 2023 book Why Bitcoin? A different 2022 book with the same title has no author listed. You can read his free copy at swanbitcoin.com/whybitcoin/.",
        [
            "books",
            "curriculum",
            "history"
        ],
        "btcbooks.org/why-bitcoin-2023 versus skipped slug why-bitcoin."
    ],
    [
        "books-why-strolight-more",
        "Is Strolight's Why Bitcoin only about a price?",
        "The book asks why Bitcoin is more than money, and why the number of users matters. It is not a price prediction. You can read it free at swanbitcoin.com/whybitcoin/.",
        [
            "books",
            "money",
            "orange-pilling"
        ],
        "Catalog blurb."
    ],
    [
        "books-why-strolight-free",
        "Where is the free copy of Why Bitcoin by Strolight?",
        "Why Bitcoin by Tomer Strolight is free to read. Swan hosts that copy at swanbitcoin.com/whybitcoin/.",
        [
            "books",
            "curriculum",
            "one-stop-shop"
        ],
        "Official Swan URL. Drive file in data/R_books.json replaced in this change."
    ],
    [
        "books-simplest",
        "What is The Simplest Bitcoin Book Ever Written?",
        "The Simplest Bitcoin Book Ever Written, by Keysa Luna, is a short 2022 introduction. You can read it free at thesimplestbitcoinbook.net.",
        [
            "books",
            "curriculum",
            "one-stop-shop"
        ],
        "thesimplestbitcoinbook.net (200). Catalog: free download, non-commercial CC. No buy link in the catalog."
    ],
    [
        "books-simplest-who",
        "Who wrote The Simplest Bitcoin Book?",
        "Keysa Luna wrote it in 2022. It aims at the shortest explanation that still tells the truth. You can read it free at thesimplestbitcoinbook.net.",
        [
            "books",
            "curriculum",
            "orange-pilling"
        ],
        "btcbooks.org/the-simplest-bitcoin-book-ever-written."
    ],
    [
        "books-simplest-free",
        "Is The Simplest Bitcoin Book free?",
        "Yes. You can download it free at thesimplestbitcoinbook.net. The author asks that you not sell copies.",
        [
            "books",
            "curriculum",
            "free_and_open_source_software__foss"
        ],
        "Catalog license note."
    ],
    [
        "books-simplest-level",
        "Who is The Simplest Bitcoin Book for?",
        "It is for a first explanation, not for someone writing wallet software. After it, Mastering Bitcoin is the free technical manual. You can read this book free at thesimplestbitcoinbook.net.",
        [
            "books",
            "curriculum",
            "faq"
        ],
        "Catalog one-line description."
    ],
    [
        "books-genesis",
        "What is The Genesis Book about?",
        "The Genesis Book, by Aaron van Wirdum, came out in 2024. It tells the story of people and projects that tried to build digital money before Bitcoin, and his site says Bitcoin did not appear out of nowhere. You can find the book at thegenesisbook.com.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "thegenesisbook.com description, fetched 2026-10-27. Catalog: treat open-draft CC claim as unverified. No draft text copied. btcbooks.org/the-genesis-book."
    ],
    [
        "books-genesis-who",
        "Who wrote The Genesis Book?",
        "Aaron van Wirdum wrote it. His author page says he studied in Utrecht, found Bitcoin in 2013, and edited Bitcoin Magazine. The book is his first. You can see it at thegenesisbook.com.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "thegenesisbook.com/the-author/."
    ],
    [
        "books-genesis-scope",
        "Does The Genesis Book identify Satoshi?",
        "The author's description is a history of prior projects, not a claim that the book unmasks Satoshi. Benjamin Wallace's later book is the one about that hunt. You can find his book at thegenesisbook.com.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "thegenesisbook.com homepage description. Wallace is a separate btcbooks.org listing."
    ],
    [
        "books-satoshi-book",
        "What is The Book of Satoshi?",
        "The Book of Satoshi, by Phil Champagne, came out in 2014. It collects writings of Satoshi Nakamoto with Champagne's commentary. Satoshi's own posts are free at satoshi.nakamotoinstitute.org.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "btcbooks.org/the-book-of-satoshi. Institute: satoshi.nakamotoinstitute.org. Whitepaper: bitcoin.org/bitcoin.pdf."
    ],
    [
        "books-satoshi-book-who",
        "Who compiled The Book of Satoshi?",
        "Phil Champagne compiled it and wrote the commentary. Satoshi did not publish this book. It's available at amazon.com/dp/0996061371.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "Catalog author and buy link."
    ],
    [
        "books-satoshi-writings",
        "Where are Satoshi's writings free to read?",
        "The Nakamoto Institute hosts Satoshi's forum posts, emails, and a copy of the whitepaper. You can read that archive free at satoshi.nakamotoinstitute.org.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "Catalog free_source https://satoshi.nakamotoinstitute.org. Whitepaper license noted as disputed, so no long quote."
    ],
    [
        "books-satoshi-whitepaper",
        "Where is the Bitcoin whitepaper?",
        "The whitepaper Satoshi posted is the short document at bitcoin.org/bitcoin.pdf. Champagne's book comments on the writings around it.",
        [
            "books",
            "whitepaper",
            "satoshi-nakamoto"
        ],
        "bitcoin.org/bitcoin.pdf. Catalog note: quote briefly, license disputed."
    ],
    [
        "books-satoshi-book-vs-institute",
        "Is The Book of Satoshi identical to the Nakamoto Institute?",
        "No. The institute is a free archive of Satoshi's words. The book adds Champagne's commentary and is sold as a book. You can read it free at satoshi.nakamotoinstitute.org.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "Catalog license note."
    ],
    [
        "books-satoshi-book-year",
        "When was The Book of Satoshi published?",
        "It came out on June 14, 2014, with the subtitle The Collected Writings of Bitcoin Creator Satoshi Nakamoto. The writings themselves start in 2008. It's available at amazon.com/dp/0996061371.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "Catalog date and subtitle."
    ],
    [
        "books-satoshi-book-pdf",
        "Is there a legal free PDF of The Book of Satoshi?",
        "Champagne's commentary is a paid book. Satoshi's own writing is free at the Nakamoto Institute. You can read that archive at satoshi.nakamotoinstitute.org.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "Books channel had a bare 'Book_of_Satoshi.pdf' line with no legal URL. Replaced with the institute."
    ],
    [
        "books-satoshi-book-scope",
        "What does The Book of Satoshi collect?",
        "The subtitle says it collects the writings of Bitcoin's creator. The book is a curated volume plus commentary, so it is not the only place those posts exist. The posts are free at satoshi.nakamotoinstitute.org.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "Subtitle on btcbooks.org."
    ],
    [
        "books-iom",
        "What is The Internet of Money?",
        "The Internet of Money, by Andreas Antonopoulos, came out in 2016. It collects talks about why Bitcoin exists rather than how the code is written. The book is paid, and the talks are free at youtube.com/@aantonop.",
        [
            "books",
            "curriculum",
            "philosophy"
        ],
        "btcbooks.org/the-internet-of-money. youtube.com/@aantonop. Book text not copied."
    ],
    [
        "books-iom-who",
        "Who wrote The Internet of Money?",
        "Andreas Antonopoulos, who also wrote Mastering Bitcoin. This volume is the spoken essays, not the programming manual. You can read it at youtube.com/@aantonop.",
        [
            "books",
            "videos",
            "curriculum"
        ],
        "Catalog author."
    ],
    [
        "books-iom-why",
        "How is The Internet of Money different from Mastering Bitcoin?",
        "Mastering Bitcoin is the how. The Internet of Money is the why, from talks as Bitcoin matured. You can watch the talks without buying the book. You can find them at youtube.com/@aantonop.",
        [
            "books",
            "curriculum",
            "videos"
        ],
        "Catalog blurb contrast of how versus why."
    ],
    [
        "books-iom-2",
        "What is The Internet of Money Volume Two?",
        "Volume Two, from 2017, collects eleven more talks by Andreas Antonopoulos. Most are about Bitcoin and one is about another network. The book is paid, and the talks are free at youtube.com/@aantonop.",
        [
            "books",
            "videos",
            "curriculum"
        ],
        "btcbooks.org/the-internet-of-money-volume-two. Answer avoids naming the other network so a question about this book is not steered away."
    ],
    [
        "books-iom-2-who",
        "Who wrote Internet of Money Volume Two?",
        "Andreas Antonopoulos wrote it, as with the other volumes. It is a collection of talks, not a new protocol. You can watch the talks at youtube.com/@aantonop.",
        [
            "books",
            "videos",
            "philosophy"
        ],
        "Catalog."
    ],
    [
        "books-iom-2-text",
        "Are the Internet of Money books free?",
        "The printed books are paid. The original talks are free on the author's YouTube channel. You can start at youtube.com/@aantonop.",
        [
            "books",
            "videos",
            "one-stop-shop"
        ],
        "Catalog license note for all three volumes."
    ],
    [
        "books-iom-3",
        "What is The Internet of Money Volume Three?",
        "Volume Three, from 2019, is twelve more talks by Andreas Antonopoulos on why Bitcoin exists and why a coin run by a company is not the same thing. The book is paid. You can read it at youtube.com/@aantonop.",
        [
            "books",
            "videos",
            "decentralized"
        ],
        "btcbooks.org/the-internet-of-money-volume-three blurb, rewritten."
    ],
    [
        "books-iom-3-company",
        "What does Internet of Money Volume Three say about company coins?",
        "The talks argue a corporate coin is not a substitute for Bitcoin. A company can freeze an account, and Bitcoin's design does not have that switch. You can read it at youtube.com/@aantonop.",
        [
            "books",
            "decentralized",
            "videos"
        ],
        "Catalog blurb plus the protocol fact of no issuer. Talk text not quoted."
    ],
    [
        "books-bullish",
        "What is The Bullish Case for Bitcoin?",
        "The Bullish Case for Bitcoin is Vijay Boyapati's book, expanded from his 2018 essay. The essay is free, and the 2021 book is paid. The essay argues for Bitcoin as money. You can read the essay at vijayboyapati.medium.com/the-bullish-case-for-bitcoin-6ecc8bdecc1.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "Catalog: 2018 essay URL, 2021 book paid. No price figure copied."
    ],
    [
        "books-bullish-who",
        "Who wrote The Bullish Case for Bitcoin?",
        "Vijay Boyapati wrote the essay and the later book. The book describes him as someone at home in math, computing, and economics. You can read the essay at vijayboyapati.medium.com/the-bullish-case-for-bitcoin-6ecc8bdecc1.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-bullish-case-for-bitcoin."
    ],
    [
        "books-bullish-essay",
        "Is The Bullish Case for Bitcoin free?",
        "The original essay is free, and the book that grew out of it is paid. You can read the essay at vijayboyapati.medium.com/the-bullish-case-for-bitcoin-6ecc8bdecc1.",
        [
            "books",
            "money",
            "articles-threads"
        ],
        "Catalog free_status free_original_essays_or_talks."
    ],
    [
        "books-bullish-not-target",
        "Does the Bullish Case entry name a price?",
        "No. The book argues that Bitcoin matters as money. You can read the essay at vijayboyapati.medium.com/the-bullish-case-for-bitcoin-6ecc8bdecc1.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "House rule: no price targets in book entries."
    ],
    [
        "books-bullish-book",
        "When did the Bullish Case book come out?",
        "It came out on August 16, 2021, after the essay. The essay remains the free original. You can read it at vijayboyapati.medium.com/the-bullish-case-for-bitcoin-6ecc8bdecc1.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "Catalog date."
    ],
    [
        "books-bullish-scope",
        "What kind of book is The Bullish Case for Bitcoin?",
        "It is a monetary argument, not a programming manual and not a trading system. The essay is free, and the book expands it. You can start at vijayboyapati.medium.com/the-bullish-case-for-bitcoin-6ecc8bdecc1.",
        [
            "books",
            "money",
            "austrian_school_of_economics"
        ],
        "Catalog description of the essay as the origin of the book."
    ],
    [
        "books-cyfp",
        "What is Check Your Financial Privilege?",
        "Check Your Financial Privilege, by Alex Gladstein, came out in 2022 and collects essays on Bitcoin and human rights. The title essay argues that people born under a reserve currency hold a privilege others do not. You can read the essay at bitcoinmagazine.com/culture/check-your-financial-privilege.",
        [
            "books",
            "human_rights__social_justice_and_freedo",
            "money"
        ],
        "bitcoinmagazine.com/culture/check-your-financial-privilege. btcbooks.org/check-your-financial-privilege. Own words, no essay quotation."
    ],
    [
        "books-cyfp-who",
        "Who wrote Check Your Financial Privilege?",
        "Alex Gladstein wrote it. There are more of his essays on his own site, separate from the book. You can read the essay at bitcoinmagazine.com/culture/check-your-financial-privilege.",
        [
            "books",
            "human_rights__social_justice_and_freedo",
            "articles-threads"
        ],
        "Catalog: other essays at alexgladstein.org/essays.html. One link in the answer is the title essay."
    ],
    [
        "books-cyfp-privilege",
        "What does financial privilege mean in Gladstein's essay?",
        "A passport and a reserve-currency bank account are advantages most people do not have, and the essay talks about Bitcoin from that position. You can read it at bitcoinmagazine.com/culture/check-your-financial-privilege.",
        [
            "books",
            "human_rights__social_justice_and_freedo",
            "geopolitics___macroeconomics"
        ],
        "Catalog blurb rewritten. Percent figure in the blurb not repeated."
    ],
    [
        "books-cyfp-book",
        "Is the Gladstein book the same as the essay?",
        "The title essay is free, and the book collects more essays and is sold. You can read the essay at bitcoinmagazine.com/culture/check-your-financial-privilege.",
        [
            "books",
            "articles-threads",
            "curriculum"
        ],
        "Catalog free_status."
    ],
    [
        "books-cyfp-rights",
        "Why is Check Your Financial Privilege filed under rights?",
        "Gladstein writes about human rights and personal freedom under different monetary regimes. You can read the title essay at bitcoinmagazine.com/culture/check-your-financial-privilege.",
        [
            "books",
            "human_rights__social_justice_and_freedo",
            "philosophy"
        ],
        "Catalog: human rights, financial privilege, personal freedom."
    ],
    [
        "books-gts",
        "What is Gradually, Then Suddenly?",
        "Gradually, Then Suddenly is Parker Lewis's book, from essays on Unchained's blog. It frames Bitcoin as money for a non-technical reader and says the problem being solved is money printing. The essays are free, and the book is paid. You can read the essays at unchained.com/blog/category/gradually-then-suddenly.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/gradually-then-suddenly. Essay index URL from the catalog."
    ],
    [
        "books-gts-who",
        "Who wrote Gradually, Then Suddenly?",
        "Parker Lewis wrote the essays and the book. It came out on December 1, 2023. You can read the essays free at unchained.com/blog/category/gradually-then-suddenly.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "Catalog author and date."
    ],
    [
        "books-gts-free",
        "Are the Gradually, Then Suddenly essays free?",
        "Yes. The series is on Unchained's blog. The bound book is a paid edition of that material. You can read the essays at unchained.com/blog/category/gradually-then-suddenly.",
        [
            "books",
            "articles-threads",
            "money"
        ],
        "Catalog license note."
    ],
    [
        "books-gts-level",
        "Is Gradually, Then Suddenly technical?",
        "It is for a reader who thinks Bitcoin is too hard to start. It is an intuition book, not Programming Bitcoin. You can read the essays at unchained.com/blog/category/gradually-then-suddenly.",
        [
            "books",
            "curriculum",
            "money"
        ],
        "Catalog blurb."
    ],
    [
        "books-gts-printing",
        "What problem does Parker Lewis say Bitcoin solves?",
        "He says Bitcoin solves the problem of printing money, and that understanding it is not an intelligence test. You can read his essays at unchained.com/blog/category/gradually-then-suddenly.",
        [
            "books",
            "problems-of-money",
            "money"
        ],
        "Catalog blurb, own words."
    ],
    [
        "books-gts-title",
        "What does gradually then suddenly mean for this book?",
        "The title is the shape Lewis gives the change: slow, then fast. The book uses that shape for adoption of a new money. It does not give a date. You can read the essays at unchained.com/blog/category/gradually-then-suddenly.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "Title plus catalog description of the framework. No date invented."
    ],
    [
        "books-standard",
        "What is The Bitcoin Standard about?",
        "The Bitcoin Standard, by Saifedean Ammous, came out in 2018. It is a history of money that ends with Bitcoin. It argues that good money is hard to produce more of, compares shells, metals, and government money, and presents Bitcoin as digital hard money. It's available at amazon.com/dp/1119473861.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "Publisher description via btcbooks.org/the-bitcoin-standard. Own-words summary. No free edition."
    ],
    [
        "books-standard-who",
        "Who wrote The Bitcoin Standard?",
        "Saifedean Ammous wrote it. The subtitle is The Decentralized Alternative to Central Banking. It's a paid book, available at amazon.com/dp/1119473861.",
        [
            "books",
            "money",
            "austrian_school_of_economics"
        ],
        "Catalog author, year, subtitle, buy link."
    ],
    [
        "books-standard-free",
        "Is The Bitcoin Standard free as a PDF?",
        "No. The Bitcoin Standard is a paid book. It's available at amazon.com/dp/1119473861.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "Catalog: summary_only. Books channel archive.org upload removed in this change."
    ],
    [
        "books-fiat-standard",
        "What is The Fiat Standard about?",
        "The Fiat Standard, by Saifedean Ammous, came out in 2021. It turns the same lens onto government money that The Bitcoin Standard used for Bitcoin, and it treats the fiat system as an engineered system. It's available at amazon.com/dp/B09VVFCQ63.",
        [
            "books",
            "problems-of-money",
            "austrian_school_of_economics"
        ],
        "btcbooks.org/the-fiat-standard blurb, rewritten. No PDF."
    ],
    [
        "books-fiat-standard-who",
        "Who wrote The Fiat Standard?",
        "Saifedean Ammous, the author of The Bitcoin Standard, wrote it. It came out on November 9, 2021. It's available at amazon.com/dp/B09VVFCQ63.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "Catalog."
    ],
    [
        "books-fiat-standard-idea",
        "What idea does The Fiat Standard present?",
        "The book treats fiat money as a technology with a design, not a neutral backdrop, and it says that design has costs. It's available at amazon.com/dp/B09VVFCQ63.",
        [
            "books",
            "problems-of-money",
            "money"
        ],
        "Catalog blurb."
    ],
    [
        "books-digital-gold",
        "What is Digital Gold by Nathaniel Popper about?",
        "Digital Gold, by Nathaniel Popper, came out in 2015. It is his history of Bitcoin's early years and the people who tried to build a new internet money. He was a New York Times reporter. It's available at amazon.com/dp/006236250X.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "btcbooks.org/digital-gold. Subtitle: the misfits and millionaires trying to reinvent money."
    ],
    [
        "books-digital-gold-who",
        "Who wrote Digital Gold?",
        "Nathaniel Popper wrote it, and it came out on May 19, 2015. It is a reported history, not a protocol spec. It's available at amazon.com/dp/006236250X.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "Catalog."
    ],
    [
        "books-digital-gold-story",
        "What story does Digital Gold tell?",
        "It follows the early communities and companies around Bitcoin, and a social movement around a new money. It does not unmask Satoshi. It's available at amazon.com/dp/006236250X.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "Catalog blurb, own words. No scenes invented."
    ],
    [
        "books-layered",
        "What is Layered Money about?",
        "Layered Money, by Nik Bhatia, came out in 2021 and describes money as layers, using gold's history as the example and carrying that picture through to Bitcoin. It's available at amazon.com/dp/B091D3KR8G.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/layered-money blurb, shortened."
    ],
    [
        "books-layered-who",
        "Who wrote Layered Money?",
        "Nik Bhatia wrote it. He later wrote Bitcoin Age, which is a different book. It's available at amazon.com/dp/B091D3KR8G.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "Catalog author. bitcoin-age is a separate slug."
    ],
    [
        "books-layered-idea",
        "What idea does Layered Money present?",
        "The book says monetary systems already work in layers, and that Bitcoin can be read as a new base or a new upper layer depending on the chapter. It's available at amazon.com/dp/B091D3KR8G.",
        [
            "books",
            "money",
            "layer-2-lightning"
        ],
        "Catalog blurb about layered gold money. Careful not to invent his conclusion."
    ],
    [
        "books-price-tomorrow",
        "What is The Price of Tomorrow about?",
        "The Price of Tomorrow, by Jeff Booth, came out in 2020. He argues that technology pushes prices down and that fighting that pressure with easy money is the mistake, and he treats Bitcoin as the exit. It's available at amazon.com/dp/B08725C857.",
        [
            "books",
            "problems-of-money",
            "geopolitics___macroeconomics"
        ],
        "Catalog one-line summary. Title contains the word price but the entry states no figure. btcbooks.org/the-price-of-tomorrow."
    ],
    [
        "books-price-tomorrow-who",
        "Who wrote The Price of Tomorrow?",
        "Jeff Booth wrote it, and it came out on January 1, 2020. It is an argument about technology and money. It's available at amazon.com/dp/B08725C857.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "Catalog."
    ],
    [
        "books-price-tomorrow-idea",
        "What idea does The Price of Tomorrow present?",
        "Booth argues that deflation from technology is natural, and that printing money to hide it causes damage. He points at Bitcoin as the alternative. It's available at amazon.com/dp/B08725C857.",
        [
            "books",
            "problems-of-money",
            "money"
        ],
        "Catalog blurb."
    ],
    [
        "books-one-million",
        "What is the book Bitcoin One Million?",
        "Bitcoin One Million, by Fred Krueger and Ben Sigman, is a 2025 book whose title states a price the authors argue toward. It's available at amazon.com/dp/B0FYK1YKWN.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-one-million blurb. House rule: no price target in the answer."
    ],
    [
        "books-big-print",
        "What is The Big Print about?",
        "The Big Print, by Lawrence Lepard, came out in 2025. It is about what an expanding money supply did to American savings and why the author thinks a hard cap is the repair. It's an argument, available at amazon.com/dp/B0DVTCVX8J.",
        [
            "books",
            "problems-of-money",
            "money"
        ],
        "Catalog blurb, own words. No dollar figure. btcbooks.org/the-big-print."
    ],
    [
        "books-big-print-who",
        "Who wrote The Big Print?",
        "Lawrence Lepard wrote it. It came out on February 3, 2025, with the subtitle What Happened to America and How Sound Money Will Fix It. It's available at amazon.com/dp/B0DVTCVX8J.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "Catalog title, subtitle, date."
    ],
    [
        "books-big-print-idea",
        "What idea does The Big Print present?",
        "The book says that printing money damaged savings, and that a supply that cannot be expanded is the repair he proposes. It's available at amazon.com/dp/B0DVTCVX8J.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "Catalog."
    ],
    [
        "books-hijacking",
        "What is Hijacking Bitcoin about?",
        "Hijacking Bitcoin, by Roger Ver and Steve Patterson, came out in 2024 and argues that Bitcoin's development was captured and that it was meant to be everyday cash. That is their side of a dispute. Jonathan Bier's The Blocksize War is the other history. It's available at amazon.com/dp/B0CXWBCWDR.",
        [
            "books",
            "politics",
            "history"
        ],
        "btcbooks.org/hijacking-bitcoin blurb. Neutral framing. Question avoids other-coin names."
    ],
    [
        "books-hijacking-who",
        "Who wrote Hijacking Bitcoin?",
        "Roger Ver and Steve Patterson wrote it. The subtitle is The Hidden History of BTC. It's their argument, available at amazon.com/dp/B0CXWBCWDR.",
        [
            "books",
            "politics",
            "history"
        ],
        "Catalog authors and subtitle."
    ],
    [
        "books-hijacking-idea",
        "What do the authors of Hijacking Bitcoin claim?",
        "They claim the project was redirected away from cash toward a savings asset. Other authors say the users chose that outcome in the blocksize fight. Read both and decide. Their book is at amazon.com/dp/B0CXWBCWDR.",
        [
            "books",
            "history",
            "block_time-block-size"
        ],
        "Catalog blurb plus the existence of Bier's book. No chain-split ticker named."
    ],
    [
        "books-vs-other",
        "What is Champagne's 2023 book about other coins?",
        "Phil Champagne's 2023 book compares Bitcoin with other coins and asks which design lasts. It's a paid book, available at amazon.com/dp/B0C43QF4G6.",
        [
            "books",
            "evidence-against-alts",
            "philosophy"
        ],
        "btcbooks.org/bitcoin-vs-altcoins. Question omits the word altcoin so the steer does not swallow it. Title recorded in sources."
    ],
    [
        "books-vs-other-who",
        "Who wrote Champagne's 2023 comparison of Bitcoin and other coins?",
        "Phil Champagne, who also compiled The Book of Satoshi, wrote it. The book takes a side in a public argument about many chains. It's available at amazon.com/dp/B0C43QF4G6.",
        [
            "books",
            "evidence-against-alts",
            "history"
        ],
        "Catalog author."
    ],
    [
        "books-vs-other-idea",
        "What does Champagne argue about other coins?",
        "The book examines the fight over which system lasts, and it treats that fight as a real argument rather than a tie. It's available at amazon.com/dp/B0C43QF4G6.",
        [
            "books",
            "evidence-against-alts",
            "maximalism"
        ],
        "Catalog blurb rewritten without the coin names."
    ],
    [
        "books-svanholm-sovereignty",
        "What is Sovereignty Through Mathematics?",
        "Bitcoin: Sovereignty Through Mathematics, by Knut Svanholm, came out in 2019. It asks what money is, who benefits from inflation, and whether mining is waste. A sample chapter is free from the author, and the book is available at amazon.com/dp/B07S3MHJ9F.",
        [
            "books",
            "philosophy",
            "money"
        ],
        "Catalog: sample chapter only. Do not link unofficial PDFs. Author later used a Substack for samples. btcbooks.org/bitcoin-sovereignty-through-mathematics."
    ],
    [
        "books-little-book",
        "What is The Little Bitcoin Book?",
        "The Little Bitcoin Book, by the Bitcoin Collective, came out in 2019. It is a short group explanation of why Bitcoin would matter for freedom and saving. The old download site is no longer safe. It's available at amazon.com/dp/1641990503.",
        [
            "books",
            "curriculum",
            "orange-pilling"
        ],
        "Catalog. Former official domain hijacked and deliberately not named or linked. btcbooks.org/the-little-bitcoin-book."
    ],
    [
        "books-little-who",
        "Who wrote The Little Bitcoin Book?",
        "The Bitcoin Collective is the name on the book. It is a short group primer, not a technical manual like Mastering Bitcoin. It's available at amazon.com/dp/1641990503.",
        [
            "books",
            "curriculum",
            "money"
        ],
        "Catalog authors field."
    ],
    [
        "books-little-free",
        "Is The Little Bitcoin Book still a free download?",
        "No. The old download site was taken over and is not safe. It's available at amazon.com/dp/1641990503.",
        [
            "books",
            "curriculum",
            "misconceptions-fud"
        ],
        "Catalog note: current official source unknown. Domain takeover recorded without repeating the hostname."
    ],
    [
        "books-independence",
        "What is Bitcoin: Independence Reimagined?",
        "It is Knut Svanholm's 2020 follow-up to Sovereignty Through Mathematics, about leaving old institutional boxes. Only a sample is free from the author. It's available at amazon.com/dp/B087CF2XBB.",
        [
            "books",
            "philosophy",
            "curriculum"
        ],
        "Catalog blurb. Sample only. btcbooks.org/bitcoin-independence-reimagined."
    ],
    [
        "books-clarity",
        "What is Bitcoin Clarity?",
        "Bitcoin Clarity, by Kiara Bickers, came out in 2020. It is an introduction that readers credited with making the system understandable. Chapters 1 and 2 are free at getbitcoinclarity.com, and the rest of the book is paid.",
        [
            "books",
            "curriculum",
            "money"
        ],
        "getbitcoinclarity.com per catalog: chapters 1-2 only. btcbooks.org/bitcoin-clarity."
    ],
    [
        "books-clarity-who",
        "Who wrote Bitcoin Clarity?",
        "Kiara Bickers wrote it. Readers have said it opened the subject for them. Her sample is at getbitcoinclarity.com.",
        [
            "books",
            "curriculum",
            "orange-pilling"
        ],
        "Catalog author."
    ],
    [
        "books-clarity-sample",
        "How much of Bitcoin Clarity is free?",
        "The first two chapters of Bitcoin Clarity are free as a PDF on the author's site, getbitcoinclarity.com. The rest of the book is paid.",
        [
            "books",
            "curriculum",
            "one-stop-shop"
        ],
        "Catalog license note."
    ],
    [
        "books-learn-posch",
        "What is (L)earn Bitcoin by Anita Posch?",
        "Anita Posch's 2021 book covers why and how a person might start with Bitcoin, from technology to politics. A manuscript is on her GitHub, and you may share excerpts if you credit her. You can read it at github.com/anitaonl/learn-bitcoin.",
        [
            "books",
            "curriculum",
            "money"
        ],
        "Catalog: github.com/anitaonl/learn-bitcoin, copyrighted, excerpts with attribution. learnbitcoin.link was a live site on 2026-10-27. btcbooks.org/l-earn-bitcoin."
    ],
    [
        "books-learn-posch-free",
        "Is Anita Posch's Bitcoin book free?",
        "The full book is paid. A manuscript is on her GitHub, and you may share excerpts if you credit her. The repo is github.com/anitaonl/learn-bitcoin.",
        [
            "books",
            "curriculum",
            "free_and_open_source_software__foss"
        ],
        "Catalog license note."
    ],
    [
        "books-learn-posch-who",
        "Who wrote (L)earn Bitcoin?",
        "Anita Posch wrote it. The book is dated July 22, 2021. Her manuscript repo is github.com/anitaonl/learn-bitcoin.",
        [
            "books",
            "curriculum",
            "international"
        ],
        "Catalog."
    ],
    [
        "books-21m",
        "What is Everything Divided by 21 Million?",
        "Bitcoin: Everything Divided by 21 Million, by Knut Svanholm, came out in 2022 and opens by asking the reader to imagine everything that exists divided by 21 million. Only a sample is free from the author. It's available at amazon.com/dp/B0B77XYG4G.",
        [
            "books",
            "philosophy",
            "scarce"
        ],
        "Catalog blurb opening line, which is the author's invitation, summarized. Sample only. btcbooks.org/bitcoin-everything-divided-by-21-million."
    ],
    [
        "books-21m-who",
        "Who wrote Everything Divided by 21 Million?",
        "Knut Svanholm wrote it, after Sovereignty Through Mathematics and Independence Reimagined. The 21 million is Bitcoin's supply cap, used here as a thought experiment. It's available at amazon.com/dp/B0B77XYG4G.",
        [
            "books",
            "scarce",
            "philosophy"
        ],
        "Catalog author and the protocol supply cap, which is a consensus rule, not a page number from the book."
    ],
    [
        "books-do-bitcoin",
        "What is Do Bitcoin about?",
        "Do Bitcoin, by Angelo Morgan-Somers, came out in 2022. It is about using Bitcoin rather than only talking about it. An excerpt is free, and the book is available at amazon.com/dp/B0BFJKWWKT.",
        [
            "books",
            "curriculum",
            "self-custody"
        ],
        "Catalog: Medium excerpt only."
    ],
    [
        "books-broken-money",
        "What is Broken Money by Lyn Alden?",
        "Broken Money, by Lyn Alden, came out in 2023. It reads the history of money through technology, from shells and gold toward digital money. The book is paid, and she posts a free chartbook and bibliography at lynalden.com/broken-money/.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "lynalden.com/broken-money/ (200). Catalog blurb. Book text not copied."
    ],
    [
        "books-broken-who",
        "Who wrote Broken Money?",
        "Lyn Alden wrote it. The subtitle is Why Our Financial System is Failing Us and How We Can Make It Better. Her free extras are at lynalden.com/broken-money/.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "Catalog title. Subtitle used from the truncated blurb's opening, which states the overview theme."
    ],
    [
        "books-broken-tech",
        "What idea does Broken Money present?",
        "She says technology changes money globally and for good, while politics changes it locally and for a while. You can see her free chartbook at lynalden.com/broken-money/.",
        [
            "books",
            "money",
            "geopolitics___macroeconomics"
        ],
        "Catalog blurb sentence on technology versus politics."
    ],
    [
        "books-broken-free",
        "Is Broken Money free?",
        "The book is paid. The author offers a free chartbook and bibliography, and she has free articles on the same site. You can start at lynalden.com/broken-money/.",
        [
            "books",
            "charts",
            "money"
        ],
        "Catalog: free chartbook/bibliography PDF and articles."
    ],
    [
        "books-broken-scope",
        "Does Broken Money replace The Bitcoin Standard?",
        "No. Alden's book is her own history of money through technology. Ammous wrote a different history. You can read her free chartbook at lynalden.com/broken-money/, and the book itself is paid.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "Two separate btcbooks.org listings."
    ],
    [
        "books-resistance",
        "What is Resistance Money about?",
        "Resistance Money, by Andrew Bailey, Bradley Rettler, and Craig Warmke, is a philosophical case for Bitcoin, published with Routledge. The authors argue it helps people facing inflation, surveillance, censorship, and exclusion. The first chapter is free, and the rest of the book is paid. You can read that chapter at resistance.money.",
        [
            "books",
            "philosophy",
            "human_rights__social_justice_and_freedo"
        ],
        "resistance.money (200). Catalog: chapter 1 PDF, rest all rights reserved. Blurb rewritten. btcbooks.org/resistance-money."
    ],
    [
        "books-resistance-who",
        "Who wrote Resistance Money?",
        "Andrew M Bailey, Bradley Rettler, and Craig Warmke, three philosophers. It came out on June 14, 2024. Their sample is at resistance.money.",
        [
            "books",
            "philosophy",
            "research-theses"
        ],
        "Catalog authors and date."
    ],
    [
        "books-resistance-sample",
        "How much of Resistance Money is free?",
        "The first chapter of Resistance Money is free as a PDF on the authors' site, resistance.money. The full book is published by Routledge.",
        [
            "books",
            "philosophy",
            "curriculum"
        ],
        "Catalog license note."
    ],
    [
        "books-resistance-idea",
        "What idea does Resistance Money argue?",
        "Bitcoin is resistance money: a tool for people under institutional pressure, not only a chip for speculators. That is the authors' case, and critics dispute it. Their sample is at resistance.money.",
        [
            "books",
            "philosophy",
            "politics"
        ],
        "Catalog blurb, own words."
    ],
    [
        "books-satoshi-papers",
        "What are The Satoshi Papers?",
        "The Satoshi Papers, edited by Natalie Smolenski, came out in 2025. It collects essays on political economy after Bitcoin. The book is paid, with excerpts only, and it's available at amazon.com/dp/B0F1FNGYD9.",
        [
            "books",
            "politics",
            "philosophy"
        ],
        "Catalog: Bitcoin Policy Institute, paid, excerpts only. No full text copied. btcbooks.org/the-satoshi-papers."
    ],
    [
        "books-satoshi-papers-who",
        "Who edited The Satoshi Papers?",
        "Natalie Smolenski edited the volume. It is an essay collection, not Satoshi's own posts, which live at the Nakamoto Institute. It's available at amazon.com/dp/B0F1FNGYD9.",
        [
            "books",
            "politics",
            "satoshi-nakamoto"
        ],
        "Catalog editor credit."
    ],
    [
        "books-satoshi-papers-sample",
        "Are The Satoshi Papers free?",
        "No. The Satoshi Papers is a paid book, and only excerpts are offered. It's available at amazon.com/dp/B0F1FNGYD9.",
        [
            "books",
            "politics",
            "curriculum"
        ],
        "Catalog free_status free_sample_only."
    ],
    [
        "books-principles",
        "What is Principles of Bitcoin?",
        "Principles of Bitcoin, by Vijay Selvam, lays out monetary, technical, and social principles that he says make Bitcoin its own kind of money. The publisher has the front matter free, and the book is paid. The press page is cup.columbia.edu.",
        [
            "books",
            "philosophy",
            "money"
        ],
        "Catalog: cup.columbia.edu front matter only. btcbooks.org/principles-of-bitcoin."
    ],
    [
        "books-principles-who",
        "Who wrote Principles of Bitcoin?",
        "Vijay Selvam wrote it, and it came out on March 31, 2025. It is a book of principles. The press page is cup.columbia.edu.",
        [
            "books",
            "philosophy",
            "curriculum"
        ],
        "Catalog."
    ],
    [
        "books-principles-sample",
        "Is Principles of Bitcoin free?",
        "The publisher offers the front matter free, not the chapters. The book is paid. The press page is cup.columbia.edu.",
        [
            "books",
            "curriculum",
            "money"
        ],
        "Catalog license note."
    ],
    [
        "books-free-to-read",
        "Which Bitcoin books can I read for free?",
        "Mastering Bitcoin, Mastering the Lightning Network, 21 Lessons, Grokking Bitcoin, and Programming Bitcoin are free from their authors. Venice, Inventing Bitcoin, Why Bitcoin by Strolight, the Simplest Bitcoin Book, the Softwar thesis, and Voskuil's PDF are free from the authors too. A good place to start is github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "curriculum",
            "one-stop-shop"
        ],
        "Licenses checked 2026-10-27 against the catalog and the repos named in those entries. One link in the answer."
    ],
    [
        "books-beginner-path",
        "Which Bitcoin book should a beginner read?",
        "A short free start is Inventing Bitcoin or 21 Lessons, then The Bitcoin Standard if you want monetary history, then Grokking Bitcoin if you want pictures of the mechanism. You can open 21 Lessons free at 21lessons.com.",
        [
            "books",
            "curriculum",
            "money"
        ],
        "Reading order is a house suggestion naming books already in this category."
    ],
    [
        "books-technical-path",
        "Which Bitcoin books are technical?",
        "Mastering Bitcoin, Programming Bitcoin, and Grokking Bitcoin teach the base layer, and Mastering the Lightning Network teaches payment channels. Cryptoeconomics is denser and not a first book. You can start free at github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "developers",
            "core-source-code"
        ],
        "Chapter lists verified from those repos."
    ],
    [
        "books-history-path",
        "Which Bitcoin books cover history?",
        "Digital Gold and The Book of Satoshi cover the early years, The Blocksize War covers 2015 to 2017, and The Genesis Book covers the projects before Bitcoin. Satoshi's own words are an archive of what he wrote, not a later biography. You can read them free at satoshi.nakamotoinstitute.org.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "Entries in this category. Institute URL."
    ],
    [
        "books-kids-path",
        "Which Bitcoin books are for children?",
        "Bitcoin Money is a Bitville story for all ages, B is for Bitcoin is an illustrated walk, and Bitcoin Explained Like I'm 5 states its reading level in the title. Parents should still read them first. You can browse the titles at btcbooks.org.",
        [
            "books",
            "curriculum",
            "poems-stories"
        ],
        "Catalog descriptions for those three slugs. One catalog link."
    ],
    [
        "books-critics-path",
        "Which books criticize Bitcoin?",
        "The Politics of Bitcoin, by David Golumbia, argues that Bitcoin's politics lean cyberlibertarian, and Hijacking Bitcoin argues the project was captured. Both are arguments from their authors. Golumbia's publisher page is https://www.upress.umn.edu/9781517901806/the-politics-of-bitcoin/.",
        [
            "books",
            "politics",
            "misconceptions-fud"
        ],
        "Publisher page and the Hijacking Bitcoin listing. Neutral descriptions."
    ],
    [
        "books-spot-pirate",
        "How can I tell a Bitcoin book PDF is pirated?",
        "A legal free book names the author and lives on the author's site, a university repository, or a project repository you can open. A file-share upload of a book that is still for sale is not that copy. When a free copy is real, it looks like github.com/bitcoinbook/bitcoinbook.",
        [
            "books",
            "misconceptions-fud",
            "curriculum"
        ],
        "House rule from this project. No pirate hostname included."
    ],
    [
        "books-bitcoin-for-the-befuddled",
        "What is Bitcoin for the Befuddled about?",
        "Bitcoin for the Befuddled, by Conrad Barski & Chris Wilmer, came out in 2014. It explains what Bitcoin is, how it works, and how to hold and spend it without jargon. It's available at amazon.com/dp/B00PYXN5N2.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-for-the-befuddled. https://www.amazon.com/dp/B00PYXN5N2 Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-for-the-befuddled-who",
        "Who wrote Bitcoin for the Befuddled?",
        "Conrad Barski & Chris Wilmer wrote Bitcoin for the Befuddled, which came out in 2014. It explains what Bitcoin is, how it works, and how to hold and spend it without jargon. It's available at amazon.com/dp/B00PYXN5N2.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-for-the-befuddled. https://www.amazon.com/dp/B00PYXN5N2 Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-for-the-befuddled-idea",
        "What idea does Bitcoin for the Befuddled present?",
        "It explains what Bitcoin is, how it works, and how to hold and spend it without jargon. It's available at amazon.com/dp/B00PYXN5N2.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-for-the-befuddled. https://www.amazon.com/dp/B00PYXN5N2 Own-words summary; no free full text used."
    ],
    [
        "books-the-bitcoin-big-bang",
        "What is The Bitcoin Big Bang about?",
        "The Bitcoin Big Bang, by Brian Kelly, came out in 2014. It asks why alternative monies showed up when they did, and what competing monies would change. It's available at amazon.com/dp/B08DHHCNML.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-bitcoin-big-bang. https://www.amazon.com/dp/B08DHHCNML Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-the-future-of-money",
        "What is Dominic Frisby's early Bitcoin book about?",
        "Bitcoin: The Future of Money, by Dominic Frisby, came out in 2014. It tells the early story of Bitcoin, the subcultures around it, and the hunt for Satoshi. It's available at amazon.com/dp/B0F6VJV12F.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-the-future-of-money. https://www.amazon.com/dp/B0F6VJV12F Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-basics",
        "What is Bitcoin Basics about?",
        "Bitcoin Basics, by Eric Sammons, came out in 2015. It answers plain questions about what Bitcoin is, why it exists, and whether the network can be broken. It's available at amazon.com/dp/B017OC73ZG.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-basics. https://www.amazon.com/dp/B017OC73ZG Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-money",
        "What is Bitcoin Money about?",
        "Bitcoin Money, by Michael Caras, came out in 2019. It is a story for all ages about kids in a town called Bitville who try different monies and then meet Bitcoin. It's available at amazon.com/dp/0578490676.",
        [
            "books",
            "curriculum",
            "poems-stories"
        ],
        "btcbooks.org/bitcoin-money. https://www.amazon.com/dp/0578490676 Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-billionaires",
        "What is Bitcoin Billionaires about?",
        "Bitcoin Billionaires, by Ben Mezrich, came out in 2019. It tells how Tyler and Cameron Winklevoss put a legal settlement into bitcoin. It's available at amazon.com/dp/B08RDV8CPM.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "btcbooks.org/bitcoin-billionaires. https://www.amazon.com/dp/B08RDV8CPM Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-billionaires-who",
        "Who wrote Bitcoin Billionaires?",
        "Ben Mezrich wrote Bitcoin Billionaires, which came out in 2019. It tells how Tyler and Cameron Winklevoss put a legal settlement into bitcoin. It's available at amazon.com/dp/B08RDV8CPM.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "btcbooks.org/bitcoin-billionaires. https://www.amazon.com/dp/B08RDV8CPM Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-billionaires-idea",
        "What story does Bitcoin Billionaires tell?",
        "It tells how Tyler and Cameron Winklevoss put a legal settlement into bitcoin. It's available at amazon.com/dp/B08RDV8CPM.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "btcbooks.org/bitcoin-billionaires. https://www.amazon.com/dp/B08RDV8CPM Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-and-black-america",
        "What is Bitcoin & Black America about?",
        "Bitcoin & Black America, by Isaiah Jackson, came out in 2019. It looks at Bitcoin alongside Black economic history and argues for a money outside a banking system the author calls unfair. It's available at amazon.com/dp/1079178090.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-and-black-america. https://www.amazon.com/dp/1079178090 Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-and-black-america-who",
        "Who wrote Bitcoin & Black America?",
        "Isaiah Jackson wrote Bitcoin & Black America, which came out in 2019. It looks at Bitcoin alongside Black economic history and argues for a money outside a banking system the author calls unfair. It's available at amazon.com/dp/1079178090.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-and-black-america. https://www.amazon.com/dp/1079178090 Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-and-black-america-idea",
        "What idea does Bitcoin & Black America present?",
        "It looks at Bitcoin alongside Black economic history and argues for a money outside a banking system the author calls unfair. It's available at amazon.com/dp/1079178090.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-and-black-america. https://www.amazon.com/dp/1079178090 Own-words summary; no free full text used."
    ],
    [
        "books-why-buy-bitcoin",
        "What is Why Buy Bitcoin about?",
        "Why Buy Bitcoin, by Andy Edstrom, came out in 2019. It asks why someone would study Bitcoin after years of headlines declaring it dead. It's available at amazon.com/dp/B08XQXD3DN.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/why-buy-bitcoin. https://www.amazon.com/dp/B08XQXD3DN Own-words summary; no free full text used."
    ],
    [
        "books-why-buy-bitcoin-who",
        "Who wrote Why Buy Bitcoin?",
        "Andy Edstrom wrote Why Buy Bitcoin, which came out in 2019. It asks why someone would study Bitcoin after years of headlines declaring it dead. It's available at amazon.com/dp/B08XQXD3DN.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/why-buy-bitcoin. https://www.amazon.com/dp/B08XQXD3DN Own-words summary; no free full text used."
    ],
    [
        "books-why-buy-bitcoin-idea",
        "What idea does Why Buy Bitcoin present?",
        "It asks why someone would study Bitcoin after years of headlines declaring it dead. It's available at amazon.com/dp/B08XQXD3DN.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/why-buy-bitcoin. https://www.amazon.com/dp/B08XQXD3DN Own-words summary; no free full text used."
    ],
    [
        "books-truth-decay",
        "What is Truth Decay about?",
        "Truth Decay, by Victoria Collette Jones, came out in 2020. It connects a century of money debates to war and to the theories people use to manage money. It's available at amazon.com/dp/B0861XWC9B.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/truth-decay. https://www.amazon.com/dp/B0861XWC9B Own-words summary; no free full text used."
    ],
    [
        "books-this-book-will-save-you-time",
        "What is This Book Will Save You Time about?",
        "This Book Will Save You Time, by Misir Mahmudov, came out in 2020. The author treats time as the scarce resource and argues that Bitcoin is how a person keeps it. It's available at amazon.com/dp/B088JH7LX8.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/this-book-will-save-you-time. https://www.amazon.com/dp/B088JH7LX8 Own-words summary; no free full text used."
    ],
    [
        "books-magic-internet-money",
        "What is Magic Internet Money about?",
        "Magic Internet Money, by Jesse Berger, came out in 2020. It walks through what money is and how Bitcoin sits in that story. It's available at amazon.com/dp/B08KWLPKSW.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/magic-internet-money. https://www.amazon.com/dp/B08KWLPKSW Own-words summary; no free full text used."
    ],
    [
        "books-thank-god-for-bitcoin",
        "What is Thank God for Bitcoin about?",
        "Thank God for Bitcoin, by The Bitcoin & Bible Group, came out in 2020. A group writing as the Bitcoin and Bible Group connects everyday money to a Christian reading of trust and provision. It's available at amazon.com/dp/B0GMWLNT9B.",
        [
            "books",
            "faith___religion",
            "philosophy"
        ],
        "btcbooks.org/thank-god-for-bitcoin. https://www.amazon.com/dp/B0GMWLNT9B Own-words summary; no free full text used."
    ],
    [
        "books-thank-god-for-bitcoin-who",
        "Who wrote Thank God for Bitcoin?",
        "The Bitcoin & Bible Group wrote Thank God for Bitcoin, which came out in 2020. A group writing as the Bitcoin and Bible Group connects everyday money to a Christian reading of trust and provision. It's available at amazon.com/dp/B0GMWLNT9B.",
        [
            "books",
            "faith___religion",
            "philosophy"
        ],
        "btcbooks.org/thank-god-for-bitcoin. https://www.amazon.com/dp/B0GMWLNT9B Own-words summary; no free full text used."
    ],
    [
        "books-thank-god-for-bitcoin-idea",
        "What idea does Thank God for Bitcoin present?",
        "A group writing as the Bitcoin and Bible Group connects everyday money to a Christian reading of trust and provision. It's available at amazon.com/dp/B0GMWLNT9B.",
        [
            "books",
            "faith___religion",
            "philosophy"
        ],
        "btcbooks.org/thank-god-for-bitcoin. https://www.amazon.com/dp/B0GMWLNT9B Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-hard-money-you-cant-f-ck-with",
        "What is Bitcoin: Hard Money You Can't F*ck With about?",
        "Bitcoin: Hard Money You Can't F*ck With, by Jason A Williams, came out in 2020. The author calls Bitcoin hard money that no government, company, or central bank issues or prints. It's available at amazon.com/dp/B08VBQK55Z.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-hard-money-you-cant-f-ck-with. https://www.amazon.com/dp/B08VBQK55Z Own-words summary; no free full text used."
    ],
    [
        "books-the-7th-property",
        "What is The 7th Property about?",
        "The 7th Property, by Eric Yakes, came out in 2021. It is an introduction for readers who want the monetary argument for Bitcoin in one place. It's available at amazon.com/dp/B09N9VZYM7.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-7th-property. https://www.amazon.com/dp/B09N9VZYM7 Own-words summary; no free full text used."
    ],
    [
        "books-the-7th-property-who",
        "Who wrote The 7th Property?",
        "Eric Yakes wrote The 7th Property, which came out in 2021. It is an introduction for readers who want the monetary argument for Bitcoin in one place. It's available at amazon.com/dp/B09N9VZYM7.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-7th-property. https://www.amazon.com/dp/B09N9VZYM7 Own-words summary; no free full text used."
    ],
    [
        "books-the-7th-property-idea",
        "What idea does The 7th Property present?",
        "It is an introduction for readers who want the monetary argument for Bitcoin in one place. It's available at amazon.com/dp/B09N9VZYM7.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-7th-property. https://www.amazon.com/dp/B09N9VZYM7 Own-words summary; no free full text used."
    ],
    [
        "books-the-bitcoin-shortcut",
        "What is The Bitcoin Shortcut about?",
        "The Bitcoin Shortcut, by Craig Anthony, came out in 2021. It tours how Bitcoin works, how people hold it, and why the author thinks it changes saving. It's available at amazon.com/dp/B09BP3KST1.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-bitcoin-shortcut. https://www.amazon.com/dp/B09BP3KST1 Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-and-the-american-dream",
        "What is Bitcoin and the American Dream about?",
        "Bitcoin and the American Dream, by Collected authors, came out in 2021. Collected authors write about debt, financial stress, and Bitcoin as a different system. It's available at amazon.com/dp/B09P763YM7.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-and-the-american-dream. https://www.amazon.com/dp/B09P763YM7 Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-and-exponential-freedom",
        "What is Bitcoin & Exponential Freedom about?",
        "Bitcoin & Exponential Freedom, by Jake Leary, came out in 2022. The author argues that money is a base layer of freedom and that Bitcoin is a hard alternative. It's available at amazon.com/dp/B0B31QGBTF.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-and-exponential-freedom. https://www.amazon.com/dp/B0B31QGBTF Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-evangelism",
        "What is Bitcoin Evangelism about?",
        "Bitcoin Evangelism, by Brian E De Mint, came out in 2022. It is a short resource for answering common questions, including the energy question, in plain language. It's available at amazon.com/dp/B0BGJNKWFJ.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-evangelism. https://www.amazon.com/dp/B0BGJNKWFJ Own-words summary; no free full text used."
    ],
    [
        "books-tracers-in-the-dark",
        "What is Tracers in the Dark about?",
        "Tracers in the Dark, by Andy Greenberg, came out in 2022. It follows investigators who learned to trace bitcoin and used that trail against dark-web markets. It's available at amazon.com/dp/0593315618.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "btcbooks.org/tracers-in-the-dark. https://www.amazon.com/dp/0593315618 Own-words summary; no free full text used."
    ],
    [
        "books-tracers-in-the-dark-who",
        "Who wrote Tracers in the Dark?",
        "Andy Greenberg wrote Tracers in the Dark, which came out in 2022. It follows investigators who learned to trace bitcoin and used that trail against dark-web markets. It's available at amazon.com/dp/0593315618.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "btcbooks.org/tracers-in-the-dark. https://www.amazon.com/dp/0593315618 Own-words summary; no free full text used."
    ],
    [
        "books-tracers-in-the-dark-idea",
        "What story does Tracers in the Dark tell?",
        "It follows investigators who learned to trace bitcoin and used that trail against dark-web markets. It's available at amazon.com/dp/0593315618.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "btcbooks.org/tracers-in-the-dark. https://www.amazon.com/dp/0593315618 Own-words summary; no free full text used."
    ],
    [
        "books-the-bitcoin-handbook",
        "What is The Bitcoin Handbook about?",
        "The Bitcoin Handbook, by Anil Patel, came out in 2023. It collects illustrated frameworks for thinking about money in the digital age, for a non-technical reader. It's available at amazon.com/dp/B0FZDMF3MH.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-bitcoin-handbook. https://www.amazon.com/dp/B0FZDMF3MH Own-words summary; no free full text used."
    ],
    [
        "books-a-progressives-case-for-bitcoin",
        "What is A Progressive's Case for Bitcoin about?",
        "A Progressive's Case for Bitcoin, by C Jason Maier, came out in 2023. The author makes a case for Bitcoin from a progressive lens, including environment and inclusion. It's available at amazon.com/dp/B0CK9G113G.",
        [
            "books",
            "politics",
            "history"
        ],
        "btcbooks.org/a-progressives-case-for-bitcoin. https://www.amazon.com/dp/B0CK9G113G Own-words summary; no free full text used."
    ],
    [
        "books-a-progressives-case-for-bitcoin-who",
        "Who wrote A Progressive's Case for Bitcoin?",
        "C Jason Maier wrote A Progressive's Case for Bitcoin, which came out in 2023. The author makes a case for Bitcoin from a progressive lens, including environment and inclusion. It's available at amazon.com/dp/B0CK9G113G.",
        [
            "books",
            "politics",
            "history"
        ],
        "btcbooks.org/a-progressives-case-for-bitcoin. https://www.amazon.com/dp/B0CK9G113G Own-words summary; no free full text used."
    ],
    [
        "books-a-progressives-case-for-bitcoin-idea",
        "What idea does A Progressive's Case for Bitcoin present?",
        "The author makes a case for Bitcoin from a progressive lens, including environment and inclusion. It's available at amazon.com/dp/B0CK9G113G.",
        [
            "books",
            "politics",
            "history"
        ],
        "btcbooks.org/a-progressives-case-for-bitcoin. https://www.amazon.com/dp/B0CK9G113G Own-words summary; no free full text used."
    ],
    [
        "books-b-is-for-bitcoin",
        "What is B is for Bitcoin about?",
        "B is for Bitcoin, by Seb Bunney, Daz Bea, came out in 2023. It is an illustrated walk through Bitcoin's history and how the system works, written to be readable aloud. It's available at amazon.com/dp/B0C1JDKS7Q.",
        [
            "books",
            "curriculum",
            "poems-stories"
        ],
        "btcbooks.org/b-is-for-bitcoin. https://www.amazon.com/dp/B0C1JDKS7Q Own-words summary; no free full text used."
    ],
    [
        "books-b-is-for-bitcoin-who",
        "Who wrote B is for Bitcoin?",
        "Seb Bunney, Daz Bea wrote B is for Bitcoin, which came out in 2023. It is an illustrated walk through Bitcoin's history and how the system works, written to be readable aloud. It's available at amazon.com/dp/B0C1JDKS7Q.",
        [
            "books",
            "curriculum",
            "poems-stories"
        ],
        "btcbooks.org/b-is-for-bitcoin. https://www.amazon.com/dp/B0C1JDKS7Q Own-words summary; no free full text used."
    ],
    [
        "books-b-is-for-bitcoin-idea",
        "What idea does B is for Bitcoin present?",
        "It is an illustrated walk through Bitcoin's history and how the system works, written to be readable aloud. It's available at amazon.com/dp/B0C1JDKS7Q.",
        [
            "books",
            "curriculum",
            "poems-stories"
        ],
        "btcbooks.org/b-is-for-bitcoin. https://www.amazon.com/dp/B0C1JDKS7Q Own-words summary; no free full text used."
    ],
    [
        "books-proof-of-money",
        "What is Proof of Money about?",
        "Proof of Money, by Terence Michael, came out in 2023. The author argues for holding bitcoin yourself, without brokers. It's available at amazon.com/dp/B0C51JXSJL.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/proof-of-money. https://www.amazon.com/dp/B0C51JXSJL Own-words summary; no free full text used."
    ],
    [
        "books-abundance-through-scarcity",
        "What is Abundance Through Scarcity about?",
        "Abundance Through Scarcity, by Ioni Appelberg, came out in 2023. The author, a physician, explores scarcity, freedom, and what he calls hidden forms of dependence. It's available at amazon.com/dp/B0H1LJPQ81.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/abundance-through-scarcity. https://www.amazon.com/dp/B0H1LJPQ81 Own-words summary; no free full text used."
    ],
    [
        "books-decrypting-money",
        "What is Decrypting Money about?",
        "Decrypting Money, by Collected authors, came out in 2023. Collected authors present Bitcoin as internet-age money with security and independence as the themes. It's available at amazon.com/dp/1544535996.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/decrypting-money. https://www.amazon.com/dp/1544535996 Own-words summary; no free full text used."
    ],
    [
        "books-history-echoes-bitcoin",
        "What is History Echoes Bitcoin about?",
        "History Echoes Bitcoin, by Tim Niemeyer, came out in 2023. It pairs episodes from history with properties the author sees in Bitcoin, such as open collaboration and scarcity. It's available at amazon.com/dp/B0C7MVH1HG.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "btcbooks.org/history-echoes-bitcoin. https://www.amazon.com/dp/B0C7MVH1HG Own-words summary; no free full text used."
    ],
    [
        "books-cryptosovereignty",
        "What is Cryptosovereignty about?",
        "Cryptosovereignty, by Erik Cason, came out in 2023. The author writes about cryptography as personal power, not only as a payments tool. It's available at amazon.com/dp/B0CKWKJ72P.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/cryptosovereignty. https://www.amazon.com/dp/B0CKWKJ72P Own-words summary; no free full text used."
    ],
    [
        "books-fiat-ruins-everything",
        "What is Fiat Ruins Everything about?",
        "Fiat Ruins Everything, by Jimmy Song, came out in 2023. The author argues that a money which can be printed cheapens labor, savings, and institutions. It's available at amazon.com/dp/B0DS9W712H.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/fiat-ruins-everything. https://www.amazon.com/dp/B0DS9W712H Own-words summary; no free full text used."
    ],
    [
        "books-fiat-ruins-everything-who",
        "Who wrote Fiat Ruins Everything?",
        "Jimmy Song wrote Fiat Ruins Everything, which came out in 2023. The author argues that a money which can be printed cheapens labor, savings, and institutions. It's available at amazon.com/dp/B0DS9W712H.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/fiat-ruins-everything. https://www.amazon.com/dp/B0DS9W712H Own-words summary; no free full text used."
    ],
    [
        "books-fiat-ruins-everything-idea",
        "What idea does Fiat Ruins Everything present?",
        "The author argues that a money which can be printed cheapens labor, savings, and institutions. It's available at amazon.com/dp/B0DS9W712H.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/fiat-ruins-everything. https://www.amazon.com/dp/B0DS9W712H Own-words summary; no free full text used."
    ],
    [
        "books-the-bible-and-bitcoin",
        "What is The Bible and Bitcoin about?",
        "The Bible and Bitcoin, by Alin Armstrong, came out in 2023. It reads inflation and fiat money through a Christian duty to love one's neighbor. It's available at amazon.com/dp/B0CPB2C14V.",
        [
            "books",
            "faith___religion",
            "philosophy"
        ],
        "btcbooks.org/the-bible-and-bitcoin. https://www.amazon.com/dp/B0CPB2C14V Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-is-better",
        "What is Bitcoin is Better about?",
        "Bitcoin is Better, by Daniel Hershberger, came out in 2023. Beyond the title, the author, and the year, there isn't a public description. It's available at amazon.com/dp/B0CM7SKZNC.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-is-better. https://www.amazon.com/dp/B0CM7SKZNC Own-words summary; no free full text used."
    ],
    [
        "books-the-hidden-cost-of-money",
        "What is The Hidden Cost of Money about?",
        "The Hidden Cost of Money, by Seb Bunney, came out in 2023. It traces how the design of money shows up in work, housing, politics, and what people treat as normal. It's available at amazon.com/dp/1738934101.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-hidden-cost-of-money. https://www.amazon.com/dp/1738934101 Own-words summary; no free full text used."
    ],
    [
        "books-the-hidden-cost-of-money-who",
        "Who wrote The Hidden Cost of Money?",
        "Seb Bunney wrote The Hidden Cost of Money, which came out in 2023. It traces how the design of money shows up in work, housing, politics, and what people treat as normal. It's available at amazon.com/dp/1738934101.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-hidden-cost-of-money. https://www.amazon.com/dp/1738934101 Own-words summary; no free full text used."
    ],
    [
        "books-the-hidden-cost-of-money-idea",
        "What idea does The Hidden Cost of Money present?",
        "It traces how the design of money shows up in work, housing, politics, and what people treat as normal. It's available at amazon.com/dp/1738934101.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-hidden-cost-of-money. https://www.amazon.com/dp/1738934101 Own-words summary; no free full text used."
    ],
    [
        "books-the-dao-of-bitcoin",
        "What is The Dao of Bitcoin about?",
        "The Dao of Bitcoin, by Scott Dedels, came out in 2024. The author reads Bitcoin as energy money and asks what changes when money follows a flow instead of a decree. It's available at amazon.com/dp/B0D47WQD5G.",
        [
            "books",
            "philosophy",
            "curriculum"
        ],
        "btcbooks.org/the-dao-of-bitcoin. https://www.amazon.com/dp/B0D47WQD5G Own-words summary; no free full text used."
    ],
    [
        "books-the-conservative-case-for-bitcoin",
        "What is The Conservative Case for Bitcoin about?",
        "The Conservative Case for Bitcoin, by Mitchell Askew, came out in 2024. The author makes a traditionalist case for Bitcoin as hard money that cannot be inflated by a vote. It's available at amazon.com/dp/B0CZJCCZ9L.",
        [
            "books",
            "politics",
            "history"
        ],
        "btcbooks.org/the-conservative-case-for-bitcoin. https://www.amazon.com/dp/B0CZJCCZ9L Own-words summary; no free full text used."
    ],
    [
        "books-the-conservative-case-for-bitcoin-who",
        "Who wrote The Conservative Case for Bitcoin?",
        "Mitchell Askew wrote The Conservative Case for Bitcoin, which came out in 2024. The author makes a traditionalist case for Bitcoin as hard money that cannot be inflated by a vote. It's available at amazon.com/dp/B0CZJCCZ9L.",
        [
            "books",
            "politics",
            "history"
        ],
        "btcbooks.org/the-conservative-case-for-bitcoin. https://www.amazon.com/dp/B0CZJCCZ9L Own-words summary; no free full text used."
    ],
    [
        "books-the-conservative-case-for-bitcoin-idea",
        "What idea does The Conservative Case for Bitcoin present?",
        "The author makes a traditionalist case for Bitcoin as hard money that cannot be inflated by a vote. It's available at amazon.com/dp/B0CZJCCZ9L.",
        [
            "books",
            "politics",
            "history"
        ],
        "btcbooks.org/the-conservative-case-for-bitcoin. https://www.amazon.com/dp/B0CZJCCZ9L Own-words summary; no free full text used."
    ],
    [
        "books-parallel",
        "What is Parallel about?",
        "Parallel, by Brian E De Mint, Knut Svanholm, Daniel Prince, came out in 2024. Three authors write about a social layer that grows beside Bitcoin, which they call a parallel system. It's available at amazon.com/dp/B0CWQBCJNL.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/parallel. https://www.amazon.com/dp/B0CWQBCJNL Own-words summary; no free full text used."
    ],
    [
        "books-introduction-to-bitcoin",
        "What is Introduction to Bitcoin about?",
        "Introduction to Bitcoin, by Florin T Hilbay, came out in 2024. It is a case for one digital money no single country controls. It's available at amazon.com/dp/B0CW1FMS8G.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/introduction-to-bitcoin. https://www.amazon.com/dp/B0CW1FMS8G Own-words summary; no free full text used."
    ],
    [
        "books-twenty-one-questions",
        "What is Twenty One Questions about?",
        "Twenty One Questions, by Spirit of Satoshi, Aleksandar Svetski, came out in 2024. The subtitle is a beginner's guide to Bitcoin. It's available at amazon.com/dp/B0D36D88G4.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/twenty-one-questions. https://www.amazon.com/dp/B0D36D88G4 Own-words summary; no free full text used."
    ],
    [
        "books-shells-to-satoshi",
        "What is Shells to Satoshi about?",
        "Shells to Satoshi, by Deanna Heikkinen & Joel Marquez, came out in 2024. Beyond the title, the author, and the year, there isn't a public description. It's available at amazon.com/dp/1964944007.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "btcbooks.org/shells-to-satoshi. https://www.amazon.com/dp/1964944007 Own-words summary; no free full text used."
    ],
    [
        "books-would-mao-hold-bitcoin",
        "What is Roger Huang's book about Bitcoin in China?",
        "Would Mao Hold Bitcoin, by Roger Huang, came out in 2024. It covers Bitcoin's history inside China and the clash between an open network and the party-state. It's available at amazon.com/dp/B0D9MY17CZ.",
        [
            "books",
            "politics",
            "history"
        ],
        "btcbooks.org/would-mao-hold-bitcoin. https://www.amazon.com/dp/B0D9MY17CZ Own-words summary; no free full text used."
    ],
    [
        "books-would-mao-hold-bitcoin-who",
        "Who wrote Would Mao Hold Bitcoin?",
        "Roger Huang wrote Would Mao Hold Bitcoin, which came out in 2024. It covers Bitcoin's history inside China and the clash between an open network and the party-state. It's available at amazon.com/dp/B0D9MY17CZ.",
        [
            "books",
            "politics",
            "history"
        ],
        "btcbooks.org/would-mao-hold-bitcoin. https://www.amazon.com/dp/B0D9MY17CZ Own-words summary; no free full text used."
    ],
    [
        "books-would-mao-hold-bitcoin-idea",
        "What idea does Would Mao Hold Bitcoin present?",
        "It covers Bitcoin's history inside China and the clash between an open network and the party-state. It's available at amazon.com/dp/B0D9MY17CZ.",
        [
            "books",
            "politics",
            "history"
        ],
        "btcbooks.org/would-mao-hold-bitcoin. https://www.amazon.com/dp/B0D9MY17CZ Own-words summary; no free full text used."
    ],
    [
        "books-national-security-in-the-digital-age",
        "What is National Security in the Digital Age about?",
        "National Security in the Digital Age, by Matthew Pines & Kyle Schneps (eds), came out in 2024. The subtitle is a look at Bitcoin as a tool for modern statecraft. It's available at amazon.com/dp/B0D9J364RB.",
        [
            "books",
            "softwar",
            "geopolitics___macroeconomics"
        ],
        "btcbooks.org/national-security-in-the-digital-age. https://www.amazon.com/dp/B0D9J364RB Own-words summary; no free full text used."
    ],
    [
        "books-national-security-in-the-digital-age-who",
        "Who wrote National Security in the Digital Age?",
        "Matthew Pines & Kyle Schneps (eds) wrote National Security in the Digital Age, which came out in 2024. The subtitle is a look at Bitcoin as a tool for modern statecraft. It's available at amazon.com/dp/B0D9J364RB.",
        [
            "books",
            "softwar",
            "geopolitics___macroeconomics"
        ],
        "btcbooks.org/national-security-in-the-digital-age. https://www.amazon.com/dp/B0D9J364RB Own-words summary; no free full text used."
    ],
    [
        "books-national-security-in-the-digital-age-idea",
        "What idea does National Security in the Digital Age present?",
        "The subtitle is a look at Bitcoin as a tool for modern statecraft. It's available at amazon.com/dp/B0D9J364RB.",
        [
            "books",
            "softwar",
            "geopolitics___macroeconomics"
        ],
        "btcbooks.org/national-security-in-the-digital-age. https://www.amazon.com/dp/B0D9J364RB Own-words summary; no free full text used."
    ],
    [
        "books-the-nakamoto-consensus",
        "What is The Nakamoto Consensus about?",
        "The Nakamoto Consensus, by Nicholas Nell, came out in 2024. It is a novel about a character trying to protect Satoshi Nakamoto, and Bitcoin, from capture. It's available at amazon.com/dp/0796178305.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "btcbooks.org/the-nakamoto-consensus. https://www.amazon.com/dp/0796178305 Own-words summary; no free full text used."
    ],
    [
        "books-pay-attention-to-bitcoin",
        "What is Pay Attention to Bitcoin about?",
        "Pay Attention to Bitcoin, by Joseph Voelbel, came out in 2024. It places Bitcoin in the longer history of money and treats it as a digital bearer asset. It's available at amazon.com/dp/B0D7K7GGTV.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/pay-attention-to-bitcoin. https://www.amazon.com/dp/B0D7K7GGTV Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-the-inverse-of-clown-world",
        "What is Bitcoin: The Inverse of Clown World about?",
        "Bitcoin: The Inverse of Clown World, by Knut Svanholm, Luke de Wolf, came out in 2024. The authors write about attention, praxeology, and why they think broken money makes public life a farce. It's available at amazon.com/dp/B0DK9WQ5QG.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-the-inverse-of-clown-world. https://www.amazon.com/dp/B0DK9WQ5QG Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-prophecy",
        "What is Bitcoin Prophecy about?",
        "Bitcoin Prophecy, by Ariel A Aguilar, came out in 2024. It uses Argentina's inflation, devaluations, and controls as the setting for a case for Bitcoin. It's available at amazon.com/dp/B0DKK1M2FP.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-prophecy. https://www.amazon.com/dp/B0DKK1M2FP Own-words summary; no free full text used."
    ],
    [
        "books-the-big-bitcoin-book",
        "What is The Big Bitcoin Book about?",
        "The Big Bitcoin Book, by Fred Krueger, Ben Sigman, came out in 2024. Beyond the title, the author, and the year, there isn't a public description. It's available at amazon.com/dp/B0DTP5RQ6K.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-big-bitcoin-book. https://www.amazon.com/dp/B0DTP5RQ6K Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-explained-like-im-5",
        "What is Bitcoin Explained Like I'm 5 about?",
        "Bitcoin Explained Like I'm 5, by Danny Scott with Henry Holligon, came out in 2024. The title says it explains Bitcoin as if the reader were five. It's available at amazon.com/dp/B0DMLVZJYM.",
        [
            "books",
            "curriculum",
            "poems-stories"
        ],
        "btcbooks.org/bitcoin-explained-like-im-5. https://www.amazon.com/dp/B0DMLVZJYM Own-words summary; no free full text used."
    ],
    [
        "books-the-bushido-of-bitcoin",
        "What is The Bushido of Bitcoin about?",
        "The Bushido of Bitcoin, by Aleksandar Svetski, came out in 2024. It maps samurai virtues onto proof of work: discipline, responsibility, and a standard a vote cannot change. It's available at amazon.com/dp/B0FRNN1WP2.",
        [
            "books",
            "philosophy",
            "curriculum"
        ],
        "btcbooks.org/the-bushido-of-bitcoin. https://www.amazon.com/dp/B0FRNN1WP2 Own-words summary; no free full text used."
    ],
    [
        "books-the-gospel-according-to-bitcoin",
        "What is The Gospel According to Bitcoin about?",
        "The Gospel According to Bitcoin, by Daniel Sherman with JM Bush, came out in 2024. It offers 21 meditations on Bitcoin. The foreword is by Jimmy Song. It's available at amazon.com/dp/B0DR3QLF41.",
        [
            "books",
            "faith___religion",
            "philosophy"
        ],
        "btcbooks.org/the-gospel-according-to-bitcoin. https://www.amazon.com/dp/B0DR3QLF41 Own-words summary; no free full text used."
    ],
    [
        "books-the-42-page-bitcoin-book",
        "What is The 42-Page Bitcoin Book about?",
        "The 42-Page Bitcoin Book, by Craig Anthony, came out in 2025. It is a pocket guide to what Bitcoin is, how it works, and why the author thinks it matters for saving. It's available at amazon.com/dp/0990320294.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-42-page-bitcoin-book. https://www.amazon.com/dp/0990320294 Own-words summary; no free full text used."
    ],
    [
        "books-the-bitcoin-times",
        "What is The Bitcoin Times about?",
        "The Bitcoin Times, by Aleksandar Svetski, Knut Svanholm, came out in 2025. It collects a first paperback of The Bitcoin Times, with pieces on why Bitcoin, not a generic blockchain, is the invention. It's available at amazon.com/dp/991693164X.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-bitcoin-times. https://www.amazon.com/dp/991693164X Own-words summary; no free full text used."
    ],
    [
        "books-the-little-book-of-bitcoin",
        "What is The Little Book of Bitcoin about?",
        "The Little Book of Bitcoin, by Anthony Scaramucci, came out in 2025. It is a short guide aimed at readers who want the case already circulating on Wall Street. It's available at amazon.com/dp/B0DSLRP4GX.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-little-book-of-bitcoin. https://www.amazon.com/dp/B0DSLRP4GX Own-words summary; no free full text used."
    ],
    [
        "books-the-little-book-of-bitcoin-who",
        "Who wrote The Little Book of Bitcoin?",
        "Anthony Scaramucci wrote The Little Book of Bitcoin, which came out in 2025. It is a short guide aimed at readers who want the case already circulating on Wall Street. It's available at amazon.com/dp/B0DSLRP4GX.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-little-book-of-bitcoin. https://www.amazon.com/dp/B0DSLRP4GX Own-words summary; no free full text used."
    ],
    [
        "books-the-little-book-of-bitcoin-idea",
        "What idea does The Little Book of Bitcoin present?",
        "It is a short guide aimed at readers who want the case already circulating on Wall Street. It's available at amazon.com/dp/B0DSLRP4GX.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-little-book-of-bitcoin. https://www.amazon.com/dp/B0DSLRP4GX Own-words summary; no free full text used."
    ],
    [
        "books-21-views-from-mount-fuji",
        "What is 21 Views From Mount Fuji about?",
        "21 Views From Mount Fuji, by Haiku Nakamoto & Carl Andrews, came out in 2025. It looks at Bitcoin the way a set of views looks at a mountain: many angles, none of them the whole thing. It's available at amazon.com/dp/B0DVGR2368.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/21-views-from-mount-fuji. https://www.amazon.com/dp/B0DVGR2368 Own-words summary; no free full text used."
    ],
    [
        "books-the-bitcoin-age",
        "What is The Bitcoin Age about?",
        "The Bitcoin Age, by Adam Livingston, came out in 2025. The author calls it a field guide to Bitcoin as a shift in value, wealth, and power. It's available at amazon.com/dp/B0DXC9445Z.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-bitcoin-age. https://www.amazon.com/dp/B0DXC9445Z Own-words summary; no free full text used."
    ],
    [
        "books-the-privatization-of-money",
        "What is The Privatization of Money about?",
        "The Privatization of Money, by Shimon Lazarov, came out in 2025. It follows a path from state money toward governments treating Bitcoin as global money. It's available at amazon.com/dp/B0DX8M7J46.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-privatization-of-money. https://www.amazon.com/dp/B0DX8M7J46 Own-words summary; no free full text used."
    ],
    [
        "books-money-love-and-bitcoin",
        "What is Money, Love, and Bitcoin about?",
        "Money, Love, and Bitcoin, by Paul J Rogers, came out in 2025. Beyond the title, the author, and the year, there isn't a public description. It's available at amazon.com/dp/B0DX2HRQZB.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/money-love-and-bitcoin. https://www.amazon.com/dp/B0DX2HRQZB Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-age",
        "What is Bitcoin Age about?",
        "Bitcoin Age, by Nik Bhatia, came out in 2025. The author of Layered Money writes about money that holds its value when other goods get cheaper to make. It's available at amazon.com/dp/B0F6QMMS4N.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-age. https://www.amazon.com/dp/B0F6QMMS4N Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-age-who",
        "Who wrote Bitcoin Age?",
        "Nik Bhatia wrote Bitcoin Age, which came out in 2025. The author of Layered Money writes about money that holds its value when other goods get cheaper to make. It's available at amazon.com/dp/B0F6QMMS4N.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-age. https://www.amazon.com/dp/B0F6QMMS4N Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-age-idea",
        "What idea does Bitcoin Age present?",
        "The author of Layered Money writes about money that holds its value when other goods get cheaper to make. It's available at amazon.com/dp/B0F6QMMS4N.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-age. https://www.amazon.com/dp/B0F6QMMS4N Own-words summary; no free full text used."
    ],
    [
        "books-the-mysterious-mr-nakamoto",
        "What is The Mysterious Mr. Nakamoto about?",
        "The Mysterious Mr. Nakamoto, by Benjamin Wallace, came out in 2025. It follows a fifteen-year effort to identify the person who published Bitcoin under the name Satoshi Nakamoto. It's available at amazon.com/dp/0593594029.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "btcbooks.org/the-mysterious-mr-nakamoto. https://www.amazon.com/dp/0593594029 Own-words summary; no free full text used."
    ],
    [
        "books-the-mysterious-mr-nakamoto-who",
        "Who wrote The Mysterious Mr. Nakamoto?",
        "Benjamin Wallace wrote The Mysterious Mr. Nakamoto, which came out in 2025. It follows a fifteen-year effort to identify the person who published Bitcoin under the name Satoshi Nakamoto. It's available at amazon.com/dp/0593594029.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "btcbooks.org/the-mysterious-mr-nakamoto. https://www.amazon.com/dp/0593594029 Own-words summary; no free full text used."
    ],
    [
        "books-the-mysterious-mr-nakamoto-idea",
        "What story does The Mysterious Mr. Nakamoto tell?",
        "It follows a fifteen-year effort to identify the person who published Bitcoin under the name Satoshi Nakamoto. It's available at amazon.com/dp/0593594029.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "btcbooks.org/the-mysterious-mr-nakamoto. https://www.amazon.com/dp/0593594029 Own-words summary; no free full text used."
    ],
    [
        "books-the-great-harvest",
        "What is The Great Harvest about?",
        "The Great Harvest, by Adam Livingston, came out in 2025. It discusses automation, labor, and why the author thinks a scarce digital money matters when work changes. It's available at amazon.com/dp/B0F5NPC1KC.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-great-harvest. https://www.amazon.com/dp/B0F5NPC1KC Own-words summary; no free full text used."
    ],
    [
        "books-self-bitcoinization",
        "What is Self Bitcoinization about?",
        "Self Bitcoinization, by Noah T Kaufman, MD, came out in 2025. The author, a physician, writes about bitcoinizing oneself as a philosophy rather than a trading guide. It's available at btcbooks.org/self-bitcoinization.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/self-bitcoinization. No retail link in the catalog. Own-words summary; no free full text used."
    ],
    [
        "books-the-bitcoin-enlightenment",
        "What is The Bitcoin Enlightenment about?",
        "The Bitcoin Enlightenment, by Ricardo B Salinas, Pascal Hügli, Daniel Jungen, came out in 2025. It argues for leaving what the authors call a fiat dark age. The foreword is by Saifedean Ammous. It's available at amazon.com/dp/B0FBXX7B6L.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/the-bitcoin-enlightenment. https://www.amazon.com/dp/B0FBXX7B6L Own-words summary; no free full text used."
    ],
    [
        "books-moral-money",
        "What is Moral Money about?",
        "Moral Money, by Eric Sammons, came out in 2025. The author argues that Bitcoin is a moral money and that government-issued fiat is a step backward. It's available at amazon.com/dp/B0FB5H3GDZ.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/moral-money. https://www.amazon.com/dp/B0FB5H3GDZ Own-words summary; no free full text used."
    ],
    [
        "books-modern-chains",
        "What is Modern Chains about?",
        "Modern Chains, by Neal Flesher, came out in 2025. The author argues that fiat money, debt, and inflation work as a quiet form of economic dependence. It's available at amazon.com/dp/B0FH4L6P5S.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/modern-chains. https://www.amazon.com/dp/B0FH4L6P5S Own-words summary; no free full text used."
    ],
    [
        "books-future-proof",
        "What is Future Proof about?",
        "Future Proof, by Erin E Malone, came out in 2025. It pairs Bitcoin as a way to protect time with longevity as what a person does with that time. It's available at amazon.com/dp/B0FMCT6QQ9.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/future-proof. https://www.amazon.com/dp/B0FMCT6QQ9 Own-words summary; no free full text used."
    ],
    [
        "books-the-devil-takes-bitcoin",
        "What is The Devil Takes Bitcoin about?",
        "The Devil Takes Bitcoin, by Jake Adelstein, came out in 2025. It investigates Mt Gox, the Tokyo exchange that collapsed with a large amount of bitcoin missing. It's available at amazon.com/dp/B0FWFP2XTP.",
        [
            "books",
            "history",
            "satoshi-nakamoto"
        ],
        "btcbooks.org/the-devil-takes-bitcoin. https://www.amazon.com/dp/B0FWFP2XTP Own-words summary; no free full text used."
    ],
    [
        "books-getting-off-zero",
        "What is Getting Off Zero about?",
        "Getting Off Zero, by B!t Doug, came out in 2025. It is a short book for a reader who still holds no bitcoin. It is not a forecast. It's available at amazon.com/dp/B0FX5YR18M.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/getting-off-zero. https://www.amazon.com/dp/B0FX5YR18M Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-is-for-everyone",
        "What is Bitcoin Is for Everyone about?",
        "Bitcoin Is for Everyone, by Natalie Brunell, came out in 2025. The author describes a financial system she calls broken and presents Bitcoin as a path toward a life a person can afford. It's available at amazon.com/dp/1804091138.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-is-for-everyone. https://www.amazon.com/dp/1804091138 Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-is-for-everyone-who",
        "Who wrote Bitcoin Is for Everyone?",
        "Natalie Brunell wrote Bitcoin Is for Everyone, which came out in 2025. The author describes a financial system she calls broken and presents Bitcoin as a path toward a life a person can afford. It's available at amazon.com/dp/1804091138.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-is-for-everyone. https://www.amazon.com/dp/1804091138 Own-words summary; no free full text used."
    ],
    [
        "books-bitcoin-is-for-everyone-idea",
        "What idea does Bitcoin Is for Everyone present?",
        "The author describes a financial system she calls broken and presents Bitcoin as a path toward a life a person can afford. It's available at amazon.com/dp/1804091138.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/bitcoin-is-for-everyone. https://www.amazon.com/dp/1804091138 Own-words summary; no free full text used."
    ],
    [
        "books-defending-bitcoin",
        "What is Defending Bitcoin about?",
        "Defending Bitcoin, by Luke de Wolf, came out in 2026. It applies industrial cybersecurity to custody, nodes, and the network, from lost keys to quantum risk. It's available at amazon.com/dp/B0H3GB35KZ.",
        [
            "books",
            "money",
            "problems-of-money"
        ],
        "btcbooks.org/defending-bitcoin. https://www.amazon.com/dp/B0H3GB35KZ Own-words summary; no free full text used."
    ],
    [
        "books-black-red-and-orange",
        "What is Black, Red, and Orange about?",
        "Black, Red, and Orange, by Benjamin de Waal, came out in 2026. The author makes a case for Bitcoin to anarchists and libertarian socialists who dismissed it because of who was holding it. It's available at amazon.com/dp/B0HDSKP2KV.",
        [
            "books",
            "politics",
            "history"
        ],
        "btcbooks.org/black-red-and-orange. https://www.amazon.com/dp/B0HDSKP2KV Own-words summary; no free full text used."
    ],
    [
        "books-orange-black-and-red",
        "What is Orange, Black, and Red about?",
        "Orange, Black, and Red, by Benjamin de Waal, came out in 2026. The companion volume argues that instincts which draw people to Bitcoin belong to an older anti-monopoly tradition. It's available at amazon.com/dp/B0HDSS1VCB.",
        [
            "books",
            "politics",
            "history"
        ],
        "btcbooks.org/orange-black-and-red. https://www.amazon.com/dp/B0HDSS1VCB Own-words summary; no free full text used."
    ],
    [
        "books-why-zack-polanski-should-embrace-bitcoin",
        "What is de Waal's book about a Green leader and Bitcoin?",
        "Why Zack Polanski Should Embrace Bitcoin, by Benjamin de Waal, came out in 2026. A Green Party member asks Britain's Green leader to aim a suspicion of concentrated power at how money is created. It's available at amazon.com/dp/B0HDSJ8W11.",
        [
            "books",
            "politics",
            "history"
        ],
        "btcbooks.org/why-zack-polanski-should-embrace-bitcoin. https://www.amazon.com/dp/B0HDSJ8W11 Own-words summary; no free full text used."
    ]
])
);
