from __future__ import annotations

import unittest

from src.interfaces.web.app import application


class WebAppTestCase(unittest.TestCase):
    def render(self, path: str) -> tuple[str, str]:
        captured: dict[str, object] = {}

        def start_response(status: str, headers: list[tuple[str, str]]) -> None:
            captured["status"] = status
            captured["headers"] = headers

        response = application({"PATH_INFO": path, "QUERY_STRING": ""}, start_response)
        body = b"".join(response).decode("utf-8")
        return captured["status"], body

    def test_dashboard_renders(self) -> None:
        status, body = self.render("/")
        self.assertEqual(status, "200 OK")
        self.assertIn("Monitoramento inteligente de precos", body)

    def test_product_page_renders(self) -> None:
        status, body = self.render("/produtos/1")
        self.assertEqual(status, "200 OK")
        self.assertIn("Resumo analitico", body)

    def test_comparison_page_renders(self) -> None:
        status, body = self.render("/comparacao")
        self.assertEqual(status, "200 OK")
        self.assertIn("Comparacao por mercado", body)


if __name__ == "__main__":
    unittest.main()
