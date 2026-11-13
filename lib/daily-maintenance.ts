import type { DailyMaintenanceEntry, UserRole } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { maintenancePlanCodes } from "@/lib/mcc-maintenance-plan";

export const dailyResults = { OK: "Conforme", NOT_OK: "Não conforme" } as const;
export type DailyResult = keyof typeof dailyResults;
export type DailyCheck = { label: string; result: DailyResult };

export function canRecordDailyMaintenance(role: UserRole) {
  return role === "ADMIN" || role === "MANAGER" || role === "USER";
}

export async function dailyMaintenanceAccess(id: string) {
  const user = await requireUser();
  if (user.role === "TICKET") redirect("/tickets");
  const prisma = getPrisma();
  const access = user.role === "USER" ? await prisma.ticketEquipmentAccess.findMany({
    where: { userId: user.id }, select: { equipmentId: true },
  }) : [];
  const units = await prisma.equipment.findMany({
    where: { code: { in: maintenancePlanCodes }, ...(access.length ? { id: { in: access.map((row) => row.equipmentId) } } : {}) },
    select: { id: true, code: true, name: true, status: true },
  });
  const equipment = units.find((unit) => unit.id === id);
  if (!equipment) notFound();
  return {
    user,
    equipment,
    units: maintenancePlanCodes.flatMap((code) => units.filter((unit) => unit.code === code)),
    canRecord: canRecordDailyMaintenance(user.role) && !["INACTIVE", "DISCARDED"].includes(equipment.status),
  };
}

export function dailyPath(id: string) {
  return `/equipamentos/${encodeURIComponent(id)}/rotina-diaria`;
}

export function lisbonDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value).join("-");
}

export function parseDailyChecks(formData: FormData, points: readonly { key: string; label: string }[]): DailyCheck[] | null {
  const checks: DailyCheck[] = [];
  for (const { key, label } of points) {
    const result = formData.get(key);
    if (result !== "OK" && result !== "NOT_OK") return null;
    checks.push({ label, result });
  }
  return checks;
}

export function entryChecks(entry: DailyMaintenanceEntry) {
  return entry.checks as DailyCheck[];
}

export function dailyEntryStatus(entry?: DailyMaintenanceEntry) {
  if (!entry) return "Sem registo";
  if (entry.noProduction) return "Sem produção";
  return entryChecks(entry).some(({ result }) => result === "NOT_OK")
    ? "Verificação com falhas"
    : "Verificação registada";
}

export function maintenancePeriodStart(groupKey: string, day: string) {
  const start = new Date(`${day}T00:00:00Z`);
  if (groupKey === "daily") return start;
  if (groupKey === "weekly") {
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
    return start;
  }
  if (groupKey === "fortnightly") {
    // Consecutive two-week blocks anchored to a Monday across year boundaries.
    const anchor = Date.UTC(1970, 0, 5);
    const block = 14 * 86400000;
    return new Date(anchor + Math.floor((start.getTime() - anchor) / block) * block);
  }
  if (groupKey === "monthly" || groupKey === "semiannual" || groupKey === "annual") {
    const month = start.getUTCMonth();
    start.setUTCMonth(groupKey === "annual" ? 0 : groupKey === "semiannual" ? Math.floor(month / 6) * 6 : month, 1);
    return start;
  }
  return null;
}

export function biennialDueDate(day: Date) {
  const year = day.getUTCFullYear() + 2;
  const month = day.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(lastDay, day.getUTCDate())));
}

export async function currentMaintenancePeriods(id: string, groupKeys: string[], today: string) {
  const end = new Date(`${today}T00:00:00Z`);
  const periods = groupKeys.flatMap((groupKey) => {
    const start = maintenancePeriodStart(groupKey, today);
    if (groupKey === "biennial" || groupKey === "500-hours") return [{ groupKey, day: { lte: end } }];
    return start ? [{ groupKey, day: { gte: start, lte: end } }] : [];
  });
  if (!periods.length) return new Map<string, DailyMaintenanceEntry>();
  const entries = await getPrisma().dailyMaintenanceEntry.findMany({
    where: { equipmentId: id, OR: periods },
    orderBy: [{ day: "desc" }, { revision: "desc" }],
    distinct: ["groupKey"],
  });
  return new Map(entries.map((entry) => [entry.groupKey, entry]));
}

export async function dailyMaintenanceMonth(id: string, groupKey: string, requestedMonth?: string | null) {
  const today = lisbonDay();
  const currentMonth = today.slice(0, 7);
  const month = requestedMonth && /^20\d{2}-(0[1-9]|1[0-2])$/.test(requestedMonth) && requestedMonth <= currentMonth
    ? requestedMonth : currentMonth;
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const entries = await getPrisma().dailyMaintenanceEntry.findMany({
    where: { equipmentId: id, groupKey, day: { gte: start, lt: end } },
    orderBy: [{ day: "asc" }, { revision: "desc" }],
  });
  const byDay = new Map<string, DailyMaintenanceEntry[]>();
  for (const entry of entries) {
    const day = entry.day.toISOString().slice(0, 10);
    const existing = byDay.get(day);
    if (existing) existing.push(entry);
    else byDay.set(day, [entry]);
  }
  const days = Array.from({ length: (end.getTime() - start.getTime()) / 86400000 }, (_, index) => {
    const day = `${month}-${String(index + 1).padStart(2, "0")}`;
    return { day, future: day > today, entries: byDay.get(day) ?? [] };
  });
  return { month, today, days };
}

export function displayDay(day: string) {
  return day.split("-").reverse().join("/");
}

export function displayRecordedAt(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short", timeStyle: "short", timeZone: "Europe/Lisbon",
  }).format(date);
}
