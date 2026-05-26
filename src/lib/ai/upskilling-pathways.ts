import { getAIClient, AI_MODEL } from "./client";

/**
 * AI Upskilling Pathways - the prescriptive layer above the course
 * recommender (src/lib/recommender/courses.ts).
 *
 * The recommender answers "which VIFM courses are relevant to this
 * learner's gaps?". This engine answers "in what ORDER, grouped how,
 * and why?" - it sequences the recommended courses into 2–4 stages,
 * foundational competencies first, and writes a rationale, a concrete
 * milestone, and a measurable outcome for each stage. Bilingual EN/AR.
 *
 * Source-agnostic: the caller passes a ranked course list (each course
 * carrying the gap drivers it addresses), so the same engine serves an
 * AC candidate, an ARA respondent, or a Fluent taker. Falls back to a
 * deterministic foundation→build→apply split when ANTHROPIC_API_KEY is
 * absent so the flow renders end-to-end.
 */

export type PathwayLanguage = "en" | "ar";

export type PathwayCourseInput = {
  code: string | null;
  title_en: string;
  title_ar: string | null;
  level: string;
  duration_days: number;
  // Gap drivers this course addresses (competency/pillar/factor label + size).
  drivers: Array<{ label: string; gap: number; relevance: number }>;
};

export type PathwayStage = {
  order: number;
  title_en: string;
  title_ar: string | null;
  focus: string[]; // competency / skill labels this stage targets
  course_codes: string[]; // codes (or titles) from the supplied course list
  rationale_en: string;
  rationale_ar: string | null;
  milestone_en: string;
  milestone_ar: string | null;
  outcome_en: string;
  outcome_ar: string | null;
  estimated_weeks: number;
};

export type UpskillingPathway = {
  summary_en: string;
  summary_ar: string | null;
  horizon_weeks: number;
  stages: PathwayStage[];
  ai_generated: boolean;
  on_track: boolean; // true when there were no gaps to sequence
};

export type PathwaySource = "ac" | "ara" | "fluent";

const clampInt = (n: unknown, min: number, max: number, fallback: number): number =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;

// ── On-track (no gaps) pathway ───────────────────────────────────
function onTrackPathway(language: PathwayLanguage): UpskillingPathway {
  return {
    on_track: true,
    ai_generated: false,
    horizon_weeks: 0,
    stages: [],
    summary_en:
      "No development gaps were detected against your target levels - you're on track. Keep consolidating your strengths; revisit this pathway after your next assessment.",
    summary_ar:
      language === "ar"
        ? "لم يتم رصد فجوات تطويرية مقارنة بمستوياتك المستهدفة - أنت على المسار الصحيح. واصل ترسيخ نقاط قوتك، وراجع هذا المسار بعد تقييمك التالي."
        : null,
  };
}

// ── Deterministic fallback (no API key) ──────────────────────────
const STAGE_TEMPLATES = [
  {
    title_en: "Foundation",
    title_ar: "التأسيس",
    rationale_en: "Close the widest gaps first - these are the foundations the rest of your development builds on.",
    rationale_ar: "أغلق أوسع الفجوات أولًا - فهي الأساس الذي يُبنى عليه بقية تطويرك.",
    milestone_en: "Complete the foundation course(s) and apply one new technique in your day-to-day work.",
    milestone_ar: "أكمل دورة (دورات) التأسيس وطبّق أسلوبًا جديدًا واحدًا في عملك اليومي.",
    outcome_en: "Move the targeted competencies up at least one proficiency level.",
    outcome_ar: "ارفع الكفاءات المستهدفة مستوى واحدًا على الأقل من الإتقان.",
  },
  {
    title_en: "Build",
    title_ar: "البناء",
    rationale_en: "Build on the foundation with intermediate skills that compound the early gains.",
    rationale_ar: "ابنِ على الأساس بمهارات متوسطة تُراكم المكاسب المبكرة.",
    milestone_en: "Lead a small piece of work that exercises the newly built skills.",
    milestone_ar: "قُد جزءًا صغيرًا من العمل يستثمر المهارات المُكتسبة حديثًا.",
    outcome_en: "Demonstrate consistent competence in the focus areas across multiple tasks.",
    outcome_ar: "أظهر كفاءة متسقة في مجالات التركيز عبر مهام متعددة.",
  },
  {
    title_en: "Apply & Extend",
    title_ar: "التطبيق والتوسّع",
    rationale_en: "Apply everything to a real deliverable and extend into advanced practice.",
    rationale_ar: "طبّق كل ما تعلمته على ناتج فعلي وتوسّع نحو الممارسة المتقدمة.",
    milestone_en: "Deliver an end-to-end output and gather feedback from a manager or peer.",
    milestone_ar: "سلّم ناتجًا متكاملًا واجمع ملاحظات من مدير أو زميل.",
    outcome_en: "Operate at or above target level and mentor others in the focus areas.",
    outcome_ar: "اعمل عند المستوى المستهدف أو أعلى منه ووجّه الآخرين في مجالات التركيز.",
  },
];

function fallbackPathway(
  courses: PathwayCourseInput[],
  language: PathwayLanguage
): UpskillingPathway {
  const wantsAr = language === "ar";
  const courseRef = (c: PathwayCourseInput) => c.code || c.title_en;

  // Decide stage count from the number of courses.
  const stageCount = courses.length <= 2 ? 1 : courses.length <= 4 ? 2 : 3;
  const perStage = Math.ceil(courses.length / stageCount);

  const stages: PathwayStage[] = [];
  for (let i = 0; i < stageCount; i++) {
    const slice = courses.slice(i * perStage, (i + 1) * perStage);
    if (slice.length === 0) continue;
    const tpl = STAGE_TEMPLATES[Math.min(i, STAGE_TEMPLATES.length - 1)];
    const focus = Array.from(
      new Set(slice.flatMap((c) => c.drivers.map((d) => d.label)))
    ).slice(0, 4);
    const weeks = Math.max(2, Math.round(slice.reduce((a, c) => a + c.duration_days, 0) / 5));
    stages.push({
      order: i + 1,
      title_en: tpl.title_en,
      title_ar: wantsAr ? tpl.title_ar : null,
      focus,
      course_codes: slice.map(courseRef),
      rationale_en: tpl.rationale_en,
      rationale_ar: wantsAr ? tpl.rationale_ar : null,
      milestone_en: tpl.milestone_en,
      milestone_ar: wantsAr ? tpl.milestone_ar : null,
      outcome_en: tpl.outcome_en,
      outcome_ar: wantsAr ? tpl.outcome_ar : null,
      estimated_weeks: weeks,
    });
  }

  return {
    on_track: false,
    ai_generated: false,
    horizon_weeks: stages.reduce((a, s) => a + s.estimated_weeks, 0),
    stages,
    summary_en:
      "A sequenced plan built from your highest-priority gaps: start with the foundations, then build, then apply. (AI narration is disabled - set ANTHROPIC_API_KEY for a tailored rationale.)",
    summary_ar: wantsAr
      ? "خطة متسلسلة مبنية على فجواتك الأعلى أولوية: ابدأ بالأساسيات ثم البناء ثم التطبيق. (سرد الذكاء الاصطناعي مُعطّل - اضبط ANTHROPIC_API_KEY للحصول على مبرر مخصص.)"
      : null,
  };
}

// ── AI-sequenced pathway ─────────────────────────────────────────
export async function generateUpskillingPathway(input: {
  learnerName?: string | null;
  language: PathwayLanguage;
  source?: PathwaySource;
  courses: PathwayCourseInput[];
}): Promise<UpskillingPathway> {
  if (input.courses.length === 0) return onTrackPathway(input.language);

  const client = getAIClient();
  if (!client) return fallbackPathway(input.courses, input.language);

  const wantsAr = input.language === "ar";
  const sourceLabel =
    input.source === "ara"
      ? "AI-readiness pillar gaps"
      : input.source === "fluent"
      ? "English-proficiency gaps"
      : "assessment-centre competency gaps";

  const system =
    `You are a learning & development architect for VIFM, a GCC finance & ` +
    `management institute. Given a learner's diagnosed ${sourceLabel} and a ranked ` +
    `set of recommended VIFM courses (each tagged with the gaps it closes and a ` +
    `relevance weight 1–3), design a SEQUENCED upskilling pathway of 2–4 stages. ` +
    `Put foundational/prerequisite competencies first; group related competencies ` +
    `into the same stage; assign every recommended course to exactly one stage using ` +
    `its code. For each stage write a tight rationale (why this, why now), one ` +
    `concrete milestone (how the learner knows they progressed), and one measurable ` +
    `outcome. Be specific and practical for a working professional.`;

  const courseLines = input.courses.map((c, i) => {
    const drivers = c.drivers
      .map((d) => `${d.label} (gap ${d.gap}×rel ${d.relevance})`)
      .join(", ");
    return `${i + 1}. code=${c.code || "(none)"} | "${c.title_en}" | level ${c.level} | ~${c.duration_days}d | closes: ${drivers}`;
  });

  const user = [
    input.learnerName ? `Learner: ${input.learnerName}` : `Learner: (anonymous)`,
    ``,
    `Recommended VIFM courses, ranked by fit (highest gap impact first):`,
    ...courseLines,
    ``,
    `Design the pathway. Use ONLY the course codes/titles listed above; do not invent courses.`,
    wantsAr
      ? `Provide every text field in BOTH English and Modern Standard Arabic (Gulf-friendly).`
      : `Provide every text field in English; set each _ar field to null.`,
    ``,
    `Return JSON ONLY (no markdown fences):`,
    `{`,
    `  "summary_en":"<2-3 sentences>", "summary_ar":${wantsAr ? '"<arabic>"' : "null"},`,
    `  "horizon_weeks":<int>,`,
    `  "stages":[`,
    `    { "order":1, "title_en":"...","title_ar":${wantsAr ? '"..."' : "null"},`,
    `      "focus":["<competency>"], "course_codes":["<code or title from the list>"],`,
    `      "rationale_en":"...","rationale_ar":${wantsAr ? '"..."' : "null"},`,
    `      "milestone_en":"...","milestone_ar":${wantsAr ? '"..."' : "null"},`,
    `      "outcome_en":"...","outcome_ar":${wantsAr ? '"..."' : "null"},`,
    `      "estimated_weeks":<int> }`,
    `  ]`,
    `}`,
  ].join("\n");

  // Valid references the model may use (codes + titles); filter hallucinations.
  const validRefs = new Set<string>();
  for (const c of input.courses) {
    if (c.code) validRefs.add(c.code);
    validRefs.add(c.title_en);
  }

  try {
    const res = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 3000,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("no text");
    const match = block.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    const p = JSON.parse(match[0]) as {
      summary_en?: string;
      summary_ar?: string | null;
      horizon_weeks?: number;
      stages?: Array<Record<string, unknown>>;
    };

    const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
    const strOrNull = (v: unknown): string | null =>
      typeof v === "string" && v.trim() ? v.trim() : null;

    const stages: PathwayStage[] = (p.stages ?? [])
      .map((s, i): PathwayStage | null => {
        const title_en = str(s.title_en);
        if (!title_en) return null;
        const focus = Array.isArray(s.focus) ? s.focus.map((f) => String(f)).filter(Boolean).slice(0, 6) : [];
        const codes = Array.isArray(s.course_codes)
          ? s.course_codes.map((c) => String(c)).filter((c) => validRefs.has(c))
          : [];
        return {
          order: clampInt(s.order, 1, 10, i + 1),
          title_en,
          title_ar: wantsAr ? strOrNull(s.title_ar) : null,
          focus,
          course_codes: codes,
          rationale_en: str(s.rationale_en) || "-",
          rationale_ar: wantsAr ? strOrNull(s.rationale_ar) : null,
          milestone_en: str(s.milestone_en) || "-",
          milestone_ar: wantsAr ? strOrNull(s.milestone_ar) : null,
          outcome_en: str(s.outcome_en) || "-",
          outcome_ar: wantsAr ? strOrNull(s.outcome_ar) : null,
          estimated_weeks: clampInt(s.estimated_weeks, 1, 26, 4),
        };
      })
      .filter((s): s is PathwayStage => s !== null)
      .sort((a, b) => a.order - b.order)
      .map((s, i) => ({ ...s, order: i + 1 }));

    if (stages.length === 0) return fallbackPathway(input.courses, input.language);

    return {
      on_track: false,
      ai_generated: true,
      summary_en: str(p.summary_en) || "Your sequenced upskilling pathway.",
      summary_ar: wantsAr ? strOrNull(p.summary_ar) : null,
      horizon_weeks:
        clampInt(p.horizon_weeks, 1, 104, 0) ||
        stages.reduce((a, s) => a + s.estimated_weeks, 0),
      stages,
    };
  } catch (err) {
    console.error("[upskilling-pathways] generate failed:", err);
    return fallbackPathway(input.courses, input.language);
  }
}
