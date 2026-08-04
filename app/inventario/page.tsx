import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, Download, FileSpreadsheet, Filter, History, PackageMinus, PackagePlus, Search, ShoppingCart, X } from "lucide-react";

import { createConsumable, createConsumableStockOut, importConsumablesCsv } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { DetailsCloseButton } from "@/app/components/details-close-button";
import { DetailsOpenButton } from "@/app/components/details-open-button";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getInventoryData } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

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

function stockVisualStatus(item: { currentStock?: unknown; minimumStock?: unknown }) {
  const current = Number(item.currentStock ?? 0);
  const minimum = Number(item.minimumStock ?? 0);

  if (!minimum || minimum <= 0) {
    return {
      label: "Sem mínimo",
      helper: "Define um stock mínimo para ativar a escala.",
      cardClass: "border-zinc-800 bg-zinc-950/65",
      valueClass: "text-zinc-100",
      badgeClass: "border-zinc-700 bg-zinc-900 text-zinc-300",
      barClass: "bg-zinc-500",
      progress: 100,
    };
  }

  const ratio = current / minimum;
  const progress = Math.min(Math.max((ratio / 2) * 100, 5), 100);

  if (current <= minimum) {
    return {
      label: "Encomendar",
      helper: "Stock no mínimo ou abaixo.",
      cardClass: "border-rose-300/45 bg-rose-950/20 shadow-[0_0_0_1px_rgba(253,164,175,0.08)]",
      valueClass: "text-rose-200",
      badgeClass: "border-rose-300/40 bg-rose-300/10 text-rose-100",
      barClass: "bg-rose-300",
      progress,
    };
  }

  if (ratio <= 1.25) {
    return {
      label: "Perto do mínimo",
      helper: "Preparar reposição.",
      cardClass: "border-amber-300/40 bg-amber-950/15 shadow-[0_0_0_1px_rgba(252,211,77,0.06)]",
      valueClass: "text-amber-200",
      badgeClass: "border-amber-300/40 bg-amber-300/10 text-amber-100",
      barClass: "bg-amber-300",
      progress,
    };
  }

  if (ratio <= 2) {
    return {
      label: "Confortável",
      helper: "Stock acima do mínimo.",
      cardClass: "border-teal-300/35 bg-teal-950/15",
      valueClass: "text-teal-200",
      badgeClass: "border-teal-300/35 bg-teal-300/10 text-teal-100",
      barClass: "bg-teal-300",
      progress,
    };
  }

  return {
    label: "Stock alto",
    helper: "Margem confortável.",
    cardClass: "border-sky-300/35 bg-sky-950/15",
    valueClass: "text-sky-200",
    badgeClass: "border-sky-300/35 bg-sky-300/10 text-sky-100",
    barClass: "bg-sky-300",
    progress,
  };
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const params = (await searchParams) ?? {};
  const { consumables, equipment, categories, suppliers, locations, allCount, lowStockCount, lowStockConsumables, totalStockValue, stockMovements } = await getInventoryData(params);
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
            <DetailsOpenButton
              targetId="baixa-stock"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-300/35 bg-rose-300/10 px-3 text-sm font-semibold text-rose-100 transition hover:border-rose-200/70"
            >
              <PackageMinus size={16} />
              Dar baixa
            </DetailsOpenButton>
            <DetailsOpenButton
              targetId="movimentos-stock"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-300/35 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70"
            >
              <History size={16} />
              Movimentos
            </DetailsOpenButton>
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

      <details id="baixa-stock" className="group">
        <summary className="hidden">Dar baixa de stock</summary>
        <div className="fixed inset-0 z-50 hidden overflow-y-auto bg-black/75 p-4 backdrop-blur-sm group-open:block">
          <div className="mx-auto max-w-3xl">
            <Panel>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <PackageMinus size={22} className="text-rose-300" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-300">Stock</p>
                    <h2 className="text-xl font-semibold text-zinc-50">Dar baixa direta</h2>
                    <p className="mt-1 text-sm text-zinc-500">Regista uma saída manual e desconta automaticamente ao stock atual.</p>
                  </div>
                </div>
                <DetailsCloseButton targetId="baixa-stock" />
              </div>
              <form action={createConsumableStockOut} className="mt-5 grid gap-3 md:grid-cols-2">
                <Field label="Produto">
                  <select name="consumableId" required className={inputClass}>
                    <option value="">Selecionar produto</option>
                    {consumables.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} - stock {String(item.currentStock)} {item.unit}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Quantidade a descontar">
                  <input name="quantity" required className={inputClass} placeholder="Ex.: 1" />
                </Field>
                <Field label="Motivo">
                  <textarea name="reason" className={`${textareaClass} md:col-span-2`} placeholder="Ex.: consumo direto, desperdício, ajuste por contagem..." />
                </Field>
                <button className={`${buttonClass} md:col-span-2`}>Guardar baixa de stock</button>
              </form>
            </Panel>
          </div>
        </div>
      </details>

      <details id="movimentos-stock" className="group">
        <summary className="hidden">Movimentos de stock</summary>
        <div className="fixed inset-0 z-50 hidden overflow-y-auto bg-black/75 p-4 backdrop-blur-sm group-open:block">
          <div className="mx-auto max-w-6xl">
            <Panel>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <History size={22} className="text-cyan-300" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Rastreabilidade</p>
                    <h2 className="text-xl font-semibold text-zinc-50">Movimentos de stock</h2>
                    <p className="mt-1 text-sm text-zinc-500">Últimos movimentos registados, com produto, origem e utilizador.</p>
                  </div>
                </div>
                <DetailsCloseButton targetId="movimentos-stock" />
              </div>
              <div className="mt-5 overflow-x-auto rounded-lg border border-zinc-800">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-zinc-950/70 text-xs uppercase tracking-[0.14em] text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Produto</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Qtd.</th>
                      <th className="px-4 py-3">Origem</th>
                      <th className="px-4 py-3">Utilizador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {stockMovements.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-zinc-500" colSpan={6}>Sem movimentos registados.</td>
                      </tr>
                    ) : (
                      stockMovements.map((movement) => (
                        <tr key={movement.id}>
                          <td className="px-4 py-3 text-zinc-400">{formatDate(movement.date)}</td>
                          <td className="px-4 py-3 font-medium text-zinc-100">{movement.consumable.name}</td>
                          <td className="px-4 py-3 text-zinc-300">{movement.type.replaceAll("_", " ")}</td>
                          <td className="px-4 py-3 text-cyan-200">{String(movement.quantity)} {movement.consumable.unit}</td>
                          <td className="px-4 py-3 text-zinc-400">
                            {movement.workOrder ? `OP ${movement.workOrder.number}` : movement.ticket ? `Ticket ${movement.ticket.number}` : movement.reason ?? "Movimento manual"}
                          </td>
                          <td className="px-4 py-3 text-zinc-400">{movement.user?.name ?? "Sistema"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>
      </details>

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
                <>
                  <div className="grid gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] sm:grid-cols-4">
                    <span className="rounded-full border border-rose-300/35 bg-rose-300/10 px-3 py-1 text-rose-100">Encomendar</span>
                    <span className="rounded-full border border-amber-300/35 bg-amber-300/10 px-3 py-1 text-amber-100">Perto do mínimo</span>
                    <span className="rounded-full border border-teal-300/35 bg-teal-300/10 px-3 py-1 text-teal-100">Confortável</span>
                    <span className="rounded-full border border-sky-300/35 bg-sky-300/10 px-3 py-1 text-sky-100">Stock alto</span>
                  </div>
                  {consumables.map((item) => {
                    const status = stockVisualStatus(item);

                    return (
                  <article key={item.id} className={`rounded-lg border p-4 transition ${status.cardClass}`}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/inventario/consumiveis/${item.id}`} className="inline-flex min-w-0 items-center gap-2 font-semibold text-zinc-100 transition hover:text-teal-200">
                            <span className="truncate">{item.name}</span>
                            <ArrowRight size={15} className="shrink-0" />
                          </Link>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.badgeClass}`}>{status.label}</span>
                        </div>
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
                      <div className="min-w-[150px] text-left sm:text-right">
                        <p className={`font-semibold ${status.valueClass}`}>
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
                    <div className="mt-4">
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-950 ring-1 ring-zinc-800">
                        <div className={`h-full rounded-full ${status.barClass}`} style={{ width: `${status.progress}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-500">{status.helper}</p>
                    </div>
                  </article>
                    );
                  })}
                </>
              )}
            </div>
          </Panel>
        </div>
      </section>
    </AppShell>
  );
}
