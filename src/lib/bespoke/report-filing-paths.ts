// Pure naming rules for filed bundle reports (00237). No server imports, so the
// unit tests can load it directly. The I/O lives in report-filing.ts.
//
// Two layouts:
//   - Storage path (bucket 'bundle-reports'): ASCII slugs only, because
//     Storage object keys are URL-shaped and must be stable.
//       {orgSlug}/{bundleSlug}/{candidateSlug}-{candidateIdFirst8}/{kind}.pdf
//   - ZIP entry path (what the admin unpacks): human names, Arabic kept.
//       {Org name}/{Bundle name}/{Candidate name} - {kind label}.pdf

export const REPORT_KIND_LABELS: Record<string, string> = {
  combined: "Combined report",
  hipo: "High-Potential Profile",
};

export type BundleReportKind = "combined" | "hipo";

/** Matches the bundle_report_files.kind CHECK in 00237. */
export const REPORT_KIND_RE = /^[a-z][a-z0-9_]{1,39}$/;

export function reportKindLabel(kind: string): string {
  return REPORT_KIND_LABELS[kind] ?? kind;
}

/**
 * Lowercase ASCII slug: accents folded, every other run of characters becomes
 * one hyphen, at most `max` characters, no leading or trailing hyphen. Returns
 * "" when nothing ASCII survives (e.g. an Arabic-only name); callers supply a
 * fallback.
 */
export function slugify(input: string | null | undefined, max = 60): string {
  const folded = (input ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const slug = folded.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.slice(0, max).replace(/-+$/g, "");
}

/** First 8 hex characters of a uuid, used to keep two same-named people apart. */
function shortId(id: string): string {
  return id.replace(/[^0-9a-fA-F]/g, "").slice(0, 8).toLowerCase();
}

export function buildReportStoragePath(input: {
  orgId: string | null;
  orgName: string | null;
  bundleId: string;
  bundleName: string | null;
  candidateId: string;
  candidateName: string | null;
  kind: string;
}): string {
  if (!REPORT_KIND_RE.test(input.kind)) throw new Error(`Invalid report kind: ${input.kind}`);
  const org = input.orgId ? slugify(input.orgName) || `org-${shortId(input.orgId)}` : "unassigned";
  const bundle = slugify(input.bundleName) || `bundle-${shortId(input.bundleId)}`;
  const person = slugify(input.candidateName) || "candidate";
  return `${org}/${bundle}/${person}-${shortId(input.candidateId)}/${input.kind}.pdf`;
}

/**
 * One path segment inside a ZIP: strips the characters Windows and macOS refuse
 * (/ \ : * ? " < > |) plus control characters, collapses whitespace, drops
 * leading/trailing dots and spaces, and caps the length. Arabic and other
 * letters are kept as they are.
 */
export function sanitiseZipSegment(name: string | null | undefined, fallback: string, max = 100): string {
  const cleaned = (name ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[/\\:*?"<>|\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, "");
  const capped = Array.from(cleaned).slice(0, max).join("").trim();
  return capped || fallback;
}

export function buildZipEntryPath(input: {
  orgName: string | null;
  bundleName: string | null;
  candidateName: string | null;
  kind: string;
}): string {
  const org = sanitiseZipSegment(input.orgName, "Unassigned");
  const bundle = sanitiseZipSegment(input.bundleName, "Bundle");
  const person = sanitiseZipSegment(input.candidateName, "Candidate");
  const label = sanitiseZipSegment(reportKindLabel(input.kind), "Report");
  return `${org}/${bundle}/${person} - ${label}.pdf`;
}

/** "a/b/Name - X.pdf" taken twice becomes "a/b/Name - X (2).pdf", and so on. */
export function dedupeZipPath(path: string, taken: Set<string>): string {
  if (!taken.has(path)) {
    taken.add(path);
    return path;
  }
  const dot = path.lastIndexOf(".");
  const stem = dot > path.lastIndexOf("/") ? path.slice(0, dot) : path;
  const ext = dot > path.lastIndexOf("/") ? path.slice(dot) : "";
  for (let n = 2; ; n++) {
    const next = `${stem} (${n})${ext}`;
    if (!taken.has(next)) {
      taken.add(next);
      return next;
    }
  }
}

/** ASCII download name for a ZIP, e.g. VIFM_Reports_acme-holding_leadership-2026.zip. */
export function zipDownloadName(orgName: string | null, bundleName: string | null): string {
  const parts = [slugify(orgName, 40), slugify(bundleName, 40)].filter(Boolean);
  return `VIFM_Reports${parts.length ? `_${parts.join("_")}` : ""}.zip`;
}
