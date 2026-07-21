ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "code" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Vehicle_code_key" ON "Vehicle"("code");
