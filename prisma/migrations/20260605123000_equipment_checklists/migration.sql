-- CreateEnum
CREATE TYPE "ChecklistResponseStatus" AS ENUM ('OK', 'NOT_OK', 'NA');

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN "equipmentTypeId" TEXT;

-- CreateTable
CREATE TABLE "EquipmentType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "equipmentTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "check" TEXT NOT NULL,
    "expectedCondition" TEXT NOT NULL,
    "photoRequired" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalMaintenanceRecord" (
    "id" TEXT NOT NULL,
    "documentNo" TEXT,
    "year" INTEGER,
    "month" INTEGER,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsible" TEXT,
    "result" TEXT,
    "notes" TEXT,
    "equipmentId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalMaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistResponse" (
    "id" TEXT NOT NULL,
    "status" "ChecklistResponseStatus" NOT NULL,
    "obs" TEXT,
    "recordId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistPhoto" (
    "id" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "caption" TEXT,
    "responseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentType_name_key" ON "EquipmentType"("name");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_active_idx" ON "ChecklistTemplate"("active");

-- CreateIndex
CREATE INDEX "ChecklistItem_order_idx" ON "ChecklistItem"("order");

-- CreateIndex
CREATE INDEX "ChecklistItem_active_idx" ON "ChecklistItem"("active");

-- CreateIndex
CREATE INDEX "InternalMaintenanceRecord_performedAt_idx" ON "InternalMaintenanceRecord"("performedAt");

-- CreateIndex
CREATE INDEX "InternalMaintenanceRecord_year_month_idx" ON "InternalMaintenanceRecord"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistResponse_recordId_itemId_key" ON "ChecklistResponse"("recordId", "itemId");

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalMaintenanceRecord" ADD CONSTRAINT "InternalMaintenanceRecord_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalMaintenanceRecord" ADD CONSTRAINT "InternalMaintenanceRecord_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistResponse" ADD CONSTRAINT "ChecklistResponse_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "InternalMaintenanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistResponse" ADD CONSTRAINT "ChecklistResponse_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistPhoto" ADD CONSTRAINT "ChecklistPhoto_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "ChecklistResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
