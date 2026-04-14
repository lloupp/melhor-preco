from __future__ import annotations

import sqlite3
from pathlib import Path

from src.infra.db.seed import seed_database


PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "melhor_preco.sqlite3"
SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def get_connection(db_path: Path | None = None) -> sqlite3.Connection:
    database_path = Path(db_path) if db_path else DEFAULT_DB_PATH
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database(connection: sqlite3.Connection) -> None:
    connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    connection.commit()


def bootstrap_database(db_path: Path | None = None) -> sqlite3.Connection:
    connection = get_connection(db_path)
    initialize_database(connection)
    if is_database_empty(connection):
        seed_database(connection)
    return connection


def is_database_empty(connection: sqlite3.Connection) -> bool:
    row = connection.execute("SELECT COUNT(*) AS total FROM products").fetchone()
    return not row or row["total"] == 0
