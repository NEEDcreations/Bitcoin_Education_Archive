# waitlist-api

POST /api/waitlist for the static page /waitlist (waitlist.html + waitlist.js).
Firebase-free, so it keeps working while the app kill switch is on.

- Stores {email lowercased, created_at, source:'waitlist', consent:1, substack_status} in D1 `bq-waitlist`. No IP stored.
- Forwards to https://603btc.substack.com/api/v1/free. `SUBSTACK_DRY_RUN="1"` (default) never calls Substack.
- Substack failure still stores the row and returns `{ok:true, retry:true}`; rows with `substack_status` like `error_%` can be re-sent later.
- Turnstile: existing site key 0x4AAAAAAD-ivgpRkbXpgz86; needs `TURNSTILE_SECRET_KEY` as a Worker secret. Without it the endpoint fails closed (503).
- Rate limit: Workers rate-limit binding, 5/min per IP (IP is a key only).
- Origin must be https://bitcoineducation.quest.

- New signups also email info.603btc@gmail.com (subject: "New Citadel Spark waitlist signup") with the address, ET time, running total, and the stored Substack status (`ok`, `error_*`, `browser`, etc.). Sent with `waitUntil` so a mail failure never fails the signup. Binding: `NOTIFY` (`send_email`, destination locked to that inbox). From: waitlist@bitcoineducation.quest.

Test: `MINIFLARE_PATH=<dir with miniflare@4>/package.json node workers/waitlist-api/test.mjs`

Go-live (each step needs Phil's OK):
1. `wrangler d1 create bq-waitlist`, put the id in wrangler.toml, `wrangler d1 execute bq-waitlist --remote --file schema.sql`
2. `wrangler secret put TURNSTILE_SECRET`
3. `wrangler deploy` (adds route bitcoineducation.quest/api/waitlist; more specific than seo-router's /*)
4. Set `SUBSTACK_DRY_RUN = "0"`, flip `data-mode="preview"` to `"live"` in waitlist.html, ship via deploy-pages.sh
