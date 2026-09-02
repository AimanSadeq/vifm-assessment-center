import {
  ARA_INDIVIDUAL_FACTORS,
  ARA_INDIVIDUAL_FACTOR_IDS,
  ARA_FACTOR_TONES,
  getFactorTone,
  getIndividualMaturityStage,
  type AraIndividualFactorId,
  type AraIndividualMaturityStageId,
  type AraTalentLens,
} from "@/lib/constants/ara-individual-factors";
import type { PersonalAnalysis, DevelopmentAnalysis, AnalysisBlock } from "@/lib/ara/personal-analysis";
import { VIFM_VERTICAL_LABELS, type VifmVertical } from "@/types/database";
import { fitScoreOutOfTen } from "@/lib/recommender/format";
import { personalFactSheetRows } from "@/lib/reports/fact-sheet-content";
import {
  FACTOR_GUIDANCE, FACTOR_GUIDANCE_AR,
  STAGE_NEXT_STEPS, STAGE_NEXT_STEPS_AR,
  STAGE_RANGE_EN, STAGE_RANGE_AR,
} from "@/lib/reports/personal-report-copy";

/**
 * Personal AI-readiness report - ONE HTML renderer for both languages.
 *
 * Replaces two renderers that had drifted apart (React-PDF for English,
 * Puppeteer HTML for Arabic). Both languages now come from this file and are
 * printed through Chromium, the way every organisational report already is,
 * so the Arabic edition is no longer a poorer cousin and the layout cannot
 * fork again.
 *
 * The layout follows the structure the client preferred in the August sample
 * - executive summary, factor cards with sub-scores, strengths against
 * priorities, a 30/60/90 plan, a comparison against the unit and the
 * organisation, training, and a manager conversation guide - re-based on the
 * four factors the instrument actually measures. Nothing here is invented:
 * every number is computed by the builder from the respondent's answers and
 * the cohorts they belong to.
 */

export type Lang = "en" | "ar";

export type FactorSubScores = {
  /** Mean of the self-rating (Likert) items. */
  self: number | null;
  /** Mean of the scenario / knowledge items - deep-dive tier only. */
  demonstrated: number | null;
};

export type CohortComparison = {
  label: string;
  overall: number | null;
  byFactor: Partial<Record<AraIndividualFactorId, number>>;
  respondents: number;
};

export type RecommendedCourseView = {
  course_id: string;
  title_en: string;
  title_ar: string | null;
  code: string | null;
  vertical: string;
  level: string;
  duration_label: string;
  total_score: number;
  drivers: Array<{ label: string; label_ar?: string | null; gap: number; relevance: 1 | 2 | 3 }>;
};

export type PersonalReportData = {
  lang: Lang;
  respondentName: string;
  respondentEmail: string | null;
  roleLabel: string | null;
  unitLabel: string | null;
  parentUnitLabel: string | null;
  orgName: string | null;
  isSample: boolean;
  generatedAt: string;
  tier: "snapshot" | "deep_dive";
  overallScore: number;
  factorScores: Record<AraIndividualFactorId, number>;
  subScores: Record<AraIndividualFactorId, FactorSubScores>;
  /** null when the sitting was standalone (no cohort to compare against). */
  unit: CohortComparison | null;
  org: CohortComparison | null;
  talentLens: AraTalentLens | null;
  analysis: PersonalAnalysis | null;
  devAnalysis: DevelopmentAnalysis | null;
  recommendedCourses: RecommendedCourseView[];
  provisional: boolean;
};

// ── helpers ─────────────────────────────────────────────────────────────

const esc = (s: string | null | undefined) =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const f1 = (n: number) => n.toFixed(1);
/** Two decimals where two numbers are set side by side - at one decimal 3.45 and 3.55 both print as 3.5 and the sentence "below the unit average" reads as a contradiction. */
const f2 = (n: number) => n.toFixed(2);
const pct = (n: number) => `${Math.max(0, Math.min(100, (n / 5) * 100)).toFixed(0)}%`;

const TONE_STYLE: Record<ReturnType<typeof getFactorTone>, { bg: string; fg: string; bar: string; stage: AraIndividualMaturityStageId }> = {
  strong:      { bg: "#dcfce7", fg: "#166534", bar: "#059669", stage: "embedded" },
  developing:  { bg: "#fef3c7", fg: "#92400e", bar: "#D97706", stage: "practising" },
  opportunity: { bg: "#fee2e2", fg: "#991b1b", bar: "#DC2626", stage: "emerging" },
};

const pick = (b: AnalysisBlock | null | undefined, lang: Lang) => (b ? (lang === "ar" ? b.ar : b.en) : "");

/** The GROW paragraph is one string; split it into its four stems for a list. */
function growStems(text: string, lang: Lang): string[] {
  const re = lang === "ar"
    ? /(?=الهدف:|الواقع:|الخيارات:|الإرادة:|الالتزام:)/
    : /(?=Goal:|Reality:|Options:|Will:)/;
  const parts = text.split(re).map((s) => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts.slice(parts[0].match(/^(For a|لمحادثة)/) ? 1 : 0) : [text];
}

const T = (lang: Lang, en: string, ar: string) => (lang === "ar" ? ar : en);
const titleCase = (s: string) => s.replace(/(^|[\s_-])([a-z])/g, (_, sp, ch) => sp.replace("_", " ") + ch.toUpperCase());
/** A course tagged to two competencies under the SAME factor came back with the factor listed twice; keep one per label at its strongest relevance. */
function dedupeDrivers<D extends { label: string; relevance: number }>(drivers: D[]): D[] {
  const best = new Map<string, D>();
  for (const d of drivers) { const cur = best.get(d.label); if (!cur || d.relevance > cur.relevance) best.set(d.label, d); }
  return [...best.values()];
}

// ── render ──────────────────────────────────────────────────────────────

export function renderPersonalReportHtml(d: PersonalReportData): string {
  const L = d.lang;
  const rtl = L === "ar";
  const stage = getIndividualMaturityStage(d.overallScore);
  const stageName = rtl ? stage.name_ar : stage.name_en;
  const stageTone = TONE_STYLE[getFactorTone(d.overallScore)];
  const factors = ARA_INDIVIDUAL_FACTORS;
  const name = (id: AraIndividualFactorId) => {
    const f = factors.find((x) => x.id === id)!;
    return rtl ? f.name_ar : f.name_en;
  };
  const ranked = [...ARA_INDIVIDUAL_FACTOR_IDS].sort((a, b) => d.factorScores[b] - d.factorScores[a]);
  const strongest = ranked[0], weakest = ranked[ranked.length - 1];
  const acquisition = d.talentLens === "acquisition" && !!d.analysis;
  const nextSteps = (rtl ? STAGE_NEXT_STEPS_AR : STAGE_NEXT_STEPS)[stage.id];
  const range = (rtl ? STAGE_RANGE_AR : STAGE_RANGE_EN);

  const ident = [d.roleLabel, d.unitLabel, d.parentUnitLabel].filter(Boolean).map(esc).join(" · ");
  const ident2 = [
    d.orgName ? esc(d.orgName) : null,
    d.isSample ? T(L, "Sample data", "بيانات توضيحية") : null,
    esc(d.generatedAt),
  ].filter(Boolean).join(" · ");

  // ── executive summary
  const execLead = acquisition
    ? pick(d.analysis!.verdict, L)
    : T(L,
        `${esc(d.respondentName)} sits at the <b>${esc(stageName)}</b> level overall (${f1(d.overallScore)}/5). <b>${esc(name(strongest))} is the clearest strength (${f1(d.factorScores[strongest])}/5)</b>, while <b>${esc(name(weakest))} carries the largest gap (${f1(d.factorScores[weakest])}/5)</b>. ${esc(pick(d.devAnalysis?.headline, L))}`,
        `يقع ${esc(d.respondentName)} عند مستوى <b>${esc(stageName)}</b> إجمالاً (${f1(d.overallScore)}/5). <b>${esc(name(strongest))} هو أوضح نقاط القوة (${f1(d.factorScores[strongest])}/5)</b>، بينما <b>${esc(name(weakest))} يحمل أكبر فجوة (${f1(d.factorScores[weakest])}/5)</b>. ${esc(pick(d.devAnalysis?.headline, L))}`
      );
  const levelBox = T(L,
    `<b>What "${esc(stageName)}" means.</b> ${esc(stage.blurb_en)} <b>What good looks like next:</b> ${esc(nextSteps.bullets[0])}`,
    `<b>ماذا يعني مستوى "${esc(stageName)}".</b> ${esc(stage.blurb_ar)} <b>كيف تبدو الخطوة التالية:</b> ${esc(nextSteps.bullets[0])}`
  );

  // ── factor cards
  const cards = factors.map((f) => {
    const s = d.factorScores[f.id];
    const toneId = getFactorTone(s);
    const tone = TONE_STYLE[toneId];
    const toneLabel = rtl ? ARA_FACTOR_TONES[toneId].ar : ARA_FACTOR_TONES[toneId].en;
    const guidance = (rtl ? FACTOR_GUIDANCE_AR : FACTOR_GUIDANCE)[f.id][tone.stage];
    const sub = d.subScores[f.id];
    const subRows = sub.demonstrated != null && sub.self != null
      ? `<div class="sublbl">${T(L, "Sub-scores", "الدرجات الفرعية")}</div>
         ${subRow(T(L, "Self-rated", "التقييم الذاتي"), sub.self)}
         ${subRow(T(L, "Demonstrated", "الأداء الفعلي"), sub.demonstrated)}`
      : "";
    return `
      <div class="ccard">
        <div class="eyebrow small">${esc(f.domain)}</div>
        <div class="cctop"><span class="ccname">${esc(rtl ? f.name_ar : f.name_en)}</span>
          <span class="ccpill" style="background:${tone.bg};color:${tone.fg}">${esc(toneLabel)}</span></div>
        <div class="ccscore" style="color:${tone.bar}">${f1(s)}<small> / 5</small></div>
        <div class="bar" style="height:10px"><span style="width:${pct(s)};background:${tone.bar}"></span></div>
        <p class="ccdesc">${esc(rtl ? f.description_ar : f.description_en)}</p>
        ${subRows}
        <div class="sublbl">${T(L, "Where to focus next", "ركّز هنا تالياً")}</div>
        <p class="ccguide">${esc(guidance)}</p>
        <p class="ccmap">${T(L, "Maps to VIFM AC", "يرتبط بكفاءات مركز تقييم VIFM")}: ${f.ac_competency_names.map(esc).join(" · ")}</p>
      </div>`;
  }).join("");

  function subRow(label: string, v: number) {
    const tone = TONE_STYLE[getFactorTone(v)];
    return `<div class="subrow"><span class="sn">${esc(label)}</span><div class="bar" style="height:7px"><span style="width:${pct(v)};background:${tone.bar}"></span></div><span class="sv">${f1(v)}</span></div>`;
  }

  // ── strengths / priorities (development) or analysis (acquisition)
  let leftCol = "", rightCol = "";
  if (acquisition) {
    const a = d.analysis!;
    leftCol = `<h2 class="good">${T(L, "Strengths", "نقاط القوة")}</h2>` +
      a.strengths.map((s) => `<p><b>${esc(name(s.factorId))} (${f1(s.score)}/5).</b> ${esc(pick(s.read, L))}</p>`).join("");
    rightCol = `<h2 class="warn">${T(L, "Areas to probe", "مجالات تحتاج إلى تقصٍّ")}</h2><div class="priogrid">` +
      a.developmentAreas.map((s) => `<div class="prio"><div class="ptitle">${esc(name(s.factorId))} <span class="pmeta">${f1(s.score)}/5</span></div><p>${esc(pick(s.read, L))}</p><ul class="actions"><li>${esc(pick(s.probe, L))}</li></ul></div>`).join("") + `</div>`;
  } else if (d.devAnalysis) {
    const da = d.devAnalysis;
    leftCol = `<h2 class="good">${T(L, "Your strengths", "نقاط قوتك")}</h2><div class="two">` +
      `<div class="col">${da.strengths.map((s) => `<p><b>${esc(name(s.factorId))} (${f1(s.score)}/5).</b> ${esc(pick(s.read, L))}</p>`).join("")}</div>` +
      `<div class="col">${da.calibration ? `<p class="calib"><b>${T(L, "Your self-view vs your answers.", "نظرتك لنفسك مقابل إجاباتك.")}</b> ${esc(pick(da.calibration, L))}</p>` : ""}</div></div>`;
    rightCol = `<h2 class="warn">${T(L, "Development priorities", "أولويات التطوير")}</h2><div class="priogrid">` +
      da.priorities.map((p, i) => `
        <div class="prio">
          <div class="ptitle">${i + 1}. ${esc(name(p.factorId))} <span class="pmeta">${f1(p.score)}/5${p.gapToTarget > 0 ? ` · ${T(L, "gap", "الفجوة")} ${f1(p.gapToTarget)}` : ""}</span></div>
          <p><b>${T(L, "Why now:", "لماذا الآن:")}</b> ${esc(pick(p.whyNow, L))}</p>
          <ul class="actions"><li>${esc(pick(p.action, L))}</li></ul>
          <p class="builds">${T(L, "Builds", "يبني")}: ${p.acCompetencies.map(esc).join(" · ")}</p>
        </div>`).join("") +
      `</div><p class="seq">${esc(pick(da.sequencingNote, L))}</p>`;
  }

  // ── 30 / 60 / 90 - composed from the ranked priorities and the stage plan
  // The priorities already carry the full 70/20/10 action text; the plan is
  // the SEQUENCE - what starts when - so each milestone takes the first step
  // of a priority rather than repeating the whole block verbatim.
  const prios = d.devAnalysis?.priorities ?? [];
  const firstStep = (b: AnalysisBlock) => {
    const t = pick(b, L).replace(/^[^:]{0,40}\(70%\):\s*/, "");
    const cut = t.search(/\.\s/);
    return (cut > 40 ? t.slice(0, cut + 1) : t).trim();
  };
  const day30 = prios[0]
    ? `${T(L, "Start on", "ابدأ بـ")} ${name(prios[0].factorId)}: ${firstStep(prios[0].action)}`
    : nextSteps.bullets[0];
  const day60 = prios[1]
    ? `${T(L, "Keep the first habit going and add", "حافظ على العادة الأولى وأضف")} ${name(prios[1].factorId)}: ${firstStep(prios[1].action)}`
    : nextSteps.bullets[1];
  const day90 = `${nextSteps.bullets[2]} ${T(L, "Re-take the snapshot to measure the movement.", "أعد اللقطة لقياس التقدّم.")}`;
  const plan = acquisition ? "" : `
    <h2>${T(L, "Your 30 / 60 / 90-day plan", "خطتك لـ 30 / 60 / 90 يوماً")}</h2>
    <div class="miles">
      ${mile("30", T(L, "First 30 days", "أول 30 يوماً"), day30)}
      ${mile("60", T(L, "By day 60", "بحلول اليوم 60"), day60)}
      ${mile("90", T(L, "By day 90", "بحلول اليوم 90"), day90)}
    </div>`;
  function mile(n: string, t: string, b: string) {
    return `<div class="mile"><div class="mday">${n}</div><div><div class="mt">${esc(t)}</div><div class="mb">${esc(b)}</div></div></div>`;
  }

  // ── how you compare
  const cmpRows: string[] = [];
  const cmpRow = (label: string, v: number) => {
    const tone = TONE_STYLE[getFactorTone(v)];
    return `<div class="cmprow"><span class="cmplbl">${esc(label)}</span><div class="bar" style="height:11px"><span style="width:${pct(v)};background:${tone.bar}"></span></div><span class="cmpval">${f2(v)}</span></div>`;
  };
  cmpRows.push(cmpRow(T(L, "This employee", "هذا الموظف"), d.overallScore));
  // Unit/org rows compare on the same 2dp the note uses.
  if (d.unit?.overall != null) cmpRows.push(cmpRow(`${d.unit.label} (${T(L, "unit avg", "متوسط الوحدة")}, n=${d.unit.respondents})`, d.unit.overall));
  if (d.org?.overall != null) cmpRows.push(cmpRow(`${d.org.label} (${T(L, "org avg", "متوسط المنظمة")}, n=${d.org.respondents})`, d.org.overall));
  let benchNote: string;
  if (d.unit?.overall == null && d.org?.overall == null) {
    benchNote = T(L,
      "No cohort comparison is available: this snapshot was taken on its own, not as part of a departmental engagement.",
      "لا تتوفر مقارنة مع مجموعة: أُخذت هذه اللقطة بمفردها وليس ضمن تقييم إداري.");
  } else {
    const rel = (v: number | null | undefined, lbl: string) => {
      if (v == null) return "";
      const diff = d.overallScore - v;
      const word = Math.abs(diff) < 0.05 ? T(L, "level with", "على مستوى") : diff > 0 ? T(L, "above", "أعلى من") : T(L, "below", "أدنى من");
      return `${word} ${lbl} (${f2(v)})`;
    };
    const bits = [rel(d.unit?.overall, T(L, "the unit average", "متوسط الوحدة")), rel(d.org?.overall, T(L, "the organisation average", "متوسط المنظمة"))].filter(Boolean);
    // Which factor explains the gap: the largest deficit vs the unit.
    let driver = "";
    if (d.unit) {
      let worst: AraIndividualFactorId | null = null, worstDiff = 0;
      for (const id of ARA_INDIVIDUAL_FACTOR_IDS) {
        const u = d.unit.byFactor[id];
        if (u == null) continue;
        const diff = d.factorScores[id] - u;
        if (diff < worstDiff) { worstDiff = diff; worst = id; }
      }
      if (worst) driver = T(L, ` - the difference is driven mostly by ${name(worst)} (${f2(d.factorScores[worst])} vs ${f2(d.unit.byFactor[worst]!)}).`,
                              ` - يعود الفارق في معظمه إلى ${name(worst)} (${f2(d.factorScores[worst])} مقابل ${f2(d.unit.byFactor[worst]!)}).`);
    }
    benchNote = `${T(L, "Overall readiness", "الجاهزية الإجمالية")} (${f2(d.overallScore)}) ${T(L, "sits", "تقع")} ${bits.join(T(L, " and ", " و"))}${driver || "."}`;
  }
  const compare = `
    <h2>${T(L, "How you compare", "المقارنة المرجعية")}</h2>
    <div class="bench">${cmpRows.join("")}</div>
    <p class="benchnote">${esc(benchNote)}</p>`;

  // ── training
  const top = d.recommendedCourses[0]?.total_score ?? 0;
  const courses = acquisition || d.recommendedCourses.length === 0 ? "" : `
    <h2>${T(L, "Recommended VIFM training", "برامج VIFM التدريبية الموصى بها")}</h2>
    <div class="courses">
      ${d.recommendedCourses.slice(0, 4).map((c) => {
        const high = c.total_score >= 4;
        const vert = VIFM_VERTICAL_LABELS[c.vertical as VifmVertical] ?? c.vertical;
        return `<div class="course">
          <div class="ctop"><span class="cname">${esc(rtl && c.title_ar ? c.title_ar : c.title_en)}${c.code ? ` <span class="ccode">${esc(c.code)}</span>` : ""}</span>
            <span class="cfit" style="background:${high ? "#dcfce7" : "#fef3c7"};color:${high ? "#166534" : "#92400e"}">${high ? T(L, "HIGH FIT", "ملاءمة عالية") : T(L, "FIT", "ملاءمة")} ${fitScoreOutOfTen(c.total_score, top)}/10</span></div>
          <div class="cmeta">${esc(vert)} · ${esc(titleCase(c.level))} · ${esc(c.duration_label)}</div>
          <p class="cwhy">${dedupeDrivers(c.drivers).map((dr) => `${esc(rtl && dr.label_ar ? dr.label_ar : dr.label)} · ${T(L, "gap", "فجوة")} ${f1(dr.gap)} · ×${dr.relevance}`).join("&nbsp;&nbsp;|&nbsp;&nbsp;")}</p>
        </div>`;
      }).join("")}
    </div>`;

  // ── manager guide + reflect
  const guide = acquisition ? "" : d.devAnalysis ? `
    <div class="two">
      <div class="col"><h2>${T(L, "Manager conversation guide", "دليل حوار المدير")}</h2>
        <ul class="guide">${growStems(pick(d.devAnalysis.managerPrompts, L), L).map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>
      <div class="col"><h2>${T(L, "Reflect & commit", "تأمّل والتزم")}</h2>
        <p class="reflect">${esc(pick(d.devAnalysis.reflection, L))}</p>
        <p class="reflect muted">${esc(pick(d.devAnalysis.cadence, L))}</p></div>
    </div>` : "";

  const guardrail = acquisition ? `<p class="lead">${esc(pick(d.analysis!.guardrail, L))}</p>` : (d.devAnalysis ? `<p class="framing">${esc(pick(d.devAnalysis.framing, L))}</p>` : "");

  // ── fact sheet / method
  const facts = personalFactSheetRows(L).map((r) => `<div class="factrow"><span class="fk">${esc(r.label)}</span><span class="fv">${esc(r.value)}</span></div>`).join("");
  const provisional = d.provisional ? `<div class="prov"><b>${T(L, "Provisional results", "نتائج أولية")}</b> - ${T(L, "some items answered are still pending subject-matter review; treat these results as indicative until that review completes.", "بعض البنود المجابة لا تزال قيد مراجعة الخبراء؛ تعامل مع هذه النتائج كمؤشر أولي حتى تكتمل المراجعة.")}</div>` : "";

  const title = T(L, "Detailed Individual Report", "التقرير الفردي المفصّل");

  return `<!doctype html>
<html lang="${L}" dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"/>
<title>${esc(title)} · ${esc(d.respondentName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&family=Noto+Naskh+Arabic:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
  :root{--navy:#010131;--navy2:#121232;--accent:#5391D5;--accent-deep:#2f6fb8;--ink:#121232;--muted:#5b6472;--line:#e5e9f0}
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:A4;margin:13mm 13mm 15mm}
  body{color:var(--ink);font-family:${rtl ? "'Noto Naskh Arabic','Segoe UI',Tahoma,sans-serif" : "'Open Sans','Segoe UI',system-ui,sans-serif"};font-size:10.5pt;line-height:1.5;background:#fff}
  .eyebrow{font-size:8pt;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-deep);font-weight:800;margin-bottom:4px}
  .eyebrow.small{font-size:7pt;margin-bottom:2px;color:var(--muted)}
  .rhead{display:flex;justify-content:space-between;align-items:flex-start;gap:16pt;border-bottom:2px solid var(--navy);padding-bottom:12pt;margin-bottom:4pt}
  h1{font-size:21pt;font-weight:800;color:var(--navy);letter-spacing:-.01em;line-height:1.15}
  .ident{font-size:10.5pt;font-weight:600;margin-top:3pt}.ident2{font-size:9pt;color:var(--muted);margin-top:2pt}
  .rhead-r{text-align:center;flex:0 0 auto;background:linear-gradient(155deg,var(--navy),var(--navy2));color:#fff;border-radius:10pt;padding:10pt 14pt;min-width:100pt}
  .ovlbl{font-size:7.5pt;text-transform:uppercase;letter-spacing:.08em;opacity:.75;font-weight:700}
  .ovnum{font-size:30pt;font-weight:800;line-height:1.1}.ovnum small{font-size:11pt;opacity:.6;font-weight:600}
  .ovband{display:inline-block;font-size:8.5pt;font-weight:800;padding:2pt 9pt;border-radius:100pt;margin-top:3pt}
  h2{font-size:12.5pt;font-weight:800;color:var(--navy);margin:16pt 0 8pt;break-after:avoid}h2.good{color:#166534}h2.warn{color:#92400e}
  p{color:#26303f}
  .lead{font-size:10.5pt;background:#f6f9fd;border-inline-start:3px solid var(--accent);border-radius:4pt;padding:10pt 12pt;margin-bottom:8pt}
  .levelbox{font-size:9.5pt;color:#334155;border:1px solid var(--line);border-radius:6pt;padding:9pt 11pt;background:#fbfcfe}
  .framing{font-size:9pt;color:var(--muted);margin-top:6pt}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:10pt}
  .ccard{border:1px solid var(--line);border-radius:8pt;padding:10pt;break-inside:avoid}
  .cctop{display:flex;justify-content:space-between;align-items:center;gap:6pt}
  .ccname{font-size:10.5pt;font-weight:800;color:var(--navy)}
  .ccpill{font-size:7.5pt;font-weight:800;padding:2pt 7pt;border-radius:100pt;white-space:nowrap}
  .ccscore{font-size:21pt;font-weight:800;margin-top:4pt}.ccscore small{font-size:9pt;color:var(--muted);font-weight:600}
  .bar{border-radius:5pt;background:#eef2f7;overflow:hidden;margin:5pt 0}.bar>span{display:block;height:100%;border-radius:5pt}
  .ccdesc{font-size:8.5pt;color:var(--muted);line-height:1.45;margin-top:3pt}
  .ccguide{font-size:8.5pt;color:#26303f;line-height:1.45}
  .ccmap{font-size:7.5pt;color:var(--muted);margin-top:5pt}
  .sublbl{font-size:7pt;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:7pt 0 3pt;border-top:1px solid var(--line);padding-top:6pt}
  .subrow{display:flex;align-items:center;gap:6pt;margin-bottom:3pt;font-size:8pt}
  .subrow .sn{width:64pt;flex:0 0 auto;color:var(--muted)}.subrow .bar{flex:1;margin:0}.subrow .sv{width:20pt;text-align:end;font-weight:700;font-variant-numeric:tabular-nums}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:16pt;break-inside:avoid}
  .band{break-inside:avoid}
  .priogrid{display:grid;grid-template-columns:1fr 1fr;gap:8pt;align-items:start}
  .col p{font-size:9.5pt;margin-bottom:6pt}
  .calib{font-size:9pt;color:#334155;border-top:1px dashed var(--line);padding-top:6pt}
  .prio{border:1px solid var(--line);border-radius:6pt;padding:8pt 10pt;margin-bottom:7pt;background:#fbfcfe;break-inside:avoid}
  .ptitle{font-size:10pt;font-weight:800;color:var(--navy)}.pmeta{font-size:8.5pt;color:var(--muted);font-weight:600}
  .prio p{font-size:9pt;margin-top:3pt}
  .actions{margin:4pt 0 0;padding-inline-start:14pt}.actions li{font-size:9pt;color:#334155;margin-bottom:3pt;line-height:1.45}
  .builds{font-size:7.5pt;color:var(--muted)}.seq{font-size:8.5pt;color:var(--muted);margin-top:4pt}
  .miles{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10pt}
  .mile{display:flex;gap:8pt;border:1px solid var(--line);border-radius:6pt;padding:9pt 10pt;background:#fbfcfe;break-inside:avoid}
  .mday{font-size:18pt;font-weight:800;color:var(--accent);line-height:1;flex:0 0 auto}
  .mt{font-size:9.5pt;font-weight:800;color:var(--navy)}.mb{font-size:8.5pt;color:#334155;line-height:1.4;margin-top:2pt}
  .bench{display:flex;flex-direction:column;gap:7pt;border:1px solid var(--line);border-radius:8pt;padding:11pt;break-inside:avoid}
  .cmprow{display:flex;align-items:center;gap:8pt}.cmplbl{width:200pt;flex:0 0 auto;font-size:9pt;font-weight:600}.cmprow .bar{flex:1;margin:0}.cmpval{width:28pt;text-align:end;font-weight:800;font-variant-numeric:tabular-nums}
  .benchnote{font-size:9pt;color:var(--muted);margin-top:6pt;line-height:1.5}
  .courses{display:flex;flex-direction:column;gap:7pt}
  .course{border:1px solid var(--line);border-radius:8pt;padding:9pt 11pt;background:#fbfcfe;break-inside:avoid}
  .ctop{display:flex;justify-content:space-between;align-items:center;gap:8pt}.cname{font-size:10pt;font-weight:800;color:var(--navy)}
  .ccode{font-size:7.5pt;color:var(--muted);font-weight:600;font-family:Consolas,monospace}
  .cfit{font-size:7.5pt;font-weight:800;padding:2pt 8pt;border-radius:100pt;white-space:nowrap}.cmeta{font-size:8.5pt;color:var(--muted);font-weight:600}
  .cwhy{font-size:8.5pt;color:#334155;margin-top:3pt;line-height:1.5}
  .guide{margin:0;padding-inline-start:14pt}.guide li{font-size:9pt;color:#334155;margin-bottom:5pt;line-height:1.5}
  .reflect{font-size:9pt;color:#334155;line-height:1.5}.muted{color:var(--muted)}
  .method{margin-top:18pt;border-top:1px solid var(--line);padding-top:10pt;font-size:8.5pt;color:var(--muted);line-height:1.55;break-inside:avoid}
  .factrow{display:flex;gap:8pt;margin-bottom:3pt}.fk{width:90pt;flex:0 0 auto;font-weight:700;color:#334155}.fv{flex:1}
  .prov{font-size:9pt;background:#fffbeb;border:1px solid #FBBF24;border-radius:6pt;padding:7pt 10pt;margin-bottom:10pt;color:#78350f}
  .legend{font-size:8.5pt;color:var(--muted);margin-top:6pt}
  .footer{margin-top:10pt;font-size:7.5pt;color:var(--muted);display:flex;justify-content:space-between}
</style></head>
<body>
  ${provisional}
  <div class="rhead">
    <div>
      <div class="eyebrow">VIFM AI Readiness Compass · ${esc(title)}</div>
      <h1>${esc(d.respondentName)}</h1>
      ${ident ? `<div class="ident">${ident}</div>` : ""}
      <div class="ident2">${ident2}</div>
    </div>
    <div class="rhead-r">
      <div class="ovlbl">${T(L, "Overall readiness", "الجاهزية الإجمالية")}</div>
      <div class="ovnum">${f1(d.overallScore)}<small> / 5</small></div>
      <div class="ovband" style="background:${stageTone.bg};color:${stageTone.fg}">${esc(stageName)}</div>
    </div>
  </div>

  <h2>${T(L, "Executive summary", "الملخّص التنفيذي")}</h2>
  <p class="lead">${execLead}</p>
  <div class="levelbox">${levelBox}</div>
  ${guardrail}

  <h2>${T(L, "Where you stand - by factor", "نتيجتك - حسب العامل")}</h2>
  <div class="cards">${cards}</div>
  <p class="legend">${T(L, "Overall stage", "المستوى الإجمالي")}: ${(["emerging","practising","embedded"] as AraIndividualMaturityStageId[]).map((id) => {
    const st = getIndividualMaturityStage(id === "emerging" ? 1 : id === "practising" ? 3 : 4);
    return `<b>${esc(rtl ? st.name_ar : st.name_en)}</b> (${esc(range[id])}): ${esc(rtl ? st.definition_ar : st.definition_en)}`;
  }).join(" · ")}. ${T(L, "Per-factor bands", "نطاقات العوامل")}: ${(["opportunity","developing","strong"] as const).map((t) => `${esc(rtl ? ARA_FACTOR_TONES[t].ar : ARA_FACTOR_TONES[t].en)} ${t === "opportunity" ? "1.0-2.9" : t === "developing" ? "3.0-3.9" : "4.0-5.0"}`).join(" · ")}.</p>

  <div class="band">${leftCol}</div>
  <div class="prios">${rightCol}</div>

  ${plan}
  ${compare}
  ${courses}
  ${guide}

  <div class="method">
    ${facts}
    <div class="footer"><span>${T(L, "Generated", "أُنشئ في")} ${esc(d.generatedAt)}</span><span>Virginia Institute of Finance and Management</span></div>
  </div>
</body></html>`;
}
