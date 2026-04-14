from __future__ import annotations

from datetime import date, timedelta
import unittest

from src.core.history.analytics import compute_product_metrics


class AnalyticsTestCase(unittest.TestCase):
    def test_compute_product_metrics_with_complete_series(self) -> None:
        records = []
        for day in range(35):
            current_date = date(2026, 2, 25) + timedelta(days=day)
            records.append(
                {
                    "product_id": 1,
                    "market_id": 1,
                    "market_name": "Mercado Centro",
                    "preco_total": 10 + day,
                    "coletado_em": f"{current_date.isoformat()}T10:00:00",
                }
            )

        metrics = compute_product_metrics(records)

        self.assertEqual(metrics["current_price"], 44)
        self.assertAlmostEqual(metrics["avg_7"], 41.0)
        self.assertAlmostEqual(metrics["avg_30"], 29.5)
        self.assertEqual(metrics["minimum"], 10)
        self.assertEqual(metrics["maximum"], 44)
        self.assertGreater(metrics["weekly_variation"], 0)
        self.assertGreater(metrics["monthly_variation"], 0)
        self.assertEqual(metrics["trend"]["code"], "alta")
        self.assertFalse(metrics["insufficient_history_7"])
        self.assertFalse(metrics["insufficient_history_30"])


if __name__ == "__main__":
    unittest.main()
