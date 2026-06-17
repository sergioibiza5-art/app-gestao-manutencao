ALTER TABLE "MaintenanceTicket"
  ADD COLUMN IF NOT EXISTS "startedById" TEXT,
  ADD COLUMN IF NOT EXISTS "completedById" TEXT,
  ADD COLUMN IF NOT EXISTS "validatedById" TEXT;

ALTER TABLE "ConsumableMovement"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "ticketId" TEXT,
  ADD COLUMN IF NOT EXISTS "workOrderId" TEXT;

DO $$ BEGIN
  ALTER TABLE "MaintenanceTicket"
    ADD CONSTRAINT "MaintenanceTicket_startedById_fkey"
    FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MaintenanceTicket"
    ADD CONSTRAINT "MaintenanceTicket_completedById_fkey"
    FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MaintenanceTicket"
    ADD CONSTRAINT "MaintenanceTicket_validatedById_fkey"
    FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ConsumableMovement"
    ADD CONSTRAINT "ConsumableMovement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ConsumableMovement"
    ADD CONSTRAINT "ConsumableMovement_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ConsumableMovement"
    ADD CONSTRAINT "ConsumableMovement_workOrderId_fkey"
    FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "MaintenanceTicket_startedById_idx" ON "MaintenanceTicket"("startedById");
CREATE INDEX IF NOT EXISTS "MaintenanceTicket_completedById_idx" ON "MaintenanceTicket"("completedById");
CREATE INDEX IF NOT EXISTS "MaintenanceTicket_validatedById_idx" ON "MaintenanceTicket"("validatedById");
CREATE INDEX IF NOT EXISTS "ConsumableMovement_userId_idx" ON "ConsumableMovement"("userId");
CREATE INDEX IF NOT EXISTS "ConsumableMovement_ticketId_idx" ON "ConsumableMovement"("ticketId");
CREATE INDEX IF NOT EXISTS "ConsumableMovement_workOrderId_idx" ON "ConsumableMovement"("workOrderId");
