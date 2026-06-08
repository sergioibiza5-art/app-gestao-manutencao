import { createExpense } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getModuleData } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const { expenses } = await getModuleData();

  return (
    <AppShell activeHref="/despesas">
      <PageHeader
        eyebrow="Financeiro"
        title="Despesas e faturas"
        description="Registo rápido de faturas, recibos, fornecedores, valores e observações para controlo mensal e anual."
      />

      <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Nova despesa</h2>
          <form action={createExpense} className="mt-4 space-y-3">
            <input name="title" required className={inputClass} placeholder="Título" />
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
            <textarea name="notes" className={textareaClass} placeholder="Notas, centro de custo ou referência documental" />
            <button className={buttonClass}>Guardar despesa</button>
          </form>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Últimos registos</h2>
          <div className="mt-4 space-y-3">
            {expenses.length === 0 ? (
              <EmptyState title="Sem despesas registadas" description="Assim que adicionares faturas ou recibos, aparecem aqui por ordem de data." />
            ) : (
              expenses.map((expense) => (
                <article key={expense.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{expense.title}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{expense.supplier ?? expense.category}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-amber-300">{formatCurrency(expense.amount)}</p>
                      <p className="mt-1 text-xs text-zinc-500">{formatDate(expense.date)}</p>
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
