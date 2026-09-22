/**
 * The centre manual as a printable document (BPS 4.39, 4.40).
 *
 * One renderer for every variant: the full manual and each role's cut are the
 * same document with different sections, so they cannot describe different
 * centres. The cover states which variant it is, which version it was cut
 * from, and - when it carries exercise material - who it was issued to, so a
 * loose copy can be traced back.
 */

import { centreRoleName } from "@/lib/ac/centre-roles";
import type { ManualSection, ManualVariant, MaterialsChecklist } from "@/lib/ac/centre-manual";

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const body = (text: string): string => {
  const t = text.trim();
  if (!t) return '<p class="gap">Nothing recorded for this centre.</p>';
  return t
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((l) => l.trim().startsWith("- "))) {
        return `<ul>${lines.map((l) => `<li>${esc(l.trim().slice(2))}</li>`).join("")}</ul>`;
      }
      return `<p>${esc(block).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
};

export function variantLabel(variant: ManualVariant): string {
  return variant === "full" ? "Full centre manual" : `${centreRoleName(variant)} manual`;
}

export function buildCentreManualHtml(input: {
  variant: ManualVariant;
  engagementName: string;
  organisationName: string | null;
  version: number;
  sections: ManualSection[];
  checklist: MaterialsChecklist | null;
  confidential: boolean;
  issuedTo?: string | null;
  generatedAt: string;
}): string {
  const sectionHtml = input.sections
    .map(
      (s) => `
    <section>
      <h2>${esc(s.heading)} <span class="clause">${esc(s.clause)}</span>${
        s.confidential ? ' <span class="conf">confidential</span>' : ""
      }</h2>
      ${body(s.body)}
    </section>`
    )
    .join("");

  const checklistHtml = input.checklist
    ? `
    <section class="page-break">
      <h2>Materials checklist <span class="clause">5.25</span></h2>
      ${input.checklist
        .map(
          (g) => `
        <h3>${esc(g.group)} <span class="clause">${esc(g.clause)}</span></h3>
        <table>
          <tbody>
            ${g.items
              .map(
                (i) => `<tr>
                  <td class="tick">&#9744;</td>
                  <td>${esc(i.label)}${i.detail ? `<span class="muted"> - ${esc(i.detail)}</span>` : ""}</td>
                  <td class="src">${i.fromDesign ? "from the design" : "to confirm"}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>`
        )
        .join("")}
    </section>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>${esc(variantLabel(input.variant))} - ${esc(input.engagementName)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: "Open Sans", Arial, sans-serif; color: #111232; font-size: 10.5pt; line-height: 1.55; }
  h1 { font-size: 20pt; margin: 0 0 2px; color: #010131; }
  h2 { font-size: 12.5pt; margin: 20px 0 6px; color: #010131; border-bottom: 1px solid #d7dce8; padding-bottom: 3px; }
  h3 { font-size: 10.5pt; margin: 14px 0 4px; color: #1a3a6b; }
  p, li { margin: 4px 0; }
  ul { margin: 4px 0 4px 18px; padding: 0; }
  .sub { color: #5b6480; margin: 0 0 3px; }
  .clause { color: #8a91a8; font-size: 8.5pt; font-weight: normal; }
  .conf { background: #fdecec; color: #a01919; font-size: 8pt; padding: 1px 5px; border-radius: 3px; font-weight: 600; }
  .gap { color: #9a6b00; background: #fff8e6; padding: 2px 5px; border-radius: 3px; display: inline-block; }
  .muted { color: #8a91a8; }
  .banner { border: 1.5px solid #a01919; background: #fdecec; color: #7a1414; border-radius: 6px; padding: 9px 11px; margin: 10px 0 4px; }
  .banner strong { display: block; margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  td { border-bottom: 1px solid #eef0f6; padding: 4px 6px; font-size: 9.5pt; vertical-align: top; }
  td.tick { width: 18px; font-size: 13pt; line-height: 1; color: #5b6480; }
  td.src { width: 96px; text-align: right; color: #8a91a8; font-size: 8pt; }
  .page-break { page-break-before: always; }
  footer { margin-top: 24px; border-top: 1px solid #e6e9f2; padding-top: 6px; color: #8a91a8; font-size: 8.5pt; }
</style></head>
<body>
  <h1>${esc(variantLabel(input.variant))}</h1>
  <p class="sub">${esc(input.engagementName)}${input.organisationName ? ` &middot; ${esc(input.organisationName)}` : ""}</p>
  <p class="sub">Version ${esc(input.version)} &middot; generated ${esc(input.generatedAt)}${
    input.issuedTo ? ` &middot; issued to ${esc(input.issuedTo)}` : ""
  }</p>

  ${
    input.confidential
      ? `<div class="banner">
      <strong>This copy contains assessment material.</strong>
      Exercise briefs, role-player prompts and assessor guidance keep their value only while participants have not
      seen them, and these exercises are used again. Do not copy, forward or store this outside the systems VIFM
      provides, and do not leave printed copies in the assessment rooms. Tell the centre administrator when you have
      returned or destroyed your copy.
    </div>`
      : ""
  }

  ${sectionHtml}
  ${checklistHtml}

  <footer>
    ${esc(variantLabel(input.variant))} &middot; version ${esc(input.version)} &middot; VIFM Caliber.
    Generated from the centre design, so it describes the centre as designed. Where a section says nothing is
    recorded, that gap is real and is shown rather than hidden.
  </footer>
</body></html>`;
}
