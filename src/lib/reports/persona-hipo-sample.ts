// Deterministic demo data for the VIFM High-Potential Profile - powers the
// "Download sample report" button on the Scientific Models hub so staff can
// show the report without a completed bundle sitting. Fictional throughout
// ("Sample Candidate / Demo Organisation"); no DB, no PII.

import type { HipoPdfData } from "@/lib/reports/persona-hipo-data";
import {
  HIPO_ABILITY_WEIGHTS,
  HIPO_BAND_LABEL,
  HIPO_CUTS,
  hipoBand,
  hipoCell,
  cognitiveTo5,
  engagementOverlay,
  COGNITIVE_DEV_ACTIVITIES,
} from "@/lib/reports/persona-hipo-model";
import { HIPO_ENGAGEMENT_ITEMS, scoreEngagement } from "@/lib/hipo/engagement-items";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** A realistic "Emerging Potential" sample profile (aspiration ~4.1, ability ~3.6).
 *  `generatedAt` is the display string; `completedAtIso` an ISO timestamp the
 *  Engagement page reformats via new Date(). */
export function sampleHipoPdfData(generatedAt: string, completedAtIso: string): HipoPdfData {
  const aspirationMarkers = [
    { name: "Proactive Initiative", score: 4.5 },
    { name: "Continuous Self-Development", score: 4.4 },
    { name: "Outcome Ownership", score: 4.3 },
    { name: "Adaptive Learning Capacity", score: 4.2 },
    { name: "Accountability for Commitments", score: 4.0 },
    { name: "Learning by Doing", score: 3.9 },
    { name: "Mobilising Around Purpose", score: 3.8 },
    { name: "Principled Courage", score: 3.7 },
  ];
  const aspiration = r2(aspirationMarkers.reduce((a, m) => a + m.score, 0) / aspirationMarkers.length);

  const behavioural = 3.55;
  const cognitiveSubtests = [
    { key: "inductive", name: "Inductive Reasoning", pct: 72 },
    { key: "numerical", name: "Numerical Reasoning", pct: 65 },
    { key: "deductive", name: "Deductive Reasoning", pct: 58 },
  ].map((s) => ({ key: s.key, name: s.name, pct: s.pct, on5: r2(cognitiveTo5(s.pct)), band: "" }));
  const cognitive = r2(cognitiveSubtests.reduce((a, s) => a + s.on5, 0) / cognitiveSubtests.length);
  const ability = r2(HIPO_ABILITY_WEIGHTS.behavioural * behavioural + HIPO_ABILITY_WEIGHTS.cognitive * cognitive);
  const cell = hipoCell(aspiration, ability);

  // A realistic "Strong" manager reading across all items. Reverse-keyed items
  // (retention_risk, disengagement_signal, external_looking) score 6 - answer,
  // so a low raw = high engagement.
  const engOverrides: Record<string, number> = {
    acts_on_development: 5,
    internal_appetite: 3,
    retention_risk: 2, // reverse -> 4
    disengagement_signal: 2, // reverse -> 4
    external_looking: 1, // reverse -> 5
  };
  const engAnswers: Record<string, number> = {};
  for (const item of HIPO_ENGAGEMENT_ITEMS) engAnswers[item.key] = engOverrides[item.key] ?? 4;
  const engScore = scoreEngagement(engAnswers)!;
  const engBand = hipoBand(engScore);

  return {
    takerName: "Sample Candidate",
    orgName: "Demo Organisation",
    generatedAt,
    aspiration,
    aspirationBand: hipoBand(aspiration),
    aspirationMarkers,
    behavioural,
    behaviouralCount: 30,
    cognitive,
    cognitiveSubtests,
    ability,
    abilityBand: hipoBand(ability),
    cell,
    bandLabel: (b) => HIPO_BAND_LABEL[b],
    cuts: HIPO_CUTS,
    weights: HIPO_ABILITY_WEIGHTS,
    behaviouralDev: [
      {
        name: "Strategic Thinking",
        score: 2.8,
        tips: [
          "Before your next planning cycle, write the three market forces most likely to reshape your function and test them with a senior peer.",
          "Shadow one leadership meeting per quarter and note which decisions were framed long-term versus firefighting.",
          "Turn one recurring operational problem into a one-page trend analysis with a recommendation.",
        ],
      },
      {
        name: "Develops Talent",
        score: 3.0,
        tips: [
          "Hold a monthly 30-minute growth conversation with each direct report - development topics only, no status updates.",
          "Delegate one visible task you enjoy to a team member and coach them through it end-to-end.",
        ],
      },
      {
        name: "Manages Ambiguity",
        score: 3.1,
        tips: [
          "On your next unclear brief, draft your own one-paragraph problem statement and confirm it before starting work.",
          "Practise deciding with 70% of the information on low-stakes calls, and review the outcomes monthly.",
        ],
      },
    ],
    cognitiveDev: [{ name: "Deductive Reasoning", activities: COGNITIVE_DEV_ACTIVITIES["deductive"] ?? [] }],
    engagement: {
      score: engScore,
      band: engBand,
      bandLabel: HIPO_BAND_LABEL[engBand],
      managerName: "Sample Manager",
      completedAt: completedAtIso,
      items: HIPO_ENGAGEMENT_ITEMS.map((i) => ({
        label: i.en,
        labelAr: i.ar,
        reverse: !!i.reverse,
        answer: engAnswers[i.key],
        scored: i.reverse ? 6 - engAnswers[i.key] : engAnswers[i.key],
      })),
      overlay: engagementOverlay(cell, engBand),
    },
  };
}
