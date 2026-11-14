-- D1 schema for waitlist-api. No IP, user agent or referrer columns by design.
CREATE TABLE IF NOT EXISTS waitlist (
  email            TEXT PRIMARY KEY,          -- trimmed, lowercased
  created_at       TEXT NOT NULL,             -- ISO 8601 UTC
  source           TEXT NOT NULL DEFAULT 'waitlist',
  consent          INTEGER NOT NULL DEFAULT 1,
  substack_status  TEXT NOT NULL DEFAULT 'pending',  -- pending | ok | dry_run | error_*
  substack_at      TEXT
);
CREATE INDEX IF NOT EXISTS waitlist_substack_status ON waitlist (substack_status);
