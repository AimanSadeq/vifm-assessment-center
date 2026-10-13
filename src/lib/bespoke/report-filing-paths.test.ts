/**
 * Unit tests for the filed-report naming rules (storage paths, ZIP paths).
 * Run: npx tsx --test src/lib/bespoke/report-filing-paths.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReportStoragePath,
  buildZipEntryPath,
  dedupeZipPath,
  sanitiseZipSegment,
  slugify,
  zipDownloadName,
} from "./report-filing-paths.ts";

const ORG = "3f2a9c10-1111-4222-8333-444455556666";
const BUNDLE = "a1b2c3d4-aaaa-4bbb-8ccc-dddddddddddd";
const CAND = "0e9d8c7b-6a5f-4e3d-9c2b-1a0f9e8d7c6b";

test("slugs are lowercase ascii with single hyphens", () => {
  assert.equal(slugify("Soudah Development Co."), "soudah-development-co");
  assert.equal(slugify("  --Leadership   2026 / Wave #1--  "), "leadership-2026-wave-1");
  assert.equal(slugify("Café Société"), "cafe-societe");
  assert.equal(slugify("شركة سودة"), "");
  assert.equal(slugify(null), "");
});

test("slugs are capped at 60 characters without a trailing hyphen", () => {
  const long = slugify("word ".repeat(40));
  assert.ok(long.length <= 60, long);
  assert.ok(!long.endsWith("-"), long);
  assert.equal(slugify("a".repeat(80)).length, 60);
});

test("storage path is org / bundle / candidate-id8 / kind.pdf", () => {
  assert.equal(
    buildReportStoragePath({
      orgId: ORG, orgName: "Soudah Development", bundleId: BUNDLE, bundleName: "HiPo Wave 1",
      candidateId: CAND, candidateName: "Sarah Al-Fakeeh", kind: "combined",
    }),
    "soudah-development/hipo-wave-1/sarah-al-fakeeh-0e9d8c7b/combined.pdf",
  );
});

test("storage path falls back when names are missing or not ascii", () => {
  assert.equal(
    buildReportStoragePath({
      orgId: null, orgName: null, bundleId: BUNDLE, bundleName: "", candidateId: CAND, candidateName: "", kind: "hipo",
    }),
    "unassigned/bundle-a1b2c3d4/candidate-0e9d8c7b/hipo.pdf",
  );
  assert.equal(
    buildReportStoragePath({
      orgId: ORG, orgName: "شركة سودة", bundleId: BUNDLE, bundleName: "تقييم القادة",
      candidateId: CAND, candidateName: "سارة", kind: "hipo",
    }),
    "org-3f2a9c10/bundle-a1b2c3d4/candidate-0e9d8c7b/hipo.pdf",
  );
});

test("storage path refuses a kind the table would reject", () => {
  assert.throws(() =>
    buildReportStoragePath({
      orgId: null, orgName: null, bundleId: BUNDLE, bundleName: "x", candidateId: CAND, candidateName: "x", kind: "../evil",
    }),
  );
});

test("zip segments strip reserved characters and keep Arabic", () => {
  assert.equal(sanitiseZipSegment('A/B\\C:D*E?F"G<H>I|J', "x"), "A B C D E F G H I J");
  assert.equal(sanitiseZipSegment("سارة الفقيه", "x"), "سارة الفقيه");
  assert.equal(sanitiseZipSegment("  ..hidden.  ", "x"), "hidden");
  assert.equal(sanitiseZipSegment("../..", "Fallback"), "Fallback");
  assert.equal(sanitiseZipSegment("tab\there\nnewline", "x"), "tab here newline");
  assert.equal(sanitiseZipSegment(null, "Fallback"), "Fallback");
  assert.equal(sanitiseZipSegment("x".repeat(150), "f").length, 100);
});

test("zip entry path is Org / Bundle / Candidate - label.pdf", () => {
  assert.equal(
    buildZipEntryPath({ orgName: "Soudah: Development", bundleName: "HiPo / Wave 1", candidateName: "سارة", kind: "hipo" }),
    "Soudah Development/HiPo Wave 1/سارة - High-Potential Profile.pdf",
  );
  assert.equal(
    buildZipEntryPath({ orgName: null, bundleName: null, candidateName: null, kind: "combined" }),
    "Unassigned/Bundle/Candidate - Combined report.pdf",
  );
});

test("duplicate zip paths get a counter", () => {
  const taken = new Set<string>();
  assert.equal(dedupeZipPath("A/B/Sam - Combined report.pdf", taken), "A/B/Sam - Combined report.pdf");
  assert.equal(dedupeZipPath("A/B/Sam - Combined report.pdf", taken), "A/B/Sam - Combined report (2).pdf");
  assert.equal(dedupeZipPath("A/B/Sam - Combined report.pdf", taken), "A/B/Sam - Combined report (3).pdf");
});

test("zip download name is ascii", () => {
  assert.equal(zipDownloadName("Soudah Development", "HiPo Wave 1"), "VIFM_Reports_soudah-development_hipo-wave-1.zip");
  assert.equal(zipDownloadName("Soudah Development", null), "VIFM_Reports_soudah-development.zip");
  assert.equal(zipDownloadName("شركة", null), "VIFM_Reports.zip");
});
