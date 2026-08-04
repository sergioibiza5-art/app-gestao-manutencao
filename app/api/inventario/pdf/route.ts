import PDFDocument from "pdfkit/js/pdfkit.standalone.js";

import { requireUser } from "@/lib/auth";
import { getInventoryData, type InventoryFilters } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const page = {
  margin: 36,
  width: 842,
  height: 595,
};

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
  const footerY = page.height - page.margin - 8;
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#64748b")
      .text(`Relatorio de inventario - Pagina ${index + 1}`, page.margin, footerY, {
        width: page.width - page.margin * 2,
        align: "center",
        lineBreak: false,
      });
  }
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function packageDescription(item: { unit: string; packageQuantity?: unknown; packageUnit?: string | null }) {
  const quantity = Number(item.packageQuantity ?? 0);
  if (!quantity || !item.packageUnit) return "";
  return `1 ${item.unit} = ${formatNumber(item.packageQuantity)} ${item.packageUnit}`;
}

function stockLabel(value?: string) {
  const labels: Record<string, string> = {
    LOW: "Abaixo do minimo",
    OK: "Stock OK",
    ASSOCIATED: "Com equipamento",
    UNASSOCIATED: "Sem equipamento",
  };

  return value ? labels[value] ?? value : "Todos";
}

function summaryCards(doc: PDFKit.PDFDocument, items: { label: string; value: string }[]) {
  const gap = 8;
  const columns = 4;
  const width = (page.width - page.margin * 2 - gap * (columns - 1)) / columns;
  const y = doc.y;

  items.forEach((item, index) => {
    const x = page.margin + index * (width + gap);
    doc.roundedRect(x, y, width, 58, 7).strokeColor("#cbd5e1").lineWidth(0.6).stroke();
    doc.font("Helvetica").fontSize(7).fillColor("#64748b").text(item.label, x + 9, y + 10, { width: width - 18 });
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#0f172a").text(item.value, x + 9, y + 28, { width: width - 18 });
  });

  doc.y = y + 76;
}

function drawFilters(doc: PDFKit.PDFDocument, filters: InventoryFilters) {
  const y = doc.y;
  const tableWidth = page.width - page.margin * 2;
  const colWidth = tableWidth / 4;
  const rows = [
    ["Pesquisa", filters.q || "Todas", "Categoria", filters.category || "Todas"],
    ["Fornecedor", filters.supplier || "Todos", "Localizacao", filters.location || "Todas"],
    ["Equipamento", filters.equipmentId || "Todos", "Estado", stockLabel(filters.stock)],
  ];

  doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f766e").text("Filtros aplicados", page.margin, y);
  let rowY = y + 22;

  rows.forEach((row) => {
    let x = page.margin;
    row.forEach((cell, index) => {
      doc.rect(x, rowY, colWidth, 20).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
      doc
        .font(index % 2 === 0 ? "Helvetica-Bold" : "Helvetica")
        .fontSize(7)
        .fillColor(index % 2 === 0 ? "#0f172a" : "#334155")
        .text(cell, x + 5, rowY + 6, { width: colWidth - 10, ellipsis: true });
      x += colWidth;
    });
    rowY += 20;
  });

  doc.y = rowY + 18;
}

function drawTable(
  doc: PDFKit.PDFDocument,
  rows: {
    name: string;
    category: string;
    stock: string;
    minimum: string;
    supplier: string;
    location: string;
    equipment: string;
    value: string;
  }[],
) {
  const headers = ["Produto", "Categoria", "Stock", "Min.", "Fornecedor", "Local", "Equipamento", "Valor"];
  const widths = [150, 82, 60, 54, 108, 86, 126, 72];
  const rowHeight = 28;
  const headerHeight = 24;
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);
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
    doc.font("Helvetica").fontSize(8).fillColor("#64748b").text("Sem produtos para os filtros aplicados.", page.margin + 6, y + 9, {
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
    const cells = [row.name, row.category, row.stock, row.minimum, row.supplier, row.location, row.equipment, row.value];
    let x = page.margin;
    cells.forEach((cell, index) => {
      doc.font("Helvetica").fontSize(7).fillColor("#1f2937").text(cell, x + 4, y + 7, {
        width: widths[index] - 8,
        ellipsis: true,
      });
      x += widths[index];
    });
    y += rowHeight;
  });

  doc.y = y + 12;
}

export async function GET(request: Request) {
  await requireUser();

  const url = new URL(request.url);
  const filters: InventoryFilters = {
    q: url.searchParams.get("q") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    supplier: url.searchParams.get("supplier") ?? undefined,
    location: url.searchParams.get("location") ?? undefined,
    equipmentId: url.searchParams.get("equipmentId") ?? undefined,
    stock: url.searchParams.get("stock") ?? undefined,
  };
  const data = await getInventoryData(filters);
  const generatedAt = new Date();

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: page.margin,
    bufferPages: true,
    info: {
      Title: "Relatorio de Inventario",
      Author: "Gestao de manutencao",
      Subject: "Produtos de inventario filtrados",
    },
  });

  doc.font("Helvetica-Bold").fontSize(20).fillColor("#0f172a").text("Relatorio de Inventario", page.margin, page.margin);
  doc.font("Helvetica").fontSize(9).fillColor("#475569").text("Produtos de stock filtrados na aplicacao.", page.margin, doc.y + 4, {
    width: page.width - page.margin * 2,
  });
  doc.moveDown(1.2);

  summaryCards(doc, [
    { label: "Produtos filtrados", value: String(data.consumables.length) },
    { label: "Total de produtos", value: String(data.allCount) },
    { label: "Abaixo do minimo", value: String(data.lowStockCount) },
    { label: "Valor em stock", value: formatCurrency(data.totalStockValue) },
  ]);

  drawFilters(doc, filters);

  doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f766e").text("Produtos", page.margin, doc.y);
  doc.moveDown(0.6);
  drawTable(
    doc,
    data.consumables.map((item) => {
      const stock = `${formatNumber(item.currentStock)} ${item.unit}`;
      const minimum = `${formatNumber(item.minimumStock)} ${item.unit}`;
      const value = Number(item.currentStock ?? 0) * Number(item.unitCost ?? 0);
      const packageInfo = packageDescription(item);

      return {
        name: packageInfo ? `${item.name} (${packageInfo})` : item.name,
        category: item.category || "Sem categoria",
        stock,
        minimum,
        supplier: item.supplier || "Sem fornecedor",
        location: item.location || "Sem local",
        equipment: item.equipment ? `${item.equipment.name}${item.equipment.code ? ` - ${item.equipment.code}` : ""}` : "Sem equipamento",
        value: formatCurrency(value),
      };
    }),
  );

  doc.font("Helvetica").fontSize(7).fillColor("#64748b").text(
    `Gerado em ${new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Lisbon" }).format(generatedAt)}.`,
    page.margin,
    page.height - page.margin - 20,
    { width: page.width - page.margin * 2, align: "left", lineBreak: false },
  );

  addFooter(doc);
  const buffer = await docToBuffer(doc);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-inventario-${generatedAt.toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
