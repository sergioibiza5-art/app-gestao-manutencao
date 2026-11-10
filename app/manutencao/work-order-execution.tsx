import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { completeWorkOrder } from "@/app/actions";
import { buttonClass, inputClass, Panel, textareaClass } from "@/app/components/ui";
import { TicketConsumables } from "@/app/tickets/ticket-consumables";
import { contentPerPack, consumptionLabel, consumptionUnit } from "@/lib/stock-units";
import { formatCurrency } from "@/lib/format";
import type { getMaintenanceScheduleDetail } from "@/lib/data";

type Schedule = NonNullable<Awaited<ReturnType<typeof getMaintenanceScheduleDetail>>>;
type Props = { workOrder: Schedule["workOrder"]; equipmentId: string; template?: NonNullable<Schedule["workOrder"]>["template"]; consumableOptions: Schedule["consumableOptions"] };

function durationLabel(seconds: number) {
  const safeSeconds = Math.max(seconds, 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function WorkOrderExecution({ workOrder, equipmentId, template, consumableOptions }: Props) {
  const canFillChecklist = workOrder && ["OPEN", "IN_PROGRESS", "PAUSED"].includes(workOrder.status) && template;
  const canCompleteWorkOrder = workOrder && ["OPEN", "IN_PROGRESS", "PAUSED"].includes(workOrder.status);
  const checklistResponsesByItem = new Map(
    workOrder?.checklistRecord?.responses.map((response) => [response.itemId, response]) ?? [],
  );
  const workOrderConsumables = workOrder?.consumableMovements.filter((movement) => movement.type === "SAIDA_OP") ?? [];

  return (
        <Panel>
          <div className="flex items-center gap-3">
            <ClipboardCheck size={22} className="text-teal-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Execução</h2>
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
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
                    <dt className="text-xs text-zinc-500">{label}</dt>
                    <dd className="mt-1 whitespace-pre-line text-sm font-medium text-zinc-100">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-4">
                <h3 className="font-semibold text-zinc-100">Documentos e evidências da OP</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {workOrder.checklistRecord ? (
                    <Link
                      href={`/equipamentos/${equipmentId}/checklist-interna/${workOrder.checklistRecord.id}`}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-teal-300/35 bg-teal-300/10 px-3 text-sm font-semibold text-teal-100 transition hover:border-teal-200"
                    >
                      <ClipboardCheck size={16} />
                      Ver checklist preenchida
                    </Link>
                  ) : (
                    <span className="rounded-lg border border-dashed border-zinc-800 px-3 py-2 text-sm text-zinc-500">
                      Sem checklist preenchida associada a esta OP.
                    </span>
                  )}
                </div>
              </div>
              {workOrder.documents.length > 0 && (
                <div className="space-y-2">
                  {workOrder.documents.map((document) => (
                    <a key={document.id} href={document.fileUrl ?? "#"} target="_blank" rel="noreferrer" className="block rounded-lg border border-zinc-800 bg-zinc-950/55 p-3 transition hover:border-sky-300/45">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Pasta do equipamento</span>
                      <span className="mt-1 block text-sm font-semibold text-sky-200">{document.title}</span>
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
                            {consumptionUnit(movement.consumable) === "STOCK" ? `${String(movement.quantity)} ${movement.consumable.unit}` : `${Number((Number(movement.quantity) * contentPerPack(movement.consumable)).toFixed(4))} ${consumptionLabel(movement.consumable)}`} - {movement.user?.name ?? "Sem utilizador"}
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
          ) : workOrder?.status === "SUSPENDED" ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
                OP suspensa. Retoma a OP para voltar a contar tempo de trabalho e concluir a execução.
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
                <p className="text-xs text-zinc-500">Notas e observações</p>
                <p className="mt-2 whitespace-pre-line text-sm text-zinc-100">{workOrder.notes ?? "Sem notas"}</p>
              </div>
            </div>
          ) : canFillChecklist ? (
            <form action={completeWorkOrder} className="mt-4 space-y-4">
              <input type="hidden" name="workOrderId" value={workOrder.id} />
              <input type="hidden" name="equipmentId" value={equipmentId} />
              <input type="hidden" name="templateId" value={template.id} />
              <input type="hidden" name="scheduleId" value={workOrder.scheduleId ?? ""} />
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
                <TicketConsumables consumables={consumableOptions} />
              </div>
              <div className="space-y-2">
                {template.items.map((item) => {
                  const response = checklistResponsesByItem.get(item.id);
                  const photo = response?.photos[0];

                  return (
                  <div key={item.id} className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950/55 p-3 md:grid-cols-[1fr_150px_1fr]">
                    <input type="hidden" name="itemId" value={item.id} />
                    <div>
                      <p className="font-medium text-zinc-100">{item.order}. {item.check}</p>
                      <p className="mt-1 text-xs text-zinc-500">{item.expectedCondition}{item.photoRequired ? " - foto" : ""}</p>
                    </div>
                    <select name={`status_${item.id}`} className={inputClass} defaultValue={response?.status ?? "OK"}>
                      <option value="OK">OK</option>
                      <option value="NOT_OK">Não OK</option>
                      <option value="NA">N/A</option>
                    </select>
                    <input name={`obs_${item.id}`} className={inputClass} placeholder="Obs." defaultValue={response?.obs ?? ""} />
                    {item.photoRequired ? (
                      <div className="rounded-lg border border-zinc-800 bg-black/20 p-2 md:col-span-3">
                        <input name={`photoUrl_${item.id}`} className={inputClass} placeholder="Foto obrigatoria - link/caminho" defaultValue={photo?.fileUrl ?? ""} />
                      </div>
                    ) : null}
                  </div>
                  );
                })}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input name="documentUrl" className={inputClass} placeholder="Link/caminho do documento associado" />
                <input name="extraDocumentUrl" className={inputClass} placeholder="Link/caminho adicional" />
                <textarea name="documentNotes" className={`${textareaClass} md:col-span-2`} placeholder="Obs." />
              </div>
              <textarea name="notes" className={textareaClass} placeholder="Notas finais" />
              <button className={buttonClass}>Concluído</button>
            </form>
          ) : canCompleteWorkOrder ? (
            <form action={completeWorkOrder} className="mt-4 space-y-4">
              <input type="hidden" name="workOrderId" value={workOrder.id} />
              <input type="hidden" name="equipmentId" value={equipmentId} />
              <input type="hidden" name="scheduleId" value={workOrder.scheduleId ?? ""} />
              {workOrder.status !== "IN_PROGRESS" && (
                <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
                  A OP não está em curso. Podes concluir, mas se houve trabalho adicional retoma primeiro para o tempo ficar contado.
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <select name="result" className={inputClass} defaultValue="Aprovado">
                  <option value="Aprovado">Aprovado</option>
                  <option value="Reprovado">Reprovado</option>
                  <option value="Em observações">Em observações</option>
                </select>
                <input name="documentUrl" className={inputClass} placeholder="Link/caminho do documento associado" />
              </div>
              <textarea name="actionsDone" className={textareaClass} placeholder="O que foi feito" />
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
                <h3 className="mb-3 font-semibold text-zinc-100">Consumiveis utilizados</h3>
                <TicketConsumables consumables={consumableOptions} />
              </div>
              <input name="extraDocumentUrl" className={inputClass} placeholder="Link/caminho adicional" />
              <textarea name="documentNotes" className={textareaClass} placeholder="Obs. dos documentos" />
              <textarea name="notes" className={textareaClass} placeholder="Notas finais" />
              <button className={buttonClass}>Concluir OP</button>
            </form>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/45 p-4 text-sm text-zinc-500">
              Cria a OP para abrir o documento de execução. Se o equipamento tiver checklist associada, ela aparece aqui.
            </p>
          )}
        </Panel>
  );
}
