import { Prisma } from "@prisma/client";

const Decimal = Prisma.Decimal.clone({ precision: 40 });
const volumeUnits: Record<string, string> = {
  l: "1", litro: "1", litros: "1",
  ml: "0.001", mililitro: "0.001", mililitros: "0.001",
  cl: "0.01", centilitro: "0.01", centilitros: "0.01",
  dl: "0.1", decilitro: "0.1", decilitros: "0.1",
};
const massFactors: Record<string, string> = {
  kg: "1", kgs: "1", quilo: "1", quilos: "1", quilograma: "1", quilogramas: "1",
  g: "0.001", gr: "0.001", grs: "0.001", grama: "0.001", gramas: "0.001", mg: "0.000001",
};
const massUnits = new Set(Object.keys(massFactors));
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

export function chemicalMass(product: ProductVolume, quantity: string) {
  const stockUnit = normalizeUnit(product.unit), packageUnit = normalizeUnit(product.packageUnit);
  let factor = Object.hasOwn(massFactors, stockUnit) ? new Decimal(massFactors[stockUnit]) : null;
  if (!factor && !Object.hasOwn(volumeUnits, stockUnit) && Object.hasOwn(massFactors, packageUnit) && product.packageQuantity != null) {
    const capacity = new Decimal(product.packageQuantity.toString());
    if (capacity.isFinite() && capacity.gt(0)) factor = capacity.times(massFactors[packageUnit]);
  }
  return factor ? { kilogramsPerUnit: factor.toFixed(), totalKilograms: new Decimal(quantity).times(factor).toFixed() }
    : { kilogramsPerUnit: null, totalKilograms: null };
}

export function chemicalMeasurement(product: ProductVolume, quantity: string) {
  return { ...chemicalVolume(product, quantity), ...chemicalMass(product, quantity) };
}

export function chemicalMassTotal(rows: { totalKilograms: string | null }[]) {
  let total = new Decimal(0);
  for (const row of rows) if (row.totalKilograms !== null) total = total.plus(row.totalKilograms);
  return total.toFixed();
}
