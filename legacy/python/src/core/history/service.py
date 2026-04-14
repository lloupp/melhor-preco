from __future__ import annotations

import sqlite3
from typing import Any

from datetime import datetime, timedelta

from src.core.history.analytics import (
    build_summary,
    compute_product_metrics,
    format_currency,
    format_percentage,
    format_price_range,
)
from src.infra.db import repository


def get_filter_options(connection: sqlite3.Connection) -> dict[str, list[dict[str, Any]]]:
    return {
        "categories": [{"value": item, "label": item.title()} for item in repository.list_categories(connection)],
        "cities": [{"value": item, "label": item} for item in repository.list_cities(connection)],
        "markets": [
            {"value": market["id"], "label": f"{market['nome']} ({market['cidade']})"}
            for market in repository.list_markets(connection)
        ],
        "products": [
            {"value": product["id"], "label": product["nome"]}
            for product in repository.list_products(connection)
        ],
    }


def get_dashboard_view_model(connection: sqlite3.Connection, filters: dict[str, Any]) -> dict[str, Any]:
    records = apply_period_filter(
        repository.fetch_price_records(
        connection,
        category=filters.get("category"),
        market_id=filters.get("market_id"),
        city=filters.get("city"),
        ),
        filters.get("period_days"),
    )
    products = repository.list_products(connection, category=filters.get("category"))

    rows = []
    for product in products:
        product_records = [record for record in records if record["product_id"] == product["id"]]
        metrics = compute_product_metrics(product_records)
        rows.append(build_product_row(product, metrics))

    highest = sorted(
        [row for row in rows if row["weekly_variation"] is not None],
        key=lambda item: item["weekly_variation"],
        reverse=True,
    )[:5]
    lowest = sorted(
        [row for row in rows if row["weekly_variation"] is not None],
        key=lambda item: item["weekly_variation"],
    )[:5]

    status_counts = {
        "acima_faixa": sum(1 for row in rows if row["status_code"] == "acima_faixa"),
        "abaixo_faixa": sum(1 for row in rows if row["status_code"] == "abaixo_faixa"),
        "dentro_faixa": sum(1 for row in rows if row["status_code"] == "dentro_faixa"),
    }

    return {
        "filters": filters,
        "filter_options": get_filter_options(connection),
        "totals": {
            "products": len(rows),
            "markets": len({record["market_id"] for record in records}),
            "records": len(records),
            "above_range": status_counts["acima_faixa"],
            "below_range": status_counts["abaixo_faixa"],
            "within_range": status_counts["dentro_faixa"],
        },
        "rows": rows,
        "highest_weekly_moves": highest,
        "lowest_weekly_moves": lowest,
    }


def get_product_view_model(connection: sqlite3.Connection, product_id: int, filters: dict[str, Any]) -> dict[str, Any] | None:
    product = repository.fetch_product(connection, product_id)
    if not product:
        return None

    records = apply_period_filter(
        repository.fetch_price_records(
        connection,
        product_id=product_id,
        market_id=filters.get("market_id"),
        city=filters.get("city"),
        ),
        filters.get("period_days"),
    )
    metrics = compute_product_metrics(records)
    factors = repository.fetch_market_factors(
        connection,
        product_id=product_id,
        market_id=filters.get("market_id"),
        city=filters.get("city"),
    )

    return {
        "product": product,
        "filters": filters,
        "filter_options": get_filter_options(connection),
        "metrics": metrics,
        "summary": build_summary(product["nome"], metrics),
        "factors": [_decorate_factor(item) for item in factors],
        "chart_points": [{"label": point["date"][5:], "value": point["value"]} for point in metrics["series"]],
        "market_snapshot": build_market_snapshot(records),
    }


def get_comparison_view_model(connection: sqlite3.Connection, filters: dict[str, Any]) -> dict[str, Any]:
    products = repository.list_products(connection, category=filters.get("category"))
    selected_product_id = filters.get("product_id") or (products[0]["id"] if products else None)

    offers: list[dict[str, Any]] = []
    product = None
    if selected_product_id:
        product = repository.fetch_product(connection, int(selected_product_id))
        records = apply_period_filter(
            repository.fetch_price_records(
                connection,
                product_id=int(selected_product_id),
                market_id=filters.get("market_id"),
                city=filters.get("city"),
            ),
            filters.get("period_days"),
        )
        latest_by_market: dict[int, dict[str, Any]] = {}
        for record in records:
            latest_by_market[record["market_id"]] = record
        metrics = compute_product_metrics(records)
        expected_range = metrics["expected_range"]

        for record in sorted(latest_by_market.values(), key=lambda item: item["preco_total"]):
            status_code = "dentro_faixa"
            if expected_range["low"] is not None and expected_range["high"] is not None:
                if record["preco_total"] < expected_range["low"]:
                    status_code = "abaixo_faixa"
                elif record["preco_total"] > expected_range["high"]:
                    status_code = "acima_faixa"

            offers.append(
                {
                    "market_name": record["market_name"],
                    "city": record["city"],
                    "price": record["preco"],
                    "freight": record["frete"],
                    "total": record["preco_total"],
                    "status_code": status_code,
                    "status_label": status_label(status_code),
                }
            )

        if offers:
            offers[0]["best_opportunity"] = True

    return {
        "filters": filters,
        "filter_options": get_filter_options(connection),
        "products": products,
        "selected_product_id": int(selected_product_id) if selected_product_id else None,
        "selected_product": product,
        "offers": offers,
    }


def build_product_row(product: dict[str, Any], metrics: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": product["id"],
        "name": product["nome"],
        "category": product["categoria"],
        "current_price": metrics["current_price"],
        "current_price_label": format_currency(metrics["current_price"]),
        "avg_7_label": format_currency(metrics["avg_7"]),
        "avg_30_label": format_currency(metrics["avg_30"]),
        "weekly_variation": metrics["weekly_variation"],
        "weekly_variation_label": format_percentage(metrics["weekly_variation"]),
        "status_code": metrics["status"]["code"],
        "status_label": metrics["status"]["label"],
        "trend_label": metrics["trend"]["label"],
        "expected_range_label": format_price_range(
            metrics["expected_range"]["low"], metrics["expected_range"]["high"]
        ),
    }


def build_market_snapshot(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    latest_by_market: dict[int, dict[str, Any]] = {}
    for record in records:
        latest_by_market[record["market_id"]] = record
    snapshot = sorted(latest_by_market.values(), key=lambda item: item["preco_total"])
    return [
        {
            "market_name": record["market_name"],
            "city": record["city"],
            "price_label": format_currency(record["preco"]),
            "freight_label": format_currency(record["frete"]),
            "total_label": format_currency(record["preco_total"]),
        }
        for record in snapshot
    ]


def _decorate_factor(item: dict[str, Any]) -> dict[str, Any]:
    item = dict(item)
    item["impact_label"] = f"{item['direcao'].title()} moderada" if item["intensidade"] <= 3 else f"{item['direcao'].title()} forte"
    return item


def status_label(code: str) -> str:
    return {
        "abaixo_faixa": "Abaixo da faixa",
        "acima_faixa": "Acima da faixa",
        "dentro_faixa": "Dentro da faixa",
    }.get(code, "Sem dados")


def apply_period_filter(records: list[dict[str, Any]], period_days: int | None) -> list[dict[str, Any]]:
    if not period_days or not records:
        return records

    latest = max(datetime.fromisoformat(record["coletado_em"]) for record in records)
    threshold = latest - timedelta(days=period_days - 1)
    return [
        record
        for record in records
        if datetime.fromisoformat(record["coletado_em"]) >= threshold
    ]
