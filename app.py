#!/usr/bin/env python3
"""Aetria Process Mapping — Python + Flask + SQLite MVP."""
from __future__ import annotations

import os
from functools import wraps
from pathlib import Path

from flask import (
    Flask,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    send_file,
    session,
    url_for,
)
from werkzeug.security import check_password_hash

from aetria_app.db import get_db, init_db
from aetria_app.services import (
    assign_branch,
    bulk_upsert_master,
    descendant_ids,
    export_stub_xlsx,
    load_nodes,
    parse_upload,
)

ROOT = Path(__file__).resolve().parent

app = Flask(
    __name__,
    template_folder=str(ROOT / "aetria_app" / "templates"),
    static_folder=str(ROOT / "aetria_app" / "static"),
)
app.secret_key = os.environ.get("AUTH_SECRET", "dev-secret-change-me-in-production-aetria-mvp")


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapped


def current_access():
    uid = session.get("user_id")
    if not uid:
        return None
    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
        if not user:
            return None
        company_id = session.get("active_company_id")
        is_op = bool(user["is_aetria_operator"])
        if company_id is None:
            if not is_op:
                return None
            return {
                "user": dict(user),
                "company_id": None,
                "is_master": True,
                "is_op": True,
                "role": None,
                "can_edit": True,
                "can_admin": True,
                "area_scope": None,
                "company_name": None,
            }
        company = conn.execute(
            "SELECT * FROM companies WHERE id = ?", (company_id,)
        ).fetchone()
        if not company:
            return None
        if is_op:
            return {
                "user": dict(user),
                "company_id": company_id,
                "is_master": False,
                "is_op": True,
                "role": "ADMIN",
                "can_edit": True,
                "can_admin": True,
                "area_scope": None,
                "company_name": company["name"],
            }
        m = conn.execute(
            "SELECT * FROM memberships WHERE user_id = ? AND company_id = ?",
            (uid, company_id),
        ).fetchone()
        if not m:
            return None
        scopes = [
            r["process_node_id"]
            for r in conn.execute(
                "SELECT process_node_id FROM area_scopes WHERE membership_id = ?",
                (m["id"],),
            ).fetchall()
        ]
        role = m["role"]
        return {
            "user": dict(user),
            "company_id": company_id,
            "is_master": False,
            "is_op": False,
            "role": role,
            "can_edit": role in ("ADMIN", "AREA_EDITOR"),
            "can_admin": role == "ADMIN",
            "area_scope": scopes if role == "AREA_EDITOR" else None,
            "company_name": company["name"],
        }


def companies_for(user_id: str, is_op: bool):
    with get_db() as conn:
        if is_op:
            return [dict(r) for r in conn.execute("SELECT * FROM companies ORDER BY name")]
        rows = conn.execute(
            """
            SELECT c.* FROM companies c
            JOIN memberships m ON m.company_id = c.id
            WHERE m.user_id = ?
            ORDER BY c.name
            """,
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]


@app.route("/")
def home():
    if session.get("user_id"):
        return redirect(url_for("app_home"))
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = (request.form.get("email") or "").strip().lower()
        password = request.form.get("password") or ""
        with get_db() as conn:
            user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not user or not check_password_hash(user["password_hash"], password):
            flash("Invalid credentials", "error")
            return render_template("login.html", email=email)
        session.clear()
        session["user_id"] = user["id"]
        session["active_company_id"] = None
        if not user["is_aetria_operator"]:
            with get_db() as conn:
                m = conn.execute(
                    "SELECT company_id FROM memberships WHERE user_id = ? ORDER BY rowid LIMIT 1",
                    (user["id"],),
                ).fetchone()
                session["active_company_id"] = m["company_id"] if m else None
        return redirect(url_for("app_home"))
    return render_template("login.html", email="operator@aetria.com")


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/workspace", methods=["POST"])
@login_required
def switch_workspace():
    access = current_access()
    if not access:
        return redirect(url_for("login"))
    raw = request.form.get("company_id", "")
    company_id = None if raw == "" else raw
    if company_id is None:
        if not access["is_op"]:
            flash("Only Aetria operators can open master", "error")
            return redirect(url_for("app_home"))
    else:
        allowed = {c["id"] for c in companies_for(access["user"]["id"], access["is_op"])}
        if company_id not in allowed and not access["is_op"]:
            flash("No access", "error")
            return redirect(url_for("app_home"))
    session["active_company_id"] = company_id
    return redirect(url_for("app_home"))


@app.route("/app")
@login_required
def app_home():
    access = current_access()
    if not access:
        session.clear()
        return redirect(url_for("login"))

    nodes = load_nodes(access["company_id"])
    with get_db() as conn:
        if access["company_id"] is None:
            streams = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM value_streams WHERE company_id IS NULL ORDER BY sort_order"
                )
            ]
            assignments = [
                dict(r)
                for r in conn.execute(
                    """
                    SELECT a.*, n.code AS master_code, n.name AS master_name, c.name AS company_name
                    FROM process_assignments a
                    JOIN process_nodes n ON n.id = a.master_node_id
                    JOIN companies c ON c.id = a.company_id
                    ORDER BY a.assigned_at DESC LIMIT 20
                    """
                )
            ]
        else:
            streams = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM value_streams WHERE company_id = ? ORDER BY sort_order",
                    (access["company_id"],),
                )
            ]
            assignments = []

    companies = companies_for(access["user"]["id"], access["is_op"])
    editable = None
    if access["area_scope"] is not None:
        editable = descendant_ids(access["company_id"], access["area_scope"])

    selected_id = request.args.get("node")
    selected = next((n for n in nodes if n["id"] == selected_id), None)

    return render_template(
        "app.html",
        access=access,
        nodes=nodes,
        streams=streams,
        companies=companies,
        assignments=assignments,
        editable=editable,
        selected=selected,
        q=request.args.get("q", ""),
    )


@app.route("/api/process/<node_id>", methods=["POST"])
@login_required
def update_process(node_id: str):
    access = current_access()
    if not access or not access["can_edit"]:
        return jsonify({"error": "Forbidden"}), 403
    with get_db() as conn:
        node = conn.execute("SELECT * FROM process_nodes WHERE id = ?", (node_id,)).fetchone()
        if not node:
            return jsonify({"error": "Not found"}), 404
        # SQLite NULL comparison
        if (node["company_id"] or None) != (access["company_id"] or None):
            return jsonify({"error": "Wrong workspace"}), 403
        if access["area_scope"] is not None:
            allowed = descendant_ids(access["company_id"], access["area_scope"])
            if node_id not in allowed:
                return jsonify({"error": "Outside your area scope"}), 403

        name = request.form.get("name")
        description = request.form.get("description")
        value_stream_id = request.form.get("value_stream_id")
        is_hidden = request.form.get("is_hidden")

        if name is not None:
            conn.execute("UPDATE process_nodes SET name = ? WHERE id = ?", (name.strip(), node_id))
        if description is not None:
            conn.execute(
                "UPDATE process_nodes SET description = ? WHERE id = ?",
                (description, node_id),
            )
        if value_stream_id is not None and access["can_admin"]:
            vs = value_stream_id or None
            conn.execute(
                "UPDATE process_nodes SET value_stream_id = ? WHERE id = ?", (vs, node_id)
            )
        if is_hidden is not None and access["can_admin"]:
            conn.execute(
                "UPDATE process_nodes SET is_hidden = ? WHERE id = ?",
                (1 if is_hidden in ("1", "true", "on") else 0, node_id),
            )
    flash("Saved", "ok")
    return redirect(url_for("app_home", node=node_id, q=request.args.get("q", "")))


@app.route("/api/assign", methods=["POST"])
@login_required
def assign():
    access = current_access()
    if not access or not access["is_op"] or not access["is_master"]:
        flash("Only Aetria operators can assign from master", "error")
        return redirect(url_for("app_home"))
    company_id = request.form.get("company_id")
    master_node_id = request.form.get("master_node_id")
    try:
        result = assign_branch(company_id, master_node_id, access["user"]["id"])
        flash(f"Assigned — copied {result['copied']} nodes", "ok")
    except Exception as e:
        flash(str(e), "error")
    return redirect(url_for("app_home", node=master_node_id))


@app.route("/api/upload", methods=["POST"])
@login_required
def upload():
    access = current_access()
    if not access or not access["is_master"]:
        flash("Upload only on AS master", "error")
        return redirect(url_for("app_home"))
    f = request.files.get("file")
    if not f or not f.filename:
        flash("File required", "error")
        return redirect(url_for("app_home"))
    try:
        rows = parse_upload(f.filename, f.read())
        result = bulk_upsert_master(rows)
        flash(f"Upload: {result['created']} created, {result['updated']} updated", "ok")
    except Exception as e:
        flash(str(e), "error")
    return redirect(url_for("app_home"))


@app.route("/api/export")
@login_required
def export():
    access = current_access()
    if not access:
        return redirect(url_for("login"))
    company_id = request.args.get("company_id") or access["company_id"]
    if not company_id:
        flash("Export needs a company workspace", "error")
        return redirect(url_for("app_home"))
    if not access["is_op"] and company_id != access["company_id"]:
        flash("Forbidden", "error")
        return redirect(url_for("app_home"))
    with get_db() as conn:
        company = conn.execute(
            "SELECT * FROM companies WHERE id = ?", (company_id,)
        ).fetchone()
    data = export_stub_xlsx(company_id)
    from io import BytesIO

    buf = BytesIO(data)
    buf.seek(0)
    return send_file(
        buf,
        as_attachment=True,
        download_name=f"{company['slug']}-processes-by-value-stream-STUB.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def create_app():
    init_db()
    return app


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", "8765"))
    print(f"Aetria Process Mapping (Python/Flask) → http://localhost:{port}/login")
    app.run(host="0.0.0.0", port=port, debug=True)
