ALTER TABLE "Vacation"
ADD COLUMN IF NOT EXISTS "absenceHours" DECIMAL(6,2) NOT NULL DEFAULT 0;

ALTER TABLE "Vacation"
ADD COLUMN IF NOT EXISTS "bankHoursUsed" DECIMAL(6,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "EnvironmentalImport" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "rowsCount" INTEGER NOT NULL DEFAULT 0,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnvironmentalImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EnvironmentalReading" (
  "id" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "sensor" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "value" DECIMAL(10,2) NOT NULL,
  "importId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnvironmentalReading_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EnvironmentalReading_timestamp_sensor_type_key"
ON "EnvironmentalReading"("timestamp", "sensor", "type");

CREATE INDEX IF NOT EXISTS "EnvironmentalReading_timestamp_idx"
ON "EnvironmentalReading"("timestamp");

CREATE INDEX IF NOT EXISTS "EnvironmentalReading_type_sensor_idx"
ON "EnvironmentalReading"("type", "sensor");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EnvironmentalReading_importId_fkey'
  ) THEN
    ALTER TABLE "EnvironmentalReading"
    ADD CONSTRAINT "EnvironmentalReading_importId_fkey"
    FOREIGN KEY ("importId") REFERENCES "EnvironmentalImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
