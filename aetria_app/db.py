"""Database access — SQLite locally, Postgres when DATABASE_URL is set (hosting)."""
from __future__ import annotations

import os
import re
import sqlite3
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
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
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


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(SCHEMA)
        conn.execute(
            """
            INSERT INTO schema_meta (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            ("version", "2"),
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
