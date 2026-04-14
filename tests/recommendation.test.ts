import test from "node:test";
import assert from "node:assert/strict";

import { buildRecommendationSignal } from "../src/lib/automation/recommendation";
import type { PriceRecordWithRelations } from "../src/lib/domain/types";

test("buildRecommendationSignal returns cautious buy-window message for favorable setup", () => {
  const records: PriceRecordWithRelations[] = [];
  const start = new Date("2026-02-25T10:00:00.000Z");

  for (let day = 0; day < 35; day += 1) {
    const collectedAt = new Date(start);
    collectedAt.setUTCDate(start.getUTCDate() + day);
    records.push({
      id: day + 1,
      productId: 3,
      marketId: 1,
      price: 10 - day * 0.1,
      freight: 0,
      totalPrice: 10 - day * 0.1,
      collectedAt,
      productName: "Leite Integral 1L",
      category: "mercearia",
      unit: "caixa",
      marketName: "Mercado Centro",
      city: "Sao Paulo",
      state: "SP",
      channel: "supermercado",
    });
  }

  const signal = buildRecommendationSignal(
    { id: 3, name: "Leite Integral 1L", category: "mercearia" },
    records,
    [{ eventType: "frete", signalDirection: "queda", severity: 2, title: "Frete alivia" }],
  );

  assert.equal(signal.signalType, "melhor_janela_provavel");
  assert.match(signal.message, /melhor janela provavel/i);
  assert.ok(signal.confidenceScore < 0.8);
});
