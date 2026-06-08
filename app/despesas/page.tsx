import Link from "next/link";
import { FileText } from "lucide-react";

import { createExpense } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getModuleData } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const { expenses, equipment } = await getModuleData();

  return (
    <AppShell activeHref="/despesas">
      <PageHeader
        eyebrow="Financeiro"
        title="Despesas e faturas"
        description="Regista despesas, associa equipamentos e guarda a copia da fatura para rastreabilidade."
      />

      <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Nova despesa</h2>
          <form action={createExpense} className="mt-4 space-y-3">
            <input name="title" required className={inputClass} placeholder="Titulo" />
            <input name="supplier" className={inputClass} placeholder="Fornecedor" />
            <div className="grid grid-cols-2 gap-3">
              <input name="amount" required className={inputClass} placeholder="Valor" />
              <input name="category" className={inputClass} placeholder="Categoria" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input name="date" type="date" className={inputClass} />
              <select name="status" className={inputClass}>
                <option value="PAID">Pago</option>
                <option value="PENDING">Pendente</option>
                <option value="CANCELED">Cancelado</option>
              </select>
            </div>
            <select name="equipmentId" className={inputClass}>
              <option value="">Sem equipamento associado</option>
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.code ? ` · ${item.code}` : ""}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="invoiceUrl" className={inputClass} placeholder="Link/caminho da fatura" />
              <input name="invoiceName" className={inputClass} placeholder="Nome do ficheiro" />
            </div>
            <textarea name="notes" className={textareaClass} placeholder="Notas, centro de custo ou referencia documental" />
            <button className={buttonClass}>Guardar despesa</button>
          </form>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Ultimos registos</h2>
          <div className="mt-4 space-y-3">
            {expenses.length === 0 ? (
              <EmptyState title="Sem despesas registadas" description="Assim que adicionares faturas ou recibos, aparecem aqui por ordem de data." />
            ) : (
              expenses.map((expense) => {
                const invoice = expense.documents.find((document) => document.type === "INVOICE" && document.fileUrl);

                return (
                  <Link key={expense.id} href={`/despesas/${expense.id}`} className="block rounded-lg border border-zinc-800 bg-zinc-950/65 p-4 transition hover:border-amber-300/50 hover:bg-zinc-900/70">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-zinc-100">{expense.title}</h3>
                        <p className="mt-1 text-sm text-zinc-500">{expense.supplier ?? expense.category}</p>
                        <p className="mt-1 text-xs text-zinc-600">
                          {expense.equipment ? `Equipamento: ${expense.equipment.name}` : "Sem equipamento associado"}
                        </p>
                        {invoice && (
                          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-300">
                            <FileText size={13} />
                            Fatura associada
                          </span>
                        )}
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="font-semibold text-amber-300">{formatCurrency(expense.amount)}</p>
                        <p className="mt-1 text-xs text-zinc-500">{formatDate(expense.date)}</p>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
