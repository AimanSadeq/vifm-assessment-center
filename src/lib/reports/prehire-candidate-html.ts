import type { PrehireRecommendation } from "@/lib/prehire/scoring";

/**
 * Per-candidate Pre-Hire screening report (HTML → Puppeteer PDF). VIFM is the
 * assessor, not the client, so this is the deliverable VIFM downloads or emails
 * to the client per candidate. It surfaces the advisory composite + per-stage
 * scores, a "How this score is calculated" methodology section (the composite
 * formula + the four advisory bands and their triggers — since the signal is
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
  generatedAt: Date;
};

type Lang = "en" | "ar";

const L: Record<Lang, Record<string, string>> = {
  en: {
    brand: "Virginia Institute of Finance and Management",
    title: "Pre-Hire® Screening Report",
    candidate: "Candidate",
    employeeId: "Employee ID",
    role: "Role",
    organization: "Organization",
    generated: "Generated",
    advisory: "Advisory signal",
    composite: "Composite",
    perStage: "By stage",
    thStage: "Stage",
    thWeight: "Weight",
    thScore: "Score",
    thCut: "Cut",
    thOutcome: "Outcome",
    required: "Required",
    pass: "Pass",
    below: "Below cut",
    notTaken: "Not taken",
    disclaimer:
      "This is an advisory screening SIGNAL, not a hiring decision. A qualified VIFM reviewer interprets it alongside other evidence; no decision is ever made automatically.",
    confidential: "Confidential — for VIFM and the engaged client only.",
    reco_advance: "Advance",
    reco_review: "Review",
    reco_hold: "Hold for review",
    reco_incomplete: "In progress",
    howTitle: "How this score is calculated",
    howComposite:
      "The Composite is a weighted average (0–100) of the stage scores above — each stage counts in proportion to its Weight — shown only once the candidate has completed every weighted stage. The Advisory signal is then derived automatically from the Composite; it is a screening signal, not a hiring decision:",
    thBand: "Signal",
    thWhen: "When",
    thMeaning: "What it means",
    when_advance: "Composite 70+ and every required stage at or above its cut-score",
    when_review: "Composite 50–69, or a required stage below its cut-score (which caps the signal here)",
    when_hold: "Composite below 50",
    when_incomplete: "The candidate hasn't completed every stage yet",
    mean_advance: "Strong screening signal",
    mean_review: "Middling — worth a closer look",
    mean_hold: "Low signal — a person should review",
    mean_incomplete: "No composite is available yet",
  },
  ar: {
    brand: "معهد فرجينيا للتمويل والإدارة",
    title: "تقرير فرز ما قبل التوظيف",
    candidate: "المرشّح",
    employeeId: "الرقم الوظيفي",
    role: "الوظيفة",
    organization: "المؤسسة",
    generated: "تاريخ الإصدار",
    advisory: "إشارة استرشادية",
    composite: "الدرجة الكلية",
    perStage: "حسب المرحلة",
    thStage: "المرحلة",
    thWeight: "الوزن",
    thScore: "الدرجة",
    thCut: "حد القطع",
    thOutcome: "النتيجة",
    required: "إلزامية",
    pass: "اجتياز",
    below: "دون الحد",
    notTaken: "لم تُؤدَّ",
    disclaimer:
      "هذه إشارة فرز استرشادية، وليست قرار توظيف. يفسّرها مراجع مؤهّل في VIFM مع أدلة أخرى؛ ولا يُتّخذ أي قرار تلقائيًا.",
    confidential: "سري — لمعهد VIFM والعميل المتعاقد فقط.",
    reco_advance: "ترشيح للمرحلة التالية",
    reco_review: "مراجعة",
    reco_hold: "إيقاف للمراجعة",
    reco_incomplete: "قيد التنفيذ",
    howTitle: "كيف تُحتسب هذه الدرجة",
    howComposite:
      "الدرجة الكلية هي متوسط مرجّح (0–100) لدرجات المراحل أعلاه — تُسهم كل مرحلة بحسب وزنها — وتظهر فقط بعد أن يُكمل المرشّح جميع المراحل المرجّحة. ثم تُشتق الإشارة الاسترشادية تلقائيًا من الدرجة الكلية؛ وهي إشارة فرز وليست قرار توظيف:",
    thBand: "الإشارة",
    thWhen: "متى",
    thMeaning: "ماذا تعني",
    when_advance: "الدرجة الكلية 70 فأعلى وكل مرحلة إلزامية عند حد القطع أو أعلى",
    when_review: "الدرجة الكلية 50–69، أو مرحلة إلزامية دون حد القطع (ما يحدّ الإشارة هنا)",
    when_hold: "الدرجة الكلية دون 50",
    when_incomplete: "لم يُكمل المرشّح جميع المراحل بعد",
    mean_advance: "إشارة فرز قوية",
    mean_review: "متوسطة — تستحق نظرة أدق",
    mean_hold: "إشارة منخفضة — ينبغي أن يراجعها شخص",
    mean_incomplete: "لا تتوفر درجة كلية بعد",
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
      return `<tr>
        <td class="strong">${esc(s.label)}${s.required ? ` <span class="req">${t.required}</span>` : ""}</td>
        <td class="num">${Math.round(s.weightPct)}%</td>
        <td class="num">${s.normalized == null ? "—" : Math.round(s.normalized)}</td>
        <td class="num">${s.cutScore == null ? "—" : s.cutScore}</td>
        <td>${outcome}</td>
      </tr>`;
    })
    .join("");

  // "How this score is calculated" — the band methodology, so the client
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
  .reco { display: inline-block; border-radius: 999px; padding: 4px 12px; font-weight: 700; font-size: 13px; }
  h2 { font-size: 13px; color: #010131; margin: 18px 0 8px; border-${rtl ? "right" : "left"}: 3px solid #5391D5; padding-${rtl ? "right" : "left"}: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: ${rtl ? "right" : "left"}; padding: 7px 8px; border-bottom: 1px solid #eceef4; font-size: 11px; }
  th { background: #f6f8fc; color: #444; font-weight: 600; text-transform: uppercase; font-size: 9.5px; letter-spacing: .04em; }
  td.num, th.num { text-align: center; font-variant-numeric: tabular-nums; }
  td.strong { font-weight: 600; color: #010131; }
  .req { font-size: 8.5px; color: #b45309; border: 1px solid #fde68a; background: #fffbeb; border-radius: 4px; padding: 0 4px; }
  .muted { color: #999; }
  .badge { display: inline-block; border-radius: 999px; padding: 1px 8px; font-size: 9px; font-weight: 600; }
  .badge.ok { background: #d1fae5; color: #065f46; }
  .badge.warn { background: #ffe4e6; color: #9f1239; }
  .disclaimer { font-size: 10.5px; color: #475569; background: #f8fafc; border: 1px solid #e3e6ee; border-radius: 8px; padding: 10px 12px; margin-top: 16px; }
  .foot { margin-top: 24px; border-top: 1px solid #e3e6ee; padding-top: 8px; color: #888; font-size: 9.5px; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="head">
    <div class="brand">${t.brand}</div>
    <h1>${t.title}</h1>
    <div class="meta">${t.candidate}: <b>${esc(data.candidateName)}</b>${
      data.candidateEmail ? ` · ${esc(data.candidateEmail)}` : ""
    }${data.employeeId ? ` · ${t.employeeId}: ${esc(data.employeeId)}` : ""} · ${t.role}: ${esc(data.requisitionTitle)}${data.level ? ` (${esc(data.level)})` : ""}${
      data.orgName ? ` · ${t.organization}: ${esc(data.orgName)}` : ""
    } · ${t.generated}: ${dateStr}</div>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="v">${data.composite == null ? "—" : data.composite}</div>
      <div class="l">${t.composite}</div>
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
