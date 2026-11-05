#!/usr/bin/env bash
# Save the live OpenAPI document. The API must already be running.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$root/frontend/openapi"
curl -fsS "${API_URL:-http://localhost:8080}/openapi/v1.json" -o "$root/frontend/openapi/swagger.json"
echo "Wrote $root/frontend/openapi/swagger.json"
