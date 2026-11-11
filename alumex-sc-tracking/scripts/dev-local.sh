#!/usr/bin/env bash
# Permanent local demo: Nest on :4000, Next on 0.0.0.0:3000, browser talks to /api/nest.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_LOCAL="$ROOT/apps/web/.env.local"
if [[ ! -f "$ENV_LOCAL" ]]; then
  cp "$ROOT/apps/web/.env.local.example" "$ENV_LOCAL"
  echo "Wrote $ENV_LOCAL"
fi

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then kill "$API_PID" 2>/dev/null || true; fi
  if [[ -n "${WEB_PID:-}" ]]; then kill "$WEB_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

echo "API  http://127.0.0.1:4000"
echo "Web  http://127.0.0.1:3000  (open this; API is same-origin /api/nest)"
npm run start:dev -w @alumex/api &
API_PID=$!
npm run dev -w @alumex/web &
WEB_PID=$!
wait "$WEB_PID"
