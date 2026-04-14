export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "n/d";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatPercentage(value: number | null | undefined): string {
  if (value == null) return "n/d";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")}%`;
}

export function formatPriceRange(low: number | null | undefined, high: number | null | undefined): string {
  if (low == null || high == null) return "n/d";
  return `${formatCurrency(low)} a ${formatCurrency(high)}`;
}
