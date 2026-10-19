ALTER TABLE "Consumable" ALTER COLUMN "currentStock" TYPE DECIMAL(18,8);
ALTER TABLE "ConsumableMovement" ALTER COLUMN "quantity" TYPE DECIMAL(18,8);
ALTER TABLE "TicketConsumableUsage" ALTER COLUMN "quantity" TYPE DECIMAL(18,8);
