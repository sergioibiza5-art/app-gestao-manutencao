import { Bell, CheckCircle2, Pause, Play, Plus, Siren, Trash2, Wrench } from "lucide-react";
import Link from "next/link";

import {
  completeMaintenanceTicket,
  createMaintenanceTicket,
  deleteMaintenanceTicket,
  pauseMaintenanceTicket,
  reopenMaintenanceTicket,
  resolveOwnMaintenanceTicket,
  startMaintenanceTicket,
  suspendMaintenanceTicket,
  updateMaintenanceTicketTiming,
  validateMaintenanceTicket,
} from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { DetailsPopup } from "@/app/components/details-modal";
import { DetailsOpenButton } from "@/app/components/details-open-button";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { TicketConsumables } from "@/app/tickets/ticket-consumables";
import { TicketSubmitButton } from "@/app/tickets/ticket-submit-button";
import { requireUser } from "@/lib/auth";
import { getTicketsData } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: "Aberto",
    IN_PROGRESS: "Em curso",
    PAUSED: "Pausado",
    SUSPENDED: "Suspenso",
    DONE: "Concluído",
    VALIDATED: "Validado",
    CANCELED: "Cancelado",
  };

  return labels[status] ?? status;
}

function ticketStatusClass(status: string) {
  const classes: Record<string, string> = {
    OPEN: "border-orange-300/45 bg-orange-300/10",
    IN_PROGRESS: "border-yellow-300/45 bg-yellow-300/10",
    PAUSED: "border-amber-300/45 bg-amber-300/10",
    SUSPENDED: "border-orange-300/45 bg-orange-300/10",
    DONE: "border-blue-300/45 bg-blue-300/10",
    VALIDATED: "border-green-300/45 bg-green-300/10",
    CANCELED: "border-red-300/45 bg-red-300/10",
  };

  return classes[status] ?? "border-zinc-800 bg-zinc-950/65";
}

function ticketStatusTextClass(status: string) {
  const classes: Record<string, string> = {
    OPEN: "text-orange-300",
    IN_PROGRESS: "text-yellow-300",
    PAUSED: "text-amber-300",
    SUSPENDED: "text-orange-300",
    DONE: "text-blue-300",
    VALIDATED: "text-green-300",
    CANCELED: "text-red-300",
  };

  return classes[status] ?? "text-zinc-500";
}

function hours(value: number) {
  return new Intl.NumberFormat("pt-PT", {
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

function duration(seconds: number) {
  const safeSeconds = Math.max(Math.floor(seconds), 0);
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function dateTimeInputValue(date: Date | null | undefined) {
  if (!date) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function durationParts(seconds: number) {
  const safeSeconds = Math.max(seconds, 0);
  return {
    hours: Math.floor(safeSeconds / 3600),
    minutes: Math.floor((safeSeconds % 3600) / 60),
  };
}

function workTime(ticket: {
  totalWorkSeconds: number;
  startedAt: Date | null;
  lastResumedAt?: Date | null;
  status?: string;
  completedAt?: Date | null;
}) {
  if (ticket.status === "IN_PROGRESS" && ticket.lastResumedAt) {
    return duration(ticket.totalWorkSeconds + Math.max(Math.floor((new Date().getTime() - ticket.lastResumedAt.getTime()) / 1000), 0));
  }

  if (ticket.totalWorkSeconds > 0) {
    return duration(ticket.totalWorkSeconds);
  }

  const activeSeconds = ticket.startedAt
    ? Math.max(Math.floor(((ticket.completedAt ?? new Date()).getTime() - ticket.startedAt.getTime()) / 1000), 0)
    : 0;

  return duration(activeSeconds);
}

function workTimeSeconds(ticket: {
  totalWorkSeconds: number;
  startedAt: Date | null;
  lastResumedAt?: Date | null;
  status?: string;
  completedAt?: Date | null;
}) {
  if (ticket.status === "IN_PROGRESS" && ticket.lastResumedAt) {
    return ticket.totalWorkSeconds + Math.max(Math.floor((new Date().getTime() - ticket.lastResumedAt.getTime()) / 1000), 0);
  }

  if (ticket.totalWorkSeconds > 0) {
    return ticket.totalWorkSeconds;
  }

  return ticket.startedAt
    ? Math.max(Math.floor(((ticket.completedAt ?? new Date()).getTime() - ticket.startedAt.getTime()) / 1000), 0)
    : 0;
}

function downtime(ticket: {
  machineStopped?: boolean;
  downtimeSeconds: number;
  openedAt: Date;
  completedAt?: Date | null;
}) {
  if (ticket.machineStopped === false) {
    return "00:00";
  }

  if (ticket.downtimeSeconds > 0) {
    return duration(ticket.downtimeSeconds);
  }

  const end = ticket.completedAt ?? new Date();

  return duration(Math.floor((end.getTime() - ticket.openedAt.getTime()) / 1000));
}

function downtimeSecondsValue(ticket: {
  machineStopped?: boolean;
  downtimeSeconds: number;
  openedAt: Date;
  completedAt?: Date | null;
}) {
  if (ticket.machineStopped === false) return 0;
  if (ticket.downtimeSeconds > 0) return ticket.downtimeSeconds;
  const end = ticket.completedAt ?? new Date();
  return Math.max(Math.floor((end.getTime() - ticket.openedAt.getTime()) / 1000), 0);
}

function TicketCreateForm({
  equipment,
  compact = false,
}: {
  equipment: Array<{
    id: string;
    name: string;
    code: string | null;
    location: string | null;
  }>;
  compact?: boolean;
}) {
  return (
    <form action={createMaintenanceTicket} className={compact ? "grid gap-3" : "mt-4 grid gap-3"}>
      <select name="equipmentId" required className={inputClass}>
        <option value="">Selecionar máquina/equipamento</option>
        {equipment.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
            {item.code ? ` - ${item.code}` : ""}
          </option>
        ))}
      </select>

      {equipment.length === 0 ? (
        <p className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">
          Este utilizador ainda não tem equipamentos permitidos. Vai a Acessos e associa as máquinas ao utilizador de ticket.
        </p>
      ) : null}

      <input name="title" className={inputClass} placeholder="Título curto do problema" />

      <select name="machineStopped" className={inputClass} defaultValue="true">
        <option value="true">Paragem da maquina? Sim</option>
        <option value="false">Paragem da maquina? Nao</option>
      </select>

      <input name="location" className={inputClass} placeholder="Nome do operador" />

      <textarea name="problem" required className={textareaClass} placeholder="Descreve o problema da máquina" />

      <TicketSubmitButton />
    </form>
  );
}

function TicketSuccessMessage({ type }: { type?: string }) {
  if (!type) return null;

  const message =
    type === "duplicate"
      ? "Esse pedido ja tinha sido enviado. Mantive apenas um ticket em aberto para evitar duplicados."
      : "Ticket enviado com sucesso. A manutencao foi notificada.";

  return <span>{message}</span>;
}

type TicketsPageProps = {
  searchParams?: Promise<{
    created?: string;
    resolved?: string;
    deleted?: string;
    ticketId?: string;
  }>;
};

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const user = await requireUser();
  const data = await getTicketsData({ id: user.id, role: user.role });
  const isTicketOnly = user.role === "TICKET";
  const params = (await searchParams) ?? {};

  if (isTicketOnly) {
    const ownOpenTickets = data.tickets.filter((ticket) => ["OPEN", "IN_PROGRESS", "PAUSED", "SUSPENDED"].includes(ticket.status));

    return (
      <AppShell activeHref="/tickets">
        <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
          <Panel>
            <div className="flex items-center gap-3">
              <Wrench size={22} className="text-cyan-300" />
              <div>
                <p className="text-sm text-zinc-500">Meus pedidos</p>
                <h2 className="text-xl font-semibold text-zinc-50">Tickets em aberto</h2>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {ownOpenTickets.length === 0 ? (
                <EmptyState title="Sem tickets em aberto" description="Os pedidos que criares aparecem aqui ate serem validados." />
              ) : (
                ownOpenTickets.map((ticket) => (
                  <details
                    key={ticket.id}
                    className={`group rounded-lg border p-4 transition open:border-teal-300/60 ${ticketStatusClass(ticket.status)}`}
                  >
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${ticketStatusTextClass(ticket.status)}`}>
                          {ticket.number} - {statusLabel(ticket.status)}
                        </p>
                        <h3 className="mt-1 truncate text-base font-semibold text-zinc-100">{ticket.title}</h3>
                        <p className="mt-1 truncate text-xs text-zinc-500">{ticket.equipment.name}</p>
                      </div>
                      <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-400 group-open:hidden">Abrir</span>
                    </summary>

                    <div className="mt-3 border-t border-zinc-800 pt-3">
                      <p className="text-sm leading-6 text-zinc-400">{ticket.problem}</p>
                      <div className="mt-3 grid gap-1 text-xs text-zinc-500">
                        <span>Aberto: {formatDate(ticket.openedAt)}</span>
                        <span>Paragem: {downtime(ticket)}</span>
                        <span>Maquina parada: {ticket.machineStopped ? "Sim" : "Nao"}</span>
                      </div>

                      <form action={resolveOwnMaintenanceTicket} className="mt-3 grid gap-2">
                        <input type="hidden" name="id" value={ticket.id} />
                        <textarea
                          name="solution"
                          required
                          className={textareaClass}
                          placeholder="Descreve como o problema foi resolvido"
                        />
                        <textarea name="observations" className={textareaClass} placeholder="Observacoes opcionais" />
                        <button className={`${buttonClass} w-fit`}>
                          <CheckCircle2 size={17} />
                          Concluir ticket
                        </button>
                      </form>
                    </div>
                  </details>
                ))
              )}
            </div>
          </Panel>
          <Panel>
            <div className="flex items-center gap-3">
              <Siren size={24} className="text-red-300" />
              <div>
                <p className="text-sm text-zinc-500">Posto de trabalho</p>
                <h1 className="text-2xl font-semibold text-zinc-50">Chamar manutenção</h1>
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Seleciona a máquina, coloca o nome do operador e descreve o problema. A manutenção recebe o ticket para iniciar a reparação.
            </p>

            {params.created ? (
              <div className="mt-4 rounded-lg border border-teal-300/30 bg-teal-300/10 p-3 text-sm font-semibold text-teal-100">
                <TicketSuccessMessage type={params.created} />
              </div>
            ) : null}

            {params.resolved ? (
              <div className="mt-4 rounded-lg border border-teal-300/30 bg-teal-300/10 p-3 text-sm font-semibold text-teal-100">
                Ticket concluido com sucesso. A manutencao pode validar o registo.
              </div>
            ) : null}

            <TicketCreateForm equipment={data.equipment} />
          </Panel>
        </section>
      </AppShell>
    );
  }

  const canManageTickets = user.role === "ADMIN" || user.role === "MANAGER";
  const newTicketAction = (
    <DetailsOpenButton targetId="novo-ticket-manual" className={buttonClass}>
      <Plus size={18} />
      Novo ticket
    </DetailsOpenButton>
  );

  return (
    <AppShell activeHref="/tickets">
      <PageHeader
        eyebrow="Tickets"
        title="Avarias e chamados de manutenção"
        description="Regista avarias por posto, acompanha tempos de reparação, consumíveis usados, soluções e OP geradas."
        action={newTicketAction}
      />

      <DetailsPopup id="novo-ticket-manual" title="novo ticket" maxWidth="max-w-3xl">
        <Panel>
          <div className="flex items-center gap-3">
            <Siren size={22} className="text-red-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Novo ticket manual</h2>
          </div>

          <TicketCreateForm equipment={data.equipment} />
        </Panel>
      </DetailsPopup>

      {params.created || params.deleted ? (
        <div className="rounded-lg border border-teal-300/30 bg-teal-300/10 p-3 text-sm font-semibold text-teal-100">
          {params.deleted ? "Ticket eliminado com sucesso." : <TicketSuccessMessage type={params.created} />}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Abertos", data.kpis.open, "text-orange-300"],
          ["Em curso/pausados", data.kpis.inProgress, "text-yellow-300"],
          ["Por validar", data.kpis.waitingValidation, "text-blue-300"],
          ["MTTR horas", hours(data.kpis.averageRepairHours), "text-teal-300"],
        ].map(([label, value, tone]) => (
          <Panel key={label}>
            <p className="text-sm text-zinc-500">{label}</p>
            <p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p>
          </Panel>
        ))}
      </section>

      <section>
        <Panel>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Bell size={21} className="text-amber-300" />
                <h2 className="text-xl font-semibold text-zinc-50">Notificações</h2>
              </div>
              <span className="rounded-full border border-amber-300/30 px-2 py-1 text-xs font-semibold text-amber-200">
                {data.unreadNotifications} novas
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {data.notifications.length === 0 ? (
                <EmptyState title="Sem notificações" description="Quando entrar um ticket, aparece aqui." />
              ) : (
                data.notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href="/tickets"
                    className="block rounded-lg border border-zinc-800 bg-zinc-950/65 p-3 transition hover:border-amber-300/40"
                  >
                    <p className="text-sm font-semibold text-zinc-100">{notification.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">{notification.body ?? "Sem detalhe"}</p>
                  </Link>
                ))
              )}
            </div>
        </Panel>
      </section>

      <section>
        <Panel>
          <div className="flex items-center gap-3">
            <Wrench size={22} className="text-cyan-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Fila de manutenção</h2>
          </div>

          <div className="mt-4 space-y-3">
            {data.tickets.length === 0 ? (
              <EmptyState title="Sem tickets" description="Quando um posto chamar a manutenção, o ticket aparece aqui." />
            ) : (
              data.tickets.map((ticket) => (
                <details
                  key={ticket.id}
                  id={`ticket-${ticket.id}`}
                  open={params.ticketId === ticket.id}
                  className={`group rounded-lg border p-4 transition open:border-teal-300/60 ${ticketStatusClass(ticket.status)}`}
                >
                  <summary className="flex cursor-pointer list-none flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${ticketStatusTextClass(ticket.status)}`}>
                        {ticket.number} - {statusLabel(ticket.status)}
                      </p>

                      <h3 className="mt-1 truncate text-lg font-semibold text-zinc-100">{ticket.title}</h3>

                      <p className="mt-1 truncate text-sm text-zinc-500">
                        {ticket.equipment.name} - {ticket.location ?? ticket.equipment.location ?? "sem operador/local"}
                      </p>
                    </div>

                    <div className="grid gap-1 text-sm text-zinc-500 xl:text-right">
                      <span>Aberto: {formatDate(ticket.openedAt)}</span>
                      <span>Paragem: {downtime(ticket)}</span>
                      <span>{ticket.machineStopped ? "Maquina parada" : "Sem paragem da maquina"}</span>
                      <span>Trabalho: {workTime(ticket)}</span>
                      <span>Custo: {formatCurrency(ticket.totalCost)}</span>
                      {ticket.workOrder ? <span className="font-semibold text-teal-300">{ticket.workOrder.number}</span> : null}
                      <span className="text-xs text-teal-300 group-open:hidden">Abrir ticket</span>
                    </div>
                  </summary>

                  <div className="mt-4 border-t border-zinc-800 pt-4">
                    <p className="text-sm leading-6 text-zinc-400">{ticket.problem}</p>

                    <div className="mt-3 grid gap-2 rounded-lg border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-400 md:grid-cols-2">
                      <p>
                        Aberto por:{" "}
                        <strong className="text-zinc-100">{ticket.openedBy?.name ?? "Sistema"}</strong>
                      </p>
                      <p>
                        Responsável:{" "}
                        <strong className="text-zinc-100">{ticket.assignedTo?.name ?? "Sem registo"}</strong>
                      </p>
                    </div>

                    {ticket.workOrder ? (
                      <div className="mt-3 rounded-lg border border-teal-300/25 bg-teal-300/10 p-3">
                        <p className="text-sm font-semibold text-teal-100">OP {ticket.workOrder.number}</p>
                        <p className="mt-1 text-sm text-zinc-300">{ticket.workOrder.title}</p>
                        {ticket.workOrder.notes ? (
                          <p className="mt-2 whitespace-pre-line text-xs leading-5 text-zinc-400">{ticket.workOrder.notes}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(ticket.status === "OPEN" || ticket.status === "PAUSED" || ticket.status === "SUSPENDED") && (
                      <form action={startMaintenanceTicket}>
                        <input type="hidden" name="id" value={ticket.id} />
                        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-300/35 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-100">
                          <Play size={15} />
                          {ticket.status === "PAUSED" || ticket.status === "SUSPENDED" ? "Retomar" : "Iniciar"}
                        </button>
                      </form>
                    )}

                    {ticket.status === "IN_PROGRESS" && (
                      <form action={pauseMaintenanceTicket}>
                        <input type="hidden" name="id" value={ticket.id} />
                        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-300/35 bg-amber-300/10 px-3 text-sm font-semibold text-amber-100">
                          <Pause size={15} />
                          Pausar
                        </button>
                      </form>
                    )}

                    {["OPEN", "IN_PROGRESS", "PAUSED"].includes(ticket.status) && (
                      <form action={suspendMaintenanceTicket} className="w-full rounded-lg border border-orange-300/25 bg-orange-300/5 p-3">
                        <input type="hidden" name="id" value={ticket.id} />
                        <textarea
                          name="suspensionNotes"
                          className={textareaClass}
                          placeholder="Observações da suspensão: sem solução, aguarda peça, aguarda fornecedor, precisa de análise..."
                        />
                        <button className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-orange-300/35 bg-orange-300/10 px-3 text-sm font-semibold text-orange-100">
                          <Pause size={15} />
                          Suspender ticket
                        </button>
                      </form>
                    )}

                    {(ticket.status === "DONE" || ticket.status === "VALIDATED") && (
                      <form action={reopenMaintenanceTicket} className="w-full rounded-lg border border-sky-300/25 bg-sky-300/5 p-3">
                        <input type="hidden" name="id" value={ticket.id} />
                        <textarea
                          name="reopenNotes"
                          className={textareaClass}
                          placeholder="Motivo da reabertura do ticket"
                        />
                        <button className="mt-2 inline-flex h-10 items-center justify-center rounded-lg border border-sky-300/40 bg-sky-300/10 px-3 text-sm font-semibold text-sky-100">
                          Reabrir ticket
                        </button>
                      </form>
                    )}

                    {canManageTickets ? (
                      <form action={deleteMaintenanceTicket}>
                        <input type="hidden" name="id" value={ticket.id} />
                        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-300/35 bg-red-300/10 px-3 text-sm font-semibold text-red-100">
                          <Trash2 size={15} />
                          Eliminar ticket
                        </button>
                      </form>
                    ) : null}
                  </div>

                  {ticket.status === "OPEN" ? (
                    <form action={completeMaintenanceTicket} className="mt-4 grid gap-3 rounded-lg border border-teal-300/25 bg-teal-300/5 p-3">
                      <input type="hidden" name="id" value={ticket.id} />
                      <p className="text-sm font-semibold text-teal-100">Concluir ticket aberto/reaberto</p>
                      <textarea
                        name="solution"
                        className={textareaClass}
                        defaultValue={ticket.solution ?? ""}
                        placeholder="Solução aplicada / descrição do trabalho"
                      />
                      <textarea
                        name="observations"
                        className={textareaClass}
                        defaultValue={ticket.observations ?? ""}
                        placeholder="Observações internas da OP"
                      />
                      <TicketConsumables consumables={data.consumables} initialUsages={ticket.consumables} />
                      <button className={`${buttonClass} w-fit`}>
                        <CheckCircle2 size={17} />
                        Guardar / concluir trabalho
                      </button>
                    </form>
                  ) : null}

                  {canManageTickets ? (
                    <details className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-zinc-100">
                        Corrigir datas, tempos e custos
                      </summary>
                      <form action={updateMaintenanceTicketTiming} className="mt-4 space-y-3">
                        <input type="hidden" name="id" value={ticket.id} />
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="space-y-2">
                            <span className="text-xs font-medium text-zinc-400">Aberto em</span>
                            <input type="datetime-local" name="openedAt" className={inputClass} defaultValue={dateTimeInputValue(ticket.openedAt)} />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs font-medium text-zinc-400">Iniciado em</span>
                            <input type="datetime-local" name="startedAt" className={inputClass} defaultValue={dateTimeInputValue(ticket.startedAt)} />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs font-medium text-zinc-400">Pausado em</span>
                            <input type="datetime-local" name="pausedAt" className={inputClass} defaultValue={dateTimeInputValue(ticket.pausedAt)} />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs font-medium text-zinc-400">Concluido em</span>
                            <input type="datetime-local" name="completedAt" className={inputClass} defaultValue={dateTimeInputValue(ticket.completedAt)} />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs font-medium text-zinc-400">Validado em</span>
                            <input type="datetime-local" name="validatedAt" className={inputClass} defaultValue={dateTimeInputValue(ticket.validatedAt)} />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs font-medium text-zinc-400">Custo mao de obra EUR/h</span>
                            <input name="hourlyRate" className={inputClass} placeholder="Vazio usa responsavel/utilizador atual" />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="space-y-2">
                              <span className="text-xs font-medium text-zinc-400">Horas trabalho</span>
                              <input type="number" min="0" name="workHours" className={inputClass} defaultValue={durationParts(workTimeSeconds(ticket)).hours} />
                            </label>
                            <label className="space-y-2">
                              <span className="text-xs font-medium text-zinc-400">Min. trabalho</span>
                              <input type="number" min="0" max="59" name="workMinutes" className={inputClass} defaultValue={durationParts(workTimeSeconds(ticket)).minutes} />
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="space-y-2">
                              <span className="text-xs font-medium text-zinc-400">Horas paragem</span>
                              <input type="number" min="0" name="downtimeHours" className={inputClass} defaultValue={durationParts(downtimeSecondsValue(ticket)).hours} disabled={!ticket.machineStopped} />
                            </label>
                            <label className="space-y-2">
                              <span className="text-xs font-medium text-zinc-400">Min. paragem</span>
                              <input type="number" min="0" max="59" name="downtimeMinutes" className={inputClass} defaultValue={durationParts(downtimeSecondsValue(ticket)).minutes} disabled={!ticket.machineStopped} />
                            </label>
                          </div>
                        </div>
                        <textarea
                          name="correctionNotes"
                          className={textareaClass}
                          placeholder="Motivo da correcao: ticket ficou aberto, tempo validado por..."
                        />
                        <button className="inline-flex h-10 items-center justify-center rounded-lg border border-sky-300/40 bg-sky-300/10 px-3 text-sm font-semibold text-sky-100">
                          Guardar correcao
                        </button>
                      </form>
                    </details>
                  ) : null}

                  {ticket.status === "SUSPENDED" ? (
                    <div className="mt-4 rounded-lg border border-orange-300/25 bg-orange-300/10 p-3">
                      <p className="text-sm font-semibold text-orange-100">Ticket suspenso</p>
                      <p className="mt-2 whitespace-pre-line text-sm text-zinc-300">{ticket.observations ?? "Sem observações."}</p>
                    </div>
                  ) : null}

                  {(["IN_PROGRESS", "PAUSED", "DONE"].includes(ticket.status)) && (
                    <form action={completeMaintenanceTicket} className="mt-4 grid gap-3">
                      <input type="hidden" name="id" value={ticket.id} />

                      <textarea
                        name="solution"
                        className={textareaClass}
                        defaultValue={ticket.solution ?? ""}
                        placeholder="Solução aplicada / descrição do trabalho"
                      />

                      <textarea
                        name="observations"
                        className={textareaClass}
                        defaultValue={ticket.observations ?? ""}
                        placeholder="Observações internas da OP"
                      />

                      <TicketConsumables consumables={data.consumables} initialUsages={ticket.consumables} />

                      <div className="grid gap-2 rounded-lg border border-zinc-800 bg-zinc-950/55 p-3 text-sm text-zinc-400 md:grid-cols-3">
                        <p>
                          Paragem: <strong className="text-amber-100">{downtime(ticket)}</strong>
                        </p>
                        <p>
                          Maquina parada: <strong className="text-zinc-100">{ticket.machineStopped ? "Sim" : "Nao"}</strong>
                        </p>
                        <p>
                          Trabalho: <strong className="text-zinc-100">{workTime(ticket)}</strong>
                        </p>
                        <p>
                          Mão de obra: <strong className="text-zinc-100">{formatCurrency(ticket.laborCost)}</strong>
                        </p>
                        <p>
                          Consumíveis: <strong className="text-zinc-100">{formatCurrency(ticket.consumableCost)}</strong>
                        </p>
                        <p>
                          Total OP: <strong className="text-amber-200">{formatCurrency(ticket.totalCost)}</strong>
                        </p>
                      </div>

                      <button className={`${buttonClass} w-fit`}>
                        <CheckCircle2 size={17} />
                        Guardar / concluir trabalho
                      </button>

                      {ticket.status === "DONE" ? (
                        <button
                          formAction={validateMaintenanceTicket}
                          className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-lg bg-teal-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-teal-200"
                        >
                          Validar e criar OP
                        </button>
                      ) : null}
                    </form>
                  )}
                </details>
              ))
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
