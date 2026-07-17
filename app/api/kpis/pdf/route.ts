import PDFDocument from "pdfkit/js/pdfkit.standalone.js";

import { requireCanSgq } from "@/lib/auth";
import { getKpiData } from "@/lib/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const page = {
  margin: 36,
  width: 842,
  height: 595,
};

type KpiTicketRow = {
  id: string;
  number: string;
  title: string;
  equipment: string;
  status: string;
  machineStopped: boolean;
  openedAt: Date;
  completedAt?: Date | null;
  validatedAt?: Date | null;
  downtimeHours: number;
  repairHours: number;
  countsForMttr: boolean;
  countsForAvailability: boolean;
};

type KpiWorkOrderRow = {
  id: string;
  number: string;
  title: string;
  equipment: string;
  status: string;
  openedAt: Date;
  closedAt?: Date | null;
  scheduledAt?: Date | null;
  isPreventive: boolean;
  countsForOnTime: boolean;
  isOnTime: boolean;
  workHours: number;
};

type CountRow = {
  name: string;
  count: number;
};

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value || 0);
}

function formatHours(value: number) {
  return `${formatNumber(value, 1)} h`;
}

function formatPercent(value: number) {
  return `${formatNumber(value, 1)}%`;
}

function formatDateOnly(date: Date | string) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeZone: "Europe/Lisbon",
  }).format(new Date(date));
}

function formatDateTime(date?: Date | string | null) {
  if (!date) return "Sem data";
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Lisbon",
  }).format(new Date(date));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: "Aberta",
    IN_PROGRESS: "Em curso",
    PAUSED: "Pausada",
    SUSPENDED: "Suspensa",
    DONE: "Concluida",
    VALIDATED: "Validada",
    CANCELED: "Cancelada",
  };

  return labels[status] ?? status;
}

function yesNo(value: boolean) {
  return value ? "Sim" : "Nao";
}

function docToBuffer(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function addFooter(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc
      .fontSize(7)
      .fillColor("#64748b")
      .font("Helvetica")
      .text(`Relatorio KPI manutencao - Pagina ${index + 1}`, page.margin, page.height - 24, {
        width: page.width - page.margin * 2,
        align: "center",
      });
  }
}

function ensureSpace(doc: PDFKit.PDFDocument, needed = 60) {
  if (doc.y + needed > page.height - page.margin - 22) {
    doc.addPage();
  }
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
  ensureSpace(doc, 56);
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f766e").text(title, page.margin, doc.y);
  if (subtitle) {
    doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(subtitle, page.margin, doc.y + 2, {
      width: page.width - page.margin * 2,
    });
  }
  doc.moveDown(0.8);
}

function summaryCards(doc: PDFKit.PDFDocument, items: { label: string; value: string; detail?: string }[]) {
  const gap = 8;
  const columns = 5;
  const width = (page.width - page.margin * 2 - gap * (columns - 1)) / columns;
  const y = doc.y;

  items.forEach((item, index) => {
    const x = page.margin + index * (width + gap);
    doc.roundedRect(x, y, width, 76, 7).strokeColor("#cbd5e1").lineWidth(0.6).stroke();
    doc.font("Helvetica").fontSize(7).fillColor("#64748b").text(item.label, x + 9, y + 10, { width: width - 18 });
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a").text(item.value, x + 9, y + 29, { width: width - 18 });
    if (item.detail) {
      doc.font("Helvetica").fontSize(7).fillColor("#64748b").text(item.detail, x + 9, y + 56, { width: width - 18 });
    }
  });

  doc.y = y + 92;
}

function infoBox(doc: PDFKit.PDFDocument, title: string, body: string) {
  ensureSpace(doc, 58);
  const y = doc.y;
  doc.roundedRect(page.margin, y, page.width - page.margin * 2, 48, 6).fillColor("#f8fafc").fill().strokeColor("#dbeafe").stroke();
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#0f172a").text(title, page.margin + 10, y + 9);
  doc.font("Helvetica").fontSize(8).fillColor("#334155").text(body, page.margin + 10, y + 24, {
    width: page.width - page.margin * 2 - 20,
  });
  doc.y = y + 62;
}

function table(doc: PDFKit.PDFDocument, headers: string[], rows: string[][], widths: number[]) {
  const rowHeight = 24;
  const headerHeight = 25;
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);

  ensureSpace(doc, headerHeight + rowHeight);
  let y = doc.y;

  const drawHeader = () => {
    doc.roundedRect(page.margin, y, tableWidth, headerHeight, 4).fillColor("#e2e8f0").fill();
    let x = page.margin;
    headers.forEach((header, index) => {
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#0f172a").text(header, x + 4, y + 8, {
        width: widths[index] - 8,
        ellipsis: true,
      });
      x += widths[index];
    });
    y += headerHeight;
  };

  drawHeader();

  if (rows.length === 0) {
    doc.rect(page.margin, y, tableWidth, rowHeight).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
    doc.font("Helvetica").fontSize(8).fillColor("#64748b").text("Sem dados no periodo filtrado.", page.margin + 6, y + 8, {
      width: tableWidth - 12,
    });
    doc.y = y + rowHeight + 12;
    return;
  }

  rows.forEach((row) => {
    if (y + rowHeight > page.height - page.margin - 22) {
      doc.addPage();
      y = page.margin;
      drawHeader();
    }

    doc.rect(page.margin, y, tableWidth, rowHeight).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
    let x = page.margin;
    row.forEach((cell, index) => {
      doc.font("Helvetica").fontSize(7).fillColor("#1f2937").text(cell, x + 4, y + 7, {
        width: widths[index] - 8,
        ellipsis: true,
      });
      x += widths[index];
    });
    y += rowHeight;
  });

  doc.x = page.margin;
  doc.y = y + 12;
}

function chartRows(rows: CountRow[]) {
  return rows.map((row) => [statusLabel(row.name), String(row.count)]);
}

export async function GET(request: Request) {
  await requireCanSgq();

  const url = new URL(request.url);
  const data = await getKpiData({
    year: url.searchParams.get("year") ?? undefined,
    period: url.searchParams.get("period") ?? undefined,
    month: url.searchParams.get("month") ?? undefined,
    quarter: url.searchParams.get("quarter") ?? undefined,
    semester: url.searchParams.get("semester") ?? undefined,
  });

  const tickets = data.sources.tickets as KpiTicketRow[];
  const workOrders = data.sources.workOrders as KpiWorkOrderRow[];
  const generatedAt = new Date();

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: page.margin,
    bufferPages: true,
    info: {
      Title: "Relatorio KPI de Manutencao",
      Author: "Gestao de manutencao",
      Subject: "Indicadores de manutencao",
    },
  });

  doc.font("Helvetica-Bold").fontSize(20).fillColor("#0f172a").text("Relatorio KPI de Manutencao", page.margin, page.margin);
  doc.font("Helvetica").fontSize(9).fillColor("#64748b").text("Documento gerado automaticamente pela aplicacao de gestao de manutencao.", {
    width: page.width - page.margin * 2,
  });
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f766e").text(`Periodo: ${data.periodLabel}`);
  doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(
    `${formatDateOnly(data.period.start)} ate ${formatDateOnly(data.period.end)} | Gerado em ${formatDateTime(generatedAt)}`,
  );
  doc.moveDown(1);

  summaryCards(doc, [
    { label: "MTBF", value: formatHours(data.cards.mtbfHours), detail: "Tempo medio entre avarias" },
    { label: "Preventiva", value: formatPercent(data.cards.preventivePercentage), detail: "Peso das OPs preventivas" },
    { label: "OPs no prazo", value: formatPercent(data.cards.onTimePercentage), detail: "Fechadas ate ao dia agendado" },
    { label: "MTTR", value: formatHours(data.cards.mttrHours), detail: "Tempo medio de reparacao" },
    { label: "Disponibilidade", value: formatPercent(data.cards.availability), detail: "Disponibilidade no periodo" },
  ]);

  summaryCards(doc, [
    { label: "Equipamentos", value: String(data.totals.equipmentCount), detail: "Nao descartados" },
    { label: "OPs", value: String(data.totals.workOrders), detail: "Abertas no periodo" },
    { label: "OPs concluidas", value: String(data.totals.completedWorkOrders), detail: "DONE ou VALIDATED" },
    { label: "Avarias", value: String(data.totals.failures), detail: "Tickets nao cancelados" },
    { label: "Paragem total", value: formatHours(data.totals.downtimeHours), detail: "Maquina parada" },
  ]);

  infoBox(
    doc,
    "Nota de rastreabilidade",
    "Os indicadores abaixo foram calculados diretamente a partir das OPs, tickets e equipamentos existentes na base de dados para o filtro selecionado. Sempre que nao existam dados suficientes, o valor deve ser interpretado como ausencia de registo e nao como evidencia historica completa.",
  );

  doc.addPage();
  sectionTitle(doc, "Formulas usadas", "Mesma logica usada na pagina de KPIs da aplicacao.");
  table(
    doc,
    ["Indicador", "Formula"],
    [
      ["MTBF", data.sources.formulas.mtbf],
      ["Preventiva", data.sources.formulas.preventive],
      ["OPs no prazo", data.sources.formulas.onTime],
      ["MTTR", data.sources.formulas.mttr],
      ["Disponibilidade", data.sources.formulas.availability],
    ],
    [150, 620],
  );

  sectionTitle(doc, "Resumo por estado", "Contagem de ordens de trabalho por estado.");
  table(doc, ["Estado", "Quantidade"], chartRows(data.workOrdersByStatus), [220, 120]);

  doc.addPage();
  sectionTitle(doc, "Avarias por equipamento", "Tickets de avaria considerados no periodo filtrado.");
  table(
    doc,
    ["Equipamento", "Avarias", "Paragem"],
    data.failuresByEquipment.map((item: { name: string; count: number; downtimeHours: number }) => [
      item.name,
      String(item.count),
      formatHours(item.downtimeHours),
    ]),
    [430, 100, 120],
  );

  sectionTitle(doc, "Problemas recorrentes", "Agrupamento por equipamento e titulo do ticket.");
  table(
    doc,
    ["Problema", "Equipamento", "Ocorrencias"],
    data.recurringProblems.map((item: { name: string; equipment: string; count: number }) => [
      item.name,
      item.equipment,
      String(item.count),
    ]),
    [320, 320, 100],
  );

  doc.addPage();
  sectionTitle(doc, "Tickets usados nos KPIs", "Base de MTBF, MTTR e disponibilidade.");
  table(
    doc,
    ["Ticket", "Equipamento", "Estado", "Aberto", "Fim", "Paragem", "Reparacao", "MTTR", "Disponib."],
    tickets.map((ticket) => [
      `${ticket.number} - ${ticket.title}`,
      ticket.equipment,
      statusLabel(ticket.status),
      formatDateTime(ticket.openedAt),
      formatDateTime(ticket.completedAt ?? ticket.validatedAt),
      formatHours(ticket.downtimeHours),
      formatHours(ticket.repairHours),
      yesNo(ticket.countsForMttr),
      yesNo(ticket.countsForAvailability),
    ]),
    [145, 120, 70, 80, 80, 65, 65, 55, 55],
  );

  doc.addPage();
  sectionTitle(doc, "Ordens de trabalho usadas nos KPIs", "Base de manutencao preventiva e cumprimento de prazo.");
  table(
    doc,
    ["OP", "Equipamento", "Estado", "Aberta", "Agendada", "Fechada", "Preventiva", "Conta prazo", "No prazo", "Tempo"],
    workOrders.map((workOrder) => [
      `${workOrder.number} - ${workOrder.title}`,
      workOrder.equipment,
      statusLabel(workOrder.status),
      formatDateTime(workOrder.openedAt),
      formatDateTime(workOrder.scheduledAt),
      formatDateTime(workOrder.closedAt),
      yesNo(workOrder.isPreventive),
      yesNo(workOrder.countsForOnTime),
      workOrder.countsForOnTime ? yesNo(workOrder.isOnTime) : "-",
      formatHours(workOrder.workHours),
    ]),
    [140, 110, 68, 78, 78, 78, 62, 62, 54, 54],
  );

  addFooter(doc);
  const pdf = await docToBuffer(doc);
  const filename = `relatorio-kpis-${data.selectedYear}-${data.selectedPeriod}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
