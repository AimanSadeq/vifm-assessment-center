import type { AraRegion } from "@/types/ara";

/**
 * The AI Readiness Compass regions, in display order. One place for the ids,
 * the labels and the parsing, so adding a region is a row here plus the
 * database enum (migration 00239 added north_africa).
 *
 * A question tagged region "both" serves every region; a question tagged a
 * specific region serves that region only. Regulatory frameworks are seeded
 * per region and a region without any shows a "not mapped yet" note in the
 * compliance section rather than an empty table.
 */
export type AraRegionInfo = {
  id: AraRegion;
  /** Full name for reports and formal screens. */
  name_en: string;
  name_ar: string;
  /** Short form for dense admin lists. */
  short_en: string;
  short_ar: string;
};

export const ARA_REGIONS: ReadonlyArray<AraRegionInfo> = [
  { id: "uae", name_en: "United Arab Emirates", name_ar: "الإمارات العربية المتحدة", short_en: "UAE", short_ar: "الإمارات" },
  { id: "saudi", name_en: "Saudi Arabia", name_ar: "المملكة العربية السعودية", short_en: "Saudi", short_ar: "السعودية" },
  { id: "north_africa", name_en: "North Africa", name_ar: "شمال أفريقيا", short_en: "North Africa", short_ar: "شمال أفريقيا" },
] as const;

export const ARA_REGION_IDS: readonly AraRegion[] = ARA_REGIONS.map((r) => r.id);

export const ARA_REGION_MAP: Readonly<Record<AraRegion, AraRegionInfo>> = Object.fromEntries(
  ARA_REGIONS.map((r) => [r.id, r]),
) as Record<AraRegion, AraRegionInfo>;

export function isAraRegion(v: unknown): v is AraRegion {
  return typeof v === "string" && (ARA_REGION_IDS as readonly string[]).includes(v);
}

/** Parse a stored or submitted value, falling back to the given default. */
export function toAraRegion(v: unknown, fallback: AraRegion = "uae"): AraRegion {
  return isAraRegion(v) ? v : fallback;
}

export function araRegionLabel(id: AraRegion | string | null | undefined, lang: "en" | "ar" = "en", form: "full" | "short" = "full"): string {
  const r = isAraRegion(id) ? ARA_REGION_MAP[id] : null;
  if (!r) return String(id ?? "");
  if (form === "short") return lang === "ar" ? r.short_ar : r.short_en;
  return lang === "ar" ? r.name_ar : r.name_en;
}
