// ─────────────────────────────────────────────────────────────
// Persona per-competency hiring insights (AI). Given the candidate's actual
// item-level self-ratings per competency (which statements they rated high vs
// low) + the role target, generate a concise, VARIED, evidence-grounded insight
// per competency - not a template. One batched call. Falls back to a
// deterministic narrative when no API key (so the report always renders).
// ─────────────────────────────────────────────────────────────
import { getAIClient, AI_MODEL } from "@/lib/ai/client";
import { competencyNarrative } from "@/lib/scoring/persona-fit";
import { createServiceClient } from "@/lib/supabase/server";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { loadCompetencyDefinitions } from "@/lib/scoring/competency-definitions";

export type PersonaInsightCompetency = {
  competencyId: string;
  name: string;
  definition?: string | null;
  self: number;
  target: number;
  /** Per-statement effective alignment (1-5; reverse items already mapped). */
  items: { statement: string; score: number }[];
};

export type PersonaInsightInput = {
  roleName: string;
  competencies: PersonaInsightCompetency[];
};

const SYSTEM =
  "You are an occupational psychologist writing concise, professional per-competency insights " +
  "for a HIRING SCREENING report, based strictly on a candidate's behavioural self-ratings.\n" +
  "Rules:\n" +
  "- Ground each insight in the PATTERN of the candidate's own answers - call out which statements " +
  "they rated higher vs lower - and the overall self-score relative to the role target.\n" +
  "- VARY the wording across competencies. Never reuse a sentence or a template.\n" +
  "- 1-2 sentences each, specific and evidence-referenced.\n" +
  "- Self-report framing: describe what the answers indicate; do not issue verdicts.\n" +
  "- Do not fabricate anything beyond the supplied ratings. No em dashes.";

/**
 * Build the per-competency insight input for a session: the candidate's
 * item-level effective ratings (reverse mapped) + definition + self/target,
 * for each ROLE competency that was actually answered. Shared by the submit
 * path and the report route (lazy generation), so they can't drift.
 */
export async function buildInsightCompetencies(opts: {
  sessionId: string;
  roleComps: { competencyId: string; name: string; target: number }[];
  selfById: Map<string, number>;
}): Promise<PersonaInsightCompetency[]> {
  const sb = createServiceClient();
  const stmtByKey = new Map<string, string>();
  for (const c of BEHAVIORAL_COMPETENCIES) for (const it of c.items) stmtByKey.set(it.itemKey, it.textEn);
  const { data: responses } = await sb
    .from("behavioral_assessment_responses")
    .select("competency_id, item_key, raw_score, is_reverse")
    .eq("session_id", opts.sessionId);
  const itemsByComp = new Map<string, { statement: string; score: number }[]>();
  for (const r of responses ?? []) {
    const statement = stmtByKey.get(r.item_key as string);
    if (!statement) continue;
    const score = r.is_reverse ? 6 - Number(r.raw_score) : Number(r.raw_score);
    const cid = r.competency_id as string;
    if (!itemsByComp.has(cid)) itemsByComp.set(cid, []);
    itemsByComp.get(cid)!.push({ statement, score });
  }
  const defs = await loadCompetencyDefinitions();
  return opts.roleComps
    .filter((c) => opts.selfById.has(c.competencyId))
    .map((c) => ({
      competencyId: c.competencyId,
      name: c.name,
      definition: defs[c.competencyId],
      self: opts.selfById.get(c.competencyId) as number,
      target: c.target,
      items: itemsByComp.get(c.competencyId) ?? [],
    }));
}

export async function generatePersonaInsights(
  input: PersonaInsightInput,
): Promise<Record<string, string>> {
  const fallback = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const c of input.competencies) out[c.competencyId] = competencyNarrative(c.self, c.target);
    return out;
  };

  const ai = getAIClient();
  if (!ai || input.competencies.length === 0) return fallback();

  const payload = input.competencies.map((c) => ({
    id: c.competencyId,
    competency: c.name,
    definition: c.definition || undefined,
    selfScore: Number(c.self.toFixed(1)),
    roleTarget: Number(c.target.toFixed(1)),
    answers: c.items.map((it) => ({ statement: it.statement, rating: it.score })),
  }));

  try {
    const res = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 2200,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `Target role: ${input.roleName}\n\n` +
            `For EACH competency below, write one insight grounded in the candidate's answers. ` +
            `Return ONLY a JSON object mapping each competency "id" to its insight string.\n\n` +
            JSON.stringify(payload),
        },
      ],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return fallback();
    const m = block.text.match(/\{[\s\S]*\}/);
    if (!m) return fallback();
    const parsed = JSON.parse(m[0]) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const c of input.competencies) {
      const v = parsed[c.competencyId];
      out[c.competencyId] = typeof v === "string" && v.trim() ? v.trim() : competencyNarrative(c.self, c.target);
    }
    return out;
  } catch {
    return fallback();
  }
}
