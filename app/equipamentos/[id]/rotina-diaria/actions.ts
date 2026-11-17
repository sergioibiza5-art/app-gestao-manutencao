"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { canVerifyCleaning, cleaningPerformerMaxLength, dailyMaintenanceAccess, dailyPath, lisbonDay, parseDailyChecks } from "@/lib/daily-maintenance";
import { isCleaning, maintenancePlan } from "@/lib/mcc-maintenance-plan";
import { getPrisma } from "@/lib/prisma";

export async function recordDailyMaintenance(id: string, groupKey: string, formData: FormData) {
  return submitDailyMaintenance(id, groupKey, formData, false);
}

export async function simulateDailyMaintenance(id: string, groupKey: string, formData: FormData) {
  return submitDailyMaintenance(id, groupKey, formData, true);
}

async function submitDailyMaintenance(id: string, groupKey: string, formData: FormData, simulate: boolean) {
  const { user, equipment, canRecord } = await dailyMaintenanceAccess(id);
  const group = maintenancePlan(equipment.code).find((item) => item.key === groupKey);
  if (!group || (simulate && (user.role === "TICKET" || equipment.code !== "MLA_1"))) redirect(dailyPath(id));
  const path = `${dailyPath(equipment.id)}?grupo=${group.key}${simulate ? "&teste=1" : ""}`;
  if (!canRecord) redirect(path);

  const today = lisbonDay();
  if (formData.get("day") !== today) redirect(`${path}&erro=dia`);
  const mode = formData.get("mode");
  if (mode !== "checks" && (mode !== "no-production" || group.key !== "daily")) redirect(`${path}&erro=respostas`);
  const noProduction = mode === "no-production";
  const checks = noProduction ? [] : parseDailyChecks(formData, group.checks);
  if (!checks) redirect(`${path}&erro=respostas`);
  if (!noProduction && group.pressureReading) {
    const pressure = String(formData.get("pressure") ?? "").trim().replace(",", ".");
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(pressure)) redirect(`${path}&erro=pressao`);
    const value = Number(pressure);
    checks[0].reading = `${pressure.replace(".", ",")} bar`;
    if (value < 6 || value > 7) checks[0].result = "NOT_OK";
  }
  const rawMeter = formData.get("meterHours");
  const meter = typeof rawMeter === "string" ? rawMeter.trim().replace(",", ".") : "";
  if (group.intervalHours && !/^\d{1,10}(\.\d{1,2})?$/.test(meter)) redirect(`${path}&erro=horimetro`);
  const rawNotes = formData.get("notes");
  const notes = typeof rawNotes === "string" ? rawNotes.trim() : "";
  const cleaning = isCleaning(group.key);
  const rawPerformer = formData.get("performedBy");
  const performedBy = typeof rawPerformer === "string" ? rawPerformer.trim().replace(/\s+/g, " ") : "";
  const needsPerformer = cleaning && user.role === "TICKET";
  if (needsPerformer && (!performedBy || performedBy.length > cleaningPerformerMaxLength)) {
    redirect(`${path}&erro=assinatura`);
  }
  const products = String(formData.get("products") ?? "").trim();
  const tools = String(formData.get("tools") ?? "").trim();
  if (cleaning && (!products || !tools || products.length > 300 || tools.length > 300)) {
    redirect(`${path}&erro=materiais`);
  }
  if (notes.length > 1000 || (checks.some(({ result }) => result === "NOT_OK") && !notes)) {
    redirect(`${path}&erro=observacoes`);
  }

  if (simulate) redirect(`${path}&simulado=1`);

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
        equipmentId: id, groupKey, day, revision, documentCode: group.documentCode,
        noProduction,
        checks: cleaning ? { points: checks, products, tools, ...(needsPerformer ? { performedBy } : {}) } : checks,
        notes: notes || null,
        meterHours: group.intervalHours ? meter : null,
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
  if (!group || !canVerifyCleaning(user)) redirect(dailyPath(id));
  const path = `${dailyPath(id)}?${new URLSearchParams({ grupo: group.key, mes: month })}`;
  const entryId = formData.get("entryId");
  if (typeof entryId !== "string" || !entryId) redirect(path);
  const result = await getPrisma().dailyMaintenanceEntry.updateMany({
    where: { id: entryId, equipmentId: id, groupKey: group.key, verifiedAt: null, recordedById: { not: user.id } },
    data: { verifiedAt: new Date(), verifiedById: user.id, verifierName: user.name },
  });
  redirect(`${path}&${result.count ? "verificado=1" : "erro=verificacao"}`);
}
