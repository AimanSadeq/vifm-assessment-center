/**
 * Generates 3 sample-report PDFs for /ac/engage. Each tier card has a
 * "Download sample report (PDF)" link that points at one of these.
 *
 *   public/samples/VIFM-AC-Sample-Report-Single.pdf       (4 competencies)
 *   public/samples/VIFM-AC-Sample-Report-Programme.pdf    (6 competencies)
 *   public/samples/VIFM-AC-Sample-Report-Partnership.pdf  (8 competencies)
 *
 * Run:
 *   npx tsx scripts/build-sample-reports.ts
 *
 * Re-run any time the CandidateReport renderer changes shape, or when
 * you want to refresh the sample candidate's narrative. Output is
 * committed alongside the rendered PDFs so prospects don't need a
 * dev environment to see them.
 *
 * Synthetic candidate is "Aisha Al Marri" — the company / role / scoring
 * vary by tier so the three PDFs visibly differ at a glance:
 *
 *   Single      → Risk Manager at Al Noor Bank, 4 competencies
 *   Programme   → Senior Manager cohort at ADNOC, 6 competencies
 *   Partnership → Chief Operating Officer at a sovereign fund, 8 competencies
 */

import React from "react";
import { renderToFile } from "@react-pdf/renderer";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { CandidateReport } from "../src/lib/reports/candidate-report";
import type { ReportData, ReportCompetencyData } from "../src/lib/reports/report-types";

const ROOT = process.cwd();
const OUT_DIR = resolve(ROOT, "public/samples");

type TierKey = "single" | "programme" | "partnership";

type TierConfig = {
  fileName: string;
  engagementName: string;
  organizationName: string;
  targetRole: string;
  candidateName: string;
  candidateEmail: string;
  assessmentDates: string;
  competencyCount: 4 | 6 | 8;
  exercisesUsed: ReportData["exercisesUsed"];
  overallScore: number;
  recommendation: string;
  assessorNames: string[];
};

// Fictional candidate, kept consistent across the three tiers so a
// reader comparing PDFs sees that the *shape* differs (driven by the
// number of competencies + exercise mix) rather than the candidate.
const CANDIDATE = {
  name: "Aisha Al Marri",
  email: "aisha.almarri@example.ae",
};

const TIERS: Record<TierKey, TierConfig> = {
  single: {
    fileName: "VIFM-AC-Sample-Report-Single.pdf",
    engagementName: "Risk Manager Selection — April 2026",
    organizationName: "Al Noor Bank (sample)",
    targetRole: "Risk Manager",
    candidateName: CANDIDATE.name,
    candidateEmail: CANDIDATE.email,
    assessmentDates: "8–9 April 2026",
    competencyCount: 4,
    exercisesUsed: [
      { name: "Risk Scenario In-Tray",    type: "in_basket",          durationMinutes: 90 },
      { name: "Stakeholder Role Play",    type: "role_play",          durationMinutes: 45 },
      { name: "Behavioural Interview",    type: "competency_interview", durationMinutes: 60 },
    ],
    overallScore: 3.5,
    recommendation: "Ready with Development",
    assessorNames: ["Dr. Sarah Al Ameri (Lead)", "Khalid Al Nuaimi"],
  },
  programme: {
    fileName: "VIFM-AC-Sample-Report-Programme.pdf",
    engagementName: "Senior Manager Cohort Programme — Q2 2026",
    organizationName: "ADNOC (sample)",
    targetRole: "Senior Manager",
    candidateName: CANDIDATE.name,
    candidateEmail: CANDIDATE.email,
    assessmentDates: "12–13 April 2026 · cohort 3 of 5",
    competencyCount: 6,
    exercisesUsed: [
      { name: "Strategic In-Basket",      type: "in_basket",          durationMinutes: 120 },
      { name: "Direct Report Role Play",  type: "role_play",          durationMinutes: 45 },
      { name: "Operating Plan Case",      type: "case_study",         durationMinutes: 90 },
      { name: "Board Brief Presentation", type: "oral_presentation",  durationMinutes: 30 },
      { name: "Behavioural Interview",    type: "competency_interview", durationMinutes: 60 },
    ],
    overallScore: 4.0,
    recommendation: "Ready Now",
    assessorNames: ["Dr. Sarah Al Ameri (Lead)", "Mohammed Al Jaber", "Layla Al Shamsi"],
  },
  partnership: {
    fileName: "VIFM-AC-Sample-Report-Partnership.pdf",
    engagementName: "Sovereign Fund · Executive Track Q2 2026",
    organizationName: "Sovereign Fund — name redacted (sample)",
    targetRole: "Chief Operating Officer",
    candidateName: CANDIDATE.name,
    candidateEmail: CANDIDATE.email,
    assessmentDates: "19–21 April 2026 · executive panel",
    competencyCount: 8,
    exercisesUsed: [
      { name: "Strategy Brief Case",         type: "case_study",            durationMinutes: 150 },
      { name: "Senior Stakeholder Role Play", type: "role_play",            durationMinutes: 60 },
      { name: "Board Update Presentation",   type: "oral_presentation",     durationMinutes: 45 },
      { name: "Cross-Functional Group Sim",  type: "group_exercise",        durationMinutes: 120 },
      { name: "Strategic In-Basket",         type: "in_basket",             durationMinutes: 120 },
      { name: "Behavioural Event Interview", type: "competency_interview",  durationMinutes: 90 },
    ],
    overallScore: 4.2,
    recommendation: "Ready Now",
    assessorNames: ["Dr. Sarah Al Ameri (Lead, partnership)", "Mohammed Al Jaber", "Layla Al Shamsi", "Yousef Al Hamadi"],
  },
};

// Eight illustrative VIFM competencies spanning the four domains.
// We slice 4 / 6 / 8 from this list per tier so the report shows
// a believable sub-set of the 38-competency framework.
const COMPETENCY_LIBRARY: Array<Pick<ReportCompetencyData, "competencyName" | "clusterName" | "domainName"> & {
  weight: number;
  scoreCurve: [number, number, number]; // single, programme, partnership
}> = [
  { competencyName: "Strategic Thinking",    clusterName: "Strategic Mindset",   domainName: "THINKING", weight: 18, scoreCurve: [3, 4, 4] },
  { competencyName: "Decision Quality",      clusterName: "Strategic Mindset",   domainName: "THINKING", weight: 15, scoreCurve: [4, 4, 5] },
  { competencyName: "Drive for Results",     clusterName: "Execution",           domainName: "RESULTS",  weight: 14, scoreCurve: [4, 4, 4] },
  { competencyName: "Plans and Aligns",      clusterName: "Execution",           domainName: "RESULTS",  weight: 12, scoreCurve: [3, 4, 4] },
  { competencyName: "Influences",            clusterName: "Stakeholder Impact",  domainName: "PEOPLE",   weight: 12, scoreCurve: [3, 4, 5] },
  { competencyName: "Develops Talent",       clusterName: "Stakeholder Impact",  domainName: "PEOPLE",   weight: 10, scoreCurve: [3, 3, 4] },
  { competencyName: "Manages Ambiguity",     clusterName: "Self-Awareness",      domainName: "SELF",     weight: 10, scoreCurve: [3, 4, 4] },
  { competencyName: "Self-Development",      clusterName: "Self-Awareness",      domainName: "SELF",     weight: 9,  scoreCurve: [4, 4, 5] },
];

const STRENGTH_TEMPLATES = [
  "Took ownership of an ambiguous brief and delivered a clear plan with sequenced milestones.",
  "Re-framed the problem to surface the upstream constraint the rest of the room had missed.",
  "Pushed back on the role-player's premature conclusion while keeping the relationship intact.",
  "Built consensus across two assessors playing competing stakeholder positions.",
];

const DEVELOPMENT_TEMPLATES = [
  "Pace of decision-making slowed when faced with conflicting signals — could anchor on a default sooner.",
  "Tended to over-explain rationale; tighter framing would land the same conclusion in half the time.",
  "Defaulted to detail-checking rather than delegating; a stronger signal of trust would lift the team.",
  "Defensiveness emerged when challenged on cost assumptions — separating the idea from the ego will help.",
];

const TIP_TEMPLATES = [
  "Set a 24-hour decision rule on cross-functional questions: gather inputs, decide, then iterate.",
  "Practise a 90-second framing pattern: situation · option-set · recommendation · ask.",
  "Pair with a delegation coach for one quarter. Pick one workstream to fully transfer.",
  "Try a weekly retrospective with your direct reports — what would you have decided differently?",
];

function takeFromTemplate<T>(arr: T[], n: number, seed: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[(seed + i) % arr.length]);
  return out;
}

function buildCompetencies(tier: TierKey, count: 4 | 6 | 8): ReportCompetencyData[] {
  const tierIndex: Record<TierKey, 0 | 1 | 2> = { single: 0, programme: 1, partnership: 2 };
  const ti = tierIndex[tier];
  return COMPETENCY_LIBRARY.slice(0, count).map((c, idx): ReportCompetencyData => {
    const score = c.scoreCurve[ti];
    return {
      competencyName: c.competencyName,
      clusterName: c.clusterName,
      domainName: c.domainName,
      weight: c.weight,
      consensusScore: score,
      strengths: takeFromTemplate(STRENGTH_TEMPLATES, 2, idx).map((text, i) => ({
        exerciseName: i === 0 ? "Behavioural Interview" : "Case Study",
        text,
      })),
      developmentAreas:
        score >= 4
          ? []
          : takeFromTemplate(DEVELOPMENT_TEMPLATES, 1, idx).map((text) => ({
              exerciseName: "Role Play",
              text,
            })),
      exerciseRatings: TIERS[tier].exercisesUsed.slice(0, 2).map((ex) => ({
        exerciseName: ex.name,
        score: Math.max(1, Math.min(5, score + (Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1)))),
      })),
      developmentTips: takeFromTemplate(TIP_TEMPLATES, score >= 4 ? 1 : 2, idx),
    };
  });
}

function buildReport(tier: TierKey): ReportData {
  const cfg = TIERS[tier];
  const competencies = buildCompetencies(tier, cfg.competencyCount);
  const strengths = competencies
    .filter((c) => (c.consensusScore ?? 0) >= 4)
    .map((c) => c.competencyName);
  const developmentAreas = competencies
    .filter((c) => (c.consensusScore ?? 0) < 4)
    .map((c) => c.competencyName);
  return {
    engagementName: cfg.engagementName,
    organizationName: cfg.organizationName,
    targetRole: cfg.targetRole,
    assessmentDates: cfg.assessmentDates,
    exercisesUsed: cfg.exercisesUsed,
    candidateName: cfg.candidateName,
    candidateEmail: cfg.candidateEmail,
    competencies,
    topStrengths: strengths.slice(0, 3),
    topDevelopmentAreas: developmentAreas.slice(0, 3),
    overallScore: cfg.overallScore,
    recommendation: cfg.recommendation,
    executiveSummary:
      `Candidate demonstrated ${strengths.length} clear strengths across the ` +
      `${cfg.competencyCount}-competency profile and ${developmentAreas.length} ` +
      `development priorities. The overall recommendation reflects the wash-up ` +
      `consensus across ${cfg.assessorNames.length} assessors over ${cfg.exercisesUsed.length} exercises. ` +
      `(This is a sample — illustrative narrative only.)`,
    developmentRecommendations: developmentAreas.slice(0, 3).map((name) => ({
      competencyName: name,
      recommendation: TIP_TEMPLATES[Math.floor(Math.random() * TIP_TEMPLATES.length)],
      priority: "high",
    })),
    generatedAt: new Date().toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    }),
    assessorNames: cfg.assessorNames,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const tier of Object.keys(TIERS) as TierKey[]) {
    const cfg = TIERS[tier];
    const data = buildReport(tier);
    const out = resolve(OUT_DIR, cfg.fileName);
    process.stdout.write(`▶ ${cfg.fileName} … `);
    await renderToFile(<CandidateReport data={data} />, out);
    process.stdout.write(`ok\n`);
  }
  console.log("\nSamples written to public/samples/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
