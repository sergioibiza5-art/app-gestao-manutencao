import test from "node:test";
import assert from "node:assert/strict";
import { qualityReminderAt, qualityReminderDue } from "./quality-reminder";
import { qualityCallEmail } from "./production-quality-email";

const calledAt = new Date("2026-11-27T10:00:00Z");
const call = { calledAt, arrivedAt: null, endedAt: null, batch: { status: "OPEN" } };

test("Reminder is due exactly 20 minutes after original call, never before", () => {
  assert.equal(qualityReminderAt(calledAt).toISOString(), "2026-11-27T10:20:00.000Z");
  assert.equal(qualityReminderDue(call, new Date("2026-11-27T10:19:59.999Z")), false);
  assert.equal(qualityReminderDue(call, new Date("2026-11-27T10:20:00Z")), true);
  assert.equal(qualityReminderDue(call, new Date("2026-11-27T11:00:00Z")), true);
});

test("Starting CQ cancels reminder even if CQ has not ended; closed batches also cancel", () => {
  const now = new Date("2026-11-27T10:30:00Z");
  assert.equal(qualityReminderDue({ ...call, arrivedAt: now }, now), false);
  assert.equal(qualityReminderDue({ ...call, endedAt: now }, now), false);
  for (const status of ["DONE", "VERIFIED", "PLANNED"]) assert.equal(qualityReminderDue({ ...call, batch: { status } }, now), false);
});

test("Reminder refers to the original unanswered call, its time and link", () => {
  const message = qualityCallEmail({ id: "call", batchId: "batch", calledAt, hasStop: false, notes: "", batch: { reference: "R1", lot: "L1", line: "SL1", equipment: { name: "Campos", code: "MCC_1" } } }, true);
  assert.match(message.subject, /^Lembrete/);
  assert.ok(message.html.includes("20 minutos"));
  assert.ok(message.html.includes("ainda não foi iniciado"));
  assert.ok(message.html.includes("10:00:00"));
  assert.ok(message.html.includes("#cq-call"));
});
