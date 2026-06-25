ALTER TABLE "EnvironmentalReading"
ADD COLUMN IF NOT EXISTS "hour" TEXT;

ALTER TABLE "EnvironmentalReading"
ADD COLUMN IF NOT EXISTS "zone" TEXT NOT NULL DEFAULT 'SEM_ZONA';

ALTER TABLE "EnvironmentalReading"
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'OK';

UPDATE "EnvironmentalReading"
SET "hour" = TO_CHAR("timestamp", 'HH24:MI')
WHERE "hour" IS NULL;

UPDATE "EnvironmentalReading"
SET "zone" = CASE
  WHEN "type" = 'TEMPERATURE' AND UPPER("sensor") IN ('T1', 'TEMPERATURE1', 'TEMP1') THEN 'VEST'
  WHEN "type" = 'TEMPERATURE' AND UPPER("sensor") IN ('T2', 'TEMPERATURE2', 'TEMP2') THEN 'AC1'
  WHEN "type" = 'TEMPERATURE' AND UPPER("sensor") IN ('T3', 'TEMPERATURE3', 'TEMP3') THEN 'AC2'
  WHEN "type" = 'TEMPERATURE' AND UPPER("sensor") IN ('T4', 'TEMPERATURE4', 'TEMP4') THEN 'AC3'
  WHEN "type" = 'TEMPERATURE' AND UPPER("sensor") IN ('T5', 'TEMPERATURE5', 'TEMP5') THEN 'SASC'
  WHEN "type" = 'TEMPERATURE' AND UPPER("sensor") IN ('T6', 'TEMPERATURE6', 'TEMP6') THEN 'SP1'
  WHEN "type" = 'TEMPERATURE' AND UPPER("sensor") IN ('T7', 'TEMPERATURE7', 'TEMP7') THEN 'SP2'
  WHEN "type" = 'HUMIDITY' AND UPPER("sensor") IN ('H1', 'HUMIDITY1', 'HUMIDADE1', 'HUM1') THEN 'VEST'
  WHEN "type" = 'HUMIDITY' AND UPPER("sensor") IN ('H2', 'HUMIDITY2', 'HUMIDADE2', 'HUM2') THEN 'AC1'
  WHEN "type" = 'HUMIDITY' AND UPPER("sensor") IN ('H3', 'HUMIDITY3', 'HUMIDADE3', 'HUM3') THEN 'AC2'
  WHEN "type" = 'HUMIDITY' AND UPPER("sensor") IN ('H4', 'HUMIDITY4', 'HUMIDADE4', 'HUM4') THEN 'AC3'
  WHEN "type" = 'HUMIDITY' AND UPPER("sensor") IN ('H5', 'HUMIDITY5', 'HUMIDADE5', 'HUM5') THEN 'SASC'
  WHEN "type" = 'HUMIDITY' AND UPPER("sensor") IN ('H6', 'HUMIDITY6', 'HUMIDADE6', 'HUM6') THEN 'SP1'
  WHEN "type" = 'HUMIDITY' AND UPPER("sensor") IN ('H7', 'HUMIDITY7', 'HUMIDADE7', 'HUM7') THEN 'SP2'
  WHEN "type" = 'PRESSURE' AND UPPER("sensor") IN ('PA', 'PRESSUREA', 'PRESSAOA') THEN 'SP1-VEST'
  WHEN "type" = 'PRESSURE' AND UPPER("sensor") IN ('PB', 'PRESSUREB', 'PRESSAOB') THEN 'VEST-SP2'
  WHEN "type" = 'PRESSURE' AND UPPER("sensor") IN ('PC', 'PRESSUREC', 'PRESSAOC') THEN 'SP2-SASC'
  WHEN "type" = 'PRESSURE' AND UPPER("sensor") IN ('PD', 'PRESSURED', 'PRESSAOD') THEN 'ARM-AC1'
  WHEN "type" = 'PRESSURE' AND UPPER("sensor") IN ('PE', 'PRESSUREE', 'PRESSAOE') THEN 'AC1-SP1'
  WHEN "type" = 'PRESSURE' AND UPPER("sensor") IN ('PF', 'PRESSUREF', 'PRESSAOF') THEN 'SP1-AC2'
  WHEN "type" = 'PRESSURE' AND UPPER("sensor") IN ('PG', 'PRESSUREG', 'PRESSAOG') THEN 'SASC-AC3'
  WHEN "type" = 'PRESSURE' AND UPPER("sensor") IN ('PH', 'PRESSUREH', 'PRESSAOH') THEN 'AC3-SP2'
  WHEN "type" = 'PRESSURE' AND UPPER("sensor") IN ('PI', 'PRESSUREI', 'PRESSAOI') THEN 'SP2-UEM1'
  ELSE "zone"
END
WHERE "zone" = 'SEM_ZONA';

UPDATE "EnvironmentalReading"
SET "status" = CASE
  WHEN "type" = 'TEMPERATURE' AND ("value" < 15 OR "value" > 25) THEN 'ALERT'
  WHEN "type" = 'HUMIDITY' AND ("value" < 30 OR "value" > 70) THEN 'ALERT'
  WHEN "type" = 'PRESSURE' AND "value" < 5 THEN 'ALERT'
  ELSE 'OK'
END;

CREATE INDEX IF NOT EXISTS "EnvironmentalReading_type_zone_idx"
ON "EnvironmentalReading"("type", "zone");

CREATE INDEX IF NOT EXISTS "EnvironmentalReading_zone_idx"
ON "EnvironmentalReading"("zone");

CREATE INDEX IF NOT EXISTS "EnvironmentalReading_status_idx"
ON "EnvironmentalReading"("status");
