export type EconomicConnectorContract = {
  key: string;
  name: string;
  connectorType: "economic_series" | "weather" | "sector_news" | "logistics";
  baseUrl?: string;
  status: "prepared" | "active" | "disabled";
};

export type EconomicSeriesContract = {
  key: string;
  name: string;
  category: "inflacao" | "cambio" | "frete" | "clima" | "safra" | "atacado" | "noticias_setoriais";
  frequency: "diaria" | "semanal" | "mensal";
  unit: string;
  scope: string;
  connectorKey: string;
};

export const ECONOMIC_CONNECTOR_CONTRACTS: EconomicConnectorContract[] = [
  {
    key: "ibge-sidra",
    name: "IBGE SIDRA",
    connectorType: "economic_series",
    baseUrl: "https://sidra.ibge.gov.br",
    status: "prepared",
  },
  {
    key: "bcb-sgs",
    name: "Banco Central SGS",
    connectorType: "economic_series",
    baseUrl: "https://api.bcb.gov.br/dados/serie",
    status: "prepared",
  },
  {
    key: "clima-inmet",
    name: "INMET",
    connectorType: "weather",
    baseUrl: "https://portal.inmet.gov.br",
    status: "prepared",
  },
];

export const ECONOMIC_SERIES_CONTRACTS: EconomicSeriesContract[] = [
  {
    key: "ipca-brasil",
    name: "IPCA Brasil",
    category: "inflacao",
    frequency: "mensal",
    unit: "indice",
    scope: "BR",
    connectorKey: "ibge-sidra",
  },
  {
    key: "inpc-brasil",
    name: "INPC Brasil",
    category: "inflacao",
    frequency: "mensal",
    unit: "indice",
    scope: "BR",
    connectorKey: "ibge-sidra",
  },
  {
    key: "cambio-usd-brl",
    name: "Cambio USD/BRL",
    category: "cambio",
    frequency: "diaria",
    unit: "brl",
    scope: "BR",
    connectorKey: "bcb-sgs",
  },
  {
    key: "frete-sudeste",
    name: "Frete Sudeste",
    category: "frete",
    frequency: "semanal",
    unit: "indice",
    scope: "SE",
    connectorKey: "bcb-sgs",
  },
];
