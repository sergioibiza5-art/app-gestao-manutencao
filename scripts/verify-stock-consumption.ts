import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import { getPrisma } from "../lib/prisma";
import { decrementStock } from "../lib/consume-stock";
import { toStockQuantity } from "../lib/stock-units";

loadEnvConfig(process.cwd());
const prisma = getPrisma();
const rollback = new Error("ROLLBACK_STOCK_TEST");
async function main() {
  const before = await prisma.consumable.count();
  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.consumable.create({ data: { name: "TESTE TRANSACIONAL - NÃO PERSISTIR", category: "Teste", unit: "lata", packageQuantity: 400, packageUnit: "ml", currentStock: 3, unitCost: 12 } });
      let cost = 0;
      for (const ml of [100, 50]) {
        const quantity = toStockQuantity(item, ml, "ml");
        await decrementStock(tx, item.id, quantity);
        await tx.consumableMovement.create({ data: { consumableId: item.id, type: "SAIDA_OP", quantity } });
        cost += quantity * Number(item.unitCost);
      }
      const saved = await tx.consumable.findUniqueOrThrow({ where: { id: item.id }, include: { movements: true } });
      assert.equal(Number(saved.currentStock), 2.625);
      assert.equal(saved.movements.length, 2);
      assert.equal(cost, 4.5);
      await assert.rejects(decrementStock(tx, item.id, 3), /Stock insuficiente/);
      assert.equal(Number((await tx.consumable.findUniqueOrThrow({ where: { id: item.id } })).currentStock), 2.625);
      // Returning a previously consumed quantity restores only that quantity.
      await decrementStock(tx, item.id, -0.125);
      assert.equal(Number((await tx.consumable.findUniqueOrThrow({ where: { id: item.id } })).currentStock), 2.75);
      console.log("PASS: consumption, persisted movements, proportional costs, insufficient stock and return.");
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  assert.equal(await prisma.consumable.count(), before);
  console.log(`PASS: rollback complete; ${before} original products retained.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
