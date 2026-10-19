type Pack = { unit: string; packageQuantity?: unknown; packageUnit?: string | null };
export function consumptionUnit(item: Pack) {
  if (!(Number(item.packageQuantity) > 0) || !item.packageUnit?.trim()) return "STOCK";
  const unit = item.packageUnit.trim().toLowerCase();
  return unit === "l" || unit === "ml" ? "ml" : unit === "kg" || unit === "g" ? "g" : "CONTENT";
}
export function contentPerPack(item: Pack) {
  const factor = ["l", "kg"].includes(item.packageUnit?.trim().toLowerCase() ?? "") ? 1000 : 1;
  return Number(item.packageQuantity) * factor;
}
export function consumptionLabel(item: Pack) {
  const unit = consumptionUnit(item);
  return unit === "STOCK" ? item.unit : unit === "CONTENT" ? item.packageUnit! : unit;
}
export function toStockQuantity(item: Pack, quantity: number, unit = "STOCK") {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Indica uma quantidade positiva.");
  if (unit !== "STOCK" && unit !== consumptionUnit(item)) throw new Error("Unidade de consumo inválida para este produto.");
  const result = Number((unit === "STOCK" ? quantity : quantity / contentPerPack(item)).toFixed(8));
  if (result <= 0) throw new Error("Quantidade inferior à precisão suportada.");
  return result;
}
export function stockDescription(item: Pack & { currentStock: unknown }) {
  const stock = Number(item.currentStock);
  const format = (n: number) => new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 4 }).format(n);
  if (consumptionUnit(item) === "STOCK") return `${format(stock)} ${item.unit}`;
  return `${format(stock)} ${item.unit} · ${format(stock * contentPerPack(item))} ${consumptionLabel(item)} disponíveis`;
}
