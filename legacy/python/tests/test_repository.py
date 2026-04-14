from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from src.infra.db.database import bootstrap_database
from src.infra.db.repository import fetch_market_factors, fetch_price_records, list_products


class RepositoryTestCase(unittest.TestCase):
    def test_bootstrap_creates_seeded_database(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            connection = bootstrap_database(Path(tmp_dir) / "app.sqlite3")
            try:
                products = list_products(connection)
                records = fetch_price_records(connection)
                factors = fetch_market_factors(connection, product_id=products[0]["id"])
            finally:
                connection.close()

        self.assertGreaterEqual(len(products), 6)
        self.assertGreaterEqual(len(records), 45 * 6 * 4)
        self.assertGreaterEqual(len(factors), 1)


if __name__ == "__main__":
    unittest.main()
