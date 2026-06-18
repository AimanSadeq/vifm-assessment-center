// Persona interpretation bands (from the behavioural-assessment score guide).
// Maps a 1-5 self-rating to a named zone + recommended action. Shared by the
// candidate submit screen, the standalone result, and the Persona PDF.

export type PersonaBandKey = "exceptional" | "proficient" | "developing" | "requires_focus" | "critical";

export type PersonaBand = { key: PersonaBandKey; label: string; labelAr: string; action: string };

export function personaBand(score: number): PersonaBand {
  if (score >= 4.5) return { key: "exceptional", label: "Exceptional", labelAr: "متميّز", action: "A clear, distinctive strength - share and teach this capability." };
  if (score >= 3.5) return { key: "proficient", label: "Proficient", labelAr: "متمكّن", action: "Solid - deepen mastery and extend impact beyond the immediate role." };
  if (score >= 2.5) return { key: "developing", label: "Developing", labelAr: "قيد التطوير", action: "Emerging - structured coaching, practice and stretch assignments help." };
  if (score >= 1.5) return { key: "requires_focus", label: "Requires Focus", labelAr: "يحتاج تركيزًا", action: "A significant gap - prioritise with a formal development plan." };
  return { key: "critical", label: "Critical Gap", labelAr: "فجوة حرجة", action: "Urgent - immediate development action and close support are essential." };
}

export const personaBandLabel = (score: number, ar: boolean) => {
  const b = personaBand(score);
  return ar ? b.labelAr : b.label;
};

// Tailwind chip classes (UI) keyed by band.
export const PERSONA_BAND_TW: Record<PersonaBandKey, string> = {
  exceptional: "bg-emerald-100 text-emerald-800",
  proficient: "bg-sky-100 text-sky-800",
  developing: "bg-amber-100 text-amber-800",
  requires_focus: "bg-orange-100 text-orange-800",
  critical: "bg-rose-100 text-rose-800",
};

// Hex (React-PDF) keyed by band.
export const PERSONA_BAND_HEX: Record<PersonaBandKey, string> = {
  exceptional: "#059669",
  proficient: "#0284c7",
  developing: "#D97706",
  requires_focus: "#EA580C",
  critical: "#E11D48",
};

// ── CAL-PER-404: gap-to-target tone (green/amber/red) ──
// Colours a per-competency bar by the FRACTIONAL gap to the role target on the
// 1-5 scale (gap = target - score). Do NOT use the integer-rounded
// getCompetencyGap here - it collapses e.g. -1.6 to a 2-level integer and loses
// the nuance. One source of truth for both hex (PDF/AR) and Tailwind (on-screen).
export type GapToneKey = "on_target" | "slight" | "moderate" | "wide" | "severe";

export function personaGapTone(gap: number): GapToneKey {
  if (gap <= 0) return "on_target"; // at or above target
  if (gap <= 0.5) return "slight";
  if (gap <= 1.0) return "moderate";
  if (gap <= 1.5) return "wide";
  return "severe";
}

export const GAP_TONE_HEX: Record<GapToneKey, string> = {
  on_target: "#059669", // green
  slight: "#65A30D", // lime
  moderate: "#D97706", // amber
  wide: "#EA580C", // orange
  severe: "#E11D48", // red
};

export const GAP_TONE_TW: Record<GapToneKey, string> = {
  on_target: "bg-emerald-500",
  slight: "bg-lime-500",
  moderate: "bg-amber-500",
  wide: "bg-orange-500",
  severe: "bg-rose-500",
};

/** Convenience: tone hex straight from score + target (gap = target - score). */
export const gapToneHex = (score: number, target: number) => GAP_TONE_HEX[personaGapTone(target - score)];
export const gapToneTw = (score: number, target: number) => GAP_TONE_TW[personaGapTone(target - score)];
