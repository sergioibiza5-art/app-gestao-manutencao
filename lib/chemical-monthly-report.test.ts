import assert from "node:assert/strict";
import test from "node:test";
import { firstBusinessDay, chemicalMonth, monthlyChemicalSchedule, portugueseHolidays } from "./chemical-monthly-calendar";
import { monthlyChemicalCsv, monthlyChemicalHtml, monthlyChemicalEntryTypes } from "./chemical-monthly-report";

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
    { id: "one", name: 'Produto <A>; "X"', productType: "CHEMICAL_LIQUID", unit: "un", supplier: null, quantity: "9", entries: 3 },
    { id: "two", name: "=Produto", productType: "CHEMICAL_AEROSOL", unit: "L", supplier: null, quantity: "0.00000003", entries: 3 },
  ] };
  const csv = monthlyChemicalCsv(report), html = monthlyChemicalHtml(report);
  assert.equal(csv.split("\r\n").length, 5);
  assert.ok(csv.includes('"9";"un";"3"'));
  assert.ok(csv.includes('"0,00000003"'));
  assert.ok(csv.includes('"\'=Produto"'));
  assert.ok(html.includes("Produto &lt;A&gt;"));
  assert.ok(!html.includes("Produto <A>"));
  assert.ok(monthlyChemicalHtml({ ...report, rows: [] }).includes("Sem entradas"));
  assert.ok(monthlyChemicalCsv({ ...report, rows: [] }).includes("Sem entradas"));
  assert.ok(monthlyChemicalHtml(report, true).includes("TESTE: pré-visualização"));
  assert.ok(!monthlyChemicalHtml(report).includes("TESTE:"));
});
