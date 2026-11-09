import { createHash } from "node:crypto";
import { calibrationDay, calibrationGroup, calibrationGroups, daysToCalibration } from "@/lib/calibration-alerts";
import { absoluteUrl, escapeHtml, isDeliverableEmail, sendResendEmail } from "@/lib/email-alerts";
import { getPrisma } from "@/lib/prisma";

const channel = "calibration-email";
export const pilotChannel = "calibration-email-test-request";

export async function sendCalibrationEmails(pilotToken?: string) {
  const prisma = getPrisma();
  const now = new Date();
  const pilot = pilotToken ? await prisma.alertDigestDelivery.findFirst({
    where: {
      channel: pilotChannel,
      digestDate: createHash("sha256").update(pilotToken).digest("hex"),
      createdAt: { gt: new Date(now.valueOf() - 86_400_000) },
    },
  }) : null;
  if (pilotToken && !pilot) throw new Error("Teste inválido ou expirado.");

  const users = await prisma.user.findMany({
    where: { active: true, role: "SGQ", ...(pilot ? { id: pilot.userId } : {}) },
    select: { id: true, email: true },
  });
  if (pilot && users.length !== 1) throw new Error("Destinatário do teste indisponível.");
  const logs = await prisma.calibrationLog.findMany({
    where: { active: true },
    distinct: ["equipmentId"],
    orderBy: [{ calibrationDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: { id: true, equipmentId: true, title: true, nextDueDate: true, equipment: { select: { name: true } } },
  });
  const events = logs.flatMap(log => {
    if (!log.nextDueDate) return [];
    const group = calibrationGroup(daysToCalibration(log.nextDueDate, now));
    if (group < 0) return [];
    const date = calibrationDay(log.nextDueDate);
    return [{ key: [log.id, date, group].join("/"), group, date, id: log.id, title: log.title, equipment: log.equipment.name }];
  }).sort((a, b) => a.group - b.group || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  let sent = 0;
  let failed = 0;
  for (const user of users) {
    try {
      if (!isDeliverableEmail(user.email)) throw new Error("Endereço inválido.");
      const delivered = await prisma.$transaction(async tx => {
        // Serialize cron retries and individual tests for the same recipient.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${channel}), hashtext(${user.id}))`;
        const recorded = await tx.alertDigestDelivery.findMany({
          where: { userId: user.id, channel, digestDate: { in: events.map(e => e.key) } },
          select: { digestDate: true },
        });
        const seen = new Set(recorded.map(row => row.digestDate));
        const pending = events.filter(e => !seen.has(e.key));
        const pilotMarker = pilot ? "test/" + pilot.digestDate : undefined;
        if (pilotMarker && await tx.alertDigestDelivery.findFirst({ where: { userId: user.id, channel, digestDate: pilotMarker } })) return false;
        if (!pilot && !pending.length) return false;

        const items = pilot ? events : pending;
        const subject = (pilot ? "[Teste] " : "") + "Alertas de calibração";
        const rows = items.map(e => {
          const url = absoluteUrl("/calibracao?calibrationId=" + encodeURIComponent(e.id) + "#calibration-" + encodeURIComponent(e.id));
          return `<li><strong>${calibrationGroups[e.group]}</strong> · <a href="${escapeHtml(url)}">${escapeHtml(e.title)}</a> · ${escapeHtml(e.equipment)} · ${e.date.split("-").reverse().join("/")}</li>`;
        }).join("");
        const html = `<h1>${subject}</h1>${rows ? "<ul>" + rows + "</ul>" : "<p>Sem calibrações em alerta.</p>"}<p><a href="${escapeHtml(absoluteUrl("/calibracao?alertas=verificar"))}">Abrir mapa de calibrações</a></p>`;
        const key = createHash("sha256").update(JSON.stringify([user.id, user.email, pilotMarker, html])).digest("hex");
        const result = await sendResendEmail(user.email, subject, html, key);
        if (!result.sent) throw new Error("Envio de e-mail indisponível.");
        const keys = pending.map(e => e.key);
        if (pilotMarker) keys.push(pilotMarker);
        await tx.alertDigestDelivery.createMany({ data: keys.map(digestDate => ({ digestDate, channel, userId: user.id, subject })) });
        return true;
      }, { timeout: 30_000 });
      if (delivered) sent++;
    } catch (error) {
      failed++;
      console.error("Falha no resumo de calibrações", user.id, error instanceof Error ? error.message : "Erro desconhecido");
    }
  }
  return { sent, failed, recipients: users.length };
}
