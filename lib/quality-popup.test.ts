import test from "node:test";
import assert from "node:assert/strict";
import { qualityPopupAcknowledged, qualityPopupStorageKey } from "./quality-popup";

test("Popup acknowledgement tolerates missing, corrupt and invalid storage", () => {
  for (const value of [null, "", "bad json", "{}", "null", "42"]) assert.deepEqual(qualityPopupAcknowledged(value), []);
  assert.deepEqual(qualityPopupAcknowledged(JSON.stringify(["a", "a", "b", null, 4, "", "c".repeat(201)])), ["a", "b"]);
});

test("Popup acknowledgement is bounded and namespaced per signed-in person", () => {
  const ids = Array.from({ length: 600 }, (_, index) => String(index));
  assert.deepEqual(qualityPopupAcknowledged(JSON.stringify(ids)), ids.slice(-500));
  assert.notEqual(qualityPopupStorageKey("alice"), qualityPopupStorageKey("bruno"));
});
