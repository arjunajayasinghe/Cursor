# Aetria Process Mapping

Multi-tenant process mapping MVP — **plain HTML + CSS + JS** UI (same style as Restoring the Pride / nayakenz.lk), with a small **Node + Express + Prisma/SQLite** API for auth, tenants, and Excel.

## Why this stack

- Frontend: static HTML/CSS/JS (easy to open and host like Pride)
- Backend: Express + SQLite (needed for logins, companies, assignments, export)

## Quick start

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run seed
npm run dev
```

Open **http://localhost:3000/login.html**

## Seeded logins

Password for all: `password123`

| Email | Role |
|-------|------|
| `operator@aetria.com` | Aetria operator (master + company switch) |
| `admin@acme.com` | Acme admin |
| `editor@acme.com` | Acme area editor (branch `3.3` only) |
| `viewer@acme.com` | Acme viewer |
| `admin@beta.com` | Beta admin |

## Features

1. AS master tree, search, bulk CSV/Excel upload  
2. Assign/push branches to a company  
3. Company workspace (assigned tree only)  
4. Area-scoped editing  
5. Aetria workspace switcher  
6. Value-stream Excel export (**stub** columns — real template TODO)

## Stubbed

- Excel export layout (placeholder only)
- Integrations / OAuth

## Deploy tip

Same idea as Pride: run `npm start` behind Railway/Render/Fly and point a domain at it.
