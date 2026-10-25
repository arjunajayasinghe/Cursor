# Aetria Process Mapping — Phase 1 Admin

Admin workbench for APQC process mapping. Python 3, Flask, and SQLite on your machine. Set `DATABASE_URL` to a Postgres URL when you host it.

## Run

```bash
cd /Users/arjuna/Cursor
git fetch origin
git checkout cursor/aetria-phase1-admin-6386
git pull

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python seed.py
python app.py
```

`python app.py` starts the site in the background and opens **http://localhost:8765/login**. You can close the Terminal window. The site stays up.

Stop it with:

```bash
cd /Users/arjuna/Cursor
python app.py --stop
```

Sign in as `admin@aetria.com` / `password123`.

`operator@aetria.com` is the same Admin role. `area@aetria.com`, `admin@acme.com`, and `viewer@acme.com` can sign in, but area filtering is not on yet.

## What Phase 1 includes

- Dashboard with masters, companies, assignments, workshops, critical points, and automation
- Several APQC masters (industry + version). Seed loads **Consumer Products 8.0** (`CP8.0`, about 2,039 elements, L1–L5)
- Companies, including a short name used in file names
- Value streams belong to a company. Each stream chooses its own APQC levels (L1–L5). Hierarchy IDs are added by hand or by upload, not generated
- Assign L1–L5 to a company by value stream. APQC hierarchy and numbers stay
- Excel **download** only
- Workshops: meeting minutes, diagrams, critical points
- Automation points
- Users: Admin can add, edit, and view user IDs

Not in this build: Excel upload back into the company view, swimlanes, SAP, SOPs, and scoped area login.

## Master upload

On a master, upload CSV or Excel. The Consumer Products file is sheet `All Areas Consolidated` (header row contains Hierarchy ID). These columns are stored on the master when the file has them:

- Metrics Available?
- Element Description
- Description or Remark (Admin can also type a remark on each visible process)

They are not the first five columns of the company download.

## Company Excel download

Two sheets:

- **Data** — the same column names as the reference workbook. Filled from the assignment: Level, Hierarchy ID, APQC ID, Process / activity / task, Parent ID. Left empty for the team: Step ID #, Task, Activity Description, Remarks, Actor / Role, Department, Location, Document Name, Document Type, System Used, Transaction Code, Mode, Communication Mode, Cycle Time, Waiting Time, Target Time, Volume, Batch or Real-Time, Decision Point, Decision Criteria, Risk / Issue, Rework, Control Point, KPI Impact, Improvement Opportunity, Automation Potential. Headers through Decision Point are green. Decision Criteria through Automation Potential are yellow.
- **Reference** — the same column names, with a short description and example. The yellow columns are highlighted.

File name: `{CompanyShortName}_{ValueStreamCode}_{Version}.xlsx`  
Example: `ACME_O2C_CP8.0.xlsx`

The value-stream token is the stream code (O2C), and the version token is the master version (CP8.0).

## Hosting

Leave `DATABASE_URL` unset for SQLite (`data/aetria.db`). For Postgres:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/aetria python seed.py
DATABASE_URL=postgresql://user:pass@host:5432/aetria python app.py
```
