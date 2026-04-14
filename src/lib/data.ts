import { prisma } from "@/lib/prisma";
import type { MarketFactorItem, PriceRecordWithRelations } from "@/lib/domain/types";

export type Filters = {
  category?: string;
  city?: string;
  marketId?: number;
  periodDays?: number;
  productId?: number;
};

export async function getFilterOptions() {
  const [categories, cities, markets, products] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
    prisma.market.findMany({ where: { active: true }, distinct: ["city"], select: { city: true }, orderBy: { city: "asc" } }),
    prisma.market.findMany({ where: { active: true }, select: { id: true, name: true, city: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return {
    categories: categories.map((item) => ({ value: item.category, label: titleize(item.category) })),
    cities: cities.map((item) => ({ value: item.city, label: item.city })),
    markets: markets.map((item) => ({ value: item.id, label: `${item.name} (${item.city})` })),
    products: products.map((item) => ({ value: item.id, label: item.name })),
  };
}

export async function listProducts(category?: string) {
  return prisma.product.findMany({
    where: { active: true, ...(category ? { category } : {}) },
    orderBy: { name: "asc" },
  });
}

export async function getProduct(productId: number) {
  return prisma.product.findFirst({
    where: { id: productId, active: true },
  });
}

export async function getPriceRecords(filters: Filters): Promise<PriceRecordWithRelations[]> {
  const items = await prisma.priceRecord.findMany({
    where: {
      product: { active: true, ...(filters.category ? { category: filters.category } : {}) },
      market: { active: true, ...(filters.city ? { city: filters.city } : {}) },
      ...(filters.marketId ? { marketId: filters.marketId } : {}),
      ...(filters.productId ? { productId: filters.productId } : {}),
    },
    include: {
      product: true,
      market: true,
    },
    orderBy: [{ collectedAt: "asc" }, { product: { name: "asc" } }, { market: { name: "asc" } }],
  });

  const normalized = items.map((record) => ({
    id: record.id,
    productId: record.productId,
    marketId: record.marketId,
    price: record.price,
    freight: record.freight,
    totalPrice: record.totalPrice,
    collectedAt: record.collectedAt,
    productName: record.product.name,
    category: record.product.category,
    unit: record.product.unit,
    marketName: record.market.name,
    city: record.market.city,
    state: record.market.state,
    channel: record.market.channel,
  }));

  return applyPeriodFilter(normalized, filters.periodDays ?? 30);
}

export async function getMarketFactors(
  productId: number,
  marketId?: number,
  city?: string,
): Promise<MarketFactorItem[]> {
  const factors = await prisma.marketFactor.findMany({
    where: {
      productId,
      ...(marketId ? { marketId } : {}),
      ...(city ? { market: { city } } : {}),
    },
    include: { market: true },
    orderBy: { collectedAt: "desc" },
    take: 8,
  });

  return factors.map((factor) => ({
    id: factor.id,
    productId: factor.productId,
    marketId: factor.marketId,
    title: factor.title,
    description: factor.description,
    direction: factor.direction,
    intensity: factor.intensity,
    collectedAt: factor.collectedAt,
    marketName: factor.market.name,
    city: factor.market.city,
  }));
}

function titleize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function applyPeriodFilter(records: PriceRecordWithRelations[], periodDays: number) {
  if (records.length === 0) return records;
  const latest = records.reduce((max, record) => (record.collectedAt > max ? record.collectedAt : max), records[0].collectedAt);
  const threshold = new Date(latest);
  threshold.setDate(threshold.getDate() - (periodDays - 1));
  return records.filter((record) => record.collectedAt >= threshold);
}
