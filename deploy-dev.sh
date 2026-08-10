#!/bin/bash
# deploy-dev.sh — Deploy to dev preview site
# URL: https://bitcoin-education-dev.web.app
# Does NOT commit to git, does NOT purge CF cache, does NOT touch prod.
# Usage: bash deploy-dev.sh

set -e
cd /root/simple-archive

if [ -f .env ]; then
    set -o allexport; source .env; set +o allexport
fi

echo "🔧 Dev deploy → https://bitcoin-education-dev.web.app"
echo ""

# Syntax check bundle
echo "🔍 Syntax check..."
node -e "new Function(require('fs').readFileSync('bundle.js','utf8'))" && echo "✅ bundle.js OK"
echo ""

# Deploy to dev hosting target only (no functions, no git, no CF purge)
npx firebase deploy \
  --only hosting:dev \
  --token "$FIREBASE_TOKEN" \
  --project bitcoin-education-archive 2>&1

echo ""
echo "✅ Dev deploy complete → https://bitcoin-education-dev.web.app"
