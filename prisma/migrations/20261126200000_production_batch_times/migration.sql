ALTER TABLE "ProductionBatch" ADD COLUMN "startedAt" TIMESTAMP(3), ADD COLUMN "endedAt" TIMESTAMP(3);
-- Earlier versions recorded transitions in the audit trail but not on the batch.
WITH times AS (
 SELECT "batchId",
 MIN("createdAt") FILTER (WHERE "action" = 'Lote iniciado' OR ("action" = 'Lote criado' AND "after"->>'status' = 'OPEN')) AS started,
 MAX("createdAt") FILTER (WHERE "action" = 'Lote terminado' OR ("action" = 'Lote atualizado' AND "after"->>'status' = 'DONE' AND "before"->>'status' IS DISTINCT FROM 'DONE')) AS ended
 FROM "ProductionAudit" GROUP BY "batchId"
)
UPDATE "ProductionBatch" b SET "startedAt" = times.started,
 "endedAt" = CASE WHEN b."status" IN ('DONE','VERIFIED') THEN times.ended ELSE NULL END
FROM times WHERE b.id = times."batchId";
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_times_check"
 CHECK ("startedAt" IS NULL OR "endedAt" IS NULL OR "endedAt" >= "startedAt");
