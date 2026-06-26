import { revalidatePath } from "next/cache";

import { importGoogleDriveEnvironmentalReports } from "@/lib/environmental-google-drive";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.replace("Bearer ", "");

  return querySecret === secret || bearerSecret === secret;
}

function lisbonHour() {
  const parts = new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === "hour")?.value ?? -1);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";

  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "Nao autorizado." }, { status: 401 });
  }

  if (!force && ![9, 15].includes(lisbonHour())) {
    return Response.json({ ok: true, skipped: true, reason: "Fora das 09h/15h Europe/Lisbon." });
  }

  const prisma = getPrisma();
  const settings = await prisma.environmentalSettings.findUnique({ where: { id: "default" } });
  const folder = settings?.googleDriveFolderId || settings?.googleDriveFolderUrl || process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_URL;

  if (!folder) {
    return Response.json({ ok: false, error: "Pasta Google Drive nao configurada." }, { status: 400 });
  }

  const result = await importGoogleDriveEnvironmentalReports(folder);
  revalidatePath("/ambiental");

  return Response.json({ ok: true, ...result });
}
