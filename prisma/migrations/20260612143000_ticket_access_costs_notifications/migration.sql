DROP INDEX IF EXISTS "User_email_key";

ALTER TABLE "User" ADD COLUMN "pin" TEXT;
ALTER TABLE "User" ADD COLUMN "hourlyRate" DECIMAL(10,2) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

ALTER TABLE "Consumable" ADD COLUMN "unitCost" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "MaintenanceTicket" ADD COLUMN "observations" TEXT;
ALTER TABLE "MaintenanceTicket" ADD COLUMN "totalWorkSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MaintenanceTicket" ADD COLUMN "laborCost" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "MaintenanceTicket" ADD COLUMN "consumableCost" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "MaintenanceTicket" ADD COLUMN "totalCost" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "TicketConsumableUsage" ADD COLUMN "unitCost" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TABLE "TicketEquipmentAccess" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketEquipmentAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "href" TEXT,
  "readAt" TIMESTAMP(3),
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TicketEquipmentAccess_userId_equipmentId_key" ON "TicketEquipmentAccess"("userId", "equipmentId");
CREATE INDEX "TicketEquipmentAccess_equipmentId_idx" ON "TicketEquipmentAccess"("equipmentId");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

ALTER TABLE "TicketEquipmentAccess"
  ADD CONSTRAINT "TicketEquipmentAccess_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketEquipmentAccess"
  ADD CONSTRAINT "TicketEquipmentAccess_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
