import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  Car,
  ClipboardCheck,
  DollarSign,
  Filter,
  Wrench,
} from "lucide-react";

import { AppShell } from "@/app/components/app-shell";
import { buttonClass, inputClass, Panel } from "@/app/components/ui";
import { getDashboardData } from "@/lib/data";
import { formatCurrency, formatDate, formatShortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const fallbackTasks = [
  {
    title: "Verificar bomba de agua",
    area: "Infraestrutura",
    due: "09:00",
    status: "Critica",
    accent: "border-l-rose-400",
    href: "/tarefas",
  },
  {
    title: "Limpeza filtro AVAC",
    area: "Manutencao",
    due: "15:00",
    status: "Planeada",
    accent: "border-l-cyan-400",
    href: "/tarefas",
  },
  {
    title: "Conferir stock detergente tecnico",
    area: "Inventario",
    due: "18:00",
    status: "Baixo risco",
    accent: "border-l-emerald-400",
    href: "/tarefas",
  },
];

const fallbackCalendar = [
  { date: "07 Jun", title: "Calibração balança", tag: "Semestral", href: "/manutencao" },
  { date: "12 Jun", title: "Revisão quadro elétrico", tag: "Anual", href: "/manutencao" },
];

const taskStatusLabels: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em curso",
  COMPLETED: "Concluída",
  CANCELED: "Cancelada",
};

const taskFrequencyLabels: Record<string, string> = {
  DAILY: "Diária",
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  FOUR_MONTHLY: "Quadrimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
  BIENNIAL: "2 em 2 anos",
  FIVE_YEAR: "5 em 5 anos",
};

const alertStatusLabels: Record<string, string> = {
  PENDING: "Tarefa pendente",
  IN_PROGRESS: "Tarefa em curso",
  OPEN: "OP criada",
  PAUSED: "OP pausada",
  DONE: "OP concluída",
  VALIDATED: "OP validada",
  CANCELED: "Cancelada",
  NO_OP: "Sem OP criada",
};

function alertToneClass(tone: string) {
  if (tone === "rose") {
    return "border-rose-300/35 bg-rose-300/10 text-rose-100";
  }

  if (tone === "amber") {
    return "border-amber-300/35 bg-amber-300/10 text-amber-100";
  }

  return "border-teal-300/35 bg-teal-300/10 text-teal-100";
}

type DashboardPageProps = {
  searchParams?: Promise<{ view?: string; date?: string }>;
};

export default async function Page({ searchParams }: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const selectedView = params.view || "month";
  const selectedDate = params.date || new Date().toISOString().slice(0, 10);
  const dashboard = await getDashboardData({ view: selectedView, date: selectedDate });

  const tasks =
    dashboard.tasks.length > 0
      ? dashboard.tasks.map((task) => ({
          title: task.title,
          area: task.equipment?.name ?? (task.frequency ? taskFrequencyLabels[task.frequency] : null) ?? "Pontual",
          due: formatShortDate(task.dueDate ?? task.nextDue),
          status: taskStatusLabels[task.status] ?? task.status,
          accent: "border-l-teal-400",
          href: `/tarefas?taskId=${task.id}`,
        }))
      : fallbackTasks;

  const calendar =
    dashboard.calendar.length > 0
      ? dashboard.calendar.map((event) => ({
          date: formatShortDate(event.scheduledAt),
          title: event.title,
          tag: event.equipment?.name ?? event.frequency,
          href: `/manutencao?eventId=${event.id}`,
        }))
      : fallbackCalendar;

  const kpis = [
    {
      label: "Tarefas hoje",
      value: String(dashboard.kpis.tasksToday),
      detail: `${dashboard.kpis.criticalTasks} críticas`,
      tone: "text-teal-300",
      icon: ClipboardCheck,
      box: "border-teal-300/40 bg-teal-300/10 text-teal-200",
    },
    {
      label: "Despesas mês",
      value: formatCurrency(dashboard.kpis.monthlyExpenses),
      detail: "Valor registado",
      tone: "text-amber-300",
      icon: DollarSign,
      box: "border-amber-300/40 bg-amber-300/10 text-amber-200",
    },
    {
      label: "Manutenções hoje",
      value: String(dashboard.kpis.maintenanceToday),
      detail: "Agendadas para hoje",
      tone: "text-sky-300",
      icon: Wrench,
      box: "border-sky-300/40 bg-sky-300/10 text-sky-200",
    },
    {
      label: "Frota a vencer",
      value: String(dashboard.kpis.fleetDueSoon),
      detail: "Próximos 30 dias ou 1000 km",
      tone: "text-lime-300",
      icon: Car,
      box: "border-lime-300/40 bg-lime-300/10 text-lime-200",
    },
  ];

  return (
    <AppShell activeHref="/">
      <section className="rounded-lg border border-zinc-800 bg-[linear-gradient(135deg,rgba(20,184,166,0.08),rgba(14,165,233,0.04)_45%,rgba(0,0,0,0.15))] p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-50">Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-400">Resumo diário da manutenção</p>
          </div>

          <form className="grid gap-2 sm:grid-cols-[180px_180px_auto]">
            <select name="view" defaultValue={selectedView} className={inputClass} aria-label="Periodo da dashboard">
              <option value="week">Semana</option>
              <option value="month">Mês atual</option>
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
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">Resumo diário</p>

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

      {dashboard.operationalAlerts.length > 0 ? (
        <section className="rounded-lg border border-rose-300/25 bg-rose-300/5 p-4">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-rose-300/35 bg-rose-300/10 text-rose-200">
              <AlertTriangle size={22} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200">
                Alertas operacionais
              </p>
              <h2 className="mt-1 text-xl font-semibold text-zinc-50">
                Tarefas e manutenções a precisar de atenção
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Mostra tarefas vencidas, manutenções fora da data e OP criadas ou iniciadas.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {dashboard.operationalAlerts.map((alert) => (
              <Link
                key={alert.id}
                href={alert.href}
                className={`block rounded-lg border p-4 transition hover:border-rose-200/50 ${alertToneClass(alert.tone)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">
                      {alert.type === "TASK" ? "Tarefa" : "Manutenção"}
                    </p>
                    <h3 className="mt-2 line-clamp-2 font-semibold text-zinc-50">{alert.title}</h3>
                    <p className="mt-2 truncate text-sm text-zinc-400">{alert.detail}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-black/25 px-2 py-1 text-xs text-zinc-200">
                    {formatShortDate(alert.date)}
                  </span>
                </div>

                <p className="mt-3 inline-flex rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs font-semibold text-zinc-100">
                  {alertStatusLabels[alert.status] ?? alert.status}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {dashboard.ticketAlerts.length > 0 ? (
        <section className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-amber-300/40 bg-amber-300/10 text-amber-200">
                <AlertTriangle size={22} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Alerta de tickets</p>
                <h2 className="mt-1 text-xl font-semibold text-zinc-50">
                  {dashboard.kpis.openTickets} ticket{dashboard.kpis.openTickets === 1 ? "" : "s"} novo
                  {dashboard.kpis.openTickets === 1 ? "" : "s"} por iniciar
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Abre a fila de manutenção para iniciar, pausar, concluir ou validar o chamado.
                </p>
              </div>
            </div>

            <Link href="/tickets" className={`${buttonClass} justify-center`}>
              Ver tickets
            </Link>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.ticketAlerts.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/tickets?ticketId=${ticket.id}`}
                className="rounded-lg border border-amber-300/20 bg-zinc-950/70 p-4 transition hover:border-amber-200/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">{ticket.number}</p>
                    <h3 className="mt-2 truncate font-semibold text-zinc-100">{ticket.title}</h3>
                    <p className="mt-1 truncate text-sm text-zinc-500">{ticket.equipment.name}</p>
                  </div>
                  <span className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-300">Aberto</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-zinc-400">{ticket.problem}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

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
              <Link
                key={`${task.title}-${task.due}`}
                href={task.href}
                className={`block rounded-lg border border-zinc-800 border-l-4 ${task.accent} bg-zinc-950/70 p-4 transition hover:border-teal-300/50 hover:bg-zinc-900/80`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-zinc-100">{task.title}</h3>
                    <p className="mt-2 text-sm text-zinc-500">{task.area}</p>
                  </div>
                  <span className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-300">{task.due}</span>
                </div>
                <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">{task.status}</p>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-500">Frota</p>
              <h2 className="text-xl font-semibold text-zinc-50">Próximas revisões e inspeções</h2>
            </div>
            <Car size={22} className="text-blue-300" />
          </div>

          <div className="max-h-115 space-y-3 overflow-y-auto pr-1">
            {dashboard.fleetAlerts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/45 p-4 text-sm text-zinc-500">
                Sem revisões ou inspeções com data estimada.
              </p>
            ) : (
              dashboard.fleetAlerts.slice(0, 8).map((item) => (
                <Link
                  key={item.id}
                  href={`/frota?alertId=${item.id}`}
                  className="block rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 transition hover:border-blue-300/50 hover:bg-zinc-900/80"
                >
                  <p className={item.type === "Inspeção" ? "text-sm font-semibold text-lime-200" : "text-sm font-semibold text-blue-200"}>
                    {item.type}
                  </p>
                  <h3 className="mt-2 font-medium text-zinc-100">{item.title}</h3>
                  <p className="mt-1 text-xs text-zinc-500">{item.plate}</p>
                  <p className="mt-3 text-sm font-semibold text-zinc-200">
                    {item.dueDate.getTime() > 0 ? formatDate(item.dueDate) : "Vencido por km"}
                  </p>
                  {item.kmRemaining !== null && (
                    <p className={item.kmRemaining <= 1000 ? "mt-1 text-xs font-semibold text-amber-200" : "mt-1 text-xs text-zinc-500"}>
                      {item.kmRemaining <= 0 ? "Km ultrapassados" : `${item.kmRemaining.toLocaleString("pt-PT")} km restantes`}
                    </p>
                  )}
                </Link>
              ))
            )}
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

          <div className="grid max-h-115 gap-3 overflow-y-auto pr-1">
            {calendar.map((event) => (
              <Link
                key={`${event.title}-${event.date}`}
                href={event.href}
                className="block rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 transition hover:border-cyan-300/50 hover:bg-zinc-900/80"
              >
                <p className="text-sm font-semibold text-cyan-200">{event.date}</p>
                <h3 className="mt-2 text-base font-medium text-zinc-100">{event.title}</h3>
                <p className="mt-3 inline-flex rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-400">{event.tag}</p>
              </Link>
            ))}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}