import type { PrismaClient } from "@prisma/client";

type AggregationFilters = {
  productId?: number;
  category?: string;
  periodDays?: number;
};

type AggregationPoint = {
  scope: string;
  label: string;
  averagePrice: number;
  records: number;
  markets: number;
};

export async function getNationalPriceAggregation(prisma: PrismaClient, filters: AggregationFilters = {}) {
  const records = await loadFilteredRecords(prisma, filters);
  return aggregateRecords(records, () => ({ scope: "BR", label: "Brasil" }))[0] ?? null;
}

export async function getStatePriceAggregation(prisma: PrismaClient, filters: AggregationFilters = {}) {
  const records = await loadFilteredRecords(prisma, filters);
  return aggregateRecords(records, (record) => ({ scope: record.market.state, label: record.market.state }));
}

export async function getCityPriceAggregation(prisma: PrismaClient, filters: AggregationFilters = {}) {
  const records = await loadFilteredRecords(prisma, filters);
  return aggregateRecords(records, (record) => ({
    scope: `${record.market.state}:${record.market.city}`,
    label: `${record.market.city} (${record.market.state})`,
  }));
}

export async function getRegionalDispersion(prisma: PrismaClient, filters: AggregationFilters = {}) {
  const records = await loadFilteredRecords(prisma, filters);
  const grouped = groupRecords(records, (record) => record.market.regionCode ?? "N/D");

  return Array.from(grouped.entries())
    .map(([regionCode, items]) => {
      const prices = items.map((item) => item.totalPrice);
      const meanPrice = average(prices);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      return {
        regionCode,
        averagePrice: round(meanPrice),
        minPrice: round(min),
        maxPrice: round(max),
        spread: round(max - min),
        dispersionPct: round(meanPrice ? ((max - min) / meanPrice) * 100 : 0),
      };
    })
    .sort((left, right) => right.dispersionPct - left.dispersionPct);
}

export async function getCheapestMarketsByRegion(prisma: PrismaClient, filters: AggregationFilters = {}) {
  const records = await loadFilteredRecords(prisma, filters);
  const grouped = groupRecords(records, (record) => record.market.regionCode ?? "N/D");

  return Array.from(grouped.entries()).map(([regionCode, items]) => {
    const byMarket = new Map<number, { marketName: string; city: string; state: string; prices: number[] }>();
    for (const item of items) {
      const current = byMarket.get(item.marketId) ?? {
        marketName: item.market.name,
        city: item.market.city,
        state: item.market.state,
        prices: [],
      };
      current.prices.push(item.totalPrice);
      byMarket.set(item.marketId, current);
    }

    const cheapest = Array.from(byMarket.values())
      .map((market) => ({
        marketName: market.marketName,
        city: market.city,
        state: market.state,
        averagePrice: round(average(market.prices)),
      }))
      .sort((left, right) => left.averagePrice - right.averagePrice)
      .slice(0, 3);

    return {
      regionCode,
      cheapestMarkets: cheapest,
    };
  });
}

async function loadFilteredRecords(prisma: PrismaClient, filters: AggregationFilters) {
  const latest = await prisma.priceRecord.findFirst({
    orderBy: { collectedAt: "desc" },
    select: { collectedAt: true },
  });
  const periodDays = filters.periodDays ?? 30;
  const threshold = latest?.collectedAt ? new Date(latest.collectedAt) : new Date();
  threshold.setDate(threshold.getDate() - (periodDays - 1));

  return prisma.priceRecord.findMany({
    where: {
      collectedAt: { gte: threshold },
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(filters.category ? { product: { category: filters.category } } : {}),
      market: { active: true },
      product: { active: true },
    },
    include: {
      market: true,
      product: true,
    },
    orderBy: { collectedAt: "desc" },
  });
}

function aggregateRecords(
  records: Awaited<ReturnType<typeof loadFilteredRecords>>,
  scopeSelector: (
    record: Awaited<ReturnType<typeof loadFilteredRecords>>[number],
  ) => { scope: string; label: string },
) {
  const grouped = new Map<string, { label: string; prices: number[]; markets: Set<number> }>();
  for (const record of records) {
    const scope = scopeSelector(record);
    const current = grouped.get(scope.scope) ?? {
      label: scope.label,
      prices: [],
      markets: new Set<number>(),
    };
    current.prices.push(record.totalPrice);
    current.markets.add(record.marketId);
    grouped.set(scope.scope, current);
  }

  return Array.from(grouped.entries())
    .map(([scope, entry]): AggregationPoint => ({
      scope,
      label: entry.label,
      averagePrice: round(average(entry.prices)),
      records: entry.prices.length,
      markets: entry.markets.size,
    }))
    .sort((left, right) => left.averagePrice - right.averagePrice);
}

function groupRecords<T>(records: T[], keySelector: (record: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const record of records) {
    const key = keySelector(record);
    const current = grouped.get(key) ?? [];
    current.push(record);
    grouped.set(key, current);
  }
  return grouped;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number) {
  return Number(value.toFixed(2));
}
