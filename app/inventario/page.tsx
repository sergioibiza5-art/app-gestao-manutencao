import Link from "next/link";
import { ArrowRight, PackagePlus } from "lucide-react";

import { createConsumable } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getModuleData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const { consumables, equipment } = await getModuleData();

  return (
    <AppShell activeHref="/inventario">
      <PageHeader
        eyebrow="Stock"
        title="Inventario de pecas e consumiveis"
        description="Controla stock, localizacao, fornecedor e associacao a equipamentos quando a peca ou consumivel e dedicado."
      />

      <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel>
          <div className="flex items-center gap-3">
            <PackagePlus size={22} className="text-amber-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Novo item de stock</h2>
          </div>
          <form action={createConsumable} className="mt-4 space-y-3">
            <input name="name" required className={inputClass} placeholder="Nome da peca ou consumivel" />
            <div className="grid grid-cols-2 gap-3">
              <input name="category" className={inputClass} placeholder="Categoria" />
              <input name="unit" className={inputClass} placeholder="Unidade" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input name="currentStock" className={inputClass} placeholder="Stock atual" />
              <input name="minimumStock" className={inputClass} placeholder="Stock minimo" />
            </div>
            <select name="equipmentId" className={inputClass}>
              <option value="">Sem equipamento associado</option>
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.code ? ` - ${item.code}` : ""}
                </option>
              ))}
            </select>
            <input name="location" className={inputClass} placeholder="Localizacao" />
            <input name="supplier" className={inputClass} placeholder="Fornecedor" />
            <textarea name="notes" className={textareaClass} placeholder="Notas, referencia, compatibilidade ou centro de custo" />
            <button className={buttonClass}>Guardar item</button>
          </form>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Stock atual</h2>
          <div className="mt-4 space-y-3">
            {consumables.length === 0 ? (
              <EmptyState title="Sem itens de stock" description="Adiciona pecas e consumiveis para controlar stock minimo e reposicoes." />
            ) : (
              consumables.map((item) => (
                <article key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{item.name}</h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        {item.category} - {item.location ?? "sem localizacao"} - {item.supplier ?? "sem fornecedor"}
                      </p>
                      {item.equipment && (
                        <Link href={`/equipamentos/${item.equipment.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-teal-300 hover:text-teal-200">
                          Associado a {item.equipment.name}
                          <ArrowRight size={13} />
                        </Link>
                      )}
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-amber-300">{String(item.currentStock)} {item.unit}</p>
                      <p className="mt-1 text-xs text-zinc-500">Minimo: {String(item.minimumStock)} {item.unit}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
