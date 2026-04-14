from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from statistics import mean, pstdev
from typing import Any


def build_daily_series(price_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in price_records:
        day = record["coletado_em"][:10]
        grouped[day].append(record)

    series = []
    for day in sorted(grouped):
        offers = sorted(grouped[day], key=lambda item: item["preco_total"])
        best_offer = offers[0]
        series.append(
            {
                "date": day,
                "value": float(best_offer["preco_total"]),
                "market_name": best_offer["market_name"],
                "market_id": int(best_offer["market_id"]),
                "offers": offers,
            }
        )
    return series


def compute_product_metrics(price_records: list[dict[str, Any]]) -> dict[str, Any]:
    daily_series = build_daily_series(price_records)
    if not daily_series:
        return empty_metrics()

    latest = daily_series[-1]
    latest_date = datetime.fromisoformat(latest["date"])
    values_7 = [point["value"] for point in filter_series_window(daily_series, latest_date, 7)]
    values_30 = [point["value"] for point in filter_series_window(daily_series, latest_date, 30)]
    previous_7 = [point["value"] for point in filter_series_window(daily_series[:-7], latest_date - timedelta(days=7), 7)]

    avg_7 = safe_mean(values_7)
    avg_30 = safe_mean(values_30)
    expected_low, expected_high = compute_expected_range(values_30 or values_7)
    weekly_variation = compute_variation(daily_series, 7)
    monthly_variation = compute_variation(daily_series, 30)
    trend = classify_trend(avg_7, safe_mean(previous_7))
    status = classify_status(latest["value"], expected_low, expected_high)
    minimum = min(point["value"] for point in daily_series)
    maximum = max(point["value"] for point in daily_series)

    return {
        "series": daily_series,
        "current_price": latest["value"],
        "current_market_name": latest["market_name"],
        "avg_7": avg_7,
        "avg_30": avg_30,
        "minimum": minimum,
        "maximum": maximum,
        "weekly_variation": weekly_variation,
        "monthly_variation": monthly_variation,
        "status": status,
        "trend": trend,
        "expected_range": {"low": expected_low, "high": expected_high},
        "insufficient_history_7": len(values_7) < 7,
        "insufficient_history_30": len(values_30) < 30,
    }


def compute_expected_range(values: list[float]) -> tuple[float | None, float | None]:
    if not values:
        return None, None
    center = mean(values)
    deviation = pstdev(values) if len(values) > 1 else center * 0.05
    margin = max(deviation, center * 0.05)
    return max(0.0, center - margin), center + margin


def compute_variation(series: list[dict[str, Any]], days_back: int) -> float | None:
    if len(series) < 2:
        return None

    latest_value = series[-1]["value"]
    latest_date = datetime.fromisoformat(series[-1]["date"])
    target_date = latest_date - timedelta(days=days_back)
    baseline = None

    for point in reversed(series[:-1]):
        point_date = datetime.fromisoformat(point["date"])
        if point_date <= target_date:
            baseline = point["value"]
            break

    if baseline in (None, 0):
        return None

    return ((latest_value - baseline) / baseline) * 100


def classify_status(current_price: float | None, low: float | None, high: float | None) -> dict[str, str]:
    if current_price is None or low is None or high is None:
        return {"code": "sem_dados", "label": "Sem dados"}
    if current_price < low:
        return {"code": "abaixo_faixa", "label": "Abaixo da faixa"}
    if current_price > high:
        return {"code": "acima_faixa", "label": "Acima da faixa"}
    return {"code": "dentro_faixa", "label": "Dentro da faixa"}


def classify_trend(current_avg: float | None, previous_avg: float | None) -> dict[str, str]:
    if current_avg is None or previous_avg is None or previous_avg == 0:
        return {"code": "indefinida", "label": "Historico insuficiente"}

    delta = ((current_avg - previous_avg) / previous_avg) * 100
    if delta >= 1:
        return {"code": "alta", "label": "Alta"}
    if delta <= -1:
        return {"code": "queda", "label": "Queda"}
    return {"code": "estavel", "label": "Estavel"}


def build_summary(product_name: str, metrics: dict[str, Any]) -> str:
    if metrics["current_price"] is None:
        return f"{product_name} ainda nao tem historico suficiente para um resumo confiavel."

    status = metrics["status"]["label"].lower()
    trend = metrics["trend"]["label"].lower()
    weekly_text = format_percentage(metrics["weekly_variation"])
    monthly_text = format_percentage(metrics["monthly_variation"])
    range_text = format_price_range(metrics["expected_range"]["low"], metrics["expected_range"]["high"])

    return (
        f"O menor preco atual de {product_name} esta em {format_currency(metrics['current_price'])}, "
        f"{status} para a faixa esperada de {range_text}. "
        f"A tendencia recente indica {trend}, com variacao semanal de {weekly_text} "
        f"e variacao mensal de {monthly_text}."
    )


def empty_metrics() -> dict[str, Any]:
    return {
        "series": [],
        "current_price": None,
        "current_market_name": None,
        "avg_7": None,
        "avg_30": None,
        "minimum": None,
        "maximum": None,
        "weekly_variation": None,
        "monthly_variation": None,
        "status": {"code": "sem_dados", "label": "Sem dados"},
        "trend": {"code": "indefinida", "label": "Historico insuficiente"},
        "expected_range": {"low": None, "high": None},
        "insufficient_history_7": True,
        "insufficient_history_30": True,
    }


def filter_series_window(
    series: list[dict[str, Any]],
    reference_date: datetime,
    days: int,
) -> list[dict[str, Any]]:
    threshold = reference_date - timedelta(days=days - 1)
    return [point for point in series if datetime.fromisoformat(point["date"]) >= threshold]


def safe_mean(values: list[float]) -> float | None:
    return mean(values) if values else None


def format_currency(value: float | None) -> str:
    if value is None:
        return "n/d"
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def format_percentage(value: float | None) -> str:
    if value is None:
        return "n/d"
    return f"{value:+.1f}%".replace(".", ",")


def format_price_range(low: float | None, high: float | None) -> str:
    if low is None or high is None:
        return "n/d"
    return f"{format_currency(low)} a {format_currency(high)}"
