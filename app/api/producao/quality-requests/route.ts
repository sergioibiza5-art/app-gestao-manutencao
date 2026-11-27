import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { canExecuteQuality } from "@/lib/production";
import type { QualityPopupCall } from "@/lib/quality-popup";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sessão indisponível." }, { status: 401, headers });
  if (user.mustChangePassword || !canExecuteQuality(user)) return Response.json({ error: "Sem autorização para executar CQ." }, { status: 403, headers });
  const calls = await getPrisma().productionQualityCall.findMany({
    where: { arrivedAt: null, endedAt: null, batch: { status: "OPEN" } },
    select: { id: true, batchId: true, calledAt: true, hasStop: true, stopEndedAt: true,
      batch: { select: { lot: true, reference: true, line: true, equipment: { select: { code: true, name: true } } } } },
    orderBy: [{ calledAt: "desc" }, { id: "desc" }], take: 100,
  });
  return Response.json({ calls: calls.map((c): QualityPopupCall => ({ id: c.id, batchId: c.batchId, lot: c.batch.lot,
    reference: c.batch.reference, line: c.batch.line, equipment: c.batch.equipment.code || c.batch.equipment.name,
    calledAt: c.calledAt.toISOString(), stopped: c.hasStop && !c.stopEndedAt })) }, { headers });
}
