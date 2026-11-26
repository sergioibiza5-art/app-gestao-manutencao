import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import { evidenceLink, type WorkOrderReport } from "@/lib/work-order-report";
import { workOrderStatuses } from "@/lib/work-order-search";
import { formatCurrency } from "@/lib/format";

const timeFormat = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Lisbon" });
const date = (value: Date | null) => value ? timeFormat.format(value) : "Não registado";
const duration = (value: number) => {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds % 3600 / 60)).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`;
};

export async function workOrderPdf(report: WorkOrderReport, emittedBy: string, origin: string, now = new Date()) {
  const { order: op } = report;
  const doc = new PDFDocument({ size: "A4", margin: 42, bufferPages: true, info: { Title: `Relatório ${op.number}`, Author: emittedBy, Subject: "Registo de intervenção e evidências de manutenção" } });
  const buffer = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const left = 42, width = doc.page.width - 84;
  function header() {
    doc.font("Helvetica").fontSize(8).fillColor("#555555").text(`Gestão de manutenção | ${op.number}`, left, 28, { width, lineBreak: false });
    doc.x = left; doc.y = 52;
  }
  header();
  function room(height = 52) {
    if (doc.y + height > doc.page.height - 56) doc.addPage();
    doc.x = left;
  }
  function section(title: string) {
    room(65);
    doc.moveDown(0.6).font("Helvetica-Bold").fontSize(12).fillColor("#11685c").text(title, { width }).moveDown(0.5);
  }
  function field(label: string, value: unknown) {
    room(34);
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#555555").text(label, { width, lineGap: 2 });
    doc.font("Helvetica").fontSize(10).fillColor("#222222").text(value === null || value === undefined || value === "" ? "Não registado" : String(value), { width, lineGap: 2 }).moveDown(0.45);
  }
  function pairs(entries: [string, unknown][]) {
    const columnWidth = (width - 18) / 2;
    for (let i = 0; i < entries.length; i += 2) {
      const cells = entries.slice(i, i + 2).map(([label, value]) => [label, value == null || value === "" ? "Não registado" : String(value)]);
      doc.font("Helvetica").fontSize(10);
      const height = Math.max(...cells.map(([, value]) => doc.heightOfString(value, { width: columnWidth, lineGap: 2 }))) + 23;
      if (height > 180) { for (const [label, value] of cells) field(label, value); continue; }
      room(height);
      const top = doc.y;
      cells.forEach(([label, value], column) => {
        const x = left + column * (columnWidth + 18);
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#555555").text(label, x, top, { width: columnWidth });
        doc.font("Helvetica").fontSize(10).fillColor("#222222").text(value, x, top + 12, { width: columnWidth, lineGap: 2 });
      });
      doc.x = left; doc.y = top + height;
    }
  }
  function link(label: string, value: string | null) {
    room(42);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#222222").text(label, { width });
    const url = value ? evidenceLink(value, origin) : null;
    if (url) doc.font("Helvetica").fontSize(8).fillColor("#075985").text(url, { width, link: url, underline: true, lineGap: 2 });
    else doc.font("Helvetica").fontSize(9).fillColor("#555555").text("Sem ligação exportável (apenas HTTP/HTTPS).", { width });
    doc.moveDown(0.6);
  }

  doc.font("Helvetica-Bold").fontSize(22).fillColor("#222222").text(`Relatório ${op.number}`, { width });
  doc.font("Helvetica").fontSize(12).text(op.title, { width }).moveDown(0.6);
  field("Estado da OP", workOrderStatuses[op.status]);
  if (!["DONE", "VALIDATED", "CANCELED"].includes(op.status)) field("Documento em curso", "A OP ainda não está concluída. Os dados apresentados correspondem ao estado atual.");
  field("Emissão", `${date(now)} (Europe/Lisbon) | Emitido por: ${emittedBy}`);
  if (report.codification) field("Codificação do impresso", report.codification);
  field("Referência do registo", `${op.id} | Última alteração da OP: ${date(op.updatedAt)}`);

  section("Identificação do equipamento");
  pairs([
    ["Equipamento", op.equipment.name], ["Código interno", op.equipment.code],
    ["Tipo de equipamento", op.equipment.equipmentType?.name], ["Modelo", op.equipment.model],
    ["Número de série", op.equipment.serialNumber], ["Localização", op.equipment.location],
  ]);

  section("Intervenção e tempos registados");
  pairs([
    ["Tipo de manutenção", op.type === "INTERNAL" ? "Interna" : "Externa"],
    ["Agendamento", op.schedule ? `${date(op.schedule.scheduledAt)} | ${op.schedule.title}` : null],
    ["Atribuída a", op.schedule?.assignedTo?.name], ["Executado por", op.performedBy],
    ["Prestador de serviços", op.supplier], ["Abertura", date(op.openedAt)],
    ["Início", date(op.startedAt)], ["Conclusão", date(op.closedAt)], ["Validação", date(op.validatedAt)],
    ["Tempo de trabalho registado", duration(op.totalWorkSeconds)],
    ["Tempo decorrido entre início e conclusão", op.startedAt && op.closedAt && op.closedAt >= op.startedAt ? duration((op.closedAt.valueOf() - op.startedAt.valueOf()) / 1000) : null],
  ]);
  field("Trabalho executado", op.actionsDone || op.maintenanceLog?.description);
  field("Resultado", op.result);
  field("Nota sobre os tempos", "O tempo de trabalho registado e o tempo decorrido entre início e conclusão são medidas diferentes; o segundo pode incluir pausas e esperas.");

  const record = op.checklistRecord;
  const references: { label: string; url: string }[] = [];
  section("Registo de inspeção e manutenção");
  if (!record) field("Checklist", "Sem checklist preenchida associada a esta OP.");
  else {
    field("Documento de origem", `${record.documentNo || record.id} | ${record.template.title}`);
    field("Data e responsável da checklist", `${date(record.performedAt)} | ${record.responsible || "Não registado"}`);
    field("Resultado da checklist", record.result);
    const counts = ["OK", "NOT_OK", "NA"].map(status => record.responses.filter(response => response.status === status).length);
    field("Resumo da checklist", `OK: ${counts[0]} | Não OK: ${counts[1]} | N/A: ${counts[2]} | Referências de evidência: ${record.responses.reduce((n, response) => n + response.photos.length, 0)}`);
    for (const response of record.responses) {
      room(75);
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#222222").text(`${response.item.order}. ${response.item.check}`, { width, lineGap: 2 }).moveDown(0.4);
      pairs([
        ["Condição esperada", response.item.expectedCondition],
        ["Estado", ({ OK: "OK", NOT_OK: "Não OK", NA: "N/A" } as Record<string, string>)[response.status] ?? "Não registado"],
      ]);
      if (response.obs) field("Observações", response.obs);
      else doc.font("Helvetica").fontSize(9).fillColor("#555555").text("Observações: Sem observações", { width, lineGap: 2 });
      const ids = response.photos.map(photo => {
        const id = `E${String(references.length + 1).padStart(3, "0")}`;
        references.push({ label: `${id} | Ponto ${response.item.order}: ${photo.caption || photo.fileName || response.item.check}`, url: photo.fileUrl });
        return id;
      });
      doc.font("Helvetica").fontSize(9).fillColor("#555555").text(`Evidências: ${ids.length ? ids.join(", ") : "Sem evidências associadas a este ponto."}`, { width, lineGap: 2 }).moveDown(0.7);
    }
    field("Notas originais da checklist (histórico)", record.notes);
  }

  section("Consumíveis e custos");
  const consumables = op.consumableMovements.reduce((sum, movement) => sum + Number(movement.quantity) * Number(movement.consumable.unitCost), 0);
  const closedCost = op.ticket ? Number(op.ticket.totalCost) : op.maintenanceLog ? Number(op.maintenanceLog.cost) : null;
  field("Custo total registado", closedCost === null ? "Sem custo fechado registado" : formatCurrency(closedCost));
  field("Consumíveis", op.ticket ? formatCurrency(op.ticket.consumableCost) : formatCurrency(consumables));
  field("Mão de obra", op.ticket ? formatCurrency(op.ticket.laborCost) : closedCost === null ? "Sem custo fechado registado" : formatCurrency(Math.max(0, closedCost - consumables)));
  for (const movement of op.consumableMovements) field(movement.consumable.name, `${movement.quantity.toString()} ${movement.consumable.unit} | ${formatCurrency(Number(movement.quantity) * Number(movement.consumable.unitCost))}`);
  if (op.consumableMovements.length) field("Base de cálculo dos consumíveis", "As linhas usam o custo unitário atual do cadastro. O custo total registado é apresentado separadamente.");
  if (references.length || op.documents.length) {
    section("Evidências e documentos associados");
    field("Acesso às evidências", "As ligações abaixo apontam para os ficheiros ou pastas originais. Não constituem imagens incorporadas no PDF e podem exigir autorização de acesso ao OneDrive/SharePoint.");
    for (const reference of references) link(reference.label, reference.url);
    for (const document of op.documents) link(document.title, document.fileUrl);
  }

  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(8).fillColor("#555555").text(`${op.number} | Página ${i + 1} de ${pages.count}`, left, doc.page.height - 28, { width, align: "center", lineBreak: false });
    doc.page.margins.bottom = bottomMargin;
  }
  doc.end();
  return buffer;
}
