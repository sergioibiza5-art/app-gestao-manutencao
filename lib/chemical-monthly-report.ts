import { createHash } from "node:crypto";
import { chemicalMonth, monthlyChemicalSchedule } from "@/lib/chemical-monthly-calendar";
import { csvCell } from "@/lib/chemical-report-utils";
import { escapeHtml, isDeliverableEmail } from "@/lib/email-alerts";
import { sendGmail } from "@/lib/gmail";
import { getPrisma } from "@/lib/prisma";
import { chemicalTypes, productTypeLabel } from "@/lib/product-types";
import { chemicalVolume, chemicalVolumeTotal } from "@/lib/chemical-volume";
import { buildChemicalOpeningReport, openingDeliveryChannel, openingDigestDate, openingReportRequired } from "@/lib/chemical-opening-report";

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
    select: { id: true, name: true, productType: true, unit: true, supplier: true, packageQuantity: true, packageUnit: true },
  });
  const quantities = new Map(grouped.map(row => [row.consumableId, row]));
  const rows = products.map(product => {
    const totals = quantities.get(product.id)!;
    const quantity = totals._sum.quantity!.toFixed();
    return { ...product, quantity, entries: totals._count._all, ...chemicalVolume(product, quantity) };
  }).sort((a, b) => a.name.localeCompare(b.name, "pt") || a.id.localeCompare(b.id));
  return { ...period, rows };
}

export type ChemicalReport = Awaited<ReturnType<typeof buildMonthlyChemicalReport>> & {
  title?: string;
  introductoryNote?: string;
  breakdown?: Record<string, { initial: string; direct: string }>;
};
type Report = ChemicalReport;

export function monthlyChemicalCsv(report: Report) {
  const total = chemicalVolumeTotal(report.rows);
  const hasVolume = report.rows.some(row => row.totalLitres !== null);
  const rows: unknown[][] = [
    [report.title || "Entradas mensais de produtos químicos", report.start, report.end, "Europe/Lisbon"],
    ["Inclui entradas diretas e stock inicial. Exclui ajustes e saídas. Uma linha por produto; classificação e unidade atuais."],
    ["Produto", "Tipo de produto", "Quantidade total", "Unidade de stock", "Litros por unidade de stock", "Total (L)", "Conversão em litros", "N.º de entradas", "Fornecedor atual", ...(report.breakdown ? ["Stock inicial (unidade de stock)", "Entradas diretas (unidade de stock)"] : [])],
    ...report.rows.map(row => [row.name, productTypeLabel(row.productType), row.quantity.replace(".", ","), row.unit, row.litresPerUnit?.replace(".", ","), row.totalLitres?.replace(".", ","), row.litreNote, row.entries, row.supplier, ...(report.breakdown ? [report.breakdown[row.id]?.initial.replace(".", ","), report.breakdown[row.id]?.direct.replace(".", ",")] : [])]),
  ];
  if (!report.rows.length) rows.push(["Sem entradas de produtos químicos neste período."]);
  else rows.push(["TOTAL APURADO (L)", "", "", "", "", hasVolume ? total.litres.replace(".", ",") : "", total.missing ? `Total parcial: ${total.missing} produto(s) sem conversão em litros.` : ""]);
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(";")).join("\r\n");
}

function chemicalReportSection(report: Report, test: boolean) {
  const total = chemicalVolumeTotal(report.rows);
  const hasVolume = report.rows.some(row => row.totalLitres !== null);
  const totalLabel = !hasVolume ? "Total não apurado (L)" : total.missing ? "Total parcial apurado (L)" : "Total apurado (L)";
  const tableRows = report.rows.map(row => `<tr>
    <td style="border-top:1px solid #ddd">${escapeHtml(row.name)}</td>
    <td style="border-top:1px solid #ddd">${escapeHtml(row.quantity.replace(".", ","))}${report.breakdown ? `<br><small>Stock inicial: ${escapeHtml(report.breakdown[row.id]?.initial.replace(".", ","))}<br>Entradas diretas: ${escapeHtml(report.breakdown[row.id]?.direct.replace(".", ","))}</small>` : ""}</td>
    <td style="border-top:1px solid #ddd">${escapeHtml(row.unit)}</td>
    <td style="border-top:1px solid #ddd">${escapeHtml(row.litresPerUnit?.replace(".", ",") ?? "-")}</td>
    <td style="border-top:1px solid #ddd">${row.totalLitres === null ? escapeHtml(row.litreNote) : escapeHtml(row.totalLitres.replace(".", ","))}</td>
    <td style="border-top:1px solid #ddd">${row.entries}</td>
  </tr>`).join("");
  const table = report.rows.length ? `<table cellpadding="9" cellspacing="0" style="border-collapse:collapse;width:100%;text-align:left">
    <thead><tr><th>Produto</th><th>Quantidade total</th><th>Unidade</th><th>L por unidade</th><th>Total (L)</th><th>Entradas</th></tr></thead>
    <tbody>${tableRows}</tbody>
    <tfoot><tr><th colspan="4" style="border-top:2px solid #888">${totalLabel}</th><th style="border-top:2px solid #888">${hasVolume ? escapeHtml(total.litres.replace(".", ",")) : "Por confirmar"}</th><td style="border-top:2px solid #888"></td></tr></tfoot>
  </table>` : "<p>Sem entradas de produtos químicos neste período.</p>";
  const volumeNote = total.missing ? `<p>${total.missing} produto(s) sem conversão em litros. O total apurado inclui apenas os produtos com volume conhecido; não foi atribuída quantidade zero aos restantes.</p>` : "";
  const notice = test ? "<p><strong>TESTE: pré-visualização dos dados disponíveis. Não corresponde ao fecho mensal e não altera o envio automático.</strong></p>" : "";
  const introduction = report.introductoryNote ? escapeHtml(report.introductoryNote) : "Olá,<br>Segue o resumo mensal, com as quantidades somadas por produto.";
  return `<h1 style="font-size:22px">${escapeHtml(report.title || "Entradas de produtos químicos")}</h1>${notice}<p>Período: ${report.start.split("-").reverse().join("/")} a ${report.end.split("-").reverse().join("/")}.</p><p>${introduction}</p>${table}${volumeNote}<p>Inclui entradas diretas e stock inicial. Não inclui ajustes nem saídas. Mantém as quantidades na unidade de stock e acrescenta os litros, calculados pela capacidade atual da embalagem registada no produto. Se o stock já estiver em L ou ml, converte diretamente sem voltar a multiplicar pela embalagem. Não converte massas em litros.</p><p>O relatório em CSV segue em anexo e pode ser aberto no Excel.</p>`;
}

export function monthlyChemicalHtml(report: Report, test = false, opening?: Report) {
  return `<html lang="pt"><body style="font-family:Arial,sans-serif;color:#222">${chemicalReportSection(report, test)}${opening ? `<hr style="margin:32px 0">${chemicalReportSection(opening, test)}` : ""}</body></html>`;
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
  const opening = schedule.month === "2026-11" ? await buildChemicalOpeningReport() : undefined;
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
        let includeOpening = false;
        if (opening) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${openingDeliveryChannel}), hashtext(${user.id}))`;
          const deliveredOpening = await tx.alertDigestDelivery.findUnique({
            where: { userId_digestDate_channel: { userId: user.id, digestDate: openingDigestDate, channel: openingDeliveryChannel } }, select: { id: true },
          });
          includeOpening = openingReportRequired(schedule.month, Boolean(deliveredOpening));
        }
        const subject = `Entradas de produtos químicos - ${schedule.month}${includeOpening ? " + relatório inicial de 2026" : ""}`;
        const html = monthlyChemicalHtml(report, false, includeOpening ? opening : undefined);
        const attachments = [attachment, ...(includeOpening && opening ? [{ filename: "entradas-quimicos-inicial-2026.csv", content: Buffer.from(monthlyChemicalCsv(opening), "utf8"), contentType: "text/csv; charset=utf-8" }] : [])];
        const key = createHash("sha256").update(JSON.stringify([channel, user.id, schedule.month])).digest("hex");
        await sendGmail(user.email, subject, html, key, attachments);
        await tx.alertDigestDelivery.create({ data: { userId: user.id, digestDate: schedule.month, channel, subject } });
        if (includeOpening) await tx.alertDigestDelivery.create({ data: { userId: user.id, digestDate: openingDigestDate, channel: openingDeliveryChannel, subject } });
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
