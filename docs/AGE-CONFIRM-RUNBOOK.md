# 18+ age confirmation runbook

Last updated: 25 November 2026, 9:43 PM ET.

There is no admin screen and no un-block callable for age confirmation. An admin undoes a confirmation with the `adminUnconfirmAge18` callable (admin claim, App Check, and a fresh step-up). That clears `over18`, `over18ConfirmedAt`, `ageConfirmed18`, and `ageConfirmed18At`, and sets server-only `ageConfirmBlocked: true`. The player cannot confirm again from the app. Points and sats are not changed.

## Undo a mistaken un-confirm

Do this in the Firebase console (Firestore), not from a client. Clients cannot write these fields.

1. Open the user document: `users/{uid}`.
2. Delete the `ageConfirmBlocked` field.
3. If the player should stay confirmed (the un-confirm was a mistake and they had already confirmed), also restore:
   - `over18`: `true`
   - `ageConfirmed18`: `true`
   - `over18ConfirmedAt` and `ageConfirmed18At` to the previous timestamps, if you have them
4. If they should just be asked again, leave those four confirm fields absent after deleting `ageConfirmBlocked`. They will see the age prompt on a later visit and can confirm themselves.

Prior timestamps and the admin who un-confirmed are on the append-only audit row `admin_audit_log/age18_unconfirm_{uid}_{ms}`. Earlier confirms are on `admin_audit_log/age18_confirm_{uid}_{ms}`. Do not edit or delete audit rows.

These fields are server-only. Changing them in the console bypasses the callable and does not write a new audit row, so note the uid and why you changed it in the usual ops log.
