import assert from "node:assert/strict";
import test from "node:test";
import { toStockQuantity, consumptionUnit, contentPerPack } from "./stock-units";

test("3 cans of 400 ml, consuming 100 then 50 ml", () => {
  const item = { unit: "lata", packageQuantity: 400, packageUnit: "ml" };
  const first = toStockQuantity(item, 100, "ml");
  const second = toStockQuantity(item, 50, "ml");
  assert.equal(3 - first - second, 2.625);
  assert.equal((3 - first - second) * contentPerPack(item), 1050);
  assert.equal(first * 12, 3);
  assert.equal(second * 12, 1.5);
});
test("small consumption from a 20 litre drum is retained", () => {
  const item = { unit: "bidão", packageQuantity: 20, packageUnit: "L" };
  assert.equal(consumptionUnit(item), "ml");
  assert.equal(toStockQuantity(item, 50, "ml"), 0.0025);
  assert.equal(toStockQuantity(item, 2), 2);
});
test("mass conversion and rejection of incompatible quantities", () => {
  const item = { unit: "lata", packageQuantity: 1, packageUnit: "kg" };
  assert.equal(toStockQuantity(item, 50, "g"), 0.05);
  assert.throws(() => toStockQuantity(item, 50, "ml"));
  assert.throws(() => toStockQuantity(item, -1));
  assert.throws(() => toStockQuantity(item, NaN));
  assert.throws(() => toStockQuantity({ unit: "un" }, 50, "ml"));
});
