/**
 * North Africa is a first-class ARC region. Run: npx tsx --test src/lib/constants/ara-regions.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ARA_REGIONS, ARA_REGION_IDS, araRegionLabel, isAraRegion, toAraRegion } from "./ara-regions";
import { deriveRegion } from "@/lib/clients/registry";
import { araRegionSchema } from "@/lib/validations/ara";

test("three regions, in display order, each with both labels", () => {
  assert.deepEqual(ARA_REGION_IDS, ["uae", "saudi", "north_africa"]);
  for (const r of ARA_REGIONS) {
    assert.ok(r.name_en && r.name_ar && r.short_en && r.short_ar, r.id);
  }
  assert.equal(araRegionLabel("north_africa", "en"), "North Africa");
  assert.equal(araRegionLabel("north_africa", "ar"), "شمال أفريقيا");
  assert.equal(araRegionLabel("saudi", "en", "short"), "Saudi");
  assert.equal(araRegionLabel("uae", "ar"), "الإمارات العربية المتحدة");
});

test("parsing accepts the new region and falls back safely", () => {
  assert.equal(isAraRegion("north_africa"), true);
  assert.equal(isAraRegion("gcc"), false);
  assert.equal(toAraRegion("north_africa"), "north_africa");
  assert.equal(toAraRegion("nowhere", "saudi"), "saudi");
  assert.equal(toAraRegion(null), "uae");
  assert.equal(araRegionSchema.parse("north_africa"), "north_africa");
  assert.throws(() => araRegionSchema.parse("both"));
});

test("country text maps North African countries to the region", () => {
  for (const c of ["Egypt", "Cairo, Egypt", "Morocco", "Maroc", "Tunisia", "Algeria", "Libya", "Sudan", "Mauritania"]) {
    assert.equal(deriveRegion(c), "north_africa", c);
  }
  assert.equal(deriveRegion("Riyadh, KSA"), "saudi");
  assert.equal(deriveRegion("Dubai"), "uae");
  assert.equal(deriveRegion(""), "uae");
});
