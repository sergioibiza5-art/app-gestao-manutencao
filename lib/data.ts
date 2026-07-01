import {
  environmentalEventZones,
  environmentalLimits,
  environmentalTypeLabel,
  humidityZones,
  pressureZones,
  temperatureZones,
  type EnvironmentalStatus,
} from "@/lib/environmental";
import { readDb } from "@/lib/prisma";

function dashboardRange(view?: string, dateValue?: string) {
  const today = new Date();
  const base = dateValue ? new Date(dateValue) : today;

  if (view === "year") {
    return {
      start: new Date(base.getFullYear(), 0, 1),
      end: new Date(base.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  }

  if (view === "week") {
    const start = new Date(base);
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  return {
    start: new Date(base.getFullYear(), base.getMonth(), 1),
    end: new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

export async function getDashboardData(filters?: { view?: string; date?: string }) {
  return readDb(
    async (prisma) => {
      const now = new Date();
      const range = dashboardRange(filters?.view, filters?.date);
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [
        tasksToday,
        criticalTasks,
        expenses,
        maintenanceToday,
        ticketAlerts,
        tasks,
        calendar,
        vehicles,
        calibrationLogs,
      ] = await Promise.all([
        prisma.task.count({
          where: {
            status: { in: ["PENDING", "IN_PROGRESS"] },
            OR: [{ dueDate: null }, { dueDate: { lte: now } }, { nextDue: { lte: now } }],
          },
        }),
        prisma.task.count({
          where: {
            status: { in: ["PENDING", "IN_PROGRESS"] },
            dueDate: { lte: now },
          },
        }),
        prisma.expense.aggregate({
          _sum: { amount: true },
          where: {
            date: {
              gte: monthStart,
              lt: monthEnd,
            },
          },
        }),
        prisma.maintenanceSchedule.count({
          where: {
            status: "SCHEDULED",
            scheduledAt: { gte: todayStart, lte: todayEnd },
          },
        }),
        prisma.maintenanceTicket.findMany({
          where: { status: "OPEN" },
          orderBy: { openedAt: "desc" },
          take: 6,
          include: { equipment: true, openedBy: true },
        }),
        prisma.task.findMany({
          where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
          orderBy: [{ dueDate: "asc" }, { nextDue: "asc" }],
          take: 4,
          include: { equipment: true },
        }),
        prisma.maintenanceSchedule.findMany({
          where: {
            status: "SCHEDULED",
            OR: [
              { scheduledAt: { gte: range.start, lte: range.end } },
              { scheduledAt: { lt: range.start } },
            ],
          },
          orderBy: { scheduledAt: "asc" },
          include: { equipment: true, workOrder: true },
        }),
        prisma.vehicle.findMany({
          orderBy: [{ brand: "asc" }, { model: "asc" }],
          include: {
            kmLogs: { orderBy: { date: "asc" } },
            services: { orderBy: { date: "desc" } },
            expenses: true,
          },
        }),
        prisma.calibrationLog.findMany({
          where: { nextDueDate: { not: null } },
          orderBy: { calibrationDate: "desc" },
          take: 400,
          include: { equipment: true },
        }),
      ]);
      const fleetAlerts = vehicles
        .map(enrichVehicle)
        .flatMap((vehicle) => [
          vehicle.metrics.estimatedRevisionDate || vehicle.metrics.kmUntilRevision !== null
            ? {
                id: `${vehicle.id}-revision`,
                type: "Revisão",
                title: `${vehicle.brand} ${vehicle.model}`,
                plate: vehicle.plate,
                dueDate: vehicle.metrics.estimatedRevisionDate ?? new Date(0),
                kmRemaining: vehicle.metrics.kmUntilRevision,
              }
            : null,
          vehicle.metrics.nextInspectionDate || vehicle.metrics.kmUntilInspection !== null
            ? {
                id: `${vehicle.id}-inspection`,
                type: "Inspeção",
                title: `${vehicle.brand} ${vehicle.model}`,
                plate: vehicle.plate,
                dueDate: vehicle.metrics.nextInspectionDate ?? new Date(0),
                kmRemaining: vehicle.metrics.kmUntilInspection,
              }
            : null,
        ])
        .filter((item) => item !== null)
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      const fleetDueLimit = new Date(now);
      fleetDueLimit.setDate(fleetDueLimit.getDate() + 30);
      const fleetDueSoon = fleetAlerts.filter((item) => item.dueDate <= fleetDueLimit || (item.kmRemaining !== null && item.kmRemaining <= 1000)).length;
      const calibrationDueLimit = new Date(now);
      calibrationDueLimit.setDate(calibrationDueLimit.getDate() + 60);
      const latestCalibrationByEquipment = Object.values(
        calibrationLogs.reduce<Record<string, (typeof calibrationLogs)[number]>>((acc, log) => {
          acc[log.equipmentId] ??= log;
          return acc;
        }, {}),
      );
      const calibrationAlerts = latestCalibrationByEquipment
        .filter((log) => log.nextDueDate && log.nextDueDate <= calibrationDueLimit)
        .sort((a, b) => (a.nextDueDate?.getTime() ?? 0) - (b.nextDueDate?.getTime() ?? 0));

      const operationalAlerts = [
  ...tasks
    .filter((task) => {
      const due = task.dueDate ?? task.nextDue;
      return due && due <= now;
    })
    .map((task) => ({
      id: `task-${task.id}`,
      type: "TASK",
      title: task.title,
      detail: task.equipment?.name ?? "Tarefa sem equipamento",
      status: task.status,
      date: task.dueDate ?? task.nextDue,
      href: `/tarefas?taskId=${task.id}`,
      tone: "teal",
    })),

  ...calibrationAlerts.map((log) => {
    const daysLeft = log.nextDueDate ? Math.ceil((log.nextDueDate.getTime() - todayStart.getTime()) / 86_400_000) : null;

    return {
      id: `calibration-${log.id}`,
      type: "CALIBRATION",
      title: log.title,
      detail: `${log.equipment.name}${daysLeft !== null ? ` - ${daysLeft < 0 ? "vencida" : `${daysLeft} dias restantes`}` : ""}`,
      status: daysLeft !== null && daysLeft < 0 ? "CALIBRATION_EXPIRED" : "CALIBRATION_DUE",
      date: log.nextDueDate,
      href: "/calibracao",
      tone: daysLeft !== null && daysLeft < 0 ? "rose" : daysLeft !== null && daysLeft <= 30 ? "amber" : "teal",
    };
  }),

  ...calendar
    .filter((schedule) => {
      const isLate = schedule.scheduledAt < todayStart && schedule.status === "SCHEDULED";
      const hasOpenOp =
        schedule.workOrder && ["OPEN", "IN_PROGRESS", "PAUSED", "SUSPENDED"].includes(schedule.workOrder.status);
      return isLate || hasOpenOp || !schedule.workOrder;
    })
    .map((schedule) => ({
      id: `schedule-${schedule.id}`,
      type: "MAINTENANCE",
      title: schedule.title,
      detail: schedule.equipment.name,
      status: schedule.workOrder?.status ?? "NO_OP",
      date: schedule.scheduledAt,
      href: `/manutencao?eventId=${schedule.id}`,
      tone: schedule.scheduledAt < todayStart ? "rose" : "amber",
    })),
].slice(0, 8);

      return {
        kpis: {
          tasksToday,
          criticalTasks,
          monthlyExpenses: expenses._sum.amount ?? 0,
          maintenanceToday,
          fleetDueSoon,
          openTickets: ticketAlerts.length,
        },
        tasks,
        calendar,
        fleetAlerts,
        calibrationAlerts,
        ticketAlerts,
        operationalAlerts,
        range,
      };
    },
    {
      kpis: {
        tasksToday: 8,
        criticalTasks: 3,
        monthlyExpenses: 1284,
        maintenanceToday: 0,
        fleetDueSoon: 0,
        openTickets: 0,
      },
      tasks: [],
      calendar: [],
      fleetAlerts: [],
      calibrationAlerts: [],
      ticketAlerts: [],
      operationalAlerts: [],
      range: dashboardRange(),
    },
  );
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function kpiRange(yearValue?: string, monthValue?: string) {
  const now = new Date();
  const year = yearValue && yearValue !== "all" ? Number(yearValue) : now.getFullYear();
  const month = monthValue && monthValue !== "all" ? Number(monthValue) : null;

  if (month !== null && Number.isFinite(month)) {
    return {
      selectedYear: String(year),
      selectedMonth: String(month),
      start: new Date(year, month - 1, 1),
      end: new Date(year, month, 0, 23, 59, 59, 999),
    };
  }

  return {
    selectedYear: String(year),
    selectedMonth: "all",
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31, 23, 59, 59, 999),
  };
}

function includesAny(value: string, words: string[]) {
  const normalized = value.toLowerCase();
  return words.some((word) => normalized.includes(word));
}

function secondsBetween(start: Date | null, end: Date | null) {
  if (!start || !end) return 0;
  return Math.max(Math.floor((end.getTime() - start.getTime()) / 1000), 0);
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Number(((value / total) * 100).toFixed(1));
}

export async function getKpiData(filters?: { year?: string; month?: string }) {
  return readDb(
    async (prisma) => {
      const range = kpiRange(filters?.year, filters?.month);
      const [equipmentCount, workOrders, tickets, years] = await Promise.all([
        prisma.equipment.count({ where: { status: { not: "DISCARDED" } } }),
        prisma.workOrder.findMany({
          where: { openedAt: { gte: range.start, lte: range.end } },
          include: { equipment: true, schedule: true, ticket: true },
          orderBy: { openedAt: "asc" },
        }),
        prisma.maintenanceTicket.findMany({
          where: { openedAt: { gte: range.start, lte: range.end } },
          include: { equipment: true, workOrder: true },
          orderBy: { openedAt: "asc" },
        }),
        prisma.workOrder.findMany({
          select: { openedAt: true },
          orderBy: { openedAt: "asc" },
          take: 5000,
        }),
      ]);

      const periodSeconds = Math.max(secondsBetween(range.start, range.end), 1);
      const failureTickets = tickets.filter((ticket) => ticket.status !== "CANCELED");
      const downtimeSeconds = failureTickets.reduce((sum, ticket) => {
        if (!ticket.machineStopped) return sum;
        const stored = Number(ticket.downtimeSeconds ?? 0);
        if (stored > 0) return sum + stored;
        return sum + secondsBetween(ticket.openedAt, ticket.completedAt ?? ticket.validatedAt ?? new Date());
      }, 0);

      const completedTickets = failureTickets.filter((ticket) => ticket.completedAt || ticket.validatedAt);
      const mttrSeconds =
        completedTickets.length > 0
          ? completedTickets.reduce((sum, ticket) => {
              const stored = Number(ticket.totalWorkSeconds ?? 0);
              if (stored > 0) return sum + stored;
              return sum + secondsBetween(ticket.startedAt ?? ticket.openedAt, ticket.completedAt ?? ticket.validatedAt);
            }, 0) / completedTickets.length
          : 0;

      const totalOperatingSeconds = Math.max(equipmentCount, 1) * periodSeconds;
      const mtbfHours = failureTickets.length > 0 ? (totalOperatingSeconds - downtimeSeconds) / failureTickets.length / 3600 : totalOperatingSeconds / 3600;
      const availability = percentage(Math.max(totalOperatingSeconds - downtimeSeconds, 0), totalOperatingSeconds);

      const preventiveWorkOrders = workOrders.filter((workOrder) =>
        includesAny(`${workOrder.title} ${workOrder.schedule?.costCenter ?? ""}`, ["prevent"]),
      );
      const preventivePercentage = percentage(preventiveWorkOrders.length, workOrders.length);

      const completedWorkOrders = workOrders.filter((workOrder) => ["DONE", "VALIDATED"].includes(workOrder.status));
      const scheduledCompleted = completedWorkOrders.filter((workOrder) => workOrder.schedule?.scheduledAt && workOrder.closedAt);
      const onTimeCompleted = scheduledCompleted.filter((workOrder) => workOrder.closedAt! <= endOfDay(workOrder.schedule!.scheduledAt));
      const onTimePercentage = percentage(onTimeCompleted.length, scheduledCompleted.length);

      const workOrdersByStatus = Object.values(
        workOrders.reduce<Record<string, { name: string; count: number }>>((acc, workOrder) => {
          acc[workOrder.status] ??= { name: workOrder.status, count: 0 };
          acc[workOrder.status].count += 1;
          return acc;
        }, {}),
      );

      const failuresByEquipment = Object.values(
        failureTickets.reduce<Record<string, { id: string; name: string; count: number; downtimeHours: number }>>((acc, ticket) => {
          const key = ticket.equipmentId;
          acc[key] ??= { id: key, name: ticket.equipment.name, count: 0, downtimeHours: 0 };
          acc[key].count += 1;
          if (!ticket.machineStopped) return acc;
          const stored = Number(ticket.downtimeSeconds ?? 0);
          acc[key].downtimeHours += (stored > 0 ? stored : secondsBetween(ticket.openedAt, ticket.completedAt ?? ticket.validatedAt ?? new Date())) / 3600;
          return acc;
        }, {}),
      ).sort((a, b) => b.count - a.count || b.downtimeHours - a.downtimeHours);

      const recurringProblems = Object.values(
        failureTickets.reduce<Record<string, { name: string; equipment: string; count: number }>>((acc, ticket) => {
          const key = `${ticket.equipmentId}-${ticket.title.toLowerCase()}`;
          acc[key] ??= { name: ticket.title, equipment: ticket.equipment.name, count: 0 };
          acc[key].count += 1;
          return acc;
        }, {}),
      ).sort((a, b) => b.count - a.count);

      return {
        selectedYear: range.selectedYear,
        selectedMonth: range.selectedMonth,
        years: Array.from(new Set(years.map((item) => item.openedAt.getFullYear()))).sort((a, b) => b - a),
        period: { start: range.start, end: range.end },
        cards: {
          mtbfHours,
          preventivePercentage,
          onTimePercentage,
          mttrHours: mttrSeconds / 3600,
          availability,
        },
        totals: {
          equipmentCount,
          workOrders: workOrders.length,
          completedWorkOrders: completedWorkOrders.length,
          failures: failureTickets.length,
          downtimeHours: downtimeSeconds / 3600,
        },
        workOrdersByStatus,
        failuresByEquipment,
        recurringProblems,
      };
    },
    {
      selectedYear: String(new Date().getFullYear()),
      selectedMonth: "all",
      years: [new Date().getFullYear()],
      period: kpiRange().start ? { start: kpiRange().start, end: kpiRange().end } : { start: new Date(), end: new Date() },
      cards: {
        mtbfHours: 0,
        preventivePercentage: 0,
        onTimePercentage: 0,
        mttrHours: 0,
        availability: 0,
      },
      totals: {
        equipmentCount: 0,
        workOrders: 0,
        completedWorkOrders: 0,
        failures: 0,
        downtimeHours: 0,
      },
      workOrdersByStatus: [],
      failuresByEquipment: [],
      recurringProblems: [],
    },
  );
}

export async function getModuleData() {
  return readDb(
    async (prisma) => {
      const [
        expenses,
        monthlyBills,
        tasks,
        equipment,
        maintenanceLogs,
        calibrationLogs,
        consumables,
        documents,
        users,
        sgqRecords,
        equipmentTypes,
        vehicles,
      ] = await Promise.all([
        prisma.expense.findMany({ orderBy: { date: "desc" }, include: { equipment: true, vehicle: true, documents: true } }),
        prisma.monthlyBill.findMany({ orderBy: { name: "asc" }, take: 50 }),
        prisma.task.findMany({ orderBy: [{ status: "asc" }, { dueDate: "asc" }], take: 80, include: { equipment: true } }),
        prisma.equipment.findMany({
          orderBy: { name: "asc" },
          include: {
           interventionPlans: true,
            equipmentType: true,
           tickets: {
              where: {
                status: {
                  in: ["IN_PROGRESS", "PAUSED"],
                },
              },
              select: {
                id: true,
              },
            },
            maintenanceSchedules: {
  where: {
    workOrder: {
      status: {
        in: ["IN_PROGRESS", "PAUSED", "SUSPENDED"],
      },
    },
  },
  select: {
    id: true,
    workOrder: {
      select: {
        id: true,
        status: true,
      },
    },
  },
},
          },
      }),
        prisma.maintenanceLog.findMany({ orderBy: { date: "desc" }, take: 40, include: { equipment: true } }),
        prisma.calibrationLog.findMany({ orderBy: { calibrationDate: "desc" }, take: 200, include: { equipment: true, documents: true } }),
        prisma.consumable.findMany({ orderBy: { name: "asc" }, take: 100, include: { equipment: true } }),
        prisma.document.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { equipment: true, vehicle: true } }),
        prisma.user.findMany({
          orderBy: { name: "asc" },
          take: 50,
          include: { ticketEquipmentAccess: { include: { equipment: true } } },
        }),
        prisma.sGQRecord.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.equipmentType.findMany({ orderBy: { name: "asc" }, include: { checklistTemplates: { where: { active: true }, include: { items: true } } } }),
        prisma.vehicle.findMany({ orderBy: [{ brand: "asc" }, { model: "asc" }], take: 100 }),
      ]);

      return { expenses, monthlyBills, tasks, equipment, maintenanceLogs, calibrationLogs, consumables, documents, users, sgqRecords, equipmentTypes, vehicles };
    },
    {
      expenses: [],
      monthlyBills: [],
      tasks: [],
      equipment: [],
      maintenanceLogs: [],
      calibrationLogs: [],
      consumables: [],
      documents: [],
      users: [],
      sgqRecords: [],
      equipmentTypes: [],
      vehicles: [],
    },
  );
}

export async function getEquipmentDetail(id: string) {
  return readDb(
    async (prisma) => {
      const equipment = await prisma.equipment.findUnique({
        where: { id },
        include: {
          interventionPlans: { orderBy: [{ kind: "asc" }, { type: "asc" }] },
          parentEquipment: true,
          childEquipment: { orderBy: { name: "asc" } },
          interventionLogs: { orderBy: { performedAt: "desc" }, take: 50 },
          equipmentType: {
            include: {
              dl50Templates: {
                where: { active: true },
                orderBy: { createdAt: "desc" },
              },
              checklistTemplates: {
                where: { active: true },
                orderBy: { createdAt: "desc" },
                include: { items: { where: { active: true }, orderBy: { order: "asc" } } },
              },
            },
          },
          internalMaintenanceRecords: {
            orderBy: { performedAt: "desc" },
            take: 20,
            include: {
              template: true,
              responses: {
                include: {
                  item: true,
                  photos: true,
                },
              },
            },
          },
          maintenanceLogs: { orderBy: { date: "desc" }, take: 50, include: { user: true } },
maintenanceSchedules: {
  orderBy: { scheduledAt: "asc" },
  take: 50,
  include: {
    workOrder: true,
  },
},

tickets: {
  orderBy: { openedAt: "desc" },
  select: {
    id: true,
    status: true,
    totalCost: true,
  },
},
workOrders: {
  orderBy: { openedAt: "desc" },
  select: {
    id: true,
    status: true,
  },
},

calibrationLogs: { orderBy: { calibrationDate: "desc" }, take: 30, include: { documents: true } },
expenses: { orderBy: { date: "desc" }, include: { documents: true } },
documents: { orderBy: { createdAt: "desc" }, take: 30 },
consumables: { orderBy: { name: "asc" }, take: 50 },
dl50Assessments: {
  orderBy: { version: "desc" },
  include: {
    createdBy: { select: { id: true, name: true } },
    document: true,
  },
},
        },
      });

      return equipment;
    },
    null,
  );
}

export async function getExpenseDetail(id: string) {
  return readDb(
    async (prisma) =>
      prisma.expense.findUnique({
        where: { id },
        include: {
          equipment: true,
          vehicle: true,
          documents: true,
        },
      }),
    null,
  );
}

export async function getConsumableDetail(id: string) {
  return readDb(
    async (prisma) =>
      prisma.consumable.findUnique({
        where: { id },
        include: {
          equipment: true,
          movements: {
            orderBy: { date: "desc" },
            take: 80,
            include: {
              user: true,
              ticket: { include: { equipment: true, workOrder: true } },
              workOrder: true,
            },
          },
          ticketUsages: {
            orderBy: { createdAt: "desc" },
            take: 50,
            include: {
              ticket: {
                include: {
                  equipment: true,
                  workOrder: true,
                },
              },
            },
          },
        },
      }),
    null,
  );
}

export async function getChecklistAdminData() {
  return readDb(
    async (prisma) => {
      const equipmentTypes = await prisma.equipmentType.findMany({
        orderBy: { name: "asc" },
        include: {
          checklistTemplates: {
            orderBy: { createdAt: "desc" },
            include: { items: { orderBy: { order: "asc" } } },
          },
        },
      });

      return { equipmentTypes };
    },
    { equipmentTypes: [] },
  );
}

export async function getEquipmentTypes() {
  return readDb(
    async (prisma) =>
      prisma.equipmentType.findMany({
        orderBy: { name: "asc" },
        include: {
          dl50Templates: { where: { active: true }, orderBy: { createdAt: "desc" } },
          checklistTemplates: { where: { active: true }, include: { items: true } },
        },
      }),
    [],
  );
}

export async function getEquipmentOptions() {
  return readDb(
    async (prisma) =>
      prisma.equipment.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true, isMeasurementMonitoring: true, equipmentTypeId: true },
      }),
    [],
  );
}

export async function getInternalMaintenanceRecord(equipmentId: string, recordId: string) {
  return readDb(
    async (prisma) =>
      prisma.internalMaintenanceRecord.findFirst({
        where: { id: recordId, equipmentId },
        include: {
          equipment: { include: { equipmentType: true } },
          template: true,
          workOrder: {
  include: {
    documents: true,
  },
},
          responses: {
            orderBy: { item: { order: "asc" } },
            include: {
              item: true,
              photos: true,
            },
          },
        },
      }),
    null,
  );
}

function getMaintenanceRange(view: string, dateValue?: string) {
  const base = dateValue ? new Date(dateValue) : new Date();
  const start = new Date(base);
  const end = new Date(base);

  if (view === "day") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (view === "week") {
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (view === "year") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  end.setMonth(end.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function getMaintenanceData(filters: {
  view?: string;
  date?: string;
  type?: string;
  equipmentId?: string;
}) {
  const view = filters.view || "month";
  const { start, end } = getMaintenanceRange(view, filters.date);
  const type = filters.type === "INTERNAL" || filters.type === "EXTERNAL" ? filters.type : undefined;
const equipmentId =
  filters.equipmentId && filters.equipmentId !== "ALL"
    ? filters.equipmentId
    : undefined;
  return readDb(
    async (prisma) => {
      const [equipment, maintenanceLogs, schedules] = await Promise.all([
        prisma.equipment.findMany({
  where: {
    status: { not: "DISCARDED" },
  },
  orderBy: [
    { name: "asc" },
    { code: "asc" },
  ],
}),
        prisma.maintenanceLog.findMany({ orderBy: { date: "desc" }, take: 40, include: { equipment: true } }),
        prisma.maintenanceSchedule.findMany({
          where: {
  OR: [
    { scheduledAt: { gte: start, lte: end } },
    { scheduledAt: { lt: start }, status: "SCHEDULED" },
  ],
  ...(type ? { type } : {}),
  ...(equipmentId ? { equipmentId } : {}),
},
          orderBy: { scheduledAt: "asc" },
          include: { equipment: true, workOrder: true },
          take: 370,
        }),
      ]);

      return { equipment, maintenanceLogs, schedules, range: { start, end }, view, type };
    },
    { equipment: [], maintenanceLogs: [], schedules: [], range: { start, end }, view, type },
  );
}

export async function getMaintenanceScheduleDetail(id: string) {
  return readDb(
    async (prisma) => {
      const [schedule, consumableOptions] = await Promise.all([
        prisma.maintenanceSchedule.findUnique({
        where: { id },
        include: {
          equipment: {
            include: {
              equipmentType: {
                include: {
                  checklistTemplates: {
                    where: { active: true },
                    orderBy: { createdAt: "desc" },
                    include: { items: { where: { active: true }, orderBy: { order: "asc" } } },
                  },
                },
              },
            },
          },
          workOrder: {
            include: {
              template: { include: { items: { where: { active: true }, orderBy: { order: "asc" } } } },
              documents: { orderBy: { createdAt: "desc" } },
              checklistRecord: { include: { responses: { include: { item: true, photos: true } } } },
              maintenanceLog: true,
              consumableMovements: {
                orderBy: { createdAt: "asc" },
                include: { consumable: true, user: true },
              },
            },
          },
        },
      }),
        prisma.consumable.findMany({ orderBy: { name: "asc" }, take: 300 }),
      ]);

      return schedule ? { ...schedule, consumableOptions } : null;
    },
    null,
  );
}

function daysBetween(start: Date, end: Date) {
  const diff = Math.abs(end.getTime() - start.getTime());
  return Math.max(Math.ceil(diff / 86_400_000), 1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function enrichVehicle<
  T extends {
    kmLogs: { date: Date; odometer: number }[];
    services: { type: string; nextDueKm: number | null; nextDueDate: Date | null; cost: unknown }[];
    expenses?: { amount: unknown }[];
  },
>(vehicle: T) {
  const sortedKm = [...vehicle.kmLogs].sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstKm = sortedKm[0];
  const lastKm = sortedKm[sortedKm.length - 1];
  const totalKm = firstKm && lastKm ? Math.max(lastKm.odometer - firstKm.odometer, 0) : 0;
  const totalDays = firstKm && lastKm ? daysBetween(firstKm.date, lastKm.date) : 1;
  const averageKmDay = totalKm / totalDays;
  const latestRevision = vehicle.services.find((service) => service.type === "REVISION" && (service.nextDueKm || service.nextDueDate));
  const latestInspection = vehicle.services.find((service) => service.type === "INSPECTION" && (service.nextDueKm || service.nextDueDate));
  const kmUntilRevision = latestRevision?.nextDueKm && lastKm ? latestRevision.nextDueKm - lastKm.odometer : null;
  const kmUntilInspection = latestInspection?.nextDueKm && lastKm ? latestInspection.nextDueKm - lastKm.odometer : null;
  const estimatedRevisionDate =
    kmUntilRevision !== null && kmUntilRevision > 0 && averageKmDay > 0
      ? addDays(lastKm!.date, Math.ceil(kmUntilRevision / averageKmDay))
      : latestRevision?.nextDueDate ?? null;
  const estimatedInspectionDate =
    kmUntilInspection !== null && kmUntilInspection > 0 && averageKmDay > 0
      ? addDays(lastKm!.date, Math.ceil(kmUntilInspection / averageKmDay))
      : latestInspection?.nextDueDate ?? null;
  const serviceCost = vehicle.services.reduce((sum, service) => sum + Number(service.cost ?? 0), 0);
  const invoiceCost = vehicle.expenses?.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0) ?? 0;
  const totalCost = serviceCost + invoiceCost;
  return {
    ...vehicle,
    metrics: {
      latestKm: lastKm?.odometer ?? 0,
      averageKmDay,
      averageKmMonth: averageKmDay * 30,
      averageKmYear: averageKmDay * 365,
      estimatedRevisionDate,
      kmUntilRevision,
      kmUntilInspection,
      serviceCost,
      invoiceCost,
      totalCost,
      nextInspectionDate: estimatedInspectionDate,
    },
  };
}

export async function getFleetData() {
  return readDb(
    async (prisma) => {
      const vehicles = await prisma.vehicle.findMany({
        orderBy: [{ brand: "asc" }, { model: "asc" }],
        include: {
          kmLogs: { orderBy: { date: "asc" } },
          services: { orderBy: { date: "desc" } },
          expenses: { orderBy: { date: "desc" }, take: 50, include: { documents: true } },
          documents: { orderBy: { createdAt: "desc" }, take: 30 },
        },
      });

      const enrichedVehicles = vehicles.map(enrichVehicle);

      return { vehicles: enrichedVehicles };
    },
    { vehicles: [] },
  );
}

export async function getVehicleDetail(id: string) {
  return readDb(
    async (prisma) => {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id },
        include: {
          kmLogs: { orderBy: { date: "asc" } },
          services: { orderBy: { date: "desc" } },
          expenses: { orderBy: { date: "desc" }, take: 50, include: { documents: true } },
          documents: { orderBy: { createdAt: "desc" }, take: 30 },
        },
      });

      return vehicle ? enrichVehicle(vehicle) : null;
    },
    null,
  );
}
export async function getAnalyticsData(filters?: {
  year?: string;
  month?: string;
  supplier?: string;
  costCenter?: string;
  equipmentId?: string;
}) {
  return readDb(
    async (prisma) => {
      const allExpenses = await prisma.expense.findMany({
        orderBy: { date: "desc" },
        include: {
          equipment: true,
          vehicle: true,
        },
      });

      const years = Array.from(
        new Set(allExpenses.map((expense) => expense.date.getFullYear())),
      ).sort((a, b) => b - a);

      const selectedYear = filters?.year || "all";
      const selectedMonth = filters?.month || "all";
      const selectedSupplier = filters?.supplier || "all";
      const selectedCostCenter = filters?.costCenter || "all";
      const selectedEquipmentId = filters?.equipmentId || "all";

      const expenses = allExpenses.filter((expense) => {
        const expenseYear = expense.date.getFullYear();
        const expenseMonth = expense.date.getMonth() + 1;
        const expenseCostCenter = expense.costCenter || expense.category || "Sem centro de custo";
        const expenseEquipmentId = expense.equipment?.id || expense.vehicle?.id || "none";

        return (
          (selectedYear === "all" || expenseYear === Number(selectedYear)) &&
          (selectedMonth === "all" || expenseMonth === Number(selectedMonth)) &&
          (selectedSupplier === "all" || expense.supplier === selectedSupplier) &&
          (selectedCostCenter === "all" || expenseCostCenter === selectedCostCenter) &&
          (selectedEquipmentId === "all" || expenseEquipmentId === selectedEquipmentId)
        );
      });

      const budgetYear = selectedYear === "all" ? new Date().getFullYear() : Number(selectedYear);

      const budgets = await prisma.budget.findMany({
        where: {
          year: budgetYear,
        },
      });

      const totalExpenses = expenses.reduce(
        (sum, expense) => sum + Number(expense.amount ?? 0),
        0,
      );

      const totalBudget = budgets.reduce(
        (sum, budget) => sum + Number(budget.planned ?? 0),
        0,
      );

      const bySupplier = Object.values(
        expenses.reduce<Record<string, { name: string; total: number; count: number }>>((acc, expense) => {
          const key = expense.supplier || "Sem fornecedor";
          acc[key] ??= { name: key, total: 0, count: 0 };
          acc[key].total += Number(expense.amount ?? 0);
          acc[key].count += 1;
          return acc;
        }, {}),
      ).sort((a, b) => b.total - a.total);

      const byCostCenter = Object.values(
        expenses.reduce<Record<string, { name: string; total: number; count: number }>>((acc, expense) => {
          const key = expense.costCenter || expense.category || "Sem centro de custo";
          acc[key] ??= { name: key, total: 0, count: 0 };
          acc[key].total += Number(expense.amount ?? 0);
          acc[key].count += 1;
          return acc;
        }, {}),
      ).sort((a, b) => b.total - a.total);

      const byEquipment = Object.values(
        expenses.reduce<Record<string, { id: string; name: string; code: string; total: number; count: number }>>((acc, expense) => {
          const id = expense.equipment?.id || expense.vehicle?.id || "none";
          const name =
            expense.equipment?.name ||
            (expense.vehicle ? `${expense.vehicle.brand} ${expense.vehicle.model}` : "Sem equipamento");

          const code = expense.equipment?.code || expense.vehicle?.plate || "—";

          acc[id] ??= { id, name, code, total: 0, count: 0 };
          acc[id].total += Number(expense.amount ?? 0);
          acc[id].count += 1;
          return acc;
        }, {}),
      ).sort((a, b) => b.total - a.total);

      return {
        years,
        selectedYear,
        selectedMonth,
        selectedSupplier,
        selectedCostCenter,
        selectedEquipmentId,
        totalBudget,
        totalExpenses,
        remainingBudget: totalBudget - totalExpenses,
        bySupplier,
        byCostCenter,
        byEquipment,
        suppliers: bySupplier.map((item) => item.name),
        costCenters: byCostCenter.map((item) => item.name),
        equipmentOptions: byEquipment,
      };
    },
    {
      years: [],
      selectedYear: "all",
      selectedMonth: "all",
      selectedSupplier: "all",
      selectedCostCenter: "all",
      selectedEquipmentId: "all",
      totalBudget: 0,
      totalExpenses: 0,
      remainingBudget: 0,
      bySupplier: [],
      byCostCenter: [],
      byEquipment: [],
      suppliers: [],
      costCenters: [],
      equipmentOptions: [],
    },
  );
}

export async function getTicketsData(user?: { id: string; role: string }) {
  return readDb(
    async (prisma) => {
      const isTicketOnly = user?.role === "TICKET";

      const [tickets, equipmentAccess, allEquipment, consumables, notifications] = await Promise.all([
        prisma.maintenanceTicket.findMany({
          where: isTicketOnly ? { openedById: user.id } : undefined,
          orderBy: { openedAt: "desc" },
          include: {
            equipment: true,
            openedBy: true,
            assignedTo: true,
            startedBy: true,
            completedBy: true,
            validatedBy: true,
            workOrder: true,
            consumables: { include: { consumable: true } },
          },
        }),

        isTicketOnly
          ? prisma.ticketEquipmentAccess.findMany({
              where: { userId: user.id },
              orderBy: { equipment: { name: "asc" } },
              include: { equipment: true },
            })
          : Promise.resolve([]),

        !isTicketOnly
          ? prisma.equipment.findMany({
              orderBy: { name: "asc" },
              take: 500,
            })
          : Promise.resolve([]),

        prisma.consumable.findMany({ orderBy: { name: "asc" }, take: 300 }),

        user
          ? prisma.notification.findMany({
              where: { userId: user.id, readAt: null },
              orderBy: { createdAt: "desc" },
              take: 8,
            })
          : Promise.resolve([]),
      ]);

      const equipment = isTicketOnly
        ? equipmentAccess.map((access) => access.equipment)
        : allEquipment;

      const openTicketSignatures = tickets
        .filter((ticket) => ticket.status === "OPEN")
        .map((ticket) => ({
          number: ticket.number,
          body: `${ticket.equipment.name}: ${ticket.title}`,
        }));

      const ticketNotifications = notifications.filter((notification) =>
        openTicketSignatures.some((ticket) =>
          notification.title === `Novo ticket ${ticket.number}` &&
          (!notification.body || notification.body === ticket.body),
        ),
      );

      const closedTickets = tickets.filter(
        (ticket) => ticket.machineStopped && (ticket.downtimeSeconds > 0 || ticket.completedAt),
      );

      const averageRepairSeconds =
        closedTickets.length > 0
          ? closedTickets.reduce((sum, ticket) => {
              if (ticket.downtimeSeconds > 0) return sum + ticket.downtimeSeconds;

              return sum + Math.max(
                Math.floor((ticket.completedAt!.getTime() - ticket.openedAt.getTime()) / 1000),
                0,
              );
            }, 0) / closedTickets.length
          : 0;

      const repeatedProblems = Object.values(
        tickets.reduce<Record<string, { name: string; count: number }>>((acc, ticket) => {
          const key = ticket.title || ticket.problem.slice(0, 60);
          acc[key] ??= { name: key, count: 0 };
          acc[key].count += 1;
          return acc;
        }, {}),
      ).sort((a, b) => b.count - a.count);

      const byEquipment = Object.values(
        tickets.reduce<Record<string, { name: string; count: number }>>((acc, ticket) => {
          const key = ticket.equipmentId;
          acc[key] ??= { name: ticket.equipment.name, count: 0 };
          acc[key].count += 1;
          return acc;
        }, {}),
      ).sort((a, b) => b.count - a.count);

      return {
        tickets,
        equipment,
        consumables,
        notifications: ticketNotifications,
        unreadNotifications: ticketNotifications.length,
        kpis: {
          open: tickets.filter((ticket) => ticket.status === "OPEN").length,
          inProgress: tickets.filter((ticket) => ticket.status === "IN_PROGRESS" || ticket.status === "PAUSED").length,
          waitingValidation: tickets.filter((ticket) => ticket.status === "DONE").length,
          validated: tickets.filter((ticket) => ticket.status === "VALIDATED").length,
          averageRepairHours: averageRepairSeconds / 3600,
          repeatedProblems: repeatedProblems.slice(0, 5),
          byEquipment: byEquipment.slice(0, 5),
        },
      };
    },
    {
      tickets: [],
      equipment: [],
      consumables: [],
      notifications: [],
      unreadNotifications: 0,
      kpis: {
        open: 0,
        inProgress: 0,
        waitingValidation: 0,
        validated: 0,
        averageRepairHours: 0,
        repeatedProblems: [],
        byEquipment: [],
      },
    },
  );
}

export async function getVacationsData(year: number) {
  return readDb(
    async (prisma) => {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59, 999);
      const [vacations, users] = await Promise.all([
        prisma.vacation.findMany({
          where: {
            startDate: { lte: end },
            endDate: { gte: start },
          },
          orderBy: [{ startDate: "asc" }, { employeeName: "asc" }],
          include: { user: true },
        }),
        prisma.user.findMany({
          where: { active: true, role: { in: ["ADMIN", "MANAGER", "USER", "SGQ"] } },
          orderBy: { name: "asc" },
        }),
      ]);

      return { vacations, users };
    },
    {
      vacations: [],
      users: [],
    },
  );
}

function environmentalRange(days?: string) {
  const span = Math.max(Number(days || 7), 1);
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - span);
  return { start, end, span };
}

function readingValue(reading: { value: unknown }) {
  return Number(reading.value ?? 0);
}

type EnvironmentalSchedule = {
  alertStartTime: string;
  alertEndTime: string;
  includeSaturday: boolean;
  includeSunday: boolean;
};

const defaultEnvironmentalSchedule: EnvironmentalSchedule = {
  alertStartTime: "06:00",
  alertEndTime: "22:00",
  includeSaturday: false,
  includeSunday: false,
};

function minutesFromTime(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function isInsideEnvironmentalSchedule(date: Date, schedule: EnvironmentalSchedule) {
  const day = date.getDay();
  if (day === 0 && !schedule.includeSunday) return false;
  if (day === 6 && !schedule.includeSaturday) return false;

  const start = minutesFromTime(schedule.alertStartTime);
  const end = minutesFromTime(schedule.alertEndTime);
  const current = date.getHours() * 60 + date.getMinutes();

  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

function sensorStats(readings: { timestamp: Date; value: unknown }[], type: string, schedule: EnvironmentalSchedule) {
  const values = readings.map(readingValue).filter((value) => Number.isFinite(value));
  const average = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;
  const limits = environmentalLimits(type);
  const ignoreLowPressure = type === "PRESSURE" && average < 1.5;
  const alertReadings = readings.filter((reading) => isInsideEnvironmentalSchedule(reading.timestamp, schedule));
  const ordered = [...alertReadings].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  let currentSeconds = 0;
  let maxSeconds = 0;
  let events = 0;

  for (let index = 0; index < ordered.length; index += 1) {
    const value = readingValue(ordered[index]);
    const outOfRange = !ignoreLowPressure && (value < limits.min || value > limits.max);
    const next = ordered[index + 1];
    const interval = next
      ? Math.max(Math.min(Math.floor((next.timestamp.getTime() - ordered[index].timestamp.getTime()) / 1000), 3600), 0)
      : 0;

    if (outOfRange) {
      currentSeconds += interval;
      maxSeconds = Math.max(maxSeconds, currentSeconds);
    } else {
      if (currentSeconds >= limits.actionSeconds) events += 1;
      currentSeconds = 0;
    }
  }

  if (currentSeconds >= limits.actionSeconds) events += 1;

  const alertValues = alertReadings.map(readingValue).filter((value) => Number.isFinite(value));
  const occurrences = ignoreLowPressure ? 0 : alertValues.filter((value) => value < limits.min || value > limits.max).length;
  const status: EnvironmentalStatus = maxSeconds >= limits.actionSeconds ? "ACTION" : occurrences > 0 ? "ALERT" : "OK";

  return {
    min,
    max,
    average,
    count: values.length,
    alertReadingsCount: alertReadings.length,
    status,
    outOfRangeSeconds: maxSeconds,
    occurrences,
    events,
    ignoreLowPressure,
  };
}

function environmentalActionEvents(
  readings: { timestamp: Date; value: unknown }[],
  type: string,
  zone: string,
  schedule: EnvironmentalSchedule,
  ignoreLowPressure: boolean,
) {
  const limits = environmentalLimits(type);
  const ordered = readings
    .filter((reading) => isInsideEnvironmentalSchedule(reading.timestamp, schedule))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const events: Array<{
    zone: string;
    type: string;
    label: string;
    startedAt: Date;
    endedAt: Date;
    durationSeconds: number;
    min: number;
    max: number;
    readingsCount: number;
    limit: string;
  }> = [];
  let current: { startedAt: Date; endedAt: Date; seconds: number; values: number[] } | null = null;

  for (let index = 0; index < ordered.length; index += 1) {
    const reading = ordered[index];
    const value = readingValue(reading);
    const next = ordered[index + 1];
    const interval = next
      ? Math.max(Math.min(Math.floor((next.timestamp.getTime() - reading.timestamp.getTime()) / 1000), 3600), 0)
      : 0;
    const outOfRange = !ignoreLowPressure && (value < limits.min || value > limits.max);

    if (outOfRange) {
      current ??= { startedAt: reading.timestamp, endedAt: reading.timestamp, seconds: 0, values: [] };
      current.endedAt = next?.timestamp ?? reading.timestamp;
      current.seconds += interval;
      current.values.push(value);
      continue;
    }

    if (current && current.seconds >= limits.actionSeconds) {
      events.push({
        zone,
        type,
        label: environmentalTypeLabel(type),
        startedAt: current.startedAt,
        endedAt: current.endedAt,
        durationSeconds: current.seconds,
        min: Math.min(...current.values),
        max: Math.max(...current.values),
        readingsCount: current.values.length,
        limit: type === "PRESSURE" ? "< 5 Pa" : type === "TEMPERATURE" ? "< 15 C ou > 25 C" : "< 30% ou > 70%",
      });
    }
    current = null;
  }

  if (current && current.seconds >= limits.actionSeconds) {
    events.push({
      zone,
      type,
      label: environmentalTypeLabel(type),
      startedAt: current.startedAt,
      endedAt: current.endedAt,
      durationSeconds: current.seconds,
      min: Math.min(...current.values),
      max: Math.max(...current.values),
      readingsCount: current.values.length,
      limit: type === "PRESSURE" ? "< 5 Pa" : type === "TEMPERATURE" ? "< 15 C ou > 25 C" : "< 30% ou > 70%",
    });
  }

  return events;
}

export async function getEnvironmentalData(filters?: { days?: string; type?: string; zone?: string; status?: string; importId?: string }) {
  return readDb(
    async (prisma) => {
      const range = environmentalRange(filters?.days);
      const selectedType = filters?.type || "ALL";
      const selectedZone = filters?.zone || "ALL";
      const selectedStatus = filters?.status || "ALL";
      const selectedImportId = filters?.importId || "ALL";
      const where = {
        timestamp: { gte: range.start, lte: range.end },
        ...(selectedType !== "ALL" ? { type: selectedType } : {}),
        ...(selectedZone !== "ALL" ? { zone: selectedZone } : {}),
        ...(selectedImportId !== "ALL" ? { importId: selectedImportId } : {}),
      };
      const [readings, imports, settingsRow] = await Promise.all([
        prisma.environmentalReading.findMany({
          where,
          orderBy: { timestamp: "asc" },
          take: 80_000,
        }),
        prisma.environmentalImport.findMany({
          orderBy: { importedAt: "desc" },
          take: 100,
        }),
        prisma.environmentalSettings.findUnique({ where: { id: "default" } }),
      ]);
      const settings = settingsRow ?? defaultEnvironmentalSchedule;

      type Reading = (typeof readings)[number];

      const groupByZone = (type: string, zones: readonly string[]) => {
        const byZone = readings
          .filter((reading) => reading.type === type)
          .reduce<Record<string, Reading[]>>((acc, reading) => {
            acc[reading.zone] ??= [];
            acc[reading.zone].push(reading);
            return acc;
          }, {});

        return zones.map((zone) => {
          const zoneReadings = byZone[zone] ?? [];
          return {
            zone,
            type,
            label: environmentalTypeLabel(type),
            ...sensorStats(zoneReadings, type, settings),
          };
        });
      };

      const pressureRows = groupByZone("PRESSURE", pressureZones).map((row) => ({
        ...row,
        lowPressureOccurrences: row.occurrences,
        events40min: row.events,
      }));
      const temperatureRows = groupByZone("TEMPERATURE", temperatureZones);
      const humidityRows = groupByZone("HUMIDITY", humidityZones);

      const eventRows = environmentalEventZones.map((zone) => {
        const pressure = pressureRows.find((row) => row.zone === zone);
        const temperature = temperatureRows.find((row) => row.zone === zone);
        const humidity = humidityRows.find((row) => row.zone === zone);

        return {
          zone,
          pressureEvents40min: pressure?.events ?? 0,
          temperatureEvents24h: temperature?.events ?? 0,
          humidityEvents24h: humidity?.events ?? 0,
        };
      });

      const byZone = Object.values(
        readings.reduce<Record<string, { zone: string; type: string; readings: Reading[] }>>((acc, reading) => {
          const key = `${reading.type}-${reading.zone}`;
          acc[key] ??= { zone: reading.zone, type: reading.type, readings: [] };
          acc[key].readings.push(reading);
          return acc;
        }, {}),
      ).map((item) => ({
        zone: item.zone,
        type: item.type,
        label: environmentalTypeLabel(item.type),
        ...sensorStats(item.readings, item.type, settings),
      })).sort((a, b) => a.type.localeCompare(b.type) || a.zone.localeCompare(b.zone));
      const filteredByZone = selectedStatus === "ALL" ? byZone : byZone.filter((item) => item.status === selectedStatus);
      const filterRowsByStatus = <T extends { status: string }>(rows: T[]) =>
        selectedStatus === "ALL" ? rows : rows.filter((item) => item.status === selectedStatus);
      const actionEvents = Object.values(
        readings.reduce<Record<string, { zone: string; type: string; readings: Reading[] }>>((acc, reading) => {
          const key = `${reading.type}-${reading.zone}`;
          acc[key] ??= { zone: reading.zone, type: reading.type, readings: [] };
          acc[key].readings.push(reading);
          return acc;
        }, {}),
      ).flatMap((item) => {
        const stats = sensorStats(item.readings, item.type, settings);
        return environmentalActionEvents(item.readings, item.type, item.zone, settings, stats.ignoreLowPressure);
      }).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

      const byType = ["TEMPERATURE", "HUMIDITY", "PRESSURE"].map((type) => {
        const items = filteredByZone.filter((item) => item.type === type);
        const weightedCount = items.reduce((sum, item) => sum + item.count, 0);
        const average = weightedCount > 0
          ? items.reduce((sum, item) => sum + item.average * item.count, 0) / weightedCount
          : 0;

        return {
          type,
          label: environmentalTypeLabel(type),
          min: items.length > 0 ? Math.min(...items.map((item) => item.min)) : 0,
          max: items.length > 0 ? Math.max(...items.map((item) => item.max)) : 0,
          average,
          alerts: items.filter((item) => item.status === "ALERT").length,
          actions: items.filter((item) => item.status === "ACTION").length,
        };
      });

      const hourly = Object.values(
        readings.reduce<Record<string, { hour: string; values: number[] }>>((acc, reading) => {
          const hour = `${reading.timestamp.getDate().toString().padStart(2, "0")}/${(reading.timestamp.getMonth() + 1).toString().padStart(2, "0")} ${reading.timestamp.getHours().toString().padStart(2, "0")}h`;
          acc[hour] ??= { hour, values: [] };
          acc[hour].values.push(readingValue(reading));
          return acc;
        }, {}),
      ).map((item) => ({
        hour: item.hour,
        average: item.values.reduce((sum, value) => sum + value, 0) / Math.max(item.values.length, 1),
      })).slice(-24);

      const totalAlerts = filteredByZone.filter((item) => item.status === "ALERT").length;
      const totalActions = filteredByZone.filter((item) => item.status === "ACTION").length;
      const zones = Array.from(new Set(readings.map((reading) => reading.zone))).sort();

      return {
        readingsCount: readings.length,
        range,
        selectedType,
        selectedZone,
        selectedStatus,
        selectedImportId,
        settings,
        zones,
        bySensor: filteredByZone,
        byType,
        pressureRows: filterRowsByStatus(pressureRows),
        temperatureRows: filterRowsByStatus(temperatureRows),
        humidityRows: filterRowsByStatus(humidityRows),
        eventRows,
        actionEvents,
        hourly,
        imports,
        totalAlerts,
        totalActions,
        state: totalActions > 0 ? "ACAO" : totalAlerts > 0 ? "ATENCAO" : "CONTROLADO",
      };
    },
    {
      readingsCount: 0,
      range: environmentalRange(filters?.days),
      selectedType: filters?.type || "ALL",
      selectedZone: filters?.zone || "ALL",
      selectedStatus: filters?.status || "ALL",
      selectedImportId: filters?.importId || "ALL",
      settings: defaultEnvironmentalSchedule,
      zones: [],
      bySensor: [],
      byType: [],
      pressureRows: [],
      temperatureRows: [],
      humidityRows: [],
      eventRows: [],
      actionEvents: [],
      hourly: [],
      imports: [],
      totalAlerts: 0,
      totalActions: 0,
      state: "SEM DADOS",
    },
  );
}
