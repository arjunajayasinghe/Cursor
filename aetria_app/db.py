"""SQLite helpers for Aetria Process Mapping."""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(os.environ.get("AETRIA_DB", Path(__file__).resolve().parent.parent / "data" / "aetria.db"))


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db():
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
