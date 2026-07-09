import { notFound } from "next/navigation";
import Link from "next/link";
import { Compass, Sparkles, ArrowLeft, FileDown, BookOpen, GraduationCap, ClipboardCheck } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadRespondentByToken, loadQuestionsForRespondent } from "@/lib/ara/respondent-access";
import { araRespondentProvisional } from "@/lib/ara/provisional";
import { ProvisionalBanner } from "@/components/shared/provisional-banner";
import { isStaffCaller } from "@/lib/ara/auth-guards";
import { calculateQuestionScore } from "@/lib/ara/scoring";
import {
  ARA_INDIVIDUAL_FACTORS,
  ARA_INDIVIDUAL_FACTOR_IDS,
  ARA_INDIVIDUAL_FACTOR_MAP,
  ARA_INDIVIDUAL_MATURITY_STAGES,
  getIndividualMaturityStage,
  validateTalentLens,
  TALENT_LENS_LABELS,
  FACTOR_DESCRIPTIVE,
  type AraIndividualFactorId,
  type AraIndividualMaturityStageId,
} from "@/lib/constants/ara-individual-factors";
import { buildPersonalAnalysis, buildDevelopmentAnalysis } from "@/lib/ara/personal-analysis";
import { recommendCoursesForIndividualSnapshot } from "@/lib/recommender/courses";
import { RecommendedCoursesPanel } from "@/components/shared/recommended-courses-panel";
import { computeWorkforceReadiness } from "@/lib/ara/workforce-readiness";
import {
  computePersonalNorms,
  percentileRank,
  ordinal,
  MIN_NORM_SAMPLE,
} from "@/lib/ara/personal-norms";

export const dynamic = "force-dynamic";

type Props = { params: { token: string }; searchParams?: { present?: string } };

const TARGET = 4;

/** Score range shown beside each overall maturity stage in the legend. */
const STAGE_RANGE: Record<AraIndividualMaturityStageId, { en: string; ar: string }> = {
  emerging: { en: "below 3", ar: "أقل من 3" },
  practising: { en: "3 to below 4", ar: "من 3 إلى أقل من 4" },
  embedded: { en: "4 and above", ar: "4 فأكثر" },
};

export default async function PersonalResultsPage({ params, searchParams }: Props) {
  const ctx = await loadRespondentByToken(params.token);
  if (!ctx) return notFound();

  // Personal results page is valid for:
  //   - Mode A/B individual-stage assessments (the primary case), AND
  //   - Mode C respondents on an org assessment that has the individual
  //     layer enabled - those respondents have answered the four-factor
  //     items and are entitled to see their personal breakdown.
  // Anyone else (org respondent on a no-layer assessment) gets a 404.
  const isPersonalEligible =
    ctx.assessment.engagement_stage === "individual" ||
    !!ctx.assessment.include_individual_layer;
  if (!isPersonalEligible) {
    return notFound();
  }

  const language = ctx.respondent.language_preference;
  const isAr = language === "ar";

  // XP-13: results are never shown to the taker. This token page is reached by
  // BOTH the taker (magic link, no session) and VIFM staff (consultant/admin
  // who click "View" from the dashboard, with a session). Only staff see the
  // results; the taker always gets a thank-you. The client-delivery flow uses
  // the internal PDF route, not this page.
  const staff = await isStaffCaller();
  if (!staff) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-accent/10">
              <Compass className="h-5 w-5 text-accent" />
            </div>
            <CardTitle className="text-lg">
              {isAr ? "تم استلام إجاباتك" : "Your responses are recorded"}
            </CardTitle>
            <CardDescription>
              {isAr
                ? "شكرًا لإكمالك التقييم. ستتم مشاركة نتائجك مع مؤسستك، التي ستتواصل معك بشأن الخطوات التالية."
                : "Thank you for completing the assessment. Your results are shared with your organisation, who will follow up with you on next steps."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const sb = createServiceClient();
  const questions = await loadQuestionsForRespondent(ctx);

  const { data: answers } = await sb
    .from("ara_responses")
    .select("question_id, answer_value")
    .eq("respondent_id", ctx.respondent.id);

  // Compute per-factor average score from the responses.
  const factorTotals: Record<AraIndividualFactorId, { sum: number; count: number }> = {
    thinking_sense_check: { sum: 0, count: 0 },
    results_working_practice: { sum: 0, count: 0 },
    people_collaboration: { sum: 0, count: 0 },
    self_adaptive_mindset: { sum: 0, count: 0 },
  };
  const answerByQuestionId = new Map(
    (answers ?? []).map((a) => [a.question_id as string, a.answer_value])
  );
  // Split self-rating (Likert) items from objective (scenario / knowledge)
  // items so the analysis can flag self-perception vs demonstrated calibration.
  let selfSum = 0, selfCount = 0, objSum = 0, objCount = 0;
  for (const q of questions) {
    const factorId = q.individual_factor_id as AraIndividualFactorId | null;
    if (!factorId) continue;
    const ans = answerByQuestionId.get(q.id);
    const numeric = calculateQuestionScore(q.question_type, ans ?? null, q.score_map);
    if (numeric != null) {
      factorTotals[factorId].sum += numeric;
      factorTotals[factorId].count += 1;
      if (q.question_type === "rating") { selfSum += numeric; selfCount += 1; }
      else { objSum += numeric; objCount += 1; }
    }
  }
  const selfAvg = selfCount > 0 ? selfSum / selfCount : 0;
  const objectiveAvg = objCount > 0 ? objSum / objCount : 0;

  const factorScores = ARA_INDIVIDUAL_FACTOR_IDS.reduce<Record<AraIndividualFactorId, number>>(
    (acc, id) => {
      const t = factorTotals[id];
      acc[id] = t.count > 0 ? t.sum / t.count : 0;
      return acc;
    },
    {} as Record<AraIndividualFactorId, number>
  );

  // Overall = mean of the factors that actually have answers. A factor with no
  // answered items scores 0; including it in the divisor silently drags the
  // overall (and the maturity stage) down - so exclude unanswered factors.
  const scoredFactors = ARA_INDIVIDUAL_FACTOR_IDS.map((id) => factorScores[id]).filter((v) => v > 0);
  const overallScore =
    scoredFactors.length > 0
      ? scoredFactors.reduce((s, v) => s + v, 0) / scoredFactors.length
      : 0;

  // Talent lens (migration 00134). Drives R4-R7. NULL = generic framing
  // (legacy / anonymous / deep-linked) and reproduces today's output exactly.
  const sittingLens = validateTalentLens(ctx.assessment.talent_lens);
  // BD presentation override: only staff ever reach this render (the taker got a
  // thank-you above), so ?present=acquisition|development lets BD show a client
  // both report framings of the SAME sitting when presenting. It never changes
  // the stored lens - the candidate's own report stays the sitting's lens.
  const presentOverride = validateTalentLens(searchParams?.present ?? null);
  const talentLens = presentOverride ?? sittingLens;
  const isAcquisition = talentLens === "acquisition";

  // Selection-lens analysis: a logical, evidence-grounded read built ONLY from
  // the candidate's own answers (per-factor scores + self-vs-objective items).
  // Surfaced for the hiring lens, where it replaces the development course
  // recommendations as the "so what" of the result.
  const analysis = isAcquisition
    ? buildPersonalAnalysis({ factorScores, overallScore, selfAvg, objectiveAvg, objectiveCount: objCount })
    : null;

  // Development (growth) lens analysis - a DIFFERENT report for a different
  // reader. Built for the development lens OR the generic (null) run; per the
  // research, the generic snapshot defaults to the developmental experience.
  const devAnalysis = !isAcquisition
    ? buildDevelopmentAnalysis({ factorScores, overallScore, selfAvg, objectiveAvg, objectiveCount: objCount })
    : null;

  // R5: course recommendations are development-context info. Skip the compute
  // entirely under the acquisition (hiring) lens; show for development OR null.
  const recommendations = isAcquisition
    ? []
    : await recommendCoursesForIndividualSnapshot({
        factorScores,
        target: TARGET,
        limit: 5,
      });

  // Percentile ranking vs the completed-snapshot norm group. Withheld until
  // the pool reaches MIN_NORM_SAMPLE (computePersonalNorms gates `ready`), so
  // until then the card shows an honest "accruing" note instead of a rank.
  const norms = await computePersonalNorms();
  const overallPct =
    norms.ready && overallScore > 0 ? percentileRank(overallScore, norms.overall) : null;
  const factorPct: Partial<Record<AraIndividualFactorId, number>> = {};
  if (norms.ready) {
    for (const id of ARA_INDIVIDUAL_FACTOR_IDS) {
      const v = factorScores[id];
      if (v > 0) {
        const p = percentileRank(v, norms.perFactor[id]);
        if (p != null) factorPct[id] = p;
      }
    }
  }

  // Mode C only - individual-vs-cohort means on each factor card.
  // We deliberately exclude the current respondent from the cohort
  // mean so the delta isn't self-referential when the cohort is small.
  // Suppress the pill entirely when there are no other respondents
  // (cohort of 1) or when a factor has no other data.
  const isModeC =
    ctx.assessment.engagement_stage !== "individual" &&
    !!ctx.assessment.include_individual_layer;
  const cohortMeans: Partial<Record<AraIndividualFactorId, number>> = {};
  let cohortPeerCount = 0;
  if (isModeC) {
    const rollup = await computeWorkforceReadiness(ctx.assessment.id).catch(() => null);
    if (rollup) {
      const peers = rollup.respondents.filter((r) => r.respondent_id !== ctx.respondent.id);
      cohortPeerCount = peers.length;
      for (const id of ARA_INDIVIDUAL_FACTOR_IDS) {
        const vals = peers
          .map((r) => r.per_factor[id])
          .filter((v): v is number => typeof v === "number");
        if (vals.length > 0) {
          cohortMeans[id] = vals.reduce((a, b) => a + b, 0) / vals.length;
        }
      }
    }
  }

  // Option 2 gate: flag the result provisional if it served questions an SME has
  // not yet approved (migration 00184). Clears per-pillar as content is approved.
  const provisional = await araRespondentProvisional(ctx.respondent.id);

  return (
    <div className="min-h-screen bg-background" dir={isAr ? "rtl" : "ltr"}>
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {provisional.provisional && (
          <ProvisionalBanner language={isAr ? "ar" : "en"} pending={provisional.pending} total={provisional.total} />
        )}
        {/* BD presentation toggle - staff only (the taker never reaches this
            render; they get the thank-you page above). Flips between the two
            report framings of THIS sitting so BD can show a client the
            difference. It does not change the stored sitting or the candidate's
            own report. */}
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
              Presentation view · staff
            </span>
            <span className="text-xs text-amber-700">
              Show a client how the two reports differ. This view only; it does not change the stored sitting.
            </span>
            <div className="ms-auto inline-flex overflow-hidden rounded-md border border-amber-300">
              <Link
                href={`/ara/personal/results/${params.token}?present=acquisition`}
                className={`px-3 py-1 text-xs font-semibold ${
                  talentLens === "acquisition" ? "bg-[#5391D5] text-white" : "bg-white text-[#1e40af] hover:bg-[#5391D5]/10"
                }`}
              >
                Talent Acquisition
              </Link>
              <Link
                href={`/ara/personal/results/${params.token}?present=development`}
                className={`border-s border-amber-300 px-3 py-1 text-xs font-semibold ${
                  talentLens === "development" ? "bg-emerald-600 text-white" : "bg-white text-emerald-800 hover:bg-emerald-50"
                }`}
              >
                Talent Development
              </Link>
            </div>
          </div>
          {sittingLens && sittingLens !== talentLens && (
            <p className="mt-1.5 text-[11px] text-amber-700">
              This sitting was started as{" "}
              <strong>{sittingLens === "acquisition" ? "Talent Acquisition" : "Talent Development"}</strong>; you are previewing the other framing.
            </p>
          )}
        </div>
        <div>
          <Link
            href={talentLens ? `/ara?lens=${talentLens}` : "/ara"}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            {isAr ? "العودة إلى بوصلة الجاهزية للذكاء الاصطناعي" : "Back to the AI Readiness Compass®"}
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <Compass className="h-6 w-6 text-accent" />
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              {/* Talent-lens indicator - a prominent badge at the top of the
                  report so it is unmistakable whether this is a hiring (Talent
                  Acquisition) or a growth (Talent Development) report. */}
              {talentLens && (
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide mb-2 ${
                    talentLens === "acquisition"
                      ? "border-[#5391D5]/40 bg-[#5391D5]/15 text-[#1e40af]"
                      : "border-emerald-300 bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {isAr ? TALENT_LENS_LABELS[talentLens].ar : TALENT_LENS_LABELS[talentLens].en}
                </span>
              )}
              <h1 className="text-2xl font-bold">
                {isAr ? "لقطة الجاهزية الشخصية للذكاء الاصطناعي" : "Personal AI Readiness Snapshot"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {ctx.respondent.name} · {ctx.respondent.email}
              </p>
            </div>
            <a
              href={`/api/ara/personal/${params.token}/pdf`}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-input bg-card hover:bg-muted/50 shrink-0"
            >
              <FileDown className="h-3.5 w-3.5" />
              {isAr ? "تنزيل PDF" : "Download PDF"}
            </a>
          </div>
        </div>

        {/* Overall score card */}
        {(() => {
          const stage = getIndividualMaturityStage(overallScore);
          const stageBadgeTone =
            stage.id === "embedded"
              ? "bg-emerald-400/20 border-emerald-300/30 text-emerald-100"
              : stage.id === "practising"
              ? "bg-amber-400/20 border-amber-300/30 text-amber-100"
              : "bg-rose-400/20 border-rose-300/30 text-rose-100";
          return (
            <Card className="bg-gradient-to-br from-primary to-navy-blue text-primary-foreground border-0">
              <CardContent className="p-5 flex items-start gap-5">
                <div>
                  <p className="text-xs uppercase tracking-widest opacity-70">
                    {isAr ? "النتيجة الإجمالية" : "Overall snapshot"}
                  </p>
                  <p className="text-4xl font-bold tabular-nums mt-1">
                    {overallScore.toFixed(1)}
                    <span className="text-sm opacity-60 font-normal"> / 5</span>
                  </p>
                  {/* A3: assessment type (which portal issued it), beneath the score. */}
                  <p className="inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded bg-white/10">
                    {isAr ? "نوع التقييم: " : "Assessment type: "}
                    {talentLens
                      ? (isAr ? TALENT_LENS_LABELS[talentLens].ar : TALENT_LENS_LABELS[talentLens].en)
                      : (isAr ? "عام" : "General")}
                  </p>
                  {overallScore > 0 && (
                    <span
                      className={`inline-block mt-2 ms-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${stageBadgeTone}`}
                    >
                      {isAr ? stage.name_ar : stage.name_en}
                    </span>
                  )}
                  {/* R2: how the band is read, beneath the band word. */}
                  {overallScore > 0 && (
                    <p className="text-[11px] mt-1 opacity-80">
                      {isAr ? stage.definition_ar : stage.definition_en}
                    </p>
                  )}
                  {overallScore > 0 &&
                    (overallPct != null ? (
                      <p className="text-[11px] mt-2 opacity-80">
                        {isAr
                          ? `أعلى من ${overallPct}٪ من ${norms.sampleSize} مشاركًا`
                          : `${ordinal(overallPct)} percentile of ${norms.sampleSize} respondents`}
                      </p>
                    ) : (
                      <p className="text-[11px] mt-2 opacity-60">
                        {isAr
                          ? `تُفتح المقارنة المئوية بعد ${MIN_NORM_SAMPLE} مشاركًا (${norms.sampleSize} حتى الآن)`
                          : `Percentile unlocks at ${MIN_NORM_SAMPLE} respondents (${norms.sampleSize} so far)`}
                      </p>
                    ))}
                </div>
                <div className="text-sm opacity-90 max-w-md">
                  {overallScore > 0
                    ? (isAr ? stage.blurb_ar : stage.blurb_en)
                    : (isAr ? "لا توجد بيانات بعد." : "No data yet.")}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* A2 + A4: how to read the scores, directly under the overall score. */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <p className="text-xs font-bold text-primary mb-1">
                {isAr ? "قراءة الدرجة - المرحلة الإجمالية" : "Reading the score - overall stage"}
              </p>
              <div className="space-y-0.5">
                {ARA_INDIVIDUAL_MATURITY_STAGES.map((st) => (
                  <p key={st.id} className="text-[11px] text-muted-foreground leading-snug">
                    <span className="font-semibold text-foreground">
                      {(isAr ? st.name_ar : st.name_en)} ({isAr ? STAGE_RANGE[st.id].ar : STAGE_RANGE[st.id].en}):
                    </span>{" "}
                    {isAr ? st.definition_ar : st.definition_en}.
                  </p>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-primary mb-1.5">
                {isAr ? "نطاقات كل عامل" : "Per-factor bands"}
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                <span className="inline-flex items-center gap-1.5 text-[11px]">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border bg-rose-100 text-rose-900 border-rose-200">
                    {isAr ? "فرصة" : "Opportunity"}
                  </span>
                  <span className="text-muted-foreground tabular-nums">1.0 - 2.9</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px]">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border bg-amber-100 text-amber-900 border-amber-200">
                    {isAr ? "قيد التطوير" : "Developing"}
                  </span>
                  <span className="text-muted-foreground tabular-nums">3.0 - 3.9</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px]">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border bg-emerald-100 text-emerald-900 border-emerald-200">
                    {isAr ? "قوي" : "Strong"}
                  </span>
                  <span className="text-muted-foreground tabular-nums">4.0 - 5.0</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Per-factor breakdown */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-accent mb-1">
            {isAr ? "تفصيل حسب العامل" : "Per-factor breakdown"}
          </p>
          <h2 className="text-lg font-bold mb-3">
            {isAr ? "موقعك في كل عامل من عوامل الجاهزية للذكاء الاصطناعي" : "Where you stand on each AI readiness factor"}
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {ARA_INDIVIDUAL_FACTORS.map((f) => {
            const score = factorScores[f.id];
            const tone = score >= 4 ? "Strong" : score >= 3 ? "Developing" : "Opportunity";
            const toneColor =
              score >= 4 ? "bg-emerald-100 text-emerald-900 border-emerald-200"
              : score >= 3 ? "bg-amber-100 text-amber-900 border-amber-200"
              : "bg-rose-100 text-rose-900 border-rose-200";
            // Mode C only - show delta vs cohort peers (excluding self).
            const peerMean = cohortMeans[f.id];
            const showDelta = isModeC && cohortPeerCount > 0 && peerMean != null && score > 0;
            const delta = showDelta ? score - (peerMean as number) : 0;
            const deltaTone =
              delta >= 0.25 ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : delta <= -0.25 ? "text-rose-700 bg-rose-50 border-rose-200"
              : "text-muted-foreground bg-muted border-border";
            const deltaSign = delta > 0 ? "+" : delta < 0 ? "" : "±";
            // R6: under the acquisition (hiring) lens, describe the candidate at
            // their measured level on this factor instead of the construct blurb.
            // Keyed by the factor's own stage. Development / null keep the
            // construct description (no regression).
            const factorStage = getIndividualMaturityStage(score);
            const descriptive =
              isAcquisition && score > 0 ? FACTOR_DESCRIPTIVE[f.id][factorStage.id] : null;
            const cardBody = descriptive
              ? (isAr ? descriptive.ar : descriptive.en)
              : (isAr ? f.description_ar : f.description_en);
            return (
              <div key={f.id} className="rounded-md border bg-card p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: f.color }}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {f.domain}
                  </span>
                  <span className={`ms-auto text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${toneColor}`}>
                    {tone}
                  </span>
                </div>
                <p className="text-sm font-semibold">{isAr ? f.name_ar : f.name_en}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-bold tabular-nums">
                    {score > 0 ? score.toFixed(1) : "-"}
                    <span className="text-xs text-muted-foreground font-normal"> / 5</span>
                  </p>
                  {factorPct[f.id] != null && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {isAr ? `النسبة ${factorPct[f.id]}٪` : `${ordinal(factorPct[f.id]!)} pct`}
                    </span>
                  )}
                  {showDelta && (
                    <span
                      className={`text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md border ${deltaTone}`}
                      title={
                        isAr
                          ? `متوسط الزملاء: ${(peerMean as number).toFixed(1)} (n=${cohortPeerCount})`
                          : `Peer average: ${(peerMean as number).toFixed(1)} (n=${cohortPeerCount})`
                      }
                    >
                      {deltaSign}
                      {delta.toFixed(1)} {isAr ? "مقارنةً بالزملاء" : "vs cohort"}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                  {cardBody}
                </p>
              </div>
            );
          })}
        </div>

        {/* Candidate results analysis (acquisition / hiring lens only). A
            deterministic, evidence-grounded read derived only from the
            candidate's own answers - the hiring-context "so what" that replaces
            the development course recommendations. */}
        {analysis && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-accent" />
                {isAr ? "تحليل نتائج المرشح" : "Candidate results analysis"}
              </CardTitle>
              <CardDescription>
                {isAr
                  ? "قراءة منطقية مبنية على إجابات المرشح وحدها - لدعم قرار الاختيار."
                  : "A logical read built only from the candidate's own answers - to support the selection decision."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {/* Advisory band - lead the hiring report with the decision + guardrail */}
              {(() => {
                const b = analysis.band;
                const tone =
                  b.id === "advance" ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : b.id === "review" ? "bg-amber-50 border-amber-300 text-amber-900"
                  : "bg-rose-50 border-rose-300 text-rose-900";
                const dot =
                  b.id === "advance" ? "bg-emerald-500" : b.id === "review" ? "bg-amber-500" : "bg-rose-500";
                return (
                  <div className={`rounded-md border p-3 ${tone}`}>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {isAr ? "التوصية الاسترشادية" : "Advisory"}: {isAr ? b.label.ar : b.label.en}
                      </span>
                    </div>
                    <p className="text-[13px] mt-1.5 leading-relaxed">
                      {isAr ? b.rationale.ar : b.rationale.en}
                    </p>
                  </div>
                );
              })()}
              <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                {isAr ? analysis.guardrail.ar : analysis.guardrail.en}
              </p>

              {/* Verdict */}
              <p className="leading-relaxed">{isAr ? analysis.verdict.ar : analysis.verdict.en}</p>

              {/* Calibration: self-rating vs objective items */}
              {analysis.calibration && (
                <div className="rounded-md border-s-2 border-accent bg-accent/5 ps-3 py-2">
                  <p className="text-xs font-semibold text-primary mb-0.5">
                    {isAr ? "المعايرة: التقييم الذاتي مقابل الموضوعي" : "Calibration: self-rating vs objective items"}
                  </p>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    {isAr ? analysis.calibration.ar : analysis.calibration.en}
                  </p>
                </div>
              )}

              {/* Strengths */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1.5">
                  {isAr ? "نقاط القوة" : "Strengths"}
                </p>
                <ul className="space-y-1.5">
                  {analysis.strengths.map((s) => {
                    const f = ARA_INDIVIDUAL_FACTOR_MAP[s.factorId];
                    return (
                      <li key={s.factorId} className="text-[13px] leading-relaxed">
                        <span className="font-semibold">
                          {isAr ? f.name_ar : f.name_en} ({s.score.toFixed(1)}/5):
                        </span>{" "}
                        <span className="text-muted-foreground">{isAr ? s.read.ar : s.read.en}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Development areas + interview probes */}
              {analysis.allAtTarget ? (
                <p className="text-[13px] text-emerald-800">
                  {isAr
                    ? "جميع العوامل عند المستوى المستهدف (4.0) أو أعلى - ملمح قوي بشكل متسق."
                    : "All four factors meet or exceed the target (4.0) - a uniformly strong profile."}
                </p>
              ) : (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1.5">
                    {isAr ? "مجالات التطوير وما يجب التحقق منه" : "Development areas & what to probe"}
                  </p>
                  <ul className="space-y-2.5">
                    {analysis.developmentAreas.map((d) => {
                      const f = ARA_INDIVIDUAL_FACTOR_MAP[d.factorId];
                      return (
                        <li key={d.factorId} className="text-[13px] leading-relaxed">
                          <span className="font-semibold">
                            {isAr ? f.name_ar : f.name_en} ({d.score.toFixed(1)}/5):
                          </span>{" "}
                          <span className="text-muted-foreground">{isAr ? d.read.ar : d.read.en}</span>
                          <span className="block mt-1 text-[12px] text-accent">
                            <span className="font-semibold">{isAr ? "للمقابلة: " : "Probe: "}</span>
                            {isAr ? d.probe.ar : d.probe.en}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Profile shape */}
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs font-semibold text-primary mb-0.5">
                  {isAr ? "شكل الملمح" : "Profile shape"}
                </p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  {isAr ? analysis.profileShape.ar : analysis.profileShape.en}
                </p>
              </div>

              {/* AI-specific risk flags - each a signal to probe, never auto-reject */}
              {analysis.riskFlags.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-1.5">
                    {isAr ? "إشارات للاستقصاء" : "Risk flags to probe"}
                  </p>
                  <ul className="space-y-2">
                    {analysis.riskFlags.map((r) => (
                      <li key={r.id} className="rounded-md border-s-2 border-rose-300 bg-rose-50/50 ps-3 py-1.5">
                        <p className="text-[13px] font-semibold text-rose-900">{isAr ? r.title.ar : r.title.en}</p>
                        <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">
                          {isAr ? r.detail.ar : r.detail.en}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Freshness - AI readiness ages fast */}
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {isAr ? analysis.freshness.ar : analysis.freshness.en}
              </p>

              {/* Basis caveat */}
              <p className="text-[11px] text-muted-foreground italic leading-relaxed border-t pt-3">
                {isAr ? analysis.basis.ar : analysis.basis.en}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Your development plan (development / null lens). A growth report -
            strengths-first, ipsative, sequenced priorities with a first action,
            manager guide, reflection, and a re-measure cadence. No verdict /
            cut-score / hire language. Built only from the respondent's answers. */}
        {devAnalysis && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                {isAr ? "خطة تطويرك" : "Your development plan"}
              </CardTitle>
              <CardDescription>
                {isAr
                  ? "خطة نمو مبنية على إجاباتك - للعمل عليها مع شريك تطويرك."
                  : "A growth plan built from your answers - to work through with your development partner."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {/* Framing - what this is and isn't */}
              <div className="rounded-md border-s-2 border-accent bg-accent/5 ps-3 py-2">
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  {isAr ? devAnalysis.framing.ar : devAnalysis.framing.en}
                </p>
              </div>

              {/* Start from strength */}
              <p className="leading-relaxed">{isAr ? devAnalysis.headline.ar : devAnalysis.headline.en}</p>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1.5">
                  {isAr ? "نقاط قوة لتبني عليها" : "Strengths to build on"}
                </p>
                <ul className="space-y-1.5">
                  {devAnalysis.strengths.map((s) => {
                    const f = ARA_INDIVIDUAL_FACTOR_MAP[s.factorId];
                    return (
                      <li key={s.factorId} className="text-[13px] leading-relaxed">
                        <span className="font-semibold">
                          {isAr ? f.name_ar : f.name_en} ({s.score.toFixed(1)}/5):
                        </span>{" "}
                        <span className="text-muted-foreground">{isAr ? s.read.ar : s.read.en}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Constructive calibration */}
              {devAnalysis.calibration && (
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs font-semibold text-primary mb-0.5">
                    {isAr ? "تصوّرك الذاتي مقابل إجاباتك" : "Your self-view vs your answers"}
                  </p>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    {isAr ? devAnalysis.calibration.ar : devAnalysis.calibration.en}
                  </p>
                </div>
              )}

              {/* Sequenced priorities */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
                  {isAr ? "أولوياتك التطويرية" : "Your development priorities"}
                </p>
                <p className="text-[11px] text-muted-foreground mb-2 leading-snug">
                  {isAr ? devAnalysis.sequencingNote.ar : devAnalysis.sequencingNote.en}
                </p>
                <ol className="space-y-3">
                  {devAnalysis.priorities.map((p, i) => {
                    const f = ARA_INDIVIDUAL_FACTOR_MAP[p.factorId];
                    return (
                      <li key={p.factorId} className="rounded-md border p-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
                            {i + 1}
                          </span>
                          <span className="text-[13px] font-semibold">{isAr ? f.name_ar : f.name_en}</span>
                          <span className="ms-auto text-[11px] text-muted-foreground tabular-nums">
                            {p.score.toFixed(1)} / 5
                            {p.gapToTarget > 0
                              ? (isAr ? ` · الفجوة ${p.gapToTarget.toFixed(1)}` : ` · gap ${p.gapToTarget.toFixed(1)}`)
                              : ""}
                          </span>
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">
                          <span className="font-semibold text-foreground">{isAr ? "لماذا الآن: " : "Why now: "}</span>
                          {isAr ? p.whyNow.ar : p.whyNow.en}
                        </p>
                        <p className="text-[12px] text-foreground mt-1.5 leading-relaxed">
                          <span className="font-semibold">{isAr ? "خطوة أولى: " : "First step: "}</span>
                          {isAr ? p.action.ar : p.action.en}
                        </p>
                        {p.acCompetencies.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {p.acCompetencies.map((c) => (
                              <span key={c} className="text-[10px] px-1.5 py-0.5 rounded-full border bg-muted text-muted-foreground">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* Reflect & commit */}
              <div className="rounded-md border bg-accent/5 p-3">
                <p className="text-xs font-semibold text-primary mb-0.5">
                  {isAr ? "تأمّل والتزِم" : "Reflect & commit"}
                </p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  {isAr ? devAnalysis.reflection.ar : devAnalysis.reflection.en}
                </p>
              </div>

              {/* Manager conversation guide */}
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs font-semibold text-primary mb-0.5">
                  {isAr ? "دليل المدير للمحادثة" : "Manager conversation guide"}
                </p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  {isAr ? devAnalysis.managerPrompts.ar : devAnalysis.managerPrompts.en}
                </p>
              </div>

              {/* Re-measure cadence */}
              <p className="text-[11px] text-muted-foreground italic leading-relaxed border-t pt-3">
                {isAr ? devAnalysis.cadence.ar : devAnalysis.cadence.en}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Course recommendations (R5: development / null only - hidden under
            the acquisition lens, which suppresses the develop-with-VIFM block). */}
        {!isAcquisition && (
        <RecommendedCoursesPanel
          title={isAr ? "تطوّر مع برامج VIFM" : "Develop with VIFM programmes"}
          description={
            isAr
              ? "دورات VIFM التي تعالج الفجوات في عواملك ذات الدرجات الأقل، مرتبة حسب الملاءمة (حجم الفجوة × ملاءمة الدورة)."
              : "VIFM courses that address the gaps in your lower-scoring factors, ranked by fit (gap size × course relevance)."
          }
          emptyMessage={
            isAr
              ? "لا توجد توصيات حالياً - جميع عواملك قريبة من المستوى المستهدف، أو الكتالوج الحالي لا يغطي بعد العوامل ذات الدرجات الأقل."
              : "No recommendations yet - either all your factors are near target, or the catalogue doesn't yet cover the relevant capabilities."
          }
          courses={recommendations}
          context="ac"
        />
        )}

        {/* Browse-the-full-catalogue CTA - the recommender shows up to
             five gap-driven programmes; people with strong scores see
             the empty-state. Either way, a respondent who wants to
             explore VIFM's broader curriculum should have one click to
             the public training catalogue from here. The recommender
             is gap-driven; the catalogue is content-driven. */}
        <div className="rounded-md border bg-accent/5 p-3 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="rounded-full bg-accent/15 p-1.5 mt-0.5 shrink-0">
              <GraduationCap className="h-3.5 w-3.5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">
                {isAr ? "تصفّح كتالوج VIFM الكامل" : "Browse the full VIFM catalogue"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                {isAr
                  ? "أكثر من مئة برنامج في المالية والذكاء الاصطناعي والقيادة والحوكمة - احصل على عرض سعر مخصّص لأي برنامج."
                  : "Over a hundred programmes across finance, AI, leadership and governance - request a tailored quote for any of them."}
              </p>
            </div>
          </div>
          <Link
            href="/courses"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline shrink-0"
          >
            {isAr ? "افتح الكتالوج" : "Open catalogue"}
            <ArrowLeft className="h-3 w-3 rotate-180" />
          </Link>
        </div>

        {/* Methodology trust badge - first asked-for concern from any
             stakeholder reviewing the platform: "where did the questions
             come from?". Links out to the methodology brief which
             answers item development, content validity, reliability
             planning, and limitations. */}
        <div className="rounded-md border bg-muted/20 p-3 flex items-start gap-3">
          <div className="rounded-full bg-accent/15 p-1.5 mt-0.5">
            <BookOpen className="h-3.5 w-3.5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">
              {isAr ? "كيف بنينا هذا التقييم" : "How we built this assessment"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {isAr
                ? "تطوير البنود، صدق المحتوى، خطة الثبات، الأطر المرجعية، والحدود الصريحة - موثقة في موجز المنهجية."
                : "Item development, content validity, reliability plan, reference frameworks, and explicit limitations - documented in the methodology brief."}
            </p>
            <a
              href="/api/ara/methodology/pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline mt-1"
            >
              {isAr ? "تنزيل موجز المنهجية (PDF)" : "Download the methodology brief (PDF)"}
              <ArrowLeft className="h-3 w-3 rotate-180" />
            </a>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground text-center">
          {isAr
            ? "احفظ رابط هذه الصفحة للرجوع إليها في أي وقت."
            : "Bookmark this page to return to your snapshot any time."}
        </p>
      </div>
    </div>
  );
}
