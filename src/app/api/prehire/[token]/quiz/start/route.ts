import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findCandidateByToken } from "@/lib/prehire/candidate-access";
import { generateQuizQuestions } from "@/lib/ai/quiz-generator";
import type { BehavioralIndicator, QuizQuestion } from "@/types/database";

type StoredDetail = { questions?: QuizQuestion[] } | null;

// Target deck size. The quiz is a ~5-minute screen, so it stays about 7 items
// TOTAL regardless of how many competencies feed it - we sample the top few
// competencies by weight and take a couple of items from each (NOT 7-per-comp).
const TARGET_DECK_SIZE = 7;
// How many of the highest-weighted competencies we draw from. Capping the
// breadth keeps the deck coherent and the generation cost bounded.
const MAX_COMPETENCIES = 4;
// An added-but-not-in-the-role-profile competency has no weight; give it a
// neutral mid weight so it ranks below explicitly high-priority picks but above
// low-priority ones.
const DEFAULT_WEIGHT = 3;
// Per-generation timeout. Each competency's deck is one Claude round-trip; bound
// it so a slow/stalled call can't leave the candidate stuck on "Preparing" (the
// Anthropic SDK's own default timeout is minutes). On timeout the call yields
// null and that competency simply contributes no items.
const GEN_TIMEOUT_MS = 35_000;
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

// Send the candidate everything EXCEPT the answer key (correct_index,
// explanations, points) - integrity matters for a hiring screen.
function strip(q: QuizQuestion) {
  return {
    id: q.id,
    type: q.type,
    prompt_en: q.prompt_en,
    prompt_ar: q.prompt_ar,
    options_en: q.options_en,
    options_ar: q.options_ar,
    sequence: q.sequence ?? null,
  };
}

const PRIORITY_BUMP: Record<string, number> = { high: 2, medium: 0, low: -1 };

type RankedCompetency = {
  id: string;
  weight: number;
};

/**
 * Resolve the competency set the quiz draws from, in priority order:
 *   (a) requisition.competency_ids (CAL-PRE-502 explicit set), else
 *   (b) the role profile's role_profile_competencies, else
 *   (c) [] (caller falls back to the synthetic single-competency deck).
 * Returns competency ids ranked by effective weight (desc).
 */
async function resolveRankedCompetencies(
  svc: ReturnType<typeof createServiceClient>,
  competencyIds: string[] | null,
  roleProfileId: string | null
): Promise<RankedCompetency[]> {
  // (a) Explicit set: rank by the role-profile weight/priority when the
  // competency happens to be in the profile; otherwise use the default weight.
  if (competencyIds && competencyIds.length > 0) {
    const weightById = new Map<string, number>();
    if (roleProfileId) {
      const { data: rpc } = await svc
        .from("role_profile_competencies")
        .select("competency_id, weight, priority")
        .eq("role_profile_id", roleProfileId);
      for (const row of (rpc ?? []) as {
        competency_id: string;
        weight: number | null;
        priority: string | null;
      }[]) {
        weightById.set(
          row.competency_id,
          (row.weight ?? DEFAULT_WEIGHT) + (PRIORITY_BUMP[row.priority ?? "medium"] ?? 0)
        );
      }
    }
    return competencyIds
      .map((id) => ({ id, weight: weightById.get(id) ?? DEFAULT_WEIGHT }))
      .sort((a, b) => b.weight - a.weight);
  }

  // (b) No explicit set: fall back to the role profile's competencies.
  if (roleProfileId) {
    const { data: rpc } = await svc
      .from("role_profile_competencies")
      .select("competency_id, weight, priority")
      .eq("role_profile_id", roleProfileId);
    return ((rpc ?? []) as {
      competency_id: string;
      weight: number | null;
      priority: string | null;
    }[])
      .map((row) => ({
        id: row.competency_id,
        weight: (row.weight ?? DEFAULT_WEIGHT) + (PRIORITY_BUMP[row.priority ?? "medium"] ?? 0),
      }))
      .sort((a, b) => b.weight - a.weight);
  }

  // (c) Nothing to resolve - caller uses the synthetic fallback.
  return [];
}

/**
 * Split the per-competency target across the top-N competencies so the COMBINED
 * deck lands on TARGET_DECK_SIZE. Earlier (higher-weight) competencies get the
 * extra item when the split is uneven. e.g. 4 comps -> [2,2,2,1]; 2 -> [4,3].
 */
function allocate(count: number, total: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const ctx = await findCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (!ctx.requisition.stage_config.some((s) => s.kind === "quiz")) {
    return NextResponse.json({ error: "Quiz not configured for this role" }, { status: 400 });
  }

  const svc = createServiceClient();

  const { data: existing } = await svc
    .from("prehire_stage_results")
    .select("id, status, detail")
    .eq("prehire_candidate_id", ctx.candidate.id)
    .eq("kind", "quiz")
    .maybeSingle();

  if (existing?.status === "completed") {
    return NextResponse.json({ done: true });
  }
  // Resume an in-progress attempt with the same questions (no regeneration).
  // A changed competency set must NEVER regenerate a mid-flight deck or leak the
  // key - the stored questions are served verbatim (still answer-key-stripped).
  const stored = (existing?.detail as StoredDetail)?.questions;
  if (stored && stored.length > 0) {
    return NextResponse.json({ questions: stored.map(strip) });
  }

  // Resolve the curated competency set (CAL-PRE-502). Falls back to the role
  // profile, then to the synthetic single-competency deck for full back-compat.
  const ranked = await resolveRankedCompetencies(
    svc,
    ctx.requisition.competency_ids,
    ctx.requisition.role_profile_id
  );

  // Target proficiency from the role profile (default 3), shared across all the
  // competency-specific generations.
  let targetScore = 3;
  if (ctx.requisition.role_profile_id) {
    const { data: rp } = await svc
      .from("role_profiles")
      .select("default_target_proficiency")
      .eq("id", ctx.requisition.role_profile_id)
      .maybeSingle();
    const t = (rp?.default_target_proficiency as number | null) ?? null;
    if (typeof t === "number" && t >= 1 && t <= 5) targetScore = t;
  }

  let questions: QuizQuestion[] | null = null;

  if (ranked.length > 0) {
    // Take the top-N highest-weighted competencies and split TARGET_DECK_SIZE
    // items across them (NOT 7-per-competency) so the deck stays ~7 total.
    const top = ranked.slice(0, MAX_COMPETENCIES);
    const allocation = allocate(top.length, TARGET_DECK_SIZE);

    const compIds = top.map((c) => c.id);
    const [{ data: comps }, { data: indicatorRows }] = await Promise.all([
      svc.from("competencies").select("id, name, description").in("id", compIds),
      svc
        .from("behavioral_indicators")
        .select("competency_id, indicator_type, description")
        .in("competency_id", compIds),
    ]);

    const compById = new Map(
      ((comps ?? []) as { id: string; name: string; description: string | null }[]).map((c) => [
        c.id,
        c,
      ])
    );
    const indicatorsByComp = new Map<
      string,
      Pick<BehavioralIndicator, "indicator_type" | "description">[]
    >();
    for (const row of (indicatorRows ?? []) as {
      competency_id: string;
      indicator_type: BehavioralIndicator["indicator_type"];
      description: string;
    }[]) {
      const list = indicatorsByComp.get(row.competency_id) ?? [];
      list.push({ indicator_type: row.indicator_type, description: row.description });
      indicatorsByComp.set(row.competency_id, list);
    }

    // Generate each competency's deck IN PARALLEL (was sequential - up to 4
    // serial Claude calls, which presents to the candidate as a stuck
    // "Preparing"). Each call is timeout-guarded; a slow one just yields no items.
    const decks = await Promise.all(
      top.map(async (c, i): Promise<QuizQuestion[]> => {
        const wanted = allocation[i];
        if (wanted <= 0) return [];
        const comp = compById.get(c.id);
        if (!comp) return [];

        // Behavioural indicators carry both real BIs and "[DEV TIP] "-prefixed
        // development tips (migration 00004). Split them so the generator treats
        // tips as suggestions and BIs as observed behaviours.
        const all = indicatorsByComp.get(comp.id) ?? [];
        const indicators = all.filter((r) => !r.description.startsWith("[DEV TIP]"));
        const developmentTips = all
          .filter((r) => r.description.startsWith("[DEV TIP]"))
          .map((r) => r.description.replace(/^\[DEV TIP\]\s*/, ""))
          .slice(0, 3);

        // The generator returns ~7 items per competency; keep only `wanted` of
        // them, grounded in that competency's own indicators.
        const deck = await withTimeout(
          generateQuizQuestions({
            competency: comp,
            indicators,
            developmentTips,
            currentScore: null,
            targetScore,
            bilingual: true,
          }),
          GEN_TIMEOUT_MS
        );
        return deck && deck.length > 0 ? deck.slice(0, wanted) : [];
      })
    );
    const collected: QuizQuestion[] = decks.flat();

    if (collected.length > 0) {
      // Re-id sequentially so ids are unique across competencies, and hard-cap to
      // TARGET_DECK_SIZE as a safety net (allocation already sums to it).
      questions = collected
        .slice(0, TARGET_DECK_SIZE)
        .map((q, i) => ({ ...q, id: `q-${i + 1}` }));
    }
  }

  // (c) Synthetic single-competency fallback - keeps legacy requisitions (no
  // competency set, no role profile, or an AI/DB miss above) producing a quiz.
  if (!questions || questions.length === 0) {
    questions = await withTimeout(
      generateQuizQuestions({
        competency: {
          id: "prehire",
          name: `${ctx.requisition.title} - core competency`,
          description: `Core professional competencies for the ${ctx.requisition.title} role.`,
        },
        indicators: [],
        currentScore: null,
        targetScore,
        bilingual: true,
      }),
      GEN_TIMEOUT_MS
    );
  }

  if (!questions || questions.length === 0) {
    return NextResponse.json(
      { error: "Couldn't generate the assessment right now. Please try again shortly." },
      { status: 503 }
    );
  }

  await svc.from("prehire_stage_results").upsert(
    {
      prehire_candidate_id: ctx.candidate.id,
      kind: "quiz",
      status: "in_progress",
      detail: { questions },
      started_at: new Date().toISOString(),
    },
    { onConflict: "prehire_candidate_id,kind" }
  );

  return NextResponse.json({ questions: questions.map(strip) });
}
