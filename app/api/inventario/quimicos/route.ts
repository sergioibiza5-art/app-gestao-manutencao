import { csvCell, entryTypes, getChemicalReport, lisbonDate, reportRange } from "@/lib/chemical-report";
import { productTypeLabel } from "@/lib/product-types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? undefined;
  const to = params.get("to") ?? undefined;
  try { reportRange(from, to); } catch {
    return new Response("Período inválido.", { status: 400 });
  }
  const report = await getChemicalReport(from, to);
  const rows: unknown[][] = [
    ["Entradas de produtos químicos", report.start, report.end, "Europe/Lisbon"],
    ["Classificação e unidades atuais. Inclui stock inicial e ajustes positivos; não equivale a compras."],
    ["Produtos por classificar (excluídos)", report.unclassified],
    ["Data", "Produto", "Tipo de produto", "Fornecedor", "Movimento", "Quantidade", "Unidade de stock", "Quantidade por embalagem", "Unidade técnica", "Motivo"],
    ...report.entries.map((entry) => [lisbonDate(entry.date), entry.consumable.name, productTypeLabel(entry.consumable.productType), entry.consumable.supplier, entryTypes[entry.type as keyof typeof entryTypes], String(entry.quantity).replace(".", ","), entry.consumable.unit, entry.consumable.packageQuantity?.toString().replace(".", ","), entry.consumable.packageUnit, entry.reason]),
  ];
  return new Response("\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="entradas-quimicos-${report.start}-${report.end}.csv"`, "Cache-Control": "private, no-store" },
  });
}
