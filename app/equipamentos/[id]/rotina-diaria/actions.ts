"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { canVerifyCleaning, dailyMaintenanceAccess, dailyPath, lisbonDay, parseDailyChecks } from "@/lib/daily-maintenance";
import { cleaningDocumentCode, documentCode, isCleaning, maintenancePlan } from "@/lib/mcc-maintenance-plan";
import { getPrisma } from "@/lib/prisma";

export async function recordDailyMaintenance(id: string, groupKey: string, formData: FormData) {
  const { user, equipment, canRecord } = await dailyMaintenanceAccess(id);
  const group = maintenancePlan(equipment.code).find((item) => item.key === groupKey);
  if (!group) redirect(dailyPath(id));
  const path = `${dailyPath(equipment.id)}?grupo=${group.key}`;
  if (!canRecord) redirect(path);

  const today = lisbonDay();
  if (formData.get("day") !== today) redirect(`${path}&erro=dia`);
  const mode = formData.get("mode");
  if (mode !== "checks" && (mode !== "no-production" || group.key !== "daily")) redirect(`${path}&erro=respostas`);
  const noProduction = mode === "no-production";
  const checks = noProduction ? [] : parseDailyChecks(formData, group.checks);
  if (!checks) redirect(`${path}&erro=respostas`);
  const rawMeter = formData.get("meterHours");
  const meter = typeof rawMeter === "string" ? rawMeter.trim().replace(",", ".") : "";
  if (group.key === "500-hours" && !/^\d{1,10}(\.\d{1,2})?$/.test(meter)) redirect(`${path}&erro=horimetro`);
  const rawNotes = formData.get("notes");
  const notes = typeof rawNotes === "string" ? rawNotes.trim() : "";
  const cleaning = isCleaning(group.key);
  const products = String(formData.get("products") ?? "").trim();
  const tools = String(formData.get("tools") ?? "").trim();
  if (cleaning && (!products || !tools || products.length > 300 || tools.length > 300)) {
    redirect(`${path}&erro=materiais`);
  }
  if (notes.length > 1000 || (checks.some(({ result }) => result === "NOT_OK") && !notes)) {
    redirect(`${path}&erro=observacoes`);
  }

  const revision = noProduction ? 1 : Number(formData.get("revision"));
  if (revision !== 1 && revision !== 2) redirect(`${path}&erro=atualizado`);
  const day = new Date(`${today}T00:00:00Z`);
  let saved = false;
  try {
    saved = await getPrisma().$transaction(async (tx) => {
      const current = await tx.dailyMaintenanceEntry.findFirst({
        where: { equipmentId: id, groupKey, day }, orderBy: { revision: "desc" },
      });
      if ((current?.revision ?? 0) + 1 !== revision || (current && (!current.noProduction || noProduction))) {
        return false;
      }
      await tx.dailyMaintenanceEntry.create({ data: {
        equipmentId: id, groupKey, day, revision, documentCode: cleaning ? cleaningDocumentCode : documentCode,
        noProduction, checks: cleaning ? { points: checks, products, tools } : checks, notes: notes || null,
        meterHours: group.key === "500-hours" ? meter : null,
        recordedById: user.id, recorderName: user.name,
      } });
      return true;
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
  }
  redirect(saved ? `${path}&guardado=1` : `${path}&erro=atualizado`);
}

export async function verifyCleaning(id: string, groupKey: string, month: string, formData: FormData) {
  const { user, equipment } = await dailyMaintenanceAccess(id);
  const group = maintenancePlan(equipment.code).find((item) => item.key === groupKey && isCleaning(item.key));
  if (!group || !canVerifyCleaning(user.role)) redirect(dailyPath(id));
  const path = `${dailyPath(id)}?${new URLSearchParams({ grupo: group.key, mes: month })}`;
  const entryId = formData.get("entryId");
  if (typeof entryId !== "string" || !entryId) redirect(path);
  const result = await getPrisma().dailyMaintenanceEntry.updateMany({
    where: { id: entryId, equipmentId: id, groupKey: group.key, verifiedAt: null, recordedById: { not: user.id } },
    data: { verifiedAt: new Date(), verifiedById: user.id, verifierName: user.name },
  });
  redirect(`${path}&${result.count ? "verificado=1" : "erro=verificacao"}`);
}
