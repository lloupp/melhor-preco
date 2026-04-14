import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  { id: 1, name: "Arroz Tipo 1 5kg", category: "mercearia", unit: "pacote", description: "Pacote de arroz branco tipo 1 com 5kg.", base: 31.9, amplitude: 0.8, trend: 0.015 },
  { id: 2, name: "Cafe Torrado e Moido 500g", category: "mercearia", unit: "pacote", description: "Cafe tradicional embalado a vacuo com 500g.", base: 18.5, amplitude: 0.9, trend: 0.055 },
  { id: 3, name: "Leite Integral 1L", category: "mercearia", unit: "caixa", description: "Leite integral UHT em embalagem de 1 litro.", base: 5.6, amplitude: 0.25, trend: -0.02 },
  { id: 4, name: "Azeite Extra Virgem 500ml", category: "mercearia", unit: "garrafa", description: "Azeite extra virgem importado com 500ml.", base: 36.9, amplitude: 1.2, trend: 0.03 },
  { id: 5, name: "Whey Protein Concentrado 900g", category: "suplementos", unit: "pote", description: "Whey concentrado sabor baunilha com 900g.", base: 119.9, amplitude: 3.5, trend: -0.04 },
  { id: 6, name: "Creatina Monohidratada 300g", category: "suplementos", unit: "pote", description: "Creatina monohidratada micronizada com 300g.", base: 84.9, amplitude: 2.4, trend: 0.02 },
];

const markets = [
  { id: 1, name: "Mercado Centro", city: "Sao Paulo", state: "SP", channel: "supermercado", priceFactor: 1.0, freightFactor: 1.0 },
  { id: 2, name: "Atacado Mooca", city: "Sao Paulo", state: "SP", channel: "atacado", priceFactor: 0.96, freightFactor: 1.15 },
  { id: 3, name: "Super Campinas", city: "Campinas", state: "SP", channel: "supermercado", priceFactor: 1.03, freightFactor: 1.05 },
  { id: 4, name: "Clube Saudavel", city: "Santos", state: "SP", channel: "especializado", priceFactor: 1.04, freightFactor: 0.92 },
];

const factorTemplates = [
  { title: "Promocao de encarte", description: "Desconto temporario aplicado pelo mercado no fechamento da semana.", direction: "queda", intensity: 4 },
  { title: "Reajuste de fornecedor", description: "Fornecedor repassou custo acima da media no ultimo abastecimento.", direction: "alta", intensity: 4 },
  { title: "Frete regional", description: "Custo logistico variou por distancia e consolidacao de rotas.", direction: "alta", intensity: 2 },
  { title: "Giro de estoque", description: "Mercado acelerou a saida de itens com estoque mais antigo.", direction: "queda", intensity: 3 },
  { title: "Demanda local", description: "Consumo regional alterou o ritmo de reposicao do item.", direction: "neutro", intensity: 2 },
];

function round(value: number): number {
  return Number(value.toFixed(2));
}

function computePrice(
  product: (typeof products)[number],
  market: (typeof markets)[number],
  dayOffset: number,
): { price: number; freight: number; totalPrice: number } {
  const seasonality = Math.sin((dayOffset + product.id * 2 + market.id) / 4.1) * product.amplitude;
  const longTerm = product.base * product.trend * (dayOffset / 44);
  const pulse = (((dayOffset + product.id + market.id) % 6) - 2.5) * 0.23;
  const price = Math.max((product.base + seasonality + longTerm + pulse) * market.priceFactor, 0.5);

  let freight = Math.max(0, 3.4 + product.id * 0.28 + market.id * 0.22);
  if (product.category === "suplementos") freight += 1.75;
  if (market.channel === "atacado") freight += 0.65;
  freight *= market.freightFactor;

  return { price: round(price), freight: round(freight), totalPrice: round(price + freight) };
}

async function main() {
  await prisma.marketFactor.deleteMany();
  await prisma.priceRecord.deleteMany();
  await prisma.market.deleteMany();
  await prisma.product.deleteMany();

  await prisma.product.createMany({
    data: products.map(({ base, amplitude, trend, ...product }) => product),
  });

  await prisma.market.createMany({
    data: markets.map(({ priceFactor, freightFactor, ...market }) => market),
  });

  const today = new Date();
  const priceRecords = [];

  for (let dayOffset = 0; dayOffset < 45; dayOffset += 1) {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() - (44 - dayOffset));

    for (const product of products) {
      for (const market of markets) {
        const { price, freight, totalPrice } = computePrice(product, market, dayOffset);
        const collectedAt = new Date(currentDate);
        collectedAt.setHours(9 + market.id, 0, 0, 0);

        priceRecords.push({
          productId: product.id,
          marketId: market.id,
          price,
          freight,
          totalPrice,
          collectedAt,
          source: "seed",
        });
      }
    }
  }

  await prisma.priceRecord.createMany({ data: priceRecords });

  const factors = [];
  for (const product of products) {
    for (const market of markets) {
      for (let index = 0; index < 4; index += 1) {
        const template = factorTemplates[(product.id + market.id + index) % factorTemplates.length];
        const collectedAt = new Date(today);
        collectedAt.setDate(today.getDate() - (index * 5 + market.id));
        collectedAt.setHours(7 + index, 0, 0, 0);
        factors.push({
          productId: product.id,
          marketId: market.id,
          title: template.title,
          description: template.description,
          direction: template.direction,
          intensity: template.intensity,
          collectedAt,
        });
      }
    }
  }

  await prisma.marketFactor.createMany({ data: factors });
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
