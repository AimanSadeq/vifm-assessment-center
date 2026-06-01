import { createServiceClient } from "@/lib/supabase/server";
import { getLocalizedTechTaxonomy } from "./technical-taxonomy";
import { bankReadiness, type DomainReadiness } from "./technical-item-bank";
import { categoryLabel } from "./technical-function";
import type {
  EngagementTechProgram,
  TechProgramDomain,
  TechProgramCandidate,
  CandidateDomainStatus,
} from "./engagement-tech-program";

export type TechnicalProgramTier = "department" | "division" | "enterprise" | "function_team";
export type TechnicalProgramStatus = "draft" | "active" | "completed" | "archived";

export type TechnicalProgramMeta = {
  id: string;
  name: string;
  organizationName: string;
  tier: TechnicalProgramTier;
  status: TechnicalProgramStatus;
  /** Set when the program is scoped to one function (the current model). */
  functionRef: string | null;
  functionName: string | null;
};

export type ProgramParticipant = {
  id: string;
  name: string;
  email: string | null;
  accessToken: string;
};

/** A participant's latest result on the program's function (deep, per-skill). */
export type FunctionParticipantResult = {
  participantId: string;
  name: string;
  taken: boolean;
  level: number | null;
  levelLabel: string | null;
  pct: number | null;
  perSkill: { skill: string; correct: number; total: number }[];
};

/** Function-scoped cohort view (the current model): one function, deep per-skill. */
export type FunctionProgramView = {
  functionRef: string;
  functionName: string;
  categoryLabel: string;
  skillsEn: string[];
  skills: string[]; // localized, index-aligned with skillsEn
  results: FunctionParticipantResult[];
};

export type TechnicalProgramFull = {
  meta: TechnicalProgramMeta;
  /** Legacy domain cohort shape (empty for function-scoped programs). */
  program: EngagementTechProgram;
  /** Function-scoped cohort (set when the program binds a function). */
  functionView: FunctionProgramView | null;
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
    const cols =
      "id, name, organization_name, tier, status, technical_program_participants(count), technical_program_domains(count)";
    // Prefer the function-aware select; fall back if 00058 isn't applied.
    let rows: Record<string, unknown>[] | null = null;
    const withFn = await sb
      .from("technical_programs")
      .select(`${cols}, function_id, technical_functions(key, name_en, name_ar)`)
      .order("created_at", { ascending: false });
    if (withFn.error) {
      const legacy = await sb.from("technical_programs").select(cols).order("created_at", { ascending: false });
      if (legacy.error || !legacy.data) return [];
      rows = legacy.data as Record<string, unknown>[];
    } else {
      rows = (withFn.data ?? []) as Record<string, unknown>[];
    }
    return rows.map((r) => {
      const fnRaw = r.technical_functions as
        | { key: string | null; name_en: string; name_ar: string | null }
        | { key: string | null; name_en: string; name_ar: string | null }[]
        | null
        | undefined;
      const fn = Array.isArray(fnRaw) ? fnRaw[0] ?? null : fnRaw ?? null;
      return {
        id: r.id as string,
        name: r.name as string,
        organizationName: r.organization_name as string,
        tier: r.tier as TechnicalProgramTier,
        status: r.status as TechnicalProgramStatus,
        functionRef: fn ? fn.key ?? ((r.function_id as string | null) ?? null) : null,
        functionName: fn ? fn.name_en : null,
        participantCount: (r.technical_program_participants as { count: number }[])?.[0]?.count ?? 0,
        domainCount: (r.technical_program_domains as { count: number }[])?.[0]?.count ?? 0,
      };
    });
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

  // Try the function-aware select first; fall back to the legacy select if the
  // 00058 function_id column / technical_functions table isn't there yet.
  type FnJoin = {
    key: string | null;
    name_en: string;
    name_ar: string | null;
    category: string | null;
    skills_en: string[] | null;
    skills_ar: string[] | null;
  };
  type ProgRow = {
    id: string;
    name: string;
    organization_name: string;
    tier: string;
    status: string;
    function_id?: string | null;
    technical_functions?: FnJoin | FnJoin[] | null;
  };
  let prog: ProgRow | null = null;
  const withFn = await sb
    .from("technical_programs")
    .select(
      "id, name, organization_name, tier, status, function_id, technical_functions(key, name_en, name_ar, category, skills_en, skills_ar)"
    )
    .eq("id", programId)
    .maybeSingle();
  if (withFn.error) {
    const legacy = await sb
      .from("technical_programs")
      .select("id, name, organization_name, tier, status")
      .eq("id", programId)
      .maybeSingle();
    if (legacy.error || !legacy.data) return null;
    prog = legacy.data as ProgRow;
  } else {
    if (!withFn.data) return null;
    prog = withFn.data as ProgRow;
  }

  const fnJoin = Array.isArray(prog.technical_functions)
    ? prog.technical_functions[0] ?? null
    : prog.technical_functions ?? null;
  const functionRef = fnJoin ? fnJoin.key ?? (prog.function_id ?? null) : null;
  const functionName = fnJoin ? (locale === "ar" ? fnJoin.name_ar || fnJoin.name_en : fnJoin.name_en) : null;

  const meta: TechnicalProgramMeta = {
    id: prog.id as string,
    name: prog.name as string,
    organizationName: prog.organization_name as string,
    tier: prog.tier as TechnicalProgramTier,
    status: prog.status as TechnicalProgramStatus,
    functionRef,
    functionName,
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

  // ── Function-scoped rollup (the current model) ──
  let functionView: FunctionProgramView | null = null;
  if (fnJoin && functionRef && functionName) {
    const skillsEn = fnJoin.skills_en ?? [];
    const skillsAr = fnJoin.skills_ar ?? [];
    const skills = locale === "ar" ? skillsEn.map((s, i) => skillsAr[i] || s) : [...skillsEn];

    // Latest function result per participant (rows arrive newest-first).
    type FnResultRow = {
      participant_id: string | null;
      function_key: string | null;
      level: number | null;
      level_label: string | null;
      score_pct: number | null;
      result: { perSkill?: { skill: string; correct: number; total: number }[] } | null;
      created_at: string;
    };
    const latestFn = new Map<string, FnResultRow>();
    try {
      const { data: resData } = await sb
        .from("tech_assessment_results")
        .select("participant_id, function_key, level, level_label, score_pct, result, created_at")
        .eq("program_id", programId)
        .not("function_key", "is", null)
        .order("created_at", { ascending: false });
      for (const r of (resData ?? []) as FnResultRow[]) {
        if (!r.participant_id) continue;
        if (!latestFn.has(r.participant_id)) latestFn.set(r.participant_id, r);
      }
    } catch {
      /* 00058 columns absent — everyone shows not-started */
    }

    const results: FunctionParticipantResult[] = participants.map((p) => {
      const r = latestFn.get(p.id);
      return {
        participantId: p.id,
        name: p.name,
        taken: !!r,
        level: r?.level ?? null,
        levelLabel: r?.level_label ?? null,
        pct: r?.score_pct ?? null,
        perSkill: r?.result?.perSkill ?? [],
      };
    });

    functionView = {
      functionRef,
      functionName,
      categoryLabel: categoryLabel(fnJoin.category, locale),
      skillsEn,
      skills,
      results,
    };
  }

  return { meta, program: { inScope, allDomains, candidates }, functionView, participants };
}

export type ProgramParticipantToken = {
  id: string;
  fullName: string;
  email: string | null;
  programId: string;
  programName: string;
  /** The function the program is scoped to (so the run auto-starts it). */
  functionRef: string | null;
};

const TOKEN_RE = /^[0-9a-fA-F-]{36}$/;

type ProgramJoin = {
  name: string;
  function_id?: string | null;
  technical_functions?: { key: string | null } | { key: string | null }[] | null;
};

/** Resolve a participant access token → participant + program (service client). */
export async function findParticipantByToken(token: string): Promise<ProgramParticipantToken | null> {
  if (!TOKEN_RE.test(token)) return null;
  try {
    const sb = createServiceClient();
    type PartRow = {
      id: string;
      full_name: string;
      email: string | null;
      program_id: string;
      technical_programs: ProgramJoin | ProgramJoin[] | null;
    };
    // Prefer the function-aware join; fall back if 00058 isn't applied.
    let row: PartRow | null = null;
    const withFn = await sb
      .from("technical_program_participants")
      .select("id, full_name, email, program_id, technical_programs(name, function_id, technical_functions(key))")
      .eq("access_token", token)
      .maybeSingle();
    if (withFn.error) {
      const legacy = await sb
        .from("technical_program_participants")
        .select("id, full_name, email, program_id, technical_programs(name)")
        .eq("access_token", token)
        .maybeSingle();
      if (legacy.error || !legacy.data) return null;
      row = legacy.data as unknown as PartRow;
    } else {
      if (!withFn.data) return null;
      row = withFn.data as unknown as PartRow;
    }

    const prog = Array.isArray(row.technical_programs)
      ? row.technical_programs[0] ?? null
      : row.technical_programs ?? null;
    const fn = prog
      ? Array.isArray(prog.technical_functions)
        ? prog.technical_functions[0] ?? null
        : prog.technical_functions ?? null
      : null;
    const functionRef = fn ? fn.key ?? (prog?.function_id ?? null) : null;

    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email ?? null,
      programId: row.program_id,
      programName: prog?.name ?? "",
      functionRef,
    };
  } catch {
    return null;
  }
}
