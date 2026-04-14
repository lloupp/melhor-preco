import type { PrismaClient } from "@prisma/client";
import {
  analyzePredictionSignals,
  materializeExternalEventFactors,
  normalizePendingObservations,
  persistNormalizedObservations,
  runAutomationPipeline,
  type RawObservationInput,
} from "@/lib/automation/pipeline";

type OpenPricesResponse = {
  items: Array<{
    id: number;
    price: number;
    currency: string;
    date: string;
    source: string | null;
    product?: {
      product_name: string | null;
      brands: string | null;
      product_quantity: number | null;
      product_quantity_unit: string | null;
      code: string | null;
    } | null;
    location?: {
      osm_name: string | null;
      osm_brand: string | null;
      osm_address_city: string | null;
      osm_display_name: string | null;
    } | null;
    proof?: {
      id: number;
      type: string | null;
      source: string | null;
    } | null;
  }>;
};

type SupportedRealProduct = {
  searchTerm: string;
  canonicalKey: string;
  name: string;
  category: string;
  subcategory: string;
  canonicalBrand?: string;
  unit: string;
  comparableUnit: string;
  comparableAmount: number;
  packageMinAmount?: number;
  packageMaxAmount?: number;
  equivalentGroup?: string;
  description: string;
  aliases: string[];
  match: (name: string, packageInfo: string | null) => boolean;
};

const OPEN_PRICES_API_ROOT = "https://prices.openfoodfacts.org/api/v1";

const SUPPORTED_REAL_PRODUCTS: SupportedRealProduct[] = [
  {
    searchTerm: "Pão de Forma",
    canonicalKey: "pao-de-forma-400g",
    name: "Pao de Forma 400g",
    category: "mercearia",
    subcategory: "panificados",
    unit: "pacote",
    comparableUnit: "kg",
    comparableAmount: 0.4,
    packageMinAmount: 0.35,
    packageMaxAmount: 0.45,
    equivalentGroup: "pao-de-forma",
    description: "Pao de forma embalado com 400g coletado de fonte real.",
    aliases: ["pao de forma", "pão de forma", "pão de forma 400g"],
    match: (name, packageInfo) => includesAll(name, ["pao", "forma"]) && packageInfo === "400g",
  },
  {
    searchTerm: "Ovos Brancos Extra",
    canonicalKey: "ovos-brancos-extra-1160g",
    name: "Ovos Brancos Extra 1160g",
    category: "mercearia",
    subcategory: "ovos",
    canonicalBrand: "Mantiqueira",
    unit: "bandeja",
    comparableUnit: "kg",
    comparableAmount: 1.16,
    packageMinAmount: 1.1,
    packageMaxAmount: 1.2,
    equivalentGroup: "ovos-brancos-extra",
    description: "Bandeja de ovos brancos extra observada em fonte real.",
    aliases: ["ovos brancos extra", "ovos brancos", "ovos brancos extra 1160g"],
    match: (name, packageInfo) => includesAll(name, ["ovos", "brancos"]) && packageInfo === "1160g",
  },
  {
    searchTerm: "Iogurte Semidesnatado Natural Zero Lactose Danone",
    canonicalKey: "iogurte-zero-lactose-160g",
    name: "Iogurte Zero Lactose 160g",
    category: "mercearia",
    subcategory: "lacteos",
    canonicalBrand: "Danone",
    unit: "unidade",
    comparableUnit: "kg",
    comparableAmount: 0.16,
    packageMinAmount: 0.15,
    packageMaxAmount: 0.17,
    equivalentGroup: "iogurte-zero-lactose",
    description: "Iogurte zero lactose de 160g coletado de fonte real.",
    aliases: [
      "iogurte zero lactose",
      "iogurte natural zero lactose",
      "iogurte semidesnatado natural zero lactose danone",
    ],
    match: (name, packageInfo) => includesAll(name, ["iogurte"]) && packageInfo === "160g",
  },
];

export async function collectSimpleMarketData(prisma: PrismaClient) {
  const rawInputs: RawObservationInput[] = [];
  const examples: Array<Record<string, string | number | null>> = [];
  let fetched = 0;
  let supportedCount = 0;

  for (const supportedProduct of SUPPORTED_REAL_PRODUCTS) {
    const productSearch = await fetchJson<{
      items: Array<{
        id: number;
        product_name: string | null;
        product_quantity: number | null;
        product_quantity_unit: string | null;
        brands: string | null;
      }>;
    }>(
      `${OPEN_PRICES_API_ROOT}/products?product_name__like=${encodeURIComponent(supportedProduct.searchTerm)}&price_count__gte=1&size=5`,
    );

    const productMatch = productSearch.items.find((candidate) => {
      const packageInfo = buildPackageInfo(candidate.product_quantity, candidate.product_quantity_unit);
      return candidate.product_name && supportedProduct.match(candidate.product_name.toLowerCase(), packageInfo?.toLowerCase() ?? null);
    });

    if (!productMatch) continue;

    const pricesPayload = await fetchJson<OpenPricesResponse>(
      `${OPEN_PRICES_API_ROOT}/prices?currency=BRL&product_id=${productMatch.id}&size=5&order_by=-date`,
    );
    fetched += pricesPayload.items.length;

    for (const item of pricesPayload.items) {
      const productName = item.product?.product_name?.trim();
      const city = item.location?.osm_address_city?.trim();
      if (!productName || !city || !item.price || item.currency !== "BRL") continue;

      const packageInfo = buildPackageInfo(item.product?.product_quantity, item.product?.product_quantity_unit);
      if (!supportedProduct.match(productName.toLowerCase(), packageInfo?.toLowerCase() ?? null)) continue;

      supportedCount += 1;
      const market = await ensureMarket(prisma, item.location?.osm_brand || item.location?.osm_name || "Open Prices Market", city);
      const product = await ensureCanonicalProduct(prisma, supportedProduct);
      const collectedAt = item.date ? new Date(item.date) : new Date();
      const alreadyPersisted = await prisma.priceRecord.findFirst({
        where: {
          productId: product.id,
          marketId: market.id,
          collectedAt,
        },
        select: { id: true },
      });
      if (alreadyPersisted) {
        continue;
      }
      const evidenceText = [item.proof?.source, item.location?.osm_display_name]
        .filter(Boolean)
        .join(" | ");

      rawInputs.push({
        sourceType: "open_prices_api",
        sourceName: `Open Prices / ${item.location?.osm_brand || item.location?.osm_name || "market"}`,
        collectedAt,
        rawProductName: productName,
        rawBrand: item.product?.brands || null,
        rawPackageInfo: packageInfo,
        rawPrice: item.price,
        rawCurrency: item.currency,
        countryCode: "BR",
        stateCode: market.state,
        regionCode: market.regionCode ?? "SE",
        city,
        neighborhood: extractNeighborhood(item.location?.osm_display_name || null),
        metroAreaName: market.metroAreaName,
        sourceUrl: `https://prices.openfoodfacts.org/api/v1/prices/${item.id}`,
        evidenceText: evidenceText || null,
        confidenceScore: 0.83,
        marketId: market.id,
        countryId: market.countryId ?? undefined,
        stateId: market.stateId ?? undefined,
        cityId: market.cityId ?? undefined,
        metroAreaId: market.metroAreaId ?? undefined,
      });

      if (examples.length < 5) {
        examples.push({
          productName,
          price: item.price,
          packageInfo,
          brand: item.product?.brands || null,
          city,
          market: market.name,
          canonicalProduct: product.name,
        });
      }
    }
  }

  return {
    source: "Open Prices / Open Food Facts",
    fetched,
    supported: supportedCount,
    rawInputs,
    examples,
  };
}

export async function runRealCollection(prisma: PrismaClient) {
  try {
    const collected = await collectSimpleMarketData(prisma);
    await cleanupDuplicateNormalizedObservations(prisma);
    if (collected.rawInputs.length === 0) {
      return {
        source: collected.source,
        fetched: collected.fetched,
        ingested: 0,
        examples: collected.examples,
        warning: "Nenhum item real suportado foi encontrado nesta rodada.",
      };
    }

    try {
      await runAutomationPipeline(prisma, { rawInputs: collected.rawInputs });
    } catch (error) {
      if (!isDuplicatePersistenceError(error)) {
        throw error;
      }

      await normalizePendingObservations(prisma);
      await cleanupDuplicateNormalizedObservations(prisma);
      await persistNormalizedObservations(prisma);
      await materializeExternalEventFactors(prisma);
      await analyzePredictionSignals(prisma);
    }

    return {
      source: collected.source,
      fetched: collected.fetched,
      ingested: collected.rawInputs.length,
      examples: collected.examples,
    };
  } catch (error) {
    return {
      source: "Open Prices / Open Food Facts",
      fetched: 0,
      ingested: 0,
      examples: [],
      error: error instanceof Error ? error.message : "Falha desconhecida na coleta real.",
    };
  }
}

async function ensureCanonicalProduct(prisma: PrismaClient, config: SupportedRealProduct) {
  const product = await prisma.product.upsert({
    where: { canonicalKey: config.canonicalKey },
    update: {
      name: config.name,
      category: config.category,
        unit: config.unit,
        comparableUnit: config.comparableUnit,
        comparableAmount: config.comparableAmount,
        subcategory: config.subcategory,
        canonicalBrand: config.canonicalBrand,
        packageMinAmount: config.packageMinAmount,
        packageMaxAmount: config.packageMaxAmount,
        equivalentGroup: config.equivalentGroup,
        description: config.description,
        active: true,
      },
      create: {
        canonicalKey: config.canonicalKey,
        name: config.name,
        category: config.category,
        subcategory: config.subcategory,
        canonicalBrand: config.canonicalBrand,
        unit: config.unit,
        comparableUnit: config.comparableUnit,
        comparableAmount: config.comparableAmount,
        packageMinAmount: config.packageMinAmount,
        packageMaxAmount: config.packageMaxAmount,
        equivalentGroup: config.equivalentGroup,
        description: config.description,
        active: true,
      },
  });

  for (const alias of config.aliases) {
    const existingAlias = await prisma.productAlias.findFirst({
      where: {
        productId: product.id,
        alias,
      },
    });

    if (existingAlias) {
      await prisma.productAlias.update({
        where: { id: existingAlias.id },
        data: {
          normalizedUnit: config.comparableUnit,
          normalizedAmount: config.comparableAmount,
          aliasType: "real_source_variant",
          evidenceSource: "open_prices_api",
        },
      });
      continue;
    }

    await prisma.productAlias.create({
      data: {
        productId: product.id,
        alias,
        aliasType: "real_source_variant",
        normalizedUnit: config.comparableUnit,
        normalizedAmount: config.comparableAmount,
        evidenceSource: "open_prices_api",
      },
    });
  }

  return product;
}

async function ensureMarket(prisma: PrismaClient, marketName: string, city: string) {
  const geography = await ensureBrazilianGeography(prisma, city);
  const existing = await prisma.market.findFirst({
    where: {
      name: marketName,
      city,
    },
  });
  if (existing) return existing;

  return prisma.market.create({
    data: {
      name: marketName,
      sourceKey: `open-prices:${normalizeKey(`${marketName}-${city}`)}`,
      sourceName: "Open Prices / Open Food Facts",
      countryCode: "BR",
      regionCode: geography.regionCode,
      city,
      state: geography.stateCode,
      metroAreaName: geography.metroAreaName,
      channel: "marketplace_publico",
      active: true,
      countryId: geography.countryId,
      stateId: geography.stateId,
      cityId: geography.cityId,
      metroAreaId: geography.metroAreaId,
    },
  });
}

async function ensureBrazilianGeography(prisma: PrismaClient, cityName: string) {
  const fallback = {
    stateCode: "SP",
    stateName: "Sao Paulo",
    regionCode: "SE",
    metroAreaName: cityName === "Sao Paulo" ? "Regiao Metropolitana de Sao Paulo" : null,
  };
  const lookup = lookupCityMetadata(cityName) ?? fallback;

  const country = await prisma.country.upsert({
    where: { code: "BR" },
    update: { name: "Brasil" },
    create: { code: "BR", name: "Brasil" },
  });
  const state = await prisma.state.upsert({
    where: {
      countryId_code: {
        countryId: country.id,
        code: lookup.stateCode,
      },
    },
    update: {
      name: lookup.stateName,
      regionCode: lookup.regionCode,
    },
    create: {
      countryId: country.id,
      code: lookup.stateCode,
      name: lookup.stateName,
      regionCode: lookup.regionCode,
    },
  });
  const city = await prisma.city.upsert({
    where: {
      stateId_name: {
        stateId: state.id,
        name: cityName,
      },
    },
    update: {},
    create: {
      countryId: country.id,
      stateId: state.id,
      name: cityName,
      isCapital: isCapitalCity(cityName, lookup.stateCode),
    },
  });

  let metroAreaId: number | null = null;
  if (lookup.metroAreaName) {
    const metroArea = await prisma.metroArea.upsert({
      where: {
        stateId_name: {
          stateId: state.id,
          name: lookup.metroAreaName,
        },
      },
      update: {},
      create: {
        stateId: state.id,
        name: lookup.metroAreaName,
      },
    });
    metroAreaId = metroArea.id;
    await prisma.metroAreaCity.upsert({
      where: {
        metroAreaId_cityId: {
          metroAreaId: metroArea.id,
          cityId: city.id,
        },
      },
      update: {},
      create: {
        metroAreaId: metroArea.id,
        cityId: city.id,
      },
    });
  }

  return {
    countryId: country.id,
    stateId: state.id,
    cityId: city.id,
    metroAreaId,
    stateCode: state.code,
    regionCode: state.regionCode,
    metroAreaName: lookup.metroAreaName,
  };
}

function buildPackageInfo(quantity: number | null | undefined, unit: string | null | undefined) {
  if (!quantity || !unit) return null;
  return `${quantity}${unit}`;
}

function extractNeighborhood(displayName: string | null) {
  if (!displayName) return null;
  const parts = displayName.split(",").map((part) => part.trim()).filter(Boolean);
  return parts[1] ?? parts[0] ?? null;
}

function includesAll(value: string, tokens: string[]) {
  return tokens.every((token) => value.includes(token));
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function lookupCityMetadata(cityName: string) {
  const normalized = cityName.trim().toLowerCase();
  const map: Record<string, { stateCode: string; stateName: string; regionCode: string; metroAreaName: string | null }> = {
    "sao paulo": {
      stateCode: "SP",
      stateName: "Sao Paulo",
      regionCode: "SE",
      metroAreaName: "Regiao Metropolitana de Sao Paulo",
    },
    campinas: {
      stateCode: "SP",
      stateName: "Sao Paulo",
      regionCode: "SE",
      metroAreaName: "Regiao Metropolitana de Campinas",
    },
    santos: {
      stateCode: "SP",
      stateName: "Sao Paulo",
      regionCode: "SE",
      metroAreaName: "Baixada Santista",
    },
    "rio de janeiro": {
      stateCode: "RJ",
      stateName: "Rio de Janeiro",
      regionCode: "SE",
      metroAreaName: "Regiao Metropolitana do Rio de Janeiro",
    },
    "belo horizonte": {
      stateCode: "MG",
      stateName: "Minas Gerais",
      regionCode: "SE",
      metroAreaName: "Regiao Metropolitana de Belo Horizonte",
    },
  };

  return map[normalized] ?? null;
}

function isCapitalCity(cityName: string, stateCode: string) {
  const normalized = cityName.trim().toLowerCase();
  return (
    (stateCode === "SP" && normalized === "sao paulo") ||
    (stateCode === "RJ" && normalized === "rio de janeiro") ||
    (stateCode === "MG" && normalized === "belo horizonte")
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "MelhorPrecoBot/1.0 (+https://local.app)",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Open Prices respondeu com status ${response.status} para ${url}.`);
  }

  return (await response.json()) as T;
}

async function cleanupDuplicateNormalizedObservations(prisma: PrismaClient) {
  const rows = await prisma.rawPriceObservation.findMany({
    where: {
      normalizedProductId: { not: null },
      priceRecord: null,
      processingStatus: "normalized",
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      normalizedProductId: true,
      marketId: true,
      collectedAt: true,
    },
  });

  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.normalizedProductId || !row.marketId) continue;
    const key = `${row.normalizedProductId}:${row.marketId}:${row.collectedAt.toISOString()}`;
    const existingPriceRecord = await prisma.priceRecord.findFirst({
      where: {
        productId: row.normalizedProductId,
        marketId: row.marketId,
        collectedAt: row.collectedAt,
      },
      select: { id: true },
    });

    if (existingPriceRecord || seen.has(key)) {
      await prisma.rawPriceObservation.update({
        where: { id: row.id },
        data: {
          processingStatus: "failed",
          processingNotes: "Observacao duplicada em relacao ao historico consolidado.",
        },
      });
      continue;
    }

    seen.add(key);
  }
}

function isDuplicatePersistenceError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("Unique constraint failed on the fields: (`productId`,`marketId`,`collectedAt`)")
  );
}
