/**
 * Generates the THREE audience-lens sample reports for a TALENT-ACQUISITION
 * (selection) context, framed as the output of the VIFM online behavioural
 * psychometric assessment (no assessment-center exercises or assessors), off one
 * synthetic candidate:
 *
 *   public/samples/VIFM-Sample-Candidate-Report.pdf          (results - for the individual)
 *   public/samples/VIFM-Sample-Manager-Report.pdf            (development - for the line manager)
 *   public/samples/VIFM-Sample-Talent-Acquisition-Report.pdf (hiring - fit score + recommend to pursue)
 *
 * Run:  npx tsx scripts/build-audience-reports.tsx
 *
 * Three distinct purposes off one persona: the candidate sees only their results
 * (no development plan, no verdict); the manager gets a development guide (where
 * they stand + per-competency advice and tips); talent acquisition gets the
 * hiring decision (Fit Score + a recommendation to pursue). One persona
 * ("Noura Al-Otaibi"), one set of scores - three lenses. Current v2 competency names.
 */

import React from "react";
import { renderToFile } from "@react-pdf/renderer";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { CandidateResultsReport } from "../src/lib/reports/candidate-results-report";
import { ManagerReport } from "../src/lib/reports/manager-report";
import { TalentAcquisitionReport } from "../src/lib/reports/talent-acquisition-report";
import type { ReportData, ReportCompetencyData } from "../src/lib/reports/report-types";

const OUT_DIR = resolve(process.cwd(), "public/samples");

type Seed = {
  name: string; cluster: string; domain: string; weight: number; score: number;
  explanation: string;
  strengths?: string[];
  developmentAreas?: string[];
  tips?: string[];
};

// 8 competencies across the four domains, current v2 names. Nuanced profile:
// strong thinking + delivery, lower on people-leadership. Evidence lines describe
// the behavioural pattern the online psychometric surfaced (no live exercises).
const SEEDS: Seed[] = [
  {
    name: "Forward Strategy Setting", cluster: "Strategic & Commercial Reasoning", domain: "THINKING", weight: 16, score: 4,
    explanation: "Sets direction with a long-term, whole-organisation view and anticipates how external shifts affect the business.",
    strengths: ["Consistently linked near-term choices to a longer-term, whole-organisation view."],
    tips: [
      "Hand them a cross-functional problem where the long-term view is the hard part, and have them present the trade-offs.",
      "Ask them to mentor a peer on connecting day-to-day decisions back to the strategy.",
    ],
  },
  {
    name: "Critical Analysis", cluster: "Strategic & Commercial Reasoning", domain: "THINKING", weight: 14, score: 4,
    explanation: "Breaks down complex information, tests assumptions, and separates signal from noise before concluding.",
    strengths: ["Reliably isolated the assumption that mattered and tested it before concluding."],
    tips: [
      "Give them the least-structured analysis on the team and ask for the single assumption that matters most.",
      "Have them run a short 'how I pressure-test a case' session so the team learns the approach.",
    ],
  },
  {
    name: "Sound Judgement", cluster: "Strategic & Commercial Reasoning", domain: "THINKING", weight: 12, score: 3,
    explanation: "Weighs risk and reward proportionately to reach balanced decisions, including under time pressure.",
    strengths: ["Weighed risk and reward proportionately, including under time pressure."],
    tips: [
      "Stretch this with higher-stakes, time-boxed decisions and debrief the reasoning, not just the outcome.",
      "Ask them to narrate the risks they weighed on a live call so the judgement becomes visible and repeatable.",
    ],
  },
  {
    name: "Outcome Ownership", cluster: "Delivery & Execution", domain: "RESULTS", weight: 14, score: 4,
    explanation: "Takes personal accountability for results and turns an ambiguous remit into delivered outcomes.",
    strengths: ["Turned ambiguous situations into clear, owned outcomes with named next steps."],
    tips: [
      "Give them end-to-end ownership of a deliverable with real ambiguity and let them set the checkpoints.",
      "Have them model their planning approach for a colleague who struggles to close things out.",
    ],
  },
  {
    name: "Planning & Prioritisation", cluster: "Delivery & Execution", domain: "RESULTS", weight: 11, score: 3,
    explanation: "Organises work and sequences priorities so the right things get done in the right order.",
    strengths: ["Sequenced competing priorities into a defensible order with clear rationale."],
    developmentAreas: ["Built in few contingencies - a slipped dependency would have had no fallback."],
    tips: [
      "Ask for one explicit contingency on every plan they own, and review dependencies weekly for a month.",
      "Have them sequence a genuinely over-loaded backlog and defend the order to the team.",
    ],
  },
  {
    name: "Clear & Adaptive Communication", cluster: "Influence & Communication", domain: "PEOPLE", weight: 12, score: 2,
    explanation: "Conveys messages clearly and adapts style to the audience so the point lands.",
    developmentAreas: ["Tends to over-explain the rationale; the core message arrives late and lands diluted."],
    tips: [
      "Coach the 'recommendation first, then the why' pattern; rehearse a 90-second update before senior meetings.",
      "After each key update, give specific feedback on whether the core message landed first.",
      "Have them rewrite one dense brief into five lines and a single, explicit ask.",
    ],
  },
  {
    name: "Coaching & Talent Growth", cluster: "Leading & Developing Others", domain: "PEOPLE", weight: 11, score: 2,
    explanation: "Develops others' capability through questioning, feedback and stretch rather than solving for them.",
    developmentAreas: ["Leans toward solving problems directly rather than developing others' own thinking."],
    tips: [
      "Agree one development-only conversation per direct report each month - questions, not solutions.",
      "Pair them with a strong coach on the team to observe how the thinking gets handed back.",
      "Ask them to set one stretch goal with a report and support it rather than solve it.",
    ],
  },
  {
    name: "Resilience Under Pressure", cluster: "Adaptability & Change", domain: "SELF", weight: 10, score: 3,
    explanation: "Maintains composure and effectiveness when under stress or facing setbacks.",
    strengths: ["Maintained composure and effectiveness under stress and setbacks."],
    tips: [
      "Give early exposure to a high-pressure situation, then debrief on what kept them steady.",
      "Have them name their personal early-warning signs of strain and a simple reset routine.",
    ],
  },
];

function buildCompetencies(): ReportCompetencyData[] {
  return SEEDS.map((sd): ReportCompetencyData => ({
    competencyName: sd.name,
    clusterName: sd.cluster,
    domainName: sd.domain,
    weight: sd.weight,
    consensusScore: sd.score,
    explanation: sd.explanation,
    strengths: (sd.strengths ?? []).map((text) => ({ exerciseName: "", text })),
    developmentAreas: (sd.developmentAreas ?? []).map((text) => ({ exerciseName: "", text })),
    exerciseRatings: [],
    developmentTips: sd.tips ?? [],
  }));
}

function buildPersona(): ReportData {
  const competencies = buildCompetencies();
  const strengths = competencies.filter((c) => (c.consensusScore ?? 0) >= 4).map((c) => c.competencyName);
  const below = competencies.filter((c) => (c.consensusScore ?? 0) < 3).map((c) => c.competencyName);
  return {
    engagementName: "Corporate Banking - Senior Manager Selection, Q2 2026",
    organizationName: "Gulf Commercial Bank (sample)",
    targetRole: "Senior Manager, Corporate Banking",
    assessmentDates: "12 May 2026",
    exercisesUsed: [],
    candidateName: "Noura Al-Otaibi",
    candidateEmail: "noura.alotaibi@example.ae",
    competencies,
    topStrengths: strengths.slice(0, 3),
    topDevelopmentAreas: below.slice(0, 3),
    overallScore: 3.1,
    recommendation: "ready_with_development",
    executiveSummary:
      "Strong analytical and delivery profile: sets direction, isolates the assumption that matters, and turns " +
      "ambiguity into a sequenced plan. The flagged areas are both in people-leadership - communicating a " +
      "recommendation crisply and coaching rather than solving for the team. Recommend to pursue, conditional " +
      "on a development plan for those two competencies. (Illustrative sample - synthetic candidate.)",
    developmentRecommendations: [
      { competencyName: "Clear & Adaptive Communication", recommendation: "Lead with the recommendation then the why; rehearse a 90-second situation-recommendation-reason-ask pattern before senior updates.", priority: "high" },
      { competencyName: "Coaching & Talent Growth", recommendation: "Run one development-only conversation per direct report each month; replace solutions with questions.", priority: "high" },
      { competencyName: "Planning & Prioritisation", recommendation: "Add one explicit contingency to every plan and review dependencies weekly.", priority: "medium" },
    ],
    generatedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    assessorNames: [],
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const data = buildPersona();
  const jobs: Array<[string, React.ReactElement]> = [
    ["VIFM-Sample-Candidate-Report.pdf", <CandidateResultsReport data={data} />],
    ["VIFM-Sample-Manager-Report.pdf", <ManagerReport data={data} />],
    ["VIFM-Sample-Talent-Acquisition-Report.pdf", <TalentAcquisitionReport data={data} />],
  ];
  for (const [file, el] of jobs) {
    process.stdout.write(`> ${file} ... `);
    await renderToFile(el, resolve(OUT_DIR, file));
    process.stdout.write("ok\n");
  }
  console.log("\n3 audience sample reports written to public/samples/");
}

main().catch((e) => { console.error(e); process.exit(1); });
