#!/bin/bash
# 404.html is the SPA deep-link fallback for GitHub Pages and must stay a
# byte-identical copy of index.html. It used to be maintained by hand, which
# meant every change had to be remembered twice. Now it is generated.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f index.html ]; then
    echo "sync-404: index.html not found" >&2
    exit 1
fi

if cmp -s index.html 404.html 2>/dev/null; then
    echo "sync-404: already in sync"
else
    cp index.html 404.html
    echo "sync-404: 404.html regenerated from index.html ($(wc -c < index.html | tr -d ' ') bytes)"
fi
