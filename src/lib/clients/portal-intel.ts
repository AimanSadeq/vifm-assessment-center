// Org-scoped intelligence for the client portal's insights sheet (server-only).
// Persona cohort math mirrors the admin results loader: per-session mean of
// reverse-mapped 1-5 responses, then a cohort mean + interpretation-band mix.
// Tolerant throughout - missing tables/columns yield empty intel, never errors.

import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages, chunkIds } from "@/lib/ara/paginate";
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
    // Page the FULL submitted-session set (deterministic .order('id')). A fixed
    // .limit(200) seeded the cohort mean + band mix from only the 200 newest
    // sittings, biasing the mean toward the most-recent cohort AND contradicting
    // the funnel's true head count on the same insights panel for any org past 200.
    const sessions = await fetchAllPages<{ id: string }>((from, to) =>
      sb
        .from("behavioral_assessment_sessions")
        .select("id")
        .eq("organization_id", orgId)
        .eq("status", "submitted")
        .order("id")
        .range(from, to),
    ).catch(() => [] as { id: string }[]);
    const ids = sessions.map((s) => s.id);
    if (ids.length === 0) return empty;

    // Responses: chunk the id list (a huge .in() is itself a problem) and page each
    // chunk over the 1000-row cap.
    type Resp = PersonaScoreRow & { session_id: string };
    const responses: Resp[] = [];
    for (const chunk of chunkIds(ids)) {
      const part = await fetchAllPages<Resp>((from, to) =>
        sb
          .from("behavioral_assessment_responses")
          .select("session_id, competency_id, raw_score, is_reverse, item_type, answer_data")
          .in("session_id", chunk)
          .order("id")
          .range(from, to),
      ).catch(() => [] as Resp[]);
      responses.push(...part);
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
