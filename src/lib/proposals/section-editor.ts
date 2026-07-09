// Data model for the on-page "edit the proposal wording" section editor. Turns a
// stored proposal into a per-section list the client editor renders: each included
// section, its number, whether editing replaces the body or prepends an intro above
// generated content (pricing tables, glossary, signature grid...), and its current
// wording (existing override, else the boilerplate default extracted to plain text).
// Bilingual: EN + AR pre-fill are both provided.

import type { Proposal } from "./service";
import { resolveIncludedSections } from "./constants";
import { proposalSectionDefaults } from "./proposal-html";
import { proposalSectionDefaultsAr } from "./proposal-html-ar";
import { sanitizeRichHtml } from "./rich-text";

/** Sections whose default body is generated content that must survive a text edit
 *  (pricing tables, glossary, signature grid, clause list, live evidence). Editing
 *  these adds an intro note ABOVE the generated content rather than replacing it. The
 *  keys match the renderers' OVERRIDE_PREPEND set + the secIntro sections. */
// Every section now exposes editable prose; the computed sections (Commercial pricing,
// Psychometric evidence, Implementation timeline, Evidence samples) keep their table
// generated below the editable prose, so nothing is a pure intro-note any more. The only
// remaining prepend is the auto-table-detect below (e.g. the licence-mode Proposed
// solution's committed-scope table), whose follows-note falls back to "the section's table".
export const PREPEND_SECTIONS: Record<string, string> = {};

// Sections that carry a table but are fully editable (the table is extracted to text) -
// they are NOT prepend. Mirrors the renderers' FORCE_REPLACE.
const FORCE_REPLACE = new Set(["Definitions"]);

export type SectionEditItem = {
  title: string;
  number: number;
  /** replace = the box is the whole section body; prepend = the box is an intro above generated content. */
  kind: "replace" | "prepend";
  /** For prepend sections, a short label of what follows (e.g. "the pricing tables"). */
  followsNote: string | null;
  defaultEn: string;
  defaultAr: string;
  overrideEn: string;
  overrideAr: string;
};

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " ",
  reg: "®", copy: "©", trade: "™", deg: "°", middot: "·", times: "×",
  // Per project SOP (no em/en dashes) decode dash entities to a plain hyphen.
  ndash: "-", mdash: "-", hellip: "…", eacute: "é",
};

/** Convert a small HTML section fragment to editable markdown-lite text: blank-line
 *  separated paragraphs, "- " bullets, entities decoded. This round-trips through the
 *  renderers' renderOverride() (which re-escapes and re-builds paragraphs + lists). */
export function htmlToEditText(fragment: string): string {
  if (!fragment) return "";
  let s = fragment;
  // Block boundaries -> newlines. Order matters (open tags before generic strip).
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\s*\/\s*(p|h3|h4|div)\s*>/gi, "\n\n");
  s = s.replace(/<\s*(p|h3|h4|div)\b[^>]*>/gi, "");
  s = s.replace(/<\s*li\b[^>]*>/gi, "- ");
  s = s.replace(/<\s*\/\s*li\s*>/gi, "\n");
  s = s.replace(/<\s*\/?\s*(ul|ol)\b[^>]*>/gi, "\n");
  // Tables (e.g. the editable Definitions glossary) -> one bullet per row, cells joined
  // by " - " (SOP: plain hyphen). The trailing separator is trimmed in the tidy below.
  s = s.replace(/<\s*tr\b[^>]*>/gi, "\n- ");
  s = s.replace(/<\s*\/\s*(td|th)\s*>/gi, " - ");
  // Drop every remaining tag.
  s = s.replace(/<[^>]+>/g, "");
  // Decode the entities we emit.
  s = s.replace(/&(#?[a-z0-9]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
  // Tidy whitespace: trim each line (dropping any trailing table-cell separator),
  // collapse 3+ blank lines to one blank line.
  s = s
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").replace(/\s+-\s*$/, "").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  // Join consecutive bullets that ended up blank-line separated (from source-HTML
  // indentation between <li>s) so they round-trip as ONE list, not many 1-item lists.
  s = s.replace(/^(- .*)\n{2,}(?=- )/gm, "$1\n");
  return s;
}

/** Build the ordered, per-section edit model for a proposal. */
export function buildSectionEditorData(p: Proposal): SectionEditItem[] {
  const included = resolveIncludedSections(p.sectionSelection);
  const defEn = proposalSectionDefaults(p);
  const defAr = proposalSectionDefaultsAr(p);
  const overrides =
    (p.licenceData && typeof p.licenceData === "object"
      ? ((p.licenceData as Record<string, unknown>).sectionOverrides as
          | Record<string, { en?: string; ar?: string }>
          | undefined)
      : undefined) ?? {};

  const hasTable = (h: string | undefined) => /<table/i.test(h ?? "");
  return included.map((title, i) => {
    // Table-bearing sections are prepend too (mirrors the renderers' secBody) so an edit
    // never wipes a generated table; the box is an intro note above it. FORCE_REPLACE
    // sections (the editable Definitions glossary) opt back into replace.
    const isPrepend = !FORCE_REPLACE.has(title) && (title in PREPEND_SECTIONS || hasTable(defEn[title]) || hasTable(defAr[title]));
    return {
      title,
      number: i + 1,
      kind: isPrepend ? "prepend" : "replace",
      followsNote: isPrepend ? (PREPEND_SECTIONS[title] ?? "the section's table") : null,
      // Rich-text pre-fill: the section's default body as sanitised HTML (so the editor
      // shows it formatted). Prepend sections have no editable default (the box is an
      // optional intro above the generated content, which stays regardless).
      defaultEn: isPrepend ? "" : sanitizeRichHtml(defEn[title] ?? ""),
      defaultAr: isPrepend ? "" : sanitizeRichHtml(defAr[title] ?? ""),
      overrideEn: sanitizeRichHtml(overrides[title]?.en),
      overrideAr: sanitizeRichHtml(overrides[title]?.ar),
    };
  });
}
