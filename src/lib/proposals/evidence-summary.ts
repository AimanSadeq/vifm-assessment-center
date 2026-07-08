// Live evidence/reliability snapshot for the proposal's "Psychometric foundations"
// section + "Evidence & sample reports" appendix (Phase 2). Composes the real
// engine reads - cohort evidence counts + the psychometrics bank's Cronbach's α -
// into one compact, fully null-tolerant object. Called from the PDF routes
// (server-side) and passed into buildProposalHtml via opts.evidence, so a proposal
// PDF never 500s if the underlying tables aren't populated yet.

import { gatherEvidenceMetrics } from "@/lib/evidence-map/metrics";
import { loadPsyBank } from "@/lib/psychometrics/bank";

export type ProposalEvidence = {
  /** Logica cognitive reliability from the psychometrics bank. */
  logica: { alpha: number | null; approved: number; tier: string | null } | null;
  /** Fluent calibration counts (Claude-vs-human agreement substrate). */
  fluent: { calibrated: number; humanRatings: number; results: number } | null;
  /** Technical item-bank readiness. */
  technical: { approved: number; calibrated: number; cutScores: number } | null;
  /** ARC (AI Readiness) question validation + response volume. */
  arc: { verified: number; total: number; responses: number } | null;
  /** Reflect 360 seeded framework + response volume. */
  reflect: { competencies: number; behaviors: number; responses: number } | null;
};

/** Best-effort. Returns nulls for any instrument whose tables aren't ready. */
export async function loadProposalEvidence(): Promise<ProposalEvidence> {
  const empty: ProposalEvidence = { logica: null, fluent: null, technical: null, arc: null, reflect: null };
  try {
    const [metrics, bank] = await Promise.all([
      gatherEvidenceMetrics().catch(() => null),
      loadPsyBank().catch(() => null),
    ]);

    // Logica α: mean of the per-subtest Cronbach's α on the active cognitive bank.
    let logica: ProposalEvidence["logica"] = null;
    const cog = bank?.instruments?.find((i) => i.kind === "cognitive");
    if (cog) {
      const alphas = cog.scales.map((s) => s.alpha).filter((a): a is number => typeof a === "number" && a > 0);
      const approved = cog.scales.reduce((n, s) => n + (s.approved || 0), 0);
      const meanAlpha = alphas.length ? Math.round((alphas.reduce((n, a) => n + a, 0) / alphas.length) * 100) / 100 : null;
      logica = { alpha: meanAlpha, approved, tier: cog.tier ?? null };
    }

    const m = metrics as Record<string, Record<string, number | null>> | null;
    const n = (v: number | null | undefined) => (typeof v === "number" ? v : 0);

    const fluent = m?.fluent
      ? { calibrated: n(m.fluent.calibrated), humanRatings: n(m.fluent.humanRatings), results: n(m.fluent.results) }
      : null;
    const technical = m?.technical
      ? { approved: n(m.technical.approved), calibrated: n(m.technical.calibrated), cutScores: n(m.technical.cutScores) }
      : null;
    const arc = m?.arc
      ? { verified: n(m.arc.questionsVerified), total: n(m.arc.questionsTotal), responses: n(m.arc.responses) }
      : null;
    const reflect = m?.reflect
      ? { competencies: n(m.reflect.competencies), behaviors: n(m.reflect.behaviors), responses: n(m.reflect.responses) }
      : null;

    return { logica, fluent, technical, arc, reflect };
  } catch {
    return empty;
  }
}
