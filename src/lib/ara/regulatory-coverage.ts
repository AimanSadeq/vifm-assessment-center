import { createServiceClient } from "@/lib/supabase/server";

// DOC-COUNT-02 / DOC-NAMES-01: the public ARC pages restated the regulatory
// coverage by hand ("15 GCC frameworks mapped to 56 requirements", a Saudi list
// missing SAMA CSF) and drifted from the seeded bank. They now read it here -
// the same active frameworks the compliance engine scores against. Framework
// names and counts are public reference data (no client information), so the
// service client is fine on these unauthenticated marketing pages.

export type RegulatoryCoverage = {
  uae: string[];
  saudi: string[];
  frameworkCount: number;
  requirementCount: number;
};

/** Hand-kept fallback only for an environment where the tables are unreadable. */
const FALLBACK: RegulatoryCoverage = { uae: [], saudi: [], frameworkCount: 16, requirementCount: 66 };

export async function loadRegulatoryCoverage(): Promise<RegulatoryCoverage> {
  try {
    const sb = createServiceClient();
    const [{ data: fws, error: fwErr }, { count, error: reqErr }] = await Promise.all([
      sb
        .from("ara_regulatory_frameworks")
        .select("id, region, framework_name_en, tier, display_order")
        .eq("is_active", true)
        .order("tier", { ascending: true })
        .order("display_order", { ascending: true }),
      sb.from("ara_regulatory_requirements").select("id", { count: "exact", head: true }),
    ]);
    if (fwErr || reqErr || !fws) return FALLBACK;
    const names = (region: string) =>
      (fws as Array<{ region: string; framework_name_en: string }>)
        .filter((f) => f.region === region)
        .map((f) => f.framework_name_en);
    return {
      uae: names("uae"),
      saudi: names("saudi"),
      frameworkCount: fws.length,
      requirementCount: count ?? FALLBACK.requirementCount,
    };
  } catch {
    return FALLBACK;
  }
}
