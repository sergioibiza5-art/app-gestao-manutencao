import { createHash } from "node:crypto";
import { chemicalMonth, monthlyChemicalSchedule } from "@/lib/chemical-monthly-calendar";
import { csvCell } from "@/lib/chemical-report-utils";
import { escapeHtml, isDeliverableEmail } from "@/lib/email-alerts";
import { sendGmail } from "@/lib/gmail";
import { getPrisma } from "@/lib/prisma";
import { chemicalTypes, productTypeLabel } from "@/lib/product-types";

export const monthlyChemicalEntryTypes = ["ENTRADA_DIRETA", "ENTRADA_INICIAL"];
const channel = "chemical-monthly-email";

type ReportDb = Pick<ReturnType<typeof getPrisma>, "consumable" | "consumableMovement">;

export async function buildMonthlyChemicalReport(month: string, prisma: ReportDb = getPrisma()) {
  const period = chemicalMonth(month);
  const grouped = await prisma.consumableMovement.groupBy({
    by: ["consumableId"],
    where: {
      type: { in: monthlyChemicalEntryTypes },
      quantity: { gt: 0 },
      date: { gte: period.from, lt: period.until },
      consumable: { productType: { in: chemicalTypes } },
    },
    _sum: { quantity: true },
    _count: { _all: true },
  });
  const products = await prisma.consumable.findMany({
    where: { id: { in: grouped.map(row => row.consumableId) } },
    select: { id: true, name: true, productType: true, unit: true, supplier: true },
  });
  const quantities = new Map(grouped.map(row => [row.consumableId, row]));
  const rows = products.map(product => {
    const totals = quantities.get(product.id)!;
    return { ...product, quantity: totals._sum.quantity!.toFixed(), entries: totals._count._all };
  }).sort((a, b) => a.name.localeCompare(b.name, "pt") || a.id.localeCompare(b.id));
  return { ...period, rows };
}

type Report = Awaited<ReturnType<typeof buildMonthlyChemicalReport>>;

export function monthlyChemicalCsv(report: Report) {
  const rows: unknown[][] = [
    ["Entradas mensais de produtos químicos", report.start, report.end, "Europe/Lisbon"],
    ["Inclui entradas diretas e stock inicial. Exclui ajustes e saídas. Uma linha por produto; classificação e unidade atuais."],
    ["Produto", "Tipo de produto", "Quantidade total", "Unidade de stock", "N.º de entradas", "Fornecedor atual"],
    ...report.rows.map(row => [row.name, productTypeLabel(row.productType), row.quantity.replace(".", ","), row.unit, row.entries, row.supplier]),
  ];
  if (!report.rows.length) rows.push(["Sem entradas de produtos químicos neste período."]);
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(";")).join("\r\n");
}

export function monthlyChemicalHtml(report: Report, test = false) {
  const table = report.rows.length ? `<table cellpadding="9" cellspacing="0" style="border-collapse:collapse;width:100%;text-align:left"><thead><tr><th>Produto</th><th>Quantidade total</th><th>Unidade</th><th>Entradas</th></tr></thead><tbody>${report.rows.map(row => `<tr><td style="border-top:1px solid #ddd">${escapeHtml(row.name)}</td><td style="border-top:1px solid #ddd">${escapeHtml(row.quantity.replace(".", ","))}</td><td style="border-top:1px solid #ddd">${escapeHtml(row.unit)}</td><td style="border-top:1px solid #ddd">${row.entries}</td></tr>`).join("")}</tbody></table>` : "<p>Sem entradas de produtos químicos neste período.</p>";
  const notice = test ? "<p><strong>TESTE: pré-visualização dos dados disponíveis. Não corresponde ao fecho mensal e não altera o envio automático.</strong></p>" : "";
  return `<html lang="pt"><body style="font-family:Arial,sans-serif;color:#222"><h1 style="font-size:22px">Entradas de produtos químicos</h1>${notice}<p>Período: ${report.start.split("-").reverse().join("/")} a ${report.end.split("-").reverse().join("/")}.</p><p>Olá,<br>Segue o resumo mensal, com as quantidades somadas por produto.</p>${table}<p>Inclui entradas diretas e stock inicial. Não inclui ajustes nem saídas. As quantidades são apresentadas na unidade de stock atual de cada produto, sem somar unidades diferentes.</p><p>O relatório em CSV segue em anexo e pode ser aberto no Excel.</p></body></html>`;
}

export async function sendMonthlyChemicalReport(now = new Date()) {
  const schedule = monthlyChemicalSchedule(now);
  if (!schedule.due) return { skipped: true, dueDate: schedule.dueDate, month: schedule.month, sent: 0, failed: 0 };
  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    where: { active: true, role: { in: ["HSA", "ADMIN"] } },
    select: { id: true, email: true },
    orderBy: { id: "asc" },
  });
  if (!users.length) throw new Error("Não existem destinatários HSA/Admin ativos.");
  const report = await buildMonthlyChemicalReport(schedule.month);
  const subject = `Entradas de produtos químicos - ${schedule.month}`;
  const html = monthlyChemicalHtml(report);
  const attachment = { filename: `entradas-quimicos-${schedule.month}.csv`, content: Buffer.from(monthlyChemicalCsv(report), "utf8"), contentType: "text/csv; charset=utf-8" };
  let sent = 0, failed = 0;
  for (const user of users) {
    try {
      if (!isDeliverableEmail(user.email)) throw new Error("Destinatário sem endereço de email válido.");
      const delivered = await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${channel}), hashtext(${user.id}))`;
        const previous = await tx.alertDigestDelivery.findUnique({
          where: { userId_digestDate_channel: { userId: user.id, digestDate: schedule.month, channel } },
          select: { id: true },
        });
        if (previous) return false;
        const key = createHash("sha256").update(JSON.stringify([channel, user.id, schedule.month])).digest("hex");
        await sendGmail(user.email, subject, html, key, [attachment]);
        await tx.alertDigestDelivery.create({ data: { userId: user.id, digestDate: schedule.month, channel, subject } });
        return true;
      }, { timeout: 30_000 });
      if (delivered) sent++;
    } catch (error) {
      failed++;
      console.error("Falha no relatório mensal de químicos", user.id, error instanceof Error ? error.message : "Erro desconhecido");
    }
  }
  return { skipped: false, month: schedule.month, products: report.rows.length, recipients: users.length, sent, failed };
}
