import { createServiceClient } from "@/lib/supabase/server";
import { getLocalizedTechTaxonomy } from "./technical-taxonomy";
import { bankReadiness, type DomainReadiness } from "./technical-item-bank";
import type {
  EngagementTechProgram,
  TechProgramDomain,
  TechProgramCandidate,
  CandidateDomainStatus,
} from "./engagement-tech-program";

export type TechnicalProgramTier = "department" | "division" | "enterprise";
export type TechnicalProgramStatus = "draft" | "active" | "completed" | "archived";

export type TechnicalProgramMeta = {
  id: string;
  name: string;
  organizationName: string;
  tier: TechnicalProgramTier;
  status: TechnicalProgramStatus;
};

export type ProgramParticipant = {
  id: string;
  name: string;
  email: string | null;
  accessToken: string;
};

export type TechnicalProgramFull = {
  meta: TechnicalProgramMeta;
  /** Cohort shape (inScope + allDomains + candidates) — reuses the cohort renderer. */
  program: EngagementTechProgram;
  /** Participants with their token, for the admin link generation. */
  participants: ProgramParticipant[];
};

type ResultRow = {
  participant_id: string | null;
  domain_key: string;
  level: number | null;
  level_label: string | null;
  score_pct: number | null;
  certified: boolean | null;
  passed_cut: boolean | null;
  credential_code: string | null;
  created_at: string;
};

/** Programs list for the admin index (with participant + domain counts). */
export async function listTechnicalPrograms(): Promise<
  (TechnicalProgramMeta & { participantCount: number; domainCount: number })[]
> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("technical_programs")
      .select("id, name, organization_name, tier, status, technical_program_participants(count), technical_program_domains(count)")
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      organizationName: r.organization_name as string,
      tier: r.tier as TechnicalProgramTier,
      status: r.status as TechnicalProgramStatus,
      participantCount: (r.technical_program_participants as { count: number }[])?.[0]?.count ?? 0,
      domainCount: (r.technical_program_domains as { count: number }[])?.[0]?.count ?? 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Full program: meta + cohort rollup (per-participant per-domain status) +
 * participants with tokens. Reads admin-only data via the service client.
 * Tolerant of the 00057 tables being absent (returns null).
 */
export async function getTechnicalProgram(
  programId: string,
  locale: "en" | "ar"
): Promise<TechnicalProgramFull | null> {
  let sb;
  try {
    sb = createServiceClient();
  } catch {
    return null;
  }

  const { data: prog, error } = await sb
    .from("technical_programs")
    .select("id, name, organization_name, tier, status")
    .eq("id", programId)
    .maybeSingle();
  if (error || !prog) return null;

  const meta: TechnicalProgramMeta = {
    id: prog.id as string,
    name: prog.name as string,
    organizationName: prog.organization_name as string,
    tier: prog.tier as TechnicalProgramTier,
    status: prog.status as TechnicalProgramStatus,
  };

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

  const { data: domRows } = await sb
    .from("technical_program_domains")
    .select("domain_key")
    .eq("program_id", programId);
  const inScope: TechProgramDomain[] = (domRows ?? [])
    .map((r) => {
      const k = r.domain_key as string;
      const ready = readyByKey.get(k);
      return {
        key: k,
        name: nameByKey.get(k) ?? k,
        certifiable: ready?.certifiable ?? false,
        approved: ready?.approved ?? 0,
        minItems: ready?.minItems ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const { data: partRows } = await sb
    .from("technical_program_participants")
    .select("id, full_name, email, access_token")
    .eq("program_id", programId)
    .order("full_name");
  const participants: ProgramParticipant[] = (partRows ?? []).map((p) => ({
    id: p.id as string,
    name: p.full_name as string,
    email: (p.email as string | null) ?? null,
    accessToken: p.access_token as string,
  }));

  // Latest result per (participant, domain)
  const latest = new Map<string, ResultRow>();
  try {
    const { data: resData } = await sb
      .from("tech_assessment_results")
      .select("participant_id, domain_key, level, level_label, score_pct, certified, passed_cut, credential_code, created_at")
      .eq("program_id", programId)
      .order("created_at", { ascending: false });
    for (const r of (resData ?? []) as ResultRow[]) {
      if (!r.participant_id) continue;
      const key = `${r.participant_id}|${r.domain_key}`;
      if (!latest.has(key)) latest.set(key, r);
    }
  } catch {
    /* results table missing the program columns — everyone shows not-started */
  }

  const candidates: TechProgramCandidate[] = participants.map((p) => {
    const perDomain: Record<string, CandidateDomainStatus> = {};
    for (const d of inScope) {
      const r = latest.get(`${p.id}|${d.key}`);
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
    return { id: p.id, name: p.name, perDomain };
  });

  return { meta, program: { inScope, allDomains, candidates }, participants };
}

export type ProgramParticipantToken = {
  id: string;
  fullName: string;
  email: string | null;
  programId: string;
  programName: string;
};

const TOKEN_RE = /^[0-9a-fA-F-]{36}$/;

/** Resolve a participant access token → participant + program (service client). */
export async function findParticipantByToken(token: string): Promise<ProgramParticipantToken | null> {
  if (!TOKEN_RE.test(token)) return null;
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("technical_program_participants")
      .select("id, full_name, email, program_id, technical_programs(name)")
      .eq("access_token", token)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id as string,
      fullName: data.full_name as string,
      email: (data.email as string | null) ?? null,
      programId: data.program_id as string,
      programName: (data.technical_programs as unknown as { name: string } | null)?.name ?? "",
    };
  } catch {
    return null;
  }
}
