import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeRawObservation } from "@/lib/automation/normalization";
import { buildRecommendationSignal } from "@/lib/automation/recommendation";
import type { PriceRecordWithRelations } from "@/lib/domain/types";

export type RawObservationInput = Pick<
  Prisma.RawPriceObservationUncheckedCreateInput,
  | "sourceType"
  | "sourceName"
  | "collectedAt"
  | "rawProductName"
  | "rawBrand"
  | "rawPackageInfo"
  | "rawPrice"
  | "rawCurrency"
  | "countryCode"
  | "stateCode"
  | "regionCode"
  | "city"
  | "neighborhood"
  | "metroAreaName"
  | "sourceUrl"
  | "evidenceText"
  | "confidenceScore"
  | "marketId"
  | "countryId"
  | "stateId"
  | "cityId"
  | "metroAreaId"
>;

export async function ingestRawObservations(prisma: PrismaClient, inputs: RawObservationInput[]) {
  const run = await startPipelineRun(prisma, "collect", inputs.length);
  try {
    if (inputs.length > 0) {
      await prisma.rawPriceObservation.createMany({
        data: inputs.map((item) => ({
          ...item,
          processingStatus: "pending",
        })),
      });
    }
    await completePipelineRun(prisma, run.id, "completed", inputs.length, inputs.length, 0, "Observacoes brutas recebidas.");
  } catch (error) {
    await completePipelineRun(prisma, run.id, "failed", inputs.length, 0, inputs.length, stringifyError(error));
    throw error;
  }
}

export async function normalizePendingObservations(prisma: PrismaClient) {
  const pending = await prisma.rawPriceObservation.findMany({
    where: { processingStatus: { in: ["pending", "pending_review"] } },
    orderBy: { collectedAt: "asc" },
  });
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { aliases: true },
  });
  const run = await startPipelineRun(prisma, "normalize", pending.length);

  let successCount = 0;
  let failureCount = 0;

  for (const observation of pending) {
    const result = normalizeRawObservation(observation, products);

    await prisma.rawPriceObservation.update({
      where: { id: observation.id },
      data: {
        processingStatus: result.processingStatus,
        normalizedProductId: result.normalizedProductId,
        normalizedName: result.normalizedName,
        normalizedUnit: result.normalizedUnit,
        normalizedAmount: result.normalizedAmount,
        comparableUnitPrice: result.comparableUnitPrice,
        comparableUnit: result.comparableUnit,
        processingNotes: result.processingNotes,
        confidenceScore: result.confidenceScore,
      },
    });

    if (result.processingStatus === "normalized") {
      successCount += 1;
      continue;
    }

    failureCount += 1;
    await prisma.processingIssue.create({
      data: {
        rawObservationId: observation.id,
        pipelineRunId: run.id,
        stage: "normalize",
        code: result.processingStatus === "failed" ? "normalization_failed" : "review_required",
        message: result.processingNotes ?? "Observacao depende de revisao.",
      },
    });
  }

  await completePipelineRun(
    prisma,
    run.id,
    failureCount > 0 && successCount === 0 ? "failed" : "completed",
    pending.length,
    successCount,
    failureCount,
    "Normalizacao automatica concluida.",
  );
}

export async function persistNormalizedObservations(prisma: PrismaClient) {
  const normalized = await prisma.rawPriceObservation.findMany({
    where: {
      processingStatus: "normalized",
      normalizedProductId: { not: null },
      priceRecord: null,
    },
    include: {
      normalizedProduct: true,
    },
    orderBy: { collectedAt: "asc" },
  });
  const run = await startPipelineRun(prisma, "persist", normalized.length);

  let successCount = 0;
  let failureCount = 0;

  for (const observation of normalized) {
    if (!observation.marketId || !observation.normalizedProductId) {
      failureCount += 1;
      await prisma.rawPriceObservation.update({
        where: { id: observation.id },
        data: {
          processingStatus: "pending_review",
          processingNotes: "Observacao normalizada sem mercado associado ou produto canonico.",
        },
      });
      await prisma.processingIssue.create({
        data: {
          rawObservationId: observation.id,
          pipelineRunId: run.id,
          stage: "persist",
          code: "missing_market_or_product",
          message: "Observacao pronta para persistencia, mas sem relacionamento suficiente para gerar historico.",
        },
      });
      continue;
    }

    await prisma.priceRecord.upsert({
      where: {
        rawObservationId: observation.id,
      },
      create: {
        productId: observation.normalizedProductId,
        marketId: observation.marketId,
        rawObservationId: observation.id,
        price: observation.rawPrice,
        freight: 0,
        totalPrice: observation.rawPrice,
        unitPrice: observation.comparableUnitPrice ?? undefined,
        collectedAt: observation.collectedAt,
        source: observation.sourceName,
      },
      update: {
        price: observation.rawPrice,
        totalPrice: observation.rawPrice,
        unitPrice: observation.comparableUnitPrice ?? undefined,
        source: observation.sourceName,
      },
    });

    await prisma.rawPriceObservation.update({
      where: { id: observation.id },
      data: {
        processingStatus: "persisted",
        processingNotes: "Observacao consolidada no historico analitico.",
      },
    });

    successCount += 1;
  }

  await completePipelineRun(prisma, run.id, "completed", normalized.length, successCount, failureCount, "Persistencia analitica concluida.");
}

export async function materializeExternalEventFactors(prisma: PrismaClient) {
  const events = await prisma.externalEvent.findMany({
    include: {
      productLinks: { include: { product: true } },
      categoryLinks: true,
    },
    orderBy: { occurredAt: "desc" },
  });

  for (const event of events) {
    const linkedProductIds = new Set<number>(event.productLinks.map((link) => link.productId));
    if (event.categoryLinks.length > 0) {
      const categoryProducts = await prisma.product.findMany({
        where: { category: { in: event.categoryLinks.map((link) => link.category) } },
        select: { id: true },
      });
      for (const product of categoryProducts) linkedProductIds.add(product.id);
    }

    const markets = await prisma.market.findMany({
      where: event.city ? { city: event.city } : {},
      select: { id: true },
    });

    for (const productId of linkedProductIds) {
      for (const market of markets) {
        await prisma.marketFactor.upsert({
          where: {
            productId_marketId_title_collectedAt: {
              productId,
              marketId: market.id,
              title: event.title,
              collectedAt: event.occurredAt,
            },
          },
          create: {
            productId,
            marketId: market.id,
            externalEventId: event.id,
            title: event.title,
            description: event.description,
            direction: event.signalDirection,
            intensity: Math.max(1, Math.min(5, event.severity)),
            collectedAt: event.occurredAt,
            sourceType: "external_event",
          },
          update: {
            description: event.description,
            direction: event.signalDirection,
            intensity: Math.max(1, Math.min(5, event.severity)),
            sourceType: "external_event",
            externalEventId: event.id,
          },
        });
      }
    }
  }
}

export async function analyzePredictionSignals(prisma: PrismaClient) {
  const products = await prisma.product.findMany({
    where: { active: true },
    include: {
      priceRecords: {
        include: { market: true },
        orderBy: { collectedAt: "asc" },
      },
    },
  });
  const run = await startPipelineRun(prisma, "analyze", products.length);
  const today = new Date();
  let successCount = 0;

  await prisma.predictionSignal.deleteMany({
    where: {
      basedOnDate: {
        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      },
    },
  });

  for (const product of products) {
    const records: PriceRecordWithRelations[] = product.priceRecords.map((record) => ({
      id: record.id,
      productId: record.productId,
      marketId: record.marketId,
      price: record.price,
      freight: record.freight,
      totalPrice: record.totalPrice,
      collectedAt: record.collectedAt,
      productName: product.name,
      category: product.category,
      unit: product.unit,
      marketName: record.market.name,
      city: record.market.city,
      state: record.market.state,
      channel: record.market.channel,
    }));

    const events = await prisma.externalEvent.findMany({
      where: {
        OR: [
          { productLinks: { some: { productId: product.id } } },
          { categoryLinks: { some: { category: product.category } } },
        ],
        occurredAt: { gte: daysAgo(21) },
      },
      select: {
        eventType: true,
        signalDirection: true,
        severity: true,
        title: true,
      },
    });

    const draft = buildRecommendationSignal(product, records, events);
    await prisma.predictionSignal.create({
      data: draft,
    });
    successCount += 1;
  }

  await completePipelineRun(prisma, run.id, "completed", products.length, successCount, 0, "Sinais cautelosos recalculados.");
}

export async function runAutomationPipeline(prisma: PrismaClient, options?: { rawInputs?: RawObservationInput[] }) {
  if (options?.rawInputs?.length) {
    await ingestRawObservations(prisma, options.rawInputs);
  }
  await normalizePendingObservations(prisma);
  await persistNormalizedObservations(prisma);
  await materializeExternalEventFactors(prisma);
  await analyzePredictionSignals(prisma);
}

async function startPipelineRun(prisma: PrismaClient, stage: string, inputCount: number) {
  return prisma.pipelineRun.create({
    data: {
      stage,
      status: "running",
      inputCount,
    },
  });
}

async function completePipelineRun(
  prisma: PrismaClient,
  runId: number,
  status: string,
  inputCount: number,
  successCount: number,
  failureCount: number,
  details?: string,
) {
  await prisma.pipelineRun.update({
    where: { id: runId },
    data: {
      status,
      inputCount,
      successCount,
      failureCount,
      details,
      finishedAt: new Date(),
    },
  });
}

function stringifyError(error: unknown) {
  return error instanceof Error ? error.message : "Erro desconhecido";
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}
