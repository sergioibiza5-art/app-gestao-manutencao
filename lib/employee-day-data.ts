import type { User } from "@prisma/client";
import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { canViewEmployee, employeeDayTotals, employeeDayWindow, clipDayPeriod, type DayPeriod } from "@/lib/employee-day";
import { cleaningPerformerName } from "@/lib/daily-maintenance";
import { isCleaning, maintenancePlan } from "@/lib/mcc-maintenance-plan";
import { productionOperations } from "@/lib/production";

export type DayEvent = {
  id: string; at: Date; end?: Date | null; title: string; detail: string;
  kind: string; minutes?: number; href?: string; open?: boolean;
};

export async function getEmployeeDay(viewer: User, personId: string, day: string, now = new Date()) {
  if (!canViewEmployee(viewer, personId)) notFound();
  const db = getPrisma();
  const person = await db.user.findUnique({ where: { id: personId }, select: { id: true, name: true, active: true } });
  if (!person) notFound();
  const window = employeeDayWindow(day);
  const inDay = { gte: window.start, lt: window.end };
  const [activities, quality, entries, tickets, orders] = await Promise.all([
    db.productionActivity.findMany({
    where: { collaboratorId: personId, startedAt: { lt: window.end }, OR: [{ endedAt: null }, { endedAt: { gt: window.start } }] },
    select: { id: true, startedAt: true, endedAt: true, operation: true, batch: { select: { id: true, lot: true, reference: true } } },
    }),
    db.productionQualityCall.findMany({
    where: { technicianId: personId, calledAt: { lt: window.end }, OR: [{ endedAt: null }, { endedAt: { gt: window.start } }] },
    select: { id: true, calledAt: true, arrivedAt: true, endedAt: true, batch: { select: { id: true, lot: true } } },
    }),
    db.dailyMaintenanceEntry.findMany({
    where: { OR: [{ recordedById: personId, recordedAt: inDay }, { verifiedById: personId, verifiedAt: inDay }] },
    include: { equipment: { select: { code: true, name: true } } },
    }),
    db.maintenanceTicket.findMany({
    where: { OR: [
      { openedById: personId, openedAt: inDay }, { startedById: personId, startedAt: inDay },
      { completedById: personId, completedAt: inDay },
      { status: { in: ["OPEN", "IN_PROGRESS", "PAUSED"] }, OR: [{ assignedToId: personId }, { openedById: personId }] },
    ] },
    select: { id: true, number: true, title: true, status: true, openedAt: true, startedAt: true, completedAt: true,
      openedById: true, startedById: true, completedById: true, assignedToId: true, totalWorkSeconds: true, lastResumedAt: true },
    }),
    db.workOrder.findMany({
    where: { ticket: null, status: { in: ["OPEN", "IN_PROGRESS", "PAUSED", "SUSPENDED"] }, OR: [{ schedule: { assignedToId: personId } }, { maintenanceLog: { userId: personId } }] },
    select: { id: true, number: true, title: true, status: true, totalWorkSeconds: true, lastResumedAt: true },
    }),
  ]);
  const events: DayEvent[] = [];
  const periods: DayPeriod[] = [];
  const current: DayEvent[] = [];
  for (const a of activities) {
    const period: DayPeriod = { start: a.startedAt, end: a.endedAt, kind: "production" };
    periods.push(period);
    const interval = clipDayPeriod(period, window, now);
    const event = { id: `activity-${a.id}`, at: a.startedAt, end: a.endedAt,
      title: productionOperations[a.operation as keyof typeof productionOperations] || a.operation,
      detail: `${a.batch.reference} · Lote ${a.batch.lot}`, kind: "Produção", href: `/producao?lote=${a.batch.id}`, open: !a.endedAt,
      minutes: interval ? (interval.end.getTime() - interval.start.getTime()) / 60000 : 0 };
    if (interval) events.push(event);
    if (!a.endedAt && a.startedAt <= now) current.push(event);
  }
  for (const q of quality) {
    const period: DayPeriod | null = q.arrivedAt ? { start: q.arrivedAt, end: q.endedAt, kind: "quality" } : null;
    if (period) periods.push(period);
    const interval = period && clipDayPeriod(period, window, now);
    const event = { id: `quality-${q.id}`, at: q.arrivedAt ?? q.calledAt, end: q.endedAt,
      title: q.arrivedAt ? "Controlo de qualidade" : "Chamada de CQ por iniciar",
      detail: `Lote ${q.batch.lot}`, kind: "Qualidade", href: `/producao?lote=${q.batch.id}`, open: !q.endedAt,
      ...(interval ? { minutes: (interval.end.getTime() - interval.start.getTime()) / 60000 } : {}) };
    if (interval || (!q.arrivedAt && q.calledAt >= window.start && q.calledAt < window.end)) events.push(event);
    if (!q.endedAt && q.calledAt <= now) current.push(event);
  }
  const within = (date: Date | null) => date && date >= window.start && date < window.end;
  for (const entry of entries) {
    const title = entry.noProduction ? "Sem produção" : isCleaning(entry.groupKey) ? "Registou limpeza" : "Registou plano preventivo";
    const group = maintenancePlan(entry.equipment.code).find(g => g.key === entry.groupKey)?.label || entry.groupKey;
    const period = entry.day.toISOString().slice(0, 10).split("-").reverse().join("/");
    const detail = `${entry.equipment.code} · ${entry.equipment.name} · ${group} · Registo de ${period}${isCleaning(entry.groupKey) && !entry.noProduction ? ` · Executada por ${cleaningPerformerName(entry)}` : ""}`;
    if (entry.recordedById === personId && within(entry.recordedAt)) events.push({ id: `entry-${entry.id}`, at: entry.recordedAt, title, detail, kind: "Assinatura" });
    if (entry.verifiedById === personId && within(entry.verifiedAt)) events.push({ id: `verification-${entry.id}`, at: entry.verifiedAt!, title: "Verificou limpeza", detail, kind: "Verificação" });
  }
  const ticketHref = (openedById: string | null, id: string) => !["SGQ", "HSA"].includes(viewer.role) && (viewer.role !== "TICKET" || openedById === viewer.id) ? `/tickets?ticketId=${id}` : undefined;
  for (const ticket of tickets) {
    const base = { title: `${ticket.number} · ${ticket.title}`, detail: "", kind: "Ticket", href: ticketHref(ticket.openedById, ticket.id) };
    if (ticket.openedById === personId && within(ticket.openedAt)) events.push({ ...base, id: `ticket-open-${ticket.id}`, at: ticket.openedAt, detail: "Abriu pedido" });
    if (ticket.startedById === personId && within(ticket.startedAt)) events.push({ ...base, id: `ticket-start-${ticket.id}`, at: ticket.startedAt!, detail: "Iniciou intervenção" });
    if (ticket.completedById === personId && within(ticket.completedAt)) events.push({ ...base, id: `ticket-end-${ticket.id}`, at: ticket.completedAt!, detail: "Concluiu intervenção" });
  }
  const accumulated = (record: { totalWorkSeconds: number; lastResumedAt: Date | null; status: string }) =>
    (record.totalWorkSeconds + (record.status === "IN_PROGRESS" && record.lastResumedAt ? Math.max(0, (now.getTime() - record.lastResumedAt.getTime()) / 1000) : 0)) / 60;
  const pending = [
    ...tickets.filter(t => ["OPEN", "IN_PROGRESS", "PAUSED"].includes(t.status)).map(t => ({ id: t.id, title: `${t.number} · ${t.title}`, status: t.status,
      detail: t.assignedToId === personId ? "Intervenção atribuída" : "Pedido em acompanhamento", minutes: accumulated(t), href: ticketHref(t.openedById, t.id) })),
    ...orders.map(o => ({ id: o.id, title: `${o.number} · ${o.title}`, status: o.status, detail: "Ordem de serviço atribuída", minutes: accumulated(o), href: ["ADMIN", "MANAGER", "VIEWER"].includes(viewer.role) ? `/manutencao/ops/${o.id}` : undefined })),
  ];
  events.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id));
  return { person, events, current, pending, totals: employeeDayTotals(periods, window, now) };
}
