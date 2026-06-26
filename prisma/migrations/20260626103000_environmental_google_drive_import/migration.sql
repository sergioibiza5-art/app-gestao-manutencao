ALTER TABLE "EnvironmentalSettings"
ADD COLUMN IF NOT EXISTS "googleDriveFolderId" TEXT;

ALTER TABLE "EnvironmentalSettings"
ADD COLUMN IF NOT EXISTS "googleDriveFolderUrl" TEXT;
