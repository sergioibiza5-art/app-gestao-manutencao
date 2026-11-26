"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { productionAction, type ProductionResult } from "@/app/producao/actions";

export async function employeeWorkAction(_previous: ProductionResult, form: FormData): Promise<ProductionResult> {
  const user = await requireUser();
  const command = String(form.get("command") || "");
  const id = String(form.get("id") || "");
  if (!id || id.length > 180) return { error: "Registo inválido." };
  const db = getPrisma(), request = new FormData();
  if (command === "resume") {
    if (user.role !== "TICKET") return { error: "Só o colaborador com perfil Posto/Ticket pode retomar a sua atividade." };
    const last = await db.productionActivity.findFirst({
      where: { batchId: id, collaboratorId: user.id }, orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      select: { endedAt: true, operation: true },
    });
    if (!last?.endedAt) return { error: "Não existe uma atividade tua terminada para retomar neste lote." };
    request.set("command", "start");
    request.set("batchId", id);
    request.set("collaboratorId", user.id);
    request.set("operation", last.operation);
  } else if (command === "finish") {
    const activity = await db.productionActivity.findFirst({ where: { id, collaboratorId: user.id, endedAt: null }, select: { batchId: true } });
    if (!activity) return { error: "Só podes terminar uma atividade tua que esteja em curso." };
    request.set("command", "finish");
    request.set("batchId", activity.batchId);
    request.set("rowId", id);
  } else if (command === "cq-arrive" || command === "cq-end") {
    const quality = await db.productionQualityCall.findFirst({ where: { id, technicianId: user.id, endedAt: null }, select: { batchId: true } });
    if (!quality) return { error: "Este controlo não está atribuído a ti ou já terminou." };
    request.set("command", command);
    request.set("batchId", quality.batchId);
    request.set("rowId", id);
    request.set("technicianId", user.id);
  } else return { error: "Ação inválida." };
  const result = await productionAction({}, request);
  if (result.success) {
    revalidatePath("/funcionario", "layout");
    return { ...result, success: command === "resume" ? "Novo período de trabalho iniciado." : command === "finish" ? "A tua atividade terminou. O lote mantém o seu estado." : command === "cq-arrive" ? "Controlo de qualidade iniciado." : "O teu controlo de qualidade terminou." };
  }
  return result;
}
