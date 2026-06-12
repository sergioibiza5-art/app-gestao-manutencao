ALTER TABLE "Equipment" ADD COLUMN "parentEquipmentId" TEXT;
ALTER TABLE "Document" ADD COLUMN "workOrderId" TEXT;

CREATE INDEX "Equipment_parentEquipmentId_idx" ON "Equipment"("parentEquipmentId");
CREATE INDEX "Document_workOrderId_idx" ON "Document"("workOrderId");

ALTER TABLE "Equipment"
  ADD CONSTRAINT "Equipment_parentEquipmentId_fkey"
  FOREIGN KEY ("parentEquipmentId") REFERENCES "Equipment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_workOrderId_fkey"
  FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
