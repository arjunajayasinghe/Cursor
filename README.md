# Aetria Process Mapping (Python)

Multi-tenant APQC-style process mapping MVP.

**Stack:** Python 3 + Flask + SQLite + plain HTML/CSS (no Node.js, no Next.js).

## Run on your Mac

You already have Conda/`python` — no npm needed.

```bash
cd ~/Desktop/Cursor
git fetch origin
git checkout cursor/aetria-python-mvp-6386
git pull

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python seed.py
python app.py
```

Open: **http://localhost:8765/login**

Login: `operator@aetria.com` / `password123`

## Seeded users

Password for all: `password123`

| Email | Role |
|-------|------|
| operator@aetria.com | Aetria operator |
| admin@acme.com | Acme admin |
| editor@acme.com | Area editor (branch 3.3) |
| viewer@acme.com | Viewer |
| admin@beta.com | Beta admin |

## Features

- AS master tree, search, bulk CSV/Excel upload  
- Assign/push to companies  
- Company workspace + area scopes  
- Stub value-stream Excel export  

## Stubbed

Excel layout is a placeholder until the client template is provided.
