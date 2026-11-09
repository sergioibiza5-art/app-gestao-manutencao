"use server";

import { isQualityRole } from "@/lib/quality-roles";


import { requireCanSgq } from "@/lib/auth";
import { calibrationDay } from "@/lib/calibration-alerts";
import { getPrisma } from "@/lib/prisma";

export async function claimCalibrationSummary() {
  const user = await requireCanSgq();
  if (!isQualityRole(user.role)) return false;
  const result = await getPrisma().alertDigestDelivery.createMany({
    data: { userId: user.id, digestDate: calibrationDay(new Date()), channel: "calibration-in-app" },
    skipDuplicates: true,
  });
  return result.count === 1;
}
