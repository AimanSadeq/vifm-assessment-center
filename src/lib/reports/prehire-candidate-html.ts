import type { PrehireRecommendation } from "@/lib/prehire/scoring";
import type { PrehireCertification } from "@/lib/prehire/certification";

/**
 * Per-candidate Pre-Hire screening report (HTML → Puppeteer PDF). VIFM is the
 * assessor, not the client, so this is the deliverable VIFM downloads or emails
 * to the client per candidate. It surfaces the advisory composite + per-stage
 * scores, a "How this score is calculated" methodology section (the composite
 * formula + the four advisory bands and their triggers - since the signal is
 * derived automatically, the client is told exactly how), and an explicit
 * "screening signal, not a hiring decision" line (the module's core guardrail).
 * Bilingual EN/AR.
 */

export type PrehireReportStage = {
  label: string;
  normalized: number | null;
  cutScore: number | null;
  passed: boolean | null;
  weightPct: number;
  required: boolean;
  /** Optional sub-line under the stage label (e.g. which sub-skills ran). */
  note?: string | null;
  /** One-line definition of what this stage measures. */
  definition?: string | null;
};

/** AI interview (CBI) transcript + the AI's assessment, for client review. */
export type PrehireCbiBlock = {
  bars: number | null;
  ratingLabel: string | null;
  rationale: string | null;
  strengths: string[];
  developmentAreas: string[];
  aiGenerated: boolean;
  exchanges: { who: "interviewer" | "candidate"; text: string }[];
};

export type PrehireReportData = {
  candidateName: string;
  candidateEmail: string;
  employeeId: string | null;
  requisitionTitle: string;
  level: string | null;
  orgName: string | null;
  composite: number | null;
  recommendation: PrehireRecommendation;
  stages: PrehireReportStage[];
  cbi?: PrehireCbiBlock | null;
  certification?: PrehireCertification | null;
  generatedAt: Date;
  /** Option 2 gate: true while the quiz bank still mints live-AI (pending SME review). */
  provisional?: boolean;
};

/** Bilingual provisional strip for the two Pre-Hire report bodies. */
function provisionalStrip(data: PrehireReportData, lang: Lang): string {
  if (!data.provisional) return "";
  const ar = lang === "ar";
  const title = ar ? "نتائج مبدئية - المحتوى قيد مراجعة خبير الموضوع" : "Provisional results - content pending SME review";
  const body = ar
    ? "بعض بنود هذا الفحص وُلِّدت آلياً ولم تُراجع بعد وتُعتمد من قبل خبير في الموضوع. يُرجى اعتبار هذه النتائج استرشادية حتى اكتمال المراجعة."
    : "Some items in this screen were generated live and have not yet been reviewed and approved by a subject-matter expert. Treat these results as indicative until the content review is complete.";
  return `<div dir="${ar ? "rtl" : "ltr"}" style="border:1px solid #f59e0b;background:#fffbeb;color:#78350f;border-radius:6px;padding:8px 12px;margin:0 0 14px;font-size:11px;line-height:1.5"><b>${title}</b><div style="margin-top:2px">${body}</div></div>`;
}

type Lang = "en" | "ar";

const L: Record<Lang, Record<string, string>> = {
  en: {
    brand: "Virginia Institute of Finance and Management",
    title: "Pre-Hire® Screening Report",
    summaryTitle: "Pre-Hire® Screening Summary",
    candidate: "Candidate",
    employeeId: "Employee ID",
    role: "Role",
    organization: "Organization",
    generated: "Generated",
    advisory: "Advisory signal",
    composite: "Composite",
    compositeDef:
      "A weighted average (0-100) of the stage scores below, each counting in proportion to its Weight. It is a screening signal, not a hiring decision.",
    perStage: "By stage",
    stagesDefTitle: "What each stage measures",
    thStage: "Stage",
    thWeight: "Weight",
    thScore: "Score",
    thCut: "Cut",
    thOutcome: "Outcome",
    required: "Required",
    pass: "Pass",
    below: "Below cut",
    notTaken: "Not taken",
    partialPlacement: "Partial placement",
    skillsAssessed: "Skills assessed",
    disclaimer:
      "This is an advisory screening SIGNAL, not a hiring decision and not a development diagnostic. A qualified VIFM reviewer interprets it alongside other evidence; no decision is ever made automatically.",
    confidential: "Confidential - for VIFM and the engaged client only.",
    certifiedTitle: "Certified - SME-reviewed",
    certifiedBy: "Reviewed & certified by",
    reviewerNotesLabel: "Reviewer notes",
    reco_advance: "Advance",
    reco_review: "Review",
    reco_hold: "Hold for review",
    reco_incomplete: "In progress",
    howTitle: "How this score is calculated",
    howComposite:
      "The Composite is a weighted average (0-100) of the stage scores above; each stage counts in proportion to its Weight, and it is shown only once the candidate has completed every weighted stage. The Advisory signal is then derived automatically from the Composite; it is a screening signal, not a hiring decision:",
    thBand: "Signal",
    thWhen: "When",
    thMeaning: "What it means",
    when_advance: "Composite 70+ and every required stage at or above its cut-score",
    when_review: "Composite 50-69, or a required stage below its cut-score (which caps the signal here)",
    when_hold: "Composite below 50",
    when_incomplete: "The candidate hasn't completed every stage yet",
    mean_advance: "Strong screening signal",
    mean_review: "Middling - worth a closer look",
    mean_hold: "Low signal - a person should review",
    mean_incomplete: "No composite is available yet",
    cbiTitle: "AI Interview - transcript & assessment",
    cbiIntro:
      "This behavioural interview was conducted and scored by AI. The full exchange and the AI's assessment are below for your review - the rating is an advisory signal, not a decision.",
    cbiAiRating: "AI rating",
    cbiRationale: "AI rationale",
    cbiStrengths: "Strengths noted",
    cbiDev: "Development areas",
    cbiTranscript: "Interview transcript",
    cbiInterviewer: "Interviewer (AI)",
    cbiCandidate: "Candidate",
    cbiAiNote: "AI-generated from the transcript above; a human reviewer should validate it.",
  },
  ar: {
    brand: "معهد فرجينيا للتمويل والإدارة",
    title: "تقرير فرز ما قبل التوظيف",
    summaryTitle: "ملخّص فرز ما قبل التوظيف",
    candidate: "المرشّح",
    employeeId: "الرقم الوظيفي",
    role: "الوظيفة",
    organization: "المؤسسة",
    generated: "تاريخ الإصدار",
    advisory: "إشارة استرشادية",
    composite: "الدرجة الكلية",
    compositeDef:
      "متوسط مرجّح (0-100) لدرجات المراحل أدناه، تُسهم كل مرحلة بحسب وزنها. وهي إشارة فرز وليست قرار توظيف.",
    perStage: "حسب المرحلة",
    stagesDefTitle: "ما الذي تقيسه كل مرحلة",
    thStage: "المرحلة",
    thWeight: "الوزن",
    thScore: "الدرجة",
    thCut: "حد القطع",
    thOutcome: "النتيجة",
    required: "إلزامية",
    pass: "اجتياز",
    below: "دون الحد",
    notTaken: "لم تُؤدَّ",
    partialPlacement: "تقييم جزئي",
    skillsAssessed: "المهارات المُقيّمة",
    disclaimer:
      "هذه إشارة فرز استرشادية، وليست قرار توظيف ولا تشخيصًا تطويريًا. يفسّرها مراجع مؤهّل في VIFM مع أدلة أخرى؛ ولا يُتّخذ أي قرار تلقائيًا.",
    confidential: "سري - لمعهد VIFM والعميل المتعاقد فقط.",
    certifiedTitle: "معتمد - تمت مراجعته من قبل مقيّم",
    certifiedBy: "روجِع واعتُمد بواسطة",
    reviewerNotesLabel: "ملاحظات المراجع",
    reco_advance: "ترشيح للمرحلة التالية",
    reco_review: "مراجعة",
    reco_hold: "إيقاف للمراجعة",
    reco_incomplete: "قيد التنفيذ",
    howTitle: "كيف تُحتسب هذه الدرجة",
    howComposite:
      "الدرجة الكلية هي متوسط مرجّح (0-100) لدرجات المراحل أعلاه؛ تُسهم كل مرحلة بحسب وزنها، وتظهر فقط بعد أن يُكمل المرشّح جميع المراحل المرجّحة. ثم تُشتق الإشارة الاسترشادية تلقائيًا من الدرجة الكلية؛ وهي إشارة فرز وليست قرار توظيف:",
    thBand: "الإشارة",
    thWhen: "متى",
    thMeaning: "ماذا تعني",
    when_advance: "الدرجة الكلية 70 فأعلى وكل مرحلة إلزامية عند حد القطع أو أعلى",
    when_review: "الدرجة الكلية 50-69، أو مرحلة إلزامية دون حد القطع (ما يحدّ الإشارة هنا)",
    when_hold: "الدرجة الكلية دون 50",
    when_incomplete: "لم يُكمل المرشّح جميع المراحل بعد",
    mean_advance: "إشارة فرز قوية",
    mean_review: "متوسطة - تستحق نظرة أدق",
    mean_hold: "إشارة منخفضة - ينبغي أن يراجعها شخص",
    mean_incomplete: "لا تتوفر درجة كلية بعد",
    cbiTitle: "المقابلة بالذكاء الاصطناعي - النص والتقييم",
    cbiIntro:
      "أُجريت هذه المقابلة السلوكية وصُحِّحت بالذكاء الاصطناعي. النص الكامل وتقييم الذكاء الاصطناعي أدناه لمراجعتك - والتقييم إشارة استرشادية وليس قرارًا.",
    cbiAiRating: "تقييم الذكاء الاصطناعي",
    cbiRationale: "مبرّر الذكاء الاصطناعي",
    cbiStrengths: "نقاط القوة المرصودة",
    cbiDev: "مجالات التطوير",
    cbiTranscript: "نص المقابلة",
    cbiInterviewer: "المُحاوِر (ذكاء اصطناعي)",
    cbiCandidate: "المرشّح",
    cbiAiNote: "مُولّد بالذكاء الاصطناعي من النص أعلاه؛ وينبغي أن يتحقّق منه مراجع بشري.",
  },
};

const TONE: Record<PrehireRecommendation, { bg: string; fg: string }> = {
  advance: { bg: "#d1fae5", fg: "#065f46" },
  review: { bg: "#fef3c7", fg: "#92400e" },
  hold: { bg: "#ffe4e6", fg: "#9f1239" },
  incomplete: { bg: "#e2e8f0", fg: "#475569" },
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "Certified - SME-reviewed by X on date" banner, shown on both report views
 *  once the candidate is certified (Pre-Hire #3). Inline-styled so it works in
 *  both renderers without touching either <style> block. */
function certBannerHtml(data: PrehireReportData, t: Record<string, string>, lang: Lang): string {
  if (!data.certification) return "";
  const d = new Date(data.certification.certifiedAt).toLocaleDateString(
    lang === "ar" ? "ar" : "en-GB",
    { year: "numeric", month: "long", day: "numeric" }
  );
  const who = data.certification.certifiedBy ? esc(data.certification.certifiedBy) : "-";
  const notes = data.certification.notes
    ? `<div style="font-size:10.5px;color:#065f46;margin-top:4px"><strong>${t.reviewerNotesLabel}:</strong> ${esc(data.certification.notes)}</div>`
    : "";
  return `<div style="display:flex;gap:10px;align-items:flex-start;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:10px 14px;margin:0 0 16px"><span style="font-size:18px;color:#047857;font-weight:700;line-height:1.1">&#10003;</span><div><div style="font-size:12.5px;font-weight:700;color:#065f46">${t.certifiedTitle}</div><div style="font-size:11px;color:#047857;margin-top:1px">${t.certifiedBy} <b>${who}</b> &middot; ${d}</div>${notes}</div></div>`;
}

/**
 * One-page condensed SUMMARY sheet (a quick at-a-glance read): header, the
 * composite + advisory band, a compact per-stage table, and the guardrail line.
 * No methodology, transcript, or band table - that's the full report.
 */
export function renderPrehireSummaryHtml(data: PrehireReportData, lang: Lang): string {
  const t = L[lang];
  const rtl = lang === "ar";
  const tone = TONE[data.recommendation];
  const recoLabel = t[`reco_${data.recommendation}`];
  const dateStr = data.generatedAt.toLocaleDateString(lang === "ar" ? "ar" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const rows = data.stages
    .map((s) => {
      const outcome =
        s.normalized == null
          ? `<span class="muted">${t.notTaken}</span>`
          : s.passed === false
            ? `<span class="badge warn">${t.below}</span>`
            : `<span class="badge ok">${t.pass}</span>`;
      return `<tr><td class="strong">${esc(s.label)}${s.required ? ` <span class="req">${t.required}</span>` : ""}</td><td class="num">${Math.round(s.weightPct)}%</td><td class="num">${s.normalized == null ? "-" : Math.round(s.normalized)}</td><td class="num">${s.cutScore == null ? "-" : s.cutScore}</td><td>${outcome}</td></tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="${lang}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  @page { size: A4; margin: 20mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: ${rtl ? "'Cairo'," : ""} 'Open Sans', 'Segoe UI', Tahoma, sans-serif; color: #111232; margin: 0; font-size: 12.5px; line-height: 1.5; }
  .head { border-bottom: 3px solid #010131; padding-bottom: 10px; margin-bottom: 18px; }
  .brand { color: #5391D5; font-size: 11px; font-weight: 600; letter-spacing: .04em; }
  h1 { font-size: 21px; margin: 4px 0 2px; color: #010131; }
  .meta { color: #555; font-size: 11px; }
  .hero { display: flex; gap: 14px; margin: 18px 0; align-items: stretch; }
  .hero .box { flex: 1; border: 1px solid #e3e6ee; border-radius: 10px; padding: 16px 18px; }
  .hero .v { font-size: 40px; font-weight: 700; color: #010131; line-height: 1; }
  .hero .l { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #777; margin-top: 4px; }
  .reco { display: inline-block; border-radius: 999px; padding: 6px 16px; font-weight: 700; font-size: 15px; }
  h2 { font-size: 13px; color: #010131; margin: 18px 0 8px; border-${rtl ? "right" : "left"}: 3px solid #5391D5; padding-${rtl ? "right" : "left"}: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: ${rtl ? "right" : "left"}; padding: 8px; border-bottom: 1px solid #eceef4; font-size: 12px; }
  th { background: #f6f8fc; color: #444; font-weight: 600; text-transform: uppercase; font-size: 9.5px; letter-spacing: .04em; }
  td.num, th.num { text-align: center; font-variant-numeric: tabular-nums; }
  td.strong { font-weight: 600; color: #010131; }
  .req { font-size: 8.5px; color: #b45309; border: 1px solid #fde68a; background: #fffbeb; border-radius: 4px; padding: 0 4px; }
  .muted { color: #999; }
  .badge { display: inline-block; border-radius: 999px; padding: 1px 8px; font-size: 9.5px; font-weight: 600; }
  .badge.ok { background: #d1fae5; color: #065f46; }
  .badge.warn { background: #ffe4e6; color: #9f1239; }
  .disclaimer { font-size: 10.5px; color: #475569; background: #f8fafc; border: 1px solid #e3e6ee; border-radius: 8px; padding: 10px 12px; margin-top: 18px; }
  .foot { margin-top: 24px; border-top: 1px solid #e3e6ee; padding-top: 8px; color: #888; font-size: 9.5px; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  ${provisionalStrip(data, lang)}
  <div class="head">
    <div class="brand">${t.brand}</div>
    <h1>${t.summaryTitle}</h1>
    <div class="meta">${t.candidate}: <b>${esc(data.candidateName)}</b>${
      data.employeeId ? ` · ${t.employeeId}: ${esc(data.employeeId)}` : ""
    } · ${t.role}: ${esc(data.requisitionTitle)}${data.level ? ` (${esc(data.level)})` : ""}${
      data.orgName ? ` · ${esc(data.orgName)}` : ""
    } · ${t.generated}: ${dateStr}</div>
  </div>
  ${certBannerHtml(data, t, lang)}
  <div class="hero">
    <div class="box"><div class="v">${data.composite == null ? "-" : data.composite}</div><div class="l">${t.composite}</div></div>
    <div class="box"><div class="l" style="margin-bottom:8px">${t.advisory}</div><span class="reco" style="background:${tone.bg};color:${tone.fg}">${recoLabel}</span></div>
  </div>
  <h2>${t.perStage}</h2>
  <table>
    <thead><tr><th>${t.thStage}</th><th class="num">${t.thWeight}</th><th class="num">${t.thScore}</th><th class="num">${t.thCut}</th><th>${t.thOutcome}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="disclaimer">${t.disclaimer}</div>
  <div class="foot"><span>${t.confidential}</span><span>${esc(data.candidateName)}</span></div>
</body>
</html>`;
}

export function renderPrehireCandidateHtml(data: PrehireReportData, lang: Lang): string {
  const t = L[lang];
  const rtl = lang === "ar";
  const tone = TONE[data.recommendation];
  const recoLabel = t[`reco_${data.recommendation}`];

  const dateStr = data.generatedAt.toLocaleDateString(lang === "ar" ? "ar" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const stageRows = data.stages
    .map((s) => {
      const outcome =
        s.normalized == null
          ? `<span class="muted">${t.notTaken}</span>`
          : s.passed === false
            ? `<span class="badge warn">${t.below}</span>`
            : `<span class="badge ok">${t.pass}</span>`;
      const note = s.note ? `<div class="substage">${esc(s.note)}</div>` : "";
      const def = s.definition ? `<div class="stage-def">${esc(s.definition)}</div>` : "";
      return `<tr>
        <td class="strong">${esc(s.label)}${s.required ? ` <span class="req">${t.required}</span>` : ""}${def}${note}</td>
        <td class="num">${Math.round(s.weightPct)}%</td>
        <td class="num">${s.normalized == null ? "-" :Math.round(s.normalized)}</td>
        <td class="num">${s.cutScore == null ? "-" :s.cutScore}</td>
        <td>${outcome}</td>
      </tr>`;
    })
    .join("");

  // "How this score is calculated" - the band methodology, so the client
  // understands the automatically-derived advisory signal.
  const bandOrder: PrehireRecommendation[] = ["advance", "review", "hold", "incomplete"];
  const bandRows = bandOrder
    .map((b) => {
      const bt = TONE[b];
      return `<tr>
        <td><span class="reco" style="background:${bt.bg};color:${bt.fg};font-size:10px;padding:2px 9px">${t[`reco_${b}`]}</span></td>
        <td>${t[`when_${b}`]}</td>
        <td class="muted">${t[`mean_${b}`]}</td>
      </tr>`;
    })
    .join("");

  // CBI (AI interview) transcript + AI assessment - only when the candidate
  // completed the interview. Lets the client read the actual responses, since
  // the rating is AI-generated (a signal), not a human verdict.
  const sep = lang === "ar" ? "؛ " : "; ";
  const cbiSection = data.cbi
    ? `
  <h2>${t.cbiTitle}</h2>
  <p class="muted" style="margin:0 0 10px;color:#555;font-size:11px">${t.cbiIntro}</p>
  <div class="cbi-assess">
    ${data.cbi.ratingLabel ? `<div><span class="cbi-k">${t.cbiAiRating}:</span> <b>${esc(data.cbi.ratingLabel)}</b>${data.cbi.bars != null ? ` (${data.cbi.bars}/5)` : ""}</div>` : ""}
    ${data.cbi.rationale ? `<div style="margin-top:6px"><span class="cbi-k">${t.cbiRationale}:</span> ${esc(data.cbi.rationale)}</div>` : ""}
    ${data.cbi.strengths.length ? `<div style="margin-top:6px"><span class="cbi-k">${t.cbiStrengths}:</span> ${data.cbi.strengths.map(esc).join(sep)}</div>` : ""}
    ${data.cbi.developmentAreas.length ? `<div style="margin-top:6px"><span class="cbi-k">${t.cbiDev}:</span> ${data.cbi.developmentAreas.map(esc).join(sep)}</div>` : ""}
  </div>
  <div class="cbi-tx-title">${t.cbiTranscript}</div>
  <div class="cbi-tx">
    ${data.cbi.exchanges
      .map(
        (m) =>
          `<div class="cbi-turn ${m.who}"><div class="cbi-who">${m.who === "candidate" ? t.cbiCandidate : t.cbiInterviewer}</div><div class="cbi-text">${esc(m.text)}</div></div>`
      )
      .join("")}
  </div>
  <p class="muted" style="margin-top:8px;font-size:9.5px;font-style:italic">${t.cbiAiNote}</p>`
    : "";

  return `<!doctype html>
<html lang="${lang}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: ${rtl ? "'Cairo'," : ""} 'Open Sans', 'Segoe UI', Tahoma, sans-serif; color: #111232; margin: 0; font-size: 12px; line-height: 1.5; }
  .head { border-bottom: 3px solid #010131; padding-bottom: 10px; margin-bottom: 18px; }
  .brand { color: #5391D5; font-size: 11px; font-weight: 600; letter-spacing: .04em; }
  h1 { font-size: 20px; margin: 4px 0 2px; color: #010131; }
  .meta { color: #555; font-size: 11px; }
  .stats { display: flex; gap: 10px; margin: 16px 0 18px; align-items: stretch; }
  .stat { flex: 1; border: 1px solid #e3e6ee; border-radius: 8px; padding: 12px 14px; }
  .stat .v { font-size: 26px; font-weight: 700; color: #010131; }
  .stat .l { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #777; margin-top: 2px; }
  .stat-def { font-size: 9.5px; color: #667085; margin-top: 6px; line-height: 1.45; }
  .stage-def { font-size: 9px; font-weight: 400; color: #667085; margin-top: 2px; line-height: 1.4; }
  .reco { display: inline-block; border-radius: 999px; padding: 4px 12px; font-weight: 700; font-size: 13px; }
  h2 { font-size: 13px; color: #010131; margin: 18px 0 8px; border-${rtl ? "right" : "left"}: 3px solid #5391D5; padding-${rtl ? "right" : "left"}: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: ${rtl ? "right" : "left"}; padding: 7px 8px; border-bottom: 1px solid #eceef4; font-size: 11px; }
  th { background: #f6f8fc; color: #444; font-weight: 600; text-transform: uppercase; font-size: 9.5px; letter-spacing: .04em; }
  td.num, th.num { text-align: center; font-variant-numeric: tabular-nums; }
  td.strong { font-weight: 600; color: #010131; }
  .req { font-size: 8.5px; color: #b45309; border: 1px solid #fde68a; background: #fffbeb; border-radius: 4px; padding: 0 4px; }
  .substage { font-size: 9px; font-weight: 400; color: #b45309; margin-top: 3px; }
  .muted { color: #999; }
  .badge { display: inline-block; border-radius: 999px; padding: 1px 8px; font-size: 9px; font-weight: 600; }
  .badge.ok { background: #d1fae5; color: #065f46; }
  .badge.warn { background: #ffe4e6; color: #9f1239; }
  .cbi-assess { background: #f6f8fc; border: 1px solid #e3e6ee; border-radius: 8px; padding: 10px 12px; font-size: 11px; line-height: 1.5; }
  .cbi-k { color: #5391D5; font-weight: 600; }
  .cbi-tx-title { font-size: 9.5px; text-transform: uppercase; letter-spacing: .05em; color: #777; margin: 12px 0 6px; font-weight: 600; }
  .cbi-tx { border: 1px solid #eceef4; border-radius: 8px; overflow: hidden; }
  .cbi-turn { padding: 7px 12px; border-bottom: 1px solid #f0f2f7; }
  .cbi-turn:last-child { border-bottom: none; }
  .cbi-turn.interviewer { background: #fafbfe; }
  .cbi-who { font-size: 8.5px; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; color: #9aa3b2; }
  .cbi-turn.candidate .cbi-who { color: #010131; }
  .cbi-text { font-size: 11px; margin-top: 2px; white-space: pre-wrap; }
  .disclaimer { font-size: 10.5px; color: #475569; background: #f8fafc; border: 1px solid #e3e6ee; border-radius: 8px; padding: 10px 12px; margin-top: 16px; }
  .foot { margin-top: 24px; border-top: 1px solid #e3e6ee; padding-top: 8px; color: #888; font-size: 9.5px; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  ${provisionalStrip(data, lang)}
  <div class="head">
    <div class="brand">${t.brand}</div>
    <h1>${t.title}</h1>
    <div class="meta">${t.candidate}: <b>${esc(data.candidateName)}</b>${
      data.candidateEmail ? ` · ${esc(data.candidateEmail)}` : ""
    }${data.employeeId ? ` · ${t.employeeId}: ${esc(data.employeeId)}` : ""} · ${t.role}: ${esc(data.requisitionTitle)}${data.level ? ` (${esc(data.level)})` : ""}${
      data.orgName ? ` · ${t.organization}: ${esc(data.orgName)}` : ""
    } · ${t.generated}: ${dateStr}</div>
  </div>

  ${certBannerHtml(data, t, lang)}

  <div class="stats">
    <div class="stat">
      <div class="v">${data.composite == null ? "-" : data.composite}</div>
      <div class="l">${t.composite}</div>
      <div class="stat-def">${t.compositeDef}</div>
    </div>
    <div class="stat">
      <div class="l" style="margin-bottom:6px">${t.advisory}</div>
      <span class="reco" style="background:${tone.bg};color:${tone.fg}">${recoLabel}</span>
    </div>
  </div>

  <h2>${t.perStage}</h2>
  <table>
    <thead><tr>
      <th>${t.thStage}</th><th class="num">${t.thWeight}</th><th class="num">${t.thScore}</th>
      <th class="num">${t.thCut}</th><th>${t.thOutcome}</th>
    </tr></thead>
    <tbody>${stageRows}</tbody>
  </table>

  ${cbiSection}

  <h2>${t.howTitle}</h2>
  <p class="muted" style="margin:0 0 8px; color:#555; font-size:11px">${t.howComposite}</p>
  <table>
    <thead><tr><th>${t.thBand}</th><th>${t.thWhen}</th><th>${t.thMeaning}</th></tr></thead>
    <tbody>${bandRows}</tbody>
  </table>

  <div class="disclaimer">${t.disclaimer}</div>

  <div class="foot"><span>${t.confidential}</span><span>${esc(data.candidateName)}</span></div>
</body>
</html>`;
}
