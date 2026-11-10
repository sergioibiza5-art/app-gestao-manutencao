import { WorkOrderExecution } from "../work-order-execution";
﻿import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileCheck2, Wrench } from "lucide-react";

import { createWorkOrderFromSchedule } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, PageHeader, Panel } from "@/app/components/ui";

import { requireUser } from "@/lib/auth";
import { getMaintenanceScheduleDetail } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";
import { WorkOrderControls } from "../work-order-controls";

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
    SUSPENDED: "Suspensa",
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
  const [user, schedule] = await Promise.all([
    requireUser(),
    getMaintenanceScheduleDetail(id),
  ]);

  if (!schedule) {
    notFound();
  }

  const isUser = user.role === "USER";
  if (isUser && schedule.assignedToId !== user.id) {
    redirect("/plano");
  }

  const shellHref = isUser ? "/plano" : "/manutencao";
  const backHref = isUser ? "/plano" : "/manutencao";
  const backLabel = isUser ? "Plano do dia" : "Manutenção";
  const workOrder = schedule.workOrder;
  const workOrderConsumables = workOrder?.consumableMovements.filter(m => m.type === "SAIDA_OP") ?? [];
  const workOrderConsumableCost = workOrderConsumables.reduce(
    (sum, movement) => sum + Number(movement.quantity ?? 0) * Number(movement.consumable.unitCost ?? 0),
    0,
  );
  const template = workOrder?.template ?? schedule.equipment.equipmentType?.checklistTemplates[0];


  return (
    <AppShell activeHref={shellHref}>
      <PageHeader
        eyebrow="Agendamento"
        title={schedule.title}
        description={`${schedule.equipment.name} - ${typeLabel(schedule.type)} - ${formatDate(schedule.scheduledAt)} - ${scheduleStatusLabel(schedule.status)}`}
        action={
          <Link href={backHref} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50">
            <ArrowLeft size={17} />
            {backLabel}
          </Link>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel>
          <div className="flex items-center gap-3">
            <Wrench size={22} className="text-cyan-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Ordem de serviço</h2>
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
              {user.role !== "VIEWER" && <WorkOrderControls workOrder={workOrder} canManage={["ADMIN", "MANAGER"].includes(user.role)} />}
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

        <WorkOrderExecution workOrder={workOrder} equipmentId={schedule.equipmentId} template={template} consumableOptions={schedule.consumableOptions} />
      </section>
    </AppShell>
  );
}

