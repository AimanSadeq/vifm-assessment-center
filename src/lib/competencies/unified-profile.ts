// Unified competency profile — the "golden thread", as a small GRAPH of
// frameworks rather than one flat list.
//
//   • Behavioural Competencies (the AC 38) — how someone acts. Measured
//     behaviourally; the caller owns these "current" ratings (consensus_ratings).
//   • Language Skills (Fluent's own framework) — Reading / Listening / Writing /
//     Speaking, CEFR-scored. A DIFFERENT construct (language proficiency), kept
//     separate from the 38.
//
// Bridge: each language skill ENABLES (contributes to — not equals) specific
// behavioural competencies. So a CEFR level is never silently treated as a
// behavioural competency; it shows as a labelled "enables" signal on the
// competencies it supports, and also as its own skill in the Language Skills
// family. Reflect / ARA / Pre-Hire are future frameworks that align to the same
// spine; they slot into this same builder.
//
// Best-effort + tolerant: a missing table/column/record yields no signal.

import { createServiceClient } from "@/lib/supabase/server";
import { techDomainByKey, normalizedFromLevel } from "@/lib/competencies/technical-framework";

export type CompetencySource = "ac" | "fluent" | "reflect" | "ara" | "prehire" | "technical";
export type CompetencySignalKind = "behavioural" | "language" | "360" | "self" | "screening" | "technical";

export type CompetencySignal = {
  source: CompetencySource;
  sourceLabel: string; // the skill/instrument, e.g. "Listening"
  kind: CompetencySignalKind;
  /** "measures" = a direct measure of this competency; "enables" = a contributor/enabler. */
  relation: "measures" | "enables";
  value: number; // 0–100 normalized
  display: string; // human-readable, e.g. "B2"
};

export type LanguageSkillKey = "reading" | "listening" | "writing" | "speaking";
export type LanguageSkillScore = { key: LanguageSkillKey; label: string; cefr: string; value: number };

// Fluent's own framework + the cross-framework bridge: which behavioural
// competencies each language skill enables. (Names match the seeded 38.)
export const LANGUAGE_SKILLS: {
  key: LanguageSkillKey;
  label: string;
  column: string; // eng_fluent_results per-skill CEFR column
  enables: string[]; // behavioural competency names this skill contributes to
}[] = [
  { key: "reading", label: "Reading", column: "reading_cefr", enables: ["Analytical Reasoning", "Manages Complexity"] },
  { key: "listening", label: "Listening", column: "listening_cefr", enables: ["Communicates Effectively", "Collaboration", "Emotional Intelligence"] },
  { key: "writing", label: "Writing", column: "writing_cefr", enables: ["Communicates Effectively"] },
  { key: "speaking", label: "Speaking", column: "speaking_cefr", enables: ["Communicates Effectively", "Persuades"] },
];

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** CEFR band → normalized 0–100 + the band as display. */
export function cefrSignal(cefr: string): { value: number; display: string } {
  const i = CEFR_ORDER.indexOf(cefr);
  const idx = i < 0 ? 0 : i;
  return { value: Math.round((idx / (CEFR_ORDER.length - 1)) * 100), display: cefr };
}

/** A technical-domain proficiency (the third framework): a measured assessment
 *  level, or an Academy completion as softer evidence (level null). */
export type TechnicalSignal = {
  domainKey: string;
  domainName: string;
  level: number | null; // 1–5 from an assessment; null = evidence only
  label: string;
  normalized: number | null;
  source: "assessment" | "academy";
  display: string;
};

export type UnifiedProfile = {
  /** Fluent's own competency family (only the skills that were assessed). */
  languageSkills: LanguageSkillScore[];
  /** Technical Competency framework — domain proficiency from assessments + Academy evidence. */
  technical: TechnicalSignal[];
  /** Enabler/contributor signals, keyed by behavioural competency name (lowercased). */
  competencySignals: Map<string, CompetencySignal[]>;
};

export async function buildUnifiedProfile(input: {
  candidateId: string;
  email: string | null;
}): Promise<UnifiedProfile> {
  const languageSkills: LanguageSkillScore[] = [];
  const technical: TechnicalSignal[] = [];
  const competencySignals = new Map<string, CompetencySignal[]>();
  const add = (competencyName: string, sig: CompetencySignal) => {
    const k = competencyName.toLowerCase();
    competencySignals.set(k, [...(competencySignals.get(k) ?? []), sig]);
  };

  // ── Fluent: Language Skills framework + "enables" bridge ──
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("eng_fluent_results")
      .select(
        "candidate_id, taker_email, created_at, speaking_attempted, reading_cefr, listening_cefr, writing_cefr, speaking_cefr"
      )
      .order("created_at", { ascending: false })
      .limit(300);
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const mine =
      rows.find((r) => r.candidate_id === input.candidateId) ??
      (input.email ? rows.find((r) => r.taker_email && r.taker_email === input.email) : undefined);

    if (mine) {
      for (const skill of LANGUAGE_SKILLS) {
        if (skill.key === "speaking" && mine.speaking_attempted === false) continue;
        const cefr = mine[skill.column];
        if (typeof cefr !== "string" || !CEFR_ORDER.includes(cefr)) continue;
        const { value, display } = cefrSignal(cefr);
        languageSkills.push({ key: skill.key, label: skill.label, cefr, value });
        for (const compName of skill.enables) {
          add(compName, {
            source: "fluent",
            sourceLabel: skill.label,
            kind: "language",
            relation: "enables",
            value,
            display,
          });
        }
      }
    }
  } catch {
    /* eng_fluent_results not migrated / no placement — tolerant */
  }

  // ── Technical Competency framework: assessment results (leveled 1–5) +
  //    Academy completions (softer evidence), keyed by domain. ──
  const techByDomain = new Map<string, TechnicalSignal>();
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("tech_assessment_results")
      .select("domain_key, level, level_label, candidate_id, taker_email, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    const rows = (data ?? []) as Array<{
      domain_key: string;
      level: number;
      level_label: string | null;
      candidate_id: string | null;
      taker_email: string | null;
    }>;
    for (const r of rows) {
      const mineRow = r.candidate_id === input.candidateId || (!!input.email && r.taker_email === input.email);
      if (!mineRow || techByDomain.has(r.domain_key)) continue; // latest wins (desc order)
      const d = techDomainByKey(r.domain_key);
      if (!d) continue;
      techByDomain.set(r.domain_key, {
        domainKey: r.domain_key,
        domainName: d.name,
        level: r.level,
        label: r.level_label ?? "",
        normalized: normalizedFromLevel(r.level),
        source: "assessment",
        display: `${r.level_label ?? ""} (${r.level}/5)`.trim(),
      });
    }
  } catch {
    /* tech_assessment_results not migrated — tolerant */
  }
  // Academy completions = softer evidence (only where no assessment yet).
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("vifm_enrollments")
      .select("status, vifm_courses(vertical)")
      .eq("candidate_id", input.candidateId)
      .eq("status", "completed");
    const rows = (data ?? []) as unknown as Array<{
      vifm_courses: { vertical: string } | { vertical: string }[] | null;
    }>;
    for (const r of rows) {
      const vc = Array.isArray(r.vifm_courses) ? r.vifm_courses[0] : r.vifm_courses;
      const d = techDomainByKey(vc?.vertical ?? "");
      if (!d || techByDomain.has(d.key)) continue;
      techByDomain.set(d.key, {
        domainKey: d.key,
        domainName: d.name,
        level: null,
        label: "Academy evidence",
        normalized: null,
        source: "academy",
        display: "Academy · completed",
      });
    }
  } catch {
    /* vifm_enrollments not migrated — tolerant */
  }
  technical.push(...Array.from(techByDomain.values()));

  // ── Bridge: a MEASURED technical domain ENABLES specific behavioural
  //    competencies (migration 00054's technical_domain_competencies), mirroring
  //    Fluent's language→behavioural map. Surfaces the technical result as an
  //    "enables" signal on each competency it contributes to. Academy-evidence
  //    domains (no measured level) are too soft to enable, so they're skipped.
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("technical_domain_competencies")
      .select("domain_key, competencies(name)");
    const rows = (data ?? []) as unknown as Array<{
      domain_key: string;
      competencies: { name: string } | { name: string }[] | null;
    }>;
    for (const r of rows) {
      const sig = techByDomain.get(r.domain_key);
      if (!sig || sig.normalized == null || sig.level == null) continue; // measured only
      const comp = Array.isArray(r.competencies) ? r.competencies[0] : r.competencies;
      if (!comp?.name) continue;
      add(comp.name, {
        source: "technical",
        sourceLabel: sig.domainName,
        kind: "technical",
        relation: "enables",
        value: sig.normalized,
        display: `${sig.level}/5`,
      });
    }
  } catch {
    /* technical_domain_competencies not migrated (00054) — tolerant */
  }

  // ── Reflect / ARA / Pre-Hire: own frameworks aligning to the spine — next
  // increment; they fold in here by email.

  return { languageSkills, technical, competencySignals };
}

const KIND_TONE: Record<CompetencySignalKind, string> = {
  behavioural: "border-[#5391D5]/30 bg-[#5391D5]/10 text-[#0b4a86]",
  language: "border-violet-300 bg-violet-50 text-violet-800",
  "360": "border-teal-300 bg-teal-50 text-teal-800",
  self: "border-amber-300 bg-amber-50 text-amber-800",
  screening: "border-rose-300 bg-rose-50 text-rose-800",
  technical: "border-indigo-300 bg-indigo-50 text-indigo-800",
};

/** Tailwind classes for a source chip, by signal kind. */
export function signalToneClass(kind: CompetencySignalKind): string {
  return KIND_TONE[kind];
}
