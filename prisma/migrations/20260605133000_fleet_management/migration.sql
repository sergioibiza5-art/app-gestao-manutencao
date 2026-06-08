CREATE TYPE "VehicleFuel" AS ENUM ('GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC', 'LPG', 'OTHER');
CREATE TYPE "VehicleServiceType" AS ENUM ('MAINTENANCE', 'REVISION', 'INSPECTION', 'COST');

CREATE TABLE "Vehicle" (
  "id" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "plate" TEXT NOT NULL,
  "fuel" "VehicleFuel" NOT NULL,
  "year" INTEGER,
  "driver" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VehicleKmLog" (
  "id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "odometer" INTEGER NOT NULL,
  "notes" TEXT,
  "vehicleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VehicleKmLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VehicleService" (
  "id" TEXT NOT NULL,
  "type" "VehicleServiceType" NOT NULL,
  "title" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "odometer" INTEGER,
  "cost" DECIMAL(10,2),
  "supplier" TEXT,
  "nextDueDate" TIMESTAMP(3),
  "nextDueKm" INTEGER,
  "notes" TEXT,
  "vehicleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VehicleService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");
CREATE INDEX "VehicleKmLog_date_idx" ON "VehicleKmLog"("date");
CREATE INDEX "VehicleKmLog_odometer_idx" ON "VehicleKmLog"("odometer");
CREATE INDEX "VehicleService_type_idx" ON "VehicleService"("type");
CREATE INDEX "VehicleService_date_idx" ON "VehicleService"("date");
CREATE INDEX "VehicleService_nextDueDate_idx" ON "VehicleService"("nextDueDate");
CREATE INDEX "VehicleService_nextDueKm_idx" ON "VehicleService"("nextDueKm");

ALTER TABLE "VehicleKmLog"
  ADD CONSTRAINT "VehicleKmLog_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VehicleService"
  ADD CONSTRAINT "VehicleService_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
