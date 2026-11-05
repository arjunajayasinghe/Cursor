#!/usr/bin/env bash
# Apply checked-in EF Core migrations. The API does not do this on startup.
set -euo pipefail
cd "$(dirname "$0")/.."
dotnet tool restore
dotnet ef database update \
  --project src/TeaAuction.Infrastructure \
  --startup-project src/TeaAuction.Api
