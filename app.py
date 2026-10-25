#!/usr/bin/env python3
"""Aetria Process Mapping — Phase 1 Admin workbench."""
from __future__ import annotations

import os
import re
import signal
import socket
import subprocess
import sys
import time
from functools import wraps
from io import BytesIO
from pathlib import Path

from flask import (
    Flask,
    abort,
    flash,
    g,
    redirect,
    render_template,
    request,
    send_file,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from aetria_app.db import get_db, init_db
from aetria_app.services import (
    EXCEL_HEADERS,
    ROLE_LABELS,
    ROLES,
    UPLOAD_ROOT,
    assigned_ids,
    build_workbook,
    dashboard_stats,
    distribution_rows,
    expand_codes,
    fetchall,
    fetchone,
    levels_of,
    load_nodes,
    normalize_levels,
    new_id,
    parse_suggestion_upload,
    import_master_file,
    save_assignment,
    suggestion_codes,
    utcnow,
)

ROOT = Path(__file__).resolve().parent
MINUTES_EXT = {".pdf", ".doc", ".docx", ".txt", ".md", ".csv"}
DIAGRAM_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".pdf"}

NAV = [
    ("dashboard", "Dashboard"),
    ("masters", "APQC masters"),
    ("companies", "Companies"),
    ("value_streams", "Value streams"),
    ("assign", "Assign"),
    ("distribute", "Excel download"),
    ("workshops", "Workshops"),
    ("critical_points", "Critical points"),
    ("automation", "Automation"),
    ("users", "Users"),
    ("roadmap", "Later"),
]

app = Flask(
    __name__,
    template_folder=str(ROOT / "aetria_app" / "templates"),
    static_folder=str(ROOT / "aetria_app" / "static"),
)
app.secret_key = os.environ.get("AUTH_SECRET", "dev-secret-change-me-in-production-aetria-mvp")
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024
app.config["TEMPLATES_AUTO_RELOAD"] = True
BUILD_LABEL = "L1–L5"


def current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    if getattr(g, "_user_loaded", False):
        return g.user
    g.user = fetchone("SELECT * FROM users WHERE id = ?", (uid,))
    g._user_loaded = True
    return g.user


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not current_user():
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapped


def admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        me = current_user()
        if not me:
            return redirect(url_for("login"))
        if me["role"] != "ADMIN" or not me["is_active"]:
            return redirect(url_for("limited"))
        return view(*args, **kwargs)

    return wrapped


NAV_ALIAS = {
    "company_form": "companies",
    "company_delete": "companies",
    "master_detail": "masters",
    "master_delete": "masters",
    "workshop_detail": "workshops",
    "user_new": "users",
    "user_create": "users",
    "user_view": "users",
    "user_edit": "users",
    "user_update": "users",
    "distribute_download": "distribute",
    "value_stream_upload": "value_streams",
    "value_stream_delete": "value_streams",
    "suggestion_delete": "value_streams",
}


@app.context_processor
def inject_nav():
    me = current_user()
    endpoint = NAV_ALIAS.get(request.endpoint, request.endpoint)
    return {
        "me": me,
        "nav": [(url_for(name), label, name) for name, label in NAV],
        "active": endpoint,
        "role_labels": ROLE_LABELS,
        "build_label": BUILD_LABEL,
    }


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = (request.form.get("email") or "").strip().lower()
        password = request.form.get("password") or ""
        user = fetchone("SELECT * FROM users WHERE email = ?", (email,))
        if not user or not check_password_hash(user["password_hash"], password):
            flash("Invalid credentials", "error")
            return render_template("login.html", email=email)
        if not user["is_active"]:
            flash("This user is inactive. Ask an Admin to turn it back on.", "error")
            return render_template("login.html", email=email)
        session.clear()
        session["user_id"] = user["id"]
        if user["role"] == "ADMIN":
            return redirect(url_for("dashboard"))
        return redirect(url_for("limited"))
    if current_user():
        return redirect(url_for("dashboard"))
    return render_template("login.html", email="admin@aetria.com")


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/limited")
@login_required
def limited():
    return render_template("limited.html")


@app.route("/")
@admin_required
def dashboard():
    stats = dashboard_stats()
    companies = fetchall(
        """
        SELECT c.*,
          (SELECT COUNT(*) FROM value_streams v WHERE v.company_id = c.id) AS streams,
          (SELECT COUNT(*) FROM assignments a WHERE a.company_id = c.id) AS processes
        FROM companies c
        ORDER BY c.name
        """
    )
    attention = fetchall(
        """
        SELECT 'Critical point' AS kind, title, status, id FROM critical_points
        WHERE status != 'closed'
        UNION ALL
        SELECT 'Automation' AS kind, title, status, id FROM automation_points
        WHERE status = 'candidate'
        ORDER BY kind, title
        LIMIT 8
        """
    )
    return render_template(
        "dashboard.html",
        stats=stats,
        companies=companies,
        attention=attention,
    )


@app.route("/masters", methods=["GET", "POST"])
@admin_required
def masters():
    if request.method == "POST":
        industry = (request.form.get("industry") or "").strip()
        version = (request.form.get("version") or "").strip()
        name = (request.form.get("name") or "").strip()
        notes = (request.form.get("notes") or "").strip()
        if not industry or not version or not name:
            flash("Industry, version, and name are required", "error")
        else:
            try:
                with get_db() as conn:
                    conn.execute(
                        """
                        INSERT INTO apqc_masters (id, industry, version, name, notes, created_at)
                        VALUES (?,?,?,?,?,?)
                        """,
                        (new_id(), industry, version, name, notes, utcnow()),
                    )
                flash("Master created. Upload the L1–L5 file next.", "ok")
            except Exception:
                flash("That industry and version already exists", "error")
        return redirect(url_for("masters"))
    rows = fetchall(
        """
        SELECT m.*,
          (SELECT COUNT(*) FROM process_nodes n WHERE n.master_id = m.id) AS processes
        FROM apqc_masters m
        ORDER BY m.industry, m.version
        """
    )
    return render_template("masters.html", masters=rows)


@app.route("/masters/<master_id>", methods=["GET", "POST"])
@admin_required
def master_detail(master_id: str):
    master = fetchone("SELECT * FROM apqc_masters WHERE id = ?", (master_id,))
    if not master:
        abort(404)
    if request.method == "POST" and request.form.get("action") == "remark":
        node_id = request.form.get("node_id") or ""
        remark = request.form.get("description") or ""
        with get_db() as conn:
            conn.execute(
                "UPDATE process_nodes SET description = ? WHERE id = ? AND master_id = ?",
                (remark.strip(), node_id, master_id),
            )
        flash("Remark saved on the master", "ok")
        return redirect(request.referrer or url_for("master_detail", master_id=master_id))
    if request.method == "POST":
        upload = request.files.get("file")
        if not upload or not upload.filename:
            flash("Choose a CSV or Excel file", "error")
        else:
            try:
                result = import_master_file(master_id, upload.filename, upload.read())
                flash(
                    f"Master upload saved: {result['created']} created, {result['updated']} updated. Metrics Available?, Element Description, and Remark are kept when the file has them.",
                    "ok",
                )
            except Exception as exc:
                flash(str(exc), "error")
        return redirect(url_for("master_detail", master_id=master_id))
    nodes = load_nodes(master_id)
    areas = _areas(nodes)
    q = (request.args.get("q") or "").strip()
    area = request.args.get("area") or ""
    level = request.args.get("level") or ""
    if level not in {"1", "2", "3", "4", "5"}:
        level = ""
    matched = _filter_nodes(nodes, area=area, q=q, max_level=int(level) if level else None)
    if level:
        matched = [node for node in matched if int(node["level"]) == int(level)]
    if level or q:
        shown = _with_ancestors(nodes, [node["id"] for node in matched])
    elif area:
        shown = matched
    else:
        shown = nodes
    parents = {node.get("parent_id") for node in nodes if node.get("parent_id")}
    for node in shown:
        node["has_children"] = node["id"] in parents
    level_counts = _level_counts(nodes)
    return render_template(
        "master_detail.html",
        master=master,
        nodes=shown,
        total=len(nodes),
        shown_count=len(shown),
        areas=areas,
        q=q,
        area=area,
        level=level,
        level_counts=level_counts,
        collapse=not (q or level),
    )


@app.route("/masters/<master_id>/delete", methods=["POST"])
@admin_required
def master_delete(master_id: str):
    with get_db() as conn:
        conn.execute("DELETE FROM apqc_masters WHERE id = ?", (master_id,))
    flash("Master removed", "ok")
    return redirect(url_for("masters"))


@app.route("/companies", methods=["GET"])
@admin_required
def companies():
    rows = fetchall(
        """
        SELECT c.*,
          (SELECT COUNT(*) FROM value_streams v WHERE v.company_id = c.id) AS streams,
          (SELECT COUNT(*) FROM assignments a WHERE a.company_id = c.id) AS processes
        FROM companies c
        ORDER BY c.name
        """
    )
    return render_template("companies.html", companies=rows)


@app.route("/companies/new", methods=["GET", "POST"])
@app.route("/companies/<company_id>", methods=["GET", "POST"])
@admin_required
def company_form(company_id: str | None = None):
    company = None
    if company_id:
        company = fetchone("SELECT * FROM companies WHERE id = ?", (company_id,))
        if not company:
            abort(404)
    if request.method == "POST":
        name = (request.form.get("name") or "").strip()
        short_name = re.sub(r"[^A-Za-z0-9]", "", (request.form.get("short_name") or "")).upper()
        industry = (request.form.get("industry") or "").strip()
        contact_name = (request.form.get("contact_name") or "").strip()
        contact_email = (request.form.get("contact_email") or "").strip()
        notes = (request.form.get("notes") or "").strip()
        if not name or len(short_name) < 2:
            flash("Company name and a short name (letters/numbers, used in the Excel file name) are required", "error")
            return render_template("company_form.html", company=company, form=request.form)
        try:
            with get_db() as conn:
                if company:
                    conn.execute(
                        """
                        UPDATE companies
                        SET name=?, short_name=?, industry=?, contact_name=?, contact_email=?, notes=?
                        WHERE id=?
                        """,
                        (name, short_name, industry, contact_name, contact_email, notes, company["id"]),
                    )
                else:
                    conn.execute(
                        """
                        INSERT INTO companies
                        (id, name, short_name, industry, contact_name, contact_email, notes, created_at)
                        VALUES (?,?,?,?,?,?,?,?)
                        """,
                        (new_id(), name, short_name, industry, contact_name, contact_email, notes, utcnow()),
                    )
            flash("Company saved", "ok")
            return redirect(url_for("companies"))
        except Exception:
            flash("That short name is already used", "error")
    return render_template("company_form.html", company=company, form=company or {})


@app.route("/companies/<company_id>/delete", methods=["POST"])
@admin_required
def company_delete(company_id: str):
    with get_db() as conn:
        conn.execute(
            "DELETE FROM workshop_files WHERE workshop_id IN (SELECT id FROM workshops WHERE company_id = ?)",
            (company_id,),
        )
        for table in (
            "automation_points",
            "critical_points",
            "workshops",
            "assignments",
            "company_streams",
            "value_stream_suggestions",
        ):
            if table == "value_stream_suggestions":
                conn.execute(
                    "DELETE FROM value_stream_suggestions WHERE value_stream_id IN (SELECT id FROM value_streams WHERE company_id = ?)",
                    (company_id,),
                )
            else:
                conn.execute(f"DELETE FROM {table} WHERE company_id = ?", (company_id,))
        conn.execute("DELETE FROM value_streams WHERE company_id = ?", (company_id,))
        conn.execute("DELETE FROM companies WHERE id = ?", (company_id,))
    flash("Company removed", "ok")
    return redirect(url_for("companies"))


def _load_streams(company_id: str | None = None) -> list[dict]:
    sql = """
        SELECT v.*, c.short_name AS company_short, c.name AS company_name
        FROM value_streams v
        JOIN companies c ON c.id = v.company_id
    """
    if company_id:
        return fetchall(sql + " WHERE v.company_id = ? ORDER BY v.sort_order, v.code", (company_id,))
    return fetchall(sql + " ORDER BY c.name, v.sort_order, v.code")


@app.route("/value-streams", methods=["GET", "POST"])
@admin_required
def value_streams():
    if request.method == "POST":
        action = request.form.get("action")
        company_id = request.form.get("company_id") or ""
        if action == "stream":
            code = re.sub(r"[^A-Za-z0-9]", "", (request.form.get("code") or "")).upper()
            name = (request.form.get("name") or "").strip()
            description = (request.form.get("description") or "").strip()
            levels = normalize_levels(request.form.getlist("level"))
            if len(code) < 2 or not name or not company_id:
                flash("Company, code, and name are required", "error")
            else:
                try:
                    with get_db() as conn:
                        count = conn.execute(
                            "SELECT COUNT(*) AS c FROM value_streams WHERE company_id = ?",
                            (company_id,),
                        ).fetchone()["c"]
                        conn.execute(
                            """
                            INSERT INTO value_streams
                            (id, company_id, code, name, description, levels, sort_order)
                            VALUES (?,?,?,?,?,?,?)
                            """,
                            (new_id(), company_id, code, name, description, levels, int(count) + 1),
                        )
                    flash("Value stream added", "ok")
                except Exception:
                    flash("That value stream code already exists for this company", "error")
        elif action == "levels":
            stream_id = request.form.get("value_stream_id") or ""
            levels = normalize_levels(request.form.getlist("level"))
            with get_db() as conn:
                conn.execute("UPDATE value_streams SET levels = ? WHERE id = ?", (levels, stream_id))
            flash("Levels saved", "ok")
        elif action == "suggestion":
            stream_id = request.form.get("value_stream_id") or ""
            process_code = (request.form.get("process_code") or "").strip()
            note = (request.form.get("note") or "").strip()
            if not stream_id or not process_code:
                flash("Pick a value stream and a process code", "error")
            else:
                try:
                    with get_db() as conn:
                        conn.execute(
                            """
                            INSERT INTO value_stream_suggestions
                            (id, value_stream_id, process_code, note)
                            VALUES (?,?,?,?)
                            """,
                            (new_id(), stream_id, process_code, note),
                        )
                    flash("Suggestion added", "ok")
                except Exception:
                    flash("That suggestion is already on the value stream", "error")
        return redirect(url_for("value_streams", company_id=request.form.get("company_id") or ""))
    companies = fetchall("SELECT * FROM companies ORDER BY name")
    company_id = request.args.get("company_id") or (companies[0]["id"] if companies else "")
    streams = _load_streams(company_id)
    for stream in streams:
        stream["level_set"] = levels_of(stream.get("levels"))
    suggestions = fetchall(
        """
        SELECT s.*, v.code AS stream_code
        FROM value_stream_suggestions s
        JOIN value_streams v ON v.id = s.value_stream_id
        WHERE v.company_id = ?
        ORDER BY v.sort_order, s.process_code
        """,
        (company_id,),
    )
    return render_template(
        "streams.html",
        companies=companies,
        company_id=company_id,
        streams=streams,
        suggestions=suggestions,
        level_numbers=[1, 2, 3, 4, 5],
    )


@app.route("/value-streams/upload", methods=["POST"])
@admin_required
def value_stream_upload():
    upload = request.files.get("file")
    if not upload or not upload.filename:
        flash("Choose a mapping file", "error")
        return redirect(url_for("value_streams", company_id=request.form.get("company_id") or ""))
    try:
        rows = parse_suggestion_upload(upload.filename, upload.read())
    except Exception as exc:
        flash(str(exc), "error")
        return redirect(url_for("value_streams", company_id=request.form.get("company_id") or ""))
    added = 0
    missing = []
    with get_db() as conn:
        for row in rows:
            stream = conn.execute(
                "SELECT id FROM value_streams WHERE company_id = ? AND code = ?",
                (request.form.get("company_id") or "", row["stream"].upper()),
            ).fetchone()
            if not stream:
                missing.append(row["stream"])
                continue
            exists = conn.execute(
                """
                SELECT id FROM value_stream_suggestions
                WHERE value_stream_id = ? AND process_code = ?
                """,
                (stream["id"], row["process_code"]),
            ).fetchone()
            if exists:
                continue
            conn.execute(
                """
                INSERT INTO value_stream_suggestions (id, value_stream_id, process_code, note)
                VALUES (?,?,?,?)
                """,
                (new_id(), stream["id"], row["process_code"], row["note"]),
            )
            added += 1
    if missing:
        flash(f"Added {added}. Unknown value streams: {', '.join(sorted(set(missing)))}", "error")
    else:
        flash(f"Mapping upload added {added} suggestions", "ok")
    return redirect(url_for("value_streams", company_id=request.form.get("company_id") or ""))


@app.route("/value-streams/suggestions/<suggestion_id>/delete", methods=["POST"])
@admin_required
def suggestion_delete(suggestion_id: str):
    row = fetchone(
        """
        SELECT v.company_id FROM value_stream_suggestions s
        JOIN value_streams v ON v.id = s.value_stream_id
        WHERE s.id = ?
        """,
        (suggestion_id,),
    )
    with get_db() as conn:
        conn.execute("DELETE FROM value_stream_suggestions WHERE id = ?", (suggestion_id,))
    flash("Suggestion removed", "ok")
    return redirect(url_for("value_streams", company_id=(row or {}).get("company_id", "")))


@app.route("/value-streams/<stream_id>/delete", methods=["POST"])
@admin_required
def value_stream_delete(stream_id: str):
    row = fetchone("SELECT company_id FROM value_streams WHERE id = ?", (stream_id,))
    with get_db() as conn:
        conn.execute("DELETE FROM value_stream_suggestions WHERE value_stream_id = ?", (stream_id,))
        conn.execute("DELETE FROM assignments WHERE value_stream_id = ?", (stream_id,))
        conn.execute("DELETE FROM company_streams WHERE value_stream_id = ?", (stream_id,))
        conn.execute("DELETE FROM value_streams WHERE id = ?", (stream_id,))
    flash("Value stream removed", "ok")
    return redirect(url_for("value_streams", company_id=(row or {}).get("company_id", "")))


@app.route("/assign", methods=["GET", "POST"])
@admin_required
def assign():
    companies = fetchall("SELECT * FROM companies ORDER BY name")
    masters = fetchall("SELECT * FROM apqc_masters ORDER BY industry, version")
    company_id = request.values.get("company_id") or (companies[0]["id"] if companies else "")
    streams = _load_streams(company_id)
    master_id = request.values.get("master_id") or (masters[0]["id"] if masters else "")
    stream_id = request.values.get("value_stream_id") or ""
    if stream_id not in {row["id"] for row in streams}:
        stream_id = streams[0]["id"] if streams else ""
    current_stream = next((row for row in streams if row["id"] == stream_id), None)
    allowed_levels = levels_of(current_stream.get("levels") if current_stream else None)

    if request.method == "POST":
        if not company_id or not master_id or not stream_id:
            flash("Choose a company, master, and value stream", "error")
            return redirect(url_for("assign"))
        action = request.form.get("action")
        if action == "suggest":
            codes = suggestion_codes(stream_id)
            node_ids, missing = expand_codes(master_id, codes)
            if not codes:
                flash("This value stream has no suggested process codes yet", "error")
            elif not node_ids:
                flash("None of the suggested codes are in this master: " + ", ".join(missing), "error")
            else:
                count = save_assignment(company_id, master_id, stream_id, node_ids)
                extra = f" Missing from this master: {', '.join(missing)}." if missing else ""
                flash(f"Applied suggestion — {count} processes, with APQC parents kept.{extra}", "ok")
        else:
            count = save_assignment(
                company_id,
                master_id,
                stream_id,
                request.form.getlist("node_id"),
                request.form.getlist("visible_id"),
            )
            flash(f"Saved assignment — {count} processes. Parents stay in the hierarchy.", "ok")
        return redirect(
            url_for(
                "assign",
                company_id=company_id,
                master_id=master_id,
                value_stream_id=stream_id,
                view=request.form.get("view") or "assigned",
                area=request.form.get("area") or "",
                q=request.form.get("q") or "",
            )
        )

    nodes = load_nodes(master_id) if master_id else []
    codes = suggestion_codes(stream_id) if stream_id else []
    selected = assigned_ids(company_id, stream_id) if company_id and stream_id else set()
    suggested_ids: set[str] = set()
    missing: list[str] = []
    if master_id and codes:
        suggested_ids_list, missing = expand_codes(master_id, codes)
        suggested_ids = set(suggested_ids_list)
    view = request.args.get("view") or "outline"
    if view not in {"outline", "suggested", "assigned", "1", "2", "3", "4", "5"}:
        view = "outline"
    area = request.args.get("area") or ""
    q = (request.args.get("q") or "").strip()
    areas = _areas(nodes)
    by_id = {node["id"]: node for node in nodes}
    parents = {node.get("parent_id") for node in nodes if node.get("parent_id")}
    if view == "assigned":
        shown = [n for n in nodes if n["id"] in selected]
    elif view == "suggested":
        shown = [n for n in nodes if n["id"] in suggested_ids]
    elif view in {"1", "2", "3", "4", "5"}:
        wanted = int(view)
        shown = _filter_nodes(nodes, area=area, q=q)
        shown = [n for n in shown if int(n["level"]) == wanted]
    else:
        shown = _filter_nodes(nodes, area=area, q=q)
    for node in shown:
        parent = by_id.get(node.get("parent_id"))
        node["parent_code"] = parent["code"] if parent else ""
        node["has_children"] = node["id"] in parents
    collapse = view == "outline" and not (q or area)
    return render_template(
        "assign.html",
        companies=companies,
        masters=masters,
        streams=streams,
        company_id=company_id,
        master_id=master_id,
        stream_id=stream_id,
        allowed_levels=sorted(allowed_levels),
        level_counts=_level_counts(nodes),
        nodes=shown,
        truncated=False,
        collapse=collapse,
        selected=selected,
        suggested_ids=suggested_ids,
        missing=missing,
        codes=codes,
        areas=areas,
        view=view,
        area=area,
        q=q,
    )


@app.route("/distribute")
@admin_required
def distribute():
    return render_template(
        "distribute.html",
        rows=distribution_rows(),
        headers=EXCEL_HEADERS,
    )


@app.route("/distribute/download")
@admin_required
def distribute_download():
    company_id = request.args.get("company_id") or ""
    stream_id = request.args.get("value_stream_id") or ""
    try:
        data, filename = build_workbook(company_id, stream_id)
    except Exception as exc:
        flash(str(exc), "error")
        return redirect(url_for("distribute"))
    return send_file(
        BytesIO(data),
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.route("/workshops", methods=["GET", "POST"])
@admin_required
def workshops():
    if request.method == "POST":
        company_id = request.form.get("company_id") or ""
        title = (request.form.get("title") or "").strip()
        held_on = (request.form.get("held_on") or "").strip()
        summary = (request.form.get("summary") or "").strip()
        value_stream_id = request.form.get("value_stream_id") or None
        if not company_id or not title or not held_on:
            flash("Company, title, and date are required", "error")
        else:
            with get_db() as conn:
                conn.execute(
                    """
                    INSERT INTO workshops
                    (id, company_id, value_stream_id, title, held_on, summary, created_at)
                    VALUES (?,?,?,?,?,?,?)
                    """,
                    (new_id(), company_id, value_stream_id or None, title, held_on, summary, utcnow()),
                )
            flash("Workshop added. Open it to upload minutes and diagrams.", "ok")
        return redirect(url_for("workshops"))
    rows = fetchall(
        """
        SELECT w.*, c.name AS company_name, c.short_name, v.code AS vs_code,
          (SELECT COUNT(*) FROM workshop_files f WHERE f.workshop_id = w.id) AS files
        FROM workshops w
        JOIN companies c ON c.id = w.company_id
        LEFT JOIN value_streams v ON v.id = w.value_stream_id
        ORDER BY w.held_on DESC, w.title
        """
    )
    return render_template(
        "workshops.html",
        workshops=rows,
        companies=fetchall("SELECT * FROM companies ORDER BY name"),
        streams=_load_streams(),
    )


@app.route("/workshops/<workshop_id>", methods=["GET", "POST"])
@admin_required
def workshop_detail(workshop_id: str):
    workshop = fetchone(
        """
        SELECT w.*, c.name AS company_name, v.code AS vs_code, v.name AS vs_name
        FROM workshops w
        JOIN companies c ON c.id = w.company_id
        LEFT JOIN value_streams v ON v.id = w.value_stream_id
        WHERE w.id = ?
        """,
        (workshop_id,),
    )
    if not workshop:
        abort(404)
    if request.method == "POST":
        kind = request.form.get("kind") or ""
        upload = request.files.get("file")
        if kind not in {"minutes", "diagram"} or not upload or not upload.filename:
            flash("Choose minutes or a diagram, and a file", "error")
        else:
            ext = Path(upload.filename).suffix.lower()
            allowed = MINUTES_EXT if kind == "minutes" else DIAGRAM_EXT
            if ext not in allowed:
                flash("That file type is not allowed for this upload", "error")
            else:
                stored = new_id() + ext
                UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
                upload.save(UPLOAD_ROOT / stored)
                with get_db() as conn:
                    conn.execute(
                        """
                        INSERT INTO workshop_files
                        (id, workshop_id, kind, original_name, stored_name, uploaded_at)
                        VALUES (?,?,?,?,?,?)
                        """,
                        (
                            new_id(),
                            workshop_id,
                            kind,
                            secure_filename(upload.filename) or upload.filename,
                            stored,
                            utcnow(),
                        ),
                    )
                flash("File uploaded", "ok")
        return redirect(url_for("workshop_detail", workshop_id=workshop_id))
    files = fetchall(
        "SELECT * FROM workshop_files WHERE workshop_id = ? ORDER BY uploaded_at DESC",
        (workshop_id,),
    )
    points = fetchall(
        "SELECT * FROM critical_points WHERE workshop_id = ? ORDER BY created_at DESC",
        (workshop_id,),
    )
    return render_template(
        "workshop_detail.html",
        workshop=workshop,
        files=files,
        points=points,
    )


@app.route("/uploads/<file_id>")
@admin_required
def download_upload(file_id: str):
    row = fetchone("SELECT * FROM workshop_files WHERE id = ?", (file_id,))
    if not row:
        abort(404)
    path = UPLOAD_ROOT / row["stored_name"]
    if not path.exists():
        abort(404)
    return send_file(path, as_attachment=True, download_name=row["original_name"])


@app.route("/critical-points", methods=["GET", "POST"])
@admin_required
def critical_points():
    if request.method == "POST":
        title = (request.form.get("title") or "").strip()
        company_id = request.form.get("company_id") or ""
        if not title or not company_id:
            flash("Company and title are required", "error")
        else:
            point_id = request.form.get("id") or ""
            fields = (
                company_id,
                request.form.get("workshop_id") or None,
                request.form.get("value_stream_id") or None,
                request.form.get("process_node_id") or None,
                title,
                (request.form.get("detail") or "").strip(),
                (request.form.get("owner") or "").strip(),
                request.form.get("status") or "maintain",
            )
            with get_db() as conn:
                if point_id:
                    conn.execute(
                        """
                        UPDATE critical_points
                        SET company_id=?, workshop_id=?, value_stream_id=?, process_node_id=?,
                            title=?, detail=?, owner=?, status=?
                        WHERE id=?
                        """,
                        (*fields, point_id),
                    )
                else:
                    conn.execute(
                        """
                        INSERT INTO critical_points
                        (company_id, workshop_id, value_stream_id, process_node_id,
                         title, detail, owner, status, id, created_at)
                        VALUES (?,?,?,?,?,?,?,?,?,?)
                        """,
                        (*fields, new_id(), utcnow()),
                    )
            flash("Critical point saved", "ok")
        return redirect(url_for("critical_points"))
    edit = None
    edit_id = request.args.get("edit")
    if edit_id:
        edit = fetchone("SELECT * FROM critical_points WHERE id = ?", (edit_id,))
    rows = fetchall(
        """
        SELECT p.*, c.short_name, v.code AS vs_code, n.code AS process_code, w.title AS workshop_title
        FROM critical_points p
        JOIN companies c ON c.id = p.company_id
        LEFT JOIN value_streams v ON v.id = p.value_stream_id
        LEFT JOIN process_nodes n ON n.id = p.process_node_id
        LEFT JOIN workshops w ON w.id = p.workshop_id
        ORDER BY p.created_at DESC
        """
    )
    return render_template(
        "critical.html",
        points=rows,
        edit=edit,
        companies=fetchall("SELECT * FROM companies ORDER BY name"),
        streams=_load_streams(),
        workshops=fetchall(
            """
            SELECT w.id, w.title, c.short_name
            FROM workshops w JOIN companies c ON c.id = w.company_id
            ORDER BY w.held_on DESC
            """
        ),
        processes=_process_options(),
        preset_workshop=request.args.get("workshop_id") or "",
        preset_company=request.args.get("company_id") or "",
    )


@app.route("/critical-points/<point_id>/delete", methods=["POST"])
@admin_required
def critical_delete(point_id: str):
    with get_db() as conn:
        conn.execute("DELETE FROM critical_points WHERE id = ?", (point_id,))
    flash("Critical point removed", "ok")
    return redirect(url_for("critical_points"))


@app.route("/automation", methods=["GET", "POST"])
@admin_required
def automation():
    if request.method == "POST":
        title = (request.form.get("title") or "").strip()
        company_id = request.form.get("company_id") or ""
        if not title or not company_id:
            flash("Company and title are required", "error")
        else:
            point_id = request.form.get("id") or ""
            fields = (
                company_id,
                request.form.get("value_stream_id") or None,
                request.form.get("process_node_id") or None,
                title,
                (request.form.get("detail") or "").strip(),
                request.form.get("manual_vs_system") or "manual",
                (request.form.get("tool") or "").strip(),
                request.form.get("priority") or "medium",
                request.form.get("status") or "candidate",
            )
            with get_db() as conn:
                if point_id:
                    conn.execute(
                        """
                        UPDATE automation_points
                        SET company_id=?, value_stream_id=?, process_node_id=?, title=?, detail=?,
                            manual_vs_system=?, tool=?, priority=?, status=?
                        WHERE id=?
                        """,
                        (*fields, point_id),
                    )
                else:
                    conn.execute(
                        """
                        INSERT INTO automation_points
                        (company_id, value_stream_id, process_node_id, title, detail,
                         manual_vs_system, tool, priority, status, id, created_at)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?)
                        """,
                        (*fields, new_id(), utcnow()),
                    )
            flash("Automation point saved", "ok")
        return redirect(url_for("automation"))
    edit = None
    if request.args.get("edit"):
        edit = fetchone("SELECT * FROM automation_points WHERE id = ?", (request.args.get("edit"),))
    rows = fetchall(
        """
        SELECT a.*, c.short_name, v.code AS vs_code, n.code AS process_code
        FROM automation_points a
        JOIN companies c ON c.id = a.company_id
        LEFT JOIN value_streams v ON v.id = a.value_stream_id
        LEFT JOIN process_nodes n ON n.id = a.process_node_id
        ORDER BY a.created_at DESC
        """
    )
    return render_template(
        "automation.html",
        points=rows,
        edit=edit,
        companies=fetchall("SELECT * FROM companies ORDER BY name"),
        streams=_load_streams(),
        processes=_process_options(),
    )


@app.route("/automation/<point_id>/delete", methods=["POST"])
@admin_required
def automation_delete(point_id: str):
    with get_db() as conn:
        conn.execute("DELETE FROM automation_points WHERE id = ?", (point_id,))
    flash("Automation point removed", "ok")
    return redirect(url_for("automation"))


def _process_options() -> list[dict]:
    return fetchall(
        """
        SELECT DISTINCT n.id, n.code, n.name, c.short_name
        FROM assignments a
        JOIN process_nodes n ON n.id = a.process_node_id
        JOIN companies c ON c.id = a.company_id
        ORDER BY c.short_name, n.code
        """
    )


@app.route("/users")
@admin_required
def users():
    rows = fetchall("SELECT * FROM users ORDER BY name")
    return render_template("users.html", users=rows)


@app.route("/users/new", methods=["GET"])
@admin_required
def user_new():
    return render_template("user_form.html", user=None)


@app.route("/users", methods=["POST"])
@admin_required
def user_create():
    name = (request.form.get("name") or "").strip()
    email = (request.form.get("email") or "").strip().lower()
    password = request.form.get("password") or ""
    role = request.form.get("role") or "VIEWER"
    if role not in ROLES:
        role = "VIEWER"
    if not name or not email or len(password) < 6:
        flash("Name, email, and a password of at least 6 characters are required", "error")
        return redirect(url_for("user_new"))
    try:
        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO users (id, email, password_hash, name, role, is_active, created_at)
                VALUES (?,?,?,?,?,1,?)
                """,
                (new_id(), email, generate_password_hash(password), name, role, utcnow()),
            )
        flash(f"User ID created for {email}", "ok")
        return redirect(url_for("users"))
    except Exception:
        flash("That email is already a user", "error")
        return redirect(url_for("user_new"))


@app.route("/users/<user_id>")
@admin_required
def user_view(user_id: str):
    user = fetchone("SELECT * FROM users WHERE id = ?", (user_id,))
    if not user:
        abort(404)
    return render_template("user_view.html", user=user)


@app.route("/users/<user_id>/edit", methods=["GET"])
@admin_required
def user_edit(user_id: str):
    user = fetchone("SELECT * FROM users WHERE id = ?", (user_id,))
    if not user:
        abort(404)
    return render_template("user_form.html", user=user)


@app.route("/users/<user_id>", methods=["POST"])
@admin_required
def user_update(user_id: str):
    user = fetchone("SELECT * FROM users WHERE id = ?", (user_id,))
    if not user:
        abort(404)
    name = (request.form.get("name") or "").strip()
    email = (request.form.get("email") or "").strip().lower()
    role = request.form.get("role") or user["role"]
    if role not in ROLES:
        role = user["role"]
    is_active = 1 if request.form.get("is_active") == "1" else 0
    password = request.form.get("password") or ""
    if not name or not email:
        flash("Name and email are required", "error")
        return redirect(url_for("user_edit", user_id=user_id))
    if (role != "ADMIN" or not is_active) and user["role"] == "ADMIN" and user["is_active"]:
        others = fetchone(
            "SELECT COUNT(*) AS c FROM users WHERE role = 'ADMIN' AND is_active = 1 AND id != ?",
            (user_id,),
        )
        if not others or others["c"] == 0:
            flash("Keep at least one active Admin", "error")
            return redirect(url_for("user_edit", user_id=user_id))
    try:
        with get_db() as conn:
            conn.execute(
                "UPDATE users SET name=?, email=?, role=?, is_active=? WHERE id=?",
                (name, email, role, is_active, user_id),
            )
            if password:
                if len(password) < 6:
                    raise ValueError("short")
                conn.execute(
                    "UPDATE users SET password_hash=? WHERE id=?",
                    (generate_password_hash(password), user_id),
                )
        flash("User updated", "ok")
        return redirect(url_for("user_view", user_id=user_id))
    except ValueError:
        flash("New password must be at least 6 characters", "error")
        return redirect(url_for("user_edit", user_id=user_id))
    except Exception:
        flash("That email is already a user", "error")
        return redirect(url_for("user_edit", user_id=user_id))


@app.route("/roadmap")
@admin_required
def roadmap():
    return render_template("roadmap.html")


def _areas(nodes: list[dict]) -> list[str]:
    seen: list[str] = []
    for node in nodes:
        area = node.get("area") or ""
        if area and area not in seen:
            seen.append(area)

    def key(area: str) -> int:
        match = re.match(r"(\d+)", area)
        return int(match.group(1)) if match else 999

    return sorted(seen, key=key)


def _level_counts(nodes) -> list[tuple[int, int]]:
    return [(number, sum(1 for node in nodes if int(node["level"]) == number)) for number in range(1, 6)]


def _filter_nodes(nodes, area="", q="", max_level=None):
    ql = (q or "").lower()
    out = []
    for node in nodes:
        if area and node.get("area") != area:
            continue
        haystack = f"{node['code']} {node.get('apqc_id') or ''} {node['name']}".lower()
        if ql and ql not in haystack:
            continue
        if max_level is not None and int(node["level"]) > max_level:
            continue
        out.append(node)
    return out


def _with_ancestors(nodes: list[dict], picked_ids: list[str]) -> list[dict]:
    by_id = {node["id"]: node for node in nodes}
    keep: set[str] = set()
    for node_id in picked_ids:
        current = by_id.get(node_id)
        while current and current["id"] not in keep:
            keep.add(current["id"])
            current = by_id.get(current.get("parent_id"))
    return [node for node in nodes if node["id"] in keep]


def create_app():
    init_db()
    return app


def _port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.3)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def _runtime_dir() -> Path:
    path = Path(__file__).resolve().parent / "data"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _pid_file() -> Path:
    return _runtime_dir() / "aetria.pid"


def _read_pid() -> int | None:
    try:
        return int(_pid_file().read_text().strip())
    except (OSError, ValueError):
        return None


def _pid_alive(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def _open_login(port: int) -> None:
    if sys.platform != "darwin":
        return
    subprocess.Popen(["open", f"http://localhost:{port}/login"])


def _serve(port: int, debug: bool) -> None:
    if hasattr(signal, "SIGHUP"):
        signal.signal(signal.SIGHUP, signal.SIG_IGN)
    init_db()
    print(f"Aetria Admin workbench → http://localhost:{port}/login")
    app.run(host="0.0.0.0", port=port, debug=debug, use_reloader=debug)


def _listener_pids(port: int) -> list[int]:
    commands = (
        ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"],
        ["fuser", "-n", "tcp", str(port)],
    )
    for cmd in commands:
        try:
            out = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)
        except (OSError, subprocess.CalledProcessError):
            continue
        pids: list[int] = []
        for token in out.replace("\n", " ").split():
            digits = "".join(ch for ch in token if ch.isdigit())
            if digits:
                pids.append(int(digits))
        if pids:
            return pids
    return []


def _stop_listeners(port: int) -> bool:
    """Stop whatever is serving this port. True when the port is free."""
    pids: list[int] = []
    recorded = _read_pid()
    if recorded:
        pids.append(recorded)
    for pid in _listener_pids(port):
        if pid not in pids:
            pids.append(pid)
    me = os.getpid()
    for pid in pids:
        if pid == me or not _pid_alive(pid):
            continue
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            pass
    deadline = time.time() + 3
    while time.time() < deadline and _port_open(port):
        time.sleep(0.1)
    if _port_open(port):
        for pid in _listener_pids(port):
            if pid == me:
                continue
            try:
                os.kill(pid, signal.SIGKILL)
            except OSError:
                pass
        deadline = time.time() + 2
        while time.time() < deadline and _port_open(port):
            time.sleep(0.1)
    _pid_file().unlink(missing_ok=True)
    return not _port_open(port)


def _stop_server(port: int) -> None:
    if not _port_open(port) and not _pid_alive(_read_pid()):
        _pid_file().unlink(missing_ok=True)
        print("Aetria is not running.")
        return
    if _stop_listeners(port):
        print("Aetria stopped.")
        return
    print(f"Aetria is still using port {port}. Paste this, then run python app.py again:")
    print(f"  kill -9 $(lsof -t -iTCP:{port} -sTCP:LISTEN)")


def _start_in_background(port: int) -> None:
    if _port_open(port):
        print("Stopping the copy already running so this update can load.")
        if not _stop_listeners(port):
            print(f"The old Aetria is still on port {port}. Paste this, then run python app.py again:")
            print(f"  kill -9 $(lsof -t -iTCP:{port} -sTCP:LISTEN)")
            sys.exit(1)
    log_path = _runtime_dir() / "aetria.log"
    log_handle = open(log_path, "a", buffering=1)
    env = os.environ.copy()
    env["AETRIA_DETACHED"] = "1"
    proc = subprocess.Popen(
        [sys.executable, str(Path(__file__).resolve())],
        cwd=str(Path(__file__).resolve().parent),
        env=env,
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    _pid_file().write_text(str(proc.pid))
    deadline = time.time() + 8
    while time.time() < deadline:
        if _port_open(port):
            print(f"Aetria is running at http://localhost:{port}/login")
            print("You can close this window. The site stays up.")
            print("Stop it later with: python app.py --stop")
            _open_login(port)
            return
        if proc.poll() is not None:
            break
        time.sleep(0.1)
    print(f"Aetria did not start. The log is {log_path}")
    sys.exit(1)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8765"))
    if "--stop" in sys.argv:
        _stop_server(port)
    elif os.environ.get("AETRIA_DETACHED") == "1":
        _serve(port, debug=False)
    elif "--foreground" in sys.argv:
        _serve(port, debug=True)
    else:
        _start_in_background(port)
