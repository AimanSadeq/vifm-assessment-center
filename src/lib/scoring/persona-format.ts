// ─────────────────────────────────────────────────────────────
// Persona item-presentation helpers (pure, no DB).
//
// Two presentation models over the same 41-competency bank:
//   - NORMATIVE  - the existing 1-5 Likert statements, but presented in a
//                  seeded-random flat order with section/cluster labels HIDDEN
//                  (reduces section priming + ordering effects).
//   - IPSATIVE   - forced-choice blocks: four forward statements (each from a
//                  different competency), pick "most like me" + "least like me".
//                  A bias-resistant complement to the Likert section.
//
// The seed makes the order reproducible (stored on the session); the same seed
// always yields the same shuffle + blocks, so a report can reconstruct exactly
// what the taker saw.
// ─────────────────────────────────────────────────────────────
import type { BehavioralCompetency } from "./behavioral-items";

// ── Seeded PRNG (mulberry32) + Fisher-Yates ──────────────────────
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A new, non-deterministic seed (caller stores it). Avoids Math.random hard dep. */
export function freshSeed(): number {
  // Combine two entropy-ish ints; fine for shuffling (not crypto).
  return ((Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0) || 1;
}

export function shuffleSeeded<T>(arr: readonly T[], seed: number): T[] {
  const out = arr.slice();
  const rnd = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Normative flat items ─────────────────────────────────────────
export type FlatNormItem = {
  itemKey: string;
  competencyId: string;
  reverse: boolean;
  textEn: string;
  textAr: string;
};

/** All Likert items flattened across competencies, in a seeded-random order. */
export function flattenNormativeItems(
  competencies: BehavioralCompetency[],
  seed: number,
): FlatNormItem[] {
  const flat: FlatNormItem[] = [];
  for (const c of competencies) {
    for (const it of c.items) {
      flat.push({
        itemKey: it.itemKey,
        competencyId: c.acCompetencyId,
        reverse: it.reverse,
        textEn: it.textEn,
        textAr: it.textAr,
      });
    }
  }
  return shuffleSeeded(flat, seed);
}

/** Chunk a flat list into fixed-size pages. */
export function paginate<T>(items: readonly T[], perPage: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages;
}

// ── Ipsative forced-choice blocks ────────────────────────────────
export type IpsativeStatement = {
  itemKey: string;        // prefixed "ips:" form used for the stored response row
  baseItemKey: string;    // the underlying bank item key
  competencyId: string;
  textEn: string;
  textAr: string;
};
export type IpsativeBlock = { blockId: string; statements: IpsativeStatement[] };

export const IPSATIVE_BLOCK_SIZE = 4;

/** How many forward statements per competency the forced-choice section draws
 *  (PER-10). The bank carries 3 forward items per competency; 2 roughly doubles
 *  the block count vs the original one-per-competency design. */
export const IPSATIVE_STATEMENTS_PER_COMPETENCY = 2;

/**
 * Build forced-choice blocks. Each competency contributes up to
 * `statementsPerCompetency` FORWARD (non-reverse) statements, slotted one-per-
 * round; each round is shuffled by a round-specific seed and chunked into blocks
 * of four. Because a round holds at most one statement per competency, every
 * block is four DIFFERENT competencies (no same-competency collision). More
 * rounds => more blocks (PER-10), so a competency can be ranked in several
 * blocks.
 *
 * SCORING NOTE: a competency's forced-choice signal is collapsed to ONE value
 * (rollupSelfScores in behavioral.ts: 3 + #most - #least, clamped 1-5), so
 * appearing in several blocks SHARPENS the signal without diluting the average
 * toward the mid. Reverse items are excluded (forced-choice rows are keyed
 * is_reverse=false).
 */
export function buildIpsativeBlocks(
  competencies: BehavioralCompetency[],
  seed: number,
  statementsPerCompetency: number = IPSATIVE_STATEMENTS_PER_COMPETENCY,
): IpsativeBlock[] {
  const rounds = Math.max(1, Math.floor(statementsPerCompetency));
  const blocks: IpsativeBlock[] = [];
  let blockNo = 1;
  for (let round = 0; round < rounds; round++) {
    const statements: IpsativeStatement[] = [];
    for (const c of competencies) {
      const forwards = c.items.filter((i) => !i.reverse);
      const fwd = forwards[round]; // the round-th forward item, if the competency has one
      if (!fwd) continue;
      statements.push({
        itemKey: `ips:${fwd.itemKey}`,
        baseItemKey: fwd.itemKey,
        competencyId: c.acCompetencyId,
        textEn: fwd.textEn,
        textAr: fwd.textAr,
      });
    }
    // A round holds <= 1 statement per competency, so a chunk of four is four
    // different competencies. Shuffle per round so block composition varies.
    const shuffled = shuffleSeeded(statements, (seed ^ (0x9e3779b9 + round * 0x85ebca6b)) >>> 0);
    for (let i = 0; i < shuffled.length; i += IPSATIVE_BLOCK_SIZE) {
      const slice = shuffled.slice(i, i + IPSATIVE_BLOCK_SIZE);
      // Keep blocks of 2-4; drop a lone trailing statement (its competency is
      // covered by the round's other blocks / the other round). Never merge it
      // into another block, which could repeat a competency within a block.
      if (slice.length < 2) continue;
      blocks.push({ blockId: `blk-${blockNo++}`, statements: slice });
    }
  }
  return blocks;
}

export type IpsativeChoice = "most" | "least";

/** Forced-choice -> a 1-5 contribution: most like me = 5, least = 1. */
export function ipsativeRawScore(choice: IpsativeChoice): number {
  return choice === "most" ? 5 : 1;
}
