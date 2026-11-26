import assert from "node:assert/strict";
import test from "node:test";
import { chemicalVolume, chemicalVolumeTotal, chemicalMass, chemicalMassTotal, chemicalMeasurement } from "./chemical-volume";

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

test("weight is normalized to kg using the package content or direct stock unit", () => {
  assert.deepEqual(chemicalMass({ unit: "un", packageQuantity: "450", packageUnit: "g" }, "3"), { kilogramsPerUnit: "0.45", totalKilograms: "1.35" });
  assert.equal(chemicalMass({ unit: "balde", packageQuantity: "5", packageUnit: "kg" }, "3").totalKilograms, "15");
  assert.equal(chemicalMass({ unit: "kg", packageQuantity: "5", packageUnit: "kg" }, "3").totalKilograms, "3");
  assert.equal(chemicalMass({ unit: "g" }, "900").totalKilograms, "0.9");
  assert.equal(chemicalMass({ unit: "mg" }, "50").totalKilograms, "0.00005");
  assert.equal(chemicalMass({ unit: "un", packageQuantity: "0.1", packageUnit: "g" }, "0.00000003").totalKilograms, "0.000000000003");
});

test("a product is measured as either weight or volume, never converted between dimensions", () => {
  for (const [product, expected] of [
    [{ unit: "un", packageQuantity: "2", packageUnit: "kg" }, "6"],
    [{ unit: "kg", packageQuantity: "2", packageUnit: "L" }, "3"],
  ] as const) {
    const value = chemicalMeasurement(product, "3");
    assert.equal(value.totalKilograms, expected);
    assert.equal(value.totalLitres, null);
  }
  const volume = chemicalMeasurement({ unit: "L", packageQuantity: "5", packageUnit: "kg" }, "3");
  assert.equal(volume.totalLitres, "3");
  assert.equal(volume.totalKilograms, null);
  assert.equal(chemicalMassTotal([{ totalKilograms: "0.1" }, { totalKilograms: "0.2" }, { totalKilograms: null }]), "0.3");
});
