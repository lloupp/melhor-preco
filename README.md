# melhor-preco — PrecoJusto Online

Aplicacao web para monitoramento inteligente de precos com stack principal em Next.js, TypeScript, Tailwind CSS, Prisma, SQLite e Recharts.

## MVP enxuto (v1)

Escopo inicial:
1. Uma categoria (ex.: suplementos).
2. Conector Mercado Livre (API oficial).
3. Conector de dados estruturados (JSON-LD/structured data) para 2-3 lojas.
4. Histórico básico (menor preço hoje, média da semana, tendência subiu/baixou).
5. Tela simples com ranking por preço total estimado (produto + frete).

Fora de escopo:
- Cobertura ampla de lojas
- Scraping headless generalizado
- Otimizações avançadas de custo/performance

## Módulos iniciais

```
src/
  connectors/
    mercado-livre/
    structured-data/
    headless-scraper/
  core/
    normalization/
    ranking/
    history/
    alerts/
  jobs/
  interfaces/
    api/
    web/
  infra/
    db/
tests/
  smoke/
```

## Plano incremental

1. Cadastro de produtos monitorados.
2. Integração com Mercado Livre.
3. Parser de structured data.
4. Persistência e snapshots de preço.
5. Tela de comparação com histórico simples.
6. Alerta “baixou de X”.
7. Deploy inicial.

## Validação inicial obrigatória (gate)

```bash
test -f README.md
test -d src/connectors/mercado-livre
test -d src/connectors/structured-data
test -d src/core/normalization && test -d src/core/history
test -d src/interfaces/api && test -d src/interfaces/web
test -d src/infra/db && test -d tests/smoke
```

## Primeira ação concreta

Definir o **contrato de busca** (`query`, `categoria`) e o **contrato de resposta normalizada** (`produto`, `loja`, `preco`, `frete`, `preco_total`, `link`, `coletado_em`) antes da implementação dos conectores.

## MVP funcional atual

O repositório inclui um MVP local com:

- Next.js App Router
- Prisma + SQLite
- seed deterministico com observacoes brutas, pipeline de normalizacao e 45 dias de historico gerado automaticamente
- dashboard em `/`
- comparacao em `/comparacao`
- detalhe de produto em `/produtos/<id>`
- logica de negocio portada do MVP validado anteriormente
- base de automacao para ingestao continua, eventos externos e sinais preditivos cautelosos

## Como executar

```bash
npm install
npm run db:generate
npm run db:reset
npm run dev
```

Abra `http://localhost:3000`.

## Como validar

```bash
npm test
npm run build
```

## Arquitetura automatica preparada

Fluxo previsto da plataforma:

1. `collect`: novas observacoes entram em `RawPriceObservation`
2. `normalize`: o sistema tenta parear a observacao com um `Product` canonico
3. `persist`: observacoes normalizadas viram `PriceRecord`
4. `analyze`: o sistema recalcula sinais cautelosos em `PredictionSignal`
5. eventos externos em `ExternalEvent` podem ser materializados como `MarketFactor`

## Legado isolado

A implementacao anterior em Python foi preservada em `legacy/python/` apenas como referencia de migracao de dominio.
