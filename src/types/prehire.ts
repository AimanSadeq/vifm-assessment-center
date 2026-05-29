// VIFM Pre-Hire row types matching the Supabase schema (migration 00050).
// These will eventually be replaced by auto-generated types.

export type PrehireRequisitionStatus = "draft" | "open" | "closed" | "archived";
export type PrehireCandidateStatus =
  | "invited"
  | "in_progress"
  | "scored"
  | "shortlisted"
  | "hold"
  | "declined"
  | "withdrawn";
export type PrehireStageKind = "fluent" | "quiz" | "cbi" | "assessment_center";
export type PrehireStageStatus = "pending" | "in_progress" | "completed" | "skipped";

/** One entry in a requisition's ordered stage plan (stored as jsonb). */
export type PrehireStagePlanEntry = {
  kind: PrehireStageKind;
  /** Relative weight in the composite (0–1). Weights are normalized at scoring time. */
  weight: number;
  /** Minimum normalized score (0–100) to "pass" this stage. null = no hurdle. */
  cut_score: number | null;
  /** If true, a fail on this stage flags the candidate for review (never auto-rejects). */
  required: boolean;
};

export type PrehireRequisition = {
  id: string;
  organization_id: string;
  title: string;
  role_profile_id: string | null;
  level: string | null;
  stage_config: PrehireStagePlanEntry[];
  english_required: boolean;
  status: PrehireRequisitionStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PrehireCandidate = {
  id: string;
  requisition_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  access_token: string;
  status: PrehireCandidateStatus;
  current_stage: PrehireStageKind | null;
  composite_score: number | null;
  recommendation: string | null;
  consent_at: string | null;
  invited_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PrehireStageResult = {
  id: string;
  prehire_candidate_id: string;
  kind: PrehireStageKind;
  status: PrehireStageStatus;
  /** Soft link to the instrument's native record (no FK). */
  source_id: string | null;
  raw_score: number | null;
  normalized_score: number | null;
  passed: boolean | null;
  detail: Record<string, unknown> | null;
  flags: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Candidate joined with their stage results — the shape the recruiter dashboard renders. */
export type PrehireCandidateWithStages = PrehireCandidate & {
  stages: PrehireStageResult[];
};

export const PREHIRE_STAGE_LABELS: Record<PrehireStageKind, string> = {
  fluent: "English (Fluent)",
  quiz: "Competency Quiz",
  cbi: "AI Interview",
  assessment_center: "Assessment Center",
};
