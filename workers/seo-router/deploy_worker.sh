#!/bin/bash
set -e
ENV_FILE="$(dirname "$0")/../../.env"

# Wrangler 4 dropped --account-id. It reads CLOUDFLARE_ACCOUNT_ID.
# ../../.env is optional; an already-exported token and account id are enough.
if [ -f "$ENV_FILE" ]; then
  # Read tokens directly from .env — avoid shell interpolation masking
  if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
    CF_TOKEN=$(grep '^CF_WORKERS_TOKEN' "$ENV_FILE" | cut -d'"' -f2)
    if [ -z "$CF_TOKEN" ]; then
      CF_TOKEN=$(grep '^CF_API_TOKEN' "$ENV_FILE" | cut -d'"' -f2)
    fi
    CLOUDFLARE_API_TOKEN="$CF_TOKEN"
  fi
  if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
    CLOUDFLARE_ACCOUNT_ID=$(grep '^CF_ACCOUNT_ID' "$ENV_FILE" | cut -d'"' -f2)
  fi
fi

cd "$(dirname "$0")"
export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID
npx wrangler deploy --keep-vars
