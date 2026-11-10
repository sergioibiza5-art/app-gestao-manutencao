import type { WorkOrder } from "@prisma/client";
import { cancelWorkOrderOpening, pauseWorkOrder, reopenWorkOrder, startWorkOrder, suspendWorkOrder, updateWorkOrderTiming, validateWorkOrder } from "@/app/actions";
import { inputClass, textareaClass } from "@/app/components/ui";
import { formatLisbonDateTimeInput } from "@/lib/lisbon-time";

export function WorkOrderControls({ workOrder, canManage, ticketLinked = false }: { workOrder: WorkOrder; canManage: boolean; ticketLinked?: boolean }) {
  const workOrderDurationHours = Math.floor(Math.max(workOrder.totalWorkSeconds, 0) / 3600);
  const workOrderDurationMinutes = Math.floor((Math.max(workOrder.totalWorkSeconds, 0) % 3600) / 60);
  return <>
    {!ticketLinked && <div className="mt-4 flex flex-wrap gap-2">
      {(workOrder.status === "OPEN" || workOrder.status === "PAUSED" || workOrder.status === "SUSPENDED") && (
        <form action={startWorkOrder}>
          <input type="hidden" name="workOrderId" value={workOrder.id} />
          <input type="hidden" name="scheduleId" value={workOrder.scheduleId ?? ""} />
          <button className="inline-flex h-10 items-center justify-center rounded-lg border border-teal-300/40 bg-teal-300/10 px-3 text-sm font-semibold text-teal-100">
            {workOrder.status === "SUSPENDED" || workOrder.status === "PAUSED" ? "Retomar" : "Iniciar"}
          </button>
        </form>
      )}
      {workOrder.status === "IN_PROGRESS" && (
        <form action={pauseWorkOrder}>
          <input type="hidden" name="workOrderId" value={workOrder.id} />
          <input type="hidden" name="scheduleId" value={workOrder.scheduleId ?? ""} />
          <button className="inline-flex h-10 items-center justify-center rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 text-sm font-semibold text-amber-100">
            Pausar
          </button>
        </form>
      )}
      {["OPEN", "IN_PROGRESS", "PAUSED"].includes(workOrder.status) && (
        <form action={suspendWorkOrder} className="w-full rounded-lg border border-amber-300/25 bg-amber-300/5 p-3">
          <input type="hidden" name="workOrderId" value={workOrder.id} />
          <input type="hidden" name="scheduleId" value={workOrder.scheduleId ?? ""} />
          <textarea
            name="suspensionNotes"
            className={textareaClass}
            placeholder="Observações da suspensão: falta de peças, sem solução definida, aguarda fornecedor..."
          />
          <button className="mt-2 inline-flex h-10 items-center justify-center rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 text-sm font-semibold text-amber-100">
            Suspender OP
          </button>
        </form>
      )}
      {canManage && workOrder.status === "DONE" && (
        <form action={validateWorkOrder}>
          <input type="hidden" name="workOrderId" value={workOrder.id} />
          <input type="hidden" name="scheduleId" value={workOrder.scheduleId ?? ""} />
          <button className="inline-flex h-10 items-center justify-center rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-3 text-sm font-semibold text-emerald-100">
            Validar
          </button>
        </form>
      )}
      {(workOrder.status === "DONE" || workOrder.status === "VALIDATED") && (
        <form action={reopenWorkOrder} className="w-full rounded-lg border border-sky-300/25 bg-sky-300/5 p-3">
          <input type="hidden" name="workOrderId" value={workOrder.id} />
          <input type="hidden" name="scheduleId" value={workOrder.scheduleId ?? ""} />
          <textarea
            name="reopenNotes"
            className={textareaClass}
            placeholder="Motivo da reabertura da OP"
          />
          <button className="mt-2 inline-flex h-10 items-center justify-center rounded-lg border border-sky-300/40 bg-sky-300/10 px-3 text-sm font-semibold text-sky-100">
            Reabrir OP
          </button>
        </form>
      )}
      {["OPEN", "IN_PROGRESS", "PAUSED", "SUSPENDED"].includes(workOrder.status) && (
        <form action={cancelWorkOrderOpening} className="w-full rounded-lg border border-rose-300/25 bg-rose-300/5 p-3">
          <p className="text-sm font-semibold text-rose-100">OP aberta por engano?</p>
          <p className="mt-1 text-xs text-zinc-400">
            Cancela esta abertura e volta a deixar a manutenção disponível para criar uma OP correta.
          </p>
          <input type="hidden" name="workOrderId" value={workOrder.id} />
          <input type="hidden" name="scheduleId" value={workOrder.scheduleId ?? ""} />
          <textarea
            name="cancelNotes"
            className={`${textareaClass} mt-3`}
            placeholder="Motivo do cancelamento da abertura"
          />
          <button className="mt-2 inline-flex h-10 items-center justify-center rounded-lg border border-rose-300/40 bg-rose-300/10 px-3 text-sm font-semibold text-rose-100">
            Cancelar abertura da OP
          </button>
        </form>
      )}
    </div>}
    {canManage && <details className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-100">
        Corrigir datas e duração da OP
      </summary>
      <form action={updateWorkOrderTiming} className="mt-4 space-y-3">
        <input type="hidden" name="workOrderId" value={workOrder.id} />
        <input type="hidden" name="scheduleId" value={workOrder.scheduleId ?? ""} />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-medium text-zinc-400">Aberta em</span>
            <input type="datetime-local" name="openedAt" className={inputClass} defaultValue={formatLisbonDateTimeInput(workOrder.openedAt)} />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-medium text-zinc-400">Iniciada em</span>
            <input type="datetime-local" name="startedAt" className={inputClass} defaultValue={formatLisbonDateTimeInput(workOrder.startedAt)} />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-medium text-zinc-400">Pausada em</span>
            <input type="datetime-local" name="pausedAt" className={inputClass} defaultValue={formatLisbonDateTimeInput(workOrder.pausedAt)} />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-medium text-zinc-400">Fechada em</span>
            <input type="datetime-local" name="closedAt" className={inputClass} defaultValue={formatLisbonDateTimeInput(workOrder.closedAt)} />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-medium text-zinc-400">Validada em</span>
            <input type="datetime-local" name="validatedAt" className={inputClass} defaultValue={formatLisbonDateTimeInput(workOrder.validatedAt)} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-2">
              <span className="text-xs font-medium text-zinc-400">Horas</span>
              <input type="number" min="0" name="durationHours" className={inputClass} defaultValue={workOrderDurationHours} />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium text-zinc-400">Minutos</span>
              <input type="number" min="0" max="59" name="durationMinutes" className={inputClass} defaultValue={workOrderDurationMinutes} />
            </label>
          </div>
          <label className="space-y-2 md:col-span-2">
            <span className="text-xs font-medium text-zinc-400">Custo mão de obra EUR/h</span>
            <input
              name="hourlyRate"
              className={inputClass}
              placeholder="Vazio usa o custo/hora do utilizador que corrige"
            />
          </label>
        </div>
        <textarea
          name="correctionNotes"
          className={textareaClass}
          placeholder="Motivo da correção: OP ficou esquecida aberta, ajuste validado por..."
        />
        <button className="inline-flex h-10 items-center justify-center rounded-lg border border-sky-300/40 bg-sky-300/10 px-3 text-sm font-semibold text-sky-100">
          Guardar correção
        </button>
      </form>
    </details>}
  </>;
}
