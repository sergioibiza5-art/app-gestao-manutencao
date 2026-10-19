import type { Prisma } from "@prisma/client";

export async function decrementStock(tx: Prisma.TransactionClient, consumableId: string, quantity: number) {
  const delta = Number(quantity.toFixed(8));
  const changed = await tx.consumable.updateMany({
    where: { id: consumableId, ...(delta > 0 ? { currentStock: { gte: delta } } : {}) },
    data: { currentStock: { decrement: delta } },
  });
  if (changed.count !== 1) throw new Error("Stock insuficiente para o consumo indicado.");
}
