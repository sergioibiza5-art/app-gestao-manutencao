CREATE TABLE IF NOT EXISTS "EnvironmentalSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "alertStartTime" TEXT NOT NULL DEFAULT '06:00',
  "alertEndTime" TEXT NOT NULL DEFAULT '22:00',
  "includeSaturday" BOOLEAN NOT NULL DEFAULT false,
  "includeSunday" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnvironmentalSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "EnvironmentalSettings" (
  "id",
  "alertStartTime",
  "alertEndTime",
  "includeSaturday",
  "includeSunday",
  "updatedAt"
)
VALUES ('default', '06:00', '22:00', false, false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
