/**
 * Generates the THREE audience-lens sample reports off one synthetic candidate,
 * so a client can see how the same VIFM behavioural assessment is re-framed for
 * each reader:
 *
 *   public/samples/VIFM-AC-Sample-Candidate-Report.pdf          (development lens)
 *   public/samples/VIFM-AC-Sample-Hiring-Manager-Report.pdf     (decision lens)
 *   public/samples/VIFM-AC-Sample-Talent-Acquisition-Report.pdf (screening/pipeline lens)
 *
 * Run:  npx tsx scripts/build-audience-reports.tsx
 *
 * One persona ("Noura Al-Otaibi"), one set of scores - three reports. The story
 * is deliberately nuanced (strong THINKING/RESULTS, develop PEOPLE) so each
 * lens has something distinct to say. Uses the current v2 competency names.
 */

import React from "react";
import { renderToFile } from "@react-pdf/renderer";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { CandidateReport } from "../src/lib/reports/candidate-report";
import { HiringManagerReport } from "../src/lib/reports/hiring-manager-report";
import { TalentAcquisitionReport } from "../src/lib/reports/talent-acquisition-report";
import type { ReportData, ReportCompetencyData } from "../src/lib/reports/report-types";

const OUT_DIR = resolve(process.cwd(), "public/samples");

const EX = {
  inbasket: "Strategic In-Basket",
  rolePlay: "Direct-Report Role Play",
  casePres: "Business Case Presentation",
  interview: "Behavioural Interview",
};

type Seed = {
  name: string; cluster: string; domain: string; weight: number; score: number;
  strengths?: { exerciseName: string; text: string }[];
  developmentAreas?: { exerciseName: string; text: string }[];
  tips?: string[];
};

// 8 competencies across the four domains, current v2 names. Nuanced profile:
// strong thinking + delivery, clear development in people-leadership.
const SEEDS: Seed[] = [
  {
    name: "Forward Strategy Setting", cluster: "Strategic & Commercial Reasoning", domain: "THINKING", weight: 16, score: 4,
    strengths: [
      { exerciseName: EX.casePres, text: "Linked a tactical cost decision to the three-year portfolio ambition the panel had not yet surfaced." },
      { exerciseName: EX.inbasket, text: "Sequenced the in-tray around strategic impact rather than urgency, deferring low-leverage items." },
    ],
    tips: ["Pressure-test each plan against a downside scenario before committing - name the one assumption that would break it."],
  },
  {
    name: "Critical Analysis", cluster: "Strategic & Commercial Reasoning", domain: "THINKING", weight: 14, score: 4,
    strengths: [
      { exerciseName: EX.casePres, text: "Isolated the single assumption that broke the business case and re-ran the numbers before recommending." },
    ],
    tips: ["Keep doing this - and make the disconfirming check explicit so others can follow the reasoning."],
  },
  {
    name: "Sound Judgement", cluster: "Strategic & Commercial Reasoning", domain: "THINKING", weight: 12, score: 3,
    strengths: [{ exerciseName: EX.interview, text: "Weighed risk and reward proportionately when describing a real escalation under time pressure." }],
    developmentAreas: [{ exerciseName: EX.inbasket, text: "A few calls defaulted to caution where the evidence supported a faster, bolder choice." }],
    tips: ["Set a default decision rule for recurring trade-offs so judgement is consistent under load."],
  },
  {
    name: "Outcome Ownership", cluster: "Delivery & Execution", domain: "RESULTS", weight: 14, score: 4,
    strengths: [
      { exerciseName: EX.inbasket, text: "Took an ambiguous remit and returned a sequenced 90-day plan with named owners and checkpoints." },
    ],
    tips: ["Stretch the ownership outward - hold peers to their commitments as visibly as your own."],
  },
  {
    name: "Planning & Prioritisation", cluster: "Delivery & Execution", domain: "RESULTS", weight: 11, score: 3,
    strengths: [{ exerciseName: EX.inbasket, text: "Triaged a crowded in-tray into a defensible order with clear rationale." }],
    developmentAreas: [{ exerciseName: EX.casePres, text: "Plan held few contingencies; a slipped dependency would have had no fallback." }],
    tips: ["Build one explicit contingency into every plan - the 'if this slips, then that' line."],
  },
  {
    name: "Clear & Adaptive Communication", cluster: "Influence & Communication", domain: "PEOPLE", weight: 12, score: 2,
    developmentAreas: [
      { exerciseName: EX.casePres, text: "Over-explained the rationale in the board brief; the core recommendation arrived late and landed diluted." },
      { exerciseName: EX.rolePlay, text: "Did not adjust register for a non-technical stakeholder, who disengaged." },
    ],
    tips: [
      "Lead with the recommendation, then the why: situation - recommendation - one reason - the ask, in 90 seconds.",
      "Read the room: name the listener's priority back to them before making your case.",
    ],
  },
  {
    name: "Coaching & Talent Growth", cluster: "Leading & Developing Others", domain: "PEOPLE", weight: 11, score: 2,
    developmentAreas: [
      { exerciseName: EX.rolePlay, text: "In the direct-report role play, solved the problem for the report rather than developing their own thinking." },
    ],
    tips: [
      "Swap solutions for questions: ask 'what have you tried, and what would you do next?' before offering the answer.",
      "Hold one development-only conversation per report per month - no task agenda.",
    ],
  },
  {
    name: "Resilience Under Pressure", cluster: "Adaptability & Change", domain: "SELF", weight: 10, score: 3,
    strengths: [{ exerciseName: EX.rolePlay, text: "Stayed composed when the role-player escalated, keeping the conversation on track." }],
    developmentAreas: [{ exerciseName: EX.casePres, text: "Recovery from a tough question was slower than ideal; momentum dipped before regaining it." }],
    tips: ["Prepare a 'reset line' for tough moments - a phrase that buys two seconds and steadies the delivery."],
  },
];

function buildCompetencies(): ReportCompetencyData[] {
  return SEEDS.map((sd): ReportCompetencyData => ({
    competencyName: sd.name,
    clusterName: sd.cluster,
    domainName: sd.domain,
    weight: sd.weight,
    consensusScore: sd.score,
    strengths: sd.strengths ?? [],
    developmentAreas: sd.developmentAreas ?? [],
    exerciseRatings: [
      { exerciseName: EX.inbasket, score: Math.max(1, Math.min(5, sd.score)) },
      { exerciseName: EX.rolePlay, score: Math.max(1, Math.min(5, sd.domain === "PEOPLE" ? sd.score : sd.score - 0)) },
    ],
    developmentTips: sd.tips ?? [],
  }));
}

function buildPersona(): ReportData {
  const competencies = buildCompetencies();
  const strengths = competencies.filter((c) => (c.consensusScore ?? 0) >= 4).map((c) => c.competencyName);
  const dev = competencies.filter((c) => (c.consensusScore ?? 0) < 3).map((c) => c.competencyName);
  return {
    engagementName: "Corporate Banking - Senior Manager Selection, Q2 2026",
    organizationName: "Gulf Commercial Bank (sample)",
    targetRole: "Senior Manager, Corporate Banking",
    assessmentDates: "12-13 May 2026",
    exercisesUsed: [
      { name: EX.inbasket, type: "in_basket", durationMinutes: 90 },
      { name: EX.rolePlay, type: "role_play", durationMinutes: 45 },
      { name: EX.casePres, type: "oral_presentation", durationMinutes: 30 },
      { name: EX.interview, type: "competency_based_interview", durationMinutes: 60 },
    ],
    candidateName: "Noura Al-Otaibi",
    candidateEmail: "noura.alotaibi@example.ae",
    competencies,
    topStrengths: strengths.slice(0, 3),
    topDevelopmentAreas: dev.slice(0, 3),
    overallScore: 3.1,
    recommendation: "ready_with_development",
    executiveSummary:
      "Noura is a strong analytical and delivery performer: she sets direction, isolates the assumption " +
      "that matters, and turns ambiguity into a sequenced plan. The clear development priority is " +
      "people-leadership - tightening how she communicates a recommendation and shifting from solving for " +
      "her team to coaching them. Recommended as Ready with Development: appoint with targeted support on " +
      "the two PEOPLE competencies. (Illustrative sample - synthetic candidate.)",
    developmentRecommendations: [
      { competencyName: "Clear & Adaptive Communication", recommendation: "Lead with the recommendation then the why; rehearse a 90-second situation-recommendation-reason-ask pattern before each senior update.", priority: "high" },
      { competencyName: "Coaching & Talent Growth", recommendation: "Run one development-only conversation per direct report each month; replace solutions with questions.", priority: "high" },
      { competencyName: "Planning & Prioritisation", recommendation: "Add one explicit contingency to every plan and review dependencies weekly.", priority: "medium" },
    ],
    generatedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    assessorNames: ["Dr. Sarah Al Ameri (Lead)", "Mohammed Al Jaber", "Layla Al Shamsi"],
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const data = buildPersona();
  const jobs: Array<[string, React.ReactElement]> = [
    ["VIFM-AC-Sample-Candidate-Report.pdf", <CandidateReport data={data} />],
    ["VIFM-AC-Sample-Hiring-Manager-Report.pdf", <HiringManagerReport data={data} />],
    ["VIFM-AC-Sample-Talent-Acquisition-Report.pdf", <TalentAcquisitionReport data={data} />],
  ];
  for (const [file, el] of jobs) {
    process.stdout.write(`> ${file} ... `);
    await renderToFile(el, resolve(OUT_DIR, file));
    process.stdout.write("ok\n");
  }
  console.log("\n3 audience sample reports written to public/samples/");
}

main().catch((e) => { console.error(e); process.exit(1); });
