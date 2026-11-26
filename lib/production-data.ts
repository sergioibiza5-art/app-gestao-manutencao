import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import type { Prisma, User } from "@prisma/client";
import { notFound } from "next/navigation";

export async function productionScope(user: Pick<User, "id" | "role">) {
  if (!["TICKET", "USER"].includes(user.role)) return {};
  const db = getPrisma();
  const grants = await db.ticketEquipmentAccess.findMany({ where: { userId: user.id }, select: { equipmentId: true } });
  if (!grants.length && user.role === "USER") return {};
  const ids = new Set(grants.map(x => x.equipmentId));
  if (ids.size) {
    const family = await db.equipment.findMany({ where: { parentEquipmentId: { not: null } }, select: { id: true, parentEquipmentId: true } });
    for (const id of ids) for (const child of family) if (child.parentEquipmentId === id) ids.add(child.id);
  }
  return { id: { in: [...ids] } } satisfies Prisma.EquipmentWhereInput;
}

export async function productionBatchAccess(id: string) {
  const user = await requireUser();
  const scope = await productionScope(user);
  const batch = await getPrisma().productionBatch.findFirst({ where: { id, equipment: scope }, include: {
    equipment: { select: { name: true, code: true } },
    activities: { include: { collaborator: { select: { name: true, username: true } } }, orderBy: { startedAt: "asc" } },
    qualityCalls: { include: { technician: { select: { name: true } } }, orderBy: { calledAt: "asc" } },
    audits: { orderBy: { createdAt: "desc" }, take: 50 },
  } });
  if (!batch) notFound();
  return { batch, user };
}
