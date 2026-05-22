#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and fill in Clover credentials."
  exit 1
fi

python3 -m pip install -q -r server/requirements.txt

if [[ ! -d web/node_modules ]]; then
  (cd web && npm install)
fi

echo "Starting API on http://127.0.0.1:8787"
echo "Starting UI  on http://127.0.0.1:5173"
echo "Press Ctrl+C to stop both."

python3 -m uvicorn server.main:app --host 127.0.0.1 --port 8787 --reload &
API_PID=$!
(cd web && npm run dev) &
WEB_PID=$!

trap 'kill $API_PID $WEB_PID 2>/dev/null' EXIT
wait
