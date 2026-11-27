import { createHash } from "node:crypto";
import { absoluteUrl, escapeHtml, isDeliverableEmail } from "@/lib/email-alerts";
import { sendGmail } from "@/lib/gmail";
import { getPrisma } from "@/lib/prisma";
import { qualityReminderDue } from "@/lib/quality-reminder";

export function qualityCallEmail(call: { id: string; batchId: string; calledAt: Date; hasStop: boolean; notes: string; batch: { reference: string; lot: string; line: string; equipment: { code: string | null; name: string } } }, reminder = false) {
  const b = call.batch, esc = escapeHtml;
  const time = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "medium" }).format(call.calledAt);
  return {
    subject: `${reminder ? "Lembrete · " : ""}Pedido de controlo de qualidade · Lote ${b.lot}`,
    html: `<h2>${reminder ? "Pedido de CQ continua pendente" : "Pedido de controlo de qualidade"}</h2><p>${reminder ? "Passaram pelo menos 20 minutos desde o primeiro pedido e o controlo de qualidade ainda não foi iniciado na aplicação." : "Foi chamado um técnico de qualidade."}</p><p>Referência: <strong>${esc(b.reference)}</strong><br>Lote: <strong>${esc(b.lot)}</strong><br>Linha: ${esc(b.line)}<br>Equipamento: ${esc(b.equipment.code)} · ${esc(b.equipment.name)}<br>Chamada original (Lisboa): ${esc(time)}<br>Produção parada: <strong>${call.hasStop ? "Sim" : "Não"}</strong></p>${call.notes ? `<p>${esc(call.notes).replaceAll("\n", "<br>")}</p>` : ""}<p><a href="${esc(absoluteUrl(`/producao?lote=${encodeURIComponent(call.batchId)}#cq-${call.id}`))}">Abrir pedido de CQ</a></p>`,
  };
}

export async function notifyQualityCall(id: string, send = sendGmail, options: { reminder?: boolean; now?: Date } = {}) {
  const db = getPrisma(), channel = options.reminder ? "production-quality-reminder" : "production-quality-call";
  const call = await db.productionQualityCall.findUnique({ where: { id }, include: { batch: { include: { equipment: { select: { name: true, code: true } } } } } });
  if (!call || call.arrivedAt || call.endedAt || call.batch.status !== "OPEN") return { sent: 0, failed: 0, recipients: 0 };
  if (options.reminder && !qualityReminderDue(call, options.now)) return { sent: 0, failed: 0, recipients: 0 };
  const users = (await db.user.findMany({ where: { active: true, role: "SGQ", qualityExecutor: true }, select: { id: true, email: true } })).filter(u => isDeliverableEmail(u.email));
  const { subject, html } = qualityCallEmail(call, options.reminder);
  let sent = 0, failed = 0;
  for (const user of users) {
    try {
      const delivered = await db.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${channel}), hashtext(${id + user.id}))`;
        const previous = await tx.alertDigestDelivery.findUnique({ where: { userId_digestDate_channel: { userId: user.id, digestDate: id, channel } } });
        if (previous) return false;
        const current = await tx.user.findUnique({ where: { id: user.id } });
        const pending = await tx.productionQualityCall.findUnique({ where: { id }, include: { batch: { select: { status: true } } } });
        if (!current?.active || current.role !== "SGQ" || !current.qualityExecutor || !isDeliverableEmail(current.email) || !pending || pending.arrivedAt || pending.endedAt) return false;
        if (pending.batch.status !== "OPEN" || (options.reminder && !qualityReminderDue(pending, options.now))) return false;
        const key = createHash("sha256").update(`${channel}/${id}/${user.id}`).digest("hex");
        await send(current.email, subject, html, key);
        await tx.alertDigestDelivery.create({ data: { userId: user.id, digestDate: id, channel, subject } });
        return true;
      }, { timeout: 30_000 });
      if (delivered) sent++;
    } catch (error) {
      failed++;
      console.error("Email CQ:", user.id, error instanceof Error ? error.message : "Falha de envio");
    }
  }
  return { sent, failed, recipients: users.length };
}
