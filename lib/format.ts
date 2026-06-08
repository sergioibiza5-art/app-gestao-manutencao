export function formatCurrency(value: unknown) {
  const numberValue = Number(value ?? 0);

  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numberValue) ? numberValue : 0);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "Sem data";
  }

  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatShortDate(value: Date | string | null | undefined) {
  if (!value) {
    return "S/D";
  }

  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}
