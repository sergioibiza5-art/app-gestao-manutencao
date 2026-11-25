import assert from "node:assert/strict";
import test from "node:test";
import { chemicalVolume, chemicalVolumeTotal } from "./chemical-volume";

test("packaged liquids use the registered capacity and keep decimal precision", () => {
  assert.deepEqual(chemicalVolume({ unit: "un", packageQuantity: "2", packageUnit: "L" }, "1"), { litresPerUnit: "2", totalLitres: "2", litreNote: "" });
  assert.equal(chemicalVolume({ unit: "bidão", packageQuantity: "5", packageUnit: "litros" }, "9").totalLitres, "45");
  assert.equal(chemicalVolume({ unit: "lata", packageQuantity: "400", packageUnit: "ml" }, "9").totalLitres, "3.6");
  assert.equal(chemicalVolume({ unit: "un", packageQuantity: "0.1", packageUnit: " L " }, "0.00000003").totalLitres, "0.000000003");
});

test("stock already in volume units is not multiplied by a package capacity again", () => {
  assert.equal(chemicalVolume({ unit: "L", packageQuantity: "5", packageUnit: "L" }, "9").totalLitres, "9");
  assert.equal(chemicalVolume({ unit: "ml", packageQuantity: "400", packageUnit: "ml" }, "500").totalLitres, "0.5");
  assert.equal(chemicalVolume({ unit: "cl" }, "75").totalLitres, "0.75");
});

test("mass and missing capacities remain unknown, not zero litres", () => {
  for (const item of [
    { unit: "un", packageQuantity: "2", packageUnit: "kg" },
    { unit: "kg", packageQuantity: "2", packageUnit: "L" },
    { unit: "un" },
    { unit: "un", packageQuantity: "0", packageUnit: "L" },
    { unit: "un", packageQuantity: "2", packageUnit: "embalagem interna" },
  ]) {
    const result = chemicalVolume(item, "9");
    assert.equal(result.totalLitres, null);
    assert.equal(result.litresPerUnit, null);
    assert.ok(result.litreNote);
  }
});

test("total volume sums only known volumes and counts incomplete conversions", () => {
  assert.deepEqual(chemicalVolumeTotal([{ totalLitres: "0.1" }, { totalLitres: "0.2" }, { totalLitres: null }]), { litres: "0.3", missing: 1 });
  assert.deepEqual(chemicalVolumeTotal([]), { litres: "0", missing: 0 });
});
