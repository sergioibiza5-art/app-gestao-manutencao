-- CreateEnum
CREATE TYPE "InterventionKind" AS ENUM ('INSPECTION', 'MAINTENANCE');

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN "supplier" TEXT,
ADD COLUMN "responsibleDepartment" TEXT,
ADD COLUMN "isMeasurementMonitoring" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MaintenanceLog" ADD COLUMN "performedBy" TEXT;

-- CreateTable
CREATE TABLE "EquipmentInterventionPlan" (
    "id" TEXT NOT NULL,
    "kind" "InterventionKind" NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "frequency" "TaskFrequency" NOT NULL,
    "actions" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "equipmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentInterventionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentInterventionLog" (
    "id" TEXT NOT NULL,
    "kind" "InterventionKind" NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "title" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedBy" TEXT,
    "actionsDone" TEXT NOT NULL,
    "result" TEXT,
    "notes" TEXT,
    "equipmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentInterventionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquipmentInterventionPlan_kind_idx" ON "EquipmentInterventionPlan"("kind");

-- CreateIndex
CREATE INDEX "EquipmentInterventionPlan_type_idx" ON "EquipmentInterventionPlan"("type");

-- CreateIndex
CREATE INDEX "EquipmentInterventionLog_performedAt_idx" ON "EquipmentInterventionLog"("performedAt");

-- CreateIndex
CREATE INDEX "EquipmentInterventionLog_kind_idx" ON "EquipmentInterventionLog"("kind");

-- CreateIndex
CREATE INDEX "EquipmentInterventionLog_type_idx" ON "EquipmentInterventionLog"("type");

-- AddForeignKey
ALTER TABLE "EquipmentInterventionPlan" ADD CONSTRAINT "EquipmentInterventionPlan_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentInterventionLog" ADD CONSTRAINT "EquipmentInterventionLog_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
