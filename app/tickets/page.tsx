import { CheckCircle2, Pause, Play, Siren, Wrench } from "lucide-react";

import {
  completeMaintenanceTicket,
  createMaintenanceTicket,
  pauseMaintenanceTicket,
  startMaintenanceTicket,
  validateMaintenanceTicket,
} from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { requireUser } from "@/lib/auth";
import { getTicketsData } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: "Aberto",
    IN_PROGRESS: "Em curso",
    PAUSED: "Pausado",
    DONE: "Concluido",
    VALIDATED: "Validado",
    CANCELED: "Cancelado",
  };
  return labels[status] ?? status;
}

function hours(value: number) {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);
}

function TicketCreateForm({ equipment, compact = false }: { equipment: Array<{ id: string; name: string; code: string | null; location: string | null }>; compact?: boolean }) {
  return (
    <form action={createMaintenanceTicket} className={compact ? "grid gap-3" : "mt-4 grid gap-3"}>
      <select name="equipmentId" required className={inputClass}>
        <option value="">Selecionar maquina/equipamento</option>
        {equipment.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}{item.code ? ` - ${item.code}` : ""}
          </option>
        ))}
      </select>
      <input name="title" className={inputClass} placeholder="Titulo curto do problema" />
      <select name="priority" className={inputClass} defaultValue="NORMAL">
        <option value="LOW">Baixa</option>
        <option value="NORMAL">Normal</option>
        <option value="HIGH">Alta</option>
        <option value="CRITICAL">Critica</option>
      </select>
      <input name="location" className={inputClass} placeholder="Posto/localizacao" />
      <textarea name="problem" required className={textareaClass} placeholder="Descreve o problema da maquina" />
      <button className={buttonClass}>
        <Siren size={17} />
        Criar ticket
      </button>
    </form>
  );
}

export default async function TicketsPage() {
  const user = await requireUser();
  const data = await getTicketsData();
  const isTicketOnly = user.role === "TICKET";

  if (isTicketOnly) {
    return (
      <AppShell activeHref="/tickets">
        <section className="mx-auto w-full max-w-2xl">
          <Panel>
            <div className="flex items-center gap-3">
              <Siren size={24} className="text-red-300" />
              <div>
                <p className="text-sm text-zinc-500">Posto de trabalho</p>
                <h1 className="text-2xl font-semibold text-zinc-50">Chamar manutencao</h1>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Seleciona a maquina e descreve o problema. A manutencao recebe o ticket para iniciar a reparacao.
            </p>
            <TicketCreateForm equipment={data.equipment} />
          </Panel>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell activeHref="/tickets">
      <PageHeader
        eyebrow="Tickets"
        title="Avarias e chamados de manutencao"
        description="Regista avarias por posto, acompanha tempos de reparacao, consumiveis usados, solucoes e OP geradas."
      />

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Abertos", data.kpis.open, "text-red-300"],
          ["Em curso/pausados", data.kpis.inProgress, "text-cyan-300"],
          ["Por validar", data.kpis.waitingValidation, "text-amber-300"],
          ["MTTR horas", hours(data.kpis.averageRepairHours), "text-teal-300"],
        ].map(([label, value, tone]) => (
          <Panel key={label}>
            <p className="text-sm text-zinc-500">{label}</p>
            <p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p>
          </Panel>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.65fr_1.35fr]">
        <div className="space-y-4">
          <Panel>
            <div className="flex items-center gap-3">
              <Siren size={22} className="text-red-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Novo ticket manual</h2>
            </div>
            <TicketCreateForm equipment={data.equipment} />
          </Panel>

          <Panel>
            <h2 className="text-xl font-semibold text-zinc-50">Problemas recorrentes</h2>
            <div className="mt-4 space-y-2">
              {data.kpis.repeatedProblems.length === 0 ? (
                <EmptyState title="Sem dados" description="Ainda nao existem tickets suficientes." />
              ) : (
                data.kpis.repeatedProblems.map((item) => (
                  <div key={item.name} className="flex justify-between rounded-lg border border-zinc-800 bg-zinc-950/55 p-3 text-sm">
                    <span className="text-zinc-300">{item.name}</span>
                    <strong className="text-red-200">{item.count}</strong>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-xl font-semibold text-zinc-50">Equipamentos com mais tickets</h2>
            <div className="mt-4 space-y-2">
              {data.kpis.byEquipment.length === 0 ? (
                <EmptyState title="Sem dados" description="A contagem aparece quando existirem tickets." />
              ) : (
                data.kpis.byEquipment.map((item) => (
                  <div key={item.name} className="flex justify-between rounded-lg border border-zinc-800 bg-zinc-950/55 p-3 text-sm">
                    <span className="text-zinc-300">{item.name}</span>
                    <strong className="text-cyan-200">{item.count}</strong>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        <Panel>
          <div className="flex items-center gap-3">
            <Wrench size={22} className="text-cyan-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Fila de manutencao</h2>
          </div>
          <div className="mt-4 space-y-3">
            {data.tickets.length === 0 ? (
              <EmptyState title="Sem tickets" description="Quando um posto chamar a manutencao, o ticket aparece aqui." />
            ) : (
              data.tickets.map((ticket) => (
                <article key={ticket.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{ticket.number} - {statusLabel(ticket.status)}</p>
                      <h3 className="mt-1 text-lg font-semibold text-zinc-100">{ticket.title}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{ticket.equipment.name} - {ticket.location ?? ticket.equipment.location ?? "sem local"}</p>
                      <p className="mt-3 text-sm leading-6 text-zinc-400">{ticket.problem}</p>
                    </div>
                    <div className="text-sm text-zinc-500 xl:text-right">
                      <p>Aberto: {formatDate(ticket.openedAt)}</p>
                      <p>Por: {ticket.openedBy?.name ?? "Sistema"}</p>
                      {ticket.workOrder && <p className="mt-2 font-semibold text-teal-300">{ticket.workOrder.number}</p>}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <form action={startMaintenanceTicket}>
                      <input type="hidden" name="id" value={ticket.id} />
                      <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-300/35 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-100">
                        <Play size={15} />
                        Iniciar
                      </button>
                    </form>
                    <form action={pauseMaintenanceTicket}>
                      <input type="hidden" name="id" value={ticket.id} />
                      <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-300/35 bg-amber-300/10 px-3 text-sm font-semibold text-amber-100">
                        <Pause size={15} />
                        Pausar
                      </button>
                    </form>
                  </div>

                  <form action={completeMaintenanceTicket} className="mt-4 grid gap-3">
                    <input type="hidden" name="id" value={ticket.id} />
                    <textarea name="solution" className={textareaClass} defaultValue={ticket.solution ?? ""} placeholder="Solucao aplicada / descricao do trabalho" />
                    <div className="grid gap-2 md:grid-cols-[1fr_130px]">
                      {[0, 1, 2].map((index) => (
                        <div key={index} className="contents">
                          <select name="consumableId" className={inputClass} defaultValue={ticket.consumables[index]?.consumableId ?? ""}>
                            <option value="">Consumivel usado</option>
                            {data.consumables.map((item) => (
                              <option key={item.id} value={item.id}>{item.name} ({String(item.currentStock)} {item.unit})</option>
                            ))}
                          </select>
                          <input name="quantity" className={inputClass} defaultValue={ticket.consumables[index] ? String(ticket.consumables[index].quantity) : ""} placeholder="Qtd." />
                        </div>
                      ))}
                    </div>
                    <button className={`${buttonClass} w-fit`}>
                      <CheckCircle2 size={17} />
                      Concluir trabalho
                    </button>
                  </form>

                  {ticket.status === "DONE" && (
                    <form action={validateMaintenanceTicket} className="mt-3">
                      <input type="hidden" name="id" value={ticket.id} />
                      <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-teal-200">
                        Validar e criar OP
                      </button>
                    </form>
                  )}
                </article>
              ))
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
