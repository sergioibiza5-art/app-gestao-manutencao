import { readDb } from "@/lib/prisma";

export async function getDashboardData() {
  return readDb(
    async (prisma) => {
      const now = new Date();
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
            scheduledAt: { gte: now },
          },
          orderBy: { scheduledAt: "asc" },
          take: 4,
          include: { equipment: true },
        }),
      ]);

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
        prisma.expense.findMany({ orderBy: { date: "desc" }, take: 30, include: { equipment: true, vehicle: true, documents: true } }),
        prisma.monthlyBill.findMany({ orderBy: { name: "asc" }, take: 50 }),
        prisma.task.findMany({ orderBy: [{ status: "asc" }, { dueDate: "asc" }], take: 80, include: { equipment: true } }),
        prisma.equipment.findMany({ orderBy: { name: "asc" }, take: 100, include: { interventionPlans: true, equipmentType: true } }),
        prisma.maintenanceLog.findMany({ orderBy: { date: "desc" }, take: 40, include: { equipment: true } }),
        prisma.calibrationLog.findMany({ orderBy: { calibrationDate: "desc" }, take: 40, include: { equipment: true } }),
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
              checklistRecord: { include: { responses: { include: { item: true } } } },
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
