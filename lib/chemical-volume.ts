import { Prisma } from "@prisma/client";

const Decimal = Prisma.Decimal.clone({ precision: 40 });
const volumeUnits: Record<string, string> = {
  l: "1", litro: "1", litros: "1",
  ml: "0.001", mililitro: "0.001", mililitros: "0.001",
  cl: "0.01", centilitro: "0.01", centilitros: "0.01",
  dl: "0.1", decilitro: "0.1", decilitros: "0.1",
};
const massUnits = new Set(["kg", "g", "gr", "mg", "quilo", "quilos", "quilograma", "quilogramas", "grama", "gramas"]);
const normalizeUnit = (unit?: string | null) => unit?.trim().toLowerCase().replace(/\.$/, "") ?? "";

type ProductVolume = { unit: string; packageUnit?: string | null; packageQuantity?: { toString(): string } | string | number | null };

export function chemicalVolume(product: ProductVolume, quantity: string) {
  const stockUnit = normalizeUnit(product.unit), packageUnit = normalizeUnit(product.packageUnit);
  // Movements are already normalized to stock units; do not multiply litres twice.
  let factor = Object.hasOwn(volumeUnits, stockUnit) ? new Decimal(volumeUnits[stockUnit]) : null;
  if (!factor && !massUnits.has(stockUnit) && Object.hasOwn(volumeUnits, packageUnit) && product.packageQuantity != null) {
    const capacity = new Decimal(product.packageQuantity.toString());
    if (capacity.isFinite() && capacity.gt(0)) factor = capacity.times(volumeUnits[packageUnit]);
  }
  if (factor) return { litresPerUnit: factor.toFixed(), totalLitres: new Decimal(quantity).times(factor).toFixed(), litreNote: "" };
  const litreNote = massUnits.has(stockUnit) || massUnits.has(packageUnit)
    ? "Unidade em massa: não convertida para litros."
    : "Capacidade da embalagem em volume não configurada.";
  return { litresPerUnit: null, totalLitres: null, litreNote };
}

export function chemicalVolumeTotal(rows: { totalLitres: string | null }[]) {
  let total = new Decimal(0), missing = 0;
  for (const row of rows) {
    if (row.totalLitres === null) missing++;
    else total = total.plus(row.totalLitres);
  }
  return { litres: total.toFixed(), missing };
}
