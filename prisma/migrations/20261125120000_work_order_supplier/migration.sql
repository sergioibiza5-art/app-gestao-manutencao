ALTER TABLE "WorkOrder" ADD COLUMN "supplier" TEXT;
UPDATE "WorkOrder" AS w SET "supplier" = s."supplier"
FROM "MaintenanceSchedule" AS s
WHERE w."scheduleId" = s."id" AND w."type" = 'EXTERNAL';
UPDATE "WorkOrder" AS w SET "supplier" = l."supplier"
FROM "MaintenanceLog" AS l
WHERE w."maintenanceLogId" = l."id" AND w."type" = 'EXTERNAL' AND w."supplier" IS NULL;
