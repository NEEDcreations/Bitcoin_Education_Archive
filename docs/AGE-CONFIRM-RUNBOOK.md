# Age confirmation runbook

Last updated: 25 November 2026, 10:30 PM ET.

The prompt is a two-button "Quick age check" ("I'm 18 or older" / "I'm under 18") with no mention of ads or perks. Dismissing it means no ads for that session, and the prompt is shown again on the next visit. Tapping "I'm under 18" saves a server-only `ageUnder18` answer (plus `ageUnder18At`) through `confirmAgeUnder18`. After that, the prompt never shows again, ads stay off, and the user cannot confirm 18+ from the app.

There is no admin screen. An admin undoes an 18+ confirmation with the `adminUnconfirmAge18` callable (admin claim, App Check, and a fresh step-up). That clears `over18`, `over18ConfirmedAt`, `ageConfirmed18`, `ageConfirmed18At`, `ageUnder18`, and `ageUnder18At`, and sets server-only `ageConfirmBlocked: true`. The player cannot confirm again from the app. Points and sats are not changed.

To clear a saved under-18 answer, or to undo a block so the player can be asked again, use the `adminResetAge18` callable (admin claim, App Check, and a fresh step-up). That clears the same age fields and deletes `ageConfirmBlocked`. The player sees the prompt on a later visit and can answer themselves. They still cannot flip a saved answer from the client.

## Undo a mistaken un-confirm

Prefer `adminResetAge18` when the player should be asked again. If you must do this in the Firebase console, not from a client (clients cannot write these fields):

1. Open the user document: `users/{uid}`.
2. Delete the `ageConfirmBlocked` field.
3. If the player should stay confirmed (the un-confirm was a mistake and they had already confirmed), also restore:
   - `over18`: `true`
   - `ageConfirmed18`: `true`
   - `over18ConfirmedAt` and `ageConfirmed18At` to the previous timestamps, if you have them
4. If they should just be asked again, leave the confirm and under-18 fields absent after deleting `ageConfirmBlocked`. They will see the age prompt on a later visit and can answer themselves.
5. If they should stay recorded as under 18, leave `ageUnder18` and `ageUnder18At` in place (or restore them from the audit row) after deleting `ageConfirmBlocked`. Do not also restore the 18+ fields.

The un-confirm audit row `admin_audit_log/age18_unconfirm_{uid}_{ms}` and the reset audit row `admin_audit_log/age18_reset_{uid}_{ms}` hold the prior `over18ConfirmedAt`, `ageConfirmed18At`, and `ageUnder18At` values (null if they were never set), the prior flags, and the admin who made the change. Confirms are on `admin_audit_log/age18_confirm_{uid}_{ms}`. Under-18 answers are on `admin_audit_log/age18_under18_{uid}_{ms}`. Do not edit or delete audit rows.

These fields are server-only. Changing them in the console bypasses the callable and does not write a new audit row, so note the uid and why you changed it in the usual ops log.
