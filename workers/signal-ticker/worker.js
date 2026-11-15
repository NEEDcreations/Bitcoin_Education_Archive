// Cloudflare Worker: refresh Signal ticker headlines every 4 hours into KV
// and serve GET /newsletter-data.json. Staging worker name: signal-ticker-staging.
// Do not attach this file's default wrangler.toml to the live zone.

import { handleFetch, handleScheduled } from './handlers.js';

export default {
    async fetch(request, env, ctx) {
        return handleFetch(request, env, ctx);
    },
    async scheduled(event, env, ctx) {
        const result = handleScheduled(event, env, ctx);
        if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(Promise.resolve(result));
        return result;
    }
};
