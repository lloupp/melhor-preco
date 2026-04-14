import { PrismaClient } from "@prisma/client";
import { runAutomationPipeline } from "../src/lib/automation/pipeline";

const prisma = new PrismaClient();

const products = [
  {
    id: 1,
    canonicalKey: "arroz-tipo-1-5kg",
    name: "Arroz Tipo 1 5kg",
    category: "mercearia",
    unit: "pacote",
    comparableUnit: "kg",
    comparableAmount: 5,
    description: "Pacote de arroz branco tipo 1 com 5kg.",
    base: 31.9,
    amplitude: 0.8,
    trend: 0.015,
    aliases: ["arroz tipo 1", "arroz branco 5kg"],
  },
  {
    id: 2,
    canonicalKey: "cafe-torrado-moido-500g",
    name: "Cafe Torrado e Moido 500g",
    category: "mercearia",
    unit: "pacote",
    comparableUnit: "kg",
    comparableAmount: 0.5,
    description: "Cafe tradicional embalado a vacuo com 500g.",
    base: 18.5,
    amplitude: 0.9,
    trend: 0.055,
    aliases: ["cafe tradicional 500g", "cafe moido 500g"],
  },
  {
    id: 3,
    canonicalKey: "leite-integral-1l",
    name: "Leite Integral 1L",
    category: "mercearia",
    unit: "caixa",
    comparableUnit: "l",
    comparableAmount: 1,
    description: "Leite integral UHT em embalagem de 1 litro.",
    base: 5.6,
    amplitude: 0.25,
    trend: -0.02,
    aliases: ["leite integral 1l", "leite uht 1l"],
  },
  {
    id: 4,
    canonicalKey: "azeite-extra-virgem-500ml",
    name: "Azeite Extra Virgem 500ml",
    category: "mercearia",
    unit: "garrafa",
    comparableUnit: "l",
    comparableAmount: 0.5,
    description: "Azeite extra virgem importado com 500ml.",
    base: 36.9,
    amplitude: 1.2,
    trend: 0.03,
    aliases: ["azeite 500ml", "azeite extra virgem"],
  },
  {
    id: 5,
    canonicalKey: "whey-protein-concentrado-900g",
    name: "Whey Protein Concentrado 900g",
    category: "suplementos",
    unit: "pote",
    comparableUnit: "kg",
    comparableAmount: 0.9,
    description: "Whey concentrado sabor baunilha com 900g.",
    base: 119.9,
    amplitude: 3.5,
    trend: -0.04,
    aliases: ["whey concentrado 900g", "whey protein 900g"],
  },
  {
    id: 6,
    canonicalKey: "creatina-monohidratada-300g",
    name: "Creatina Monohidratada 300g",
    category: "suplementos",
    unit: "pote",
    comparableUnit: "kg",
    comparableAmount: 0.3,
    description: "Creatina monohidratada micronizada com 300g.",
    base: 84.9,
    amplitude: 2.4,
    trend: 0.02,
    aliases: ["creatina 300g", "creatina monohidratada"],
  },
];

const markets = [
  { id: 1, name: "Mercado Centro", city: "Sao Paulo", state: "SP", channel: "supermercado", priceFactor: 1.0 },
  { id: 2, name: "Atacado Mooca", city: "Sao Paulo", state: "SP", channel: "atacado", priceFactor: 0.96 },
  { id: 3, name: "Super Campinas", city: "Campinas", state: "SP", channel: "supermercado", priceFactor: 1.03 },
  { id: 4, name: "Clube Saudavel", city: "Santos", state: "SP", channel: "especializado", priceFactor: 1.04 },
];

const externalEvents = [
  {
    title: "Chuva reduz ritmo da safra de cafe",
    description: "Clima irregular reduziu a previsibilidade de oferta no curto prazo e pressionou o cafe no atacado.",
    eventType: "clima",
    sourceName: "Observatorio Setorial",
    occurredAtOffsetDays: 6,
    severity: 4,
    confidenceScore: 0.82,
    signalDirection: "alta",
    city: null,
    region: "Sudeste",
    impactSummary: "Pressao de alta para cafe e itens sensiveis a frete.",
    categories: ["mercearia"],
    productIds: [2],
  },
  {
    title: "Frete regional desacelera no corredor paulista",
    description: "Melhora na consolidacao de rotas reduziu custo logistico em parte dos abastecimentos urbanos.",
    eventType: "frete",
    sourceName: "Painel Logistico",
    occurredAtOffsetDays: 10,
    severity: 3,
    confidenceScore: 0.76,
    signalDirection: "queda",
    city: "Sao Paulo",
    region: "SP",
    impactSummary: "Alivio moderado de custo para categorias de giro rapido.",
    categories: ["mercearia"],
    productIds: [1, 3],
  },
  {
    title: "Dolar em alta pressiona importados",
    description: "Cambio voltou a pressionar itens importados e suplementos dependentes de insumo externo.",
    eventType: "cambio",
    sourceName: "Radar Macro",
    occurredAtOffsetDays: 4,
    severity: 4,
    confidenceScore: 0.79,
    signalDirection: "alta",
    city: null,
    region: "Brasil",
    impactSummary: "Pressao para azeite e suplementos.",
    categories: ["suplementos"],
    productIds: [4, 5, 6],
  },
  {
    title: "Reposicao acelera no leite longa vida",
    description: "Oferta mais regular reduziu a tensao de abastecimento em leite UHT.",
    eventType: "oferta_demanda",
    sourceName: "Boletim Varejo",
    occurredAtOffsetDays: 8,
    severity: 2,
    confidenceScore: 0.71,
    signalDirection: "queda",
    city: null,
    region: "Sudeste",
    impactSummary: "Acomodacao moderada para leite longa vida.",
    categories: ["mercearia"],
    productIds: [3],
  },
];

function round(value: number): number {
  return Number(value.toFixed(2));
}

function computeObservedPrice(
  product: (typeof products)[number],
  market: (typeof markets)[number],
  dayOffset: number,
) {
  const seasonality = Math.sin((dayOffset + product.id * 2 + market.id) / 4.1) * product.amplitude;
  const longTerm = product.base * product.trend * (dayOffset / 44);
  const pulse = (((dayOffset + product.id + market.id) % 6) - 2.5) * 0.23;
  const rawPrice = Math.max((product.base + seasonality + longTerm + pulse) * market.priceFactor, 0.5);
  return round(rawPrice);
}

function buildRawProductName(product: (typeof products)[number], marketId: number) {
  const variants: Record<number, string> = {
    1: product.name,
    2: product.aliases[0] ?? product.name,
    3: `${product.name} oferta`,
    4: `${product.aliases[1] ?? product.name} premium`,
  };
  return variants[marketId] ?? product.name;
}

async function main() {
  await prisma.processingIssue.deleteMany();
  await prisma.pipelineRun.deleteMany();
  await prisma.predictionSignal.deleteMany();
  await prisma.externalEventProduct.deleteMany();
  await prisma.externalEventCategory.deleteMany();
  await prisma.externalEvent.deleteMany();
  await prisma.marketFactor.deleteMany();
  await prisma.priceRecord.deleteMany();
  await prisma.rawPriceObservation.deleteMany();
  await prisma.productAlias.deleteMany();
  await prisma.market.deleteMany();
  await prisma.product.deleteMany();

  await prisma.product.createMany({
    data: products.map(({ base, amplitude, trend, aliases, ...product }) => product),
  });

  await prisma.productAlias.createMany({
    data: products.flatMap((product) =>
      product.aliases.map((alias) => ({
        productId: product.id,
        alias,
        normalizedUnit: product.comparableUnit,
        normalizedAmount: product.comparableAmount,
      })),
    ),
  });

  await prisma.market.createMany({
    data: markets.map(({ priceFactor, ...market }) => market),
  });

  const today = new Date();
  const rawInputs = [];

  for (let dayOffset = 0; dayOffset < 45; dayOffset += 1) {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() - (44 - dayOffset));

    for (const product of products) {
      for (const market of markets) {
        const collectedAt = new Date(currentDate);
        collectedAt.setHours(9 + market.id, 0, 0, 0);
        rawInputs.push({
          sourceType: market.channel === "atacado" ? "atacado" : "varejo",
          sourceName: market.name,
          collectedAt,
          rawProductName: buildRawProductName(product, market.id),
          rawBrand: product.name.split(" ")[0],
          rawPackageInfo: product.name.match(/(\d+(?:kg|g|l|ml))/i)?.[0] ?? null,
          rawPrice: computeObservedPrice(product, market, dayOffset),
          rawCurrency: "BRL",
          city: market.city,
          neighborhood: market.id === 1 ? "Centro" : market.id === 2 ? "Mooca" : market.id === 3 ? "Cambui" : "Gonzaga",
          sourceUrl: `https://fonte.exemplo/${market.id}/${product.canonicalKey}`,
          evidenceText: `${market.name} registrou ${buildRawProductName(product, market.id)} por observacao automatica.`,
          confidenceScore: 0.86,
          marketId: market.id,
        });
      }
    }
  }

  rawInputs.push({
    sourceType: "varejo",
    sourceName: "Mercado Centro",
    collectedAt: new Date(today),
    rawProductName: "Mistura lactea promocional 850g",
    rawBrand: "Marca X",
    rawPackageInfo: "850g",
    rawPrice: 7.4,
    rawCurrency: "BRL",
    city: "Sao Paulo",
    neighborhood: "Centro",
    sourceUrl: null,
    evidenceText: "Item propositalmente nao mapeado para demonstrar fila de revisao.",
    confidenceScore: 0.41,
    marketId: 1,
  });

  rawInputs.push({
    sourceType: "varejo",
    sourceName: "Clube Saudavel",
    collectedAt: new Date(today),
    rawProductName: "Suplemento proteico especial",
    rawBrand: "Marca Y",
    rawPackageInfo: null,
    rawPrice: 92.9,
    rawCurrency: "BRL",
    city: "Santos",
    neighborhood: "Gonzaga",
    sourceUrl: null,
    evidenceText: "Registro com embalagem ambigua para exercitar pendencia de normalizacao.",
    confidenceScore: 0.52,
    marketId: 4,
  });

  for (const event of externalEvents) {
    const occurredAt = new Date(today);
    occurredAt.setDate(today.getDate() - event.occurredAtOffsetDays);

    const created = await prisma.externalEvent.create({
      data: {
        title: event.title,
        description: event.description,
        eventType: event.eventType,
        sourceName: event.sourceName,
        occurredAt,
        severity: event.severity,
        confidenceScore: event.confidenceScore,
        signalDirection: event.signalDirection,
        city: event.city,
        region: event.region,
        impactSummary: event.impactSummary,
      },
    });

    if (event.categories.length > 0) {
      await prisma.externalEventCategory.createMany({
        data: event.categories.map((category) => ({
          externalEventId: created.id,
          category,
          relevanceScore: 0.8,
        })),
      });
    }

    if (event.productIds.length > 0) {
      await prisma.externalEventProduct.createMany({
        data: event.productIds.map((productId) => ({
          externalEventId: created.id,
          productId,
          relevanceScore: 0.85,
        })),
      });
    }
  }

  await runAutomationPipeline(prisma, { rawInputs });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
