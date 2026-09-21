ALTER TABLE "MaintenanceSchedule" ADD COLUMN "assignedToId" TEXT;

CREATE TABLE "AlertDigestDelivery" (
  "id" TEXT NOT NULL,
  "digestDate" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "subject" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AlertDigestDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaintenanceSchedule_assignedToId_idx" ON "MaintenanceSchedule"("assignedToId");
CREATE INDEX "AlertDigestDelivery_sentAt_idx" ON "AlertDigestDelivery"("sentAt");
CREATE UNIQUE INDEX "AlertDigestDelivery_userId_digestDate_channel_key" ON "AlertDigestDelivery"("userId", "digestDate", "channel");

ALTER TABLE "MaintenanceSchedule"
  ADD CONSTRAINT "MaintenanceSchedule_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AlertDigestDelivery"
  ADD CONSTRAINT "AlertDigestDelivery_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
