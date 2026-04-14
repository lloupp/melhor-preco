import { buildSummary, computeProductMetrics } from "@/lib/domain/analytics";
import { formatCurrency, formatPercentage, formatPriceRange } from "@/lib/domain/format";
import { getFilterOptions, getMarketFactors, getPriceRecords, getProduct, listProducts, type Filters } from "@/lib/data";

function statusLabel(code: string) {
  return {
    abaixo_faixa: "Abaixo da faixa",
    acima_faixa: "Acima da faixa",
    dentro_faixa: "Dentro da faixa",
  }[code] ?? "Sem dados";
}

export async function getDashboardViewModel(filters: Filters) {
  const [records, products, filterOptions] = await Promise.all([
    getPriceRecords(filters),
    listProducts(filters.category),
    getFilterOptions(),
  ]);

  const rows = products.map((product) => {
    const productRecords = records.filter((record) => record.productId === product.id);
    const metrics = computeProductMetrics(productRecords);

    return {
      id: product.id,
      name: product.name,
      category: product.category,
      currentPrice: metrics.currentPrice,
      currentPriceLabel: formatCurrency(metrics.currentPrice),
      avg7Label: formatCurrency(metrics.avg7),
      avg30Label: formatCurrency(metrics.avg30),
      weeklyVariation: metrics.weeklyVariation,
      weeklyVariationLabel: formatPercentage(metrics.weeklyVariation),
      statusCode: metrics.status.code,
      statusLabel: metrics.status.label,
      trendLabel: metrics.trend.label,
      expectedRangeLabel: formatPriceRange(metrics.expectedRange.low, metrics.expectedRange.high),
    };
  });

  const moves = rows.filter((row) => row.weeklyVariation != null);
  const topPressure = [...moves]
    .filter((row) => (row.weeklyVariation ?? 0) > 0)
    .sort((left, right) => (right.weeklyVariation ?? 0) - (left.weeklyVariation ?? 0))
    .slice(0, 2);

  const heroChart = [...moves]
    .sort((left, right) => Math.abs(right.weeklyVariation ?? 0) - Math.abs(left.weeklyVariation ?? 0))
    .slice(0, 6)
    .map((row) => ({
      name: row.name,
      variation: Number((row.weeklyVariation ?? 0).toFixed(1)),
      statusCode: row.statusCode,
    }));

  const totals = {
    products: rows.length,
    markets: new Set(records.map((record) => record.marketId)).size,
    records: records.length,
    aboveRange: rows.filter((row) => row.statusCode === "acima_faixa").length,
    belowRange: rows.filter((row) => row.statusCode === "abaixo_faixa").length,
    withinRange: rows.filter((row) => row.statusCode === "dentro_faixa").length,
  };

  return {
    filters,
    filterOptions,
    totals,
    rows,
    highestWeeklyMoves: [...moves].sort((left, right) => (right.weeklyVariation ?? 0) - (left.weeklyVariation ?? 0)).slice(0, 5),
    lowestWeeklyMoves: [...moves].sort((left, right) => (left.weeklyVariation ?? 0) - (right.weeklyVariation ?? 0)).slice(0, 5),
    heroChart,
    narratives: buildDashboardNarratives(totals, topPressure),
    alerts: buildDashboardAlerts(rows),
  };
}

export async function getProductViewModel(productId: number, filters: Filters) {
  const product = await getProduct(productId);
  if (!product) return null;

  const [records, factors, filterOptions] = await Promise.all([
    getPriceRecords({ ...filters, productId }),
    getMarketFactors(productId, filters.marketId, filters.city),
    getFilterOptions(),
  ]);

  const metrics = computeProductMetrics(records);
  const latestByMarket = new Map<number, (typeof records)[number]>();
  for (const record of records) latestByMarket.set(record.marketId, record);

  return {
    product,
    filters,
    filterOptions,
    metrics,
    summary: buildSummary(product.name, metrics),
    statusHighlight: buildStatusHighlight(metrics.status.code),
    factors: factors.map((factor) => ({
      ...factor,
      impactLabel: factor.intensity <= 3 ? `${capitalize(factor.direction)} moderada` : `${capitalize(factor.direction)} forte`,
      reasonLabel: buildFactorReasonLabel(factor.direction, factor.intensity),
    })),
    chartPoints: metrics.series.map((point) => ({
      date: point.date.slice(5),
      value: point.value,
      marketName: point.marketName,
    })),
    marketSnapshot: [...latestByMarket.values()]
      .sort((left, right) => left.totalPrice - right.totalPrice)
      .map((record) => ({
        marketName: record.marketName,
        city: record.city,
        priceLabel: formatCurrency(record.price),
        freightLabel: formatCurrency(record.freight),
        totalLabel: formatCurrency(record.totalPrice),
      })),
  };
}

export async function getComparisonViewModel(filters: Filters) {
  const [products, filterOptions] = await Promise.all([listProducts(filters.category), getFilterOptions()]);
  const selectedProductId = filters.productId ?? products[0]?.id ?? null;

  if (!selectedProductId) {
    return { filters, filterOptions, products, selectedProductId: null, selectedProduct: null, offers: [] };
  }

  const [selectedProduct, records] = await Promise.all([
    getProduct(selectedProductId),
    getPriceRecords({ ...filters, productId: selectedProductId }),
  ]);

  const metrics = computeProductMetrics(records);
  const latestByMarket = new Map<number, (typeof records)[number]>();
  for (const record of records) latestByMarket.set(record.marketId, record);

  const offers = [...latestByMarket.values()]
    .sort((left, right) => left.totalPrice - right.totalPrice)
    .map((record, index) => {
      let statusCode = "dentro_faixa";
      if (metrics.expectedRange.low != null && record.totalPrice < metrics.expectedRange.low) statusCode = "abaixo_faixa";
      if (metrics.expectedRange.high != null && record.totalPrice > metrics.expectedRange.high) statusCode = "acima_faixa";

      return {
        marketName: record.marketName,
        city: record.city,
        price: record.price,
        freight: record.freight,
        total: record.totalPrice,
        statusCode,
        statusLabel: statusLabel(statusCode),
        bestOpportunity: index === 0,
        highestPrice: false,
      };
    });

  if (offers.length > 0) {
    offers[offers.length - 1].highestPrice = true;
  }

  return {
    filters,
    filterOptions,
    products,
    selectedProductId,
    selectedProduct,
    offers,
    comparisonContext: buildComparisonContext(selectedProduct?.name, offers),
  };
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function buildDashboardNarratives(
  totals: {
    products: number;
    markets: number;
    records: number;
    aboveRange: number;
    belowRange: number;
    withinRange: number;
  },
  topPressure: Array<{ name: string }>,
) {
  const pressureNames = topPressure.map((item) => item.name.split(" ")[0].toLowerCase());
  return [
    `${totals.aboveRange} produtos estao acima da faixa esperada hoje.`,
    `${totals.belowRange} produtos mostram oportunidade de compra neste recorte.`,
    pressureNames.length > 0
      ? `${pressureNames.join(" e ")} concentram a maior pressao de alta no periodo.`
      : "Nao ha pressao de alta relevante no recorte atual.",
  ];
}

function buildDashboardAlerts(
  rows: Array<{ id: number; name: string; statusCode: string; weeklyVariation: number | null; weeklyVariationLabel: string }>,
) {
  const aboveRange = rows.filter((row) => row.statusCode === "acima_faixa").slice(0, 3);
  const opportunities = rows.filter((row) => row.statusCode === "abaixo_faixa").slice(0, 3);
  const highestMove = [...rows]
    .filter((row) => row.weeklyVariation != null)
    .sort((left, right) => (right.weeklyVariation ?? 0) - (left.weeklyVariation ?? 0))[0];

  return [
    ...aboveRange.map((row) => ({
      tone: "acima_faixa",
      title: `${row.name} pede atencao`,
      description: "Preco acima da faixa esperada no recorte atual.",
      href: `/produtos/${row.id}`,
    })),
    ...opportunities.map((row) => ({
      tone: "abaixo_faixa",
      title: `${row.name} abre oportunidade`,
      description: "Preco abaixo da faixa esperada, com chance de compra favoravel.",
      href: `/produtos/${row.id}`,
    })),
    ...(highestMove
      ? [
          {
            tone: "alta",
            title: `${highestMove.name} lidera a pressao`,
            description: `Maior variacao semanal do painel: ${highestMove.weeklyVariationLabel}.`,
            href: `/produtos/${highestMove.id}`,
          },
        ]
      : []),
  ].slice(0, 4);
}

function buildStatusHighlight(statusCode: string) {
  if (statusCode === "abaixo_faixa") {
    return {
      title: "Preco abaixo da faixa",
      description: "O item opera abaixo do intervalo esperado e merece atencao como oportunidade de compra.",
      tone: "abaixo_faixa",
    };
  }
  if (statusCode === "acima_faixa") {
    return {
      title: "Preco acima da faixa",
      description: "O item esta pressionado acima do intervalo esperado e pode exigir renegociacao ou espera.",
      tone: "acima_faixa",
    };
  }
  return {
    title: "Preco dentro da faixa",
    description: "O item segue em nivel compativel com o historico recente deste recorte.",
    tone: "dentro_faixa",
  };
}

function buildFactorReasonLabel(direction: string, intensity: number) {
  if (direction === "alta") return intensity >= 4 ? "Pressao relevante de alta" : "Pressao moderada de alta";
  if (direction === "queda") return intensity >= 4 ? "Alivio relevante de preco" : "Movimento moderado de queda";
  return "Sinal neutro de contexto";
}

function buildComparisonContext(productName: string | undefined, offers: Array<{ total: number; marketName: string; bestOpportunity: boolean; highestPrice: boolean }>) {
  if (!productName || offers.length === 0) {
    return "Nenhum mercado foi encontrado para comparar neste recorte.";
  }

  const best = offers.find((offer) => offer.bestOpportunity);
  const highest = offers.find((offer) => offer.highestPrice);
  if (!best || !highest) {
    return `Comparativo de ${productName} pronto para analise.`;
  }

  const spread = highest.total - best.total;
  return `${productName} tem melhor oportunidade em ${best.marketName}. A diferenca para o maior preco do painel e de ${formatCurrency(spread)}.`;
}
