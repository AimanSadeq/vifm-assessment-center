// Demo-data seeder (service-role). Each service is an isolated seeder that
// returns a DemoSeedOutcome; seedDemoData runs them all, tolerating a per-service
// failure so one bad seed never aborts the rest. Everything ties to the demo org
// or a sentinel so purgeDemoData (see ./purge) can remove it cleanly. Idempotent:
// re-running reuses the demo org and skips services that already have demo rows.

import { createServiceClient } from "@/lib/supabase/server";
import { createClientOrganization } from "@/lib/clients/registry";
import {
  DEMO_ORG_NAME,
  DEMO_ORG_NAME_AR,
  DEMO_INDUSTRY,
  DEMO_COUNTRY,
  DEMO_EMAIL_DOMAIN,
  DEMO_TAG,
  type DemoSeedOutcome,
} from "./constants";

type Sb = ReturnType<typeof createServiceClient>;

export type DemoOrgIds = { organizationId: string; araOrganizationId: string };

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** Create or reuse the demo organisation in both org stores. */
export async function ensureDemoOrg(): Promise<DemoOrgIds> {
  const res = await createClientOrganization({
    name: DEMO_ORG_NAME,
    nameAr: DEMO_ORG_NAME_AR,
    industry: DEMO_INDUSTRY,
    country: DEMO_COUNTRY,
  });
  if (!res.ok) throw new Error(res.error);
  return { organizationId: res.organizationId, araOrganizationId: res.araOrganizationId };
}

/** Reuse an existing assessor profile if one exists, else create a demo one
 *  (auth user + profile, sentinel email so purge can find it). */
async function ensureDemoAssessor(sb: Sb): Promise<string> {
  const existing = await sb
    .from("profiles")
    .select("id")
    .in("role", ["lead_assessor", "associate_assessor"])
    .limit(1)
    .maybeSingle();
  if (existing.data?.id) return existing.data.id as string;

  const email = `assessor@${DEMO_EMAIL_DOMAIN}`;
  const created = await sb.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: "Dr. Sara Al Otaibi" },
  });
  let id = created.data?.user?.id;
  if (!id) {
    const found = await sb.from("profiles").select("id").eq("email", email).maybeSingle();
    id = found.data?.id as string | undefined;
  }
  if (!id) throw new Error("Could not provision the demo assessor.");
  await sb.from("profiles").upsert({ id, role: "lead_assessor", full_name: "Dr. Sara Al Otaibi", email });
  return id;
}

// ───────────────────────────── Assessment Center ─────────────────────────────
const AC_COMPETENCIES = [
  "a0000001-0000-0000-0000-000000000001",
  "a0000001-0000-0000-0000-000000000005",
  "a0000001-0000-0000-0000-000000000011",
  "a0000001-0000-0000-0000-000000000019",
  "a0000001-0000-0000-0000-000000000024",
  "a0000001-0000-0000-0000-000000000017",
];

async function seedAssessmentCenter(sb: Sb, orgId: string): Promise<DemoSeedOutcome> {
  const label = "Assessment Center";
  const existing = await sb.from("engagements").select("id").eq("organization_id", orgId).ilike("name", `${DEMO_TAG}%`).limit(1);
  if (existing.data && existing.data.length > 0) return { service: "ac", label, created: 0, note: "already present" };

  const eng = await sb.from("engagements").insert({
    organization_id: orgId,
    name: `${DEMO_TAG} Najm Capital - Senior Manager AC`,
    target_role: "Senior Manager, Corporate Banking",
    status: "active",
    start_date: "2026-06-15",
    end_date: "2026-06-17",
  }).select("id").single();
  if (eng.error || !eng.data) throw new Error(`AC engagement: ${eng.error?.message}`);
  const engId = eng.data.id as string;

  const exRes = await sb.from("exercises").insert([
    { name: `${DEMO_TAG} Strategic In-Basket`, exercise_type: "in_basket", duration_minutes: 75, description: "Digital inbox of 20 items requiring prioritization and delegation." },
    { name: `${DEMO_TAG} Leadership Role Play`, exercise_type: "role_play", duration_minutes: 30, description: "One-on-one with a direct report facing a performance issue." },
    { name: `${DEMO_TAG} Business Case Presentation`, exercise_type: "oral_presentation", duration_minutes: 20, description: "Present a market-expansion recommendation." },
  ]).select("id");
  if (exRes.error || !exRes.data) throw new Error(`AC exercises: ${exRes.error?.message}`);
  const exercises = exRes.data as { id: string }[];

  await sb.from("engagement_competencies").insert(
    AC_COMPETENCIES.map((cid, i) => ({ engagement_id: engId, competency_id: cid, weight: [2, 1.5, 2, 1.5, 1.5, 1][i] }))
  );
  await sb.from("engagement_exercises").insert(exercises.map((ex) => ({ engagement_id: engId, exercise_id: ex.id })));
  await sb.from("exercise_competency_matrix").insert([
    ...[0, 1, 2, 3].map((k) => ({ engagement_id: engId, exercise_id: exercises[0].id, competency_id: AC_COMPETENCIES[k] })),
    ...[3, 4, 5, 2].map((k) => ({ engagement_id: engId, exercise_id: exercises[1].id, competency_id: AC_COMPETENCIES[k] })),
    ...[0, 1, 3, 4, 5].map((k) => ({ engagement_id: engId, exercise_id: exercises[2].id, competency_id: AC_COMPETENCIES[k] })),
  ]);

  const candRes = await sb.from("candidates").insert([
    { engagement_id: engId, full_name: "Abdullah Al Qahtani", email: `abdullah@${DEMO_EMAIL_DOMAIN}`, status: "completed" },
    { engagement_id: engId, full_name: "Noura Al Dossari", email: `noura@${DEMO_EMAIL_DOMAIN}`, status: "in_progress" },
    { engagement_id: engId, full_name: "Yousef Al Harbi", email: `yousef@${DEMO_EMAIL_DOMAIN}`, status: "in_progress" },
  ]).select("id");
  if (candRes.error || !candRes.data) throw new Error(`AC candidates: ${candRes.error?.message}`);
  const candidates = candRes.data as { id: string }[];
  const c0 = candidates[0].id;

  const assessorId = await ensureDemoAssessor(sb);
  const assignments: { engagement_id: string; assessor_id: string; candidate_id: string; exercise_id: string }[] = [];
  for (const c of candidates) for (const ex of exercises) assignments.push({ engagement_id: engId, assessor_id: assessorId, candidate_id: c.id, exercise_id: ex.id });
  const asgRes = await sb.from("assessor_assignments").insert(assignments).select("id, candidate_id, exercise_id");
  if (asgRes.error || !asgRes.data) throw new Error(`AC assignments: ${asgRes.error?.message}`);
  const a0 = (asgRes.data as { id: string; candidate_id: string; exercise_id: string }[]).filter((a) => a.candidate_id === c0);

  await sb.from("observations").insert([
    { assessor_assignment_id: a0[0].id, competency_id: AC_COMPETENCIES[0], behavior_observed: "Prioritized the strategic merger item over operational urgencies and explained the rationale.", is_positive: true },
    { assessor_assignment_id: a0[0].id, competency_id: AC_COMPETENCIES[1], behavior_observed: "Made well-reasoned decisions on 15 of 20 items with appropriate delegation.", is_positive: true },
    { assessor_assignment_id: a0[1].id, competency_id: AC_COMPETENCIES[3], behavior_observed: "Opened with empathy and active listening before moving to solutions.", is_positive: true },
    { assessor_assignment_id: a0[1].id, competency_id: AC_COMPETENCIES[4], behavior_observed: "Did not probe the root cause of the performance decline deeply enough.", is_positive: false },
    { assessor_assignment_id: a0[2].id, competency_id: AC_COMPETENCIES[0], behavior_observed: "Presented a clear three-year roadmap linking market analysis to capabilities.", is_positive: true },
  ]);
  await sb.from("ratings").insert([
    { assessor_assignment_id: a0[0].id, competency_id: AC_COMPETENCIES[0], score: 4, justification: "Strong strategic prioritization." },
    { assessor_assignment_id: a0[0].id, competency_id: AC_COMPETENCIES[1], score: 4, justification: "Clear, well-reasoned decisions." },
    { assessor_assignment_id: a0[1].id, competency_id: AC_COMPETENCIES[3], score: 4, justification: "Strong interpersonal communication." },
    { assessor_assignment_id: a0[1].id, competency_id: AC_COMPETENCIES[4], score: 3, justification: "Competent; room to grow on root-cause analysis." },
    { assessor_assignment_id: a0[2].id, competency_id: AC_COMPETENCIES[0], score: 5, justification: "Outstanding strategic presentation." },
  ]);

  // Fully score candidate[0]: consensus + OAR + a released report, so the report,
  // analytics and candidate-detail screens have a complete example. Best-effort -
  // the base engagement still counts if a finishing step hits an unexpected column.
  let scored = "scored to OAR + released report";
  try {
    const consensus = [4, 3, 4, 4, 3, 4];
    const cnotes = [
      "Team consensus: strong strategic thinking; cross-functional integration is the development edge.",
      "Data-driven but single-scenario; growth opportunity in scenario planning and risk framing.",
      "Clear consensus on strong execution and accountability across exercises.",
      "Unanimous key strength - exceptional across written, verbal and interpersonal channels.",
      "Competent in developing others; coach on deeper root-cause exploration.",
      "Exemplary composure under pressure; redirects constructively.",
    ];
    await sb.from("consensus_ratings").insert(
      AC_COMPETENCIES.map((cid, i) => ({ engagement_id: engId, candidate_id: c0, competency_id: cid, final_score: consensus[i], discussion_notes: cnotes[i] }))
    );
    await sb.from("overall_assessment_ratings").insert({
      engagement_id: engId, candidate_id: c0, overall_score: 4, recommendation: "ready_with_development",
      summary: "Strong leadership potential with standout communication and execution. Development focus: scenario-based thinking and deeper talent-development conversations. Well suited to the Senior Manager role with targeted coaching.",
    });
    await sb.from("candidate_reports").insert({ engagement_id: engId, candidate_id: c0, status: "released", released_at: daysAgo(1) });
  } catch (e) {
    scored = `base only (scoring step skipped: ${e instanceof Error ? e.message : String(e)})`;
  }

  return { service: "ac", label, created: 1, note: `engagement + 3 candidates, 1 ${scored}` };
}

// ─────────────────────────────────── Pre-Hire ────────────────────────────────
async function seedPrehire(sb: Sb, orgId: string): Promise<DemoSeedOutcome> {
  const label = "Pre-Hire";
  const existing = await sb.from("prehire_requisitions").select("id").eq("organization_id", orgId).limit(1);
  if (existing.data && existing.data.length > 0) return { service: "prehire", label, created: 0, note: "already present" };

  const req = await sb.from("prehire_requisitions").insert({
    organization_id: orgId,
    title: "Finance Manager - GCC Growth Program",
    level: "Manager",
    english_required: true,
    status: "open",
    stage_config: [
      { kind: "fluent", weight: 0.2, cut_score: 60, required: true },
      { kind: "quiz", weight: 0.4, cut_score: 65, required: true },
      { kind: "cbi", weight: 0.4, cut_score: null, required: false },
    ],
  }).select("id").single();
  if (req.error || !req.data) throw new Error(`Pre-Hire requisition: ${req.error?.message}`);
  const reqId = req.data.id as string;

  const candRes = await sb.from("prehire_candidates").insert([
    {
      requisition_id: reqId, full_name: "Ahmed Al Mazrouei", email: `ahmed.mazrouei@${DEMO_EMAIL_DOMAIN}`,
      access_token: crypto.randomUUID(), status: "scored", current_stage: "cbi", composite_score: 74.5, recommendation: "advance",
      consent_at: daysAgo(6), invited_at: daysAgo(7), completed_at: daysAgo(1),
      gender: "male", age_band: "35_44", nationality_group: "national",
    },
    {
      requisition_id: reqId, full_name: "Leila Bin Saud", email: `leila.saud@${DEMO_EMAIL_DOMAIN}`,
      access_token: crypto.randomUUID(), status: "in_progress", current_stage: "fluent",
      consent_at: daysAgo(2), invited_at: daysAgo(2),
      gender: "female", age_band: "25_34", nationality_group: "national",
    },
  ]).select("id");
  if (candRes.error || !candRes.data) throw new Error(`Pre-Hire candidates: ${candRes.error?.message}`);
  const cands = candRes.data as { id: string }[];

  await sb.from("prehire_stage_results").insert([
    { prehire_candidate_id: cands[0].id, kind: "fluent", status: "completed", raw_score: 73, normalized_score: 73, passed: true, detail: { cefr_level: "B2", reading: 75, listening: 72 }, started_at: daysAgo(6), completed_at: daysAgo(5) },
    { prehire_candidate_id: cands[0].id, kind: "quiz", status: "completed", raw_score: 78.5, normalized_score: 78.5, passed: true, detail: { total_items: 45, correct: 35 }, started_at: daysAgo(4), completed_at: daysAgo(3) },
    { prehire_candidate_id: cands[0].id, kind: "cbi", status: "completed", raw_score: 71.25, normalized_score: 71.25, passed: true, detail: { questions_asked: 4, positive_indicators: ["structured_thinking", "stakeholder_awareness"] }, started_at: daysAgo(2), completed_at: daysAgo(1) },
    { prehire_candidate_id: cands[1].id, kind: "fluent", status: "in_progress", detail: { section_status: { listening: "in_progress" } }, started_at: daysAgo(1) },
  ]);

  try {
    await sb.from("prehire_audit_log").insert([
      { requisition_id: reqId, actor_label: "system:demo-seed", action: "requisition_created", detail: { title: "Finance Manager - GCC Growth Program" }, created_at: daysAgo(8) },
      { requisition_id: reqId, candidate_id: cands[0].id, actor_label: "system:demo-seed", action: "candidate_invited", detail: { full_name: "Ahmed Al Mazrouei" }, created_at: daysAgo(7) },
    ]);
  } catch {
    /* audit log is best-effort */
  }

  return { service: "prehire", label, created: 1, note: "requisition + 2 candidates (1 scored, 1 in progress)" };
}

// ─────────────────────────────────── Fluent ──────────────────────────────────
async function seedFluent(sb: Sb, orgId: string): Promise<DemoSeedOutcome> {
  const label = "Fluent";
  const existing = await sb.from("eng_fluent_results").select("id").eq("organization_id", orgId).limit(1);
  if (existing.data && existing.data.length > 0) return { service: "fluent", label, created: 0, note: "already present" };

  const rows = [
    { name: "Fatima Al Khoury", cefr: "B2", rc: 5, lc: 4, wc: "B1", sc: "B1", lang: "en", flags: { tabBlurCount: 0, pasteCount: 0, signal: "clear" } },
    { name: "Mohammed Al Mansouri", cefr: "A2", rc: 3, lc: 2, wc: "A2", sc: "A1", lang: "en", flags: { tabBlurCount: 2, pasteCount: 0, signal: "warning" } },
    { name: "Layla Al Sabahi", cefr: "C1", rc: 6, lc: 4, wc: "C1", sc: "B2", lang: "ar", flags: { tabBlurCount: 0, pasteCount: 0, signal: "clear" } },
  ];
  const ins = await sb.from("eng_fluent_results").insert(
    rows.map((r) => ({
      taker_name: r.name,
      taker_email: `${r.name.toLowerCase().replace(/[^a-z]+/g, ".")}@${DEMO_EMAIL_DOMAIN}`,
      ui_language: r.lang,
      overall_cefr: r.cefr,
      reading_correct: r.rc, reading_total: 6, reading_cefr: r.cefr,
      listening_correct: r.lc, listening_total: 4, listening_cefr: r.cefr,
      writing_cefr: r.wc,
      speaking_attempted: true, speaking_cefr: r.sc,
      ai_generated: false, ai_scored: true,
      organization_id: orgId,
      result: { overall_cefr: r.cefr, reading_correct: r.rc, reading_total: 6, listening_correct: r.lc, listening_total: 4, writing: { cefr: r.wc }, speaking: { attempted: true, cefr: r.sc } },
      integrity_flags: r.flags,
    }))
  );
  if (ins.error) throw new Error(`Fluent results: ${ins.error.message}`);
  return { service: "fluent", label, created: rows.length, note: "3 CEFR placement results (A2 / B2 / C1)" };
}

export async function seedDemoData(): Promise<DemoSeedOutcome[]> {
  const { organizationId } = await ensureDemoOrg();
  const sb = createServiceClient();
  const out: DemoSeedOutcome[] = [];
  const run = async (fn: () => Promise<DemoSeedOutcome>) => {
    try {
      out.push(await fn());
    } catch (e) {
      out.push({ service: "error", label: "Error", created: 0, note: e instanceof Error ? e.message : String(e) });
    }
  };
  await run(() => seedAssessmentCenter(sb, organizationId));
  await run(() => seedPrehire(sb, organizationId));
  await run(() => seedFluent(sb, organizationId));
  return out;
}
