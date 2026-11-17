import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import {
  cleaningDetails, cleaningPerformerName, dailyEntryStatus, dailyResults, displayDay, displayRecordedAt, entryChecks,
  type dailyMaintenanceMonth,
} from "@/lib/daily-maintenance";
import { isCleaning, type maintenanceGroup } from "@/lib/mcc-maintenance-plan";

function cleaningSummary(
  doc: PDFKit.PDFDocument,
  days: Awaited<ReturnType<typeof dailyMaintenanceMonth>>["days"],
) {
  const widths = [64, 105, 161, 159];
  const left = doc.page.margins.left;
  const textOptions = (width: number) => ({ width: width - 10, lineGap: 1 });
  function row(values: string[], header = false) {
    doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(9);
    let y = doc.y;
    const height = Math.max(...values.map((value, i) => doc.heightOfString(value, textOptions(widths[i])))) + 8;
    if (!header && y + height > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      heading();
      doc.font("Helvetica").fontSize(9);
      y = doc.y;
    }
    let x = left;
    values.forEach((value, i) => {
      doc.text(value, x + 5, y + 3, textOptions(widths[i]));
      x += widths[i];
    });
    doc.save().strokeColor("#d4d4d4").lineWidth(0.5).moveTo(left, y + height).lineTo(x, y + height).stroke().restore();
    doc.x = left;
    doc.y = y + height;
  }
  function heading() {
    row(["Data", "Estado", "Executada por", "Verificada por"], true);
  }
  heading();
  for (const { day, future, entries } of days) {
    const entry = entries[0];
    row([
      displayDay(day),
      future && !entry ? "Dia futuro" : dailyEntryStatus(entry),
      entry ? `${cleaningPerformerName(entry)}\n${displayRecordedAt(entry.recordedAt)}` : "",
      entry?.verifiedAt ? `${entry.verifierName ?? "Nome não registado"}\n${displayRecordedAt(entry.verifiedAt)}` : entry ? "Por verificar" : "",
    ]);
  }
}

export async function dailyMaintenancePdf(
  equipment: { name: string; code: string | null },
  report: Awaited<ReturnType<typeof dailyMaintenanceMonth>>,
  group: ReturnType<typeof maintenanceGroup>,
) {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const buffer = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const [year, month] = report.month.split("-");
  const cleaning = isCleaning(group.key);
  doc.font("Helvetica-Bold").fontSize(19).text(cleaning ? "Registo mensal de limpeza" : "Registo mensal de manutenção preventiva");
  doc.moveDown(0.4).font("Helvetica").fontSize(10)
    .text(`${equipment.name} | ${equipment.code}`)
    .text(`${month}/${year} | Impresso de referência ${group.documentCode}`)
    .text(`${group.label} | Pág. ${group.pages} | ${group.primary}`)
    .text(`Emitido em ${displayRecordedAt(new Date())}`);
  doc.moveDown().font("Helvetica-Bold").text("Resumo diário");
  const days = group.key === "daily" || group.key === "cleaning-daily" ? report.days : report.days.filter(({ entries }) => entries.length > 0);
  if (cleaning) cleaningSummary(doc, days);
  else for (const { day, future, entries } of days) {
    const latest = entries[0];
    const status = future && !latest ? "Dia futuro" : dailyEntryStatus(latest);
    doc.font("Helvetica").fontSize(10)
      .text(`${displayDay(day)}  |  ${status}${latest ? `  |  ${latest.recorderName}` : ""}`, { lineGap: 3 });
  }

  doc.addPage().font("Helvetica-Bold").fontSize(15).text("Verificações e histórico");
  doc.moveDown(0.5);
  group.checks.forEach(({ label }, index) => {
    doc.font("Helvetica").fontSize(10).text(`${index + 1}. ${label}`);
  });
  doc.moveDown();
  const entries = report.days.flatMap(({ entries }) => [...entries].reverse());
  if (!entries.length) doc.text("Sem verificações ou marcações neste mês.");
  for (const entry of entries) {
    if (doc.y > doc.page.height - 120) doc.addPage();
    doc.font("Helvetica-Bold").fontSize(11).text(
      `${displayDay(entry.day.toISOString().slice(0, 10))} | ${dailyEntryStatus(entry)} | Registo ${entry.revision}`,
    );
    const materials = cleaningDetails(entry);
    doc.font("Helvetica").fontSize(10).text(materials
      ? `Executada por: ${cleaningPerformerName(entry)} | ${displayRecordedAt(entry.recordedAt)} | ${entry.documentCode}`
      : `${entry.recorderName} | ${displayRecordedAt(entry.recordedAt)} | ${entry.documentCode}`);
    if (materials?.performedBy) doc.text(`Conta do posto: ${entry.recorderName}`);
    if (entry.meterHours !== null) doc.text(`Horímetro: ${entry.meterHours.toString()} h`);
    entryChecks(entry).forEach(({ label, result, reading }) => doc.text(`${dailyResults[result]}: ${label}${reading ? ` | ${reading}` : ""}`));
    if (materials) {
      doc.text(`Produtos utilizados: ${materials.products}`);
      if (materials.tools) doc.text(`Equipamentos utilizados: ${materials.tools}`);
      doc.text(entry.verifiedAt
        ? `Verificada por: ${entry.verifierName ?? "Nome não registado"} | ${displayRecordedAt(entry.verifiedAt)}`
        : "Verificada por: Por verificar");
    }
    if (entry.notes) doc.text(`Observações: ${entry.notes}`);
    doc.moveDown();
  }
  doc.end();
  return buffer;
}
