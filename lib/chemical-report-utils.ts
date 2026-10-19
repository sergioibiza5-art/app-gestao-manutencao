export const entryTypes = {
  ENTRADA_DIRETA: "Entrada direta",
  ENTRADA_INICIAL: "Stock inicial",
  ENTRADA_MANUAL: "Ajuste manual positivo",
} as const;

export function lisbonDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function reportRange(from?: string, to?: string) {
  const today = lisbonDate(new Date());
  const start = from || `${today.slice(0, 4)}-01-01`;
  const end = to || today;
  for (const value of [start, end]) {
    const date = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new Error("Indica datas válidas para o relatório.");
    }
  }
  if (start > end) throw new Error("A data inicial deve ser anterior ou igual à data final.");
  return { start, end };
}

export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
