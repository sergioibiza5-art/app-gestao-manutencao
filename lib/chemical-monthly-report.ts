import { createHash } from "node:crypto";
import { chemicalMonth, monthlyChemicalSchedule } from "@/lib/chemical-monthly-calendar";
import { csvCell } from "@/lib/chemical-report-utils";
import { escapeHtml, isDeliverableEmail } from "@/lib/email-alerts";
import { sendGmail } from "@/lib/gmail";
import { getPrisma } from "@/lib/prisma";
import { chemicalTypes, productTypeLabel } from "@/lib/product-types";
import { chemicalMeasurement, chemicalVolumeTotal, chemicalMassTotal } from "@/lib/chemical-volume";
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
    return { ...product, quantity, entries: totals._count._all, ...chemicalMeasurement(product, quantity) };
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
  const groups = chemicalReportGroups(report);
  const number = (value: string | null | undefined) => value?.replace(".", ",") ?? "";
  const rows: unknown[][] = [
    [report.title || "Entradas mensais de produtos químicos", report.start, report.end, "Europe/Lisbon"],
    ["Inclui entradas diretas e stock inicial. Exclui ajustes e saídas. Uma linha por produto; classificação e unidades atuais. Totais separados em litros (L) e peso (kg), sem conversão entre ambos."],
    ["Produto", "Tipo de produto", "Grupo", "Quantidade total", "Unidade de stock", "Litros por unidade de stock", "Total (L)", "Kg por unidade de stock", "Total (kg)", "Estado da conversão", "N.º de entradas", "Fornecedor atual", ...(report.breakdown ? ["Stock inicial (unidade de stock)", "Entradas diretas (unidade de stock)"] : [])],
    ...[...groups.volume, ...groups.mass, ...groups.unknown].map(row => [row.name, productTypeLabel(row.productType), row.totalLitres !== null ? "Volume (L)" : row.totalKilograms !== null ? "Peso (kg)" : "Por confirmar", number(row.quantity), row.unit, number(row.litresPerUnit), number(row.totalLitres), number(row.kilogramsPerUnit), number(row.totalKilograms), row.totalLitres === null && row.totalKilograms === null ? "Conteúdo por embalagem em volume ou peso não configurado." : "", row.entries, row.supplier, ...(report.breakdown ? [number(report.breakdown[row.id]?.initial), number(report.breakdown[row.id]?.direct)] : [])]),
  ];
  if (!report.rows.length) rows.push(["Sem entradas de produtos químicos neste período."]);
  else {
    const pending = groups.unknown.length ? `${groups.unknown.length} produto(s) por confirmar; não incluídos nos totais.` : "";
    rows.push(["TOTAL APURADO (L)", "", "Volume (L)", "", "", "", groups.volume.length ? number(chemicalVolumeTotal(groups.volume).litres) : "", "", "", pending]);
    rows.push(["TOTAL APURADO (kg)", "", "Peso (kg)", "", "", "", "", "", groups.mass.length ? number(chemicalMassTotal(groups.mass)) : "", pending]);
  }
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(";")).join("\r\n");
}

export function chemicalReportGroups(report: Report) {
  return {
    volume: report.rows.filter(row => row.totalLitres !== null),
    mass: report.rows.filter(row => row.totalLitres === null && row.totalKilograms !== null),
    unknown: report.rows.filter(row => row.totalLitres === null && row.totalKilograms === null),
  };
}

function chemicalReportSection(report: Report, test: boolean) {
  const groups = chemicalReportGroups(report);
  function table(rows: Report["rows"], unit: "L" | "kg") {
    if (!rows.length) return `<p>Sem produtos registados em ${unit} neste período.</p>`;
    const total = unit === "L" ? chemicalVolumeTotal(rows).litres : chemicalMassTotal(rows);
    const tableRows = rows.map(row => `<tr>
    <td style="border-top:1px solid #ddd">${escapeHtml(row.name)}</td>
    <td style="border-top:1px solid #ddd">${escapeHtml(row.quantity.replace(".", ","))}${report.breakdown ? `<br><small>Stock inicial: ${escapeHtml(report.breakdown[row.id]?.initial.replace(".", ","))}<br>Entradas diretas: ${escapeHtml(report.breakdown[row.id]?.direct.replace(".", ","))}</small>` : ""}</td>
    <td style="border-top:1px solid #ddd">${escapeHtml(row.unit)}</td>
    <td style="border-top:1px solid #ddd">${escapeHtml((unit === "L" ? row.litresPerUnit : row.kilogramsPerUnit)?.replace(".", ","))}</td>
    <td style="border-top:1px solid #ddd">${escapeHtml((unit === "L" ? row.totalLitres : row.totalKilograms)?.replace(".", ","))}</td>
    <td style="border-top:1px solid #ddd">${row.entries}</td>
  </tr>`).join("");
    return `<table cellpadding="9" cellspacing="0" style="border-collapse:collapse;width:100%;text-align:left">
    <thead><tr><th>Produto</th><th>Quantidade total</th><th>Unidade de stock</th><th>${unit} por unidade</th><th>Total (${unit})</th><th>Entradas</th></tr></thead>
    <tbody>${tableRows}</tbody>
    <tfoot><tr><th colspan="4" style="border-top:2px solid #888">Total apurado (${unit})</th><th style="border-top:2px solid #888">${escapeHtml(total.replace(".", ","))}</th><td style="border-top:2px solid #888"></td></tr></tfoot>
  </table>`;
  }
  const pending = groups.unknown.length ? `<h2 style="font-size:18px">Produtos por confirmar</h2><p>Não incluídos nos totais em L ou kg: falta a configuração do conteúdo por embalagem.</p><ul>${groups.unknown.map(row => `<li>${escapeHtml(row.name)}: ${escapeHtml(row.quantity.replace(".", ","))} ${escapeHtml(row.unit)}</li>`).join("")}</ul>` : "";
  const notice = test ? "<p><strong>TESTE: pré-visualização dos dados disponíveis. Não corresponde ao fecho mensal e não altera o envio automático.</strong></p>" : "";
  const introduction = report.introductoryNote ? escapeHtml(report.introductoryNote) : "Olá,<br>Segue o resumo mensal, com as quantidades somadas por produto.";
  return `<h1 style="font-size:22px">${escapeHtml(report.title || "Entradas de produtos químicos")}</h1>${notice}<p>Período: ${report.start.split("-").reverse().join("/")} a ${report.end.split("-").reverse().join("/")}.</p><p>${introduction}</p>${!report.rows.length ? "<p>Sem entradas de produtos químicos neste período.</p>" : ""}<h2 style="font-size:18px">Produtos em volume (L)</h2>${table(groups.volume, "L")}<h2 style="font-size:18px">Produtos em peso (kg)</h2>${table(groups.mass, "kg")}${pending}<p>Inclui entradas diretas e stock inicial. Não inclui ajustes nem saídas. As quantidades são mantidas na unidade de stock e normalizadas separadamente em litros (L) ou quilogramas (kg), usando o conteúdo atual da embalagem. Converte ml em L e g em kg; nunca converte peso em volume nem soma L com kg.</p><p>O relatório em CSV segue em anexo e pode ser aberto no Excel.</p>`;
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
