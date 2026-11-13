import { dailyMaintenanceAccess, dailyMaintenanceMonth } from "@/lib/daily-maintenance";
import { dailyMaintenancePdf } from "@/lib/daily-maintenance-pdf";
import { maintenanceGroup } from "@/lib/mcc-maintenance-plan";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { equipment } = await dailyMaintenanceAccess(id);
  const query = new URL(request.url).searchParams;
  const group = maintenanceGroup(equipment.code, query.get("grupo"));
  const report = await dailyMaintenanceMonth(id, group.key, query.get("mes"));
  const pdf = await dailyMaintenancePdf(equipment, report, group);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${equipment.code}-${group.key}-${report.month}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
