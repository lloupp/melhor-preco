#!/usr/bin/env bash
set -euo pipefail

test -f README.md
test -d src/connectors/mercado-livre
test -d src/connectors/structured-data
test -d src/core/normalization
test -d src/core/history
test -d src/interfaces/api
test -d src/interfaces/web
test -d src/infra/db
test -d tests/smoke

test -f src/interfaces/api/contracts/search-request.schema.json
test -f src/core/normalization/contracts/normalized-price.schema.json
test -f src/infra/db/schema.sql

echo "OK: initial gate passed"
