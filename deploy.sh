#!/bin/bash
# Bitcoin Education Archive — Deploy Script
# Commits, pushes, and auto-purges Cloudflare cache

cd /root/simple-archive

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
    RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/60fbfd1fc52f7eee8de12df7f3c6d1de/purge_cache" \
         -H "Authorization: Bearer v3WdZ_xsWECOopAXIX5QmW9RKZBLzpyOcOhFDDeo" \
         -H "Content-Type: application/json" \
         --data '{"purge_everything":true}')
    
    if echo "$RESULT" | grep -q '"success":true'; then
        echo "✅ Cloudflare cache purged! Changes are live immediately."
    else
        echo "⚠️ Cache purge failed: $RESULT"
    fi
else
    echo "❌ Push failed."
    exit 1
fi
