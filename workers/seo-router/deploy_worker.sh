#!/bin/bash
set -e
ENV_FILE="$(dirname "$0")/../../.env"
# Read tokens directly from .env — avoid shell interpolation masking
CF_TOKEN=*** '^CF_WORKERS_TOKEN' "$ENV_FILE" | cut -d'"' -f2)
if [ -z "$CF_TOKEN" ]; then
  CF_TOKEN=*** '^CF_API_TOKEN' "$ENV_FILE" | cut -d'"' -f2)
fi
ACCOUNT_ID=$(grep '^CF_ACCOUNT_ID' "$ENV_FILE" | cut -d'"' -f2)

cd "$(dirname "$0")"
CLOUDFLARE_API_TOKEN="***" npx wrangler deploy --account-id "$ACCOUNT_ID"
