// Renders the "what's inside each bespoke bundle" detail block for a proposal:
// for every licence bundle, list its included assessments and, per assessment,
// what it measures + the reports/deliverables it produces. Auto-derived from the
// bundle's service keys via the proposal catalogue, so the proposal maker never
// re-types assessment detail. Bilingual (EN + AR). Pure string builder - safe on
// server (PDF) and shared by both language renderers.

import {
  proposalService,
  PROPOSAL_BLURB,
  PROPOSAL_BLURB_AR,
  PROPOSAL_DELIVERABLES,
  PROPOSAL_DELIVERABLES_AR,
  PROPOSAL_SERVICE_CATEGORY,
  PROPOSAL_SERVICE_LABEL_AR,
} from "@/lib/proposals/constants";
import type { NormalizedBundle } from "@/lib/proposals/licensing";
import type { ProposalServiceKey } from "@/lib/proposals/licensing";

type Lang = "en" | "ar";

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const T = {
  en: {
    heading: "What each bespoke bundle includes",
    intro:
      "Each bespoke bundle is one licence covering every assessment listed below - one seat lets a participant complete all of the bundle's assessments in a single sitting. The assessments, and the reports each produces, are detailed here.",
    licenses: (n: number) => `${n} licence${n === 1 ? "" : "s"}`,
    assessments: "Assessments included",
    reports: "Reports produced",
  },
  ar: {
    heading: "ما تتضمّنه كل حزمة مُخصّصة",
    intro:
      "كل حزمة مُخصّصة هي رخصة واحدة تغطي جميع التقييمات المدرجة أدناه - يتيح المقعد الواحد للمشارك إكمال جميع تقييمات الحزمة في جلسة واحدة. وفيما يلي تفصيل التقييمات والتقارير التي يُنتجها كل منها.",
    licenses: (n: number) => `${n} رخصة`,
    assessments: "التقييمات المُدرجة",
    reports: "التقارير المُنتَجة",
  },
} as const;

/** True when at least one bundle carries resolvable service keys worth detailing. */
export function hasBundleContents(bundles: NormalizedBundle[] | undefined): boolean {
  return !!bundles?.some((b) => (b.keys ?? []).some((k) => !!proposalService(k)));
}

/** The detail block HTML for the proposal's bundle contents (empty when none). */
export function bundleContentsHtml(bundles: NormalizedBundle[] | undefined, lang: Lang): string {
  const withKeys = (bundles ?? []).filter((b) => (b.keys ?? []).some((k) => !!proposalService(k)));
  if (withKeys.length === 0) return "";
  const t = T[lang];
  const labelOf = (key: ProposalServiceKey) =>
    lang === "ar" ? PROPOSAL_SERVICE_LABEL_AR[key] ?? proposalService(key)?.label ?? key : proposalService(key)?.label ?? key;
  const blurbOf = (key: ProposalServiceKey) => (lang === "ar" ? PROPOSAL_BLURB_AR[key] : PROPOSAL_BLURB[key]) ?? "";
  const catOf = (key: ProposalServiceKey) => PROPOSAL_SERVICE_CATEGORY[key] ?? "";
  const reportsOf = (key: ProposalServiceKey) =>
    (lang === "ar" ? PROPOSAL_DELIVERABLES_AR[key] : PROPOSAL_DELIVERABLES[key]) ?? [];

  const blocks = withKeys
    .map((b) => {
      const keys = (b.keys ?? []).filter((k): k is ProposalServiceKey => !!proposalService(k)) as ProposalServiceKey[];
      const seatLine = b.licenses > 0 ? ` <span class="bundle-seats">(${escHtml(t.licenses(b.licenses))})</span>` : "";
      const assessments = keys
        .map(
          (k) => `
        <div class="bundle-assessment">
          <div class="bundle-assessment-name">${escHtml(labelOf(k))}${
            catOf(k) ? ` <span class="bundle-assessment-cat">${escHtml(catOf(k))}</span>` : ""
          }</div>
          <p class="bundle-assessment-blurb">${escHtml(blurbOf(k))}</p>
          <div class="bundle-reports-label">${escHtml(t.reports)}</div>
          <ul class="bundle-reports">${reportsOf(k)
            .map((r) => `<li>${escHtml(r)}</li>`)
            .join("")}</ul>
        </div>`,
        )
        .join("");
      return `
    <div class="bundle-card">
      <h4 class="bundle-card-title">${escHtml(b.name)}${seatLine}</h4>
      <div class="bundle-card-sub">${escHtml(t.assessments)}</div>
      ${assessments}
    </div>`;
    })
    .join("");

  return `
  <div class="bundle-contents">
    <h3>${escHtml(t.heading)}</h3>
    <p class="scope-note">${escHtml(t.intro)}</p>
    ${blocks}
  </div>`;
}

/** Inline CSS for the bundle-contents block - appended once per render. */
export const BUNDLE_CONTENTS_CSS = `
  .bundle-contents { margin-top: 14px; }
  .bundle-card { border: 1px solid #dbe3ec; border-radius: 8px; padding: 12px 14px; margin: 10px 0; page-break-inside: avoid; }
  .bundle-card-title { margin: 0 0 2px; font-size: 13px; color: #010131; }
  .bundle-seats { font-size: 11px; font-weight: 600; color: #5391D5; }
  .bundle-card-sub { font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; margin-bottom: 6px; }
  .bundle-assessment { padding: 8px 0; border-top: 1px solid #eef2f7; }
  .bundle-assessment:first-of-type { border-top: 0; }
  .bundle-assessment-name { font-size: 11.5px; font-weight: 700; color: #121232; }
  .bundle-assessment-cat { font-size: 9.5px; font-weight: 500; color: #64748b; }
  .bundle-assessment-blurb { font-size: 10px; line-height: 1.5; color: #334155; margin: 3px 0 6px; }
  .bundle-reports-label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 2px; }
  .bundle-reports { margin: 0; padding-inline-start: 16px; }
  .bundle-reports li { font-size: 10px; line-height: 1.5; color: #334155; }
`;
