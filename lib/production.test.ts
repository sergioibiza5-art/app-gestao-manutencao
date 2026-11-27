import test from "node:test";
import assert from "node:assert/strict";
import { batchButtonStatus, canWriteProduction, canManageProduction, elapsedMinutes, stopMinutes, validateQuality, productionDate, productionPeopleSummary, productionBatchMinutes, minutesLabel, productionWasteQuantity } from "./production";
const at = (time: string) => new Date(`2026-11-25T${time}:00Z`);
const cq = { calledAt: at("09:35"), arrivedAt: at("09:40"), endedAt: at("09:50"), technicianId: "quality", hasStop: false, stopStartedAt: null, stopEndedAt: null };

test("Closing waste accepts zero and three decimal places without accepting invalid or negative amounts", () => {
  for (const value of ["0", "0.000", "12.125", "99999999999.999"]) assert.equal(productionWasteQuantity(value), value);
  assert.equal(productionWasteQuantity(" 12,5 "), "12.5");
  for (const value of ["", "-1", "NaN", "Infinity", "1e3", "1.0000", "100000000000", "1,2,3"]) assert.throws(() => productionWasteQuantity(value));
});

test("Production and CQ summaries have independent totals, dates and open states for the same person", () => {
  const person = { name: "Ana", username: "1" };
  const activities = [{ collaboratorId: "a", collaborator: person, startedAt: at("08:00"), endedAt: at("09:00") }];
  const quality = [{ technicianId: "a", technician: person, arrivedAt: at("09:30"), endedAt: null }, { technicianId: "b", technician: { name: "Bruno" }, arrivedAt: null, endedAt: null }];
  const production = productionPeopleSummary(activities, [], at("09:40"));
  const cqOnly = productionPeopleSummary([], quality, at("09:40"));
  assert.equal(production.totalMinutes, 60);
  assert.equal(cqOnly.totalMinutes, 10);
  assert.equal(production.rows[0].open, false);
  assert.equal(production.rows[0].endedAt?.toISOString(), at("09:00").toISOString());
  assert.equal(cqOnly.rows[0].startedAt.toISOString(), at("09:30").toISOString());
  assert.equal(cqOnly.rows[0].open, true);
  assert.equal(cqOnly.rows.length, 1);
});
test("batch buttons only permit starting planned lots and finishing open lots", () => {
  assert.equal(batchButtonStatus("PLANNED", "batch-start"), "OPEN");
  assert.equal(batchButtonStatus("OPEN", "batch-end"), "DONE");
  for (const state of ["OPEN", "DONE", "VERIFIED"]) assert.throws(() => batchButtonStatus(state, "batch-start"));
  for (const state of ["PLANNED", "DONE", "VERIFIED"]) assert.throws(() => batchButtonStatus(state, "batch-end"));
});
test("person totals sum work sessions, include quality but exclude waiting and differ from batch elapsed time", () => {
  const a = { collaboratorId: "a", collaborator: { name: "Ana", username: "1" } };
  const b = { collaboratorId: "b", collaborator: { name: "Bruno", username: "2" } };
  const report = productionPeopleSummary([
    { ...a, startedAt: at("08:00"), endedAt: at("09:00") },
    { ...a, startedAt: at("10:00"), endedAt: at("10:30") },
    { ...b, startedAt: at("08:00"), endedAt: at("09:00") },
  ], [{ technicianId: "c", technician: { name: "Carla" }, arrivedAt: at("08:15"), endedAt: at("08:45") },
    { technicianId: "d", technician: { name: "Daniel" }, arrivedAt: null, endedAt: null }]);
  assert.equal(report.rows.length, 3);
  assert.equal(report.totalMinutes, 180);
  const ana = report.rows.find(p => p.id === "a")!;
  assert.equal(ana.totalMinutes, 90);
  assert.equal(ana.startedAt.toISOString(), at("08:00").toISOString());
  assert.equal(ana.endedAt?.toISOString(), at("10:30").toISOString());
  assert.equal(ana.sessions, 2);
  assert.equal(productionBatchMinutes({ status: "DONE", startedAt: at("08:00"), endedAt: at("10:30") }), 150);
});
test("open sessions keep accumulating, closed batches stay frozen, and missing dates are not zero or invented", () => {
  const people = productionPeopleSummary([{ collaboratorId: "a", collaborator: { name: "Ana" }, startedAt: at("08:00"), endedAt: at("09:00") },
    { collaboratorId: "a", collaborator: { name: "Ana" }, startedAt: at("10:00"), endedAt: null }], [], at("10:15"));
  assert.equal(people.totalMinutes, 75);
  assert.equal(people.rows[0].endedAt, null);
  assert.equal(people.rows[0].open, true);
  assert.equal(productionBatchMinutes({ status: "DONE", startedAt: at("08:00"), endedAt: at("10:00") }, at("12:00")), 120);
  assert.equal(productionBatchMinutes({ status: "DONE", startedAt: at("08:00"), endedAt: null }), null);
  assert.equal(productionBatchMinutes({ status: "DONE", startedAt: null, endedAt: at("10:00") }), null);
  assert.equal(productionPeopleSummary([], []).totalMinutes, 0);
  assert.equal(minutesLabel(0.5), "0h 00m 30s");
});
test("CQ waiting is independent from quality work and operator time", () => {
  validateQuality(cq);
  assert.equal(elapsedMinutes(cq.calledAt, cq.arrivedAt), 5);
  assert.equal(elapsedMinutes(cq.arrivedAt, cq.endedAt), 10);
  assert.equal(elapsedMinutes(at("08:30"), at("09:25")) * 3, 165);
  assert.equal(stopMinutes([]), 0);
});
test("optional stops have independent intervals; overlapping stops count once", () => {
  validateQuality({ ...cq, hasStop: true, stopStartedAt: at("09:38"), stopEndedAt: at("09:46") });
  assert.throws(() => validateQuality({ ...cq, hasStop: true }));
  assert.throws(() => validateQuality({ ...cq, stopStartedAt: at("09:38") }));
  assert.equal(stopMinutes([{ start: at("09:35"), end: at("09:45") }, { start: at("09:40"), end: at("09:50") }]), 15);
  assert.equal(stopMinutes([{ start: at("09:35"), end: null }], at("09:45")), 10);
});
test("CQ chronology, technician identity and permissions are validated", () => {
  assert.throws(() => validateQuality({ ...cq, arrivedAt: at("09:30") }));
  assert.throws(() => validateQuality({ ...cq, technicianId: null }));
  assert.throws(() => validateQuality({ ...cq, arrivedAt: null }));
  assert.throws(() => productionDate("2026-02-30T09:00", true));
  assert.equal(productionDate("2026-07-20T09:00", true)?.toISOString(), "2026-07-20T08:00:00.000Z");
  assert.equal(canManageProduction({ productionCoordinator: false }), false);
  assert.equal(canManageProduction({ productionCoordinator: true }), true);
  assert.equal(canWriteProduction("VIEWER"), false);
  assert.equal(canWriteProduction("SGQ"), true);
});
