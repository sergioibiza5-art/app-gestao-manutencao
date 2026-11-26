import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildChemicalOpeningReport } from "@/lib/chemical-opening-report";
import { getPrisma } from "@/lib/prisma";

loadEnvConfig(process.cwd());
const tag = `chemical-opening-test-${randomUUID()}`;
const rollback = new Error("ROLLBACK_OPENING_REPORT_TEST");
async function main() {
  const prisma = getPrisma();
  try {
    await prisma.$transaction(async tx => {
      const product = await tx.consumable.create({ data: { name: tag, category: tag, unit: "un", packageQuantity: 2, packageUnit: "L", productType: "CHEMICAL_LIQUID" } });
      for (const [type, quantity, day] of [
        ["ENTRADA_DIRETA", "100", "2025-12-31T23:59:59Z"],
        ["ENTRADA_INICIAL", "4", "2026-01-01T00:00:00Z"],
        ["ENTRADA_DIRETA", "3", "2026-07-15T12:00:00Z"],
        ["ENTRADA_DIRETA", "6", "2026-10-31T23:59:59Z"],
        ["ENTRADA_MANUAL", "500", "2026-07-15T12:00:00Z"],
        ["SAIDA_DIRETA", "1", "2026-07-15T12:00:00Z"],
        ["ENTRADA_DIRETA", "100", "2026-11-01T00:00:00Z"],
        ["ENTRADA_DIRETA", "100", "2027-01-01T00:00:00Z"],
      ]) await tx.consumableMovement.create({ data: { consumableId: product.id, type, quantity, date: new Date(day) } });
      const report = await buildChemicalOpeningReport(tx);
      const row = report.rows.find(row => row.id === product.id);
      assert.ok(row);
      assert.equal(row.quantity, "13");
      assert.equal(row.entries, 3);
      assert.equal(row.totalLitres, "26");
      assert.deepEqual(report.breakdown?.[product.id], { initial: "4", direct: "9" });
      console.log("PASS: 2026 initial stock 4 + direct entries 9 = 13 units / 26 L; 2025, November, 2027, adjustments and withdrawals excluded.");
      throw rollback;
    }, { maxWait: 15_000, timeout: 30_000 });
  } catch (error) { if (error !== rollback) throw error; }
  assert.equal(await prisma.consumable.count({ where: { category: tag } }), 0);
  console.log("PASS: all test data rolled back.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => getPrisma().$disconnect());
