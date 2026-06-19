import { notFound } from "next/navigation";
import Link from "next/link";
import { Compass, Sparkles, ArrowLeft, FileDown, BookOpen, GraduationCap } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadRespondentByToken, loadQuestionsForRespondent } from "@/lib/ara/respondent-access";
import { isStaffCaller } from "@/lib/ara/auth-guards";
import { calculateQuestionScore } from "@/lib/ara/scoring";
import {
  ARA_INDIVIDUAL_FACTORS,
  ARA_INDIVIDUAL_FACTOR_IDS,
  ARA_INDIVIDUAL_MATURITY_STAGES,
  getIndividualMaturityStage,
  validateTalentLens,
  TALENT_LENS_LABELS,
  FACTOR_DESCRIPTIVE,
  type AraIndividualFactorId,
  type AraIndividualMaturityStageId,
} from "@/lib/constants/ara-individual-factors";
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

type Props = { params: { token: string } };

const TARGET = 4;

/** Score range shown beside each overall maturity stage in the legend. */
const STAGE_RANGE: Record<AraIndividualMaturityStageId, { en: string; ar: string }> = {
  emerging: { en: "below 3", ar: "أقل من 3" },
  practising: { en: "3 to below 4", ar: "من 3 إلى أقل من 4" },
  embedded: { en: "4 and above", ar: "4 فأكثر" },
};

export default async function PersonalResultsPage({ params }: Props) {
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
  for (const q of questions) {
    const factorId = q.individual_factor_id as AraIndividualFactorId | null;
    if (!factorId) continue;
    const ans = answerByQuestionId.get(q.id);
    const numeric = calculateQuestionScore(q.question_type, ans ?? null, q.score_map);
    if (numeric != null) {
      factorTotals[factorId].sum += numeric;
      factorTotals[factorId].count += 1;
    }
  }

  const factorScores = ARA_INDIVIDUAL_FACTOR_IDS.reduce<Record<AraIndividualFactorId, number>>(
    (acc, id) => {
      const t = factorTotals[id];
      acc[id] = t.count > 0 ? t.sum / t.count : 0;
      return acc;
    },
    {} as Record<AraIndividualFactorId, number>
  );

  const overallScore =
    Object.values(factorScores).reduce((s, v) => s + v, 0) /
    ARA_INDIVIDUAL_FACTOR_IDS.length;

  // Talent lens (migration 00134). Drives R4-R7. NULL = generic framing
  // (legacy / anonymous / deep-linked) and reproduces today's output exactly.
  const talentLens = validateTalentLens(ctx.assessment.talent_lens);
  const isAcquisition = talentLens === "acquisition";

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

  return (
    <div className="min-h-screen bg-background" dir={isAr ? "rtl" : "ltr"}>
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <Link
            href="/ara"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            {isAr ? "إلى الصفحة الرئيسية" : "Back to portal home"}
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <Compass className="h-6 w-6 text-accent" />
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              {/* R4: talent-lens eyebrow when set; generic header otherwise. */}
              {talentLens && (
                <p className="text-[11px] font-semibold uppercase tracking-widest text-accent mb-1">
                  {isAr
                    ? TALENT_LENS_LABELS[talentLens].ar
                    : TALENT_LENS_LABELS[talentLens].en}
                </p>
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
