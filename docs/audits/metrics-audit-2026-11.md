# Bitcoin metrics audit — 9 November 2026

Audit of every live Bitcoin figure on Bitcoin Quest (`bitcoineducation.quest`): the network dashboard, the top-indicator panel, the header price and block height, and Nacho's live answers. This pass records sources, refresh, caching, rate limits, and a live cross-check. It does not change how any number is computed.

Checked against public APIs between **17:34 and 17:40 UTC on 9 November 2026**. Block height moved from **975,199** to **975,201** during that window, and the spot price moved a few tens of dollars. Each comparison uses the nearest sample.

## How a number reaches the screen

```
browser
  ├─ Coinbase WebSocket (ticker)          price, 24h change, 24h high/low once connected
  ├─ localStorage (2 min, plus a stale backup)
  ├─ Cloudflare Worker  /btc-data         one JSON snapshot, edge-cached 90s
  │     mempool.space, Coinbase REST, Kraken, CoinGecko, alternative.me
  ├─ Cloudflare Worker  /btc-candles      20× 5-minute bars, edge-cached 60s
  └─ direct browser calls that skip the worker
        mempool.space (header ticker), CoinGecko (prefetch, dominance,
        gold, treasuries, 365-day chart), CBBI latest.json, static ETF JSON
```

Firestore is not on this path. Nothing in `functions/` writes or reads these market figures. The shared cache is the worker's in-isolate memory plus Cloudflare's `caches.default` (per data center). The browser keeps a second copy in `localStorage`.

The page that ships is `bundle.min.js`, built by `build.sh` from `bitcoin-dashboard.js` and `nacho-live.js`. `ranking.js` is loaded beside the bundle and has its own price and height prefetch. Line numbers below are the source files.

The worker that answered `https://jolly-surf-219enacho-search.needcreations.workers.dev/btc-data` at 17:34 UTC is **not** the collector in this commit. Running `collectBtcData()` from `workers/nacho-search/nacho-logic.mjs` against the same public APIs produced a different Lightning figure and included the all-time high, which the live worker left out. Details are in those two rows below. A redeploy is part of the follow-up, separate from the formula fixes.

## Refresh and caches

| Layer | Where | TTL | What it holds |
| --- | --- | --- | --- |
| Coinbase WebSocket | `bitcoin-dashboard.js` `startPriceWs` (line 42) | Paint at most every 10s (`_WS_DOM_THROTTLE_MS`). Socket closes when the tab is hidden. | Last trade, 24h open, 24h high, 24h low |
| REST fallback | `startPricePolling` (line 102) | 30s, only if the socket is silent for 8s | CoinGecko `simple/price` from the browser |
| Dashboard snapshot | Worker `BTC_CACHE_TTL` (`worker.js` line 122) and `DASH_CACHE_TTL` (`bitcoin-dashboard.js` line 147) | 90s at the edge, 2 min in `localStorage` (`btc_dashboard_cache_v2`). The open dashboard deletes that key every 2 min and fetches again. | Full `/btc-data` payload |
| Stale backup | `btc_dash_backup`, `btc_last_price`, `btc_last_height` | Kept until overwritten | Last good snapshot if the worker fails |
| Candles | `CANDLE_REFRESH_MS` (line 157), worker `max-age=60` | Client refetches every 5 min, repaints every 5s, and writes the live price into the last bar | 20 five-minute bars |
| Header ticker | `nacho-live.js` `FETCH_INTERVAL` (line 17), interval at line 148 | Effective 5 min (the 60s timer returns early) | Price, height, fees, mempool count, straight from mempool.space |
| Prefetch | `ranking.js` lines 11796–11805 | 5 min, and only when those `localStorage` keys are older than that | CoinGecko price and mempool height, from the browser |
| Top indicators | `TOP_IND_CACHE_KEY`, `cbbi_cache` | HTML is shown immediately from `localStorage` with no TTL. CBBI fallback is kept 24h. | Rendered cards, plus a few CBBI scalars |
| Gold, treasuries | `_goldCacheTs`, `_treasuryCacheTs` (lines 1745, 1809) | 30 min, also mirrored to `localStorage` | XAUT price, CoinGecko public-company list |
| ETF files | `data/etf-flows.json`, `data/etf-holdings.json` | Browser cache-busts once an hour (`Date.now()/3600000`). The files themselves are rewritten by cron scripts. | Flows and custody totals |

Fear & Greed and the CBBI series are daily. The worker still refetches Fear & Greed every 90 seconds. The browser downloads the whole CBBI file (2.9 MB on this run) each time the indicator panel opens.

## Rate limits, and what 1,000 open tabs would do

Limits below are the vendors' published rules where they publish them. "Per IP" means one household is fine and a shared NAT (campus, mobile carrier) is the case that actually gets HTTP 429.

| Source | Who calls it today | Published limit | Shared cache? |
| --- | --- | --- | --- |
| mempool.space | Worker (7 calls per snapshot) and, separately, every browser via `nacho-live.js` (4 calls) plus `ranking.js` (1 call) | No numeric quota. Their docs ask clients to cache and say abusive traffic is throttled. In practice this is enforced per IP. | Worker yes (90s). Header ticker and the ranking prefetch bypass it. |
| Coinbase Exchange REST | Worker, spot price. Candle route first. | Public REST about 10 requests/second per IP. | Yes |
| Coinbase WebSocket | One socket per visible tab (`wss://ws-feed.exchange.coinbase.com`) | Public market-data sockets, no key. A single IP opening many sockets can be disconnected. | No, and it should stay per tab. This is the right way to get a 10–30s price. |
| Kraken public REST | Worker, one ticker call | Unauthenticated public tier is about one call per second per IP. | Yes |
| CoinGecko public `api/v3` | Worker (`/coins/bitcoin`) and the browser (prefetch, polling fallback, `/global`, 365-day chart, XAUT, public treasuries) | Demo plan is 30 calls/minute and 10,000 calls/month **per key**. These calls send no key. This audit's `days=365` chart returned 200; `days=730` returned **401**. Keyless traffic is commonly answered 429. | Only the coin call is inside the worker, and the 2.5s abort can drop it. The rest are per browser. |
| alternative.me Fear & Greed | Worker | No published quota. The index updates once a day. | Yes, but refreshed every 90s |
| CBBI `latest.json` | Browser, on panel open | No quota. The file was **2.9 MB** and the newest point was 8 November 2026. | No |
| Bitstamp OHLC | Worker, only if the Coinbase candle call fails | Public, modest. | Yes (the candle response is cached 60s) |
| Same-origin ETF JSON | Browser | Our host. | The file is the cache. The copy in git is weeks old (below). |

The worker's own design is sound. Each Cloudflare location rebuilds `/btc-data` at most once every 90 seconds (about eleven upstream calls), no matter how many tabs are open. That will not trip CoinGecko, Kraken, or mempool.

The per-browser calls are the scaling problem. A desktop tab with the ticker on (`nacho-live.js` defaults on above 900px) makes **four mempool requests every five minutes**, and `ranking.js` adds a fifth plus a CoinGecko price call. At 1,000 such tabs that is about **17 requests/second** to mempool.space, spread across the users' own IPs. It does not share one rate-limit bucket, so it does not by itself exhaust a single key. It does mean a campus NAT, or a user who opens the indicator panel (365-day CoinGecko chart + `/global` + gold + treasuries + a 2.9 MB CBBI file), can 429 while the worker is sitting on a fresh copy of the same mempool data.

Reads of slow data should come from the worker. The WebSocket can stay in the browser.

`FETCH_TIMEOUT_MS` in `nacho-logic.mjs` (line 29) aborts every upstream call at **2.5 seconds**. Coinbase candles and `coins/bitcoin` are the calls most likely to lose that race from an edge location. The live worker's missing all-time high, and its candle payload matching Bitstamp rather than Coinbase, fit that timeout. They also fit an older deploy (the Lightning numbers do not match this file at all).

## Cross-check of the worker snapshot

`collectBtcData()` from this repo, ~17:36 UTC, with a second source beside it.

| Field | This repo | Second source | Verdict |
| --- | --- | --- | --- |
| Price | $74,757.82 Coinbase spot | CoinGecko $74,728, mempool.space $74,776, Bitstamp $74,733, blockchain.info $74,737. Spread about **0.07%**. | Correct |
| 24h change | **+0.016%** | Coinbase 24h open $75,653.87 → about **−1.18%**. CoinGecko **−1.19%**. Bitstamp `percent_change_24` **−1.19%**. Kraken hourly close ~24h earlier → about **−1.5%**. | Wrong field. See below. |
| 24h high / low | $75,870 / $73,444 (Kraken `h[1]`, `l[1]`) | Coinbase stats $75,873 / $73,477. CoinGecko $75,881 / $73,709. | Correct. Low differs by up to ~0.4% across venues. |
| 24h volume | **$259 million** | CoinGecko total volume **$34.16 billion**. Coinpaprika **$21.70 billion**. | Kraken-only volume, labeled as the whole market. |
| Block height | 975,201 | mempool, Blockstream, and blockchain.info all returned **975,199** a minute earlier, then the chain moved. | Correct |
| Subsidy | 3.125 BTC, next 1.5625, halving block 1,050,000 | Epoch `floor(975201/210000) = 4`. Reward `50/16`. | Correct |
| Blocks to halving | 74,799 | `1050000 − 975201` | Correct |
| Halving ETA | 12 April 2028 (519 days), at exactly 10 minutes per block | Same blocks at the epoch's actual average **642.0 s** (`timeAvg` on mempool difficulty-adjustment) land on **18 May 2028**, **36 days later**. | Block count is exact. The clock runs fast while blocks are slow. |
| Hashrate | **962.0 EH/s** (`currentHashrate` on `/mining/hashrate/1m`) | Same response's latest daily bucket **826.3 EH/s**. blockchain.info 24h estimate **796.5 EH/s** (`/q/hashrate` is GH/s). Difficulty-implied hashrate at a 10-minute target is **1,062 EH/s**. The `3d` endpoint returned the same `currentHashrate`. | Units are right (H/s → EH/s). The headline is ~16% above mempool's own last daily average and ~21% above blockchain.info. It needs a window in the label. |
| Difficulty | 148,364,561,003,867 | blockchain.info `getdifficulty` **148,364,561,003,867** | Correct. UI shows it as 148.36 T. |
| Next adjustment | −6.36% at the time of the local run (−6.48% a minute earlier), 545 blocks left on the first read | Passthrough of mempool `difficultyChange`, `estimatedRetargetDate`, `remainingBlocks`. | Correct |
| Fees | fast 1 sat/vB (2 a minute earlier), half-hour 1, economy 1 | Same mempool `fees/recommended` body. No second fee oracle was queried. | Passthrough, matched the source |
| Mempool | ~65,000–68,600 txs, ~37–38 MvB | `vsize / 1e6`. Count moved with the chain over the same minute. | Correct unit (million vbytes) |
| Supply | 20,110,003.125 BTC | CoinGecko circulating **20,109,909** at height 975,199, where the same sum is 20,109,996.875. Gap **88 BTC (0.0004%)**. | Issuance sum is right. CoinGecko's circulating figure is lower by a small adjustment. |
| Market cap | $1.503 T (`price × issued supply`) | CoinGecko market cap $1.503 T. Difference about **0.03%** at the same moment. | Correct |
| Sats per dollar | 1,338 | `round(1e8 / 74725.625) = 1338` | Correct |
| ATH | $126,080, **−40.71%** | CoinGecko $126,080 on 6 Oct 2025, **−40.73%**. Coinpaprika $126,173, **−40.74%**. | Correct **when the field is present**. The live worker payload at 17:34 had no `ath`, so the card was hidden. |
| Fear & Greed | 29, Fear | alternative.me `fng/?limit=1`: **29, Fear**, timestamp 8 Nov 2026 00:00 UTC | Correct. Daily index. |
| Lightning | This repo: **4,798.00 BTC**, 17,420 nodes, 40,664 channels | That is exactly mempool `lightning/statistics/latest`. The row's `added` time is **16 June 2026**. The live worker instead returned **3,194.66 BTC**, 15,904 nodes, 28,940 channels. | Parser in this repo matches the API. The API's newest row is five months old, and the UI prints it with no date. The deployed worker does not match this parser. |
| Multi-currency quotes | mempool `prices` (EUR, GBP, CAD, CHF, AUD, JPY) | USD matched the other spot sources within 0.1%. The other currencies were not cross-checked. | Passthrough, used by Nacho |

## Dashboard cards

Sources as wired in `collectBtcData` (`nacho-logic.mjs` lines 742–846) and rendered in `renderDashboard` (`bitcoin-dashboard.js` lines 411–500).

| Card | Source | Refresh | Computation |
| --- | --- | --- | --- |
| Price, and the header ₿ price | Coinbase WebSocket once it ticks. Until then, Coinbase REST spot inside the worker. `nacho-live.js` overwrites `btc_last_price` from **mempool** `prices.USD` every 5 min, which can differ by tens of dollars. | 10s paint, 90s snapshot | Direct |
| 24h % | Worker: Kraken ticker field `o`. Socket: Coinbase `open_24h`. Poll fallback: CoinGecko `usd_24h_change`. | 10s once the socket is up | **The worker value is the move since 00:00 UTC, not 24 hours.** Kraken documents `o` as today's opening price. `h[1]`, `l[1]`, and `v[1]` are the real 24h high, low, and volume. At 17:36 UTC the since-midnight move was **+0.02%** while the 24h move was about **−1.2%**. Nacho quotes the worker figure as "over the last 24 hours. Source: Kraken." (`renderIntent`, line 319). The first paint of the dashboard does the same (`line 413`) until a ticker arrives. The socket path itself is the right 24h change. |
| 24h high / low | Kraken 24h fields, then replaced by Coinbase `high_24h` / `low_24h` on each trade (lines 77–80, not under the 10s throttle) | Per trade after connect | Correct |
| Candles, "BTC/USD · 5m · Coinbase" | Worker tries Coinbase `/products/BTC-USD/candles?granularity=300` (mapping `[time, low, high, open, close, volume]` is correct: `worker.js` lines 174–181), then Bitstamp. | Edge 60s, client refetch 5 min, last bar's close replaced every 5s | The bar cached by the **live** worker at 17:34 (open 74,772.59, high 74,791.63, low 74,681.05) matches Bitstamp's 5-minute bar at that timestamp, not Coinbase's (Coinbase's bar was open 74,759.36, low 74,675.01, volume 22.4 BTC versus ~0.2 BTC). The chart is a real 5-minute series. The caption credits Coinbase while the fallback is serving. |
| Block height, subsidy, halving block, blocks left | mempool tip height, then the issuance rules | 90s | Correct |
| Halving countdown | `blocks × 10 min`, ticked every 1s from a deadline set at render (`line 443`, `nacho-logic.mjs` lines 825–830). The client recomputes the same way if the worker omitted the fields (lines 373–385). | Clock every 1s, inputs every 90s | Deadline is early by ~36 days at today's block pace. `difficulty-adjustment.timeAvg` is the right multiplier and is already fetched. |
| Hashrate | mempool `currentHashrate`, formatted at 1e18 = 1 EH/s (`fmtCompact` line 173, `formatHashrate` line 211). `hashrateChange24h` is rendered (line 473) and **never set**. | 90s | Unit is correct. Window is unlabeled and disagrees with a 24h estimate by ~21%. There is no ZH/s branch; 1,000 EH/s would still print as EH/s. |
| Difficulty, next adjustment | mempool hashrate payload and `difficulty-adjustment` | 90s | Correct. Difficulty only changes every 2,016 blocks, so 90s is more often than the data moves. |
| Fees | mempool `fastestFee`, `halfHourFee`, `economyFee`. `hourFee` and `minimumFee` are fetched and not shown. | 90s | Correct |
| Mempool | `count`, `vsize` | 90s | Correct |
| Supply, % mined, market cap | Issued supply from the subsidy schedule × Coinbase price | 90s | Correct at the 0.03% level versus CoinGecko |
| 24h volume and Vol/MCap | Kraken `v[1] × last price` (`nacho-logic.mjs` line 787). Tooltip says "all exchanges" (line 494). | 90s | About **1/130** of CoinGecko's all-exchange volume ($259M vs $34.2B). Coinpaprika's $21.7B shows the two global methodologies also differ; neither is $259M. |
| Sats per dollar | `1e8 / price` | with price | Correct |
| Lightning | mempool `latest.total_capacity` in sats ÷ 1e8 (line 496) | 90s | Value matches a row dated **16 June 2026**. Shown as a live total. |
| ATH | CoinGecko `market_data.ath`. The same response's `total_volume`, `market_cap`, and `circulating_supply` are ignored. | 90s, if the call returns before 2.5s | Correct when present |
| Fear & Greed | alternative.me, also repeated inside Top Indicators | 90s | Correct |
| Bitcoin vs gold | Browser calls CoinGecko `tether-gold` every 30 min (line 1752). Ounces are the constant `222600 × 32150.7` (line 1737), commented as World Gold Council end-Q2 2026. Failure fallback is **$3,200/oz**. | 30 min, per browser | XAUT **$4,085** vs PAXG **$4,090** (0.12%). The ounce stock was not re-audited. The $3,200 fallback would understate the gold cap by about 22% at today's price. |
| Public companies | CoinGecko `companies/public_treasury/bitcoin` (line 1816), top 5, 30 min | per browser | Live. Strategy is listed at **849,327 BTC**. |
| Governments | `GOV_HOLDINGS` (lines 1830–1836): US 325,293, China 190,000, UK 61,245, Bhutan 10,635, El Salvador 6,135, total 649,864 | Never | Hardcoded. Not cross-checked in this audit. No date on the card. |
| ETF custody | `data/etf-holdings.json`, fallback constants at line 1888. File `updated` is **14 Oct 2026**. Shares outstanding in `scripts/update-etf-holdings.sh` are commented "calibrated 23 May 2026". | Hourly re-read of a file the cron is supposed to rewrite daily | The as-of date is shown. The file in the repo is 26 days old. |
| ETF flows | `data/etf-flows.json`. `latestDate` **8 Oct 2026**, latest flow −82.2M, 5-day sum −214.3M. | Same | Card copy says "daily". The series stops on 8 October. |

## Top indicators

Opened from `loadTopIndicators` (`bitcoin-dashboard.js` line 833). Several cards run a real formula on real inputs. Several others multiply a stand-in series (the power-law curve, or a flat $30,000 or $60,000) and then apply thresholds written for the real metric.

| Indicator | What it actually computes | Checked against | Result on 9 Nov 2026 |
| --- | --- | --- | --- |
| Stock-to-Flow | Stock = issued supply. Flow = `3.125 × 6 × 24 × 365` = 164,250 BTC/year. S2F = **122.4**. Model price = `10^(3.31954·log10(S2F) − 1.32093)` = **$407,343**. Ratio = price / that. | Algebra only. This is one frozen regression, not a market price. | Ratio **0.18×**. The scarcity ratio is the right arithmetic. The dollar target is the model. |
| Fear & Greed | Worker value, else "—" | alternative.me | **29, Fear**. Exact. |
| Mayer Multiple | CoinGecko daily prices, last 200 closes, from the browser (line 1414) | Recomputed on the same endpoint: 200-day average **$73,160**, multiple **1.02×** | Method is right when the call succeeds. One heavy request per browser, no shared cache. |
| Halving cycle | `(height % 210000) / 210000`, and "day" = `blocks × 10 / 1440` | Calendar days since the 20 Apr 2024 halving are ~933; the block-day count is ~939 | Position is right. The day count is block-time, about a week ahead of the calendar. Peak-window flag is days 365–730, so it is off at day ~939. |
| ATH drawdown | CoinGecko `ath_change_percentage` | Coinpaprika −40.74% | **−40.7%** when ATH arrived. Hidden when the worker drops the field. |
| Power law | `10^(5.82·log10(days since 3 Jan 2009) − 17.01)`. Day count was 6,519. | Formula as written. Parameters were not refit against another model. | Fair value **$154,359**, deviation **−52%**. Arithmetic matches the constants. |
| Pi Cycle | 111-day MA vs 350-day MA × 2, on the same 365-day CoinGecko series (366 points, so the 350-day window is real) | Recomputed: 111-day **$76,115**, 350×2 **$151,334**, gap **−49.7%** | Method matches the classic definition. Not crossed. |
| Puell Multiple | `(subsidy × 144 × price) / (3.125 × 144 × 60000)`. The denominator is a hardcoded **$60,000** average (line 1020). | With subsidy fixed all year, Puell is price / 365-day average price. That average on the CoinGecko daily series is **$76,476**, so Puell is **0.98**. | Card shows **1.25**. About 28% high. Both sit in the "normal" band (thresholds 0.5 and 2.2), so it does not false-flag today. |
| Rainbow band | Slopes and intercept copied in a comment from rainbowchart.com (lines 1036–1049) | Not re-downloaded from rainbowchart.com this run. Internal band edges put $74,758 under the second ceiling ($91,218). | Renders **band 2, "Fire Sale"**. Treat as an embedded formula, not a fresh check of the upstream chart. |
| 4-year MA multiple | Average of the **power-law curve** over 1,460 days (lines 1071–1076), not closes | CoinGecko `days=730` returned 401, so a true 4-year average was not recomputed | Card shows **0.90×** a synthetic average of **$83,170**. That is the model, not the market's 4-year moving average. |
| 2-year MA ×5 | Same, over 730 model days (lines 1125–1130) | Same | **0.67×** a synthetic **$112,253**. The ×5 line lands at $561k. |
| Golden ratio | Price / synthetic 350-day model average (lines 1149–1154) | Real 350-day average from the 365-day series: **$75,667**. Price / that ≈ **0.99×**. | Card shows **0.57×** a **$132,280** "350d MA". |
| 3-month annualized | `(price / powerLaw(90 days ago))^4 − 1` (lines 1214–1218). The comment above it says a real 90-day price would be better. | Actual close ~90 days earlier on the daily series: **$63,538**. Return **+17.6%**, and the same `^4` annualization is about **+91%**. | Card shows about **−92%**. The sign is reversed because it divides today's price by a model value ($142,362) instead of the price then. |
| AHR999 | `price / powerLaw` only (line 1108). The comment quotes the real definition `(price / 200d MA) × (price / fitted value)` and leaves the 200-day term out. | Two-factor version with the measured 200-day MA is **0.50** versus the card's **0.48** | Close today only because the Mayer multiple is 1.02. The card is not AHR999, and the 0.45 / 1.2 bands belong to the two-factor index. |
| Bubble index | `(log10(price) − log10(powerLaw)) / 0.3` | The 0.3 divisor is a constant, not a measured standard deviation | **−1.1σ**. Scale is assumed. |
| Thermo multiple | Sum of BTC issued × **$30,000**, divided into market cap (lines 926–936) | Realized thermocap is the sum of subsidy × price on the day each coin was mined. A flat $30,000 prices the whole issuance at a recent average. | **2.49×** on a **$603B** "thermocap". The thresholds in the tooltip (>5× overheated, <10× accumulation) describe a different series. |
| Terminal price | `(issued BTC × 30000 / supply) × 21` (lines 1179–1180) | Issued BTC equals the supply figure, so this collapses to **21 × $30,000** | The card always prints **$630,000** while those two constants stay. It does not track coin-days or miner revenue. |
| NVT | `market cap / volume24h` (line 948). Tooltip calls it annualized on-chain transaction volume. | With Kraken volume: **~5,800**, which is over the 150 "top" threshold, so the card flashes. With CoinGecko all-exchange volume: **44** ("normal" on the card's own scale). On-chain NVT is a third series and was not available without a paid feed (Coin Metrics returned 403). | False top signal. The ratio is also not annualized (`× 365` is absent) and not on-chain. |
| MVRV Z-Score | Latest CBBI `MVRV` × 100 (line 1614). CBBI's point is a 0–1 score dated 8 Nov 2026: **0.343**. | The tooltip says raw MVRV above 3.0 is a top. The code flags the normalized score at 0.7. | Prints **34%**. That number is not an MVRV z-score. |
| NUPL | Latest CBBI `RUPL` × 100 (line 1627): **0.558** | Same file, same day | Prints **56%**. It is CBBI's normalized RUPL, displayed under the raw NUPL name. |
| RHODL, Macro oscillator, CBBI index | Latest `RHODL` 0.377, `Woobull` 0.417, `Confidence` 0.476, all 8 Nov 2026 | The "latest key" selection matches the file | **38%**, **42%**, **48%**. These are normalized index inputs. The labels should say so. |
| LTH/STH ratio | `(normalized MVRV + normalized Puell) / 2` (line 1603). Puell score in that file is 0.840. | Not a count of long-term vs short-term holder supply | Prints **59%** and calls it a holder ratio. |
| Smithson's forecast | `price / 230000`, targets hardcoded at $175k–$230k (lines 1281–1282) | No live model is queried | **32%** of $230k. A revised forecast would not show up. |
| MSTR average cost | Constants `75694` and `762099` (lines 1235–1236). Comment says March 2026. `scripts/update-mstr-etf.sh` is supposed to rewrite the count weekly and does not touch the cost. | CoinGecko public treasury, the same feed the company card uses: Strategy **849,327 BTC**, entry value $64.08B, average **$75,451**. | The indicator is **87,228 BTC (11%)** below the treasury card on the same screen. Cost is off by $243 (0.3%). |
| RSI-22 | Sum of up-days and down-days over the last 22 closes, divided by 22 (lines 1471–1479). That is a one-window average, not Wilder's RSI. | Wilder RSI on the same daily series: **39.7** | Card shows about **34.7**. Roughly 5 points lower. Both are in the same zone (threshold for a top is 80). |
| AHR999x | `(price / 200d MA)^2` once the chart returns (line 1501) | Depends on the same 200-day average as Mayer (~1.02² ≈ 1.04) | Definition as coded. Far from the flash threshold of 8. |
| BTC dominance | Browser `GET /global`, `market_cap_percentage.btc` (line 1527) | CoinGecko **59.6%**. Coinpaprika **57.5%**. | About 2 points of methodology gap between the two global indexes. Per-browser call, no shared cache. |
| ETF/BTC ratio, net flow, 5-day flow | Flows file plus `totalBtc` from the holdings file, divided by a **hardcoded supply of 19,840,000** and `btc_last_price` (lines 1703–1710) | Supply in the worker is 20,110,003. Flow file ends 8 Oct 2026. | Ratio moves ~0.1 point from the stale supply constant. The flow is a month old and still drives the top-signal badge (7 outflow days, 5-day sum under −$500M). |

The "N of M flashing" counter includes the NVT card, which flashes because the volume under it is Kraken's. The other broken cards mostly miss their (also mis-scaled) thresholds, so the counter under-reports them rather than lighting up.

## What checked out

Price, 24h high and low, block height, subsidy, halving block, blocks remaining, difficulty, the next-adjustment percentage, fee passthrough, mempool count and vsize, the issuance sum, market cap, sats per dollar, Fear & Greed, and the all-time high (when CoinGecko made it into the payload) all agree with a second source inside a few tenths of a percent, or exactly.

Mayer Multiple and Pi Cycle use real daily closes and match a recomputation of that series. The Stock-to-Flow **ratio** (122) is the right flow math for a 3.125 BTC subsidy. Rainbow, the power-law deviation, and the S2F dollar model match the constants in the file; they are models, and this audit did not refit them.

## Intervals worth using

Price is the only figure that should move every few seconds, and the WebSocket already paints it every 10 seconds. Everything else should be read from one worker snapshot.

| Data | Suggested TTL on the shared snapshot | Why |
| --- | --- | --- |
| Price, 24h change, 24h high/low | 10–30s in the browser via the existing socket. REST fallback hits `/btc-data`, not CoinGecko. | Already the right shape. Stop seeding the percent from Kraken's midnight open. |
| 5-minute candles | Edge and client both 30–60s. Keep patching the last close from the socket. | Bars only close every 5 minutes. The client currently waits 5 minutes, so a new bar is late. 60s at the edge is enough. |
| Block height, fees, mempool | 30–60s | Height moves about every 10 minutes. Fees and the mempool move faster, and 60s is enough for a dashboard. |
| Hashrate, difficulty, next adjustment | 10–15 min | Difficulty is constant for ~2 weeks. Hashrate estimates are multi-hour averages. |
| Supply, subsidy, halving block | Derived from height. No extra fetch. | Recompute the ETA with `timeAvg / 600`, and label it as an estimate. |
| Market cap, ATH, dominance, all-exchange volume | 2–5 min, inside the worker, from the CoinGecko call already made | The browser should not call `/global`, `simple/price`, or `market_chart`. |
| Mayer, Pi Cycle, RSI, real moving averages | 1 hour, computed in the worker from one daily series | Replaces the power-law stand-ins for the 2-year, 4-year, 350-day, and 90-day figures. |
| Fear & Greed, CBBI | 6 hours | Both are daily. Ship the handful of latest points, not the 2.9 MB file. |
| Gold | 30 min, on the worker | XAUT vs PAXG already agree. Drop the $3,200 fallback or set it from the last good price. |
| Lightning | 1 hour, and print `added` | The source row is from June 2026. Refreshing every 90s does not make it newer. |
| Treasuries, ETF holdings, ETF flows, MSTR | Daily, with the as-of date in the card | The company list is already live per browser. The MSTR constants and the ETF files are the stale copies. |
| Government holdings | Weekly at most, dated | There is no API call today. |

## Follow-up plan

No behavior change in this pass. The fixes below change numbers users see, so they belong in a later change with the dashboard open and the cross-checks repeated.

1. **24h change.** In `collectBtcData`, stop using Kraken `o`. Coinbase `/products/BTC-USD/stats` field `open` is the 24h open (already the right idea on the socket). Keep Kraken `h[1]` and `l[1]` only as a fallback. Update the Nacho sentence in `renderIntent` (`nacho-logic.mjs` line 319) and the fixture in `tests/nacho-quality.js` (the mock at line 39 sets `o` and the case at line 74 expects that percent to be "24 hours"). Also stop seeding `_wsOpenPrice` from `change24h` (`bitcoin-dashboard.js` lines 250–252) until the new field is a real 24h move. The button refresher at line 671 rewrites the badge from the cached worker percent every 2 minutes.

2. **Volume and NVT.** Read `market_data.total_volume.usd` from the CoinGecko coin response already requested at line 791. Put that in `volume24h`. Point the tooltip at line 494 at "CoinGecko, all exchanges" and drop the word "annualized" on the NVT card (line 956) unless the ratio is actually changed to on-chain volume. NVT should not flash on a single-exchange denominator.

3. **Delete the stand-in prices.** Puell (line 1020, the `60000`), thermo and terminal (lines 933 and 1179, the `30000`), the 90-day return (line 1215), and the 350 / 730 / 1,460-day averages (lines 1071, 1125, 1149) should use the daily closes already fetched for Mayer, computed once in the worker. Until that series exists, those cards should show "—" rather than a model wearing a market label. AHR999 should include the 200-day term or be renamed to "price / power-law fit".

4. **Name the CBBI scores as normalized.** MVRV, NUPL, RHODL, and the macro oscillator (the block from line 1545) display 0–1 index values. The LTH/STH card (line 1603) should be removed or replaced with a real holder series. Cache the latest point at the worker for 6 hours so browsers stop downloading 2.9 MB.

5. **MSTR from the treasury payload.** The company card already loads Strategy at 849,327 BTC. Drive the indicator at line 1235 from `total_holdings` and `total_entry_value_usd / total_holdings` on that response. Retire the weekly `sed` against the source file, which has not kept up and never updates the cost.

6. **Halving clock.** Multiply remaining blocks by `timeAvg` from the difficulty-adjustment payload (already stored as part of the epoch) instead of `600` seconds. Do it in `nacho-logic.mjs` line 825 and in the client fallback at line 379. Keep the word "estimated".

7. **Hashrate label.** Show the window ("mempool current estimate") and prefer a documented average (`hashrates[].avgHashrate` over 3 days, cross-checked near blockchain.info's ~797 EH/s versus the unlabeled 962 EH/s). Add a ZH/s step in `fmtCompact` before the network prints 1,000 EH/s.

8. **One snapshot, no per-tab mempool or CoinGecko.** Fold into `/btc-data`, with the TTLs above:
   - `nacho-live.js` lines 26–43 (four mempool calls per tab)
   - `ranking.js` lines 11796–11805
   - dominance (line 1527), the 365-day chart (line 1414), gold (line 1752), treasuries (line 1816)
   - CBBI (line 1545)
   The header and Nacho should read the worker JSON. The WebSocket stays.

9. **Timeouts and the deploy.** Give CoinGecko and the candle fetch longer than 2.5 seconds, or cache them on their own slower key so a slow CoinGecko cannot blank the all-time high. Redeploy the worker: this repo's collector returns Lightning **4,798 BTC** and ATH **$126,080**; the worker serving the site at 17:34 UTC returned **3,195 BTC** and no ATH. Print Lightning `added` (16 June 2026) on the card.

10. **ETF and governments.** Surface the file date as the primary label, not a footnote. The cron scripts (`scripts/update-etf-flows.sh`, `scripts/update-etf-holdings.sh`) last left data at 8 Oct and 14 Oct 2026 in this tree. Revisit the May 2026 shares-outstanding constants before trusting a "daily" flow badge. Date `GOV_HOLDINGS` or stop adding it into the grand total.

11. **Gold fallback.** Replace the hardcoded $3,200 (line 1765) with the last cached XAUT price.

## This change

Documentation only. The inaccurate figures need a different endpoint or a different series, which would change the dashboard and Nacho's answers. None of those edits are included here.
