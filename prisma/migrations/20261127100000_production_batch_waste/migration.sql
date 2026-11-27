ALTER TABLE "ProductionBatch" ADD COLUMN "wasteQuantity" DECIMAL(14,3);
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_wasteQuantity_check"
 CHECK ("wasteQuantity" IS NULL OR "wasteQuantity" >= 0);
