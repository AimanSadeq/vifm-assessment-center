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
import { DEMO_SERVICE_MODULES } from "./services";
import { computeOverallRating } from "@/lib/scoring/overall-rating";

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

/** Provision one demo assessor (auth user + profile, sentinel email so purge can
 *  find it). Reuses the profile when the email already exists. */
async function ensureDemoAssessor(sb: Sb, slug: string, fullName: string, role: string): Promise<string> {
  const email = `${slug}@${DEMO_EMAIL_DOMAIN}`;
  const found = await sb.from("profiles").select("id").eq("email", email).maybeSingle();
  if (found.data?.id) return found.data.id as string;

  const created = await sb.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  let id = created.data?.user?.id;
  if (!id) {
    const again = await sb.from("profiles").select("id").eq("email", email).maybeSingle();
    id = again.data?.id as string | undefined;
  }
  if (!id) throw new Error(`Could not provision the demo assessor ${fullName}.`);
  await sb.from("profiles").upsert({ id, role, full_name: fullName, email });
  return id;
}

/**
 * The demo panel.
 *
 * A single assessor covering every participant fails the staffing rules the
 * platform now enforces (more than one assessor per participant, BPS 5.18; at
 * least one per three, BPS 5.21), so a live demonstration would open on a red
 * warning. Three assessors for three participants clears both floors and shows
 * the panel the way a real centre runs.
 */
async function ensureDemoPanel(sb: Sb): Promise<string[]> {
  return Promise.all([
    ensureDemoAssessor(sb, "assessor", "Dr. Sara Al Otaibi", "lead_assessor"),
    ensureDemoAssessor(sb, "assessor2", "Khalid Al Mutairi", "associate_assessor"),
    ensureDemoAssessor(sb, "assessor3", "Mariam Al Balushi", "associate_assessor"),
  ]);
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
/** Design weights. Also the denominator of the calculated overall rating. */
const AC_WEIGHTS = [2, 1.5, 2, 1.5, 1.5, 1];
/** Which competencies each exercise observes, as indices into AC_COMPETENCIES.
 *  Used for both the exercise-competency matrix and the assessors' integration
 *  worksheets, so the demo's evidence trail is internally consistent. */
const AC_EXERCISE_COMPETENCIES = [
  [0, 1, 2, 3],
  [3, 4, 5, 2],
  [0, 1, 3, 4, 5],
];

/** Each participant's assessed profile, as the panel sees it before the wash-up. */
const AC_PRELIMINARY_PROFILE = [
  [4, 3, 4, 4, 3, 4],
  [3, 4, 3, 4, 4, 3],
  [5, 4, 4, 3, 4, 4],
];
/** For each competency, the exercise whose assessor rates it one point above the
 *  rest. A wash-up with no divergence demonstrates nothing, but assessors two
 *  points apart on every competency would say the exercises are not measuring
 *  the same thing. One point, one dissenting view, a different assessor each
 *  time. Each entry must name an exercise that actually observes the competency
 *  (see AC_EXERCISE_COMPETENCIES). */
const AC_HIGHER_VIEW_EXERCISE = [2, 0, 1, 0, 2, 1];
const AC_WORKSHEET_NOTES = [
  "Consolidated across the exercises I observed: framing, prioritisation and the link back to the strategy.",
  "Judged on the quality of the reasoning behind each call, not on whether I would have made the same one.",
  "Looked at follow-through: what was actually committed to, and what was left open.",
  "Rated on clarity and on how the message landed with the other person, in writing and in the room.",
  "Assessed on how far the development conversation went past the symptom.",
  "Watched composure when the exercise pushed back, and what was done with the pressure.",
];

/**
 * The assessors' integration worksheets for every participant.
 *
 * An assessor writes one per competency they observed, which the exercise to
 * competency matrix decides: each exercise is assigned to a different assessor,
 * so a competency seen in two exercises gets two independent views of it.
 */
async function seedIntegrationWorksheets(
  sb: Sb,
  engId: string,
  candidates: { id: string }[],
  panel: string[]
): Promise<void> {
  const clamp = (n: number) => Math.min(5, Math.max(1, n));
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  candidates.forEach((c, ci) => {
    AC_EXERCISE_COMPETENCIES.forEach((ks, ei) => {
      const assessorId = panel[(ci + ei) % panel.length];
      for (const k of ks) {
        const key = `${c.id}:${assessorId}:${k}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const rating = clamp(AC_PRELIMINARY_PROFILE[ci][k] + (AC_HIGHER_VIEW_EXERCISE[k] === ei ? 1 : 0));
        const evidence =
          rating >= 4
            ? "Evidence was consistent across what I saw."
            : rating <= 2
              ? "Evidence was thin outside the in-basket."
              : "Evidence was mixed across what I saw.";
        rows.push({
          engagement_id: engId,
          assessor_id: assessorId,
          candidate_id: c.id,
          competency_id: AC_COMPETENCIES[k],
          preliminary_rating: rating,
          notes: `${AC_WORKSHEET_NOTES[k]} ${evidence}`,
        });
      }
    });
  });
  const res = await sb.from("integration_worksheets").insert(rows);
  if (res.error) throw new Error(`AC integration worksheets: ${res.error.message}`);
}

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
    // A demo should show the platform as a client would run it: a selection
    // centre with a calculated overall rating, on weights someone confirmed.
    // Without these the demo reads "Purpose: Not recorded" and falls back to a
    // consensus rating, which is the behaviour we changed.
    purpose: "selection",
    integration_method: "weighted_average",
    weights_confirmed_at: new Date().toISOString(),
    participant_contact_name: "Demo Engagement Lead",
    participant_contact_email: `lead@${DEMO_EMAIL_DOMAIN}`,
    other_methods_rule: "context_only",
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
    AC_COMPETENCIES.map((cid, i) => ({ engagement_id: engId, competency_id: cid, weight: AC_WEIGHTS[i] }))
  );
  await sb.from("engagement_exercises").insert(exercises.map((ex) => ({ engagement_id: engId, exercise_id: ex.id })));
  await sb.from("exercise_competency_matrix").insert(
    AC_EXERCISE_COMPETENCIES.flatMap((ks, ei) =>
      ks.map((k) => ({ engagement_id: engId, exercise_id: exercises[ei].id, competency_id: AC_COMPETENCIES[k] }))
    )
  );

  const candRes = await sb.from("candidates").insert([
    { engagement_id: engId, full_name: "Abdullah Al Qahtani", email: `abdullah@${DEMO_EMAIL_DOMAIN}`, status: "completed" },
    { engagement_id: engId, full_name: "Noura Al Dossari", email: `noura@${DEMO_EMAIL_DOMAIN}`, status: "in_progress" },
    { engagement_id: engId, full_name: "Yousef Al Harbi", email: `yousef@${DEMO_EMAIL_DOMAIN}`, status: "in_progress" },
  ]).select("id");
  if (candRes.error || !candRes.data) throw new Error(`AC candidates: ${candRes.error?.message}`);
  const candidates = candRes.data as { id: string }[];
  const c0 = candidates[0].id;

  const panel = await ensureDemoPanel(sb);
  const assignments: { engagement_id: string; assessor_id: string; candidate_id: string; exercise_id: string }[] = [];
  // Rotate the panel across exercises so each participant is seen by more than
  // one assessor and the load is spread (BPS 5.18, 5.20, 5.21).
  candidates.forEach((c, ci) => {
    exercises.forEach((ex, ei) => {
      assignments.push({
        engagement_id: engId,
        assessor_id: panel[(ci + ei) % panel.length],
        candidate_id: c.id,
        exercise_id: ex.id,
      });
    });
  });
  const asgRes = await sb.from("assessor_assignments").insert(assignments).select("id, candidate_id, exercise_id");
  if (asgRes.error || !asgRes.data) throw new Error(`AC assignments: ${asgRes.error?.message}`);
  const a0 = (asgRes.data as { id: string; candidate_id: string; exercise_id: string }[]).filter((a) => a.candidate_id === c0);

  // Integration worksheets: each assessor's own consolidated rating per
  // competency, written before the wash-up. The wash-up screen exists to
  // reconcile these, so without them it opens on an empty state and a demo
  // cannot reach the consensus grid or the calculated overall rating.
  // Assessors deliberately differ on some cells: divergence is what the
  // discussion is for (BPS 7.13).
  await seedIntegrationWorksheets(sb, engId, candidates, panel);

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
    // This is a selection centre, so the overall rating is calculated from the
    // agreed ratings and the confirmed weights rather than typed in (BPS 7.4).
    // Computed with the same function the wash-up uses, and stored with its
    // working, so the demo shows a figure that can be reconstructed.
    const names = await sb.from("competencies").select("id, name").in("id", AC_COMPETENCIES);
    const nameOf = new Map(((names.data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]));
    const computed = computeOverallRating(
      AC_COMPETENCIES.map((cid, i) => ({
        competencyId: cid,
        name: nameOf.get(cid),
        weight: AC_WEIGHTS[i],
        score: consensus[i],
      }))
    );
    await sb.from("overall_assessment_ratings").insert({
      engagement_id: engId, candidate_id: c0,
      overall_score: computed.band ?? 4,
      computed_score: computed.score,
      method: "weighted_average",
      computation: { method: "weighted_average", computedAt: new Date().toISOString(), ...computed },
      recommendation: "ready_with_development",
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
  const org = await ensureDemoOrg();
  const { organizationId } = org;
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
  for (const m of DEMO_SERVICE_MODULES) await run(() => m.seed(sb, org));
  return out;
}
