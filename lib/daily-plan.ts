import type { MaintenanceTicketPriority, PrismaClient, UserRole } from "@prisma/client";

import { formatDate } from "@/lib/format";
import { parseLisbonDateTimeInput } from "@/lib/lisbon-time";
import { readDb } from "@/lib/prisma";

const assignableRoles: UserRole[] = ["ADMIN", "MANAGER", "USER"];
const activeTaskStatuses = ["PENDING", "IN_PROGRESS"] as const;
const activeTicketStatuses = ["OPEN", "IN_PROGRESS", "PAUSED", "SUSPENDED"] as const;
const activeWorkOrderStatuses = ["OPEN", "IN_PROGRESS", "PAUSED", "SUSPENDED"] as const;
const urgentPriorities: MaintenanceTicketPriority[] = ["HIGH", "CRITICAL"];

export type DailyPlanViewer = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export function canViewTeamPlan(role: UserRole | string) {
  return role === "ADMIN" || role === "MANAGER";
}

export function lisbonDateValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function normalizeDateValue(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return lisbonDateValue();
  }

  return value;
}

function addDaysToDateValue(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function dailyPlanRange(value?: string | null) {
  const dateValue = normalizeDateValue(value);
  const nextDateValue = addDaysToDateValue(dateValue, 1);
  const start = parseLisbonDateTimeInput(`${dateValue}T00:00`) ?? new Date(`${dateValue}T00:00:00`);
  const nextStart = parseLisbonDateTimeInput(`${nextDateValue}T00:00`) ?? new Date(`${nextDateValue}T00:00:00`);
  const end = new Date(nextStart.getTime() - 1);

  return { dateValue, start, end };
}

function priorityRank(priority: MaintenanceTicketPriority) {
  const ranks: Record<MaintenanceTicketPriority, number> = {
    LOW: 0,
    NORMAL: 1,
    HIGH: 2,
    CRITICAL: 3,
  };

  return ranks[priority] ?? 0;
}

function byDate(left: Date | null | undefined, right: Date | null | undefined) {
  return (left?.getTime() ?? Number.MAX_SAFE_INTEGER) - (right?.getTime() ?? Number.MAX_SAFE_INTEGER);
}

function planHref(path: string) {
  return path;
}

export async function buildDailyPlanData(
  prisma: PrismaClient,
  viewer: DailyPlanViewer,
  filters: { date?: string; userId?: string } = {},
) {
  const { dateValue, start, end } = dailyPlanRange(filters.date);
  const teamViewAllowed = canViewTeamPlan(viewer.role);
  const selectedUserId = teamViewAllowed
    ? filters.userId && filters.userId !== "ALL"
      ? filters.userId
      : null
    : viewer.id;

  const users = teamViewAllowed
    ? await prisma.user.findMany({
        where: { active: true, role: { in: assignableRoles } },
        orderBy: { name: "asc" },
      })
    : [];

  const selectedUser = selectedUserId
    ? users.find((user) => user.id === selectedUserId) ?? (selectedUserId === viewer.id ? viewer : null)
    : null;

  const [tasks, schedules, tickets, urgentTickets, triageTickets] = await Promise.all([
    prisma.task.findMany({
      where: {
        status: { in: [...activeTaskStatuses] },
        OR: [{ dueDate: { lte: end } }, { nextDue: { lte: end } }],
        ...(selectedUserId ? { assignedToId: selectedUserId } : {}),
      },
      orderBy: [{ dueDate: "asc" }, { nextDue: "asc" }],
      include: { equipment: true, assignedTo: true },
    }),
    prisma.maintenanceSchedule.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: end },
        OR: [
          { workOrder: { is: null } },
          { workOrder: { is: { status: { in: [...activeWorkOrderStatuses] } } } },
        ],
        ...(selectedUserId ? { assignedToId: selectedUserId } : {}),
      },
      orderBy: { scheduledAt: "asc" },
      include: { equipment: true, assignedTo: true, workOrder: true },
    }),
    prisma.maintenanceTicket.findMany({
      where: {
        status: { in: [...activeTicketStatuses] },
        ...(selectedUserId ? { assignedToId: selectedUserId } : { assignedToId: { not: null } }),
      },
      orderBy: { openedAt: "asc" },
      include: { equipment: true, assignedTo: true, openedBy: true },
    }),
    prisma.maintenanceTicket.findMany({
      where: {
        status: { in: [...activeTicketStatuses] },
        priority: { in: urgentPriorities },
        ...(selectedUserId ? { assignedToId: selectedUserId } : {}),
      },
      orderBy: { openedAt: "asc" },
      include: { equipment: true, assignedTo: true, openedBy: true },
    }),
    teamViewAllowed
      ? prisma.maintenanceTicket.findMany({
          where: {
            status: { in: [...activeTicketStatuses] },
            assignedToId: null,
          },
          orderBy: { openedAt: "asc" },
          include: { equipment: true, openedBy: true },
        })
      : Promise.resolve([]),
  ]);

  const sortedTickets = [...tickets].sort((left, right) => {
    const priorityDiff = priorityRank(right.priority) - priorityRank(left.priority);
    return priorityDiff || left.openedAt.getTime() - right.openedAt.getTime();
  });
  const sortedUrgentTickets = [...urgentTickets].sort((left, right) => {
    const priorityDiff = priorityRank(right.priority) - priorityRank(left.priority);
    return priorityDiff || left.openedAt.getTime() - right.openedAt.getTime();
  });
  const sortedTasks = [...tasks].sort((left, right) => byDate(left.dueDate ?? left.nextDue, right.dueDate ?? right.nextDue));

  return {
    dateValue,
    dateLabel: formatDate(start),
    start,
    end,
    users,
    selectedUserId,
    selectedUser,
    isTeamView: teamViewAllowed && !selectedUserId,
    canViewTeam: teamViewAllowed,
    tasks: sortedTasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate,
      nextDue: task.nextDue,
      dueTime: task.dueTime,
      equipment: task.equipment ? { name: task.equipment.name } : null,
      assignedTo: task.assignedTo ? { name: task.assignedTo.name } : null,
      href: planHref(`/tarefas?taskId=${task.id}#task-${task.id}`),
      isLate: Boolean((task.dueDate ?? task.nextDue) && (task.dueDate ?? task.nextDue)! < start),
    })),
    schedules: schedules.map((schedule) => ({
      id: schedule.id,
      title: schedule.title,
      status: schedule.status,
      scheduledAt: schedule.scheduledAt,
      frequency: schedule.frequency,
      equipment: { name: schedule.equipment.name },
      assignedTo: schedule.assignedTo ? { name: schedule.assignedTo.name } : null,
      workOrder: schedule.workOrder ? { status: schedule.workOrder.status } : null,
      href: planHref(`/manutencao/${schedule.id}`),
      isLate: schedule.scheduledAt < start,
    })),
    tickets: sortedTickets.map((ticket) => ({
      id: ticket.id,
      number: ticket.number,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      openedAt: ticket.openedAt,
      equipment: { name: ticket.equipment.name },
      assignedTo: ticket.assignedTo ? { name: ticket.assignedTo.name } : null,
      openedBy: ticket.openedBy ? { name: ticket.openedBy.name } : null,
      href: planHref(`/tickets?ticketId=${ticket.id}#ticket-${ticket.id}`),
    })),
    urgentTickets: sortedUrgentTickets.map((ticket) => ({
      id: ticket.id,
      number: ticket.number,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      openedAt: ticket.openedAt,
      equipment: { name: ticket.equipment.name },
      assignedTo: ticket.assignedTo ? { name: ticket.assignedTo.name } : null,
      openedBy: ticket.openedBy ? { name: ticket.openedBy.name } : null,
      href: planHref(`/tickets?ticketId=${ticket.id}#ticket-${ticket.id}`),
    })),
    triageTickets: triageTickets.map((ticket) => ({
      id: ticket.id,
      number: ticket.number,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      openedAt: ticket.openedAt,
      equipment: { name: ticket.equipment.name },
      openedBy: ticket.openedBy ? { name: ticket.openedBy.name } : null,
      href: planHref(`/tickets?ticketId=${ticket.id}#ticket-${ticket.id}`),
    })),
  };
}

export function dailyPlanCount(plan: Awaited<ReturnType<typeof buildDailyPlanData>>) {
  return plan.tasks.length + plan.schedules.length + plan.tickets.length + plan.triageTickets.length;
}

export async function getDailyPlanData(viewer: DailyPlanViewer, filters: { date?: string; userId?: string } = {}) {
  const range = dailyPlanRange(filters.date);

  return readDb(
    (prisma) => buildDailyPlanData(prisma, viewer, filters),
    {
      dateValue: range.dateValue,
      dateLabel: formatDate(range.start),
      start: range.start,
      end: range.end,
      users: [],
      selectedUserId: canViewTeamPlan(viewer.role) ? filters.userId ?? null : viewer.id,
      selectedUser: null,
      isTeamView: canViewTeamPlan(viewer.role) && (!filters.userId || filters.userId === "ALL"),
      canViewTeam: canViewTeamPlan(viewer.role),
      tasks: [],
      schedules: [],
      tickets: [],
      urgentTickets: [],
      triageTickets: [],
    },
  );
}
