export type ReportCompetencyData = {
  competencyName: string;
  clusterName: string;
  domainName: string;
  weight: number | null;
  consensusScore: number | null;
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
  // Meta
  generatedAt: string;
  assessorNames: string[];
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
    gap: number;
    relevance: 1 | 2 | 3;
    rationale?: string | null;
  }>;
};
