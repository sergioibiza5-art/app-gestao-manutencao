CREATE TABLE "MaintenanceMeterReading" (
  "id" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "groupKey" TEXT NOT NULL,
  "meterHours" DECIMAL(12,2) NOT NULL,
  "referenceHours" DECIMAL(12,2),
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedById" TEXT NOT NULL,
  "recorderName" TEXT NOT NULL,
  CONSTRAINT "MaintenanceMeterReading_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MaintenanceMeterReading_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MaintenanceMeterReading_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "MaintenanceMeterReading_equipmentId_groupKey_recordedAt_idx"
  ON "MaintenanceMeterReading"("equipmentId", "groupKey", "recordedAt");
