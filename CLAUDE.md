# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Initial setup
npm install
npm run db:generate   # Generate Prisma client
npm run db:reset      # Wipe DB and re-seed with 45 days of synthetic history

# Development
npm run dev           # http://localhost:3000

# Data collection
npm run collect:once      # Run SimpleMarket collector once
npm run collect:national  # Run all national collectors + full automation pipeline

# Validation
npm test              # Run all tests
npm run build         # Production build (also runs type + lint checks; no standalone lint script)

# Run a single test file
node --import tsx --test tests/domain.test.ts
node --import tsx --test tests/normalization.test.ts
node --import tsx --test tests/recommendation.test.ts
```

## Architecture

Next.js 15 App Router + TypeScript + Prisma (SQLite). Two main flows plus collection scripts.

### Web analytics flow

Pages in `src/app/` call services in `src/lib/services/price-monitor.ts`, which compose view models from Prisma queries (`src/lib/data.ts`) combined with domain analytics (`src/lib/domain/analytics.ts`). Components never query Prisma directly.

- Dashboard `/` → `getDashboardViewModel()` — KPIs, narratives, alerts
- Comparison `/comparacao` → `getComparisonViewModel()` — ranked by `totalPrice`
- Product detail `/produtos/[productId]` → `getProductViewModel()` — charts, market snapshots

### Automation/data pipeline flow

Orchestrated by `src/lib/automation/pipeline.ts` through fixed stages:

```
collect → normalize → persist → (materialize events) → analyze
```

1. `ingestRawObservations()` — saves to `RawPriceObservation`
2. `normalizePendingObservations()` — matches raw data to canonical `Product` via alias + confidence scoring in `src/lib/automation/normalization.ts`
3. `persistNormalizedObservations()` — writes `PriceRecord`
4. `materializeExternalEventFactors()` — links `ExternalEvent` → `MarketFactor`
5. `analyzePredictionSignals()` — generates cautious recommendations in `PredictionSignal`

Every pipeline run is recorded in `PipelineRun` and errors in `ProcessingIssue`. Do not add ingestion paths that bypass these audit tables.

### Collection entrypoint flow

Collectors are registered in `src/lib/collectors/index.ts` (`NATIONAL_COLLECTORS`):
- `simple-market` (`src/lib/collectors/simple-market.ts`) — the only collector that actually fetches/returns data today, scoped to SP/SE
- `national-open-template` / `regional-template` — stubs returning empty `rawInputs` with a `warning`, reserved for future Brazil-wide and state-level sources

Scripts in `scripts/` invoke `runNationalCollection()` (or the single SimpleMarket collector) and feed `RawObservationInput` into the pipeline. `runNationalCollection()` runs every registered collector, merges their `rawInputs`, and calls `runAutomationPipeline()` once with the combined set.

### Database

Schema in `prisma/schema.prisma`. Key tables:
- `Product` — canonical registry with `canonicalKey`, `comparableUnit`, `comparableAmount`, `packageMinAmount`/`packageMaxAmount`
- `ProductAlias` — name variants and patterns for normalization matching
- `Market` — store/channel per location, linked to both free-text (`city`/`state`) and relational geography (`countryId`/`stateId`/`cityId`/`metroAreaId`)
- `RawPriceObservation` — raw ingestion with `processingStatus` enum (`pending` → `normalized`/`pending_review`/`failed` → `persisted`)
- `PriceRecord` — normalized, persisted observations
- `MarketFactor` / `ExternalEvent` / `PredictionSignal` — analysis layer
- `PipelineRun` / `ProcessingIssue` — operational audit trail
- Geography: `Country` → `State` → `City` → `MetroArea` (with `MetroAreaCity` join table)
- `EconomicConnector` / `EconomicSeries` / `EconomicObservation` — schema for external economic/weather series (IPCA, exchange rate, freight indices); seeded with connector/series metadata but not yet read by any pipeline stage or view model

Seed (`prisma/seed.ts`) populates products, aliases, geography, economic connectors/series, external events, and 45 days of historical observations.

### Prepared-but-unwired modules

These exist in the codebase but have no caller in `src/app/` yet — treat them as scaffolding for future features, not dead code to remove:
- `src/lib/contracts/economic.ts` — typed contracts (`ECONOMIC_CONNECTOR_CONTRACTS`, `ECONOMIC_SERIES_CONTRACTS`) describing prepared external data sources (IBGE SIDRA, Banco Central SGS, INMET)
- `src/lib/services/national-aggregation.ts` — national/state/city price aggregation and regional dispersion helpers, intended for a future national rollup view
- `src/lib/collectors/national-open-template.ts` and `regional-template.ts` — no-op collector stubs for future API integrations

## Key conventions

**Access layering**: Components/pages must not query Prisma directly. All data access goes through `src/lib/data.ts` and is composed via `src/lib/services/`.

**Pipeline stages are operational contracts**: `collect → normalize → persist → analyze` must all produce records in `PipelineRun` and `ProcessingIssue`. Do not skip stages or bypass visibility.

**Product normalization**: New collectors must map to canonical identity fields (`canonicalKey`, comparable unit/amount, package bounds) via the normalization path. Bypassing normalization breaks the confidence-based matching audit trail.

**Geographic data**: Use the relational geography tables (`Country`, `State`, `City`, `MetroArea`) — do not store free-text location only.

**Domain language**: Portuguese naming is intentional and must be preserved in external interfaces and status values (e.g., `categoria`, `coletado_em`, `alta`/`queda`/`estavel`, `abaixo_faixa`/`dentro_faixa`/`acima_faixa`, signal types like `monitorar`/`pressao_de_alta`).

**Validated business rules**: `src/lib/domain/analytics.ts` contains locked business logic (metrics, trend/status classification, narratives). Tests in `tests/domain.test.ts` guard expected behavior — do not change this logic without updating tests intentionally.

**MVP scope**: No broad store coverage, no generalized headless scraping. Ranking always uses `totalPrice` (product + shipping).

**Legacy**: `legacy/python/` is reference-only; it is not part of the active runtime.
