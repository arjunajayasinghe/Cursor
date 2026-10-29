"""Database access — SQLite locally, Postgres when DATABASE_URL is set (hosting)."""
from __future__ import annotations

import os
import re
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

DB_PATH = Path(
    os.environ.get(
        "AETRIA_DB",
        Path(__file__).resolve().parent.parent / "data" / "aetria.db",
    )
)

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()


def using_postgres() -> bool:
    return DATABASE_URL.startswith(("postgres://", "postgresql://"))


class _PgConnection:
    """Thin wrapper so call sites can keep using ? placeholders and .fetchone()/.fetchall()."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql: str, params: tuple | list | None = None):
        sql_pg = sql.replace("?", "%s")
        cur = self._conn.cursor()
        cur.execute(sql_pg, params or ())
        return cur

    def executescript(self, script: str) -> None:
        cur = self._conn.cursor()
        # strip SQL comments, split on semicolons
        cleaned = re.sub(r"--.*?$", "", script, flags=re.M)
        for stmt in cleaned.split(";"):
            stmt = stmt.strip()
            if stmt:
                cur.execute(stmt)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()


def connect():
    if using_postgres():
        import psycopg2
        from psycopg2.extras import RealDictCursor

        # Railway/Render sometimes use postgres://
        url = DATABASE_URL
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        raw = psycopg2.connect(url, cursor_factory=RealDictCursor)
        raw.autocommit = False
        return _PgConnection(raw)

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db() -> Iterator[Any]:
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN','AETRIA_AREA','COMPANY_ADMIN','AREA_EDITOR','VIEWER')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS apqc_masters (
  id TEXT PRIMARY KEY,
  industry TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(industry, version)
);

CREATE TABLE IF NOT EXISTS process_nodes (
  id TEXT PRIMARY KEY,
  master_id TEXT NOT NULL REFERENCES apqc_masters(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES process_nodes(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL,
  level_label TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  apqc_id TEXT NOT NULL DEFAULT '',
  applies_to TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  metrics_available TEXT NOT NULL DEFAULT '',
  element_description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(master_id, code)
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL UNIQUE,
  industry TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS value_streams (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  levels TEXT NOT NULL DEFAULT '1,2,3,4,5',
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS value_stream_suggestions (
  id TEXT PRIMARY KEY,
  value_stream_id TEXT NOT NULL REFERENCES value_streams(id) ON DELETE CASCADE,
  process_code TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  UNIQUE(value_stream_id, process_code)
);

CREATE TABLE IF NOT EXISTS company_streams (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  value_stream_id TEXT NOT NULL REFERENCES value_streams(id) ON DELETE CASCADE,
  master_id TEXT REFERENCES apqc_masters(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'suggested',
  UNIQUE(company_id, value_stream_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  master_id TEXT NOT NULL REFERENCES apqc_masters(id) ON DELETE CASCADE,
  value_stream_id TEXT NOT NULL REFERENCES value_streams(id) ON DELETE CASCADE,
  process_node_id TEXT NOT NULL REFERENCES process_nodes(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE(company_id, value_stream_id, process_node_id)
);

CREATE TABLE IF NOT EXISTS workshops (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  value_stream_id TEXT REFERENCES value_streams(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  held_on TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workshop_files (
  id TEXT PRIMARY KEY,
  workshop_id TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('minutes','diagram')),
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS critical_points (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workshop_id TEXT REFERENCES workshops(id) ON DELETE SET NULL,
  value_stream_id TEXT REFERENCES value_streams(id) ON DELETE SET NULL,
  process_node_id TEXT REFERENCES process_nodes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'maintain',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_points (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  value_stream_id TEXT REFERENCES value_streams(id) ON DELETE SET NULL,
  process_node_id TEXT REFERENCES process_nodes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  manual_vs_system TEXT NOT NULL DEFAULT 'manual',
  tool TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'candidate',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_master ON process_nodes(master_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_assign_company ON assignments(company_id, value_stream_id);
"""


def _column_names(conn, table: str) -> list[str]:
    if using_postgres():
        rows = conn.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ?
            """,
            (table,),
        ).fetchall()
        return [row["column_name"] for row in rows]
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return [row[1] for row in rows]


def _companies_using_stream(conn, stream_id: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    queries = (
        "SELECT company_id FROM assignments WHERE value_stream_id = ?",
        "SELECT company_id FROM company_streams WHERE value_stream_id = ?",
        "SELECT company_id FROM workshops WHERE value_stream_id = ?",
        "SELECT company_id FROM critical_points WHERE value_stream_id = ?",
        "SELECT company_id FROM automation_points WHERE value_stream_id = ?",
    )
    for sql in queries:
        for row in conn.execute(sql, (stream_id,)).fetchall():
            company_id = row["company_id"]
            if company_id and company_id not in seen:
                seen.add(company_id)
                found.append(company_id)
    return found


def _point_stream_at_company(conn, old_id: str, new_id: str, company_id: str) -> None:
    for table in (
        "assignments",
        "company_streams",
        "workshops",
        "critical_points",
        "automation_points",
    ):
        conn.execute(
            f"UPDATE {table} SET value_stream_id = ? WHERE value_stream_id = ? AND company_id = ?",
            (new_id, old_id, company_id),
        )


def _migrate_value_streams(conn) -> None:
    """Give each value stream a company and a level set. Existing rows are kept."""
    columns = _column_names(conn, "value_streams")
    if "company_id" in columns and "levels" in columns:
        return
    companies = [row["id"] for row in conn.execute("SELECT id FROM companies ORDER BY name").fetchall()]
    old_rows = conn.execute("SELECT * FROM value_streams").fetchall()
    plans = []
    for row in old_rows:
        owners = _companies_using_stream(conn, row["id"]) or companies[:1]
        plans.append((row, owners))

    if using_postgres():
        if "company_id" not in columns:
            conn.execute("ALTER TABLE value_streams ADD COLUMN company_id TEXT")
        if "levels" not in columns:
            conn.execute("ALTER TABLE value_streams ADD COLUMN levels TEXT NOT NULL DEFAULT '1,2,3,4,5'")
        conn.execute("ALTER TABLE value_streams DROP CONSTRAINT IF EXISTS value_streams_code_key")
    else:
        conn.commit()
        conn.execute("PRAGMA foreign_keys = OFF")
        conn.execute("PRAGMA legacy_alter_table = ON")
        conn.execute("ALTER TABLE value_streams RENAME TO value_streams_old")
        conn.execute(
            """
            CREATE TABLE value_streams (
              id TEXT PRIMARY KEY,
              company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
              code TEXT NOT NULL,
              name TEXT NOT NULL,
              description TEXT NOT NULL DEFAULT '',
              levels TEXT NOT NULL DEFAULT '1,2,3,4,5',
              sort_order INTEGER NOT NULL DEFAULT 0,
              UNIQUE(company_id, code)
            )
            """
        )

    for row, owners in plans:
        levels = row["levels"] if "levels" in row.keys() else "1,2,3,4,5"
        first, *rest = owners or [""]
        if not first:
            continue
        if using_postgres():
            conn.execute(
                "UPDATE value_streams SET company_id = ?, levels = COALESCE(levels, '1,2,3,4,5') WHERE id = ?",
                (first, row["id"]),
            )
        else:
            conn.execute(
                """
                INSERT INTO value_streams (id, company_id, code, name, description, levels, sort_order)
                VALUES (?,?,?,?,?,?,?)
                """,
                (row["id"], first, row["code"], row["name"], row["description"], levels or "1,2,3,4,5", row["sort_order"]),
            )
        for company_id in rest:
            new_stream_id = uuid.uuid4().hex
            conn.execute(
                """
                INSERT INTO value_streams (id, company_id, code, name, description, levels, sort_order)
                VALUES (?,?,?,?,?,?,?)
                """,
                (new_stream_id, company_id, row["code"], row["name"], row["description"], levels or "1,2,3,4,5", row["sort_order"]),
            )
            _point_stream_at_company(conn, row["id"], new_stream_id, company_id)

    if using_postgres():
        conn.execute("ALTER TABLE value_streams ALTER COLUMN company_id SET NOT NULL")
        conn.execute(
            """
            DO $$ BEGIN
              ALTER TABLE value_streams
                ADD CONSTRAINT value_streams_company_fk
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$
            """
        )
        conn.execute(
            """
            DO $$ BEGIN
              ALTER TABLE value_streams
                ADD CONSTRAINT value_streams_company_code UNIQUE (company_id, code);
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$
            """
        )
    else:
        conn.execute("DROP TABLE value_streams_old")
        conn.execute("PRAGMA legacy_alter_table = OFF")
        conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("DELETE FROM value_stream_suggestions")


def _repair_renamed_stream_fks(conn) -> None:
    """SQLite rewrites foreign keys when a table is renamed. Point them back."""
    if using_postgres():
        return
    broken = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE sql LIKE '%value_streams_old%' LIMIT 1"
    ).fetchone()
    if not broken:
        return
    conn.commit()
    conn.execute("PRAGMA foreign_keys = OFF")
    conn.execute("PRAGMA writable_schema = ON")
    conn.execute(
        """
        UPDATE sqlite_master
        SET sql = replace(sql, 'value_streams_old', 'value_streams')
        WHERE sql LIKE '%value_streams_old%'
        """
    )
    conn.execute("PRAGMA writable_schema = OFF")
    conn.commit()
    conn.execute("PRAGMA foreign_keys = ON")


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(SCHEMA)
        _repair_renamed_stream_fks(conn)
        if _column_names(conn, "value_streams"):
            _migrate_value_streams(conn)
        conn.execute(
            """
            INSERT INTO schema_meta (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            ("version", "3"),
        )


def reset_db() -> None:
    """Wipe existing data, then recreate schema. Safe for SQLite and Postgres."""
    if using_postgres():
        with get_db() as conn:
            conn.executescript(
                """
                DROP TABLE IF EXISTS automation_points CASCADE;
                DROP TABLE IF EXISTS critical_points CASCADE;
                DROP TABLE IF EXISTS workshop_files CASCADE;
                DROP TABLE IF EXISTS workshops CASCADE;
                DROP TABLE IF EXISTS assignments CASCADE;
                DROP TABLE IF EXISTS company_streams CASCADE;
                DROP TABLE IF EXISTS value_stream_suggestions CASCADE;
                DROP TABLE IF EXISTS area_scopes CASCADE;
                DROP TABLE IF EXISTS process_assignments CASCADE;
                DROP TABLE IF EXISTS process_nodes CASCADE;
                DROP TABLE IF EXISTS value_streams CASCADE;
                DROP TABLE IF EXISTS memberships CASCADE;
                DROP TABLE IF EXISTS apqc_masters CASCADE;
                DROP TABLE IF EXISTS companies CASCADE;
                DROP TABLE IF EXISTS users CASCADE;
                DROP TABLE IF EXISTS schema_meta CASCADE;
                """
            )
    else:
        if DB_PATH.exists():
            DB_PATH.unlink()
    init_db()


def row_to_dict(row: Any) -> dict[str, Any]:
    if row is None:
        return {}
    if isinstance(row, dict):
        return dict(row)
    return dict(row)
