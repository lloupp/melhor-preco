import type { PrismaClient } from "@prisma/client";
import type { CollectorResult, NationalCollector } from "@/lib/collectors/types";

export async function collectNationalOpenTemplate(_prisma: PrismaClient): Promise<CollectorResult> {
  return {
    source: "Fonte Nacional Preparada",
    fetched: 0,
    supported: 0,
    rawInputs: [],
    examples: [],
    warning: "Coletor nacional preparado para futuras APIs abertas de cobertura Brasil.",
  };
}

export const nationalOpenTemplateCollector: NationalCollector = {
  key: "national-open-template",
  scope: "national",
  coverage: {
    countryCode: "BR",
    regions: ["N", "NE", "CO", "SE", "S"],
  },
  collect: collectNationalOpenTemplate,
};
