ALTER TABLE "DailyMaintenanceEntry"
ADD COLUMN "groupKey" TEXT NOT NULL DEFAULT 'daily',
ADD COLUMN "meterHours" DECIMAL(12, 2);

CREATE UNIQUE INDEX "DailyMaintenanceEntry_equipmentId_groupKey_day_revision_key"
ON "DailyMaintenanceEntry"("equipmentId", "groupKey", "day", "revision");

DROP INDEX "DailyMaintenanceEntry_equipmentId_day_revision_key";
