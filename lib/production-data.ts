import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export async function productionBatchAccess(id: string) {
  const user = await requireUser();
  // Production lots are shared; ticket/maintenance equipment grants do not own a lot.
  const batch = await getPrisma().productionBatch.findUnique({ where: { id }, include: {
    equipment: { select: { name: true, code: true } },
    activities: { include: { collaborator: { select: { name: true, username: true } } }, orderBy: { startedAt: "asc" } },
    qualityCalls: { include: { technician: { select: { name: true } } }, orderBy: { calledAt: "asc" } },
    audits: { orderBy: { createdAt: "desc" }, take: 50 },
  } });
  if (!batch) notFound();
  return { batch, user };
}
