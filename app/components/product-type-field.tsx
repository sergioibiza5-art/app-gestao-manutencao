import { inputClass } from "@/app/components/ui";
import { productTypes } from "@/lib/product-types";

export function ProductTypeField({ defaultValue = "UNCLASSIFIED", filter = false }: { defaultValue?: string; filter?: boolean }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Tipo de produto</span>
      <select name="productType" defaultValue={defaultValue} className={inputClass}>
        {filter && <option value="">Todos os tipos</option>}
        {Object.entries(productTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  );
}
