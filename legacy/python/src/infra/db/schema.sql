PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  unidade TEXT NOT NULL,
  descricao TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS markets (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  canal TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_records (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL,
  market_id INTEGER NOT NULL,
  preco REAL NOT NULL CHECK (preco >= 0),
  frete REAL NOT NULL CHECK (frete >= 0),
  preco_total REAL NOT NULL CHECK (preco_total >= 0),
  coletado_em TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'seed',
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  FOREIGN KEY (market_id) REFERENCES markets (id) ON DELETE CASCADE,
  UNIQUE (product_id, market_id, coletado_em)
);

CREATE INDEX IF NOT EXISTS idx_price_records_product_date
  ON price_records (product_id, coletado_em);

CREATE INDEX IF NOT EXISTS idx_price_records_market_date
  ON price_records (market_id, coletado_em);

CREATE TABLE IF NOT EXISTS market_factors (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL,
  market_id INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  direcao TEXT NOT NULL CHECK (direcao IN ('alta', 'queda', 'neutro')),
  intensidade INTEGER NOT NULL CHECK (intensidade BETWEEN 1 AND 5),
  coletado_em TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  FOREIGN KEY (market_id) REFERENCES markets (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_factors_product_date
  ON market_factors (product_id, coletado_em DESC);
