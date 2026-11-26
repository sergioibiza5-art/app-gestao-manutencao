import { createHash } from "node:crypto";
import { buildChemicalOpeningReport, openingDeliveryChannel, openingDigestDate, openingDeliveryIdentity } from "@/lib/chemical-opening-report";
import { monthlyChemicalCsv, monthlyChemicalHtml } from "@/lib/chemical-monthly-report";
import { getPrisma } from "@/lib/prisma";
import { sendGmail } from "@/lib/gmail";
import { isDeliverableEmail } from "@/lib/email-alerts";

export const openingRequestChannel = "chemical-opening-send-request";
export const openingResendRequestChannel = "chemical-opening-resend-request";

export async function sendChemicalOpeningFromGrant(token: string) {
  const prisma = getPrisma();
  const hash = createHash("sha256").update(token).digest("hex");
  const grant = await prisma.alertDigestDelivery.findFirst({
    where: {
      channel: { in: [openingRequestChannel, openingResendRequestChannel] }, digestDate: hash,
      createdAt: { gt: new Date(Date.now() - 3_600_000) }, user: { active: true, role: "ADMIN" },
    }, select: { id: true, channel: true },
  });
  if (!grant) throw new Error("Teste inválido ou expirado.");
  const resend = grant.channel === openingResendRequestChannel;
  const identity = openingDeliveryIdentity(resend, hash);
  const recipients = await prisma.user.findMany({
    where: { active: true, role: { in: ["HSA", "ADMIN"] } }, select: { id: true, email: true }, orderBy: { id: "asc" },
  });
  if (!recipients.length) throw new Error("Sem destinatários ativos.");
  const report = await buildChemicalOpeningReport();
  if (resend) {
    report.title += " (atualizado)";
    report.introductoryNote = "VERSÃO ATUALIZADA: substitui o relatório enviado anteriormente. " + (report.introductoryNote || "");
  }
  const subject = (resend ? "[Atualizado] " : "") + "Relatório inicial de produtos químicos - janeiro a outubro de 2026";
  const html = monthlyChemicalHtml(report);
  const attachment = { filename: `entradas-quimicos-inicial-2026${resend ? "-atualizado" : ""}.csv`, content: Buffer.from(monthlyChemicalCsv(report), "utf8"), contentType: "text/csv; charset=utf-8" };
  let sent = 0, failed = 0;
  for (const user of recipients) {
    try {
      const delivered = await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${openingDeliveryChannel}), hashtext(${user.id}))`;
        const marker = { userId: user.id, ...identity };
        if (await tx.alertDigestDelivery.findUnique({ where: { userId_digestDate_channel: marker } })) return false;
        if (!isDeliverableEmail(user.email)) throw new Error("Destinatário sem email válido.");
        const key = createHash("sha256").update(JSON.stringify([identity.channel, identity.digestDate, user.id])).digest("hex");
        await sendGmail(user.email, subject, html, key, [attachment]);
        await tx.alertDigestDelivery.create({ data: { ...marker, subject } });
        if (resend) {
          const original = { userId: user.id, digestDate: openingDigestDate, channel: openingDeliveryChannel };
          await tx.alertDigestDelivery.upsert({ where: { userId_digestDate_channel: original }, create: { ...original, subject }, update: {} });
        }
        return true;
      }, { timeout: 30_000 });
      if (delivered) sent++;
    } catch (error) {
      failed++;
      console.error("Falha no relatório inicial de químicos", user.id, error instanceof Error ? error.message : "Erro desconhecido");
    }
  }
  return { sent, failed, recipients: recipients.length, start: report.start, end: report.end, products: report.rows.length };
}
