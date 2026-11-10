import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export async function workOrderScope(): Promise<Prisma.WorkOrderWhereInput> {
  const user = await requireUser();
  if (user.role === "TICKET") redirect("/tickets");
  if (user.role === "SGQ" || user.role === "HSA") redirect("/calibracao");
  if (user.role === "USER") {
    const access = await getPrisma().ticketEquipmentAccess.findMany({
      where: { userId: user.id }, select: { equipmentId: true },
    });
    return {
      ...(access.length ? { equipmentId: { in: access.map(row => row.equipmentId) } } : {}),
      OR: [{ schedule: { assignedToId: user.id } }, { ticket: { assignedToId: user.id } }],
    };
  }
  return {};
}

export const workOrderStatuses = {
  OPEN: "OP criada", IN_PROGRESS: "OP iniciada", PAUSED: "OP pausada", SUSPENDED: "OP suspensa",
  DONE: "OP concluída", VALIDATED: "OP validada", CANCELED: "OP cancelada",
} as const;
