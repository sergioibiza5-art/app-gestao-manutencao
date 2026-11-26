import type { User } from "@prisma/client";
import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { employeeDayTotals, employeeDayWindow, type DayPeriod } from "@/lib/employee-day";
import { isCleaning } from "@/lib/mcc-maintenance-plan";
import { lisbonDay } from "@/lib/daily-maintenance";

export async function getEmployeeTeam(viewer: Pick<User, "productionCoordinator">, day: string, now = new Date()) {
  if (!viewer.productionCoordinator) notFound();
  const db = getPrisma(), window = employeeDayWindow(day), live = day === lisbonDay(now);
  const [people, activities, quality, entries] = await Promise.all([
    db.user.findMany({ select: { id: true, name: true, role: true, active: true }, orderBy: { name: "asc" } }),
    db.productionActivity.findMany({ where: { startedAt: { lt: window.end }, OR: [{ endedAt: null }, { endedAt: { gt: window.start } }] },
      select: { collaboratorId: true, startedAt: true, endedAt: true, batch: { select: { id: true, lot: true, reference: true } } } }),
    db.productionQualityCall.findMany({ where: { calledAt: { lt: window.end }, technicianId: { not: null }, OR: [{ endedAt: null }, { endedAt: { gt: window.start } }] },
      select: { technicianId: true, calledAt: true, arrivedAt: true, endedAt: true, batch: { select: { id: true, lot: true, reference: true } } } }),
    db.dailyMaintenanceEntry.findMany({ where: { OR: [{ recordedAt: { gte: window.start, lt: window.end } }, { verifiedAt: { gte: window.start, lt: window.end } }] },
      select: { recordedById: true, recordedAt: true, verifiedById: true, verifiedAt: true, groupKey: true, noProduction: true } }),
  ]);
  const grouped = new Map<string, { periods: DayPeriod[]; current: { title: string; href: string; start: Date }[]; signatures: number; unverified: number }>();
  const row = (id: string) => {
    let value = grouped.get(id);
    if (!value) { value = { periods: [], current: [], signatures: 0, unverified: 0 }; grouped.set(id, value); }
    return value;
  };
  for (const activity of activities) {
    const value = row(activity.collaboratorId);
    value.periods.push({ start: activity.startedAt, end: activity.endedAt, kind: "production" });
    if (live && !activity.endedAt && activity.startedAt <= now) value.current.push({ title: `Produção · ${activity.batch.reference} · ${activity.batch.lot}`, href: `/producao?lote=${activity.batch.id}`, start: activity.startedAt });
  }
  for (const call of quality) {
    const value = row(call.technicianId!);
    if (call.arrivedAt) value.periods.push({ start: call.arrivedAt, end: call.endedAt, kind: "quality" });
    if (live && !call.endedAt && call.calledAt <= now) value.current.push({ title: `${call.arrivedAt ? "CQ" : "CQ por iniciar"} · ${call.batch.reference} · ${call.batch.lot}`, href: `/producao?lote=${call.batch.id}`, start: call.arrivedAt ?? call.calledAt });
  }
  for (const entry of entries) {
    if (entry.recordedAt >= window.start && entry.recordedAt < window.end) {
      const value = row(entry.recordedById);
      value.signatures++;
      if (isCleaning(entry.groupKey) && !entry.noProduction && !entry.verifiedAt) value.unverified++;
    }
    if (entry.verifiedById && entry.verifiedAt && entry.verifiedAt >= window.start && entry.verifiedAt < window.end) row(entry.verifiedById).signatures++;
  }
  return people.filter(person => person.active || grouped.has(person.id)).map(person => {
    const value = row(person.id), totals = employeeDayTotals(value.periods, window, now);
    const forgotten = value.current.filter(work => work.start < window.start).length;
    return { person, current: value.current, totals, signatures: value.signatures, unverified: value.unverified, forgotten,
      attention: forgotten > 0 || totals.overlap || value.unverified > 0 };
  }).sort((a, b) => Number(b.attention) - Number(a.attention) || Number(b.current.length > 0) - Number(a.current.length > 0) || a.person.name.localeCompare(b.person.name, "pt"));
}
