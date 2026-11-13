import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import {
  dailyEntryStatus, dailyResults, displayDay, displayRecordedAt, entryChecks,
  type dailyMaintenanceMonth,
} from "@/lib/daily-maintenance";
import { documentCode, type maintenanceGroup } from "@/lib/mcc-maintenance-plan";

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
  doc.font("Helvetica-Bold").fontSize(19).text("Registo mensal de manutenção preventiva");
  doc.moveDown(0.4).font("Helvetica").fontSize(10)
    .text(`${equipment.name} | ${equipment.code}`)
    .text(`${month}/${year} | Impresso de referência ${documentCode}`)
    .text(`${group.label} | Pág. ${group.pages} | ${group.primary}`)
    .text(`Emitido em ${displayRecordedAt(new Date())}`);
  doc.moveDown().font("Helvetica-Bold").text("Resumo diário");
  const days = group.key === "daily" ? report.days : report.days.filter(({ entries }) => entries.length > 0);
  for (const { day, future, entries } of days) {
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
    doc.font("Helvetica").fontSize(10)
      .text(`${entry.recorderName} | ${displayRecordedAt(entry.recordedAt)} | ${entry.documentCode}`);
    if (entry.meterHours !== null) doc.text(`Horímetro: ${entry.meterHours.toString()} h`);
    entryChecks(entry).forEach(({ label, result }) => doc.text(`${dailyResults[result]}: ${label}`));
    if (entry.notes) doc.text(`Observações: ${entry.notes}`);
    doc.moveDown();
  }
  doc.end();
  return buffer;
}
