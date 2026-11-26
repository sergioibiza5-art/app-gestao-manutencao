import assert from "node:assert/strict";
import test from "node:test";
import { evidenceLink, reportFilename, workOrderReportScope } from "./work-order-report";

test("audit export is available to read-capable management and quality roles, not kiosk accounts", () => {
  for (const role of ["ADMIN", "MANAGER", "VIEWER", "SGQ", "HSA"]) assert.deepEqual(workOrderReportScope({ id: "one", role }, []), {});
  for (const role of ["TICKET", "unknown"]) assert.equal(workOrderReportScope({ id: "one", role }, []), null);
});

test("USER reports retain assignment and configured equipment restrictions", () => {
  const assignments = [{ schedule: { assignedToId: "one" } }, { ticket: { assignedToId: "one" } }];
  assert.deepEqual(workOrderReportScope({ id: "one", role: "USER" }, []), { OR: assignments });
  assert.deepEqual(workOrderReportScope({ id: "one", role: "USER" }, ["machine"]), { equipmentId: { in: ["machine"] }, OR: assignments });
});

test("PDF evidence permits web links without downloading external resources or executable URLs", () => {
  assert.equal(evidenceLink("https://example.com/file?a=1", "https://app.example.com"), "https://example.com/file?a=1");
  assert.equal(evidenceLink("/documentos?id=1", "https://app.example.com"), "https://app.example.com/documentos?id=1");
  for (const value of ["javascript:alert(1)", "file:///etc/passwd", "data:text/html,test", "//evil.example/path", "not-a-url"]) assert.equal(evidenceLink(value, "https://app.example.com"), null);
});

test("PDF attachment filenames cannot introduce headers or directories", () => {
  assert.equal(reportFilename("OP-00137"), "Relatorio-OP-00137.pdf");
  assert.ok(!reportFilename('OP\r\nHeader: "x"/test').match(/[\r\n"/]/));
});
