import type { DailyMaintenanceEntry, UserRole } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export const pilotCode = "MCC_1";
export const documentCode = "IMPSUP0833.02";
export const dailyChecks = [
  { key: "feltro", label: "Lubrificar os discos de feltro com óleo mineral (lâmina de corte longitudinal)." },
  { key: "espuma", label: "Lubrificar os rolos de espuma com óleo mineral (lâmina de corte transversal)." },
  { key: "terra", label: "Verificar se a braçadeira do cabo de terra está firme na mesa de dobragem longitudinal e ligada no ponto previsto." },
] as const;

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
  const equipment = await prisma.equipment.findFirst({
    where: { id, code: pilotCode },
    select: { id: true, code: true, name: true, status: true },
  });
  if (!equipment) notFound();
  if (user.role === "USER") {
    const access = await prisma.ticketEquipmentAccess.findMany({
      where: { userId: user.id }, select: { equipmentId: true },
    });
    if (access.length && !access.some((row) => row.equipmentId === id)) notFound();
  }
  return {
    user,
    equipment,
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

export function parseDailyChecks(formData: FormData): DailyCheck[] | null {
  const checks: DailyCheck[] = [];
  for (const { key, label } of dailyChecks) {
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

export async function dailyMaintenanceMonth(id: string, requestedMonth?: string | null) {
  const today = lisbonDay();
  const currentMonth = today.slice(0, 7);
  const month = requestedMonth && /^20\d{2}-(0[1-9]|1[0-2])$/.test(requestedMonth) && requestedMonth <= currentMonth
    ? requestedMonth : currentMonth;
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const entries = await getPrisma().dailyMaintenanceEntry.findMany({
    where: { equipmentId: id, day: { gte: start, lt: end } },
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
