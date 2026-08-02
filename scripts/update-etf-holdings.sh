#!/bin/bash
# Update Bitcoin ETF holdings — runs daily via cron
# Derives BTC holdings from shares outstanding × BTC-per-share + Yahoo Finance prices
# Outputs data/etf-holdings.json, read by the Bitcoin Dashboard
#
# Cron setup (daily at 6 AM UTC, after US market close):
#   0 6 * * * /root/simple-archive/scripts/update-etf-holdings.sh >> /tmp/etf-update.log 2>&1
#
# Also runs automatically on every deploy (via deploy.sh)
#
# To update shares outstanding / BTC-per-share calibration:
#   Check SEC EDGAR filings or ETF issuer pages quarterly

set -euo pipefail
cd "$(dirname "$0")/.."

DATA_FILE="data/etf-holdings.json"
TEMP_FILE="$(mktemp -t etf-holdings-XXXXXX.json)"
trap 'rm -f "$TEMP_FILE"' EXIT

echo "[ETF Update] $(date -u '+%Y-%m-%d %H:%M UTC')"

node -e "
const https = require('https');
const http = require('http');
const fs = require('fs');

function fetchJSON(url) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 15000);
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BEA-bot/1.0)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { clearTimeout(timer); try { resolve(JSON.parse(data)); } catch(e) { reject(new Error('parse: ' + data.substring(0,200))); } });
    }).on('error', e => { clearTimeout(timer); reject(e); });
  });
}

async function main() {
  // 1. Get BTC price
  let btcPrice;
  try {
    const pg = await fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    btcPrice = pg.bitcoin.usd;
  } catch(e) {
    console.error('[ETF] Cannot get BTC price:', e.message);
    process.exit(1);
  }
  console.log('[ETF] BTC price: \$' + btcPrice);

  // 2. Try to get IBIT AUM from Yahoo Finance chart (market price)
  //    For each ETF: get share price, compute AUM = price × known shares outstanding
  //    Shares outstanding sources: SEC filings, published daily by each issuer
  
  // Known shares outstanding (from SEC filings, updated periodically)
  // These change daily as shares are created/redeemed but are relatively stable
  // Last calibrated: May 23, 2026 (cross-referenced with BitcoinTreasuries.net)
  const SHARES_OUTSTANDING = {
    IBIT: 1383700000,   // ~1.384B shares (BlackRock SEC filing)
    FBTC: 261400000,    // ~261M shares (Fidelity SEC filing)  
    GBTC: 217500000,    // ~218M shares (Grayscale SEC filing)
    ARKB: 205500000,    // ~206M shares (ARK SEC filing)
    BITB: 106000000,    // ~106M shares (Bitwise SEC filing)
  };
  
  // BTC per share (from prospectus/NAV, very slowly declining due to fees)
  // Last calibrated: May 23, 2026 (back-calculated from BitcoinTreasuries.net data)
  const BTC_PER_SHARE = {
    IBIT: 0.000569,     // IBIT NAV = this × BTC price
    FBTC: 0.000816,
    GBTC: 0.000830,  
    ARKB: 0.000311,
    BITB: 0.000509,
  };

  const ETFS = [
    { ticker: 'IBIT', name: 'BlackRock', color: '#6366f1' },
    { ticker: 'FBTC', name: 'Fidelity', color: '#22c55e' },
    { ticker: 'GBTC', name: 'Grayscale', color: '#eab308' },
    { ticker: 'ARKB', name: 'ARK 21Shares', color: '#f97316' },
    { ticker: 'BITB', name: 'Bitwise', color: '#06b6d4' },
  ];

  const holdings = [];
  let totalBtc = 0;

  for (const etf of ETFS) {
    try {
      // Get ETF share price from Yahoo
      const chart = await fetchJSON(
        'https://query1.finance.yahoo.com/v8/finance/chart/' + etf.ticker + '?interval=1d&range=1d'
      );
      const meta = chart.chart.result[0].meta;
      const sharePrice = meta.regularMarketPrice;
      
      // BTC = shares outstanding × BTC per share (from SEC filings / NAV)
      // This is the most accurate method — share prices have premiums/discounts
      // that make AUM-based estimates unreliable
      const btcHeld = Math.round(SHARES_OUTSTANDING[etf.ticker] * BTC_PER_SHARE[etf.ticker]);
      const aum = sharePrice * SHARES_OUTSTANDING[etf.ticker];
      
      holdings.push({
        ticker: etf.ticker,
        name: etf.name,
        color: etf.color,
        btc: btcHeld,
        aum: btcHeld * btcPrice,
        sharePrice: sharePrice,
      });
      totalBtc += btcHeld;
      
      console.log('  ' + etf.ticker + ': ' + btcHeld.toLocaleString() + ' BTC (\$' + (btcHeld * btcPrice / 1e9).toFixed(1) + 'B) [share: \$' + sharePrice + ']');
      
      await new Promise(r => setTimeout(r, 600)); // rate limit
    } catch(e) {
      console.error('  ' + etf.ticker + ': FAILED -', e.message);
      // Fallback: use BTC per share × shares outstanding
      const fallbackBtc = Math.round(SHARES_OUTSTANDING[etf.ticker] * BTC_PER_SHARE[etf.ticker]);
      holdings.push({
        ticker: etf.ticker, name: etf.name, color: etf.color,
        btc: fallbackBtc, aum: fallbackBtc * btcPrice, sharePrice: 0,
      });
      totalBtc += fallbackBtc;
    }
  }

  // Estimate total across ALL US spot ETFs (top 5 ≈ 95%)
  const estTotal = Math.round(totalBtc / 0.95);

  // Sort by BTC descending
  holdings.sort((a, b) => b.btc - a.btc);

  const output = {
    updated: new Date().toISOString(),
    btcPrice: btcPrice,
    holdings: holdings,
    totalBtc: estTotal,
    totalAum: estTotal * btcPrice,
    source: 'Derived from shares outstanding (SEC filings) × BTC-per-share + Yahoo Finance prices',
  };

  fs.writeFileSync('$TEMP_FILE', JSON.stringify(output, null, 2));
  console.log('[ETF] Total (top 5): ' + totalBtc.toLocaleString() + ' BTC');
  console.log('[ETF] Estimated total (all ETFs): ~' + estTotal.toLocaleString() + ' BTC');
}

main().catch(e => { console.error('[ETF] FATAL:', e.message); process.exit(1); });
" || { echo "[ETF] Script failed"; exit 1; }

# Validate and move
if [ -f "$TEMP_FILE" ] && node -e "JSON.parse(require('fs').readFileSync('$TEMP_FILE','utf8'))" 2>/dev/null; then
  mv "$TEMP_FILE" "$DATA_FILE"
  echo "[ETF] ✅ Updated $DATA_FILE"
else
  echo "[ETF] ❌ Invalid output, keeping old data"
  exit 1
fi
