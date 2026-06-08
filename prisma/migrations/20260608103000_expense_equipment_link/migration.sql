ALTER TABLE "Expense" ADD COLUMN "equipmentId" TEXT;

CREATE INDEX "Expense_equipmentId_idx" ON "Expense"("equipmentId");

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
