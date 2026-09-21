import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  ClipboardList,
  Filter,
  Inbox,
  Siren,
  UserRound,
  Wrench,
} from "lucide-react";

import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel } from "@/app/components/ui";
import { requireUser } from "@/lib/auth";
import { dailyPlanCount, getDailyPlanData, lisbonDateValue } from "@/lib/daily-plan";
import { formatDate, formatShortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type DailyPlanPageProps = {
  searchParams?: Promise<{
    date?: string;
    userId?: string;
  }>;
};

const ticketPriorityLabels: Record<string, string> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em curso",
  OPEN: "Aberto",
  PAUSED: "Pausado",
  SUSPENDED: "Suspenso",
};

function statusLabel(status: string) {
  return statusLabels[status] ?? status;
}

function priorityLabel(priority: string) {
  return ticketPriorityLabels[priority] ?? priority;
}

function dateWithTime(date: Date | null | undefined, time?: string | null) {
  if (!date) return time || "Sem data";
  return `${formatDate(date)}${time ? ` · ${time}` : ""}`;
}

function priorityTone(priority: string) {
  if (priority === "CRITICAL") return "border-rose-300/40 bg-rose-300/10 text-rose-100";
  if (priority === "HIGH") return "border-amber-300/40 bg-amber-300/10 text-amber-100";
  return "border-zinc-800 bg-zinc-950/70 text-zinc-200";
}

function lateBadge(isLate: boolean) {
  if (!isLate) return null;

  return (
    <span className="rounded-md border border-rose-300/35 bg-rose-300/10 px-2 py-1 text-xs font-semibold text-rose-200">
      Atrasado
    </span>
  );
}

export default async function DailyPlanPage({ searchParams }: DailyPlanPageProps) {
  const viewer = await requireUser();
  const params = (await searchParams) ?? {};
  const selectedDate = params.date || lisbonDateValue();
  const plan = await getDailyPlanData(viewer, {
    date: selectedDate,
    userId: params.userId,
  });
  const total = dailyPlanCount(plan);
  const focusLabel = plan.isTeamView ? "Toda a equipa" : plan.selectedUser?.name ?? viewer.name;

  const summary = [
    { label: "OPs", value: plan.schedules.length, icon: Wrench, tone: "text-cyan-200" },
    { label: "Tarefas", value: plan.tasks.length, icon: ClipboardList, tone: "text-teal-200" },
    { label: "Tickets", value: plan.tickets.length, icon: Siren, tone: "text-amber-200" },
    { label: "Triagem", value: plan.triageTickets.length, icon: Inbox, tone: "text-rose-200" },
  ];

  return (
    <AppShell activeHref="/plano">
      <PageHeader
        eyebrow="Operação"
        title="Plano do dia"
        description="Fila diária por pessoa, com rotina prevista e tickets que precisam de decisão."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/manutencao" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-cyan-300/35 bg-cyan-300/10 px-4 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200">
              <Wrench size={18} />
              Manutenção
            </Link>
            <Link href="/tickets" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-amber-300/35 bg-amber-300/10 px-4 text-sm font-semibold text-amber-100 transition hover:border-amber-200">
              <Siren size={18} />
              Tickets
            </Link>
          </div>
        }
      />

      <Panel>
        <form className={`grid gap-3 ${plan.canViewTeam ? "md:grid-cols-[180px_minmax(220px,1fr)_auto]" : "md:grid-cols-[180px_auto]"}`}>
          <input name="date" type="date" defaultValue={plan.dateValue} className={inputClass} />

          {plan.canViewTeam ? (
            <select name="userId" defaultValue={plan.selectedUserId ?? "ALL"} className={inputClass}>
              <option value="ALL">Toda a equipa</option>
              {plan.users.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          ) : null}

          <button className={buttonClass}>
            <Filter size={16} />
            Filtrar
          </button>
        </form>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4 md:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Plano</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-50">{total}</p>
            <p className="mt-1 truncate text-sm text-zinc-500">{focusLabel}</p>
          </div>

          {summary.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-zinc-500">{item.label}</p>
                  <Icon size={18} className={item.tone} />
                </div>
                <p className={`mt-2 text-2xl font-semibold ${item.tone}`}>{item.value}</p>
              </div>
            );
          })}
        </div>
      </Panel>

      {plan.urgentTickets.length > 0 ? (
        <section className="rounded-lg border border-rose-300/35 bg-rose-300/10 p-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg border border-rose-300/35 bg-rose-300/10 text-rose-100">
              <AlertTriangle size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-200">Urgente agora</p>
              <h2 className="text-xl font-semibold text-zinc-50">Tickets que podem interromper o plano</h2>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {plan.urgentTickets.map((ticket) => (
              <Link key={ticket.id} href={ticket.href} className={`rounded-lg border p-4 transition hover:border-rose-200/60 ${priorityTone(ticket.priority)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">{ticket.number}</p>
                    <h3 className="mt-2 line-clamp-2 font-semibold text-zinc-50">{ticket.title}</h3>
                    <p className="mt-2 text-sm text-zinc-300">{ticket.equipment.name}</p>
                  </div>
                  <span className="rounded-md bg-black/25 px-2 py-1 text-xs font-semibold">{priorityLabel(ticket.priority)}</span>
                </div>
                <p className="mt-3 text-xs text-zinc-400">Responsável: {ticket.assignedTo?.name ?? "sem responsável"}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-500">{plan.dateLabel}</p>
              <h2 className="text-xl font-semibold text-zinc-50">OPs programadas</h2>
            </div>
            <CalendarCheck size={22} className="text-cyan-300" />
          </div>

          <div className="space-y-3">
            {plan.schedules.length === 0 ? (
              <EmptyState title="Sem OPs programadas" description="Não há manutenções atribuídas para esta vista." />
            ) : (
              plan.schedules.map((schedule) => (
                <Link key={schedule.id} href={schedule.href} className="block rounded-lg border border-zinc-800 bg-zinc-950/65 p-4 transition hover:border-cyan-300/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-zinc-100">{schedule.title}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{schedule.equipment.name}</p>
                    </div>
                    {lateBadge(schedule.isLate)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                    <span className="rounded-md border border-zinc-800 px-2 py-1">{formatDate(schedule.scheduledAt)}</span>
                    <span className="rounded-md border border-zinc-800 px-2 py-1">{schedule.assignedTo?.name ?? "Sem responsável"}</span>
                    <span className="rounded-md border border-zinc-800 px-2 py-1">{schedule.workOrder ? statusLabel(schedule.workOrder.status) : "OP por abrir"}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-500">{focusLabel}</p>
              <h2 className="text-xl font-semibold text-zinc-50">Tarefas</h2>
            </div>
            <ClipboardList size={22} className="text-teal-300" />
          </div>

          <div className="space-y-3">
            {plan.tasks.length === 0 ? (
              <EmptyState title="Sem tarefas" description="Não há tarefas atribuídas para esta vista." />
            ) : (
              plan.tasks.map((task) => (
                <Link key={task.id} href={task.href} className="block rounded-lg border border-zinc-800 bg-zinc-950/65 p-4 transition hover:border-teal-300/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-zinc-100">{task.title}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{task.equipment?.name ?? "Sem equipamento"}</p>
                    </div>
                    {lateBadge(task.isLate)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                    <span className="rounded-md border border-zinc-800 px-2 py-1">{dateWithTime(task.dueDate ?? task.nextDue, task.dueTime)}</span>
                    <span className="rounded-md border border-zinc-800 px-2 py-1">{task.assignedTo?.name ?? "Sem responsável"}</span>
                    <span className="rounded-md border border-zinc-800 px-2 py-1">{statusLabel(task.status)}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-500">Durante o dia</p>
              <h2 className="text-xl font-semibold text-zinc-50">Tickets atribuídos</h2>
            </div>
            <Siren size={22} className="text-amber-300" />
          </div>

          <div className="space-y-3">
            {plan.tickets.length === 0 ? (
              <EmptyState title="Sem tickets atribuídos" description="Os tickets aparecem aqui quando têm responsável." />
            ) : (
              plan.tickets.map((ticket) => (
                <Link key={ticket.id} href={ticket.href} className={`block rounded-lg border p-4 transition hover:border-amber-300/50 ${priorityTone(ticket.priority)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">{ticket.number}</p>
                      <h3 className="mt-2 font-semibold text-zinc-50">{ticket.title}</h3>
                      <p className="mt-1 text-sm text-zinc-400">{ticket.equipment.name}</p>
                    </div>
                    <span className="rounded-md bg-black/25 px-2 py-1 text-xs font-semibold">{priorityLabel(ticket.priority)}</span>
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">
                    {statusLabel(ticket.status)} · {ticket.assignedTo?.name ?? "Sem responsável"} · {formatShortDate(ticket.openedAt)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </Panel>

        {plan.canViewTeam ? (
          <Panel>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-zinc-500">Gestão</p>
                <h2 className="text-xl font-semibold text-zinc-50">Tickets por atribuir</h2>
              </div>
              <UserRound size={22} className="text-rose-300" />
            </div>

            <div className="space-y-3">
              {plan.triageTickets.length === 0 ? (
                <EmptyState title="Triagem limpa" description="Não há tickets sem responsável." />
              ) : (
                plan.triageTickets.map((ticket) => (
                  <Link key={ticket.id} href={ticket.href} className={`block rounded-lg border p-4 transition hover:border-rose-300/50 ${priorityTone(ticket.priority)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">{ticket.number}</p>
                        <h3 className="mt-2 font-semibold text-zinc-50">{ticket.title}</h3>
                        <p className="mt-1 text-sm text-zinc-400">{ticket.equipment.name}</p>
                      </div>
                      <span className="rounded-md bg-black/25 px-2 py-1 text-xs font-semibold">{priorityLabel(ticket.priority)}</span>
                    </div>
                    <p className="mt-3 text-xs text-zinc-500">
                      Aberto por {ticket.openedBy?.name ?? "Sistema"} · {formatShortDate(ticket.openedAt)}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </Panel>
        ) : null}
      </section>
    </AppShell>
  );
}
