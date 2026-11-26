import assert from "node:assert/strict";
import test from "node:test";
import { chemicalOpeningRange, openingReportRequired, openingDeliveryIdentity, openingDeliveryChannel, openingDigestDate } from "./chemical-opening-report";
import { chemicalMonth } from "./chemical-monthly-calendar";
import { monthlyChemicalCsv, monthlyChemicalHtml, type ChemicalReport } from "./chemical-monthly-report";

test("initial delivery is not repeated with November when already sent today", () => {
  assert.equal(openingReportRequired("2026-11", true), false);
  assert.equal(openingReportRequired("2026-11", false), true);
  assert.equal(openingReportRequired("2026-12", false), false);
});

test("an explicitly authorized resend keeps its own receipt without replacing the original delivery", () => {
  assert.deepEqual(openingDeliveryIdentity(false, "new-grant"), { channel: openingDeliveryChannel, digestDate: openingDigestDate });
  const revision = openingDeliveryIdentity(true, "new-grant");
  assert.notEqual(revision.channel, openingDeliveryChannel);
  assert.equal(revision.digestDate, "new-grant");
  assert.deepEqual(openingDeliveryIdentity(true, "new-grant"), revision);
  assert.notDeepEqual(openingDeliveryIdentity(true, "another-grant"), revision);
});

test("initial report contains only January through October 2026, without overlapping November", () => {
  const range = chemicalOpeningRange();
  assert.equal(range.start, "2026-01-01");
  assert.equal(range.end, "2026-10-31");
  assert.equal(range.from.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(range.until.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(range.until.valueOf(), chemicalMonth("2026-11").from.valueOf());
  assert.ok(new Date("2025-12-31T23:59:59Z") < range.from);
  assert.ok(new Date("2026-10-31T23:59:59Z") < range.until);
});

test("initial CSV and email keep one product row with initial stock and direct entries distinguished", () => {
  const opening: ChemicalReport = {
    ...chemicalOpeningRange(), title: "Relatório inicial de produtos químicos - 2026", breakdown: { one: { initial: "4", direct: "9" } },
    rows: [{ id: "one", name: "Produto A", productType: "CHEMICAL_LIQUID", unit: "un", supplier: null, packageQuantity: null, packageUnit: "L", quantity: "13", entries: 4, litresPerUnit: "2", totalLitres: "26", litreNote: "", kilogramsPerUnit: null, totalKilograms: null }],
  };
  const csv = monthlyChemicalCsv(opening);
  assert.equal(csv.split("\r\n").length, 6);
  assert.ok(csv.includes('"13";"un";"2";"26"'));
  assert.ok(csv.includes(';"4";"9"'));
  assert.ok(csv.includes("Stock inicial (unidade de stock)"));
  const monthly = { ...chemicalMonth("2026-11"), rows: [] };
  const html = monthlyChemicalHtml(monthly, false, opening);
  assert.equal(html.match(/<html /g)?.length, 1);
  assert.ok(html.includes("01/11/2026 a 30/11/2026"));
  assert.ok(html.includes("01/01/2026 a 31/10/2026"));
  assert.ok(html.includes("Stock inicial: 4"));
  assert.ok(html.includes("Entradas diretas: 9"));
  assert.ok(!monthlyChemicalHtml(monthly).includes(opening.title!));
});
