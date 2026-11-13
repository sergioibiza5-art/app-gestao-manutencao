ALTER TABLE "DailyMaintenanceEntry"
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "verifiedById" TEXT,
ADD COLUMN "verifierName" TEXT;
