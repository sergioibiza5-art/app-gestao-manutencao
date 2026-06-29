ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'DL50_ASSESSMENT';

DO $$ BEGIN
  CREATE TYPE "Dl50Answer" AS ENUM ('YES', 'NO', 'NA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "Dl50AssessmentStatus" AS ENUM ('DRAFT', 'CONFORM', 'NEEDS_ACTION', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Dl50AssessmentTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "equipmentTypeId" TEXT NOT NULL,
  "ceMark" "Dl50Answer",
  "manufacturerManual" "Dl50Answer",
  "suitableForUse" "Dl50Answer",
  "maintenancePlan" "Dl50Answer",
  "safetyDependsOnInstallation" "Dl50Answer",
  "subjectToRiskDeterioration" "Dl50Answer",
  "needsPeriodicVerification" "Dl50Answer",
  "hasDangerZone" "Dl50Answer",
  "hasMovingPartsRisk" "Dl50Answer",
  "hasIdentifiedControls" "Dl50Answer",
  "voluntaryStart" "Dl50Answer",
  "safeStop" "Dl50Answer",
  "emergencyStopRequired" "Dl50Answer",
  "projectionRisk" "Dl50Answer",
  "emissionRisk" "Dl50Answer",
  "electricalRisk" "Dl50Answer",
  "fireRisk" "Dl50Answer",
  "explosionRisk" "Dl50Answer",
  "energyIsolation" "Dl50Answer",
  "safetySignage" "Dl50Answer",
  "operatorsInformed" "Dl50Answer",
  "usedAccordingToManufacturer" "Dl50Answer",
  "article3Notes" TEXT,
  "article4Notes" TEXT,
  "article6Notes" TEXT,
  "article7Notes" TEXT,
  "article8Notes" TEXT,
  "article9Notes" TEXT,
  "article10Notes" TEXT,
  "article11Notes" TEXT,
  "article12Notes" TEXT,
  "article13Notes" TEXT,
  "article14Notes" TEXT,
  "article15Notes" TEXT,
  "article16Notes" TEXT,
  "article17Notes" TEXT,
  "article18Notes" TEXT,
  "article19Notes" TEXT,
  "article20Notes" TEXT,
  "article21Notes" TEXT,
  "article22Notes" TEXT,
  "article30Notes" TEXT,
  "article31Notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Dl50AssessmentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EquipmentDl50Assessment" (
  "id" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "ceMark" "Dl50Answer",
  "manufacturerManual" "Dl50Answer",
  "suitableForUse" "Dl50Answer",
  "maintenancePlan" "Dl50Answer",
  "safetyDependsOnInstallation" "Dl50Answer",
  "subjectToRiskDeterioration" "Dl50Answer",
  "needsPeriodicVerification" "Dl50Answer",
  "hasDangerZone" "Dl50Answer",
  "hasMovingPartsRisk" "Dl50Answer",
  "hasIdentifiedControls" "Dl50Answer",
  "voluntaryStart" "Dl50Answer",
  "safeStop" "Dl50Answer",
  "emergencyStopRequired" "Dl50Answer",
  "projectionRisk" "Dl50Answer",
  "emissionRisk" "Dl50Answer",
  "electricalRisk" "Dl50Answer",
  "fireRisk" "Dl50Answer",
  "explosionRisk" "Dl50Answer",
  "energyIsolation" "Dl50Answer",
  "safetySignage" "Dl50Answer",
  "operatorsInformed" "Dl50Answer",
  "usedAccordingToManufacturer" "Dl50Answer",
  "article3Notes" TEXT,
  "article4Notes" TEXT,
  "article6Notes" TEXT,
  "article7Notes" TEXT,
  "article8Notes" TEXT,
  "article9Notes" TEXT,
  "article10Notes" TEXT,
  "article11Notes" TEXT,
  "article12Notes" TEXT,
  "article13Notes" TEXT,
  "article14Notes" TEXT,
  "article15Notes" TEXT,
  "article16Notes" TEXT,
  "article17Notes" TEXT,
  "article18Notes" TEXT,
  "article19Notes" TEXT,
  "article20Notes" TEXT,
  "article21Notes" TEXT,
  "article22Notes" TEXT,
  "article30Notes" TEXT,
  "article31Notes" TEXT,
  "conclusion" TEXT NOT NULL,
  "status" "Dl50AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
  "documentId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EquipmentDl50Assessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Dl50AssessmentTemplate_equipmentTypeId_name_key" ON "Dl50AssessmentTemplate"("equipmentTypeId", "name");
CREATE INDEX IF NOT EXISTS "Dl50AssessmentTemplate_active_idx" ON "Dl50AssessmentTemplate"("active");
CREATE UNIQUE INDEX IF NOT EXISTS "EquipmentDl50Assessment_equipmentId_version_key" ON "EquipmentDl50Assessment"("equipmentId", "version");
CREATE INDEX IF NOT EXISTS "EquipmentDl50Assessment_equipmentId_idx" ON "EquipmentDl50Assessment"("equipmentId");
CREATE INDEX IF NOT EXISTS "EquipmentDl50Assessment_status_idx" ON "EquipmentDl50Assessment"("status");

DO $$ BEGIN
  ALTER TABLE "Dl50AssessmentTemplate" ADD CONSTRAINT "Dl50AssessmentTemplate_equipmentTypeId_fkey"
  FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "EquipmentDl50Assessment" ADD CONSTRAINT "EquipmentDl50Assessment_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "EquipmentDl50Assessment" ADD CONSTRAINT "EquipmentDl50Assessment_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "EquipmentDl50Assessment" ADD CONSTRAINT "EquipmentDl50Assessment_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
