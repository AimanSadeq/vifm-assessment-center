"use client";

// Result-page explainer for the Technical sandbox: a plain-language narrative
// about the user's answers, the proficiency-tier definitions, and the exact
// scoring algorithm (so an admin/candidate can see how the single "assessment
// complete" total is derived). Pure presentational; no data fetching.

type Tier = "basic" | "intermediate" | "advanced";
type Block = { nameEn: string; scorePct: number };
type Pillar = { nameEn: string; nameAr?: string | null; blocks: Block[] };

const TIER_LABEL: Record<Tier, { en: string; ar: string }> = {
  advanced: { en: "Advanced", ar: "متقدّم" },
  intermediate: { en: "Intermediate", ar: "متوسّط" },
  basic: { en: "Basic", ar: "أساسي" },
};

export function ScoreMethodology({
  overallPct,
  overallTier,
  pillars,
  ar,
  showCombined,
  mcqPct,
}: {
  overallPct: number;
  overallTier: Tier;
  pillars: Pillar[];
  ar: boolean;
  showCombined: boolean;
  mcqPct: number;
}) {
  const pmeans = pillars
    .map((p) => ({
      name: ar ? p.nameAr ?? p.nameEn : p.nameEn,
      mean: p.blocks.length ? Math.round(p.blocks.reduce((s, b) => s + b.scorePct, 0) / p.blocks.length) : 0,
    }))
    .sort((a, b) => b.mean - a.mean);
  const strongest = pmeans[0];
  const weakest = pmeans[pmeans.length - 1];
  const tierLabel = ar ? TIER_LABEL[overallTier].ar : TIER_LABEL[overallTier].en;

  const tierSentence: Record<Tier, { en: string; ar: string }> = {
    advanced: {
      en: "Work is consistently correct, including the harder edge cases - a dependable level for real tasks.",
      ar: "العمل صحيح باستمرار، بما في ذلك الحالات الأصعب - مستوى يُعتمد عليه في المهام الواقعية.",
    },
    intermediate: {
      en: "Core mechanics are sound in standard cases, with some gaps to close on the harder checks.",
      ar: "الأساسيات سليمة في الحالات المعتادة، مع بعض الفجوات في الفحوص الأصعب.",
    },
    basic: {
      en: "Foundational skills are emerging; targeted practice on the core mechanics will move the needle fastest.",
      ar: "المهارات الأساسية في طور النمو؛ التدريب المركّز على الأساسيات هو الأسرع أثرًا.",
    },
  };

  const narrative = ar
    ? `بشكل عام، هذه نتيجة ${tierLabel} (${overallPct}%). ${tierSentence[overallTier].ar}` +
      (strongest ? ` أقوى مجال: ${strongest.name} (${strongest.mean}%).` : "") +
      (weakest && pmeans.length > 1 ? ` الأكثر حاجة للتطوير: ${weakest.name} (${weakest.mean}%).` : "")
    : `Overall, this is an ${tierLabel.toLowerCase()} result (${overallPct}%). ${tierSentence[overallTier].en}` +
      (strongest ? ` Strongest area: ${strongest.name} (${strongest.mean}%).` : "") +
      (weakest && pmeans.length > 1 ? ` Most room to grow: ${weakest.name} (${weakest.mean}%).` : "");

  return (
    <div className="space-y-3" dir={ar ? "rtl" : "ltr"}>
      {/* Narrative */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-1 text-sm font-semibold text-foreground">
          {ar ? "ملخّص الأداء" : "What your answers show"}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{narrative}</p>
      </div>

      {/* Tier definitions + how it's scored */}
      <details className="rounded-lg border border-border bg-muted/30 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          {ar ? "كيف تُحتسب الدرجة + تعريف المستويات" : "How this score is calculated + level definitions"}
        </summary>
        <div className="mt-3 space-y-3 text-xs leading-relaxed text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">{ar ? "تعريف المستويات" : "Proficiency levels"}</p>
            <ul className="mt-1 space-y-1">
              <li>
                <strong>{ar ? TIER_LABEL.advanced.ar : TIER_LABEL.advanced.en}</strong> (85-100%) -{" "}
                {ar ? "أداء صحيح ومتسق بما في ذلك الحالات الأصعب." : "consistently correct, including harder edge cases."}
              </li>
              <li>
                <strong>{ar ? TIER_LABEL.intermediate.ar : TIER_LABEL.intermediate.en}</strong> (60-84%) -{" "}
                {ar ? "صحيح في الحالات المعتادة مع بعض الفجوات." : "correct in standard cases, with some gaps."}
              </li>
              <li>
                <strong>{ar ? TIER_LABEL.basic.ar : TIER_LABEL.basic.en}</strong> (0-59%) -{" "}
                {ar ? "مهارات أساسية في طور النمو." : "emerging skills; core mechanics need development."}
              </li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">{ar ? "خوارزمية الدرجة" : "Scoring algorithm"}</p>
            <ol className="mt-1 list-decimal space-y-1 ps-4">
              <li>
                {ar
                  ? "كل مهمة تحتوي على نقاط تحقّق تُقارَن آليًا بالنتيجة المتوقعة (نجاح/إخفاق)، ولكل نقطة وزن."
                  : "Each task has checkpoints auto-validated against the expected result (pass/fail), each with a weight."}
              </li>
              <li>
                {ar
                  ? "درجة كل مهارة = النسبة المئوية المرجّحة لنقاط التحقق الناجحة."
                  : "A skill block's score = the weighted percentage of its checkpoints passed."}
              </li>
              <li>
                {ar
                  ? "الدرجة الإجمالية = متوسط درجات كل المهارات."
                  : "The overall score = the average of all skill-block scores."}
                {showCombined
                  ? ar
                    ? ` ثم تُمزَج مع قسم المعرفة (المعرفة ${mcqPct}% + العملي ${100 - mcqPct}%).`
                    : ` It is then blended with the knowledge section (knowledge ${mcqPct}% + hands-on ${100 - mcqPct}%).`
                  : ""}
              </li>
              <li>
                {ar
                  ? "يُشتق المستوى من الدرجة: متقدّم ≥ 85٪، متوسّط ≥ 60٪، أساسي < 60٪."
                  : "The tier is derived from the score: Advanced ≥ 85%, Intermediate ≥ 60%, Basic < 60%."}
              </li>
            </ol>
          </div>
        </div>
      </details>
    </div>
  );
}
