import assert from "node:assert/strict";
import test from "node:test";
import { firstBusinessDay, chemicalMonth, monthlyChemicalSchedule, portugueseHolidays } from "./chemical-monthly-calendar";
import { monthlyChemicalCsv, monthlyChemicalHtml, monthlyChemicalEntryTypes, chemicalReportGroups } from "./chemical-monthly-report";
import { chemicalMeasurement } from "./chemical-volume";

test("first business day excludes weekends and fixed/movable Portuguese holidays", () => {
  assert.equal(firstBusinessDay("2026-12"), "2026-12-02");
  assert.equal(firstBusinessDay("2027-01"), "2027-01-04");
  assert.equal(firstBusinessDay("2026-05"), "2026-05-04");
  assert.equal(firstBusinessDay("2026-11"), "2026-11-02");
  assert.ok(portugueseHolidays(2026).has("2026-04-03"));
  assert.ok(portugueseHolidays(2026).has("2026-06-04"));
  assert.ok(portugueseHolidays(2027).has("2027-05-27"));
  assert.throws(() => firstBusinessDay("2026-13"));
});

test("monthly window uses Lisbon midnights, half-open intervals, leap years and year rollover", () => {
  const july = chemicalMonth("2026-07");
  assert.equal(july.from.toISOString(), "2026-06-30T23:00:00.000Z");
  assert.equal(july.until.toISOString(), "2026-07-31T23:00:00.000Z");
  const october = chemicalMonth("2026-10");
  assert.equal(october.from.toISOString(), "2026-09-30T23:00:00.000Z");
  assert.equal(october.until.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(chemicalMonth("2024-02").end, "2024-02-29");
  assert.equal(monthlyChemicalSchedule(new Date("2027-01-04T08:00:00Z")).month, "2026-12");
});

test("send gate respects 08:00 Lisbon, national holidays and catch-up runs", () => {
  assert.equal(monthlyChemicalSchedule(new Date("2026-12-01T08:00:00Z")).due, false);
  assert.equal(monthlyChemicalSchedule(new Date("2026-12-02T07:59:59Z")).due, false);
  assert.equal(monthlyChemicalSchedule(new Date("2026-12-02T08:00:00Z")).due, true);
  assert.equal(monthlyChemicalSchedule(new Date("2026-12-03T08:00:00Z")).due, true);
  assert.equal(monthlyChemicalSchedule(new Date("2026-12-03T07:59:59Z")).due, false);
  assert.equal(monthlyChemicalSchedule(new Date("2026-07-02T06:59:59Z")).due, false);
  const summer = monthlyChemicalSchedule(new Date("2026-07-01T07:00:00Z"));
  assert.equal(summer.due, true);
  assert.equal(summer.month, "2026-06");
  assert.equal(monthlyChemicalSchedule(new Date("2026-08-31T23:30:00Z")).month, "2026-08");
});

test("report explicitly includes initial stock but not adjustments or withdrawals", () => {
  assert.deepEqual(monthlyChemicalEntryTypes, ["ENTRADA_DIRETA", "ENTRADA_INICIAL"]);
});

test("the two daily UTC cron slots cover 08:00 Lisbon in every month", () => {
  for (let month = 1; month <= 12; month++) {
    const day = firstBusinessDay(`2027-${String(month).padStart(2, "0")}`);
    const slots = [7, 8].map(hour => new Date(`${day}T${String(hour).padStart(2, "0")}:00:00Z`));
    const firstDue = slots.find(now => monthlyChemicalSchedule(now).due);
    assert.ok(firstDue);
    const localHour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", hour: "2-digit", hourCycle: "h23" }).format(firstDue);
    assert.equal(localHour, "08", day);
  }
});

test("CSV and email have one line per aggregated product, preserve exact decimals and escape content", () => {
  const report = { ...chemicalMonth("2026-11"), rows: [
    { id: "one", name: 'Produto <A>; "X"', productType: "CHEMICAL_LIQUID", unit: "un", supplier: null, quantity: "9", entries: 3, packageQuantity: null, packageUnit: null },
    { id: "two", name: "=Produto", productType: "CHEMICAL_AEROSOL", unit: "L", supplier: null, quantity: "0.00000003", entries: 3, packageQuantity: null, packageUnit: null },
  ].map(row => ({ ...row, ...chemicalMeasurement(row, row.quantity) })) };
  const csv = monthlyChemicalCsv(report), html = monthlyChemicalHtml(report);
  assert.equal(csv.split("\r\n").length, 7);
  assert.ok(csv.includes('"9";"un";"";"";"";"";"Conteúdo'));
  assert.ok(csv.includes('"0,00000003"'));
  assert.ok(csv.includes('"\'=Produto"'));
  assert.ok(html.includes("Produto &lt;A&gt;"));
  assert.ok(!html.includes("Produto <A>"));
  assert.ok(monthlyChemicalHtml({ ...report, rows: [] }).includes("Sem entradas"));
  assert.ok(monthlyChemicalCsv({ ...report, rows: [] }).includes("Sem entradas"));
  assert.ok(monthlyChemicalHtml(report, true).includes("TESTE: pré-visualização"));
  assert.ok(!monthlyChemicalHtml(report).includes("TESTE:"));
  assert.ok(html.includes("Total apurado (L)"));
  assert.ok(csv.includes("Total (L)"));
  assert.ok(csv.includes("1 produto(s) por confirmar"));
  assert.ok(monthlyChemicalHtml({ ...report, rows: [report.rows[0]] }).includes("Produtos por confirmar"));
});

test("volume and weight have separate product groups, CSV columns and unit-specific totals", () => {
  const rows = [
    { id: "unknown", name: "Sem capacidade", unit: "un", quantity: "9" },
    { id: "weight", name: "Massa", unit: "g", quantity: "900" },
    { id: "liquid", name: "Líquido", unit: "L", quantity: "2" },
  ].map(row => ({ ...row, productType: "CHEMICAL_OTHER", supplier: null, packageQuantity: null, packageUnit: null, entries: 1, ...chemicalMeasurement(row, row.quantity) }));
  const report = { ...chemicalMonth("2026-11"), rows };
  const groups = chemicalReportGroups(report);
  assert.deepEqual(groups.volume.map(row => row.id), ["liquid"]);
  assert.deepEqual(groups.mass.map(row => row.id), ["weight"]);
  assert.deepEqual(groups.unknown.map(row => row.id), ["unknown"]);
  const html = monthlyChemicalHtml(report), csv = monthlyChemicalCsv(report);
  assert.ok(html.includes("Produtos em volume (L)"));
  assert.ok(html.includes("Produtos em peso (kg)"));
  assert.ok(html.includes("Total apurado (kg)"));
  assert.ok(csv.includes('"Total (L)";"Kg por unidade de stock";"Total (kg)"'));
  assert.ok(csv.includes('"Massa";"Químico — outro";"Peso (kg)";"900";"g";"";"";"0,001";"0,9"'));
  assert.ok(csv.includes('"TOTAL APURADO (L)";"";"Volume (L)";"";"";"";"2"'));
  assert.ok(csv.includes('"TOTAL APURADO (kg)";"";"Peso (kg)";"";"";"";"";"";"0,9"'));
  assert.ok(csv.indexOf('"Líquido";') < csv.indexOf('"Massa";'));
});
