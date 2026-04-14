import test from "node:test";
import assert from "node:assert/strict";

import { normalizeRawObservation } from "../src/lib/automation/normalization";

test("normalizeRawObservation matches canonical product and computes comparable price", () => {
  const result = normalizeRawObservation(
    {
      rawProductName: "Cafe tradicional 500g oferta",
      rawBrand: "Cafe",
      rawPackageInfo: "500g",
      rawPrice: 18.5,
      confidenceScore: 0.9,
    },
    [
      {
        id: 2,
        canonicalKey: "cafe-torrado-moido-500g",
        name: "Cafe Torrado e Moido 500g",
        category: "mercearia",
        subcategory: null,
        canonicalBrand: null,
        unit: "pacote",
        comparableUnit: "kg",
        comparableAmount: 0.5,
        packageMinAmount: null,
        packageMaxAmount: null,
        equivalentGroup: null,
        description: null,
        active: true,
        createdAt: new Date(),
        aliases: [
          {
            id: 1,
            productId: 2,
            alias: "cafe tradicional 500g",
            aliasType: "name_variant",
            brand: null,
            packagePattern: null,
            normalizedUnit: "kg",
            normalizedAmount: 0.5,
            confidenceThreshold: 0.6,
            evidenceSource: null,
            createdAt: new Date(),
          },
        ],
      },
    ],
  );

  assert.equal(result.processingStatus, "normalized");
  assert.equal(result.normalizedProductId, 2);
  assert.equal(result.comparableUnit, "kg");
  assert.equal(result.comparableUnitPrice, 37);
});

test("normalizeRawObservation sends unknown item to review", () => {
  const result = normalizeRawObservation(
    {
      rawProductName: "Mistura lactea promocional 850g",
      rawBrand: "Marca X",
      rawPackageInfo: "850g",
      rawPrice: 7.4,
      confidenceScore: 0.4,
    },
    [],
  );

  assert.equal(result.processingStatus, "pending_review");
  assert.equal(result.normalizedProductId, undefined);
});

test("normalizeRawObservation uses fuzzy matching but keeps out-of-range package under review", () => {
  const result = normalizeRawObservation(
    {
      rawProductName: "Cafe tradicional 500g versao familia",
      rawBrand: "Base Cafe",
      rawPackageInfo: "800g",
      rawPrice: 24,
      confidenceScore: 0.91,
    },
    [
      {
        id: 2,
        canonicalKey: "cafe-torrado-moido-500g",
        name: "Cafe Torrado e Moido 500g",
        category: "mercearia",
        subcategory: "bebidas_quentes",
        canonicalBrand: "Base Cafe",
        unit: "pacote",
        comparableUnit: "kg",
        comparableAmount: 0.5,
        packageMinAmount: 0.45,
        packageMaxAmount: 0.55,
        equivalentGroup: "cafe-torrado-moido",
        description: null,
        active: true,
        createdAt: new Date(),
        aliases: [
          {
            id: 1,
            productId: 2,
            alias: "cafe tradicional 500g",
            aliasType: "name_variant",
            brand: "Base Cafe",
            packagePattern: null,
            normalizedUnit: "kg",
            normalizedAmount: 0.5,
            confidenceThreshold: 0.6,
            evidenceSource: null,
            createdAt: new Date(),
          },
        ],
      },
    ],
  );

  assert.equal(result.processingStatus, "pending_review");
  assert.equal(result.normalizedProductId, 2);
  assert.match(result.processingNotes ?? "", /embalagem observada/i);
});
