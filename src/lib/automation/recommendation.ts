import type { ExternalEvent, PredictionSignal, Product } from "@prisma/client";
import type { PriceRecordWithRelations } from "@/lib/domain/types";
import { computeProductMetrics } from "@/lib/domain/analytics";

export type RecommendationDraft = Pick<
  PredictionSignal,
  | "signalType"
  | "confidenceScore"
  | "message"
  | "rationale"
  | "recommendation"
  | "regionalSpread"
  | "pressureScore"
  | "basedOnDate"
  | "validUntil"
> & {
  productId: number;
  category: string;
};

export function buildRecommendationSignal(
  product: Pick<Product, "id" | "name" | "category">,
  records: PriceRecordWithRelations[],
  events: Pick<ExternalEvent, "eventType" | "signalDirection" | "severity" | "title">[],
): RecommendationDraft {
  const metrics = computeProductMetrics(records);
  const upwardEvents = events.filter((event) => event.signalDirection === "alta");
  const downwardEvents = events.filter((event) => event.signalDirection === "queda");
  const eventPressure = upwardEvents.reduce((sum, item) => sum + item.severity, 0) - downwardEvents.reduce((sum, item) => sum + item.severity, 0);
  const variation = metrics.weeklyVariation ?? 0;
  const regionalSpread = computeRegionalSpread(records);
  const pressureScore = Number((Math.max(-10, Math.min(10, eventPressure)) + regionalSpread / 12).toFixed(2));

  let signalType = "monitorar";
  let message = `Monitorar ${product.name} nos proximos dias.`;
  let recommendation = "Monitorar proximos dias";
  let rationale = "O historico atual ainda nao produz um sinal forte o bastante para uma recomendacao mais agressiva.";
  let confidenceScore = 0.52;

  if (metrics.status.code === "abaixo_faixa" && variation <= 0 && eventPressure <= 0) {
    signalType = "melhor_janela_provavel";
    message = `${product.name} apresenta melhor janela provavel de compra, sem promessa deterministica.`;
    recommendation = "Melhor janela provavel de compra";
    rationale = "Preco abaixo da faixa, variacao recente comportada e ausencia de pressao externa relevante.";
    confidenceScore = regionalSpread > 12 ? 0.69 : 0.74;
  } else if (metrics.trend.code === "alta" || eventPressure >= 4 || regionalSpread > 18) {
    signalType = "pressao_de_alta";
    message = `${product.name} mostra pressao de alta e pode encarecer se o contexto persistir.`;
    recommendation = "Antecipar monitoramento ou compra";
    rationale = "Alta recente combinada com eventos externos de custo, oferta ou dispersao regional sugere continuidade de pressao.";
    confidenceScore = regionalSpread > 18 ? 0.74 : 0.71;
  } else if (metrics.trend.code === "queda" && metrics.status.code !== "acima_faixa" && regionalSpread < 15) {
    signalType = "possivel_acomodacao";
    message = `${product.name} indica possivel acomodacao de preco no curto prazo.`;
    recommendation = "Acompanhar acomodacao";
    rationale = "Queda recente ou alivio de pressao sugere desaceleracao, mas ainda sem garantia de fundo de preco.";
    confidenceScore = 0.66;
  } else if (downwardEvents.length > upwardEvents.length && variation < 0) {
    signalType = "chance_de_queda";
    message = `${product.name} tem chance de queda adicional se os fatores externos se mantiverem.`;
    recommendation = "Monitorar proximos dias";
    rationale = "Historico recente e fatores externos aliviam custo, favorecendo nova queda moderada.";
    confidenceScore = 0.63;
  }

  const basedOnDate = new Date();
  const validUntil = new Date(basedOnDate);
  validUntil.setDate(validUntil.getDate() + 5);

  return {
    productId: product.id,
    category: product.category,
    signalType,
    confidenceScore: Number(confidenceScore.toFixed(2)),
    message,
    rationale,
    recommendation,
    regionalSpread: Number(regionalSpread.toFixed(2)),
    pressureScore,
    basedOnDate,
    validUntil,
  };
}

function computeRegionalSpread(records: PriceRecordWithRelations[]) {
  if (records.length < 2) return 0;
  const latestByCity = new Map<string, number>();

  for (const record of records) {
    latestByCity.set(record.city, record.totalPrice);
  }

  const prices = Array.from(latestByCity.values());
  if (prices.length < 2) return 0;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  if (!avg) return 0;

  return ((max - min) / avg) * 100;
}
