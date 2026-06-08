CREATE TYPE "WorkOrderStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELED');

ALTER TABLE "Task" ADD COLUMN "isRecurring" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Task" ADD COLUMN "dueTime" TEXT;
ALTER TABLE "Task" ALTER COLUMN "frequency" DROP NOT NULL;

CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL DEFAULT 'INTERNAL',
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "performedBy" TEXT,
    "actionsDone" TEXT,
    "result" TEXT,
    "notes" TEXT,
    "equipmentId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "templateId" TEXT,
    "checklistRecordId" TEXT,
    "maintenanceLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkOrder_sequence_key" ON "WorkOrder"("sequence");
CREATE UNIQUE INDEX "WorkOrder_number_key" ON "WorkOrder"("number");
CREATE UNIQUE INDEX "WorkOrder_scheduleId_key" ON "WorkOrder"("scheduleId");
CREATE UNIQUE INDEX "WorkOrder_checklistRecordId_key" ON "WorkOrder"("checklistRecordId");
CREATE UNIQUE INDEX "WorkOrder_maintenanceLogId_key" ON "WorkOrder"("maintenanceLogId");
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");
CREATE INDEX "WorkOrder_openedAt_idx" ON "WorkOrder"("openedAt");

ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "MaintenanceSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_checklistRecordId_fkey" FOREIGN KEY ("checklistRecordId") REFERENCES "InternalMaintenanceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_maintenanceLogId_fkey" FOREIGN KEY ("maintenanceLogId") REFERENCES "MaintenanceLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
