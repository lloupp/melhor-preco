# Copilot Instructions for This Repository

## Build, test, and lint

No build, test, or lint tooling is configured yet in this repository (no detected manifest or task runner in the project root).

## High-level architecture

This is a greenfield price comparison project (see README.md). The architecture is modular and organized as follows:

- `src/connectors/`: Integrations for data sources (e.g., Mercado Livre, structured data, headless scraper)
- `src/core/`: Core logic (normalization, ranking, history, alerts)
- `src/infra/`: Infrastructure (db)
- `src/interfaces/`: Entry points (api, web)
- `src/jobs/`: Background jobs
- `tests/smoke/`: Smoke tests

## Key conventions

No project-specific coding conventions are documented yet. Update this file as conventions emerge.

If you add stack/tooling files (e.g., `package.json`, `pyproject.toml`), update this document with:
- Exact build/test/lint commands
- Single-test execution commands
- Concrete module boundaries
- Any repository-specific implementation patterns
