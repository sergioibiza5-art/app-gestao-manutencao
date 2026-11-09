import { sendCalibrationEmails } from "@/lib/calibration-email";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== "Bearer " + process.env.CRON_SECRET) {
    return new Response(null, { status: 401 });
  }
  const result = await sendCalibrationEmails();
  return Response.json(result, { status: result.failed ? 502 : 200 });
}

// A time-limited test grant selects one SGQ recipient on the server.
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) return new Response(null, { status: 401 });
  try {
    const result = await sendCalibrationEmails(token);
    return Response.json(result, { status: result.failed ? 502 : 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "Teste inválido ou expirado.") return new Response(null, { status: 401 });
    throw error;
  }
}
