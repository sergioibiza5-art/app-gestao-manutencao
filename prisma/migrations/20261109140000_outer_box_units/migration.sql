ALTER TABLE "Consumable" ADD COLUMN "stockUnitsPerOuterBox" INTEGER CHECK ("stockUnitsPerOuterBox" > 0);
