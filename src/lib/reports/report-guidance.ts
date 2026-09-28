/**
 * "Using these results": the note for the client's decision makers that goes
 * with every centre's reports (BPS 8.4; also 7.5, 8.2, 8.9, 8.12).
 *
 * 8.4 asks clients to seek guidance on how results can be used and
 * interpreted, and 8.4.1 warns that a centre designed for development is
 * usually the wrong basis for selection, promotion or redundancy decisions.
 * Each individual report already explains itself ("Using this report"); this
 * note speaks to the person deciding across a cohort, and it is generated
 * from the same engagement data as the centre agreement, so the two can never
 * say different things about the same centre.
 *
 * guidanceSections is pure (unit-tested); buildReportGuidanceHtml renders it.
 */

import type { AgreementPrefill } from "./centre-agreement-prefill";
import { BARS_SCALE } from "@/lib/competencies/framework-definitions";
import { SUCCESSION_META } from "@/lib/scoring/talent-map";

export type GuidanceBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "warn"; text: string };

export type GuidanceSection = { heading: string; blocks: GuidanceBlock[] };

export function guidanceSections(p: AgreementPrefill): GuidanceSection[] {
  const role = p.targetRole ?? "the target role";
  const sections: GuidanceSection[] = [];

  // 1. Purpose, and the uses it rules out (8.4.1).
  const purposeBlocks: GuidanceBlock[] = [];
  if (p.purpose === "selection") {
    purposeBlocks.push({ kind: "p", text: `This was a selection centre. Its results are designed to inform a choice between candidates for ${role}.` });
  } else if (p.purpose === "development") {
    purposeBlocks.push({ kind: "p", text: "This was a development centre. Its results are designed to show each participant's strengths and development needs, and to shape their development plan." });
    purposeBlocks.push({ kind: "warn", text: "Do not use these results for selection, promotion or redundancy decisions. The centre was not designed for that, and participants took part on the understanding that it was for their development." });
  } else if (p.purpose === "succession") {
    purposeBlocks.push({ kind: "p", text: `This was a succession centre. Its results are designed to show how ready each participant is for ${role} or roles like it, and what would close the gap.` });
  } else {
    purposeBlocks.push({ kind: "warn", text: "The purpose of this centre has not been recorded. Agree with VIFM what the results may be used for before relying on them." });
  }
  purposeBlocks.push({ kind: "p", text: "Using the results for any other purpose, or for a different role, needs agreement with VIFM first and, because the data is personal, may need the participants' consent." });
  sections.push({ heading: "What these results are for", blocks: purposeBlocks });

  // 2. How to read a report.
  const readBlocks: GuidanceBlock[] = [
    { kind: "p", text: "Each competency is rated on one five-point scale. \"No Evidence\" means the competency was not observed well enough to rate; it is not a low score." },
    { kind: "table", head: ["Rating", "Meaning"], rows: BARS_SCALE.map((l) => [String(l.level), l.labelEn]) },
    { kind: "p", text: "Every competency was observed in at least two exercises. VIFM's standard is for every participant to be rated by at least two assessors, and any exception is recorded on the centre's file. The ratings in a report were agreed by the assessors together, on the recorded evidence, after all the exercises." },
  ];
  if (p.ratingRule === "calculated") {
    readBlocks.push({ kind: "p", text: "The overall rating was calculated, not agreed in the room: it is the weighted average of the competency ratings, using weights fixed before the centre, rounded to the nearest whole point. Where the panel disagreed with the calculated rating, the report says so and gives the panel's reasons." });
    if (p.weights.length) {
      readBlocks.push({ kind: "table", head: ["Competency", "Weight"], rows: p.weights.map((w) => [w.competency, w.weight]) });
    }
  } else if (p.ratingRule === "discussed") {
    readBlocks.push({ kind: "p", text: "The overall rating was agreed by the assessors in discussion of the evidence, rather than calculated from the competency ratings." });
  }
  readBlocks.push({ kind: "p", text: "Each report also carries a readiness recommendation:" });
  readBlocks.push({
    kind: "table",
    head: ["Recommendation", "What it means"],
    rows: (["ready_now", "ready_with_development", "not_ready"] as const).map((k) => [SUCCESSION_META[k].label, SUCCESSION_META[k].blurb]),
  });
  sections.push({ heading: "How to read a report", blocks: readBlocks });

  // 3. What the results can and cannot tell you (8.9, 8.12).
  const limits: string[] = [
    "The results describe how each person behaved in simulated work tasks on the day. That is strong evidence, but it is a sample, not a full picture of how they perform in the job.",
    "Every rating carries some measurement error. A difference of one point between two people is too small to decide on by itself; look at the pattern across the competencies instead.",
    `The results apply to ${role} and to this design. Do not compare them with results from a centre that assessed different competencies or used different exercises.`,
    `People develop, so results age. They are kept for ${p.retentionMonths} months and then deleted; treat older results with more caution than recent ones.`,
  ];
  const limitBlocks: GuidanceBlock[] = [{ kind: "list", items: limits }];
  if (p.contentStatus) limitBlocks.push({ kind: "p", text: `Status of the content used: ${p.contentStatus}` });
  sections.push({ heading: "What the results can and cannot tell you", blocks: limitBlocks });

  // 4. Making the decision (8.2, 7.5).
  const decide: string[] = [
    "Decisions are yours. The reports are evidence to inform a decision; VIFM does not make the decision.",
    "Weigh the results alongside the other evidence you hold, such as interviews, references and performance records.",
    "Make sure the people deciding are supported by someone trained to interpret assessment centre results, as agreed for this centre.",
    "Before a decision that goes against someone, check that the evidence in their report supports it. Each report sets out, competency by competency, what was observed.",
  ];
  if (p.fairnessApplies) {
    decide.push("VIFM checks outcomes for this centre for unfair effects on any group of participants. If a concern is flagged, review it with VIFM before deciding.");
  }
  sections.push({ heading: "Making the decision", blocks: [{ kind: "list", items: decide }] });

  // 5. Handling the reports.
  const handling: string[] = [
    p.recipients
      ? `Reports from this centre go only to: ${p.recipients}. Anyone else needs the participant's express permission, which VIFM asks for on your behalf.`
      : "Reports go only to the recipients agreed for this centre. Anyone else needs the participant's express permission, which VIFM asks for on your behalf.",
    "Keep reports secure and do not copy them into other systems without agreement.",
    `Participants may appeal against their result within ${p.appealWindowDays} days of receiving it. If a decision depends on a result under appeal, wait for the outcome.`,
    "Tell participants the decision, and tell VIFM when you have done so, so the record is complete.",
  ];
  sections.push({ heading: "Handling the reports", blocks: [{ kind: "list", items: handling }] });

  sections.push({
    heading: "Questions",
    blocks: [{ kind: "p", text: "If you want to use the results in a way this note does not cover, or you are unsure how to read something in a report, ask VIFM before acting on it." }],
  });

  return sections;
}

const esc = (v: unknown): string =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PURPOSE_WORD: Record<string, string> = { selection: "Selection", development: "Development", succession: "Succession" };

export function buildReportGuidanceHtml(p: AgreementPrefill, generatedAt: string): string {
  const block = (b: GuidanceBlock): string => {
    switch (b.kind) {
      case "p": return `<p>${esc(b.text)}</p>`;
      case "warn": return `<p class="warn">${esc(b.text)}</p>`;
      case "list": return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
      case "table":
        return `<table><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${
          b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")
        }</tbody></table>`;
    }
  };
  // A lead-in sentence stays on the same page as the table it introduces.
  const renderBlocks = (blocks: GuidanceBlock[]): string => {
    const out: string[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const next = blocks[i + 1];
      if (b.kind === "p" && next?.kind === "table") {
        out.push(`<div class="keep">${block(b)}${block(next)}</div>`);
        i++;
      } else {
        out.push(block(b));
      }
    }
    return out.join("");
  };
  const meta = [
    p.clientName,
    p.purpose ? `${PURPOSE_WORD[p.purpose]} centre` : null,
    p.targetRole,
    p.centreDates,
  ].filter(Boolean).map(esc).join(" &middot; ");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap"/>
<title>Using these results - ${esc(p.centreName)}</title>
<style>
  @page { size: A4; margin: 15mm 16mm; }
  body { font-family: "Open Sans", Arial, sans-serif; color: #111232; font-size: 10pt; line-height: 1.45; }
  .eyebrow { color: #5391D5; font-size: 8.5pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin: 0; }
  h1 { font-size: 19pt; color: #010131; margin: 4px 0 2px; }
  .sub { color: #5b6480; margin: 0 0 14px; }
  h2 { font-size: 11.5pt; color: #010131; margin: 14px 0 5px; border-bottom: 1px solid #d7dce8; padding-bottom: 3px; break-after: avoid; }
  p { margin: 0 0 8px; }
  ul { margin: 0 0 8px; padding-left: 18px; }
  li { margin: 0 0 5px; }
  .warn { background: #fff4e5; border-left: 3px solid #d97706; padding: 7px 10px; color: #7a3e00; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0 10px; break-inside: avoid; }
  th, td { border-bottom: 1px solid #e6e9f2; padding: 3px 7px; text-align: left; vertical-align: top; font-size: 9.5pt; }
  th { color: #5b6480; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .04em; }
  .keep { break-inside: avoid; }
  footer { margin-top: 14px; break-inside: avoid; border-top: 1px solid #e6e9f2; padding-top: 6px; color: #8a91a8; font-size: 8.5pt; }
</style></head>
<body>
  <p class="eyebrow">Guidance for decision makers</p>
  <h1>Using these results</h1>
  <p class="sub">${esc(p.centreName)}${meta ? `<br/>${meta}` : ""}</p>
  ${guidanceSections(p).map((s) => `<h2>${esc(s.heading)}</h2>${renderBlocks(s.blocks)}`).join("\n")}
  <footer>Virginia Institute of Finance and Management &middot; Generated ${esc(generatedAt)} from the centre as designed in Caliber. This note accompanies the individual reports from this centre and does not replace them.</footer>
</body></html>`;
}
