import test from "node:test";
import assert from "node:assert/strict";

import { computeProductMetrics } from "../src/lib/domain/analytics";
import type { PriceRecordWithRelations } from "../src/lib/domain/types";

test("computeProductMetrics preserves the validated business rules", () => {
  const records: PriceRecordWithRelations[] = [];
  const start = new Date("2026-02-25T10:00:00.000Z");

  for (let day = 0; day < 35; day += 1) {
    const collectedAt = new Date(start);
    collectedAt.setUTCDate(start.getUTCDate() + day);
    records.push({
      id: day + 1,
      productId: 1,
      marketId: 1,
      price: 10 + day,
      freight: 0,
      totalPrice: 10 + day,
      collectedAt,
      productName: "Produto teste",
      category: "mercearia",
      unit: "un",
      marketName: "Mercado Centro",
      city: "Sao Paulo",
      state: "SP",
      channel: "supermercado",
    });
  }

  const metrics = computeProductMetrics(records);
  assert.equal(metrics.currentPrice, 44);
  assert.equal(Number(metrics.avg7?.toFixed(1)), 41.0);
  assert.equal(Number(metrics.avg30?.toFixed(1)), 29.5);
  assert.equal(metrics.minimum, 10);
  assert.equal(metrics.maximum, 44);
  assert.equal(metrics.trend.code, "alta");
  assert.equal(metrics.insufficientHistory7, false);
  assert.equal(metrics.insufficientHistory30, false);
});
