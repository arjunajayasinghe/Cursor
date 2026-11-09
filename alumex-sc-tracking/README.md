# Alumex Supply Chain Connect

Self-contained Procurement Approval & Supply Chain Connect core (demo). Lives under `alumex-sc-tracking/` in the Cursor workspace — no separate GitHub repo required.

**Stack:** Next.js + React + TypeScript · Tailwind + shadcn-style UI · NestJS REST · PostgreSQL + Prisma

**Scope in this build**

1. App shell + Overview dashboard  
2. Purchase requisitions (list, expand lines, report columns, SAP PR import stub)  
3. PO & PI module  
4. Prisma foundations for PR/PO plus stubs for later modules  
5. NestJS REST CRUD for PR and PO with GUI-schema demo seed  
6. Open demo access (permissions / Entra last)

Field source tags: **S** SAP · **W** web app · **A** calculated · **E** external · **M** master data.

## Structure

```
alumex-sc-tracking/
  apps/web          Next.js UI (port 3000)
  apps/api          NestJS REST API (port 4000)
  packages/db       Prisma schema, migrations, seed
  docker-compose.yml
  samples/          Example SAP PR TSV for import stub
```

## Prerequisites

- Node.js 20+
- PostgreSQL 16 (local or Docker)

```bash
# Docker (if available)
docker compose up -d

# Or local Postgres — create DB/user matching .env.example
```

## Setup

```bash
cd alumex-sc-tracking
cp .env.example .env
cp .env packages/db/.env
cp .env apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local   # or use the committed template values

npm install
npm run db:generate -w @alumex/db
npm run deploy -w @alumex/db          # prisma migrate deploy
npm run seed -w @alumex/db
```

Default `DATABASE_URL`:

```
postgresql://alumex:alumex@localhost:5432/alumex_scc?schema=public
```

## Run

Terminal 1 — API:

```bash
npm run start:dev -w @alumex/api
# http://localhost:4000/health
```

Terminal 2 — Web:

```bash
npm run dev -w @alumex/web
# http://localhost:3000
```

## What works

| Area | Behaviour |
| --- | --- |
| Overview | KPI cards, pipeline bars, attention list, recent PR/PO |
| Purchase requisitions | Grouped list, expand lines, Report columns toggle, detail drawer with S/W/A/E/M tags, create line, SAP TSV import analyze/commit |
| PO / PI | List/search/filter, detail drawer, create/update, calculated total + expected delivery |
| API | `GET/POST/PATCH/DELETE /pr`, `/pr/groups`, `/pr/import/*`, `/po`, `GET /overview` |
| Later modules | Prisma models seeded; nav stubs marked “soon” |

## Sample import

Use `samples/sap-pr-report.tsv` on **Purchase requisitions → Import SAP PR file**. The analyzer ports the GUI handoff `pr-import.js` column map and validation.

## Design notes

UI follows the Alumex GUI handoff: light surface, SAP-like blue primary, status badges, left nav, list + detail drawer. Demo role selector is visual only — RBAC is deferred.
