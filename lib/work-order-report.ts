import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";

export function workOrderReportScope(user: { id: string; role: string }, equipmentIds: string[]): Prisma.WorkOrderWhereInput | null {
  if (["ADMIN", "MANAGER", "VIEWER", "SGQ", "HSA"].includes(user.role)) return {};
  if (user.role !== "USER") return null;
  return {
    ...(equipmentIds.length ? { equipmentId: { in: equipmentIds } } : {}),
    OR: [{ schedule: { assignedToId: user.id } }, { ticket: { assignedToId: user.id } }],
  };
}

export async function loadWorkOrderReport(id: string, scope: Prisma.WorkOrderWhereInput) {
  const prisma = getPrisma();
  const order = await prisma.workOrder.findFirst({
    where: { AND: [scope, { id }] },
    include: {
      equipment: { include: { equipmentType: true } },
      schedule: { include: { assignedTo: { select: { name: true } } } },
      checklistRecord: {
        include: {
          template: true,
          responses: { orderBy: { item: { order: "asc" } }, include: { item: true, photos: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } } },
        },
      },
      ticket: true,
      documents: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      maintenanceLog: true,
      consumableMovements: {
        where: { type: { in: ["SAIDA_OP", "SAIDA_TICKET"] } },
        include: { consumable: true }, orderBy: [{ date: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!order) return null;
  const code = await prisma.moduleCodification.findUnique({ where: { moduleKey: "documento-manutencao-interna" }, select: { code: true } });
  return { order, codification: code?.code?.replace(/^#+\s*/, "") ?? "" };
}

export type WorkOrderReport = NonNullable<Awaited<ReturnType<typeof loadWorkOrderReport>>>;

export function evidenceLink(value: string, origin: string) {
  try {
    const url = value.startsWith("/") && !value.startsWith("//") ? new URL(value, origin) : new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function reportFilename(number: string) {
  return `Relatorio-${number.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 80) || "OP"}.pdf`;
}
