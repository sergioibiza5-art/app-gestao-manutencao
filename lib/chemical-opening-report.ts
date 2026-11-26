import { Prisma } from "@prisma/client";
import { chemicalMonth } from "@/lib/chemical-monthly-calendar";
import { chemicalMeasurement } from "@/lib/chemical-volume";
import { getPrisma } from "@/lib/prisma";
import { chemicalTypes } from "@/lib/product-types";
import type { ChemicalReport } from "@/lib/chemical-monthly-report";

const Decimal = Prisma.Decimal.clone({ precision: 40 });
export const openingDeliveryChannel = "chemical-opening-email";
export const openingDigestDate = "2026-01_2026-10";
export function openingDeliveryIdentity(resend: boolean, grantHash: string) {
  return resend ? { channel: "chemical-opening-email-resend", digestDate: grantHash } : { channel: openingDeliveryChannel, digestDate: openingDigestDate };
}
export function openingReportRequired(month: string, delivered: boolean) {
  return month === "2026-11" && !delivered;
}
type ReportDb = Pick<ReturnType<typeof getPrisma>, "consumable" | "consumableMovement">;

export function chemicalOpeningRange() {
  return { ...chemicalMonth("2026-01"), month: "inicial-2026", end: "2026-10-31", until: chemicalMonth("2026-11").from };
}

export async function buildChemicalOpeningReport(prisma: ReportDb = getPrisma()): Promise<ChemicalReport> {
  const period = chemicalOpeningRange();
  const grouped = await prisma.consumableMovement.groupBy({
    by: ["consumableId", "type"],
    where: {
      type: { in: ["ENTRADA_DIRETA", "ENTRADA_INICIAL"] }, quantity: { gt: 0 },
      date: { gte: period.from, lt: period.until },
      consumable: { productType: { in: chemicalTypes } },
    },
    _sum: { quantity: true }, _count: { _all: true },
  });
  const quantities = new Map<string, { initial: Prisma.Decimal; direct: Prisma.Decimal; entries: number }>();
  for (const row of grouped) {
    const sum = quantities.get(row.consumableId) ?? { initial: new Decimal(0), direct: new Decimal(0), entries: 0 };
    const key = row.type === "ENTRADA_INICIAL" ? "initial" : "direct";
    sum[key] = sum[key].plus(row._sum.quantity!.toFixed());
    sum.entries += row._count._all;
    quantities.set(row.consumableId, sum);
  }
  const products = await prisma.consumable.findMany({
    where: { id: { in: [...quantities.keys()] } },
    select: { id: true, name: true, productType: true, unit: true, supplier: true, packageQuantity: true, packageUnit: true },
  });
  const breakdown: NonNullable<ChemicalReport["breakdown"]> = {};
  const rows = products.map(product => {
    const sum = quantities.get(product.id)!;
    const quantity = sum.initial.plus(sum.direct).toFixed();
    breakdown[product.id] = { initial: sum.initial.toFixed(), direct: sum.direct.toFixed() };
    return { ...product, quantity, entries: sum.entries, ...chemicalMeasurement(product, quantity) };
  }).sort((a, b) => a.name.localeCompare(b.name, "pt") || a.id.localeCompare(b.id));
  return {
    ...period, rows, breakdown,
    title: "Relatório inicial de produtos químicos - 2026",
    introductoryNote: "Regularização das entradas de 01/01/2026 a 31/10/2026. Este histórico é apresentado separadamente do relatório mensal de novembro. O stock inicial está identificado à parte e não representa necessariamente compras realizadas neste período.",
  };
}
