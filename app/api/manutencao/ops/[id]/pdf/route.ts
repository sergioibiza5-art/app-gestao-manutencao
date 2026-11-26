import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { loadWorkOrderReport, reportFilename, workOrderReportScope } from "@/lib/work-order-report";
import { workOrderPdf } from "@/lib/work-order-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  if (user.mustChangePassword) return new Response(null, { status: 403 });
  const equipment = user.role === "USER" ? await getPrisma().ticketEquipmentAccess.findMany({ where: { userId: user.id }, select: { equipmentId: true } }) : [];
  const scope = workOrderReportScope(user, equipment.map(row => row.equipmentId));
  if (!scope) return new Response(null, { status: 403 });
  const { id } = await params;
  const report = await loadWorkOrderReport(id, scope);
  if (!report) return new Response(null, { status: 404 });
  const pdf = await workOrderPdf(report, user.name, new URL(request.url).origin);
  return new Response(new Uint8Array(pdf), { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${reportFilename(report.order.number)}"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
