ALTER TABLE "ProductionBatch" ALTER COLUMN "status" SET DEFAULT 'PLANNED';
ALTER TABLE "ProductionBatch" DROP CONSTRAINT "ProductionBatch_status_check";
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_status_check"
  CHECK ("status" IN ('PLANNED', 'OPEN', 'DONE', 'VERIFIED'));
