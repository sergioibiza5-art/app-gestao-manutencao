import { CalendarDays, Car, ClipboardCheck, DollarSign, Filter, Wrench } from "lucide-react";

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
    { label: "Tarefas hoje", value: String(dashboard.kpis.tasksToday), detail: `${dashboard.kpis.criticalTasks} criticas`, tone: "text-teal-300", icon: ClipboardCheck, box: "border-teal-300/40 bg-teal-300/10 text-teal-200" },
    { label: "Despesas mes", value: formatCurrency(dashboard.kpis.monthlyExpenses), detail: "Valor registado", tone: "text-amber-300", icon: DollarSign, box: "border-amber-300/40 bg-amber-300/10 text-amber-200" },
    { label: "Manutencoes hoje", value: String(dashboard.kpis.maintenanceToday), detail: "Agendadas para hoje", tone: "text-sky-300", icon: Wrench, box: "border-sky-300/40 bg-sky-300/10 text-sky-200" },
    { label: "Frota a vencer", value: String(dashboard.kpis.fleetDueSoon), detail: "Proximos 30 dias", tone: "text-lime-300", icon: Car, box: "border-lime-300/40 bg-lime-300/10 text-lime-200" },
  ];

  return (
    <AppShell activeHref="/">
      <section className="rounded-lg border border-zinc-800 bg-[linear-gradient(135deg,rgba(20,184,166,0.08),rgba(14,165,233,0.04)_45%,rgba(0,0,0,0.15))] p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-50">Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-400">Resumo diario da manutencao</p>
          </div>
          <form className="grid gap-2 sm:grid-cols-[180px_180px_auto]">
            <select name="view" defaultValue={selectedView} className={inputClass} aria-label="Periodo da dashboard">
              <option value="week">Semana</option>
              <option value="month">Mes atual</option>
              <option value="year">Ano</option>
            </select>
            <input name="date" type="date" defaultValue={selectedDate} className={inputClass} aria-label="Data base" />
            <button className={buttonClass}>
              <Filter size={16} />
              Filtrar
            </button>
          </form>
        </div>

        <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/35 p-3">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">Resumo diario</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {kpis.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <div className="flex items-center gap-4">
                    <span className={`grid size-14 shrink-0 place-items-center rounded-lg border ${item.box}`}>
                      <Icon size={27} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-zinc-300">{item.label}</span>
                      <span className={`mt-1 block text-2xl font-semibold ${item.tone}`}>{item.value}</span>
                      <span className="mt-1 block text-sm text-zinc-500">{item.detail}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-500">Prioridade</p>
              <h2 className="text-xl font-semibold text-zinc-50">Tarefas de hoje</h2>
            </div>
            <ClipboardCheck size={22} className="text-teal-300" />
          </div>
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={`${task.title}-${task.due}`} className={`rounded-lg border border-zinc-800 border-l-4 ${task.accent} bg-zinc-950/70 p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-zinc-100">{task.title}</h3>
                    <p className="mt-2 text-sm text-zinc-500">{task.area}</p>
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
              <p className="text-sm text-zinc-500">Frota</p>
              <h2 className="text-xl font-semibold text-zinc-50">Proximas revisoes e inspecoes</h2>
            </div>
            <Car size={22} className="text-blue-300" />
          </div>
          <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
            {dashboard.fleetAlerts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/45 p-4 text-sm text-zinc-500">
                Sem revisoes ou inspecoes com data estimada.
              </p>
            ) : (
              dashboard.fleetAlerts.slice(0, 8).map((item) => (
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

        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-500">Planeamento</p>
              <h2 className="text-xl font-semibold text-zinc-50">Calendario de manutencoes</h2>
            </div>
            <CalendarDays size={22} className="text-cyan-300" />
          </div>
          <div className="grid max-h-[460px] gap-3 overflow-y-auto pr-1">
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
