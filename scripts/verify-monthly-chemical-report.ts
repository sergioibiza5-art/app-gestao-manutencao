import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { getPrisma } from "@/lib/prisma";
import { buildMonthlyChemicalReport } from "@/lib/chemical-monthly-report";

loadEnvConfig(process.cwd());
const rollback = new Error("ROLLBACK_MONTHLY_CHEMICAL_TEST");
const tag = `chemical-report-test-${randomUUID()}`;

async function main() {
  const prisma = getPrisma();
  try {
    await prisma.$transaction(async tx => {
      const base = { category: tag, unit: "un", name: tag };
      const chemical = await tx.consumable.create({ data: { ...base, productType: "CHEMICAL_LIQUID", packageQuantity: "2", packageUnit: "L" } });
      const other = await tx.consumable.create({ data: { ...base, productType: "NON_CHEMICAL" } });
      const sameName = await tx.consumable.create({ data: { ...base, unit: "L", productType: "CHEMICAL_LIQUID" } });
      const weight = await tx.consumable.create({ data: { ...base, productType: "CHEMICAL_OTHER", packageQuantity: "450", packageUnit: "g" } });
      for (const [id, type, quantity, date] of [
        ...Array.from({ length: 3 }, () => [chemical.id, "ENTRADA_DIRETA", "3", "2026-07-15T12:00:00Z"]),
        [chemical.id, "ENTRADA_MANUAL", "500", "2026-07-15T12:00:00Z"],
        [chemical.id, "SAIDA_DIRETA", "1", "2026-07-15T12:00:00Z"],
        [chemical.id, "ENTRADA_DIRETA", "100", "2026-07-31T23:00:00Z"],
        [other.id, "ENTRADA_DIRETA", "100", "2026-07-15T12:00:00Z"],
        [sameName.id, "ENTRADA_INICIAL", "0.00000001", "2026-06-30T23:00:00Z"],
        [sameName.id, "ENTRADA_DIRETA", "0.00000002", "2026-07-15T12:00:00Z"],
        [weight.id, "ENTRADA_INICIAL", "3", "2026-07-15T12:00:00Z"],
        [weight.id, "ENTRADA_DIRETA", "6", "2026-07-15T12:00:00Z"],
      ]) await tx.consumableMovement.create({ data: { consumableId: id, type, quantity, date: new Date(date) } });
      const report = await buildMonthlyChemicalReport("2026-07", tx);
      const rows = report.rows.filter(row => [chemical.id, other.id, sameName.id].includes(row.id));
      assert.equal(rows.length, 2);
      assert.equal(rows.find(row => row.id === chemical.id)?.quantity, "9");
      assert.equal(rows.find(row => row.id === chemical.id)?.entries, 3);
      assert.equal(rows.find(row => row.id === chemical.id)?.litresPerUnit, "2");
      assert.equal(rows.find(row => row.id === chemical.id)?.totalLitres, "18");
      assert.equal(rows.find(row => row.id === sameName.id)?.quantity, "0.00000003");
      assert.equal(rows.find(row => row.id === sameName.id)?.entries, 2);
      assert.equal(rows.find(row => row.id === sameName.id)?.totalLitres, "0.00000003");
      const massRow = report.rows.find(row => row.id === weight.id)!;
      assert.equal(massRow.quantity, "9");
      assert.equal(massRow.totalKilograms, "4.05");
      assert.equal(massRow.totalLitres, null);
      console.log("PASS: 9 x 450 g = 4.05 kg, separated from litres.");
      console.log("PASS: 3 x 3 = 9 in one row; initial stock included; adjustments, withdrawals, non-chemicals and next-month entries excluded; distinct product IDs and exact decimals preserved.");
      throw rollback;
    }, { timeout: 30_000 });
  } catch (error) { if (error !== rollback) throw error; }
  assert.equal(await prisma.consumable.count({ where: { category: tag } }), 0);
  console.log("PASS: test records rolled back; no stock or permanent records changed.");
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => getPrisma().$disconnect());
