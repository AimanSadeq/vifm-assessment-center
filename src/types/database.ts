// Core row types matching the Supabase schema.
// These will be replaced by auto-generated types via:
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts

export type Organization = {
  id: string;
  name: string;
  industry: string | null;
  country: string | null;
  contact_name: string | null;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  role: "admin" | "lead_assessor" | "associate_assessor" | "candidate" | "client";
  organization_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CompetencyDomain = {
  id: string;
  name: string;
  sort_order: number;
};

export type CompetencyCluster = {
  id: string;
  domain_id: string;
  name: string;
  sort_order: number;
};

export type Competency = {
  id: string;
  cluster_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  tags: string[] | null;
  qa_questions: string[] | null;
};

export type Exercise = {
  id: string;
  name: string;
  exercise_type: string;
  description: string | null;
  duration_minutes: number | null;
  instructions: string | null;
  // Structured timing
  prep_minutes: number | null;
  meeting_minutes: number | null;
  instructions_minutes: number | null;
  // Briefing content
  participant_brief: string | null;
  scenario_context: string | null;
  assessor_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RolePlayerPrompt = {
  id: string;
  exercise_id: string;
  prompt_text: string;
  trigger_behaviors: string | null;
  character_name: string | null;
  character_role: string | null;
  character_attitude: string | null;
  meeting_objectives: string | null;
  created_at: string;
};

export type Engagement = {
  id: string;
  organization_id: string;
  name: string;
  target_role: string | null;
  status: "draft" | "active" | "completed" | "archived";
  start_date: string | null;
  end_date: string | null;
  assessment_type: string | null;
  norm_group: string | null;
  project_type: string | null;
  cutoff_scores: Record<string, number> | null;
  device_options: string[] | null;
  proctoring_enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EngagementCompetency = {
  id: string;
  engagement_id: string;
  competency_id: string;
  weight: number | null;
};

export type EngagementExercise = {
  id: string;
  engagement_id: string;
  exercise_id: string;
  scheduled_date: string | null;
};

export type ExerciseCompetencyMatrix = {
  id: string;
  engagement_id: string;
  exercise_id: string;
  competency_id: string;
};

export type Candidate = {
  id: string;
  engagement_id: string;
  profile_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  gender: string | null;
  age_range: string | null;
  seniority_level: string | null;
  national_id_hash: string | null;
  function_role: string | null;
  role_profile_id: string | null;
  status: "invited" | "registered" | "in_progress" | "completed" | "withdrawn";
  created_at: string;
  updated_at: string;
};

export type AssessorAssignment = {
  id: string;
  engagement_id: string;
  assessor_id: string;
  candidate_id: string;
  exercise_id: string;
};

export type Observation = {
  id: string;
  assessor_assignment_id: string;
  competency_id: string;
  behavior_observed: string;
  is_positive: boolean | null;
  observed_at: string;
  created_at: string;
};

export type Rating = {
  id: string;
  assessor_assignment_id: string;
  competency_id: string;
  score: number;
  justification: string | null;
  created_at: string;
  updated_at: string;
};

export type IntegrationWorksheet = {
  id: string;
  engagement_id: string;
  assessor_id: string;
  candidate_id: string;
  competency_id: string;
  preliminary_rating: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BehavioralIndicator = {
  id: string;
  competency_id: string;
  indicator_type: "positive" | "negative";
  description: string;
  sort_order: number;
};

export type ConsensusRating = {
  id: string;
  engagement_id: string;
  candidate_id: string;
  competency_id: string;
  final_score: number;
  discussion_notes: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OverallAssessmentRating = {
  id: string;
  engagement_id: string;
  candidate_id: string;
  overall_score: number;
  recommendation: "ready_now" | "ready_with_development" | "not_ready";
  summary: string | null;
  created_at: string;
  updated_at: string;
};

export type ConsentRecord = {
  id: string;
  candidate_id: string;
  consent_type: string;
  consented: boolean;
  contact_consent: boolean | null;
  client_forms_accepted: boolean | null;
  ip_address: string | null;
  consented_at: string;
  expires_at: string | null;
};

export type ProjectTemplate = {
  id: string;
  organization_id: string;
  name: string;
  config: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

// Grouped competency tree for UI display
export type CompetencyTree = {
  domain: CompetencyDomain;
  clusters: {
    cluster: CompetencyCluster;
    competencies: Competency[];
  }[];
}[];

export type RoleProfile = {
  id: string;
  organization_id: string | null;
  name_en: string;
  name_ar: string | null;
  description: string | null;
  target_role: string | null;
  industry: string | null;
  region: "uae" | "saudi" | "gcc" | "global" | null;
  default_target_proficiency: number | null;
  source_jd: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RoleProfileCompetency = {
  id: string;
  role_profile_id: string;
  competency_id: string;
  weight: number | null;
  priority: "high" | "medium" | "low" | null;
  reasoning: string | null;
};

// Role profile + its competencies + denormalized competency name for UI
export type RoleProfileWithCompetencies = RoleProfile & {
  competencies: (RoleProfileCompetency & { competency_name: string })[];
};

// G3 — Self-serve AI quiz on a single competency.
// Questions and answers are stored as JSONB on the attempt so the deck
// is frozen at start-time and reproducible on the results page.

export type QuizQuestionType = "true_false" | "multiple_choice" | "pattern_recognition";

export type QuizDifficulty = "easy" | "medium" | "hard";

export type QuizQuestion = {
  id: string;
  type: QuizQuestionType;
  prompt_en: string;
  prompt_ar: string | null;
  options_en: string[];
  options_ar: string[] | null;
  correct_index: number;
  points: number;
  difficulty: QuizDifficulty;
  explanation_en: string;
  explanation_ar: string | null;
  // Only populated when type === "pattern_recognition"
  sequence?: (string | number | null)[];
};

export type QuizAnswer = {
  question_id: string;
  picked_index: number | null;
  answered_at: string;
};

export type CandidateQuizAttempt = {
  id: string;
  candidate_id: string;
  competency_id: string;
  status: "in_progress" | "completed" | "abandoned";
  questions: QuizQuestion[];
  answers: QuizAnswer[];
  score_pct: number | null;
  correct_count: number | null;
  total_count: number;
  passing_score_pct: number;
  time_taken_seconds: number | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
