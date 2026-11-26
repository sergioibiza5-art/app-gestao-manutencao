CREATE TABLE "ProductionBatch" (
 "id" TEXT NOT NULL PRIMARY KEY, "reference" TEXT NOT NULL, "lot" TEXT NOT NULL,
 "line" TEXT NOT NULL DEFAULT 'SL1', "equipmentId" TEXT NOT NULL,
 "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0, "unit" TEXT NOT NULL DEFAULT 'un',
 "notes" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'OPEN',
 "createdById" TEXT NOT NULL, "verifiedById" TEXT, "verifiedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ProductionBatch_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ProductionBatch_quantity_check" CHECK ("quantity" >= 0),
 CONSTRAINT "ProductionBatch_status_check" CHECK ("status" IN ('OPEN','DONE','VERIFIED'))
);
CREATE UNIQUE INDEX "ProductionBatch_reference_lot_line_key" ON "ProductionBatch"("reference","lot","line");
CREATE INDEX "ProductionBatch_status_createdAt_idx" ON "ProductionBatch"("status","createdAt");
CREATE TABLE "ProductionActivity" (
 "id" TEXT NOT NULL PRIMARY KEY, "batchId" TEXT NOT NULL, "collaboratorId" TEXT NOT NULL,
 "operation" TEXT NOT NULL, "startedAt" TIMESTAMP(3) NOT NULL, "endedAt" TIMESTAMP(3), "notes" TEXT NOT NULL DEFAULT '',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ProductionActivity_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ProductionActivity_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ProductionActivity_interval_check" CHECK ("endedAt" IS NULL OR "endedAt" > "startedAt")
);
CREATE INDEX "ProductionActivity_collaboratorId_startedAt_idx" ON "ProductionActivity"("collaboratorId","startedAt");
CREATE INDEX "ProductionActivity_batchId_startedAt_idx" ON "ProductionActivity"("batchId","startedAt");
CREATE TABLE "ProductionQualityCall" (
 "id" TEXT NOT NULL PRIMARY KEY, "batchId" TEXT NOT NULL, "calledAt" TIMESTAMP(3) NOT NULL,
 "arrivedAt" TIMESTAMP(3), "endedAt" TIMESTAMP(3), "technicianId" TEXT,
 "hasStop" BOOLEAN NOT NULL DEFAULT false, "stopStartedAt" TIMESTAMP(3), "stopEndedAt" TIMESTAMP(3),
 "notes" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ProductionQualityCall_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ProductionQualityCall_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ProductionQualityCall_times_check" CHECK (
  ("arrivedAt" IS NULL OR ("arrivedAt" >= "calledAt" AND "technicianId" IS NOT NULL)) AND
  ("endedAt" IS NULL OR ("arrivedAt" IS NOT NULL AND "endedAt" > "arrivedAt")) AND
  (("hasStop" AND "stopStartedAt" IS NOT NULL AND ("stopEndedAt" IS NULL OR "stopEndedAt" > "stopStartedAt")) OR
   (NOT "hasStop" AND "stopStartedAt" IS NULL AND "stopEndedAt" IS NULL))
 )
);
CREATE INDEX "ProductionQualityCall_batchId_calledAt_idx" ON "ProductionQualityCall"("batchId","calledAt");
CREATE INDEX "ProductionQualityCall_technicianId_arrivedAt_idx" ON "ProductionQualityCall"("technicianId","arrivedAt");
CREATE TABLE "ProductionAudit" (
 "id" TEXT NOT NULL PRIMARY KEY, "batchId" TEXT NOT NULL, "actorId" TEXT NOT NULL, "actorName" TEXT NOT NULL,
 "action" TEXT NOT NULL, "reason" TEXT NOT NULL DEFAULT '', "before" JSONB, "after" JSONB,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ProductionAudit_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductionAudit_batchId_createdAt_idx" ON "ProductionAudit"("batchId","createdAt");
