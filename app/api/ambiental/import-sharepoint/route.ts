import { revalidatePath } from "next/cache";

import { importSharePointEnvironmentalReports } from "@/lib/environmental-sharepoint";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
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
  const folderUrl = settings?.sharePointFolderUrl || process.env.ENVIRONMENTAL_SHAREPOINT_FOLDER_URL;

  if (!folderUrl) {
    return Response.json({ ok: false, error: "Pasta SharePoint nao configurada." }, { status: 400 });
  }

  const result = await importSharePointEnvironmentalReports(folderUrl);
  revalidatePath("/ambiental");

  return Response.json({ ok: true, ...result });
}
