# Copilot Instructions for This Repository

## Build, test, and lint

Primary commands:

```bash
npm install
npm run db:generate
npm run db:reset
npm run collect:once
npm run collect:national
npm test
npm run build
npm run dev
```

Run a single test file:

```bash
node --import tsx --test tests/domain.test.ts
```

Examples:

```bash
node --import tsx --test tests/normalization.test.ts
node --import tsx --test tests/recommendation.test.ts
```

There is no standalone lint script in `package.json`; `npm run build` runs Next.js production checks (including type/lint validation stage).

## High-level architecture

This is a Next.js + Prisma price monitoring app with two connected flows and a collector entrypoint:

1. **Web analytics flow**
   - `src/app/*` pages call `src/lib/services/price-monitor.ts`
   - services compose view models from `src/lib/data.ts` (Prisma queries) + `src/lib/domain/*` analytics
   - ranking/comparison decisions are driven by `totalPrice` and domain status/trend metrics

2. **Automation/data pipeline flow**
   - raw ingestion into `RawPriceObservation`
   - normalization in `src/lib/automation/normalization.ts` (canonical product + unit normalization)
   - persistence into `PriceRecord`
   - external signal materialization (`ExternalEvent` -> `MarketFactor`)
   - cautious recommendations in `PredictionSignal`
   - orchestration in `src/lib/automation/pipeline.ts`

3. **Collection entrypoint flow**
   - collectors are registered in `src/lib/collectors/index.ts` (`NATIONAL_COLLECTORS`)
   - script entrypoints run collectors: `scripts/collect-once.ts` and `scripts/collect-national.ts`
   - collection output is converted to pipeline inputs (`RawObservationInput`) and then processed by the automation pipeline

Data model lives in `prisma/schema.prisma`; seed (`prisma/seed.ts`) populates canonical products, aliases, geography, events, and historical observations.

## Key conventions

Project-specific conventions:

- Preserve validated business rules in `src/lib/domain/analytics.ts`; tests lock expected behavior.
- Keep access layering: components/pages should not query Prisma directly; use `src/lib/data.ts` and compose via `src/lib/services/*`.
- Keep contract-first approach from README/AGENTS for connectors and normalization.
- Preserve Portuguese domain/interface naming already in use (`categoria`, `coletado_em`, status labels, etc.) to avoid drift across pipeline and UI.
- Respect MVP scope from README (no broad store coverage, no generalized headless scraping).
- Product normalization depends on canonical identity fields (`canonicalKey`, aliases, comparable unit/amount, package bounds). New collectors should map to these fields instead of bypassing normalization.
- Pipeline stages and statuses are operational contracts: `collect -> normalize -> persist -> analyze` with issue/run tracking in `PipelineRun` and `ProcessingIssue`. Do not add ingestion paths that skip run/issue visibility.
- Geographic coverage is normalized in relational tables (`Country`, `State`, `City`, `MetroArea`); collectors should reuse this normalization path instead of storing only free-text location.
- Legacy Python under `legacy/python/` is reference-only and not the active runtime.
