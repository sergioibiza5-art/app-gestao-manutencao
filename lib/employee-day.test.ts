import assert from "node:assert/strict";
import { test } from "node:test";
import { canViewEmployee, employeeDayTotals, employeeDayWindow, employeeHome, shiftDay, type DayPeriod } from "./employee-day";

test("Home routes preserve management dashboard and move employee roles", () => {
  for (const role of ["TICKET", "USER", "SGQ"]) assert.equal(employeeHome(role), "/funcionario");
  for (const role of ["ADMIN", "MANAGER", "VIEWER"]) assert.equal(employeeHome(role), "/");
  assert.equal(employeeHome("HSA"), "/calibracao");
});

test("Only self or a flagged coordinator can consult a person", () => {
  assert.equal(canViewEmployee({ id: "a", productionCoordinator: false }, "a"), true);
  assert.equal(canViewEmployee({ id: "a", productionCoordinator: false }, "b"), false);
  assert.equal(canViewEmployee({ id: "a", productionCoordinator: true }, "b"), true);
});

test("Lisbon day boundaries support DST and reject invalid dates", () => {
  for (const [day, hours] of [["2026-03-29", 23], ["2026-10-25", 25], ["2026-07-01", 24]] as const) {
    const { start, end } = employeeDayWindow(day);
    assert.equal((end.getTime() - start.getTime()) / 3600000, hours);
  }
  for (const invalid of ["2026-02-30", "nada", "2026-13-01", "2026-11-26T12:00"]) assert.throws(() => employeeDayWindow(invalid));
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
});

test("Daily sums clip at midnight, now and merge overlapping work", () => {
  const window = employeeDayWindow("2026-11-26"), now = new Date("2026-11-26T12:00:00Z");
  const p = (start: string, end: string | null, kind: DayPeriod["kind"] = "production"): DayPeriod => ({ start: new Date(start), end: end ? new Date(end) : null, kind });
  const totals = employeeDayTotals([
    p("2026-11-25T23:30Z", "2026-11-26T01:00Z"),
    p("2026-11-26T00:30Z", "2026-11-26T02:00Z", "quality"),
    p("2026-11-26T11:00Z", null),
    p("2026-11-26T13:00Z", null),
  ], window, now);
  assert.equal(totals.total, 180);
  assert.equal(totals.closed, 120);
  assert.equal(totals.provisional, 60);
  assert.equal(totals.production, 120);
  assert.equal(totals.quality, 90);
  assert.equal(totals.overlap, true);
  const historic = employeeDayTotals([p("2026-11-25T23:00Z", null)], window, new Date("2026-11-27T12:00Z"));
  assert.equal(historic.total, 24 * 60);
  assert.equal(employeeDayTotals([], window, now).total, 0);
});
