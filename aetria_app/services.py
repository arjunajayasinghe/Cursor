"""Domain operations: tree, assign, upload, export."""
from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Any

from openpyxl import Workbook, load_workbook

from .db import get_db


def new_id() -> str:
    return uuid.uuid4().hex


def load_nodes(company_id: str | None) -> list[dict[str, Any]]:
    with get_db() as conn:
        if company_id is None:
            rows = conn.execute(
                "SELECT * FROM process_nodes WHERE company_id IS NULL ORDER BY sort_order, code"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM process_nodes WHERE company_id = ? ORDER BY sort_order, code",
                (company_id,),
            ).fetchall()
    return [dict(r) for r in rows]


def descendant_ids(company_id: str | None, root_ids: list[str]) -> set[str]:
    nodes = load_nodes(company_id)
    children: dict[str, list[str]] = {}
    for n in nodes:
        if n["parent_id"]:
            children.setdefault(n["parent_id"], []).append(n["id"])
    out: set[str] = set()
    stack = list(root_ids)
    while stack:
        i = stack.pop()
        if i in out:
            continue
        out.add(i)
        stack.extend(children.get(i, []))
    return out


def assign_branch(company_id: str, master_node_id: str, assigned_by_id: str | None = None) -> dict:
    with get_db() as conn:
        master = conn.execute(
            "SELECT * FROM process_nodes WHERE id = ? AND company_id IS NULL",
            (master_node_id,),
        ).fetchone()
        if not master:
            raise ValueError("Master node not found")

        all_master = [
            dict(r)
            for r in conn.execute(
                "SELECT * FROM process_nodes WHERE company_id IS NULL"
            ).fetchall()
        ]
        by_id = {n["id"]: n for n in all_master}
        subtree_ids = descendant_ids(None, [master_node_id])
        subtree = sorted(
            [by_id[i] for i in subtree_ids if i in by_id],
            key=lambda n: (n["level"], n["sort_order"], n["code"]),
        )

        existing = conn.execute(
            "SELECT * FROM process_nodes WHERE company_id = ? AND master_node_id IS NOT NULL",
            (company_id,),
        ).fetchall()
        copy_by_master = {r["master_node_id"]: r["id"] for r in existing}

        # Remap value streams by code
        master_vs = {
            r["id"]: dict(r)
            for r in conn.execute(
                "SELECT * FROM value_streams WHERE company_id IS NULL"
            ).fetchall()
        }
        company_vs = {
            r["code"]: r["id"]
            for r in conn.execute(
                "SELECT * FROM value_streams WHERE company_id = ?", (company_id,)
            ).fetchall()
        }

        def resolve_vs(master_vs_id: str | None) -> str | None:
            if not master_vs_id or master_vs_id not in master_vs:
                return None
            m = master_vs[master_vs_id]
            if m["code"] in company_vs:
                return company_vs[m["code"]]
            vid = new_id()
            conn.execute(
                "INSERT INTO value_streams (id, company_id, code, name, sort_order) VALUES (?,?,?,?,?)",
                (vid, company_id, m["code"], m["name"], m["sort_order"]),
            )
            company_vs[m["code"]] = vid
            return vid

        now = datetime.now(timezone.utc).isoformat()
        aid = new_id()
        conn.execute(
            """
            INSERT INTO process_assignments (id, company_id, master_node_id, assigned_by_id, assigned_at)
            VALUES (?,?,?,?,?)
            ON CONFLICT(company_id, master_node_id) DO UPDATE SET
              assigned_at=excluded.assigned_at,
              assigned_by_id=excluded.assigned_by_id
            """,
            (aid, company_id, master_node_id, assigned_by_id, now),
        )

        copied = 0
        for m in subtree:
            if m["id"] in copy_by_master:
                continue
            parent_company = None
            if m["parent_id"] and m["parent_id"] in copy_by_master:
                parent_company = copy_by_master[m["parent_id"]]
            nid = new_id()
            conn.execute(
                """
                INSERT INTO process_nodes
                (id, company_id, parent_id, code, name, description, level, sort_order,
                 master_node_id, value_stream_id, is_hidden)
                VALUES (?,?,?,?,?,?,?,?,?,?,0)
                """,
                (
                    nid,
                    company_id,
                    parent_company,
                    m["code"],
                    m["name"],
                    m["description"],
                    m["level"],
                    m["sort_order"],
                    m["id"],
                    resolve_vs(m["value_stream_id"]),
                ),
            )
            copy_by_master[m["id"]] = nid
            copied += 1

    return {"copied": copied, "companyId": company_id, "masterNodeId": master_node_id}


def bulk_upsert_master(rows: list[dict[str, str]]) -> dict[str, int]:
    created = updated = 0
    sorted_rows = sorted(
        rows,
        key=lambda r: (len(r["code"].split(".")), r["code"]),
    )
    with get_db() as conn:
        vs_by_code = {
            r["code"].lower(): r["id"]
            for r in conn.execute(
                "SELECT * FROM value_streams WHERE company_id IS NULL"
            ).fetchall()
        }
        for row in sorted_rows:
            code = row["code"].strip()
            name = row["name"].strip()
            if not code or not name:
                continue
            parent_code = (row.get("parentCode") or "").strip()
            if not parent_code and "." in code:
                parent_code = ".".join(code.split(".")[:-1])
            parent_id = None
            if parent_code:
                p = conn.execute(
                    "SELECT id FROM process_nodes WHERE company_id IS NULL AND code = ?",
                    (parent_code,),
                ).fetchone()
                parent_id = p["id"] if p else None
            level = len(code.split("."))
            vs_code = (row.get("valueStreamCode") or "").strip().lower()
            vs_id = vs_by_code.get(vs_code) if vs_code else None
            existing = conn.execute(
                "SELECT id, description FROM process_nodes WHERE company_id IS NULL AND code = ?",
                (code,),
            ).fetchone()
            if existing:
                conn.execute(
                    """
                    UPDATE process_nodes
                    SET name=?, description=?, parent_id=?, level=?,
                        value_stream_id=COALESCE(?, value_stream_id)
                    WHERE id=?
                    """,
                    (
                        name,
                        row.get("description") or existing["description"],
                        parent_id,
                        level,
                        vs_id,
                        existing["id"],
                    ),
                )
                updated += 1
            else:
                siblings = conn.execute(
                    "SELECT COUNT(*) AS c FROM process_nodes WHERE company_id IS NULL AND parent_id IS ?",
                    (parent_id,),
                ).fetchone()["c"]
                conn.execute(
                    """
                    INSERT INTO process_nodes
                    (id, company_id, parent_id, code, name, description, level, sort_order, value_stream_id, is_hidden)
                    VALUES (?,?,?,?,?,?,?,?,?,0)
                    """,
                    (
                        new_id(),
                        None,
                        parent_id,
                        code,
                        name,
                        row.get("description") or "",
                        level,
                        siblings,
                        vs_id,
                    ),
                )
                created += 1
    return {"created": created, "updated": updated, "total": len(sorted_rows)}


def parse_upload(filename: str, data: bytes) -> list[dict[str, str]]:
    name = filename.lower()
    rows: list[dict[str, str]] = []
    if name.endswith((".csv", ".txt")):
        text = data.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        for raw in reader:
            norm = {
                (k or "").strip().lower().replace(" ", "").replace("_", "").replace("-", ""): (
                    v or ""
                ).strip()
                for k, v in raw.items()
            }
            code = norm.get("code") or norm.get("processcode") or ""
            pname = norm.get("name") or norm.get("processname") or ""
            if not code or not pname:
                continue
            rows.append(
                {
                    "code": code,
                    "name": pname,
                    "description": norm.get("description") or "",
                    "parentCode": norm.get("parentcode") or norm.get("parent") or "",
                    "valueStreamCode": norm.get("valuestream")
                    or norm.get("valuestreamcode")
                    or norm.get("vs")
                    or "",
                }
            )
    elif name.endswith((".xlsx", ".xls")):
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        ws = wb.active
        headers: list[str] = []
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i == 0:
                headers = [str(c or "").strip() for c in row]
                continue
            raw = {
                headers[j]: str(row[j] or "").strip()
                for j in range(len(headers))
                if j < len(row)
            }
            norm = {
                k.lower().replace(" ", "").replace("_", "").replace("-", ""): v
                for k, v in raw.items()
            }
            code = norm.get("code") or ""
            pname = norm.get("name") or ""
            if not code or not pname:
                continue
            rows.append(
                {
                    "code": code,
                    "name": pname,
                    "description": norm.get("description") or "",
                    "parentCode": norm.get("parentcode") or "",
                    "valueStreamCode": norm.get("valuestream") or norm.get("vs") or "",
                }
            )
    else:
        raise ValueError("Use .csv or .xlsx")
    return rows


def export_stub_xlsx(company_id: str) -> bytes:
    """STUB Excel — placeholder columns. TODO: real client template."""
    with get_db() as conn:
        company = conn.execute(
            "SELECT * FROM companies WHERE id = ?", (company_id,)
        ).fetchone()
        if not company:
            raise ValueError("Company not found")
        nodes = [
            dict(r)
            for r in conn.execute(
                "SELECT * FROM process_nodes WHERE company_id = ? ORDER BY code",
                (company_id,),
            ).fetchall()
        ]
        streams = [
            dict(r)
            for r in conn.execute(
                "SELECT * FROM value_streams WHERE company_id = ? ORDER BY sort_order",
                (company_id,),
            ).fetchall()
        ]

    by_id = {n["id"]: n for n in nodes}
    vs_by_id = {v["id"]: v for v in streams}
    groups: dict[str, list[dict]] = {}
    for n in nodes:
        key = n["value_stream_id"] or "__unassigned__"
        groups.setdefault(key, []).append(n)

    wb = Workbook()
    readme = wb.active
    readme.title = "_STUB_README"
    readme["A1"] = "TODO: Replace with the client's fixed Excel template."
    readme["A2"] = "Placeholder export grouped by value stream. NOT final."
    readme["A3"] = f"Company: {company['name']} ({company['slug']})"
    readme["A4"] = f"Process count: {len(nodes)}"

    ordered = [v["id"] for v in streams] + ["__unassigned__"]
    seen: set[str] = set()
    for key in ordered:
        if key in seen or key not in groups:
            continue
        seen.add(key)
        vs = None if key == "__unassigned__" else vs_by_id.get(key)
        title = f"{vs['code']} - {vs['name']}" if vs else "Unassigned"
        title = title.replace("/", "-")[:31]
        ws = wb.create_sheet(title)
        ws.append(["STUB EXPORT — not the final client template"])
        ws.append(
            [
                "Process Code",
                "Process Name",
                "Level",
                "Description",
                "Value Stream",
                "Parent Code",
                "Hidden",
            ]
        )
        for n in groups[key]:
            parent = by_id.get(n["parent_id"] or "")
            ws.append(
                [
                    n["code"],
                    n["name"],
                    n["level"],
                    n["description"],
                    vs["name"] if vs else "",
                    parent["code"] if parent else "",
                    "Y" if n["is_hidden"] else "N",
                ]
            )

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
