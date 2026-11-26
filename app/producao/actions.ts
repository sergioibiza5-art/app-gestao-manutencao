"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { canManageProduction, canWriteProduction, productionDate, productionOperations, validateInterval, validateQuality } from "@/lib/production";

export type ProductionResult = { error?: string; success?: string; batchId?: string };
const text = (f: FormData, name: string) => String(f.get(name) ?? "").trim();
function required(f: FormData, name: string) {
  const value = text(f, name);
  if (!value || value.length > 180) throw new Error("Preenche os campos obrigatórios (máximo de 180 caracteres).");
  return value;
}
const snapshot = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

async function checkCollaborator(tx: Prisma.TransactionClient, id: string, role?: "TICKET" | "SGQ") {
  if (!await tx.user.findFirst({ where: { id, active: true, ...(role ? { role } : {}) }, select: { id: true } })) {
    throw new Error(role === "SGQ" ? "Seleciona um técnico ativo com perfil SGQ." : role === "TICKET" ? "Seleciona um colaborador ativo com perfil Posto/Ticket." : "Seleciona um colaborador ativo.");
  }
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
    const manager = canManageProduction(user);
    if (!canWriteProduction(user.role) && !manager) throw new Error("Sem permissão para registar produção.");
    if (text(form, "notes").length > 4000 || text(form, "reason").length > 500) throw new Error("Observações: máximo de 4000 caracteres. Motivo: máximo de 500 caracteres.");
    const db = getPrisma(), command = text(form, "command");
    const batchId = await db.$transaction(async tx => {
      const audit = async (id: string, action: string, before: unknown, after: unknown) => {
        await tx.productionAudit.create({ data: { batchId: id, actorId: user.id, actorName: user.name, action,
          reason: text(form, "reason"), before: snapshot(before), after: snapshot(after) } });
      };
      if (command === "create") {
        const equipmentId = required(form, "equipmentId");
        if (!await tx.equipment.findFirst({ where: { id: equipmentId, status: "ACTIVE" }, select: { id: true } })) throw new Error("Equipamento inativo ou indisponível.");
        const batch = await tx.productionBatch.create({ data: { reference: required(form, "reference"), lot: required(form, "lot"),
          line: required(form, "line"), equipmentId, createdById: user.id } });
        await audit(batch.id, "Lote criado", null, batch);
        return batch.id;
      }
      const id = required(form, "batchId");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('production-batch'), hashtext(${id}))`;
      const batch = await tx.productionBatch.findUnique({ where: { id } });
      if (!batch) throw new Error("Lote indisponível.");
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
        if (command === "activity" || command === "finish" || command === "start") {
          if (command === "activity" && !manager) throw new Error("Só um coordenador de produção pode introduzir ou corrigir horários.");
          if (command === "start" && rowId) throw new Error("Usa Iniciar para uma nova atividade.");
          const before = rowId ? await tx.productionActivity.findFirst({ where: { id: rowId, batchId: id } }) : null;
          if (rowId && !before) throw new Error("Atividade não encontrada.");
          if (before && command !== "finish" && (!manager || !text(form, "reason"))) throw new Error("Uma correção exige coordenação e motivo.");
          if (command === "finish" && (!before || before.endedAt)) throw new Error("Atividade já terminada ou indisponível.");
          if (command === "finish" && !manager && before!.collaboratorId !== user.id) throw new Error("Só podes terminar a tua própria atividade.");
          const startedAt = before && command === "finish" ? before.startedAt : command === "start" ? new Date() : productionDate(required(form, "startedAt"), true)!;
          const endedAt = command === "finish" ? new Date() : command === "start" ? null : productionDate(text(form, "endedAt"));
          validateInterval(startedAt, endedAt);
          const operation = before && command === "finish" ? before.operation : required(form, "operation");
          if (!Object.hasOwn(productionOperations, operation)) throw new Error("Operação inválida.");
          const people = before ? [before.collaboratorId] : [...new Set(form.getAll("collaboratorId").map(String))].sort();
          if (!people.length || people.length > 50) throw new Error("Seleciona entre 1 e 50 colaboradores.");
          if (!manager && (people.length !== 1 || people[0] !== user.id)) throw new Error("Só podes iniciar a tua própria atividade.");
          for (const collaboratorId of people) {
            await checkCollaborator(tx, collaboratorId, before ? undefined : "TICKET");
            await checkOverlap(tx, collaboratorId, startedAt, endedAt, before?.id);
            const data = { batchId: id, collaboratorId, startedAt, endedAt, operation, notes: command === "finish" ? before!.notes : text(form, "notes") };
            const after = before ? await tx.productionActivity.update({ where: { id: before.id }, data }) : await tx.productionActivity.create({ data });
            await audit(id, before ? command === "finish" ? "Atividade terminada" : "Atividade corrigida" : "Atividade registada", before, after);
          }
        } else if (command === "call-quality") {
          const now = new Date(), hasStop = form.get("hasStop") === "on";
          const after = await tx.productionQualityCall.create({ data: { batchId: id, calledAt: now, hasStop,
            stopStartedAt: hasStop ? now : null, notes: text(form, "notes") } });
          await audit(id, "CQ solicitado", null, after);
        } else if (["cq-arrive", "cq-end", "stop-start", "stop-end"].includes(command)) {
          const before = await tx.productionQualityCall.findFirst({ where: { id: rowId, batchId: id } });
          if (!before) throw new Error("Pedido de CQ não encontrado.");
          const now = new Date();
          let data: Prisma.ProductionQualityCallUpdateInput;
          if (command === "cq-arrive") {
            if (before.arrivedAt) throw new Error("O CQ já foi iniciado.");
            const technicianId = manager ? text(form, "technicianId") || user.id : user.id;
            await checkCollaborator(tx, technicianId, "SGQ");
            await checkOverlap(tx, technicianId, now, null, undefined, before.id);
            data = { arrivedAt: now, technician: { connect: { id: technicianId } } };
          } else if (command === "cq-end") {
            if (!before.arrivedAt || before.endedAt) throw new Error("O CQ não está em curso.");
            if (!manager && before.technicianId !== user.id) throw new Error("Só o técnico que iniciou o CQ ou um coordenador pode terminá-lo.");
            data = { endedAt: now };
          } else if (command === "stop-start") {
            if (before.hasStop || before.endedAt) throw new Error("Este CQ já tem uma paragem ou está terminado.");
            data = { hasStop: true, stopStartedAt: now };
          } else {
            if (!before.hasStop || before.stopEndedAt) throw new Error("Não existe uma paragem em curso.");
            data = { stopEndedAt: now };
          }
          const after = await tx.productionQualityCall.update({ where: { id: before.id }, data });
          await audit(id, ({ "cq-arrive": "CQ iniciado", "cq-end": "CQ terminado", "stop-start": "Paragem iniciada", "stop-end": "Paragem terminada" })[command]!, before, after);
        } else if (command === "quality") {
          if (!manager) throw new Error("Só um coordenador de produção pode introduzir ou corrigir horários de CQ.");
          const before = rowId ? await tx.productionQualityCall.findFirst({ where: { id: rowId, batchId: id } }) : null;
          if (rowId && !before) throw new Error("Pedido de CQ não encontrado.");
          if (before && !text(form, "reason")) throw new Error("Uma correção exige um motivo.");
          const data = { batchId: id, calledAt: productionDate(required(form, "calledAt"), true)!, arrivedAt: productionDate(text(form, "arrivedAt")),
            endedAt: productionDate(text(form, "endedAt")), technicianId: text(form, "technicianId") || null,
            hasStop: form.get("hasStop") === "on", stopStartedAt: productionDate(text(form, "stopStartedAt")), stopEndedAt: productionDate(text(form, "stopEndedAt")), notes: text(form, "notes") };
          validateQuality(data);
          if (data.technicianId) {
            await checkCollaborator(tx, data.technicianId, "SGQ");
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
