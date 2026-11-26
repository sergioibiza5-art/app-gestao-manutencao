import { createHash } from "node:crypto";
import { buildMonthlyChemicalReport, monthlyChemicalCsv, monthlyChemicalHtml } from "@/lib/chemical-monthly-report";
import { isDeliverableEmail } from "@/lib/email-alerts";
import { sendGmail } from "@/lib/gmail";
import { getPrisma } from "@/lib/prisma";
import { buildChemicalOpeningReport } from "@/lib/chemical-opening-report";

export const chemicalTestRequestChannel = "chemical-monthly-test-request";
const channel = "chemical-monthly-email-test";

export async function sendMonthlyChemicalTest(token: string) {
  const prisma = getPrisma();
  const hash = createHash("sha256").update(token).digest("hex");
  const grant = await prisma.alertDigestDelivery.findFirst({
    where: {
      digestDate: hash, channel: chemicalTestRequestChannel,
      createdAt: { gt: new Date(Date.now() - 3_600_000) },
      user: { active: true, role: "ADMIN" },
    },
    select: { subject: true, user: { select: { id: true, email: true } } },
  });
  if (!grant || !grant.subject || !/^\d{4}-(0[1-9]|1[0-2])$/.test(grant.subject)) throw new Error("Teste inválido ou expirado.");
  if (!isDeliverableEmail(grant.user.email)) throw new Error("Endereço de email inválido.");
  const report = await buildMonthlyChemicalReport(grant.subject);
  const opening = report.month === "2026-11" ? await buildChemicalOpeningReport() : undefined;
  const subject = `[Teste] Entradas de produtos químicos - ${report.month}`;
  const html = monthlyChemicalHtml(report, true, opening);
  const sent = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${channel}), hashtext(${grant.user.id}))`;
    const marker = { userId: grant.user.id, channel, digestDate: hash };
    if (await tx.alertDigestDelivery.findUnique({ where: { userId_digestDate_channel: marker } })) return 0;
    await sendGmail(grant.user.email, subject, html, "chemical-test-" + hash, [{
      filename: `teste-entradas-quimicos-${report.month}.csv`,
      content: Buffer.from(monthlyChemicalCsv(report), "utf8"), contentType: "text/csv; charset=utf-8",
    }, ...(opening ? [{ filename: "teste-entradas-quimicos-inicial-2026.csv", content: Buffer.from(monthlyChemicalCsv(opening), "utf8"), contentType: "text/csv; charset=utf-8" }] : [])]);
    await tx.alertDigestDelivery.create({ data: { ...marker, subject } });
    return 1;
  }, { timeout: 30_000 });
  return { sent, failed: 0, recipients: 1, month: report.month, products: report.rows.length };
}
