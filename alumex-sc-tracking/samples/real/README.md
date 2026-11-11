# Real Alumex source files

| File | Role |
| --- | --- |
| `smart-sheet-may-2026.xls` | Filled operational spine (May 2026) — PR→PO→ship→GRN |
| `pr-created-po-pending.xlsx` | SAP PR backlog (Report sheet) |
| `po-delivery-pending.xlsx` | SAP PO delivery-pending backlog (Report sheet) |

## How we build with this data

1. **May Smart Sheet** is the case file (upsert PR / PO / shipment by PR+line / PO+line).
2. **SAP reports** enrich delta status (pending PO / delivery pending) without wiping May ops fields.
3. Import writes into Nest/Postgres; published sample mode uses generated fixtures under `apps/web/src/lib/fixtures/`.

```bash
# from apps/api (DATABASE_URL from packages/db/.env)
npx tsx scripts/import-real-data.ts
# fixtures only (also refreshes May spine in DB):
npx tsx scripts/import-real-data.ts --fixtures-only
```
