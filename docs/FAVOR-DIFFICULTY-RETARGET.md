# Satoshi's Favor difficulty retarget

Bitcoin-style retarget: the target moves only when an epoch fills 5/5, aiming for one 21,000-sat epoch every 14 days. Each closed epoch is its own step, with the factor clamped to [¼, 4] on that epoch's duration, then to the floor and ceiling (100 to 10,000,000). N fast epochs can move up to 4^N harder. There is no time-based retarget.

The `favorDifficultyRetarget` job checks every 30 minutes (America/New_York). It is idempotent per epoch: a second run before the next epoch closes returns `no_new_epoch` and writes nothing. Unmigrated config returns `not_migrated`.

Budget constants (Phil, Nov 12 2026): 100,000 sats/month = 45,000 Favor + 55,000 everything else. `OTHER_BUDGET` is informational and is not enforced yet. The formula uses the 14-day Favor aim, not that cap.

## Migration

After the new function is deployed, run `scripts/migrate-favor-epoch-retarget.js`. Dry-run is the default. `--apply` requires an explicit `--project=<id>` and will refuse rather than default to the live project. It sets `lastRetargetEpoch` to the open epoch minus 1 (or `0` when the open epoch is #1, with `poolEpoch.startedAt` as the baseline) so the first retarget happens when the current epoch fills.

Needs Security Team sign-off and Phil's OK before `--apply` on the live project. Live deploy must land before Sat Nov 21, 2026, 12:10 AM ET, or the old 14-day clock job will still fire.

## Rollback

After this migration (which clears `nextRetargetMs` and leaves `lastRetargetMs` unchanged), rolling back to the old 14-day-clock code would fire a clock retarget 14 days after `lastRetargetMs`. The old job treats a missing `nextRetargetMs` as `lastRetargetMs + 14 days`. The same applies after any later epoch retarget, which updates `lastRetargetMs` to the retarget time. Do not roll back after migrate or after a live epoch retarget without a plan for that clock.
