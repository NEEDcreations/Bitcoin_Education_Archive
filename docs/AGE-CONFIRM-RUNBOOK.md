# Age confirmation runbook

Last updated: 26 November 2026, 10:00 AM ET.

The prompt is a two-button "Quick age check" ("I'm 18 or older" / "I'm under 18") with no mention of ads or perks. Dismissing it means no ads for that session, and the prompt is shown again on the next visit.

After someone taps "I'm under 18", and for 13 to 17 year olds at sign-up, a required checkbox appears, unchecked by default, labeled: "My parent or guardian says it's OK for me to play Bitcoin Quest." The player cannot continue to a regular account until it is checked. Checking it saves server-only `ageUnder18`, `ageUnder18At`, `guardianOk`, and `guardianOkAt` through `confirmAgeUnder18`. The client cannot write those fields. After that, the prompt never shows again, ads stay off, and the user cannot confirm 18+ from the app. Under 13 still goes to Kids/Classroom only; this flow does not change those accounts, and it never removes earned XP or sats.

There is no admin screen. An admin undoes an 18+ confirmation with the `adminUnconfirmAge18` callable (admin claim, App Check, and a fresh step-up). That clears `over18`, `over18ConfirmedAt`, `ageConfirmed18`, `ageConfirmed18At`, `ageUnder18`, `ageUnder18At`, `guardianOk`, and `guardianOkAt`, and sets server-only `ageConfirmBlocked: true`. The player cannot confirm again from the app. Points and sats are not changed.

To clear a saved under-18 or guardian-OK answer, or to undo a block so the player can be asked again, use the `adminResetAge18` callable (admin claim, App Check, and a fresh step-up). That clears the same age fields and deletes `ageConfirmBlocked`. The player sees the prompt on a later visit and can answer themselves. They still cannot flip a saved answer from the client.

## Sats require a confirmed 18+ answer

Updated 28 November 2026 (`feat/sats-require-18plus`, not live until Phil okays the ship).

Every payout path refuses unless the user doc has `over18` or `ageConfirmed18` set to `true` (the fields `confirmAge18` sets): `claimSats`, `claimFavorBlock`, `claimCipherWin`, and `claimCipherSats`. The check is `functions/src/age18Sats.js`. It runs before any reservation, counter write, or wallet call, so a refused claim leaves nothing behind.

- Refusal code: `age_18_required` (`claimSats`, `claimFavorBlock` and `claimCipherSats` return `{ success: false, code, reason, error }`; `claimCipherWin` throws `failed-precondition` with `details.code`). The client turns it into "Confirm you're 18+ to earn sats." and re-shows the age prompt.
- `reason` is `unconfirmed` (the player can answer the prompt), `under18`, `blocked` (admin un-confirm), or `kids`. Only `unconfirmed` shows the 18+ button. The others get a plain message.
- **Under 18 with guardian OK does not earn sats.** This runbook does not say they should, so the rule fails closed. The guardian OK only lets them keep playing. Changing that is a product decision, then a one-line change in `age18Sats.assess`.
- Earned balances are never removed. `cipherSatsBalance` and claimable XP keep accruing for an unconfirmed player; only the withdrawal is refused. Confirming 18+ unblocks the next claim.
- The guardian step cannot be skipped: no Not now, no close button, no Escape, and a session dismiss is ignored for a saved under-18 answer that still lacks the checkbox. Reaching it from "I'm under 18" shows Back, which returns to the two-button prompt.
- Admin-paid prizes (`adminMarkCipherWinPaid`, `adminResolveCipherSatsClaim`) record a payment an admin made by hand. They do not send sats and are not gated.

## Undo a mistaken un-confirm

Prefer `adminResetAge18` when the player should be asked again. If you must do this in the Firebase console, not from a client (clients cannot write these fields):

1. Open the user document: `users/{uid}`.
2. Delete the `ageConfirmBlocked` field.
3. If the player should stay confirmed (the un-confirm was a mistake and they had already confirmed), also restore:
   - `over18`: `true`
   - `ageConfirmed18`: `true`
   - `over18ConfirmedAt` and `ageConfirmed18At` to the previous timestamps, if you have them
4. If they should just be asked again, leave the confirm, under-18, and guardian-OK fields absent after deleting `ageConfirmBlocked`. They will see the age prompt on a later visit and can answer themselves.
5. If they should stay recorded as under 18 with guardian permission, leave `ageUnder18`, `ageUnder18At`, `guardianOk`, and `guardianOkAt` in place (or restore them from the audit row) after deleting `ageConfirmBlocked`. Do not also restore the 18+ fields.

The un-confirm audit row `admin_audit_log/age18_unconfirm_{uid}_{ms}` and the reset audit row `admin_audit_log/age18_reset_{uid}_{ms}` hold the prior timestamps (null if they were never set), the prior flags (including `guardianOk`), and the admin who made the change. Confirms are on `admin_audit_log/age18_confirm_{uid}_{ms}`. Under-18 answers (with guardian OK) are on `admin_audit_log/age18_under18_{uid}_{ms}`. Do not edit or delete audit rows.

These fields are server-only. Changing them in the console bypasses the callable and does not write a new audit row, so note the uid and why you changed it in the usual ops log.
