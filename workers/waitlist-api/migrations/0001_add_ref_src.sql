-- Add nullable campaign tags to existing waitlist rows.
-- Do not rewrite the table. No IP, user agent or referrer columns.
ALTER TABLE waitlist ADD COLUMN ref TEXT;
ALTER TABLE waitlist ADD COLUMN src TEXT;
CREATE INDEX IF NOT EXISTS waitlist_src ON waitlist (src);
