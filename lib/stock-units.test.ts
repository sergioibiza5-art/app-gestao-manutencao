import assert from "node:assert/strict";
import test from "node:test";
import { toStockQuantity, consumptionUnit, contentPerPack, stockDescription } from "./stock-units";

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
test("caixa de dez: uma entrada de caixa e saídas por embalagem interna", () => {
  const product = { unit: "caixa", packageQuantity: 10, packageUnit: "embalagem interna" };
  const stock = 4.3 + toStockQuantity(product, 1) - toStockQuantity(product, 2, "CONTENT");
  assert.equal(stockDescription({ ...product, currentStock: stock }), "51 embalagens internas");
  assert.throws(() => toStockQuantity(product, 0.5, "CONTENT"));
});
test("stock contado em internas: entrada de uma caixa e consumo de uma interna", () => {
  const product = { unit: "embalagem interna", stockUnitsPerOuterBox: 10 };
  assert.equal(13 + toStockQuantity(product, 1, "OUTER_BOX") - toStockQuantity(product, 1), 22);
  assert.throws(() => toStockQuantity(product, 0.5));
  assert.throws(() => toStockQuantity(product, 0.5, "OUTER_BOX"));
  const gown = { unit: "caixa", packageQuantity: 20, packageUnit: "embalagem interna" };
  assert.equal(stockDescription({ ...gown, currentStock: 2.4 }), "48 embalagens internas");
  assert.equal(toStockQuantity(gown, 1, "CONTENT"), 0.05);
});
