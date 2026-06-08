import { createBudget, createMonthlyBill } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getModuleData } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const { monthlyBills } = await getModuleData();
  const year = new Date().getFullYear();

  return (
    <AppShell activeHref="/contas">
      <PageHeader
        eyebrow="Planeamento financeiro"
        title="Contas mensais e orçamento"
        description="Controla contas recorrentes, datas de vencimento e orçamento por categoria."
      />

      <section className="grid gap-4 xl:grid-cols-[0.75fr_0.75fr_1fr]">
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Nova conta mensal</h2>
          <form action={createMonthlyBill} className="mt-4 space-y-3">
            <input name="name" required className={inputClass} placeholder="Nome da conta" />
            <input name="category" className={inputClass} placeholder="Categoria" />
            <div className="grid grid-cols-2 gap-3">
              <input name="amount" required className={inputClass} placeholder="Valor" />
              <input name="dueDay" type="number" min="1" max="31" className={inputClass} placeholder="Dia" />
            </div>
            <textarea name="notes" className={textareaClass} placeholder="Notas" />
            <button className={buttonClass}>Guardar conta</button>
          </form>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Orçamento</h2>
          <form action={createBudget} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input name="year" defaultValue={year} className={inputClass} placeholder="Ano" />
              <input name="month" type="number" min="1" max="12" className={inputClass} placeholder="Mês" />
            </div>
            <input name="category" required className={inputClass} placeholder="Categoria" />
            <input name="planned" required className={inputClass} placeholder="Valor planeado" />
            <textarea name="notes" className={textareaClass} placeholder="Notas" />
            <button className={buttonClass}>Guardar orçamento</button>
          </form>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Contas ativas</h2>
          <div className="mt-4 space-y-3">
            {monthlyBills.length === 0 ? (
              <EmptyState title="Sem contas mensais" description="Adiciona as contas fixas para prever encargos e vencimentos." />
            ) : (
              monthlyBills.map((bill) => (
                <article key={bill.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{bill.name}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{bill.category} · dia {bill.dueDay}</p>
                    </div>
                    <p className="font-semibold text-emerald-300">{formatCurrency(bill.amount)}</p>
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
