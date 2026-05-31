import { createServiceClient } from "@/lib/supabase/server";
import { getLocalizedTechTaxonomy } from "./technical-taxonomy";
import { bankReadiness, type DomainReadiness } from "./technical-item-bank";

export type CandidateDomainStatus = {
  taken: boolean;
  level: number | null;
  levelLabel: string | null;
  pct: number | null;
  certified: boolean;
  passedCut: boolean | null;
  credentialCode: string | null;
};

export type TechProgramCandidate = {
  id: string;
  name: string;
  /** keyed by domain_key */
  perDomain: Record<string, CandidateDomainStatus>;
};

export type TechProgramDomain = {
  key: string;
  name: string; // localized
  certifiable: boolean;
  approved: number;
  minItems: number;
};

export type EngagementTechProgram = {
  /** Domains chosen as in-scope for this engagement's certification program. */
  inScope: TechProgramDomain[];
  /** Every domain, for the picker (with its certifiable badge). */
  allDomains: { key: string; name: string; certifiable: boolean }[];
  candidates: TechProgramCandidate[];
};

type ResultRow = {
  candidate_id: string;
  domain_key: string;
  level: number | null;
  level_label: string | null;
  score_pct: number | null;
  certified: boolean | null;
  passed_cut: boolean | null;
  credential_code: string | null;
  created_at: string;
};

/**
 * Loads an engagement's technical-certification program: which domains are in
 * scope, every candidate's latest result per in-scope domain, and per-domain
 * bank readiness. Reads via the service client (admin-only data; the panel runs
 * server-side with auth off in dev). Tolerant of the 00056 table / 00053
 * certification columns being absent.
 */
export async function getEngagementTechProgram(
  engagementId: string,
  locale: "en" | "ar"
): Promise<EngagementTechProgram> {
  const sb = createServiceClient();
  const { domains } = await getLocalizedTechTaxonomy(locale);
  const nameByKey = new Map(domains.map((d) => [d.key, d.name]));

  let readiness: DomainReadiness[] = [];
  try {
    readiness = await bankReadiness();
  } catch {
    readiness = [];
  }
  const readyByKey = new Map(readiness.map((r) => [r.domainKey as string, r]));

  const allDomains = domains.map((d) => ({
    key: d.key,
    name: d.name,
    certifiable: readyByKey.get(d.key)?.certifiable ?? false,
  }));

  let inScopeKeys: string[] = [];
  try {
    const { data } = await sb
      .from("engagement_technical_domains")
      .select("domain_key")
      .eq("engagement_id", engagementId);
    inScopeKeys = (data ?? []).map((r) => r.domain_key as string);
  } catch {
    /* 00056 not applied — empty program */
  }

  const inScope: TechProgramDomain[] = inScopeKeys
    .map((k) => {
      const r = readyByKey.get(k);
      return {
        key: k,
        name: nameByKey.get(k) ?? k,
        certifiable: r?.certifiable ?? false,
        approved: r?.approved ?? 0,
        minItems: r?.minItems ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const { data: candData } = await sb
    .from("candidates")
    .select("id, full_name")
    .eq("engagement_id", engagementId)
    .order("full_name");
  const candidates = (candData ?? []) as { id: string; full_name: string }[];

  // Latest result per (candidate, domain) — rows arrive newest-first.
  const latest = new Map<string, ResultRow>();
  try {
    const { data: resData } = await sb
      .from("tech_assessment_results")
      .select("candidate_id, domain_key, level, level_label, score_pct, certified, passed_cut, credential_code, created_at")
      .eq("engagement_id", engagementId)
      .order("created_at", { ascending: false });
    for (const r of (resData ?? []) as ResultRow[]) {
      const k = `${r.candidate_id}|${r.domain_key}`;
      if (!latest.has(k)) latest.set(k, r);
    }
  } catch {
    /* results table absent — everyone shows "not started" */
  }

  const programCandidates: TechProgramCandidate[] = candidates.map((c) => {
    const perDomain: Record<string, CandidateDomainStatus> = {};
    for (const d of inScope) {
      const r = latest.get(`${c.id}|${d.key}`);
      perDomain[d.key] = r
        ? {
            taken: true,
            level: r.level,
            levelLabel: r.level_label,
            pct: r.score_pct,
            certified: !!r.certified,
            passedCut: r.passed_cut,
            credentialCode: r.credential_code,
          }
        : { taken: false, level: null, levelLabel: null, pct: null, certified: false, passedCut: null, credentialCode: null };
    }
    return { id: c.id, name: c.full_name, perDomain };
  });

  return { inScope, allDomains, candidates: programCandidates };
}
