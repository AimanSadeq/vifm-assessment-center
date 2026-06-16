// ─────────────────────────────────────────────────────────────
// Persona item-presentation helpers (pure, no DB).
//
// Two presentation models over the same 38-competency bank:
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

/**
 * Build forced-choice blocks - one forward (non-reverse) statement per
 * competency, shuffled by seed, chunked into blocks of four drawn from
 * different competencies. A final short block (size 2-3) is kept rather than
 * padded, so every competency appears exactly once.
 */
export function buildIpsativeBlocks(
  competencies: BehavioralCompetency[],
  seed: number,
): IpsativeBlock[] {
  // One representative FORWARD item per competency. Forced-choice statements are
  // stored with is_reverse=false, so a reverse item here would be mis-keyed -
  // skip any competency with no forward item rather than fall back to a reverse.
  const statements: IpsativeStatement[] = [];
  for (const c of competencies) {
    const fwd = c.items.find((i) => !i.reverse);
    if (!fwd) continue;
    statements.push({
      itemKey: `ips:${fwd.itemKey}`,
      baseItemKey: fwd.itemKey,
      competencyId: c.acCompetencyId,
      textEn: fwd.textEn,
      textAr: fwd.textAr,
    });
  }
  // Shuffle with a derived seed so blocks differ from the normative order.
  const shuffled = shuffleSeeded(statements, (seed ^ 0x9e3779b9) >>> 0);
  const blocks: IpsativeBlock[] = [];
  for (let i = 0; i < shuffled.length; i += IPSATIVE_BLOCK_SIZE) {
    const slice = shuffled.slice(i, i + IPSATIVE_BLOCK_SIZE);
    if (slice.length < 2) {
      // Merge a lone trailing statement into the previous block.
      if (blocks.length > 0) blocks[blocks.length - 1].statements.push(...slice);
      else blocks.push({ blockId: `blk-${blocks.length + 1}`, statements: slice });
      continue;
    }
    blocks.push({ blockId: `blk-${blocks.length + 1}`, statements: slice });
  }
  return blocks;
}

export type IpsativeChoice = "most" | "least";

/** Forced-choice -> a 1-5 contribution: most like me = 5, least = 1. */
export function ipsativeRawScore(choice: IpsativeChoice): number {
  return choice === "most" ? 5 : 1;
}
