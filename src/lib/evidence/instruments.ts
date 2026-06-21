import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { ValidationEvidence } from "@/types/evidence";
import { suggestFluentValidationEvidence } from "@/lib/ai/fluent-evidence-suggester";
import { suggestTechnicalValidationEvidence } from "@/lib/ai/technical-evidence-suggester";
import { suggestReflectValidationEvidence } from "@/lib/ai/reflect-evidence-suggester";
import { suggestPsyValidationEvidence } from "@/lib/ai/psy-evidence-suggester";

/**
 * Instrument adapters for the generic validation-evidence subsystem.
 *
 * AC (competencies) and ARC (ara_questions) keep their bespoke
 * consoles/actions (they pre-date this). These four share ONE generic
 * console + ONE set of server actions, driven by the adapter below: each
 * adapter knows its evidence-bearing table, how to list/load its
 * constructs, and how to call its instrument-specific AI suggester.
 *
 * Server-only: imports the service-role client and the suggesters.
 */

export type EvidenceInstrumentKey = "fluent" | "technical" | "reflect" | "psy";

export const EVIDENCE_INSTRUMENT_KEYS: EvidenceInstrumentKey[] = [
  "fluent", "technical", "reflect", "psy",
];

export type EvidenceListItem = {
  id: string;
  label: string;
  sublabel: string | null;
  group: string;
  evidence: ValidationEvidence | null;
};

export type EvidenceItemDetail = {
  id: string;
  label: string;
  group: string;
  contextLines: { k: string; v: string }[];
  evidence: ValidationEvidence | null;
};

export type EvidenceAdapter = {
  key: EvidenceInstrumentKey;
  label: string;
  /** Singular noun for the construct unit, e.g. "item" / "competency" / "scale". */
  unitNoun: string;
  /** Table carrying the validation_evidence column. */
  table: string;
  basePath: string;
  /** One-line description shown under the console title. */
  blurb: string;
  listItems(): Promise<EvidenceListItem[]>;
  loadOne(id: string): Promise<EvidenceItemDetail | null>;
  suggestOne(id: string): Promise<ValidationEvidence | null>;
};

function truncate(s: string | null | undefined, n = 90): string {
  if (!s) return "";
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

// ── Fluent (English) - eng_fluent_items ───────────────────────────────
type FluentRow = {
  id: string;
  skill: string;
  cefr_label: string | null;
  stem: { question?: string } | null;
  validation_evidence: ValidationEvidence | null;
};

const fluentAdapter: EvidenceAdapter = {
  key: "fluent",
  label: "Fluent® (English)",
  unitNoun: "item",
  table: "eng_fluent_items",
  basePath: "/admin/evidence/fluent",
  blurb:
    "Per-item research provenance for the CEFR-aligned reading/listening bank. Anchor each item's skill + level to the language-testing literature.",
  async listItems() {
    const sb = createServiceClient();
    const { data } = await sb
      .from("eng_fluent_items")
      .select("id, skill, cefr_label, stem, validation_evidence")
      .order("skill", { ascending: true });
    const rows = (data ?? []) as unknown as FluentRow[];
    return rows.map((r) => ({
      id: r.id,
      label: truncate(r.stem?.question) || `${r.skill} item`,
      sublabel: r.cefr_label ? `CEFR ${r.cefr_label}` : "uncalibrated",
      group: r.skill ? r.skill[0].toUpperCase() + r.skill.slice(1) : "Other",
      evidence: r.validation_evidence,
    }));
  },
  async loadOne(id) {
    const sb = createServiceClient();
    const { data } = await sb
      .from("eng_fluent_items")
      .select("id, skill, cefr_label, stem, validation_evidence")
      .eq("id", id)
      .maybeSingle<FluentRow>();
    if (!data) return null;
    return {
      id: data.id,
      label: truncate(data.stem?.question, 160) || `${data.skill} item`,
      group: data.skill,
      contextLines: [
        { k: "Skill", v: data.skill },
        { k: "CEFR band", v: data.cefr_label ?? "(not yet calibrated)" },
      ],
      evidence: data.validation_evidence,
    };
  },
  async suggestOne(id) {
    const sb = createServiceClient();
    const { data } = await sb
      .from("eng_fluent_items")
      .select("skill, cefr_label")
      .eq("id", id)
      .maybeSingle<{ skill: string; cefr_label: string | null }>();
    if (!data) return null;
    return suggestFluentValidationEvidence({ skill: data.skill, cefr: data.cefr_label });
  },
};

// ── Technical Cert - tech_assessment_items ────────────────────────────
type TechRow = {
  id: string;
  domain_key: string;
  skill: string;
  question_en: string;
  difficulty: string;
  validation_evidence: ValidationEvidence | null;
};

const technicalAdapter: EvidenceAdapter = {
  key: "technical",
  label: "Technical Cert",
  unitNoun: "item",
  table: "tech_assessment_items",
  basePath: "/admin/evidence/technical",
  blurb:
    "Per-item research provenance for the technical certification bank. Anchor each item's domain to the content-validity and standard-setting literature.",
  async listItems() {
    const sb = createServiceClient();
    const { data } = await sb
      .from("tech_assessment_items")
      .select("id, domain_key, skill, question_en, difficulty, validation_evidence")
      .order("domain_key", { ascending: true });
    const rows = (data ?? []) as unknown as TechRow[];
    return rows.map((r) => ({
      id: r.id,
      label: truncate(r.question_en),
      sublabel: `${r.skill} · ${r.difficulty}`,
      group: r.domain_key || "Other",
      evidence: r.validation_evidence,
    }));
  },
  async loadOne(id) {
    const sb = createServiceClient();
    const { data } = await sb
      .from("tech_assessment_items")
      .select("id, domain_key, skill, question_en, difficulty, validation_evidence")
      .eq("id", id)
      .maybeSingle<TechRow>();
    if (!data) return null;
    return {
      id: data.id,
      label: truncate(data.question_en, 200),
      group: data.domain_key,
      contextLines: [
        { k: "Domain", v: data.domain_key },
        { k: "Skill", v: data.skill },
        { k: "Difficulty", v: data.difficulty },
      ],
      evidence: data.validation_evidence,
    };
  },
  async suggestOne(id) {
    const sb = createServiceClient();
    const { data } = await sb
      .from("tech_assessment_items")
      .select("domain_key, skill, question_en")
      .eq("id", id)
      .maybeSingle<{ domain_key: string; skill: string; question_en: string }>();
    if (!data) return null;
    return suggestTechnicalValidationEvidence({
      domain_key: data.domain_key,
      skill: data.skill,
      question_excerpt: truncate(data.question_en, 140),
    });
  },
};

// ── Reflect 360 - reflect_competencies ────────────────────────────────
type ReflectRow = {
  id: string;
  name_en: string;
  description_en: string | null;
  validation_evidence: ValidationEvidence | null;
  reflect_frameworks: { name_en: string } | null;
};

const reflectAdapter: EvidenceAdapter = {
  key: "reflect",
  label: "Reflect 360®",
  unitNoun: "competency",
  table: "reflect_competencies",
  basePath: "/admin/evidence/reflect",
  blurb:
    "Per-competency research provenance for the 360 feedback frameworks. Anchor each competency to the multisource-feedback and competency-modelling literature.",
  async listItems() {
    const sb = createServiceClient();
    const { data } = await sb
      .from("reflect_competencies")
      .select("id, name_en, description_en, validation_evidence, reflect_frameworks(name_en)")
      .order("display_order", { ascending: true });
    const rows = (data ?? []) as unknown as ReflectRow[];
    return rows.map((r) => ({
      id: r.id,
      label: r.name_en,
      sublabel: truncate(r.description_en, 80) || null,
      group: r.reflect_frameworks?.name_en ?? "Unassigned framework",
      evidence: r.validation_evidence,
    }));
  },
  async loadOne(id) {
    const sb = createServiceClient();
    const { data } = await sb
      .from("reflect_competencies")
      .select("id, name_en, description_en, validation_evidence, reflect_frameworks(name_en)")
      .eq("id", id)
      .maybeSingle<ReflectRow>();
    if (!data) return null;
    return {
      id: data.id,
      label: data.name_en,
      group: data.reflect_frameworks?.name_en ?? "Unassigned framework",
      contextLines: [
        { k: "Framework", v: data.reflect_frameworks?.name_en ?? "(unassigned)" },
        { k: "Definition", v: data.description_en ?? "(no description on file)" },
      ],
      evidence: data.validation_evidence,
    };
  },
  async suggestOne(id) {
    const sb = createServiceClient();
    const { data } = await sb
      .from("reflect_competencies")
      .select("name_en, description_en, reflect_frameworks(name_en)")
      .eq("id", id)
      .maybeSingle<ReflectRow>();
    if (!data) return null;
    return suggestReflectValidationEvidence({
      competency_name: data.name_en,
      competency_description: data.description_en ?? "",
      framework_name: data.reflect_frameworks?.name_en ?? "",
    });
  },
};

// ── Psychometrics - psy_scales ────────────────────────────────────────
type PsyRow = {
  id: string;
  key: string;
  name_en: string;
  validation_evidence: ValidationEvidence | null;
  psy_instruments: { name_en: string; kind: string } | null;
};

const psyAdapter: EvidenceAdapter = {
  key: "psy",
  label: "Psychometrics",
  unitNoun: "scale",
  table: "psy_scales",
  basePath: "/admin/evidence/psy",
  blurb:
    "Per-scale research provenance for the psychometric instruments. Anchor each scale to the construct-validity and reliability literature.",
  async listItems() {
    const sb = createServiceClient();
    const { data } = await sb
      .from("psy_scales")
      .select("id, key, name_en, validation_evidence, psy_instruments(name_en, kind)")
      .order("sort_order", { ascending: true });
    const rows = (data ?? []) as unknown as PsyRow[];
    return rows.map((r) => ({
      id: r.id,
      label: r.name_en,
      sublabel: r.key,
      group: r.psy_instruments?.name_en ?? "Unassigned instrument",
      evidence: r.validation_evidence,
    }));
  },
  async loadOne(id) {
    const sb = createServiceClient();
    const { data } = await sb
      .from("psy_scales")
      .select("id, key, name_en, validation_evidence, psy_instruments(name_en, kind)")
      .eq("id", id)
      .maybeSingle<PsyRow>();
    if (!data) return null;
    return {
      id: data.id,
      label: data.name_en,
      group: data.psy_instruments?.name_en ?? "Unassigned instrument",
      contextLines: [
        { k: "Instrument", v: data.psy_instruments?.name_en ?? "(unassigned)" },
        { k: "Type", v: data.psy_instruments?.kind ?? "(unknown)" },
        { k: "Scale key", v: data.key },
      ],
      evidence: data.validation_evidence,
    };
  },
  async suggestOne(id) {
    const sb = createServiceClient();
    const { data } = await sb
      .from("psy_scales")
      .select("name_en, psy_instruments(name_en, kind)")
      .eq("id", id)
      .maybeSingle<PsyRow>();
    if (!data) return null;
    return suggestPsyValidationEvidence({
      scale_name: data.name_en,
      instrument_kind: data.psy_instruments?.kind ?? "",
      instrument_name: data.psy_instruments?.name_en ?? "",
    });
  },
};

export const EVIDENCE_ADAPTERS: Record<EvidenceInstrumentKey, EvidenceAdapter> = {
  fluent: fluentAdapter,
  technical: technicalAdapter,
  reflect: reflectAdapter,
  psy: psyAdapter,
};

export function getEvidenceAdapter(key: string): EvidenceAdapter | null {
  return (EVIDENCE_ADAPTERS as Record<string, EvidenceAdapter>)[key] ?? null;
}
