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

/** Sections whose default body is generated content that must survive a text edit
 *  (pricing tables, glossary, signature grid, clause list, live evidence). Editing
 *  these adds an intro note ABOVE the generated content rather than replacing it. The
 *  keys match the renderers' OVERRIDE_PREPEND set + the secIntro sections. */
export const PREPEND_SECTIONS: Record<string, string> = {
  "Commercial proposal": "the pricing tables",
  "Psychometric foundations": "the psychometric methodology detail",
  "Definitions": "the glossary table",
  "Terms & conditions": "the numbered clauses",
  "Acceptance & next steps": "the acceptance & signature block",
  "Evidence & sample reports": "the evidence list",
};

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
  s = s.replace(/<\s*\/\s*(p|h3|h4|div|tr)\s*>/gi, "\n\n");
  s = s.replace(/<\s*(p|h3|h4|div)\b[^>]*>/gi, "");
  s = s.replace(/<\s*li\b[^>]*>/gi, "- ");
  s = s.replace(/<\s*\/\s*li\s*>/gi, "\n");
  s = s.replace(/<\s*\/?\s*(ul|ol)\b[^>]*>/gi, "\n");
  // Table cells: separate them (defensive - table sections are prepend, so this rarely runs).
  s = s.replace(/<\s*\/\s*(td|th)\s*>/gi, " ");
  // Drop every remaining tag.
  s = s.replace(/<[^>]+>/g, "");
  // Decode the entities we emit.
  s = s.replace(/&(#?[a-z0-9]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
  // Tidy whitespace: trim each line, collapse 3+ blank lines to one blank line.
  s = s
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
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
    // never wipes a generated table; the box is an intro note above it.
    const isPrepend = title in PREPEND_SECTIONS || hasTable(defEn[title]) || hasTable(defAr[title]);
    return {
      title,
      number: i + 1,
      kind: isPrepend ? "prepend" : "replace",
      followsNote: isPrepend ? (PREPEND_SECTIONS[title] ?? "the section's table") : null,
      // Prepend sections have no editable default text (the box is an intro note); the
      // generated content stays regardless.
      defaultEn: isPrepend ? "" : htmlToEditText(defEn[title] ?? ""),
      defaultAr: isPrepend ? "" : htmlToEditText(defAr[title] ?? ""),
      overrideEn: (overrides[title]?.en ?? "").trim(),
      overrideAr: (overrides[title]?.ar ?? "").trim(),
    };
  });
}
