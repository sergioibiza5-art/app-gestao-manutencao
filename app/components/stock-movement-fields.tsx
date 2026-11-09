"use client";

import { useState } from "react";
import { consumptionLabel, consumptionUnit, isInnerPack } from "@/lib/stock-units";
import { inputClass } from "@/app/components/ui";

type Product = { id: string; name: string; unit: string; stock: string; packageQuantity: number; packageUnit: string | null };

export function StockMovementFields({ products, outgoing }: { products: Product[]; outgoing: boolean }) {
  const [id, setId] = useState("");
  const [quantityUnit, setQuantityUnit] = useState("STOCK");
  const selected = products.find(product => product.id === id);
  const content = selected ? consumptionUnit(selected) : "STOCK";
  return <>
    <label className="grid gap-1">Produto
      <select required className={inputClass} name="consumableId" value={id} onChange={event => {
        const product = products.find(option => option.id === event.target.value);
        setId(event.target.value);
        setQuantityUnit(outgoing && product && isInnerPack(product) ? "CONTENT" : "STOCK");
      }}>
        <option value="">Selecionar produto</option>
        {products.map(product => <option key={product.id} value={product.id}>{product.name} — {product.stock}</option>)}
      </select>
    </label>
    <label className="grid gap-1">Unidade do movimento
      <select key={id} className={inputClass} name="quantityUnit" value={quantityUnit} onChange={event => setQuantityUnit(event.target.value)}>
        <option value="STOCK">{selected?.unit || "Unidade de stock"}</option>
        {selected && content !== "STOCK" && <option value={content}>{consumptionLabel(selected)}</option>}
      </select>
    </label>
    <label className="grid gap-1">Quantidade
      <input key={id} name="quantity" required pattern={selected && isInnerPack(selected) && quantityUnit === "CONTENT" ? "[1-9][0-9]*" : undefined} inputMode={selected && isInnerPack(selected) ? "numeric" : "decimal"} className={inputClass} placeholder="Ex.: 1" />
    </label>
  </>;
}
