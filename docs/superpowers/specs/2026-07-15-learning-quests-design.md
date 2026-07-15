# Learning Quests — Design Spec
**Date:** 2026-07-15  
**Status:** Approved  
**Feature:** `learning-quests.js` — Slideshow lessons + quiz gate per Bitcoin topic

---

## 1. Overview

Learning Quests are self-contained, interactive bite-sized lessons on major Bitcoin topics. Each quest has:
1. **A lesson slideshow** — 3–5 slides per topic (5 slides for 7 topics; 3 slides for `bitcoin-only`) — headline + 2–3 sentences + themed CSS/SVG illustration + slide transition animations + sound effects
2. **A quiz gate** (5 questions, 4/5 to pass) — immediate answer reveal, shuffled retakes
3. **A "Dig Deeper" panel** shown after passing — links to relevant archive channels

Users access all quests via a **Topic Checklist Hub** (pass/fail status per topic). The entry point is a new button in the Learn dropdown menu (`mobile-ux.js`), placed between Nacho's Trails and Daily Quests.

---

## 2. New File: `learning-quests.js`

**Lazy-loaded** — NOT in `SOURCES` in `build.sh`. Loaded on demand (same pattern as `modules.js`):

```js
// In app.js go() handler for id === 'learning-quests':
_lazyLoad('learning-quests.js', function() { renderLearningQuestHub(); });
```

Also add `'learning-quests'` to `_lazyRoutes` array in `app.js` and add a hash route `case 'learning-quests'` mirroring the `'trails'` case.

Add to `_SEO_APP_PAGES` in `app.js`: `'learning-quests'`.

Add to APP_PAGES spotlight entry in `app.js`:
```js
{ id: '_lq', title: '📖 Learning Quests', desc: 'Interactive Bitcoin lessons with slideshow, animations & quiz. 8 topics.', keywords: 'learning quest lesson slideshow quiz topic bitcoin mining nodes lightning scarcity decentralization privacy self-custody altcoin', action: "go('learning-quests')" }
```

---

## 3. Storage

### localStorage
```json
// Key: "btc_lq_progress"
{
  "mining":          { "passed": true,  "lessonSeen": true,  "attempts": 1, "bestScore": 5, "passedAt": 1720000000000 },
  "nodes":           { "passed": false, "lessonSeen": true,  "attempts": 2, "bestScore": 3 },
  "what-is-bitcoin": { "passed": false, "lessonSeen": false, "attempts": 0 }
}
```

`lessonSeen: true` is set when the user reaches the final slide of a topic. It gates the +50 XP lesson-completion award so it never fires twice.

### Firestore
On every save: `db.collection('users').doc(uid).update({ lqProgress: <object> })`

On login — **max-progress merge** (never clobber local gains):
- For each topic key, if EITHER Firestore OR localStorage has `passed: true` → merged result is `passed: true`
- `lessonSeen: true` treated the same way
- `bestScore` → take the higher value
- `attempts` → take the higher value
- After merge, write the merged object back to both localStorage AND Firestore

**Unauthenticated guests:** progress saves to localStorage only. On first login/sign-up, run the same max-progress merge so offline guest progress is promoted to Firestore (never overwritten).

---

## 4. Topics (v1 — 8 topics, easily extensible)

| # | Slug | Emoji | Title | Slides | Badge ID | Badge Name |
|---|------|-------|-------|--------|----------|------------|
| 1 | `what-is-bitcoin` | 🟠 | What is Bitcoin? | 5 | `lq_what_is_bitcoin` | 🟠 Bitcoin Basics |
| 2 | `mining` | ⛏️ | Mining & Proof of Work | 4 | `lq_mining` | ⛏️ Hash Slinger |
| 3 | `nodes` | 🖥️ | Nodes & Decentralization | 4 | `lq_nodes` | 🖥️ Node Runner |
| 4 | `self-custody` | 🔑 | Self-Custody & Your Keys | 5 | `lq_self_custody` | 🔑 Sovereign Stacker |
| 5 | `lightning` | ⚡ | The Lightning Network | 4 | `lq_lightning` | ⚡ Lightning Pleb |
| 6 | `scarcity` | 💎 | Bitcoin's Fixed Supply | 4 | `lq_scarcity` | 💎 21M Believer |
| 7 | `bitcoin-only` | 🛡️ | Why Bitcoin, Not Crypto | 3 | `lq_bitcoin_only` | 🛡️ Bitcoin Maximalist |
| 8 | `privacy` | 🕵️ | Privacy & Sovereignty | 4 | `lq_privacy` | 🕵️ Cypherpunk |

**Graduate badge** (all 8 passed): `lq_graduate` — 📖 Learning Quest Graduate

---

## 5. Rewards

| Event | XP | Tickets | Badge |
|-------|----|---------|-------|
| Complete lesson (view all slides) — first time | +50 XP | — | — |
| Pass quiz (≥4/5) — first time per topic | +100 XP | — | Topic badge |
| Complete all 8 quizzes | +250 XP | 10 🎟️ | `lq_graduate` |

Total earnable: 50×8 (lesson) + 100×8 (quiz) + 250 (graduate) = **1,450 XP + 10 tickets**

XP is awarded via existing `awardPoints(amount, reason)`. Tickets via `awardOrangeTickets(n, reason)`. Badges via `awardHiddenBadge(id, name)`.

**Double-award prevention:**
- Lesson +50 XP: gated by `lessonSeen` flag — check before calling `awardPoints`
- Quiz +100 XP + topic badge: gated by `passed` flag
- Graduate +250 XP + 10 tickets + `lq_graduate` badge: gated by `localStorage.getItem('btc_lq_graduate_awarded') !== '1'`; set `'1'` immediately before awarding

---

## 6. Learn Menu Integration (`mobile-ux.js`)

In `toggleMobileLearnMenu()`, insert a new button **after** Nacho's Trails and **before** Daily Quests:

```html
<button onclick="document.getElementById('mobileLearnMenu').remove();go('learning-quests')"
  style="padding:12px 14px;background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(5,150,105,0.06));
  border:1px solid #10b981;color:#10b981;border-radius:12px;font-weight:800;cursor:pointer;
  font-size:0.88rem;text-align:left;font-family:inherit;touch-action:manipulation;
  display:flex;align-items:center;gap:8px;">
  📖 Learning Quests <span style="margin-left:auto;font-size:0.7rem;opacity:0.8;">8 topics ▸</span>
</button>
```

---

## 7. Badge Definitions (`badges.js`)

Add 9 new badges to `BADGE_DEFS` array, all `hidden: false`:

```js
// --- Learning Quests ---
{ id: 'lq_what_is_bitcoin', name: '🟠 Bitcoin Basics',       emoji: '🟠', pts: 0, desc: 'Passed the What is Bitcoin? Learning Quest',           hint: 'Complete the Bitcoin Basics Learning Quest' },
{ id: 'lq_mining',          name: '⛏️ Hash Slinger',          emoji: '⛏️', pts: 0, desc: 'Passed the Mining & Proof of Work Learning Quest',     hint: 'Complete the Mining Learning Quest' },
{ id: 'lq_nodes',           name: '🖥️ Node Runner',           emoji: '🖥️', pts: 0, desc: 'Passed the Nodes & Decentralization Learning Quest',   hint: 'Complete the Nodes Learning Quest' },
{ id: 'lq_self_custody',    name: '🔑 Sovereign Stacker',     emoji: '🔑', pts: 0, desc: 'Passed the Self-Custody & Keys Learning Quest',        hint: 'Complete the Self-Custody Learning Quest' },
{ id: 'lq_lightning',       name: '⚡ Lightning Pleb',         emoji: '⚡', pts: 0, desc: 'Passed the Lightning Network Learning Quest',          hint: 'Complete the Lightning Learning Quest' },
{ id: 'lq_scarcity',        name: '💎 21M Believer',           emoji: '💎', pts: 0, desc: 'Passed the Fixed Supply Learning Quest',              hint: 'Complete the Scarcity Learning Quest' },
{ id: 'lq_bitcoin_only',    name: '🛡️ Bitcoin Maximalist',    emoji: '🛡️', pts: 0, desc: 'Passed the Why Bitcoin, Not Crypto Learning Quest',   hint: 'Complete the Bitcoin-Only Learning Quest' },
{ id: 'lq_privacy',         name: '🕵️ Cypherpunk',            emoji: '🕵️', pts: 0, desc: 'Passed the Privacy & Sovereignty Learning Quest',     hint: 'Complete the Privacy Learning Quest' },
{ id: 'lq_graduate',        name: '📖 Learning Quest Graduate',emoji: '📖', pts: 0, desc: 'Completed ALL 8 Learning Quests — true Bitcoin scholar', hint: 'Pass all 8 Learning Quests' },
```

Add badge category in badge display section:
```js
'📖 Learning Quests': _cat(BADGE_DEFS, b => b.id.startsWith('lq_')),
```

---

## 8. UI Flow

### 8a. Topic Hub (main screen)
- Full-screen overlay panel (same pattern as Quest Hub / Modules)  
- Header: "📖 Learning Quests" + close button + overall progress `X/8 completed`  
- Progress bar across the top  
- Grid of topic cards (2-col on mobile): emoji, topic name, status chip  
  - ⬜ **Not started** (no key in `btc_lq_progress`) — muted style, "Start →" label
  - 🟡 **Attempted** (`passed: false, attempts > 0`) — amber chip showing best score e.g. "3/5", "Retry →" label  
  - ✅ **Passed** (`passed: true`) — green chip, "Review / Dig Deeper" label
  - All topics are unlocked from the start — no gating
  - Tapping any card opens that topic's lesson

### 8b. Lesson Slideshow
- Full-screen overlay with dark background  
- Progress dots at top (e.g. ● ○ ○ ○ for slide 1 of 4)  
- **Slide structure:**
  - Large themed SVG/CSS illustration (top ~45% of screen)
  - Short headline (bold, large)
  - 2–3 sentences of body copy
  - Back arrow (left) + Next arrow (right), or swipe on mobile
- **Transitions:** CSS slide-in from right (next) / left (back). Each slide entrance plays a subtle `swoosh` tone (ascending sine blip using `AudioContext`). Final slide has a "Take the Quiz →" CTA button.
- **Illustrations:** Inline CSS/SVG — no external image files. One per topic slot:
  - Mining: animated SHA-256 loop (rotating hash ring, flashing nonce digits)
  - Nodes: animated peer-to-peer network graph (nodes connecting with lines)
  - Lightning: animated ZAP bolt graph with payment hops
  - Self-custody: animated key + lock illustration
  - Scarcity: countdown block reward halving clock
  - Bitcoin basics: orange coin with pulse glow
  - Bitcoin-only: shield blocking altcoin chaos
  - Privacy: eye with a strikethrough + cypherpunk motif

### 8c. Quiz
- 5 questions, presented one at a time  
- Question number indicator: "Question 3 of 5"  
- Answer choices: 4 buttons (A/B/C/D)  
- On tap: chosen button lights up green ✅ or red ❌, correct answer always highlighted green, brief explanation text shown below  
- Sound: correct answer → ascending two-note ding (reuse `playCoinSound` variant); wrong answer → descending buzz tone (new `playWrongSound`)  
- "Next →" button appears after answer is revealed  
- **Score screen:** large score display, pass banner (🎉 4+/5) or try again (X/5), XP awarded if first pass, badge awarded if first pass, retake button always present  
- On pass: confetti via `launchConfetti()`, then segue to "Dig Deeper" panel
- **Mid-quiz abandonment:** closing the overlay mid-quiz does NOT increment `attempts`; attempts only increment when score screen is shown. Lesson always resumes from slide 1 on re-entry.

### 8c-graduate. Graduate Award
Triggered immediately after the 8th topic's score screen shows a pass (detected by checking all 8 topic slugs have `passed: true` after saving). Before showing Dig Deeper:
- Show a full-screen overlay: 🎓 **"Learning Quest Graduate!"**, earned totals (1,450 XP · 10 tickets · 9 badges), trophy animation
- Award `lq_graduate` badge + 250 XP + 10 tickets (only if `btc_lq_graduate_awarded !== '1'`; set it to `'1'` before awarding)
- CTA: "📚 Explore the Full Archive →" — calls `closeAllOverlays()` then `toggleMenu()`

### 8d. Dig Deeper Panel
- Shows after passing a topic (also accessible from the topic hub card for already-passed topics)  
- "Want to go deeper? Explore these archive channels:"  
- 2–4 channel link buttons that call `go('channel-id')`  
- "← Back to Learning Quests" button

---

## 9. Sound Effects (all via `AudioContext`, respect `canPlaySound()`)

All sounds are **synthesized inline in `learning-quests.js`** as module-local functions — do NOT call global `playCoinSound()` to avoid cross-file coupling. All wrapped in `if (window.canPlaySound()) { try { ... } catch(e) {} }`.

| Function | Event | AudioContext params |
|----------|-------|---------------------|
| `_lqPlaySlide()` | Slide transition | `sine` osc, freq ramp 440→660Hz over 0.08s, gain 0.10→0.001 |
| `_lqPlayCorrect()` | Correct answer | Two `triangle` notes: 880Hz then 1108Hz, 0.09s each, gain 0.18→0.001 |
| `_lqPlayWrong()` | Wrong answer | `sawtooth` osc, freq ramp 300→150Hz over 0.15s, gain 0.14→0.001 |
| `_lqPlayPass()` | Quiz pass 🎉 | 4-note arpeggio: C4(261)→E4(329)→G4(392)→C5(523), `sine`, 0.12s each, staggered starts |
| `_lqPlayFail()` | Quiz fail | Two `sine` notes: 500Hz then 350Hz, 0.2s each, gain 0.12→0.001 |
| `_lqPlayPass()` ×2 | Graduate overlay | Called twice 0.3s apart |

---

## 10. Lesson Content (All 8 Topics)

### Topic 1: What is Bitcoin? (5 slides)
1. **"Bitcoin is Money, Reimagined"** — Bitcoin is a form of money that exists only on the internet. Unlike dollars or euros, no government or bank controls it. It was created in 2009 by someone called Satoshi Nakamoto.
2. **"It Runs on Math, Not Trust"** — Bitcoin transactions are secured by cryptography — mathematical proofs that are nearly impossible to fake. You don't have to trust a bank, a CEO, or a government. The math doesn't lie.
3. **"There Will Only Ever Be 21 Million"** — Like gold, Bitcoin is scarce. But unlike gold, its scarcity is guaranteed forever in computer code. No politician can order more to be printed. 21 million. That's it. Final.
4. **"Anyone Can Use It"** — Bitcoin works the same whether you're a billionaire in New York or a farmer in Nigeria. All you need is a phone. No bank account required. No permission needed.
5. **"You Can Send It Anywhere, Instantly"** — Sending $1 million in Bitcoin works just like sending $1. It crosses borders in minutes, 24/7/365, with no middleman taking a cut.
**Quiz questions:** 5 questions on Bitcoin basics, supply, permissionlessness, Satoshi, and censorship resistance.
**Dig Deeper:** `one-stop-shop`, `whitepaper`, `money`, `misconceptions-fud`

### Topic 2: Mining & Proof of Work (4 slides)
1. **"Mining is a Giant Lottery"** — Bitcoin miners are computers competing to solve a puzzle. The puzzle: find a number that makes a specific hash start with many zeros. The first to find it wins the block reward.
2. **"It's Not Math — It's Guessing"** — Miners don't "solve equations." They try billions of random numbers per second (nonces) until one works. It's pure brute force — a SHA-256 lottery at industrial scale.
3. **"Work = Proof = Security"** — Once a miner wins and adds a block, changing that block would require redoing all the work after it. The chain gets more secure with every block. That's Proof of Work.
4. **"Miners Earn Bitcoin for Securing the Network"** — Miners receive newly minted bitcoin (the block reward) + transaction fees. Every ~4 years the reward halves. By ~2140, all 21 million will be mined.
**Quiz questions:** SHA-256, nonce, block reward, halvings, difficulty adjustment.
**Dig Deeper:** `mining`, `difficulty-adjustment`, `energy`, `blockchain-timechain`

### Topic 3: Nodes & Decentralization (4 slides)
1. **"A Node is a Copy of All of Bitcoin"** — Every Bitcoin node holds the full history of every transaction ever made — all the way back to block 0. There are tens of thousands of them, worldwide.
2. **"No Single Point of Failure"** — Bitcoin has no headquarters, no CEO, no server to shut down. Even if half the nodes went offline tomorrow, Bitcoin would keep running. That's decentralization.
3. **"Don't Trust — Verify"** — When you run your own node, you don't have to believe anyone. Your node checks every rule itself. No bank or exchange can lie to you about your balance.
4. **"Nodes Enforce the Rules"** — Nodes reject any transaction or block that breaks Bitcoin's rules. Even miners must play by the rules nodes enforce. Users, not miners, are sovereign.
**Quiz questions:** node purpose, full nodes vs. light wallets, decentralization, network resilience, verification.
**Dig Deeper:** `nodes`, `decentralized`, `pow-vs-pos`, `secure`

### Topic 4: Self-Custody & Your Keys (5 slides)
1. **"Not Your Keys, Not Your Coins"** — If someone else holds your Bitcoin, they hold your Bitcoin. Exchanges can freeze accounts, go bankrupt, or get hacked. Mt. Gox. Celsius. FTX. All gone.
2. **"Your Private Key is Like a Master Password"** — Every Bitcoin wallet has a private key — a secret number that proves ownership. Anyone with your private key can spend your bitcoin. Guard it with your life.
3. **"Your Seed Phrase is the Real Backup"** — Most modern wallets give you a 12 or 24-word seed phrase. This is the master key to everything. Write it down on paper (not a screenshot!). Store it offline.
4. **"Hardware Wallets Keep Keys Offline"** — A hardware wallet stores your private key on a device that never touches the internet. Even if your computer gets hacked, your Bitcoin is safe.
5. **"Self-Custody is Financial Sovereignty"** — When you hold your own keys, no government can seize your funds with a court order to your bank. No exchange can deny your withdrawal. You are the bank.
**Quiz questions:** private vs. public key, seed phrase, hardware wallets, custodial risk, not-your-keys rule.
**Dig Deeper:** `self-custody`, `cryptography`, `hardware`, `public_key_vs_private_key`

### Topic 5: The Lightning Network (4 slides)
1. **"Bitcoin's Base Layer is Slow on Purpose"** — Bitcoin on-chain settles every ~10 minutes with limited block space. This is intentional — it maximizes security and decentralization. But for everyday payments, we need faster.
2. **"Lightning Opens Payment Channels"** — Two parties lock bitcoin into a shared channel. They can then send payments back and forth instantly, thousands of times, with near-zero fees — without touching the blockchain.
3. **"Payments Route Through the Network"** — You don't need a direct channel with everyone. Payments route through a network of channels, like hops on a flight, until they reach the destination. All in milliseconds.
4. **"It Enables Real Bitcoin Payments"** — Buy coffee, pay a content creator, send to family overseas — Lightning makes micro-payments viable. This archive itself uses Lightning for tipping and earning sats.
**Quiz questions:** payment channels, routing, on-chain vs. Lightning, fees, real-world use cases.
**Dig Deeper:** `layer-2-lightning`, `fedi-ark`, `lightning_node`, `use-cases`

### Topic 6: Bitcoin's Fixed Supply (4 slides)
1. **"21 Million. Hard Cap. Forever."** — Bitcoin's code limits its total supply to exactly 21,000,000 BTC. This isn't a promise — it's a rule enforced by every node on the network. Nobody can override it.
2. **"New Bitcoin is Created by Miners"** — When miners add a block to the chain, they receive newly minted bitcoin. This started at 50 BTC per block in 2009 and halves every ~210,000 blocks (~4 years).
3. **"Each Halving Reduces Inflation"** — After the 2024 halving, the reward dropped to 3.125 BTC per block. By ~2140, new bitcoin creation stops entirely. Only transaction fees will reward miners then.
4. **"Scarcity Drives Value"** — Every dollar printed dilutes your savings. Bitcoin does the opposite: as adoption grows and supply stays fixed, each bitcoin becomes harder to acquire. It's why Bitcoiners HODL.
**Quiz questions:** total supply, halving schedule, inflation comparison to fiat, 2140, stock-to-flow concept.
**Dig Deeper:** `scarce`, `money`, `investment-strategy`, `problems-of-money`

### Topic 7: Why Bitcoin, Not Crypto (3 slides)
1. **"Most Crypto is Not Like Bitcoin"** — Most altcoins have founders who can change the rules, premines that enrich insiders, and no real decentralization. They are centralized projects wearing a blockchain costume.
2. **"Bitcoin's Properties Are Unique"** — Bitcoin was launched fairly (no premine, no CEO, anonymous founder who disappeared). Every other coin was created after Bitcoin proved the concept — and none has replicated its properties.
3. **"Altcoins Are Solutions Looking for Problems"** — Bitcoin solves the hardest problem in computer science (trustless, decentralized digital money). Altcoins typically solve problems that don't require blockchains at all — or problems Bitcoin already solves.
**Quiz questions:** premine, Ethereum's PoS switch, Bitcoin's fair launch, decentralization claims, ICO history.
**Dig Deeper:** `evidence-against-alts`, `maximalism`, `pow-vs-pos`, `dominant`

### Topic 8: Privacy & Sovereignty (4 slides)
1. **"Bitcoin Is Pseudonymous, Not Anonymous"** — Bitcoin addresses don't show names — but all transactions are public on the blockchain. Chain analysis firms can trace transactions. Privacy requires deliberate effort.
2. **"Financial Privacy is a Human Right"** — When governments or corporations can see all your transactions, they have leverage over your choices. Bitcoin gives you tools to protect your financial privacy without breaking laws.
3. **"Sovereign Tools Exist"** — Coin control, CoinJoin, running your own node, using Lightning, using non-KYC exchanges — these are tools Bitcoiners use to preserve privacy and resist surveillance.
4. **"Bitcoin Enables Exit from Broken Systems"** — In countries with hyperinflation, capital controls, or authoritarian regimes, Bitcoin is a lifeline. Privacy and censorship resistance aren't nice-to-haves — they're survival tools.
**Quiz questions:** pseudonymous vs. anonymous, chain analysis, CoinJoin, KYC, financial sovereignty.
**Dig Deeper:** `privacy-nonkyc`, `coin_mixing_coinjoin_coin_control_utxo`, `peaceful`, `human_rights__social_justice_and_freedo`

---

## 11. Quiz Questions Bank

Each topic has **8 questions** (5 picked randomly per attempt, no repeats within a session).

### Mining (8 Qs)
1. What does a Bitcoin miner actually do? **A: Tries billions of random numbers (nonces) until a valid hash is found** | Wrong: Solves complex equations | Validates payment card transactions | Mines physical gold
2. What is SHA-256? **A: The hashing algorithm that secures Bitcoin's proof of work** | Wrong: The name of Bitcoin's first block | A government encryption standard for banking | Bitcoin's smart contract language
3. What is a nonce? **A: A random number miners change to try to find a valid block hash** | Wrong: A type of Bitcoin transaction fee | The minimum mining difficulty | A node identifier
4. What happens to the block reward every ~4 years? **A: It halves** | Wrong: It doubles | It stays the same | It is voted on by miners
5. What is proof of work? **A: Evidence that computational energy was expended to produce a valid block** | Wrong: A legal document proving Bitcoin ownership | A government-issued mining license | A receipt from a pool
6. Why is changing an old Bitcoin block nearly impossible? **A: You'd have to redo all the proof of work for that block and every block after it** | Wrong: Old blocks are deleted after 10 years | The blockchain is stored on government servers | Satoshi hardcoded a lock after block 1000
7. What is the Bitcoin difficulty adjustment? **A: A mechanism that increases or decreases mining difficulty every 2016 blocks to target 10-minute block times** | Wrong: A voting system for miners to set fees | A limit on how many miners can join the network | The process of halving the block reward
8. What does a miner receive when they successfully mine a block? **A: The block reward (new bitcoin) plus transaction fees** | Wrong: A government subsidy | The private keys of all transactions in the block | Proof-of-work tokens redeemable for fiat

### Nodes (8 Qs)
1. What is a Bitcoin full node? **A: A computer that downloads and verifies the entire Bitcoin blockchain** | Wrong: A mining rig that earns block rewards | A government-approved server that stores user data | A wallet app on your phone
2. What is the main purpose of running your own node? **A: To independently verify transactions without trusting anyone else** | Wrong: To earn bitcoin by validating transactions | To vote on Bitcoin protocol upgrades | To speed up your Bitcoin transactions
3. What happens if a miner produces a block that breaks Bitcoin's rules? **A: Nodes reject the invalid block** | Wrong: The block is accepted but flagged | Satoshi's Foundation overrides it | Other miners automatically fix it
4. Why is decentralization important for Bitcoin? **A: It means there is no single point of failure or central authority that can be attacked or censored** | Wrong: It makes Bitcoin faster | It lowers transaction fees | It makes mining more profitable
5. How many full nodes does Bitcoin have approximately? **A: Tens of thousands, distributed worldwide** | Wrong: Exactly 21 | About 100 run by banks | 3 operated by Satoshi
6. What does "don't trust, verify" mean in Bitcoin? **A: You should run your own node to independently confirm the rules are being followed** | Wrong: Trust your exchange but check your balance | Never trade Bitcoin peer-to-peer | Use a hardware wallet for every transaction
7. Can Bitcoin be shut down by any government? **A: No — there is no central server to shut down; nodes run globally** | Wrong: Yes — the US could block all internet traffic | Yes — Satoshi still controls the protocol | No — but only because it's registered as a nonprofit
8. What is the difference between a light wallet and a full node? **A: A light wallet trusts third-party servers; a full node verifies everything itself** | Wrong: Light wallets are more secure | Full nodes only work on desktop computers | Light wallets hold more bitcoin

### Self-Custody (8 Qs)  
1. What does "not your keys, not your coins" mean? **A: If someone else holds your private keys, they control your bitcoin — not you** | Wrong: Physical coins must be stored in a safe | You can't spend bitcoin unless you mined it | Keys must be printed on physical paper
2. What is a seed phrase? **A: A set of 12–24 words that can restore a Bitcoin wallet** | Wrong: A password to log into an exchange | A Bitcoin address for receiving funds | A QR code printed on hardware wallets
3. What is the safest way to store your seed phrase? **A: Written on paper or engraved in metal, stored offline** | Wrong: Screenshot saved to iCloud | Text message to yourself | PDF saved on your computer
4. What is a hardware wallet? **A: A physical device that stores private keys offline, never exposing them to the internet** | Wrong: A special bank account for Bitcoin | An app that stores bitcoin on your phone | A USB drive with bitcoin files
5. What was FTX? **A: A centralized exchange that collapsed in 2022, causing billions in customer losses** | Wrong: A Bitcoin hardware wallet manufacturer | A layer-2 Lightning payment protocol | A Bitcoin mining pool
6. What is a private key? **A: A secret number that proves ownership and authorizes Bitcoin transactions** | Wrong: Your username on an exchange | The password to your email | The recovery code for your phone
7. What is the advantage of multi-signature (multisig) wallets? **A: Multiple keys must sign to authorize a transaction, reducing single-point-of-failure risk** | Wrong: They double the amount of bitcoin you can store | They are faster than regular wallets | Multisig wallets earn interest
8. Why should you never share your seed phrase? **A: Anyone with your seed phrase can steal all your bitcoin instantly** | Wrong: Sharing it helps with tax reporting | Exchanges need it for verification | It helps with key recovery if you forget your pin

### What is Bitcoin (8 Qs)
1. Who created Bitcoin? **A: Satoshi Nakamoto, an anonymous person or group** | Wrong: The US Federal Reserve | A team at MIT | Mark Zuckerberg
2. When was Bitcoin created? **A: 2009** | Wrong: 1999 | 2013 | 2001
3. What is Bitcoin's maximum supply? **A: 21 million BTC** | Wrong: 1 billion | Unlimited | 100 million
4. What technology underpins Bitcoin's security? **A: Cryptography and proof of work** | Wrong: Government encryption standards | SQL databases | The SWIFT banking network
5. Can anyone be denied access to Bitcoin? **A: No — Bitcoin is permissionless; anyone with internet access can use it** | Wrong: You must pass a KYC check | Only US citizens can hold it | Banks must approve your wallet
6. What is censorship resistance? **A: No authority can block or reverse a valid Bitcoin transaction** | Wrong: Bitcoin is banned in most countries | Transactions require bank approval | Only miners can approve payments
7. What does "trustless" mean in Bitcoin? **A: The system works without needing to trust any third party — math enforces the rules** | Wrong: Bitcoin has no security | You must trust the exchange to hold your funds | Transactions are unverified
8. How does sending $1M in Bitcoin compare to sending $1? **A: They work identically — amount doesn't change fees or time** | Wrong: Larger amounts require bank approval | $1M transactions take 3 days to confirm | Large transfers require ID verification

### Lightning Network (8 Qs)
1. What is a payment channel in Lightning? **A: A locked bitcoin balance between two parties that enables instant off-chain payments** | Wrong: A social media channel for Bitcoin payments | A government-approved payment gateway | A type of hardware wallet connection
2. Why is Lightning faster than on-chain Bitcoin? **A: Payments route off-chain between channels without waiting for block confirmations** | Wrong: Lightning uses a faster blockchain | Lightning bypasses Bitcoin's security | It uses credit cards
3. What does it mean for a Lightning payment to "route"? **A: A payment hops through multiple channels to reach the destination without a direct connection** | Wrong: The payment waits in a queue | A miner approves each hop | Payments route through bank servers
4. What is a Lightning invoice? **A: A payment request with amount and destination encoded in a string** | Wrong: A tax document for Lightning transactions | A government license for node operators | A receipt from a banking partner
5. What is the key advantage of Lightning for micropayments? **A: Near-zero fees and instant settlement make tiny payments economically viable** | Wrong: Lightning creates new bitcoin | There are no fees at all | Government subsidies cover the fees
6. What must happen before using a Lightning channel? **A: An on-chain Bitcoin transaction to fund and open the channel** | Wrong: Registering with an exchange | Purchasing a Lightning license | Installing special hardware
7. What is a Lightning node? **A: Software that opens channels, routes payments, and earns fees for providing liquidity** | Wrong: A mining rig that earns block rewards | A government-approved payment processor | A bookmark in a Bitcoin app
8. Can Lightning payments be censored by a bank? **A: No — Lightning is peer-to-peer and censorship-resistant like Bitcoin itself** | Wrong: Banks can block Lightning wallets | The Federal Reserve monitors all Lightning payments | Only large payments can be blocked

### Scarcity (8 Qs)
1. How many bitcoin will ever exist? **A: 21 million** | Wrong: 100 million | An unlimited supply | 1 trillion satoshis
2. What is a Bitcoin halving? **A: A scheduled event every ~4 years that cuts the block reward in half** | Wrong: A penalty for miners who produce invalid blocks | A protocol vote to reduce fees | A government tax on mining
3. When does new Bitcoin creation stop entirely? **A: Around the year 2140** | Wrong: 2030 | 2050 | Never — it slows but never stops
4. How does Bitcoin's supply model compare to fiat currency? **A: Bitcoin has a fixed, predictable supply; fiat can be printed in unlimited quantities** | Wrong: Both are unlimited | Fiat is scarcer than Bitcoin | They follow the same model
5. How much was the block reward after the April 2024 halving? **A: 3.125 BTC** | Wrong: 6.25 BTC | 1 BTC | 50 BTC
6. What is the relationship between scarcity and value? **A: Scarcity combined with demand drives value — the less there is of something useful, the more it tends to be worth** | Wrong: Scarcity makes things cheaper | Bitcoin's value is set by governments | Scarcity only matters for physical goods
7. What backs Bitcoin's value? **A: Scarcity, security, energy expenditure, and growing adoption** | Wrong: Gold reserves held by Satoshi | A government guarantee | The US dollar
8. What is a satoshi? **A: The smallest unit of Bitcoin — 0.00000001 BTC** | Wrong: Bitcoin's founder's full name | A type of block reward | 1,000 bitcoin

### Bitcoin-Only (8 Qs)
1. What is a premine? **A: When founders create and hold a large portion of a cryptocurrency before public launch** | Wrong: The process of mining Bitcoin before blocks | A type of hardware wallet | A cold storage technique
2. Did Bitcoin have a premine? **A: No — Bitcoin was launched fairly with no allocation to founders** | Wrong: Yes — Satoshi owns 50% | Yes — banks premined the first 1000 blocks | Yes — the US government premined it
3. What is the main argument for Bitcoin being the only valid cryptocurrency? **A: Bitcoin solved the hardest problem (trustless digital money) with unique properties no other coin replicates** | Wrong: Bitcoin has the best marketing team | Governments will ban all other coins | Bitcoin is the oldest and therefore safest
4. What did Ethereum do in 2022 that critics say undermined its decentralization? **A: Switched from Proof of Work to Proof of Stake, concentrating power with large coin holders** | Wrong: Hired a CEO to manage the protocol | Was acquired by a bank | Removed all transaction fees
5. What is an ICO? **A: Initial Coin Offering — a fundraising event where founders sell new tokens, often to retail investors** | Wrong: An international currency order | A mining certification | A Bitcoin exchange type
6. Why do Bitcoin maximalists argue altcoins are unnecessary? **A: Most use cases claimed by altcoins are either not real problems or are already solved by Bitcoin/Lightning** | Wrong: Altcoins are illegal in most countries | Bitcoin's code prevents any other currency | Altcoins are all government created
7. What is the primary critique of Proof of Stake consensus? **A: It favors the already-wealthy (more coins = more power), creating plutocratic control** | Wrong: It uses too much energy | It is slower than Proof of Work | It requires physical mining hardware
8. What makes Bitcoin's origin story unique? **A: The anonymous founder disappeared after launch, removing any central authority or figurehead to attack** | Wrong: It was created by a bank | Satoshi still controls the protocol | It was backed by venture capital

### Privacy (8 Qs)
1. Is Bitcoin anonymous? **A: No — Bitcoin is pseudonymous; all transactions are public on the blockchain** | Wrong: Yes — completely untraceable | Yes — the government confirmed this | Only if you use a VPN
2. What is chain analysis? **A: The process of tracing Bitcoin transactions on the public blockchain to identify users** | Wrong: A way to mine faster | A technique to create new addresses | A type of Bitcoin audit by Satoshi
3. What is CoinJoin? **A: A privacy technique where multiple users combine transactions to obscure the sender/receiver trail** | Wrong: A way to merge multiple Bitcoin wallets into one | A Lightning Network routing protocol | A type of hardware wallet
4. What is KYC? **A: Know Your Customer — identity verification required by regulated exchanges** | Wrong: Keep Your Coins — a self-custody rule | A Bitcoin address format | A type of Bitcoin node
5. Why might someone prefer to buy Bitcoin without KYC? **A: To preserve financial privacy and avoid linking personal identity to their Bitcoin stack** | Wrong: KYC exchanges charge higher fees | Non-KYC bitcoin is worth more | Government law requires non-KYC purchases
6. What does UTXO stand for? **A: Unspent Transaction Output — the fundamental unit of Bitcoin transactions** | Wrong: Universal Token Exchange Operations | User Tracking eXchange Output | Unlimited Transaction eXchange Order
7. How does running your own node improve privacy? **A: Your wallet doesn't broadcast addresses to a third-party server; your node queries the blockchain directly** | Wrong: Your node earns fees that offset chain analysis costs | Full nodes are invisible to the internet | Running a node automatically enables CoinJoin
8. In what context is Bitcoin's censorship resistance most critical? **A: In countries with capital controls, hyperinflation, or authoritarian regimes where financial access is weaponized** | Wrong: Only for large corporations | In countries where Bitcoin is legal tender | Only in countries without banks

---

## 12. App Pages / SEO Updates

Add to `APP_PAGES` search entries and `_SEO_APP_PAGES` in `app.js`:
- `'learning-quests'`

(`NACHO_TIPS` / `NACHO_TIP` is not an existing global construct in this codebase — no action needed here.)

---

## 13. Implementation Notes

- **No external assets** — all illustrations are inline CSS/SVG
- **No new Firestore collections** — lqProgress stored in existing `users/{uid}` document
- **Firestore rules** — no change needed (writing to own user doc is already allowed)
- **Lazy load** — `learning-quests.js` is NOT added to `build.sh` SOURCES; it's loaded on demand
- **Mobile-first** — all UI uses `var(--accent)`, `var(--bg)`, `var(--text)` CSS vars; same pattern as `modules.js`
- **Sound gates** — all sound calls wrapped in `if (window.canPlaySound())` check
- **Swipe gestures** — add `touchstart`/`touchend` listeners for slide navigation on mobile (same delta threshold pattern used elsewhere in the app)
- **Confetti** — on quiz pass, call `if (typeof launchConfetti === 'function') launchConfetti()`
- **Bundle version bump** — NOT needed (lazy-loaded file)
- **SW cache bump** — needed after deploy (increment CACHE_NAME in `sw.js`)
- **index.html** — add lazy-load `<script src="learning-quests.js?v=YYYYMMDD">` tag; per MEMORY.md deploy rules, lazy-loaded files MUST have their `?v=` suffix bumped in index.html on every deploy (omitting this causes users to run stale code)

---

## 14. Files to Modify

| File | Change |
|------|--------|
| `learning-quests.js` | **New** — all lesson/quiz logic, sounds, illustrations |
| `badges.js` | Add 9 badge defs to `BADGE_DEFS` array; add `'📖 Learning Quests': _cat(BADGE_DEFS, b => b.id.startsWith('lq_'))` to the categories object (~line 965) |
| `mobile-ux.js` | Add "📖 Learning Quests" button to `toggleMobileLearnMenu()` |
| `app.js` | Add `case 'learning-quests'` to hash router; add `'learning-quests'` to `_lazyRoutes`; add to `_SEO_APP_PAGES`; add spotlight entry to APP_PAGES search array |
| `index.html` | Add `<script src="learning-quests.js?v=YYYYMMDD">` lazy-load tag |
| `sw.js` | Bump `CACHE_NAME` |

**No separate desktop nav file needed** — `toggleMobileLearnMenu()` in `mobile-ux.js` serves all screen sizes; there is no separate desktop Learn menu.

---

## 15. Out of Scope (v1)

- No server-side quiz validation (client-side only, same as existing quests)
- No leaderboard for Learning Quest completions
- No audio narration / TTS per slide
- No user-generated content
- No admin panel for editing topics
