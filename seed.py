#!/usr/bin/env python3
"""Seed demo data for Aetria Process Mapping."""
from __future__ import annotations

import sys
from pathlib import Path

from werkzeug.security import generate_password_hash

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from aetria_app.db import get_db, reset_db
from aetria_app.services import assign_branch, new_id


def main() -> None:
    reset_db()
    pw = generate_password_hash("password123")

    with get_db() as conn:
        users = {
            "op": ("operator@aetria.com", "Aetria Operator", 1),
            "aa": ("admin@acme.com", "Acme Admin", 0),
            "ae": ("editor@acme.com", "Acme Area Editor", 0),
            "av": ("viewer@acme.com", "Acme Viewer", 0),
            "ba": ("admin@beta.com", "Beta Admin", 0),
        }
        uids: dict[str, str] = {}
        for key, (email, name, is_op) in users.items():
            uid = new_id()
            uids[key] = uid
            conn.execute(
                "INSERT INTO users (id, email, password_hash, name, is_aetria_operator) VALUES (?,?,?,?,?)",
                (uid, email, pw, name, is_op),
            )

        acme = new_id()
        beta = new_id()
        conn.execute(
            "INSERT INTO companies (id, name, slug) VALUES (?,?,?)",
            (acme, "Acme Corp", "acme"),
        )
        conn.execute(
            "INSERT INTO companies (id, name, slug) VALUES (?,?,?)",
            (beta, "Beta Industries", "beta"),
        )

        def membership(user_key: str, company_id: str, role: str) -> str:
            mid = new_id()
            conn.execute(
                "INSERT INTO memberships (id, user_id, company_id, role) VALUES (?,?,?,?)",
                (mid, uids[user_key], company_id, role),
            )
            return mid

        membership("aa", acme, "ADMIN")
        editor_m = membership("ae", acme, "AREA_EDITOR")
        membership("av", acme, "VIEWER")
        membership("ba", beta, "ADMIN")

        vs_order = [
            ("OTC", "Order to Cash", 1),
            ("PTP", "Procure to Pay", 2),
            ("RTR", "Record to Report", 3),
            ("HTR", "Hire to Retire", 4),
        ]
        master_vs: dict[str, str] = {}
        for code, name, so in vs_order:
            vid = new_id()
            master_vs[code] = vid
            conn.execute(
                "INSERT INTO value_streams (id, company_id, code, name, sort_order) VALUES (?,?,?,?,?)",
                (vid, None, code, name, so),
            )
            conn.execute(
                "INSERT INTO value_streams (id, company_id, code, name, sort_order) VALUES (?,?,?,?,?)",
                (new_id(), acme, code, name, so),
            )
        for code, name, so in vs_order[:2]:
            conn.execute(
                "INSERT INTO value_streams (id, company_id, code, name, sort_order) VALUES (?,?,?,?,?)",
                (new_id(), beta, code, name, so),
            )

        # (code, name, desc, vs, children)
        tree = [
            (
                "1.0",
                "Develop Vision and Strategy",
                "Strategic planning and governance",
                None,
                [
                    (
                        "1.1",
                        "Define the business concept and long-term vision",
                        "",
                        None,
                        [
                            ("1.1.1", "Assess the external environment", "", None, []),
                            (
                                "1.1.2",
                                "Survey the market and determine customer needs",
                                "",
                                None,
                                [],
                            ),
                        ],
                    ),
                    (
                        "1.2",
                        "Develop business strategy",
                        "",
                        None,
                        [
                            ("1.2.1", "Develop overall mission statement", "", None, []),
                            ("1.2.2", "Evaluate strategic options", "", None, []),
                        ],
                    ),
                ],
            ),
            (
                "2.0",
                "Develop and Manage Products and Services",
                "",
                "OTC",
                [
                    (
                        "2.1",
                        "Govern and manage product/service development",
                        "",
                        "OTC",
                        [
                            ("2.1.1", "Evaluate performance of products", "", "OTC", []),
                            ("2.1.2", "Generate new product ideas", "", "OTC", []),
                        ],
                    ),
                    ("2.2", "Generate and define new product/service ideas", "", "OTC", []),
                ],
            ),
            (
                "3.0",
                "Market and Sell Products and Services",
                "",
                "OTC",
                [
                    (
                        "3.1",
                        "Understand markets, customers, and capabilities",
                        "",
                        "OTC",
                        [
                            ("3.1.1", "Perform customer and market research", "", "OTC", []),
                            ("3.1.2", "Evaluate customer experience", "", "OTC", []),
                        ],
                    ),
                    ("3.2", "Develop marketing strategy", "", "OTC", []),
                    (
                        "3.3",
                        "Develop sales strategy",
                        "",
                        "OTC",
                        [
                            ("3.3.1", "Develop sales forecasts", "", "OTC", []),
                            (
                                "3.3.2",
                                "Establish sales partner/alliance relationships",
                                "",
                                "OTC",
                                [],
                            ),
                        ],
                    ),
                ],
            ),
            (
                "4.0",
                "Deliver Products and Services",
                "",
                "PTP",
                [
                    (
                        "4.1",
                        "Plan for and acquire necessary resources",
                        "",
                        "PTP",
                        [
                            ("4.1.1", "Manage product inventory", "", "PTP", []),
                            ("4.1.2", "Procure materials and services", "", "PTP", []),
                        ],
                    ),
                    ("4.2", "Produce/manufacture/deliver product", "", "PTP", []),
                ],
            ),
            (
                "5.0",
                "Manage Customer Service",
                "",
                "OTC",
                [
                    ("5.1", "Develop customer care/service strategy", "", "OTC", []),
                    ("5.2", "Plan and manage customer service operations", "", "OTC", []),
                ],
            ),
            (
                "6.0",
                "Develop and Manage Human Capital",
                "",
                "HTR",
                [
                    (
                        "6.1",
                        "Develop and manage HR planning and policies",
                        "",
                        "HTR",
                        [
                            ("6.1.1", "Develop HR strategy", "", "HTR", []),
                            ("6.1.2", "Develop and implement HR programs", "", "HTR", []),
                        ],
                    ),
                    ("6.2", "Recruit, source, and select employees", "", "HTR", []),
                ],
            ),
            (
                "8.0",
                "Manage Financial Resources",
                "",
                "RTR",
                [
                    (
                        "8.1",
                        "Perform planning and management accounting",
                        "",
                        "RTR",
                        [
                            ("8.1.1", "Perform budgeting/forecasting", "", "RTR", []),
                            ("8.1.2", "Perform cost accounting", "", "RTR", []),
                        ],
                    ),
                    (
                        "8.2",
                        "Process accounts payable and expense reimbursements",
                        "",
                        "PTP",
                        [],
                    ),
                    ("8.3", "Process payroll", "", "HTR", []),
                    ("8.4", "Process accounts receivable", "", "OTC", []),
                ],
            ),
        ]

        code_to_id: dict[str, str] = {}

        def insert(nodes, parent_id, level):
            for i, item in enumerate(nodes):
                code, name, desc, vs, kids = item
                nid = new_id()
                code_to_id[code] = nid
                conn.execute(
                    """
                    INSERT INTO process_nodes
                    (id, company_id, parent_id, code, name, description, level, sort_order, value_stream_id, is_hidden)
                    VALUES (?,?,?,?,?,?,?,?,?,0)
                    """,
                    (
                        nid,
                        None,
                        parent_id,
                        code,
                        name,
                        desc,
                        level,
                        i,
                        master_vs.get(vs) if vs else None,
                    ),
                )
                if kids:
                    insert(kids, nid, level + 1)

        insert(tree, None, 1)

    for code in ["2.0", "3.0", "5.0", "8.4"]:
        assign_branch(acme, code_to_id[code], uids["op"])
    assign_branch(beta, code_to_id["4.0"], uids["op"])

    with get_db() as conn:
        sales = conn.execute(
            "SELECT id FROM process_nodes WHERE company_id = ? AND code = '3.3'",
            (acme,),
        ).fetchone()
        if sales:
            conn.execute(
                "INSERT INTO area_scopes (id, membership_id, process_node_id) VALUES (?,?,?)",
                (new_id(), editor_m, sales["id"]),
            )

    print("Seed complete.")
    print("Password for all: password123")
    print("  operator@aetria.com")
    print("  admin@acme.com")
    print("  editor@acme.com  (branch 3.3 only)")
    print("  viewer@acme.com")
    print("  admin@beta.com")


if __name__ == "__main__":
    main()
