from __future__ import annotations

import math
import sqlite3
from datetime import date, datetime, time, timedelta


PRODUCTS = [
    {
        "id": 1,
        "nome": "Arroz Tipo 1 5kg",
        "categoria": "mercearia",
        "unidade": "pacote",
        "descricao": "Pacote de arroz branco tipo 1 com 5kg.",
        "base": 31.90,
        "amplitude": 0.8,
        "trend": 0.015,
    },
    {
        "id": 2,
        "nome": "Cafe Torrado e Moido 500g",
        "categoria": "mercearia",
        "unidade": "pacote",
        "descricao": "Cafe tradicional embalado a vacuo com 500g.",
        "base": 18.50,
        "amplitude": 0.9,
        "trend": 0.055,
    },
    {
        "id": 3,
        "nome": "Leite Integral 1L",
        "categoria": "mercearia",
        "unidade": "caixa",
        "descricao": "Leite integral UHT em embalagem de 1 litro.",
        "base": 5.60,
        "amplitude": 0.25,
        "trend": -0.02,
    },
    {
        "id": 4,
        "nome": "Azeite Extra Virgem 500ml",
        "categoria": "mercearia",
        "unidade": "garrafa",
        "descricao": "Azeite extra virgem importado com 500ml.",
        "base": 36.90,
        "amplitude": 1.2,
        "trend": 0.03,
    },
    {
        "id": 5,
        "nome": "Whey Protein Concentrado 900g",
        "categoria": "suplementos",
        "unidade": "pote",
        "descricao": "Whey concentrado sabor baunilha com 900g.",
        "base": 119.90,
        "amplitude": 3.5,
        "trend": -0.04,
    },
    {
        "id": 6,
        "nome": "Creatina Monohidratada 300g",
        "categoria": "suplementos",
        "unidade": "pote",
        "descricao": "Creatina monohidratada micronizada com 300g.",
        "base": 84.90,
        "amplitude": 2.4,
        "trend": 0.02,
    },
]


MARKETS = [
    {
        "id": 1,
        "nome": "Mercado Centro",
        "cidade": "Sao Paulo",
        "estado": "SP",
        "canal": "supermercado",
        "price_factor": 1.00,
        "freight_factor": 1.00,
    },
    {
        "id": 2,
        "nome": "Atacado Mooca",
        "cidade": "Sao Paulo",
        "estado": "SP",
        "canal": "atacado",
        "price_factor": 0.96,
        "freight_factor": 1.15,
    },
    {
        "id": 3,
        "nome": "Super Campinas",
        "cidade": "Campinas",
        "estado": "SP",
        "canal": "supermercado",
        "price_factor": 1.03,
        "freight_factor": 1.05,
    },
    {
        "id": 4,
        "nome": "Clube Saudavel",
        "cidade": "Santos",
        "estado": "SP",
        "canal": "especializado",
        "price_factor": 1.04,
        "freight_factor": 0.92,
    },
]


FACTOR_TEMPLATES = [
    {
        "titulo": "Promocao de encarte",
        "descricao": "Desconto temporario aplicado pelo mercado no fechamento da semana.",
        "direcao": "queda",
        "intensidade": 4,
    },
    {
        "titulo": "Reajuste de fornecedor",
        "descricao": "Fornecedor repassou custo acima da media no ultimo abastecimento.",
        "direcao": "alta",
        "intensidade": 4,
    },
    {
        "titulo": "Frete regional",
        "descricao": "Custo logistico variou por distancia e consolidacao de rotas.",
        "direcao": "alta",
        "intensidade": 2,
    },
    {
        "titulo": "Giro de estoque",
        "descricao": "Mercado acelerou a saida de itens com estoque mais antigo.",
        "direcao": "queda",
        "intensidade": 3,
    },
    {
        "titulo": "Demanda local",
        "descricao": "Consumo regional alterou o ritmo de reposicao do item.",
        "direcao": "neutro",
        "intensidade": 2,
    },
]


def seed_database(connection: sqlite3.Connection) -> None:
    reference_date = date.today()
    _seed_products(connection)
    _seed_markets(connection)
    _seed_price_records(connection, reference_date)
    _seed_market_factors(connection, reference_date)
    connection.commit()


def _seed_products(connection: sqlite3.Connection) -> None:
    connection.executemany(
        """
        INSERT INTO products (id, nome, categoria, unidade, descricao)
        VALUES (:id, :nome, :categoria, :unidade, :descricao)
        """,
        PRODUCTS,
    )


def _seed_markets(connection: sqlite3.Connection) -> None:
    connection.executemany(
        """
        INSERT INTO markets (id, nome, cidade, estado, canal)
        VALUES (:id, :nome, :cidade, :estado, :canal)
        """,
        MARKETS,
    )


def _seed_price_records(connection: sqlite3.Connection, reference_date: date) -> None:
    records = []
    for day_offset in range(45):
        current_date = reference_date - timedelta(days=44 - day_offset)
        for product in PRODUCTS:
            for market in MARKETS:
                price, freight = _compute_price(product, market, day_offset)
                recorded_at = datetime.combine(current_date, time(hour=9 + market["id"])).isoformat()
                records.append(
                    {
                        "product_id": product["id"],
                        "market_id": market["id"],
                        "preco": round(price, 2),
                        "frete": round(freight, 2),
                        "preco_total": round(price + freight, 2),
                        "coletado_em": recorded_at,
                    }
                )

    connection.executemany(
        """
        INSERT INTO price_records (
          product_id,
          market_id,
          preco,
          frete,
          preco_total,
          coletado_em
        )
        VALUES (
          :product_id,
          :market_id,
          :preco,
          :frete,
          :preco_total,
          :coletado_em
        )
        """,
        records,
    )


def _seed_market_factors(connection: sqlite3.Connection, reference_date: date) -> None:
    records = []
    for product in PRODUCTS:
        for market in MARKETS:
            for index in range(4):
                template = FACTOR_TEMPLATES[(product["id"] + market["id"] + index) % len(FACTOR_TEMPLATES)]
                collected_date = reference_date - timedelta(days=index * 5 + market["id"])
                collected_at = datetime.combine(collected_date, time(hour=7 + index)).isoformat()
                records.append(
                    {
                        "product_id": product["id"],
                        "market_id": market["id"],
                        "titulo": template["titulo"],
                        "descricao": template["descricao"],
                        "direcao": template["direcao"],
                        "intensidade": template["intensidade"],
                        "coletado_em": collected_at,
                    }
                )

    connection.executemany(
        """
        INSERT INTO market_factors (
          product_id,
          market_id,
          titulo,
          descricao,
          direcao,
          intensidade,
          coletado_em
        )
        VALUES (
          :product_id,
          :market_id,
          :titulo,
          :descricao,
          :direcao,
          :intensidade,
          :coletado_em
        )
        """,
        records,
    )


def _compute_price(product: dict[str, float | int | str], market: dict[str, float | int | str], day_offset: int) -> tuple[float, float]:
    base_price = float(product["base"])
    amplitude = float(product["amplitude"])
    trend = float(product["trend"])
    market_factor = float(market["price_factor"])
    freight_factor = float(market["freight_factor"])

    seasonality = math.sin((day_offset + int(product["id"]) * 2 + int(market["id"])) / 4.1) * amplitude
    long_term = base_price * trend * (day_offset / 44)
    pulse = ((day_offset + int(product["id"]) + int(market["id"])) % 6 - 2.5) * 0.23

    price = (base_price + seasonality + long_term + pulse) * market_factor
    freight = max(0.0, 3.4 + int(product["id"]) * 0.28 + int(market["id"]) * 0.22)

    if str(product["categoria"]) == "suplementos":
        freight += 1.75

    if str(market["canal"]) == "atacado":
        freight += 0.65

    freight *= freight_factor
    return max(price, 0.5), freight
