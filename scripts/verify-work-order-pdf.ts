import { loadEnvConfig } from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/prisma";
import { loadWorkOrderReport, reportFilename } from "@/lib/work-order-report";
import { workOrderPdf } from "@/lib/work-order-pdf";

loadEnvConfig(process.cwd());
async function main() {
  const number = process.argv[2] || "OP-00137";
  const op = await getPrisma().workOrder.findUniqueOrThrow({ where: { number }, select: { id: true } });
  const report = await loadWorkOrderReport(op.id, {});
  assert.ok(report);
  const folder = resolve("outputs/work-order-pdf-qa");
  await mkdir(folder, { recursive: true });
  const pdf = await workOrderPdf(report, "Verificação técnica", "https://app-gestao-manutencao.vercel.app");
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  await writeFile(resolve(folder, reportFilename(number)), pdf);
  // Stress pagination without altering the source record or database.
  const longReport = { ...report, order: { ...report.order, notes: Array.from({ length: 90 }, (_, i) => `Observação ${i + 1}: texto de teste para confirmar paginação, acentos e legibilidade.`).join("\n") } };
  await writeFile(resolve(folder, "paginacao.pdf"), await workOrderPdf(longReport, "Verificação técnica", "https://app-gestao-manutencao.vercel.app"));
  console.log(JSON.stringify({ file: resolve(folder, reportFilename(number)), bytes: pdf.length, op: number, checklistItems: report.order.checklistRecord?.responses.length ?? 0 }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => getPrisma().$disconnect());
