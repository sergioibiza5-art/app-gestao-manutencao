import PDFDocument from "pdfkit/js/pdfkit.standalone.js";

import { getEnvironmentalData } from "@/lib/data";
import { requireCanSgq } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type EnvironmentalRow = {
  zone: string;
  type: string;
  average: number;
  min: number;
  max: number;
  occurrences: number;
  events: number;
  status: string;
  count: number;
  lowPressureOccurrences?: number;
  events40min?: number;
  ignoreLowPressure?: boolean;
};

type EnvironmentalEventRow = {
  zone: string;
  pressureEvents40min: number;
  temperatureEvents24h: number;
  humidityEvents24h: number;
};

type EnvironmentalActionEvent = {
  zone: string;
  type: string;
  label: string;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  min: number;
  max: number;
  readingsCount: number;
  limit: string;
};

type EnvironmentalSettings = {
  alertStartTime: string;
  alertEndTime: string;
  includeSaturday: boolean;
  includeSunday: boolean;
};

const page = {
  margin: 36,
  width: 842,
  height: 595,
};

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Lisbon",
  }).format(new Date(date));
}

function formatDateOnly(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeZone: "Europe/Lisbon",
  }).format(new Date(date));
}

function formatDuration(seconds: number) {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes.toString().padStart(2, "0")}m` : `${minutes}m`;
}

function unit(type: string) {
  if (type === "TEMPERATURE") return "C";
  if (type === "HUMIDITY") return "%";
  return "Pa";
}

function typeLabel(type: string) {
  if (type === "TEMPERATURE") return "Temperatura / Temperature";
  if (type === "HUMIDITY") return "Humidade / Humidity";
  if (type === "PRESSURE") return "Pressao / Pressure";
  return type;
}

function statusLabel(status: string) {
  if (status === "ACTION") return "Acao / Action";
  if (status === "ALERT") return "Alerta / Alert";
  if (status === "OK") return "OK";
  return status;
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
      .fillColor("#6b7280")
      .text(
        `Relatorio ambiental / Environmental report - Pagina ${index + 1} / Page ${index + 1}`,
        page.margin,
        page.height - 24,
        { width: page.width - page.margin * 2, align: "center" },
      );
  }
}

function ensureSpace(doc: PDFKit.PDFDocument, needed = 60) {
  if (doc.y + needed > page.height - page.margin - 18) {
    doc.addPage();
  }
}

function sectionTitle(doc: PDFKit.PDFDocument, titlePt: string, titleEn: string) {
  ensureSpace(doc, 48);
  doc.moveDown(0.6);
  doc.fontSize(13).fillColor("#0f766e").font("Helvetica-Bold").text(titlePt);
  doc.fontSize(9).fillColor("#64748b").font("Helvetica").text(titleEn);
  doc.moveDown(0.5);
}

function smallText(doc: PDFKit.PDFDocument, text: string) {
  doc.fontSize(8).fillColor("#334155").font("Helvetica").text(text, {
    width: page.width - page.margin * 2,
    lineGap: 2,
  });
}

function summaryCards(doc: PDFKit.PDFDocument, items: { label: string; value: string }[]) {
  const gap = 8;
  const columns = 5;
  const width = (page.width - page.margin * 2 - gap * (columns - 1)) / columns;
  const y = doc.y;

  items.forEach((item, index) => {
    const x = page.margin + index * (width + gap);
    doc.roundedRect(x, y, width, 58, 6).strokeColor("#cbd5e1").lineWidth(0.5).stroke();
    doc.fontSize(7).fillColor("#64748b").font("Helvetica").text(item.label, x + 8, y + 10, { width: width - 16 });
    doc.fontSize(14).fillColor("#0f172a").font("Helvetica-Bold").text(item.value, x + 8, y + 28, { width: width - 16 });
  });

  doc.y = y + 70;
}

function table(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  widths: number[],
) {
  const rowHeight = 24;
  const headerHeight = 26;
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);

  ensureSpace(doc, headerHeight + rowHeight);
  let y = doc.y;

  const drawHeader = () => {
    doc.roundedRect(page.margin, y, tableWidth, headerHeight, 3).fillColor("#e2e8f0").fill();
    let x = page.margin;
    headers.forEach((header, index) => {
      doc.fontSize(7).fillColor("#0f172a").font("Helvetica-Bold").text(header, x + 4, y + 8, {
        width: widths[index] - 8,
        ellipsis: true,
      });
      x += widths[index];
    });
    y += headerHeight;
  };

  drawHeader();

  rows.forEach((row) => {
    if (y + rowHeight > page.height - page.margin - 18) {
      doc.addPage();
      y = page.margin;
      drawHeader();
    }

    doc.rect(page.margin, y, tableWidth, rowHeight).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
    let x = page.margin;
    row.forEach((cell, index) => {
      doc.fontSize(7).fillColor("#1f2937").font("Helvetica").text(cell, x + 4, y + 7, {
        width: widths[index] - 8,
        ellipsis: true,
      });
      x += widths[index];
    });
    y += rowHeight;
  });

  doc.y = y + 8;
}

function stateText(state: string) {
  if (state === "ACAO") return "ACAO / ACTION";
  if (state === "ATENCAO") return "ATENCAO / ATTENTION";
  if (state === "CONTROLADO") return "CONTROLADO / CONTROLLED";
  return state;
}

export async function GET(request: Request) {
  await requireCanSgq();

  const url = new URL(request.url);
  const days = url.searchParams.get("days") || "7";
  const type = url.searchParams.get("type") || "ALL";
  const zone = url.searchParams.get("zone") || "ALL";
  const status = url.searchParams.get("status") || "ALL";
  const importId = url.searchParams.get("importId") || "ALL";
  const data = await getEnvironmentalData({ days, type, zone, status, importId });
  const settings = data.settings as EnvironmentalSettings;
  const pressureRows = data.pressureRows as EnvironmentalRow[];
  const temperatureRows = data.temperatureRows as EnvironmentalRow[];
  const humidityRows = data.humidityRows as EnvironmentalRow[];
  const eventRows = data.eventRows as EnvironmentalEventRow[];
  const actionEvents = data.actionEvents as EnvironmentalActionEvent[];
  const imports = data.imports as Array<{ id: string; fileName: string; importedAt: Date; rowsCount: number }>;
  const selectedImport = importId === "ALL" ? null : imports.find((item) => item.id === importId);
  const generatedAt = new Date();

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: page.margin,
    bufferPages: true,
    info: {
      Title: "Relatorio Ambiental / Environmental Report",
      Author: "Gestao de manutencao",
      Subject: "Monitorizacao ambiental SGQ",
    },
  });

  doc.font("Helvetica-Bold").fontSize(18).fillColor("#0f172a").text("Relatorio Ambiental SGQ", page.margin, page.margin);
  doc.fontSize(12).fillColor("#0f766e").text("Environmental Monitoring Report", { continued: false });
  doc.moveDown(0.5);
  smallText(
    doc,
    "Documento gerado automaticamente a partir das leituras ambientais gravadas na aplicacao, usando exatamente os filtros e regras de tratamento indicados abaixo. / Automatically generated from environmental readings stored in the application, using the filters and treatment rules stated below.",
  );
  doc.moveDown(0.8);

  summaryCards(doc, [
    { label: "Estado / Status", value: stateText(String(data.state)) },
    { label: "Acoes / Actions", value: String(data.totalActions) },
    { label: "Alertas / Alerts", value: String(data.totalAlerts) },
    { label: "Leituras / Readings", value: String(data.readingsCount) },
    { label: "Gerado / Generated", value: formatDateOnly(generatedAt) },
  ]);

  sectionTitle(doc, "Filtros e regras aplicadas", "Applied filters and rules");
  table(
    doc,
    ["Campo / Field", "Valor / Value", "Campo / Field", "Valor / Value"],
    [
      ["Periodo / Period", `${formatDateOnly(data.range.start)} - ${formatDateOnly(data.range.end)}`, "Tipo / Type", type],
      ["Zona / Zone", zone, "Estado / Status", status],
      ["Importacao / Import", selectedImport?.fileName ?? "Todas / All", "Gerado em / Generated at", formatDateTime(generatedAt)],
      ["Horario alertas / Alert window", `${settings.alertStartTime} - ${settings.alertEndTime}`, "Fim de semana / Weekend", `Sab/Sat: ${settings.includeSaturday ? "Sim/Yes" : "Nao/No"}; Dom/Sun: ${settings.includeSunday ? "Sim/Yes" : "Nao/No"}`],
    ],
    [145, 250, 145, 250],
  );

  smallText(
    doc,
    "Regras principais / Main rules: Temperatura fora de 15-25 C gera alerta; se mantida por mais de 24h gera acao. Humidade fora de 30-70% gera alerta; se mantida por mais de 24h gera acao. Pressao abaixo de 5 Pa gera alerta; eventos continuos acima de 40 min geram acao. Ligacoes de pressao com media inferior a 1,5 Pa sao tratadas como OK para evitar falsos alertas em sensores de referencia baixa. Leituras fora do horario configurado e fins de semana nao incluidos permanecem no historico, mas nao contam para alertas, acoes ou eventos.",
  );

  sectionTitle(doc, "Acoes ambientais", "Environmental actions");
  if (actionEvents.length === 0) {
    smallText(doc, "Sem acoes no periodo filtrado. / No actions in the filtered period.");
  } else {
    table(
      doc,
      ["Inicio / Start", "Fim / End", "Tipo / Type", "Zona / Zone", "Limite / Limit", "Valores / Values", "Duracao / Duration", "Leituras / Read."],
      actionEvents.map((event) => [
        formatDateTime(event.startedAt),
        formatDateTime(event.endedAt),
        typeLabel(event.type),
        event.zone,
        event.limit,
        `${formatNumber(event.min)} - ${formatNumber(event.max)} ${unit(event.type)}`,
        formatDuration(event.durationSeconds),
        String(event.readingsCount),
      ]),
      [92, 92, 110, 75, 120, 105, 80, 55],
    );
  }

  sectionTitle(doc, "Pressao diferencial por ligacao", "Differential pressure by connection");
  table(
    doc,
    ["Ligacao / Connection", "Media / Avg", "Min", "Max", "Ocorr. <5Pa", "Eventos >40m", "Estado / Status", "Leituras / Read."],
    pressureRows.map((row) => [
      row.zone,
      `${formatNumber(row.average)} Pa${row.ignoreLowPressure ? " (OK <1,5)" : ""}`,
      `${formatNumber(row.min)} Pa`,
      `${formatNumber(row.max)} Pa`,
      String(row.lowPressureOccurrences ?? row.occurrences),
      String(row.events40min ?? row.events),
      statusLabel(row.status),
      String(row.count),
    ]),
    [120, 95, 75, 75, 95, 95, 120, 80],
  );

  sectionTitle(doc, "Temperatura por sala", "Temperature by room");
  table(
    doc,
    ["Sala / Room", "Media / Avg", "Min", "Max", "Alertas / Alerts", "Acoes / Actions", "Estado / Status", "Leituras / Read."],
    temperatureRows.map((row) => [
      row.zone,
      `${formatNumber(row.average)} C`,
      `${formatNumber(row.min)} C`,
      `${formatNumber(row.max)} C`,
      String(row.occurrences),
      String(row.events),
      statusLabel(row.status),
      String(row.count),
    ]),
    [110, 90, 80, 80, 100, 100, 130, 80],
  );

  sectionTitle(doc, "Humidade por sala", "Humidity by room");
  table(
    doc,
    ["Sala / Room", "Media / Avg", "Min", "Max", "Alertas / Alerts", "Acoes / Actions", "Estado / Status", "Leituras / Read."],
    humidityRows.map((row) => [
      row.zone,
      `${formatNumber(row.average)} %`,
      `${formatNumber(row.min)} %`,
      `${formatNumber(row.max)} %`,
      String(row.occurrences),
      String(row.events),
      statusLabel(row.status),
      String(row.count),
    ]),
    [110, 90, 80, 80, 100, 100, 130, 80],
  );

  sectionTitle(doc, "Eventos por zona", "Events by zone");
  table(
    doc,
    ["Zona / Zone", "Pressao >40m / Pressure >40m", "Temperatura >24h / Temperature >24h", "Humidade >24h / Humidity >24h"],
    eventRows.map((row) => [
      row.zone,
      String(row.pressureEvents40min),
      String(row.temperatureEvents24h),
      String(row.humidityEvents24h),
    ]),
    [180, 190, 200, 200],
  );

  sectionTitle(doc, "Rastreabilidade", "Traceability");
  table(
    doc,
    ["Ficheiro / File", "Importado em / Imported at", "Leituras / Readings"],
    imports.slice(0, 30).map((item) => [
      item.fileName,
      formatDateTime(item.importedAt),
      String(item.rowsCount),
    ]),
    [460, 180, 120],
  );
  smallText(
    doc,
    "Nota / Note: a lista de rastreabilidade mostra as importacoes mais recentes disponiveis no sistema. Os calculos acima respeitam o filtro de periodo, tipo, zona, estado e importacao selecionados.",
  );

  addFooter(doc);
  const pdf = await docToBuffer(doc);
  const filename = `relatorio-ambiental-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
