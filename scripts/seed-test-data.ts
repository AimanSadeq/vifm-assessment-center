/**
 * Seed script: creates a full end-to-end test engagement.
 * Run: npx tsx scripts/seed-test-data.ts
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
  console.log("🌱 Seeding test data...\n");

  // 1. Get existing org
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id")
    .limit(1);
  const orgId = orgs?.[0]?.id;
  if (!orgId) throw new Error("No organization found. Run the wizard first.");
  console.log("✅ Org:", orgId);

  // 2. Create engagement
  const { data: eng, error: engErr } = await supabase
    .from("engagements")
    .insert({
      organization_id: orgId,
      name: "ADNOC Senior Manager AC - April 2026",
      target_role: "Senior Manager",
      status: "active",
      start_date: "2026-04-14",
      end_date: "2026-04-16",
    })
    .select()
    .single();
  if (engErr) throw engErr;
  console.log("✅ Engagement:", eng.id, eng.name);

  // 3. Create 3 exercises
  const exerciseData = [
    { name: "Strategic In-Basket", exercise_type: "in_basket", duration_minutes: 75, description: "Digital inbox simulation with 20 items requiring prioritization and delegation decisions." },
    { name: "Leadership Role Play", exercise_type: "role_play", duration_minutes: 30, description: "One-on-one meeting with a direct report facing performance issues." },
    { name: "Business Case Presentation", exercise_type: "oral_presentation", duration_minutes: 20, description: "Present findings and recommendations from a market expansion case study." },
  ];
  const { data: exercises, error: exErr } = await supabase
    .from("exercises")
    .insert(exerciseData)
    .select();
  if (exErr) throw exErr;
  console.log("✅ Exercises:", exercises.map((e) => e.name).join(", "));

  // 4. Get 6 competencies (typical for a Senior Manager AC)
  const competencyIds = [
    "a0000001-0000-0000-0000-000000000001", // Strategic Mindset
    "a0000001-0000-0000-0000-000000000005", // Decision Quality
    "a0000001-0000-0000-0000-000000000011", // Drives Results
    "a0000001-0000-0000-0000-000000000019", // Communicates Effectively
    "a0000001-0000-0000-0000-000000000024", // Develops Talent
    "a0000001-0000-0000-0000-000000000017", // Being Resilient
  ];

  // 5. Link competencies to engagement
  const { error: ecErr } = await supabase
    .from("engagement_competencies")
    .insert(
      competencyIds.map((cid, i) => ({
        engagement_id: eng.id,
        competency_id: cid,
        weight: [2.0, 1.5, 2.0, 1.5, 1.5, 1.0][i],
      }))
    );
  if (ecErr) throw ecErr;
  console.log("✅ Engagement competencies: 6 linked");

  // 6. Link exercises to engagement
  const { error: eeErr } = await supabase
    .from("engagement_exercises")
    .insert(
      exercises.map((ex) => ({
        engagement_id: eng.id,
        exercise_id: ex.id,
      }))
    );
  if (eeErr) throw eeErr;
  console.log("✅ Engagement exercises: 3 linked");

  // 7. Build exercise-competency matrix (each competency in at least 2 exercises)
  const matrixMappings = [
    // In-Basket: Strategic Mindset, Decision Quality, Drives Results, Communicates Effectively
    ...["a0000001-0000-0000-0000-000000000001", "a0000001-0000-0000-0000-000000000005", "a0000001-0000-0000-0000-000000000011", "a0000001-0000-0000-0000-000000000019"].map((cid) => ({
      engagement_id: eng.id,
      exercise_id: exercises[0].id,
      competency_id: cid,
    })),
    // Role Play: Communicates Effectively, Develops Talent, Being Resilient, Drives Results
    ...["a0000001-0000-0000-0000-000000000019", "a0000001-0000-0000-0000-000000000024", "a0000001-0000-0000-0000-000000000017", "a0000001-0000-0000-0000-000000000011"].map((cid) => ({
      engagement_id: eng.id,
      exercise_id: exercises[1].id,
      competency_id: cid,
    })),
    // Presentation: Strategic Mindset, Decision Quality, Communicates Effectively, Develops Talent, Being Resilient
    ...["a0000001-0000-0000-0000-000000000001", "a0000001-0000-0000-0000-000000000005", "a0000001-0000-0000-0000-000000000019", "a0000001-0000-0000-0000-000000000024", "a0000001-0000-0000-0000-000000000017"].map((cid) => ({
      engagement_id: eng.id,
      exercise_id: exercises[2].id,
      competency_id: cid,
    })),
  ];
  const { error: matErr } = await supabase
    .from("exercise_competency_matrix")
    .insert(matrixMappings);
  if (matErr) throw matErr;
  console.log("✅ Matrix: 13 mappings (each competency in 2-3 exercises)");

  // 8. Create 3 candidates
  const candidateData = [
    { engagement_id: eng.id, full_name: "Ahmed Al Mansoori", email: "ahmed.mansoori@adnoc.ae", status: "in_progress" },
    { engagement_id: eng.id, full_name: "Fatima Al Hashimi", email: "fatima.hashimi@adnoc.ae", status: "in_progress" },
    { engagement_id: eng.id, full_name: "Khalid Al Nuaimi", email: "khalid.nuaimi@adnoc.ae", status: "in_progress" },
  ];
  const { data: candidates, error: candErr } = await supabase
    .from("candidates")
    .insert(candidateData)
    .select();
  if (candErr) throw candErr;
  console.log("✅ Candidates:", candidates.map((c) => c.full_name).join(", "));

  // 9. Create assessor via auth.admin
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: "dr.sarah@vifm.ae",
    email_confirm: true,
    user_metadata: { full_name: "Dr. Sarah Al Ameri" },
  });
  if (authErr) {
    // May already exist
    console.log("⚠️  Assessor auth:", authErr.message);
  }

  let assessorId: string;
  if (authUser?.user) {
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .insert({
        id: authUser.user.id,
        role: "lead_assessor",
        full_name: "Dr. Sarah Al Ameri",
        email: "dr.sarah@vifm.ae",
      })
      .select()
      .single();
    if (profErr) throw profErr;
    assessorId = profile.id;
  } else {
    // Already exists, look up
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", "dr.sarah@vifm.ae")
      .single();
    assessorId = existing?.id ?? "";
  }
  console.log("✅ Assessor:", assessorId, "Dr. Sarah Al Ameri");

  // 10. Create assessor assignments (assessor → each candidate × each exercise)
  const assignments: { engagement_id: string; assessor_id: string; candidate_id: string; exercise_id: string }[] = [];
  for (const cand of candidates) {
    for (const ex of exercises) {
      assignments.push({
        engagement_id: eng.id,
        assessor_id: assessorId,
        candidate_id: cand.id,
        exercise_id: ex.id,
      });
    }
  }
  const { data: assignData, error: assignErr } = await supabase
    .from("assessor_assignments")
    .insert(assignments)
    .select();
  if (assignErr) throw assignErr;
  console.log("✅ Assignments: 9 (3 candidates × 3 exercises)");

  // 11. Create observations for Ahmed (candidate 0) across exercises
  const ahmedAssignments = assignData.filter(
    (a) => a.candidate_id === candidates[0].id
  );

  const observationData = [
    // In-Basket observations
    { assessor_assignment_id: ahmedAssignments[0].id, competency_id: competencyIds[0], behavior_observed: "Identified the strategic implications of the merger proposal before addressing operational items. Prioritized long-term impact over short-term urgency.", is_positive: true },
    { assessor_assignment_id: ahmedAssignments[0].id, competency_id: competencyIds[0], behavior_observed: "Missed connection between the IT budget request and the digital transformation initiative mentioned in item 3.", is_positive: false },
    { assessor_assignment_id: ahmedAssignments[0].id, competency_id: competencyIds[1], behavior_observed: "Made clear, well-reasoned decisions on 15 of 20 items with appropriate delegation. Provided rationale for each prioritization choice.", is_positive: true },
    { assessor_assignment_id: ahmedAssignments[0].id, competency_id: competencyIds[2], behavior_observed: "Set specific deadlines and accountability measures for delegated items. Followed up on critical path dependencies.", is_positive: true },
    { assessor_assignment_id: ahmedAssignments[0].id, competency_id: competencyIds[3], behavior_observed: "Written communications were clear and tailored to different stakeholders (board vs. team vs. client).", is_positive: true },
    // Role Play observations
    { assessor_assignment_id: ahmedAssignments[1].id, competency_id: competencyIds[3], behavior_observed: "Opened with empathy and active listening. Asked open-ended questions to understand the employee's perspective before jumping to solutions.", is_positive: true },
    { assessor_assignment_id: ahmedAssignments[1].id, competency_id: competencyIds[4], behavior_observed: "Offered a structured development plan with milestones. Balanced accountability with support.", is_positive: true },
    { assessor_assignment_id: ahmedAssignments[1].id, competency_id: competencyIds[4], behavior_observed: "Did not explore root causes of performance decline deeply enough. Moved to solutions too quickly.", is_positive: false },
    { assessor_assignment_id: ahmedAssignments[1].id, competency_id: competencyIds[5], behavior_observed: "Remained calm and composed when the role player became defensive. Redirected conversation constructively.", is_positive: true },
    // Presentation observations
    { assessor_assignment_id: ahmedAssignments[2].id, competency_id: competencyIds[0], behavior_observed: "Presented a clear 3-year strategic roadmap for market expansion. Connected market analysis to organizational capabilities effectively.", is_positive: true },
    { assessor_assignment_id: ahmedAssignments[2].id, competency_id: competencyIds[1], behavior_observed: "Recommendation was data-driven but considered only one scenario. Did not present risk mitigation alternatives.", is_positive: false },
    { assessor_assignment_id: ahmedAssignments[2].id, competency_id: competencyIds[3], behavior_observed: "Engaging presentation style with good eye contact. Handled Q&A confidently. Used visual aids effectively.", is_positive: true },
  ];
  const { error: obsErr } = await supabase.from("observations").insert(observationData);
  if (obsErr) throw obsErr;
  console.log("✅ Observations: 12 for Ahmed across 3 exercises");

  // 12. Create ratings for Ahmed
  const ratingData = [
    // In-Basket ratings
    { assessor_assignment_id: ahmedAssignments[0].id, competency_id: competencyIds[0], score: 4, justification: "Strong strategic thinking demonstrated through prioritization. Minor gap in connecting cross-functional items." },
    { assessor_assignment_id: ahmedAssignments[0].id, competency_id: competencyIds[1], score: 4, justification: "Clear, well-reasoned decisions on majority of items. Good use of delegation." },
    { assessor_assignment_id: ahmedAssignments[0].id, competency_id: competencyIds[2], score: 4, justification: "Strong accountability mechanisms set. Proactive follow-up patterns." },
    { assessor_assignment_id: ahmedAssignments[0].id, competency_id: competencyIds[3], score: 4, justification: "Excellent stakeholder-tailored communications." },
    // Role Play ratings
    { assessor_assignment_id: ahmedAssignments[1].id, competency_id: competencyIds[3], score: 4, justification: "Strong interpersonal communication. Good empathy and active listening." },
    { assessor_assignment_id: ahmedAssignments[1].id, competency_id: competencyIds[4], score: 3, justification: "Good development plan but missed root cause exploration. Competent but room for growth." },
    { assessor_assignment_id: ahmedAssignments[1].id, competency_id: competencyIds[5], score: 4, justification: "Excellent composure under pressure. Constructive redirection." },
    // Presentation ratings
    { assessor_assignment_id: ahmedAssignments[2].id, competency_id: competencyIds[0], score: 4, justification: "Clear strategic vision with good capability alignment." },
    { assessor_assignment_id: ahmedAssignments[2].id, competency_id: competencyIds[1], score: 3, justification: "Data-driven but single-scenario approach. Needs to consider alternatives." },
    { assessor_assignment_id: ahmedAssignments[2].id, competency_id: competencyIds[3], score: 5, justification: "Outstanding presentation delivery. Confident Q&A handling." },
  ];
  const { error: ratErr } = await supabase.from("ratings").insert(ratingData);
  if (ratErr) throw ratErr;
  console.log("✅ Ratings: 10 BARS ratings for Ahmed");

  // 13. Create integration worksheet for Ahmed
  const worksheetData = competencyIds.map((cid, i) => ({
    engagement_id: eng.id,
    assessor_id: assessorId,
    candidate_id: candidates[0].id,
    competency_id: cid,
    preliminary_rating: [4, 3, 4, 4, 3, 4][i],
    notes: [
      "Consistently demonstrated strategic thinking across all exercises. Minor gap in cross-functional integration.",
      "Good decision-making overall. Needs to consider multiple scenarios and risk mitigation more explicitly.",
      "Strong results orientation with clear accountability measures. Consistent across exercises.",
      "Excellent communicator across all formats — written, verbal, interpersonal. Strongest competency.",
      "Good foundational talent development skills but needs to probe deeper into root causes.",
      "Demonstrated strong resilience and composure throughout. Handles pressure well.",
    ][i],
  }));
  const { error: wsErr } = await supabase.from("integration_worksheets").insert(worksheetData);
  if (wsErr) throw wsErr;
  console.log("✅ Integration worksheets: 6 preliminary ratings for Ahmed");

  console.log("\n🎉 Seed complete! Test the portal at http://localhost:3000");
  console.log("   Admin: /admin/engagements");
  console.log("   Assessor: /assessor");
  console.log("   Wash-Up: /assessor/washup");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
