from __future__ import annotations

import sqlite3
from typing import Any


def list_products(connection: sqlite3.Connection, category: str | None = None) -> list[dict[str, Any]]:
    query = "SELECT id, nome, categoria, unidade, descricao FROM products WHERE ativo = 1"
    params: list[Any] = []
    if category:
        query += " AND categoria = ?"
        params.append(category)
    query += " ORDER BY nome"
    rows = connection.execute(query, params).fetchall()
    return [dict(row) for row in rows]


def list_markets(connection: sqlite3.Connection, city: str | None = None) -> list[dict[str, Any]]:
    query = "SELECT id, nome, cidade, estado, canal FROM markets WHERE ativo = 1"
    params: list[Any] = []
    if city:
        query += " AND cidade = ?"
        params.append(city)
    query += " ORDER BY nome"
    rows = connection.execute(query, params).fetchall()
    return [dict(row) for row in rows]


def list_categories(connection: sqlite3.Connection) -> list[str]:
    rows = connection.execute("SELECT DISTINCT categoria FROM products ORDER BY categoria").fetchall()
    return [row["categoria"] for row in rows]


def list_cities(connection: sqlite3.Connection) -> list[str]:
    rows = connection.execute("SELECT DISTINCT cidade FROM markets ORDER BY cidade").fetchall()
    return [row["cidade"] for row in rows]


def fetch_price_records(
    connection: sqlite3.Connection,
    category: str | None = None,
    market_id: int | None = None,
    city: str | None = None,
    product_id: int | None = None,
) -> list[dict[str, Any]]:
    query = """
    SELECT
      pr.id,
      pr.product_id,
      pr.market_id,
      pr.preco,
      pr.frete,
      pr.preco_total,
      pr.coletado_em,
      p.nome AS product_name,
      p.categoria AS category,
      p.unidade AS unit,
      m.nome AS market_name,
      m.cidade AS city,
      m.estado AS state,
      m.canal AS channel
    FROM price_records pr
    INNER JOIN products p ON p.id = pr.product_id
    INNER JOIN markets m ON m.id = pr.market_id
    WHERE p.ativo = 1 AND m.ativo = 1
    """
    params: list[Any] = []

    if category:
        query += " AND p.categoria = ?"
        params.append(category)
    if market_id:
        query += " AND m.id = ?"
        params.append(market_id)
    if city:
        query += " AND m.cidade = ?"
        params.append(city)
    if product_id:
        query += " AND p.id = ?"
        params.append(product_id)

    query += " ORDER BY pr.coletado_em ASC, p.nome ASC, m.nome ASC"
    rows = connection.execute(query, params).fetchall()
    return [dict(row) for row in rows]


def fetch_market_factors(
    connection: sqlite3.Connection,
    product_id: int,
    market_id: int | None = None,
    city: str | None = None,
    limit: int = 8,
) -> list[dict[str, Any]]:
    query = """
    SELECT
      mf.id,
      mf.product_id,
      mf.market_id,
      mf.titulo,
      mf.descricao,
      mf.direcao,
      mf.intensidade,
      mf.coletado_em,
      m.nome AS market_name,
      m.cidade AS city
    FROM market_factors mf
    INNER JOIN markets m ON m.id = mf.market_id
    WHERE mf.product_id = ?
    """
    params: list[Any] = [product_id]
    if market_id:
        query += " AND mf.market_id = ?"
        params.append(market_id)
    if city:
        query += " AND m.cidade = ?"
        params.append(city)
    query += " ORDER BY mf.coletado_em DESC LIMIT ?"
    params.append(limit)
    rows = connection.execute(query, params).fetchall()
    return [dict(row) for row in rows]


def fetch_product(connection: sqlite3.Connection, product_id: int) -> dict[str, Any] | None:
    row = connection.execute(
        """
        SELECT id, nome, categoria, unidade, descricao
        FROM products
        WHERE id = ? AND ativo = 1
        """,
        (product_id,),
    ).fetchone()
    return dict(row) if row else None
