import { revalidatePath } from "next/cache";

import { sendDailyPlanDigests } from "@/lib/daily-plan-digest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.replace("Bearer ", "").trim();

  return querySecret === secret || bearerSecret === secret;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const date = url.searchParams.get("date") ?? undefined;

  if (!isAuthorized(request)) {
    return Response.json(
      {
        ok: false,
        error: "Nao autorizado.",
      },
      { status: 401 },
    );
  }

  try {
    const result = await sendDailyPlanDigests({ date, force });

    revalidatePath("/plano");

    return Response.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido no plano diário.";
    console.error("Falha ao gerar plano diario:", error);

    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
