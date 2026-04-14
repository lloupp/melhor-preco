import type { Product, ProductAlias, RawPriceObservation } from "@prisma/client";

type CanonicalProduct = Product & { aliases: ProductAlias[] };

export type NormalizationResult = {
  processingStatus: "normalized" | "pending_review" | "failed";
  normalizedProductId?: number;
  normalizedName?: string;
  normalizedUnit?: string;
  normalizedAmount?: number;
  comparableUnitPrice?: number;
  comparableUnit?: string;
  processingNotes?: string;
  confidenceScore: number;
};

export function normalizeRawObservation(
  observation: Pick<
    RawPriceObservation,
    "rawProductName" | "rawBrand" | "rawPackageInfo" | "rawPrice" | "confidenceScore"
  >,
  products: CanonicalProduct[],
): NormalizationResult {
  const normalizedText = normalizeText([observation.rawProductName, observation.rawBrand, observation.rawPackageInfo].filter(Boolean).join(" "));
  const packageInfo = extractPackageInfo(observation.rawPackageInfo || observation.rawProductName);
  const matched = matchCanonicalProduct(normalizedText, observation.rawBrand ?? null, products);

  if (!matched) {
    return {
      processingStatus: "pending_review",
      processingNotes: "Nenhum produto canonico atingiu confianca suficiente para pareamento.",
      confidenceScore: Number(Math.max(observation.confidenceScore * 0.5, 0.25).toFixed(2)),
    };
  }

  if (!packageInfo) {
    return {
      processingStatus: "pending_review",
      normalizedProductId: matched.id,
      normalizedName: matched.name,
      processingNotes: "Produto reconhecido, mas a embalagem nao pode ser padronizada automaticamente.",
      confidenceScore: Number(Math.max(observation.confidenceScore * 0.7, 0.45).toFixed(2)),
    };
  }

  const comparableAmount = convertToComparableAmount(packageInfo.amount, packageInfo.unit, matched.comparableUnit);
  if (comparableAmount == null || comparableAmount === 0) {
    return {
      processingStatus: "failed",
      normalizedProductId: matched.id,
      normalizedName: matched.name,
      processingNotes: "Nao foi possivel converter a unidade observada para a unidade comparavel do produto canonico.",
      confidenceScore: Number(Math.max(observation.confidenceScore * 0.5, 0.3).toFixed(2)),
    };
  }

  return {
    processingStatus: "normalized",
    normalizedProductId: matched.id,
    normalizedName: matched.name,
    normalizedUnit: packageInfo.unit,
    normalizedAmount: packageInfo.amount,
    comparableUnitPrice: Number((observation.rawPrice / comparableAmount).toFixed(4)),
    comparableUnit: matched.comparableUnit,
    processingNotes: `Pareamento automatico com ${matched.name}.`,
    confidenceScore: Number(Math.min(0.99, matched.matchConfidence * observation.confidenceScore).toFixed(2)),
  };
}

export function extractPackageInfo(value: string): { amount: number; unit: string } | null {
  const match = normalizeText(value).match(/(\d+(?:[.,]\d+)?)\s?(kg|g|l|ml|un)/);
  if (!match) return null;

  return {
    amount: Number(match[1].replace(",", ".")),
    unit: match[2],
  };
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchCanonicalProduct(input: string, brand: string | null, products: CanonicalProduct[]) {
  let bestMatch:
    | (CanonicalProduct & {
        matchConfidence: number;
      })
    | null = null;

  for (const product of products) {
    let confidence = 0;
    if (input.includes(normalizeText(product.name))) {
      confidence = 0.92;
    }

    for (const alias of product.aliases) {
      const aliasText = normalizeText(alias.alias);
      if (aliasText && input.includes(aliasText)) {
        confidence = Math.max(confidence, 0.78);
        if (alias.brand && brand && normalizeText(alias.brand) === normalizeText(brand)) {
          confidence = Math.max(confidence, 0.9);
        }
      }
    }

    if (!bestMatch || confidence > bestMatch.matchConfidence) {
      bestMatch = confidence > 0 ? { ...product, matchConfidence: confidence } : bestMatch;
    }
  }

  return bestMatch;
}

function convertToComparableAmount(amount: number, unit: string, targetUnit: string): number | null {
  if (unit === targetUnit) return amount;
  if (unit === "g" && targetUnit === "kg") return amount / 1000;
  if (unit === "kg" && targetUnit === "g") return amount * 1000;
  if (unit === "ml" && targetUnit === "l") return amount / 1000;
  if (unit === "l" && targetUnit === "ml") return amount * 1000;
  if (unit === "un" && targetUnit === "un") return amount;
  return null;
}
