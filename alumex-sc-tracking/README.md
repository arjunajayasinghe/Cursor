# Alumex Supply Chain Connect

Self-contained Procurement Approval & Supply Chain Connect demo. Lives under `alumex-sc-tracking/` in the Cursor workspace — no separate GitHub repo required.

**Stack:** Next.js + React + TypeScript · Tailwind + shadcn-style UI · NestJS REST · PostgreSQL + Prisma

Field source tags: **S** SAP · **W** web app · **A** calculated · **E** external · **M** master data.

## Permissions (demo RBAC)

Demo auth uses the **X-Demo-Role** header (role selector in the top bar). NestJS enforces per-module levels on every write/read — UI button hiding is not enough.

| Level | Meaning |
| --- | --- |
| 0 | No access |
| 1 | View only |
| 2 | Create and edit |

Seeded roles (proposed Alumex matrix + GUI handoff):

- **Administrator** — full access + role administration
- **Management** — view across modules
- **Requester** (Requesting Dept.) — edit PR; view linked stages
- **Procurement** — PR / quotes / eval / PO / confirmation owner
- **Finance** — payments (+ delivery cost edit)
- **Import Team** — shipping / vessel / customs / delivery
- **Stores** (Warehouse) — GRN owner
- **Technical 1 / 2** — quotation & evaluation review
- **Supplier** / **Clearing Agent** — assigned-only external stubs (`record_assignments`)

Role matrix UI: `/admin`. Assignment hooks: `GET/POST /permissions/assignments`.

Entra ID / production SSO remains out of scope for this demo.

## SLA & notifications (automation)

Configurable masters (not hardcoded):

- Quotation / evaluation / payment targets default **48 hours**
- Customs clearance **FCL 3 days** / **LCL 5 days**
- Additional GRN and supplier-ack day targets

Settings UI: `/settings` (SLA targets, §12 notification rules, open alerts, exception register, email outbox stub).

Engine: `POST /automation/evaluate` detects overdue quotation/evaluation/payment, ETA revised, vessel arrived, clearance overdue, GRN pending, etc. Events are **deduplicated** in `notification_events`; email is written to `email_outbox` as `stubbed`. Overview **Needs attention** and KPI strip read from the same rules.

## Vessel tracking (6C)

Provider-neutral adapter under `/vessel-tracking`:

- **Mock** AIS provider (default) + optional **REST** stub (`VESSEL_API_URL` / `VESSEL_API_KEY`)
- Match by **IMO / MMSI** (not name alone)
- Nest `@Interval` poll every 5 minutes (`VESSEL_POLL_DISABLED=1` to pause)
- Persists immutable `vessel_tracking_events`
- **Never overwrites** supplier `eta` / `etaRevised` — API ETA stored in `apiEta`
- Vessel screen map: Leaflet + OpenStreetMap last-known position

## Documents

S3-compatible interface with **local filesystem fallback** (`DOCUMENT_STORAGE_PATH`, default `storage/documents/`).

- Register in `document_assets`
- Upload / list / download for PR, quotation, PO/PI, payment, shipping, clearance, GRN (and other modules)
- Drawers include an **Attachments** panel
- Optional S3: set `S3_ENDPOINT` + `S3_BUCKET`

## Modules

| Screen | Route | API |
| --- | --- | --- |
| Overview | `/` | `GET /overview` |
| Purchase requisitions | `/pr` | `/pr`, `/pr/groups`, `/pr/import/*` |
| Quotations | `/quotations` | `/quotes` |
| Evaluation & approval | `/evaluation` | `/eval` |
| PO / PI | `/po` | `/po` |
| Payments | `/payments` | `/pay` |
| Supplier confirmation | `/confirmations` | `/confirm` |
| Shipping | `/shipping` | `/ship` |
| Vessel tracking | `/vessel` | `/vessel`, `/vessel-tracking` |
| Customs clearance | `/customs` | `/customs` |
| Delivery & landed cost | `/delivery` | `/delivery` |
| GRN & closure | `/grn` | `/grn` |
| Reports (pipeline / action / cost / closure + CSV) | `/reports` | `GET /reports?type=` |
| Role administration | `/admin` | `/permissions/*` |
| SLA & notifications | `/settings` | `/automation/*` |
| Master data | `/masters` | `/platform/masters` |
| Integrations | `/integrations` | `/platform/integrations` |
| Exception register | `/exceptions` | `/platform/exceptions` |
| Monitoring report | `/monitoring` | `/platform/monitoring` |
| Documents | (drawer attachments) | `/documents` |
| Audit / workflow | (drawer History + status) | `/platform/audit`, `/platform/workflow` |

Each operational module uses the shared list + detail drawer pattern with source tags, attachments, status transitions and history. Demo records are seeded from the GUI handoff `schema.js` cases.

## Phase 1 inventory

| Area | Ships in this demo |
| --- | --- |
| Core modules 01–07 | PR, quotations, evaluation, PO/PI, payments, confirmation, shipping, vessel, customs, delivery, GRN |
| Overview + reports | KPIs, pipeline, attention, cost, closure, **master monitoring spreadsheet columns** |
| RBAC | Demo role selector, Nest enforcement, role matrix, assigned-only external stubs |
| Automation | Configurable SLA masters, §12 notification engine, email outbox stub, exception register |
| Vessel 6C | Mock/REST adapter, IMO/MMSI match, poll interval, events, Leaflet map, supplier ETA preserved |
| Documents | Local/S3 storage interface, document_assets, drawer upload/list/download |
| Workflow | Per-module status machines (independent stages), transition API + drawer controls |
| Audit | Record history with old/new JSON, source tags (manual/import/provider) |
| Master data | Plants, currencies, UOM, Incoterms, delay reasons, suppliers |
| Integrations | SAP import register + CSV/XLSX validate → preview → reconcile + field source priority |
| Import history | Immutable `import_batches` with mismatch exceptions; notes never overwritten |
| Hardening | Duplicate checks (PR/PO/GRN keys), validation on uploads/transitions, seed completeness |

## Structure

```
alumex-sc-tracking/
  apps/web          Next.js UI (port 3000)
  apps/api          NestJS REST API (port 4000)
  packages/db       Prisma schema, migrations, seed
  storage/documents Local document blobs (gitignored)
  docker-compose.yml
  samples/          Example SAP PR TSV for import stub
```

## Prerequisites

- Node.js 20+
- PostgreSQL 16 (local or Docker)

```bash
docker compose up -d
# or create local DB/user matching .env.example
```

## Setup

```bash
cd alumex-sc-tracking
cp .env.example .env
cp .env packages/db/.env
cp .env apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local

npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

Default `DATABASE_URL`: `postgresql://alumex:alumex@localhost:5432/alumex_scc?schema=public`

## Run

```bash
npm run start:dev -w @alumex/api   # http://localhost:4000/health
npm run dev -w @alumex/web         # http://localhost:3000
```

Switch roles with the demo selector in the header. API calls send `X-Demo-Role`.

## Sample import

- PR TSV: `samples/sap-pr-report.tsv` — Purchase requisitions import **or** Integrations → SAP PR → Validate / Reconcile
- PO CSV: `samples/sap-po-extract.csv` — Integrations → SAP PO
- GRN CSV: `samples/sap-grn-extract.csv` — Integrations → SAP GRN

Phase 2 flow: upload/paste → validate/preview (creates immutable preview batch) → reconcile (applies creates/updates per field priority, logs mismatches to exception register).

## Design notes

UI follows the Alumex GUI handoff: light surface, SAP-like blue primary, status badges, left nav, list + detail drawer. Independent modules share the PR → PO → shipment data model.
