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
| Vessel tracking | `/vessel` | `/vessel` |
| Customs clearance | `/customs` | `/customs` |
| Delivery & landed cost | `/delivery` | `/delivery` |
| GRN & closure | `/grn` | `/grn` |
| Reports (pipeline / action / cost / closure + CSV) | `/reports` | `GET /reports?type=` |
| Role administration | `/admin` | `/permissions/*` |

Each operational module uses the shared list + detail drawer pattern with source tags. Demo records are seeded from the GUI handoff `schema.js` cases.

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

Use `samples/sap-pr-report.tsv` on **Purchase requisitions → Import SAP PR file**.

## Design notes

UI follows the Alumex GUI handoff: light surface, SAP-like blue primary, status badges, left nav, list + detail drawer. Independent modules share the PR → PO → shipment data model.
