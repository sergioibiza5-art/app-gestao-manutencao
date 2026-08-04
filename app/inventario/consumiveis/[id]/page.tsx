import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FolderOpen, History, Package, ReceiptText, Trash2 } from "lucide-react";

import { deleteConsumable, updateConsumable } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getConsumableDetail, getModuleData } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type ConsumablePageProps = {
  params: Promise<{ id: string }>;
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

export default async function ConsumablePage({ params }: ConsumablePageProps) {
  const { id } = await params;
  const [item, moduleData] = await Promise.all([getConsumableDetail(id), getModuleData()]);

  if (!item) {
    notFound();
  }

  const ticketUsageTotal = item.ticketUsages.reduce((sum, usage) => sum + Number(usage.quantity ?? 0), 0);
  const stockValue = Number(item.currentStock ?? 0) * Number(item.unitCost ?? 0);

  return (
    <AppShell activeHref="/inventario">
      <PageHeader
        eyebrow="Ficha de stock"
        title={item.name}
        description={`${item.category} - ${String(item.currentStock)} ${item.unit} em stock - minimo ${String(item.minimumStock)} ${item.unit}`}
        action={
          <Link href="/inventario" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50">
            <ArrowLeft size={17} />
            Inventario
          </Link>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel>
          <div className="flex items-center gap-3">
            <Package size={22} className="text-amber-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Editar produto</h2>
          </div>
          <form action={updateConsumable} className="mt-4 grid gap-3">
            <input type="hidden" name="id" value={item.id} />
            <Field label="Nome">
              <input name="name" required className={inputClass} defaultValue={item.name} placeholder="Nome da peça ou consumível" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria">
                <input name="category" className={inputClass} defaultValue={item.category} placeholder="Categoria" />
              </Field>
              <Field label="Unidade de stock">
                <input name="unit" className={inputClass} defaultValue={item.unit} placeholder="Ex.: bidão" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stock atual">
                <input name="currentStock" className={inputClass} defaultValue={String(item.currentStock)} placeholder="Ex.: 10" />
              </Field>
              <Field label="Stock mínimo">
                <input name="minimumStock" className={inputClass} defaultValue={String(item.minimumStock)} placeholder="Ex.: 2" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantidade por embalagem">
                <input name="packageQuantity" className={inputClass} defaultValue={item.packageQuantity ? String(item.packageQuantity) : ""} placeholder="Ex.: 5" />
              </Field>
              <Field label="Unidade técnica">
                <input name="packageUnit" className={inputClass} defaultValue={item.packageUnit ?? ""} placeholder="Ex.: L" />
              </Field>
            </div>
            <Field label="Custo por unidade de stock">
              <input name="unitCost" className={inputClass} defaultValue={String(item.unitCost)} placeholder="Ex.: 10,54" />
            </Field>
            <Field label="Pasta do produto">
              <input name="folderUrl" className={inputClass} defaultValue={item.folderUrl ?? ""} placeholder="Link" />
            </Field>
            <Field label="Equipamento associado">
              <select name="equipmentId" className={inputClass} defaultValue={item.equipmentId ?? ""}>
                <option value="">Sem equipamento associado</option>
                {moduleData.equipment.map((equipment) => (
                  <option key={equipment.id} value={equipment.id}>
                    {equipment.name}{equipment.code ? ` - ${equipment.code}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Localização">
              <input name="location" className={inputClass} defaultValue={item.location ?? ""} placeholder="Localização" />
            </Field>
            <Field label="Fornecedor">
              <input name="supplier" className={inputClass} defaultValue={item.supplier ?? ""} placeholder="Fornecedor" />
            </Field>
            <Field label="Notas">
              <textarea name="notes" className={textareaClass} defaultValue={item.notes ?? ""} placeholder="Referência, compatibilidade ou centro de custo" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button className={buttonClass}>Guardar alteracoes</button>
            </div>
          </form>
          <form action={deleteConsumable} className="mt-3">
            <input type="hidden" name="id" value={item.id} />
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-400/35 bg-rose-400/10 px-3 text-sm font-semibold text-rose-200 transition hover:border-rose-300">
              <Trash2 size={15} />
              Eliminar produto
            </button>
          </form>
        </Panel>

        <div className="grid gap-4">
          <Panel>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                <p className="text-xs text-zinc-500">Stock atual</p>
                <p className="mt-2 text-2xl font-semibold text-amber-300">{String(item.currentStock)} {item.unit}</p>
                {packageDescription(item) && <p className="mt-1 text-xs text-cyan-200">{packageDescription(item)}</p>}
                <p className="mt-1 text-xs text-zinc-500">Minimo: {String(item.minimumStock)} {item.unit}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                <p className="text-xs text-zinc-500">Valor em stock</p>
                <p className="mt-2 text-2xl font-semibold text-teal-300">{formatCurrency(stockValue)}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                <p className="text-xs text-zinc-500">Usado em tickets</p>
                <p className="mt-2 text-2xl font-semibold text-cyan-300">{ticketUsageTotal} {item.unit}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {item.folderUrl ? (
                <a href={item.folderUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-sky-300/30 bg-sky-300/10 px-4 text-sm font-semibold text-sky-100 transition hover:border-sky-200">
                  <FolderOpen size={17} />
                  Abrir pasta do produto
                </a>
              ) : (
                <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/45 p-3 text-sm text-zinc-500">Sem pasta associada</div>
              )}
              {item.equipment ? (
                <Link href={`/equipamentos/${item.equipment.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-teal-300/30 bg-teal-300/10 px-4 text-sm font-semibold text-teal-100 transition hover:border-teal-200">
                  <ExternalLink size={17} />
                  {item.equipment.name}
                </Link>
              ) : (
                <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/45 p-3 text-sm text-zinc-500">Sem equipamento associado</div>
              )}
            </div>
          </Panel>

          <section className="grid gap-4 xl:grid-cols-2">
            <Panel>
              <div className="flex items-center gap-3">
                <History size={21} className="text-lime-300" />
                <h2 className="text-xl font-semibold text-zinc-50">Movimentos</h2>
              </div>
              <div className="mt-4 space-y-2">
                {item.movements.length === 0 ? (
                  <EmptyState title="Sem movimentos" description="As entradas e saidas de stock aparecem aqui." />
                ) : (
                  item.movements.map((movement) => (
                    <article key={movement.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">{movement.type}</p>
                          <p className="mt-1 text-xs text-zinc-500">{movement.reason ?? "Sem motivo"}</p>
                          <p className="mt-1 text-xs text-zinc-500">Por: {movement.user?.name ?? "Sem utilizador"}</p>
                          {movement.ticket ? (
                            <p className="mt-1 text-xs text-teal-300">
                              {movement.ticket.number}
                              {movement.ticket.workOrder ? ` · ${movement.ticket.workOrder.number}` : ""}
                            </p>
                          ) : movement.workOrder ? (
                            <p className="mt-1 text-xs text-teal-300">{movement.workOrder.number}</p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-lime-200">{String(movement.quantity)} {item.unit}</p>
                          <p className="mt-1 text-xs text-zinc-500">{formatDate(movement.date)}</p>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </Panel>

            <Panel>
              <div className="flex items-center gap-3">
                <ReceiptText size={21} className="text-cyan-300" />
                <h2 className="text-xl font-semibold text-zinc-50">Tickets / OP</h2>
              </div>
              <div className="mt-4 space-y-2">
                {item.ticketUsages.length === 0 ? (
                  <EmptyState title="Sem utilizacoes" description="Quando este consumivel for usado num ticket, fica aqui registado." />
                ) : (
                  item.ticketUsages.map((usage) => (
                    <article key={usage.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">{usage.ticket.number} - {usage.ticket.title}</p>
                          <p className="mt-1 text-xs text-zinc-500">{usage.ticket.equipment.name}</p>
                          {usage.ticket.workOrder && <p className="mt-1 text-xs font-semibold text-teal-300">{usage.ticket.workOrder.number}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-cyan-200">{String(usage.quantity)} {item.unit}</p>
                          <p className="mt-1 text-xs text-zinc-500">{formatCurrency(Number(usage.quantity ?? 0) * Number(usage.unitCost ?? 0))}</p>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </Panel>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
