# Codex task delegation

## Mission
Implement the MVP described in `README.md` by following the existing contracts first, then incrementally building connectors, persistence, API, and simple web interface.

## Ground rules
1. Keep scope strictly to MVP v1 and out-of-scope constraints from README.
2. Respect contracts before connector logic:
   - `src/interfaces/api/contracts/search-request.schema.json`
   - `src/core/normalization/contracts/normalized-price.schema.json`
3. Preserve Portuguese domain fields (`categoria`, `coletado_em`, etc.) in external interfaces.

## Ordered tasks
1. **Product monitoring registry**
   - Implement create/list monitored products (`query`, `categoria`).
   - Persist in `produtos_monitorados`.
   - Add smoke checks for create + list.

2. **Mercado Livre connector**
   - Implement official API connector under `src/connectors/mercado-livre/`.
   - Map responses to normalized contract.
   - Fail loudly on schema mismatch.

3. **Structured data connector**
   - Implement parser for JSON-LD/structured data for 2-3 target stores.
   - Normalize output to contract.
   - Avoid generalized headless scraping in v1.

4. **Snapshots and history**
   - Persist each collection run in `snapshots_preco`.
   - Expose minimum history metrics:
     - menor preço hoje
     - média da semana
     - tendência (subiu/baixou)

5. **Comparison interface**
   - API endpoint for ranking by `preco_total`.
   - Minimal web view listing normalized offers and basic history.

6. **Price drop alert**
   - Implement "baixou de X" using `alertas_preco`.
   - Trigger when latest `preco_total` crosses configured threshold.

7. **Initial deploy**
   - Add minimal deployment docs/process compatible with chosen stack.

## Acceptance checklist
- Request and response payloads validate against JSON Schemas.
- Ranking always uses `preco_total`.
- Smoke gate remains green: `bash tests/smoke/initial-gate.sh`.
- README scope respected (no broad-store coverage, no generalized headless scraping).
