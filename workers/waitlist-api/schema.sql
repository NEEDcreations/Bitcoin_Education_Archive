-- D1 schema for waitlist-api. No IP, user agent or referrer columns by design.
-- ref and src are optional campaign tags from the signup URL, not personal data.
CREATE TABLE IF NOT EXISTS waitlist (
  email            TEXT PRIMARY KEY,          -- trimmed, lowercased
  created_at       TEXT NOT NULL,             -- ISO 8601 UTC
  source           TEXT NOT NULL DEFAULT 'waitlist',
  consent          INTEGER NOT NULL DEFAULT 1,
  substack_status  TEXT NOT NULL DEFAULT 'pending',  -- pending | ok | dry_run | error_* | browser
  substack_at      TEXT,
  ref              TEXT,                      -- optional invite tag, [A-Za-z0-9]{4,16}
  src              TEXT                       -- optional post tag, [a-z0-9-]{1,32}
);
CREATE INDEX IF NOT EXISTS waitlist_substack_status ON waitlist (substack_status);
CREATE INDEX IF NOT EXISTS waitlist_src ON waitlist (src);
