export const productTypes = {
  UNCLASSIFIED: "Por classificar",
  NON_CHEMICAL: "Não químico / peça",
  CHEMICAL_LIQUID: "Químico — líquido",
  CHEMICAL_GREASE: "Químico — massa / pasta",
  CHEMICAL_AEROSOL: "Químico — aerossol",
  CHEMICAL_OTHER: "Químico — outro",
} as const;

export type ProductType = keyof typeof productTypes;
export const chemicalTypes = Object.keys(productTypes).filter((key) => key.startsWith("CHEMICAL_"));

export function parseProductType(value: unknown): ProductType {
  if (value == null || value === "") return "UNCLASSIFIED";
  if (typeof value !== "string" || !Object.hasOwn(productTypes, value)) {
    throw new Error("Tipo de produto inválido.");
  }
  return value as ProductType;
}

export function productTypeLabel(value: string) {
  return productTypes[value as ProductType] ?? "Por classificar";
}
