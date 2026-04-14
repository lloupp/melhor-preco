from __future__ import annotations

from html import escape
from typing import Callable
from urllib.parse import parse_qs
from wsgiref.simple_server import make_server

from src.core.history.analytics import format_currency, format_percentage, format_price_range
from src.core.history.service import (
    get_comparison_view_model,
    get_dashboard_view_model,
    get_product_view_model,
)
from src.infra.db.database import bootstrap_database


def application(environ: dict, start_response: Callable) -> list[bytes]:
    connection = bootstrap_database()
    try:
        path = environ.get("PATH_INFO", "/")
        query_params = parse_qs(environ.get("QUERY_STRING", ""))
        filters = parse_filters(query_params)

        if path == "/":
            body = render_dashboard(get_dashboard_view_model(connection, filters))
            return respond(start_response, "200 OK", body)

        if path == "/comparacao":
            body = render_comparison(get_comparison_view_model(connection, filters))
            return respond(start_response, "200 OK", body)

        if path.startswith("/produtos/"):
            try:
                product_id = int(path.rsplit("/", 1)[-1])
            except ValueError:
                return respond(start_response, "404 Not Found", render_not_found("Produto invalido"))

            view_model = get_product_view_model(connection, product_id, filters)
            if not view_model:
                return respond(start_response, "404 Not Found", render_not_found("Produto nao encontrado"))
            return respond(start_response, "200 OK", render_product(view_model))

        if path == "/healthz":
            return respond(start_response, "200 OK", "ok", content_type="text/plain; charset=utf-8")

        return respond(start_response, "404 Not Found", render_not_found("Pagina nao encontrada"))
    finally:
        connection.close()


def respond(start_response: Callable, status: str, body: str, content_type: str = "text/html; charset=utf-8") -> list[bytes]:
    payload = body.encode("utf-8")
    start_response(status, [("Content-Type", content_type), ("Content-Length", str(len(payload)))])
    return [payload]


def parse_filters(query_params: dict[str, list[str]]) -> dict[str, int | str | None]:
    return {
        "category": first_value(query_params, "categoria"),
        "city": first_value(query_params, "cidade"),
        "market_id": parse_int(first_value(query_params, "mercado")),
        "period_days": parse_int(first_value(query_params, "periodo")) or 30,
        "product_id": parse_int(first_value(query_params, "produto_id")),
    }


def first_value(query_params: dict[str, list[str]], key: str) -> str | None:
    values = query_params.get(key)
    if not values:
        return None
    value = values[0].strip()
    return value or None


def parse_int(value: str | None) -> int | None:
    try:
        return int(value) if value else None
    except ValueError:
        return None


def render_dashboard(view_model: dict) -> str:
    totals = view_model["totals"]
    body = f"""
    <section class="hero">
      <div>
        <h1>Monitoramento inteligente de precos</h1>
        <p>Indicadores do banco real com medias moveis, faixa esperada e variacao recente.</p>
      </div>
      <div class="hero-actions">
        <a class="button" href="/comparacao">Abrir comparacao</a>
      </div>
    </section>
    {render_filters(view_model["filter_options"], view_model["filters"], action="/")}
    <section class="kpis">
      {render_kpi("Produtos monitorados", str(totals["products"]))}
      {render_kpi("Mercados no recorte", str(totals["markets"]))}
      {render_kpi("Registros usados", str(totals["records"]))}
      {render_kpi("Acima da faixa", str(totals["above_range"]))}
      {render_kpi("Abaixo da faixa", str(totals["below_range"]))}
      {render_kpi("Dentro da faixa", str(totals["within_range"]))}
    </section>
    <section class="two-column">
      <div class="panel">
        <h2>Maiores altas da semana</h2>
        {render_move_list(view_model["highest_weekly_moves"])}
      </div>
      <div class="panel">
        <h2>Maiores quedas da semana</h2>
        {render_move_list(view_model["lowest_weekly_moves"])}
      </div>
    </section>
    <section class="panel">
      <h2>Produtos monitorados</h2>
      {render_dashboard_table(view_model["rows"])}
    </section>
    """
    return render_page("Dashboard", body, view_model["filters"])


def render_product(view_model: dict) -> str:
    product = view_model["product"]
    metrics = view_model["metrics"]
    body = f"""
    <section class="hero">
      <div>
        <a class="back-link" href="/">Voltar ao dashboard</a>
        <h1>{escape(product["nome"])}</h1>
        <p>{escape(product["descricao"] or "")}</p>
      </div>
      <div class="hero-meta">
        <span class="badge neutral">{escape(product["categoria"].title())}</span>
        <span class="badge {metrics['status']['code']}">{escape(metrics['status']['label'])}</span>
        <span class="badge neutral">{escape(metrics['trend']['label'])}</span>
      </div>
    </section>
    {render_filters(view_model["filter_options"], view_model["filters"], action=f"/produtos/{product['id']}", include_product=False)}
    <section class="kpis">
      {render_kpi("Preco atual", format_currency(metrics["current_price"]))}
      {render_kpi("Faixa esperada", format_price_range(metrics["expected_range"]["low"], metrics["expected_range"]["high"]))}
      {render_kpi("Media 7 dias", format_currency(metrics["avg_7"]))}
      {render_kpi("Media 30 dias", format_currency(metrics["avg_30"]))}
      {render_kpi("Minima", format_currency(metrics["minimum"]))}
      {render_kpi("Maxima", format_currency(metrics["maximum"]))}
      {render_kpi("Variacao semanal", format_percentage(metrics["weekly_variation"]))}
      {render_kpi("Variacao mensal", format_percentage(metrics["monthly_variation"]))}
    </section>
    <section class="two-column">
      <div class="panel">
        <h2>Historico</h2>
        {render_chart(view_model["chart_points"])}
        {render_history_notice(metrics)}
      </div>
      <div class="panel">
        <h2>Resumo analitico</h2>
        <p class="summary">{escape(view_model["summary"])}</p>
        <h3>Mercados no ultimo registro</h3>
        {render_market_snapshot(view_model["market_snapshot"])}
      </div>
    </section>
    <section class="panel">
      <h2>Motivos recentes do movimento</h2>
      {render_factors(view_model["factors"])}
    </section>
    """
    return render_page(product["nome"], body, view_model["filters"])


def render_comparison(view_model: dict) -> str:
    selected_name = view_model["selected_product"]["nome"] if view_model["selected_product"] else "Selecione um produto"
    body = f"""
    <section class="hero">
      <div>
        <a class="back-link" href="/">Voltar ao dashboard</a>
        <h1>Comparacao por mercado</h1>
        <p>Comparativo real do produto <strong>{escape(selected_name)}</strong> ordenado do menor para o maior preco total.</p>
      </div>
    </section>
    {render_filters(view_model["filter_options"], view_model["filters"], action="/comparacao", include_market=True, include_product=True)}
    <section class="panel">
      <h2>Ofertas atuais</h2>
      {render_comparison_table(view_model["offers"])}
    </section>
    """
    return render_page("Comparacao", body, view_model["filters"])


def render_page(title: str, body: str, filters: dict) -> str:
    return f"""
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>{escape(title)} | Melhor Preco</title>
        <style>
          {BASE_CSS}
        </style>
      </head>
      <body>
        <nav class="topbar">
          <a href="/">Dashboard</a>
          <a href="/comparacao?periodo={filters.get('period_days', 30)}">Comparacao</a>
        </nav>
        <main class="shell">
          {body}
        </main>
      </body>
    </html>
    """


def render_filters(
    filter_options: dict,
    filters: dict,
    action: str,
    include_market: bool = True,
    include_product: bool = False,
) -> str:
    controls = [
        render_select("categoria", "Categoria", filter_options["categories"], filters.get("category")),
        render_select("cidade", "Cidade", filter_options["cities"], filters.get("city")),
        render_select(
            "periodo",
            "Periodo",
            [{"value": 7, "label": "7 dias"}, {"value": 30, "label": "30 dias"}, {"value": 45, "label": "45 dias"}],
            filters.get("period_days"),
        ),
    ]

    if include_market:
        controls.append(render_select("mercado", "Mercado", filter_options["markets"], filters.get("market_id")))
    if include_product:
        controls.append(render_select("produto_id", "Produto", filter_options["products"], filters.get("product_id")))

    return f"""
    <form class="filters panel" method="get" action="{escape(action)}">
      {''.join(controls)}
      <div class="filter-actions">
        <button class="button" type="submit">Aplicar filtros</button>
        <a class="button secondary" href="{escape(action)}">Limpar</a>
      </div>
    </form>
    """


def render_select(name: str, label: str, options: list[dict], current_value: object) -> str:
    values = ['<option value="">Todos</option>']
    for option in options:
        selected = " selected" if str(option["value"]) == str(current_value) else ""
        values.append(
            f'<option value="{escape(str(option["value"]))}"{selected}>{escape(str(option["label"]))}</option>'
        )
    return f"""
    <label>
      <span>{escape(label)}</span>
      <select name="{escape(name)}">
        {''.join(values)}
      </select>
    </label>
    """


def render_kpi(label: str, value: str) -> str:
    return f"""
    <article class="kpi">
      <span>{escape(label)}</span>
      <strong>{escape(value)}</strong>
    </article>
    """


def render_move_list(rows: list[dict]) -> str:
    if not rows:
        return '<p class="empty">Nenhum movimento disponivel para os filtros atuais.</p>'
    items = []
    for row in rows:
        items.append(
            f"""
            <li>
              <a href="/produtos/{row['id']}">{escape(row['name'])}</a>
              <span>{escape(row['weekly_variation_label'])}</span>
            </li>
            """
        )
    return f'<ul class="move-list">{"".join(items)}</ul>'


def render_dashboard_table(rows: list[dict]) -> str:
    if not rows:
        return '<p class="empty">Nenhum produto encontrado no banco para esse recorte.</p>'
    body_rows = []
    for row in rows:
        body_rows.append(
            f"""
            <tr>
              <td><a href="/produtos/{row['id']}">{escape(row['name'])}</a></td>
              <td>{escape(row['category'])}</td>
              <td>{escape(row['current_price_label'])}</td>
              <td>{escape(row['expected_range_label'])}</td>
              <td><span class="badge {row['status_code']}">{escape(row['status_label'])}</span></td>
              <td>{escape(row['trend_label'])}</td>
              <td>{escape(row['avg_7_label'])}</td>
              <td>{escape(row['avg_30_label'])}</td>
              <td>{escape(row['weekly_variation_label'])}</td>
            </tr>
            """
        )
    return f"""
    <table>
      <thead>
        <tr>
          <th>Produto</th>
          <th>Categoria</th>
          <th>Preco atual</th>
          <th>Faixa esperada</th>
          <th>Status</th>
          <th>Tendencia</th>
          <th>Media 7d</th>
          <th>Media 30d</th>
          <th>Var. semanal</th>
        </tr>
      </thead>
      <tbody>
        {''.join(body_rows)}
      </tbody>
    </table>
    """


def render_market_snapshot(snapshot: list[dict]) -> str:
    if not snapshot:
        return '<p class="empty">Nenhum mercado disponivel para este produto.</p>'
    items = []
    for item in snapshot:
        items.append(
            f"""
            <li>
              <strong>{escape(item['market_name'])}</strong>
              <span>{escape(item['city'])}</span>
              <span>{escape(item['total_label'])}</span>
              <small>Produto {escape(item['price_label'])} + frete {escape(item['freight_label'])}</small>
            </li>
            """
        )
    return f'<ul class="snapshot-list">{"".join(items)}</ul>'


def render_factors(factors: list[dict]) -> str:
    if not factors:
        return '<p class="empty">Nenhum fator recente foi registrado para este recorte.</p>'
    cards = []
    for factor in factors:
        cards.append(
            f"""
            <article class="factor-card">
              <header>
                <strong>{escape(factor['titulo'])}</strong>
                <span class="badge {escape(factor['direcao'])}">{escape(factor['impact_label'])}</span>
              </header>
              <p>{escape(factor['descricao'])}</p>
              <footer>{escape(factor['market_name'])} em {escape(factor['city'])} · {escape(factor['coletado_em'][:10])}</footer>
            </article>
            """
        )
    return f'<div class="factor-grid">{"".join(cards)}</div>'


def render_comparison_table(offers: list[dict]) -> str:
    if not offers:
        return '<p class="empty">Nao ha ofertas para comparar com os filtros atuais.</p>'
    rows = []
    for offer in offers:
        tags = []
        if offer.get("best_opportunity"):
            tags.append('<span class="badge best">Melhor oportunidade</span>')
        if offer["status_code"] != "dentro_faixa":
            tags.append(f'<span class="badge {offer["status_code"]}">{escape(offer["status_label"])}</span>')

        rows.append(
            f"""
            <tr class="{'best-row' if offer.get('best_opportunity') else ''}">
              <td>{escape(offer['market_name'])}<div class="muted">{escape(offer['city'])}</div></td>
              <td>{format_currency(offer['price'])}</td>
              <td>{format_currency(offer['freight'])}</td>
              <td><strong>{format_currency(offer['total'])}</strong></td>
              <td>{''.join(tags) or '<span class="badge neutral">Preco regular</span>'}</td>
            </tr>
            """
        )
    return f"""
    <table>
      <thead>
        <tr>
          <th>Mercado</th>
          <th>Preco</th>
          <th>Frete</th>
          <th>Preco total</th>
          <th>Destaques</th>
        </tr>
      </thead>
      <tbody>
        {''.join(rows)}
      </tbody>
    </table>
    """


def render_history_notice(metrics: dict) -> str:
    notices = []
    if metrics["insufficient_history_7"]:
        notices.append("Media de 7 dias calculada com janela incompleta.")
    if metrics["insufficient_history_30"]:
        notices.append("Media de 30 dias calculada com janela incompleta.")
    if not notices:
        return ""
    return f'<p class="empty">{" ".join(notices)}</p>'


def render_chart(points: list[dict]) -> str:
    if len(points) < 2:
        return '<p class="empty">Historico insuficiente para desenhar o grafico.</p>'

    values = [point["value"] for point in points]
    min_value = min(values)
    max_value = max(values)
    spread = max(max_value - min_value, 1)
    coordinates = []

    for index, point in enumerate(points):
        x = 20 + (560 * index / max(len(points) - 1, 1))
        y = 180 - ((point["value"] - min_value) / spread) * 140
        coordinates.append(f"{x:.1f},{y:.1f}")

    labels = "".join(
        f'<text x="{20 + (560 * index / max(len(points) - 1, 1)):.1f}" y="198" class="chart-label">{escape(point["label"])}</text>'
        for index, point in enumerate(points[:: max(len(points) // 6, 1)])
    )

    return f"""
    <svg viewBox="0 0 600 210" class="chart" role="img" aria-label="Grafico historico de preco">
      <line x1="20" y1="180" x2="580" y2="180" class="chart-axis" />
      <polyline fill="none" stroke="currentColor" stroke-width="3" points="{' '.join(coordinates)}" />
      {labels}
    </svg>
    """


def render_not_found(message: str) -> str:
    body = f"""
    <section class="hero">
      <div>
        <h1>404</h1>
        <p>{escape(message)}</p>
      </div>
    </section>
    """
    return render_page("Nao encontrado", body, {"period_days": 30})


BASE_CSS = """
:root {
  color-scheme: light;
  --bg: #f5f1e8;
  --paper: #fffaf0;
  --ink: #1d2a2f;
  --muted: #5b6b73;
  --line: #d7cec1;
  --accent: #0d7a67;
  --danger: #c4552d;
  --warning: #d08a11;
  --success: #2d7e3f;
  --shadow: 0 18px 45px rgba(39, 52, 59, 0.08);
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; background: radial-gradient(circle at top, #f8e5c9, var(--bg)); color: var(--ink); }
a { color: inherit; }
.topbar { display: flex; gap: 16px; padding: 16px 24px; border-bottom: 1px solid var(--line); background: rgba(255, 250, 240, 0.88); position: sticky; top: 0; backdrop-filter: blur(10px); }
.shell { max-width: 1180px; margin: 0 auto; padding: 24px; display: grid; gap: 24px; }
.hero, .panel, .kpi, .filters { background: var(--paper); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); }
.hero { padding: 28px; display: flex; justify-content: space-between; gap: 16px; align-items: start; }
.hero h1 { margin: 0 0 8px; font-size: 2.2rem; line-height: 1; }
.hero p, .summary { margin: 0; color: var(--muted); line-height: 1.5; }
.hero-meta, .hero-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.button { display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; border-radius: 999px; background: var(--accent); color: #fff; text-decoration: none; border: none; cursor: pointer; }
.button.secondary { background: transparent; color: var(--ink); border: 1px solid var(--line); }
.filters { padding: 18px; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
.filters label { display: grid; gap: 6px; color: var(--muted); font-size: 0.92rem; }
.filters select { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; background: #fff; }
.filter-actions { display: flex; align-items: end; gap: 10px; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
.kpi { padding: 18px; display: grid; gap: 8px; }
.kpi span { color: var(--muted); font-size: 0.92rem; }
.kpi strong { font-size: 1.45rem; }
.two-column { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
.panel { padding: 20px; overflow: auto; }
.panel h2, .panel h3 { margin-top: 0; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 14px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--muted); font-size: 0.88rem; text-transform: uppercase; letter-spacing: 0.04em; }
.badge { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 6px 10px; font-size: 0.84rem; font-weight: 700; }
.badge.neutral { background: #ebe5d6; color: var(--ink); }
.badge.acima_faixa, .badge.alta { background: #fae0d8; color: var(--danger); }
.badge.abaixo_faixa, .badge.queda { background: #e3f1e6; color: var(--success); }
.badge.dentro_faixa, .badge.best, .badge.neutro { background: #dff2ed; color: var(--accent); }
.move-list, .snapshot-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
.move-list li, .snapshot-list li { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.snapshot-list small, .muted, .back-link, .empty, footer { color: var(--muted); }
.snapshot-list li { flex-direction: column; align-items: flex-start; }
.factor-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.factor-card { border: 1px solid var(--line); border-radius: 16px; padding: 16px; background: #fff; display: grid; gap: 12px; }
.factor-card header { display: flex; justify-content: space-between; gap: 10px; align-items: start; }
.chart { width: 100%; min-height: 210px; color: var(--accent); }
.chart-axis { stroke: var(--line); stroke-width: 1; }
.chart-label { fill: var(--muted); font-size: 9px; text-anchor: middle; }
.best-row { background: #f3fbf8; }
@media (max-width: 720px) {
  .shell { padding: 16px; }
  .hero { padding: 20px; }
  .hero h1 { font-size: 1.8rem; }
}
"""


if __name__ == "__main__":
    server = make_server("127.0.0.1", 8000, application)
    print("Servidor em http://127.0.0.1:8000")
    server.serve_forever()
