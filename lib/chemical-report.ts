import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { chemicalTypes } from "@/lib/product-types";

import { entryTypes, lisbonDate, reportRange } from "@/lib/chemical-report-utils";
export { csvCell, entryTypes, lisbonDate, reportRange } from "@/lib/chemical-report-utils";

export async function getChemicalReport(from?: string, to?: string) {
  const user = await requireUser();
  if (!["ADMIN", "MANAGER", "VIEWER"].includes(user.role)) throw new Error("Sem permissão para consultar o inventário.");
  const range = reportRange(from, to);
  const prisma = getPrisma();
  // Fetch a padded UTC interval, then apply exact Lisbon calendar dates (including DST).
  const [entries, unclassified] = await Promise.all([
    prisma.consumableMovement.findMany({
      where: {
        type: { in: Object.keys(entryTypes) },
        consumable: { productType: { in: chemicalTypes } },
        date: { gte: new Date(new Date(`${range.start}T00:00:00Z`).getTime() - 86400000), lt: new Date(new Date(`${range.end}T00:00:00Z`).getTime() + 86400000) },
      },
      include: { consumable: true },
      orderBy: [{ date: "desc" }, { id: "asc" }],
    }),
    prisma.consumable.count({ where: { productType: "UNCLASSIFIED" } }),
  ]);
  return { ...range, unclassified, entries: entries.filter((entry) => {
    const day = lisbonDate(entry.date);
    return day >= range.start && day <= range.end;
  }) };
}

