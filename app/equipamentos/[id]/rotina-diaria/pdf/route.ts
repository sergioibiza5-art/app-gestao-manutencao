import { dailyMaintenanceAccess, dailyMaintenanceMonth } from "@/lib/daily-maintenance";
import { dailyMaintenancePdf } from "@/lib/daily-maintenance-pdf";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { equipment } = await dailyMaintenanceAccess(id);
  const report = await dailyMaintenanceMonth(id, new URL(request.url).searchParams.get("mes"));
  const pdf = await dailyMaintenancePdf(equipment, report);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="MCC_1-rotina-diaria-${report.month}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
