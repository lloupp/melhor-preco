import { formatCurrency, formatPercentage, formatPriceRange } from "@/lib/domain/format";
import type { PriceRecordWithRelations } from "@/lib/domain/types";

export type DailySeriesPoint = {
  date: string;
  value: number;
  marketName: string;
  marketId: number;
  offers: PriceRecordWithRelations[];
};

export type ProductMetrics = {
  series: DailySeriesPoint[];
  currentPrice: number | null;
  currentMarketName: string | null;
  avg7: number | null;
  avg30: number | null;
  minimum: number | null;
  maximum: number | null;
  weeklyVariation: number | null;
  monthlyVariation: number | null;
  status: { code: string; label: string };
  trend: { code: string; label: string };
  expectedRange: { low: number | null; high: number | null };
  insufficientHistory7: boolean;
  insufficientHistory30: boolean;
};

export function buildDailySeries(priceRecords: PriceRecordWithRelations[]): DailySeriesPoint[] {
  const grouped = new Map<string, PriceRecordWithRelations[]>();

  for (const record of priceRecords) {
    const date = record.collectedAt.toISOString().slice(0, 10);
    const list = grouped.get(date) ?? [];
    list.push(record);
    grouped.set(date, list);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, offers]) => {
      const sortedOffers = [...offers].sort((left, right) => left.totalPrice - right.totalPrice);
      const bestOffer = sortedOffers[0];

      return {
        date,
        value: bestOffer.totalPrice,
        marketName: bestOffer.marketName,
        marketId: bestOffer.marketId,
        offers: sortedOffers,
      };
    });
}

export function computeProductMetrics(priceRecords: PriceRecordWithRelations[]): ProductMetrics {
  const dailySeries = buildDailySeries(priceRecords);
  if (dailySeries.length === 0) return emptyMetrics();

  const latest = dailySeries[dailySeries.length - 1];
  const latestDate = new Date(latest.date);
  const values7 = filterSeriesWindow(dailySeries, latestDate, 7).map((point) => point.value);
  const values30 = filterSeriesWindow(dailySeries, latestDate, 30).map((point) => point.value);
  const previous7 = filterSeriesWindow(dailySeries.slice(0, -7), addDays(latestDate, -7), 7).map((point) => point.value);

  const avg7 = safeMean(values7);
  const avg30 = safeMean(values30);
  const [low, high] = computeExpectedRange(values30.length > 0 ? values30 : values7);

  return {
    series: dailySeries,
    currentPrice: latest.value,
    currentMarketName: latest.marketName,
    avg7,
    avg30,
    minimum: Math.min(...dailySeries.map((point) => point.value)),
    maximum: Math.max(...dailySeries.map((point) => point.value)),
    weeklyVariation: computeVariation(dailySeries, 7),
    monthlyVariation: computeVariation(dailySeries, 30),
    status: classifyStatus(latest.value, low, high),
    trend: classifyTrend(avg7, safeMean(previous7)),
    expectedRange: { low, high },
    insufficientHistory7: values7.length < 7,
    insufficientHistory30: values30.length < 30,
  };
}

export function computeExpectedRange(values: number[]): [number | null, number | null] {
  if (values.length === 0) return [null, null];
  const center = safeMean(values) ?? 0;
  const deviation = values.length > 1 ? populationStdDev(values) : center * 0.05;
  const margin = Math.max(deviation, center * 0.05);
  return [Math.max(0, center - margin), center + margin];
}

export function computeVariation(series: DailySeriesPoint[], daysBack: number): number | null {
  if (series.length < 2) return null;

  const latest = series[series.length - 1];
  const latestDate = new Date(latest.date);
  const targetDate = addDays(latestDate, -daysBack);
  const baseline = [...series.slice(0, -1)].reverse().find((point) => new Date(point.date) <= targetDate)?.value;

  if (baseline == null || baseline === 0) return null;
  return ((latest.value - baseline) / baseline) * 100;
}

export function classifyStatus(currentPrice: number | null, low: number | null, high: number | null) {
  if (currentPrice == null || low == null || high == null) return { code: "sem_dados", label: "Sem dados" };
  if (currentPrice < low) return { code: "abaixo_faixa", label: "Abaixo da faixa" };
  if (currentPrice > high) return { code: "acima_faixa", label: "Acima da faixa" };
  return { code: "dentro_faixa", label: "Dentro da faixa" };
}

export function classifyTrend(currentAvg: number | null, previousAvg: number | null) {
  if (currentAvg == null || previousAvg == null || previousAvg === 0) {
    return { code: "indefinida", label: "Historico insuficiente" };
  }

  const delta = ((currentAvg - previousAvg) / previousAvg) * 100;
  if (delta >= 1) return { code: "alta", label: "Alta" };
  if (delta <= -1) return { code: "queda", label: "Queda" };
  return { code: "estavel", label: "Estavel" };
}

export function buildSummary(productName: string, metrics: ProductMetrics): string {
  if (metrics.currentPrice == null) {
    return `${productName} ainda nao tem historico suficiente para uma leitura analitica confiavel.`;
  }

  const statusText =
    metrics.status.code === "abaixo_faixa"
      ? "abaixo da faixa esperada, sugerindo uma janela favoravel de compra"
      : metrics.status.code === "acima_faixa"
        ? "acima da faixa esperada, indicando pressao de preco no curto prazo"
        : "dentro da faixa esperada, em um nivel considerado saudavel para acompanhamento";

  const trendText =
    metrics.trend.code === "alta"
      ? "a tendencia recente segue de alta"
      : metrics.trend.code === "queda"
        ? "a tendencia recente aponta acomodacao"
        : "a tendencia recente permanece estavel";

  return [
    `${productName} registra menor preco atual de ${formatCurrency(metrics.currentPrice)},`,
    `${statusText}.`,
    `${trendText}, com variacao semanal de ${formatPercentage(metrics.weeklyVariation)}`,
    `e variacao mensal de ${formatPercentage(metrics.monthlyVariation)}.`,
    `A faixa esperada neste recorte vai de ${formatPriceRange(metrics.expectedRange.low, metrics.expectedRange.high)}.`,
  ].join(" ");
}

export function emptyMetrics(): ProductMetrics {
  return {
    series: [],
    currentPrice: null,
    currentMarketName: null,
    avg7: null,
    avg30: null,
    minimum: null,
    maximum: null,
    weeklyVariation: null,
    monthlyVariation: null,
    status: { code: "sem_dados", label: "Sem dados" },
    trend: { code: "indefinida", label: "Historico insuficiente" },
    expectedRange: { low: null, high: null },
    insufficientHistory7: true,
    insufficientHistory30: true,
  };
}

function filterSeriesWindow(series: DailySeriesPoint[], referenceDate: Date, days: number) {
  const threshold = addDays(referenceDate, -(days - 1));
  return series.filter((point) => new Date(point.date) >= threshold);
}

function safeMean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function populationStdDev(values: number[]): number {
  const avg = safeMean(values) ?? 0;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
