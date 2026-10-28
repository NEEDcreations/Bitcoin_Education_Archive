# Username profile tags

Every other player's name should be a tag from `userTag(uid, name)` in `utils.js`. The name is escaped. The uid has to match `^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$`. A deleted or missing profile is plain text: `Deleted player`. A missing or invalid uid is always plain text. The name cache stores only usernames loaded from a public profile, and `userTag` does not consult it. Rendering a name does not read Firestore. Opening a tag may use one cached `beats_artists/{uid}` read. No `users` doc is read for this, and no rules changed.

Robbie P's public artist doc id is his account id (`isFirebaseUser: true`, `source: user_upload`, stage name `ROBBIE P`). An unclaimed podcast artist also named ROBBIE P (`robbie-p`) is not linked to an account. A tag for his account opens the artist page first. **View user profile** switches to the user profile and stays on top of the screen he was on. **Back** returns there.

## Audit

Ordered by how often people see the name.

| Location | What people see | Was it tappable? | Fix |
| --- | --- | --- | --- |
| `global-chat.js` `renderChatMessages` | Global chat name on each message | Yes, `showUserProfile` | `userTag`. Deleted messages say Deleted player. |
| `global-chat.js` mention formatter | `@name` in chat | Yes, uid tag or `lookupUserByName` | Uid mentions use `userTag`. A name already in the cache does too. Other `@name` chips still use the existing lookup. |
| `ranking.js` leaderboard render | All-time, weekly, and monthly XP lists, including anyone still listed | Yes, the row opened a profile | The name is `userTag`. The row still opens a profile. |
| `ranking.js` `_lbBuildResultRow` / local search | Leaderboard search hits | Yes | `userTag` |
| `ranking.js` `_renderPredictorBoard` | Top Predictors | Yes, `data-profile-uid` | `userTag`, including a blank name that gets filled later |
| `ranking.js` `_loadPVPLeaderboard` | PVP leaderboard | Yes, the row | `userTag` |
| `ranking.js` peer list and incoming requests | Settings peers | Request names were raw text. Peer names were escaped text with a separate View profile button | `userTag` |
| `ranking.js` `updateRankUI` | Your own name in the header and mobile bar | Opens Settings, not a profile | Left as-is |
| `forum.js` post and reply authors | Pleb Talk and article replies | Yes | `forumUserTag` |
| `beats.js` `beatsUserTag` | Track lists, track detail, comments | Artist name opened the artist page | Tag. The author id is remembered from the tracks already loaded, so the tap does not add a read. |
| `beats.js` `beatsShowArtistPage` | Artist page | The page itself | **View user profile** when the public artist doc is `isFirebaseUser` or `source: user_upload`, or `claimedUid` is set, or a public profile exists. Built with `textContent`. |
| `beats.js` `beatsRenderArtists` | Artists grid | Opens the artist page by doc id | Real accounts are cached from that existing list. |
| `global-chat.js` DJ bar | DJ name and track artist | Yes | `userTag`. A track artist id is cached as an artist. |
| `quests.js` raid participant, damage, and all-time lists | Raid and boss damage | Yes | `userTag` |
| `quests.js` `_renderHasherRanksHTML` | Satoshi's Favor top hashers | Username lookup | `userTag` using the profile id already on the row |
| `quests.js` winner banner | Favor winners | Yes when a uid was stored | `userTag` when `w.uid` is present |
| `quests.js` `_renderTopHashesHTML` | Public top-hash rows | Username lookup | Needs uid. Those public entries do not carry a uid. Left as-is. |
| `quests.js` `_patchCharityRecent` | Recent charity names | Yes | `userTag` |
| `satoshi-favor.js` session and hash log | Favor session and live hashes | Yes, `data-profile-uid` | `userTag` |
| `marketplace.js` listing detail | Seller name | The seller row opened a profile | `userTag`. Contact / report still use the escaped name as button data. |
| `notifications.js` `notifNameHtml` | Notification text | The card opened the target, not the person | If `senderId` or `fromUid` is present and that name is in the text, that name is a tag. |
| `notifications.js` partnership popup | Peer name on a level-up | No | `userTag` from the id already on the popup. The profile read was already there. |
| `messaging.js` DM header | The other person in a DM | Yes, and it closed the DM | `userTag`. The DM stays open under the profile. |
| `messaging.js` `showUserProfile` | Profile sheet | The sheet itself | Routes through `openTaggedProfile` unless `userOnly`. Missing public profile shows Deleted player with `textContent`. **View artist profile** is added when the artist cache says so. |
| `gifting.js` Keys from peers | Sender names | PR #145 tags those on its branch | Not edited here, to avoid that branch. |
| `pvp.js` match HUD | Opponent name during a match | Minified file, also touched by PR #142 | Needs a careful edit on that branch. The PVP leaderboard is tagged. |
| `meetup-builder.js` | Meetup cards | Host label is not a separate uid in the card markup | Needs uid. Left escaped. |
| `lightning-tips.js` | Tip sheets | Minified. Names are the tip recipient already chosen | Left as-is. |
| `irl-sync.js` | Meetup grid | Minified. No separate username chip found | Needs uid if a host name is only a string. |
| Own header | Rank bar | Opens Settings | Not a tag. |

## Overlap

PRs #141–#145 also edit `gifting.js`, `messaging.js` (`showUserProfile` peership chip), `beats.js` (share), `global-chat.js` (one raid line), `quests.js` (poll and trivia), `ranking.js` (home sats), `app.js`, and the cache buster files. This change edits the profile opener, artist page, chat names, leaderboard names, raid names, and favor names. It does not edit the peer-key send panel, spin follow-up, mini-app share cards, poll result timing, or referral tiers. `gifting.js` still lifts the profile above chat, now to z-index 2300000 so it stays above the artist page.

## Rules and functions

No Firestore rules or Cloud Functions changes.
