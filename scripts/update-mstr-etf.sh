#!/bin/bash
# update-mstr-etf.sh — Scrape MSTR BTC holdings from bitcointreasuries.net
# Run weekly: 0 6 * * 1 /root/simple-archive/scripts/update-mstr-etf.sh

set -e
cd /root/simple-archive

echo "$(date) — Fetching MSTR data from bitcointreasuries.net..."

PAGE=$(curl -s "https://bitcointreasuries.net/" 2>/dev/null)

# Find MSTR row — look for 762,XXX pattern near "MSTR" text
# The MSTR ticker and its BTC count appear close together in the HTML
MSTR_BTC=$(echo "$PAGE" | tr '\n' ' ' | grep -oP 'MSTR.{0,500}?\d{3},\d{3}' | grep -oP '\d{3},\d{3}' | head -1 | tr -d ',')

if [ -z "$MSTR_BTC" ] || [ "$MSTR_BTC" -lt 500000 ] 2>/dev/null; then
    echo "ERROR: MSTR scrape failed or value too low ($MSTR_BTC). Skipping."
    exit 0
fi

echo "MSTR BTC from site: $MSTR_BTC"

# Read current value
CURRENT=$(grep -oP 'var mstrBTC = \K[0-9]+' bitcoin-dashboard.js | head -1)
echo "Current in code: $CURRENT"

if [ "$MSTR_BTC" -eq "$CURRENT" ] 2>/dev/null; then
    echo "$(date) — No change needed ($MSTR_BTC = $CURRENT)"
    exit 0
fi

echo "Updating $CURRENT → $MSTR_BTC..."
sed -i "s/var mstrBTC = [0-9]\+;/var mstrBTC = $MSTR_BTC;/" bitcoin-dashboard.js bundle.src.js

# Validate
node -e "new Function(require('fs').readFileSync('bitcoin-dashboard.js','utf8'))" || { echo "ERROR: JS broke!"; git checkout bitcoin-dashboard.js bundle.src.js; exit 1; }

echo "Deploying..."
bash deploy.sh "Auto-update: MSTR BTC holdings $MSTR_BTC (scraped $(date +%Y-%m-%d))" 2>&1 | tail -3
echo "$(date) — Done! MSTR updated to $MSTR_BTC BTC"
