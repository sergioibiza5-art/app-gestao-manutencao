import { CalendarDays, Plus, Receipt, SlidersHorizontal } from "lucide-react";

import { createQuickEntry } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, inputClass, Panel } from "@/app/components/ui";
import { getDashboardData, getModuleData } from "@/lib/data";
import { formatCurrency, formatShortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const fallbackTasks = [
  { title: "Verificar bomba de água", area: "Infraestrutura", due: "09:00", status: "Crítica", accent: "border-l-rose-400" },
  { title: "Registar fatura da eletricidade", area: "Despesas", due: "11:30", status: "Pendente", accent: "border-l-amber-400" },
  { title: "Limpeza filtro AVAC", area: "Manutenção", due: "15:00", status: "Planeada", accent: "border-l-cyan-400" },
  { title: "Conferir stock detergente técnico", area: "Inventário", due: "18:00", status: "Baixo risco", accent: "border-l-emerald-400" },
];

const fallbackCalendar = [
  { date: "07 Jun", title: "Calibração balança", tag: "Semestral" },
  { date: "12 Jun", title: "Revisão quadro elétrico", tag: "Anual" },
  { date: "18 Jun", title: "Renovar seguro habitação", tag: "Documento" },
  { date: "30 Jun", title: "Fecho orçamento mensal", tag: "Financeiro" },
];

export default async function Page() {
  const [dashboard, moduleData] = await Promise.all([getDashboardData(), getModuleData()]);
  const tasks = dashboard.tasks.length > 0
    ? dashboard.tasks.map((task) => ({
        title: task.title,
        area: task.equipment?.name ?? task.frequency ?? "Pontual",
        due: formatShortDate(task.dueDate ?? task.nextDue),
        status: task.status,
        accent: "border-l-teal-400",
      }))
    : fallbackTasks;
  const calendar = dashboard.calendar.length > 0
    ? dashboard.calendar.map((event) => ({
        date: formatShortDate(event.scheduledAt),
        title: event.title,
        tag: event.equipment?.name ?? event.frequency,
      }))
    : fallbackCalendar;
  const kpis = [
    { label: "Tarefas hoje", value: String(dashboard.kpis.tasksToday), detail: `${dashboard.kpis.criticalTasks} críticas`, tone: "text-teal-300" },
    { label: "Despesas mês", value: formatCurrency(dashboard.kpis.monthlyExpenses), detail: "Valor registado", tone: "text-amber-300" },
    { label: "Equipamentos", value: String(dashboard.kpis.equipmentCount), detail: `${dashboard.kpis.equipmentAttention} em atenção`, tone: "text-cyan-300" },
    { label: "SGQ ativo", value: `${dashboard.kpis.sgqPercent}%`, detail: `${dashboard.kpis.sgqPending} registos por aprovar`, tone: "text-emerald-300" },
  ];

  return (
    <AppShell activeHref="/">
      <section className="glass-panel rounded-lg p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-zinc-500">Resumo diário</p>
            <h2 className="text-2xl font-semibold text-zinc-50">Dashboard</h2>
          </div>
          <a href="#entrada-rapida" className={buttonClass}>
            <Plus size={18} />
            Novo registo
          </a>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {kpis.map((item) => (
            <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-950/62 p-3">
              <p className="text-xs text-zinc-500">{item.label}</p>
              <p className={`mt-2 text-2xl font-semibold ${item.tone}`}>{item.value}</p>
              <p className="mt-1 text-xs text-zinc-400">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-500">Prioridade</p>
              <h2 className="text-xl font-semibold text-zinc-50">Tarefas de hoje</h2>
            </div>
            <SlidersHorizontal size={20} className="text-zinc-400" />
          </div>
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={`${task.title}-${task.due}`} className={`rounded-lg border border-zinc-800 border-l-4 ${task.accent} bg-zinc-950/70 p-3`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-zinc-100">{task.title}</h3>
                    <p className="mt-1 text-sm text-zinc-500">{task.area}</p>
                  </div>
                  <span className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-300">{task.due}</span>
                </div>
                <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">{task.status}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-500">Planeamento</p>
              <h2 className="text-xl font-semibold text-zinc-50">Calendário de manutenções</h2>
            </div>
            <CalendarDays size={22} className="text-cyan-300" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {calendar.map((event) => (
              <div key={`${event.title}-${event.date}`} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="text-sm font-semibold text-cyan-200">{event.date}</p>
                <h3 className="mt-2 text-base font-medium text-zinc-100">{event.title}</h3>
                <p className="mt-3 inline-flex rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-400">{event.tag}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel>
          <div className="flex items-center gap-3">
            <Receipt className="text-amber-300" size={22} />
            <h2 id="entrada-rapida" className="text-xl font-semibold text-zinc-50">Entrada rápida</h2>
          </div>
          <form action={createQuickEntry} className="mt-4 space-y-3">
            <select name="entryType" className={inputClass}>
              <option value="EXPENSE">Despesa / Fatura</option>
              <option value="MAINTENANCE">Manutenção</option>
              <option value="STOCK">Stock / Inventário</option>
              <option value="CALIBRATION">Calibração</option>
            </select>
            <input name="title" className={inputClass} placeholder="Fornecedor, equipamento ou item" />
            <select name="equipmentId" className={inputClass}>
              <option value="">Sem equipamento associado</option>
              {moduleData.equipment.map((equipment) => (
                <option key={equipment.id} value={equipment.id}>{equipment.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input name="amount" className={inputClass} placeholder="Valor" />
              <input name="costCenter" className={inputClass} placeholder="Centro custo" />
            </div>
            <input name="supplier" className={inputClass} placeholder="Fornecedor" />
            <button className="h-11 w-full rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-950 transition hover:bg-white">Registar entrada</button>
          </form>
        </Panel>
      </section>
    </AppShell>
  );
}
