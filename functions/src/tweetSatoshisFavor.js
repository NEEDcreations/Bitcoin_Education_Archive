/**
 * tweetSatoshisFavor
 * Firestore onWrite trigger on satoshiFavor/current.
 * Posts to X (@bitcoineducation) when favorActive flips false → true.
 *
 * Uses OAuth 1.0a (user context) via manual HMAC-SHA1 signing —
 * no extra npm deps needed (node-fetch already in package.json).
 */

const functions = require('firebase-functions');
const crypto = require('crypto');
const fetch = require('node-fetch');

// ── OAuth 1.0a helpers ─────────────────────────────────────────────────────

function oauthSign({ method, url, params, consumerKey, consumerSecret, tokenKey, tokenSecret }) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: tokenKey,
    oauth_version: '1.0',
  };

  // Merge all params for signature base
  const allParams = { ...params, ...oauthParams };
  const sortedParams = Object.keys(allParams)
    .sort()
    .map(k => `${pct(k)}=${pct(allParams[k])}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    pct(url),
    pct(sortedParams),
  ].join('&');

  const signingKey = `${pct(consumerSecret)}&${pct(tokenSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  oauthParams.oauth_signature = signature;

  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(k => `${pct(k)}="${pct(oauthParams[k])}"`)
    .join(', ');

  return authHeader;
}

function pct(s) {
  return encodeURIComponent(String(s));
}

// ── Post tweet ────────────────────────────────────────────────────────────

async function postTweet(text) {
  const url = 'https://api.twitter.com/2/tweets';
  const method = 'POST';

  const consumerKey    = process.env.X_API_KEY;
  const consumerSecret = process.env.X_API_SECRET;
  const tokenKey       = process.env.X_ACCESS_TOKEN;
  const tokenSecret    = process.env.X_ACCESS_SECRET;

  if (!consumerKey || !consumerSecret || !tokenKey || !tokenSecret) {
    throw new Error('Missing X API credentials in environment');
  }

  const authHeader = oauthSign({
    method, url,
    params: {},  // body params not included in OAuth sig for JSON body
    consumerKey, consumerSecret, tokenKey, tokenSecret,
  });

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Twitter API error ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

// ── Cloud Function ────────────────────────────────────────────────────────

exports.tweetSatoshisFavor = functions.firestore
  .document('satoshiFavor/current')
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after  = change.after.exists  ? change.after.data()  : null;

    // Only fire when favorActive flips false → true
    const wasFalse = !before || before.favorActive === false;
    const isNowTrue = after && after.favorActive === true;

    if (!wasFalse || !isNowTrue) {
      return null;
    }

    // Build tweet text
    const HASH_MAX = 100000000; // 100 million — matches satoshi-favor.js
    const target = after.difficultyTarget || 15000;
    const odds = Math.round(HASH_MAX / target).toLocaleString();
    const durationMin = 90; // matches FAVOR_DURATION_MINUTES in satoshiFavor.js

    const tweetText =
      `⚡ Satoshi's Favor is LIVE on bitcoineducation.quest!\n\n` +
      `A ${durationMin}-min mining window just opened — hash for a chance to win 21,000 sats ₿\n\n` +
      `Difficulty: ${target.toLocaleString()} | Odds: 1 in ${odds}\n\n` +
      `#Bitcoin #Satoshi #BitcoinEducation`;

    console.log(`[TWEET] Satoshi's Favor went live — posting to X`);

    try {
      const result = await postTweet(tweetText);
      console.log(`[TWEET] Posted successfully: ${result.data && result.data.id}`);
    } catch (e) {
      console.error(`[TWEET] Failed to post tweet:`, e.message);
      // Don't throw — we don't want a tweet failure to cause Firestore retries
    }

    return null;
  });
