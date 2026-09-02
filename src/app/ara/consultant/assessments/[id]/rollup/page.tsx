import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentCaller, isInternalAraRender } from "@/lib/ara/auth-guards";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { BackLink } from "@/components/shared/back-link";
import { ARA_PILLARS, ARA_MATURITY_LEVELS } from "@/lib/constants/ara-pillars";
import { ARA_STAGE_MAP } from "@/lib/constants/ara-stages";
import { ARA_INDIVIDUAL_FACTORS } from "@/lib/constants/ara-individual-factors";
import { computeUnitRollup, UNEVEN_THRESHOLD, levelForScore, type RollupUnit } from "@/lib/ara/unit-rollup";
import { computeWorkforceReadiness } from "@/lib/ara/workforce-readiness";
import { recommendCoursesForAraAssessment } from "@/lib/recommender/courses";
import { maturityLadder, retentionYears } from "@/lib/reports/fact-sheet-content";
import { MaturityGauge } from "../report/_components/maturity-gauge";
import { PillarProfileChart } from "../report/_components/report-charts";
import { SectionHeader, StatTile, FindingsPanel, Callout, TOKENS } from "../report/_components/report-primitives";
import { SpreadChart, AgendaMatrix, MultiRadar, FactorBars, SERIES_COLORS, scoreColor } from "./_components/rollup-charts";
import { RollupRoadmap, ActionCard, type Horizon } from "./_components/rollup-roadmap";
import { PILLAR_SCOPE, situationFor, situationLabel, situationExplains, consolidationActions, consolidationFactRows } from "./_components/rollup-copy";
import type { AraAssessment, AraOrganization, AraPillarId } from "@/types/ara";
import "../report/report.css";

export const dynamic = "force-dynamic";

const TARGET = 4.0;
type Lang = "en" | "ar";

// Unquoted family names on purpose: a quoted string inside a <style> child is
// HTML-escaped by the server and not by the client, which produced a hydration
// error that the dev overlay then printed INTO the PDF. Multi-word families
// are valid CSS identifiers unquoted.
const ARABIC_FONT_CSS = ".report-body-wrap, .report-page, .report-page * { font-family: Noto Naskh Arabic, Segoe UI, Tahoma, sans-serif; }";

/**
 * Cross-unit consolidation report - the Division / Enterprise deliverable, in
 * English or Arabic (?lang=ar).
 *
 * A unit's own report answers "how ready is this department". This answers
 * the question a single unit cannot: which units are behind, where they
 * differ, and which gaps are shared (fix once, centrally) versus uneven (move
 * capability between units). It reuses the units' already-computed pillar
 * scores, so it can never disagree with the reports underneath it.
 *
 * Client instruction (2026-09-02): bring it to the same standard as the
 * department and individual reports - diagrams, colour, depth - and keep every
 * page DYNAMIC. Sections that have no data behind them do not render: the
 * division drill-down only under an enterprise, the workforce page only when
 * a unit ran the individual layer, the training page only when the
 * recommender returns courses. Page count therefore grows with the scope
 * (one deep-dive page per pillar in scope).
 */
export default async function AraRollupReportPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { bare?: string; weight?: string; lang?: string };
}) {
  const bare = searchParams?.bare === "1";
  const weighting = searchParams?.weight === "equal" ? "equal" : "respondents";
  const lang: Lang = searchParams?.lang === "ar" ? "ar" : "en";
  const rtl = lang === "ar";
  const T = (en: string, ar: string) => (rtl ? ar : en);
  const sb = createServiceClient();

  const { data: assessment } = await sb
    .from("ara_assessments")
    .select("*, organization:ara_organizations(id, name, name_ar, region, sector)")
    .eq("id", params.id)
    .maybeSingle<
      AraAssessment & {
        organization: Pick<AraOrganization, "id" | "name" | "name_ar" | "region" | "sector"> | null;
      }
    >();
  if (!assessment) return notFound();

  // Same ownership rule as the unit report: the layout gates role, this gates
  // the row. The PDF route authorizes first and marks its render internal.
  const internalRender = await isInternalAraRender();
  if (!internalRender) {
    const caller = await getCurrentCaller();
    if (caller && caller.role !== "admin" && assessment.consultant_id !== caller.uid) {
      return notFound();
    }
  }

  const rollup = await computeUnitRollup(assessment.id, weighting);
  const orgName = (rtl ? assessment.organization?.name_ar : null) || assessment.organization?.name || T("Organisation", "المنظمة");
  const stageDef = ARA_STAGE_MAP[assessment.engagement_stage];
  const stageLabel = (rtl ? stageDef?.label_ar : stageDef?.label_en) ?? assessment.engagement_stage;
  const stageLower = rtl ? stageLabel : stageLabel.toLowerCase();
  const reportDate = new Date().toLocaleDateString(rtl ? "ar-AE" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const pillarName = (id: string) => {
    const p = ARA_PILLARS.find((x) => x.id === id);
    return p ? (rtl ? p.name_ar : p.name_en) : id;
  };
  const levelLabel = (lvl: number) => {
    const l = ARA_MATURITY_LEVELS.find((x) => x.level === lvl);
    return l ? (rtl ? l.label_ar : l.label_en) : "";
  };
  const levelText = (s: number | null | undefined) => (s == null ? T("Not scored", "لم تُحتسب") : `L${levelForScore(s)} ${levelLabel(levelForScore(s))}`);
  const pctOfTarget = (s: number) => Math.round((s / TARGET) * 100);
  const region = assessment.region === "saudi" ? T("Saudi Arabia", "المملكة العربية السعودية") : T("United Arab Emirates", "الإمارات العربية المتحدة");

  // Arabic needs a shaping-capable webfont in Chromium; the English report
  // uses the stylesheet's Open Sans stack. Same approach as the personal report.
  const arabicFont = rtl ? (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- print-only report page, loaded once per render */}
      <link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&display=swap" rel="stylesheet" />
      <style>{ARABIC_FONT_CSS}</style>
    </>
  ) : null;

  if (rollup.units.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto" dir={rtl ? "rtl" : "ltr"}>
        {arabicFont}
        {!bare && <BackLink href={`/ara/consultant/assessments/${assessment.id}`} label={T("Back to assessment", "العودة إلى التقييم")} />}
        <h1 className="text-2xl font-semibold mt-4" style={{ color: TOKENS.navy }}>
          {T("No units linked yet", "لم تُربط أي وحدات بعد")}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {T(
            "A rollup compares the units beneath it - the departments in a division, or the divisions in an enterprise. Link at least two units on the assessment page, then this report will show how they compare. With one unit there is nothing to compare, and its own report already says everything this one could.",
            "يقارن التقرير الموحّد الوحدات التابعة له - الإدارات ضمن القطاع، أو القطاعات ضمن المنشأة. اربط وحدتين على الأقل من صفحة التقييم ليعرض هذا التقرير المقارنة بينها. مع وحدة واحدة لا يوجد ما يُقارَن، وتقريرها الخاص يقول كل ما يمكن أن يقوله هذا التقرير."
          )}
        </p>
      </div>
    );
  }

  // ─── Derived data ───
  const scoredUnits = rollup.units.filter((u) => u.overall != null);
  const strongest = scoredUnits[0];
  const weakest = scoredUnits[scoredUnits.length - 1];
  const unitName = (u: { label: string; label_ar: string }) => (rtl ? u.label_ar : u.label);
  const byLabel = new Map(rollup.units.map((u) => [u.label, u]));
  const localiseUnit = (label: string | null) => (label && byLabel.get(label) ? unitName(byLabel.get(label)!) : label ?? "");
  const top = rollup.unevenPillars[0];
  const shared = rollup.sharedGaps;
  const hasDivisions = rollup.units.some((u) => u.children.length > 0);
  const leafWord = (n: number) => T(n === 1 ? "department" : "departments", n === 1 ? "إدارة" : "إدارات");
  const unitWord = (n: number) => (hasDivisions ? T(n === 1 ? "division" : "divisions", n === 1 ? "قطاع" : "قطاعات") : T(n === 1 ? "department" : "departments", n === 1 ? "إدارة" : "إدارات"));

  // Pillar means split like the unit report's executive summary.
  const pillarMeans = rollup.spreads.map((s) => ({ id: s.pillar_id, label: pillarName(s.pillar_id), score: s.mean }));
  const strengths = pillarMeans.filter((p) => p.score >= TARGET);
  const approaching = pillarMeans.filter((p) => p.score >= 3.0 && p.score < TARGET);
  const gaps = pillarMeans.filter((p) => p.score < 3.0);

  // Leaves: the sittings that actually have respondents (departments), for the
  // workforce and training pages.
  const leaves: RollupUnit[] = [];
  const collect = (units: RollupUnit[]) => units.forEach((u) => (u.children.length > 0 ? collect(u.children) : leaves.push(u)));
  collect(rollup.units);
  const { data: leafRows } = await sb
    .from("ara_assessments")
    .select("id, include_individual_layer")
    .in("id", leaves.map((l) => l.assessment_id));
  const withLayer = new Set(
    ((leafRows ?? []) as Array<{ id: string; include_individual_layer: boolean | null }>).filter((r) => r.include_individual_layer).map((r) => r.id)
  );
  type Wf = NonNullable<Awaited<ReturnType<typeof computeWorkforceReadiness>>>;
  const workforce: Array<{ unit: RollupUnit; wf: Wf }> = [];
  for (const l of leaves.filter((x) => withLayer.has(x.assessment_id))) {
    const wf = await computeWorkforceReadiness(l.assessment_id);
    if (wf && wf.completed_count > 0) workforce.push({ unit: l, wf });
  }
  const wfTotal = workforce.reduce((a, w) => a + w.wf.completed_count, 0);
  const wfFactorMean = (factorId: string) => {
    let sum = 0, n = 0;
    for (const w of workforce) {
      const f = w.wf.factor_averages.find((x) => x.factor_id === factorId);
      if (f && f.respondent_count > 0) { sum += f.average * f.respondent_count; n += f.respondent_count; }
    }
    return n > 0 ? sum / n : null;
  };
  const wfOverall = (() => {
    let sum = 0, n = 0;
    for (const w of workforce) if (w.wf.cohort_overall != null) { sum += w.wf.cohort_overall * w.wf.completed_count; n += w.wf.completed_count; }
    return n > 0 ? sum / n : null;
  })();

  // Training: each leaf's recommender output, pooled by course. A course
  // recommended to several units is the one worth running centrally.
  type Pooled = { code: string | null; title: string; days: number; score: number; units: string[]; drivers: string[] };
  const pooled = new Map<string, Pooled>();
  for (const l of leaves) {
    const courses = await recommendCoursesForAraAssessment({ assessmentId: l.assessment_id, limit: 8, client: sb }).catch(() => []);
    for (const c of courses) {
      const cur = pooled.get(c.course_id) ?? { code: c.course_code, title: (rtl && c.title_ar) || c.title_en, days: c.default_duration_days, score: 0, units: [], drivers: [] };
      cur.score += c.total_score;
      cur.units.push(unitName(l));
      for (const d of c.drivers.slice(0, 2)) if (!cur.drivers.includes(d.label)) cur.drivers.push(d.label);
      pooled.set(c.course_id, cur);
    }
  }
  const training = [...pooled.values()].sort((a, b) => b.units.length - a.units.length || b.score - a.score).slice(0, 6);

  // Agenda: situation per pillar scored by at least one unit.
  const situations = rollup.spreads.map((s) => ({ s, situation: situationFor(s.sharedGap, s.spread, UNEVEN_THRESHOLD) }));
  const roadmapItems: Array<{ name: string; detail: string; horizon: Horizon; rank: number }> = [];
  const centralPillars = situations.filter((x) => x.situation === "central").map((x) => pillarName(x.s.pillar_id));
  // Owners: one row per shared gap when there are few, one combined row when
  // there are many - the roadmap has to fit its page whatever the scope.
  if (centralPillars.length >= 3) {
    roadmapItems.push({ name: T(`Name one owner per shared gap (${centralPillars.length})`, `تعيين مالك لكل فجوة مشتركة (${centralPillars.length})`), detail: centralPillars.join(rtl ? "، " : ", "), horizon: "quick", rank: 0 });
  }
  for (const { s, situation } of situations) {
    const p = pillarName(s.pillar_id);
    if (situation === "central") {
      if (centralPillars.length < 3) roadmapItems.push({ name: T(`Name the owner: ${p}`, `تعيين المالك: ${p}`), detail: T("Central programme", "برنامج مركزي"), horizon: "quick", rank: 0 });
      roadmapItems.push({ name: T(`Central standard: ${p}`, `معيار مركزي: ${p}`), detail: T("Every unit inherits it", "ترثه كل الوحدات"), horizon: "build", rank: 0 });
    } else if (situation === "lift") {
      roadmapItems.push({ name: T(`Playbook from ${localiseUnit(s.strongest)}: ${p}`, `دليل من ${localiseUnit(s.strongest)}: ${p}`), detail: T("Lift the rest", "رفع البقية"), horizon: "quick", rank: 1 });
      roadmapItems.push({ name: T(`Floor + pairing: ${p}`, `حد أدنى وإقران: ${p}`), detail: T(`Start with ${localiseUnit(s.weakest)}`, `ابدأ بـ${localiseUnit(s.weakest)}`), horizon: "build", rank: 1 });
    } else if (situation === "move") {
      roadmapItems.push({ name: T(`Transfer plan: ${p}`, `خطة نقل: ${p}`), detail: T(`${localiseUnit(s.strongest)} to ${localiseUnit(s.weakest)}`, `من ${localiseUnit(s.strongest)} إلى ${localiseUnit(s.weakest)}`), horizon: "build", rank: 2 });
    } else {
      roadmapItems.push({ name: T(`Extend to 4.00: ${p}`, `التوسّع نحو 4.00: ${p}`), detail: T("Through the units' own plans", "عبر خطط الوحدات نفسها"), horizon: "transform", rank: 4 });
    }
  }
  if (rollup.uncoveredPillars.length > 0) {
    roadmapItems.push({ name: T(`Assess at ${stageLower} level: ${rollup.uncoveredPillars.length} uncovered pillar${rollup.uncoveredPillars.length === 1 ? "" : "s"}`, `تقييم على مستوى ${stageLabel}: ${rollup.uncoveredPillars.length} ${rollup.uncoveredPillars.length === 1 ? "ركيزة غير مغطاة" : "ركائز غير مغطاة"}`), detail: rollup.uncoveredPillars.map(pillarName).join(rtl ? "، " : ", "), horizon: "quick", rank: 3 });
  }
  if (situations.some((x) => x.situation === "central" || x.situation === "lift")) {
    roadmapItems.push({ name: T("Re-measure every unit", "إعادة قياس كل الوحدات"), detail: T("Report the spread, not the mean", "ارفع التفاوت لا المتوسط"), horizon: "transform", rank: 5 });
  }
  const HORIZON_ORDER: Record<Horizon, number> = { quick: 0, build: 1, transform: 2 };
  const roadmap = roadmapItems.sort((a, b) => HORIZON_ORDER[a.horizon] - HORIZON_ORDER[b.horizon] || a.rank - b.rank).slice(0, 10);
  const roadmapCounts = { quick: roadmap.filter((r) => r.horizon === "quick").length, build: roadmap.filter((r) => r.horizon === "build").length, transform: roadmap.filter((r) => r.horizon === "transform").length };

  // Radar: at most six polygons stay readable. Beyond that, the three
  // strongest and three weakest units - the ends of the range are the story.
  const radarUnits = scoredUnits.length <= 6 ? scoredUnits : [...scoredUnits.slice(0, 3), ...scoredUnits.slice(-3)];

  const cellFor = (score: number | undefined) => {
    if (score == null) return { background: "#f9fafb", color: "#cbd5e1", border: "1px solid #f1f5f9" };
    const level = levelForScore(score);
    const tint: Record<number, { bg: string; fg: string }> = {
      1: { bg: "#FB7185", fg: "white" },
      2: { bg: "#fdd9c7", fg: "#374151" },
      3: { bg: "#fef3c7", fg: "#374151" },
      4: { bg: "#a7f3d0", fg: "#065f46" },
      5: { bg: "#12805c", fg: "white" },
    };
    const t = tint[level] ?? tint[3];
    return { background: t.bg, color: t.fg, border: "none" };
  };
  const cellHead: React.CSSProperties = { textAlign: rtl ? "right" : "left", padding: "6pt 8pt", fontWeight: 600, fontSize: "9pt", color: "#374151" };
  const cell: React.CSSProperties = { padding: "6pt 8pt", fontSize: "9.5pt", color: "#374151" };
  const eyebrowStyle: React.CSSProperties = { fontSize: "8.5pt", letterSpacing: rtl ? 0 : "0.12em", textTransform: "uppercase", color: TOKENS.mute, fontWeight: 700, margin: "0 0 6pt" };
  const panel: React.CSSProperties = { padding: "12pt 14pt", background: "var(--ara-bg-soft)", border: "1pt solid var(--ara-line)", borderInlineStart: "3pt solid var(--ara-accent)", borderRadius: "6pt" };

  const UnitTable = ({ units, head }: { units: RollupUnit[]; head: string }) => (
    <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "#f3f4f6" }}>
          <th style={cellHead}>{head}</th>
          <th style={cellHead}>{T("Respondents", "المشاركون")}</th>
          <th style={cellHead}>{T("Score", "الدرجة")}</th>
          <th style={cellHead}>{T("% of target", "% من المستهدف")}</th>
          <th style={cellHead}>{T("Maturity", "النضج")}</th>
        </tr>
      </thead>
      <tbody>
        {units.map((u) => (
          <tr key={u.assessment_id} style={{ borderTop: "1px solid #e5e7eb" }}>
            <td style={cell}>
              <strong>{unitName(u)}</strong>
              {u.pooled && <span style={{ color: "#6b7280", fontSize: "8.5pt" }}> ({u.children.length} {T(u.children.length === 1 ? "department" : "departments", u.children.length === 1 ? "إدارة" : "إدارات")})</span>}
            </td>
            <td style={cell}>{u.completed_respondents}</td>
            <td style={{ ...cell, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{u.overall != null ? u.overall.toFixed(2) : "-"}</td>
            <td style={{ ...cell, fontVariantNumeric: "tabular-nums" }}>{u.overall != null ? `${pctOfTarget(u.overall)}%` : "-"}</td>
            <td style={cell}>{levelText(u.overall)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <>
      {arabicFont}
      {!bare && (
        <div className="no-print bg-white border-b px-6 py-3 flex items-center justify-between" dir={rtl ? "rtl" : "ltr"}>
          <BackLink href={`/ara/consultant/assessments/${assessment.id}`} label={T("Back to assessment", "العودة إلى التقييم")} />
          <div className="flex items-center gap-4 text-sm">
            <a className="underline" href={`/api/ara/reports/${assessment.id}/rollup/pdf?language=en`}>Download PDF (English)</a>
            <a className="underline" href={`/api/ara/reports/${assessment.id}/rollup/pdf?language=ar`}>تنزيل PDF (العربية)</a>
          </div>
        </div>
      )}

      <div className={`report-body-wrap ${bare ? "" : "bg-gray-100 py-8"}`} dir={rtl ? "rtl" : "ltr"}>
        {/* ─── Cover ─── */}
        <section className="report-page report-cover flex flex-col justify-between" style={{ background: "#010131", color: "white" }}>
          <div className="flex items-center gap-3">
            <VifmLogo variant="white" size="md" />
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest" style={{ opacity: 0.7 }}>
              {assessment.is_sandbox
                ? T("Confidential - Sample - Not for Client Distribution", "سري - نموذج توضيحي - ليس للتوزيع على العملاء")
                : T("Confidential - For Internal VIFM Use", "سري - للاستخدام الداخلي في VIFM")}
            </p>
            <h1 className="mt-6" style={{ fontSize: "34pt", fontWeight: 700, lineHeight: 1.15 }}>{orgName}</h1>
            <p className="text-lg mt-3" style={{ color: "white", opacity: 0.85 }}>
              {T(`${stageLabel} AI Readiness - Cross-unit consolidation`, `الجاهزية للذكاء الاصطناعي على مستوى ${stageLabel} - التقرير الموحّد بين الوحدات`)}
            </p>
            <p className="text-sm mt-6" style={{ color: "white", opacity: 0.75 }}>
              {rollup.units.length} {unitWord(rollup.units.length)} · {rollup.pillars.length} {T("pillars", "ركائز")} · {rollup.totalRespondents} {T("respondents", "مشاركاً")}
            </p>
          </div>
          <div className="flex justify-between text-xs" style={{ color: "white", opacity: 0.75 }}>
            <div>
              <p>{region}</p>
              <p>{assessment.scope_label ?? stageLabel}</p>
            </div>
            <div style={{ textAlign: rtl ? "left" : "right" }}>
              <p>{T("Report generated", "أُنشئ التقرير في")} {reportDate}</p>
              <p>Virginia Institute of Finance and Management</p>
            </div>
          </div>
        </section>

        {/* ─── Executive summary ─── */}
        <section className="report-page">
          <SectionHeader
            eyebrow={T("Executive summary", "الملخص التنفيذي")}
            title={T("How the units compare", "كيف تتقارن الوحدات")}
            kicker={T(
              "Each unit was assessed separately and has its own report. This document compares them: where they stand together, and where they differ.",
              "قُيِّمت كل وحدة على حدة ولها تقريرها الخاص. تقارن هذه الوثيقة بينها: أين تتفق وأين تختلف."
            )}
          />
          <div className="stat-strip" style={{ marginTop: "16pt" }}>
            <StatTile label={T("Units assessed", "الوحدات المقيَّمة")} value={String(rollup.units.length)} accent={`${rollup.totalRespondents} ${T("respondents", "مشاركاً")}`} accentColor={TOKENS.navy} />
            <StatTile label={T(`${stageLabel} readiness`, `جاهزية ${stageLabel}`)} value={rollup.overall != null ? rollup.overall.toFixed(2) : "-"} accent={rollup.overallBand ? (rtl ? rollup.overallBand.label_ar : rollup.overallBand.label_en) : T("Not yet scored", "لم تُحتسب بعد")} accentColor={TOKENS.navy} />
            <StatTile label={T("Shared gaps", "فجوات مشتركة")} value={String(shared.length)} accent={T("Every unit below 4.00", "كل الوحدات دون 4.00")} accentColor={TOKENS.rose} />
            <StatTile label={T("Uneven pillars", "ركائز متفاوتة")} value={String(rollup.unevenPillars.length)} accent={T(`Units differ by ${UNEVEN_THRESHOLD.toFixed(1)}+`, `تفاوت بمقدار ${UNEVEN_THRESHOLD.toFixed(1)} فأكثر`)} accentColor={TOKENS.amber} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "18pt", marginTop: "18pt", alignItems: "center" }}>
            <div>
              <p style={eyebrowStyle}>{T("Narrative", "القراءة")}</p>
              <p className="report-body">
                {rtl ? (
                  <>
                    عبر {rollup.units.length} {unitWord(rollup.units.length)} و{rollup.totalRespondents} مشاركاً، تسجّل <strong>{orgName}</strong>{" "}
                    <strong>{rollup.overall != null ? rollup.overall.toFixed(2) : "-"} / 5.00</strong>{rollup.overallBand ? ` (${rollup.overallBand.label_ar})` : ""}.
                    {" "}من أصل {pillarMeans.length} ركائز، <strong>{strengths.length}</strong> عند المستهدف أو فوقه، و<strong>{approaching.length}</strong> تقترب منه، و<strong>{gaps.length}</strong> تتطلب تركيزاً.
                    {strongest && weakest && scoredUnits.length > 1 && (<> أقوى الوحدات <strong>{unitName(strongest)}</strong> عند {strongest.overall!.toFixed(2)}؛ وأضعفها <strong>{unitName(weakest)}</strong> عند {weakest.overall!.toFixed(2)}.</>)}
                    {shared.length > 0 && (<> {shared.length} {shared.length === 1 ? "ركيزة تقع" : "ركائز تقع"} دون المستهدف في <em>كل</em> وحدة، بدءاً بـ<strong>{pillarName(shared[0].pillar_id)}</strong>.</>)}
                  </>
                ) : (
                  <>
                    Across {rollup.units.length} {unitWord(rollup.units.length)} and {rollup.totalRespondents} respondents, <strong>{orgName}</strong> scores{" "}
                    <strong>{rollup.overall != null ? rollup.overall.toFixed(2) : "-"} / 5.00</strong>{rollup.overallBand ? ` (${rollup.overallBand.label_en})` : ""}.
                    {" "}Of {pillarMeans.length} pillars, <strong>{strengths.length}</strong> {strengths.length === 1 ? "is" : "are"} at or above the AI Ready target, <strong>{approaching.length}</strong> approaching it, and <strong>{gaps.length}</strong> requiring focus.
                    {strongest && weakest && scoredUnits.length > 1 && (<> The strongest unit is <strong>{unitName(strongest)}</strong> at {strongest.overall!.toFixed(2)}; the weakest is <strong>{unitName(weakest)}</strong> at {weakest.overall!.toFixed(2)}.</>)}
                    {shared.length > 0 && (<> {shared.length} pillar{shared.length === 1 ? " sits" : "s sit"} below target in <em>every</em> unit, starting with <strong>{pillarName(shared[0].pillar_id)}</strong>.</>)}
                  </>
                )}
              </p>
              {top && (
                <p className="report-body" style={{ marginTop: "6pt" }}>
                  {rtl
                    ? <>في <strong>{pillarName(top.pillar_id)}</strong> تتباعد الوحدات بمقدار {top.spread.toFixed(2)} ({localiseUnit(top.weakest)} {top.min.toFixed(2)} إلى {localiseUnit(top.strongest)} {top.max.toFixed(2)}). متوسط واحد لا يصف أياً منهما.</>
                    : <>On <strong>{pillarName(top.pillar_id)}</strong> the units are {top.spread.toFixed(2)} apart ({localiseUnit(top.weakest)} {top.min.toFixed(2)} to {localiseUnit(top.strongest)} {top.max.toFixed(2)}). A single average describes neither.</>}
                </p>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <MaturityGauge score={rollup.overall} lang={lang} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12pt", marginTop: "16pt" }}>
            <FindingsPanel
              variant="strength"
              title={strengths.length > 0 ? T(`At or approaching target (${strengths.length + approaching.length})`, `عند المستهدف أو تقترب منه (${strengths.length + approaching.length})`) : T(`Closest to target (${approaching.length})`, `الأقرب إلى المستهدف (${approaching.length})`)}
              emptyMessage={T("No pillar reached 3.00 across the units.", "لم تبلغ أي ركيزة 3.00 عبر الوحدات.")}
              items={[...strengths, ...approaching].sort((a, b) => b.score - a.score).map((s) => ({ headline: s.label, metric: `${s.score.toFixed(2)} · ${pctOfTarget(s.score)}%` }))}
            />
            <FindingsPanel
              variant="gap"
              title={T(`Requiring focus (${gaps.length})`, `تتطلب تركيزاً (${gaps.length})`)}
              emptyMessage={T("Every pillar averages 3.00 or above.", "متوسط كل ركيزة 3.00 فأعلى.")}
              items={gaps.map((g) => ({ headline: g.label, metric: `${g.score.toFixed(2)} · ${pctOfTarget(g.score)}%` }))}
            />
          </div>
          <p className="report-body report-muted" style={{ fontSize: "8.5pt", marginTop: "12pt" }}>
            {rtl
              ? `درجة ${stageLabel} هي ${rollup.weighting === "respondents" ? "متوسط مرجّح بعدد المشاركين لدرجات الوحدات، فالوحدة الأكبر لها وزن أكبر" : "متوسط بسيط لدرجات الوحدات، فلكل وحدة الوزن نفسه"}. ودرجة كل وحدة هي متوسط الركائز الداخلة في نطاق تلك الوحدة.`
              : `The ${stageLower} score is a ${rollup.weighting === "respondents" ? "respondent-weighted average of the unit scores, so a larger unit counts for more" : "straight average of the unit scores, so every unit counts equally"}. Each unit score is the mean of the pillars in that unit's own scope.`}
          </p>
        </section>

        {/* ─── Reading this report ─── */}
        <section className="report-page">
          <h2 className="report-h2">{T("Reading this report", "قراءة هذا التقرير")}</h2>
          <p className="report-body">
            {T(
              `A ${stageLower} is not assessed as one sitting. Each ${hasDivisions ? "division is pooled from its departments, and each department" : "department"} answered the same instrument separately, was scored on the pillars in its own scope, and received its own report. This document sits above those reports and adds the one thing none of them can contain: the comparison.`,
              `لا يُقيَّم ${stageLabel} في جلسة واحدة. ${hasDivisions ? "يُجمَّع كل قطاع من إداراته، وكل إدارة" : "كل إدارة"} أجابت عن الأداة نفسها على حدة، وقُيِّمت على الركائز الداخلة في نطاقها، وحصلت على تقريرها الخاص. تقع هذه الوثيقة فوق تلك التقارير وتضيف ما لا يمكن لأي منها أن يحويه: المقارنة.`
            )}
          </p>

          <h3 className="report-h3" style={{ marginTop: "14pt" }}>{T("The maturity scale", "مقياس النضج")}</h3>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${ARA_MATURITY_LEVELS.length}, 1fr)`, gap: "6pt", marginTop: "8pt" }}>
            {ARA_MATURITY_LEVELS.map((l) => (
              <div key={l.level} style={{ padding: "8pt", borderRadius: "4pt", background: cellFor(l.min).background, color: cellFor(l.min).color, textAlign: "center" }}>
                <div style={{ fontSize: "12pt", fontWeight: 700 }}>L{l.level}</div>
                <div style={{ fontSize: "9pt", fontWeight: 600 }}>{rtl ? l.label_ar : l.label_en}</div>
                <div style={{ fontSize: "7.5pt", opacity: 0.85 }}>{l.min.toFixed(1)} - {l.max.toFixed(1)}</div>
              </div>
            ))}
          </div>
          <p className="report-body report-muted" style={{ fontSize: "8.5pt", marginTop: "6pt" }}>
            {T("4.00 is the AI Ready target, not the maximum. Colours on every chart in this report follow these five levels.", "4.00 هو مستهدف الجاهزية للذكاء الاصطناعي، لا الحد الأقصى. تتبع الألوان في كل مخططات هذا التقرير هذه المستويات الخمسة.")}
          </p>

          <h3 className="report-h3" style={{ marginTop: "14pt" }}>{T("The two findings only a consolidation can make", "النتيجتان اللتان لا يقدّمهما إلا التقرير الموحّد")}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12pt", marginTop: "8pt" }}>
            <div style={{ ...panel, borderInlineStartColor: TOKENS.rose }}>
              <p style={{ ...eyebrowStyle, color: TOKENS.rose }}>{T("Shared gap", "فجوة مشتركة")}</p>
              <p className="report-body" style={{ margin: 0 }}>
                {T("A pillar below 4.00 in every unit that scored it. Usually structural - policy, platform, standards - and fixed once, centrally. This report found", "ركيزة دون 4.00 في كل وحدة قيّمتها. غالباً هيكلية - سياسات ومنصّات ومعايير - وتُعالَج مرة واحدة مركزياً. وجد هذا التقرير")} <strong>{shared.length}</strong>.
              </p>
            </div>
            <div style={{ ...panel, borderInlineStartColor: TOKENS.amber }}>
              <p style={{ ...eyebrowStyle, color: "#b45309" }}>{T("Uneven pillar", "ركيزة متفاوتة")}</p>
              <p className="report-body" style={{ margin: 0 }}>
                {T(`A pillar where the strongest and weakest unit are ${UNEVEN_THRESHOLD.toFixed(2)} or more apart. Usually capability that exists somewhere and has not travelled. This report found`, `ركيزة تبعد فيها الوحدة الأقوى عن الأضعف ${UNEVEN_THRESHOLD.toFixed(2)} فأكثر. غالباً قدرة موجودة في مكان ما ولم تنتقل. وجد هذا التقرير`)} <strong>{rollup.unevenPillars.length}</strong>.
              </p>
            </div>
          </div>

          <h3 className="report-h3" style={{ marginTop: "14pt" }}>{T("What this document contains", "محتويات هذه الوثيقة")}</h3>
          <ul className="report-body" style={{ margin: "6pt 0 0", paddingInlineStart: "16pt" }}>
            <li>{T("Units ranked on one scale, with the departments inside each division where the scope is an enterprise.", "ترتيب الوحدات على مقياس واحد، مع الإدارات داخل كل قطاع حين يكون النطاق منشأة.")}</li>
            <li>{T("Every unit against every pillar: the matrix, the profile radar and the spread chart.", "كل وحدة مقابل كل ركيزة: المصفوفة، ورادار الملف، ومخطط التفاوت.")}</li>
            <li>{T("The agenda matrix that sorts each pillar into central programme, practice transfer or sustain.", "مصفوفة الأجندة التي تصنّف كل ركيزة إلى برنامج مركزي أو نقل ممارسات أو حفاظ.")}</li>
            <li>{T(`One deep-dive page per pillar (${rollup.pillars.length} in scope), each with actions at ${stageLower} level.`, `صفحة تعمّق لكل ركيزة (${rollup.pillars.length} ضمن النطاق)، ولكل منها إجراءات على مستوى ${stageLabel}.`)}</li>
            {workforce.length > 0 && <li>{T("Workforce readiness across units, where the individual layer ran.", "جاهزية القوى العاملة عبر الوحدات، حيث فُعّلت الطبقة الفردية.")}</li>}
            <li>{T("A twelve-month roadmap, matched VIFM training, next steps and the method.", "خارطة طريق لاثني عشر شهراً، وبرامج VIFM التدريبية المطابقة، والخطوات التالية، والمنهجية.")}</li>
          </ul>
        </section>

        {/* ─── Units ranked ─── */}
        <section className="report-page">
          <h2 className="report-h2">{T("Units ranked", "ترتيب الوحدات")}</h2>
          <p className="report-body">
            {T(
              "Every unit on the same 1.00-5.00 scale, against the 4.00 AI Ready target. Respondents are shown because a score from three people carries less weight than one from forty.",
              "كل وحدة على المقياس نفسه من 1.00 إلى 5.00، مقابل المستهدف 4.00. يُعرض عدد المشاركين لأن درجة من ثلاثة أشخاص أقل وزناً من درجة من أربعين."
            )}
          </p>
          <div dir="ltr" style={{ marginTop: "10pt", breakInside: "avoid" }}>
            <PillarProfileChart items={scoredUnits.map((u) => ({ label: unitName(u), score: u.overall }))} benchmark={TARGET} lang={lang} />
          </div>
          <div style={{ marginTop: "10pt" }}>
            <UnitTable units={rollup.units} head={T("Unit", "الوحدة")} />
          </div>
          {strongest && weakest && scoredUnits.length > 1 && (
            <Callout tone={weakest.overall! < 3.0 ? "warn" : "info"} title={T("What the ranking says", "ما يقوله الترتيب")}>
              {rtl
                ? <>الفارق بين <strong>{unitName(strongest)}</strong> و<strong>{unitName(weakest)}</strong> هو {(strongest.overall! - weakest.overall!).toFixed(2)} نقطة{levelForScore(strongest.overall!) !== levelForScore(weakest.overall!) ? ` - أي مستوى نضج مختلف (${levelText(strongest.overall)} مقابل ${levelText(weakest.overall)})` : " ضمن مستوى النضج نفسه"}. {weakest.overall! < 3.0 ? `تقع ${unitName(weakest)} دون 3.00، فهي أول وحدة يتعامل معها ${stageLabel}.` : `لا تقع أي وحدة دون 3.00؛ العمل هو الوصول إلى 4.00 لا الإنقاذ.`}</>
                : <><strong>{unitName(strongest)}</strong> and <strong>{unitName(weakest)}</strong> are {(strongest.overall! - weakest.overall!).toFixed(2)} apart{levelForScore(strongest.overall!) !== levelForScore(weakest.overall!) ? ` - a different maturity level (${levelText(strongest.overall)} versus ${levelText(weakest.overall)})` : ", inside the same maturity level"}. {weakest.overall! < 3.0 ? `${unitName(weakest)} sits below 3.00 and is the first unit the ${stageLower} attends to.` : "No unit sits below 3.00; the work is reaching 4.00, not rescue."}</>}
            </Callout>
          )}
        </section>

        {/* ─── Drill-down: the departments inside each division (enterprise only) ─── */}
        {hasDivisions && (
          <section className="report-page">
            <h2 className="report-h2">{T("Departments within each division", "الإدارات داخل كل قطاع")}</h2>
            <p className="report-body">
              {T(
                "Each division's score is a respondent-weighted pool of the departments listed here. A division can look average while one department inside it is well ahead and another well behind - this is where that shows.",
                "درجة كل قطاع هي متوسط مرجّح بعدد المشاركين للإدارات المدرجة هنا. قد يبدو القطاع متوسطاً بينما تتقدّم إدارة داخله كثيراً وتتأخر أخرى كثيراً - وهنا يظهر ذلك."
              )}
            </p>
            {rollup.units.filter((u) => u.children.length > 0).map((div) => {
              const kids = [...div.children].sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));
              const best = kids[0], worst = kids[kids.length - 1];
              return (
                <div key={div.assessment_id} style={{ marginTop: "14pt", breakInside: "avoid" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10pt" }}>
                    <h3 className="report-h3" style={{ margin: 0 }}>{unitName(div)}</h3>
                    <span style={{ fontSize: "9pt", color: TOKENS.mute }}>{div.overall != null ? `${div.overall.toFixed(2)} · ${levelText(div.overall)}` : ""} · {div.completed_respondents} {T("respondents", "مشاركاً")}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12pt", marginTop: "6pt", alignItems: "start" }}>
                    <UnitTable units={kids} head={T("Department", "الإدارة")} />
                    <div style={{ ...panel, fontSize: "9.5pt" }}>
                      {kids.length > 1 && best.overall != null && worst.overall != null
                        ? (rtl
                          ? <><strong>{unitName(best)}</strong> تحمل رقم القطاع عند {best.overall.toFixed(2)}؛ و<strong>{unitName(worst)}</strong> تسحبه عند {worst.overall.toFixed(2)}. الفارق {(best.overall - worst.overall).toFixed(2)}{best.overall - worst.overall >= UNEVEN_THRESHOLD ? " - أوسع من مستوى كامل، فمتوسط القطاع لا يصف أياً منهما." : "، ضمن مستوى واحد."}</>
                          : <><strong>{unitName(best)}</strong> carries the division&apos;s number at {best.overall.toFixed(2)}; <strong>{unitName(worst)}</strong> drags it at {worst.overall.toFixed(2)}. The gap is {(best.overall - worst.overall).toFixed(2)}{best.overall - worst.overall >= UNEVEN_THRESHOLD ? " - wider than a full level, so the division mean describes neither." : ", inside one level."}</>)
                        : T("One department scored; the division's number is that department's number.", "إدارة واحدة سجّلت درجة؛ رقم القطاع هو رقم تلك الإدارة.")}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ─── Units x pillars matrix ─── */}
        <section className="report-page">
          <h2 className="report-h2">{T("Units by pillar", "الوحدات حسب الركيزة")}</h2>
          <p className="report-body">
            {T(
              `Every unit against every pillar it was assessed on. Blank means the pillar was not in that unit's scope, which is not the same as a low score. Colour is the maturity level, so a row of green with one red cell is a targeted problem, and a uniformly amber column is a problem the whole ${stageLower} shares.`,
              `كل وحدة مقابل كل ركيزة قُيِّمت عليها. الخلية الفارغة تعني أن الركيزة لم تكن ضمن نطاق تلك الوحدة، وهذا يختلف عن الدرجة المنخفضة. يمثّل اللون مستوى النضج؛ فصفٌّ أخضر بخلية حمراء واحدة مشكلة محدّدة، وعمودٌ كهرماني بالكامل مشكلة يتقاسمها ${stageLabel} كله.`
            )}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: `120pt repeat(${rollup.pillars.length}, 1fr)`, gap: "2pt", marginTop: "14pt", fontSize: "8.5pt" }}>
            <div />
            {rollup.pillars.map((p) => (
              <div key={p} style={{ textAlign: "center", color: "#6b7280", fontSize: "7pt", lineHeight: 1.2, paddingBottom: "3pt" }}>{pillarName(p)}</div>
            ))}
            {rollup.units.map((u) => (
              <div key={u.assessment_id} style={{ display: "contents" }}>
                <div style={{ padding: "6pt 8pt", fontWeight: 500, fontSize: "8.5pt", color: "#374151", background: "#f9fafb", borderRadius: "3pt" }}>{unitName(u)}</div>
                {rollup.pillars.map((p) => {
                  const v = u.byPillar.get(p);
                  return (
                    <div key={`${u.assessment_id}-${p}`} style={{ ...cellFor(v), padding: "6pt", textAlign: "center", borderRadius: "3pt", fontWeight: 600, fontVariantNumeric: "tabular-nums", minHeight: "22pt" }}>
                      {v != null ? v.toFixed(2) : "-"}
                    </div>
                  );
                })}
              </div>
            ))}
            <div style={{ padding: "6pt 8pt", fontWeight: 700, fontSize: "8.5pt", color: TOKENS.navy, borderTop: `1pt solid ${TOKENS.line}` }}>{T("Mean", "المتوسط")}</div>
            {rollup.pillars.map((p) => {
              const s = rollup.spreads.find((x) => x.pillar_id === p);
              return <div key={`mean-${p}`} style={{ padding: "6pt", textAlign: "center", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: TOKENS.navy, borderTop: `1pt solid ${TOKENS.line}` }}>{s ? s.mean.toFixed(2) : "-"}</div>;
            })}
          </div>
          <p className="report-body report-muted" style={{ fontSize: "8pt", marginTop: "10pt" }}>
            {rtl
              ? <>تتراوح الدرجات من <strong>1.00 إلى 5.00</strong>. <strong>4.00 هو مستهدف الجاهزية للذكاء الاصطناعي، وليس الحد الأقصى</strong> - يقع المستوى الرابع «{levelLabel(4)}» (4.00-4.44) والخامس «{levelLabel(5)}» (4.50-5.00) فوقه.</>
              : <>Scores run <strong>1.00 to 5.00</strong>. <strong>4.00 is the AI Ready target, not the maximum</strong> - L4 {levelLabel(4)} (4.00-4.44) and L5 {levelLabel(5)} (4.50-5.00) sit above it.</>}
          </p>
          {rollup.uncoveredPillars.length > 0 && (
            <Callout tone="warn" title={T("Not assessed at this level", "لم تُقيَّم على هذا المستوى")}>
              {rtl
                ? <>{rollup.uncoveredPillars.map(pillarName).join("، ")} ضمن نطاق {stageLabel} لكن لم تغطِّها أي وحدة تابعة - فهذه الركائز تُحدَّد عادةً فوق مستوى الوحدة المفردة. لم تُجمع أي أدلة، وهذا يختلف عن عدم وجود فجوة. قيِّمها على مستوى {stageLabel} لاكتمال الصورة.</>
                : <>{rollup.uncoveredPillars.map(pillarName).join(", ")} {rollup.uncoveredPillars.length === 1 ? "is" : "are"} in the {stageLower}&apos;s scope but {rollup.uncoveredPillars.length === 1 ? "was" : "were"} not covered by any unit beneath it - these are typically set above the individual unit. No evidence was collected, which is not the same as no gap. Assess {rollup.uncoveredPillars.length === 1 ? "it" : "them"} at {stageLower} level to complete the picture.</>}
            </Callout>
          )}
        </section>

        {/* ─── Profiles and spread ─── */}
        <section className="report-page">
          <h2 className="report-h2">{T("Where the units differ", "أين تختلف الوحدات")}</h2>
          <p className="report-body">
            {T(
              "The radar overlays each unit's pillar profile on the 4.00 ring; the shape says whether a unit is uniformly behind or strong in some places and weak in others. The spread chart below turns the same data into the range between the weakest and strongest unit on every pillar, with the mean marked.",
              "يضع الرادار ملف ركائز كل وحدة فوق حلقة 4.00؛ ويقول الشكل إن كانت الوحدة متأخرة بانتظام أم قوية في مواضع وضعيفة في أخرى. ويحوّل مخطط التفاوت أدناه البيانات نفسها إلى المدى بين الوحدة الأضعف والأقوى في كل ركيزة، مع تعليم المتوسط."
            )}
          </p>
          <div dir="ltr" style={{ display: "flex", justifyContent: "center", marginTop: "6pt" }}>
            <MultiRadar
              axes={rollup.pillars.map((p) => ({ id: p, label: pillarName(p) }))}
              series={radarUnits.map((u, i) => ({ label: unitName(u), color: SERIES_COLORS[i % SERIES_COLORS.length], values: Object.fromEntries([...u.byPillar.entries()]) }))}
              target={TARGET}
              size={330}
              lang={lang}
            />
          </div>
          {scoredUnits.length > 6 && (
            <p className="report-body report-muted" style={{ fontSize: "8pt", textAlign: "center" }}>
              {T(`Showing the three strongest and three weakest of ${scoredUnits.length} units; the matrix on the previous page carries all of them.`, `تُعرض الوحدات الثلاث الأقوى والثلاث الأضعف من أصل ${scoredUnits.length}؛ وتحمل مصفوفة الصفحة السابقة الوحدات جميعاً.`)}
            </p>
          )}
          <h3 className="report-h3" style={{ marginTop: "10pt" }}>{T("Spread by pillar", "التفاوت حسب الركيزة")}</h3>
          <div dir="ltr">
          <SpreadChart
            rows={rollup.spreads.map((s) => ({ label: pillarName(s.pillar_id), min: s.min, max: s.max, mean: s.mean, unitsScored: s.unitsScored, sharedGap: s.sharedGap, uneven: s.spread >= UNEVEN_THRESHOLD }))}
            target={TARGET}
            lang={lang}
          />
          </div>
          <p className="report-body report-muted" style={{ fontSize: "8pt", marginTop: "4pt" }}>
            {T("Range bars: red = shared gap (every unit below 4.00), amber = uneven (units a level or more apart), blue = neither. The white marker is the mean.", "أشرطة المدى: أحمر = فجوة مشتركة (كل الوحدات دون 4.00)، كهرماني = متفاوتة (الوحدات متباعدة مستوى فأكثر)، أزرق = لا هذا ولا ذاك. العلامة البيضاء هي المتوسط.")}
          </p>
        </section>

        {/* ─── Shared gaps, uneven pillars, agenda matrix ─── */}
        <section className="report-page">
          <h2 className="report-h2">{T("Shared gaps and uneven pillars", "الفجوات المشتركة والركائز المتفاوتة")}</h2>
          <p className="report-body">
            {T(
              "This is the finding a single unit's report cannot produce. A gap every unit shares is usually structural and is fixed once, centrally. A pillar where the units are far apart is usually capability that already exists somewhere in the organisation and has not travelled.",
              "هذه هي النتيجة التي لا يستطيع تقرير وحدة واحدة إنتاجها. الفجوة التي تتقاسمها كل الوحدات غالباً هيكلية وتُعالَج مرة واحدة مركزياً. أما الركيزة التي تتباعد فيها الوحدات فغالباً قدرة موجودة أصلاً في مكان ما من المنظمة ولم تنتقل بعد."
            )}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14pt", marginTop: "10pt" }}>
            <div>
              <h3 className="report-h3" style={{ marginTop: 0 }}>{T("Shared gaps", "الفجوات المشتركة")} ({shared.length})</h3>
              {shared.length === 0 ? (
                <p className="report-body report-muted">{T("No pillar is below target in every unit. Each gap belongs to specific units, so the work is targeted rather than central.", "لا توجد ركيزة دون المستهدف في كل الوحدات. كل فجوة تخص وحدات بعينها، فالعمل موجَّه لا مركزي.")}</p>
              ) : (
                <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ background: "#f3f4f6" }}><th style={cellHead}>{T("Pillar", "الركيزة")}</th><th style={cellHead}>{T("Mean", "المتوسط")}</th><th style={cellHead}>{T("Best unit", "أفضل وحدة")}</th></tr></thead>
                  <tbody>
                    {shared.map((s) => (
                      <tr key={s.pillar_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={cell}><strong>{pillarName(s.pillar_id)}</strong></td>
                        <td style={{ ...cell, fontVariantNumeric: "tabular-nums" }}>{s.mean.toFixed(2)}</td>
                        <td style={cell}>{localiseUnit(s.strongest)} ({s.max.toFixed(2)})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <h3 className="report-h3" style={{ marginTop: 0 }}>{T("Uneven pillars", "الركائز المتفاوتة")} ({rollup.unevenPillars.length})</h3>
              {rollup.unevenPillars.length === 0 ? (
                <p className="report-body report-muted">{T(`No pillar shows a spread of ${UNEVEN_THRESHOLD.toFixed(1)} or more between units. The ${stageLower} average is a fair description of all of them.`, `لا توجد ركيزة يبلغ التفاوت فيها ${UNEVEN_THRESHOLD.toFixed(1)} فأكثر. متوسط ${stageLabel} وصف عادل لها جميعاً.`)}</p>
              ) : (
                <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ background: "#f3f4f6" }}><th style={cellHead}>{T("Pillar", "الركيزة")}</th><th style={cellHead}>{T("Spread", "التفاوت")}</th><th style={cellHead}>{T("Strongest / weakest", "الأقوى / الأضعف")}</th></tr></thead>
                  <tbody>
                    {rollup.unevenPillars.map((s) => (
                      <tr key={s.pillar_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={cell}><strong>{pillarName(s.pillar_id)}</strong></td>
                        <td style={{ ...cell, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{s.spread.toFixed(2)}</td>
                        <td style={{ ...cell, fontSize: "8.5pt" }}>{localiseUnit(s.strongest)} {s.max.toFixed(2)} / {localiseUnit(s.weakest)} {s.min.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <h3 className="report-h3" style={{ marginTop: "14pt" }}>{T("The agenda matrix", "مصفوفة الأجندة")}</h3>
          <p className="report-body" style={{ marginBottom: "4pt" }}>
            {T(
              "Each pillar placed by whether every unit is below 4.00 (right half: a shared gap) or at least one unit has reached it (left half), and by how far apart the units are (up). Bottom-right needs one central programme; top-right needs the leading unit's practice plus a central floor; top-left needs a transfer and no new spend; bottom-left is sustained through the units' own plans.",
              "تُوضع كل ركيزة بحسب ما إذا كانت كل الوحدات دون 4.00 (النصف الأيمن: فجوة مشتركة) أو بلغت وحدة واحدة على الأقل المستهدف (النصف الأيسر)، وبحسب تباعد الوحدات (عمودياً). أسفل اليمين يحتاج برنامجاً مركزياً واحداً؛ أعلى اليمين يحتاج ممارسة الوحدة الرائدة مع حد أدنى مركزي؛ أعلى اليسار يحتاج نقلاً دون إنفاق جديد؛ وأسفل اليسار يُحافَظ عليه عبر خطط الوحدات."
            )}
          </p>
          <div dir="ltr" style={{ display: "flex", justifyContent: "center", breakInside: "avoid" }}>
            <AgendaMatrix points={rollup.spreads.map((s) => ({ label: pillarName(s.pillar_id), mean: s.mean, spread: s.spread, sharedGap: s.sharedGap }))} unevenThreshold={UNEVEN_THRESHOLD} target={TARGET} lang={lang} />
          </div>
        </section>

        {/* ─── Pillar deep dives - one page per pillar in scope ─── */}
        {situations.map(({ s, situation }, idx) => {
          const p = pillarName(s.pillar_id);
          const unitScores = rollup.units.filter((u) => u.byPillar.has(s.pillar_id)).map((u) => ({ u, v: u.byPillar.get(s.pillar_id)! })).sort((a, b) => b.v - a.v);
          const atTarget = unitScores.filter((x) => x.v >= TARGET).length;
          const below3 = unitScores.filter((x) => x.v < 3.0);
          const actions = consolidationActions({ pillar: p, situation, strongest: localiseUnit(s.strongest), weakest: localiseUnit(s.weakest), stage: stageLabel, lang });
          const tone = situation === "central" ? "danger" : situation === "lift" ? "warn" : situation === "move" ? "info" : "success";
          return (
            <section key={s.pillar_id} className="report-page">
              <SectionHeader
                eyebrow={T(`Pillar deep dive · ${idx + 1} of ${situations.length}`, `تعمّق في الركيزة · ${idx + 1} من ${situations.length}`)}
                title={p}
                kicker={rtl ? PILLAR_SCOPE[s.pillar_id as AraPillarId]?.ar : PILLAR_SCOPE[s.pillar_id as AraPillarId]?.en}
              />
              <div className="stat-strip">
                <StatTile label={T("Mean across units", "المتوسط عبر الوحدات")} value={s.mean.toFixed(2)} accent={levelText(s.mean)} accentColor={scoreColor(s.mean)} />
                <StatTile label={T("Spread", "التفاوت")} value={s.spread.toFixed(2)} accent={s.spread >= UNEVEN_THRESHOLD ? T("Uneven", "متفاوتة") : T("Consistent", "متّسقة")} accentColor={s.spread >= UNEVEN_THRESHOLD ? TOKENS.amber : TOKENS.emerald} />
                <StatTile label={T("Units at target", "وحدات عند المستهدف")} value={String(atTarget)} suffix={`/ ${s.unitsScored}`} accent={s.sharedGap ? T("Shared gap", "فجوة مشتركة") : T("At least one unit is there", "وحدة واحدة على الأقل بلغته")} accentColor={s.sharedGap ? TOKENS.rose : TOKENS.emerald} />
                <StatTile label={T("Agenda", "الأجندة")} value={situationLabel(situation, lang)} accent={T("From the agenda matrix", "من مصفوفة الأجندة")} accentColor={TOKENS.navy} />
              </div>
              <div dir="ltr" style={{ marginTop: "12pt", breakInside: "avoid" }}>
                <PillarProfileChart items={unitScores.map((x) => ({ label: unitName(x.u), score: x.v }))} benchmark={TARGET} lang={lang} />
              </div>
              <p className="report-body" style={{ marginTop: "8pt" }}>
                {rtl ? (
                  <>
                    قيّمت {s.unitsScored} {unitWord(s.unitsScored)} هذه الركيزة. تتصدّر <strong>{localiseUnit(s.strongest)}</strong> عند {s.max.toFixed(2)}{s.unitsScored > 1 && <> وتتأخر <strong>{localiseUnit(s.weakest)}</strong> عند {s.min.toFixed(2)}</>}.
                    {below3.length > 0 ? <> {below3.length} {below3.length === 1 ? "وحدة تقع" : "وحدات تقع"} دون 3.00: {below3.map((x) => unitName(x.u)).join("، ")}.</> : <> لا تقع أي وحدة دون 3.00.</>}
                    {" "}{situationExplains(situation, lang)}
                  </>
                ) : (
                  <>
                    {s.unitsScored} {unitWord(s.unitsScored)} scored this pillar. <strong>{localiseUnit(s.strongest)}</strong> leads at {s.max.toFixed(2)}{s.unitsScored > 1 && <>; <strong>{localiseUnit(s.weakest)}</strong> trails at {s.min.toFixed(2)}</>}.
                    {below3.length > 0 ? <> {below3.length} unit{below3.length === 1 ? " sits" : "s sit"} below 3.00: {below3.map((x) => unitName(x.u)).join(", ")}.</> : <> No unit sits below 3.00.</>}
                    {" "}{situationExplains(situation, lang)}
                  </>
                )}
              </p>
              <Callout tone={tone} title={T(`${stageLabel}-level actions`, `إجراءات على مستوى ${stageLabel}`)}>
                {T("Three actions chosen by the pillar's position on the agenda matrix. Each unit's own report carries its unit-level actions; these are the ones only the level above can take.", "ثلاثة إجراءات محدّدة بموقع الركيزة في مصفوفة الأجندة. يحمل تقرير كل وحدة إجراءاتها على مستوى الوحدة؛ وهذه هي الإجراءات التي لا يتخذها إلا المستوى الأعلى.")}
              </Callout>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10pt" }}>
                {actions.map((a, i) => <ActionCard key={i} index={i + 1} {...a} lang={lang} />)}
              </div>
            </section>
          );
        })}

        {/* ─── Workforce readiness across units (individual layer) ─── */}
        {workforce.length > 0 && (
          <section className="report-page">
            <SectionHeader
              eyebrow={T("Individual layer", "الطبقة الفردية")}
              title={T("Workforce readiness across units", "جاهزية القوى العاملة عبر الوحدات")}
              kicker={T(`${workforce.length} of ${leaves.length} ${leafWord(leaves.length)} ran the individual layer; ${wfTotal} people completed it.`, `${workforce.length} من ${leaves.length} ${leafWord(leaves.length)} فعّلت الطبقة الفردية؛ أكملها ${wfTotal} شخصاً.`)}
            />
            <div className="stat-strip">
              <StatTile label={T("Workforce overall", "الإجمالي للقوى العاملة")} value={wfOverall != null ? wfOverall.toFixed(2) : "-"} accent={T("Four-factor mean, respondent-weighted", "متوسط العوامل الأربعة مرجّحاً بالمشاركين")} accentColor={wfOverall != null ? scoreColor(wfOverall) : TOKENS.navy} />
              {ARA_INDIVIDUAL_FACTORS.slice(0, 3).map((f) => {
                const m = wfFactorMean(f.id);
                return <StatTile key={f.id} label={rtl ? f.name_ar : f.name_en} value={m != null ? m.toFixed(2) : "-"} accent={m != null ? (m >= TARGET ? T("At target", "عند المستهدف") : m >= 3 ? T("Developing", "قيد التطوير") : T("Opportunity", "فرصة")) : "-"} accentColor={f.color} />;
              })}
            </div>
            <div dir="ltr" style={{ marginTop: "12pt", breakInside: "avoid" }}>
              <FactorBars items={ARA_INDIVIDUAL_FACTORS.map((f) => ({ label: rtl ? f.name_ar : f.name_en, value: wfFactorMean(f.id), color: f.color }))} target={TARGET} lang={lang} />
            </div>
            <table className="report-body" style={{ width: "100%", borderCollapse: "collapse", marginTop: "10pt" }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={cellHead}>{T("Unit", "الوحدة")}</th>
                  <th style={cellHead}>{T("People", "الأفراد")}</th>
                  {ARA_INDIVIDUAL_FACTORS.map((f) => <th key={f.id} style={{ ...cellHead, fontSize: "8pt" }}>{rtl ? f.name_ar : f.name_en}</th>)}
                  <th style={cellHead}>{T("Overall", "الإجمالي")}</th>
                </tr>
              </thead>
              <tbody>
                {[...workforce].sort((a, b) => (b.wf.cohort_overall ?? -1) - (a.wf.cohort_overall ?? -1)).map(({ unit, wf }) => (
                  <tr key={unit.assessment_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={cell}><strong>{unitName(unit)}</strong></td>
                    <td style={cell}>{wf.completed_count}</td>
                    {ARA_INDIVIDUAL_FACTORS.map((f) => {
                      const fa = wf.factor_averages.find((x) => x.factor_id === f.id);
                      return <td key={f.id} style={{ ...cell, textAlign: "center" }}><span style={{ display: "inline-block", minWidth: "36pt", padding: "2pt 6pt", borderRadius: "3pt", background: fa ? scoreColor(fa.average) : TOKENS.line, color: "white", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fa ? fa.average.toFixed(2) : "-"}</span></td>;
                    })}
                    <td style={{ ...cell, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{wf.cohort_overall != null ? wf.cohort_overall.toFixed(2) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Callout tone="info" title={T("People versus systems", "الأفراد مقابل الأنظمة")}>
              {(() => {
                const sys = rollup.overall;
                if (sys == null || wfOverall == null) return T("The organisational pillars and the individual factors are on the same 1-5 scale.", "الركائز المؤسسية والعوامل الفردية على المقياس نفسه من 1 إلى 5.");
                const d = wfOverall - sys;
                return rtl
                  ? `يسجّل الأفراد ${wfOverall.toFixed(2)} مقابل ${sys.toFixed(2)} للأنظمة والعمليات - ${Math.abs(d) < 0.25 ? "الجانبان متقاربان، فالخطة يمكن أن تسير على المسارين معاً." : d > 0 ? "الأفراد متقدّمون على مؤسستهم؛ الأولوية للمنصّات والسياسات والبيانات كي لا يُهدَر هذا الاستعداد." : "المؤسسة متقدّمة على أفرادها؛ الأولوية لبناء القدرات، فالمنصّات موجودة والناس لم يلحقوا بها بعد."}`
                  : `People score ${wfOverall.toFixed(2)} against ${sys.toFixed(2)} for systems and processes - ${Math.abs(d) < 0.25 ? "the two sides are close, so the plan can run on both tracks at once." : d > 0 ? "the people are ahead of their organisation; platforms, policy and data are the priority so that readiness is not wasted." : "the organisation is ahead of its people; capability building is the priority, because the platforms exist and the people have not caught up."}`;
              })()}
            </Callout>
          </section>
        )}

        {/* ─── Roadmap ─── */}
        <section className="report-page">
          <SectionHeader
            eyebrow={T("Twelve months", "اثنا عشر شهراً")}
            title={T(`${stageLabel}-level roadmap`, `خارطة طريق على مستوى ${stageLabel}`)}
            kicker={T(`${roadmapCounts.quick} quick wins, ${roadmapCounts.build} build initiatives, ${roadmapCounts.transform} transformation moves - generated from the agenda matrix, weakest shared gaps first.`, `${roadmapCounts.quick} مكاسب سريعة، ${roadmapCounts.build} مبادرات بناء، ${roadmapCounts.transform} خطوات تحوّل - مولّدة من مصفوفة الأجندة، بدءاً بأضعف الفجوات المشتركة.`)}
          />
          <RollupRoadmap items={roadmap} lang={lang} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10pt", marginTop: "14pt" }}>
            {(["quick", "build", "transform"] as const).map((h) => (
              <div key={h} style={panel}>
                <p style={eyebrowStyle}>{h === "quick" ? T("Months 1-3", "الأشهر 1-3") : h === "build" ? T("Months 4-9", "الأشهر 4-9") : T("Months 10-12", "الأشهر 10-12")}</p>
                <p className="report-body" style={{ margin: 0, fontSize: "9pt" }}>
                  {h === "quick" && T("Name owners for the shared gaps, capture the leading units' playbooks, and assess any pillar with no evidence yet.", "عيّن مالكي الفجوات المشتركة، ووثّق أدلة الوحدات الرائدة، وقيّم أي ركيزة لا أدلة عليها بعد.")}
                  {h === "build" && T("Publish the central standards, run the unit-to-unit transfers, and put a floor under the weakest units.", "انشر المعايير المركزية، ونفّذ عمليات النقل بين الوحدات، وضع حداً أدنى للوحدات الأضعف.")}
                  {h === "transform" && T("Re-measure every unit, report the spread rather than the mean, and extend the aligned pillars to the 4.00 target.", "أعد قياس كل وحدة، وارفع التفاوت لا المتوسط، ووسّع الركائز المتوافقة نحو المستهدف 4.00.")}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Training ─── */}
        {training.length > 0 && (
          <section className="report-page">
            <SectionHeader
              eyebrow={T("Capability building", "بناء القدرات")}
              title={T("VIFM programmes matched to the units", "برامج VIFM المطابقة للوحدات")}
              kicker={T("Each unit's report recommends training for its own gaps. Pooled here, ranked by how many units the same programme serves - the ones several units need are the ones worth running once, centrally.", "يوصي تقرير كل وحدة ببرامج لفجواتها. تُجمَّع هنا وتُرتَّب بحسب عدد الوحدات التي يخدمها البرنامج نفسه - فالبرامج التي تحتاجها عدة وحدات هي التي تستحق التنفيذ مرة واحدة مركزياً.")}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10pt" }}>
              {training.map((c, i) => (
                <article key={`${c.code ?? i}`} style={{ padding: "10pt 12pt", border: `1pt solid ${TOKENS.line}`, borderRadius: "3pt", background: "white", breakInside: "avoid" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8pt" }}>
                    <span style={{ fontSize: "7.5pt", letterSpacing: rtl ? 0 : "0.09em", textTransform: "uppercase", color: TOKENS.mute, fontWeight: 600 }}>{c.code ?? T("Programme", "برنامج")} · {c.days} {T("days", "أيام")}</span>
                    <span style={{ fontSize: "8pt", fontWeight: 700, color: c.units.length > 1 ? TOKENS.emerald : TOKENS.mute }}>{c.units.length} {leafWord(c.units.length)}</span>
                  </div>
                  <h4 style={{ fontSize: "11pt", fontWeight: 600, color: TOKENS.navy, margin: "4pt 0 4pt", lineHeight: 1.3 }}>{c.title}</h4>
                  <p style={{ fontSize: "8.5pt", color: TOKENS.ink2, margin: 0 }}>{T("For", "لـ")}: {c.units.join(rtl ? "، " : ", ")}</p>
                  {c.drivers.length > 0 && <p style={{ fontSize: "8pt", color: TOKENS.mute, margin: "3pt 0 0" }}>{T("Addresses", "يعالج")}: {c.drivers.slice(0, 3).join(" · ")}</p>}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ─── Next steps + method ─── */}
        <section className="report-page">
          <SectionHeader eyebrow={T("Next steps", "الخطوات التالية")} title={T("From comparison to programme", "من المقارنة إلى البرنامج")} />
          <ol className="report-body" style={{ margin: "0", paddingInlineStart: "18pt" }}>
            <li style={{ marginBottom: "6pt" }}>{T(`Share each unit's own report with its head, and this consolidation with the ${stageLower} leadership. The unit reports carry the detail; this one carries the comparison.`, `شارك تقرير كل وحدة مع رئيسها، وهذا التقرير الموحّد مع قيادة ${stageLabel}. تحمل تقارير الوحدات التفاصيل؛ ويحمل هذا التقرير المقارنة.`)}</li>
            <li style={{ marginBottom: "6pt" }}>{shared.length > 0
              ? T(`Stand up the central programme for the ${shared.length} shared gap${shared.length === 1 ? "" : "s"}, starting with ${pillarName(shared[0].pillar_id)}.`, `أطلق البرنامج المركزي لـ${shared.length} ${shared.length === 1 ? "فجوة مشتركة" : "فجوات مشتركة"}، بدءاً بـ${pillarName(shared[0].pillar_id)}.`)
              : T("No central programme is needed: no pillar is below target everywhere. Fund the units' own plans.", "لا حاجة لبرنامج مركزي: لا ركيزة دون المستهدف في كل مكان. موّل خطط الوحدات نفسها.")}</li>
            <li style={{ marginBottom: "6pt" }}>{rollup.unevenPillars.length > 0
              ? T(`Specify the ${rollup.unevenPillars.length} practice transfer${rollup.unevenPillars.length === 1 ? "" : "s"} in the Phase 2 workshop - the unit already scoring highest has practice worth moving.`, `حدّد ${rollup.unevenPillars.length} ${rollup.unevenPillars.length === 1 ? "عملية نقل ممارسات" : "عمليات نقل ممارسات"} في ورشة المرحلة الثانية - لدى الوحدة الأعلى درجة ممارسة تستحق النقل.`)
              : T("The units are consistent; use the Phase 2 workshop to validate the shared picture rather than to broker transfers.", "الوحدات متّسقة؛ استخدم ورشة المرحلة الثانية للتحقق من الصورة المشتركة لا للتوسط في عمليات نقل.")}</li>
            {rollup.uncoveredPillars.length > 0 && <li style={{ marginBottom: "6pt" }}>{T(`Assess ${rollup.uncoveredPillars.map(pillarName).join(", ")} at ${stageLower} level, where ${rollup.uncoveredPillars.length === 1 ? "it is" : "they are"} actually set.`, `قيّم ${rollup.uncoveredPillars.map(pillarName).join("، ")} على مستوى ${stageLabel}، حيث تُحدَّد فعلاً.`)}</li>}
            <li>{T("Re-run the same instrument in twelve months. The consolidation then reports the change in the spread, which is the honest measure of whether capability travelled.", "أعد تطبيق الأداة نفسها بعد اثني عشر شهراً. عندها يرصد التقرير الموحّد التغيّر في التفاوت، وهو المقياس الصادق لانتقال القدرة.")}</li>
          </ol>

          <div style={{ ...panel, marginTop: "14pt" }}>
            <h3 className="report-h3" style={{ marginTop: 0 }}>{T("Phase 2 consultant workshop", "ورشة المستشار - المرحلة الثانية")}</h3>
            <p className="report-body" style={{ margin: 0 }}>
              {T(
                "Every score in this document is self-reported by the units' respondents. Phase 2 is the facilitated session where a VIFM consultant tests those answers against evidence, records a validated band beside the self-assessed one, and turns the transfers above into named counterparts and dates. It is where a consolidation stops being a comparison and becomes a programme.",
                "كل درجة في هذه الوثيقة مبلَّغة ذاتياً من مشاركي الوحدات. المرحلة الثانية هي الجلسة الميسَّرة التي يختبر فيها مستشار VIFM تلك الإجابات مقابل الأدلة، ويسجّل نطاقاً مُتحقَّقاً منه إلى جانب النطاق الذاتي، ويحوّل عمليات النقل أعلاه إلى نظراء محددين بالاسم وتواريخ. وهي حيث يتوقف التقرير الموحّد عن كونه مقارنة ليصبح برنامجاً."
              )}
            </p>
          </div>

        </section>

        {/* ─── Method ─── */}
        <section className="report-page">
          <SectionHeader eyebrow={T("Appendix", "ملحق")} title={T("Method and definitions", "المنهجية والتعريفات")} kicker={T("How every number in this document was produced, so a reader can check it against the unit reports.", "كيف أُنتج كل رقم في هذه الوثيقة، ليتمكن القارئ من مطابقته بتقارير الوحدات.")} />
          <table className="report-body" style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt" }}>
            <tbody>
              {consolidationFactRows({ lang, stage: stageLabel, weighting: rollup.weighting, unevenThreshold: UNEVEN_THRESHOLD, retentionYears: retentionYears(), ladder: maturityLadder(lang) }).map((r) => (
                <tr key={r.label} style={{ borderTop: `1pt solid ${TOKENS.line}` }}>
                  <td style={{ ...cell, fontWeight: 600, width: "120pt", verticalAlign: "top", fontSize: "8.5pt" }}>{r.label}</td>
                  <td style={{ ...cell, fontSize: "8.5pt" }}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
