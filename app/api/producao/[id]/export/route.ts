import * as XLSX from "xlsx";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import { productionBatchAccess } from "@/lib/production-data";
import { elapsedMinutes, stopMinutes, minutesLabel, productionBatchMinutes, productionPeopleSummary, productionStatuses, productionOperations } from "@/lib/production";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const timeFormat = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "medium" });
const date = (d: Date | null) => d ? timeFormat.format(d) : "";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { batch, user } = await productionBatchAccess((await params).id);
  const now = new Date();
  const operators = productionPeopleSummary(batch.activities, [], now);
  const technicians = productionPeopleSummary([], batch.qualityCalls, now);
  const batchMinutes = productionBatchMinutes(batch, now);
  const personRows = [
    ...operators.rows.map(p => [p.username || "", p.name, date(p.startedAt), p.open ? "Em curso" : date(p.endedAt), p.totalMinutes / 60, 0, p.totalMinutes / 60, p.sessions, "Produção"]),
    ...technicians.rows.map(p => [p.username || "", p.name, date(p.startedAt), p.open ? "Em curso" : date(p.endedAt), 0, p.totalMinutes / 60, p.totalMinutes / 60, p.sessions, "Controlo de qualidade"]),
  ];
  const activities = batch.activities.map(a => [a.collaborator.username || "", a.collaborator.name, a.operation, date(a.startedAt), date(a.endedAt), elapsedMinutes(a.startedAt, a.endedAt, now) / 60, a.notes]);
  const quality = batch.qualityCalls.map(q => [date(q.calledAt), date(q.arrivedAt), date(q.endedAt), q.technician?.name || "", elapsedMinutes(q.calledAt, q.arrivedAt, now), q.arrivedAt ? elapsedMinutes(q.arrivedAt, q.endedAt, now) : 0,
    q.hasStop ? "Sim" : "Não", date(q.stopStartedAt), date(q.stopEndedAt), q.hasStop && q.stopStartedAt ? elapsedMinutes(q.stopStartedAt, q.stopEndedAt, now) : 0, q.notes]);
  const downtime = stopMinutes(batch.qualityCalls.flatMap(q => q.hasStop && q.stopStartedAt ? [{ start: q.stopStartedAt, end: q.stopEndedAt }] : []), now);
  const labour = batch.activities.reduce((sum, a) => sum + elapsedMinutes(a.startedAt, a.endedAt, now), 0);
  const cqLabour = batch.qualityCalls.reduce((sum, q) => sum + (q.arrivedAt ? elapsedMinutes(q.arrivedAt, q.endedAt, now) : 0), 0);
  const status = productionStatuses[batch.status as keyof typeof productionStatuses];
  const summary = [
    ["Registo de atividades e tempos de produção", "IMPPRO0604.00 · registo digital"],
    ["Referência", batch.reference], ["Lote", batch.lot], ["Sala / linha", batch.line],
    ["Equipamento", `${batch.equipment.code || ""} · ${batch.equipment.name}`], ["Estado", status],
    ["Quantidade produzida", Number(batch.quantity)], ["Quantidade desperdício", batch.wasteQuantity == null ? "Não registado" : Number(batch.wasteQuantity)], ["Unidade", batch.unit],
    ["Início do lote", date(batch.startedAt)], ["Fim do lote", date(batch.endedAt)],
    ["Tempo decorrido do lote (h)", batchMinutes === null ? "Sem tempos registados" : batchMinutes / 60],
    ["Mão de obra dos operadores (h)", labour / 60], ["Controlo de qualidade (h)", cqLabour / 60], ["Paragem de produção (min)", downtime],
    ["Observações", batch.notes], ["Conferido em", date(batch.verifiedAt)], ["Emitido em (Lisboa)", date(now)], ["Emitido por", user.name],
  ];
  const filename = `producao-${batch.id}`;
  if (new URL(request.url).searchParams.get("format") === "xlsx") {
    const workbook = XLSX.utils.book_new();
    for (const [name, rows] of [
      ["Resumo", summary],
      ["Pessoas", [["N.º colaborador", "Colaborador", "Primeiro início (Lisboa)", "Último fim (Lisboa)", "Produção (h)", "CQ (h)", "Total (h)", "Registos", "Área"], ...personRows, ["", "Total de produção", "", "", labour / 60, "", labour / 60, "", "Produção"], ["", "Total de CQ", "", "", "", cqLabour / 60, cqLabour / 60, "", "Controlo de qualidade"]]],
      ["Atividades", [["N.º colaborador", "Colaborador", "Operação", "Início (Lisboa)", "Fim (Lisboa)", "Tempo (h)", "Observações"], ...activities]],
      ["Qualidade", [["Chamada", "Chegada", "Fim CQ", "Técnico", "Espera (min)", "Controlo (min)", "Paragem", "Início paragem", "Fim paragem", "Paragem (min)", "Observações"], ...quality]],
      ["Histórico", [["Data (Lisboa)", "Registado por", "Ação", "Motivo"], ...batch.audits.map(a => [date(a.createdAt), a.actorName, a.action, a.reason])]],
      ["Operações", [["Código", "Designação"], ...Object.entries(productionOperations), ["CQ", "Controlo de qualidade (registo separado)"]]],
    ] as [string, (string | number)[][]][]) {
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      sheet["!cols"] = Array.from({ length: Math.max(...rows.map(row => row.length)) }, () => ({ wch: 26 }));
      XLSX.utils.book_append_sheet(workbook, sheet, name);
    }
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}.xlsx"`, "Cache-Control": "no-store" } });
  }
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 32, bufferPages: true, info: { Title: `Produção ${batch.reference} - ${batch.lot}`, Author: user.name } });
  const output = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (b: Buffer) => chunks.push(b)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
  });
  const width = doc.page.width - 64;
  function section(label: string) {
    if (doc.y > 470) doc.addPage();
    doc.x = 32;
    doc.moveDown().font("Helvetica-Bold").fontSize(13).fillColor("#11685c").text(label).moveDown(0.5);
  }
  function paragraph(label: string) {
    doc.font("Helvetica").fontSize(9).fillColor("#222222").text(label, 32, doc.y, { width }).moveDown(0.4);
  }
  section("Registo de atividades e tempos de produção");
  for (const row of summary) paragraph(`${row[0]}: ${typeof row[1] === "number" ? row[1].toLocaleString("pt-PT", { maximumFractionDigits: 3 }) : row[1]}`);
  for (const [title, summary] of [["Produção", operators], ["Controlo de qualidade", technicians]] as const) {
    if (doc.y > 400) doc.addPage();
    section(`Resumo de horas por pessoa - ${title}`);
    if (!summary.rows.length) paragraph("Sem tempos individuais registados.");
    for (const person of summary.rows) {
      if (doc.y > 440) doc.addPage();
      paragraph(`${person.username || ""} ${person.name} | Primeiro início: ${date(person.startedAt)} | Último fim: ${person.open ? "Em curso" : date(person.endedAt)}`);
      paragraph(`Tempo: ${minutesLabel(person.totalMinutes)} | Registos: ${person.sessions}`);
    }
    paragraph(`Total de ${title.toLocaleLowerCase("pt-PT")}: ${minutesLabel(summary.totalMinutes)}`);
  }
  section("Atividades dos colaboradores");
  for (const a of batch.activities) {
    if (doc.y > 470) doc.addPage();
    paragraph(`${a.collaborator.username || ""} ${a.collaborator.name} | ${a.operation} | ${date(a.startedAt)} - ${a.endedAt ? date(a.endedAt) : "Em curso"} | ${minutesLabel(elapsedMinutes(a.startedAt, a.endedAt, now))}`);
    if (a.notes) paragraph(a.notes);
  }
  section("Controlo de qualidade");
  for (const q of batch.qualityCalls) {
    if (doc.y > 440) doc.addPage();
    paragraph(`Chamada: ${date(q.calledAt)} | Chegada: ${date(q.arrivedAt) || "Por chegar"} | Fim: ${date(q.endedAt) || "Em curso"} | Técnico: ${q.technician?.name || "Por atribuir"}`);
    paragraph(`Espera: ${minutesLabel(elapsedMinutes(q.calledAt, q.arrivedAt, now))} | Controlo: ${q.arrivedAt ? minutesLabel(elapsedMinutes(q.arrivedAt, q.endedAt, now)) : "Ainda não iniciado"}`);
    paragraph(q.hasStop ? `Paragem: ${date(q.stopStartedAt)} - ${date(q.stopEndedAt) || "Em curso"}` : "Sem paragem de produção.");
    if (q.notes) paragraph(q.notes);
  }
  section("Conferência e alterações");
  for (const audit of batch.audits) paragraph(`${date(audit.createdAt)} | ${audit.actorName} | ${audit.action}${audit.reason ? ` | ${audit.reason}` : ""}`);
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor("#555555").text(`${batch.reference} | ${batch.lot} | ${status} | ${i + 1}/${range.count}`, 32, doc.page.height - 46, { width, lineBreak: false });
  }
  doc.end();
  return new Response(new Uint8Array(await output), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}.pdf"`, "Cache-Control": "no-store" } });
}
