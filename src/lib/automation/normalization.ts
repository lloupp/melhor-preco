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
  const matched = matchCanonicalProduct(normalizedText, observation.rawBrand ?? null, packageInfo, products);

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
      confidenceScore: Number(Math.max(observation.confidenceScore * Math.max(matched.matchConfidence - 0.1, 0.55), 0.45).toFixed(2)),
    };
  }

  const comparableAmount = convertToComparableAmount(packageInfo.amount, packageInfo.unit, matched.comparableUnit);
  if (comparableAmount == null || comparableAmount === 0) {
    return {
      processingStatus: "failed",
      normalizedProductId: matched.id,
      normalizedName: matched.name,
      processingNotes: "Nao foi possivel converter a unidade observada para a unidade comparavel do produto canonico.",
      confidenceScore: Number(Math.max(observation.confidenceScore * Math.max(matched.matchConfidence - 0.2, 0.4), 0.3).toFixed(2)),
    };
  }

  if (!isPackagingCompatible(comparableAmount, matched)) {
    return {
      processingStatus: "pending_review",
      normalizedProductId: matched.id,
      normalizedName: matched.name,
      normalizedUnit: packageInfo.unit,
      normalizedAmount: packageInfo.amount,
      comparableUnit: matched.comparableUnit,
      comparableUnitPrice: Number((observation.rawPrice / comparableAmount).toFixed(4)),
      processingNotes: "Produto reconhecido, mas a embalagem observada esta fora da faixa comparavel aceita.",
      confidenceScore: Number(Math.max(observation.confidenceScore * Math.max(matched.matchConfidence - 0.25, 0.42), 0.35).toFixed(2)),
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
    processingNotes: `Pareamento automatico com ${matched.name} via matching inteligente leve.`,
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

function matchCanonicalProduct(
  input: string,
  brand: string | null,
  packageInfo: { amount: number; unit: string } | null,
  products: CanonicalProduct[],
) {
  let bestMatch:
    | (CanonicalProduct & {
        matchConfidence: number;
      })
    | null = null;

  for (const product of products) {
    const canonicalName = normalizeText(product.name);
    const aliasScores = product.aliases.map((alias) => scoreAliasMatch(input, brand, alias));
    const baseSimilarity = Math.max(
      input.includes(canonicalName) ? 0.92 : 0,
      tokenOverlapScore(input, canonicalName),
      stringSimilarity(input, canonicalName),
      ...aliasScores,
    );
    let confidence = baseSimilarity;

    if (product.canonicalBrand && brand) {
      const normalizedBrand = normalizeText(brand);
      if (normalizedBrand === normalizeText(product.canonicalBrand)) {
        confidence += 0.07;
      } else if (normalizedBrand && canonicalName.includes(normalizedBrand)) {
        confidence += 0.04;
      }
    }

    if (packageInfo) {
      const comparableAmount = convertToComparableAmount(packageInfo.amount, packageInfo.unit, product.comparableUnit);
      if (comparableAmount != null) {
        const packageScore = packagingScore(comparableAmount, product);
        confidence += packageScore;
      } else {
        confidence -= 0.08;
      }
    }

    if (product.equivalentGroup && input.includes(normalizeText(product.equivalentGroup))) {
      confidence += 0.03;
    }

    confidence = Number(Math.max(0, Math.min(0.98, confidence)).toFixed(4));

    if (!bestMatch || confidence > bestMatch.matchConfidence) {
      bestMatch = confidence >= 0.58 ? { ...product, matchConfidence: confidence } : bestMatch;
    }
  }

  return bestMatch;
}

function scoreAliasMatch(input: string, brand: string | null, alias: ProductAlias) {
  const aliasText = normalizeText(alias.alias);
  if (!aliasText) return 0;

  let confidence = Math.max(
    input.includes(aliasText) ? 0.8 : 0,
    tokenOverlapScore(input, aliasText),
    stringSimilarity(input, aliasText),
  );

  if (alias.brand && brand && normalizeText(alias.brand) === normalizeText(brand)) {
    confidence += 0.08;
  }

  return confidence;
}

function packagingScore(
  comparableAmount: number,
  product: Pick<CanonicalProduct, "comparableAmount" | "packageMinAmount" | "packageMaxAmount">,
) {
  const minAmount = product.packageMinAmount ?? product.comparableAmount * 0.9;
  const maxAmount = product.packageMaxAmount ?? product.comparableAmount * 1.1;
  if (comparableAmount >= minAmount && comparableAmount <= maxAmount) {
    return 0.09;
  }

  const distance = Math.abs(comparableAmount - product.comparableAmount) / Math.max(product.comparableAmount, 0.001);
  if (distance <= 0.2) return 0.02;
  if (distance <= 0.35) return -0.05;
  return -0.12;
}

function isPackagingCompatible(
  comparableAmount: number,
  product: Pick<CanonicalProduct, "comparableAmount" | "packageMinAmount" | "packageMaxAmount">,
) {
  const minAmount = product.packageMinAmount ?? product.comparableAmount * 0.9;
  const maxAmount = product.packageMaxAmount ?? product.comparableAmount * 1.1;
  return comparableAmount >= minAmount && comparableAmount <= maxAmount;
}

function tokenOverlapScore(input: string, candidate: string) {
  const inputTokens = new Set(input.split(" ").filter(Boolean));
  const candidateTokens = new Set(candidate.split(" ").filter(Boolean));
  if (inputTokens.size === 0 || candidateTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of inputTokens) {
    if (candidateTokens.has(token)) intersection += 1;
  }

  const denominator = Math.max(inputTokens.size, candidateTokens.size);
  return Number(((intersection / denominator) * 0.82).toFixed(4));
}

function stringSimilarity(input: string, candidate: string) {
  const longer = Math.max(input.length, candidate.length);
  if (longer === 0) return 0;
  const distance = levenshteinDistance(input, candidate);
  return Number(((1 - distance / longer) * 0.76).toFixed(4));
}

function levenshteinDistance(a: string, b: string) {
  const matrix = Array.from({ length: b.length + 1 }, (_, rowIndex) =>
    Array.from({ length: a.length + 1 }, (_, columnIndex) => {
      if (rowIndex === 0) return columnIndex;
      if (columnIndex === 0) return rowIndex;
      return 0;
    }),
  );

  for (let row = 1; row <= b.length; row += 1) {
    for (let column = 1; column <= a.length; column += 1) {
      const cost = a[column - 1] === b[row - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost,
      );
    }
  }

  return matrix[b.length][a.length];
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
