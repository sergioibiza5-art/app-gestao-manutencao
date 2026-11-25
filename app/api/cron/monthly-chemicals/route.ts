import { monthlyChemicalSchedule } from "@/lib/chemical-monthly-calendar";
import { sendMonthlyChemicalReport } from "@/lib/chemical-monthly-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(null, { status: 401 });
  }
  const now = new Date();
  const schedule = monthlyChemicalSchedule(now);
  // Start with November's report in December; do not backfill October on deployment.
  if (schedule.today < "2026-12-01") {
    return Response.json({ skipped: true, firstRunMonth: "2026-12", sent: 0, failed: 0 }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  try {
    const result = await sendMonthlyChemicalReport(now);
    return Response.json(result, {
      status: result.failed ? 502 : 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Falha no envio mensal de produtos quimicos", error instanceof Error ? error.name : "Erro desconhecido");
    return Response.json({ error: "Nao foi possivel enviar o relatorio mensal de produtos quimicos." }, {
      status: 500, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
