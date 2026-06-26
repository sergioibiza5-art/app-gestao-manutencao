ALTER TABLE "EnvironmentalImport"
ADD COLUMN IF NOT EXISTS "fileHash" TEXT;

ALTER TABLE "EnvironmentalImport"
ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL';

ALTER TABLE "EnvironmentalImport"
ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;

ALTER TABLE "EnvironmentalImport"
ADD COLUMN IF NOT EXISTS "sourceModifiedAt" TIMESTAMP(3);

ALTER TABLE "EnvironmentalSettings"
ADD COLUMN IF NOT EXISTS "sharePointFolderUrl" TEXT;

UPDATE "EnvironmentalSettings"
SET "sharePointFolderUrl" = COALESCE(
  "sharePointFolderUrl",
  'https://oasiporpt-my.sharepoint.com/:f:/g/personal/geral_oasipor_pt/IgDGQbhlnwK8QpbldbF0iFAOAR3ORtGaZOQtTwCUZZ8xeQc'
)
WHERE "id" = 'default';

CREATE UNIQUE INDEX IF NOT EXISTS "EnvironmentalImport_fileHash_key"
ON "EnvironmentalImport"("fileHash")
WHERE "fileHash" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "EnvironmentalImport_source_idx"
ON "EnvironmentalImport"("source");

CREATE INDEX IF NOT EXISTS "EnvironmentalImport_importedAt_idx"
ON "EnvironmentalImport"("importedAt");
