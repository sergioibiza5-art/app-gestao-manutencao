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
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [
        tasksToday,
        criticalTasks,
        expenses,
        equipmentCount,
        equipmentAttention,
        sgqActive,
        sgqTotal,
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
        prisma.equipment.count(),
        prisma.equipment.count({
          where: { status: { in: ["MAINTENANCE", "INACTIVE"] } },
        }),
        prisma.sGQRecord.count({ where: { status: "ACTIVE" } }),
        prisma.sGQRecord.count(),
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
          include: { equipment: true },
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
          vehicle.metrics.estimatedRevisionDate
            ? {
                id: `${vehicle.id}-revision`,
                type: "Revisao",
                title: `${vehicle.brand} ${vehicle.model}`,
                plate: vehicle.plate,
                dueDate: vehicle.metrics.estimatedRevisionDate,
              }
            : null,
          vehicle.metrics.nextInspectionDate
            ? {
                id: `${vehicle.id}-inspection`,
                type: "Inspecao",
                title: `${vehicle.brand} ${vehicle.model}`,
                plate: vehicle.plate,
                dueDate: vehicle.metrics.nextInspectionDate,
              }
            : null,
        ])
        .filter((item) => item !== null)
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

      return {
        kpis: {
          tasksToday,
          criticalTasks,
          monthlyExpenses: expenses._sum.amount ?? 0,
          equipmentCount,
          equipmentAttention,
          sgqPercent: sgqTotal > 0 ? Math.round((sgqActive / sgqTotal) * 100) : 100,
          sgqPending: Math.max(sgqTotal - sgqActive, 0),
        },
        tasks,
        calendar,
        fleetAlerts,
        range,
      };
    },
    {
      kpis: {
        tasksToday: 8,
        criticalTasks: 3,
        monthlyExpenses: 1284,
        equipmentCount: 42,
        equipmentAttention: 5,
        sgqPercent: 96,
        sgqPending: 2,
      },
      tasks: [],
      calendar: [],
      fleetAlerts: [],
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
        prisma.equipment.findMany({ orderBy: { name: "asc" }, take: 100, include: { interventionPlans: true, equipmentType: true } }),
        prisma.maintenanceLog.findMany({ orderBy: { date: "desc" }, take: 40, include: { equipment: true } }),
        prisma.calibrationLog.findMany({ orderBy: { calibrationDate: "desc" }, take: 200, include: { equipment: true, documents: true } }),
        prisma.consumable.findMany({ orderBy: { name: "asc" }, take: 100, include: { equipment: true } }),
        prisma.document.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { equipment: true, vehicle: true } }),
        prisma.user.findMany({ orderBy: { name: "asc" }, take: 50 }),
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
          calibrationLogs: { orderBy: { calibrationDate: "desc" }, take: 30 },
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
  const latestRevision = vehicle.services.find((service) => service.type === "REVISION" && service.nextDueKm);
  const kmUntilRevision = latestRevision?.nextDueKm && lastKm ? latestRevision.nextDueKm - lastKm.odometer : null;
  const estimatedRevisionDate =
    kmUntilRevision !== null && kmUntilRevision > 0 && averageKmDay > 0
      ? addDays(lastKm!.date, Math.ceil(kmUntilRevision / averageKmDay))
      : latestRevision?.nextDueDate ?? null;
  const serviceCost = vehicle.services.reduce((sum, service) => sum + Number(service.cost ?? 0), 0);
  const invoiceCost = vehicle.expenses?.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0) ?? 0;
  const totalCost = serviceCost + invoiceCost;
  const nextInspection = vehicle.services
    .filter((service) => service.type === "INSPECTION" && service.nextDueDate)
    .sort((a, b) => a.nextDueDate!.getTime() - b.nextDueDate!.getTime())[0];

  return {
    ...vehicle,
    metrics: {
      latestKm: lastKm?.odometer ?? 0,
      averageKmDay,
      averageKmMonth: averageKmDay * 30,
      averageKmYear: averageKmDay * 365,
      estimatedRevisionDate,
      kmUntilRevision,
      serviceCost,
      invoiceCost,
      totalCost,
      nextInspectionDate: nextInspection?.nextDueDate ?? null,
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
