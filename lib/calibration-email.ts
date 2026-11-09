import { createHash } from "node:crypto";
import { calibrationDay, calibrationGroup, calibrationGroups, daysToCalibration } from "@/lib/calibration-alerts";
import { absoluteUrl, escapeHtml, isDeliverableEmail } from "@/lib/email-alerts";
import { sendGmail } from "@/lib/gmail";
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
    return [{ group, date, id: log.id, title: log.title, equipment: log.equipment.name }];
  }).sort((a, b) => a.group - b.group || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const today = calibrationDay(now);
  const digestDate = pilot ? "test/" + pilot.digestDate : today;
  const subject = (pilot ? "[Teste] " : "") + "Plano de calibrações · " + today.split("-").reverse().join("/");

  let sent = 0;
  let failed = 0;
  let testError: string | undefined;
  for (const user of users) {
    try {
      if (!isDeliverableEmail(user.email)) throw new Error("Endereço inválido.");
      const delivered = await prisma.$transaction(async tx => {
        // Serialize cron retries and individual tests for the same recipient.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${channel}), hashtext(${user.id}))`;
        const previous = await tx.alertDigestDelivery.findUnique({
          where: { userId_digestDate_channel: { userId: user.id, digestDate, channel } },
          select: { id: true },
        });
        if (previous) return false;

        const rows = events.map(e => {
          const url = absoluteUrl("/calibracao?calibrationId=" + encodeURIComponent(e.id) + "#calibration-" + encodeURIComponent(e.id));
          return `<li><strong>${calibrationGroups[e.group]}</strong> · <a href="${escapeHtml(url)}">${escapeHtml(e.title)}</a> · ${escapeHtml(e.equipment)} · ${e.date.split("-").reverse().join("/")}</li>`;
        }).join("");
        const html = `<h1>${subject}</h1>${rows ? "<ul>" + rows + "</ul>" : "<p>Sem calibrações vencidas ou previstas para os próximos 30 dias.</p>"}<p><a href="${escapeHtml(absoluteUrl("/calibracao?alertas=verificar"))}">Abrir mapa de calibrações</a></p>`;
        const key = createHash("sha256").update(JSON.stringify([channel, user.id, digestDate])).digest("hex");
        await sendGmail(user.email, subject, html, key);
        await tx.alertDigestDelivery.create({ data: { digestDate, channel, userId: user.id, subject } });
        return true;
      }, { timeout: 30_000 });
      if (delivered) sent++;
    } catch (error) {
      failed++;
      if (pilot && error instanceof Error) {
        testError = /^(Falha no envio de email:|Envio de e-mail indisponível|Endereço inválido)/.test(error.message)
          ? error.message.slice(0, 700) : "Falha no registo da entrega.";
      }
      console.error("Falha no resumo de calibrações", user.id, error instanceof Error ? error.message : "Erro desconhecido");
    }
  }
  return { sent, failed, recipients: users.length, testError };
}
