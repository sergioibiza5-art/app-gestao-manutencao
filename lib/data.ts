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

  ...calendar
    .filter((schedule) => {
      const isLate = schedule.scheduledAt < todayStart && schedule.status === "SCHEDULED";
      const hasOpenOp =
        schedule.workOrder && ["OPEN", "IN_PROGRESS", "PAUSED"].includes(schedule.workOrder.status);
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
      ticketAlerts: [],
      operationalAlerts: [],
      range: dashboardRange(),
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
        in: ["IN_PROGRESS", "PAUSED"],
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
          maintenanceSchedules: { orderBy: { scheduledAt: "asc" }, take: 50 },
          calibrationLogs: { orderBy: { calibrationDate: "desc" }, take: 30, include: { documents: true } },
          expenses: { orderBy: { date: "desc" }, take: 50, include: { documents: true } },
          documents: { orderBy: { createdAt: "desc" }, take: 30 },
          consumables: { orderBy: { name: "asc" }, take: 50 },
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
        include: { checklistTemplates: { where: { active: true }, include: { items: true } } },
      }),
    [],
  );
}

export async function getEquipmentOptions() {
  return readDb(
    async (prisma) =>
      prisma.equipment.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true, isMeasurementMonitoring: true },
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

export async function getMaintenanceData(filters: { view?: string; date?: string; type?: string }) {
  const view = filters.view || "month";
  const { start, end } = getMaintenanceRange(view, filters.date);
  const type = filters.type === "INTERNAL" || filters.type === "EXTERNAL" ? filters.type : undefined;

  return readDb(
    async (prisma) => {
      const [equipment, maintenanceLogs, schedules] = await Promise.all([
        prisma.equipment.findMany({ orderBy: { name: "asc" }, take: 100 }),
        prisma.maintenanceLog.findMany({ orderBy: { date: "desc" }, take: 40, include: { equipment: true } }),
        prisma.maintenanceSchedule.findMany({
          where: {
            OR: [
              { scheduledAt: { gte: start, lte: end } },
              { scheduledAt: { lt: start }, status: "SCHEDULED" },
            ],
            ...(type ? { type } : {}),
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
    async (prisma) =>
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
            },
          },
        },
      }),
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
        (ticket) => ticket.downtimeSeconds > 0 || ticket.completedAt,
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
