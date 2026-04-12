#!/bin/bash
# Bitcoin Education Archive — Deploy Script
# [AUDIT FIX] Credentials moved to environment variables
# Runs tests, commits, pushes, and auto-purges Cloudflare cache

cd /root/simple-archive

# Load env vars if .env exists (not committed to git)
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# ---- Update data feeds ----
echo "📊 Updating ETF holdings data..."
bash scripts/update-etf-holdings.sh 2>&1 || echo "⚠️ ETF update failed (non-blocking)"

# ---- Build: concatenate and minify bundle ----
echo "🔨 Building bundle..."
if [ -f build.sh ]; then
    ./build.sh
    if [ $? -ne 0 ]; then
        echo "❌ Build failed"
        exit 1
    fi
fi

# ---- Run tests first ----
echo "🧪 Running pre-commit tests..."
node tests/run-all.js
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Tests failed — commit blocked"
    echo "Fix the issues above before committing."
    exit 1
fi

echo ""
echo "✅ All tests passed — committing"

# Auto-bump SW cache version on every deploy
if [ -f sw.js ]; then
    CURRENT_V=$(grep -oP 'btc-archive-v\K[0-9]+' sw.js)
    if [ -n "$CURRENT_V" ]; then
        NEW_V=$((CURRENT_V + 1))
        sed -i "s/btc-archive-v${CURRENT_V}/btc-archive-v${NEW_V}/" sw.js
        echo "🔄 SW cache bumped: v${CURRENT_V} → v${NEW_V}"
    fi
fi

# Copy index to 404
cp index.html 404.html

# Stage all changes
git add -A

# Commit with message (use first argument or default)
MSG="${1:-Deploy update}"
git commit -m "$MSG"

if [ $? -ne 0 ]; then
    echo "❌ Commit failed (tests blocked it). Fix and retry."
    exit 1
fi

# Push to all remotes
git push origin gh-pages
echo "📦 Pushing to Codeberg..."
git push codeberg gh-pages 2>/dev/null &
echo "📦 Pushing to GitLab..."
git push gitlab gh-pages 2>/dev/null &

if [ $? -eq 0 ]; then
    echo ""
    echo "🌐 Purging Cloudflare cache..."

    # Use env vars, fall back to hardcoded (for backward compat)
    if [ -z "$CF_API_TOKEN" ] || [ -z "$CF_ZONE_ID" ]; then
        echo "⚠️ CF_API_TOKEN or CF_ZONE_ID not set. Skipping cache purge."
        echo "   Set them with: export CF_API_TOKEN=... && export CF_ZONE_ID=..."
        exit 0
    fi

    RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
         -H "Authorization: Bearer ${CF_API_TOKEN}" \
         -H "Content-Type: application/json" \
         --data '{"purge_everything":true}')
    
    if echo "$RESULT" | grep -q '"success": true\|"success":true'; then
        echo "✅ Cloudflare cache purged! Changes are live immediately."
    else
        echo "⚠️ Cache purge failed: $RESULT"
    fi
else
    echo "❌ Push failed."
    exit 1
fi
