import { PROVISIONAL_COPY } from "@/lib/ara/provisional";
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

/** English (Fluent) language profile - overall CEFR + per-skill detail, so the
 *  report carries a proper English section like a standalone language report. */
export type PrehireFluentSkill = {
  key: "reading" | "listening" | "writing" | "speaking";
  cefr: string | null;
  /** Receptive skills (reading/listening) carry a correct/total; productive ones don't. */
  correct?: number | null;
  total?: number | null;
  /** Productive skills (writing/speaking) carry an AI narrative. */
  feedback?: string | null;
};
export type PrehireFluentBlock = {
  overallCefr: string | null;
  skills: PrehireFluentSkill[];
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
  /** English (Fluent) language profile, when the requisition ran a Fluent stage. */
  fluent?: PrehireFluentBlock | null;
  certification?: PrehireCertification | null;
  generatedAt: Date;
  /** Option 2 gate: true while the quiz bank still mints live-AI (pending SME review). */
  provisional?: boolean;
  /** Competencies selected for the requisition's role (via its role profile),
   *  each with its behavioural indicators ("sub-competencies"), a plain-language
   *  definition, and - where the quiz mapped items to this competency - the
   *  candidate's actual per-competency result from the exam. */
  competencies?: PrehireReportCompetency[];
};

export type PrehireReportCompetency = {
  name: string;
  nameAr: string | null;
  priority: string | null;
  /** Plain-language definition of the competency (EN/AR resolved by the builder). */
  definition?: string | null;
  /** Behavioural indicators - the observable "sub-competencies". */
  indicators?: string[];
  /** Actual quiz result for the items mapped to this competency, when the exam
   *  produced a per-competency signal. examTotal === 0 => not assessed in the quiz. */
  examCorrect?: number | null;
  examTotal?: number | null;
};

/** Data-grounded result summary: composite band, stages passed, strongest /
 *  lowest stage, any required stage below cut-score, plus the guardrail. Built
 *  only from real per-stage results (no fabricated narrative). */
function resultSummary(data: PrehireReportData, lang: Lang, recoLabel: string): string {
  const ar = lang === "ar";
  const stages = data.stages.filter((s) => s.normalized != null);
  if (stages.length === 0) return "";
  const passed = stages.filter((s) => s.passed).length;
  const failedReq = stages.filter((s) => s.required && !s.passed).map((s) => s.label);
  const sorted = [...stages].sort((a, b) => (b.normalized ?? 0) - (a.normalized ?? 0));
  const top = sorted[0];
  const low = sorted[sorted.length - 1];
  const parts: string[] = [];
  if (ar) {
    parts.push(`النتيجة الإجمالية <b>${data.composite ?? "-"}</b> من ١٠٠ - الإشارة الاستشارية: <b>${recoLabel}</b>.`);
    parts.push(`اجتاز <b>${passed}</b> من <b>${stages.length}</b> من المراحل المُقيَّمة.`);
    parts.push(`أعلى مرحلة: <b>${esc(top.label)}</b> (${Math.round(top.normalized as number)})؛ وأدنى مرحلة: <b>${esc(low.label)}</b> (${Math.round(low.normalized as number)}).`);
    if (failedReq.length) parts.push(`دون درجة القطع في مرحلة إلزامية: ${failedReq.map(esc).join("، ")}.`);
  } else {
    parts.push(`Composite <b>${data.composite ?? "-"}</b>/100 - advisory signal: <b>${recoLabel}</b>.`);
    parts.push(`Passed <b>${passed}</b> of <b>${stages.length}</b> assessed stages.`);
    parts.push(`Strongest: <b>${esc(top.label)}</b> (${Math.round(top.normalized as number)}); lowest: <b>${esc(low.label)}</b> (${Math.round(low.normalized as number)}).`);
    if (failedReq.length) parts.push(`Below cut-score on a required stage: ${failedReq.map(esc).join(", ")}.`);
  }
  const guard = ar
    ? "هذه إشارة فرز استشارية وليست قراراً توظيفياً - القرار النهائي لمسؤول التوظيف."
    : "This is an advisory screening signal, not a hiring decision - a human makes the final call.";
  const title = ar ? "ملخص النتيجة" : "Result summary";
  return `<h2>${title}</h2><div style="background:#f8fafc;border:1px solid #e3e6ee;border-radius:8px;padding:11px 13px;font-size:11.5px;line-height:1.6">${parts
    .map((p) => `<div>${p}</div>`)
    .join("")}<div style="margin-top:6px;color:#475569;font-size:10.5px">${guard}</div></div>`;
}

// Performance band for a per-competency exam result. Grey when the quiz produced
// no items for that competency (examTotal 0/null).
function compBand(
  correct: number | null | undefined,
  total: number | null | undefined,
  ar: boolean
): { key: "strong" | "moderate" | "developing" | "none"; label: string; fill: string; bg: string; fg: string; border: string; pct: number | null } {
  if (!total || total <= 0) {
    return {
      key: "none",
      label: ar ? "لم تُقيَّم في الاختبار" : "Not assessed in quiz",
      fill: "#cbd5e1", bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0", pct: null,
    };
  }
  const pct = Math.round((100 * (correct ?? 0)) / total);
  if (pct >= 80) return { key: "strong", label: ar ? "قوي" : "Strong", fill: "#12805c", bg: "#e8f5ee", fg: "#067647", border: "#b6e2c8", pct };
  if (pct >= 50) return { key: "moderate", label: ar ? "متوسط" : "Moderate", fill: "#d08214", bg: "#fef6e7", fg: "#b25e09", border: "#f5d9a8", pct };
  return { key: "developing", label: ar ? "قيد التطوير" : "Developing", fill: "#d1493c", bg: "#fdeef0", fg: "#b42318", border: "#f5c6cb", pct };
}

// Candidate-specific, band-aware narrative for a competency ("what this result
// means for THIS candidate") - changes with the performance band, folding in the
// competency name + score. Bilingual. Empty for a not-assessed competency.
function compNarrative(
  key: "strong" | "moderate" | "developing" | "none",
  name: string,
  correct: number | null | undefined,
  total: number | null | undefined,
  ar: boolean
): string {
  if (key === "none") return "";
  const s = `${correct ?? 0}/${total}`;
  if (ar) {
    if (key === "strong")
      return `أظهر المرشح قوة واضحة في «${name}» بإجابة ${s} بشكل صحيح - نقطة قوة جاهزة للتطبيق في هذا الدور.`;
    if (key === "moderate")
      return `أظهر المرشح مستوى عملياً في «${name}» (${s}) - كفؤ في جوانب منه مع مجال للتعميق.`;
    return `جاءت إجابات المرشح في «${name}» دون المستوى المستهدف (${s}) - أولوية تطوير لهذا الدور.`;
  }
  if (key === "strong")
    return `The candidate showed a clear strength in ${name}, answering ${s} correctly - a strength that is ready to apply in this role.`;
  if (key === "moderate")
    return `The candidate showed a working level in ${name} (${s}) - competent in parts, with room to deepen.`;
  return `The candidate's responses in ${name} fell below the target level (${s}) - a development priority for this role.`;
}

/** "By stage" as headed cards (not a flat table): each stage a card with its
 *  name header + Required badge, definition, note, and a right-hand stat block
 *  (score, weight/cut, outcome pill). */
function stageCardsHtml(stages: PrehireReportStage[], t: Record<string, string>, rtl: boolean): string {
  const endAlign = rtl ? "left" : "right";
  return stages
    .map((s) => {
      const outcome =
        s.normalized == null
          ? `<span class="muted" style="font-size:10px">${t.notTaken}</span>`
          : s.passed === false
            ? `<span class="badge warn">${t.below}</span>`
            : `<span class="badge ok">${t.pass}</span>`;
      const def = s.definition ? `<div class="stage-def">${esc(s.definition)}</div>` : "";
      const note = s.note ? `<div class="substage">${esc(s.note)}</div>` : "";
      const score = s.normalized == null ? "-" : Math.round(s.normalized);
      return `<div style="border:1px solid #e3e6ee;border-radius:8px;padding:10px 13px;margin-bottom:8px;background:#fbfcfe;page-break-inside:avoid">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700;color:#010131">${esc(s.label)}${s.required ? ` <span class="req">${t.required}</span>` : ""}</div>
            ${def}${note}
          </div>
          <div style="text-align:${endAlign};flex-shrink:0;min-width:96px">
            <div style="font-size:22px;font-weight:700;color:#010131;line-height:1">${score}</div>
            <div style="font-size:8.5px;color:#94a3b8;margin-top:3px">${t.thWeight} ${Math.round(s.weightPct)}% · ${t.thCut} ${s.cutScore == null ? "-" : s.cutScore}</div>
            <div style="margin-top:5px">${outcome}</div>
          </div>
        </div>
      </div>`;
    })
    .join("");
}

/** Prominent stage banner heading the DETAIL section for a stage: a full-width
 *  navy band with the stage name in very large type + a small subtitle. Marks
 *  unmistakably where each stage's detailed results begin. */
function stageBanner(eyebrow: string, title: string, subtitle: string | null): string {
  return `<div style="background:#010131;border-radius:9px;padding:14px 18px;margin:22px 0 12px;page-break-inside:avoid;page-break-after:avoid">
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:#5391D5;margin-bottom:3px">${esc(eyebrow)}</div>
    <div style="font-size:22px;font-weight:700;color:#ffffff;line-height:1.2">${esc(title)}</div>
    ${subtitle ? `<div style="font-size:10.5px;color:rgba(255,255,255,0.72);margin-top:3px">${esc(subtitle)}</div>` : ""}
  </div>`;
}

/** "Competencies assessed" block - the role's selected competencies (from the
 *  requisition's role profile), each with a plain-language definition, its
 *  behavioural indicators ("sub-competencies"), and - where the quiz mapped
 *  items to the competency - the candidate's actual per-competency result plus a
 *  quiz-driven ranking. Empty string when no competencies are attached. */
function competenciesSection(data: PrehireReportData, lang: Lang): string {
  const list = data.competencies ?? [];
  if (list.length === 0) return "";
  const ar = lang === "ar";
  const title = ar ? "تحليل الكفاءات" : "Competency analysis";
  const intro = ar
    ? "الكفاءات المختارة لهذه الوظيفة عند إنشاء طلب التوظيف - وهي التي يستند إليها اختبار الكفاءات. حيثما وسمت أسئلة الاختبار كفاءةً، تُعرض نتيجة المرشح الفعلية لتلك الكفاءة وترتيبها."
    : "Competencies selected for this role when the requisition was created - these anchor the competency quiz. Where quiz items mapped to a competency, the candidate's actual per-competency result and rank are shown.";
  const pmap: Record<string, { en: string; ar: string }> = {
    critical: { en: "Critical", ar: "حرجة" }, high: { en: "High", ar: "عالية" },
    medium: { en: "Medium", ar: "متوسطة" }, low: { en: "Low", ar: "منخفضة" },
  };
  const subLabel = ar ? "السلوكيات المُقيَّمة (المؤشرات)" : "Behaviours assessed (sub-competencies)";
  const defLabel = ar ? "التعريف" : "Definition";
  const meansLabel = ar ? "ماذا يعني هذا" : "What this means";

  // Rank: assessed competencies first (highest pct wins), then priority, then the
  // builder's incoming order. Only assessed competencies carry a numeric rank.
  const prank = (p: string | null | undefined) =>
    p === "critical" ? 0 : p === "high" ? 1 : p === "medium" ? 2 : p === "low" ? 3 : 4;
  const withIdx = list.map((c, i) => ({ c, i }));
  withIdx.sort((a, b) => {
    const at = a.c.examTotal ?? 0, bt = b.c.examTotal ?? 0;
    const aAss = at > 0 ? 1 : 0, bAss = bt > 0 ? 1 : 0;
    if (aAss !== bAss) return bAss - aAss;
    if (aAss === 1) {
      const ap = (a.c.examCorrect ?? 0) / at, bp = (b.c.examCorrect ?? 0) / bt;
      if (ap !== bp) return bp - ap;
    }
    return prank(a.c.priority) - prank(b.c.priority) || a.i - b.i;
  });

  let assessedRank = 0;
  const anyAssessed = withIdx.some(({ c }) => (c.examTotal ?? 0) > 0);
  const rankChipLabel = ar ? "الترتيب" : "Rank";
  const items = withIdx
    .map(({ c }) => {
      const nm = ar ? c.nameAr || c.name : c.name;
      const p = c.priority ? pmap[c.priority.toLowerCase()] : null;
      const badge = p
        ? `<span style="font-size:9px;font-weight:700;padding:1px 7px;border-radius:999px;background:#eef3fb;color:#1e40af;border:1px solid #c7dbf5;margin-inline-start:6px">${esc(ar ? p.ar : p.en)}</span>`
        : "";
      const band = compBand(c.examCorrect, c.examTotal, ar);
      const assessed = (c.examTotal ?? 0) > 0;
      const rankTag =
        assessed && anyAssessed
          ? `<span style="font-size:8.5px;font-weight:700;color:#64748b;margin-inline-start:6px">${rankChipLabel} #${++assessedRank}</span>`
          : "";
      // Performance chip (band + score) + thin bar.
      const scoreText = assessed
        ? `${c.examCorrect ?? 0} / ${c.examTotal} · ${band.pct}%`
        : band.label;
      const chip = `<span style="font-size:9.5px;font-weight:700;padding:2px 9px;border-radius:999px;background:${band.bg};color:${band.fg};border:1px solid ${band.border};white-space:nowrap">${assessed ? `${esc(band.label)} · ${scoreText}` : esc(band.label)}</span>`;
      const bar = assessed
        ? `<div style="height:5px;border-radius:999px;background:#eef2f7;margin:6px 0 2px;overflow:hidden"><div style="height:100%;width:${band.pct}%;background:${band.fill};border-radius:999px"></div></div>`
        : "";
      // Candidate-specific, band-aware narrative - the dynamic "what this result
      // means for this candidate" line (changes with Strong / Moderate /
      // Developing), tinted to the band. Only for assessed competencies.
      const narr = assessed ? compNarrative(band.key, nm, c.examCorrect, c.examTotal, ar) : "";
      const narrative = narr
        ? `<div style="margin-top:6px;background:${band.bg};border:1px solid ${band.border};border-radius:6px;padding:6px 9px;font-size:10.5px;line-height:1.5;color:${band.fg}"><span style="font-weight:700">${meansLabel}: </span>${esc(narr)}</div>`
        : "";
      const def = c.definition
        ? `<div style="font-size:10px;color:#475569;line-height:1.5;margin-top:3px"><span style="font-weight:700;color:#64748b">${defLabel}: </span>${esc(c.definition)}</div>`
        : "";
      const inds = (c.indicators ?? []).slice(0, 4);
      const bullets = inds.length
        ? `<div style="font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;font-weight:700;margin:7px 0 2px">${subLabel}</div>
           <ul style="margin:0;padding-inline-start:16px">${inds
             .map((i) => `<li style="font-size:10px;color:#334155;line-height:1.45;margin-bottom:1px">${esc(i)}</li>`)
             .join("")}</ul>`
        : "";
      return `<div style="border:1px solid #e3e6ee;border-radius:8px;padding:9px 12px;margin-bottom:8px;background:#fbfcfe;page-break-inside:avoid">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="font-size:12px;font-weight:700;color:#010131">${esc(nm)}${badge}${rankTag}</div>
          <div>${chip}</div>
        </div>${bar}${narrative}${def}${bullets}</div>`;
    })
    .join("");

  // Overview bar chart: every assessed competency at a glance, ranked, band-tinted
  // bars - a visual summary above the detailed cards.
  const chartRows = withIdx
    .filter(({ c }) => (c.examTotal ?? 0) > 0)
    .map(({ c }) => {
      const nm = ar ? c.nameAr || c.name : c.name;
      const band = compBand(c.examCorrect, c.examTotal, ar);
      const pct = band.pct ?? 0;
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <div style="width:40%;font-size:9.5px;color:#334155;text-align:${ar ? "left" : "right"};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(nm)}</div>
        <div style="flex:1;height:9px;background:#eef2f7;border-radius:999px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${band.fill};border-radius:999px"></div></div>
        <div style="width:30px;font-size:9px;font-weight:700;color:${band.fg};text-align:${ar ? "right" : "left"}">${pct}%</div>
      </div>`;
    })
    .join("");
  const chartLabel = ar ? "أداء الكفاءات في لمحة" : "Competency performance at a glance";
  const chart = chartRows
    ? `<div style="border:1px solid #e3e6ee;border-radius:8px;padding:10px 12px;margin:0 0 10px;background:#fbfcfe;page-break-inside:avoid">
         <div style="font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;font-weight:700;margin-bottom:7px">${chartLabel}</div>
         ${chartRows}
       </div>`
    : "";

  // Honesty note: the quiz is a short screen, so a per-competency result rests on
  // a handful of items - indicative, not a definitive competency rating.
  const note = anyAssessed
    ? `<p style="margin:8px 0 0;color:#94a3b8;font-size:9.5px;line-height:1.5">${
        ar
          ? "الدرجة (مثل ٢/٣) هي عدد الأسئلة التي أجاب عنها المرشح بشكل صحيح من إجمالي الأسئلة المطروحة لتلك الكفاءة، و«الترتيب» يرتّب الكفاءات من الأقوى إلى الأضعف. النتائج مأخوذة من اختبار قصير؛ فهي مؤشِّرة وليست تقييماً نهائياً للكفاءة."
          : "The score (e.g. 2/3) is the number of questions the candidate answered correctly out of those asked for that competency, and Rank orders the competencies from strongest to weakest. Results come from a short quiz, so they are indicative, not a definitive competency rating."
      }</p>`
    : "";

  const banner = stageBanner(
    ar ? "تفاصيل المرحلة" : "Stage detail",
    ar ? "اختبار الكفاءات" : "Competency Quiz",
    title
  );
  return `${banner}<p class="muted" style="margin:0 0 8px;color:#555;font-size:11px">${intro}</p>${chart}${items}${note}`;
}

// CEFR band tone: A = developing (rose), B = intermediate (amber), C = advanced (green).
function cefrTone(cefr: string | null): { bg: string; fg: string; border: string } {
  const b = (cefr ?? "").toUpperCase();
  if (b.startsWith("C")) return { bg: "#e8f5ee", fg: "#067647", border: "#b6e2c8" };
  if (b.startsWith("B")) return { bg: "#fef6e7", fg: "#b25e09", border: "#f5d9a8" };
  if (b.startsWith("A")) return { bg: "#fdeef0", fg: "#b42318", border: "#f5c6cb" };
  return { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" };
}
function cefrBadge(cefr: string | null): string {
  if (!cefr) return `<span style="color:#94a3b8">-</span>`;
  const c = cefrTone(cefr);
  return `<span style="font-size:9.5px;font-weight:700;padding:1px 8px;border-radius:999px;background:${c.bg};color:${c.fg};border:1px solid ${c.border}">${esc(cefr.toUpperCase())}</span>`;
}

// ── Inline-SVG diagrams (self-contained; render in the Puppeteer PDF) ──

/** Radial donut gauge for the 0-100 composite, coloured to the advisory band. */
function compositeDonut(value: number | null, ringColor: string): string {
  const r = 34, cx = 42, cy = 42, circ = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * circ;
  return `<svg viewBox="0 0 84 84" width="84" height="84" style="flex-shrink:0" aria-hidden="true">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eef2f7" stroke-width="10"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ringColor}" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy + 2}" text-anchor="middle" font-family="'Open Sans',sans-serif" font-size="22" font-weight="700" fill="#010131">${value == null ? "-" : value}</text>
    <text x="${cx}" y="${cy + 15}" text-anchor="middle" font-family="'Open Sans',sans-serif" font-size="8" fill="#777">/ 100</text>
  </svg>`;
}

/** Four-axis CEFR radar for the English skills (A1=1 … C2=6). Rendered LARGE as
 *  the centrepiece of the English section: gradient-filled polygon, all six CEFR
 *  rings with level labels, a highlighted B2 "working threshold" ring, and
 *  band-coloured dots + CEFR pills on each axis. */
function cefrRadar(skills: PrehireFluentSkill[], ar: boolean): string {
  const CEFR_VAL: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
  const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const order: PrehireFluentSkill["key"][] = ["reading", "listening", "writing", "speaking"];
  const angle: Record<string, number> = { reading: -90, listening: 0, writing: 90, speaking: 180 };
  const labelEn: Record<string, string> = { reading: "Reading", listening: "Listening", writing: "Writing", speaking: "Speaking" };
  const labelAr: Record<string, string> = { reading: "القراءة", listening: "الاستماع", writing: "الكتابة", speaking: "التحدث" };
  const byKey = new Map(skills.map((s) => [s.key, s]));
  if (order.filter((k) => byKey.has(k)).length < 3) return "";
  const cx = 240, cy = 205, maxR = 132;
  const font = "'Cairo','Open Sans',sans-serif";
  const val = (c: string | null | undefined) => CEFR_VAL[(c ?? "").toUpperCase()] ?? 0;
  const pt = (deg: number, rad: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  };

  // Six CEFR rings; B2 (the professional working threshold) highlighted dashed.
  let grid = "";
  let ringLabels = "";
  for (let lvl = 1; lvl <= 6; lvl++) {
    const r = (lvl / 6) * maxR;
    const isB2 = lvl === 4;
    grid += `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="${isB2 ? "#5391D5" : "#e6eaf1"}" stroke-width="${isB2 ? 1.4 : 1}"${isB2 ? ` stroke-dasharray="5 4" stroke-opacity="0.55"` : ""}/>`;
    ringLabels += `<text x="${cx + 7}" y="${(cy - r + 3.5).toFixed(1)}" font-family="${font}" font-size="8.5" fill="#b3bcc9">${LEVELS[lvl - 1]}</text>`;
  }

  let axes = "", labels = "";
  for (const k of order) {
    const [ex, ey] = pt(angle[k], maxR);
    axes += `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#dfe4ec" stroke-width="1"/>`;
    const s = byKey.get(k);
    const nm = ar ? labelAr[k] : labelEn[k];
    const cefr = s?.cefr ? s.cefr.toUpperCase() : "-";
    const tone2 = cefrTone(s?.cefr ?? null);
    let lx = ex, ly = ey, anchor = "middle";
    if (k === "reading") { ly = cy - maxR - 30; }
    else if (k === "writing") { ly = cy + maxR + 26; }
    else if (k === "listening") { lx = cx + maxR + 16; ly = cy - 6; anchor = "start"; }
    else if (k === "speaking") { lx = cx - maxR - 16; ly = cy - 6; anchor = "end"; }
    labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" font-family="${font}" font-size="15" font-weight="700" fill="#010131">${esc(nm)}</text>`;
    // CEFR pill under the skill name, tinted to the band.
    const pillW = 40, pillH = 19;
    const px = anchor === "middle" ? lx - pillW / 2 : anchor === "start" ? lx : lx - pillW;
    const py = ly + 7;
    labels += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pillW}" height="${pillH}" rx="9.5" fill="${tone2.bg}" stroke="${tone2.border}" stroke-width="1"/>`;
    labels += `<text x="${(px + pillW / 2).toFixed(1)}" y="${(py + 13.5).toFixed(1)}" text-anchor="middle" font-family="${font}" font-size="12" font-weight="700" fill="${tone2.fg}">${esc(cefr)}</text>`;
  }

  const poly = order
    .map((k) => {
      const [x, y] = pt(angle[k], (val(byKey.get(k)?.cefr) / 6) * maxR);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const dots = order
    .map((k) => {
      const s = byKey.get(k);
      const tone2 = cefrTone(s?.cefr ?? null);
      const [x, y] = pt(angle[k], (val(s?.cefr) / 6) * maxR);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="${tone2.fg}" stroke="#ffffff" stroke-width="2"/>`;
    })
    .join("");

  return `<svg viewBox="0 0 480 410" width="470" height="401" style="max-width:100%" aria-hidden="true">
    <defs>
      <radialGradient id="cefrGrad" cx="50%" cy="50%" r="65%">
        <stop offset="0%" stop-color="#5391D5" stop-opacity="0.34"/>
        <stop offset="100%" stop-color="#5391D5" stop-opacity="0.10"/>
      </radialGradient>
    </defs>
    ${grid}${axes}${ringLabels}
    <polygon points="${poly}" fill="url(#cefrGrad)" stroke="#5391D5" stroke-width="2.4" stroke-linejoin="round"/>
    ${dots}${labels}
  </svg>`;
}

/** English (Fluent) language profile - overall CEFR + a per-skill table + the AI
 *  narrative for the productive skills. Renders only when a Fluent stage produced
 *  a result. Mirrors what a standalone English report shows. */
// One-line descriptor of what an overall CEFR level means, in plain terms.
function cefrDescriptor(cefr: string | null, ar: boolean): string {
  const b = (cefr ?? "").toUpperCase();
  const en: Record<string, string> = {
    A1: "Beginner - understands and uses basic everyday words and phrases.",
    A2: "Elementary - copes with simple, routine tasks and familiar exchanges.",
    B1: "Intermediate - handles most familiar work and everyday situations independently.",
    B2: "Upper-intermediate - interacts with fluency on professional topics; the working threshold for most business roles.",
    C1: "Advanced - uses English fluently and flexibly for demanding professional and academic purposes.",
    C2: "Proficient - near-native command across virtually all contexts.",
  };
  const arr: Record<string, string> = {
    A1: "مبتدئ - يفهم ويستخدم كلمات وعبارات يومية أساسية.",
    A2: "أساسي - يتعامل مع مهام روتينية بسيطة ومواقف مألوفة.",
    B1: "متوسط - يدير معظم مواقف العمل والحياة اليومية المألوفة باستقلالية.",
    B2: "فوق المتوسط - يتفاعل بطلاقة في المواضيع المهنية؛ وهو الحد العملي لمعظم الأدوار المؤسسية.",
    C1: "متقدم - يستخدم الإنجليزية بطلاقة ومرونة لأغراض مهنية وأكاديمية متطلّبة.",
    C2: "بارع - إتقان يقارب مستوى الناطق الأصلي في مختلف السياقات.",
  };
  return (ar ? arr[b] : en[b]) ?? "";
}

// Per-skill insight. Receptive skills (reading/listening) get a CEFR-band read;
// productive skills (writing/speaking) prefer the AI feedback, falling back to a
// CEFR-band line when no feedback was captured.
function skillInsight(
  key: "reading" | "listening" | "writing" | "speaking",
  cefr: string | null,
  feedback: string | null | undefined,
  ar: boolean
): string {
  if ((key === "writing" || key === "speaking") && feedback) return feedback;
  const band = (cefr ?? "").toUpperCase().charAt(0); // A / B / C
  const T: Record<string, Record<string, { en: string; ar: string }>> = {
    reading: {
      C: { en: "Reads and interprets complex professional documents with ease.", ar: "يقرأ ويفسّر الوثائق المهنية المعقّدة بسهولة." },
      B: { en: "Understands the main ideas and most detail of workplace texts.", ar: "يفهم الأفكار الرئيسية ومعظم تفاصيل النصوص المهنية." },
      A: { en: "Handles short, simple texts; longer or complex material is still a stretch.", ar: "يتعامل مع نصوص قصيرة بسيطة؛ والمواد الأطول أو المعقّدة لا تزال صعبة." },
    },
    listening: {
      C: { en: "Follows extended, complex speech and discussion comfortably.", ar: "يتابع الحديث والنقاش الممتد والمعقّد بارتياح." },
      B: { en: "Follows the main points of clear workplace conversations and presentations.", ar: "يتابع النقاط الرئيسية للمحادثات والعروض المهنية الواضحة." },
      A: { en: "Understands short, simple spoken exchanges; fast or complex speech is difficult.", ar: "يفهم التبادلات المنطوقة القصيرة البسيطة؛ والكلام السريع أو المعقّد صعب." },
    },
    writing: {
      C: { en: "Writes clear, well-structured professional text with precise language.", ar: "يكتب نصاً مهنياً واضحاً ومنظّماً بلغة دقيقة." },
      B: { en: "Writes coherent workplace text; occasional errors that do not impede meaning.", ar: "يكتب نصاً مهنياً متماسكاً؛ مع أخطاء عرضية لا تعيق المعنى." },
      A: { en: "Writes short, simple messages; structure and accuracy are still developing.", ar: "يكتب رسائل قصيرة بسيطة؛ والبنية والدقة قيد التطوير." },
    },
    speaking: {
      C: { en: "Speaks fluently and precisely, adapting to context with ease.", ar: "يتحدّث بطلاقة ودقّة، ويتكيّف مع السياق بسهولة." },
      B: { en: "Speaks with good fluency and clear pronunciation; sustains professional discussion.", ar: "يتحدّث بطلاقة جيدة ونطق واضح؛ ويحافظ على النقاش المهني." },
      A: { en: "Manages short, simple spoken exchanges; fluency and range are still developing.", ar: "يدير تبادلات منطوقة قصيرة بسيطة؛ والطلاقة والتنوّع قيد التطوير." },
    },
  };
  const row = T[key]?.[band];
  return row ? (ar ? row.ar : row.en) : "";
}

function englishSection(data: PrehireReportData, lang: Lang): string {
  const f = data.fluent;
  if (!f || (!f.overallCefr && (!f.skills || f.skills.length === 0))) return "";
  const ar = lang === "ar";
  const title = ar ? "ملف اللغة الإنجليزية (Fluent®)" : "English language profile (Fluent®)";
  const intro = ar
    ? "تحديد مستوى الإنجليزية وفق الإطار الأوروبي المرجعي (CEFR) عبر المهارات الأربع. القراءة والاستماع مُصحَّحة آلياً؛ الكتابة والتحدث مُقيَّمة بالذكاء الاصطناعي وفق معايير CEFR."
    : "CEFR-aligned English placement across the four skills. Reading and listening are auto-scored; writing and speaking are AI-assessed against the CEFR rubric.";
  const overallLabel = ar ? "المستوى الإجمالي" : "Overall level";
  const correctWord = ar ? "إجابة صحيحة" : "correct";
  const skillMap: Record<string, { en: string; ar: string }> = {
    reading: { en: "Reading", ar: "القراءة" },
    listening: { en: "Listening", ar: "الاستماع" },
    writing: { en: "Writing", ar: "الكتابة" },
    speaking: { en: "Speaking", ar: "التحدث" },
  };

  // Overall level: badge + a plain-language descriptor of what the band means.
  const overallDesc = cefrDescriptor(f.overallCefr, ar);
  const overallRow = f.overallCefr
    ? `<div style="margin:0 0 10px;background:#f8fafc;border:1px solid #e3e6ee;border-radius:8px;padding:9px 12px">
         <div style="font-size:12px"><span style="font-weight:700;color:#010131">${overallLabel}:</span> ${cefrBadge(f.overallCefr)}</div>
         ${overallDesc ? `<div style="font-size:10.5px;color:#475569;line-height:1.5;margin-top:4px">${esc(overallDesc)}</div>` : ""}
       </div>`
    : "";

  // One card per skill, with the insight directly under it (not lumped at the end).
  const cards = (f.skills ?? [])
    .map((s) => {
      const nm = ar ? skillMap[s.key]?.ar : skillMap[s.key]?.en;
      const detail =
        s.correct != null && s.total != null
          ? `<span style="font-size:10px;color:#475569;margin-inline-start:8px">${s.correct}/${s.total} ${correctWord}</span>`
          : "";
      const insight = skillInsight(s.key, s.cefr, s.feedback, ar);
      const insightHtml = insight
        ? `<div style="font-size:10.5px;color:#334155;line-height:1.5;margin-top:4px">${esc(insight)}</div>`
        : "";
      return `<div style="border:1px solid #e3e6ee;border-radius:8px;padding:8px 12px;margin-bottom:7px;background:#fbfcfe;page-break-inside:avoid">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div style="font-size:11.5px;font-weight:700;color:#010131">${esc(nm ?? s.key)}${detail}</div>
          <div>${cefrBadge(s.cefr)}</div>
        </div>${insightHtml}</div>`;
    })
    .join("");

  // CEFR radar chart - the centrepiece of the English section: overall level
  // first, then the radar large and centred in its own card. The caption notes
  // the dashed B2 ring (the professional working threshold).
  const radar = cefrRadar(f.skills ?? [], ar);
  const radarCaption = ar
    ? "الحلقة المتقطعة تمثّل المستوى B2 - الحد العملي المهني."
    : "The dashed ring marks B2 - the professional working threshold.";
  const topBlock = radar
    ? `${overallRow}
       <div style="border:1px solid #e3e6ee;border-radius:9px;background:#fbfcfe;padding:16px 12px 8px;margin:0 0 10px;text-align:center;page-break-inside:avoid">
         ${radar}
         <div style="font-size:9.5px;color:#94a3b8;margin-top:2px;padding-bottom:4px">${radarCaption}</div>
       </div>`
    : overallRow;

  const banner = stageBanner(
    ar ? "تفاصيل المرحلة" : "Stage detail",
    ar ? "الإنجليزية (Fluent®)" : "English (Fluent®)",
    title
  );
  return `${banner}
    <p class="muted" style="margin:0 0 8px;color:#555;font-size:11px">${intro}</p>
    ${topBlock}
    ${cards}`;
}

/** Bilingual provisional strip for the two Pre-Hire report bodies. */
function provisionalStrip(data: PrehireReportData, lang: Lang): string {
  if (!data.provisional) return "";
  const ar = lang === "ar";
  const title = PROVISIONAL_COPY[ar ? "ar" : "en"].title;
  const body = PROVISIONAL_COPY[ar ? "ar" : "en"].body;
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
  ${stageCardsHtml(data.stages, t, rtl)}
  ${competenciesSection(data, lang)}
  ${englishSection(data, lang)}
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

  // CBI (AI interview) - elaborated to match the depth of the quiz / English
  // sections: a BARS 1-5 scale visual, a band-aware "what this means" read, the
  // strengths / development areas as lists, then the full transcript.
  let cbiSection = "";
  if (data.cbi) {
    const c = data.cbi;
    const b = typeof c.bars === "number" ? c.bars : null;
    const key = b == null ? "none" : b >= 4 ? "strong" : b === 3 ? "competent" : "developing";
    const tn =
      key === "strong" ? { fg: "#067647", bg: "#e8f5ee", bd: "#b6e2c8", fill: "#12805c" }
      : key === "competent" ? { fg: "#b25e09", bg: "#fef6e7", bd: "#f5d9a8", fill: "#d08214" }
      : key === "developing" ? { fg: "#b42318", bg: "#fdeef0", bd: "#f5c6cb", fill: "#d1493c" }
      : { fg: "#64748b", bg: "#f1f5f9", bd: "#e2e8f0", fill: "#cbd5e1" };
    const scale =
      b == null
        ? ""
        : `<div style="display:flex;gap:3px;max-width:190px;margin-top:7px">${[1, 2, 3, 4, 5]
            .map((i) => `<div style="flex:1;height:9px;border-radius:2px;background:${i <= b ? tn.fill : "#eef2f7"}"></div>`)
            .join("")}</div>`;
    const meansMap: Record<string, string> = rtl
      ? {
          strong: "قدّم المرشح أدلّة سلوكية قوية على هذه الكفاءة في المقابلة - نقطة قوة واضحة.",
          competent: "استوفى المرشح المعيار السلوكي المتوقّع - كفؤ مع مجال للتعميق.",
          developing: "كانت الأدلّة السلوكية دون المعيار المتوقّع - يُنصح بالتعمّق فيها في المقابلة البشرية.",
        }
      : {
          strong: "The candidate gave strong behavioural evidence on this competency in the interview - a clear strength.",
          competent: "The candidate met the expected behavioural standard - competent, with room to deepen.",
          developing: "The behavioural evidence was below the expected standard - probe this further at the human interview.",
        };
    const meansTxt = meansMap[key] ?? "";
    const meansLbl2 = rtl ? "ماذا يعني هذا" : "What this means";
    const meansHtml = meansTxt
      ? `<div style="margin-top:9px;background:${tn.bg};border:1px solid ${tn.bd};border-radius:6px;padding:7px 10px;font-size:10.5px;color:${tn.fg}"><span style="font-weight:700">${meansLbl2}: </span>${esc(meansTxt)}</div>`
      : "";
    const listBlock = (label: string, items: string[]) =>
      items.length
        ? `<div style="margin-top:9px"><div style="font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;font-weight:700;margin-bottom:3px">${label}</div><ul style="margin:0;padding-inline-start:16px">${items
            .map((x) => `<li style="font-size:10.5px;color:#334155;line-height:1.5;margin-bottom:1px">${esc(x)}</li>`)
            .join("")}</ul></div>`
        : "";
    cbiSection = `
  ${stageBanner(
    rtl ? "تفاصيل المرحلة" : "Stage detail",
    rtl ? "المقابلة بالذكاء الاصطناعي (CBI)" : "AI Interview (CBI)",
    t.cbiTitle
  )}
  <p class="muted" style="margin:0 0 10px;color:#555;font-size:11px">${t.cbiIntro}</p>
  <div class="cbi-assess">
    ${c.ratingLabel ? `<div><span class="cbi-k">${t.cbiAiRating}:</span> <b style="color:${tn.fg}">${esc(c.ratingLabel)}</b>${b != null ? ` (${b}/5)` : ""}</div>${scale}` : scale}
    ${c.rationale ? `<div style="margin-top:9px"><span class="cbi-k">${t.cbiRationale}:</span> ${esc(c.rationale)}</div>` : ""}
    ${meansHtml}
    ${listBlock(t.cbiStrengths, c.strengths)}
    ${listBlock(t.cbiDev, c.developmentAreas)}
  </div>
  <div class="cbi-tx-title">${t.cbiTranscript}</div>
  <div class="cbi-tx">
    ${c.exchanges
      .map(
        (m) =>
          `<div class="cbi-turn ${m.who}"><div class="cbi-who">${m.who === "candidate" ? t.cbiCandidate : t.cbiInterviewer}</div><div class="cbi-text">${esc(m.text)}</div></div>`
      )
      .join("")}
  </div>
  <p class="muted" style="margin-top:8px;font-size:9.5px;font-style:italic">${t.cbiAiNote}</p>`;
  }

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
    <div class="stat" style="display:flex;gap:12px;align-items:center">
      ${compositeDonut(data.composite, tone.fg)}
      <div>
        <div class="l">${t.composite}</div>
        <div class="stat-def">${t.compositeDef}</div>
      </div>
    </div>
    <div class="stat">
      <div class="l" style="margin-bottom:6px">${t.advisory}</div>
      <span class="reco" style="background:${tone.bg};color:${tone.fg}">${recoLabel}</span>
    </div>
  </div>

  ${resultSummary(data, lang, recoLabel)}

  <h2>${t.perStage}</h2>
  ${stageCardsHtml(data.stages, t, rtl)}

  ${competenciesSection(data, lang)}

  ${englishSection(data, lang)}

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
