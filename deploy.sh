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

# Auto-bump cache-busters for lazy-loaded files that were modified.
# Compares each file to its last committed version; if changed, stamps
# a fresh ?v=YYYYMMDD_HHMM suffix in index.html.
DEPLOY_STAMP=$(date -u +%Y%m%d_%H%M)
LAZY_FILES="timechain-tv.js nacho-qa.js scholar.js beats.js irl-sync.js pvp.js onboarding.js global-chat.js lightning.js lightning-tips.js notifications.js"
for LFILE in $LAZY_FILES; do
    if [ -f "$LFILE" ] && ! git diff --quiet HEAD -- "$LFILE" 2>/dev/null; then
        OLD_BUSTER=$(grep -oP "${LFILE}\\?v=\\K[^ \"']+" index.html | head -1)
        if [ -n "$OLD_BUSTER" ]; then
            sed -i "s|${LFILE}?v=${OLD_BUSTER}|${LFILE}?v=${DEPLOY_STAMP}|g" index.html
            echo "  🔄 ${LFILE}: v=${OLD_BUSTER} -> v=${DEPLOY_STAMP}"
        fi
    fi
done

# Also auto-bump bundle.js cache-buster if modified
if [ -f bundle.js ] && ! git diff --quiet HEAD -- bundle.js 2>/dev/null; then
    OLD_BB=$(grep -oP 'bundle\.js\?v=\K[^ "]+' index.html | head -1)
    if [ -n "$OLD_BB" ]; then
        sed -i "s|bundle.js?v=${OLD_BB}|bundle.js?v=${DEPLOY_STAMP}|g" index.html
        echo "  🔄 bundle.js: v=${OLD_BB} -> v=${DEPLOY_STAMP}"
    fi
fi

# Copy index to 404
cp index.html 404.html

# ---- Verify cache-busters are fresh (safety net) ----
# Check that no lazy-loaded file has a stale buster from a previous deploy
BUSTER_FAIL=0
for LFILE in $LAZY_FILES; do
    if [ -f "$LFILE" ] && ! git diff --quiet HEAD -- "$LFILE" 2>/dev/null; then
        CURRENT_B=$(grep -oP "${LFILE}\\?v=\\K[^ \"']+" index.html | head -1)
        if [ "$CURRENT_B" != "$DEPLOY_STAMP" ]; then
            echo "  STALE: ${LFILE}?v=${CURRENT_B} (expected ${DEPLOY_STAMP})"
            BUSTER_FAIL=1
        fi
    fi
done
if [ $BUSTER_FAIL -eq 1 ]; then
    echo "Cache-buster verification FAILED. Fix index.html before deploying."
    exit 1
fi
echo "Cache-busters verified."

# Stage all changes
git add -A

# Commit with message (use first argument or default)
MSG="${1:-Deploy update}"
git commit -m "$MSG"

if [ $? -ne 0 ]; then
    echo "❌ Commit failed (tests blocked it). Fix and retry."
    exit 1
fi

# Push to all remotes. Mirrors push in background so they don't block the deploy, but
# errors are captured to /tmp and summarized after so a silent credential/access failure
# on a mirror doesn't go unnoticed for weeks.
git push origin gh-pages
ORIGIN_RC=$?

push_mirror() {
    local name="$1"
    local log="/tmp/deploy_push_${name}.log"
    echo "📦 Pushing to ${name}..."
    # Run in background so mirrors don't block. Capture stderr for post-report.
    ( git push --force "$name" gh-pages > "$log" 2>&1 ; echo $? > "${log}.rc" ) &
}

push_mirror codeberg
push_mirror gitlab

# Give the mirrors a beat to finish (or at least fail fast). We intentionally don't
# wait forever — a stuck mirror should NOT hold up the deploy — but we do want to
# surface failures that happen within the first few seconds.
sleep 8
for mirror in codeberg gitlab; do
    rc_file="/tmp/deploy_push_${mirror}.log.rc"
    if [ -f "$rc_file" ]; then
        rc=$(cat "$rc_file")
        if [ "$rc" != "0" ]; then
            echo "⚠️  Mirror push to ${mirror} FAILED (rc=${rc}) — see /tmp/deploy_push_${mirror}.log"
            tail -3 "/tmp/deploy_push_${mirror}.log" | sed 's/^/    /'
        else
            echo "✅ ${mirror} up to date"
        fi
    else
        echo "⏳ Mirror push to ${mirror} still running in background (will not block deploy)."
    fi
done

# Restore origin's success code for the Cloudflare purge decision below.
[ $ORIGIN_RC -eq 0 ]

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
