import type { PrismaClient } from "@prisma/client";
import { runAutomationPipeline } from "@/lib/automation/pipeline";
import type { RawObservationInput } from "@/lib/automation/pipeline";
import { collectSimpleMarketData } from "@/lib/collectors/simple-market";
import { nationalOpenTemplateCollector } from "@/lib/collectors/national-open-template";
import { regionalTemplateCollector } from "@/lib/collectors/regional-template";
import type { CollectorResult, NationalCollector } from "@/lib/collectors/types";

export const NATIONAL_COLLECTORS: NationalCollector[] = [
  {
    key: "simple-market",
    scope: "national",
    coverage: {
      countryCode: "BR",
      states: ["SP"],
      regions: ["SE"],
    },
    collect: collectSimpleMarketData,
  },
  nationalOpenTemplateCollector,
  regionalTemplateCollector,
];

export async function runNationalCollection(prisma: PrismaClient) {
  const collectorResults: Array<
    CollectorResult & {
      key: string;
      scope: "national" | "regional";
      coverage: NationalCollector["coverage"];
    }
  > = [];
  const combinedRawInputs: RawObservationInput[] = [];

  for (const collector of NATIONAL_COLLECTORS) {
    try {
      const result = await collector.collect(prisma);
      collectorResults.push({
        ...result,
        key: collector.key,
        scope: collector.scope,
        coverage: collector.coverage,
      });
      combinedRawInputs.push(...result.rawInputs);
    } catch (error) {
      collectorResults.push({
        key: collector.key,
        scope: collector.scope,
        coverage: collector.coverage,
        source: collector.key,
        fetched: 0,
        supported: 0,
        rawInputs: [],
        examples: [],
        error: error instanceof Error ? error.message : "Falha desconhecida no coletor.",
      });
    }
  }

  if (combinedRawInputs.length > 0) {
    await runAutomationPipeline(prisma, { rawInputs: combinedRawInputs });
  }

  return {
    collectors: collectorResults,
    totalFetched: collectorResults.reduce((sum, collector) => sum + collector.fetched, 0),
    totalIngested: combinedRawInputs.length,
  };
}
