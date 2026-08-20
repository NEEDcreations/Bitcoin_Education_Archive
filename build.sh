#!/bin/bash
# Build script — concatenate source files into bundle.js, then minify
# Source files are preserved as .src backups

# styles/icons.js is first: it defines the global icon() / stripLeadingEmoji()
# helpers that later files in this list call at render time.
SOURCES="styles/icons.js channel_index.js utils.js ranking.js badges.js tickets.js engagement.js nacho-live.js nacho.js nacho-engage.js nacho-closet.js quests.js forum.js marketplace.js messaging.js features.js mobile-ux.js bitcoin-dashboard.js usermap.js app.js ux-patches.js"
# Extracted from bundle (lazy-loaded separately): nacho-qa.js (524KB), scholar.js (298KB), beats.js (174KB), irl-sync.js (31KB)
# PVP is lazy-loaded — not included in bundle, served as separate file

echo "📦 Building bundle from source files..."
cat $SOURCES > bundle.src.js

echo "🔍 Validating syntax..."
node -e "new Function(require('fs').readFileSync('bundle.src.js','utf8'))" 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Syntax error in bundle! Aborting."
    exit 1
fi

echo "🗜️ Minifying bundle.js..."
# Silently copying the unminified source on failure is how a ~170KB gzip
# regression reaches production unnoticed. Be loud, and make the fallback
# an explicit opt-in.
if ! command -v terser >/dev/null 2>&1; then
    echo ""
    echo "❌ terser is not installed — refusing to overwrite bundle.js with the"
    echo "   unminified source (2.9MB / ~700KB gz vs 2.0MB / ~529KB gz)."
    echo ""
    echo "   Install it:            npm i -g terser"
    echo "   Or accept the cost:    ALLOW_UNMINIFIED=1 ./build.sh"
    echo ""
    if [ "${ALLOW_UNMINIFIED:-}" = "1" ]; then
        echo "   ALLOW_UNMINIFIED=1 set — copying unminified bundle."
        cp bundle.src.js bundle.js
    else
        exit 1
    fi
elif ! terser bundle.src.js -o bundle.js --compress passes=2 --mangle; then
    echo "❌ terser failed — bundle.js left untouched."
    exit 1
fi

echo "✅ Bundle: $(wc -c < bundle.src.js | tr -d ' ') → $(wc -c < bundle.js | tr -d ' ') bytes"
echo "✅ Gzipped: ~$(gzip -c bundle.js | wc -c | tr -d ' ') bytes"

echo "🎨 Design lint..."
./scripts/design-lint.sh || exit 1

echo "📄 Syncing 404.html..."
./scripts/sync-404.sh
