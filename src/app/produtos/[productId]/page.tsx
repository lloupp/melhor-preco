import Link from "next/link";
import { notFound } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";
import { PriceHistoryChart } from "@/components/price-history-chart";
import { Badge, Hero, MetricTile, SectionHeader, Shell, SummaryPanel } from "@/components/ui";
import { formatCurrency, formatPriceRange, formatPercentage } from "@/lib/domain/format";
import { getProductViewModel } from "@/lib/services/price-monitor";

function parseFilters(searchParams: Record<string, string | string[] | undefined>) {
  const getOne = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const parseIntValue = (value?: string) => (value ? Number.parseInt(value, 10) || undefined : undefined);

  return {
    city: getOne("cidade"),
    marketId: parseIntValue(getOne("mercado")),
    periodDays: parseIntValue(getOne("periodo")) ?? 30,
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { productId } = await params;
  const viewModel = await getProductViewModel(Number(productId), parseFilters(await searchParams));
  if (!viewModel) notFound();

  const { product, metrics } = viewModel;

  return (
    <Shell>
      <Hero
        title={product.name}
        eyebrow="Visao analitica do produto"
        description={
          <div className="space-y-2">
            <Link href="/" className="text-sm text-slate-500">
              Voltar ao dashboard
            </Link>
            <p>{product.description ?? ""}</p>
          </div>
        }
        meta={
          <>
            <Badge tone="neutral">{product.category}</Badge>
            <Badge tone={metrics.status.code}>{metrics.status.label}</Badge>
            <Badge tone={metrics.trend.code}>{metrics.trend.label}</Badge>
          </>
        }
      />

      <FilterBar
        action={`/produtos/${product.id}`}
        values={viewModel.filters}
        categories={viewModel.filterOptions.categories}
        cities={viewModel.filterOptions.cities}
        markets={viewModel.filterOptions.markets}
        products={viewModel.filterOptions.products}
        includeProduct={false}
      />

      <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <SummaryPanel title="Visao geral" description="Posicao atual do produto em relacao ao historico e ao intervalo esperado.">
          <div className="grid gap-4 md:grid-cols-2">
            <MetricTile
              label="Preco atual"
              value={formatCurrency(metrics.currentPrice)}
              supporting={<Badge tone={metrics.status.code}>{metrics.status.label}</Badge>}
            />
            <MetricTile
              label="Tendencia"
              value={metrics.trend.label}
              supporting={<Badge tone={metrics.trend.code === "alta" ? "alta" : metrics.trend.code === "queda" ? "queda" : "estavel"}>{metrics.trend.label}</Badge>}
            />
            <MetricTile label="Faixa esperada" value={formatPriceRange(metrics.expectedRange.low, metrics.expectedRange.high)} />
            <MetricTile label="Mercado lider" value={metrics.currentMarketName ?? "n/d"} supporting="Menor preco observado no ultimo dia do recorte." />
          </div>
        </SummaryPanel>

        <SummaryPanel title={viewModel.statusHighlight.title} description={viewModel.statusHighlight.description}>
          <div className="grid gap-4 md:grid-cols-2">
            <MetricTile label="Media 7 dias" value={formatCurrency(metrics.avg7)} />
            <MetricTile label="Media 30 dias" value={formatCurrency(metrics.avg30)} />
            <MetricTile label="Variacao semanal" value={formatPercentage(metrics.weeklyVariation)} />
            <MetricTile label="Variacao mensal" value={formatPercentage(metrics.monthlyVariation)} />
          </div>
        </SummaryPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr,1fr]">
        <SummaryPanel title="Historico e metricas" description="Leitura temporal do menor preco diario observado entre os mercados filtrados.">
          <div className="grid gap-4 md:grid-cols-2">
            <MetricTile label="Minima" value={formatCurrency(metrics.minimum)} />
            <MetricTile label="Maxima" value={formatCurrency(metrics.maximum)} />
          </div>
          <PriceHistoryChart points={viewModel.chartPoints} />
          {(metrics.insufficientHistory7 || metrics.insufficientHistory30) && (
            <p className="mt-3 text-sm text-slate-500">
              {metrics.insufficientHistory7 ? "Media de 7 dias calculada com janela incompleta. " : ""}
              {metrics.insufficientHistory30 ? "Media de 30 dias calculada com janela incompleta." : ""}
            </p>
          )}
        </SummaryPanel>

        <SummaryPanel title="Resumo analitico" description="Leitura automatica pensada para decisao rapida sem perder contexto.">
          <div>
            <p className="rounded-[24px] border border-line bg-white/80 p-4 text-sm leading-7 text-slate-700">{viewModel.summary}</p>
          </div>
          <div>
            <SectionHeader title="Mercados no ultimo registro" description="Ranking instantaneo do melhor para o pior preco total." />
            {viewModel.marketSnapshot.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum mercado disponivel para este produto.</p>
            ) : (
              <ul className="grid gap-3">
                {viewModel.marketSnapshot.map((item, index) => (
                  <li key={`${item.marketName}-${item.city}`} className="rounded-2xl border border-line bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <strong>{item.marketName}</strong>
                        <div className="text-sm text-slate-500">{item.city}</div>
                      </div>
                      {index === 0 ? <Badge tone="best">Melhor oferta</Badge> : null}
                    </div>
                    <div className="mt-2 text-sm font-semibold">{item.totalLabel}</div>
                    <div className="text-xs text-slate-500">
                      Produto {item.priceLabel} + frete {item.freightLabel}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SummaryPanel>
      </section>

      <SummaryPanel
        title="Motivos recentes do movimento"
        description="Fatores qualitativos que ajudam a explicar o deslocamento de preco no periodo."
      >
        {viewModel.factors.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum fator recente foi registrado para este recorte.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {viewModel.factors.map((factor) => (
              <article key={factor.id} className="rounded-3xl border border-line bg-white p-5 shadow-sm">
                <header className="mb-3 flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <strong>{factor.title}</strong>
                    <div>
                      <Badge tone={factor.direction}>{factor.reasonLabel}</Badge>
                    </div>
                  </div>
                  <Badge tone={factor.direction}>{factor.impactLabel}</Badge>
                </header>
                <p className="text-sm leading-6 text-slate-600">{factor.description}</p>
                <footer className="mt-3 text-xs text-slate-500">
                  {factor.marketName} em {factor.city} · {factor.collectedAt.toISOString().slice(0, 10)}
                </footer>
              </article>
            ))}
          </div>
        )}
      </SummaryPanel>
    </Shell>
  );
}
