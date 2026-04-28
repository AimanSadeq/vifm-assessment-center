import { notFound } from "next/navigation";
import Link from "next/link";
import { Compass, Sparkles, ArrowLeft, FileDown } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadRespondentByToken, loadQuestionsForRespondent } from "@/lib/ara/respondent-access";
import {
  ARA_INDIVIDUAL_FACTORS,
  ARA_INDIVIDUAL_FACTOR_IDS,
  type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";
import { recommendCoursesForIndividualSnapshot } from "@/lib/recommender/courses";
import { RecommendedCoursesPanel } from "@/components/shared/recommended-courses-panel";

export const dynamic = "force-dynamic";

type Props = { params: { token: string } };

const TARGET = 4;

export default async function PersonalResultsPage({ params }: Props) {
  const ctx = await loadRespondentByToken(params.token);
  if (!ctx) return notFound();

  // Personal results page is valid for:
  //   - Mode A/B individual-stage assessments (the primary case), AND
  //   - Mode C respondents on an org assessment that has the individual
  //     layer enabled — those respondents have answered the four-factor
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
    if (ans == null) continue;
    // Likert items use score_map keyed on the option label; look up the
    // numeric score for the given answer_value. answer_value is the label
    // they picked.
    const numeric = typeof ans === "number"
      ? ans
      : (q.score_map?.[String(ans)] ?? null);
    if (typeof numeric === "number" && Number.isFinite(numeric)) {
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

  const recommendations = await recommendCoursesForIndividualSnapshot({
    factorScores,
    target: TARGET,
    limit: 5,
  });

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
        <Card className="bg-gradient-to-br from-primary to-navy-blue text-primary-foreground border-0">
          <CardContent className="p-5 flex items-center gap-5">
            <div>
              <p className="text-xs uppercase tracking-widest opacity-70">
                {isAr ? "النتيجة الإجمالية" : "Overall snapshot"}
              </p>
              <p className="text-4xl font-bold tabular-nums mt-1">
                {overallScore.toFixed(1)}
                <span className="text-sm opacity-60 font-normal"> / 5</span>
              </p>
            </div>
            <div className="text-sm opacity-90 max-w-md">
              {overallScore >= 4
                ? (isAr ? "جاهزية عالية. أنت بالفعل تستفيد من الذكاء الاصطناعي بشكل جيد عبر العوامل الأربعة." : "Strong readiness. You're already getting good leverage from AI across all four factors.")
                : overallScore >= 3
                  ? (isAr ? "جاهزية متوسطة. هناك عاملان أو ثلاثة يمكن تطويرها لزيادة تأثيرك." : "Moderate readiness — two or three factors are ripe for development to lift your impact.")
                  : (isAr ? "فرصة كبيرة للتطوير. ابدأ بالعامل ذي الدرجة الأقل لتحقيق أكبر تأثير." : "Significant opportunity to develop. Start with your lowest-scoring factor for the biggest lift.")}
            </div>
          </CardContent>
        </Card>

        {/* Per-factor breakdown */}
        <div className="grid gap-3 sm:grid-cols-2">
          {ARA_INDIVIDUAL_FACTORS.map((f) => {
            const score = factorScores[f.id];
            const tone = score >= 4 ? "Strong" : score >= 3 ? "Developing" : "Opportunity";
            const toneColor =
              score >= 4 ? "bg-emerald-100 text-emerald-900 border-emerald-200"
              : score >= 3 ? "bg-amber-100 text-amber-900 border-amber-200"
              : "bg-rose-100 text-rose-900 border-rose-200";
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
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {score > 0 ? score.toFixed(1) : "—"}
                  <span className="text-xs text-muted-foreground font-normal"> / 5</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                  {isAr ? f.description_ar : f.description_en}
                </p>
              </div>
            );
          })}
        </div>

        {/* Course recommendations */}
        <RecommendedCoursesPanel
          title={isAr ? "تطوّر مع برامج VIFM" : "Develop with VIFM programmes"}
          description={
            isAr
              ? "دورات VIFM التي تعالج الفجوات في عواملك ذات الدرجات الأقل، مرتبة حسب الملاءمة (حجم الفجوة × ملاءمة الدورة)."
              : "VIFM courses that address the gaps in your lower-scoring factors, ranked by fit (gap size × course relevance)."
          }
          emptyMessage={
            isAr
              ? "لا توجد توصيات حالياً — جميع عواملك قريبة من المستوى المستهدف، أو الكتالوج الحالي لا يغطي بعد العوامل ذات الدرجات الأقل."
              : "No recommendations yet — either all your factors are near target, or the catalogue doesn't yet cover the relevant capabilities."
          }
          courses={recommendations}
          context="ac"
        />

        <p className="text-[11px] text-muted-foreground text-center">
          {isAr
            ? "احفظ رابط هذه الصفحة للرجوع إليها في أي وقت."
            : "Bookmark this page to return to your snapshot any time."}
        </p>
      </div>
    </div>
  );
}
