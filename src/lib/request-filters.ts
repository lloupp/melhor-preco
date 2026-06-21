import type { Filters } from "@/lib/data";

export type SearchParams = Record<string, string | string[] | undefined>;

const FILTER_QUERY_KEYS = {
  category: "categoria",
  city: "cidade",
  marketId: "mercado",
  periodDays: "periodo",
  productId: "produto_id",
} as const satisfies Record<keyof Filters, string>;

export function parseFilters(
  searchParams: SearchParams,
  keys: (keyof Filters)[],
): Filters {
  const filters: Filters = {};

  for (const key of keys) {
    const raw = getOne(searchParams, FILTER_QUERY_KEYS[key]);
    if (key === "periodDays") {
      filters.periodDays = parseIntValue(raw) ?? 30;
    } else if (key === "marketId" || key === "productId") {
      filters[key] = parseIntValue(raw);
    } else {
      filters[key] = raw;
    }
  }

  return filters;
}

function getOne(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseIntValue(value?: string) {
  return value ? Number.parseInt(value, 10) || undefined : undefined;
}
