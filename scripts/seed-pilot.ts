/**
 * PHASE E: Complete Pilot Assessment Center
 * Seeds a full end-to-end pilot with all data through to OAR.
 *
 * Run: npx tsx scripts/seed-pilot.ts
 *
 * Creates:
 * - 1 organization (ADNOC Group)
 * - 1 engagement (Senior Manager AC)
 * - 3 exercises with briefing content
 * - 6 competencies with weights
 * - 13 exercise-competency matrix mappings
 * - 3 candidates
 * - 1 assessor (uses admin account)
 * - 9 assessor assignments (3 candidates × 3 exercises)
 * - 36 observations (12 per candidate)
 * - 30 ratings (10 per candidate)
 * - 18 integration worksheets (6 per candidate)
 * - 18 consensus ratings (6 per candidate)
 * - 3 OARs with recommendations
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seed() {
  console.log("🚀 PHASE E: Seeding Complete Pilot Assessment Center\n");

  // ═══════════════════════════════════════════════════════
  // STEP 1: Organization
  // ═══════════════════════════════════════════════════════
  // Check if org already exists
  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("*")
    .eq("name", "ADNOC Group")
    .maybeSingle();

  let org = existingOrg;
  if (!org) {
    const { data: newOrg, error: orgErr } = await supabase
      .from("organizations")
      .insert({
        name: "ADNOC Group",
        industry: "Oil & Gas",
        country: "UAE",
        contact_name: "Mohammed Al Jaber",
        contact_email: "m.aljaber@adnoc.ae",
      })
      .select()
      .single();
    if (orgErr) throw new Error(`Org: ${orgErr.message}`);
    org = newOrg;
  }
  console.log("✅ Step 1: Organization —", org.name);

  // ═══════════════════════════════════════════════════════
  // STEP 2: Engagement
  // ═══════════════════════════════════════════════════════
  const { data: eng, error: engErr } = await supabase
    .from("engagements")
    .insert({
      organization_id: org.id,
      name: "ADNOC Senior Manager AC - April 2026",
      target_role: "Senior Manager",
      status: "active",
      start_date: "2026-04-14",
      end_date: "2026-04-16",
      created_by: null,
    })
    .select()
    .single();
  if (engErr) throw new Error(`Engagement: ${engErr.message}`);
  console.log("✅ Step 2: Engagement —", eng.name);

  // ═══════════════════════════════════════════════════════
  // STEP 3: Exercises with briefing content
  // ═══════════════════════════════════════════════════════
  const exerciseDefs = [
    {
      name: "Strategic In-Basket",
      exercise_type: "in_basket",
      duration_minutes: 75,
      description: "Digital inbox simulation with 20 items requiring prioritization and delegation decisions across multiple business areas.",
      instructions: "You will have 75 minutes to review and respond to 20 email items in a digital inbox. Each item requires a decision: respond, delegate, defer, or escalate. You must prioritize based on urgency and strategic importance.",
      prep_minutes: 10,
      instructions_minutes: 5,
      meeting_minutes: 60,
      participant_brief: "You have just been appointed as the new Division Head at a major energy company. Your predecessor left suddenly, and you must address 20 pending items in your inbox on your first day. Some items are urgent, others strategic. You have a team of 5 direct reports you can delegate to.",
      scenario_context: "The company is undergoing a digital transformation while managing a major merger. Several items relate to cross-functional dependencies that test the candidate's ability to see the big picture.",
      assessor_notes: "Focus on: (1) Prioritization logic — does the candidate distinguish urgent from important? (2) Delegation quality — are tasks assigned to appropriate team members with clear instructions? (3) Strategic connections — does the candidate identify links between items?",
    },
    {
      name: "Leadership Role Play",
      exercise_type: "role_play",
      duration_minutes: 30,
      description: "One-on-one meeting with a direct report facing performance and personal challenges.",
      instructions: "You will meet with Nadia Hassan, a Senior Analyst who has been underperforming for the past 3 months. You have 30 minutes to understand the situation and agree on a path forward.",
      prep_minutes: 10,
      instructions_minutes: 5,
      meeting_minutes: 15,
      participant_brief: "Nadia Hassan has been one of your strongest team members for 3 years. Recently her performance has dropped significantly — missing deadlines, making errors, and being absent from team meetings. You need to have a constructive conversation to understand what is happening and agree on next steps.",
      scenario_context: "Nadia is dealing with a family illness but has not disclosed this. She is also frustrated because she was passed over for promotion last quarter. The role player will start defensive but respond well to genuine empathy and support.",
      assessor_notes: "Watch for: (1) Empathy and active listening before problem-solving, (2) Balance of support and accountability, (3) Quality of the development plan, (4) How the candidate handles the emotional reveal about family illness.",
    },
    {
      name: "Business Case Presentation",
      exercise_type: "oral_presentation",
      duration_minutes: 20,
      description: "Analyze a market expansion case and present strategic recommendations to the board.",
      instructions: "You will have 30 minutes to prepare a 10-minute presentation followed by 10 minutes of Q&A. Present your analysis and recommendations for entering a new market.",
      prep_minutes: 30,
      instructions_minutes: 5,
      meeting_minutes: 20,
      participant_brief: "Your company is considering entering the Southeast Asian renewable energy market. You have been given market data, competitor analysis, financial projections, and risk assessments. Prepare a recommendation for the Executive Committee on whether to proceed, including your proposed approach, timeline, and resource requirements.",
      scenario_context: "The case has deliberately conflicting data points. Strong candidates will acknowledge uncertainty and present multiple scenarios. The Q&A panel will probe on risk mitigation and implementation feasibility.",
      assessor_notes: "Evaluate: (1) Analytical rigor — does the candidate use data effectively? (2) Strategic clarity — is the recommendation clear and well-structured? (3) Presentation delivery — confidence, eye contact, visual aids, (4) Q&A handling — composure under challenge.",
    },
  ];

  const { data: exercises, error: exErr } = await supabase
    .from("exercises")
    .insert(exerciseDefs)
    .select();
  if (exErr) throw new Error(`Exercises: ${exErr.message}`);
  console.log("✅ Step 3: Exercises —", exercises.map((e) => e.name).join(", "));

  // ═══════════════════════════════════════════════════════
  // STEP 4: Competencies + Matrix
  // ═══════════════════════════════════════════════════════
  const competencyIds = [
    "a0000001-0000-0000-0000-000000000001", // Strategic Mindset
    "a0000001-0000-0000-0000-000000000005", // Decision Quality
    "a0000001-0000-0000-0000-000000000011", // Drives Results
    "a0000001-0000-0000-0000-000000000019", // Communicates Effectively
    "a0000001-0000-0000-0000-000000000024", // Develops Talent
    "a0000001-0000-0000-0000-000000000017", // Being Resilient
  ];
  const compNames = ["Strategic Mindset", "Decision Quality", "Drives Results", "Communicates Effectively", "Develops Talent", "Being Resilient"];
  const compWeights = [2.0, 1.5, 2.0, 1.5, 1.5, 1.0];

  await supabase.from("engagement_competencies").insert(
    competencyIds.map((cid, i) => ({ engagement_id: eng.id, competency_id: cid, weight: compWeights[i] }))
  );

  await supabase.from("engagement_exercises").insert(
    exercises.map((ex) => ({ engagement_id: eng.id, exercise_id: ex.id }))
  );

  // Matrix: each competency in 2-3 exercises
  const matrix = [
    // In-Basket: Strategic, Decision, Results, Communication
    ...competencyIds.slice(0, 4).map((cid) => ({ engagement_id: eng.id, exercise_id: exercises[0].id, competency_id: cid })),
    // Role Play: Communication, Develops Talent, Resilience, Results
    ...[competencyIds[3], competencyIds[4], competencyIds[5], competencyIds[2]].map((cid) => ({ engagement_id: eng.id, exercise_id: exercises[1].id, competency_id: cid })),
    // Presentation: Strategic, Decision, Communication, Develops Talent, Resilience
    ...[competencyIds[0], competencyIds[1], competencyIds[3], competencyIds[4], competencyIds[5]].map((cid) => ({ engagement_id: eng.id, exercise_id: exercises[2].id, competency_id: cid })),
  ];
  await supabase.from("exercise_competency_matrix").insert(matrix);
  console.log("✅ Step 4: 6 competencies linked, 13 matrix mappings");

  // ═══════════════════════════════════════════════════════
  // STEP 5: Candidates
  // ═══════════════════════════════════════════════════════
  const { data: candidates, error: candErr } = await supabase
    .from("candidates")
    .insert([
      { engagement_id: eng.id, full_name: "Ahmed Al Mansoori", email: "ahmed.mansoori@adnoc.ae", status: "in_progress" },
      { engagement_id: eng.id, full_name: "Fatima Al Hashimi", email: "fatima.hashimi@adnoc.ae", status: "in_progress" },
      { engagement_id: eng.id, full_name: "Khalid Al Nuaimi", email: "khalid.nuaimi@adnoc.ae", status: "in_progress" },
    ])
    .select();
  if (candErr) throw new Error(`Candidates: ${candErr.message}`);
  console.log("✅ Step 5: Candidates —", candidates.map((c) => c.full_name).join(", "));

  // ═══════════════════════════════════════════════════════
  // STEP 6: Assessor (use admin account)
  // ═══════════════════════════════════════════════════════
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", "admin@viftraining.com")
    .single();

  if (!adminProfile) throw new Error("Admin profile not found. Run create-admin.ts first.");
  const assessorId = adminProfile.id;
  console.log("✅ Step 6: Using admin as assessor —", assessorId);

  // ═══════════════════════════════════════════════════════
  // STEP 7: Assessor Assignments (3 candidates × 3 exercises = 9)
  // ═══════════════════════════════════════════════════════
  const assignmentRows: { engagement_id: string; assessor_id: string; candidate_id: string; exercise_id: string }[] = [];
  for (const cand of candidates) {
    for (const ex of exercises) {
      assignmentRows.push({ engagement_id: eng.id, assessor_id: assessorId, candidate_id: cand.id, exercise_id: ex.id });
    }
  }
  const { data: assignments, error: assignErr } = await supabase
    .from("assessor_assignments")
    .insert(assignmentRows)
    .select();
  if (assignErr) throw new Error(`Assignments: ${assignErr.message}`);
  console.log("✅ Step 7: 9 assessor assignments created");

  // ═══════════════════════════════════════════════════════
  // STEP 8-9-10: Observations + Ratings + Integration for ALL 3 candidates
  // ═══════════════════════════════════════════════════════

  // Candidate profiles for observations
  const candidateProfiles = [
    { // Ahmed — Strong performer (avg ~4.0)
      name: "Ahmed", scores: [4, 4, 4, 5, 3, 4],
      observations: [
        ["Identified strategic implications of merger before operational items", "Missed cross-functional link between IT budget and digital transformation"],
        ["Made clear decisions on 15/20 items with appropriate delegation", "Did not present risk mitigation alternatives in presentation"],
        ["Set specific deadlines and accountability measures", "Consistent follow-up on critical path dependencies"],
        ["Clear stakeholder-tailored communications", "Engaging presentation with confident Q&A handling"],
        ["Offered structured development plan with milestones", "Moved to solutions too quickly without exploring root causes"],
        ["Remained calm when role player became defensive", "Constructive redirection of difficult conversation"],
      ],
    },
    { // Fatima — Exceptional performer (avg ~4.5)
      name: "Fatima", scores: [5, 4, 4, 5, 5, 4],
      observations: [
        ["Exceptional strategic vision connecting all inbox items to long-term goals", "Identified emerging market opportunity others missed"],
        ["Balanced data analysis with intuitive judgment", "Considered multiple scenarios including worst case"],
        ["Drove clear action plans with measurable KPIs", "Held team accountable through supportive framework"],
        ["Outstanding communicator across all formats", "Tailored message precisely to each audience"],
        ["Deep coaching approach that uncovered root causes", "Created individualized development plan with clear milestones"],
        ["Handled emotional situation with genuine empathy", "Maintained focus while being compassionate"],
      ],
    },
    { // Khalid — Developing performer (avg ~3.0)
      name: "Khalid", scores: [3, 2, 3, 3, 2, 3],
      observations: [
        ["Showed awareness of strategic context but struggled with prioritization", "Focused on operational items over strategic ones"],
        ["Decisions were delayed; sought excessive information before acting", "Recommendation lacked clear rationale and alternatives"],
        ["Completed tasks but without clear accountability mechanisms", "Did not set follow-up checkpoints for delegated items"],
        ["Communication was adequate but lacked audience tailoring", "Presentation was data-heavy without clear narrative"],
        ["Gave generic feedback without addressing specific behaviors", "Did not create actionable development plan"],
        ["Maintained composure but appeared uncomfortable with emotion", "Avoided difficult conversation about family illness"],
      ],
    },
  ];

  for (let ci = 0; ci < candidates.length; ci++) {
    const cand = candidates[ci];
    const profile = candidateProfiles[ci];
    const candAssignments = assignments.filter((a) => a.candidate_id === cand.id);

    // Observations (2 per competency per relevant exercise)
    const obsRows: { assessor_assignment_id: string; competency_id: string; behavior_observed: string; is_positive: boolean }[] = [];

    // In-Basket (exercises[0]): competencies 0-3
    for (let k = 0; k < 4; k++) {
      obsRows.push({
        assessor_assignment_id: candAssignments[0].id,
        competency_id: competencyIds[k],
        behavior_observed: profile.observations[k][0],
        is_positive: true,
      });
      obsRows.push({
        assessor_assignment_id: candAssignments[0].id,
        competency_id: competencyIds[k],
        behavior_observed: profile.observations[k][1],
        is_positive: profile.scores[k] >= 4,
      });
    }

    // Role Play (exercises[1]): competencies 3,4,5,2
    const rpComps = [3, 4, 5, 2];
    for (const k of rpComps) {
      obsRows.push({
        assessor_assignment_id: candAssignments[1].id,
        competency_id: competencyIds[k],
        behavior_observed: profile.observations[k][0],
        is_positive: true,
      });
    }

    // Presentation (exercises[2]): competencies 0,1,3,4,5
    const presComps = [0, 1, 3, 4, 5];
    for (const k of presComps) {
      obsRows.push({
        assessor_assignment_id: candAssignments[2].id,
        competency_id: competencyIds[k],
        behavior_observed: profile.observations[k][profile.scores[k] >= 4 ? 0 : 1],
        is_positive: profile.scores[k] >= 4,
      });
    }

    await supabase.from("observations").insert(obsRows);

    // Ratings
    const ratingRows: { assessor_assignment_id: string; competency_id: string; score: number; justification: string }[] = [];
    // In-Basket ratings (competencies 0-3)
    for (let k = 0; k < 4; k++) {
      ratingRows.push({
        assessor_assignment_id: candAssignments[0].id,
        competency_id: competencyIds[k],
        score: profile.scores[k],
        justification: `${compNames[k]}: ${profile.scores[k] >= 4 ? "Strong" : profile.scores[k] >= 3 ? "Competent" : "Developing"} performance in In-Basket exercise.`,
      });
    }
    // Role Play ratings (competencies 2,3,4,5)
    for (const k of [2, 3, 4, 5]) {
      ratingRows.push({
        assessor_assignment_id: candAssignments[1].id,
        competency_id: competencyIds[k],
        score: profile.scores[k],
        justification: `${compNames[k]}: ${profile.scores[k] >= 4 ? "Strong" : profile.scores[k] >= 3 ? "Competent" : "Developing"} performance in Role Play.`,
      });
    }
    // Presentation ratings (competencies 0,1,3,4,5)
    for (const k of [0, 1, 3, 4, 5]) {
      ratingRows.push({
        assessor_assignment_id: candAssignments[2].id,
        competency_id: competencyIds[k],
        score: profile.scores[k],
        justification: `${compNames[k]}: ${profile.scores[k] >= 4 ? "Strong" : profile.scores[k] >= 3 ? "Competent" : "Developing"} in Presentation.`,
      });
    }
    await supabase.from("ratings").insert(ratingRows);

    // Integration worksheets
    const wsRows = competencyIds.map((cid, i) => ({
      engagement_id: eng.id,
      assessor_id: assessorId,
      candidate_id: cand.id,
      competency_id: cid,
      preliminary_rating: profile.scores[i],
      notes: `${profile.name}: ${profile.scores[i] >= 4 ? "Demonstrates strength" : profile.scores[i] >= 3 ? "Competent with room for growth" : "Needs focused development"} in ${compNames[i]}.`,
    }));
    await supabase.from("integration_worksheets").insert(wsRows);

    console.log(`✅ Steps 8-10: ${profile.name} — ${obsRows.length} observations, ${ratingRows.length} ratings, 6 worksheets`);
  }

  // ═══════════════════════════════════════════════════════
  // STEP 11: Consensus Ratings (wash-up outcomes)
  // ═══════════════════════════════════════════════════════
  for (let ci = 0; ci < candidates.length; ci++) {
    const cand = candidates[ci];
    const profile = candidateProfiles[ci];

    const consensusRows = competencyIds.map((cid, i) => ({
      engagement_id: eng.id,
      candidate_id: cand.id,
      competency_id: cid,
      final_score: profile.scores[i],
      discussion_notes: `Consensus reached: ${compNames[i]} rated ${profile.scores[i]}/5 for ${profile.name}.`,
      decided_at: new Date().toISOString(),
    }));
    await supabase.from("consensus_ratings").insert(consensusRows);
  }
  console.log("✅ Step 11: 18 consensus ratings (6 per candidate)");

  // ═══════════════════════════════════════════════════════
  // STEP 12: Overall Assessment Ratings (OAR)
  // ═══════════════════════════════════════════════════════
  const oarData = [
    {
      engagement_id: eng.id,
      candidate_id: candidates[0].id,
      overall_score: 4,
      recommendation: "ready_now",
      summary: "Ahmed demonstrates strong leadership capabilities across all competency areas. His strategic thinking, communication skills, and results orientation are notable strengths. Minor development needed in talent development — specifically in root cause exploration before jumping to solutions. Recommended for Senior Manager role with coaching support in people development.",
    },
    {
      engagement_id: eng.id,
      candidate_id: candidates[1].id,
      overall_score: 5,
      recommendation: "ready_now",
      summary: "Fatima is an exceptional candidate who consistently demonstrated outstanding competence across all exercises. Her strategic vision, communication excellence, and deep coaching abilities set her apart. She handles pressure with genuine composure and empathy. Strongly recommended for Senior Manager role — she is ready to perform at this level immediately.",
    },
    {
      engagement_id: eng.id,
      candidate_id: candidates[2].id,
      overall_score: 3,
      recommendation: "ready_with_development",
      summary: "Khalid shows foundational competence in most areas but needs targeted development in decision quality and talent development before assuming a Senior Manager role. He is operationally capable but struggles with strategic prioritization and difficult interpersonal conversations. Recommended for a 12-month development program focused on strategic thinking and people leadership.",
    },
  ];
  await supabase.from("overall_assessment_ratings").insert(oarData);
  console.log("✅ Step 12: 3 OARs — Ready Now (Ahmed, Fatima), Ready with Development (Khalid)");

  // ═══════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════
  console.log("\n════════════════════════════════════════════");
  console.log("🎉 PILOT ASSESSMENT CENTER — COMPLETE!");
  console.log("════════════════════════════════════════════");
  console.log(`  Organization: ${org.name}`);
  console.log(`  Engagement:   ${eng.name}`);
  console.log(`  Exercises:    ${exercises.length}`);
  console.log(`  Candidates:   ${candidates.length}`);
  console.log(`  Competencies: 6`);
  console.log(`  Observations: 36+`);
  console.log(`  Ratings:      30+`);
  console.log(`  Worksheets:   18`);
  console.log(`  Consensus:    18`);
  console.log(`  OARs:         3`);
  console.log("");
  console.log("📋 Now walk through the portal:");
  console.log("  1. Admin → /admin — verify dashboard shows all data");
  console.log("  2. Admin → /admin/engagements — click the engagement");
  console.log(`  3. PDF Report → /api/reports/${eng.id}/${candidates[0].id}`);
  console.log(`  4. PDF Report → /api/reports/${eng.id}/${candidates[1].id}`);
  console.log(`  5. PDF Report → /api/reports/${eng.id}/${candidates[2].id}`);
  console.log("");
}

seed().catch((err) => {
  console.error("❌ Pilot seed failed:", err);
  process.exit(1);
});
