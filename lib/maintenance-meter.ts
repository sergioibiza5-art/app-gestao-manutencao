import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

export function parseMeter(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim().replace(",", ".") : "";
  return /^\d{1,10}(\.\d{1,2})?$/.test(text) ? new Prisma.Decimal(text) : null;
}

export async function maintenanceMeterState(
  prisma: PrismaClient | Prisma.TransactionClient,
  equipmentId: string,
  groupKey: string,
  intervalHours: number,
  firstHours?: number,
) {
  const where = { equipmentId, groupKey };
  const reading = await prisma.maintenanceMeterReading.findFirst({
    where, orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
  });
  const reference = await prisma.maintenanceMeterReading.findFirst({
    where: { ...where, referenceHours: { not: null } },
    orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
  });
  const maintenance = await prisma.dailyMaintenanceEntry.findFirst({
    where: { ...where, noProduction: false, meterHours: { not: null } },
    orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
  });
  const baseline = maintenance?.meterHours ?? reference?.referenceHours ?? null;
  const next = baseline ? baseline.plus(intervalHours)
    : firstHours != null ? new Prisma.Decimal(firstHours) : null;
  const current = reading && (!maintenance || reading.recordedAt >= maintenance.recordedAt)
    ? reading.meterHours : maintenance?.meterHours ?? null;
  const remaining = next && current ? next.minus(current) : null;
  return { reading, maintenance, baseline, next, current, remaining };
}
