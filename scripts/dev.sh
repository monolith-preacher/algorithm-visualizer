#!/usr/bin/env bash
# Starts the API server (http://127.0.0.1:3001) and the Vite dev server
# (http://127.0.0.1:5173) with live reload. Ctrl+C stops both.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -d node_modules ]] || { echo "Dependencies missing: run scripts/setup.sh first" >&2; exit 1; }
exec npm run dev
