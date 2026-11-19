#!/bin/bash
# Refresh Signal ticker headlines into newsletter-data.json
# Scheduled every 4 hours via .github/workflows/update-ticker.yml
# Public RSS / YouTube Atom feeds only. No API keys.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec node scripts/update-ticker.js
