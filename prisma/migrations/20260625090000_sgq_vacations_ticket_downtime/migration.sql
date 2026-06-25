ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SGQ';

ALTER TABLE "MaintenanceTicket"
ADD COLUMN IF NOT EXISTS "machineStopped" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "Vacation" (
  "id" TEXT NOT NULL,
  "employeeName" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "days" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "notes" TEXT,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Vacation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Vacation_startDate_idx" ON "Vacation"("startDate");
CREATE INDEX IF NOT EXISTS "Vacation_endDate_idx" ON "Vacation"("endDate");
CREATE INDEX IF NOT EXISTS "Vacation_userId_idx" ON "Vacation"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Vacation_userId_fkey'
  ) THEN
    ALTER TABLE "Vacation"
    ADD CONSTRAINT "Vacation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
