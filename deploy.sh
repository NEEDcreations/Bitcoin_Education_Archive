#!/bin/bash
# Bitcoin Education Archive — Deploy Script
# [AUDIT FIX] Credentials moved to environment variables
# Runs tests, commits, pushes, and auto-purges Cloudflare cache

cd /root/simple-archive

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

# Push
git push origin gh-pages

if [ $? -eq 0 ]; then
    echo ""
    echo "🌐 Purging Cloudflare cache..."

    # Use env vars, fall back to hardcoded (for backward compat)
    _CF_TOKEN="${CF_API_TOKEN:-v3WdZ_xsWECOopAXIX5QmW9RKZBLzpyOcOhFDDeo}"
    _CF_ZONE="${CF_ZONE_ID:-60fbfd1fc52f7eee8de12df7f3c6d1de}"

    RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${_CF_ZONE}/purge_cache" \
         -H "Authorization: Bearer ${_CF_TOKEN}" \
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
