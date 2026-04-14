# Copilot Instructions for This Repository

## Build, test, and lint

Current project commands:

```bash
npm install
npm run db:generate
npm run db:reset
npm test
npm run build
npm run dev
```

## High-level architecture

This is a price monitoring web app. The main architecture is now:

- `src/app/`: Next.js App Router pages
- `src/components/`: UI and chart components
- `src/lib/domain/`: reusable domain rules and formatting
- `src/lib/services/`: server-side view model composition
- `src/lib/automation/`: ingestion, normalization, persistence and cautious recommendation pipeline
- `src/lib/data.ts`: Prisma-backed data access
- `prisma/`: schema and seed
- `tests/`: TypeScript domain tests
- `legacy/python/`: isolated legacy implementation kept only for reference

## Key conventions

Project-specific conventions:

- Preserve the validated business rules in `src/lib/domain/analytics.ts`.
- Use the automation pipeline as the source of truth for future data ingestion architecture.
- Keep data access out of components; use `src/lib/data.ts` and `src/lib/services/`.
- Do not expand to auth, external APIs, or future connectors in the current MVP stage.
- The Python implementation is not the active app anymore.
