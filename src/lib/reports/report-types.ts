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
};
