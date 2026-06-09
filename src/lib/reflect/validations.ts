import { z } from "zod";

// ──────────────────────────────────────────────────────────────
// Enums kept as Zod literals so client + server share the same source.
// Keep in lockstep with the SQL enums in migration 00031.
// ──────────────────────────────────────────────────────────────

export const REFLECT_ENGAGEMENT_STATUS = [
  "draft",
  "live",
  "scoring",
  "complete",
  "archived",
] as const;
export type ReflectEngagementStatus = (typeof REFLECT_ENGAGEMENT_STATUS)[number];

export const REFLECT_RATER_ROLE = [
  "self",
  "manager",
  "peer",
  "direct_report",
  "skip_level",
  "other",
] as const;
export type ReflectRaterRole = (typeof REFLECT_RATER_ROLE)[number];

export const REFLECT_LEVEL_TIER = [
  "exec",
  "senior_mgr",
  "manager",
  "individual_contributor",
  "all",
] as const;
export type ReflectLevelTier = (typeof REFLECT_LEVEL_TIER)[number];

export const REFLECT_PARTICIPANT_STATUS = [
  "invited",
  "raters_invited",
  "in_progress",
  "closed",
  "report_released",
] as const;
export type ReflectParticipantStatus = (typeof REFLECT_PARTICIPANT_STATUS)[number];

export const REFLECT_FRAMEWORK_SOURCE = ["custom", "template"] as const;
export const REFLECT_REPORT_LANGUAGE = ["en", "ar", "bilingual"] as const;
export const REFLECT_DEFAULT_LANGUAGE = ["en", "ar"] as const;
export const REGION = ["uae", "saudi"] as const;
export const SECTOR = ["government", "banking", "general"] as const;

// ──────────────────────────────────────────────────────────────
// Engagement create / update
// ──────────────────────────────────────────────────────────────

export const createEngagementSchema = z.object({
  name: z.string().trim().min(2).max(120),
  organization_id: z.string().uuid().nullable().optional(),
  region: z.enum(REGION).nullable().optional(),
  sector: z.enum(SECTOR).nullable().optional(),
  default_language: z.enum(REFLECT_DEFAULT_LANGUAGE).default("en"),
  report_language: z.enum(REFLECT_REPORT_LANGUAGE).default("bilingual"),
  // Industry-standard minimum is 3 - anything lower defeats the
  // anonymity of pooled peer / direct-report views. We hard-floor at 3
  // and let consultants raise it for stricter use cases.
  anonymity_min_n: z.number().int().min(3).max(10).default(3),
  participant_target_count: z.number().int().min(1).nullable().optional(),
  field_window_start: z.string().nullable().optional(),
  field_window_end: z.string().nullable().optional(),
  is_sandbox: z.boolean().default(false),
  gamified_mode: z.boolean().default(false),
  // Framework selection at create time. One of:
  //   { kind: 'clone', templateId }
  //   { kind: 'manual', name }
  //   { kind: 'ai',    name, sourceText }  -- AI extraction triggered later, schema covers creation only
  framework: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("clone"), templateId: z.string().uuid() }),
    z.object({
      kind: z.literal("manual"),
      name_en: z.string().trim().min(2).max(120),
      name_ar: z.string().trim().max(120).optional(),
    }),
    z.object({
      kind: z.literal("ai"),
      name_en: z.string().trim().min(2).max(120),
      name_ar: z.string().trim().max(120).optional(),
      sourceText: z.string().trim().min(50, "Paste at least a short paragraph describing the client's values and leadership competencies."),
    }),
  ]),
});

export type CreateEngagementPayload = z.infer<typeof createEngagementSchema>;


// ──────────────────────────────────────────────────────────────
// Competency + behaviour edits (post-framework creation)
// ──────────────────────────────────────────────────────────────

export const upsertCompetencySchema = z.object({
  id: z.string().uuid().optional(),
  framework_id: z.string().uuid(),
  name_en: z.string().trim().min(2).max(120),
  name_ar: z.string().trim().max(120).optional().nullable(),
  description_en: z.string().trim().max(1000).optional().nullable(),
  description_ar: z.string().trim().max(1000).optional().nullable(),
  display_order: z.number().int().min(0).default(0),
});
export type UpsertCompetencyPayload = z.infer<typeof upsertCompetencySchema>;


export const upsertBehaviorSchema = z.object({
  id: z.string().uuid().optional(),
  competency_id: z.string().uuid(),
  level_tier: z.enum(REFLECT_LEVEL_TIER).default("all"),
  text_en: z.string().trim().min(5).max(400),
  text_ar: z.string().trim().max(400).optional().nullable(),
  display_order: z.number().int().min(0).default(0),
});
export type UpsertBehaviorPayload = z.infer<typeof upsertBehaviorSchema>;


// ──────────────────────────────────────────────────────────────
// Participants + raters
// ──────────────────────────────────────────────────────────────

export const participantRowSchema = z.object({
  full_name: z.string().trim().min(2).max(200),
  email: z.string().trim().email(),
  role_title: z.string().trim().max(200).optional().nullable(),
  business_unit: z.string().trim().max(200).optional().nullable(),
  level_tier: z.enum(REFLECT_LEVEL_TIER).default("manager"),
  manager_email: z.string().trim().email().optional().nullable(),
  language_preference: z.enum(REFLECT_DEFAULT_LANGUAGE).default("en"),
});
export type ParticipantRow = z.infer<typeof participantRowSchema>;

export const bulkParticipantsSchema = z.object({
  engagement_id: z.string().uuid(),
  rows: z.array(participantRowSchema).min(1).max(500),
});


export const raterRowSchema = z.object({
  // The rater is nominated against ONE participant identified by their email
  // in the engagement. Matching by email keeps the CSV import schema flat.
  participant_email: z.string().trim().email(),
  rater_role: z.enum(REFLECT_RATER_ROLE),
  full_name: z.string().trim().min(2).max(200),
  email: z.string().trim().email(),
  language_preference: z.enum(REFLECT_DEFAULT_LANGUAGE).default("en"),
});
export type RaterRow = z.infer<typeof raterRowSchema>;

export const bulkRatersSchema = z.object({
  engagement_id: z.string().uuid(),
  rows: z.array(raterRowSchema).min(1).max(2000),
});


// ──────────────────────────────────────────────────────────────
// Launch
// ──────────────────────────────────────────────────────────────

export const launchEngagementSchema = z.object({
  engagement_id: z.string().uuid(),
  confirm: z.literal(true),
});
