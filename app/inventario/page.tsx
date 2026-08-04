import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, FileSpreadsheet, PackagePlus } from "lucide-react";

import { createConsumable, importConsumablesCsv } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getModuleData } from "@/lib/data";

export const dynamic = "force-dynamic";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function packageDescription(item: { unit: string; packageQuantity?: unknown; packageUnit?: string | null }) {
  const quantity = Number(item.packageQuantity ?? 0);
  if (!quantity || !item.packageUnit) return null;
  return `1 ${item.unit} = ${String(item.packageQuantity)} ${item.packageUnit}`;
}

export default async function InventoryPage() {
  const { consumables, equipment } = await getModuleData();
  const templateHref =
    "data:text/csv;charset=utf-8," +
    encodeURIComponent("nome;categoria;unidade_stock;stock_atual;stock_minimo;custo_unitario;quantidade_por_embalagem;unidade_tecnica;link_pasta;localizacao;fornecedor;codigo_equipamento;notas\nDetergente tecnico;Limpeza;bidao;10;2;18,50;5;L;https://onedrive/pasta;Armazem;Fornecedor;COMP-01;\n");

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
            <Field label="Nome">
              <input name="name" required className={inputClass} placeholder="Nome da peça ou consumível" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria">
                <input name="category" className={inputClass} placeholder="Categoria" />
              </Field>
              <Field label="Unidade de stock">
                <input name="unit" className={inputClass} placeholder="Ex.: bidão" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stock atual">
                <input name="currentStock" className={inputClass} placeholder="Ex.: 10" />
              </Field>
              <Field label="Stock mínimo">
                <input name="minimumStock" className={inputClass} placeholder="Ex.: 2" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantidade por embalagem">
                <input name="packageQuantity" className={inputClass} placeholder="Ex.: 5" />
              </Field>
              <Field label="Unidade técnica">
                <input name="packageUnit" className={inputClass} placeholder="Ex.: L" />
              </Field>
            </div>
            <Field label="Custo por unidade de stock">
              <input name="unitCost" className={inputClass} placeholder="Ex.: 10,54" />
            </Field>
            <Field label="Equipamento associado">
              <select name="equipmentId" className={inputClass}>
                <option value="">Sem equipamento associado</option>
                {equipment.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.code ? ` - ${item.code}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pasta do produto">
              <input name="folderUrl" className={inputClass} placeholder="Link" />
            </Field>
            <Field label="Localização">
              <input name="location" className={inputClass} placeholder="Localização" />
            </Field>
            <Field label="Fornecedor">
              <input name="supplier" className={inputClass} placeholder="Fornecedor" />
            </Field>
            <Field label="Notas">
              <textarea name="notes" className={textareaClass} placeholder="Referência, compatibilidade ou centro de custo" />
            </Field>
            <button className={buttonClass}>Guardar item</button>
          </form>
          <div className="mt-6 rounded-lg border border-zinc-800 bg-black/20 p-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={20} className="text-lime-300" />
              <h3 className="font-semibold text-zinc-100">Importar por Excel/CSV</h3>
            </div>
            <a href={templateHref} download="modelo_inventario.csv" className="mt-3 inline-flex text-sm font-semibold text-lime-200">
              Descarregar modelo
            </a>
            <form action={importConsumablesCsv} encType="multipart/form-data" className="mt-3 grid gap-3">
              <input name="file" type="file" accept=".csv,text/csv" className={inputClass} />
              <button className={buttonClass}>Importar inventario</button>
            </form>
          </div>
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
                      <Link href={`/inventario/consumiveis/${item.id}`} className="inline-flex items-center gap-2 font-semibold text-zinc-100 transition hover:text-teal-200">
                        {item.name}
                        <ArrowRight size={15} />
                      </Link>
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
                      {packageDescription(item) && <p className="mt-1 text-xs text-cyan-200">{packageDescription(item)}</p>}
                      <p className="mt-1 text-xs text-zinc-500">Custo: {String(item.unitCost)} EUR/{item.unit}</p>
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
