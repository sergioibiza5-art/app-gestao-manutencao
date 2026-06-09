import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, ExternalLink, FileText, Trash2 } from "lucide-react";

import { deleteExpense, updateExpense } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getExpenseDetail, getModuleData } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type ExpenseDetailPageProps = {
  params: Promise<{ id: string }>;
};

function dateInputValue(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
      {label}
      {children}
    </label>
  );
}

export default async function ExpenseDetailPage({ params }: ExpenseDetailPageProps) {
  const { id } = await params;
  const [expense, moduleData] = await Promise.all([getExpenseDetail(id), getModuleData()]);

  if (!expense) {
    notFound();
  }

  const invoice = expense.documents.find((document) => document.type === "INVOICE");
  const associationLabel = expense.equipment
    ? expense.equipment.name
    : expense.vehicle
      ? `${expense.vehicle.brand} ${expense.vehicle.model} - ${expense.vehicle.plate}`
      : "sem equipamento ou viatura associada";

  return (
    <AppShell activeHref="/despesas">
      <PageHeader
        eyebrow="Despesa"
        title={expense.title}
        description={`${formatCurrency(expense.amount)} - ${formatDate(expense.date)} - ${associationLabel}`}
        action={
          <Link href="/despesas" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-100 transition hover:border-amber-300/50">
            <ArrowLeft size={17} />
            Despesas
          </Link>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Editar despesa</h2>
          <form action={updateExpense} className="mt-4 space-y-3">
            <input type="hidden" name="id" value={expense.id} />
            <FieldLabel label="Titulo">
              <input name="title" required className={inputClass} defaultValue={expense.title} placeholder="Titulo" />
            </FieldLabel>
            <FieldLabel label="Fornecedor">
              <input name="supplier" className={inputClass} defaultValue={expense.supplier ?? ""} placeholder="Fornecedor" />
            </FieldLabel>
            <div className="grid grid-cols-2 gap-3">
              <FieldLabel label="Valor">
                <input name="amount" required className={inputClass} defaultValue={String(expense.amount)} placeholder="Valor" />
              </FieldLabel>
              <FieldLabel label="Centro de custo">
                <input name="category" className={inputClass} defaultValue={expense.category} placeholder="Centro de custo" />
              </FieldLabel>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldLabel label="Data">
                <input name="date" type="date" className={inputClass} defaultValue={dateInputValue(expense.date)} />
              </FieldLabel>
              <FieldLabel label="Estado">
                <select name="status" className={inputClass} defaultValue={expense.status}>
                  <option value="PAID">Pago</option>
                  <option value="PENDING">Pendente</option>
                  <option value="CANCELED">Cancelado</option>
                </select>
              </FieldLabel>
            </div>
            <FieldLabel label="Equipamento">
              <select name="equipmentId" className={inputClass} defaultValue={expense.equipmentId ?? ""}>
                <option value="">Sem equipamento associado</option>
                {moduleData.equipment.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.code ? ` - ${item.code}` : ""}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Viatura">
              <select name="vehicleId" className={inputClass} defaultValue={expense.vehicleId ?? ""}>
                <option value="">Sem viatura associada</option>
                {moduleData.vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.brand} {vehicle.model} - {vehicle.plate}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <div className="grid gap-3 md:grid-cols-2">
              <FieldLabel label="Link da fatura">
                <input name="invoiceUrl" className={inputClass} defaultValue={invoice?.fileUrl ?? ""} placeholder="Link/caminho da fatura" />
              </FieldLabel>
              <FieldLabel label="Nome do ficheiro">
                <input name="invoiceName" className={inputClass} defaultValue={invoice?.fileName ?? invoice?.title ?? ""} placeholder="Nome do ficheiro" />
              </FieldLabel>
            </div>
            <FieldLabel label="Notas">
              <textarea name="notes" className={textareaClass} defaultValue={expense.notes ?? ""} placeholder="Notas" />
            </FieldLabel>
            <button className={buttonClass}>Guardar alteracoes</button>
          </form>
          <form action={deleteExpense} className="mt-3">
            <input type="hidden" name="id" value={expense.id} />
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/15">
              <Trash2 size={16} />
              Eliminar despesa
            </button>
          </form>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <h2 className="text-xl font-semibold text-zinc-50">Resumo</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["Valor", formatCurrency(expense.amount)],
                ["Estado", expense.status],
                ["Fornecedor", expense.supplier ?? "Sem fornecedor"],
                ["Centro de custo", expense.category],
                ["Equipamento", expense.equipment?.name ?? "Sem equipamento"],
                ["Viatura", expense.vehicle ? `${expense.vehicle.brand} ${expense.vehicle.model} - ${expense.vehicle.plate}` : "Sem viatura"],
                ["Data", formatDate(expense.date)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                  <dt className="text-xs text-zinc-500">{label}</dt>
                  <dd className="mt-1 text-sm font-medium text-zinc-100">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel>
            <div className="flex items-center gap-3">
              <FileText size={22} className="text-sky-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Fatura</h2>
            </div>
            {invoice?.fileUrl ? (
              <a href={invoice.fileUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-sky-300/35 bg-sky-300/10 px-4 text-sm font-semibold text-sky-200 transition hover:bg-sky-300/15">
                <ExternalLink size={17} />
                Abrir fatura
              </a>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/45 p-4 text-sm text-zinc-500">
                Ainda nao existe fatura associada. Adiciona o link/caminho no formulario de edicao.
              </p>
            )}
          </Panel>
        </div>
      </section>
    </AppShell>
  );
}
