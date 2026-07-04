// Org-scoped intelligence for the client portal's insights sheet (server-only).
// Persona cohort math mirrors the admin results loader: per-session mean of
// reverse-mapped 1-5 responses, then a cohort mean + interpretation-band mix.
// Tolerant throughout - missing tables/columns yield empty intel, never errors.

import { createServiceClient } from "@/lib/supabase/server";
import { overallSelfScore, type PersonaScoreRow } from "@/lib/scoring/behavioral";
import { personaBand } from "@/lib/scoring/persona-bands";

export type PersonaOrgIntel = {
  completed: number;
  cohortMean: number | null;
  bandMix: { key: string; label: string; count: number }[];
};

export async function personaOrgIntel(orgId: string): Promise<PersonaOrgIntel> {
  const empty: PersonaOrgIntel = { completed: 0, cohortMean: null, bandMix: [] };
  try {
    const sb = createServiceClient();
    const { data: sessions } = await sb
      .from("behavioral_assessment_sessions")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "submitted")
      .order("created_at", { ascending: false })
      .limit(200);
    const ids = (sessions ?? []).map((s) => s.id as string);
    if (ids.length === 0) return empty;

    // Range-paginate: the responses set can exceed PostgREST's 1000-row cap.
    type Resp = PersonaScoreRow & { session_id: string };
    const responses: Resp[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from("behavioral_assessment_responses")
        .select("session_id, competency_id, raw_score, is_reverse, item_type, answer_data")
        .in("session_id", ids)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      responses.push(...(data as unknown as Resp[]));
      if (data.length < PAGE) break;
    }

    // Ipsative-aware per-session mean (forced-choice rows collapsed, not averaged
    // as Likert), driving the cohort mean + band mix.
    const bySession = new Map<string, PersonaScoreRow[]>();
    for (const r of responses) {
      if (!bySession.has(r.session_id)) bySession.set(r.session_id, []);
      bySession.get(r.session_id)!.push(r);
    }
    const means: number[] = [];
    for (const rows of bySession.values()) {
      const m = overallSelfScore(rows);
      if (m !== null) means.push(m);
    }
    if (means.length === 0) return { completed: ids.length, cohortMean: null, bandMix: [] };

    const cohortMean = Math.round((means.reduce((a, b) => a + b, 0) / means.length) * 100) / 100;
    const mix = new Map<string, { key: string; label: string; count: number }>();
    for (const m of means) {
      const band = personaBand(m);
      const entry = mix.get(band.key) ?? { key: band.key, label: band.label, count: 0 };
      entry.count += 1;
      mix.set(band.key, entry);
    }
    return {
      completed: means.length,
      cohortMean,
      bandMix: [...mix.values()].sort((a, b) => b.count - a.count),
    };
  } catch {
    return empty;
  }
}
