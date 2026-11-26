import test from "node:test";
import assert from "node:assert/strict";
import { batchButtonStatus, canWriteProduction, canManageProduction, elapsedMinutes, stopMinutes, validateQuality, productionDate } from "./production";
const at = (time: string) => new Date(`2026-11-25T${time}:00Z`);
const cq = { calledAt: at("09:35"), arrivedAt: at("09:40"), endedAt: at("09:50"), technicianId: "quality", hasStop: false, stopStartedAt: null, stopEndedAt: null };
test("batch buttons only permit starting planned lots and finishing open lots", () => {
  assert.equal(batchButtonStatus("PLANNED", "batch-start"), "OPEN");
  assert.equal(batchButtonStatus("OPEN", "batch-end"), "DONE");
  for (const state of ["OPEN", "DONE", "VERIFIED"]) assert.throws(() => batchButtonStatus(state, "batch-start"));
  for (const state of ["PLANNED", "DONE", "VERIFIED"]) assert.throws(() => batchButtonStatus(state, "batch-end"));
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
