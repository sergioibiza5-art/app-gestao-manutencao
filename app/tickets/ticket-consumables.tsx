"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { consumptionUnit, consumptionLabel, stockDescription } from "@/lib/stock-units";
import { inputClass } from "@/app/components/ui";

type ConsumableOption = {
  id: string;
  name: string;
  unit: string;
  currentStock: unknown;
  unitCost?: unknown;
  packageQuantity?: unknown;
  packageUnit?: string | null;
};

type InitialUsage = {
  consumableId: string;
  quantity: unknown;
  notes: string | null;
};

type TicketConsumablesProps = {
  consumables: ConsumableOption[];
  initialUsages?: InitialUsage[];
};

export function TicketConsumables({ consumables, initialUsages = [] }: TicketConsumablesProps) {
  const initialRows =
    initialUsages.length > 0
      ? initialUsages.map((usage) => ({
          key: crypto.randomUUID(),
          consumableId: usage.consumableId,
          quantity: String(usage.quantity ?? ""),
          quantityUnit: "STOCK",
          usageNotes: usage.notes ?? "",
        }))
      : [{ key: crypto.randomUUID(), consumableId: "", quantity: "", quantityUnit: "STOCK", usageNotes: "" }];
  const [rows, setRows] = useState(initialRows);

  return (
    <div className="space-y-2">
      <div className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 md:grid-cols-[1.4fr_0.55fr_0.6fr_1fr_44px]">
        <span>Consumivel</span>
        <span>Qtd.</span>
        <span>Unidade</span>
        <span>Observacoes</span>
        <span />
      </div>
      {rows.map((row, index) => {
        const selected = consumables.find((item) => item.id === row.consumableId);
        return (
        <div key={row.key} className="grid gap-2 md:grid-cols-[1.4fr_0.55fr_0.6fr_1fr_44px]">
          <select
            name="consumableId"
            className={inputClass}
            value={row.consumableId}
            onChange={(event) =>
              setRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, consumableId: event.target.value, quantity: "", quantityUnit: consumptionUnit(consumables.find((option) => option.id === event.target.value) ?? { unit: "un" }) } : item))
            }
          >
            <option value="">Consumivel usado</option>
            {consumables.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({stockDescription(item)}) - {String(item.unitCost ?? 0)} EUR
              </option>
            ))}
          </select>
          <input
            name="quantity"
            className={inputClass}
            value={row.quantity}
            onChange={(event) =>
              setRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, quantity: event.target.value } : item))
            }
            aria-label="Quantidade consumida"
            inputMode="decimal"
            placeholder="Qtd."
          />
          <select name="quantityUnit" aria-label="Unidade de consumo" className={inputClass} value={row.quantityUnit} onChange={(event) => setRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, quantityUnit: event.target.value, quantity: "" } : item))}>
            <option value="STOCK">{selected?.unit ?? "Embalagens"}</option>
            {selected && consumptionUnit(selected) !== "STOCK" && <option value={consumptionUnit(selected)}>{consumptionLabel(selected)}</option>}
          </select>
          <input
            name="usageNotes"
            className={inputClass}
            value={row.usageNotes}
            onChange={(event) =>
              setRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, usageNotes: event.target.value } : item))
            }
            placeholder="Observacoes"
          />
          <button
            type="button"
            className="grid h-11 place-items-center rounded-lg border border-zinc-800 bg-zinc-950/70 text-zinc-400 transition hover:border-rose-300/40 hover:text-rose-200"
            onClick={() => setRows((current) => current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index))}
            aria-label="Remover linha de consumivel"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ); })}
      <button
        type="button"
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-800 px-3 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/40 hover:text-teal-200"
        onClick={() => setRows((current) => [...current, { key: crypto.randomUUID(), consumableId: "", quantity: "", quantityUnit: "STOCK", usageNotes: "" }])}
      >
        <Plus size={16} />
        Adicionar consumivel
      </button>
    </div>
  );
}
