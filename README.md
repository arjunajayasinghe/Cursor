# Aetria Process Mapping

Multi-tenant SaaS MVP for an APQC-style process repository.

- **Aetria Solution (AS)** owns the **master** process library (bulk upload, assign/push).
- **Companies** see only **assigned** processes; area editors edit scoped branches.
- **Aetria operators** can switch into any company workspace after push.
- **Export** produces value-stream-grouped Excel files (**stub format** — real client template TBD).

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- SQLite via Prisma (swap `provider` / `DATABASE_URL` for Postgres later)
- Email/password auth with seeded users (signed cookie session; no OAuth)

## Quick start

```bash
npm install
npx prisma migrate dev   # creates SQLite DB + applies schema
npm run seed             # sample master tree, companies, assignments
npm run dev              # http://localhost:3000
```

Environment (`.env`):

```
DATABASE_URL="file:./dev.db"
AUTH_SECRET="dev-secret-change-me-in-production-aetria-mvp"
```

## Seeded logins

Password for all: `password123`

| Email | Role |
|-------|------|
| `operator@aetria.com` | Aetria operator — master library + switch into companies |
| `admin@acme.com` | Acme company admin |
| `editor@acme.com` | Acme area editor — edit only branch `3.3` (sales strategy) |
| `viewer@acme.com` | Acme viewer (read-only) |
| `admin@beta.com` | Beta company admin |

Seed data includes a sample master APQC-style tree, value streams (OTC, PTP, RTR, HTR), Acme assignments (2.0 / 3.0 / 5.0 / 8.4), and Beta assignment (4.0).

## Features in this MVP

1. **AS master view** — browse/search process tree, edit details, bulk CSV/Excel upload
2. **Assign / push** — copy a master node + subtree into a company workspace
3. **Company view** — assigned tree only; hide/rename/describe under role rules
4. **Area scopes** — area editors only edit nodes under their assigned branches
5. **Workspace switcher** — Aetria operators move between master and company workspaces
6. **Export** — download Excel grouped by value stream (**stub columns**)

### Bulk upload columns

CSV or `.xlsx` first sheet. Headers (case-insensitive):

- `code` (required), `name` (required)
- `description`, `parentCode`, `valueStream` (optional; value stream matched by code, e.g. `OTC`)

A sample file is at `samples/master-processes-sample.csv`.

## Stubbed / out of scope

- **Excel export layout** — placeholder columns + `_STUB_README` sheet.  
  **TODO:** replace with the client’s fixed template when provided. Do not treat stub columns as final.
- Integrations (SharePoint, Confluence, ServiceNow, etc.)
- OAuth / SSO
- Deep company restructure rules (open product question)

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build |
| `npm run seed` | Reset + seed demo data |
| `npx prisma studio` | Browse SQLite data |
