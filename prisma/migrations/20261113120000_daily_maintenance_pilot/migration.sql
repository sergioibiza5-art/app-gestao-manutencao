CREATE TABLE "DailyMaintenanceEntry" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "revision" INTEGER NOT NULL,
    "documentCode" TEXT NOT NULL,
    "noProduction" BOOLEAN NOT NULL,
    "checks" JSONB NOT NULL,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "recorderName" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyMaintenanceEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DailyMaintenanceEntry_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyMaintenanceEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DailyMaintenanceEntry_equipmentId_day_revision_key"
ON "DailyMaintenanceEntry"("equipmentId", "day", "revision");
