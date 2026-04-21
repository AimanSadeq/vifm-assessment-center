// ARA (AI Readiness Assessment) row types matching the Supabase schema.
// These will eventually be replaced by auto-generated types via:
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts

export type AraRegion = "uae" | "saudi";
export type AraSector = "government" | "banking" | "general";
export type AraLanguage = "en" | "ar";
export type AraReportLanguage = "en" | "ar" | "bilingual";
export type AraAssessmentStatus = "draft" | "active" | "completed" | "frozen" | "archived";
export type AraAssessmentPhase = "phase1" | "phase2" | "report";
export type AraQuestionType = "rating" | "multiple_choice" | "yes_no" | "open_text";
export type AraMaterialType = "url" | "word" | "pdf" | "powerpoint";
export type AraFrameworkCategory =
  | "ai_governance"
  | "data_privacy"
  | "cybersecurity"
  | "strategy"
  | "ethics"
  | "transparency";
export type AraSeverity = "mandatory" | "recommended" | "advisory";
export type AraComplianceStatus = "met" | "partial" | "not_met" | "unknown";

export type AraPillarId =
  | "strategy"
  | "data"
  | "technology"
  | "talent"
  | "culture"
  | "governance"
  | "operations"
  | "model_management";

export type AraPillarWeights = Record<AraPillarId, number>;

export type AraOrganization = {
  id: string;
  name: string;
  name_ar: string | null;
  sector: AraSector;
  region: AraRegion;
  data_erasure_requested: boolean;
  data_erasure_requested_at: string | null;
  data_anonymized: boolean;
  data_anonymized_at: string | null;
  created_at: string;
  created_by: string | null;
};

export type AraQuestionBankVersion = {
  id: string;
  version_number: string;
  version_label: string | null;
  published_at: string | null;
  published_by: string | null;
  is_active: boolean;
  release_notes: string | null;
  supersedes_version_id: string | null;
  created_at: string;
};

export type AraAssessment = {
  id: string;
  organization_id: string | null;
  consultant_id: string | null;
  region: AraRegion;
  sector: AraSector;
  default_language: AraLanguage;
  status: AraAssessmentStatus;
  phase: AraAssessmentPhase;
  is_sandbox: boolean;
  question_bank_version_id: string | null;
  pillar_weights: AraPillarWeights;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  frozen_at: string | null;
  archived_at: string | null;
  assessment_year: number;
};

export type AraRespondent = {
  id: string;
  assessment_id: string;
  name: string;
  name_ar: string | null;
  email: string;
  role_key: string | null;
  role_label_en: string | null;
  role_label_ar: string | null;
  access_token: string;
  language_preference: AraLanguage;
  invited_at: string | null;
  first_opened_at: string | null;
  last_active_at: string | null;
  completed_at: string | null;
  reminder_count: number;
  last_reminder_sent_at: string | null;
  created_at: string;
};

export type AraRespondentPillarAssignment = {
  id: string;
  respondent_id: string;
  pillar_id: AraPillarId;
  assigned_at: string;
};

export type AraQuestion = {
  id: string;
  version_id: string;
  pillar_id: AraPillarId;
  question_number: number;
  question_text_en: string;
  question_text_ar: string;
  question_type: AraQuestionType;
  options_en: Array<{ value: string; label: string }> | null;
  options_ar: Array<{ value: string; label: string }> | null;
  score_map: Record<string, number> | null;
  help_text_en: string | null;
  help_text_ar: string | null;
  region: "uae" | "saudi" | "both";
  sector: "government" | "banking" | "general" | "all";
  layer: 1 | 2;
  display_order: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
};

export type AraRegulatoryFramework = {
  id: string;
  region: AraRegion;
  framework_code: string;
  framework_name_en: string;
  framework_name_ar: string;
  authority_name_en: string | null;
  authority_name_ar: string | null;
  framework_category: AraFrameworkCategory;
  tier: 1 | 2 | 3;
  is_mandatory: boolean;
  applies_to_sectors: string[];
  description_en: string | null;
  description_ar: string | null;
  official_url: string | null;
  display_order: number;
  is_active: boolean;
};
