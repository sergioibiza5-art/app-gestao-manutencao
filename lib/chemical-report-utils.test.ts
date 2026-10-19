import assert from "node:assert/strict";
import test from "node:test";
import { csvCell, lisbonDate, reportRange } from "./chemical-report-utils";
import { chemicalTypes, parseProductType } from "./product-types";

test("Lisbon dates include late UTC entries on the correct summer calendar day", () => {
  assert.equal(lisbonDate(new Date("2026-07-31T23:30:00Z")), "2026-08-01");
  assert.equal(lisbonDate(new Date("2026-01-31T23:30:00Z")), "2026-01-31");
  assert.equal(lisbonDate(new Date("2026-10-25T23:30:00Z")), "2026-10-25");
});

test("report rejects malformed, impossible and reversed periods", () => {
  for (const [from, to] of [["2026-02-30", "2026-03-01"], ["2026-10-20", "2026-10-19"], ["invalid", "2026-10-19"]]) {
    assert.throws(() => reportRange(from, to));
  }
  assert.deepEqual(reportRange("2024-02-29", "2024-02-29"), { start: "2024-02-29", end: "2024-02-29" });
});

test("CSV preserves separators, quotes and line breaks and neutralizes formulas", () => {
  assert.equal(csvCell('Produto; "A"\nLíquido'), '"Produto; ""A""\nLíquido"');
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell("  +1"), '"\'  +1"');
});

test("classification is explicit and rejects unknown submitted values", () => {
  assert.equal(parseProductType(null), "UNCLASSIFIED");
  assert.equal(parseProductType("CHEMICAL_AEROSOL"), "CHEMICAL_AEROSOL");
  assert.throws(() => parseProductType("LIQUID"));
  assert.throws(() => parseProductType("toString"));
  assert.equal(chemicalTypes.includes("NON_CHEMICAL"), false);
  assert.equal(chemicalTypes.includes("UNCLASSIFIED"), false);
});
