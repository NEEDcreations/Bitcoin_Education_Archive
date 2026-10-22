# Timechain TV: fresh YouTube import (prepared 2026-10-22)

**Status:** published on this branch. The catalog went from 7,689 to 9,189: +898 long videos, +640 vertical Shorts, and −38 dead videos. Shorts are in `rejected-shorts.json`. Each Short is filed on the station where that creator already has the most videos. Eight creators had no single home station (or their old station was a known mismatch); those Shorts went to orange-pill (CoinGecko), lightning (Voltage), art-philosophy (Jordan B Peterson), conferences-events (The Bitcoin Conference), mining (Tech Hustler), future-predictions (Galaxy and Schwab Network), and history (DW Documentary).

The notes below are the original research write-up.

## 1. How Timechain TV stores its videos (the setup)
- All 22 channels and their videos live in **one file in the website repo: `timechain-tv.js`** (on the `gh-pages` branch). It is a list baked into the code, not a database.
- Each video has only 3 fields: `id` (the YouTube video ID), `title`, and `duration` (in seconds).
- **There is no playlist data in Firestore.** Firestore only holds viewer stats (`tctv_counts`, `tctv_stats`, `tctv_view_days`). So publishing this import is a **website file change, not a Firestore import**.
- Playback is "live TV": every viewer sees the same video at the same moment. The app adds up all the durations and uses the current clock to pick what is "on air". That is why every duration here was read directly from YouTube, and why adding videos changes what is on air at any given minute (this is expected and harmless).
- The app does not filter Shorts or lengths itself, so this import does that filtering up front.
- The file is cache-busted from `index.html` and `404.html` (`timechain-tv.js?v=20261022_tctv3`). The service worker (`sw.js`) cache name is currently `btc-archive-v2263` on gh-pages.
- The source used here is gh-pages commit 5829421b (2026-10-22 13:28 ET). Its `timechain-tv.js` is byte-identical to what this import was built against.

## 2. Counts per channel: now → after import

| Channel | Now | New (existing creators) | New (new creators) | Total new | Dead removed* | After |
|---|---|---|---|---|---|---|
| 🏴 Pleb Underground Unlimited | 1985 | 19 | 0 | **+19** | 0 | 2004 |
| ⚡ AI, Nostr & Decentralized Web | 136 | 7 | 0 | **+7** | 0 | 143 |
| 🎨 Art & Philosophy | 106 | 5 | 0 | **+5** | 0 | 111 |
| 🟠 Beginners 101, Orange-Pill & Self-Custody | 721 | 52 | 19 | **+71** | 4 | 788 |
| 🎤 Conferences & Events | 212 | 41 | 20 | **+61** | 0 | 273 |
| 🌍 Culture, Travel & Adoption | 128 | 16 | 3 | **+19** | 1 | 146 |
| 💻 Dev, Privacy, Nodes & FLOSS | 96 | 30 | 19 | **+49** | 0 | 145 |
| 💰 Economics & Money | 169 | 13 | 23 | **+36** | 3 | 202 |
| 🗽 Freedom, Sovereignty & Homesteading | 118 | 27 | 23 | **+50** | 1 | 167 |
| 💪 Health, Fitness & Mindfulness | 233 | 54 | 0 | **+54** | 1 | 286 |
| 📜 History & Documentaries | 91 | 1 | 17 | **+18** | 2 | 107 |
| 👶 Kids & Family | 139 | 43 | 0 | **+43** | 1 | 181 |
| ⚡ Lightning, Ecash & Other L2s | 152 | 9 | 7 | **+16** | 0 | 168 |
| 😂 Memes & Comedy | 331 | 1 | 10 | **+11** | 2 | 340 |
| ⛏️ Mining & Power Projection | 213 | 54 | 3 | **+57** | 0 | 270 |
| 🎵 Music & Entertainment | 596 | 12 | 0 | **+12** | 3 | 605 |
| 📰 News & Current Events | 298 | 13 | 0 | **+13** | 3 | 308 |
| 🎙️ Podcasts, Debates & Spaces | 903 | 163 | 17 | **+180** | 7 | 1076 |
| 🏛️ Politics & Regulation | 65 | 0 | 10 | **+10** | 0 | 75 |
| 👑 Saylor Series & Corporations | 683 | 64 | 0 | **+64** | 5 | 742 |
| 🔮 Trading & Predictions | 129 | 36 | 9 | **+45** | 4 | 170 |
| 📚 Tutorials, Builders & DIY | 185 | 28 | 30 | **+58** | 1 | 242 |
| **Total** | **7689** | **688** | **210** | **+898** | **38** | **8549** |

\*Optional: 38 existing videos are now dead on YouTube (deleted, private, or login-only). The script can remove them with `--remove-dead`. Without that option, the after-total is 8,587.

## 3. How videos were found
- **Existing creators:** all 1,135 creators already in Timechain TV were identified by checking every existing video. The 174 creators with 3 or more videos were tracked, and their latest uploads were pulled from their YouTube feeds (the most recent 15 each). Only videos newer than what Timechain TV already has were kept. The Pleb Underground videos and live tabs were also checked.
- **New creators:** YouTube channel searches on Bitcoin, Austrian economics, privacy, self-custody, mining, Lightning, Nostr, culture, music, documentaries, homesteading and freedom topics. Each candidate was vetted by hand. See `new-creators.md`: 27 creators added, plus a list of those rejected and why.
- **No YouTube API key was available** (none is configured). So everything was checked straight from each video's public YouTube page plus YouTube's official embed check (oEmbed).

## 4. Every video was verified
Every video in `new-videos.json` was individually confirmed to:
- exist, be public and play normally (status OK);
- be **embeddable** (oEmbed 200 and embedding allowed), so it will play inside Timechain TV;
- not be a Short, not be live right now or an upcoming premiere, and not be age-restricted;
- be between 1 minute and 5 hours long, with the exact duration taken from YouTube;
- **not already be in Timechain TV** (checked against all 7,662 existing IDs, with 408 feed items already present and skipped). It must also not duplicate another video in this batch, by ID or by a near-identical title from the same creator (e.g. the same episode re-uploaded).

## 5. Rejected: 1219 candidates, and why

| Reason | Count |
|---|---|
| YouTube Short | 640 |
| off-topic for general creator | 165 |
| creator excluded on review (off-topic/altcoin) | 105 |
| older than 12 months | 88 |
| over per-new-creator cap | 64 |
| under 60s | 57 |
| low-value or non-English title (review filter) | 34 |
| altcoin/shill/profanity title filter | 29 |
| not embeddable | 14 |
| upcoming premiere/stream | 9 |
| over 5h | 6 |
| near-duplicate within import (same creator) | 5 |
| live now / upcoming | 2 |
| unplayable | 1 |

Notes:
- **Shorts (640)** were left out because vertical clips look poor on a TV-style player. They are all verified and saved in `rejected-shorts.json`, so they can be added later if wanted.
- "Off-topic for general creator" covers big general channels (Joe Rogan, Lex Fridman, CNBC, Bloomberg, Reason, etc.). Only their videos clearly about Bitcoin (or health, for the health channel) were kept.
- "Creator excluded on review" covers altcoin/"crypto" channels (e.g. Altcoin Daily, Coin Bureau), plus a few creators whose new uploads are off-topic. Details are in `new-creators.md`.
- "Low-value / non-English" covers earnings calls, untitled "Live with Restream" streams, dubbed foreign-language copies, German/Portuguese uploads, and altcoin-mining pitches.

## 6. Existing catalog health (found along the way)
- **38 existing videos are dead.** 21 now require login or are private, and 17 were deleted. They are listed in `dead-existing.json` and `dead-existing-ids.txt`. By channel: Podcasts 7, Saylor 5, Orange-Pill 4, Trading 4, Economics 3, Music 3, News 3, History 2, Memes 2, and 1 each in Culture, Freedom, Health, Kids and Tutorials. Viewers currently see an error or skip when these come "on air". Recommend removing them (`--remove-dead`).
- **27 videos appear in two channels at once** (`existing-cross-station-dupes.json`). They are left as-is, since this may be intentional. Can clean up on request.

## 7. Known limits
- Feeds only show each creator's 15 newest uploads. 37 very active creators had all 15 as new, so they may have a few more recent videos not captured. A YouTube Data API key would allow a deeper backfill.
- Channel placement is automatic, based on where that creator's videos already sit plus title keywords. Spot-checked by hand with fixes applied (e.g. Naomi Brockwell → Dev/Privacy, Oslo Freedom Forum → Freedom). A few placements are judgment calls (e.g. Joe Nakamoto in Mining, Mr. M Podcast in Podcasts).
- New videos are mixed into random positions in each channel, not added at the end, so they appear throughout the day. The existing order is otherwise untouched.

## 8. Files in /workspace/tctv-import/
- `new-videos.json`: **the import**, in the app's exact format, grouped by channel: `[{"id":"<channel id>","videos":[{"id","title","duration"}]}]`
- `new-videos-meta.json`: the same videos plus creator, publish date, views, new-creator flag and why each was placed in its channel
- `new-creators.md`: new creators (link, subscribers, channel, why) and rejected creators
- `rejections.json` and `rejected-shorts.json`: what was left out
- `dead-existing.json` and `dead-existing-ids.txt`: dead videos already in the catalog
- `apply_tctv_import.js`: the import script (**dry run by default**; writes only with `--write`)
- `preview/timechain-tv.js`: what the file will look like after the import (+898, −38 dead). It passes a syntax check.

## 9. Exactly how to publish (website file change, not Firestore)
1. In the website repo, make a new branch from `gh-pages`.
2. Preview: `node /workspace/tctv-import/apply_tctv_import.js --file timechain-tv.js --remove-dead /workspace/tctv-import/dead-existing-ids.txt`. This shows before → after counts and writes nothing.
3. Apply: run the same command with `--write` added. It refuses any ID already in the file, keeps all existing entries exactly as they are, and checks the file's syntax.
4. `node --check timechain-tv.js`
5. Bump the cache-buster `timechain-tv.js?v=20261022_tctv3` (to e.g. `?v=20261022_tctv4`) in **both** `index.html` and `404.html` (3 places each, kept identical).
6. Bump `sw.js` `CACHE_NAME` above whatever is live at that moment (currently `btc-archive-v2263`).
7. Update the home-page stat "7,689 TCTV Videos" (line ~1291 in both `index.html` and `404.html`) to the new total (8,549 with dead removal, or 8,587 without). Optionally add a patch-notes entry.
8. Open a PR, review it, merge, purge the Cloudflare cache, and mirror to GitLab as usual.
9. Verify live: load the site fresh, open Timechain TV, flip through several channels and confirm videos play. Check that the new home stat shows.
