import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { Badge, Hero, KpiCard, SectionHeader, Shell, SummaryPanel } from "@/components/ui";
import { formatCurrency } from "@/lib/domain/format";
import { getComparisonViewModel } from "@/lib/services/price-monitor";

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
    productId: parseIntValue(getOne("produto_id")),
  };
}

export default async function ComparisonPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewModel = await getComparisonViewModel(parseFilters(await searchParams));

  return (
    <Shell>
      <Hero
        title="Comparacao por mercado"
        eyebrow="Ferramenta de decisao"
        description={
          <div className="space-y-2">
            <Link href="/" className="text-sm text-slate-500">
              Voltar ao dashboard
            </Link>
            <p>
              Comparativo real do produto <strong>{viewModel.selectedProduct?.name ?? "selecionado"}</strong> ordenado do
              menor para o maior preco total.
            </p>
            <p className="text-sm text-slate-500">{viewModel.comparisonContext}</p>
          </div>
        }
        meta={viewModel.selectedProduct ? <Badge tone="neutral">{viewModel.selectedProduct.category}</Badge> : undefined}
      />

      <FilterBar
        action="/comparacao"
        values={viewModel.filters}
        categories={viewModel.filterOptions.categories}
        cities={viewModel.filterOptions.cities}
        markets={viewModel.filterOptions.markets}
        products={viewModel.filterOptions.products}
        includeProduct
      />

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard
          label="Melhor oportunidade"
          value={viewModel.offers[0] ? formatCurrency(viewModel.offers[0].total) : "n/d"}
          caption={viewModel.offers[0] ? `${viewModel.offers[0].marketName} lidera o ranking atual.` : "Sem oferta no recorte."}
          tone="success"
        />
        <KpiCard
          label="Maior preco"
          value={viewModel.offers.at(-1) ? formatCurrency(viewModel.offers.at(-1)?.total) : "n/d"}
          caption={viewModel.offers.at(-1) ? `${viewModel.offers.at(-1)?.marketName} esta no topo do custo.` : "Sem oferta no recorte."}
          tone="danger"
        />
        <KpiCard
          label="Mercados comparados"
          value={String(viewModel.offers.length)}
          caption="Comparativo consolidado para leitura rapida."
          tone="accent"
        />
      </section>

      <SummaryPanel
        title="Ofertas atuais"
        description="Tabela comparativa com destaque para a melhor oportunidade, o maior preco e sinais fora da faixa."
      >
        <SectionHeader
          title="Ranking por preco total"
          description="Use esta visao para decidir rapidamente onde comprar ou quais mercados exigem revisao."
        />
        {viewModel.offers.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nao ha ofertas para comparar com os filtros atuais. Tente ampliar o periodo ou remover parte dos filtros.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-3 py-4">Mercado</th>
                  <th className="px-3 py-4">Preco</th>
                  <th className="px-3 py-4">Frete</th>
                  <th className="px-3 py-4">Preco total</th>
                  <th className="px-3 py-4">Destaques</th>
                </tr>
              </thead>
              <tbody>
                {viewModel.offers.map((offer) => (
                  <tr
                    key={`${offer.marketName}-${offer.city}`}
                    className={
                      offer.bestOpportunity
                        ? "bg-emerald-50"
                        : offer.highestPrice
                          ? "bg-orange-50"
                          : "bg-white/30"
                    }
                  >
                    <td className="px-3 py-4">
                      <div>{offer.marketName}</div>
                      <div className="text-sm text-slate-500">{offer.city}</div>
                    </td>
                    <td className="px-3 py-4">{formatCurrency(offer.price)}</td>
                    <td className="px-3 py-4">{formatCurrency(offer.freight)}</td>
                    <td className="px-3 py-4 font-semibold">{formatCurrency(offer.total)}</td>
                    <td className="px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        {offer.bestOpportunity ? <Badge tone="best">Melhor oportunidade</Badge> : null}
                        {offer.highestPrice ? <Badge tone="acima_faixa">Maior preco</Badge> : null}
                        {offer.statusCode !== "dentro_faixa" ? (
                          <Badge tone={offer.statusCode}>{offer.statusLabel}</Badge>
                        ) : (
                          <Badge tone="neutral">Preco regular</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SummaryPanel>
    </Shell>
  );
}
