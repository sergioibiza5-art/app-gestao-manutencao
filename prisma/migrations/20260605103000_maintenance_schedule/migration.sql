-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "MaintenanceScheduleStatus" AS ENUM ('SCHEDULED', 'DONE', 'CANCELED');

-- AlterTable
ALTER TABLE "MaintenanceLog" ADD COLUMN "type" "MaintenanceType" NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN "costCenter" TEXT;

-- CreateTable
CREATE TABLE "MaintenanceSchedule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "MaintenanceType" NOT NULL DEFAULT 'INTERNAL',
    "status" "MaintenanceScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "frequency" "TaskFrequency" NOT NULL,
    "supplier" TEXT,
    "costCenter" TEXT,
    "notes" TEXT,
    "equipmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_scheduledAt_idx" ON "MaintenanceSchedule"("scheduledAt");

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_type_idx" ON "MaintenanceSchedule"("type");

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_status_idx" ON "MaintenanceSchedule"("status");

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
