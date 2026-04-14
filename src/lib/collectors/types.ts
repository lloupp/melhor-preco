import type { PrismaClient } from "@prisma/client";
import type { RawObservationInput } from "@/lib/automation/pipeline";

export type CollectionExample = Record<string, string | number | null>;

export type CollectorResult = {
  source: string;
  fetched: number;
  supported?: number;
  rawInputs: RawObservationInput[];
  examples: CollectionExample[];
  warning?: string;
  error?: string;
};

export type NationalCollector = {
  key: string;
  scope: "national" | "regional";
  coverage: {
    countryCode: string;
    states?: string[];
    regions?: string[];
  };
  collect: (prisma: PrismaClient) => Promise<CollectorResult>;
};
