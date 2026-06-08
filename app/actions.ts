"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ChecklistResponseStatus, DocumentType, EquipmentStatus, ExpenseStatus, InterventionKind, MaintenanceScheduleStatus, MaintenanceType, SGQStatus, TaskFrequency, TaskStatus, UserRole, VehicleFuel, VehicleServiceType } from "@prisma/client";
import { createSession, destroySession, hashPassword, requireCanAdmin, requireCanManage, requireCanWrite, verifyPassword } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

function decimal(formData: FormData, key: string) {
  const rawValue = text(formData, key);

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

const expenseStatuses = ["PENDING", "PAID", "CANCELED"] as const satisfies readonly ExpenseStatus[];
const taskFrequencies = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "FOUR_MONTHLY", "SEMIANNUAL", "ANNUAL"] as const satisfies readonly TaskFrequency[];
const taskStatuses = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELED"] as const satisfies readonly TaskStatus[];
const equipmentStatuses = ["ACTIVE", "INACTIVE", "MAINTENANCE", "DISCARDED"] as const satisfies readonly EquipmentStatus[];
const documentTypes = ["INVOICE", "WARRANTY", "MANUAL", "CERTIFICATE", "CONTRACT", "OTHER"] as const satisfies readonly DocumentType[];
const userRoles = ["ADMIN", "MANAGER", "USER", "VIEWER"] as const satisfies readonly UserRole[];
const sgqStatuses = ["DRAFT", "ACTIVE", "ARCHIVED"] as const satisfies readonly SGQStatus[];
const maintenanceTypes = ["INTERNAL", "EXTERNAL"] as const satisfies readonly MaintenanceType[];
const interventionKinds = ["INSPECTION", "MAINTENANCE"] as const satisfies readonly InterventionKind[];
const checklistResponseStatuses = ["OK", "NOT_OK", "NA"] as const satisfies readonly ChecklistResponseStatus[];
const maintenanceScheduleStatuses = ["SCHEDULED", "DONE", "CANCELED"] as const satisfies readonly MaintenanceScheduleStatus[];
const vehicleFuels = ["GASOLINE", "DIESEL", "HYBRID", "ELECTRIC", "LPG", "OTHER"] as const satisfies readonly VehicleFuel[];
const vehicleServiceTypes = ["MAINTENANCE", "REVISION", "INSPECTION", "COST"] as const satisfies readonly VehicleServiceType[];

export async function loginUser(formData: FormData) {
  const prisma = getPrisma();
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");

  if (!email || !password) {
    redirect("/login?erro=credenciais");
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.active) {
    redirect("/login?erro=credenciais");
  }

  if (!user.password) {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashPassword(password) },
    });
  } else if (!verifyPassword(password, user.password)) {
    redirect("/login?erro=credenciais");
  }

  await createSession(user.id);
  redirect("/");
}

export async function logoutUser() {
  await destroySession();
  redirect("/login");
}

async function getSystemUserId() {
  const prisma = getPrisma();
  const user = await prisma.user.upsert({
    where: { email: "sistema@casa.local" },
    update: {},
    create: {
      name: "Sistema",
      email: "sistema@casa.local",
      role: "ADMIN",
    },
    select: { id: true },
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
  await requireCanManage();
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
  await requireCanManage();
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
      isMeasurementMonitoring: text(formData, "isMeasurementMonitoring") === "true",
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

export async function createEquipmentTypeWithChecklist(formData: FormData) {
  await requireCanManage();
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
  await requireCanWrite();
  const prisma = getPrisma();
  const equipmentId = optionalText(formData, "equipmentId");

  await prisma.consumable.create({
    data: {
      name: text(formData, "title") || text(formData, "name"),
      category: text(formData, "category") || "Consumível",
      unit: text(formData, "unit") || "un",
      currentStock: decimal(formData, "currentStock") || decimal(formData, "amount"),
      minimumStock: decimal(formData, "minimumStock"),
      location: optionalText(formData, "location"),
      supplier: optionalText(formData, "supplier"),
      notes: optionalText(formData, "notes"),
      equipmentId,
    },
  });

  revalidatePath("/");
  revalidatePath("/inventario");
  if (equipmentId) revalidatePath(`/equipamentos/${equipmentId}`);
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

  const year = intValue(formData, "year") || new Date().getFullYear();
  const startDate = optionalDate(formData, "startDate") ?? new Date(year, 0, 1);
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
  const count = await prisma.workOrder.count();
  return `OP-${String(count + 1).padStart(5, "0")}`;
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

export async function completeWorkOrder(formData: FormData) {
  await requireCanWrite();
  const prisma = getPrisma();
  const workOrderId = text(formData, "workOrderId");
  const equipmentId = text(formData, "equipmentId");
  const templateId = optionalText(formData, "templateId");
  const itemIds = formData.getAll("itemId").filter((value): value is string => typeof value === "string");
  const performedAt = dateWithTime(formData, "performedAt", "performedTime") ?? new Date();

  if (!workOrderId || !equipmentId) return;

  const workOrder = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!workOrder) return;

  const checklistRecord =
    templateId && itemIds.length > 0
      ? await prisma.internalMaintenanceRecord.create({
          data: {
            equipmentId,
            templateId,
            documentNo: workOrder.number,
            year: performedAt.getFullYear(),
            month: performedAt.getMonth() + 1,
            performedAt,
            responsible: optionalText(formData, "performedBy"),
            result: optionalText(formData, "result"),
            notes: optionalText(formData, "notes"),
            responses: {
              create: itemIds.map((itemId) => ({
                itemId,
                status: enumValue(formData, `status_${itemId}`, checklistResponseStatuses, "OK"),
                obs: optionalText(formData, `obs_${itemId}`),
              })),
            },
          },
        })
      : null;

  const maintenanceLog = await prisma.maintenanceLog.create({
    data: {
      title: workOrder.title,
      description: optionalText(formData, "actionsDone") || "Ordem de servico executada.",
      type: workOrder.type,
      date: performedAt,
      supplier: optionalText(formData, "supplier"),
      performedBy: optionalText(formData, "performedBy"),
      cost: decimal(formData, "amount"),
      notes: optionalText(formData, "notes"),
      equipmentId,
    },
  });

  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: "DONE",
      closedAt: performedAt,
      performedBy: optionalText(formData, "performedBy"),
      actionsDone: optionalText(formData, "actionsDone"),
      result: optionalText(formData, "result"),
      notes: optionalText(formData, "notes"),
      checklistRecordId: checklistRecord?.id,
      maintenanceLogId: maintenanceLog.id,
    },
  });

  if (workOrder.scheduleId) {
    await prisma.maintenanceSchedule.update({
      where: { id: workOrder.scheduleId },
      data: { status: "DONE" },
    });
  }

  revalidatePath("/");
  revalidatePath("/manutencao");
  revalidatePath(`/manutencao/${workOrder.scheduleId}`);
  revalidatePath(`/equipamentos/${equipmentId}`);
}

export async function createCalibrationLog(formData: FormData) {
  await requireCanWrite();
  const prisma = getPrisma();
  const equipmentId = optionalText(formData, "equipmentId");

  if (!equipmentId) {
    return;
  }

  await prisma.calibrationLog.create({
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

  revalidatePath("/");
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

  await prisma.user.create({
    data: {
      name: text(formData, "name"),
      email: text(formData, "email").toLowerCase(),
      password: password ? hashPassword(password) : null,
      role: enumValue(formData, "role", userRoles, "USER"),
      active: text(formData, "active") !== "false",
    },
  });

  revalidatePath("/acessos");
}

export async function updateUser(formData: FormData) {
  await requireCanAdmin();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const password = optionalText(formData, "password");

  if (!id) return;

  await prisma.user.update({
    where: { id },
    data: {
      name: text(formData, "name"),
      email: text(formData, "email").toLowerCase(),
      ...(password ? { password: hashPassword(password) } : {}),
      role: enumValue(formData, "role", userRoles, "USER"),
      active: text(formData, "active") !== "false",
    },
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
