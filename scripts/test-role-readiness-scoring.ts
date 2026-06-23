/**
 * Worked runs for the Role Readiness scoring engine (CONDITION 4 + edge cases).
 *   npx tsx scripts/test-role-readiness-scoring.ts
 */
import { computeReadiness } from "../src/lib/role-readiness/scoring";

const comp = (id: string, target: number, self: number | null) => ({
  competency_id: id, name: id, target_level: target, self_score: self,
});
const area = (id: string, target: number, correct: number, total: number) => ({
  area_id: id, name: id, target_pct: target, correct, total,
});

// Persona: pass (mean attainment ~91.7) vs fail (mean 50).
const personaPass = [comp("c1", 4, 4), comp("c2", 4, 4), comp("c3", 4, 3)];
const personaFail = [comp("c1", 4, 2), comp("c2", 4, 2), comp("c3", 4, 2)];
// Technical: pass (75% overall) vs fail (35% overall).
const techPass = [area("a1", 60, 8, 10), area("a2", 60, 7, 10)];
const techFail = [area("a1", 60, 3, 10), area("a2", 60, 4, 10)];

let failures = 0;
function check(label: string, got: string, want: string) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(46)} verdict=${got} (want ${want})`);
}

console.log("=== Role Readiness worked runs ===");
const both = computeReadiness({ competencies: personaPass, personaThresholdPct: 60, areas: techPass, technicalThresholdPct: 60 });
console.log(`  both pass: persona=${both.persona.score_pct} technical=${both.technical.score_pct}`);
check("both sides pass", both.verdict, "ready");

const pPassTFail = computeReadiness({ competencies: personaPass, personaThresholdPct: 60, areas: techFail, technicalThresholdPct: 60 });
console.log(`  persona pass / technical fail: persona=${pPassTFail.persona.score_pct} technical=${pPassTFail.technical.score_pct}`);
check("persona PASS + technical FAIL", pPassTFail.verdict, "not_ready");

const pFailTPass = computeReadiness({ competencies: personaFail, personaThresholdPct: 60, areas: techPass, technicalThresholdPct: 60 });
console.log(`  persona fail / technical pass: persona=${pFailTPass.persona.score_pct} technical=${pFailTPass.technical.score_pct}`);
check("persona FAIL + technical PASS", pFailTPass.verdict, "not_ready");

// Exact-threshold inclusivity: persona mean 50 with threshold 50; technical 35% with threshold 35.
const exact = computeReadiness({ competencies: personaFail, personaThresholdPct: 50, areas: techFail, technicalThresholdPct: 35 });
console.log(`  exact threshold: persona=${exact.persona.score_pct} (>=50?) technical=${exact.technical.score_pct} (>=35?)`);
check("score exactly on threshold passes (>=)", exact.verdict, "ready");

// No technical items at all -> technical incomplete -> overall incomplete (no false pass).
const noItems = computeReadiness({ competencies: personaPass, personaThresholdPct: 60, areas: [area("a1", 60, 0, 0)], technicalThresholdPct: 60 });
console.log(`  no technical items: technical.passed=${noItems.technical.passed} (null expected)`);
check("no scorable technical units => incomplete", noItems.verdict, "incomplete");

// Dev plan: below-target items surface.
console.log(`  dev plan (persona pass run): belowComps=${both.belowTargetCompetencies.map((c) => c.name).join(",") || "none"} belowAreas=${both.belowTargetAreas.map((a) => a.name).join(",") || "none"}`);

console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures === 0 ? 0 : 1);
