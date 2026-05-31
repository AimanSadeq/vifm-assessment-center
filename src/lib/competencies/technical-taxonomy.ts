import { createServiceClient } from "@/lib/supabase/server";
import { TECH_DOMAINS } from "./technical-framework";

/** A domain localized for the runner: display name + its skill display labels. */
export type LocalizedTechDomain = { key: string; name: string; skills: string[] };

export type TechTaxonomy = {
  domains: LocalizedTechDomain[];
  /** English skill name → localized label (for item/result per-skill rendering). */
  skillLabels: Record<string, string>;
};

type DomainRow = { key: string; name_en: string; name_ar: string | null; sort_order: number };
type SkillRow = { domain_key: string; name: string; name_ar: string | null; sort_order: number };

/**
 * Loads the technical taxonomy (domains + skills) localized to `locale` from the
 * bilingual technical_domains / technical_skills tables. The runner is public and
 * those tables are RLS auth-only, so we read with the service client (matches the
 * assessment API). Falls back to the English code framework when the tables/columns
 * aren't there yet — so the runner works before migrations 00054 / 00055 land.
 */
export async function getLocalizedTechTaxonomy(locale: "en" | "ar"): Promise<TechTaxonomy> {
  const fallback: TechTaxonomy = {
    domains: TECH_DOMAINS.map((d) => ({ key: d.key, name: d.name, skills: [...d.skills] })),
    skillLabels: {},
  };

  try {
    const sb = createServiceClient();

    const domRes = await sb
      .from("technical_domains")
      .select("key, name_en, name_ar, sort_order")
      .order("sort_order");
    if (domRes.error || !domRes.data || domRes.data.length === 0) return fallback;

    // name_ar on skills only exists after 00055 — retry without it if absent.
    let skills: SkillRow[] = [];
    const withAr = await sb
      .from("technical_skills")
      .select("domain_key, name, name_ar, sort_order")
      .order("sort_order");
    if (withAr.error) {
      const enOnly = await sb
        .from("technical_skills")
        .select("domain_key, name, sort_order")
        .order("sort_order");
      skills = (enOnly.data ?? []).map((s) => ({ ...(s as Omit<SkillRow, "name_ar">), name_ar: null }));
    } else {
      skills = (withAr.data ?? []) as SkillRow[];
    }

    const pick = (en: string, ar: string | null) => (locale === "ar" ? ar || en : en);

    const skillLabels: Record<string, string> = {};
    const byDomain = new Map<string, string[]>();
    for (const s of skills) {
      const label = pick(s.name, s.name_ar);
      skillLabels[s.name] = label;
      const list = byDomain.get(s.domain_key) ?? [];
      list.push(label);
      byDomain.set(s.domain_key, list);
    }

    const domains: LocalizedTechDomain[] = (domRes.data as DomainRow[]).map((d) => ({
      key: d.key,
      name: pick(d.name_en, d.name_ar),
      skills: byDomain.get(d.key) ?? [],
    }));

    return { domains, skillLabels };
  } catch {
    return fallback;
  }
}
