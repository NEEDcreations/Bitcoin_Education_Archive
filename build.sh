#!/bin/bash
# Build script — concatenate source files into bundle.js, then minify
# Source files are preserved as .src backups

SOURCES="channel_index.js utils.js ranking.js badges.js tickets.js engagement.js nacho-live.js nacho.js nacho-engage.js nacho-closet.js quests.js forum.js marketplace.js messaging.js features.js mobile-ux.js bitcoin-dashboard.js app.js ux-patches.js"
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
terser bundle.src.js -o bundle.js --compress passes=2 --mangle 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️ Minification failed, using unminified bundle"
    cp bundle.src.js bundle.js
fi

echo "✅ Bundle: $(wc -c < bundle.src.js | tr -d ' ') → $(wc -c < bundle.js | tr -d ' ') bytes"
echo "✅ Gzipped: ~$(gzip -c bundle.js | wc -c | tr -d ' ') bytes"
