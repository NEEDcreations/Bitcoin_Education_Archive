'use strict';
// Import-time refusals for Timechain TV. The catalog importer calls these
// before it inserts a video, so a blocked title or an age-restricted upload
// cannot be written back in on a later sweep.
const fs = require('fs');

// Word-boundary profanity and slurs. Ordinary words the chat filter flags
// (names, "analysis", "spice") are not in this list. "shitcoin" does not match.
const TITLE_BLOCK = /\b(?:fuck(?:ing|ed|er)?|shit(?:ty)?|bitch|cunt|pussy|dick|cock|whore|slut|porn|onlyfans|nigg(?:er|a)|faggot|fags?|retard(?:ed)?|spic|chink|kike|wetback)\b/i;

function titleBlocked(title) {
  return typeof title === 'string' && TITLE_BLOCK.test(title);
}

function ageRestricted(rec) {
  if (!rec || typeof rec !== 'object') return false;
  if (rec.ytAgeRestricted === true || rec.ageRestricted === true) return true;
  const rating = rec.ytRating
    || (rec.contentRating && rec.contentRating.ytRating)
    || (rec.contentDetails && rec.contentDetails.contentRating && rec.contentDetails.contentRating.ytRating);
  return rating === 'ytAgeRestricted';
}

function loadBlockedIds(file) {
  const ids = new Set();
  if (!file || !fs.existsSync(file)) return ids;
  for (const line of fs.readFileSync(file, 'utf8').split(/\n/)) {
    const id = line.replace(/#.*$/, '').trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(id)) ids.add(id);
  }
  return ids;
}

module.exports = { titleBlocked, ageRestricted, loadBlockedIds };
