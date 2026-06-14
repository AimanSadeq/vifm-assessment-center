import { z } from "zod";

export const araRegionSchema = z.enum(["uae", "saudi"]);
export const araSectorSchema = z.enum(["government", "banking", "general"]);
export const araLanguageSchema = z.enum(["en", "ar"]);
export const araPillarSchema = z.enum([
  "strategy",
  "data",
  "technology",
  "talent",
  "culture",
  "governance",
  "operations",
  "model_management",
]);

// ─── Organizations ─────────────────────────────────────────────
export const createAraOrganizationSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  name_ar: z.string().max(200).optional().or(z.literal("")),
  sector: araSectorSchema,
  region: araRegionSchema,
});
export type CreateAraOrganizationValues = z.infer<typeof createAraOrganizationSchema>;

// ─── Assessments ───────────────────────────────────────────────
// 'individual' is the Personal stage (Mode A free snapshot, Mode B paid
// deep-dive). It uses different create flows (/ara/personal/start and
// /ara/consultant/personal-deep-dive/new) but is still a valid value
// for the engagement_stage column - the schema must accept it.
export const araEngagementStageSchema = z.enum([
  "department", "division", "enterprise", "individual",
]);
export const araAssessmentTierSchema = z.enum(["snapshot", "deep_dive"]);

export const createAraAssessmentSchema = z.object({
  organization_id: z.string().uuid("Select an organization"),
  region: araRegionSchema,
  sector: araSectorSchema,
  default_language: araLanguageSchema,
  is_sandbox: z.boolean(),
  question_bank_version_id: z.string().uuid().nullable().optional(),
  engagement_stage: araEngagementStageSchema,
  scope_label: z.string().trim().min(1).max(120).nullable().optional(),
  // Mode C - workforce readiness layer alongside the org pillar items.
  include_individual_layer: z.boolean().default(false),
  // Agentic-AI Readiness layer alongside the org pillar items (migration 00041).
  include_agentic_layer: z.boolean().default(false),
  // Tier of the individual items when include_individual_layer is true.
  // Ignored on assessments where include_individual_layer=false.
  assessment_tier: araAssessmentTierSchema.default("snapshot"),
  // Per-assessment pillars-in-scope override (migration 00029).
  // Department-stage assessments must hold exactly 4 pillars; Division
  // exactly 6; Enterprise is always all 8 (NULL skips the override).
  // Cardinality is checked at the action level after the stage is known.
  pillars_in_scope: z.array(araPillarSchema).nullable().optional(),
});
export type CreateAraAssessmentValues = z.infer<typeof createAraAssessmentSchema>;

// ─── Respondents ───────────────────────────────────────────────
export const createAraRespondentSchema = z.object({
  assessment_id: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(200),
  name_ar: z.string().max(200).optional().or(z.literal("")),
  email: z.string().email("Invalid email address"),
  role_key: z.string().max(100).optional().or(z.literal("")),
  role_label_en: z.string().max(200).optional().or(z.literal("")),
  role_label_ar: z.string().max(200).optional().or(z.literal("")),
  language_preference: araLanguageSchema,
  pillar_assignments: z.array(araPillarSchema).default([]),
});
export type CreateAraRespondentValues = z.infer<typeof createAraRespondentSchema>;

// ─── Question bank versions ────────────────────────────────────
export const createAraVersionSchema = z.object({
  version_number: z
    .string()
    .regex(/^\d+\.\d+$/, "Use MAJOR.MINOR format (e.g. 1.0, 1.1, 2.0)"),
  version_label: z.string().max(200).optional().or(z.literal("")),
  release_notes: z.string().max(5000).optional().or(z.literal("")),
});
export type CreateAraVersionValues = z.infer<typeof createAraVersionSchema>;

// ─── AI Use Cases ──────────────────────────────────────────────
export const createAraUseCaseSchema = z.object({
  assessment_id: z.string().uuid(),
  name: z.string().min(2, "Use case name is required").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  stage: z.enum(["ideation", "piloting", "production", "retired"]),
  pillar_id: araPillarSchema.optional().nullable(),
  risk_level: z.enum(["low", "medium", "high", "critical"]),
  value_level: z.enum(["low", "medium", "high"]),
  business_owner: z.string().max(200).optional().or(z.literal("")),
  technical_owner: z.string().max(200).optional().or(z.literal("")),
});
export type CreateAraUseCaseValues = z.infer<typeof createAraUseCaseSchema>;

// ─── Questions ─────────────────────────────────────────────────
const questionOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

export const createAraQuestionSchema = z.object({
  version_id: z.string().uuid(),
  pillar_id: araPillarSchema,
  question_number: z.coerce.number().int().positive(),
  question_text_en: z.string().min(1, "English question text required"),
  question_text_ar: z.string().min(1, "Arabic question text required"),
  question_type: z.enum([
    "rating", "multiple_choice", "yes_no", "open_text",
    "situational_judgment", "knowledge_check",
  ]),
  options_en: z.array(questionOptionSchema).optional().nullable(),
  options_ar: z.array(questionOptionSchema).optional().nullable(),
  score_map: z.record(z.string(), z.number()).optional().nullable(),
  help_text_en: z.string().max(2000).optional().or(z.literal("")),
  help_text_ar: z.string().max(2000).optional().or(z.literal("")),
  region: z.enum(["uae", "saudi", "both"]).default("both"),
  sector: z.enum(["government", "banking", "general", "all"]).default("all"),
  layer: z.union([z.literal(1), z.literal(2)]).default(1),
  display_order: z.coerce.number().int().nonnegative().default(0),
});
export type CreateAraQuestionValues = z.infer<typeof createAraQuestionSchema>;
