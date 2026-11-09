type Pack = { unit: string; stockUnitsPerOuterBox?: number | null; packageQuantity?: unknown; packageUnit?: string | null };
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
  if (unit === "OUTER_BOX") {
    if (!item.stockUnitsPerOuterBox || !Number.isInteger(quantity)) throw new Error("Indica uma quantidade inteira de caixas externas.");
    return quantity * item.stockUnitsPerOuterBox;
  }
  if (unit === "STOCK" && item.stockUnitsPerOuterBox && !Number.isInteger(quantity)) throw new Error("Indica um número inteiro de embalagens internas.");
  if (unit !== "STOCK" && unit !== consumptionUnit(item)) throw new Error("Unidade de consumo inválida para este produto.");
  if (isInnerPack(item) && unit === "CONTENT" && !Number.isInteger(quantity)) throw new Error("Indica um número inteiro de embalagens internas.");
  const result = Number((unit === "STOCK" ? quantity : quantity / contentPerPack(item)).toFixed(8));
  if (result <= 0) throw new Error("Quantidade inferior à precisão suportada.");
  return result;
}
export function isInnerPack(item: Pack) {
  return item.packageUnit?.trim().toLowerCase() === "embalagem interna" && Number(item.packageQuantity) > 0;
}

export function innerPackCount(item: Pack, stock: unknown) {
  return Number((Number(stock) * Number(item.packageQuantity)).toFixed(6));
}

export function stockQuantityLabel(item: Pack, quantity: unknown) {
  if (item.stockUnitsPerOuterBox) return `${Number(quantity).toLocaleString("pt-PT")} ${Number(quantity) === 1 ? "embalagem interna" : "embalagens internas"}`;
  if (!isInnerPack(item)) return `${String(quantity)} ${item.unit}`;
  const count = innerPackCount(item, quantity);
  return `${count.toLocaleString("pt-PT")} ${count === 1 ? "embalagem interna" : "embalagens internas"}`;
}

export function stockDescription(item: Pack & { currentStock: unknown }) {
  if (item.stockUnitsPerOuterBox || isInnerPack(item)) return stockQuantityLabel(item, item.currentStock);
  const stock = Number(item.currentStock);
  const format = (n: number) => new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 4 }).format(n);
  if (consumptionUnit(item) === "STOCK") return `${format(stock)} ${item.unit}`;
  return `${format(stock)} ${item.unit} · ${format(stock * contentPerPack(item))} ${consumptionLabel(item)} disponíveis`;
}
