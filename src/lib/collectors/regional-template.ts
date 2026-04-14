import type { PrismaClient } from "@prisma/client";
import type { CollectorResult, NationalCollector } from "@/lib/collectors/types";

export async function collectRegionalTemplate(_prisma: PrismaClient): Promise<CollectorResult> {
  return {
    source: "Template Regional Brasil",
    fetched: 0,
    supported: 0,
    rawInputs: [],
    examples: [],
    warning: "Coletor regional preparado para novas fontes estaduais e metropolitanas.",
  };
}

export const regionalTemplateCollector: NationalCollector = {
  key: "regional-template",
  scope: "regional",
  coverage: {
    countryCode: "BR",
    states: ["SP", "RJ", "MG"],
    regions: ["SE"],
  },
  collect: collectRegionalTemplate,
};
