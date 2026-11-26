"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { productionScope } from "@/lib/production-data";
import { canManageProduction, canWriteProduction, productionDate, productionOperations, validateInterval, validateQuality } from "@/lib/production";

export type ProductionResult = { error?: string; success?: string; batchId?: string };
const text = (f: FormData, name: string) => String(f.get(name) ?? "").trim();
function required(f: FormData, name: string) {
  const value = text(f, name);
  if (!value || value.length > 180) throw new Error("Preenche os campos obrigatórios (máximo de 180 caracteres).");
  return value;
}
const snapshot = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

async function checkCollaborator(tx: Prisma.TransactionClient, id: string) {
  if (!await tx.user.findFirst({ where: { id, active: true }, select: { id: true } })) throw new Error("Seleciona um colaborador ativo.");
}
async function checkOverlap(tx: Prisma.TransactionClient, person: string, start: Date, end: Date | null, excludedActivity?: string, excludedCq?: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('production-person'), hashtext(${person}))`;
  const window = { ...(end ? { lt: end } : {}) };
  const activity = await tx.productionActivity.findFirst({ where: {
    collaboratorId: person, ...(excludedActivity ? { id: { not: excludedActivity } } : {}), startedAt: window,
    OR: [{ endedAt: null }, { endedAt: { gt: start } }],
  }, select: { id: true } });
  const quality = await tx.productionQualityCall.findFirst({ where: {
    technicianId: person, ...(excludedCq ? { id: { not: excludedCq } } : {}), arrivedAt: { not: null, ...window },
    OR: [{ endedAt: null }, { endedAt: { gt: start } }],
  }, select: { id: true } });
  if (activity || quality) throw new Error("Este colaborador já tem uma atividade ou CQ nesse horário. Termina ou corrige o registo anterior.");
}

export async function productionAction(_previous: ProductionResult, form: FormData): Promise<ProductionResult> {
  const user = await requireUser();
  try {
    if (!canWriteProduction(user.role)) throw new Error("Sem permissão para registar produção.");
    if (text(form, "notes").length > 4000 || text(form, "reason").length > 500) throw new Error("Observações: máximo de 4000 caracteres. Motivo: máximo de 500 caracteres.");
    const db = getPrisma(), command = text(form, "command");
    const scope = await productionScope(user);
    const batchId = await db.$transaction(async tx => {
      const audit = async (id: string, action: string, before: unknown, after: unknown) => {
        await tx.productionAudit.create({ data: { batchId: id, actorId: user.id, actorName: user.name, action,
          reason: text(form, "reason"), before: snapshot(before), after: snapshot(after) } });
      };
      if (command === "create") {
        const equipmentId = required(form, "equipmentId");
        if (!await tx.equipment.findFirst({ where: { AND: [scope, { id: equipmentId, status: "ACTIVE" }] }, select: { id: true } })) throw new Error("Equipamento sem acesso ou inativo.");
        const batch = await tx.productionBatch.create({ data: { reference: required(form, "reference"), lot: required(form, "lot"),
          line: required(form, "line"), equipmentId, createdById: user.id } });
        await audit(batch.id, "Lote criado", null, batch);
        return batch.id;
      }
      const id = required(form, "batchId");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('production-batch'), hashtext(${id}))`;
      const batch = await tx.productionBatch.findFirst({ where: { id, equipment: scope } });
      if (!batch) throw new Error("Lote indisponível.");
      const manager = canManageProduction(user.role);
      if (command === "reopen") {
        if (!manager || !text(form, "reason")) throw new Error("Só a coordenação pode reabrir, indicando o motivo.");
        const after = await tx.productionBatch.update({ where: { id }, data: { status: "OPEN", verifiedAt: null, verifiedById: null } });
        await audit(id, "Lote reaberto", batch, after);
        return id;
      }
      if (batch.status === "VERIFIED") throw new Error("O lote está conferido. Pede a reabertura à coordenação.");
      if (batch.status === "DONE" && command !== "verify") throw new Error("O lote terminou. Pede a reabertura à coordenação antes de alterar os registos.");
      if (command === "batch" || command === "verify") {
        if (command === "verify" && !manager) throw new Error("Só a coordenação pode conferir o lote.");
        if (command === "verify" && batch.status !== "DONE") throw new Error("Termina o lote antes de o conferir.");
        const quantity = text(form, "quantity").replace(",", ".");
        if (!/^\d{1,11}(\.\d{1,3})?$/.test(quantity)) throw new Error("Quantidade inválida (até três casas decimais).");
        const status = command === "verify" ? "VERIFIED" : text(form, "status");
        if (!["OPEN", "DONE", "VERIFIED"].includes(status) || (command !== "verify" && status === "VERIFIED")) throw new Error("Estado inválido.");
        if (status !== "OPEN") {
          const open = await tx.productionActivity.count({ where: { batchId: id, endedAt: null } });
          const cq = await tx.productionQualityCall.count({ where: { batchId: id, OR: [{ endedAt: null }, { hasStop: true, stopEndedAt: null }] } });
          if (open || cq) throw new Error("Termina as atividades, os controlos de qualidade e as paragens antes de fechar o lote.");
        }
        const after = await tx.productionBatch.update({ where: { id }, data: { quantity, unit: required(form, "unit"), notes: text(form, "notes"), status,
          ...(status === "VERIFIED" ? { verifiedById: user.id, verifiedAt: new Date() } : {}) } });
        await audit(id, status === "VERIFIED" ? "Lote conferido" : "Lote atualizado", batch, after);
      } else {
        if (batch.status !== "OPEN") throw new Error("Reabre o lote antes de registar atividades.");
        const rowId = text(form, "rowId");
        if (command === "activity" || command === "finish") {
          const before = rowId ? await tx.productionActivity.findFirst({ where: { id: rowId, batchId: id } }) : null;
          if (rowId && !before) throw new Error("Atividade não encontrada.");
          if (before && command !== "finish" && (!manager || !text(form, "reason"))) throw new Error("Uma correção exige coordenação e motivo.");
          if (command === "finish" && (!before || before.endedAt)) throw new Error("Atividade já terminada ou indisponível.");
          const startedAt = before && command === "finish" ? before.startedAt : productionDate(required(form, "startedAt"), true)!;
          const endedAt = command === "finish" ? new Date() : productionDate(text(form, "endedAt"));
          validateInterval(startedAt, endedAt);
          const operation = before && command === "finish" ? before.operation : required(form, "operation");
          if (!Object.hasOwn(productionOperations, operation)) throw new Error("Operação inválida.");
          const people = before ? [before.collaboratorId] : [...new Set(form.getAll("collaboratorId").map(String))].sort();
          if (!people.length || people.length > 50) throw new Error("Seleciona entre 1 e 50 colaboradores.");
          for (const collaboratorId of people) {
            await checkCollaborator(tx, collaboratorId);
            await checkOverlap(tx, collaboratorId, startedAt, endedAt, before?.id);
            const data = { batchId: id, collaboratorId, startedAt, endedAt, operation, notes: command === "finish" ? before!.notes : text(form, "notes") };
            const after = before ? await tx.productionActivity.update({ where: { id: before.id }, data }) : await tx.productionActivity.create({ data });
            await audit(id, before ? command === "finish" ? "Atividade terminada" : "Atividade corrigida" : "Atividade registada", before, after);
          }
        } else if (command === "quality") {
          const before = rowId ? await tx.productionQualityCall.findFirst({ where: { id: rowId, batchId: id } }) : null;
          if (rowId && !before) throw new Error("Pedido de CQ não encontrado.");
          if (before?.endedAt && (!manager || !text(form, "reason"))) throw new Error("Uma correção exige coordenação e motivo.");
          const data = { batchId: id, calledAt: productionDate(required(form, "calledAt"), true)!, arrivedAt: productionDate(text(form, "arrivedAt")),
            endedAt: productionDate(text(form, "endedAt")), technicianId: text(form, "technicianId") || null,
            hasStop: form.get("hasStop") === "on", stopStartedAt: productionDate(text(form, "stopStartedAt")), stopEndedAt: productionDate(text(form, "stopEndedAt")), notes: text(form, "notes") };
          validateQuality(data);
          if (data.technicianId) {
            await checkCollaborator(tx, data.technicianId);
            if (data.arrivedAt) await checkOverlap(tx, data.technicianId, data.arrivedAt, data.endedAt, undefined, before?.id);
          }
          const after = before ? await tx.productionQualityCall.update({ where: { id: before.id }, data }) : await tx.productionQualityCall.create({ data });
          await audit(id, before ? "CQ atualizado" : "CQ solicitado", before, after);
        } else throw new Error("Ação inválida.");
      }
      return id;
    }, { timeout: 30_000, maxWait: 10_000 });
    revalidatePath("/producao");
    return { success: "Registo guardado.", batchId };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "Já existe um lote com essa referência e linha." };
    console.error("Produção:", error instanceof Error ? error.message : "Erro desconhecido");
    return { error: error instanceof Error && !(error instanceof Prisma.PrismaClientKnownRequestError) ? error.message : "Não foi possível guardar. Tenta novamente." };
  }
}
