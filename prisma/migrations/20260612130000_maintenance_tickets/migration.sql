ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TICKET';

CREATE TYPE "MaintenanceTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PAUSED', 'DONE', 'VALIDATED', 'CANCELED');
CREATE TYPE "MaintenanceTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

CREATE TABLE "MaintenanceTicket" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "problem" TEXT NOT NULL,
  "solution" TEXT,
  "status" "MaintenanceTicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "MaintenanceTicketPriority" NOT NULL DEFAULT 'NORMAL',
  "location" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "validatedAt" TIMESTAMP(3),
  "equipmentId" TEXT NOT NULL,
  "openedById" TEXT,
  "assignedToId" TEXT,
  "workOrderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketConsumableUsage" (
  "id" TEXT NOT NULL,
  "quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "ticketId" TEXT NOT NULL,
  "consumableId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketConsumableUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaintenanceTicket_number_key" ON "MaintenanceTicket"("number");
CREATE UNIQUE INDEX "MaintenanceTicket_workOrderId_key" ON "MaintenanceTicket"("workOrderId");
CREATE INDEX "MaintenanceTicket_status_idx" ON "MaintenanceTicket"("status");
CREATE INDEX "MaintenanceTicket_openedAt_idx" ON "MaintenanceTicket"("openedAt");
CREATE INDEX "MaintenanceTicket_equipmentId_idx" ON "MaintenanceTicket"("equipmentId");
CREATE INDEX "TicketConsumableUsage_ticketId_idx" ON "TicketConsumableUsage"("ticketId");
CREATE INDEX "TicketConsumableUsage_consumableId_idx" ON "TicketConsumableUsage"("consumableId");

ALTER TABLE "MaintenanceTicket"
  ADD CONSTRAINT "MaintenanceTicket_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaintenanceTicket"
  ADD CONSTRAINT "MaintenanceTicket_openedById_fkey"
  FOREIGN KEY ("openedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaintenanceTicket"
  ADD CONSTRAINT "MaintenanceTicket_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaintenanceTicket"
  ADD CONSTRAINT "MaintenanceTicket_workOrderId_fkey"
  FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TicketConsumableUsage"
  ADD CONSTRAINT "TicketConsumableUsage_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketConsumableUsage"
  ADD CONSTRAINT "TicketConsumableUsage_consumableId_fkey"
  FOREIGN KEY ("consumableId") REFERENCES "Consumable"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
