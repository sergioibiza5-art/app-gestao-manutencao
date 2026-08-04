import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, Download, FileSpreadsheet, Filter, PackagePlus, Search, ShoppingCart, X } from "lucide-react";

import { createConsumable, importConsumablesCsv } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getInventoryData } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

type InventoryPageProps = {
  searchParams?: Promise<{
    q?: string;
    category?: string;
    supplier?: string;
    location?: string;
    equipmentId?: string;
    stock?: string;
  }>;
};

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

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const params = (await searchParams) ?? {};
  const { consumables, equipment, categories, suppliers, locations, allCount, lowStockCount, lowStockConsumables, totalStockValue } = await getInventoryData(params);
  const exportParams = new URLSearchParams(
    Object.entries(params).filter(([, value]) => typeof value === "string" && value.length > 0) as string[][],
  );
  const templateHref =
    "data:text/csv;charset=utf-8," +
    encodeURIComponent(
      "nome;categoria;unidade_stock;stock_atual;stock_minimo;custo_unitario;quantidade_por_embalagem;unidade_tecnica;link_pasta;localizacao;fornecedor;codigo_equipamento;notas\nDetergente tecnico;Limpeza;bidao;10;2;18,50;5;L;https://onedrive/pasta;Armazem;Fornecedor;COMP-01;\n",
    );

  return (
    <AppShell activeHref="/inventario">
      <PageHeader
        eyebrow="Stock"
        title="Inventário de peças e consumíveis"
        description="Controla stock, localização, fornecedor e associação a equipamentos quando a peça ou consumível é dedicado."
      />

      <Panel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Filter size={22} className="text-teal-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Filtros</h2>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {consumables.length} produto(s) filtrado(s) de {allCount}. Valor em stock: {formatCurrency(totalStockValue)}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/inventario/pdf?${exportParams.toString()}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-teal-300/35 bg-teal-300/10 px-3 text-sm font-semibold text-teal-100 transition hover:border-teal-200/70"
            >
              <Download size={16} />
              Exportar PDF
            </a>
            <Link
              href="/inventario"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50"
            >
              <X size={16} />
              Limpar
            </Link>
          </div>
        </div>

        <form className="mt-4 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/45 p-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative md:col-span-2 xl:col-span-2">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              name="q"
              defaultValue={params.q ?? ""}
              className={`${inputClass} min-w-0 pl-9 text-sm`}
              placeholder="Pesquisar por produto, fornecedor, local, equipamento..."
            />
          </div>

          <select name="category" defaultValue={params.category ?? ""} className={`${inputClass} min-w-0 text-sm`}>
            <option value="">Todas as categorias</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select name="supplier" defaultValue={params.supplier ?? ""} className={`${inputClass} min-w-0 text-sm`}>
            <option value="">Todos os fornecedores</option>
            {suppliers.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select name="location" defaultValue={params.location ?? ""} className={`${inputClass} min-w-0 text-sm`}>
            <option value="">Todas as localizações</option>
            {locations.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select name="stock" defaultValue={params.stock ?? ""} className={`${inputClass} min-w-0 text-sm`}>
            <option value="">Todos os estados</option>
            <option value="LOW">Abaixo do mínimo</option>
            <option value="OK">Stock OK</option>
            <option value="ASSOCIATED">Com equipamento</option>
            <option value="UNASSOCIATED">Sem equipamento</option>
          </select>

          <select name="equipmentId" defaultValue={params.equipmentId ?? ""} className={`${inputClass} min-w-0 text-sm md:col-span-2 xl:col-span-3`}>
            <option value="">Todos os equipamentos</option>
            {equipment.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.code ? ` - ${item.code}` : ""}
              </option>
            ))}
          </select>

          <button className={`${buttonClass} md:col-span-2 xl:col-span-3`}>Aplicar filtros</button>
        </form>
      </Panel>

      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-amber-300/35 bg-amber-300/10 text-amber-200">
              <AlertTriangle size={21} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Reposição</p>
              <h2 className="mt-1 text-xl font-semibold text-zinc-50">Produtos com stock baixo</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {lowStockConsumables.length > 0
                  ? `${lowStockConsumables.length} produto(s) atingiram ou estão abaixo do stock mínimo.`
                  : "Não existem produtos abaixo do stock mínimo."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/inventario?stock=LOW"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-300/35 bg-amber-300/10 px-3 text-sm font-semibold text-amber-100 transition hover:border-amber-200/70"
            >
              Ver stock baixo
            </Link>
            <a
              href="/api/inventario/pdf?stock=LOW&mode=shopping"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-300 px-3 text-sm font-semibold text-zinc-950 transition hover:bg-teal-200"
            >
              <ShoppingCart size={16} />
              Lista de compras
            </a>
          </div>
        </div>

        {lowStockConsumables.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {lowStockConsumables.slice(0, 6).map((item) => {
              const missing = Math.max(Number(item.minimumStock ?? 0) - Number(item.currentStock ?? 0), 0);

              return (
                <Link
                  key={item.id}
                  href={`/inventario/consumiveis/${item.id}`}
                  className="rounded-lg border border-amber-300/25 bg-amber-300/5 p-3 transition hover:border-amber-200/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-100">{item.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">{item.supplier ?? "Sem fornecedor"}</p>
                    </div>
                    <ArrowRight size={15} className="mt-1 shrink-0 text-amber-200" />
                  </div>
                  <p className="mt-3 text-sm text-amber-200">
                    Stock: {String(item.currentStock)} {item.unit} · mínimo {String(item.minimumStock)} {item.unit}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {missing > 0 ? `Faltam ${missing} ${item.unit} para o mínimo.` : "Está no limite mínimo. Avaliar reposição."}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>

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
              <button className={buttonClass}>Importar inventário</button>
            </form>
          </div>
        </Panel>

        <div className="grid gap-4">
          <Panel>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-zinc-50">Stock atual</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {lowStockCount > 0 ? `${lowStockCount} produto(s) abaixo do stock mínimo.` : "Sem alertas de stock mínimo no filtro atual."}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {consumables.length === 0 ? (
                <EmptyState title="Sem itens de stock" description="Ajusta os filtros ou adiciona peças e consumíveis para controlar stock mínimo e reposições." />
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
                          {item.category} - {item.location ?? "sem localização"} - {item.supplier ?? "sem fornecedor"}
                        </p>
                        {item.equipment && (
                          <Link href={`/equipamentos/${item.equipment.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-teal-300 hover:text-teal-200">
                            Associado a {item.equipment.name}
                            <ArrowRight size={13} />
                          </Link>
                        )}
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="font-semibold text-amber-300">
                          {String(item.currentStock)} {item.unit}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Mínimo: {String(item.minimumStock)} {item.unit}
                        </p>
                        {packageDescription(item) && <p className="mt-1 text-xs text-cyan-200">{packageDescription(item)}</p>}
                        <p className="mt-1 text-xs text-zinc-500">
                          Custo: {String(item.unitCost)} EUR/{item.unit}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </Panel>
        </div>
      </section>
    </AppShell>
  );
}
