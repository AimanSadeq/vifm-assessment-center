export type ReportCompetencyData = {
  competencyName: string;
  clusterName: string;
  domainName: string;
  weight: number | null;
  consensusScore: number | null;
  // Optional one-line "what this competency measures" - rendered in the
  // talent-acquisition + candidate-results lenses. Existing fetchers may leave
  // it unset (the candidate development report ignores it).
  explanation?: string | null;
  // Evidence split into strengths vs development
  strengths: {
    exerciseName: string;
    text: string;
  }[];
  developmentAreas: {
    exerciseName: string;
    text: string;
  }[];
  exerciseRatings: {
    exerciseName: string;
    score: number;
  }[];
  // Development action tips
  developmentTips: string[];
};

export type ReportData = {
  // Engagement info
  engagementName: string;
  organizationName: string;
  targetRole: string | null;
  assessmentDates: string;
  // Exercises used
  exercisesUsed: {
    name: string;
    type: string;
    durationMinutes: number | null;
  }[];
  // Candidate info
  candidateName: string;
  candidateEmail: string;
  // Competency results
  competencies: ReportCompetencyData[];
  // Summary
  topStrengths: string[];
  topDevelopmentAreas: string[];
  /** True when nothing scored 2 or below and these are simply the lowest rated, so the page can say so. */
  developmentAreasAreLowest?: boolean;
  // OAR
  overallScore: number | null;
  recommendation: string | null;
  executiveSummary: string | null;
  // Development recommendations
  developmentRecommendations: {
    competencyName: string;
    recommendation: string;
    priority: string;
  }[];
  // What the report must say about itself: permitted use, limitations,
  // technical quality, who to contact and how to challenge a result
  // (BPS 8.2, 8.9, 8.12, 8.20, 5.49). Optional so other builders need not set
  // them; the section renders with standard wording when they are absent.
  purpose?: string | null;
  integrationMethod?: "weighted_average" | "consensus" | null;
  computedScore?: number | null;
  panelDisagrees?: boolean;
  contactName?: string | null;
  contactEmail?: string | null;
  appealsNote?: string | null;
  /** Share of the behavioural content behind this report that a subject expert has approved. */
  contentApproved?: { approved: number; total: number } | null;
  checkedByName?: string | null;
  checkedAt?: string | null;
  // Meta
  generatedAt: string;
  assessorNames: string[];
  // Data-quality signals for a report caveat. hasAssessorData=false when no
  // observations/ratings underpin the scores; raterCount = distinct assessors
  // on the candidate (a single rater means reduced inter-rater reliability).
  // Optional so other ReportData builders need not set them (no caveat then).
  hasAssessorData?: boolean;
  raterCount?: number;
  // Day 3f - VIFM training-course recommendations driven by this
  // candidate's competency gaps. Optional - renders an extra Learning
  // Plan PDF page when populated, omitted gracefully when empty.
  recommendedCourses?: ReportRecommendedCourse[];
  // Certified technical domains earned by this candidate on the engagement's
  // technical certification programme. Optional - the section is omitted when
  // the candidate holds no technical credentials.
  technicalCertifications?: TechnicalCertLine[];
};

export type TechnicalCertLine = {
  domainNameEn: string;
  domainNameAr: string | null;
  level: number | null;
  credentialCode: string | null;
};

export type ReportRecommendedCourse = {
  course_id: string;
  code: string | null;
  title_en: string;
  title_ar: string | null;
  vertical: string;
  level: string;
  duration_label: string;
  total_score: number;
  drivers: Array<{
    label: string;
    label_ar: string | null;
    gap: number;
    relevance: 1 | 2 | 3;
    rationale?: string | null;
  }>;
};
