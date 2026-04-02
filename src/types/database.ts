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

// Grouped competency tree for UI display
export type CompetencyTree = {
  domain: CompetencyDomain;
  clusters: {
    cluster: CompetencyCluster;
    competencies: Competency[];
  }[];
}[];
