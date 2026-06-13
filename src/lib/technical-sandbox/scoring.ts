// ─────────────────────────────────────────────────────────────
// Session-level scoring: roll block scores up to pillars (no band,
// per Decision 6) and to an overall function band. Banding lives at
// the Skill Block (competency) level only.
// ─────────────────────────────────────────────────────────────
import type { BlockScore, ProficiencyTier } from "./types";
import { tierFor } from "./validators";

export interface ScoredBlock {
  skillBlockId: string;
  pillarId: string;
  nameEn: string;
  nameAr?: string | null;
  scorePct: number;
  tier: ProficiencyTier;
}

export interface PillarRollup {
  pillarId: string;
  nameEn: string;
  nameAr?: string | null;
  blocks: ScoredBlock[];
  advancedCount: number;
  intermediateCount: number;
  basicCount: number;
  /** Mean of this pillar's block scores (display only; pillars are NOT banded). */
  meanPct: number;
}

export interface SessionScore {
  overallPct: number;
  overallTier: ProficiencyTier;
  pillars: PillarRollup[];
  blocks: ScoredBlock[];
}

export interface BlockInput {
  skillBlockId: string;
  pillarId: string;
  pillarNameEn: string;
  pillarNameAr?: string | null;
  pillarSort: number;
  nameEn: string;
  nameAr?: string | null;
  score: BlockScore;
}

export function scoreSession(blocks: BlockInput[]): SessionScore {
  const scoredBlocks: ScoredBlock[] = blocks.map((b) => ({
    skillBlockId: b.skillBlockId,
    pillarId: b.pillarId,
    nameEn: b.nameEn,
    nameAr: b.nameAr,
    scorePct: b.score.scorePct,
    tier: b.score.tier,
  }));

  const byPillar = new Map<string, BlockInput[]>();
  for (const b of blocks) {
    const arr = byPillar.get(b.pillarId) ?? [];
    arr.push(b);
    byPillar.set(b.pillarId, arr);
  }

  const pillars: PillarRollup[] = [...byPillar.values()]
    .sort((a, b) => a[0].pillarSort - b[0].pillarSort)
    .map((group) => {
      const blks = group.map((g) => ({
        skillBlockId: g.skillBlockId,
        pillarId: g.pillarId,
        nameEn: g.nameEn,
        nameAr: g.nameAr,
        scorePct: g.score.scorePct,
        tier: g.score.tier,
      }));
      const meanPct = Math.round(blks.reduce((s, x) => s + x.scorePct, 0) / (blks.length || 1));
      return {
        pillarId: group[0].pillarId,
        nameEn: group[0].pillarNameEn,
        nameAr: group[0].pillarNameAr,
        blocks: blks,
        advancedCount: blks.filter((x) => x.tier === "advanced").length,
        intermediateCount: blks.filter((x) => x.tier === "intermediate").length,
        basicCount: blks.filter((x) => x.tier === "basic").length,
        meanPct,
      };
    });

  const overallPct = Math.round(
    scoredBlocks.reduce((s, b) => s + b.scorePct, 0) / (scoredBlocks.length || 1),
  );

  return { overallPct, overallTier: tierFor(overallPct), pillars, blocks: scoredBlocks };
}
