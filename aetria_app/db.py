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
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  is_aetria_operator INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('ADMIN','AREA_EDITOR','VIEWER')),
  UNIQUE(user_id, company_id)
);

CREATE TABLE IF NOT EXISTS value_streams (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS process_nodes (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES process_nodes(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  master_node_id TEXT REFERENCES process_nodes(id) ON DELETE SET NULL,
  value_stream_id TEXT REFERENCES value_streams(id) ON DELETE SET NULL,
  is_hidden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS process_assignments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  master_node_id TEXT NOT NULL REFERENCES process_nodes(id) ON DELETE CASCADE,
  assigned_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TEXT NOT NULL,
  UNIQUE(company_id, master_node_id)
);

CREATE TABLE IF NOT EXISTS area_scopes (
  id TEXT PRIMARY KEY,
  membership_id TEXT NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  process_node_id TEXT NOT NULL REFERENCES process_nodes(id) ON DELETE CASCADE,
  UNIQUE(membership_id, process_node_id)
);

CREATE INDEX IF NOT EXISTS idx_nodes_company ON process_nodes(company_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_code ON process_nodes(company_id, code);
"""


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(SCHEMA)


def reset_db() -> None:
    """Wipe existing data, then recreate schema. Safe for SQLite and Postgres."""
    if using_postgres():
        with get_db() as conn:
            conn.executescript(
                """
                DROP TABLE IF EXISTS area_scopes CASCADE;
                DROP TABLE IF EXISTS process_assignments CASCADE;
                DROP TABLE IF EXISTS process_nodes CASCADE;
                DROP TABLE IF EXISTS value_streams CASCADE;
                DROP TABLE IF EXISTS memberships CASCADE;
                DROP TABLE IF EXISTS companies CASCADE;
                DROP TABLE IF EXISTS users CASCADE;
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
