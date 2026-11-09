# Lightning fee on sats payouts (Phil, Nov 2 2026)

The player pays the Lightning fee. One flat fee comes out of every automatic sats
payout; whatever routing does not use stays in the payout wallet (Phil's balance).
Nothing is sent anywhere else.

## Config
- `functions/src/lnFee.js` → `LN_FEE_SATS = 10` is the only server value. `MIN_NET_SATS = 1`.
- `ranking.js` → `window.BQ_LN_FEE_SATS` is a display copy only. `tests/test-ln-fee.js` fails if they differ.

## Fee data behind the 10 sats
NWC `lookup_invoice` on the 73 settled faucet payouts that stored a payment hash
(Oct 22 – Nov 2 2026): median 0.61, p90 2.30, p95 2.35, max 2.79 sats (all > 0).
The wallet connection has no `list_transactions` scope, and cipher payouts did not
store payment hashes, so the sample is faucet-only. p95 rounded up = 3 (covers the max); Phil set 10 sats "just in case" (Nov 2, 7:44 AM ET).

## Server paths (all enforced on the server)
| Path | Gross (debited, counts toward caps) | Sent |
|---|---|---|
| `claimSats` (faucet, index.js) | requested amount, 100–1,000 | gross − 10 |
| `claimCipherSats` (gifting.js) | min(balance, 1,000, caps), ≥100 | gross − 10 |
| `claimCipherWin` (gifting.js) | 100 or 500 prize | gross − 10 |

- LNURL invoices are requested for the net amount and the decoded invoice must equal net exactly.
  A pasted cipher-prize invoice must be for the net amount.
- A claim whose net would be < 1 is refused (`FEE_TOO_BIG`). Current minimums (100) always leave 90.
- Ledger: `fee_charged`, `net_sent`, `fee_paid` (sats, rounded up from NWC `fees_paid` msat; null when
  only a lookup confirmed the payment) on `faucet_invoices`, `users/{uid}/sats_withdrawals`,
  `cipher_sats_payouts` and `cipher_wins`.
- Refunds/restores give back the full gross (the fee is only kept when a payment actually settles).
- Manual payouts Phil marks paid (`adminMarkCipherWinPaid`, ≥1,000 sat prizes, raffle) send nothing
  from the server, so no fee is applied in code. Phil decides the amount he sends.

## Wavelength / Premium payout rail (staging design, no code path yet)
When the Wavelength rail is added it must use the same `lnFee.quote(gross)`:
1. `quote(gross)` → refuse if `!ok`. Debit gross in the reserve transaction, as today.
2. Resolve the LNURL invoice for `net`; check decoded amount == net.
3. `POST /v1/wallet/prepare-send {invoice}` → refuse (and restore gross) if `amount_sat != net`
   or `expected_fee_sat > LN_FEE_CEILING_SATS` (proposed 10; Wavelength charges 0.25% + routing,
   about 1 sat on 200). Phil absorbs any fee above 10 up to the ceiling.
4. Store `send_intent_id`, `payment_hash`, `fee_charged`, `net_sent`, `expected_fee_sat` in the payout
   doc in a transaction before `send`; after the terminal state store the actual `fee_paid`.
5. Show the same confirm screen (gross, fee, net). Premium does not waive the Lightning fee
   unless Phil decides otherwise.
