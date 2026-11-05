# Tea auction catalogue

Operators upload a tea auction sale (a catalogue of lots) and review what was accepted.

The API stores the file, and a Hangfire job reads it into lots. Sales are listed with their lots and the upload that created them.

## Local development

You need Docker, the .NET 10 SDK, and Node.js 22.

```bash
docker compose up -d postgres
./backend/scripts/migrate.sh
docker compose up -d api

cd frontend
npm install
npm run dev
```

- Catalogue desk: http://localhost:5173
- Pre-auction catalogues: http://localhost:5173/
- Uploads list (open a file for lot details): http://localhost:5173/uploads
- Upload all 8 broker catalogues: http://localhost:5173/upload
- Upload post-auction sales (same 8-broker desk): http://localhost:5173/upload-sales
- API: http://localhost:8080
- Swagger UI: http://localhost:8080/swagger
- OpenAPI document: http://localhost:8080/openapi/v1.json
- Hangfire dashboard (Development only): http://localhost:8080/hangfire

Send header `X-Api-Key: dev-tea-auction-key`. The Vite dev server reads that key from `frontend/.env.development`.

A sample catalogue is `samples/colombo-sale-23-lots.csv`.

```bash
curl -sS -X POST http://localhost:8080/api/uploads \
  -H "X-Api-Key: dev-tea-auction-key" \
  -F saleNumber=23 \
  -F year=2026 \
  -F centre=Colombo \
  -F saleDate=2026-05-05 \
  -F file=@samples/colombo-sale-23-lots.csv
```

`Seed__SampleData=true` inserts Colombo sale 22/2026 when the database has no sales. Development settings and Compose turn the flag on. Leave it off outside local dev.

To apply migrations from a container instead of the host SDK:

```bash
docker compose --profile migrate run --rm migrate
```

Without Docker, run PostgreSQL 16 with database `tea_auction`, user `tea`, password `tea`, then:

```bash
./backend/scripts/migrate.sh
cd backend && dotnet run --project src/TeaAuction.Api
```

Postgres in Compose is on the `tea_auction_private` network and is published only on `127.0.0.1` so this script can reach it. The API is the application client.

## Migrations

Migrations are checked in under `backend/src/TeaAuction.Infrastructure/Persistence/Migrations`. The API does not call `Database.Migrate()` on startup. CI applies them as its own step.

```bash
./backend/scripts/migrate.sh
```

That restores the local `dotnet-ef` tool and runs:

```bash
dotnet ef database update \
  --project src/TeaAuction.Infrastructure \
  --startup-project src/TeaAuction.Api
```

Set `ConnectionStrings__Database` to point the command at another server.

## Regenerate the OpenAPI client

The React app imports types generated from `frontend/openapi/swagger.json`. Do not hand-write API DTO types.

With the API running:

```bash
./backend/scripts/export-openapi.sh
cd frontend && npm run generate:api
```

`generate:api` runs `openapi-typescript` and writes `frontend/src/api/generated/schema.d.ts`.

## Catalogue files

These uploads are **pre-auction catalogues** (offer books). Set the sale header once, drop all eight broker files in one go (filenames like `AS_-_SC_03.txt` are auto-matched), then click **Upload all 8**. Open an upload or the sale to browse the full catalogue line: factory, garden, invoice, grade, bags, package type, net/bag, net kg, selling mark, warehouse/basis, category, and the source row. After the auction, broker **sales result** files will be a separate upload step.

Broker `.txt` fixed-width files and `.csv` files are accepted.

CSV lots-only header:

```text
lotNumber,gardenMark,invoiceNumber,grade,bags,netWeightKg,valuationPerKg
```

`valuationPerKg` may be blank. Grades are free-form broker marks (BOPF, FBOPF1, PEK1, …). Centres: Colombo, Mombasa, Kochi, Jakarta, Kolkata.

A sale is centre + year + sale number. Lots are unique per broker on that sale (`sale + broker + lot number`). Hangfire writes the lots after the file is stored.

## Auth and logging

Middleware requires `X-Api-Key`, except `/health` (and Swagger, plus the Hangfire dashboard in Development). This is a dev gate, not an identity product. Set `Auth__ApiKey` for any shared environment. If no key is configured, requests are rejected.

Serilog writes structured logs to stdout. Email is an `IEmailSender`; the local implementation logs the message instead of sending it.

## AWS shape

Nothing in this repo provisions AWS. The intended layout is:

- **Frontend.** `npm run build` writes static files to `frontend/dist`. Host them on S3 with CloudFront in front, and map SPA 403/404 responses to `index.html`. Set `VITE_API_BASE_URL` at build time to the API origin.
- **API.** Build `backend/Dockerfile` (port 8080, non-root) and run it on ECS Fargate behind an ALB. The target group health check is `GET /health`. TLS ends at the load balancer. Put the connection string and API key in Secrets Manager or SSM, not in the image.
- **Database.** RDS PostgreSQL in private subnets, no public address. Its security group allows 5432 only from the API service security group. Use Multi-AZ in production and a single instance in dev and test. Turn on automated backups, with a longer retention in production. Apply EF migrations as a pipeline step, not on task startup.
- **Uploads.** An S3 bucket separate from the web bucket. The task role can read and write it. Locally the same `IFileStore` uses a directory, or S3-compatible storage when `FileStore__Provider=S3` and `FileStore__ServiceUrl` are set.
- **Jobs.** Hangfire stores its schema in the same PostgreSQL database and runs inside the API process.

## CI

`.github/workflows/ci.yml` builds the API, runs unit tests, applies migrations to a Postgres service container, and typechecks and builds the frontend.
