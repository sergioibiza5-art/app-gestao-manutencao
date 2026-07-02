ALTER TABLE "CalibrationLog"
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "equipmentId"
      ORDER BY "calibrationDate" DESC, "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "CalibrationLog"
)
UPDATE "CalibrationLog"
SET "active" = ranked.rn = 1
FROM ranked
WHERE "CalibrationLog"."id" = ranked."id";

CREATE INDEX "CalibrationLog_equipmentId_active_idx" ON "CalibrationLog"("equipmentId", "active");
CREATE INDEX "CalibrationLog_nextDueDate_idx" ON "CalibrationLog"("nextDueDate");
