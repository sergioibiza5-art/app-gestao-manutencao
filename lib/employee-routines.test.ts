import assert from "node:assert/strict";
import { test } from "node:test";
import { routineStatus } from "./employee-routines";

test("Routine states distinguish missing execution, verification and no production", () => {
  assert.equal(routineStatus(null, true).state, "pending");
  assert.equal(routineStatus({ noProduction: true, failed: false, verified: false }, true).state, "no-production");
  assert.equal(routineStatus({ noProduction: false, failed: false, verified: false }, true).state, "verify");
  assert.equal(routineStatus({ noProduction: false, failed: false, verified: true }, true).state, "done");
  assert.equal(routineStatus({ noProduction: false, failed: false, verified: false }, false).state, "done");
  assert.equal(routineStatus({ noProduction: false, failed: true, verified: true }, true).state, "issue");
  assert.equal(routineStatus({ noProduction: false, failed: false, verified: true }, false, true).state, "pending");
});
