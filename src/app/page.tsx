import Link from "next/link";
import { DashboardMomentumChart } from "@/components/dashboard-momentum-chart";
import { FilterBar } from "@/components/filter-bar";
import { AlertCard, Badge, Button, Hero, KpiCard, Panel, SectionHeader, Shell, SummaryPanel } from "@/components/ui";
import { getDashboardViewModel } from "@/lib/services/price-monitor";

function parseFilters(searchParams: Record<string, string | string[] | undefined>) {
  const getOne = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const parseIntValue = (value?: string) => (value ? Number.parseInt(value, 10) || undefined : undefined);

  return {
    category: getOne("categoria"),
    city: getOne("cidade"),
    marketId: parseIntValue(getOne("mercado")),
    periodDays: parseIntValue(getOne("periodo")) ?? 30,
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const viewModel = await getDashboardViewModel(filters);

  return (
    <Shell>
      <Hero
        title="Monitoramento inteligente de precos"
        eyebrow="Visao executiva"
        description="Um painel para priorizar riscos, capturar oportunidades e identificar rapidamente onde a pressao de preco exige decisao."
        actions={<Button href="/comparacao">Abrir comparacao</Button>}
      />

      <FilterBar
        action="/"
        values={viewModel.filters}
        categories={viewModel.filterOptions.categories}
        cities={viewModel.filterOptions.cities}
        markets={viewModel.filterOptions.markets}
        products={viewModel.filterOptions.products}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Produtos monitorados"
          value={String(viewModel.totals.products)}
          caption="Base ativa neste recorte de filtro."
        />
        <KpiCard
          label="Acima da faixa"
          value={String(viewModel.totals.aboveRange)}
          caption="Itens com pressao acima do intervalo esperado."
          tone="danger"
        />
        <KpiCard
          label="Oportunidades"
          value={String(viewModel.totals.belowRange)}
          caption="Produtos abaixo da faixa esperada."
          tone="success"
        />
        <KpiCard
          label="Mercados no recorte"
          value={String(viewModel.totals.markets)}
          caption={`${viewModel.totals.records} registros sustentam esta leitura.`}
          tone="accent"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr,0.9fr]">
        <SummaryPanel
          title="Cenario atual"
          description="Narrativa automatica para orientar a leitura executiva do painel."
        >
          <div className="grid gap-3">
            {viewModel.narratives.map((line) => (
              <div key={line} className="rounded-[24px] border border-line bg-white/80 px-4 py-3 text-sm leading-6 text-slate-700">
                {line}
              </div>
            ))}
          </div>
          <div className="mt-2">
            <SectionHeader
              title="Mapa de pressao"
              description="Produtos com maior intensidade de movimento no periodo atual."
            />
            <DashboardMomentumChart data={viewModel.heroChart} />
          </div>
        </SummaryPanel>

        <SummaryPanel
          title="Alertas e oportunidades"
          description="Sinais que merecem acao imediata ou acompanhamento mais proximo."
        >
          {viewModel.alerts.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum alerta foi gerado para os filtros atuais.</p>
          ) : (
            <div className="grid gap-3">
              {viewModel.alerts.map((alert) => (
                <AlertCard key={`${alert.title}-${alert.href}`} {...alert} />
              ))}
            </div>
          )}
        </SummaryPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SummaryPanel title="Maiores altas" description="Itens que concentram a maior pressao de alta semanal.">
          {viewModel.highestWeeklyMoves.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum movimento disponivel para os filtros atuais.</p>
          ) : (
            <ul className="grid gap-3">
              {viewModel.highestWeeklyMoves.map((row) => (
                <li key={row.id} className="flex items-center justify-between rounded-[22px] border border-line bg-white/80 px-4 py-3">
                  <div className="space-y-1">
                    <Link href={`/produtos/${row.id}`} className="font-medium">
                      {row.name}
                    </Link>
                    <div className="text-sm text-slate-500">{row.expectedRangeLabel}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="alta">{row.weeklyVariationLabel}</Badge>
                    <Badge tone={row.statusCode}>{row.statusLabel}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SummaryPanel>

        <SummaryPanel title="Maiores quedas" description="Itens com alivio de preco e potencial melhor janela de compra.">
          {viewModel.lowestWeeklyMoves.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum movimento disponivel para os filtros atuais.</p>
          ) : (
            <ul className="grid gap-3">
              {viewModel.lowestWeeklyMoves.map((row) => (
                <li key={row.id} className="flex items-center justify-between rounded-[22px] border border-line bg-white/80 px-4 py-3">
                  <div className="space-y-1">
                    <Link href={`/produtos/${row.id}`} className="font-medium">
                      {row.name}
                    </Link>
                    <div className="text-sm text-slate-500">{row.currentPriceLabel}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="queda">{row.weeklyVariationLabel}</Badge>
                    <Badge tone={row.statusCode}>{row.statusLabel}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SummaryPanel>
      </section>

      <Panel className="overflow-hidden">
        <SectionHeader
          title="Tabela principal"
          description="Painel consolidado para navegar do status geral para a decisao por produto."
          action={<Badge tone="neutral">{viewModel.rows.length} produtos</Badge>}
        />
        {viewModel.rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum produto foi encontrado para os filtros atuais. Ajuste categoria, cidade, mercado ou periodo.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-3 py-4">Produto</th>
                  <th className="px-3 py-4">Categoria</th>
                  <th className="px-3 py-4">Preco atual</th>
                  <th className="px-3 py-4">Faixa esperada</th>
                  <th className="px-3 py-4">Status</th>
                  <th className="px-3 py-4">Tendencia</th>
                  <th className="px-3 py-4">Media 7d</th>
                  <th className="px-3 py-4">Media 30d</th>
                  <th className="px-3 py-4">Var. semanal</th>
                </tr>
              </thead>
              <tbody>
                {viewModel.rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/70 bg-white/30 transition hover:bg-white/70">
                    <td className="px-3 py-4">
                      <div className="space-y-1">
                        <Link href={`/produtos/${row.id}`} className="font-medium">
                          {row.name}
                        </Link>
                        <div className="text-xs text-slate-500">Faixa {row.expectedRangeLabel}</div>
                      </div>
                    </td>
                    <td className="px-3 py-4">{row.category}</td>
                    <td className="px-3 py-4">{row.currentPriceLabel}</td>
                    <td className="px-3 py-4">{row.expectedRangeLabel}</td>
                    <td className="px-3 py-4">
                      <Badge tone={row.statusCode}>{row.statusLabel}</Badge>
                    </td>
                    <td className="px-3 py-4">
                      <Badge tone={row.trendLabel.toLowerCase() === "alta" ? "alta" : row.trendLabel.toLowerCase() === "queda" ? "queda" : "estavel"}>
                        {row.trendLabel}
                      </Badge>
                    </td>
                    <td className="px-3 py-4">{row.avg7Label}</td>
                    <td className="px-3 py-4">{row.avg30Label}</td>
                    <td className="px-3 py-4">
                      <Badge tone={(row.weeklyVariation ?? 0) >= 0 ? "alta" : "queda"}>{row.weeklyVariationLabel}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Shell>
  );
}
