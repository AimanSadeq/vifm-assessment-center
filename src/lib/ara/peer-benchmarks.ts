import { createServiceClient } from "@/lib/supabase/server";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import type { AraPillarId } from "@/types/ara";

export type PeerBenchmarkCell = {
  pillar_id: AraPillarId;
  median: number | null;
  sample_size: number;
};

export type PeerBenchmarkResult = {
  sector: string;
  region: string;
  sample_size: number;
  has_enough_data: boolean;
  min_sample_required: number;
  pillars: PeerBenchmarkCell[];
};

// Require at least this many peer completions before we show real
// numbers - fewer than this and a median is more noise than signal.
const MIN_PEERS = 3;

/**
 * Compute median pillar raw_scores across peer organizations - same
 * region + same sector, status ∈ (completed, frozen, archived),
 * excluding sandbox assessments and the current assessment.
 *
 * Returns per-pillar medians plus an `has_enough_data` flag the caller
 * uses to decide between real numbers and the placeholder.
 */
export async function computePeerBenchmarks(
  currentAssessmentId: string,
  region: string,
  sector: string
): Promise<PeerBenchmarkResult> {
  const sb = createServiceClient();

  // Find peer assessments - same region + sector, completed data, not sandbox.
  const { data: peerAssessments } = await sb
    .from("ara_assessments")
    .select("id")
    .eq("region", region)
    .eq("sector", sector)
    .eq("is_sandbox", false)
    .in("status", ["completed", "frozen", "archived"])
    .neq("id", currentAssessmentId);

  const peerIds = (peerAssessments ?? []).map((a) => a.id);
  const sampleSize = peerIds.length;

  if (sampleSize < MIN_PEERS) {
    return {
      sector,
      region,
      sample_size: sampleSize,
      has_enough_data: false,
      min_sample_required: MIN_PEERS,
      pillars: ARA_PILLARS.map((p) => ({
        pillar_id: p.id,
        median: null,
        sample_size: 0,
      })),
    };
  }

  // Load all pillar scores from peers
  const { data: rows } = await sb
    .from("ara_pillar_scores")
    .select("pillar_id, raw_score")
    .in("assessment_id", peerIds);

  // Group scores by pillar, then take the median.
  const byPillar = new Map<string, number[]>();
  for (const r of rows ?? []) {
    if (r.raw_score == null) continue;
    const arr = byPillar.get(r.pillar_id) ?? [];
    arr.push(Number(r.raw_score));
    byPillar.set(r.pillar_id, arr);
  }

  const median = (arr: number[]): number | null => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  };

  return {
    sector,
    region,
    sample_size: sampleSize,
    has_enough_data: true,
    min_sample_required: MIN_PEERS,
    pillars: ARA_PILLARS.map((p) => {
      const scores = byPillar.get(p.id) ?? [];
      return {
        pillar_id: p.id,
        median: median(scores),
        sample_size: scores.length,
      };
    }),
  };
}
