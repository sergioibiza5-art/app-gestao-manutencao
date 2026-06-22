import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, FileCheck2, Wrench } from "lucide-react";

import { completeWorkOrder, createWorkOrderFromSchedule, pauseWorkOrder, startWorkOrder, validateWorkOrder } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { TicketConsumables } from "@/app/tickets/ticket-consumables";
import { getMaintenanceScheduleDetail } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type MaintenanceSchedulePageProps = {
  params: Promise<{ id: string }>;
};

function typeLabel(type: string) {
  return type === "EXTERNAL" ? "Externa" : "Interna";
}

function scheduleStatusLabel(status: string) {
  const labels: Record<string, string> = {
    SCHEDULED: "Agendada",
    DONE: "Concluída",
    CANCELED: "Cancelada",
  };
  return labels[status] ?? status;
}

function workOrderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: "Aberta",
    IN_PROGRESS: "Em curso",
    PAUSED: "Pausada",
    DONE: "Concluída",
    VALIDATED: "Validada",
    CANCELED: "Cancelada",
  };
  return labels[status] ?? status;
}

function durationLabel(seconds: number) {
  const safeSeconds = Math.max(seconds, 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export default async function MaintenanceSchedulePage({ params }: MaintenanceSchedulePageProps) {
  const { id } = await params;
  const schedule = await getMaintenanceScheduleDetail(id);

  if (!schedule) {
    notFound();
  }

  const workOrder = schedule.workOrder;
  const template = workOrder?.template ?? schedule.equipment.equipmentType?.checklistTemplates[0];
  const canFillChecklist = workOrder && ["OPEN", "IN_PROGRESS", "PAUSED"].includes(workOrder.status) && template;
  const workOrderConsumables = workOrder?.consumableMovements.filter((movement) => movement.type === "SAIDA_OP") ?? [];
  const workOrderConsumableCost = workOrderConsumables.reduce(
    (sum, movement) => sum + Number(movement.quantity ?? 0) * Number(movement.consumable.unitCost ?? 0),
    0,
  );

  return (
    <AppShell activeHref="/manutencao">
      <PageHeader
        eyebrow="Agendamento"
        title={schedule.title}
        description={`${schedule.equipment.name} - ${typeLabel(schedule.type)} - ${formatDate(schedule.scheduledAt)} - ${scheduleStatusLabel(schedule.status)}`}
        action={
          <Link href="/manutencao" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50">
            <ArrowLeft size={17} />
            Manutencao
          </Link>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel>
          <div className="flex items-center gap-3">
            <Wrench size={22} className="text-cyan-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Ordem de servico</h2>
          </div>
          {workOrder ? (
            <>
              <dl className="mt-4 grid gap-3">
                {[
                  ["Número", workOrder.number],
                  ["Estado", workOrderStatusLabel(workOrder.status)],
                  ["Aberta em", formatDate(workOrder.openedAt)],
                  ["Iniciada em", formatDate(workOrder.startedAt)],
                  ["Tempo registado", durationLabel(workOrder.totalWorkSeconds)],
                  ["Custo consumiveis", formatCurrency(workOrderConsumableCost)],
                  ["Custo total", workOrder.maintenanceLog?.cost ? formatCurrency(workOrder.maintenanceLog.cost) : "Sem custo fechado"],
                  ["Fechada em", formatDate(workOrder.closedAt)],
                  ["Validada em", formatDate(workOrder.validatedAt)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                    <dt className="text-xs text-zinc-500">{label}</dt>
                    <dd className="mt-1 text-sm font-medium text-zinc-100">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {(workOrder.status === "OPEN" || workOrder.status === "PAUSED") && (
                  <form action={startWorkOrder}>
                    <input type="hidden" name="workOrderId" value={workOrder.id} />
                    <input type="hidden" name="scheduleId" value={schedule.id} />
                    <button className="inline-flex h-10 items-center justify-center rounded-lg border border-teal-300/40 bg-teal-300/10 px-3 text-sm font-semibold text-teal-100">
                      Iniciar
                    </button>
                  </form>
                )}
                {workOrder.status === "IN_PROGRESS" && (
                  <form action={pauseWorkOrder}>
                    <input type="hidden" name="workOrderId" value={workOrder.id} />
                    <input type="hidden" name="scheduleId" value={schedule.id} />
                    <button className="inline-flex h-10 items-center justify-center rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 text-sm font-semibold text-amber-100">
                      Pausar
                    </button>
                  </form>
                )}
                {workOrder.status === "DONE" && (
                  <form action={validateWorkOrder}>
                    <input type="hidden" name="workOrderId" value={workOrder.id} />
                    <input type="hidden" name="scheduleId" value={schedule.id} />
                    <button className="inline-flex h-10 items-center justify-center rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-3 text-sm font-semibold text-emerald-100">
                      Validar
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <form action={createWorkOrderFromSchedule} className="mt-4">
              <input type="hidden" name="scheduleId" value={schedule.id} />
              <button className={buttonClass}>
                <FileCheck2 size={17} />
                Criar OP
              </button>
            </form>
          )}
        </Panel>

        <Panel>
          <div className="flex items-center gap-3">
            <ClipboardCheck size={22} className="text-teal-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Execucao</h2>
          </div>
          {workOrder?.status === "DONE" || workOrder?.status === "VALIDATED" ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-teal-300/25 bg-teal-300/10 p-4 text-sm text-teal-100">
                OP {workOrder.status === "VALIDATED" ? "validada" : "concluída"}. O histórico, os documentos e a checklist ficaram associados ao equipamento.
              </div>
              <dl className="grid gap-3 md:grid-cols-2">
                {[
                  ["Tempo do serviço", durationLabel(workOrder.totalWorkSeconds)],
                  ["Feito por", workOrder.performedBy ?? "Sem responsável"],
                  ["Resultado", workOrder.result ?? "Sem resultado"],
                  ["O que foi feito", workOrder.actionsDone ?? "Sem descrição"],
                  ["Notas", workOrder.notes ?? "Sem notas"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
                    <dt className="text-xs text-zinc-500">{label}</dt>
                    <dd className="mt-1 whitespace-pre-line text-sm font-medium text-zinc-100">{value}</dd>
                  </div>
                ))}
              </dl>
              {workOrder.documents.length > 0 && (
                <div className="space-y-2">
                  {workOrder.documents.map((document) => (
                    <a key={document.id} href={document.fileUrl ?? "#"} target="_blank" rel="noreferrer" className="block rounded-lg border border-zinc-800 bg-zinc-950/55 p-3 text-sm font-semibold text-sky-200">
                      {document.title}
                    </a>
                  ))}
                </div>
              )}
              {workOrderConsumables.length > 0 && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-4">
                  <h3 className="font-semibold text-zinc-100">Consumiveis utilizados</h3>
                  <div className="mt-3 space-y-2">
                    {workOrderConsumables.map((movement) => (
                      <div key={movement.id} className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-black/20 p-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-zinc-100">{movement.consumable.name}</p>
                          <p className="text-xs text-zinc-500">
                            {String(movement.quantity)} {movement.consumable.unit} · {movement.user?.name ?? "Sem utilizador"}
                          </p>
                          {movement.reason ? <p className="mt-1 text-xs text-zinc-500">{movement.reason}</p> : null}
                        </div>
                        <p className="font-semibold text-amber-300">
                          {formatCurrency(Number(movement.quantity ?? 0) * Number(movement.consumable.unitCost ?? 0))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : canFillChecklist ? (
            <form action={completeWorkOrder} className="mt-4 space-y-4">
              <input type="hidden" name="workOrderId" value={workOrder.id} />
              <input type="hidden" name="equipmentId" value={schedule.equipmentId} />
              <input type="hidden" name="templateId" value={template.id} />
              <input type="hidden" name="scheduleId" value={schedule.id} />
              {workOrder.status !== "IN_PROGRESS" && (
                <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
                  Inicia a OP antes de concluir para o tempo ficar contado corretamente.
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
  <select name="result" className={inputClass} defaultValue="Aprovado">
    <option value="Aprovado">Aprovado</option>
    <option value="Reprovado">Reprovado</option>
    <option value="Em observações">Em observações</option>
  </select>
</div>

<textarea name="actionsDone" className={textareaClass} placeholder="O que foi feito" />
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
                <h3 className="mb-3 font-semibold text-zinc-100">Consumiveis utilizados</h3>
                <TicketConsumables consumables={schedule.consumableOptions} />
              </div>
              <div className="space-y-2">
                {template.items.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950/55 p-3 md:grid-cols-[1fr_150px_1fr]">
                    <input type="hidden" name="itemId" value={item.id} />
                    <div>
                      <p className="font-medium text-zinc-100">{item.order}. {item.check}</p>
                      <p className="mt-1 text-xs text-zinc-500">{item.expectedCondition}{item.photoRequired ? " - foto" : ""}</p>
                    </div>
                    <select name={`status_${item.id}`} className={inputClass}>
                      <option value="OK">OK</option>
                      <option value="NOT_OK">Não OK</option>
                      <option value="NA">N/A</option>
                    </select>
                    <input name={`obs_${item.id}`} className={inputClass} placeholder="Obs." />
                    <div className="grid gap-2 rounded-lg border border-zinc-800 bg-black/20 p-2 md:col-span-3 md:grid-cols-[1fr_220px]">
                      <input name={`photoUrl_${item.id}`} className={inputClass} placeholder={item.photoRequired ? "Foto obrigatoria - link/caminho" : "Foto - link/caminho"} />
                      <input name={`photoName_${item.id}`} className={inputClass} placeholder="Nome da foto" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input name="documentTitle" className={inputClass} placeholder="Titulo do documento da OP" />
                <input name="documentName" className={inputClass} placeholder="Nome do ficheiro" />
                <input name="documentUrl" className={`${inputClass} md:col-span-2`} placeholder="Link/caminho do documento associado" />
              </div>
              <textarea name="notes" className={textareaClass} placeholder="Notas finais" />
              <button className={buttonClass}>Concluído</button>
            </form>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/45 p-4 text-sm text-zinc-500">
              Cria a OP para abrir o documento de execucao. Se o equipamento tiver checklist associada, ela aparece aqui.
            </p>
          )}
        </Panel>
      </section>
    </AppShell>
  );
}
