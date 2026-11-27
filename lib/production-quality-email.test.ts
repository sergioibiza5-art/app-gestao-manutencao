import test from "node:test";
import assert from "node:assert/strict";
import { qualityCallEmail } from "./production-quality-email";

test("CQ message identifies the call and escapes all operator-supplied content", () => {
  const message = qualityCallEmail({ id: "call1", batchId: "batch1", calledAt: new Date("2026-11-27T10:30:00Z"), hasStop: true, notes: '<script>alert("x")</script>\nAguardar', batch: { reference: "R&1", lot: "L1", line: "SL1", equipment: { code: "MCC_1", name: "Campos" } } });
  assert.ok(message.subject.includes("L1"));
  assert.ok(message.html.includes("27/11/26, 10:30:00"));
  assert.ok(message.html.includes("R&amp;1"));
  assert.ok(message.html.includes("#cq-call1"));
  assert.ok(message.html.includes("lote=batch1"));
  assert.ok(message.html.includes("<strong>Sim</strong>"));
  assert.equal(message.html.includes("<script>"), false);
  assert.ok(message.html.includes("&lt;script&gt;"));
});
