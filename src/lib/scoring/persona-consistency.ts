// ─────────────────────────────────────────────────────────────
// Persona response-style / consistency indicator (item 9, shared).
//
// A lightweight, ADVISORY signal computed from data already collected - it
// never blocks a report or a decision. Two sub-signals:
//
//   Elevation: the mean of all NORMATIVE (Likert) effective ratings. A very
//   high, uniform mean (>= 4.6) suggests positive / socially-desirable
//   responding - everything rated near the ceiling.
//
//   Ipsative agreement: when forced-choice ("most / least like me") rows
//   exist (item_type='ipsative', answer_data.choice), the competency a person
//   marks "most like me" should carry a higher normative score than the one
//   they mark "least like me". Low agreement across blocks suggests
//   inconsistent responding.
//
// Tolerant: ipsative-only when forced-choice rows exist; elevation-only when
// they don't; null when neither is computable. Deterministic (no AI), so it
// is safe and free to compute on every render.
// ─────────────────────────────────────────────────────────────

import type { PersonaLang } from "@/lib/ai/persona-insights";

export type PersonaConsistency = {
  /** 0..1 confidence the self-report is a clean read (higher = cleaner). */
  index: number;
  flag: "ok" | "review";
  note: string;
};

export type ConsistencyResponse = {
  competency_id: string;
  raw_score: number | string;
  is_reverse: boolean;
  item_type?: string | null;
  answer_data?: { choice?: string; block?: string } | null;
};

// A uniform Likert mean at or above this reads as ceiling / socially-desirable.
const ELEVATION_THRESHOLD = 4.6;
// Below this share of ipsative blocks agreeing, responding looks inconsistent.
const AGREEMENT_THRESHOLD = 0.5;

function note(flag: "ok" | "review", reason: "elevation" | "agreement" | "both" | "clean", lang: PersonaLang): string {
  if (lang === "ar") {
    if (flag === "ok") return "أظهرت التقييمات الذاتية تباينًا طبيعيًا؛ لا توجد ملاحظة على نمط الاستجابة.";
    if (reason === "elevation") return "جاءت التقييمات الذاتية مرتفعة بشكل موحّد؛ يُفسَّر بحذر مع أدلة داعمة.";
    if (reason === "agreement") return "اختيارات (الأكثر/الأقل انطباقًا) غير متّسقة مع الدرجات المُقيَّمة؛ يُفسَّر بحذر.";
    return "تقييمات ذاتية مرتفعة وموحّدة مع اختيارات غير متّسقة؛ يُفسَّر بحذر مع أدلة داعمة.";
  }
  if (flag === "ok") return "Self-ratings show a normal spread; no response-style concern.";
  if (reason === "elevation") return "Self-ratings are uniformly high; interpret with corroborating evidence.";
  if (reason === "agreement") return "Forced-choice picks are not well aligned with the rated scores; interpret with care.";
  return "Self-ratings are uniformly high and forced-choice picks are inconsistent; interpret with care.";
}

export function computePersonaConsistency(
  responses: ConsistencyResponse[],
  lang: PersonaLang = "en",
): PersonaConsistency | null {
  if (!responses || responses.length === 0) return null;

  const eff = (r: ConsistencyResponse): number => {
    const raw = Number(r.raw_score);
    return r.is_reverse ? 6 - raw : raw;
  };

  const isIpsative = (r: ConsistencyResponse) => r.item_type === "ipsative";

  // ── Elevation (normative items only) ──
  const normative = responses.filter((r) => !isIpsative(r));
  const elevation =
    normative.length > 0 ? normative.reduce((a, r) => a + eff(r), 0) / normative.length : null;
  const elevationFlag = elevation != null && elevation >= ELEVATION_THRESHOLD;

  // ── Per-competency normative mean (for the ipsative agreement check) ──
  const byComp = new Map<string, number[]>();
  for (const r of normative) {
    const cid = r.competency_id;
    if (!byComp.has(cid)) byComp.set(cid, []);
    byComp.get(cid)!.push(eff(r));
  }
  const compMean = new Map<string, number>();
  for (const [cid, vals] of byComp) compMean.set(cid, vals.reduce((a, b) => a + b, 0) / vals.length);

  // ── Ipsative agreement ──
  // Group ipsative rows by block; within a block compare the "most" pick's
  // normative mean against the "least" pick's. Agreement = most_mean >= least_mean.
  const blocks = new Map<string, { most?: string; least?: string }>();
  for (const r of responses) {
    if (!isIpsative(r)) continue;
    const blockId = r.answer_data?.block;
    const choice = r.answer_data?.choice;
    if (!blockId || (choice !== "most" && choice !== "least")) continue;
    const b = blocks.get(blockId) ?? {};
    b[choice] = r.competency_id;
    blocks.set(blockId, b);
  }
  let agreeing = 0;
  let comparable = 0;
  for (const b of blocks.values()) {
    if (!b.most || !b.least) continue;
    const mostMean = compMean.get(b.most);
    const leastMean = compMean.get(b.least);
    if (mostMean == null || leastMean == null) continue;
    comparable += 1;
    if (mostMean >= leastMean) agreeing += 1;
  }
  const agreement = comparable > 0 ? agreeing / comparable : null;
  const agreementFlag = agreement != null && agreement < AGREEMENT_THRESHOLD;

  if (elevation == null && agreement == null) return null;

  const flag: "ok" | "review" = elevationFlag || agreementFlag ? "review" : "ok";
  const reason =
    flag === "ok" ? "clean" : elevationFlag && agreementFlag ? "both" : elevationFlag ? "elevation" : "agreement";

  // Index: blend the two sub-scores. Elevation sub-score falls off as the mean
  // approaches the ceiling; agreement sub-score is the block agreement share.
  const elevationScore = elevation == null ? 1 : Math.max(0, Math.min(1, (5 - elevation) / (5 - ELEVATION_THRESHOLD)));
  const index =
    agreement == null
      ? Math.round(elevationScore * 100) / 100
      : Math.round((agreement * 0.5 + elevationScore * 0.5) * 100) / 100;

  return { index, flag, note: note(flag, reason as "elevation" | "agreement" | "both" | "clean", lang) };
}
