import { CalendarDays, Car, Filter, SlidersHorizontal } from "lucide-react";

import { AppShell } from "@/app/components/app-shell";
import { buttonClass, inputClass, Panel } from "@/app/components/ui";
import { getDashboardData } from "@/lib/data";
import { formatCurrency, formatDate, formatShortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const fallbackTasks = [
  { title: "Verificar bomba de agua", area: "Infraestrutura", due: "09:00", status: "Critica", accent: "border-l-rose-400" },
  { title: "Limpeza filtro AVAC", area: "Manutencao", due: "15:00", status: "Planeada", accent: "border-l-cyan-400" },
  { title: "Conferir stock detergente tecnico", area: "Inventario", due: "18:00", status: "Baixo risco", accent: "border-l-emerald-400" },
];

const fallbackCalendar = [
  { date: "07 Jun", title: "Calibracao balanca", tag: "Semestral" },
  { date: "12 Jun", title: "Revisao quadro eletrico", tag: "Anual" },
];

type DashboardPageProps = {
  searchParams?: Promise<{ view?: string; date?: string }>;
};

export default async function Page({ searchParams }: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const selectedView = params.view || "month";
  const selectedDate = params.date || new Date().toISOString().slice(0, 10);
  const dashboard = await getDashboardData({ view: selectedView, date: selectedDate });
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
    { label: "Tarefas hoje", value: String(dashboard.kpis.tasksToday), detail: `${dashboard.kpis.criticalTasks} criticas`, tone: "text-teal-300" },
    { label: "Despesas mes", value: formatCurrency(dashboard.kpis.monthlyExpenses), detail: "Valor registado", tone: "text-amber-300" },
    { label: "Equipamentos", value: String(dashboard.kpis.equipmentCount), detail: `${dashboard.kpis.equipmentAttention} em atencao`, tone: "text-cyan-300" },
    { label: "SGQ ativo", value: `${dashboard.kpis.sgqPercent}%`, detail: `${dashboard.kpis.sgqPending} registos por aprovar`, tone: "text-emerald-300" },
  ];

  return (
    <AppShell activeHref="/">
      <section className="glass-panel rounded-lg p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm text-zinc-500">Resumo diario</p>
            <h2 className="text-2xl font-semibold text-zinc-50">Dashboard</h2>
          </div>
          <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <select name="view" defaultValue={selectedView} className={inputClass}>
              <option value="week">Semana</option>
              <option value="month">Mes atual</option>
              <option value="year">Ano</option>
            </select>
            <input name="date" type="date" defaultValue={selectedDate} className={inputClass} />
            <button className={buttonClass}>
              <Filter size={16} />
              Filtrar
            </button>
          </form>
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

      <Panel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-500">Frota</p>
            <h2 className="text-xl font-semibold text-zinc-50">Proximas revisoes e inspecoes</h2>
          </div>
          <Car size={22} className="text-blue-300" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {dashboard.fleetAlerts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/45 p-4 text-sm text-zinc-500 md:col-span-3">
              Sem revisoes ou inspecoes com data estimada.
            </p>
          ) : (
            dashboard.fleetAlerts.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                <p className={item.type === "Inspecao" ? "text-sm font-semibold text-lime-200" : "text-sm font-semibold text-blue-200"}>
                  {item.type}
                </p>
                <h3 className="mt-2 font-medium text-zinc-100">{item.title}</h3>
                <p className="mt-1 text-xs text-zinc-500">{item.plate}</p>
                <p className="mt-3 text-sm font-semibold text-zinc-200">{formatDate(item.dueDate)}</p>
              </div>
            ))
          )}
        </div>
      </Panel>

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
              <h2 className="text-xl font-semibold text-zinc-50">Calendario de manutencoes</h2>
            </div>
            <CalendarDays size={22} className="text-cyan-300" />
          </div>
          <div className="grid max-h-[620px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
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
    </AppShell>
  );
}
