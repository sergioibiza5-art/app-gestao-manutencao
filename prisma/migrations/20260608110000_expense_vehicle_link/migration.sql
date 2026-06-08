ALTER TABLE "Expense" ADD COLUMN "vehicleId" TEXT;
ALTER TABLE "Document" ADD COLUMN "vehicleId" TEXT;

CREATE INDEX "Expense_vehicleId_idx" ON "Expense"("vehicleId");
CREATE INDEX "Document_vehicleId_idx" ON "Document"("vehicleId");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
