"use server";

import { revalidatePath } from "next/cache";
import { requireCanManage } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export async function saveWorkOrderDetails(id: string, version: string, form: FormData) {
  await requireCanManage();
  const field = (name: string) => String(form.get(name) ?? "").trim();
  const title = field("title");
  const type = field("type");
  if (!title || (type !== "INTERNAL" && type !== "EXTERNAL")) {
    return { error: "Preenche o título e seleciona o tipo de intervenção." };
  }
  const performedBy = field("performedBy") || null;
  const actionsDone = field("actionsDone") || null;
  const result = field("result") || null;
  const notes = field("notes") || null;

  const linked = await getPrisma().$transaction(async tx => {
    const changed = await tx.workOrder.updateMany({
      where: { id, updatedAt: new Date(version) },
      data: { title, type, performedBy, actionsDone, result, notes },
    });
    if (!changed.count) return null;
    const op = await tx.workOrder.findUniqueOrThrow({ where: { id },
      select: { maintenanceLogId: true, equipmentId: true, scheduleId: true } });
    if (op.maintenanceLogId) {
      await tx.maintenanceLog.update({ where: { id: op.maintenanceLogId },
        data: { title, type, performedBy, description: actionsDone, notes, supplier: field("supplier") || null } });
    }
    return op;
  });
  if (!linked) return { error: "A OP foi alterada ou removida. Atualiza a página antes de voltar a guardar." };
  for (const path of ["/manutencao/ops", `/manutencao/ops/${id}`, "/manutencao", `/equipamentos/${linked.equipmentId}`]) revalidatePath(path);
  if (linked.scheduleId) revalidatePath(`/manutencao/${linked.scheduleId}`);
  return { saved: true };
}
