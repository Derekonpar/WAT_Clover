#!/usr/bin/env bash
# Provi checkout interceptor (dry run — blocks place order).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
python3 -m pip install -q -r scripts/provi/requirements.txt
python3 -m playwright install chrome 2>/dev/null || python3 -m playwright install chromium
if [[ ! -f data/provi/session.json ]]; then
  echo "No Provi session — run setup first:"
  echo "  python3 scripts/provi/setup_session.py"
  exit 1
fi
exec python3 scripts/provi/intercept_checkout.py "$@"
