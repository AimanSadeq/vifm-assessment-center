// Scenario-question (SJT) shared definitions: safe for client components
// (no server imports). Server logic lives in ./sjt.

export const OPTION_LEVELS = ["Advanced", "Proficient", "Basic", "Counter-evidence"] as const;
export type OptionLevel = (typeof OPTION_LEVELS)[number];
export const LEVEL_NAMES = ["Below Basic", "Basic", "Proficient", "Advanced"] as const; // 0..3

export type SjtOption = { key: string; text: string; level: OptionLevel; indicator_id: string | null };
export type SjtItem = {
  id: string;
  ref: string;
  competency_code: string;
  target_level: "Basic" | "Proficient" | "Advanced";
  situation: string;
  options: SjtOption[];
  sort_order: number;
};
export type BundleCompetency = {
  code: string;
  name: string;
  category: string | null;
  definition: string | null;
  required_levels: Record<string, number>;
  sort_order: number;
};

export type SjtConfig = {
  points: Record<OptionLevel, number>;
  leastCounterBonus: number;
  /** Minimum points on a 0-12 scale (three scenarios) for each level. */
  cuts: { advanced: number; proficient: number; basic: number };
  order: "shuffled" | "grouped";
};
export const DEFAULT_SJT_CONFIG: SjtConfig = {
  points: { Advanced: 3, Proficient: 2, Basic: 1, "Counter-evidence": 0 },
  leastCounterBonus: 1,
  cuts: { advanced: 10, proficient: 7, basic: 4 },
  order: "shuffled",
};

const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
export function sanitiseSjtConfig(raw: unknown): SjtConfig {
  const r = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  const d = DEFAULT_SJT_CONFIG;
  const points = Object.fromEntries(
    OPTION_LEVELS.map((l) => [l, num(r.points?.[l], d.points[l], 0, 10)]),
  ) as SjtConfig["points"];
  let cuts = {
    advanced: num(r.cuts?.advanced, d.cuts.advanced, 0, 12),
    proficient: num(r.cuts?.proficient, d.cuts.proficient, 0, 12),
    basic: num(r.cuts?.basic, d.cuts.basic, 0, 12),
  };
  if (!(cuts.basic <= cuts.proficient && cuts.proficient <= cuts.advanced)) cuts = { ...d.cuts };
  return {
    points,
    leastCounterBonus: num(r.leastCounterBonus, d.leastCounterBonus, 0, 10),
    cuts,
    order: r.order === "grouped" ? "grouped" : "shuffled",
  };
}
