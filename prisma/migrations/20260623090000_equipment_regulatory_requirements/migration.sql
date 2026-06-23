ALTER TABLE "Equipment"
ADD COLUMN IF NOT EXISTS "regulatoryRequirements" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Equipment"
ADD COLUMN IF NOT EXISTS "regulatoryDetails" TEXT;
