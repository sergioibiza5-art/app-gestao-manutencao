"use server";
import { sendTelegramMessage } from "@/lib/telegram";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ChecklistResponseStatus, Dl50Answer, Dl50AssessmentStatus, DocumentType, EquipmentStatus, ExpenseStatus, InterventionKind, MaintenanceScheduleStatus, MaintenanceType, Prisma, SGQStatus, TaskFrequency, TaskStatus, UserRole, VehicleFuel, VehicleServiceType } from "@prisma/client";
import type { PushSubscription as WebPushSubscription } from "web-push";
import { createSession, destroySession, hashPassword, requireCanAdmin, requireCanManage, requireCanSgq, requireCanWrite, requireUser, verifyPassword } from "@/lib/auth";
import { importEnvironmentalWorkbook } from "@/lib/environmental-import";
import { getPrisma } from "@/lib/prisma";

type PushSubscriptionPayload = {
  endpoint?: string | null;
  keys?: {
    p256dh?: string | null;
    auth?: string | null;
  } | null;
  userAgent?: string | null;
};

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

function loginName(formData: FormData) {
  return (text(formData, "username") || text(formData, "email")).toLowerCase().replace(/\s+/g, ".");
}

function decimal(formData: FormData, key: string) {
  return decimalString(text(formData, key));
}

function decimalString(rawValue: string) {
  if (!rawValue) {
    return "0";
  }

  const value = rawValue.replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : lastDot > -1 ? "." : "";
  const negative = value.startsWith("-");
  const unsigned = value.replace(/-/g, "");
  const normalized = decimalSeparator
    ? `${unsigned.slice(0, unsigned.lastIndexOf(decimalSeparator)).replace(/[,.]/g, "")}.${unsigned.slice(unsigned.lastIndexOf(decimalSeparator) + 1).replace(/[,.]/g, "")}`
    : unsigned.replace(/[,.]/g, "");
  const parsed = Number(`${negative ? "-" : ""}${normalized}`);

  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0";
}

function decimalNumber(rawValue: string) {
  return Number(decimalString(rawValue));
}

function isDatabaseSizeLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("project size limit") || message.includes("53100") || message.includes("could not extend file");
}

function intValue(formData: FormData, key: string) {
  const value = Number.parseInt(text(formData, key), 10);
  return Number.isFinite(value) ? value : 0;
}

function optionalDate(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? new Date(value) : null;
}

function dateWithTime(formData: FormData, dateKey: string, timeKey: string) {
  const dateValue = text(formData, dateKey);
  const timeValue = text(formData, timeKey);
  if (!dateValue) return null;
  return new Date(`${dateValue}T${timeValue || "00:00"}`);
}

function enumValue<T extends string>(formData: FormData, key: string, allowed: readonly T[], fallback: T) {
  const value = text(formData, key);
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function csvRows(content: string) {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const split = (line: string) => line.split(";").map((cell) => cell.trim().replace(/^"|"$/g, ""));
  const headers = split(lines[0]);

  return lines.slice(1).map((line) => {
    const values = split(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

async function uploadedText(formData: FormData, key: string) {
  const file = formData.get(key);
  if (!(file instanceof File) || file.size === 0) return "";
  return file.text();
}

const expenseStatuses = ["PENDING", "PAID", "CANCELED"] as const satisfies readonly ExpenseStatus[];

const taskFrequencies = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "FOUR_MONTHLY",
  "SEMIANNUAL",
  "ANNUAL",
  "BIENNIAL",
  "FIVE_YEAR",
] as const satisfies readonly TaskFrequency[];

const monthIntervals: Record<TaskFrequency, number> = {
  DAILY: 0,
  WEEKLY: 0,
  MONTHLY: 1,
  QUARTERLY: 3,
  FOUR_MONTHLY: 4,
  SEMIANNUAL: 6,
  ANNUAL: 12,
  BIENNIAL: 24,
  FIVE_YEAR: 60,
};
const taskStatuses = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELED"] as const satisfies readonly TaskStatus[];
const equipmentStatuses = ["ACTIVE", "INACTIVE", "MAINTENANCE", "DISCARDED"] as const satisfies readonly EquipmentStatus[];
const documentTypes = ["INVOICE", "WARRANTY", "MANUAL", "CERTIFICATE", "CONTRACT", "DL50_ASSESSMENT", "OTHER"] as const satisfies readonly DocumentType[];
const userRoles = ["ADMIN", "MANAGER", "SGQ", "USER", "VIEWER", "TICKET"] as const satisfies readonly UserRole[];
const sgqStatuses = ["DRAFT", "ACTIVE", "ARCHIVED"] as const satisfies readonly SGQStatus[];
const maintenanceTypes = ["INTERNAL", "EXTERNAL"] as const satisfies readonly MaintenanceType[];
const interventionKinds = ["INSPECTION", "MAINTENANCE"] as const satisfies readonly InterventionKind[];
const checklistResponseStatuses = ["OK", "NOT_OK", "NA"] as const satisfies readonly ChecklistResponseStatus[];
const maintenanceScheduleStatuses = ["SCHEDULED", "DONE", "CANCELED"] as const satisfies readonly MaintenanceScheduleStatus[];
const vehicleFuels = ["GASOLINE", "DIESEL", "HYBRID", "ELECTRIC", "LPG", "OTHER"] as const satisfies readonly VehicleFuel[];
const vehicleServiceTypes = ["MAINTENANCE", "REVISION", "INSPECTION", "COST"] as const satisfies readonly VehicleServiceType[];
const dl50Answers = ["YES", "NO", "NA"] as const satisfies readonly Dl50Answer[];
const dl50AnswerFields = [
  "ceMark",
  "manufacturerManual",
  "suitableForUse",
  "maintenancePlan",
  "safetyDependsOnInstallation",
  "subjectToRiskDeterioration",
  "needsPeriodicVerification",
  "hasDangerZone",
  "hasMovingPartsRisk",
  "hasIdentifiedControls",
  "voluntaryStart",
  "safeStop",
  "emergencyStopRequired",
  "projectionRisk",
  "emissionRisk",
  "electricalRisk",
  "fireRisk",
  "explosionRisk",
  "energyIsolation",
  "safetySignage",
  "operatorsInformed",
  "usedAccordingToManufacturer",
] as const;
const dl50ArticleFields = [
  "article3Notes",
  "article4Notes",
  "article6Notes",
  "article7Notes",
  "article8Notes",
  "article9Notes",
  "article10Notes",
  "article11Notes",
  "article12Notes",
  "article13Notes",
  "article14Notes",
  "article15Notes",
  "article16Notes",
  "article17Notes",
  "article18Notes",
  "article19Notes",
  "article20Notes",
  "article21Notes",
  "article22Notes",
  "article30Notes",
  "article31Notes",
] as const;

type Dl50Payload = {
  [key in (typeof dl50AnswerFields)[number]]?: Dl50Answer | null;
} & {
  [key in (typeof dl50ArticleFields)[number]]?: string | null;
};

function dl50Answer(formData: FormData, key: (typeof dl50AnswerFields)[number]) {
  const value = text(formData, key);
  return dl50Answers.includes(value as Dl50Answer) ? (value as Dl50Answer) : null;
}

function dl50PayloadFromForm(formData: FormData): Dl50Payload {
  return {
    ...Object.fromEntries(dl50AnswerFields.map((field) => [field, dl50Answer(formData, field)])),
    ...Object.fromEntries(dl50ArticleFields.map((field) => [field, optionalText(formData, field)])),
  } as Dl50Payload;
}

function dl50PayloadFromTemplate(template: Dl50Payload): Dl50Payload {
  return {
    ...Object.fromEntries(dl50AnswerFields.map((field) => [field, template[field] ?? null])),
    ...Object.fromEntries(dl50ArticleFields.map((field) => [field, template[field] ?? null])),
  } as Dl50Payload;
}

function generateDl50ConclusionFromPayload(payload: Dl50Payload): { conclusion: string; status: Dl50AssessmentStatus } {
  const criticalNoFields: (typeof dl50AnswerFields)[number][] = [
    "ceMark",
    "manufacturerManual",
    "suitableForUse",
    "maintenancePlan",
    "hasIdentifiedControls",
    "voluntaryStart",
    "safeStop",
    "energyIsolation",
    "operatorsInformed",
    "usedAccordingToManufacturer",
  ];
  const uncontrolledRiskFields: (typeof dl50AnswerFields)[number][] = [
    "safetyDependsOnInstallation",
    "subjectToRiskDeterioration",
    "needsPeriodicVerification",
    "hasDangerZone",
    "hasMovingPartsRisk",
    "emergencyStopRequired",
    "projectionRisk",
    "emissionRisk",
    "electricalRisk",
    "fireRisk",
    "explosionRisk",
  ];
  const hasCriticalNegative = criticalNoFields.some((field) => payload[field] === "NO");
  const hasRelevantRisk = uncontrolledRiskFields.some((field) => payload[field] === "YES");
  const hasRequiredBase =
    payload.maintenancePlan === "YES" &&
    payload.safetyDependsOnInstallation !== "YES" &&
    payload.subjectToRiskDeterioration !== "YES" &&
    payload.needsPeriodicVerification !== "YES";

  if (hasRequiredBase && !hasCriticalNegative && !hasRelevantRisk) {
    return {
      conclusion:
        "O equipamento cumpre os requisitos aplicáveis do Decreto-Lei n.º 50/2005, não se identificando necessidade de verificações periódicas específicas ao abrigo do artigo 6.º, sem prejuízo da manutenção preventiva, utilização segura e avaliação contínua dos riscos.",
      status: "CONFORM",
    };
  }

  return {
    conclusion:
      "O equipamento apresenta pontos que requerem análise complementar ou implementação de medidas corretivas antes de ser considerado conforme.",
    status: "NEEDS_ACTION",
  };
}

async function nextDl50Version(prisma: ReturnType<typeof getPrisma>, equipmentId: string) {
  const latest = await prisma.equipmentDl50Assessment.aggregate({
    where: { equipmentId },
    _max: { version: true },
  });
  return (latest._max.version ?? 0) + 1;
}

async function createDl50AssessmentDocument(
  prisma: ReturnType<typeof getPrisma>,
  assessment: { id: string; equipmentId: string; version: number; conclusion: string },
  uploadedById?: string | null,
) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: assessment.equipmentId },
    select: { name: true, code: true },
  });
  if (!equipment) return null;

  const title = `Avaliação de Conformidade DL 50/2005 - ${equipment.name} - v${assessment.version}`;
  const document = await prisma.document.create({
    data: {
      title,
      type: "DL50_ASSESSMENT",
      fileName: `${equipment.code ?? equipment.name}-DL50-v${assessment.version}`,
      notes: assessment.conclusion,
      equipmentId: assessment.equipmentId,
      uploadedById,
    },
  });

  await prisma.equipmentDl50Assessment.update({
    where: { id: assessment.id },
    data: { documentId: document.id },
  });

  return document;
}

export async function loginUser(formData: FormData) {
  const prisma = getPrisma();
  const credential = (text(formData, "credential") || text(formData, "email")).toLowerCase();
  const password = text(formData, "password");

  if (!credential || !password) {
    redirect("/login?erro=credenciais");
  }

  const users = await prisma.user.findMany({
    where: {
      active: true,
      OR: [{ email: credential }, { username: credential }],
    },
    orderBy: { createdAt: "asc" },
  });
  const user = users.find((item) =>
    item.role === "TICKET"
      ? verifyPassword(password, item.password) || verifyPassword(password, item.pin)
      : verifyPassword(password, item.password),
  ) ?? (users.length === 1 ? users[0] : null);

  if (!user) {
    redirect("/login?erro=credenciais");
  }

  if (user.role === "TICKET") {
    if (!verifyPassword(password, user.password) && !verifyPassword(password, user.pin)) {
      redirect("/login?erro=credenciais");
    }
  } else if (!user.password && users.length === 1) {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashPassword(password) },
    });
  } else if (!verifyPassword(password, user.password)) {
    redirect("/login?erro=credenciais");
  }

  await createSession(user.id);
  redirect(user.role === "TICKET" ? "/tickets" : "/");
}

export async function logoutUser() {
  await destroySession();
  redirect("/login");
}

async function getSystemUserId() {
  const prisma = getPrisma();
  const existingUser = await prisma.user.findFirst({
    where: { email: "sistema@casa.local" },
    select: { id: true },
  });

  if (existingUser) {
    return existingUser.id;
  }

  const user = await prisma.user.create({
    data: {
      name: "Sistema",
      email: "sistema@casa.local",
      role: "ADMIN",
    },
  });

  return user.id;
}

export async function createExpense(formData: FormData) {
  await requireCanWrite();
  const prisma = getPrisma();
  const equipmentId = optionalText(formData, "equipmentId");
  const vehicleId = optionalText(formData, "vehicleId");
  const invoiceUrl = optionalText(formData, "invoiceUrl");
  const invoiceName = optionalText(formData, "invoiceName");

  const expense = await prisma.expense.create({
    data: {
      title: text(formData, "title"),
      category: text(formData, "category") || "Geral",
      supplier: optionalText(formData, "supplier"),
      amount: decimal(formData, "amount"),
      date: optionalDate(formData, "date") ?? new Date(),
      status: enumValue(formData, "status", expenseStatuses, "PAID"),
      notes: optionalText(formData, "notes"),
      equipmentId,
      vehicleId,
    },
  });

  if (invoiceUrl) {
    await prisma.document.create({
      data: {
        title: invoiceName || `Fatura - ${expense.title}`,
        type: "INVOICE",
        fileUrl: invoiceUrl,
        fileName: invoiceName,
        notes: "Documento associado a despesa.",
        expenseId: expense.id,
        equipmentId,
        vehicleId,
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/despesas");
  if (equipmentId) revalidatePath(`/equipamentos/${equipmentId}`);
  if (vehicleId) revalidatePath(`/frota/${vehicleId}`);
  revalidatePath("/frota");
}

export async function updateExpense(formData: FormData) {
  await requireCanWrite();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const equipmentId = optionalText(formData, "equipmentId");
  const vehicleId = optionalText(formData, "vehicleId");
  const invoiceUrl = optionalText(formData, "invoiceUrl");
  const invoiceName = optionalText(formData, "invoiceName");

  if (!id) {
    return;
  }

  await prisma.expense.update({
    where: { id },
    data: {
      title: text(formData, "title"),
      category: text(formData, "category") || "Geral",
      supplier: optionalText(formData, "supplier"),
      amount: decimal(formData, "amount"),
      date: optionalDate(formData, "date") ?? new Date(),
      status: enumValue(formData, "status", expenseStatuses, "PAID"),
      notes: optionalText(formData, "notes"),
      equipmentId,
      vehicleId,
    },
  });

  if (invoiceUrl) {
    const existingInvoice = await prisma.document.findFirst({
      where: { expenseId: id, type: "INVOICE" },
      select: { id: true },
    });

    if (existingInvoice) {
      await prisma.document.update({
        where: { id: existingInvoice.id },
        data: {
          title: invoiceName || "Fatura",
          fileUrl: invoiceUrl,
          fileName: invoiceName,
          equipmentId,
          vehicleId,
        },
      });
    } else {
      await prisma.document.create({
        data: {
          title: invoiceName || "Fatura",
          type: "INVOICE",
          fileUrl: invoiceUrl,
          fileName: invoiceName,
          notes: "Documento associado a despesa.",
          expenseId: id,
          equipmentId,
          vehicleId,
        },
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/despesas");
  revalidatePath(`/despesas/${id}`);
  if (equipmentId) revalidatePath(`/equipamentos/${equipmentId}`);
  if (vehicleId) revalidatePath(`/frota/${vehicleId}`);
  revalidatePath("/frota");
}

export async function deleteExpense(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const id = text(formData, "id");

  if (!id) {
    return;
  }

  const expense = await prisma.expense.findUnique({
    where: { id },
    select: { equipmentId: true, vehicleId: true },
  });

  await prisma.expense.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/despesas");
  revalidatePath("/frota");
  if (expense?.equipmentId) revalidatePath(`/equipamentos/${expense.equipmentId}`);
  if (expense?.vehicleId) revalidatePath(`/frota/${expense.vehicleId}`);
  redirect("/despesas");
}

export async function createQuickEntry(formData: FormData) {
  await requireCanWrite();
  const type = text(formData, "entryType");
  const title = text(formData, "title") || text(formData, "supplier") || "Registo rápido";
  const costCenter = optionalText(formData, "costCenter");
  const notes = [optionalText(formData, "notes"), costCenter ? `Centro de custo: ${costCenter}` : null].filter(Boolean).join("\n");

  if (type === "MAINTENANCE") {
    await createMaintenanceLog(formData);
    return;
  }

  if (type === "STOCK") {
    await createConsumable(formData);
    return;
  }

  if (type === "CALIBRATION") {
    await createCalibrationLog(formData);
    return;
  }

  const prisma = getPrisma();
  await prisma.expense.create({
    data: {
      title,
      category: text(formData, "category") || "Entrada rápida",
      supplier: optionalText(formData, "supplier"),
      amount: decimal(formData, "amount"),
      status: "PAID",
      notes: notes || null,
    },
  });

  revalidatePath("/");
  revalidatePath("/despesas");
}

export async function createMonthlyBill(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();

  await prisma.monthlyBill.create({
    data: {
      name: text(formData, "name"),
      category: text(formData, "category") || "Geral",
      amount: decimal(formData, "amount"),
      dueDay: intValue(formData, "dueDay") || 1,
      notes: optionalText(formData, "notes"),
    },
  });

  revalidatePath("/contas");
}

export async function createBudget(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const month = intValue(formData, "month") || new Date().getMonth() + 1;
  const year = intValue(formData, "year") || new Date().getFullYear();
  const category = text(formData, "category") || "Geral";

  await prisma.budget.upsert({
    where: {
      year_month_category: {
        year,
        month,
        category,
      },
    },
    update: {
      planned: decimal(formData, "planned"),
      notes: optionalText(formData, "notes"),
    },
    create: {
      year,
      month,
      category,
      planned: decimal(formData, "planned"),
      notes: optionalText(formData, "notes"),
    },
  });

  revalidatePath("/");
  revalidatePath("/contas");
}

export async function createTask(formData: FormData) {
  const prisma = getPrisma();
  const user = await requireCanWrite();
  const equipmentId = optionalText(formData, "equipmentId");
  const isRecurring = text(formData, "isRecurring") === "true";
  const dueDate = dateWithTime(formData, "dueDate", "dueTime");

  await prisma.task.create({
    data: {
      title: text(formData, "title"),
      description: optionalText(formData, "description"),
      frequency: isRecurring ? enumValue(formData, "frequency", taskFrequencies, "MONTHLY") : null,
      isRecurring,
      status: enumValue(formData, "status", taskStatuses, "PENDING"),
      startDate: dateWithTime(formData, "startDate", "startTime") ?? dueDate ?? new Date(),
      dueDate,
      dueTime: optionalText(formData, "dueTime"),
      nextDue: optionalDate(formData, "nextDue"),
      createdById: user.id,
      equipmentId,
    },
  });

  revalidatePath("/");
  revalidatePath("/tarefas");
}

export async function updateTask(formData: FormData) {
  await requireCanWrite();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const isRecurring = text(formData, "isRecurring") === "true";
  const dueDate = dateWithTime(formData, "dueDate", "dueTime");

  if (!id) return;

  await prisma.task.update({
    where: { id },
    data: {
      title: text(formData, "title"),
      description: optionalText(formData, "description"),
      frequency: isRecurring ? enumValue(formData, "frequency", taskFrequencies, "MONTHLY") : null,
      isRecurring,
      status: enumValue(formData, "status", taskStatuses, "PENDING"),
      startDate: dateWithTime(formData, "startDate", "startTime") ?? dueDate ?? new Date(),
      dueDate,
      dueTime: optionalText(formData, "dueTime"),
      equipmentId: optionalText(formData, "equipmentId"),
    },
  });

  revalidatePath("/");
  revalidatePath("/tarefas");
}

export async function deleteTask(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const id = text(formData, "id");
  if (!id) return;

  await prisma.task.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/tarefas");
}

export async function createEquipment(formData: FormData) {
  await requireCanSgq();
  const prisma = getPrisma();
  const plans = [
    interventionPlanFromForm(formData, "inspectionInternal", "INSPECTION", "INTERNAL"),
    interventionPlanFromForm(formData, "inspectionExternal", "INSPECTION", "EXTERNAL"),
    interventionPlanFromForm(formData, "maintenanceInternal", "MAINTENANCE", "INTERNAL"),
    interventionPlanFromForm(formData, "maintenanceExternal", "MAINTENANCE", "EXTERNAL"),
  ].filter((plan) => plan !== null);

  await prisma.equipment.create({
    data: {
      name: text(formData, "name"),
      code: optionalText(formData, "code"),
      category: text(formData, "category") || "Geral",
      brand: optionalText(formData, "brand"),
      model: optionalText(formData, "model"),
      serialNumber: optionalText(formData, "serialNumber"),
      supplier: optionalText(formData, "supplier"),
      location: optionalText(formData, "location"),
      responsibleDepartment: optionalText(formData, "responsibleDepartment"),
      isMeasurementMonitoring: text(formData, "isMeasurementMonitoring") === "true",
      regulatoryRequirements: text(formData, "regulatoryRequirements") === "true",
      regulatoryDetails:  optionalText(formData, "regulatoryDetails"),
      parentEquipmentId: optionalText(formData, "parentEquipmentId"),
      equipmentTypeId: optionalText(formData, "equipmentTypeId"),
      purchaseDate: optionalDate(formData, "purchaseDate"),
      warrantyUntil: optionalDate(formData, "warrantyUntil"),
      status: enumValue(formData, "status", equipmentStatuses, "ACTIVE"),
      notes: optionalText(formData, "notes"),
      ...(plans.length > 0 ? { interventionPlans: { create: plans } } : {}),
    },
  });

  revalidatePath("/");
  revalidatePath("/equipamentos");
  revalidatePath("/manutencao");
  revalidatePath("/calibracao");
}

export async function updateEquipmentBasics(formData: FormData) {
  await requireCanSgq();
  const prisma = getPrisma();
  const equipmentId = text(formData, "equipmentId");

  if (!equipmentId) {
    return;
  }

  await prisma.equipment.update({
    where: { id: equipmentId },
    data: {
      name: text(formData, "name"),
      code: optionalText(formData, "code"),
      category: text(formData, "category") || "Geral",
      brand: optionalText(formData, "brand"),
      model: optionalText(formData, "model"),
      serialNumber: optionalText(formData, "serialNumber"),
      supplier: optionalText(formData, "supplier"),
      location: optionalText(formData, "location"),
      responsibleDepartment: optionalText(formData, "responsibleDepartment"),
      regulatoryRequirements: text(formData, "regulatoryRequirements") === "true",
      regulatoryDetails: optionalText(formData, "regulatoryDetails"),
      isMeasurementMonitoring: text(formData, "isMeasurementMonitoring") === "true",
      parentEquipmentId: optionalText(formData, "parentEquipmentId") === equipmentId ? null : optionalText(formData, "parentEquipmentId"),
      equipmentTypeId: optionalText(formData, "equipmentTypeId"),
      purchaseDate: optionalDate(formData, "purchaseDate"),
      warrantyUntil: optionalDate(formData, "warrantyUntil"),
      status: enumValue(formData, "status", equipmentStatuses, "ACTIVE"),
      notes: optionalText(formData, "notes"),
    },
  });

  revalidatePath("/equipamentos");
  revalidatePath(`/equipamentos/${equipmentId}`);
  revalidatePath(`/inventario/${equipmentId}`);
}

export async function generateDl50Conclusion(formData: FormData) {
  await requireCanSgq();
  return generateDl50ConclusionFromPayload(dl50PayloadFromForm(formData));
}

export async function createDl50Assessment(formData: FormData) {
  const user = await requireCanSgq();
  const prisma = getPrisma();
  const equipmentId = text(formData, "equipmentId");
  if (!equipmentId) return;

  const payload = dl50PayloadFromForm(formData);
  const generated = generateDl50ConclusionFromPayload(payload);
  const version = await nextDl50Version(prisma, equipmentId);

  const assessment = await prisma.equipmentDl50Assessment.create({
    data: {
      equipmentId,
      version,
      ...payload,
      conclusion: generated.conclusion,
      status: generated.status,
      createdById: user.id,
    },
  });

  await createDl50AssessmentDocument(prisma, assessment, user.id);

  revalidatePath("/documentos");
  revalidatePath("/equipamentos");
  revalidatePath(`/equipamentos/${equipmentId}`);
  redirect(`/equipamentos/${equipmentId}`);
}

export async function updateDl50Assessment(formData: FormData) {
  await requireCanSgq();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const equipmentId = text(formData, "equipmentId");
  if (!id || !equipmentId) return;

  const payload = dl50PayloadFromForm(formData);
  const generated = generateDl50ConclusionFromPayload(payload);
  await prisma.$transaction(async (tx) => {
    const assessment = await tx.equipmentDl50Assessment.update({
      where: { id },
      data: {
        ...payload,
        conclusion: generated.conclusion,
        status: generated.status,
      },
    });

    if (assessment.documentId) {
      await tx.document.update({
        where: { id: assessment.documentId },
        data: { notes: generated.conclusion },
      });
    }
  });

  revalidatePath("/documentos");
  revalidatePath(`/equipamentos/${equipmentId}`);
  redirect(`/equipamentos/${equipmentId}`);
}

export async function archiveDl50Assessment(formData: FormData) {
  await requireCanSgq();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const equipmentId = text(formData, "equipmentId");
  if (!id || !equipmentId) return;

  await prisma.equipmentDl50Assessment.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });

  revalidatePath(`/equipamentos/${equipmentId}`);
  redirect(`/equipamentos/${equipmentId}`);
}

export async function attachDl50AssessmentToDocuments(formData: FormData) {
  const user = await requireCanSgq();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const equipmentId = text(formData, "equipmentId");
  if (!id || !equipmentId) return;

  const assessment = await prisma.equipmentDl50Assessment.findUnique({
    where: { id },
    select: { id: true, equipmentId: true, version: true, conclusion: true, documentId: true },
  });
  if (!assessment || assessment.documentId) return;

  await createDl50AssessmentDocument(prisma, assessment, user.id);

  revalidatePath("/documentos");
  revalidatePath(`/equipamentos/${equipmentId}`);
}

export async function generateDl50Pdf(formData: FormData) {
  await requireCanSgq();
  const id = text(formData, "id");
  return {
    assessmentId: id,
    status: "PREPARED",
    message: "Estrutura preparada para gerar PDF da avaliação DL 50/2005.",
  };
}

export async function createDl50AssessmentTemplate(formData: FormData) {
  await requireCanSgq();
  const prisma = getPrisma();
  const equipmentTypeId = text(formData, "equipmentTypeId");
  if (!equipmentTypeId) return;

  await prisma.dl50AssessmentTemplate.create({
    data: {
      equipmentTypeId,
      name: text(formData, "name") || "Template DL50",
      notes: optionalText(formData, "templateNotes"),
      ...dl50PayloadFromForm(formData),
    },
  });

  revalidatePath("/equipamentos");
}

export async function updateDl50AssessmentTemplate(formData: FormData) {
  await requireCanSgq();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const equipmentId = optionalText(formData, "equipmentId");
  if (!id) return;

  await prisma.dl50AssessmentTemplate.update({
    where: { id },
    data: {
      name: text(formData, "name") || "Template DL50",
      active: text(formData, "active") !== "false",
      notes: optionalText(formData, "templateNotes"),
      ...dl50PayloadFromForm(formData),
    },
  });

  revalidatePath("/equipamentos");
  if (equipmentId) revalidatePath(`/equipamentos/${equipmentId}`);
}

export async function applyDl50TemplateToEquipment(formData: FormData) {
  const user = await requireCanSgq();
  const prisma = getPrisma();
  const equipmentId = text(formData, "equipmentId");
  const templateId = text(formData, "templateId");
  if (!equipmentId || !templateId) return;

  const template = await prisma.dl50AssessmentTemplate.findUnique({ where: { id: templateId } });
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, select: { equipmentTypeId: true } });
  if (!template || !equipment || equipment.equipmentTypeId !== template.equipmentTypeId) return;

  const payload = dl50PayloadFromTemplate(template);
  const generated = generateDl50ConclusionFromPayload(payload);
  const version = await nextDl50Version(prisma, equipmentId);
  const assessment = await prisma.equipmentDl50Assessment.create({
    data: {
      equipmentId,
      version,
      ...payload,
      conclusion: generated.conclusion,
      status: generated.status,
      createdById: user.id,
    },
  });

  await createDl50AssessmentDocument(prisma, assessment, user.id);

  revalidatePath("/documentos");
  revalidatePath(`/equipamentos/${equipmentId}`);
}

export async function applyDl50TemplateToEquipments(formData: FormData) {
  const user = await requireCanSgq();
  const prisma = getPrisma();
  const templateId = text(formData, "templateId");
  const equipmentIds = formData
    .getAll("equipmentId")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  if (!templateId || equipmentIds.length === 0) return;

  const template = await prisma.dl50AssessmentTemplate.findUnique({ where: { id: templateId } });
  if (!template) return;

  const validEquipment = await prisma.equipment.findMany({
    where: { id: { in: equipmentIds } },
    select: { id: true },
  });

  const payload = dl50PayloadFromTemplate(template);
  const generated = generateDl50ConclusionFromPayload(payload);

  for (const equipment of validEquipment) {
    const version = await nextDl50Version(prisma, equipment.id);
    const assessment = await prisma.equipmentDl50Assessment.create({
      data: {
        equipmentId: equipment.id,
        version,
        ...payload,
        conclusion: generated.conclusion,
        status: generated.status,
        createdById: user.id,
      },
    });
    await createDl50AssessmentDocument(prisma, assessment, user.id);
    revalidatePath(`/equipamentos/${equipment.id}`);
  }

  revalidatePath("/documentos");
  revalidatePath("/equipamentos");
}

export async function createEquipmentTypeWithChecklist(formData: FormData) {
  await requireCanSgq();
  const prisma = getPrisma();
  const typeName = text(formData, "typeName");
  const templateTitle = text(formData, "templateTitle") || `Checklist ${typeName}`;
  const rawItems = text(formData, "items");
  const itemChecks = formData.getAll("itemCheck").filter((value): value is string => typeof value === "string");
  const itemExpectedConditions = formData.getAll("itemExpectedCondition").filter((value): value is string => typeof value === "string");
  const itemPhotoRequired = new Set(formData.getAll("itemPhotoRequired").filter((value): value is string => typeof value === "string"));
  const structuredItems = itemChecks
    .map((check, index) => {
      const trimmedCheck = check.trim();
      return trimmedCheck
        ? {
            order: index + 1,
            check: trimmedCheck,
            expectedCondition: itemExpectedConditions[index]?.trim() || "Condicao conforme criterio definido",
            photoRequired: itemPhotoRequired.has(String(index)),
          }
        : null;
    })
    .filter((item) => item !== null);
  const items = rawItems
    .split(/\r?\n/)
    .map((line, index) => {
      const [check, expectedCondition = "Condição a definir", photoFlag = ""] = line.split("|").map((part) => part.trim());
      return check
        ? {
            order: index + 1,
            check,
            expectedCondition,
            photoRequired: photoFlag.toLowerCase() === "foto" || photoFlag.toLowerCase() === "photo",
          }
        : null;
    })
    .filter((item) => item !== null);

  const checklistItems = structuredItems.length > 0 ? structuredItems : items;

  if (!typeName || checklistItems.length === 0) {
    return;
  }

  await prisma.equipmentType.upsert({
    where: { name: typeName },
    update: {
      description: optionalText(formData, "description"),
      checklistTemplates: {
        create: {
          title: templateTitle,
          version: text(formData, "version") || "1.0",
          notes: optionalText(formData, "notes"),
          items: { create: checklistItems },
        },
      },
    },
    create: {
      name: typeName,
      description: optionalText(formData, "description"),
      checklistTemplates: {
        create: {
          title: templateTitle,
          version: text(formData, "version") || "1.0",
          notes: optionalText(formData, "notes"),
          items: { create: checklistItems },
        },
      },
    },
  });

  revalidatePath("/checklists");
  revalidatePath("/equipamentos");
}

export async function updateChecklistTemplate(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const templateId = text(formData, "templateId");
  const typeName = text(formData, "typeName");
  const itemIds = formData.getAll("itemId").filter((value): value is string => typeof value === "string");
  const itemChecks = formData.getAll("itemCheck").filter((value): value is string => typeof value === "string");
  const itemExpectedConditions = formData.getAll("itemExpectedCondition").filter((value): value is string => typeof value === "string");
  const itemPhotoRequired = new Set(formData.getAll("itemPhotoRequired").filter((value): value is string => typeof value === "string"));

  if (!templateId || !typeName) return;

  const template = await prisma.checklistTemplate.findUnique({
    where: { id: templateId },
    include: { equipmentType: true, items: true },
  });
  if (!template) return;

  const keptIds = itemIds.filter(Boolean);

  await prisma.$transaction(async (tx) => {
    await tx.equipmentType.update({
      where: { id: template.equipmentTypeId },
      data: {
        name: typeName,
        description: optionalText(formData, "description"),
      },
    });

    await tx.checklistTemplate.update({
      where: { id: templateId },
      data: {
        title: text(formData, "templateTitle") || template.title,
        version: text(formData, "version") || "1.0",
        notes: optionalText(formData, "notes"),
      },
    });

    await tx.checklistItem.updateMany({
      where: { templateId, id: { notIn: keptIds.length > 0 ? keptIds : [""] } },
      data: { active: false },
    });

    for (let index = 0; index < itemChecks.length; index += 1) {
      const check = itemChecks[index]?.trim();
      if (!check) continue;

      const data = {
        order: index + 1,
        check,
        expectedCondition: itemExpectedConditions[index]?.trim() || "Condicao conforme criterio definido",
        photoRequired: itemPhotoRequired.has(String(index)),
        active: true,
      };

      const itemId = itemIds[index];
      if (itemId) {
        await tx.checklistItem.update({ where: { id: itemId }, data });
      } else {
        await tx.checklistItem.create({ data: { ...data, templateId } });
      }
    }
  });

  revalidatePath("/checklists");
  revalidatePath("/equipamentos");
  revalidatePath("/manutencao");
}

function interventionPlanFromForm(formData: FormData, prefix: string, kind: InterventionKind, type: MaintenanceType) {
  if (text(formData, `${prefix}Enabled`) !== "true") {
    return null;
  }

  return {
    kind,
    type,
    frequency: enumValue(formData, `${prefix}Frequency`, taskFrequencies, "MONTHLY"),
    actions: text(formData, `${prefix}Actions`) || "Ações a definir",
    notes: optionalText(formData, `${prefix}Notes`),
  };
}

export async function createEquipmentInterventionLog(formData: FormData) {
  await requireCanWrite();
  const prisma = getPrisma();
  const equipmentId = optionalText(formData, "equipmentId");

  if (!equipmentId) {
    return;
  }

  await prisma.equipmentInterventionLog.create({
    data: {
      equipmentId,
      kind: enumValue(formData, "kind", interventionKinds, "MAINTENANCE"),
      type: enumValue(formData, "type", maintenanceTypes, "INTERNAL"),
      title: text(formData, "title") || "Intervenção",
      performedAt: optionalDate(formData, "performedAt") ?? new Date(),
      performedBy: optionalText(formData, "performedBy"),
      actionsDone: text(formData, "actionsDone") || "Sem descrição",
      result: optionalText(formData, "result"),
      notes: optionalText(formData, "notes"),
    },
  });

  revalidatePath("/equipamentos");
  revalidatePath(`/equipamentos/${equipmentId}`);
  revalidatePath(`/inventario/${equipmentId}`);
}

export async function createInternalMaintenanceChecklistRecord(formData: FormData) {
  await requireCanWrite();
  const prisma = getPrisma();
  const equipmentId = text(formData, "equipmentId");
  const templateId = text(formData, "templateId");
  const itemIds = formData.getAll("itemId").filter((value): value is string => typeof value === "string");
  const performedAt = optionalDate(formData, "performedAt") ?? new Date();

  if (!equipmentId || !templateId || itemIds.length === 0) {
    return;
  }

  const record = await prisma.internalMaintenanceRecord.create({
    data: {
      equipmentId,
      templateId,
      documentNo: optionalText(formData, "documentNo"),
      year: intValue(formData, "year") || performedAt.getFullYear(),
      month: intValue(formData, "month") || performedAt.getMonth() + 1,
      performedAt,
      responsible: optionalText(formData, "responsible"),
      result: optionalText(formData, "result"),
      notes: optionalText(formData, "notes"),
      responses: {
        create: itemIds.map((itemId) => {
          const status = enumValue(formData, `status_${itemId}`, checklistResponseStatuses, "OK");
          const photoUrl = optionalText(formData, `photo_${itemId}`);
          return {
            itemId,
            status,
            obs: optionalText(formData, `obs_${itemId}`),
            ...(photoUrl
              ? {
                  photos: {
                    create: {
                      fileUrl: photoUrl,
                      fileName: optionalText(formData, `photoName_${itemId}`),
                      caption: optionalText(formData, `photoCaption_${itemId}`),
                    },
                  },
                }
              : {}),
          };
        }),
      },
    },
  });

  await prisma.equipmentInterventionLog.create({
    data: {
      equipmentId,
      kind: "MAINTENANCE",
      type: "INTERNAL",
      title: "Checklist de manutenção interna",
      performedAt,
      performedBy: optionalText(formData, "responsible"),
      actionsDone: "Checklist de manutenção interna preenchida.",
      result: optionalText(formData, "result"),
      notes: optionalText(formData, "notes"),
    },
  });

  revalidatePath(`/equipamentos/${equipmentId}`);
  revalidatePath(`/equipamentos/${equipmentId}/checklist-interna`);
  revalidatePath(`/inventario/${equipmentId}`);
  revalidatePath(`/inventario/${equipmentId}/checklist-interna`);
  redirect(`/equipamentos/${equipmentId}/checklist-interna/${record.id}`);
}

export async function createConsumable(formData: FormData) {
  const user = await requireCanWrite();
  const prisma = getPrisma();
  const equipmentId = optionalText(formData, "equipmentId");
  const initialStock = decimal(formData, "currentStock") || decimal(formData, "amount");

  const consumable = await prisma.consumable.create({
    data: {
      name: text(formData, "title") || text(formData, "name"),
      category: text(formData, "category") || "Consumível",
      unit: text(formData, "unit") || "un",
      currentStock: initialStock,
      minimumStock: decimal(formData, "minimumStock"),
      unitCost: decimal(formData, "unitCost"),
      folderUrl: optionalText(formData, "folderUrl"),
      location: optionalText(formData, "location"),
      supplier: optionalText(formData, "supplier"),
      notes: optionalText(formData, "notes"),
      equipmentId,
    },
  });

  if (Number(initialStock) > 0) {
    await prisma.consumableMovement.create({
      data: {
        consumableId: consumable.id,
        type: "ENTRADA_INICIAL",
        quantity: initialStock,
        reason: "Criação do produto",
        userId: user.id,
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/inventario");
  if (equipmentId) revalidatePath(`/equipamentos/${equipmentId}`);
}

export async function updateConsumable(formData: FormData) {
  const user = await requireCanWrite();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const equipmentId = optionalText(formData, "equipmentId");

  if (!id) return;

  const current = await prisma.consumable.findUnique({ where: { id }, select: { currentStock: true } });
  const newStock = decimal(formData, "currentStock");

  await prisma.consumable.update({
    where: { id },
    data: {
      name: text(formData, "name"),
      category: text(formData, "category") || "Consumivel",
      unit: text(formData, "unit") || "un",
      currentStock: newStock,
      minimumStock: decimal(formData, "minimumStock"),
      unitCost: decimal(formData, "unitCost"),
      folderUrl: optionalText(formData, "folderUrl"),
      location: optionalText(formData, "location"),
      supplier: optionalText(formData, "supplier"),
      notes: optionalText(formData, "notes"),
      equipmentId,
    },
  });

  const delta = Number(newStock) - Number(current?.currentStock ?? 0);
  if (delta !== 0) {
    await prisma.consumableMovement.create({
      data: {
        consumableId: id,
        type: delta > 0 ? "ENTRADA_MANUAL" : "SAIDA_MANUAL",
        quantity: Math.abs(delta).toFixed(2),
        reason: "Ajuste manual de stock",
        userId: user.id,
      },
    });
  }

  revalidatePath("/inventario");
  revalidatePath(`/inventario/consumiveis/${id}`);
  if (equipmentId) revalidatePath(`/equipamentos/${equipmentId}`);
}

export async function deleteConsumable(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const id = text(formData, "id");
  if (!id) return;

  await prisma.consumable.delete({ where: { id } });
  revalidatePath("/inventario");
  redirect("/inventario");
}

export async function createMaintenanceLog(formData: FormData) {
  await requireCanWrite();
  const prisma = getPrisma();
  const equipmentId = optionalText(formData, "equipmentId");

  if (!equipmentId) {
    return;
  }

  await prisma.maintenanceLog.create({
    data: {
      title: text(formData, "title") || "Manutenção",
      description: optionalText(formData, "description"),
      type: enumValue(formData, "type", maintenanceTypes, "INTERNAL"),
      date: optionalDate(formData, "date") ?? new Date(),
      cost: decimal(formData, "amount"),
      supplier: optionalText(formData, "supplier"),
      costCenter: optionalText(formData, "costCenter"),
      performedBy: optionalText(formData, "performedBy"),
      nextDate: optionalDate(formData, "nextDate"),
      notes: optionalText(formData, "notes"),
      equipmentId,
    },
  });

  revalidatePath("/");
  revalidatePath("/manutencao");
}

export async function updateMaintenanceLog(formData: FormData) {
  await requireCanWrite();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const equipmentId = optionalText(formData, "equipmentId");

  if (!id || !equipmentId) {
    return;
  }

  await prisma.maintenanceLog.update({
    where: { id },
    data: {
      equipmentId,
      title: text(formData, "title") || "Manutenção",
      description: optionalText(formData, "description"),
      type: enumValue(formData, "type", maintenanceTypes, "INTERNAL"),
      date: optionalDate(formData, "date") ?? new Date(),
      cost: decimal(formData, "amount"),
      supplier: optionalText(formData, "supplier"),
      costCenter: optionalText(formData, "costCenter"),
      performedBy: optionalText(formData, "performedBy"),
      nextDate: optionalDate(formData, "nextDate"),
      notes: optionalText(formData, "notes"),
    },
  });

  revalidatePath("/manutencao");
  revalidatePath(`/equipamentos/${equipmentId}`);
}

export async function deleteMaintenanceLog(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const id = text(formData, "id");

  if (!id) {
    return;
  }

  await prisma.maintenanceLog.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/manutencao");
}

function addMonthsClamped(date: Date, months: number, targetDay: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(targetDay, lastDay));
  return next;
}

function generateMaintenanceDates(year: number, startDate: Date, frequency: TaskFrequency) {
  const dates: Date[] = [];
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  const targetDay = startDate.getDate();
  let cursor = startDate < yearStart ? yearStart : new Date(startDate);

  if (frequency === "DAILY") {
    while (cursor <= yearEnd) {
      dates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  if (frequency === "WEEKLY") {
    while (cursor <= yearEnd) {
      dates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }
    return dates;
  }

  const monthIntervals: Record<TaskFrequency, number> = {
  DAILY: 0,
  WEEKLY: 0,
  MONTHLY: 1,
  QUARTERLY: 3,
  FOUR_MONTHLY: 4,
  SEMIANNUAL: 6,
  ANNUAL: 12,
  BIENNIAL: 24,
  FIVE_YEAR: 60,
};

  const interval = monthIntervals[frequency] || 1;
  while (cursor <= yearEnd) {
    dates.push(new Date(cursor));
    cursor = addMonthsClamped(cursor, interval, targetDay);
  }

  return dates;
}

export async function createAnnualMaintenanceSchedule(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const equipmentId = optionalText(formData, "equipmentId");

  if (!equipmentId) {
    return;
  }

  const startDate = optionalDate(formData, "startDate") ?? new Date();
  const year = startDate.getFullYear();
  const frequency = enumValue(formData, "frequency", taskFrequencies, "MONTHLY");
  const dates = generateMaintenanceDates(year, startDate, frequency);

  await prisma.maintenanceSchedule.createMany({
    data: dates.map((scheduledAt) => ({
      title: text(formData, "title") || "Manutenção programada",
      description: optionalText(formData, "description"),
      type: enumValue(formData, "type", maintenanceTypes, "INTERNAL"),
      scheduledAt,
      frequency,
      supplier: optionalText(formData, "supplier"),
      costCenter: optionalText(formData, "costCenter"),
      notes: optionalText(formData, "notes"),
      equipmentId,
    })),
  });

  revalidatePath("/");
  revalidatePath("/manutencao");
}

export async function updateMaintenanceSchedule(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const equipmentId = optionalText(formData, "equipmentId");

  if (!id || !equipmentId) {
    return;
  }

  await prisma.maintenanceSchedule.update({
    where: { id },
    data: {
      equipmentId,
      title: text(formData, "title") || "Manutenção programada",
      description: optionalText(formData, "description"),
      type: enumValue(formData, "type", maintenanceTypes, "INTERNAL"),
      status: enumValue(formData, "status", maintenanceScheduleStatuses, "SCHEDULED"),
      scheduledAt: optionalDate(formData, "scheduledAt") ?? new Date(),
      frequency: enumValue(formData, "frequency", taskFrequencies, "MONTHLY"),
      supplier: optionalText(formData, "supplier"),
      costCenter: optionalText(formData, "costCenter"),
      notes: optionalText(formData, "notes"),
    },
  });

  revalidatePath("/");
  revalidatePath("/manutencao");
}

export async function deleteMaintenanceSchedule(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const id = text(formData, "id");

  if (!id) {
    return;
  }

  await prisma.maintenanceSchedule.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/manutencao");
}

async function nextWorkOrderNumber() {
  const prisma = getPrisma();

  const lastWorkOrder = await prisma.workOrder.findFirst({
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });

  return `OP-${String((lastWorkOrder?.sequence ?? 0) + 1).padStart(5, "0")}`;
}

async function nextTicketNumber() {
  const prisma = getPrisma();

  const lastTicket = await prisma.maintenanceTicket.findFirst({
    orderBy: { openedAt: "desc" },
    select: { number: true },
  });

  const lastNumber = Number(lastTicket?.number?.replace(/\D/g, "") || 0);
  return `TK-${String(lastNumber + 1).padStart(5, "0")}`;
}

function elapsedSeconds(startedAt: Date | null, end = new Date()) {
  if (!startedAt) return 0;
  return Math.max(Math.floor((end.getTime() - startedAt.getTime()) / 1000), 0);
}

function durationNote(seconds: number) {
  const safeSeconds = Math.max(seconds, 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function auditNote(title: string, userName: string, note?: string | null) {
  const timestamp = new Date().toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Lisbon" });
  return `[${timestamp}] ${title} por ${userName}: ${note?.trim() || "Sem observacoes"}`;
}

function minutesFromClock(value?: string | null) {
  const [hours, minutes] = String(value || "").split(":").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function canReceiveTimedAlerts(user: {
  notifyStartTime?: string | null;
  notifyEndTime?: string | null;
  notifyDays?: string | null;
  telegramEnabled?: boolean | null;
}) {
  const now = new Date();
  const lisbonNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
  const day = lisbonNow.getDay();
  const allowedDays = (user.notifyDays || "1,2,3,4,5")
    .split(",")
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value));

  if (allowedDays.length > 0 && !allowedDays.includes(day)) return false;

  const start = minutesFromClock(user.notifyStartTime) ?? 0;
  const end = minutesFromClock(user.notifyEndTime) ?? 24 * 60 - 1;
  const current = lisbonNow.getHours() * 60 + lisbonNow.getMinutes();

  if (start <= end) return current >= start && current <= end;
  return current >= start || current <= end;
}

async function markTicketNotificationsRead(tx: Prisma.TransactionClient, ticketNumber: string) {
  await tx.notification.updateMany({
    where: { title: `Novo ticket ${ticketNumber}`, readAt: null },
    data: { readAt: new Date() },
  });
}

async function refreshEquipmentMaintenanceStatus(tx: Prisma.TransactionClient, equipmentId: string) {
  const activeWorkOrders = await tx.workOrder.count({
    where: {
      equipmentId,
      status: { in: ["IN_PROGRESS", "PAUSED", "SUSPENDED", "DONE"] },
    },
  });
  const equipment = await tx.equipment.findUnique({ where: { id: equipmentId }, select: { status: true } });

  if (activeWorkOrders > 0) {
    await tx.equipment.update({ where: { id: equipmentId }, data: { status: "MAINTENANCE" } });
    return;
  }

  if (equipment?.status === "MAINTENANCE") {
    await tx.equipment.update({ where: { id: equipmentId }, data: { status: "ACTIVE" } });
  }
}

async function syncTicketConsumables(
  tx: Prisma.TransactionClient,
  ticket: { id: string; number: string },
  formData: FormData,
  userId: string,
) {
  const consumableIds = formData.getAll("consumableId").filter((value): value is string => typeof value === "string");
  const quantities = formData.getAll("quantity").filter((value): value is string => typeof value === "string");
  const usageNotes = formData.getAll("usageNotes").filter((value): value is string => typeof value === "string");
  const hasConsumableFields = consumableIds.some((value) => value.trim().length > 0) || quantities.some((value) => value.trim().length > 0);

  if (!hasConsumableFields) {
    const existingUsages = await tx.ticketConsumableUsage.findMany({ where: { ticketId: ticket.id } });
    return existingUsages.reduce((sum, usage) => sum + Number(usage.quantity ?? 0) * Number(usage.unitCost ?? 0), 0);
  }

  const oldUsages = await tx.ticketConsumableUsage.findMany({ where: { ticketId: ticket.id } });
  const oldQuantities = oldUsages.reduce<Record<string, number>>((acc, usage) => {
    acc[usage.consumableId] = (acc[usage.consumableId] ?? 0) + Number(usage.quantity ?? 0);
    return acc;
  }, {});

  await tx.ticketConsumableUsage.deleteMany({ where: { ticketId: ticket.id } });

  let consumableCost = 0;
  const newQuantities: Record<string, number> = {};

  for (let index = 0; index < consumableIds.length; index += 1) {
    const consumableId = consumableIds[index]?.trim();
    const quantityNumber = decimalNumber(quantities[index] ?? "");
    if (!consumableId || quantityNumber <= 0) continue;

    const consumable = await tx.consumable.findUnique({ where: { id: consumableId } });
    if (!consumable) continue;

    const unitCost = Number(consumable.unitCost ?? 0);
    newQuantities[consumableId] = (newQuantities[consumableId] ?? 0) + quantityNumber;
    consumableCost += quantityNumber * unitCost;

    await tx.ticketConsumableUsage.create({
      data: {
        ticketId: ticket.id,
        consumableId,
        quantity: quantityNumber.toFixed(2),
        unitCost: unitCost.toFixed(2),
        notes: usageNotes[index] || null,
      },
    });
  }

  const affectedConsumables = new Set([...Object.keys(oldQuantities), ...Object.keys(newQuantities)]);
  for (const consumableId of affectedConsumables) {
    const delta = (newQuantities[consumableId] ?? 0) - (oldQuantities[consumableId] ?? 0);
    if (delta === 0) continue;

    await tx.consumable.update({
      where: { id: consumableId },
      data: { currentStock: { decrement: delta } },
    });
    await tx.consumableMovement.create({
      data: {
        consumableId,
        type: delta > 0 ? "SAIDA_TICKET" : "AJUSTE_TICKET",
        quantity: Math.abs(delta).toFixed(2),
        reason: `Ticket ${ticket.number}`,
        ticketId: ticket.id,
        userId,
      },
    });
  }

  return consumableCost;
}

async function consumeWorkOrderConsumables(
  tx: Prisma.TransactionClient,
  workOrder: { id: string; number: string },
  formData: FormData,
  userId: string,
) {
  const consumableIds = formData.getAll("consumableId").filter((value): value is string => typeof value === "string");
  const quantities = formData.getAll("quantity").filter((value): value is string => typeof value === "string");
  const usageNotes = formData.getAll("usageNotes").filter((value): value is string => typeof value === "string");

  let consumableCost = 0;

  for (let index = 0; index < consumableIds.length; index += 1) {
    const consumableId = consumableIds[index]?.trim();
    const quantityNumber = decimalNumber(quantities[index] ?? "");
    if (!consumableId || quantityNumber <= 0) continue;

    const consumable = await tx.consumable.findUnique({ where: { id: consumableId } });
    if (!consumable) continue;

    const unitCost = Number(consumable.unitCost ?? 0);
    const lineCost = quantityNumber * unitCost;
    consumableCost += lineCost;

    await tx.consumable.update({
      where: { id: consumableId },
      data: { currentStock: { decrement: quantityNumber } },
    });

    await tx.consumableMovement.create({
      data: {
        consumableId,
        type: "SAIDA_OP",
        quantity: quantityNumber.toFixed(2),
        reason: [
          `OP ${workOrder.number}`,
          `Custo unitario ${unitCost.toFixed(2)} EUR`,
          usageNotes[index] || null,
        ].filter(Boolean).join(" - "),
        workOrderId: workOrder.id,
        userId,
      },
    });
  }

  return consumableCost;
}

function pushConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:manutencao@localhost";

  if (!publicKey || !privateKey) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

async function sendTicketPushNotifications(
  recipientIds: string[],
  payload: { title: string; body: string; url: string },
) {
  const config = pushConfig();
  if (!config || recipientIds.length === 0) return;

  const prisma = getPrisma();
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { active: true, userId: { in: recipientIds } },
  });

  if (subscriptions.length === 0) return;

  const webPushModule = await import("web-push");
  const webPush = webPushModule.default ?? webPushModule;
  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const webPushSubscription: WebPushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };

      try {
        await webPush.sendNotification(webPushSubscription, JSON.stringify(payload));
      } catch (error) {
        const statusCode = typeof error === "object" && error !== null && "statusCode" in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : 0;

        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.updateMany({
            where: { endpoint: subscription.endpoint },
            data: { active: false },
          });
        }
      }
    }),
  );
}

export async function savePushSubscription(subscription: PushSubscriptionPayload) {
  const user = await requireCanWrite();
  const prisma = getPrisma();
  const endpoint = subscription.endpoint?.trim();
  const p256dh = subscription.keys?.p256dh?.trim();
  const auth = subscription.keys?.auth?.trim();

  if (!endpoint || !p256dh || !auth) return { ok: false };

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh,
      auth,
      userAgent: subscription.userAgent?.slice(0, 255) ?? null,
      userId: user.id,
    },
    update: {
      p256dh,
      auth,
      userAgent: subscription.userAgent?.slice(0, 255) ?? null,
      userId: user.id,
      active: true,
    },
  });

  return { ok: true };
}

export async function disablePushSubscription(endpoint: string) {
  await requireCanWrite();
  const value = endpoint.trim();
  if (!value) return { ok: false };

  await getPrisma().pushSubscription.updateMany({
    where: { endpoint: value },
    data: { active: false },
  });

  return { ok: true };
}

export async function createMaintenanceTicket(formData: FormData) {
  const user = await requireUser();

if (user.role === "VIEWER" || user.role === "SGQ") {
  return;
}
  const prisma = getPrisma();
  const equipmentId = optionalText(formData, "equipmentId");
  const problem = text(formData, "problem");

  if (!equipmentId || !problem) return;

  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment) return;

  if (user.role === "TICKET") {
    const canOpen = await prisma.ticketEquipmentAccess.findUnique({
      where: { userId_equipmentId: { userId: user.id, equipmentId } },
    });
    if (!canOpen) return;
  }

  const notificationData = await prisma.$transaction(async (tx) => {
    const ticket = await tx.maintenanceTicket.create({
      data: {
        number: await nextTicketNumber(),
        title: text(formData, "title") || `Avaria - ${equipment.name}`,
        problem,
        priority: enumValue(formData, "priority", ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const, "NORMAL"),
        machineStopped: text(formData, "machineStopped") !== "false",
        location: optionalText(formData, "location") ?? equipment.location,
        equipmentId,
        openedById: user.id,
      },
    });

    const recipients = await tx.user.findMany({
      where: { active: true, role: { in: ["ADMIN", "MANAGER", "USER"] } },
      select: {
        id: true,
        notifyStartTime: true,
        notifyEndTime: true,
        notifyDays: true,
        telegramChatId: true,
        telegramEnabled: true,
      },
    });
    const timedRecipients = recipients.filter(canReceiveTimedAlerts);

    if (recipients.length > 0) {
      await tx.notification.createMany({
        data: recipients.map((recipient) => ({
          userId: recipient.id,
          title: `Novo ticket ${ticket.number}`,
          body: `${equipment.name}: ${ticket.title}`,
          href: "/tickets",
        })),
      });
    }

    return {
      recipientIds: timedRecipients.map((recipient) => recipient.id),
telegramChatIds: timedRecipients
  .filter((recipient) => recipient.telegramEnabled !== false)
  .map((recipient) => recipient.telegramChatId)
  .filter((chatId): chatId is string => Boolean(chatId)),
      title: `Novo ticket ${ticket.number}`,
      body: `${equipment.name}: ${ticket.title}`,
      url: "/tickets",
    };
  });

  await sendTicketPushNotifications(notificationData.recipientIds, {
    title: notificationData.title,
    body: notificationData.body,
    url: notificationData.url,
  });

  if (notificationData.recipientIds.length > 0) {

console.log("RECIPIENT IDS:", notificationData.recipientIds);
console.log("TELEGRAM IDS:", notificationData.telegramChatIds);

    await sendTelegramMessage(
      [
        "🚨 <b>Novo ticket de manutenção</b>",
        "",
        `<b>Título:</b> ${notificationData.title}`,
        `<b>Descrição:</b> ${notificationData.body}`,
        "",
        "<b>Estado:</b> Aberto",
        "<b>Link:</b> https://app-gestao-manutencao.vercel.app/tickets",
      ].join("\n"),
      notificationData.telegramChatIds,
    );
  }

  revalidatePath("/tickets");
  revalidatePath("/");
}

export async function startMaintenanceTicket(formData: FormData) {
  const user = await requireCanWrite();
  const prisma = getPrisma();
  const id = text(formData, "id");
  if (!id) return;

  await prisma.$transaction(async (tx) => {
    const ticket = await tx.maintenanceTicket.findUnique({ where: { id } });
    if (!ticket || !["OPEN", "PAUSED"].includes(ticket.status)) return;

    await tx.maintenanceTicket.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
        startedAt: ticket.startedAt ?? new Date(),
        pausedAt: null,
        assignedToId: user.id,
        startedById: ticket.startedById ?? user.id,
      },
    });
    await markTicketNotificationsRead(tx, ticket.number);
  });
  revalidatePath("/tickets");
  revalidatePath("/inventario");
}

export async function pauseMaintenanceTicket(formData: FormData) {
  await requireCanWrite();
  const prisma = getPrisma();
  const id = text(formData, "id");
  if (!id) return;

  const ticket = await prisma.maintenanceTicket.findUnique({ where: { id } });
  if (!ticket || ticket.status !== "IN_PROGRESS") return;

  await prisma.maintenanceTicket.update({
    where: { id },
    data: {
      status: "PAUSED",
      pausedAt: new Date(),
    },
  });
  revalidatePath("/tickets");
}

export async function completeMaintenanceTicket(formData: FormData) {
  const user = await requireCanWrite();
  const prisma = getPrisma();
  const id = text(formData, "id");
  if (!id) return;

  await prisma.$transaction(async (tx) => {
    const ticket = await tx.maintenanceTicket.findUnique({
      where: { id },
      include: { assignedTo: true },
    });
    if (!ticket) return;

    const completedAt = ticket.completedAt ?? new Date();

    const downtimeSeconds = ticket.machineStopped
      ? ticket.downtimeSeconds > 0
        ? ticket.downtimeSeconds
        : elapsedSeconds(ticket.openedAt, completedAt)
      : 0;

    const totalWorkSeconds =
      ticket.totalWorkSeconds > 0
        ? ticket.totalWorkSeconds
        : ticket.startedAt
        ? elapsedSeconds(ticket.startedAt, completedAt)
        : ticket.totalWorkSeconds;
    const assignedHourlyRate = Number(ticket.assignedTo?.hourlyRate ?? user.hourlyRate ?? 0);
    const laborCost = (totalWorkSeconds / 3600) * assignedHourlyRate;

    const consumableCost = await syncTicketConsumables(tx, ticket, formData, user.id);

    await tx.maintenanceTicket.update({
      where: { id },
      data: {
        status: "DONE",
        completedAt,
        totalWorkSeconds,
        downtimeSeconds,
        laborCost: laborCost.toFixed(2),
        consumableCost: consumableCost.toFixed(2),
        totalCost: (laborCost + consumableCost).toFixed(2),
        solution: optionalText(formData, "solution"),
        observations: optionalText(formData, "observations"),
        completedById: user.id,
      },
    });
    await markTicketNotificationsRead(tx, ticket.number);
  });

  revalidatePath("/tickets");
}

export async function validateMaintenanceTicket(formData: FormData) {
  const user = await requireCanManage();
  const prisma = getPrisma();
  const id = text(formData, "id");
  if (!id) return;

  const ticket = await prisma.$transaction(async (tx) => {
    const currentTicket = await tx.maintenanceTicket.findUnique({
      where: { id },
      include: { assignedTo: true },
    });
    if (!currentTicket) return null;

    const completedAt = currentTicket.completedAt ?? new Date();
    const downtimeSeconds = currentTicket.machineStopped
      ? currentTicket.downtimeSeconds > 0
        ? currentTicket.downtimeSeconds
        : elapsedSeconds(currentTicket.openedAt, completedAt)
      : 0;
    const totalWorkSeconds =
      currentTicket.totalWorkSeconds > 0
        ? currentTicket.totalWorkSeconds
        : currentTicket.startedAt
        ? elapsedSeconds(currentTicket.startedAt, completedAt)
        : 0;
    const laborCost = (totalWorkSeconds / 3600) * Number(currentTicket.assignedTo?.hourlyRate ?? user.hourlyRate ?? 0);
    const consumableCost = await syncTicketConsumables(tx, currentTicket, formData, user.id);

    await tx.maintenanceTicket.update({
      where: { id },
      data: {
        status: "DONE",
        completedAt,
        downtimeSeconds,
        totalWorkSeconds,
        laborCost: laborCost.toFixed(2),
        consumableCost: consumableCost.toFixed(2),
        totalCost: (laborCost + consumableCost).toFixed(2),
        solution: optionalText(formData, "solution") ?? currentTicket.solution,
        observations: optionalText(formData, "observations") ?? currentTicket.observations,
        completedById: currentTicket.completedById ?? user.id,
      },
    });

    return tx.maintenanceTicket.findUnique({
      where: { id },
      include: {
        equipment: true,
        consumables: { include: { consumable: true } },
        openedBy: true,
        startedBy: true,
        completedBy: true,
      },
    });
  });
  if (!ticket) return;
  if (ticket.workOrderId) return;

  const ticketCostNotes = [
    `Problema: ${ticket.problem}`,
    ticket.observations ? `Observacoes: ${ticket.observations}` : null,
    `Aberto por: ${ticket.openedBy?.name ?? "Sistema"}`,
    `Iniciado por: ${ticket.startedBy?.name ?? ticket.assignedToId ?? "Sem registo"}`,
    `Concluido por: ${ticket.completedBy?.name ?? "Sem registo"}`,
    `Validado por: ${user.name}`,
    `Paragem da maquina: ${ticket.machineStopped ? "Sim" : "Nao"}`,
    `Tempo de paragem da maquina: ${durationNote(ticket.downtimeSeconds)}`,
    `Tempo de trabalho da manutencao: ${durationNote(ticket.totalWorkSeconds)}`,
    `Mao de obra: ${Number(ticket.laborCost).toFixed(2)} EUR`,
    `Consumiveis: ${Number(ticket.consumableCost).toFixed(2)} EUR`,
    `Custo total: ${Number(ticket.totalCost).toFixed(2)} EUR`,
  ].filter(Boolean).join("\n");

  const workOrder = await prisma.workOrder.create({
    data: {
      number: await nextWorkOrderNumber(),
      title: `Ticket ${ticket.number} - ${ticket.title}`,
      type: "INTERNAL",
      status: "VALIDATED",
      openedAt: ticket.openedAt,
      startedAt: ticket.startedAt,
      closedAt: ticket.completedAt ?? new Date(),
      validatedAt: new Date(),
      totalWorkSeconds: ticket.totalWorkSeconds,
      performedBy: user.name,
      actionsDone: ticket.solution ?? "Ticket validado pela manutencao.",
      result: "VALIDADO",
      notes: ticketCostNotes,
      equipmentId: ticket.equipmentId,
    },
  });

  const consumablesText = ticket.consumables
    .map((item) => `${item.consumable.name}: ${String(item.quantity)} ${item.consumable.unit} x ${Number(item.unitCost).toFixed(2)} EUR${item.notes ? ` - ${item.notes}` : ""}`)
    .join("\n");

  const maintenanceLog = await prisma.maintenanceLog.create({
    data: {
      title: workOrder.title,
      description: ticket.solution ?? ticket.problem,
      type: "INTERNAL",
      date: ticket.completedAt ?? new Date(),
      cost: Number(ticket.totalCost).toFixed(2),
      performedBy: user.name,
      notes: consumablesText ? `${ticketCostNotes}\n\nConsumiveis:\n${consumablesText}` : ticketCostNotes,
      equipmentId: ticket.equipmentId,
    },
  });

  await prisma.workOrder.update({
    where: { id: workOrder.id },
    data: { maintenanceLogId: maintenanceLog.id },
  });

  await prisma.consumableMovement.updateMany({
    where: { ticketId: id, workOrderId: null },
    data: { workOrderId: workOrder.id },
  });

  await prisma.maintenanceTicket.update({
    where: { id },
    data: {
      status: "VALIDATED",
      validatedAt: new Date(),
      validatedById: user.id,
      workOrderId: workOrder.id,
    },
  });

  revalidatePath("/tickets");
  revalidatePath("/manutencao");
  revalidatePath("/inventario");
  revalidatePath(`/equipamentos/${ticket.equipmentId}`);
}

export async function createWorkOrderFromSchedule(formData: FormData) {
  await requireCanWrite();
  const prisma = getPrisma();
  const scheduleId = text(formData, "scheduleId");

  if (!scheduleId) return;

  const schedule = await prisma.maintenanceSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      equipment: {
        include: {
          equipmentType: {
            include: {
              checklistTemplates: {
                where: { active: true },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
      },
      workOrder: true,
    },
  });

  if (!schedule) return;
  if (schedule.workOrder) redirect(`/manutencao/${schedule.id}`);

  const workOrder = await prisma.workOrder.create({
    data: {
      number: await nextWorkOrderNumber(),
      title: schedule.title,
      type: schedule.type,
      equipmentId: schedule.equipmentId,
      scheduleId: schedule.id,
      templateId: schedule.equipment.equipmentType?.checklistTemplates[0]?.id,
      notes: schedule.notes,
    },
  });

  await prisma.maintenanceSchedule.update({
    where: { id: schedule.id },
    data: { status: "SCHEDULED" },
  });

  revalidatePath("/");
  revalidatePath("/manutencao");
  revalidatePath(`/manutencao/${schedule.id}`);
  redirect(`/manutencao/${schedule.id}?op=${workOrder.id}`);
}

export async function startWorkOrder(formData: FormData) {
  const user = await requireCanWrite();
  const prisma = getPrisma();
  const workOrderId = text(formData, "workOrderId");
  if (!workOrderId) return;

  await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({ where: { id: workOrderId } });
    if (!workOrder || !["OPEN", "PAUSED", "SUSPENDED"].includes(workOrder.status)) return;

    const now = new Date();
    await tx.workOrder.update({
  where: { id: workOrderId },
  data: {
    status: "IN_PROGRESS",
    startedAt: workOrder.startedAt ?? now,
    pausedAt: null,
    lastResumedAt: now,
    performedBy: workOrder.performedBy ?? user.name,
  },
});
    await refreshEquipmentMaintenanceStatus(tx, workOrder.equipmentId);
  });

  revalidatePath("/");
  revalidatePath("/manutencao");
  const scheduleId = optionalText(formData, "scheduleId");
  if (scheduleId) revalidatePath(`/manutencao/${scheduleId}`);
}

export async function suspendWorkOrder(formData: FormData) {
  const user = await requireCanWrite();
  const prisma = getPrisma();
  const workOrderId = text(formData, "workOrderId");
  if (!workOrderId) return;

  await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({ where: { id: workOrderId } });
    if (!workOrder || !["OPEN", "IN_PROGRESS", "PAUSED"].includes(workOrder.status)) return;

    const now = new Date();
    const activeSeconds =
      workOrder.status === "IN_PROGRESS" ? elapsedSeconds(workOrder.lastResumedAt ?? workOrder.startedAt, now) : 0;
    const suspensionNote = auditNote("OP suspensa", user.name, optionalText(formData, "suspensionNotes"));

    await tx.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: "SUSPENDED",
        pausedAt: now,
        lastResumedAt: null,
        totalWorkSeconds: workOrder.totalWorkSeconds + activeSeconds,
        notes: [workOrder.notes, suspensionNote].filter(Boolean).join("\n"),
      },
    });
    await refreshEquipmentMaintenanceStatus(tx, workOrder.equipmentId);
  });

  revalidatePath("/");
  revalidatePath("/manutencao");
  const scheduleId = optionalText(formData, "scheduleId");
  if (scheduleId) revalidatePath(`/manutencao/${scheduleId}`);
}

export async function reopenWorkOrder(formData: FormData) {
  const user = await requireCanWrite();
  const prisma = getPrisma();
  const workOrderId = text(formData, "workOrderId");
  if (!workOrderId) return;

  let equipmentId: string | null = null;

  await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({ where: { id: workOrderId } });
    if (!workOrder || !["DONE", "VALIDATED"].includes(workOrder.status)) return;

    equipmentId = workOrder.equipmentId;
    await tx.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: "OPEN",
        closedAt: null,
        validatedAt: null,
        pausedAt: null,
        lastResumedAt: null,
        notes: [workOrder.notes, auditNote("OP reaberta", user.name, optionalText(formData, "reopenNotes"))].filter(Boolean).join("\n"),
      },
    });

    if (workOrder.scheduleId) {
      await tx.maintenanceSchedule.update({
        where: { id: workOrder.scheduleId },
        data: { status: "SCHEDULED" },
      });
    }

    await refreshEquipmentMaintenanceStatus(tx, workOrder.equipmentId);
  });

  revalidatePath("/");
  revalidatePath("/manutencao");
  revalidatePath("/equipamentos");
  if (equipmentId) revalidatePath(`/equipamentos/${equipmentId}`);
  const scheduleId = optionalText(formData, "scheduleId");
  if (scheduleId) revalidatePath(`/manutencao/${scheduleId}`);
}

export async function pauseWorkOrder(formData: FormData) {
  await requireCanWrite();
  const prisma = getPrisma();
  const workOrderId = text(formData, "workOrderId");
  if (!workOrderId) return;

  await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({ where: { id: workOrderId } });
    if (!workOrder || workOrder.status !== "IN_PROGRESS") return;

    const now = new Date();
    const activeSeconds = elapsedSeconds(workOrder.lastResumedAt ?? workOrder.startedAt, now);
    await tx.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: "PAUSED",
        pausedAt: now,
        lastResumedAt: null,
        totalWorkSeconds: workOrder.totalWorkSeconds + activeSeconds,
      },
    });
    await refreshEquipmentMaintenanceStatus(tx, workOrder.equipmentId);
  });

  revalidatePath("/");
  revalidatePath("/manutencao");
  const scheduleId = optionalText(formData, "scheduleId");
  if (scheduleId) revalidatePath(`/manutencao/${scheduleId}`);
}

export async function completeWorkOrder(formData: FormData) {
  const user = await requireCanWrite();
  const prisma = getPrisma();
  const workOrderId = text(formData, "workOrderId");
  const equipmentId = text(formData, "equipmentId");
  const templateId = optionalText(formData, "templateId");
  const itemIds = formData.getAll("itemId").filter((value): value is string => typeof value === "string");

  if (!workOrderId || !equipmentId) return;

  let scheduleIdForRevalidate: string | null = null;

  await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({ where: { id: workOrderId } });
    if (!workOrder || !["OPEN", "IN_PROGRESS", "PAUSED"].includes(workOrder.status)) return;

    scheduleIdForRevalidate = workOrder.scheduleId;
    const performedAt = workOrder.startedAt ?? new Date();
    const completionMoment = new Date();
    const totalWorkSeconds =
      workOrder.totalWorkSeconds +
      (workOrder.status === "IN_PROGRESS" ? elapsedSeconds(workOrder.lastResumedAt ?? workOrder.startedAt, completionMoment) : 0);
    const laborCost = Number(((totalWorkSeconds / 3600) * Number(user.hourlyRate ?? 0)).toFixed(2));
    const consumableCost = await consumeWorkOrderConsumables(tx, workOrder, formData, user.id);
    const totalCost = Number((laborCost + consumableCost).toFixed(2));
    const costNotes = [
      optionalText(formData, "notes"),
      `Tempo OP: ${durationNote(totalWorkSeconds)}`,
      `Mao de obra: ${laborCost.toFixed(2)} EUR`,
      `Consumiveis: ${consumableCost.toFixed(2)} EUR`,
      `Total: ${totalCost.toFixed(2)} EUR`,
    ].filter(Boolean).join("\n");

    const checklistRecord =
      templateId && itemIds.length > 0
        ? await tx.internalMaintenanceRecord.create({
            data: {
              equipmentId,
              templateId,
              documentNo: workOrder.number,
              year: performedAt.getFullYear(),
              month: performedAt.getMonth() + 1,
              performedAt,
              responsible: workOrder.performedBy ?? user.name,
              result: optionalText(formData, "result"),
              notes: costNotes,
              responses: {
                create: itemIds.map((itemId) => ({
                  itemId,
                  status: enumValue(formData, `status_${itemId}`, checklistResponseStatuses, "OK"),
                  obs: optionalText(formData, `obs_${itemId}`),
                  photos: optionalText(formData, `photoUrl_${itemId}`)
                    ? {
                        create: {
                          fileUrl: text(formData, `photoUrl_${itemId}`),
                          fileName: optionalText(formData, `photoName_${itemId}`),
                          caption: optionalText(formData, `photoCaption_${itemId}`),
                        },
                      }
                    : undefined,
                })),
              },
            },
          })
        : null;

    const maintenanceLog = await tx.maintenanceLog.create({
      data: {
        title: workOrder.title,
        description: optionalText(formData, "actionsDone") || "Ordem de servico executada.",
        type: workOrder.type,
        date: performedAt,
        supplier: workOrder.performedBy ?? user.name,
        performedBy: workOrder.performedBy ?? user.name,
        cost: totalCost.toFixed(2),
        notes: costNotes,
        equipmentId,
      },
    });

    await tx.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: "DONE",
        closedAt: completionMoment,
        pausedAt: null,
        lastResumedAt: null,
        totalWorkSeconds,
        performedBy: workOrder.performedBy ?? user.name,
        actionsDone: optionalText(formData, "actionsDone"),
        result: optionalText(formData, "result"),
        notes: costNotes,
        checklistRecordId: checklistRecord?.id,
        maintenanceLogId: maintenanceLog.id,
      },
    });

    const documentUrl = optionalText(formData, "documentUrl");
    if (documentUrl) {
      await tx.document.create({
        data: {
          title: optionalText(formData, "documentTitle") ?? `Documento ${workOrder.number}`,
          type: "OTHER",
          fileUrl: documentUrl,
          fileName: optionalText(formData, "documentName"),
          notes: optionalText(formData, "documentNotes"),
          equipmentId,
          maintenanceLogId: maintenanceLog.id,
          workOrderId,
        },
      });
    }

    if (workOrder.scheduleId) {
      await tx.maintenanceSchedule.update({
        where: { id: workOrder.scheduleId },
        data: { status: "DONE" },
      });
    }

    await refreshEquipmentMaintenanceStatus(tx, equipmentId);
  });

  revalidatePath("/");
  revalidatePath("/manutencao");
  if (scheduleIdForRevalidate) revalidatePath(`/manutencao/${scheduleIdForRevalidate}`);
  revalidatePath(`/equipamentos/${equipmentId}`);
  revalidatePath("/inventario");
}

export async function validateWorkOrder(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const workOrderId = text(formData, "workOrderId");
  if (!workOrderId) return;

  let equipmentId: string | null = null;

  await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findUnique({ where: { id: workOrderId } });
    if (!workOrder || workOrder.status !== "DONE") return;

    equipmentId = workOrder.equipmentId;

    await tx.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: "VALIDATED",
        validatedAt: new Date(),
      },
    });

    await tx.equipment.update({
      where: { id: workOrder.equipmentId },
      data: {
        status: String(workOrder.result || "").toLowerCase() === "reprovado" ? "INACTIVE" : "ACTIVE",
      },
    });
  });

  revalidatePath("/");
  revalidatePath("/manutencao");
  revalidatePath("/equipamentos");

  if (equipmentId) revalidatePath(`/equipamentos/${equipmentId}`);

  const scheduleId = optionalText(formData, "scheduleId");
  if (scheduleId) revalidatePath(`/manutencao/${scheduleId}`);
}

export async function createCalibrationLog(formData: FormData) {
  await requireCanSgq();
  const prisma = getPrisma();
  const equipmentId = optionalText(formData, "equipmentId");

  if (!equipmentId) {
    return;
  }

  const calibration = await prisma.calibrationLog.create({
    data: {
      title: text(formData, "title") || "Calibração",
      certificateNo: optionalText(formData, "certificateNo"),
      calibrationDate: optionalDate(formData, "calibrationDate") ?? new Date(),
      nextDueDate: optionalDate(formData, "nextDueDate"),
      result: optionalText(formData, "result"),
      approved: text(formData, "approved") !== "false",
      notes: optionalText(formData, "notes"),
      equipmentId,
    },
  });

  const certificateUrl = optionalText(formData, "certificateUrl");
  if (certificateUrl) {
    await prisma.document.create({
      data: {
        title: optionalText(formData, "certificateTitle") ?? `Certificado ${calibration.certificateNo ?? calibration.title}`,
        type: "CERTIFICATE",
        fileUrl: certificateUrl,
        fileName: optionalText(formData, "certificateFileName"),
        equipmentId,
        calibrationLogId: calibration.id,
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/calibracao");
}

export async function updateCalibrationLog(formData: FormData) {
  await requireCanSgq();
  const prisma = getPrisma();
  const id = text(formData, "id");
  if (!id) return;

  const calibration = await prisma.calibrationLog.update({
    where: { id },
    data: {
      title: text(formData, "title") || "Calibracao",
      certificateNo: optionalText(formData, "certificateNo"),
      calibrationDate: optionalDate(formData, "calibrationDate") ?? new Date(),
      nextDueDate: optionalDate(formData, "nextDueDate"),
      result: optionalText(formData, "result"),
      approved: text(formData, "approved") !== "false",
      notes: optionalText(formData, "notes"),
    },
  });

  const certificateUrl = optionalText(formData, "certificateUrl");
  if (certificateUrl) {
    const existing = await prisma.document.findFirst({
      where: { calibrationLogId: id, type: "CERTIFICATE" },
    });
    const data = {
      title: optionalText(formData, "certificateTitle") ?? `Certificado ${calibration.certificateNo ?? calibration.title}`,
      type: "CERTIFICATE" as const,
      fileUrl: certificateUrl,
      fileName: optionalText(formData, "certificateFileName"),
      equipmentId: calibration.equipmentId,
      calibrationLogId: id,
    };
    if (existing) {
      await prisma.document.update({ where: { id: existing.id }, data });
    } else {
      await prisma.document.create({ data });
    }
  }

  revalidatePath("/calibracao");
  revalidatePath(`/equipamentos/${calibration.equipmentId}`);
}

export async function importEquipmentCsv(formData: FormData) {
  await requireCanSgq();
  const prisma = getPrisma();
  const rows = csvRows(await uploadedText(formData, "file"));

  for (const row of rows) {
    const name = row.nome || row.name;
    if (!name) continue;

    await prisma.equipment.upsert({
      where: { code: row.codigo_interno || row.code || `IMPORT-${name}` },
      update: {
        name,
        category: row.categoria || "Geral",
        brand: row.marca || row.brand || null,
        model: row.modelo || row.model || null,
        serialNumber: row.numero_serie || null,
        supplier: row.fornecedor || null,
        location: row.localizacao || null,
        responsibleDepartment: row.departamento || null,
        isMeasurementMonitoring: ["sim", "true", "1"].includes(String(row.medicao_monitorizacao || "").toLowerCase()),
        regulatoryRequirements: ["sim", "true", "1"].includes(String(row.requisitos_regulamentares || row.regulatory_requirements || "").toLowerCase()),
        regulatoryDetails: row.quais_requisitos || row.regulatory_details || null,
        purchaseDate: row.data_aquisicao ? new Date(row.data_aquisicao) : null,
        status: "ACTIVE",
      },
      create: {
        name,
        code: row.codigo_interno || row.code || `IMPORT-${name}`,
        category: row.categoria || "Geral",
        brand: row.marca || row.brand || null,
        model: row.modelo || row.model || null,
        serialNumber: row.numero_serie || null,
        supplier: row.fornecedor || null,
        location: row.localizacao || null,
        responsibleDepartment: row.departamento || null,
        isMeasurementMonitoring: ["sim", "true", "1"].includes(String(row.medicao_monitorizacao || "").toLowerCase()),
        regulatoryRequirements: ["sim", "true", "1"].includes(String(row.requisitos_regulamentares || row.regulatory_requirements || "").toLowerCase()),
        regulatoryDetails: row.quais_requisitos || row.regulatory_details || null,
        purchaseDate: row.data_aquisicao ? new Date(row.data_aquisicao) : null,
        status: "ACTIVE",
      },
    });
  }

  revalidatePath("/equipamentos");
  revalidatePath("/calibracao");
}

export async function importConsumablesCsv(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const rows = csvRows(await uploadedText(formData, "file"));

  for (const row of rows) {
    const name = row.nome || row.name;
    if (!name) continue;

    const equipment = row.codigo_equipamento
      ? await prisma.equipment.findFirst({ where: { code: row.codigo_equipamento } })
      : null;

    await prisma.consumable.create({
      data: {
        name,
        category: row.categoria || "Consumivel",
        unit: row.unidade || "un",
        currentStock: row.stock_atual || "0",
        minimumStock: row.stock_minimo || "0",
        unitCost: (row.custo_unitario || row.unit_cost || "0").replace(",", "."),
        folderUrl: row.link_pasta || row.pasta || null,
        location: row.localizacao || null,
        supplier: row.fornecedor || null,
        notes: row.notas || null,
        equipmentId: equipment?.id,
      },
    });
  }

  revalidatePath("/inventario");
}

export async function importCalibrationsCsv(formData: FormData) {
  await requireCanSgq();
  const prisma = getPrisma();
  const rows = csvRows(await uploadedText(formData, "file"));

  for (const row of rows) {
    const equipment = await prisma.equipment.findFirst({
      where: {
        OR: [
          { code: row.codigo_equipamento || "" },
          { name: row.equipamento || "" },
        ],
      },
    });
    if (!equipment) continue;

    await prisma.calibrationLog.create({
      data: {
        equipmentId: equipment.id,
        title: row.descricao || row.titulo || "Calibracao",
        certificateNo: row.numero_certificado || null,
        calibrationDate: row.data_calibracao ? new Date(row.data_calibracao) : new Date(),
        nextDueDate: row.proxima_validade ? new Date(row.proxima_validade) : null,
        result: row.resultado || null,
        approved: !["nao", "false", "0"].includes(String(row.aprovado || "sim").toLowerCase()),
        notes: row.notas || null,
        documents: row.link_certificado
          ? {
              create: {
                title: row.nome_ficheiro || `Certificado ${row.numero_certificado || row.descricao || equipment.name}`,
                type: "CERTIFICATE",
                fileUrl: row.link_certificado,
                fileName: row.nome_ficheiro || null,
                equipmentId: equipment.id,
              },
            }
          : undefined,
      },
    });
  }

  revalidatePath("/calibracao");
}

export async function createDocument(formData: FormData) {
  await requireCanWrite();
  const prisma = getPrisma();

  await prisma.document.create({
    data: {
      title: text(formData, "title"),
      type: enumValue(formData, "type", documentTypes, "OTHER"),
      fileUrl: optionalText(formData, "fileUrl"),
      fileName: optionalText(formData, "fileName"),
      expiryDate: optionalDate(formData, "expiryDate"),
      notes: optionalText(formData, "notes"),
      equipmentId: optionalText(formData, "equipmentId"),
    },
  });

  revalidatePath("/");
  revalidatePath("/documentos");
}

export async function createUser(formData: FormData) {
  await requireCanAdmin();
  const prisma = getPrisma();
  const password = optionalText(formData, "password");
  const role = enumValue(formData, "role", userRoles, "USER");
  const username = role === "TICKET" ? loginName(formData) : optionalText(formData, "username");
  const email = role === "TICKET"
    ? `${username || `posto-${Date.now()}`}@ticket.local`
    : text(formData, "email").toLowerCase();
  const equipmentIds = formData.getAll("ticketEquipmentId").filter((value): value is string => typeof value === "string" && value.length > 0);

  if (role === "TICKET" && !username) {
    redirect("/acessos?erro=Define%20um%20utilizador%20para%20o%20posto%20de%20ticket.");
  }

  if (username) {
    const duplicate = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (duplicate) {
      redirect(`/acessos?erro=${encodeURIComponent(`O utilizador "${username}" já existe. Usa outro nome de utilizador.`)}`);
    }
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: text(formData, "name"),
        username,
        email,
        password: password ? hashPassword(password) : null,
        pin: null,
        hourlyRate: decimal(formData, "hourlyRate"),
        notifyStartTime: text(formData, "notifyStartTime") || "08:00",
        notifyEndTime: text(formData, "notifyEndTime") || "18:00",
        notifyDays: formData.getAll("notifyDay").filter((value): value is string => typeof value === "string").join(",") || "1,2,3,4,5",
        telegramChatId: optionalText(formData, "telegramChatId"),
        telegramEnabled: text(formData, "telegramEnabled") !== "false",
        role,
        active: text(formData, "active") !== "false",
      },
    });

    if (equipmentIds.length > 0) {
      await tx.ticketEquipmentAccess.createMany({
        data: equipmentIds.map((equipmentId) => ({ userId: user.id, equipmentId })),
        skipDuplicates: true,
      });
    }
  });

  revalidatePath("/acessos");
}

export async function updateUser(formData: FormData) {
  await requireCanAdmin();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const password = optionalText(formData, "password");
  const role = enumValue(formData, "role", userRoles, "USER");
  const username = role === "TICKET" ? loginName(formData) : optionalText(formData, "username");
  const email = role === "TICKET" ? `${username || id}@ticket.local` : text(formData, "email").toLowerCase();
  const equipmentIds = formData.getAll("ticketEquipmentId").filter((value): value is string => typeof value === "string" && value.length > 0);

  if (!id) return;

  const currentUser = await prisma.user.findUnique({
    where: { id },
    select: { username: true },
  });

  const finalUsername = username || currentUser?.username || null;

  if (role === "TICKET" && !finalUsername) {
    redirect("/acessos?erro=Define%20um%20utilizador%20para%20o%20posto%20de%20ticket.");
  }

  if (finalUsername) {
    const duplicate = await prisma.user.findFirst({
      where: {
        username: finalUsername,
        NOT: { id },
      },
      select: { id: true },
    });
    if (duplicate) {
      redirect(`/acessos?erro=${encodeURIComponent(`O utilizador "${finalUsername}" já existe. Usa outro nome de utilizador.`)}`);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        name: text(formData, "name"),
        username: finalUsername,
        email,
        ...(password ? { password: hashPassword(password) } : {}),
        ...(role === "TICKET" ? { pin: null } : {}),
        hourlyRate: decimal(formData, "hourlyRate"),
        notifyStartTime: text(formData, "notifyStartTime") || "08:00",
        notifyEndTime: text(formData, "notifyEndTime") || "18:00",
        notifyDays: formData.getAll("notifyDay").filter((value): value is string => typeof value === "string").join(",") || "1,2,3,4,5",
        telegramChatId: optionalText(formData, "telegramChatId"),
        telegramEnabled: text(formData, "telegramEnabled") !== "false",
        role,
        active: text(formData, "active") !== "false",
      },
    });

    await tx.ticketEquipmentAccess.deleteMany({ where: { userId: id } });
    if (equipmentIds.length > 0) {
      await tx.ticketEquipmentAccess.createMany({
        data: equipmentIds.map((equipmentId) => ({ userId: id, equipmentId })),
        skipDuplicates: true,
      });
    }
  });

  revalidatePath("/acessos");
}

export async function deleteUser(formData: FormData) {
  await requireCanAdmin();
  const prisma = getPrisma();
  const id = text(formData, "id");
  if (!id) return;

  await prisma.user.delete({ where: { id } });
  revalidatePath("/acessos");
}

export async function createVacation(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const userId = optionalText(formData, "userId");
  const startDate = optionalDate(formData, "startDate");
  const endDate = optionalDate(formData, "endDate");
  const employeeName = text(formData, "employeeName");

  if (!employeeName || !startDate || !endDate) return;

  await prisma.vacation.create({
    data: {
      employeeName,
      userId,
      startDate,
      endDate,
      days: decimal(formData, "days"),
      absenceHours: decimal(formData, "absenceHours"),
      bankHoursUsed: decimal(formData, "bankHoursUsed"),
      status: text(formData, "status") || "PLANNED",
      color: optionalText(formData, "color") ?? "#14b8a6",
      notes: optionalText(formData, "notes"),
    },
  });

  revalidatePath("/ferias");
}

export async function updateVacation(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const startDate = optionalDate(formData, "startDate");
  const endDate = optionalDate(formData, "endDate");
  const employeeName = text(formData, "employeeName");

  if (!id || !employeeName || !startDate || !endDate) return;

  await prisma.vacation.update({
    where: { id },
    data: {
      employeeName,
      userId: optionalText(formData, "userId"),
      startDate,
      endDate,
      days: decimal(formData, "days"),
      absenceHours: decimal(formData, "absenceHours"),
      bankHoursUsed: decimal(formData, "bankHoursUsed"),
      status: text(formData, "status") || "PLANNED",
      color: optionalText(formData, "color") ?? "#14b8a6",
      notes: optionalText(formData, "notes"),
    },
  });

  revalidatePath("/ferias");
}

export async function deleteVacation(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const id = text(formData, "id");
  if (!id) return;

  await prisma.vacation.delete({ where: { id } });
  revalidatePath("/ferias");
}

export async function importEnvironmentalReport(formData: FormData) {
  await requireCanManage();
  const files = [
    ...formData.getAll("files"),
    ...formData.getAll("file"),
  ].filter((file): file is File => file instanceof File && file.size > 0);

  if (files.length === 0) return;

  let imported = 0;
  let duplicates = 0;
  let empty = 0;
  let invalid = 0;

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await importEnvironmentalWorkbook({
        buffer,
        fileName: file.name,
        source: "MANUAL",
      });

      if (result.status === "imported") imported += 1;
      if (result.status === "duplicate") duplicates += 1;
      if (result.status === "empty") empty += 1;
      if (result.status === "invalid") invalid += 1;
    } catch (error) {
      if (isDatabaseSizeLimitError(error)) {
        redirect(
          `/ambiental?importError=db_limit&imported=${imported}&duplicates=${duplicates}&empty=${empty}&invalid=${invalid}`,
        );
      }

      invalid += 1;
      console.error(`Falha ao importar relatorio ambiental manual (${file.name}):`, error);
    }
  }

  revalidatePath("/ambiental");
  redirect(`/ambiental?imported=${imported}&duplicates=${duplicates}&empty=${empty}&invalid=${invalid}`);
}

export async function deleteEnvironmentalImport(formData: FormData) {
  await requireCanManage();

  const prisma = getPrisma();
  const id = text(formData, "id");

  if (!id) return;

  await prisma.environmentalReading.deleteMany({
    where: { importId: id },
  });

  await prisma.environmentalImport.delete({
    where: { id },
  });

  revalidatePath("/ambiental");
}

export async function updateEnvironmentalSettings(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const alertStartTime = text(formData, "alertStartTime") || "06:00";
  const alertEndTime = text(formData, "alertEndTime") || "22:00";
  const googleDriveFolder = optionalText(formData, "googleDriveFolderUrl");
  const googleDriveFolderIsUrl = Boolean(googleDriveFolder?.startsWith("http"));

  await prisma.environmentalSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      alertStartTime,
      alertEndTime,
      includeSaturday: formData.get("includeSaturday") === "on",
      includeSunday: formData.get("includeSunday") === "on",
      googleDriveFolderUrl: googleDriveFolderIsUrl ? googleDriveFolder : null,
      googleDriveFolderId: googleDriveFolder && !googleDriveFolderIsUrl ? googleDriveFolder : null,
    },
    update: {
      alertStartTime,
      alertEndTime,
      includeSaturday: formData.get("includeSaturday") === "on",
      includeSunday: formData.get("includeSunday") === "on",
      googleDriveFolderUrl: googleDriveFolderIsUrl ? googleDriveFolder : null,
      googleDriveFolderId: googleDriveFolder && !googleDriveFolderIsUrl ? googleDriveFolder : null,
    },
  });

  revalidatePath("/ambiental");
}

export async function createVehicle(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();

  await prisma.vehicle.create({
    data: {
      brand: text(formData, "brand"),
      model: text(formData, "model"),
      plate: text(formData, "plate").toUpperCase(),
      fuel: enumValue(formData, "fuel", vehicleFuels, "DIESEL"),
      year: intValue(formData, "year") || null,
      driver: optionalText(formData, "driver"),
      notes: optionalText(formData, "notes"),
    },
  });

  revalidatePath("/frota");
}

export async function updateVehicle(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const id = text(formData, "id");

  if (!id) {
    return;
  }

  await prisma.vehicle.update({
    where: { id },
    data: {
      brand: text(formData, "brand"),
      model: text(formData, "model"),
      plate: text(formData, "plate").toUpperCase(),
      fuel: enumValue(formData, "fuel", vehicleFuels, "DIESEL"),
      year: intValue(formData, "year") || null,
      driver: optionalText(formData, "driver"),
      notes: optionalText(formData, "notes"),
    },
  });

  revalidatePath("/frota");
  revalidatePath(`/frota/${id}`);
}

export async function deleteVehicle(formData: FormData) {
  await requireCanAdmin();
  const prisma = getPrisma();
  const id = text(formData, "id");

  if (!id) {
    return;
  }

  await prisma.vehicle.delete({ where: { id } });
  revalidatePath("/frota");
  redirect("/frota");
}

export async function createVehicleKmLog(formData: FormData) {
  await requireCanWrite();
  const prisma = getPrisma();
  const vehicleId = text(formData, "vehicleId");

  if (!vehicleId) {
    return;
  }

  await prisma.vehicleKmLog.create({
    data: {
      vehicleId,
      date: optionalDate(formData, "date") ?? new Date(),
      odometer: intValue(formData, "odometer"),
      notes: optionalText(formData, "notes"),
    },
  });

  revalidatePath("/");
  revalidatePath("/frota");
  revalidatePath(`/frota/${vehicleId}`);
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

async function estimatedVehicleDueDate(vehicleId: string, nextDueKm: number | null, manualDate: Date | null) {
  if (!nextDueKm) {
    return manualDate;
  }

  const prisma = getPrisma();
  const kmLogs = await prisma.vehicleKmLog.findMany({
    where: { vehicleId },
    orderBy: { date: "asc" },
  });

  if (kmLogs.length < 2) {
    return manualDate;
  }

  const first = kmLogs[0];
  const last = kmLogs[kmLogs.length - 1];
  const drivenKm = Math.max(last.odometer - first.odometer, 0);
  const averageKmDay = drivenKm / daysBetween(first.date, last.date);
  const remainingKm = nextDueKm - last.odometer;

  if (averageKmDay <= 0 || remainingKm <= 0) {
    return manualDate;
  }

  return addDays(last.date, Math.ceil(remainingKm / averageKmDay));
}

export async function updateVehicleKmLog(formData: FormData) {
  await requireCanWrite();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const vehicleId = text(formData, "vehicleId");

  if (!id || !vehicleId) {
    return;
  }

  await prisma.vehicleKmLog.update({
    where: { id },
    data: {
      vehicleId,
      date: optionalDate(formData, "date") ?? new Date(),
      odometer: intValue(formData, "odometer"),
      notes: optionalText(formData, "notes"),
    },
  });

  revalidatePath("/");
  revalidatePath("/frota");
  revalidatePath(`/frota/${vehicleId}`);
}

export async function deleteVehicleKmLog(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const vehicleId = optionalText(formData, "vehicleId");

  if (!id) {
    return;
  }

  await prisma.vehicleKmLog.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/frota");
  if (vehicleId) revalidatePath(`/frota/${vehicleId}`);
}

export async function createVehicleService(formData: FormData) {
  await requireCanWrite();
  const prisma = getPrisma();
  const vehicleId = text(formData, "vehicleId");

  if (!vehicleId) {
    return;
  }

  const nextDueKm = intValue(formData, "nextDueKm") || null;
  const nextDueDate = await estimatedVehicleDueDate(vehicleId, nextDueKm, optionalDate(formData, "nextDueDate"));

  await prisma.vehicleService.create({
    data: {
      vehicleId,
      type: enumValue(formData, "type", vehicleServiceTypes, "MAINTENANCE"),
      title: text(formData, "title") || "Serviço",
      date: optionalDate(formData, "date") ?? new Date(),
      odometer: intValue(formData, "odometer") || null,
      cost: decimal(formData, "cost"),
      supplier: optionalText(formData, "supplier"),
      nextDueDate,
      nextDueKm,
      notes: optionalText(formData, "notes"),
    },
  });

  revalidatePath("/");
  revalidatePath("/frota");
  revalidatePath(`/frota/${vehicleId}`);
}

export async function updateVehicleService(formData: FormData) {
  await requireCanWrite();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const vehicleId = text(formData, "vehicleId");

  if (!id || !vehicleId) {
    return;
  }

  const nextDueKm = intValue(formData, "nextDueKm") || null;
  const nextDueDate = await estimatedVehicleDueDate(vehicleId, nextDueKm, optionalDate(formData, "nextDueDate"));

  await prisma.vehicleService.update({
    where: { id },
    data: {
      vehicleId,
      type: enumValue(formData, "type", vehicleServiceTypes, "MAINTENANCE"),
      title: text(formData, "title") || "Serviço",
      date: optionalDate(formData, "date") ?? new Date(),
      odometer: intValue(formData, "odometer") || null,
      cost: decimal(formData, "cost"),
      supplier: optionalText(formData, "supplier"),
      nextDueDate,
      nextDueKm,
      notes: optionalText(formData, "notes"),
    },
  });

  revalidatePath("/");
  revalidatePath("/frota");
  revalidatePath(`/frota/${vehicleId}`);
}

export async function deleteVehicleService(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const vehicleId = optionalText(formData, "vehicleId");

  if (!id) {
    return;
  }

  await prisma.vehicleService.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/frota");
  if (vehicleId) revalidatePath(`/frota/${vehicleId}`);
}

export async function createSgqRecord(formData: FormData) {
  await requireCanManage();
  const prisma = getPrisma();
  const userId = await getSystemUserId();

  await prisma.sGQRecord.create({
    data: {
      code: optionalText(formData, "code"),
      title: text(formData, "title"),
      description: optionalText(formData, "description"),
      status: enumValue(formData, "status", sgqStatuses, "DRAFT"),
      version: text(formData, "version") || "1.0",
      notes: optionalText(formData, "notes"),
      createdById: userId,
    },
  });

  revalidatePath("/acessos");
}

export async function createEquipmentInterventionPlan(formData: FormData) {
  await requireCanSgq();

  const prisma = getPrisma();
  const equipmentId = text(formData, "equipmentId");

  if (!equipmentId) return;

  await prisma.equipmentInterventionPlan.create({
    data: {
      equipmentId,
      kind: enumValue(formData, "kind", interventionKinds, "MAINTENANCE"),
      type: enumValue(formData, "type", maintenanceTypes, "INTERNAL"),
      frequency: enumValue(formData, "frequency", taskFrequencies, "MONTHLY"),
      actions: text(formData, "actions") || "Ações a definir",
      active: text(formData, "active") !== "false",
      notes: optionalText(formData, "notes"),
    },
  });

  revalidatePath(`/equipamentos/${equipmentId}`);
  revalidatePath(`/inventario/${equipmentId}`);
}

export async function updateEquipmentInterventionPlan(formData: FormData) {
  await requireCanSgq();

  const prisma = getPrisma();
  const id = text(formData, "id");
  const equipmentId = text(formData, "equipmentId");

  if (!id || !equipmentId) return;

  await prisma.equipmentInterventionPlan.update({
    where: { id },
    data: {
      kind: enumValue(formData, "kind", interventionKinds, "MAINTENANCE"),
      type: enumValue(formData, "type", maintenanceTypes, "INTERNAL"),
      frequency: enumValue(formData, "frequency", taskFrequencies, "MONTHLY"),
      actions: text(formData, "actions") || "Ações a definir",
      active: text(formData, "active") !== "false",
      notes: optionalText(formData, "notes"),
    },
  });

  revalidatePath(`/equipamentos/${equipmentId}`);
  revalidatePath(`/inventario/${equipmentId}`);
}

export async function deleteEquipmentInterventionPlan(formData: FormData) {
  await requireCanSgq();

  const prisma = getPrisma();
  const id = text(formData, "id");
  const equipmentId = text(formData, "equipmentId");

  if (!id || !equipmentId) return;

  await prisma.equipmentInterventionPlan.delete({
    where: { id },
  });

  revalidatePath(`/equipamentos/${equipmentId}`);
  revalidatePath(`/inventario/${equipmentId}`);
}
