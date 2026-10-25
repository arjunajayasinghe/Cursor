#!/usr/bin/env python3
"""Seed the Phase 1 Admin workbench with Consumer Products 8.0."""
from __future__ import annotations

import sys
from pathlib import Path

from werkzeug.security import generate_password_hash

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from aetria_app.db import get_db, reset_db
from aetria_app.services import (
    UPLOAD_ROOT,
    expand_codes,
    fetchall,
    import_master_file,
    new_id,
    save_assignment,
    utcnow,
)

MASTER_FILES = [
    ROOT / "samples" / "CBL_APQC_Consumer_Products_8_One_Consolidated_Sheet.xlsx",
    Path("/cursor/stores/self/docs/templates/CBL_APQC_Consumer_Products_8_One_Consolidated_Sheet.xlsx"),
]


def main() -> None:
    reset_db()
    password = generate_password_hash("password123")
    now = utcnow()
    master_path = next((path for path in MASTER_FILES if path.exists()), None)
    if master_path is None:
        raise SystemExit("Consumer Products workbook not found. Put it in samples/.")

    with get_db() as conn:
        users = [
            ("admin@aetria.com", "Aetria Admin", "ADMIN"),
            ("operator@aetria.com", "Aetria Operator", "ADMIN"),
            ("area@aetria.com", "Area Lead", "AETRIA_AREA"),
            ("admin@acme.com", "Acme Admin", "COMPANY_ADMIN"),
            ("viewer@acme.com", "Acme Viewer", "VIEWER"),
        ]
        for email, name, role in users:
            conn.execute(
                """
                INSERT INTO users (id, email, password_hash, name, role, is_active, created_at)
                VALUES (?,?,?,?,?,1,?)
                """,
                (new_id(), email, password, name, role, now),
            )
        acme = new_id()
        beta = new_id()
        conn.execute(
            """
            INSERT INTO companies
            (id, name, short_name, industry, contact_name, contact_email, notes, created_at)
            VALUES (?,?,?,?,?,?,?,?)
            """,
            (acme, "Acme Corp", "ACME", "Consumer Products", "Acme Admin", "admin@acme.com", "Sample company", now),
        )
        conn.execute(
            """
            INSERT INTO companies
            (id, name, short_name, industry, contact_name, contact_email, notes, created_at)
            VALUES (?,?,?,?,?,?,?,?)
            """,
            (beta, "Beta Industries", "BETA", "Consumer Products", "Beta Admin", "admin@beta.com", "", now),
        )
        streams = [
            ("O2C", "Order to Cash", "CP 8.0: sales plans (3.5) and revenue accounting (9.2).", ["3.5", "9.2"], 1),
            ("P2P", "Procure to Pay", "CP 8.0: procure materials (4.2) and accounts payable (9.6).", ["4.2", "9.6"], 2),
            ("R2R", "Record to Report", "CP 8.0: general accounting and reporting (9.3).", ["9.3"], 3),
            ("H2R", "Hire to Retire", "CP 8.0: recruit (7.2) through redeploy and retire (7.6).", ["7.2", "7.6"], 4),
            ("I2P", "Idea to Product", "CP 8.0: ideas (2.2) and develop products (2.3).", ["2.2", "2.3"], 5),
        ]
        stream_ids = {}
        for code, name, desc, codes, sort_order in streams:
            sid = new_id()
            stream_ids[code] = sid
            conn.execute(
                "INSERT INTO value_streams (id, code, name, description, sort_order) VALUES (?,?,?,?,?)",
                (sid, code, name, desc, sort_order),
            )
            for process_code in codes:
                conn.execute(
                    """
                    INSERT INTO value_stream_suggestions (id, value_stream_id, process_code, note)
                    VALUES (?,?,?,?)
                    """,
                    (new_id(), sid, process_code, desc),
                )
        master_id = new_id()
        conn.execute(
            """
            INSERT INTO apqc_masters (id, industry, version, name, notes, created_at)
            VALUES (?,?,?,?,?,?)
            """,
            (
                master_id,
                "Consumer Products",
                "CP8.0",
                "APQC Consumer Products 8.0",
                "Imported from the consolidated L1–L5 sheet. 13 areas.",
                now,
            ),
        )

    result = import_master_file(master_id, master_path.name, master_path.read_bytes())
    with get_db() as conn:
        conn.execute(
            """
            UPDATE process_nodes
            SET description = ?
            WHERE master_id = ? AND code = '9.2.1'
            """,
            ("Confirm the credit policy with finance before go-live.", master_id),
        )

    for company_id, code in ((acme, "O2C"), (acme, "P2P"), (beta, "R2R")):
        codes = [row["process_code"] for row in fetchall(
            "SELECT process_code FROM value_stream_suggestions WHERE value_stream_id = ?",
            (stream_ids[code],),
        )]
        node_ids, missing = expand_codes(master_id, codes)
        if missing:
            raise SystemExit(f"Missing suggestion codes for {code}: {missing}")
        save_assignment(company_id, master_id, stream_ids[code], node_ids)

    o2c_node = None
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM process_nodes WHERE master_id = ? AND code = '9.2.1'",
            (master_id,),
        ).fetchone()
        o2c_node = row["id"] if row else None
        procure = conn.execute(
            "SELECT id FROM process_nodes WHERE master_id = ? AND code = '4.2.3'",
            (master_id,),
        ).fetchone()
        workshop_id = new_id()
        conn.execute(
            """
            INSERT INTO workshops
            (id, company_id, value_stream_id, title, held_on, summary, created_at)
            VALUES (?,?,?,?,?,?,?)
            """,
            (
                workshop_id,
                acme,
                stream_ids["O2C"],
                "O2C discovery",
                "2026-10-18",
                "Walked sales plans and customer credit. Credit check stays a critical point.",
                now,
            ),
        )
        UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
        minutes_name = new_id() + ".txt"
        (UPLOAD_ROOT / minutes_name).write_text(
            "O2C discovery minutes\n\nAgreed to keep APQC 3.5 and 9.2.\nCredit check (9.2.1) must stay visible.\n",
            encoding="utf-8",
        )
        diagram_name = new_id() + ".svg"
        (UPLOAD_ROOT / diagram_name).write_text(
            "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='120'>"
            "<rect x='10' y='30' width='180' height='60' fill='#e7f3f1' stroke='#0f6e6b'/>"
            "<text x='24' y='66' font-family='sans-serif' font-size='14'>3.5 Sales plans</text>"
            "<rect x='230' y='30' width='180' height='60' fill='#e7f3f1' stroke='#0f6e6b'/>"
            "<text x='244' y='66' font-family='sans-serif' font-size='14'>9.2 Revenue</text>"
            "</svg>",
            encoding="utf-8",
        )
        conn.execute(
            """
            INSERT INTO workshop_files
            (id, workshop_id, kind, original_name, stored_name, uploaded_at)
            VALUES (?,?,?,?,?,?)
            """,
            (new_id(), workshop_id, "minutes", "o2c-minutes.txt", minutes_name, now),
        )
        conn.execute(
            """
            INSERT INTO workshop_files
            (id, workshop_id, kind, original_name, stored_name, uploaded_at)
            VALUES (?,?,?,?,?,?)
            """,
            (new_id(), workshop_id, "diagram", "o2c-flow.svg", diagram_name, now),
        )
        conn.execute(
            """
            INSERT INTO critical_points
            (id, company_id, workshop_id, value_stream_id, process_node_id, title, detail, owner, status, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)
            """,
            (
                new_id(),
                acme,
                workshop_id,
                stream_ids["O2C"],
                o2c_node,
                "Credit check before invoicing",
                "9.2.1 must stay in the company map. Do not drop it when trimming O2C.",
                "Finance lead",
                "maintain",
                now,
            ),
        )
        conn.execute(
            """
            INSERT INTO automation_points
            (id, company_id, value_stream_id, process_node_id, title, detail, manual_vs_system, tool, priority, status, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                new_id(),
                acme,
                stream_ids["P2P"],
                procure["id"] if procure else None,
                "Supplier contract match",
                "Match PO, receipt, and invoice before payment.",
                "mixed",
                "SAP",
                "high",
                "candidate",
                now,
            ),
        )

    print(f"Imported {result['created']} processes from {master_path.name}")
    print("Password for all: password123")
    print("  admin@aetria.com  (Admin)")
    print("  operator@aetria.com")
    print("  area@aetria.com")
    print("  admin@acme.com")
    print("  viewer@acme.com")


if __name__ == "__main__":
    main()
