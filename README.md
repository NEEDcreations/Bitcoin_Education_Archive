Welcome to the Bitcoin Education Archive, which is live under https://bitcoineducation.quest

The entire app was built by my Openclaw agent named Rufus using Claude Opus 4.6

The education featured in the website came from years of curating information on my Bitcoin Education Discord server. Now, it's all open source!

What we need right now are testers. Just play around with the site, find bugs, and report them. Request features if you think something would be a cool addition too!

Thank you so much! - Phil @NEEDcreations

---

## Custom SVG icon system

UI emojis (app chrome: nav, buttons, links, section headers, toasts) are replaced at runtime
with a custom SVG icon set so the site has its own visual identity. Expressive/social emojis
(faces, hands, hearts, flags, reactions) are deliberately left native, and user-content zones
(global chat, forum posts, DMs, marketplace listings) are excluded so people's messages keep
real emojis.

- `assets/icons/*.svg` — the icon set (24px grid, stroke-based, `currentColor`, works in light
  and dark themes). Open `assets/icons/preview.html` to eyeball the whole set.
- `scripts/author-icons.py` — geometry source of truth; regenerates the SVG files + preview.
- `scripts/build-icons.js` — emoji→icon mapping; inlines the SVGs into `icon-system.js`.
- `icon-system.js` — generated runtime (do not edit): swaps mapped emojis for inline SVGs via
  a MutationObserver, exposes `window.BEAIcons` (`.el(name)`, `.svg(name)`, `.sweep(root)`).

To keep an element's emojis native, add `data-emoji-keep` to it (or any ancestor).

### Design system overlay

`design-system.css` rides on top of the page styles on every page: one accent
(Bitcoin orange), neutral surfaces, a single shadow scale, thin scrollbars, and
unified floating buttons/toasts/panels in both themes. Decorative indigo/purple
chrome was normalized to the accent at the source in `onboarding.js`,
`global-chat.js`, and `learning-quests.js` (game/faction colors and the
Timechain TV sub-brand palette are intentionally untouched). When editing those
lazy-loaded files, bump their `?v=` query in **both** `index.html` and
`404.html` or browsers keep the stale cached copy.

Rebuild after changing icons or mappings:

```
python3 scripts/author-icons.py && node scripts/build-icons.js
```
