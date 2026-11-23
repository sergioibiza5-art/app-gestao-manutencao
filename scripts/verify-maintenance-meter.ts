import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { maintenanceMeterState, parseMeter } from "../lib/maintenance-meter";

async function main() {
  const decimal = (value: number) => new Prisma.Decimal(value);
  type Reading = { meterHours: Prisma.Decimal; referenceHours: Prisma.Decimal | null };
  let reading: Reading | null = null;
  let reference: Reading | null = null;
  let maintenance: { meterHours: Prisma.Decimal } | null = null;
  const db = {
    maintenanceMeterReading: {
      findFirst: async ({ where }: { where: { referenceHours?: unknown } }) => where.referenceHours ? reference : reading,
    },
    dailyMaintenanceEntry: { findFirst: async () => maintenance },
  } as unknown as PrismaClient;
  const state = () => maintenanceMeterState(db, "hot", "500-hours", 500);
  assert.equal((await state()).next, null);
  reference = { meterHours: decimal(1320), referenceHours: decimal(1000) };
  reading = reference;
  assert.equal((await state()).next?.toString(), "1500");
  assert.equal((await state()).next!.minus((await state()).current!).toString(), "180");
  reading = { meterHours: decimal(1400), referenceHours: null };
  assert.equal((await state()).next?.toString(), "1500");
  reading = { meterHours: decimal(1500), referenceHours: null };
  assert.ok((await state()).current!.gte((await state()).next!));
  maintenance = { meterHours: decimal(1500) };
  assert.equal((await state()).next?.toString(), "2000");
  maintenance = null;
  reference = null;
  reading = null;
  assert.equal((await maintenanceMeterState(db, "hot", "hours", 500, 200)).next?.toString(), "200");
  for (const value of ["-1", "1.234", "NaN", "10000000000", ""]) assert.equal(parseMeter(value), null);
  assert.equal(parseMeter("1320,25")?.toString(), "1320.25");
  console.log("Meter reference, readings, due threshold and maintenance reset verified.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
