/**
 * File names for the ARC cohort downloads. Pure helpers, no server imports,
 * so the report builder and its tests can use them without a browser or a
 * database.
 */

/** File-name safe version of a company or person name. */
export function safeFileSegment(name: string | null | undefined, fallback = "cohort"): string {
  const s = (name ?? "").normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  return s || fallback;
}

export function cohortZipFilename(companyLabel: string, lang: "en" | "ar"): string {
  return `VIFM_AI_Readiness_Reports_${safeFileSegment(companyLabel)}_${lang}.zip`;
}

export function cohortReportFilename(companyLabel: string): string {
  return `VIFM_AI_Readiness_Cohort_Report_${safeFileSegment(companyLabel)}.pdf`;
}
